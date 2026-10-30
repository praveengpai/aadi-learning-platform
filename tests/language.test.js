'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bootDemo } = require('./helpers');
const { COURSES } = require('../modules/language/content/courses');

test('language content is well-formed', () => {
  const ids = new Set();
  for (const c of COURSES) {
    assert.ok(!ids.has(c.id)); ids.add(c.id);
    for (const u of c.units) {
      assert.ok(['Pre-A1', 'A1', 'A2'].includes(u.level), `${c.id}/${u.id} level`);
      for (const a of u.activities) {
        assert.ok(['vocab', 'listen', 'convo', 'quiz', 'speak'].includes(a.kind));
        assert.ok(a.title && a.title_ml, 'bilingual titles');
        if (a.kind === 'quiz') for (const it of a.items) assert.ok(it.answer >= 0 && it.answer < it.options.length);
        if (a.kind === 'convo') for (const l of a.lines) assert.ok(a.roles[l.r] && l.ml, 'convo lines have role + Malayalam');
      }
    }
  }
  const eng = COURSES.find((c) => c.id === 'eng-spoken');
  for (const s of ['busstand', 'hospital', 'bank', 'interview', 'phone', 'hotel']) assert.ok(eng.units.some((u) => u.id === s), 'city situation ' + s);
});

test('language module end-to-end', async (t) => {
  const b = await bootDemo();
  t.after(() => b.close());
  const dy = b.demo.demoYouth;
  const youth = b.as('demo.youth');
  const uoc = b.as('demo.teacher.uoc'); // demo youth is enrolled in UOC's English club in h2

  await t.test('learner dashboard has seeded history and levels', async () => {
    const r = await youth.get('/api/m/language/dashboard');
    assert.equal(r.status, 200);
    const eng = r.body.courses.find((c) => c.id === 'eng-spoken');
    assert.ok(eng.done > 5);
    assert.ok(eng.level, 'has an English level');
    assert.ok(r.body.badges.length >= 1);
    const pp = await youth.get('/api/core/passport/' + dy.id);
    assert.ok(pp.body.entries.some((e) => e.ref === 'ENG.1'), 'ENG.1 in learning passport');
  });

  await t.test('complete activities → level + passport award', async () => {
    const c = COURSES.find((x) => x.id === 'german');
    for (const u of c.units) for (const a of u.activities) {
      if (a.kind === 'speak') continue;
      const r = await youth.post('/api/m/language/progress', { course_id: c.id, unit_id: u.id, activity_id: a.id, score: 0.9 });
      assert.equal(r.status, 200);
    }
    const lv = (await youth.get('/api/m/language/progress?course_id=german')).body.levels.german;
    assert.equal(lv.level, 'Pre-A1', 'A1 needs the speaking task too');
    const s = await youth.post('/api/m/language/speaking', { course_id: 'german', unit_id: 'zahlen', activity_id: 's1', self_rating: 4, checks: ['clear', 'bogus'] });
    assert.equal(s.status, 200);
    assert.deepEqual(s.body.checks, ['clear']);
    assert.ok(s.body.awarded.some((a) => a.level === 'A1'), 'A1 awarded after speaking');
    const pp = await youth.get('/api/core/passport/' + dy.id);
    assert.ok(pp.body.entries.some((e) => e.ref === 'DEU.A1'));
    assert.equal((await youth.post('/api/m/language/progress', { course_id: 'german', unit_id: 'nope', activity_id: 'x' })).status, 404);
  });

  await t.test('speaking: rating + sample size limit + teacher review queue', async () => {
    const tiny = Buffer.alloc(2000, 7).toString('base64');
    const s = await youth.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'interview', activity_id: 's1', self_rating: 3, peer_rating: 4, request_review: true, share_sample: true, sample: 'data:audio/webm;base64,' + tiny });
    assert.equal(s.status, 200);
    assert.equal(s.body.has_sample, true); assert.equal(s.body.status, 'pending');
    assert.equal(s.body.sample, undefined, 'sample not echoed');
    const big = Buffer.alloc(160 * 1024, 1).toString('base64');
    assert.equal((await youth.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'interview', activity_id: 's1', self_rating: 3, share_sample: true, sample: big })).status, 413);
    assert.equal((await youth.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'interview', activity_id: 's1', self_rating: 3, share_sample: true, sample: tiny, sample_mime: 'text/html' })).status, 400);
    assert.equal((await youth.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'interview', activity_id: 's1' })).status, 400, 'self rating required');
    // without share_sample the audio is never stored
    const noShare = await youth.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'greet', activity_id: 's1', self_rating: 5, sample: tiny });
    assert.equal(noShare.body.has_sample, false);

    const q = await uoc.get('/api/m/language/review');
    assert.equal(q.status, 200);
    const mine = q.body.find((x) => x.id === s.body.id);
    assert.ok(mine, 'in UOC teacher queue');
    assert.equal(mine.sample, undefined, 'queue does not inline audio');
    const play = await uoc.get(`/api/m/language/speaking/${s.body.id}/sample`);
    assert.equal(play.status, 200); assert.equal(play.body.data, tiny);
    const rv = await uoc.post('/api/m/language/review/' + s.body.id, { rating: 4, note: 'Good structure!', discard_sample: true });
    assert.equal(rv.status, 200); assert.equal(rv.body.teacher_rating, 4); assert.equal(rv.body.status, 'reviewed');
    assert.equal((await uoc.get(`/api/m/language/speaking/${s.body.id}/sample`)).status, 404, 'sample discarded after review');
    assert.equal((await uoc.post('/api/m/language/review/' + s.body.id, { rating: 9 })).status, 200, 'rating clamped');
    const n = b.brain.store.all("SELECT * FROM notifications WHERE person_id=? AND module='language'", dy.id);
    assert.ok(n.length >= 1, 'learner notified');
  });

  await t.test('learner can delete their shared sample', async () => {
    const tiny = Buffer.alloc(500, 3).toString('base64');
    const s = await youth.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'hotel', activity_id: 's1', self_rating: 3, request_review: true, share_sample: true, sample: tiny });
    assert.equal((await uoc.del(`/api/m/language/speaking/${s.body.id}/sample`)).status, 403);
    assert.equal((await youth.del(`/api/m/language/speaking/${s.body.id}/sample`)).status, 200);
    assert.equal((await youth.get(`/api/m/language/speaking/${s.body.id}/sample`)).status, 404);
  });

  await t.test('permission denials', async () => {
    // CIF exam teacher: youth is enrolled with CIF (exams) + consent, but not in a CIF language programme in h2
    const cif = b.as('demo.teacher');
    assert.equal((await cif.get('/api/m/language/dashboard?person_id=' + dy.id)).status, 403, 'purpose limitation');
    const pend = (await youth.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'bank', activity_id: 'l1', self_rating: 2, request_review: true })).body;
    assert.equal((await cif.post('/api/m/language/review/' + pend.id, { rating: 3 })).status, 403);
    assert.ok(!(await cif.get('/api/m/language/review')).body.some((x) => x.person_id === dy.id));
    // other-agency facilitator
    assert.equal((await b.as('demo.facilitator.vjt').get('/api/m/language/dashboard?person_id=' + dy.id)).status, 403);
    // donor: no person data, can see suppressed aggregates
    const donor = b.as('demo.donor');
    assert.equal((await donor.get('/api/m/language/dashboard?person_id=' + dy.id)).status, 403);
    assert.equal((await donor.get('/api/m/language/review')).status, 403);
    assert.equal((await donor.post('/api/m/language/speaking', { course_id: 'eng-spoken', unit_id: 'greet', activity_id: 's1', self_rating: 3 })).status, 403);
    const ov = await donor.get('/api/m/language/admin/overview');
    assert.equal(ov.status, 200);
    assert.ok(ov.body.levels.every((c) => c.by.every((x) => typeof x.n !== 'number' || x.n === 0 || x.n >= 5)), 'k-anonymity');
    // another learner
    assert.equal((await b.as('demo.learner').get('/api/m/language/dashboard?person_id=' + dy.id)).status, 403);
    // UOC teacher cannot open a CIF class
    const cifLang = b.demo.programmes.find((p) => p.track === 'language' && p.agency_id === b.demo.agencyByKey.cif.id);
    assert.equal((await uoc.get('/api/m/language/teach/class/' + cifLang.id)).status, 403);
    assert.equal((await uoc.post('/api/m/language/circles', { programme_id: cifLang.id, date: '2026-12-01' })).status, 403);
  });

  await t.test('peer circles: schedule, roster, attendance', async () => {
    const progs = (await uoc.get('/api/m/language/teach/programmes')).body;
    const h2 = progs.find((p) => p.hamlet_id === dy.hamlet_id);
    assert.ok(h2);
    const c = await uoc.post('/api/m/language/circles', { programme_id: h2.id, date: new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10), roleplay_id: 'interview' });
    assert.equal(c.status, 200); assert.equal(c.body.roleplay_id, 'interview');
    const roster = await uoc.get(`/api/m/language/circles/${c.body.id}/roster`);
    assert.ok(roster.body.roster.some((x) => x.person_id === dy.id));
    const att = await uoc.post(`/api/m/language/circles/${c.body.id}/attendance`, { marks: [{ person_id: dy.id, present: true, role: 'interviewer' }] });
    assert.equal(att.body.marked, 1);
    const mine = await youth.get('/api/m/language/circles');
    assert.equal(mine.body.find((x) => x.id === c.body.id).me, 1);
    const cls = await uoc.get('/api/m/language/teach/class/' + h2.id);
    assert.equal(cls.status, 200);
    assert.ok(cls.body.learners.some((l) => l.id === dy.id));
  });

  await t.test('mother-tongue bridge: community draft, attribution, review rules', async () => {
    const list = await youth.get('/api/m/language/bridge?language=Irula');
    assert.equal(list.status, 200);
    assert.ok(/community/i.test(list.body.disclaimer));
    assert.ok(list.body.words.every((w) => w.status_label && w.contributor));
    assert.ok(list.body.words.filter((w) => w.demo).every((w) => w.word.startsWith('⟨demo⟩')), 'demo entries are visibly marked');
    const add = await youth.post('/api/m/language/bridge', { language: 'Irula', en: 'water', word: 'test-word' });
    assert.equal(add.status, 200); assert.equal(add.body.status, 'draft'); assert.equal(add.body.ml, 'വെള്ളം');
    assert.ok(add.body.contributor_name.includes(dy.name.split(' ')[0]), 'attributed');
    assert.equal((await youth.post('/api/m/language/bridge', { language: 'Klingon', en: 'water', word: 'x' })).status, 400);
    assert.equal((await youth.post(`/api/m/language/bridge/${add.body.id}/review`, { verdict: 'community_checked' })).status, 403, 'learner cannot review');
    const rv = await uoc.post(`/api/m/language/bridge/${add.body.id}/review`, { verdict: 'community_checked', note: 'ok' });
    assert.equal(rv.status, 200); assert.equal(rv.body.status, 'community_checked');
    assert.equal((await b.as('demo.donor').post('/api/m/language/bridge', { language: 'Irula', en: 'water', word: 'x' })).status, 403);
  });

  await t.test('consent revoked → learner disappears from teacher views', async () => {
    const consent = b.brain.store.one("SELECT * FROM consents WHERE person_id=? AND agency_id=? AND status='active' AND deleted=0", dy.id, b.demo.agencyByKey.uoc.id);
    assert.equal((await youth.post(`/api/core/consents/${consent.id}/revoke`, {})).status, 200);
    const h2 = (await uoc.get('/api/m/language/teach/programmes')).body.find((p) => p.hamlet_id === dy.hamlet_id);
    const cls = await uoc.get('/api/m/language/teach/class/' + h2.id);
    assert.ok(!cls.body.learners.some((l) => l.id === dy.id));
    assert.ok(cls.body.hidden_without_consent >= 1);
    assert.ok(!(await uoc.get('/api/m/language/review')).body.some((x) => x.person_id === dy.id), 'not in review queue');
    assert.equal((await uoc.get('/api/m/language/dashboard?person_id=' + dy.id)).status, 403);
    assert.equal((await youth.get('/api/m/language/dashboard')).status, 200, 'learner keeps own data');
  });
});
