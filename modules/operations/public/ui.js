// AADI — Centre Operations UI. No DOM work at import time; CSS injected per view via k.style.
const CSS = `
.operations-head { display:flex; gap:12px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; margin-bottom:14px; }
.operations-head h1 { margin:0; }
.operations-tree details { border:1px solid var(--line); border-radius:var(--r-m); background:var(--surface); margin-bottom:10px; }
.operations-tree summary { cursor:pointer; padding:12px 14px; font-weight:700; display:flex; gap:10px; align-items:center; list-style:none; }
.operations-tree summary::-webkit-details-marker { display:none; }
.operations-tree summary::before { content:'▸'; color:var(--ink-3); transition:transform .15s; }
.operations-tree details[open] > summary::before { transform:rotate(90deg); }
.operations-tree .operations-inner { padding:0 14px 12px 26px; }
.operations-hamlet { border-top:1px dashed var(--line); padding:10px 0; }
.operations-hamlet h4 { margin:0 0 6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.operations-centres { display:grid; gap:8px; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); }
.operations-centre { border:1px solid var(--line); border-left:5px solid var(--c, var(--forest)); border-radius:var(--r-s); padding:10px 12px; background:#fbfcfb; }
.operations-centre.mine { background:var(--surface); cursor:pointer; }
.operations-centre.mine:hover { box-shadow:0 2px 10px rgba(0,0,0,.06); }
.operations-centre b { display:block; line-height:1.25; }
.operations-centre .operations-meta { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
.operations-dot { width:10px; height:10px; border-radius:50%; display:inline-block; background:var(--ink-3); }
.operations-dot.good { background:var(--good); } .operations-dot.warn { background:var(--gold); } .operations-dot.info { background:var(--info); }
.operations-steps { display:flex; gap:6px; margin:4px 0 16px; flex-wrap:wrap; }
.operations-steps span { padding:5px 12px; border-radius:999px; background:var(--paper); border:1px solid var(--line); font-size:.85rem; color:var(--ink-2); }
.operations-steps span.on { background:var(--forest); border-color:var(--forest); color:#fff; font-weight:700; }
.operations-steps span.done { background:var(--leaf-soft); color:#2f4f1c; }
.operations-kit { display:grid; gap:8px; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); }
.operations-kit label { display:flex; gap:10px; align-items:center; border:1px solid var(--line); border-radius:var(--r-s); padding:10px; background:var(--surface); }
.operations-kit input[type=number] { width:64px; }
.operations-kit .operations-ic { font-size:1.5rem; }
.operations-hub { border:1px solid var(--line); border-radius:var(--r-m); background:var(--surface); padding:14px; }
.operations-hub h3 { display:flex; gap:8px; align-items:center; margin-bottom:6px; }
.operations-gauges { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:10px 0; }
.operations-gauge { background:var(--paper); border-radius:var(--r-s); padding:8px; text-align:center; }
.operations-gauge .v { font-size:1.15rem; font-weight:700; color:var(--forest); }
.operations-gauge .l { font-size:.75rem; color:var(--ink-2); }
.operations-cond { text-transform:capitalize; }
.operations-tt { overflow-x:auto; border:1px solid var(--line); border-radius:var(--r-m); background:var(--surface); }
.operations-tt table { border-collapse:collapse; width:100%; min-width:700px; }
.operations-tt th, .operations-tt td { border-bottom:1px solid #edf1ef; border-right:1px solid #edf1ef; padding:6px; vertical-align:top; font-size:.85rem; }
.operations-tt th { background:#fbfcfb; color:var(--ink-2); position:sticky; top:0; }
.operations-tt td.time { font-weight:700; color:var(--ink-2); white-space:nowrap; }
.operations-slot { border-left:4px solid var(--c); background:color-mix(in srgb, var(--c) 9%, white); padding:4px 6px; border-radius:4px; margin-bottom:4px; line-height:1.25; }
.operations-slot.mine { outline:2px solid var(--gold); }
.operations-slot.clash { box-shadow:inset 0 0 0 1px var(--bad); }
.operations-legend { display:flex; gap:10px; flex-wrap:wrap; margin:10px 0; font-size:.85rem; }
.operations-legend span::before { content:''; display:inline-block; width:12px; height:12px; border-radius:3px; background:var(--c); margin-right:5px; vertical-align:-1px; }
.operations-day-list .operations-slot { font-size:.95rem; padding:8px 10px; }
.operations-budget { display:grid; gap:6px; }
.operations-bline { display:grid; grid-template-columns:minmax(90px,28%) 1fr auto; gap:10px; align-items:center; font-size:.9rem; }
.operations-btrack { position:relative; height:14px; background:#edf2ef; border-radius:4px; overflow:hidden; }
.operations-btrack .b { position:absolute; inset:0 auto 0 0; background:var(--leaf-soft); border-right:2px solid var(--leaf); }
.operations-btrack .a { position:absolute; left:0; top:3px; height:8px; background:var(--forest-2); border-radius:3px; }
.operations-btrack .a.over { background:var(--bad); }
.operations-trend { display:flex; gap:8px; align-items:flex-end; height:120px; padding:8px 0; }
.operations-trend div { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; font-size:.72rem; color:var(--ink-2); }
.operations-trend i { display:block; width:100%; max-width:34px; background:var(--forest-2); border-radius:3px 3px 0 0; position:relative; }
.operations-trend i.bud { background:transparent; border:2px dashed var(--gold); position:absolute; bottom:0; }
.operations-trend .col { position:relative; width:100%; max-width:34px; height:90px; display:flex; align-items:flex-end; }
@media (max-width:600px) { .operations-gauges { grid-template-columns:repeat(2,1fr); } }
`;

const rupee = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const ago = (iso) => { if (!iso) return '—'; const h = (Date.now() - new Date(iso)) / 3600e3; return h < 1 ? 'just now' : h < 24 ? Math.round(h) + ' h ago' : Math.round(h / 24) + ' d ago'; };
const condTone = (c) => ({ good: 'good', fair: 'info', needs_repair: 'warn', broken: 'bad', retired: '' }[c] || '');
const condLabel = (k, c) => ({ good: k.t('Good', 'നല്ലത്'), fair: k.t('Fair', 'ശരാശരി'), needs_repair: k.t('Needs repair', 'നന്നാക്കണം'), broken: k.t('Broken', 'കേടായി'), retired: k.t('Retired', 'ഒഴിവാക്കി') }[c] || c);
const statusTone = (s) => ({ open: 'bad', in_progress: 'warn', resolved: 'good' }[s] || '');
const statusLabel = (k, s) => ({ open: k.t('Open', 'തുറന്നത്'), in_progress: k.t('In progress', 'നടക്കുന്നു'), resolved: k.t('Resolved', 'പരിഹരിച്ചു') }[s] || s);

function header(k, title, sub, right) {
  return k.h('div', { class: 'operations-head' }, k.h('div', null, k.h('h1', null, title), sub ? k.h('p', { class: 'muted', style: { margin: 0 } }, sub) : null), right ? k.h('div', { class: 'row' }, right) : null);
}

// ---------------------------------------------------------------- centres
async function centres(el, k) {
  k.style(CSS, 'operations-css');
  el.append(k.ui.loading());
  const d = await k.api.get('/hierarchy');
  el.replaceChildren();
  el.append(header(k, k.t('Centres across hamlets', 'ഊരുകളിലെ കേന്ദ്രങ്ങൾ'), k.t('State → district → panchayat → hamlet → centres of every agency. Tap your centre for details.', 'സംസ്ഥാനം → ജില്ല → പഞ്ചായത്ത് → ഊര് → കേന്ദ്രങ്ങൾ'),
    d.can_setup ? k.ui.button('＋ ' + k.t('Set up a new centre', 'പുതിയ കേന്ദ്രം'), () => openWizard(k), { tone: 'primary' }) : null));
  el.append(k.ui.grid([
    k.ui.stat(k.t('Districts', 'ജില്ലകൾ'), d.totals.districts), k.ui.stat(k.t('Hamlets', 'ഊരുകൾ'), d.totals.hamlets),
    k.ui.stat(k.t('Centres (all agencies)', 'കേന്ദ്രങ്ങൾ'), d.totals.centres, k.t(`${d.totals.mine} run by your team`, `${d.totals.mine} നിങ്ങളുടേത്`)),
    k.ui.stat(k.t('Assets tracked', 'ഉപകരണങ്ങൾ'), d.totals.assets), k.ui.stat(k.t('Open repair tickets', 'തുറന്ന ടിക്കറ്റുകൾ'), d.totals.open_tickets),
  ], 160));
  const tree = k.h('div', { class: 'operations-tree', style: { marginTop: '18px' } });
  const state = k.h('details', { open: true }, k.h('summary', null, '🗺️ ', k.t('Kerala', 'കേരളം'), k.ui.pill(d.totals.districts + ' ' + k.t('districts', 'ജില്ലകൾ'))));
  const inner = k.h('div', { class: 'operations-inner' });
  for (const dist of d.tree.districts) {
    const hs = dist.panchayats.flatMap((p) => p.hamlets);
    const dEl = k.h('details', { open: d.tree.districts.length <= 3 }, k.h('summary', null, dist.name, k.ui.pill(hs.length + ' ' + k.t('hamlets', 'ഊരുകൾ')), k.ui.pill(hs.reduce((s, h) => s + h.centres.length, 0) + ' ' + k.t('centres', 'കേന്ദ്രങ്ങൾ'))));
    const dIn = k.h('div', { class: 'operations-inner' });
    for (const p of dist.panchayats) {
      dIn.append(k.h('div', { class: 'small muted', style: { marginTop: '6px' } }, '🏛️ ', p.name));
      for (const h of p.hamlets) {
        dIn.append(k.h('div', { class: 'operations-hamlet' },
          k.h('h4', null, k.t(h.name, h.name_ml), k.h('span', { class: 'small muted' }, h.community), k.ui.badge('📶 ' + h.connectivity, h.connectivity === 'none' ? 'bad' : h.connectivity === '2g' ? 'warn' : 'good'), k.ui.badge('⚡ ' + h.power, h.power === 'none' ? 'bad' : h.power === 'solar' ? 'warn' : 'good'),
            k.h('a', { href: `#/m/operations/timetable?hamlet_id=${h.id}`, class: 'small' }, k.t('timetable', 'സമയപ്പട്ടിക'))),
          k.h('div', { class: 'operations-centres' }, h.centres.map((c) => centreCard(k, c)))));
      }
    }
    dEl.append(dIn);
    inner.append(dEl);
  }
  state.append(inner);
  tree.append(state);
  el.append(tree);
}
function centreCard(k, c) {
  const lvl = c.health ? c.health.status.level : null;
  return k.h('div', { class: 'operations-centre' + (c.mine ? ' mine' : ''), style: { '--c': c.agency_colour || '#0b4f45' }, onclick: c.mine ? () => openCentre(k, c.id) : null, title: c.mine ? k.t('Open details', 'വിശദാംശങ്ങൾ') : '' },
    k.h('b', null, c.name), k.h('span', { class: 'small muted' }, c.agency_name),
    k.h('div', { class: 'operations-meta' },
      k.ui.badge(c.kind === 'hub' ? '🖥️ hub' : 'centre', c.kind === 'hub' ? 'info' : ''),
      !c.core ? k.ui.badge(k.t('setting up', 'ഒരുക്കുന്നു'), 'warn') : null,
      k.ui.pill(c.programmes + ' ' + k.t('programmes', 'പരിപാടികൾ')),
      c.mine ? k.ui.pill('🔧 ' + c.assets) : null,
      c.mine && c.open_tickets ? k.ui.badge(c.open_tickets + ' ' + k.t('tickets', 'ടിക്കറ്റ്'), 'warn') : null,
      lvl ? k.h('span', { class: 'small', title: (c.health.status.issues || []).join(', ') }, k.h('span', { class: 'operations-dot ' + lvl }), ' ', k.t('sync', 'സിങ്ക്') + ' ' + ago(c.health.last_sync)) : null));
}
async function openCentre(k, id) {
  const box = k.h('div', null, k.ui.loading());
  const m = k.ui.modal(k.t('Centre', 'കേന്ദ്രം'), box);
  try {
    const c = await k.api.get('/centres/' + id);
    box.replaceChildren(
      k.h('h3', null, c.name), k.h('p', { class: 'muted' }, `${c.agency_name} · ${c.hamlet?.name} (${c.hamlet?.district})`),
      c.health ? healthGauges(k, c.health) : null,
      k.ui.section(k.t('Programmes', 'പരിപാടികൾ'), k.ui.table([{ key: 'title', label: k.t('Programme', 'പരിപാടി'), render: (r) => k.t(r.title, r.title_ml) }, { key: 'schedule', label: k.t('When', 'എപ്പോൾ'), render: (r) => (r.schedule || []).join(', ') }, { key: 'enrolled', label: k.t('Enrolled', 'ചേർന്നവർ'), render: (r) => `${r.enrolled}/${r.capacity}` }], c.programmes)),
      k.ui.section(k.t('Staff', 'ജീവനക്കാർ'), c.staff.length ? k.h('div', { class: 'row' }, c.staff.map((s) => k.ui.pill(`${s.name} · ${s.role_label}`))) : k.ui.empty(k.t('No staff assigned yet.', 'ജീവനക്കാരില്ല.'))),
      k.h('div', { class: 'row' }, k.ui.button(k.t('Assets', 'ഉപകരണങ്ങൾ'), () => { m.close(); k.go('#/m/operations/assets?centre_id=' + c.id); }), k.ui.button(k.t('Expenses', 'ചെലവുകൾ'), () => { m.close(); k.go('#/m/operations/finance?centre_id=' + c.id); }, { tone: 'ghost' })));
  } catch (e) { box.replaceChildren(k.ui.error(e)); }
}

// ---------------------------------------------------------------- setup wizard
async function openWizard(k) {
  const opts = await k.api.get('/setup/options');
  const st = { step: 0, hamlet_id: opts.hamlets[0]?.id, agency_id: opts.agencies[0]?.id, name: '', kind: 'hub', funded_by: '', kit: opts.kit.map((x) => ({ ...x, have: false })), facilitator_ids: [], programmes: [{ track: 'tuition', title: 'Tuition Class 1–4', title_ml: 'ട്യൂഷൻ ക്ലാസ് 1–4', schedule: ['Mon 16:00', 'Wed 16:00', 'Fri 16:00'], capacity: 25 }] };
  const STEPS = [k.t('Hamlet', 'ഊര്'), k.t('Hub kit', 'ഹബ് കിറ്റ്'), k.t('People', 'ആളുകൾ'), k.t('Programmes', 'പരിപാടികൾ'), k.t('Review', 'പരിശോധന')];
  const body = k.h('div');
  const m = k.ui.modal(k.t('Set up a centre — replicate the model AADI centre', 'പുതിയ കേന്ദ്രം — മാതൃകാ കേന്ദ്രം പകർത്തുക'), body);
  const hamlet = () => opts.hamlets.find((h) => h.id === st.hamlet_id) || {};
  const render = () => {
    const steps = k.h('div', { class: 'operations-steps' }, STEPS.map((s, i) => k.h('span', { class: i === st.step ? 'on' : i < st.step ? 'done' : '' }, `${i + 1}. ${s}`)));
    let content;
    if (st.step === 0) {
      const sel = k.h('select', { class: 'input', onchange: (e) => { st.hamlet_id = e.target.value; render(); } }, opts.hamlets.map((h) => k.h('option', { value: h.id, selected: h.id === st.hamlet_id }, `${k.t(h.name, h.name_ml)} · ${h.district}`)));
      const ag = k.h('select', { class: 'input', onchange: (e) => { st.agency_id = e.target.value; } }, opts.agencies.map((a) => k.h('option', { value: a.id, selected: a.id === st.agency_id }, a.name)));
      const nm = k.h('input', { class: 'input', placeholder: `AADI Smart Learning Centre — ${hamlet().name || ''}`, value: st.name, oninput: (e) => { st.name = e.target.value; } });
      const h = hamlet();
      content = k.h('div', { class: 'stack' },
        k.h('label', null, k.t('Hamlet', 'ഊര്'), sel), k.h('label', null, k.t('Agency', 'ഏജൻസി'), ag), k.h('label', null, k.t('Centre name', 'കേന്ദ്രത്തിന്റെ പേര്'), nm),
        k.h('div', { class: 'card', style: { background: 'var(--paper)' } }, k.h('b', null, k.t('Site conditions', 'സാഹചര്യം')), k.h('p', { class: 'small', style: { margin: '4px 0 0' } },
          `📶 ${h.connectivity} · ⚡ ${h.power}. `, h.connectivity === 'none' ? k.t('No network: the hub will sync by USB courier bundles.', 'നെറ്റ്‌വർക്ക് ഇല്ല: USB വഴി സിങ്ക്.') : h.connectivity === '2g' ? k.t('2G: hub syncs in the background, small payloads.', '2G: പശ്ചാത്തല സിങ്ക്.') : k.t('4G: live sync.', '4G: തത്സമയ സിങ്ക്.'),
          ' ', h.power !== 'grid' ? k.t('Plan for solar + battery.', 'സോളാർ + ബാറ്ററി വേണം.') : '')));
    } else if (st.step === 1) {
      if (hamlet().power !== 'grid') { const s = st.kit.find((x) => x.key === 'solar'); if (s && !s._touched) s.qty = Math.max(1, s.qty); }
      content = k.h('div', null, k.h('p', { class: 'muted' }, k.t('Model kit from the pilot centre. Tick what is already on site — those become tracked assets now; the rest becomes a procurement list.', 'ഉള്ളവ ടിക്ക് ചെയ്യുക.')),
        k.h('div', { class: 'operations-kit' }, st.kit.map((x) => k.h('label', null,
          k.h('input', { type: 'checkbox', checked: x.have, onchange: (e) => { x.have = e.target.checked; } }),
          k.h('span', { class: 'operations-ic' }, opts.asset_kinds[x.key]?.icon || '📦'),
          k.h('span', { style: { flex: 1 } }, k.t(x.en, x.ml)),
          k.h('input', { type: 'number', class: 'input', min: 0, max: 60, value: x.qty, 'aria-label': k.t('Quantity', 'എണ്ണം'), oninput: (e) => { x.qty = Number(e.target.value) || 0; x._touched = true; } })))),
        k.h('label', { style: { marginTop: '10px', display: 'block' } }, k.t('Funded by (optional)', 'ഫണ്ട്'), k.h('input', { class: 'input', value: st.funded_by, oninput: (e) => { st.funded_by = e.target.value; } })));
    } else if (st.step === 2) {
      const facs = opts.facilitators.filter((f) => f.agency_id === st.agency_id);
      content = k.h('div', null, k.h('p', { class: 'muted' }, k.t('Assign facilitators. Only safeguarding-trained staff can work with children.', 'ഫെസിലിറ്റേറ്റർമാരെ ചേർക്കുക.')),
        facs.length ? k.h('div', { class: 'stack' }, facs.map((f) => k.h('label', { class: 'cb' }, k.h('input', { type: 'checkbox', disabled: !f.trained || !f.active, checked: st.facilitator_ids.includes(f.id), onchange: (e) => { st.facilitator_ids = e.target.checked ? [...st.facilitator_ids, f.id] : st.facilitator_ids.filter((x) => x !== f.id); } }), ' ', f.name, ' ', f.trained ? k.ui.badge('✓ ' + k.t('safeguarding', 'സുരക്ഷാ പരിശീലനം'), 'good') : k.ui.badge(k.t('training pending', 'പരിശീലനം ബാക്കി'), 'warn'))))
          : k.ui.empty(k.t('No facilitators in this agency yet — add staff from Users first.', 'ഫെസിലിറ്റേറ്റർമാരില്ല.')));
    } else if (st.step === 3) {
      const list = k.h('div', { class: 'stack' });
      st.programmes.forEach((p, i) => {
        list.append(k.h('div', { class: 'card' }, k.h('div', { class: 'row' },
          k.h('select', { class: 'input', onchange: (e) => { p.track = e.target.value; } }, opts.tracks.map((t) => k.h('option', { value: t, selected: t === p.track }, t))),
          k.h('input', { class: 'input', style: { flex: 1, minWidth: '160px' }, value: p.title, placeholder: k.t('Title', 'തലക്കെട്ട്'), oninput: (e) => { p.title = e.target.value; } }),
          k.h('input', { class: 'input', type: 'number', style: { width: '80px' }, value: p.capacity, oninput: (e) => { p.capacity = Number(e.target.value); }, 'aria-label': k.t('Capacity', 'ശേഷി') }),
          k.ui.button('✕', () => { st.programmes.splice(i, 1); render(); }, { tone: 'ghost', small: true })),
        k.h('div', { class: 'row small', style: { marginTop: '8px' } }, opts.slots.map((s) => k.h('label', null, k.h('input', { type: 'checkbox', checked: p.schedule.includes(s), onchange: (e) => { p.schedule = e.target.checked ? [...p.schedule, s] : p.schedule.filter((x) => x !== s); } }), ' ', s)))));
      });
      content = k.h('div', null, k.h('p', { class: 'muted' }, k.t('First programmes are registered with the AADI brain and appear in the hamlet timetable.', 'ആദ്യ പരിപാടികൾ.')), list,
        k.ui.button('＋ ' + k.t('Add programme', 'പരിപാടി ചേർക്കുക'), () => { st.programmes.push({ track: 'language', title: 'English Speaking Club', schedule: ['Sat 10:00'], capacity: 20 }); render(); }, { tone: 'ghost' }));
    } else {
      const h = hamlet();
      content = k.h('div', null, k.ui.kv([
        [k.t('Hamlet', 'ഊര്'), `${h.name} · ${h.district}`], [k.t('Name', 'പേര്'), st.name || `AADI Smart Learning Centre — ${h.name}`],
        [k.t('Kit on site', 'ഉള്ള കിറ്റ്'), st.kit.filter((x) => x.have).map((x) => `${x.qty}× ${x.en}`).join(', ') || '—'],
        [k.t('To procure', 'വാങ്ങേണ്ടത്'), st.kit.filter((x) => !x.have && x.qty).map((x) => `${x.qty}× ${x.en}`).join(', ') || '—'],
        [k.t('Facilitators', 'ഫെസിലിറ്റേറ്റർമാർ'), String(st.facilitator_ids.length)], [k.t('Programmes', 'പരിപാടികൾ'), st.programmes.map((p) => `${p.title} (${p.schedule.join(', ')})`).join('; ') || '—'],
      ]));
    }
    const nav = k.h('div', { class: 'row', style: { marginTop: '16px' } },
      st.step > 0 ? k.ui.button('← ' + k.t('Back', 'പിന്നോട്ട്'), () => { st.step--; render(); }, { tone: 'ghost' }) : null,
      k.h('span', { class: 'spacer' }),
      st.step < STEPS.length - 1 ? k.ui.button(k.t('Next', 'അടുത്തത്') + ' →', () => { st.step++; render(); }, { tone: 'primary' })
        : k.ui.button('✓ ' + k.t('Create centre', 'കേന്ദ്രം സൃഷ്ടിക്കുക'), async () => {
          const r = await k.api.post('/setup', { hamlet_id: st.hamlet_id, agency_id: st.agency_id, name: st.name, kind: st.kind, funded_by: st.funded_by, kit: st.kit.map(({ key, qty, have }) => ({ key, qty, have })), facilitator_ids: st.facilitator_ids, programmes: st.programmes });
          if (r.queued) { k.toast(k.t('Saved offline — will be created when the hub is back online.', 'ഓഫ്‌ലൈനായി സൂക്ഷിച്ചു.'), 'warn'); m.close(); return; }
          k.toast(k.t(`Centre created · ${r.assets} assets · ${r.programmes.length} programmes`, 'കേന്ദ്രം സൃഷ്ടിച്ചു'), 'good');
          m.close(); k.refresh();
        }, { tone: 'primary' }));
    body.replaceChildren(steps, content, nav);
  };
  render();
}

// ---------------------------------------------------------------- assets + hub health
function healthGauges(k, hl) {
  const used = hl.storage_total_gb ? Math.round((hl.storage_used_gb / hl.storage_total_gb) * 100) : null;
  return k.h('div', { class: 'operations-gauges' },
    k.h('div', { class: 'operations-gauge' }, k.h('div', { class: 'v' }, ago(hl.last_sync)), k.h('div', { class: 'l' }, k.t('last sync', 'അവസാന സിങ്ക്'))),
    k.h('div', { class: 'operations-gauge' }, k.h('div', { class: 'v' }, hl.battery_pct == null ? '—' : hl.battery_pct + '%'), k.h('div', { class: 'l' }, '⚡ ' + (hl.power_source || ''))),
    k.h('div', { class: 'operations-gauge' }, k.h('div', { class: 'v' }, '▂▄▆█'.slice(0, Math.max(0, Math.min(4, hl.signal_bars || 0))) || '✕'), k.h('div', { class: 'l' }, '📶 ' + (hl.connectivity || ''))),
    k.h('div', { class: 'operations-gauge' }, k.h('div', { class: 'v' }, used == null ? '—' : used + '%'), k.h('div', { class: 'l' }, k.t('storage', 'സംഭരണം') + ` ${Math.round(hl.storage_used_gb)}/${hl.storage_total_gb} GB`)));
}

async function assets(el, k) {
  k.style(CSS, 'operations-css');
  el.append(header(k, k.t('Assets & hub health', 'ഉപകരണങ്ങൾ, ഹബ് ആരോഗ്യം'), k.t('Tablets, phones, hubs and solar kits — with condition, who holds them and repair tickets.', 'ടാബ്‌ലെറ്റുകൾ, ഫോണുകൾ, ഹബ്, സോളാർ.')));
  el.append(k.ui.tabs([
    { id: 'inv', label: '🔧 ' + k.t('Inventory', 'ഇൻവെന്ററി'), render: (b) => inventory(b, k) },
    { id: 'tickets', label: '🎫 ' + k.t('Repair tickets', 'റിപ്പയർ ടിക്കറ്റുകൾ'), render: (b) => tickets(b, k) },
    { id: 'health', label: '🩺 ' + k.t('Hub health', 'ഹബ് ആരോഗ്യം'), render: (b) => hubHealth(b, k) },
  ], k.params.tab || 'inv'));
}
async function inventory(b, k) {
  const q = new URLSearchParams();
  if (k.params.centre_id) q.set('centre_id', k.params.centre_id);
  const d = await k.api.get('/assets?' + q);
  const kinds = d.kinds;
  b.append(k.ui.grid(Object.entries(d.summary).map(([kind, s]) => k.h('div', { class: 'stat' }, k.h('div', { class: 'v' }, (kinds[kind]?.icon || '') + ' ' + s.total), k.h('div', { class: 'l' }, k.t(kinds[kind]?.en || kind, kinds[kind]?.ml)), s.attention ? k.h('div', { class: 'hint', style: { color: 'var(--warn)' } }, s.attention + ' ' + k.t('need attention', 'ശ്രദ്ധ വേണം')) : k.h('div', { class: 'hint' }, k.t('all working', 'എല്ലാം പ്രവർത്തിക്കുന്നു')))), 150));
  const filt = k.h('select', { class: 'input', style: { maxWidth: '220px' } }, k.h('option', { value: '' }, k.t('All conditions', 'എല്ലാം')), d.conditions.map((c) => k.h('option', { value: c }, condLabel(k, c))));
  const list = k.h('div', { style: { marginTop: '12px' } });
  const draw = () => {
    const rows = d.assets.filter((a) => !filt.value || a.condition === filt.value);
    list.replaceChildren(k.ui.table([
      { key: 'label', label: k.t('Asset', 'ഉപകരണം'), render: (r) => k.h('span', null, (kinds[r.kind]?.icon || '') + ' ', k.h('b', null, r.label), k.h('div', { class: 'small muted mono' }, r.serial || '')) },
      { key: 'centre_name', label: k.t('Centre', 'കേന്ദ്രം'), render: (r) => k.h('span', { class: 'small' }, r.centre_name) },
      { key: 'condition', label: k.t('Condition', 'അവസ്ഥ'), render: (r) => k.ui.badge(condLabel(k, r.condition), condTone(r.condition)) },
      { key: 'assigned_name', label: k.t('Held by', 'കൈവശം') },
      { key: 'open_tickets', label: k.t('Tickets', 'ടിക്കറ്റ്'), render: (r) => (r.open_tickets ? k.ui.badge(String(r.open_tickets), 'warn') : '—') },
      { key: 'x', label: '', render: (r) => (r.can_edit ? k.h('div', { class: 'row' }, k.ui.button(k.t('Edit', 'മാറ്റുക'), () => editAsset(k, r, d), { small: true, tone: 'ghost' }), k.ui.button(k.t('Report', 'റിപ്പോർട്ട്'), () => newTicket(k, r), { small: true, tone: 'ghost' })) : '') },
    ], rows, { empty: k.t('No assets recorded for this view.', 'ഉപകരണങ്ങളില്ല.') }));
  };
  filt.addEventListener('change', draw);
  b.append(k.h('div', { class: 'row', style: { marginTop: '16px' } }, filt, k.params.centre_id ? k.ui.button(k.t('All my centres', 'എല്ലാ കേന്ദ്രങ്ങളും'), () => k.go('#/m/operations/assets'), { tone: 'ghost', small: true }) : null, k.h('span', { class: 'spacer' }), k.ui.button('＋ ' + k.t('Add asset', 'ഉപകരണം ചേർക്കുക'), () => editAsset(k, null, d), { tone: 'primary' })));
  b.append(list); draw();
}
async function editAsset(k, a, d) {
  const hier = await k.api.get('/hierarchy');
  const mine = hier.tree.districts.flatMap((x) => x.panchayats.flatMap((p) => p.hamlets.flatMap((h) => h.centres))).filter((c) => c.mine);
  const fields = [
    a ? { type: 'hidden', name: 'id', value: a.id } : { name: 'centre_id', label: k.t('Centre', 'കേന്ദ്രം'), type: 'select', required: true, options: mine.map((c) => ({ value: c.id, label: c.name })), value: k.params.centre_id },
    a ? null : { name: 'kind', label: k.t('Type', 'തരം'), type: 'select', required: true, options: Object.entries(d.kinds).map(([v, x]) => ({ value: v, label: `${x.icon} ${x.en}` })) },
    { name: 'label', label: k.t('Label', 'പേര്'), value: a?.label },
    { name: 'serial', label: k.t('Serial no.', 'സീരിയൽ'), value: a?.serial },
    { name: 'condition', label: k.t('Condition', 'അവസ്ഥ'), type: 'select', required: true, value: a?.condition || 'good', options: d.conditions.map((c) => ({ value: c, label: condLabel(k, c) })) },
    { name: 'funded_by', label: k.t('Funded by', 'ഫണ്ട്'), value: a?.funded_by },
    { name: 'notes', label: k.t('Notes', 'കുറിപ്പ്'), type: 'textarea', value: a?.notes },
  ].filter(Boolean);
  const m = k.ui.modal(a ? k.t('Edit asset', 'ഉപകരണം മാറ്റുക') : k.t('Add asset', 'ഉപകരണം ചേർക്കുക'), k.ui.form(fields, async (v) => { await k.api.post('/assets', v); k.toast(k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); m.close(); k.refresh(); }));
}
function newTicket(k, asset) {
  const m = k.ui.modal(k.t('Report a problem', 'പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക') + ' — ' + asset.label, k.ui.form([
    { name: 'title', label: k.t('What is wrong?', 'എന്താണ് പ്രശ്നം?'), required: true, placeholder: k.t('e.g. Screen cracked', 'ഉദാ: സ്ക്രീൻ പൊട്ടി') },
    { name: 'priority', label: k.t('Priority', 'മുൻഗണന'), type: 'select', value: 'normal', required: true, options: ['low', 'normal', 'high', 'urgent'] },
    { name: 'detail', label: k.t('Details', 'വിശദാംശം'), type: 'textarea' },
  ], async (v) => { await k.api.post('/tickets', { ...v, asset_id: asset.id }); k.toast(k.t('Ticket opened', 'ടിക്കറ്റ് തുറന്നു'), 'good'); m.close(); k.refresh(); }, { submitLabel: k.t('Open ticket', 'ടിക്കറ്റ് തുറക്കുക') }));
}
async function tickets(b, k) {
  const rows = await k.api.get('/tickets' + (k.params.centre_id ? '?centre_id=' + k.params.centre_id : ''));
  const counts = { open: 0, in_progress: 0, resolved: 0 };
  for (const r of rows) counts[r.status]++;
  b.append(k.ui.grid([k.ui.stat(k.t('Open', 'തുറന്നത്'), counts.open), k.ui.stat(k.t('In progress', 'നടക്കുന്നു'), counts.in_progress), k.ui.stat(k.t('Resolved (6 months)', 'പരിഹരിച്ചവ'), counts.resolved)], 150));
  b.append(k.h('div', { style: { marginTop: '14px' } }, k.ui.table([
    { key: 'title', label: k.t('Problem', 'പ്രശ്നം'), render: (r) => k.h('div', null, k.h('b', null, r.title), k.h('div', { class: 'small muted' }, `${r.asset_label || '—'} · ${r.centre_name}`)) },
    { key: 'priority', label: k.t('Priority', 'മുൻഗണന'), render: (r) => k.ui.badge(r.priority, r.priority === 'urgent' ? 'bad' : r.priority === 'high' ? 'warn' : '') },
    { key: 'status', label: k.t('Status', 'നില'), render: (r) => k.ui.badge(statusLabel(k, r.status), statusTone(r.status)) },
    { key: 'opened_at', label: k.t('Opened', 'തുറന്നത്'), render: (r) => k.h('span', { class: 'small' }, ago(r.opened_at)) },
    { key: 'x', label: '', render: (r) => (r.can_edit ? k.h('div', { class: 'row' }, r.next.map((n) => k.ui.button(n === 'in_progress' ? k.t('Start', 'തുടങ്ങുക') : n === 'resolved' ? k.t('Resolve', 'പരിഹരിച്ചു') : k.t('Reopen', 'വീണ്ടും തുറക്കുക'), async () => {
      const note = n === 'resolved' ? prompt(k.t('What fixed it?', 'എങ്ങനെ പരിഹരിച്ചു?')) || '' : '';
      await k.api.post(`/tickets/${r.id}/status`, { status: n, note }); k.toast(k.t('Updated', 'പുതുക്കി'), 'good'); k.refresh();
    }, { small: true, tone: n === 'resolved' ? 'primary' : 'ghost' }))) : '') },
  ], rows, { empty: k.t('No tickets — everything is working.', 'ടിക്കറ്റുകളില്ല.'), onRow: (r) => k.ui.modal(r.title, k.h('div', null, k.ui.kv([[k.t('Centre', 'കേന്ദ്രം'), r.centre_name], [k.t('Asset', 'ഉപകരണം'), r.asset_label], [k.t('Assignee', 'ചുമതല'), r.assignee], [k.t('Resolution', 'പരിഹാരം'), r.resolution]]), k.h('ol', { class: 'small' }, (r.history || []).map((x) => k.h('li', null, `${new Date(x.at).toLocaleDateString()} · ${x.status} · ${x.by}${x.note ? ' — ' + x.note : ''}`))))) })));
}
async function hubHealth(b, k) {
  const [d, core, sync] = await Promise.all([k.api.get('/hub-health'), k.core.get('/health').catch(() => null), fetch('/api/sync/status', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
  // This node — real values
  const thisNode = k.h('div', { class: 'operations-hub', style: { borderColor: 'var(--forest-2)' } },
    k.h('h3', null, '🖥️ ', k.t('This node (live)', 'ഈ നോഡ് (തത്സമയം)'), k.ui.badge(d.node.role, 'info')),
    core ? k.ui.kv([
      [k.t('Node', 'നോഡ്'), k.h('span', { class: 'mono' }, core.node)], [k.t('Events in log', 'ഇവന്റുകൾ'), core.events.toLocaleString()], [k.t('Last event', 'അവസാന ഇവന്റ്'), ago(core.last_event)],
      [k.t('Modules up', 'മൊഡ്യൂളുകൾ'), `${core.modules.filter((m) => m.state === 'up').length}/${core.modules.length}`],
      sync ? [k.t('Upstream', 'അപ്‌സ്ട്രീം'), sync.upstream || k.t('none (this is the cloud)', 'ഇല്ല (ക്ലൗഡ്)')] : null,
      sync && sync.upstream ? [k.t('Last sync', 'അവസാന സിങ്ക്'), sync.lastRun ? ago(sync.lastRun.at) : sync.lastError || '—'] : null,
      sync && sync.upstream ? [k.t('Waiting to push', 'അയയ്ക്കാനുള്ളവ'), String(sync.pending_to_push)] : null,
      sync ? [k.t('Nodes seen', 'നോഡുകൾ'), sync.nodes.map((n) => `${n.node} (${n.events})`).join(', ')] : null,
    ]) : k.ui.error(k.t('Health endpoint unreachable — you may be offline.', 'ലഭ്യമല്ല — ഓഫ്‌ലൈൻ ആയിരിക്കാം.')));
  b.append(thisNode);
  b.append(k.h('h3', { style: { marginTop: '18px' } }, k.t('Centre hubs (last reported by each hub agent)', 'കേന്ദ്ര ഹബുകൾ')));
  b.append(k.ui.grid(d.hubs.map((hb) => {
    const l = hb.latest;
    return k.h('div', { class: 'operations-hub' },
      k.h('h3', null, k.h('span', { class: 'operations-dot ' + (l ? l.status.level : '') }), k.t(hb.hamlet, hb.hamlet_ml)),
      k.h('div', { class: 'small muted' }, hb.name),
      l ? healthGauges(k, l) : k.ui.empty(k.t('No readings yet', 'വിവരമില്ല')),
      l && l.status.issues.length ? k.h('div', { class: 'row' }, l.status.issues.map((i) => k.ui.badge({ sync_overdue: k.t('sync overdue', 'സിങ്ക് വൈകി'), low_battery: k.t('low battery', 'ബാറ്ററി കുറവ്'), storage_high: k.t('storage high', 'സംഭരണം നിറയുന്നു'), hot: k.t('running hot', 'ചൂട് കൂടുതൽ') }[i] || i, 'warn'))) : null,
      hb.series.length > 1 ? k.h('div', { class: 'row small muted', style: { marginTop: '8px' } }, k.t('Battery 14d', 'ബാറ്ററി'), k.ui.spark(hb.series.map((x) => x.battery_pct)), k.t('Pending', 'ബാക്കി'), k.ui.spark(hb.series.map((x) => x.pending_events))) : null);
  }), 280));
}

// ---------------------------------------------------------------- staff & duty
async function staff(el, k) {
  k.style(CSS, 'operations-css');
  const d = await k.api.get('/staff');
  el.append(header(k, k.t('Staff & duty roster', 'ജീവനക്കാർ, ഡ്യൂട്ടി'), k.t('Who works where and when, across your agency’s centres.', 'ആര്, എവിടെ, എപ്പോൾ.'),
    d.can_edit ? k.ui.button('＋ ' + k.t('Add duty', 'ഡ്യൂട്ടി ചേർക്കുക'), () => addDuty(k, d), { tone: 'primary' }) : null));
  el.append(k.ui.tabs([
    { id: 'roster', label: k.t('Weekly roster', 'ആഴ്ച റോസ്റ്റർ'), render: (b) => {
      const times = [...new Set(d.duty.map((x) => x.slot))].sort();
      if (!times.length) { b.append(k.ui.empty(k.t('No duties yet.', 'ഡ്യൂട്ടി ഇല്ല.'))); return; }
      const tbl = k.h('table', null, k.h('thead', null, k.h('tr', null, k.h('th', null, ''), d.days.map((x) => k.h('th', null, x)))),
        k.h('tbody', null, times.map((t) => k.h('tr', null, k.h('td', { class: 'time' }, t), d.days.map((day) => k.h('td', null, d.duty.filter((x) => x.weekday === day && x.slot === t).map((x) => k.h('div', { class: 'operations-slot', style: { '--c': '#0e6455' } }, k.h('b', null, x.user_name.split(' — ')[0]), k.h('div', { class: 'small' }, x.duty), k.h('div', { class: 'small muted' }, x.hamlet_name), x.can_edit ? k.h('button', { class: 'btn ghost small', style: { minHeight: '24px', padding: '0 6px' }, title: k.t('Remove', 'നീക്കുക'), onclick: async () => { if (await k.ui.confirm(k.t('Remove this duty?', 'ഈ ഡ്യൂട്ടി നീക്കണോ?'))) { await k.api.del('/duty/' + x.id); k.refresh(); } } }, '✕') : null))))))));
      b.append(k.h('div', { class: 'operations-tt' }, tbl));
    } },
    { id: 'people', label: k.t('Staff list', 'ജീവനക്കാർ'), render: (b) => b.append(k.ui.table([
      { key: 'name', label: k.t('Name', 'പേര്'), render: (r) => k.h('b', null, r.name) },
      { key: 'role_label', label: k.t('Role', 'ചുമതല') }, { key: 'agency_name', label: k.t('Agency', 'ഏജൻസി') },
      { key: 'hamlets', label: k.t('Hamlets', 'ഊരുകൾ'), render: (r) => (r.hamlets.length ? r.hamlets.join(', ') : k.t('All served', 'എല്ലാം')) },
      { key: 'safeguarding_trained', label: k.t('Safeguarding', 'സുരക്ഷ'), render: (r) => (r.safeguarding_trained ? k.ui.badge('✓', 'good') : k.ui.badge(k.t('pending', 'ബാക്കി'), 'warn')) },
      { key: 'duties', label: k.t('Duties / week', 'ആഴ്ചയിൽ'), render: (r) => String(r.duties) },
    ], d.staff)) },
  ]));
}
async function addDuty(k, d) {
  const hs = await k.core.get('/hamlets');
  const m = k.ui.modal(k.t('Add duty', 'ഡ്യൂട്ടി ചേർക്കുക'), k.ui.form([
    { name: 'user_id', label: k.t('Staff', 'ജീവനക്കാർ'), type: 'select', required: true, options: d.staff.map((s) => ({ value: s.id, label: `${s.name} (${s.role})` })) },
    { name: 'hamlet_id', label: k.t('Hamlet', 'ഊര്'), type: 'select', required: true, options: hs.map((h) => ({ value: h.id, label: h.name })) },
    { name: 'weekday', label: k.t('Day', 'ദിവസം'), type: 'select', required: true, options: d.days },
    { name: 'slot', label: k.t('Time', 'സമയം'), required: true, placeholder: '16:00' },
    { name: 'duty', label: k.t('Duty', 'ഡ്യൂട്ടി'), placeholder: k.t('e.g. Evening tuition', 'ഉദാ: സായാഹ്ന ട്യൂഷൻ') },
  ], async (v) => { await k.api.post('/duty', v); k.toast(k.t('Added', 'ചേർത്തു'), 'good'); m.close(); k.refresh(); }));
}

// ---------------------------------------------------------------- finance
async function finance(el, k) {
  k.style(CSS, 'operations-css');
  el.append(header(k, k.t('Expenses & fees', 'ചെലവുകൾ, ഫീസ്'), k.t('Monthly budget vs actual per centre, and fair sliding-scale fees. Fees never block learning.', 'ഫീസ് പഠനം തടയില്ല.')));
  el.append(k.ui.tabs([
    { id: 'exp', label: '💸 ' + k.t('Expenses', 'ചെലവുകൾ'), render: (b) => expenses(b, k) },
    { id: 'fees', label: '🧾 ' + k.t('Fees & waivers', 'ഫീസ്, ഇളവുകൾ'), render: (b) => fees(b, k) },
  ], k.params.tab || 'exp'));
}
async function expenses(b, k) {
  const q = new URLSearchParams({ month: k.params.month || new Date().toISOString().slice(0, 7) });
  if (k.params.centre_id) q.set('centre_id', k.params.centre_id);
  const d = await k.api.get('/expenses?' + q);
  const mSel = k.h('input', { type: 'month', class: 'input', value: d.month, style: { maxWidth: '180px' }, onchange: (e) => { const p = new URLSearchParams({ ...k.params, month: e.target.value, tab: 'exp' }); k.go('#/m/operations/finance?' + p); } });
  const varPct = d.budget ? Math.round(((d.actual - d.budget) / d.budget) * 100) : null;
  b.append(k.h('div', { class: 'row' }, mSel, k.h('span', { class: 'spacer' }), k.ui.button('＋ ' + k.t('Record expense', 'ചെലവ് ചേർക്കുക'), () => addExpense(k, d), { tone: 'primary' }), k.ui.button(k.t('Set budget', 'ബജറ്റ്'), () => setBudget(k, d), { tone: 'ghost' })));
  b.append(k.ui.grid([k.ui.stat(k.t('Budget', 'ബജറ്റ്'), rupee(d.budget)), k.ui.stat(k.t('Spent', 'ചെലവ്'), rupee(d.actual), varPct === null ? '' : (varPct > 0 ? `+${varPct}% ` + k.t('over', 'അധികം') : `${varPct}% ` + k.t('vs budget', 'ബജറ്റിനെതിരെ'))), k.ui.stat(k.t('Receipts', 'രസീതുകൾ'), d.rows.length)], 160));
  const maxv = Math.max(1, ...d.byCategory.map((c) => Math.max(c.budget, c.actual)));
  b.append(k.ui.section(k.t('Budget vs actual by category', 'വിഭാഗം തിരിച്ച്'), k.h('div', { class: 'card operations-budget' }, d.byCategory.map((c) => k.h('div', { class: 'operations-bline' }, k.h('span', null, c.category),
    k.h('div', { class: 'operations-btrack', title: `${rupee(c.actual)} / ${rupee(c.budget)}` }, k.h('div', { class: 'b', style: { width: (c.budget / maxv) * 100 + '%' } }), k.h('div', { class: 'a' + (c.actual > c.budget ? ' over' : ''), style: { width: (c.actual / maxv) * 100 + '%' } })),
    k.h('b', { class: 'small' }, `${rupee(c.actual)} / ${rupee(c.budget)}`))), k.h('div', { class: 'small muted' }, k.t('Green band = budget; bar = spent (red when over).', 'പച്ച = ബജറ്റ്; ബാർ = ചെലവ്.')))));
  const mx = Math.max(1, ...d.trend.map((t) => Math.max(t.actual, t.budget)));
  b.append(k.ui.section(k.t('Six-month trend', 'ആറ് മാസം'), k.h('div', { class: 'card' }, k.h('div', { class: 'operations-trend' }, d.trend.map((t) => k.h('div', null, k.h('div', { class: 'col' }, k.h('i', { class: 'bud', style: { height: (t.budget / mx) * 90 + 'px', width: '100%' } }), k.h('i', { style: { height: (t.actual / mx) * 90 + 'px' }, title: rupee(t.actual) })), t.month.slice(5)))))));
  if (d.centres.length > 1) b.append(k.ui.section(k.t('By centre', 'കേന്ദ്രം തിരിച്ച്'), k.ui.table([{ key: 'name', label: k.t('Centre', 'കേന്ദ്രം') }, { key: 'budget', label: k.t('Budget', 'ബജറ്റ്'), render: (r) => rupee(r.budget) }, { key: 'actual', label: k.t('Spent', 'ചെലവ്'), render: (r) => k.h('span', { style: { color: r.actual > r.budget ? 'var(--bad)' : null } }, rupee(r.actual)) }], d.centres, { onRow: (r) => k.go(`#/m/operations/finance?centre_id=${r.id}&month=${d.month}`) })));
  b.append(k.ui.section(k.t('Receipts', 'രസീതുകൾ'), k.ui.table([
    { key: 'date', label: k.t('Date', 'തീയതി') }, { key: 'category', label: k.t('Category', 'വിഭാഗം'), render: (r) => k.ui.pill(r.category) },
    { key: 'amount', label: k.t('Amount', 'തുക'), render: (r) => k.h('b', null, rupee(r.amount)) }, { key: 'receipt_note', label: k.t('Note', 'കുറിപ്പ്'), render: (r) => k.h('span', { class: 'small' }, r.receipt_note || '', r.receipt_no ? k.h('span', { class: 'mono muted' }, ' #' + r.receipt_no) : null) },
    { key: 'centre_name', label: k.t('Centre', 'കേന്ദ്രം'), render: (r) => k.h('span', { class: 'small muted' }, r.centre_name) },
  ], d.rows)));
}
async function addExpense(k, d) {
  const m = k.ui.modal(k.t('Record expense', 'ചെലവ് ചേർക്കുക'), k.ui.form([
    { name: 'centre_id', label: k.t('Centre', 'കേന്ദ്രം'), type: 'select', required: true, value: k.params.centre_id, options: d.centres.map((c) => ({ value: c.id, label: c.name })) },
    { name: 'category', label: k.t('Category', 'വിഭാഗം'), type: 'select', required: true, options: d.categories },
    { name: 'amount', label: k.t('Amount (₹)', 'തുക (₹)'), type: 'number', required: true, min: 1 },
    { name: 'date', label: k.t('Date', 'തീയതി'), type: 'date', value: new Date().toISOString().slice(0, 10) },
    { name: 'receipt_no', label: k.t('Receipt no.', 'രസീത് നമ്പർ') },
    { name: 'receipt_note', label: k.t('What was it for?', 'എന്തിന്?'), type: 'textarea' },
  ], async (v) => { await k.api.post('/expenses', v); k.toast(k.t('Expense saved', 'സേവ് ചെയ്തു'), 'good'); m.close(); k.refresh(); }));
}
async function setBudget(k, d) {
  const m = k.ui.modal(k.t('Monthly budget', 'മാസ ബജറ്റ്') + ' · ' + d.month, k.ui.form([
    { name: 'centre_id', label: k.t('Centre', 'കേന്ദ്രം'), type: 'select', required: true, value: k.params.centre_id, options: d.centres.map((c) => ({ value: c.id, label: c.name })) },
    ...d.categories.map((c) => ({ name: c, label: c, type: 'number', min: 0, value: d.byCategory.find((x) => x.category === c)?.budget || '' })),
  ], async (v) => { const lines = {}; for (const c of d.categories) if (v[c]) lines[c] = v[c]; await k.api.post('/budgets', { centre_id: v.centre_id, month: d.month, lines }); k.toast(k.t('Budget saved', 'ബജറ്റ് സേവ് ചെയ്തു'), 'good'); m.close(); k.refresh(); }));
}
async function fees(b, k) {
  const d = await k.api.get('/fees');
  b.append(k.h('div', { class: 'card', style: { background: 'var(--leaf-soft)', borderColor: 'var(--leaf)' } }, '💚 ', k.h('b', null, k.t('Learning is never blocked by fees.', 'ഫീസ് കാരണം പഠനം ഒരിക്കലും തടയില്ല.')), ' ', k.h('span', { class: 'small' }, d.policy)));
  b.append(k.ui.grid([k.ui.stat(k.t('Learners with a fee plan', 'ഫീസ് പ്ലാൻ'), d.summary.learners), k.ui.stat(k.t('Due this month', 'ഈ മാസം'), rupee(d.summary.due)), k.ui.stat(k.t('Paid by families', 'കുടുംബങ്ങൾ നൽകിയത്'), rupee(d.summary.paid)), k.ui.stat(k.t('Covered by sponsors', 'സ്പോൺസർ'), rupee(d.summary.sponsored), d.summary.sponsored_learners + ' ' + k.t('learners', 'പഠിതാക്കൾ')), k.ui.stat(k.t('Fully waived', 'ഇളവ്'), d.summary.waived)], 150));
  const filt = k.h('select', { class: 'input', style: { maxWidth: '220px' } }, k.h('option', { value: '' }, k.t('All', 'എല്ലാം')), ['unpaid', 'part', 'paid', 'waived', 'sponsored'].map((s) => k.h('option', { value: s }, s)));
  const list = k.h('div');
  const draw = () => list.replaceChildren(k.ui.table([
    { key: 'person_name', label: k.t('Learner', 'പഠിതാവ്'), render: (r) => k.h('b', null, r.person_name) },
    { key: 'programme_title', label: k.t('Programme', 'പരിപാടി'), render: (r) => k.h('span', { class: 'small' }, r.programme_title) },
    { key: 'plan', label: k.t('Plan', 'പ്ലാൻ'), render: (r) => k.h('span', null, k.ui.pill(r.plan + (r.band ? ' ' + r.band : '')), r.sponsor ? k.h('div', { class: 'small muted' }, r.sponsor) : null) },
    { key: 'due', label: k.t('Monthly', 'മാസം'), render: (r) => rupee(r.due) },
    { key: 'status', label: k.t('This month', 'ഈ മാസം'), render: (r) => k.ui.badge(r.status, { paid: 'good', sponsored: 'info', waived: 'info', part: 'warn', unpaid: 'warn' }[r.status]) },
    { key: 'x', label: '', render: (r) => (r.can_edit ? k.h('div', { class: 'row' }, r.outstanding > 0 ? k.ui.button(k.t('Record payment', 'പണം ചേർക്കുക'), async () => { const amt = Number(prompt(k.t('Amount received (₹)', 'ലഭിച്ച തുക (₹)'), r.outstanding)); if (amt > 0) { await k.api.post(`/fees/${r.id}/payment`, { amount: amt, mode: 'cash', month: d.month }); k.refresh(); } }, { small: true }) : null, k.ui.button(k.t('Change plan', 'പ്ലാൻ മാറ്റുക'), () => changePlan(k, r, d), { small: true, tone: 'ghost' })) : '') },
  ], d.rows.filter((r) => !filt.value || r.status === filt.value), { empty: k.t('No fee plans for learners you can see.', 'ഫീസ് പ്ലാനുകളില്ല.') }));
  filt.addEventListener('change', draw);
  b.append(k.h('div', { class: 'row', style: { margin: '14px 0 8px' } }, k.t('Show', 'കാണിക്കുക'), filt, k.h('span', { class: 'small muted' }, k.t('Sliding scale: A = full, B = ½, C = ¼, D = free (self-declared, no documents asked).', 'A = മുഴുവൻ, B = ½, C = ¼, D = സൗജന്യം'))));
  b.append(list); draw();
}
function changePlan(k, r, d) {
  const m = k.ui.modal(k.t('Fee plan', 'ഫീസ് പ്ലാൻ') + ' — ' + r.person_name, k.ui.form([
    { name: 'plan', label: k.t('Plan', 'പ്ലാൻ'), type: 'select', required: true, value: r.plan, options: d.plans },
    { name: 'band', label: k.t('Band (sliding scale)', 'ബാൻഡ്'), type: 'select', value: r.band || 'B', options: Object.keys(d.bands) },
    { name: 'sponsor', label: k.t('Sponsor (if sponsored)', 'സ്പോൺസർ'), value: r.sponsor },
    { name: 'reason', label: k.t('Reason (kept private)', 'കാരണം'), type: 'textarea', value: r.reason },
  ], async (v) => { await k.api.post('/fees', { ...v, person_id: r.person_id, programme_id: r.programme_id }); k.toast(k.t('Plan updated', 'പുതുക്കി'), 'good'); m.close(); k.refresh(); }));
}

// ---------------------------------------------------------------- timetable (bilingual, learners too)
async function timetable(el, k) {
  k.style(CSS, 'operations-css');
  const load = async (hid) => {
    const d = await k.api.get('/timetable' + (hid ? '?hamlet_id=' + hid : ''));
    body.replaceChildren();
    const title = k.t(`Timetable — ${d.hamlet.name}`, `സമയപ്പട്ടിക — ${d.hamlet.name_ml || d.hamlet.name}`);
    body.append(k.h('div', { class: 'row' }, k.h('h2', { style: { margin: 0 } }, title), k.ui.speakBtn ? k.ui.speakBtn(d.cells.filter((c) => c.mine).map((c) => `${c.day} ${c.time} ${k.t(c.title, c.title_ml)}`).join('. ') || title) : null));
    body.append(k.h('div', { class: 'operations-legend' }, d.agencies.map((a) => k.h('span', { style: { '--c': a.colour } }, a.name)), d.cells.some((c) => c.mine) ? k.h('span', { style: { '--c': 'var(--gold)' } }, k.t('Your classes', 'നിങ്ങളുടെ ക്ലാസുകൾ')) : null));
    if (!d.cells.length) { body.append(k.ui.empty(k.t('No programmes scheduled in this hamlet yet.', 'ഈ ഊരിൽ പരിപാടികളില്ല.'))); return; }
    const clashKey = new Set(d.clashes.map((c) => c.day + c.time));
    const slot = (c) => k.h('div', { class: 'operations-slot' + (c.mine ? ' mine' : '') + (clashKey.has(c.day + c.time) ? ' clash' : ''), style: { '--c': c.agency_colour || '#0b4f45' } }, k.h('b', null, k.t(c.title, c.title_ml)), k.h('div', { class: 'small muted' }, c.agency_name));
    // mobile: list by day; desktop: grid
    const narrow = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
    if (narrow) {
      body.append(k.h('div', { class: 'operations-day-list stack' }, d.days.map((day) => { const cs = d.cells.filter((c) => c.day === day).sort((a, b) => a.time.localeCompare(b.time)); return cs.length ? k.h('div', { class: 'card' }, k.h('h3', null, day), cs.map((c) => k.h('div', { class: 'row', style: { alignItems: 'flex-start' } }, k.h('b', { class: 'mono' }, c.time), slot(c)))) : null; })));
    } else {
      body.append(k.h('div', { class: 'operations-tt' }, k.h('table', null, k.h('thead', null, k.h('tr', null, k.h('th', null, '🕓'), d.days.map((x) => k.h('th', null, x)))),
        k.h('tbody', null, d.times.map((t) => k.h('tr', null, k.h('td', { class: 'time' }, t), d.days.map((day) => k.h('td', null, d.cells.filter((c) => c.day === day && c.time === t).map(slot)))))))));
    }
    if (d.clashes.length && !['learner', 'guardian'].includes(k.user.role)) body.append(k.ui.card({ title: '⚠️ ' + k.t(`${d.clashes.length} timing clashes between agencies`, `${d.clashes.length} സമയ കൂട്ടിമുട്ടലുകൾ`), tone: 'warn', body: k.h('ul', { class: 'small' }, d.clashes.map((c) => k.h('li', null, `${c.day} ${c.time}: ${c.programmes.join(' · ')}`))) }));
    if (d.my_duty.length) body.append(k.ui.card({ title: k.t('Your duties here', 'നിങ്ങളുടെ ഡ്യൂട്ടി'), body: d.my_duty.map((x) => k.ui.pill(`${x.weekday} ${x.slot} · ${x.duty}`)) }));
  };
  const body = k.h('div', { class: 'stack' });
  const staffView = !['learner', 'guardian'].includes(k.user.role);
  el.append(header(k, k.t('Hamlet timetable', 'ഊര് സമയപ്പട്ടിക'), k.t('Every agency’s classes in one place.', 'എല്ലാ ഏജൻസികളുടെയും ക്ലാസുകൾ ഒരിടത്ത്.'), staffView ? k.ui.hamletSelect((id) => load(id), { all: true, value: k.params.hamlet_id || '' }) : null));
  el.append(body);
  await load(k.params.hamlet_id);
}

export default { views: { centres, assets, staff, finance, timetable, home: centres } };
