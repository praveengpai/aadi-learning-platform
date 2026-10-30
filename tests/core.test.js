'use strict';
// Brain-level tests: consent & policy, multi-agency isolation, audit, tamper evidence,
// module isolation (circuit breaker), and cloud <-> hub sync including offline + courier.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootDemo } = require('./helpers');

let N;
test.before(async () => { N = await bootDemo(); });
test.after(async () => { await N.close(); });

test('login works and bad passwords are rejected', async () => {
  const bad = await N.req(null, 'POST', '/api/core/auth/login', { username: 'demo.steward', password: 'nope' });
  assert.equal(bad.status, 401);
  const me = await N.as('demo.steward').get('/api/core/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.role, 'platform_admin');
  assert.equal(me.body.user.pass_hash, undefined, 'password hash never leaves the server');
});

test('unauthenticated access is refused', async () => {
  const r = await N.req(null, 'GET', '/api/core/persons');
  assert.equal(r.status, 401);
});

test('facilitator only sees consented learners enrolled with their agency, in their hamlet', async () => {
  const { brain, demo } = N;
  const fac = demo.users.facilitator;
  const r = await N.as('demo.facilitator').get('/api/core/persons?limit=5000');
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 10);
  for (const p of r.body) {
    assert.equal(p.hamlet_id, demo.hamletByKey.h1.id, 'hamlet-scoped');
    assert.ok(brain.policy.enrolledWith(p.id, fac.agency_id), 'enrolled with agency');
    assert.ok(brain.policy.activeConsent(p.id, fac.agency_id, 'profile'), 'has consent');
  }
});

test('two agencies in the same hamlet see different learners', async () => {
  const cif = (await N.as('demo.facilitator').get('/api/core/persons?limit=5000')).body.map((p) => p.id);
  const vjt = (await N.as('demo.facilitator.vjt').get('/api/core/persons?limit=5000')).body.map((p) => p.id);
  assert.ok(vjt.length > 0);
  // anyone in vjt's list who is NOT enrolled with CIF must be invisible to CIF
  const onlyVjt = vjt.filter((id) => !N.brain.policy.enrolledWith(id, N.demo.agencyByKey.cif.id));
  assert.ok(onlyVjt.length > 0, 'there are learners served only by Vanajyothi');
  for (const id of onlyVjt) {
    assert.ok(!cif.includes(id));
    const r = await N.as('demo.facilitator').get('/api/core/persons/' + id);
    assert.equal(r.status, 403);
  }
});

test('contact details are masked without contact consent', async () => {
  const rows = (await N.as('demo.facilitator').get('/api/core/persons?limit=5000')).body;
  const hidden = rows.filter((p) => p.contact_hidden && p.phone);
  for (const p of hidden) assert.match(p.phone, /^••••••/);
});

test('donors, govt viewers and learners get no person lists', async () => {
  for (const u of ['demo.donor', 'demo.govt']) {
    const r = await N.as(u).get('/api/core/persons');
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 0, u + ' sees nobody');
  }
  const l = await N.as('demo.learner').get('/api/core/persons');
  assert.equal(l.body.length, 1);
  assert.equal(l.body[0].id, N.demo.demoLearner.id);
});

test('guardian sees own children; learner cannot open someone else', async () => {
  const g = await N.as('demo.guardian').get('/api/core/persons');
  assert.ok(g.body.some((p) => p.id === N.demo.demoLearner.id));
  const other = N.demo.children.find((c) => c.guardian_id !== N.demo.demoGuardian.id);
  const r = await N.as('demo.learner').get('/api/core/persons/' + other.id);
  assert.equal(r.status, 403);
});

test('a minor cannot self-consent; guardian must', () => {
  const child = N.demo.children[0];
  assert.throws(() => N.brain.grantConsent({ person_id: child.id, agency_id: N.demo.agencyByKey.uoc.id, scopes: ['profile'], granted_by: child.id }, null), /guardian/i);
});

test('enrolment without consent is refused', async () => {
  const { demo, brain } = N;
  const cif = demo.agencyByKey.cif.id;
  const prog = demo.programmes.find((p) => p.agency_id === cif && p.hamlet_id === demo.hamletByKey.h1.id);
  const stranger = demo.persons.find((p) => p.hamlet_id === demo.hamletByKey.h1.id && !brain.policy.activeConsent(p.id, cif, 'profile'));
  const r = await N.as('demo.facilitator').post('/api/core/enrolments', { person_id: stranger.id, programme_id: prog.id });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'consent_required');
});

test('agency cannot enrol into another agency\'s programme', async () => {
  const { demo } = N;
  const vjtProg = demo.programmes.find((p) => p.agency_id === demo.agencyByKey.vjt.id);
  const r = await N.as('demo.facilitator').post('/api/core/enrolments', { person_id: demo.demoLearner.id, programme_id: vjtProg.id });
  assert.equal(r.status, 403);
});

test('guardian withdraws consent → agency loses access immediately; audit records it', async () => {
  const { demo } = N;
  const child = demo.demoLearner;
  const before = await N.as('demo.facilitator').get('/api/core/persons/' + child.id);
  assert.equal(before.status, 200);
  const consents = (await N.as('demo.guardian').get('/api/core/persons/' + child.id)).body.consents;
  const c = consents.find((x) => x.agency_id === demo.agencyByKey.cif.id && x.status === 'active');
  assert.ok(c, 'child has CIF consent');
  const fac = await N.as('demo.facilitator').post(`/api/core/consents/${c.id}/revoke`);
  assert.equal(fac.status, 403, 'staff cannot withdraw on the family\'s behalf');
  const rv = await N.as('demo.guardian').post(`/api/core/consents/${c.id}/revoke`);
  assert.equal(rv.status, 200);
  const after = await N.as('demo.facilitator').get('/api/core/persons/' + child.id);
  assert.equal(after.status, 403);
  const audit = await N.as('demo.steward').get('/api/core/audit');
  assert.ok(audit.body.some((a) => a.type === 'audit.consent.revoke'));
  // restore for other tests
  const g = await N.as('demo.guardian').post('/api/core/consents', { person_id: child.id, agency_id: demo.agencyByKey.cif.id, scopes: c.scopes });
  assert.equal(g.status, 200);
  assert.equal((await N.as('demo.facilitator').get('/api/core/persons/' + child.id)).status, 200);
});

test('steward reads of a person are audited', async () => {
  const id = N.demo.youth[3].id;
  await N.as('demo.steward').get('/api/core/persons/' + id);
  const audit = await N.as('demo.steward').get('/api/core/audit');
  assert.ok(audit.body.some((a) => a.type === 'audit.steward.person_read' && JSON.parse(typeof a.payload === 'string' ? a.payload : JSON.stringify(a.payload)).target === id));
});

test('child-facing staff stay inactive until safeguarding training', async () => {
  const r = await N.as('demo.cif.admin').post('/api/core/users', { username: 'new.fac', password: 'x12345678', role: 'facilitator', display_name: 'New Facilitator' });
  assert.equal(r.status, 200);
  assert.equal(r.body.active, 0);
  const login = await N.req(null, 'POST', '/api/core/auth/login', { username: 'new.fac', password: 'x12345678' });
  assert.equal(login.status, 401);
  const tr = await N.as('demo.cif.admin').post(`/api/core/users/${r.body.id}/safeguarding-trained`);
  assert.equal(tr.body.active, 1);
  const login2 = await N.req(null, 'POST', '/api/core/auth/login', { username: 'new.fac', password: 'x12345678' });
  assert.equal(login2.status, 200);
  const esc = await N.as('demo.cif.admin').post('/api/core/users', { username: 'evil', password: 'x12345678', role: 'platform_admin', display_name: 'x' });
  assert.equal(esc.status, 403, 'agency admins cannot create stewards');
});

test('service map shows gaps, overlaps and clashes across agencies', async () => {
  const h1 = N.demo.hamletByKey.h1.id;
  const r = await N.as('demo.coordinator').get(`/api/core/hamlets/${h1}/service-map`);
  assert.equal(r.status, 200);
  assert.ok(r.body.overlaps.some((o) => o.track === 'tuition'), 'CIF and Vanajyothi both run tuition in Pachakkudi');
  assert.ok(Array.isArray(r.body.gaps));
});

test('aggregates are k-anonymised for external viewers', async () => {
  const hs = (await N.as('demo.donor').get('/api/core/hamlets')).body;
  for (const x of hs) assert.ok(typeof x.people === 'number' ? x.people >= 5 || x.people === 0 : x.people === '<5');
});

test('learning passport: award is idempotent and verifiable publicly with minimal data', async () => {
  const pid = N.demo.demoLearner.id;
  const a1 = N.brain.award({ person_id: pid, type: 'competency', ref: 'TEST.X', title: 'Test skill', level: 1, agency_id: N.demo.agencyByKey.cif.id }, null);
  const a2 = N.brain.award({ person_id: pid, type: 'competency', ref: 'TEST.X', title: 'Test skill', level: 1, agency_id: N.demo.agencyByKey.cif.id }, null);
  assert.equal(a1.id, a2.id);
  const pp = await N.as('demo.learner').get('/api/core/passport/' + pid);
  assert.equal(pp.status, 200);
  const v = await N.req(null, 'GET', '/api/core/passport/verify/' + pp.body.verify_code);
  assert.equal(v.body.valid, true);
  assert.ok(!('id' in v.body) && !('hamlet_id' in v.body));
  const denied = await N.as('demo.donor').get('/api/core/passport/' + pid);
  assert.equal(denied.status, 403);
});

test('event chain is intact, and tampering is detected', async () => {
  const ok = N.brain.store.verifyChain();
  assert.equal(ok.ok, true);
  const row = N.brain.db.prepare(`SELECT seq FROM events WHERE node=? AND payload LIKE '%"table":"persons"%' ORDER BY seq LIMIT 1 OFFSET 5`).get(N.brain.nodeId);
  const orig = N.brain.db.prepare('SELECT payload FROM events WHERE seq=?').get(row.seq).payload;
  N.brain.db.prepare('UPDATE events SET payload=? WHERE seq=?').run(orig.replace(/"name":"[^"]*"/, '"name":"Tampered"'), row.seq);
  const bad = N.brain.store.verifyChain();
  assert.equal(bad.ok, false);
  N.brain.db.prepare('UPDATE events SET payload=? WHERE seq=?').run(orig, row.seq);
  assert.equal(N.brain.store.verifyChain().ok, true);
});

test('state can be rebuilt purely from the event log', () => {
  const { brain } = N;
  const before = brain.store.one('SELECT COUNT(*) n, SUM(length(name)) s FROM persons WHERE deleted=0');
  brain.db.exec('DELETE FROM persons');
  brain.store.tx(() => {
    for (const ev of brain.db.prepare("SELECT * FROM events WHERE type='row.upsert' ORDER BY seq").iterate()) {
      const p = JSON.parse(ev.payload);
      if (p.table === 'persons') brain.store._applyUpsert('persons', p.row);
    }
  });
  const after = brain.store.one('SELECT COUNT(*) n, SUM(length(name)) s FROM persons WHERE deleted=0');
  assert.deepEqual(after, before);
});

test('a crashing module is isolated by its circuit breaker; the brain keeps serving', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aadi-mod-'));
  fs.mkdirSync(path.join(dir, 'boom'));
  fs.writeFileSync(path.join(dir, 'boom', 'manifest.json'), JSON.stringify({ id: 'boom', version: '0.0.1', name: 'Boom', tables: {} }));
  fs.writeFileSync(path.join(dir, 'boom', 'index.js'), "module.exports = (ctx) => { ctx.router.get('/x', ctx.authed, () => { throw new Error('kaboom'); }); ctx.router.get('/ok', ctx.authed, (req, res) => res.json({ ok: 1 })); };");
  fs.mkdirSync(path.join(dir, 'broken'));
  fs.writeFileSync(path.join(dir, 'broken', 'manifest.json'), JSON.stringify({ id: 'broken', version: '0.0.1', name: 'Broken' }));
  fs.writeFileSync(path.join(dir, 'broken', 'index.js'), "throw new Error('fails at load');");
  const { createApp } = require('../server');
  const ctx = createApp({ dbFile: path.join(dir, 'n.db'), node: 'iso', modulesDir: dir });
  const st = Object.fromEntries(ctx.host.status().map((m) => [m.id, m.state]));
  assert.equal(st.broken, 'failed');
  assert.equal(st.boom, 'up');
  ctx.brain.createUser({ username: 'admin', password: 'pw123456', role: 'platform_admin', display_name: 'A' });
  const server = await new Promise((r) => { const s = ctx.app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const tok = (await (await fetch(base + '/api/core/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'pw123456' }) })).json()).token;
  const H = { authorization: 'Bearer ' + tok };
  for (let i = 0; i < 5; i++) assert.equal((await fetch(base + '/api/m/boom/x', { headers: H })).status, 500);
  const tripped = await fetch(base + '/api/m/boom/ok', { headers: H });
  assert.equal(tripped.status, 503, 'breaker open → even healthy routes of that module rest');
  assert.equal((await tripped.json()).error, 'module_tripped');
  assert.equal((await fetch(base + '/api/m/broken/anything', { headers: H })).status, 503);
  assert.equal((await fetch(base + '/api/core/health')).status, 200, 'brain still healthy');
  assert.equal((await fetch(base + '/api/core/me', { headers: H })).status, 200);
  // admin switch
  ctx.host.setEnabled('boom', false, null);
  assert.equal((await (await fetch(base + '/api/m/boom/ok', { headers: H })).json()).error, 'module_disabled');
  await new Promise((r) => server.close(r));
  ctx.brain.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hub works offline, then converges with the cloud (both directions, idempotent)', async () => {
  const cloud = N;
  const h1 = cloud.demo.hamletByKey.h1.id;
  const hub = await bootDemo({ node: 'hub-test', role: 'hub', upstream: cloud.base, syncKey: 'test-key', hamlets: h1, noSeed: true });
  try {
    // cloud must accept the hub's key
    // (cloud booted with syncKey 'test-key' via helpers default)
    const first = await hub.sync.runOnce();
    assert.ok(first.pulled > 1000, 'hub pulled the hamlet slice + shared registries');
    const hubPersons = hub.brain.store.all('SELECT DISTINCT hamlet_id FROM persons WHERE deleted=0').map((r) => r.hamlet_id);
    assert.deepEqual(hubPersons, [h1], 'hub only holds its own hamlet\'s people');
    // log in on the hub with a replicated account
    const tokRes = await hub.req(null, 'POST', '/api/core/auth/login', { username: 'demo.facilitator', password: 'demo1234' });
    assert.equal(tokRes.status, 200);
    // go offline, register a learner at the hub
    hub.sync.state.simulatedOffline = true;
    await assert.rejects(hub.sync.runOnce(), /offline/);
    const created = await hub.req(tokRes.body.token, 'POST', '/api/core/persons', { name: 'Offline Kid', hamlet_id: h1, kind: 'child', dob: '2016-05-01', guardian: { name: 'Offline Parent', relation: 'mother' }, consent: { scopes: ['profile', 'progress'] } });
    assert.equal(created.status, 200);
    assert.equal(cloud.brain.store.get('persons', created.body.id), null, 'cloud does not have it yet');
    // meanwhile the cloud changes something in the same hamlet
    const someone = cloud.demo.persons.find((p) => p.hamlet_id === h1 && p.kind === 'youth');
    cloud.brain.store.put('persons', { ...cloud.brain.store.get('persons', someone.id), aspirations: 'Forest Guard (PSC) — updated in cloud' });
    // reconnect
    hub.sync.state.simulatedOffline = false;
    const back = await hub.sync.runOnce();
    assert.ok(back.pushed >= 3);
    assert.equal(cloud.brain.store.get('persons', created.body.id).name, 'Offline Kid');
    assert.equal(hub.brain.store.get('persons', someone.id).aspirations, 'Forest Guard (PSC) — updated in cloud');
    // idempotent: running again changes nothing, chains still verify on both sides
    const again = await hub.sync.runOnce();
    assert.equal(again.pushed, 0);
    assert.equal(again.pulled, 0);
    assert.equal(cloud.brain.store.verifyChain('hub-test').ok, true);
    assert.equal(hub.brain.store.verifyChain('hub-test').ok, true);
  } finally { await hub.close(); }
});

test('courier bundle: export from one node, import into another, re-import is harmless', async () => {
  const fresh = await bootDemo({ node: 'courier-target', noSeed: true });
  try {
    const tok = await N.login('demo.steward');
    const exp = await fetch(N.base + '/api/sync/export', { headers: { authorization: 'Bearer ' + tok } });
    assert.equal(exp.status, 200);
    const buf = Buffer.from(await exp.arrayBuffer());
    const imp = async () => (await fetch(fresh.base + '/api/sync/import', { method: 'POST', headers: { 'x-sync-key': 'test-key' }, body: buf })).json();
    const r1 = await imp();
    assert.ok(r1.added > 5000);
    assert.equal(r1.failed, 0);
    const r2 = await imp();
    assert.equal(r2.added, 0);
    const a = N.brain.store.one('SELECT COUNT(*) n FROM persons WHERE deleted=0').n;
    const b = fresh.brain.store.one('SELECT COUNT(*) n FROM persons WHERE deleted=0').n;
    assert.equal(a, b);
  } finally { await fresh.close(); }
});
