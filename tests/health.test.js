'use strict';
// Health & Elder Screening: rules (sub-engine), ASHA → doctor → follow-up round trip, restricted-scope
// privacy, consent withdrawal, hamlet scoping, per-hamlet switch, neutral notifications, k-anonymous aggregates.
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');
const rules = require('../modules/health/rules');

const M = '/api/m/health';
let N, D;
test.before(async () => { N = await bootDemo(); D = N.demo; });
test.after(async () => { await N.close(); });

const B = () => N.brain;
const user = (username) => B().store.one('SELECT * FROM users WHERE username=? AND deleted=0', username);
const h1 = () => D.hamletByKey.h1.id;
// A person in a hamlet with active health consent to the demo PHC.
function consented(hamletId, pred = () => true) {
  const ag = D.healthAgency.id;
  const P = B().policy;
  const ids = B().store.all('SELECT id FROM persons WHERE hamlet_id=? AND deleted=0', hamletId).map((r) => r.id);
  for (const id of ids) {
    const p = B().store.get('persons', id);
    if (P.activeConsent(id, ag, 'health') && P.enrolledWith(id, ag) && pred(p)) return p;
  }
  return null;
}
const ageOf = (p) => (Date.now() - new Date(p.dob)) / 3.15576e10;

test('seed: PHC agency, staff logins, consented people and three months of history', async () => {
  assert.ok(D.healthAgency, 'agency created');
  assert.match(D.healthAgency.name, /fictional/i);
  for (const u of ['demo.asha', 'demo.asha.komalikudi', 'demo.doctor', 'demo.phc.admin']) assert.ok(user(u), u);
  const n = B().store.one("SELECT COUNT(*) n, MIN(captured_at) first FROM form_submissions WHERE module='health' AND deleted=0");
  assert.ok(n.n > 50, 'history seeded');
  assert.ok(new Date(n.first) < new Date(Date.now() - 60 * 86400e3), 'about three months of history');
  const fu = B().store.one("SELECT COUNT(*) n FROM health_followups WHERE deleted=0 AND status='open'");
  assert.ok(fu.n > 0, 'open follow-ups exist');
});

test('rules: pure sub-engine thresholds (never a diagnosis)', () => {
  const v = rules.vitals({ bp_sys: 186, bp_dia: 100 });
  assert.equal(v.priority, 3);
  assert.equal(v.flags[0].code, 'bp_very_high');
  assert.equal(rules.vitals({ bp_sys: 150, bp_dia: 85 }).flags[0].code, 'bp_high');
  assert.equal(rules.vitals({ bp_sys: 120, bp_dia: 80 }).flags.length, 0);
  assert.equal(rules.vitals({ sugar: 62, sugar_type: 'random' }).priority, 3);
  assert.equal(rules.vitals({ sugar: 130, sugar_type: 'fasting' }).flags[0].code, 'sugar_high_fasting');
  assert.equal(rules.vitals({ sugar: 130, sugar_type: 'random' }).flags.length, 0);
  assert.equal(rules.vitals({ sugar: 320, sugar_type: 'random' }).priority, 3);
  assert.equal(rules.vitals({ temp_c: 39.2 }).flags[0].code, 'fever_high');
  assert.equal(rules.childGrowth({ age_months: 20, muac_cm: 12.0, oedema: 'no', eating_well: 'yes' }).flags[0].code, 'muac_mam');
  assert.equal(rules.childGrowth({ age_months: 20, muac_cm: 13, oedema: 'yes', eating_well: 'yes' }).priority, 3);
  assert.equal(rules.antenatal({ weeks: 30, danger_signs: ['bleeding'] }).priority, 3);
  const e = rules.elderScreen({ falls: '1', fear_falling: 'yes', recall: 1, phq_interest: '2', phq_mood: '1', weight_loss: 'yes', adl_help: ['bathing'], medicines: 6, lives_alone: 'yes', pension: 'yes' });
  const codes = e.flags.map((f) => f.code);
  for (const c of ['falls_risk', 'memory_check', 'mood_check', 'weight_loss', 'alone_needs_help', 'polypharmacy']) assert.ok(codes.includes(c), c);
  assert.equal(e.priority, 2, 'several warnings → high');
  // No diagnostic language in any message
  const all = [v, rules.vitals({ symptoms: ['chest_pain', 'cough_2w'] }), rules.childGrowth({ muac_cm: 11, age_months: 12, oedema: 'yes', eating_well: 'no' }), rules.antenatal({ weeks: 41, bp_sys: 170, hb: 6, danger_signs: Object.keys(rules.DANGER) }), e].flatMap((r) => r.flags);
  for (const f of all) {
    assert.ok(f.message && f.message_ml, 'bilingual: ' + f.code);
    assert.doesNotMatch(f.message, /\b(you have|diagnos|is diabetic|has hypertension|dementia|depression)\b/i, f.message);
  }
});

test('ASHA capture: very high BP is flagged urgent with priority 3', async () => {
  const p = consented(h1(), (x) => ageOf(x) >= 18);
  assert.ok(p, 'a consented adult in Pachakkudi');
  const r = await N.as('demo.asha').post('/api/core/forms/submissions', { form_key: 'health.vitals', person_id: p.id, answers: { bp_sys: 192, bp_dia: 112, pulse: 88 }, client_ref: 't-bp-1' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.priority, 3);
  assert.ok(r.body.flags.some((f) => f.code === 'bp_very_high' && f.level === 'urgent'));
  const q = await N.as('demo.doctor').get(M + '/queue');
  assert.equal(q.status, 200);
  assert.equal(q.body.items[0].priority, 3, 'urgent first in the doctor queue');
  assert.ok(q.body.items.find((x) => x.id === r.body.id));
});

test('ASHA capture: MUAC < 11.5 cm is flagged as severe (urgent)', async () => {
  const kid = consented(h1(), (x) => ageOf(x) < 5);
  assert.ok(kid, 'a consented young child in Pachakkudi');
  const r = await N.as('demo.asha').post('/api/core/forms/submissions', { form_key: 'health.child_growth', person_id: kid.id, answers: { age_months: 24, weight_kg: 8.4, height_cm: 80, muac_cm: 11.1, oedema: 'no', eating_well: 'yes' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.priority, 3);
  assert.ok(r.body.flags.some((f) => f.code === 'muac_sam'));
});

test('round trip: ASHA capture → doctor queue → reply with follow-up → ASHA sees follow-up and reply; notification is neutral', async () => {
  const p = consented(h1(), (x) => ageOf(x) >= 18 && x.id !== D.demoGuardian.id);
  const asha = N.as('demo.asha');
  const s = await asha.post('/api/core/forms/submissions', { form_key: 'health.vitals', person_id: p.id, answers: { bp_sys: 150, bp_dia: 94, sugar: 230, sugar_type: 'random', symptoms: ['cough_2w'] }, client_ref: 't-rt-1' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.ok(s.body.flags.length >= 3);
  // ASHA cannot reply to her own capture
  assert.equal((await asha.post(M + '/submissions/' + s.body.id + '/reply', { reply: 'self' })).status, 403);
  const q = await N.as('demo.doctor').get(M + '/queue');
  assert.ok(q.body.items.find((x) => x.id === s.body.id), 'in the doctor queue');
  const before = B().store.one('SELECT COUNT(*) n FROM notifications WHERE person_id=?', p.id).n;
  const r = await N.as('demo.doctor').post(M + '/submissions/' + s.body.id + '/reply', { advice_template: 'tb_test', follow_up_weeks: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, 'replied');
  assert.ok(r.body.followup && r.body.followup.status === 'open');
  const due = new Date(r.body.followup.due).getTime();
  assert.ok(Math.abs(due - (Date.now() + 14 * 86400e3)) < 2 * 86400e3, 'due in about two weeks');
  // follow-up visible to the ASHA (shown on home when due; on the person record always)
  const rec = await asha.get(M + '/person/' + p.id);
  assert.equal(rec.status, 200);
  assert.ok(rec.body.followups.find((f) => f.id === r.body.followup.id));
  const sub = rec.body.submissions.find((x) => x.id === s.body.id);
  assert.match(sub.reply, /sputum/);
  const home = await asha.get(M + '/home');
  assert.ok(home.body.to_tell.find((x) => x.id === s.body.id), 'reply to pass on');
  // a 1-week follow-up shows in "who to see"
  const r2 = await N.as('demo.doctor').post(M + '/submissions/' + s.body.id + '/reply', { reply: 'Please recheck BP next week.', follow_up_weeks: 1 });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  const home2 = await asha.get(M + '/home');
  assert.ok(home2.body.due.find((f) => f.id === r2.body.followup.id), 'due follow-up on ASHA home');
  assert.ok(!home2.body.due.find((f) => f.id === r.body.followup.id), 'superseded follow-up gone');
  // told the family
  const seen = await asha.post('/api/core/forms/submissions/' + s.body.id + '/seen');
  assert.equal(seen.status, 200);
  assert.ok(seen.body.reply_seen_at);
  // follow-up done
  const done = await asha.post(M + '/followups/' + r2.body.followup.id + '/done', { note: 'Visited' });
  assert.equal(done.body.status, 'done');
  // notifications: no clinical details at all
  await new Promise((res) => setTimeout(res, 50));
  const notes = B().store.all('SELECT * FROM notifications WHERE person_id=? AND deleted=0 ORDER BY created_at', p.id).slice(before);
  assert.ok(notes.length >= 1);
  for (const n of notes) {
    if (n.status === 'withdrawn') continue;
    assert.doesNotMatch(n.message, /BP|blood|sugar|cough|sputum|TB|pregnan|vitals|pressure|MUAC|\d{2,3}\/\d{2,3}/i, n.message);
  }
});

test('generic core reply route: the core notification left queued is neutral (engine message withdrawn — see Brain request)', async () => {
  const w = consented(h1(), (x) => x.gender === 'F' && ageOf(x) >= 18 && ageOf(x) <= 45);
  assert.ok(w);
  const s = await N.as('demo.asha').post('/api/core/forms/submissions', { form_key: 'health.antenatal', person_id: w.id, answers: { weeks: 24, bp_sys: 118, bp_dia: 76 } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const r = await N.as('demo.doctor').post('/api/core/forms/submissions/' + s.body.id + '/reply', { reply: 'All fine, continue tablets.' });
  assert.equal(r.status, 200);
  await new Promise((res) => setTimeout(res, 80));
  const queued = B().store.all("SELECT * FROM notifications WHERE person_id=? AND status='queued' AND deleted=0", w.id);
  assert.ok(queued.length >= 1);
  for (const n of queued) assert.doesNotMatch(n.message, /pregnan|antenatal/i, n.message);
});

test('the person and their guardian see only their own record — in plain words', async () => {
  const learner = D.demoLearner;
  const fam = await N.as('demo.guardian').get(M + '/family');
  assert.equal(fam.status, 200, JSON.stringify(fam.body));
  const ids = fam.body.people.map((p) => p.person_id);
  const wards = B().store.all('SELECT id FROM persons WHERE guardian_id=? AND deleted=0', D.demoGuardian.id).map((r) => r.id);
  assert.deepEqual([...ids].sort(), [D.demoGuardian.id, ...wards].sort(), 'guardian: self + own wards only');
  assert.ok(ids.includes(learner.id));
  const all = JSON.stringify(fam.body);
  assert.doesNotMatch(all, /"answers"|"flags"|bp_sys|muac|priority/, 'no raw readings or flags for the family');
  const items = fam.body.people.flatMap((p) => p.items);
  assert.ok(items.length > 0 && items.some((x) => x.reply), 'some advice is shown');
  const own = await N.as('demo.learner').get(M + '/family');
  assert.equal(own.status, 200);
  assert.deepEqual(own.body.people.map((p) => p.person_id), [learner.id]);
  // the learner cannot open someone else's record
  const other = consented(h1(), (x) => x.id !== learner.id && x.id !== D.demoGuardian.id);
  assert.equal((await N.as('demo.learner').get(M + '/person/' + other.id)).status, 403);
  assert.equal((await N.as('demo.guardian').get(M + '/person/' + other.id)).status, 403);
  assert.equal((await N.as('demo.learner').get(M + '/person/' + learner.id)).status, 200);
});

test('restricted scope: facilitator, counsellor and CPO cannot read health data, even in the same hamlet', async () => {
  const p = D.demoLearner; // enrolled with CIF too, with progress/wellbeing consent there
  const sub = B().store.one("SELECT id FROM form_submissions WHERE module='health' AND person_id=? AND deleted=0", p.id);
  assert.ok(sub);
  for (const u of ['demo.facilitator', 'demo.counsellor', 'demo.cpo', 'demo.coordinator']) {
    assert.equal((await N.as(u).get(M + '/person/' + p.id)).status, 403, u + ' person record');
    assert.equal((await N.as(u).get('/api/core/forms/submissions/' + sub.id)).status, 403, u + ' core submission');
    const list = await N.as(u).get('/api/core/forms/submissions?module=health');
    assert.ok(!(Array.isArray(list.body) && list.body.length), u + ' list empty');
    assert.equal((await N.as(u).get(M + '/queue')).status, 403, u + ' queue');
    const cap = await N.as(u).post('/api/core/forms/submissions', { form_key: 'health.vitals', person_id: p.id, answers: { bp_sys: 120, bp_dia: 80 } });
    assert.equal(cap.status, 403, u + ' capture');
  }
  // another agency's admin too
  assert.equal((await N.as('demo.cif.admin').get('/api/core/forms/submissions/' + sub.id)).status, 403);
});

test('hamlet scoping: Komalikudi ASHA cannot see Pachakkudi people', async () => {
  const p = consented(h1());
  const k = N.as('demo.asha.komalikudi');
  assert.equal((await k.get(M + '/person/' + p.id)).status, 403);
  const ppl = await k.get(M + '/people');
  assert.equal(ppl.status, 200);
  assert.ok(ppl.body.length > 0, 'sees her own hamlet');
  assert.ok(ppl.body.every((x) => x.hamlet_id === D.hamletByKey.h11.id));
  const home = await k.get(M + '/home');
  assert.ok(home.body.due.every((f) => f.hamlet_id === D.hamletByKey.h11.id));
  const cap = await N.as('demo.asha.komalikudi').post('/api/core/forms/submissions', { form_key: 'health.vitals', person_id: p.id, answers: { bp_sys: 120, bp_dia: 80 } });
  assert.equal(cap.status, 403);
});

test('consent withdrawal removes the health worker\'s and doctor\'s access at once', async () => {
  const p = consented(h1(), (x) => ageOf(x) >= 18 && x.id !== D.demoGuardian.id);
  const s = await N.as('demo.asha').post('/api/core/forms/submissions', { form_key: 'health.vitals', person_id: p.id, answers: { bp_sys: 130, bp_dia: 82 } });
  assert.equal(s.status, 200);
  assert.equal((await N.as('demo.asha').get(M + '/person/' + p.id)).status, 200);
  const c = B().store.find('consents', { person_id: p.id, agency_id: D.healthAgency.id, status: 'active' })[0];
  B().revokeConsent(c.id, null);
  assert.equal((await N.as('demo.asha').get(M + '/person/' + p.id)).status, 403);
  assert.equal((await N.as('demo.doctor').get(M + '/submissions/' + s.body.id)).status, 403);
  assert.ok(!(await N.as('demo.doctor').get(M + '/queue')).body.items.find((x) => x.id === s.body.id), 'gone from the queue');
  assert.ok(!(await N.as('demo.asha').get(M + '/people')).body.find((x) => x.id === p.id));
  assert.equal((await N.as('demo.doctor').post(M + '/submissions/' + s.body.id + '/reply', { reply: 'hello there' })).status, 403);
});

test('aggregate view: k-anonymised, no person-level data', async () => {
  const r = await N.as('demo.donor').get(M + '/aggregate');
  assert.equal(r.status, 200);
  const txt = JSON.stringify(r.body);
  assert.doesNotMatch(txt, /person_id|"name"|per_/);
  for (const p of D.persons.slice(0, 200)) assert.ok(!txt.includes(p.name + '"'), 'no names');
  const small = r.body.hamlets.find((x) => x.hamlet_id === D.hamletByKey.h2.id);
  assert.ok(small, 'Thenmala small pilot listed');
  assert.equal(small.people_screened, '<5', 'small counts suppressed');
  assert.equal(small.pct_flagged, null, 'no percentage of a tiny group');
  const big = r.body.hamlets.find((x) => x.hamlet_id === h1());
  assert.equal(typeof big.people_screened, 'number');
  assert.ok(big.people_screened >= 5);
  assert.equal((await N.as('demo.govt').get(M + '/aggregate')).status, 200);
  assert.equal((await N.as('demo.learner').get(M + '/aggregate')).status, 403);
  assert.equal((await N.as('demo.donor').get(M + '/queue')).status, 403);
  assert.equal((await N.as('demo.donor').get(M + '/person/' + D.demoLearner.id)).status, 403);
});

test('per-hamlet switch: the community switches health off in Pachakkudi → ASHA gets 503; Komalikudi unaffected', async () => {
  const off = await N.as('demo.steward').post(`/api/core/modules/health/hamlets/${h1()}`, { enabled: false, note: 'Oorukoottam decision (test)' });
  assert.equal(off.status, 200);
  try {
    const r = await N.as('demo.asha').get(M + '/home');
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'module_off_here');
    assert.equal((await N.as('demo.asha.komalikudi').get(M + '/home')).status, 200);
    const p = consented(h1());
    const cap = await N.as('demo.asha').post('/api/core/forms/submissions', { form_key: 'health.vitals', person_id: p.id, answers: { bp_sys: 120, bp_dia: 80 } });
    assert.equal(cap.status, 403);
    assert.equal(cap.body.error, 'module_off_here');
  } finally {
    await N.as('demo.steward').post(`/api/core/modules/health/hamlets/${h1()}`, { enabled: true });
  }
  assert.equal((await N.as('demo.asha').get(M + '/home')).status, 200);
});

test('validation and budget: bad readings rejected; budget declared', async () => {
  const p = consented(h1(), (x) => ageOf(x) >= 18);
  const bad = await N.as('demo.asha').post('/api/core/forms/submissions', { form_key: 'health.vitals', person_id: p.id, answers: { bp_sys: 999, sugar: 150 } });
  assert.equal(bad.status, 400, 'out of range + missing fasting/random');
  const bud = (await N.as('demo.steward').get('/api/core/modules/budgets')).body.find((m) => m.id === 'health');
  assert.equal(bud.sync_priority, 1);
  assert.equal(bud.budget_storage_mb, 40);
});
