'use strict';
// AADI — Centre Operations module.
// Multi-centre hierarchy across hamlets and agencies, a centre setup wizard that replicates
// the model AADI Smart Learning Centre, asset inventory + repair tickets, hub health,
// staff duty roster, expenses vs budget, sliding-scale fees (never blocking learning) and
// a combined per-hamlet timetable of every agency's programmes.

const STAFF_ROLES = ['agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'];
const ASSET_KINDS = {
  mini_pc: { en: 'Mini-PC hub', ml: 'മിനി-പിസി ഹബ്', icon: '🖥️', value: 28000 },
  router: { en: 'Wi-Fi router / mesh', ml: 'വൈ-ഫൈ റൂട്ടർ', icon: '📶', value: 3500 },
  solar: { en: 'Solar panel kit', ml: 'സോളാർ കിറ്റ്', icon: '☀️', value: 42000 },
  ups: { en: 'UPS / battery bank', ml: 'യുപിഎസ് / ബാറ്ററി', icon: '🔋', value: 14000 },
  tablet: { en: 'Learner tablet', ml: 'ടാബ്‌ലെറ്റ്', icon: '📱', value: 11000 },
  phone: { en: 'Facilitator phone', ml: 'ഫോൺ', icon: '☎️', value: 9000 },
  tv: { en: 'Smart TV / display', ml: 'ടിവി', icon: '📺', value: 24000 },
  projector: { en: 'Pico projector', ml: 'പ്രൊജക്ടർ', icon: '📽️', value: 16000 },
  speaker: { en: 'Speaker + mic', ml: 'സ്പീക്കർ', icon: '🔊', value: 4000 },
};
const CONDITIONS = ['good', 'fair', 'needs_repair', 'broken', 'retired'];
const TICKET_FLOW = { open: ['in_progress', 'resolved'], in_progress: ['resolved', 'open'], resolved: ['open'] };
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const EXPENSE_CATS = ['rent', 'power', 'data', 'maintenance', 'materials', 'travel', 'honorarium', 'food', 'events', 'other'];
const FEE_PLANS = ['standard', 'sliding', 'waiver', 'sponsored'];
// Sliding scale: band chosen with the family (self-declared, no documents demanded)
const BANDS = { A: 1, B: 0.5, C: 0.25, D: 0 };
const BASE_FEE = { tuition: 200, exams: 300, language: 150, lifeskills: 100, digital: 100, literacy: 0, counselling: 0 };
const KIT = [
  { key: 'mini_pc', qty: 1, en: 'Mini-PC hub (offline learning server)', ml: 'മിനി-പിസി ഹബ്' },
  { key: 'router', qty: 1, en: 'Wi-Fi router', ml: 'വൈ-ഫൈ റൂട്ടർ' },
  { key: 'solar', qty: 1, en: 'Solar panels + charge controller', ml: 'സോളാർ പാനലുകൾ' },
  { key: 'ups', qty: 1, en: 'UPS / battery bank', ml: 'യുപിഎസ്' },
  { key: 'tablet', qty: 8, en: 'Learner tablets', ml: 'ടാബ്‌ലെറ്റുകൾ' },
  { key: 'tv', qty: 1, en: 'Smart TV for group sessions', ml: 'ടിവി' },
  { key: 'phone', qty: 1, en: 'Facilitator phone', ml: 'ഫോൺ' },
  { key: 'speaker', qty: 1, en: 'Speaker + mic', ml: 'സ്പീക്കർ' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TRACK_MODULE = { tuition: 'learning', literacy: 'learning', exams: 'exams', language: 'language', lifeskills: 'lifeskills', digital: 'lifeskills', counselling: 'counselling' };

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError } = ctx;
  const now = () => new Date().toISOString();
  const S = (v, max = 500) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const month = (d = new Date()) => new Date(d).toISOString().slice(0, 7);
  const OPS = requires('ops');

  // ---------------- scope ----------------
  function agencyHamlets(agencyId) {
    return sql('SELECT DISTINCT hamlet_id FROM agency_presence WHERE agency_id=? AND deleted=0 AND status=\'active\'', agencyId).map((r) => r.hamlet_id);
  }
  // Which hamlets can this user operate in, and for which agency?
  function scope(u) {
    if (u.role === 'platform_admin') return { all: true, hamlets: null, agency_id: null };
    let hs = u.agency_id ? agencyHamlets(u.agency_id) : [];
    if (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length) hs = hs.filter((h) => u.hamlet_ids.includes(h));
    return { all: false, hamlets: new Set(hs), agency_id: u.agency_id };
  }
  const inScope = (sc, hamletId) => sc.all || sc.hamlets.has(hamletId);
  const canManage = (u, row) => {
    const sc = scope(u);
    if (sc.all) return true;
    return row && row.agency_id === u.agency_id && sc.hamlets.has(row.hamlet_id);
  };
  const isAdmin = (u) => ['platform_admin', 'agency_admin'].includes(u.role);
  const agMap = () => Object.fromEntries(brain.agencies.list().map((a) => [a.id, a]));
  const hamMap = () => Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));

  // Unified centre list: core registry + operations profiles (for wizard centres not yet in core)
  function allCentres() {
    const profiles = data.find('operations_profiles', {});
    const byCentre = Object.fromEntries(profiles.filter((p) => p.centre_id).map((p) => [p.centre_id, p]));
    const out = brain.centres.list().map((c) => ({ ...c, core: true, profile: byCentre[c.id] || null }));
    for (const p of profiles) if (!p.core_registered && !out.some((c) => c.id === p.centre_id)) {
      out.push({ id: p.centre_id || p.id, hamlet_id: p.hamlet_id, agency_id: p.agency_id, name: p.name, kind: p.kind, hub_status: 'setting_up', devices: 0, last_sync: null, core: false, profile: p });
    }
    return out;
  }
  function getCentre(id) { return allCentres().find((c) => c.id === id) || null; }
  function mustCentre(u, id, write = false) {
    const c = getCentre(id);
    if (!c) throw httpError(404, 'Centre not found');
    const sc = scope(u);
    if (write ? !canManage(u, c) : !(sc.all || (c.agency_id === u.agency_id && sc.hamlets.has(c.hamlet_id)))) throw httpError(403, 'This centre belongs to another agency or hamlet.');
    return c;
  }
  const myCentres = (u) => { const sc = scope(u); return allCentres().filter((c) => sc.all || (c.agency_id === u.agency_id && sc.hamlets.has(c.hamlet_id))); };
  const inList = (ids) => ids.map(() => '?').join(',') || "''";

  // ================= hierarchy =================
  router.get('/hierarchy', OPS, (req, res) => {
    const u = req.user;
    const sc = scope(u);
    const ag = agMap();
    const centres = allCentres();
    const mine = new Set(myCentres(u).map((c) => c.id));
    const assetStats = Object.fromEntries(sql(`SELECT centre_id, COUNT(*) n, SUM(condition IN ('needs_repair','broken')) bad FROM operations_assets WHERE deleted=0 AND condition<>'retired' GROUP BY centre_id`).map((r) => [r.centre_id, r]));
    const ticketStats = Object.fromEntries(sql(`SELECT centre_id, COUNT(*) n FROM operations_tickets WHERE deleted=0 AND status<>'resolved' GROUP BY centre_id`).map((r) => [r.centre_id, r.n]));
    const progCount = Object.fromEntries(sql('SELECT centre_id, COUNT(*) n FROM programmes WHERE deleted=0 AND status=\'active\' GROUP BY centre_id').map((r) => [r.centre_id, r.n]));
    const health = latestHealth();
    const tree = { name: 'Kerala', name_ml: 'കേരളം', level: 'state', districts: [] };
    const dmap = {};
    for (const h of brain.hamlets.list()) {
      if (!inScope(sc, h.id)) continue;
      const d = dmap[h.district] || (dmap[h.district] = { name: h.district, level: 'district', panchayats: {} });
      const p = d.panchayats[h.panchayat] || (d.panchayats[h.panchayat] = { name: h.panchayat, level: 'panchayat', hamlets: [] });
      const cs = centres.filter((c) => c.hamlet_id === h.id).map((c) => {
        const own = mine.has(c.id);
        return {
          id: c.id, name: c.name, kind: c.kind, agency_id: c.agency_id, agency_name: ag[c.agency_id]?.name, agency_colour: ag[c.agency_id]?.colour,
          core: c.core, hub_status: c.hub_status, mine: own, programmes: progCount[c.id] || 0,
          ...(own ? { assets: assetStats[c.id]?.n || 0, assets_attention: assetStats[c.id]?.bad || 0, open_tickets: ticketStats[c.id] || 0, health: health[c.id] || null, opened_on: c.profile?.opened_on || null } : {}),
        };
      });
      p.hamlets.push({ id: h.id, name: h.name, name_ml: h.name_ml, community: h.community, connectivity: h.connectivity, power: h.power, level: 'hamlet', centres: cs });
    }
    tree.districts = Object.values(dmap).map((d) => ({ ...d, panchayats: Object.values(d.panchayats) })).sort((a, b) => a.name.localeCompare(b.name));
    const flat = tree.districts.flatMap((d) => d.panchayats.flatMap((p) => p.hamlets.flatMap((h) => h.centres)));
    res.json({
      tree,
      totals: { districts: tree.districts.length, hamlets: tree.districts.reduce((s, d) => s + d.panchayats.reduce((x, p) => x + p.hamlets.length, 0), 0), centres: flat.length, mine: flat.filter((c) => c.mine).length, open_tickets: flat.reduce((s, c) => s + (c.open_tickets || 0), 0), assets: flat.reduce((s, c) => s + (c.assets || 0), 0) },
      can_setup: ['platform_admin', 'agency_admin', 'coordinator'].includes(u.role),
    });
  });

  router.get('/centres/:id', OPS, (req, res) => {
    const c = mustCentre(req.user, req.params.id);
    const ag = agMap(), hm = hamMap();
    const progs = brain.programmes.list({ centre_id: c.id }).map((p) => ({ id: p.id, title: p.title, title_ml: p.title_ml, track: p.track, schedule: p.schedule, capacity: p.capacity, enrolled: sqlOne('SELECT COUNT(*) n FROM enrolments WHERE programme_id=? AND deleted=0 AND status=\'active\'', p.id).n }));
    const staff = staffFor(req.user).filter((s) => s.agency_id === c.agency_id && (!s.hamlet_ids || !s.hamlet_ids.length || s.hamlet_ids.includes(c.hamlet_id)));
    res.json({ ...c, agency_name: ag[c.agency_id]?.name, hamlet: hm[c.hamlet_id], programmes: progs, staff, health: latestHealth()[c.id] || null, kit: c.profile?.kit || null });
  });

  // ================= setup wizard =================
  router.get('/setup/options', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user;
    const sc = scope(u);
    const hamlets = brain.hamlets.list().filter((h) => u.role === 'platform_admin' || u.role === 'agency_admin' || sc.hamlets.has(h.id));
    const agencies = u.role === 'platform_admin' ? brain.agencies.list() : brain.agencies.list().filter((a) => a.id === u.agency_id);
    const facilitators = brain.users.byRole('facilitator', u.role === 'platform_admin' ? {} : { agency_id: u.agency_id })
      .map((f) => ({ id: f.id, name: f.display_name, agency_id: f.agency_id, hamlet_ids: f.hamlet_ids, trained: !!f.safeguarding_trained, active: !!f.active }));
    const model = allCentres().find((c) => c.kind === 'hub' && c.agency_id === (agencies.find((a) => a.steward) || {}).id);
    res.json({
      hamlets: hamlets.map((h) => ({ id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, connectivity: h.connectivity, power: h.power })),
      agencies: agencies.map((a) => ({ id: a.id, name: a.name })), facilitators, kit: KIT, asset_kinds: ASSET_KINDS,
      tracks: Object.keys(TRACK_MODULE), slots: ['Mon 16:00', 'Tue 16:00', 'Wed 16:00', 'Thu 16:00', 'Fri 16:00', 'Sat 10:00', 'Sat 14:00', 'Sun 10:00'],
      model: model ? { id: model.id, name: model.name } : null,
      can_register_core: brain.policy.can(u, 'agency.manage'),
    });
  });

  // body: { hamlet_id, agency_id?, name, kind, centre_id? (core id if UI registered it), kit:[{key,qty,have}], facilitator_ids:[], programmes:[{track,title,title_ml,schedule:[],capacity}], power, connectivity }
  router.post('/setup', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user, b = req.body || {};
    const h = brain.hamlets.get(S(b.hamlet_id, 64));
    if (!h) throw httpError(400, 'Choose a hamlet');
    const agency_id = u.role === 'platform_admin' ? S(b.agency_id, 64) || u.agency_id : u.agency_id;
    if (!brain.agencies.get(agency_id)) throw httpError(400, 'Choose an agency');
    const sc = scope(u);
    if (u.role === 'coordinator' && !sc.hamlets.has(h.id)) throw httpError(403, 'Coordinators can set up centres only in their own hamlets.');
    const name = S(b.name, 160) || `${brain.agencies.get(agency_id).name} Learning Centre — ${h.name}`;
    let coreCentre = null;
    if (b.centre_id) {
      coreCentre = brain.centres.get(S(b.centre_id, 64));
      if (!coreCentre) throw httpError(400, 'Registered centre not found');
      if (coreCentre.agency_id !== agency_id || coreCentre.hamlet_id !== h.id) throw httpError(403, 'That centre belongs to another agency or hamlet.');
    }
    const facs = (Array.isArray(b.facilitator_ids) ? b.facilitator_ids : []).map((id) => brain.users.get(String(id))).filter((f) => f && f.agency_id === agency_id && STAFF_ROLES.includes(f.role));
    const kit = (Array.isArray(b.kit) && b.kit.length ? b.kit : KIT.map((x) => ({ key: x.key, qty: x.qty, have: false }))).filter((x) => ASSET_KINDS[x.key]).map((x) => ({ key: x.key, qty: Math.max(0, Math.min(60, N(x.qty))), have: !!x.have }));
    // Register the real core centre when the user may (agency/platform admins); coordinators
    // get an operations profile that an admin can register later.
    const canRegister = brain.policy.can(u, 'agency.manage');
    const out = tx(() => {
      if (!coreCentre && canRegister) {
        const hub = (S(b.kind, 20) || 'hub') === 'hub';
        coreCentre = brain.centres.register({ hamlet_id: h.id, agency_id, name, kind: hub ? 'hub' : 'centre', hub_status: hub ? (h.connectivity === 'none' ? 'courier' : 'setting_up') : 'n/a', devices: kit.filter((x) => x.have).reduce((s2, x) => s2 + x.qty, 0), last_sync: null }, u);
      }
      const profile = data.put('operations_profiles', {
        hamlet_id: h.id, agency_id, name, kind: S(b.kind, 20) || 'hub', model: 'aadi-smart-centre-v1',
        core_registered: coreCentre ? 1 : 0, kit, facilitator_ids: facs.map((f) => f.id), opened_on: now().slice(0, 10), status: 'setting_up',
        power: S(b.power, 20) || h.power, connectivity: S(b.connectivity, 20) || h.connectivity, storage_total_gb: 512, notes: S(b.notes, 1000), created_by: u.id,
      }, u);
      const centre_id = coreCentre ? coreCentre.id : profile.id;
      data.put('operations_profiles', { id: profile.id, centre_id }, u);
      // assets for kit items already on hand
      const assets = [];
      for (const item of kit) {
        if (!item.have) continue;
        for (let i = 0; i < item.qty; i++) assets.push(data.put('operations_assets', { centre_id, hamlet_id: h.id, agency_id, kind: item.key, label: `${ASSET_KINDS[item.key].en} ${item.qty > 1 ? '#' + (i + 1) : ''}`.trim(), condition: 'good', assigned_to: item.key === 'phone' && facs[0] ? facs[0].id : 'centre', assigned_name: item.key === 'phone' && facs[0] ? facs[0].display_name : 'Centre', acquired_on: now().slice(0, 10), value: ASSET_KINDS[item.key].value, funded_by: S(b.funded_by, 120) || null, last_checked: now() }, u));
      }
      // first programmes through the brain (registry-safe)
      const progs = [];
      for (const p of (Array.isArray(b.programmes) ? b.programmes : []).slice(0, 12)) {
        const track = S(p.track, 30);
        if (!TRACK_MODULE[track]) continue;
        const schedule = (Array.isArray(p.schedule) ? p.schedule : [p.schedule]).map((x) => S(x, 20)).filter((x) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2}$/.test(x)).slice(0, 7);
        progs.push(brain.programmes.create({ agency_id, hamlet_id: h.id, centre_id: coreCentre ? coreCentre.id : null, module: TRACK_MODULE[track], track, title: S(p.title, 120) || track, title_ml: S(p.title_ml, 160) || null, schedule, capacity: Math.max(1, Math.min(200, N(p.capacity) || 25)) }, u));
      }
      // duty for assigned facilitators on programme slots
      for (const f of facs) for (const pr of progs) for (const slot of pr.schedule || []) {
        const [wd, tm] = slot.split(' ');
        data.put('operations_duty', { user_id: f.id, user_name: f.display_name, role: f.role, agency_id, centre_id, hamlet_id: h.id, weekday: wd, slot: tm, duty: pr.title, note: 'from setup wizard' }, u);
      }
      return { profile: data.get('operations_profiles', profile.id), centre_id, assets: assets.length, programmes: progs };
    });
    emit('operations.centre_setup', { centre_id: out.centre_id, hamlet_id: h.id, agency_id, programmes: out.programmes.length }, u, h.id);
    brain.audit(u, 'centre_setup', out.centre_id, { hamlet_id: h.id, agency_id });
    const missing = kit.filter((x) => !x.have).map((x) => ({ key: x.key, qty: x.qty }));
    res.json({ ...out, missing_kit: missing, core_centre_id: coreCentre ? coreCentre.id : null, note: coreCentre ? null : 'Centre saved in Operations. An agency admin can register it in the core centre registry.' });
  });

  router.post('/setup/:profileId/register', requires('agency.manage'), (req, res) => {
    const u = req.user;
    const p = data.get('operations_profiles', req.params.profileId);
    if (!p) throw httpError(404, 'Profile not found');
    if (p.core_registered) throw httpError(400, 'Already registered');
    if (u.role !== 'platform_admin' && p.agency_id !== u.agency_id) throw httpError(403, 'Not your agency');
    const out = tx(() => {
      const c = brain.centres.register({ hamlet_id: p.hamlet_id, agency_id: p.agency_id, name: p.name, kind: p.kind, hub_status: p.kind === 'hub' ? 'setting_up' : 'n/a', devices: 0, last_sync: null }, u);
      const old = p.centre_id;
      data.put('operations_profiles', { id: p.id, centre_id: c.id, core_registered: 1 }, u);
      for (const t of ['operations_assets', 'operations_duty', 'operations_tickets', 'operations_expenses', 'operations_budgets']) for (const r of data.find(t, { centre_id: old })) data.put(t, { id: r.id, centre_id: c.id }, u);
      return c;
    });
    res.json(out);
  });

  // ================= assets =================
  router.get('/assets', OPS, (req, res) => {
    const u = req.user;
    const centres = myCentres(u);
    const ids = req.query.centre_id ? [mustCentre(u, req.query.centre_id).id] : centres.map((c) => c.id);
    if (!ids.length) return res.json({ assets: [], kinds: ASSET_KINDS, conditions: CONDITIONS, summary: {} });
    let rows = sql(`SELECT * FROM operations_assets WHERE deleted=0 AND centre_id IN (${inList(ids)}) ORDER BY centre_id, kind, label`, ...ids);
    if (req.query.condition) rows = rows.filter((r) => r.condition === req.query.condition);
    if (req.query.kind) rows = rows.filter((r) => r.kind === req.query.kind);
    const cname = Object.fromEntries(centres.map((c) => [c.id, c.name]));
    const open = Object.fromEntries(sql(`SELECT asset_id, COUNT(*) n FROM operations_tickets WHERE deleted=0 AND status<>'resolved' AND centre_id IN (${inList(ids)}) GROUP BY asset_id`, ...ids).map((r) => [r.asset_id, r.n]));
    const summary = {};
    for (const r of rows) { const s = summary[r.kind] || (summary[r.kind] = { total: 0, good: 0, attention: 0 }); s.total++; if (['good', 'fair'].includes(r.condition)) s.good++; if (['needs_repair', 'broken'].includes(r.condition)) s.attention++; }
    res.json({ assets: rows.map((r) => ({ ...r, centre_name: cname[r.centre_id], open_tickets: open[r.id] || 0, can_edit: canManage(u, r) })), kinds: ASSET_KINDS, conditions: CONDITIONS, summary });
  });

  router.post('/assets', OPS, (req, res) => {
    const u = req.user, b = req.body || {};
    const existing = b.id ? data.get('operations_assets', S(b.id, 64)) : null;
    if (b.id && !existing) throw httpError(404, 'Asset not found');
    const c = mustCentre(u, existing ? existing.centre_id : S(b.centre_id, 64), true);
    if (existing && !canManage(u, existing)) throw httpError(403, 'Not your agency\'s asset');
    const kind = existing ? existing.kind : S(b.kind, 30);
    if (!ASSET_KINDS[kind]) throw httpError(400, 'Unknown asset type');
    const condition = b.condition ? S(b.condition, 20) : (existing ? existing.condition : 'good');
    if (!CONDITIONS.includes(condition)) throw httpError(400, 'Unknown condition');
    let assigned_name = existing ? existing.assigned_name : 'Centre';
    let assigned_to = existing ? existing.assigned_to : 'centre';
    if (b.assigned_to !== undefined) {
      assigned_to = S(b.assigned_to, 64) || 'centre';
      if (assigned_to === 'centre') assigned_name = 'Centre';
      else { const su = brain.users.get(assigned_to); if (!su || su.agency_id !== c.agency_id) throw httpError(400, 'Assign to centre or a staff member of this agency'); assigned_name = su.display_name; }
    }
    const row = data.put('operations_assets', {
      id: existing ? existing.id : undefined, centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, kind,
      label: S(b.label, 120) || (existing ? existing.label : ASSET_KINDS[kind].en), serial: b.serial !== undefined ? S(b.serial, 80) : existing?.serial,
      condition, assigned_to, assigned_name, acquired_on: S(b.acquired_on, 10) || existing?.acquired_on || now().slice(0, 10),
      funded_by: b.funded_by !== undefined ? S(b.funded_by, 120) : existing?.funded_by, value: b.value !== undefined ? N(b.value) : (existing?.value ?? ASSET_KINDS[kind].value),
      notes: b.notes !== undefined ? S(b.notes, 1000) : existing?.notes, last_checked: now(),
    }, u);
    res.json(row);
  });

  router.delete('/assets/:id', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const a = data.get('operations_assets', req.params.id);
    if (!a) throw httpError(404, 'Asset not found');
    if (!canManage(req.user, a)) throw httpError(403, 'Not your agency\'s asset');
    data.put('operations_assets', { id: a.id, condition: 'retired', notes: (a.notes ? a.notes + ' · ' : '') + 'Retired ' + now().slice(0, 10) }, req.user);
    res.json({ ok: true });
  });

  // ================= maintenance tickets =================
  router.get('/tickets', OPS, (req, res) => {
    const u = req.user;
    const centres = myCentres(u);
    const ids = req.query.centre_id ? [mustCentre(u, req.query.centre_id).id] : centres.map((c) => c.id);
    if (!ids.length) return res.json([]);
    let rows = sql(`SELECT * FROM operations_tickets WHERE deleted=0 AND centre_id IN (${inList(ids)}) ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, opened_at DESC LIMIT 400`, ...ids);
    if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
    const cname = Object.fromEntries(centres.map((c) => [c.id, c.name]));
    const assets = Object.fromEntries(sql(`SELECT id, label, kind FROM operations_assets WHERE centre_id IN (${inList(ids)})`, ...ids).map((a) => [a.id, a]));
    res.json(rows.map((r) => ({ ...r, centre_name: cname[r.centre_id], asset_label: assets[r.asset_id]?.label, asset_kind: assets[r.asset_id]?.kind, can_edit: canManage(u, r), next: TICKET_FLOW[r.status] || [] })));
  });

  router.post('/tickets', OPS, (req, res) => {
    const u = req.user, b = req.body || {};
    let asset = null;
    if (b.asset_id) { asset = data.get('operations_assets', S(b.asset_id, 64)); if (!asset) throw httpError(404, 'Asset not found'); }
    const c = mustCentre(u, asset ? asset.centre_id : S(b.centre_id, 64), true);
    const title = S(b.title, 160);
    if (!title) throw httpError(400, 'Describe the problem');
    const priority = PRIORITIES.includes(b.priority) ? b.priority : 'normal';
    const t = tx(() => {
      const row = data.put('operations_tickets', { asset_id: asset ? asset.id : null, centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, title, detail: S(b.detail, 2000), priority, status: 'open', opened_by_name: u.display_name, opened_at: now(), history: [{ at: now(), by: u.display_name, status: 'open', note: 'Reported' }] }, u);
      if (asset && ['good', 'fair'].includes(asset.condition)) data.put('operations_assets', { id: asset.id, condition: 'needs_repair' }, u);
      return row;
    });
    emit('operations.ticket_opened', { ticket_id: t.id, centre_id: c.id, priority }, u, c.hamlet_id);
    res.json(t);
  });

  router.post('/tickets/:id/status', OPS, (req, res) => {
    const u = req.user, b = req.body || {};
    const t = data.get('operations_tickets', req.params.id);
    if (!t) throw httpError(404, 'Ticket not found');
    if (!canManage(u, t)) throw httpError(403, 'Not your agency\'s ticket');
    const to = S(b.status, 20);
    if (!(TICKET_FLOW[t.status] || []).includes(to)) throw httpError(400, `A ticket that is ${t.status} cannot move to ${to}.`);
    const history = [...(Array.isArray(t.history) ? t.history : []), { at: now(), by: u.display_name, status: to, note: S(b.note, 500) }];
    const out = tx(() => {
      const row = data.put('operations_tickets', { id: t.id, status: to, history, assignee: b.assignee !== undefined ? S(b.assignee, 120) : t.assignee, resolved_at: to === 'resolved' ? now() : null, resolution: to === 'resolved' ? S(b.note, 500) : t.resolution }, u);
      if (to === 'resolved' && t.asset_id) {
        const a = data.get('operations_assets', t.asset_id);
        if (a && ['needs_repair', 'broken'].includes(a.condition)) data.put('operations_assets', { id: a.id, condition: b.asset_condition && CONDITIONS.includes(b.asset_condition) ? b.asset_condition : 'good', last_checked: now() }, u);
      }
      return row;
    });
    if (to === 'resolved') emit('operations.ticket_resolved', { ticket_id: t.id, centre_id: t.centre_id }, u, t.hamlet_id);
    res.json(out);
  });

  // ================= hub health =================
  function latestHealth() {
    const rows = sql('SELECT h.* FROM operations_hub_health h JOIN (SELECT centre_id, MAX(at) m FROM operations_hub_health WHERE deleted=0 GROUP BY centre_id) x ON x.centre_id=h.centre_id AND x.m=h.at WHERE h.deleted=0');
    return Object.fromEntries(rows.map((r) => [r.centre_id, { ...r, status: healthStatus(r) }]));
  }
  function healthStatus(r) {
    const issues = [];
    const syncAgeH = r.last_sync ? (Date.now() - new Date(r.last_sync)) / 3600e3 : 999;
    if (syncAgeH > 72) issues.push('sync_overdue');
    if (r.battery_pct !== null && r.battery_pct < 25) issues.push('low_battery');
    if (r.storage_total_gb && r.storage_used_gb / r.storage_total_gb > 0.85) issues.push('storage_high');
    if (r.temp_c > 55) issues.push('hot');
    return { level: issues.length === 0 ? 'good' : issues.some((i) => ['sync_overdue', 'low_battery'].includes(i)) ? 'warn' : 'info', issues, sync_age_h: Math.round(syncAgeH) };
  }
  router.get('/hub-health', OPS, (req, res) => {
    const u = req.user;
    const centres = myCentres(u).filter((c) => c.kind === 'hub' || c.profile);
    const latest = latestHealth();
    const ids = centres.map((c) => c.id);
    const since = new Date(Date.now() - 14 * 86400e3).toISOString();
    const series = {};
    if (ids.length) for (const r of sql(`SELECT centre_id, day, battery_pct, storage_used_gb, pending_events, signal_bars FROM operations_hub_health WHERE deleted=0 AND at>? AND centre_id IN (${inList(ids)}) ORDER BY at`, since, ...ids)) (series[r.centre_id] = series[r.centre_id] || []).push(r);
    const hm = hamMap();
    res.json({
      node: { id: brain.nodeId, role: brain.nodeRole },
      hubs: centres.map((c) => ({ id: c.id, name: c.name, hamlet: hm[c.hamlet_id]?.name, hamlet_ml: hm[c.hamlet_id]?.name_ml, hub_status: c.hub_status, connectivity: hm[c.hamlet_id]?.connectivity, power: hm[c.hamlet_id]?.power, latest: latest[c.id] || null, series: series[c.id] || [] })),
    });
  });
  // a hub (or facilitator) reports a reading — e.g. from the hub's own agent
  router.post('/hub-health', OPS, (req, res) => {
    const u = req.user, b = req.body || {};
    const c = mustCentre(u, S(b.centre_id, 64), true);
    const row = data.put('operations_hub_health', { centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, at: now(), day: now().slice(0, 10), power_source: S(b.power_source, 20) || 'grid', battery_pct: b.battery_pct == null ? null : Math.max(0, Math.min(100, N(b.battery_pct))), connectivity: S(b.connectivity, 20) || 'none', signal_bars: Math.max(0, Math.min(5, N(b.signal_bars))), storage_total_gb: N(b.storage_total_gb) || 512, storage_used_gb: N(b.storage_used_gb), last_sync: S(b.last_sync, 40) || null, pending_events: N(b.pending_events), uptime_h: N(b.uptime_h), temp_c: N(b.temp_c), source: 'manual' }, u);
    res.json(row);
  });

  // ================= staff & duty =================
  function staffFor(u) {
    const sc = scope(u);
    const out = [];
    for (const role of STAFF_ROLES) {
      for (const s of brain.users.byRole(role, sc.all ? {} : { agency_id: u.agency_id })) {
        if (!sc.all && Array.isArray(s.hamlet_ids) && s.hamlet_ids.length && !s.hamlet_ids.some((h) => sc.hamlets.has(h))) continue;
        out.push({ id: s.id, name: s.display_name, role: s.role, role_label: s.role_label, agency_id: s.agency_id, agency_name: s.agency_name, centre_id: s.centre_id, hamlet_ids: s.hamlet_ids, active: !!s.active, safeguarding_trained: !!s.safeguarding_trained });
      }
    }
    return out;
  }
  router.get('/staff', OPS, (req, res) => {
    const u = req.user;
    const staff = staffFor(u);
    const ids = staff.map((s) => s.id);
    const duty = ids.length ? sql(`SELECT * FROM operations_duty WHERE deleted=0 AND user_id IN (${inList(ids)}) ORDER BY weekday, slot`, ...ids) : [];
    const hm = hamMap();
    res.json({
      staff: staff.map((s) => ({ ...s, hamlets: (s.hamlet_ids || []).map((h) => hm[h]?.name).filter(Boolean), duties: duty.filter((d) => d.user_id === s.id).length })),
      duty: duty.map((d) => ({ ...d, hamlet_name: hm[d.hamlet_id]?.name, can_edit: canManage(u, d) })),
      days: DAYS, can_edit: ['platform_admin', 'agency_admin', 'coordinator'].includes(u.role),
    });
  });
  router.post('/duty', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user, b = req.body || {};
    const staffU = brain.users.get(S(b.user_id, 64));
    if (!staffU || !STAFF_ROLES.includes(staffU.role)) throw httpError(400, 'Choose a staff member');
    if (u.role !== 'platform_admin' && staffU.agency_id !== u.agency_id) throw httpError(403, 'You can only roster your own agency\'s staff.');
    const hamlet_id = S(b.hamlet_id, 64);
    if (!brain.hamlets.get(hamlet_id) || !inScope(scope(u), hamlet_id)) throw httpError(403, 'Choose a hamlet you coordinate');
    if (!DAYS.includes(b.weekday)) throw httpError(400, 'Choose a weekday');
    const slot = S(b.slot, 5);
    if (!/^\d{1,2}:\d{2}$/.test(slot)) throw httpError(400, 'Time like 16:00');
    res.json(data.put('operations_duty', { id: b.id || undefined, user_id: staffU.id, user_name: staffU.display_name, role: staffU.role, agency_id: staffU.agency_id, centre_id: S(b.centre_id, 64) || null, hamlet_id, weekday: b.weekday, slot, duty: S(b.duty, 160) || 'Centre duty', note: S(b.note, 300) }, u));
  });
  router.delete('/duty/:id', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const d = data.get('operations_duty', req.params.id);
    if (!d) throw httpError(404, 'Not found');
    if (!canManage(req.user, d)) throw httpError(403, 'Not your agency');
    data.del('operations_duty', d.id, req.user);
    res.json({ ok: true });
  });

  // ================= expenses & budget =================
  router.get('/expenses', OPS, (req, res) => {
    const u = req.user;
    const centres = myCentres(u);
    const ids = req.query.centre_id ? [mustCentre(u, req.query.centre_id).id] : centres.map((c) => c.id);
    const m = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : month();
    if (!ids.length) return res.json({ month: m, rows: [], byCategory: [], budget: 0, actual: 0, trend: [], centres: [] });
    const rows = sql(`SELECT * FROM operations_expenses WHERE deleted=0 AND month=? AND centre_id IN (${inList(ids)}) ORDER BY date DESC`, m, ...ids);
    const budgets = sql(`SELECT * FROM operations_budgets WHERE deleted=0 AND month=? AND centre_id IN (${inList(ids)})`, m, ...ids);
    const byCat = {};
    for (const c of EXPENSE_CATS) byCat[c] = { category: c, budget: 0, actual: 0 };
    for (const b of budgets) for (const [k, v] of Object.entries(b.lines || {})) if (byCat[k]) byCat[k].budget += N(v);
    for (const r of rows) if (byCat[r.category]) byCat[r.category].actual += N(r.amount);
    // 6-month trend
    const months = []; const d0 = new Date(); d0.setUTCDate(1);
    for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() - i, 1)); months.push(month(d)); }
    const trendRows = sql(`SELECT month, SUM(amount) s FROM operations_expenses WHERE deleted=0 AND centre_id IN (${inList(ids)}) AND month>=? GROUP BY month`, ...ids, months[0]);
    const trendBud = sql(`SELECT month, SUM(total) s FROM operations_budgets WHERE deleted=0 AND centre_id IN (${inList(ids)}) AND month>=? GROUP BY month`, ...ids, months[0]);
    const trend = months.map((mm) => ({ month: mm, actual: N(trendRows.find((r) => r.month === mm)?.s), budget: N(trendBud.find((r) => r.month === mm)?.s) }));
    const perCentre = centres.filter((c) => ids.includes(c.id)).map((c) => {
      const a = rows.filter((r) => r.centre_id === c.id).reduce((s, r) => s + N(r.amount), 0);
      const bb = budgets.filter((b) => b.centre_id === c.id).reduce((s, b) => s + N(b.total), 0);
      return { id: c.id, name: c.name, actual: a, budget: bb };
    });
    const cname = Object.fromEntries(centres.map((c) => [c.id, c.name]));
    res.json({ month: m, categories: EXPENSE_CATS, rows: rows.map((r) => ({ ...r, centre_name: cname[r.centre_id], can_edit: canManage(u, r) })), byCategory: Object.values(byCat).filter((x) => x.budget || x.actual), budget: perCentre.reduce((s, c) => s + c.budget, 0), actual: perCentre.reduce((s, c) => s + c.actual, 0), trend, centres: perCentre });
  });
  router.post('/expenses', OPS, (req, res) => {
    const u = req.user, b = req.body || {};
    const c = mustCentre(u, S(b.centre_id, 64), true);
    if (!EXPENSE_CATS.includes(b.category)) throw httpError(400, 'Choose a category');
    const amount = N(b.amount);
    if (!(amount > 0) || amount > 1e7) throw httpError(400, 'Enter an amount in rupees');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : now().slice(0, 10);
    res.json(data.put('operations_expenses', { centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, month: date.slice(0, 7), date, category: b.category, amount, receipt_note: S(b.receipt_note, 500), receipt_no: S(b.receipt_no, 60), recorded_by: u.id, recorded_by_name: u.display_name }, u));
  });
  router.delete('/expenses/:id', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const e = data.get('operations_expenses', req.params.id);
    if (!e) throw httpError(404, 'Not found');
    if (!canManage(req.user, e)) throw httpError(403, 'Not your agency');
    data.del('operations_expenses', e.id, req.user);
    res.json({ ok: true });
  });
  router.post('/budgets', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user, b = req.body || {};
    const c = mustCentre(u, S(b.centre_id, 64), true);
    const m = /^\d{4}-\d{2}$/.test(b.month || '') ? b.month : month();
    const lines = {};
    for (const k of EXPENSE_CATS) if (b.lines && N(b.lines[k]) > 0) lines[k] = N(b.lines[k]);
    const ex = sqlOne('SELECT id FROM operations_budgets WHERE deleted=0 AND centre_id=? AND month=?', c.id, m);
    res.json(data.put('operations_budgets', { id: ex ? ex.id : undefined, centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, month: m, lines, total: Object.values(lines).reduce((s, v) => s + v, 0), set_by: u.id }, u));
  });

  // ================= fees (never block learning) =================
  function feeAmount(plan, band, base) {
    if (plan === 'waiver' || plan === 'sponsored') return 0;
    if (plan === 'sliding') return Math.round(base * (BANDS[band] ?? 1));
    return base;
  }
  // The learner's family pays only `monthly_fee`; sponsored rows record that a sponsor covers the base.
  router.get('/fees', OPS, (req, res) => {
    const u = req.user;
    const sc = scope(u);
    const m = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : month();
    let rows = sc.all ? data.find('operations_fees', {}) : sql('SELECT * FROM operations_fees WHERE deleted=0 AND agency_id=?', u.agency_id).filter((r) => sc.hamlets.has(r.hamlet_id));
    if (req.query.programme_id) rows = rows.filter((r) => r.programme_id === req.query.programme_id);
    // consent gate: only learners this staff member may see
    const seen = new Map();
    rows = rows.filter((r) => { if (!seen.has(r.person_id)) seen.set(r.person_id, brain.policy.canSee(u, r.person_id, 'profile').ok); return seen.get(r.person_id); });
    const pay = rows.length ? sql(`SELECT fee_id, kind, SUM(amount) s FROM operations_fee_payments WHERE deleted=0 AND month=? AND fee_id IN (${inList(rows.map((r) => r.id))}) GROUP BY fee_id, kind`, m, ...rows.map((r) => r.id)) : [];
    const progs = Object.fromEntries(brain.programmes.list().map((p) => [p.id, p]));
    const out = rows.map((r) => {
      const p = brain.persons.raw(r.person_id) || {};
      const paid = pay.filter((x) => x.fee_id === r.id && x.kind === 'family').reduce((s, x) => s + N(x.s), 0);
      const sponsored = pay.filter((x) => x.fee_id === r.id && x.kind === 'sponsor').reduce((s, x) => s + N(x.s), 0);
      const due = N(r.monthly_fee);
      return { ...r, person_name: p.name, programme_title: progs[r.programme_id]?.title, track: progs[r.programme_id]?.track, paid, sponsored, due, outstanding: Math.max(0, due - paid), status: due === 0 ? (r.plan === 'sponsored' ? 'sponsored' : 'waived') : paid >= due ? 'paid' : paid > 0 ? 'part' : 'unpaid', learning_access: 'always', can_edit: canManage(u, r) };
    }).sort((a, b) => String(a.person_name).localeCompare(String(b.person_name)));
    const sum = (f) => out.reduce((s, r) => s + f(r), 0);
    res.json({
      month: m, rows: out, plans: FEE_PLANS, bands: BANDS, base: BASE_FEE,
      summary: { learners: out.length, due: sum((r) => r.due), paid: sum((r) => r.paid), sponsored: sum((r) => r.sponsored), outstanding: sum((r) => r.outstanding), waived: out.filter((r) => r.status === 'waived').length, sponsored_learners: out.filter((r) => r.plan === 'sponsored').length },
      policy: 'Fees never block learning. Unpaid fees are shown to staff only, for a gentle conversation with the family or to find a sponsor.',
    });
  });
  router.post('/fees', requires('agency.manage', 'hamlet.coordinate', 'ops'), (req, res) => {
    const u = req.user, b = req.body || {};
    const pr = brain.programmes.get(S(b.programme_id, 64));
    if (!pr) throw httpError(404, 'Programme not found');
    if (u.role !== 'platform_admin' && pr.agency_id !== u.agency_id) throw httpError(403, 'Only the programme\'s agency sets its fees.');
    if (!brain.policy.canSee(u, S(b.person_id, 64), 'profile').ok) throw httpError(403, 'No consent to see this learner.');
    const plan = FEE_PLANS.includes(b.plan) ? b.plan : 'standard';
    const band = plan === 'sliding' ? (BANDS[b.band] !== undefined ? b.band : 'B') : null;
    const base = b.base !== undefined ? N(b.base) : (BASE_FEE[pr.track] ?? 0);
    const ex = sqlOne('SELECT id FROM operations_fees WHERE deleted=0 AND person_id=? AND programme_id=?', b.person_id, pr.id);
    const p = brain.persons.raw(b.person_id);
    res.json(data.put('operations_fees', { id: ex ? ex.id : undefined, person_id: b.person_id, hamlet_id: p.hamlet_id, programme_id: pr.id, agency_id: pr.agency_id, plan, band, monthly_fee: feeAmount(plan, band, base), reason: S(b.reason, 300), sponsor: plan === 'sponsored' ? S(b.sponsor, 120) || 'Sponsor' : null, start_month: month(), set_by_name: u.display_name, notes: S(b.notes, 500) }, u));
  });
  router.post('/fees/:id/payment', OPS, (req, res) => {
    const u = req.user, b = req.body || {};
    const f = data.get('operations_fees', req.params.id);
    if (!f) throw httpError(404, 'Not found');
    if (!canManage(u, f) || !brain.policy.canSee(u, f.person_id, 'profile').ok) throw httpError(403, 'Not permitted');
    const amount = N(b.amount);
    if (!(amount > 0) || amount > 100000) throw httpError(400, 'Enter an amount');
    res.json(data.put('operations_fee_payments', { fee_id: f.id, person_id: f.person_id, hamlet_id: f.hamlet_id, programme_id: f.programme_id, agency_id: f.agency_id, month: /^\d{4}-\d{2}$/.test(b.month || '') ? b.month : month(), amount, kind: b.kind === 'sponsor' ? 'sponsor' : 'family', mode: ['cash', 'upi', 'kind', 'bank'].includes(b.mode) ? b.mode : 'cash', received_by_name: u.display_name, at: now() }, u));
  });
  // Learners/guardians: what do *we* owe? Always paired with "learning continues regardless".
  router.get('/my-fees', authed, (req, res) => {
    const u = req.user;
    if (!['learner', 'guardian'].includes(u.role)) return res.json([]);
    const ids = brain.persons.visibleIds(u) || [];
    if (!ids.length) return res.json([]);
    const rows = sql(`SELECT * FROM operations_fees WHERE deleted=0 AND person_id IN (${inList(ids)})`, ...ids);
    const progs = Object.fromEntries(brain.programmes.list().map((p) => [p.id, p]));
    res.json(rows.map((r) => ({ id: r.id, person_id: r.person_id, programme_title: progs[r.programme_id]?.title, programme_title_ml: progs[r.programme_id]?.title_ml, plan: r.plan, monthly_fee: r.monthly_fee, sponsor: r.sponsor, learning_access: 'always' })));
  });

  // ================= combined hamlet timetable =================
  router.get('/timetable', authed, (req, res) => {
    const u = req.user;
    let hid = S(req.query.hamlet_id, 64);
    if (!hid && u.person_id) hid = brain.persons.raw(u.person_id)?.hamlet_id;
    if (!hid) { const sc = scope(u); hid = sc.hamlets && sc.hamlets.size ? [...sc.hamlets][0] : brain.hamlets.list()[0]?.id; }
    const h = brain.hamlets.get(hid);
    if (!h) throw httpError(404, 'Hamlet not found');
    const ag = agMap();
    const progs = brain.programmes.list({ hamlet_id: h.id }).filter((p) => p.status === 'active');
    const myProgs = new Set();
    if (u.person_id) {
      const ids = brain.persons.visibleIds(u) || [u.person_id];
      for (const pid of ids) for (const e of brain.enrolments.forPerson(pid)) if (e.status === 'active') myProgs.add(e.programme_id);
    }
    const cells = [];
    for (const p of progs) for (const s of (Array.isArray(p.schedule) ? p.schedule : [])) {
      const [day, time] = String(s).split(' ');
      if (!DAYS.includes(day)) continue;
      cells.push({ day, time, programme_id: p.id, title: p.title, title_ml: p.title_ml, track: p.track, agency_id: p.agency_id, agency_name: ag[p.agency_id]?.name, agency_colour: ag[p.agency_id]?.colour, mine: myProgs.has(p.id) });
    }
    const times = [...new Set(cells.map((c) => c.time))].sort();
    const clashes = [];
    for (const d of DAYS) for (const t of times) {
      const here = cells.filter((c) => c.day === d && c.time === t);
      if (new Set(here.map((c) => c.agency_id)).size > 1) clashes.push({ day: d, time: t, programmes: here.map((c) => `${c.title} (${c.agency_name})`) });
    }
    const myDuty = STAFF_ROLES.includes(u.role) ? sql('SELECT weekday, slot, duty FROM operations_duty WHERE deleted=0 AND user_id=? AND hamlet_id=?', u.id, h.id) : [];
    res.json({ hamlet: { id: h.id, name: h.name, name_ml: h.name_ml, district: h.district }, days: DAYS, times, cells, clashes, agencies: [...new Set(cells.map((c) => c.agency_id))].map((id) => ({ id, name: ag[id]?.name, colour: ag[id]?.colour })), my_duty: myDuty });
  });

  // ================= seed =================
  async function seed(demo) {
    const { R, daysAgo, users } = demo;
    const steward = users.steward;
    const hm = Object.fromEntries(demo.hamlets.map((h) => [h.id, h]));
    const centres = brain.centres.list();
    const staffByAgency = {};
    for (const role of STAFF_ROLES) for (const s of brain.users.byRole(role)) (staffByAgency[s.agency_id] = staffByAgency[s.agency_id] || []).push(s);
    const monthOf = (n) => { const d = new Date(); d.setUTCDate(1); return month(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1))); };
    const FUNDERS = ['GreenLeaf CSR (demo)', 'CIF core grant', 'ST Dept scheme (demo)', 'Community contribution', 'University grant (demo)'];
    const TICKET_TEXT = {
      tablet: ['Screen cracked', 'Battery drains in 1 hour', 'Charging port loose', 'Touch not working at the edge'],
      mini_pc: ['Hub not booting after power cut', 'Disk almost full', 'Fan noisy'],
      router: ['Wi-Fi drops every few minutes', 'Router reset needed after lightning'],
      solar: ['Panel covered with leaves — low output', 'Charge controller showing error', 'Loose cable at the panel'],
      ups: ['UPS beeping, battery weak', 'Battery swelling — replace'],
      tv: ['No HDMI signal', 'Remote missing'], phone: ['Phone not charging', 'SIM not detected'], projector: ['Lamp dim'], speaker: ['Mic crackles'],
    };
    tx(() => {
      for (const c of centres) {
        const h = hm[c.hamlet_id];
        const hub = c.kind === 'hub';
        const staff = (staffByAgency[c.agency_id] || []).filter((s) => !s.hamlet_ids || !s.hamlet_ids.length || s.hamlet_ids.includes(c.hamlet_id));
        const fac = staff.find((s) => s.role === 'facilitator');
        data.put('operations_profiles', { centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, name: c.name, kind: c.kind, model: hub ? 'aadi-smart-centre-v1' : 'partner-centre', core_registered: 1, kit: KIT.map((k) => ({ key: k.key, qty: k.qty, have: hub ? true : R.chance(0.4) })), facilitator_ids: fac ? [fac.id] : [], opened_on: daysAgo(R.int(190, 520)).slice(0, 10), status: 'active', power: h.power, connectivity: h.connectivity, storage_total_gb: hub ? 512 : 128, notes: 'DEMO centre', created_by: steward.id }, steward);
        // ~10 assets per centre
        const plan = hub ? [['mini_pc', 1], ['router', 1], ['solar', h.power === 'grid' ? 0 : 1], ['ups', 1], ['tablet', R.int(4, 6)], ['tv', 1], ['phone', 1], ['speaker', 1]] : [['tablet', R.int(4, 7)], ['phone', 1], ['router', R.chance(0.5) ? 1 : 0], ['projector', 1], ['speaker', 1], ['ups', R.chance(0.6) ? 1 : 0]];
        const assets = [];
        for (const [kind, qty] of plan) for (let i = 0; i < qty; i++) {
          const cond = R.pick(['good', 'good', 'good', 'good', 'fair', 'fair', 'needs_repair', 'broken']);
          const holder = kind === 'phone' && fac ? fac : null;
          assets.push(data.put('operations_assets', { centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, kind, label: `${ASSET_KINDS[kind].en}${qty > 1 ? ' #' + (i + 1) : ''}`, serial: kind.slice(0, 2).toUpperCase() + '-' + R.int(10000, 99999), condition: cond, assigned_to: holder ? holder.id : 'centre', assigned_name: holder ? holder.display_name : 'Centre', acquired_on: daysAgo(R.int(150, 600)).slice(0, 10), funded_by: R.pick(FUNDERS), value: ASSET_KINDS[kind].value, notes: null, last_checked: daysAgo(R.int(0, 40)) }, steward));
        }
        // tickets over 6 months
        for (const a of assets) {
          const open = ['needs_repair', 'broken'].includes(a.condition);
          const past = R.chance(0.25);
          if (!open && !past) continue;
          const opened = R.int(open ? 1 : 20, open ? 25 : 175);
          const status = open ? R.pick(['open', 'open', 'in_progress']) : 'resolved';
          const by = fac ? fac.display_name : 'Centre facilitator';
          const history = [{ at: daysAgo(opened), by, status: 'open', note: 'Reported' }];
          if (status !== 'open') history.push({ at: daysAgo(opened - 1), by: 'CIF tech desk', status: 'in_progress', note: 'Technician informed' });
          if (status === 'resolved') history.push({ at: daysAgo(Math.max(0, opened - R.int(2, 12))), by: 'CIF tech desk', status: 'resolved', note: R.pick(['Replaced part', 'Repaired locally', 'Reset and tested', 'Cleaned and re-wired']) });
          data.put('operations_tickets', { asset_id: a.id, centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, title: R.pick(TICKET_TEXT[a.kind] || ['Not working']), detail: '', priority: R.pick(['low', 'normal', 'normal', 'high', a.kind === 'mini_pc' ? 'urgent' : 'normal']), status, opened_by_name: by, opened_at: daysAgo(opened), assignee: status === 'open' ? null : 'CIF tech desk', resolved_at: status === 'resolved' ? history[history.length - 1].at : null, resolution: status === 'resolved' ? history[history.length - 1].note : null, history }, steward);
        }
        // hub health: last 14 days for hubs
        if (hub) {
          let used = R.int(120, 380);
          for (let d = 13; d >= 0; d--) {
            used += R.int(0, 4);
            const offline = h.connectivity === 'none';
            data.put('operations_hub_health', { centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, at: daysAgo(d), day: daysAgo(d).slice(0, 10), power_source: h.power === 'grid' ? R.pick(['grid', 'grid', 'ups']) : h.power === 'solar' ? R.pick(['solar', 'solar', 'battery']) : 'battery', battery_pct: h.power === 'grid' ? R.int(70, 100) : R.int(18, 95), connectivity: h.connectivity, signal_bars: offline ? 0 : h.connectivity === '2g' ? R.int(1, 2) : R.int(3, 5), storage_total_gb: 512, storage_used_gb: used, last_sync: offline ? daysAgo(d + R.int(3, 8)) : daysAgo(d), pending_events: offline ? R.int(300, 1800) : R.int(0, 40), uptime_h: R.int(4, 14), temp_c: R.int(34, 58), source: 'agent' }, steward);
          }
        }
        // budgets + expenses, 6 months
        const scale = hub ? 1 : 0.4;
        for (let mi = 5; mi >= 0; mi--) {
          const mm = monthOf(mi);
          const lines = { rent: hub ? 3000 : 1500, power: h.power === 'grid' ? 900 : 300, data: h.connectivity === 'none' ? 0 : 600, materials: Math.round(2500 * scale), honorarium: hub ? 9000 : 6000, travel: 1500, maintenance: Math.round(1500 * scale), food: Math.round(2000 * scale) };
          for (const k of Object.keys(lines)) if (!lines[k]) delete lines[k];
          data.put('operations_budgets', { centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, month: mm, lines, total: Object.values(lines).reduce((s, v) => s + v, 0), set_by: steward.id }, steward);
          for (const [cat, amt] of Object.entries(lines)) {
            if (mi === 0 && R.chance(0.4)) continue; // current month partly recorded
            const actual = Math.round(amt * (0.7 + R.rnd() * 0.55) / 10) * 10;
            const day = String(R.int(1, mi === 0 ? Math.max(1, new Date().getUTCDate()) : 27)).padStart(2, '0');
            data.put('operations_expenses', { centre_id: c.id, hamlet_id: c.hamlet_id, agency_id: c.agency_id, month: mm, date: `${mm}-${day}`, category: cat, amount: actual, receipt_note: { rent: 'Room rent — community hall', power: 'KSEB bill / solar upkeep', data: 'Mobile data recharge', materials: 'Notebooks, chart paper, crayons', honorarium: 'Facilitator honorarium', travel: 'Jeep hire to hamlet', maintenance: 'Repairs', food: 'Evening snacks for learners' }[cat], receipt_no: 'R' + R.int(1000, 9999), recorded_by: fac ? fac.id : steward.id, recorded_by_name: fac ? fac.display_name : 'Platform Steward' }, steward);
          }
        }
        // duty roster
        const progs = demo.programmes.filter((p) => p.centre_id === c.id);
        for (const s of staff.filter((x) => ['facilitator', 'coordinator'].includes(x.role)).slice(0, 2)) {
          for (const p of progs.slice(0, 3)) for (const slot of (p.schedule || []).slice(0, 2)) {
            const [wd, tm] = slot.split(' ');
            data.put('operations_duty', { user_id: s.id, user_name: s.display_name, role: s.role, agency_id: c.agency_id, centre_id: c.id, hamlet_id: c.hamlet_id, weekday: wd, slot: tm, duty: p.title, note: null }, steward);
          }
        }
      }
      // fees: tuition / exams / language programmes, sliding scale — never blocking
      const feeProgs = demo.programmes.filter((p) => ['tuition', 'exams', 'language'].includes(p.track));
      let made = 0;
      for (const p of feeProgs) {
        const learners = demo.enrolledIn(p.id).slice(0, 10);
        for (const l of learners) {
          if (made > 260) break;
          made++;
          const plan = R.pick(['standard', 'sliding', 'sliding', 'sliding', 'waiver', 'sponsored']);
          const band = plan === 'sliding' ? R.pick(['B', 'C', 'C', 'D']) : null;
          const base = BASE_FEE[p.track];
          const fee = data.put('operations_fees', { person_id: l.id, hamlet_id: l.hamlet_id, programme_id: p.id, agency_id: p.agency_id, plan, band, monthly_fee: feeAmount(plan, band, base), reason: plan === 'waiver' ? R.pick(['Single-parent household', 'Seasonal work lost', 'Family illness']) : plan === 'sliding' ? 'Self-declared income band' : null, sponsor: plan === 'sponsored' ? R.pick(['GreenLeaf CSR (demo)', 'Alumni circle (demo)', 'Kochi Rotary (demo)']) : null, start_month: monthOf(5), set_by_name: 'Platform Steward', notes: null }, steward);
          for (let mi = 5; mi >= 0; mi--) {
            const mm = monthOf(mi);
            if (plan === 'sponsored') { data.put('operations_fee_payments', { fee_id: fee.id, person_id: l.id, hamlet_id: l.hamlet_id, programme_id: p.id, agency_id: p.agency_id, month: mm, amount: base, kind: 'sponsor', mode: 'bank', received_by_name: 'CIF accounts', at: daysAgo(mi * 30 + 5) }, steward); continue; }
            if (fee.monthly_fee > 0 && R.chance(mi === 0 ? 0.45 : 0.78)) data.put('operations_fee_payments', { fee_id: fee.id, person_id: l.id, hamlet_id: l.hamlet_id, programme_id: p.id, agency_id: p.agency_id, month: mm, amount: R.chance(0.85) ? fee.monthly_fee : Math.round(fee.monthly_fee / 2), kind: 'family', mode: R.pick(['cash', 'cash', 'upi', 'kind']), received_by_name: 'Facilitator', at: daysAgo(mi * 30 + R.int(1, 20)) }, steward);
          }
        }
      }
    });
  }

  return {
    seed,
    health: () => ({
      centres_profiled: sqlOne('SELECT COUNT(*) n FROM operations_profiles WHERE deleted=0').n,
      assets: sqlOne('SELECT COUNT(*) n FROM operations_assets WHERE deleted=0').n,
      open_tickets: sqlOne('SELECT COUNT(*) n FROM operations_tickets WHERE deleted=0 AND status<>\'resolved\'').n,
    }),
  };
};
