'use strict';
// Agriculture & Forest Produce — crop advice, weekly prices, pest / wild-animal damage reports
// answered by an agriculture officer, and a record of produce sold with a fair-price check.
// Capture → review → reply runs on the Brain's form round-trip engine; this module brings the
// forms, two rules (its sub-engine), a price table, an advisory library and the screens.
const path = require('path');
const fs = require('fs');

const ITEMS = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'items.json'), 'utf8')).items;
const ADVISORY_PACK = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'advisories.json'), 'utf8'));
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.value, i]));
const CROPS = ITEMS.filter((i) => i.kind === 'crop');
const UNITS = ['kg', 'litre', 'nos'];
const DEMO_LABEL = 'DEMO PRICES — NOT REAL MARKET DATA';
const DEMO_LABEL_ML = 'ഡെമോ വില — യഥാർത്ഥ വിപണി വിലയല്ല';
const PENDING = 'PENDING REVIEW by Krishi Bhavan / KVK';
// The agency that answers pest reports from every hamlet (the Krishi Bhavan partner). A stable id keeps
// the form definition identical on the cloud and every hub; a deployment registers its real agency
// under this id or sets AGRI_REVIEW_AGENCY_ID. (Brain request: per-deployment form configuration.)
const REVIEW_AGENCY_ID = process.env.AGRI_REVIEW_AGENCY_ID || 'agy_agri_dept';
const STEWARDS = ['platform_admin'];

const ch = (value, label, label_ml) => ({ value, label, label_ml });
const itemChoices = (list) => list.map((i) => ch(i.value, i.label, i.label_ml));

const PEST_FORM = {
  key: 'agri.pest_report', title: 'Crop pest / damage report', title_ml: 'കൃഷി കീട / നാശ റിപ്പോർട്ട്',
  description: 'Report insects, disease, wilting, rot or wild-animal damage with a photo. An agriculture officer replies with advice on a later visit.',
  subject: 'person', scope: 'livelihood', review: { perm: 'agri.advise', agency_id: REVIEW_AGENCY_ID },
  fields: [
    { name: 'crop', type: 'select_one', label: 'Which crop?', label_ml: 'ഏത് വിള?', required: true, choices: [...itemChoices(CROPS), ch('mixed', 'Mixed garden', 'ഇടകലർന്ന തോട്ടം'), ch('other', 'Other', 'മറ്റുള്ളവ')] },
    { name: 'problem', type: 'select_one', label: 'What is the problem?', label_ml: 'എന്താണ് പ്രശ്നം?', required: true, choices: [
      ch('insects', '🐛 Insects / worms', '🐛 പ്രാണി / പുഴു'), ch('disease', '🟤 Disease / spots on leaves', '🟤 രോഗം / ഇലയിൽ പാടുകൾ'), ch('wilting', '🥀 Wilting / drying', '🥀 വാട്ടം / ഉണക്കം'),
      ch('rot', '🍂 Rot (stem, root or fruit)', '🍂 അഴുകൽ (തട, വേര്, കായ്)'), ch('wild_animals', '🐘 Wild animals (elephant, wild boar …)', '🐘 കാട്ടുമൃഗങ്ങൾ (ആന, കാട്ടുപന്നി …)'), ch('other', 'Other', 'മറ്റുള്ളവ')] },
    { name: 'animal', type: 'select_one', label: 'Which animal?', label_ml: 'ഏത് മൃഗം?', relevant: { field: 'problem', equals: 'wild_animals' }, choices: [
      ch('elephant', 'Elephant', 'ആന'), ch('wild_boar', 'Wild boar', 'കാട്ടുപന്നി'), ch('monkey', 'Monkey', 'കുരങ്ങ്'), ch('porcupine', 'Porcupine', 'മുള്ളൻപന്നി'), ch('other', 'Other', 'മറ്റുള്ളവ')] },
    { name: 'parts', type: 'select_multiple', label: 'Which parts are affected?', label_ml: 'ഏതൊക്കെ ഭാഗങ്ങൾ?', choices: [
      ch('leaves', 'Leaves', 'ഇല'), ch('stem', 'Stem / vine', 'തണ്ട് / വള്ളി'), ch('roots', 'Roots / base', 'വേര് / ചുവട്'), ch('flowers', 'Flowers', 'പൂവ്'), ch('fruits', 'Fruits / capsules / spikes', 'കായ് / തിരി'), ch('whole', 'Whole plant', 'ചെടി മുഴുവൻ')] },
    { name: 'area', type: 'select_one', label: 'How much of the plot?', label_ml: 'തോട്ടത്തിന്റെ എത്ര ഭാഗം?', required: true, choices: [
      ch('few', 'A few plants', 'കുറച്ച് ചെടികൾ'), ch('quarter', 'Up to a quarter', 'നാലിലൊന്ന് വരെ'), ch('half', 'About half', 'ഏകദേശം പകുതി'), ch('whole_plot', 'Whole plot', 'തോട്ടം മുഴുവൻ')] },
    { name: 'since', type: 'date', label: 'Since when?', label_ml: 'എന്ന് മുതൽ?' },
    { name: 'photo', type: 'photo', label: 'Photo of the damage (strongly suggested)', label_ml: 'നാശത്തിന്റെ ഫോട്ടോ (വളരെ പ്രധാനം)', hint: 'One clear, close photo helps the officer most.', hint_ml: 'അടുത്തുനിന്ന് എടുത്ത ഒരു വ്യക്തമായ ഫോട്ടോ ഓഫീസർക്ക് ഏറ്റവും സഹായകം.' },
    { name: 'notes', type: 'textarea', label: 'Anything else', label_ml: 'മറ്റ് വിവരങ്ങൾ' },
  ],
};

const SALE_FORM = {
  key: 'agri.produce_sale', title: 'Produce sold', title_ml: 'വിറ്റ വിളവ്',
  description: 'Record what was sold, to whom and at what price. The price is compared with the recent weekly price.',
  subject: 'person', scope: 'livelihood', review: null,
  fields: [
    { name: 'item', type: 'select_one', label: 'What was sold?', label_ml: 'എന്താണ് വിറ്റത്?', required: true, choices: itemChoices(ITEMS) },
    { name: 'quantity', type: 'decimal', label: 'How much?', label_ml: 'എത്ര?', required: true, min: 0.1, max: 100000 },
    { name: 'unit', type: 'select_one', label: 'Unit', label_ml: 'അളവ്', required: true, choices: [ch('kg', 'kg', 'കിലോ'), ch('litre', 'litre', 'ലിറ്റർ'), ch('nos', 'number (pieces)', 'എണ്ണം')] },
    { name: 'sold_to', type: 'select_one', label: 'Sold to', label_ml: 'ആർക്ക് വിറ്റു', required: true, choices: [
      ch('cooperative', 'Tribal cooperative society', 'പട്ടികവർഗ സഹകരണ സംഘം'), ch('vanasree', 'Vanasree / Forest Dept outlet', 'വനശ്രീ / വനം വകുപ്പ്'), ch('trader', 'Private trader', 'സ്വകാര്യ കച്ചവടക്കാരൻ'), ch('market', 'Market', 'ചന്ത'), ch('other', 'Other', 'മറ്റുള്ളവ')] },
    { name: 'price', type: 'decimal', label: 'Price received per unit', label_ml: 'ഒരു യൂണിറ്റിന് കിട്ടിയ വില', required: true, min: 0.01, max: 1000000, unit: '₹' },
    { name: 'date', type: 'date', label: 'Date of sale', label_ml: 'വിറ്റ തീയതി', required: true },
  ],
};

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError } = ctx;
  const S = (v, max = 2000) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const can = (u, p) => brain.policy.can(u, p);
  const today = () => new Date().toISOString().slice(0, 10);

  // ---------- forms + rules (defined at start-up, so a fresh hub has them too) ----------
  brain.forms.define(PEST_FORM, null);
  brain.forms.define(SALE_FORM, null);

  // Latest weekly price for an item and unit, on or before a date (falls back to the latest overall).
  function refPrice(item, unit, onOrBefore) {
    let r = null;
    if (onOrBefore) r = sqlOne('SELECT price, week_of, source, is_demo, market FROM agri_prices WHERE deleted=0 AND item=? AND unit=? AND week_of<=? ORDER BY week_of DESC, updated_at DESC LIMIT 1', item, unit, onOrBefore);
    if (!r) r = sqlOne('SELECT price, week_of, source, is_demo, market FROM agri_prices WHERE deleted=0 AND item=? AND unit=? ORDER BY week_of DESC, updated_at DESC LIMIT 1', item, unit);
    return r;
  }

  // Fair-price check (draft thresholds — see content/RULES.md, PENDING EXPERT REVIEW).
  function fairPrice(a) {
    const ref = refPrice(a.item, a.unit, a.date);
    if (!ref || !(Number(ref.price) > 0)) return { flags: [{ code: 'no_reference_price', level: 'info', message: 'No recent weekly price to compare with', message_ml: 'താരതമ്യം ചെയ്യാൻ ഈയിടെയുള്ള വില ഇല്ല' }], priority: 0 };
    const ratio = Math.round((Number(a.price) / Number(ref.price)) * 100) / 100;
    const demo = Number(ref.is_demo) === 1;
    const base = { ref_price: Number(ref.price), ref_week: ref.week_of, ref_demo: demo, ratio };
    const sfx = demo ? ' (compared with DEMO prices)' : '';
    const sfxMl = demo ? ' (ഡെമോ വിലയുമായി താരതമ്യം)' : '';
    if (ratio < 0.6) return { flags: [{ code: 'far_below_market', level: 'urgent', message: `Far below recent market price: ${Math.round(ratio * 100)}% of ₹${ref.price}${sfx}`, message_ml: `അടുത്തകാലത്തെ വിപണി വിലയേക്കാൾ വളരെ കുറവ്: ₹${ref.price}-ന്റെ ${Math.round(ratio * 100)}%${sfxMl}`, ...base }], priority: 1 };
    if (ratio < 0.8) return { flags: [{ code: 'below_market', level: 'warn', message: `Below recent market price: ${Math.round(ratio * 100)}% of ₹${ref.price}${sfx}`, message_ml: `അടുത്തകാലത്തെ വിപണി വിലയേക്കാൾ കുറവ്: ₹${ref.price}-ന്റെ ${Math.round(ratio * 100)}%${sfxMl}`, ...base }], priority: 0 };
    return { flags: [{ code: 'fair_price', level: 'info', message: `Fair price: ${Math.round(ratio * 100)}% of recent price ₹${ref.price}${sfx}`, message_ml: `ന്യായ വില: അടുത്തകാലത്തെ ₹${ref.price}-ന്റെ ${Math.round(ratio * 100)}%${sfxMl}`, ...base }], priority: 0 };
  }
  brain.forms.rule(SALE_FORM.key, (a) => fairPrice(a));

  brain.forms.rule(PEST_FORM.key, (a) => {
    const flags = [];
    let priority = 0;
    if (a.problem === 'wild_animals') {
      flags.push({ code: 'wildlife_compensation', level: 'info', message: 'Record for Forest Department compensation — keep photos and the date', message_ml: 'വനം വകുപ്പ് നഷ്ടപരിഹാരത്തിന് രേഖപ്പെടുത്തുക — ഫോട്ടോയും തീയതിയും സൂക്ഷിക്കുക', suggest_module: 'wildlife' });
      priority = Math.max(priority, 1);
    }
    if (a.problem === 'wilting' && a.area === 'whole_plot') { flags.push({ code: 'wilt_whole_plot', level: 'warn', message: 'Wilting across the whole plot — may spread fast', message_ml: 'തോട്ടം മുഴുവൻ വാട്ടം — വേഗം പടരാം' }); priority = Math.max(priority, 2); }
    if (a.problem === 'rot' && a.area === 'whole_plot') priority = Math.max(priority, 1);
    if (!a.photo) flags.push({ code: 'no_photo', level: 'info', message: 'No photo — add one next visit, it helps the officer', message_ml: 'ഫോട്ടോ ഇല്ല — അടുത്ത തവണ ചേർക്കുക, ഓഫീസർക്ക് സഹായകം' });
    return { flags, priority };
  });

  // ---------- helpers ----------
  const hamletMap = () => Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
  const pubSub = (s) => ({ id: s.id, form_key: s.form_key, status: s.status, priority: s.priority, flags: s.flags, answers: s.answers, captured_at: s.captured_at, hamlet: s.hamlet, hamlet_ml: s.hamlet_ml, hamlet_id: s.hamlet_id, person: s.person, reply: s.reply, reply_ml: s.reply_ml, replied_by_name: s.replied_by_name, replied_at: s.replied_at, reply_seen_at: s.reply_seen_at, outcome: s.outcome, captured_by_name: s.captured_by_name, form_title: s.form_title, form_title_ml: s.form_title_ml, has_photo: !!(s.answers && s.answers.photo) });
  const records = (user, person_id) => ({
    sales: brain.forms.list(user, { form_key: SALE_FORM.key, person_id, limit: 300 }).map(pubSub),
    pests: brain.forms.list(user, { form_key: PEST_FORM.key, person_id, limit: 100 }).map(pubSub),
  });
  const saleSummary = (sales) => {
    const fair = sales.filter((s) => (s.flags || []).some((f) => f.code === 'fair_price')).length;
    const below = sales.filter((s) => (s.flags || []).some((f) => f.code === 'below_market' || f.code === 'far_below_market')).length;
    const income = Math.round(sales.reduce((t, s) => t + (Number(s.answers.quantity) || 0) * (Number(s.answers.price) || 0), 0));
    return { count: sales.length, fair, below, income };
  };
  // People this staff member may record farm data for (enrolment + livelihood consent).
  function livelihoodPeople(user, { hamlet_id = null, q = null } = {}) {
    return brain.persons.visible(user, { hamlet_id, q, limit: 500 })
      .filter((p) => p.kind !== 'child' && brain.policy.canSee(user, p.id, 'livelihood').ok)
      .filter((p) => brain.modules.enabledIn(p.hamlet_id))
      .map((p) => ({ id: p.id, name: p.name, kind: p.kind, age: p.age, gender: p.gender, hamlet_id: p.hamlet_id }));
  }

  // ---------- catalogue ----------
  router.get('/items', authed, (req, res) => res.json({ items: ITEMS.map(({ demo_base, ...i }) => i), units: UNITS, review_agency_id: REVIEW_AGENCY_ID, pending: PENDING }));

  // ---------- weekly prices ----------
  function latestPrices() {
    const rows = sql('SELECT item, market, unit, price, week_of, source, is_demo FROM agri_prices WHERE deleted=0 ORDER BY item, unit, week_of DESC, updated_at DESC');
    const by = new Map();
    for (const r of rows) {
      const k = r.item + '|' + r.unit;
      if (!by.has(k)) by.set(k, { weeks: new Map() });
      const g = by.get(k);
      if (!g.weeks.has(r.week_of)) g.weeks.set(r.week_of, r); // latest entry per week (any market)
    }
    const out = [];
    for (const [k, g] of by) {
      const weeks = [...g.weeks.values()]; // newest first
      const cur = weeks[0], prev = weeks[1];
      const it = ITEM[cur.item] || { label: cur.item };
      out.push({
        item: cur.item, label: it.label, label_ml: it.label_ml, icon: it.icon, kind: it.kind, unit: cur.unit, market: cur.market,
        price: Number(cur.price), week_of: cur.week_of, source: cur.source, is_demo: Number(cur.is_demo) === 1,
        prev_price: prev ? Number(prev.price) : null, change_pct: prev && Number(prev.price) ? Math.round(((cur.price - prev.price) / prev.price) * 1000) / 10 : null,
        history: weeks.slice(0, 12).reverse().map((w) => Number(w.price)), key: k,
      });
    }
    out.sort((a, b) => (ITEMS.findIndex((i) => i.value === a.item) - ITEMS.findIndex((i) => i.value === b.item)));
    return out;
  }
  router.get('/prices', authed, (req, res) => {
    const items = latestPrices();
    const anyDemo = items.some((i) => i.is_demo);
    res.json({ items, any_demo: anyDemo, demo_label: anyDemo ? DEMO_LABEL : null, demo_label_ml: anyDemo ? DEMO_LABEL_ML : null, can_enter: can(req.user, 'agri.advise') });
  });
  router.get('/prices/history', authed, (req, res) => {
    const item = S(req.query.item, 40);
    if (!ITEM[item]) throw httpError(400, 'Unknown item');
    res.json(sql('SELECT id, item, market, unit, price, week_of, source, is_demo, entered_by_name FROM agri_prices WHERE deleted=0 AND item=? ORDER BY week_of DESC LIMIT 60', item));
  });
  router.post('/prices', requires('agri.advise'), (req, res) => {
    const b = req.body || {};
    const item = S(b.item, 40), unit = S(b.unit || 'kg', 10), market = S(b.market, 120), source = S(b.source, 200);
    const price = Number(b.price);
    const week = S(b.week_of || today(), 10);
    if (!ITEM[item]) throw httpError(400, 'Choose an item from the list');
    if (!UNITS.includes(unit)) throw httpError(400, 'Unit must be kg, litre or nos');
    if (!(price > 0 && price < 1e6)) throw httpError(400, 'Enter a price greater than 0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || Number.isNaN(Date.parse(week))) throw httpError(400, 'Week must be a date (YYYY-MM-DD)');
    if (!market) throw httpError(400, 'Name the market or buyer the price is from');
    if (source.length < 3) throw httpError(400, 'Say where the price comes from (e.g. cooperative rate board, market visit)');
    if (/demo/i.test(source)) throw httpError(400, 'Real price entries must not be labelled as demo');
    const row = data.put('agri_prices', { item, unit, market, price, week_of: week, source, is_demo: 0, entered_by: req.user.id, entered_by_name: req.user.display_name, note: S(b.note, 300) || null }, req.user);
    emit('agri.price_entered', { id: row.id, item, unit, week_of: week }, req.user, null);
    res.json(row);
  });

  // ---------- advisories ----------
  const advisoryOut = (a) => ({ id: a.id, key: a.key, crop: a.crop, crop_label: ITEM[a.crop] ? ITEM[a.crop].label : (a.crop === 'all' ? 'All crops' : a.crop), crop_label_ml: ITEM[a.crop] ? ITEM[a.crop].label_ml : (a.crop === 'all' ? 'എല്ലാ വിളകളും' : a.crop), icon: ITEM[a.crop] ? ITEM[a.crop].icon : '🌱', months: a.months || [], title: a.title, title_ml: a.title_ml, body: a.body, body_ml: a.body_ml, status: a.status, review_note: a.review_note, approved_by_name: a.approved_by_name, approved_at: a.approved_at, source: a.source });
  router.get('/advisories', authed, (req, res) => {
    const staff = can(req.user, 'agri.advise') && req.query.all === '1';
    let rows = data.find('agri_advisories', staff ? {} : { status: 'approved' }, { order: 'crop, title' });
    const m = Number(req.query.month);
    if (m >= 1 && m <= 12) rows = rows.filter((a) => (a.months || []).includes(m));
    if (req.query.crop) rows = rows.filter((a) => a.crop === req.query.crop || a.crop === 'all');
    res.json(rows.map(advisoryOut));
  });
  function importPack(user) {
    let added = 0;
    for (const a of ADVISORY_PACK.advisories) {
      const id = 'agr_adv_' + a.key;
      if (data.get('agri_advisories', id)) continue;
      data.put('agri_advisories', { id, key: a.key, crop: a.crop, months: a.months, title: a.title, title_ml: a.title_ml, body: a.body, body_ml: a.body_ml, status: 'draft', review_note: PENDING, source: 'content/advisories.json', created_by: user ? user.id : null }, user);
      added++;
    }
    return added;
  }
  router.post('/advisories/import', requires('agri.advise'), (req, res) => res.json({ added: tx(() => importPack(req.user)) }));
  router.post('/advisories', requires('agri.advise'), (req, res) => {
    const b = req.body || {};
    const months = (Array.isArray(b.months) ? b.months : String(b.months || '').split(/[ ,]+/)).map(Number).filter((n) => n >= 1 && n <= 12);
    const crop = S(b.crop, 40);
    if (!(ITEM[crop] || crop === 'all')) throw httpError(400, 'Choose a crop');
    if (S(b.title).length < 4 || S(b.body).length < 10) throw httpError(400, 'Write a title and the advice');
    const row = data.put('agri_advisories', { ...(b.id ? { id: b.id } : {}), crop, months: months.length ? months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], title: S(b.title, 200), title_ml: S(b.title_ml, 300) || null, body: S(b.body), body_ml: S(b.body_ml) || null, status: 'draft', review_note: PENDING, approved_by: null, approved_by_name: null, approved_at: null, created_by: req.user.id, source: 'officer' }, req.user);
    res.json(advisoryOut(row));
  });
  router.post('/advisories/:id/:action(approve|unapprove)', requires('agri.advise'), (req, res) => {
    const a = data.get('agri_advisories', req.params.id);
    if (!a) throw httpError(404, 'Advisory not found');
    const approve = req.params.action === 'approve';
    const row = data.put('agri_advisories', { ...a, status: approve ? 'approved' : 'draft', approved_by: approve ? req.user.id : null, approved_by_name: approve ? req.user.display_name : null, approved_at: approve ? new Date().toISOString() : null, review_note: approve ? (S(req.body && req.body.note, 300) || `Approved by ${req.user.display_name}`) : PENDING }, req.user);
    if (approve) emit('agri.advisory_approved', { id: a.id, crop: a.crop }, req.user, null);
    brain.audit(req.user, 'advisory.' + req.params.action, a.id, { crop: a.crop });
    res.json(advisoryOut(row));
  });

  // ---------- helper / facilitator ----------
  router.get('/summary', requires('forms.capture', 'agri.advise'), (req, res) => {
    const u = req.user;
    const mine = brain.forms.list(u, { mine: true, limit: 500 });
    const month = today().slice(0, 7);
    res.json({
      people: livelihoodPeople(u).length,
      sales_this_month: mine.filter((s) => s.form_key === SALE_FORM.key && String(s.captured_at).startsWith(month)).length,
      below_market_this_month: mine.filter((s) => s.form_key === SALE_FORM.key && String(s.captured_at).startsWith(month) && (s.flags || []).some((f) => /below_market/.test(f.code))).length,
      pests_waiting: mine.filter((s) => s.form_key === PEST_FORM.key && ['submitted', 'in_review'].includes(s.status)).length,
      replies_new: mine.filter((s) => s.form_key === PEST_FORM.key && s.status === 'replied' && !s.reply_seen_at).length,
      to_review: can(u, 'agri.advise') ? brain.forms.queue(u, { form_key: PEST_FORM.key }).length : 0,
      can_capture: brain.forms.canCapture(u, SALE_FORM.key),
      can_review: brain.forms.canReview(u, PEST_FORM.key),
    });
  });
  router.get('/people', requires('forms.capture', 'agri.advise'), (req, res) => res.json(livelihoodPeople(req.user, { hamlet_id: req.query.hamlet_id || null, q: req.query.q ? S(req.query.q, 60) : null })));
  router.get('/recent', requires('forms.capture', 'agri.advise'), (req, res) => res.json(brain.forms.list(req.user, { mine: req.query.mine === '1', limit: 60 }).map(pubSub)));
  router.get('/person/:pid', requires('forms.capture', 'agri.advise'), (req, res) => {
    const v = brain.policy.canSee(req.user, req.params.pid, 'livelihood');
    if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
    if (v.audited) brain.audit(req.user, 'steward.livelihood_read', req.params.pid);
    const p = brain.persons.basic(req.params.pid);
    if (!p) throw httpError(404, 'Person not found');
    const r = records(req.user, p.id);
    res.json({ person: { id: p.id, name: p.name, kind: p.kind, age: p.age, gender: p.gender, hamlet_id: p.hamlet_id }, ...r, summary: saleSummary(r.sales) });
  });

  // ---------- farmer family view (the person themself, or a guardian) ----------
  router.get('/my', requires('learn', 'family'), (req, res) => {
    const u = req.user;
    const people = brain.persons.visible(u, { limit: 20 }).filter((p) => brain.policy.canSee(u, p.id, 'profile').ok);
    const hm = hamletMap();
    const members = people.map((p) => {
      const r = records(u, p.id);
      return { id: p.id, name: p.name, kind: p.kind, self: p.id === u.person_id, hamlet: hm[p.hamlet_id] && { name: hm[p.hamlet_id].name, name_ml: hm[p.hamlet_id].name_ml }, ...r, summary: saleSummary(r.sales) };
    }).filter((m) => m.self || m.sales.length || m.pests.length);
    members.sort((a, b) => (a.self === b.self ? 0 : a.self ? -1 : 1));
    res.json({ members, month: new Date().getMonth() + 1 });
  });

  // ---------- agriculture officer ----------
  router.get('/queue', requires('agri.advise'), (req, res) => res.json(brain.forms.queue(req.user, { form_key: PEST_FORM.key, hamlet_id: req.query.hamlet_id || undefined }).map(pubSub)));
  router.get('/reports/:id', requires('agri.advise', 'forms.capture', 'learn', 'family'), (req, res) => {
    const s = brain.forms.one(req.user, req.params.id);
    if (s.form_key !== PEST_FORM.key && s.form_key !== SALE_FORM.key) throw httpError(404, 'Not found');
    res.json({ ...pubSub(s), photo: s.answers && s.answers.photo && String(s.answers.photo).startsWith('data:image/') ? s.answers.photo : null, can_reply: s.can_reply });
  });
  router.post('/reports/:id/reply', requires('agri.advise'), (req, res) => {
    const b = req.body || {};
    let text = S(b.reply, 4000), textMl = S(b.reply_ml, 4000);
    if (b.advisory_id) {
      const a = data.get('agri_advisories', b.advisory_id);
      if (!a || a.status !== 'approved') throw httpError(400, 'Only approved advisories can be attached');
      text = [text, a.title + ': ' + a.body].filter(Boolean).join('\n\n');
      textMl = [textMl, a.title_ml && a.body_ml ? a.title_ml + ': ' + a.body_ml : ''].filter(Boolean).join('\n\n');
    }
    const outcome = ['advice', 'visit_planned', 'refer_forest_dept', 'refer_kvk', 'no_action'].includes(b.outcome) ? b.outcome : 'advice';
    const row = brain.forms.reply(req.user, req.params.id, { reply: text, reply_ml: textMl || null, outcome, close: !!b.close });
    res.json(pubSub(row));
  });

  // ---------- aggregates for donors and government (no names, k-anonymised) ----------
  router.get('/aggregate', requires('analytics.aggregate', 'agri.advise'), (req, res) => {
    const u = req.user;
    // Stewards, donors and government see every agency's records in aggregate; the reviewing
    // Krishi Bhavan sees all agri records (pest reports are forwarded to it); other agencies their own.
    const allAgencies = STEWARDS.includes(u.role) || ['donor', 'govt_viewer', 'cpo'].includes(u.role) || u.agency_id === REVIEW_AGENCY_ID;
    const where = allAgencies ? '' : ' AND agency_id=?';
    const args = allAgencies ? [] : [u.agency_id];
    const since = new Date(Date.now() - (Number(req.query.days) || 180) * 86400e3).toISOString();
    const sales = sql(`SELECT hamlet_id, person_id, answers, flags FROM agri_form_rows WHERE deleted=0 AND module='agri' AND form_key=? AND captured_at>=?${where}`, SALE_FORM.key, since, ...args);
    const pests = sql(`SELECT hamlet_id, person_id, answers, status FROM agri_form_rows WHERE deleted=0 AND module='agri' AND form_key=? AND captured_at>=?${where}`, PEST_FORM.key, since, ...args);
    const hm = hamletMap();
    const sup = (n) => brain.policy.suppress(n, u);
    const small = (n) => typeof sup(n) === 'string';
    const cells = new Map();
    for (const s of sales) {
      const a = s.answers || {};
      const k = s.hamlet_id + '|' + a.item + '|' + a.unit;
      if (!cells.has(k)) cells.set(k, { hamlet_id: s.hamlet_id, item: a.item, unit: a.unit, sales: 0, sellers: new Set(), qty: 0, value: 0, below: 0, checked: 0 });
      const c = cells.get(k);
      c.sales++; c.sellers.add(s.person_id); c.qty += Number(a.quantity) || 0; c.value += (Number(a.quantity) || 0) * (Number(a.price) || 0);
      const f = (s.flags || []).map((x) => x.code);
      if (f.some((x) => ['fair_price', 'below_market', 'far_below_market'].includes(x))) c.checked++;
      if (f.some((x) => x === 'below_market' || x === 'far_below_market')) c.below++;
    }
    const rows = [...cells.values()].map((c) => {
      const hide = small(c.sellers.size);
      const h = hm[c.hamlet_id] || {};
      const it = ITEM[c.item] || {};
      return { hamlet: h.name, hamlet_ml: h.name_ml, item: c.item, item_label: it.label, item_label_ml: it.label_ml, icon: it.icon, unit: c.unit,
        sellers: sup(c.sellers.size), sales: hide ? sup(c.sales) : c.sales,
        quantity: hide ? null : Math.round(c.qty * 10) / 10, value_inr: hide ? null : Math.round(c.value),
        below_market_pct: hide || !c.checked ? null : Math.round((c.below / c.checked) * 100), suppressed: hide };
    }).sort((a, b) => String(a.hamlet).localeCompare(String(b.hamlet)) || String(a.item).localeCompare(String(b.item)));
    // item totals across hamlets
    const byItem = new Map();
    for (const c of cells.values()) {
      const k = c.item + '|' + c.unit;
      if (!byItem.has(k)) byItem.set(k, { item: c.item, unit: c.unit, sellers: new Set(), sales: 0, qty: 0, value: 0, below: 0, checked: 0 });
      const t = byItem.get(k);
      for (const p of c.sellers) t.sellers.add(p);
      t.sales += c.sales; t.qty += c.qty; t.value += c.value; t.below += c.below; t.checked += c.checked;
    }
    const items = [...byItem.values()].map((t) => {
      const hide = small(t.sellers.size); const it = ITEM[t.item] || {};
      return { item: t.item, item_label: it.label, item_label_ml: it.label_ml, icon: it.icon, unit: t.unit, sellers: sup(t.sellers.size), sales: hide ? sup(t.sales) : t.sales, quantity: hide ? null : Math.round(t.qty * 10) / 10, value_inr: hide ? null : Math.round(t.value), below_market_pct: hide || !t.checked ? null : Math.round((t.below / t.checked) * 100), suppressed: hide };
    }).sort((a, b) => (b.value_inr || 0) - (a.value_inr || 0));
    const pestBy = new Map();
    for (const p of pests) {
      const k = p.hamlet_id + '|' + ((p.answers || {}).problem || 'other');
      if (!pestBy.has(k)) pestBy.set(k, { hamlet_id: p.hamlet_id, problem: (p.answers || {}).problem, n: 0, answered: 0 });
      const c = pestBy.get(k); c.n++; if (['replied', 'closed'].includes(p.status)) c.answered++;
    }
    const pestRows = [...pestBy.values()].map((c) => ({ hamlet: (hm[c.hamlet_id] || {}).name, hamlet_ml: (hm[c.hamlet_id] || {}).name_ml, problem: c.problem, reports: sup(c.n), answered: small(c.n) ? null : c.answered }));
    const allSellers = new Set(sales.map((s) => s.person_id));
    const checked = sales.filter((s) => (s.flags || []).some((f) => ['fair_price', 'below_market', 'far_below_market'].includes(f.code)));
    const below = checked.filter((s) => (s.flags || []).some((f) => /below_market/.test(f.code)));
    res.json({
      since: since.slice(0, 10), scope: allAgencies ? 'all agencies' : 'your agency', k_anon: 5,
      totals: { sales: sup(sales.length), sellers: sup(allSellers.size), below_market_pct: checked.length >= 5 ? Math.round((below.length / checked.length) * 100) : null, pest_reports: sup(pests.length), pest_answered_pct: pests.length >= 5 ? Math.round((pests.filter((p) => ['replied', 'closed'].includes(p.status)).length / pests.length) * 100) : null },
      by_item: items, by_hamlet_item: rows, pests: pestRows,
      prices_note: latestPrices().some((p) => p.is_demo) ? DEMO_LABEL : null,
    });
  });

  // ---------- demo seed ----------
  async function seed(demo) {
    const R = demo.rng(9501); // own random stream — never demo.R
    const { store, brain: B, daysAgo } = demo;
    const H = demo.hamletByKey, A = demo.agencyByKey;
    const hamlets = [H.h1, H.h2, H.h11].filter(Boolean);
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const monday = (ms) => { const d = new Date(ms); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10); };

    let kb; const kbUsers = {}; const growers = [];
    tx(() => {
      // Fictional Krishi Bhavan agency under the stable review-agency id.
      kb = store.put('agencies', { id: REVIEW_AGENCY_ID, name: 'Demo Krishi Bhavan (fictional)', type: 'govt', steward: 0, status: 'active', colour: '#558b2f', contact: 'demo@example.org', about: 'Fictional agriculture office for the demo — answers pest reports, enters weekly prices, approves crop advice.' });
      for (const h of hamlets) store.put('agency_presence', { agency_id: kb.id, hamlet_id: h.id, services: ['agriculture'], since: daysAgo(R.int(120, 400)).slice(0, 10), status: 'active' });
      kbUsers.officer = B.createUser({ username: 'demo.agri', password: demo.DEMO_PASSWORD, role: 'field_officer', agency_id: kb.id, hamlet_ids: hamlets.map((h) => h.id), display_name: 'Anil — Agriculture Officer (Demo Krishi Bhavan)', safeguarding_trained: 1 }, null);
      kbUsers.admin = B.createUser({ username: 'demo.agri.admin', password: demo.DEMO_PASSWORD, role: 'agency_admin', agency_id: kb.id, display_name: 'Demo Krishi Bhavan — Admin', safeguarding_trained: 1 }, null);
      // (demo.users / demo.programmes are left untouched so modules seeded later see the same data as before)

      // Programmes with the agriculture track.
      const progs = {};
      for (const h of hamlets) {
        progs['kb|' + h.id] = B.store.put('programmes', { agency_id: kb.id, hamlet_id: h.id, module: 'agri', track: 'agriculture', title: 'Farm & Forest Produce Support', title_ml: 'കൃഷി, വനവിഭവ സഹായം', schedule: ['Visit day (fortnightly)'], capacity: 80, status: 'active' });
        // CIF runs a livelihood desk where it is already present (h1, h2).
        if (store.one('SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0', A.cif.id, h.id)) {
          progs['cif|' + h.id] = B.store.put('programmes', { agency_id: A.cif.id, hamlet_id: h.id, module: 'agri', track: 'agriculture', title: 'Livelihood Desk — fair prices & farm records', title_ml: 'ഉപജീവന ഡെസ്ക് — ന്യായവിലയും കൃഷി രേഖകളും', schedule: ['Sat 10:00'], capacity: 60, status: 'active' });
        }
      }

      // Consent (merge scopes — grantConsent supersedes the agency's previous consent) + enrolment.
      const merge = (pid, aid, add) => {
        const cur = store.find('consents', { person_id: pid, agency_id: aid, status: 'active' })[0];
        const scopes = [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : []), ...add])];
        const c = B.grantConsent({ person_id: pid, agency_id: aid, scopes, granted_by: pid, relation: 'self', method: R.pick(['in_person', 'in_person', 'ivr']) }, null);
        store.put('consents', { ...c, granted_at: cur && cur.granted_at ? cur.granted_at : daysAgo(R.int(95, 200)) });
      };
      for (const h of hamlets) {
        const pool = [...demo.adults, ...demo.youth].filter((p) => p.hamlet_id === h.id);
        for (const p of pool) {
          const must = (demo.demoGuardian && p.id === demo.demoGuardian.id) || (demo.demoYouth && p.id === demo.demoYouth.id);
          if (!must && !R.chance(p.kind === 'adult' ? 0.7 : 0.4)) continue;
          merge(p.id, kb.id, ['profile', 'livelihood']);
          B.enrol(p.id, progs['kb|' + h.id].id, null);
          if (progs['cif|' + h.id] && (must || R.chance(0.75))) { merge(p.id, A.cif.id, ['profile', 'livelihood']); B.enrol(p.id, progs['cif|' + h.id].id, null); }
          growers.push(p);
        }
      }

      // Advisories (all draft, PENDING REVIEW).
      importPack(null);

      // ~12 weeks of DEMO prices: a gentle random walk around a made-up base, labelled as demo.
      const weeks = []; for (let w = 11; w >= 0; w--) weeks.push(monday(now - w * 7 * 86400e3));
      for (const it of ITEMS) {
        let p = it.demo_base * (0.9 + R.rnd() * 0.2);
        for (const wk of weeks) {
          p = Math.max(it.demo_base * 0.6, p * (1 + (R.rnd() - 0.48) * 0.08));
          const price = it.demo_base >= 100 ? Math.round(p) : Math.round(p * 2) / 2;
          data.put('agri_prices', { item: it.value, unit: it.unit, market: 'Demo market, Idukki (fictional)', price, week_of: wk, source: DEMO_LABEL, is_demo: 1, entered_by: kbUsers.officer.id, entered_by_name: 'Demo seed' }, null);
        }
      }
    });

    // ~3 months of sales and pest reports, captured by the people's facilitator or the officer.
    const fac = { [H.h1.id]: demo.users.facilitator, [H.h2.id]: demo.users.facilitator2 };
    const urow = (u) => B.store.get('users', u.id);
    const officer = urow(kbUsers.officer);
    const PEST_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PS/HgAFXQJMm+Ys9QAAAABJRU5ErkJggg==';
    const hamletCrops = { [H.h1.id]: ['cardamom', 'pepper', 'coffee', 'banana', 'ginger', 'tapioca'], [H.h2.id]: ['banana', 'tapioca', 'paddy', 'vegetables', 'ginger', 'turmeric'], [H.h11 && H.h11.id]: ['cardamom', 'pepper', 'coffee', 'banana', 'tapioca'] };
    const forest = ['honey', 'beeswax', 'amla', 'soapnut', 'wild_turmeric', 'cinnamon', 'medicinal'];
    const qtyFor = (it) => ({ cardamom: [2, 25], pepper: [5, 60], coffee: [20, 200], banana: [20, 150], tapioca: [50, 400], ginger: [10, 120], turmeric: [5, 60], paddy: [100, 600], vegetables: [10, 80], honey: [1, 15], beeswax: [0.5, 5], amla: [10, 120], soapnut: [5, 50], wild_turmeric: [2, 20], cinnamon: [2, 25], medicinal: [2, 30] }[it] || [1, 20]);
    tx(() => {
      let n = 0;
      for (const p of growers) {
        const capturer = urow(fac[p.hamlet_id] && B.policy.canSee(urow(fac[p.hamlet_id]), p.id, 'livelihood').ok ? fac[p.hamlet_id] : kbUsers.officer);
        const crops = hamletCrops[p.hamlet_id] || hamletCrops[H.h1.id];
        const k = (demo.demoGuardian && p.id === demo.demoGuardian.id) ? 4 : R.int(0, 3);
        for (let i = 0; i < k; i++) {
          const item = R.chance(0.35) ? R.pick(forest) : R.pick(crops);
          const ago = R.int(1, 90);
          const date = iso(now - ago * 86400e3).slice(0, 10);
          const ref = refPrice(item, 'kg', date);
          const soldTo = R.pick(['cooperative', 'trader', 'trader', 'market', forest.includes(item) ? 'vanasree' : 'market']);
          const f = soldTo === 'trader' ? (R.chance(0.3) ? 0.45 + R.rnd() * 0.3 : 0.75 + R.rnd() * 0.3) : 0.85 + R.rnd() * 0.25;
          const price = ref ? Math.max(1, Math.round(ref.price * f)) : ITEM[item].demo_base;
          const [qa, qb] = qtyFor(item);
          const quantity = Math.round((qa + R.rnd() * (qb - qa)) * 10) / 10;
          const s = B.forms.submit(capturer, { form_key: SALE_FORM.key, person_id: p.id, answers: { item, quantity, unit: 'kg', sold_to: soldTo, price, date }, client_ref: 'seed-agri-sale-' + (n++) }, {});
          store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: iso(now - ago * 86400e3 + 3600e3) });
        }
      }
      // pest / damage reports
      const reporters = R.sample(growers, Math.min(30, growers.length));
      if (demo.demoGuardian && growers.some((p) => p.id === demo.demoGuardian.id) && !reporters.some((p) => p.id === demo.demoGuardian.id)) reporters.push(growers.find((p) => p.id === demo.demoGuardian.id));
      const REPLIES = {
        insects: ['Remove and destroy the worst-affected parts. Keep the plot clean of fallen leaves and fruits. Bring a fresh close photo next visit; if it spreads, the Krishi Bhavan will visit. Do not spray anything before we check.', 'കൂടുതൽ കേടുവന്ന ഭാഗങ്ങൾ നീക്കി നശിപ്പിക്കുക. വീണ ഇലകളും കായ്കളും നീക്കി തോട്ടം വൃത്തിയാക്കുക. അടുത്ത തവണ പുതിയ ഫോട്ടോ കൊണ്ടുവരിക; പടർന്നാൽ കൃഷിഭവൻ സന്ദർശിക്കും. ഞങ്ങൾ നോക്കുംമുമ്പ് ഒന്നും തളിക്കരുത്.'],
        disease: ['Looks like a leaf-spot disease. Cut off spotted leaves and burn them away from the plot, improve drainage and air flow. Ask at the Krishi Bhavan for bio-control (Trichoderma / Pseudomonas) suitable for your crop.', 'ഇലപ്പുള്ളി രോഗമാകാം. പുള്ളിയുള്ള ഇലകൾ മുറിച്ച് തോട്ടത്തിന് പുറത്ത് കത്തിക്കുക, നീർവാർച്ചയും കാറ്റോട്ടവും കൂട്ടുക. നിങ്ങളുടെ വിളയ്ക്ക് പറ്റിയ ജൈവ നിയന്ത്രണ മാർഗം (ട്രൈക്കോഡെർമ / സ്യൂഡോമോണാസ്) കൃഷിഭവനിൽ ചോദിക്കുക.'],
        wilting: ['Possible quick wilt / root disease. Make drains so no water stands at the base, do not dig near roots, remove fully dead plants. An officer will visit on the next round.', 'ദ്രുതവാട്ടം / വേരുരോഗം ആകാം. ചുവട്ടിൽ വെള്ളം കെട്ടാതിരിക്കാൻ ചാൽ കീറുക, വേരിനടുത്ത് കിളയ്ക്കരുത്, പൂർണ്ണമായി ഉണങ്ങിയ ചെടികൾ മാറ്റുക. അടുത്ത റൗണ്ടിൽ ഓഫീസർ സന്ദർശിക്കും.'],
        rot: ['Rot spreads in wet soil. Lift and remove rotten plants, raise the beds and mulch. Use only healthy seed material next season.', 'നനഞ്ഞ മണ്ണിൽ അഴുകൽ പടരും. അഴുകിയ ചെടികൾ പിഴുതുമാറ്റുക, വാരം ഉയർത്തി പുതയിടുക. അടുത്ത തവണ ആരോഗ്യമുള്ള നടീൽവസ്തു മാത്രം ഉപയോഗിക്കുക.'],
        wild_animals: ['Recorded for Forest Department compensation. Keep these photos and the date. The centre will help you fill the compensation application on the next visit day.', 'വനം വകുപ്പ് നഷ്ടപരിഹാരത്തിനായി രേഖപ്പെടുത്തി. ഈ ഫോട്ടോകളും തീയതിയും സൂക്ഷിക്കുക. അടുത്ത സന്ദർശന ദിവസം നഷ്ടപരിഹാര അപേക്ഷ പൂരിപ്പിക്കാൻ സെന്റർ സഹായിക്കും.'],
        other: ['Thank you. Please show the plants to the officer on the next visit day.', 'നന്ദി. അടുത്ത സന്ദർശന ദിവസം ചെടികൾ ഓഫീസറെ കാണിക്കുക.'],
      };
      let m = 0;
      for (const p of reporters) {
        const capturer = urow(fac[p.hamlet_id] && B.policy.canSee(urow(fac[p.hamlet_id]), p.id, 'livelihood').ok ? fac[p.hamlet_id] : kbUsers.officer);
        const crops = hamletCrops[p.hamlet_id] || hamletCrops[H.h1.id];
        const problem = R.pick(['insects', 'insects', 'disease', 'wilting', 'rot', 'wild_animals', 'wild_animals', 'other']);
        const ago = R.int(2, 85);
        const answers = { crop: R.pick(crops), problem, parts: R.sample(['leaves', 'stem', 'roots', 'fruits', 'whole'], R.int(1, 2)), area: R.pick(['few', 'quarter', 'half', 'whole_plot']), since: iso(now - (ago + R.int(2, 20)) * 86400e3).slice(0, 10), notes: problem === 'wild_animals' ? 'Damage found in the morning near the forest edge.' : '' };
        if (problem === 'wild_animals') answers.animal = R.pick(['elephant', 'wild_boar', 'wild_boar', 'monkey']);
        if (R.chance(0.75)) answers.photo = PEST_PHOTO;
        const s = B.forms.submit(capturer, { form_key: PEST_FORM.key, person_id: p.id, answers, client_ref: 'seed-agri-pest-' + (m++) }, {});
        store.put('form_submissions', { ...store.get('form_submissions', s.id), captured_at: iso(now - ago * 86400e3) });
        if (ago > 10 && R.chance(0.7)) {
          const [en, ml] = REPLIES[problem];
          // four eyes: whoever did not capture it gives the advice
          const adviser = capturer.id === officer.id ? urow(kbUsers.admin) : officer;
          B.forms.reply(adviser, s.id, { reply: en, reply_ml: ml, outcome: problem === 'wild_animals' ? 'refer_forest_dept' : 'advice', close: false, notify: false });
          const cur = store.get('form_submissions', s.id);
          store.put('form_submissions', { ...cur, replied_at: iso(now - (ago - R.int(3, 9)) * 86400e3), reply_seen_at: R.chance(0.6) ? iso(now - (ago - 10) * 86400e3) : null });
        }
      }
    });
  }

  return {
    seed,
    health: () => ({
      prices: sqlOne('SELECT COUNT(*) n FROM agri_prices WHERE deleted=0').n,
      demo_prices: sqlOne('SELECT COUNT(*) n FROM agri_prices WHERE deleted=0 AND is_demo=1').n,
      advisories_approved: sqlOne("SELECT COUNT(*) n FROM agri_advisories WHERE deleted=0 AND status='approved'").n,
      advisories_draft: sqlOne("SELECT COUNT(*) n FROM agri_advisories WHERE deleted=0 AND status='draft'").n,
    }),
  };
};

module.exports.ITEMS = ITEMS;
module.exports.DEMO_LABEL = DEMO_LABEL;
module.exports.REVIEW_AGENCY_ID = REVIEW_AGENCY_ID;
