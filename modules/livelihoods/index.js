'use strict';
// Livelihoods & Self-Help Groups — Kudumbashree-style neighbourhood groups (NHG/SHG), joint liability
// groups and small family / youth enterprises keep simple books offline at the hub: meetings, savings,
// internal loans and repayments. Loan requests and enterprise ideas travel to the CDS / agency through
// the Brain's form round-trip engine. Groups list products for sale through a city partner; funders see
// k-anonymised trends only. The module is sealed: no other module can read these tables.
const L = require('./ledger');
const F = require('./forms');

const STAFF = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'field_officer'];
const ALL_AGENCIES = ['platform_admin', 'donor', 'govt_viewer', 'cpo'];
const PRIV = ['platform_admin', 'agency_admin', 'coordinator', 'cpo'];
const TYPES = ['shg', 'jlg', 'enterprise'];
const ROLES = ['president', 'secretary', 'member'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'bottle', 'set'];
const CATEGORIES = ['honey', 'spices', 'millets', 'crafts', 'food', 'other'];
const MAX_PHOTO_CHARS = 280_000; // ~200 KB image as a data URL (same limit as the form engine)
const MAX_MEMBERS = 30;
const DECISIONS = { approved: ['Approved', 'അനുവദിച്ചു'], declined: ['Not approved', 'അനുവദിച്ചില്ല'], more_info: ['More information needed', 'കൂടുതൽ വിവരം വേണം'] };
const PARTNER_NOTE = 'Orders go through the city partner shop. Prices are set by the group. (Partner arrangement: to be confirmed.)';
const PARTNER_NOTE_ML = 'ഓർഡറുകൾ നഗരത്തിലെ പങ്കാളി കട വഴി. വില ഗ്രൂപ്പ് നിശ്ചയിക്കുന്നു. (പങ്കാളി ക്രമീകരണം: ഉറപ്പാക്കാനുണ്ട്.)';
const CDS_AGENCY_ID = 'agy_demo_kudumbashree_cds';

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError } = ctx;
  const P = brain.policy;
  const S = (v, max = 500) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const err403 = (m, code) => Object.assign(httpError(403, m), code ? { code } : {});

  // ---------------- forms + rules (start-up, so every hub has them) ----------------
  brain.forms.define(F.LOAN_FORM, null);
  brain.forms.define(F.IDEA_FORM, null);
  const snapshot = (groupId, personId) => {
    const group = groupId ? data.get('livelihoods_groups', String(groupId)) : null;
    if (!group) return { group: null };
    const member = personId ? sqlOne("SELECT * FROM livelihoods_members WHERE deleted=0 AND group_id=? AND person_id=? AND status='active'", group.id, personId) : null;
    return { group, member, txns: txnsOf(group.id) };
  };
  brain.forms.rule(F.LOAN_FORM.key, F.loanRule(snapshot));
  brain.forms.rule(F.IDEA_FORM.key, (a) => F.ideaRule(a));

  // ---------------- reads ----------------
  const txnsOf = (gid) => sql('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=? ORDER BY date, entered_at', gid);
  const meetingsOf = (gid) => sql('SELECT * FROM livelihoods_meetings WHERE deleted=0 AND group_id=? ORDER BY date DESC', gid);
  const membersOf = (gid) => sql('SELECT * FROM livelihoods_members WHERE deleted=0 AND group_id=? ORDER BY joined_on', gid);
  const hamletOf = (id) => { const h = id && brain.hamlets.get(id); return h ? { id: h.id, name: h.name, name_ml: h.name_ml } : null; };
  const agencyName = (id) => { const a = id && brain.agencies.get(id); return a ? a.name : null; };
  const limited = (u) => Array.isArray(u.hamlet_ids) && u.hamlet_ids.length > 0;

  // ---------------- access ----------------
  // Staff act on a group only for their own agency, inside their hamlets, where the hamlet has not switched the service off.
  function groupFor(user, id) {
    const g = data.get('livelihoods_groups', String(id || ''));
    if (!g) throw httpError(404, 'Group not found');
    if (user.role !== 'platform_admin') {
      if (!STAFF.includes(user.role)) throw err403('Your role cannot open group books.');
      if (!user.agency_id || g.agency_id !== user.agency_id) throw err403('This group belongs to another agency.');
      if (limited(user) && !user.hamlet_ids.includes(g.hamlet_id)) throw err403('This hamlet is outside your area.');
      if (!brain.modules.enabledIn(g.hamlet_id)) throw err403('This service is switched off in this hamlet.', 'module_off_here');
    }
    return g;
  }
  const sees = (user, pid) => !!pid && P.canSee(user, pid, 'livelihood').ok;
  const groupsVisible = (user, { hamlet_id = null } = {}) => {
    let rows = sql('SELECT * FROM livelihoods_groups WHERE deleted=0' + (user.role === 'platform_admin' ? '' : ' AND agency_id=?') + (hamlet_id ? ' AND hamlet_id=?' : '') + ' ORDER BY hamlet_id, name',
      ...(user.role === 'platform_admin' ? [] : [user.agency_id || '-']), ...(hamlet_id ? [hamlet_id] : []));
    if (user.role !== 'platform_admin') rows = rows.filter((g) => (!limited(user) || user.hamlet_ids.includes(g.hamlet_id)) && brain.modules.enabledIn(g.hamlet_id));
    return rows;
  };
  const activeMember = (gid, pid) => sqlOne("SELECT * FROM livelihoods_members WHERE deleted=0 AND group_id=? AND person_id=? AND status='active'", gid, pid);

  // A person may join only with their livelihood consent to the group's agency (and enrolment — canSee checks both).
  function checkJoin(user, g, pid) {
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'Person not found');
    if (p.hamlet_id !== g.hamlet_id) throw httpError(400, 'Members must live in the group\'s hamlet.');
    if (P.isMinor(p)) throw httpError(400, 'Members must be adults (18+).');
    if (!P.canSee(user, pid, 'livelihood').ok && user.role !== 'platform_admin') throw err403('Record this person\'s "livelihood" consent to your agency first.');
    if (!brain.consent.has(pid, g.agency_id, 'livelihood')) throw err403('This person has not given "livelihood" consent to the group\'s agency.');
    return p;
  }

  // ---------------- shaping ----------------
  const personName = (user, pid) => (sees(user, pid) ? (brain.persons.basic(pid) || {}).name || null : null);
  function memberRows(user, g, txns) {
    const book = L.loanBook(txns);
    const rows = []; let hidden = 0;
    for (const m of membersOf(g.id)) {
      if (!sees(user, m.person_id)) { if (m.status === 'active') hidden++; continue; }
      const b = brain.persons.basic(m.person_id) || {};
      const me = L.memberSummary(txns, m.person_id);
      rows.push({ id: m.id, person_id: m.person_id, name: b.name, age: b.age, role: m.role, status: m.status, joined_on: m.joined_on,
        savings: me.savings, outstanding: me.outstanding, overdue: me.overdue, loan_status: me.status, next_due: me.next_due,
        loans: book.filter((l) => l.person_id === m.person_id && l.status !== 'closed').length });
    }
    return { members: rows, hidden };
  }
  const txnOut = (user, t) => ({ id: t.id, date: t.date, kind: t.kind, amount: t.amount, months: t.months || null, person_id: sees(user, t.person_id) ? t.person_id : null, person_name: t.person_id ? (personName(user, t.person_id) || null) : null, member_hidden: !!(t.person_id && !sees(user, t.person_id)), note: t.note || null, meeting_id: t.meeting_id || null, request_id: t.request_id || null, voided: Number(t.voided) === 1, void_reason: t.void_reason || null, entered_at: t.entered_at });
  function groupCard(user, g) {
    const txns = txnsOf(g.id);
    const meetings = meetingsOf(g.id);
    const members = membersOf(g.id);
    const sum = L.summarize(txns);
    const hl = L.health(txns, meetings, members);
    return { id: g.id, name: g.name, name_ml: g.name_ml, type: g.type, hamlet: hamletOf(g.hamlet_id), hamlet_id: g.hamlet_id, agency_id: g.agency_id, agency: agencyName(g.agency_id), meeting_day: g.meeting_day, formed_on: g.formed_on, thrift: g.thrift, status: g.status,
      members: members.filter((m) => m.status === 'active').length, last_meeting: meetings[0] ? meetings[0].date : null,
      fund: sum.fund, cash: sum.cash, bank: sum.bank, outstanding: sum.outstanding, lendable: sum.lendable, health: hl };
  }
  const reqOut = (user, s) => {
    const a = s.answers || {};
    const g = a.group_id ? data.get('livelihoods_groups', String(a.group_id)) : null;
    const okGroup = !!g && g.agency_id === s.agency_id;
    return { id: s.id, form_key: s.form_key, status: s.status, priority: s.priority, flags: s.flags || [], answers: a, captured_at: s.captured_at, captured_by_name: s.captured_by_name,
      person: s.person ? { id: s.person.id, name: s.person.name } : null, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml, hamlet_id: s.hamlet_id,
      group: okGroup ? { id: g.id, name: g.name, name_ml: g.name_ml } : null, group_mismatch: !!a.group_id && !okGroup,
      reply: s.reply, reply_ml: s.reply_ml, outcome: s.outcome, replied_by_name: s.replied_by_name, replied_at: s.replied_at, reply_seen_at: s.reply_seen_at };
  };

  // ---------------- meta ----------------
  router.get('/meta', authed, (req, res) => res.json({
    kinds: L.KINDS, types: TYPES, roles: ROLES, days: DAYS, units: UNITS, categories: CATEGORIES, purposes: F.PURPOSES, idea_kinds: F.IDEA_KINDS, needs: F.NEEDS,
    decisions: DECISIONS, grace_days: L.GRACE_DAYS, max_months: L.MAX_MONTHS, partner_note: PARTNER_NOTE, partner_note_ml: PARTNER_NOTE_ML,
    can_staff: STAFF.includes(req.user.role), can_review: brain.forms.canReview(req.user, F.LOAN_FORM.key), can_approve_products: P.can(req.user, 'agency.manage'),
  }));

  // ---------------- facilitator home ----------------
  router.get('/home', requires('services.assist'), (req, res) => {
    const u = req.user;
    const groups = groupsVisible(u).map((g) => groupCard(u, g));
    const by = new Map();
    for (const g of groups) { if (!by.has(g.hamlet_id)) by.set(g.hamlet_id, { hamlet: g.hamlet, groups: [] }); by.get(g.hamlet_id).groups.push(g); }
    // hamlets where the user's agency is present and may start a group
    const present = sql("SELECT hamlet_id FROM agency_presence WHERE deleted=0 AND status='active' AND agency_id=?", u.agency_id || '-').map((r) => r.hamlet_id)
      .filter((h) => (!limited(u) || u.hamlet_ids.includes(h)) && brain.modules.enabledIn(h));
    for (const h of present) if (!by.has(h)) by.set(h, { hamlet: hamletOf(h), groups: [] });
    const open = brain.forms.list(u, { form_key: F.LOAN_FORM.key, limit: 500 });
    res.json({ hamlets: [...by.values()].sort((a, b) => String(a.hamlet && a.hamlet.name).localeCompare(String(b.hamlet && b.hamlet.name))),
      requests_waiting: open.filter((s) => ['submitted', 'in_review'].includes(s.status)).length,
      replies_new: open.filter((s) => s.status === 'replied' && !s.reply_seen_at && s.captured_by === u.id).length,
      can_review: brain.forms.canReview(u, F.LOAN_FORM.key) });
  });

  router.get('/groups', requires('services.assist'), (req, res) => res.json(groupsVisible(req.user, { hamlet_id: req.query.hamlet_id ? S(req.query.hamlet_id, 60) : null }).map((g) => groupCard(req.user, g))));

  router.post('/groups', requires('services.assist'), (req, res) => {
    const u = req.user, b = req.body || {};
    const hamlet_id = S(b.hamlet_id, 60);
    if (!brain.hamlets.get(hamlet_id)) throw httpError(400, 'Choose the hamlet.');
    // agency comes from the account; only the platform steward may name one
    const agency_id = u.role === 'platform_admin' ? S(b.agency_id, 60) || u.agency_id : u.agency_id;
    if (!agency_id || !brain.agencies.get(agency_id)) throw httpError(400, 'No agency for this group.');
    if (u.role !== 'platform_admin') {
      if (limited(u) && !u.hamlet_ids.includes(hamlet_id)) throw err403('This hamlet is outside your area.');
      if (!sqlOne("SELECT 1 x FROM agency_presence WHERE deleted=0 AND status='active' AND agency_id=? AND hamlet_id=?", agency_id, hamlet_id)) throw err403('Your agency does not work in this hamlet.');
      if (!brain.modules.enabledIn(hamlet_id)) throw err403('This service is switched off in this hamlet.', 'module_off_here');
    }
    const name = S(b.name, 120);
    if (name.length < 3) throw httpError(400, 'Give the group a name.');
    const type = TYPES.includes(b.type) ? b.type : 'shg';
    const formed_on = S(b.formed_on, 10) || L.today();
    if (!L.isDate(formed_on) || formed_on > L.today()) throw httpError(400, 'Formed on must be a real date, not in the future.');
    const thrift = b.thrift === undefined || b.thrift === '' ? null : Number(b.thrift);
    if (thrift !== null && !(Number.isInteger(thrift) && thrift > 0 && thrift <= L.KINDS.savings.max)) throw httpError(400, 'Usual savings must be a whole number of paise.');
    const g = data.put('livelihoods_groups', { hamlet_id, agency_id, name, name_ml: S(b.name_ml, 160) || null, type, formed_on, meeting_day: DAYS.includes(b.meeting_day) ? b.meeting_day : null, thrift, status: 'active', notes: S(b.notes, 1000) || null, created_by: u.id }, u);
    emit('livelihoods.group_created', { id: g.id, type }, u, hamlet_id);
    res.json(groupCard(u, g));
  });

  router.put('/groups/:id', requires('services.assist'), (req, res) => {
    const g = groupFor(req.user, req.params.id), b = req.body || {};
    const patch = {};
    if (b.name !== undefined) { const n = S(b.name, 120); if (n.length < 3) throw httpError(400, 'Give the group a name.'); patch.name = n; }
    if (b.name_ml !== undefined) patch.name_ml = S(b.name_ml, 160) || null;
    if (b.meeting_day !== undefined) patch.meeting_day = DAYS.includes(b.meeting_day) ? b.meeting_day : null;
    if (b.notes !== undefined) patch.notes = S(b.notes, 1000) || null;
    if (b.status !== undefined) { if (!['active', 'dormant', 'closed'].includes(b.status)) throw httpError(400, 'Status must be active, dormant or closed.'); patch.status = b.status; }
    res.json(groupCard(req.user, data.put('livelihoods_groups', { ...g, ...patch }, req.user)));
  });

  // ---------------- group book ----------------
  router.get('/groups/:id', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id);
    const txns = txnsOf(g.id);
    const all = sql('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=? ORDER BY date DESC, entered_at DESC LIMIT 120', g.id);
    const { members, hidden } = memberRows(u, g, txns);
    const requests = brain.forms.list(u, { form_key: F.LOAN_FORM.key, hamlet_id: g.hamlet_id, limit: 300 }).filter((s) => s.answers && s.answers.group_id === g.id).map((s) => reqOut(u, s));
    res.json({ group: groupCard(u, g), summary: L.summarize(txns), members, hidden_members: hidden,
      ledger: all.map((t) => txnOut(u, t)), meetings: meetingsOf(g.id).slice(0, 30).map((m) => ({ id: m.id, date: m.date, attendance: m.attendance, savings_collected: m.savings_collected, notes: m.notes })),
      requests, by_month: monthly(txns) });
  });
  function monthly(txns, n = 6) {
    const months = L.lastMonths(L.today(), n);
    const out = months.map((m) => ({ month: m, savings: 0, loans: 0, repaid: 0, income: 0 }));
    const idx = Object.fromEntries(months.map((m, i) => [m, i]));
    for (const t of L.order(txns)) {
      const i = idx[t.date.slice(0, 7)];
      if (i === undefined) continue;
      if (t.kind === 'savings') out[i].savings += t.amount;
      if (t.kind === 'loan_out') out[i].loans += t.amount;
      if (t.kind === 'repayment') out[i].repaid += t.amount;
      if (t.kind === 'income' || t.kind === 'interest') out[i].income += t.amount;
    }
    return out;
  }

  // Member loan card (staff): schedule and repayments for one member.
  router.get('/groups/:id/members/:pid', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id);
    const v = P.canSee(u, req.params.pid, 'livelihood');
    if (!v.ok) throw err403('Not permitted: ' + v.reason);
    if (v.audited) brain.audit(u, 'steward.livelihood_read', req.params.pid, { group: g.id });
    const m = sqlOne('SELECT * FROM livelihoods_members WHERE deleted=0 AND group_id=? AND person_id=?', g.id, req.params.pid);
    if (!m) throw httpError(404, 'Not a member of this group');
    const b = brain.persons.basic(m.person_id) || {};
    const txns = txnsOf(g.id);
    res.json({ member: { id: m.id, person_id: m.person_id, name: b.name, role: m.role, status: m.status, joined_on: m.joined_on }, ...L.memberSummary(txns, m.person_id),
      entries: L.order(txns).filter((t) => t.person_id === m.person_id).reverse().slice(0, 100).map((t) => txnOut(u, t)) });
  });

  router.get('/groups/:id/candidates', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id);
    const have = new Set(membersOf(g.id).filter((m) => m.status === 'active').map((m) => m.person_id));
    res.json(brain.persons.visible(u, { hamlet_id: g.hamlet_id, limit: 500 })
      .filter((p) => !p.minor && !have.has(p.id) && sees(u, p.id) && brain.consent.has(p.id, g.agency_id, 'livelihood'))
      .map((p) => ({ id: p.id, name: p.name, age: p.age, gender: p.gender, kind: p.kind })));
  });

  router.post('/groups/:id/members', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id), b = req.body || {};
    const pid = S(b.person_id, 60);
    checkJoin(u, g, pid);
    if (activeMember(g.id, pid)) throw httpError(409, 'Already a member of this group.');
    if (membersOf(g.id).filter((m) => m.status === 'active').length >= MAX_MEMBERS) throw httpError(400, `A group can have at most ${MAX_MEMBERS} members.`);
    const role = ROLES.includes(b.role) ? b.role : 'member';
    const joined_on = S(b.joined_on, 10) || L.today();
    if (!L.isDate(joined_on) || joined_on > L.today()) throw httpError(400, 'Joined on must be a real date, not in the future.');
    const row = tx(() => {
      if (role !== 'member') for (const m of membersOf(g.id)) if (m.role === role && m.status === 'active') data.put('livelihoods_members', { ...m, role: 'member' }, u);
      const old = sqlOne('SELECT * FROM livelihoods_members WHERE deleted=0 AND group_id=? AND person_id=?', g.id, pid);
      return data.put('livelihoods_members', { ...(old ? { id: old.id } : {}), group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, person_id: pid, role, joined_on, status: 'active', left_on: null, added_by: u.id }, u);
    });
    res.json({ id: row.id, person_id: pid, role: row.role, status: row.status, joined_on: row.joined_on });
  });

  router.post('/members/:mid', requires('services.assist'), (req, res) => {
    const u = req.user, b = req.body || {};
    const m = data.get('livelihoods_members', S(req.params.mid, 60));
    if (!m) throw httpError(404, 'Member not found');
    const g = groupFor(u, m.group_id);
    if (!sees(u, m.person_id) && u.role !== 'platform_admin') throw err403('Not permitted: no livelihood consent.');
    const patch = {};
    if (b.role !== undefined) { if (!ROLES.includes(b.role)) throw httpError(400, 'Role must be president, secretary or member.'); patch.role = b.role; }
    if (b.status === 'left') {
      const me = L.memberSummary(txnsOf(g.id), m.person_id);
      if (me.outstanding > 0) throw httpError(409, 'This member still has a loan to repay. Settle it before she leaves the group.');
      patch.status = 'left'; patch.left_on = L.today(); patch.role = 'member';
    } else if (b.status === 'active') { checkJoin(u, g, m.person_id); patch.status = 'active'; patch.left_on = null; }
    const row = tx(() => {
      if (patch.role && patch.role !== 'member') for (const o of membersOf(g.id)) if (o.id !== m.id && o.role === patch.role && o.status === 'active') data.put('livelihoods_members', { ...o, role: 'member' }, u);
      return data.put('livelihoods_members', { ...m, ...patch }, u);
    });
    res.json({ id: row.id, role: row.role, status: row.status, left_on: row.left_on });
  });

  // ---------------- ledger writes ----------------
  // Build a transaction from an explicit field list; group, hamlet and agency come from the group record.
  function buildTxn(u, g, e, extra = {}) {
    const kind = S(e.kind, 30);
    const amount = typeof e.amount === 'number' ? e.amount : (/^\d+$/.test(String(e.amount || '')) ? Number(e.amount) : NaN);
    const t = { group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, date: S(e.date, 10), kind, amount, person_id: e.person_id ? S(e.person_id, 60) : null,
      months: kind === 'loan_out' ? Number(e.months) : null, request_id: kind === 'loan_out' && e.request_id ? S(e.request_id, 60) : null, note: S(e.note, 300) || null,
      entered_by: u.id, entered_at: new Date().toISOString(), voided: 0, ...extra };
    const errors = L.checkEntry(t, { minDate: g.formed_on || '2000-01-01' });
    if (errors.length) throw httpError(400, errors.join(' '));
    if (L.KINDS[kind].person) {
      if (!activeMember(g.id, t.person_id)) throw httpError(400, 'That person is not an active member of this group.');
      if (!sees(u, t.person_id) && u.role !== 'platform_admin') throw err403('Not permitted: this member has not given livelihood consent to your agency.');
    } else t.person_id = null;
    return t;
  }
  function checkLoanRequest(u, g, t) {
    if (!t.request_id) return null;
    let s;
    try { s = brain.forms.one(u, t.request_id); } catch (e) { throw httpError(400, 'Loan request not found.'); }
    if (s.form_key !== F.LOAN_FORM.key || !s.answers || s.answers.group_id !== g.id || s.person_id !== t.person_id) throw httpError(400, 'That loan request is for another member or group.');
    if (s.outcome !== 'approved') throw httpError(409, 'That loan request has not been approved.');
    if (t.amount > Number(s.answers.amount) * 100) throw httpError(400, 'More than the approved amount.');
    if (sqlOne('SELECT 1 x FROM livelihoods_txns WHERE deleted=0 AND voided=0 AND request_id=?', t.request_id)) throw httpError(409, 'This loan has already been given.');
    return s;
  }
  // Every write replays the whole book: cash, bank and each member's loan never go below zero.
  function commit(u, g, newTxns) {
    const r = L.replay([...txnsOf(g.id), ...newTxns]);
    if (!r.ok) throw Object.assign(httpError(409, r.error), { code: r.code });
  }
  const dupTxn = (g, u, ref) => ref && sqlOne('SELECT * FROM livelihoods_txns WHERE deleted=0 AND group_id=? AND entered_by=? AND client_ref=?', g.id, u.id, ref);

  router.post('/groups/:id/txns', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id), b = req.body || {};
    const client_ref = S(b.client_ref, 80) || null;
    const dup = dupTxn(g, u, client_ref);
    if (dup) return res.json({ ...txnOut(u, dup), duplicate: true });
    const t = buildTxn(u, g, b, { client_ref });
    const s = checkLoanRequest(u, g, t);
    const row = tx(() => { commit(u, g, [t]); return data.put('livelihoods_txns', t, u); });
    if (s && s.status !== 'closed') { try { brain.forms.close(u, s.id, { outcome: 'approved' }); } catch (_) { /* reviewer closes later */ } }
    if (t.kind === 'loan_out') emit('livelihoods.loan_given', { group_id: g.id }, u, g.hamlet_id);
    res.json({ ...txnOut(u, row), summary: L.summarize(txnsOf(g.id)) });
  });

  // Mistakes are voided (with a reason), never deleted: the book stays auditable.
  router.post('/txns/:id/void', requires('services.assist'), (req, res) => {
    const u = req.user;
    const t = data.get('livelihoods_txns', S(req.params.id, 60));
    if (!t) throw httpError(404, 'Entry not found');
    const g = groupFor(u, t.group_id);
    if (Number(t.voided)) return res.json(txnOut(u, t));
    const reason = S((req.body || {}).reason, 300);
    if (reason.length < 3) throw httpError(400, 'Say why this entry is being cancelled.');
    const rest = txnsOf(g.id).filter((x) => x.id !== t.id);
    const r = L.replay(rest);
    if (!r.ok) throw Object.assign(httpError(409, 'Cannot cancel this entry: ' + r.error), { code: r.code });
    res.json(txnOut(u, data.put('livelihoods_txns', { ...t, voided: 1, void_reason: reason, voided_by: u.id }, u)));
  });

  // A meeting, recorded at the hub (often offline): attendance + everyone's savings and repayments in one go.
  router.post('/groups/:id/meetings', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id), b = req.body || {};
    const client_ref = S(b.client_ref, 80) || null;
    if (client_ref) {
      const dup = sqlOne('SELECT * FROM livelihoods_meetings WHERE deleted=0 AND group_id=? AND entered_by=? AND client_ref=?', g.id, u.id, client_ref);
      if (dup) return res.json({ meeting: dup, duplicate: true, summary: L.summarize(txnsOf(g.id)) });
    }
    const date = S(b.date, 10);
    if (!L.isDate(date) || date > L.addDays(L.today(), 1)) throw httpError(400, 'Meeting date must be a real date, not in the future.');
    if (g.formed_on && date < g.formed_on) throw httpError(400, 'Meeting date is before the group was formed.');
    const active = membersOf(g.id).filter((m) => m.status === 'active').length;
    const attendance = Number(b.attendance);
    if (!(Number.isInteger(attendance) && attendance >= 0 && attendance <= active)) throw httpError(400, `Attendance must be 0–${active}.`);
    const lines = [];
    for (const [kind, list] of [['savings', b.savings], ['repayment', b.repayments], ['interest', b.interest]]) {
      if (list === undefined) continue;
      if (!Array.isArray(list) || list.length > MAX_MEMBERS) throw httpError(400, `${kind} must be a list.`);
      for (const e of list) lines.push({ kind, amount: e && e.amount, person_id: e && e.person_id, date, note: null });
    }
    const seen = new Set();
    for (const l of lines) { const k = l.kind + '|' + l.person_id; if (seen.has(k)) throw httpError(400, 'A member appears twice in the same list.'); seen.add(k); }
    const built = lines.filter((l) => Number(l.amount) !== 0).map((l) => buildTxn(u, g, l));
    const out = tx(() => {
      commit(u, g, built);
      const m = data.put('livelihoods_meetings', { group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, date, attendance, savings_collected: built.filter((t) => t.kind === 'savings').reduce((a, t) => a + t.amount, 0), notes: S(b.notes, 1000) || null, entered_by: u.id, client_ref }, u);
      for (const t of built) data.put('livelihoods_txns', { ...t, meeting_id: m.id }, u);
      return m;
    });
    emit('livelihoods.meeting_recorded', { id: out.id, group_id: g.id }, u, g.hamlet_id);
    res.json({ meeting: out, entries: built.length, summary: L.summarize(txnsOf(g.id)) });
  });

  // ---------------- loan requests and ideas (form engine) ----------------
  router.post('/groups/:id/loan-requests', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id), b = req.body || {};
    const pid = S(b.person_id, 60);
    if (!activeMember(g.id, pid)) throw httpError(400, 'Only an active member of this group can ask for a loan.');
    const answers = { group_id: g.id, purpose: b.purpose, purpose_note: b.purpose_note, amount: b.amount, months: b.months, group_agreed: b.group_agreed };
    const s = brain.forms.submit(u, { form_key: F.LOAN_FORM.key, person_id: pid, answers, client_ref: S(b.client_ref, 80) || null });
    res.json(s);
  });
  router.post('/ideas', requires('services.assist'), (req, res) => {
    const u = req.user, b = req.body || {};
    const answers = { kind: b.kind, idea: b.idea, for_household: b.for_household, needs: b.needs, money_needed: b.money_needed, skills: b.skills };
    if (b.group_id) { const g = groupFor(u, b.group_id); answers.group_id = g.id; }
    res.json(brain.forms.submit(u, { form_key: F.IDEA_FORM.key, person_id: S(b.person_id, 60), answers, client_ref: S(b.client_ref, 80) || null }));
  });

  // Reviewer queue (CDS / agency): open requests with a snapshot of the group's book.
  router.get('/requests', requires('forms.review', 'services.assist'), (req, res) => {
    const u = req.user;
    const open = req.query.all === '1' ? brain.forms.list(u, { limit: 300 }) : brain.forms.queue(u, {});
    res.json(open.filter((s) => [F.LOAN_FORM.key, F.IDEA_FORM.key].includes(s.form_key)).map((s) => {
      const o = reqOut(u, s);
      if (o.group && s.form_key === F.LOAN_FORM.key) {
        const txns = txnsOf(o.group.id);
        o.book = { lendable: L.summarize(txns).lendable, member: s.person_id ? (({ savings, outstanding, overdue, status }) => ({ savings, outstanding, overdue, status }))(L.memberSummary(txns, s.person_id)) : null };
      }
      return o;
    }));
  });
  router.get('/requests/:id', requires('forms.review', 'services.assist', 'learn', 'family'), (req, res) => {
    const s = brain.forms.one(req.user, S(req.params.id, 60));
    res.json({ ...reqOut(req.user, s), can_reply: s.can_reply });
  });
  router.post('/requests/:id/decide', requires('forms.review'), (req, res) => {
    const u = req.user, b = req.body || {};
    const s = brain.forms.one(u, S(req.params.id, 60));
    if (s.form_key === F.LOAN_FORM.key) {
      const o = reqOut(u, s);
      if (o.group_mismatch) throw httpError(409, 'This request names a group outside the capturing agency — it cannot be approved. Ask the facilitator to submit it again.');
      // four eyes: whoever wrote the request does not approve it
      if (s.captured_by === u.id && u.role !== 'platform_admin') throw err403('Someone else must review a request you entered.');
    }
    const decision = s.form_key === F.LOAN_FORM.key ? (DECISIONS[b.decision] ? b.decision : null) : 'advice';
    if (!decision) throw httpError(400, 'Choose approved, declined or more_info.');
    const text = S(b.reply, 4000) || (DECISIONS[decision] ? DECISIONS[decision][0] + '.' : '');
    const ml = S(b.reply_ml, 4000) || (DECISIONS[decision] ? DECISIONS[decision][1] + '.' : null);
    const row = brain.forms.reply(u, s.id, { reply: text, reply_ml: ml, outcome: decision, close: decision === 'declined' || s.form_key === F.IDEA_FORM.key });
    res.json(reqOut(u, brain.forms.one(u, row.id)));
  });
  router.post('/requests/:id/seen', authed, (req, res) => res.json({ ok: !!brain.forms.markSeen(req.user, S(req.params.id, 60)) }));

  // ---------------- the member's own view ----------------
  router.get('/my', requires('learn', 'family'), (req, res) => {
    const u = req.user;
    if (!u.person_id) throw err403('This page is for group members.');
    const mine = sql('SELECT * FROM livelihoods_members WHERE deleted=0 AND person_id=? ORDER BY joined_on', u.person_id);
    const groups = mine.map((m) => {
      const g = data.get('livelihoods_groups', m.group_id);
      if (!g || !brain.modules.enabledIn(g.hamlet_id)) return null;
      const txns = txnsOf(g.id);
      const sum = L.summarize(txns);
      const me = L.memberSummary(txns, u.person_id);
      const meetings = meetingsOf(g.id);
      return { group: { id: g.id, name: g.name, name_ml: g.name_ml, type: g.type, meeting_day: g.meeting_day, hamlet: hamletOf(g.hamlet_id) }, role: m.role, status: m.status, joined_on: m.joined_on,
        me: { ...me, loans: me.loans.map((l) => ({ id: l.id, date: l.date, amount: l.amount, months: l.months, repaid: l.repaid, outstanding: l.outstanding, overdue: l.overdue, status: l.status, next_due: l.next_due, interest: l.interest, schedule: l.schedule.map((x) => ({ n: x.n, due: x.due, amount: x.amount, state: x.state })) })) },
        // the group's own book is open to its members — totals only, never other members' names or amounts
        group_book: { fund: sum.fund, cash: sum.cash, bank: sum.bank, outstanding: sum.outstanding, members: membersOf(g.id).filter((x) => x.status === 'active').length, last_meeting: meetings[0] ? meetings[0].date : null } };
    }).filter(Boolean);
    const requests = brain.forms.list(u, { person_id: u.person_id, limit: 50 }).filter((s) => [F.LOAN_FORM.key, F.IDEA_FORM.key].includes(s.form_key)).map((s) => {
      const o = reqOut(u, s);
      return { id: o.id, form_key: o.form_key, status: o.status, answers: { purpose: o.answers.purpose, amount: o.answers.amount, months: o.answers.months, kind: o.answers.kind, idea: o.answers.idea }, group: o.group, captured_at: o.captured_at, reply: o.reply, reply_ml: o.reply_ml, outcome: o.outcome, replied_at: o.replied_at, reply_seen_at: o.reply_seen_at };
    });
    res.json({ groups, requests, grace_days: L.GRACE_DAYS });
  });

  // ---------------- products ----------------
  const productOut = (p, { full = false, withGroup = true } = {}) => {
    const g = withGroup ? data.get('livelihoods_groups', p.group_id) : null;
    return { id: p.id, group_id: p.group_id, group: g ? { name: g.name, name_ml: g.name_ml } : undefined, hamlet: hamletOf(p.hamlet_id), name: p.name, name_ml: p.name_ml, category: p.category, unit: p.unit, price: p.price, stock: p.stock, description: p.description,
      has_photo: !!p.photo, photo: full ? p.photo || null : undefined, status: p.status, group_agreed: Number(p.group_agreed) === 1, agreed_on: p.agreed_on, approved_at: p.approved_at, is_demo: Number(p.is_demo) === 1 };
  };
  function productFields(b, cur = {}) {
    const row = {};
    const name = b.name !== undefined ? S(b.name, 120) : cur.name;
    if (!name || name.length < 2) throw httpError(400, 'Give the product a name.');
    row.name = name;
    if (b.name_ml !== undefined) row.name_ml = S(b.name_ml, 160) || null;
    if (b.description !== undefined) row.description = S(b.description, 600) || null;
    if (b.category !== undefined || !cur.category) row.category = CATEGORIES.includes(b.category) ? b.category : 'other';
    if (b.unit !== undefined || !cur.unit) { if (!UNITS.includes(b.unit)) throw httpError(400, 'Choose a unit.'); row.unit = b.unit; }
    if (b.price !== undefined || cur.price === undefined) { const p = Number(b.price); if (!(Number.isInteger(p) && p > 0 && p <= 10_000_000)) throw httpError(400, 'Price must be a whole number of paise (₹0.01–₹1,00,000).'); row.price = p; }
    if (b.stock !== undefined || cur.stock === undefined) { const s = Number(b.stock || 0); if (!(Number.isInteger(s) && s >= 0 && s <= 100000)) throw httpError(400, 'Stock must be a whole number.'); row.stock = s; }
    if (b.photo !== undefined) {
      if (b.photo === null || b.photo === '') row.photo = null;
      else if (typeof b.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo) || b.photo.length > MAX_PHOTO_CHARS) throw httpError(400, 'Photo must be a JPEG/PNG under 200 KB.');
      else row.photo = b.photo;
    }
    return row;
  }
  const productFor = (u, id) => { const p = data.get('livelihoods_products', S(id, 60)); if (!p) throw httpError(404, 'Product not found'); groupFor(u, p.group_id); return p; };

  router.get('/products', requires('services.assist'), (req, res) => {
    const u = req.user;
    const gids = new Set(groupsVisible(u).map((g) => g.id));
    const gid = req.query.group_id ? S(req.query.group_id, 60) : null;
    if (gid) groupFor(u, gid);
    res.json(sql('SELECT * FROM livelihoods_products WHERE deleted=0 ORDER BY status, name').filter((p) => gids.has(p.group_id) && (!gid || p.group_id === gid)).map((p) => productOut(p)));
  });
  router.get('/products/:id', requires('services.assist'), (req, res) => res.json(productOut(productFor(req.user, req.params.id), { full: true })));
  router.post('/groups/:id/products', requires('services.assist'), (req, res) => {
    const u = req.user, g = groupFor(u, req.params.id);
    const row = data.put('livelihoods_products', { ...productFields(req.body || {}), group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, status: 'draft', group_agreed: 0, created_by: u.id, is_demo: 0 }, u);
    res.json(productOut(row, { full: true }));
  });
  // Any change to a listed product sends it back for approval.
  router.put('/products/:id', requires('services.assist'), (req, res) => {
    const u = req.user, p = productFor(u, req.params.id);
    const f = productFields(req.body || {}, p);
    const priceOrText = ['name', 'name_ml', 'description', 'price', 'unit', 'photo'].some((k) => f[k] !== undefined && f[k] !== p[k]);
    const row = data.put('livelihoods_products', { ...p, ...f, ...(priceOrText && p.status === 'listed' ? { status: 'draft', approved_by: null, approved_at: null } : {}) }, u);
    res.json(productOut(row, { full: true }));
  });
  // The group meeting agreed to sell this item at this price (recorded by the facilitator).
  router.post('/products/:id/agree', requires('services.assist'), (req, res) => {
    const u = req.user, p = productFor(u, req.params.id);
    const agreed = (req.body || {}).agreed !== false;
    const row = data.put('livelihoods_products', { ...p, group_agreed: agreed ? 1 : 0, agreed_on: agreed ? L.today() : null, agreed_by: agreed ? u.id : null, ...(agreed ? {} : { status: 'draft', approved_by: null, approved_at: null }) }, u);
    res.json(productOut(row));
  });
  // An agency admin approves the listing (only after the group agreed).
  router.post('/products/:id/:action(approve|unlist)', requires('agency.manage'), (req, res) => {
    const u = req.user, p = productFor(u, req.params.id);
    if (req.params.action === 'approve') {
      if (Number(p.group_agreed) !== 1) throw httpError(409, 'The group has not agreed to list this product yet.');
      const row = data.put('livelihoods_products', { ...p, status: 'listed', approved_by: u.id, approved_at: new Date().toISOString() }, u);
      emit('livelihoods.product_listed', { id: p.id }, u, p.hamlet_id);
      brain.audit(u, 'product.approve', p.id, { group: p.group_id });
      return res.json(productOut(row));
    }
    res.json(productOut(data.put('livelihoods_products', { ...p, status: 'draft', approved_by: null, approved_at: null }, u)));
  });

  // Public (signed-in) catalogue: listed products with the group's name only — no member names, no people.
  router.get('/catalogue', authed, (req, res) => {
    const rows = sql("SELECT * FROM livelihoods_products WHERE deleted=0 AND status='listed' AND group_agreed=1 ORDER BY category, name")
      .filter((p) => brain.modules.enabledIn(p.hamlet_id));
    const cat = req.query.category && CATEGORIES.includes(req.query.category) ? req.query.category : null;
    res.json({ partner_note: PARTNER_NOTE, partner_note_ml: PARTNER_NOTE_ML,
      products: rows.filter((p) => !cat || p.category === cat).map((p) => ({ id: p.id, name: p.name, name_ml: p.name_ml, category: p.category, unit: p.unit, price: p.price, in_stock: Number(p.stock) > 0, description: p.description, has_photo: !!p.photo, group: (data.get('livelihoods_groups', p.group_id) || {}).name || null, hamlet: hamletOf(p.hamlet_id), is_demo: Number(p.is_demo) === 1 })) });
  });
  router.get('/catalogue/:id/photo', authed, (req, res) => {
    const p = data.get('livelihoods_products', S(req.params.id, 60));
    if (!p || p.status !== 'listed' || !brain.modules.enabledIn(p.hamlet_id)) throw httpError(404, 'Not found');
    res.json({ photo: p.photo || null });
  });

  // ---------------- aggregates (donors, government, admins): per hamlet, k-anonymised ----------------
  router.get('/aggregate', requires('analytics.aggregate'), (req, res) => {
    const u = req.user;
    const all = ALL_AGENCIES.includes(u.role);
    const priv = PRIV.includes(u.role);
    // external viewers get a fixed window so moving it cannot reveal a single member's entry
    const months = priv ? Math.min(24, Math.max(1, Number(req.query.months) || 6)) : 6;
    const window = L.lastMonths(L.today(), months);
    const since = window[0] + '-01';
    const groups = sql('SELECT * FROM livelihoods_groups WHERE deleted=0' + (all ? '' : ' AND agency_id=?'), ...(all ? [] : [u.agency_id || '-']))
      .filter((g) => u.role === 'platform_admin' || brain.modules.enabledIn(g.hamlet_id));
    const sup = (n) => P.suppress(n, u);
    const hid = (v) => typeof v === 'string';
    const by = new Map();
    for (const g of groups) {
      if (!by.has(g.hamlet_id)) by.set(g.hamlet_id, { groups: 0, active: 0, members: new Set(), savings: 0, loans_open: 0, loans_on_time: 0, trend: Object.fromEntries(window.map((m) => [m, 0])) });
      const c = by.get(g.hamlet_id);
      const txns = txnsOf(g.id);
      const meetings = meetingsOf(g.id);
      c.groups++;
      if (g.status === 'active' && meetings.some((m) => m.date >= L.addDays(L.today(), -90))) c.active++;
      for (const m of membersOf(g.id)) if (m.status === 'active') c.members.add(m.person_id);
      for (const t of L.order(txns)) if (t.kind === 'savings' && t.date >= since) { c.savings += t.amount; if (c.trend[t.date.slice(0, 7)] !== undefined) c.trend[t.date.slice(0, 7)] += t.amount; }
      for (const l of L.loanBook(txns)) if (l.status !== 'closed') { c.loans_open++; if (l.status === 'on_time') c.loans_on_time++; }
    }
    const hamlets = [];
    for (const [hidId, c] of by) {
      const h = hamletOf(hidId) || {};
      const small = hid(sup(c.members.size));
      hamlets.push({ hamlet_id: hidId, hamlet: h.name, hamlet_ml: h.name_ml, groups: c.groups, groups_active: c.active, members: sup(c.members.size),
        savings_inr: small ? 'hidden' : Math.round(c.savings / 100), loans_open: sup(c.loans_open),
        loans_on_time_pct: hid(sup(c.loans_open)) || small || !c.loans_open ? null : Math.round((c.loans_on_time / c.loans_open) * 100), suppressed: small });
    }
    hamlets.sort((a, b) => String(a.hamlet).localeCompare(String(b.hamlet)));
    // complementary suppression: a total is hidden if any hamlet's matching cell is hidden
    const totalOf = (k, raw) => (hamlets.some((h) => hid(h[k])) ? 'hidden' : raw);
    const cells = [...by.values()];
    const T = { groups: cells.reduce((a, c) => a + c.groups, 0), active: cells.reduce((a, c) => a + c.active, 0), members: new Set(cells.flatMap((c) => [...c.members])).size, savings: cells.reduce((a, c) => a + c.savings, 0), loans_open: cells.reduce((a, c) => a + c.loans_open, 0), on_time: cells.reduce((a, c) => a + c.loans_on_time, 0) };
    // groups are not people: their counts are shown as they are
    const totals = { groups: T.groups, groups_active: T.active, members: totalOf('members', sup(T.members)), savings_inr: totalOf('savings_inr', Math.round(T.savings / 100)), loans_open: totalOf('loans_open', sup(T.loans_open)) };
    totals.loans_on_time_pct = hid(totals.loans_open) || hamlets.some((h) => h.loans_on_time_pct === null && h.loans_open !== 0) || !T.loans_open ? null : Math.round((T.on_time / T.loans_open) * 100);
    // the monthly trend only adds up hamlets whose cells are shown, so it cannot rebuild a hidden total
    const shown = new Set(hamlets.filter((h) => !h.suppressed).map((h) => h.hamlet_id));
    const trend = window.map((m) => ({ month: m, savings_inr: Math.round([...by.entries()].filter(([k]) => shown.has(k)).reduce((a, [, c]) => a + c.trend[m], 0) / 100) }));
    res.json({ since, months, k_anon: 5, scope: all ? 'all agencies' : 'your agency', totals, hamlets, trend, trend_hamlets: shown.size,
      note: 'Counts of groups and members only; no names. Numbers under 5 are shown as "<5" and any total that could reveal them is hidden. Amounts are DEMO data in the demo.',
      note_ml: 'ഗ്രൂപ്പുകളുടെയും അംഗങ്ങളുടെയും എണ്ണം മാത്രം; പേരുകളില്ല. 5-ൽ താഴെയുള്ള എണ്ണം "<5" ആയി കാണിക്കും.' });
  });

  // ---------------- demo seed ----------------
  async function seed(demo) {
    const R = demo.rng(9601); // own random stream — never demo.R
    const { store, brain: B, daysAgo } = demo;
    const H = demo.hamletByKey, A = demo.agencyByKey;
    const hamlets = [H.h1, H.h2, H.h11].filter(Boolean);
    const today = L.today();
    const t0 = Date.now();
    const users = {};
    const groups = [];
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PS/HgAFXQJMm+Ys9QAAAABJRU5ErkJggg==';

    tx(() => {
      store.put('agencies', { id: CDS_AGENCY_ID, name: 'Demo Kudumbashree CDS (fictional)', type: 'govt', steward: 0, status: 'active', colour: '#ad1457', contact: 'demo@example.org', about: 'Fictional Community Development Society for the demo — supports neighbourhood groups, reviews loan requests, approves product listings.' });
      for (const h of hamlets) store.put('agency_presence', { agency_id: CDS_AGENCY_ID, hamlet_id: h.id, services: ['livelihood'], since: daysAgo(R.int(250, 600)).slice(0, 10), status: 'active' });
      if (H.h11 && !store.one('SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0', A.cif.id, H.h11.id)) store.put('agency_presence', { agency_id: A.cif.id, hamlet_id: H.h11.id, services: ['livelihood'], since: daysAgo(300).slice(0, 10), status: 'active' });
      users.cds = B.createUser({ username: 'demo.cds', password: demo.DEMO_PASSWORD, role: 'field_officer', agency_id: CDS_AGENCY_ID, hamlet_ids: hamlets.map((h) => h.id), display_name: 'Lissy — CDS Community Resource Person (Demo Kudumbashree CDS)', safeguarding_trained: 1 }, null);
      users.admin = B.createUser({ username: 'demo.cds.admin', password: demo.DEMO_PASSWORD, role: 'agency_admin', agency_id: CDS_AGENCY_ID, display_name: 'Demo Kudumbashree CDS — Chairperson (admin)', safeguarding_trained: 1 }, null);

      const progs = {};
      for (const h of hamlets) progs['cds|' + h.id] = store.put('programmes', { agency_id: CDS_AGENCY_ID, hamlet_id: h.id, module: 'livelihoods', track: 'livelihood', title: 'Neighbourhood groups — savings, credit & enterprise', title_ml: 'അയൽക്കൂട്ടങ്ങൾ — സമ്പാദ്യം, വായ്പ, സംരംഭം', schedule: ['Weekly group meeting'], capacity: 120, status: 'active' });
      if (H.h11) progs['cif|' + H.h11.id] = store.put('programmes', { agency_id: A.cif.id, hamlet_id: H.h11.id, module: 'livelihoods', track: 'livelihood', title: 'Youth enterprise support — Komalikudi', title_ml: 'യുവ സംരംഭ സഹായം — കോമളിക്കുടി', schedule: ['Monthly enterprise meeting'], capacity: 30, status: 'active' });

      // merge scopes: grantConsent supersedes the agency's earlier consent
      const merge = (pid, aid) => {
        const cur = store.find('consents', { person_id: pid, agency_id: aid, status: 'active' })[0];
        const scopes = [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : []), 'profile', 'livelihood'])];
        const c = B.grantConsent({ person_id: pid, agency_id: aid, scopes, granted_by: pid, relation: 'self', method: cur ? cur.method || 'in_person' : R.pick(['in_person', 'in_person', 'ivr']) }, null);
        store.put('consents', { ...c, granted_at: cur && cur.granted_at ? cur.granted_at : daysAgo(R.int(200, 400)) });
      };
      const NAMES = {
        [H.h1.id]: [['Pachakkudi Kurinji NHG', 'പച്ചക്കുടി കുറിഞ്ഞി അയൽക്കൂട്ടം', 'shg'], ['Pachakkudi Thenkani NHG', 'പച്ചക്കുടി തേൻകനി അയൽക്കൂട്ടം', 'shg'], ['Malayoram Spice JLG', 'മലയോരം സ്പൈസ് ജെ.എൽ.ജി', 'jlg']],
        [H.h2.id]: [['Thenmala Chandana NHG', 'തേന്മല ചന്ദന അയൽക്കൂട്ടം', 'shg'], ['Thenmala Millet Kitchen', 'തേന്മല ചെറുധാന്യ അടുക്കള', 'enterprise']],
      };
      if (H.h11) NAMES[H.h11.id] = [['Komalikudi Neelakurinji NHG', 'കോമളിക്കുടി നീലക്കുറിഞ്ഞി അയൽക്കൂട്ടം', 'shg'], ['Komalikudi Youth Honey Collective', 'കോമളിക്കുടി യുവ തേൻ കൂട്ടായ്മ', 'enterprise']];
      for (const h of hamlets) {
        const adultsF = demo.persons.filter((p) => p.hamlet_id === h.id && p.gender === 'F' && p.kind !== 'child' && !B.policy.isMinor(p));
        const youth = demo.persons.filter((p) => p.hamlet_id === h.id && p.kind === 'youth' && !B.policy.isMinor(p));
        let pool = adultsF.slice();
        if (demo.demoGuardian && h.id === demo.demoGuardian.hamlet_id) pool = [demo.demoGuardian, ...pool.filter((p) => p.id !== demo.demoGuardian.id)];
        for (const [name, name_ml, type] of NAMES[h.id] || []) {
          const cif = h === H.h11 && type === 'enterprise';
          const agency_id = cif ? A.cif.id : CDS_AGENCY_ID;
          let picked;
          if (cif) picked = R.sample(youth, Math.min(youth.length, 6));
          else { const n = Math.min(pool.length, type === 'jlg' ? 5 : R.int(6, 8)); picked = pool.slice(0, n); pool = pool.slice(n); }
          if (picked.length < 3) continue;
          const formed = L.addDays(today, -R.int(300, 700));
          const g = data.put('livelihoods_groups', { hamlet_id: h.id, agency_id, name, name_ml, type, formed_on: formed, meeting_day: type === 'enterprise' ? 'sat' : R.pick(['sun', 'wed', 'fri']), thrift: type === 'enterprise' ? 10000 : R.pick([2000, 3000, 5000]), status: 'active', notes: 'DEMO group — fictional members and amounts', created_by: users.cds.id }, null);
          picked.forEach((p, i) => {
            merge(p.id, agency_id);
            B.enrol(p.id, progs[(cif ? 'cif|' : 'cds|') + h.id].id, null);
            data.put('livelihoods_members', { group_id: g.id, hamlet_id: h.id, agency_id, person_id: p.id, role: i === 0 ? 'president' : i === 1 ? 'secretary' : 'member', joined_on: formed, status: 'active', added_by: users.cds.id }, null);
          });
          groups.push({ g, members: picked.map((p) => p.id) });
        }
      }

      // ~6 months of meetings and books, simulated in date order so the ledger never goes negative.
      const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      const start = L.addDays(today, -182);
      for (const { g, members } of groups) {
        const monthlyMeet = g.type === 'enterprise';
        const reliable = Object.fromEntries(members.map((pid) => [pid, R.chance(0.2) ? 0.55 : 0.97]));
        let cash = 0, bank = 0;
        const loans = []; // {pid, left, inst, months, next}
        const put = (date, kind, amount, pid, meeting_id, extra = {}) => {
          data.put('livelihoods_txns', { group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, date, kind, amount, person_id: pid || null, meeting_id, note: extra.note || null, months: extra.months || null, request_id: extra.request_id || null, entered_by: users.cds.id, entered_at: date + 'T12:00:00.000Z', voided: 0 }, null);
          cash += L.KINDS[kind].dir * amount; bank += L.KINDS[kind].bank * amount;
        };
        // opening balance: savings carried over from before the window (one entry per member)
        for (const pid of members) put(start, 'savings', g.thrift * R.int(8, 20), pid, null, { note: 'Opening balance carried forward (demo)' });
        let d = start;
        while (new Date(d + 'T00:00:00Z').getUTCDay() !== DOW[g.meeting_day]) d = L.addDays(d, 1);
        let lastMonth = null;
        for (; d <= today; d = monthlyMeet ? L.addMonths(d, 1) : L.addDays(d, 7)) {
          if (!monthlyMeet && R.chance(0.08)) continue; // a missed week
          const present = members.filter(() => R.chance(0.85));
          const m = data.put('livelihoods_meetings', { group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, date: d, attendance: present.length, savings_collected: 0, notes: null, entered_by: users.cds.id }, null);
          let collected = 0;
          for (const pid of present) if (R.chance(0.92)) { put(d, 'savings', g.thrift, pid, m.id); collected += g.thrift; }
          const newMonth = d.slice(0, 7) !== lastMonth; lastMonth = d.slice(0, 7);
          if (newMonth || monthlyMeet) {
            for (const l of loans.filter((x) => x.left > 0 && x.next <= d)) {
              if (!present.includes(l.pid) || !R.chance(reliable[l.pid])) continue;
              const amt = Math.min(l.left, l.inst);
              const intr = Math.round(l.left * 0.01 / 100) * 100; // 1% a month on the balance (DRAFT convention)
              put(d, 'repayment', amt, l.pid, m.id); l.left -= amt; l.next = L.addMonths(l.next, 1);
              if (intr > 0) put(d, 'interest', intr, l.pid, m.id);
            }
            if (g.type === 'enterprise' && R.chance(0.8)) put(d, 'income', R.int(15, 60) * 10000, null, m.id, { note: R.pick(['Honey sales to city partner', 'Sales at weekly market', 'Order from partner shop']) });
            if (R.chance(0.25) && cash >= 30000) put(d, 'expense', R.int(5, 30) * 1000, null, m.id, { note: R.pick(['Pass book and stationery', 'Travel to bank', 'Bottles and labels']) });
          }
          // a new loan now and then, if the group has money
          if (d > L.addDays(start, 21) && R.chance(monthlyMeet ? 0.4 : 0.12)) {
            const pid = R.pick(present.length ? present : members);
            if (!loans.some((l) => l.pid === pid && l.left > 0)) {
              const want = R.int(4, 30) * 50000;
              if (want > cash && bank >= want - cash) put(d, 'bank_withdrawal', want - cash, null, m.id);
              if (want <= cash) {
                const months = R.pick([5, 6, 8, 10, 12]);
                put(d, 'loan_out', want, pid, m.id, { months });
                loans.push({ pid, left: want, inst: L.instalments(want, months)[0], months, next: L.addMonths(d, 1) });
              }
            }
          }
          if (cash > 1500000) put(d, 'bank_deposit', Math.floor((cash - 500000) / 100000) * 100000, null, m.id);
          store.put('livelihoods_meetings', { ...store.get('livelihoods_meetings', m.id), savings_collected: collected });
        }
        const chk = L.replay(txnsOf(g.id));
        if (!chk.ok) throw new Error(`seed ledger for ${g.name} invalid: ${chk.error}`);
      }

      // products (DEMO prices in paise)
      const PRODUCTS = [
        ['Wild forest honey', 'കാട്ടുതേൻ', 'honey', 'bottle', 45000, 'Collected by the youth collective, filtered and bottled (500 g).'],
        ['Honey comb pieces', 'തേൻ അട', 'honey', 'pack', 30000, 'Small pack of comb honey.'],
        ['Cardamom (small, green)', 'ഏലം', 'spices', 'pack', 32000, '100 g pack, hand-sorted.'],
        ['Black pepper', 'കുരുമുളക്', 'spices', 'pack', 18000, '250 g, sun-dried.'],
        ['Wild turmeric powder', 'കസ്തൂരി മഞ്ഞൾ പൊടി', 'spices', 'pack', 15000, '100 g.'],
        ['Ragi (finger millet) flour', 'റാഗി പൊടി', 'millets', 'kg', 9000, 'Stone-ground, 1 kg.'],
        ['Millet laddu', 'ചെറുധാന്യ ലഡ്ഡു', 'millets', 'pack', 12000, '10 pieces.'],
        ['Bamboo basket', 'മുളക്കൊട്ട', 'crafts', 'piece', 35000, 'Hand-woven, medium.'],
        ['Cane tray', 'ചൂരൽ ട്രേ', 'crafts', 'piece', 28000, 'Serving tray.'],
        ['Banana chips', 'ഏത്തക്കായ ഉപ്പേരി', 'food', 'pack', 8000, '250 g.'],
      ];
      const forG = (pred) => groups.map((x) => x.g).filter(pred);
      PRODUCTS.forEach(([name, name_ml, category, unit, price, description], i) => {
        const g = category === 'honey' ? (forG((x) => x.type === 'enterprise' && x.hamlet_id === (H.h11 || H.h1).id)[0] || groups[0].g)
          : category === 'millets' || category === 'food' ? (forG((x) => x.type === 'enterprise' && x.hamlet_id === H.h2.id)[0] || groups[0].g)
            : category === 'spices' ? (forG((x) => x.type === 'jlg')[0] || groups[0].g) : groups[i % groups.length].g;
        const state = i % 5 === 3 ? 'draft' : i % 5 === 4 ? 'agreed' : 'listed';
        const approver = g.agency_id === CDS_AGENCY_ID ? users.admin.id : demo.users['cif.admin'].id;
        data.put('livelihoods_products', { group_id: g.id, hamlet_id: g.hamlet_id, agency_id: g.agency_id, name, name_ml, category, unit, price, stock: R.int(0, 60), description: description + ' DEMO listing — fictional.', photo: PNG, status: state === 'listed' ? 'listed' : 'draft', group_agreed: state === 'draft' ? 0 : 1, agreed_on: state === 'draft' ? null : L.addDays(today, -R.int(10, 60)), agreed_by: state === 'draft' ? null : users.cds.id, approved_by: state === 'listed' ? approver : null, approved_at: state === 'listed' ? daysAgo(R.int(3, 40)) : null, created_by: users.cds.id, is_demo: 1 }, null);
      });
    });

    // loan requests through the engine: some waiting, some decided (approved ones wait for the next meeting to be given)
    const officer = B.store.get('users', users.cds.id), admin = B.store.get('users', users.admin.id);
    tx(() => {
      let n = 0;
      const REPLIES = {
        approved: ['Approved by the CDS. The facilitator will give the loan at your next meeting. Repay a little every month.', 'സി.ഡി.എസ് അനുവദിച്ചു. അടുത്ത യോഗത്തിൽ ഫെസിലിറ്റേറ്റർ വായ്പ നൽകും. എല്ലാ മാസവും കുറച്ച് തിരിച്ചടയ്ക്കുക.'],
        declined: ['Not this time: the group does not have enough money now. Ask again after two months of savings.', 'ഇപ്പോൾ ഇല്ല: ഗ്രൂപ്പിന്റെ കൈയിൽ ഇപ്പോൾ മതിയായ പണമില്ല. രണ്ട് മാസത്തെ സമ്പാദ്യത്തിന് ശേഷം വീണ്ടും ചോദിക്കുക.'],
        more_info: ['Please talk to the group first and bring the meeting\'s decision next visit.', 'ആദ്യം ഗ്രൂപ്പുമായി സംസാരിക്കുക, യോഗ തീരുമാനം അടുത്ത സന്ദർശനത്തിൽ കൊണ്ടുവരിക.'],
      };
      for (const { g, members } of groups.filter((x) => x.g.agency_id === CDS_AGENCY_ID)) {
        const pids = R.sample(members, 2);
        if (demo.demoGuardian && members.includes(demo.demoGuardian.id) && !pids.includes(demo.demoGuardian.id)) pids[0] = demo.demoGuardian.id;
        for (const pid of pids) {
          const ago = R.int(2, 40);
          const amount = R.int(3, 20) * 500;
          const s = B.forms.submit(officer, { form_key: F.LOAN_FORM.key, person_id: pid, answers: { group_id: g.id, purpose: R.pick(F.PURPOSES).value, amount, months: R.pick([6, 8, 10, 12]), group_agreed: 'yes' }, client_ref: 'seed-lvh-loan-' + (n++) }, {});
          store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: daysAgo(ago) });
          if (ago > 7 && R.chance(0.7)) {
            const dec = (s.flags || []).some((f) => f.code === 'above_lendable' || f.code === 'member_overdue') ? R.pick(['declined', 'more_info']) : 'approved';
            const [en, ml] = REPLIES[dec];
            B.forms.reply(admin, s.id, { reply: en, reply_ml: ml, outcome: dec, close: dec === 'declined', notify: false });
            store.put('form_submissions', { ...store.get('form_submissions', s.id), replied_at: daysAgo(ago - R.int(1, 5)), reply_seen_at: R.chance(0.5) ? daysAgo(ago - 6) : null });
          }
        }
      }
      // enterprise ideas
      const ideaPeople = groups.filter((x) => x.g.agency_id === CDS_AGENCY_ID).flatMap((x) => x.members);
      for (const [kind, idea, needs] of [['millets', 'Sell ragi flour and millet snacks to the school canteen in town.', ['market', 'licence']], ['crafts', 'Bamboo lamps for the homestays on the tourist road.', ['training', 'market']], ['tailoring', 'Stitch school uniforms for the hamlet children.', ['money', 'tools']]]) {
        const pid = R.pick(ideaPeople);
        const s = B.forms.submit(officer, { form_key: F.IDEA_FORM.key, person_id: pid, answers: { kind, idea, needs, money_needed: needs.includes('money') ? 25000 : undefined, skills: 'Learnt from family.' }, client_ref: 'seed-lvh-idea-' + kind }, {});
        store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: daysAgo(R.int(5, 50)) });
      }
    });
    ctx.log(`seeded ${groups.length} groups, ${sqlOne('SELECT COUNT(*) n FROM livelihoods_txns WHERE deleted=0').n} ledger entries, ${sqlOne('SELECT COUNT(*) n FROM livelihoods_meetings WHERE deleted=0').n} meetings in ${Date.now() - t0}ms`);
  }

  return {
    seed,
    health: () => ({
      groups: sqlOne('SELECT COUNT(*) n FROM livelihoods_groups WHERE deleted=0').n,
      members: sqlOne("SELECT COUNT(*) n FROM livelihoods_members WHERE deleted=0 AND status='active'").n,
      entries: sqlOne('SELECT COUNT(*) n FROM livelihoods_txns WHERE deleted=0').n,
      products_listed: sqlOne("SELECT COUNT(*) n FROM livelihoods_products WHERE deleted=0 AND status='listed'").n,
    }),
  };
};

module.exports.CDS_AGENCY_ID = CDS_AGENCY_ID;
