'use strict';
// AADI — Safeguarding (critical). Child-protection layer for the whole platform.
//  • Confidential Help button for learners/guardians → case routed ONLY to the CPO + platform steward.
//  • CPO case management (triage, severity, action log, referral, closure) — every read audited.
//  • Moderation queue fed by other modules' `<id>.message_flagged` / `<id>.content_flagged` events
//    and by POST /flag. Decisions are broadcast as `safeguarding.moderation_decided`.
//  • Safeguarding training tracker (course + quiz) for child-facing staff.
//  • Incident register and policy / code of conduct pages.
const fs = require('fs');
const path = require('path');
const filter = require('./filter');

const C = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'safeguarding.json'), 'utf8'));
const CASE_ROLES = ['cpo', 'platform_admin'];
const CHILD_FACING = ['facilitator', 'teacher', 'mentor', 'counsellor', 'coordinator'];
const STAFF = ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['new', 'triaged', 'in_progress', 'referred', 'closed'];
const CATEGORIES = ['online_harassment', 'bullying', 'unsafe_at_home', 'unsafe_in_community', 'adult_conduct', 'exploitation_risk', 'wellbeing', 'boundary_breach', 'other'];
const REFERRALS = ['childline_1098', 'police_112', 'cwc', 'dcpu', 'women_181', 'health', 'counsellor', 'none'];
const HELP_SEVERITY = { unsafe: 'high', bothering: 'medium', other: 'low' };
const HELP_CATEGORY = { unsafe: 'unsafe_in_community', bothering: 'online_harassment', other: 'other' };
const TRAINING_VALID_DAYS = 365;

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError } = ctx;
  const now = () => new Date().toISOString();
  const S = (v, max = 2000) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const isCase = (u) => CASE_ROLES.includes(u.role);
  const caseOnly = requires('safeguard'); // platform_admin + cpo only

  // ---------- cases ----------
  function nextCaseNo() {
    const yr = new Date().getFullYear();
    const n = sqlOne('SELECT COUNT(*) n FROM safeguarding_cases WHERE case_no LIKE ?', `SG-${yr}-%`).n;
    return `SG-${yr}-${String(n + 1).padStart(4, '0')}`;
  }
  const ackCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  function logAction(caseRow, action, note, user, extra = {}) {
    return data.put('safeguarding_actions', { case_id: caseRow.id, hamlet_id: caseRow.hamlet_id, action, note: S(note, 2000), by_id: user ? user.id : null, by_name: user ? user.display_name : 'System', by_role: user ? user.role : 'system', at: extra.at || now() }, user);
  }
  function openCase({ source, kind, category, severity, person_id, hamlet_id, description, reporter, reporter_relation, moderation_id = null, at = null }) {
    const sev = SEVERITIES.includes(severity) ? severity : 'medium';
    const row = data.put('safeguarding_cases', {
      case_no: nextCaseNo(), source, kind: kind || null, category: CATEGORIES.includes(category) ? category : 'other', severity: sev, status: 'new',
      person_id: person_id || null, hamlet_id: hamlet_id || null, description: S(description, 4000),
      reporter_id: reporter ? reporter.id : null, reporter_role: reporter ? reporter.role : 'system', reporter_relation: reporter_relation || null,
      ack_code: ackCode(), moderation_id, created_at: at || now(), referrals: [],
    }, reporter);
    logAction(row, 'opened', `Case opened from ${source}${kind ? ' (' + kind + ')' : ''}.`, reporter, { at: at || undefined });
    // minimal payload: no names, no text — the event log is replicated
    emit('safeguarding.case_opened', { case_id: row.id, severity: sev, source }, reporter, null);
    return row;
  }

  // Help button — any learner / guardian (also any signed-in user, so no one is turned away).
  router.post('/help', authed, (req, res) => {
    const u = req.user;
    const kind = Object.keys(HELP_SEVERITY).includes(req.body.kind) ? req.body.kind : 'other';
    let subject = u.person_id || null;
    let relation = 'self';
    if (req.body.person_id && req.body.person_id !== u.person_id) {
      const p = brain.persons.raw(req.body.person_id);
      if (!p || !(u.role === 'guardian' && p.guardian_id === u.person_id)) throw httpError(403, 'You can ask for help for yourself or your own child.');
      subject = p.id; relation = 'guardian';
    }
    const p = subject ? brain.persons.raw(subject) : null;
    const message = S(req.body.message, 2000);
    const scan = filter.scan(message);
    let severity = HELP_SEVERITY[kind];
    if (scan.reasons.includes('self_harm_or_danger')) severity = 'critical';
    else if (scan.severity === 'high' && severity !== 'high') severity = 'high';
    const description = [
      { unsafe: 'Learner pressed Help: "I feel unsafe".', bothering: 'Learner pressed Help: "Someone is bothering me".', other: 'Learner pressed Help: "Something else".' }[kind],
      relation === 'guardian' ? '(Raised by guardian on behalf of their child.)' : null,
      message ? 'In their words: ' + message : null,
      req.body.contact_ok === false ? 'Asked NOT to be phoned — contact through the centre in person.' : null,
    ].filter(Boolean).join(' ');
    const row = tx(() => openCase({ source: 'help_button', kind, category: HELP_CATEGORY[kind], severity, person_id: subject, hamlet_id: p ? p.hamlet_id : null, description, reporter: u, reporter_relation: relation }));
    brain.audit(u, 'help_requested', row.id, { severity });
    // Response deliberately carries no case details — shared devices.
    res.json({ ok: true, reference: row.ack_code, received_at: row.created_at, helplines: C.helplines, message: 'Thank you for telling us. A trusted person from the Child Protection team will reach you soon. You are not in trouble.', message_ml: 'ഞങ്ങളോട് പറഞ്ഞതിന് നന്ദി. ചൈൽഡ് പ്രൊട്ടക്ഷൻ ടീമിലെ ഒരു വിശ്വസ്ത വ്യക്തി ഉടൻ നിങ്ങളെ ബന്ധപ്പെടും. നിങ്ങൾ കുഴപ്പത്തിലല്ല.' });
  });

  // Staff "Report a concern" — any staff member; routes to CPO, the reporter cannot read the case afterwards.
  router.post('/concerns', requires('learner.read', 'teach', 'ops', 'mentor', 'counsel'), (req, res) => {
    const u = req.user;
    const description = S(req.body.description, 4000);
    if (description.length < 10) throw httpError(400, 'Please describe what you saw or heard (facts, in the learner\'s words).');
    let p = null;
    if (req.body.person_id) {
      p = brain.persons.raw(req.body.person_id);
      if (!p) throw httpError(404, 'Person not found');
      // Staff may report about any learner they can see; if they can't, they may still report by name in the text.
      if (!brain.policy.canSee(u, p.id, 'profile').ok) p = null;
    }
    const row = tx(() => openCase({ source: 'staff_report', kind: 'concern', category: req.body.category, severity: req.body.urgent ? 'high' : (req.body.severity || 'medium'), person_id: p ? p.id : null, hamlet_id: p ? p.hamlet_id : (req.body.hamlet_id || null), description, reporter: u, reporter_relation: 'staff' }));
    brain.audit(u, 'concern_reported', row.id, { severity: row.severity });
    res.json({ ok: true, reference: row.ack_code, case_no: row.case_no, note: 'Sent to the Child Protection Officer. Do not investigate yourself. If the child is in immediate danger call 112.' });
  });

  function caseView(c, { full = false } = {}) {
    const p = c.person_id ? brain.persons.raw(c.person_id) : null;
    const h = c.hamlet_id ? brain.hamlets.get(c.hamlet_id) : null;
    const reporter = c.reporter_id ? brain.users.get(c.reporter_id) : null;
    const out = { ...c, person_name: p ? p.name : null, person_kind: p ? p.kind : null, person_minor: p ? brain.policy.isMinor(p) : null, hamlet_name: h ? h.name : null, hamlet_name_ml: h ? h.name_ml : null, reporter_name: reporter ? reporter.display_name : null, age_days: Math.floor((Date.now() - new Date(c.created_at)) / 864e5) };
    if (!full) delete out.description;
    return out;
  }

  router.get('/cases', caseOnly, (req, res) => {
    const where = {};
    if (req.query.status && STATUSES.includes(req.query.status)) where.status = req.query.status;
    let rows = data.find('safeguarding_cases', where, { order: 'created_at DESC', limit: 500 });
    if (req.query.open === '1') rows = rows.filter((c) => c.status !== 'closed');
    brain.audit(req.user, 'case_list', 'cases', { n: rows.length, filter: where });
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
    rows.sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || sevRank[a.severity] - sevRank[b.severity] || (b.created_at > a.created_at ? 1 : -1));
    res.json(rows.map((c) => caseView(c)));
  });

  router.get('/cases/:id', caseOnly, (req, res) => {
    const c = data.get('safeguarding_cases', req.params.id);
    if (!c) throw httpError(404, 'Case not found');
    brain.audit(req.user, 'case_read', c.id, { case_no: c.case_no });
    const actions = data.find('safeguarding_actions', { case_id: c.id }, { order: 'at ASC' });
    const mod = c.moderation_id ? data.get('safeguarding_moderation', c.moderation_id) : null;
    const p = c.person_id ? brain.persons.raw(c.person_id) : null;
    const guardian = p && p.guardian_id ? brain.persons.raw(p.guardian_id) : null;
    const prior = c.person_id ? data.find('safeguarding_cases', { person_id: c.person_id }, { order: 'created_at DESC' }).filter((x) => x.id !== c.id).map((x) => ({ id: x.id, case_no: x.case_no, created_at: x.created_at, severity: x.severity, status: x.status, category: x.category })) : [];
    const cpos = [...brain.users.byRole('cpo'), ...brain.users.byRole('platform_admin')].map((u) => ({ id: u.id, name: u.display_name, role: u.role }));
    res.json({ case: caseView(c, { full: true }), actions, moderation: mod, prior, assignees: cpos,
      person: p ? { id: p.id, name: p.name, kind: p.kind, gender: p.gender, age: p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 3.15576e10) : null, school_class: p.school_class, phone: p.phone || null, guardian: guardian ? { name: guardian.name, relation: p.relation, phone: guardian.phone || null } : null } : null,
      options: { severities: SEVERITIES, statuses: STATUSES, categories: CATEGORIES, referrals: REFERRALS } });
  });

  router.post('/cases/:id/triage', caseOnly, (req, res) => {
    const c = data.get('safeguarding_cases', req.params.id);
    if (!c) throw httpError(404, 'Case not found');
    if (c.status === 'closed') throw httpError(409, 'Case is closed. Re-open it first.');
    const patch = {};
    if (req.body.severity && SEVERITIES.includes(req.body.severity)) patch.severity = req.body.severity;
    if (req.body.category && CATEGORIES.includes(req.body.category)) patch.category = req.body.category;
    if (req.body.assigned_to) { const a = brain.users.get(req.body.assigned_to); if (!a || !CASE_ROLES.includes(a.role)) throw httpError(400, 'Cases can only be assigned to the CPO or platform steward.'); patch.assigned_to = a.id; patch.assigned_name = a.display_name; }
    const status = c.status === 'new' ? 'triaged' : c.status;
    const row = tx(() => {
      const r = data.put('safeguarding_cases', { ...c, ...patch, status, triaged_at: c.triaged_at || now() }, req.user);
      logAction(r, 'triaged', [patch.severity && `Severity → ${patch.severity}`, patch.category && `Category → ${patch.category}`, patch.assigned_name && `Assigned → ${patch.assigned_name}`, S(req.body.note)].filter(Boolean).join('. '), req.user);
      return r;
    });
    res.json(caseView(row, { full: true }));
  });

  router.post('/cases/:id/actions', caseOnly, (req, res) => {
    const c = data.get('safeguarding_cases', req.params.id);
    if (!c) throw httpError(404, 'Case not found');
    const action = ['note', 'contacted_learner', 'contacted_guardian', 'safety_plan', 'referral', 'meeting', 'follow_up'].includes(req.body.action) ? req.body.action : 'note';
    const note = S(req.body.note);
    if (!note) throw httpError(400, 'Write a short note.');
    const out = tx(() => {
      let row = c;
      if (action === 'referral') {
        const to = REFERRALS.includes(req.body.referral) ? req.body.referral : 'none';
        row = data.put('safeguarding_cases', { ...c, status: c.status === 'closed' ? 'closed' : 'referred', referrals: [...new Set([...(Array.isArray(c.referrals) ? c.referrals : []), to])] }, req.user);
      } else if (['new', 'triaged'].includes(c.status)) row = data.put('safeguarding_cases', { ...c, status: 'in_progress', triaged_at: c.triaged_at || now() }, req.user);
      const a = logAction(row, action, (action === 'referral' ? `Referred to ${req.body.referral}. ` : '') + note, req.user);
      return { row, a };
    });
    res.json({ case: caseView(out.row, { full: true }), action: out.a });
  });

  router.post('/cases/:id/close', caseOnly, (req, res) => {
    const c = data.get('safeguarding_cases', req.params.id);
    if (!c) throw httpError(404, 'Case not found');
    const outcome = S(req.body.outcome, 200);
    if (!outcome) throw httpError(400, 'Record an outcome before closing.');
    const row = tx(() => {
      const r = data.put('safeguarding_cases', { ...c, status: 'closed', closed_at: now(), outcome, closure_note: S(req.body.note) }, req.user);
      logAction(r, 'closed', `Outcome: ${outcome}. ${S(req.body.note)}`, req.user);
      return r;
    });
    emit('safeguarding.case_closed', { case_id: c.id }, req.user, null);
    res.json(caseView(row, { full: true }));
  });
  router.post('/cases/:id/reopen', caseOnly, (req, res) => {
    const c = data.get('safeguarding_cases', req.params.id);
    if (!c) throw httpError(404, 'Case not found');
    const row = tx(() => { const r = data.put('safeguarding_cases', { ...c, status: 'in_progress', closed_at: null }, req.user); logAction(r, 'reopened', S(req.body.note) || 'Re-opened.', req.user); return r; });
    res.json(caseView(row, { full: true }));
  });

  // Anonymised incident register (no names, no free text) — CPO / steward.
  router.get('/register', caseOnly, (req, res) => {
    brain.audit(req.user, 'register_read', 'register');
    const rows = data.find('safeguarding_cases', {}, { order: 'created_at DESC', limit: 1000 });
    const hm = Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
    res.json({
      rows: rows.map((c) => ({ id: c.id, case_no: c.case_no, created_at: c.created_at, source: c.source, category: c.category, severity: c.severity, status: c.status, district: c.hamlet_id && hm[c.hamlet_id] ? hm[c.hamlet_id].district : null, referrals: c.referrals, outcome: c.outcome || null, closed_at: c.closed_at || null, days_open: Math.floor(((c.closed_at ? new Date(c.closed_at) : new Date()) - new Date(c.created_at)) / 864e5) })),
      summary: summary(),
    });
  });
  function summary() {
    const all = data.find('safeguarding_cases', {}, { limit: 5000 });
    const by = (k) => Object.entries(all.reduce((m, c) => ((m[c[k]] = (m[c[k]] || 0) + 1), m), {})).map(([key, n]) => ({ key, n }));
    const open = all.filter((c) => c.status !== 'closed');
    const triageHours = all.filter((c) => c.triaged_at).map((c) => (new Date(c.triaged_at) - new Date(c.created_at)) / 36e5);
    return { total: all.length, open: open.length, new: all.filter((c) => c.status === 'new').length, urgent_open: open.filter((c) => ['high', 'critical'].includes(c.severity)).length, by_status: by('status'), by_category: by('category'), by_severity: by('severity'), by_source: by('source'), median_triage_hours: triageHours.length ? Number(triageHours.sort((a, b) => a - b)[Math.floor(triageHours.length / 2)].toFixed(1)) : null, held_messages: data.find('safeguarding_moderation', { status: 'held' }).length };
  }
  router.get('/summary', caseOnly, (req, res) => res.json(summary()));

  // ---------- moderation queue ----------
  function enqueue({ source_module, source_type, ref_id, text, reasons, severity, author_id, author_role, target_person_id, hamlet_id, note, at }, actor) {
    if (ref_id) {
      const dup = data.find('safeguarding_moderation', { source_module, ref_id })[0];
      if (dup) return dup;
    }
    const scan = filter.scan(text);
    const rs = [...new Set([...(Array.isArray(reasons) ? reasons : []), ...scan.reasons])];
    const sev = SEVERITIES.includes(severity) ? severity : (scan.severity === 'none' ? 'low' : scan.severity === 'high' ? 'high' : scan.severity);
    const row = data.put('safeguarding_moderation', { source_module: S(source_module, 40), source_type: S(source_type, 40) || 'message', ref_id: ref_id || null, excerpt: filter.mask(text).slice(0, 600), reasons: rs, severity: sev, author_id: author_id || null, author_role: author_role || null, target_person_id: target_person_id || null, hamlet_id: hamlet_id || null, status: 'held', note: S(note, 500), created_at: at || now() }, actor);
    if (sev === 'high' || sev === 'critical' || rs.includes('self_harm_or_danger')) {
      const tp = target_person_id ? brain.persons.raw(target_person_id) : null;
      const c = openCase({ source: 'moderation', kind: source_type, category: rs.includes('self_harm_or_danger') ? 'wellbeing' : rs.some((r) => ['meeting_request', 'secrecy', 'inappropriate', 'gifts_money'].includes(r)) ? 'adult_conduct' : 'online_harassment', severity: sev === 'critical' ? 'critical' : 'high', person_id: tp ? tp.id : null, hamlet_id: hamlet_id || (tp && tp.hamlet_id) || null, description: `Automatically opened from a held ${source_type} in ${source_module}. Reasons: ${rs.join(', ')}. Excerpt: "${filter.mask(text).slice(0, 300)}"`, reporter: actor || null, moderation_id: row.id, at });
      return data.put('safeguarding_moderation', { ...row, case_id: c.id }, actor);
    }
    return row;
  }

  // Event-fed: any module emitting `<id>.message_flagged` or `<id>.content_flagged`.
  on('*', (ev) => {
    const t = ev.type || '';
    if (t.endsWith('.safeguarding_escalation') && !t.startsWith('safeguarding.')) {
      const p = ev.payload || {};
      const person = p.person_id ? brain.persons.raw(p.person_id) : null;
      const actor = ev.actor ? brain.users.get(ev.actor) : null;
      openCase({ source: t.split('.')[0], kind: 'escalation', category: 'wellbeing', severity: SEVERITIES.includes(p.severity) ? p.severity : 'medium', person_id: person ? person.id : null, hamlet_id: person ? person.hamlet_id : ev.hamlet_id, description: `Escalated by ${t.split('.')[0]}: ${S(p.reason, 300)}`, reporter: actor });
      return;
    }
    if (!(t.endsWith('.message_flagged') || t.endsWith('.content_flagged') || t.endsWith('.content_submitted'))) return;
    const mod = t.split('.')[0];
    if (mod === 'safeguarding' || mod === 'audit' || mod === 'row') return;
    const p = ev.payload || {};
    const text = p.text || p.body || p.excerpt || '';
    if (t.endsWith('.content_submitted')) {
      // only screen submissions that carry their text, and only hold them if the filter trips
      if (!text || !filter.scan(text).flagged) return;
    }
    const actor = ev.actor ? brain.users.get(ev.actor) : null;
    enqueue({ source_module: mod, source_type: t.endsWith('.message_flagged') ? 'message' : 'content', ref_id: p.ref_id || p.message_id || p.content_id || null, text, reasons: p.reasons, severity: p.severity, author_id: p.author_id || ev.actor, author_role: p.author_role || (actor && actor.role), target_person_id: p.target_person_id || p.person_id || null, hamlet_id: ev.hamlet_id || p.hamlet_id || null, note: p.note }, actor);
  });

  // Direct call: any signed-in user can flag something that made them uncomfortable.
  router.post('/flag', authed, (req, res) => {
    const b = req.body || {};
    const text = S(b.text || b.excerpt, 2000);
    if (!text && !b.ref_id) throw httpError(400, 'Nothing to flag.');
    const row = tx(() => enqueue({ source_module: S(b.source_module, 40) || 'direct', source_type: S(b.source_type, 40) || 'content', ref_id: b.ref_id ? S(b.ref_id, 80) : null, text, reasons: Array.isArray(b.reasons) ? b.reasons.map((r) => S(r, 40)) : ['user_report'], severity: b.severity, author_id: b.author_id || null, author_role: b.author_role || null, target_person_id: b.target_person_id || (req.user.role === 'learner' ? req.user.person_id : null), hamlet_id: b.hamlet_id || null, note: `Flagged by ${req.user.role}. ${S(b.note, 300)}` }, req.user));
    brain.audit(req.user, 'content_flagged', row.id, { source_module: row.source_module });
    res.json({ ok: true, id: row.id, status: row.status, held: true });
  });
  // Pure check (no storage) other modules' UIs can call before sending.
  router.post('/scan', authed, (req, res) => res.json(filter.scan(S(req.body.text, 4000))));

  router.get('/moderation', caseOnly, (req, res) => {
    const status = req.query.status || 'held';
    const rows = data.find('safeguarding_moderation', status === 'all' ? {} : { status }, { order: 'created_at DESC', limit: 300 });
    brain.audit(req.user, 'moderation_list', status, { n: rows.length });
    res.json(rows.map((m) => {
      const a = m.author_id ? brain.users.get(m.author_id) : null;
      const tp = m.target_person_id ? brain.persons.raw(m.target_person_id) : null;
      return { ...m, author_name: a ? a.display_name : null, target_name: tp ? tp.name : null, target_minor: tp ? brain.policy.isMinor(tp) : null, reason_labels: (m.reasons || []).map((r) => filter.RULES.find((x) => x.id === r) || { id: r, label: r, label_ml: r }) };
    }));
  });
  router.post('/moderation/:id/decide', caseOnly, (req, res) => {
    const m = data.get('safeguarding_moderation', req.params.id);
    if (!m) throw httpError(404, 'Not found');
    const decision = req.body.decision;
    if (!['approve', 'reject', 'escalate'].includes(decision)) throw httpError(400, 'decision must be approve, reject or escalate');
    const out = tx(() => {
      let caseId = m.case_id;
      if (decision === 'escalate' && !caseId) {
        const tp = m.target_person_id ? brain.persons.raw(m.target_person_id) : null;
        caseId = openCase({ source: 'moderation', kind: m.source_type, category: 'adult_conduct', severity: 'high', person_id: tp ? tp.id : null, hamlet_id: m.hamlet_id || (tp && tp.hamlet_id), description: `Escalated by moderator from ${m.source_module}. Reasons: ${(m.reasons || []).join(', ')}. Excerpt: "${m.excerpt}". ${S(req.body.note)}`, reporter: req.user, moderation_id: m.id }).id;
      }
      return data.put('safeguarding_moderation', { ...m, status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'escalated', decided_by: req.user.id, decided_by_name: req.user.display_name, decided_at: now(), decision_note: S(req.body.note, 500), case_id: caseId }, req.user);
    });
    brain.audit(req.user, 'moderation_decided', m.id, { decision });
    // Source module releases (approve) or keeps hidden (reject / escalate).
    emit('safeguarding.moderation_decided', { moderation_id: m.id, source_module: m.source_module, ref_id: m.ref_id, decision }, req.user, null);
    res.json(out);
  });

  // ---------- training ----------
  router.get('/training/course', authed, (req, res) => {
    const c = C.course;
    res.json({ ...c, quiz: c.quiz.map(({ q, q_ml, options, options_ml }) => ({ q, q_ml, options, options_ml })) });
  });
  function trainingFor(userId) {
    const rows = data.find('safeguarding_training', { user_id: userId }, { order: 'completed_at DESC' });
    const pass = rows.find((r) => Number(r.passed) === 1);
    const valid = !!(pass && pass.expires_at > now());
    return { trained: valid, last: rows[0] || null, passed_at: pass ? pass.completed_at : null, expires_at: pass ? pass.expires_at : null, attempts: rows.length };
  }
  router.get('/training/me', authed, (req, res) => res.json({ ...trainingFor(req.user.id), required: CHILD_FACING.includes(req.user.role) || ['agency_admin', 'cpo', 'platform_admin'].includes(req.user.role), core_flag: !!brain.users.get(req.user.id)?.safeguarding_trained }));
  router.post('/training/submit', requires('learner.read', 'teach', 'ops', 'mentor', 'counsel', 'agency.manage'), (req, res) => {
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const results = C.course.quiz.map((q, i) => Number(answers[i]) === q.answer);
    const score = results.filter(Boolean).length;
    const passed = score >= C.course.pass;
    const row = data.put('safeguarding_training', { user_id: req.user.id, agency_id: req.user.agency_id || null, role: req.user.role, display_name: req.user.display_name, course_version: C.course.version, score, total: C.course.quiz.length, passed: passed ? 1 : 0, completed_at: now(), expires_at: passed ? new Date(Date.now() + TRAINING_VALID_DAYS * 864e5).toISOString() : null }, req.user);
    if (passed) emit('safeguarding.training_passed', { user_id: req.user.id }, req.user, null);
    res.json({ ok: true, score, total: C.course.quiz.length, pass_mark: C.course.pass, passed, results, record: row });
  });
  router.get('/training/staff', requires('safeguard', 'agency.manage'), (req, res) => {
    const roles = ['facilitator', 'teacher', 'mentor', 'counsellor', 'coordinator', 'agency_admin'];
    let users = roles.flatMap((r) => brain.users.byRole(r));
    if (!isCase(req.user)) users = users.filter((u) => u.agency_id === req.user.agency_id);
    const ag = Object.fromEntries(brain.agencies.list().map((a) => [a.id, a.name]));
    res.json(users.map((u) => { const t = trainingFor(u.id); return { id: u.id, display_name: u.display_name, role: u.role, agency: ag[u.agency_id] || null, active: !!u.active, core_flag: !!u.safeguarding_trained, module_trained: t.trained, passed_at: t.passed_at, expires_at: t.expires_at, attempts: t.attempts }; }).sort((a, b) => a.module_trained - b.module_trained || a.display_name.localeCompare(b.display_name)));
  });

  // ---------- policy (public to all signed-in users) ----------
  router.get('/policy', authed, (req, res) => res.json({ policy: C.policy, code_of_conduct: C.code_of_conduct, helplines: C.helplines, help_options: C.help_options }));
  router.get('/helplines', (req, res) => res.json({ helplines: C.helplines, help_options: C.help_options }));
  router.get('/me', authed, (req, res) => {
    const u = req.user;
    const wards = u.role === 'guardian' && u.person_id ? sql('SELECT id, name FROM persons WHERE guardian_id=? AND deleted=0', u.person_id).map((w) => ({ id: w.id, name: w.name.split(' ')[0] })) : [];
    res.json({ case_access: isCase(u), staff: STAFF.includes(u.role), wards });
  });

  // Safety net: any held chat message that never reached the queue (lost event, process exit
  // before async dispatch) is enqueued. Idempotent via (source_module, ref_id).
  function reconcileHeld() {
    let rows = [];
    try { rows = sql("SELECT * FROM counselling_messages WHERE deleted=0 AND status='held'"); } catch (_) { return 0; }
    let n = 0;
    tx(() => {
      for (const m of rows) {
        if (data.find('safeguarding_moderation', { source_module: 'counselling', ref_id: m.id }).length) continue;
        const a = m.sender_id ? brain.users.get(m.sender_id) : null;
        enqueue({ source_module: 'counselling', source_type: 'message', ref_id: m.id, text: m.body, reasons: m.reasons, author_id: m.sender_id, author_role: m.sender_role, target_person_id: m.person_id, hamlet_id: m.hamlet_id, at: m.sent_at }, a);
        n++;
      }
    });
    return n;
  }
  setTimeout(() => { try { reconcileHeld(); } catch (e) { ctx.log('reconcile skipped:', e.message); } }, 1500).unref();

  // ---------- seed ----------
  async function seed(demo) {
    const { R, daysAgo, users } = demo;
    const t0 = Date.now();
    const cpo = users.cpo, steward = users.steward;
    const kids = demo.children.filter((c) => (Date.now() - new Date(c.dob)) / 3.15576e10 >= 11);
    const pick = (i) => kids[(i * 7) % kids.length];
    const CASES = [
      { d: 64, src: 'help_button', kind: 'bothering', cat: 'online_harassment', sev: 'medium', who: pick(1), text: 'Learner pressed Help: "Someone is bothering me". In their words: I keep getting messages from a number I don\'t know asking where I study.', status: 'closed', outcome: 'Number blocked with guardian; learner completed online-safety refresher. No further contact.', acts: [['contacted_guardian', 'Spoke with guardian in person at the centre. Guardian supportive.'], ['safety_plan', 'Helped family block and report the number. Learner knows to use the Help button again.']], ref: [] },
      { d: 41, src: 'staff_report', kind: 'concern', cat: 'bullying', sev: 'medium', who: pick(2), text: 'Facilitator noticed the learner sitting alone and upset after other children teased them about their language. Learner said it has happened several times on the school bus.', status: 'in_progress', acts: [['contacted_learner', 'Short, calm conversation with learner at the centre with facilitator present. Learner wants it to stop but is worried about being called a tattletale.'], ['meeting', 'Planned meeting with school headteacher (with guardian\'s agreement).']], ref: [], reporter: users.facilitator },
      { d: 23, src: 'help_button', kind: 'unsafe', cat: 'unsafe_in_community', sev: 'high', who: pick(3), text: 'Learner pressed Help: "I feel unsafe". In their words: an older boy keeps waiting near the path to the centre.', status: 'referred', acts: [['contacted_guardian', 'Guardian informed; agreed the learner will walk with siblings.'], ['referral', 'Referred to District Child Protection Unit for follow-up.']], ref: ['dcpu'] },
      { d: 9, src: 'moderation', kind: 'message', cat: 'boundary_breach', sev: 'medium', who: pick(4), text: 'Moderator review: a volunteer suggested continuing a conversation on a personal messaging app. Message was not delivered.', status: 'triaged', acts: [['note', 'Reminder of code of conduct sent to volunteer\'s agency lead; volunteer to repeat safeguarding training.']], ref: [] },
      { d: 3, src: 'help_button', kind: 'other', cat: 'wellbeing', sev: 'low', who: pick(5), text: 'Learner pressed Help: "Something else". In their words: exams are making me very worried and I cannot sleep.', status: 'new', acts: [], ref: [] },
      { d: 1, src: 'help_button', kind: 'bothering', cat: 'online_harassment', sev: 'medium', who: demo.demoYouth, text: 'Learner pressed Help: "Someone is bothering me". In their words: a "job agent" keeps calling and asking me to pay a registration fee.', status: 'new', acts: [], ref: [] },
    ];
    tx(() => {
      for (const c of CASES) {
        if (!c.who) continue;
        const at = daysAgo(c.d);
        const rep = c.reporter || (c.src === 'help_button' ? null : cpo);
        const row = openCase({ source: c.src, kind: c.kind, category: c.cat, severity: c.sev, person_id: c.who.id, hamlet_id: c.who.hamlet_id, description: c.text, reporter: rep, reporter_relation: c.src === 'help_button' ? 'self' : 'staff', at });
        let cur = data.put('safeguarding_cases', { ...row, reporter_role: c.src === 'help_button' ? (c.who.kind === 'youth' ? 'learner' : 'learner') : row.reporter_role });
        let day = c.d;
        if (c.status !== 'new') {
          day = Math.max(0, day - (c.sev === 'high' ? 0.1 : 0.6));
          cur = data.put('safeguarding_cases', { ...cur, status: 'triaged', triaged_at: daysAgo(day), assigned_to: cpo.id, assigned_name: cpo.display_name });
          logAction(cur, 'triaged', `Severity confirmed ${c.sev}. Assigned → ${cpo.display_name}`, cpo, { at: daysAgo(day) });
        }
        for (const [a, note] of c.acts) { day = Math.max(0, day - R.int(1, 4)); logAction(cur, a, note, R.chance(0.8) ? cpo : steward, { at: daysAgo(day) }); }
        const status = c.status;
        cur = data.put('safeguarding_cases', { ...cur, status, referrals: c.ref, outcome: c.outcome || null, closed_at: status === 'closed' ? daysAgo(Math.max(0, day - 2)) : null });
        if (status === 'closed') logAction(cur, 'closed', 'Outcome: ' + c.outcome, cpo, { at: daysAgo(Math.max(0, day - 2)) });
      }
      // training records for demo staff
      const staffRoles = ['facilitator', 'teacher', 'mentor', 'counsellor', 'coordinator'];
      for (const role of staffRoles) for (const u of brain.users.byRole(role)) {
        const ok = !(role === 'mentor' && u.username === 'demo.mentor.vinod');
        const d = R.int(15, 300);
        data.put('safeguarding_training', { user_id: u.id, agency_id: u.agency_id, role: u.role, display_name: u.display_name, course_version: C.course.version, score: ok ? R.int(5, 6) : 3, total: 6, passed: ok ? 1 : 0, completed_at: daysAgo(d), expires_at: ok ? new Date(Date.now() - d * 864e5 + TRAINING_VALID_DAYS * 864e5).toISOString() : null });
      }
    });
    reconcileHeld();
    ctx.log(`seeded safeguarding in ${Date.now() - t0}ms`);
  }

  return {
    seed,
    health: () => { const s = sqlOne("SELECT COUNT(*) n, SUM(status<>'closed') open FROM safeguarding_cases WHERE deleted=0"); return { cases: s.n, open: s.open || 0, held: sqlOne("SELECT COUNT(*) n FROM safeguarding_moderation WHERE deleted=0 AND status='held'").n }; },
    hold: (item, actor) => enqueue(item, actor),
    scan: filter.scan,
  };
};
