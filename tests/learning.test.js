'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bootDemo } = require('./helpers');

let S;
test.before(async () => { S = await bootDemo(); });
test.after(async () => { if (S) await S.close(); });

const M = '/api/m/learning';
const cifTuitionH1 = () => S.demo.programmes.find((p) => p.module === 'learning' && p.track === 'tuition' && p.agency_id === S.demo.agencyByKey.cif.id && p.hamlet_id === S.demo.hamletByKey.h1.id);

test('content pack is substantial and bilingual', async () => {
  const r = await S.as('demo.learner').get(M + '/content/subjects');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.totals.lessons >= 40, 'at least 40 lessons');
  assert.ok(r.body.totals.questions >= 150, 'at least 150 questions');
  assert.ok(r.body.totals.bridge >= 5, 'mother-tongue bridge lessons');
  const l = await S.as('demo.learner').get(M + '/content/lessons/mal-1-1');
  assert.ok(l.body.title_ml && l.body.body_ml && l.body.bridge);
  assert.strictEqual(l.body.activity, undefined, 'facilitator activity hidden from learners');
  const h = S.host.health().find((m) => m.id === 'learning');
  assert.strictEqual(h.state, 'up');
  assert.ok(h.extra.sessions > 100 && h.extra.attendance > 1000);
});

test('learner flow: diagnostic → path → lesson quiz → passport award', async () => {
  const L = S.as('demo.learner');
  const home = await L.get(M + '/me/today');
  assert.strictEqual(home.status, 200);
  assert.ok(home.body.goals.length >= 2, 'daily micro-goals');
  assert.ok(home.body.streak.current >= 3, 'seeded streak');
  assert.ok(home.body.badges.length >= 3, 'seeded badges');
  assert.ok(home.body.hamlet_goal.target > 0, 'hamlet group goal');

  const dq = await L.get(M + '/diagnostic');
  assert.strictEqual(dq.status, 200);
  assert.ok(dq.body.questions.length >= 10);
  const subjects = new Set(dq.body.questions.map((q) => q.subject));
  assert.ok(subjects.size >= 4, 'diagnostic covers several subjects');
  // answer maths wrong, everything else right (right answers come from the content pack)
  const pack = {};
  for (const f of ['math', 'malayalam', 'english', 'evs', 'social']) for (const l of require(`../modules/learning/content/${f}.json`).lessons) l.questions.forEach((q, i) => { pack[`${l.id}#${i}`] = q.a; });
  const answers = Object.fromEntries(dq.body.questions.map((q) => [q.id, q.subject === 'math' ? (pack[q.id] + 1) % q.o.length : pack[q.id]]));
  const dr = await L.post(M + '/diagnostic', { answers });
  assert.strictEqual(dr.status, 200);
  assert.ok(dr.body.results.math.gap > dr.body.results.english.gap, 'maths gap detected');
  assert.ok(dr.body.path.length > 0 && dr.body.path_lessons.some((l) => l.subject === 'math'), 'catch-up path includes maths');

  // Master two LIT.ML.1 lessons → passport competency
  const before = S.brain.store.find('passport_entries', { person_id: S.demo.demoLearner.id, ref: 'LIT.ML.1' });
  assert.strictEqual(before.length, 0);
  let awarded = [];
  for (const id of ['mal-1-1', 'mal-1-2']) {
    const l = (await L.get(M + '/content/lessons/' + id)).body;
    const r = await L.post(`${M}/lessons/${id}/attempt`, { answers: l.questions.map((q) => pack[q.id]) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.score, 1);
    assert.strictEqual(r.body.status, 'mastered');
    awarded = awarded.concat(r.body.awarded);
  }
  assert.ok(awarded.some((a) => a.code === 'LIT.ML.1'), 'competency awarded');
  assert.strictEqual(S.brain.store.find('passport_entries', { person_id: S.demo.demoLearner.id, ref: 'LIT.ML.1' }).length, 1);
  const ev = S.brain.store.one("SELECT COUNT(*) n FROM events WHERE type='learning.lesson_completed'");
  assert.ok(ev.n >= 1, 'lesson_completed event emitted');

  // a wrong attempt does not complete a lesson
  const bad = await L.post(`${M}/lessons/soc-3-1/attempt`, { answers: [3, 3, 3, 3] });
  assert.strictEqual(bad.body.newly_completed, false);

  // learner cannot read another person's progress
  const other = S.demo.children.find((c) => c.id !== S.demo.demoLearner.id);
  assert.strictEqual((await L.get(`${M}/learners/${other.id}`)).status, 403);
  assert.strictEqual((await L.get(`${M}/me/today?person_id=${other.id}`)).status, 403);
});

test('homework: assign → submit with thumbnail → feedback', async () => {
  const prog = cifTuitionH1();
  const enrolled = S.demo.enrolledIn(prog.id).some((p) => p.id === S.demo.demoLearner.id) ? prog : S.demo.programmes.find((p) => p.module === 'learning' && p.agency_id === S.demo.agencyByKey.cif.id && S.demo.enrolledIn(p.id).some((x) => x.id === S.demo.demoLearner.id));
  const hw = await S.as('demo.facilitator').post(M + '/homework', { programme_id: enrolled.id, title: 'Count 20 seeds', title_ml: '20 കുരു എണ്ണുക', lesson_id: 'math-1-1' });
  assert.strictEqual(hw.status, 200);
  const list = await S.as('demo.learner').get(M + '/homework');
  assert.ok(list.body.some((h) => h.id === hw.body.id));
  const big = 'data:image/png;base64,' + 'A'.repeat(300000);
  assert.strictEqual((await S.as('demo.learner').post(`${M}/homework/${hw.body.id}/submit`, { kind: 'photo', thumb: big })).status, 400);
  const sub = await S.as('demo.learner').post(`${M}/homework/${hw.body.id}/submit`, { kind: 'photo', text: 'done', thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==' });
  assert.strictEqual(sub.status, 200);
  const fb = await S.as('demo.facilitator').post(`${M}/submissions/${sub.body.id}/feedback`, { feedback: 'Well done', grade: 5 });
  assert.strictEqual(fb.status, 200);
  assert.strictEqual(fb.body.feedback, 'Well done');
  assert.strictEqual((await S.as('demo.facilitator.vjt').post(`${M}/submissions/${sub.body.id}/feedback`, { feedback: 'x' })).status, 403);
});

test('facilitator: console, session, attendance, at-risk flag', async () => {
  const F = S.as('demo.facilitator');
  const c = await F.get(M + '/console');
  assert.strictEqual(c.status, 200);
  assert.ok(c.body.programmes.length >= 1);
  assert.ok(c.body.at_risk_total >= 1, 'seeded at-risk learners');
  const prog = cifTuitionH1();
  const s = await F.post(M + '/sessions', { programme_id: prog.id, lesson_ids: ['math-6-1'] });
  assert.strictEqual(s.status, 200);
  const detail = await F.get(`${M}/sessions/${s.body.id}`);
  assert.ok(detail.body.roster.length >= 1);
  const marks = detail.body.roster.map((r, i) => ({ person_id: r.id, status: i === 0 ? 'absent' : 'present' }));
  const a = await F.post(`${M}/sessions/${s.body.id}/attendance`, { marks, notes: 'Good session' });
  assert.strictEqual(a.status, 200);
  assert.strictEqual(a.body.total, marks.length);
  const held = await F.get(`${M}/sessions/${s.body.id}`);
  assert.strictEqual(held.body.status, 'held');
  assert.strictEqual(held.body.notes, 'Good session');
  const fl = await F.post(M + '/flags', { person_id: marks[0].person_id, programme_id: prog.id, reason: 'learning_gap', note: 'Struggling with fractions' });
  assert.strictEqual(fl.status, 200);
  const risk = await F.get(M + '/at-risk');
  assert.ok(risk.body.some((r) => r.id === marks[0].person_id));
  assert.ok(S.brain.store.one("SELECT COUNT(*) n FROM events WHERE type='learning.attendance_marked'").n >= 1);
  // cannot mark someone not on the roster
  const outsider = S.demo.children.find((p) => p.hamlet_id !== prog.hamlet_id);
  assert.strictEqual((await F.post(`${M}/sessions/${s.body.id}/attendance`, { marks: [{ person_id: outsider.id, status: 'present' }] })).status, 403);
});

test('another agency\'s facilitator cannot manage CIF programmes or read CIF-only learners', async () => {
  const V = S.as('demo.facilitator.vjt');
  const prog = cifTuitionH1();
  assert.strictEqual((await V.post(M + '/sessions', { programme_id: prog.id })).status, 403);
  const cifSession = S.brain.store.one("SELECT id FROM learning_sessions WHERE programme_id=? AND deleted=0 LIMIT 1", prog.id);
  assert.strictEqual((await V.get(`${M}/sessions/${cifSession.id}`)).status, 403);
  const learner = S.demo.enrolledIn(prog.id)[0];
  assert.strictEqual((await V.post(`${M}/sessions/${cifSession.id}/attendance`, { marks: [{ person_id: learner.id, status: 'present' }] })).status, 403);
  // a learner enrolled with CIF but not with Vanajyothi
  const vjtId = S.demo.agencyByKey.vjt.id;
  const cifOnly = S.demo.enrolledIn(prog.id).find((p) => !S.brain.store.one('SELECT 1 x FROM enrolments WHERE person_id=? AND agency_id=? AND deleted=0', p.id, vjtId));
  assert.ok(cifOnly, 'a CIF-only learner exists');
  assert.strictEqual((await V.get(`${M}/learners/${cifOnly.id}`)).status, 403);
  assert.strictEqual((await V.get(`${M}/programmes/${prog.id}/roster`)).status, 403);
  const vRisk = await V.get(M + '/at-risk');
  assert.ok(!vRisk.body.some((r) => r.id === cifOnly.id));
  // own console works
  assert.strictEqual((await V.get(M + '/console')).status, 200);
});

test('donor and govt viewer are denied person-level learning data', async () => {
  const D = S.as('demo.donor');
  assert.strictEqual((await D.get(M + '/console')).status, 403);
  assert.strictEqual((await D.get(`${M}/learners/${S.demo.demoLearner.id}`)).status, 403);
  assert.strictEqual((await D.get(M + '/me/today?person_id=' + S.demo.demoLearner.id)).status, 403);
  assert.strictEqual((await D.get(M + '/overview')).status, 403);
  assert.strictEqual((await S.as('demo.govt').get(M + '/at-risk')).status, 403);
});

test('guardian sees ward progress read-only', async () => {
  const G = S.as('demo.guardian');
  const kids = await G.get(M + '/children');
  assert.strictEqual(kids.status, 200);
  assert.ok(kids.body.some((k) => k.id === S.demo.demoLearner.id));
  assert.strictEqual((await G.get(`${M}/learners/${S.demo.demoLearner.id}`)).status, 200);
  assert.strictEqual((await G.post(`${M}/lessons/math-1-1/attempt`, { person_id: S.demo.demoLearner.id, answers: [1] })).status, 403);
});

test('agency overview shows programme-level aggregates', async () => {
  const r = await S.as('demo.cif.admin').get(M + '/overview');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.programmes.length >= 3);
  assert.ok(r.body.programmes.every((p) => p.agency === 'Community Innovations Foundation'));
  assert.ok(r.body.impact.learners_rechecked > 0);
});

test('literacy circle assessment levels up and awards passport', async () => {
  const lit = S.demo.programmes.find((p) => p.module === 'learning' && p.track === 'literacy' && p.agency_id === S.demo.agencyByKey.vjt.id && p.hamlet_id === S.demo.hamletByKey.h1.id);
  const circles = await S.as('demo.facilitator.vjt').get(M + '/literacy/circles');
  assert.strictEqual(circles.status, 200);
  const circle = circles.body.find((c) => c.programme.id === lit.id);
  assert.ok(circle && circle.learners.length);
  const m = circle.learners.find((l) => !l.literacy || l.literacy.level < 4);
  const r = await S.as('demo.facilitator.vjt').post(M + '/literacy/assess', { programme_id: lit.id, person_id: m.id, level: 4, skills: ['writes_name'] });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.level, 4);
  assert.ok(S.brain.store.find('passport_entries', { person_id: m.id, ref: 'LIT.ADULT.3' }).length === 1);
  assert.strictEqual((await S.as('demo.facilitator').post(M + '/literacy/assess', { programme_id: lit.id, person_id: m.id, level: 5 })).status, 403);
});

test('camp scheduling creates sessions', async () => {
  const prog = cifTuitionH1();
  const start = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 22 * 864e5).toISOString().slice(0, 10);
  const r = await S.as('demo.facilitator').post(M + '/camps', { programme_id: prog.id, title: 'Test camp', start_date: start, end_date: end, daily_slots: ['10:00', '14:00'] });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.sessions, 6);
});

test('consent revocation hides learner from facilitator', async () => {
  const F = S.as('demo.facilitator');
  const prog = cifTuitionH1();
  const cifId = S.demo.agencyByKey.cif.id;
  const victim = S.demo.enrolledIn(prog.id).find((p) => p.id !== S.demo.demoLearner.id);
  assert.strictEqual((await F.get(`${M}/learners/${victim.id}`)).status, 200);
  const before = await F.get(`${M}/programmes/${prog.id}/roster`);
  assert.ok(before.body.learners.some((l) => l.id === victim.id));
  const consent = S.brain.store.find('consents', { person_id: victim.id, agency_id: cifId, status: 'active' })[0];
  const rv = await S.as('demo.steward').post(`/api/core/consents/${consent.id}/revoke`, {});
  assert.strictEqual(rv.status, 200);
  assert.strictEqual((await F.get(`${M}/learners/${victim.id}`)).status, 403);
  const after = await F.get(`${M}/programmes/${prog.id}/roster`);
  assert.ok(!after.body.learners.some((l) => l.id === victim.id));
  assert.strictEqual(after.body.hidden, before.body.hidden + 1);
  const s = await F.post(M + '/sessions', { programme_id: prog.id });
  const sd = await F.get(`${M}/sessions/${s.body.id}`);
  assert.ok(!sd.body.roster.some((r) => r.id === victim.id));
  assert.strictEqual((await F.post(`${M}/sessions/${s.body.id}/attendance`, { marks: [{ person_id: victim.id, status: 'present' }] })).status, 403);
  const risk = await F.get(M + '/at-risk');
  assert.ok(!risk.body.some((r) => r.id === victim.id));
});
