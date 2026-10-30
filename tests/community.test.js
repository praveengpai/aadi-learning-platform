'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bootDemo } = require('./helpers');

test('community module', async (t) => {
  const app = await bootDemo();
  t.after(() => app.close());
  const { demo } = app;
  const H = demo.hamletByKey, A = demo.agencyByKey;

  await t.test('seed is rich', async () => {
    const st = (await app.as('demo.steward').get('/api/m/community/content/stats')).body;
    assert.ok(st.total >= 40, 'at least 40 cultural contributions, got ' + st.total);
    const n = (await app.as('demo.steward').get('/api/m/community/notices')).body;
    assert.ok(n.length >= 50);
    const m = (await app.as('demo.steward').get('/api/m/community/meetings')).body;
    assert.ok(m.some((x) => x.status === 'held' && x.minutes && x.actions.length));
  });

  await t.test('guardian sees only own wards', async () => {
    const r = await app.as('demo.guardian').get('/api/m/community/family');
    assert.equal(r.status, 200);
    const ids = r.body.members.map((m) => m.id);
    assert.ok(ids.includes(demo.demoLearner.id), 'own ward visible');
    const wards = demo.persons.filter((p) => p.guardian_id === demo.demoGuardian.id).map((p) => p.id);
    for (const id of ids) assert.ok(id === demo.demoGuardian.id || wards.includes(id), 'no stranger in family list');
    const other = demo.children.find((c) => c.guardian_id !== demo.demoGuardian.id);
    const r2 = await app.as('demo.guardian').get('/api/m/community/family/' + other.id);
    assert.equal(r2.status, 403);
  });

  await t.test('guardian revokes consent → facilitator loses visibility; re-grant restores', async () => {
    const pid = demo.demoLearner.id;
    const before = await app.as('demo.facilitator').get('/api/core/persons/' + pid);
    assert.equal(before.status, 200, 'facilitator sees the learner before revocation');
    const fam = (await app.as('demo.guardian').get('/api/m/community/family/' + pid)).body;
    const cif = fam.agencies.find((a) => a.id === A.cif.id);
    assert.ok(cif && cif.consent, 'active CIF consent shown in consent centre');
    assert.ok(fam.can_manage_consent);
    const rv = await app.as('demo.guardian').post('/api/core/consents/' + cif.consent.id + '/revoke');
    assert.equal(rv.status, 200);
    const after = await app.as('demo.facilitator').get('/api/core/persons/' + pid);
    assert.equal(after.status, 403, 'facilitator loses visibility');
    const fam2 = (await app.as('demo.guardian').get('/api/m/community/family/' + pid)).body;
    assert.equal(fam2.agencies.find((a) => a.id === A.cif.id).consent, null);
    const g = await app.as('demo.guardian').post('/api/core/consents', { person_id: pid, agency_id: A.cif.id, scopes: ['profile', 'progress'] });
    assert.equal(g.status, 200);
    assert.equal((await app.as('demo.facilitator').get('/api/core/persons/' + pid)).status, 200);
  });

  await t.test('community-only content hidden from other hamlets', async () => {
    const all = (await app.as('demo.steward').get('/api/m/community/content?status=published&licence=community')).body;
    const h1Item = all.find((c) => c.hamlet_id === H.h1.id);
    const h2Item = all.find((c) => c.hamlet_id === H.h2.id);
    assert.ok(h1Item && h2Item);
    // facilitator2 serves only Thenmala (h2)
    const f2 = (await app.as('demo.facilitator2').get('/api/m/community/content')).body.map((c) => c.id);
    assert.ok(f2.includes(h2Item.id));
    assert.ok(!f2.includes(h1Item.id), 'h1 community-only item hidden from h2 staff');
    assert.equal((await app.as('demo.facilitator2').get('/api/m/community/content/' + h1Item.id)).status, 404);
    // the h1 guardian (member) sees it, donor never does
    const g = (await app.as('demo.guardian').get('/api/m/community/content')).body.map((c) => c.id);
    assert.ok(g.includes(h1Item.id));
    assert.ok(!g.includes(h2Item.id));
    const d = (await app.as('demo.donor').get('/api/m/community/content')).body;
    assert.ok(d.length > 0 && d.every((c) => c.licence !== 'community' && c.status === 'published'));
  });

  await t.test('content submission → review → publish workflow', async () => {
    const r = await app.as('demo.learner').post('/api/m/community/content', { kind: 'story', title: 'My grandmother\'s seed pot', body: 'An original story I wrote.', licence: 'community', original_confirmed: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'submitted');
    assert.equal(r.body.hamlet_id, H.h1.id);
    const ret = await app.as('demo.facilitator').post(`/api/m/community/content/${r.body.id}/review`, { decision: 'return' });
    assert.equal(ret.status, 400, 'return needs a note');
    const vjtOtherHamlet = await app.as('demo.facilitator2').post(`/api/m/community/content/${r.body.id}/review`, { decision: 'publish' });
    assert.equal(vjtOtherHamlet.status, 403);
    const pub = await app.as('demo.facilitator').post(`/api/m/community/content/${r.body.id}/review`, { decision: 'publish' });
    assert.equal(pub.status, 200);
    assert.equal(pub.body.status, 'published');
    assert.ok(pub.body.credits > 0);
    const ev = app.brain.store.one('SELECT COUNT(*) n FROM events WHERE type=\'community.content_submitted\'');
    assert.ok(ev.n >= 1);
    const noOrig = await app.as('demo.learner').post('/api/m/community/content', { kind: 'song', title: 'x', body: 'y' });
    assert.equal(noOrig.status, 400);
  });

  await t.test('other agency cannot post notices in a hamlet it does not serve', async () => {
    // Vanajyothi serves h1 but not h2
    const bad = await app.as('demo.facilitator.vjt').post('/api/m/community/notices', { hamlet_id: H.h2.id, title: 'Test', body: 'Body' });
    assert.equal(bad.status, 403);
    const ok = await app.as('demo.facilitator.vjt').post('/api/m/community/notices', { hamlet_id: H.h1.id, title: 'Reading circle moved', title_ml: 'വായനക്കൂട്ടം മാറ്റി', body: 'Saturday 10 am', category: 'event' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.agency_id, A.vjt.id);
    // CIF facilitator cannot edit a VJT notice
    assert.equal((await app.as('demo.facilitator').put('/api/m/community/notices/' + ok.body.id, { title: 'hijack' })).status, 403);
    assert.equal((await app.as('demo.guardian').post('/api/m/community/notices', { hamlet_id: H.h1.id, title: 'x', body: 'y' })).status, 403);
    // guardian sees h1 notices only
    const gn = (await app.as('demo.guardian').get('/api/m/community/notices')).body;
    assert.ok(gn.length && gn.every((n) => n.hamlet_id === H.h1.id));
  });

  await t.test('meetings and coordination threads', async () => {
    const m = await app.as('demo.facilitator').post('/api/m/community/meetings', { hamlet_id: H.h1.id, title: 'Special Oorukoottam', date: '2026-12-01', agenda: 'Water\nRoad' });
    assert.equal(m.status, 200);
    assert.equal(m.body.agenda.length, 2);
    assert.equal((await app.as('demo.facilitator2').post('/api/m/community/meetings', { hamlet_id: H.h1.id, title: 'x', date: '2026-12-01' })).status, 403);
    const s = await app.as('demo.guardian').post(`/api/m/community/meetings/${m.body.id}/suggest`, { text: 'Bus stop shelter' });
    assert.equal(s.status, 200);
    assert.equal(s.body.agenda.length, 3);
    const a = await app.as('demo.facilitator').post(`/api/m/community/meetings/${m.body.id}/actions`, { text: 'Write to panchayat' });
    assert.equal(a.body.actions.length, 1);

    const th = await app.as('demo.facilitator').post('/api/m/community/threads', { hamlet_id: H.h1.id, topic: 'Tuition split', body: 'Proposal', kind: 'overlap', track: 'tuition', agency_ids: [A.vjt.id] });
    assert.equal(th.status, 200);
    assert.deepEqual(th.body.agency_ids.sort(), [A.cif.id, A.vjt.id].sort());
    const rep = await app.as('demo.facilitator.vjt').post(`/api/m/community/threads/${th.body.id}/posts`, { body: 'Agreed' });
    assert.equal(rep.status, 200);
    assert.equal((await app.as('demo.facilitator2').get('/api/m/community/threads?hamlet_id=' + H.h1.id)).status, 403);
    const list = (await app.as('demo.facilitator.vjt').get('/api/m/community/threads?hamlet_id=' + H.h1.id)).body;
    const mine = list.find((x) => x.id === th.body.id);
    assert.equal(mine.posts.length, 2);
    assert.equal(mine.status, 'discussing');
    const ov = (await app.as('demo.coordinator').get('/api/m/community/coordination/overview')).body;
    assert.deepEqual(ov.map((h) => h.id).sort(), [H.h1.id, H.h9.id].sort());
  });
});
