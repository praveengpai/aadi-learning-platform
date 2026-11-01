'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');

let N, ch;
test.before(async () => { N = await bootDemo(); ch = N.host.modules.get('channels').api; });
test.after(async () => { await N.close(); });

test('core notifications are captured into the outbox and delivered by the simulator', async () => {
  const { brain, demo } = N;
  const p = demo.demoYouth;
  const n = brain.notify(p.id, 'Test: class at 4 PM', { channel: 'auto', module: 'test' }, demo.users.steward);
  await new Promise((r) => setTimeout(r, 30)); // event handlers run on setImmediate
  const ob = brain.store.one('SELECT * FROM channels_outbox WHERE notification_id=?', n.id);
  assert.ok(ob, 'mirrored into outbox');
  // The background worker may already have delivered it under load; either way it must move on.
  assert.ok(['queued', 'sent', 'retry', 'failed'].includes(ob.status));
  if (ob.status === 'queued') {
    const out = await ch.processOutbox();
    assert.ok(out.sent + out.retry + out.failed >= 1 || brain.store.get('channels_outbox', ob.id).status !== 'queued');
  }
  const after = brain.store.get('channels_outbox', ob.id);
  assert.ok(['sent', 'retry', 'failed'].includes(after.status));
  const d = brain.store.find('channels_deliveries', { outbox_id: ob.id });
  assert.ok(d.length >= 1);
  assert.equal(d[0].provider, 'simulator');
  // retry until done
  for (let i = 0; i < 3 && brain.store.get('channels_outbox', ob.id).status === 'retry'; i++) await ch.processOutbox();
  const final = brain.store.get('channels_outbox', ob.id).status;
  assert.ok(['sent', 'failed'].includes(final));
  const core = brain.store.get('notifications', n.id).status;
  assert.equal(core, final === 'sent' ? (d[0].channel === 'app' ? 'delivered' : 'sent') : 'failed', 'core notification row marked');
});

test('notifications queued before the subscriber saw them are swept in', async () => {
  const { brain, demo } = N;
  // write a queued row directly (as if synced from a hub) — no row.upsert handler involvement guaranteed
  const n = brain.store.put('notifications', { person_id: demo.demoYouth.id, hamlet_id: demo.demoYouth.hamlet_id, channel: 'sms', message: 'from hub', status: 'queued', module: 'hub', created_at: new Date().toISOString() });
  brain.store.db.prepare('DELETE FROM channels_outbox WHERE notification_id=?').run(n.id);
  await ch.processOutbox({ limit: 2000 });
  for (let i = 0; i < 3 && brain.store.get('notifications', n.id).status === 'queued'; i++) await ch.processOutbox({ limit: 2000 });
  assert.notEqual(brain.store.get('notifications', n.id).status, 'queued');
});

test('a child without a phone is reached through the guardian; process endpoint is staff-only', async () => {
  const { brain, demo } = N;
  const child = demo.children.find((c) => !c.phone && c.guardian_id && brain.store.get('persons', c.guardian_id).phone);
  brain.notify(child.id, 'Hello guardian', {}, null);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal((await N.as('demo.learner').post('/api/m/channels/process', {})).status, 403);
  const r = await N.as('demo.steward').post('/api/m/channels/process', {});
  assert.equal(r.status, 200);
  const d = brain.store.all('SELECT * FROM channels_deliveries WHERE person_id=? ORDER BY at DESC', child.id)[0];
  assert.ok(d);
  if (d.channel !== 'app') assert.equal(d.to_relation, 'guardian');
});

test('broadcast only reaches contact-consented learners the sender can see', async () => {
  const { brain, demo } = N;
  const fac = demo.users.facilitator;
  const h1 = demo.hamletByKey.h1.id;
  const r = await N.as('demo.facilitator').post('/api/m/channels/broadcasts', { hamlet_id: h1, title: 'Test', message: 'Centre closed tomorrow', message_ml: 'നാളെ കേന്ദ്രം അവധി' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.queued > 0);
  const rows = brain.store.find('channels_outbox', { ref_id: r.body.broadcast_id });
  assert.equal(rows.length, r.body.queued);
  for (const o of rows) {
    assert.ok(brain.policy.activeConsent(o.person_id, fac.agency_id, 'contact'), 'contact consent');
    assert.ok(brain.policy.canSee(fac, o.person_id, 'profile').ok, 'visible to sender');
  }
  // revoke contact consent of one recipient → excluded next time
  const victim = rows[0].person_id;
  const c = brain.store.find('consents', { person_id: victim, agency_id: fac.agency_id, status: 'active' })[0];
  brain.grantConsent({ person_id: victim, agency_id: fac.agency_id, scopes: c.scopes.filter((s) => s !== 'contact'), granted_by: c.granted_by, relation: c.relation }, demo.users.steward);
  const r2 = await N.as('demo.facilitator').post('/api/m/channels/broadcasts', { hamlet_id: h1, message: 'Second' });
  const rows2 = brain.store.find('channels_outbox', { ref_id: r2.body.broadcast_id });
  assert.ok(!rows2.some((o) => o.person_id === victim));
  assert.equal(r2.body.skipped_no_consent, r.body.skipped_no_consent + 1);
  // delivery stats
  await ch.processOutbox({ limit: 2000 });
  const list = await N.as('demo.facilitator').get('/api/m/channels/broadcasts');
  const mine = list.body.find((b) => b.id === r.body.broadcast_id);
  assert.ok(mine.delivered > 0);
  // other agency's programme refused; donor refused
  const vjtProg = demo.programmes.find((p) => p.agency_id === demo.agencyByKey.vjt.id);
  assert.equal((await N.as('demo.facilitator').post('/api/m/channels/broadcasts', { programme_id: vjtProg.id, message: 'x' })).status, 403);
  assert.equal((await N.as('demo.donor').post('/api/m/channels/broadcasts', { hamlet_id: h1, message: 'x' })).status, 403);
});

test('SMS quiz reply is scored once per day and credited', async () => {
  const { demo } = N;
  const pid = demo.demoYouth.id;
  const q = await N.as('demo.youth').get('/api/m/channels/quiz');
  assert.equal(q.status, 200);
  assert.equal(q.body.today.answer, undefined, 'answer hidden from learners');
  const ans = N.brain.store.get('channels_quiz', q.body.today.id).answer;
  const r = await N.as('demo.youth').post('/api/m/channels/sms/inbound', { body: `QUIZ ${ans + 1}` });
  assert.equal(r.status, 200);
  assert.equal(r.body.parsed.kind, 'quiz');
  assert.equal(r.body.parsed.correct, true);
  const again = await N.as('demo.youth').post('/api/m/channels/sms/inbound', { body: 'QUIZ 1' });
  assert.equal(again.body.parsed.duplicate, true);
  const phone = await N.as('demo.youth').get('/api/m/channels/phone/' + pid);
  assert.equal(phone.status, 200);
  assert.ok(phone.body.points.p >= 10);
  assert.ok(phone.body.inbox.some((m) => /Correct/.test(m.message)));
});

test('feature phone + IVR respect consent', async () => {
  const { brain, demo } = N;
  // learner cannot open someone else's phone
  const other = demo.persons.find((p) => p.id !== demo.demoLearner.id && p.id !== demo.demoLearner.guardian_id);
  assert.equal((await N.as('demo.learner').get('/api/m/channels/phone/' + other.id)).status, 403);
  // guardian can open the ward's phone and call IVR
  const g = await N.as('demo.guardian').post('/api/m/channels/ivr/call', { person_id: demo.demoLearner.id, digits: '1', lang: 'ml' });
  assert.equal(g.status, 200);
  assert.equal(g.body.outcome, 'attendance');
  assert.ok(g.body.say.length >= 2);
  const cb = await N.as('demo.guardian').post('/api/m/channels/ivr/call', { person_id: demo.demoLearner.id, digits: '9' });
  assert.equal(cb.body.outcome, 'callback');
  // facilitator of another agency without contact consent cannot open the phone
  const fac = demo.users['facilitator.vjt'];
  const hidden = demo.persons.find((p) => !brain.policy.canSee(fac, p.id, 'contact').ok);
  assert.equal((await N.as('demo.facilitator.vjt').get('/api/m/channels/phone/' + hidden.id)).status, 403);
  const people = await N.as('demo.facilitator.vjt').get('/api/m/channels/phone/people');
  for (const p of people.body) assert.ok(brain.policy.canSee(fac, p.id, 'contact').ok);
});

test('guardian weekly digest is queued only for consented wards', async () => {
  const { brain, demo } = N;
  const fac = demo.users.facilitator;
  const r = await N.as('demo.facilitator').post('/api/m/channels/digest/run', {});
  assert.equal(r.status, 200);
  assert.ok(r.body.queued > 0);
  assert.ok(r.body.preview[0].message.startsWith(brain.brand.short));
  const rows = brain.store.find('channels_outbox', { kind: 'digest', ref_id: 'digest-' + new Date().toISOString().slice(0, 10) });
  assert.equal(rows.length, r.body.queued);
  for (const o of rows) assert.ok(brain.policy.activeConsent(o.person_id, fac.agency_id, 'contact'));
  const ov = await N.as('demo.steward').get('/api/m/channels/overview');
  assert.equal(ov.status, 200);
  assert.equal(ov.body.providers.sms.provider, 'simulator');
  assert.equal(ov.body.live, false);
});
