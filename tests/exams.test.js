'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bootDemo } = require('./helpers');
const L = require('../modules/exams/lib');

test('exams lib: scoring with Kerala PSC negative marking (1/3)', () => {
  const pat = L.PATTERN.psc_mini;
  const qs = L.BANK.slice(0, 6);
  const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
  const qids = qs.map((q) => ({ qid: q.id, section: 'gk' }));
  // 3 correct, 2 wrong, 1 blank → 3 − 2/3 = 2.33
  const answers = [qs[0].answer, qs[1].answer, qs[2].answer, (qs[3].answer + 1) % 4, (qs[4].answer + 2) % 4, null];
  const r = L.score(pat, qids, answers, byId);
  assert.equal(r.correct, 3); assert.equal(r.wrong, 2); assert.equal(r.blank, 1);
  assert.equal(r.score, 2.33);
  assert.equal(r.max_score, 6);
});

test('exams lib: SM-2-lite grows interval on success, resets on lapse', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  let s = L.sm2(null, 4, now); assert.equal(s.interval_d, 1);
  s = L.sm2(s, 4, now); assert.equal(s.interval_d, 3);
  s = L.sm2(s, 5, now); assert.ok(s.interval_d >= 7, 'third success grows interval');
  const lapse = L.sm2(s, 1, now); assert.equal(lapse.interval_d, 1); assert.equal(lapse.reps, 0); assert.ok(lapse.ef < s.ef);
});

test('exams lib: question bank is well-formed and large enough', () => {
  assert.ok(L.BANK.length >= 250, 'at least 250 MCQs');
  for (const q of L.BANK) {
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options).size, 4, 'distinct options ' + q.id);
    assert.ok(q.answer >= 0 && q.answer < 4, q.id);
    assert.ok(L.SUBJECTS[q.subject], q.id);
  }
  assert.ok(L.BANK.filter((q) => q.q_ml).length > 200, 'bilingual');
  for (const p of L.PATTERNS) assert.equal(L.buildPaper(p, L.BANK).length, p.n, p.id + ' builds a full paper');
});

test('exams module end-to-end', async (t) => {
  const b = await bootDemo();
  t.after(() => b.close());
  const youth = b.as('demo.youth');
  const dy = b.demo.demoYouth;

  await t.test('demo youth has a rich, improving journey', async () => {
    const r = await youth.get('/api/m/exams/dashboard');
    assert.equal(r.status, 200);
    assert.ok(r.body.stats.mocks >= 8, 'several mocks');
    const tr = r.body.trend.map((x) => x.pct);
    const first = tr.slice(0, 3).reduce((a, x) => a + x, 0) / 3, last = tr.slice(-3).reduce((a, x) => a + x, 0) / 3;
    assert.ok(last > first + 5, `improving scores (${first} → ${last})`);
    assert.ok(r.body.revision.due > 0, 'revision due');
    assert.ok(r.body.applications.some((a) => a.exam && a.exam.body === 'psc' && a.exam.days_to_deadline > 0 || (a.exam && a.exam.exam_date > new Date().toISOString())), 'upcoming PSC exam tracked');
    const cal = await youth.get('/api/m/exams/calendar');
    assert.ok(cal.body.some((c) => c.body === 'psc' && c.status === 'open' && c.my_application), 'open PSC application in calendar');
  });

  await t.test('mock test: start, submit, score with negative marking, revision updated', async () => {
    const s = await youth.post('/api/m/exams/attempts', { pattern: 'psc_mini' });
    assert.equal(s.status, 200);
    assert.equal(s.body.questions.length, 20);
    assert.equal(s.body.questions[0].answer, undefined, 'answers hidden during a mock');
    // in-progress attempt is hidden from others
    const peek = await b.as('demo.teacher').get('/api/m/exams/attempts/' + s.body.id);
    assert.equal(peek.status, 403);
    const bank = Object.fromEntries(L.BANK.map((q) => [q.id, q]));
    const ans = s.body.questions.map((q, i) => (i < 10 ? bank[q.id].answer : i < 16 ? (bank[q.id].answer + 1) % 4 : null));
    const before = (await youth.get('/api/m/exams/revision')).body.counts.total;
    const r = await youth.post(`/api/m/exams/attempts/${s.body.id}/submit`, { answers: ans });
    assert.equal(r.status, 200);
    assert.equal(r.body.result.correct, 10); assert.equal(r.body.result.wrong, 6); assert.equal(r.body.result.blank, 4);
    assert.equal(r.body.result.score, 8, '10 − 6×⅓ = 8');
    assert.ok(Array.isArray(r.body.result.sections) && r.body.result.sections.length === 3, 'section-wise analysis');
    assert.ok(r.body.questions[0].answer !== undefined, 'answer key after submit');
    const again = await youth.post(`/api/m/exams/attempts/${s.body.id}/submit`, { answers: [] });
    assert.equal(again.body.result.score, 8, 'resubmission is idempotent');
    const rev = await youth.get('/api/m/exams/revision');
    assert.ok(rev.body.counts.total >= before, 'wrong/blank answers queued');
    // grade a card
    const card = rev.body.cards[0];
    const g = await youth.post(`/api/m/exams/revision/${encodeURIComponent(card.qid)}/grade`, { grade: 5 });
    assert.equal(g.status, 200);
    assert.ok(g.body.due > new Date().toISOString().slice(0, 10), 'pushed into the future');
    const bad = await youth.post(`/api/m/exams/revision/${encodeURIComponent(card.qid)}/grade`, { grade: 9 });
    assert.equal(bad.status, 400);
  });

  await t.test('practice set reveals answers; weakness analytics', async () => {
    const s = await youth.post('/api/m/exams/attempts', { pattern: 'practice', subject: 'quant', n: 5 });
    assert.equal(s.status, 200);
    assert.equal(s.body.questions.length, 5);
    assert.ok(s.body.questions.every((q) => q.subject === 'quant' && q.answer !== undefined));
    const w = await youth.get('/api/m/exams/weakness');
    assert.equal(w.status, 200);
    assert.ok(w.body.topics.length > 5 && w.body.subjects.length > 3);
  });

  await t.test('application tracker + reminders through brain.notify', async () => {
    const cal = (await youth.get('/api/m/exams/calendar')).body;
    const target = cal.find((c) => !c.my_application && c.status !== 'past');
    const a = await youth.post('/api/m/exams/applications', { calendar_id: target.id });
    assert.equal(a.status, 200); assert.equal(a.body.status, 'interested');
    const u = await youth.put('/api/m/exams/applications/' + a.body.id, { status: 'applied', application_no: 'X-1', docs: { sslc: true, bogus: true } });
    assert.equal(u.body.status, 'applied'); assert.ok(u.body.steps.docs_ready, 'earlier steps filled'); assert.equal(u.body.docs.bogus, undefined);
    const run = await b.as('demo.facilitator2').post('/api/m/exams/reminders/run', {});
    assert.equal(run.status, 200);
    const n = b.brain.store.all("SELECT * FROM notifications WHERE person_id=? AND module='exams'", dy.id);
    assert.ok(n.length >= 2, 'reminders queued in the outbox');
  });

  await t.test('teacher (same agency) sees batch; assigns a mock; learner sees it', async () => {
    const teacher = b.as('demo.teacher');
    const progs = await teacher.get('/api/m/exams/teach/programmes');
    assert.equal(progs.status, 200);
    const h2 = progs.body.find((p) => p.hamlet_id === dy.hamlet_id);
    assert.ok(h2, 'CIF exam batch in h2');
    const batch = await teacher.get('/api/m/exams/teach/batch/' + h2.id);
    assert.equal(batch.status, 200);
    assert.ok(batch.body.learners.some((l) => l.id === dy.id));
    const asg = await teacher.post('/api/m/exams/assignments', { programme_id: h2.id, pattern: 'psc_mini', title: 'Test assignment' });
    assert.equal(asg.status, 200);
    const mine = await youth.get('/api/m/exams/assignments');
    assert.ok(mine.body.some((a) => a.id === asg.body.id && !a.done));
    const st = await youth.post('/api/m/exams/attempts', { assignment_id: asg.body.id });
    assert.equal(st.status, 200); assert.equal(st.body.pattern, 'psc_mini');
    const ld = await teacher.get('/api/m/exams/teach/learner/' + dy.id);
    assert.equal(ld.status, 200);
  });

  await t.test('permission denials', async () => {
    // Vanajyothi runs no exam programme for demo youth → other-agency facilitator denied
    const vjt = b.as('demo.facilitator.vjt');
    assert.equal((await vjt.get('/api/m/exams/dashboard?person_id=' + dy.id)).status, 403);
    assert.equal((await vjt.get('/api/m/exams/teach/learner/' + dy.id)).status, 403);
    // University teacher: youth IS enrolled with UOC (language) + consent, but not in a UOC exam programme
    assert.equal((await b.as('demo.teacher.uoc').get('/api/m/exams/dashboard?person_id=' + dy.id)).status, 403, 'purpose limitation: language teacher cannot read exam data');
    // other agency cannot assign to CIF batch
    const cifProg = b.demo.programmes.find((p) => p.track === 'exams' && p.hamlet_id === dy.hamlet_id && p.agency_id === b.demo.agencyByKey.cif.id);
    assert.equal((await b.as('demo.teacher.uoc').post('/api/m/exams/assignments', { programme_id: cifProg.id, pattern: 'psc_mini' })).status, 403);
    assert.equal((await b.as('demo.teacher.uoc').get('/api/m/exams/teach/batch/' + cifProg.id)).status, 403);
    // donor: no person-level data, no starting tests; aggregates only (suppressed)
    const donor = b.as('demo.donor');
    assert.equal((await donor.get('/api/m/exams/dashboard?person_id=' + dy.id)).status, 403);
    assert.equal((await donor.post('/api/m/exams/attempts', { pattern: 'psc_mini' })).status, 403);
    const ov = await donor.get('/api/m/exams/admin/overview');
    assert.equal(ov.status, 200);
    assert.ok(ov.body.hamlets.every((h) => typeof h.learners !== 'number' || h.learners === 0 || h.learners >= 5), 'k-anonymity for donors');
    // another learner cannot read demo youth or submit their attempt
    const other = b.as('demo.learner');
    assert.equal((await other.get('/api/m/exams/dashboard?person_id=' + dy.id)).status, 403);
    const own = (await youth.get('/api/m/exams/attempts')).body.find((a) => a.status === 'in_progress');
    if (own) assert.equal((await other.post(`/api/m/exams/attempts/${own.id}/submit`, { answers: [] })).status, 404);
    // learners cannot author questions directly into review... teach required
    assert.equal((await other.post('/api/m/exams/questions', { subject: 'kerala', q: 'x', options: ['a', 'b', 'c', 'd'], answer: 0 })).status, 403);
  });

  await t.test('question authoring needs a second reviewer', async () => {
    const q = await b.as('demo.teacher').post('/api/m/exams/questions', { subject: 'kerala', topic: 'test', q: 'Demo authored question?', options: ['Yes', 'No', 'Maybe', 'Never'], answer: 0 });
    assert.equal(q.status, 200); assert.equal(q.body.status, 'pending');
    assert.equal((await b.as('demo.teacher').post(`/api/m/exams/questions/${q.body.id}/review`, { approve: true })).status, 403, 'four-eyes');
    assert.equal((await b.as('demo.cif.admin').post(`/api/m/exams/questions/${q.body.id}/review`, { approve: true })).body.status, 'approved');
  });

  await t.test('leaderboard is opt-in only', async () => {
    const lb = await youth.get('/api/m/exams/leaderboard');
    assert.equal(lb.status, 200);
    assert.ok(lb.body.rows.some((r) => r.me), 'demo youth opted in');
    await youth.put('/api/m/exams/prefs', { leaderboard: false });
    const lb2 = await youth.get('/api/m/exams/leaderboard');
    assert.ok(!lb2.body.rows.some((r) => r.me), 'opt-out respected');
    assert.ok(lb2.body.rows.every((r) => /^\S+( \S\.)?$/.test(r.name)), 'short names only');
    assert.equal((await b.as('demo.donor').get('/api/m/exams/leaderboard?hamlet_id=' + dy.hamlet_id)).status, 403);
  });

  await t.test('consent revoked → learner disappears from teacher views', async () => {
    const teacher = b.as('demo.teacher');
    const h2 = (await teacher.get('/api/m/exams/teach/programmes')).body.find((p) => p.hamlet_id === dy.hamlet_id);
    const consent = b.brain.store.one("SELECT * FROM consents WHERE person_id=? AND agency_id=? AND status='active' AND deleted=0", dy.id, b.demo.agencyByKey.cif.id);
    const rv = await youth.post(`/api/core/consents/${consent.id}/revoke`, {});
    assert.equal(rv.status, 200);
    const batch = await teacher.get('/api/m/exams/teach/batch/' + h2.id);
    assert.ok(!batch.body.learners.some((l) => l.id === dy.id), 'hidden after revocation');
    assert.ok(batch.body.hidden_without_consent >= 1);
    assert.equal((await teacher.get('/api/m/exams/dashboard?person_id=' + dy.id)).status, 403);
    assert.equal((await teacher.get('/api/m/exams/teach/learner/' + dy.id)).status, 403);
    // the learner still owns and sees their data
    assert.equal((await youth.get('/api/m/exams/dashboard')).status, 200);
  });
});
