'use strict';
// AADI · learning module — school tuition (Class 1–SSLC, Kerala SCERT aligned), adult literacy
// circles, diagnostic placement, personalised catch-up paths, attendance, homework and the
// facilitator console.
//
// Data ownership notes:
//  * Lesson progress, quiz attempts and diagnostics belong to the learner. Any agency with an
//    enrolment + active "progress" consent may see them (that is the point of a shared record).
//  * Attendance, flags, homework and literacy assessments are operational records of the agency
//    that ran the session; staff see their own agency's records only (platform stewards see all).
const fs = require('fs');
const path = require('path');

const SUBJECTS = {
  malayalam: { en: 'Malayalam', ml: 'മലയാളം', icon: 'അ', colour: '#c2410c' },
  english: { en: 'English', ml: 'ഇംഗ്ലീഷ്', icon: '🔤', colour: '#1d4ed8' },
  math: { en: 'Maths', ml: 'ഗണിതം', icon: '🔢', colour: '#7c3aed' },
  evs: { en: 'EVS / Science', ml: 'പരിസരപഠനം / ശാസ്ത്രം', icon: '🌿', colour: '#15803d' },
  social: { en: 'Social Science', ml: 'സാമൂഹ്യശാസ്ത്രം', icon: '🗺️', colour: '#b45309' },
  literacy: { en: 'Adult Literacy', ml: 'മുതിർന്നവരുടെ സാക്ഷരത', icon: '✍️', colour: '#0f766e' },
};
const SCHOOL_SUBJECTS = ['malayalam', 'english', 'math', 'evs', 'social'];

const EXTRA_COMPETENCIES = [
  { code: 'SCI.0', domain: 'science', title: 'Environmental studies foundations (LP)', title_ml: 'പരിസരപഠന അടിസ്ഥാനം', level: 1, stage: 'primary' },
  { code: 'SCI.2', domain: 'science', title: 'Secondary science (HS / SSLC)', title_ml: 'ഹൈസ്കൂൾ ശാസ്ത്രം', level: 2, stage: 'high' },
  { code: 'SOC.1', domain: 'social', title: 'Civic and geographic awareness', title_ml: 'പൗര, ഭൂമിശാസ്ത്ര ബോധം', level: 1, stage: 'upper' },
  { code: 'SOC.2', domain: 'social', title: 'History, constitution and rights', title_ml: 'ചരിത്രം, ഭരണഘടന, അവകാശങ്ങൾ', level: 2, stage: 'high' },
  { code: 'LIT.ADULT.1', domain: 'literacy', title: 'Adult literacy: letters and own name', title_ml: 'സാക്ഷരത: അക്ഷരങ്ങളും സ്വന്തം പേരും', level: 1, stage: 'adult' },
  { code: 'LIT.ADULT.2', domain: 'literacy', title: 'Adult literacy: everyday words', title_ml: 'സാക്ഷരത: ദൈനംദിന വാക്കുകൾ', level: 2, stage: 'adult' },
  { code: 'LIT.ADULT.3', domain: 'literacy', title: 'Adult literacy: sentences and labels', title_ml: 'സാക്ഷരത: വാക്യങ്ങളും ലേബലുകളും', level: 3, stage: 'adult' },
  { code: 'LIT.ADULT.4', domain: 'literacy', title: 'Adult literacy: notices and forms', title_ml: 'സാക്ഷരത: അറിയിപ്പുകളും ഫോമുകളും', level: 4, stage: 'adult' },
];

const BADGES = {
  explorer: { icon: '🧭', en: 'Explorer', ml: 'അന്വേഷകൻ', hint: 'Finished the placement check', hint_ml: 'നിലനിർണയം പൂർത്തിയാക്കി' },
  first_steps: { icon: '🌱', en: 'First Steps', ml: 'ആദ്യ ചുവട്', hint: 'Completed a first lesson', hint_ml: 'ആദ്യ പാഠം പൂർത്തിയാക്കി' },
  five_lessons: { icon: '📗', en: 'Five Lessons', ml: 'അഞ്ച് പാഠങ്ങൾ', hint: 'Completed 5 lessons', hint_ml: '5 പാഠങ്ങൾ പൂർത്തിയാക്കി' },
  bookworm: { icon: '🐛', en: 'Bookworm', ml: 'പുസ്തകപ്പുഴു', hint: 'Completed 12 lessons', hint_ml: '12 പാഠങ്ങൾ പൂർത്തിയാക്കി' },
  perfect: { icon: '💯', en: 'Full Marks', ml: 'മുഴുവൻ മാർക്ക്', hint: 'Scored 100% in a quiz', hint_ml: 'ഒരു ക്വിസിൽ 100%' },
  streak_3: { icon: '🔥', en: '3-Day Streak', ml: '3 ദിവസം തുടർച്ച', hint: 'Learned 3 days in a row', hint_ml: '3 ദിവസം തുടർച്ചയായി പഠിച്ചു' },
  streak_7: { icon: '🌟', en: '7-Day Streak', ml: '7 ദിവസം തുടർച്ച', hint: 'Learned 7 days in a row', hint_ml: '7 ദിവസം തുടർച്ചയായി' },
  all_rounder: { icon: '🎨', en: 'All-Rounder', ml: 'സകലകലാ', hint: 'Lessons in 3+ subjects', hint_ml: '3+ വിഷയങ്ങളിൽ പാഠങ്ങൾ' },
  homework_star: { icon: '📝', en: 'Homework Star', ml: 'ഗൃഹപാഠ താരം', hint: 'Submitted 3 homework tasks', hint_ml: '3 ഗൃഹപാഠം സമർപ്പിച്ചു' },
  climber: { icon: '🧗', en: 'Gap Closer', ml: 'വിടവ് നികത്തി', hint: 'Moved up a level in a re-check', hint_ml: 'പുനഃപരിശോധനയിൽ നില മെച്ചപ്പെട്ടു' },
  team_player: { icon: '🤝', en: 'Hamlet Team Player', ml: 'ഊരിന്റെ കൂട്ടുകാരൻ', hint: 'Helped the hamlet reach its weekly goal', hint_ml: 'ഊരിന്റെ ആഴ്ചലക്ഷ്യം നേടാൻ സഹായിച്ചു' },
};

const PASS = 0.6;     // lesson counts as completed
const MASTERY = 0.8;  // lesson counts as mastered
const ATT_RISK = 0.6; // attendance below this in last 30 days = at risk
const SCORE_RISK = 0.45;

// ---------- content pack ----------
function loadContent() {
  const dir = path.join(__dirname, 'content');
  const lessons = [];
  let levels = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const pack = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (pack.levels) levels = pack.levels;
    for (const l of pack.lessons || []) {
      const track = pack.subject === 'literacy' ? 'literacy' : 'tuition';
      lessons.push({
        ...l, subject: pack.subject, track, class: l.class || null, level: l.level || null,
        questions: (l.questions || []).map((q, i) => ({ id: `${l.id}#${i}`, ...q })),
      });
    }
  }
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const qById = new Map();
  for (const l of lessons) for (const q of l.questions) qById.set(q.id, { ...q, lesson: l });
  const tagged = {};
  for (const l of lessons) for (const c of l.competencies || []) (tagged[c] = tagged[c] || []).push(l.id);
  return { lessons, levels, byId, qById, tagged };
}

function parseGrade(p) {
  if (!p || !p.school_class) return null;
  const s = String(p.school_class);
  const m = s.match(/\d+/);
  if (m) return Math.max(1, Math.min(10, Number(m[0])));
  if (/sslc|plus|degree/i.test(s)) return 10;
  return null;
}
const isDropout = (p) => !!(p && /drop/i.test(String(p.school_class || '')));
const today = () => new Date().toISOString().slice(0, 10);
const dayShift = (n, from = new Date()) => new Date(from.getTime() + n * 86400e3).toISOString().slice(0, 10);
const weekStart = (d = new Date()) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const wd = (x.getUTCDay() + 6) % 7; return new Date(x.getTime() - wd * 86400e3).toISOString().slice(0, 10); };
const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);
const inList = (arr) => arr.map(() => '?').join(',') || "''";

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError, log } = ctx;
  const C = loadContent();

  // ---------- small helpers ----------
  const lessonLite = (l) => ({ id: l.id, subject: l.subject, track: l.track, class: l.class, level: l.level, icon: l.icon, minutes: l.minutes, title: l.title, title_ml: l.title_ml, competencies: l.competencies, scert: l.scert || null, bridge: !!l.bridge, audio: !!(l.audio_ml || l.audio_en), questions: l.questions.length });
  const personLite = (pid) => { const p = brain.persons.raw(pid); if (!p) return null; return { id: p.id, name: p.name, gender: p.gender, kind: p.kind, school_class: p.school_class, grade: parseGrade(p), hamlet_id: p.hamlet_id, language: p.language, literacy_level: p.literacy_level, dropout: isDropout(p) }; };
  const isSteward = (u) => u && (u.role === 'platform_admin' || u.role === 'cpo');
  const canProgress = (u, pid) => brain.policy.canSee(u, pid, 'progress').ok;

  function ensureCompetencies() {
    for (const c of EXTRA_COMPETENCIES) {
      const id = 'cmp_' + c.code.toLowerCase().replace(/\./g, '_');
      const have = sqlOne('SELECT id FROM competencies WHERE id=? AND deleted=0', id);
      if (!have) brain.competencies.upsert({ id, ...c });
    }
  }
  try { if (sqlOne('SELECT COUNT(*) n FROM competencies WHERE deleted=0').n > 0) ensureCompetencies(); } catch (e) { log('competency check skipped:', e.message); }

  // Programmes this staff member can operate (their agency, and their hamlets if scoped).
  function staffProgrammes(user) {
    let ps = brain.programmes.list({ module: 'learning' }).filter((p) => p.status !== 'closed');
    if (user.role !== 'platform_admin') { if (!user.agency_id) return []; ps = ps.filter((p) => p.agency_id === user.agency_id); }
    if (Array.isArray(user.hamlet_ids) && user.hamlet_ids.length) ps = ps.filter((p) => user.hamlet_ids.includes(p.hamlet_id));
    return ps;
  }
  function assertProgramme(user, id) {
    const p = id && brain.programmes.get(id);
    if (!p || p.module !== 'learning') throw httpError(404, 'Programme not found');
    if (!staffProgrammes(user).some((x) => x.id === p.id)) throw httpError(403, 'This programme belongs to another agency or hamlet — you cannot manage it.');
    return p;
  }
  // Learners on a programme roster that this user may see (enrolment + progress consent).
  function roster(user, prog) {
    const ens = brain.enrolments.forProgramme(prog.id).filter((e) => e.status === 'active');
    const out = []; let hidden = 0;
    for (const e of ens) { if (canProgress(user, e.person_id)) { const p = personLite(e.person_id); if (p) out.push(p); } else hidden++; }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return { learners: out, hidden };
  }
  const agencyScope = (user) => (isSteward(user) ? null : user.agency_id || '-');

  // Resolve whose learning data a request is about. Self, guardian (read only), or staff with consent.
  function target(req, { write = false } = {}) {
    const u = req.user;
    const pid = (req.body && req.body.person_id) || req.query.person_id || u.person_id;
    if (!pid) throw httpError(400, 'person_id required');
    if (pid === u.person_id) return pid;
    if (write && !brain.policy.can(u, 'assess')) throw httpError(403, 'Only the learner or their teacher can do this.');
    const v = brain.policy.canSee(u, pid, 'progress');
    if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
    return pid;
  }

  function learningEnrolments(pid) {
    return brain.enrolments.forPerson(pid).filter((e) => ['active', 'completed'].includes(e.status)).map((e) => ({ ...e, programme: brain.programmes.get(e.programme_id) })).filter((e) => e.programme && e.programme.module === 'learning');
  }
  function awardingAgency(pid, track = 'tuition') {
    const ens = learningEnrolments(pid);
    const m = ens.find((e) => e.programme.track === track) || ens[0];
    return m ? m.agency_id : null;
  }

  // ---------- diagnostics & paths ----------
  function diagnosticQuestions(grade) {
    const g = Math.max(2, grade || 2);
    const out = [];
    for (const s of SCHOOL_SUBJECTS) {
      const ls = C.lessons.filter((l) => l.subject === s && l.class && l.class <= Math.min(10, g)).sort((a, b) => a.class - b.class);
      if (!ls.length) continue;
      const n = Math.min(5, ls.length);
      const chosen = [];
      for (let i = 0; i < n; i++) { const l = ls[Math.round((i * (ls.length - 1)) / Math.max(1, n - 1))]; if (!chosen.includes(l)) chosen.push(l); }
      for (const l of chosen) {
        const q = l.questions.find((x) => x.d) || l.questions[0];
        out.push({ id: q.id, subject: s, class: l.class, lesson_id: l.id, icon: l.icon, competencies: l.competencies, q: q.q, q_ml: q.q_ml, o: q.o, o_ml: q.o_ml });
      }
    }
    return out;
  }

  // Score a diagnostic and produce per-subject placement + a recommended catch-up path.
  function gradeDiagnostic(grade, answers) {
    const qs = diagnosticQuestions(grade);
    const results = {};
    const comp = {};
    for (const s of SCHOOL_SUBJECTS) {
      const sq = qs.filter((q) => q.subject === s).sort((a, b) => a.class - b.class);
      if (!sq.length) continue;
      let placement = 0, misses = 0, correct = 0;
      const missed = [];
      for (const q of sq) {
        const ok = Number(answers[q.id]) === C.qById.get(q.id).a;
        for (const c of q.competencies || []) { comp[c] = comp[c] || { correct: 0, total: 0 }; comp[c].total++; if (ok) comp[c].correct++; }
        if (ok) { correct++; if (misses < 2) placement = q.class; } else { misses++; missed.push(q.lesson_id); }
      }
      results[s] = { placement, grade, gap: Math.max(0, (grade || 0) - placement), correct, total: sq.length, missed };
    }
    return { results, competencies: comp };
  }
  function buildPath(grade, results, done = new Set()) {
    const per = {};
    for (const [s, r] of Object.entries(results)) {
      const g = grade || 1;
      let ls = C.lessons.filter((l) => l.subject === s && l.class && ((l.class > r.placement && l.class <= g) || r.missed.includes(l.id)));
      if (!ls.length) ls = C.lessons.filter((l) => l.subject === s && l.class === g);
      per[s] = ls.sort((a, b) => a.class - b.class).map((l) => l.id).filter((id) => !done.has(id)).slice(0, 6);
    }
    const order = Object.keys(per).sort((a, b) => (results[b].gap - results[a].gap));
    const out = [];
    for (let i = 0; i < 6; i++) for (const s of order) if (per[s][i]) out.push(per[s][i]);
    return [...new Set(out)].slice(0, 20);
  }
  function cohortFor(grade, results, person) {
    const maxGap = Math.max(0, ...Object.values(results).map((r) => r.gap));
    if (grade >= 5 && grade <= 10 && (maxGap >= 2 || isDropout(person))) return 'special_attention';
    if (maxGap >= 1) return 'catch_up';
    return 'on_track';
  }

  // ---------- learner state ----------
  function progressRows(pid) { return data.find('learning_progress', { person_id: pid }); }
  function streakFor(pid) {
    const days = sql('SELECT DISTINCT substr(at,1,10) d FROM learning_attempts WHERE person_id=? AND deleted=0 ORDER BY d DESC LIMIT 60', pid).map((r) => r.d);
    const set = new Set(days);
    let d = today(); if (!set.has(d)) d = dayShift(-1);
    let n = 0; while (set.has(d)) { n++; d = dayShift(-1, new Date(d + 'T12:00:00Z')); }
    return { current: n, active_today: set.has(today()), days: days.slice(0, 14) };
  }
  function hamletGoal(hamlet_id) {
    const ws = weekStart();
    let g = data.find('learning_goals', { hamlet_id }, { order: 'period_start DESC', limit: 1 })[0];
    const learners = sqlOne(`SELECT COUNT(DISTINCT e.person_id) n FROM enrolments e JOIN programmes p ON p.id=e.programme_id WHERE e.hamlet_id=? AND e.deleted=0 AND e.status='active' AND p.module='learning'`, hamlet_id).n;
    const target = g ? g.target : Math.max(15, learners * 2);
    const done = sqlOne('SELECT COUNT(*) n FROM learning_progress WHERE hamlet_id=? AND deleted=0 AND completed_at>=?', hamlet_id, ws).n;
    const h = brain.hamlets.get(hamlet_id);
    return { hamlet: h && h.name, hamlet_ml: h && h.name_ml, title: (g && g.title) || 'Hamlet lessons this week', title_ml: (g && g.title_ml) || 'ഈ ആഴ്ച ഊരിലെ പാഠങ്ങൾ', target, done, learners, week_start: ws, reached: done >= target };
  }
  function badgesFor(pid, prog, streak) {
    const out = [];
    const completed = prog.filter((p) => ['completed', 'mastered'].includes(p.status));
    if (sqlOne('SELECT 1 x FROM learning_diagnostics WHERE person_id=? AND deleted=0', pid)) out.push('explorer');
    if (completed.length >= 1) out.push('first_steps');
    if (completed.length >= 5) out.push('five_lessons');
    if (completed.length >= 12) out.push('bookworm');
    if (sqlOne('SELECT 1 x FROM learning_attempts WHERE person_id=? AND deleted=0 AND score>=1', pid)) out.push('perfect');
    const best = streak.current;
    if (best >= 3) out.push('streak_3');
    if (best >= 7) out.push('streak_7');
    if (new Set(completed.map((p) => p.subject)).size >= 3) out.push('all_rounder');
    if (sqlOne('SELECT COUNT(*) n FROM learning_submissions WHERE person_id=? AND deleted=0', pid).n >= 3) out.push('homework_star');
    const diags = data.find('learning_diagnostics', { person_id: pid }, { order: 'at' });
    if (diags.length >= 2) {
      const gap = (d) => Object.values(d.results || {}).reduce((a, r) => a + r.gap, 0);
      if (gap(diags[diags.length - 1]) < gap(diags[0])) out.push('climber');
    }
    const ws = weekStart();
    if (sqlOne('SELECT 1 x FROM learning_progress WHERE person_id=? AND deleted=0 AND completed_at>=?', pid, ws)) {
      const p = brain.persons.raw(pid);
      if (p && hamletGoal(p.hamlet_id).reached) out.push('team_player');
    }
    return out.map((k) => ({ key: k, ...BADGES[k] }));
  }

  function nextLessons(pid, person, { asOfStartOfToday = false } = {}) {
    const prog = progressRows(pid);
    const t0 = today();
    const doneSet = new Set(prog.filter((p) => ['completed', 'mastered'].includes(p.status) && !(asOfStartOfToday && (p.completed_at || '') >= t0)).map((p) => p.lesson_id));
    const diag = data.find('learning_diagnostics', { person_id: pid }, { order: 'at DESC', limit: 1 })[0];
    const grade = parseGrade(person);
    let pathIds = (diag && Array.isArray(diag.path) ? diag.path : []).filter((id) => C.byId.has(id) && !doneSet.has(id));
    if (!pathIds.length && grade) {
      pathIds = C.lessons.filter((l) => l.class && (l.class === grade || l.class === Math.min(10, grade + 1)) && !doneSet.has(l.id)).sort((a, b) => a.class - b.class).map((l) => l.id);
    }
    const lit = data.find('learning_literacy', { person_id: pid })[0];
    if (lit) {
      const litIds = C.lessons.filter((l) => l.track === 'literacy' && l.level <= Math.min(4, lit.level) && !doneSet.has(l.id)).sort((a, b) => a.level - b.level).map((l) => l.id);
      pathIds = grade ? [...pathIds, ...litIds] : litIds;
    }
    return { pathIds, doneSet, prog, diag };
  }

  function todayGoals(pid, person) {
    const { pathIds, prog } = nextLessons(pid, person, { asOfStartOfToday: true });
    const t0 = today();
    const todays = sql('SELECT lesson_id, MAX(score) s FROM learning_attempts WHERE person_id=? AND deleted=0 AND at>=? GROUP BY lesson_id', pid, t0);
    const scoreToday = Object.fromEntries(todays.map((r) => [r.lesson_id, r.s]));
    const goals = [];
    if (pathIds[0]) {
      const l = C.byId.get(pathIds[0]);
      goals.push({ kind: 'lesson', icon: '📖', lesson_id: l.id, en: `Learn: ${l.title}`, ml: `പഠിക്കാം: ${l.title_ml}`, done: (scoreToday[l.id] || 0) >= PASS });
    }
    const weak = prog.filter((p) => p.status === 'completed' && (p.best_score || 0) < MASTERY).sort((a, b) => (a.best_score || 0) - (b.best_score || 0))[0];
    const practice = weak ? C.byId.get(weak.lesson_id) : pathIds[1] && C.byId.get(pathIds[1]);
    if (practice) goals.push({ kind: 'practice', icon: '🎯', lesson_id: practice.id, en: `Practise ${practice.title} — aim for 80%`, ml: `${practice.title_ml} — 80% നേടാൻ പരിശീലിക്കാം`, done: (scoreToday[practice.id] || 0) >= MASTERY });
    const hw = pendingHomework(pid)[0];
    if (hw) goals.push({ kind: 'homework', icon: '📝', homework_id: hw.id, en: `Homework: ${hw.title}`, ml: `ഗൃഹപാഠം: ${hw.title_ml || hw.title}`, done: false });
    else if (pathIds[2] || pathIds[1]) { const l = C.byId.get(pathIds[2] || pathIds[1]); goals.push({ kind: 'listen', icon: '🔊', lesson_id: l.id, en: `Listen & read aloud: ${l.title}`, ml: `കേട്ട് ഉറക്കെ വായിക്കാം: ${l.title_ml}`, done: (scoreToday[l.id] || 0) > 0 }); }
    return goals;
  }

  function pendingHomework(pid) {
    const progIds = learningEnrolments(pid).filter((e) => e.status === 'active').map((e) => e.programme_id);
    if (!progIds.length) return [];
    const hws = sql(`SELECT * FROM learning_homework WHERE deleted=0 AND programme_id IN (${inList(progIds)}) ORDER BY due_date DESC LIMIT 30`, ...progIds);
    const subs = new Set(sql('SELECT homework_id FROM learning_submissions WHERE person_id=? AND deleted=0', pid).map((r) => r.homework_id));
    return hws.filter((h) => !subs.has(h.id) && (h.due_date || '9') >= dayShift(-3));
  }

  // Award passport competencies when enough tagged lessons are mastered.
  function checkCompetencyAwards(pid, user, agency_id) {
    const prog = progressRows(pid);
    const mastered = new Set(prog.filter((p) => p.status === 'mastered').map((p) => p.lesson_id));
    const out = [];
    const comps = Object.fromEntries(brain.competencies.list().map((c) => [c.code, c]));
    for (const [code, ids] of Object.entries(C.tagged)) {
      if (code.startsWith('LIT.ADULT')) continue; // literacy levels are awarded by facilitator assessment
      const have = ids.filter((id) => mastered.has(id));
      const need = Math.min(2, Math.max(1, Math.ceil(ids.length / 2)));
      if (have.length < need) continue;
      const c = comps[code];
      const scores = prog.filter((p) => have.includes(p.lesson_id)).map((p) => `${p.lesson_id} ${Math.round((p.best_score || 0) * 100)}%`);
      const e = brain.passport.award({ person_id: pid, type: 'competency', ref: code, title: c ? c.title : code, level: c ? c.level || 1 : 1, evidence: { module: 'learning', mastered: scores }, agency_id }, user);
      out.push({ code, title: c ? c.title : code, title_ml: c && c.title_ml, entry_id: e.id });
    }
    return out;
  }

  function recordAttempt(pid, lesson, answers, user, { at = null, kind = 'practice', silent = false } = {}) {
    const results = lesson.questions.map((q, i) => { const given = Array.isArray(answers) ? answers[i] : answers && answers[q.id]; const ok = given !== undefined && given !== null && Number(given) === q.a; return { id: q.id, given: given === undefined ? null : given, correct: ok, answer: q.a, x: q.x, x_ml: q.x_ml }; });
    const correct = results.filter((r) => r.correct).length;
    const total = results.length || 1;
    const score = Math.round((correct / total) * 100) / 100;
    const person = brain.persons.raw(pid);
    const when = at || new Date().toISOString();
    const out = tx(() => {
      data.put('learning_attempts', { person_id: pid, hamlet_id: person.hamlet_id, lesson_id: lesson.id, subject: lesson.subject, kind, score, correct, total, answers: results.map((r) => r.given), at: when }, user);
      const cur = data.find('learning_progress', { person_id: pid, lesson_id: lesson.id })[0];
      const best = Math.max(score, cur ? cur.best_score || 0 : 0);
      const status = best >= MASTERY ? 'mastered' : best >= PASS ? 'completed' : 'in_progress';
      const wasDone = cur && ['completed', 'mastered'].includes(cur.status);
      const wasMastered = cur && cur.status === 'mastered';
      const row = data.put('learning_progress', { ...(cur ? { id: cur.id } : {}), person_id: pid, hamlet_id: person.hamlet_id, lesson_id: lesson.id, subject: lesson.subject, class_level: lesson.class || lesson.level, status, best_score: best, attempts: (cur ? cur.attempts || 0 : 0) + 1, first_at: cur ? cur.first_at : when, last_at: when, completed_at: wasDone ? cur.completed_at : (status !== 'in_progress' ? when : null) }, user);
      return { row, newlyCompleted: !wasDone && status !== 'in_progress', newlyMastered: !wasMastered && status === 'mastered' };
    });
    let awarded = [];
    if (!silent) {
      if (out.newlyCompleted) emit('learning.lesson_completed', { person_id: pid, lesson_id: lesson.id, subject: lesson.subject, class: lesson.class, level: lesson.level, score }, user, person.hamlet_id);
      if (out.newlyMastered) {
        emit('learning.mastery_achieved', { person_id: pid, lesson_id: lesson.id, competencies: lesson.competencies, score }, user, person.hamlet_id);
        awarded = checkCompetencyAwards(pid, user, awardingAgency(pid, lesson.track));
      }
    }
    return { score, correct, total, results, status: out.row.status, best_score: out.row.best_score, newly_completed: out.newlyCompleted, newly_mastered: out.newlyMastered, awarded };
  }

  function attendanceStats(pids, agency_id, days = 30) {
    if (!pids.length) return {};
    const since = dayShift(-days);
    const params = [since, ...pids];
    let q = `SELECT person_id, SUM(status IN ('present','late')) p, COUNT(*) n FROM learning_attendance WHERE deleted=0 AND date>=? AND person_id IN (${inList(pids)})`;
    if (agency_id) { q += ' AND agency_id=?'; params.push(agency_id); }
    return Object.fromEntries(sql(q + ' GROUP BY person_id', ...params).map((r) => [r.person_id, { present: r.p, total: r.n, rate: r.n ? r.p / r.n : null }]));
  }
  function scoreStats(pids, days = 30) {
    if (!pids.length) return {};
    return Object.fromEntries(sql(`SELECT person_id, AVG(score) s, COUNT(*) n FROM learning_attempts WHERE deleted=0 AND at>=? AND person_id IN (${inList(pids)}) GROUP BY person_id`, dayShift(-days), ...pids).map((r) => [r.person_id, { avg: r.s, n: r.n }]));
  }
  function openFlags(pids, agency_id) {
    if (!pids.length) return {};
    const params = [...pids];
    let q = `SELECT * FROM learning_flags WHERE deleted=0 AND status='open' AND person_id IN (${inList(pids)})`;
    if (agency_id) { q += ' AND agency_id=?'; params.push(agency_id); }
    const out = {};
    for (const f of sql(q + ' ORDER BY at DESC', ...params)) (out[f.person_id] = out[f.person_id] || []).push(f);
    return out;
  }
  function riskFor(att, sc, flags) {
    const reasons = [];
    if (att && att.total >= 3 && att.rate < ATT_RISK) reasons.push('low_attendance');
    if (sc && sc.n >= 2 && sc.avg < SCORE_RISK) reasons.push('learning_gap');
    for (const f of flags || []) if (!reasons.includes(f.reason)) reasons.push(f.reason);
    return reasons;
  }

  function atRiskList(user, progs) {
    const scope = agencyScope(user);
    const seen = new Map();
    for (const p of progs) for (const l of roster(user, p).learners) if (!seen.has(l.id)) seen.set(l.id, { ...l, programme_id: p.id, programme: p.title, track: p.track });
    const pids = [...seen.keys()];
    const att = attendanceStats(pids, scope); const sc = scoreStats(pids); const fl = openFlags(pids, scope);
    return pids.map((id) => ({ ...seen.get(id), attendance: att[id] || null, score: sc[id] || null, flags: fl[id] || [], reasons: riskFor(att[id], sc[id], fl[id]) }))
      .filter((r) => r.reasons.length)
      .sort((a, b) => (a.attendance?.rate ?? 1) - (b.attendance?.rate ?? 1));
  }

  function raiseFlag({ person_id, programme_id, agency_id, reason, note }, user) {
    const exist = data.find('learning_flags', { person_id, agency_id, reason, status: 'open' })[0];
    if (exist) return { flag: exist, created: false };
    const p = brain.persons.raw(person_id);
    const flag = data.put('learning_flags', { person_id, hamlet_id: p.hamlet_id, agency_id, programme_id, reason, note, status: 'open', raised_by: user ? user.id : 'auto', at: new Date().toISOString() }, user);
    emit('learning.at_risk_flagged', { person_id, programme_id, agency_id, reason, flag_id: flag.id }, user, p.hamlet_id);
    return { flag, created: true };
  }

  function learnerDetail(user, pid) {
    const person = personLite(pid);
    if (!person) throw httpError(404, 'Not found');
    const scope = agencyScope(user);
    const self = user.person_id === pid || user.role === 'guardian';
    const prog = progressRows(pid);
    const bySubject = {};
    for (const s of Object.keys(SUBJECTS)) {
      const rows = prog.filter((p) => p.subject === s);
      const total = C.lessons.filter((l) => l.subject === s).length;
      if (!rows.length && s === 'literacy') continue;
      bySubject[s] = { ...SUBJECTS[s], completed: rows.filter((r) => r.status !== 'in_progress').length, mastered: rows.filter((r) => r.status === 'mastered').length, total, avg: rows.length ? rows.reduce((a, r) => a + (r.best_score || 0), 0) / rows.length : null };
    }
    const diags = data.find('learning_diagnostics', { person_id: pid }, { order: 'at' });
    const attempts = sql('SELECT lesson_id, subject, score, at, kind FROM learning_attempts WHERE person_id=? AND deleted=0 ORDER BY at DESC LIMIT 25', pid).map((a) => ({ ...a, title: C.byId.get(a.lesson_id)?.title, title_ml: C.byId.get(a.lesson_id)?.title_ml }));
    const attQ = scope && !self ? sql('SELECT a.date, a.status, s.topic, s.programme_id FROM learning_attendance a LEFT JOIN learning_sessions s ON s.id=a.session_id WHERE a.person_id=? AND a.deleted=0 AND a.agency_id=? ORDER BY a.date DESC LIMIT 40', pid, scope)
      : sql('SELECT a.date, a.status, s.topic, s.programme_id FROM learning_attendance a LEFT JOIN learning_sessions s ON s.id=a.session_id WHERE a.person_id=? AND a.deleted=0 ORDER BY a.date DESC LIMIT 40', pid);
    const att30 = attendanceStats([pid], self ? null : scope)[pid] || null;
    const flags = (self ? [] : (scope ? data.find('learning_flags', { person_id: pid, agency_id: scope }, { order: 'at DESC' }) : data.find('learning_flags', { person_id: pid }, { order: 'at DESC' })));
    const subs = sql('SELECT s.*, h.title hw_title, h.title_ml hw_title_ml, h.due_date FROM learning_submissions s JOIN learning_homework h ON h.id=s.homework_id WHERE s.person_id=? AND s.deleted=0 ' + (scope && !self ? 'AND s.agency_id=? ' : '') + 'ORDER BY s.submitted_at DESC LIMIT 10', ...(scope && !self ? [pid, scope] : [pid])).map((s) => ({ ...s, thumb: s.thumb ? true : false }));
    const literacy = data.find('learning_literacy', { person_id: pid })[0] || null;
    const passport = brain.passport.entries(pid).filter((e) => e.type === 'competency').map((e) => ({ ref: e.ref, title: e.title, level: e.level, issued_at: e.issued_at }));
    const streak = streakFor(pid);
    const weekly = [];
    for (let w = 11; w >= 0; w--) { const from = dayShift(-7 * (w + 1)); const to = dayShift(-7 * w); weekly.push(sqlOne('SELECT COUNT(*) n FROM learning_attempts WHERE person_id=? AND deleted=0 AND at>=? AND at<?', pid, from, to).n); }
    return { person, bySubject, diagnostics: diags, attempts, attendance: { recent: attQ, last30: att30 }, flags, submissions: subs, literacy, passport, streak, weekly, badges: badgesFor(pid, prog, streak), subjects: SUBJECTS };
  }

  // =================================================================== routes
  // ---- content ----
  router.get('/content/subjects', authed, (req, res) => {
    const out = Object.entries(SUBJECTS).map(([id, s]) => ({ id, ...s, lessons: C.lessons.filter((l) => l.subject === id).length, questions: C.lessons.filter((l) => l.subject === id).reduce((a, l) => a + l.questions.length, 0) }));
    res.json({ subjects: out, levels: C.levels, totals: { lessons: C.lessons.length, questions: C.qById.size, bridge: C.lessons.filter((l) => l.bridge).length } });
  });
  router.get('/content/lessons', authed, (req, res) => {
    let ls = C.lessons;
    if (req.query.subject) ls = ls.filter((l) => l.subject === req.query.subject);
    if (req.query.track) ls = ls.filter((l) => l.track === req.query.track);
    if (req.query.class) ls = ls.filter((l) => String(l.class) === String(req.query.class));
    if (req.query.q) { const q = String(req.query.q).toLowerCase(); ls = ls.filter((l) => (l.title + ' ' + l.title_ml + ' ' + (l.scert || '')).toLowerCase().includes(q)); }
    res.json(ls.map(lessonLite).sort((a, b) => (a.class || a.level) - (b.class || b.level) || a.subject.localeCompare(b.subject)));
  });
  router.get('/content/lessons/:id', authed, (req, res) => {
    const l = C.byId.get(req.params.id);
    if (!l) throw httpError(404, 'Lesson not found');
    const staff = brain.policy.can(req.user, 'teach') || brain.policy.can(req.user, 'hamlet.coordinate');
    const out = { ...l, subject_info: SUBJECTS[l.subject] };
    if (!staff) { delete out.activity; delete out.activity_ml; }
    const idx = C.lessons.filter((x) => x.subject === l.subject && x.track === l.track);
    const i = idx.indexOf(l);
    out.next_id = idx[i + 1] ? idx[i + 1].id : null;
    out.prev_id = idx[i - 1] ? idx[i - 1].id : null;
    if (req.user.person_id && ['learner'].includes(req.user.role)) out.my_progress = data.find('learning_progress', { person_id: req.user.person_id, lesson_id: l.id })[0] || null;
    res.json(out);
  });
  // SCERT-aligned lesson-plan library for facilitators.
  router.get('/content/plans', requires('teach', 'hamlet.coordinate'), (req, res) => {
    let ls = C.lessons;
    if (req.query.subject) ls = ls.filter((l) => l.subject === req.query.subject);
    if (req.query.class) ls = ls.filter((l) => String(l.class || l.level) === String(req.query.class));
    res.json(ls.map((l) => ({ ...lessonLite(l), objective: l.title, objective_ml: l.title_ml, warmup: l.audio_ml || l.audio_en || null, activity: l.activity || null, activity_ml: l.activity_ml || null, bridge_note: l.bridge ? l.bridge.note : null, bridge_note_ml: l.bridge ? l.bridge.note_ml : null, bridge_languages: l.bridge ? l.bridge.languages : [], check: l.questions.slice(0, 2).map((q) => q.q) })));
  });

  // ---- diagnostic placement ----
  router.get('/diagnostic', requires('learn', 'assess'), (req, res) => {
    const pid = target(req, { write: true });
    const p = brain.persons.raw(pid);
    const grade = parseGrade(p);
    if (!grade) throw httpError(400, 'Placement check is for school-age learners. Adults use the literacy circle levels.');
    const last = data.find('learning_diagnostics', { person_id: pid }, { order: 'at DESC', limit: 1 })[0] || null;
    res.json({ person: personLite(pid), grade, last, questions: diagnosticQuestions(grade), subjects: SUBJECTS });
  });
  router.post('/diagnostic', requires('learn', 'assess'), (req, res) => {
    const pid = target(req, { write: true });
    const p = brain.persons.raw(pid);
    const grade = parseGrade(p);
    if (!grade) throw httpError(400, 'Placement check is for school-age learners.');
    const answers = req.body.answers || {};
    if (typeof answers !== 'object') throw httpError(400, 'answers must be an object {questionId: optionIndex}');
    const { results, competencies } = gradeDiagnostic(grade, answers);
    const done = new Set(progressRows(pid).filter((r) => r.status !== 'in_progress').map((r) => r.lesson_id));
    const pathIds = buildPath(grade, results, done);
    const cohort = cohortFor(grade, results, p);
    const row = data.put('learning_diagnostics', { person_id: pid, hamlet_id: p.hamlet_id, grade, results, path: pathIds, cohort, at: new Date().toISOString() }, req.user);
    emit('learning.diagnostic_completed', { person_id: pid, grade, cohort, placements: Object.fromEntries(Object.entries(results).map(([s, r]) => [s, r.placement])) }, req.user, p.hamlet_id);
    if (cohort === 'special_attention') {
      const ag = awardingAgency(pid, 'tuition');
      if (ag) raiseFlag({ person_id: pid, agency_id: ag, programme_id: null, reason: 'learning_gap', note: `Placement check: ${Object.entries(results).filter(([, r]) => r.gap >= 2).map(([s, r]) => `${SUBJECTS[s].en} at class ${r.placement || 'foundation'} (grade ${grade})`).join(', ')}` }, req.user);
    }
    res.json({ ...row, competencies, path_lessons: pathIds.map((id) => lessonLite(C.byId.get(id))) });
  });

  // ---- learner home ----
  router.get('/me/today', requires('learn', 'family', 'learner.read'), (req, res) => {
    const pid = target(req);
    const person = personLite(pid);
    if (!person) throw httpError(404, 'Not found');
    const { pathIds, prog, diag } = nextLessons(pid, person);
    const streak = streakFor(pid);
    const inProg = prog.filter((p) => p.status === 'in_progress').sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''))[0];
    const cont = inProg ? C.byId.get(inProg.lesson_id) : pathIds[0] && C.byId.get(pathIds[0]);
    const literacy = data.find('learning_literacy', { person_id: pid })[0] || null;
    const enrol = learningEnrolments(pid).filter((e) => e.status === 'active').map((e) => ({ programme_id: e.programme_id, title: e.programme.title, title_ml: e.programme.title_ml, track: e.programme.track, agency: brain.agencies.get(e.agency_id)?.name, schedule: e.programme.schedule }));
    const camps = sql("SELECT * FROM learning_camps WHERE deleted=0 AND hamlet_id=? AND end_date>=? AND status!='cancelled' ORDER BY start_date LIMIT 3", person.hamlet_id, today());
    const passport = brain.passport.entries(pid).filter((e) => e.type === 'competency').slice(0, 12).map((e) => ({ ref: e.ref, title: e.title, issued_at: e.issued_at }));
    const completed = prog.filter((p) => p.status !== 'in_progress').length;
    res.json({
      person, enrolments: enrol, diagnostic: diag || null, needs_diagnostic: !!person.grade && !diag,
      goals: todayGoals(pid, person), continue: cont ? { ...lessonLite(cont), progress: prog.find((p) => p.lesson_id === cont.id) || null } : null,
      path: pathIds.slice(0, 8).map((id) => lessonLite(C.byId.get(id))), streak, badges: badgesFor(pid, prog, streak), all_badges: BADGES,
      hamlet_goal: hamletGoal(person.hamlet_id), literacy, literacy_levels: C.levels, camps, passport,
      stats: { completed, mastered: prog.filter((p) => p.status === 'mastered').length, avg: prog.length ? prog.reduce((a, p) => a + (p.best_score || 0), 0) / prog.length : null, homework_pending: pendingHomework(pid).length },
      subjects: SUBJECTS,
    });
  });

  // ---- quiz attempt (instant grading on device, re-graded & stored here) ----
  router.post('/lessons/:id/attempt', requires('learn', 'assess'), (req, res) => {
    const lesson = C.byId.get(req.params.id);
    if (!lesson) throw httpError(404, 'Lesson not found');
    const pid = target(req, { write: true });
    const out = recordAttempt(pid, lesson, req.body.answers, req.user, { kind: req.body.kind === 'review' ? 'review' : 'practice' });
    const streak = streakFor(pid);
    res.json({ ...out, streak, badges: badgesFor(pid, progressRows(pid), streak), hamlet_goal: hamletGoal(brain.persons.raw(pid).hamlet_id) });
  });
  router.get('/me/progress', requires('learn', 'family', 'learner.read'), (req, res) => res.json(learnerDetail(req.user, target(req))));

  // ---- guardian ----
  router.get('/children', requires('family'), (req, res) => {
    const kids = brain.persons.visible(req.user, {}).filter((p) => p.id !== req.user.person_id && p.guardian_id === req.user.person_id);
    res.json(kids.map((k) => {
      const prog = progressRows(k.id); const streak = streakFor(k.id);
      const att = attendanceStats([k.id], null)[k.id] || null;
      return { ...personLite(k.id), completed: prog.filter((p) => p.status !== 'in_progress').length, mastered: prog.filter((p) => p.status === 'mastered').length, streak: streak.current, attendance: att, last_active: prog.map((p) => p.last_at).sort().pop() || null };
    }));
  });

  // ---- staff: programmes, rosters, learners ----
  router.get('/programmes', requires('teach', 'hamlet.coordinate', 'agency.manage'), (req, res) => {
    const ag = Object.fromEntries(brain.agencies.list().map((a) => [a.id, a]));
    res.json(staffProgrammes(req.user).map((p) => { const r = roster(req.user, p); return { ...p, agency_name: ag[p.agency_id]?.name, agency_colour: ag[p.agency_id]?.colour, hamlet: brain.hamlets.get(p.hamlet_id)?.name, learners: r.learners.length, hidden: r.hidden }; }));
  });
  router.get('/programmes/:id/roster', requires('teach', 'hamlet.coordinate'), (req, res) => {
    const p = assertProgramme(req.user, req.params.id);
    const r = roster(req.user, p);
    const pids = r.learners.map((l) => l.id);
    const scope = agencyScope(req.user);
    const att = attendanceStats(pids, scope); const sc = scoreStats(pids); const fl = openFlags(pids, scope);
    res.json({ programme: p, hidden: r.hidden, learners: r.learners.map((l) => ({ ...l, attendance: att[l.id] || null, score: sc[l.id] || null, flags: fl[l.id] || [], reasons: riskFor(att[l.id], sc[l.id], fl[l.id]) })) });
  });
  router.get('/learners/:pid', requires('learner.read', 'family', 'learn'), (req, res) => {
    const pid = req.params.pid;
    if (pid !== req.user.person_id) { const v = brain.policy.canSee(req.user, pid, 'progress'); if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason); }
    res.json(learnerDetail(req.user, pid));
  });

  // ---- sessions & attendance ----
  router.get('/sessions', requires('teach', 'hamlet.coordinate'), (req, res) => {
    const progs = staffProgrammes(req.user);
    const ids = req.query.programme_id ? [assertProgramme(req.user, req.query.programme_id).id] : progs.map((p) => p.id);
    if (!ids.length) return res.json([]);
    const from = req.query.from || dayShift(-14), to = req.query.to || dayShift(30);
    const rows = sql(`SELECT * FROM learning_sessions WHERE deleted=0 AND programme_id IN (${inList(ids)}) AND date>=? AND date<=? ORDER BY date DESC, start_time LIMIT 300`, ...ids, from, to);
    const pmap = Object.fromEntries(progs.map((p) => [p.id, p]));
    res.json(rows.map((s) => ({ ...s, programme: pmap[s.programme_id]?.title, hamlet: brain.hamlets.get(s.hamlet_id)?.name })));
  });
  router.post('/sessions', requires('teach'), (req, res) => {
    const b = req.body;
    const p = assertProgramme(req.user, b.programme_id);
    const date = b.date || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, 'date must be YYYY-MM-DD');
    const lesson_ids = (Array.isArray(b.lesson_ids) ? b.lesson_ids : b.lesson_ids ? [b.lesson_ids] : []).filter((id) => C.byId.has(id));
    const topic = b.topic || (lesson_ids[0] ? C.byId.get(lesson_ids[0]).title : 'Class session');
    const s = data.put('learning_sessions', { programme_id: p.id, agency_id: p.agency_id, hamlet_id: p.hamlet_id, track: p.track, date, start_time: b.start_time || '16:00', kind: b.kind || 'class', topic, lesson_ids, notes: b.notes || '', status: 'scheduled', facilitator_id: req.user.id, present_count: 0, roster_count: 0, camp_id: b.camp_id || null }, req.user);
    emit('learning.session_created', { session_id: s.id, programme_id: p.id, date }, req.user, p.hamlet_id);
    res.json(s);
  });
  function sessionFor(user, id) {
    const s = data.get('learning_sessions', id);
    if (!s) throw httpError(404, 'Session not found');
    assertProgramme(user, s.programme_id);
    return s;
  }
  router.get('/sessions/:id', requires('teach', 'hamlet.coordinate'), (req, res) => {
    const s = sessionFor(req.user, req.params.id);
    const p = brain.programmes.get(s.programme_id);
    const r = roster(req.user, p);
    const marks = Object.fromEntries(data.find('learning_attendance', { session_id: s.id }).map((a) => [a.person_id, a.status]));
    const att = attendanceStats(r.learners.map((l) => l.id), agencyScope(req.user));
    res.json({ ...s, programme: p, hidden: r.hidden, lessons: (s.lesson_ids || []).map((id) => C.byId.get(id)).filter(Boolean).map(lessonLite), roster: r.learners.map((l) => ({ ...l, status: marks[l.id] || null, attendance: att[l.id] || null })) });
  });
  router.put('/sessions/:id', requires('teach'), (req, res) => {
    const s = sessionFor(req.user, req.params.id);
    const b = req.body;
    const patch = {};
    for (const k of ['notes', 'topic', 'start_time', 'date']) if (b[k] !== undefined) patch[k] = String(b[k]).slice(0, 4000);
    if (b.status && ['scheduled', 'held', 'cancelled'].includes(b.status)) patch.status = b.status;
    if (Array.isArray(b.lesson_ids)) patch.lesson_ids = b.lesson_ids.filter((id) => C.byId.has(id));
    res.json(data.put('learning_sessions', { ...s, ...patch }, req.user));
  });
  router.post('/sessions/:id/attendance', requires('teach'), (req, res) => {
    const s = sessionFor(req.user, req.params.id);
    const p = brain.programmes.get(s.programme_id);
    const marks = Array.isArray(req.body.marks) ? req.body.marks : [];
    if (!marks.length) throw httpError(400, 'marks: [{person_id, status}] required');
    const enrolled = new Set(brain.enrolments.forProgramme(p.id).filter((e) => e.status === 'active').map((e) => e.person_id));
    for (const m of marks) {
      if (!['present', 'absent', 'late', 'excused'].includes(m.status)) throw httpError(400, 'status must be present | absent | late | excused');
      if (!enrolled.has(m.person_id)) throw httpError(403, 'Learner is not enrolled in this programme.');
      if (!canProgress(req.user, m.person_id)) throw httpError(403, 'No active consent to record this learner\'s attendance.');
    }
    const flagged = [];
    tx(() => {
      const existing = Object.fromEntries(data.find('learning_attendance', { session_id: s.id }).map((a) => [a.person_id, a]));
      for (const m of marks) {
        const per = brain.persons.raw(m.person_id);
        data.put('learning_attendance', { ...(existing[m.person_id] ? { id: existing[m.person_id].id } : {}), session_id: s.id, programme_id: p.id, agency_id: p.agency_id, person_id: m.person_id, hamlet_id: per.hamlet_id, date: s.date, status: m.status, marked_by: req.user.id }, req.user);
      }
      const all = data.find('learning_attendance', { session_id: s.id });
      data.put('learning_sessions', { ...s, status: 'held', notes: req.body.notes !== undefined ? String(req.body.notes).slice(0, 4000) : s.notes, present_count: all.filter((a) => ['present', 'late'].includes(a.status)).length, roster_count: all.length }, req.user);
    });
    const present = marks.filter((m) => ['present', 'late'].includes(m.status)).length;
    emit('learning.attendance_marked', { session_id: s.id, programme_id: p.id, date: s.date, present, total: marks.length }, req.user, p.hamlet_id);
    // auto at-risk: attendance under 60% over the last 30 days (min 4 marked sessions)
    const absent = marks.filter((m) => m.status === 'absent').map((m) => m.person_id);
    const att = attendanceStats(absent, p.agency_id);
    for (const pid of absent) {
      const a = att[pid];
      if (a && a.total >= 4 && a.rate < ATT_RISK) { const r = raiseFlag({ person_id: pid, programme_id: p.id, agency_id: p.agency_id, reason: 'low_attendance', note: `Attendance ${pct(a.present, a.total)}% in last 30 days` }, req.user); if (r.created) flagged.push(pid); }
    }
    res.json({ ok: true, session_id: s.id, present, total: marks.length, flagged });
  });

  // ---- at-risk ----
  router.get('/at-risk', requires('teach', 'hamlet.coordinate'), (req, res) => res.json(atRiskList(req.user, staffProgrammes(req.user))));
  router.post('/flags', requires('teach', 'hamlet.coordinate'), (req, res) => {
    const b = req.body;
    if (!b.person_id || !['low_attendance', 'learning_gap', 'dropout_risk', 'other'].includes(b.reason)) throw httpError(400, 'person_id and reason (low_attendance | learning_gap | dropout_risk | other) required');
    if (!canProgress(req.user, b.person_id)) throw httpError(403, 'No active consent for this learner.');
    let agency_id = req.user.agency_id;
    if (b.programme_id) agency_id = assertProgramme(req.user, b.programme_id).agency_id;
    if (!agency_id) throw httpError(400, 'agency required');
    const r = raiseFlag({ person_id: b.person_id, programme_id: b.programme_id || null, agency_id, reason: b.reason, note: String(b.note || '').slice(0, 1000) }, req.user);
    res.json(r.flag);
  });
  router.post('/flags/:id/resolve', requires('teach', 'hamlet.coordinate'), (req, res) => {
    const f = data.get('learning_flags', req.params.id);
    if (!f || (!isSteward(req.user) && f.agency_id !== req.user.agency_id)) throw httpError(404, 'Flag not found');
    res.json(data.put('learning_flags', { ...f, status: 'resolved', resolved_at: new Date().toISOString(), note: req.body.note ? `${f.note || ''}\nResolved: ${String(req.body.note).slice(0, 500)}` : f.note }, req.user));
  });

  // ---- facilitator console ----
  router.get('/console', requires('teach', 'hamlet.coordinate'), (req, res) => {
    const progs = staffProgrammes(req.user);
    const ids = progs.map((p) => p.id);
    const t = today();
    const pmap = Object.fromEntries(progs.map((p) => [p.id, p]));
    const sessions = ids.length ? sql(`SELECT * FROM learning_sessions WHERE deleted=0 AND programme_id IN (${inList(ids)}) AND date>=? AND date<=? ORDER BY date, start_time`, ...ids, t, dayShift(7)) : [];
    const deco = (s) => ({ ...s, programme: pmap[s.programme_id]?.title, programme_ml: pmap[s.programme_id]?.title_ml, hamlet: brain.hamlets.get(s.hamlet_id)?.name });
    const risk = atRiskList(req.user, progs);
    const hwIds = ids.length ? sql(`SELECT id FROM learning_homework WHERE deleted=0 AND programme_id IN (${inList(ids)})`, ...ids).map((r) => r.id) : [];
    const toReview = hwIds.length ? sqlOne(`SELECT COUNT(*) n FROM learning_submissions WHERE deleted=0 AND feedback IS NULL AND homework_id IN (${inList(hwIds)})`, ...hwIds).n : 0;
    const camps = sql(`SELECT * FROM learning_camps WHERE deleted=0 AND end_date>=? ${isSteward(req.user) ? '' : 'AND agency_id=?'} ORDER BY start_date LIMIT 10`, ...(isSteward(req.user) ? [t] : [t, req.user.agency_id || '-']));
    const held30 = ids.length ? sqlOne(`SELECT COUNT(*) n, SUM(present_count) p, SUM(roster_count) r FROM learning_sessions WHERE deleted=0 AND status='held' AND programme_id IN (${inList(ids)}) AND date>=?`, ...ids, dayShift(-30)) : { n: 0, p: 0, r: 0 };
    let learnerCount = 0, hidden = 0; for (const p of progs) { const r = roster(req.user, p); learnerCount += r.learners.length; hidden += r.hidden; }
    res.json({
      today: t, programmes: progs.map((p) => ({ id: p.id, title: p.title, title_ml: p.title_ml, track: p.track, hamlet: brain.hamlets.get(p.hamlet_id)?.name, schedule: p.schedule })),
      today_sessions: sessions.filter((s) => s.date === t).map(deco), upcoming: sessions.filter((s) => s.date > t).slice(0, 8).map(deco),
      at_risk: risk.slice(0, 20), at_risk_total: risk.length, homework_to_review: toReview, camps,
      stats: { learners: learnerCount, hidden, sessions_30d: held30.n || 0, attendance_30d: held30.r ? held30.p / held30.r : null },
    });
  });

  // ---- homework ----
  const THUMB_RE = /^data:(image\/(png|jpeg|jpg|webp|gif)|audio\/(webm|ogg|mpeg|mp4|wav));base64,[A-Za-z0-9+/=]+$/;
  router.post('/homework', requires('teach'), (req, res) => {
    const b = req.body;
    const p = assertProgramme(req.user, b.programme_id);
    if (!b.title) throw httpError(400, 'title required');
    const hw = data.put('learning_homework', { programme_id: p.id, agency_id: p.agency_id, hamlet_id: p.hamlet_id, title: String(b.title).slice(0, 200), title_ml: b.title_ml ? String(b.title_ml).slice(0, 200) : null, instructions: String(b.instructions || '').slice(0, 2000), lesson_id: C.byId.has(b.lesson_id) ? b.lesson_id : null, due_date: b.due_date || dayShift(5), assigned_by: req.user.id, assigned_at: new Date().toISOString() }, req.user);
    emit('learning.homework_assigned', { homework_id: hw.id, programme_id: p.id }, req.user, p.hamlet_id);
    res.json(hw);
  });
  router.get('/homework', requires('teach', 'learn', 'family'), (req, res) => {
    const u = req.user;
    if (brain.policy.can(u, 'teach')) {
      const progs = staffProgrammes(u); const ids = progs.map((p) => p.id);
      if (!ids.length) return res.json([]);
      const pmap = Object.fromEntries(progs.map((p) => [p.id, p]));
      const hws = sql(`SELECT * FROM learning_homework WHERE deleted=0 AND programme_id IN (${inList(ids)}) ORDER BY assigned_at DESC LIMIT 60`, ...ids);
      return res.json(hws.map((h) => {
        const subs = sql('SELECT person_id, feedback FROM learning_submissions WHERE homework_id=? AND deleted=0', h.id).filter((s) => canProgress(u, s.person_id));
        return { ...h, programme: pmap[h.programme_id]?.title, hamlet: brain.hamlets.get(h.hamlet_id)?.name, lesson: h.lesson_id ? lessonLite(C.byId.get(h.lesson_id)) : null, submitted: subs.length, to_review: subs.filter((s) => !s.feedback).length, roster: roster(u, pmap[h.programme_id]).learners.length };
      }));
    }
    const pid = target(req);
    const progIds = learningEnrolments(pid).filter((e) => e.status === 'active').map((e) => e.programme_id);
    if (!progIds.length) return res.json([]);
    const hws = sql(`SELECT * FROM learning_homework WHERE deleted=0 AND programme_id IN (${inList(progIds)}) ORDER BY due_date DESC LIMIT 30`, ...progIds);
    const subs = Object.fromEntries(sql('SELECT * FROM learning_submissions WHERE person_id=? AND deleted=0', pid).map((s) => [s.homework_id, s]));
    res.json(hws.map((h) => ({ ...h, lesson: h.lesson_id ? lessonLite(C.byId.get(h.lesson_id)) : null, submission: subs[h.id] || null })));
  });
  router.get('/homework/:id', requires('teach', 'learn', 'family'), (req, res) => {
    const h = data.get('learning_homework', req.params.id);
    if (!h) throw httpError(404, 'Homework not found');
    if (brain.policy.can(req.user, 'teach')) {
      const p = assertProgramme(req.user, h.programme_id);
      const r = roster(req.user, p);
      const subs = Object.fromEntries(data.find('learning_submissions', { homework_id: h.id }).map((s) => [s.person_id, s]));
      return res.json({ ...h, programme: p, lesson: h.lesson_id ? lessonLite(C.byId.get(h.lesson_id)) : null, hidden: r.hidden, learners: r.learners.map((l) => ({ ...l, submission: subs[l.id] || null })) });
    }
    const pid = target(req);
    if (!learningEnrolments(pid).some((e) => e.programme_id === h.programme_id)) throw httpError(403, 'Not your class.');
    res.json({ ...h, lesson: h.lesson_id ? lessonLite(C.byId.get(h.lesson_id)) : null, submission: data.find('learning_submissions', { homework_id: h.id, person_id: pid })[0] || null });
  });
  router.post('/homework/:id/submit', requires('learn'), (req, res) => {
    const h = data.get('learning_homework', req.params.id);
    if (!h) throw httpError(404, 'Homework not found');
    const pid = req.user.person_id;
    if (!learningEnrolments(pid).some((e) => e.programme_id === h.programme_id && e.status === 'active')) throw httpError(403, 'Not your class.');
    const b = req.body;
    const kind = ['text', 'photo', 'voice'].includes(b.kind) ? b.kind : 'text';
    let thumb = null;
    if (b.thumb) {
      if (typeof b.thumb !== 'string' || !THUMB_RE.test(b.thumb)) throw httpError(400, 'thumb must be a base64 image/audio data URL');
      if (b.thumb.length > 280000) throw httpError(400, 'Attachment too large (max ~200 KB). Please use a smaller photo or shorter recording.');
      thumb = b.thumb;
    }
    if (!b.text && !thumb && !b.media_note) throw httpError(400, 'Write an answer or attach a photo / voice note.');
    const p = brain.persons.raw(pid);
    const prev = data.find('learning_submissions', { homework_id: h.id, person_id: pid })[0];
    const s = data.put('learning_submissions', { ...(prev ? { id: prev.id } : {}), homework_id: h.id, programme_id: h.programme_id, person_id: pid, hamlet_id: p.hamlet_id, agency_id: h.agency_id, kind, text: String(b.text || '').slice(0, 4000), media_note: String(b.media_note || '').slice(0, 300), thumb, submitted_at: new Date().toISOString(), feedback: null, feedback_kind: null, feedback_by: null, feedback_at: null, grade: null }, req.user);
    emit('learning.homework_submitted', { homework_id: h.id, person_id: pid, kind }, req.user, p.hamlet_id);
    res.json({ ...s, thumb: !!s.thumb });
  });
  router.get('/submissions/:id/media', requires('teach', 'learn', 'family'), (req, res) => {
    const s = data.get('learning_submissions', req.params.id);
    if (!s) throw httpError(404, 'Not found');
    const own = s.person_id === req.user.person_id;
    if (!own) { if (!canProgress(req.user, s.person_id)) throw httpError(403, 'Not permitted'); if (!isSteward(req.user) && req.user.role !== 'guardian' && s.agency_id !== req.user.agency_id) throw httpError(403, 'Not permitted'); }
    res.json({ thumb: s.thumb || null, media_note: s.media_note, kind: s.kind });
  });
  router.post('/submissions/:id/feedback', requires('teach'), (req, res) => {
    const s = data.get('learning_submissions', req.params.id);
    if (!s) throw httpError(404, 'Not found');
    const h = data.get('learning_homework', s.homework_id);
    assertProgramme(req.user, h.programme_id);
    if (!canProgress(req.user, s.person_id)) throw httpError(403, 'No active consent for this learner.');
    if (!req.body.feedback) throw httpError(400, 'feedback required');
    const grade = req.body.grade ? Math.max(1, Math.min(5, Number(req.body.grade) || 0)) : null;
    const out = data.put('learning_submissions', { ...s, feedback: String(req.body.feedback).slice(0, 2000), feedback_kind: req.body.feedback_kind === 'voice' ? 'voice' : 'text', feedback_by: req.user.id, feedback_at: new Date().toISOString(), grade }, req.user);
    brain.notify(s.person_id, `Your homework "${h.title}" has feedback from your teacher. / നിങ്ങളുടെ ഗൃഹപാഠത്തിന് ടീച്ചറുടെ പ്രതികരണം വന്നു.`, { channel: 'app' }, req.user);
    res.json({ ...out, thumb: !!out.thumb });
  });

  // ---- literacy circles ----
  router.get('/literacy/levels', authed, (req, res) => res.json({ levels: C.levels, lessons: C.lessons.filter((l) => l.track === 'literacy').map(lessonLite) }));
  router.get('/literacy/circles', requires('teach', 'hamlet.coordinate', 'agency.manage'), (req, res) => {
    const progs = staffProgrammes(req.user).filter((p) => p.track === 'literacy');
    res.json(progs.map((p) => {
      const r = roster(req.user, p);
      const recs = Object.fromEntries(r.learners.length ? sql(`SELECT * FROM learning_literacy WHERE deleted=0 AND person_id IN (${inList(r.learners.map((l) => l.id))})`, ...r.learners.map((l) => l.id)).map((x) => [x.person_id, x]) : []);
      const learners = r.learners.map((l) => ({ ...l, literacy: recs[l.id] || null }));
      const dist = [1, 2, 3, 4, 5].map((lv) => learners.filter((l) => (l.literacy?.level || 1) === lv).length);
      return { programme: { id: p.id, title: p.title, title_ml: p.title_ml, hamlet: brain.hamlets.get(p.hamlet_id)?.name, schedule: p.schedule }, learners, hidden: r.hidden, distribution: dist };
    }));
  });
  router.post('/literacy/assess', requires('teach', 'assess'), (req, res) => {
    const b = req.body;
    const p = assertProgramme(req.user, b.programme_id);
    if (p.track !== 'literacy') throw httpError(400, 'Not a literacy circle');
    if (!brain.enrolments.forProgramme(p.id).some((e) => e.person_id === b.person_id && e.status === 'active')) throw httpError(403, 'Learner is not in this circle.');
    if (!canProgress(req.user, b.person_id)) throw httpError(403, 'No active consent for this learner.');
    const level = Math.max(1, Math.min(5, Number(b.level) || 1));
    const per = brain.persons.raw(b.person_id);
    const prev = data.find('learning_literacy', { person_id: b.person_id })[0];
    const row = data.put('learning_literacy', { ...(prev ? { id: prev.id } : {}), person_id: b.person_id, hamlet_id: per.hamlet_id, agency_id: p.agency_id, programme_id: p.id, level, skills: Array.isArray(b.skills) ? b.skills.slice(0, 30) : (prev ? prev.skills : []), notes: String(b.notes || '').slice(0, 1000), assessed_by: req.user.id, last_assessed: new Date().toISOString() }, req.user);
    const awarded = [];
    if (!prev || level > prev.level) {
      emit('learning.literacy_level_up', { person_id: b.person_id, from: prev ? prev.level : 0, to: level }, req.user, per.hamlet_id);
      for (let k = 1; k < level && k <= 4; k++) { const lv = C.levels.find((x) => x.level === k); const e = brain.passport.award({ person_id: b.person_id, type: 'competency', ref: lv.competency, title: `Adult literacy: ${lv.title}`, level: k, evidence: { module: 'learning', assessed_by: req.user.display_name }, agency_id: p.agency_id }, req.user); awarded.push({ code: lv.competency, entry_id: e.id }); }
    }
    res.json({ ...row, awarded });
  });

  // ---- holiday / vacation camps ----
  router.get('/camps', requires('teach', 'hamlet.coordinate', 'agency.manage'), (req, res) => {
    const rows = isSteward(req.user) ? data.find('learning_camps', {}, { order: 'start_date DESC', limit: 50 }) : data.find('learning_camps', { agency_id: req.user.agency_id || '-' }, { order: 'start_date DESC', limit: 50 });
    res.json(rows.map((c) => ({ ...c, hamlet: brain.hamlets.get(c.hamlet_id)?.name, sessions: sqlOne('SELECT COUNT(*) n FROM learning_sessions WHERE camp_id=? AND deleted=0', c.id).n })));
  });
  router.post('/camps', requires('teach', 'hamlet.coordinate'), (req, res) => {
    const b = req.body;
    let p = null;
    if (b.programme_id) p = assertProgramme(req.user, b.programme_id);
    const hamlet_id = p ? p.hamlet_id : b.hamlet_id;
    if (!hamlet_id || !brain.hamlets.get(hamlet_id)) throw httpError(400, 'programme_id or hamlet_id required');
    if (!isSteward(req.user) && Array.isArray(req.user.hamlet_ids) && req.user.hamlet_ids.length && !req.user.hamlet_ids.includes(hamlet_id)) throw httpError(403, 'Not your hamlet.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start_date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b.end_date || '') || b.end_date < b.start_date) throw httpError(400, 'start_date and end_date (YYYY-MM-DD) required');
    const days = Math.round((new Date(b.end_date) - new Date(b.start_date)) / 86400e3) + 1;
    if (days > 45) throw httpError(400, 'Camps can be at most 45 days.');
    const agency_id = p ? p.agency_id : req.user.agency_id;
    const out = tx(() => {
      const camp = data.put('learning_camps', { agency_id, hamlet_id, programme_id: p ? p.id : null, title: String(b.title || 'Vacation learning camp').slice(0, 200), title_ml: b.title_ml || null, kind: ['vacation', 'holiday', 'exam_prep', 'bridge'].includes(b.kind) ? b.kind : 'vacation', start_date: b.start_date, end_date: b.end_date, daily_slots: Array.isArray(b.daily_slots) && b.daily_slots.length ? b.daily_slots : ['10:00'], focus: b.focus || '', capacity: Number(b.capacity) || 30, status: 'planned', created_by: req.user.id }, req.user);
      let n = 0;
      if (p && b.create_sessions !== false) for (let i = 0; i < days; i++) { const d = dayShift(i, new Date(b.start_date + 'T12:00:00Z')); for (const slot of camp.daily_slots) { data.put('learning_sessions', { programme_id: p.id, agency_id, hamlet_id, track: p.track, date: d, start_time: slot, kind: 'camp', topic: `${camp.title} — day ${i + 1}`, lesson_ids: [], notes: '', status: 'scheduled', facilitator_id: req.user.id, present_count: 0, roster_count: 0, camp_id: camp.id }, req.user); n++; } }
      return { camp, sessions: n };
    });
    emit('learning.camp_scheduled', { camp_id: out.camp.id, hamlet_id, start_date: b.start_date, end_date: b.end_date }, req.user, hamlet_id);
    res.json({ ...out.camp, sessions: out.sessions });
  });

  // ---- programme-level overview (agency / platform) ----
  router.get('/overview', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const progs = staffProgrammes(req.user);
    const since = dayShift(-30);
    const ag = Object.fromEntries(brain.agencies.list().map((a) => [a.id, a]));
    const rows = progs.map((p) => {
      const pids = brain.enrolments.forProgramme(p.id).filter((e) => e.status === 'active').map((e) => e.person_id);
      const ses = sqlOne("SELECT COUNT(*) n, SUM(present_count) pr, SUM(roster_count) r FROM learning_sessions WHERE deleted=0 AND status='held' AND programme_id=? AND date>=?", p.id, since);
      const lessons = pids.length ? sqlOne(`SELECT COUNT(*) n FROM learning_progress WHERE deleted=0 AND completed_at>=? AND person_id IN (${inList(pids)})`, since, ...pids).n : 0;
      const sc = pids.length ? sqlOne(`SELECT AVG(score) s FROM learning_attempts WHERE deleted=0 AND at>=? AND person_id IN (${inList(pids)})`, since, ...pids).s : null;
      const att = attendanceStats(pids, p.agency_id);
      const fl = openFlags(pids, p.agency_id);
      const risk = pids.filter((id) => riskFor(att[id], null, fl[id]).length).length;
      return { id: p.id, title: p.title, track: p.track, agency: ag[p.agency_id]?.name, agency_colour: ag[p.agency_id]?.colour, hamlet: brain.hamlets.get(p.hamlet_id)?.name, enrolled: pids.length, sessions_30d: ses.n || 0, attendance: ses.r ? ses.pr / ses.r : null, lessons_30d: lessons, avg_score: sc, at_risk: risk };
    });
    const allPids = [...new Set(progs.flatMap((p) => brain.enrolments.forProgramme(p.id).filter((e) => e.status === 'active').map((e) => e.person_id)))];
    const weekly = [];
    for (let w = 11; w >= 0; w--) {
      const from = dayShift(-7 * (w + 1)), to = dayShift(-7 * w);
      weekly.push({ week: from, lessons: allPids.length ? sqlOne(`SELECT COUNT(*) n FROM learning_progress WHERE deleted=0 AND completed_at>=? AND completed_at<? AND person_id IN (${inList(allPids)})`, from, to, ...allPids).n : 0 });
    }
    // Impact: average grade-gap at first placement vs latest re-check (learners with 2+ checks)
    const diags = allPids.length ? sql(`SELECT person_id, results, at, cohort FROM learning_diagnostics WHERE deleted=0 AND person_id IN (${inList(allPids)}) ORDER BY at`, ...allPids) : [];
    const byP = {}; for (const d of diags) (byP[d.person_id] = byP[d.person_id] || []).push(d);
    const gap = (d) => { const v = Object.values(d.results || {}).filter((r) => r && typeof r.gap === 'number'); return v.length ? v.reduce((a, r) => a + r.gap, 0) / v.length : 0; };
    const pairs = Object.values(byP).filter((l) => l.length >= 2);
    const subjGap = {};
    for (const s of SCHOOL_SUBJECTS) { const first = [], last = []; for (const l of pairs) { const a = l[0].results?.[s], b = l[l.length - 1].results?.[s]; if (a && b) { first.push(a.gap); last.push(b.gap); } } if (first.length) subjGap[s] = { first: first.reduce((x, y) => x + y, 0) / first.length, latest: last.reduce((x, y) => x + y, 0) / last.length, n: first.length }; }
    const cohorts = {}; for (const l of Object.values(byP)) { const c = l[l.length - 1].cohort; cohorts[c] = (cohorts[c] || 0) + 1; }
    const litRecs = allPids.length ? sql(`SELECT level, COUNT(*) n FROM learning_literacy WHERE deleted=0 AND person_id IN (${inList(allPids)}) GROUP BY level`, ...allPids) : [];
    const sup = (n) => brain.policy.suppress(n, req.user);
    res.json({
      programmes: rows, weekly, cohorts: Object.fromEntries(Object.entries(cohorts).map(([k, v]) => [k, sup(v)])),
      impact: { learners_rechecked: sup(pairs.length), gap_first: pairs.length ? pairs.reduce((a, l) => a + gap(l[0]), 0) / pairs.length : null, gap_latest: pairs.length ? pairs.reduce((a, l) => a + gap(l[l.length - 1]), 0) / pairs.length : null, by_subject: subjGap },
      literacy_levels: Object.fromEntries(litRecs.map((r) => [r.level, sup(r.n)])),
      totals: { programmes: rows.length, enrolled: sup(allPids.length), sessions_30d: rows.reduce((a, r) => a + r.sessions_30d, 0), lessons_30d: rows.reduce((a, r) => a + r.lessons_30d, 0), at_risk: rows.reduce((a, r) => a + r.at_risk, 0) },
      subjects: SUBJECTS,
    });
  });

  // ---- events ----
  on('core.enrolled', (ev) => {
    const pl = ev.payload || {};
    if (pl.module !== 'learning' || pl.track !== 'literacy') return;
    if (data.find('learning_literacy', { person_id: pl.person_id })[0]) return;
    const per = brain.persons.raw(pl.person_id);
    if (!per) return;
    const start = { none: 1, basic: 2, functional: 3 }[per.literacy_level] || 1;
    data.put('learning_literacy', { person_id: per.id, hamlet_id: per.hamlet_id, agency_id: pl.agency_id, programme_id: pl.programme_id, level: start, skills: [], notes: 'Starting level from registration', assessed_by: null, last_assessed: null }, null);
  });

  // =================================================================== seed
  function seed(demo) {
    const { R, daysAgo } = demo;
    const dstr = (n) => daysAgo(n).slice(0, 10);
    const at = (n, h = 17) => { const d = new Date(Date.now() - n * 86400e3); d.setUTCHours(h - 5, R.int(0, 59), 0, 0); return d.toISOString(); };
    ensureCompetencies();
    const U = demo.users;
    const markers = {};
    const markerFor = (p) => {
      const k = p.agency_id + p.hamlet_id;
      if (markers[k] !== undefined) return markers[k];
      const cands = Object.values(U).filter((u) => u && ['facilitator', 'teacher'].includes(u.role) && u.agency_id === p.agency_id);
      const exact = cands.find((u) => Array.isArray(u.hamlet_ids) && u.hamlet_ids.includes(p.hamlet_id)) || cands.find((u) => !u.hamlet_ids || !u.hamlet_ids.length);
      return (markers[k] = exact ? exact : null);
    };
    const progs = demo.programmes.filter((p) => p.module === 'learning');
    const dl = demo.demoLearner;
    const profile = {};
    const prof = (pid) => {
      if (profile[pid]) return profile[pid];
      if (dl && pid === dl.id) return (profile[pid] = 'star');
      const r = R.rnd();
      return (profile[pid] = r < 0.55 ? 'steady' : r < 0.78 ? 'mixed' : r < 0.9 ? 'drifting' : 'irregular');
    };
    const pPresent = (pr, daysBack) => ({ star: 0.94, steady: 0.88, mixed: 0.72, irregular: 0.42, drifting: daysBack > 30 ? 0.84 : 0.3 })[pr];
    const scoreBase = { star: 0.82, steady: 0.78, mixed: 0.64, irregular: 0.42, drifting: 0.58 };

    let nRows = 0;
    tx(() => {
      // ---- weekly hamlet goals
      for (const h of demo.hamlets) { data.put('learning_goals', { hamlet_id: h.id, title: 'Lessons completed by our hamlet this week', title_ml: 'ഈ ആഴ്ച നമ്മുടെ ഊര് പൂർത്തിയാക്കുന്ന പാഠങ്ങൾ', metric: 'lessons_week', target: R.pick([12, 15, 18, 20]), period_start: weekStart(), period_end: dayShift(6, new Date(weekStart() + 'T12:00:00Z')) }, null); nRows++; }

      // ---- sessions + attendance: ~2 per week per programme for the last 12 weeks
      const weekday = (n) => { const d = new Date(Date.now() - n * 86400e3); return d.getUTCDay(); };
      for (const p of progs) {
        const roster = demo.enrolledIn(p.id);
        const fac = markerFor(p);
        const band = /1–4/.test(p.title) ? [1, 4] : p.track === 'literacy' ? null : [5, 10];
        const pool = band ? C.lessons.filter((l) => l.class && l.class >= band[0] && l.class <= band[1]) : C.lessons.filter((l) => l.track === 'literacy');
        const slotTime = (Array.isArray(p.schedule) && p.schedule[0] ? p.schedule[0].split(' ')[1] : '16:00') || '16:00';
        for (let w = 11; w >= 0; w--) {
          for (const off of [R.int(1, 3), R.int(4, 6)]) {
            const n = w * 7 + off;
            if (n < 1) continue;
            if (weekday(n) === 0 && R.chance(0.5)) continue; // fewer Sunday classes
            const lesson = R.pick(pool);
            const sess = data.put('learning_sessions', { programme_id: p.id, agency_id: p.agency_id, hamlet_id: p.hamlet_id, track: p.track, date: dstr(n), start_time: slotTime, kind: 'class', topic: lesson.title, lesson_ids: [lesson.id], notes: R.chance(0.35) ? R.pick(['Good energy today; group reading went well.', 'Rain — some children came late.', 'Used seeds and sticks for counting. Children enjoyed it.', 'Two learners helped younger ones with letters.', 'Power cut; used the solar lamp. Shortened the session.', 'Elder visited and told a folk story — used it for reading.', 'Revision of last week\'s lesson; quiz on the tablet.']) : '', status: 'held', facilitator_id: fac ? fac.id : null, present_count: 0, roster_count: 0, camp_id: null }, fac);
            let present = 0;
            for (const per of roster) {
              const ok = R.chance(pPresent(prof(per.id), n));
              const st = ok ? (R.chance(0.08) ? 'late' : 'present') : (R.chance(0.15) ? 'excused' : 'absent');
              if (ok) present++;
              data.put('learning_attendance', { session_id: sess.id, programme_id: p.id, agency_id: p.agency_id, person_id: per.id, hamlet_id: per.hamlet_id, date: sess.date, status: st, marked_by: fac ? fac.id : null }, fac);
              nRows++;
            }
            data.put('learning_sessions', { ...sess, present_count: present, roster_count: roster.length }, fac);
            nRows += 2;
          }
        }
        // today's (and the next) scheduled session
        const lessonT = R.pick(pool);
        if (['h1', 'h2', 'h9'].some((k) => demo.hamletByKey[k].id === p.hamlet_id) || R.chance(0.5)) {
          data.put('learning_sessions', { programme_id: p.id, agency_id: p.agency_id, hamlet_id: p.hamlet_id, track: p.track, date: today(), start_time: slotTime, kind: 'class', topic: lessonT.title, lesson_ids: [lessonT.id], notes: '', status: 'scheduled', facilitator_id: fac ? fac.id : null, present_count: 0, roster_count: 0, camp_id: null }, fac);
        }
        data.put('learning_sessions', { programme_id: p.id, agency_id: p.agency_id, hamlet_id: p.hamlet_id, track: p.track, date: dayShift(R.int(2, 4)), start_time: slotTime, kind: 'class', topic: R.pick(pool).title, lesson_ids: [], notes: '', status: 'scheduled', facilitator_id: fac ? fac.id : null, present_count: 0, roster_count: 0, camp_id: null }, fac);
      }

      // ---- tuition learners: diagnostics, lessons, quiz attempts
      const tuitionPids = new Set();
      for (const p of progs.filter((x) => x.track === 'tuition')) for (const per of demo.enrolledIn(p.id)) tuitionPids.add(per.id);
      const answersFor = (lesson, score) => lesson.questions.map((q) => (R.chance(score) ? q.a : (q.a + 1) % q.o.length));
      const simAttempt = (per, lesson, base, daysBack) => {
        const tries = R.chance(0.35) ? 2 : 1;
        let best = 0, first = null, last = null, attempts = 0, completedAt = null;
        for (let t = 0; t < tries; t++) {
          const n = Math.max(1, daysBack - t * R.int(1, 3));
          const s = Math.min(1, Math.max(0, base + (R.rnd() - 0.45) * 0.4 + t * 0.12));
          const ans = answersFor(lesson, s);
          const correct = ans.filter((a, i) => a === lesson.questions[i].a).length;
          const score = Math.round((correct / lesson.questions.length) * 100) / 100;
          const when = at(n);
          data.put('learning_attempts', { person_id: per.id, hamlet_id: per.hamlet_id, lesson_id: lesson.id, subject: lesson.subject, kind: 'practice', score, correct, total: lesson.questions.length, answers: ans, at: when }, null);
          nRows++; attempts++;
          if (!first) first = when; last = when;
          if (score > best) best = score;
          if (!completedAt && score >= PASS) completedAt = when;
        }
        const status = best >= MASTERY ? 'mastered' : best >= PASS ? 'completed' : 'in_progress';
        data.put('learning_progress', { person_id: per.id, hamlet_id: per.hamlet_id, lesson_id: lesson.id, subject: lesson.subject, class_level: lesson.class || lesson.level, status, best_score: best, attempts, first_at: first, last_at: last, completed_at: status === 'in_progress' ? null : completedAt }, null);
        nRows++;
        return status;
      };
      const simDiagnostic = (per, grade, gaps, daysBack) => {
        const results = {};
        for (const s of SCHOOL_SUBJECTS) {
          if (s === 'social' && grade < 3) continue;
          const placement = Math.max(0, grade - (gaps[s] || 0));
          const total = Math.min(5, C.lessons.filter((l) => l.subject === s && l.class && l.class <= Math.max(2, grade)).length);
          const missed = C.lessons.filter((l) => l.subject === s && l.class && l.class > placement && l.class <= grade).slice(0, 2).map((l) => l.id);
          results[s] = { placement, grade, gap: grade - placement, correct: Math.max(0, total - Math.min(total, gaps[s] || 0)), total, missed };
        }
        const pathIds = buildPath(grade, results);
        const cohort = cohortFor(grade, results, per);
        data.put('learning_diagnostics', { person_id: per.id, hamlet_id: per.hamlet_id, grade, results, path: pathIds, cohort, at: at(daysBack, 11) }, null);
        nRows++;
        return { results, pathIds, cohort };
      };
      for (const pid of tuitionPids) {
        if (dl && pid === dl.id) continue;
        const per = brain.persons.raw(pid);
        const grade = parseGrade(per);
        if (!grade) continue;
        const pr = prof(pid);
        const g = () => ({ steady: R.int(0, 1), mixed: R.int(1, 2), drifting: R.int(1, 3), irregular: R.int(2, 4) })[pr];
        const gaps = Object.fromEntries(SCHOOL_SUBJECTS.map((s) => [s, Math.min(grade, g())]));
        const start = R.int(90, 175);
        const d1 = simDiagnostic(per, grade, gaps, start);
        const nLessons = ({ steady: R.int(6, 11), mixed: R.int(4, 7), drifting: R.int(3, 6), irregular: R.int(1, 3) })[pr];
        const lastDay = pr === 'drifting' ? 32 : 1;
        const ids = d1.pathIds.slice(0, nLessons);
        ids.forEach((id, i) => simAttempt(per, C.byId.get(id), scoreBase[pr] + i * 0.01, Math.round(start - ((start - lastDay) * (i + 1)) / (ids.length + 1))));
        if (['steady', 'mixed'].includes(pr) && R.chance(0.6)) {
          const better = Object.fromEntries(Object.entries(gaps).map(([s, v]) => [s, Math.max(0, v - (R.chance(0.6) ? 1 : 0))]));
          simDiagnostic(per, grade, better, R.int(10, 40));
        }
      }

      // ---- literacy circles: adults' levels + lessons below their level
      for (const p of progs.filter((x) => x.track === 'literacy')) {
        const fac = markerFor(p);
        for (const per of demo.enrolledIn(p.id)) {
          const pr = prof(per.id);
          const base = { none: 1, basic: 2, functional: 3 }[per.literacy_level] || 1;
          const level = Math.min(5, base + ({ steady: R.int(0, 2), mixed: R.int(0, 1), drifting: 0, irregular: 0, star: 2 })[pr]);
          const skills = ['writes_name', 'reads_vowels', 'reads_consonants', 'reads_money', 'reads_bus_board', 'reads_medicine_label', 'reads_notice', 'fills_form'].slice(0, level * 2);
          const prev = data.find('learning_literacy', { person_id: per.id })[0];
          data.put('learning_literacy', { ...(prev ? { id: prev.id } : {}), person_id: per.id, hamlet_id: per.hamlet_id, agency_id: p.agency_id, programme_id: p.id, level, skills, notes: R.pick(['Confident with letters; practise at home with grandchildren.', 'Signs her name in the register now.', 'Reads bus boards; slow with conjunct letters.', 'Needs reading glasses — referred to eye camp.', 'Very motivated; wants to read MGNREGA job card.', '']), assessed_by: fac ? fac.id : null, last_assessed: at(R.int(3, 30), 12) }, fac);
          nRows++;
          for (const l of C.lessons.filter((x) => x.track === 'literacy' && x.level < level)) simAttempt(per, l, 0.78, R.int(20, 150));
        }
      }

      // ---- homework (3 per tuition programme) with submissions & feedback
      const HW = [
        ['Read the lesson aloud to someone at home', 'പാഠം വീട്ടിലാരെയെങ്കിലും ഉറക്കെ വായിച്ചു കേൾപ്പിക്കുക'],
        ['Write 5 sentences about your hamlet', 'നിങ്ങളുടെ ഊരിനെക്കുറിച്ച് 5 വാക്യങ്ങൾ എഴുതുക'],
        ['Solve the 10 practice sums in your notebook', 'നോട്ട്ബുക്കിലെ 10 കണക്കുകൾ ചെയ്യുക'],
        ['Collect 5 leaves and write their names', '5 ഇലകൾ ശേഖരിച്ച് പേരെഴുതുക'],
        ['Ask an elder a story and write 4 lines', 'മുതിർന്നവരോട് ഒരു കഥ ചോദിച്ച് 4 വരി എഴുതുക'],
        ['Make a table of prices at the ration shop', 'റേഷൻ കടയിലെ വിലകളുടെ പട്ടിക തയ്യാറാക്കുക'],
      ];
      const FB = ['Very good! Neat handwriting. ⭐', 'Good effort. Check the spelling of conjunct letters.', 'Well done — you explained the steps clearly.', 'Nice! Next time write one more example.', 'Super. Read it aloud in class tomorrow.', 'Correct method; one calculation slip in Q4.'];
      for (const p of progs.filter((x) => x.track === 'tuition')) {
        const fac = markerFor(p);
        const roster = demo.enrolledIn(p.id);
        const band = /1–4/.test(p.title) ? [1, 4] : [5, 10];
        for (const ago of [35, 18, 4]) {
          const [t, tm] = R.pick(HW);
          const lesson = R.pick(C.lessons.filter((l) => l.class && l.class >= band[0] && l.class <= band[1]));
          const hw = data.put('learning_homework', { programme_id: p.id, agency_id: p.agency_id, hamlet_id: p.hamlet_id, title: t, title_ml: tm, instructions: `Linked to "${lesson.title}". Bring your notebook to the next class.`, lesson_id: lesson.id, due_date: dstr(ago - 5), assigned_by: fac ? fac.id : null, assigned_at: at(ago, 16) }, fac);
          nRows++;
          for (const per of roster) {
            if (dl && per.id === dl.id) continue;
            const pr = prof(per.id);
            if (!R.chance({ steady: 0.8, mixed: 0.55, drifting: ago > 20 ? 0.6 : 0.15, irregular: 0.25 }[pr])) continue;
            const subAgo = Math.max(0, ago - R.int(1, 4));
            const reviewed = subAgo > 3 && R.chance(0.8);
            data.put('learning_submissions', { homework_id: hw.id, programme_id: p.id, person_id: per.id, hamlet_id: per.hamlet_id, agency_id: p.agency_id, kind: R.chance(0.7) ? 'text' : R.pick(['photo', 'voice']), text: R.pick(['Done in notebook. Page 12.', 'എന്റെ ഊര് പുഴയുടെ അടുത്താണ്. ഞങ്ങൾക്ക് ഒരു പഠനകേന്ദ്രമുണ്ട്.', 'I read it to my grandmother. She liked the story.', 'All sums done. Q7 was difficult.', 'ഇലകൾ: പ്ലാവ്, മാവ്, തേക്ക്, മുള, വാഴ.']), media_note: '', thumb: null, submitted_at: at(subAgo, 19), feedback: reviewed ? R.pick(FB) : null, feedback_kind: reviewed ? (R.chance(0.2) ? 'voice' : 'text') : null, feedback_by: reviewed && fac ? fac.id : null, feedback_at: reviewed ? at(Math.max(0, subAgo - 1), 20) : null, grade: reviewed ? R.int(3, 5) : null }, null);
            nRows++;
          }
        }
      }

      // ---- camps
      const cif = demo.agencyByKey.cif, vjt = demo.agencyByKey.vjt, std = demo.agencyByKey.std;
      const campsDef = [
        [cif, 'h1', 'Onam Vacation Reading Camp', 'ഓണാവധി വായനക്കളരി', 'vacation', -62, -55, 'completed', 'Malayalam reading, folk stories, maths games'],
        [cif, 'h1', 'Christmas Catch-up Camp', 'ക്രിസ്മസ് പഠന ക്യാമ്പ്', 'holiday', 54, 61, 'planned', 'Catch-up for Class 5–8 special-attention cohort'],
        [cif, 'h2', 'Christmas Catch-up Camp', 'ക്രിസ്മസ് പഠന ക്യാമ്പ്', 'holiday', 54, 59, 'planned', 'Maths & English bridge'],
        [vjt, 'h3', 'SSLC Exam Prep Camp', 'SSLC പരീക്ഷാ ക്യാമ്പ്', 'exam_prep', 95, 104, 'planned', 'SSLC maths, science revision'],
        [std, 'h10', 'Summer Bridge Camp', 'വേനൽ പാലം ക്യാമ്പ്', 'bridge', -150, -140, 'completed', 'Mother-tongue to Malayalam bridge for Class 1–2'],
      ];
      for (const [a, hk, title, title_ml, kind, s, e, status, focus] of campsDef) {
        const h = demo.hamletByKey[hk];
        const prog = progs.find((p) => p.agency_id === a.id && p.hamlet_id === h.id && p.track === 'tuition');
        data.put('learning_camps', { agency_id: a.id, hamlet_id: h.id, programme_id: prog ? prog.id : null, title, title_ml, kind, start_date: dayShift(s), end_date: dayShift(e), daily_slots: ['10:00', '14:00'], focus, capacity: 30, status, created_by: null }, null);
        nRows++;
      }

      // ---- demo learner: a rich, convincing journey
      if (dl) {
        const per = brain.persons.raw(dl.id);
        const grade = parseGrade(per) || 8;
        simDiagnostic(per, grade, { malayalam: 1, english: 3, math: 2, evs: 1, social: 1 }, 160);
        const plan = buildPath(grade, data.find('learning_diagnostics', { person_id: dl.id })[0].results);
        const journey = [...new Set([...plan, 'eng-3-1', 'eng-5-1', 'math-6-1', 'math-6-2', 'math-7-1', 'eng-6-1', 'sci-7-1', 'mal-6-1', 'soc-7-1', 'math-7-2', 'sci-8-1', 'eng-8-1'])].filter((id) => C.byId.has(id));
        const studied = journey.slice(0, 14);
        studied.forEach((id, i) => {
          const daysBack = Math.round(150 - (i * 140) / studied.length);
          simAttempt(per, C.byId.get(id), Math.min(0.97, 0.66 + i * 0.022), daysBack);
        });
        // recent daily practice → 6-day streak (not today, so today's goals are live)
        const recent = ['math-8-1', 'eng-8-1', 'sci-8-1', 'mal-8-1', 'soc-8-1', 'math-7-2'];
        recent.forEach((id, i) => { if (C.byId.has(id)) simAttempt(per, C.byId.get(id), 0.8 + (i % 2) * 0.1, 6 - i); });
        // left one lesson half-way → "continue" card
        const l = C.byId.get('math-8-1');
        const cur = data.find('learning_progress', { person_id: dl.id, lesson_id: l.id })[0];
        if (cur) data.put('learning_progress', { ...cur, status: 'in_progress', best_score: 0.5, completed_at: null }, null);
        simDiagnostic(per, grade, { malayalam: 0, english: 1, math: 1, evs: 0, social: 0 }, 28);
        // homework journey
        for (const p of progs.filter((x) => x.track === 'tuition' && demo.enrolledIn(x.id).some((y) => y.id === dl.id))) {
          const hws = data.find('learning_homework', { programme_id: p.id }, { order: 'assigned_at' });
          hws.slice(0, 2).forEach((hw, i) => {
            data.put('learning_submissions', { homework_id: hw.id, programme_id: p.id, person_id: dl.id, hamlet_id: per.hamlet_id, agency_id: p.agency_id, kind: i === 0 ? 'photo' : 'text', text: i === 0 ? 'Photo of my notebook — all sums done.' : 'എന്റെ ഊര് പച്ചക്കുടി മലയുടെ താഴെയാണ്. ഞങ്ങളുടെ പഠനകേന്ദ്രത്തിൽ സോളാർ വിളക്കുണ്ട്. ഞാൻ എല്ലാ ദിവസവും ഇവിടെ പഠിക്കുന്നു. എനിക്ക് നഴ്സാകണം.', media_note: i === 0 ? 'Notebook page 14' : '', thumb: i === 0 ? 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==' : null, submitted_at: at(30 - i * 14, 19), feedback: i === 0 ? 'Excellent work, Anjali — every step is shown. ⭐⭐⭐' : 'Beautiful sentences! Read this aloud in class on Friday.', feedback_kind: 'text', feedback_by: markerFor(p) ? markerFor(p).id : null, feedback_at: at(28 - i * 14, 20), grade: 5 }, null);
            nRows++;
          });
        }
      }

      // ---- at-risk flags from the seeded attendance pattern
      for (const p of progs) {
        const pids = demo.enrolledIn(p.id).map((x) => x.id);
        const att = attendanceStats(pids, p.agency_id);
        for (const pid of pids) {
          const a = att[pid];
          if (a && a.total >= 4 && a.rate < ATT_RISK && R.chance(0.7)) {
            const per = brain.persons.raw(pid);
            data.put('learning_flags', { person_id: pid, hamlet_id: per.hamlet_id, agency_id: p.agency_id, programme_id: p.id, reason: prof(pid) === 'drifting' ? 'dropout_risk' : 'low_attendance', note: `Attendance ${pct(a.present, a.total)}% in last 30 days${prof(pid) === 'drifting' ? ' — was regular until last month; home visit suggested.' : ''}`, status: 'open', raised_by: 'auto', at: at(R.int(1, 10), 18) }, null);
            nRows++;
          }
        }
      }
    });

    // passport awards (outside the big tx: brain.award does its own lookups)
    tx(() => {
      const learners = sql('SELECT DISTINCT person_id FROM learning_progress WHERE deleted=0 AND status=\'mastered\'').map((r) => r.person_id);
      for (const pid of learners) checkCompetencyAwards(pid, null, awardingAgency(pid, 'tuition'));
      for (const r of data.find('learning_literacy', {})) for (let k = 1; k < r.level && k <= 4; k++) { const lv = C.levels.find((x) => x.level === k); brain.passport.award({ person_id: r.person_id, type: 'competency', ref: lv.competency, title: `Adult literacy: ${lv.title}`, level: k, evidence: { module: 'learning' }, agency_id: r.agency_id }, null); }
    });
    log(`seeded ~${nRows} rows`);
  }

  function health() {
    const n = (t, w = '') => sqlOne(`SELECT COUNT(*) n FROM ${t} WHERE deleted=0 ${w}`).n;
    return {
      lessons: C.lessons.length, questions: C.qById.size, bridge_lessons: C.lessons.filter((l) => l.bridge).length,
      sessions: n('learning_sessions'), attendance: n('learning_attendance'), attempts: n('learning_attempts'), lessons_completed: n('learning_progress', "AND status!='in_progress'"),
      diagnostics: n('learning_diagnostics'), homework: n('learning_homework'), submissions: n('learning_submissions'), open_flags: n('learning_flags', "AND status='open'"), literacy_learners: n('learning_literacy'), camps: n('learning_camps'),
    };
  }

  return { seed, health };
};
