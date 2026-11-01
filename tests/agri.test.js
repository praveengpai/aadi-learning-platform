'use strict';
// Agriculture & Forest Produce module: fair-price rule, pest report round trip to the Krishi Bhavan,
// advisory approval gate, price entry permissions, privacy across agencies, consent withdrawal,
// per-hamlet switch, k-anonymised aggregates and demo-price labelling.
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PS/HgAFXQJMm+Ys9QAAAABJRU5ErkJggg==';
let N, D, B;
test.before(async () => { N = await bootDemo(); D = N.demo; B = N.brain; });
test.after(async () => { await N.close(); });

const user = (username) => B.store.one('SELECT * FROM users WHERE username=? AND deleted=0', username);
const KB = () => B.store.one("SELECT * FROM agencies WHERE name='Demo Krishi Bhavan (fictional)'");
// An adult in Pachakkudi (h1) whom the CIF facilitator may record livelihood data for.
const farmerH1 = () => D.adults.find((p) => p.hamlet_id === D.hamletByKey.h1.id && B.policy.canSee(user('demo.facilitator'), p.id, 'livelihood').ok && B.policy.activeConsent(p.id, KB().id, 'livelihood'));
const latest = (item) => B.store.one('SELECT * FROM agri_prices WHERE item=? AND unit=\'kg\' AND deleted=0 ORDER BY week_of DESC, updated_at DESC LIMIT 1', item);

test('seed: fictional Krishi Bhavan, users, programmes, consents, 12 weeks of demo prices, sales and reports', async () => {
  const kb = KB();
  assert.ok(kb, 'agency exists');
  assert.equal(user('demo.agri').role, 'field_officer');
  assert.equal(user('demo.agri').agency_id, kb.id);
  assert.equal(user('demo.agri.admin').role, 'agency_admin');
  const progs = B.store.find('programmes', { track: 'agriculture' });
  assert.ok(progs.some((p) => p.agency_id === kb.id) && progs.some((p) => p.agency_id === D.agencyByKey.cif.id));
  const weeks = B.store.one('SELECT COUNT(DISTINCT week_of) n FROM agri_prices WHERE deleted=0').n;
  assert.ok(weeks >= 12, 'about 12 weeks of prices, got ' + weeks);
  assert.ok(B.store.one("SELECT COUNT(*) n FROM form_submissions WHERE form_key='agri.produce_sale'").n > 40);
  assert.ok(B.store.one("SELECT COUNT(*) n FROM form_submissions WHERE form_key='agri.pest_report' AND status='replied'").n > 3, 'some pest reports answered');
  assert.ok(farmerH1(), 'a consented farmer in h1');
});

test('demo prices are clearly labelled as demo in data and API', async () => {
  const rows = B.store.all('SELECT source, is_demo FROM agri_prices WHERE deleted=0');
  assert.ok(rows.length > 100);
  for (const r of rows) { assert.equal(r.is_demo, 1); assert.equal(r.source, 'DEMO PRICES — NOT REAL MARKET DATA'); }
  const r = await N.as('demo.facilitator').get('/api/m/agri/prices');
  assert.equal(r.status, 200);
  assert.equal(r.body.any_demo, true);
  assert.equal(r.body.demo_label, 'DEMO PRICES — NOT REAL MARKET DATA');
  const card = r.body.items.find((i) => i.item === 'pepper');
  assert.ok(card.is_demo && card.history.length >= 10 && card.prev_price > 0, 'week-on-week change available');
  assert.equal(typeof card.change_pct, 'number');
  const agg = await N.as('demo.donor').get('/api/m/agri/aggregate');
  assert.equal(agg.body.prices_note, 'DEMO PRICES — NOT REAL MARKET DATA');
});

test('prices can be entered only by agri.advise roles; entries must name a real source', async () => {
  const body = { item: 'pepper', unit: 'kg', price: 640, market: 'Adimali market', source: 'Cooperative rate board', week_of: new Date().toISOString().slice(0, 10) };
  assert.equal((await N.as('demo.facilitator').post('/api/m/agri/prices', body)).status, 403);
  assert.equal((await N.as('demo.donor').post('/api/m/agri/prices', body)).status, 403);
  assert.equal((await N.as('demo.guardian').post('/api/m/agri/prices', body)).status, 403);
  assert.equal((await N.as('demo.agri').post('/api/m/agri/prices', { ...body, source: 'demo' })).status, 400, 'cannot pass a real entry off as demo or vice versa');
  assert.equal((await N.as('demo.agri').post('/api/m/agri/prices', { ...body, item: 'gold' })).status, 400);
  const ok = await N.as('demo.agri').post('/api/m/agri/prices', body);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.is_demo, 0);
  assert.equal((await N.as('demo.agri.admin').post('/api/m/agri/prices', { ...body, price: 650, market: 'Kattappana' })).status, 200);
  const p = (await N.as('demo.agri').get('/api/m/agri/prices')).body.items.find((i) => i.item === 'pepper');
  assert.equal(p.is_demo, false, 'latest real entry shown');
});

test('fair-price rule: a low sale price is warned and a very low one flagged with priority', async () => {
  const f = farmerH1();
  const ref = latest('cardamom');
  const date = new Date().toISOString().slice(0, 10);
  const post = (price, ref2) => N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'agri.produce_sale', person_id: f.id, answers: { item: 'cardamom', quantity: 5, unit: 'kg', sold_to: 'trader', price, date }, client_ref: ref2 });
  const fair = await post(Math.round(ref.price * 0.95), 'fp-1');
  assert.equal(fair.status, 200, JSON.stringify(fair.body));
  assert.equal(fair.body.status, 'closed', 'a sale is record-only');
  assert.equal(fair.body.flags[0].code, 'fair_price');
  const low = await post(Math.round(ref.price * 0.7), 'fp-2');
  assert.equal(low.body.flags[0].code, 'below_market');
  assert.equal(low.body.flags[0].level, 'warn');
  assert.equal(low.body.priority, 0);
  const vlow = await post(Math.round(ref.price * 0.5), 'fp-3');
  assert.equal(vlow.body.flags[0].code, 'far_below_market');
  assert.equal(vlow.body.priority, 1);
  assert.match(vlow.body.flags[0].message, /DEMO/, 'flag says the comparison was against demo prices');
  const none = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'agri.produce_sale', person_id: f.id, answers: { item: 'honey', quantity: 2, unit: 'litre', sold_to: 'cooperative', price: 300, date } });
  assert.equal(none.body.flags[0].code, 'no_reference_price', 'different unit is not compared');
});

test('pest report rules: wild animals → compensation flag; wilting over whole plot → priority 2; no photo → info', async () => {
  const f = farmerH1();
  const s1 = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'agri.pest_report', person_id: f.id, answers: { crop: 'banana', problem: 'wild_animals', animal: 'elephant', area: 'half', photo: PHOTO } });
  assert.equal(s1.status, 200, JSON.stringify(s1.body));
  assert.ok(s1.body.flags.find((x) => x.code === 'wildlife_compensation' && x.level === 'info'));
  assert.ok(!s1.body.flags.find((x) => x.code === 'no_photo'));
  const s2 = await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'agri.pest_report', person_id: f.id, answers: { crop: 'pepper', problem: 'wilting', area: 'whole_plot' } });
  assert.equal(s2.body.priority, 2);
  assert.ok(s2.body.flags.find((x) => x.code === 'no_photo'));
});

test('pest report with photo → Krishi Bhavan queue → advice reply → capturer and the farmer see it', async () => {
  const f = farmerH1();
  const fac = N.as('demo.facilitator');
  const s = await fac.post('/api/core/forms/submissions', { form_key: 'agri.pest_report', person_id: f.id, answers: { crop: 'cardamom', problem: 'insects', parts: ['fruits'], area: 'quarter', since: '2026-10-20', photo: PHOTO, notes: 'scabby capsules' }, client_ref: 'rt-1' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.status, 'submitted');
  const q = await N.as('demo.agri').get('/api/m/agri/queue');
  assert.equal(q.status, 200);
  const item = q.body.find((x) => x.id === s.body.id);
  assert.ok(item, 'forwarded to the Krishi Bhavan queue');
  assert.equal(item.answers.photo, '[photo]', 'list view strips photos');
  assert.equal(item.has_photo, true);
  const one = await N.as('demo.agri').get('/api/m/agri/reports/' + s.body.id);
  assert.ok(one.body.photo.startsWith('data:image/'), 'officer sees the photo');
  assert.equal(one.body.can_reply, true);
  // the facilitator cannot answer; the agency's agri admin can't see another agency's queue item either way
  assert.equal((await fac.post('/api/m/agri/reports/' + s.body.id + '/reply', { reply: 'x' })).status, 403);
  // approve an advisory and attach it to the reply
  const adv = (await N.as('demo.agri').get('/api/m/agri/advisories?all=1')).body.find((a) => a.key === 'cardamom_thrips');
  assert.equal((await N.as('demo.agri').post('/api/m/agri/advisories/' + adv.id + '/approve')).status, 200);
  const before = B.store.one('SELECT COUNT(*) n FROM notifications WHERE person_id=?', f.id).n;
  const r = await N.as('demo.agri').post('/api/m/agri/reports/' + s.body.id + '/reply', { reply: 'Thrips likely. Keep shade even.', reply_ml: 'ഇലപ്പേൻ ആകാം.', advisory_id: adv.id, outcome: 'advice' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, 'replied');
  assert.match(r.body.reply, /Thrips likely[\s\S]*Cardamom: watch for thrips/);
  const notes = B.store.all('SELECT message FROM notifications WHERE person_id=? ORDER BY created_at DESC', f.id);
  assert.equal(notes.length, before + 1, 'family told a reply is waiting');
  assert.ok(!/thrips|cardamom|insect/i.test(notes[0].message), 'notification carries no case details');
  const mine = (await fac.get('/api/m/agri/recent?mine=1')).body.find((x) => x.id === s.body.id);
  assert.match(mine.reply, /Thrips likely/);
  const rec = await fac.get('/api/m/agri/person/' + f.id);
  assert.ok(rec.body.pests.find((x) => x.id === s.body.id && x.reply));
  // The farmer (as a guardian with a login) sees the advice in their own family view
  const gUser = user('demo.guardian');
  const g = B.store.get('persons', gUser.person_id);
  if (B.policy.activeConsent(g.id, KB().id, 'livelihood') && B.policy.canSee(user('demo.facilitator'), g.id, 'livelihood').ok) {
    const s2 = await fac.post('/api/core/forms/submissions', { form_key: 'agri.pest_report', person_id: g.id, answers: { crop: 'pepper', problem: 'disease', area: 'few', photo: PHOTO } });
    await N.as('demo.agri').post('/api/m/agri/reports/' + s2.body.id + '/reply', { reply: 'Remove spotted leaves.', reply_ml: 'പുള്ളിയുള്ള ഇലകൾ നീക്കുക.' });
    const my = await N.as('demo.guardian').get('/api/m/agri/my');
    assert.equal(my.status, 200);
    const me = my.body.members.find((m) => m.self);
    assert.ok(me.pests.find((x) => x.id === s2.body.id && x.reply_ml === 'പുള്ളിയുള്ള ഇലകൾ നീക്കുക.'));
    assert.ok(me.sales.length >= 1, 'their sales with fair-price check');
    assert.ok(me.sales.every((x) => Array.isArray(x.flags)));
  } else assert.fail('demo guardian should be a consented farmer in the seed');
});

test('only approved advisories reach families; only agri.advise can approve', async () => {
  const fam = await N.as('demo.guardian').get('/api/m/agri/advisories');
  assert.equal(fam.status, 200);
  assert.ok(fam.body.every((a) => a.status === 'approved'));
  const all = (await N.as('demo.agri').get('/api/m/agri/advisories?all=1')).body;
  assert.ok(all.length >= 15);
  const draft = all.find((a) => a.status === 'draft' && a.key === 'honey_clean_harvest');
  assert.match(draft.review_note, /PENDING REVIEW by Krishi Bhavan \/ KVK/);
  assert.ok(!fam.body.find((a) => a.id === draft.id), 'draft hidden from families');
  assert.ok(!(await N.as('demo.guardian').get('/api/m/agri/advisories?all=1')).body.find((a) => a.id === draft.id), 'all=1 ignored for families');
  assert.equal((await N.as('demo.facilitator').post('/api/m/agri/advisories/' + draft.id + '/approve')).status, 403);
  assert.equal((await N.as('demo.guardian').post('/api/m/agri/advisories/' + draft.id + '/approve')).status, 403);
  assert.equal((await N.as('demo.agri').post('/api/m/agri/advisories/' + draft.id + '/approve')).status, 200);
  const after = (await N.as('demo.youth').get('/api/m/agri/advisories')).body;
  assert.ok(after.find((a) => a.id === draft.id && a.approved_by_name));
  const month = (await N.as('demo.youth').get('/api/m/agri/advisories?month=4')).body;
  assert.ok(month.find((a) => a.id === draft.id), 'honey advice is for April');
  assert.ok(!(await N.as('demo.youth').get('/api/m/agri/advisories?month=8')).body.find((a) => a.id === draft.id));
  // seeded content contains no pesticide doses
  for (const a of all) assert.ok(!/\b\d+(\.\d+)?\s*(ml|g|gm|grams?)\s*(\/|per)\s*(l|litre|liter)\b/i.test(a.body), 'no chemical doses: ' + a.key);
});

test('privacy: another agency\'s facilitator and a donor are refused person-level data', async () => {
  const f = farmerH1();
  const sub = B.store.one("SELECT id FROM form_submissions WHERE form_key='agri.pest_report' AND person_id=? AND deleted=0", f.id);
  assert.equal((await N.as('demo.facilitator.vjt').get('/api/m/agri/person/' + f.id)).status, 403);
  assert.equal((await N.as('demo.facilitator.vjt').get('/api/m/agri/reports/' + sub.id)).status, 403);
  assert.ok(!(await N.as('demo.facilitator.vjt').get('/api/m/agri/people')).body.find((p) => p.id === f.id));
  assert.equal((await N.as('demo.facilitator.vjt').post('/api/core/forms/submissions', { form_key: 'agri.produce_sale', person_id: f.id, answers: { item: 'pepper', quantity: 1, unit: 'kg', sold_to: 'trader', price: 100, date: '2026-10-01' } })).status, 403);
  for (const who of ['demo.donor', 'demo.govt']) {
    assert.equal((await N.as(who).get('/api/m/agri/person/' + f.id)).status, 403, who);
    assert.equal((await N.as(who).get('/api/m/agri/reports/' + sub.id)).status, 403, who);
    assert.equal((await N.as(who).get('/api/m/agri/queue')).status, 403, who);
    assert.equal((await N.as(who).get('/api/m/agri/people')).status, 403, who);
  }
  // a guardian cannot read a stranger's records
  assert.equal((await N.as('demo.guardian').get('/api/m/agri/reports/' + sub.id)).status, f.id === user('demo.guardian').person_id ? 200 : 403);
  // another agency's admin does not get the Krishi Bhavan's queue
  assert.ok(!(await N.as('demo.vjt.admin').get('/api/core/forms/queue')).body.find((x) => x.id === sub.id));
});

test('consent withdrawal removes access for the agency at once', async () => {
  const f = farmerH1();
  const kb = KB().id;
  const sub = B.store.one("SELECT id FROM form_submissions WHERE form_key='agri.pest_report' AND person_id=? AND deleted=0", f.id);
  assert.equal((await N.as('demo.agri').get('/api/m/agri/reports/' + sub.id)).status, 200);
  const c = B.store.find('consents', { person_id: f.id, agency_id: kb, status: 'active' })[0];
  B.revokeConsent(c.id, null);
  assert.equal((await N.as('demo.agri').get('/api/m/agri/reports/' + sub.id)).status, 403);
  assert.equal((await N.as('demo.agri').get('/api/m/agri/person/' + f.id)).status, 403);
  assert.ok(!(await N.as('demo.agri').get('/api/m/agri/queue')).body.find((x) => x.person && x.person.id === f.id));
  assert.ok(!(await N.as('demo.agri').get('/api/m/agri/people')).body.find((p) => p.id === f.id));
  // CIF's own livelihood consent withdrawn too → facilitator loses access
  const cc = B.store.find('consents', { person_id: f.id, agency_id: D.agencyByKey.cif.id, status: 'active' })[0];
  B.grantConsent({ person_id: f.id, agency_id: D.agencyByKey.cif.id, scopes: cc.scopes.filter((s) => s !== 'livelihood'), granted_by: cc.granted_by, relation: cc.relation }, null);
  assert.equal((await N.as('demo.facilitator').get('/api/m/agri/person/' + f.id)).status, 403);
  assert.equal((await N.as('demo.facilitator').post('/api/core/forms/submissions', { form_key: 'agri.produce_sale', person_id: f.id, answers: { item: 'pepper', quantity: 1, unit: 'kg', sold_to: 'trader', price: 100, date: '2026-10-01' } })).status, 403);
  // restore
  B.grantConsent({ person_id: f.id, agency_id: kb, scopes: c.scopes, granted_by: c.granted_by, relation: c.relation }, null);
  B.grantConsent({ person_id: f.id, agency_id: D.agencyByKey.cif.id, scopes: cc.scopes, granted_by: cc.granted_by, relation: cc.relation }, null);
  assert.equal((await N.as('demo.agri').get('/api/m/agri/reports/' + sub.id)).status, 200);
});

test('aggregate view: no names, small groups suppressed for donors; staff see their own agency', async () => {
  const r = await N.as('demo.donor').get('/api/m/agri/aggregate');
  assert.equal(r.status, 200);
  const txt = JSON.stringify(r.body);
  for (const p of D.persons.slice(0, 400)) assert.ok(!txt.includes(p.id) && !txt.includes('"' + p.name + '"'), 'no person ids or names');
  assert.ok(!/person_id|"name"/.test(txt));
  assert.ok(r.body.by_hamlet_item.length > 0);
  const small = r.body.by_hamlet_item.filter((x) => x.suppressed);
  assert.ok(small.length > 0, 'some hamlet × item cells are small');
  for (const x of small) { assert.equal(x.sellers, '<5'); assert.equal(x.quantity, null); assert.equal(x.value_inr, null); assert.equal(x.below_market_pct, null); }
  for (const x of r.body.by_hamlet_item.filter((y) => !y.suppressed)) assert.ok(typeof x.sellers === 'number' && x.sellers >= 5);
  assert.equal((await N.as('demo.govt').get('/api/m/agri/aggregate')).status, 200);
  assert.equal((await N.as('demo.guardian').get('/api/m/agri/aggregate')).status, 403);
  assert.equal((await N.as('demo.facilitator').get('/api/m/agri/aggregate')).status, 403);
  const own = await N.as('demo.vjt.admin').get('/api/m/agri/aggregate');
  assert.equal(own.body.scope, 'your agency');
  assert.equal(own.body.by_hamlet_item.length, 0, 'Vanajyothi recorded no farm data');
});

test('per-hamlet switch: agri switched off in Pachakkudi → 503 for staff there, submissions refused', async () => {
  const h1 = D.hamletByKey.h1.id;
  const f = farmerH1();
  assert.equal((await N.as('demo.steward').post(`/api/core/modules/agri/hamlets/${h1}`, { enabled: false, note: 'Oorukoottam decision' })).status, 200);
  try {
    const r = await N.as('demo.facilitator').get('/api/m/agri/summary');
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'module_off_here');
    assert.equal((await N.as('demo.guardian').get('/api/m/agri/my')).status, 503, 'family in h1 too');
    assert.equal((await N.as('demo.facilitator2').get('/api/m/agri/summary')).status, 200, 'Thenmala unaffected');
    assert.equal((await N.as('demo.agri').get('/api/m/agri/summary')).status, 200, 'officer still works in other hamlets');
    assert.ok(!(await N.as('demo.agri').get('/api/m/agri/people')).body.find((p) => p.hamlet_id === h1), 'no h1 people offered for capture');
    const s = await N.as('demo.agri').post('/api/core/forms/submissions', { form_key: 'agri.pest_report', person_id: f.id, answers: { crop: 'pepper', problem: 'insects', area: 'few' } });
    assert.equal(s.status, 403);
    assert.equal(s.body.error, 'module_off_here');
  } finally {
    await N.as('demo.steward').post(`/api/core/modules/agri/hamlets/${h1}`, { enabled: true });
  }
  assert.equal((await N.as('demo.facilitator').get('/api/m/agri/summary')).status, 200);
});

test('manifest budget and module health are reported', async () => {
  const b = (await N.as('demo.steward').get('/api/core/modules/budgets')).body.find((m) => m.id === 'agri');
  assert.equal(b.budget_storage_mb, 60);
  assert.equal(b.sync_priority, 3);
  const st = N.host.status().find((m) => m.id === 'agri');
  assert.equal(st.state, 'up');
  assert.ok(st.nav.find((n) => n.view === 'family' && n.roles.includes('guardian')));
});
