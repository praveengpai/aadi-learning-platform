'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');

let N;
test.before(async () => { N = await bootDemo(); });
test.after(async () => { await N.close(); });

// every string anywhere in a JSON body
const strings = (o, out = []) => { if (o && typeof o === 'object') for (const v of Object.values(o)) strings(v, out); else if (typeof o === 'string') out.push(o); return out; };
const numbers = (o, out = []) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (typeof v === 'number' && ['value', 'reached', 'enrolments', 'dropped', 'holders', 'total', 'placed', 'active', 'high', 'medium', 'low', 'learners', 'mock_takers', 'checkins', 'learners_retested', 'diagnosed'].includes(k)) out.push(v); numbers(v, out); } return out; };

for (const who of ['demo.donor', 'demo.govt']) {
  test(`${who} dashboard has no names or ids and suppresses small counts`, async () => {
    const r = await N.as(who).get('/api/m/analytics/dashboard');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(['donor', 'govt'].includes(r.body.audience.mode));
    const text = JSON.stringify(r.body);
    for (const p of N.demo.persons) {
      assert.ok(!text.includes(p.id), 'no person ids');
      assert.ok(!text.includes(`"${p.name}"`), 'no names');
    }
    assert.ok(!/per_[0-9a-z]{6,}/.test(text), 'no person-id-shaped strings');
    for (const n of numbers(r.body.metrics)) assert.ok(n === 0 || n >= 5, 'small counts suppressed, got ' + n);
    assert.ok(text.includes('<5') || numbers(r.body.metrics).every((n) => n === 0 || n >= 5));
    assert.ok(r.body.framework.indicators.length >= 12);
    const rep = await N.as(who).get('/api/m/analytics/report');
    assert.equal(rep.status, 200);
    const rt = JSON.stringify(rep.body);
    assert.ok(!/per_[0-9a-z]{6,}/.test(rt));
    for (const n of numbers(rep.body.hamlets)) assert.ok(n === 0 || n >= 5);
  });
}

test('external roles cannot see risk alerts or research export', async () => {
  for (const u of ['demo.donor', 'demo.govt']) {
    assert.equal((await N.as(u).get('/api/m/analytics/risk')).status, 403);
    assert.equal((await N.as(u).get('/api/m/analytics/research.csv')).status, 403);
  }
  assert.equal((await N.as('demo.learner').get('/api/m/analytics/dashboard')).status, 403);
});

test('agency admin sees only own agency', async () => {
  const r = await N.as('demo.vjt.admin').get('/api/m/analytics/dashboard');
  assert.equal(r.status, 200);
  assert.equal(r.body.audience.mode, 'agency');
  const names = r.body.metrics.byAgency.map((a) => a.label);
  assert.deepEqual(names, ['Vanajyothi Trust (demo)']);
  const vjtId = N.demo.agencyByKey.vjt.id;
  const vjtHamlets = new Set(N.brain.store.find('agency_presence', { agency_id: vjtId }).map((p) => p.hamlet_id));
  for (const h of r.body.metrics.byHamlet) {
    const hid = N.demo.hamlets.find((x) => x.name === h.label).id;
    assert.ok(vjtHamlets.has(hid), 'only hamlets VJT serves');
  }
  const s = await N.as('demo.steward').get('/api/m/analytics/dashboard');
  assert.ok(s.body.metrics.reached > r.body.metrics.reached);
  assert.ok(s.body.metrics.byAgency.length >= 5);
});

test('dropout risk alerts only include persons the staff member can see', async () => {
  const fac = N.demo.users.facilitator;
  const r = await N.as('demo.facilitator').get('/api/m/analytics/risk?level=all');
  assert.equal(r.status, 200);
  assert.ok(r.body.rows.length > 0);
  for (const row of r.body.rows) assert.ok(N.brain.policy.canSee(fac, row.id, 'progress').ok);
  assert.ok(r.body.rows.every((x) => typeof x.score === 'number' && Array.isArray(x.factors)));
  const vjt = await N.as('demo.facilitator.vjt').get('/api/m/analytics/risk?level=all');
  const cifIds = new Set(r.body.rows.map((x) => x.id));
  for (const row of vjt.body.rows) assert.ok(N.brain.policy.canSee(N.demo.users['facilitator.vjt'], row.id, 'progress').ok);
  // an action on someone not visible is refused
  const stranger = N.demo.persons.find((p) => !N.brain.policy.canSee(fac, p.id, 'progress').ok);
  assert.equal((await N.as('demo.facilitator').post(`/api/m/analytics/risk/${stranger.id}/action`, { action: 'called' })).status, 403);
  void cifIds;
});

test('research export only includes research-consented persons, pseudonymised', async () => {
  const { brain } = N;
  const r = await N.as('demo.steward').get('/api/m/analytics/research.csv');
  assert.equal(r.status, 200);
  const lines = String(r.body).trim().split('\n');
  const header = lines[0].split(',');
  assert.ok(header.includes('pid') && header.includes('age_band') && header.includes('district'));
  for (const bad of ['name', 'hamlet', 'phone', 'dob', 'person_id']) assert.ok(!header.includes(bad));
  const consented = new Set(brain.store.all("SELECT person_id, scopes FROM consents WHERE deleted=0 AND status='active'").filter((c) => c.scopes.includes('research')).map((c) => c.person_id));
  assert.equal(lines.length - 1, consented.size, 'one row per research-consented person');
  const text = String(r.body);
  for (const p of N.demo.persons) { assert.ok(!text.includes(p.id)); }
  // revoke research consent for someone → row count drops
  const someone = [...consented][0];
  for (const c of brain.store.find('consents', { person_id: someone, status: 'active' })) brain.store.put('consents', { ...c, scopes: c.scopes.filter((s) => s !== 'research') });
  const r2 = await N.as('demo.steward').get('/api/m/analytics/research.csv');
  assert.equal(String(r2.body).trim().split('\n').length - 1, consented.size - 1);
  // agency admin: only their agency's research consents
  const a = await N.as('demo.vjt.admin').get('/api/m/analytics/research/preview');
  assert.equal(a.status, 200);
  assert.ok(a.body.count < consented.size);
  assert.equal((await N.as('demo.facilitator').get('/api/m/analytics/research.csv')).status, 403);
});

test('coordinator hamlet dashboard is anonymised and scoped to own hamlets', async () => {
  const r = await N.as('demo.coordinator').get('/api/m/analytics/dashboard');
  assert.equal(r.status, 200);
  assert.equal(r.body.audience.mode, 'hamlet');
  const labels = r.body.metrics.byHamlet.map((h) => h.label).sort();
  assert.deepEqual(labels, ['Pachakkudi', 'Ponmudikudi']);
  assert.ok(!/per_[0-9a-z]{6,}/.test(JSON.stringify(r.body)));
});
