'use strict';
// Pure helpers for the exams module (no I/O) — patterns, scoring, SM-2-lite.
const path = require('path');

const BANK = require(path.join(__dirname, 'content', 'questions.json')).questions;

const GK = ['kerala', 'history', 'geography', 'polity', 'static'];
const SUBJECTS = {
  kerala: { label: 'Kerala GK', ml: 'കേരളം', comp: 'PSC.GK', icon: '🌴' },
  history: { label: 'Indian History', ml: 'ഇന്ത്യാ ചരിത്രം', comp: 'PSC.GK', icon: '🏛️' },
  geography: { label: 'Geography', ml: 'ഭൂമിശാസ്ത്രം', comp: 'PSC.GK', icon: '🗺️' },
  polity: { label: 'Constitution & Polity', ml: 'ഭരണഘടന', comp: 'PSC.GK', icon: '⚖️' },
  static: { label: 'Static GK', ml: 'പൊതുവിജ്ഞാനം', comp: 'PSC.GK', icon: '📌' },
  science: { label: 'General Science', ml: 'പൊതുശാസ്ത്രം', comp: 'PSC.SCI', icon: '🔬' },
  quant: { label: 'Simple Arithmetic', ml: 'ഗണിതം', comp: 'PSC.QA', icon: '➗' },
  reasoning: { label: 'Mental Ability & Reasoning', ml: 'മാനസികശേഷി', comp: 'PSC.RS', icon: '🧩' },
  english: { label: 'General English', ml: 'ഇംഗ്ലീഷ്', comp: 'PSC.ENG', icon: '🔤' },
  malayalam: { label: 'Malayalam', ml: 'മലയാളം', comp: 'PSC.ML', icon: 'അ' },
};

const NEW_COMPETENCIES = [
  ['PSC.SCI', 'exams', 'General Science for competitive exams', 'മത്സരപ്പരീക്ഷാ പൊതുശാസ്ത്രം', 1, 'youth'],
  ['PSC.ENG', 'exams', 'General English for PSC', 'PSC ഇംഗ്ലീഷ്', 1, 'youth'],
  ['PSC.ML', 'exams', 'Malayalam grammar & literature for PSC', 'PSC മലയാളം', 1, 'youth'],
  ['PSC.MOCK', 'exams', 'Full-length PSC mock cleared (≥ 50%)', 'PSC മോക്ക് ടെസ്റ്റ് വിജയം', 2, 'youth'],
  ['BANK.QA', 'exams', 'Bank/SSC numerical ability', 'ബാങ്ക്/SSC സംഖ്യാശേഷി', 1, 'youth'],
  ['BANK.RS', 'exams', 'Bank/SSC reasoning', 'ബാങ്ക്/SSC റീസണിംഗ്', 1, 'youth'],
];

const S = (key, label, label_ml, subjects, n) => ({ key, label, label_ml, subjects, n });
const NOTE = 'Pattern modelled on published syllabi for practice. Always check the official notification.';
const PATTERNS = [
  { id: 'psc_ldc', body: 'psc', title: 'Kerala PSC — LDC (Clerk)', title_ml: 'PSC — എൽ.ഡി. ക്ലർക്ക്', minutes: 75, mark: 1, neg: 1 / 3, full: true,
    sections: [S('gk', 'General Knowledge', 'പൊതുവിജ്ഞാനം', GK, 40), S('sci', 'General Science', 'ശാസ്ത്രം', ['science'], 10), S('qa', 'Arithmetic & Mental Ability', 'ഗണിതം, മാനസികശേഷി', ['quant', 'reasoning'], 20), S('eng', 'General English', 'ഇംഗ്ലീഷ്', ['english'], 20), S('ml', 'Malayalam', 'മലയാളം', ['malayalam'], 10)] },
  { id: 'psc_lgs', body: 'psc', title: 'Kerala PSC — Last Grade Servants', title_ml: 'PSC — ലാസ്റ്റ് ഗ്രേഡ്', minutes: 75, mark: 1, neg: 1 / 3, full: true,
    sections: [S('gk', 'General Knowledge & Current Affairs', 'പൊതുവിജ്ഞാനം', GK, 60), S('sci', 'General Science', 'ശാസ്ത്രം', ['science'], 20), S('qa', 'Arithmetic & Mental Ability', 'ഗണിതം, മാനസികശേഷി', ['quant', 'reasoning'], 20)] },
  { id: 'psc_cpo', body: 'psc', title: 'Kerala PSC — Police Constable (CPO)', title_ml: 'PSC — സിവിൽ പോലീസ് ഓഫീസർ', minutes: 75, mark: 1, neg: 1 / 3, full: true,
    sections: [S('gk', 'General Knowledge', 'പൊതുവിജ്ഞാനം', GK, 60), S('sci', 'General Science', 'ശാസ്ത്രം', ['science'], 10), S('qa', 'Arithmetic & Mental Ability', 'ഗണിതം, മാനസികശേഷി', ['quant', 'reasoning'], 20), S('eng', 'General English', 'ഇംഗ്ലീഷ്', ['english'], 10)] },
  { id: 'psc_bfo', body: 'psc', title: 'Kerala PSC — Beat Forest Officer', title_ml: 'PSC — ബീറ്റ് ഫോറസ്റ്റ് ഓഫീസർ', minutes: 75, mark: 1, neg: 1 / 3, full: true,
    sections: [S('gk', 'General Knowledge', 'പൊതുവിജ്ഞാനം', GK, 50), S('sci', 'Science & Environment', 'ശാസ്ത്രം, പരിസ്ഥിതി', ['science'], 20), S('qa', 'Arithmetic & Mental Ability', 'ഗണിതം, മാനസികശേഷി', ['quant', 'reasoning'], 20), S('eng', 'General English', 'ഇംഗ്ലീഷ്', ['english'], 10)] },
  { id: 'psc_pre10', body: 'psc', title: 'Kerala PSC — 10th Level Prelims', title_ml: 'PSC — പത്താം തലം പ്രിലിംസ്', minutes: 75, mark: 1, neg: 1 / 3, full: true,
    sections: [S('gk', 'General Knowledge', 'പൊതുവിജ്ഞാനം', GK, 60), S('sci', 'General Science', 'ശാസ്ത്രം', ['science'], 20), S('qa', 'Arithmetic & Mental Ability', 'ഗണിതം, മാനസികശേഷി', ['quant', 'reasoning'], 20)] },
  { id: 'psc_pre12', body: 'psc', title: 'Kerala PSC — +2 Level Prelims', title_ml: 'PSC — പ്ലസ് ടു തലം പ്രിലിംസ്', minutes: 75, mark: 1, neg: 1 / 3, full: true,
    sections: [S('gk', 'General Knowledge', 'പൊതുവിജ്ഞാനം', GK, 50), S('sci', 'General Science', 'ശാസ്ത്രം', ['science'], 20), S('qa', 'Arithmetic & Mental Ability', 'ഗണിതം, മാനസികശേഷി', ['quant', 'reasoning'], 15), S('eng', 'General English', 'ഇംഗ്ലീഷ്', ['english'], 15)] },
  { id: 'psc_mini', body: 'psc', title: 'PSC Mini Mock (20 Q)', title_ml: 'PSC മിനി മോക്ക് (20 ചോദ്യം)', minutes: 15, mark: 1, neg: 1 / 3, full: false,
    sections: [S('gk', 'General Knowledge', 'പൊതുവിജ്ഞാനം', GK, 12), S('sci', 'General Science', 'ശാസ്ത്രം', ['science'], 4), S('qa', 'Arithmetic & Mental Ability', 'ഗണിതം, മാനസികശേഷി', ['quant', 'reasoning'], 4)] },
  { id: 'ibps_clerk', body: 'bank', title: 'IBPS Clerk — Prelims', title_ml: 'IBPS ക്ലർക്ക് — പ്രിലിംസ്', minutes: 60, mark: 1, neg: 0.25, full: true,
    sections: [S('eng', 'English Language', 'ഇംഗ്ലീഷ്', ['english'], 30), S('num', 'Numerical Ability', 'സംഖ്യാശേഷി', ['quant'], 35), S('rs', 'Reasoning Ability', 'റീസണിംഗ്', ['reasoning'], 35)] },
  { id: 'ibps_mini', body: 'bank', title: 'Bank Mini Mock (30 Q)', title_ml: 'ബാങ്ക് മിനി മോക്ക് (30)', minutes: 20, mark: 1, neg: 0.25, full: false,
    sections: [S('eng', 'English Language', 'ഇംഗ്ലീഷ്', ['english'], 10), S('num', 'Numerical Ability', 'സംഖ്യാശേഷി', ['quant'], 10), S('rs', 'Reasoning Ability', 'റീസണിംഗ്', ['reasoning'], 10)] },
  { id: 'ssc_gd', body: 'ssc', title: 'SSC GD Constable', title_ml: 'SSC ജി.ഡി. കോൺസ്റ്റബിൾ', minutes: 60, mark: 2, neg: 0.25, full: true,
    sections: [S('rs', 'General Intelligence & Reasoning', 'റീസണിംഗ്', ['reasoning'], 20), S('ga', 'General Knowledge & Awareness', 'പൊതുവിജ്ഞാനം', [...GK, 'science'], 20), S('math', 'Elementary Mathematics', 'ഗണിതം', ['quant'], 20), S('eng', 'English', 'ഇംഗ്ലീഷ്', ['english'], 20)] },
  { id: 'ssc_chsl', body: 'ssc', title: 'SSC CHSL — Tier 1', title_ml: 'SSC CHSL — ടയർ 1', minutes: 60, mark: 2, neg: 0.25, full: true,
    sections: [S('eng', 'English Language', 'ഇംഗ്ലീഷ്', ['english'], 25), S('rs', 'General Intelligence', 'റീസണിംഗ്', ['reasoning'], 25), S('qa', 'Quantitative Aptitude', 'ഗണിതം', ['quant'], 25), S('ga', 'General Awareness', 'പൊതുവിജ്ഞാനം', [...GK, 'science'], 25)] },
  { id: 'ssc_mts', body: 'ssc', title: 'SSC MTS (simplified)', title_ml: 'SSC എം.ടി.എസ്.', minutes: 90, mark: 1, neg: 0.25, full: true,
    sections: [S('num', 'Numerical & Mathematical Ability', 'ഗണിതം', ['quant'], 20), S('rs', 'Reasoning & Problem Solving', 'റീസണിംഗ്', ['reasoning'], 20), S('ga', 'General Awareness', 'പൊതുവിജ്ഞാനം', [...GK, 'science'], 25), S('eng', 'English Language', 'ഇംഗ്ലീഷ്', ['english'], 25)] },
  { id: 'rrb_groupd', body: 'rrb', title: 'RRB Group D', title_ml: 'RRB ഗ്രൂപ്പ് ഡി', minutes: 90, mark: 1, neg: 1 / 3, full: true,
    sections: [S('math', 'Mathematics', 'ഗണിതം', ['quant'], 25), S('rs', 'General Intelligence & Reasoning', 'റീസണിംഗ്', ['reasoning'], 30), S('sci', 'General Science', 'ശാസ്ത്രം', ['science'], 25), S('ga', 'General Awareness', 'പൊതുവിജ്ഞാനം', GK, 20)] },
];
for (const p of PATTERNS) { p.n = p.sections.reduce((a, s) => a + s.n, 0); p.note = NOTE; }
const PATTERN = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));

const BODIES = {
  psc: { title: 'Kerala PSC', title_ml: 'കേരള പി.എസ്.സി', icon: '🏛️', exams: ['LDC', 'LGS', 'Police Constable', 'Beat Forest Officer', '10th / +2 Prelims'] },
  bank: { title: 'Bank (IBPS)', title_ml: 'ബാങ്ക് (IBPS)', icon: '🏦', exams: ['IBPS Clerk', 'IBPS PO'] },
  ssc: { title: 'SSC', title_ml: 'എസ്.എസ്.സി', icon: '🛡️', exams: ['GD Constable', 'CHSL', 'MTS'] },
  rrb: { title: 'Railways (RRB)', title_ml: 'റെയിൽവേ (RRB)', icon: '🚆', exams: ['Group D', 'NTPC'] },
};

function shuffle(arr, rnd = Math.random) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build question list for a pattern. `pool` = all questions (bank + approved authored).
// `prefer` = Set of qids to favour (e.g. weak topics) — up to 30% of each section.
function buildPaper(pattern, pool, { rnd = Math.random, prefer = null } = {}) {
  const used = new Set();
  const out = [];
  for (const s of pattern.sections) {
    const cands = shuffle(pool.filter((q) => s.subjects.includes(q.subject) && !used.has(q.id)), rnd);
    let picked = [];
    if (prefer && prefer.size) picked = cands.filter((q) => prefer.has(q.id)).slice(0, Math.ceil(s.n * 0.3));
    for (const q of cands) { if (picked.length >= s.n) break; if (!picked.includes(q)) picked.push(q); }
    for (const q of picked) { used.add(q.id); out.push({ qid: q.id, section: s.key }); }
  }
  return out;
}

// Score answers. qids: [{qid, section}], answers: [idx|null], byId: map.
function score(pattern, qids, answers, byId) {
  const mark = pattern.mark || 1;
  const neg = pattern.neg || 0;
  const secs = Object.fromEntries(pattern.sections.map((s) => [s.key, { key: s.key, label: s.label, label_ml: s.label_ml, n: 0, correct: 0, wrong: 0, blank: 0, score: 0 }]));
  const topics = {};
  let correct = 0, wrong = 0, blank = 0;
  const detail = [];
  qids.forEach((it, i) => {
    const q = byId[it.qid];
    const a = answers[i];
    const sec = secs[it.section] || (secs[it.section] = { key: it.section, label: it.section, n: 0, correct: 0, wrong: 0, blank: 0, score: 0 });
    sec.n++;
    const tk = q ? `${q.subject}/${q.topic}` : 'unknown';
    const t = topics[tk] || (topics[tk] = [0, 0, 0]);
    let r;
    if (a === null || a === undefined || a === '' || a < 0) { blank++; sec.blank++; t[2]++; r = 'blank'; }
    else if (q && Number(a) === q.answer) { correct++; sec.correct++; t[0]++; r = 'correct'; }
    else { wrong++; sec.wrong++; t[1]++; r = 'wrong'; }
    detail.push(r);
  });
  const round2 = (x) => Math.round(x * 100) / 100;
  for (const s of Object.values(secs)) { s.score = round2(s.correct * mark - s.wrong * mark * neg); s.max = s.n * mark; s.pct = s.n ? Math.round((s.correct / s.n) * 100) : 0; }
  const max = qids.length * mark;
  const sc = round2(correct * mark - wrong * mark * neg);
  return { correct, wrong, blank, score: sc, max_score: max, pct: max ? Math.round((Math.max(0, sc) / max) * 1000) / 10 : 0, sections: { list: Object.values(secs), topics }, detail };
}

// SM-2-lite. grade 0..5 (5 easy, 4 good, 3 hard, <3 again). Returns new state.
const DAY = 86400e3;
function sm2(state, grade, now = Date.now()) {
  const s = { ef: 2.5, interval_d: 0, reps: 0, lapses: 0, ...(state || {}) };
  const q = Math.max(0, Math.min(5, Number(grade)));
  s.ef = Math.max(1.3, Math.round((s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100);
  if (q < 3) { s.reps = 0; s.interval_d = 1; s.lapses = (s.lapses || 0) + 1; }
  else { s.reps = (s.reps || 0) + 1; s.interval_d = s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.round((s.interval_d || 1) * s.ef); }
  s.due = new Date(now + s.interval_d * DAY).toISOString().slice(0, 10);
  s.last_seen = new Date(now).toISOString();
  s.last_grade = q;
  s.status = s.interval_d >= 21 ? 'mastered' : 'learning';
  return s;
}

// Aggregate topic stats from many attempts → sorted weakness list.
function weakness(attempts, byId) {
  const agg = {};
  for (const a of attempts) {
    const t = (a.sections && a.sections.topics) || {};
    for (const [k, [c, w, b]] of Object.entries(t)) {
      const x = agg[k] || (agg[k] = { key: k, correct: 0, wrong: 0, blank: 0 });
      x.correct += c; x.wrong += w; x.blank += b;
    }
  }
  return Object.values(agg).map((x) => {
    const [subject, topic] = x.key.split('/');
    const n = x.correct + x.wrong + x.blank;
    return { ...x, subject, topic, n, accuracy: n ? Math.round((x.correct / n) * 100) : 0, subject_label: SUBJECTS[subject]?.label || subject, subject_ml: SUBJECTS[subject]?.ml || subject };
  }).sort((a, b) => a.accuracy - b.accuracy || b.n - a.n);
}

// Syllabus map: body → patterns → sections → subjects → topics (with counts, competency codes)
function syllabus(pool) {
  const topics = {};
  for (const q of pool) { const s = (topics[q.subject] = topics[q.subject] || {}); s[q.topic] = (s[q.topic] || 0) + 1; }
  const subjects = Object.entries(SUBJECTS).map(([id, s]) => ({ id, ...s, count: Object.values(topics[id] || {}).reduce((a, b) => a + b, 0), topics: Object.entries(topics[id] || {}).map(([t, n]) => ({ id: t, count: n })).sort((a, b) => b.count - a.count) }));
  const bodies = Object.entries(BODIES).map(([id, b]) => ({ id, ...b, patterns: PATTERNS.filter((p) => p.body === id).map(publicPattern) }));
  return { bodies, subjects, total: pool.length };
}
function publicPattern(p) { return { id: p.id, body: p.body, title: p.title, title_ml: p.title_ml, minutes: p.minutes, mark: p.mark, neg: p.neg, n: p.n, full: p.full, note: p.note, sections: p.sections.map((s) => ({ key: s.key, label: s.label, label_ml: s.label_ml, n: s.n, subjects: s.subjects })) }; }

module.exports = { BANK, GK, SUBJECTS, NEW_COMPETENCIES, PATTERNS, PATTERN, BODIES, shuffle, buildPaper, score, sm2, weakness, syllabus, publicPattern, DAY };
