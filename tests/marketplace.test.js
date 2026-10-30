'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bootDemo } = require('./helpers');

test('marketplace module', async (t) => {
  const app = await bootDemo();
  t.after(() => app.close());
  const { demo } = app;
  const A = demo.agencyByKey;
  const personIds = new Set(demo.persons.map((p) => p.id));
  const fullNames = new Set(demo.persons.map((p) => p.name));
  const leaks = (obj) => {
    const s = JSON.stringify(obj);
    for (const id of personIds) if (s.includes(id)) return 'person id ' + id;
    for (const n of fullNames) if (s.includes('"' + n + '"') || s.includes(n + ' —')) return 'name ' + n;
    return null;
  };

  await t.test('seed is rich', async () => {
    const h = app.host.health().find((m) => m.id === 'marketplace');
    assert.equal(h.state, 'up');
    assert.ok(h.extra.open_jobs >= 10);
    assert.ok(h.extra.placements >= 1);
    const vols = (await app.as('demo.steward').get('/api/m/marketplace/volunteers')).body;
    for (const s of ['applied', 'screening', 'approved', 'rejected']) assert.ok(vols.some((v) => v.status === s), 'volunteer stage ' + s);
    const led = (await app.as('demo.steward').get('/api/m/marketplace/ledger')).body;
    assert.ok(led.donors >= 25 && led.pledges.length >= 25);
  });

  await t.test('donor never receives person ids or full names', async () => {
    const d = app.as('demo.donor');
    const cards = await d.get('/api/m/marketplace/sponsorships');
    assert.equal(cards.status, 200);
    assert.ok(cards.body.some((c) => c.kind === 'learner'));
    assert.equal(leaks(cards.body), null);
    for (const c of cards.body) assert.ok(!('person_id' in c));
    const learnerCard = cards.body.find((c) => c.kind === 'learner');
    const imp = await d.get(`/api/m/marketplace/sponsorships/${learnerCard.id}/impact`);
    assert.equal(imp.status, 200);
    assert.equal(leaks(imp.body), null);
    const p = await d.post('/api/m/marketplace/pledges', { sponsorship_id: learnerCard.id, amount: 1500, frequency: 'once' });
    assert.equal(p.status, 200);
    const pay = await d.post(`/api/m/marketplace/pledges/${p.body.id}/pay`, {});
    assert.equal(pay.status, 200);
    assert.match(pay.body.gateway, /PLACEHOLDER/);
    const rc = await d.get('/api/m/marketplace/receipts/' + pay.body.id);
    assert.equal(rc.status, 200);
    assert.match(rc.body.amount_words, /One Thousand Five Hundred/);
    assert.equal(leaks(rc.body), null);
    const me = await d.get('/api/m/marketplace/donor/me');
    assert.equal(leaks(me.body), null);
    const rep = await d.get('/api/m/marketplace/reports/summary');
    assert.equal(leaks(rep.body), null);
    const csv = await d.get('/api/m/marketplace/reports/csr.csv');
    assert.equal(csv.status, 200);
    assert.equal(leaks(csv.body), null);
    // donor cannot reach person-level endpoints
    assert.equal((await d.get('/api/m/marketplace/candidates')).status, 403);
    assert.equal((await d.get('/api/m/marketplace/applications')).status, 403);
    assert.equal((await d.get('/api/m/marketplace/ledger')).status, 403);
    assert.equal((await d.get('/api/core/persons')).body.length, 0);
  });

  await t.test('employer sees only employment-consented adults, never minors', async () => {
    const e = app.as('demo.employer');
    const c = await e.get('/api/m/marketplace/candidates');
    assert.equal(c.status, 200);
    assert.ok(c.body.length > 0);
    for (const cand of c.body) {
      assert.ok(app.brain.policy.activeConsent(cand.id, A.glc.id, 'employment'), 'has employment consent');
      assert.ok(cand.age >= 18, 'adult only');
      assert.ok(!('phone' in cand));
    }
    // a minor with (hypothetical) employment consent must still be invisible
    const minor = demo.children.find((p) => app.brain.policy.isMinor(p));
    app.brain.grantConsent({ person_id: minor.id, agency_id: A.glc.id, scopes: ['profile', 'employment'], granted_by: minor.guardian_id, relation: 'guardian' }, null);
    const c2 = (await e.get('/api/m/marketplace/candidates')).body;
    assert.ok(!c2.some((x) => x.id === minor.id), 'minor never shown to employer');
    // revoke a candidate's employment consent → disappears
    const victim = c.body[0];
    const cons = app.brain.store.find('consents', { person_id: victim.id, agency_id: A.glc.id, status: 'active' })[0];
    app.brain.revokeConsent(cons.id, null);
    const c3 = (await e.get('/api/m/marketplace/candidates')).body;
    assert.ok(!c3.some((x) => x.id === victim.id));
    const apps = (await e.get('/api/m/marketplace/applications')).body;
    assert.ok(!apps.some((a) => a.candidate.id === victim.id), 'applications of revoked candidate hidden');
    for (const a of apps) assert.ok(a.candidate.age >= 18);
  });

  await t.test('fair-work checklist enforced on job posting', async () => {
    const e = app.as('demo.employer');
    const bad = await e.post('/api/m/marketplace/jobs', { title: 'Helper', wage_monthly: 20000, checklist: { written_offer: true, min_wage: true, accommodation_safe: true } });
    assert.equal(bad.status, 400);
    const low = await e.post('/api/m/marketplace/jobs', { title: 'Helper', wage_monthly: 5000, checklist: { written_offer: true, min_wage: true, accommodation_safe: true, no_document_retention: true } });
    assert.equal(low.status, 400);
    const ok = await e.post('/api/m/marketplace/jobs', { title: 'Helper', wage_monthly: 15000, checklist: { written_offer: true, min_wage: true, accommodation_safe: true, no_document_retention: true } });
    assert.equal(ok.status, 200);
    assert.equal((await app.as('demo.facilitator').post('/api/m/marketplace/jobs', { title: 'x' })).status, 403);
  });

  await t.test('youth applies (consent gate), employer moves to hired → placement', async () => {
    const yid = demo.demoYouth.id;
    const jobs = (await app.as('demo.youth').get('/api/m/marketplace/jobs')).body;
    const job = jobs.find((j) => !j.my_status);
    // ensure no employment consent with GLC
    for (const c of app.brain.store.find('consents', { person_id: yid, agency_id: A.glc.id, status: 'active' })) app.brain.revokeConsent(c.id, null);
    const gate = await app.as('demo.youth').post(`/api/m/marketplace/jobs/${job.id}/apply`, {});
    assert.equal(gate.status, 409);
    assert.equal(gate.body.error, 'consent_required');
    const g = await app.as('demo.youth').post('/api/core/consents', { person_id: yid, agency_id: A.glc.id, scopes: ['profile', 'employment'] });
    assert.equal(g.status, 200);
    const ap = await app.as('demo.youth').post(`/api/m/marketplace/jobs/${job.id}/apply`, {});
    assert.equal(ap.status, 200);
    const e = app.as('demo.employer');
    for (const s of ['shortlisted', 'interview', 'offered', 'hired']) {
      const r = await e.post(`/api/m/marketplace/applications/${ap.body.id}/status`, { status: s });
      assert.equal(r.status, 200, s + ': ' + JSON.stringify(r.body));
    }
    assert.equal((await app.as('demo.youth').post(`/api/m/marketplace/applications/${ap.body.id}/status`, { status: 'hired' })).status, 403);
    const pl = (await e.get('/api/m/marketplace/placements')).body;
    assert.ok(pl.some((p) => p.job_title === job.title));
    assert.ok(app.brain.store.find('passport_entries', { person_id: yid }).some((x) => /Placed/.test(x.title)));
  });

  await t.test('volunteer background-check workflow', async () => {
    const pub = await app.req(null, 'POST', '/api/m/marketplace/volunteers/apply', { name: 'Test Volunteer', phone: '9876543210', skills: 'Maths, Art' });
    assert.equal(pub.status, 200);
    const adm = app.as('demo.cif.admin');
    const early = await adm.post(`/api/m/marketplace/volunteers/${pub.body.id}/decision`, { decision: 'approve' });
    assert.equal(early.status, 409);
    const prog = demo.programmes.find((p) => p.agency_id === A.cif.id);
    assert.equal((await adm.post(`/api/m/marketplace/volunteers/${pub.body.id}/shifts`, { programme_id: prog.id })).status, 409);
    for (const c of ['id_verified', 'police_clearance', 'references', 'safeguarding']) assert.equal((await adm.post(`/api/m/marketplace/volunteers/${pub.body.id}/check`, { check: c })).status, 200);
    const ok = await adm.post(`/api/m/marketplace/volunteers/${pub.body.id}/decision`, { decision: 'approve' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, 'approved');
    const sh = await adm.post(`/api/m/marketplace/volunteers/${pub.body.id}/shifts`, { programme_id: prog.id });
    assert.equal(sh.status, 200);
    assert.equal((await adm.post(`/api/m/marketplace/shifts/${sh.body.id}/log`, { hours: 3 })).status, 200);
    assert.equal((await adm.post(`/api/m/marketplace/shifts/${sh.body.id}/verify`)).status, 200);
    const cert = await adm.get(`/api/m/marketplace/volunteers/${pub.body.id}/certificate`);
    assert.equal(cert.status, 200);
    assert.equal(cert.body.hours, 3);
    // other agency cannot see CIF volunteers
    assert.equal((await app.as('demo.vjt.admin').get('/api/m/marketplace/volunteers/' + pub.body.id)).status, 404);
  });
});
