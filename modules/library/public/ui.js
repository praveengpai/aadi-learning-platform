// library module UI — learner shelf ("Library / വായനശാല"), browse with big-tile filters, staff assign,
// assignments list, admin status + curation, guardian view. Plain ES module; no DOM access at import time.

const CSS = `
.library-hero{background:linear-gradient(135deg,#7c3f0e,#b5651d);color:#fff;border-radius:18px;padding:16px 18px;margin-bottom:14px}
.library-hero h2{margin:0 0 4px;color:#fff;font-size:1.35rem;display:flex;align-items:center;gap:8px}
.library-hero .library-sub{opacity:.92;font-size:.92rem}
.library-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.library-chip{background:rgba(255,255,255,.18);border-radius:999px;padding:5px 12px;font-size:.88rem}
.library-search{display:flex;gap:8px;margin:10px 0 4px}
.library-search input{flex:1;min-width:0;font-size:1.05rem;padding:12px 14px;border-radius:12px;border:1px solid rgba(0,0,0,.18)}
.library-search button{min-height:48px}
.library-shelf{margin:18px 0 8px}
.library-shelf>h3{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:1.08rem}
.library-list{display:flex;flex-direction:column;gap:10px}
.library-card{display:flex;gap:12px;padding:12px;border-radius:14px;background:var(--card,#fff);border:1px solid rgba(0,0,0,.09);align-items:flex-start}
.library-card.library-done{opacity:.72}
.library-ic{font-size:1.9rem;width:46px;height:46px;flex:0 0 46px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#fdf3e7}
.library-main{flex:1;min-width:0}
.library-title{font-weight:650;line-height:1.3;font-size:1.02rem;word-break:break-word}
.library-star{color:#d97706;margin-right:4px}
.library-meta{font-size:.84rem;opacity:.78;margin-top:3px;line-height:1.4}
.library-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.library-off{background:#dcfce7;color:#14532d;border-radius:999px;padding:2px 9px;font-size:.78rem;font-weight:600}
.library-on{background:#e0f2fe;color:#0c4a6e;border-radius:999px;padding:2px 9px;font-size:.78rem;font-weight:600}
.library-need{font-size:.75rem;opacity:.75}
.library-note{margin-top:6px;padding:7px 10px;border-radius:10px;background:#fff7ed;border-left:4px solid #d97706;font-size:.9rem}
.library-due{font-size:.8rem;font-weight:600;color:#9a3412}
.library-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}
.library-actions .btn,.library-actions a.btn{min-height:42px;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.library-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.library-tile{border-radius:16px;padding:14px 12px;background:#fdf3e7;border:2px solid transparent;cursor:pointer;display:flex;flex-direction:column;gap:6px;min-height:104px;text-align:left;font:inherit;color:inherit}
.library-tile:hover,.library-tile:focus{border-color:#b5651d;outline:none}
.library-tile .library-ti{font-size:1.9rem;line-height:1}
.library-tile .library-tt{font-weight:650;font-size:.95rem;line-height:1.25}
.library-tile .library-tn{font-size:.78rem;opacity:.7;margin-top:auto}
.library-cls{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}
.library-cls button{min-height:64px;border-radius:14px;border:2px solid transparent;background:#fdf3e7;font-size:1.35rem;font-weight:700;cursor:pointer;color:inherit}
.library-cls button small{display:block;font-size:.68rem;font-weight:400;opacity:.7}
.library-cls button:hover{border-color:#b5651d}
.library-crumbs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.library-crumb{border:0;border-radius:999px;padding:6px 12px;background:#7c3f0e;color:#fff;cursor:pointer;font-size:.88rem;min-height:36px}
.library-pills{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.library-pill{border:1px solid rgba(0,0,0,.15);border-radius:999px;padding:6px 12px;background:transparent;cursor:pointer;font-size:.88rem;min-height:36px;color:inherit}
.library-pill.on{background:#b5651d;color:#fff;border-color:#b5651d}
.library-pager{display:flex;gap:8px;align-items:center;justify-content:center;margin:14px 0}
.library-filters{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.library-filters select{padding:8px;border-radius:10px;min-height:40px}
.library-copy{border-left:4px solid #0c4a6e;background:#f0f9ff;padding:10px 12px;border-radius:10px;font-size:.92rem}
@media (prefers-color-scheme: dark){.library-ic,.library-tile,.library-cls button{background:#3a2a1c}.library-note{background:#3a2a1c}.library-copy{background:#0c2a3a}}
@media (max-width:420px){.library-ic{display:none}.library-card{padding:10px}}
`;

const SECTIONS = {
  'School (Class 1–12)': ['🏫', 'സ്കൂൾ (ക്ലാസ് 1–12)'],
  'Exam preparation': ['🎯', 'പരീക്ഷാ പരിശീലനം'],
  'Language and reading': ['🗣️', 'ഭാഷയും വായനയും'],
  'Literacy and equivalency': ['🔤', 'സാക്ഷരതയും തുല്യതയും'],
  'Life skills and digital': ['💡', 'ജീവിത നൈപുണ്യവും ഡിജിറ്റലും'],
  'Counselling and wellbeing': ['💚', 'കൗൺസിലിംഗും ക്ഷേമവും'],
  'Teacher development': ['🧑‍🏫', 'അധ്യാപക പരിശീലനം'],
  Videos: ['🎬', 'വീഡിയോകൾ'],
  Other: ['📦', 'മറ്റുള്ളവ'],
};
const SUBJECT_ML = {
  Mathematics: 'ഗണിതം', Maths: 'ഗണിതം', English: 'ഇംഗ്ലീഷ്', Malayalam: 'മലയാളം', Hindi: 'ഹിന്ദി', Tamil: 'തമിഴ്', Kannada: 'കന്നഡ', 'Basic Science': 'അടിസ്ഥാന ശാസ്ത്രം', Science: 'ശാസ്ത്രം',
  'Social Science': 'സാമൂഹ്യ ശാസ്ത്രം', Physics: 'ഭൗതികശാസ്ത്രം', Chemistry: 'രസതന്ത്രം', Biology: 'ജീവശാസ്ത്രം', ICT: 'വിവരസാങ്കേതികവിദ്യ', EVS: 'പരിസര പഠനം', 'Art Education': 'കലാ വിദ്യാഭ്യാസം',
  'Work Education': 'തൊഴിൽ വിദ്യാഭ്യാസം', 'Physical Education': 'കായിക വിദ്യാഭ്യാസം', 'Health & PE': 'ആരോഗ്യ കായിക വിദ്യാഭ്യാസം', All: 'എല്ലാം', 'All subjects': 'എല്ലാ വിഷയങ്ങളും', Reading: 'വായന', GK: 'പൊതുവിജ്ഞാനം', 'Current affairs': 'ആനുകാലികം',
};
const MEDIUM_ML = { Malayalam: 'മലയാളം', English: 'ഇംഗ്ലീഷ്', Common: 'പൊതു', Tamil: 'തമിഴ്', Kannada: 'കന്നഡ', Hindi: 'ഹിന്ദി' };
const STAFF = ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'];
const ASSIGNERS = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'teacher'];
const CURATORS = ['platform_admin', 'agency_admin', 'teacher'];

const secIcon = (s) => (SECTIONS[s] || SECTIONS.Other)[0];
const secLabel = (k, s) => k.t(s, (SECTIONS[s] || [])[1]);
const subjLabel = (k, s) => k.t(s, SUBJECT_ML[s]);
const medLabel = (k, m) => k.t(m || '—', MEDIUM_ML[m]);
const isStaff = (k) => STAFF.includes(k.user.role);
const fmtDate = (d) => { if (!d) return ''; try { return new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return d; } };
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n ? Math.max(1, Math.round(n / 1024)) + ' KB' : '');

function setup(k) { k.style(CSS, 'library-css'); }

function browseHash(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = qs.toString();
  return '#/m/library/browse' + (s ? '?' + s : '');
}

// ------------------------------------------------------------------ item card
function itemCard(k, it, opts = {}) {
  const { h, t, ui } = k;
  const learner = k.user.role === 'learner';
  const read = it.read || null;
  const clsTxt = it.cls_num ? t('Class ' + it.cls_num, 'ക്ലാസ് ' + it.cls_num) : (it.cls && it.cls !== '-' ? it.cls : '');
  const meta = [clsTxt, it.subject && it.subject !== '-' ? subjLabel(k, it.subject) : '', it.medium ? medLabel(k, it.medium) : '', it.owner].filter(Boolean).join(' · ');
  const open = h('a', {
    class: 'btn primary', href: it.open_url, target: '_blank', rel: 'noopener noreferrer',
    onclick: () => { if (learner) k.api.post(`/items/${it.id}/open`).catch(() => {}); },
  }, it.access === 'offline' ? '📖 ' + t('Open', 'തുറക്കുക') : '↗ ' + t('Open', 'തുറക്കുക'));
  const actions = [open, h('button', { class: 'btn ghost', type: 'button', title: t('Read aloud', 'വായിച്ചുകേൾക്കുക'), 'aria-label': t('Read aloud', 'വായിച്ചുകേൾക്കുക'), onclick: () => k.speak(it.title) }, '🔊')];
  if (learner && !opts.readOnly) {
    if (read && read.finished) actions.push(ui.badge('✓ ' + t('Finished', 'വായിച്ചു തീർന്നു'), 'good'));
    else actions.push(ui.button('✓ ' + t('Mark as finished', 'വായിച്ചു തീർന്നു'), async () => {
      await k.api.post(`/items/${it.id}/progress`, { finished: true });
      k.toast(t('Well done! Book finished.', 'മിടുക്ക്! പുസ്തകം വായിച്ചു തീർത്തു.'), 'good');
      if (opts.onChange) opts.onChange(); else k.refresh();
    }, { tone: 'ghost' }));
  }
  if (opts.extraActions) actions.push(...opts.extraActions(it));
  const tags = [
    it.access === 'offline' ? h('span', { class: 'library-off' }, t('Offline ✓', 'ഓഫ്‌ലൈൻ ✓')) : h('span', { class: 'library-on' }, t('Online ↗', 'ഓൺലൈൻ ↗')),
    it.access === 'online' ? h('span', { class: 'library-need' }, t('needs internet', 'ഇന്റർനെറ്റ് വേണം')) : (it.bytes ? h('span', { class: 'library-need' }, kb(it.bytes)) : null),
    it.audience === 'teacher' ? ui.badge(t('For teachers', 'അധ്യാപകർക്ക്'), 'info') : null,
    it.hidden ? ui.badge(t('Hidden', 'മറച്ചത്'), 'bad') : null,
    it.permission_needed && isStaff(k) ? h('span', { class: 'library-need', title: it.licence }, '© ' + t('link only', 'ലിങ്ക് മാത്രം')) : null,
    read && !read.finished && read.opens ? h('span', { class: 'library-need' }, t('Opened ', 'തുറന്നത് ') + read.opens + '×' + (read.bookmark ? ' · 🔖 ' + read.bookmark : '')) : null,
  ];
  return h('div', { class: 'library-card' + (read && read.finished ? ' library-done' : '') },
    h('div', { class: 'library-ic', 'aria-hidden': 'true' }, secIcon(it.section)),
    h('div', { class: 'library-main' },
      h('div', { class: 'library-title' }, it.featured ? h('span', { class: 'library-star', title: t('Recommended', 'ശുപാർശ ചെയ്തത്') }, '★') : null, it.title),
      meta ? h('div', { class: 'library-meta' }, meta) : null,
      h('div', { class: 'library-tags' }, tags),
      opts.note ? h('div', { class: 'library-note' }, opts.note) : null,
      h('div', { class: 'library-actions' }, actions)));
}

function assignmentCard(k, a, opts = {}) {
  const { h, t } = k;
  const note = [a.note, a.assigned_by_name ? '— ' + a.assigned_by_name : ''].filter(Boolean).join(' ');
  if (!a.item) return h('div', { class: 'library-card' }, h('div', { class: 'library-main' }, h('div', { class: 'library-title' }, a.title), h('div', { class: 'library-meta' }, t('No longer in the catalogue on this server.', 'ഈ സെർവറിലെ പട്ടികയിൽ ഇല്ല.'))));
  const card = itemCard(k, a.item, { ...opts, note: note || null });
  if (a.due) card.querySelector('.library-tags').append(h('span', { class: 'library-due' }, '📅 ' + t('By ', 'അവസാന തീയതി ') + fmtDate(a.due)));
  return card;
}

function shelf(k, icon, title, nodes, empty) {
  const { h } = k;
  return h('section', { class: 'library-shelf' }, h('h3', null, h('span', { 'aria-hidden': 'true' }, icon), title, h('button', { class: 'speak btn ghost small', type: 'button', 'aria-label': k.t('Read aloud', 'വായിച്ചുകേൾക്കുക'), onclick: () => k.speak(title) }, '🔊')),
    nodes && nodes.length ? h('div', { class: 'library-list' }, nodes) : k.ui.empty(empty || k.t('Nothing here yet.', 'ഇവിടെ ഒന്നുമില്ല.')));
}

function searchBar(k, value, onSearch) {
  const { h, t } = k;
  const input = h('input', { type: 'search', value: value || '', placeholder: t('Search books, subjects…', 'പുസ്തകം, വിഷയം തിരയുക…'), 'aria-label': t('Search', 'തിരയുക') });
  return h('form', { class: 'library-search', onsubmit: (e) => { e.preventDefault(); onSearch(input.value.trim()); } }, input, h('button', { class: 'btn primary', type: 'submit' }, '🔍 ' + t('Search', 'തിരയുക')));
}

function sectionTiles(k, sections, onPick) {
  const { h } = k;
  return h('div', { class: 'library-tiles' }, sections.map((s) => h('button', { class: 'library-tile', type: 'button', onclick: () => onPick(s.value) },
    h('span', { class: 'library-ti', 'aria-hidden': 'true' }, secIcon(s.value)), h('span', { class: 'library-tt' }, secLabel(k, s.value)), h('span', { class: 'library-tn' }, s.n + ' ' + k.t('items', 'എണ്ണം')))));
}

// ------------------------------------------------------------------ assign modal (staff)
async function openAssign(k, it) {
  const { h, t, ui } = k;
  const progs = await k.api.get('/programmes');
  const body = h('div', { class: 'stack' });
  const m = ui.modal(t('Assign: ', 'നിയോഗിക്കുക: ') + it.title, body);
  let target = { kind: 'programme', person: null };
  const who = h('div');
  const pills = h('div', { class: 'library-pills' });
  const renderWho = () => {
    pills.replaceChildren(
      h('button', { type: 'button', class: 'library-pill' + (target.kind === 'programme' ? ' on' : ''), onclick: () => { target.kind = 'programme'; renderWho(); } }, '👥 ' + t('A programme', 'ഒരു പരിപാടി')),
      h('button', { type: 'button', class: 'library-pill' + (target.kind === 'person' ? ' on' : ''), onclick: () => { target.kind = 'person'; renderWho(); } }, '🧒 ' + t('One learner', 'ഒരു പഠിതാവ്')));
    if (target.kind === 'programme') { who.replaceChildren(); return; }
    who.replaceChildren(target.person ? h('div', { class: 'row' }, ui.pill('🧒 ' + target.person.name), ui.button(t('Change', 'മാറ്റുക'), () => { target.person = null; renderWho(); }, { small: true, tone: 'ghost' }))
      : ui.personPicker({ onPick: (p) => { target.person = p; renderWho(); } }));
  };
  renderWho();
  const progOpts = progs.map((p) => ({ value: p.id, label: `${p.brand ? p.brand + ' · ' : ''}${k.t(p.title, p.title_ml)} · ${p.hamlet}` }));
  const form = ui.form([
    { name: 'programme_id', label: t('Programme (if assigning to a group)', 'പരിപാടി (ഗ്രൂപ്പിന്)'), type: 'select', options: progOpts },
    { name: 'note', label: t('Note for the learner', 'പഠിതാവിനുള്ള കുറിപ്പ്'), type: 'textarea', placeholder: t('e.g. Read chapter 2 before Friday', 'ഉദാ: വെള്ളിയാഴ്ചയ്ക്കു മുമ്പ് അധ്യായം 2') },
    { name: 'due', label: t('Due date', 'അവസാന തീയതി'), type: 'date' },
  ], async (v) => {
    const payload = { item_id: it.id, note: v.note, due: v.due || null };
    if (target.kind === 'person') { if (!target.person) throw new Error(t('Pick a learner first', 'ആദ്യം പഠിതാവിനെ തിരഞ്ഞെടുക്കുക')); payload.person_id = target.person.id; } else { if (!v.programme_id) throw new Error(t('Pick a programme', 'പരിപാടി തിരഞ്ഞെടുക്കുക')); payload.programme_id = v.programme_id; }
    const r = await k.api.post('/assignments', payload);
    if (r && r.queued) k.toast(t('Saved offline — will send when connected.', 'ഓഫ്‌ലൈനായി സൂക്ഷിച്ചു.'), 'info');
    else k.toast(t('Assigned', 'നിയോഗിച്ചു') + (r && r.notified ? ` · ${r.notified} ` + t('notified', 'പേരെ അറിയിച്ചു') : ''), 'good');
    m.close();
  }, { submitLabel: '📌 ' + t('Assign', 'നിയോഗിക്കുക'), cancel: () => m.close() });
  const progField = form.querySelector('select[name="programme_id"]')?.closest('label');
  const sync = () => { if (progField) progField.style.display = target.kind === 'programme' ? '' : 'none'; };
  pills.addEventListener('click', () => setTimeout(sync, 0));
  sync();
  body.append(pills, who, form);
}

function staffActions(k, after) {
  const { t, ui } = k;
  return (it) => {
    const out = [];
    if (ASSIGNERS.includes(k.user.role) && it.audience === 'learner' && !it.hidden) out.push(ui.button('📌 ' + t('Assign', 'നിയോഗിക്കുക'), () => openAssign(k, it), { tone: 'ghost' }));
    if (CURATORS.includes(k.user.role)) {
      const setS = (status) => async () => { await k.api.post('/curation', { item_id: it.id, status }); k.toast(t('Saved', 'സേവ് ചെയ്തു'), 'good'); after(); };
      out.push(it.featured ? ui.button('☆ ' + t('Unstar', 'നക്ഷത്രം നീക്കുക'), setS('none'), { tone: 'ghost', small: true }) : ui.button('★ ' + t('Feature', 'ശുപാർശ ചെയ്യുക'), setS('featured'), { tone: 'ghost', small: true }));
      out.push(it.hidden ? ui.button('👁 ' + t('Unhide', 'വീണ്ടും കാണിക്കുക'), setS('none'), { tone: 'ghost', small: true })
        : ui.button('🚫 ' + t('Hide', 'മറയ്ക്കുക'), async () => { if (await ui.confirm(t('Hide this item for every learner on the platform?', 'ഈ ഇനം എല്ലാ പഠിതാക്കൾക്കും മറയ്ക്കണോ?'))) await setS('hidden')(); }, { tone: 'danger', small: true }));
    }
    return out;
  };
}

// ------------------------------------------------------------------ views
async function home(el, k) {
  setup(k);
  const { h, t, ui } = k;
  el.append(ui.loading());
  const me = await k.api.get('/me' + (k.params.medium ? '?medium=' + encodeURIComponent(k.params.medium) : ''));
  el.replaceChildren();
  const c = me.counts;
  el.append(h('div', { class: 'library-hero' },
    h('h2', null, '📚 ', t('Library', 'വായനശാല'), h('button', { class: 'btn ghost small', type: 'button', style: { color: '#fff' }, 'aria-label': t('Read aloud', 'വായിച്ചുകേൾക്കുക'), onclick: () => k.speak(t('Library. Your books.', 'വായനശാല. നിന്റെ പുസ്തകങ്ങൾ.')) }, '🔊')),
    h('div', { class: 'library-sub' }, t('Your books, from ', 'നിന്റെ പുസ്തകങ്ങൾ — ') + k.t(k.brand.name, k.brand.name_ml)),
    h('div', { class: 'library-chips' },
      h('span', { class: 'library-chip' }, '📌 ' + c.assigned_open + ' ' + t('to read', 'വായിക്കാൻ')),
      h('span', { class: 'library-chip' }, '📖 ' + c.reading + ' ' + t('reading', 'വായിക്കുന്നു')),
      h('span', { class: 'library-chip' }, '✓ ' + c.finished + ' ' + t('finished', 'തീർന്നു')))));
  el.append(searchBar(k, '', (q) => k.go(browseHash({ q }))));

  const refresh = () => k.refresh();
  el.append(shelf(k, '📌', t('From your teacher', 'ടീച്ചർ തന്നത്'), me.assigned.map((a) => assignmentCard(k, a, { onChange: refresh })), t('No books assigned right now.', 'ഇപ്പോൾ നിയോഗിച്ച പുസ്തകങ്ങളില്ല.')));
  if (me.continue_reading.length) el.append(shelf(k, '🔖', t('Continue reading', 'വായന തുടരാം'), me.continue_reading.map((r) => itemCard(k, { ...r.item, read: r }, { onChange: refresh }))));

  if (me.person.cls_num) {
    const media = [...new Set([me.medium.preferred[0], ...me.medium.available])].filter((m) => m && m !== 'Common');
    const pills = h('div', { class: 'library-pills', role: 'group', 'aria-label': t('Medium', 'മാധ്യമം') }, h('span', { class: 'small muted', style: { alignSelf: 'center' } }, t('Medium:', 'മാധ്യമം:')),
      media.slice(0, 6).map((m) => h('button', { type: 'button', class: 'library-pill' + ((me.medium.chosen || me.medium.preferred[0]) === m ? ' on' : ''), onclick: () => k.go('#/m/library/home' + (m === me.medium.preferred[0] && !me.medium.chosen ? '' : '?medium=' + encodeURIComponent(m))) }, medLabel(k, m))));
    const s = shelf(k, '🏫', t(`My class books — Class ${me.person.cls_num}`, `എന്റെ ക്ലാസ് പുസ്തകങ്ങൾ — ക്ലാസ് ${me.person.cls_num}`), me.textbooks.map((it) => itemCard(k, it, { onChange: refresh })), t('No books for your class in this medium yet.', 'ഈ മാധ്യമത്തിൽ നിന്റെ ക്ലാസിന് പുസ്തകങ്ങളില്ല.'));
    s.insertBefore(pills, s.children[1]);
    el.append(s);
  }
  for (const tr of me.tracks) {
    el.append(shelf(k, secIcon(tr.section), secLabel(k, tr.section), tr.items.map((it) => itemCard(k, it, { onChange: refresh }))));
    if (tr.total > tr.items.length) el.lastChild.append(h('div', { class: 'row', style: { marginTop: '8px' } }, ui.button(t(`See all ${tr.total}`, `എല്ലാം കാണുക (${tr.total})`), () => k.go(browseHash({ section: tr.section })), { tone: 'ghost' })));
  }
  const all = await k.api.get('/browse');
  el.append(h('section', { class: 'library-shelf' }, h('h3', null, '🗂️ ', t('Browse everything', 'എല്ലാം കാണുക')), sectionTiles(k, all.facets.sections, (s) => k.go(browseHash({ section: s })))));
  if (me.source === 'demo') el.append(h('p', { class: 'small muted' }, t('All books here open the official website and need internet.', 'ഇവിടെയുള്ള പുസ്തകങ്ങൾ ഔദ്യോഗിക വെബ്സൈറ്റിൽ തുറക്കും — ഇന്റർനെറ്റ് വേണം.')));
}

async function browse(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const P = { ...k.params };
  const go = (patch) => k.go(browseHash({ ...P, page: undefined, ...patch }));
  const staff = isStaff(k);
  el.append(h('h1', null, '📚 ' + t('Library', 'വായനശാല')));
  el.append(searchBar(k, P.q, (q) => go({ q })));
  const crumbs = h('div', { class: 'library-crumbs' });
  const crumb = (label, clear) => crumbs.append(h('button', { class: 'library-crumb', type: 'button', onclick: () => go(clear), 'aria-label': t('Remove filter', 'ഫിൽട്ടർ നീക്കുക') + ' ' + label }, label + '  ✕'));
  if (P.section) crumb(secIcon(P.section) + ' ' + secLabel(k, P.section), { section: undefined, cls: undefined, subject: undefined });
  if (P.cls) crumb(t('Class ', 'ക്ലാസ് ') + P.cls, { cls: undefined, subject: undefined });
  if (P.subject) crumb(subjLabel(k, P.subject), { subject: undefined });
  if (P.medium) crumb(medLabel(k, P.medium), { medium: undefined });
  if (P.access) crumb(P.access === 'offline' ? t('Offline', 'ഓഫ്‌ലൈൻ') : t('Online', 'ഓൺലൈൻ'), { access: undefined });
  if (P.q) crumb('🔍 ' + P.q, { q: undefined });
  if (P.hidden) crumb(t('Hidden items', 'മറച്ചവ'), { hidden: undefined });
  if (P.audience) crumb(P.audience === 'teacher' ? t('Teacher materials', 'അധ്യാപക സാമഗ്രി') : t('Learner materials', 'പഠിതാക്കൾക്ക്'), { audience: undefined });
  el.append(crumbs);
  const holder = h('div', null, ui.loading());
  el.append(holder);
  const qs = new URLSearchParams(Object.entries(P).filter(([, v]) => v)).toString();
  const r = await k.api.get('/browse' + (qs ? '?' + qs : ''));
  holder.replaceChildren();
  const f = r.facets;

  if (staff || f.media.length > 1) {
    const sel = (name, label, options) => h('select', { 'aria-label': label, onchange: (e) => go({ [name]: e.target.value || undefined }) }, h('option', { value: '' }, label), options.map((o) => h('option', { value: o.value, selected: String(P[name] || '') === String(o.value) }, o.label)));
    holder.append(h('div', { class: 'library-filters' },
      sel('medium', t('Any medium', 'ഏതു മാധ്യമവും'), f.media.map((m) => ({ value: m.value, label: `${medLabel(k, m.value)} (${m.n})` }))),
      sel('access', t('Offline + online', 'ഓഫ്‌ലൈൻ + ഓൺലൈൻ'), [{ value: 'offline', label: t('Offline only', 'ഓഫ്‌ലൈൻ മാത്രം') }, { value: 'online', label: t('Online only', 'ഓൺലൈൻ മാത്രം') }]),
      staff ? sel('audience', t('Learner + teacher', 'പഠിതാവ് + അധ്യാപകൻ'), [{ value: 'learner', label: t('Learner materials', 'പഠിതാക്കൾക്ക്') }, { value: 'teacher', label: t('Teacher materials', 'അധ്യാപക സാമഗ്രി') }]) : null));
  }

  // Step 1: section tiles
  if (!P.section && !P.q && !P.hidden && !P.subject) {
    holder.append(sectionTiles(k, f.sections, (s) => go({ section: s })));
    return;
  }
  // Step 2: class tiles (school section)
  if (P.section && !P.cls && !P.q && !P.all && f.classes.length > 1 && /School/.test(P.section)) {
    holder.append(h('h3', null, t('Choose your class', 'ക്ലാസ് തിരഞ്ഞെടുക്കുക')),
      h('div', { class: 'library-cls' }, f.classes.map((c) => h('button', { type: 'button', onclick: () => go({ cls: c.value }), 'aria-label': t('Class ', 'ക്ലാസ് ') + c.value }, c.value, h('small', null, c.n + ' ' + t('items', 'എണ്ണം'))))),
      h('div', { class: 'row', style: { marginTop: '10px' } }, ui.button(t('Show all classes', 'എല്ലാ ക്ലാസുകളും'), () => go({ all: '1' }), { tone: 'ghost' })));
    return;
  }
  // Step 3: subject pills
  if (!P.subject && f.subjects.length > 1) {
    holder.append(h('div', { class: 'library-pills' }, h('span', { class: 'small muted', style: { alignSelf: 'center' } }, t('Subject:', 'വിഷയം:')),
      f.subjects.slice(0, 24).map((s) => h('button', { type: 'button', class: 'library-pill', onclick: () => go({ subject: s.value }) }, `${subjLabel(k, s.value)} (${s.n})`))));
  }
  holder.append(h('p', { class: 'small muted' }, `${r.total} ` + t('items', 'ഇനങ്ങൾ') + (r.pages > 1 ? ` · ${t('page', 'പേജ്')} ${r.page}/${r.pages}` : '')));
  const after = () => k.refresh();
  holder.append(r.items.length ? h('div', { class: 'library-list' }, r.items.map((it) => itemCard(k, it, { onChange: after, extraActions: staff ? staffActions(k, after) : null })))
    : ui.empty(t('Nothing matches. Try fewer filters.', 'ഒന്നും കിട്ടിയില്ല. ഫിൽട്ടറുകൾ കുറയ്ക്കൂ.')));
  if (r.pages > 1) {
    holder.append(h('div', { class: 'library-pager' },
      r.page > 1 ? ui.button('‹ ' + t('Back', 'മുമ്പ്'), () => k.go(browseHash({ ...P, page: r.page - 1 })), { tone: 'ghost' }) : null,
      h('span', null, `${r.page} / ${r.pages}`),
      r.page < r.pages ? ui.button(t('More', 'അടുത്തത്') + ' ›', () => k.go(browseHash({ ...P, page: r.page + 1 })), { tone: 'ghost' }) : null));
  }
}

async function assignments(el, k) {
  setup(k);
  const { h, t, ui } = k;
  el.append(h('div', { class: 'row' }, h('h1', { style: { flex: 1, margin: 0 } }, '📌 ' + t('Reading assignments', 'വായനാ നിയോഗങ്ങൾ')),
    ui.button('📚 ' + t('Find a book to assign', 'നിയോഗിക്കാൻ പുസ്തകം തിരയുക'), () => k.go('#/m/library/browse'), { tone: 'primary' })));
  const rows = await k.api.get('/assignments');
  el.append(h('p', { class: 'small muted' }, t('Your agency\'s assignments. Learners get a message on their phone; progress counts only learners you are allowed to see.', 'നിങ്ങളുടെ ഏജൻസിയുടെ നിയോഗങ്ങൾ. കാണാൻ അനുമതിയുള്ള പഠിതാക്കളെ മാത്രം കണക്കാക്കുന്നു.')));
  el.append(ui.table([
    { key: 'title', label: t('Book', 'പുസ്തകം'), render: (a) => h('div', null, h('div', { style: { fontWeight: 600 } }, a.title), h('div', { class: 'small muted' }, secLabel(k, a.section)), a.note ? h('div', { class: 'small' }, '“' + a.note + '”') : null) },
    { key: 'to', label: t('For', 'ആർക്ക്'), render: (a) => a.programme ? '👥 ' + (a.programme.brand ? a.programme.brand + ' · ' : '') + k.t(a.programme.title, a.programme.title_ml) : '🧒 ' + ((a.person && a.person.name) || '—') },
    { key: 'due', label: t('Due', 'തീയതി'), render: (a) => (a.due ? fmtDate(a.due) : '—') },
    { key: 'p', label: t('Finished', 'തീർത്തവർ'), render: (a) => (a.progress && a.progress.learners ? `${a.progress.finished}/${a.progress.learners}` + (a.progress.opened ? ` · ${t('opened', 'തുറന്നു')} ${a.progress.opened}` : '') : '—') },
    { key: 'by', label: t('By', 'നൽകിയത്'), render: (a) => h('span', { class: 'small' }, a.assigned_by_name || '—') },
    { key: 'x', label: '', render: (a) => h('div', { class: 'row' },
      a.item ? h('a', { class: 'btn ghost small', href: a.item.open_url, target: '_blank', rel: 'noopener noreferrer' }, '↗') : null,
      ui.button(t('Withdraw', 'പിൻവലിക്കുക'), async () => { if (!(await ui.confirm(t('Withdraw this assignment?', 'ഈ നിയോഗം പിൻവലിക്കണോ?')))) return; await k.api.del('/assignments/' + a.id); k.toast(t('Withdrawn', 'പിൻവലിച്ചു'), 'good'); k.refresh(); }, { small: true, tone: 'danger' })) },
  ], rows, { empty: t('No assignments yet. Open the Library, find a book and press Assign.', 'നിയോഗങ്ങളില്ല. വായനശാലയിൽ പുസ്തകം കണ്ടെത്തി "നിയോഗിക്കുക" അമർത്തുക.') }));
}

async function status(el, k) {
  setup(k);
  const { h, t, ui } = k;
  el.append(h('h1', null, '🗂️ ' + t('Library status', 'വായനശാല നില')));
  const s = await k.api.get('/status');
  el.append(ui.grid([
    ui.stat(t('Catalogue source', 'പട്ടികയുടെ ഉറവിടം'), s.source === 'server' ? t('Server folder', 'സെർവർ ഫോൾഡർ') : t('Demo catalogue', 'ഡെമോ പട്ടിക'), s.built ? t('built ', 'തയ്യാറാക്കിയത് ') + s.built : null),
    ui.stat(t('Items', 'ഇനങ്ങൾ'), s.totals.items, `${s.totals.teacher} ` + t('for teachers', 'അധ്യാപകർക്ക്')),
    ui.stat(t('Offline on this server', 'ഈ സെർവറിൽ ഓഫ്‌ലൈൻ'), s.totals.offline, s.totals.offline_bytes ? kb(s.totals.offline_bytes) : null),
    ui.stat(t('Online links', 'ഓൺലൈൻ ലിങ്കുകൾ'), s.totals.online, t('need internet', 'ഇന്റർനെറ്റ് വേണം')),
    ui.stat(t('Permission needed', 'അനുമതി വേണ്ടവ'), s.permission_needed, t('© licence COPYRIGHTED / MANUAL', '© പകർപ്പവകാശം')),
    ui.stat(t('Hidden / featured', 'മറച്ചത് / ശുപാർശ'), `${s.hidden} / ${s.featured}`),
    ui.stat(t('Books opened (30 days)', 'തുറന്നവ (30 ദിവസം)'), s.reads_30d),
    ui.stat(t('Assignments', 'നിയോഗങ്ങൾ'), s.assignments),
  ], 160));
  if (s.error) el.append(ui.card({ tone: 'warn', title: t('Catalogue note', 'പട്ടിക കുറിപ്പ്'), body: s.error }));
  el.append(h('div', { class: 'library-copy', style: { margin: '12px 0' } },
    h('b', null, '© ' + t('Copyright', 'പകർപ്പവകാശം') + ': '),
    t('Online items link to the owner\'s own official page — we do not copy them. Only openly licensed or government-free materials are kept as offline files on the centre server. Items marked COPYRIGHTED or MANUAL need the owner\'s permission before anyone copies them for offline use.',
      'ഓൺലൈൻ ഇനങ്ങൾ ഉടമയുടെ ഔദ്യോഗിക പേജിലേക്കാണ് ലിങ്ക് ചെയ്യുന്നത് — നാം പകർത്തുന്നില്ല. തുറന്ന ലൈസൻസുള്ളതോ സർക്കാർ സൗജന്യമോ ആയവ മാത്രമേ ഓഫ്‌ലൈൻ ഫയലായി സൂക്ഷിക്കൂ. COPYRIGHTED / MANUAL ഇനങ്ങൾ പകർത്താൻ ഉടമയുടെ അനുമതി വേണം.')));
  el.append(ui.section(t('By section', 'വിഭാഗം തിരിച്ച്'), ui.table([
    { key: 'section', label: t('Section', 'വിഭാഗം'), render: (r) => h('a', { href: browseHash({ section: r.section }) }, secIcon(r.section) + ' ' + secLabel(k, r.section)) },
    { key: 'total', label: t('Total', 'ആകെ') }, { key: 'offline', label: t('Offline', 'ഓഫ്‌ലൈൻ') }, { key: 'online', label: t('Online', 'ഓൺലൈൻ') }, { key: 'teacher', label: t('Teacher', 'അധ്യാപക') },
  ], s.by_section)));
  el.append(ui.section(t('Licences', 'ലൈസൻസുകൾ'), ui.bars(s.by_licence.map((l) => ({ label: l.licence, value: l.n })))));
  const cur = await k.api.get('/curation');
  el.append(ui.section(t('Curation', 'തിരഞ്ഞെടുപ്പ്'), h('div', null,
    h('div', { class: 'row', style: { marginBottom: '8px' } }, ui.button(t('Browse hidden items', 'മറച്ചവ കാണുക'), () => k.go(browseHash({ hidden: '1' })), { tone: 'ghost', small: true }), ui.button(t('Browse the library', 'വായനശാല കാണുക'), () => k.go('#/m/library/browse'), { tone: 'ghost', small: true })),
    ui.table([
      { key: 'status', label: t('Status', 'നില'), render: (c) => (c.status === 'hidden' ? ui.badge(t('Hidden', 'മറച്ചത്'), 'bad') : ui.badge('★ ' + t('Featured', 'ശുപാർശ'), 'good')) },
      { key: 'title', label: t('Item', 'ഇനം'), render: (c) => (c.item ? c.item.title : c.item_id) },
      { key: 'note', label: t('Note', 'കുറിപ്പ്'), render: (c) => c.note || '—' },
      { key: 'by', label: t('By', 'ചെയ്തത്'), render: (c) => h('span', { class: 'small' }, (c.by_name || '') + ' · ' + fmtDate(c.at)) },
      { key: 'x', label: '', render: (c) => ui.button(t('Clear', 'നീക്കുക'), async () => { await k.api.post('/curation', { item_id: c.item_id, status: 'none' }); k.refresh(); }, { small: true, tone: 'ghost' }) },
    ], cur, { empty: t('Nothing hidden or featured yet. Use Feature / Hide on any item in the Library.', 'ഒന്നും മറച്ചിട്ടില്ല.') }))));
}

async function child(el, k) {
  setup(k);
  const { h, t, ui } = k;
  el.append(h('h1', null, '📗 ' + t("Child's books", 'കുട്ടിയുടെ പുസ്തകങ്ങൾ')));
  const kids = await k.api.get('/children');
  if (!kids.length) { el.append(ui.empty(t('No children linked to your account.', 'നിങ്ങളുടെ അക്കൗണ്ടിൽ കുട്ടികളില്ല.'))); return; }
  const pid = k.params.pid && kids.some((c) => c.id === k.params.pid) ? k.params.pid : kids[0].id;
  if (kids.length > 1) el.append(h('div', { class: 'library-pills' }, kids.map((c) => h('button', { type: 'button', class: 'library-pill' + (c.id === pid ? ' on' : ''), onclick: () => k.go('#/m/library/child?pid=' + c.id) }, '🧒 ' + c.name))));
  const d = await k.api.get('/child/' + pid);
  el.append(h('div', { class: 'library-hero' }, h('h2', null, '🧒 ' + d.child.name), h('div', { class: 'library-chips' },
    h('span', { class: 'library-chip' }, '📌 ' + d.counts.assigned + ' ' + t('assigned', 'നിയോഗിച്ചത്')),
    h('span', { class: 'library-chip' }, '📖 ' + d.counts.opened + ' ' + t('opened', 'തുറന്നത്')),
    h('span', { class: 'library-chip' }, '✓ ' + d.counts.finished + ' ' + t('finished', 'തീർത്തത്')))));
  el.append(shelf(k, '📌', t('Books from the teacher', 'ടീച്ചർ നൽകിയ പുസ്തകങ്ങൾ'), d.assigned.map((a) => assignmentCard(k, a, { readOnly: true })), t('Nothing assigned right now.', 'ഇപ്പോൾ ഒന്നുമില്ല.')));
  el.append(shelf(k, '🔖', t('Recently read', 'അടുത്തിടെ വായിച്ചത്'), d.recent.map((r) => (r.item ? itemCard(k, { ...r.item, read: r }, { readOnly: true })
    : h('div', { class: 'library-card' }, h('div', { class: 'library-main' }, h('div', { class: 'library-title' }, r.title), h('div', { class: 'library-meta' }, r.finished ? '✓ ' + t('Finished', 'തീർത്തു') : t('Reading', 'വായിക്കുന്നു')))))),
  t('No reading yet.', 'ഇതുവരെ വായനയില്ല.')));
  el.append(h('p', { class: 'small muted' }, t('Encourage your child: ask them to tell you one thing they read today.', 'ഇന്ന് വായിച്ച ഒരു കാര്യം പറയാൻ കുട്ടിയോട് ചോദിക്കൂ.')));
}

async function item(el, k) {
  setup(k);
  const { h, t, ui } = k;
  if (!k.params.id) { el.append(ui.empty(t('No book chosen.', 'പുസ്തകം തിരഞ്ഞെടുത്തിട്ടില്ല.'))); return; }
  let it;
  try { it = await k.api.get('/items/' + encodeURIComponent(k.params.id)); }
  catch (e) { el.append(ui.empty(t('This item is no longer in the library on this server.', 'ഈ ഇനം ഇപ്പോൾ വായനശാലയിൽ ഇല്ല.'))); return; }
  el.append(h('h1', null, '📖 ' + t('Library', 'വായനശാല')));
  el.append(itemCard(k, it, { onChange: () => k.refresh() }));
  (it.assignments || []).forEach((a) => el.append(h('p', { class: 'small muted' }, '📌 ' + (a.assigned_by_name || '') + (a.note ? ' — ' + a.note : '') + (a.due ? ' · ' + t('due', 'അവസാന തീയതി') + ' ' + a.due : ''))));
  el.append(h('div', { class: 'row', style: { marginTop: '12px' } }, ui.button('← ' + t('Back to Library', 'വായനശാലയിലേക്ക്'), () => k.go('#/m/library/home'), { tone: 'ghost' })));
}

export default { views: { home, browse, assignments, status, child, item } };
