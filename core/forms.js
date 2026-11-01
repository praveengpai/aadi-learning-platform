'use strict';
// Brain — form round-trip engine (Contract v2).
// One pattern serves most community services:
//   capture a form offline at the hub → it travels with the courier → a reviewer in the city
//   replies → the reply returns on the next visit.
// Forms belong to a module, are bound to one consent scope, and every read is policy-checked.
const { nowIso } = require('./store');

const TYPES = ['text', 'textarea', 'integer', 'decimal', 'date', 'select_one', 'select_multiple', 'yes_no', 'photo', 'geopoint', 'note'];
const SUBJECTS = ['person', 'household', 'hamlet'];
const MAX_PHOTO_CHARS = 280_000; // ~200 KB image as a data URL — enough for a readable phone photo
const STATUSES = ['submitted', 'in_review', 'replied', 'closed'];

const err = (status, message, code) => Object.assign(new Error(message), { status, code });

function makeForms(brain) {
  const { store, policy } = brain;
  const rules = new Map(); // `${module}|${key}` → fn(answers, ctx) → { flags, priority }

  // ---------------- definitions ----------------
  function checkDef(def) {
    if (!def || !/^[a-z][a-z0-9_.-]{1,60}$/.test(def.key || '')) throw err(400, 'Form key must be lower-case letters, digits, dot, dash or underscore.');
    if (!def.title) throw err(400, 'Form needs a title.');
    if (!Array.isArray(def.fields) || !def.fields.length) throw err(400, 'Form needs at least one field.');
    const subject = def.subject || 'person';
    if (!SUBJECTS.includes(subject)) throw err(400, 'subject must be person, household or hamlet');
    const scope = def.scope || 'survey';
    if (!policy.SCOPES[scope]) throw err(400, `Unknown consent scope "${scope}".`);
    const names = new Set();
    for (const f of def.fields) {
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(f.name || '')) throw err(400, `Bad field name "${f.name}".`);
      if (names.has(f.name)) throw err(400, `Duplicate field "${f.name}".`);
      names.add(f.name);
      if (!TYPES.includes(f.type)) throw err(400, `Field "${f.name}": unsupported type "${f.type}".`);
      if (['select_one', 'select_multiple'].includes(f.type) && (!Array.isArray(f.choices) || !f.choices.length)) throw err(400, `Field "${f.name}" needs choices.`);
      if (f.relevant && !names.has(f.relevant.field)) throw err(400, `Field "${f.name}" depends on "${f.relevant.field}", which must come earlier.`);
    }
    return { subject, scope };
  }

  // Compare "1.2.10" style versions; missing parts count as 0.
  const semver = (a, b) => { const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

  // Forms defined by module code get a deterministic id, so the cloud and every hub converge on one
  // record. A node running older module code never overwrites a definition from newer code.
  function define(module, def, actor = null, codeVersion = null) {
    const { subject, scope } = checkDef(def);
    const id = 'frm_' + def.key.replace(/[^a-z0-9]/g, '_');
    const cur = store.get('form_defs', id) || store.one('SELECT * FROM form_defs WHERE key=? AND deleted=0', def.key);
    if (cur && cur.module !== module) throw err(409, `Form key "${def.key}" already belongs to ${cur.module}.`);
    const srcTag = codeVersion ? `module@${codeVersion}` : (def.source || 'module');
    if (cur && codeVersion && /^module@/.test(cur.source || '') && semver(cur.source.slice(7), codeVersion) > 0) return cur;
    const fields = def.fields.map((f) => ({ ...f, choices: f.choices ? f.choices.map((c) => (typeof c === 'string' ? { value: c, label: c } : c)) : undefined }));
    const row = {
      module, key: def.key, title: def.title, title_ml: def.title_ml || null, description: def.description || null,
      scope, subject, fields, review: def.review === undefined ? { perm: 'forms.review' } : def.review,
      status: def.status || 'active', agency_id: def.agency_id || null, source: srcTag,
      capture_perm: def.capture_perm || null, allow_self: def.allow_self ? 1 : 0,
    };
    if (cur) {
      const same = JSON.stringify(cur.fields) === JSON.stringify(fields) && cur.title === row.title && cur.scope === scope && JSON.stringify(cur.review) === JSON.stringify(row.review) && cur.status === row.status && (cur.title_ml || null) === row.title_ml && (cur.capture_perm || null) === row.capture_perm && Number(cur.allow_self || 0) === row.allow_self;
      if (same && (cur.source || '') === srcTag) return cur;
      return store.put('form_defs', { ...cur, ...row, version: (Number(cur.version) || 1) + (JSON.stringify(cur.fields) === JSON.stringify(fields) ? 0 : 1) }, { actor: actor && actor.id });
    }
    return store.put('form_defs', { ...row, id, version: 1 }, { actor: actor && actor.id });
  }

  const getDef = (key) => store.one('SELECT * FROM form_defs WHERE key=? AND deleted=0', key);

  // Forms this user may fill in or review.
  function defsFor(user, { module = null } = {}) {
    const rows = store.find('form_defs', module ? { module, status: 'active' } : { status: 'active' }, { order: 'module, title' });
    return rows.filter((d) => {
      if (d.agency_id && user.role !== 'platform_admin' && d.agency_id !== user.agency_id && !(d.review && d.review.agency_id === user.agency_id)) return false;
      return canCapture(user, d) || canReview(user, d);
    });
  }

  function canCapture(user, def) {
    if (!user) return false;
    if (def.capture_perm && !policy.can(user, def.capture_perm)) return false;
    if (policy.can(user, 'forms.capture')) {
      const rs = policy.RESTRICTED[def.scope];
      return !rs || rs.roles.includes(user.role) || user.role === 'platform_admin';
    }
    return false;
  }
  function canReview(user, def) {
    if (!user || !def.review) return false;
    const perm = def.review.perm || 'forms.review';
    if (!policy.can(user, perm)) return false;
    const rs = policy.RESTRICTED[def.scope];
    return !rs || rs.roles.includes(user.role) || user.role === 'platform_admin';
  }

  // ---------------- validation ----------------
  function isRelevant(f, answers) {
    if (!f.relevant) return true;
    const v = answers[f.relevant.field];
    if ('equals' in f.relevant) return Array.isArray(v) ? v.includes(f.relevant.equals) : v === f.relevant.equals;
    if (Array.isArray(f.relevant.in)) return Array.isArray(v) ? v.some((x) => f.relevant.in.includes(x)) : f.relevant.in.includes(v);
    if (f.relevant.present) return v !== undefined && v !== null && v !== '';
    return true;
  }

  function validate(def, input) {
    const answers = {};
    const errors = [];
    const src = input && typeof input === 'object' ? input : {};
    for (const f of def.fields) {
      if (f.type === 'note') continue;
      if (!isRelevant(f, answers)) continue;
      let v = src[f.name];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
      if (empty) { if (f.required) errors.push({ field: f.name, message: `${f.label || f.name} is required` }); continue; }
      const values = (f.choices || []).map((c) => c.value);
      switch (f.type) {
        case 'integer': case 'decimal': {
          const n = Number(v);
          if (!Number.isFinite(n) || (f.type === 'integer' && !Number.isInteger(n))) { errors.push({ field: f.name, message: `${f.label || f.name} must be a ${f.type === 'integer' ? 'whole ' : ''}number` }); continue; }
          if (f.min !== undefined && n < f.min) { errors.push({ field: f.name, message: `${f.label || f.name} must be at least ${f.min}` }); continue; }
          if (f.max !== undefined && n > f.max) { errors.push({ field: f.name, message: `${f.label || f.name} must be at most ${f.max}` }); continue; }
          v = n; break;
        }
        case 'date':
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(v))) { errors.push({ field: f.name, message: `${f.label || f.name} must be a date (YYYY-MM-DD)` }); continue; }
          v = String(v); break;
        case 'select_one':
          if (!values.includes(v)) { errors.push({ field: f.name, message: `${f.label || f.name}: choose one of the options` }); continue; }
          break;
        case 'select_multiple':
          v = Array.isArray(v) ? v : String(v).split(/\s+/);
          if (v.some((x) => !values.includes(x))) { errors.push({ field: f.name, message: `${f.label || f.name}: unknown option` }); continue; }
          v = [...new Set(v)]; break;
        case 'yes_no':
          if (![true, false, 'yes', 'no', 1, 0].includes(v)) { errors.push({ field: f.name, message: `${f.label || f.name} must be yes or no` }); continue; }
          v = v === true || v === 'yes' || v === 1 ? 'yes' : 'no'; break;
        case 'photo':
          if (typeof v !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(v) || v.length > MAX_PHOTO_CHARS) { errors.push({ field: f.name, message: `${f.label || f.name}: photo must be a JPEG/PNG under 200 KB` }); continue; }
          break;
        case 'geopoint': {
          const [la, ln] = Array.isArray(v) ? v : String(v).split(/[ ,]+/).map(Number);
          if (!(Math.abs(la) <= 90 && Math.abs(ln) <= 180)) { errors.push({ field: f.name, message: `${f.label || f.name}: invalid location` }); continue; }
          v = [Number(la), Number(ln)]; break;
        }
        default:
          v = String(v).slice(0, f.type === 'textarea' ? 4000 : 500);
      }
      answers[f.name] = v;
    }
    return { ok: !errors.length, errors, answers };
  }

  // ---------------- visibility ----------------
  // Staff limited to particular hamlets see only those hamlets' records.
  const outsideArea = (user, sub) => Array.isArray(user.hamlet_ids) && user.hamlet_ids.length && !['platform_admin', 'cpo', 'learner', 'guardian'].includes(user.role) && !user.hamlet_ids.includes(sub.hamlet_id);

  function visible(user, sub, def = getDef(sub.form_key)) {
    if (!user || !sub || !def) return false;
    if (sub.person_id) {
      if (user.person_id && user.person_id === sub.person_id) return true;
      if (user.role === 'guardian') { const p = store.get('persons', sub.person_id); return !!(p && p.guardian_id === user.person_id); }
      if (outsideArea(user, sub)) return false;
      const v = policy.canSee(user, sub.person_id, def.scope);
      if (v.ok && (v.reason === 'steward' || sub.agency_id === user.agency_id)) return canCapture(user, def) || canReview(user, def) || v.reason === 'steward';
      // Forwarded review: the person consented to share this scope with the reviewing agency.
      if (def.review && def.review.agency_id && def.review.agency_id === user.agency_id && canReview(user, def)) return policy.activeConsent(sub.person_id, user.agency_id, def.scope);
      return false;
    }
    if (user.role === 'platform_admin') return true;
    if (!(canCapture(user, def) || canReview(user, def))) return false;
    const forwarded = def.review && def.review.agency_id === user.agency_id && sub.agency_id !== user.agency_id;
    if (sub.agency_id !== user.agency_id && !forwarded) return false;
    if (outsideArea(user, sub)) return false;
    // Household answers stay visible only while the head of household's consent to THIS agency lasts.
    if (sub.household_id || def.subject === 'household') {
      const hh = sub.household_id && store.get('households', sub.household_id);
      if (!hh || !hh.head_person_id || !policy.activeConsent(hh.head_person_id, user.agency_id, def.scope)) return false;
    }
    // Hamlet-level forms: only agencies present in that hamlet.
    if (def.subject === 'hamlet' && !store.one("SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0 AND status='active'", user.agency_id, sub.hamlet_id)) return false;
    return true;
  }

  // The person themself and a guardian see a family-safe view of restricted-scope records:
  // the advice that came back, not raw clinical answers or flag codes.
  function familySafe(user, s, def) {
    if (!def || !policy.RESTRICTED[def.scope]) return s;
    if (!['learner', 'guardian'].includes(user.role) && !(user.person_id && user.person_id === s.person_id)) return s;
    if (policy.RESTRICTED[def.scope].roles.includes(user.role)) return s;
    return { ...s, answers: {}, flags: [], priority: 0, family_view: true };
  }
  // A service switched off in a hamlet is off for its records too (stewards excepted).
  const switchedOff = (user, s) => user.role !== 'platform_admin' && moduleOff && moduleOff(s.module, s.hamlet_id);
  let moduleOff = null;

  // Strip photos from list views (they are large); full record via one().
  const slim = (s) => {
    if (!s.answers) return s;
    const a = {};
    for (const [k, v] of Object.entries(s.answers)) a[k] = typeof v === 'string' && v.startsWith('data:image/') ? '[photo]' : v;
    return { ...s, answers: a };
  };
  const basic = (id) => {
    const p = store.get('persons', id);
    if (!p) return null;
    return { id: p.id, name: p.name, gender: p.gender, hamlet_id: p.hamlet_id, kind: p.kind, household_id: p.household_id, age: p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 3.15576e10) : null };
  };
  const decorate = (s, def) => {
    const p = s.person_id ? basic(s.person_id) : null;
    const h = s.hamlet_id ? store.get('hamlets', s.hamlet_id) : null;
    const u = s.captured_by ? store.get('users', s.captured_by) : null;
    const r = s.replied_by ? store.get('users', s.replied_by) : null;
    return { ...s, form_title: def && def.title, form_title_ml: def && def.title_ml, person: p && { id: p.id, name: p.name, age: p.age, gender: p.gender }, hamlet: h && h.name, hamlet_ml: h && h.name_ml, captured_by_name: u && u.display_name, replied_by_name: r && r.display_name };
  };

  // ---------------- submit / review ----------------
  function submit(user, { form_key, person_id = null, household_id = null, hamlet_id = null, answers, client_ref = null }, { moduleEnabledIn } = {}) {
    const def = getDef(form_key);
    if (!def || def.status !== 'active') throw err(404, 'Form not found.');
    if (def.subject !== 'person') person_id = null;
    if (def.subject !== 'household') household_id = def.subject === 'person' ? household_id : null;
    const self = person_id && user.person_id === person_id && def.allow_self;
    if (!self && !canCapture(user, def)) throw err(403, 'Your role cannot fill in this form.');
    if (def.agency_id && user.role !== 'platform_admin' && def.agency_id !== user.agency_id) throw err(403, 'This form belongs to another agency.');
    let hamlet = hamlet_id;
    if (def.subject === 'person') {
      if (!person_id) throw err(400, 'Choose the person this form is about.');
      const p = store.get('persons', person_id);
      if (!p) throw err(404, 'Person not found.');
      if (!self) {
        const v = policy.canSee(user, person_id, def.scope);
        if (!v.ok) throw err(403, `Not permitted: ${v.reason}. Record ${def.scope} consent first.`);
      }
      hamlet = p.hamlet_id;
      household_id = household_id || p.household_id || null;
    } else if (def.subject === 'household') {
      const hh = household_id && store.get('households', household_id);
      if (!hh) throw err(400, 'Choose the household.');
      hamlet = hh.hamlet_id;
      // A household's answers are personal data: the head of the household must have consented.
      if (user.role !== 'platform_admin' && !(user.person_id && user.person_id === hh.head_person_id)) {
        if (!hh.head_person_id || !policy.activeConsent(hh.head_person_id, user.agency_id, def.scope)) throw err(403, `Not permitted: the head of this household has not given "${def.scope}" consent to your agency.`);
      }
    } else if (!hamlet || !store.get('hamlets', hamlet)) throw err(400, 'Choose the hamlet.');
    if (Array.isArray(user.hamlet_ids) && user.hamlet_ids.length && !user.hamlet_ids.includes(hamlet) && user.role !== 'platform_admin') throw err(403, 'This hamlet is outside your area.');
    if (moduleEnabledIn && !moduleEnabledIn(def.module, hamlet)) throw err(403, 'This service is switched off in this hamlet.', 'module_off_here');
    // Idempotent: the browser's offline outbox may replay the same submission (checked after permissions).
    if (client_ref) {
      const dup = store.one('SELECT * FROM form_submissions WHERE client_ref=? AND captured_by=? AND deleted=0', String(client_ref), user.id);
      if (dup) return { ...dup, duplicate: true };
    }
    const v = validate(def, answers);
    if (!v.ok) throw Object.assign(err(400, v.errors.map((e) => e.message).join('; '), 'invalid'), { errors: v.errors });
    let flags = [], priority = 0;
    const rule = rules.get(def.module + '|' + def.key);
    if (rule) {
      try {
        const out = rule(v.answers, { person: person_id ? basic(person_id) : null, form: def }) || {};
        flags = Array.isArray(out.flags) ? out.flags : [];
        priority = Number(out.priority) || 0;
      } catch (e) { console.error(`[forms] rule ${def.key} failed:`, e.message); flags = [{ code: 'rule_error', level: 'info', message: 'Automatic check could not run; please review manually.' }]; }
    }
    const now = nowIso();
    const row = store.put('form_submissions', {
      form_id: def.id, form_key: def.key, module: def.module, person_id, household_id, hamlet_id: hamlet,
      agency_id: user.agency_id || null, answers: v.answers, flags, priority, status: def.review ? 'submitted' : 'closed',
      captured_by: user.id, captured_at: now, client_ref: client_ref ? String(client_ref) : null, closed_at: def.review ? null : now,
    }, { actor: user.id });
    store.emit('forms.submitted', { id: row.id, form_key: def.key, module: def.module, priority, flags: flags.map((f) => f.code) }, { actor: user.id, hamlet_id: hamlet });
    return row;
  }

  function one(user, id) {
    const s = store.get('form_submissions', id);
    if (!s) throw err(404, 'Not found.');
    const def = getDef(s.form_key);
    if (!visible(user, s, def)) throw err(403, 'Not permitted.');
    if (switchedOff(user, s)) throw err(403, 'This service is switched off in this hamlet.', 'module_off_here');
    if (user.role === 'platform_admin' && s.person_id && user.person_id !== s.person_id) brain.audit(user, 'steward.form_read', s.person_id, policy.RESTRICTED[def.scope] ? { scope: 'restricted' } : { form: s.form_key });
    return { ...familySafe(user, decorate(s, def), def), form: familySafe(user, {}, def).family_view ? { ...def, fields: [] } : def, can_reply: canReview(user, def) && !['closed'].includes(s.status) };
  }

  function list(user, { form_key = null, module = null, status = null, mine = false, person_id = null, hamlet_id = null, limit = 200 } = {}) {
    let sql = 'SELECT * FROM form_submissions WHERE deleted=0';
    const p = [];
    if (form_key) { sql += ' AND form_key=?'; p.push(form_key); }
    if (module) { sql += ' AND module=?'; p.push(module); }
    if (status) { const st = String(status).split(','); sql += ` AND status IN (${st.map(() => '?').join(',')})`; p.push(...st); }
    if (person_id) { sql += ' AND person_id=?'; p.push(person_id); }
    if (hamlet_id) { sql += ' AND hamlet_id=?'; p.push(hamlet_id); }
    if (mine) { sql += ' AND captured_by=?'; p.push(user.id); }
    if (user.role !== 'platform_admin' && !['learner', 'guardian'].includes(user.role) && user.agency_id) {
      // agency staff: own agency's captures, plus forms forwarded to this agency for review
      sql += ' AND (agency_id=? OR form_key IN (SELECT key FROM form_defs WHERE deleted=0 AND review LIKE ?))'; p.push(user.agency_id, `%"agency_id":"${user.agency_id}"%`);
    }
    sql += ' ORDER BY priority DESC, captured_at DESC LIMIT 5000';
    const defs = new Map();
    const out = [];
    for (const s of store.all(sql, ...p)) {
      if (!defs.has(s.form_key)) defs.set(s.form_key, getDef(s.form_key));
      const def = defs.get(s.form_key);
      if (!visible(user, s, def) || switchedOff(user, s)) continue;
      out.push(familySafe(user, decorate(slim(s), def), def));
      if (out.length >= Math.min(Number(limit) || 200, 1000)) break;
    }
    return out;
  }

  // Reviewer's queue: open items this user may answer, most urgent first.
  function queue(user, opts = {}) {
    return list(user, { ...opts, status: 'submitted,in_review' }).filter((s) => canReview(user, getDef(s.form_key)));
  }

  function reply(user, id, { reply: text, reply_ml = null, outcome = null, close = false, notify = true } = {}) {
    const s = store.get('form_submissions', id);
    if (!s) throw err(404, 'Not found.');
    const def = getDef(s.form_key);
    if (!visible(user, s, def) || !canReview(user, def)) throw err(403, 'You cannot answer this form.');
    if (switchedOff(user, s)) throw err(403, 'This service is switched off in this hamlet.', 'module_off_here');
    if (s.status === 'closed') throw err(409, 'Already closed.');
    if (!text || String(text).trim().length < 2) throw err(400, 'Write a reply.');
    const now = nowIso();
    const row = store.put('form_submissions', { ...s, reply: String(text).slice(0, 4000), reply_ml: reply_ml ? String(reply_ml).slice(0, 4000) : null, outcome: outcome || null, replied_by: user.id, replied_at: now, reply_seen_at: null, status: close ? 'closed' : 'replied', closed_at: close ? now : null }, { actor: user.id });
    store.emit('forms.replied', { id: s.id, form_key: s.form_key, module: s.module, outcome }, { actor: user.id, hamlet_id: s.hamlet_id });
    // Tell the family (outbox → SMS/IVR). Message carries no health details: only that advice is waiting.
    // Never name the form or service: phones are shared, and the form title alone can reveal a condition.
    if (notify && s.person_id) brain.notify(s.person_id, `${brain.brand.short}: you have a message waiting at the centre. Please come on the next visit day.`, { module: s.module }, user);
    return row;
  }

  function claim(user, id) {
    const s = store.get('form_submissions', id);
    if (!s) throw err(404, 'Not found.');
    const def = getDef(s.form_key);
    if (!visible(user, s, def) || !canReview(user, def)) throw err(403, 'You cannot review this form.');
    if (s.status !== 'submitted') return s;
    return store.put('form_submissions', { ...s, status: 'in_review', assigned_to: user.id }, { actor: user.id });
  }

  function markSeen(user, id) {
    const s = store.get('form_submissions', id);
    if (!s) throw err(404, 'Not found.');
    if (!visible(user, s)) throw err(403, 'Not permitted.');
    if (!s.replied_at || s.reply_seen_at) return s;
    return store.put('form_submissions', { ...s, reply_seen_at: nowIso() }, { actor: user.id });
  }

  function close(user, id, { outcome = null } = {}) {
    const s = store.get('form_submissions', id);
    if (!s) throw err(404, 'Not found.');
    const def = getDef(s.form_key);
    if (!visible(user, s, def) || !(canReview(user, def) || s.captured_by === user.id)) throw err(403, 'Not permitted.');
    if (s.status === 'closed') return s;
    return store.put('form_submissions', { ...s, status: 'closed', outcome: outcome || s.outcome, closed_at: nowIso() }, { actor: user.id });
  }

  // CSV export of what this user may see (photos omitted). ODK Central-style column order.
  function exportCsv(user, form_key) {
    const def = getDef(form_key);
    if (!def) throw err(404, 'Form not found.');
    if (!canReview(user, def) && !policy.can(user, 'forms.design')) throw err(403, 'Not permitted.');
    const rows = list(user, { form_key, limit: 1000 });
    const cols = def.fields.filter((f) => !['note', 'photo'].includes(f.type)).map((f) => f.name);
    const q = (v) => { let x = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' ') : String(v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const head = ['submission_id', 'captured_at', 'hamlet', 'person_id', 'status', ...cols, 'flags', 'reply', 'outcome'];
    const lines = [head.join(',')];
    for (const r of rows) lines.push([r.id, r.captured_at, r.hamlet, r.person_id, r.status, ...cols.map((c) => r.answers[c]), (r.flags || []).map((f) => f.code).join(' '), r.reply, r.outcome].map(q).join(','));
    brain.audit(user, 'forms.export', form_key, { rows: rows.length });
    return lines.join('\n') + '\n';
  }

  // ---------------- ODK XLSForm import (subset) ----------------
  // Accepts the "survey" and "choices" sheets as arrays of row objects (e.g. parsed from CSV).
  function fromXlsform({ survey = [], choices = [], settings = {} }) {
    const lists = {};
    const lbl = (r, lang) => {
      const keys = Object.keys(r);
      if (lang === 'ml') { const k = keys.find((x) => /^label::(malayalam|ml)/i.test(x)); return k ? r[k] : null; }
      const k = keys.find((x) => /^label::(english|en)/i.test(x)) || keys.find((x) => x === 'label');
      return k ? r[k] : null;
    };
    for (const c of choices) {
      if (!c.list_name || c.name === undefined) continue;
      (lists[c.list_name] = lists[c.list_name] || []).push({ value: String(c.name), label: lbl(c, 'en') || String(c.name), label_ml: lbl(c, 'ml') || undefined });
    }
    const fields = [];
    const skipped = [];
    const MAP = { text: 'text', integer: 'integer', int: 'integer', decimal: 'decimal', date: 'date', note: 'note', image: 'photo', geopoint: 'geopoint', acknowledge: 'yes_no' };
    for (const r of survey) {
      const rawType = String(r.type || '').trim();
      if (!rawType || /^(begin|end)[ _](group|repeat)/.test(rawType) || ['start', 'end', 'today', 'deviceid', 'calculate'].includes(rawType)) continue;
      const [t0, list] = rawType.split(/\s+/);
      let type = MAP[t0];
      let ch;
      if (t0 === 'select_one' || t0 === 'select_multiple') { type = t0; ch = lists[list]; if (!ch) { skipped.push(`${r.name}: missing choice list ${list}`); continue; } }
      if (!type) { skipped.push(`${r.name || '?'}: type "${rawType}" not supported`); continue; }
      const f = { name: String(r.name).toLowerCase().replace(/[^a-z0-9_]/g, '_'), type, label: lbl(r, 'en') || r.name, label_ml: lbl(r, 'ml') || undefined, hint: r.hint || undefined, required: /^(yes|true|1)$/i.test(String(r.required || '')) };
      if (ch) f.choices = ch;
      // simple relevance: ${x} = 'v'  or  selected(${x}, 'v')
      const rel = String(r.relevant || '').trim();
      let m;
      if ((m = rel.match(/^\$\{(\w+)\}\s*=\s*'([^']*)'$/)) || (m = rel.match(/^selected\(\s*\$\{(\w+)\}\s*,\s*'([^']*)'\s*\)$/))) f.relevant = { field: m[1].toLowerCase(), equals: m[2] };
      else if (rel) skipped.push(`${r.name}: relevance "${rel}" simplified to always shown`);
      fields.push(f);
    }
    return { def: { key: String(settings.form_id || 'imported_form').toLowerCase().replace(/[^a-z0-9_.-]/g, '_'), title: settings.form_title || 'Imported form', fields, source: 'xlsform' }, skipped };
  }

  return {
    TYPES, STATUSES, basic, define, getDef, defsFor, canCapture, canReview, validate, visible, submit, one, list, queue, reply, claim, markSeen, close, exportCsv, fromXlsform,
    rule: (module, key, fn) => rules.set(module + '|' + key, fn),
    setModuleSwitch: (fn) => { moduleOff = fn; },
  };
}

module.exports = { makeForms };
