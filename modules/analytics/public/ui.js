// AADI — Impact & Insight UI. No DOM work at import time.
const CSS = `
.analytics-head { display:flex; gap:12px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; margin-bottom:14px; }
.analytics-head h1 { margin:0; }
.analytics-aud { display:inline-flex; gap:6px; align-items:center; background:var(--info-bg); color:var(--info); padding:4px 12px; border-radius:999px; font-size:.85rem; font-weight:700; }
.analytics-kpis { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); }
.analytics-kpi { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-m); padding:14px 16px; position:relative; overflow:hidden; }
.analytics-kpi::after { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--accent, var(--forest)); }
.analytics-kpi .v { font-size:var(--step-3); font-weight:700; color:var(--forest-ink); line-height:1.05; font-variant-numeric:tabular-nums; }
.analytics-kpi .l { color:var(--ink-2); font-size:.88rem; }
.analytics-kpi .h { color:var(--ink-3); font-size:.78rem; margin-top:2px; }
.analytics-cols { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); margin-top:14px; }
.analytics-line { width:100%; height:120px; }
.analytics-sdg { display:grid; gap:10px; }
.analytics-ind { display:grid; grid-template-columns:72px 1fr auto; gap:12px; align-items:center; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-s); padding:10px 12px; }
.analytics-goal { font-size:.72rem; font-weight:700; color:#fff; background:var(--g); border-radius:6px; padding:6px 4px; text-align:center; line-height:1.15; }
.analytics-ind .val { font-size:1.35rem; font-weight:700; color:var(--forest-ink); text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.analytics-ind .val small { font-size:.75rem; color:var(--ink-3); font-weight:400; }
.analytics-risk { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.analytics-risk div { border-radius:var(--r-m); padding:12px; text-align:center; }
.analytics-risk .high { background:var(--bad-bg); color:var(--bad); } .analytics-risk .medium { background:var(--warn-bg); color:var(--warn); } .analytics-risk .low { background:var(--good-bg); color:var(--good); }
.analytics-risk b { display:block; font-size:var(--step-2); }
.analytics-meter { display:inline-block; width:60px; height:8px; border-radius:4px; background:#edf2ef; overflow:hidden; vertical-align:middle; margin-right:6px; }
.analytics-meter i { display:block; height:100%; }
.analytics-note { font-size:.85rem; color:var(--ink-2); background:var(--paper); border:1px dashed var(--line); border-radius:var(--r-s); padding:8px 12px; }
/* printable report */
.analytics-report { background:#fff; color:#1c2a27; max-width:900px; margin:0 auto; box-shadow:0 10px 40px rgba(0,0,0,.08); }
.analytics-cover { background:linear-gradient(135deg,#08332d 0%,#0e6455 60%,#5e8c3a 100%); color:#fff; padding:44px 48px 36px; position:relative; }
.analytics-cover img { width:64px; height:64px; border-radius:50%; background:#fff; padding:4px; }
.analytics-cover h1 { font-size:2.3rem; margin:16px 0 4px; letter-spacing:-.02em; }
.analytics-cover .sub { color:#cfe3dc; font-size:1.05rem; }
.analytics-cover .gold { position:absolute; right:48px; top:44px; text-align:right; color:#f3e7bf; font-size:.85rem; }
.analytics-page { padding:32px 48px; }
.analytics-page h2 { font-size:1.35rem; border-bottom:3px solid var(--gold); padding-bottom:6px; display:inline-block; margin:22px 0 14px; }
.analytics-big { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.analytics-big div { border-top:4px solid var(--forest-2); padding-top:8px; }
.analytics-big b { display:block; font-size:2rem; color:var(--forest-ink); line-height:1.05; }
.analytics-big span { font-size:.85rem; color:var(--ink-2); }
.analytics-story { border-left:4px solid var(--gold); padding:4px 14px; margin:10px 0; }
.analytics-rtbl { width:100%; border-collapse:collapse; font-size:.88rem; }
.analytics-rtbl th { text-align:left; border-bottom:2px solid var(--forest); padding:6px; }
.analytics-rtbl td { border-bottom:1px solid #e6ece9; padding:6px; }
.analytics-foot { font-size:.75rem; color:var(--ink-3); border-top:1px solid var(--line); padding:14px 48px 28px; }
@media (max-width:640px) { .analytics-cover, .analytics-page { padding:24px 18px; } .analytics-big { grid-template-columns:repeat(2,1fr); } .analytics-cover .gold { position:static; text-align:left; margin-top:10px; } .analytics-ind { grid-template-columns:56px 1fr; } .analytics-ind .val { grid-column:2; text-align:left; } }
@media print {
  .analytics-noprint { display:none !important; }
  .analytics-report { box-shadow:none; max-width:none; }
  .analytics-cover { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .analytics-goal, .analytics-big div { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .analytics-page h2 { break-after:avoid; } .analytics-ind, .analytics-story, tr { break-inside:avoid; }
  .analytics-pb { break-before:page; }
}
`;

const fmt = (v, unit = '') => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : (Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toFixed(1)) + unit);
const kpi = (k, label, value, hint, accent) => k.h('div', { class: 'analytics-kpi', style: { '--accent': accent || null } }, k.h('div', { class: 'v' }, value), k.h('div', { class: 'l' }, label), hint ? k.h('div', { class: 'h' }, hint) : null);
const bars = (k, rows) => k.ui.bars(rows.map((r) => ({ label: r.label, value: typeof r.value === 'number' ? r.value : 0, ...(typeof r.value === 'string' ? { label: r.label + ' (' + r.value + ')' } : {}) })));

function lineChart(k, pts, { max = 100, unit = '%' } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 320 120'); svg.setAttribute('class', 'analytics-line'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', pts.map((p) => `${p.month}: ${p.rate ?? p.value}${unit}`).join(', '));
  const vals = pts.map((p) => Number(p.rate ?? p.value) || 0);
  if (vals.length < 2) return svg;
  const x = (i) => 24 + (i / (vals.length - 1)) * 280, y = (v) => 100 - (v / max) * 88;
  for (const g of [0, 50, 100]) { const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', 24); l.setAttribute('x2', 304); l.setAttribute('y1', y(g * max / 100)); l.setAttribute('y2', y(g * max / 100)); l.setAttribute('stroke', '#e3eae6'); svg.append(l); const t = document.createElementNS(ns, 'text'); t.setAttribute('x', 0); t.setAttribute('y', y(g * max / 100) + 4); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#7a8c87'); t.textContent = Math.round(g * max / 100); svg.append(t); }
  const pl = document.createElementNS(ns, 'polyline');
  pl.setAttribute('points', vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#0e6455'); pl.setAttribute('stroke-width', '2.5'); svg.append(pl);
  vals.forEach((v, i) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x(i)); c.setAttribute('cy', y(v)); c.setAttribute('r', 3.2); c.setAttribute('fill', '#c9a227'); svg.append(c); const t = document.createElementNS(ns, 'text'); t.setAttribute('x', x(i)); t.setAttribute('y', 116); t.setAttribute('font-size', '9'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#4b5e59'); t.textContent = String(pts[i].month).slice(5); svg.append(t); });
  return svg;
}

function indicators(k, F) {
  const colour = Object.fromEntries(F.goals.map((g) => [g.goal, g.colour]));
  return k.h('div', { class: 'analytics-sdg' }, F.indicators.map((i) => k.h('div', { class: 'analytics-ind' },
    k.h('div', { class: 'analytics-goal', style: { '--g': colour[i.goal] } }, i.goal.replace('Kerala ', '')),
    k.h('div', null, k.h('b', null, k.t(i.title, i.title_ml)), k.h('div', { class: 'small muted' }, `${i.code} · ${i.note || ''}`)),
    k.h('div', { class: 'val' }, fmt(i.value), ' ', k.h('small', null, i.value === null ? '' : i.unit)))));
}

// ---------------------------------------------------------------- dashboard
async function dashboard(el, k) {
  k.style(CSS, 'analytics-css');
  const q = new URLSearchParams();
  if (k.params.hamlet_id) q.set('hamlet_id', k.params.hamlet_id);
  if (k.params.agency_id) q.set('agency_id', k.params.agency_id);
  const d = await k.api.get('/dashboard?' + q);
  const M = d.metrics;
  const ext = ['donor', 'govt', 'hamlet'].includes(d.audience.mode);
  el.append(k.h('div', { class: 'analytics-head' }, k.h('div', null, k.h('h1', null, k.t('Impact dashboard', 'സ്വാധീന ഡാഷ്ബോർഡ്')),
    k.h('span', { class: 'analytics-aud' }, ext ? '🔒 ' : '👁️ ', d.audience.label, d.audience.agency ? ' · ' + d.audience.agency : '', d.audience.hamlets ? ' · ' + d.audience.hamlets.join(', ') : '')),
    k.h('div', { class: 'row analytics-noprint' }, k.ui.button('🖨️ ' + k.t('Impact report', 'റിപ്പോർട്ട്'), () => k.go('#/m/analytics/report'), { tone: 'ghost' }))));
  if (ext) el.append(k.h('p', { class: 'analytics-note' }, '🔒 ', k.t(`Anonymised view: no names or IDs. Any count below ${d.audience.k} is shown as “<${d.audience.k}” to protect small communities.`, 'അജ്ഞാതമാക്കിയ കാഴ്ച.')));
  el.append(k.h('div', { class: 'analytics-kpis', style: { marginTop: '12px' } },
    kpi(k, k.t('Learners reached', 'പഠിതാക്കൾ'), fmt(M.reached), `${M.hamlets_served} ${k.t('hamlets', 'ഊരുകൾ')} · ${M.agencies_active} ${k.t('agencies', 'ഏജൻസികൾ')}`),
    kpi(k, k.t('Attendance', 'ഹാജർ'), M.attendance ? fmt(M.attendance.rate, '%') : '—', M.attendance ? k.t('last 6 months', '6 മാസം') : k.t('learning module off', 'ലഭ്യമല്ല'), '#5e8c3a'),
    kpi(k, k.t('Learning gain', 'പഠന പുരോഗതി'), M.gains && M.gains.latest !== null ? `${fmt(M.gains.baseline, '%')} → ${fmt(M.gains.latest, '%')}` : '—', M.gains ? `${fmt(M.gains.improved_pct, '%')} ${k.t('improved', 'മെച്ചപ്പെട്ടു')}` : '', '#c9a227'),
    kpi(k, k.t('Credentials issued', 'സർട്ടിഫിക്കറ്റുകൾ'), fmt(M.credentials.total), `${fmt(M.credentials.holders)} ${k.t('holders', 'ഉടമകൾ')}`, '#1d4e89'),
    kpi(k, k.t('Retention', 'തുടർച്ച'), fmt(M.retention_pct, '%'), `${fmt(M.dropped)} ${k.t('dropped out', 'കൊഴിഞ്ഞുപോയി')}`, '#6a4c93'),
    M.placements ? kpi(k, k.t('Youth placed', 'ജോലി ലഭിച്ചവർ'), fmt(M.placements.placed), M.placements.avg_wage ? `₹${M.placements.avg_wage.toLocaleString('en-IN')}/${k.t('month', 'മാസം')}` : '', '#b5651d') : null));
  el.append(k.ui.tabs([
    { id: 'reach', label: k.t('Reach', 'എത്തിച്ചേരൽ'), render: (b) => b.append(k.h('div', { class: 'analytics-cols' },
      k.ui.card({ title: k.t('By hamlet', 'ഊര് തിരിച്ച്'), body: bars(k, M.byHamlet) }),
      k.ui.card({ title: k.t('By agency', 'ഏജൻസി തിരിച്ച്'), body: bars(k, M.byAgency) }),
      k.ui.card({ title: k.t('By track', 'ട്രാക്ക് തിരിച്ച്'), body: bars(k, M.byTrack) }),
      k.ui.card({ title: k.t('By gender', 'ലിംഗം'), body: bars(k, M.byGender) }),
      k.ui.card({ title: k.t('By age band', 'പ്രായം'), body: bars(k, M.byAge) }))) },
    { id: 'learn', label: k.t('Learning', 'പഠനം'), render: (b) => b.append(k.h('div', { class: 'analytics-cols' },
      M.attendance ? k.ui.card({ title: k.t('Attendance trend', 'ഹാജർ പ്രവണത'), body: lineChart(k, M.attendance.trend) }) : null,
      M.attendance ? k.ui.card({ title: k.t('Attendance by hamlet', 'ഊര് തിരിച്ച് ഹാജർ'), body: k.ui.bars(M.attendance.byHamlet.map((x) => ({ label: x.label, value: x.value ?? 0 })), { max: 100, unit: '%' }) }) : null,
      M.gains ? k.ui.card({ title: k.t('Diagnostic: first vs latest', 'ഡയഗ്നോസ്റ്റിക്'), body: k.h('div', null, k.ui.bars([{ label: k.t('Baseline', 'തുടക്കം'), value: M.gains.baseline ?? 0 }, { label: k.t('Latest', 'ഇപ്പോൾ'), value: M.gains.latest ?? 0, colour: '#c9a227' }], { max: 100, unit: '%' }), k.h('p', { class: 'small muted' }, `${fmt(M.gains.learners_retested)} ${k.t('learners re-tested', 'പുനഃപരിശോധിച്ചു')} · ${fmt(M.gains.lessons_mastered)} ${k.t('lessons mastered', 'പാഠങ്ങൾ')}`)) }) : null,
      M.exams ? k.ui.card({ title: k.t('Mock exams', 'മോക്ക് പരീക്ഷ'), body: k.h('div', null, k.ui.bars([{ label: k.t('First mock', 'ആദ്യം'), value: M.exams.first_avg ?? 0 }, { label: k.t('Latest mock', 'അവസാനം'), value: M.exams.latest_avg ?? 0, colour: '#c9a227' }], { max: 100, unit: '%' }), k.h('p', { class: 'small muted' }, `${fmt(M.exams.mock_takers)} ${k.t('aspirants', 'ഉദ്യോഗാർത്ഥികൾ')} · ${fmt(M.exams.improved_pct, '%')} ${k.t('improved', 'മെച്ചപ്പെട്ടു')}`)) }) : null,
      k.ui.card({ title: k.t('Credentials by domain', 'സർട്ടിഫിക്കറ്റ്'), body: bars(k, M.credentials.byDomain) }),
      M.wellbeing ? k.ui.card({ title: k.t('Wellbeing (aggregate only)', 'ക്ഷേമം'), body: k.ui.kv([[k.t('Check-ins (60 d)', 'ചെക്ക്-ഇൻ'), fmt(M.wellbeing.checkins)], [k.t('Average mood (1–5)', 'ശരാശരി'), fmt(M.wellbeing.avg_mood)], [k.t('Learners with a low day', 'വിഷമമുള്ളവർ'), fmt(M.wellbeing.low_mood_share, '%')]]) }) : null)) },
    { id: 'risk', label: k.t('Dropout risk', 'കൊഴിഞ്ഞുപോക്ക്'), render: (b) => {
      b.append(k.h('div', { class: 'analytics-risk' }, ['high', 'medium', 'low'].map((l) => k.h('div', { class: l }, k.h('b', null, fmt(M.risk[l])), { high: k.t('High', 'ഉയർന്ന'), medium: k.t('Medium', 'ഇടത്തരം'), low: k.t('Low', 'കുറഞ്ഞ') }[l]))));
      b.append(k.ui.section(k.t('Transparent rules — how the score is made', 'സ്കോർ എങ്ങനെ'), k.ui.table([{ key: 'label', label: k.t('Signal', 'സൂചന'), render: (r) => k.t(r.label, r.label_ml) }, { key: 'points', label: k.t('Points', 'പോയിന്റ്'), render: (r) => '+' + r.points }, { key: 'value', label: k.t('Learners flagged', 'എണ്ണം'), render: (r) => fmt(r.value) }], M.risk.factors)));
      b.append(k.h('p', { class: 'analytics-note' }, k.t('Score ≥ 50 = high, 30–49 = medium. Wellbeing data is never used per learner. Facilitators see named alerts only for learners who consented to their agency.', '≥50 ഉയർന്ന, 30–49 ഇടത്തരം.')));
    } },
    { id: 'sdg', label: k.t('SDG & ST indicators', 'SDG സൂചകങ്ങൾ'), render: (b) => b.append(indicators(k, d.framework)) },
  ]));
}

// ---------------------------------------------------------------- dropout alerts (staff)
async function risk(el, k) {
  k.style(CSS, 'analytics-css');
  const level = k.params.level || 'alerts';
  const q = new URLSearchParams({ level });
  if (k.params.hamlet_id) q.set('hamlet_id', k.params.hamlet_id);
  const d = await k.api.get('/risk?' + q);
  el.append(k.h('div', { class: 'analytics-head' }, k.h('div', null, k.h('h1', null, k.t('Dropout early warning', 'കൊഴിഞ്ഞുപോക്ക് മുന്നറിയിപ്പ്')), k.h('p', { class: 'muted', style: { margin: 0 } }, d.note))));
  el.append(k.h('div', { class: 'analytics-risk' }, ['high', 'medium', 'low'].map((l) => k.h('div', { class: l, style: { cursor: 'pointer' }, onclick: () => k.go('#/m/analytics/risk?level=' + l) }, k.h('b', null, d.counts[l]), { high: k.t('High risk', 'ഉയർന്ന'), medium: k.t('Medium', 'ഇടത്തരം'), low: k.t('Low', 'കുറഞ്ഞ') }[l]))));
  const seg = k.h('div', { class: 'seg', style: { margin: '14px 0' } }, [['alerts', k.t('Alerts', 'മുന്നറിയിപ്പുകൾ')], ['high', k.t('High', 'ഉയർന്ന')], ['all', k.t('Everyone', 'എല്ലാവരും')]].map(([v, l]) => k.h('button', { class: v === level ? 'on' : '', onclick: () => k.go('#/m/analytics/risk?level=' + v) }, l)));
  el.append(seg);
  el.append(k.ui.table([
    { key: 'name', label: k.t('Learner', 'പഠിതാവ്'), render: (r) => k.h('div', null, k.h('b', null, r.name), k.h('div', { class: 'small muted' }, `${k.t(r.hamlet, r.hamlet_ml)} · ${r.kind}${r.school_class ? ' · ' + r.school_class : ''}`)) },
    { key: 'score', label: k.t('Risk', 'സാധ്യത'), render: (r) => k.h('span', null, k.h('span', { class: 'analytics-meter' }, k.h('i', { style: { width: r.score + '%', background: r.level === 'high' ? 'var(--bad)' : r.level === 'medium' ? 'var(--gold)' : 'var(--good)' } })), k.ui.badge(String(r.score), r.level === 'high' ? 'bad' : r.level === 'medium' ? 'warn' : 'good')) },
    { key: 'factors', label: k.t('Why', 'എന്തുകൊണ്ട്'), render: (r) => k.h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } }, r.factors.map((f) => k.h('li', null, k.t(f.label, f.label_ml)))) },
    { key: 'attendance_4w', label: k.t('Attend. 4w', 'ഹാജർ'), render: (r) => (r.attendance_4w === null ? '—' : r.attendance_4w + '%') },
    { key: 'last_action', label: k.t('Follow-up', 'തുടർനടപടി'), render: (r) => k.h('div', null, r.last_action ? k.h('div', { class: 'small' }, `${r.last_action.action.replace('_', ' ')} · ${new Date(r.last_action.at).toLocaleDateString()}`) : null,
      k.h('select', { class: 'input', style: { fontSize: '.85rem', padding: '4px' }, onchange: async (e) => { if (!e.target.value) return; await k.api.post(`/risk/${r.id}/action`, { action: e.target.value }); k.toast(k.t('Follow-up logged', 'രേഖപ്പെടുത്തി'), 'good'); k.refresh(); } },
        k.h('option', { value: '' }, k.t('Log follow-up…', 'രേഖപ്പെടുത്തുക…')), [['called', k.t('Called family', 'വിളിച്ചു')], ['home_visit', k.t('Home visit', 'വീട് സന്ദർശനം')], ['met_guardian', k.t('Met guardian', 'രക്ഷിതാവിനെ കണ്ടു')], ['referred_counsellor', k.t('Referred to counsellor', 'കൗൺസിലറിലേക്ക്')], ['resolved', k.t('Back on track', 'ശരിയായി')]].map(([v, l]) => k.h('option', { value: v }, l)))) },
  ], d.rows, { empty: k.t('No learners at risk in your view — or none have consented to your agency.', 'ആരുമില്ല.') }));
}

// ---------------------------------------------------------------- printable impact report
async function report(el, k) {
  k.style(CSS, 'analytics-css');
  const d = await k.api.get('/report');
  const M = d.metrics, F = d.framework;
  const date = new Date(d.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  el.append(k.h('div', { class: 'row analytics-noprint', style: { marginBottom: '12px' } }, k.ui.button('🖨️ ' + k.t('Print / save as PDF', 'പ്രിന്റ് / PDF'), () => window.print(), { tone: 'primary' }), k.ui.button(k.t('Back to dashboard', 'ഡാഷ്ബോർഡ്'), () => k.go('#/m/analytics/dashboard'), { tone: 'ghost' }), k.h('span', { class: 'small muted' }, d.audience.label)));
  const rep = k.h('article', { class: 'analytics-report' });
  rep.append(k.h('header', { class: 'analytics-cover' },
    k.h('img', { src: '/img/cif-mark.png', alt: 'CIF' }),
    k.h('div', { class: 'gold' }, k.h('div', null, k.t('Impact Report', 'സ്വാധീന റിപ്പോർട്ട്')), k.h('div', null, `${d.period.from} → ${d.period.to}`)),
    k.h('h1', null, `${k.brand.short} — `, k.t('learning reaches every hamlet', 'എല്ലാ ഊരിലും പഠനം')),
    k.h('div', { class: 'sub' }, k.t('Offline-first learning platform for tribal children and youth in Kerala · Community Innovations Foundation', 'കേരളത്തിലെ ആദിവാസി കുട്ടികൾക്കും യുവാക്കൾക്കുമുള്ള പഠന വേദി')),
    k.h('div', { class: 'small', style: { marginTop: '14px', color: '#cfe3dc' } }, `${date} · ${M.hamlets_served} ${k.t('hamlets', 'ഊരുകൾ')} · ${M.agencies_active} ${k.t('partner agencies', 'പങ്കാളി ഏജൻസികൾ')} · DEMO data`)));
  const page = k.h('div', { class: 'analytics-page' });
  page.append(k.h('h2', null, k.t('At a glance', 'ഒറ്റനോട്ടത്തിൽ')),
    k.h('div', { class: 'analytics-big' },
      k.h('div', null, k.h('b', null, fmt(M.reached)), k.h('span', null, k.t('learners reached', 'പഠിതാക്കൾ'))),
      k.h('div', null, k.h('b', null, M.attendance ? fmt(M.attendance.rate, '%') : '—'), k.h('span', null, k.t('attendance', 'ഹാജർ'))),
      k.h('div', null, k.h('b', null, fmt(M.credentials.total)), k.h('span', null, k.t('credentials earned', 'സർട്ടിഫിക്കറ്റുകൾ'))),
      k.h('div', null, k.h('b', null, fmt(M.retention_pct, '%')), k.h('span', null, k.t('retention', 'തുടർച്ച')))));
  page.append(k.h('div', { class: 'analytics-cols' },
    M.attendance ? k.h('div', null, k.h('h3', null, k.t('Attendance, month by month', 'മാസം തോറും ഹാജർ')), lineChart(k, M.attendance.trend)) : null,
    k.h('div', null, k.h('h3', null, k.t('Who we reach', 'ആരിലേക്ക്')), bars(k, M.byTrack.slice(0, 6)), k.h('div', { style: { marginTop: '8px' } }, bars(k, M.byGender)))));
  page.append(k.h('h2', { class: 'analytics-pb' }, k.t('Results framework — SDGs & Kerala ST Department', 'ഫലങ്ങൾ — SDG, പട്ടികവർഗ വകുപ്പ്')), indicators(k, F));
  page.append(k.h('h2', null, k.t('Hamlets', 'ഊരുകൾ')), k.h('div', { class: 'tbl-wrap' }, k.h('table', { class: 'analytics-rtbl' },
    k.h('thead', null, k.h('tr', null, [k.t('Hamlet', 'ഊര്'), k.t('District', 'ജില്ല'), k.t('Community', 'സമുദായം'), k.t('Network / power', 'നെറ്റ്/വൈദ്യുതി'), k.t('Agencies', 'ഏജൻസികൾ'), k.t('Learners', 'പഠിതാക്കൾ'), k.t('Attendance', 'ഹാജർ')].map((x) => k.h('th', null, x)))),
    k.h('tbody', null, d.hamlets.map((h) => k.h('tr', null, k.h('td', null, k.t(h.name, h.name_ml)), k.h('td', null, h.district), k.h('td', null, h.community), k.h('td', null, `${h.connectivity} / ${h.power}`), k.h('td', null, String(h.agencies)), k.h('td', null, fmt(h.reached)), k.h('td', null, fmt(h.attendance, '%'))))))));
  page.append(k.h('h2', null, k.t('Stories from the field', 'അനുഭവങ്ങൾ')), ...d.stories.map((s) => k.h('div', { class: 'analytics-story' }, k.h('b', null, s.title), k.h('p', { style: { margin: '2px 0 0' } }, s.body))));
  page.append(k.h('h2', null, k.t('How we count', 'എങ്ങനെ എണ്ണുന്നു')), k.h('ul', { class: 'small' }, d.method.map((m) => k.h('li', null, m))));
  rep.append(page, k.h('footer', { class: 'analytics-foot' }, `${k.brand.name} · ${k.brand.owner} (Section 8), Kochi · Generated ${date} · ${d.audience.label}. Learners and guardians own their data; this report contains no personal information.`));
  el.append(rep);
}

// ---------------------------------------------------------------- research export
async function research(el, k) {
  k.style(CSS, 'analytics-css');
  const d = await k.api.get('/research/preview');
  el.append(k.h('div', { class: 'analytics-head' }, k.h('div', null, k.h('h1', null, k.t('Research export', 'ഗവേഷണ ഡാറ്റ')), k.h('p', { class: 'muted', style: { margin: 0 } }, k.t('Anonymised CSV for approved research partners.', 'അജ്ഞാത CSV.')))));
  el.append(k.ui.grid([k.ui.stat(k.t('Learners with research consent', 'ഗവേഷണ സമ്മതം'), d.count), k.ui.stat(k.t('Columns', 'കോളങ്ങൾ'), d.columns.length)], 200));
  el.append(k.ui.card({ title: '🔒 ' + k.t('Safeguards', 'സുരക്ഷ'), body: k.h('ul', null, d.rules.map((r) => k.h('li', null, r))),
    actions: [k.h('a', { class: 'btn primary', href: '/api/m/analytics/research.csv', download: '' }, '⬇ ' + k.t('Download CSV', 'CSV ഡൗൺലോഡ്'))] }));
  el.append(k.ui.section(k.t('Preview (first rows)', 'മാതൃക'), k.ui.table(d.columns.map((c) => ({ key: c, label: c, render: (r) => String(r[c] ?? '') })), d.sample, { empty: k.t('No one has given research consent yet.', 'ആരും സമ്മതം നൽകിയിട്ടില്ല.') })));
  el.append(k.h('p', { class: 'small muted' }, k.t('Every export is written to the tamper-evident audit log.', 'ഓരോ എക്സ്പോർട്ടും ഓഡിറ്റ് ലോഗിൽ.')));
}

export default { views: { dashboard, risk, report, research, home: dashboard } };
