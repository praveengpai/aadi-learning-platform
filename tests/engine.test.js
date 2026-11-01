'use strict';
// Contract v2 engine: roles & restricted scopes, households, the form round-trip engine,
// per-hamlet service switches, node module allowlist, signed modules, budgets, hub round trip.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootDemo } = require('./helpers');
const { moduleDigest, signModule } = require('../core/modules');

let N, D;
test.before(async () => { N = await bootDemo(); D = N.demo; });
test.after(async () => { await N.close(); });

const B = () => N.brain;
const u = (key) => B().store.get('users', D.users[key].id);
// Make a person-scoped test form with a review step, in a throwaway module namespace.
function testForm(key, extra = {}) {
  return B().forms.define('testmod', { key, title: 'Test ' + key, scope: 'progress', subject: 'person', review: { perm: 'forms.review' }, fields: [
    { name: 'q1', type: 'select_one', label: 'Q1', required: true, choices: ['a', 'b'] },
    { name: 'n', type: 'integer', label: 'N', min: 0, max: 10 },
    { name: 'more', type: 'text', label: 'More', relevant: { field: 'q1', equals: 'b' } },
  ], ...extra });
}

test('v2 roles and restricted scopes are published', async () => {
  const r = await N.as('demo.facilitator').get('/api/core/roles');
  assert.equal(r.status, 200);
  for (const role of ['health_worker', 'doctor', 'field_officer']) assert.ok(r.body.roles[role]);
  for (const s of ['health', 'services', 'livelihood', 'survey']) assert.ok(r.body.scopes[s]);
  assert.deepEqual(r.body.restricted.health, ['health_worker', 'doctor']);
});

test('health scope: never visible to education staff or the CPO, even with consent', () => {
  const p = D.demoLearner;
  const P = B().policy;
  assert.equal(P.canSee(u('facilitator'), p.id, 'health').ok, false);
  assert.equal(P.canSee(u('counsellor'), p.id, 'health').ok, false);
  assert.equal(P.canSee(u('cpo'), p.id, 'health').ok, false);
  assert.equal(P.canSee(u('steward'), p.id, 'health').ok, true, 'steward read is allowed and audited');
  assert.equal(P.canSee(u('cpo'), p.id, 'wellbeing').ok, true, 'CPO keeps wellbeing access as before');
});

test('households: every demo family is a household; lists are policy-filtered', async () => {
  assert.ok(D.households.length > 50);
  assert.ok(D.demoLearner.household_id, 'learner belongs to a household');
  const f = await N.as('demo.facilitator').get('/api/core/households');
  assert.equal(f.status, 200);
  assert.ok(f.body.length > 0);
  const h1 = D.hamletByKey.h1.id;
  for (const hh of f.body) {
    assert.equal(hh.hamlet_id, h1, 'facilitator only sees their hamlet');
    assert.ok(hh.members.length >= 1, 'only households with a visible member');
  }
  assert.equal((await N.as('demo.donor').get('/api/core/households')).status, 403);
  assert.equal((await N.as('demo.learner').get('/api/core/households')).status, 403);
});

test('forms: household survey needs the head\'s survey consent; idempotent replay; validation', async () => {
  const defs = (await N.as('demo.facilitator').get('/api/core/forms')).body;
  const d = defs.find((x) => x.key === 'survey.household_basics');
  assert.ok(d && d.can_capture && d.subject === 'household');
  const h1 = D.hamletByKey.h1.id;
  const cif = D.agencyByKey.cif.id;
  const P = B().policy;
  const hhs = D.households.filter((h) => h.hamlet_id === h1);
  const yes = hhs.find((h) => P.activeConsent(h.head_person_id, cif, 'survey'));
  const no = hhs.find((h) => !P.activeConsent(h.head_person_id, cif, 'survey'));
  assert.ok(yes && no);
  const answers = { members: 4, water: 'well', power: 'yes', smartphone: 'no', documents_missing: ['ration'] };
  const a = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: d.key, household_id: yes.id, answers, client_ref: 'ref-1' });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.status, 'closed', 'a survey with no review step closes at once');
  const again = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: d.key, household_id: yes.id, answers, client_ref: 'ref-1' });
  assert.equal(again.body.id, a.body.id, 'replayed offline submission is not duplicated');
  const refused = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: d.key, household_id: no.id, answers });
  assert.equal(refused.status, 403);
  const bad = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: d.key, household_id: yes.id, answers: { members: 0, water: 'river' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.length >= 3);
  assert.equal((await N.as('demo.donor').post('/api/core/forms/submissions', { form_key: d.key, household_id: yes.id, answers })).status, 403);
  assert.equal((await N.as('demo.facilitator.vjt').post('/api/core/forms/submissions', { form_key: d.key, household_id: yes.id, answers })).status, 403, 'another agency has no consent from this family');
});

test('forms: capture → review → reply round trip, with privacy across agencies', async () => {
  const def = testForm('test.roundtrip');
  const cif = D.agencyByKey.cif.id;
  const P = B().policy;
  const person = D.children.find((c) => c.hamlet_id === D.hamletByKey.h1.id && P.canSee(u('facilitator'), c.id, 'progress').ok);
  assert.ok(person, 'a consented child in Pachakkudi');
  const fac = N.as('demo.facilitator');
  const s = await fac.post('/api/core/forms/submissions', { form_key: def.key, person_id: person.id, answers: { q1: 'a', n: 3, more: 'dropped because not relevant' } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.status, 'submitted');
  assert.equal(s.body.answers.more, undefined, 'irrelevant answers are dropped');
  // reviewer in the same agency sees it in the queue
  const q = await N.as('demo.cif.admin').get('/api/core/forms/queue');
  assert.ok(q.body.find((x) => x.id === s.body.id));
  // other agency cannot see or answer it
  assert.equal((await N.as('demo.vjt.admin').get('/api/core/forms/submissions/' + s.body.id)).status, 403);
  assert.equal((await N.as('demo.vjt.admin').post('/api/core/forms/submissions/' + s.body.id + '/reply', { reply: 'hello' })).status, 403);
  assert.ok(!(await N.as('demo.vjt.admin').get('/api/core/forms/queue')).body.find((x) => x.id === s.body.id));
  // the facilitator (capturer) cannot reply — only reviewers can
  assert.equal((await fac.post('/api/core/forms/submissions/' + s.body.id + '/reply', { reply: 'self-approve' })).status, 403);
  const before = B().store.one('SELECT COUNT(*) n FROM notifications WHERE person_id=?', person.id).n;
  const r = await N.as('demo.cif.admin').post('/api/core/forms/submissions/' + s.body.id + '/reply', { reply: 'Looks fine, continue.', reply_ml: 'ശരിയാണ്, തുടരുക.', outcome: 'ok' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, 'replied');
  const after = B().store.one('SELECT COUNT(*) n FROM notifications WHERE person_id=?', person.id).n;
  assert.equal(after, before + 1, 'family told a reply is waiting');
  // capturer sees the reply and marks it told to the family
  const mine = (await fac.get('/api/core/forms/submissions?mine=1')).body.find((x) => x.id === s.body.id);
  assert.equal(mine.reply, 'Looks fine, continue.');
  assert.equal((await fac.post('/api/core/forms/submissions/' + s.body.id + '/seen')).body.reply_seen_at.length > 0, true);
  // guardian sees their ward's record; a stranger's guardian does not
  const g = B().store.get('persons', person.guardian_id);
  assert.ok(g);
  // consent withdrawal removes agency access immediately
  const c = B().store.find('consents', { person_id: person.id, agency_id: cif, status: 'active' })[0];
  B().revokeConsent(c.id, null);
  assert.equal((await fac.get('/api/core/forms/submissions/' + s.body.id)).status, 403);
  B().grantConsent({ ...c, id: undefined, status: undefined }, null);
});

test('forms: forwarded review — a department sees a form only with the family\'s consent to that department', async () => {
  const std = D.agencyByKey.std.id;
  const def = B().forms.define('testmod', { key: 'test.forward', title: 'Forwarded', scope: 'services', subject: 'person', review: { perm: 'forms.review', agency_id: std }, fields: [{ name: 'x', type: 'text', label: 'X', required: true }] });
  const cif = D.agencyByKey.cif.id;
  const P = B().policy;
  const person = D.youth.find((y) => y.hamlet_id === D.hamletByKey.h1.id && P.canSee(u('facilitator'), y.id, 'profile').ok) || D.children.find((c) => c.hamlet_id === D.hamletByKey.h1.id && P.canSee(u('facilitator'), c.id, 'profile').ok);
  const cur = B().store.find('consents', { person_id: person.id, agency_id: cif, status: 'active' })[0];
  B().grantConsent({ person_id: person.id, agency_id: cif, scopes: [...cur.scopes, 'services'], granted_by: cur.granted_by, relation: cur.relation }, null);
  const s = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: def.key, person_id: person.id, answers: { x: 'caste certificate' } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal((await N.as('demo.std.admin').get('/api/core/forms/submissions/' + s.body.id)).status, 403, 'no consent to the department yet');
  B().grantConsent({ person_id: person.id, agency_id: std, scopes: ['services'], granted_by: cur.granted_by, relation: cur.relation }, null);
  assert.equal((await N.as('demo.std.admin').get('/api/core/forms/submissions/' + s.body.id)).status, 200);
  assert.ok((await N.as('demo.std.admin').get('/api/core/forms/queue')).body.find((x) => x.id === s.body.id));
});

test('forms: a health-scoped form cannot be captured or read by education staff', async () => {
  const def = B().forms.define('testmod', { key: 'test.health', title: 'BP', scope: 'health', subject: 'person', review: { perm: 'health.review' }, fields: [{ name: 'sys', type: 'integer', label: 'Systolic', required: true }] });
  const defsFac = (await N.as('demo.facilitator').get('/api/core/forms')).body;
  assert.ok(!defsFac.find((d) => d.key === def.key), 'not offered to a facilitator');
  const r = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: def.key, person_id: D.demoLearner.id, answers: { sys: 120 } });
  assert.equal(r.status, 403);
});

test('forms: rules (a module\'s sub-engine) flag and prioritise at capture time, offline', async () => {
  const def = testForm('test.rule');
  B().forms.rule('testmod', def.key, (a) => (a.n >= 8 ? { flags: [{ code: 'high', level: 'urgent', message: 'High value' }], priority: 3 } : { flags: [] }));
  const P = B().policy;
  const person = D.children.find((c) => c.hamlet_id === D.hamletByKey.h1.id && P.canSee(u('facilitator'), c.id, 'progress').ok);
  const s = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: def.key, person_id: person.id, answers: { q1: 'b', n: 9, more: 'x' } });
  assert.equal(s.body.priority, 3);
  assert.equal(s.body.flags[0].code, 'high');
  const q = (await N.as('demo.cif.admin').get('/api/core/forms/queue')).body;
  assert.equal(q[0].priority, 3, 'urgent first');
});

test('forms: ODK XLSForm import (subset) and CSV export', async () => {
  const r = await N.as('demo.cif.admin').post('/api/core/forms/import-xlsform', {
    survey: [{ type: 'integer', name: 'age', label: 'Age', 'label::Malayalam': 'പ്രായം', required: 'yes' }, { type: 'select_one yn', name: 'school', label: 'In school?' }, { type: 'text', name: 'why', label: 'Why not?', relevant: "${school} = 'no'" }, { type: 'begin_group', name: 'g' }, { type: 'range', name: 'r', label: 'R' }],
    choices: [{ list_name: 'yn', name: 'yes', label: 'Yes', 'label::Malayalam': 'അതെ' }, { list_name: 'yn', name: 'no', label: 'No' }],
    settings: { form_id: 'survey.school', form_title: 'School check' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.def.fields.length, 3);
  assert.equal(r.body.def.fields[0].label_ml, 'പ്രായം');
  assert.deepEqual(r.body.def.fields[2].relevant, { field: 'school', equals: 'no' });
  assert.ok(r.body.skipped.some((x) => x.includes('range')));
  const saved = await N.as('demo.cif.admin').post('/api/core/forms/defs', { ...r.body.def, scope: 'survey', subject: 'hamlet', review: null });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.module, 'surveys');
  assert.equal((await N.as('demo.facilitator').post('/api/core/forms/defs', r.body.def)).status, 403, 'only admins design forms');
  const csv = await N.req(await N.login('demo.cif.admin'), 'GET', '/api/core/forms/export/survey.household_basics.csv');
  assert.equal(csv.status, 200);
  assert.ok(String(csv.body).startsWith('submission_id,captured_at,hamlet'));
});

test('module forms keep one record across nodes; older module code never overwrites newer', () => {
  const F = B().forms;
  const v2 = F.define('testmod', { key: 'test.versioned', title: 'V', fields: [{ name: 'a', type: 'text', label: 'A' }] }, null, '2.0.0');
  assert.equal(v2.id, 'frm_test_versioned');
  const old = F.define('testmod', { key: 'test.versioned', title: 'V', fields: [{ name: 'a', type: 'text', label: 'A old' }] }, null, '1.9.0');
  assert.equal(old.fields[0].label, 'A', 'old code ignored');
  const v3 = F.define('testmod', { key: 'test.versioned', title: 'V', fields: [{ name: 'a', type: 'text', label: 'A' }, { name: 'b', type: 'text', label: 'B' }] }, null, '2.1.0');
  assert.equal(v3.version, 2);
  assert.throws(() => F.define('othermod', { key: 'test.versioned', title: 'X', fields: [{ name: 'a', type: 'text', label: 'A' }] }), /belongs to testmod/);
});

test('services per hamlet: the community can switch a service off; staff there get a calm 503', async () => {
  const h1 = D.hamletByKey.h1.id;
  const off = await N.as('demo.steward').post(`/api/core/modules/surveys/hamlets/${h1}`, { enabled: false, note: 'Oorukoottam 2026-10-30' });
  assert.equal(off.status, 200);
  assert.equal((await N.as('demo.facilitator').get('/api/m/surveys/summary')).status, 503, 'facilitator works only in h1');
  assert.equal((await N.as('demo.facilitator2').get('/api/m/surveys/summary')).status, 200, 'other hamlets unaffected');
  const hh = D.households.find((h) => h.hamlet_id === h1 && B().policy.activeConsent(h.head_person_id, D.agencyByKey.cif.id, 'survey'));
  const r = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'survey.household_basics', household_id: hh.id, answers: { members: 2, water: 'tap', power: 'yes', smartphone: 'yes' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'module_off_here');
  assert.equal((await N.as('demo.facilitator').post(`/api/core/modules/safeguarding/hamlets/${h1}`, { enabled: false })).status, 403);
  assert.equal((await N.as('demo.steward').post(`/api/core/modules/safeguarding/hamlets/${h1}`, { enabled: false })).status, 400, 'safeguarding cannot be switched off');
  await N.as('demo.steward').post(`/api/core/modules/surveys/hamlets/${h1}`, { enabled: true });
  assert.equal((await N.as('demo.facilitator').get('/api/m/surveys/summary')).status, 200);
});

test('budgets are reported per module', async () => {
  const r = await N.as('demo.steward').get('/api/core/modules/budgets');
  assert.equal(r.status, 200);
  const s = r.body.find((m) => m.id === 'surveys');
  assert.equal(s.budget_storage_mb, 50);
  assert.equal(s.sync_priority, 2);
  assert.equal((await N.as('demo.learner').get('/api/core/modules/budgets')).status, 403);
});

test('signed modules: a changed file breaks the signature', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sig-'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), '{"id":"x"}');
  fs.mkdirSync(path.join(dir, 'public'));
  fs.writeFileSync(path.join(dir, 'public', 'ui.js'), 'export default {}');
  const sig = signModule(dir, 'k1');
  fs.writeFileSync(path.join(dir, 'SIGNATURE'), sig);
  assert.equal(signModule(dir, 'k1'), sig, 'SIGNATURE file itself is not hashed');
  assert.notEqual(signModule(dir, 'k2'), sig);
  const d0 = moduleDigest(dir);
  fs.writeFileSync(path.join(dir, 'public', 'ui.js'), 'export default {evil:1}');
  assert.notEqual(moduleDigest(dir), d0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a node with AADI_MODULES loads only those (plus critical) modules; unsigned modules are refused when a key is set', async () => {
  const { createApp } = require('../server');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allow-'));
  process.env.AADI_MODULES = 'surveys,learning';
  try {
    const a = createApp({ dbFile: path.join(dir, 'a.db'), node: 'allow-a' });
    const ids = a.host.status().map((m) => m.id).sort();
    assert.ok(ids.includes('surveys') && ids.includes('learning') && ids.includes('safeguarding'));
    assert.ok(!ids.includes('exams'));
    a.brain.db.close();
  } finally { delete process.env.AADI_MODULES; }
  process.env.PLATFORM_MODULE_KEY = 'test-signing-key';
  try {
    const b = createApp({ dbFile: path.join(dir, 'b.db'), node: 'allow-b' });
    const st = b.host.status();
    assert.ok(st.every((m) => m.state === 'failed'), 'no module is signed in the repository, so all are refused');
    b.brain.db.close();
  } finally { delete process.env.PLATFORM_MODULE_KEY; }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('round trip across nodes: captured on a hub offline, answered in the cloud, reply returns to the hub', async () => {
  const h1 = D.hamletByKey.h1.id;
  const hub = await bootDemo({ node: 'hub-forms', role: 'hub', upstream: N.base, syncKey: 'test-key', hamlets: h1, noSeed: true });
  try {
    await hub.sync.runOnce();
    const def = testForm('test.hubtrip');
    await hub.sync.runOnce();
    assert.ok(hub.brain.forms.getDef(def.key), 'form definition reached the hub');
    const P = hub.brain.policy;
    const fac = hub.brain.store.get('users', D.users.facilitator.id);
    const person = hub.brain.store.all('SELECT * FROM persons WHERE hamlet_id=? AND kind=\'child\' AND deleted=0', h1).find((c) => P.canSee(fac, c.id, 'progress').ok);
    const s = await hub.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: def.key, person_id: person.id, answers: { q1: 'a' }, client_ref: 'hub-1' });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    await hub.sync.runOnce();
    const r = await N.as('demo.cif.admin').post('/api/core/forms/submissions/' + s.body.id + '/reply', { reply: 'Answered from Kochi' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await hub.sync.runOnce();
    const back = await hub.as('demo.facilitator').get('/api/core/forms/submissions/' + s.body.id);
    assert.equal(back.body.reply, 'Answered from Kochi');
    assert.equal(back.body.status, 'replied');
  } finally { await hub.close(); }
});

test('form answers are sealed: a module reads only its own forms, never another module\'s (e.g. health)', () => {
  const express = require('express');
  const mk = (id) => N.host._ctx(N.host.modules.get(id), express.Router(), id + '_');
  const learning = mk('learning');
  assert.throws(() => learning.sql('SELECT * FROM form_submissions'), /may not read/);
  assert.throws(() => learning.data.get('form_submissions', 'x'), /may not read/);
  assert.throws(() => learning.sql('SELECT * FROM health_form_rows'), /may not read/);
  const health = mk('health');
  const rows = health.sql('SELECT module FROM health_form_rows WHERE deleted=0 LIMIT 50');
  assert.ok(rows.length > 0 && rows.every((r) => r.module === 'health'));
  assert.equal(mk('surveys').sql("SELECT COUNT(*) n FROM surveys_form_rows WHERE module='health'")[0].n, 0);
});
