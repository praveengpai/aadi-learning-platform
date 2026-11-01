'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bootDemo } = require('./helpers');
const E = require('../modules/govtservices/eligibility');
const CAT = require('../modules/govtservices/content/schemes.json');

test('eligibility sub-engine (pure)', () => {
  const elder = E.suggest({ kind: 'adult', age: 67, gender: 'F' }, { aadhaar: 'have' }, CAT);
  assert.ok(elder.find((s) => s.key === 'pension_old_age' && s.confidence === 'likely'), 'elderly person → old age pension');
  assert.equal(elder[0].category, 'pension', 'pension ranked first for an elder');
  const pen = elder.find((s) => s.key === 'pension_old_age');
  assert.ok(pen.missing.some((d) => d.key === 'bank_passbook') && !pen.missing.some((d) => d.key === 'aadhaar'), 'lists missing documents, not the ones they have');
  const kid = E.suggest({ kind: 'child', age: 12, gender: 'M', school_class: '7' }, {}, CAT);
  assert.ok(kid.find((s) => s.key === 'prematric'), 'student → pre-matric scholarship');
  assert.ok(!kid.find((s) => s.category === 'pension' && s.confidence === 'likely'));
  const plus2 = E.suggest({ kind: 'youth', age: 19, gender: 'F', school_class: 'Plus Two' }, {}, CAT);
  assert.ok(plus2.find((s) => s.key === 'postmatric'), 'after class 12 → post-matric (e-Grantz)');
  const has = E.suggest({ kind: 'adult', age: 40 }, { community_cert: 'have' }, CAT);
  assert.ok(!has.find((s) => s.key === 'community_cert'), 'no suggestion for a certificate already held');
  for (const s of CAT.schemes) assert.ok(s.verify && s.verify_ml && s.title_ml, 'every scheme has a bilingual verify note: ' + s.key);
  assert.match(CAT.status, /PENDING REVIEW/);
  assert.ok(!/₹|Rs\.?\s?\d/.test(JSON.stringify(CAT)), 'no money amounts stated as fact');
  const rule = E.makeRule(CAT);
  const r = rule({ scheme: 'pension_old_age', share_consent: 'no', docs_available: ['aadhaar'] }, { person: { age: 70 } });
  assert.equal(r.priority, 3);
  assert.ok(r.flags.find((f) => f.code === 'no_share_consent' && f.level === 'urgent'));
  assert.ok(r.flags.find((f) => f.code === 'docs_missing' && f.level === 'warn'));
  const sch = rule({ scheme: 'prematric', share_consent: 'yes', docs_available: CAT.schemes.find((s) => s.key === 'prematric').docs }, { person: { age: 12 } }, new Date('2026-06-05'));
  assert.equal(sch.priority, 2, 'scholarship near academic year start is raised');
  assert.ok(!sch.flags.find((f) => f.code === 'docs_missing'));
  assert.equal(rule({ scheme: 'prematric', share_consent: 'yes' }, {}, new Date('2026-11-05')).priority, 0);
});

test('government services module', async (t) => {
  const N = await bootDemo();
  t.after(() => N.close());
  const D = N.demo;
  const B = N.brain;
  const H = D.hamletByKey, A = D.agencyByKey;
  const base = '/api/m/govtservices';
  const u = (k) => B.store.one('SELECT * FROM users WHERE username=?', 'demo.' + k);

  await t.test('seed: programmes, ST-forwarded form, applications in every outcome, akshaya user', async () => {
    const def = B.forms.getDef('govtservices.application');
    assert.equal(def.review.agency_id, A.std.id, 'forwarded to the ST Office after seeding');
    assert.equal(def.scope, 'services');
    assert.equal(def.capture_perm, 'services.assist');
    const progs = B.store.find('programmes', { track: 'services' });
    assert.ok(progs.find((p) => p.agency_id === A.kyg.id && p.hamlet_id === H.h11.id));
    for (const hk of ['h1', 'h2', 'h11']) assert.ok(progs.find((p) => p.agency_id === A.cif.id && p.hamlet_id === H[hk].id));
    const subs = B.store.find('form_submissions', { form_key: 'govtservices.application' });
    assert.ok(subs.length >= 30, 'applications: ' + subs.length);
    for (const o of ['submitted_to_office', 'need_more_documents', 'approved', 'rejected', 'certificate_ready']) assert.ok(subs.some((s) => s.outcome === o), 'outcome ' + o);
    assert.equal(u('akshaya').role, 'field_officer');
    assert.equal(u('akshaya').agency_id, A.std.id);
    assert.ok(B.store.find('govtservices_documents', {}).length > 100);
  });

  await t.test('suggestions: elderly → pension, student → scholarship', async () => {
    const people = (await N.as('demo.facilitator').get(base + '/people?hamlet_id=' + H.h1.id)).body;
    const elder = people.find((p) => p.age >= 60);
    assert.ok(elder, 'an elder is in the helper\'s list');
    const se = (await N.as('demo.facilitator').get(base + '/suggest/' + elder.id)).body;
    assert.ok(se.suggestions.find((s) => s.category === 'pension'), 'elder gets a pension suggestion');
    assert.ok(Array.isArray(se.missing_documents));
    const ss = await N.as('demo.facilitator').get(base + '/suggest/' + D.demoLearner.id);
    assert.equal(ss.status, 200);
    assert.ok(ss.body.suggestions.find((s) => s.category === 'scholarship'), 'student gets a scholarship suggestion');
    assert.ok(ss.body.suggestions.every((s) => /check/i.test(s.label)), '"may be eligible — check", never a decision');
  });

  await t.test('suggest is policy-checked', async () => {
    assert.equal((await N.as('demo.facilitator.vjt').get(base + '/suggest/' + D.demoLearner.id)).status, 403, 'another agency');
    assert.equal((await N.as('demo.donor').get(base + '/suggest/' + D.demoLearner.id)).status, 403, 'donor');
    const other = D.children.find((c) => c.id !== D.demoLearner.id && c.guardian_id !== D.demoGuardian.id);
    assert.equal((await N.as('demo.learner').get(base + '/suggest/' + other.id)).status, 403, 'learner sees only self');
    assert.equal((await N.as('demo.learner').get(base + '/suggest/' + D.demoLearner.id)).status, 200);
    assert.equal((await N.as('demo.guardian').get(base + '/documents/' + D.demoLearner.id)).status, 200, 'guardian sees ward');
  });

  // A fresh h1 adult enrolled with CIF, with no services consent to anyone yet.
  const P = B.policy;
  const person = D.adults.find((p) => p.hamlet_id === H.h1.id && P.canSee(u('facilitator'), p.id, 'profile').ok && !P.activeConsent(p.id, A.std.id, 'services') && !B.store.find('consents', { person_id: p.id, agency_id: A.std.id, status: 'active' }).length);
  let appId;

  await t.test('round trip: helper captures → department sees only after family consents → outcomes → family sees status', async () => {
    assert.ok(person, 'test person available');
    const answers = { scheme: 'income_cert', purpose: 'Scholarship for my son', docs_available: ['aadhaar'], docs_missing: [], contact: 'next_visit', share_consent: 'yes' };
    // needs services consent to CIF first
    const no = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'govtservices.application', person_id: person.id, answers });
    if (!P.activeConsent(person.id, A.cif.id, 'services')) {
      assert.equal(no.status, 403, 'no services consent → cannot capture');
      const c = await N.as('demo.facilitator').post('/api/core/consents', { person_id: person.id, scopes: [...B.store.find('consents', { person_id: person.id, agency_id: A.cif.id, status: 'active' })[0].scopes, 'services'] });
      assert.equal(c.status, 200);
    }
    const s = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'govtservices.application', person_id: person.id, answers, client_ref: 'test-gs-1' });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    appId = s.body.id;
    assert.ok(s.body.flags.find((f) => f.code === 'docs_missing'), 'rule flags missing ration card');
    // department cannot see it yet
    assert.equal((await N.as('demo.akshaya').get(base + '/applications/' + appId)).status, 403);
    assert.ok(!(await N.as('demo.akshaya').get(base + '/office')).body.items.find((x) => x.id === appId));
    assert.equal((await N.as('demo.akshaya').post(base + '/applications/' + appId + '/outcome', { outcome: 'approved' })).status, 403);
    // family consents (in person, recorded by the department) to the ST Office for services
    B.grantConsent({ person_id: person.id, agency_id: A.std.id, scopes: ['services'], granted_by: person.id, relation: 'self' }, null);
    const q = (await N.as('demo.akshaya').get(base + '/office')).body.items;
    assert.ok(q.find((x) => x.id === appId && x.new), 'now in the office queue');
    const r1 = await N.as('demo.akshaya').post(base + '/applications/' + appId + '/outcome', { outcome: 'need_more_documents', note: 'Please bring the ration card.', note_ml: 'റേഷൻ കാർഡ് കൊണ്ടുവരിക.' });
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    assert.equal(r1.body.stage, 'need_more_documents');
    const r2 = await N.as('demo.akshaya').post(base + '/applications/' + appId + '/outcome', { outcome: 'approved' });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.stage, 'approved');
    assert.deepEqual(r2.body.timeline.map((x) => x.key), ['captured', 'need_more_documents', 'approved'], 'plain status timeline');
    assert.ok(r2.body.timeline.every((x) => x.label_ml && x.plain_ml), 'bilingual timeline');
    // capturer sees status
    const cap = (await N.as('demo.facilitator').get(base + '/applications/' + appId)).body;
    assert.equal(cap.stage, 'approved');
    assert.equal(cap.timeline.length, 3);
    assert.ok((await N.as('demo.facilitator').get(base + '/applications?mine=1')).body.find((x) => x.id === appId));
    // family (the person themself) sees status in plain words
    B.createUser({ username: 'demo.gs.family', password: 'demo1234', role: 'learner', display_name: 'Family test', person_id: person.id }, null);
    const my = (await N.as('demo.gs.family').get(base + '/my')).body;
    const app = my.members[0].applications.find((x) => x.id === appId);
    assert.ok(app && app.stage === 'approved' && app.plain && app.plain_ml);
    assert.ok(my.members.length === 1, 'only themself');
    // notifications carry no case details
    const notes = B.store.find('notifications', { person_id: person.id });
    assert.ok(notes.length >= 2);
    for (const n of notes) {
      assert.ok(!/income|ration|scholarship|approved|document/i.test(n.message), 'no case details in: ' + n.message);
    }
  });

  await t.test('another agency\'s facilitator and a donor are refused', async () => {
    assert.equal((await N.as('demo.facilitator.vjt').get(base + '/applications/' + appId)).status, 403);
    assert.ok(!(await N.as('demo.facilitator.vjt').get(base + '/applications')).body.find((x) => x.id === appId));
    assert.equal((await N.as('demo.facilitator.vjt').get(base + '/documents/' + person.id)).status, 403);
    assert.equal((await N.as('demo.facilitator.vjt').put(base + '/documents/' + person.id, { doc: 'aadhaar', status: 'have' })).status, 403);
    assert.equal((await N.as('demo.donor').get(base + '/applications/' + appId)).status, 403);
    assert.equal((await N.as('demo.donor').get(base + '/applications')).status, 403);
    assert.equal((await N.as('demo.donor').get(base + '/office')).status, 403);
    assert.equal((await N.as('demo.aadi.facilitator').get(base + '/suggest/' + person.id)).status, 403, 'youth group in another hamlet');
  });

  await t.test('documents: helper updates the checklist, family sees it', async () => {
    const r = await N.as('demo.facilitator').put(base + '/documents/' + person.id, { items: [{ doc: 'ration_card', status: 'applied', note: 'Applied at Taluk office' }, { doc: 'aadhaar', status: 'have' }] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await N.as('demo.facilitator').put(base + '/documents/' + person.id, { doc: 'nope', status: 'have' })).status, 400);
    const my = (await N.as('demo.gs.family').get(base + '/my')).body.members[0];
    assert.equal(my.documents.find((d) => d.key === 'ration_card').status, 'applied');
    assert.equal((await N.as('demo.gs.family').put(base + '/documents/' + person.id, { doc: 'aadhaar', status: 'missing' })).status, 403, 'family cannot edit the checklist');
  });

  await t.test('a learner sees only their own applications; guardian sees wards', async () => {
    const my = (await N.as('demo.learner').get(base + '/my')).body;
    assert.equal(my.members.length, 1);
    assert.equal(my.members[0].id, D.demoLearner.id);
    assert.ok(my.members[0].applications.length >= 1, 'demo learner has a seeded application');
    for (const a of my.members[0].applications) assert.ok(a.timeline.length >= 1);
    const all = (await N.req(await N.login('demo.learner'), 'GET', '/api/core/forms/submissions?module=govtservices')).body;
    assert.ok(all.every((s) => s.person_id === D.demoLearner.id));
    assert.equal((await N.as('demo.learner').get(base + '/applications/' + appId)).status, 403);
    const g = (await N.as('demo.guardian').get(base + '/my')).body;
    assert.ok(g.members.find((m) => m.id === D.demoLearner.id), 'guardian sees ward');
    assert.ok(g.members.every((m) => m.id === D.demoGuardian.id || D.persons.find((p) => p.id === m.id).guardian_id === D.demoGuardian.id));
  });

  await t.test('consent withdrawal removes the department\'s access', async () => {
    const c = B.store.find('consents', { person_id: person.id, agency_id: A.std.id, status: 'active' })[0];
    const r = await N.as('demo.gs.family').post('/api/core/consents/' + c.id + '/revoke');
    assert.equal(r.status, 200);
    assert.equal((await N.as('demo.akshaya').get(base + '/applications/' + appId)).status, 403);
    assert.ok(!(await N.as('demo.akshaya').get(base + '/applications')).body.find((x) => x.id === appId));
    assert.equal((await N.as('demo.akshaya').get(base + '/suggest/' + person.id)).status, 403);
    // withdrawing services consent from CIF removes the helper's access too
    const c2 = B.store.find('consents', { person_id: person.id, agency_id: A.cif.id, status: 'active' })[0];
    await N.as('demo.gs.family').post('/api/core/consents/' + c2.id + '/revoke');
    assert.equal((await N.as('demo.facilitator').get(base + '/suggest/' + person.id)).status, 403);
    assert.ok(!(await N.as('demo.facilitator').get(base + '/applications')).body.find((x) => x.id === appId));
  });

  await t.test('application without the family\'s agreement is flagged urgent and stays with the capturing agency', async () => {
    const kid = D.demoLearner;
    const s = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'govtservices.application', person_id: kid.id, answers: { scheme: 'aadhaar', purpose: 'Update', contact: 'next_visit', share_consent: 'no' }, client_ref: 'test-gs-noshare' });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.equal(s.body.priority, 3);
    assert.ok(s.body.flags.find((f) => f.code === 'no_share_consent' && f.level === 'urgent'));
  });

  await t.test('aggregate: suppressed small counts, no names, donor/govt allowed, facilitator refused', async () => {
    const r = await N.as('demo.donor').get(base + '/aggregate');
    assert.equal(r.status, 200);
    const txt = JSON.stringify(r.body);
    for (const p of D.persons.slice(0, 200)) assert.ok(!txt.includes(p.name), 'no names');
    assert.ok(!/per_[0-9a-z]{6,}/.test(txt), 'no person ids');
    assert.ok(txt.includes('"<5"'), 'small counts suppressed');
    const h = r.body.hamlets.find((x) => x.hamlet_id === H.h1.id);
    assert.ok(h && h.total !== undefined);
    assert.equal((await N.as('demo.govt').get(base + '/aggregate')).status, 200);
    assert.equal((await N.as('demo.facilitator').get(base + '/aggregate')).status, 403);
  });

  await t.test('per-hamlet switch off → 503 for staff there; submissions refused', async () => {
    B.setModuleInHamlet('govtservices', H.h11.id, false, null, 'Oorukoottam decision (test)');
    const r = await N.as('demo.aadi.facilitator').get(base + '/applications');
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'module_off_here');
    const kid = D.persons.find((p) => p.hamlet_id === H.h11.id && P.canSee(u('aadi.facilitator'), p.id, 'services').ok);
    if (kid) {
      const s = await N.as('demo.aadi.facilitator').post('/api/core/forms/submissions', { form_key: 'govtservices.application', person_id: kid.id, answers: { scheme: 'aadhaar', purpose: 'x1', contact: 'next_visit', share_consent: 'yes' } });
      assert.equal(s.status, 403);
    }
    assert.equal((await N.as('demo.facilitator').get(base + '/applications')).status, 200, 'other hamlets unaffected');
    B.setModuleInHamlet('govtservices', H.h11.id, true, null);
    assert.equal((await N.as('demo.aadi.facilitator').get(base + '/applications')).status, 200);
  });

  await t.test('form is re-defined robustly (idempotent; keeps the department forward)', async () => {
    const before = B.forms.getDef('govtservices.application');
    const r = await N.as('demo.akshaya').get(base + '/office');
    assert.equal(r.status, 200);
    assert.equal(r.body.forwarded_to, A.std.name);
    const after = B.forms.getDef('govtservices.application');
    assert.equal(after.version, before.version);
    assert.equal(after.review.agency_id, A.std.id);
  });

  await t.test('catalogue is bilingual and marked pending review', async () => {
    const c = (await N.as('demo.learner').get(base + '/catalogue')).body;
    assert.ok(c.schemes.length >= 15);
    assert.match(c.status, /PENDING REVIEW/);
    assert.equal(c.outcomes.length, 5);
  });
});
