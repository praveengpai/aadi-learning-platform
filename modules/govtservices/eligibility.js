'use strict';
// Government Services — eligibility sub-engine (pure functions, no I/O).
// Given a person's basics and their document checklist, suggest schemes the family MAY be
// eligible for ("may be eligible — check") and list the documents still missing.
// These are hints for a helper, never a decision: the office decides. See content/REVIEW.md.

const HAVE = new Set(['have', 'received']);

// "Plus Two" → 12, "SSLC" → 10, "7" → 7, "Degree" → 13. Null if unknown.
function classLevel(sc) {
  if (sc === null || sc === undefined || sc === '') return null;
  const s = String(sc);
  if (/plus\s*two|\+2|hsc/i.test(s)) return 12;
  if (/plus\s*one|\+1/i.test(s)) return 11;
  if (/sslc|10th/i.test(s)) return 10;
  if (/degree|diploma|iti|graduat/i.test(s)) return 13;
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}

// The class a person is studying in now (or could join next), or null if not studying.
function studyLevel(p) {
  const lvl = classLevel(p.school_class);
  if (lvl === null) return null;
  if (p.kind === 'child') return lvl;
  if (/discontinued|dropped|stopped/i.test(String(p.school_class))) return null;
  if (p.kind === 'youth' && (p.age === null || p.age === undefined || p.age <= 30)) return lvl >= 13 ? 13 : lvl + 1;
  return null;
}

function matches(m, p, lvl) {
  if (!m) return false;
  if (m.kinds && !m.all && !m.kinds.includes(p.kind) && !(m.students && lvl !== null)) return false;
  if (m.min_age !== undefined && !(p.age !== null && p.age !== undefined && p.age >= m.min_age)) return false;
  if (m.max_age !== undefined && !(p.age !== null && p.age !== undefined && p.age <= m.max_age)) return false;
  if (m.gender && p.gender !== m.gender) return false;
  if (m.min_class !== undefined && !(lvl !== null && lvl >= m.min_class)) return false;
  if (m.max_class !== undefined && !(lvl !== null && lvl <= m.max_class)) return false;
  return true;
}

const CAT_ORDER = { pension: 0, scholarship: 1, certificate: 2, document: 3, health: 4, housing: 5, land: 6, livelihood: 7, assistance: 8 };

/**
 * @param person  {kind, age, gender, school_class}
 * @param docs    { [docKey]: 'have'|'missing'|'applied'|'received' }  (unknown = not checked yet)
 * @param catalogue  parsed content/schemes.json
 * @param openApps   [{scheme, id, stage}] applications still in progress for this person
 * @returns [{ key, title, title_ml, icon, category, confidence:'likely'|'ask', state:'suggest'|'applied'|'in_progress', reason, reason_ml, missing:[{key,label,label_ml,status}], have:[...] , where, link, verify }]
 */
function suggest(person, docs = {}, catalogue, openApps = []) {
  const p = { kind: person.kind, age: person.age === undefined ? null : person.age, gender: person.gender, school_class: person.school_class };
  const lvl = studyLevel(p);
  const docLabel = Object.fromEntries((catalogue.documents || []).map((d) => [d.key, d]));
  const out = [];
  for (const s of catalogue.schemes || []) {
    const m = s.match || {};
    let reason = s.for, reason_ml = s.for_ml;
    if (s.key === 'aadhaar') {
      const missing = !HAVE.has(docs.aadhaar);
      const win = (m.update_ages || []).some(([a, b]) => p.age !== null && p.age >= a && p.age <= b);
      if (!missing && !win) continue;
      if (!missing && win) { reason = 'Biometric update is usually due at this age.'; reason_ml = 'ഈ പ്രായത്തിൽ ബയോമെട്രിക് പുതുക്കൽ സാധാരണ വേണ്ടിവരും.'; }
    } else if (!matches(m, p, lvl)) continue;
    let state = 'suggest';
    if (s.produces && s.key !== 'aadhaar') {
      if (HAVE.has(docs[s.produces])) continue; // already has it
      if (docs[s.produces] === 'applied') state = 'in_progress';
    }
    const app = openApps.find((a) => a.scheme === s.key);
    if (app) state = 'applied';
    const need = (s.docs || []).filter((d) => d !== s.produces);
    const missing = need.filter((d) => !HAVE.has(docs[d])).map((d) => ({ key: d, label: docLabel[d] ? docLabel[d].label : d, label_ml: docLabel[d] ? docLabel[d].label_ml : d, icon: docLabel[d] && docLabel[d].icon, status: docs[d] || 'unknown' }));
    const have = need.filter((d) => HAVE.has(docs[d])).map((d) => ({ key: d, label: docLabel[d] ? docLabel[d].label : d, label_ml: docLabel[d] ? docLabel[d].label_ml : d, icon: docLabel[d] && docLabel[d].icon }));
    out.push({
      key: s.key, title: s.title, title_ml: s.title_ml, icon: s.icon, category: s.category,
      confidence: m.ask ? 'ask' : 'likely', ask: s.ask || null, ask_ml: s.ask_ml || null,
      state, application_id: app ? app.id : null, reason, reason_ml,
      missing, have, where: s.where, where_ml: s.where_ml, link: s.link || null, verify: s.verify, verify_ml: s.verify_ml,
      label: 'May be eligible — check', label_ml: 'യോഗ്യത ഉണ്ടാകാം — ഉറപ്പാക്കുക',
    });
  }
  const elderly = p.age !== null && p.age >= 60;
  const rank = (x) => (x.confidence === 'likely' ? 0 : 100) + (elderly && x.category === 'pension' ? -50 : 0) + (CAT_ORDER[x.category] ?? 9) * 2 + (x.state === 'suggest' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}

// Documents still missing across all likely suggestions (for the helper's "bring next visit" list).
function missingDocs(suggestions) {
  const m = new Map();
  for (const s of suggestions) {
    if (s.confidence !== 'likely' || s.state !== 'suggest') continue;
    for (const d of s.missing) { const cur = m.get(d.key) || { ...d, for: [] }; cur.for.push(s.key); m.set(d.key, cur); }
  }
  return [...m.values()].sort((a, b) => b.for.length - a.for.length);
}

// Scholarships matter most around the start of the Kerala academic year (June) — draft window May–August.
function academicWindow(now = new Date()) { const mo = now.getMonth(); return mo >= 4 && mo <= 7; }

// The application rule (form sub-engine). Pure; never throws.
function makeRule(catalogue) {
  const SCHEME = Object.fromEntries((catalogue.schemes || []).map((s) => [s.key, s]));
  const DOC = Object.fromEntries((catalogue.documents || []).map((d) => [d.key, d]));
  return (answers, ctx = {}, now = new Date()) => {
    const flags = [];
    let priority = 0;
    const s = SCHEME[answers.scheme];
    const person = ctx.person || {};
    if (answers.share_consent !== 'yes') {
      flags.push({ code: 'no_share_consent', level: 'urgent', message: 'Family has not agreed to share with the ST Department — cannot forward. Record consent first.', message_ml: 'എസ്.ടി. വകുപ്പുമായി പങ്കിടാൻ കുടുംബം സമ്മതിച്ചിട്ടില്ല — അയയ്ക്കാനാകില്ല. ആദ്യം സമ്മതം രേഖപ്പെടുത്തുക.' });
      priority = 3;
    }
    const avail = new Set(Array.isArray(answers.docs_available) ? answers.docs_available : []);
    const missing = new Set(Array.isArray(answers.docs_missing) ? answers.docs_missing : []);
    if (s) for (const d of s.docs || []) if (!avail.has(d) && d !== s.produces) missing.add(d);
    for (const d of avail) missing.delete(d);
    if (missing.size) {
      const list = [...missing];
      flags.push({ code: 'docs_missing', level: 'warn', docs: list, message: `${list.length} document(s) still missing: ${list.map((d) => (DOC[d] ? DOC[d].label : d)).join(', ')}`, message_ml: `${list.length} രേഖ(കൾ) ഇനിയും വേണം: ${list.map((d) => (DOC[d] ? DOC[d].label_ml : d)).join(', ')}` });
    }
    if ((s && s.category === 'pension') || (person.age !== null && person.age !== undefined && person.age >= 60)) {
      flags.push({ code: 'elderly_priority', level: 'info', message: 'Pension / elderly person — please act early.', message_ml: 'പെൻഷൻ / പ്രായമായ വ്യക്തി — വേഗം നടപടിയെടുക്കുക.' });
      priority = Math.max(priority, 2);
    }
    if (s && s.category === 'scholarship' && academicWindow(now)) {
      flags.push({ code: 'academic_year', level: 'info', message: 'Scholarship near the start of the academic year — check the last date.', message_ml: 'അധ്യയന വർഷാരംഭം — സ്കോളർഷിപ്പിന്റെ അവസാന തീയതി ഉറപ്പാക്കുക.' });
      priority = Math.max(priority, 2);
    }
    return { flags, priority };
  };
}

module.exports = { suggest, missingDocs, makeRule, classLevel, studyLevel, academicWindow, HAVE };
