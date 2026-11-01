'use strict';
// Disaster Preparedness module: family plans need the head's "emergency" consent; the people-needing-help
// list is visible only to responders of a consented agency; consent withdrawal removes people; incident
// round trip (road blocked → urgent → reply); warnings issued only by admins; mass-assignment refused;
// hamlet-limited staff refused outside their hamlets; k-anonymised aggregate with complementary
// suppression; per-hamlet switch → 503.
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');
const { incidentRule, planRule, CELL_ID } = require('../modules/disaster');

let N, D, B;
test.before(async () => { N = await bootDemo(); D = N.demo; B = N.brain; });
test.after(async () => { await N.close(); });

const user = (username) => B.store.one('SELECT * FROM users WHERE username=? AND deleted=0', username);
const H = () => D.hamletByKey;
const M = '/api/m/disaster';
const tick = () => new Promise((r) => setTimeout(r, 40));
const listed = () => B.store.all('SELECT * FROM disaster_help_needed WHERE deleted=0');
const INCIDENT = { what: ['landslide'], date: new Date().toISOString().slice(0, 10), people_affected: 3, people_injured: 0, houses_damaged: 0, road_blocked: 'no' };

test('seed: fictional cell, users, programmes, profiles, plans, help entries, demo warnings, incidents', () => {
  const cell = B.store.get('agencies', CELL_ID);
  assert.equal(cell.name, 'Demo District Disaster Cell (fictional)');
  assert.equal(user('demo.ddma').role, 'field_officer');
  assert.equal(user('demo.ddma').agency_id, CELL_ID);
  assert.equal(user('demo.ddma').safeguarding_trained, 1);
  assert.equal(user('demo.ddma.admin').role, 'agency_admin');
  for (const hk of ['h1', 'h2', 'h11']) {
    assert.ok(B.store.one("SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0", CELL_ID, H()[hk].id), 'presence ' + hk);
    assert.ok(B.store.one("SELECT 1 x FROM programmes WHERE agency_id=? AND hamlet_id=? AND module='disaster' AND track='disaster' AND deleted=0", CELL_ID, H()[hk].id), 'programme ' + hk);
    assert.ok(B.store.get('disaster_risk_profiles', 'dsr_' + H()[hk].id), 'profile ' + hk);
  }
  assert.ok(B.store.one("SELECT COUNT(*) n FROM form_submissions WHERE form_key='disaster.family_plan'").n >= 15);
  assert.ok(listed().length >= 3);
  const ws = B.store.all('SELECT * FROM disaster_warnings WHERE deleted=0');
  assert.ok(ws.length >= 2 && ws.length <= 3);
  for (const w of ws) { assert.equal(w.is_demo, 1); assert.match(w.title, /^DEMO — not a real warning/); }
  assert.ok(B.store.one("SELECT COUNT(*) n FROM form_submissions WHERE form_key='disaster.incident_report'").n >= 2);
  // seeded consent merged scopes, did not wipe them
  const g = B.store.find('consents', { person_id: D.demoGuardian.id, agency_id: CELL_ID, status: 'active' })[0];
  assert.ok(g && ['profile', 'emergency', 'survey'].every((s) => g.scopes.includes(s)));
  assert.ok(B.policy.RESTRICTED.emergency, 'emergency is a restricted scope');
  assert.deepEqual(B.policy.RESTRICTED.emergency.roles, ['field_officer', 'coordinator', 'agency_admin']);
});

test('rules: road blocked or people hurt → urgent priority 3; plan help → add-to-list flag', () => {
  assert.equal(incidentRule({ ...INCIDENT, road_blocked: 'yes' }).priority, 3);
  assert.equal(incidentRule({ ...INCIDENT, people_injured: 2 }).priority, 3);
  assert.equal(incidentRule({ ...INCIDENT, road_blocked: 'yes' }).flags[0].level, 'urgent');
  assert.equal(incidentRule(INCIDENT).priority, 0);
  assert.equal(incidentRule({ ...INCIDENT, houses_damaged: 1 }).priority, 2);
  assert.ok(planRule({ help_needed: ['cannot_walk_far'], has_torch: 'yes', has_water: 'yes', has_medicine_kit: 'yes', documents_safe: 'yes' }).flags.some((f) => f.code === 'add_to_help_list'));
  assert.ok(!planRule({ help_needed: ['none'], has_torch: 'yes', has_water: 'yes', has_medicine_kit: 'yes', documents_safe: 'yes' }).flags.length);
});

test('hamlet board: warning banner (demo-labelled), assembly points, helplines marked verify locally', async () => {
  const r = await N.as('demo.guardian').get(`${M}/board`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.hamlet.id, H().h1.id);
  assert.ok(r.body.warnings.length >= 1 && r.body.warnings[0].is_demo && r.body.warnings[0].active);
  assert.ok(r.body.profile.points.some((p) => p.kind === 'assembly'));
  assert.ok(r.body.profile.contacts.some((c) => c.number === '112') && r.body.profile.contacts.some((c) => c.number === '1077'));
  assert.ok(r.body.profile.contacts.every((c) => c.verify === true));
  assert.equal(r.body.checklist, null, 'families do not get the staff checklist');
  const fo = await N.as('demo.ddma').get(`${M}/board?hamlet_id=${H().h2.id}`);
  assert.equal(fo.status, 200);
  assert.equal(fo.body.checklist.length, 6);
  assert.equal(fo.body.can.help, true);
  assert.equal(fo.body.can.issue, false, 'field officers do not issue warnings');
});

test('family plan needs the head\'s "emergency" consent for the agency', async () => {
  const ddma = N.as('demo.ddma');
  const hh = D.households.find((x) => x.hamlet_id === H().h1.id && !B.policy.activeConsent(x.head_person_id, CELL_ID, 'emergency') && !B.policy.isMinor(B.store.get('persons', x.head_person_id)));
  assert.ok(hh, 'a household without emergency consent');
  const answers = { meeting_point: 'Community hall ground', contact: 'Ward member', help_needed: ['young_children'], documents_safe: 'yes', has_torch: 'yes', has_water: 'no', has_medicine_kit: 'yes' };
  const no = await ddma.post('/api/core/forms/submissions', { form_key: 'disaster.family_plan', household_id: hh.id, answers });
  assert.equal(no.status, 403);
  assert.match(no.body.message, /emergency/);
  // A CIF facilitator cannot capture plans at all (restricted scope), even with consent elsewhere.
  const g = D.households.find((x) => x.head_person_id === D.demoGuardian.id);
  assert.equal((await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'disaster.family_plan', household_id: g.id, answers })).status, 403);
  // Bring the family in: profile consent + enrolment (core), then the emergency consent read aloud.
  assert.equal((await ddma.post('/api/core/consents', { person_id: hh.head_person_id, scopes: ['profile'] })).status, 200);
  const prog = B.store.one("SELECT * FROM programmes WHERE agency_id=? AND hamlet_id=? AND module='disaster' AND deleted=0", CELL_ID, H().h1.id);
  assert.equal((await ddma.post('/api/core/enrolments', { person_id: hh.head_person_id, programme_id: prog.id })).status, 200);
  assert.equal((await ddma.post(`${M}/consent`, { person_id: hh.head_person_id })).status, 400, 'must confirm it was read aloud');
  const c = await ddma.post(`${M}/consent`, { person_id: hh.head_person_id, read_aloud: true });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.ok(c.body.scopes.includes('emergency') && c.body.scopes.includes('profile'), 'scopes merged');
  const ok = await ddma.post('/api/core/forms/submissions', { form_key: 'disaster.family_plan', household_id: hh.id, answers, client_ref: 'plan-t1' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.status, 'closed', 'no review step');
  assert.ok(ok.body.flags.some((f) => f.code === 'add_to_help_list'));
  assert.ok(ok.body.flags.some((f) => f.code === 'kit_incomplete'));
  const list = await ddma.get(`${M}/households?hamlet_id=${H().h1.id}`);
  assert.ok(list.body.households.find((x) => x.id === hh.id && x.plan && x.plan.help_needed.includes('young_children')));
  const help = await ddma.get(`${M}/help?hamlet_id=${H().h1.id}`);
  assert.ok(help.body.households.some((x) => x.household_id === hh.id), 'the plan surfaces on the responders\' list');
});

test('people-needing-help list: the cell\'s field officer sees it; others do not', async () => {
  const h1 = H().h1.id;
  const r = await N.as('demo.ddma').get(`${M}/help?hamlet_id=${h1}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.people.length >= 1, 'people listed in Pachakkudi');
  const p = r.body.people[0];
  assert.ok(p.name && p.needs.length);
  assert.ok(!('dob' in p) && !('phone' in p), 'no contact or date of birth on the list');
  assert.match(r.body.confidential, /CONFIDENTIAL/);
  for (const who of ['demo.facilitator', 'demo.teacher', 'demo.donor', 'demo.govt', 'demo.asha', 'demo.guardian', 'demo.cpo', 'demo.counsellor']) {
    const x = await N.as(who).get(`${M}/help?hamlet_id=${h1}`);
    assert.ok([403, 503].includes(x.status), who + ' → ' + x.status);
    assert.ok(!JSON.stringify(x.body).includes(p.name), who + ' sees no names');
  }
  // Another agency's responders (CIF coordinator, Krishi Bhavan officer, Vanajyothi admin) see an empty list.
  for (const who of ['demo.coordinator', 'demo.agri', 'demo.vjt.admin']) {
    const x = await N.as(who).get(`${M}/help?hamlet_id=${h1}`);
    assert.equal(x.status, 200, who);
    assert.equal(x.body.people.length, 0, who + ' sees no one without consent to their agency');
    assert.equal(x.body.households.length, 0, who);
  }
  // The cell's admin sees it; the steward sees it (audited).
  assert.ok((await N.as('demo.ddma.admin').get(`${M}/help?hamlet_id=${h1}`)).body.people.length >= 1);
  const before = B.store.one("SELECT COUNT(*) n FROM events WHERE type='audit.disaster.steward.help_read'").n;
  assert.ok((await N.as('demo.steward').get(`${M}/help?hamlet_id=${h1}`)).body.people.length >= 1);
  assert.ok(B.store.one("SELECT COUNT(*) n FROM events WHERE type='audit.disaster.steward.help_read'").n > before, 'steward access is audited');
  // Other modules cannot read the sealed tables.
  const express = require('express');
  const ctx = N.host._ctx(N.host.modules.get('learning'), express.Router(), 'learning_');
  assert.throws(() => ctx.sql('SELECT * FROM disaster_help_needed'), /sealed|may not read/);
  assert.throws(() => ctx.sql('SELECT * FROM disaster_form_rows'), /may not read/);
});

test('consent withdrawal removes a person from the list (and the stored entry)', async () => {
  const h1 = H().h1.id;
  const ddma = N.as('demo.ddma');
  const r = await ddma.get(`${M}/help?hamlet_id=${h1}`);
  const p = r.body.people[0];
  const c = B.store.find('consents', { person_id: p.person_id, agency_id: CELL_ID, status: 'active' })[0];
  B.revokeConsent(c.id, null);
  await tick();
  const after = await ddma.get(`${M}/help?hamlet_id=${h1}`);
  assert.ok(!after.body.people.some((x) => x.person_id === p.person_id), 'gone from the list');
  assert.ok(!listed().some((x) => x.person_id === p.person_id), 'entry deleted (data minimisation)');
  assert.equal((await ddma.put(`${M}/help/${p.person_id}`, { needs: ['cannot_walk_far'] })).status, 403, 'cannot be re-added without consent');
  // A plan by that household (if the person was the head) is no longer visible either.
  const hh = B.store.get('persons', p.person_id).household_id;
  const plans = (await ddma.get(`${M}/plans?hamlet_id=${h1}`)).body;
  assert.ok(!plans.some((s) => s.household_id === hh && B.store.get('households', hh).head_person_id === p.person_id));
});

test('incident: road blocked → urgent in the cell\'s queue → reply reaches the capturer', async () => {
  const fac = N.as('demo.facilitator');
  const s = await fac.post('/api/core/forms/submissions', { form_key: 'disaster.incident_report', hamlet_id: H().h1.id, answers: { ...INCIDENT, road_blocked: 'yes', needs: ['road_clearing'], details: 'Slip across the jeep track' }, client_ref: 'inc-t1' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.priority, 3);
  assert.equal(s.body.status, 'submitted');
  assert.ok(s.body.flags.some((f) => f.code === 'road_blocked' && f.level === 'urgent'));
  const q = await N.as('demo.ddma').get(`${M}/incidents`);
  assert.equal(q.status, 200);
  assert.equal(q.body.can_review, true);
  assert.equal(q.body.queue[0].priority, 3, 'urgent first');
  assert.ok(q.body.queue.some((x) => x.id === s.body.id), 'forwarded to the district cell');
  assert.equal((await fac.post(`${M}/incidents/${s.body.id}/reply`, { reply: 'x' })).status, 403, 'facilitator cannot answer');
  assert.equal((await N.as('demo.donor').get(`${M}/incidents/${s.body.id}`)).status, 403);
  assert.equal((await N.as('demo.facilitator.vjt').get(`${M}/incidents/${s.body.id}`)).status, 403, 'another agency');
  const r = await N.as('demo.ddma').post(`${M}/incidents/${s.body.id}/reply`, { reply: 'Road team informed; avoid the track.', reply_ml: 'റോഡ് വിഭാഗത്തെ അറിയിച്ചു.', outcome: 'road_team_informed' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, 'replied');
  const mine = (await fac.get(`${M}/incidents?hamlet_id=${H().h1.id}`)).body.recent.find((x) => x.id === s.body.id);
  assert.match(mine.reply, /Road team informed/);
  assert.equal(mine.outcome, 'road_team_informed');
  // injured → urgent too
  const s2 = await N.as('demo.ddma').post('/api/core/forms/submissions', { form_key: 'disaster.incident_report', hamlet_id: H().h2.id, answers: { ...INCIDENT, people_injured: 1 } });
  assert.equal(s2.body.priority, 3);
});

test('warnings: only agency admins / stewards issue; families see them; demo label cannot be faked', async () => {
  const body = { hamlet_ids: [H().h1.id], level: 'red', title: 'Landslide risk — move to the assembly point', title_ml: 'ഉരുൾപൊട്ടൽ സാധ്യത — ഒത്തുചേരൽ സ്ഥലത്തേക്ക് മാറുക', body: 'Move now to the community hall ground. Help those who cannot walk far.', source: 'District Collector order' };
  for (const who of ['demo.ddma', 'demo.facilitator', 'demo.coordinator', 'demo.donor', 'demo.guardian', 'demo.asha']) assert.equal((await N.as(who).post(`${M}/warnings`, body)).status, 403, who);
  assert.equal((await N.as('demo.vjt.admin').post(`${M}/warnings`, { ...body, hamlet_ids: [H().h2.id] })).status, 403, 'agency not present in that hamlet');
  assert.equal((await N.as('demo.ddma.admin').post(`${M}/warnings`, { ...body, source: 'demo' })).status, 400);
  assert.equal((await N.as('demo.ddma.admin').post(`${M}/warnings`, { ...body, level: 'purple' })).status, 400);
  const ok = await N.as('demo.ddma.admin').post(`${M}/warnings`, body);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.is_demo, false);
  assert.equal(ok.body.active, true);
  const fam = await N.as('demo.guardian').get(`${M}/board`);
  assert.equal(fam.body.warnings[0].id, ok.body.id, 'red warning shown first on the hub home');
  assert.equal(fam.body.warnings[0].level, 'red');
  // only the issuing agency (or steward) can cancel
  assert.equal((await N.as('demo.cif.admin').post(`${M}/warnings/${ok.body.id}/cancel`)).status, 403);
  assert.equal((await N.as('demo.ddma.admin').post(`${M}/warnings/${ok.body.id}/cancel`)).status, 200);
  assert.ok(!(await N.as('demo.guardian').get(`${M}/board`)).body.warnings.some((w) => w.id === ok.body.id));
});

test('mass assignment: ids, agency, hamlet, issuer and demo flags from the client are ignored or refused', async () => {
  const ddma = N.as('demo.ddma');
  // Help entry: hamlet / household / agency come from the person record and the account.
  const cand = (await ddma.get(`${M}/help/candidates?hamlet_id=${H().h2.id}`)).body.find((p) => p.emergency);
  assert.ok(cand, 'a consented person in Thenmala');
  const r = await ddma.put(`${M}/help/${cand.id}`, { needs: ['needs_medicines'], person_id: D.demoLearner.id, hamlet_id: H().h3.id, household_id: 'hh_fake', agency_id: D.agencyByKey.cif.id, id: 'dsh_evil', recorded_by: user('demo.steward').id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const row = B.store.one('SELECT * FROM disaster_help_needed WHERE person_id=? AND deleted=0', cand.id);
  assert.equal(row.hamlet_id, H().h2.id);
  assert.equal(row.agency_id, CELL_ID);
  assert.equal(row.recorded_by, user('demo.ddma').id);
  assert.ok(!B.store.get('disaster_help_needed', 'dsh_evil'));
  assert.ok(!B.store.one('SELECT 1 x FROM disaster_help_needed WHERE person_id=? AND deleted=0', D.demoLearner.id));
  assert.equal((await ddma.put(`${M}/help/${cand.id}`, { needs: ['pregnant'] })).status, 400, 'no categories beyond the plain list');
  // Someone else's person id (no emergency consent with the cell) is refused.
  assert.equal((await ddma.put(`${M}/help/${D.demoLearner.id}`, { needs: ['young_children'] })).status, 403);
  // Warnings: client cannot set id, agency, issuer, demo flag or status.
  const w = await N.as('demo.ddma.admin').post(`${M}/warnings`, { id: 'dis_evil', agency_id: D.agencyByKey.cif.id, issued_by: user('demo.steward').id, is_demo: 1, status: 'cancelled', hamlet_ids: [H().h11.id], level: 'yellow', title: 'Heavy rain tonight', body: 'Keep torches and medicines ready.', source: 'IMD bulletin' });
  assert.equal(w.status, 200);
  const wr = B.store.get('disaster_warnings', w.body.id);
  assert.notEqual(w.body.id, 'dis_evil');
  assert.equal(wr.agency_id, CELL_ID);
  assert.equal(wr.issued_by, user('demo.ddma.admin').id);
  assert.equal(wr.is_demo, 0);
  assert.equal(wr.status, 'active');
  // Risk profile: id / hamlet / agency from the URL and account; mobile numbers refused.
  const before = B.store.get('disaster_risk_profiles', 'dsr_' + H().h1.id);
  const pr = await N.as('demo.ddma.admin').put(`${M}/profile/${H().h1.id}`, { id: 'dsr_evil', hamlet_id: H().h3.id, agency_id: D.agencyByKey.vjt.id, is_demo: 1, nearest_phc: 'Demo PHC, 9 km' });
  assert.equal(pr.status, 200, JSON.stringify(pr.body));
  const after = B.store.get('disaster_risk_profiles', 'dsr_' + H().h1.id);
  assert.equal(after.hamlet_id, H().h1.id);
  assert.equal(after.agency_id, before.agency_id);
  assert.ok(!B.store.get('disaster_risk_profiles', 'dsr_evil'));
  assert.equal((await N.as('demo.ddma.admin').put(`${M}/profile/${H().h1.id}`, { contacts: [{ label: 'Officer mobile', number: '9876543210' }] })).status, 400);
  assert.equal((await N.as('demo.ddma.admin').put(`${M}/profile/${H().h1.id}`, { hazards: { tsunami: 'high' } })).status, 400);
  // Only coordinators / admins of agencies present may edit; a field officer or facilitator may not.
  assert.equal((await ddma.put(`${M}/profile/${H().h1.id}`, { note: 'x' })).status, 403);
  assert.equal((await N.as('demo.facilitator').put(`${M}/profile/${H().h1.id}`, { note: 'x' })).status, 403);
  assert.equal((await N.as('demo.vjt.admin').put(`${M}/profile/${H().h2.id}`, { note: 'x' })).status, 403, 'Vanajyothi is not in Thenmala');
  // Household plan for someone else's household (head not consented to this agency) via another agency.
  const g = D.households.find((x) => x.head_person_id === D.demoGuardian.id);
  assert.equal((await N.as('demo.agri').post('/api/core/forms/submissions', { form_key: 'disaster.family_plan', household_id: g.id, answers: { meeting_point: 'x', contact: 'y', documents_safe: 'yes', has_torch: 'yes', has_water: 'yes', has_medicine_kit: 'yes' } })).status, 403);
});

test('hamlet-limited staff are refused outside their hamlets', async () => {
  assert.equal((await N.as('demo.facilitator').get(`${M}/board?hamlet_id=${H().h2.id}`)).status, 403);
  assert.equal((await N.as('demo.ddma').get(`${M}/help?hamlet_id=${H().h3.id}`)).status, 403);
  assert.equal((await N.as('demo.ddma').get(`${M}/board?hamlet_id=${H().h3.id}`)).status, 403);
  const far = D.adults.find((p) => p.hamlet_id === H().h3.id);
  assert.equal((await N.as('demo.ddma').put(`${M}/help/${far.id}`, { needs: ['cannot_walk_far'] })).status, 403);
  assert.equal((await N.as('demo.ddma').post('/api/core/forms/submissions', { form_key: 'disaster.incident_report', hamlet_id: H().h3.id, answers: INCIDENT })).status, 403);
  assert.equal((await N.as('demo.facilitator').post(`${M}/checklist/${H().h2.id}`, { item: 'drain_cleared', done: true })).status, 403);
  assert.equal((await N.as('demo.ddma').post(`${M}/checklist/${H().h2.id}`, { item: 'drain_cleared', done: true })).status, 200);
});

test('aggregate: no names or help details; small cells suppressed and totals hidden (no subtraction)', async () => {
  const r = await N.as('demo.donor').get(`${M}/aggregate`);
  assert.equal(r.status, 200);
  const txt = JSON.stringify(r.body);
  for (const p of D.persons) assert.ok(!txt.includes(p.id) && !txt.includes('"' + p.name + '"'));
  assert.ok(!/person_id|needs|cannot_walk_far|needs_medicines|household_id/.test(txt), 'no person-level or help-needed details');
  assert.equal(r.body.days, 365, 'fixed window for external viewers');
  assert.equal((await N.as('demo.donor').get(`${M}/aggregate?days=30`)).body.days, 365);
  const hs = r.body.hamlets;
  assert.ok(hs.length >= 3);
  for (const x of hs) for (const k of ['plans', 'incidents', 'urgent_incidents']) if (typeof x[k] === 'number') assert.ok(x[k] === 0 || x[k] >= 5, `${x.hamlet}.${k}=${x[k]}`);
  // Subtraction check: whenever a hamlet cell is hidden, the total is hidden too.
  for (const [cellKey, totKey] of [['plans', 'plans'], ['incidents', 'incidents']]) {
    const hidden = hs.some((x) => typeof x[cellKey] === 'string');
    if (hidden) assert.equal(r.body.totals[totKey], 'hidden', totKey);
    else if (typeof r.body.totals[totKey] === 'number') assert.equal(r.body.totals[totKey], hs.reduce((s, x) => s + x[cellKey], 0));
  }
  assert.ok(hs.some((x) => x.plans === '<5'), 'Komalikudi plans are a small cell');
  assert.equal(r.body.totals.plans, 'hidden');
  for (const x of hs.filter((y) => typeof y.plans === 'string')) assert.equal(x.plans_pct, null, 'no percentage that reveals the hidden count');
  assert.equal((await N.as('demo.govt').get(`${M}/aggregate`)).status, 200);
  for (const who of ['demo.facilitator', 'demo.guardian', 'demo.ddma', 'demo.asha']) assert.equal((await N.as(who).get(`${M}/aggregate`)).status, 403, who);
  const own = await N.as('demo.vjt.admin').get(`${M}/aggregate`);
  assert.equal(own.body.scope, 'your agency');
  assert.equal(own.body.hamlets.length, 0);
  const st = await N.as('demo.steward').get(`${M}/aggregate`);
  assert.equal(typeof st.body.totals.plans, 'number', 'steward sees exact numbers');
});

test('per-hamlet switch: disaster off in Pachakkudi → 503 for staff and families there; others unaffected', async () => {
  const h1 = H().h1.id;
  assert.equal((await N.as('demo.steward').post(`/api/core/modules/disaster/hamlets/${h1}`, { enabled: false, note: 'Oorukoottam decision' })).status, 200);
  try {
    const r = await N.as('demo.facilitator').get(`${M}/board`);
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'module_off_here');
    assert.equal((await N.as('demo.guardian').get(`${M}/board`)).status, 503);
    assert.equal((await N.as('demo.ddma').get(`${M}/board?hamlet_id=${H().h2.id}`)).status, 200, 'officer still works in Thenmala');
    assert.equal((await N.as('demo.ddma').get(`${M}/help?hamlet_id=${h1}`)).status, 403, 'but not in Pachakkudi');
    const s = await N.as('demo.ddma').post('/api/core/forms/submissions', { form_key: 'disaster.incident_report', hamlet_id: h1, answers: INCIDENT });
    assert.equal(s.status, 403);
    assert.equal(s.body.error, 'module_off_here');
  } finally {
    await N.as('demo.steward').post(`/api/core/modules/disaster/hamlets/${h1}`, { enabled: true });
  }
  assert.equal((await N.as('demo.facilitator').get(`${M}/board`)).status, 200);
});

test('manifest: sealed, emergency scope, budget; module healthy', async () => {
  const st = N.host.status().find((m) => m.id === 'disaster');
  assert.equal(st.state, 'up');
  assert.ok(B.sealedModules.has('disaster'));
  const b = (await N.as('demo.steward').get('/api/core/modules/budgets')).body.find((m) => m.id === 'disaster');
  assert.equal(b.budget_storage_mb, 10);
  assert.equal(b.sync_priority, 1);
  const scopes = (await N.as('demo.steward').get('/api/core/roles')).body;
  assert.deepEqual(scopes.restricted.emergency, ['field_officer', 'coordinator', 'agency_admin']);
});
