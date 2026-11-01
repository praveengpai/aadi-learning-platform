'use strict';
// Health & Elder Screening (module `health`, nav section `care`).
// ASHA workers / nurses capture readings offline at the weekly hub → a remote doctor reviews in the city →
// advice and a follow-up date come back on the next visit. Also simple geriatric screening.
// SCREENING AND REFERRAL SUPPORT ONLY — never a diagnosis. Emergencies: nearest health facility / 108.
//
// Built on the Brain's form round-trip engine: forms + rules (our sub-engine) + follow-ups + screens.
// Health data is a restricted consent scope: only health workers and doctors (and the audited platform
// steward) of an agency the person is enrolled with and consented to can read it.
const { FORMS } = require('./forms');
const { RULES, ADVICE, ADVICE_BY_KEY } = require('./rules');

const DISCLAIMER = {
  en: 'Screening and referral support only — not a diagnosis. In an emergency go to the nearest health facility or call 108 immediately.',
  ml: 'പരിശോധനയ്ക്കും റഫറലിനും മാത്രമുള്ള സഹായം — രോഗനിർണയമല്ല. അടിയന്തര സാഹചര്യത്തിൽ ഉടൻ അടുത്തുള്ള ആരോഗ്യ കേന്ദ്രത്തിൽ പോകുക അല്ലെങ്കിൽ 108 വിളിക്കുക.',
};
// Family-facing names for the forms: plain words, nothing that reveals a condition to a shared phone.
const FAMILY_TITLE = {
  'health.vitals': ['Health check', 'ആരോഗ്യ പരിശോധന'],
  'health.child_growth': ['Child health check', 'കുട്ടിയുടെ ആരോഗ്യ പരിശോധന'],
  'health.antenatal': ['Health check', 'ആരോഗ്യ പരിശോധന'],
  'health.elder_screen': ['Health check', 'ആരോഗ്യ പരിശോധന'],
};
const STAFF = ['health_worker', 'doctor', 'platform_admin'];
const FAMILY = ['learner', 'guardian'];
const DAY = 86400e3;

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError } = ctx;
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY).toISOString().slice(0, 10);

  // ---------------- forms + rules (at start-up, so every node has them) ----------------
  for (const def of FORMS) {
    brain.forms.define(def, null);
    brain.forms.rule(def.key, RULES[def.key]);
  }
  const FORM_KEYS = FORMS.map((f) => f.key);

  // ---------------- access helpers ----------------
  const inArea = (user, hamletId) => user.role === 'platform_admin' || !Array.isArray(user.hamlet_ids) || !user.hamlet_ids.length || user.hamlet_ids.includes(hamletId);
  // Staff access to one person's health record: restricted scope + enrolment + consent + the worker's own hamlets.
  function staffSee(user, personId) {
    if (!STAFF.includes(user.role)) throw httpError(403, 'Health records are only for health workers and doctors.');
    const v = brain.policy.canSee(user, personId, 'health');
    if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
    const p = brain.persons.basic(personId);
    if (!p) throw httpError(404, 'Person not found');
    if (!inArea(user, p.hamlet_id)) throw httpError(403, 'Not permitted: this person lives outside your hamlets.');
    if (v.audited) brain.audit(user, 'health_read', personId, {});
    return p;
  }
  // The person themself, or a guardian of their ward.
  function familySee(user, personId) {
    if (!FAMILY.includes(user.role)) return false;
    if (user.person_id === personId) return true;
    const p = brain.persons.basic(personId);
    return !!(user.role === 'guardian' && p && p.guardian_id === user.person_id);
  }
  // Wards are found without reading `persons` directly (not a privileged module): via the policy engine.
  const wardsOf = (user) => (user.role === 'guardian' ? brain.persons.visible(user, { limit: 50 }).filter((p) => p.guardian_id === user.person_id).map((p) => p.id) : []);

  const followupView = (f) => {
    const p = brain.persons.basic(f.person_id);
    const h = brain.hamlets.get(f.hamlet_id);
    return { ...f, person: p && { id: p.id, name: p.name, age: p.age, gender: p.gender, kind: p.kind }, hamlet: h && h.name, hamlet_ml: h && h.name_ml, overdue: f.status === 'open' && f.due < today() };
  };
  // Open follow-ups this user may act on.
  function followupsFor(user, { status = 'open', person_id = null, hamlet_id = null } = {}) {
    let q = 'SELECT * FROM health_followups WHERE deleted=0';
    const prm = [];
    if (status) { q += ' AND status=?'; prm.push(status); }
    if (person_id) { q += ' AND person_id=?'; prm.push(person_id); }
    if (hamlet_id) { q += ' AND hamlet_id=?'; prm.push(hamlet_id); }
    if (user.role !== 'platform_admin') { q += ' AND agency_id=?'; prm.push(user.agency_id || '-'); }
    q += ' ORDER BY due LIMIT 2000';
    return sql(q, ...prm).filter((f) => inArea(user, f.hamlet_id) && brain.policy.canSee(user, f.person_id, 'health').ok);
  }
  // Doctor-facing / worker-facing submission (full answers; photos stripped in lists by the engine).
  const subView = (s) => ({ id: s.id, form_key: s.form_key, form_title: s.form_title, form_title_ml: s.form_title_ml, person: s.person, person_id: s.person_id, hamlet_id: s.hamlet_id, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml, captured_at: s.captured_at, captured_by_name: s.captured_by_name, status: s.status, priority: s.priority, flags: s.flags, answers: s.answers, reply: s.reply, reply_ml: s.reply_ml, replied_at: s.replied_at, replied_by_name: s.replied_by_name, reply_seen_at: s.reply_seen_at, outcome: s.outcome });
  // Family-facing: only the doctor's words, in plain language. No readings, flags or clinical terms.
  const familyView = (s, fu) => ({ id: s.id, title: (FAMILY_TITLE[s.form_key] || FAMILY_TITLE['health.vitals'])[0], title_ml: (FAMILY_TITLE[s.form_key] || FAMILY_TITLE['health.vitals'])[1], person_id: s.person_id, person_name: s.person && s.person.name, checked_on: String(s.captured_at || '').slice(0, 10), reply: s.reply || null, reply_ml: s.reply_ml || null, replied_on: s.replied_at ? String(s.replied_at).slice(0, 10) : null, next_visit: fu ? fu.due : null, waiting: !s.reply });

  // Submission ids replied through this module (notify:false) — the subscriber below can skip them.
  const quiet = new Set();
  const replyQuiet = (user, id, args) => { quiet.add(id); try { return brain.forms.reply(user, id, { ...args, notify: false }); } catch (e) { quiet.delete(id); throw e; } };

  // ---------------- routes ----------------
  // Static: forms, advice templates and the disclaimer (for screens and offline cache).
  router.get('/meta', authed, (req, res) => {
    const staff = STAFF.includes(req.user.role);
    res.json({ disclaimer: DISCLAIMER, forms: staff ? FORM_KEYS.map((k) => { const d = brain.forms.get(k); return { key: k, title: d.title, title_ml: d.title_ml, description: d.description, can_capture: brain.forms.canCapture(req.user, k) }; }) : [], advice: req.user.role === 'doctor' || req.user.role === 'platform_admin' ? ADVICE : [] });
  });

  // ASHA home: who to see today — due follow-ups, replies to pass on, my recent captures.
  router.get('/home', requires('health.capture'), (req, res) => {
    const u = req.user;
    const fus = followupsFor(u).map(followupView);
    const soon = addDays(today(), 7);
    const subs = brain.forms.list(u, { limit: 500 }).filter((s) => inArea(u, s.hamlet_id));
    const toTell = subs.filter((s) => s.reply && !s.reply_seen_at).map(subView);
    const waiting = subs.filter((s) => ['submitted', 'in_review'].includes(s.status)).length;
    const hamlets = (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length ? u.hamlet_ids : []).map((id) => { const h = brain.hamlets.get(id); return h && { id, name: h.name, name_ml: h.name_ml, enabled: brain.modules.enabledIn(id) }; }).filter(Boolean);
    res.json({
      disclaimer: DISCLAIMER, hamlets,
      due: fus.filter((f) => f.due <= soon), later: fus.filter((f) => f.due > soon).length,
      to_tell: toTell, waiting_for_doctor: waiting,
      recent: subs.slice(0, 10).map(subView),
    });
  });

  // People this worker may screen (health consent + own hamlets), with their last check and open follow-ups.
  router.get('/people', requires('health.capture', 'health.review'), (req, res) => {
    const u = req.user;
    const people = brain.persons.visible(u, { hamlet_id: req.query.hamlet_id || null, q: req.query.q || null, limit: 500 }).filter((p) => inArea(u, p.hamlet_id) && brain.policy.canSee(u, p.id, 'health').ok);
    const last = new Map();
    for (const s of brain.forms.list(u, { limit: 1000 })) if (!last.has(s.person_id)) last.set(s.person_id, s);
    const open = new Map();
    for (const f of followupsFor(u)) if (!open.has(f.person_id) || f.due < open.get(f.person_id)) open.set(f.person_id, f.due);
    res.json(people.slice(0, 300).map((p) => ({ id: p.id, name: p.name, age: p.age, gender: p.gender, kind: p.kind, hamlet_id: p.hamlet_id, last_check: last.get(p.id) ? String(last.get(p.id).captured_at).slice(0, 10) : null, last_priority: last.get(p.id) ? last.get(p.id).priority : null, next_due: open.get(p.id) || null, suggest: suggestForms(p) })));
  });
  function suggestForms(p) {
    const out = ['health.vitals'];
    if (p.age !== null && p.age < 6) out.push('health.child_growth');
    if (p.gender === 'F' && p.age !== null && p.age >= 15 && p.age <= 49) out.push('health.antenatal');
    if (p.age !== null && p.age >= 60) out.push('health.elder_screen');
    return out;
  }

  // One person's health record. Staff: full timeline. The person / guardian: the family view only.
  router.get('/person/:id', authed, (req, res) => {
    const u = req.user;
    const pid = req.params.id;
    if (FAMILY.includes(u.role)) {
      if (!familySee(u, pid)) throw httpError(403, 'You can only see your own record (or your child\'s).');
      return res.json(familyRecord(u, [pid]));
    }
    const p = staffSee(u, pid);
    const subs = brain.forms.list(u, { person_id: pid, limit: 200 }).map(subView);
    const fus = followupsFor(u, { status: null, person_id: pid }).map(followupView);
    res.json({ person: p, disclaimer: DISCLAIMER, submissions: subs, followups: fus, suggest: suggestForms(p) });
  });

  // One submission with photo (full record) for staff.
  router.get('/submissions/:id', requires('health.capture', 'health.review'), (req, res) => {
    const s = brain.forms.one(req.user, req.params.id);
    if (s.person_id) staffSee(req.user, s.person_id);
    res.json({ ...subView(s), answers: s.answers, form: s.form, can_reply: s.can_reply, followups: followupsFor(req.user, { status: null }).filter((f) => f.submission_id === s.id).map(followupView), advice: s.can_reply ? ADVICE : [] });
  });

  // Doctor queue: open items, urgent first (the engine orders by priority, then newest).
  router.get('/queue', requires('health.review'), (req, res) => {
    const rows = brain.forms.queue(req.user, { hamlet_id: req.query.hamlet_id || null }).filter((s) => inArea(req.user, s.hamlet_id)).map(subView);
    rows.sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(a.captured_at).localeCompare(String(b.captured_at)));
    res.json({ disclaimer: DISCLAIMER, advice: ADVICE, items: rows, counts: { urgent: rows.filter((r) => r.priority >= 3).length, high: rows.filter((r) => r.priority === 2).length, total: rows.length } });
  });

  // Doctor reply: wraps the engine's reply, adds a follow-up and a neutral notification.
  router.post('/submissions/:id/reply', requires('health.review'), (req, res) => {
    const u = req.user;
    const b = req.body || {};
    const tpl = b.advice_template ? ADVICE_BY_KEY[b.advice_template] : null;
    if (b.advice_template && !tpl) throw httpError(400, 'Unknown advice template.');
    const text = String(b.reply || '').trim() || (tpl ? tpl.text : '');
    const textMl = String(b.reply_ml || '').trim() || (tpl && !String(b.reply || '').trim() ? tpl.text_ml : '') || null;
    if (text.length < 2) throw httpError(400, 'Write a reply or choose an advice template.');
    let weeks = b.follow_up_weeks === undefined || b.follow_up_weeks === null || b.follow_up_weeks === '' ? (tpl ? tpl.follow_up : 0) : Number(b.follow_up_weeks);
    if (!Number.isFinite(weeks) || weeks < 0 || weeks > 52) throw httpError(400, 'Follow-up must be 0–52 weeks.');
    weeks = Math.round(weeks);
    const s0 = brain.forms.one(u, req.params.id); // policy check (403/404)
    if (s0.person_id) staffSee(u, s0.person_id);
    const out = tx(() => {
      const row = replyQuiet(u, req.params.id, { reply: text, reply_ml: textMl, outcome: b.outcome || (tpl ? tpl.key : null), close: !!b.close });
      let fu = null;
      if (weeks > 0 && row.person_id) {
        // one open follow-up per submission: replace on a second reply
        for (const old of data.find('health_followups', { submission_id: row.id, status: 'open' })) data.put('health_followups', { ...old, status: 'superseded' }, u);
        fu = data.put('health_followups', { person_id: row.person_id, hamlet_id: row.hamlet_id, agency_id: row.agency_id, due: addDays(today(), weeks * 7), reason: String(b.reason || (tpl ? tpl.reason : 'Doctor follow-up')).slice(0, 300), reason_ml: b.reason_ml || (tpl ? tpl.reason_ml : 'ഡോക്ടറുടെ തുടർപരിശോധന'), status: 'open', submission_id: row.id, advice_template: tpl ? tpl.key : null, created_by: u.id }, u);
        emit('health.followup_created', { id: fu.id, submission_id: row.id, weeks }, u, row.hamlet_id);
      }
      // Neutral message only — the engine's default names the form (e.g. "Pregnancy check"), which is sensitive.
      if (row.person_id) brain.notify(row.person_id, NEUTRAL(), { channel: 'auto' }, u);
      return { ...row, followup: fu };
    });
    res.json(out);
  });

  // ASHA marks a follow-up done (visited / rechecked) — optionally with a short note.
  router.post('/followups/:id/done', requires('health.capture', 'health.review'), (req, res) => {
    const f = data.get('health_followups', req.params.id);
    if (!f) throw httpError(404, 'Not found');
    staffSee(req.user, f.person_id);
    if (req.user.role !== 'platform_admin' && f.agency_id !== req.user.agency_id) throw httpError(403, 'Not permitted.');
    if (f.status !== 'open') return res.json(f);
    const row = data.put('health_followups', { ...f, status: 'done', done_at: new Date().toISOString(), done_by: req.user.id, note: req.body && req.body.note ? String(req.body.note).slice(0, 500) : null }, req.user);
    emit('health.followup_done', { id: f.id }, req.user, f.hamlet_id);
    res.json(row);
  });

  // Family view: the person themself (learner/youth/adult account) or a guardian with wards.
  function familyRecord(user, ids) {
    const out = [];
    for (const pid of ids) {
      const subs = brain.forms.list(user, { person_id: pid, limit: 100 });
      const fus = sql('SELECT * FROM health_followups WHERE deleted=0 AND person_id=? AND status=\'open\' ORDER BY due', pid);
      const b = brain.persons.basic(pid);
      out.push({ person_id: pid, name: b ? b.name : '', items: subs.map((s) => familyView(s, fus.find((f) => f.submission_id === s.id))) });
    }
    return { disclaimer: DISCLAIMER, people: out };
  }
  router.get('/family', authed, (req, res) => {
    const u = req.user;
    if (!FAMILY.includes(u.role) || !u.person_id) throw httpError(403, 'This page is for a person and their family.');
    res.json(familyRecord(u, [u.person_id, ...wardsOf(u)]));
  });

  // Aggregate view (donors, govt, admins): counts only, k-anonymised, no person-level data.
  router.get('/aggregate', requires('analytics.aggregate', 'health.capture', 'health.review'), (req, res) => {
    const u = req.user;
    const allAgencies = ['platform_admin', 'donor', 'govt_viewer'].includes(u.role);
    const since = new Date(Date.now() - (Number(req.query.days) || 180) * DAY).toISOString();
    const rows = sql(`SELECT hamlet_id, form_key, person_id, priority, flags, status, agency_id FROM form_submissions WHERE deleted=0 AND module='health' AND captured_at>=?${allAgencies ? '' : ' AND agency_id=?'}`, since, ...(allAgencies ? [] : [u.agency_id || '-']));
    const priv = ['platform_admin', 'agency_admin', 'coordinator', 'cpo'].includes(u.role);
    const sup = (n) => brain.policy.suppress(n, u);
    // a percentage of a group smaller than k could single people out → hidden for external viewers
    const pct = (a, n) => (n === 0 || (!priv && n < 5) ? null : Math.round((a / n) * 100));
    const by = new Map();
    for (const r of rows) {
      if (!by.has(r.hamlet_id)) by.set(r.hamlet_id, { people: new Set(), flagged: new Set(), urgent: new Set(), checks: 0, forms: {} });
      const g = by.get(r.hamlet_id);
      g.checks++;
      g.people.add(r.person_id);
      if ((Array.isArray(r.flags) && r.flags.some((f) => f.level !== 'info')) || r.priority >= 1) g.flagged.add(r.person_id);
      if (r.priority >= 3) g.urgent.add(r.person_id);
      g.forms[r.form_key] = (g.forms[r.form_key] || 0) + 1;
    }
    const hamlets = [];
    const tot = { people: new Set(), flagged: new Set(), urgent: new Set(), checks: 0, forms: {} };
    for (const [hid, g] of by) {
      const h = brain.hamlets.get(hid);
      for (const x of g.people) tot.people.add(x);
      for (const x of g.flagged) tot.flagged.add(x);
      for (const x of g.urgent) tot.urgent.add(x);
      tot.checks += g.checks;
      for (const [k, v] of Object.entries(g.forms)) tot.forms[k] = (tot.forms[k] || 0) + v;
      hamlets.push({ hamlet_id: hid, hamlet: h ? h.name : '', hamlet_ml: h ? h.name_ml : '', people_screened: sup(g.people.size), checks: sup(g.checks), flagged: sup(g.flagged.size), urgent: sup(g.urgent.size), pct_flagged: pct(g.flagged.size, g.people.size), by_form: Object.fromEntries(FORM_KEYS.map((k) => [k, sup(g.forms[k] || 0)])) });
    }
    hamlets.sort((a, b) => String(a.hamlet).localeCompare(String(b.hamlet)));
    const fuDone = sqlOne(`SELECT COUNT(*) n, SUM(status='done') d FROM health_followups WHERE deleted=0 AND status IN ('open','done')${allAgencies ? '' : ' AND agency_id=?'}`, ...(allAgencies ? [] : [u.agency_id || '-']));
    res.json({
      disclaimer: DISCLAIMER, since: since.slice(0, 10), k_anon: 5,
      totals: { people_screened: sup(tot.people.size), checks: sup(tot.checks), flagged: sup(tot.flagged.size), urgent: sup(tot.urgent.size), pct_flagged: pct(tot.flagged.size, tot.people.size), followups: sup(fuDone.n || 0), followups_done: sup(fuDone.d || 0), by_form: Object.fromEntries(FORM_KEYS.map((k) => [k, sup(tot.forms[k] || 0)])) },
      hamlets,
      note: 'Counts of people and checks only. Numbers under 5 are hidden so no family can be identified.',
    });
  });

  // The engine's default reply notification names the form ("a reply to \"Pregnancy check\" …"), which is
  // sensitive on a shared phone. When a doctor replies through the generic core route, withdraw that
  // message before the channels module sends it and queue a neutral one instead. (Brain request filed.)
  const NEUTRAL = () => `${brain.brand.short}: a message from the health team is waiting for you. Please visit the centre on the next visit day.`;
  ctx.on('forms.replied', (ev) => {
    const pl = ev.payload || {};
    if (pl.module !== 'health' || quiet.delete(pl.id)) return; // our own replies never queue the engine's message
    const s = sqlOne('SELECT person_id FROM form_submissions WHERE id=?', pl.id);
    if (!s || !s.person_id) return;
    let hit = false;
    for (const n of brain.notifications.queued(1000)) {
      if (n.person_id === s.person_id && /a reply to "/.test(n.message || '')) { brain.notifications.setStatus(n.id, 'withdrawn'); hit = true; }
    }
    if (hit) brain.notify(s.person_id, NEUTRAL(), { channel: 'auto' }, null);
  });

  // ---------------- seed ----------------
  async function seed(demo) {
    const t0 = Date.now();
    const { store, daysAgo } = demo;
    const B = demo.brain;
    const R = demo.rng(9301); // own random stream — never demo.R
    const H = demo.hamletByKey;
    const hamletIds = [H.h1, H.h2, H.h11].filter(Boolean).map((h) => h.id);
    const dob = (age) => new Date(Date.now() - (age * 365.25 + R.int(0, 300)) * DAY).toISOString().slice(0, 10);
    const MN = ['Velayudhan', 'Kunjan', 'Chathan', 'Karuppan', 'Mayilan', 'Kandan', 'Raman'];
    const FN = ['Kali', 'Chiruthai', 'Neeli', 'Kurumbi', 'Mala', 'Kunjamma', 'Karthu'];
    const KID = ['Ammu', 'Kannan', 'Chinnu', 'Unni', 'Malu', 'Appu', 'Thumbi', 'Kuttan'];
    let ctx2;
    tx(() => {
      const ag = store.put('agencies', { name: 'Demo Primary Health Centre (fictional, NHM)', type: 'govt', steward: 0, status: 'active', colour: '#c62828', contact: 'demo@example.org', about: 'Fictional Primary Health Centre under the National Health Mission. ASHA workers visit with the weekly hub; a PHC doctor reviews readings remotely.' });
      const progs = [];
      for (const hid of hamletIds) {
        store.put('agency_presence', { agency_id: ag.id, hamlet_id: hid, services: ['health', 'elder_care'], since: daysAgo(R.int(120, 400)).slice(0, 10), status: 'active' });
        const c = store.put('centres', { hamlet_id: hid, agency_id: ag.id, name: 'ASHA visit point — ' + B.store.get('hamlets', hid).name, kind: 'centre', hub_status: 'n/a', devices: 1, last_sync: daysAgo(R.int(0, 6)) });
        progs.push(store.put('programmes', { agency_id: ag.id, hamlet_id: hid, centre_id: c.id, module: 'health', track: 'health', title: 'Weekly health visit (ASHA)', title_ml: 'ആഴ്ചതോറുമുള്ള ആരോഗ്യ സന്ദർശനം (ആശ)', schedule: ['Wed 10:00'], capacity: 200, status: 'active' }));
        progs.push(store.put('programmes', { agency_id: ag.id, hamlet_id: hid, centre_id: c.id, module: 'health', track: 'elder_care', title: 'Elder care screening', title_ml: 'വയോജന പരിചരണ പരിശോധന', schedule: ['Wed 14:00'], capacity: 80, status: 'active' }));
      }
      // Fictional elders and toddlers (the core demo has no one over 52 or under 6): grandparents and
      // young children in existing demo households.
      const extra = [];
      for (const hid of hamletIds) {
        // never attach new people to the demo learner's family (keeps other modules' demo stable)
        const hhs = demo.households.filter((x) => x.hamlet_id === hid && x.id !== demo.demoLearner.household_id && x.head_person_id !== demo.demoGuardian.id);
        const nEld = hid === (H.h2 && H.h2.id) ? 2 : R.int(5, 7);
        for (let i = 0; i < nEld; i++) {
          const g = R.chance(0.55) ? 'F' : 'M';
          const hh = R.pick(hhs);
          extra.push(store.put('persons', { hamlet_id: hid, name: `${R.pick(g === 'F' ? FN : MN)} ${R.pick(['K', 'M', 'C', 'V'])}`, gender: g, dob: dob(R.int(61, 84)), kind: 'adult', language: 'Malayalam', literacy_level: 'none', household_id: hh ? hh.id : null, notes: 'Fictional demo elder (health module)' }));
        }
        const nKid = hid === (H.h2 && H.h2.id) ? 1 : R.int(3, 4);
        for (let i = 0; i < nKid; i++) {
          const hh = R.pick(hhs);
          const g = R.chance(0.5) ? 'F' : 'M';
          extra.push(store.put('persons', { hamlet_id: hid, name: `${R.pick(KID)} ${R.pick(['K', 'M', 'R', 'S'])}`, gender: g, dob: new Date(Date.now() - R.int(8, 52) * 30.4 * DAY).toISOString().slice(0, 10), kind: 'child', language: 'Malayalam', guardian_id: hh ? hh.head_person_id : null, relation: 'mother', household_id: hh ? hh.id : null, notes: 'Fictional demo toddler (health module)' }));
        }
      }
      ctx2 = { ag, progs, extra };
    });
    const { ag, progs, extra } = ctx2;
    const P = B.policy;
    const isMinor = (p) => P.isMinor(p);
    // Consent (merge scopes with any earlier consent to this agency) + enrolment.
    const people = [];
    tx(() => {
      const pool = [...demo.persons.filter((p) => hamletIds.includes(p.hamlet_id)), ...extra];
      for (const p of pool) {
        const fresh = store.get('persons', p.id);
        const age = fresh.dob ? (Date.now() - new Date(fresh.dob)) / 3.15576e10 : 30;
        const want = age >= 60 || age < 6 ? 0.9 : fresh.kind === 'adult' ? 0.55 : 0.3;
        const forced = fresh.id === demo.demoLearner.id || fresh.id === demo.demoGuardian.id; // family-view demo
        if (!forced && fresh.hamlet_id === (H.h2 && H.h2.id) && !(age >= 60 || age < 6) && people.filter((x) => x.hamlet_id === fresh.hamlet_id).length >= 1) continue; // Thenmala: a small pilot (shows k-anonymity)
        if (!forced && !R.chance(want)) continue;
        const minor = isMinor(fresh);
        const by = minor ? fresh.guardian_id : fresh.id;
        if (minor && !by) continue;
        const cur = store.find('consents', { person_id: fresh.id, agency_id: ag.id, status: 'active' })[0];
        const scopes = [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : []), 'profile', 'health', 'contact'])];
        const c = B.grantConsent({ person_id: fresh.id, agency_id: ag.id, scopes, granted_by: by, relation: minor ? (fresh.relation || 'guardian') : 'self', method: 'in_person' }, null);
        store.put('consents', { ...c, granted_at: daysAgo(R.int(95, 200)) });
        const track = age >= 60 ? 'elder_care' : 'health';
        const pr = progs.find((x) => x.hamlet_id === fresh.hamlet_id && x.track === track);
        B.enrol(fresh.id, pr.id, null);
        people.push({ ...fresh, age });
      }
    });

    // Staff accounts.
    const mk = (key, role, display_name, extraU = {}) => B.createUser({ username: 'demo.' + key, password: demo.DEMO_PASSWORD, role, display_name, safeguarding_trained: 1, agency_id: ag.id, ...extraU }, null);
    const U = {};
    tx(() => {
      U.asha = mk('asha', 'health_worker', 'Leela — ASHA, Pachakkudi (PHC)', { hamlet_ids: [H.h1.id] });
      if (H.h11) U.ashaK = mk('asha.komalikudi', 'health_worker', 'Ponni — ASHA, Komalikudi (PHC)', { hamlet_ids: [H.h11.id] });
      U.nurse = mk('nurse', 'health_worker', 'Sister Mercy — JPHN, Thenmala (PHC)', { hamlet_ids: [H.h2.id] });
      U.doctor = mk('doctor', 'doctor', 'Dr. Asha Menon — PHC Medical Officer (fictional)');
      U.admin = mk('phc.admin', 'agency_admin', 'PHC Health Programme Admin (fictional)');
    });
    for (const k of Object.keys(U)) U[k] = store.get('users', U[k].id);
    demo.users['asha'] = U.asha; demo.users['asha.komalikudi'] = U.ashaK; demo.users['doctor'] = U.doctor; demo.users['phc.admin'] = U.admin; demo.users['nurse'] = U.nurse;
    demo.healthAgency = ag;

    // ~3 months of history: weekly visits; the doctor replied to most of what is older than a week.
    const workerFor = (hid) => (hid === H.h1.id ? U.asha : H.h11 && hid === H.h11.id ? U.ashaK : U.nurse);
    const at = (d) => { const x = new Date(Date.now() - d * DAY); x.setUTCHours(R.int(4, 9), R.int(0, 59), 0, 0); return x.toISOString(); };
    const vitalsAnswers = (p) => {
      const old = p.age >= 60;
      const hyper = R.chance(old ? 0.35 : 0.12);
      const sys = hyper ? R.int(142, R.chance(0.15) ? 196 : 168) : R.int(104, 134);
      const a = { bp_sys: sys, bp_dia: hyper ? R.int(88, sys > 180 ? 114 : 102) : R.int(64, 86), pulse: R.int(64, 98), temp_c: R.chance(0.12) ? 38.2 + R.int(0, 14) / 10 : 36.4 + R.int(0, 6) / 10, weight_kg: R.int(old ? 38 : 42, 68), height_cm: R.int(145, 170) };
      if (R.chance(0.5)) { a.sugar_type = R.chance(0.4) ? 'fasting' : 'random'; a.sugar = R.chance(0.15) ? R.int(a.sugar_type === 'fasting' ? 128 : 205, 290) : R.chance(0.03) ? R.int(60, 68) : R.int(82, a.sugar_type === 'fasting' ? 118 : 160); }
      const sym = [];
      if (R.chance(0.15)) sym.push('fever');
      if (R.chance(0.07)) sym.push('cough_2w');
      if (R.chance(0.1)) sym.push(R.pick(['headache', 'dizziness', 'swelling', 'wound', 'diarrhoea']));
      if (R.chance(0.03)) sym.push('chest_pain');
      if (sym.length) a.symptoms = sym;
      if (R.chance(0.2)) a.notes = R.pick(['Takes BP tablets irregularly.', 'Says tired for two weeks.', 'Walked 3 km to the hub today.', 'Asked about free spectacles.']);
      return a;
    };
    const elderAnswers = () => {
      const falls = R.pick(['0', '0', '0', '1', '1', '2plus']);
      const help = R.chance(0.3) ? R.sample(['bathing', 'dressing', 'toilet', 'walking'], R.int(1, 2)) : ['none'];
      return { falls, fear_falling: falls !== '0' && R.chance(0.6) ? 'yes' : 'no', vision: R.chance(0.5) ? 'yes' : 'no', hearing: R.chance(0.3) ? 'yes' : 'no', memory_trouble: R.chance(0.25) ? 'yes' : 'no', recall: R.pick([3, 3, 2, 2, 2, 1, 0]), phq_interest: String(R.pick([0, 0, 0, 1, 1, 2, 3])), phq_mood: String(R.pick([0, 0, 0, 1, 1, 2, 3])), weight_loss: R.chance(0.2) ? 'yes' : 'no', adl_help: help, medicines: R.pick([0, 1, 2, 2, 3, 4, 5, 6]), pension: R.chance(0.7) ? 'yes' : 'no', lives_alone: R.chance(0.2) ? 'yes' : 'no' };
    };
    const childAnswers = (p) => {
      const months = Math.max(6, Math.round(p.age * 12));
      const r = R.rnd();
      const muac = r < 0.1 ? 10.8 + R.int(0, 6) / 10 : r < 0.3 ? 11.6 + R.int(0, 8) / 10 : 12.6 + R.int(0, 22) / 10;
      return { age_months: months, weight_kg: Math.round((3 + months * 0.2 + R.int(-10, 10) / 10) * 10) / 10, height_cm: Math.round(50 + months * 0.95), muac_cm: Math.round(muac * 10) / 10, oedema: R.chance(0.03) ? 'yes' : 'no', eating_well: R.chance(0.85) ? 'yes' : 'no' };
    };
    const ancAnswers = (wk) => {
      const signs = R.chance(0.15) ? [R.pick(['headache_vision', 'reduced_movement', 'fever', 'face_swelling'])] : [];
      return { weeks: wk, bp_sys: R.chance(0.2) ? R.int(140, 152) : R.int(100, 128), bp_dia: R.chance(0.2) ? R.int(90, 98) : R.int(62, 84), hb: R.chance(0.7) ? Math.round((R.int(84, 124) / 10) * 10) / 10 : undefined, danger_signs: signs.length ? signs : undefined, anc_visits: Math.max(0, Math.floor(wk / 8) - R.int(0, 1)) };
    };
    const pickAdvice = (s) => {
      const codes = (s.flags || []).map((f) => f.code);
      if (s.form_key === 'health.antenatal') return s.priority >= 3 ? 'anc_hospital' : 'anc_visit';
      if (s.form_key === 'health.child_growth') return codes.includes('muac_sam') || codes.includes('bilateral_oedema') ? 'child_refer' : codes.length ? 'child_feed' : 'routine_ok';
      if (s.form_key === 'health.elder_screen') return codes.includes('falls_risk') ? 'elder_falls' : codes.includes('mood_check') || codes.includes('memory_check') ? 'elder_talk' : codes.includes('polypharmacy') ? 'medicines_review' : codes.includes('pension_check') ? 'pension_help' : 'routine_ok';
      if (codes.includes('bp_very_high') || codes.includes('chest_pain') || codes.includes('sugar_low') || codes.includes('sugar_very_high')) return 'hospital_today';
      if (codes.includes('cough_2w')) return 'tb_test';
      if (codes.some((c) => c.startsWith('sugar'))) return 'sugar_repeat';
      if (codes.includes('bp_high')) return 'recheck_bp';
      if (codes.length) return 'see_phc_week';
      return 'routine_ok';
    };
    let nSub = 0, nRep = 0, nFu = 0;
    tx(() => {
      const pregnant = people.filter((p) => p.gender === 'F' && p.age >= 18 && p.age <= 40).slice(0, 4);
      const pregWeeks = new Map(pregnant.map((p) => [p.id, R.int(14, 32)]));
      for (const p of people) {
        const w = workerFor(p.hamlet_id);
        const visits = p.age >= 60 ? R.int(2, 4) : p.age < 6 ? R.int(2, 3) : R.int(1, 2);
        const days = R.sample([84, 77, 70, 63, 56, 49, 42, 35, 28, 21, 14, 7, 3, 1], visits).sort((a, b) => b - a);
        for (const d of days) {
          const jobs = [];
          if (p.age < 6) jobs.push(['health.child_growth', childAnswers(p)]);
          else jobs.push(['health.vitals', vitalsAnswers(p)]);
          if (p.age >= 60 && d === days[0]) jobs.push(['health.elder_screen', elderAnswers()]);
          if (pregWeeks.has(p.id)) jobs.push(['health.antenatal', ancAnswers(Math.min(40, pregWeeks.get(p.id) + Math.round((84 - d) / 7)))]);
          for (const [key, answers] of jobs) {
            const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== undefined));
            const s = B.forms.submit(w, { form_key: key, person_id: p.id, answers: clean, client_ref: `seed-health-${p.id}-${key}-${d}` }, {});
            const cap = at(d);
            let row = store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: cap });
            nSub++;
            // The doctor has answered almost everything older than 6 days; urgent ones within a day.
            if (d > 6 || (row.priority >= 3 && d > 1 && R.chance(0.6))) {
              const key2 = pickAdvice(row);
              const tpl = ADVICE_BY_KEY[key2];
              replyQuiet(U.doctor, row.id, { reply: tpl.text, reply_ml: tpl.text_ml, outcome: key2 });
              const repAt = new Date(new Date(cap).getTime() + R.int(1, Math.min(5, Math.max(1, d - 1))) * DAY).toISOString();
              row = store.put('form_submissions', { ...store.get('form_submissions', row.id), replied_at: repAt, reply_seen_at: d > 13 && R.chance(0.85) ? new Date(new Date(repAt).getTime() + 7 * DAY).toISOString() : null });
              nRep++;
              if (key2 !== 'routine_ok' || R.chance(0.3)) {
                const due = new Date(new Date(repAt).getTime() + tpl.follow_up * 7 * DAY).toISOString().slice(0, 10);
                const done = due < today() && R.chance(0.7);
                data.put('health_followups', { person_id: p.id, hamlet_id: p.hamlet_id, agency_id: ag.id, due, reason: tpl.reason, reason_ml: tpl.reason_ml, status: done ? 'done' : 'open', submission_id: row.id, advice_template: tpl.key, created_by: U.doctor.id, done_at: done ? new Date(new Date(due).getTime() + R.int(0, 3) * DAY).toISOString() : null, done_by: done ? w.id : null }, U.doctor);
                nFu++;
              }
            }
          }
        }
      }
    });
    // Two fresh, unanswered urgent cases so the doctor's queue shows "urgent first" in a demo.
    tx(() => {
      const elder = people.find((p) => p.hamlet_id === H.h1.id && p.age >= 60);
      if (elder) { const s = B.forms.submit(U.asha, { form_key: 'health.vitals', person_id: elder.id, answers: { bp_sys: 186, bp_dia: 112, pulse: 92, temp_c: 36.8, symptoms: ['headache', 'dizziness'], notes: 'Rechecked after 5 minutes rest: 184/110. Has not taken BP tablets for a week.' }, client_ref: 'seed-health-urgent-bp' }, {}); store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: at(1) }); nSub++; }
      const kid = H.h11 && people.find((p) => p.hamlet_id === H.h11.id && p.age < 5 && p.age >= 0.5);
      if (kid) { const s = B.forms.submit(U.ashaK, { form_key: 'health.child_growth', person_id: kid.id, answers: { age_months: Math.max(6, Math.round(kid.age * 12)), weight_kg: 7.1, height_cm: 74, muac_cm: 11.2, oedema: 'no', eating_well: 'no' }, client_ref: 'seed-health-urgent-muac' }, {}); store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: at(2) }); nSub++; }
    });
    ctx.log(`seeded health: ${people.length} consented people, ${nSub} checks, ${nRep} doctor replies, ${nFu} follow-ups in ${Date.now() - t0}ms`);
  }

  return {
    seed,
    health: () => ({ forms: FORM_KEYS.length, followups_open: sqlOne('SELECT COUNT(*) n FROM health_followups WHERE deleted=0 AND status=\'open\'').n }),
  };
};
