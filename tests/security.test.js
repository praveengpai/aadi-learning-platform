'use strict';
// Regression tests for the independent security review of 1 Nov 2026 (findings C1–C4, H1–H7, M1, M4, M5, M8, L2).
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { bootDemo } = require('./helpers');

let N, D;
test.before(async () => { N = await bootDemo(); D = N.demo; });
test.after(async () => { await N.close(); });
const B = () => N.brain;
const user = (k) => B().store.get('users', D.users[k].id);
const agency = (name) => B().store.one('SELECT * FROM agencies WHERE name LIKE ? AND deleted=0', name);

test('C1: an agency admin cannot overwrite another account (steward takeover)', async () => {
  const st = user('steward');
  const r = await N.as('demo.vjt.admin').post('/api/core/users', { id: st.id, username: 'demo.steward', password: 'pwned12345', role: 'facilitator' });
  assert.equal(r.status, 400);
  const bad = await N.req(null, 'POST', '/api/core/auth/login', { username: 'demo.steward', password: 'pwned12345' });
  assert.equal(bad.status, 401);
  assert.equal((await N.req(null, 'POST', '/api/core/auth/login', { username: 'demo.steward', password: 'demo1234' })).status, 200);
});

test('C2: logins cannot be linked to a person, and admins cannot mint learner/steward accounts', async () => {
  const p = D.adults[0];
  assert.equal((await N.as('demo.cif.admin').post('/api/core/users', { username: 'spy.one', password: 'spy12345!', role: 'facilitator', person_id: p.id })).status, 400);
  assert.equal((await N.as('demo.cif.admin').post('/api/core/users', { username: 'spy.two', password: 'spy12345!', role: 'learner' })).status, 403);
  assert.equal((await N.as('demo.cif.admin').post('/api/core/users', { username: 'spy.three', password: 'spy12345!', role: 'platform_admin' })).status, 403);
});

test('C3: module SQL cannot reach sealed data by comma joins, quoted names, sub-queries or sealed modules\' tables', () => {
  const ctx = N.host._ctx(N.host.modules.get('learning'), express.Router(), 'learning_');
  for (const q of [
    "SELECT f.answers FROM learning_lessons x, form_submissions f WHERE f.module='health'",
    'SELECT * FROM "form_submissions"',
    'SELECT * FROM `form_submissions`',
    'SELECT * FROM [form_submissions]',
    'SELECT (SELECT answers FROM form_submissions LIMIT 1) a',
    'SELECT * FROM health_followups',
    'SELECT * FROM govtservices_documents',
    'SELECT * FROM health_form_rows',
    'SELECT 1; DELETE FROM persons',
  ]) assert.throws(() => ctx.sql(q), /may not read|one statement|read-only/, q);
  assert.ok(Array.isArray(ctx.sql("SELECT id FROM hamlets WHERE name='form_submissions'")), 'a string mentioning a table is fine');
});

test('C4: the event bus never hands another module\'s personal rows to a subscriber', async () => {
  const got = [];
  N.host.subs.push({ moduleId: 'learning', type: 'row.upsert', fn: (ev) => { if (ev.payload.table === 'form_submissions' || ev.payload.table === 'health_followups') got.push(ev.payload); } });
  const sub = B().store.one("SELECT * FROM form_submissions WHERE module='health' AND deleted=0");
  B().store.put('form_submissions', { ...sub, outcome: 'touched' });
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(got.length >= 1);
  for (const p of got) { assert.equal(p.redacted, true); assert.equal(p.row.answers, undefined); assert.deepEqual(Object.keys(p.row).sort(), ['deleted', 'hamlet_id', 'id']); }
});

test('H1: another agency cannot take over a shared survey form or forward it to itself', async () => {
  const vjt = D.agencyByKey.vjt.id;
  const r = await N.as('demo.vjt.admin').post('/api/core/forms/defs', { key: 'survey.household_basics', title: 'x', scope: 'survey', subject: 'household', review: { agency_id: vjt }, fields: [{ name: 'a', type: 'text', label: 'A' }] });
  assert.equal(r.status, 403);
  assert.equal(B().forms.getDef('survey.household_basics').module, 'surveys');
  const list = await N.as('demo.vjt.admin').get('/api/core/forms/submissions?form_key=survey.household_basics');
  assert.equal((list.body || []).length, 0);
});

test('H2: household answers disappear for staff once the head withdraws consent', async () => {
  const cif = D.agencyByKey.cif.id;
  const s = B().store.one("SELECT * FROM form_submissions WHERE form_key='survey.household_basics' AND deleted=0");
  assert.equal((await N.as('demo.facilitator').get('/api/core/forms/submissions/' + s.id)).status, 200);
  const hh = B().store.get('households', s.household_id);
  const c = B().store.find('consents', { person_id: hh.head_person_id, agency_id: cif, status: 'active' })[0];
  B().revokeConsent(c.id, null);
  assert.equal((await N.as('demo.facilitator').get('/api/core/forms/submissions/' + s.id)).status, 403);
});

test('H3: staff record consent only for their own agency', async () => {
  const phc = agency('%Primary Health Centre%');
  const elder = B().store.all('SELECT DISTINCT c.person_id id FROM consents c WHERE c.agency_id=? AND c.status=\'active\' AND c.deleted=0', phc.id)
    .map((r) => B().store.get('persons', r.id)).find((p) => p && p.hamlet_id === D.hamletByKey.h1.id && B().policy.enrolledWith(p.id, D.agencyByKey.vjt.id));
  const target = elder || B().store.get('persons', B().store.one('SELECT person_id FROM consents WHERE agency_id=? AND status=\'active\' AND deleted=0', phc.id).person_id);
  const before = B().store.find('consents', { person_id: target.id, agency_id: phc.id, status: 'active' })[0];
  const r = await N.as('demo.facilitator.vjt').post('/api/core/consents', { person_id: target.id, agency_id: phc.id, scopes: ['profile'] });
  const after = B().store.find('consents', { person_id: target.id, agency_id: phc.id, status: 'active' })[0];
  assert.equal(after.id, before.id, 'the health centre\'s consent is untouched');
  if (r.status === 200) assert.equal(r.body.agency_id, D.agencyByKey.vjt.id);
});

test('H4: guardians get no raw clinical answers, and nothing about an adult child', async () => {
  const r = await N.as('demo.guardian').get('/api/core/forms/submissions?module=health');
  assert.equal(r.status, 200);
  for (const s of r.body) { assert.deepEqual(s.answers, {}); assert.deepEqual(s.flags, []); }
  const adult = B().store.all('SELECT * FROM persons WHERE guardian_id=? AND deleted=0', D.demoGuardian.id).find((p) => !B().policy.isMinor(p));
  if (adult) {
    assert.ok(!r.body.some((s) => s.person_id === adult.id));
    assert.equal((await N.as('demo.guardian').get('/api/core/persons/' + adult.id)).status, 403);
  }
});

test('H5: an agency cannot take over another agency\'s programme, centre or presence', async () => {
  const prog = D.programmes.find((p) => p.agency_id === D.agencyByKey.cif.id);
  const r = await N.as('demo.vjt.admin').post('/api/core/programmes', { id: prog.id, title: 'hijacked' });
  assert.equal(r.status, 403);
  assert.notEqual(B().store.get('programmes', prog.id).title, 'hijacked');
  const mine = await N.as('demo.vjt.admin').post('/api/core/programmes', { title: 'New VJT class', hamlet_id: D.hamletByKey.h1.id, agency_id: D.agencyByKey.cif.id, track: 'tuition' });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.agency_id, D.agencyByKey.vjt.id, 'agency comes from the account, not the body');
});

test('H6: hamlet-limited staff cannot open people in other hamlets', async () => {
  const h2 = D.hamletByKey.h2.id;
  const p = B().store.all('SELECT * FROM persons WHERE hamlet_id=? AND deleted=0', h2).find((x) => B().policy.activeConsent(x.id, D.agencyByKey.cif.id, 'profile') && B().policy.enrolledWith(x.id, D.agencyByKey.cif.id));
  assert.ok(p);
  assert.equal((await N.as('demo.facilitator').get('/api/core/persons/' + p.id)).status, 403);
  assert.equal((await N.as('demo.facilitator2').get('/api/core/persons/' + p.id)).status, 200);
  assert.equal((await N.as('demo.facilitator').get('/api/m/govtservices/documents/' + p.id)).status, 403);
});

test('H7: health programme membership is hidden from education staff', async () => {
  const phc = agency('%Primary Health Centre%');
  const e = B().store.all('SELECT e.person_id FROM enrolments e JOIN programmes p ON p.id=e.programme_id WHERE e.agency_id=? AND e.deleted=0', phc.id)
    .find((x) => B().policy.canSee(user('facilitator'), x.person_id, 'profile').ok);
  assert.ok(e, 'a health-enrolled person the facilitator may see');
  const r = await N.as('demo.facilitator').get('/api/core/persons/' + e.person_id);
  assert.equal(r.status, 200);
  assert.ok(!(r.body.enrolments || []).some((x) => ['health', 'elder_care'].includes(x.track)));
  assert.ok(!JSON.stringify(r.body).includes('Primary Health Centre'));
});

test('M1: hamlet switches need presence; safeguarding cannot be disabled; switched-off service hides its records', async () => {
  const h3 = D.hamletByKey.h3 ? D.hamletByKey.h3.id : null;
  const notServed = D.hamlets.find((h) => !B().store.one("SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0 AND status='active'", D.agencyByKey.vjt.id, h.id));
  if (notServed) assert.equal((await N.as('demo.vjt.admin').post(`/api/core/modules/health/hamlets/${notServed.id}`, { enabled: false })).status, 403);
  assert.equal((await N.as('demo.vjt.admin').post(`/api/core/modules/health/hamlets/${D.hamletByKey.h1.id}`, { enabled: false })).status, 403, 'another agency cannot switch off the health centre\'s service');
  assert.equal((await N.as('demo.steward').post('/api/core/modules/safeguarding/disable')).status, 400);
  const h1 = D.hamletByKey.h1.id;
  const before = (await N.as('demo.asha').get('/api/core/forms/submissions?module=health')).body.length;
  assert.ok(before > 0);
  await N.as('demo.steward').post(`/api/core/modules/health/hamlets/${h1}`, { enabled: false });
  assert.equal((await N.as('demo.asha').get('/api/core/forms/submissions?module=health')).body.length, 0);
  await N.as('demo.steward').post(`/api/core/modules/health/hamlets/${h1}`, { enabled: true });
  void h3;
});

test('M4/M5: CSV cells cannot carry formulas; household forms never attach to a person', async () => {
  const hh = D.households.find((h) => h.hamlet_id === D.hamletByKey.h1.id && B().policy.activeConsent(h.head_person_id, D.agencyByKey.cif.id, 'survey'));
  const s = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'survey.household_basics', household_id: hh.id, person_id: D.demoLearner.id, answers: { members: 3, water: 'tap', power: 'yes', smartphone: 'no', notes: '=HYPERLINK("http://evil.example","x")' } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.person_id, null);
  const csv = await N.req(await N.login('demo.cif.admin'), 'GET', '/api/core/forms/export/survey.household_basics.csv');
  assert.ok(!/,"?=HYPERLINK/.test(String(csv.body)));
});

test('M8: safeguarding training cannot be self-declared or confirmed by another agency', async () => {
  const r = await N.as('demo.vjt.admin').post('/api/core/users', { username: 'vjt.newfac', password: 'longpass123', role: 'facilitator', safeguarding_trained: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.active, 0);
  assert.equal((await N.as('demo.agri.admin').post(`/api/core/users/${r.body.id}/safeguarding-trained`)).status, 403);
  assert.equal((await N.as('demo.vjt.admin').post(`/api/core/users/${r.body.id}/safeguarding-trained`)).status, 200);
});

test('L2: person lists are capped', async () => {
  const r = await N.as('demo.steward').get('/api/core/persons?limit=-1');
  assert.ok(r.body.length <= 500);
});

// ---- Wave 2 review (engine findings) ----
test('W2-1: schema-qualified names, pragmas and ATTACH cannot bypass the SQL guard', () => {
  const ctx = N.host._ctx(N.host.modules.get('learning'), express.Router(), 'learning_');
  for (const q of ['SELECT * FROM main.form_submissions', 'SELECT * FROM "main"."persons"', 'SELECT * FROM main . disaster_help_needed', 'SELECT * FROM temp.x', "SELECT * FROM pragma_table_info('persons')", "ATTACH 'x.db' AS y"]) assert.throws(() => ctx.sql(q), /may not|read-only/, q);
  assert.throws(() => ctx.data.find('main.persons', {}), /bad table name|may not/);
  assert.ok(Array.isArray(ctx.sql("SELECT id FROM hamlets WHERE name='main.x'")), 'a string mentioning main. is fine');
});

test('W2-2: guardians never see an adult child\'s form records through core routes', async () => {
  const adult = B().store.all('SELECT * FROM persons WHERE guardian_id=? AND deleted=0', D.demoGuardian.id).find((p) => !B().policy.isMinor(p));
  if (!adult) return;
  const def = B().forms.define('testsec', { key: 'testsec.note', title: 'Note', scope: 'profile', subject: 'person', review: null, fields: [{ name: 'x', type: 'text', label: 'X' }] });
  const s = B().forms.submit(user('steward'), { form_key: def.key, person_id: adult.id, answers: { x: 'private note about adult' } }, {});
  assert.equal((await N.as('demo.guardian').get('/api/core/forms/submissions/' + s.id)).status, 403);
  const list = (await N.as('demo.guardian').get('/api/core/forms/submissions')).body;
  assert.ok(!list.some((r) => r.id === s.id));
});

test('W2-3: the capturer cannot decide their own form through core routes; forwarded forms only by the receiving agency', async () => {
  const P = B().policy;
  const std = D.agencyByKey.std.id;
  const def = B().forms.define('testsec', { key: 'testsec.fwd', title: 'Forwarded', scope: 'progress', subject: 'person', review: { perm: 'forms.review', agency_id: std }, fields: [{ name: 'x', type: 'text', label: 'X' }] });
  const own = B().forms.define('testsec', { key: 'testsec.own', title: 'Own', scope: 'progress', subject: 'person', review: { perm: 'forms.review' }, fields: [{ name: 'x', type: 'text', label: 'X' }] });
  const person = D.children.find((c) => c.hamlet_id === D.hamletByKey.h1.id && P.canSee(user('cif.admin'), c.id, 'progress').ok);
  // capturer = CIF admin (has forms.review): cannot decide own capture
  const a = await N.as('demo.cif.admin').post('/api/core/forms/submissions', { form_key: own.key, person_id: person.id, answers: { x: 'a' } });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal((await N.as('demo.cif.admin').post(`/api/core/forms/submissions/${a.body.id}/reply`, { reply: 'approve myself', outcome: 'approved' })).status, 403);
  assert.equal((await N.as('demo.cif.admin').post(`/api/core/forms/submissions/${a.body.id}/close`, { outcome: 'approved' })).status, 403);
  // forwarded: the capturing agency's admin cannot decide it
  const b = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: def.key, person_id: person.id, answers: { x: 'b' } });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal((await N.as('demo.cif.admin').post(`/api/core/forms/submissions/${b.body.id}/reply`, { reply: 'all clear' })).status, 403);
  assert.equal((await N.as('demo.facilitator').post(`/api/core/forms/submissions/${b.body.id}/close`, {})).status, 403, 'capturer cannot close an unanswered forwarded form');
});

test('W2-4: redaction removes withdrawn content from the whole log and the chain still verifies', () => {
  const hh = B().store.one('SELECT * FROM households WHERE deleted=0');
  B().store.put('households', { ...hh, notes: 'SECRET-NOTE-123' });
  B().store.put('households', { ...B().store.get('households', hh.id), house_no: '7' });
  const n = B().store.redactRow('households', hh.id, ['notes']);
  assert.ok(n >= 2);
  assert.equal(B().store.one("SELECT COUNT(*) n FROM events WHERE payload LIKE '%SECRET-NOTE-123%'").n, 0);
  assert.equal(B().store.get('households', hh.id).notes, null);
  assert.equal(B().store.verifyChain().ok, true);
});
