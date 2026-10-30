'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');

const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

test('counselling', async (t) => {
  const d = await bootDemo();
  t.after(() => d.close());
  await tick();
  const B = '/api/m/counselling';
  const youth = d.demo.demoYouth;

  await t.test('pathways: ~12+ realistic pathways, police has physical test', async () => {
    const r = await d.as('demo.youth').get(B + '/pathways');
    assert.ok(r.body.pathways.length >= 12);
    const police = r.body.pathways.find((p) => p.key === 'police');
    assert.ok(police.steps.some((s) => /Physical/i.test(s.label)));
    const a = await d.as('demo.youth').get(B + '/aspirations/' + youth.id);
    assert.equal(a.status, 200);
    assert.ok(a.body.pathways.some((p) => p.key === 'police'));
    const put = await d.as('demo.youth').put(B + '/aspirations/' + youth.id, { pathway_keys: ['police', 'forest'], dream: 'Serve my ooru' });
    assert.deepEqual(put.body.pathway_keys, ['police', 'forest']);
  });

  await t.test('demo youth has a mentor; chat delivers benign messages', async () => {
    const me = await d.as('demo.youth').get(B + '/me');
    assert.ok(me.body.match, 'demo youth matched');
    const r = await d.as('demo.youth').post(B + `/matches/${me.body.match.id}/messages`, { body: 'Thank you sir, I ran 1.5 km in 9 minutes today.' });
    assert.equal(r.body.status, 'delivered');
  });

  await t.test('mentor message with a phone number is held and reaches moderation', async () => {
    const list = await d.as('demo.mentor').get(B + '/matches');
    const mt = list.body.find((m) => m.person_id === youth.id && m.status === 'active');
    assert.ok(mt);
    const r = await d.as('demo.mentor').post(B + `/matches/${mt.id}/messages`, { body: 'Call me at 98470 55555 tonight' });
    assert.equal(r.body.held, true);
    assert.ok(r.body.reasons.includes('contact_number'));
    // learner does not see the held text
    const lv = await d.as('demo.youth').get(B + `/matches/${mt.id}/messages`);
    assert.ok(!lv.body.messages.some((m) => m.body && m.body.includes('98470')));
    await tick(150);
    const q = await d.as('demo.cpo').get('/api/m/safeguarding/moderation');
    const held = q.body.find((x) => x.ref_id === r.body.id);
    assert.ok(held, 'held message in safeguarding queue');
    // CPO approves → released; reject path tested in safeguarding tests
    await d.as('demo.cpo').post(`/api/m/safeguarding/moderation/${held.id}/decide`, { decision: 'reject' });
    await tick(150);
    const sv = await d.as('demo.counsellor').get(B + `/matches/${mt.id}/messages`);
    assert.equal(sv.body.supervised, true);
    assert.equal(sv.body.messages.find((m) => m.id === r.body.id).status, 'rejected');
  });

  await t.test('adult↔minor chat visible to CPO + counsellor supervisor, not to facilitator or other mentors', async () => {
    const all = await d.as('demo.cpo').get(B + '/matches');
    const minor = all.body.find((m) => Number(m.minor) === 1);
    assert.ok(minor, 'seeded adult-minor match');
    assert.equal((await d.as('demo.cpo').get(B + `/matches/${minor.id}/messages`)).status, 200);
    assert.equal((await d.as('demo.counsellor').get(B + `/matches/${minor.id}/messages`)).status, 200);
    assert.equal((await d.as('demo.facilitator').get(B + `/matches/${minor.id}/messages`)).status, 403);
    assert.equal((await d.as('demo.mentor').get(B + `/matches/${minor.id}/messages`)).status, 403);
    assert.equal((await d.as('demo.facilitator').get(B + '/matches')).status, 403);
    assert.equal((await d.as('demo.mentor').post(B + `/matches/${minor.id}/messages`, { body: 'hi' })).status, 403);
  });

  await t.test('wellbeing pulse: low mood creates a follow-up task; need_talk escalates', async () => {
    const r = await d.as('demo.youth').post(B + '/pulse', { mood: 2 });
    assert.equal(r.body.follow_up, true);
    const r2 = await d.as('demo.learner').post(B + '/pulse', { mood: 1, need_talk: true });
    assert.equal(r2.body.follow_up, true);
    assert.equal(r2.body.escalated, true);
    await tick(150);
    const cases = await d.as('demo.cpo').get('/api/m/safeguarding/cases');
    assert.ok(cases.body.some((c) => c.person_id === d.demo.demoLearner.id && c.source === 'counselling'));
    const me = await d.as('demo.youth').get(B + '/pulse/me');
    assert.ok(me.body.today);
  });

  await t.test('non-counsellors cannot see individual wellbeing; aggregates are k-anonymised', async () => {
    for (const u of ['demo.facilitator', 'demo.teacher', 'demo.mentor', 'demo.cif.admin', 'demo.donor', 'demo.guardian']) {
      const r = await d.as(u).get(B + '/wellbeing/' + youth.id);
      assert.equal(r.status, 403, u + ' must not see individual wellbeing');
    }
    assert.equal((await d.as('demo.youth').get(B + '/wellbeing/' + youth.id)).status, 200);
    const agg = await d.as('demo.donor').get(B + '/wellbeing-summary');
    assert.equal(agg.status, 200);
    assert.equal(agg.body.k, 5);
    for (const h of agg.body.by_hamlet) {
      if (h.suppressed) assert.equal(h.learners, '<5');
      else assert.ok(h.learners >= 5);
      assert.equal(h.person_id, undefined);
    }
    assert.equal((await d.as('demo.donor').get(B + '/caseload')).status, 403);
    assert.equal((await d.as('demo.facilitator').get(B + '/caseload')).status, 403);
  });

  await t.test('counsellor caseload, private session notes, tasks', async () => {
    const cl = await d.as('demo.counsellor').get(B + '/caseload');
    assert.equal(cl.status, 200);
    assert.ok(cl.body.length > 0);
    const pid = cl.body[0].id;
    const s = await d.as('demo.counsellor').post(B + '/sessions', { person_id: pid, topic: 'career', notes: 'Private note', follow_up: 'Check docs', follow_up_date: '2026-12-01' });
    assert.equal(s.status, 200);
    const sv = await d.as('demo.counsellor').get(B + '/sessions/' + pid);
    assert.ok(sv.body.some((x) => x.notes === 'Private note'));
    const tasks = await d.as('demo.counsellor').get(B + '/tasks');
    assert.ok(tasks.body.length > 0);
  });

  await t.test('matching respects safeguarding training and consent', async () => {
    const mentors = await d.as('demo.counsellor').get(B + '/mentors');
    const untrained = mentors.body.find((m) => !m.trained);
    assert.ok(untrained);
    const cl = await d.as('demo.counsellor').get(B + '/caseload');
    const free = cl.body.find((x) => !x.mentor);
    if (free) {
      const r = await d.as('demo.counsellor').post(B + '/matches', { person_id: free.id, mentor_id: untrained.id });
      assert.equal(r.status, 409);
      const sug = await d.as('demo.counsellor').get(B + '/matches/suggest/' + free.id);
      assert.ok(Array.isArray(sug.body));
      assert.ok(!sug.body.some((m) => m.id === untrained.id));
    }
    assert.equal((await d.as('demo.facilitator').post(B + '/matches', { person_id: youth.id, mentor_id: untrained.id })).status, 403);
  });
});
