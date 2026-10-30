'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');

let N;
test.before(async () => { N = await bootDemo(); });
test.after(async () => { await N.close(); });

test('hierarchy: steward sees all hamlets; facilitator only own centre details', async () => {
  const s = await N.as('demo.steward').get('/api/m/operations/hierarchy');
  assert.equal(s.status, 200);
  assert.equal(s.body.totals.hamlets, 10);
  assert.ok(s.body.totals.centres >= 25);
  const f = await N.as('demo.facilitator').get('/api/m/operations/hierarchy');
  assert.equal(f.status, 200);
  assert.equal(f.body.totals.hamlets, 1);
  const centres = f.body.tree.districts.flatMap((d) => d.panchayats.flatMap((p) => p.hamlets.flatMap((h) => h.centres)));
  for (const c of centres.filter((x) => !x.mine)) assert.equal(c.assets, undefined, 'no ops detail for other agencies');
  assert.ok(centres.some((c) => c.mine && c.assets > 0));
});

test('learners, donors and govt viewers cannot use operations', async () => {
  for (const u of ['demo.learner', 'demo.donor', 'demo.govt', 'demo.guardian']) {
    const r = await N.as(u).get('/api/m/operations/assets');
    assert.equal(r.status, 403, u);
  }
});

test('assets are scoped to the agency; another agency cannot edit them', async () => {
  const cif = await N.as('demo.facilitator').get('/api/m/operations/assets');
  assert.equal(cif.status, 200);
  assert.ok(cif.body.assets.length >= 5);
  const fac = N.demo.users.facilitator;
  for (const a of cif.body.assets) assert.equal(a.agency_id, fac.agency_id);
  const vjt = await N.as('demo.facilitator.vjt').get('/api/m/operations/assets');
  assert.ok(!vjt.body.assets.some((a) => a.agency_id === fac.agency_id));
  const target = cif.body.assets[0];
  const bad = await N.as('demo.facilitator.vjt').post('/api/m/operations/assets', { id: target.id, condition: 'broken' });
  assert.equal(bad.status, 403);
  const ok = await N.as('demo.facilitator').post('/api/m/operations/assets', { id: target.id, condition: 'fair', notes: 'checked' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.condition, 'fair');
});

test('maintenance ticket lifecycle open → in_progress → resolved restores the asset', async () => {
  const fac = N.as('demo.facilitator');
  const { body } = await fac.get('/api/m/operations/assets');
  const asset = body.assets.find((a) => a.condition === 'good' || a.condition === 'fair');
  const t = await fac.post('/api/m/operations/tickets', { asset_id: asset.id, title: 'Tablet screen flickers', priority: 'high' });
  assert.equal(t.status, 200);
  assert.equal(t.body.status, 'open');
  const skip = await fac.post(`/api/m/operations/tickets/${t.body.id}/status`, { status: 'open' });
  assert.equal(skip.status, 400);
  const other = await N.as('demo.facilitator.vjt').post(`/api/m/operations/tickets/${t.body.id}/status`, { status: 'in_progress' });
  assert.equal(other.status, 403);
  assert.equal((await fac.post(`/api/m/operations/tickets/${t.body.id}/status`, { status: 'in_progress', note: 'Tech informed' })).body.status, 'in_progress');
  const done = await fac.post(`/api/m/operations/tickets/${t.body.id}/status`, { status: 'resolved', note: 'Replaced cable' });
  assert.equal(done.body.status, 'resolved');
  assert.equal(done.body.history.length, 3);
  const after = (await fac.get('/api/m/operations/assets')).body.assets.find((a) => a.id === asset.id);
  assert.equal(after.condition, 'good');
});

test('setup wizard creates a centre profile, kit assets and programmes via the brain', async () => {
  const h = N.demo.hamletByKey.h4; // vjt does not serve h4 — cif.admin sets up a new CIF centre there
  const opts = await N.as('demo.cif.admin').get('/api/m/operations/setup/options');
  assert.equal(opts.status, 200);
  const r = await N.as('demo.cif.admin').post('/api/m/operations/setup', {
    hamlet_id: h.id, name: 'AADI Smart Learning Centre — Vellimala', kit: [{ key: 'mini_pc', qty: 1, have: true }, { key: 'tablet', qty: 4, have: true }, { key: 'tv', qty: 1, have: false }],
    facilitator_ids: [N.demo.users.facilitator.id],
    programmes: [{ track: 'tuition', title: 'Tuition Class 1–4', schedule: ['Mon 16:00', 'Wed 16:00'], capacity: 20 }],
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.assets, 5);
  assert.equal(r.body.programmes.length, 1);
  assert.equal(r.body.missing_kit.length, 1);
  assert.ok(r.body.core_centre_id, 'real core centre registered');
  const core = N.brain.store.get('centres', r.body.core_centre_id);
  assert.equal(core.agency_id, N.demo.users['cif.admin'].agency_id);
  assert.equal(core.hamlet_id, h.id);
  assert.equal(r.body.profile.centre_id, core.id, 'profile linked by centre id');
  const pr = N.brain.store.get('programmes', r.body.programmes[0].id);
  assert.equal(pr.centre_id, core.id);
  assert.equal(pr.agency_id, N.demo.users['cif.admin'].agency_id);
  const tt = await N.as('demo.cif.admin').get('/api/m/operations/timetable?hamlet_id=' + h.id);
  assert.ok(tt.body.cells.some((c) => c.programme_id === pr.id));
  // agency admin cannot register a centre for another agency, even if they pass agency_id
  const vjt = await N.as('demo.vjt.admin').post('/api/m/operations/setup', { hamlet_id: N.demo.hamletByKey.h1.id, agency_id: N.demo.agencyByKey.cif.id, name: 'Sneaky' });
  assert.equal(vjt.status, 200);
  assert.equal(N.brain.store.get('centres', vjt.body.core_centre_id).agency_id, N.demo.agencyByKey.vjt.id);
  // coordinator: profile only (no core write) → admin registers it later
  const co = await N.as('demo.coordinator').post('/api/m/operations/setup', { hamlet_id: N.demo.hamletByKey.h9.id, name: 'Ponmudikudi annex', kit: [{ key: 'tablet', qty: 2, have: true }] });
  assert.equal(co.status, 200);
  assert.equal(co.body.core_centre_id, null);
  assert.equal((await N.as('demo.vjt.admin').post(`/api/m/operations/setup/${co.body.profile.id}/register`, {})).status, 403);
  const reg = await N.as('demo.cif.admin').post(`/api/m/operations/setup/${co.body.profile.id}/register`, {});
  assert.equal(reg.status, 200);
  assert.equal(N.brain.store.find('operations_assets', { centre_id: reg.body.id }).length, 2, 'assets moved to the core centre id');
  const fac = await N.as('demo.facilitator').post('/api/m/operations/setup', { hamlet_id: h.id });
  assert.equal(fac.status, 403, 'facilitators cannot run the wizard');
});

test('expenses: budget vs actual, and other agencies are refused', async () => {
  const fac = N.as('demo.facilitator');
  const e = await fac.get('/api/m/operations/expenses');
  assert.equal(e.status, 200);
  assert.ok(e.body.trend.length === 6);
  assert.ok(e.body.trend.some((t) => t.actual > 0 && t.budget > 0));
  const centre = e.body.centres[0];
  const add = await fac.post('/api/m/operations/expenses', { centre_id: centre.id, category: 'materials', amount: 450, receipt_note: 'Crayons' });
  assert.equal(add.status, 200);
  const bad = await N.as('demo.facilitator.vjt').post('/api/m/operations/expenses', { centre_id: centre.id, category: 'materials', amount: 1 });
  assert.equal(bad.status, 403);
  const neg = await fac.post('/api/m/operations/expenses', { centre_id: centre.id, category: 'materials', amount: -4 });
  assert.equal(neg.status, 400);
});

test('fees: only consented learners visible, learning access is always on', async () => {
  const { brain, demo } = N;
  const fac = demo.users.facilitator;
  const r = await N.as('demo.facilitator').get('/api/m/operations/fees');
  assert.equal(r.status, 200);
  assert.ok(r.body.rows.length > 0);
  for (const row of r.body.rows) {
    assert.ok(brain.policy.canSee(fac, row.person_id, 'profile').ok);
    assert.equal(row.learning_access, 'always');
  }
  assert.ok(r.body.rows.some((x) => x.plan === 'sliding'));
  // revoke consent → the learner disappears from the fee list
  const target = r.body.rows[0];
  const c = brain.store.find('consents', { person_id: target.person_id, agency_id: fac.agency_id, status: 'active' })[0];
  brain.revokeConsent(c.id, demo.users.steward);
  const r2 = await N.as('demo.facilitator').get('/api/m/operations/fees');
  assert.ok(!r2.body.rows.some((x) => x.person_id === target.person_id));
  const donor = await N.as('demo.donor').get('/api/m/operations/fees');
  assert.equal(donor.status, 403);
});

test('timetable combines agencies for a hamlet and works for a learner', async () => {
  const r = await N.as('demo.learner').get('/api/m/operations/timetable');
  assert.equal(r.status, 200);
  assert.equal(r.body.hamlet.id, N.demo.hamletByKey.h1.id);
  assert.ok(r.body.agencies.length >= 2);
  assert.ok(r.body.cells.some((c) => c.mine));
});

test('hub health and staff roster', async () => {
  const h = await N.as('demo.steward').get('/api/m/operations/hub-health');
  assert.equal(h.status, 200);
  assert.ok(h.body.hubs.some((x) => x.latest && x.series.length >= 10));
  const s = await N.as('demo.cif.admin').get('/api/m/operations/staff');
  assert.equal(s.status, 200);
  const cifId = N.demo.users['cif.admin'].agency_id;
  for (const x of s.body.staff) assert.equal(x.agency_id, cifId);
  assert.ok(s.body.duty.length > 0);
});
