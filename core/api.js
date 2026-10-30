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

  // --- auth ---
  r.post('/auth/login', A((req, res) => {
    const out = brain.login(req.body.username, req.body.password);
    if (!out) return res.status(401).json({ error: 'bad_credentials', message: 'Wrong username or password.' });
    res.setHeader('Set-Cookie', `aadi_t=${out.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
    res.json(out);
  }));
  r.post('/auth/logout', brain.authed, A((req, res) => { brain.logout(req.token); res.setHeader('Set-Cookie', 'aadi_t=; Path=/; Max-Age=0'); res.json({ ok: true }); }));
  r.get('/me', brain.authed, A((req, res) => res.json({ user: brain.publicUser(req.user), node: { id: brain.nodeId, role: brain.nodeRole } })));
  r.get('/demo-accounts', A((req, res) => {
    if (process.env.AADI_DEMO !== '1') return res.json([]);
    const order = ['learner', 'guardian', 'facilitator', 'teacher', 'counsellor', 'mentor', 'coordinator', 'agency_admin', 'platform_admin', 'cpo', 'donor', 'employer', 'govt_viewer'];
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
  r.post('/hamlets', need('platform.manage'), A((req, res) => res.json(store.put('hamlets', req.body, { actor: req.user.id }))));
  r.get('/agencies', brain.authed, A((req, res) => res.json(store.find('agencies', {}, { order: 'steward DESC, name' }))));
  r.post('/agencies', need('platform.manage'), A((req, res) => res.json(store.put('agencies', { status: 'active', ...req.body }, { actor: req.user.id }))));
  r.post('/presence', need('agency.manage'), A((req, res) => {
    const agency_id = req.user.role === 'platform_admin' ? req.body.agency_id : req.user.agency_id;
    res.json(store.put('agency_presence', { status: 'active', since: new Date().toISOString().slice(0, 10), ...req.body, agency_id }, { actor: req.user.id }));
  }));
  r.get('/centres', brain.authed, A((req, res) => res.json(store.find('centres', req.query.hamlet_id ? { hamlet_id: req.query.hamlet_id } : {}, { order: 'name' }))));
  r.post('/centres', need('agency.manage'), A((req, res) => res.json(store.put('centres', { ...req.body, agency_id: req.user.role === 'platform_admin' ? req.body.agency_id : req.user.agency_id }, { actor: req.user.id }))));
  r.get('/programmes', brain.authed, A((req, res) => {
    const w = {};
    for (const k of ['hamlet_id', 'agency_id', 'module', 'track']) if (req.query[k]) w[k] = req.query[k];
    const list = store.find('programmes', w, { order: 'title' });
    const ag = Object.fromEntries(store.find('agencies').map((a) => [a.id, a]));
    const counts = Object.fromEntries(store.all('SELECT programme_id, COUNT(*) n FROM enrolments WHERE deleted=0 AND status=\'active\' GROUP BY programme_id').map((x) => [x.programme_id, x.n]));
    res.json(list.map((p) => ({ ...p, agency_name: ag[p.agency_id]?.name, agency_colour: ag[p.agency_id]?.colour, enrolled: counts[p.id] || 0 })));
  }));
  r.post('/programmes', need('agency.manage', 'hamlet.coordinate'), A((req, res) => {
    const agency_id = req.user.role === 'platform_admin' ? req.body.agency_id : req.user.agency_id;
    res.json(store.put('programmes', { status: 'active', ...req.body, agency_id }, { actor: req.user.id }));
  }));
  r.get('/competencies', brain.authed, A((req, res) => res.json(store.find('competencies', req.query.domain ? { domain: req.query.domain } : {}, { order: 'code' }))));

  // --- hamlet coordination: shared service map across agencies ---
  r.get('/hamlets/:id/service-map', brain.authed, A((req, res) => {
    const h = store.get('hamlets', req.params.id);
    if (!h) return res.status(404).json({ error: 'not_found' });
    const progs = store.all(`SELECT p.*, a.name agency_name, a.colour agency_colour,
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
    res.json({ ...p, guardian: guardian && { id: guardian.id, name: guardian.name, relation: p.relation }, consents, access, enrolments: access.progress ? brain.store.all(`SELECT e.*, pr.title, pr.track, pr.module, a.name agency_name FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id JOIN agencies a ON a.id=e.agency_id WHERE e.person_id=? AND e.deleted=0`, p.id).filter((e) => req.user.role === 'platform_admin' || !req.user.agency_id || ['learner', 'guardian'].includes(req.user.role) || e.agency_id === req.user.agency_id || policy.activeConsent(p.id, req.user.agency_id, 'progress')) : [] });
  }));
  // Register a new learner. Agencies may register; record is owned by the person.
  r.post('/persons', need('learner.write'), A((req, res) => {
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
    if (!selfOrGuardian && !policy.can(u, 'learner.write')) return res.status(403).json({ error: 'forbidden', message: 'Only the learner, guardian, or staff recording an in-person consent can do this.' });
    const granted_by = u.role === 'guardian' ? u.person_id : (b.granted_by || (p.guardian_id && policy.isMinor(p) ? p.guardian_id : p.id));
    res.json(brain.grantConsent({ person_id: p.id, agency_id: b.agency_id || u.agency_id, scopes: b.scopes, granted_by, relation: b.relation || (granted_by === p.id ? 'self' : 'guardian'), method: selfOrGuardian ? 'app' : (b.method || 'in_person'), expires_at: b.expires_at }, u));
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
  r.post('/enrolments', need('learner.write'), A((req, res) => res.json(brain.enrol(req.body.person_id, req.body.programme_id, req.user))));
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
    res.json({ valid: true, name: p.name.split(' ')[0] + ' ' + (p.name.split(' ')[1] || '').charAt(0) + '.', entries: n.n, issuer: 'AADI · CIF' });
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
    const b = req.body;
    if (req.user.role !== 'platform_admin' && ['platform_admin', 'cpo'].includes(b.role)) return res.status(403).json({ error: 'forbidden' });
    const agency_id = req.user.role === 'platform_admin' ? b.agency_id : req.user.agency_id;
    // Safeguarding gate: staff who work with children cannot be activated without training.
    const childFacing = ['facilitator', 'teacher', 'mentor', 'counsellor'].includes(b.role);
    const u = brain.createUser({ ...b, agency_id, active: childFacing && !b.safeguarding_trained ? 0 : 1 }, req.user);
    res.json({ ...brain.publicUser(u), note: u.active ? undefined : 'Account created but inactive until safeguarding training is completed.' });
  }));
  r.post('/users/:id/safeguarding-trained', need('safeguard', 'agency.manage'), A((req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'not_found' });
    res.json(brain.publicUser(store.put('users', { ...u, safeguarding_trained: 1, active: 1 }, { actor: req.user.id })));
  }));

  // --- platform: modules, health, audit, chain ---
  r.get('/modules', A((req, res) => res.json(host.status())));
  r.post('/modules/:id/:action(enable|disable)', need('platform.manage'), A((req, res) => { host.setEnabled(req.params.id, req.params.action === 'enable', req.user); res.json(host.status().find((m) => m.id === req.params.id)); }));
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
