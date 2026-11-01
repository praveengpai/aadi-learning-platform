'use strict';
// Livelihoods & SHGs: ledger maths, offline-style meeting capture, loan request round trip through the
// CDS, member's own view, privacy across agencies / hamlets / donors, consent withdrawal, mass-assignment,
// product listing approval and catalogue privacy, k-anonymised aggregates with complementary suppression,
// and the per-hamlet switch.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../modules/livelihoods/ledger');
const { CDS_AGENCY_ID } = require('../modules/livelihoods');
const { bootDemo } = require('./helpers');

const M = '/api/m/livelihoods';
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PS/HgAFXQJMm+Ys9QAAAABJRU5ErkJggg==';

// ---------------- pure ledger ----------------
test('ledger: balance, cash, bank, outstanding and the fund identity', () => {
  const tx = [
    { id: 'a', date: '2026-01-05', kind: 'savings', amount: 50000, person_id: 'p1' },
    { id: 'b', date: '2026-01-05', kind: 'savings', amount: 30000, person_id: 'p2' },
    { id: 'c', date: '2026-01-12', kind: 'loan_out', amount: 60000, person_id: 'p1', months: 3 },
    { id: 'd', date: '2026-02-12', kind: 'repayment', amount: 20000, person_id: 'p1' },
    { id: 'e', date: '2026-02-12', kind: 'interest', amount: 600, person_id: 'p1' },
    { id: 'f', date: '2026-02-20', kind: 'bank_deposit', amount: 30000 },
    { id: 'g', date: '2026-02-21', kind: 'expense', amount: 1000 },
    { id: 'h', date: '2026-02-22', kind: 'savings', amount: 9999, person_id: 'p2', voided: 1 },
  ];
  assert.ok(L.replay(tx).ok);
  const s = L.summarize(tx);
  assert.equal(s.cash, 80000 - 60000 + 20000 + 600 - 30000 - 1000);
  assert.equal(s.bank, 30000);
  assert.equal(s.outstanding, 40000);
  assert.equal(s.fund, 80000 + 600 - 1000);
  assert.equal(s.fund, s.cash + s.bank + s.outstanding, 'fund = cash + bank + loans out');
  assert.ok(s.balanced);
  assert.equal(s.lendable, s.cash + s.bank);
  assert.equal(s.totals.savings, 80000, 'voided entry ignored');
});

test('ledger: refuses a negative balance, an over-repayment and interest with no loan', () => {
  const base = [{ id: 'a', date: '2026-01-05', kind: 'savings', amount: 10000, person_id: 'p1' }];
  const r1 = L.replay([...base, { id: 'b', date: '2026-01-06', kind: 'loan_out', amount: 10001, person_id: 'p1', months: 2 }]);
  assert.equal(r1.ok, false); assert.equal(r1.code, 'cash_negative');
  const r2 = L.replay([...base, { id: 'b', date: '2026-01-04', kind: 'expense', amount: 100 }]);
  assert.equal(r2.code, 'cash_negative', 'an expense dated before any money came in');
  const r3 = L.replay([...base, { id: 'b', date: '2026-01-06', kind: 'loan_out', amount: 5000, person_id: 'p1', months: 2 }, { id: 'c', date: '2026-02-06', kind: 'repayment', amount: 6000, person_id: 'p1' }]);
  assert.equal(r3.code, 'overpaid');
  assert.equal(L.replay([...base, { id: 'b', date: '2026-01-06', kind: 'interest', amount: 100, person_id: 'p2' }]).code, 'no_loan');
  assert.equal(L.replay([...base, { id: 'b', date: '2026-01-06', kind: 'bank_withdrawal', amount: 100 }]).code, 'bank_negative');
  // same day: money in before money out
  assert.ok(L.replay([{ id: 'x', date: '2026-01-05', kind: 'loan_out', amount: 100, person_id: 'p1', months: 1 }, { id: 'y', date: '2026-01-05', kind: 'savings', amount: 100, person_id: 'p2' }]).ok);
});

test('ledger: entry validation — positive integer paise, sane limits, real dates, member and months', () => {
  const ok = { kind: 'savings', amount: 5000, date: '2026-03-01', person_id: 'p' };
  assert.deepEqual(L.checkEntry(ok), []);
  for (const bad of [{ amount: 0 }, { amount: -5 }, { amount: 10.5 }, { amount: '500' }, { amount: L.KINDS.savings.max + 1 }, { date: '2026-02-30' }, { date: '2999-01-01' }, { person_id: null }, { kind: 'gift' }]) {
    assert.ok(L.checkEntry({ ...ok, ...bad }).length > 0, JSON.stringify(bad));
  }
  assert.ok(L.checkEntry({ kind: 'loan_out', amount: 100, date: '2026-03-01', person_id: 'p' }).length, 'loan needs months');
  assert.ok(L.checkEntry({ kind: 'loan_out', amount: 100, date: '2026-03-01', person_id: 'p', months: 37 }).length);
  assert.deepEqual(L.checkEntry({ kind: 'loan_out', amount: 100, date: '2026-03-01', person_id: 'p', months: 12 }), []);
  assert.ok(L.checkEntry({ ...ok, date: '2025-01-01' }, { minDate: '2025-06-01' }).length, 'before the group was formed');
});

test('ledger: schedule, outstanding per member, on time vs overdue with grace, oldest loan repaid first', () => {
  const tx = [
    { id: 's', date: '2026-01-01', kind: 'savings', amount: 200000, person_id: 'p1' },
    { id: 'l1', date: '2026-01-10', kind: 'loan_out', amount: 30000, person_id: 'p1', months: 3 },
    { id: 'l2', date: '2026-01-10', kind: 'loan_out', amount: 10000, person_id: 'p2', months: 1 },
    { id: 'r1', date: '2026-02-10', kind: 'repayment', amount: 10000, person_id: 'p1' },
  ];
  assert.deepEqual(L.instalments(30000, 3), [10000, 10000, 10000]);
  assert.deepEqual(L.instalments(10050, 2), [5000, 5050], 'whole rupees, remainder in the last one');
  const asOf = '2026-03-20'; // p1: 2 instalments due (10 Feb, 10 Mar) — 10 Mar is within the 15-day grace
  const book = L.loanBook(tx, { asOf });
  const a = book.find((l) => l.id === 'l1');
  assert.deepEqual(a.schedule.map((x) => x.due), ['2026-02-10', '2026-03-10', '2026-04-10']);
  assert.equal(a.outstanding, 20000);
  assert.equal(a.status, 'on_time');
  assert.equal(a.due_now, 10000);
  assert.deepEqual(a.next_due, { date: '2026-03-10', amount: 10000 });
  const b = book.find((l) => l.id === 'l2');
  assert.equal(b.status, 'overdue'); assert.equal(b.overdue, 10000); assert.ok(b.days_late > 30);
  assert.equal(L.loanBook(tx, { asOf: '2026-03-30' }).find((l) => l.id === 'l1').status, 'overdue', 'after the grace period');
  // two loans: repayment goes to the older one first
  const two = [...tx, { id: 'l3', date: '2026-02-15', kind: 'loan_out', amount: 5000, person_id: 'p1', months: 1 }, { id: 'r2', date: '2026-03-10', kind: 'repayment', amount: 25000, person_id: 'p1' }];
  const bk = L.loanBook(two, { asOf: '2026-03-12' });
  assert.equal(bk.find((l) => l.id === 'l1').status, 'closed');
  assert.equal(bk.find((l) => l.id === 'l3').outstanding, 0);
  const me = L.memberSummary(two, 'p1', { asOf: '2026-03-12' });
  assert.equal(me.outstanding, 0); assert.equal(me.status, 'no_loan'); assert.equal(me.savings, 200000);
  const m2 = L.memberSummary(tx, 'p2', { asOf });
  assert.equal(m2.status, 'overdue'); assert.equal(m2.outstanding, 10000);
  // month-end clamping
  assert.equal(L.addMonths('2026-01-31', 1), '2026-02-28');
});

test('ledger: health indicators — savings regularity, repayment rate, grade', () => {
  const members = [{ person_id: 'p1', joined_on: '2025-01-01' }, { person_id: 'p2', joined_on: '2025-01-01' }];
  const months = L.lastMonths('2026-06-15', 6);
  const tx = [];
  for (const m of months) { tx.push({ id: 'a' + m, date: m + '-05', kind: 'savings', amount: 1000, person_id: 'p1' }); }
  tx.push({ id: 'b', date: months[5] + '-05', kind: 'savings', amount: 1000, person_id: 'p2' });
  const meetings = months.map((m) => ({ date: m + '-05' }));
  const h = L.health(tx, meetings, members, { asOf: '2026-06-15' });
  assert.equal(h.savings_regularity, Math.round((7 / 12) * 100) / 100);
  assert.equal(h.repayment_rate, null, 'no loans yet');
  assert.equal(h.grade, 'watch');
  assert.equal(L.health([], [], members, { asOf: '2026-06-15' }).grade, 'help');
});

// ---------------- through the platform ----------------
let N, D, B;
test.before(async () => { N = await bootDemo(); D = N.demo; B = N.brain; });
test.after(async () => { await N.close(); });
const user = (username) => B.store.one('SELECT * FROM users WHERE username=? AND deleted=0', username);
const groupsIn = (hk, agency = CDS_AGENCY_ID) => B.store.all('SELECT * FROM livelihoods_groups WHERE deleted=0 AND hamlet_id=? AND agency_id=? ORDER BY name', D.hamletByKey[hk].id, agency);
const members = (gid) => B.store.all("SELECT * FROM livelihoods_members WHERE deleted=0 AND status='active' AND group_id=?", gid);
const guardianGroup = () => B.store.one("SELECT g.* FROM livelihoods_groups g JOIN livelihoods_members m ON m.group_id=g.id WHERE m.person_id=? AND m.deleted=0 AND g.deleted=0", D.demoGuardian.id);
const today = () => new Date().toISOString().slice(0, 10);

test('seed: fictional CDS, users, programmes, groups in h1/h2/h11, months of books, requests and products', async () => {
  const a = B.store.get('agencies', CDS_AGENCY_ID);
  assert.equal(a.name, 'Demo Kudumbashree CDS (fictional)');
  assert.equal(user('demo.cds').role, 'field_officer');
  assert.equal(user('demo.cds.admin').role, 'agency_admin');
  for (const hk of ['h1', 'h2', 'h11']) {
    assert.ok(B.store.one("SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0", CDS_AGENCY_ID, D.hamletByKey[hk].id), hk);
    const n = B.store.one('SELECT COUNT(*) n FROM livelihoods_groups WHERE deleted=0 AND hamlet_id=?', D.hamletByKey[hk].id).n;
    assert.ok(n >= 2 && n <= 3, `${hk} has 2–3 groups (${n})`);
  }
  assert.ok(B.store.find('programmes', { track: 'livelihood', module: 'livelihoods' }).some((p) => p.agency_id === D.agencyByKey.cif.id && p.hamlet_id === D.hamletByKey.h11.id));
  const span = B.store.one('SELECT MIN(date) a, MAX(date) b FROM livelihoods_meetings WHERE deleted=0');
  assert.ok((Date.parse(span.b) - Date.parse(span.a)) / 86400e3 > 150, 'about 6 months of meetings');
  for (const g of B.store.all('SELECT * FROM livelihoods_groups WHERE deleted=0')) {
    const tx = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id);
    assert.ok(L.replay(tx).ok, 'seeded book is valid for ' + g.name);
    assert.ok(L.summarize(tx).balanced);
    for (const m of members(g.id)) assert.ok(B.policy.activeConsent(m.person_id, g.agency_id, 'livelihood'), 'member consented');
  }
  // consent was merged, not replaced: the guardian kept her CIF consent and got a CDS one
  assert.ok(B.policy.activeConsent(D.demoGuardian.id, CDS_AGENCY_ID, 'livelihood'));
  assert.ok(B.policy.activeConsent(D.demoGuardian.id, D.agencyByKey.cif.id, 'profile'), 'CIF consent untouched');
  const n = B.store.one("SELECT COUNT(*) n FROM livelihoods_products WHERE deleted=0").n;
  assert.ok(n >= 8 && n <= 12);
  assert.ok(B.store.one("SELECT COUNT(*) n FROM form_submissions WHERE form_key='livelihoods.loan_request' AND status IN ('replied','closed')").n >= 1, 'some requests answered');
  assert.ok(B.store.one("SELECT COUNT(*) n FROM form_submissions WHERE form_key='livelihoods.loan_request' AND status='submitted'").n >= 1, 'some waiting');
  assert.ok(guardianGroup(), 'the demo guardian is in a group');
});

test('facilitator home and group book: CDS officer sees groups in her hamlets with members and ledger', async () => {
  const home = await N.as('demo.cds').get(M + '/home');
  assert.equal(home.status, 200, JSON.stringify(home.body));
  assert.ok(home.body.hamlets.length >= 3);
  const g = groupsIn('h1')[0];
  const r = await N.as('demo.cds').get(M + '/groups/' + g.id);
  assert.equal(r.status, 200);
  assert.ok(r.body.members.length >= 3 && r.body.members.every((m) => m.name));
  assert.equal(r.body.hidden_members, 0);
  assert.ok(r.body.ledger.length > 10);
  assert.ok(r.body.summary.balanced);
  assert.equal(r.body.by_month.length, 6);
});

test('meeting recorded offline-style: one request with savings + repayments, replay with the same client_ref is not doubled', async () => {
  const g = groupsIn('h1')[0];
  const mem = members(g.id);
  const before = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id);
  const debtor = L.loanBook(before).find((l) => l.status !== 'closed' && mem.some((m) => m.person_id === l.person_id));
  const body = { date: today(), attendance: mem.length, client_ref: 'dev1-meet-001', notes: 'Visit day',
    savings: mem.map((m) => ({ person_id: m.person_id, amount: 5000 })),
    repayments: debtor ? [{ person_id: debtor.person_id, amount: Math.min(1000, debtor.outstanding) }] : [] };
  const r = await N.as('demo.cds').post(`${M}/groups/${g.id}/meetings`, body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.meeting.savings_collected, 5000 * mem.length);
  const again = await N.as('demo.cds').post(`${M}/groups/${g.id}/meetings`, body);
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.meeting.id, r.body.meeting.id);
  const after = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id);
  assert.equal(after.length, before.length + mem.length + (debtor ? 1 : 0), 'replay added nothing');
  // single transaction with client ref is idempotent too
  const t = { kind: 'expense', amount: 2500, date: today(), note: 'Pass book', client_ref: 'dev1-tx-9' };
  const t1 = await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, t);
  assert.equal(t1.status, 200, JSON.stringify(t1.body));
  const t2 = await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, t);
  assert.equal(t2.body.duplicate, true);
  // invalid entries refused
  assert.equal((await N.as('demo.cds').post(`${M}/groups/${g.id}/meetings`, { ...body, client_ref: 'x2', attendance: 99 })).status, 400);
  assert.equal((await N.as('demo.cds').post(`${M}/groups/${g.id}/meetings`, { ...body, client_ref: 'x3', savings: [{ person_id: mem[0].person_id, amount: -50 }] })).status, 400);
  assert.equal((await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, { kind: 'savings', amount: 12.5, date: today(), person_id: mem[0].person_id })).status, 400);
});

test('the server refuses any entry that would make cash or a loan go negative', async () => {
  const g = groupsIn('h1')[0];
  const tx = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id);
  const s = L.summarize(tx);
  const r = await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, { kind: 'expense', amount: Math.min(L.KINDS.expense.max, s.cash + 100), date: today() });
  if (s.cash + 100 <= L.KINDS.expense.max) { assert.equal(r.status, 409); assert.equal(r.body.error, 'cash_negative'); } else assert.equal(r.status, 400);
  const mem = members(g.id).find((m) => L.memberSummary(tx, m.person_id).outstanding === 0);
  const over = await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, { kind: 'repayment', amount: 100, date: today(), person_id: mem.person_id });
  assert.equal(over.status, 409); assert.equal(over.body.error, 'overpaid');
  // cancelling the savings that a later loan depends on is refused too
  const big = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=? AND kind=\'savings\' ORDER BY amount DESC LIMIT 1', g.id)[0];
  const v = await N.as('demo.cds').post(`${M}/txns/${big.id}/void`, { reason: 'test' });
  assert.ok([200, 409].includes(v.status));
  assert.ok(L.replay(B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id)).ok, 'book stays valid either way');
});

test('loan request → CDS queue (flags) → reply visible to member and facilitator → loan given against it', async () => {
  const g = guardianGroup();
  const pid = D.demoGuardian.id;
  const fac = N.as('demo.cds');
  const tx = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id);
  const lend = L.summarize(tx).lendable;
  const big = await fac.post(`${M}/groups/${g.id}/loan-requests`, { person_id: pid, purpose: 'livestock', amount: Math.min(200000, Math.ceil(lend / 100) + 1000), months: 10, group_agreed: 'yes', client_ref: 'lr-big' });
  assert.equal(big.status, 200, JSON.stringify(big.body));
  assert.ok(big.body.flags.find((f) => f.code === 'above_lendable'), 'more than the group can lend is flagged');
  assert.ok(big.body.priority >= 2);
  const s = await fac.post(`${M}/groups/${g.id}/loan-requests`, { person_id: pid, purpose: 'enterprise', amount: 1000, months: 4, group_agreed: 'yes', client_ref: 'lr-ok' });
  assert.equal(s.status, 200);
  assert.equal(s.body.status, 'submitted');
  assert.ok(!s.body.flags.find((f) => f.code === 'above_lendable'));
  // the same officer cannot approve her own entry; the CDS admin can
  assert.equal((await fac.post(`${M}/requests/${s.body.id}/decide`, { decision: 'approved' })).status, 403);
  const q = await N.as('demo.cds.admin').get(M + '/requests');
  assert.equal(q.status, 200);
  const item = q.body.find((x) => x.id === s.body.id);
  assert.ok(item && item.group && item.group.id === g.id && item.book && typeof item.book.lendable === 'number');
  assert.equal((await N.as('demo.facilitator').post(`${M}/requests/${s.body.id}/decide`, { decision: 'approved' })).status, 403, 'CIF facilitator cannot review');
  const before = B.store.one('SELECT COUNT(*) n FROM notifications WHERE person_id=?', pid).n;
  const d = await N.as('demo.cds.admin').post(`${M}/requests/${s.body.id}/decide`, { decision: 'approved', reply: 'Approved. Take it at the next meeting.', reply_ml: 'അനുവദിച്ചു.' });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.outcome, 'approved');
  const notes = B.store.all('SELECT message FROM notifications WHERE person_id=? ORDER BY created_at DESC', pid);
  assert.equal(notes.length, before + 1);
  assert.ok(!/loan|livelihood|group|₹|approved/i.test(notes[0].message), 'neutral notification');
  // member sees the reply in her own view
  const my = await N.as('demo.guardian').get(M + '/my');
  assert.equal(my.status, 200);
  const mine = my.body.requests.find((x) => x.id === s.body.id);
  assert.equal(mine.reply_ml, 'അനുവദിച്ചു.');
  assert.equal(mine.outcome, 'approved');
  // facilitator sees it in the group book
  const book = await fac.get(M + '/groups/' + g.id);
  assert.ok(book.body.requests.find((x) => x.id === s.body.id && x.reply));
  // loan given against the approved request: amount capped, only once
  assert.equal((await fac.post(`${M}/groups/${g.id}/txns`, { kind: 'loan_out', amount: 200000, months: 4, date: today(), person_id: pid, request_id: s.body.id })).status, 400);
  const give = await fac.post(`${M}/groups/${g.id}/txns`, { kind: 'loan_out', amount: 100000, months: 4, date: today(), person_id: pid, request_id: s.body.id });
  assert.equal(give.status, 200, JSON.stringify(give.body));
  assert.equal((await fac.post(`${M}/groups/${g.id}/txns`, { kind: 'loan_out', amount: 100000, months: 4, date: today(), person_id: pid, request_id: s.body.id })).status, 409);
  assert.equal(B.store.get('form_submissions', s.body.id).status, 'closed');
  // a declined / pending request cannot be used
  assert.equal((await fac.post(`${M}/groups/${g.id}/txns`, { kind: 'loan_out', amount: 1000, months: 4, date: today(), person_id: pid, request_id: big.body.id })).status, 409);
});

test('loan rule flags a member with an overdue loan', async () => {
  for (const g of B.store.all('SELECT * FROM livelihoods_groups WHERE deleted=0 AND agency_id=?', CDS_AGENCY_ID)) {
    const tx = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id);
    const late = L.loanBook(tx).find((l) => l.status === 'overdue');
    if (!late) continue;
    const r = await N.as('demo.cds').post(`${M}/groups/${g.id}/loan-requests`, { person_id: late.person_id, purpose: 'health', amount: 500, months: 2 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.flags.find((f) => f.code === 'member_overdue'));
    return;
  }
  // no overdue loan in the seed: make one
  const g = groupsIn('h2')[0];
  const pid = members(g.id)[2].person_id;
  const old = L.addMonths(today(), -3);
  B.store.put('livelihoods_txns', { group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, date: old, kind: 'loan_out', amount: 100, months: 1, person_id: pid, entered_at: old, voided: 0 });
  const r = await N.as('demo.cds').post(`${M}/groups/${g.id}/loan-requests`, { person_id: pid, purpose: 'health', amount: 500, months: 2 });
  assert.ok(r.body.flags.find((f) => f.code === 'member_overdue'));
});

test('enterprise idea is reviewed with advice', async () => {
  const g = groupsIn('h2')[0];
  const pid = members(g.id)[0].person_id;
  const s = await N.as('demo.cds').post(M + '/ideas', { person_id: pid, kind: 'honey', idea: 'Bottle forest honey with our own label.', needs: ['market', 'licence'], group_id: g.id });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.ok(s.body.flags.find((f) => f.code === 'food_licence'));
  const r = await N.as('demo.cds.admin').post(`${M}/requests/${s.body.id}/decide`, { reply: 'Good idea — start with 20 bottles; we will help with FSSAI registration.' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, 'closed');
  assert.equal(r.body.outcome, 'advice');
});

test('member view: the person sees only her own savings and loans, in plain numbers', async () => {
  const r = await N.as('demo.guardian').get(M + '/my');
  assert.equal(r.status, 200);
  assert.ok(r.body.groups.length >= 1);
  const g = r.body.groups[0];
  assert.ok(g.me.savings > 0);
  assert.ok(Array.isArray(g.me.loans) && g.me.loans.every((l) => Array.isArray(l.schedule)));
  const txt = JSON.stringify(r.body);
  for (const m of members(g.group.id).filter((x) => x.person_id !== D.demoGuardian.id)) {
    assert.ok(!txt.includes(m.person_id), 'no other member ids');
    assert.ok(!txt.includes(B.store.get('persons', m.person_id).name), 'no other member names');
  }
  for (const x of r.body.requests) assert.ok(!('flags' in x) && !('person' in x));
  // a member cannot open the staff book or another person's card
  assert.equal((await N.as('demo.guardian').get(M + '/groups/' + g.group.id)).status, 403);
  const other = members(g.group.id).find((x) => x.person_id !== D.demoGuardian.id);
  assert.equal((await N.as('demo.guardian').get(`${M}/groups/${g.group.id}/members/${other.person_id}`)).status, 403);
  // a learner (child) with no group sees an empty page, not someone else's
  const kid = await N.as('demo.learner').get(M + '/my');
  assert.equal(kid.status, 200);
  assert.equal(kid.body.groups.length, 0);
});

test('security: another agency, donor, hamlet-limited staff outside their hamlet are refused', async () => {
  const g1 = groupsIn('h1')[0], g2 = groupsIn('h2')[0];
  const pid = members(g1.id)[0].person_id;
  // CIF staff (another agency) cannot open the CDS group book, its member cards or write to it
  for (const u of ['demo.facilitator', 'demo.cif.admin', 'demo.vjt.admin', 'demo.agri']) {
    assert.equal((await N.as(u).get(M + '/groups/' + g1.id)).status, 403, u);
    assert.equal((await N.as(u).post(`${M}/groups/${g1.id}/txns`, { kind: 'savings', amount: 100, date: today(), person_id: pid })).status, 403, u);
  }
  assert.equal((await N.as('demo.facilitator').get(M + '/groups')).body.filter((g) => g.agency_id === CDS_AGENCY_ID).length, 0);
  assert.equal((await N.as('demo.vjt.admin').get(M + '/requests?all=1')).body.length, 0);
  // donor / govt: aggregates only
  for (const u of ['demo.donor', 'demo.govt']) {
    assert.equal((await N.as(u).get(M + '/groups/' + g1.id)).status, 403);
    assert.equal((await N.as(u).get(M + '/home')).status, 403);
    assert.equal((await N.as(u).get(M + '/requests')).status, 403);
  }
  // a CDS field officer limited to h1 cannot reach h2
  const lim = B.createUser({ username: 'demo.cds.h1', password: 'demo1234', role: 'field_officer', agency_id: CDS_AGENCY_ID, hamlet_ids: [D.hamletByKey.h1.id], display_name: 'CDS h1 only', safeguarding_trained: 1 }, null);
  assert.ok(lim);
  assert.equal((await N.as('demo.cds.h1').get(M + '/groups/' + g2.id)).status, 403);
  assert.equal((await N.as('demo.cds.h1').get(M + '/groups/' + g1.id)).status, 200);
  assert.ok((await N.as('demo.cds.h1').get(M + '/groups')).body.every((g) => g.hamlet_id === D.hamletByKey.h1.id));
  assert.equal((await N.as('demo.cds.h1').post(M + '/groups', { hamlet_id: D.hamletByKey.h2.id, name: 'Sneaky NHG' })).status, 403);
  const reqH2 = B.store.one("SELECT id FROM form_submissions WHERE form_key='livelihoods.loan_request' AND hamlet_id=? AND deleted=0", D.hamletByKey.h2.id);
  assert.equal((await N.as('demo.cds.h1').get(M + '/requests/' + reqH2.id)).status, 403);
});

test('security: mass-assignment — another group id, agency id, hamlet id or a non-member are refused or ignored', async () => {
  const g1 = groupsIn('h1')[0], g2 = groupsIn('h2')[0];
  const m2 = members(g2.id)[0].person_id;
  // posting another group's member into this group's book
  const r1 = await N.as('demo.cds').post(`${M}/groups/${g1.id}/txns`, { kind: 'savings', amount: 100, date: today(), person_id: m2, group_id: g2.id, hamlet_id: g2.hamlet_id });
  assert.equal(r1.status, 400);
  // body fields for group/hamlet/agency/id are ignored: the entry lands in the URL's group
  const r2 = await N.as('demo.cds').post(`${M}/groups/${g1.id}/txns`, { kind: 'expense', amount: 100, date: today(), group_id: g2.id, hamlet_id: g2.hamlet_id, agency_id: D.agencyByKey.vjt.id, id: 'txn_hijack', entered_by: 'someone' });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  const row = B.store.get('livelihoods_txns', r2.body.id);
  assert.equal(row.group_id, g1.id); assert.equal(row.hamlet_id, g1.hamlet_id); assert.equal(row.agency_id, CDS_AGENCY_ID);
  assert.notEqual(row.id, 'txn_hijack'); assert.equal(row.entered_by, user('demo.cds').id);
  // creating a group for another agency: agency comes from the account
  const g = await N.as('demo.cds').post(M + '/groups', { hamlet_id: D.hamletByKey.h1.id, name: 'New Test NHG', agency_id: D.agencyByKey.cif.id, id: g1.id });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.agency_id, CDS_AGENCY_ID);
  assert.notEqual(g.body.id, g1.id);
  assert.equal(B.store.get('livelihoods_groups', g1.id).name, g1.name, 'existing group untouched');
  // CIF agency admin cannot create a group in a hamlet where CIF is not present... nor write into CDS group via id
  const cifG = await N.as('demo.cif.admin').post(M + '/groups', { hamlet_id: D.hamletByKey.h1.id, name: 'CIF Enterprise' });
  assert.equal(cifG.status, 200);
  assert.equal(cifG.body.agency_id, D.agencyByKey.cif.id);
  // adding a person without livelihood consent to CDS
  const noConsent = D.adults.find((p) => p.hamlet_id === D.hamletByKey.h1.id && !B.policy.activeConsent(p.id, CDS_AGENCY_ID, 'livelihood'));
  assert.equal((await N.as('demo.cds').post(`${M}/groups/${g.body.id}/members`, { person_id: noConsent.id })).status, 403);
  // a person from another hamlet
  assert.equal((await N.as('demo.cds').post(`${M}/groups/${g.body.id}/members`, { person_id: m2 })).status, 400);
  // a loan request naming another group: the member must belong to the URL's group
  assert.equal((await N.as('demo.cds').post(`${M}/groups/${g1.id}/loan-requests`, { person_id: m2, purpose: 'other', amount: 500, months: 2 })).status, 400);
  // a loan request sent through the core API with another agency's group id is flagged and cannot be approved
  const cifPerson = D.adults.find((p) => p.hamlet_id === D.hamletByKey.h1.id && B.policy.canSee(user('demo.facilitator'), p.id, 'profile').ok);
  B.grantConsent({ person_id: cifPerson.id, agency_id: D.agencyByKey.cif.id, scopes: [...new Set([...(B.store.find('consents', { person_id: cifPerson.id, agency_id: D.agencyByKey.cif.id, status: 'active' })[0] || { scopes: [] }).scopes, 'livelihood'])], granted_by: cifPerson.id, relation: 'self' }, null);
  const forged = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'livelihoods.loan_request', person_id: cifPerson.id, answers: { group_id: g1.id, purpose: 'other', amount: 500, months: 2 } });
  assert.equal(forged.status, 200, JSON.stringify(forged.body));
  assert.ok(forged.body.flags.find((f) => f.code === 'not_member'));
  assert.equal(forged.body.flags.length, 1, 'no hints about the other group\'s book');
  const shown = (await N.as('demo.cif.admin').get(M + '/requests/' + forged.body.id)).body;
  assert.equal(shown.group, null); assert.equal(shown.group_mismatch, true);
  assert.equal((await N.as('demo.cif.admin').post(`${M}/requests/${forged.body.id}/decide`, { decision: 'approved' })).status, 409);
});

test('consent withdrawal: the member disappears from staff views; entries for her are refused', async () => {
  const g = groupsIn('h2')[0];
  const m = members(g.id).find((x) => x.role === 'member');
  const fac = N.as('demo.cds');
  assert.ok((await fac.get(M + '/groups/' + g.id)).body.members.find((x) => x.person_id === m.person_id));
  const c = B.store.find('consents', { person_id: m.person_id, agency_id: CDS_AGENCY_ID, status: 'active' })[0];
  B.revokeConsent(c.id, null);
  try {
    const book = await fac.get(M + '/groups/' + g.id);
    assert.ok(!book.body.members.find((x) => x.person_id === m.person_id));
    assert.equal(book.body.hidden_members, 1);
    assert.ok(book.body.ledger.every((t) => t.person_id !== m.person_id && t.person_name !== B.store.get('persons', m.person_id).name));
    assert.equal((await fac.get(`${M}/groups/${g.id}/members/${m.person_id}`)).status, 403);
    assert.equal((await fac.post(`${M}/groups/${g.id}/txns`, { kind: 'savings', amount: 100, date: today(), person_id: m.person_id })).status, 403);
    assert.equal((await fac.post(`${M}/groups/${g.id}/loan-requests`, { person_id: m.person_id, purpose: 'other', amount: 500, months: 2 })).status, 403);
    assert.ok(!(await N.as('demo.cds.admin').get(M + '/requests?all=1')).body.some((x) => x.person && x.person.id === m.person_id));
  } finally {
    B.grantConsent({ person_id: m.person_id, agency_id: CDS_AGENCY_ID, scopes: c.scopes, granted_by: c.granted_by, relation: c.relation }, null);
  }
  assert.ok((await fac.get(M + '/groups/' + g.id)).body.members.find((x) => x.person_id === m.person_id));
});

test('products: listing needs the group\'s agreement and an agency admin; catalogue shows no member names', async () => {
  const g = groupsIn('h1')[0];
  const fac = N.as('demo.cds');
  assert.equal((await fac.post(`${M}/groups/${g.id}/products`, { name: 'Test honey', unit: 'bottle', price: 40000, photo: 'data:text/html;base64,PHNjcmlwdD4=' })).status, 400, 'only image photos');
  assert.equal((await fac.post(`${M}/groups/${g.id}/products`, { name: 'Test honey', unit: 'bottle', price: 40000, photo: 'data:image/png;base64,' + 'A'.repeat(300000) })).status, 400, 'photo ≤ 200 KB');
  assert.equal((await fac.post(`${M}/groups/${g.id}/products`, { name: 'Test honey', unit: 'bottle', price: 400.5 })).status, 400, 'price in whole paise');
  const p = await fac.post(`${M}/groups/${g.id}/products`, { name: 'Test honey', name_ml: 'തേൻ', unit: 'bottle', price: 40000, stock: 10, category: 'honey', photo: PHOTO, status: 'listed', group_agreed: 1 });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.status, 'draft', 'status from the body is ignored');
  assert.equal(p.body.group_agreed, false);
  assert.equal((await fac.post(`${M}/products/${p.body.id}/approve`)).status, 403, 'field officer cannot approve');
  assert.equal((await N.as('demo.cds.admin').post(`${M}/products/${p.body.id}/approve`)).status, 409, 'group must agree first');
  assert.equal((await N.as('demo.cif.admin').post(`${M}/products/${p.body.id}/approve`)).status, 403, 'another agency cannot approve');
  assert.equal((await fac.post(`${M}/products/${p.body.id}/agree`)).status, 200);
  const ok = await N.as('demo.cds.admin').post(`${M}/products/${p.body.id}/approve`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'listed');
  const cat = await N.as('demo.donor').get(M + '/catalogue');
  assert.equal(cat.status, 200);
  const item = cat.body.products.find((x) => x.id === p.body.id);
  assert.equal(item.group, g.name);
  const txt = JSON.stringify(cat.body);
  for (const pr of D.persons) assert.ok(!txt.includes(pr.id) && !txt.includes('"' + pr.name + '"'), 'no people in the catalogue');
  assert.ok(!/person_id|created_by|approved_by|agreed_by/.test(txt));
  assert.ok(cat.body.products.every((x) => !x.photo), 'photos fetched one at a time');
  assert.ok((await N.as('demo.learner').get(`${M}/catalogue/${p.body.id}/photo`)).body.photo.startsWith('data:image/'));
  assert.equal((await N.req(null, 'GET', M + '/catalogue')).status, 401, 'signed-in only');
  // drafts never appear
  const drafts = B.store.all("SELECT id FROM livelihoods_products WHERE deleted=0 AND status='draft'");
  assert.ok(drafts.length >= 1 && drafts.every((d) => !cat.body.products.some((x) => x.id === d.id)));
  // changing the price sends it back for approval
  const ch = await fac.put(`${M}/products/${p.body.id}`, { price: 45000 });
  assert.equal(ch.body.status, 'draft');
  assert.ok(!(await N.as('demo.donor').get(M + '/catalogue')).body.products.find((x) => x.id === p.body.id));
});

test('aggregate: k-anonymised per hamlet, complementary suppression, fixed window, no names', async () => {
  const r = await N.as('demo.donor').get(M + '/aggregate?months=1');
  assert.equal(r.status, 200);
  assert.equal(r.body.months, 6, 'external viewers get a fixed window');
  const txt = JSON.stringify(r.body);
  for (const p of D.persons) assert.ok(!txt.includes(p.id) && !txt.includes('"' + p.name + '"'));
  assert.ok(!/person_id/.test(txt));
  assert.ok(r.body.hamlets.length >= 3);
  for (const h of r.body.hamlets) {
    if (typeof h.members === 'string') { assert.equal(h.members, '<5'); assert.equal(h.savings_inr, 'hidden'); assert.equal(h.loans_on_time_pct, null); }
    else assert.ok(h.members >= 5);
    if (typeof h.loans_open === 'number' && h.loans_open > 0 && !h.suppressed) assert.equal(typeof h.loans_on_time_pct, 'number');
  }
  // subtraction check: with a small hamlet, the total cannot reveal it
  const smallHamlet = r.body.hamlets.find((h) => typeof h.loans_open === 'string' || typeof h.members === 'string');
  if (smallHamlet) {
    for (const k of ['members', 'savings_inr', 'loans_open']) {
      if (r.body.hamlets.some((h) => typeof h[k] === 'string')) assert.equal(r.body.totals[k], 'hidden', k);
    }
  }
  // force a small cell: a new group of 3 in h11 under CDS → that hamlet's member cell stays ≥5 but loans may be small;
  // instead check the rule directly by shrinking: create a tiny CDS group in a hamlet with no other CDS group.
  const h9 = D.hamletByKey.h9 || D.hamlets.find((h) => !['h1', 'h2', 'h11'].includes(Object.keys(D.hamletByKey).find((k) => D.hamletByKey[k] === h)));
  B.store.put('agency_presence', { agency_id: CDS_AGENCY_ID, hamlet_id: h9.id, services: ['livelihood'], status: 'active', since: today() });
  const tiny = B.store.put('livelihoods_groups', { hamlet_id: h9.id, agency_id: CDS_AGENCY_ID, name: 'Tiny test NHG', type: 'shg', formed_on: today(), status: 'active' });
  const two = D.adults.filter((p) => p.hamlet_id === h9.id).slice(0, 2);
  for (const p of two) B.store.put('livelihoods_members', { group_id: tiny.id, hamlet_id: h9.id, agency_id: CDS_AGENCY_ID, person_id: p.id, role: 'member', joined_on: today(), status: 'active' });
  B.store.put('livelihoods_txns', { group_id: tiny.id, hamlet_id: h9.id, agency_id: CDS_AGENCY_ID, date: today(), kind: 'savings', amount: 77700, person_id: two[0].id, entered_at: today(), voided: 0 });
  const r2 = await N.as('demo.govt').get(M + '/aggregate');
  const cell = r2.body.hamlets.find((h) => h.hamlet_id === h9.id);
  assert.equal(cell.members, '<5');
  assert.equal(cell.savings_inr, 'hidden');
  assert.equal(r2.body.totals.members, 'hidden', 'total hidden so it cannot be subtracted back');
  assert.equal(r2.body.totals.savings_inr, 'hidden');
  const shownSum = r2.body.trend.reduce((a, m) => a + m.savings_inr, 0);
  const bigSum = r2.body.hamlets.filter((h) => !h.suppressed).reduce((a, h) => a + h.savings_inr, 0);
  assert.equal(shownSum, bigSum, 'trend adds up only the hamlets that are shown');
  // admins of the agency see their own agency, unsuppressed
  const own = await N.as('demo.cds.admin').get(M + '/aggregate');
  assert.equal(own.body.scope, 'your agency');
  assert.equal(own.body.hamlets.find((h) => h.hamlet_id === h9.id).members, 2);
  const other = await N.as('demo.vjt.admin').get(M + '/aggregate');
  assert.equal(other.body.hamlets.length, 0, 'Vanajyothi has no groups');
  assert.equal((await N.as('demo.facilitator').get(M + '/aggregate')).status, 403);
  assert.equal((await N.as('demo.guardian').get(M + '/aggregate')).status, 403);
  B.store.del('livelihoods_groups', tiny.id);
});

// ---------------- Wave 2 review: self-approval, hidden members in the ledger, who may cancel ----------------
const core = (id, act) => `/api/core/forms/submissions/${id}/${act}`;
const ensureCds2 = () => {
  if (!user('demo.cds2')) B.createUser({ username: 'demo.cds2', password: 'demo1234', role: 'field_officer', agency_id: CDS_AGENCY_ID, hamlet_ids: user('demo.cds').hamlet_ids, display_name: 'Second CDS officer (test)', safeguarding_trained: 1 }, null);
};
// A CDS group (not the guardian's) with money to lend, and one of its consenting members.
const lendingGroup = () => {
  for (const g of B.store.all('SELECT * FROM livelihoods_groups WHERE deleted=0 AND agency_id=? ORDER BY name', CDS_AGENCY_ID)) {
    const tx = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=?', g.id);
    if (L.summarize(tx).lendable < 300000) continue;
    const m = members(g.id).find((x) => x.person_id !== D.demoGuardian.id && B.policy.canSee(user('demo.cds'), x.person_id, 'livelihood').ok);
    if (m) return { g, pid: m.person_id };
  }
  return null;
};

test('loans: no self-approval through core or module routes; loan_out needs a request approved by another reviewer; once, within the amount', async () => {
  ensureCds2();
  const { g, pid } = lendingGroup();
  const fac = N.as('demo.cds');
  const give = (who, body) => N.as(who).post(`${M}/groups/${g.id}/txns`, { kind: 'loan_out', months: 4, date: today(), person_id: pid, ...body });
  const s = await fac.post(`${M}/groups/${g.id}/loan-requests`, { person_id: pid, purpose: 'enterprise', amount: 1000, months: 4, group_agreed: 'yes', client_ref: 'lr-self-1' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const id = s.body.id;
  // the reported attack: the capturer closes her own request as "approved" through the core route
  assert.equal((await fac.post(core(id, 'close'), { outcome: 'approved' })).status, 403, 'engine refuses the self-close');
  assert.equal((await fac.post(core(id, 'reply'), { reply: 'ok', outcome: 'approved' })).status, 403, 'engine refuses the self-reply');
  assert.equal((await fac.post(core(id, 'claim'))).status, 403);
  assert.equal((await fac.post(`${M}/requests/${id}/decide`, { decision: 'approved' })).status, 403);
  assert.equal(B.forms.mayDecide(user('demo.cds'), id).ok, false);
  let row = B.store.get('form_submissions', id);
  assert.equal(row.status, 'submitted'); assert.equal(row.outcome || null, null);
  // another agency's reviewer cannot decide it either
  assert.equal((await N.as('demo.cif.admin').post(core(id, 'reply'), { reply: 'ok', outcome: 'approved' })).status, 403);
  // a loan with no request at all, or against an unanswered one, is refused
  const noReq = await give('demo.cds', { amount: 50000 });
  assert.equal(noReq.status, 400, JSON.stringify(noReq.body));
  assert.equal((await give('demo.cds', { amount: 50000, request_id: id })).status, 409);
  // a record that claims approval but was "approved" by its own capturer (e.g. forged and synced) is refused
  B.store.put('form_submissions', { ...row, status: 'replied', outcome: 'approved', reply: 'ok', replied_by: row.captured_by, replied_at: new Date().toISOString() });
  assert.equal((await give('demo.cds', { amount: 50000, request_id: id })).status, 409, 'self-approved record cannot be paid');
  // … or by someone outside the group's agency
  B.store.put('form_submissions', { ...B.store.get('form_submissions', id), replied_by: user('demo.cif.admin').id });
  assert.equal((await give('demo.cds', { amount: 50000, request_id: id })).status, 409, 'approval from another agency cannot be paid');
  B.store.put('form_submissions', { ...row });
  // a second CDS reviewer may decide (core route): approved
  const ok = await N.as('demo.cds2').post(core(id, 'reply'), { reply: 'Approved.', outcome: 'approved' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  // the capturer may now close it (answered) but cannot change the outcome
  const cl = await fac.post(core(id, 'close'), { outcome: 'declined' });
  assert.equal(cl.status, 200, JSON.stringify(cl.body));
  assert.equal(B.store.get('form_submissions', id).outcome, 'approved', 'capturer cannot set the outcome');
  // paid out: within the approved amount, once
  assert.equal((await give('demo.cds', { amount: 100001, request_id: id })).status, 400, 'more than approved');
  const paid = await give('demo.cds', { amount: 100000, request_id: id, client_ref: 'lo-1' });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal((await give('demo.cds2', { amount: 1000, request_id: id })).status, 409, 'one payout per request');
  // a request for another member cannot be used for this one
  const other = members(g.id).find((x) => x.person_id !== pid && B.policy.canSee(user('demo.cds'), x.person_id, 'livelihood').ok);
  if (other) assert.equal((await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, { kind: 'loan_out', months: 4, date: today(), person_id: other.person_id, amount: 1000, request_id: id })).status, 400);
  // the module decider is registered: the engine reports the module's own reason for the capturer path too
  const s2 = await N.as('demo.cds2').post(`${M}/groups/${g.id}/loan-requests`, { person_id: pid, purpose: 'other', amount: 500, months: 2, client_ref: 'lr-self-2' });
  assert.equal(s2.status, 200);
  assert.equal(B.forms.mayDecide(user('demo.cds2'), s2.body.id).ok, false);
  assert.equal(B.forms.mayDecide(user('demo.cds'), s2.body.id).ok, true, 'the other officer may decide');
  assert.equal(B.forms.mayDecide(user('demo.cds.admin'), s2.body.id).ok, true);
});

test('consent withdrawal: hidden members\' entries never appear one by one — only a per-meeting "others" total of 2+ people', async () => {
  const g = groupsIn('h2')[0];
  const fac = N.as('demo.cds');
  const mem = members(g.id).filter((x) => B.policy.canSee(user('demo.cds'), x.person_id, 'livelihood').ok);
  assert.ok(mem.length >= 3);
  const [a, b, c] = mem;
  const day = today();
  const m1 = await fac.post(`${M}/groups/${g.id}/meetings`, { date: day, attendance: 3, client_ref: 'hid-m1', savings: [{ person_id: a.person_id, amount: 1101 }, { person_id: b.person_id, amount: 1202 }, { person_id: c.person_id, amount: 1409 }] });
  assert.equal(m1.status, 200, JSON.stringify(m1.body));
  const m2 = await fac.post(`${M}/groups/${g.id}/meetings`, { date: day, attendance: 2, client_ref: 'hid-m2', savings: [{ person_id: a.person_id, amount: 1307 }, { person_id: c.person_id, amount: 1511 }] });
  assert.equal(m2.status, 200, JSON.stringify(m2.body));
  const theirs = B.store.all('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=? AND person_id IN (?,?)', g.id, a.person_id, b.person_id);
  const revoked = [a, b].map((x) => B.store.find('consents', { person_id: x.person_id, agency_id: CDS_AGENCY_ID, status: 'active' })[0]);
  for (const x of revoked) B.revokeConsent(x.id, null);
  try {
    const book = await fac.get(M + '/groups/' + g.id);
    assert.equal(book.status, 200);
    assert.equal(book.body.hidden_members, 2);
    const L2 = book.body.ledger;
    const ids = new Set(theirs.map((t) => t.id));
    assert.ok(L2.every((t) => !ids.has(t.id)), 'no hidden entry id');
    assert.ok(L2.every((t) => t.person_id !== a.person_id && t.person_id !== b.person_id));
    assert.ok(L2.every((t) => !('member_hidden' in t)));
    for (const amt of [1101, 1202, 1307]) assert.ok(!L2.some((t) => t.amount === amt), 'no individual hidden amount ' + amt);
    const others = L2.filter((t) => t.others);
    const o = others.find((t) => t.amount === 1101 + 1202);
    assert.ok(o, 'meeting 1: one "others" line with the total of the two hidden members');
    assert.equal(o.kind, 'savings'); assert.equal(o.date, day);
    assert.deepEqual(Object.keys(o).filter((k) => ['meeting_id', 'note', 'months', 'request_id', 'entered_by', 'person_name'].includes(k) && o[k]), []);
    assert.ok(!others.some((t) => t.amount === 1307), 'meeting 2 had one hidden member: no separate line');
    assert.ok(L2.some((t) => t.person_id === c.person_id && t.amount === 1409), 'consenting member still shown');
    assert.ok(L2.some((t) => t.person_id === c.person_id && t.amount === 1511));
    // still inside the totals
    assert.equal(book.body.meetings.find((x) => x.id === m2.body.meeting.id).savings_collected, 1307 + 1511);
    // hidden entries cannot be cancelled one by one
    assert.equal((await fac.post(`${M}/txns/${theirs[0].id}/void`, { reason: 'test' })).status, 403);
  } finally {
    for (const x of revoked) B.grantConsent({ person_id: x.person_id, agency_id: CDS_AGENCY_ID, scopes: x.scopes, granted_by: x.granted_by, relation: x.relation }, null);
  }
  const back = await fac.get(M + '/groups/' + g.id);
  assert.ok(back.body.ledger.some((t) => t.person_id === a.person_id && t.amount === 1307), 'visible again after consent is given again');
});

test('cancelling: loans and repayments only by the agency admin or whoever entered them; every cancellation keeps reason, who and when', async () => {
  ensureCds2();
  const { g, pid } = lendingGroup();
  const req = await N.as('demo.cds').post(`${M}/groups/${g.id}/loan-requests`, { person_id: pid, purpose: 'livestock', amount: 600, months: 3, group_agreed: 'yes', client_ref: 'lr-void-1' });
  assert.equal(req.status, 200, JSON.stringify(req.body));
  assert.equal((await N.as('demo.cds.admin').post(`${M}/requests/${req.body.id}/decide`, { decision: 'approved' })).status, 200);
  const loan = await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, { kind: 'loan_out', amount: 60000, months: 3, date: L.addDays(today(), -1), person_id: pid, request_id: req.body.id });
  assert.equal(loan.status, 200, JSON.stringify(loan.body));
  const rep = await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, { kind: 'repayment', amount: 1000, date: today(), person_id: pid });
  assert.equal(rep.status, 200, JSON.stringify(rep.body));
  // another officer of the same agency cannot cancel them
  assert.equal((await N.as('demo.cds2').post(`${M}/txns/${rep.body.id}/void`, { reason: 'wrong member' })).status, 403);
  assert.equal((await N.as('demo.cds2').post(`${M}/txns/${loan.body.id}/void`, { reason: 'wrong member' })).status, 403);
  // whoever entered it can (with a reason)
  assert.equal((await N.as('demo.cds').post(`${M}/txns/${rep.body.id}/void`, {})).status, 400, 'reason needed');
  const v1 = await N.as('demo.cds').post(`${M}/txns/${rep.body.id}/void`, { reason: 'Entered twice' });
  assert.equal(v1.status, 200, JSON.stringify(v1.body));
  assert.equal(v1.body.voided, true); assert.equal(v1.body.void_reason, 'Entered twice');
  assert.ok(v1.body.voided_at && v1.body.voided_by_name);
  // the agency admin can cancel the loan
  const v2 = await N.as('demo.cds.admin').post(`${M}/txns/${loan.body.id}/void`, { reason: 'Member changed her mind' });
  assert.equal(v2.status, 200, JSON.stringify(v2.body));
  const saved = B.store.get('livelihoods_txns', loan.body.id);
  assert.equal(saved.voided_by, user('demo.cds.admin').id);
  assert.ok(saved.voided_at);
  assert.equal(saved.void_reason, 'Member changed her mind');
  // ordinary entries: any officer of the agency may cancel, still with reason, who and when
  const exp = await N.as('demo.cds').post(`${M}/groups/${g.id}/txns`, { kind: 'income', amount: 700, date: today(), note: 'test' });
  assert.equal(exp.status, 200);
  const v3 = await N.as('demo.cds2').post(`${M}/txns/${exp.body.id}/void`, { reason: 'Typo' });
  assert.equal(v3.status, 200, JSON.stringify(v3.body));
  assert.equal(B.store.get('livelihoods_txns', exp.body.id).voided_by, user('demo.cds2').id);
});

test('sealed: other modules cannot read livelihoods tables', () => {
  const express = require('express');
  const ctx = N.host._ctx(N.host.modules.get('learning'), express.Router(), 'learning_');
  assert.throws(() => ctx.sql('SELECT * FROM livelihoods_txns'), /sealed|may not read/);
  assert.throws(() => ctx.sql('SELECT * FROM livelihoods_form_rows'), /may not read/);
});

test('per-hamlet switch: livelihoods off in Pachakkudi → 503 for staff only there; data hidden elsewhere', async () => {
  const h1 = D.hamletByKey.h1.id;
  B.createUser({ username: 'demo.cds.h1b', password: 'demo1234', role: 'field_officer', agency_id: CDS_AGENCY_ID, hamlet_ids: [h1], display_name: 'CDS h1 (b)', safeguarding_trained: 1 }, null);
  assert.equal((await N.as('demo.steward').post(`/api/core/modules/livelihoods/hamlets/${h1}`, { enabled: false, note: 'Oorukoottam decision (test)' })).status, 200);
  try {
    const r = await N.as('demo.cds.h1b').get(M + '/home');
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'module_off_here');
    assert.equal((await N.as('demo.guardian').get(M + '/my')).status, 503, 'member in h1 too');
    const cds = await N.as('demo.cds').get(M + '/groups');
    assert.equal(cds.status, 200, 'officer with other hamlets still works');
    assert.ok(cds.body.every((g) => g.hamlet_id !== h1));
    const g1 = groupsIn('h1')[0];
    assert.equal((await N.as('demo.cds').get(M + '/groups/' + g1.id)).status, 403);
    assert.ok(!(await N.as('demo.donor').get(M + '/catalogue')).body.products.some((p) => p.hamlet && p.hamlet.id === h1));
    const pid = members(g1.id)[0].person_id;
    const s = await N.as('demo.cds').post('/api/core/forms/submissions', { form_key: 'livelihoods.loan_request', person_id: pid, answers: { group_id: g1.id, purpose: 'other', amount: 500, months: 2 } });
    assert.equal(s.status, 403);
  } finally {
    await N.as('demo.steward').post(`/api/core/modules/livelihoods/hamlets/${h1}`, { enabled: true });
  }
  assert.equal((await N.as('demo.cds.h1b').get(M + '/home')).status, 200);
});

test('manifest: sealed, budget and nav reported', async () => {
  const st = N.host.status().find((m) => m.id === 'livelihoods');
  assert.equal(st.state, 'up');
  assert.ok(N.brain.sealedModules.has('livelihoods'));
  assert.ok(st.nav.find((n) => n.view === 'my' && n.roles.includes('guardian')));
  const b = (await N.as('demo.steward').get('/api/core/modules/budgets')).body.find((m) => m.id === 'livelihoods');
  assert.equal(b.budget_storage_mb, 40);
});
