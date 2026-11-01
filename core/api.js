'use strict';
// Core REST API: /api/core/*
const express = require('express');

const TRACKS = ['tuition', 'exams', 'language', 'lifeskills', 'counselling', 'literacy', 'digital'];

module.exports = function coreApi(brain, host) {
  const r = express.Router();
  const { store, policy } = brain;
  const A = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.code || 'error', message: e.status ? e.message : 'Internal error' }); if (!e.status) console.error(e); }
  };
  const need = brain.requires;
  // Registry writes: never trust id/node/deleted/agency from the body. An update must target a row
  // the user's own agency owns (platform stewards excepted).
  const SYS = ['id', 'node', 'updated_at', 'deleted', 'agency_id'];
  const clean = (b) => Object.fromEntries(Object.entries(b || {}).filter(([k]) => !SYS.includes(k)));
  function ownedWrite(table, req, defaults = {}) {
    const steward = req.user.role === 'platform_admin';
    const agency_id = steward ? (req.body.agency_id || req.user.agency_id) : req.user.agency_id;
    if (req.body.id) {
      const cur = store.get(table, req.body.id);
      if (!cur) throw Object.assign(new Error('not found'), { status: 404 });
      if (!steward && cur.agency_id !== req.user.agency_id) throw Object.assign(new Error('That record belongs to another agency.'), { status: 403 });
      return store.put(table, { ...cur, ...clean(req.body), id: cur.id, agency_id: cur.agency_id }, { actor: req.user.id });
    }
    return store.put(table, { ...defaults, ...clean(req.body), agency_id }, { actor: req.user.id });
  }

  // --- auth ---
  r.post('/auth/login', A((req, res) => {
    const out = brain.login(req.body.username, req.body.password);
    if (!out) return res.status(401).json({ error: 'bad_credentials', message: 'Wrong username or password.' });
    res.setHeader('Set-Cookie', `aadi_t=${out.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
    res.json(out);
  }));
  r.post('/auth/logout', brain.authed, A((req, res) => { brain.logout(req.token); res.setHeader('Set-Cookie', 'aadi_t=; Path=/; Max-Age=0'); res.json({ ok: true }); }));
  r.get('/brand', A((req, res) => res.json(brain.brand)));
  r.get('/me', brain.authed, A((req, res) => res.json({ user: brain.publicUser(req.user), node: { id: brain.nodeId, role: brain.nodeRole } })));
  r.get('/demo-accounts', A((req, res) => {
    if (process.env.AADI_DEMO !== '1') return res.json([]);
    const order = ['learner', 'guardian', 'facilitator', 'teacher', 'counsellor', 'mentor', 'health_worker', 'doctor', 'field_officer', 'coordinator', 'agency_admin', 'platform_admin', 'cpo', 'donor', 'employer', 'govt_viewer'];
    res.json(store.all('SELECT username, role, display_name, agency_id FROM users WHERE deleted=0 AND active=1 AND username LIKE \'demo.%\'')
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.username.localeCompare(b.username))
      .map((u) => ({ ...u, role_label: policy.ROLES[u.role]?.label, agency: u.agency_id ? store.get('agencies', u.agency_id)?.name : null })));
  }));

  // --- registries (shared, non-personal) ---
  r.get('/hamlets', brain.authed, A((req, res) => {
    const hs = store.find('hamlets', {}, { order: 'name' });
    const pres = store.all(`SELECT ap.hamlet_id, a.id, a.name, a.colour, a.type, ap.services FROM agency_presence ap JOIN agencies a ON a.id=ap.agency_id WHERE ap.deleted=0 AND ap.status='active'`);
    const counts = Object.fromEntries(store.all('SELECT hamlet_id, COUNT(*) n FROM persons WHERE deleted=0 GROUP BY hamlet_id').map((x) => [x.hamlet_id, x.n]));
    const centres = store.all('SELECT * FROM centres WHERE deleted=0');
    res.json(hs.map((h) => ({ ...h, people: policy.suppress(counts[h.id] || 0, req.user), agencies: pres.filter((p) => p.hamlet_id === h.id), centres: centres.filter((c) => c.hamlet_id === h.id) })));
  }));
  r.get('/hamlets/:id', brain.authed, A((req, res) => {
    const h = store.get('hamlets', req.params.id);
    if (!h) return res.status(404).json({ error: 'not_found' });
    res.json(h);
  }));
  r.post('/hamlets', need('platform.manage'), A((req, res) => res.json(store.put('hamlets', { ...clean(req.body), ...(req.body.id ? { id: req.body.id } : {}) }, { actor: req.user.id }))));
  r.get('/agencies', brain.authed, A((req, res) => res.json(store.find('agencies', {}, { order: 'steward DESC, name' }))));
  r.post('/agencies', need('platform.manage'), A((req, res) => res.json(store.put('agencies', { status: 'active', ...req.body }, { actor: req.user.id }))));
  r.post('/presence', need('agency.manage'), A((req, res) => res.json(ownedWrite('agency_presence', req, { status: 'active', since: new Date().toISOString().slice(0, 10) }))));
  r.get('/centres', brain.authed, A((req, res) => res.json(store.find('centres', req.query.hamlet_id ? { hamlet_id: req.query.hamlet_id } : {}, { order: 'name' }))));
  r.post('/centres', need('agency.manage'), A((req, res) => res.json(ownedWrite('centres', req))));
  r.get('/programmes', brain.authed, A((req, res) => {
    const w = {};
    for (const k of ['hamlet_id', 'agency_id', 'module', 'track']) if (req.query[k]) w[k] = req.query[k];
    const list = store.find('programmes', w, { order: 'title' });
    const ag = Object.fromEntries(store.find('agencies').map((a) => [a.id, a]));
    const counts = Object.fromEntries(store.all('SELECT programme_id, COUNT(*) n FROM enrolments WHERE deleted=0 AND status=\'active\' GROUP BY programme_id').map((x) => [x.programme_id, x.n]));
    res.json(list.map((p) => ({ ...p, agency_name: ag[p.agency_id]?.name, agency_colour: ag[p.agency_id]?.colour, sponsor_name: p.sponsor_agency_id ? ag[p.sponsor_agency_id]?.name : null, enrolled: counts[p.id] || 0 })));
  }));
  r.post('/programmes', need('agency.manage', 'hamlet.coordinate'), A((req, res) => {
    // Running a programme of a sealed service (health, disaster, wildlife …) grants authority over people's
    // sensitive data and warnings, so only the platform steward may create or move such a programme.
    const mod = req.body.module || (req.body.id && (store.get('programmes', req.body.id) || {}).module);
    const m = mod && host.modules.get(mod);
    if (m && m.manifest && m.manifest.sealed && req.user.role !== 'platform_admin') return res.status(403).json({ error: 'forbidden', message: 'Only the platform steward can set up this service for an agency.' });
    res.json(ownedWrite('programmes', req, { status: 'active' }));
  }));
  r.get('/competencies', brain.authed, A((req, res) => res.json(store.find('competencies', req.query.domain ? { domain: req.query.domain } : {}, { order: 'code' }))));

  // --- hamlet coordination: shared service map across agencies ---
  r.get('/hamlets/:id/service-map', brain.authed, A((req, res) => {
    const h = store.get('hamlets', req.params.id);
    if (!h) return res.status(404).json({ error: 'not_found' });
    const progs = store.all(`SELECT p.*, a.name agency_name, a.colour agency_colour, (SELECT s.name FROM agencies s WHERE s.id=p.sponsor_agency_id) sponsor_name,
      (SELECT COUNT(*) FROM enrolments e WHERE e.programme_id=p.id AND e.deleted=0 AND e.status='active') enrolled
      FROM programmes p JOIN agencies a ON a.id=p.agency_id WHERE p.hamlet_id=? AND p.deleted=0 AND p.status='active'`, h.id);
    const byTrack = {};
    for (const t of TRACKS) byTrack[t] = progs.filter((p) => p.track === t);
    const gaps = TRACKS.filter((t) => byTrack[t].length === 0);
    const overlaps = [];
    for (const t of TRACKS) {
      const ags = [...new Set(byTrack[t].map((p) => p.agency_name))];
      if (ags.length > 1) overlaps.push({ track: t, agencies: ags, note: 'More than one agency runs this track here — coordinate timings and share learner progress (with consent).' });
    }
    // timetable clashes: same schedule slot in the same hamlet
    // A real clash: two agencies run the SAME track at the SAME time — they compete for the same learners.
    const slots = {};
    for (const p of progs) for (const s of (Array.isArray(p.schedule) ? p.schedule : [])) (slots[s + '|' + p.track] = slots[s + '|' + p.track] || []).push(p);
    const clashes = Object.entries(slots).filter(([, ps]) => new Set(ps.map((p) => p.agency_id)).size > 1)
      .map(([key, ps]) => ({ slot: key.split('|')[0], track: key.split('|')[1], programmes: ps.map((p) => `${p.title} (${p.agency_name})`) }));
    const people = store.one('SELECT COUNT(*) n, SUM(kind=\'child\') children, SUM(kind=\'youth\') youth, SUM(kind=\'adult\') adults FROM persons WHERE hamlet_id=? AND deleted=0', h.id);
    const reached = store.one('SELECT COUNT(DISTINCT person_id) n FROM enrolments WHERE hamlet_id=? AND deleted=0 AND status=\'active\'', h.id);
    res.json({ hamlet: h, tracks: TRACKS, byTrack, gaps, overlaps, clashes, people: { total: policy.suppress(people.n, req.user), children: policy.suppress(people.children || 0, req.user), youth: policy.suppress(people.youth || 0, req.user), adults: policy.suppress(people.adults || 0, req.user), reached: policy.suppress(reached.n, req.user) } });
  }));

  // --- persons (policy-filtered) ---
  r.get('/persons', brain.authed, A((req, res) => res.json(brain.personsVisible(req.user, { hamlet_id: req.query.hamlet_id, q: req.query.q, kind: req.query.kind, limit: req.query.limit }))));
  r.get('/persons/:id', brain.authed, A((req, res) => {
    const p = brain.getPerson(req.user, req.params.id, 'profile');
    const guardian = p.guardian_id ? store.get('persons', p.guardian_id) : null;
    const consents = (req.user.person_id === p.id || req.user.role === 'platform_admin' || (req.user.role === 'guardian' && p.guardian_id === req.user.person_id) || policy.can(req.user, 'learner.write'))
      ? store.all('SELECT c.*, a.name agency_name FROM consents c JOIN agencies a ON a.id=c.agency_id WHERE c.person_id=? AND c.deleted=0 ORDER BY c.granted_at DESC', p.id).filter((c) => req.user.role === 'platform_admin' || req.user.person_id === p.id || req.user.role === 'guardian' || c.agency_id === req.user.agency_id)
      : [];
    const access = {};
    for (const s of Object.keys(policy.SCOPES)) access[s] = policy.canSee(req.user, p.id, s).ok;
    res.json({ ...p, guardian: guardian && { id: guardian.id, name: guardian.name, relation: p.relation }, consents, access, enrolments: access.progress ? brain.store.all(`SELECT e.*, pr.title, pr.track, pr.module, a.name agency_name FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id JOIN agencies a ON a.id=e.agency_id WHERE e.person_id=? AND e.deleted=0`, p.id).filter((e) => brain.enrolmentVisible(req.user, p.id, e)).filter((e) => req.user.role === 'platform_admin' || !req.user.agency_id || ['learner', 'guardian'].includes(req.user.role) || e.agency_id === req.user.agency_id || policy.activeConsent(p.id, req.user.agency_id, 'progress')) : [] });
  }));
  // Register a new learner. Agencies may register; record is owned by the person.
  r.post('/persons', need('learner.write', 'forms.capture'), A((req, res) => {
    const b = req.body;
    const out = store.tx(() => {
      let guardian = null;
      if (b.guardian && b.guardian.name) guardian = store.put('persons', { name: b.guardian.name, hamlet_id: b.hamlet_id, kind: 'adult', phone: b.guardian.phone, language: b.language }, { actor: req.user.id });
      const p = store.put('persons', { hamlet_id: b.hamlet_id, name: b.name, gender: b.gender, dob: b.dob, kind: b.kind || 'child', language: b.language, school_class: b.school_class, phone: b.phone, guardian_id: guardian ? guardian.id : b.guardian_id, relation: b.guardian?.relation || b.relation, aspirations: b.aspirations, literacy_level: b.literacy_level }, { actor: req.user.id });
      // Consent captured at registration (in person, witnessed by facilitator)
      if (b.consent && b.consent.scopes && b.consent.scopes.length) {
        brain.grantConsent({ person_id: p.id, agency_id: req.user.agency_id || b.agency_id, scopes: b.consent.scopes, granted_by: guardian ? guardian.id : (b.guardian_id || p.id), relation: guardian ? (b.guardian.relation || 'guardian') : 'self', method: b.consent.method || 'in_person' }, req.user);
      }
      return p;
    });
    res.json(out);
  }));

  // --- consent ---
  r.get('/consent/scopes', A((req, res) => res.json(policy.SCOPES)));
  r.post('/consents', brain.authed, A((req, res) => {
    const b = req.body;
    const p = store.get('persons', b.person_id);
    if (!p) return res.status(404).json({ error: 'not_found' });
    const u = req.user;
    // Who may record consent: the person themself, their guardian, or staff recording an in-person/IVR consent.
    const selfOrGuardian = u.person_id === p.id || (u.role === 'guardian' && p.guardian_id === u.person_id);
    if (!selfOrGuardian && !policy.isRegistrar(u)) return res.status(403).json({ error: 'forbidden', message: 'Only the learner, guardian, or staff recording an in-person consent can do this.' });
    const granted_by = u.role === 'guardian' ? u.person_id : (b.granted_by || (p.guardian_id && policy.isMinor(p) ? p.guardian_id : p.id));
    // Staff record consent only for their OWN agency; only the person or guardian may choose another agency.
    const agency_id = selfOrGuardian ? (b.agency_id || u.agency_id) : u.agency_id;
    if (!agency_id || !store.get('agencies', agency_id)) return res.status(400).json({ error: 'bad_request', message: 'Choose the agency.' });
    if (!Array.isArray(b.scopes) || b.scopes.some((x) => !policy.SCOPES[x])) return res.status(400).json({ error: 'bad_request', message: 'Unknown consent scope.' });
    res.json(brain.grantConsent({ person_id: p.id, agency_id, scopes: b.scopes, granted_by, relation: b.relation || (granted_by === p.id ? 'self' : 'guardian'), method: selfOrGuardian ? 'app' : (b.method || 'in_person'), expires_at: b.expires_at }, u));
  }));
  r.post('/consents/:id/revoke', brain.authed, A((req, res) => {
    const c = store.get('consents', req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    const p = store.get('persons', c.person_id);
    const u = req.user;
    const ok = u.role === 'platform_admin' || u.person_id === p.id || (u.role === 'guardian' && p.guardian_id === u.person_id);
    if (!ok) return res.status(403).json({ error: 'forbidden', message: 'Only the learner or guardian can withdraw consent.' });
    res.json(brain.revokeConsent(c.id, u));
  }));

  // --- enrolment ---
  r.post('/enrolments', need('learner.write', 'forms.capture'), A((req, res) => res.json(brain.enrol(req.body.person_id, req.body.programme_id, req.user))));
  r.post('/enrolments/:id/status', need('learner.write'), A((req, res) => {
    const e = store.get('enrolments', req.params.id);
    if (!e || (req.user.role !== 'platform_admin' && e.agency_id !== req.user.agency_id)) return res.status(404).json({ error: 'not_found' });
    res.json(store.put('enrolments', { ...e, status: req.body.status }, { actor: req.user.id }));
  }));

  // --- learning passport ---
  r.get('/passport/:personId', brain.authed, A((req, res) => res.json(brain.passport(req.user, req.params.personId))));
  r.get('/passport/verify/:code', A((req, res) => {
    const p = store.one('SELECT id, name, hamlet_id FROM persons WHERE deleted=0 AND upper(substr(id, -8))=?', String(req.params.code).toUpperCase());
    if (!p) return res.status(404).json({ valid: false });
    const n = store.one('SELECT COUNT(*) n FROM passport_entries WHERE person_id=? AND deleted=0', p.id);
    res.json({ valid: true, name: p.name.split(' ')[0] + ' ' + (p.name.split(' ')[1] || '').charAt(0) + '.', entries: n.n, issuer: brain.brand.owner });
  }));
  r.post('/passport/award', need('assess', 'counsel'), A((req, res) => {
    if (!policy.canSee(req.user, req.body.person_id, 'progress').ok) return res.status(403).json({ error: 'forbidden', message: 'No progress consent for this learner.' });
    res.json(brain.award(req.body, req.user));
  }));

  // --- notifications ---
  r.get('/notifications', brain.authed, A((req, res) => {
    if (req.user.role === 'platform_admin') return res.json(store.find('notifications', {}, { order: 'created_at DESC', limit: 200 }));
    const ids = [req.user.person_id, ...store.all('SELECT id FROM persons WHERE guardian_id=? AND deleted=0', req.user.person_id || '-').map((x) => x.id)];
    res.json(store.all(`SELECT * FROM notifications WHERE deleted=0 AND person_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT 100`, ...ids));
  }));

  // --- users (agency admins manage their own staff) ---
  r.get('/users', need('agency.manage'), A((req, res) => {
    const w = req.user.role === 'platform_admin' ? {} : { agency_id: req.user.agency_id };
    res.json(store.find('users', w, { order: 'role, display_name' }).map((u) => brain.publicUser(u)));
  }));
  r.post('/users', need('agency.manage'), A((req, res) => {
    const b = req.body || {};
    // Explicit fields only. Never update an existing account here, never link a login to a person here,
    // and never accept a self-declared safeguarding status.
    if (b.id || b.person_id || b.pass_hash) return res.status(400).json({ error: 'bad_request', message: 'id, person_id and pass_hash cannot be set here.' });
    const steward = req.user.role === 'platform_admin';
    if (!policy.ROLES[b.role]) return res.status(400).json({ error: 'bad_request', message: 'Unknown role.' });
    if (!steward && ['platform_admin', 'cpo', 'learner', 'guardian'].includes(b.role)) return res.status(403).json({ error: 'forbidden', message: 'Only the platform steward can create this kind of account.' });
    if (!/^[a-z0-9._-]{3,40}$/.test(String(b.username || '').toLowerCase())) return res.status(400).json({ error: 'bad_request', message: 'Username: 3–40 letters, digits, dot, dash or underscore.' });
    if (String(b.password || '').length < 8) return res.status(400).json({ error: 'bad_request', message: 'Password must be at least 8 characters.' });
    if (store.one('SELECT 1 x FROM users WHERE username=? AND deleted=0', String(b.username).toLowerCase())) return res.status(409).json({ error: 'conflict', message: 'That username is taken.' });
    const agency_id = steward ? (b.agency_id || null) : req.user.agency_id;
    const hamlet_ids = Array.isArray(b.hamlet_ids) ? b.hamlet_ids.filter((h) => store.get('hamlets', h)) : undefined;
    const childFacing = ['facilitator', 'teacher', 'mentor', 'counsellor', 'health_worker', 'doctor', 'field_officer'].includes(b.role);
    const u = brain.createUser({ username: b.username, password: b.password, role: b.role, display_name: String(b.display_name || b.username).slice(0, 120), agency_id, centre_id: b.centre_id || null, hamlet_ids, safeguarding_trained: 0, active: childFacing ? 0 : 1 }, req.user);
    res.json({ ...brain.publicUser(u), note: u.active ? undefined : 'Account created but inactive until safeguarding training is completed.' });
  }));
  r.post('/users/:id/safeguarding-trained', need('safeguard', 'agency.manage'), A((req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'not_found' });
    if (!['platform_admin', 'cpo'].includes(req.user.role) && u.agency_id !== req.user.agency_id) return res.status(403).json({ error: 'forbidden', message: 'You can only confirm training for your own agency\'s staff.' });
    res.json(brain.publicUser(store.put('users', { ...u, safeguarding_trained: 1, active: 1 }, { actor: req.user.id })));
  }));

  // --- households (v2) ---
  r.get('/households', need('learner.read', 'forms.capture'), A((req, res) => {
    const w = {};
    if (req.query.hamlet_id) w.hamlet_id = req.query.hamlet_id;
    let rows = store.find('households', w, { order: 'name', limit: 2000 });
    if (Array.isArray(req.user.hamlet_ids) && req.user.hamlet_ids.length && req.user.role !== 'platform_admin') rows = rows.filter((h) => req.user.hamlet_ids.includes(h.hamlet_id));
    // Only households where the user can see at least one member — no family lists by the back door.
    const ids = policy.visiblePersonIds(req.user);
    if (ids !== null) {
      const vis = new Set(ids.length ? store.all(`SELECT DISTINCT household_id h FROM persons WHERE deleted=0 AND household_id IS NOT NULL AND id IN (${ids.map(() => '?').join(',')})`, ...ids).map((r) => r.h) : []);
      rows = rows.filter((h) => vis.has(h.id));
    }
    res.json(rows.map((h) => ({ ...h, members: brain.householdMembers(req.user, h.id).map((p) => ({ id: p.id, name: p.name, kind: p.kind, age: p.age, gender: p.gender })) })));
  }));
  r.post('/households', need('learner.write', 'forms.capture'), A((req, res) => {
    if (req.user.role !== 'platform_admin' && Array.isArray(req.user.hamlet_ids) && req.user.hamlet_ids.length && !req.user.hamlet_ids.includes(req.body.hamlet_id)) return res.status(403).json({ error: 'forbidden', message: 'This hamlet is outside your area.' });
    for (const pid of [req.body.head_person_id, ...(req.body.members || [])].filter(Boolean)) {
      if (!policy.canSee(req.user, pid, 'profile').ok) return res.status(403).json({ error: 'forbidden', message: 'You can only group people you are permitted to see.' });
    }
    res.json(brain.householdCreate(req.body, req.user));
  }));

  // --- forms: the shared round-trip engine (v2) ---
  const F = brain.forms;
  r.get('/forms', brain.authed, A((req, res) => res.json(F.defsFor(req.user, { module: req.query.module || null }).map((d) => ({ ...d, can_capture: F.canCapture(req.user, d), can_review: F.canReview(req.user, d) })))));
  r.get('/forms/defs/:key', brain.authed, A((req, res) => {
    const d = F.getDef(req.params.key);
    if (!d || !(F.canCapture(req.user, d) || F.canReview(req.user, d) || (d.allow_self && req.user.person_id))) return res.status(404).json({ error: 'not_found' });
    res.json({ ...d, can_capture: F.canCapture(req.user, d), can_review: F.canReview(req.user, d) });
  }));
  r.post('/forms/defs', need('forms.design'), A((req, res) => {
    const def = { ...req.body, agency_id: req.user.role === 'platform_admin' ? (req.body.agency_id || null) : req.user.agency_id, source: req.body.source || 'designer' };
    const ex = F.getDef(def.key);
    if (ex && ex.module !== 'surveys') return res.status(409).json({ error: 'conflict', message: 'That form key belongs to a service module.' });
    // Only the agency that owns a designer form may change it; shared (agency-less) forms only the steward.
    if (ex && req.user.role !== 'platform_admin' && (!ex.agency_id || ex.agency_id !== req.user.agency_id)) return res.status(403).json({ error: 'forbidden', message: 'This form belongs to someone else.' });
    if (req.user.role !== 'platform_admin' && def.review && def.review.agency_id && def.review.agency_id !== req.user.agency_id) return res.status(403).json({ error: 'forbidden', message: 'Only the steward can forward a form to another agency.' });
    res.json(F.define('surveys', def, req.user));
  }));
  r.post('/forms/import-xlsform', need('forms.design'), A((req, res) => res.json(F.fromXlsform(req.body || {}))));
  r.post('/forms/submissions', brain.authed, A((req, res) => {
    try { res.json(F.submit(req.user, req.body || {}, { moduleEnabledIn: (m, h) => brain.moduleEnabledIn(m, h) })); }
    catch (e) { if (e.errors) return res.status(400).json({ error: 'invalid', message: e.message, errors: e.errors }); throw e; }
  }));
  r.get('/forms/submissions', brain.authed, A((req, res) => res.json(F.list(req.user, { form_key: req.query.form_key, module: req.query.module, status: req.query.status, mine: req.query.mine === '1', person_id: req.query.person_id, hamlet_id: req.query.hamlet_id, limit: req.query.limit }))));
  r.get('/forms/queue', brain.authed, A((req, res) => res.json(F.queue(req.user, { form_key: req.query.form_key, module: req.query.module, hamlet_id: req.query.hamlet_id }))));
  r.get('/forms/submissions/:id', brain.authed, A((req, res) => res.json(F.one(req.user, req.params.id))));
  r.post('/forms/submissions/:id/claim', brain.authed, A((req, res) => res.json(F.claim(req.user, req.params.id))));
  r.post('/forms/submissions/:id/reply', brain.authed, A((req, res) => res.json(F.reply(req.user, req.params.id, req.body || {}))));
  r.post('/forms/submissions/:id/seen', brain.authed, A((req, res) => res.json(F.markSeen(req.user, req.params.id))));
  r.post('/forms/submissions/:id/close', brain.authed, A((req, res) => res.json(F.close(req.user, req.params.id, req.body || {}))));
  r.get('/forms/export/:key.csv', brain.authed, A((req, res) => { const csv = F.exportCsv(req.user, req.params.key); res.type('text/csv').setHeader('Content-Disposition', `attachment; filename="${req.params.key}.csv"`); res.send(csv); }));

  // --- roles and scopes, for admin screens (v2) ---
  r.get('/roles', brain.authed, A((req, res) => res.json({ roles: policy.ROLES, scopes: policy.SCOPES, restricted: Object.fromEntries(Object.entries(policy.RESTRICTED).map(([k, v]) => [k, v.roles])) })));

  // --- platform: modules, health, audit, chain ---
  r.get('/modules', A((req, res) => {
    const signedIn = !!brain.userFromToken((req.headers.authorization || '').replace(/^Bearer /, '') || (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === 'aadi_t')?.[1]);
    res.json(host.status().map((m) => (signedIn ? m : { ...m, off_hamlets: [], error: null, lastError: null })));
  }));
  r.post('/modules/:id/:action(enable|disable)', need('platform.manage'), A((req, res) => {
    const m = host.modules.get(req.params.id);
    if (!m) return res.status(404).json({ error: 'not_found' });
    if (req.params.action === 'disable' && m.manifest && m.manifest.critical) return res.status(400).json({ error: 'critical', message: 'Safeguarding cannot be switched off.' });
    host.setEnabled(req.params.id, req.params.action === 'enable', req.user); res.json(host.status().find((x) => x.id === req.params.id));
  }));
  // Which hamlets have this service? The community (Oorukoottam) decides; a steward or agency admin records it.
  r.get('/modules/:id/hamlets', brain.authed, A((req, res) => res.json(store.find('hamlets', {}, { order: 'name' }).map((h) => ({ hamlet_id: h.id, name: h.name, name_ml: h.name_ml, enabled: brain.moduleEnabledIn(req.params.id, h.id) })))));
  r.post('/modules/:id/hamlets/:hid', need('platform.manage', 'agency.manage'), A((req, res) => {
    if (!host.modules.has(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const m = host.modules.get(req.params.id);
    if (m.manifest && m.manifest.critical && !req.body.enabled) return res.status(400).json({ error: 'critical', message: 'Safeguarding cannot be switched off in any hamlet.' });
    if (!store.get('hamlets', req.params.hid)) return res.status(404).json({ error: 'not_found' });
    // An agency admin may record the decision only for a hamlet their agency serves.
    // Only the steward, or an agency that itself runs this service in this hamlet, records the decision.
    if (req.user.role !== 'platform_admin' && !store.one("SELECT 1 x FROM programmes WHERE agency_id=? AND hamlet_id=? AND module=? AND deleted=0", req.user.agency_id, req.params.hid, req.params.id)) return res.status(403).json({ error: 'forbidden', message: 'Your agency does not run this service in this hamlet.' });
    res.json(brain.setModuleInHamlet(req.params.id, req.params.hid, !!req.body.enabled, req.user, req.body.note || null));
  }));
  r.get('/modules/budgets', need('platform.manage', 'ops'), A((req, res) => res.json(host.budgets())));
  r.get('/health', A((req, res) => {
    const ev = store.one('SELECT COUNT(*) n, MAX(ts) last FROM events');
    res.json({ ok: true, node: brain.nodeId, role: brain.nodeRole, time: new Date().toISOString(), events: ev.n, last_event: ev.last, modules: host.status().map((m) => ({ id: m.id, state: m.state })), sync: brain.db.prepare('SELECT * FROM sync_cursors').all() });
  }));
  r.get('/audit', need('platform.manage', 'safeguard'), A((req, res) => {
    const rows = store.all(`SELECT e.seq, e.ts, e.type, e.node, e.payload, u.display_name actor_name, u.role actor_role FROM events e LEFT JOIN users u ON u.id=e.actor WHERE e.type LIKE 'audit.%' ORDER BY e.seq DESC LIMIT ?`, Math.min(Number(req.query.limit) || 200, 1000));
    res.json(rows);
  }));
  r.get('/events/recent', need('platform.manage'), A((req, res) => res.json(store.all('SELECT seq, id, node, type, hamlet_id, ts, substr(hash,1,12) hash FROM events ORDER BY seq DESC LIMIT 100'))));
  r.get('/chain/verify', need('platform.manage', 'safeguard'), A((req, res) => {
    const nodes = store.all('SELECT DISTINCT node FROM events').map((x) => x.node);
    res.json(Object.fromEntries(nodes.map((n) => [n, store.verifyChain(n)])));
  }));

  return r;
};
