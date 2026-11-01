// Disaster Preparedness — screens. Plain ES module; no DOM work at import time.
// Views: board (hamlet board: warning banner, assembly points, helplines, checklist), plans (family
// emergency plans), help (people needing help to evacuate — responders only, printable), incidents
// (report + district cell queue), warnings (issue / cancel — admins), aggregate (numbers for donors/govt).

const CSS = `
.dis-banner{border-radius:14px;padding:14px 16px;margin:0 0 12px;display:flex;gap:12px;align-items:flex-start;position:relative;border:3px solid transparent}
.dis-banner .e{font-size:2.6rem;line-height:1;flex:none}
.dis-banner h2{margin:0 0 4px;font-size:1.2rem;line-height:1.3}
.dis-banner p{margin:4px 0 0}
.dis-banner .speak{flex:none;width:48px;height:48px;font-size:1.4rem}
.dis-red{background:#fde2e1;border-color:#b3261e;color:#5f0f0a}
.dis-orange{background:#ffe9d2;border-color:#d9600b;color:#5a2700}
.dis-yellow{background:#fff6cc;border-color:#c9a400;color:#4d3d00}
.dis-green{background:#e5f4ea;border-color:#2e7d32;color:#123d17}
.dis-demo{display:inline-block;background:#fff;color:#7a1f00;border:2px dashed #7a1f00;border-radius:6px;padding:2px 8px;font-weight:800;font-size:.8rem;letter-spacing:.02em;margin-bottom:4px}
.dis-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:8px 0 14px}
.dis-act{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:104px;border:2px solid var(--line,#ddd);border-radius:14px;background:#fff;font-weight:700;font-size:1rem;cursor:pointer;padding:10px;text-align:center;color:inherit;text-decoration:none}
.dis-act:hover,.dis-act:focus{border-color:#c62828;outline:none}
.dis-act .e{font-size:2.3rem;line-height:1}
.dis-point{display:flex;gap:10px;align-items:flex-start;border-bottom:1px dashed var(--line,#ddd);padding:8px 0}
.dis-point .e{font-size:1.8rem;flex:none}
.dis-point .m{flex:1;min-width:0}
.dis-call{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px dashed var(--line,#ddd);padding:6px 0}
.dis-call a{font-size:1.25rem;font-weight:800;text-decoration:none}
.dis-check{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line,#ddd)}
.dis-check input{width:26px;height:26px;flex:none}
.dis-check .e{font-size:1.5rem;flex:none}
.dis-haz{display:inline-flex;gap:4px;align-items:center;border-radius:999px;padding:3px 10px;margin:2px;font-weight:700;font-size:.9rem;border:1px solid var(--line,#ddd);background:#fff}
.dis-haz.high{background:#fde2e1;border-color:#e3a19c}.dis-haz.medium{background:#fff1dd;border-color:#f0c48e}
.dis-q{border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;padding:12px;margin-bottom:10px;cursor:pointer}
.dis-q.p3{border-left:6px solid #b3261e}.dis-q.p2{border-left:6px solid #d9600b}
.dis-conf{border:2px solid #b3261e;color:#7a1410;border-radius:8px;padding:8px 10px;font-weight:700;margin:8px 0}
.dis-help td{vertical-align:top}
@media (max-width:420px){.dis-act{min-height:92px;font-size:.92rem}.dis-act .e{font-size:2rem}.dis-banner .e{font-size:2rem}}
@media print{.dis-noprint{display:none !important}.dis-banner,.dis-conf{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-size:12pt}}
`;

let catCache = null;
async function cat(k) { if (!catCache) catCache = await k.api.get('/catalogue'); return catCache; }
const L = (k, o, key = 'label') => (o ? k.t(o[key], o[key + '_ml']) : '');
const say = (k, en, ml) => k.ui.speakBtn(k.lang === 'ml' && ml ? ml : en, k.lang === 'ml' && ml ? 'ml' : 'en');
const fmtDate = (s) => (s ? String(s).slice(0, 10) : '—');
const fmtWhen = (s) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function setup(k) { k.style(CSS, 'disaster-css'); }

// Remember the last hamlet chosen on this device (per user), so a shared tablet opens where you left off.
const hamletKey = (k) => 'aadi.disaster.hamlet:' + (k.user && k.user.id);
function lastHamlet(k) { try { return localStorage.getItem(hamletKey(k)); } catch (_) { return null; } }
function rememberHamlet(k, id) { try { localStorage.setItem(hamletKey(k), id); } catch (_) { /* ignore */ } }

async function hamletPicker(k, current, onChange) {
  const { h, t } = k;
  const hs = await k.api.get('/hamlets');
  if (!hs.length) return { hamlets: [], el: null, id: null };
  const id = current && hs.some((x) => x.id === current) ? current : (lastHamlet(k) && hs.some((x) => x.id === lastHamlet(k)) ? lastHamlet(k) : hs[0].id);
  if (hs.length === 1) return { hamlets: hs, el: null, id };
  const sel = h('select', { class: 'input', style: { maxWidth: '360px', fontSize: '1.05rem' }, 'aria-label': t('Hamlet', 'ഊര്'), onchange: () => { rememberHamlet(k, sel.value); onChange(sel.value); } },
    hs.map((x) => h('option', { value: x.id, selected: x.id === id }, (x.warning ? x.warning.icon + ' ' : '') + t(x.name, x.name_ml) + ' · ' + x.district + (x.enabled ? '' : ' — ' + t('switched off', 'ഓഫ്')))));
  return { hamlets: hs, el: h('div', { class: 'row dis-noprint', style: { margin: '0 0 10px' } }, h('b', null, '🏡 ' + t('Hamlet', 'ഊര്')), sel), id };
}

function warningBanner(k, w) {
  const { h, t } = k;
  const title = t(w.title, w.title_ml || w.title);
  const body = t(w.body, w.body_ml || w.body);
  const advice = t(w.advice, w.advice_ml);
  const spokenEn = `${w.level_label}. ${w.is_demo ? 'Demo, not a real warning. ' : ''}${w.title}. ${w.body} ${w.advice}`;
  const spokenMl = `${w.level_label_ml}. ${w.is_demo ? 'ഡെമോ, യഥാർത്ഥ മുന്നറിയിപ്പല്ല. ' : ''}${w.title_ml || w.title}. ${w.body_ml || w.body} ${w.advice_ml}`;
  return h('div', { class: 'dis-banner dis-' + w.level, role: w.level === 'red' || w.level === 'orange' ? 'alert' : 'status' },
    h('span', { class: 'e', 'aria-hidden': 'true' }, w.icon),
    h('div', { style: { flex: 1, minWidth: 0 } },
      w.is_demo ? h('span', { class: 'dis-demo' }, '⚠ DEMO — not a real warning · ' + 'ഡെമോ — യഥാർത്ഥ മുന്നറിയിപ്പല്ല') : null,
      h('div', { class: 'small', style: { fontWeight: 800, textTransform: 'uppercase' } }, t(w.level_label, w.level_label_ml)),
      h('h2', null, title), h('p', null, body), h('p', { style: { fontWeight: 700 } }, '👉 ' + advice),
      h('p', { class: 'small' }, t('Valid until', 'വരെ സാധുവാണ്') + ' ' + fmtWhen(w.valid_to) + ' · ' + t('Source', 'ഉറവിടം') + ': ' + (w.source || '—'))),
    say(k, spokenEn, spokenMl));
}

function contactsCard(k, contacts, note, noteMl) {
  const { h, t, ui } = k;
  return ui.card({ title: '☎️ ' + t('Official helplines', 'ഔദ്യോഗിക ഹെൽപ്‌ലൈനുകൾ'),
    body: [h('p', { class: 'small', style: { fontWeight: 700, color: 'var(--warn,#9a6a00)' } }, '⚠ ' + t(note, noteMl)),
      ...contacts.map((c) => h('div', { class: 'dis-call' }, h('span', null, L(k, c), ' ', h('span', { class: 'badge warn' }, t('verify locally', 'ഉറപ്പാക്കുക'))), h('span', { class: 'row' }, h('a', { href: 'tel:' + c.number }, c.number), say(k, `${c.label}: ${c.number.split('').join(' ')}`, `${c.label_ml || c.label}: ${c.number.split('').join(' ')}`))))] });
}

function pointsCard(k, profile, catalogue) {
  const { h, t, ui } = k;
  const kinds = Object.fromEntries(catalogue.point_kinds.map((x) => [x.key, x]));
  const pts = profile.points || [];
  return ui.card({ title: '🚩 ' + t('Where to go', 'എവിടേക്ക് പോകണം'),
    body: pts.length ? pts.map((p) => {
      const kd = kinds[p.kind] || {};
      const map = p.lat !== null && p.lat !== undefined ? h('a', { class: 'small', href: `geo:${p.lat},${p.lng}`, rel: 'noopener' }, '📍 ' + p.lat + ', ' + p.lng + ' ' + t('(rough)', '(ഏകദേശം)')) : null;
      return h('div', { class: 'dis-point' }, h('span', { class: 'e', 'aria-hidden': 'true' }, kd.icon || '📍'),
        h('div', { class: 'm' }, h('div', { class: 'small muted' }, L(k, kd)), h('b', null, t(p.name, p.name_ml || p.name)), p.description ? h('div', null, t(p.description, p.description_ml || p.description)) : null, map),
        say(k, `${kd.label}: ${p.name}. ${p.description || ''}`, `${kd.label_ml}: ${p.name_ml || p.name}. ${p.description_ml || p.description || ''}`));
    }) : ui.empty(t('No assembly point recorded yet. Ask your coordinator.', 'ഒത്തുചേരൽ സ്ഥലം രേഖപ്പെടുത്തിയിട്ടില്ല. കോർഡിനേറ്ററോട് ചോദിക്കുക.')) });
}

function hazardChips(k, profile, catalogue) {
  const { h, t } = k;
  const lv = Object.fromEntries(catalogue.hazard_levels.map((x) => [x.key, x]));
  const entries = catalogue.hazards.filter((z) => profile.hazards && profile.hazards[z.key]);
  if (!entries.length) return h('p', { class: 'small muted' }, t('Hazards not assessed yet.', 'അപകടസാധ്യതകൾ വിലയിരുത്തിയിട്ടില്ല.'));
  return h('div', null, entries.map((z) => h('span', { class: 'dis-haz ' + profile.hazards[z.key] }, z.icon + ' ' + L(k, z) + ' · ' + L(k, lv[profile.hazards[z.key]]))));
}

// ---------------------------------------------------------------- board
async function board(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const c = await cat(k);
  const pick = await hamletPicker(k, k.params.hamlet, (id) => k.go('#/m/disaster/board?hamlet=' + id));
  if (!pick.id) { el.append(ui.empty(t('No hamlet is linked to your account.', 'നിങ്ങളുടെ അക്കൗണ്ടിൽ ഊര് ഇല്ല.'))); return; }
  const b = await k.api.get('/board?hamlet_id=' + encodeURIComponent(pick.id));
  const hm = b.hamlet;
  const intro = t('Be ready before the rain. Know where to go and whom to call.', 'മഴയ്ക്കു മുമ്പേ തയ്യാറാകുക. എവിടെ പോകണം, ആരെ വിളിക്കണം എന്ന് അറിയുക.');
  el.append(h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
    h('h1', { style: { margin: '0 0 6px' } }, '⛑️ ' + t(hm.name, hm.name_ml)), say(k, `${hm.name}. ${'Be ready before the rain. Know where to go and whom to call.'}`, `${hm.name_ml}. ${'മഴയ്ക്കു മുമ്പേ തയ്യാറാകുക. എവിടെ പോകണം, ആരെ വിളിക്കണം എന്ന് അറിയുക.'}`)),
  h('p', { class: 'muted', style: { marginTop: 0 } }, intro), pick.el);
  if (b._offline) el.append(h('p', { class: 'badge warn' }, t('Saved copy from ', 'സൂക്ഷിച്ച പകർപ്പ് ') + fmtWhen(b._cachedAt)));
  // Warning banner first — the most important thing on the screen.
  if (b.warnings.length) for (const w of b.warnings) el.append(warningBanner(k, w));
  else el.append(warningBanner(k, { level: 'green', icon: '🟢', level_label: 'Green', level_label_ml: 'പച്ച', title: 'No warning for this hamlet now', title_ml: 'ഇപ്പോൾ ഈ ഊരിന് മുന്നറിയിപ്പില്ല', body: 'Keep your family plan ready.', body_ml: 'കുടുംബ പദ്ധതി തയ്യാറാക്കി വെക്കുക.', advice: '', advice_ml: '', valid_to: null, source: '—' }));

  for (const w of (b.pending_warnings || [])) el.append(h('div', { class: 'card dis-noprint', style: { background: '#fde2e1' } }, h('b', null, '⏳ ' + t('Red warning waiting for confirmation: ', 'സ്ഥിരീകരണം കാത്തിരിക്കുന്ന ചുവപ്പ് മുന്നറിയിപ്പ്: ') + t(w.title, w.title_ml || w.title)), ' ',
    ui.button(t('Confirm', 'സ്ഥിരീകരിക്കുക'), async () => { if (await ui.confirm(t('Have you checked this against the official bulletin? It will be shown on every hub.', 'ഔദ്യോഗിക അറിയിപ്പുമായി ഒത്തുനോക്കിയോ? എല്ലാ ഹബ്ബിലും കാണിക്കും.'))) { await k.api.post('/warnings/' + w.id + '/confirm'); k.refresh(); } }, { small: true, tone: 'primary' })));
  const acts = [];
  const act = (icon, en, ml, href) => h('a', { class: 'dis-act', href }, h('span', { class: 'e', 'aria-hidden': 'true' }, icon), t(en, ml));
  if (b.can.plans) acts.push(act('🏠', 'Family plans', 'കുടുംബ പദ്ധതികൾ', '#/m/disaster/plans?hamlet=' + hm.id));
  if (b.can.help) acts.push(act('🤝', 'People needing help', 'സഹായം വേണ്ടവർ', '#/m/disaster/help?hamlet=' + hm.id));
  if (b.can.incident || b.can.review) acts.push(act('🚨', 'Report an incident', 'സംഭവം റിപ്പോർട്ട് ചെയ്യുക', '#/m/disaster/incidents?hamlet=' + hm.id + (b.can.incident ? '&new=1' : '')));
  if (b.can.issue) acts.push(act('📢', 'Issue a warning', 'മുന്നറിയിപ്പ് നൽകുക', '#/m/disaster/warnings?hamlet=' + hm.id));
  if (acts.length) el.append(h('div', { class: 'dis-big dis-noprint' }, acts));

  const p = b.profile;
  el.append(ui.grid([pointsCard(k, p, c), contactsCard(k, p.contacts, b.verify_note, b.verify_note_ml)], 300));
  el.append(ui.card({ title: '⚠️ ' + t('Risks in this hamlet', 'ഈ ഊരിലെ അപകടസാധ്യതകൾ'), body: [hazardChips(k, p, c),
    ui.kv([[t('Nearest health centre', 'അടുത്ത ആരോഗ്യ കേന്ദ്രം'), p.nearest_phc || '—'], [t('Road head', 'റോഡ് എത്തുന്ന സ്ഥലം'), p.road_head || '—'], [t('Last drill', 'അവസാന പരിശീലനം'), p.last_drill || t('not yet', 'ഇതുവരെ ഇല്ല')]]),
    p.is_demo ? h('p', { class: 'small' }, h('span', { class: 'dis-demo' }, 'DEMO'), ' ', t('Fictional places for the demo.', 'ഡെമോയ്ക്കുള്ള സാങ്കൽപ്പിക സ്ഥലങ്ങൾ.')) : null,
    p.updated_by_name ? h('p', { class: 'small muted' }, t('Updated by ', 'പുതുക്കിയത് ') + p.updated_by_name + ' · ' + fmtDate(p.updated_at)) : null],
  actions: [b.can.edit_profile ? ui.button('✏️ ' + t('Edit risk profile', 'വിവരങ്ങൾ മാറ്റുക'), () => editProfile(k, hm, p, c), { small: true }) : null, b.can.history ? ui.button('🕘 ' + t('Edit history', 'മാറ്റങ്ങളുടെ ചരിത്രം'), () => profileHistory(k, hm), { small: true }) : null].filter(Boolean) }));

  if (b.checklist) {
    const done = b.checklist.filter((x) => x.done).length;
    el.append(ui.card({ title: '✅ ' + t('Pre-monsoon checklist', 'മഴക്കാലത്തിന് മുമ്പുള്ള ചെക്ക്‌ലിസ്റ്റ്') + ' · ' + b.season,
      body: [ui.progress(done / b.checklist.length, `${done}/${b.checklist.length} ${t('done', 'പൂർത്തിയായി')}`),
        ...b.checklist.map((it) => {
          const box = h('input', { type: 'checkbox', checked: it.done, disabled: !b.can.tick, 'aria-label': L(k, it), onchange: async () => {
            box.disabled = true;
            try { const r = await k.api.post('/checklist/' + hm.id, { item: it.key, done: box.checked }); if (r && r.queued) k.toast(t('Saved on this device', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു'), 'warn'); else k.toast(t('Saved', 'സേവ് ചെയ്തു'), 'good'); } catch (e) { box.checked = !box.checked; k.toast(e.message, 'bad'); } finally { box.disabled = !b.can.tick; }
          } });
          return h('label', { class: 'dis-check' }, box, h('span', { class: 'e', 'aria-hidden': 'true' }, it.icon), h('span', { style: { flex: 1 } }, L(k, it), it.done && it.done_by_name ? h('div', { class: 'small muted' }, it.done_by_name + ' · ' + fmtDate(it.done_at)) : null), say(k, it.label, it.label_ml));
        })] }));
  }
  if (typeof b.plans_recorded === 'number') el.append(h('p', { class: 'small muted' }, t('Family plans recorded by your agency here: ', 'നിങ്ങളുടെ ഏജൻസി ഇവിടെ രേഖപ്പെടുത്തിയ കുടുംബ പദ്ധതികൾ: ') + b.plans_recorded));
  el.append(h('p', { class: 'small muted' }, t(b.status, b.status_ml)));
}

async function profileHistory(k, hm) {
  const { h, t, ui } = k;
  const list = await k.api.get('/profile/' + hm.id + '/history');
  const show = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  ui.modal(t('Edit history — ', 'മാറ്റങ്ങളുടെ ചരിത്രം — ') + t(hm.name, hm.name_ml), list.length ? h('div', null, list.map((e) => h('div', { class: 'dis-point' }, h('div', { class: 'm' },
    h('b', null, (e.changed_by_name || '?') + (e.agency ? ' (' + e.agency + ')' : '') + ' · ' + fmtWhen(e.changed_at)),
    ...(e.changes || []).map((c) => h('div', { class: 'small' }, h('b', null, c.field + ': '), h('span', { class: 'muted' }, show(c.before)), ' → ', show(c.after))))))) : ui.empty(t('No edits yet.', 'മാറ്റങ്ങളില്ല.')));
}

function editProfile(k, hm, p, c) {
  const { h, t, ui } = k;
  const hz = c.hazards.map((z) => h('label', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', null, z.icon + ' ' + L(k, z)),
    h('select', { 'data-h': z.key }, h('option', { value: '' }, t('not a risk', 'ഇല്ല')), c.hazard_levels.map((l) => h('option', { value: l.key, selected: p.hazards[z.key] === l.key }, L(k, l))))));
  const pointsTa = h('textarea', { rows: 4, placeholder: 'assembly | Community hall ground | Flat ground on the ridge | 10.021 | 77.083' }, (p.points || []).map((x) => [x.kind, x.name, x.description || '', x.lat ?? '', x.lng ?? ''].join(' | ')).join('\n'));
  const contactsTa = h('textarea', { rows: 4 }, (p.contacts || []).map((x) => `${x.label} | ${x.number}`).join('\n'));
  const phc = h('input', { value: p.nearest_phc || '' }); const road = h('input', { value: p.road_head || '' });
  const drill = h('input', { type: 'date', value: p.last_drill || '' });
  const body = h('div', { class: 'stack' },
    h('b', null, t('Hazards', 'അപകടസാധ്യതകൾ')), ...hz,
    h('label', null, t('Assembly points and shelters (one per line: kind | name | description | lat | lng)', 'ഒത്തുചേരൽ സ്ഥലങ്ങൾ (ഓരോ വരിയിലും: തരം | പേര് | വിവരണം | lat | lng)'), pointsTa),
    h('label', null, t('Official helplines only (label | number) — no mobile numbers', 'ഔദ്യോഗിക ഹെൽപ്‌ലൈനുകൾ മാത്രം (പേര് | നമ്പർ) — മൊബൈൽ നമ്പർ വേണ്ട'), contactsTa),
    h('label', null, t('Nearest health centre', 'അടുത്ത ആരോഗ്യ കേന്ദ്രം'), phc), h('label', null, t('Road head', 'റോഡ് എത്തുന്ന സ്ഥലം'), road), h('label', null, t('Last drill', 'അവസാന പരിശീലനം'), drill),
    ui.button(t('Save', 'സേവ് ചെയ്യുക'), async () => {
      const hazards = {}; for (const s of body.querySelectorAll('select[data-h]')) if (s.value) hazards[s.dataset.h] = s.value;
      const points = pointsTa.value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0] && a[1]).map(([kind, name, description, lat, lng]) => ({ kind, name, description, lat: lat || null, lng: lng || null }));
      const contacts = contactsTa.value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0] && a[1]).map(([label, number]) => ({ label, number }));
      await k.api.put('/profile/' + hm.id, { hazards, points, contacts, nearest_phc: phc.value, road_head: road.value, last_drill: drill.value || null });
      m.close(); k.toast(t('Saved', 'സേവ് ചെയ്തു'), 'good'); k.refresh();
    }, { tone: 'primary' }));
  const m = ui.modal(t('Risk profile — ', 'അപകടസാധ്യതാ വിവരം — ') + t(hm.name, hm.name_ml), body);
}

// ---------------------------------------------------------------- family plans
async function plans(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const pick = await hamletPicker(k, k.params.hamlet, (id) => k.go('#/m/disaster/plans?hamlet=' + id));
  el.append(h('h1', null, '🏠 ' + t('Family emergency plans', 'കുടുംബ അടിയന്തര പദ്ധതികൾ')),
    h('p', { class: 'muted' }, t('Sit with the family, read the consent aloud, then agree where to meet, whom to contact and what help they will need. The family decides what to share.', 'കുടുംബത്തോടൊപ്പം ഇരുന്ന് സമ്മതപത്രം വായിച്ചുകേൾപ്പിക്കുക. എവിടെ ഒത്തുചേരണം, ആരെ ബന്ധപ്പെടണം, എന്ത് സഹായം വേണം എന്ന് തീരുമാനിക്കുക. എന്ത് പങ്കിടണമെന്ന് കുടുംബം തീരുമാനിക്കും.')), pick.el);
  if (!pick.id) return;
  const r = await k.api.get('/households?hamlet_id=' + encodeURIComponent(pick.id));
  const done = r.households.filter((x) => x.plan).length;
  el.append(ui.grid([ui.stat(t('Families with a plan', 'പദ്ധതിയുള്ള കുടുംബങ്ങൾ'), done), ui.stat(t('Families still to visit', 'ഇനി സന്ദർശിക്കേണ്ടവർ'), r.households.filter((x) => !x.plan).length), ui.stat(t('Not yet asked for consent', 'സമ്മതം ചോദിച്ചിട്ടില്ല'), r.not_reachable, t('register them at the hub first', 'ആദ്യം രജിസ്റ്റർ ചെയ്യുക'))], 160));
  const def = await k.core.get('/forms/defs/' + encodeURIComponent(r.form_key)).catch(() => null);
  const consentText = t('"We agree to share that someone in our family may need help in an emergency with the disaster responders of this agency. We can withdraw this at any time."', '"അടിയന്തര ഘട്ടത്തിൽ ഞങ്ങളുടെ കുടുംബത്തിൽ ഒരാൾക്ക് സഹായം വേണ്ടിവരാം എന്ന വിവരം ഈ ഏജൻസിയുടെ ദുരന്ത പ്രതികരണ സംഘവുമായി പങ്കിടാൻ ഞങ്ങൾ സമ്മതിക്കുന്നു. എപ്പോൾ വേണമെങ്കിലും ഇത് പിൻവലിക്കാം."');
  el.append(ui.table([
    { key: 'name', label: t('Family', 'കുടുംബം'), render: (x) => h('span', null, h('b', null, x.name || '—'), x.head ? h('div', { class: 'small muted' }, x.head.name) : null) },
    { key: 'plan', label: t('Plan', 'പദ്ധതി'), render: (x) => (x.plan ? h('span', null, k.ui.badge('✓ ' + fmtDate(x.plan.captured_at), 'good'), x.plan.kit_ok ? null : k.ui.badge(t('kit incomplete', 'കിറ്റ് പൂർണ്ണമല്ല'), 'warn'), x.plan.help_needed.length ? k.ui.badge('🤝 ' + t('needs help', 'സഹായം വേണം'), 'info') : null) : k.ui.badge(t('no plan yet', 'ഇല്ല'), 'warn')) },
    { key: 'act', label: '', render: (x) => {
      if (!x.consented) return ui.button(t('Record consent', 'സമ്മതം രേഖപ്പെടുത്തുക'), async () => {
        if (!x.head) throw new Error(t('Head of family not visible to you.', 'കുടുംബനാഥനെ കാണാനാകില്ല.'));
        if (!(await ui.confirm(t('Read this aloud to the family. Did they agree?', 'ഇത് കുടുംബത്തിന് വായിച്ചുകൊടുക്കുക. അവർ സമ്മതിച്ചോ?') + '\n\n' + consentText))) return;
        await k.api.post('/consent', { person_id: x.head.id, read_aloud: true }); k.toast(t('Consent recorded', 'സമ്മതം രേഖപ്പെടുത്തി'), 'good'); k.refresh();
      }, { small: true });
      return def ? ui.button(x.plan ? t('Update plan', 'പുതുക്കുക') : t('Make plan', 'പദ്ധതി തയ്യാറാക്കുക'), () => {
        const box = h('div', null, h('div', { class: 'card', style: { background: '#fff8e1' } }, h('b', null, t('Consent (read aloud)', 'സമ്മതം (വായിച്ചുകേൾപ്പിക്കുക)')), h('p', null, consentText), say(k, '"We agree to share that someone in our family may need help in an emergency with the disaster responders of this agency. We can withdraw this at any time."', 'അടിയന്തര ഘട്ടത്തിൽ ഞങ്ങളുടെ കുടുംബത്തിൽ ഒരാൾക്ക് സഹായം വേണ്ടിവരാം എന്ന വിവരം ഈ ഏജൻസിയുടെ ദുരന്ത പ്രതികരണ സംഘവുമായി പങ്കിടാൻ ഞങ്ങൾ സമ്മതിക്കുന്നു. എപ്പോൾ വേണമെങ്കിലും ഇത് പിൻവലിക്കാം.')),
          ui.formFill(def, { household_id: x.id, onDone: (res) => { m.close(); k.toast(res && res.queued ? t('Saved on this device — will send later', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു') : t('Plan saved', 'പദ്ധതി സേവ് ചെയ്തു'), res && res.queued ? 'warn' : 'good'); if (res && Array.isArray(res.flags) && res.flags.some((f) => f.code === 'add_to_help_list')) k.go('#/m/disaster/help?hamlet=' + pick.id); else k.refresh(); } }));
        const m = ui.modal(t('Family plan — ', 'കുടുംബ പദ്ധതി — ') + (x.name || ''), box);
      }, { small: true, tone: x.plan ? 'ghost' : 'primary' }) : null;
    } },
  ], r.households, { empty: t('No families you can plan with here yet.', 'ഇവിടെ ഇതുവരെ കുടുംബങ്ങളില്ല.') }));
}

// ---------------------------------------------------------------- people needing help (responders only)
function forgetHelpCache(k) {
  try { const pre = 'aadi.c:' + (k.user && k.user.id) + ':/api/m/disaster/help'; for (const key of Object.keys(localStorage)) if (key.startsWith(pre)) localStorage.removeItem(key); } catch (_) { /* ignore */ }
}
async function help(el, k) {
  setup(k);
  const { h, t, ui } = k;
  if (!['field_officer', 'coordinator', 'agency_admin', 'platform_admin'].includes(k.user.role)) { forgetHelpCache(k); el.append(ui.empty(t('This list is only for disaster responders.', 'ഈ പട്ടിക ദുരന്ത പ്രതികരണ സംഘത്തിന് മാത്രം.'))); return; }
  const c = await cat(k);
  const NEED = Object.fromEntries(c.help_needs.map((x) => [x.key, x]));
  const pick = await hamletPicker(k, k.params.hamlet, (id) => k.go('#/m/disaster/help?hamlet=' + id));
  if (!pick.id) return;
  let r;
  try { r = await k.api.get('/help?hamlet_id=' + encodeURIComponent(pick.id)); } catch (e) { forgetHelpCache(k); throw e; }
  el.append(h('h1', null, '🤝 ' + t('People needing help to evacuate', 'ഒഴിപ്പിക്കാൻ സഹായം വേണ്ടവർ') + ' — ' + t(r.hamlet.name, r.hamlet.name_ml)), pick.el,
    h('div', { class: 'dis-conf' }, '🔒 ' + t(r.confidential, r.confidential_ml)),
    h('p', { class: 'small muted' }, t('Printed ', 'തയ്യാറാക്കിയത് ') + fmtWhen(r.generated_at) + (r._offline ? ' · ' + t('saved copy on this device', 'ഈ ഉപകരണത്തിലെ പകർപ്പ്') : '')),
    h('div', { class: 'row dis-noprint' }, ui.button('🖨️ ' + t('Print for the visit', 'സന്ദർശനത്തിനായി പ്രിന്റ്'), () => window.print(), { tone: 'primary' }),
      ui.button(t('Remove saved copy from this device', 'ഈ ഉപകരണത്തിലെ പകർപ്പ് മായ്ക്കുക'), () => { forgetHelpCache(k); k.toast(t('Removed', 'മായ്ച്ചു'), 'good'); }, { tone: 'ghost', small: true })));
  const needBadges = (ns) => ns.map((n) => ui.badge((NEED[n] ? NEED[n].icon + ' ' : '') + L(k, NEED[n]), 'info'));
  el.append(ui.section(t('People (named by their families, with consent)', 'ആളുകൾ (കുടുംബത്തിന്റെ സമ്മതത്തോടെ)'), h('div', { class: 'dis-help' }, ui.table([
    { key: 'name', label: t('Name', 'പേര്'), render: (p) => h('span', null, h('b', null, p.name), p.age !== null ? h('span', { class: 'small muted' }, ' · ' + p.age + t(' yrs', ' വയസ്സ്')) : null) },
    { key: 'household', label: t('Family / house', 'കുടുംബം / വീട്'), render: (p) => (p.household ? (p.household.name || '') + (p.household.house_no ? ' #' + p.household.house_no : '') : '—') },
    { key: 'needs', label: t('Help needed', 'വേണ്ട സഹായം'), render: (p) => h('span', null, needBadges(p.needs), p.note ? h('div', { class: 'small' }, p.note) : null) },
    { key: 'edit', label: '', render: (p) => h('span', { class: 'dis-noprint' }, ui.button(t('Change', 'മാറ്റുക'), () => editHelp(k, p, c, pick.id), { small: true, tone: 'ghost' })) },
  ], r.people, { empty: t('No one listed. Add people only when the family asks.', 'ആരെയും ചേർത്തിട്ടില്ല. കുടുംബം ആവശ്യപ്പെട്ടാൽ മാത്രം ചേർക്കുക.') }))));
  if (r.households.length) el.append(ui.section(t('Families whose plan says someone needs help (no person named yet)', 'സഹായം വേണമെന്ന് പദ്ധതിയിൽ പറഞ്ഞ കുടുംബങ്ങൾ'), ui.table([
    { key: 'name', label: t('Family', 'കുടുംബം'), render: (x) => (x.name || '—') + (x.house_no ? ' #' + x.house_no : '') },
    { key: 'needs', label: t('Help needed', 'വേണ്ട സഹായം'), render: (x) => h('span', null, needBadges(x.needs)) },
    { key: 'meeting_point', label: t('Meeting point', 'ഒത്തുചേരൽ'), render: (x) => x.meeting_point || '—' },
  ], r.households)));
  if (r.assembly_points.length) el.append(ui.card({ title: '🚩 ' + t('Assembly points', 'ഒത്തുചേരൽ സ്ഥലങ്ങൾ'), body: r.assembly_points.map((p) => h('div', null, h('b', null, t(p.name, p.name_ml || p.name)), p.lat !== null ? ' · ' + p.lat + ', ' + p.lng : '')) }));
  el.append(contactsCard(k, r.contacts, r.verify_note, r.verify_note_ml));
  // Add someone (only people who share "emergency" with this agency are offered).
  const add = h('div', { class: 'dis-noprint' });
  el.append(add);
  add.append(ui.button('➕ ' + t('Add a person the family asked to list', 'കുടുംബം ആവശ്യപ്പെട്ട ആളെ ചേർക്കുക'), async () => {
    const cands = (await k.api.get('/help/candidates?hamlet_id=' + encodeURIComponent(pick.id))).filter((p) => p.emergency && !p.listed);
    const box = h('div', null, cands.length ? ui.table([{ key: 'name', label: t('Name', 'പേര്') }, { key: 'age', label: t('Age', 'വയസ്സ്') }], cands, { onRow: (p) => { m.close(); editHelp(k, { person_id: p.id, name: p.name, needs: [], note: '' }, c, pick.id); } })
      : ui.empty(t('Nobody else here has agreed to share this with your agency. Record their consent first (Family plans).', 'മറ്റാരും നിങ്ങളുടെ ഏജൻസിയുമായി ഇത് പങ്കിടാൻ സമ്മതിച്ചിട്ടില്ല. ആദ്യം സമ്മതം രേഖപ്പെടുത്തുക.')));
    const m = ui.modal(t('Choose a person', 'ആളെ തിരഞ്ഞെടുക്കുക'), box);
  }, { tone: 'ghost' }));
}

function editHelp(k, p, c, hamletId) {
  const { h, t, ui } = k;
  const f = ui.form([
    { name: 'needs', type: 'multiselect', label: t('What help will they need? (plain categories only — no diagnoses)', 'എന്ത് സഹായം വേണം? (ലളിതമായി — രോഗവിവരം വേണ്ട)'), options: c.help_needs.map((n) => ({ value: n.key, label: n.icon + ' ' + L(k, n) })), value: p.needs || [] },
    { name: 'note', type: 'text', label: t('Short note (optional, no medical details)', 'ചെറിയ കുറിപ്പ് (രോഗവിവരം വേണ്ട)'), value: p.note || '' },
  ], async (v) => {
    await k.api.put('/help/' + encodeURIComponent(p.person_id), { needs: v.needs, note: v.note });
    m.close(); k.toast(t('Saved', 'സേവ് ചെയ്തു'), 'good'); k.refresh();
  }, { submitLabel: t('Save', 'സേവ് ചെയ്യുക') });
  const rm = (p.needs && p.needs.length) ? ui.button(t('Remove from list', 'പട്ടികയിൽ നിന്ന് നീക്കുക'), async () => { await k.api.del('/help/' + encodeURIComponent(p.person_id)); m.close(); k.refresh(); }, { tone: 'danger', small: true }) : null;
  const m = ui.modal(p.name, h('div', { class: 'stack' }, f, rm));
  void hamletId;
}

// ---------------------------------------------------------------- incidents
const OUTCOME_LABEL = (k, c, key) => { const o = c.incident_outcomes.find((x) => x.key === key); return o ? L(k, o) : key; };
function incidentCard(k, s, c, onOpen) {
  const { h, t, ui } = k;
  const a = s.answers || {};
  const st = { submitted: [t('Waiting for the district cell', 'ജില്ലാ സെല്ലിനെ കാത്തിരിക്കുന്നു'), 'warn'], in_review: [t('Being reviewed', 'പരിശോധനയിൽ'), 'info'], replied: [t('Reply ready', 'മറുപടി തയ്യാർ'), 'good'], closed: [t('Closed', 'അവസാനിച്ചു'), 'info'] }[s.status] || [s.status, 'info'];
  return h('div', { class: 'dis-q p' + (s.priority || 0), onclick: onOpen, role: 'button', tabindex: 0 },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, (a.what || []).join(', ') + ' · ' + t(s.hamlet, s.hamlet_ml)), ui.badge(st[0], st[1])),
    h('div', { class: 'small muted' }, fmtDate(a.date) + ' · ' + t('affected', 'ബാധിച്ചവർ') + ' ' + (a.people_affected ?? '—') + ' · ' + t('hurt', 'പരിക്ക്') + ' ' + (a.people_injured ?? 0) + ' · ' + t('houses', 'വീടുകൾ') + ' ' + (a.houses_damaged ?? 0) + (a.road_blocked === 'yes' ? ' · 🚧 ' + t('road blocked', 'വഴി അടഞ്ഞു') : '')),
    h('div', { class: 'row' }, (s.flags || []).map((f) => ui.badge(t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : 'info'))),
    s.reply ? h('p', null, '💬 ', t(s.reply, s.reply_ml || s.reply), s.outcome ? h('span', { class: 'small muted' }, ' · ' + OUTCOME_LABEL(k, c, s.outcome)) : null) : null);
}
async function incidents(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const c = await cat(k);
  const pick = await hamletPicker(k, k.params.hamlet, (id) => k.go('#/m/disaster/incidents?hamlet=' + id));
  el.append(h('h1', null, '🚨 ' + t('Incident reports', 'സംഭവ റിപ്പോർട്ടുകൾ')), h('p', { class: 'muted' }, t('Report what happened. It travels to the district disaster cell with the next sync; their reply comes back here. In a real emergency call 112 or 1077 first.', 'എന്താണ് സംഭവിച്ചതെന്ന് റിപ്പോർട്ട് ചെയ്യുക. അടുത്ത സിങ്കിൽ ജില്ലാ ദുരന്ത സെല്ലിലെത്തും; മറുപടി ഇവിടെ വരും. യഥാർത്ഥ അടിയന്തരാവസ്ഥയിൽ ആദ്യം 112 അല്ലെങ്കിൽ 1077 വിളിക്കുക.')), pick.el);
  const r = await k.api.get('/incidents' + (k.params.all === '1' || !pick.id ? '' : '?hamlet_id=' + encodeURIComponent(pick.id)));
  if (r.can_capture && pick.id) {
    const def = await k.core.get('/forms/defs/disaster.incident_report').catch(() => null);
    const holder = h('div');
    el.append(h('div', { class: 'dis-noprint' }, ui.button('➕ ' + t('New incident report', 'പുതിയ റിപ്പോർട്ട്'), () => {
      holder.replaceChildren(ui.card({ title: t('What happened?', 'എന്താണ് സംഭവിച്ചത്?'), body: ui.formFill(def, { hamlet_id: pick.id, answers: { date: new Date().toISOString().slice(0, 10), people_injured: 0, houses_damaged: 0 }, onDone: (res) => { k.toast(res && res.queued ? t('Saved on this device — will send with the next sync', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു') : t('Sent to the district cell', 'ജില്ലാ സെല്ലിലേക്ക് അയച്ചു'), res && res.queued ? 'warn' : 'good'); k.refresh(); } }) }));
    }, { tone: 'primary' }), holder));
    if (k.params.new === '1' && def) holder.append(ui.card({ title: t('What happened?', 'എന്താണ് സംഭവിച്ചത്?'), body: ui.formFill(def, { hamlet_id: pick.id, answers: { date: new Date().toISOString().slice(0, 10), people_injured: 0, houses_damaged: 0 }, onDone: () => k.go('#/m/disaster/incidents?hamlet=' + pick.id) }) }));
  }
  const open = (s) => openIncident(k, s, c);
  if (r.can_review) el.append(ui.section(t('To answer (most urgent first)', 'മറുപടി നൽകേണ്ടവ (അടിയന്തരം ആദ്യം)'), r.queue.length ? r.queue.map((s) => incidentCard(k, s, c, () => open(s))) : ui.empty(t('Nothing waiting.', 'ഒന്നും കാത്തിരിക്കുന്നില്ല.'))));
  el.append(ui.section(t('Recent reports', 'ഈയിടെയുള്ള റിപ്പോർട്ടുകൾ'), r.recent.length ? r.recent.map((s) => incidentCard(k, s, c, () => open(s))) : ui.empty(t('No reports yet.', 'റിപ്പോർട്ടുകളില്ല.'))));
}
async function openIncident(k, s0, c) {
  const { h, t, ui } = k;
  const s = await k.api.get('/incidents/' + s0.id);
  const a = s.answers || {};
  const body = h('div', { class: 'stack' }, incidentCard(k, s, c, null), a.details ? h('p', null, a.details) : null, s.photo ? h('img', { src: s.photo, alt: t('Photo of the damage', 'നാശത്തിന്റെ ഫോട്ടോ'), style: { maxWidth: '100%', borderRadius: '10px' } }) : null,
    (a.needs || []).length ? h('p', null, h('b', null, t('Needs: ', 'ആവശ്യങ്ങൾ: ')), a.needs.join(', ')) : null);
  if (s.can_reply) body.append(ui.form([
    { name: 'reply', type: 'textarea', label: t('Reply to the hamlet', 'ഊരിലേക്കുള്ള മറുപടി'), required: true },
    { name: 'reply_ml', type: 'textarea', label: t('Reply in Malayalam', 'മലയാളത്തിൽ മറുപടി') },
    { name: 'outcome', type: 'select', label: t('Outcome', 'ഫലം'), options: c.incident_outcomes.map((o) => ({ value: o.key, label: L(k, o) })), required: true },
    { name: 'close', type: 'checkbox', label: t('Close this report', 'ഈ റിപ്പോർട്ട് അവസാനിപ്പിക്കുക') },
  ], async (v) => { await k.api.post('/incidents/' + s.id + '/reply', v); m.close(); k.toast(t('Reply sent', 'മറുപടി അയച്ചു'), 'good'); k.refresh(); }, { submitLabel: t('Send reply', 'മറുപടി അയയ്ക്കുക') }));
  const m = ui.modal(t('Incident report', 'സംഭവ റിപ്പോർട്ട്'), body);
}

// ---------------------------------------------------------------- warnings (admins)
async function warnings(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const c = await cat(k);
  el.append(h('h1', null, '📢 ' + t('Warnings and advisories', 'മുന്നറിയിപ്പുകളും നിർദേശങ്ങളും')),
    h('p', { class: 'muted' }, t('Only agency admins and the platform steward issue warnings. Pass on official warnings (IMD, District Collector, KSDMA) in plain words — never invent one. Warnings reach each hub at its next sync.', 'ഏജൻസി അഡ്മിനും പ്ലാറ്റ്‌ഫോം സ്റ്റ്യൂവാർഡിനും മാത്രം. ഔദ്യോഗിക മുന്നറിയിപ്പുകൾ (IMD, ജില്ലാ കളക്ടർ, KSDMA) ലളിതമായി കൈമാറുക — സ്വന്തമായി ഉണ്ടാക്കരുത്. അടുത്ത സിങ്കിൽ ഓരോ ഹബ്ബിലും എത്തും.')));
  const hs = await k.api.get('/hamlets');
  const list = await k.api.get('/warnings?all=1');
  el.append(ui.card({ title: t('New warning', 'പുതിയ മുന്നറിയിപ്പ്'), body: ui.form([
    { name: 'hamlet_ids', type: 'multiselect', label: t('Hamlets', 'ഊരുകൾ'), options: hs.map((x) => ({ value: x.id, label: t(x.name, x.name_ml) })), value: k.params.hamlet ? [k.params.hamlet] : [] },
    { name: 'level', type: 'select', label: t('Level', 'തലം'), required: true, options: c.warning_levels.map((l) => ({ value: l.key, label: l.icon + ' ' + L(k, l) })) },
    { name: 'title', type: 'text', label: t('Title (English)', 'തലക്കെട്ട് (ഇംഗ്ലീഷ്)'), required: true },
    { name: 'title_ml', type: 'text', label: t('Title (Malayalam)', 'തലക്കെട്ട് (മലയാളം)') },
    { name: 'body', type: 'textarea', label: t('What should people do? (English)', 'ആളുകൾ എന്ത് ചെയ്യണം? (ഇംഗ്ലീഷ്)'), required: true },
    { name: 'body_ml', type: 'textarea', label: t('What should people do? (Malayalam)', 'ആളുകൾ എന്ത് ചെയ്യണം? (മലയാളം)') },
    { name: 'source', type: 'select', label: t('Official source', 'ഔദ്യോഗിക ഉറവിടം'), required: true, options: (c.warning_sources || []).map((x) => ({ value: x.key, label: L(k, x) })) },
    { name: 'valid_to', type: 'datetime-local', label: t('Valid until', 'വരെ സാധുവാണ്') },
  ], async (v) => {
    const r = await k.api.post('/warnings', { ...v, valid_to: v.valid_to ? new Date(v.valid_to).toISOString() : undefined });
    k.toast(r && r.queued ? t('Saved on this device — will send later', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു') : r && r.status === 'pending_confirmation' ? t('Red warning saved — a second person of your agency must confirm it before it is shown', 'ചുവപ്പ് മുന്നറിയിപ്പ് — നിങ്ങളുടെ ഏജൻസിയിലെ മറ്റൊരാൾ സ്ഥിരീകരിച്ചാലേ കാണിക്കൂ') : t('Warning issued', 'മുന്നറിയിപ്പ് നൽകി'), r && r.queued ? 'warn' : 'good'); k.refresh();
  }, { submitLabel: t('Issue warning', 'മുന്നറിയിപ്പ് നൽകുക') }) }));
  const names = Object.fromEntries(hs.map((x) => [x.id, t(x.name, x.name_ml)]));
  el.append(ui.section(t('Issued warnings', 'നൽകിയ മുന്നറിയിപ്പുകൾ'), list.length ? list.map((w) => h('div', null, warningBanner(k, w),
    h('div', { class: 'row small dis-noprint', style: { margin: '-6px 0 12px' } }, h('span', { class: 'muted' }, w.hamlet_ids.map((x) => names[x] || '').filter(Boolean).join(', ') + ' · ' + (w.status === 'cancelled' ? t('cancelled', 'റദ്ദാക്കി') : w.status === 'pending_confirmation' ? t('waiting for a second person to confirm', 'രണ്ടാമതൊരാൾ സ്ഥിരീകരിക്കണം') : w.active ? t('active', 'സജീവം') : t('not active', 'സജീവമല്ല'))),
      w.status === 'pending_confirmation' && k.user && w.issued_by_name !== k.user.display_name ? ui.button(t('Confirm red warning', 'സ്ഥിരീകരിക്കുക'), async () => { if (await ui.confirm(t('Have you checked this against the official bulletin? It will be shown on every hub.', 'ഔദ്യോഗിക അറിയിപ്പുമായി ഒത്തുനോക്കിയോ? എല്ലാ ഹബ്ബിലും കാണിക്കും.'))) { await k.api.post('/warnings/' + w.id + '/confirm'); k.refresh(); } }, { small: true, tone: 'primary' }) : null,
      w.status === 'active' || w.status === 'pending_confirmation' ? ui.button(t('Cancel warning', 'റദ്ദാക്കുക'), async () => { if (await ui.confirm(t('Cancel this warning on every hub?', 'എല്ലാ ഹബ്ബിലും ഈ മുന്നറിയിപ്പ് റദ്ദാക്കണോ?'))) { await k.api.post('/warnings/' + w.id + '/cancel'); k.refresh(); } }, { small: true, tone: 'danger' }) : null))) : ui.empty(t('No warnings yet.', 'മുന്നറിയിപ്പുകളില്ല.'))));
}

// ---------------------------------------------------------------- aggregate
async function aggregate(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const r = await k.api.get('/aggregate');
  el.append(h('h1', null, '📊 ' + t('Disaster preparedness — numbers', 'ദുരന്ത തയ്യാറെടുപ്പ് — എണ്ണം')),
    h('p', { class: 'muted' }, t(r.note, r.note_ml)), h('p', { class: 'small muted' }, t('Since ', 'മുതൽ ') + r.since + ' · ' + r.scope));
  el.append(ui.grid([
    ui.stat(t('Family plans', 'കുടുംബ പദ്ധതികൾ'), r.totals.plans, r.totals.plans_pct !== null ? r.totals.plans_pct + '% ' + t('of households', 'വീടുകളിൽ') : null),
    ui.stat(t('Incident reports', 'സംഭവ റിപ്പോർട്ടുകൾ'), r.totals.incidents), ui.stat(t('Urgent incidents', 'അടിയന്തര സംഭവങ്ങൾ'), r.totals.urgent_incidents),
    ui.stat(t('Warnings issued', 'മുന്നറിയിപ്പുകൾ'), r.totals.warnings_issued), ui.stat(t('Hamlets with a risk profile', 'വിവരമുള്ള ഊരുകൾ'), r.totals.hamlets_with_profile),
  ], 160));
  el.append(ui.section(t('By hamlet', 'ഊര് തിരിച്ച്'), ui.table([
    { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (x) => t(x.hamlet, x.hamlet_ml) + ' · ' + x.district },
    { key: 'plans', label: t('Plans', 'പദ്ധതികൾ'), render: (x) => x.plans_pct !== null ? h('div', null, String(x.plans), ui.progress(x.plans_pct / 100)) : String(x.plans) },
    { key: 'incidents', label: t('Incidents', 'സംഭവങ്ങൾ'), render: (x) => String(x.incidents) },
    { key: 'urgent_incidents', label: t('Urgent', 'അടിയന്തരം'), render: (x) => (x.urgent_incidents === null ? '—' : String(x.urgent_incidents)) },
  ], r.hamlets)));
}

export default { views: { home: board, board, plans, help, incidents, warnings, aggregate } };
