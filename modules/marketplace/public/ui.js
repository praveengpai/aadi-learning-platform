// AADI — Marketplace UI: volunteers, sponsors, jobs, CSR reports. No DOM work at import time.

const CSS = `
.marketplace-hero{background:linear-gradient(135deg,#123f5c 0%,var(--forest) 60%,var(--forest-2) 100%);color:#fff;border-radius:var(--r-l);padding:18px;margin-bottom:16px;position:relative;overflow:hidden}
.marketplace-hero h2{color:#fff;margin:0 0 4px}
.marketplace-hero p{margin:0;opacity:.92}
.marketplace-hero::after{content:"";position:absolute;right:-50px;top:-50px;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,rgba(201,162,39,.45),transparent 70%)}
.marketplace-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.marketplace-between{display:flex;gap:10px;justify-content:space-between;align-items:flex-start}
.marketplace-card{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:14px;display:flex;flex-direction:column;gap:8px}
.marketplace-card .t{font-weight:700;font-size:var(--step-0)}
.marketplace-kind{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3)}
.marketplace-amt{font-size:var(--step-1);font-weight:700;color:var(--forest)}
.marketplace-steps{display:flex;gap:4px;margin:6px 0}
.marketplace-step{flex:1;height:8px;border-radius:4px;background:var(--line)}
.marketplace-step.done{background:var(--good)}
.marketplace-check{display:flex;gap:8px;align-items:center;padding:8px 0;border-top:1px dashed var(--line)}
.marketplace-check .ic{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--line);flex:none}
.marketplace-check.done .ic{background:var(--good);color:#fff}
.marketplace-fair{display:flex;gap:6px;flex-wrap:wrap}
.marketplace-fair span{font-size:.75rem;background:var(--good-bg);color:var(--good);border-radius:999px;padding:2px 8px;font-weight:700}
.marketplace-receipt{background:#fff;border:2px solid var(--forest);border-radius:var(--r-m);padding:18px;font-size:.95rem;max-width:640px}
.marketplace-receipt h3{color:var(--forest);margin:0}
.marketplace-receipt .amt{font-size:1.6rem;font-weight:700}
.marketplace-stamp{display:inline-block;border:2px dashed var(--warn);color:var(--warn);padding:2px 8px;transform:rotate(-4deg);font-weight:700;font-size:.8rem}
.marketplace-gateway{border:2px dashed var(--line);border-radius:var(--r-m);padding:14px;text-align:center;color:var(--ink-2);background:var(--paper)}
.marketplace-cert{border:6px double var(--gold);border-radius:var(--r-m);padding:22px;text-align:center;background:#fffdf5}
.marketplace-cert h2{color:var(--forest)}
.marketplace-pipeline{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin:10px 0}
.marketplace-pipeline div{background:var(--paper);border-radius:6px;padding:8px;text-align:center}
.marketplace-pipeline b{display:block;font-size:1.3rem}
.marketplace-cand{border:1px solid var(--line);border-radius:var(--r-m);padding:12px;background:#fff}
@media print{.marketplace-noprint{display:none}}
`;
const fmt = (n) => (typeof n === 'number' ? '₹' + n.toLocaleString('en-IN') : n);
const fmtDate = (s, k) => (s ? new Date(s).toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const CHECKS = { id_verified: ['🪪', 'ID verified', 'ഐഡി പരിശോധിച്ചു'], police_clearance: ['🛡', 'Police clearance uploaded', 'പോലീസ് ക്ലിയറൻസ്'], references: ['📞', 'References checked', 'റഫറൻസുകൾ'], safeguarding: ['🧒', 'Safeguarding training', 'ശിശു സംരക്ഷണ പരിശീലനം'] };
const FAIR = { written_offer: ['Written offer letter', 'രേഖാമൂല ഓഫർ'], min_wage: ['Wage ≥ minimum wage', 'കുറഞ്ഞ കൂലിയിൽ കുറയില്ല'], accommodation_safe: ['Safe accommodation (if provided)', 'സുരക്ഷിത താമസം'], no_document_retention: ['Never keeps original documents', 'ഒറിജിനൽ രേഖകൾ പിടിച്ചുവയ്ക്കില്ല'] };
const SK = { learner: ['🎒', 'Sponsor a learner', 'ഒരു പഠിതാവിനെ സ്പോൺസർ ചെയ്യുക'], centre: ['🏫', 'Sponsor a centre', 'കേന്ദ്രം'], device: ['📱', 'Devices', 'ഉപകരണങ്ങൾ'], camp: ['⛺', 'Camps', 'ക്യാമ്പുകൾ'] };
const APP = { applied: ['info', 'Applied', 'അപേക്ഷിച്ചു'], shortlisted: ['info', 'Shortlisted', 'ഷോർട്ട്‌ലിസ്റ്റ്'], interview: ['warn', 'Interview', 'ഇന്റർവ്യൂ'], offered: ['warn', 'Offered', 'ഓഫർ'], hired: ['good', 'Hired', 'ജോലി ലഭിച്ചു'], rejected: ['bad', 'Not selected', 'തിരഞ്ഞെടുത്തില്ല'], withdrawn: ['', 'Withdrawn', 'പിൻവലിച്ചു'] };

function setup(k) { k.style(CSS, 'marketplace-css'); }
function hero(k, en, ml, pEn, pMl) { return k.h('div', { class: 'marketplace-hero' }, k.h('h2', null, k.t(en, ml)), k.h('p', null, k.t(pEn, pMl))); }
const appBadge = (k, s) => k.ui.badge(k.t(APP[s]?.[1] || s, APP[s]?.[2]), APP[s]?.[0]);

// =====================================================================
// VOLUNTEERS
// =====================================================================
async function volunteers(el, k) {
  setup(k);
  const { h } = k;
  el.append(hero(k, 'Volunteers', 'സന്നദ്ധപ്രവർത്തകർ', 'No one works with children until all four background checks are done. Every hour is logged and verified.', 'നാല് പരിശോധനകളും പൂർത്തിയാകാതെ ആരും കുട്ടികളോടൊപ്പം പ്രവർത്തിക്കില്ല.'));
  const isMentor = k.user.role === 'mentor';
  const admin = ['platform_admin', 'agency_admin', 'coordinator'].includes(k.user.role);
  const rows = await k.api.get('/volunteers');
  if (isMentor) { if (rows[0]) await volDetail(el, k, rows[0].id, true); else el.append(k.ui.empty(k.t('Your volunteer profile is not linked yet.', 'പ്രൊഫൈൽ ബന്ധിപ്പിച്ചിട്ടില്ല.'))); return; }
  const stages = ['applied', 'screening', 'approved', 'rejected', 'suspended'];
  el.append(h('div', { class: 'marketplace-pipeline' }, stages.map((s) => h('div', null, h('b', null, rows.filter((r) => r.status === s).length), h('span', { class: 'small' }, s)))));
  el.append(h('div', { class: 'marketplace-row', style: { marginBottom: '10px' } },
    admin ? k.ui.button('➕ ' + k.t('Add volunteer', 'ചേർക്കുക'), () => {
      const m = k.ui.modal(k.t('New volunteer application', 'പുതിയ അപേക്ഷ'), k.ui.form([
        { name: 'name', label: k.t('Name', 'പേര്'), required: true }, { name: 'phone', label: k.t('Phone', 'ഫോൺ'), required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'city', label: k.t('City', 'നഗരം') },
        { name: 'skills', label: k.t('Skills (comma separated)', 'കഴിവുകൾ') }, { name: 'availability', label: k.t('Availability', 'ലഭ്യത') }, { name: 'motivation', label: k.t('Why do you want to volunteer?', 'എന്തുകൊണ്ട്?'), type: 'textarea' },
      ], async (v) => { await k.api.post('/volunteers', v); m.close(); k.refresh(); }));
    }, { tone: 'primary' }) : null,
    h('span', { class: 'small muted' }, k.t('Public application link: ', 'പൊതു അപേക്ഷ: '), h('a', { href: '#/m/marketplace/apply' }, '#/m/marketplace/apply'))));
  el.append(k.ui.table([
    { key: 'name', label: k.t('Name', 'പേര്'), render: (r) => h('div', null, h('b', null, r.name), h('div', { class: 'small muted' }, r.city || '')) },
    { key: 'skills', label: k.t('Skills', 'കഴിവുകൾ'), render: (r) => (r.skills || []).join(', ') },
    { key: 'checks', label: k.t('Checks', 'പരിശോധന'), render: (r) => h('div', { class: 'marketplace-steps', title: `${r.checks_done}/${r.checks_total}` }, Object.keys(CHECKS).map((c) => h('div', { class: 'marketplace-step' + (r.checks[c]?.done ? ' done' : '') }))) },
    { key: 'status', label: k.t('Status', 'സ്ഥിതി'), render: (r) => k.ui.badge(r.status, { approved: 'good', screening: 'warn', applied: 'info', rejected: 'bad', suspended: 'bad' }[r.status]) },
    { key: 'hours_verified', label: k.t('Hours', 'മണിക്കൂർ'), render: (r) => `${r.hours_verified}${r.hours_pending ? ` (+${r.hours_pending})` : ''}` },
  ], rows, { onRow: (r) => { const m = k.ui.modal(r.name, k.h('div')); volDetail(m.el.lastChild, k, r.id, false, () => { m.close(); k.refresh(); }); } }));
}

async function volDetail(el, k, id, self, changed) {
  const { h } = k;
  el.replaceChildren(k.ui.loading());
  const v = await k.api.get('/volunteers/' + id);
  const admin = ['platform_admin', 'agency_admin', 'coordinator', 'cpo'].includes(k.user.role);
  const reload = () => volDetail(el, k, id, self, changed);
  el.replaceChildren();
  el.append(k.ui.kv([[k.t('Agency', 'ഏജൻസി'), v.agency_name], [k.t('Phone', 'ഫോൺ'), v.phone], [k.t('Skills', 'കഴിവുകൾ'), (v.skills || []).join(', ')], [k.t('Availability', 'ലഭ്യത'), v.availability], [k.t('Applied', 'അപേക്ഷിച്ചത്'), fmtDate(v.applied_at, k)], [k.t('Status', 'സ്ഥിതി'), v.status], [k.t('Verified hours', 'സ്ഥിരീകരിച്ച മണിക്കൂർ'), String(v.hours_verified)]]));
  const box = h('div', { style: { margin: '12px 0' } }, h('b', null, '🛡 ' + k.t('Background check', 'പശ്ചാത്തല പരിശോധന')));
  for (const [c, [ic, en, ml]] of Object.entries(CHECKS)) {
    const done = v.checks[c]?.done;
    box.append(h('div', { class: 'marketplace-check' + (done ? ' done' : '') }, h('span', { class: 'ic' }, done ? '✓' : ic), h('div', { style: { flex: 1 } }, k.t(en, ml), done ? h('div', { class: 'small muted' }, `${v.checks[c].by} · ${fmtDate(v.checks[c].at, k)}`) : null),
      admin && !done && !['approved', 'rejected'].includes(v.status) ? k.ui.button(k.t('Mark done', 'പൂർത്തിയായി'), async () => { await k.api.post(`/volunteers/${id}/check`, { check: c }); reload(); }, { small: true }) : null));
  }
  el.append(box);
  if (admin && ['applied', 'screening'].includes(v.status)) el.append(h('div', { class: 'row' },
    k.ui.button('✅ ' + k.t('Approve', 'അംഗീകരിക്കുക'), async () => { const r = await k.api.post(`/volunteers/${id}/decision`, { decision: 'approve', create_account: !v.user_id }); if (r.account) k.ui.modal(k.t('Volunteer login created', 'ലോഗിൻ സൃഷ്ടിച്ചു'), k.ui.kv([['Username', r.account.username], ['Password', r.account.password], ['', r.account.note]])); reload(); changed && changed(); }, { tone: 'primary', disabled: v.checks_done < v.checks_total, title: k.t('All four checks are required', 'നാലു പരിശോധനകളും ആവശ്യമാണ്') }),
    k.ui.button(k.t('Reject', 'നിരസിക്കുക'), async () => { await k.api.post(`/volunteers/${id}/decision`, { decision: 'reject' }); reload(); }, { tone: 'danger' })));
  if (v.status === 'approved') {
    if (admin) {
      const progs = await k.core.get('/programmes' + (k.user.role === 'platform_admin' ? '' : '?agency_id=' + k.user.agency_id));
      el.append(k.ui.card({ title: '📅 ' + k.t('Schedule into a programme', 'പ്രോഗ്രാമിൽ ഉൾപ്പെടുത്തുക'), body: k.ui.form([
        { name: 'programme_id', label: k.t('Programme', 'പ്രോഗ്രാം'), type: 'select', required: true, options: progs.map((p) => ({ value: p.id, label: `${p.title} · ${(p.schedule || []).join(', ')}` })) },
        { name: 'date', label: k.t('Date', 'തീയതി'), type: 'date', required: true }, { name: 'role', label: k.t('Role', 'ചുമതല'), value: 'Session support' },
      ], async (x) => { await k.api.post(`/volunteers/${id}/shifts`, x); k.toast(k.t('Scheduled', 'നിശ്ചയിച്ചു'), 'good'); reload(); }, { submitLabel: k.t('Schedule', 'നിശ്ചയിക്കുക') }) }));
    }
    el.append(k.ui.section(k.t('Sessions & hours', 'സെഷനുകൾ, മണിക്കൂർ'), k.ui.table([
      { key: 'date', label: k.t('Date', 'തീയതി') }, { key: 'programme_title', label: k.t('Programme', 'പ്രോഗ്രാം') }, { key: 'hamlet_name', label: k.t('Hamlet', 'ഊര്') }, { key: 'role', label: k.t('Role', 'ചുമതല') },
      { key: 'hours', label: k.t('Hours', 'മണിക്കൂർ') },
      { key: 'status', label: '', render: (s) => s.status === 'scheduled' ? k.ui.button(k.t('Log hours', 'മണിക്കൂർ ചേർക്കുക'), async () => { const hrs = prompt(k.t('Hours spent?', 'എത്ര മണിക്കൂർ?'), '2'); if (hrs) { await k.api.post(`/shifts/${s.id}/log`, { hours: Number(hrs) }); reload(); } }, { small: true })
        : s.status === 'completed' ? (admin && !self ? k.ui.button(k.t('Verify', 'സ്ഥിരീകരിക്കുക'), async () => { await k.api.post(`/shifts/${s.id}/verify`); reload(); }, { small: true, tone: 'primary' }) : k.ui.badge(k.t('awaiting verification', 'സ്ഥിരീകരണം കാത്ത്'), 'warn'))
        : k.ui.badge(s.status, 'good') },
    ], v.shifts)));
    if (v.hours_verified) el.append(k.ui.button('🎖 ' + k.t('Certificate', 'സർട്ടിഫിക്കറ്റ്'), async () => {
      const c = await k.api.get(`/volunteers/${id}/certificate`);
      k.ui.modal(k.t('Volunteer certificate', 'സർട്ടിഫിക്കറ്റ്'), h('div', null, h('div', { class: 'marketplace-cert' }, h('div', { class: 'small muted' }, c.issuer), h('h2', null, k.t('Certificate of Volunteer Service', 'സന്നദ്ധസേവന സർട്ടിഫിക്കറ്റ്')), h('p', null, k.t('This is to certify that', 'ഇതിനാൽ സാക്ഷ്യപ്പെടുത്തുന്നു')), h('h3', null, c.name),
        h('p', null, k.t(`contributed ${c.hours} verified hours across ${c.sessions} sessions with ${c.agency}, from ${fmtDate(c.from, k)} to ${fmtDate(c.to, k)}`, `${c.agency}-നൊപ്പം ${c.sessions} സെഷനുകളിലായി ${c.hours} മണിക്കൂർ സേവനം`)),
        h('p', { class: 'small' }, c.programmes.map((p) => `${p.title} (${p.hamlet})`).join(' · ')), h('div', { class: 'small mono' }, `${c.code} · ${c.issued_at}`)), h('div', { class: 'row marketplace-noprint', style: { marginTop: '10px' } }, k.ui.button('🖨 ' + k.t('Print', 'പ്രിന്റ്'), () => window.print()))));
    }));
  }
}

async function apply(el, k) {
  setup(k);
  el.append(hero(k, 'Volunteer with AADI', 'AADI-യിൽ സന്നദ്ധസേവനം', 'Teach, mentor or coach children and youth in tribal hamlets — in person or online.', 'ആദിവാസി ഊരുകളിലെ കുട്ടികളെയും യുവാക്കളെയും പഠിപ്പിക്കാം.'));
  el.append(k.ui.card({ body: k.ui.form([
    { name: 'name', label: k.t('Full name', 'പേര്'), required: true }, { name: 'phone', label: k.t('Phone', 'ഫോൺ'), required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'city', label: k.t('City', 'നഗരം') },
    { name: 'skills', label: k.t('What can you teach? (comma separated)', 'എന്ത് പഠിപ്പിക്കാം?') }, { name: 'languages', label: k.t('Languages', 'ഭാഷകൾ'), value: 'Malayalam, English' }, { name: 'availability', label: k.t('When are you free?', 'എപ്പോൾ ഒഴിവുണ്ട്?') },
    { name: 'motivation', label: k.t('Why do you want to volunteer?', 'എന്തുകൊണ്ട്?'), type: 'textarea' },
  ], async (v) => { const r = await k.api.post('/volunteers/apply', v); el.replaceChildren(k.ui.card({ tone: 'good', title: '🙏 ' + k.t('Application received', 'അപേക്ഷ ലഭിച്ചു'), body: r.message || '' })); }, { submitLabel: k.t('Apply', 'അപേക്ഷിക്കുക') }) }));
}

// =====================================================================
// SPONSOR — donors
// =====================================================================
async function sponsor(el, k) {
  setup(k);
  el.append(hero(k, 'Sponsor & see your impact', 'സ്പോൺസർ ചെയ്യൂ, ഫലം കാണൂ', 'Sponsorship cards never show a child\'s name or photo. Impact is shown for groups of 5 or more, so no one can be identified.', 'കുട്ടിയുടെ പേരോ ഫോട്ടോയോ കാണിക്കില്ല. 5-ൽ കുറഞ്ഞ എണ്ണങ്ങൾ മറയ്ക്കുന്നു.'));
  const tabs = [{ id: 'browse', label: '💚 ' + k.t('Sponsor', 'സ്പോൺസർ'), render: (x) => sponsorBrowse(x, k) }];
  if (k.user.role === 'donor') tabs.push({ id: 'mine', label: '🧾 ' + k.t('My giving', 'എന്റെ സംഭാവനകൾ'), render: (x) => myGiving(x, k) });
  if (k.user.role !== 'donor') tabs.push({ id: 'ledger', label: '📒 ' + k.t('Ledger', 'ലെഡ്ജർ'), render: (x) => ledger(x, k) });
  el.append(k.ui.tabs(tabs, k.params.tab || 'browse'));
}
async function sponsorBrowse(el, k) {
  const { h } = k;
  let kind = k.params.kind || 'learner';
  const bar = h('div', { class: 'tabs' });
  const grid = h('div');
  const draw = () => bar.replaceChildren(...Object.entries(SK).map(([v, [ic, en, ml]]) => h('button', { class: kind === v ? 'on' : '', onclick: () => { kind = v; draw(); load(); } }, ic + ' ' + k.t(en, ml))));
  draw();
  el.append(bar, grid);
  async function load() {
    grid.replaceChildren(k.ui.loading());
    const rows = await k.api.get('/sponsorships?kind=' + kind);
    grid.replaceChildren(rows.length ? k.ui.grid(rows.map((s) => sponsorCard(k, s)), 260) : k.ui.empty(k.t('All sponsored — thank you!', 'എല്ലാം സ്പോൺസർ ചെയ്തു — നന്ദി!')));
  }
  await load();
}
function sponsorCard(k, s) {
  const { h } = k;
  return h('div', { class: 'marketplace-card' },
    h('div', { class: 'marketplace-kind' }, SK[s.kind][0] + ' ' + k.t(SK[s.kind][1], SK[s.kind][2])),
    h('div', { class: 't' }, k.t(s.card, s.card_ml || s.card)),
    h('div', { class: 'small muted' }, `${s.district} · ${s.community}`),
    h('div', { class: 'small' }, k.t(s.need, s.need_ml || s.need)),
    k.ui.progress(s.progress, `${fmt(s.raised || 0)} / ${fmt(s.target)}`),
    h('div', { class: 'row' }, k.user.role === 'donor' ? k.ui.button('💚 ' + k.t('Pledge', 'വാഗ്ദാനം'), () => pledgeModal(k, s), { tone: 'primary', small: true }) : null,
      k.ui.button('📈 ' + k.t('Impact', 'ഫലം'), () => impactModal(k, s.id), { small: true, tone: 'ghost' })));
}
function pledgeModal(k, s) {
  const m = k.ui.modal(k.t('Pledge support', 'പിന്തുണ വാഗ്ദാനം'), k.h('div', { class: 'stack' }, k.h('b', null, s.card),
    k.ui.form([{ name: 'amount', label: k.t('Amount (₹)', 'തുക (₹)'), type: 'number', required: true, value: s.kind === 'learner' ? 500 : 10000, min: 100 },
      { name: 'frequency', label: k.t('How often', 'എത്ര തവണ'), type: 'select', value: s.kind === 'learner' ? 'monthly' : 'once', options: [{ value: 'once', label: k.t('Once', 'ഒരിക്കൽ') }, { value: 'monthly', label: k.t('Monthly', 'മാസംതോറും') }, { value: 'quarterly', label: k.t('Quarterly', 'മൂന്നുമാസത്തിലൊരിക്കൽ') }, { value: 'yearly', label: k.t('Yearly', 'വർഷംതോറും') }] }],
    async (v) => { await k.api.post('/pledges', { ...v, sponsorship_id: s.id }); m.close(); k.toast(k.t('Thank you! Pledge recorded. Pay from "My giving".', 'നന്ദി! "എന്റെ സംഭാവനകൾ" വഴി അടയ്ക്കാം.'), 'good'); k.go('#/m/marketplace/sponsor?tab=mine'); }, { submitLabel: k.t('Pledge', 'വാഗ്ദാനം ചെയ്യുക') })));
}
async function impactModal(k, id) {
  const { h } = k;
  const m = k.ui.modal(k.t('Impact', 'ഫലം'), k.ui.loading());
  const r = await k.api.get(`/sponsorships/${id}/impact`);
  const hm = r.hamlet;
  m.el.lastChild.replaceWith(h('div', { class: 'stack' },
    h('b', null, r.sponsorship.card), k.ui.progress(r.sponsorship.progress, `${fmt(r.funds.raised)} ${k.t('raised of', 'ലഭിച്ചു /')} ${fmt(r.funds.target)} · ${r.funds.donors} ${k.t('donors', 'ദാതാക്കൾ')}`),
    k.ui.grid([k.ui.stat(k.t('Learners reached', 'എത്തിച്ചേർന്ന പഠിതാക്കൾ'), hm.learners_reached), k.ui.stat(k.t('Achievements (6 months)', 'നേട്ടങ്ങൾ (6 മാസം)'), hm.passport_awards_6m), k.ui.stat(k.t('Agencies working together', 'ഒരുമിച്ച് പ്രവർത്തിക്കുന്ന ഏജൻസികൾ'), hm.agencies), k.ui.stat(k.t('Youth placed in jobs', 'ജോലി ലഭിച്ച യുവാക്കൾ'), hm.youth_placed), k.ui.stat(k.t('Volunteer hours', 'സന്നദ്ധ മണിക്കൂർ'), hm.volunteer_hours)], 140),
    r.cohort ? k.ui.card({ tone: 'info', title: k.t(`Age group ${r.cohort.age_band} in ${hm.name}`, `${hm.name_ml} — ${r.cohort.age_band} വയസ്സ്`), body: [k.ui.kv([[k.t('Learners in this age group', 'ഈ പ്രായത്തിലെ പഠിതാക്കൾ'), String(r.cohort.learners)], [k.t('Achievements earned (6 months)', 'നേട്ടങ്ങൾ (6 മാസം)'), String(r.cohort.passport_awards_6m)]]), h('p', { class: 'small muted' }, r.cohort.note)] }) : null,
    h('p', { class: 'small muted' }, '🔒 ' + r.k_anonymity)));
}
async function myGiving(el, k) {
  const { h } = k;
  const d = await k.api.get('/donor/me');
  el.append(k.ui.grid([k.ui.stat(k.t('Pledged', 'വാഗ്ദാനം'), fmt(d.totals.pledged)), k.ui.stat(k.t('Given', 'നൽകിയത്'), fmt(d.totals.given)), k.ui.stat(k.t('Receipts', 'രസീതുകൾ'), d.donations.length)], 160));
  el.append(k.ui.section(k.t('Pledges', 'വാഗ്ദാനങ്ങൾ'), k.ui.table([
    { key: 'sponsorship', label: k.t('For', 'ഇതിന്'), render: (p) => p.sponsorship ? p.sponsorship.card : '—' }, { key: 'amount', label: k.t('Amount', 'തുക'), render: (p) => `${fmt(p.amount)} · ${p.frequency}` },
    { key: 'status', label: k.t('Status', 'സ്ഥിതി'), render: (p) => k.ui.badge(p.status, { fulfilled: 'good', active: 'good', pledged: 'warn', cancelled: '' }[p.status]) }, { key: 'paid', label: k.t('Paid', 'അടച്ചത്'), render: (p) => fmt(p.paid) },
    { key: 'x', label: '', render: (p) => ['pledged', 'active'].includes(p.status) ? k.ui.button(k.t('Pay now', 'ഇപ്പോൾ അടയ്ക്കുക'), () => payModal(k, p), { small: true, tone: 'primary' }) : '' },
  ], d.pledges)));
  el.append(k.ui.section(k.t('Donations & 80G receipts', 'സംഭാവനകൾ, 80G രസീതുകൾ'), k.ui.table([
    { key: 'paid_at', label: k.t('Date', 'തീയതി'), render: (x) => fmtDate(x.paid_at, k) }, { key: 'receipt_no', label: k.t('Receipt', 'രസീത്'), render: (x) => h('span', { class: 'mono small' }, x.receipt_no) },
    { key: 'amount', label: k.t('Amount', 'തുക'), render: (x) => fmt(x.amount) }, { key: 'sponsorship', label: k.t('For', 'ഇതിന്'), render: (x) => x.sponsorship ? x.sponsorship.card : '—' },
  ], d.donations, { onRow: (x) => receiptModal(k, x.id) })));
}
function payModal(k, p) {
  const { h } = k;
  const m = k.ui.modal(k.t('Pay pledge', 'വാഗ്ദാനം അടയ്ക്കുക'), h('div', { class: 'stack' },
    h('div', { class: 'marketplace-amt' }, fmt(p.amount)), h('div', null, p.sponsorship?.card),
    h('div', { class: 'marketplace-gateway' }, h('div', { style: { fontSize: '2rem' } }, '💳'), h('b', null, k.t('Payment gateway placeholder', 'പേയ്‌മെന്റ് ഗേറ്റ്‌വേ (ഡെമോ)')), h('p', { class: 'small' }, k.t('This demo does not move money. In production, UPI / net-banking via a licensed gateway goes here, with FCRA checks for foreign contributions.', 'ഈ ഡെമോ പണം കൈമാറുന്നില്ല.'))),
    k.ui.button(k.t('Simulate successful payment', 'വിജയകരമായ പേയ്‌മെന്റ് (ഡെമോ)'), async () => { const r = await k.api.post(`/pledges/${p.id}/pay`, { mode: 'UPI (demo)' }); m.close(); k.toast(k.t('Receipt issued: ', 'രസീത്: ') + r.receipt_no, 'good'); receiptModal(k, r.id); }, { tone: 'primary' })));
}
async function receiptModal(k, id) {
  const { h } = k;
  const r = await k.api.get('/receipts/' + id);
  k.ui.modal(k.t('Donation receipt', 'സംഭാവന രസീത്'), h('div', null, h('div', { class: 'marketplace-receipt' },
    h('div', { class: 'marketplace-between' }, h('div', null, h('h3', null, r.issuer.name), h('div', { class: 'small muted' }, `${r.issuer.kind} · ${r.issuer.address}`), h('div', { class: 'small muted' }, `PAN ${r.issuer.pan} · 80G ${r.issuer.reg_80g}`)), h('span', { class: 'marketplace-stamp' }, 'DEMO')),
    h('hr'), k.ui.kv([[k.t('Receipt no.', 'രസീത് നമ്പർ'), h('span', { class: 'mono' }, r.receipt_no)], [k.t('Date', 'തീയതി'), r.date], ['FY', r.fy], [k.t('Received from', 'ലഭിച്ചത്'), r.donor.name], ['PAN', r.donor.pan], [k.t('Mode', 'രീതി'), r.mode], [k.t('Purpose', 'ഉദ്ദേശ്യം'), r.purpose]]),
    h('div', { class: 'amt' }, fmt(r.amount)), h('div', { class: 'small' }, r.amount_words),
    h('p', { class: 'small muted', style: { marginTop: '10px' } }, r.issuer.note)), h('div', { class: 'row marketplace-noprint', style: { marginTop: '10px' } }, k.ui.button('🖨 ' + k.t('Print', 'പ്രിന്റ്'), () => window.print()))));
}
async function ledger(el, k) {
  let d;
  try { d = await k.api.get('/ledger'); } catch (e) { if (e.status === 403) { el.append(k.ui.empty(k.t('The donation ledger is held by the platform steward (CIF).', 'സംഭാവന ലെഡ്ജർ CIF ആണ് സൂക്ഷിക്കുന്നത്.'))); return; } throw e; }
  el.append(k.ui.grid([k.ui.stat(k.t('Received', 'ലഭിച്ചത്'), fmt(d.totals.received)), k.ui.stat(k.t('Open pledges', 'തുറന്ന വാഗ്ദാനങ്ങൾ'), fmt(d.totals.pledged_open)), k.ui.stat(k.t('Donors', 'ദാതാക്കൾ'), d.donors)], 160));
  el.append(k.ui.section(k.t('Donations', 'സംഭാവനകൾ'), k.ui.table([{ key: 'paid_at', label: 'Date', render: (x) => fmtDate(x.paid_at, k) }, { key: 'receipt_no', label: 'Receipt' }, { key: 'donor', label: 'Donor' }, { key: 'amount', label: 'Amount', render: (x) => fmt(x.amount) }, { key: 'purpose', label: 'Purpose' }, { key: 'mode', label: 'Mode' }], d.donations, { onRow: (x) => receiptModal(k, x.id) })));
  el.append(k.ui.section(k.t('Pledges', 'വാഗ്ദാനങ്ങൾ'), k.ui.table([{ key: 'pledged_at', label: 'Date', render: (x) => fmtDate(x.pledged_at, k) }, { key: 'donor', label: 'Donor' }, { key: 'amount', label: 'Amount', render: (x) => `${fmt(x.amount)} · ${x.frequency}` }, { key: 'status', label: 'Status' }, { key: 'purpose', label: 'Purpose' }], d.pledges)));
}

// =====================================================================
// JOBS — employers, youth, staff
// =====================================================================
async function jobs(el, k) {
  setup(k);
  const r = k.user.role;
  if (r === 'employer') {
    el.append(hero(k, 'Hire with dignity', 'മാന്യമായ നിയമനം', 'You see only adults who chose to share a job profile with you. Every posting must meet the fair-work checklist.', 'നിങ്ങളുമായി പ്രൊഫൈൽ പങ്കിടാൻ തീരുമാനിച്ച മുതിർന്നവരെ മാത്രമേ കാണൂ.'));
    el.append(k.ui.tabs([
      { id: 'postings', label: '📋 ' + k.t('My postings', 'എന്റെ ഒഴിവുകൾ'), render: (x) => employerJobs(x, k) },
      { id: 'apps', label: '📥 ' + k.t('Applications', 'അപേക്ഷകൾ'), render: (x) => employerApps(x, k) },
      { id: 'pool', label: '👥 ' + k.t('Candidate pool', 'ഉദ്യോഗാർത്ഥികൾ'), render: (x) => pool(x, k) },
      { id: 'placed', label: '🤝 ' + k.t('Placements', 'നിയമനങ്ങൾ'), render: (x) => placements(x, k) },
    ], k.params.tab || 'postings'));
    return;
  }
  if (r === 'learner') {
    el.append(hero(k, 'Jobs & internships', 'ജോലികളും ഇന്റേൺഷിപ്പുകളും', 'Every job here has a written offer, fair wage and safe stay. Never give your original certificates to anyone.', 'ഇവിടെയുള്ള ഓരോ ജോലിക്കും രേഖാമൂല ഓഫർ, ന്യായമായ കൂലി, സുരക്ഷിത താമസം. ഒറിജിനൽ സർട്ടിഫിക്കറ്റുകൾ ആർക്കും നൽകരുത്.'));
    el.append(k.ui.tabs([{ id: 'open', label: '💼 ' + k.t('Open jobs', 'ഒഴിവുകൾ'), render: (x) => youthJobs(x, k) }, { id: 'mine', label: '📨 ' + k.t('My applications', 'എന്റെ അപേക്ഷകൾ'), render: (x) => myApps(x, k) }], k.params.tab || 'open'));
    return;
  }
  el.append(hero(k, 'Jobs & placements', 'ജോലികൾ, നിയമനങ്ങൾ', 'Refer youth (with their consent) and follow up after placement: paid on time, documents with them, safe stay.', 'യുവാക്കളെ ശുപാർശ ചെയ്യുക, നിയമനത്തിനു ശേഷം പിന്തുടരുക.'));
  el.append(k.ui.tabs([{ id: 'open', label: '💼 ' + k.t('Open jobs', 'ഒഴിവുകൾ'), render: (x) => youthJobs(x, k, true) }, { id: 'apps', label: '📨 ' + k.t('Applications', 'അപേക്ഷകൾ'), render: (x) => staffApps(x, k) }, { id: 'placed', label: '🤝 ' + k.t('Placement follow-up', 'നിയമന പിന്തുടർച്ച'), render: (x) => placements(x, k, true) }], k.params.tab || 'open'));
}
function jobCard(k, j, actions) {
  const { h } = k;
  return h('div', { class: 'marketplace-card' },
    h('div', { class: 'marketplace-between' }, h('div', { class: 'marketplace-kind' }, `${j.kind} · ${j.sector}`), j.status !== 'open' ? k.ui.badge(j.status, '') : null),
    h('div', { class: 't' }, k.t(j.title, j.title_ml || j.title)), h('div', { class: 'small' }, `${j.employer_name} · ${j.location}`),
    h('div', { class: 'marketplace-amt' }, fmt(j.wage_monthly), h('span', { class: 'small muted' }, ' / ' + k.t('month', 'മാസം'))),
    h('div', { class: 'small muted' }, `🏠 ${j.accommodation || '—'} · 🍛 ${j.food || '—'}`),
    j.fair_work ? h('div', { class: 'marketplace-fair' }, Object.values(FAIR).map(([en, ml]) => h('span', null, '✓ ' + k.t(en, ml)))) : null,
    h('div', { class: 'row' }, k.ui.button('🔊', () => k.speak(k.t(`${j.title}. ${j.employer_name}, ${j.location}. ${j.wage_monthly} rupees a month. ${j.description}`, `${j.title_ml || j.title}. ${j.location}. മാസം ${j.wage_monthly} രൂപ. ${j.description_ml || ''}`)), { small: true, tone: 'ghost' }), actions));
}
async function youthJobs(el, k, staff) {
  const rows = await k.api.get('/jobs');
  if (!rows.length) { el.append(k.ui.empty(k.t('No open jobs right now.', 'ഇപ്പോൾ ഒഴിവുകളില്ല.'))); return; }
  el.append(k.ui.grid(rows.map((j) => jobCard(k, j, staff ? k.ui.button(k.t('Refer a youth', 'ശുപാർശ ചെയ്യുക'), () => referModal(k, j), { small: true }) :
    j.my_status ? appBadge(k, j.my_status) : k.ui.button(k.t('Apply', 'അപേക്ഷിക്കുക'), () => applyFlow(k, j), { small: true, tone: 'primary' }))), 260));
}
async function applyFlow(k, j, personId) {
  try {
    await k.api.post(`/jobs/${j.id}/apply`, personId ? { person_id: personId } : {});
    k.toast(k.t('Application sent!', 'അപേക്ഷ അയച്ചു!'), 'good'); k.speak(k.t('Application sent', 'അപേക്ഷ അയച്ചു')); k.refresh();
  } catch (e) {
    if (e.data && e.data.error === 'consent_required' && !personId) {
      const ok = await k.ui.confirm(k.t(`To apply, ${e.data.agency_name} needs your permission to see your job profile (education, skills, achievements — not your phone). Allow?`, `അപേക്ഷിക്കാൻ ${e.data.agency_name}-ന് നിങ്ങളുടെ ജോലി പ്രൊഫൈൽ കാണാൻ അനുമതി വേണം (ഫോൺ നമ്പർ അല്ല). അനുവദിക്കണോ?`));
      if (!ok) return;
      await k.core.post('/consents', { person_id: k.user.person_id, agency_id: e.data.agency_id, scopes: [...new Set(['profile', ...(e.data.current_scopes || []), 'employment'])] });
      return applyFlow(k, j);
    }
    throw e;
  }
}
function referModal(k, j) {
  const m = k.ui.modal(k.t('Refer a youth', 'ശുപാർശ ചെയ്യുക') + ' — ' + j.title, k.h('div', { class: 'stack' }, k.h('p', { class: 'small muted' }, k.t('Only adults (18+) can be referred. They must have given employment consent to the employer\'s agency.', '18+ മാത്രം. തൊഴിൽ സമ്മതം ആവശ്യമാണ്.')),
    k.ui.personPicker({ kind: 'youth', onPick: async (p) => { try { await applyFlow(k, j, p.id); m.close(); } catch (e) { k.toast(e.message, 'bad'); } } })));
}
async function myApps(el, k) {
  const rows = await k.api.get('/applications');
  if (!rows.length) { el.append(k.ui.empty(k.t('You have not applied yet.', 'നിങ്ങൾ ഇതുവരെ അപേക്ഷിച്ചിട്ടില്ല.'))); return; }
  for (const a of rows) el.append(k.ui.card({ title: a.job_title, subtitle: a.employer_name, body: k.h('div', { class: 'stack' }, k.h('div', { class: 'marketplace-row' }, appBadge(k, a.status), k.h('span', { class: 'small muted' }, fmtDate(a.applied_at, k))),
    k.h('ol', { class: 'small' }, a.history.map((x) => k.h('li', null, `${k.t(APP[x.status]?.[1] || x.status, APP[x.status]?.[2])} · ${fmtDate(x.at, k)}`)))),
  actions: a.next.includes('withdrawn') ? k.ui.button(k.t('Withdraw', 'പിൻവലിക്കുക'), async () => { if (await k.ui.confirm(k.t('Withdraw this application?', 'പിൻവലിക്കണോ?'))) { await k.api.post(`/applications/${a.id}/status`, { status: 'withdrawn' }); k.refresh(); } }, { small: true, tone: 'ghost' }) : null }));
}
async function staffApps(el, k) {
  const rows = await k.api.get('/applications');
  el.append(k.ui.table([{ key: 'person', label: k.t('Youth', 'യുവജനം'), render: (a) => `${a.person.name} (${a.person.age}) · ${a.person.hamlet}` }, { key: 'job_title', label: k.t('Job', 'ജോലി'), render: (a) => `${a.job_title} — ${a.employer_name}` }, { key: 'status', label: k.t('Status', 'സ്ഥിതി'), render: (a) => appBadge(k, a.status) }, { key: 'source', label: k.t('Source', 'ഉറവിടം') }, { key: 'applied_at', label: k.t('Applied', 'തീയതി'), render: (a) => fmtDate(a.applied_at, k) }], rows, { empty: k.t('No applications from learners you can see.', 'അപേക്ഷകളില്ല.') }));
}
async function employerJobs(el, k) {
  const rows = await k.api.get('/jobs');
  el.append(k.h('div', { class: 'row', style: { marginBottom: '10px' } }, k.ui.button('➕ ' + k.t('Post a job', 'ജോലി പോസ്റ്റ് ചെയ്യുക'), () => jobForm(k), { tone: 'primary' })));
  el.append(rows.length ? k.ui.grid(rows.map((j) => jobCard(k, j, [k.h('span', { class: 'small' }, Object.entries(j.applications || {}).map(([s, n]) => `${s}: ${n}`).join(' · ') || k.t('No applications yet', 'അപേക്ഷകളില്ല')),
    k.h('select', { class: 'input', style: { width: 'auto', padding: '2px 6px' }, onchange: async (e) => { await k.api.post(`/jobs/${j.id}/status`, { status: e.target.value }); k.toast(k.t('Updated', 'പുതുക്കി'), 'good'); } }, ['open', 'paused', 'closed'].map((s) => k.h('option', { value: s, selected: s === j.status }, s)))])), 260) : k.ui.empty(k.t('No postings yet.', 'ഒഴിവുകളില്ല.')));
}
function jobForm(k) {
  const m = k.ui.modal(k.t('Post a job / internship', 'ജോലി / ഇന്റേൺഷിപ്പ്'), k.ui.form([
    { name: 'employer_name', label: k.t('Employer name', 'തൊഴിലുടമ'), required: true }, { name: 'title', label: 'Job title', required: true }, { name: 'title_ml', label: 'ജോലിയുടെ പേര് (മലയാളം)' },
    { name: 'kind', label: k.t('Type', 'തരം'), type: 'select', value: 'job', options: ['job', 'internship', 'apprenticeship'] }, { name: 'sector', label: k.t('Sector', 'മേഖല') },
    { name: 'location', label: k.t('Work location', 'സ്ഥലം'), required: true }, { name: 'district', label: k.t('District', 'ജില്ല') },
    { name: 'wage_monthly', label: k.t('Monthly wage (₹)', 'മാസ ശമ്പളം (₹)'), type: 'number', required: true, min: 0 }, { name: 'openings', label: k.t('Openings', 'ഒഴിവുകൾ'), type: 'number', value: 1 },
    { name: 'accommodation', label: k.t('Accommodation details', 'താമസ വിവരം') }, { name: 'food', label: k.t('Food', 'ഭക്ഷണം') }, { name: 'skills', label: k.t('Skills (comma separated)', 'കഴിവുകൾ') },
    { name: 'description', label: 'Description', type: 'textarea' }, { name: 'description_ml', label: 'വിവരണം (മലയാളം)', type: 'textarea' }, { name: 'closes_on', label: k.t('Closes on', 'അവസാന തീയതി'), type: 'date' },
    ...Object.entries(FAIR).map(([key, [en, ml]]) => ({ name: 'fw_' + key, label: '✓ ' + k.t('We commit: ' + en, 'ഞങ്ങൾ ഉറപ്പ് നൽകുന്നു: ' + ml), type: 'checkbox' })),
  ], async (v) => {
    const checklist = Object.fromEntries(Object.keys(FAIR).map((key) => [key, !!v['fw_' + key]]));
    await k.api.post('/jobs', { ...v, checklist }); m.close(); k.toast(k.t('Job posted', 'ജോലി പോസ്റ്റ് ചെയ്തു'), 'good'); k.refresh();
  }, { submitLabel: k.t('Post job', 'പോസ്റ്റ് ചെയ്യുക') }));
}
function candView(k, c) {
  const { h } = k;
  return h('div', { class: 'marketplace-cand' }, h('div', { class: 'marketplace-between' }, h('b', null, c.display_name), h('span', { class: 'small muted' }, `${c.age} · ${c.gender === 'F' ? k.t('Woman', 'സ്ത്രീ') : k.t('Man', 'പുരുഷൻ')}`)),
    h('div', { class: 'small' }, `${c.hamlet}, ${c.district} · ${c.education || '—'}`), c.aspirations ? h('div', { class: 'small' }, '🎯 ' + c.aspirations) : null,
    c.passport.length ? h('div', { class: 'marketplace-fair', style: { marginTop: '6px' } }, c.passport.map((p) => h('span', null, '🏅 ' + p.title))) : null);
}
async function pool(el, k) {
  const { h } = k;
  el.append(h('p', { class: 'small muted' }, '🔒 ' + k.t('Only adults who chose to share their job profile with your organisation appear here. Contact happens through the AADI facilitator.', 'നിങ്ങളുമായി പ്രൊഫൈൽ പങ്കിട്ട മുതിർന്നവർ മാത്രം.')));
  const q = h('input', { class: 'input', type: 'search', placeholder: k.t('Filter by skill, aspiration…', 'തിരയുക…'), style: { maxWidth: '320px', marginBottom: '10px' } });
  const grid = h('div');
  const load = async () => { const rows = await k.api.get('/candidates' + (q.value ? '?q=' + encodeURIComponent(q.value) : '')); grid.replaceChildren(rows.length ? k.ui.grid(rows.map((c) => candView(k, c)), 240) : k.ui.empty(k.t('No candidates match.', 'പൊരുത്തമില്ല.'))); };
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
  el.append(q, grid); await load();
}
async function employerApps(el, k) {
  const { h } = k;
  const rows = await k.api.get('/applications');
  if (!rows.length) { el.append(k.ui.empty(k.t('No applications yet.', 'അപേക്ഷകളില്ല.'))); return; }
  for (const a of rows) el.append(k.ui.card({ title: a.job_title, body: h('div', { class: 'stack' }, candView(k, a.candidate), h('div', { class: 'marketplace-row' }, appBadge(k, a.status), h('span', { class: 'small muted' }, `${a.source} · ${fmtDate(a.applied_at, k)}`))),
    actions: a.next.filter((s) => s !== 'withdrawn').map((s) => k.ui.button(k.t(APP[s][1], APP[s][2]), async () => {
      if (s === 'hired' && !(await k.ui.confirm(k.t('Confirm hire: you will give a written offer, pay at least the stated wage into the employee\'s own account, and never keep their original documents.', 'നിയമനം സ്ഥിരീകരിക്കുക: രേഖാമൂല ഓഫർ, പറഞ്ഞ ശമ്പളം, ഒറിജിനൽ രേഖകൾ പിടിച്ചുവയ്ക്കില്ല.')))) return;
      await k.api.post(`/applications/${a.id}/status`, { status: s }); k.refresh();
    }, { small: true, tone: s === 'rejected' ? 'ghost' : s === 'hired' ? 'primary' : '' })) }));
}
async function placements(el, k, staff) {
  const rows = await k.api.get('/placements');
  const chk = (c) => (c ? (c.paid_on_time && c.documents_with_youth && c.safe_accommodation ? '✅' : '⚠️') + ' ' + fmtDate(c.at, k) : '—');
  el.append(k.ui.table([
    { key: 'person', label: k.t('Person', 'വ്യക്തി'), render: (p) => `${p.person} · ${p.hamlet}` }, { key: 'job_title', label: k.t('Job', 'ജോലി'), render: (p) => `${p.job_title} — ${p.employer_name}` },
    { key: 'start_date', label: k.t('Started', 'ആരംഭം'), render: (p) => fmtDate(p.start_date, k) }, { key: 'wage_monthly', label: k.t('Wage', 'ശമ്പളം'), render: (p) => fmt(p.wage_monthly) },
    { key: 'check_30', label: k.t('30-day check', '30 ദിവസം'), render: (p) => chk(p.check_30) }, { key: 'check_90', label: k.t('90-day check', '90 ദിവസം'), render: (p) => chk(p.check_90) },
    { key: 'status', label: k.t('Status', 'സ്ഥിതി'), render: (p) => k.ui.badge(p.status, { active: 'good', concern: 'bad', left: '' }[p.status]) },
    staff ? { key: 'x', label: '', render: (p) => k.ui.button(k.t('Check-in', 'വിവരം ശേഖരിക്കുക'), () => {
      const m = k.ui.modal(k.t('Placement check-in', 'നിയമന പരിശോധന'), k.ui.form([
        { name: 'which', label: k.t('Which check', 'ഏത്'), type: 'select', value: p.check_30 ? 'check_90' : 'check_30', options: [{ value: 'check_30', label: '30 days' }, { value: 'check_90', label: '90 days' }] },
        { name: 'paid_on_time', label: k.t('Paid on time, into own account', 'സമയത്ത് സ്വന്തം അക്കൗണ്ടിൽ ശമ്പളം'), type: 'checkbox' }, { name: 'documents_with_youth', label: k.t('Original documents are with the youth', 'ഒറിജിനൽ രേഖകൾ യുവാവിന്റെ കയ്യിൽ'), type: 'checkbox' },
        { name: 'safe_accommodation', label: k.t('Accommodation is safe', 'താമസം സുരക്ഷിതം'), type: 'checkbox' }, { name: 'left', label: k.t('Has left the job', 'ജോലി വിട്ടു'), type: 'checkbox' }, { name: 'note', label: k.t('Note', 'കുറിപ്പ്'), type: 'textarea' },
      ], async (v) => { await k.api.post(`/placements/${p.id}/checkin`, v); m.close(); k.refresh(); }));
    }, { small: true }) } : null,
  ].filter(Boolean), rows, { empty: k.t('No placements yet.', 'നിയമനങ്ങളില്ല.') }));
}

// =====================================================================
// CSR / GRANT REPORT
// =====================================================================
async function reports(el, k) {
  setup(k);
  const { h } = k;
  const r = await k.api.get('/reports/summary');
  el.append(hero(k, 'CSR / grant report', 'CSR / ഗ്രാന്റ് റിപ്പോർട്ട്', `Anonymised impact across ${r.totals.hamlets} hamlets · FY ${r.fy}`, `${r.totals.hamlets} ഊരുകളിലെ പേരില്ലാത്ത ഫലം · FY ${r.fy}`));
  el.append(h('div', { class: 'row', style: { marginBottom: '12px' } }, h('a', { class: 'btn primary', href: '/api/m/marketplace/reports/csr.csv', download: `aadi-csr-report-${r.fy}.csv` }, '⬇ ' + k.t('Download CSV', 'CSV ഡൗൺലോഡ്')), k.ui.button('🖨 ' + k.t('Print', 'പ്രിന്റ്'), () => window.print(), { tone: 'ghost' })));
  el.append(k.ui.grid([k.ui.stat(k.t('Learners reached', 'എത്തിച്ചേർന്ന പഠിതാക്കൾ'), r.totals.learners_reached), k.ui.stat(k.t('Funds received', 'ലഭിച്ച തുക'), fmt(r.totals.funds_received_inr)), k.ui.stat(k.t('Volunteer hours', 'സന്നദ്ധ മണിക്കൂർ'), r.totals.volunteer_hours), k.ui.stat(k.t('Active volunteers', 'സജീവ സന്നദ്ധർ'), r.totals.volunteers_active), k.ui.stat(k.t('Youth placed', 'ജോലി ലഭിച്ചവർ'), r.totals.youth_placed), k.ui.stat(k.t('Open jobs', 'ഒഴിവുകൾ'), r.totals.jobs_open)], 150));
  if (r.my_giving) el.append(k.ui.card({ tone: 'good', title: k.t('Your contribution', 'നിങ്ങളുടെ സംഭാവന'), body: `${fmt(r.my_giving.given)} · ${r.my_giving.n} ${k.t('donations', 'സംഭാവനകൾ')}` }));
  el.append(k.ui.grid([
    k.ui.card({ title: k.t('Funds by purpose', 'ഉദ്ദേശ്യം അനുസരിച്ച്'), body: k.ui.bars(r.by_kind.map((x) => ({ label: k.t(SK[x.kind]?.[1] || x.kind, SK[x.kind]?.[2]), value: x.amount })), { unit: '' }) }),
    k.ui.card({ title: k.t('Donations by month', 'മാസം അനുസരിച്ച്'), body: [k.ui.spark(r.by_month.map((x) => x.amount), { w: 260, hgt: 60 }), h('div', { class: 'small muted' }, r.by_month.map((x) => x.month).join(' · '))] }),
  ], 300));
  el.append(k.ui.section(k.t('By hamlet', 'ഊര് അനുസരിച്ച്'), k.ui.table([
    { key: 'hamlet', label: k.t('Hamlet', 'ഊര്'), render: (x) => h('div', null, h('b', null, x.hamlet), h('div', { class: 'small muted' }, `${x.district} · ${x.community}`)) }, { key: 'agencies', label: k.t('Agencies', 'ഏജൻസികൾ') },
    { key: 'learners_reached', label: k.t('Learners', 'പഠിതാക്കൾ') }, { key: 'girls_reached', label: k.t('Girls/women', 'പെൺകുട്ടികൾ') }, { key: 'passport_awards', label: k.t('Achievements', 'നേട്ടങ്ങൾ') },
    { key: 'youth_placed', label: k.t('Placed', 'നിയമനം') }, { key: 'volunteer_hours', label: k.t('Vol. hrs', 'മണിക്കൂർ') }, { key: 'funds_received_inr', label: k.t('Funds', 'തുക'), render: (x) => fmt(x.funds_received_inr) },
  ], r.by_hamlet)));
  el.append(h('p', { class: 'small muted' }, '🔒 ' + r.method));
}

async function home(el, k) {
  const r = k.user.role;
  if (r === 'donor') return sponsor(el, k);
  if (['employer', 'learner'].includes(r)) return jobs(el, k);
  if (r === 'govt_viewer') return reports(el, k);
  return volunteers(el, k);
}

export default { views: { home, volunteers, apply, sponsor, jobs, reports } };
