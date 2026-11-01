'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bootDemo } = require('./helpers');

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);

test('shelf: works when every source module/table is missing', () => {
  // Fake ctx whose reads of any non-shelf table fail, as if the module were not installed.
  const noop = () => {};
  const rows = { shelf_reviews: [], shelf_log: [] };
  const sql = (q) => { const t = (q.match(/FROM\s+([a-z_]+)/i) || [])[1]; if (!t || !t.startsWith('shelf_')) throw new Error(`module "shelf" may not read table "${t}" directly`); return []; };
  const ctx = {
    router: { get: noop, post: noop, put: noop, delete: noop }, requires: () => noop, authed: noop, log: noop,
    data: { find: (t) => rows[t] || [], put: (t, r) => r, get: () => null }, sql, sqlOne: (q) => { sql(q); return { n: 0 }; }, tx: (fn) => fn(), emit: noop, on: noop,
    httpError: (s, m) => Object.assign(new Error(m), { status: s }),
    brain: { brand: { name: 'X' }, persons: { basic: () => null }, policy: {}, hamlets: { get: () => null } },
  };
  const api = require('../modules/shelf/index.js')(ctx);
  const items = api._internal.collect('per_nobody');
  assert.deepEqual(items, []);
  assert.deepEqual(api._internal.organise({ school_class: '8' }, items), []);
  const r = api._internal.reviseToday('per_nobody', items);
  assert.equal(r.items.length, 0);
  assert.equal(r.exams, null);
  assert.equal(api._internal.acadYear('2026-06-01T00:00:00Z'), 2026);
  assert.equal(api._internal.acadYear('2026-05-31T00:00:00Z'), 2025);
});

test('shelf module end-to-end', async (t) => {
  const app = await bootDemo();
  const { demo } = app;
  const L = demo.demoLearner; const Y = demo.demoYouth;
  t.after(() => app.close());

  await t.test('learner sees own shelf grouped in year folders with class labels', async () => {
    const r = await app.as('demo.learner').get('/api/m/shelf/me');
    assert.equal(r.status, 200);
    const d = r.body;
    assert.equal(d.person.id, L.id);
    assert.ok(d.self);
    assert.ok(d.folders.length >= 1);
    assert.ok(d.totals.items > 0 && d.totals.lessons > 0);
    const cur = d.folders.find((f) => f.current);
    assert.ok(cur, 'a folder for the current academic year');
    assert.match(cur.label, /^\d{4}–\d{2} · Class \d+$/);
    assert.equal(cur.class, Number(L.school_class));
    for (const f of d.folders) {
      assert.ok(f.subjects.length);
      for (const s of f.subjects) for (const it of s.items) {
        assert.ok(['lesson', 'quiz', 'mock', 'language', 'lifeskill', 'book', 'homework'].includes(it.kind));
        assert.ok(it.link && it.link.startsWith('#/m/' + it.module + '/'), it.link);
        assert.ok(it.title && it.completed_at);
      }
    }
    assert.ok(d.streak.days >= 1, 'seeded revision streak is alive');
    assert.ok(d.passport_link.endsWith(L.id));
  });

  await t.test('youth shelf gathers items from at least two modules', async () => {
    const d = (await app.as('demo.youth').get('/api/m/shelf/me')).body;
    assert.ok(d.modules.length >= 2, 'modules: ' + d.modules.join(','));
    assert.ok(d.modules.includes('exams'));
    const kinds = new Set(d.folders.flatMap((f) => f.subjects.flatMap((s) => s.items.map((i) => i.kind))));
    assert.ok(kinds.size >= 2);
    assert.ok(d.revise.exams && d.revise.exams.link === '#/m/exams/revise', 'links to Exam Prep revision instead of duplicating it');
    assert.equal(typeof d.revise.exams.due, 'number');
  });

  await t.test('revise today: 3–5 items, deterministic for the day', async () => {
    for (const u of ['demo.learner', 'demo.youth']) {
      const a = (await app.as(u).get('/api/m/shelf/today')).body;
      const b = (await app.as(u).get('/api/m/shelf/today')).body;
      assert.ok(a.items.length >= 3 && a.items.length <= 5, `${u}: ${a.items.length}`);
      assert.deepEqual(a.items.map((i) => i.kind + '|' + i.ref), b.items.map((i) => i.kind + '|' + i.ref));
      assert.equal(a.date, today());
    }
  });

  await t.test('POST /review updates interval and due; list stays stable', async () => {
    const before = (await app.as('demo.learner').get('/api/m/shelf/today')).body;
    const open = before.items.filter((i) => !i.done_today);
    assert.ok(open.length >= 2);
    const [a, b] = open;
    const ra = await app.as('demo.learner').post('/api/m/shelf/review', { kind: a.kind, ref: a.ref, result: 'hard' });
    assert.equal(ra.status, 200);
    assert.ok(ra.body.interval_days >= 1 && ra.body.interval_days <= 2);
    assert.equal(ra.body.due, addDays(ra.body.interval_days));
    const rb = await app.as('demo.learner').post('/api/m/shelf/review', { kind: b.kind, ref: b.ref, result: 'easy' });
    assert.equal(rb.status, 200);
    assert.ok(rb.body.interval_days >= 3 * Math.max(1, rb.body.previous_interval) || rb.body.interval_days === 120);
    assert.notEqual(rb.body.due, b.due);
    const ok = await app.as('demo.learner').post('/api/m/shelf/review', { kind: b.kind, ref: b.ref, result: 'ok' });
    assert.equal(ok.body.interval_days, Math.min(120, rb.body.interval_days * 2));
    assert.ok(ok.body.streak.today);
    const after = (await app.as('demo.learner').get('/api/m/shelf/today')).body;
    assert.deepEqual(after.items.map((i) => i.ref), before.items.map((i) => i.ref), 'same list for the day');
    assert.ok(after.items.find((i) => i.ref === a.ref).done_today);
    assert.equal(after.done, before.done + 2);
    const bad = await app.as('demo.learner').post('/api/m/shelf/review', { kind: 'lesson', ref: 'not-on-shelf', result: 'ok' });
    assert.equal(bad.status, 404);
    assert.equal((await app.as('demo.learner').post('/api/m/shelf/review', { kind: a.kind, ref: a.ref, result: 'meh' })).status, 400);
    assert.equal((await app.as('demo.guardian').post('/api/m/shelf/review', { kind: a.kind, ref: a.ref, result: 'ok' })).status, 403);
  });

  await t.test('guardian sees ward summary and not other children', async () => {
    const r = await app.as('demo.guardian').get('/api/m/shelf/family');
    assert.equal(r.status, 200);
    const w = r.body.wards.find((x) => x.person.id === L.id);
    assert.ok(w, 'ward listed');
    for (const x of r.body.wards) assert.equal(demo.persons.find((p) => p.id === x.person.id).guardian_id, demo.demoGuardian.id);
    assert.ok(w.summary.en.length > 20 && /[ഀ-ൿ]/.test(w.summary.ml));
    for (const k of ['lessons', 'revised', 'books', 'tests', 'avg_pct']) assert.ok(k in w.month);
    assert.ok(w.month.revised >= 2, 'revisions made today count this month');
    assert.equal((await app.as('demo.guardian').get('/api/m/shelf/person/' + L.id)).status, 200);
    const other = demo.children.find((c) => c.guardian_id !== demo.demoGuardian.id);
    assert.equal((await app.as('demo.guardian').get('/api/m/shelf/person/' + other.id)).status, 403);
    assert.equal((await app.as('demo.learner').get('/api/m/shelf/person/' + Y.id)).status, 403);
  });

  await t.test('staff: same-agency facilitator reads; other agency and donor refused', async () => {
    const f = await app.as('demo.facilitator').get('/api/m/shelf/person/' + L.id);
    assert.equal(f.status, 200);
    assert.equal(f.body.self, false);
    assert.ok(f.body.streak.days >= 1);
    assert.equal((await app.as('demo.teacher.uoc').get('/api/m/shelf/person/' + L.id)).status, 403);
    assert.equal((await app.as('demo.syf.admin').get('/api/m/shelf/person/' + L.id)).status, 403);
    assert.equal((await app.as('demo.donor').get('/api/m/shelf/person/' + L.id)).status, 403);
    assert.equal((await app.as('demo.donor').get('/api/m/shelf/me')).status, 403);
    assert.equal((await app.as('demo.donor').get('/api/m/shelf/classes')).status, 403);
  });

  await t.test('staff class view: who revised this week', async () => {
    const progs = (await app.as('demo.facilitator').get('/api/m/shelf/classes')).body;
    const enrolled = demo.store.all('SELECT programme_id FROM enrolments WHERE person_id=? AND deleted=0', L.id).map((r) => r.programme_id);
    const p = progs.find((x) => enrolled.includes(x.id));
    assert.ok(p, 'facilitator has the learner\'s programme');
    const c = await app.as('demo.facilitator').get('/api/m/shelf/class/' + p.id);
    assert.equal(c.status, 200);
    const me = c.body.learners.find((x) => x.id === L.id);
    assert.ok(me && me.revised_week > 0);
    for (const x of c.body.learners) assert.deepEqual(Object.keys(x).sort(), ['days_week', 'gender', 'id', 'kind', 'name', 'revised_week', 'school_class', 'streak']);
    const other = demo.programmes.find((x) => x.agency_id !== demo.agencyByKey.cif.id);
    assert.equal((await app.as('demo.facilitator').get('/api/m/shelf/class/' + other.id)).status, 403);
  });

  await t.test('export: only self, guardian or steward', async () => {
    const self = await app.as('demo.learner').get('/api/m/shelf/export/' + L.id);
    assert.equal(self.status, 200);
    assert.equal(self.body.format, 'learning-shelf/v1');
    assert.ok(self.body.folders.length && Array.isArray(self.body.revision));
    assert.equal((await app.as('demo.guardian').get('/api/m/shelf/export/' + L.id)).status, 200);
    assert.equal((await app.as('demo.steward').get('/api/m/shelf/export/' + L.id)).status, 200);
    assert.equal((await app.as('demo.facilitator').get('/api/m/shelf/export/' + L.id)).status, 403, 'staff can read but not take home');
    assert.equal((await app.as('demo.learner').get('/api/m/shelf/export/' + Y.id)).status, 403);
    assert.equal((await app.as('demo.donor').get('/api/m/shelf/export/' + L.id)).status, 403);
  });

  await t.test('consent revoked → facilitator loses the shelf; re-grant restores', async () => {
    const A = demo.agencyByKey;
    const consents = (await app.as('demo.guardian').get('/api/core/persons/' + L.id)).body.consents;
    const c = consents.find((x) => x.agency_id === A.cif.id && x.status === 'active');
    assert.ok(c);
    assert.equal((await app.as('demo.guardian').post(`/api/core/consents/${c.id}/revoke`)).status, 200);
    assert.equal((await app.as('demo.facilitator').get('/api/m/shelf/person/' + L.id)).status, 403);
    const progs = (await app.as('demo.facilitator').get('/api/m/shelf/classes')).body;
    const enrolled = demo.store.all('SELECT programme_id FROM enrolments WHERE person_id=? AND deleted=0', L.id).map((r) => r.programme_id);
    const p = progs.find((x) => enrolled.includes(x.id));
    const cls = (await app.as('demo.facilitator').get('/api/m/shelf/class/' + p.id)).body;
    assert.ok(!cls.learners.some((x) => x.id === L.id), 'hidden from class view');
    assert.equal((await app.as('demo.guardian').post('/api/core/consents', { person_id: L.id, agency_id: A.cif.id, scopes: c.scopes })).status, 200);
    assert.equal((await app.as('demo.facilitator').get('/api/m/shelf/person/' + L.id)).status, 200);
  });

  await t.test('a person with no learning data still gets an empty shelf', async () => {
    const adult = demo.adults.find((p) => !demo.store.one('SELECT 1 x FROM enrolments WHERE person_id=? AND deleted=0', p.id));
    const r = await app.as('demo.steward').get('/api/m/shelf/person/' + adult.id);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.folders, []);
    assert.equal(r.body.revise.items.length, 0);
  });
});
