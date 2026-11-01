'use strict';
// Human–Wildlife Conflict & Environment.
// Elephants, wild boar, gaur and others damage crops and houses and sometimes hurt people. Families are
// entitled to compensation from the Forest Department but rarely manage the paperwork. On the weekly
// visit the helper records the incident (photos, location) with the family; the record travels to the
// Forest Range Office (only with the family's "livelihood" consent to it), the claim is tracked step by
// step in plain words, the hamlet logs sightings for early warning, and simple environment readings
// (rain gauge, stream level, water strips, camera traps) are kept per hamlet.
//
// Capture → review → reply uses the Brain's form engine. This module adds: the incident rule, a claim
// tracker with validated status transitions, hamlet-level sightings and readings, and screens.
const crypto = require('crypto');
const L = require('./lib');

const FORM_KEY = 'wildlife.incident';
const DAY = L.DAY;
const ch = (value, label, label_ml) => ({ value, label, label_ml });
const pick = (list) => list.map((x) => ch(x.value, (x.icon ? x.icon + ' ' : '') + x.label, (x.icon ? x.icon + ' ' : '') + x.label_ml));
const CROPS = [
  ch('banana', 'Banana', 'വാഴ'), ch('tapioca', 'Tapioca', 'കപ്പ'), ch('paddy', 'Paddy', 'നെല്ല്'), ch('coconut', 'Coconut', 'തെങ്ങ്'),
  ch('arecanut', 'Arecanut', 'കമുക്'), ch('cardamom', 'Cardamom', 'ഏലം'), ch('pepper', 'Pepper', 'കുരുമുളക്'), ch('coffee', 'Coffee', 'കാപ്പി'),
  ch('ginger', 'Ginger', 'ഇഞ്ചി'), ch('vegetables', 'Vegetables', 'പച്ചക്കറി'), ch('rubber', 'Rubber', 'റബ്ബർ'), ch('other', 'Other', 'മറ്റുള്ളവ'),
];
const CROP = Object.fromEntries(CROPS.map((c) => [c.value, c]));
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 20);
const claimId = (sid) => 'wlc_' + sha(sid);

const formDef = (forestId) => ({
  key: FORM_KEY,
  title: 'Wild animal incident (for compensation)', title_ml: 'കാട്ടുമൃഗ ആക്രമണം (നഷ്ടപരിഹാരത്തിന്)',
  description: 'Record crop, house, livestock or grain damage, or an injury, caused by a wild animal. With the family\'s consent it goes to the Forest Range Office and the compensation claim is tracked.',
  subject: 'person', scope: 'livelihood',
  review: forestId ? { perm: 'forms.review', agency_id: forestId } : { perm: 'forms.review' },
  fields: [
    { name: 'incident_date', type: 'date', label: 'When did it happen?', label_ml: 'എന്നാണ് സംഭവിച്ചത്?', required: true },
    { name: 'time_of_day', type: 'select_one', label: 'Time of day', label_ml: 'സമയം', required: true, choices: L.TIMES.map((t) => ch(t.value, t.label, t.label_ml)) },
    { name: 'animal', type: 'select_one', label: 'Which animal?', label_ml: 'ഏത് മൃഗം?', required: true, choices: pick(L.ANIMALS) },
    { name: 'damage', type: 'select_multiple', label: 'What was damaged?', label_ml: 'എന്താണ് നശിച്ചത്?', required: true, choices: pick(L.DAMAGES) },
    { name: 'crop', type: 'select_one', label: 'Which crop?', label_ml: 'ഏത് വിള?', relevant: { field: 'damage', equals: 'crops' }, choices: CROPS },
    { name: 'crop_area_cents', type: 'integer', label: 'Area of crop damaged', label_ml: 'നശിച്ച കൃഷിയുടെ വിസ്തീർണം', unit: 'cents', min: 0, max: 100000, hint: '1 acre = 100 cents. A rough figure is fine.', hint_ml: '1 ഏക്കർ = 100 സെന്റ്. ഏകദേശ കണക്ക് മതി.', relevant: { field: 'damage', equals: 'crops' } },
    { name: 'plants_damaged', type: 'integer', label: 'Number of plants / trees damaged (if counted)', label_ml: 'നശിച്ച ചെടികൾ / മരങ്ങൾ (എണ്ണിയെങ്കിൽ)', min: 0, max: 100000, relevant: { field: 'damage', equals: 'crops' } },
    { name: 'items_damaged', type: 'textarea', label: 'What else was damaged? (house part, animals, sacks of grain …)', label_ml: 'മറ്റെന്തെല്ലാം നശിച്ചു? (വീടിന്റെ ഭാഗം, മൃഗങ്ങൾ, ധാന്യച്ചാക്ക് …)', relevant: { field: 'damage', in: ['house', 'livestock', 'stored_grain'] } },
    { name: 'estimated_loss', type: 'integer', label: 'Estimated loss', label_ml: 'ഏകദേശ നഷ്ടം', unit: '₹', required: true, min: 0, max: 10000000, hint: 'The family\'s own estimate. The forest officer will assess it.', hint_ml: 'കുടുംബത്തിന്റെ സ്വന്തം കണക്ക്. വനം ഉദ്യോഗസ്ഥൻ വിലയിരുത്തും.' },
    { name: 'photo1', type: 'photo', label: 'Photo of the damage', label_ml: 'നാശത്തിന്റെ ഫോട്ടോ', hint: 'Show the damage clearly; include something for size (a person, a stick).', hint_ml: 'നാശം വ്യക്തമായി കാണിക്കുക; വലിപ്പം അറിയാൻ ഒരാളെയോ വടിയോ ഉൾപ്പെടുത്തുക.' },
    { name: 'photo2', type: 'photo', label: 'Second photo (optional)', label_ml: 'രണ്ടാമത്തെ ഫോട്ടോ (വേണമെങ്കിൽ)' },
    { name: 'location', type: 'geopoint', label: 'Location of the damage', label_ml: 'നാശം സംഭവിച്ച സ്ഥലം', hint: 'Stand at the damaged plot or house and press the button.', hint_ml: 'നാശം സംഭവിച്ച സ്ഥലത്ത് നിന്ന് ബട്ടൺ അമർത്തുക.' },
    { name: 'witnesses', type: 'integer', label: 'How many people saw the damage or the animal?', label_ml: 'എത്ര പേർ നാശമോ മൃഗത്തെയോ കണ്ടു?', min: 0, max: 50 },
    { name: 'reported_forest', type: 'yes_no', label: 'Already told the forest office?', label_ml: 'വനം ഓഫീസിനെ ഇതിനകം അറിയിച്ചോ?', required: true },
    { name: 'notes', type: 'textarea', label: 'Anything else', label_ml: 'മറ്റ് വിവരങ്ങൾ' },
  ],
});

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError } = ctx;
  const P = brain.policy;
  const S = (v, max = 300) => (v === undefined || v === null ? '' : String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, max).trim());
  const off = (msg = 'This service is switched off in this hamlet.') => Object.assign(httpError(403, msg), { code: 'module_off_here' });
  const deny = (msg) => httpError(403, msg);

  // ---------------- the incident form, forwarded to the Forest Range Office ----------------
  // Looked up by name; re-defined when the agency appears (after seeding, or when it arrives by sync).
  // A hub that has not received the agency yet never downgrades a definition that already forwards.
  const findForest = () => {
    const ags = brain.agencies.list();
    return ags.find((a) => /Forest Range Office/i.test(a.name || ''))
      || ags.find((a) => /Forest (Department|Division|Office)|Range Office|Vanam|വനം/i.test(a.name || '')) || null;
  };
  let reviewAgency;
  let checkedAt = 0;
  function ensureForm(force = false) {
    const cur = brain.forms.get(FORM_KEY);
    const curAgency = (cur && cur.review && cur.review.agency_id) || null;
    if (!force && cur && reviewAgency !== undefined && Date.now() - checkedAt < 60_000 && curAgency === reviewAgency) return cur;
    checkedAt = Date.now();
    const fo = findForest();
    const id = fo ? fo.id : curAgency;
    reviewAgency = id;
    if (cur && curAgency === id) return cur;
    return brain.forms.define(formDef(id), null);
  }
  ensureForm(true);
  brain.forms.rule(FORM_KEY, (answers) => L.assess(answers));
  const forestId = () => { ensureForm(); return reviewAgency || null; };
  // Who may answer an incident — on this module's routes AND the generic core routes: only the range office
  // the form is forwarded to (its field officers or its admin). The engine already refuses other agencies
  // and the capturer; this also refuses other roles of that office and any form not yet forwarded.
  brain.forms.decider(FORM_KEY, (u, s, def) => {
    const to = def && def.review && def.review.agency_id;
    if (!to) return 'This incident has not been forwarded to a Forest Range Office yet.';
    if (!u.agency_id || u.agency_id !== to || !['field_officer', 'agency_admin'].includes(u.role)) return 'Only the Forest Range Office replies to incidents.';
    return true;
  });

  // ---------------- who may do what ----------------
  const isDept = (u, agencyId = null) => { agencyId = agencyId || forestId(); return !!(u && u.agency_id && agencyId && u.agency_id === agencyId && P.can(u, 'forms.review')); };
  const raw = (pid) => brain.persons.raw(pid);
  const minorWards = (u) => brain.persons.wards(u).map((p) => p.id);
  // A family member sees records of themself and (guardians) their MINOR wards only.
  const familyIds = (u) => (u && u.person_id ? [u.person_id, ...(u.role === 'guardian' ? minorWards(u) : [])] : []);
  const isFamily = (u) => ['learner', 'guardian'].includes(u.role);
  const present = (agencyId, hid) => !!sqlOne("SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0 AND status='active'", agencyId, hid);

  // Hamlet-level access (sightings, readings): staff of the hamlet, the forest office where present, residents.
  function hamletAccess(u, hid) {
    if (!u || !hid || !brain.hamlets.get(hid)) return null;
    if (u.role === 'platform_admin') return 'steward';
    if (isFamily(u)) { const p = u.person_id && raw(u.person_id); return p && p.hamlet_id === hid ? 'resident' : null; }
    if (['donor', 'govt_viewer', 'employer', 'cpo'].includes(u.role) || !u.agency_id) return null;
    if (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length) return u.hamlet_ids.includes(hid) ? 'staff' : null;
    return present(u.agency_id, hid) ? 'staff' : null;
  }
  function needHamlet(u, hid, { write = false } = {}) {
    const a = hamletAccess(u, hid);
    if (!a) throw deny('This hamlet is outside your area.');
    if (a !== 'steward' && !brain.modules.enabledIn(hid)) throw off();
    if (write && a === 'resident') {
      const p = raw(u.person_id);
      if (P.isMinor(p)) throw deny('Please ask an adult or the facilitator to record this.');
    }
    return a;
  }
  function myHamlets(u) {
    let ids;
    if (u.role === 'platform_admin') ids = brain.hamlets.list().map((h) => h.id);
    else if (isFamily(u)) { const p = u.person_id && raw(u.person_id); ids = p ? [p.hamlet_id] : []; }
    else if (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length) ids = u.hamlet_ids;
    else if (u.agency_id) ids = sql("SELECT DISTINCT hamlet_id FROM agency_presence WHERE agency_id=? AND deleted=0 AND status='active'", u.agency_id).map((r) => r.hamlet_id);
    else ids = [];
    return ids.map((id) => brain.hamlets.get(id)).filter(Boolean);
  }

  // ---------------- claims ----------------
  const claimStatus = (k) => L.CLAIM_STATUS[k] || { icon: '•', label: k, label_ml: k, plain: k, plain_ml: k };
  function logStep(claim, status, { by = null, amount = null, note = null, note_ml = null, at = new Date().toISOString() } = {}) {
    return data.put('wildlife_claim_log', { id: 'wll_' + sha(claim.id + '|' + status + '|' + at), claim_id: claim.id, submission_id: claim.submission_id, person_id: claim.person_id, hamlet_id: claim.hamlet_id, agency_id: claim.agency_id, status, amount, note, note_ml, by_user: by ? by.id : null, by_role: by ? by.role : null, at }, by);
  }
  // Every incident gets a claim file at once ("prepared"). Idempotent: deterministic id per submission.
  function ensureClaim(sub, actor = null) {
    if (!sub || sub.form_key !== FORM_KEY || !sub.person_id) return null;
    const id = claimId(sub.id);
    const cur = data.get('wildlife_claims', id);
    if (cur) return cur;
    const a = sub.answers || {};
    const claim = data.put('wildlife_claims', {
      id, submission_id: sub.id, person_id: sub.person_id, hamlet_id: sub.hamlet_id, agency_id: sub.agency_id || null,
      review_agency_id: forestId(), status: 'prepared', amount_claimed: Number(a.estimated_loss) || 0, amount_sanctioned: null,
      animal: a.animal || null, damage: Array.isArray(a.damage) ? a.damage : [], updated_by: actor ? actor.id : sub.captured_by, note: null, note_ml: null,
    }, actor || { id: sub.captured_by });
    logStep(claim, 'prepared', { by: actor || { id: sub.captured_by, role: null }, amount: claim.amount_claimed, at: sub.captured_at });
    return claim;
  }
  on('forms.submitted', (ev) => {
    if (!ev.payload || ev.payload.module !== ctx.id) return;
    try { ensureClaim(sqlOne('SELECT * FROM wildlife_form_rows WHERE id=? AND deleted=0', ev.payload.id)); } catch (e) { if (!/not open|closed/i.test(e.message)) throw e; }
  });
  const claimOf = (sub) => data.get('wildlife_claims', claimId(sub.id)) || (sub.form_key === FORM_KEY ? ensureClaim(sqlOne('SELECT * FROM wildlife_form_rows WHERE id=? AND deleted=0', sub.id)) : null);

  function timeline(sub, claim) {
    const steps = [{ status: 'recorded', icon: '🐾', label: 'Incident recorded at the hamlet', label_ml: 'ഊരിൽ വെച്ച് സംഭവം രേഖപ്പെടുത്തി', plain: 'Your helper wrote down what happened, with photos.', plain_ml: 'സംഭവിച്ചത് ഫോട്ടോ സഹിതം സഹായി രേഖപ്പെടുത്തി.', at: sub.captured_at }];
    const logs = claim ? data.find('wildlife_claim_log', { claim_id: claim.id }, { order: 'at' }) : [];
    for (const l of logs) {
      const s = claimStatus(l.status);
      steps.push({ status: l.status, icon: s.icon, label: s.label, label_ml: s.label_ml, plain: s.plain, plain_ml: s.plain_ml, note: l.note, note_ml: l.note_ml, amount: ['sanctioned', 'paid'].includes(l.status) ? l.amount : null, at: l.at });
    }
    if (claim && !claimStatus(claim.status).final) {
      const nx = L.NEXT[claim.status] || [];
      const want = nx.find((x) => x !== 'rejected');
      if (want) { const s = claimStatus(want); steps.push({ status: want, icon: '⏳', label: 'Next: ' + s.label, label_ml: 'അടുത്തത്: ' + s.label_ml, plain: 'Waiting for this step.', plain_ml: 'ഈ ഘട്ടം കാത്തിരിക്കുന്നു.', at: null, next: true }); }
    }
    return steps;
  }

  const hm = () => Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
  function shape(s, { claim = undefined, withTimeline = false, photos = false, viewer = null } = {}) {
    const c = claim === undefined ? claimOf(s) : claim;
    const a = s.answers || {};
    const st = c ? claimStatus(c.status) : null;
    const out = {
      id: s.id, form_key: s.form_key, person: s.person || null, person_id: s.person_id, hamlet_id: s.hamlet_id, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml,
      status: s.status, priority: s.priority || 0, flags: s.flags || [], captured_at: s.captured_at, captured_by_name: s.captured_by_name,
      reply: s.reply || null, reply_ml: s.reply_ml || null, replied_at: s.replied_at || null, replied_by_name: s.replied_by_name || null, reply_seen_at: s.reply_seen_at || null,
      incident_date: a.incident_date, time_of_day: a.time_of_day, animal: a.animal, damage: a.damage || [], crop: a.crop || null, crop_area_cents: a.crop_area_cents ?? null, plants_damaged: a.plants_damaged ?? null,
      items_damaged: a.items_damaged || null, estimated_loss: a.estimated_loss ?? null, witnesses: a.witnesses ?? null, reported_forest: a.reported_forest, location: a.location || null, notes: a.notes || null,
      photo_count: ['photo1', 'photo2'].filter((k) => a[k]).length,
      claim: c ? { id: c.id, status: c.status, label: st.label, label_ml: st.label_ml, icon: st.icon, plain: st.plain, plain_ml: st.plain_ml, final: !!st.final, amount_claimed: c.amount_claimed, amount_sanctioned: c.amount_sanctioned, updated_at: c.updated_at, next: L.NEXT[c.status] || [] } : null,
    };
    if (photos) out.photos = ['photo1', 'photo2'].map((k) => a[k]).filter((v) => typeof v === 'string' && v.startsWith('data:image/'));
    if (withTimeline) out.timeline = timeline(s, c);
    if (viewer && c) out.can_update = allowedNext(viewer, c);
    return out;
  }
  // Which next statuses this user may set on this claim (empty = none).
  function allowedNext(u, c) {
    if (isDept(u, c.review_agency_id)) return L.NEXT[c.status] || [];
    if (u.role === 'agency_admin' && u.agency_id && u.agency_id === c.agency_id) return (L.NEXT[c.status] || []).filter((x) => L.CAPTURER_MAY.includes(x));
    return [];
  }
  // One incident, policy-checked by the engine (consent, agency, forwarded review, hamlet, switch).
  function oneIncident(u, id) {
    const s = brain.forms.one(u, id);
    if (s.form_key !== FORM_KEY) throw httpError(404, 'Not found.');
    if (isFamily(u) && !familyIds(u).includes(s.person_id)) throw deny('Not permitted.');
    return s;
  }
  const listIncidents = (u, opts = {}) => brain.forms.list(u, { form_key: FORM_KEY, limit: 1000, ...opts });

  // ---------------- routes: catalogue ----------------
  router.get('/catalogue', authed, (req, res) => res.json({
    animals: L.ANIMALS, damages: L.DAMAGES, times: L.TIMES, directions: L.DIRECTIONS, crops: CROPS, reading_kinds: L.READING_KINDS,
    claim_statuses: Object.entries(L.CLAIM_STATUS).map(([k, v]) => ({ key: k, ...v, next: L.NEXT[k] })),
    claim_window_days: L.CLAIM_WINDOW_DAYS, claim_window_status: L.CLAIM_WINDOW_STATUS, elephant_alert: L.ELEPHANT_ALERT, max_import_rows: L.MAX_IMPORT_ROWS,
    helpline: { emergency: '112', note: 'Emergency number (police, fire, ambulance). Forest Department helpline numbers: PENDING REVIEW — add the local range office number.', note_ml: 'അടിയന്തര നമ്പർ. വനം വകുപ്പിന്റെ ഹെൽപ്‌ലൈൻ നമ്പർ: പരിശോധന ബാക്കി — പ്രാദേശിക റേഞ്ച് ഓഫീസ് നമ്പർ ചേർക്കുക.' },
  }));

  router.get('/hamlets', authed, (req, res) => {
    const u = req.user;
    res.json(myHamlets(u).map((h) => ({ id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, enabled: brain.modules.enabledIn(h.id), alert: brain.modules.enabledIn(h.id) ? alertFor(h.id) : null })));
  });

  // ---------------- helper / facilitator ----------------
  function livelihoodPeople(u, { hamlet_id = null, q = null } = {}) {
    return brain.persons.visible(u, { hamlet_id, q, limit: 500 })
      .filter((p) => !P.isMinor(raw(p.id)) && P.canSee(u, p.id, 'livelihood').ok && brain.modules.enabledIn(p.hamlet_id))
      .map((p) => ({ id: p.id, name: p.name, kind: p.kind, age: p.age, gender: p.gender, hamlet_id: p.hamlet_id, forest_consent: forestId() ? brain.consent.has(p.id, forestId(), 'livelihood') : false }));
  }
  router.get('/people', requires('forms.capture'), (req, res) => {
    if (req.query.hamlet_id) needHamlet(req.user, String(req.query.hamlet_id));
    res.json(livelihoodPeople(req.user, { hamlet_id: req.query.hamlet_id ? String(req.query.hamlet_id) : null, q: req.query.q ? S(req.query.q, 60) : null }));
  });

  router.get('/summary', requires('forms.capture', 'forms.review'), (req, res) => {
    const u = req.user;
    const rows = listIncidents(u, { mine: req.query.all === '1' ? false : true });
    const claims = rows.map((s) => claimOf(s)).filter(Boolean);
    const by = {};
    for (const c of claims) by[c.status] = (by[c.status] || 0) + 1;
    const hs = myHamlets(u).filter((h) => brain.modules.enabledIn(h.id));
    res.json({
      can_capture: brain.forms.canCapture(u, FORM_KEY), is_dept: isDept(u), forwarded_to: forestId() ? (brain.agencies.get(forestId()) || {}).name || null : null,
      incidents: rows.length, open_claims: claims.filter((c) => !claimStatus(c.status).final).length, claims_by_status: by,
      urgent: rows.filter((s) => (s.priority || 0) >= 3 && s.status !== 'closed').length,
      replies_new: rows.filter((s) => s.reply && !s.reply_seen_at).length,
      hamlets: hs.map((h) => ({ id: h.id, name: h.name, name_ml: h.name_ml, alert: alertFor(h.id) })),
    });
  });

  router.get('/incidents', requires('forms.capture', 'forms.review'), (req, res) => {
    const u = req.user;
    const opts = { mine: req.query.mine === '1' };
    if (req.query.hamlet_id) { needHamlet(u, String(req.query.hamlet_id)); opts.hamlet_id = String(req.query.hamlet_id); }
    if (req.query.person_id) {
      const pid = String(req.query.person_id);
      if (!P.canSee(u, pid, 'livelihood').ok && !(isDept(u) && brain.consent.has(pid, u.agency_id, 'livelihood'))) throw deny('Not permitted: no "livelihood" consent for your agency.');
      opts.person_id = pid;
    }
    const rows = listIncidents(u, opts).map((s) => shape(s));
    res.json(req.query.claim ? rows.filter((r) => r.claim && r.claim.status === req.query.claim) : rows);
  });

  router.get('/incidents/:id', authed, (req, res) => {
    const u = req.user;
    const s = oneIncident(u, req.params.id);
    res.json({ ...shape(s, { withTimeline: true, photos: true, viewer: u }), can_reply: !!s.can_reply && isDept(u) });
  });

  // ---------------- department (Forest Range Office) ----------------
  router.get('/queue', requires('forms.review'), (req, res) => {
    const u = req.user;
    if (!isDept(u)) return res.json({ forwarded_to: null, items: [], note: 'Incidents go to the Forest Range Office. Your agency is not the reviewing office.' });
    const opts = {};
    if (req.query.hamlet_id) { needHamlet(u, String(req.query.hamlet_id)); opts.hamlet_id = String(req.query.hamlet_id); }
    const newIds = new Set(brain.forms.queue(u, { form_key: FORM_KEY, ...opts }).map((s) => s.id));
    const items = listIncidents(u, opts).map((s) => ({ ...shape(s, { viewer: u }), new: newIds.has(s.id) }))
      .filter((x) => x.new || (x.claim && !x.claim.final) || req.query.all === '1');
    items.sort((a, b) => (b.priority - a.priority) || (b.new - a.new) || String(a.captured_at).localeCompare(String(b.captured_at)));
    res.json({ forwarded_to: (brain.agencies.get(forestId()) || {}).name || null, items });
  });

  router.post('/incidents/:id/reply', requires('forms.review'), (req, res) => {
    const u = req.user;
    const s = oneIncident(u, req.params.id);
    if (!isDept(u)) throw deny('Only the Forest Range Office replies to incidents.');
    const b = req.body || {};
    const text = S(b.reply, 4000);
    if (text.length < 2) throw httpError(400, 'Write a reply.');
    const row = brain.forms.reply(u, s.id, { reply: text, reply_ml: S(b.reply_ml, 4000) || null, outcome: s.outcome || null, close: false });
    res.json(shape({ ...s, ...row, person: s.person, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml }, { withTimeline: true, viewer: u }));
  });

  // Claim status: only the reviewing department, or (hand-in and payment only) the capturing agency's admin.
  router.post('/claims/:id/status', requires('forms.review'), (req, res) => {
    const u = req.user;
    const claim = data.get('wildlife_claims', String(req.params.id));
    if (!claim) throw httpError(404, 'Claim not found.');
    const s = oneIncident(u, claim.submission_id); // consent, agency, hamlet and switch checks
    if (!brain.modules.enabledIn(claim.hamlet_id)) throw off();
    const b = req.body || {};
    const status = String(b.status || '');
    if (!L.CLAIM_STATUS[status]) throw httpError(400, 'Choose a status: ' + Object.keys(L.CLAIM_STATUS).join(', '));
    const dept = isDept(u, claim.review_agency_id);
    const capAdmin = !dept && u.role === 'agency_admin' && u.agency_id && u.agency_id === claim.agency_id;
    if (!dept && !capAdmin) throw deny('Only the Forest Range Office (or your agency admin, for hand-in and payment) can update this claim.');
    if (capAdmin && !L.CAPTURER_MAY.includes(status)) throw deny('Only the Forest Range Office records inspection, sanction or rejection.');
    if (!(L.NEXT[claim.status] || []).includes(status)) throw Object.assign(httpError(409, `A claim cannot go from "${claim.status}" to "${status}".`), { code: 'bad_transition' });
    let amount = claim.amount_sanctioned;
    if (status === 'sanctioned') {
      const n = Number(b.amount_sanctioned);
      if (!Number.isInteger(n) || n < 0 || n > 100_000_000) throw httpError(400, 'Enter the sanctioned amount in whole rupees.');
      amount = n;
    }
    if (status === 'paid' && (amount === null || amount === undefined)) throw httpError(400, 'Record the sanctioned amount first.');
    const note = S(b.note, 1000) || null;
    const noteMl = S(b.note_ml, 1000) || null;
    const st = claimStatus(status);
    const row = tx(() => {
      const r = data.put('wildlife_claims', { id: claim.id, status, amount_sanctioned: amount, updated_by: u.id, note, note_ml: noteMl }, u);
      logStep(r, status, { by: u, amount: ['sanctioned', 'paid'].includes(status) ? amount : null, note, note_ml: noteMl });
      return r;
    });
    // The family hears about it on the next visit: through the engine's reply (department) or a neutral
    // notification. Neither names the service nor carries case details.
    if (dept && s.status !== 'closed') {
      const amt = ['sanctioned', 'paid'].includes(status) ? ` (₹${Number(amount).toLocaleString('en-IN')})` : '';
      brain.forms.reply(u, s.id, { reply: (note ? note + '\n\n' : '') + st.plain + amt, reply_ml: (noteMl ? noteMl + '\n\n' : '') + st.plain_ml + amt, outcome: status, close: status === 'paid' });
    } else brain.notify(s.person_id, `${brain.brand.short}: you have a message waiting at the centre. Please come on the next visit day.`, {}, u);
    emit('wildlife.claim_status', { claim_id: row.id, status }, u, row.hamlet_id);
    brain.audit(u, 'claim.' + status, row.id, { from: claim.status });
    const fresh = oneIncident(u, s.id);
    res.json(shape(fresh, { claim: row, withTimeline: true, viewer: u }));
  });

  // ---------------- family view ----------------
  router.get('/my', requires('learn', 'family'), (req, res) => {
    const u = req.user;
    const ids = familyIds(u);
    if (!ids.length) return res.json({ members: [] });
    const rows = listIncidents(u).filter((s) => ids.includes(s.person_id));
    res.json({ claim_window_days: L.CLAIM_WINDOW_DAYS, members: ids.map((pid) => {
      const b = brain.persons.basic(pid);
      if (!b) return null;
      const mine = rows.filter((s) => s.person_id === pid).map((s) => shape(s, { withTimeline: true }));
      return { id: b.id, name: b.name, self: pid === u.person_id, incidents: mine };
    }).filter((m) => m && (m.self || m.incidents.length)) });
  });

  // ---------------- sightings (hamlet-level early warning) ----------------
  const sightingsSince = (hid, sinceMs) => data.find('wildlife_sightings', { hamlet_id: hid }, { order: 'seen_at DESC', limit: 2000 }).filter((s) => Date.parse(s.seen_at) >= sinceMs);
  function alertFor(hid, now = Date.now()) { return L.elephantWarning(sightingsSince(hid, now - L.ELEPHANT_ALERT.hours * 3600e3), now); }
  const sightOut = (s, access) => {
    const a = L.ANIMAL[s.animal] || L.ANIMAL.other;
    const d = L.DIRECTION[s.direction] || null;
    const sent = L.sightingSentence({ ...s, count: s.group_size });
    return { id: s.id, hamlet_id: s.hamlet_id, animal: s.animal, icon: a.icon, animal_label: a.label, animal_label_ml: a.label_ml, seen_at: s.seen_at, place: s.place, place_ml: s.place_ml, count: s.group_size, direction: s.direction, direction_label: d && d.label, direction_label_ml: d && d.label_ml, location: s.lat !== null && s.lat !== undefined ? [s.lat, s.lng] : null, note: s.note,
      sentence: sent.en + (d && d.value !== 'unknown' ? ' ' + d.label + '.' : ''), sentence_ml: sent.ml + (d && d.value !== 'unknown' ? ' ' + d.label_ml + '.' : ''),
      reported_by_name: access === 'resident' ? null : s.reported_by_name, mine: false };
  };

  router.get('/sightings', authed, (req, res) => {
    const hid = String(req.query.hamlet_id || '');
    const acc = needHamlet(req.user, hid);
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    res.json(sightingsSince(hid, Date.now() - days * DAY).map((s) => ({ ...sightOut(s, acc), mine: s.reported_by === req.user.id })));
  });

  router.post('/sightings', authed, (req, res) => {
    const u = req.user;
    if (!(P.can(u, 'forms.capture') || isFamily(u))) throw deny('Your role cannot record sightings.');
    const b = req.body || {};
    const hid = String(b.hamlet_id || '');
    needHamlet(u, hid, { write: true });
    if (!L.ANIMAL[b.animal]) throw httpError(400, 'Choose the animal.');
    const now = Date.now();
    const t = b.seen_at ? (typeof b.seen_at === 'string' ? L.parseWhen(b.seen_at) : NaN) : now;
    if (!Number.isFinite(t)) throw httpError(400, 'Time not understood (use YYYY-MM-DD HH:MM).');
    if (t > now + 3600e3) throw httpError(400, 'The time is in the future.');
    if (t < now - 30 * DAY) throw httpError(400, 'Only sightings from the last 30 days can be recorded.');
    const count = b.count === undefined || b.count === null || b.count === '' ? 1 : Number(b.count);
    if (!Number.isInteger(count) || count < 1 || count > 200) throw httpError(400, 'Count must be a whole number from 1 to 200.');
    const direction = b.direction ? String(b.direction) : 'unknown';
    if (!L.DIRECTION[direction]) throw httpError(400, 'Choose a direction from the list.');
    let lat = null, lng = null;
    if (b.location !== undefined && b.location !== null && b.location !== '') {
      const [la, ln] = Array.isArray(b.location) ? b.location.map(Number) : String(b.location).split(/[ ,]+/).map(Number);
      if (!(Math.abs(la) <= 90 && Math.abs(ln) <= 180)) throw httpError(400, 'Invalid location.');
      lat = Math.round(la * 1000) / 1000; lng = Math.round(ln * 1000) / 1000; // rough location (~100 m)
    }
    const place = S(b.place, 120);
    if (!place) throw httpError(400, 'Say where (e.g. "the river path", "near the school").');
    const before = alertFor(hid, now);
    const row = data.put('wildlife_sightings', { hamlet_id: hid, agency_id: u.agency_id || null, animal: b.animal, seen_at: new Date(t).toISOString(), place, place_ml: S(b.place_ml, 120) || null, lat, lng, group_size: count, direction, note: S(b.note, 300) || null, reported_by: u.id, reported_by_name: u.display_name || null, reported_role: u.role }, u);
    const after = alertFor(hid, now);
    if (after && !before) emit('wildlife.elephant_alert', { hamlet_id: hid, sightings: after.sightings }, u, hid);
    res.json({ ...sightOut(row, hamletAccess(u, hid)), mine: true, alert: after });
  });

  router.delete('/sightings/:id', authed, (req, res) => {
    const s = data.get('wildlife_sightings', String(req.params.id));
    if (!s) throw httpError(404, 'Not found.');
    needHamlet(req.user, s.hamlet_id);
    if (s.reported_by !== req.user.id && req.user.role !== 'platform_admin') throw deny('Only the person who recorded it can remove it.');
    data.del('wildlife_sightings', s.id, req.user);
    res.json({ ok: true });
  });

  // ---------------- environment readings ----------------
  function trend(hid, kind, days = 30, now = Date.now()) {
    const K2 = L.READING_KINDS[kind];
    const since = new Date(now - days * DAY).toISOString();
    const rows = sql('SELECT value, at FROM wildlife_readings WHERE deleted=0 AND hamlet_id=? AND kind=? AND at>=? ORDER BY at', hid, kind, since);
    const by = new Map();
    for (const r of rows) { const d = L.istDate(Date.parse(r.at)); if (!by.has(d)) by.set(d, []); by.get(d).push(Number(r.value)); }
    const agg = (vs) => (['rainfall_mm', 'camera_trap_count'].includes(kind) ? vs.reduce((a, b) => a + b, 0) : kind === 'stream_level_cm' ? Math.max(...vs) : vs.reduce((a, b) => a + b, 0) / vs.length);
    const series = [...by.entries()].map(([date, vs]) => ({ date, value: Math.round(agg(vs) * 10) / 10 }));
    const last = rows.length ? { value: Number(rows[rows.length - 1].value), at: rows[rows.length - 1].at } : null;
    const total = kind === 'rainfall_mm' || kind === 'camera_trap_count' ? Math.round(series.reduce((a, x) => a + x.value, 0) * 10) / 10 : null;
    return { kind, unit: K2.unit, label: K2.label, label_ml: K2.label_ml, icon: K2.icon, days, series, last, total };
  }
  router.get('/readings/trend', authed, (req, res) => {
    const hid = String(req.query.hamlet_id || '');
    needHamlet(req.user, hid);
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const kinds = req.query.kind ? [String(req.query.kind)] : Object.keys(L.READING_KINDS);
    for (const k2 of kinds) if (!L.READING_KINDS[k2]) throw httpError(400, 'Unknown kind.');
    res.json(kinds.map((k2) => trend(hid, k2, days)));
  });
  router.get('/readings', authed, (req, res) => {
    const hid = String(req.query.hamlet_id || '');
    needHamlet(req.user, hid);
    const kind = req.query.kind ? String(req.query.kind) : null;
    if (kind && !L.READING_KINDS[kind]) throw httpError(400, 'Unknown kind.');
    res.json(data.find('wildlife_readings', kind ? { hamlet_id: hid, kind } : { hamlet_id: hid }, { order: 'at DESC', limit: Math.min(500, Number(req.query.limit) || 100) })
      .map((r) => ({ id: r.id, kind: r.kind, value: r.value, unit: r.unit, at: r.at, device: r.device, source: r.source, animal: r.animal })));
  });
  const readingId = (hid, r) => 'wlr_' + sha([hid, r.kind, r.at, r.device || '', r.animal || ''].join('|'));
  function saveReadings(u, hid, rows, source) {
    return tx(() => rows.map((r) => data.put('wildlife_readings', { id: readingId(hid, r), hamlet_id: hid, agency_id: u.agency_id || null, kind: r.kind, value: r.value, unit: r.unit, at: r.at, device: r.device || null, animal: r.animal || null, source, entered_by: u.id }, u)));
  }
  router.post('/readings', requires('forms.capture'), (req, res) => {
    const b = req.body || {};
    const hid = String(b.hamlet_id || '');
    needHamlet(req.user, hid, { write: true });
    const r = L.checkReading({ kind: b.kind, value: b.value, at: b.at || new Date().toISOString(), animal: b.animal });
    if (r.error) throw httpError(400, r.error);
    const [row] = saveReadings(req.user, hid, [{ ...r.row, device: S(b.device, 80) || null }], 'manual');
    res.json(row);
  });
  // Bulk paste of a rain-gauge or camera-trap log. All rows must be valid (or skip_invalid), and at most MAX_IMPORT_ROWS.
  router.post('/readings/import', requires('forms.capture'), (req, res) => {
    const b = req.body || {};
    const hid = String(b.hamlet_id || '');
    needHamlet(req.user, hid, { write: true });
    if (b.kind && !L.READING_KINDS[b.kind]) throw httpError(400, 'Unknown kind.');
    if (typeof b.csv !== 'string') throw httpError(400, 'Paste the log as text.');
    const p = L.parseReadingsCsv(b.csv, { kind: b.kind || null });
    if (p.tooBig || p.tooMany) return res.status(400).json({ error: 'too_many_rows', message: p.errors[0].message, errors: p.errors, max_rows: L.MAX_IMPORT_ROWS });
    if (!p.rows.length || (p.errors.length && !b.skip_invalid)) return res.status(400).json({ error: 'invalid', message: `${p.errors.length} line(s) have problems — fix them or choose "skip bad lines".`, errors: p.errors.slice(0, 50), valid: p.rows.length, total: p.total });
    const dev = S(b.device, 80) || null;
    const rows = p.rows.map((r) => ({ ...r, device: r.device || dev }));
    if (b.dry_run) return res.json({ dry_run: true, valid: rows.length, skipped: p.errors.length, errors: p.errors.slice(0, 50) });
    saveReadings(req.user, hid, rows, 'import');
    emit('wildlife.readings_imported', { hamlet_id: hid, rows: rows.length }, req.user, hid);
    res.json({ imported: rows.length, skipped: p.errors.length, errors: p.errors.slice(0, 50) });
  });

  // ---------------- hamlet board ----------------
  router.get('/board', authed, (req, res) => {
    const u = req.user;
    let hid = req.query.hamlet_id ? String(req.query.hamlet_id) : null;
    if (!hid) { const mine = myHamlets(u).filter((h) => brain.modules.enabledIn(h.id)); hid = mine[0] ? mine[0].id : null; }
    if (!hid) throw deny('No hamlet to show.');
    const acc = needHamlet(u, hid);
    const h = brain.hamlets.get(hid);
    const now = Date.now();
    const sightings = sightingsSince(hid, now - 7 * DAY).map((s) => sightOut(s, acc));
    const cam = trend(hid, 'camera_trap_count', 30, now);
    res.json({
      hamlet: { id: h.id, name: h.name, name_ml: h.name_ml, district: h.district }, alert: alertFor(hid, now), sightings,
      rainfall: trend(hid, 'rainfall_mm', 14, now), stream: trend(hid, 'stream_level_cm', 30, now), camera: { total: cam.total, last: cam.last },
      helpline: '112', can_report: P.can(u, 'forms.capture') || (acc === 'resident' && !P.isMinor(raw(u.person_id))),
    });
  });

  // ---------------- aggregates for donors / government / agencies (no names, k-anonymised) ----------------
  router.get('/aggregate', requires('analytics.aggregate'), (req, res) => {
    const u = req.user;
    const steward = u.role === 'platform_admin';
    const external = ['donor', 'govt_viewer', 'cpo'].includes(u.role);
    const fid = forestId();
    const all = steward || external || (fid && u.agency_id === fid);
    // External viewers get a fixed window: six whole months up to the start of this week (IST), so repeated
    // queries cannot be differenced day by day.
    const now = Date.now();
    let from, to;
    if (external) {
      const d = new Date(Date.parse(L.istDate(now)) - (((new Date(now + L.IST_MS).getUTCDay() + 6) % 7) * DAY));
      to = new Date(d.getTime() - L.IST_MS);
      const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 6, 1));
      from = new Date(f.getTime() - L.IST_MS);
    } else {
      const days = Math.min(365, Math.max(30, Number(req.query.days) || 180));
      from = new Date(now - days * DAY); to = new Date(now + DAY);
    }
    const rows = sql(`SELECT id, hamlet_id, answers FROM wildlife_form_rows WHERE deleted=0 AND form_key=? AND captured_at>=? AND captured_at<?${all ? '' : ' AND agency_id=?'}`, FORM_KEY, from.toISOString(), to.toISOString(), ...(all ? [] : [u.agency_id || '-']));
    const claims = new Map(sql('SELECT submission_id, status, amount_sanctioned FROM wildlife_claims WHERE deleted=0').map((c) => [c.submission_id, c]));
    const H = hm();
    const animalT = {}, damageT = {}, claimT = {};
    let paidInr = 0;
    for (const r of rows) {
      const a = r.answers || {};
      const h = r.hamlet_id;
      (animalT[h] = animalT[h] || {})[a.animal || 'other'] = (animalT[h][a.animal || 'other'] || 0) + 1;
      damageT[h] = damageT[h] || {};
      for (const d of Array.isArray(a.damage) ? a.damage : []) damageT[h][d] = (damageT[h][d] || 0) + 1;
      const c = claims.get(r.id);
      const paid = c && c.status === 'paid';
      claimT[h] = claimT[h] || { paid: 0, not_paid: 0 };
      claimT[h][paid ? 'paid' : 'not_paid']++;
      if (paid) paidInr += Number(c.amount_sanctioned) || 0;
    }
    // fill zero cells so every hamlet row has the same columns
    for (const h of Object.keys(animalT)) { for (const x of L.ANIMALS) animalT[h][x.value] = animalT[h][x.value] || 0; for (const x of L.DAMAGES) damageT[h][x.value] = damageT[h][x.value] || 0; }
    const A = L.suppressTable(animalT, { exempt: steward });
    const Dm = L.suppressTable(damageT, { exempt: steward, rowTotals: false });
    const ks = (n) => L.ks(n, steward);
    // A hamlet's incident total is also its claim total (one claim per incident), so if any of its cells is
    // small, hide its total AND its whole claim row; otherwise one table could be subtracted from the other.
    const hiddenH = new Set();
    for (const h of Object.keys(claimT)) {
      const cs = [ks(claimT[h].paid), ks(claimT[h].not_paid)];
      if (A.rows[h].hidden || Dm.rows[h].hidden || cs.some((v) => typeof v === 'string')) hiddenH.add(h);
    }
    const hamlets = Object.keys(animalT).map((h) => {
      const x = H[h] || {};
      const hide = hiddenH.has(h);
      const c = claimT[h];
      const tot = c.paid + c.not_paid;
      return { hamlet: x.name, hamlet_ml: x.name_ml, district: x.district,
        incidents: hide ? 'hidden' : A.rows[h].total, by_animal: A.rows[h].cells, by_damage: Dm.rows[h].cells,
        claims: hide ? 'hidden' : ks(tot), claims_paid: hide ? 'hidden' : ks(c.paid), claims_paid_pct: hide || !tot ? null : Math.round((c.paid / tot) * 100), suppressed: hide };
    }).sort((a, b) => String(a.hamlet).localeCompare(String(b.hamlet)));
    const anyHidden = hiddenH.size > 0 || A.any_hidden || Dm.any_hidden;
    const totPaid = Object.values(claimT).reduce((s, c) => s + c.paid, 0);
    res.json({
      from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), fixed_window: external, scope: all ? 'all agencies' : 'your agency', k_anon: L.K,
      note: 'Counts below 5 are shown as "<5"; any total that would let a hidden count be worked out is shown as "hidden". No names or person-level data.',
      note_ml: '5-ൽ താഴെയുള്ള എണ്ണം "<5" എന്ന് കാണിക്കും; മറച്ച എണ്ണം കണക്കാക്കാൻ ഇടയാക്കുന്ന ആകെത്തുകകൾ "hidden". പേരുകളോ വ്യക്തിഗത വിവരങ്ങളോ ഇല്ല.',
      animals: L.ANIMALS.map((a) => ({ value: a.value, label: a.label, label_ml: a.label_ml, icon: a.icon })), damages: L.DAMAGES.map((d) => ({ value: d.value, label: d.label, label_ml: d.label_ml, icon: d.icon })),
      totals: {
        incidents: anyHidden ? 'hidden' : ks(rows.length), by_animal: A.cols, by_damage: Dm.cols,
        claims: anyHidden ? 'hidden' : ks(rows.length), claims_paid: anyHidden ? 'hidden' : ks(totPaid),
        claims_paid_pct: anyHidden || rows.length < L.K ? null : Math.round((totPaid / rows.length) * 100),
        paid_inr: anyHidden || totPaid < L.K ? null : paidInr,
      },
      hamlets,
    });
  });

  // ---------------- demo seed ----------------
  async function seed(demo) {
    const R = demo.rng(9801); // own random stream — never demo.R
    const { store, brain: B, daysAgo } = demo;
    const H = demo.hamletByKey, A = demo.agencyByKey;
    const hk = ['h1', 'h2', 'h11'].filter((k) => H[k]);
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    let fo; const users = {};
    tx(() => {
      fo = store.put('agencies', { name: 'Demo Forest Range Office (fictional)', type: 'govt', steward: 0, status: 'active', colour: '#2e5e3a', contact: 'demo@example.org', about: 'Fictional Forest Department range office for the demo — receives wild-animal incident records with the family\'s consent and records compensation claim steps.' });
      for (const k of hk) store.put('agency_presence', { agency_id: fo.id, hamlet_id: H[k].id, services: ['wildlife'], since: daysAgo(R.int(200, 600)).slice(0, 10), status: 'active' });
      users.forest = B.createUser({ username: 'demo.forest', password: demo.DEMO_PASSWORD, role: 'field_officer', agency_id: fo.id, hamlet_ids: hk.map((k) => H[k].id), display_name: 'Lissy — Section Forest Officer (Demo Range Office)', safeguarding_trained: 1 }, null);
      users.admin = B.createUser({ username: 'demo.forest.admin', password: demo.DEMO_PASSWORD, role: 'agency_admin', agency_id: fo.id, display_name: 'Demo Forest Range Office — Admin', safeguarding_trained: 1 }, null);
    });
    ensureForm(true);
    const urow = (id) => B.store.get('users', id);
    const officer = urow(users.forest.id);

    // Programmes: the range office in h1, h2, h11; CIF's "wildlife claims desk" where CIF is present (h1, h2).
    const progs = {};
    tx(() => {
      for (const k of hk) {
        progs['fo.' + k] = B.store.put('programmes', { agency_id: fo.id, hamlet_id: H[k].id, module: ctx.id, track: 'wildlife', title: 'Wild animal damage — compensation help', title_ml: 'കാട്ടുമൃഗ നാശം — നഷ്ടപരിഹാര സഹായം', schedule: ['Visit day'], capacity: 200, status: 'active' });
        if (present(A.cif.id, H[k].id)) progs['cif.' + k] = B.store.put('programmes', { agency_id: A.cif.id, hamlet_id: H[k].id, module: ctx.id, track: 'wildlife', title: 'Wildlife claims desk — CIF', title_ml: 'വന്യജീവി നഷ്ടപരിഹാര ഡെസ്ക് — സി.ഐ.എഫ്', schedule: ['Visit day'], capacity: 200, status: 'active' });
      }
    });

    // Livelihood consent, merged into each agency's existing consent (grantConsent supersedes the old one).
    const merge = (p, aid, add) => {
      const cur = store.find('consents', { person_id: p.id, agency_id: aid, status: 'active' })[0];
      const scopes = [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : []), 'profile', ...add])];
      if (cur && add.every((s) => cur.scopes.includes(s)) && cur.scopes.includes('profile')) return cur;
      const c = B.grantConsent({ person_id: p.id, agency_id: aid, scopes, granted_by: cur ? cur.granted_by : p.id, relation: cur ? cur.relation : 'self', method: cur ? cur.method : 'in_person' }, null);
      store.put('consents', { ...c, granted_at: cur && cur.granted_at ? cur.granted_at : daysAgo(R.int(100, 160)) });
      return c;
    };
    const families = []; // { p, cif, fo }
    const forced = new Set([demo.demoGuardian && demo.demoGuardian.id].filter(Boolean));
    tx(() => {
      for (const k of hk) {
        const pool = demo.adults.filter((p) => p.hamlet_id === H[k].id && !P.isMinor(p));
        for (const p of pool) {
          if (!forced.has(p.id) && !R.chance(k === 'h11' ? 0.45 : 0.6)) continue;
          const f = { p, cif: false, fo: false };
          if (progs['cif.' + k]) { merge(p, A.cif.id, ['livelihood']); B.enrol(p.id, progs['cif.' + k].id, null); f.cif = true; }
          // Most families also agree to share incident records with the range office; a few have not (yet).
          if (forced.has(p.id) || !f.cif || R.chance(0.8)) { merge(p, fo.id, ['livelihood']); B.enrol(p.id, progs['fo.' + k].id, null); f.fo = true; }
          families.push(f);
        }
      }
    });

    // ~3 months of incidents: mostly crop damage, a few houses, one injury.
    const fac = { [H.h1.id]: demo.users.facilitator, [H.h2.id]: demo.users.facilitator2 };
    const centre = { [H.h1.id]: [10.02, 77.08], [H.h2.id]: [11.09, 76.59], [H.h11 && H.h11.id]: [9.97, 77.11] };
    const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PS/HgAFXQJMm+Ys9QAAAABJRU5ErkJggg==';
    const cropsFor = { [H.h1.id]: ['banana', 'cardamom', 'tapioca', 'pepper', 'coffee'], [H.h2.id]: ['banana', 'tapioca', 'paddy', 'vegetables', 'ginger'], [H.h11 && H.h11.id]: ['banana', 'cardamom', 'tapioca', 'arecanut'] };
    const PATHS = [[], ['submitted_to_range_office'], ['submitted_to_range_office', 'inspection_done'], ['submitted_to_range_office', 'inspection_done', 'sanctioned'], ['submitted_to_range_office', 'inspection_done', 'sanctioned', 'paid'], ['submitted_to_range_office', 'inspection_done', 'sanctioned', 'paid'], ['submitted_to_range_office', 'rejected']];
    const NOTES = {
      submitted_to_range_office: ['Claim file with photos given at the range office counter.', 'ഫോട്ടോ സഹിതം അപേക്ഷ റേഞ്ച് ഓഫീസ് കൗണ്ടറിൽ നൽകി.'],
      inspection_done: ['Section officer visited the plot and saw the damage.', 'സെക്ഷൻ ഓഫീസർ സ്ഥലം സന്ദർശിച്ച് നാശം കണ്ടു.'],
      sanctioned: ['Amount sanctioned after inspection.', 'പരിശോധനയ്ക്ക് ശേഷം തുക അനുവദിച്ചു.'],
      paid: ['Paid to the bank account.', 'ബാങ്ക് അക്കൗണ്ടിലേക്ക് നൽകി.'],
      rejected: ['Not accepted: the land papers did not match. The helper will help with an appeal.', 'അംഗീകരിച്ചില്ല: ഭൂമിയുടെ രേഖകൾ ഒത്തുപോയില്ല. അപ്പീൽ നൽകാൻ സഹായി സഹായിക്കും.'],
    };
    let n = 0;
    tx(() => {
      const injured = families.find((f) => f.p.hamlet_id === H.h2.id && f.fo && !forced.has(f.p.id));
      const rest = families.filter((f) => !forced.has(f.p.id) && f !== injured);
      const reporters = [...families.filter((f) => forced.has(f.p.id)), ...(injured ? [injured] : []), ...R.sample(rest, Math.min(60, rest.length))];
      let injuryDone = false;
      for (const f of reporters) {
        const p = f.p;
        const capturerId = f.cif && fac[p.hamlet_id] ? fac[p.hamlet_id].id : f.fo ? users.forest.id : null;
        if (!capturerId) continue;
        const capturer = urow(capturerId);
        const k = forced.has(p.id) ? 3 : R.chance(0.25) ? 2 : 1;
        for (let i = 0; i < k; i++) {
          const ago = forced.has(p.id) ? [80, 34, 6][i] : R.int(2, 88);
          const incAgo = ago + (R.chance(0.15) ? R.int(16, 30) : R.int(0, 6));
          let animal = R.pick(['elephant', 'elephant', 'wild_boar', 'wild_boar', 'wild_boar', 'gaur', 'monkey', 'monkey', 'porcupine', 'peacock']);
          let damage = ['crops'];
          if (R.chance(0.12) && ['elephant', 'gaur'].includes(animal)) damage = R.chance(0.5) ? ['house'] : ['house', 'stored_grain'];
          else if (R.chance(0.06)) damage = ['livestock'];
          else if (R.chance(0.06) && animal === 'elephant') damage = ['crops', 'stored_grain'];
          if (!injuryDone && f === injured) { animal = 'wild_boar'; damage = ['injury', 'crops']; injuryDone = true; }
          const crop = R.pick(cropsFor[p.hamlet_id] || cropsFor[H.h1.id]);
          const loss = damage.includes('house') ? R.int(8, 60) * 1000 : damage.includes('livestock') ? R.int(6, 30) * 1000 : R.int(15, 300) * 100;
          const [la, ln] = centre[p.hamlet_id] || [10, 77];
          const answers = {
            incident_date: L.istDate(now - incAgo * DAY), time_of_day: R.pick(['night', 'night', 'evening', 'morning']), animal, damage,
            estimated_loss: loss, location: [Math.round((la + (R.rnd() - 0.5) * 0.02) * 1e5) / 1e5, Math.round((ln + (R.rnd() - 0.5) * 0.02) * 1e5) / 1e5],
            witnesses: R.int(0, 4), reported_forest: R.chance(0.3) ? 'yes' : 'no', notes: damage.includes('injury') ? 'Hurt while chasing the boar out of the field; treated at the PHC.' : '',
          };
          if (damage.includes('crops')) Object.assign(answers, { crop, crop_area_cents: R.int(3, 60), plants_damaged: crop === 'banana' ? R.int(10, 120) : undefined });
          if (damage.some((d) => ['house', 'livestock', 'stored_grain'].includes(d))) answers.items_damaged = damage.includes('house') ? R.pick(['Kitchen wall pushed down', 'Roof sheets and front wall damaged', 'Door and side wall broken']) + (damage.includes('stored_grain') ? '; two sacks of rice eaten' : '') : 'One goat killed';
          if (R.chance(0.85)) answers.photo1 = PHOTO;
          if (R.chance(0.35)) answers.photo2 = PHOTO;
          const sub = B.forms.submit(capturer, { form_key: FORM_KEY, person_id: p.id, answers, client_ref: 'seed-wl-' + (n++) }, {});
          const at = now - ago * DAY + R.int(1, 8) * 3600e3;
          const re = L.assess(sub.answers, at);
          let row = store.put('form_submissions', { ...store.get('form_submissions', sub.id), captured_at: iso(at), flags: re.flags, priority: re.priority });
          const claim = ensureClaim(row, capturer);
          // claim history (only where the range office may see it: the family's consent)
          if (!f.fo) continue;
          const path = forced.has(p.id) ? [['submitted_to_range_office', 'inspection_done', 'sanctioned', 'paid'], ['submitted_to_range_office', 'inspection_done'], []][i] : ago < 5 ? [] : R.pick(PATHS);
          let t = ago;
          let amount = null;
          let cl = claim;
          for (const st of path) {
            t = Math.max(0, t - R.int(2, 12));
            const when = iso(now - t * DAY);
            const byCap = st === 'submitted_to_range_office' && capturer.agency_id !== fo.id;
            const by = byCap ? capturer : officer;
            if (st === 'sanctioned') amount = Math.round((Number(answers.estimated_loss) * (0.4 + R.rnd() * 0.5)) / 100) * 100;
            cl = data.put('wildlife_claims', { id: cl.id, status: st, amount_sanctioned: amount, updated_by: by.id, note: NOTES[st][0], note_ml: NOTES[st][1] }, by);
            logStep(cl, st, { by, amount: ['sanctioned', 'paid'].includes(st) ? amount : null, note: NOTES[st][0], note_ml: NOTES[st][1], at: when });
            if (!byCap) {
              const s = claimStatus(st);
              const amt = ['sanctioned', 'paid'].includes(st) ? ` (₹${amount.toLocaleString('en-IN')})` : '';
              row = store.put('form_submissions', { ...row, status: st === 'paid' ? 'closed' : 'replied', reply: NOTES[st][0] + '\n\n' + s.plain + amt, reply_ml: NOTES[st][1] + '\n\n' + s.plain_ml + amt, outcome: st, replied_by: officer.id, replied_at: when, reply_seen_at: R.chance(0.6) ? when : null, closed_at: st === 'paid' ? when : null, assigned_to: officer.id });
            }
          }
          if (!path.length && R.chance(0.3)) row = store.put('form_submissions', { ...row, status: 'in_review', assigned_to: officer.id });
        }
      }
    });

    // Sightings: ~3 months; Pachakkudi (h1) has two elephant sightings in the last day (early-warning demo);
    // Thenmala (h2) has none in the last 48 h.
    const PLACES = {
      [H.h1.id]: [['the river path', 'പുഴവഴി'], ['the cardamom slope', 'ഏലത്തോട്ടത്തിന്റെ ചരിവ്'], ['the school road', 'സ്കൂൾ റോഡ്'], ['the bamboo patch', 'മുളങ്കാട്']],
      [H.h2.id]: [['the check dam', 'തടയണ'], ['the banana fields', 'വാഴത്തോട്ടം'], ['the anganwadi path', 'അങ്കണവാടി വഴി'], ['the forest edge', 'കാടതിര്']],
      [H.h11 && H.h11.id]: [['the stream crossing', 'തോട് കടവ്'], ['the tea estate boundary', 'തേയിലത്തോട്ട അതിര്'], ['the temple ground', 'അമ്പല മൈതാനം']],
    };
    const reporterFor = (hid) => (fac[hid] ? urow(fac[hid].id) : officer);
    tx(() => {
      const put = (hid, ms, animal, count, direction, place) => {
        const u = reporterFor(hid);
        data.put('wildlife_sightings', { hamlet_id: hid, agency_id: u.agency_id, animal, seen_at: iso(ms), place: place[0], place_ml: place[1], lat: null, lng: null, group_size: count, direction, note: null, reported_by: u.id, reported_by_name: u.display_name, reported_role: u.role }, u);
      };
      for (const k of hk) {
        const hid = H[k].id;
        const m = R.int(18, 30);
        for (let i = 0; i < m; i++) {
          const ago = k === 'h2' ? R.int(3, 90) : R.int(2, 90);
          const animal = R.pick(['elephant', 'elephant', 'wild_boar', 'wild_boar', 'gaur', 'monkey', 'peacock', 'porcupine', 'snake']);
          put(hid, now - ago * DAY + R.int(-6, 6) * 3600e3, animal, animal === 'elephant' ? R.int(1, 6) : animal === 'gaur' ? R.int(1, 8) : R.int(1, 4), R.pick(L.DIRECTIONS).value, R.pick(PLACES[hid]));
        }
      }
      // recent, for the boards
      put(H.h1.id, now - 20 * 3600e3, 'elephant', 3, 'towards_hamlet', PLACES[H.h1.id][0]);
      put(H.h1.id, now - 5 * 3600e3, 'elephant', 4, 'along_stream', PLACES[H.h1.id][0]);
      put(H.h1.id, now - 3 * DAY, 'wild_boar', 2, 'into_forest', PLACES[H.h1.id][1]);
      put(H.h2.id, now - 4 * DAY, 'elephant', 2, 'away_from_hamlet', PLACES[H.h2.id][3]);
      put(H.h2.id, now - 2.5 * DAY, 'gaur', 3, 'staying', PLACES[H.h2.id][1]);
      if (H.h11) put(H.h11.id, now - 30 * 3600e3, 'elephant', 1, 'along_road', PLACES[H.h11.id][1]);
    });

    // Environment readings: daily rain gauge (90 days), weekly stream level and water strips, weekly camera-trap counts.
    tx(() => {
      for (const k of hk) {
        const hid = H[k].id;
        const u = reporterFor(hid);
        const rows = [];
        let level = R.int(30, 60);
        for (let d = 90; d >= 0; d--) {
          const ms = now - d * DAY;
          const day = new Date(ms + L.IST_MS);
          const istMorning = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 8, 0) - L.IST_MS;
          const wet = d > 45 ? 0.55 : 0.4; // monsoon tail, then the north-east showers
          const rain = R.chance(wet) ? Math.round(R.rnd() * (R.chance(0.15) ? 90 : 25) * 10) / 10 : 0;
          rows.push({ kind: 'rainfall_mm', value: rain, unit: 'mm', at: iso(istMorning), device: 'Rain gauge (school roof)' });
          level = Math.max(10, Math.min(250, Math.round(level * 0.92 + rain * 0.8)));
          if (d % 7 === 0) {
            rows.push({ kind: 'stream_level_cm', value: level, unit: 'cm', at: iso(istMorning + 3600e3), device: 'Staff gauge at the footbridge' });
            rows.push({ kind: 'water_ph', value: Math.round((6.4 + R.rnd() * 1.2) * 10) / 10, unit: 'pH', at: iso(istMorning + 2 * 3600e3), device: 'Test strip' });
            rows.push({ kind: 'water_turbidity', value: Math.round(5 + rain * 0.8 + R.rnd() * 10), unit: 'NTU', at: iso(istMorning + 2 * 3600e3), device: 'Turbidity tube' });
            for (const an of ['elephant', 'wild_boar', 'gaur']) rows.push({ kind: 'camera_trap_count', value: R.int(0, an === 'wild_boar' ? 9 : 4), unit: 'animals', at: iso(istMorning + 3 * 3600e3), device: 'Camera trap CT-' + (k === 'h1' ? '01' : k === 'h2' ? '02' : '03'), animal: an });
          }
        }
        saveReadings(u, hid, rows, 'seed');
      }
    });
    ctx.log(`seeded ${families.length} families (${families.filter((f) => f.fo).length} sharing with the range office), ${n} incidents`);
  }

  return {
    seed,
    health: () => ({
      form: brain.forms.get(FORM_KEY) ? 'ok' : 'missing', forwarded_to: reviewAgency || null,
      claims: sqlOne('SELECT COUNT(*) n FROM wildlife_claims WHERE deleted=0').n,
      sightings: sqlOne('SELECT COUNT(*) n FROM wildlife_sightings WHERE deleted=0').n,
      readings: sqlOne('SELECT COUNT(*) n FROM wildlife_readings WHERE deleted=0').n,
      claim_window_days: L.CLAIM_WINDOW_DAYS,
    }),
  };
};

module.exports.FORM_KEY = FORM_KEY;
