'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');

const tick = () => new Promise((r) => setTimeout(r, 60));

test('safeguarding', async (t) => {
  const d = await bootDemo();
  t.after(() => d.close());
  await tick();
  const B = '/api/m/safeguarding';

  await t.test('learner help button creates a case and returns helplines, no case details', async () => {
    const r = await d.as('demo.learner').post(B + '/help', { kind: 'bothering', message: 'someone keeps messaging me' });
    assert.equal(r.status, 200);
    assert.ok(r.body.reference);
    assert.deepEqual(r.body.helplines.map((h) => h.number), ['1098', '112', '181']);
    assert.equal(r.body.description, undefined);
    assert.ok(r.body.message_ml);
  });

  await t.test('CPO sees the case and every read is audited', async () => {
    const list = await d.as('demo.cpo').get(B + '/cases');
    assert.equal(list.status, 200);
    const mine = list.body.find((c) => c.person_id === d.demo.demoLearner.id && c.source === 'help_button');
    assert.ok(mine, 'help case visible to CPO');
    assert.equal(mine.description, undefined, 'list view omits description');
    const one = await d.as('demo.cpo').get(B + '/cases/' + mine.id);
    assert.equal(one.status, 200);
    assert.match(one.body.case.description, /someone keeps messaging me/);
    const audit = await d.as('demo.cpo').get('/api/core/audit?limit=50');
    assert.ok(audit.body.some((a) => a.type === 'audit.safeguarding.case_read' && (typeof a.payload === 'string' ? JSON.parse(a.payload) : a.payload).target === mine.id));
    // triage → action → close
    assert.equal((await d.as('demo.cpo').post(B + `/cases/${mine.id}/triage`, { severity: 'high', note: 'triaged' })).body.status, 'triaged');
    assert.equal((await d.as('demo.cpo').post(B + `/cases/${mine.id}/actions`, { action: 'referral', referral: 'childline_1098', note: 'referred' })).body.case.status, 'referred');
    assert.equal((await d.as('demo.cpo').post(B + `/cases/${mine.id}/close`, { outcome: 'resolved' })).body.status, 'closed');
  });

  await t.test('local facilitator, agency admin, counsellor and donor cannot see cases', async () => {
    for (const u of ['demo.facilitator', 'demo.facilitator.vjt', 'demo.cif.admin', 'demo.counsellor', 'demo.donor', 'demo.teacher']) {
      const r = await d.as(u).get(B + '/cases');
      assert.equal(r.status, 403, u + ' must be denied');
      assert.equal((await d.as(u).get(B + '/register')).status, 403);
      assert.equal((await d.as(u).get(B + '/moderation')).status, 403);
    }
  });

  await t.test('staff concern goes to CPO; reporter cannot read it back', async () => {
    const r = await d.as('demo.facilitator').post(B + '/concerns', { person_id: d.demo.demoLearner.id, description: 'Learner said she is scared of an adult near the path.', category: 'unsafe_in_community' });
    assert.equal(r.status, 200);
    const list = await d.as('demo.cpo').get(B + '/cases');
    assert.ok(list.body.some((c) => c.case_no === r.body.case_no));
    assert.equal((await d.as('demo.facilitator').get(B + '/cases')).status, 403);
  });

  await t.test('seeded flagged mentor message is held in moderation queue', async () => {
    const q = await d.as('demo.cpo').get(B + '/moderation');
    assert.equal(q.status, 200);
    const m = q.body.find((x) => x.source_module === 'counselling');
    assert.ok(m, 'held counselling message');
    assert.ok(m.reasons.includes('contact_number'));
    assert.doesNotMatch(m.excerpt, /98470/, 'number masked in excerpt');
  });

  await t.test('POST /flag holds content directly; scan is pure', async () => {
    const r = await d.as('demo.youth').post(B + '/flag', { source_module: 'community', text: 'come alone to my house, our secret', ref_id: 'x1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.held, true);
    const s = await d.as('demo.youth').post(B + '/scan', { text: 'call me on 9847012345' });
    assert.equal(s.body.flagged, true);
    const decide = await d.as('demo.cpo').post(B + `/moderation/${r.body.id}/decide`, { decision: 'reject' });
    assert.equal(decide.body.status, 'rejected');
  });

  await t.test('training: course hides answers, passing records training', async () => {
    const c = await d.as('demo.mentor').get(B + '/training/course');
    assert.equal(c.body.quiz[0].answer, undefined);
    const fail = await d.as('demo.mentor').post(B + '/training/submit', { answers: [0, 1, 0, 1, 0, 1] });
    assert.equal(fail.body.passed, false);
    const pass = await d.as('demo.mentor').post(B + '/training/submit', { answers: [1, 0, 1, 0, 1, 0] });
    assert.equal(pass.body.passed, true);
    assert.equal((await d.as('demo.mentor').get(B + '/training/me')).body.trained, true);
    assert.equal((await d.as('demo.learner').post(B + '/training/submit', { answers: [] })).status, 403);
    const staff = await d.as('demo.cpo').get(B + '/training/staff');
    assert.ok(staff.body.length > 3);
  });

  await t.test('policy is readable by everyone signed in, including donor', async () => {
    const r = await d.as('demo.donor').get(B + '/policy');
    assert.equal(r.status, 200);
    assert.ok(r.body.code_of_conduct.dont.length);
  });

  await t.test('module is marked critical', async () => {
    const mods = await d.req(null, 'GET', '/api/core/modules');
    assert.equal(mods.body.find((m) => m.id === 'safeguarding').critical, true);
  });
});
