'use strict';
// AADI · exams — competitive exam preparation (Kerala PSC, Bank, SSC, RRB).
// Policy: learners see themselves; guardians their wards; agency staff see a learner's exam
// data only with enrolment + active "progress" consent AND an exam-track enrolment with
// their own agency (purpose limitation). Donors / govt viewers get suppressed aggregates.
const L = require('./lib');
const { seedAll } = require('./seed');

const DOC_LIST = [
  { id: 'sslc', label: 'SSLC certificate', label_ml: 'എസ്.എസ്.എൽ.സി സർട്ടിഫിക്കറ്റ്' },
  { id: 'community', label: 'Community (ST) certificate', label_ml: 'ജാതി (ST) സർട്ടിഫിക്കറ്റ്' },
  { id: 'aadhaar', label: 'Aadhaar card', label_ml: 'ആധാർ കാർഡ്' },
  { id: 'photo', label: 'Photo & signature (scanned)', label_ml: 'ഫോട്ടോ, ഒപ്പ് (സ്കാൻ)' },
  { id: 'profile', label: 'One-time registration / profile done', label_ml: 'ഒറ്റത്തവണ രജിസ്ട്രേഷൻ' },
  { id: 'email', label: 'Mobile number & email working', label_ml: 'മൊബൈൽ, ഇമെയിൽ' },
];
const STEPS = [
  { id: 'interested', label: 'Interested', label_ml: 'താൽപര്യം' },
  { id: 'docs_ready', label: 'Documents ready', label_ml: 'രേഖകൾ തയ്യാർ' },
  { id: 'applied', label: 'Applied', label_ml: 'അപേക്ഷിച്ചു' },
  { id: 'hall_ticket', label: 'Hall ticket', label_ml: 'ഹാൾ ടിക്കറ്റ്' },
  { id: 'exam_taken', label: 'Exam written', label_ml: 'പരീക്ഷ എഴുതി' },
  { id: 'result', label: 'Result', label_ml: 'ഫലം' },
];
const STEP_IDS = STEPS.map((s) => s.id);

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError } = ctx;
  const today = () => new Date().toISOString().slice(0, 10);

  // ---------------------------------------------------------------- question pool
  let pool = L.BANK, byId = Object.fromEntries(L.BANK.map((q) => [q.id, q])), poolAt = 0;
  function refreshPool() {
    const authored = sql("SELECT * FROM exams_questions WHERE deleted=0 AND status='approved'").map((r) => ({ id: r.id, subject: r.subject, topic: r.topic, difficulty: r.difficulty || 1, q: r.q, q_ml: r.q_ml, options: r.options, options_ml: r.options_ml, answer: Number(r.answer), x: r.x, x_ml: r.x_ml, authored: true }));
    pool = [...L.BANK, ...authored];
    byId = Object.fromEntries(pool.map((q) => [q.id, q]));
    poolAt = Date.now();
  }
  const getPool = () => { if (Date.now() - poolAt > 60e3) refreshPool(); return pool; };
  const getQ = (id) => { getPool(); return byId[id]; };
  const publicQ = (q, withAnswer = false) => q && ({ id: q.id, subject: q.subject, topic: q.topic, difficulty: q.difficulty, q: q.q, q_ml: q.q_ml, options: q.options, options_ml: q.options_ml, ...(withAnswer ? { answer: q.answer, x: q.x, x_ml: q.x_ml } : {}) });

  // ---------------------------------------------------------------- access
  const STAFF_ALL = ['platform_admin', 'cpo'];
  function examEnrolled(pid, agencyId) {
    return !!sqlOne("SELECT 1 x FROM enrolments e JOIN programmes p ON p.id=e.programme_id WHERE e.person_id=? AND e.agency_id=? AND e.deleted=0 AND e.status IN ('active','completed') AND p.track='exams'", pid, agencyId);
  }
  function access(user, pid) {
    if (!pid) return { ok: false, reason: 'no person' };
    if (user.person_id && user.person_id === pid) return { ok: true, reason: 'self', self: true };
    const v = brain.policy.canSee(user, pid, 'progress');
    if (!v.ok) return v;
    if (STAFF_ALL.includes(user.role) || user.role === 'guardian') return v;
    if (!examEnrolled(pid, user.agency_id)) return { ok: false, reason: 'learner is not in an exam programme of your agency' };
    if (Array.isArray(user.hamlet_ids) && user.hamlet_ids.length) {
      const p = brain.persons.raw(pid);
      if (!p || !user.hamlet_ids.includes(p.hamlet_id)) return { ok: false, reason: 'outside your hamlets' };
    }
    return v;
  }
  function personFor(req, { write = false } = {}) {
    const pid = req.query.person_id || req.body?.person_id || req.user.person_id;
    if (!pid) throw httpError(400, 'person_id required');
    const a = access(req.user, pid);
    if (!a.ok) throw httpError(403, 'Not permitted: ' + a.reason);
    if (write && !a.self && !brain.policy.can(req.user, 'learner.write') && !brain.policy.can(req.user, 'teach')) throw httpError(403, 'Read-only access');
    if (!a.self && STAFF_ALL.includes(req.user.role)) brain.audit(req.user, 'person_read', pid, { path: req.path });
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'person not found');
    return p;
  }
  const isStaff = (u) => brain.policy.can(u, 'teach') || brain.policy.can(u, 'learner.read');

  // ---------------------------------------------------------------- meta
  router.get('/meta', authed, (req, res) => res.json({ ...L.syllabus(getPool()), steps: STEPS, docs: DOC_LIST }));

  // ---------------------------------------------------------------- dashboard
  router.get('/dashboard', authed, (req, res) => {
    const p = personFor(req);
    const attempts = sql("SELECT id, pattern, title, pct, score, max_score, correct, wrong, blank, submitted_at, sections, assignment_id FROM exams_attempts WHERE person_id=? AND deleted=0 AND status='submitted' ORDER BY submitted_at", p.id);
    const mocks = attempts.filter((a) => a.pattern !== 'practice');
    const weak = L.weakness(attempts.slice(-12), byId).filter((w) => w.n >= 3);
    const rev = sqlOne("SELECT SUM(due<=?) due, SUM(status='learning') learning, SUM(status='mastered') mastered, COUNT(*) n FROM exams_reviews WHERE person_id=? AND deleted=0", today(), p.id);
    const apps = applicationsFor(p.id);
    const cal = calendarList().filter((c) => c.status !== 'past').slice(0, 6);
    const affairs = data.find('exams_affairs', {}, { order: 'date DESC', limit: 3 });
    const assigned = assignmentsForPerson(p.id).filter((a) => !a.done).slice(0, 5);
    const prefs = prefsFor(p.id);
    const streak = (() => { const days = new Set(attempts.map((a) => (a.submitted_at || '').slice(0, 10))); let n = 0; for (let i = 0; i < 60; i++) { const d = new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10); if (days.has(d)) n++; else if (i > 0) break; } return n; })();
    res.json({
      person: { id: p.id, name: p.name, hamlet_id: p.hamlet_id, aspirations: p.aspirations },
      stats: { mocks: mocks.length, practice: attempts.length - mocks.length, best: mocks.reduce((m, a) => Math.max(m, a.pct), 0), last: mocks.length ? mocks[mocks.length - 1].pct : null, streak },
      trend: mocks.slice(-10).map((a) => ({ id: a.id, pct: a.pct, date: a.submitted_at, pattern: a.pattern, title: a.title })),
      recent: [...attempts].reverse().slice(0, 8).map(({ sections, ...a }) => a),
      weak: weak.slice(0, 6), strong: [...weak].reverse().slice(0, 3),
      revision: { due: rev?.due || 0, learning: rev?.learning || 0, mastered: rev?.mastered || 0, total: rev?.n || 0 },
      applications: apps, calendar: cal, affairs, assignments: assigned, prefs,
    });
  });

  // ---------------------------------------------------------------- attempts (mock + practice)
  router.post('/attempts', requires('learn'), (req, res) => {
    const p = personFor(req, { write: true });
    if (p.id !== req.user.person_id) throw httpError(403, 'Only the learner can start their own test');
    const b = req.body || {};
    let pattern, title, qids, assignment = null;
    if (b.assignment_id) {
      assignment = data.get('exams_assignments', b.assignment_id);
      if (!assignment || !assignmentsForPerson(p.id).some((a) => a.id === assignment.id)) throw httpError(404, 'assignment not found');
      b.pattern = assignment.pattern; b.subject = b.subject || assignment.subject; b.topic = b.topic || assignment.topic;
    }
    if (b.pattern === 'practice' || b.pattern === 'revision') {
      const n = Math.min(Math.max(Number(b.n) || 10, 3), 30);
      let cands = getPool().filter((q) => (!b.subject || q.subject === b.subject) && (!b.topic || q.topic === b.topic));
      if (b.weak) {
        const weakKeys = new Set(L.weakness(sql("SELECT sections FROM exams_attempts WHERE person_id=? AND deleted=0 AND status='submitted' ORDER BY submitted_at DESC LIMIT 12", p.id), byId).slice(0, 4).map((w) => w.key));
        const w = cands.filter((q) => weakKeys.has(`${q.subject}/${q.topic}`));
        if (w.length >= n) cands = w;
      }
      if (!cands.length) throw httpError(400, 'No questions for that topic yet');
      qids = L.shuffle(cands).slice(0, n).map((q) => ({ qid: q.id, section: q.subject }));
      pattern = { id: 'practice', mark: 1, neg: 0, minutes: 0, sections: [...new Set(qids.map((x) => x.section))].map((s) => ({ key: s, label: L.SUBJECTS[s]?.label || s, label_ml: L.SUBJECTS[s]?.ml || s, n: 0 })) };
      title = b.subject ? `Practice · ${L.SUBJECTS[b.subject]?.label || b.subject}${b.topic ? ' · ' + b.topic : ''}` : (b.weak ? 'Practice · weak topics' : 'Practice · mixed');
    } else {
      pattern = L.PATTERN[b.pattern];
      if (!pattern) throw httpError(400, 'unknown pattern');
      // favour weak-topic questions a little so mocks also teach
      const reviewIds = new Set(sql('SELECT qid FROM exams_reviews WHERE person_id=? AND deleted=0 AND status!=\'mastered\' LIMIT 200', p.id).map((r) => r.qid));
      qids = L.buildPaper(pattern, getPool(), { prefer: reviewIds });
      title = pattern.title;
    }
    const enr = sqlOne("SELECT e.programme_id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id WHERE e.person_id=? AND e.deleted=0 AND e.status='active' AND pr.track='exams' LIMIT 1", p.id);
    const row = data.put('exams_attempts', { person_id: p.id, hamlet_id: p.hamlet_id, pattern: pattern.id, title: assignment ? (assignment.title || title) : title, assignment_id: assignment?.id || null, programme_id: assignment?.programme_id || enr?.programme_id || null, qids, answers: [], status: 'in_progress', started_at: new Date().toISOString(), neg: pattern.neg, subject: b.subject || null, topic: b.topic || null }, req.user);
    res.json(attemptView(row, pattern.id === 'practice'));
  });

  function attemptView(a, withAnswers) {
    const pattern = L.PATTERN[a.pattern];
    const qs = (a.qids || []).map((it) => ({ ...publicQ(getQ(it.qid), withAnswers), section: it.section }));
    return { id: a.id, pattern: a.pattern, title: a.title, status: a.status, started_at: a.started_at, submitted_at: a.submitted_at, minutes: pattern ? pattern.minutes : 0, mark: pattern ? pattern.mark : 1, neg: a.neg || 0, sections: pattern ? L.publicPattern(pattern).sections : null, questions: qs, answers: a.answers || [], result: a.status === 'submitted' ? { correct: a.correct, wrong: a.wrong, blank: a.blank, score: a.score, max_score: a.max_score, pct: a.pct, sections: a.sections?.list, topics: a.sections?.topics, duration_s: a.duration_s } : null };
  }

  router.get('/attempts', authed, (req, res) => {
    const p = personFor(req);
    res.json(sql("SELECT id, pattern, title, status, pct, score, max_score, correct, wrong, blank, started_at, submitted_at, duration_s, assignment_id FROM exams_attempts WHERE person_id=? AND deleted=0 ORDER BY started_at DESC LIMIT 100", p.id));
  });

  router.get('/attempts/:id', authed, (req, res) => {
    const a = data.get('exams_attempts', req.params.id);
    if (!a) throw httpError(404, 'not found');
    const acc = access(req.user, a.person_id);
    if (!acc.ok) throw httpError(403, 'Not permitted: ' + acc.reason);
    if (a.status !== 'submitted' && !acc.self) throw httpError(403, 'Test still in progress');
    res.json(attemptView(a, a.status === 'submitted' || a.pattern === 'practice'));
  });

  router.post('/attempts/:id/submit', requires('learn'), (req, res) => {
    const a = data.get('exams_attempts', req.params.id);
    if (!a || a.person_id !== req.user.person_id) throw httpError(404, 'not found');
    if (a.status === 'submitted') return res.json(attemptView(a, true));
    const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0, a.qids.length).map((x) => (x === null || x === undefined || x === '' ? null : Number(x))) : [];
    while (answers.length < a.qids.length) answers.push(null);
    const out = finishAttempt(a, answers, req.user, { duration_s: req.body.duration_s });
    res.json(attemptView(out, true));
  });

  function patternOf(a) {
    return L.PATTERN[a.pattern] || { id: a.pattern, mark: 1, neg: 0, sections: [...new Set((a.qids || []).map((x) => x.section))].map((s) => ({ key: s, label: L.SUBJECTS[s]?.label || s, label_ml: L.SUBJECTS[s]?.ml || s, n: 0 })) };
  }
  function finishAttempt(a, answers, user, { duration_s = null, at = null, silent = false } = {}) {
    getPool();
    const pat = patternOf(a);
    const r = L.score(pat, a.qids, answers, byId);
    const end = at || new Date().toISOString();
    const maxS = (pat.minutes || 60) * 60 + 120;
    const dur = Math.min(maxS, Math.max(0, Number(duration_s) || Math.round((new Date(end) - new Date(a.started_at)) / 1000)));
    const out = data.put('exams_attempts', { ...a, answers, status: 'submitted', submitted_at: end, duration_s: dur, correct: r.correct, wrong: r.wrong, blank: r.blank, score: r.score, max_score: r.max_score, pct: r.pct, sections: r.sections }, user);
    // spaced repetition: wrong/blank → into the queue; correct → strengthen if already queued
    const now = new Date(end).getTime();
    const existing = Object.fromEntries(sql('SELECT * FROM exams_reviews WHERE person_id=? AND deleted=0', a.person_id).map((x) => [x.qid, x]));
    a.qids.forEach((it, i) => {
      const q = byId[it.qid]; if (!q) return;
      const ex = existing[it.qid];
      if (r.detail[i] === 'correct') { if (ex && ex.status !== 'mastered') data.put('exams_reviews', { ...ex, ...L.sm2(ex, 4, now) }, user); return; }
      data.put('exams_reviews', { ...(ex || { person_id: a.person_id, hamlet_id: a.hamlet_id, qid: q.id, subject: q.subject, topic: q.topic }), ...L.sm2(ex ? { ...ex } : null, r.detail[i] === 'wrong' ? 1 : 2, now) }, user);
    });
    if (!silent) {
      emit('exams.mock_completed', { attempt_id: out.id, person_id: a.person_id, pattern: a.pattern, pct: r.pct, score: r.score, max: r.max_score }, user, a.hamlet_id);
      awardFor(out, user);
    }
    return out;
  }
  function examAgency(pid) { return sqlOne("SELECT e.agency_id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id WHERE e.person_id=? AND e.deleted=0 AND e.status IN ('active','completed') AND pr.track='exams' LIMIT 1", pid)?.agency_id || null; }
  function awardFor(a, user) {
    const agency_id = examAgency(a.person_id);
    const pat = L.PATTERN[a.pattern];
    try {
      if (pat && pat.full && a.pct >= 50) brain.passport.award({ person_id: a.person_id, type: 'competency', ref: 'PSC.MOCK', title: `Cleared a full-length mock: ${pat.title} (${a.pct}%)`, level: 2, evidence: { attempt_id: a.id, pct: a.pct }, agency_id }, user);
      for (const s of (a.sections?.list || [])) {
        if (s.n < 10 || s.pct < 70) continue;
        const subj = pat?.sections.find((x) => x.key === s.key)?.subjects?.[0];
        const comp = subj && L.SUBJECTS[subj]?.comp;
        if (comp) brain.passport.award({ person_id: a.person_id, type: 'competency', ref: comp, title: `${s.label}: ${s.pct}% in a timed mock`, level: 1, evidence: { attempt_id: a.id }, agency_id }, user);
      }
    } catch (e) { ctx.log('award skipped:', e.message); }
  }

  // ---------------------------------------------------------------- weakness & revision
  router.get('/weakness', authed, (req, res) => {
    const p = personFor(req);
    const attempts = sql("SELECT sections FROM exams_attempts WHERE person_id=? AND deleted=0 AND status='submitted' ORDER BY submitted_at DESC LIMIT 30", p.id);
    const list = L.weakness(attempts, byId);
    const bySubject = {};
    for (const w of list) { const s = bySubject[w.subject] || (bySubject[w.subject] = { subject: w.subject, label: w.subject_label, label_ml: w.subject_ml, correct: 0, n: 0 }); s.correct += w.correct; s.n += w.n; }
    res.json({ topics: list, subjects: Object.values(bySubject).map((s) => ({ ...s, accuracy: s.n ? Math.round((s.correct / s.n) * 100) : 0 })).sort((a, b) => a.accuracy - b.accuracy) });
  });

  router.get('/revision', authed, (req, res) => {
    const p = personFor(req);
    const all = sql('SELECT * FROM exams_reviews WHERE person_id=? AND deleted=0 ORDER BY due, lapses DESC', p.id);
    const due = all.filter((r) => r.due <= today());
    const self = req.user.person_id === p.id;
    res.json({
      counts: { due: due.length, learning: all.filter((r) => r.status === 'learning').length, mastered: all.filter((r) => r.status === 'mastered').length, total: all.length },
      upcoming: [1, 2, 3, 4, 5, 6, 7].map((d) => { const day = new Date(Date.now() + d * 86400e3).toISOString().slice(0, 10); return { day, n: all.filter((r) => r.due === day).length }; }),
      cards: due.slice(0, Math.min(Number(req.query.limit) || 20, 50)).map((r) => ({ qid: r.qid, due: r.due, reps: r.reps, lapses: r.lapses, interval_d: r.interval_d, question: self || brain.policy.can(req.user, 'teach') ? publicQ(getQ(r.qid), true) : null })).filter((c) => !self || c.question),
    });
  });

  router.post('/revision/:qid/grade', requires('learn'), (req, res) => {
    const pid = req.user.person_id;
    const r = sqlOne('SELECT * FROM exams_reviews WHERE person_id=? AND qid=? AND deleted=0', pid, req.params.qid);
    const q = getQ(req.params.qid);
    if (!q) throw httpError(404, 'question not found');
    const grade = Number(req.body.grade);
    if (!(grade >= 0 && grade <= 5)) throw httpError(400, 'grade must be 0–5');
    const p = brain.persons.raw(pid);
    const base = r || { person_id: pid, hamlet_id: p.hamlet_id, qid: q.id, subject: q.subject, topic: q.topic };
    const out = data.put('exams_reviews', { ...base, ...L.sm2(r, grade) }, req.user);
    res.json({ qid: out.qid, due: out.due, interval_d: out.interval_d, ef: out.ef, reps: out.reps, status: out.status });
  });

  // ---------------------------------------------------------------- current affairs
  router.get('/affairs', authed, (req, res) => {
    const w = req.query.category ? { category: req.query.category } : {};
    res.json(data.find('exams_affairs', w, { order: 'date DESC', limit: Math.min(Number(req.query.limit) || 40, 100) }));
  });
  router.post('/affairs', requires('teach', 'content.review'), (req, res) => {
    const b = req.body || {};
    if (!b.title || !b.body) throw httpError(400, 'title and body required');
    res.json(data.put('exams_affairs', { date: b.date || today(), category: b.category || 'explainer', title: b.title, title_ml: b.title_ml, body: b.body, body_ml: b.body_ml, tags: b.tags || [], author: req.user.display_name, demo: 0 }, req.user));
  });

  // ---------------------------------------------------------------- calendar & applications
  function calendarList() {
    const t = today();
    return data.find('exams_calendar', {}, { order: 'COALESCE(apply_by, exam_date)' }).map((c) => {
      const open = c.apply_by && c.apply_by >= t && (!c.apply_from || c.apply_from <= t);
      const st = open ? 'open' : (c.apply_from && c.apply_from > t ? 'upcoming' : (c.exam_date && c.exam_date >= t ? 'closed' : 'past'));
      const days = (d) => (d ? Math.round((new Date(d) - new Date(t)) / 86400e3) : null);
      return { ...c, status: st, days_to_deadline: days(c.apply_by), days_to_exam: days(c.exam_date) };
    }).sort((a, b) => ({ open: 0, upcoming: 1, closed: 2, past: 3 }[a.status] - { open: 0, upcoming: 1, closed: 2, past: 3 }[b.status]) || String(a.apply_by || a.exam_date).localeCompare(String(b.apply_by || b.exam_date)));
  }
  function applicationsFor(pid) {
    const cal = Object.fromEntries(data.find('exams_calendar').map((c) => [c.id, c]));
    return data.find('exams_applications', { person_id: pid }).map((a) => ({ ...a, exam: cal[a.calendar_id] || null, step_index: STEP_IDS.indexOf(a.status) })).sort((x, y) => String(x.exam?.exam_date || '').localeCompare(String(y.exam?.exam_date || '')));
  }
  router.get('/calendar', authed, (req, res) => {
    const list = calendarList();
    const mine = req.user.person_id ? Object.fromEntries(data.find('exams_applications', { person_id: req.user.person_id }).map((a) => [a.calendar_id, a])) : {};
    res.json(list.map((c) => ({ ...c, my_application: mine[c.id] ? { id: mine[c.id].id, status: mine[c.id].status } : null })));
  });
  router.post('/calendar', requires('agency.manage', 'hamlet.coordinate', 'teach'), (req, res) => {
    const b = req.body || {};
    if (!b.title || !(b.apply_by || b.exam_date)) throw httpError(400, 'title and a date are required');
    res.json(data.put('exams_calendar', { code: b.code || null, body: b.body || 'psc', title: b.title, title_ml: b.title_ml, notif_date: b.notif_date, apply_from: b.apply_from, apply_by: b.apply_by, exam_date: b.exam_date, pattern: b.pattern, eligibility: b.eligibility, eligibility_ml: b.eligibility_ml, url: b.url, demo: 0 }, req.user));
  });

  router.get('/applications', authed, (req, res) => res.json(applicationsFor(personFor(req).id)));
  router.post('/applications', authed, (req, res) => {
    const p = personFor(req, { write: true });
    const c = data.get('exams_calendar', req.body.calendar_id);
    if (!c) throw httpError(404, 'exam not found');
    const ex = data.find('exams_applications', { person_id: p.id, calendar_id: c.id })[0];
    if (ex) return res.json(ex);
    const self = req.user.person_id === p.id;
    const row = data.put('exams_applications', { person_id: p.id, hamlet_id: p.hamlet_id, calendar_id: c.id, status: 'interested', steps: { interested: today() }, docs: {}, remind: req.body.remind === false ? 0 : 1, assisted_by: self ? null : req.user.display_name }, req.user);
    emit('exams.application_updated', { application_id: row.id, person_id: p.id, status: 'interested' }, req.user, p.hamlet_id);
    if (row.remind && c.apply_by) brain.notify(p.id, `AADI: ${c.title} — apply by ${c.apply_by}. Keep your documents ready. / അപേക്ഷിക്കേണ്ട അവസാന തീയതി ${c.apply_by}.`, { channel: 'auto' }, req.user);
    res.json(row);
  });
  router.put('/applications/:id', authed, (req, res) => {
    const a = data.get('exams_applications', req.params.id);
    if (!a) throw httpError(404, 'not found');
    req.query.person_id = a.person_id;
    personFor(req, { write: true });
    const b = req.body || {};
    const upd = { ...a };
    if (b.status) {
      if (!STEP_IDS.includes(b.status)) throw httpError(400, 'bad status');
      upd.status = b.status;
      upd.steps = { ...(a.steps || {}) };
      for (const s of STEP_IDS.slice(0, STEP_IDS.indexOf(b.status) + 1)) if (!upd.steps[s]) upd.steps[s] = today();
    }
    if (b.docs && typeof b.docs === 'object') upd.docs = { ...(a.docs || {}), ...Object.fromEntries(Object.entries(b.docs).filter(([k]) => DOC_LIST.some((d) => d.id === k)).map(([k, v]) => [k, !!v])) };
    if (b.application_no !== undefined) upd.application_no = String(b.application_no).slice(0, 40);
    if (b.note !== undefined) upd.note = String(b.note).slice(0, 500);
    if (b.remind !== undefined) upd.remind = b.remind ? 1 : 0;
    if (req.user.person_id !== a.person_id) upd.assisted_by = req.user.display_name;
    const out = data.put('exams_applications', upd, req.user);
    if (b.status && b.status !== a.status) emit('exams.application_updated', { application_id: out.id, person_id: a.person_id, status: b.status }, req.user, a.hamlet_id);
    res.json(out);
  });

  // Deadline / exam-day reminders via brain.notify (dedup: once per application per day)
  function runReminders(user = null) {
    const t = today();
    const cal = Object.fromEntries(calendarList().map((c) => [c.id, c]));
    let sent = 0;
    tx(() => {
      for (const a of data.find('exams_applications', { remind: 1 })) {
        const c = cal[a.calendar_id]; if (!c) continue;
        if (a.last_reminded === t) continue;
        let msg = null;
        if (['interested', 'docs_ready'].includes(a.status) && c.days_to_deadline !== null && c.days_to_deadline >= 0 && c.days_to_deadline <= 7) msg = `AADI reminder: ${c.title} — last date to apply is ${c.apply_by} (${c.days_to_deadline} day(s) left). / അപേക്ഷിക്കാൻ ${c.days_to_deadline} ദിവസം കൂടി.`;
        else if (['applied', 'hall_ticket'].includes(a.status) && c.days_to_exam !== null && c.days_to_exam >= 0 && c.days_to_exam <= 7) msg = `AADI reminder: ${c.title} exam on ${c.exam_date}. ${a.status === 'applied' ? 'Download your hall ticket. / ഹാൾ ടിക്കറ്റ് ഡൗൺലോഡ് ചെയ്യുക.' : 'Carry hall ticket + original ID. / ഹാൾ ടിക്കറ്റും ഐ.ഡിയും കരുതുക.'}`;
        if (!msg) continue;
        brain.notify(a.person_id, msg, { channel: 'auto' }, user);
        data.put('exams_applications', { ...a, last_reminded: t }, user);
        sent++;
      }
    });
    return sent;
  }
  router.post('/reminders/run', requires('ops', 'teach'), (req, res) => res.json({ sent: runReminders(req.user) }));
  const timer = setInterval(() => { try { runReminders(null); } catch (e) { ctx.log('reminders failed', e.message); } }, 6 * 3600e3);
  if (timer.unref) timer.unref();

  // ---------------------------------------------------------------- prefs & leaderboard
  function prefsFor(pid) { return data.find('exams_prefs', { person_id: pid })[0] || { person_id: pid, leaderboard: 0, target_exam: null, daily_goal: 10 }; }
  router.put('/prefs', requires('learn'), (req, res) => {
    const pid = req.user.person_id;
    const cur = data.find('exams_prefs', { person_id: pid })[0];
    const p = brain.persons.raw(pid);
    const b = req.body || {};
    res.json(data.put('exams_prefs', { ...(cur || { person_id: pid, hamlet_id: p.hamlet_id, leaderboard: 0, daily_goal: 10 }), ...(b.leaderboard !== undefined ? { leaderboard: b.leaderboard ? 1 : 0 } : {}), ...(b.target_exam !== undefined ? { target_exam: b.target_exam } : {}), ...(b.daily_goal !== undefined ? { daily_goal: Math.max(5, Math.min(100, Number(b.daily_goal) || 10)) } : {}) }, req.user));
  });

  router.get('/leaderboard', authed, (req, res) => {
    const u = req.user;
    let hamlet = req.query.hamlet_id;
    if (u.role === 'learner') hamlet = brain.persons.raw(u.person_id)?.hamlet_id;
    else if (!STAFF_ALL.includes(u.role)) {
      if (!isStaff(u)) throw httpError(403, 'Leaderboards are for learners and their teachers');
      const mine = sql("SELECT DISTINCT hamlet_id FROM programmes WHERE agency_id=? AND track='exams' AND deleted=0", u.agency_id).map((r) => r.hamlet_id);
      if (!hamlet) hamlet = mine[0];
      if (!mine.includes(hamlet)) throw httpError(403, 'Your agency has no exam programme in this hamlet');
    }
    if (!hamlet) throw httpError(400, 'hamlet_id required');
    const since = new Date(Date.now() - 30 * 86400e3).toISOString();
    const rows = sql(`SELECT a.person_id, COUNT(*) n, ROUND(AVG(a.pct),1) avg, MAX(a.pct) best FROM exams_attempts a JOIN exams_prefs p ON p.person_id=a.person_id AND p.deleted=0 AND p.leaderboard=1
      WHERE a.deleted=0 AND a.status='submitted' AND a.pattern!='practice' AND a.hamlet_id=? AND a.submitted_at>=? GROUP BY a.person_id ORDER BY avg DESC LIMIT 20`, hamlet, since);
    const h = brain.hamlets.get(hamlet);
    res.json({ hamlet: h && { id: h.id, name: h.name, name_ml: h.name_ml }, window_days: 30, opted_in_only: true, rows: rows.map((r, i) => { const p = brain.persons.raw(r.person_id); const parts = (p?.name || '?').split(' '); return { rank: i + 1, name: parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : ''), me: r.person_id === u.person_id, mocks: r.n, avg: r.avg, best: r.best }; }) });
  });

  // ---------------------------------------------------------------- assignments
  function assignmentsForPerson(pid) {
    const progs = sql("SELECT e.programme_id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id WHERE e.person_id=? AND e.deleted=0 AND e.status='active' AND pr.track='exams'", pid).map((r) => r.programme_id);
    if (!progs.length) return [];
    const done = new Set(sql("SELECT assignment_id FROM exams_attempts WHERE person_id=? AND deleted=0 AND status='submitted' AND assignment_id IS NOT NULL", pid).map((r) => r.assignment_id));
    return sql(`SELECT * FROM exams_assignments WHERE deleted=0 AND programme_id IN (${progs.map(() => '?').join(',')}) ORDER BY due DESC`, ...progs).map((a) => ({ ...a, done: done.has(a.id), agency_name: brain.agencies.get(a.agency_id)?.name }));
  }
  router.get('/assignments', authed, (req, res) => {
    if (req.user.person_id && req.user.role === 'learner') return res.json(assignmentsForPerson(req.user.person_id));
    if (!brain.policy.can(req.user, 'teach')) throw httpError(403, 'forbidden');
    const w = req.user.role === 'platform_admin' ? {} : { agency_id: req.user.agency_id };
    if (req.query.programme_id) w.programme_id = req.query.programme_id;
    res.json(data.find('exams_assignments', w, { order: 'due DESC', limit: 200 }));
  });
  router.post('/assignments', requires('teach'), (req, res) => {
    const b = req.body || {};
    const prog = brain.programmes.get(b.programme_id);
    if (!prog || prog.track !== 'exams') throw httpError(404, 'exam programme not found');
    if (req.user.role !== 'platform_admin' && prog.agency_id !== req.user.agency_id) throw httpError(403, 'You can only assign tests to your own agency\'s batches');
    if (b.pattern !== 'practice' && !L.PATTERN[b.pattern]) throw httpError(400, 'unknown pattern');
    const pat = L.PATTERN[b.pattern];
    const row = data.put('exams_assignments', { agency_id: prog.agency_id, programme_id: prog.id, hamlet_id: prog.hamlet_id, pattern: b.pattern, title: b.title || pat?.title || 'Practice set', title_ml: b.title_ml || pat?.title_ml, due: b.due || new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10), created_by: req.user.display_name, created_at: new Date().toISOString(), subject: b.subject || null, topic: b.topic || null }, req.user);
    emit('exams.assignment_created', { assignment_id: row.id, programme_id: prog.id }, req.user, prog.hamlet_id);
    // tell enrolled learners (only those who consented to contact by this agency)
    for (const e of brain.enrolments.forProgramme(prog.id).filter((e) => e.status === 'active')) {
      if (brain.consent.has(e.person_id, prog.agency_id, 'contact')) brain.notify(e.person_id, `AADI: new mock test assigned — ${row.title}, due ${row.due}. / പുതിയ മോക്ക് ടെസ്റ്റ്.`, { channel: 'app' }, req.user);
    }
    res.json(row);
  });

  // ---------------------------------------------------------------- teacher views
  function myExamProgrammes(u) {
    const w = { track: 'exams' };
    if (u.role !== 'platform_admin' && u.role !== 'cpo') w.agency_id = u.agency_id;
    let list = brain.programmes.list(w).filter((p) => p.status !== 'closed');
    if (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length) list = list.filter((p) => u.hamlet_ids.includes(p.hamlet_id));
    return list;
  }
  router.get('/teach/programmes', requires('teach', 'hamlet.coordinate', 'learner.read'), (req, res) => {
    const progs = myExamProgrammes(req.user);
    const vis = brain.persons.visibleIds(req.user);
    const visSet = vis === null ? null : new Set(vis);
    const since = new Date(Date.now() - 30 * 86400e3).toISOString();
    res.json(progs.map((p) => {
      const ids = brain.enrolments.forProgramme(p.id).filter((e) => e.status === 'active').map((e) => e.person_id).filter((id) => !visSet || visSet.has(id));
      const consented = ids.filter((id) => access(req.user, id).ok);
      const st = consented.length ? sqlOne(`SELECT COUNT(*) n, ROUND(AVG(pct),1) avg, COUNT(DISTINCT person_id) active FROM exams_attempts WHERE deleted=0 AND status='submitted' AND pattern!='practice' AND submitted_at>=? AND person_id IN (${consented.map(() => '?').join(',')})`, since, ...consented) : { n: 0, avg: null, active: 0 };
      const h = brain.hamlets.get(p.hamlet_id);
      return { id: p.id, title: p.title, title_ml: p.title_ml, hamlet_id: p.hamlet_id, hamlet: h?.name, hamlet_ml: h?.name_ml, agency_id: p.agency_id, agency: brain.agencies.get(p.agency_id)?.name, schedule: p.schedule, enrolled: ids.length, visible: consented.length, mocks_30d: st.n, avg_30d: st.avg, active_30d: st.active };
    }));
  });

  router.get('/teach/batch/:programmeId', requires('teach', 'hamlet.coordinate', 'learner.read'), (req, res) => {
    const prog = brain.programmes.get(req.params.programmeId);
    if (!prog || prog.track !== 'exams') throw httpError(404, 'exam programme not found');
    if (!myExamProgrammes(req.user).some((p) => p.id === prog.id)) throw httpError(403, 'Not your agency\'s batch');
    const enr = brain.enrolments.forProgramme(prog.id).filter((e) => e.status === 'active');
    const people = Object.fromEntries(brain.persons.visible(req.user, { hamlet_id: prog.hamlet_id, limit: 5000 }).map((p) => [p.id, p]));
    const learners = enr.map((e) => people[e.person_id]).filter(Boolean).filter((p) => access(req.user, p.id).ok);
    const hidden = enr.length - learners.length;
    const ids = learners.map((p) => p.id);
    const atts = ids.length ? sql(`SELECT id, person_id, pattern, title, pct, submitted_at, sections, assignment_id FROM exams_attempts WHERE deleted=0 AND status='submitted' AND person_id IN (${ids.map(() => '?').join(',')}) ORDER BY submitted_at`, ...ids) : [];
    const revs = ids.length ? Object.fromEntries(sql(`SELECT person_id, SUM(due<=?) due, COUNT(*) n FROM exams_reviews WHERE deleted=0 AND person_id IN (${ids.map(() => '?').join(',')}) GROUP BY person_id`, today(), ...ids).map((r) => [r.person_id, r])) : {};
    const apps = ids.length ? sql(`SELECT person_id, status FROM exams_applications WHERE deleted=0 AND person_id IN (${ids.map(() => '?').join(',')})`, ...ids) : [];
    const assignments = data.find('exams_assignments', { programme_id: prog.id }, { order: 'due DESC' });
    const rows = learners.map((p) => {
      const mine = atts.filter((a) => a.person_id === p.id);
      const mocks = mine.filter((a) => a.pattern !== 'practice');
      const w = L.weakness(mine.slice(-8), byId).filter((x) => x.n >= 3).slice(0, 2);
      const last = mocks.slice(-3).map((a) => a.pct);
      return { id: p.id, name: p.name, age: p.age, aspirations: p.aspirations, mocks: mocks.length, practice: mine.length - mocks.length, avg: mocks.length ? Math.round(mocks.reduce((s, a) => s + a.pct, 0) / mocks.length) : null, last: last.length ? last[last.length - 1] : null, trend: mocks.slice(-6).map((a) => a.pct), last_at: mine.length ? mine[mine.length - 1].submitted_at : null, weak: w.map((x) => ({ subject: x.subject, topic: x.topic, accuracy: x.accuracy, label: x.subject_label })), revision_due: revs[p.id]?.due || 0, applications: apps.filter((a) => a.person_id === p.id).map((a) => a.status), assignments_done: assignments.filter((as) => mine.some((a) => a.assignment_id === as.id)).length };
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
    const subj = {};
    for (const w of L.weakness(atts, byId)) { const s = subj[w.subject] || (subj[w.subject] = { subject: w.subject, label: w.subject_label, label_ml: w.subject_ml, correct: 0, n: 0 }); s.correct += w.correct; s.n += w.n; }
    const h = brain.hamlets.get(prog.hamlet_id);
    res.json({
      programme: { id: prog.id, title: prog.title, title_ml: prog.title_ml, hamlet: h?.name, hamlet_ml: h?.name_ml, hamlet_id: prog.hamlet_id, agency: brain.agencies.get(prog.agency_id)?.name, schedule: prog.schedule },
      learners: rows, hidden_without_consent: hidden,
      subjects: Object.values(subj).map((s) => ({ ...s, accuracy: s.n ? Math.round((s.correct / s.n) * 100) : 0 })).sort((a, b) => a.accuracy - b.accuracy),
      assignments: assignments.map((a) => ({ ...a, done: rows.filter((r) => atts.some((x) => x.person_id === r.id && x.assignment_id === a.id)).length, of: rows.length })),
      weekly: (() => { const out = []; for (let w = 11; w >= 0; w--) { const from = Date.now() - (w + 1) * 7 * 86400e3, to = Date.now() - w * 7 * 86400e3; const ws = atts.filter((a) => a.pattern !== 'practice' && new Date(a.submitted_at) >= from && new Date(a.submitted_at) < to); out.push({ week: new Date(to).toISOString().slice(0, 10), n: ws.length, avg: ws.length ? Math.round(ws.reduce((s, a) => s + a.pct, 0) / ws.length) : null }); } return out; })(),
    });
  });

  // per-learner detail for teacher (dashboard endpoint handles it with person_id); explicit alias
  router.get('/teach/learner/:pid', requires('teach', 'learner.read'), (req, res) => {
    const a = access(req.user, req.params.pid);
    if (!a.ok) throw httpError(403, 'Not permitted: ' + a.reason);
    const p = brain.persons.get(req.user, req.params.pid, 'progress');
    const attempts = sql("SELECT id, pattern, title, pct, score, max_score, correct, wrong, blank, submitted_at, sections FROM exams_attempts WHERE person_id=? AND deleted=0 AND status='submitted' ORDER BY submitted_at", p.id);
    res.json({ person: { id: p.id, name: p.name, age: p.age, hamlet_id: p.hamlet_id, aspirations: p.aspirations }, attempts: attempts.map(({ sections, ...x }) => ({ ...x, sections: sections?.list })), weakness: L.weakness(attempts, byId).slice(0, 12), applications: applicationsFor(p.id) });
  });

  // ---------------------------------------------------------------- question authoring & review
  router.post('/questions', requires('teach', 'content.review'), (req, res) => {
    const b = req.body || {};
    if (!L.SUBJECTS[b.subject] || !b.q || !Array.isArray(b.options) || b.options.length !== 4 || !(Number(b.answer) >= 0 && Number(b.answer) < 4)) throw httpError(400, 'subject, q, 4 options and answer (0–3) required');
    res.json(data.put('exams_questions', { subject: b.subject, topic: String(b.topic || 'general').slice(0, 40), q: b.q, q_ml: b.q_ml, options: b.options.map(String), options_ml: b.options_ml || null, answer: Number(b.answer), x: b.x, x_ml: b.x_ml, difficulty: Number(b.difficulty) || 1, author_id: req.user.id, agency_id: req.user.agency_id, status: 'pending' }, req.user));
  });
  router.get('/questions/review', requires('content.review'), (req, res) => res.json(data.find('exams_questions', { status: req.query.status || 'pending' }, { order: 'updated_at DESC', limit: 100 })));
  router.post('/questions/:id/review', requires('content.review'), (req, res) => {
    const q = data.get('exams_questions', req.params.id);
    if (!q) throw httpError(404, 'not found');
    if (q.author_id === req.user.id) throw httpError(403, 'A second person must review a question (four-eyes rule)');
    const out = data.put('exams_questions', { ...q, status: req.body.approve ? 'approved' : 'rejected' }, req.user);
    poolAt = 0;
    res.json(out);
  });
  router.get('/practice/topics', authed, (req, res) => res.json(L.syllabus(getPool()).subjects));

  // ---------------------------------------------------------------- admin overview (aggregates only)
  router.get('/admin/overview', requires('analytics.aggregate', 'platform.manage'), (req, res) => {
    const u = req.user;
    let scope = null; // null = all persons in exam programmes
    if (u.role === 'agency_admin' || u.role === 'coordinator') {
      scope = sql("SELECT DISTINCT e.person_id FROM enrolments e JOIN programmes p ON p.id=e.programme_id WHERE e.deleted=0 AND e.agency_id=? AND p.track='exams'", u.agency_id).map((r) => r.person_id);
      if (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length) { const hs = new Set(u.hamlet_ids); scope = scope.filter((id) => hs.has(brain.persons.raw(id)?.hamlet_id)); }
    }
    const inScope = (rows) => (scope === null ? rows : rows.filter((r) => scope.includes(r.person_id)));
    const atts = inScope(sql("SELECT person_id, hamlet_id, pattern, pct, submitted_at FROM exams_attempts WHERE deleted=0 AND status='submitted'"));
    const apps = inScope(sql('SELECT person_id, hamlet_id, status FROM exams_applications WHERE deleted=0'));
    const S = (n) => brain.policy.suppress(n, u);
    const mocks = atts.filter((a) => a.pattern !== 'practice');
    const hamlets = brain.hamlets.list().map((h) => {
      const ha = mocks.filter((a) => a.hamlet_id === h.id);
      const learners = new Set(atts.filter((a) => a.hamlet_id === h.id).map((a) => a.person_id)).size;
      return { id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, learners: S(learners), mocks: S(ha.length), avg: learners >= 5 || ['platform_admin', 'agency_admin', 'coordinator', 'cpo'].includes(u.role) ? (ha.length ? Math.round(ha.reduce((s, a) => s + a.pct, 0) / ha.length) : null) : null, applications: S(apps.filter((a) => a.hamlet_id === h.id).length) };
    }).filter((h) => h.learners !== 0);
    const months = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m);
      const key = d.toISOString().slice(0, 7);
      const ms = mocks.filter((a) => (a.submitted_at || '').startsWith(key));
      months.push({ month: key, mocks: ms.length, avg: ms.length >= 5 ? Math.round(ms.reduce((s, a) => s + a.pct, 0) / ms.length) : null });
    }
    const funnel = STEPS.map((s) => ({ ...s, n: S(apps.filter((a) => STEP_IDS.indexOf(a.status) >= STEP_IDS.indexOf(s.id)).length) }));
    const firstLast = {};
    for (const a of mocks.sort((x, y) => String(x.submitted_at).localeCompare(String(y.submitted_at)))) { const f = firstLast[a.person_id] || (firstLast[a.person_id] = { first: a.pct, last: a.pct, n: 0 }); f.last = a.pct; f.n++; }
    const improvers = Object.values(firstLast).filter((f) => f.n >= 3);
    res.json({
      totals: { learners: S(new Set(atts.map((a) => a.person_id)).size), mocks: S(mocks.length), practice: S(atts.length - mocks.length), applications: S(apps.length), questions: getPool().length, avg_gain: improvers.length >= 5 ? Math.round(improvers.reduce((s, f) => s + (f.last - f.first), 0) / improvers.length) : null, improvers: S(improvers.length) },
      months, hamlets, funnel, k_anonymity: 5,
    });
  });

  // ---------------------------------------------------------------- events
  on('core.enrolled', (ev) => {
    const p = ev.payload || {};
    if (p.track !== 'exams' || !ev.actor) return; // seeded enrolments have no actor → skip
    try { brain.notify(p.person_id, 'Welcome to AADI exam coaching! Try a 15-minute PSC mini mock. / പരീക്ഷാ പരിശീലനത്തിലേക്ക് സ്വാഗതം!', { channel: 'auto' }, null); } catch (_) { /* ignore */ }
  });

  // ---------------------------------------------------------------- seed + health
  return {
    seed: async (demo) => { seedAll(ctx, demo, { L, finishAttempt, STEP_IDS, DOC_LIST, refreshPool }); refreshPool(); },
    health: () => ({ questions: getPool().length, attempts: sqlOne("SELECT COUNT(*) n FROM exams_attempts WHERE deleted=0 AND status='submitted'").n, reviews_due: sqlOne('SELECT COUNT(*) n FROM exams_reviews WHERE deleted=0 AND due<=?', today()).n }),
  };
};
