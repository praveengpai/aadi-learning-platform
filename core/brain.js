'use strict';
// AADI Brain — the central engine. Owns registries, identity, consent, policy,
// the event log, the learning passport, notifications and audit. Modules attach
// through ModuleHost and only ever see the brain through `facade()`.
const crypto = require('crypto');
const { openDb, migrateCore, CORE_TABLES } = require('./db');
const { Store, newId, nowIso } = require('./store');
const { makePolicy } = require('./policy');
const { makeForms } = require('./forms');

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return 'scrypt$' + salt + '$' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, h] = stored.split('$');
  const got = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(got, Buffer.from(h, 'hex'));
}

class Brain {
  constructor({ dbFile, nodeId, role = 'cloud' }) {
    this.db = openDb(dbFile);
    migrateCore(this.db);
    // The platform is CIF's product; programmes such as AADI run on it under their own names.
    // The platform's public name is a setting until it is chosen.
    this.brand = {
      name: process.env.PLATFORM_NAME || 'CIF Learning Platform',
      name_ml: process.env.PLATFORM_NAME_ML || 'സി.ഐ.എഫ് പഠന വേദി',
      short: process.env.PLATFORM_SHORT || 'CIF Learning',
      owner: process.env.PLATFORM_OWNER || 'Community Innovations Foundation',
      tagline: process.env.PLATFORM_TAGLINE || 'One learning platform for every tribal hamlet — from the first letter to the first job.',
      tagline_ml: process.env.PLATFORM_TAGLINE_ML || 'ഓരോ ഊരിനും ഒരു പഠന വേദി — ആദ്യ അക്ഷരം മുതൽ ആദ്യ ജോലി വരെ.',
    };
    this.nodeId = nodeId;
    this.nodeRole = role; // 'cloud' | 'hub'
    this.store = new Store(this.db, nodeId, { ...CORE_TABLES });
    this.policy = makePolicy(this.store);
    this.forms = makeForms(this);
    this.authed = this.authed.bind(this);
    this.requires = this.requires.bind(this);
  }

  // ---------- identity ----------
  login(username, password) {
    const u = this.store.one('SELECT * FROM users WHERE username=? AND deleted=0 AND active=1', String(username || '').toLowerCase().trim());
    if (!u || !checkPassword(String(password || ''), u.pass_hash)) return null;
    const token = crypto.randomBytes(24).toString('hex');
    const exp = new Date(Date.now() + 12 * 3600e3).toISOString();
    this.db.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)').run(token, u.id, nowIso(), exp);
    this.audit(u, 'auth.login', u.id);
    return { token, user: this.publicUser(u) };
  }
  logout(token) { this.db.prepare('DELETE FROM sessions WHERE token=?').run(token); }
  userFromToken(token) {
    if (!token) return null;
    const s = this.db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
    if (!s || s.expires_at < nowIso()) return null;
    const u = this.store.get('users', s.user_id);
    return u && u.active ? u : null;
  }
  publicUser(u) {
    const { pass_hash, ...rest } = u;
    const agency = u.agency_id ? this.store.get('agencies', u.agency_id) : null;
    const person = u.person_id ? this.store.get('persons', u.person_id) : null;
    return { ...rest, agency_name: agency && agency.name, role_label: this.policy.ROLES[u.role]?.label, minor: person ? this.policy.isMinor(person) : false, person_kind: person ? person.kind : null };
  }
  createUser({ username, password, ...rest }, actor) {
    return this.store.put('users', { username: username.toLowerCase(), pass_hash: hashPassword(password), active: 1, ...rest }, { actor: actor && actor.id });
  }

  authed(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === 'aadi_t')?.[1];
    const u = this.userFromToken(token);
    if (!u) return res.status(401).json({ error: 'unauthenticated', message: 'Please sign in.' });
    req.user = u;
    req.token = token;
    next();
  }
  requires(...perms) {
    return (req, res, next) => this.authed(req, res, () => {
      if (perms.length && !perms.some((p) => this.policy.can(req.user, p))) return res.status(403).json({ error: 'forbidden', message: `Your role (${req.user.role}) cannot do this.` });
      next();
    });
  }

  // ---------- audit ----------
  audit(user, action, target, detail = null) {
    try {
      this.store.emit('audit.' + action, { target, detail, role: user && user.role }, { actor: user && user.id });
    } catch (e) { console.error('audit failed', e.message); }
  }

  // ---------- persons, with policy ----------
  personsVisible(user, { hamlet_id = null, q = null, kind = null, limit = 500 } = {}) {
    const ids = this.policy.visiblePersonIds(user);
    let sql = 'SELECT * FROM persons WHERE deleted=0';
    const params = [];
    if (ids !== null) { if (!ids.length) return []; sql += ` AND id IN (${ids.map(() => '?').join(',')})`; params.push(...ids); }
    if (hamlet_id) { sql += ' AND hamlet_id=?'; params.push(hamlet_id); }
    if (kind) { sql += ' AND kind=?'; params.push(kind); }
    if (q) { sql += ' AND name LIKE ?'; params.push('%' + q + '%'); }
    sql += ` ORDER BY name LIMIT ${Number(limit) || 500}`;
    return this.store.all(sql, ...params).map((p) => this.redact(p, user));
  }
  getPerson(user, id, scope = 'profile') {
    const v = this.policy.canSee(user, id, scope);
    if (!v.ok) { const e = new Error('Not permitted: ' + v.reason); e.status = 403; throw e; }
    if (v.audited && user.person_id !== id) this.audit(user, 'steward.person_read', id, { scope });
    const p = this.store.get('persons', id);
    if (!p) { const e = new Error('Not found'); e.status = 404; throw e; }
    return this.redact(p, user);
  }
  // Contact details only to those with the contact scope.
  redact(p, user) {
    const out = { ...p, age: p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 3.15576e10) : null, minor: this.policy.isMinor(p) };
    if (user.person_id === p.id || user.role === 'platform_admin' || user.role === 'cpo') return out;
    if (user.role === 'guardian' && p.guardian_id === user.person_id) return out;
    if (!user.agency_id || !this.policy.activeConsent(p.id, user.agency_id, 'contact')) { out.phone = out.phone ? '••••••' + String(out.phone).slice(-2) : null; out.contact_hidden = true; }
    return out;
  }

  // ---------- consent ----------
  grantConsent({ person_id, agency_id, scopes, granted_by, relation, method = 'in_person', expires_at = null }, actor) {
    const p = this.store.get('persons', person_id);
    if (!p) throw Object.assign(new Error('person not found'), { status: 404 });
    if (this.policy.isMinor(p) && (!granted_by || granted_by === person_id)) throw Object.assign(new Error('A guardian must give consent for a minor (DPDP Act 2023, s.9).'), { status: 400 });
    const prior = this.store.find('consents', { person_id, agency_id, status: 'active' });
    for (const c of prior) this.store.put('consents', { ...c, status: 'superseded' }, { actor: actor && actor.id });
    const c = this.store.put('consents', { person_id, agency_id, scopes, granted_by: granted_by || person_id, relation: relation || 'self', status: 'active', granted_at: nowIso(), expires_at, method, hamlet_id: p.hamlet_id }, { actor: actor && actor.id });
    this.audit(actor, 'consent.grant', person_id, { agency_id, scopes, method });
    return c;
  }
  revokeConsent(consentId, actor) {
    const c = this.store.get('consents', consentId);
    if (!c) throw Object.assign(new Error('consent not found'), { status: 404 });
    const out = this.store.put('consents', { ...c, status: 'revoked' }, { actor: actor && actor.id });
    this.audit(actor, 'consent.revoke', c.person_id, { agency_id: c.agency_id });
    this.store.emit('core.consent_revoked', { person_id: c.person_id, agency_id: c.agency_id, scopes: c.scopes }, { actor: actor && actor.id, hamlet_id: c.hamlet_id });
    return out;
  }

  // ---------- households (v2) ----------
  // A household groups people in one home so every service sees the same family.
  householdCreate({ hamlet_id, name, head_person_id = null, house_no = null, members = [] }, actor) {
    if (!this.store.get('hamlets', hamlet_id)) throw Object.assign(new Error('hamlet not found'), { status: 404 });
    return this.store.tx(() => {
      const hh = this.store.put('households', { hamlet_id, name: name || null, head_person_id, house_no }, { actor: actor && actor.id });
      for (const pid of new Set([head_person_id, ...members].filter(Boolean))) {
        const p = this.store.get('persons', pid);
        if (p && p.hamlet_id === hamlet_id) this.store.put('persons', { ...p, household_id: hh.id }, { actor: actor && actor.id });
      }
      return hh;
    });
  }
  // Members of a household that this user may see (policy-filtered, redacted).
  householdMembers(user, householdId) {
    const ids = this.policy.visiblePersonIds(user);
    const rows = this.store.find('persons', { household_id: householdId }, { order: 'name' });
    return rows.filter((p) => ids === null || ids.includes(p.id)).map((p) => this.redact(p, user));
  }

  // ---------- module switches per hamlet (v2) ----------
  // Default is ON everywhere; a hamlet (through its Oorukoottam) may switch a service off.
  moduleEnabledIn(moduleId, hamletId) {
    if (!hamletId) return true;
    const r = this.store.one('SELECT enabled FROM module_scopes WHERE module_id=? AND hamlet_id=? AND deleted=0 ORDER BY updated_at DESC LIMIT 1', moduleId, hamletId);
    return !r || Number(r.enabled) === 1;
  }
  setModuleInHamlet(moduleId, hamletId, enabled, actor, note = null) {
    const cur = this.store.one('SELECT * FROM module_scopes WHERE module_id=? AND hamlet_id=? AND deleted=0', moduleId, hamletId);
    const row = this.store.put('module_scopes', { ...(cur ? { id: cur.id } : {}), module_id: moduleId, hamlet_id: hamletId, enabled: enabled ? 1 : 0, decided_by: actor && actor.id, note }, { actor: actor && actor.id });
    this.audit(actor, enabled ? 'module.enable_hamlet' : 'module.disable_hamlet', moduleId, { hamlet_id: hamletId, note });
    return row;
  }
  moduleOffHamlets(moduleId) {
    return this.store.all('SELECT hamlet_id FROM module_scopes WHERE module_id=? AND deleted=0 AND enabled=0', moduleId).map((r) => r.hamlet_id);
  }

  // ---------- passport ----------
  award({ person_id, type = 'competency', ref, title, level = 1, evidence = null, agency_id }, actor) {
    const p = this.store.get('persons', person_id);
    if (!p) throw Object.assign(new Error('person not found'), { status: 404 });
    // idempotent per (person, type, ref, level)
    const dup = ref && this.store.one('SELECT * FROM passport_entries WHERE person_id=? AND type=? AND ref=? AND level>=? AND deleted=0', person_id, type, ref, level);
    if (dup) return dup;
    return this.store.put('passport_entries', { person_id, hamlet_id: p.hamlet_id, type, ref, title, level, evidence, issued_by_agency: agency_id || (actor && actor.agency_id) || null, issued_at: nowIso() }, { actor: actor && actor.id });
  }
  passport(user, personId) {
    const p = this.getPerson(user, personId, 'progress');
    const entries = this.store.all('SELECT pe.*, a.name agency_name FROM passport_entries pe LEFT JOIN agencies a ON a.id=pe.issued_by_agency WHERE pe.person_id=? AND pe.deleted=0 ORDER BY pe.issued_at DESC', personId);
    const enrol = this.store.all(`SELECT e.*, pr.title, pr.title_ml, pr.module, pr.track, a.name agency_name FROM enrolments e
      JOIN programmes pr ON pr.id=e.programme_id LEFT JOIN agencies a ON a.id=e.agency_id WHERE e.person_id=? AND e.deleted=0`, personId);
    const hamlet = this.store.get('hamlets', p.hamlet_id);
    return { person: p, hamlet, entries, enrolments: enrol, verify_code: personId.slice(-8).toUpperCase(), issued_by: `${this.brand.name} · ${this.brand.owner}` };
  }

  // ---------- notifications (outbox, delivered by channels module) ----------
  notify(person_id, message, { channel = 'auto', module = 'core' } = {}, actor) {
    const p = this.store.get('persons', person_id);
    return this.store.put('notifications', { person_id, hamlet_id: p && p.hamlet_id, channel, message, status: 'queued', module, created_at: nowIso() }, { actor: actor && actor.id });
  }

  // ---------- what modules get ----------
  facade(moduleId, moduleVersion = null) {
    const b = this;
    return {
      nodeId: b.nodeId,
      nodeRole: b.nodeRole,
      brand: b.brand,
      policy: { can: b.policy.can, canSee: b.policy.canSee, suppress: b.policy.suppress, isMinor: b.policy.isMinor, ROLES: b.policy.ROLES, SCOPES: b.policy.SCOPES, RESTRICTED: b.policy.RESTRICTED },
      persons: {
        visible: (user, opts) => b.personsVisible(user, opts),
        visibleIds: (user) => b.policy.visiblePersonIds(user),
        get: (user, id, scope) => b.getPerson(user, id, scope),
        raw: (id) => b.store.get('persons', id), // for system jobs (no user) — never return to clients unredacted
        // minimal, display-safe fields (no phone/dob) for building rosters after a policy check
        basic: (id) => { const p = b.store.get('persons', id); if (!p) return null; const age = p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 3.15576e10) : null; return { id: p.id, name: p.name, hamlet_id: p.hamlet_id, kind: p.kind, gender: p.gender, age, school_class: p.school_class, language: p.language, household_id: p.household_id || null, guardian_id: p.guardian_id || null }; },
      },
      hamlets: { list: () => b.store.find('hamlets', {}, { order: 'name' }), get: (id) => b.store.get('hamlets', id) },
      agencies: { list: () => b.store.find('agencies', {}, { order: 'name' }), get: (id) => b.store.get('agencies', id) },
      centres: {
        list: (w = {}) => b.store.find('centres', w, { order: 'name' }), get: (id) => b.store.get('centres', id),
        // register/update a centre; agency staff may only register for their own agency
        register: (row, user) => {
          if (!user || !b.policy.can(user, 'agency.manage')) throw Object.assign(new Error('Only agency or platform admins can register centres'), { status: 403 });
          const agency_id = user.role === 'platform_admin' ? (row.agency_id || user.agency_id) : user.agency_id;
          return b.store.put('centres', { ...row, agency_id }, { actor: user.id });
        },
      },
      notifications: {
        setStatus: (id, status) => { const n = b.store.get('notifications', id); if (!n) return null; return b.store.put('notifications', { ...n, status }); },
        queued: (limit = 200) => b.store.find('notifications', { status: 'queued' }, { order: 'created_at', limit }),
      },
      programmes: {
        list: (w = {}) => b.store.find('programmes', w, { order: 'title' }),
        get: (id) => b.store.get('programmes', id),
        create: (row, user) => b.store.put('programmes', { status: 'active', ...row }, { actor: user && user.id }),
      },
      enrolments: {
        forPerson: (pid) => b.store.find('enrolments', { person_id: pid }),
        forProgramme: (prid) => b.store.find('enrolments', { programme_id: prid }),
        enrol: (person_id, programme_id, user) => b.enrol(person_id, programme_id, user),
      },
      consent: {
        has: (pid, aid, scope) => b.policy.activeConsent(pid, aid, scope),
        // Record an in-person consent for the user's own agency (registrars only). Adds scopes to existing ones.
        grant: ({ person_id, scopes, granted_by = null, relation = null, method = 'in_person' }, user) => {
          if (!user || !b.policy.isRegistrar(user) || !user.agency_id) throw Object.assign(new Error('Only agency staff can record consent'), { status: 403 });
          const p = b.store.get('persons', person_id);
          if (!p) throw Object.assign(new Error('person not found'), { status: 404 });
          const cur = b.store.find('consents', { person_id, agency_id: user.agency_id, status: 'active' })[0];
          const all = [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : []), ...scopes])];
          const by = granted_by || (b.policy.isMinor(p) ? p.guardian_id : p.id);
          return b.grantConsent({ person_id, agency_id: user.agency_id, scopes: all, granted_by: by, relation: relation || (by === p.id ? 'self' : (p.relation || 'guardian')), method }, user);
        },
      },
      households: {
        get: (id) => b.store.get('households', id),
        list: (w = {}) => b.store.find('households', w, { order: 'name' }),
        members: (user, id) => b.householdMembers(user, id),
        create: (row, user) => b.householdCreate(row, user),
      },
      forms: {
        // A module defines forms in its own namespace and may attach a rule (its sub-engine) to each.
        define: (def, user) => b.forms.define(moduleId, def, user, moduleVersion),
        rule: (key, fn) => { const d = b.forms.getDef(key); if (d && d.module !== moduleId) throw new Error(`form ${key} belongs to ${d.module}`); b.forms.rule(moduleId, key, fn); },
        get: (key) => b.forms.getDef(key),
        submit: (user, args) => { const d = b.forms.getDef(args.form_key); if (!d || d.module !== moduleId) throw Object.assign(new Error('Form not found.'), { status: 404 }); return b.forms.submit(user, args, { moduleEnabledIn: (m, h) => b.moduleEnabledIn(m, h) }); },
        list: (user, opts = {}) => b.forms.list(user, { ...opts, module: moduleId }),
        queue: (user, opts = {}) => b.forms.queue(user, { ...opts, module: moduleId }),
        one: (user, id) => { const s = b.forms.one(user, id); if (s.module !== moduleId) throw Object.assign(new Error('Not found.'), { status: 404 }); return s; },
        reply: (user, id, args) => { const s = b.store.get('form_submissions', id); if (!s || s.module !== moduleId) throw Object.assign(new Error('Not found.'), { status: 404 }); return b.forms.reply(user, id, args); },
        validate: (key, answers) => { const d = b.forms.getDef(key); if (!d) throw new Error('no form ' + key); return b.forms.validate(d, answers); },
        canCapture: (user, key) => { const d = b.forms.getDef(key); return !!d && b.forms.canCapture(user, d); },
        canReview: (user, key) => { const d = b.forms.getDef(key); return !!d && b.forms.canReview(user, d); },
      },
      modules: { enabledIn: (hamletId, id = moduleId) => b.moduleEnabledIn(id, hamletId) },
      passport: { award: (args, user) => b.award(args, user), entries: (pid) => b.store.find('passport_entries', { person_id: pid }, { order: 'issued_at DESC' }) },
      competencies: { list: (w = {}) => b.store.find('competencies', w, { order: 'code' }), upsert: (row) => b.store.put('competencies', row) },
      notify: (pid, msg, opts, user) => b.notify(pid, msg, { ...opts, module: moduleId }, user),
      audit: (user, action, target, detail) => b.audit(user, moduleId + '.' + action, target, detail),
      users: {
        get: (id) => { const u = b.store.get('users', id); return u && b.publicUser(u); },
        byRole: (role, w = {}) => b.store.find('users', { role, ...w }).map((u) => b.publicUser(u)),
        create: (args, actor) => b.createUser(args, actor),
      },
    };
  }

  enrol(person_id, programme_id, user) {
    const pr = this.store.get('programmes', programme_id);
    const p = this.store.get('persons', person_id);
    if (!pr || !p) throw Object.assign(new Error('programme or person not found'), { status: 404 });
    if (user && user.role !== 'platform_admin' && user.agency_id && user.agency_id !== pr.agency_id) throw Object.assign(new Error('You can only enrol into your own agency\'s programmes'), { status: 403 });
    if (!this.policy.activeConsent(person_id, pr.agency_id, 'profile')) throw Object.assign(new Error('Consent needed first: the learner (or guardian, for a minor) must consent to share their profile with this agency.'), { status: 409, code: 'consent_required' });
    const ex = this.store.one('SELECT * FROM enrolments WHERE person_id=? AND programme_id=? AND deleted=0', person_id, programme_id);
    if (ex) return ex;
    const e = this.store.put('enrolments', { person_id, programme_id, agency_id: pr.agency_id, hamlet_id: p.hamlet_id, status: 'active', start_date: nowIso().slice(0, 10) }, { actor: user && user.id });
    this.store.emit('core.enrolled', { person_id, programme_id, agency_id: pr.agency_id, module: pr.module, track: pr.track }, { actor: user && user.id, hamlet_id: p.hamlet_id });
    return e;
  }
}

module.exports = { Brain, hashPassword, checkPassword, newId, nowIso };
