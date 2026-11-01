'use strict';
// Livelihoods — ledger sub-engine. Pure functions over a group's transactions (no I/O, no clock
// except an explicit `asOf`). All money is INTEGER paise (₹1 = 100 paise) so sums are exact.
//
// Cash conventions (draft — see content/RULES.md, PENDING REVIEW by Kudumbashree CDS / finance):
//   inflows : savings, repayment (principal), interest, income, bank_withdrawal
//   outflows: loan_out, expense, bank_deposit
//   cash in hand  = inflows − outflows
//   bank balance  = bank_deposit − bank_withdrawal
//   loans out     = loan_out − repayment (principal only; interest is recorded separately as income)
//   group fund    = savings + interest + income − expense  (= cash + bank + loans out, always)
// Repayments are applied to a member's loans oldest-first. A loan is repaid in equal monthly
// principal instalments (whole rupees; the last one takes the remainder), the first due one month
// after the loan was given. It is "overdue" when less has been repaid than was due GRACE_DAYS ago.

const GRACE_DAYS = 15;
const R = (rupees) => rupees * 100; // rupees → paise

const KINDS = {
  savings:         { dir: +1, bank: 0,  person: true,  max: R(10000),  icon: '🪙', label: 'Savings', label_ml: 'സമ്പാദ്യം' },
  repayment:       { dir: +1, bank: 0,  person: true,  max: R(200000), icon: '↩️', label: 'Loan repayment', label_ml: 'വായ്പ തിരിച്ചടവ്' },
  interest:        { dir: +1, bank: 0,  person: true,  max: R(50000),  icon: '➕', label: 'Interest paid', label_ml: 'പലിശ അടച്ചു' },
  income:          { dir: +1, bank: 0,  person: false, max: R(500000), icon: '💰', label: 'Group income (sales, grants)', label_ml: 'ഗ്രൂപ്പ് വരുമാനം (വിൽപ്പന, ഗ്രാന്റ്)' },
  bank_withdrawal: { dir: +1, bank: -1, person: false, max: R(500000), icon: '🏧', label: 'Taken from bank', label_ml: 'ബാങ്കിൽ നിന്ന് എടുത്തു' },
  loan_out:        { dir: -1, bank: 0,  person: true,  max: R(200000), icon: '🤝', label: 'Loan given', label_ml: 'വായ്പ നൽകി' },
  expense:         { dir: -1, bank: 0,  person: false, max: R(100000), icon: '🧾', label: 'Expense', label_ml: 'ചെലവ്' },
  bank_deposit:    { dir: -1, bank: +1, person: false, max: R(500000), icon: '🏦', label: 'Put in bank', label_ml: 'ബാങ്കിൽ നിക്ഷേപിച്ചു' },
};
const MAX_MONTHS = 36;

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const today = () => isoDay(new Date());
function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && isoDay(d) === s;
}
function addDays(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoDay(d); }
// Same day-of-month n months later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb).
function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return isoDay(first);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);
const monthKey = (s) => s.slice(0, 7);
function lastMonths(asOf, n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(monthKey(addMonths(asOf.slice(0, 8) + '01', -i))); return out; }

// Validate one entry on its own (amount, date, kind, months). Returns a list of error messages.
function checkEntry(t, { maxDate = addDays(today(), 1), minDate = '2000-01-01' } = {}) {
  const errors = [];
  const k = KINDS[t.kind];
  if (!k) { errors.push('Choose what kind of entry this is.'); return errors; }
  if (!Number.isInteger(t.amount) || t.amount <= 0) errors.push('Amount must be a whole number of paise greater than zero.');
  else if (t.amount > k.max) errors.push(`${k.label} cannot be more than ₹${(k.max / 100).toLocaleString('en-IN')} in one entry.`);
  if (!isDate(t.date)) errors.push('Date must be a real date (YYYY-MM-DD).');
  else if (t.date > maxDate) errors.push('Date cannot be in the future.');
  else if (t.date < minDate) errors.push('Date is before the group was formed.');
  if (k.person && !t.person_id) errors.push(`${k.label} must name the member.`);
  if (t.kind === 'loan_out' && !(Number.isInteger(t.months) && t.months >= 1 && t.months <= MAX_MONTHS)) errors.push(`Loan period must be 1–${MAX_MONTHS} months.`);
  return errors;
}

// Chronological order; on the same day money comes in before it goes out (a meeting collects first).
function order(txns) {
  return txns.filter((t) => t && !t.deleted && !Number(t.voided)).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1
    : (KINDS[b.kind] ? KINDS[b.kind].dir : 0) - (KINDS[a.kind] ? KINDS[a.kind].dir : 0)
    || String(a.entered_at || '').localeCompare(String(b.entered_at || '')) || String(a.id || '').localeCompare(String(b.id || ''))));
}

// Replay every entry: cash, bank and each member's loan must never go below zero at any point.
function replay(txns) {
  let cash = 0, bank = 0;
  const owed = new Map();
  for (const t of order(txns)) {
    const k = KINDS[t.kind];
    if (!k) return { ok: false, code: 'bad_kind', error: `Unknown entry kind "${t.kind}".`, at: t };
    cash += k.dir * t.amount;
    bank += k.bank * t.amount;
    if (t.kind === 'loan_out') owed.set(t.person_id, (owed.get(t.person_id) || 0) + t.amount);
    if (t.kind === 'repayment') {
      const o = (owed.get(t.person_id) || 0) - t.amount;
      if (o < 0) return { ok: false, code: 'overpaid', error: `Repayment on ${t.date} is more than this member's loan outstanding.`, at: t };
      owed.set(t.person_id, o);
    }
    if (t.kind === 'interest' && !owed.has(t.person_id)) return { ok: false, code: 'no_loan', error: `Interest on ${t.date} is recorded for a member who has no loan.`, at: t };
    if (cash < 0) return { ok: false, code: 'cash_negative', error: `Cash in hand would go below zero on ${t.date}. Record the money coming in first (or take it from the bank).`, at: t };
    if (bank < 0) return { ok: false, code: 'bank_negative', error: `The bank balance would go below zero on ${t.date}.`, at: t };
  }
  return { ok: true, cash, bank };
}

function summarize(txns, { asOf = null } = {}) {
  const tot = Object.fromEntries(Object.keys(KINDS).map((k) => [k, 0]));
  for (const t of order(txns)) if (KINDS[t.kind] && (!asOf || t.date <= asOf)) tot[t.kind] += t.amount;
  const cash = tot.savings + tot.repayment + tot.interest + tot.income + tot.bank_withdrawal - tot.loan_out - tot.expense - tot.bank_deposit;
  const bank = tot.bank_deposit - tot.bank_withdrawal;
  const outstanding = tot.loan_out - tot.repayment;
  const fund = tot.savings + tot.interest + tot.income - tot.expense;
  return { totals: tot, cash, bank, outstanding, fund, lendable: Math.max(0, cash) + Math.max(0, bank), balanced: fund === cash + bank + outstanding };
}

function instalments(amount, months) {
  const base = Math.floor(amount / months / 100) * 100; // whole rupees
  const out = [];
  for (let n = 1; n <= months; n++) out.push(n < months ? base : amount - base * (months - 1));
  return out;
}

// Loans with their schedule, repayments (oldest-first) and status as of a date.
function loanBook(txns, { asOf = today(), grace = GRACE_DAYS } = {}) {
  const loans = [];
  const open = new Map(); // person → loans with something left
  for (const t of order(txns)) {
    if (t.date > asOf) continue;
    if (t.kind === 'loan_out') {
      const l = { id: t.id, person_id: t.person_id, date: t.date, amount: t.amount, months: Number(t.months) || 1, request_id: t.request_id || null, repaid: 0, repayments: [], interest: 0 };
      loans.push(l);
      if (!open.has(t.person_id)) open.set(t.person_id, []);
      open.get(t.person_id).push(l);
    } else if (t.kind === 'repayment') {
      let left = t.amount;
      for (const l of open.get(t.person_id) || []) {
        if (left <= 0) break;
        const take = Math.min(left, l.amount - l.repaid);
        if (take > 0) { l.repaid += take; l.repayments.push({ date: t.date, amount: take }); left -= take; }
      }
    } else if (t.kind === 'interest') {
      const ls = (open.get(t.person_id) || []).filter((l) => l.repaid < l.amount);
      const l = ls[0] || (open.get(t.person_id) || []).slice(-1)[0];
      if (l) l.interest += t.amount;
    }
  }
  const cutoff = addDays(asOf, -grace);
  return loans.map((l) => {
    const parts = instalments(l.amount, l.months);
    let cum = 0;
    const schedule = parts.map((amt, i) => { cum += amt; return { n: i + 1, due: addMonths(l.date, i + 1), amount: amt, cumulative: cum }; });
    const dueBy = (d) => schedule.filter((s) => s.due <= d).reduce((a, s) => a + s.amount, 0);
    for (const s of schedule) s.state = l.repaid >= s.cumulative ? 'paid' : s.due < cutoff ? 'late' : s.due <= asOf ? 'due' : 'upcoming';
    const outstanding = l.amount - l.repaid;
    const overdue = Math.max(0, dueBy(cutoff) - l.repaid);
    const firstUnpaid = schedule.find((s) => s.state !== 'paid') || null;
    const status = outstanding === 0 ? 'closed' : overdue > 0 ? 'overdue' : 'on_time';
    return { ...l, outstanding, due_now: Math.max(0, dueBy(asOf) - l.repaid), overdue, status,
      days_late: status === 'overdue' && firstUnpaid ? daysBetween(firstUnpaid.due, asOf) : 0,
      next_due: firstUnpaid ? { date: firstUnpaid.due, amount: Math.min(firstUnpaid.amount, firstUnpaid.cumulative - l.repaid) } : null,
      schedule, due_to_date: dueBy(asOf) };
  });
}

// One member's own picture: savings, loans, what is due next.
function memberSummary(txns, personId, { asOf = today(), months = 6 } = {}) {
  const mine = order(txns).filter((t) => t.person_id === personId && t.date <= asOf);
  const window = lastMonths(asOf, months);
  const byMonth = Object.fromEntries(window.map((m) => [m, 0]));
  let savings = 0, interest = 0;
  for (const t of mine) {
    if (t.kind === 'savings') { savings += t.amount; if (byMonth[monthKey(t.date)] !== undefined) byMonth[monthKey(t.date)] += t.amount; }
    if (t.kind === 'interest') interest += t.amount;
  }
  const loans = loanBook(txns, { asOf }).filter((l) => l.person_id === personId);
  const open = loans.filter((l) => l.status !== 'closed');
  return {
    savings, interest_paid: interest, savings_by_month: window.map((m) => ({ month: m, amount: byMonth[m] })),
    loans, outstanding: open.reduce((a, l) => a + l.outstanding, 0), overdue: open.reduce((a, l) => a + l.overdue, 0),
    status: !open.length ? 'no_loan' : open.some((l) => l.status === 'overdue') ? 'overdue' : 'on_time',
    next_due: open.map((l) => l.next_due).filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null,
  };
}

// Simple health indicators for a group (draft thresholds — content/RULES.md).
// members: [{person_id, joined_on, status}]  meetings: [{date}]
function health(txns, meetings, members, { asOf = today(), months = 6 } = {}) {
  const window = lastMonths(asOf, months);
  const saved = new Set();
  for (const t of order(txns)) if (t.kind === 'savings' && t.date <= asOf) saved.add(t.person_id + '|' + monthKey(t.date));
  let slots = 0, hits = 0;
  for (const m of members.filter((x) => x.status !== 'left')) {
    for (const mk of window) {
      if (m.joined_on && monthKey(m.joined_on) > mk) continue;
      slots++; if (saved.has(m.person_id + '|' + mk)) hits++;
    }
  }
  const book = loanBook(txns, { asOf });
  const due = book.reduce((a, l) => a + l.due_to_date, 0);
  const covered = book.reduce((a, l) => a + Math.min(l.repaid, l.due_to_date), 0);
  const open = book.filter((l) => l.status !== 'closed');
  const overdue = open.filter((l) => l.status === 'overdue').length;
  const since90 = addDays(asOf, -90);
  const meetings90 = meetings.filter((m) => m.date >= since90 && m.date <= asOf).length;
  const savingsRegularity = slots ? hits / slots : null;
  const repaymentRate = due ? covered / due : null;
  let grade = 'watch';
  if ((savingsRegularity !== null && savingsRegularity < 0.5) || (repaymentRate !== null && repaymentRate < 0.7) || meetings90 === 0) grade = 'help';
  else if ((savingsRegularity === null || savingsRegularity >= 0.8) && (repaymentRate === null || repaymentRate >= 0.9) && meetings90 >= 3) grade = 'good';
  return {
    savings_regularity: savingsRegularity === null ? null : Math.round(savingsRegularity * 100) / 100,
    repayment_rate: repaymentRate === null ? null : Math.round(repaymentRate * 100) / 100,
    loans_open: open.length, loans_overdue: overdue, loans_on_time_pct: open.length ? Math.round(((open.length - overdue) / open.length) * 100) : null,
    meetings_90d: meetings90, grade,
  };
}

const rupees = (paise) => (Number(paise) || 0) / 100;
const fmt = (paise) => '₹' + rupees(paise).toLocaleString('en-IN', { maximumFractionDigits: 2 });

module.exports = { KINDS, GRACE_DAYS, MAX_MONTHS, isDate, addDays, addMonths, lastMonths, today, checkEntry, order, replay, summarize, instalments, loanBook, memberSummary, health, rupees, fmt };
