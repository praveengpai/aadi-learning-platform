'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { bootDemo } = require('./helpers');

let S; let TMP;
const savedEnv = process.env.AADI_LIBRARY_DIR;
test.before(async () => { delete process.env.AADI_LIBRARY_DIR; S = await bootDemo(); });
test.after(async () => {
  if (savedEnv === undefined) delete process.env.AADI_LIBRARY_DIR; else process.env.AADI_LIBRARY_DIR = savedEnv;
  if (TMP) fs.rmSync(TMP, { recursive: true, force: true });
  if (S) await S.close();
});

const M = '/api/m/library';
const idOf = (manifest_id, href) => crypto.createHash('sha1').update(manifest_id + '|' + href).digest('hex').slice(0, 16);
const raw = async (user, p, headers = {}) => {
  const tok = user ? await S.login(user) : null;
  const r = await fetch(S.base + p, { headers: { ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...headers } });
  return { status: r.status, headers: r.headers, buf: Buffer.from(await r.arrayBuffer()) };
};

test('demo catalogue loads as fallback; status reports source and totals', async () => {
  const r = await S.as('demo.steward').get(M + '/status');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.source, 'demo');
  assert.strictEqual(r.body.totals.items, 1064);
  assert.strictEqual(r.body.totals.offline, 0);
  assert.ok(r.body.permission_needed > 0, 'COPYRIGHTED/MANUAL counted');
  assert.ok(r.body.by_section.length >= 8);
  const h = S.host.health().find((m) => m.id === 'library');
  assert.strictEqual(h.state, 'up');
  assert.ok(h.extra.reads >= 15 && h.extra.assignments >= 5, 'seeded reads + assignments');
  const d = await S.as('demo.donor').get(M + '/status');
  assert.strictEqual(d.status, 403);
});

test('learner sees own-class books in their medium, assignments, continue reading — never teacher items', async () => {
  const L = S.as('demo.learner');
  const me = await L.get(M + '/me');
  assert.strictEqual(me.status, 200);
  const cls = Number(S.demo.demoLearner.school_class);
  assert.strictEqual(me.body.person.cls_num, cls);
  assert.ok(me.body.textbooks.length >= 3, 'current-class books');
  for (const b of me.body.textbooks) {
    assert.strictEqual(b.cls_num, cls);
    assert.strictEqual(b.audience, 'learner');
    assert.ok(!/^English$/.test(b.medium), 'Malayalam/Common preferred over English for a Muthuvan-speaking child');
  }
  assert.deepStrictEqual(me.body.medium.preferred, ['Malayalam', 'Common', 'English']);
  assert.ok(me.body.assigned.length >= 2, 'programme + personal assignments');
  assert.ok(me.body.continue_reading.length >= 1);
  assert.ok(me.body.tracks.every((t) => t.items.every((i) => i.audience === 'learner')));
  const en = await L.get(M + '/me?medium=English');
  assert.ok(en.body.textbooks.length && en.body.textbooks.every((b) => /English/.test(b.medium) || ['', 'All', 'Common'].includes(b.medium)));

  const br = await L.get(M + '/browse');
  assert.strictEqual(br.status, 200);
  assert.ok(br.body.total > 500 && br.body.total < 1064, 'teacher items filtered out');
  assert.strictEqual(br.body.items.length, 50);
  assert.ok(br.body.facets.sections.length >= 5 && br.body.facets.classes.length === 12);
  const t = await L.get(M + '/browse?audience=teacher');
  assert.ok(t.body.items.every((i) => i.audience === 'learner'), 'audience filter ignored for learners');
  const f = await L.get(M + '/browse?section=' + encodeURIComponent('School (Class 1–12)') + '&cls=8&q=science');
  assert.ok(f.body.items.length > 0 && f.body.items.every((i) => i.cls_num === 8));

  const staff = await S.as('demo.teacher').get(M + '/browse?audience=teacher');
  assert.ok(staff.body.total > 100 && staff.body.items.every((i) => i.audience === 'teacher'));
  const tid = staff.body.items[0].id;
  assert.strictEqual((await L.get(M + '/items/' + tid)).status, 404, 'teacher item detail hidden from learner');
  assert.strictEqual((await S.as('demo.teacher').get(M + '/items/' + tid)).status, 200);
});

test('reading log: open, bookmark, finish, rating; events emitted; youth sees exam shelf', async () => {
  const L = S.as('demo.learner');
  const me = (await L.get(M + '/me')).body;
  const item = me.textbooks.find((b) => !(b.read && b.read.opens)) || me.textbooks[0];
  const o1 = await L.post(`${M}/items/${item.id}/open`);
  assert.strictEqual(o1.status, 200);
  const o2 = await L.post(`${M}/items/${item.id}/open`);
  assert.strictEqual(o2.body.read.opens, o1.body.read.opens + 1);
  const p = await L.post(`${M}/items/${item.id}/progress`, { bookmark: 'p. 7', finished: true, rating: 3 });
  assert.strictEqual(p.status, 200);
  assert.strictEqual(p.body.read.finished, true);
  const bad = await L.post(`${M}/items/${item.id}/progress`, { rating: 5 });
  assert.strictEqual(bad.status, 400);
  const row = S.brain.store.find('library_reads', { person_id: S.demo.demoLearner.id, item_id: item.id })[0];
  assert.strictEqual(row.finished, 1); assert.strictEqual(row.rating, 3); assert.strictEqual(row.bookmark, 'p. 7');
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(S.brain.store.one("SELECT COUNT(*) n FROM events WHERE type='library.opened'").n >= 2);
  assert.ok(S.brain.store.one("SELECT COUNT(*) n FROM events WHERE type='library.finished'").n >= 1);
  // staff cannot write reads
  assert.strictEqual((await S.as('demo.facilitator').post(`${M}/items/${item.id}/open`)).status, 403);

  const y = await S.as('demo.youth').get(M + '/me');
  assert.strictEqual(y.status, 200);
  assert.strictEqual(y.body.textbooks.length, 0, 'youth with non-numeric class gets no class textbooks');
  assert.ok(y.body.tracks.some((t) => t.section === 'Exam preparation' && t.items.length > 0));
  assert.ok(y.body.assigned.some((a) => a.section === 'Exam preparation'), 'PSC paper assigned to the programme');
});

test('assignments: own agency only, canSee for learners, notifications, withdraw', async () => {
  const me = (await S.as('demo.learner').get(M + '/me')).body;
  const item = me.textbooks[1] || me.textbooks[0];
  const youthId = S.demo.demoYouth.id;
  // other-agency facilitator, learner they cannot see
  const x = await S.as('demo.facilitator.vjt').post(M + '/assignments', { item_id: item.id, person_id: youthId, note: 'x' });
  assert.strictEqual(x.status, 403);
  const cifProg = S.demo.programmes.find((p) => p.agency_id === S.demo.agencyByKey.cif.id && p.hamlet_id === S.demo.hamletByKey.h1.id && p.track === 'tuition');
  const y = await S.as('demo.facilitator.vjt').post(M + '/assignments', { item_id: item.id, programme_id: cifProg.id });
  assert.strictEqual(y.status, 403, 'cannot assign to another agency\'s programme');
  assert.strictEqual((await S.as('demo.donor').post(M + '/assignments', { item_id: item.id, person_id: youthId })).status, 403);
  assert.strictEqual((await S.as('demo.learner').post(M + '/assignments', { item_id: item.id, person_id: youthId })).status, 403);

  const before = S.brain.store.one("SELECT COUNT(*) n FROM notifications WHERE person_id=? AND module='library'", S.demo.demoLearner.id).n;
  const ok = await S.as('demo.facilitator').post(M + '/assignments', { item_id: item.id, person_id: S.demo.demoLearner.id, note: 'Read page 3', due: '2026-12-01' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.notified, 1);
  const n = S.brain.store.one("SELECT * FROM notifications WHERE person_id=? AND module='library' ORDER BY created_at DESC", S.demo.demoLearner.id);
  assert.ok(n.message.startsWith(S.brain.brand.short + ':'));
  assert.ok(S.brain.store.one("SELECT COUNT(*) n FROM notifications WHERE person_id=? AND module='library'", S.demo.demoLearner.id).n > before);

  const mine = await S.as('demo.learner').get(M + '/assignments');
  assert.ok(mine.body.some((a) => a.id === ok.body.assignment.id));
  const staff = await S.as('demo.facilitator').get(M + '/assignments');
  assert.ok(staff.body.length >= 2 && staff.body.every((a) => a.agency_id === S.demo.agencyByKey.cif.id));
  const vjt = await S.as('demo.facilitator.vjt').get(M + '/assignments');
  assert.ok(vjt.body.every((a) => a.agency_id === S.demo.agencyByKey.vjt.id));
  // teacher materials cannot be assigned
  const tItem = (await S.as('demo.teacher').get(M + '/browse?audience=teacher')).body.items[0];
  assert.strictEqual((await S.as('demo.facilitator').post(M + '/assignments', { item_id: tItem.id, person_id: S.demo.demoLearner.id })).status, 400);

  assert.strictEqual((await S.as('demo.facilitator.vjt').del(M + '/assignments/' + ok.body.assignment.id)).status, 403);
  assert.strictEqual((await S.as('demo.facilitator').del(M + '/assignments/' + ok.body.assignment.id)).status, 200);
  const after = await S.as('demo.learner').get(M + '/assignments');
  assert.ok(!after.body.some((a) => a.id === ok.body.assignment.id));
});

test('guardian sees ward\'s books read-only; not other children', async () => {
  const G = S.as('demo.guardian');
  const kids = await G.get(M + '/children');
  assert.ok(kids.body.some((k) => k.id === S.demo.demoLearner.id));
  const c = await G.get(M + '/child/' + S.demo.demoLearner.id);
  assert.strictEqual(c.status, 200);
  assert.ok(c.body.assigned.length >= 1 && c.body.recent.length >= 1);
  assert.strictEqual((await G.get(M + '/child/' + S.demo.demoYouth.id)).status, 403);
  assert.strictEqual((await G.post(`${M}/items/${c.body.recent[0].item_id}/open`)).status, 403);
});

test('curation: hidden item disappears for learners; featured gets a star', async () => {
  const L = S.as('demo.learner');
  const me = (await L.get(M + '/me')).body;
  const target = me.textbooks[0];
  assert.strictEqual((await S.as('demo.facilitator').post(M + '/curation', { item_id: target.id, status: 'hidden' })).status, 403);
  const h = await S.as('demo.steward').post(M + '/curation', { item_id: target.id, status: 'hidden', note: 'Outdated edition' });
  assert.strictEqual(h.status, 200);
  const me2 = (await L.get(M + '/me')).body;
  assert.ok(!me2.textbooks.some((b) => b.id === target.id), 'gone from my books');
  assert.strictEqual((await L.get(M + '/items/' + target.id)).status, 404);
  const br = (await L.get(M + '/browse?q=' + encodeURIComponent(target.title))).body;
  assert.ok(!br.items.some((i) => i.id === target.id));
  const st = (await S.as('demo.steward').get(M + '/status')).body;
  assert.ok(st.hidden >= 1);
  const adminView = (await S.as('demo.steward').get(M + '/browse?hidden=1')).body;
  assert.ok(adminView.items.some((i) => i.id === target.id && i.hidden));
  // feature another
  const other = me2.textbooks[0];
  await S.as('demo.teacher').post(M + '/curation', { item_id: other.id, status: 'featured' });
  const me3 = (await L.get(M + '/me')).body;
  assert.ok(me3.textbooks.find((b) => b.id === other.id).featured);
  await S.as('demo.steward').post(M + '/curation', { item_id: target.id, status: 'none' });
  assert.ok((await L.get(M + '/me')).body.textbooks.some((b) => b.id === target.id), 'unhidden again');
});

test('server folder: offline files stream with Range; traversal, symlinks, roles refused; bad JSON falls back', async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aadi-lib-'));
  const lib = path.join(TMP, 'lib'); const outside = path.join(TMP, 'outside');
  fs.mkdirSync(path.join(lib, 'SCERT', 'Class 8'), { recursive: true }); fs.mkdirSync(outside);
  const pdf = Buffer.from('%PDF-1.4\n' + 'x'.repeat(2000) + '\n%%EOF\n');
  fs.writeFileSync(path.join(lib, 'SCERT', 'Class 8', 'Maths Part 1.pdf'), pdf);
  fs.writeFileSync(path.join(lib, 'SCERT', 'Class 8', 'Teacher text.pdf'), pdf);
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'top secret');
  let symlinkOk = true;
  try { fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(lib, 'escape.txt')); } catch (_) { symlinkOk = false; }
  const it = (manifest_id, href, extra = {}) => ({ manifest_id, section: 'School (Class 1–12)', track: 'tuition', category: 'School_Textbooks', cls: '8', subject: 'Mathematics', medium: 'Malayalam', edition: '2024', owner: 'SCERT Kerala', licence: 'GOV_FREE', audience: 'learner', source_page: 'https://scert.kerala.gov.in/', title: 'T ' + manifest_id, access: 'offline', href, bytes: pdf.length, ...extra });
  const items = [
    it('X1', 'SCERT/Class%208/Maths%20Part%201.pdf'),
    it('X2', 'SCERT/Class%208/Teacher%20text.pdf', { audience: 'teacher' }),
    it('X3', '..%2Foutside%2Fsecret.txt'),
    it('X4', '../outside/secret.txt'),
    it('X5', '%2Fetc%2Fpasswd'),
    it('X6', 'escape.txt'),
    it('X7', 'https://example.org/book', { access: 'online' }),
  ];
  fs.writeFileSync(path.join(lib, 'catalogue.json'), JSON.stringify({ meta: { built: '2026-10-31', total: items.length, offline: 6, online: 1 }, items }));
  process.env.AADI_LIBRARY_DIR = lib;

  const st = (await S.as('demo.steward').get(M + '/status')).body;
  assert.strictEqual(st.source, 'server');
  assert.strictEqual(st.built, '2026-10-31');
  assert.strictEqual(st.totals.offline, 6);

  const id1 = idOf('X1', items[0].href);
  const full = await raw('demo.learner', `${M}/file/${id1}`);
  assert.strictEqual(full.status, 200);
  assert.strictEqual(full.headers.get('content-type'), 'application/pdf');
  assert.match(full.headers.get('cache-control'), /private/);
  assert.strictEqual(full.headers.get('accept-ranges'), 'bytes');
  assert.ok(full.buf.equals(pdf));
  const part = await raw('demo.learner', `${M}/file/${id1}`, { range: 'bytes=0-7' });
  assert.strictEqual(part.status, 206);
  assert.strictEqual(part.buf.toString(), '%PDF-1.4');
  assert.strictEqual(part.headers.get('content-range'), `bytes 0-7/${pdf.length}`);
  const tail = await raw('demo.learner', `${M}/file/${id1}`, { range: 'bytes=-6' });
  assert.strictEqual(tail.status, 206); assert.ok(tail.buf.equals(pdf.subarray(-6)));
  assert.strictEqual((await raw('demo.learner', `${M}/file/${id1}`, { range: 'bytes=999999-' })).status, 416);

  for (const k of ['X3', 'X4', 'X5']) {
    const r = await raw('demo.learner', `${M}/file/${idOf(k, items.find((i) => i.manifest_id === k).href)}`);
    assert.strictEqual(r.status, 403, 'traversal refused for ' + k);
    assert.ok(!r.buf.toString().includes('top secret'));
  }
  if (symlinkOk) assert.strictEqual((await raw('demo.learner', `${M}/file/${idOf('X6', 'escape.txt')}`)).status, 403, 'symlink escape refused');

  const id2 = idOf('X2', items[1].href);
  assert.strictEqual((await raw('demo.learner', `${M}/file/${id2}`)).status, 403, 'teacher item refused to learner');
  assert.strictEqual((await raw('demo.guardian', `${M}/file/${id2}`)).status, 403);
  assert.strictEqual((await raw('demo.teacher', `${M}/file/${id2}`)).status, 200);
  assert.strictEqual((await raw('demo.donor', `${M}/file/${id1}`)).status, 403, 'donor gets no files');
  assert.strictEqual((await raw('demo.employer', `${M}/file/${id1}`)).status, 403);
  assert.strictEqual((await raw(null, `${M}/file/${id1}`)).status, 401);
  assert.strictEqual((await raw('demo.learner', `${M}/file/${idOf('X7', 'https://example.org/book')}`)).status, 404, 'online items are not served');

  // learner's shelf now shows the offline book
  const me = (await S.as('demo.learner').get(M + '/me')).body;
  if (Number(S.demo.demoLearner.school_class) === 8) assert.ok(me.textbooks.some((b) => b.id === id1 && b.access === 'offline' && b.open_url === `${M}/file/${id1}`));

  // malformed catalogue in a fresh folder → demo fallback, no crash
  const bad = path.join(TMP, 'bad'); fs.mkdirSync(bad); fs.writeFileSync(path.join(bad, 'catalogue.json'), '{not json');
  process.env.AADI_LIBRARY_DIR = bad;
  const st2 = (await S.as('demo.steward').get(M + '/status')).body;
  assert.strictEqual(st2.source, 'demo');
  assert.ok(st2.error);
  process.env.AADI_LIBRARY_DIR = path.join(TMP, 'missing');
  const st3 = await S.as('demo.steward').get(M + '/status');
  assert.strictEqual(st3.status, 200); assert.strictEqual(st3.body.source, 'demo');
  delete process.env.AADI_LIBRARY_DIR;
});
