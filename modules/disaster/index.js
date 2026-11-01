'use strict';
// Disaster Preparedness — monsoon readiness for hamlets with no internet.
// Preparedness has to be done in advance and travel with the weekly visit:
//   • a hamlet risk profile (hazards, safe assembly points and shelters, nearest PHC / road head,
//     official helplines, last drill) kept by the coordinators / agency admins present there;
//   • a pre-monsoon checklist per hamlet;
//   • family emergency plans (form engine, household subject, consent scope "emergency");
//   • a consent-based list of people who need help to evacuate — the family states the help in
//     plain categories; nothing is copied from health, disability or pregnancy records;
//   • incident reports (form engine, hamlet subject) answered by the district disaster cell;
//   • warnings / advisories issued only by agency admins or stewards, synced to every hub.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'catalogue.json'), 'utf8'));
const HAZARD = Object.fromEntries(CAT.hazards.map((x) => [x.key, x]));
const HAZARD_LEVELS = CAT.hazard_levels.map((x) => x.key);
const POINT_KINDS = CAT.point_kinds.map((x) => x.key);
const NEED = Object.fromEntries(CAT.help_needs.map((x) => [x.key, x]));
const LEVEL = Object.fromEntries(CAT.warning_levels.map((x) => [x.key, x]));
const LEVEL_RANK = { green: 0, yellow: 1, orange: 2, red: 3 };
const CHECK = Object.fromEntries(CAT.checklist.map((x) => [x.key, x]));
const OUTCOMES = CAT.incident_outcomes.map((x) => x.key);

const PLAN_KEY = 'disaster.family_plan';
const INCIDENT_KEY = 'disaster.incident_report';
// The district disaster cell answers incident reports from every hamlet. A stable id keeps the form
// definition identical on the cloud and every hub; a deployment registers its real cell under this id
// or sets DISASTER_CELL_AGENCY_ID. (Brain request: per-deployment form configuration.)
const CELL_ID = process.env.DISASTER_CELL_AGENCY_ID || 'agy_disaster_cell';
// Roles that may ever read the "people needing help" list (mirrors manifest consent_scopes.emergency).
const RESPONDERS = ['field_officer', 'coordinator', 'agency_admin'];
const DEMO_PREFIX = 'DEMO — not a real warning';
const DEMO_PREFIX_ML = 'ഡെമോ — യഥാർത്ഥ മുന്നറിയിപ്പല്ല';
const DAY = 86400e3;

const ch = (value, label, label_ml) => ({ value, label, label_ml });

const PLAN_FORM = {
  key: PLAN_KEY, title: 'Family emergency plan', title_ml: 'കുടുംബ അടിയന്തര പദ്ധതി',
  description: 'Agreed with the family before the monsoon: where to meet, whom to contact, what help they will need and what they keep ready. Read the consent aloud first.',
  subject: 'household', scope: 'emergency', review: null,
  fields: [
    { name: 'meeting_point', type: 'text', label: 'Where will the family meet if they must leave?', label_ml: 'വീട് വിടേണ്ടി വന്നാൽ കുടുംബം എവിടെ ഒത്തുചേരും?', hint: 'Use the hamlet\'s safe assembly point if there is one.', hint_ml: 'ഊരിലെ സുരക്ഷിത ഒത്തുചേരൽ സ്ഥലം ഉണ്ടെങ്കിൽ അത്.', required: true },
    { name: 'contact', type: 'text', label: 'Who will you contact? (relation or office, not a phone number)', label_ml: 'ആരെ ബന്ധപ്പെടും? (ബന്ധം അല്ലെങ്കിൽ ഓഫീസ്, ഫോൺ നമ്പർ വേണ്ട)', hint: 'e.g. ST Promoter, ward member, brother in town', hint_ml: 'ഉദാ. എസ്.ടി. പ്രൊമോട്ടർ, വാർഡ് അംഗം, പട്ടണത്തിലെ സഹോദരൻ', required: true },
    { name: 'help_needed', type: 'select_multiple', label: 'Will anyone at home need help to leave? (the family decides what to say)', label_ml: 'വീട്ടിൽ ആർക്കെങ്കിലും മാറാൻ സഹായം വേണോ? (എന്ത് പറയണമെന്ന് കുടുംബം തീരുമാനിക്കും)', choices: [...CAT.help_needs.map((n) => ch(n.key, n.label, n.label_ml)), ch('none', 'No help needed', 'സഹായം വേണ്ട')] },
    { name: 'help_other', type: 'text', label: 'Other help — in plain words', label_ml: 'മറ്റ് സഹായം — ലളിതമായി', relevant: { field: 'help_needed', equals: 'other' }, hint: 'No diagnoses or medical details.', hint_ml: 'രോഗവിവരങ്ങൾ എഴുതരുത്.' },
    { name: 'documents_safe', type: 'yes_no', label: 'Are important documents kept safe in a plastic cover?', label_ml: 'പ്രധാന രേഖകൾ പ്ലാസ്റ്റിക് കവറിൽ സുരക്ഷിതമാണോ?', required: true },
    { name: 'has_torch', type: 'yes_no', label: 'Torch with batteries ready?', label_ml: 'ബാറ്ററിയുള്ള ടോർച്ച് തയ്യാറാണോ?', required: true },
    { name: 'has_water', type: 'yes_no', label: 'Drinking water stored?', label_ml: 'കുടിവെള്ളം സൂക്ഷിച്ചിട്ടുണ്ടോ?', required: true },
    { name: 'has_medicine_kit', type: 'yes_no', label: 'Medicine / first-aid kit ready?', label_ml: 'മരുന്ന് / പ്രഥമശുശ്രൂഷ കിറ്റ് തയ്യാറാണോ?', required: true },
  ],
};

const INCIDENT_FORM = {
  key: INCIDENT_KEY, title: 'Incident report', title_ml: 'സംഭവ റിപ്പോർട്ട്',
  description: 'What happened in the hamlet — landslide, flood, fire, elephant, road cut off. Travels to the district disaster cell, which replies on the next visit. No names or health details.',
  subject: 'hamlet', scope: 'survey', review: { perm: 'forms.review', agency_id: CELL_ID },
  fields: [
    { name: 'what', type: 'select_multiple', label: 'What happened?', label_ml: 'എന്താണ് സംഭവിച്ചത്?', required: true, choices: [
      ch('landslide', '⛰️ Landslide', '⛰️ ഉരുൾപൊട്ടൽ / മണ്ണിടിച്ചിൽ'), ch('flood', '🌊 Flood', '🌊 വെള്ളപ്പൊക്കം'), ch('wildfire', '🔥 Wildfire', '🔥 കാട്ടുതീ'), ch('elephant', '🐘 Wild elephant', '🐘 കാട്ടാന'),
      ch('tree_fall', '🌳 Tree fallen', '🌳 മരം വീണു'), ch('house_damage', '🏚️ House damaged', '🏚️ വീടിന് കേട്'), ch('other', 'Other', 'മറ്റുള്ളവ')] },
    { name: 'date', type: 'date', label: 'When did it happen?', label_ml: 'എപ്പോൾ സംഭവിച്ചു?', required: true },
    { name: 'people_affected', type: 'integer', label: 'How many people affected?', label_ml: 'എത്ര പേരെ ബാധിച്ചു?', required: true, min: 0, max: 5000 },
    { name: 'people_injured', type: 'integer', label: 'How many people hurt?', label_ml: 'എത്ര പേർക്ക് പരിക്ക്?', required: true, min: 0, max: 5000 },
    { name: 'houses_damaged', type: 'integer', label: 'How many houses damaged?', label_ml: 'എത്ര വീടുകൾക്ക് കേട്?', required: true, min: 0, max: 1000 },
    { name: 'road_blocked', type: 'yes_no', label: 'Is the road to the hamlet blocked?', label_ml: 'ഊരിലേക്കുള്ള വഴി അടഞ്ഞോ?', required: true },
    { name: 'needs', type: 'select_multiple', label: 'What is needed?', label_ml: 'എന്താണ് വേണ്ടത്?', choices: [
      ch('rescue', 'Rescue', 'രക്ഷാപ്രവർത്തനം'), ch('medical', 'Medical help', 'വൈദ്യസഹായം'), ch('food', 'Food', 'ഭക്ഷണം'), ch('water', 'Drinking water', 'കുടിവെള്ളം'),
      ch('shelter', 'Shelter', 'അഭയം'), ch('road_clearing', 'Road clearing', 'വഴി തുറക്കൽ'), ch('other', 'Other', 'മറ്റുള്ളവ')] },
    { name: 'details', type: 'textarea', label: 'What you saw (no names or health details)', label_ml: 'കണ്ടത് (പേരുകളോ ആരോഗ്യ വിവരങ്ങളോ വേണ്ട)' },
    { name: 'photo', type: 'photo', label: 'Photo of the damage (optional)', label_ml: 'നാശത്തിന്റെ ഫോട്ടോ (വേണമെങ്കിൽ)' },
    { name: 'location', type: 'geopoint', label: 'Location (optional)', label_ml: 'സ്ഥലം (വേണമെങ്കിൽ)' },
  ],
};

// ---------- rules (sub-engine: pure, never throws) — see content/RULES.md ----------
function incidentRule(a) {
  const flags = [];
  let priority = 0;
  const injured = Number(a.people_injured) || 0;
  const needs = Array.isArray(a.needs) ? a.needs : [];
  if (a.road_blocked === 'yes') { flags.push({ code: 'road_blocked', level: 'urgent', message: 'Road to the hamlet is blocked — inform the district control room', message_ml: 'ഊരിലേക്കുള്ള വഴി അടഞ്ഞു — ജില്ലാ കൺട്രോൾ റൂമിനെ അറിയിക്കുക' }); priority = 3; }
  if (injured > 0) { flags.push({ code: 'people_injured', level: 'urgent', message: `${injured} ${injured === 1 ? 'person' : 'people'} hurt — medical help may be needed`, message_ml: `${injured} പേർക്ക് പരിക്ക് — വൈദ്യസഹായം വേണ്ടിവരാം` }); priority = 3; }
  if (needs.includes('rescue')) { flags.push({ code: 'rescue_needed', level: 'urgent', message: 'Rescue requested', message_ml: 'രക്ഷാപ്രവർത്തനം ആവശ്യപ്പെട്ടു' }); priority = 3; }
  if ((Number(a.houses_damaged) || 0) > 0 || (Number(a.people_affected) || 0) >= 10) { flags.push({ code: 'damage', level: 'warn', message: 'Houses damaged or many people affected', message_ml: 'വീടുകൾക്ക് കേട് അല്ലെങ്കിൽ പലരെയും ബാധിച്ചു' }); priority = Math.max(priority, 2); }
  return { flags, priority };
}
function planRule(a) {
  const flags = [];
  const help = (Array.isArray(a.help_needed) ? a.help_needed : []).filter((x) => x !== 'none');
  if (help.length) flags.push({ code: 'add_to_help_list', level: 'info', message: 'The family said someone will need help — add them to the "people needing help" list with their consent', message_ml: 'ഒരാൾക്ക് സഹായം വേണമെന്ന് കുടുംബം പറഞ്ഞു — സമ്മതത്തോടെ "സഹായം വേണ്ടവർ" പട്ടികയിൽ ചേർക്കുക' });
  const missing = ['has_torch', 'has_water', 'has_medicine_kit', 'documents_safe'].filter((k) => a[k] === 'no');
  if (missing.length) flags.push({ code: 'kit_incomplete', level: 'info', message: 'Emergency kit not complete — help the family before the monsoon', message_ml: 'അടിയന്തര കിറ്റ് പൂർണ്ണമല്ല — മഴയ്ക്കു മുമ്പ് കുടുംബത്തെ സഹായിക്കുക', missing });
  return { flags, priority: 0 };
}

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError } = ctx;
  const P = brain.policy;
  const S = (v, max = 500) => (v === undefined || v === null ? '' : String(v).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max).trim());
  const steward = (u) => u && u.role === 'platform_admin';
  const hamletLimited = (u) => Array.isArray(u.hamlet_ids) && u.hamlet_ids.length > 0;
  const present = (agencyId, hamletId) => !!(agencyId && sqlOne("SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0 AND status='active'", agencyId, hamletId));
  const hid = (prefix, ...parts) => prefix + '_' + crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 20);
  const nowIso = () => new Date().toISOString();
  // The coming south-west monsoon (June–September). After September we prepare for next year's.
  const season = (d = new Date()) => String(d.getUTCMonth() <= 8 ? d.getUTCFullYear() : d.getUTCFullYear() + 1);

  // ---------- forms + rules (defined at start-up, so a fresh hub has them too) ----------
  brain.forms.define(PLAN_FORM, null);
  brain.forms.define(INCIDENT_FORM, null);
  brain.forms.rule(PLAN_KEY, (a) => planRule(a));
  brain.forms.rule(INCIDENT_KEY, (a) => incidentRule(a));

  // ---------- who relates to which hamlet ----------
  function myHamlets(u) {
    if (!u) return [];
    const all = brain.hamlets.list().map((h) => h.id);
    if (steward(u) || ['cpo', 'govt_viewer'].includes(u.role)) return all;
    if (['donor', 'employer'].includes(u.role)) return [];
    if (u.person_id && ['learner', 'guardian'].includes(u.role)) { const p = brain.persons.raw(u.person_id); return p ? [p.hamlet_id] : []; }
    if (hamletLimited(u)) return u.hamlet_ids.filter((h) => all.includes(h));
    if (!u.agency_id) return [];
    return sql("SELECT DISTINCT hamlet_id FROM agency_presence WHERE agency_id=? AND deleted=0 AND status='active'", u.agency_id).map((r) => r.hamlet_id);
  }
  function needHamlet(u, hamletId) {
    const h = hamletId && brain.hamlets.get(hamletId);
    if (!h) throw httpError(404, 'Hamlet not found.');
    if (!myHamlets(u).includes(h.id)) throw httpError(403, 'This hamlet is outside your area.');
    if (!steward(u) && !brain.modules.enabledIn(h.id)) throw Object.assign(httpError(403, 'Disaster preparedness is switched off in this hamlet.'), { code: 'module_off_here' });
    return h;
  }
  // Profile editors: coordinators / agency admins of an agency present in the hamlet (or the steward).
  const canEditProfile = (u, hamletId) => steward(u) || (['coordinator', 'agency_admin'].includes(u.role) && present(u.agency_id, hamletId) && (!hamletLimited(u) || u.hamlet_ids.includes(hamletId)));
  // Checklist: any capture/coordination staff of an agency present there.
  const canTick = (u, hamletId) => steward(u) || ((P.can(u, 'hamlet.coordinate') || P.can(u, 'forms.capture')) && present(u.agency_id, hamletId) && (!hamletLimited(u) || u.hamlet_ids.includes(hamletId)));
  // Warnings: only agency admins (for hamlets their agency serves) and stewards.
  const canIssue = (u, hamletId) => steward(u) || (u.role === 'agency_admin' && present(u.agency_id, hamletId));
  const isResponder = (u) => steward(u) || RESPONDERS.includes(u.role);

  // ---------- risk profiles ----------
  const profileId = (hamletId) => 'dsr_' + hamletId;
  const blankProfile = (hamletId) => ({ id: null, hamlet_id: hamletId, hazards: {}, points: [], nearest_phc: '', road_head: '', contacts: CAT.default_contacts.map((c) => ({ ...c, verify: true })), last_drill: null, note: '' });
  function cleanContacts(list) {
    const out = [];
    for (const c of (Array.isArray(list) ? list : []).slice(0, 12)) {
      const number = S(c && c.number, 20).replace(/\s+/g, '');
      // Official helplines only: short codes (112, 1077, 101 …) or an office landline with STD code.
      // Ten-digit mobile numbers are refused — personal numbers do not belong on a shared board.
      if (!/^(\d{3,5}|0\d{2,4}-?\d{5,8})$/.test(number)) throw httpError(400, `"${number || '?'}" is not an official helpline (use a short code like 1077, or an office landline with STD code — no mobile numbers).`);
      const label = S(c.label, 120);
      if (label.length < 2) throw httpError(400, 'Name each helpline.');
      out.push({ label, label_ml: S(c.label_ml, 200) || null, number, verify: true });
    }
    return out;
  }
  function cleanPoints(list) {
    const out = [];
    for (const p of (Array.isArray(list) ? list : []).slice(0, 12)) {
      const kind = POINT_KINDS.includes(p && p.kind) ? p.kind : null;
      if (!kind) throw httpError(400, 'Each point is an assembly point or a shelter.');
      const name = S(p.name, 120);
      if (name.length < 2) throw httpError(400, 'Name each assembly point or shelter.');
      let lat = p.lat === '' || p.lat === null || p.lat === undefined ? null : Number(p.lat);
      let lng = p.lng === '' || p.lng === null || p.lng === undefined ? null : Number(p.lng);
      if ((lat !== null && !(Math.abs(lat) <= 90)) || (lng !== null && !(Math.abs(lng) <= 180)) || (lat === null) !== (lng === null)) throw httpError(400, `Location of "${name}" is not valid.`);
      // Rough location only (~100 m) — enough to find it, not a survey.
      if (lat !== null) { lat = Math.round(lat * 1000) / 1000; lng = Math.round(lng * 1000) / 1000; }
      out.push({ kind, name, name_ml: S(p.name_ml, 200) || null, description: S(p.description, 400) || null, description_ml: S(p.description_ml, 600) || null, lat, lng });
    }
    return out;
  }
  function cleanHazards(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {})) {
      if (!HAZARD[k]) throw httpError(400, 'Unknown hazard: ' + k);
      if (!HAZARD_LEVELS.includes(v)) throw httpError(400, `Hazard level for ${k} must be low, medium or high.`);
      out[k] = v;
    }
    return out;
  }
  const getProfile = (hamletId) => data.get('disaster_risk_profiles', profileId(hamletId));
  const profileOut = (row, hamletId) => {
    const p = row || blankProfile(hamletId);
    return { id: p.id, hamlet_id: hamletId, hazards: p.hazards || {}, points: p.points || [], nearest_phc: p.nearest_phc || '', road_head: p.road_head || '', contacts: (p.contacts || []).map((c) => ({ ...c, verify: true })), last_drill: p.last_drill || null, note: p.note || '', is_demo: Number(p.is_demo || 0) === 1, updated_at: row ? row.updated_at : null, updated_by_name: p.updated_by_name || null, exists: !!row };
  };

  // ---------- warnings ----------
  const warningOut = (w) => {
    const L = LEVEL[w.level] || LEVEL.yellow;
    const now = nowIso();
    return { id: w.id, hamlet_ids: w.hamlet_ids || [], level: w.level, level_label: L.label, level_label_ml: L.label_ml, icon: L.icon, advice: L.advice, advice_ml: L.advice_ml, title: w.title, title_ml: w.title_ml, body: w.body, body_ml: w.body_ml, valid_from: w.valid_from, valid_to: w.valid_to, source: w.source, status: w.status, is_demo: Number(w.is_demo || 0) === 1, issued_by_name: w.issued_by_name, agency_id: w.agency_id, active: w.status === 'active' && w.valid_from <= now && w.valid_to > now, updated_at: w.updated_at };
  };
  function warningsFor(hamletIds, { activeOnly = true } = {}) {
    const set = new Set(hamletIds);
    return data.find('disaster_warnings', {}, { order: 'valid_from DESC', limit: 500 }).map(warningOut)
      .filter((w) => w.hamlet_ids.some((h) => set.has(h)) && (!activeOnly || w.active))
      .sort((a, b) => (b.active - a.active) || (LEVEL_RANK[b.level] - LEVEL_RANK[a.level]) || String(b.valid_from).localeCompare(String(a.valid_from)));
  }

  // ---------- checklist ----------
  function checklist(hamletId, seasonKey = season()) {
    const rows = Object.fromEntries(data.find('disaster_checklist', { hamlet_id: hamletId, season: seasonKey }).map((r) => [r.item, r]));
    return CAT.checklist.map((c) => ({ key: c.key, icon: c.icon, label: c.label, label_ml: c.label_ml, done: rows[c.key] ? Number(rows[c.key].done) === 1 : false, done_at: rows[c.key] ? rows[c.key].done_at : null, done_by_name: rows[c.key] ? rows[c.key].done_by_name : null, note: rows[c.key] ? rows[c.key].note : null }));
  }

  // ---------- people needing help (consent scope "emergency") ----------
  const helpId = (pid) => hid('dsh', pid);
  function canSeeHelp(u, pid) {
    const v = P.canSee(u, pid, 'emergency');
    return v.ok ? v : null;
  }
  function needResponder(u) {
    if (!isResponder(u)) throw httpError(403, 'Only disaster responders (field officers, coordinators, agency admins) with the family\'s consent see this list.');
  }

  // Data minimisation: when someone no longer shares "emergency" with any agency, drop their entry.
  on('core.consent_revoked', (ev) => {
    const pid = ev.payload && ev.payload.person_id;
    if (!pid) return;
    const row = data.get('disaster_help_needed', helpId(pid));
    if (!row) return;
    if (brain.agencies.list().some((a) => brain.consent.has(pid, a.id, 'emergency'))) return;
    data.del('disaster_help_needed', row.id, null);
  });

  // ================================================================ routes
  router.get('/catalogue', authed, (req, res) => res.json({ status: CAT.status, status_ml: CAT.status_ml, hazards: CAT.hazards, hazard_levels: CAT.hazard_levels, point_kinds: CAT.point_kinds, help_needs: CAT.help_needs, warning_levels: CAT.warning_levels, checklist: CAT.checklist, default_contacts: CAT.default_contacts, verify_note: CAT.verify_note, verify_note_ml: CAT.verify_note_ml, incident_outcomes: CAT.incident_outcomes, demo_prefix: DEMO_PREFIX, season: season(), cell_agency_id: CELL_ID }));

  // Hamlets this user relates to, with the service switch and the current top warning.
  router.get('/hamlets', authed, (req, res) => {
    const u = req.user;
    const ids = myHamlets(u);
    const warn = warningsFor(ids);
    res.json(brain.hamlets.list().filter((h) => ids.includes(h.id)).map((h) => {
      const top = warn.find((w) => w.hamlet_ids.includes(h.id));
      return { id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, enabled: brain.modules.enabledIn(h.id), warning: top ? { level: top.level, icon: top.icon, title: top.title, title_ml: top.title_ml, is_demo: top.is_demo } : null };
    }));
  });

  // Hamlet board: current warning banner, risk profile, assembly points, checklist.
  router.get('/board', authed, (req, res) => {
    const u = req.user;
    const ids = myHamlets(u);
    if (!ids.length) throw httpError(403, 'No hamlet linked to your account.');
    const h = needHamlet(u, req.query.hamlet_id || ids[0]);
    const staff = !['learner', 'guardian'].includes(u.role);
    const plans = staff && brain.forms.canCapture(u, PLAN_KEY) ? brain.forms.list(u, { form_key: PLAN_KEY, hamlet_id: h.id, limit: 1000 }).length : null;
    res.json({
      hamlet: { id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, panchayat: h.panchayat },
      warnings: warningsFor([h.id]), profile: profileOut(getProfile(h.id), h.id), checklist: staff ? checklist(h.id) : null, season: season(),
      verify_note: CAT.verify_note, verify_note_ml: CAT.verify_note_ml, status: CAT.status, status_ml: CAT.status_ml,
      can: { edit_profile: canEditProfile(u, h.id), tick: canTick(u, h.id), issue: canIssue(u, h.id), plans: brain.forms.canCapture(u, PLAN_KEY) && present(u.agency_id, h.id), help: isResponder(u), incident: brain.forms.canCapture(u, INCIDENT_KEY) && (steward(u) || present(u.agency_id, h.id)), review: brain.forms.canReview(u, INCIDENT_KEY) },
      plans_recorded: plans,
    });
  });

  // ---------- risk profile ----------
  router.get('/profile/:hamletId', authed, (req, res) => {
    const h = needHamlet(req.user, req.params.hamletId);
    res.json(profileOut(getProfile(h.id), h.id));
  });
  router.put('/profile/:hamletId', requires('hamlet.coordinate'), (req, res) => {
    const u = req.user;
    const h = needHamlet(u, req.params.hamletId);
    if (!canEditProfile(u, h.id)) throw httpError(403, 'Only coordinators or admins of an agency working in this hamlet can edit its risk profile.');
    const b = req.body || {};
    const cur = getProfile(h.id);
    const lastDrill = b.last_drill ? S(b.last_drill, 10) : null;
    if (lastDrill && (!/^\d{4}-\d{2}-\d{2}$/.test(lastDrill) || Number.isNaN(Date.parse(lastDrill)) || lastDrill > nowIso().slice(0, 10))) throw httpError(400, 'Last drill must be a past date (YYYY-MM-DD).');
    // Explicit field list; id and hamlet come from the URL, agency and author from the account.
    const row = data.put('disaster_risk_profiles', {
      id: profileId(h.id), hamlet_id: h.id, agency_id: cur ? cur.agency_id : (u.agency_id || null),
      hazards: b.hazards !== undefined ? cleanHazards(b.hazards) : (cur ? cur.hazards : {}),
      points: b.points !== undefined ? cleanPoints(b.points) : (cur ? cur.points : []),
      nearest_phc: b.nearest_phc !== undefined ? S(b.nearest_phc, 200) : (cur ? cur.nearest_phc : ''),
      road_head: b.road_head !== undefined ? S(b.road_head, 200) : (cur ? cur.road_head : ''),
      contacts: b.contacts !== undefined ? cleanContacts(b.contacts) : (cur ? cur.contacts : CAT.default_contacts.map((c) => ({ ...c, verify: true }))),
      last_drill: b.last_drill !== undefined ? lastDrill : (cur ? cur.last_drill : null),
      note: b.note !== undefined ? S(b.note, 600) : (cur ? cur.note : ''),
      is_demo: 0, updated_by: u.id, updated_by_name: u.display_name,
    }, u);
    emit('disaster.profile_updated', { hamlet_id: h.id }, u, h.id);
    res.json(profileOut(row, h.id));
  });

  // ---------- checklist ----------
  router.get('/checklist/:hamletId', authed, (req, res) => {
    const u = req.user;
    if (['learner', 'guardian', 'donor', 'employer'].includes(u.role)) throw httpError(403, 'Staff only.');
    const h = needHamlet(u, req.params.hamletId);
    res.json({ season: season(), items: checklist(h.id) });
  });
  router.post('/checklist/:hamletId', authed, (req, res) => {
    const u = req.user;
    const h = needHamlet(u, req.params.hamletId);
    if (!canTick(u, h.id)) throw httpError(403, 'Only staff of an agency working in this hamlet can update its checklist.');
    const b = req.body || {};
    if (!CHECK[b.item]) throw httpError(400, 'Unknown checklist item.');
    const sk = season();
    const done = b.done === true || b.done === 1 || b.done === 'yes';
    const row = data.put('disaster_checklist', { id: hid('dsc', h.id, sk, b.item), hamlet_id: h.id, agency_id: u.agency_id || null, season: sk, item: b.item, done: done ? 1 : 0, done_at: done ? nowIso() : null, done_by: done ? u.id : null, done_by_name: done ? u.display_name : null, note: S(b.note, 300) || null }, u);
    if (b.item === 'drill_held' && done) {
      const cur = getProfile(h.id);
      if (cur) data.put('disaster_risk_profiles', { ...cur, last_drill: nowIso().slice(0, 10), updated_by: u.id, updated_by_name: u.display_name }, u);
    }
    res.json({ item: row.item, done: Number(row.done) === 1, done_at: row.done_at, done_by_name: row.done_by_name, note: row.note });
  });

  // ---------- warnings / advisories ----------
  router.get('/warnings', authed, (req, res) => {
    const u = req.user;
    const ids = req.query.hamlet_id ? [needHamlet(u, req.query.hamlet_id).id] : myHamlets(u);
    const all = req.query.all === '1' && (steward(u) || u.role === 'agency_admin');
    res.json(warningsFor(ids, { activeOnly: !all }));
  });
  router.post('/warnings', requires('agency.manage'), (req, res) => {
    const u = req.user;
    const b = req.body || {};
    const hamletIds = [...new Set((Array.isArray(b.hamlet_ids) ? b.hamlet_ids : [b.hamlet_ids]).filter(Boolean).map((x) => S(x, 80)))];
    if (!hamletIds.length) throw httpError(400, 'Choose at least one hamlet.');
    for (const h of hamletIds) {
      if (!brain.hamlets.get(h)) throw httpError(400, 'Unknown hamlet.');
      if (!canIssue(u, h)) throw httpError(403, 'Your agency does not work in one of these hamlets.');
    }
    if (!LEVEL[b.level]) throw httpError(400, 'Level must be green, yellow, orange or red.');
    const title = S(b.title, 160), body = S(b.body, 2000), source = S(b.source, 200);
    if (title.length < 4) throw httpError(400, 'Write a short title.');
    if (body.length < 10) throw httpError(400, 'Write what people should do.');
    if (source.length < 3) throw httpError(400, 'Say where the warning comes from (e.g. IMD bulletin, District Collector, KSDMA).');
    if (/\bdemo\b/i.test(title + ' ' + source)) throw httpError(400, 'Real warnings must not be labelled as demo.');
    const from = b.valid_from ? new Date(b.valid_from) : new Date();
    const to = b.valid_to ? new Date(b.valid_to) : new Date(from.getTime() + 2 * DAY);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw httpError(400, 'Valid-until must be after valid-from.');
    if (to.getTime() - from.getTime() > 30 * DAY) throw httpError(400, 'A warning can be valid for at most 30 days — issue a new one after that.');
    // Explicit fields only: never id, agency, issuer, demo flag or status from the client.
    const row = data.put('disaster_warnings', { hamlet_ids: hamletIds, level: b.level, title, title_ml: S(b.title_ml, 300) || null, body, body_ml: S(b.body_ml, 3000) || null, valid_from: from.toISOString(), valid_to: to.toISOString(), source, status: 'active', is_demo: 0, agency_id: u.agency_id || null, issued_by: u.id, issued_by_name: u.display_name }, u);
    emit('disaster.warning_issued', { id: row.id, level: row.level, hamlet_ids: hamletIds }, u, null);
    brain.audit(u, 'warning.issue', row.id, { level: row.level, hamlets: hamletIds.length });
    res.json(warningOut(row));
  });
  router.post('/warnings/:id/cancel', requires('agency.manage'), (req, res) => {
    const u = req.user;
    const w = data.get('disaster_warnings', req.params.id);
    if (!w) throw httpError(404, 'Warning not found.');
    if (!steward(u) && w.agency_id !== u.agency_id) throw httpError(403, 'Only the agency that issued this warning can cancel it.');
    const row = data.put('disaster_warnings', { ...w, status: 'cancelled', cancelled_by: u.id, cancelled_at: nowIso() }, u);
    emit('disaster.warning_cancelled', { id: w.id }, u, null);
    brain.audit(u, 'warning.cancel', w.id);
    res.json(warningOut(row));
  });

  // ---------- family plans (form engine: household subject, scope "emergency") ----------
  // Households of a hamlet the user can plan with: the head shares "emergency" with the user's agency.
  router.get('/households', requires('forms.capture'), (req, res) => {
    const u = req.user;
    const h = needHamlet(u, req.query.hamlet_id);
    if (!brain.forms.canCapture(u, PLAN_KEY)) throw httpError(403, 'Only disaster responders record family plans.');
    const plans = brain.forms.list(u, { form_key: PLAN_KEY, hamlet_id: h.id, limit: 1000 });
    const latest = {};
    for (const s of plans) if (!latest[s.household_id] || s.captured_at > latest[s.household_id].captured_at) latest[s.household_id] = s;
    const out = [];
    let waiting = 0;
    for (const hh of brain.households.list({ hamlet_id: h.id })) {
      const head = hh.head_person_id;
      const consented = !!head && (steward(u) || brain.consent.has(head, u.agency_id, 'emergency'));
      const seeHead = !!head && P.canSee(u, head, 'profile').ok;
      if (!seeHead && !consented) { waiting++; continue; }
      const b = head ? brain.persons.basic(head) : null;
      const pl = latest[hh.id];
      out.push({ id: hh.id, name: hh.name, house_no: hh.house_no || null, head: b && seeHead ? { id: b.id, name: b.name } : null, consented, plan: pl ? { id: pl.id, captured_at: pl.captured_at, help_needed: (pl.answers.help_needed || []).filter((x) => x !== 'none'), kit_ok: ['has_torch', 'has_water', 'has_medicine_kit', 'documents_safe'].every((k) => pl.answers[k] === 'yes'), meeting_point: pl.answers.meeting_point } : null });
    }
    out.sort((a, b) => (!!a.plan - !!b.plan) || String(a.name).localeCompare(String(b.name)));
    res.json({ hamlet: { id: h.id, name: h.name, name_ml: h.name_ml }, households: out, not_reachable: waiting, form_key: PLAN_KEY });
  });

  // Record, in person, that a person agrees to share "emergency" with the user's agency (scopes are merged).
  router.post('/consent', requires('forms.capture'), (req, res) => {
    const u = req.user;
    const b = req.body || {};
    if (!isResponder(u) || steward(u)) throw httpError(403, 'Only disaster responders of an agency record this consent.');
    if (b.read_aloud !== true) throw httpError(400, 'Read the consent aloud to the family and confirm (read_aloud: true).');
    const pid = S(b.person_id, 80);
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'Person not found.');
    if (!P.canSee(u, pid, 'profile').ok) throw httpError(403, 'You can record this only for people your agency already works with.');
    needHamlet(u, p.hamlet_id);
    const c = brain.consent.grant({ person_id: pid, scopes: ['profile', 'emergency'], method: 'in_person' }, u);
    res.json({ person_id: pid, agency_id: c.agency_id, scopes: c.scopes, status: c.status });
  });

  router.get('/plans', requires('forms.capture', 'forms.review'), (req, res) => {
    const u = req.user;
    const h = req.query.hamlet_id ? needHamlet(u, req.query.hamlet_id) : null;
    res.json(brain.forms.list(u, { form_key: PLAN_KEY, hamlet_id: h ? h.id : null, limit: 500 }).map((s) => ({ id: s.id, household_id: s.household_id, hamlet_id: s.hamlet_id, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml, captured_at: s.captured_at, captured_by_name: s.captured_by_name, answers: s.answers, flags: s.flags })));
  });

  // ---------- people needing help to evacuate ----------
  router.get('/help', authed, (req, res) => {
    const u = req.user;
    needResponder(u);
    const h = needHamlet(u, req.query.hamlet_id);
    const rows = data.find('disaster_help_needed', { hamlet_id: h.id }, { order: 'recorded_at DESC' });
    const people = [];
    for (const r of rows) {
      const v = canSeeHelp(u, r.person_id);
      if (!v) continue;
      if (v.audited) brain.audit(u, 'steward.help_read', r.person_id, { scope: 'restricted' });
      const b = brain.persons.basic(r.person_id);
      if (!b) continue;
      const hh = b.household_id ? brain.households.get(b.household_id) : null;
      people.push({ person_id: b.id, name: b.name, age: b.age, household: hh ? { id: hh.id, name: hh.name, house_no: hh.house_no || null } : null, needs: (r.needs || []).filter((n) => NEED[n]), note: r.note || null, recorded_at: r.recorded_at, recorded_by_name: r.recorded_by_name });
    }
    // Households whose own plan (captured by this agency, head's consent still active) says help is needed.
    const covered = new Set(people.map((p) => p.household && p.household.id).filter(Boolean));
    const households = [];
    for (const s of brain.forms.list(u, { form_key: PLAN_KEY, hamlet_id: h.id, limit: 1000 })) {
      const needs = (s.answers.help_needed || []).filter((x) => NEED[x]);
      if (!needs.length || covered.has(s.household_id) || households.some((x) => x.household_id === s.household_id)) continue;
      const hh = brain.households.get(s.household_id);
      households.push({ household_id: s.household_id, name: hh ? hh.name : null, house_no: hh ? hh.house_no || null : null, needs, plan_date: String(s.captured_at).slice(0, 10), meeting_point: s.answers.meeting_point || null });
    }
    const prof = profileOut(getProfile(h.id), h.id);
    res.json({ hamlet: { id: h.id, name: h.name, name_ml: h.name_ml, district: h.district }, generated_at: nowIso(), people, households, assembly_points: prof.points.filter((p) => p.kind === 'assembly'), contacts: prof.contacts, verify_note: CAT.verify_note, verify_note_ml: CAT.verify_note_ml, confidential: 'CONFIDENTIAL — for disaster responders only. Shared with the families\' consent. Do not copy or post.', confidential_ml: 'രഹസ്യം — ദുരന്ത പ്രതികരണ സംഘത്തിന് മാത്രം. കുടുംബങ്ങളുടെ സമ്മതത്തോടെ. പകർത്തുകയോ പ്രദർശിപ്പിക്കുകയോ ചെയ്യരുത്.' });
  });

  // People in a hamlet this responder may add to the list (they share "emergency" with this agency).
  router.get('/help/candidates', authed, (req, res) => {
    const u = req.user;
    needResponder(u);
    const h = needHamlet(u, req.query.hamlet_id);
    const vis = brain.persons.visible(u, { hamlet_id: h.id, limit: 500 });
    res.json(vis.map((p) => ({ id: p.id, name: p.name, age: p.age, kind: p.kind, household_id: p.household_id || null, emergency: !!canSeeHelp(u, p.id), listed: !!data.get('disaster_help_needed', helpId(p.id)) })));
  });

  router.put('/help/:personId', authed, (req, res) => {
    const u = req.user;
    needResponder(u);
    const pid = req.params.personId;
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'Person not found.');
    if (!canSeeHelp(u, pid)) throw httpError(403, 'Not permitted: the family has not agreed to share "emergency" with your agency (or this person is outside your hamlets).');
    needHamlet(u, p.hamlet_id);
    const b = req.body || {};
    const needs = [...new Set((Array.isArray(b.needs) ? b.needs : []).map(String))];
    if (!needs.length) throw httpError(400, 'Choose at least one kind of help.');
    if (needs.some((n) => !NEED[n])) throw httpError(400, 'Use the plain categories only: ' + Object.keys(NEED).join(', '));
    const note = S(b.note, 200);
    // Explicit fields; person, hamlet and household come from the person record, never from the body.
    const row = data.put('disaster_help_needed', { id: helpId(pid), person_id: pid, hamlet_id: p.hamlet_id, household_id: p.household_id || null, agency_id: u.agency_id || null, needs, note: note || null, recorded_by: u.id, recorded_by_name: u.display_name, recorded_at: nowIso() }, u);
    emit('disaster.help_updated', { hamlet_id: p.hamlet_id }, u, p.hamlet_id);
    res.json({ person_id: pid, needs: row.needs, note: row.note, recorded_at: row.recorded_at });
  });
  router.delete('/help/:personId', authed, (req, res) => {
    const u = req.user;
    needResponder(u);
    const pid = req.params.personId;
    if (!canSeeHelp(u, pid)) throw httpError(403, 'Not permitted.');
    const row = data.get('disaster_help_needed', helpId(pid));
    if (row) data.del('disaster_help_needed', row.id, u);
    res.json({ removed: !!row });
  });

  // ---------- incidents (form engine: hamlet subject, forwarded to the district cell) ----------
  const incOut = (s) => ({ id: s.id, hamlet_id: s.hamlet_id, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml, status: s.status, priority: s.priority || 0, flags: s.flags || [], answers: s.answers, captured_at: s.captured_at, captured_by_name: s.captured_by_name, reply: s.reply || null, reply_ml: s.reply_ml || null, replied_by_name: s.replied_by_name || null, replied_at: s.replied_at || null, reply_seen_at: s.reply_seen_at || null, outcome: s.outcome || null, has_photo: !!(s.answers && s.answers.photo && s.answers.photo !== ''), form_title: s.form_title, form_title_ml: s.form_title_ml });
  router.get('/incidents', requires('forms.capture', 'forms.review'), (req, res) => {
    const u = req.user;
    const h = req.query.hamlet_id ? needHamlet(u, req.query.hamlet_id) : null;
    const opts = { form_key: INCIDENT_KEY, hamlet_id: h ? h.id : undefined };
    const queue = brain.forms.canReview(u, INCIDENT_KEY) ? brain.forms.queue(u, opts).map(incOut) : [];
    const qIds = new Set(queue.map((x) => x.id));
    const recent = brain.forms.list(u, { ...opts, limit: 200 }).filter((s) => !qIds.has(s.id)).map(incOut);
    res.json({ queue, recent, can_review: brain.forms.canReview(u, INCIDENT_KEY), can_capture: brain.forms.canCapture(u, INCIDENT_KEY) });
  });
  router.get('/incidents/:id', requires('forms.capture', 'forms.review'), (req, res) => {
    const s = brain.forms.one(req.user, req.params.id);
    if (s.form_key !== INCIDENT_KEY) throw httpError(404, 'Not found.');
    res.json({ ...incOut(s), photo: s.answers && typeof s.answers.photo === 'string' && s.answers.photo.startsWith('data:image/') ? s.answers.photo : null, can_reply: s.can_reply });
  });
  router.post('/incidents/:id/reply', requires('forms.review'), (req, res) => {
    const b = req.body || {};
    const s0 = brain.forms.one(req.user, req.params.id);
    if (s0.form_key !== INCIDENT_KEY) throw httpError(404, 'Not found.');
    const outcome = OUTCOMES.includes(b.outcome) ? b.outcome : 'advice';
    const row = brain.forms.reply(req.user, req.params.id, { reply: S(b.reply, 4000), reply_ml: S(b.reply_ml, 4000) || null, outcome, close: !!b.close });
    res.json(incOut({ ...s0, ...row }));
  });

  // ---------- aggregate for donors / government (no names, no help details, k-anonymised) ----------
  router.get('/aggregate', requires('analytics.aggregate'), (req, res) => {
    const u = req.user;
    const everyone = steward(u) || ['donor', 'govt_viewer', 'cpo'].includes(u.role);
    const external = !steward(u) && !['agency_admin', 'coordinator'].includes(u.role);
    // External viewers get a fixed window; staff may choose 30–730 days.
    const days = external ? 365 : Math.min(730, Math.max(30, Number(req.query.days) || 365));
    const since = new Date(Date.now() - days * DAY).toISOString();
    const where = everyone ? '' : ' AND agency_id=?';
    const args = everyone ? [] : [u.agency_id || '-'];
    const plans = sql(`SELECT hamlet_id, household_id FROM disaster_form_rows WHERE deleted=0 AND module='disaster' AND form_key=? AND captured_at>=?${where}`, PLAN_KEY, since, ...args);
    const incidents = sql(`SELECT hamlet_id, status, priority FROM disaster_form_rows WHERE deleted=0 AND module='disaster' AND form_key=? AND captured_at>=?${where}`, INCIDENT_KEY, since, ...args);
    // Small counts are always hidden here except for the steward (they could point at one family).
    const ks = (n) => (steward(u) ? n : n > 0 && n < 5 ? '<5' : n);
    const hiddenNum = (v) => typeof v === 'string';
    const byH = new Map();
    const cell = (h) => { if (!byH.has(h)) byH.set(h, { households: new Set(), incidents: 0, urgent: 0, answered: 0 }); return byH.get(h); };
    for (const p of plans) if (p.household_id) cell(p.hamlet_id).households.add(p.household_id);
    for (const i of incidents) { const c = cell(i.hamlet_id); c.incidents++; if (Number(i.priority) >= 3) c.urgent++; if (['replied', 'closed'].includes(i.status)) c.answered++; }
    const hamlets = [];
    let totPlans = 0, totHH = 0, totInc = 0, totUrgent = 0;
    for (const [hidv, c] of byH) {
      const h = brain.hamlets.get(hidv) || {};
      const hh = brain.households.list({ hamlet_id: hidv }).length;
      const n = c.households.size;
      totPlans += n; totHH += hh; totInc += c.incidents; totUrgent += c.urgent;
      const plansShown = ks(n);
      hamlets.push({ hamlet: h.name, hamlet_ml: h.name_ml, district: h.district, households: hh, plans: plansShown, plans_pct: hiddenNum(plansShown) || !hh ? null : Math.round((n / hh) * 100), incidents: ks(c.incidents), urgent_incidents: hiddenNum(ks(c.incidents)) ? null : ks(c.urgent), answered_pct: c.incidents >= 5 || steward(u) ? (c.incidents ? Math.round((c.answered / c.incidents) * 100) : null) : null });
    }
    hamlets.sort((a, b) => String(a.hamlet).localeCompare(String(b.hamlet)));
    // Complementary suppression: if any hamlet cell is hidden, the matching total is hidden too.
    const anyHidden = (k) => hamlets.some((x) => hiddenNum(x[k]));
    const totals = {
      plans: anyHidden('plans') ? 'hidden' : ks(totPlans),
      plans_pct: anyHidden('plans') || !totHH ? null : Math.round((totPlans / totHH) * 100),
      incidents: anyHidden('incidents') ? 'hidden' : ks(totInc),
      urgent_incidents: anyHidden('incidents') || anyHidden('urgent_incidents') ? 'hidden' : ks(totUrgent),
      warnings_issued: data.find('disaster_warnings', {}, { limit: 5000 }).filter((w) => w.valid_from >= since && (everyone || w.agency_id === u.agency_id)).length,
      hamlets_with_profile: data.find('disaster_risk_profiles', {}, { limit: 5000 }).length,
    };
    res.json({ since: since.slice(0, 10), days, scope: everyone ? 'all agencies' : 'your agency', k_anon: 5, note: 'Counts below 5 show as "<5"; a total is "hidden" when any hamlet in it is hidden. No names and no help-needed details.', note_ml: '5-ൽ താഴെയുള്ള എണ്ണം "<5". ഏതെങ്കിലും ഊരിന്റെ എണ്ണം മറച്ചാൽ ആകെ എണ്ണവും മറയ്ക്കും. പേരുകളോ സഹായ വിവരങ്ങളോ ഇല്ല.', totals, hamlets });
  });

  // ================================================================ seed
  async function seed(demo) {
    const R = demo.rng(9701); // own stream — never demo.R
    const { store, brain: B, daysAgo } = demo;
    const H = demo.hamletByKey, A = demo.agencyByKey;
    const hamlets = [H.h1, H.h2, H.h11].filter(Boolean);
    const now = Date.now();
    let cell, officer, admin;
    const progs = {};

    tx(() => {
      cell = store.put('agencies', { id: CELL_ID, name: 'Demo District Disaster Cell (fictional)', type: 'govt', steward: 0, status: 'active', colour: '#c62828', contact: 'demo@example.org', about: 'Fictional district disaster management cell for the demo — keeps the people-needing-help list with consent, answers incident reports, issues (demo) warnings.' });
      for (const h of hamlets) {
        store.put('agency_presence', { agency_id: cell.id, hamlet_id: h.id, services: ['disaster'], since: daysAgo(R.int(150, 400)).slice(0, 10), status: 'active' });
        progs[h.id] = B.store.put('programmes', { agency_id: cell.id, hamlet_id: h.id, module: 'disaster', track: 'disaster', title: 'Monsoon Preparedness', title_ml: 'മഴക്കാല തയ്യാറെടുപ്പ്', schedule: ['Visit day (monthly, weekly in monsoon)'], capacity: 500, status: 'active' });
      }
      officer = B.createUser({ username: 'demo.ddma', password: demo.DEMO_PASSWORD, role: 'field_officer', agency_id: cell.id, hamlet_ids: hamlets.map((h) => h.id), display_name: 'Shibu — Disaster Response Officer (Demo District Cell)', safeguarding_trained: 1 }, null);
      admin = B.createUser({ username: 'demo.ddma.admin', password: demo.DEMO_PASSWORD, role: 'agency_admin', agency_id: cell.id, display_name: 'Demo District Disaster Cell — Admin', safeguarding_trained: 1 }, null);
    });

    // Risk profiles (fictional places), with official helplines marked "verify locally".
    const PROFILES = {
      h1: { hazards: { landslide: 'high', road_cutoff: 'high', elephant: 'medium', wildfire: 'low' }, nearest_phc: 'Demo PHC, about 9 km (jeep track to the road head)', road_head: 'Road head at the bridge, 2.5 km downhill', points: [
        { kind: 'assembly', name: 'Community hall ground', name_ml: 'സാമൂഹ്യ ഹാൾ മൈതാനം', description: 'Flat ground on the ridge, away from the stream', description_ml: 'അരുവിയിൽ നിന്ന് അകലെ, കുന്നിൻമുകളിലെ നിരപ്പായ സ്ഥലം', lat: 10.021, lng: 77.083 },
        { kind: 'shelter', name: 'Government LP School (relief camp)', name_ml: 'സർക്കാർ എൽ.പി. സ്കൂൾ (ദുരിതാശ്വാസ ക്യാമ്പ്)', description: 'Two classrooms, toilets, water tank', description_ml: 'രണ്ട് ക്ലാസ് മുറികൾ, ശൗചാലയം, വാട്ടർ ടാങ്ക്', lat: 10.016, lng: 77.091 }] },
      h2: { hazards: { flood: 'high', road_cutoff: 'medium', elephant: 'high', wildfire: 'medium' }, nearest_phc: 'Demo Family Health Centre, 6 km', road_head: 'Bus stop at the junction, 1 km', points: [
        { kind: 'assembly', name: 'Temple ground above the river', name_ml: 'പുഴയ്ക്ക് മുകളിലെ ക്ഷേത്ര മൈതാനം', description: 'Higher ground — the river rises fast after heavy rain', description_ml: 'ഉയർന്ന സ്ഥലം — കനത്ത മഴയ്ക്ക് ശേഷം പുഴ വേഗം ഉയരും', lat: 11.093, lng: 76.588 },
        { kind: 'shelter', name: 'Anganwadi building', name_ml: 'അങ്കണവാടി കെട്ടിടം', description: 'Small shelter for families with young children', description_ml: 'ചെറിയ കുട്ടികളുള്ള കുടുംബങ്ങൾക്ക്', lat: 11.088, lng: 76.594 }] },
      h11: { hazards: { landslide: 'medium', road_cutoff: 'high', elephant: 'medium' }, nearest_phc: 'Demo PHC Baisonvalley, about 12 km', road_head: 'Jeep point at the tea estate gate, 3 km', points: [
        { kind: 'assembly', name: 'Learning centre courtyard', name_ml: 'പഠനകേന്ദ്രത്തിന്റെ മുറ്റം', description: 'Meet here first; volunteers count families', description_ml: 'ആദ്യം ഇവിടെ ഒത്തുചേരുക; സന്നദ്ധപ്രവർത്തകർ കുടുംബങ്ങളെ എണ്ണും', lat: 9.972, lng: 77.112 }] },
    };
    tx(() => {
      for (const [hk, p] of Object.entries(PROFILES)) {
        const h = H[hk]; if (!h) continue;
        data.put('disaster_risk_profiles', { id: profileId(h.id), hamlet_id: h.id, agency_id: cell.id, hazards: p.hazards, points: p.points, nearest_phc: p.nearest_phc, road_head: p.road_head, contacts: CAT.default_contacts.map((c) => ({ ...c, verify: true })), last_drill: hk === 'h11' ? null : daysAgo(R.int(120, 300)).slice(0, 10), note: 'DEMO profile — fictional places. Verify hazards with the DDMA.', is_demo: 1, updated_by: admin.id, updated_by_name: admin.display_name }, null);
        const sk = season();
        for (const c of CAT.checklist) {
          const done = hk === 'h1' ? R.chance(0.6) : hk === 'h2' ? R.chance(0.4) : R.chance(0.2);
          data.put('disaster_checklist', { id: hid('dsc', h.id, sk, c.key), hamlet_id: h.id, agency_id: cell.id, season: sk, item: c.key, done: done ? 1 : 0, done_at: done ? daysAgo(R.int(3, 40)) : null, done_by: done ? officer.id : null, done_by_name: done ? officer.display_name : null }, null);
        }
      }
    });

    // Consent (merge — grantConsent supersedes the agency's earlier consent) + enrolment.
    const merge = (pid, add) => {
      const cur = store.find('consents', { person_id: pid, agency_id: cell.id, status: 'active' })[0];
      const scopes = [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : []), ...add])];
      const c = B.grantConsent({ person_id: pid, agency_id: cell.id, scopes, granted_by: pid, relation: 'self', method: 'in_person' }, null);
      store.put('consents', { ...c, granted_at: cur && cur.granted_at ? cur.granted_at : daysAgo(R.int(30, 120)) });
    };
    const quota = { [H.h1.id]: 11, [H.h2.id]: 9, [H.h11 && H.h11.id]: 3 };
    const chosen = [];
    tx(() => {
      for (const h of hamlets) {
        const hhs = demo.households.filter((x) => x.hamlet_id === h.id && x.head_person_id);
        const must = hhs.filter((x) => demo.demoGuardian && x.head_person_id === demo.demoGuardian.id);
        const pick = [...must, ...R.sample(hhs.filter((x) => !must.includes(x)), Math.max(0, quota[h.id] - must.length))];
        for (const hh of pick) {
          merge(hh.head_person_id, ['profile', 'emergency', 'survey']);
          B.enrol(hh.head_person_id, progs[h.id].id, null);
          chosen.push(hh);
        }
      }
    });

    // Family plans captured by the cell's officer, over the last ~4 months.
    const urow = store.get('users', officer.id);
    const MEET = { [H.h1.id]: 'Community hall ground', [H.h2.id]: 'Temple ground above the river', [H.h11 && H.h11.id]: 'Learning centre courtyard' };
    const CONTACTS = ['ST Promoter', 'Ward member', 'Brother in town', 'Oorumooppan (hamlet head)', 'Daughter in Adimali'];
    const helpCandidates = [];
    tx(() => {
      let n = 0;
      for (const hh of chosen) {
        const needs = R.chance(0.35) ? R.sample(['cannot_walk_far', 'young_children', 'needs_medicines', 'elderly_alone', 'needs_carrying'], R.int(1, 2)) : ['none'];
        const yes = () => (R.chance(0.7) ? 'yes' : 'no');
        const s = B.forms.submit(urow, { form_key: PLAN_KEY, household_id: hh.id, answers: { meeting_point: MEET[hh.hamlet_id], contact: R.pick(CONTACTS), help_needed: needs, documents_safe: yes(), has_torch: yes(), has_water: yes(), has_medicine_kit: R.chance(0.5) ? 'yes' : 'no' }, client_ref: 'seed-dis-plan-' + (n++) }, {});
        store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: new Date(now - R.int(5, 120) * DAY).toISOString() });
        if (!needs.includes('none')) helpCandidates.push({ hh, needs });
      }
    });

    // People needing help: the family named who, with consent ("emergency" given by that person).
    tx(() => {
      for (const { hh, needs } of helpCandidates) {
        const pid = hh.head_person_id;
        data.put('disaster_help_needed', { id: helpId(pid), person_id: pid, hamlet_id: hh.hamlet_id, household_id: hh.id, agency_id: cell.id, needs, note: needs.includes('needs_medicines') ? 'Keep 2 weeks of medicines ready' : null, recorded_by: officer.id, recorded_by_name: officer.display_name, recorded_at: new Date(now - R.int(3, 60) * DAY).toISOString() }, null);
      }
      // A youth in Thenmala who uses crutches after an accident has asked to be listed (fictional).
      const y = demo.youth.find((p) => p.hamlet_id === H.h2.id && !helpCandidates.some((c) => c.hh.head_person_id === p.id));
      if (y) {
        merge(y.id, ['profile', 'emergency']);
        B.enrol(y.id, progs[H.h2.id].id, null);
        data.put('disaster_help_needed', { id: helpId(y.id), person_id: y.id, hamlet_id: y.hamlet_id, household_id: store.get('persons', y.id).household_id || null, agency_id: cell.id, needs: ['cannot_walk_far'], note: null, recorded_by: officer.id, recorded_by_name: officer.display_name, recorded_at: new Date(now - 20 * DAY).toISOString() }, null);
      }
    });

    // Demo warnings — clearly marked as not real.
    const iso = (ms) => new Date(ms).toISOString();
    tx(() => {
      const W = [
        { hamlet_ids: [H.h1.id, H.h11 && H.h11.id].filter(Boolean), level: 'orange', title: `${DEMO_PREFIX}: heavy rain expected — be ready to move`, title_ml: `${DEMO_PREFIX_ML}: കനത്ത മഴ പ്രതീക്ഷിക്കുന്നു — മാറാൻ തയ്യാറായിരിക്കുക`, body: 'DEMO. Heavy rain is expected over the next two days. Families near the stream: keep documents and medicines in a bag. If the officer asks, go to the assembly point. Help those who cannot walk far.', body_ml: 'ഡെമോ. അടുത്ത രണ്ട് ദിവസം കനത്ത മഴ പ്രതീക്ഷിക്കുന്നു. അരുവിക്കരികിലെ കുടുംബങ്ങൾ രേഖകളും മരുന്നും ബാഗിൽ സൂക്ഷിക്കുക. ഉദ്യോഗസ്ഥൻ പറഞ്ഞാൽ ഒത്തുചേരൽ സ്ഥലത്തേക്ക് പോകുക. നടക്കാൻ കഴിയാത്തവരെ സഹായിക്കുക.', from: now - 6 * 3600e3, to: now + 2 * DAY },
        { hamlet_ids: [H.h2.id], level: 'yellow', title: `${DEMO_PREFIX}: river may rise — keep children away from the bank`, title_ml: `${DEMO_PREFIX_ML}: പുഴ ഉയരാം — കുട്ടികളെ കരയിൽ നിന്ന് അകറ്റി നിർത്തുക`, body: 'DEMO. The river may rise after rain upstream. Do not cross the causeway. Keep children away from the bank.', body_ml: 'ഡെമോ. മുകൾഭാഗത്തെ മഴയ്ക്ക് ശേഷം പുഴ ഉയരാം. ചപ്പാത്ത് കടക്കരുത്. കുട്ടികളെ കരയിൽ നിന്ന് അകറ്റി നിർത്തുക.', from: now - 3600e3, to: now + 3 * DAY },
        { hamlet_ids: [H.h2.id], level: 'red', title: `${DEMO_PREFIX}: flood — move to the temple ground`, title_ml: `${DEMO_PREFIX_ML}: വെള്ളപ്പൊക്കം — ക്ഷേത്ര മൈതാനത്തേക്ക് മാറുക`, body: 'DEMO (past). Flood warning from last monsoon, kept as an example.', body_ml: 'ഡെമോ (പഴയത്). കഴിഞ്ഞ മഴക്കാലത്തെ മുന്നറിയിപ്പ്, ഉദാഹരണമായി.', from: now - 120 * DAY, to: now - 118 * DAY },
      ];
      for (const w of W) data.put('disaster_warnings', { hamlet_ids: w.hamlet_ids, level: w.level, title: w.title, title_ml: w.title_ml, body: w.body, body_ml: w.body_ml, valid_from: iso(w.from), valid_to: iso(w.to), source: 'DEMO — fictional district cell', status: 'active', is_demo: 1, agency_id: cell.id, issued_by: admin.id, issued_by_name: admin.display_name }, null);
    });

    // Incident reports: two from CIF's facilitator in Pachakkudi, one from the officer.
    const fac = demo.users.facilitator && store.get('users', demo.users.facilitator.id);
    tx(() => {
      const mk = (u, hamletId, answers, ago, ref) => {
        const s = B.forms.submit(u, { form_key: INCIDENT_KEY, hamlet_id: hamletId, answers, client_ref: ref }, {});
        return store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: iso(now - ago * DAY) });
      };
      const d = (ago) => iso(now - ago * DAY).slice(0, 10);
      if (fac) {
        const old = mk(fac, H.h1.id, { what: ['landslide', 'tree_fall'], date: d(75), people_affected: 6, people_injured: 0, houses_damaged: 1, road_blocked: 'yes', needs: ['road_clearing', 'shelter'], details: 'Small slip above the footpath; one kitchen wall cracked. Jeep track blocked by a fallen tree.' }, 75, 'seed-dis-inc-1');
        B.forms.reply(store.get('users', officer.id), old.id, { reply: 'Road team cleared the track on the third day. The family with the cracked wall can stay at the school if rain returns. Avoid the footpath under the slip.', reply_ml: 'മൂന്നാം ദിവസം റോഡ് വിഭാഗം വഴി തുറന്നു. മഴ വീണ്ടും വന്നാൽ ചുമർ പൊട്ടിയ കുടുംബത്തിന് സ്കൂളിൽ താമസിക്കാം. ഇടിഞ്ഞ ഭാഗത്തിനടിയിലെ നടപ്പാത ഒഴിവാക്കുക.', outcome: 'road_team_informed', close: false, notify: false });
        const cur = store.get('form_submissions', old.id);
        store.put('form_submissions', { ...cur, replied_at: iso(now - 72 * DAY), reply_seen_at: iso(now - 68 * DAY) });
        mk(fac, H.h1.id, { what: ['elephant'], date: d(9), people_affected: 4, people_injured: 0, houses_damaged: 0, road_blocked: 'no', needs: [], details: 'Elephant herd near the banana plots at night. No one hurt.' }, 9, 'seed-dis-inc-2');
      }
      mk(store.get('users', officer.id), H.h2.id, { what: ['flood'], date: d(2), people_affected: 12, people_injured: 1, houses_damaged: 2, road_blocked: 'yes', needs: ['medical', 'food', 'road_clearing'], details: 'Causeway under water; two houses near the bank took water. One person slipped and hurt a leg.' }, 2, 'seed-dis-inc-3');
    });
    ctx.log(`seeded ${chosen.length} family plans, ${helpCandidates.length + 1} help entries, 3 demo warnings, incidents`);
  }

  return {
    seed,
    health: () => ({
      forms: [PLAN_KEY, INCIDENT_KEY].filter((k) => brain.forms.get(k)).length,
      profiles: sqlOne('SELECT COUNT(*) n FROM disaster_risk_profiles WHERE deleted=0').n,
      active_warnings: data.find('disaster_warnings', { status: 'active' }).filter((w) => w.valid_from <= nowIso() && w.valid_to > nowIso()).length,
      cell_agency_id: CELL_ID,
      catalogue: CAT.status,
    }),
  };
};

module.exports.CELL_ID = CELL_ID;
module.exports.incidentRule = incidentRule;
module.exports.planRule = planRule;
