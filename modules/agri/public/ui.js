// Agriculture & Forest Produce — screens. Plain ES module; no DOM work at import time.
// Views: home (helper / facilitator), family (farmer or guardian), officer (Krishi Bhavan), impact (aggregates).

const CSS = `
.agri-hero{background:linear-gradient(135deg,#33691e 0%,#558b2f 70%,#7cb342 100%);color:#fff;border-radius:var(--r-l,14px);padding:16px 18px;margin-bottom:14px;position:relative}
.agri-hero h2{color:#fff;margin:0 0 4px}
.agri-hero p{margin:0;opacity:.95;max-width:62ch}
.agri-hero .speak{position:absolute;top:10px;right:10px}
.agri-demo{display:inline-block;background:#fff3cd;color:#7a4b00;border:1px solid #e0b100;border-radius:6px;padding:3px 8px;font-weight:700;font-size:.8rem;letter-spacing:.02em}
.agri-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0 14px}
.agri-act{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:110px;border:2px solid var(--line,#ddd);border-radius:14px;background:#fff;font-weight:700;font-size:1.05rem;cursor:pointer;padding:10px;text-align:center}
.agri-act:hover,.agri-act:focus{border-color:#558b2f;outline:none}
.agri-act .e{font-size:2.4rem;line-height:1}
.agri-prices{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.agri-price{border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;padding:10px;display:flex;flex-direction:column;gap:2px}
.agri-price .top{display:flex;justify-content:space-between;align-items:center;gap:6px}
.agri-price .e{font-size:1.6rem}
.agri-price .v{font-size:1.3rem;font-weight:800}
.agri-up{color:#2e7d32;font-weight:700}.agri-down{color:#b00020;font-weight:700}.agri-flat{color:#666}
.agri-adv{border:1px solid var(--line,#ddd);border-left:6px solid #7cb342;border-radius:10px;background:#fff;padding:12px;margin-bottom:10px}
.agri-adv.draft{border-left-color:#e0b100;background:#fffdf3}
.agri-adv h4{margin:0 0 6px;display:flex;gap:8px;align-items:center;justify-content:space-between}
.agri-sale{display:flex;gap:10px;align-items:center;border-bottom:1px dashed var(--line,#ddd);padding:8px 0}
.agri-sale .e{font-size:1.8rem;flex:none}
.agri-sale .m{flex:1;min-width:0}
.agri-q{border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;cursor:pointer}
.agri-q img,.agri-q .ph{width:72px;height:72px;border-radius:8px;object-fit:cover;flex:none;background:#eef3e8;display:grid;place-items:center;font-size:2rem}
.agri-q.p2{border-left:6px solid #b00020}.agri-q.p1{border-left:6px solid #e0b100}
.agri-photo{max-width:100%;width:420px;border-radius:10px;border:1px solid var(--line,#ddd)}
@media (max-width:420px){.agri-act{min-height:96px;font-size:.95rem}.agri-act .e{font-size:2rem}}
`;

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_ML = ['ജനു', 'ഫെബ്രു', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗ', 'സെപ്റ്റ', 'ഒക്ടോ', 'നവം', 'ഡിസം'];
const PROBLEM_ICON = { insects: '🐛', disease: '🟤', wilting: '🥀', rot: '🍂', wild_animals: '🐘', other: '❓' };
const SOLD_TO = { cooperative: ['Cooperative', 'സഹകരണ സംഘം'], vanasree: ['Vanasree', 'വനശ്രീ'], trader: ['Trader', 'കച്ചവടക്കാരൻ'], market: ['Market', 'ചന്ത'], other: ['Other', 'മറ്റുള്ളവ'] };

let itemCache = null;
async function items(k) { if (!itemCache) itemCache = await k.api.get('/items'); return itemCache; }
const itemOf = (cat, v) => cat.items.find((i) => i.value === v) || { label: v, icon: '🌱' };
const money = (n) => (n === null || n === undefined ? '—' : '₹' + Number(n).toLocaleString('en-IN'));
const say = (k, en, ml) => k.ui.speakBtn(k.lang === 'ml' && ml ? ml : en, k.lang === 'ml' && ml ? 'ml' : 'en');

function hero(k, icon, en, ml, pen, pml) {
  const { h, t } = k;
  return h('div', { class: 'agri-hero' }, h('h2', null, icon + ' ' + t(en, ml)), h('p', null, t(pen, pml)), say(k, en + '. ' + pen, ml + '. ' + pml));
}
function demoBanner(k, show) {
  if (!show) return null;
  return k.h('div', { style: { margin: '6px 0 10px' } }, k.h('span', { class: 'agri-demo', role: 'note' }, '⚠ DEMO PRICES — NOT REAL MARKET DATA'), ' ', k.h('span', { class: 'small muted' }, k.t('', 'ഡെമോ വില — യഥാർത്ഥ വിപണി വിലയല്ല')));
}
function flagBadges(k, s) {
  return (s.flags || []).map((f) => k.ui.badge(k.t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : f.code === 'fair_price' ? 'good' : 'info'));
}

// ---------- prices ----------
async function pricesPanel(el, k, { compact = false } = {}) {
  const { h, t, ui } = k;
  const r = await k.api.get('/prices');
  el.append(demoBanner(k, r.any_demo));
  if (!r.items.length) { el.append(ui.empty(t('No prices entered yet.', 'ഇതുവരെ വില ചേർത്തിട്ടില്ല.'))); return r; }
  const list = compact ? r.items.slice(0, 8) : r.items;
  el.append(h('div', { class: 'agri-prices' }, list.map((p) => {
    const ch = p.change_pct;
    const arrow = ch === null ? h('span', { class: 'agri-flat' }, '—') : ch > 0.5 ? h('span', { class: 'agri-up' }, '▲ ' + ch + '%') : ch < -0.5 ? h('span', { class: 'agri-down' }, '▼ ' + Math.abs(ch) + '%') : h('span', { class: 'agri-flat' }, '● ' + t('steady', 'മാറ്റമില്ല'));
    const spokenEn = `${p.label}: ${p.price} rupees per ${p.unit}${p.is_demo ? '. Demo price, not real.' : ''}`;
    const spokenMl = `${p.label_ml || p.label}: ഒരു ${p.unit === 'kg' ? 'കിലോയ്ക്ക്' : p.unit} ${p.price} രൂപ${p.is_demo ? '. ഡെമോ വില.' : ''}`;
    return h('div', { class: 'agri-price' },
      h('div', { class: 'top' }, h('span', { class: 'e', 'aria-hidden': 'true' }, p.icon || '🌱'), say(k, spokenEn, spokenMl)),
      h('b', null, t(p.label, p.label_ml)),
      h('span', { class: 'v' }, money(p.price), h('span', { class: 'small muted' }, ' /' + p.unit)),
      h('div', { class: 'row small', style: { justifyContent: 'space-between' } }, arrow, ui.spark(p.history, { w: 70, hgt: 22 })),
      h('span', { class: 'small muted' }, t('Week of', 'ആഴ്ച') + ' ' + p.week_of),
      p.is_demo ? h('span', { class: 'agri-demo' }, 'DEMO') : h('span', { class: 'small muted' }, p.source));
  })));
  if (compact && r.items.length > list.length) el.append(h('p', { class: 'small' }, h('a', { href: '#/m/agri/home?tab=prices' }, t('All prices →', 'എല്ലാ വിലകളും →'))));
  return r;
}

async function priceEntry(el, k) {
  const { h, t, ui } = k;
  const cat = await items(k);
  const out = h('div');
  el.append(ui.section(t('Enter this week\'s price', 'ഈ ആഴ്ചത്തെ വില ചേർക്കുക'), [
    h('p', { class: 'small muted' }, t('Enter real prices only, with where they come from (cooperative rate board, market visit, Spices Board auction …).', 'യഥാർത്ഥ വില മാത്രം, എവിടെ നിന്നാണെന്ന് സഹിതം ചേർക്കുക.')),
    ui.form([
      { name: 'item', label: t('Item', 'ഇനം'), type: 'select', required: true, options: cat.items.map((i) => ({ value: i.value, label: i.icon + ' ' + t(i.label, i.label_ml) })) },
      { name: 'unit', label: t('Unit', 'അളവ്'), type: 'select', required: true, options: cat.units, value: 'kg' },
      { name: 'price', label: t('Price per unit (₹)', 'ഒരു യൂണിറ്റിന് വില (₹)'), type: 'number', required: true, min: 0, step: '0.5' },
      { name: 'market', label: t('Market / buyer', 'ചന്ത / വാങ്ങുന്നവർ'), type: 'text', required: true, placeholder: 'e.g. Adimali market' },
      { name: 'week_of', label: t('Week of', 'ആഴ്ച'), type: 'date', value: new Date().toISOString().slice(0, 10) },
      { name: 'source', label: t('Source of this price', 'വിലയുടെ ഉറവിടം'), type: 'text', required: true, placeholder: 'e.g. Cooperative rate board' },
    ], async (v) => { await k.api.post('/prices', v); k.toast(t('Price saved', 'വില സേവ് ചെയ്തു'), 'good'); out.replaceChildren(); await pricesPanel(out, k); }, { submitLabel: t('Save price', 'വില സേവ് ചെയ്യുക') }),
  ]), out);
}

// ---------- advisories ----------
function advisoryCard(k, a, { onApprove } = {}) {
  const { h, t, ui } = k;
  const months = (a.months || []).length === 12 ? t('All year', 'വർഷം മുഴുവൻ') : (a.months || []).map((m) => t(MONTHS_EN[m - 1], MONTHS_ML[m - 1])).join(', ');
  return h('div', { class: 'agri-adv' + (a.status === 'draft' ? ' draft' : '') },
    h('h4', null, h('span', null, a.icon + ' ' + t(a.title, a.title_ml || a.title)), say(k, a.title + '. ' + a.body, (a.title_ml || '') + '. ' + (a.body_ml || ''))),
    h('div', { class: 'small muted' }, t(a.crop_label, a.crop_label_ml) + ' · ' + months),
    h('p', null, t(a.body, a.body_ml || a.body)),
    a.status === 'draft' ? h('div', { class: 'row' }, ui.badge(t('Draft — ', 'കരട് — ') + (a.review_note || 'PENDING REVIEW'), 'warn'), onApprove ? ui.button(t('Approve for families', 'കുടുംബങ്ങൾക്കായി അംഗീകരിക്കുക'), () => onApprove(a), { tone: 'primary', small: true }) : null)
      : h('div', { class: 'small muted' }, '✓ ' + t('Approved', 'അംഗീകരിച്ചത്') + (a.approved_by_name ? ' · ' + a.approved_by_name : '')));
}
async function advisoriesForMonth(el, k) {
  const { t, ui } = k;
  const m = new Date().getMonth() + 1;
  const rows = await k.api.get('/advisories?month=' + m);
  el.append(rows.length ? rows.map((a) => advisoryCard(k, a)) : ui.empty(t('No approved advice for this month yet.', 'ഈ മാസത്തേക്ക് അംഗീകരിച്ച ഉപദേശം ഇതുവരെ ഇല്ല.')));
}

// ---------- records ----------
function saleRow(k, cat, s) {
  const { h, t } = k;
  const a = s.answers || {};
  const it = itemOf(cat, a.item);
  const st = SOLD_TO[a.sold_to] || [a.sold_to, a.sold_to];
  return h('div', { class: 'agri-sale' }, h('span', { class: 'e', 'aria-hidden': 'true' }, it.icon || '🌱'),
    h('div', { class: 'm' }, h('b', null, t(it.label, it.label_ml), ' · ', a.quantity + ' ' + a.unit, ' × ', money(a.price)),
      h('div', { class: 'small muted' }, (a.date || String(s.captured_at).slice(0, 10)) + ' · ' + t(st[0], st[1]) + (s.person && s.person.name ? ' · ' + s.person.name : '')),
      h('div', { class: 'row' }, flagBadges(k, s))));
}
function pestCard(k, cat, s, { onOpen, onSeen } = {}) {
  const { h, t, ui } = k;
  const a = s.answers || {};
  const statusLabel = { submitted: t('Waiting for the officer', 'ഓഫീസറുടെ മറുപടി കാത്തിരിക്കുന്നു'), in_review: t('Officer is looking', 'ഓഫീസർ പരിശോധിക്കുന്നു'), replied: t('Advice ready', 'ഉപദേശം തയ്യാർ'), closed: t('Closed', 'അവസാനിച്ചു') }[s.status] || s.status;
  const reply = s.reply ? h('div', { class: 'card', style: { background: '#f1f8e9', marginTop: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, '🧑‍🌾 ' + t('Advice', 'ഉപദേശം') + (s.replied_by_name ? ' · ' + s.replied_by_name : '')), say(k, s.reply, s.reply_ml || s.reply)), h('p', { style: { whiteSpace: 'pre-wrap' } }, t(s.reply, s.reply_ml || s.reply))) : null;
  const it = itemOf(cat, a.crop);
  return h('div', { class: 'card' },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, (PROBLEM_ICON[a.problem] || '❓') + ' ' + t(it.label, it.label_ml) + (s.person && s.person.name ? ' — ' + s.person.name : '')), h('span', { class: 'small muted' }, String(s.captured_at || '').slice(0, 10))),
    h('div', { class: 'row' }, ui.badge(statusLabel, s.status === 'replied' ? 'good' : s.status === 'closed' ? 'info' : 'warn'), s.has_photo ? ui.badge('📷', 'info') : null, flagBadges(k, s)),
    reply,
    h('div', { class: 'row' }, onOpen ? ui.button(t('Open', 'തുറക്കുക'), () => onOpen(s), { small: true, tone: 'ghost' }) : null,
      s.reply && !s.reply_seen_at && onSeen ? ui.button(t('Told to the family', 'കുടുംബത്തെ അറിയിച്ചു'), () => onSeen(s), { small: true }) : null));
}

// ---------- capture ----------
async function capture(el, k, formKey, person) {
  const { h, t, ui } = k;
  el.replaceChildren(ui.loading());
  let def;
  try { def = await k.core.get('/forms/defs/' + encodeURIComponent(formKey)); } catch (e) { el.replaceChildren(ui.error(e)); return; }
  el.replaceChildren(h('h3', null, t(def.title, def.title_ml) + ' — ' + person.name));
  if (formKey === 'agri.produce_sale') el.append(h('p', { class: 'small muted' }, t('The price is checked against this week\'s price list.', 'ഈ ആഴ്ചത്തെ വിലപ്പട്ടികയുമായി താരതമ്യം ചെയ്യും.')));
  el.append(ui.formFill(def, {
    person_id: person.id, answers: formKey === 'agri.produce_sale' ? { date: new Date().toISOString().slice(0, 10), unit: 'kg' } : {},
    onDone: (r) => {
      if (r && r.queued) { el.replaceChildren(ui.card({ title: t('Saved on this device', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു'), body: t('It will be sent when the hub is reachable. The price check runs then.', 'ഹബ് കിട്ടുമ്പോൾ അയയ്ക്കും.'), tone: 'warn' })); return; }
      const flags = flagBadges(k, r);
      const msg = r.status === 'closed' ? t('Recorded.', 'രേഖപ്പെടുത്തി.') : t('Sent to the agriculture officer. Advice comes back on a later visit.', 'കൃഷി ഓഫീസർക്ക് അയച്ചു. ഉപദേശം അടുത്ത സന്ദർശനങ്ങളിൽ വരും.');
      k.speak(msg);
      el.replaceChildren(ui.card({ title: '✓ ' + msg, body: h('div', { class: 'row' }, flags), tone: 'good', actions: [ui.button(t('Record another', 'മറ്റൊന്ന്'), () => capture(el, k, formKey, person)), ui.button(t('Done', 'കഴിഞ്ഞു'), () => k.refresh(), { tone: 'ghost' })] }));
    },
  }));
}

function choosePerson(k, onPick) {
  const { h, t, ui } = k;
  const wrap = h('div', { class: 'stack' });
  const input = h('input', { class: 'input', placeholder: t('Search farmer by name', 'കർഷകന്റെ പേര് തിരയുക'), 'aria-label': t('Search farmer by name', 'കർഷകന്റെ പേര് തിരയുക') });
  const list = h('div');
  let timer;
  const run = async () => {
    try {
      const rows = await k.api.get('/people?q=' + encodeURIComponent(input.value || ''));
      list.replaceChildren(ui.table([{ key: 'name', label: t('Name', 'പേര്') }, { key: 'age', label: t('Age', 'വയസ്സ്') }], rows.slice(0, 30), { onRow: onPick, empty: t('Nobody here has given farm-record (livelihood) consent to your agency yet.', 'നിങ്ങളുടെ ഏജൻസിക്ക് ഇതുവരെ ആരും കൃഷി രേഖ സമ്മതം നൽകിയിട്ടില്ല.') }));
    } catch (e) { list.replaceChildren(ui.error(e)); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
  wrap.append(input, list); run();
  return wrap;
}

async function personRecords(el, k, pid) {
  const { h, t, ui } = k;
  const cat = await items(k);
  const r = await k.api.get('/person/' + pid);
  el.append(ui.grid([ui.stat(t('Sales recorded', 'വിൽപ്പന'), r.summary.count), ui.stat(t('Below market', 'വിപണിയിലും താഴെ'), r.summary.below), ui.stat(t('Income recorded', 'രേഖപ്പെടുത്തിയ വരുമാനം'), money(r.summary.income))], 140));
  el.append(ui.section(t('Sales', 'വിൽപ്പന'), r.sales.length ? r.sales.map((s) => saleRow(k, cat, s)) : ui.empty(t('No sales yet.', 'വിൽപ്പന ഇല്ല.'))));
  el.append(ui.section(t('Pest & damage reports', 'കീട / നാശ റിപ്പോർട്ടുകൾ'), r.pests.length ? r.pests.map((s) => pestCard(k, cat, s, { onSeen: async () => { await k.core.post('/forms/submissions/' + s.id + '/seen'); k.refresh(); } })) : ui.empty(t('No reports.', 'റിപ്പോർട്ട് ഇല്ല.'))));
}

// ---------- officer: one report ----------
async function reportDetail(box, k, id, back) {
  const { h, t, ui } = k;
  box.replaceChildren(ui.loading());
  const cat = await items(k);
  const s = await k.api.get('/reports/' + id);
  const a = s.answers || {};
  const it = itemOf(cat, a.crop);
  const approved = await k.api.get('/advisories').catch(() => []);
  const rel = approved.filter((x) => x.crop === a.crop || x.crop === 'all');
  box.replaceChildren(
    ui.button('← ' + t('Back to queue', 'ക്യൂവിലേക്ക്'), back, { tone: 'ghost', small: true }),
    h('h3', null, (PROBLEM_ICON[a.problem] || '') + ' ' + t(it.label, it.label_ml) + ' — ' + (s.person ? s.person.name : '')),
    h('div', { class: 'row' }, flagBadges(k, s)),
    s.photo ? h('img', { class: 'agri-photo', src: s.photo, alt: t('Photo of the damage', 'നാശത്തിന്റെ ഫോട്ടോ') }) : ui.badge(t('No photo', 'ഫോട്ടോ ഇല്ല'), 'warn'),
    ui.kv([[t('Problem', 'പ്രശ്നം'), a.problem + (a.animal ? ' (' + a.animal + ')' : '')], [t('Parts', 'ഭാഗങ്ങൾ'), (a.parts || []).join(', ')], [t('Area', 'വിസ്തൃതി'), a.area], [t('Since', 'മുതൽ'), a.since], [t('Notes', 'കുറിപ്പ്'), a.notes], [t('Hamlet', 'ഊര്'), t(s.hamlet, s.hamlet_ml)], [t('Captured by', 'രേഖപ്പെടുത്തിയത്'), s.captured_by_name], [t('Date', 'തീയതി'), String(s.captured_at).slice(0, 10)]]),
  );
  if (s.reply) box.append(pestCard(k, cat, s));
  if (!s.can_reply) return;
  box.append(ui.section(t('Reply with advice', 'ഉപദേശം നൽകുക'), [
    h('p', { class: 'small muted' }, t('Plain words. No chemical doses — prefer integrated pest management, or ask the family to visit the Krishi Bhavan.', 'ലളിതമായ വാക്കുകൾ. രാസവസ്തുവിന്റെ അളവ് എഴുതരുത്.')),
    ui.form([
      { name: 'reply', label: t('Advice (English)', 'ഉപദേശം (ഇംഗ്ലീഷ്)'), type: 'textarea', required: !rel.length },
      { name: 'reply_ml', label: t('Advice in Malayalam (read to the family)', 'മലയാളത്തിൽ ഉപദേശം'), type: 'textarea' },
      { name: 'advisory_id', label: t('Attach an approved advisory', 'അംഗീകരിച്ച ഉപദേശം ചേർക്കുക'), type: 'select', options: rel.map((x) => ({ value: x.id, label: x.title })) },
      { name: 'outcome', label: t('Outcome', 'ഫലം'), type: 'select', required: true, value: a.problem === 'wild_animals' ? 'refer_forest_dept' : 'advice', options: [{ value: 'advice', label: t('Advice given', 'ഉപദേശം നൽകി') }, { value: 'visit_planned', label: t('Field visit planned', 'സന്ദർശനം') }, { value: 'refer_forest_dept', label: t('Refer to Forest Dept (compensation)', 'വനം വകുപ്പിലേക്ക്') }, { value: 'refer_kvk', label: t('Refer to KVK', 'KVK-യിലേക്ക്') }, { value: 'no_action', label: t('No action needed', 'നടപടി വേണ്ട') }] },
      { name: 'close', label: t('Close after replying', 'മറുപടിക്ക് ശേഷം അവസാനിപ്പിക്കുക'), type: 'checkbox' },
    ], async (v) => { if (!v.advisory_id) delete v.advisory_id; await k.api.post('/reports/' + s.id + '/reply', v); k.toast(t('Advice saved. It reaches the hamlet on the next visit.', 'ഉപദേശം സേവ് ചെയ്തു.'), 'good'); back(); }, { submitLabel: t('Send advice', 'ഉപദേശം അയയ്ക്കുക') }),
  ]));
}

export default {
  views: {
    // ---------- helper / facilitator home ----------
    home: async (el, k) => {
      const { h, t, ui } = k;
      k.style(CSS, 'agri-css');
      el.append(hero(k, '🌾', 'Farm & Forest', 'കൃഷി, വനവിഭവം', 'Record what farmers sold and check the price was fair. Report pests and wild-animal damage with a photo — the agriculture officer replies.', 'വിറ്റതും കിട്ടിയ വിലയും രേഖപ്പെടുത്തുക, ന്യായവിലയാണോ എന്ന് നോക്കുക. കീടവും കാട്ടുമൃഗ നാശവും ഫോട്ടോ സഹിതം അറിയിക്കുക — കൃഷി ഓഫീസർ മറുപടി നൽകും.'));
      const sum = await k.api.get('/summary');
      el.append(ui.grid([ui.stat(t('Farmers with consent', 'സമ്മതം നൽകിയ കർഷകർ'), sum.people), ui.stat(t('Sales this month', 'ഈ മാസം വിൽപ്പന'), sum.sales_this_month, sum.below_market_this_month ? sum.below_market_this_month + ' ' + t('below market', 'വിപണിയിലും താഴെ') : null), ui.stat(t('Pest reports waiting', 'മറുപടി കാത്തിരിക്കുന്നവ'), sum.pests_waiting), ui.stat(t('New advice to pass on', 'അറിയിക്കേണ്ട പുതിയ ഉപദേശം'), sum.replies_new)], 150));
      const work = h('div');
      const act = (e, en, ml, fn) => h('button', { class: 'agri-act', type: 'button', onclick: fn }, h('span', { class: 'e', 'aria-hidden': 'true' }, e), t(en, ml));
      const pickThen = (formKey) => { work.replaceChildren(h('h3', null, t('Who is this for?', 'ആർക്കുവേണ്ടി?')), choosePerson(k, (p) => capture(work, k, formKey, p))); work.scrollIntoView({ behavior: 'smooth' }); };
      if (sum.can_capture) el.append(h('div', { class: 'agri-big' }, act('💰', 'Record a sale', 'വിൽപ്പന രേഖപ്പെടുത്തുക', () => pickThen('agri.produce_sale')), act('🐛', 'Report pest / damage', 'കീടം / നാശം അറിയിക്കുക', () => pickThen('agri.pest_report')), act('📒', 'A farmer\'s records', 'കർഷകന്റെ രേഖകൾ', () => { work.replaceChildren(h('h3', null, t('Whose records?', 'ആരുടെ രേഖകൾ?')), choosePerson(k, async (p) => { work.replaceChildren(h('h3', null, p.name)); await personRecords(work, k, p.id); })); }), sum.can_review ? act('🧑‍🌾', 'Officer desk', 'ഓഫീസർ ഡെസ്ക്', () => k.go('#/m/agri/officer')) : null));
      el.append(work);
      el.append(ui.tabs([
        { id: 'prices', label: '📈 ' + t('This week\'s prices', 'ഈ ആഴ്ചത്തെ വില'), render: (b) => pricesPanel(b, k) },
        { id: 'recent', label: '🕒 ' + t('Recent records', 'പുതിയ രേഖകൾ'), render: async (b) => {
          const cat = await items(k);
          const rows = await k.api.get('/recent?mine=1');
          const sales = rows.filter((s) => s.form_key === 'agri.produce_sale').slice(0, 15);
          const pests = rows.filter((s) => s.form_key === 'agri.pest_report').slice(0, 15);
          b.append(ui.section(t('Pest & damage reports', 'കീട / നാശ റിപ്പോർട്ടുകൾ'), pests.length ? ui.grid(pests.map((s) => pestCard(k, cat, s, { onSeen: async () => { await k.core.post('/forms/submissions/' + s.id + '/seen'); k.refresh(); } })), 280) : ui.empty(t('None yet.', 'ഇതുവരെ ഇല്ല.'))));
          b.append(ui.section(t('Sales', 'വിൽപ്പന'), sales.length ? sales.map((s) => saleRow(k, cat, s)) : ui.empty(t('None yet.', 'ഇതുവരെ ഇല്ല.'))));
        } },
        { id: 'advice', label: '🌱 ' + t('Advice this month', 'ഈ മാസത്തെ ഉപദേശം'), render: (b) => advisoriesForMonth(b, k) },
      ], k.params.tab || 'prices'));
    },

    // ---------- farmer / guardian ----------
    family: async (el, k) => {
      const { h, t, ui } = k;
      k.style(CSS, 'agri-css');
      el.append(hero(k, '🌾', 'My farm', 'എന്റെ കൃഷി', 'What you sold and the price you got, advice from the agriculture officer, and this week\'s prices.', 'നിങ്ങൾ വിറ്റതും കിട്ടിയ വിലയും, കൃഷി ഓഫീസറുടെ ഉപദേശം, ഈ ആഴ്ചത്തെ വില.'));
      const cat = await items(k);
      const my = await k.api.get('/my');
      const tabs = [];
      for (const m of my.members) {
        tabs.push({ id: 'p_' + m.id, label: (m.self ? '🙂 ' + t('Me', 'ഞാൻ') : '👤 ' + m.name.split(' ')[0]), render: async (b) => {
          const s = m.summary;
          const fairTxt = s.count ? t(`${s.fair} of ${s.count} sales at a fair price`, `${s.count} വിൽപ്പനയിൽ ${s.fair} എണ്ണം ന്യായവിലയ്ക്ക്`) : t('No sales recorded yet', 'ഇതുവരെ വിൽപ്പന രേഖയില്ല');
          b.append(h('div', { class: 'row' }, h('b', null, fairTxt), say(k, fairTxt, fairTxt)));
          b.append(ui.grid([ui.stat('💰 ' + t('Sales', 'വിൽപ്പന'), s.count), ui.stat('⚠ ' + t('Below market', 'കുറഞ്ഞ വില'), s.below), ui.stat('₹ ' + t('Income', 'വരുമാനം'), money(s.income))], 120));
          const advice = m.pests.filter((x) => x.reply);
          b.append(ui.section('🧑‍🌾 ' + t('Advice for you', 'നിങ്ങൾക്കുള്ള ഉപദേശം'), m.pests.length ? m.pests.map((x) => pestCard(k, cat, x)) : ui.empty(t('No pest reports.', 'കീട റിപ്പോർട്ട് ഇല്ല.'))));
          if (advice.length) b.append(h('p', { class: 'small muted' }, t('Show this to the facilitator if you need help.', 'സഹായം വേണമെങ്കിൽ ഫെസിലിറ്റേറ്ററെ കാണിക്കുക.')));
          b.append(ui.section('💰 ' + t('What I sold', 'ഞാൻ വിറ്റത്'), m.sales.length ? m.sales.map((x) => saleRow(k, cat, x)) : ui.empty(t('Nothing recorded. The facilitator can record a sale for you at the centre.', 'ഒന്നുമില്ല. സെന്ററിൽ ഫെസിലിറ്റേറ്റർക്ക് രേഖപ്പെടുത്താം.'))));
        } });
      }
      tabs.push({ id: 'advice', label: '🌱 ' + t('This month', 'ഈ മാസം'), render: (b) => advisoriesForMonth(b, k) });
      tabs.push({ id: 'prices', label: '📈 ' + t('Prices', 'വില'), render: (b) => pricesPanel(b, k) });
      el.append(ui.tabs(tabs, tabs[0].id));
    },

    // ---------- agriculture officer ----------
    officer: async (el, k) => {
      const { h, t, ui } = k;
      k.style(CSS, 'agri-css');
      el.append(hero(k, '🧑‍🌾', 'Agriculture officer desk', 'കൃഷി ഓഫീസർ ഡെസ്ക്', 'Answer pest and damage reports from the hamlets, enter weekly prices, and approve advice before families see it.', 'ഊരുകളിൽ നിന്നുള്ള കീട / നാശ റിപ്പോർട്ടുകൾക്ക് മറുപടി, ആഴ്ച വില, ഉപദേശം അംഗീകരിക്കൽ.'));
      const cat = await items(k);
      const queue = async (b) => {
        const rows = await k.api.get('/queue');
        if (!rows.length) { b.append(ui.empty(t('Nothing waiting. 🎉', 'ഒന്നും കാത്തിരിക്കുന്നില്ല. 🎉'))); return; }
        const list = h('div');
        const show = () => {
          list.replaceChildren(...rows.map((s) => {
            const a = s.answers || {}; const it = itemOf(cat, a.crop);
            return h('div', { class: 'agri-q p' + Math.min(2, s.priority || 0), role: 'button', tabindex: '0', onclick: () => reportDetail(list, k, s.id, () => k.refresh()) },
              h('div', { class: 'ph', 'aria-hidden': 'true' }, s.has_photo ? '📷' : (PROBLEM_ICON[a.problem] || '❓')),
              h('div', null, h('b', null, t(it.label, it.label_ml) + ' · ' + a.problem + (a.animal ? ' (' + a.animal + ')' : '')), h('div', { class: 'small muted' }, (s.person ? s.person.name + ' · ' : '') + t(s.hamlet || '', s.hamlet_ml) + ' · ' + String(s.captured_at).slice(0, 10) + ' · ' + t('area', 'വിസ്തൃതി') + ': ' + a.area), h('div', { class: 'row' }, flagBadges(k, s))));
          }));
        };
        show();
        b.append(list);
      };
      const advisories = async (b) => {
        const rows = await k.api.get('/advisories?all=1');
        const drafts = rows.filter((a) => a.status === 'draft');
        b.append(h('p', { class: 'small muted' }, t('Seeded advice is a DRAFT — PENDING REVIEW by Krishi Bhavan / KVK. Only approved advice is shown to families.', 'കരട് ഉപദേശം കൃഷിഭവൻ / KVK അംഗീകരിച്ചാലേ കുടുംബങ്ങൾ കാണൂ.')));
        if (!rows.length) b.append(ui.button(t('Load the draft advice pack', 'കരട് ഉപദേശങ്ങൾ ചേർക്കുക'), async () => { await k.api.post('/advisories/import'); k.refresh(); }, { tone: 'primary' }));
        const approve = async (a) => { if (!(await ui.confirm(t('Approve this advice for families? You confirm it is correct for these hamlets.', 'ഈ ഉപദേശം അംഗീകരിക്കണോ?')))) return; await k.api.post('/advisories/' + a.id + '/approve'); k.toast(t('Approved', 'അംഗീകരിച്ചു'), 'good'); k.refresh(); };
        b.append(ui.section(t('Drafts to review', 'പരിശോധിക്കേണ്ട കരടുകൾ') + ' (' + drafts.length + ')', drafts.map((a) => advisoryCard(k, a, { onApprove: approve }))));
        b.append(ui.section(t('Approved', 'അംഗീകരിച്ചവ'), rows.filter((a) => a.status === 'approved').map((a) => h('div', null, advisoryCard(k, a), ui.button(t('Withdraw approval', 'അംഗീകാരം പിൻവലിക്കുക'), async () => { await k.api.post('/advisories/' + a.id + '/unapprove'); k.refresh(); }, { small: true, tone: 'ghost' })))));
        b.append(ui.section(t('Write new advice', 'പുതിയ ഉപദേശം'), ui.form([
          { name: 'crop', label: t('Crop', 'വിള'), type: 'select', required: true, options: [{ value: 'all', label: t('All crops', 'എല്ലാ വിളകളും') }, ...cat.items.map((i) => ({ value: i.value, label: i.icon + ' ' + i.label }))] },
          { name: 'months', label: t('Months', 'മാസങ്ങൾ'), type: 'multiselect', options: MONTHS_EN.map((m, i) => ({ value: String(i + 1), label: t(m, MONTHS_ML[i]) })) },
          { name: 'title', label: t('Title (English)', 'തലക്കെട്ട് (ഇംഗ്ലീഷ്)'), type: 'text', required: true },
          { name: 'title_ml', label: t('Title (Malayalam)', 'തലക്കെട്ട് (മലയാളം)'), type: 'text' },
          { name: 'body', label: t('Advice (English) — short, plain words', 'ഉപദേശം (ഇംഗ്ലീഷ്)'), type: 'textarea', required: true },
          { name: 'body_ml', label: t('Advice (Malayalam)', 'ഉപദേശം (മലയാളം)'), type: 'textarea' },
        ], async (v) => { await k.api.post('/advisories', v); k.toast(t('Saved as draft', 'കരടായി സേവ് ചെയ്തു'), 'good'); k.refresh(); }, { submitLabel: t('Save draft', 'കരട് സേവ് ചെയ്യുക') })));
      };
      el.append(ui.tabs([
        { id: 'queue', label: '🐛 ' + t('Pest reports', 'കീട റിപ്പോർട്ടുകൾ'), render: queue },
        { id: 'prices', label: '📈 ' + t('Prices', 'വില'), render: async (b) => { await priceEntry(b, k); const cur = k.h('div'); b.append(ui.section(t('Latest prices', 'പുതിയ വില'), cur)); await pricesPanel(cur, k); } },
        { id: 'advice', label: '🌱 ' + t('Advice library', 'ഉപദേശങ്ങൾ'), render: advisories },
        { id: 'impact', label: '📊 ' + t('Overview', 'അവലോകനം'), render: (b) => impact(b, k) },
      ], k.params.tab || 'queue'));
    },

    // ---------- donors / government ----------
    impact: async (el, k) => {
      k.style(CSS, 'agri-css');
      el.append(hero(k, '📊', 'Farm & forest produce', 'കൃഷി, വനവിഭവ കണക്കുകൾ', 'Totals by hamlet and item for the last six months. No names. Small groups are hidden to protect families.', 'കഴിഞ്ഞ ആറ് മാസത്തെ ഊര്, ഇനം തിരിച്ചുള്ള കണക്ക്. പേരുകളില്ല. ചെറിയ കൂട്ടങ്ങൾ മറച്ചിരിക്കുന്നു.'));
      await impact(el, k);
    },
  },
};

async function impact(el, k) {
  const { h, t, ui } = k;
  const r = await k.api.get('/aggregate');
  if (r.prices_note) el.append(h('p', null, h('span', { class: 'agri-demo' }, '⚠ ' + t('Fair-price checks compare with ', 'ന്യായവില താരതമ്യം: ') + r.prices_note)));
  el.append(ui.grid([
    ui.stat(t('Sales recorded', 'രേഖപ്പെടുത്തിയ വിൽപ്പന'), r.totals.sales),
    ui.stat(t('Farmers / gatherers', 'കർഷകർ / ശേഖരിക്കുന്നവർ'), r.totals.sellers),
    ui.stat(t('Sales below market', 'വിപണിയിലും താഴെ വിറ്റത്'), r.totals.below_market_pct === null ? '—' : r.totals.below_market_pct + '%'),
    ui.stat(t('Pest reports answered', 'മറുപടി ലഭിച്ച റിപ്പോർട്ടുകൾ'), r.totals.pest_answered_pct === null ? '—' : r.totals.pest_answered_pct + '%', String(r.totals.pest_reports) + ' ' + t('reports', 'റിപ്പോർട്ടുകൾ')),
  ], 150));
  const vis = r.by_item.filter((x) => !x.suppressed && x.value_inr);
  if (vis.length) el.append(ui.section(t('Value sold by item (₹)', 'ഇനം തിരിച്ച് വിൽപ്പന മൂല്യം (₹)'), ui.bars(vis.slice(0, 12).map((x) => ({ label: (x.icon || '') + ' ' + t(x.item_label, x.item_label_ml), value: x.value_inr })))));
  el.append(ui.section(t('By hamlet and item', 'ഊര്, ഇനം തിരിച്ച്'), ui.table([
    { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (x) => t(x.hamlet, x.hamlet_ml) },
    { key: 'item', label: t('Item', 'ഇനം'), render: (x) => (x.icon || '') + ' ' + t(x.item_label, x.item_label_ml) },
    { key: 'sellers', label: t('Sellers', 'വിറ്റവർ') },
    { key: 'sales', label: t('Sales', 'വിൽപ്പന') },
    { key: 'quantity', label: t('Quantity', 'അളവ്'), render: (x) => (x.quantity === null ? '—' : x.quantity + ' ' + x.unit) },
    { key: 'value', label: '₹', render: (x) => money(x.value_inr) },
    { key: 'below', label: t('Below market', 'കുറഞ്ഞ വില'), render: (x) => (x.below_market_pct === null ? '—' : x.below_market_pct + '%') },
  ], r.by_hamlet_item, { empty: t('No sales recorded yet.', 'വിൽപ്പന രേഖയില്ല.') })));
  el.append(ui.section(t('Pest & damage reports', 'കീട / നാശ റിപ്പോർട്ടുകൾ'), ui.table([
    { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (x) => t(x.hamlet, x.hamlet_ml) },
    { key: 'problem', label: t('Problem', 'പ്രശ്നം'), render: (x) => (PROBLEM_ICON[x.problem] || '') + ' ' + x.problem },
    { key: 'reports', label: t('Reports', 'റിപ്പോർട്ടുകൾ') },
    { key: 'answered', label: t('Answered', 'മറുപടി'), render: (x) => x.answered ?? '—' },
  ], r.pests)));
  el.append(h('p', { class: 'small muted' }, t(`Since ${r.since}. Scope: ${r.scope}. Groups smaller than ${r.k_anon} people are shown as "<${r.k_anon}".`, `${r.since} മുതൽ. ${r.k_anon}-ൽ കുറവ് ആളുകളുള്ള കൂട്ടങ്ങൾ "<${r.k_anon}" ആയി കാണിക്കുന്നു.`)));
}
