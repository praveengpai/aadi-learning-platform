'use strict';
// My Learning Shelf — gathers everything a learner has completed across modules into
// year folders → subjects → items, and drives a few spaced-revision items every day.
// Every read of another module's table is wrapped so the shelf keeps working when a
// module (or its table) is missing.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DAY = 86400e3;
const LOW = 70; // % below which an item comes back sooner
const BASE = { lesson: 3, quiz: 3, homework: 7, mock: 7, language: 7, lifeskill: 14, book: 30 }; // first revisit after completion
const LOW_BASE = 1;
const MAX_INTERVAL = 120;

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(String(d).slice(0, 10) + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / DAY);
const hashNum = (s) => parseInt(crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 8), 16);
const round = (x) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x));
const monthStart = () => new Date().toISOString().slice(0, 7) + '-01';

// Kerala academic year runs June → May.
function acadYear(iso) {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 5 ? y : y - 1;
}
function classNum(p) {
  if (!p || !p.school_class) return null;
  const s = String(p.school_class);
  if (/drop|sslc|plus|degree/i.test(s)) return null;
  const m = s.match(/^\s*(?:class\s*)?(\d{1,2})\s*$/i);
  return m ? Number(m[1]) : null;
}

// ---------- static content from sibling modules (titles) — all optional ----------
function tryLoad(fn, fallback) { try { return fn(); } catch (_) { return fallback; } }
const MOD = path.join(__dirname, '..');
const LESSONS = tryLoad(() => {
  const m = new Map();
  const dir = path.join(MOD, 'learning', 'content');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const pack = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const l of pack.lessons || []) m.set(l.id, { title: l.title, title_ml: l.title_ml, subject: pack.subject, class: l.class || null, icon: l.icon });
  }
  return m;
}, new Map());
const LANG = tryLoad(() => {
  const { COURSES } = require(path.join(MOD, 'language', 'content', 'courses'));
  const courses = new Map(); const acts = new Map();
  for (const c of COURSES) {
    courses.set(c.id, { title: c.title, title_ml: c.title_ml, icon: c.icon });
    for (const u of c.units || []) for (const a of u.activities || []) acts.set(`${c.id}:${u.id}/${a.id}`, { title: a.title, title_ml: a.title_ml, unit: u.title, unit_ml: u.title_ml });
  }
  return { courses, acts };
}, { courses: new Map(), acts: new Map() });
const LIFE = tryLoad(() => {
  const j = JSON.parse(fs.readFileSync(path.join(MOD, 'lifeskills', 'content', 'modules.json'), 'utf8'));
  return new Map((j.modules || []).map((m) => [m.id, { title: m.title, title_ml: m.title_ml, track: m.track, icon: m.icon }]));
}, new Map());
const EXAM_SUBJ = tryLoad(() => require(path.join(MOD, 'exams', 'lib')).SUBJECTS || {}, {});

const SUBJECTS = {
  malayalam: ['Malayalam', 'മലയാളം', 'അ'], english: ['English', 'ഇംഗ്ലീഷ്', '🔤'], math: ['Maths', 'ഗണിതം', '🔢'],
  evs: ['EVS / Science', 'പരിസരപഠനം / ശാസ്ത്രം', '🌿'], social: ['Social Science', 'സാമൂഹ്യശാസ്ത്രം', '🗺️'], literacy: ['Literacy', 'സാക്ഷരത', '✍️'],
  placement: ['Placement checks', 'നിലനിർണയം', '🧭'], homework: ['Homework', 'ഗൃഹപാഠം', '📝'], exams: ['Exam preparation', 'പരീക്ഷാ പരിശീലനം', '🎯'],
  lifeskills: ['Life skills', 'ജീവിത നൈപുണ്യം', '🧭'], digital: ['Digital & money skills', 'ഡിജിറ്റൽ, പണ സാക്ഷരത', '📱'], books: ['Books & reading', 'പുസ്തകങ്ങൾ, വായന', '📖'],
};
function subjectInfo(key) {
  if (SUBJECTS[key]) { const [en, ml, icon] = SUBJECTS[key]; return { key, label: en, label_ml: ml, icon }; }
  if (key.startsWith('exam:')) { const s = EXAM_SUBJ[key.slice(5)]; return { key, label: s ? s.label : key.slice(5), label_ml: s ? s.ml : key.slice(5), icon: s ? s.icon : '🎯' }; }
  if (key.startsWith('lang:')) { const c = LANG.courses.get(key.slice(5)); return { key, label: c ? c.title : key.slice(5), label_ml: c ? c.title_ml : key.slice(5), icon: c ? c.icon : '🗣️' }; }
  if (key.startsWith('book:')) { const s = key.slice(5); return { key, label: s, label_ml: s, icon: '📖' }; }
  return { key, label: key, label_ml: key, icon: '📁' };
}
const KIND_ORDER = ['lesson', 'quiz', 'homework', 'mock', 'language', 'lifeskill', 'book'];

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError, log } = ctx;

  const safe = (label, fn, fallback = []) => { try { return fn(); } catch (e) { if (!/may not read|no such table/i.test(e.message)) log(`source ${label} skipped:`, e.message); return fallback; } };

  // ---------- gather completed items from every module ----------
  function collect(pid) {
    const items = [];
    // learning: lessons (completed / mastered) and quizzes tried but not yet completed
    const prog = safe('learning_progress', () => sql('SELECT lesson_id, subject, status, best_score, attempts, last_at, completed_at FROM learning_progress WHERE person_id=? AND deleted=0', pid));
    for (const r of prog) {
      const l = LESSONS.get(r.lesson_id) || {};
      const done = r.status === 'completed' || r.status === 'mastered';
      const at = done ? (r.completed_at || r.last_at) : r.last_at;
      if (!at) continue;
      items.push({ kind: done ? 'lesson' : 'quiz', module: 'learning', ref: r.lesson_id, title: l.title || r.lesson_id, title_ml: l.title_ml || null, icon: l.icon || null, subject: r.subject || l.subject || 'general', completed_at: at, last_at: r.last_at, pct: round((r.best_score || 0) * 100), attempts: r.attempts || 1, status: r.status, link: `#/m/learning/lesson?id=${encodeURIComponent(r.lesson_id)}${done ? '' : '&quiz=1'}` });
    }
    // learning: placement checks
    for (const d of safe('learning_diagnostics', () => sql('SELECT id, grade, results, at FROM learning_diagnostics WHERE person_id=? AND deleted=0', pid))) {
      let pct = null;
      try { const vals = Object.values(d.results || {}).map((x) => (x && typeof x === 'object' ? (x.score ?? x.pct ?? null) : x)).filter((x) => typeof x === 'number'); if (vals.length) pct = round((vals.reduce((a, b) => a + b, 0) / vals.length) * (vals.every((x) => x <= 1) ? 100 : 1)); } catch (_) { /* shape unknown */ }
      items.push({ kind: 'quiz', module: 'learning', ref: 'diag:' + d.id, title: 'Placement check' + (d.grade ? ` (Class ${d.grade})` : ''), title_ml: 'നിലനിർണയം' + (d.grade ? ` (ക്ലാസ് ${d.grade})` : ''), icon: '🧭', subject: 'placement', completed_at: d.at, pct, link: '#/m/learning/progress', no_review: true });
    }
    // learning: homework submitted
    const subs = safe('learning_submissions', () => sql('SELECT id, homework_id, submitted_at, grade, feedback FROM learning_submissions WHERE person_id=? AND deleted=0', pid));
    if (subs.length) {
      const hw = new Map(safe('learning_homework', () => sql(`SELECT id, title, title_ml, lesson_id FROM learning_homework WHERE deleted=0 AND id IN (${subs.map(() => '?').join(',')})`, ...subs.map((s) => s.homework_id))).map((h) => [h.id, h]));
      for (const s of subs) {
        if (!s.submitted_at) continue;
        const h = hw.get(s.homework_id) || {};
        const l = h.lesson_id ? LESSONS.get(h.lesson_id) : null;
        const g = Number(s.grade);
        items.push({ kind: 'homework', module: 'learning', ref: s.homework_id, title: h.title || 'Homework', title_ml: h.title_ml || 'ഗൃഹപാഠം', icon: '📝', subject: (l && l.subject) || 'homework', completed_at: s.submitted_at, pct: Number.isFinite(g) && s.grade !== null ? (g <= 1 ? round(g * 100) : g <= 10 ? round(g * 10) : round(g)) : null, feedback: s.feedback || null, link: `#/m/learning/homework?id=${encodeURIComponent(s.homework_id)}` });
      }
    }
    // exams: submitted mocks / practice tests
    for (const a of safe('exams_attempts', () => sql("SELECT id, pattern, title, pct, subject, submitted_at FROM exams_attempts WHERE person_id=? AND deleted=0 AND status='submitted'", pid))) {
      if (!a.submitted_at) continue;
      items.push({ kind: 'mock', module: 'exams', ref: a.id, title: a.title || a.pattern || 'Mock test', title_ml: null, icon: '🎯', subject: a.subject && EXAM_SUBJ[a.subject] ? 'exam:' + a.subject : 'exams', completed_at: a.submitted_at, pct: round(a.pct), link: `#/m/exams/result?id=${encodeURIComponent(a.id)}` });
    }
    // language lab
    for (const r of safe('language_progress', () => sql('SELECT course_id, unit_id, activity_id, kind, score, completed_at FROM language_progress WHERE person_id=? AND deleted=0', pid))) {
      if (!r.completed_at) continue;
      const a = LANG.acts.get(`${r.course_id}:${r.unit_id}/${r.activity_id}`) || {};
      items.push({ kind: 'language', module: 'language', ref: `${r.course_id}:${r.unit_id}/${r.activity_id}`, title: a.title || `${r.unit_id} · ${r.activity_id}`, title_ml: a.title_ml || null, subtitle: a.unit || null, subtitle_ml: a.unit_ml || null, icon: '🗣️', subject: 'lang:' + r.course_id, completed_at: r.completed_at, pct: r.score === null || r.score === undefined ? null : round(r.score <= 1 ? r.score * 100 : r.score), link: `#/m/language/activity?course=${encodeURIComponent(r.course_id)}&unit=${encodeURIComponent(r.unit_id)}&id=${encodeURIComponent(r.activity_id)}` });
    }
    // life skills: modules passed
    for (const r of safe('lifeskills_progress', () => sql('SELECT module_key, quiz_score, quiz_total, passed, passed_at, last_at FROM lifeskills_progress WHERE person_id=? AND deleted=0', pid))) {
      if (Number(r.passed) !== 1) continue;
      const m = LIFE.get(r.module_key) || {};
      items.push({ kind: 'lifeskill', module: 'lifeskills', ref: r.module_key, title: m.title || r.module_key, title_ml: m.title_ml || null, icon: m.icon || '🧭', subject: m.track === 'digital' ? 'digital' : 'lifeskills', completed_at: r.passed_at || r.last_at, pct: r.quiz_total ? round((100 * r.quiz_score) / r.quiz_total) : null, link: `#/m/lifeskills/module?key=${encodeURIComponent(r.module_key)}&person=${encodeURIComponent(pid)}` });
    }
    // library: books finished (table may not exist yet)
    const assigned = new Map(safe('library_assignments', () => sql('SELECT item_id, assigned_by_name, due FROM library_assignments WHERE deleted=0 AND person_id=?', pid)).map((a) => [a.item_id, a]));
    for (const r of safe('library_reads', () => sql('SELECT item_id, title, section, cls, subject, finished, finished_at, last_opened_at, rating FROM library_reads WHERE person_id=? AND deleted=0', pid))) {
      if (!Number(r.finished)) continue;
      const a = assigned.get(r.item_id);
      items.push({ kind: 'book', module: 'library', ref: r.item_id, title: r.title || r.item_id, title_ml: null, icon: '📖', subject: r.subject && !/^all$/i.test(r.subject) ? 'book:' + r.subject : 'books', completed_at: r.finished_at || r.last_opened_at, pct: null, rating: r.rating ?? null, assigned_by: a ? a.assigned_by_name : null, link: `#/m/library/item?id=${encodeURIComponent(r.item_id)}` });
    }
    return items.filter((i) => i.completed_at).sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  }

  // ---------- organise ----------
  function organise(person, items) {
    const curAY = acadYear(new Date().toISOString());
    const cls = classNum(person);
    const years = new Map();
    for (const it of items) {
      const ay = acadYear(it.completed_at);
      if (!years.has(ay)) years.set(ay, new Map());
      const subj = years.get(ay);
      if (!subj.has(it.subject)) subj.set(it.subject, []);
      subj.get(it.subject).push(it);
    }
    return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([ay, subj]) => {
      const yl = `${ay}–${String(ay + 1).slice(2)}`;
      const c = cls !== null ? cls - (curAY - ay) : null;
      const all = [...subj.values()].flat();
      const scored = all.filter((i) => typeof i.pct === 'number');
      return {
        year: ay, current: ay === curAY, class: c !== null && c >= 1 ? c : null,
        label: c !== null && c >= 1 ? `${yl} · Class ${c}` : yl, label_ml: c !== null && c >= 1 ? `${yl} · ക്ലാസ് ${c}` : yl,
        summary: { items: all.length, lessons: all.filter((i) => i.kind === 'lesson').length, tests: all.filter((i) => ['quiz', 'mock'].includes(i.kind)).length, books: all.filter((i) => i.kind === 'book').length, avg_pct: scored.length ? round(scored.reduce((s, i) => s + i.pct, 0) / scored.length) : null },
        subjects: [...subj.entries()].map(([k, list]) => ({ ...subjectInfo(k), count: list.length, items: list.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || String(b.completed_at).localeCompare(String(a.completed_at))) })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      };
    });
  }

  // ---------- revision ----------
  const reviewRows = (pid) => new Map(data.find('shelf_reviews', { person_id: pid }).map((r) => [`${r.kind}|${r.ref}`, r]));
  function firstInterval(it) {
    if (['lesson', 'quiz', 'homework', 'mock'].includes(it.kind) && typeof it.pct === 'number' && it.pct < LOW) return LOW_BASE;
    return BASE[it.kind] || 7;
  }
  // When an item would naturally be due, with no review history.
  function virtualDue(it) {
    const from = String(it.last_at || it.completed_at).slice(0, 10);
    let iv = firstInterval(it);
    let due = addDays(from, iv);
    // Not revisited in a while: walk the ladder 3 → 7 → 14 → 30 → 60 so very old items surface at spaced points, not all at once.
    const ladder = [3, 7, 14, 30, 60];
    const t = today();
    if (due < t && iv >= 3) {
      const age = daysBetween(from, t);
      const step = ladder.filter((d) => d <= age).pop() || iv;
      iv = step; due = addDays(from, step);
    }
    return { due, interval: iv };
  }
  function streakOf(pid) {
    const days = new Set(sql('SELECT DISTINCT substr(at,1,10) d FROM shelf_log WHERE person_id=? AND deleted=0 AND at>=?', pid, addDays(today(), -400)).map((r) => r.d));
    let d = today(); if (!days.has(d)) d = addDays(d, -1);
    let n = 0; while (days.has(d)) { n++; d = addDays(d, -1); }
    const week = [...Array(7)].map((_, i) => addDays(today(), i - 6)).map((x) => ({ date: x, done: days.has(x) }));
    return { days: n, today: days.has(today()), week, total_days: days.size };
  }
  function examsLine(pid) {
    const r = safe('exams_reviews', () => sqlOne("SELECT SUM(CASE WHEN due<=? AND status!='mastered' THEN 1 ELSE 0 END) due, COUNT(*) n FROM exams_reviews WHERE person_id=? AND deleted=0", today(), pid), null);
    if (!r || !r.n) return null;
    return { due: r.due || 0, total: r.n, link: '#/m/exams/revise', label: 'Exam Prep revision cards', label_ml: 'പരീക്ഷാ റിവിഷൻ കാർഡുകൾ' };
  }
  function reviseToday(pid, items) {
    const t = today();
    const rows = reviewRows(pid);
    const seen = new Set();
    const cands = [];
    for (const it of items) {
      if (it.no_review) continue;
      const key = `${it.kind}|${it.ref}`;
      if (seen.has(key)) continue; seen.add(key);
      const r = rows.get(key);
      const doneToday = !!(r && r.last_reviewed_at && String(r.last_reviewed_at).slice(0, 10) === t);
      const v = r ? { due: r.due, interval: r.interval_days } : virtualDue(it);
      const low = typeof it.pct === 'number' && it.pct < LOW && ['lesson', 'quiz', 'homework', 'mock'].includes(it.kind);
      // lower = more urgent. Reviewed-today items keep their place so the day's list is stable.
      const overdue = daysBetween(v.due, t);
      const prio = doneToday ? -1e6 : (low ? -1000 : 0) - Math.min(overdue, 365) * (it.kind === 'book' ? 0.3 : 1) + (hashNum(pid + t + key) % 1000) / 1000;
      cands.push({ ...it, due: v.due, interval_days: v.interval, reviews: r ? r.reviews || 0 : 0, last_result: r ? r.last_result : null, done_today: doneToday, low, prio, is_due: doneToday || v.due <= t });
    }
    cands.sort((a, b) => a.prio - b.prio);
    const want = 3 + (hashNum(pid + '|' + t) % 3); // 3–5 a day, fixed per person per day
    // Mix kinds so one busy module (e.g. many mocks) does not fill the day: ≤2 per kind, ≤1 book.
    const cap = (k) => (k === 'book' ? 1 : 2);
    const per = {}; let pick = [];
    const take = (list, n) => { for (const c of list) { if (pick.length >= n) break; if (pick.includes(c) || (per[c.kind] || 0) >= cap(c.kind)) continue; per[c.kind] = (per[c.kind] || 0) + 1; pick.push(c); } };
    const due = cands.filter((c) => c.is_due);
    take(due, want);
    if (pick.length < 3) take(cands.filter((c) => !c.is_due).sort((a, b) => String(a.due).localeCompare(String(b.due))), 3);
    if (pick.length < 3) { for (const k of Object.keys(per)) per[k] = -99; take(due, 3); }
    return {
      date: t,
      items: pick.map(({ prio, is_due, ...c }) => ({ ...c, reason: c.low ? 'low_score' : c.reviews ? 'spaced' : 'not_revisited' })),
      done: pick.filter((c) => c.done_today).length,
      due_total: cands.filter((c) => c.is_due).length,
      exams: examsLine(pid),
    };
  }

  // ---------- shared builders ----------
  function personCard(pid) {
    const b = brain.persons.basic(pid);
    if (!b) throw httpError(404, 'Person not found');
    const h = brain.hamlets.get(b.hamlet_id);
    return { id: b.id, name: b.name, kind: b.kind, gender: b.gender, age: b.age, school_class: b.school_class, hamlet_id: b.hamlet_id, hamlet: h ? h.name : null, hamlet_ml: h ? h.name_ml : null };
  }
  function shelfFor(pid, user) {
    const person = personCard(pid);
    const items = collect(pid);
    const folders = organise(person, items);
    const modules = [...new Set(items.map((i) => i.module))];
    const scored = items.filter((i) => typeof i.pct === 'number');
    return {
      person, folders, modules,
      totals: { items: items.length, lessons: items.filter((i) => i.kind === 'lesson').length, tests: items.filter((i) => ['quiz', 'mock'].includes(i.kind)).length, books: items.filter((i) => i.kind === 'book').length, avg_pct: scored.length ? round(scored.reduce((s, i) => s + i.pct, 0) / scored.length) : null },
      revise: reviseToday(pid, items),
      streak: streakOf(pid),
      self: !!user && user.person_id === pid,
      passport_link: `#/passport/${pid}`,
      brand: brain.brand.name,
    };
  }
  function checkProgress(user, pid) {
    const v = brain.policy.canSee(user, pid, 'progress');
    if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
    if (v.audited && user.person_id !== pid) brain.audit(user, 'person_read', pid, { scope: 'progress' });
    return v;
  }
  function monthStats(pid, ms = monthStart(), me = null) {
    const items = collect(pid).filter((i) => String(i.completed_at) >= ms && (!me || String(i.completed_at) < me));
    const scored = items.filter((i) => typeof i.pct === 'number' && ['lesson', 'quiz', 'mock', 'homework'].includes(i.kind));
    const revised = sqlOne('SELECT COUNT(*) n FROM shelf_log WHERE person_id=? AND deleted=0 AND at>=? AND at<?', pid, ms, me || '9999').n;
    return { lessons: items.filter((i) => i.kind === 'lesson').length, revised, books: items.filter((i) => i.kind === 'book').length, tests: items.filter((i) => ['quiz', 'mock'].includes(i.kind)).length, avg_pct: scored.length ? round(scored.reduce((s, i) => s + i.pct, 0) / scored.length) : null, activities: items.length };
  }
  function familySummary(name, s, streak, last = false) {
    const first = String(name || '').split(' ')[0];
    const en = []; const ml = [];
    const M = last ? ['Last month', 'കഴിഞ്ഞ മാസം'] : ['This month', 'ഈ മാസം'];
    if (!s.activities && !s.revised) {
      en.push(`${first} has not finished anything new this month yet.`, 'A few minutes of revision each day helps — open the shelf together.');
      ml.push(`ഈ മാസം ${first} പുതിയതൊന്നും പൂർത്തിയാക്കിയിട്ടില്ല.`, 'ദിവസവും കുറച്ചു നേരം ആവർത്തിക്കുന്നത് സഹായിക്കും — അലമാര ഒരുമിച്ച് തുറന്നു നോക്കൂ.');
    } else {
      en.push(`${M[0]} ${first} finished ${s.lessons} lesson${s.lessons === 1 ? '' : 's'}, took ${s.tests} test${s.tests === 1 ? '' : 's'} and revised ${s.revised} item${s.revised === 1 ? '' : 's'}${s.books ? `, and read ${s.books} book${s.books === 1 ? '' : 's'}` : ''}.`);
      ml.push(`${M[1]} ${first} ${s.lessons} പാഠങ്ങൾ പൂർത്തിയാക്കി, ${s.tests} ടെസ്റ്റുകൾ എഴുതി, ${s.revised} എണ്ണം ആവർത്തിച്ചു${s.books ? `, ${s.books} പുസ്തകങ്ങൾ വായിച്ചു` : ''}.`);
      if (s.avg_pct !== null) {
        const word = s.avg_pct >= 80 ? ['very good', 'വളരെ നല്ലത്'] : s.avg_pct >= 60 ? ['good', 'നല്ലത്'] : ['needs a little more practice', 'കുറച്ചുകൂടി പരിശീലനം വേണം'];
        en.push(`The average score was ${s.avg_pct}% — ${word[0]}.`);
        ml.push(`ശരാശരി മാർക്ക് ${s.avg_pct}% — ${word[1]}.`);
      }
      if (streak.days >= 2) { en.push(`${first} has revised ${streak.days} days in a row. Please praise this!`); ml.push(`തുടർച്ചയായി ${streak.days} ദിവസം ആവർത്തിച്ചു. അഭിനന്ദിക്കൂ!`); } else { en.push('Encourage a short revision every day.'); ml.push('ദിവസവും ചെറിയൊരു ആവർത്തനത്തിന് പ്രോത്സാഹിപ്പിക്കൂ.'); }
    }
    return { en: en.join(' '), ml: ml.join(' ') };
  }

  // ---------- routes ----------
  router.get('/me', requires('learn'), (req, res) => {
    if (!req.user.person_id) throw httpError(400, 'Your account is not linked to a learner record.');
    res.json(shelfFor(req.user.person_id, req.user));
  });
  router.get('/today', requires('learn'), (req, res) => {
    const pid = req.user.person_id;
    if (!pid) throw httpError(400, 'Your account is not linked to a learner record.');
    res.json({ ...reviseToday(pid, collect(pid)), streak: streakOf(pid) });
  });
  router.get('/person/:pid', authed, (req, res) => {
    const pid = req.params.pid;
    checkProgress(req.user, pid);
    res.json(shelfFor(pid, req.user));
  });

  router.post('/review', requires('learn'), (req, res) => {
    const pid = req.user.person_id;
    const { kind, ref, result } = req.body || {};
    if (!pid) throw httpError(400, 'Your account is not linked to a learner record.');
    if (!['easy', 'ok', 'hard'].includes(result)) throw httpError(400, 'result must be easy, ok or hard');
    if (!kind || !ref) throw httpError(400, 'kind and ref are required');
    const it = collect(pid).find((i) => i.kind === kind && i.ref === ref);
    if (!it) throw httpError(404, 'That item is not on your shelf.');
    const person = brain.persons.raw(pid);
    const cur = data.find('shelf_reviews', { person_id: pid, kind, ref })[0];
    const prevIv = cur ? Number(cur.interval_days) || 1 : firstInterval(it);
    const reviews = (cur ? Number(cur.reviews) || 0 : 0) + 1;
    let ease = cur ? Number(cur.ease) || 2.5 : 2.5;
    let iv;
    if (result === 'hard') { iv = reviews > 2 && cur && cur.last_result !== 'hard' ? 2 : 1; ease = Math.max(1.3, ease - 0.2); }
    else if (result === 'ok') iv = Math.max(2, Math.round(prevIv * 2));
    else { iv = Math.max(3, Math.round(prevIv * 3)); ease = Math.min(3, ease + 0.15); }
    iv = Math.min(MAX_INTERVAL, iv);
    const now = new Date().toISOString();
    const due = addDays(today(), iv);
    const row = tx(() => {
      const r = data.put('shelf_reviews', { ...(cur ? { id: cur.id } : {}), person_id: pid, hamlet_id: person && person.hamlet_id, kind, ref, title: it.title, module: it.module, interval_days: iv, ease: Math.round(ease * 100) / 100, due, last_result: result, reviews, last_reviewed_at: now }, req.user);
      data.put('shelf_log', { person_id: pid, hamlet_id: person && person.hamlet_id, kind, ref, module: it.module, result, interval_days: iv, at: now }, req.user);
      return r;
    });
    emit('shelf.revised', { person_id: pid, kind, ref, module: it.module, result, interval_days: iv, due }, req.user, person && person.hamlet_id);
    res.json({ ok: true, kind, ref, result, interval_days: iv, due, previous_interval: prevIv, reviews: row.reviews, streak: streakOf(pid) });
  });

  router.get('/family', requires('family'), (req, res) => {
    const wards = brain.persons.visible(req.user, {}).filter((p) => p.id !== req.user.person_id && p.guardian_id === req.user.person_id);
    const out = [];
    for (const w of wards) {
      if (!brain.policy.canSee(req.user, w.id, 'progress').ok) continue;
      const month = monthStats(w.id);
      const ms = monthStart();
      const prevStart = new Date(Date.UTC(Number(ms.slice(0, 4)), Number(ms.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
      const last_month = monthStats(w.id, prevStart, ms);
      const streak = streakOf(w.id);
      // Early in a month there is little to say yet — speak about last month instead.
      const useLast = !month.activities && !month.revised && (last_month.activities || last_month.revised);
      out.push({ person: personCard(w.id), month, last_month, summary_period: useLast ? 'last_month' : 'month', streak: { days: streak.days, week: streak.week }, summary: familySummary(w.name, useLast ? last_month : month, streak, useLast), link: `#/m/shelf/learner?pid=${w.id}`, passport_link: `#/passport/${w.id}` });
    }
    res.json({ month: monthStart().slice(0, 7), wards: out });
  });

  router.get('/export/:pid', authed, (req, res) => {
    const pid = req.params.pid;
    const v = brain.policy.canSee(req.user, pid, 'progress');
    if (!v.ok || !['self', 'guardian', 'steward'].includes(v.reason)) throw httpError(403, 'Only the learner, their guardian or the platform steward can take the shelf home.');
    brain.audit(req.user, 'export', pid, { reason: v.reason });
    const s = shelfFor(pid, req.user);
    const reviews = data.find('shelf_reviews', { person_id: pid }).map(({ kind, ref, title, module, interval_days, due, last_result, reviews: n, last_reviewed_at }) => ({ kind, ref, title, module, interval_days, due, last_result, reviews: n, last_reviewed_at }));
    res.setHeader('content-disposition', `attachment; filename="learning-shelf-${pid.slice(-8)}.json"`);
    res.json({ format: 'learning-shelf/v1', exported_at: new Date().toISOString(), platform: brain.brand.name, owner: brain.brand.owner, person: s.person, totals: s.totals, streak: { days: s.streak.days, total_days: s.streak.total_days }, folders: s.folders, revision: reviews, passport_link: s.passport_link });
  });

  // ---- staff: class view ----
  const STAFF = ['teach', 'learner.read', 'hamlet.coordinate'];
  function staffProgrammes(user) {
    let progs = user.role === 'platform_admin' ? brain.programmes.list({}) : user.agency_id ? brain.programmes.list({ agency_id: user.agency_id }) : [];
    if (Array.isArray(user.hamlet_ids) && user.hamlet_ids.length) progs = progs.filter((p) => user.hamlet_ids.includes(p.hamlet_id));
    return progs.filter((p) => p.status !== 'closed');
  }
  router.get('/classes', requires(...STAFF), (req, res) => {
    const progs = staffProgrammes(req.user);
    res.json(progs.slice(0, 200).map((p) => { const h = brain.hamlets.get(p.hamlet_id); return { id: p.id, title: p.title, title_ml: p.title_ml, brand: p.brand || null, brand_ml: p.brand_ml || null, track: p.track, module: p.module, hamlet: h ? h.name : null }; }));
  });
  router.get('/class/:programmeId', requires(...STAFF), (req, res) => {
    const pr = brain.programmes.get(req.params.programmeId);
    if (!pr) throw httpError(404, 'Programme not found');
    if (!staffProgrammes(req.user).some((p) => p.id === pr.id)) throw httpError(403, 'Not one of your programmes');
    const since = addDays(today(), -6);
    const ids = [...new Set(brain.enrolments.forProgramme(pr.id).filter((e) => ['active', 'completed'].includes(e.status)).map((e) => e.person_id))];
    let hidden = 0; const learners = [];
    for (const id of ids) {
      if (!brain.policy.canSee(req.user, id, 'progress').ok) { hidden++; continue; }
      const b = brain.persons.basic(id);
      if (!b) continue;
      const w = sqlOne('SELECT COUNT(*) n, COUNT(DISTINCT substr(at,1,10)) d FROM shelf_log WHERE person_id=? AND deleted=0 AND at>=?', id, since);
      learners.push({ id, name: b.name, gender: b.gender, kind: b.kind, school_class: b.school_class, revised_week: w.n, days_week: w.d, streak: streakOf(id).days });
    }
    learners.sort((a, b) => b.revised_week - a.revised_week || a.name.localeCompare(b.name));
    res.json({ programme: { id: pr.id, title: pr.title, title_ml: pr.title_ml, brand: pr.brand || null }, since, learners, hidden, revised_learners: learners.filter((l) => l.revised_week > 0).length });
  });

  // ---------- demo seed ----------
  async function seed(demo) {
    const people = [demo.demoLearner, demo.demoYouth].filter(Boolean);
    const R = demo.R;
    tx(() => {
      for (const p of people) {
        const items = collect(p.id).filter((i) => !i.no_review);
        if (!items.length) continue;
        const state = new Map();
        // ~6 weeks of revision on most days, streak running up to yesterday
        for (let n = 42; n >= 1; n--) {
          const skip = n > 9 && R.chance(0.28);
          if (skip) continue;
          const day = addDays(today(), -n);
          const pool = items.filter((i) => String(i.completed_at).slice(0, 10) <= day);
          if (!pool.length) continue;
          const k = R.int(1, 4);
          for (const it of R.sample(pool, k)) {
            const key = `${it.kind}|${it.ref}`;
            const s = state.get(key) || { iv: firstInterval(it), reviews: 0, ease: 2.5, it };
            const low = typeof it.pct === 'number' && it.pct < LOW;
            const result = low ? R.pick(['hard', 'hard', 'ok']) : R.pick(['ok', 'ok', 'easy', 'hard']);
            s.iv = Math.min(MAX_INTERVAL, result === 'hard' ? 1 : result === 'ok' ? Math.max(2, s.iv * 2) : Math.max(3, s.iv * 3));
            s.ease = Math.max(1.3, Math.min(3, s.ease + (result === 'easy' ? 0.15 : result === 'hard' ? -0.2 : 0)));
            s.reviews++; s.result = result; s.at = day + `T${String(R.int(15, 20)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00.000Z`;
            state.set(key, s);
            data.put('shelf_log', { person_id: p.id, hamlet_id: p.hamlet_id, kind: it.kind, ref: it.ref, module: it.module, result, interval_days: s.iv, at: s.at }, null);
          }
        }
        for (const s of state.values()) {
          data.put('shelf_reviews', { person_id: p.id, hamlet_id: p.hamlet_id, kind: s.it.kind, ref: s.it.ref, title: s.it.title, module: s.it.module, interval_days: s.iv, ease: Math.round(s.ease * 100) / 100, due: addDays(s.at, s.iv), last_result: s.result, reviews: s.reviews, last_reviewed_at: s.at }, null);
        }
      }
    });
  }

  return {
    seed,
    health: () => ({ reviews: sqlOne('SELECT COUNT(*) n FROM shelf_reviews WHERE deleted=0').n, revisions_7d: sqlOne('SELECT COUNT(*) n FROM shelf_log WHERE deleted=0 AND at>=?', addDays(today(), -6)).n, sources: { lessons: LESSONS.size, language_activities: LANG.acts.size, lifeskills_modules: LIFE.size } }),
    _internal: { collect, organise, reviseToday, acadYear },
  };
};
