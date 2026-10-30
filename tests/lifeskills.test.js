'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');

test('lifeskills', async (t) => {
  const d = await bootDemo();
  t.after(() => d.close());
  const B = '/api/m/lifeskills';
  const kid = d.demo.demoLearner;
  const youth = d.demo.demoYouth;

  await t.test('catalog lists 9 modules incl. mandatory digital citizenship; quiz answers hidden', async () => {
    const c = await d.as('demo.learner').get(B + '/catalog');
    assert.equal(c.status, 200);
    assert.ok(c.body.modules.length >= 9);
    assert.ok(c.body.modules.find((m) => m.key === 'digital_citizenship').mandatory);
    const m = await d.as('demo.learner').get(B + '/modules/rights');
    assert.equal(m.body.quiz[0].answer, undefined);
    assert.ok(m.body.lessons[0].points_ml.length);
  });

  await t.test('gate: demo child starts not passed; other modules locked until gate passed', async () => {
    const g = await d.as('demo.learner').get(B + '/gate/' + kid.id);
    assert.equal(g.status, 200);
    assert.equal(g.body.passed, false);
    const locked = await d.as('demo.learner').post(B + `/progress/${kid.id}/rights/quiz`, { answers: [1, 1, 0] });
    assert.equal(locked.status, 409);
  });

  await t.test('happy path: lessons + scenario + quiz → gate passed, passport awarded', async () => {
    const mod = (await d.as('demo.learner').get(B + '/modules/digital_citizenship')).body;
    for (const l of mod.lessons) assert.equal((await d.as('demo.learner').post(B + `/progress/${kid.id}/digital_citizenship/lesson`, { lesson_id: l.id })).status, 200);
    const sc = await d.as('demo.learner').post(B + `/progress/${kid.id}/digital_citizenship/scenario`, { choices: [1, 0] });
    assert.equal(sc.status, 200);
    assert.ok(sc.body.max > 0);
    const q = await d.as('demo.learner').post(B + `/progress/${kid.id}/digital_citizenship/quiz`, { answers: [1, 1, 0, 1] });
    assert.equal(q.body.passed, true);
    assert.ok(q.body.awards.includes('DIG.1'));
    const g = await d.as('demo.facilitator').get(B + '/gate/' + kid.id);
    assert.equal(g.body.passed, true);
    const pp = await d.as('demo.learner').get('/api/core/passport/' + kid.id);
    assert.ok(pp.body.entries.some((e) => e.ref === 'DIG.1'));
  });

  await t.test('documents: status only, rejects ID numbers, reminders queue notifications', async () => {
    const docs = await d.as('demo.youth').get(B + '/documents/' + youth.id);
    assert.equal(docs.body.documents.length, 8);
    const bad = await d.as('demo.youth').put(B + `/documents/${youth.id}/aadhaar`, { status: 'have', note: '1234 5678 9012' });
    assert.equal(bad.status, 400);
    const ok = await d.as('demo.youth').put(B + `/documents/${youth.id}/pan`, { status: 'applied', note: 'Applied at Akshaya' });
    assert.equal(ok.body.status, 'applied');
    const rem = await d.as('demo.facilitator2').post(B + '/documents/remind', { person_id: youth.id });
    assert.equal(rem.status, 200);
    assert.equal(rem.body.reminded, 1);
  });

  await t.test('soft skills: self + facilitator ratings', async () => {
    const self = await d.as('demo.youth').post(B + '/softskills/' + youth.id, { ratings: { communication: 3, teamwork: 4, punctuality: 3, confidence: 2 } });
    assert.equal(self.body.rater_role, 'self');
    const fac = await d.as('demo.facilitator2').post(B + '/softskills/' + youth.id, { ratings: { communication: 3, teamwork: 3, punctuality: 4, confidence: 3, presentation: 3 } });
    assert.equal(fac.body.rater_role, 'facilitator');
    const s = await d.as('demo.youth').get(B + '/softskills/' + youth.id);
    assert.ok(s.body.self && s.body.facilitator);
  });

  await t.test('permissions: other agency facilitator, donor and other learner denied person data', async () => {
    assert.equal((await d.as('demo.facilitator.vjt').get(B + '/progress/' + youth.id)).status, 403);
    assert.equal((await d.as('demo.donor').get(B + '/progress/' + youth.id)).status, 403);
    assert.equal((await d.as('demo.donor').get(B + '/gate/' + youth.id)).status, 403);
    assert.equal((await d.as('demo.learner').get(B + '/documents/' + youth.id)).status, 403);
    assert.equal((await d.as('demo.donor').get(B + '/cohort')).status, 403);
    const st = await d.as('demo.donor').get(B + '/stats');
    assert.equal(st.status, 200);
    for (const m of st.body.by_module) assert.ok(typeof m.passed === 'string' ? m.passed === '<5' : m.passed === 0 || m.passed >= 5);
  });

  await t.test('cohort: facilitator sees only consented learners; consent revoke removes them', async () => {
    const c = await d.as('demo.facilitator').get(B + '/cohort');
    assert.equal(c.status, 200);
    assert.ok(c.body.length > 0);
    const target = c.body[0];
    const cons = d.brain.store.find('consents', { person_id: target.id, agency_id: d.demo.agencyByKey.cif.id, status: 'active' })[0];
    d.brain.revokeConsent(cons.id, null);
    const c2 = await d.as('demo.facilitator').get(B + '/cohort');
    assert.ok(!c2.body.some((x) => x.id === target.id));
    assert.equal((await d.as('demo.facilitator').get(B + '/progress/' + target.id)).status, 403);
  });
});
