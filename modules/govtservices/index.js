'use strict';
// Government Services & Schemes — a mobile Akshaya desk for hamlets with no internet.
// At the weekly visit a helper checks which documents a family has, sees which schemes they may be
// eligible for, and fills the application offline. It travels to the city; an Akshaya / ST Department
// officer acts on it (this module NEVER submits to a government portal — staff do that) and records
// the outcome; the status returns to the family on the next visit.
//
// Capture → review → reply uses the Brain's form engine. The module adds: the scheme catalogue,
// an eligibility sub-engine, a document-readiness checklist, a status timeline, and screens.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('./eligibility');

const FORM_KEY = 'govtservices.application';
const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'schemes.json'), 'utf8'));
const SCHEME = Object.fromEntries(CAT.schemes.map((s) => [s.key, s]));
const DOC = Object.fromEntries(CAT.documents.map((d) => [d.key, d]));
const OUTCOME = Object.fromEntries(CAT.outcomes.map((o) => [o.key, o]));
const DOC_STATUSES = ['have', 'missing', 'applied', 'received'];
const STAGE = {
  submitted: { icon: '📨', label: 'Waiting at the office desk', label_ml: 'ഓഫീസ് ഡെസ്കിൽ കാത്തിരിക്കുന്നു', plain: 'Your application has left the hamlet and is waiting for the officer.', plain_ml: 'നിങ്ങളുടെ അപേക്ഷ ഊരിൽ നിന്ന് പോയി, ഉദ്യോഗസ്ഥനെ കാത്തിരിക്കുന്നു.' },
  in_review: { icon: '🔎', label: 'Officer is checking', label_ml: 'ഉദ്യോഗസ്ഥൻ പരിശോധിക്കുന്നു', plain: 'An officer is checking your application.', plain_ml: 'ഒരു ഉദ്യോഗസ്ഥൻ അപേക്ഷ പരിശോധിക്കുന്നു.' },
};
const stageInfo = (k) => OUTCOME[k] || STAGE[k] || { icon: '•', label: k, label_ml: k, plain: k, plain_ml: k };
const DAY = 86400e3;

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, on, brain, httpError, emit } = ctx;
  const P = brain.policy;
  const rule = E.makeRule(CAT);

  // ---------------- the application form ----------------
  // Forwarded to the ST Development Office when it exists on this node; otherwise reviewed within the
  // capturing agency. Re-defined when the agency appears (after seeding, or when it arrives by sync).
  const findStd = () => {
    const ags = brain.agencies.list();
    return ags.find((a) => /ST Development Office/i.test(a.name || ''))
      || ags.find((a) => a.type === 'govt' && /\bST\b|Scheduled Tribe|Tribal/i.test(a.name || '')) || null;
  };
  const formDef = (stdId) => ({
    key: FORM_KEY,
    title: 'Help with a government service', title_ml: 'സർക്കാർ സേവനത്തിനുള്ള സഹായം',
    description: 'Application help for a certificate or scheme. Staff at the office act on it and record the outcome; nothing is sent to a government portal automatically.',
    subject: 'person', scope: 'services', capture_perm: 'services.assist',
    review: stdId ? { perm: 'forms.review', agency_id: stdId } : { perm: 'forms.review' },
    fields: [
      { name: 'scheme', type: 'select_one', label: 'Which certificate or scheme?', label_ml: 'ഏത് സർട്ടിഫിക്കറ്റ് / പദ്ധതി?', required: true, choices: CAT.schemes.map((s) => ({ value: s.key, label: s.title, label_ml: s.title_ml })) },
      { name: 'purpose', type: 'text', label: 'What is it needed for?', label_ml: 'എന്തിനു വേണ്ടിയാണ്?', hint: 'e.g. school admission, pension, PSC', hint_ml: 'ഉദാ. സ്കൂൾ പ്രവേശനം, പെൻഷൻ, PSC', required: true },
      { name: 'docs_available', type: 'select_multiple', label: 'Documents the family has now', label_ml: 'കുടുംബത്തിന്റെ കൈവശമുള്ള രേഖകൾ', choices: CAT.documents.map((d) => ({ value: d.key, label: d.label, label_ml: d.label_ml })) },
      { name: 'docs_missing', type: 'select_multiple', label: 'Documents still missing', label_ml: 'ഇനിയും വേണ്ട രേഖകൾ', choices: CAT.documents.map((d) => ({ value: d.key, label: d.label, label_ml: d.label_ml })) },
      { name: 'doc_photo', type: 'photo', label: 'Photo of a supporting document (optional)', label_ml: 'ഒരു രേഖയുടെ ഫോട്ടോ (വേണമെങ്കിൽ)' },
      { name: 'contact', type: 'select_one', label: 'How should we tell the family?', label_ml: 'കുടുംബത്തെ എങ്ങനെ അറിയിക്കണം?', required: true, choices: [
        { value: 'next_visit', label: 'At the next centre visit', label_ml: 'അടുത്ത സെന്റർ സന്ദർശനത്തിൽ' },
        { value: 'phone', label: 'Phone call', label_ml: 'ഫോൺ വിളി' },
        { value: 'promoter', label: 'Through the ST Promoter', label_ml: 'എസ്.ടി. പ്രൊമോട്ടർ വഴി' }] },
      { name: 'share_consent', type: 'yes_no', label: 'Family agrees to share this application with the ST Department', label_ml: 'ഈ അപേക്ഷ എസ്.ടി. വകുപ്പുമായി പങ്കിടാൻ കുടുംബം സമ്മതിക്കുന്നു', hint: 'Read this aloud to the family. Without it the office cannot see the application.', hint_ml: 'കുടുംബത്തിന് വായിച്ചുകൊടുക്കുക. സമ്മതമില്ലെങ്കിൽ ഓഫീസിന് അപേക്ഷ കാണാനാകില്ല.', required: true },
    ],
  });
  // Robust across nodes: a hub that has not (yet) received the ST Office agency never downgrades a
  // definition that already forwards to it; once the agency arrives the form is re-defined.
  let reviewAgency;
  let checkedAt = 0;
  function ensureForm(force = false) {
    const cur = brain.forms.get(FORM_KEY);
    const curAgency = (cur && cur.review && cur.review.agency_id) || null;
    if (!force && cur && reviewAgency !== undefined && Date.now() - checkedAt < 60_000 && curAgency === reviewAgency) return cur;
    checkedAt = Date.now();
    const std = findStd();
    const id = std ? std.id : curAgency; // keep an existing forward if the agency is unknown here
    reviewAgency = id;
    if (cur && curAgency === id) return cur;
    return brain.forms.define(formDef(id), null);
  }
  ensureForm(true);
  brain.forms.rule(FORM_KEY, (answers, c) => rule(answers, c));

  // ---------------- access helpers ----------------
  const isStaff = (u) => P.can(u, 'services.assist') || P.can(u, 'forms.review');
  // Who is this user to this person, for government-services data? null = no access.
  function access(user, pid) {
    ensureForm();
    const p = brain.persons.raw(pid);
    if (!p || !user) return null;
    if (user.person_id === pid) return 'self';
    if (user.role === 'guardian') return p.guardian_id === user.person_id ? 'guardian' : null;
    if (!isStaff(user)) return null;
    if (user.role === 'platform_admin') return 'steward';
    if (P.canSee(user, pid, 'services').ok) return 'staff';
    const def = brain.forms.get(FORM_KEY);
    if (def && def.review && def.review.agency_id && def.review.agency_id === user.agency_id && P.can(user, 'forms.review') && brain.consent.has(pid, user.agency_id, 'services')) return 'dept';
    return null;
  }
  function need(user, pid) {
    const a = access(user, pid);
    if (!a) throw httpError(403, 'Not permitted: no "services" consent for your agency.');
    if (a === 'steward') brain.audit(user, 'steward.read', pid, { scope: 'services' });
    return a;
  }
  const wards = (user) => (user.role === 'guardian' ? brain.persons.visible(user).filter((p) => p.id !== user.person_id).map((p) => p.id) : []);

  // ---------------- documents ----------------
  const docId = (pid, doc) => 'gsd_' + crypto.createHash('sha1').update(pid + '|' + doc).digest('hex').slice(0, 20);
  function docsOf(pid) {
    const out = {};
    for (const r of data.find('govtservices_documents', { person_id: pid })) out[r.doc] = r;
    return out;
  }
  const docMap = (rows) => Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, r.status]));
  function setDoc(pid, doc, status, user, note = null, { onlyIfUnset = false } = {}) {
    const p = brain.persons.raw(pid);
    const id = docId(pid, doc);
    const cur = data.get('govtservices_documents', id);
    if (onlyIfUnset && cur && !['missing'].includes(cur.status)) return cur;
    if (cur && cur.status === status && (note === null || cur.note === note)) return cur;
    return data.put('govtservices_documents', { id, person_id: pid, hamlet_id: p.hamlet_id, agency_id: (user && user.agency_id) || (cur && cur.agency_id) || null, doc, status, updated_by: user ? user.id : null, note: note !== null ? String(note).slice(0, 300) : (cur ? cur.note : null) }, user);
  }

  // ---------------- applications ----------------
  const logId = (sid, at) => 'gsl_' + crypto.createHash('sha1').update(sid + '|' + at).digest('hex').slice(0, 20);
  // Every reply becomes one step of the family's status timeline (the engine keeps only the latest).
  function logReply(sub, actorId) {
    if (!sub || !sub.replied_at) return null;
    const id = logId(sub.id, sub.replied_at);
    if (data.get('govtservices_status_log', id)) return null;
    const row = data.put('govtservices_status_log', { id, submission_id: sub.id, person_id: sub.person_id, hamlet_id: sub.hamlet_id, agency_id: sub.agency_id, outcome: sub.outcome || null, note: sub.reply, note_ml: sub.reply_ml, by_user: actorId || sub.replied_by, at: sub.replied_at }, actorId ? { id: actorId } : null);
    const sc = SCHEME[sub.answers && sub.answers.scheme];
    if (sc && sc.produces && sub.outcome === 'certificate_ready') setDoc(sub.person_id, sc.produces, 'received', { id: sub.replied_by, agency_id: null });
    return row;
  }
  const safe = (fn) => (ev) => { if (!ev.payload || ev.payload.module !== ctx.id) return; try { fn(ev); } catch (e) { if (!/not open|closed/i.test(e.message)) throw e; } };
  on('forms.submitted', safe((ev) => {
    const s = sqlOne('SELECT * FROM govtservices_form_rows WHERE id=?', ev.payload.id);
    const sc = s && SCHEME[s.answers && s.answers.scheme];
    if (sc && sc.produces && s.person_id) setDoc(s.person_id, sc.produces, 'applied', { id: s.captured_by, agency_id: s.agency_id }, null, { onlyIfUnset: true });
  }));
  on('forms.replied', safe((ev) => logReply(sqlOne('SELECT * FROM govtservices_form_rows WHERE id=?', ev.payload.id), ev.actor)));

  const stageOf = (s) => (s.outcome && OUTCOME[s.outcome] ? s.outcome : s.status === 'closed' ? (s.outcome || 'closed') : s.status === 'replied' ? (s.outcome || 'submitted_to_office') : s.status);
  function timeline(s) {
    const steps = [{ key: 'captured', icon: '📝', label: 'Filled in at the hamlet', label_ml: 'ഊരിൽ വെച്ച് പൂരിപ്പിച്ചു', plain: 'Your helper filled in the application with you.', plain_ml: 'സഹായി നിങ്ങളോടൊപ്പം അപേക്ഷ പൂരിപ്പിച്ചു.', at: s.captured_at }];
    const logs = data.find('govtservices_status_log', { submission_id: s.id }, { order: 'at' });
    for (const l of logs) { const o = stageInfo(l.outcome || 'submitted_to_office'); steps.push({ key: l.outcome, icon: o.icon, label: o.label, label_ml: o.label_ml, plain: o.plain, plain_ml: o.plain_ml, note: l.note, note_ml: l.note_ml, at: l.at }); }
    if (!logs.length && s.reply) { const o = stageInfo(s.outcome || 'submitted_to_office'); steps.push({ key: s.outcome, icon: o.icon, label: o.label, label_ml: o.label_ml, plain: o.plain, plain_ml: o.plain_ml, note: s.reply, note_ml: s.reply_ml, at: s.replied_at }); }
    if (!s.reply && s.status !== 'closed') { const o = STAGE[s.status] || STAGE.submitted; steps.push({ key: s.status, icon: o.icon, label: o.label, label_ml: o.label_ml, plain: o.plain, plain_ml: o.plain_ml, at: null, current: true }); }
    return steps;
  }
  function shape(s, { withTimeline = false } = {}) {
    const sc = SCHEME[s.answers && s.answers.scheme] || {};
    const stage = stageOf(s);
    const st = stageInfo(stage);
    const last = s.replied_at || s.captured_at;
    const final = !!(OUTCOME[stage] && OUTCOME[stage].final) || s.status === 'closed';
    const out = {
      id: s.id, person: s.person || null, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml, hamlet_id: s.hamlet_id, agency_id: s.agency_id,
      scheme: sc.key || (s.answers && s.answers.scheme), scheme_title: sc.title, scheme_title_ml: sc.title_ml, icon: sc.icon || '📄', category: sc.category,
      status: s.status, outcome: s.outcome || null, stage, stage_label: st.label, stage_label_ml: st.label_ml, stage_icon: st.icon, plain: st.plain, plain_ml: st.plain_ml, final,
      flags: s.flags || [], priority: s.priority || 0, captured_at: s.captured_at, replied_at: s.replied_at || null, reply_seen_at: s.reply_seen_at || null,
      waiting_days: Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / DAY)), captured_by_name: s.captured_by_name, replied_by_name: s.replied_by_name,
      purpose: s.answers && s.answers.purpose, contact: s.answers && s.answers.contact, share_consent: s.answers && s.answers.share_consent,
    };
    if (withTimeline) out.timeline = timeline(s);
    return out;
  }
  const listApps = (user, opts = {}) => brain.forms.list(user, { form_key: FORM_KEY, limit: 1000, ...opts });

  // ---------------- routes ----------------
  router.get('/catalogue', authed, (req, res) => res.json({ status: CAT.status, status_ml: CAT.status_ml, disclaimer: CAT.disclaimer, disclaimer_ml: CAT.disclaimer_ml, schemes: CAT.schemes, documents: CAT.documents, outcomes: CAT.outcomes, doc_statuses: DOC_STATUSES }));

  // Hamlets this helper works in (with the per-hamlet switch).
  router.get('/hamlets', requires('services.assist', 'forms.review'), (req, res) => {
    const u = req.user;
    let ids = Array.isArray(u.hamlet_ids) && u.hamlet_ids.length ? u.hamlet_ids : null;
    if (!ids && u.role !== 'platform_admin' && u.agency_id) ids = [...new Set(brain.programmes.list({ agency_id: u.agency_id }).map((p) => p.hamlet_id))];
    const hs = brain.hamlets.list().filter((h) => !ids || ids.includes(h.id));
    res.json(hs.map((h) => ({ id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, enabled: brain.modules.enabledIn(h.id) })));
  });

  // People in a hamlet the helper may assist, with document readiness and open applications.
  router.get('/people', requires('services.assist'), (req, res) => {
    const u = req.user;
    const hid = req.query.hamlet_id || null;
    if (hid && !brain.modules.enabledIn(hid)) throw Object.assign(httpError(403, 'This service is switched off in this hamlet.'), { code: 'module_off_here' });
    const ppl = brain.persons.visible(u, { hamlet_id: hid, limit: 1000 }).filter((p) => brain.modules.enabledIn(p.hamlet_id) && (u.role === 'platform_admin' || P.canSee(u, p.id, 'services').ok));
    const apps = listApps(u, hid ? { hamlet_id: hid } : {});
    const openBy = {};
    for (const a of apps) if (a.status !== 'closed') openBy[a.person_id] = (openBy[a.person_id] || 0) + 1;
    const docs = {};
    if (ppl.length) {
      const ids = ppl.map((p) => p.id);
      for (const r of sql(`SELECT person_id, doc, status FROM govtservices_documents WHERE deleted=0 AND person_id IN (${ids.map(() => '?').join(',')})`, ...ids)) (docs[r.person_id] = docs[r.person_id] || {})[r.doc] = r.status;
    }
    res.json(ppl.map((p) => {
      const b = brain.persons.basic(p.id);
      const d = docs[p.id] || {};
      const sug = E.suggest(b, d, CAT, []);
      return { id: p.id, name: p.name, kind: p.kind, gender: p.gender, age: b.age, school_class: p.school_class, hamlet_id: p.hamlet_id, household_id: p.household_id || null,
        docs_have: Object.values(d).filter((s) => E.HAVE.has(s)).length, docs_missing: Object.values(d).filter((s) => s === 'missing').length, docs_checked: Object.keys(d).length,
        open_applications: openBy[p.id] || 0, suggestions: sug.filter((s) => s.confidence === 'likely' && s.state === 'suggest').length };
    }));
  });

  // Eligibility suggestions + missing documents for one person (policy-checked).
  router.get('/suggest/:personId', authed, (req, res) => {
    const pid = req.params.personId;
    need(req.user, pid);
    const b = brain.persons.basic(pid);
    const rows = docsOf(pid);
    const open = listApps(req.user, { person_id: pid }).filter((a) => a.status !== 'closed').map((a) => ({ id: a.id, scheme: a.answers && a.answers.scheme }));
    const suggestions = E.suggest(b, docMap(rows), CAT, open);
    res.json({ person: { id: b.id, name: b.name, age: b.age, gender: b.gender, kind: b.kind, school_class: b.school_class, hamlet_id: b.hamlet_id }, status: CAT.status,
      suggestions, missing_documents: E.missingDocs(suggestions), documents: CAT.documents.map((d) => ({ ...d, status: rows[d.key] ? rows[d.key].status : null, note: rows[d.key] ? rows[d.key].note : null, updated_at: rows[d.key] ? rows[d.key].updated_at : null })) });
  });

  router.get('/documents/:personId', authed, (req, res) => {
    const pid = req.params.personId;
    need(req.user, pid);
    const rows = docsOf(pid);
    res.json(CAT.documents.map((d) => ({ ...d, status: rows[d.key] ? rows[d.key].status : null, note: rows[d.key] ? rows[d.key].note : null, updated_at: rows[d.key] ? rows[d.key].updated_at : null })));
  });
  // Helpers update the checklist; the family sees it.
  router.put('/documents/:personId', requires('services.assist', 'forms.review'), (req, res) => {
    const pid = req.params.personId;
    const a = need(req.user, pid);
    if (!['staff', 'steward', 'dept'].includes(a)) throw httpError(403, 'Only helpers update the checklist.');
    const p = brain.persons.raw(pid);
    if (!brain.modules.enabledIn(p.hamlet_id)) throw httpError(403, 'This service is switched off in this hamlet.');
    const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
    const out = [];
    tx(() => {
      for (const it of items) {
        if (!DOC[it.doc]) throw httpError(400, 'Unknown document: ' + it.doc);
        if (!DOC_STATUSES.includes(it.status)) throw httpError(400, 'Status must be have, missing, applied or received.');
        out.push(setDoc(pid, it.doc, it.status, req.user, it.note === undefined ? null : it.note));
      }
    });
    emit('govtservices.documents_updated', { person_id: pid, count: out.length }, req.user, p.hamlet_id);
    res.json(out);
  });

  // Applications board for helpers and officers: grouped by stage, oldest waiting first.
  router.get('/applications', requires('services.assist', 'forms.review'), (req, res) => {
    const rows = listApps(req.user, { hamlet_id: req.query.hamlet_id || null, person_id: req.query.person_id || null, mine: req.query.mine === '1' }).map((s) => shape(s));
    const filtered = req.query.stage ? rows.filter((r) => r.stage === req.query.stage) : rows;
    filtered.sort((a, b) => (a.final - b.final) || (b.priority - a.priority) || (b.waiting_days - a.waiting_days));
    res.json(filtered);
  });

  // Office / department queue: what this officer can act on, new items first, then those in progress.
  router.get('/office', requires('forms.review'), (req, res) => {
    const u = req.user;
    ensureForm();
    const queued = new Set(brain.forms.queue(u, { form_key: FORM_KEY }).map((s) => s.id));
    const def = brain.forms.get(FORM_KEY);
    const rows = listApps(u, { hamlet_id: req.query.hamlet_id || null }).filter((s) => brain.forms.canReview(u, FORM_KEY) && (queued.has(s.id) || s.status === 'replied')).map((s) => ({ ...shape(s), new: queued.has(s.id) }));
    rows.sort((a, b) => (b.new - a.new) || (b.priority - a.priority) || (b.waiting_days - a.waiting_days));
    res.json({ forwarded_to: def && def.review && def.review.agency_id ? (brain.agencies.get(def.review.agency_id) || {}).name : null, items: rows });
  });

  router.get('/applications/:id', authed, (req, res) => {
    const s = brain.forms.one(req.user, req.params.id);
    if (s.form_key !== FORM_KEY) throw httpError(404, 'Not found.');
    const docs = s.person_id ? docMap(docsOf(s.person_id)) : {};
    const sc = SCHEME[s.answers.scheme];
    const answers = { ...s.answers };
    res.json({ ...shape(s, { withTimeline: true }), answers, can_reply: s.can_reply, scheme_info: sc || null, documents: docs, outcomes: CAT.outcomes });
  });

  // Officer records what happened at the office. Final outcomes close the case.
  router.post('/applications/:id/outcome', requires('forms.review'), (req, res) => {
    const { outcome, note, note_ml } = req.body || {};
    if (!OUTCOME[outcome]) throw httpError(400, 'Choose an outcome: ' + Object.keys(OUTCOME).join(', '));
    const o = OUTCOME[outcome];
    const text = note && String(note).trim().length >= 2 ? String(note) : o.plain;
    const textMl = note_ml && String(note_ml).trim() ? String(note_ml) : (note ? null : o.plain_ml);
    const row = brain.forms.reply(req.user, req.params.id, { reply: text, reply_ml: textMl, outcome, close: !!o.final });
    logReply(row, req.user.id);
    res.json(shape({ ...row, ...brain.forms.one(req.user, row.id) }, { withTimeline: true }));
  });

  // Is this person's application shared with the department? (helpers use it to record consent in person)
  router.get('/share/:personId', requires('services.assist'), (req, res) => {
    const pid = req.params.personId;
    const a = need(req.user, pid);
    if (!['staff', 'steward'].includes(a)) throw httpError(403, 'Not permitted.');
    const def = brain.forms.get(FORM_KEY);
    const agency = def && def.review && def.review.agency_id ? brain.agencies.get(def.review.agency_id) : null;
    if (!agency) return res.json({ agency: null, shared: false, scopes: [] });
    const scopes = Object.keys(P.SCOPES).filter((sc) => brain.consent.has(pid, agency.id, sc));
    const p = brain.persons.raw(pid);
    res.json({ agency: { id: agency.id, name: agency.name }, shared: scopes.includes('services'), scopes, minor: P.isMinor(p), guardian_id: p.guardian_id || null });
  });

  // Family view: the person themself, or a guardian for their wards. Plain-language status.
  router.get('/my', authed, (req, res) => {
    const u = req.user;
    if (!u.person_id) throw httpError(403, 'This view is for families.');
    const ids = [u.person_id, ...wards(u)];
    const apps = listApps(u);
    res.json({ status: CAT.status, members: ids.map((pid) => {
      const b = brain.persons.basic(pid);
      if (!b) return null;
      const rows = docsOf(pid);
      const mine = apps.filter((a) => a.person_id === pid);
      const open = mine.filter((a) => a.status !== 'closed').map((a) => ({ id: a.id, scheme: a.answers && a.answers.scheme }));
      const sug = E.suggest(b, docMap(rows), CAT, open).filter((s) => s.confidence === 'likely' && s.state === 'suggest').slice(0, 4);
      return { id: b.id, name: b.name, self: pid === u.person_id, age: b.age, kind: b.kind,
        documents: CAT.documents.filter((d) => rows[d.key]).map((d) => ({ key: d.key, icon: d.icon, label: d.label, label_ml: d.label_ml, status: rows[d.key].status })),
        applications: mine.map((s) => shape(s, { withTimeline: true })),
        suggestions: sug.map((s) => ({ key: s.key, icon: s.icon, title: s.title, title_ml: s.title_ml, reason: s.reason, reason_ml: s.reason_ml, missing: s.missing.map((m) => ({ label: m.label, label_ml: m.label_ml })) })) };
    }).filter(Boolean) });
  });

  // Aggregate for donors / government: per hamlet, by scheme and outcome. Small counts suppressed; no names.
  router.get('/aggregate', requires('analytics.aggregate'), (req, res) => {
    const u = req.user;
    // Other agencies' admins see only their own agency's applications; stewards and external viewers see all (suppressed).
    const all = ['platform_admin', 'donor', 'govt_viewer'].includes(u.role);
    const rows = sql(`SELECT hamlet_id, answers, status, outcome FROM govtservices_form_rows WHERE deleted=0 AND module=? AND form_key=?${all ? '' : ' AND agency_id=?'}`, ctx.id, FORM_KEY, ...(all ? [] : [u.agency_id || '-']));
    const by = {};
    const tot = { total: 0, by_scheme: {}, by_outcome: {} };
    for (const r of rows) {
      let a = r.answers;
      if (typeof a === 'string') { try { a = JSON.parse(a); } catch (_) { a = {}; } }
      const scheme = (a && a.scheme) || 'unknown';
      const stage = r.outcome && OUTCOME[r.outcome] ? r.outcome : (r.status === 'replied' ? 'submitted_to_office' : r.status === 'closed' ? 'closed' : 'waiting');
      const h = (by[r.hamlet_id] = by[r.hamlet_id] || { total: 0, by_scheme: {}, by_outcome: {} });
      for (const x of [h, tot]) { x.total++; x.by_scheme[scheme] = (x.by_scheme[scheme] || 0) + 1; x.by_outcome[stage] = (x.by_outcome[stage] || 0) + 1; }
    }
    // Always suppress small counts here (scheme names like widow/disability pension are sensitive), then hide
    // any total whose hamlet cells include a hidden one, so totals cannot be subtracted back.
    const ks = (v) => (u.role === 'platform_admin' ? v : v > 0 && v < 5 ? '<5' : v);
    const sup = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ks(v)]));
    const hamlets = Object.entries(by).map(([hid, x]) => { const h = brain.hamlets.get(hid) || {}; return { hamlet_id: hid, name: h.name, name_ml: h.name_ml, district: h.district, total: ks(x.total), by_scheme: sup(x.by_scheme), by_outcome: sup(x.by_outcome) }; });
    const hiddenIn = (field, k) => hamlets.some((h) => typeof (k ? h[field][k] : h[field]) === 'string');
    const totSup = (field) => Object.fromEntries(Object.entries(tot[field]).map(([k, v]) => [k, hiddenIn(field, k) ? 'hidden' : ks(v)]));
    res.json({ k_anonymity: 5, note: 'Counts below 5 are shown as "<5". No names or person-level data.', note_ml: '5-ൽ താഴെയുള്ള എണ്ണം "<5" എന്ന് കാണിക്കും. പേരുകളോ വ്യക്തിഗത വിവരങ്ങളോ ഇല്ല.',
      schemes: CAT.schemes.map((s) => ({ key: s.key, title: s.title, title_ml: s.title_ml, icon: s.icon })), outcomes: CAT.outcomes.map((o) => ({ key: o.key, label: o.label, label_ml: o.label_ml, icon: o.icon })),
      totals: { total: hiddenIn('total') ? 'hidden' : ks(tot.total), by_scheme: totSup('by_scheme'), by_outcome: totSup('by_outcome') }, hamlets });
  });

  // ---------------- seed ----------------
  async function seed(demo) {
    const R = demo.rng(9401); // own stream — never demo.R
    const { store, brain: B, daysAgo } = demo;
    const A = demo.agencyByKey, H = demo.hamletByKey;
    const std = A.std, cif = A.cif, kyg = A.kyg;
    ensureForm(true);
    const users = demo.users;
    let akshaya;
    tx(() => {
      akshaya = brain.users.create({ username: 'demo.akshaya', password: demo.DEMO_PASSWORD, role: 'field_officer', display_name: 'Akshaya desk — ST Development Office (demo)', agency_id: std.id, safeguarding_trained: 1 }, null);
    });
    users.akshaya = akshaya;

    // Programmes: CIF runs the mobile Akshaya desk in h1, h2 and h11; the youth group runs it at Komalikudi.
    const progs = {};
    const centre = (hid, aid) => (demo.centres || []).find((c) => c.hamlet_id === hid && c.agency_id === aid);
    tx(() => {
      for (const hk of ['h1', 'h2', 'h11']) {
        const c = centre(H[hk].id, cif.id);
        progs['cif.' + hk] = brain.programmes.create({ agency_id: cif.id, hamlet_id: H[hk].id, centre_id: c ? c.id : null, module: ctx.id, track: 'services', title: 'Mobile Akshaya Desk — certificates & schemes', title_ml: 'മൊബൈൽ അക്ഷയ ഡെസ്ക് — സർട്ടിഫിക്കറ്റുകളും പദ്ധതികളും', schedule: ['Visit day'], capacity: 200 }, null);
      }
      const c = centre(H.h11.id, kyg.id);
      progs['kyg.h11'] = brain.programmes.create({ agency_id: kyg.id, hamlet_id: H.h11.id, centre_id: c ? c.id : null, module: ctx.id, track: 'services', title: 'Scheme Help Desk — Komalikudi', title_ml: 'പദ്ധതി സഹായ ഡെസ്ക് — കോമളിക്കുടി', brand: 'AADI Smart Learning Centre', brand_ml: 'ആദി സ്മാർട്ട് ലേണിംഗ് സെന്റർ', sponsor_agency_id: cif.id, schedule: ['Visit day'], capacity: 200 }, null);
    });

    // A few fictional elders (pension-age) join existing demo households in the service hamlets.
    const ELDERS = [['Kali', 'F'], ['Chellan', 'M'], ['Maathi', 'F'], ['Velan', 'M'], ['Karuppi', 'F'], ['Mallan', 'M']];
    const elders = [];
    tx(() => {
      let i = 0;
      for (const hk of ['h1', 'h2', 'h11']) {
        const hhs = demo.households.filter((h) => h.hamlet_id === H[hk].id);
        for (let j = 0; j < 2; j++) {
          const [nm, g] = ELDERS[i++];
          const hh = hhs[R.int(0, hhs.length - 1)];
          const age = R.int(61, 78);
          const dob = new Date(Date.now() - (age * 365.25 + R.int(10, 300)) * DAY).toISOString().slice(0, 10);
          elders.push(store.put('persons', { hamlet_id: H[hk].id, name: `${nm} ${R.pick(['K', 'M', 'R', 'V'])} (demo)`, gender: g, dob, kind: 'adult', language: 'Malayalam', household_id: hh ? hh.id : null, literacy_level: R.pick(['none', 'basic']), notes: 'Fictional elder added by the government services demo' }));
        }
      }
    });

    // Consent + enrolment: add "services" to existing consents (merging scopes), minors via guardian.
    const consentFor = (pid, aid) => store.find('consents', { person_id: pid, agency_id: aid, status: 'active' })[0];
    const grantMerge = (p, aid, scopes) => {
      const cur = consentFor(p.id, aid);
      const minor = P.isMinor(p);
      const by = minor ? p.guardian_id : p.id;
      if (minor && !by) return null;
      const all = [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : ['profile']), ...scopes])];
      const c = B.grantConsent({ person_id: p.id, agency_id: aid, scopes: all, granted_by: cur ? cur.granted_by : by, relation: cur ? cur.relation : (minor ? (p.relation || 'guardian') : 'self'), method: cur ? cur.method : 'in_person' }, null);
      store.put('consents', { ...c, granted_at: daysAgo(R.int(95, 140)) });
      return c;
    };
    const served = [];
    tx(() => {
      for (const [hk, aid, prog] of [['h1', cif.id, progs['cif.h1']], ['h2', cif.id, progs['cif.h2']], ['h11', kyg.id, progs['kyg.h11']]]) {
        const people = [...demo.persons.filter((p) => p.hamlet_id === H[hk].id), ...elders.filter((e) => e.hamlet_id === H[hk].id)];
        for (const p0 of people) {
          const p = store.get('persons', p0.id);
          const has = consentFor(p.id, aid);
          const isElder = elders.some((e) => e.id === p.id);
          const forced = p.id === demo.demoLearner.id || p.id === demo.demoGuardian.id;
          if (!forced && !isElder && !(has ? R.chance(0.7) : (p.kind === 'adult' && R.chance(0.45)))) continue;
          if (!grantMerge(p, aid, has ? ['services'] : ['profile', 'contact', 'services'])) continue;
          brain.enrolments.enrol(p.id, prog.id, null);
          served.push(p);
          // Some families also agreed, in person, to share applications with the ST Department.
          // (Youth in Pachakkudi have not been asked yet — the core engine tests rely on that.)
          const askedDept = !(hk === 'h1' && p.kind === 'youth');
          if (askedDept && (isElder || forced || R.chance(0.55))) grantMerge(p, std.id, ['services']);
        }
      }
    });

    // Document checklists (the helper's visit notes).
    const helperFor = (p) => (p.hamlet_id === H.h11.id ? users['aadi.facilitator'] : p.hamlet_id === H.h2.id ? users.facilitator2 : users.facilitator);
    tx(() => {
      for (const p of served) {
        const u = helperFor(p);
        const age = brain.persons.basic(p.id).age;
        const base = { aadhaar: 0.85, ration_card: p.kind === 'adult' ? 0.8 : 0.6, community_cert: 0.55, income_cert: 0.35, birth_cert: p.kind === 'child' ? 0.75 : 0.4, bank_passbook: age >= 14 ? 0.6 : 0.2, photo: 0.5 };
        if (p.kind !== 'adult') Object.assign(base, { school_cert: 0.6, marks_list: 0.4 });
        if (age >= 60) Object.assign(base, { age_proof: 0.5 });
        for (const [doc, pr] of Object.entries(base)) {
          if (!R.chance(0.85)) continue;
          setDoc(p.id, doc, R.chance(pr) ? 'have' : 'missing', { id: u.id, agency_id: u.agency_id });
        }
      }
    });

    // ~3 months of applications in various outcomes.
    const suggestFor = (p) => E.suggest(brain.persons.basic(p.id), docMap(docsOf(p.id)), CAT, []).filter((s) => s.confidence === 'likely' || R.chance(0.15));
    const NOTE = {
      submitted_to_office: ['Given at the Village Office counter.', 'വില്ലേജ് ഓഫീസ് കൗണ്ടറിൽ നൽകി.'],
      need_more_documents: ['Office needs a ration card copy and the parent\'s certificate. Please bring them next visit.', 'ഓഫീസിന് റേഷൻ കാർഡിന്റെ പകർപ്പും രക്ഷിതാവിന്റെ സർട്ടിഫിക്കറ്റും വേണം. അടുത്ത സന്ദർശനത്തിൽ കൊണ്ടുവരിക.'],
      approved: ['Approved by the office.', 'ഓഫീസ് അംഗീകരിച്ചു.'],
      rejected: ['Not approved this time — the officer will explain at the next visit and help re-apply.', 'ഇത്തവണ അംഗീകരിച്ചില്ല — അടുത്ത സന്ദർശനത്തിൽ ഉദ്യോഗസ്ഥൻ കാരണം പറയുകയും വീണ്ടും അപേക്ഷിക്കാൻ സഹായിക്കുകയും ചെയ്യും.'],
      certificate_ready: ['Ready — collect at the centre on the next visit day.', 'തയ്യാർ — അടുത്ത സന്ദർശന ദിവസം സെന്ററിൽ നിന്ന് വാങ്ങുക.'],
    };
    const PATHS = [[], ['submitted_to_office'], ['submitted_to_office', 'need_more_documents'], ['submitted_to_office', 'approved'], ['submitted_to_office', 'approved', 'certificate_ready'], ['need_more_documents', 'submitted_to_office', 'approved', 'certificate_ready'], ['submitted_to_office', 'rejected']];
    let n = 0;
    tx(() => {
      const pool = served.filter((p) => !P.isMinor(store.get('persons', p.id)) || R.chance(0.5));
      const chosen = [...new Set([demo.demoLearner, ...elders, ...R.sample(pool, 46)].map((p) => p.id))].map((id) => store.get('persons', id)).filter((p) => served.some((s) => s.id === p.id));
      for (const p of chosen) {
        const opts = suggestFor(p);
        if (!opts.length) continue;
        const s = p.id === demo.demoLearner.id ? (opts.find((o) => o.category === 'scholarship') || opts[0]) : elders.some((e) => e.id === p.id) ? (opts.find((o) => o.key === 'pension_old_age') || opts[0]) : R.pick(opts.slice(0, 4));
        const u = B.store.get('users', helperFor(p).id);
        const sharedStd = brain.consent.has(p.id, std.id, 'services');
        const answers = {
          scheme: s.key, purpose: R.pick(s.category === 'scholarship' ? ['School / college fees', 'Hostel admission'] : s.category === 'pension' ? ['Monthly pension', 'Pension for daily needs'] : ['Needed for school admission', 'Needed for a scheme application', 'PSC application', 'Family record']),
          docs_available: s.have.map((d) => d.key), docs_missing: s.missing.map((d) => d.key),
          contact: R.pick(['next_visit', 'next_visit', 'phone', 'promoter']), share_consent: sharedStd ? 'yes' : (R.chance(0.6) ? 'no' : 'yes'),
        };
        const age0 = R.int(4, 92);
        const sub = B.forms.submit(u, { form_key: FORM_KEY, person_id: p.id, answers, client_ref: 'seed-gs-' + p.id + '-' + s.key }, {});
        let row = store.put('form_submissions', { ...store.get('form_submissions', sub.id), captured_at: daysAgo(age0) });
        if (s.produces) setDoc(p.id, s.produces, 'applied', { id: u.id, agency_id: u.agency_id });
        n++;
        if (!sharedStd) continue; // the department never sees it without the family's consent
        const path = p.id === demo.demoLearner.id ? ['submitted_to_office', 'need_more_documents'] : elders.some((e) => e.id === p.id) ? R.pick([['submitted_to_office'], ['submitted_to_office', 'approved'], []]) : (age0 < 7 ? [] : R.pick(PATHS));
        let t = age0;
        for (const oc of path) {
          t = Math.max(0, t - R.int(3, 14));
          const at = daysAgo(t);
          const final = OUTCOME[oc].final;
          row = store.put('form_submissions', { ...row, reply: NOTE[oc][0], reply_ml: NOTE[oc][1], outcome: oc, replied_by: akshaya.id, replied_at: at, reply_seen_at: R.chance(0.6) ? at : null, status: final ? 'closed' : 'replied', closed_at: final ? at : null, assigned_to: akshaya.id });
          data.put('govtservices_status_log', { id: logId(row.id, at), submission_id: row.id, person_id: p.id, hamlet_id: row.hamlet_id, agency_id: row.agency_id, outcome: oc, note: NOTE[oc][0], note_ml: NOTE[oc][1], by_user: akshaya.id, at }, null);
          if (oc === 'certificate_ready' && s.produces) setDoc(p.id, s.produces, 'received', { id: akshaya.id, agency_id: std.id });
        }
        if (!path.length && R.chance(0.3)) row = store.put('form_submissions', { ...row, status: 'in_review', assigned_to: akshaya.id });
      }
    });
    ctx.log(`seeded ${served.length} people with services consent, ${elders.length} elders, ${n} applications`);
  }

  return {
    seed,
    health: () => ({ form: brain.forms.get(FORM_KEY) ? 'ok' : 'missing', forwarded_to: reviewAgency, schemes: CAT.schemes.length, catalogue: CAT.status }),
  };
};
