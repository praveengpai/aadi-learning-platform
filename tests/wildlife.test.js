'use strict';
// Wildlife Conflict & Environment: incident rule, forwarding to the Forest Range Office only with the
// family's consent, claim status transitions and who may set them, family timeline, sightings early
// warning, readings CSV import, k-anonymised aggregate (incl. a subtraction check), per-hamlet switch.
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');
const L = require('../modules/wildlife/lib');

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PS/HgAFXQJMm+Ys9QAAAABJRU5ErkJggg==';
const KEY = 'wildlife.incident';
const today = () => L.istDate(Date.now());
const daysAgoDate = (n) => L.istDate(Date.now() - n * 86400e3);

// ---------------- pure sub-engine ----------------
test('rule: injury/death urgent with 112, house high, late claim warns without stating a deadline', () => {
  const inj = L.assess({ incident_date: today(), animal: 'wild_boar', damage: ['injury', 'crops'], photo1: PHOTO, reported_forest: 'yes' });
  assert.equal(inj.priority, 3);
  const f = inj.flags.find((x) => x.code === 'person_hurt');
  assert.equal(f.level, 'urgent');
  assert.match(f.message, /medical care/i);
  assert.match(f.message, /112/);
  assert.match(f.message_ml, /112/);
  assert.equal(L.assess({ incident_date: today(), animal: 'elephant', damage: ['death'] }).priority, 3);
  const house = L.assess({ incident_date: today(), animal: 'elephant', damage: ['house'], photo1: PHOTO });
  assert.equal(house.priority, 2);
  assert.ok(house.flags.find((x) => x.code === 'house_damaged'));
  const crop = L.assess({ incident_date: today(), animal: 'monkey', damage: ['crops'], photo1: PHOTO, reported_forest: 'yes' });
  assert.equal(crop.priority, 0);
  assert.deepEqual(crop.flags, []);
  const late = L.assess({ incident_date: daysAgoDate(L.CLAIM_WINDOW_DAYS + 3), animal: 'wild_boar', damage: ['crops'], photo1: PHOTO });
  const lf = late.flags.find((x) => x.code === 'claim_may_be_late');
  assert.ok(lf && lf.level === 'warn');
  assert.match(lf.message, /may be late/);
  assert.match(lf.message, /[Vv]erify the deadline/);
  assert.ok(!/within \d+ days|must be filed|legal/i.test(lf.message), 'no legal deadline stated as fact');
  assert.ok(!L.assess({ incident_date: daysAgoDate(L.CLAIM_WINDOW_DAYS - 1), animal: 'wild_boar', damage: ['crops'] }).flags.find((x) => x.code === 'claim_may_be_late'));
  assert.ok(L.assess({ damage: [] }).flags.find((x) => x.code === 'no_photo'));
  assert.doesNotThrow(() => L.assess({}));
  assert.match(L.CLAIM_WINDOW_STATUS, /PENDING REVIEW/);
});

test('sightings: plain sentence and the ≥2 elephants in 48 h early warning', () => {
  const now = Date.parse('2026-11-01T06:00:00Z'); // 11:30 IST
  const yEve = Date.parse('2026-10-31T13:30:00Z'); // 19:00 IST yesterday
  const s = L.sightingSentence({ animal: 'elephant', count: 3, place: 'the river path', seen_at: new Date(yEve).toISOString() }, now);
  assert.equal(s.en, 'Elephants seen near the river path yesterday evening (about 3).');
  assert.match(s.ml, /ഇന്നലെ വൈകുന്നേരം/);
  assert.equal(L.sightingSentence({ animal: 'wild_boar', count: 1, place: 'near the school', seen_at: new Date(now - 3600e3).toISOString() }, now).en, 'A wild boar seen near the school today morning.');
  const one = [{ animal: 'elephant', seen_at: new Date(now - 10 * 3600e3).toISOString(), count: 2 }];
  assert.equal(L.elephantWarning(one, now), null);
  assert.equal(L.elephantWarning([...one, { animal: 'wild_boar', seen_at: new Date(now - 3600e3).toISOString() }], now), null);
  assert.equal(L.elephantWarning([...one, { animal: 'elephant', seen_at: new Date(now - 50 * 3600e3).toISOString() }], now), null, 'outside 48 h');
  const w = L.elephantWarning([...one, { animal: 'elephant', seen_at: new Date(now - 30 * 3600e3).toISOString(), group_size: 5 }], now);
  assert.equal(w.code, 'elephant_alert');
  assert.equal(w.sightings, 2);
  assert.equal(w.largest_group, 5);
  assert.match(w.message, /112/);
});

test('readings CSV parsing: header/no header, IST dates, validation, row and size caps', () => {
  const now = Date.parse('2026-11-01T06:00:00Z');
  const a = L.parseReadingsCsv('date,mm,device\n2026-10-30 08:00,12.5,RG1\n31/10/2026,0,RG1\n', { kind: 'rainfall_mm', now });
  assert.equal(a.errors.length, 0);
  assert.equal(a.rows.length, 2);
  assert.equal(a.rows[0].at, '2026-10-30T02:30:00.000Z', 'local time read as IST');
  assert.equal(a.rows[0].device, 'RG1');
  const b = L.parseReadingsCsv('date,kind,value,device,animal\n2026-10-30,camera_trap_count,3,CT1,elephant\n2026-10-30,camera_trap_count,2.5,CT1,elephant\n2026-10-30,stream_level_cm,-4,G1\n2026-13-01,water_ph,7\n2026-10-30,water_ph,7.1\n2026-10-30,magic,1\n2026-10-30,camera_trap_count,1,CT1,dragon\n2030-01-01,water_ph,7', { now });
  assert.equal(b.rows.length, 2);
  assert.deepEqual(b.errors.map((e) => e.line), [3, 4, 5, 7, 8, 9]);
  assert.equal(b.rows[0].animal, 'elephant');
  assert.match(L.parseReadingsCsv('2026-10-30,5', { now }).errors[0].message, /unknown kind/);
  const big = Array.from({ length: L.MAX_IMPORT_ROWS + 1 }, (_, i) => `2026-10-${String(1 + (i % 28)).padStart(2, '0')},1`).join('\n');
  const c = L.parseReadingsCsv(big, { kind: 'rainfall_mm', now });
  assert.equal(c.tooMany, true);
  assert.equal(c.rows.length, 0);
  assert.equal(L.parseReadingsCsv('x'.repeat(L.MAX_IMPORT_CHARS + 1), { kind: 'rainfall_mm', now }).tooBig, true);
  assert.deepEqual(L.splitCsv('"a, b",c;"d ""e"""'), ['a, b', 'c', 'd "e"']);
});

test('suppression: small cells "<5", and any row/column/grand total containing one is hidden', () => {
  const r = L.suppressTable({ a: { x: 7, y: 2 }, b: { x: 6, y: 9 } });
  assert.equal(r.rows.a.cells.y, '<5');
  assert.equal(r.rows.a.total, 'hidden');
  assert.equal(r.rows.b.total, 15);
  assert.equal(r.cols.y, 'hidden');
  assert.equal(r.cols.x, 13);
  assert.equal(r.total, 'hidden');
  assert.equal(L.suppressTable({ a: { x: 7, y: 0 } }).total, 7);
  assert.equal(L.suppressTable({ a: { x: 2 } }, { exempt: true }).rows.a.cells.x, 2);
});

// ---------------- the module on a demo node ----------------
let N, D, B;
test.before(async () => { N = await bootDemo(); D = N.demo; B = N.brain; });
test.after(async () => { await N.close(); });

const base = '/api/m/wildlife';
const user = (username) => B.store.one('SELECT * FROM users WHERE username=? AND deleted=0', username);
const FO = () => B.store.one("SELECT * FROM agencies WHERE name='Demo Forest Range Office (fictional)' AND deleted=0");
const cif = () => D.agencyByKey.cif.id;
const h1 = () => D.hamletByKey.h1.id;
const h2 = () => D.hamletByKey.h2.id;
// An adult in Pachakkudi the CIF facilitator may record for, who also shares livelihood records with the range office.
const sharedFarmer = (hid = h1(), fac = 'demo.facilitator') => D.adults.find((p) => p.hamlet_id === hid && p.id !== D.demoGuardian.id && B.policy.canSee(user(fac), p.id, 'livelihood').ok && B.policy.activeConsent(p.id, FO().id, 'livelihood') && B.policy.enrolledWith(p.id, FO().id));
const report = (who, person_id, answers = {}, client_ref) => N.as(who).post('/api/core/forms/submissions', { form_key: KEY, person_id, client_ref, answers: { incident_date: today(), time_of_day: 'night', animal: 'elephant', damage: ['crops'], crop: 'banana', crop_area_cents: 10, estimated_loss: 12000, photo1: PHOTO, location: '10.02 77.08', witnesses: 2, reported_forest: 'no', ...answers } });
const claimFor = (sid) => B.store.one('SELECT * FROM wildlife_claims WHERE submission_id=? AND deleted=0', sid);

test('seed: fictional range office, users, programmes, consents, incidents, claims, sightings, readings', async () => {
  const fo = FO();
  assert.ok(fo, 'agency exists');
  for (const k of ['h1', 'h2', 'h11']) assert.ok(B.store.one("SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0 AND status='active'", fo.id, D.hamletByKey[k].id), 'presence in ' + k);
  assert.equal(user('demo.forest').role, 'field_officer');
  assert.equal(user('demo.forest').agency_id, fo.id);
  assert.equal(user('demo.forest.admin').role, 'agency_admin');
  assert.equal(user('demo.forest').safeguarding_trained, 1);
  const def = B.forms.getDef(KEY);
  assert.equal(def.review.agency_id, fo.id, 'forwarded to the range office after seeding');
  assert.equal(def.scope, 'livelihood');
  assert.equal(def.review.perm, 'forms.review');
  const progs = B.store.find('programmes', { track: 'wildlife' });
  assert.ok(progs.some((p) => p.agency_id === fo.id && p.module === 'wildlife') && progs.some((p) => p.agency_id === cif()));
  const subs = B.store.find('form_submissions', { form_key: KEY });
  assert.ok(subs.length >= 30, 'incidents: ' + subs.length);
  assert.ok(subs.filter((s) => (s.answers.damage || []).includes('crops')).length > subs.length / 2, 'mostly crops');
  assert.ok(subs.some((s) => s.answers.damage.includes('house')), 'some house damage');
  assert.equal(subs.filter((s) => s.answers.damage.includes('injury')).length, 1, 'one injury');
  assert.ok(subs.find((s) => s.answers.damage.includes('injury')).priority === 3);
  const st = new Set(B.store.find('wildlife_claims', {}).map((c) => c.status));
  for (const s of ['prepared', 'submitted_to_range_office', 'inspection_done', 'sanctioned', 'paid']) assert.ok(st.has(s), 'claim status ' + s);
  assert.equal(B.store.find('wildlife_claims', {}).length, subs.length, 'one claim file per incident');
  assert.ok(B.store.find('wildlife_sightings', {}).length > 50);
  assert.ok(B.store.find('wildlife_readings', { kind: 'rainfall_mm' }).length > 200);
  // consent was merged, not replaced: earlier CIF scopes survive
  const g = B.store.find('consents', { person_id: D.demoGuardian.id, agency_id: cif(), status: 'active' })[0];
  assert.ok(g.scopes.includes('livelihood') && g.scopes.includes('profile'));
  assert.ok(g.scopes.includes('services') || g.scopes.includes('progress') || g.scopes.length > 2, 'earlier scopes kept: ' + g.scopes);
  assert.ok(sharedFarmer(), 'a farmer sharing with the range office');
  const login = await N.req(null, 'POST', '/api/core/auth/login', { username: 'demo.forest', password: 'demo1234' });
  assert.equal(login.status, 200);
});

test('injury report → urgent flag with 112, claim prepared, top of the range office queue', async () => {
  const f = sharedFarmer();
  const r = await report('demo.facilitator', f.id, { animal: 'wild_boar', damage: ['injury'], estimated_loss: 5000, notes: 'gored while guarding the field' }, 'wl-inj-1');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.priority, 3);
  assert.ok(r.body.flags.find((x) => x.code === 'person_hurt' && x.level === 'urgent' && /112/.test(x.message)));
  const c = claimFor(r.body.id);
  assert.equal(c.status, 'prepared');
  assert.equal(c.amount_claimed, 5000);
  const q = await N.as('demo.forest').get(base + '/queue');
  assert.equal(q.status, 200);
  assert.equal(q.body.items[0].priority, 3, 'urgent first');
  const item = q.body.items.find((x) => x.id === r.body.id);
  assert.ok(item && item.new, 'forwarded to the range office');
  assert.equal(item.photo_count, 1);
  assert.equal(item.photos, undefined, 'list view carries no photos');
  const one = await N.as('demo.forest').get(base + '/incidents/' + r.body.id);
  assert.equal(one.status, 200);
  assert.ok(one.body.photos[0].startsWith('data:image/'), 'officer sees the photo');
  assert.deepEqual(one.body.can_update, ['submitted_to_range_office', 'rejected']);
  // house damage → priority 2; old incident → late warning
  const hs = await report('demo.facilitator', f.id, { damage: ['house'], items_damaged: 'kitchen wall', incident_date: daysAgoDate(30) }, 'wl-house-1');
  assert.equal(hs.body.priority, 2);
  assert.ok(hs.body.flags.find((x) => x.code === 'claim_may_be_late'));
  // idempotent replay from the offline outbox
  const again = await report('demo.facilitator', f.id, { animal: 'wild_boar', damage: ['injury'], estimated_loss: 5000 }, 'wl-inj-1');
  assert.equal(again.body.id, r.body.id);
  assert.equal(B.store.find('wildlife_claims', { submission_id: r.body.id }).length, 1);
});

test('the range office sees an incident only with the family\'s consent to it', async () => {
  const fo = FO().id;
  // a farmer who shares livelihood records with CIF but not (yet) with the range office
  let p = D.adults.find((x) => x.hamlet_id === h1() && B.policy.canSee(user('demo.facilitator'), x.id, 'livelihood').ok && !B.policy.activeConsent(x.id, fo, 'livelihood'));
  if (!p) {
    p = sharedFarmer();
    const c = B.store.find('consents', { person_id: p.id, agency_id: fo, status: 'active' })[0];
    B.grantConsent({ person_id: p.id, agency_id: fo, scopes: c.scopes.filter((s) => s !== 'livelihood'), granted_by: c.granted_by, relation: c.relation }, null);
  }
  const r = await report('demo.facilitator', p.id, {}, 'wl-noshare-1');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await N.as('demo.forest').get(base + '/incidents/' + r.body.id)).status, 403);
  assert.ok(!(await N.as('demo.forest').get(base + '/queue')).body.items.find((x) => x.id === r.body.id));
  assert.ok(!(await N.as('demo.forest').get('/api/core/forms/queue')).body.find((x) => x.id === r.body.id));
  assert.equal((await N.as('demo.forest').post(base + '/claims/' + claimFor(r.body.id).id + '/status', { status: 'submitted_to_range_office' })).status, 403);
  // CIF still has it
  assert.equal((await N.as('demo.facilitator').get(base + '/incidents/' + r.body.id)).status, 200);
  // the family agrees in person → visible
  const cur = B.store.find('consents', { person_id: p.id, agency_id: fo, status: 'active' })[0];
  B.grantConsent({ person_id: p.id, agency_id: fo, scopes: [...new Set([...(cur ? cur.scopes : ['profile']), 'profile', 'livelihood'])], granted_by: p.id, relation: 'self' }, null);
  if (!B.policy.enrolledWith(p.id, fo)) B.enrol(p.id, B.store.find('programmes', { agency_id: fo, hamlet_id: h1(), track: 'wildlife' })[0].id, null);
  assert.equal((await N.as('demo.forest').get(base + '/incidents/' + r.body.id)).status, 200);
});

test('claim status: valid transitions only, by the range office or (hand-in, payment) the capturing agency admin', async () => {
  const f = sharedFarmer();
  const r = await report('demo.facilitator', f.id, { animal: 'gaur', estimated_loss: 20000 }, 'wl-claim-1');
  const cid = claimFor(r.body.id).id;
  const post = (who, body) => N.as(who).post(`${base}/claims/${cid}/status`, body);
  // not allowed at all
  assert.equal((await post('demo.facilitator', { status: 'submitted_to_range_office' })).status, 403, 'facilitator cannot');
  assert.equal((await post('demo.agri', { status: 'submitted_to_range_office' })).status, 403, 'another department cannot');
  assert.equal((await post('demo.vjt.admin', { status: 'submitted_to_range_office' })).status, 403, 'another agency admin cannot');
  assert.equal((await post('demo.donor', { status: 'paid' })).status, 403);
  assert.equal((await post('demo.guardian', { status: 'paid' })).status, 403);
  // bad jumps
  const jump = await post('demo.forest', { status: 'paid' });
  assert.equal(jump.status, 409);
  assert.equal(jump.body.error, 'bad_transition');
  assert.equal((await post('demo.forest', { status: 'approved' })).status, 400, 'unknown status');
  // CIF admin hands the file in; may not record inspection
  const hand = await post('demo.cif.admin', { status: 'submitted_to_range_office', note: 'Given at the counter' });
  assert.equal(hand.status, 200, JSON.stringify(hand.body));
  assert.equal(hand.body.claim.status, 'submitted_to_range_office');
  assert.equal((await post('demo.cif.admin', { status: 'inspection_done' })).status, 403);
  assert.equal((await post('demo.forest', { status: 'sanctioned', amount_sanctioned: 9000 })).status, 409, 'inspection first');
  assert.equal((await post('demo.forest', { status: 'inspection_done' })).status, 200);
  assert.equal((await post('demo.forest', { status: 'sanctioned' })).status, 400, 'amount needed');
  assert.equal((await post('demo.forest', { status: 'sanctioned', amount_sanctioned: 12.5 })).status, 400);
  const before = B.store.one('SELECT COUNT(*) n FROM notifications WHERE person_id=?', f.id).n;
  const sa = await post('demo.forest.admin', { status: 'sanctioned', amount_sanctioned: 9000, note: 'Assessed on site' });
  assert.equal(sa.status, 200, JSON.stringify(sa.body));
  assert.equal(sa.body.claim.amount_sanctioned, 9000);
  assert.equal(sa.body.status, 'replied', 'the family gets a reply through the engine');
  const notes = B.store.all('SELECT message, module FROM notifications WHERE person_id=? ORDER BY created_at DESC', f.id);
  assert.equal(notes.length, before + 1);
  assert.ok(!/elephant|gaur|wild|forest|claim|compensat|9000|9,000|sanction/i.test(notes[0].message), 'neutral notification: ' + notes[0].message);
  assert.equal(notes[0].module, 'core', 'sealed module never named on the outbox');
  const paid = await post('demo.cif.admin', { status: 'paid', note: 'Family saw it in the passbook' });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal((await post('demo.forest', { status: 'rejected' })).status, 409, 'paid is final');
  const tl = (await N.as('demo.facilitator').get(base + '/incidents/' + r.body.id)).body.timeline.map((x) => x.status);
  assert.deepEqual(tl, ['recorded', 'prepared', 'submitted_to_range_office', 'inspection_done', 'sanctioned', 'paid']);
  // rejected → may be re-submitted
  const r2 = await report('demo.facilitator', f.id, { animal: 'monkey', estimated_loss: 3000 }, 'wl-claim-2');
  const c2 = claimFor(r2.body.id).id;
  assert.equal((await N.as('demo.forest').post(`${base}/claims/${c2}/status`, { status: 'rejected', note: 'Land papers missing' })).status, 200);
  assert.equal((await N.as('demo.cif.admin').post(`${base}/claims/${c2}/status`, { status: 'submitted_to_range_office' })).status, 200, 're-submitted after an appeal');
  // the family sees the timeline in plain words
});

test('core routes: only the range office decides an incident; the capturing agency\'s admin and the capturer cannot', async () => {
  const f = sharedFarmer();
  const r = await report('demo.facilitator', f.id, { animal: 'elephant', estimated_loss: 15000 }, 'wl-core-1');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const id = r.body.id;
  const core = (who, act, body = {}) => N.as(who).post(`/api/core/forms/submissions/${id}/${act}`, body);
  const inQueue = async () => !!(await N.as('demo.forest').get(base + '/queue')).body.items.find((x) => x.id === id);
  assert.ok(await inQueue());
  // the reported bypass: CIF admin replies through the generic core route
  const rep = await core('demo.cif.admin', 'reply', { reply: 'Handled by us', outcome: 'paid', close: true });
  assert.equal(rep.status, 403, JSON.stringify(rep.body));
  assert.equal((await core('demo.cif.admin', 'claim')).status, 403);
  assert.equal((await core('demo.cif.admin', 'close', { outcome: 'paid' })).status, 403);
  assert.equal(B.forms.mayDecide(user('demo.cif.admin'), id).ok, false);
  // the capturer cannot close (or answer) an unanswered incident
  assert.equal((await core('demo.facilitator', 'close', { outcome: 'paid' })).status, 403);
  assert.equal((await core('demo.facilitator', 'reply', { reply: 'done' })).status, 403);
  // another department of the government cannot either
  assert.equal((await core('demo.agri', 'reply', { reply: 'seen' })).status, 403);
  let row = B.store.get('form_submissions', id);
  assert.equal(row.status, 'submitted'); assert.equal(row.reply || null, null); assert.equal(row.outcome || null, null);
  assert.ok(await inQueue(), 'still waiting in the Forest Range Office queue');
  assert.ok((await N.as('demo.forest').get('/api/core/forms/queue')).body.find((x) => x.id === id), 'and in the core queue');
  // the range office (field officer or its admin) may answer through the core route
  assert.equal(B.forms.mayDecide(user('demo.forest.admin'), id).ok, true);
  const ok = await core('demo.forest', 'reply', { reply: 'Inspection planned next week.' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  // now answered: the capturer may close it, but cannot set an outcome
  const cl = await core('demo.facilitator', 'close', { outcome: 'paid' });
  assert.equal(cl.status, 200, JSON.stringify(cl.body));
  row = B.store.get('form_submissions', id);
  assert.equal(row.status, 'closed'); assert.equal(row.outcome || null, null, 'capturer cannot set the outcome');
});

test('decider: a range-office reviewer without the field officer / admin role cannot decide', async () => {
  const fo = FO().id;
  // a doctor holds forms.review, so only the module's decider stops this account
  if (!user('demo.forest.doc')) B.createUser({ username: 'demo.forest.doc', password: 'demo1234', role: 'doctor', agency_id: fo, display_name: 'Range office vet (test)', safeguarding_trained: 1 }, null);
  const f = sharedFarmer();
  const r = await report('demo.facilitator', f.id, { animal: 'wild_boar', estimated_loss: 900 }, 'wl-core-2');
  assert.equal(r.status, 200);
  assert.ok(B.forms.visible(user('demo.forest.doc'), B.store.get('form_submissions', r.body.id)), 'the reviewer can see it');
  const m = B.forms.mayDecide(user('demo.forest.doc'), r.body.id);
  assert.equal(m.ok, false); assert.match(m.why, /Forest Range Office/, 'refused by the module decider');
  assert.equal((await N.as('demo.forest.doc').post(`/api/core/forms/submissions/${r.body.id}/reply`, { reply: 'ok' })).status, 403);
  assert.equal(B.forms.mayDecide(user('demo.forest'), r.body.id).ok, true);
});

test('family sees its own incidents and plain-language claim timeline only', async () => {
  const g = user('demo.guardian');
  const my = await N.as('demo.guardian').get(base + '/my');
  assert.equal(my.status, 200);
  const me = my.body.members.find((m) => m.self);
  assert.ok(me && me.incidents.length >= 3, 'seeded incidents for the demo guardian');
  const ids = new Set(my.body.members.map((m) => m.id));
  for (const m of my.body.members) for (const s of m.incidents) assert.equal(s.person_id, m.id);
  assert.ok([...ids].every((id) => id === g.person_id || B.policy.isMinor(B.store.get('persons', id))));
  const paid = me.incidents.find((s) => s.claim && s.claim.status === 'paid');
  assert.ok(paid, 'one paid claim');
  assert.ok(paid.timeline.length >= 5);
  assert.ok(paid.timeline.every((x) => x.plain && x.plain_ml && x.label_ml));
  const open = me.incidents.find((s) => s.claim && !s.claim.final);
  assert.ok(open.timeline.some((x) => x.next), 'shows what comes next');
  assert.equal(JSON.stringify(my.body).includes('data:image'), false, 'no photos in the family list');
  // own incident opens; someone else's does not
  assert.equal((await N.as('demo.guardian').get(base + '/incidents/' + paid.id)).status, 200);
  const other = B.store.one("SELECT id FROM form_submissions WHERE form_key=? AND person_id<>? AND deleted=0", KEY, g.person_id);
  assert.equal((await N.as('demo.guardian').get(base + '/incidents/' + other.id)).status, 403);
  assert.equal((await N.as('demo.youth').get(base + '/incidents/' + paid.id)).status, 403);
  const y = await N.as('demo.youth').get(base + '/my');
  assert.equal(y.status, 200);
  assert.ok(y.body.members.every((m) => m.incidents.every((s) => s.person_id === user('demo.youth').person_id)));
});

test('security: other agency, other department, donor, hamlet-limited staff and minors are refused', async () => {
  const f = sharedFarmer();
  const sub = B.store.one('SELECT id FROM form_submissions WHERE form_key=? AND person_id=? AND deleted=0', KEY, f.id);
  const cid = claimFor(sub.id).id;
  assert.equal((await N.as('demo.facilitator.vjt').get(base + '/incidents/' + sub.id)).status, 403);
  assert.ok(!(await N.as('demo.facilitator.vjt').get(base + '/people')).body.find((p) => p.id === f.id));
  assert.equal((await N.as('demo.facilitator.vjt').post('/api/core/forms/submissions', { form_key: KEY, person_id: f.id, answers: { incident_date: today(), time_of_day: 'night', animal: 'elephant', damage: ['crops'], estimated_loss: 1, reported_forest: 'no' } })).status, 403);
  // another department (Krishi Bhavan) reviews forms too, but not these
  assert.equal((await N.as('demo.agri').get(base + '/incidents/' + sub.id)).status, 403);
  assert.deepEqual((await N.as('demo.agri').get(base + '/queue')).body.items, []);
  for (const who of ['demo.donor', 'demo.govt']) {
    assert.equal((await N.as(who).get(base + '/incidents/' + sub.id)).status, 403, who);
    assert.equal((await N.as(who).get(base + '/queue')).status, 403, who);
    assert.equal((await N.as(who).get(base + '/people')).status, 403, who);
    assert.equal((await N.as(who).get(base + '/incidents')).status, 403, who);
    assert.equal((await N.as(who).get(base + '/sightings?hamlet_id=' + h1())).status, 403, who);
    assert.equal((await N.as(who).post(`${base}/claims/${cid}/status`, { status: 'paid' })).status, 403, who);
  }
  // hamlet-limited: Thenmala's facilitator cannot open Pachakkudi's records, board, sightings or readings
  assert.equal((await N.as('demo.facilitator2').get(base + '/incidents/' + sub.id)).status, 403);
  assert.equal((await N.as('demo.facilitator2').get(base + '/incidents?hamlet_id=' + h1())).status, 403);
  assert.equal((await N.as('demo.facilitator2').get(base + '/board?hamlet_id=' + h1())).status, 403);
  assert.equal((await N.as('demo.facilitator2').post(base + '/sightings', { hamlet_id: h1(), animal: 'elephant', place: 'x' })).status, 403);
  assert.equal((await N.as('demo.facilitator2').post(base + '/readings', { hamlet_id: h1(), kind: 'rainfall_mm', value: 3 })).status, 403);
  assert.equal((await N.as('demo.facilitator2').get(base + '/readings/trend?hamlet_id=' + h1())).status, 403);
  // a family member sees only their own hamlet's board; a minor cannot post
  assert.equal((await N.as('demo.guardian').get(base + '/board?hamlet_id=' + h2())).status, 403);
  assert.equal((await N.as('demo.learner').post(base + '/sightings', { hamlet_id: h1(), animal: 'elephant', place: 'school' })).status, 403);
  // range office staff do not see the CIF helper's private lists of people
  assert.equal((await N.as('demo.forest').get(base + '/incidents?person_id=' + D.demoLearner.id)).status, 403);
});

test('mass assignment: client-supplied ids, owners, agencies and hamlets are ignored or refused', async () => {
  const theirs = B.store.one('SELECT * FROM wildlife_sightings WHERE hamlet_id=? AND reported_by<>? AND deleted=0', h1(), user('demo.facilitator').id) || B.store.one('SELECT * FROM wildlife_sightings WHERE hamlet_id=? AND deleted=0', h1());
  const r = await N.as('demo.facilitator').post(base + '/sightings', { id: theirs.id, hamlet_id: h1(), animal: 'monkey', place: 'the school road', reported_by: user('demo.steward').id, reported_by_name: 'Steward', agency_id: FO().id, deleted: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.notEqual(r.body.id, theirs.id, 'cannot overwrite another sighting');
  const row = B.store.get('wildlife_sightings', r.body.id);
  assert.equal(row.reported_by, user('demo.facilitator').id);
  assert.equal(row.agency_id, cif());
  assert.equal(row.deleted, 0);
  assert.equal(B.store.get('wildlife_sightings', theirs.id).animal, theirs.animal, 'original untouched');
  assert.equal((await N.as('demo.facilitator').del(base + '/sightings/' + theirs.id)).status, theirs.reported_by === user('demo.facilitator').id ? 200 : 403);
  // reading: id / agency / entered_by from the client are ignored
  const rd = await N.as('demo.facilitator').post(base + '/readings', { id: 'wlr_hijack', hamlet_id: h1(), kind: 'water_ph', value: 7, agency_id: FO().id, entered_by: 'x', source: 'seed' });
  assert.equal(rd.status, 200, JSON.stringify(rd.body));
  assert.notEqual(rd.body.id, 'wlr_hijack');
  assert.equal(rd.body.agency_id, cif());
  assert.equal(rd.body.source, 'manual');
  // claim update: body cannot move the claim to another person, agency or reviewing office
  const sub = B.store.one('SELECT id FROM form_submissions WHERE form_key=? AND person_id=? AND deleted=0 ORDER BY captured_at DESC', KEY, sharedFarmer().id);
  const c = claimFor(sub.id);
  const nx = (L.NEXT[c.status] || []).find((x) => x !== 'paid' && x !== 'sanctioned');
  if (nx) {
    const u = await N.as('demo.forest').post(`${base}/claims/${c.id}/status`, { status: nx, person_id: D.demoGuardian.id, agency_id: D.agencyByKey.vjt.id, review_agency_id: D.agencyByKey.vjt.id, amount_claimed: 1, submission_id: 'x', hamlet_id: h2() });
    assert.equal(u.status, 200, JSON.stringify(u.body));
  }
  const after = B.store.get('wildlife_claims', c.id);
  for (const k of ['person_id', 'agency_id', 'review_agency_id', 'amount_claimed', 'submission_id', 'hamlet_id']) assert.equal(after[k], c[k], k);
  // posting a person this helper may not see
  const stranger = D.adults.find((p) => p.hamlet_id === h2());
  assert.equal((await report('demo.facilitator', stranger.id, {}, 'wl-mass-1')).status, 403);
  // claim id of a record the user may not see
  assert.equal((await N.as('demo.agri.admin').post(`${base}/claims/${c.id}/status`, { status: 'paid' })).status, 403);
});

test('sightings: hamlet board, read-aloud sentence, early warning after two elephant sightings in 48 h', async () => {
  const b0 = await N.as('demo.facilitator2').get(base + '/board?hamlet_id=' + h2());
  assert.equal(b0.status, 200);
  assert.equal(b0.body.alert, null, 'no recent elephants in Thenmala');
  assert.ok(b0.body.sightings.every((s) => Date.parse(s.seen_at) >= Date.now() - 7 * 86400e3 - 60e3), 'last 7 days only');
  assert.ok(b0.body.rainfall.series.length >= 10 && typeof b0.body.rainfall.total === 'number', 'rainfall trend');
  const s1 = await N.as('demo.facilitator2').post(base + '/sightings', { hamlet_id: h2(), animal: 'elephant', count: 2, place: 'the river path', direction: 'towards_hamlet' });
  assert.equal(s1.status, 200, JSON.stringify(s1.body));
  assert.equal(s1.body.alert, null);
  assert.match(s1.body.sentence, /^Elephants seen near the river path today/);
  assert.match(s1.body.sentence, /Coming towards the hamlet/);
  assert.match(s1.body.sentence_ml, /ആനകളെ കണ്ടു/);
  // a resident adult may report too
  const s2 = await N.as('demo.facilitator2').post(base + '/sightings', { hamlet_id: h2(), animal: 'elephant', count: 1, place: 'the banana fields', seen_at: new Date(Date.now() - 20 * 3600e3 + 5.5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') });
  assert.equal(s2.status, 200, JSON.stringify(s2.body));
  assert.equal(s2.body.alert.code, 'elephant_alert');
  const b1 = await N.as('demo.facilitator2').get(base + '/board?hamlet_id=' + h2());
  assert.equal(b1.body.alert.sightings, 2);
  assert.match(b1.body.alert.message, /112/);
  assert.ok(b1.body.sightings.find((s) => s.id === s1.body.id));
  // Pachakkudi's seeded alert shows to its residents and staff
  assert.equal((await N.as('demo.guardian').get(base + '/board')).body.alert.code, 'elephant_alert');
  assert.equal((await N.as('demo.forest').get(base + '/board?hamlet_id=' + h1())).body.alert.code, 'elephant_alert');
  const g = await N.as('demo.guardian').post(base + '/sightings', { hamlet_id: h1(), animal: 'wild_boar', place: 'behind the school' });
  assert.equal(g.status, 200, 'adult resident may report');
  assert.equal((await N.as('demo.guardian').get(base + '/sightings?hamlet_id=' + h1())).body.find((x) => x.id === g.body.id).reported_by_name, null, 'residents do not see who reported');
  // validation
  for (const bad of [{ animal: 'dragon', place: 'x' }, { animal: 'elephant' }, { animal: 'elephant', place: 'x', count: 0 }, { animal: 'elephant', place: 'x', seen_at: '2030-01-01 10:00' }, { animal: 'elephant', place: 'x', direction: 'up' }, { animal: 'elephant', place: 'x', location: '200 10' }]) {
    assert.equal((await N.as('demo.facilitator2').post(base + '/sightings', { hamlet_id: h2(), ...bad })).status, 400, JSON.stringify(bad));
  }
});

test('readings: single entry, CSV import validated, row cap, re-import idempotent, trend', async () => {
  const post = (body) => N.as('demo.facilitator2').post(base + '/readings/import', { hamlet_id: h2(), ...body });
  const ok = await post({ kind: 'rainfall_mm', device: 'RG-test', csv: `date,mm\n${daysAgoDate(2)} 08:00,14.2\n${daysAgoDate(1)} 08:00,3\n` });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.imported, 2);
  const n0 = B.store.one("SELECT COUNT(*) n FROM wildlife_readings WHERE hamlet_id=? AND device='RG-test' AND deleted=0", h2()).n;
  await post({ kind: 'rainfall_mm', device: 'RG-test', csv: `date,mm\n${daysAgoDate(2)} 08:00,14.2\n${daysAgoDate(1)} 08:00,3\n` });
  assert.equal(B.store.one("SELECT COUNT(*) n FROM wildlife_readings WHERE hamlet_id=? AND device='RG-test' AND deleted=0", h2()).n, n0, 're-import does not duplicate');
  const bad = await post({ csv: `date,kind,value,device,animal\n${daysAgoDate(3)},camera_trap_count,4,CT9,elephant\n${daysAgoDate(3)},camera_trap_count,lots,CT9,elephant\n${daysAgoDate(3)},water_ph,19\n` });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.errors.map((e) => e.line), [3, 4]);
  const skip = await post({ skip_invalid: true, csv: `date,kind,value,device,animal\n${daysAgoDate(3)},camera_trap_count,4,CT9,elephant\n${daysAgoDate(3)},water_ph,19\n` });
  assert.equal(skip.status, 200);
  assert.equal(skip.body.imported, 1);
  assert.equal(skip.body.skipped, 1);
  const big = Array.from({ length: L.MAX_IMPORT_ROWS + 1 }, (_, i) => `${daysAgoDate(1 + (i % 60))} ${String(i % 24).padStart(2, '0')}:00,1`).join('\n');
  const cap = await post({ kind: 'rainfall_mm', csv: big });
  assert.equal(cap.status, 400);
  assert.equal(cap.body.error, 'too_many_rows');
  assert.equal((await post({ kind: 'magic', csv: '2026-10-01,1' })).status, 400);
  assert.equal((await N.as('demo.guardian').post(base + '/readings/import', { hamlet_id: h1(), kind: 'rainfall_mm', csv: `${daysAgoDate(1)},1` })).status, 403, 'families do not upload logs');
  const one = await N.as('demo.facilitator2').post(base + '/readings', { hamlet_id: h2(), kind: 'stream_level_cm', value: 88 });
  assert.equal(one.status, 200);
  assert.equal((await N.as('demo.facilitator2').post(base + '/readings', { hamlet_id: h2(), kind: 'water_ph', value: 15 })).status, 400);
  const tr = await N.as('demo.facilitator2').get(base + '/readings/trend?kind=stream_level_cm&hamlet_id=' + h2());
  assert.equal(tr.body[0].last.value, 88);
});

test('aggregate: no names, k-anonymised with complementary suppression (no subtraction), fixed window for externals', async () => {
  const r = await N.as('demo.donor').get(base + '/aggregate');
  assert.equal(r.status, 200);
  assert.equal(r.body.fixed_window, true);
  assert.deepEqual((await N.as('demo.donor').get(base + '/aggregate?days=3')).body.from, r.body.from, 'window cannot be narrowed');
  const txt = JSON.stringify(r.body);
  for (const p of D.persons) assert.ok(!txt.includes(p.id) && !txt.includes('"' + p.name + '"'));
  assert.ok(!/person_id|captured_by|"name"/.test(txt));
  assert.ok(r.body.hamlets.length >= 2);
  let sawSmall = false;
  const num = (v) => typeof v === 'number';
  for (const h of r.body.hamlets) {
    const cells = Object.values(h.by_animal);
    for (const v of [...cells, ...Object.values(h.by_damage)]) assert.ok(num(v) ? v === 0 || v >= 5 : v === '<5', 'cell ' + v);
    if (cells.some((v) => !num(v)) || Object.values(h.by_damage).some((v) => !num(v))) {
      sawSmall = true;
      assert.equal(h.incidents, 'hidden', 'row total hidden when a cell is small');
      assert.equal(h.claims, 'hidden');
      assert.equal(h.claims_paid, 'hidden');
      assert.equal(h.claims_paid_pct, null);
    } else if (num(h.incidents)) assert.equal(h.incidents, cells.reduce((a, b) => a + b, 0), 'visible total equals visible cells');
  }
  assert.ok(sawSmall, 'demo data has small cells');
  // column totals: a hidden cell anywhere in the column hides the total; otherwise the total is the sum
  for (const a of r.body.animals) {
    const col = r.body.hamlets.map((h) => h.by_animal[a.value]);
    if (col.some((v) => !num(v))) assert.equal(r.body.totals.by_animal[a.value], 'hidden', a.value);
    else { const s = col.reduce((x, y) => x + y, 0); assert.equal(r.body.totals.by_animal[a.value], s > 0 && s < 5 ? '<5' : s, a.value); }
  }
  for (const d of r.body.damages) {
    const col = r.body.hamlets.map((h) => h.by_damage[d.value]);
    if (col.some((v) => !num(v))) assert.equal(r.body.totals.by_damage[d.value], 'hidden', d.value);
  }
  // grand totals cannot be used to recover a hidden hamlet: if any hamlet is hidden, so are the grand totals
  if (r.body.hamlets.some((h) => h.suppressed)) {
    assert.equal(r.body.totals.incidents, 'hidden');
    assert.equal(r.body.totals.claims_paid, 'hidden');
    assert.equal(r.body.totals.paid_inr, null);
  }
  // subtraction attempt: grand total minus every visible hamlet total must not be computable
  const vis = r.body.hamlets.filter((h) => num(h.incidents));
  if (vis.length < r.body.hamlets.length) assert.ok(!num(r.body.totals.incidents));
  assert.equal((await N.as('demo.govt').get(base + '/aggregate')).status, 200);
  assert.equal((await N.as('demo.guardian').get(base + '/aggregate')).status, 403);
  assert.equal((await N.as('demo.facilitator').get(base + '/aggregate')).status, 403);
  const own = await N.as('demo.vjt.admin').get(base + '/aggregate');
  assert.equal(own.body.scope, 'your agency');
  assert.equal(own.body.hamlets.length, 0, 'Vanajyothi recorded no incidents');
  const st = await N.as('demo.steward').get(base + '/aggregate');
  assert.ok(st.body.hamlets.every((h) => typeof h.incidents === 'number'), 'steward sees exact counts');
});

test('consent withdrawal removes the range office\'s access at once', async () => {
  const f = sharedFarmer();
  const fo = FO().id;
  const sub = B.store.one('SELECT id FROM form_submissions WHERE form_key=? AND person_id=? AND deleted=0', KEY, f.id);
  assert.equal((await N.as('demo.forest').get(base + '/incidents/' + sub.id)).status, 200);
  const c = B.store.find('consents', { person_id: f.id, agency_id: fo, status: 'active' })[0];
  B.revokeConsent(c.id, null);
  assert.equal((await N.as('demo.forest').get(base + '/incidents/' + sub.id)).status, 403);
  assert.ok(!(await N.as('demo.forest').get(base + '/queue?all=1')).body.items.find((x) => x.person_id === f.id));
  assert.equal((await N.as('demo.forest').post(`${base}/claims/${claimFor(sub.id).id}/status`, { status: 'rejected' })).status, 403);
  // CIF's livelihood consent withdrawn → the facilitator loses access too
  const cc = B.store.find('consents', { person_id: f.id, agency_id: cif(), status: 'active' })[0];
  B.grantConsent({ person_id: f.id, agency_id: cif(), scopes: cc.scopes.filter((s) => s !== 'livelihood'), granted_by: cc.granted_by, relation: cc.relation }, null);
  assert.equal((await N.as('demo.facilitator').get(base + '/incidents/' + sub.id)).status, 403);
  assert.ok(!(await N.as('demo.facilitator').get(base + '/people')).body.find((p) => p.id === f.id));
  // restore
  B.grantConsent({ person_id: f.id, agency_id: fo, scopes: c.scopes, granted_by: c.granted_by, relation: c.relation }, null);
  B.grantConsent({ person_id: f.id, agency_id: cif(), scopes: cc.scopes, granted_by: cc.granted_by, relation: cc.relation }, null);
  assert.equal((await N.as('demo.forest').get(base + '/incidents/' + sub.id)).status, 200);
});

test('per-hamlet switch: wildlife off in Pachakkudi → 503 for staff and families there; capture refused', async () => {
  const f = sharedFarmer();
  assert.equal((await N.as('demo.steward').post(`/api/core/modules/wildlife/hamlets/${h1()}`, { enabled: false, note: 'Oorukoottam decision' })).status, 200);
  try {
    const r = await N.as('demo.facilitator').get(base + '/summary');
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'module_off_here');
    assert.equal((await N.as('demo.guardian').get(base + '/my')).status, 503);
    assert.equal((await N.as('demo.facilitator2').get(base + '/summary')).status, 200, 'Thenmala unaffected');
    // the range office works in other hamlets but not this one
    assert.equal((await N.as('demo.forest').get(base + '/summary')).status, 200);
    const b = await N.as('demo.forest').get(base + '/board?hamlet_id=' + h1());
    assert.equal(b.status, 403);
    assert.equal(b.body.error, 'module_off_here');
    assert.equal((await N.as('demo.forest').post(base + '/sightings', { hamlet_id: h1(), animal: 'elephant', place: 'x' })).status, 403);
    assert.ok(!(await N.as('demo.forest').get(base + '/queue?all=1')).body.items.find((x) => x.hamlet_id === h1()));
    const s = await N.as('demo.forest').post('/api/core/forms/submissions', { form_key: KEY, person_id: f.id, answers: { incident_date: today(), time_of_day: 'night', animal: 'elephant', damage: ['crops'], estimated_loss: 100, reported_forest: 'no' } });
    assert.equal(s.status, 403);
    assert.equal(s.body.error, 'module_off_here');
  } finally {
    await N.as('demo.steward').post(`/api/core/modules/wildlife/hamlets/${h1()}`, { enabled: true });
  }
  assert.equal((await N.as('demo.facilitator').get(base + '/summary')).status, 200);
});

test('manifest: sealed, budget, nav; other modules cannot read wildlife tables', async () => {
  const st = N.host.status().find((m) => m.id === 'wildlife');
  assert.equal(st.state, 'up');
  assert.ok(st.nav.find((n) => n.view === 'family' && n.roles.includes('guardian')));
  assert.ok(st.nav.every((n) => ['community', 'insight'].includes(n.section)));
  assert.equal(N.host.modules.get('wildlife').manifest.sealed, true);
  const express = require('express');
  const ctx = N.host._ctx(N.host.modules.get('agri'), express.Router(), 'agri_');
  for (const t of ['wildlife_claims', 'wildlife_sightings', 'wildlife_readings', 'wildlife_claim_log', 'wildlife_form_rows']) assert.throws(() => ctx.sql('SELECT * FROM ' + t), /may not read/, t);
  const b = (await N.as('demo.steward').get('/api/core/modules/budgets')).body.find((m) => m.id === 'wildlife');
  assert.equal(b.budget_storage_mb, 40);
  const cat = await N.as('demo.guardian').get(base + '/catalogue');
  assert.equal(cat.body.helpline.emergency, '112');
  assert.match(cat.body.claim_window_status, /PENDING REVIEW/);
});
