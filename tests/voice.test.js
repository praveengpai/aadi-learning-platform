'use strict';
// Community Voice & Gatherings: audio validation, review gate, consent of featured people, speaker
// withdrawal, community licence by hamlet, gatherings licence field, play counting without people,
// other-agency denial, mass assignment, aggregate suppression (incl. subtraction), per-hamlet switch,
// storage budget, seed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootDemo } = require('./helpers');
const { syntheticWav } = require('../modules/voice/audio');

let N, D, B;
test.before(async () => { N = await bootDemo(); D = N.demo; B = N.brain; });
test.after(async () => { await N.close(); });

const user = (username) => B.store.one('SELECT * FROM users WHERE username=? AND deleted=0', username);
const H1 = () => D.hamletByKey.h1.id;
const H2 = () => D.hamletByKey.h2.id;
const CIF = () => D.agencyByKey.cif.id;
const WAV = syntheticWav(1.5);
const api = (who) => N.as(who);
const ids = (rows) => (Array.isArray(rows) ? rows.map((r) => r.id) : []);

// An Ogg Opus file made of a head page and one audio page whose granule position gives `seconds`.
function oggOpus(seconds) {
  const page = (type, granule, payload) => {
    const b = Buffer.alloc(27 + 1 + payload.length);
    b.write('OggS', 0, 'latin1'); b[4] = 0; b[5] = type; b.writeBigInt64LE(BigInt(granule), 6);
    b.writeUInt32LE(1, 14); b.writeUInt32LE(type === 2 ? 0 : 1, 18); b[26] = 1; b[27] = payload.length; payload.copy(b, 28);
    return b;
  };
  const head = Buffer.alloc(19); head.write('OpusHead', 0, 'latin1'); head[8] = 1; head[9] = 1; head.writeUInt16LE(312, 10); head.writeUInt32LE(48000, 12);
  return 'data:audio/ogg;codecs=opus;base64,' + Buffer.concat([page(2, 0, head), page(4, Math.round(seconds * 48000) + 312, Buffer.from('opusframe'))]).toString('base64');
}

// A person in h1 the CIF facilitator may see (enrolment + CIF profile consent).
const visibleAdultH1 = (except = []) => D.adults.find((p) => p.hamlet_id === H1() && !except.includes(p.id) && B.policy.canSee(user('demo.facilitator'), p.id, 'profile').ok);
const voiceProg = (hid, aid) => B.store.find('programmes', { module: 'voice', hamlet_id: hid, agency_id: aid })[0];
function ensureVisible(pid) {
  const cur = B.store.find('consents', { person_id: pid, agency_id: CIF(), status: 'active' })[0];
  if (!cur || !cur.scopes.includes('profile')) {
    const p = B.store.get('persons', pid);
    B.grantConsent({ person_id: pid, agency_id: CIF(), scopes: [...new Set([...(cur ? cur.scopes : []), 'profile'])], granted_by: B.policy.isMinor(p) ? p.guardian_id : pid, relation: B.policy.isMinor(p) ? 'mother' : 'self' }, null);
  }
  B.enrol(pid, voiceProg(H1(), CIF()).id, null);
}

async function recordH1(body = {}) {
  const r = await api('demo.facilitator').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'Test bulletin', audio: WAV, duration_s: 1.5, no_identifiable: true, ...body });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
async function publish(id, reviewer = 'demo.coordinator', publisher = 'demo.cif.admin') {
  const a = await api(reviewer).post(`/api/m/voice/clips/${id}/review`, { decision: 'review' });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const b = await api(publisher).post(`/api/m/voice/clips/${id}/review`, { decision: 'publish' });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  return b.body;
}

test('seed: voice programmes (CIF + Komalikudi Youth Group), reporter login without a person, DEMO synthetic audio only', async () => {
  const progs = B.store.find('programmes', { module: 'voice' });
  assert.ok(progs.find((p) => p.hamlet_id === H1() && p.agency_id === CIF() && p.track === 'voice'));
  assert.ok(progs.find((p) => p.hamlet_id === H2() && p.agency_id === CIF()));
  const kyg = progs.find((p) => p.hamlet_id === D.hamletByKey.h11.id);
  assert.equal(kyg.agency_id, D.agencyByKey.kyg.id);
  assert.equal(kyg.sponsor_agency_id, CIF());
  const rep = user('demo.reporter');
  assert.ok(rep, 'demo.reporter exists');
  assert.equal(rep.person_id, null, 'no person-linked login');
  assert.equal(rep.agency_id, D.agencyByKey.kyg.id);
  const clips = B.store.all('SELECT * FROM voice_clips WHERE deleted=0');
  assert.ok(clips.length >= 20);
  for (const c of clips) {
    assert.equal(c.is_demo, 1);
    if (c.audio) assert.ok(c.audio.startsWith('data:audio/wav;base64,UklGR'), 'synthetic WAV');
    if (c.transcript) assert.match(c.transcript, /DEMO AUDIO/);
  }
  assert.ok(clips.some((c) => c.status === 'withdrawn' && !c.audio), 'a withdrawn story has no audio left');
  assert.ok(B.store.one('SELECT COUNT(*) n FROM voice_gatherings WHERE deleted=0 AND status=\'held\'').n >= 5);
  assert.ok(B.store.one('SELECT SUM(plays) n FROM voice_plays WHERE deleted=0').n > 50);
  // the youth reporter can record for Komalikudi; the AADI lead reviews it
  const r = await api('demo.reporter').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [D.hamletByKey.h11.id], language: 'Muthuvan', title: 'Reporter test', audio: WAV, duration_s: 1.5, no_identifiable: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await api('demo.reporter').post(`/api/m/voice/clips/${r.body.id}/review`, { decision: 'review' })).status, 403, 'reporter cannot review');
  assert.equal((await api('demo.aadi.lead').post(`/api/m/voice/clips/${r.body.id}/review`, { decision: 'review' })).status, 200);
  assert.equal((await api('demo.reporter').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'Not my hamlet', audio: WAV, no_identifiable: true })).status, 403);
});

test('audio validation: type, magic bytes, size, duration (measured beats a lying client)', async () => {
  const fac = api('demo.facilitator');
  const base = { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'Validation', no_identifiable: true };
  const post = (audio, duration_s) => fac.post('/api/m/voice/clips', { ...base, audio, duration_s });
  assert.equal((await post(undefined)).status, 400, 'no audio');
  assert.equal((await post('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PS/HgAFXQJMm+Ys9QAAAABJRU5ErkJggg==')).status, 400, 'not audio');
  assert.equal((await post('data:audio/webm;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'), 3)).status, 400, 'bytes do not match the claimed type');
  assert.equal((await post('data:audio/webm;base64,' + WAV.split(',')[1], 2)).status, 400, 'WAV labelled as WebM');
  const big = await post('data:audio/wav;base64,' + Buffer.alloc(410 * 1024, 1).toString('base64'));
  assert.equal(big.status, 400); assert.match(big.body.message, /400 KB/);
  const long = await post(syntheticWav(95, [440], 4000), 30); // ~380 KB but 95 s
  assert.equal(long.status, 400); assert.match(long.body.message, /90 seconds/);
  assert.equal((await post(oggOpus(120), 20)).status, 400, 'measured 120 s Ogg Opus refused although client says 20');
  assert.equal((await post(oggOpus(30), 10)).status, 400, 'stated length much shorter than recording');
  const ok = await post(oggOpus(30), 30);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.duration_s, 30);
  assert.equal(ok.body.mime, 'audio/ogg');
  const row = B.store.get('voice_clips', ok.body.id);
  assert.equal(row.duration_source, 'measured');
  const wav = await post(WAV, 80);
  assert.equal(wav.status, 200, 'a stated length longer than measured is harmless: the measured length wins');
  assert.equal(wav.body.duration_s, 1.5);
});

test('a draft is not heard by listeners until reviewed and published; facilitators cannot review', async () => {
  const c = await recordH1({ title: 'Draft gate' });
  assert.equal(c.status, 'draft');
  const g = api('demo.guardian');
  assert.ok(!ids((await g.get(`/api/m/voice/clips?hamlet_id=${H1()}`)).body).includes(c.id));
  assert.equal((await g.get('/api/m/voice/clips/' + c.id)).status, 404);
  assert.equal((await g.get(`/api/m/voice/clips/${c.id}/audio`)).status, 404);
  assert.equal((await g.post(`/api/m/voice/clips/${c.id}/play`, {})).status, 404);
  assert.equal((await api('demo.facilitator').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'review' })).status, 403);
  assert.equal((await api('demo.cif.admin').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'publish' })).status, 409, 'must be reviewed first');
  assert.ok((await api('demo.coordinator').get('/api/m/voice/queue')).body.find((x) => x.id === c.id), 'in the review queue');
  await api('demo.coordinator').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'review' });
  assert.ok(!ids((await g.get(`/api/m/voice/clips?hamlet_id=${H1()}`)).body).includes(c.id), 'reviewed is still not public');
  assert.equal((await api('demo.teacher').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'publish' })).status, 200, 'teacher (content.review) can publish');
  assert.ok(ids((await g.get(`/api/m/voice/clips?hamlet_id=${H1()}`)).body).includes(c.id));
  const au = await g.get(`/api/m/voice/clips/${c.id}/audio`);
  assert.equal(au.status, 200);
  assert.ok(au.body.audio.startsWith('data:audio/wav'));
  // donors never get clips
  assert.equal((await api('demo.donor').get('/api/m/voice/clips')).body.length, 0);
  assert.equal((await api('demo.donor').get(`/api/m/voice/clips/${c.id}/audio`)).status, 404);
});

test('a featured person without agreement blocks recording and publishing; revoking hides a published clip', async () => {
  const p = visibleAdultH1();
  assert.ok(p, 'a consented adult in h1');
  // nobody named and no tick → refused
  assert.equal((await api('demo.facilitator').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'No consent info', audio: WAV })).status, 400);
  // a person the facilitator cannot see (no CIF consent / other hamlet) → refused
  const stranger = D.adults.find((x) => x.hamlet_id === H2());
  assert.equal((await api('demo.facilitator').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'Stranger', audio: WAV, featured_person_ids: [stranger.id] })).status, 403);
  // featuring + "no one identifiable" contradicts
  assert.equal((await api('demo.facilitator').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'Both', audio: WAV, featured_person_ids: [p.id], no_identifiable: true })).status, 400);
  const c = await recordH1({ title: 'Featuring a neighbour', featured_person_ids: [p.id], no_identifiable: false });
  await api('demo.coordinator').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'review' });
  const cons = B.store.find('consents', { person_id: p.id, agency_id: CIF(), status: 'active' })[0];
  B.revokeConsent(cons.id, null);
  try {
    const pub = await api('demo.cif.admin').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'publish' });
    assert.equal(pub.status, 409);
    assert.match(pub.body.message, /agreed/);
  } finally {
    B.grantConsent({ person_id: p.id, agency_id: CIF(), scopes: cons.scopes, granted_by: cons.granted_by, relation: cons.relation }, null);
  }
  assert.equal((await api('demo.cif.admin').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'publish' })).status, 200);
  assert.ok(ids((await api('demo.guardian').get('/api/m/voice/clips')).body).includes(c.id));
  // consent withdrawn after publishing → the clip leaves every listing
  const c2 = B.store.find('consents', { person_id: p.id, agency_id: CIF(), status: 'active' })[0];
  B.revokeConsent(c2.id, null);
  assert.ok(!ids((await api('demo.guardian').get('/api/m/voice/clips')).body).includes(c.id));
  B.grantConsent({ person_id: p.id, agency_id: CIF(), scopes: c2.scopes, granted_by: c2.granted_by, relation: c2.relation }, null);
});

test('oral history: speaker\'s licence; withdrawal by the speaker (or a child\'s guardian) hides it everywhere', async () => {
  const gu = user('demo.guardian');
  ensureVisible(gu.person_id);
  // the speaker must belong to the one hamlet the story is for
  assert.equal((await api('demo.facilitator').post('/api/m/voice/clips', { kind: 'oral_history', hamlet_ids: [H1()], language: 'Muthuvan', title: 'No speaker', audio: WAV })).status, 400);
  const story = await recordH1({ kind: 'oral_history', title: 'Story of the old path', speaker_person_id: gu.person_id, licence: 'cc_by_nc', no_identifiable: undefined });
  assert.equal(story.licence, 'community', 'the recorder cannot choose a wider licence for the elder');
  assert.equal(story.licence_chosen_by, 'default');
  await publish(story.id);
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'cc_by_nc' })).status, 200, 'the speaker widens it herself');
  assert.equal(B.store.get('voice_clips', story.id).licence_chosen_by, 'speaker');
  assert.ok(ids((await api('demo.youth').get(`/api/m/voice/clips?hamlet_id=${H1()}`)).body).includes(story.id), 'shared licence: other hamlets may listen');
  // only the speaker / staff on their request can narrow or widen it; the recorder of a story cannot override for others
  assert.equal((await api('demo.youth').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'public' })).status, 403);
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'community' })).status, 200);
  assert.ok(!ids((await api('demo.youth').get(`/api/m/voice/clips?hamlet_id=${H1()}`)).body).includes(story.id), 'narrowed to the hamlet');
  // a stranger cannot take it back
  assert.equal((await api('demo.youth').post(`/api/m/voice/clips/${story.id}/withdraw`, {})).status, 403);
  assert.equal((await api('demo.facilitator.vjt').post(`/api/m/voice/clips/${story.id}/withdraw`, {})).status, 403);
  // put it in a playlist, then the speaker withdraws
  const pl = await api('demo.facilitator').post('/api/m/voice/playlists', { hamlet_id: H1(), date: '2026-12-01', items: [story.id] });
  assert.equal(pl.status, 200, JSON.stringify(pl.body));
  const w = await api('demo.guardian').post(`/api/m/voice/clips/${story.id}/withdraw`, { reason: 'changed my mind' });
  assert.equal(w.status, 200);
  assert.ok(w.body.withdrawn_at);
  const row = B.store.get('voice_clips', story.id);
  assert.equal(row.audio, null, 'audio removed from the synced record');
  assert.equal(row.transcript, null);
  for (const who of ['demo.guardian', 'demo.facilitator', 'demo.learner', 'demo.steward']) assert.ok(!ids((await api(who).get('/api/m/voice/clips')).body).includes(story.id), who);
  assert.equal((await api('demo.facilitator').get(`/api/m/voice/clips/${story.id}/audio`)).status, 410);
  const pl2 = (await api('demo.guardian').get(`/api/m/voice/playlist?hamlet_id=${H1()}&date=2026-12-01`)).body;
  assert.ok(!pl2.items.find((x) => x.id === story.id), 'gone from the playlist');
  assert.equal((await api('demo.cif.admin').post(`/api/m/voice/clips/${story.id}/review`, { decision: 'unpublish' })).status, 409, 'withdrawn cannot be revived');
  // a guardian may withdraw a clip featuring their minor child
  const child = D.demoLearner;
  ensureVisible(child.id);
  const kid = await recordH1({ title: 'Children sing at school', featured_person_ids: [child.id], no_identifiable: false });
  await publish(kid.id);
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${kid.id}/withdraw`, {})).status, 200);
});

test('community licence: heard in its hamlet, not in another hamlet\'s listing', async () => {
  const c = await recordH1({ title: 'Pachakkudi only' });
  await publish(c.id);
  assert.equal(B.store.get('voice_clips', c.id).licence, 'community');
  assert.ok(ids((await api('demo.guardian').get('/api/m/voice/clips')).body).includes(c.id), 'member of h1');
  assert.ok(ids((await api('demo.facilitator.vjt').get('/api/m/voice/clips')).body).includes(c.id), 'agency serving h1');
  for (const who of ['demo.youth', 'demo.facilitator2']) {
    assert.ok(!ids((await api(who).get('/api/m/voice/clips')).body).includes(c.id), who);
    assert.ok(!ids((await api(who).get(`/api/m/voice/clips?hamlet_id=${H1()}`)).body).includes(c.id), who + ' asking for h1');
    assert.equal((await api(who).get('/api/m/voice/clips/' + c.id)).status, 404, who);
    assert.equal((await api(who).get(`/api/m/voice/clips/${c.id}/audio`)).status, 404, who);
  }
  assert.ok(!ids((await api('demo.youth').get('/api/m/voice/clips?shared=1')).body).includes(c.id));
  // a public announcement is heard elsewhere too
  const pub = await recordH1({ kind: 'announcement', title: 'Public notice', licence: 'public' });
  await publish(pub.id);
  assert.ok(ids((await api('demo.youth').get('/api/m/voice/clips?shared=1')).body).includes(pub.id));
});

test('gatherings: the permission / licence field is required; attendance is checked; members see them', async () => {
  const f = api('demo.facilitator');
  const g = { hamlet_id: H1(), kind: 'film', title: 'Film night test', date: '2026-11-20', showing: 'A nature film' };
  const no = await f.post('/api/m/voice/gatherings', g);
  assert.equal(no.status, 400);
  assert.match(no.body.message, /permission or licence/);
  assert.equal((await f.post('/api/m/voice/gatherings', { ...g, licence_note: '  ' })).status, 400);
  assert.equal((await f.post('/api/m/voice/gatherings', { ...g, kind: 'sports', showing: '' })).status, 400, 'sports needs the field too');
  const ok = await f.post('/api/m/voice/gatherings', { ...g, licence_note: 'Free community-screening licence from the film-maker' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await f.put('/api/m/voice/gatherings/' + ok.body.id, { status: 'held', children: 10, youth: 5, adults: 3, elders: 1, women: 30 })).status, 400, 'women > total');
  const held = await f.put('/api/m/voice/gatherings/' + ok.body.id, { status: 'held', children: 10, youth: 5, adults: 3, elders: 1, women: 9 });
  assert.equal(held.status, 200);
  assert.equal(held.body.attendance.total, 19);
  assert.equal((await f.put('/api/m/voice/gatherings/' + ok.body.id, { licence_note: '' })).status, 400, 'cannot blank the licence later');
  assert.ok((await api('demo.guardian').get('/api/m/voice/gatherings')).body.find((x) => x.id === ok.body.id));
  assert.ok(!(await api('demo.youth').get('/api/m/voice/gatherings')).body.find((x) => x.id === ok.body.id), 'other hamlet');
  assert.deepEqual((await api('demo.donor').get('/api/m/voice/gatherings')).body, []);
  assert.equal((await api('demo.guardian').post('/api/m/voice/gatherings', { ...g, licence_note: 'x x x x x' })).status, 403);
  // link to an Oorukoottam meeting in the community module (same hamlet only)
  const mtg = B.store.one('SELECT id FROM community_meetings WHERE hamlet_id=? AND deleted=0', H1());
  if (mtg) assert.equal((await f.put('/api/m/voice/gatherings/' + ok.body.id, { meeting_id: mtg.id })).body.meeting_id, mtg.id);
  const other = B.store.one('SELECT id FROM community_meetings WHERE hamlet_id<>? AND deleted=0', H1());
  if (other) assert.equal((await f.put('/api/m/voice/gatherings/' + ok.body.id, { meeting_id: other.id })).status, 400);
});

test('plays are counted per clip and hamlet — never per person', async () => {
  const c = await recordH1({ title: 'Count me' });
  await publish(c.id);
  const before = B.store.one('SELECT COALESCE(SUM(plays),0) n FROM voice_plays WHERE clip_id=?', c.id).n;
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${c.id}/play`, {})).status, 200);
  assert.equal((await api('demo.learner').post(`/api/m/voice/clips/${c.id}/play`, {})).status, 200);
  assert.equal((await api('demo.facilitator').post(`/api/m/voice/clips/${c.id}/play`, { channel: 'hub', count: 12 })).status, 200);
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${c.id}/play`, { channel: 'hub', count: 50 })).status, 403, 'listeners cannot inflate speaker plays');
  // trying to book plays into another hamlet lands in the clip's own hamlet
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${c.id}/play`, { hamlet_id: H2() })).body.hamlet_id, H1());
  const rows = B.store.all('SELECT * FROM voice_plays WHERE clip_id=? AND deleted=0', c.id);
  assert.equal(rows.reduce((t, r) => t + r.plays, 0) - before, 14, 'the guardian\'s second play the same day is not counted again');
  const cols = Object.keys(rows[0]);
  for (const bad of ['person_id', 'user_id', 'listener', 'actor']) assert.ok(!cols.includes(bad), 'no ' + bad);
  for (const r of rows) assert.equal(r.hamlet_id, H1());
  const evs = B.store.all("SELECT actor, payload FROM events WHERE type='row.upsert' AND payload LIKE '%voice_plays%' AND payload LIKE ?", '%' + c.id + '%');
  assert.ok(evs.length >= 1);
  for (const e of evs) { assert.equal(e.actor, null, 'event log does not record who listened'); for (const u of ['demo.guardian', 'demo.learner']) assert.ok(!String(e.payload).includes(user(u).id)); }
  const reach = await api('demo.facilitator').get('/api/m/voice/reach');
  assert.ok(reach.body.rows.find((r) => r.clip_id === c.id && r.total >= 14));
});

test('another agency cannot edit, review, publish or withdraw CIF clips, nor change its gatherings', async () => {
  const c = await recordH1({ title: 'CIF clip' });
  for (const who of ['demo.vjt.admin', 'demo.facilitator.vjt', 'demo.teacher.uoc', 'demo.aadi.lead']) {
    const r = await api(who).post(`/api/m/voice/clips/${c.id}/review`, { decision: 'review' });
    assert.ok([403].includes(r.status), who + ' review → ' + r.status);
  }
  assert.equal((await api('demo.facilitator.vjt').put('/api/m/voice/clips/' + c.id, { title: 'hijacked' })).status, 403);
  assert.equal((await api('demo.facilitator.vjt').del('/api/m/voice/clips/' + c.id)).status, 403);
  await publish(c.id);
  assert.equal((await api('demo.vjt.admin').post(`/api/m/voice/clips/${c.id}/review`, { decision: 'unpublish' })).status, 403);
  assert.equal((await api('demo.vjt.admin').post(`/api/m/voice/clips/${c.id}/withdraw`, {})).status, 403);
  assert.equal((await api('demo.facilitator.vjt').post(`/api/m/voice/clips/${c.id}/licence`, { licence: 'public' })).status, 403);
  assert.equal(B.store.get('voice_clips', c.id).title, 'CIF clip');
  // a published clip is locked even for its recorder
  assert.equal((await api('demo.facilitator').put('/api/m/voice/clips/' + c.id, { title: 'changed' })).status, 409);
  const g = B.store.one('SELECT * FROM voice_gatherings WHERE hamlet_id=? AND agency_id=? AND deleted=0', H1(), CIF());
  assert.equal((await api('demo.vjt.admin').put('/api/m/voice/gatherings/' + g.id, { title: 'hijacked' })).status, 403);
  assert.equal((await api('demo.facilitator.vjt').put('/api/m/voice/gatherings/' + g.id, { attendance: 0, children: 0 })).status, 403);
  // VJT playlists can only use published clips meant for the hamlet (CIF's are fine to play, not to edit)
  assert.equal((await api('demo.facilitator.vjt').post('/api/m/voice/playlists', { hamlet_id: H1(), items: [c.id] })).status, 200);
  const draft = await recordH1({ title: 'Still draft' });
  assert.equal((await api('demo.facilitator.vjt').post('/api/m/voice/playlists', { hamlet_id: H1(), items: [draft.id] })).status, 400);
  assert.equal((await api('demo.facilitator2').post('/api/m/voice/playlists', { hamlet_id: H1(), items: [c.id] })).status, 403, 'hamlet-limited staff outside their hamlet');
  // donor / govt / guardian cannot record
  for (const who of ['demo.donor', 'demo.govt', 'demo.guardian', 'demo.learner']) assert.equal((await api(who).post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'x y z', audio: WAV, no_identifiable: true })).status, 403, who);
});

test('mass assignment: ids, agency, status, recorder and hamlet from the body are ignored or refused', async () => {
  const victim = B.store.one("SELECT * FROM voice_clips WHERE agency_id=? AND status='published' AND deleted=0 AND hamlet_id=?", CIF(), H1());
  const r = await api('demo.facilitator.vjt').post('/api/m/voice/clips', { id: victim.id, kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'Overwrite?', audio: WAV, no_identifiable: true, agency_id: CIF(), status: 'published', recorded_by: user('demo.facilitator').id, published_at: '2026-01-01', is_demo: 1, licence: 'public', reviewed_by: user('demo.cif.admin').id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.notEqual(r.body.id, victim.id, 'new record, not an overwrite');
  const row = B.store.get('voice_clips', r.body.id);
  assert.equal(row.agency_id, D.agencyByKey.vjt.id);
  assert.equal(row.status, 'draft');
  assert.equal(row.recorded_by, user('demo.facilitator.vjt').id);
  assert.equal(row.is_demo, 0);
  assert.equal(row.reviewed_by, null);
  assert.equal(B.store.get('voice_clips', victim.id).title, victim.title, 'victim untouched');
  // hamlet the user does not serve
  assert.equal((await api('demo.facilitator').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H2()], language: 'Irula', title: 'Not mine', audio: WAV, no_identifiable: true })).status, 403);
  assert.equal((await api('demo.facilitator').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: 'all', language: 'Muthuvan', title: 'All of mine', audio: WAV, no_identifiable: true })).body.hamlet_ids.join(), H1(), '"all" = all hamlets I serve');
  // own clip edit cannot move it to another agency or hamlet
  const mine = await recordH1({ title: 'Mine' });
  const e = await api('demo.facilitator').put('/api/m/voice/clips/' + mine.id, { title: 'Mine edited', agency_id: D.agencyByKey.vjt.id, hamlet_ids: [H2()], status: 'published' });
  assert.equal(e.status, 200);
  const m2 = B.store.get('voice_clips', mine.id);
  assert.equal(m2.title, 'Mine edited'); assert.equal(m2.agency_id, CIF()); assert.deepEqual(m2.hamlet_ids, [H1()]); assert.equal(m2.status, 'draft');
  // gathering: agency / hamlet / organiser cannot be reassigned
  const g = await api('demo.facilitator').post('/api/m/voice/gatherings', { hamlet_id: H1(), kind: 'sports', title: 'Match', date: '2026-11-10', licence_note: 'Nothing screened', agency_id: D.agencyByKey.vjt.id, organised_by: 'x', is_demo: 1 });
  assert.equal(g.status, 200);
  const gr = B.store.get('voice_gatherings', g.body.id);
  assert.equal(gr.agency_id, CIF()); assert.equal(gr.organised_by, user('demo.facilitator').id); assert.equal(gr.is_demo, 0);
  await api('demo.facilitator').put('/api/m/voice/gatherings/' + g.body.id, { hamlet_id: H2(), agency_id: D.agencyByKey.vjt.id });
  assert.equal(B.store.get('voice_gatherings', g.body.id).hamlet_id, H1());
  assert.equal(B.store.get('voice_gatherings', g.body.id).agency_id, CIF());
});

test('aggregate: no names, small cells suppressed, totals hidden so they cannot be subtracted back', async () => {
  const r = await api('demo.donor').get('/api/m/voice/aggregate');
  assert.equal(r.status, 200);
  const txt = JSON.stringify(r.body);
  for (const p of D.persons.slice(0, 400)) assert.ok(!txt.includes(p.id) && !txt.includes('"' + p.name + '"'));
  assert.ok(!/person_id|recorded_by|speaker/.test(txt));
  assert.equal(r.body.days, 180, 'fixed window for external viewers');
  assert.equal((await api('demo.donor').get('/api/m/voice/aggregate?days=30')).body.days, 180);
  const G = ['children', 'youth', 'adults', 'elders'];
  const rows = r.body.by_hamlet;
  assert.ok(rows.length >= 3);
  assert.ok(rows.some((x) => x.suppressed), 'the seed has a small group somewhere');
  for (const x of rows) {
    for (const k of [...G, 'women', 'plays']) assert.ok(x[k] === '<5' || x[k] === 0 || (typeof x[k] === 'number' && x[k] >= 5), `${x.hamlet}.${k}=${x[k]}`);
    if (G.some((k) => x[k] === '<5')) assert.equal(x.attendance, 'hidden', 'row total would reveal the small group');
    else assert.equal(x.attendance, G.reduce((t, k) => t + x[k], 0));
  }
  for (const k of [...G, 'women', 'plays']) {
    if (rows.some((x) => x[k] === '<5')) assert.equal(r.body.totals[k], 'hidden', 'column total ' + k);
    else assert.equal(r.body.totals[k], rows.reduce((t, x) => t + x[k], 0));
  }
  if (rows.some((x) => x.attendance === 'hidden')) assert.equal(r.body.totals.attendance, 'hidden');
  // subtraction check: no visible total minus visible cells yields a hidden cell
  for (const k of [...G, 'women']) {
    const hidden = rows.filter((x) => x[k] === '<5');
    if (hidden.length === 1) assert.equal(typeof r.body.totals[k], 'string');
  }
  // the steward sees exact numbers; staff see only their agency; families are refused
  const st = await api('demo.steward').get('/api/m/voice/aggregate');
  assert.ok(st.body.by_hamlet.every((x) => typeof x.elders === 'number'));
  assert.equal((await api('demo.govt').get('/api/m/voice/aggregate')).status, 200);
  assert.equal((await api('demo.guardian').get('/api/m/voice/aggregate')).status, 403);
  assert.equal((await api('demo.facilitator').get('/api/m/voice/aggregate')).status, 403);
  const vjt = await api('demo.vjt.admin').get('/api/m/voice/aggregate');
  assert.equal(vjt.body.scope, 'your agency');
  assert.ok(vjt.body.by_hamlet.every((x) => x.gatherings === 0));
});

test('per-hamlet switch: voice off in Pachakkudi → 503 there, nothing from there elsewhere', async () => {
  const h1 = H1();
  const shared = await recordH1({ kind: 'announcement', title: 'Shared from h1', licence: 'public' });
  await publish(shared.id);
  assert.ok(ids((await api('demo.youth').get('/api/m/voice/clips?shared=1')).body).includes(shared.id));
  assert.equal((await api('demo.vjt.admin').post(`/api/core/modules/voice/hamlets/${h1}`, { enabled: false })).status, 403, 'VJT does not run this service');
  assert.equal((await api('demo.steward').post(`/api/core/modules/voice/hamlets/${h1}`, { enabled: false, note: 'Oorukoottam decision' })).status, 200);
  try {
    for (const who of ['demo.facilitator', 'demo.guardian', 'demo.learner', 'demo.facilitator.vjt']) {
      const r = await api(who).get('/api/m/voice/clips');
      assert.equal(r.status, 503, who);
      assert.equal(r.body.error, 'module_off_here');
    }
    assert.equal((await api('demo.facilitator2').get('/api/m/voice/clips')).status, 200, 'Thenmala unaffected');
    assert.ok(!ids((await api('demo.youth').get('/api/m/voice/clips?shared=1')).body).includes(shared.id), 'h1 clips not offered elsewhere');
    assert.equal((await api('demo.teacher').post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [h1], language: 'Muthuvan', title: 'Off here', audio: WAV, no_identifiable: true })).status, 403, 'cannot record for a switched-off hamlet');
    assert.equal((await api('demo.cif.admin').post('/api/m/voice/gatherings', { hamlet_id: h1, kind: 'sports', title: 'x y z', date: '2026-11-11', licence_note: 'nothing shown' })).status, 409);
  } finally {
    await api('demo.steward').post(`/api/core/modules/voice/hamlets/${h1}`, { enabled: true });
  }
  assert.equal((await api('demo.facilitator').get('/api/m/voice/clips')).status, 200);
});

test('storage budget is declared and reported', async () => {
  const b = (await api('demo.steward').get('/api/core/modules/budgets')).body.find((m) => m.id === 'voice');
  assert.equal(b.budget_storage_mb, 80);
  assert.equal(b.sync_priority, 4);
  assert.equal(b.over_budget, false);
  const s = await api('demo.facilitator').get('/api/m/voice/storage');
  assert.equal(s.status, 200);
  assert.equal(s.body.budget_storage_mb, 80);
  assert.ok(s.body.audio_bytes > 0 && s.body.audio_mb >= 0);
  assert.equal(s.body.max_clip_kb, 400);
  assert.equal(s.body.max_clip_seconds, 90);
  assert.equal((await api('demo.donor').get('/api/m/voice/storage')).status, 403);
  const st = N.host.health().find((m) => m.id === 'voice');
  assert.equal(st.state, 'up');
  assert.ok(st.has_ui);
  assert.equal(st.extra.budget_storage_mb, 80);
  assert.ok(st.extra.clips_published > 10);
  // the module is sealed: other modules cannot read its tables
  const express = require('express');
  const ctx = N.host._ctx(N.host.modules.get('learning'), express.Router(), 'learning_');
  assert.throws(() => ctx.sql('SELECT * FROM voice_clips'), /sealed/);
});

// ---------------- Security review (wave 2) regressions ----------------

const eventsContaining = (node, needle) => node.brain.db.prepare('SELECT COUNT(*) n FROM events WHERE instr(payload, ?) > 0').get(needle).n;

test('withdrawal scrubs audio and words from the event log on every node; a fresh hub never receives them', async () => {
  const gu = user('demo.guardian');
  ensureVisible(gu.person_id);
  const audio = syntheticWav(1.73, [311.13, 349.23]);
  const words = 'Unique words of the withdrawn story ' + Date.now();
  const story = await recordH1({ kind: 'oral_history', title: 'A story to be taken back', speaker_person_id: gu.person_id, transcript: words, transcript_ml: words + ' ml', audio, duration_s: 1.7, no_identifiable: undefined });
  await publish(story.id);
  assert.ok(eventsContaining(N, audio) >= 1 && eventsContaining(N, words) >= 1, 'present in the log before withdrawal');
  const w = await api('demo.guardian').post(`/api/m/voice/clips/${story.id}/withdraw`, { reason: 'no' });
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(eventsContaining(N, audio), 0, 'no event still holds the audio');
  assert.equal(eventsContaining(N, words), 0, 'no event still holds the transcript');
  assert.equal(eventsContaining(N, 'A story to be taken back'), 0, 'nor the title');
  const row = B.store.get('voice_clips', story.id);
  assert.equal(row.audio, null); assert.equal(row.transcript, null); assert.equal(row.status, 'withdrawn');
  assert.equal(row.withdrawn_via, 'self'); assert.equal(row.withdrawn_by, gu.id);
  assert.ok(B.store.one("SELECT 1 x FROM events WHERE type='core.redact' AND instr(payload, ?) > 0", story.id), 'a core.redact event carries the removal to other nodes');
  assert.ok(B.store.verifyChain().ok, 'the hash chain still verifies');
  // the seeded withdrawn story was redacted too
  const seeded = B.store.one("SELECT id FROM voice_clips WHERE status='withdrawn' AND is_demo=1");
  assert.ok(seeded);
  const evs = B.store.all("SELECT payload FROM events WHERE type='row.upsert' AND json_extract(payload,'$.table')='voice_clips' AND json_extract(payload,'$.row.id')=?", seeded.id);
  assert.ok(evs.length >= 2);
  for (const e of evs) { const r = (typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload).row; assert.equal(r.audio, null); assert.equal(r.transcript, null); assert.equal(r.transcript_ml, null); }
  const pull = await fetch(N.base + '/api/sync/pull?after=0&limit=5000', { headers: { 'x-sync-key': 'test-key' } }).then((r) => r.text());
  assert.ok(!pull.includes(audio) && !pull.includes(words), 'a raw pull from 0 has neither');

  // staff take an elder's story back on her in-person request (Komalikudi), then a fresh hub syncs
  const h11 = D.hamletByKey.h11.id;
  const target = B.store.one("SELECT * FROM voice_clips WHERE kind='oral_history' AND status='published' AND hamlet_id=? AND audio IS NOT NULL AND deleted=0", h11);
  assert.ok(target, 'a published Komalikudi story');
  assert.ok(eventsContaining(N, target.audio) >= 1);
  assert.equal((await api('demo.aadi.facilitator').post(`/api/m/voice/clips/${target.id}/withdraw`, {})).status, 400, 'staff must confirm the speaker asked in person');
  const tw = await api('demo.aadi.facilitator').post(`/api/m/voice/clips/${target.id}/withdraw`, { in_person: true, reason: 'asked at the centre' });
  assert.equal(tw.status, 200, JSON.stringify(tw.body));
  const tr = B.store.get('voice_clips', target.id);
  assert.equal(tr.withdrawn_via, 'in_person'); assert.equal(tr.withdrawn_by, user('demo.aadi.facilitator').id);
  assert.equal(eventsContaining(N, target.audio), 0);
  const clipEvents = (node) => node.brain.db.prepare("SELECT payload FROM events WHERE json_extract(payload,'$.row.id')=?").all(target.id).map((e) => e.payload);
  assert.ok(clipEvents(N).length >= 2 && clipEvents(N).every((p) => !p.includes(target.transcript)), 'no version of this clip keeps its transcript (seed texts repeat across hamlets)');
  assert.ok(B.store.verifyChain().ok);
  const hub = await bootDemo({ role: 'hub', upstream: N.base, noSeed: true, hamlets: h11 });
  try {
    await hub.sync.runOnce();
    const hr = hub.brain.store.get('voice_clips', target.id);
    assert.ok(hr, 'the hub received the clip record');
    assert.equal(hr.status, 'withdrawn');
    assert.equal(hr.audio, null); assert.equal(hr.transcript, null);
    assert.equal(eventsContaining(hub, target.audio), 0, 'no copy of the audio on the hub');
    assert.ok(clipEvents(hub).length >= 1 && clipEvents(hub).every((p) => !p.includes(target.transcript)), 'no copy of the transcript on the hub');
    assert.equal(hub.brain.db.prepare('SELECT COUNT(*) n FROM voice_clips WHERE audio=?').get(target.audio).n, 0);
    // a story still published there did arrive with its audio (the hub really synced voice data)
    const kept = B.store.one("SELECT id, audio FROM voice_clips WHERE status='published' AND hamlet_id=? AND audio IS NOT NULL AND deleted=0", h11);
    if (kept) assert.equal(hub.brain.store.get('voice_clips', kept.id).audio, kept.audio);
  } finally { await hub.close(); }
});

test('only the speaker (or a child speaker\'s guardian) can widen an oral-history licence; staff only narrow, in person', async () => {
  const gu = user('demo.guardian');
  ensureVisible(gu.person_id);
  const story = await recordH1({ kind: 'oral_history', title: 'Licence test story', speaker_person_id: gu.person_id, licence: 'public', no_identifiable: undefined });
  assert.equal(story.licence, 'community');
  await publish(story.id);
  // the review finding: facilitator widens to public → refused, and another agency/hamlet still cannot listen
  const f = await api('demo.facilitator').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'public' });
  assert.equal(f.status, 403, JSON.stringify(f.body));
  assert.equal((await api('demo.facilitator').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'public', in_person: true })).status, 403, 'even "in person" staff cannot widen');
  assert.equal((await api('demo.cif.admin').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'cc_by_nc' })).status, 403, 'nor the agency admin');
  assert.equal(B.store.get('voice_clips', story.id).licence, 'community');
  assert.equal((await api('demo.facilitator2').get(`/api/m/voice/clips/${story.id}/audio`)).status, 404, 'another hamlet\'s staff cannot fetch the audio');
  assert.equal((await api('demo.youth').get(`/api/m/voice/clips/${story.id}/audio`)).status, 404);
  // the speaker widens; truthfully recorded
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'public' })).status, 200);
  let row = B.store.get('voice_clips', story.id);
  assert.equal(row.licence, 'public'); assert.equal(row.licence_chosen_by, 'speaker'); assert.equal(row.licence_changed_by, gu.id); assert.equal(row.licence_changed_via, 'own_login');
  // staff may narrow only on the speaker's in-person request, recorded as such
  assert.equal((await api('demo.facilitator').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'community' })).status, 400);
  assert.equal((await api('demo.facilitator.vjt').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'community', in_person: true })).status, 403, 'another agency cannot narrow');
  const n = await api('demo.facilitator').post(`/api/m/voice/clips/${story.id}/licence`, { licence: 'community', in_person: true });
  assert.equal(n.status, 200, JSON.stringify(n.body));
  row = B.store.get('voice_clips', story.id);
  assert.equal(row.licence, 'community'); assert.equal(row.licence_chosen_by, 'staff_on_speaker_request'); assert.equal(row.licence_changed_by, user('demo.facilitator').id); assert.equal(row.licence_changed_via, 'in_person');
  // a recorder's edit cannot change the elder's licence either
  const draft = await recordH1({ kind: 'oral_history', title: 'Draft story', speaker_person_id: gu.person_id, no_identifiable: undefined });
  const e = await api('demo.facilitator').put('/api/m/voice/clips/' + draft.id, { licence: 'public' });
  assert.equal(e.status, 200);
  assert.equal(B.store.get('voice_clips', draft.id).licence, 'community');
  // a minor speaker's guardian may widen for the child
  const child = D.demoLearner;
  ensureVisible(child.id);
  const kid = await recordH1({ kind: 'oral_history', title: 'A child tells a story', speaker_person_id: child.id, no_identifiable: undefined });
  await publish(kid.id);
  assert.equal((await api('demo.guardian').post(`/api/m/voice/clips/${kid.id}/licence`, { licence: 'cc_by_nc' })).status, 200);
  assert.equal(B.store.get('voice_clips', kid.id).licence_chosen_by, 'guardian');
});

test('plays cannot be inflated: phones count 1, today only, once per listener per clip per day; hub group bounded', async () => {
  const c = await recordH1({ title: 'Inflate me' });
  await publish(c.id);
  const sum = () => B.store.one('SELECT COALESCE(SUM(plays),0) n FROM voice_plays WHERE clip_id=? AND deleted=0', c.id).n;
  const r = await api('demo.learner').post(`/api/m/voice/clips/${c.id}/play`, { count: 50, day: '2026-10-01' });
  assert.equal(r.status, 200);
  assert.equal(r.body.counted, true);
  assert.equal(r.body.day, new Date().toISOString().slice(0, 10), 'server day, not the client\'s');
  assert.equal(sum(), 1, 'a phone play is always 1');
  assert.equal(B.store.one('SELECT COUNT(*) n FROM voice_plays WHERE clip_id=? AND day=?', c.id, '2026-10-01').n, 0, 'no back-dated row');
  for (let i = 0; i < 5; i++) assert.equal((await api('demo.learner').post(`/api/m/voice/clips/${c.id}/play`, {})).body.counted, false);
  assert.equal(sum(), 1, 'repeat plays the same day are not counted');
  assert.equal((await api('demo.learner').post(`/api/m/voice/clips/${c.id}/play`, { channel: 'hub', count: 50 })).status, 403, 'a learner cannot report speaker plays');
  const hubPlay = await api('demo.facilitator').post(`/api/m/voice/clips/${c.id}/play`, { channel: 'hub', count: 5000 });
  assert.equal(hubPlay.status, 200);
  assert.equal(sum(), 1 + 50, 'hub group count is capped');
  assert.equal((await api('demo.facilitator').post(`/api/m/voice/clips/${c.id}/play`, { channel: 'hub', count: 50 })).body.counted, false, 'once per staff per clip per day');
  assert.equal(sum(), 51);
  // nothing that identifies the listener, not even a hashed key, is stored or synced
  const cols = B.db.prepare('PRAGMA table_info(voice_plays)').all().map((x) => x.name);
  assert.deepEqual(cols.filter((x) => !['id', 'updated_at', 'node', 'deleted', 'clip_id', 'hamlet_id', 'day', 'channel', 'plays'].includes(x)), []);
  const evs = B.store.all("SELECT actor, payload FROM events WHERE json_extract(payload,'$.table')='voice_plays' AND instr(payload, ?) > 0", c.id);
  for (const e of evs) { assert.equal(e.actor, null); assert.ok(!String(e.payload).includes(user('demo.learner').id)); }
});

test('audio with bytes hidden after the media data is refused (WAV, Ogg, WebM, MP4)', async () => {
  const fac = api('demo.facilitator');
  const post = (audio, duration_s = 2) => fac.post('/api/m/voice/clips', { kind: 'bulletin', hamlet_ids: [H1()], language: 'Muthuvan', title: 'Trailing bytes', audio, duration_s, no_identifiable: true });
  const tail = Buffer.from('<script>alert(1)</script>PAYLOAD');
  const b64 = (u) => Buffer.from(u.split(',')[1], 'base64');
  const withTail = (mime, buf) => `data:${mime};base64,` + Buffer.concat([buf, tail]).toString('base64');
  // WAV
  const wav = b64(WAV);
  assert.equal((await post(withTail('audio/wav', wav))).status, 400, 'WAV with bytes after the RIFF data');
  const lying = Buffer.concat([wav, tail]); lying.writeUInt32LE(lying.length - 8, 4); // RIFF grown to cover the junk
  assert.equal((await post('data:audio/wav;base64,' + lying.toString('base64'))).status, 400, 'junk inside RIFF after the data chunk');
  // Ogg
  const ogg = oggOpus(2);
  assert.equal((await post(ogg)).status, 200);
  assert.equal((await post(withTail('audio/ogg', b64(ogg)))).status, 400, 'Ogg with bytes after the last page');
  // WebM: EBML header + sized Segment { Info { TimecodeScale, Duration } }
  const el = (id, body) => { const sz = body.length; return Buffer.concat([Buffer.from(id), Buffer.from([0x01, 0, 0, 0, (sz >>> 24) & 255, (sz >>> 16) & 255, (sz >>> 8) & 255, sz & 255]), body]); };
  const dur = Buffer.alloc(8); dur.writeDoubleBE(2000);
  const info = el([0x15, 0x49, 0xa9, 0x66], Buffer.concat([el([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40])), el([0x44, 0x89], dur)]));
  const webm = Buffer.concat([el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x86], Buffer.from([1]))), el([0x18, 0x53, 0x80, 0x67], info)]);
  const okW = await post('data:audio/webm;base64,' + webm.toString('base64'));
  assert.equal(okW.status, 200, JSON.stringify(okW.body));
  assert.equal(okW.body.duration_s, 2);
  assert.equal((await post(withTail('audio/webm', webm))).status, 400, 'WebM payload larger than the declared Segment');
  // MP4: ftyp + moov{mvhd} + mdat
  const box = (type, body) => { const b = Buffer.alloc(8); b.writeUInt32BE(8 + body.length, 0); b.write(type, 4, 'latin1'); return Buffer.concat([b, body]); };
  const mvhd = Buffer.alloc(20); mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(2000, 16);
  const mp4 = Buffer.concat([box('ftyp', Buffer.from('M4A \0\0\0\0', 'latin1')), box('moov', box('mvhd', mvhd)), box('mdat', Buffer.alloc(64, 7))]);
  const okM = await post('data:audio/mp4;base64,' + mp4.toString('base64'));
  assert.equal(okM.status, 200, JSON.stringify(okM.body));
  assert.equal((await post(withTail('audio/mp4', mp4))).status, 400, 'MP4 with bytes after the last box');
});
