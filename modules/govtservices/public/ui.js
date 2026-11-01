// Government Services & Schemes — a mobile Akshaya desk. Plain ES module; no DOM work at import time.
// Views: home (helper), board (applications), office (department queue), family, aggregate.

const CSS = `
.gs-hero{background:linear-gradient(135deg,#1d4e89 0%,#2a6fb0 70%,#3d8fd1 100%);color:#fff;border-radius:var(--r-l,14px);padding:16px 18px;margin-bottom:14px;position:relative}
.gs-hero h2{color:#fff;margin:0 0 4px}
.gs-hero p{margin:0;opacity:.92;max-width:60ch}
.gs-hero .speak{position:absolute;top:10px;right:10px}
.gs-review{background:var(--warn-bg,#fff4e0);color:var(--warn,#8a5a00);border-radius:8px;padding:8px 10px;font-size:.85rem;margin:8px 0 12px}
.gs-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gs-between{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.gs-person{border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;padding:12px;cursor:pointer;display:flex;gap:10px;align-items:center;min-height:64px}
.gs-person:hover{border-color:#2a6fb0}
.gs-ava{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:1.5rem;background:#e7eef7;flex:none}
.gs-sug{border:1px solid var(--line,#ddd);border-left:6px solid #2a6fb0;border-radius:10px;background:#fff;padding:12px;margin-bottom:10px}
.gs-sug.ask{border-left-color:#c9a227}
.gs-sug.done{border-left-color:var(--good,#2e7d32);opacity:.85}
.gs-doc{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 10px;margin:3px 4px 0 0;border:1px solid var(--line,#ddd);background:#fff;font-size:.85rem}
.gs-doc.have,.gs-doc.received{background:var(--good-bg,#e8f5e9);border-color:var(--good,#2e7d32)}
.gs-doc.missing{background:var(--bad-bg,#fdecea);border-color:var(--bad,#b00020)}
.gs-doc.applied{background:var(--info-bg,#e3f2fd);border-color:var(--info,#1565c0)}
.gs-docrow{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px dashed var(--line,#ddd);flex-wrap:wrap}
.gs-seg{display:inline-flex;border:1px solid var(--line,#ddd);border-radius:999px;overflow:hidden}
.gs-seg button{border:0;background:#fff;padding:8px 10px;min-height:40px;cursor:pointer;font-size:.8rem}
.gs-seg button.on{background:#1d4e89;color:#fff;font-weight:700}
.gs-col{background:var(--paper,#f6f7f5);border-radius:12px;padding:10px;min-width:0}
.gs-col h4{margin:0 0 8px;display:flex;justify-content:space-between}
.gs-app{background:#fff;border:1px solid var(--line,#ddd);border-radius:10px;padding:10px;margin-bottom:8px;cursor:pointer}
.gs-app:hover{border-color:#2a6fb0}
.gs-tl{list-style:none;margin:8px 0 0;padding:0}
.gs-tl li{position:relative;padding:0 0 14px 40px}
.gs-tl li::before{content:"";position:absolute;left:15px;top:30px;bottom:0;width:2px;background:var(--line,#ddd)}
.gs-tl li:last-child::before{display:none}
.gs-tl .dot{position:absolute;left:0;top:0;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#e7eef7;font-size:1rem}
.gs-tl li.current .dot{background:var(--warn-bg,#fff4e0);outline:2px dashed #c9a227}
.gs-tl b{display:block}
.gs-big{font-size:1.15rem;line-height:1.5}
.gs-heat{width:100%;border-collapse:separate;border-spacing:3px;font-size:.85rem}
.gs-heat th{text-align:left;padding:4px;color:var(--ink-2,#555);font-weight:600}
.gs-heat td{background:var(--paper,#f6f7f5);border-radius:6px;padding:6px;text-align:center;min-width:44px}
.gs-scroll{overflow-x:auto;max-width:100%}
@media (max-width:560px){.gs-hide-sm{display:none}}
`;

const ORDER = ['submitted', 'in_review', 'submitted_to_office', 'need_more_documents', 'approved', 'certificate_ready', 'rejected'];
const STAGE_TXT = {
  submitted: ['📨', 'Waiting at the office desk', 'ഓഫീസ് ഡെസ്കിൽ കാത്തിരിക്കുന്നു'],
  in_review: ['🔎', 'Officer is checking', 'ഉദ്യോഗസ്ഥൻ പരിശോധിക്കുന്നു'],
  submitted_to_office: ['📤', 'Sent to the office', 'ഓഫീസിൽ നൽകി'],
  need_more_documents: ['📎', 'More papers needed', 'കൂടുതൽ രേഖകൾ വേണം'],
  approved: ['✅', 'Approved', 'അംഗീകരിച്ചു'],
  certificate_ready: ['🎉', 'Ready to collect', 'വാങ്ങാൻ തയ്യാർ'],
  rejected: ['❌', 'Not approved', 'അംഗീകരിച്ചില്ല'],
};
const DOC_ST = { have: ['✔', 'Have', 'ഉണ്ട്'], missing: ['✖', 'Missing', 'ഇല്ല'], applied: ['⏳', 'Applied', 'അപേക്ഷിച്ചു'], received: ['📥', 'Received', 'കിട്ടി'] };
const tone = (stage) => ({ approved: 'good', certificate_ready: 'good', rejected: 'bad', need_more_documents: 'warn' }[stage] || 'info');

let catCache = null;
async function catalogue(k) { if (!catCache) catCache = await k.api.get('/catalogue'); return catCache; }
const setup = (k) => k.style(CSS, 'govtservices-css');
const say = (k, en, ml) => (k.ui.speakBtn ? k.ui.speakBtn(k.lang === 'ml' && ml ? ml : en, k.lang === 'ml' && ml ? 'ml' : 'en') : k.h('button', { class: 'speak', type: 'button', onclick: () => k.speak(k.lang === 'ml' && ml ? ml : en) }, '🔊'));
const fmt = (s, k) => (s ? new Date(s).toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short' }) : '');
function hero(k, en, ml, pEn, pMl) {
  return k.h('div', { class: 'gs-hero' }, say(k, `${en}. ${pEn}`, `${ml}. ${pMl}`), k.h('h2', null, k.t(en, ml)), k.h('p', null, k.t(pEn, pMl)));
}
function reviewNote(k, cat) {
  return k.h('div', { class: 'gs-review', role: 'note' }, '⚠️ ', k.t(cat.status, cat.status_ml), ' — ', k.t(cat.disclaimer, cat.disclaimer_ml));
}
function stageBadge(k, a) {
  const s = STAGE_TXT[a.stage] || ['•', a.stage_label || a.stage, a.stage_label_ml || a.stage];
  return k.ui.badge(`${s[0]} ${k.t(s[1], s[2])}`, tone(a.stage));
}
function personAvatar(p) { return p.age >= 60 ? (p.gender === 'F' ? '👵' : '👴') : p.kind === 'child' ? (p.gender === 'F' ? '👧' : '👦') : p.gender === 'F' ? '👩' : '👨'; }

// Plain status timeline, read-aloud on every step.
function timelineEl(k, steps) {
  const { h } = k;
  return h('ol', { class: 'gs-tl' }, steps.map((s) => h('li', { class: s.current ? 'current' : '' },
    h('span', { class: 'dot', 'aria-hidden': 'true' }, s.icon || '•'),
    h('div', { class: 'gs-between' }, h('div', null, h('b', null, k.t(s.label, s.label_ml)), h('span', { class: 'small muted' }, s.at ? fmt(s.at, k) : k.t('now', 'ഇപ്പോൾ'))), say(k, `${s.label}. ${s.plain || ''} ${s.note || ''}`, `${s.label_ml}. ${s.plain_ml || ''} ${s.note_ml || ''}`)),
    h('div', { class: 'small' }, k.t(s.plain, s.plain_ml)),
    s.note ? h('div', { class: 'small muted' }, '“', k.t(s.note, s.note_ml || s.note), '”') : null)));
}

// =====================================================================
// HOME — helper: hamlet → people → suggestions + missing documents → application
// =====================================================================
async function home(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const cat = await catalogue(k);
  el.append(hero(k, 'Scheme help desk', 'പദ്ധതി സഹായ ഡെസ്ക്',
    'Check each family\'s documents, see which schemes they may be eligible for, and fill applications offline. Staff in the city take them to the office and send the status back.',
    'ഓരോ കുടുംബത്തിന്റെയും രേഖകൾ പരിശോധിക്കുക, യോഗ്യതയുണ്ടാകാവുന്ന പദ്ധതികൾ കാണുക, ഓഫ്‌ലൈനായി അപേക്ഷ പൂരിപ്പിക്കുക. നഗരത്തിലെ ജീവനക്കാർ ഓഫീസിൽ എത്തിച്ച് വിവരം തിരികെ അയയ്ക്കും.'));
  el.append(reviewNote(k, cat));
  if (k.params.person) { await personView(el, k, k.params.person); return; }
  const hs = await k.api.get('/hamlets');
  if (!hs.length) { el.append(ui.empty(t('No hamlets assigned to you.', 'നിങ്ങൾക്ക് ഊരുകൾ നൽകിയിട്ടില്ല.'))); return; }
  const list = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '10px' } });
  const q = h('input', { class: 'input', placeholder: t('Search by name', 'പേര് തിരയുക'), style: { maxWidth: '260px' } });
  let people = [];
  const draw = () => {
    const f = q.value.trim().toLowerCase();
    const rows = people.filter((p) => !f || p.name.toLowerCase().includes(f));
    list.replaceChildren(...(rows.length ? rows.map((p) => h('div', { class: 'gs-person', role: 'button', tabindex: 0, onclick: () => k.go(`#/m/govtservices/home?person=${p.id}`), onkeydown: (e) => { if (e.key === 'Enter') k.go(`#/m/govtservices/home?person=${p.id}`); } },
      h('div', { class: 'gs-ava', 'aria-hidden': 'true' }, personAvatar(p)),
      h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, p.name), h('div', { class: 'small muted' }, [p.age != null ? t(`${p.age} yrs`, `${p.age} വയസ്സ്`) : null, p.school_class ? t(`Class ${p.school_class}`, `ക്ലാസ് ${p.school_class}`) : null].filter(Boolean).join(' · ')),
        h('div', { class: 'gs-row small', style: { marginTop: '4px' } },
          p.suggestions ? ui.badge(`💡 ${p.suggestions}`, 'info') : null,
          p.docs_missing ? ui.badge(`✖ ${p.docs_missing} ${t('missing', 'ഇല്ല')}`, 'warn') : null,
          p.open_applications ? ui.badge(`🗂️ ${p.open_applications} ${t('open', 'തുറന്നവ')}`, 'good') : null,
          !p.docs_checked ? ui.badge(t('Not checked yet', 'ഇതുവരെ നോക്കിയിട്ടില്ല'), 'info') : null))))
      : [ui.empty(t('No one here has given "services" consent to your agency yet.', 'ഇവിടെ ആരും നിങ്ങളുടെ ഏജൻസിക്ക് "സേവന" സമ്മതം നൽകിയിട്ടില്ല.'))]));
  };
  const load = async (hid) => {
    const hm = hs.find((x) => x.id === hid);
    if (hm && !hm.enabled) { list.replaceChildren(ui.card({ tone: 'warn', title: t('Switched off here', 'ഇവിടെ ഓഫാണ്'), body: t('The Oorukoottam has switched this service off in this hamlet.', 'ഈ ഊരിൽ ഊരുകൂട്ടം ഈ സേവനം ഓഫാക്കിയിട്ടുണ്ട്.') })); return; }
    list.replaceChildren(ui.loading());
    try { people = await k.api.get('/people?hamlet_id=' + hid); draw(); } catch (e) { list.replaceChildren(ui.error(e)); }
  };
  const sel = h('select', { class: 'input', style: { maxWidth: '320px' }, onchange: () => load(sel.value) }, hs.map((x) => h('option', { value: x.id }, t(x.name, x.name_ml) + (x.enabled ? '' : ' (off)'))));
  q.addEventListener('input', draw);
  el.append(h('div', { class: 'gs-row', style: { marginBottom: '10px' } }, h('b', null, '📍 ', t('Hamlet', 'ഊര്')), sel, q,
    ui.button(t('Applications board', 'അപേക്ഷാ ബോർഡ്'), () => k.go('#/m/govtservices/board'), { tone: 'ghost', small: true })), list);
  load(hs[0].id);
}

async function personView(el, k, pid) {
  const { h, t, ui } = k;
  let data;
  try { data = await k.api.get('/suggest/' + pid); } catch (e) { el.append(ui.error(e)); return; }
  const p = data.person;
  el.append(h('div', { class: 'gs-row', style: { marginBottom: '8px' } }, ui.button('← ' + t('Back', 'തിരികെ'), () => k.go('#/m/govtservices/home'), { tone: 'ghost', small: true }),
    h('div', { class: 'gs-ava', 'aria-hidden': 'true' }, personAvatar(p)), h('h3', { style: { margin: 0, flex: 1 } }, p.name, h('span', { class: 'small muted' }, ' · ', p.age != null ? t(`${p.age} yrs`, `${p.age} വയസ്സ്`) : '', p.school_class ? ' · ' + t(`Class ${p.school_class}`, `ക്ലാസ് ${p.school_class}`) : ''))));
  const tabs = [
    { id: 'sug', label: '💡 ' + t('May be eligible', 'യോഗ്യത ഉണ്ടാകാം'), render: (box) => suggestionsTab(box, k, data) },
    { id: 'docs', label: '📂 ' + t('Documents', 'രേഖകൾ'), render: (box) => docsTab(box, k, data) },
    { id: 'apps', label: '🗂️ ' + t('Applications', 'അപേക്ഷകൾ'), render: (box) => appsOf(box, k, pid) },
  ];
  if (k.params.scheme) tabs.unshift({ id: 'apply', label: '📝 ' + t('Apply', 'അപേക്ഷ'), render: (box) => applyTab(box, k, data, k.params.scheme) });
  el.append(ui.tabs(tabs, k.params.scheme ? 'apply' : (k.params.tab || 'sug')));
}

function suggestionsTab(box, k, data) {
  const { h, t, ui } = k;
  if (data.missing_documents.length) {
    const txtEn = 'Bring these papers next visit: ' + data.missing_documents.map((d) => d.label).join(', ');
    const txtMl = 'അടുത്ത സന്ദർശനത്തിൽ ഈ രേഖകൾ കൊണ്ടുവരിക: ' + data.missing_documents.map((d) => d.label_ml).join(', ');
    box.append(ui.card({ tone: 'warn', title: h('span', null, '🎒 ', t('Papers to bring next visit', 'അടുത്ത തവണ കൊണ്ടുവരേണ്ട രേഖകൾ'), ' ', say(k, txtEn, txtMl)),
      body: h('div', null, data.missing_documents.map((d) => h('span', { class: 'gs-doc missing' }, d.icon || '📄', ' ', t(d.label, d.label_ml), d.for.length > 1 ? h('span', { class: 'muted' }, ` ×${d.for.length}`) : null))) }));
  }
  if (!data.suggestions.length) { box.append(ui.empty(t('No suggestions — the family seems to have what they need. 🎉', 'നിർദേശങ്ങളില്ല — ആവശ്യമുള്ളതെല്ലാം ഉണ്ടെന്ന് തോന്നുന്നു. 🎉'))); return; }
  for (const s of data.suggestions) {
    const cls = 'gs-sug' + (s.confidence === 'ask' ? ' ask' : '') + (s.state !== 'suggest' ? ' done' : '');
    const readEn = `${s.title}. ${s.reason}. ${s.missing.length ? 'Missing: ' + s.missing.map((m) => m.label).join(', ') : 'All papers ready.'} Where: ${s.where}.`;
    const readMl = `${s.title_ml}. ${s.reason_ml}. ${s.missing.length ? 'ഇല്ലാത്തവ: ' + s.missing.map((m) => m.label_ml).join(', ') : 'എല്ലാ രേഖകളും ഉണ്ട്.'} എവിടെ: ${s.where_ml}.`;
    box.append(h('div', { class: cls },
      h('div', { class: 'gs-between' }, h('div', null, h('b', null, s.icon, ' ', t(s.title, s.title_ml)), h('div', { class: 'small muted' }, t(s.label, s.label_ml), s.confidence === 'ask' && s.ask ? ' · ' + t(s.ask, s.ask_ml) : '')), say(k, readEn, readMl)),
      h('p', { class: 'small', style: { margin: '6px 0' } }, t(s.reason, s.reason_ml)),
      h('div', null, s.have.map((d) => h('span', { class: 'gs-doc have' }, '✔ ', t(d.label, d.label_ml))), s.missing.map((d) => h('span', { class: 'gs-doc ' + (d.status === 'applied' ? 'applied' : 'missing') }, d.status === 'applied' ? '⏳ ' : '✖ ', t(d.label, d.label_ml)))),
      h('div', { class: 'small muted', style: { marginTop: '6px' } }, '🏢 ', t(s.where, s.where_ml), s.link ? [' · ', h('a', { href: s.link, target: '_blank', rel: 'noopener' }, t('official site', 'ഔദ്യോഗിക സൈറ്റ്'))] : null),
      h('div', { class: 'small', style: { marginTop: '4px' } }, 'ℹ️ ', t(s.verify, s.verify_ml)),
      h('div', { class: 'gs-row', style: { marginTop: '8px' } },
        s.state === 'applied' ? ui.button(t('See application', 'അപേക്ഷ കാണുക'), () => k.go('#/m/govtservices/item?id=' + s.application_id), { small: true, tone: 'ghost' })
          : s.state === 'in_progress' ? ui.badge(t('Already applied', 'ഇതിനകം അപേക്ഷിച്ചു'), 'info')
            : ui.button('📝 ' + t('Start application', 'അപേക്ഷ തുടങ്ങുക'), () => k.go(`#/m/govtservices/home?person=${data.person.id}&scheme=${s.key}`), { small: true, tone: 'primary' }))));
  }
}

function docsTab(box, k, data) {
  const { h, t, ui } = k;
  const pid = data.person.id;
  box.append(h('p', { class: 'small muted' }, t('Tap what the family has today. The family sees this list too.', 'കുടുംബത്തിന്റെ കൈവശം ഇന്ന് ഉള്ളത് തൊടുക. ഈ പട്ടിക കുടുംബത്തിനും കാണാം.')));
  for (const d of data.documents) {
    const seg = h('div', { class: 'gs-seg', role: 'group', 'aria-label': t(d.label, d.label_ml) });
    const paint = (st) => { for (const b of seg.children) b.classList.toggle('on', b.dataset.v === st); };
    for (const [v, [ic, en, ml]] of Object.entries(DOC_ST)) {
      seg.append(h('button', { type: 'button', 'data-v': v, onclick: async () => {
        try { const r = await k.api.put('/documents/' + pid, { doc: d.key, status: v }); paint(v); d.status = v; k.toast(r && r.queued ? t('Saved on this device — will sync.', 'ഉപകരണത്തിൽ സൂക്ഷിച്ചു — പിന്നീട് സിങ്ക് ചെയ്യും.') : t('Saved', 'സേവ് ചെയ്തു'), 'good'); } catch (e) { k.toast(e.message, 'bad'); }
      } }, ic, ' ', t(en, ml)));
    }
    paint(d.status);
    box.append(h('div', { class: 'gs-docrow' }, h('div', { class: 'gs-row' }, h('span', { 'aria-hidden': 'true' }, d.icon), h('b', null, t(d.label, d.label_ml)), say(k, d.label, d.label_ml)), seg));
  }
}

async function applyTab(box, k, data, schemeKey) {
  const { h, t, ui } = k;
  const s = data.suggestions.find((x) => x.key === schemeKey);
  const cat = await catalogue(k);
  const sc = cat.schemes.find((x) => x.key === schemeKey);
  let share;
  try { share = await k.api.get('/share/' + data.person.id); } catch (_) { share = null; }
  if (share && share.agency && !share.shared) {
    box.append(ui.card({ tone: 'warn', title: '🤝 ' + t('Not yet shared with the department', 'ഇതുവരെ വകുപ്പുമായി പങ്കിട്ടിട്ടില്ല'),
      body: [h('p', null, t(`${share.agency.name} can see this application only if the family agrees (in person, or through the family's consent page).`, `കുടുംബം സമ്മതിച്ചാൽ മാത്രമേ ${share.agency.name}-ന് ഈ അപേക്ഷ കാണാനാകൂ (നേരിട്ട്, അല്ലെങ്കിൽ കുടുംബത്തിന്റെ സമ്മത പേജ് വഴി).`)),
        share.minor ? h('p', { class: 'small' }, t('This person is under 18 — the guardian gives consent.', '18 വയസ്സിൽ താഴെ — രക്ഷിതാവാണ് സമ്മതം നൽകേണ്ടത്.')) : null] }));
  }
  const def = await k.core.get('/forms/defs/govtservices.application');
  const answers = { scheme: schemeKey, docs_available: s ? s.have.map((d) => d.key) : [], docs_missing: s ? s.missing.map((d) => d.key) : [], contact: 'next_visit', share_consent: share && share.shared ? 'yes' : undefined };
  if (sc) box.append(h('p', { class: 'small muted' }, '🏢 ', t(sc.where, sc.where_ml), ' · ℹ️ ', t(sc.verify, sc.verify_ml)));
  box.append(ui.formFill(def, { person_id: data.person.id, answers, submitLabel: t('Save application', 'അപേക്ഷ സേവ് ചെയ്യുക'), onDone: (r) => {
    if (r && r.queued) { box.replaceChildren(ui.card({ tone: 'warn', title: t('Saved on this device', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു'), body: t('It travels to the city with the next sync.', 'അടുത്ത സിങ്കിൽ നഗരത്തിലെത്തും.') })); return; }
    const flags = (r.flags || []).map((f) => ui.badge(t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : 'info'));
    box.replaceChildren(ui.card({ tone: 'good', title: '✅ ' + t('Application saved', 'അപേക്ഷ സേവ് ചെയ്തു'), body: [h('p', null, t('It goes to the office with the next visit. The status comes back the visit after.', 'അടുത്ത സന്ദർശനത്തിൽ ഓഫീസിലെത്തും. വിവരം അതിനടുത്ത തവണ തിരികെ വരും.')), h('div', { class: 'gs-row' }, flags)],
      actions: [ui.button(t('Back to the family', 'കുടുംബത്തിലേക്ക്'), () => k.go('#/m/govtservices/home?person=' + data.person.id), { small: true })] }));
  } }));
}

async function appsOf(box, k, pid) {
  const { t, ui } = k;
  const rows = await k.api.get('/applications?person_id=' + pid);
  if (!rows.length) { box.append(ui.empty(t('No applications yet.', 'ഇതുവരെ അപേക്ഷകളില്ല.'))); return; }
  for (const a of rows) box.append(appCard(k, a));
}

function appCard(k, a, { showPerson = false } = {}) {
  const { h, t } = k;
  return h('div', { class: 'gs-app', role: 'button', tabindex: 0, onclick: () => k.go('#/m/govtservices/item?id=' + a.id), onkeydown: (e) => { if (e.key === 'Enter') k.go('#/m/govtservices/item?id=' + a.id); } },
    h('div', { class: 'gs-between' }, h('b', null, a.icon, ' ', t(a.scheme_title || a.scheme, a.scheme_title_ml)), a.priority >= 3 ? k.ui.badge('!', 'bad') : a.priority >= 2 ? k.ui.badge(t('Soon', 'ഉടൻ'), 'warn') : null),
    showPerson && a.person ? h('div', { class: 'small' }, a.person.name, a.hamlet ? ' · ' + t(a.hamlet, a.hamlet_ml) : '') : null,
    h('div', { class: 'gs-row small', style: { marginTop: '4px' } }, stageBadge(k, a), h('span', { class: 'muted' }, a.final ? fmt(a.replied_at || a.captured_at, k) : t(`waiting ${a.waiting_days} days`, `${a.waiting_days} ദിവസമായി കാത്തിരിക്കുന്നു`))));
}

// =====================================================================
// BOARD — applications by stage, oldest waiting first
// =====================================================================
async function board(el, k) {
  setup(k);
  const { h, t, ui } = k;
  el.append(h('div', { class: 'gs-between' }, h('h2', null, '🗂️ ', t('Applications', 'അപേക്ഷകൾ')), say(k, 'Applications by status. The oldest waiting are on top.', 'അപേക്ഷകൾ നിലയനുസരിച്ച്. ഏറ്റവും കൂടുതൽ കാത്തിരിക്കുന്നവ മുകളിൽ.')));
  const rows = await k.api.get('/applications');
  if (!rows.length) { el.append(ui.empty(t('No applications yet.', 'ഇതുവരെ അപേക്ഷകളില്ല.'))); return; }
  const by = {};
  for (const r of rows) (by[r.stage] = by[r.stage] || []).push(r);
  const stages = [...ORDER.filter((s) => by[s]), ...Object.keys(by).filter((s) => !ORDER.includes(s))];
  el.append(h('div', { class: 'gs-row', style: { margin: '6px 0 12px' } }, stages.map((s) => ui.badge(`${(STAGE_TXT[s] || ['•'])[0]} ${by[s].length}`, tone(s)))));
  el.append(ui.grid(stages.map((s) => {
    const txt = STAGE_TXT[s] || ['•', s, s];
    const list = by[s].sort((a, b) => b.waiting_days - a.waiting_days);
    return h('div', { class: 'gs-col' }, h('h4', null, h('span', null, txt[0], ' ', t(txt[1], txt[2])), h('span', { class: 'muted' }, String(list.length))), list.slice(0, 40).map((a) => appCard(k, a, { showPerson: true })));
  }), 260));
}

// =====================================================================
// ITEM — one application: answers, timeline, officer outcome
// =====================================================================
async function item(el, k) {
  setup(k);
  const { h, t, ui } = k;
  let a;
  try { a = await k.api.get('/applications/' + k.params.id); } catch (e) { el.append(ui.error(e)); return; }
  el.append(h('div', { class: 'gs-between' }, h('h2', null, a.icon, ' ', t(a.scheme_title, a.scheme_title_ml)), say(k, `${a.scheme_title}. ${a.stage_label}. ${a.plain}`, `${a.scheme_title_ml}. ${a.stage_label_ml}. ${a.plain_ml}`)));
  el.append(h('div', { class: 'gs-row' }, stageBadge(k, a), a.person ? h('span', null, a.person.name) : null, a.hamlet ? h('span', { class: 'muted' }, t(a.hamlet, a.hamlet_ml)) : null,
    (a.flags || []).map((f) => ui.badge(t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : 'info'))));
  el.append(ui.section(t('Status', 'നില'), timelineEl(k, a.timeline)));
  const cat = await catalogue(k);
  const docName = (key) => { const d = cat.documents.find((x) => x.key === key); return d ? t(d.label, d.label_ml) : key; };
  el.append(ui.section(t('Application', 'അപേക്ഷ'), ui.kv([
    [t('Purpose', 'ആവശ്യം'), a.answers.purpose || '—'],
    [t('Papers the family has', 'കൈവശമുള്ള രേഖകൾ'), (a.answers.docs_available || []).map(docName).join(', ') || '—'],
    [t('Papers missing', 'ഇല്ലാത്ത രേഖകൾ'), (a.answers.docs_missing || []).map(docName).join(', ') || '—'],
    [t('Tell the family by', 'അറിയിക്കേണ്ടത്'), { next_visit: t('Next visit', 'അടുത്ത സന്ദർശനം'), phone: t('Phone', 'ഫോൺ'), promoter: t('ST Promoter', 'എസ്.ടി. പ്രൊമോട്ടർ') }[a.answers.contact] || '—'],
    [t('Agreed to share with ST Department', 'എസ്.ടി. വകുപ്പുമായി പങ്കിടാൻ സമ്മതം'), a.answers.share_consent === 'yes' ? t('Yes', 'അതെ') : t('No', 'ഇല്ല')],
    a.answers.doc_photo && a.answers.doc_photo.startsWith('data:image/') ? [t('Document photo', 'രേഖയുടെ ഫോട്ടോ'), h('img', { src: a.answers.doc_photo, alt: t('Document photo', 'രേഖയുടെ ഫോട്ടോ'), style: { maxWidth: '220px', borderRadius: '8px' } })] : null,
    [t('Filled by', 'പൂരിപ്പിച്ചത്'), `${a.captured_by_name || ''} · ${fmt(a.captured_at, k)}`],
  ].filter(Boolean))));
  if (a.scheme_info) el.append(h('p', { class: 'small muted' }, '🏢 ', t(a.scheme_info.where, a.scheme_info.where_ml), ' · ℹ️ ', t(a.scheme_info.verify, a.scheme_info.verify_ml)));
  if (a.can_reply && !a.final) {
    if (a.status === 'submitted') k.core.post('/forms/submissions/' + a.id + '/claim').catch(() => {});
    el.append(ui.section(t('Record what happened at the office', 'ഓഫീസിൽ നടന്നത് രേഖപ്പെടുത്തുക'), [
      h('p', { class: 'small muted' }, t('This app does not submit to any portal. Do it at the office, then record the result here. The family hears only that an update is ready.', 'ഈ ആപ്പ് ഒരു പോർട്ടലിലേക്കും അയയ്ക്കുന്നില്ല. ഓഫീസിൽ ചെയ്ത ശേഷം ഫലം ഇവിടെ രേഖപ്പെടുത്തുക. വിവരം തയ്യാറാണെന്ന് മാത്രമേ കുടുംബത്തെ അറിയിക്കൂ.')),
      ui.form([
        { name: 'outcome', label: t('Outcome', 'ഫലം'), type: 'select', required: true, options: a.outcomes.map((o) => ({ value: o.key, label: `${o.icon} ${t(o.label, o.label_ml)}` })) },
        { name: 'note', label: t('Note for the family (English, optional)', 'കുടുംബത്തിനുള്ള കുറിപ്പ് (ഇംഗ്ലീഷ്)'), type: 'textarea' },
        { name: 'note_ml', label: t('Note in Malayalam (optional)', 'മലയാളത്തിൽ കുറിപ്പ്'), type: 'textarea' },
      ], async (v) => { await k.api.post('/applications/' + a.id + '/outcome', v); k.toast(t('Saved. It reaches the hamlet on the next visit.', 'സേവ് ചെയ്തു. അടുത്ത സന്ദർശനത്തിൽ ഊരിലെത്തും.'), 'good'); k.refresh(); }, { submitLabel: t('Save outcome', 'ഫലം സേവ് ചെയ്യുക') }),
    ]));
  }
}

// =====================================================================
// OFFICE — department / Akshaya queue
// =====================================================================
async function office(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const d = await k.api.get('/office');
  el.append(hero(k, 'Office queue', 'ഓഫീസ് ക്യൂ', 'Applications from the hamlets that the families agreed to share with you. Most urgent and oldest first.', 'കുടുംബങ്ങൾ നിങ്ങളുമായി പങ്കിടാൻ സമ്മതിച്ച അപേക്ഷകൾ. അടിയന്തരവും പഴയതും ആദ്യം.'));
  if (d.forwarded_to) el.append(h('p', { class: 'small muted' }, t('Forwarded to: ', 'അയയ്ക്കുന്നത്: '), d.forwarded_to));
  const fresh = d.items.filter((x) => x.new), follow = d.items.filter((x) => !x.new);
  el.append(ui.grid([ui.stat(t('New to act on', 'പുതിയവ'), fresh.length), ui.stat(t('Waiting over 14 days', '14 ദിവസത്തിലേറെ'), d.items.filter((x) => x.waiting_days > 14).length), ui.stat(t('In progress', 'പുരോഗതിയിൽ'), follow.length)], 160));
  const cols = [
    { key: 'p', label: '!', render: (r) => (r.priority >= 3 ? ui.badge(t('Urgent', 'അടിയന്തരം'), 'bad') : r.priority >= 2 ? ui.badge(t('Soon', 'ഉടൻ'), 'warn') : '') },
    { key: 'scheme', label: t('Scheme', 'പദ്ധതി'), render: (r) => `${r.icon} ${t(r.scheme_title, r.scheme_title_ml)}` },
    { key: 'who', label: t('Person', 'വ്യക്തി'), render: (r) => (r.person ? r.person.name : '') },
    { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (r) => t(r.hamlet || '', r.hamlet_ml) },
    { key: 'stage', label: t('Status', 'നില'), render: (r) => stageBadge(k, r) },
    { key: 'wait', label: t('Days', 'ദിവസം'), render: (r) => String(r.waiting_days) },
  ];
  el.append(ui.section(t('New', 'പുതിയവ'), ui.table(cols, fresh, { empty: t('Nothing new. 🎉', 'പുതിയതൊന്നുമില്ല. 🎉'), onRow: (r) => k.go('#/m/govtservices/item?id=' + r.id) })));
  el.append(ui.section(t('Follow up', 'തുടർനടപടി'), ui.table(cols, follow, { empty: t('Nothing in progress.', 'ഒന്നുമില്ല.'), onRow: (r) => k.go('#/m/govtservices/item?id=' + r.id) })));
}

// =====================================================================
// FAMILY — my documents, my applications (plain language, read-aloud)
// =====================================================================
async function family(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const d = await k.api.get('/my');
  el.append(hero(k, 'My papers and applications', 'എന്റെ രേഖകളും അപേക്ഷകളും', 'See which papers you have, and where each application is.', 'ഏതൊക്കെ രേഖകൾ ഉണ്ടെന്നും ഓരോ അപേക്ഷയും എവിടെയെത്തി എന്നും കാണുക.'));
  if (d._offline) el.append(ui.badge(t('Offline copy', 'ഓഫ്‌ലൈൻ പകർപ്പ്'), 'warn'));
  for (const m of d.members) {
    const box = h('div', { class: 'card', style: { marginBottom: '14px' } });
    box.append(h('div', { class: 'gs-row' }, h('div', { class: 'gs-ava' }, personAvatar(m)), h('h3', { style: { margin: 0 } }, m.self ? t('Me', 'ഞാൻ') + ' — ' + m.name : m.name)));
    if (m.applications.length) {
      for (const a of m.applications) {
        box.append(h('div', { class: 'gs-sug' + (a.final ? ' done' : '') },
          h('div', { class: 'gs-between' }, h('b', { class: 'gs-big' }, a.icon, ' ', t(a.scheme_title, a.scheme_title_ml)), say(k, `${a.scheme_title}. ${a.plain}`, `${a.scheme_title_ml}. ${a.plain_ml}`)),
          h('p', { class: 'gs-big', style: { margin: '6px 0' } }, a.stage_icon || '', ' ', t(a.plain, a.plain_ml)),
          h('details', null, h('summary', null, t('All steps', 'എല്ലാ ഘട്ടങ്ങളും')), timelineEl(k, a.timeline))));
      }
    } else box.append(h('p', { class: 'muted' }, t('No applications yet.', 'ഇതുവരെ അപേക്ഷകളില്ല.')));
    if (m.documents.length) {
      box.append(h('h4', null, '📂 ', t('My papers', 'എന്റെ രേഖകൾ')));
      box.append(h('div', null, m.documents.map((x) => { const st = DOC_ST[x.status] || ['', x.status, x.status]; return h('span', { class: 'gs-doc ' + x.status, title: t(st[1], st[2]) }, x.icon, ' ', t(x.label, x.label_ml), ' · ', t(st[1], st[2])); })));
      const miss = m.documents.filter((x) => x.status === 'missing');
      if (miss.length) box.append(h('div', { class: 'gs-row', style: { marginTop: '6px' } }, say(k, 'Papers still needed: ' + miss.map((x) => x.label).join(', '), 'ഇനിയും വേണ്ട രേഖകൾ: ' + miss.map((x) => x.label_ml).join(', ')), h('span', { class: 'small' }, t('Papers still needed', 'ഇനിയും വേണ്ട രേഖകൾ'))));
    }
    if (m.suggestions.length) {
      box.append(h('h4', null, '💡 ', t('You may be eligible — ask your helper', 'യോഗ്യത ഉണ്ടാകാം — സഹായിയോട് ചോദിക്കുക')));
      for (const s of m.suggestions) box.append(h('div', { class: 'gs-row small', style: { marginBottom: '4px' } }, say(k, `${s.title}. ${s.reason}`, `${s.title_ml}. ${s.reason_ml}`), h('span', null, s.icon, ' ', t(s.title, s.title_ml))));
    }
    el.append(box);
  }
  el.append(ui.card({ tone: 'info', title: t('Your choice', 'നിങ്ങളുടെ തീരുമാനം'), body: h('ul', null,
    h('li', null, t('The ST Department sees an application only if you agree. You can withdraw any time in "My data & consent".', 'നിങ്ങൾ സമ്മതിച്ചാൽ മാത്രമേ എസ്.ടി. വകുപ്പിന് അപേക്ഷ കാണാനാകൂ. "എന്റെ വിവരം, സമ്മതം" എന്നതിൽ എപ്പോൾ വേണമെങ്കിലും പിൻവലിക്കാം.')),
    h('li', null, t('Messages only say an update is ready — never what it is about.', 'സന്ദേശങ്ങളിൽ വിവരം തയ്യാറാണെന്ന് മാത്രം — എന്തിനെക്കുറിച്ചെന്ന് പറയില്ല.')),
    h('li', null, t('This help is free. Never pay anyone to "speed up" an application.', 'ഈ സഹായം സൗജന്യമാണ്. അപേക്ഷ "വേഗത്തിലാക്കാൻ" ആർക്കും പണം നൽകരുത്.'))) }));
}

// =====================================================================
// AGGREGATE — donors / government: numbers only, small counts suppressed
// =====================================================================
async function aggregate(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const d = await k.api.get('/aggregate');
  el.append(hero(k, 'Scheme access in the hamlets', 'ഊരുകളിലെ പദ്ധതി ലഭ്യത', 'How many applications were helped, for which schemes, and what happened. Numbers only — no names.', 'എത്ര അപേക്ഷകൾക്ക് സഹായം, ഏതൊക്കെ പദ്ധതികൾ, എന്ത് സംഭവിച്ചു. എണ്ണം മാത്രം — പേരുകളില്ല.'));
  el.append(h('p', { class: 'small muted' }, t(d.note, d.note_ml)));
  const num = (v) => (typeof v === 'number' ? v : 0);
  el.append(ui.grid([ui.stat(t('Applications helped', 'സഹായിച്ച അപേക്ഷകൾ'), String(d.totals.total)), ui.stat(t('Ready / approved', 'തയ്യാർ / അംഗീകരിച്ചു'), String(num(d.totals.by_outcome.certificate_ready) + num(d.totals.by_outcome.approved))), ui.stat(t('Hamlets', 'ഊരുകൾ'), String(d.hamlets.length))], 160));
  el.append(ui.section(t('By scheme', 'പദ്ധതി അനുസരിച്ച്'), ui.bars(d.schemes.filter((s) => d.totals.by_scheme[s.key] !== undefined).map((s) => ({ label: `${s.icon} ${t(s.title, s.title_ml)}`, value: num(d.totals.by_scheme[s.key]) })), {})));
  el.append(ui.section(t('By outcome', 'ഫലം അനുസരിച്ച്'), ui.bars([...d.outcomes.map((o) => ({ label: `${o.icon} ${t(o.label, o.label_ml)}`, value: num(d.totals.by_outcome[o.key]) })), { label: '⏳ ' + t('Waiting', 'കാത്തിരിക്കുന്നു'), value: num(d.totals.by_outcome.waiting) }], {})));
  const cols = [...d.outcomes.map((o) => [o.key, o.icon]), ['waiting', '⏳']];
  el.append(ui.section(t('Per hamlet', 'ഊര് അനുസരിച്ച്'), h('div', { class: 'gs-scroll' }, h('table', { class: 'gs-heat' },
    h('thead', null, h('tr', null, h('th', null, t('Hamlet', 'ഊര്')), h('th', null, t('Total', 'ആകെ')), cols.map(([key, ic]) => h('th', { title: key }, ic)))),
    h('tbody', null, d.hamlets.map((x) => h('tr', null, h('th', null, t(x.name, x.name_ml)), h('td', null, String(x.total)), cols.map(([key]) => h('td', null, x.by_outcome[key] === undefined ? '·' : String(x.by_outcome[key]))))))))));
}

export default { views: { home, board, item, office, family, aggregate } };
