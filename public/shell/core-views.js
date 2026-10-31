// Core (brain-owned) views: home, hamlets & service map, people, consent, passport, platform admin.
import { state, http, t, h, toast, ui, speak, outboxCount } from './kit.js';

const STAFF = ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'];
const TRACK = { tuition: ['School tuition', 'ട്യൂഷൻ', '📘'], literacy: ['Literacy', 'സാക്ഷരത', '✍️'], exams: ['Exam coaching', 'പരീക്ഷാ പരിശീലനം', '🎯'], language: ['Languages', 'ഭാഷകൾ', '🗣️'], lifeskills: ['Life skills', 'ജീവിത നൈപുണ്യം', '🧭'], counselling: ['Counselling', 'കൗൺസിലിംഗ്', '🤝'], digital: ['Digital & money', 'ഡിജിറ്റൽ', '📱'] };
const trackLabel = (k) => (TRACK[k] ? `${TRACK[k][2]} ${t(TRACK[k][0], TRACK[k][1])}` : k);
const SCOPE_ML = { profile: 'പ്രൊഫൈൽ', progress: 'പഠന പുരോഗതി', wellbeing: 'ക്ഷേമം', contact: 'ഫോൺ / ബന്ധപ്പെടൽ', employment: 'ജോലി', research: 'ഗവേഷണം (പേരില്ലാതെ)' };

export const coreNav = [
  { view: 'home', label: 'Home', label_ml: 'ഹോം', icon: '🏠', section: 'home' },
  { view: 'passport', label: 'My Learning Passport', label_ml: 'എന്റെ പഠന പാസ്‌പോർട്ട്', icon: '🎓', section: 'learn', roles: ['learner'] },
  { view: 'mydata', label: 'My data & consent', label_ml: 'എന്റെ വിവരം, സമ്മതം', icon: '🔐', section: 'learn', roles: ['learner'] },
  { view: 'hamlets', label: 'Hamlets', label_ml: 'ഊരുകൾ', icon: '🏡', section: 'community', roles: ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'govt_viewer', 'donor'] },
  { view: 'people', label: 'Learners & families', label_ml: 'പഠിതാക്കൾ', icon: '👥', section: 'teach', roles: ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'] },
  { view: 'register', label: 'Register a learner', label_ml: 'പഠിതാവിനെ ചേർക്കുക', icon: '➕', section: 'teach', roles: ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'] },
  { view: 'agencies', label: 'Agencies', label_ml: 'ഏജൻസികൾ', icon: '🏛️', section: 'admin', roles: ['platform_admin', 'agency_admin', 'coordinator', 'govt_viewer'] },
  { view: 'staff', label: 'Staff & accounts', label_ml: 'ജീവനക്കാർ', icon: '🪪', section: 'admin', roles: ['platform_admin', 'agency_admin'] },
  { view: 'platform', label: 'Services (modules)', label_ml: 'സേവനങ്ങൾ', icon: '🧩', section: 'admin', roles: ['platform_admin'] },
  { view: 'resilience', label: 'Sync & resilience', label_ml: 'സിങ്ക്, പ്രതിരോധം', icon: '🛡️', section: 'admin', roles: ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'] },
  { view: 'audit', label: 'Audit trail', label_ml: 'ഓഡിറ്റ്', icon: '📜', section: 'admin', roles: ['platform_admin', 'cpo'] },
  { view: 'architecture', label: 'How the platform works', label_ml: 'വേദി എങ്ങനെ', icon: '🧠', section: 'admin' },
  { view: 'settings', label: 'Settings', label_ml: 'ക്രമീകരണം', icon: '⚙️', section: 'admin' },
];

function moduleLinks(k, section) {
  const out = [];
  for (const m of k.modules) for (const n of m.nav || []) {
    if (n.roles && !n.roles.includes(state.user.role)) continue;
    if (section && n.section !== section) continue;
    out.push({ ...n, href: `#/m/${m.id}/${n.view}`, down: m.state !== 'up' });
  }
  return out;
}
const curated = (k) => k.navItems().filter((i) => (i.view !== 'home' || i.module) && !(i.core && i.section === 'admin')).sort((a, b) => (a.core ? 1 : 0) - (b.core ? 1 : 0));
const tile = (l) => h('a', { class: 'tile', href: l.href, style: l.down ? { opacity: .5 } : null }, h('span', { class: 'e', 'aria-hidden': 'true' }, l.icon || '•'), h('b', null, t(l.label, l.label_ml)));

export const coreViews = {
  // ---------------------------------------------------------------- home
  async home(el, k) {
    const u = state.user;
    const nm = (u.display_name || '').split(' — ')[0];
    const first = u.person_id ? nm.split(' ')[0] : nm;
    if (u.role === 'learner') {
      const greet = t(`Hello, ${first}!`, `നമസ്കാരം, ${first}!`);
      el.append(h('div', { class: 'hero' }, h('img', { src: '/img/cif-mark.png', alt: '', style: { width: '64px', height: '64px', borderRadius: '50%', background: '#fff', padding: '4px' } }),
        h('div', { style: { flex: 1 } }, h('h1', null, greet), h('p', null, t('What would you like to learn today?', 'ഇന്ന് എന്ത് പഠിക്കണം?'))), ui.speakBtn(greet + ' ' + t('What would you like to learn today?', 'ഇന്ന് എന്ത് പഠിക്കണം?'))));
      const items = curated(k);
      el.append(ui.section(t('My learning', 'എന്റെ പഠനം'), h('div', { class: 'tiles' }, items.filter((i) => i.section === 'learn').map(tile))));
      el.append(ui.section(t('Help & care', 'സഹായം, കരുതൽ'), h('div', { class: 'tiles' }, items.filter((i) => i.section === 'care').map(tile))));
      el.append(ui.section(t('My hamlet', 'എന്റെ ഊര്'), h('div', { class: 'tiles' }, items.filter((i) => i.section === 'community').map(tile))));
      return;
    }
    if (u.role === 'guardian') {
      const kids = await k.core.get('/persons');
      const wards = kids.filter((p) => p.guardian_id === u.person_id);
      el.append(h('div', { class: 'hero' }, h('div', { style: { flex: 1 } }, h('h1', null, t(`Welcome, ${first}`, `സ്വാഗതം, ${first}`)), h('p', null, t('See how your children are learning, and decide who can see their information.', 'കുട്ടികളുടെ പഠനം കാണുക, അവരുടെ വിവരം ആർക്ക് കാണാമെന്ന് നിങ്ങൾ തീരുമാനിക്കുക.'))), ui.speakBtn(t('See how your children are learning, and decide who can see their information.', 'കുട്ടികളുടെ പഠനം കാണുക, അവരുടെ വിവരം ആർക്ക് കാണാമെന്ന് നിങ്ങൾ തീരുമാനിക്കുക.'))));
      el.append(ui.section(t('My children', 'എന്റെ കുട്ടികൾ'), h('div', { class: 'tiles' }, wards.map((w) => h('a', { class: 'tile', href: '#/person/' + w.id }, h('span', { class: 'e' }, w.gender === 'F' ? '👧' : '👦'), h('b', null, w.name), h('span', { class: 'small muted' }, (w.age ?? '') + t(' yrs', ' വയസ്സ്') + (w.school_class ? ' · ' + t('Class ', 'ക്ലാസ് ') + w.school_class : '')))))));
      const links = curated(k).filter((i) => i.view !== 'home');
      if (links.length) el.append(ui.section(t('For families', 'കുടുംബങ്ങൾക്ക്'), h('div', { class: 'tiles' }, links.map(tile))));
      return;
    }
    // staff / external
    el.append(h('div', { class: 'row', style: { alignItems: 'flex-end', marginBottom: '8px' } }, h('div', { style: { flex: 1 } },
      h('h1', null, t(`Welcome, ${first}`, `സ്വാഗതം, ${first}`)),
      h('p', { class: 'muted' }, [u.role_label, u.agency_name].filter(Boolean).join(' · ')))));
    const [hamlets, progs] = await Promise.all([k.core.get('/hamlets'), k.core.get('/programmes' + (u.agency_id && u.role !== 'platform_admin' && STAFF.includes(u.role) ? '?agency_id=' + u.agency_id : ''))]);
    const mine = u.role === 'platform_admin' || !u.agency_id || !STAFF.includes(u.role) ? hamlets : hamlets.filter((x) => x.agencies.some((a) => a.id === u.agency_id));
    const stats = [ui.stat(t('Hamlets', 'ഊരുകൾ'), mine.length, u.role === 'platform_admin' ? t('on the platform', 'പ്ലാറ്റ്ഫോമിൽ') : t('your agency serves', 'നിങ്ങളുടെ ഏജൻസി'))];
    stats.push(ui.stat(t('Programmes', 'പരിപാടികൾ'), progs.length, t('active', 'സജീവം')));
    stats.push(ui.stat(t('Learners enrolled', 'ചേർന്നവർ'), progs.reduce((s, p) => s + (p.enrolled || 0), 0), t('across these programmes', 'ഈ പരിപാടികളിൽ')));
    if (STAFF.includes(u.role)) { const ppl = await k.core.get('/persons?limit=5000'); stats.push(ui.stat(t('People you can see', 'നിങ്ങൾക്ക് കാണാവുന്നവർ'), ppl.length, t('with their consent', 'സമ്മതത്തോടെ'))); }
    if (u.role === 'platform_admin' && k.health) stats.push(ui.stat(t('Services running', 'സേവനങ്ങൾ'), `${k.modules.filter((m) => m.state === 'up').length}/${k.modules.length}`, t('modules attached to the brain', 'മൊഡ്യൂളുകൾ')));
    el.append(ui.grid(stats, 180));
    const links = moduleLinks(k).filter((l) => l.section !== 'admin');
    if (links.length) el.append(ui.section(t('Your tools', 'നിങ്ങളുടെ ഉപകരണങ്ങൾ'), h('div', { class: 'tiles' }, links.map(tile))));
    el.append(ui.section(t('Hamlets', 'ഊരുകൾ'), hamletCards(mine)));
  },

  // ---------------------------------------------------------------- hamlets
  async hamlets(el, k) {
    el.append(h('h1', null, t('Hamlets', 'ഊരുകൾ')), h('p', { class: 'muted' }, t('Every hamlet is shared ground. Several agencies can serve the same hamlet — the service map shows who does what, where the gaps are, and where efforts overlap.', 'ഓരോ ഊരും പൊതു ഇടമാണ്. പല ഏജൻസികൾക്ക് ഒരേ ഊരിൽ സേവനം നൽകാം.')));
    const hs = await k.core.get('/hamlets');
    el.append(hamletCards(hs));
  },
  async hamlet(el, k) {
    const sm = await k.core.get(`/hamlets/${k.id}/service-map`);
    const hm = sm.hamlet;
    el.append(h('a', { href: '#/hamlets', class: 'small' }, '← ' + t('All hamlets', 'എല്ലാ ഊരുകളും')),
      h('h1', null, t(hm.name, hm.name_ml), ' ', h('span', { class: 'ml muted', style: { fontSize: '.6em' } }, state.lang === 'en' ? hm.name_ml : hm.name)),
      h('p', { class: 'muted' }, `${hm.district} · ${hm.panchayat} · ${hm.community} ${t('community', 'സമുദായം')}`),
      ui.grid([
        ui.stat(t('People registered', 'രജിസ്റ്റർ ചെയ്തവർ'), sm.people.total, `${sm.people.children} ${t('children', 'കുട്ടികൾ')} · ${sm.people.youth} ${t('youth', 'യുവജനം')} · ${sm.people.adults} ${t('adults', 'മുതിർന്നവർ')}`),
        ui.stat(t('Reached by a programme', 'പരിപാടികളിൽ'), sm.people.reached),
        ui.stat(t('Connectivity', 'കണക്ടിവിറ്റി'), { none: t('None', 'ഇല്ല'), '2g': '2G', '4g': '4G' }[hm.connectivity] || hm.connectivity, hm.connectivity === 'none' ? t('Syncs by courier (USB)', 'USB വഴി സിങ്ക്') : t('Hub syncs automatically', 'സ്വയം സിങ്ക്')),
        ui.stat(t('Power', 'വൈദ്യുതി'), { grid: t('Grid', 'ഗ്രിഡ്'), solar: t('Solar', 'സോളാർ'), none: t('None', 'ഇല്ല') }[hm.power] || hm.power),
      ], 180));
    const tracks = sm.tracks.map((tr) => {
      const ps = sm.byTrack[tr];
      return h('div', { class: 'card' + (ps.length ? '' : ' tone-warn') }, h('h3', null, trackLabel(tr)),
        ps.length ? h('div', { class: 'stack' }, ps.map((p) => h('div', null,
          h('b', null, h('span', { 'aria-hidden': 'true', style: { width: '10px', height: '10px', borderRadius: '50%', background: p.agency_colour, display: 'inline-block', marginRight: '8px' } }), t(p.title, p.title_ml)),
          p.brand ? h('div', { class: 'small', style: { color: 'var(--forest-2)', fontWeight: 700 } }, t(p.brand, p.brand_ml) + (p.sponsor_name ? t(` · sponsored by ${p.sponsor_name.replace('Community Innovations Foundation', 'CIF')}`, ` · ${p.sponsor_name.replace('Community Innovations Foundation', 'CIF')} പിന്തുണ`) : '')) : null,
          h('div', { class: 'small muted' }, `${p.agency_name} · ${(p.schedule || []).join(', ')} · ${p.enrolled} ${t('enrolled', 'പേർ')}`))))
          : h('p', { class: 'small muted' }, t('No agency runs this here yet — a gap to fill.', 'ഇവിടെ ഇത് നടത്തുന്ന ഏജൻസിയില്ല.')));
    });
    el.append(ui.section(t('Service map', 'സേവന ഭൂപടം'), ui.grid(tracks, 260)));
    const notes = [];
    if (sm.gaps.length) notes.push(ui.card({ tone: 'warn', title: t('Gaps', 'വിടവുകൾ'), body: h('p', null, sm.gaps.map(trackLabel).join(', ')) }));
    for (const o of sm.overlaps) notes.push(ui.card({ tone: 'info', title: t('Shared track: ', 'പങ്കിട്ട വിഭാഗം: ') + trackLabel(o.track), body: h('p', null, o.agencies.join(' + ') + '. ' + t(o.note, 'ഒന്നിലധികം ഏജൻസികൾ — സമയം ഏകോപിപ്പിക്കുക.')) }));
    for (const c of sm.clashes) notes.push(ui.card({ tone: 'bad', title: t('Clash · ', 'സംഘർഷം · ') + c.slot + ' · ' + trackLabel(c.track), body: h('div', null, h('p', null, c.programmes.join(' and ')), h('p', { class: 'small muted' }, t('Same track at the same time — learners must choose one. Agree on different days.', 'ഒരേ സമയം ഒരേ വിഭാഗം — വ്യത്യസ്ത ദിവസങ്ങൾ തീരുമാനിക്കുക.'))) }));
    if (notes.length) el.append(ui.section(t('Coordination', 'ഏകോപനം'), ui.grid(notes, 280)));
  },

  // ---------------------------------------------------------------- people
  async people(el, k) {
    el.append(h('div', { class: 'row' }, h('h1', { style: { flex: 1 } }, t('Learners & families', 'പഠിതാക്കൾ, കുടുംബങ്ങൾ')),
      ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'].includes(state.user.role) ? h('a', { class: 'btn primary', href: '#/register' }, '➕ ' + t('Register a learner', 'പുതിയ പഠിതാവ്')) : null));
    el.append(h('p', { class: 'muted' }, state.user.role === 'platform_admin' || state.user.role === 'cpo'
      ? t('As platform steward you can see everyone. Every record you open is written to the audit trail.', 'പ്ലാറ്റ്ഫോം മേൽനോട്ടക്കാരനായി എല്ലാവരെയും കാണാം; ഓരോ തുറക്കലും ഓഡിറ്റിൽ രേഖപ്പെടുത്തും.')
      : t('You only see people who are enrolled with your agency and whose family has given consent.', 'നിങ്ങളുടെ ഏജൻസിയിൽ ചേർന്ന്, കുടുംബം സമ്മതം നൽകിയവരെ മാത്രമേ കാണാനാകൂ.')));
    let hamlet = k.params.hamlet || null, kind = k.params.kind || '', q = '';
    const list = h('div');
    const run = async () => {
      list.replaceChildren(ui.loading());
      const qs = new URLSearchParams({ limit: 1000 }); if (hamlet) qs.set('hamlet_id', hamlet); if (kind) qs.set('kind', kind); if (q) qs.set('q', q);
      const rows = await k.core.get('/persons?' + qs);
      list.replaceChildren(h('p', { class: 'small muted' }, `${rows.length} ${t('people', 'പേർ')}`), ui.table([
        { key: 'name', label: t('Name', 'പേര്'), render: (r) => h('b', null, r.name) },
        { key: 'kind', label: t('Group', 'വിഭാഗം'), render: (r) => ({ child: t('Child', 'കുട്ടി'), youth: t('Youth', 'യുവജനം'), adult: t('Adult', 'മുതിർന്നവർ') }[r.kind]) },
        { key: 'age', label: t('Age', 'വയസ്സ്') },
        { key: 'school_class', label: t('Class / education', 'ക്ലാസ്') },
        { key: 'language', label: t('Home language', 'വീട്ടുഭാഷ') },
        { key: 'phone', label: t('Phone', 'ഫോൺ'), render: (r) => r.phone ? (r.contact_hidden ? h('span', { class: 'muted', title: t('No contact consent', 'സമ്മതമില്ല') }, r.phone) : r.phone) : '—' },
      ], rows, { onRow: (r) => k.go('#/person/' + r.id), empty: t('No one to show. People appear here once they enrol with your agency and consent.', 'ആരുമില്ല.') }));
    };
    const search = h('input', { class: 'input', placeholder: t('Search by name', 'പേര് തിരയുക'), style: { maxWidth: '240px' } });
    let tm; search.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { q = search.value; run(); }, 250); });
    const kindSel = h('select', { class: 'input', style: { maxWidth: '160px' }, onchange: () => { kind = kindSel.value; run(); } }, [['', t('Everyone', 'എല്ലാവരും')], ['child', t('Children', 'കുട്ടികൾ')], ['youth', t('Youth', 'യുവജനം')], ['adult', t('Adults', 'മുതിർന്നവർ')]].map(([v, l]) => h('option', { value: v, selected: v === kind }, l)));
    el.append(h('div', { class: 'row', style: { marginBottom: '12px' } }, ui.hamletSelect((v) => { hamlet = v; run(); }, { value: hamlet || '' }), kindSel, search), list);
    run();
  },

  async person(el, k) {
    const p = await k.core.get('/persons/' + k.id);
    const isOwner = state.user.person_id === p.id || (state.user.role === 'guardian' && p.guardian_id === state.user.person_id);
    el.append(h('a', { href: state.user.role === 'guardian' ? '#/home' : '#/people', class: 'small' }, '← ' + t('Back', 'തിരികെ')));
    el.append(h('div', { class: 'row', style: { margin: '6px 0 14px' } }, h('div', { style: { fontSize: '2.6rem' } }, p.kind === 'child' ? (p.gender === 'F' ? '👧' : '👦') : p.kind === 'youth' ? '🧑' : '🧓'),
      h('div', { style: { flex: 1 } }, h('h1', { style: { margin: 0 } }, p.name), h('div', { class: 'muted' }, [p.age != null ? p.age + t(' years', ' വയസ്സ്') : null, p.school_class ? t('Class/education: ', 'ക്ലാസ്: ') + p.school_class : null, p.language].filter(Boolean).join(' · '))),
      p.access?.progress ? h('a', { class: 'btn', href: '#/passport/' + p.id }, '🎓 ' + t('Learning passport', 'പഠന പാസ്‌പോർട്ട്')) : null));
    el.append(ui.grid([
      ui.card({ title: t('Profile', 'പ്രൊഫൈൽ'), body: ui.kv([
        [t('Hamlet', 'ഊര്'), p.hamlet_id ? h('a', { href: '#/hamlet/' + p.hamlet_id }, t('Open hamlet', 'ഊര് തുറക്കുക')) : '—'],
        [t('Guardian', 'രക്ഷിതാവ്'), p.guardian ? `${p.guardian.name}${p.guardian.relation ? ' (' + p.guardian.relation + ')' : ''}` : '—'],
        [t('Phone', 'ഫോൺ'), p.phone || '—'],
        [t('Literacy', 'സാക്ഷരത'), p.literacy_level || '—'],
        [t('Dream', 'സ്വപ്നം'), p.aspirations || '—'],
        [t('Minor', 'പ്രായപൂർത്തിയാകാത്തയാൾ'), p.minor ? t('Yes — guardian decides consent', 'അതെ — സമ്മതം രക്ഷിതാവ്') : t('No', 'അല്ല')],
      ]) }),
      ui.card({ title: t('What you are allowed to see', 'നിങ്ങൾക്ക് കാണാവുന്നത്'), subtitle: t('Decided by the family\'s consent, not by the agency.', 'കുടുംബത്തിന്റെ സമ്മതമാണ് തീരുമാനിക്കുന്നത്.'),
        body: h('div', { class: 'stack' }, Object.entries(p.access || {}).map(([s, ok]) => h('div', { class: 'row', style: { gap: '8px' } }, ui.badge(ok ? '✓' : '✕', ok ? 'good' : 'bad'), t(s, SCOPE_ML[s])))) }),
    ], 280));
    if (p.enrolments && p.enrolments.length) {
      el.append(ui.section(t('Programmes', 'പരിപാടികൾ'), ui.table([
        { key: 'title', label: t('Programme', 'പരിപാടി') }, { key: 'track', label: t('Track', 'വിഭാഗം'), render: (r) => trackLabel(r.track) },
        { key: 'agency_name', label: t('Agency', 'ഏജൻസി') }, { key: 'status', label: t('Status', 'സ്ഥിതി'), render: (r) => ui.badge(r.status, r.status === 'active' ? 'good' : r.status === 'dropped' ? 'bad' : '') }, { key: 'start_date', label: t('Since', 'മുതൽ') },
      ], p.enrolments)));
    }
    el.append(ui.section(t('Consent', 'സമ്മതം'), await consentPanel(k, p, isOwner)));
  },

  // ---------------------------------------------------------------- my data (learner self)
  async mydata(el, k) {
    if (!state.user.person_id) { el.append(ui.empty(t('No learner record linked to this account.', 'ബന്ധിപ്പിച്ച രേഖയില്ല.'))); return; }
    const p = await k.core.get('/persons/' + state.user.person_id);
    const intro = t('Your learning record belongs to you. Here you decide which agencies can see it. You can change your mind at any time.', 'നിങ്ങളുടെ പഠന രേഖ നിങ്ങളുടേതാണ്. ഏത് ഏജൻസികൾക്ക് കാണാമെന്ന് നിങ്ങൾ തീരുമാനിക്കുന്നു. എപ്പോൾ വേണമെങ്കിലും മാറ്റാം.');
    el.append(h('div', { class: 'row' }, h('h1', { style: { flex: 1 } }, t('My data & consent', 'എന്റെ വിവരം, സമ്മതം')), ui.speakBtn(intro)), h('p', null, intro));
    el.append(await consentPanel(k, p, true));
  },

  // ---------------------------------------------------------------- register
  async register(el, k) {
    const [hamlets, scopes] = await Promise.all([k.core.get('/hamlets'), k.core.get('/consent/scopes')]);
    const mine = state.user.role === 'platform_admin' ? hamlets : hamlets.filter((x) => x.agencies.some((a) => a.id === state.user.agency_id));
    el.append(h('h1', null, t('Register a learner', 'പഠിതാവിനെ ചേർക്കുക')),
      h('p', { class: 'muted' }, t('The record belongs to the learner and family. Read the consent options aloud to the guardian in their language and tick only what they agree to.', 'രേഖ പഠിതാവിന്റേതും കുടുംബത്തിന്റേതുമാണ്. സമ്മത ഓപ്ഷനുകൾ രക്ഷിതാവിനെ വായിച്ചുകേൾപ്പിച്ച്, അവർ സമ്മതിക്കുന്നവ മാത്രം തിരഞ്ഞെടുക്കുക.')));
    el.append(ui.card({ body: ui.form([
      { name: 'name', label: t('Learner name', 'പേര്'), required: true },
      { name: 'hamlet_id', label: t('Hamlet', 'ഊര്'), type: 'select', required: true, options: mine.map((x) => ({ value: x.id, label: `${x.name} (${x.district})` })) },
      { name: 'kind', label: t('Group', 'വിഭാഗം'), type: 'select', required: true, value: 'child', options: [{ value: 'child', label: t('Child (under 18)', 'കുട്ടി') }, { value: 'youth', label: t('Youth (18–30)', 'യുവജനം') }, { value: 'adult', label: t('Adult learner', 'മുതിർന്ന പഠിതാവ്') }] },
      { name: 'gender', label: t('Gender', 'ലിംഗം'), type: 'select', options: [{ value: 'F', label: t('Female', 'സ്ത്രീ') }, { value: 'M', label: t('Male', 'പുരുഷൻ') }, { value: 'O', label: t('Other', 'മറ്റുള്ളവ') }] },
      { name: 'dob', label: t('Date of birth (approximate is fine)', 'ജനനത്തീയതി'), type: 'date' },
      { name: 'school_class', label: t('Class / education', 'ക്ലാസ്') },
      { name: 'language', label: t('Home language', 'വീട്ടുഭാഷ'), placeholder: 'Muthuvan, Paniya, Malayalam…' },
      { name: 'aspirations', label: t('Dream / aspiration', 'സ്വപ്നം') },
      { name: 'g_name', label: t('Guardian name (required for children)', 'രക്ഷിതാവിന്റെ പേര്') },
      { name: 'g_relation', label: t('Relation', 'ബന്ധം'), type: 'select', options: ['mother', 'father', 'grandparent', 'aunt/uncle', 'elder sibling', 'other'] },
      { name: 'g_phone', label: t('Guardian phone', 'ഫോൺ'), type: 'tel' },
      { name: 'scopes', label: t('Consent given to your agency', 'നിങ്ങളുടെ ഏജൻസിക്ക് സമ്മതം'), type: 'multiselect', value: ['profile', 'progress'], options: Object.entries(scopes).map(([kk, v]) => ({ value: kk, label: `${t(kk, SCOPE_ML[kk])} — ${v}` })) },
    ], async (v) => {
      if (v.kind === 'child' && !v.g_name) throw new Error(t('A guardian is required for a child.', 'കുട്ടിക്ക് രക്ഷിതാവ് ആവശ്യമാണ്.'));
      if (!v.scopes.includes('profile')) throw new Error(t('Without "profile" consent the agency cannot work with this learner.', '"പ്രൊഫൈൽ" സമ്മതമില്ലാതെ സാധ്യമല്ല.'));
      const out = await k.core.post('/persons', { name: v.name, hamlet_id: v.hamlet_id, kind: v.kind, gender: v.gender, dob: v.dob || null, school_class: v.school_class, language: v.language, aspirations: v.aspirations, guardian: v.g_name ? { name: v.g_name, relation: v.g_relation, phone: v.g_phone } : null, consent: { scopes: v.scopes, method: 'in_person' } });
      if (out.queued) return;
      toast(t('Learner registered with consent recorded.', 'പഠിതാവിനെ ചേർത്തു.'), 'good');
      k.go('#/person/' + out.id);
    }, { submitLabel: t('Register with consent', 'സമ്മതത്തോടെ ചേർക്കുക') }) }));
  },

  // ---------------------------------------------------------------- passport
  async passport(el, k) {
    const pid = k.id || state.user.person_id;
    if (!pid) { el.append(ui.empty(t('Open a learner first.', 'ആദ്യം ഒരു പഠിതാവിനെ തുറക്കുക.'))); return; }
    const pp = await k.core.get('/passport/' + pid);
    const byType = (ty) => pp.entries.filter((e) => e.type === ty);
    const verifyUrl = `${location.origin}/#/verify/${pp.verify_code}`;
    el.append(h('div', { class: 'row no-print', style: { marginBottom: '12px' } }, h('h1', { style: { flex: 1, margin: 0 } }, t('Learning Passport', 'പഠന പാസ്‌പോർട്ട്')), ui.button('🖨️ ' + t('Print / save PDF', 'പ്രിന്റ് / PDF'), () => window.print())));
    el.append(h('div', { class: 'passport' },
      h('div', { class: 'ph' }, h('img', { src: '/img/cif-mark.png', alt: '' }), h('div', { style: { flex: 1 } }, h('div', { class: 'small', style: { color: '#b9d2cb' } }, t('Learning Passport', 'പഠന പാസ്‌പോർട്ട്') + ' · ' + state.brand.short), h('h2', { style: { margin: 0 } }, pp.person.name), h('div', { class: 'small', style: { color: '#cfe2dc' } }, `${pp.hamlet ? pp.hamlet.name + ', ' + pp.hamlet.district : ''}`)),
        h('div', { style: { background: '#fff', padding: '6px', borderRadius: '6px' }, title: verifyUrl }, pseudoQr(pp.verify_code))),
      h('div', { class: 'pb' },
        ui.grid([ui.stat(t('Skills earned', 'നേടിയ കഴിവുകൾ'), byType('competency').length), ui.stat(t('Certificates', 'സർട്ടിഫിക്കറ്റുകൾ'), byType('certificate').length), ui.stat(t('Milestones', 'നാഴികക്കല്ലുകൾ'), byType('milestone').length), ui.stat(t('Programmes', 'പരിപാടികൾ'), pp.enrolments.length)], 150),
        h('h3', { style: { marginTop: '20px' } }, t('Journey', 'യാത്ര')),
        pp.entries.length ? h('div', { class: 'timeline' }, pp.entries.map((e) => h('div', { class: 't' }, h('b', null, e.title), ' ', e.level ? ui.badge(t('Level ', 'നില ') + e.level, 'info') : null, ' ', ui.badge(e.type, e.type === 'certificate' ? 'good' : ''),
          h('div', { class: 'small muted' }, `${(e.issued_at || '').slice(0, 10)} · ${e.agency_name || ''}${e.evidence ? ' · ' + (typeof e.evidence === 'string' ? e.evidence : JSON.stringify(e.evidence)).slice(0, 80) : ''}`))))
          : ui.empty(t('The journey starts here. Skills and certificates will appear as they are earned.', 'യാത്ര ഇവിടെ തുടങ്ങുന്നു.')),
        h('p', { class: 'small muted', style: { marginTop: '16px' } }, t('Verify this passport at ', 'പരിശോധിക്കാൻ: '), h('span', { class: 'mono' }, verifyUrl), ' · ', pp.issued_by))));
  },

  async verify(el, k) {
    el.append(h('div', { class: 'row', style: { marginBottom: '16px' } }, h('img', { src: '/img/cif-mark.png', alt: '', style: { width: '48px' } }), h('h2', { style: { margin: 0 } }, t('Passport verification', 'പാസ്‌പോർട്ട് പരിശോധന'))));
    try {
      const r = await http('GET', '/api/core/passport/verify/' + encodeURIComponent(k.id || ''));
      el.append(ui.card({ tone: 'good', title: '✓ ' + t('Valid Learning Passport', 'സാധുവായ പാസ്‌പോർട്ട്'), body: ui.kv([[t('Holder', 'ഉടമ'), r.name], [t('Recorded achievements', 'നേട്ടങ്ങൾ'), r.entries], [t('Issuer', 'നൽകിയത്'), r.issuer]]) }));
      el.append(h('p', { class: 'small muted' }, t('Only minimal details are shown publicly to protect the learner\'s privacy.', 'സ്വകാര്യതയ്ക്കായി കുറഞ്ഞ വിവരങ്ങൾ മാത്രം.')));
    } catch (e) { el.append(ui.card({ tone: 'bad', title: t('Not found', 'കണ്ടെത്തിയില്ല'), body: t('This code does not match any passport.', 'ഈ കോഡിന് പാസ്‌പോർട്ടില്ല.') })); }
  },

  // ---------------------------------------------------------------- agencies
  async agencies(el, k) {
    const [ags, hs, progs] = await Promise.all([k.core.get('/agencies'), k.core.get('/hamlets'), k.core.get('/programmes')]);
    el.append(h('h1', null, t('Agencies', 'ഏജൻസികൾ')), h('p', { class: 'muted' }, t('Agencies are tenants on a shared platform. CIF stewards the rules (consent, safeguarding, data standards); each agency runs its own programmes and staff.', 'ഏജൻസികൾ പങ്കിട്ട പ്ലാറ്റ്ഫോമിലെ അംഗങ്ങളാണ്. CIF നിയമങ്ങൾ സംരക്ഷിക്കുന്നു.')));
    el.append(ui.grid(ags.map((a) => {
      const serves = hs.filter((x) => x.agencies.some((y) => y.id === a.id));
      const ps = progs.filter((p) => p.agency_id === a.id);
      return h('div', { class: 'card', style: { borderTop: `4px solid ${a.colour || '#999'}` } }, h('h3', null, a.name, ' ', a.steward ? ui.badge(t('Platform steward', 'മേൽനോട്ടം'), 'good') : null),
        h('div', { class: 'sub' }, `${a.type.toUpperCase()} · ${a.about || ''}`),
        ui.kv([[t('Hamlets served', 'ഊരുകൾ'), serves.map((s) => s.name).join(', ') || '—'], [t('Programmes', 'പരിപാടികൾ'), ps.length], [t('Learners enrolled', 'പഠിതാക്കൾ'), ps.reduce((s, p) => s + p.enrolled, 0)]]));
    }), 300));
  },

  // ---------------------------------------------------------------- staff
  async staff(el, k) {
    const [users, ags] = await Promise.all([k.core.get('/users'), k.core.get('/agencies')]);
    el.append(h('div', { class: 'row' }, h('h1', { style: { flex: 1 } }, t('Staff & accounts', 'ജീവനക്കാർ')), ui.button('➕ ' + t('Add staff', 'ചേർക്കുക'), () => {
      const roles = ['agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor', ...(state.user.role === 'platform_admin' ? ['cpo', 'platform_admin', 'donor', 'employer', 'govt_viewer'] : [])];
      const m = ui.modal(t('Add staff account', 'അക്കൗണ്ട് ചേർക്കുക'), ui.form([
        { name: 'display_name', label: t('Full name', 'പേര്'), required: true }, { name: 'username', label: t('Username', 'ഉപയോക്തൃനാമം'), required: true }, { name: 'password', label: t('Temporary password', 'താൽക്കാലിക പാസ്‌വേഡ്'), type: 'password', required: true },
        { name: 'role', label: t('Role', 'പദവി'), type: 'select', required: true, options: roles },
        ...(state.user.role === 'platform_admin' ? [{ name: 'agency_id', label: t('Agency', 'ഏജൻസി'), type: 'select', options: ags.map((a) => ({ value: a.id, label: a.name })) }] : []),
        { name: 'safeguarding_trained', label: t('Has completed safeguarding training', 'സുരക്ഷാ പരിശീലനം പൂർത്തിയാക്കി'), type: 'checkbox' },
      ], async (v) => { const r = await k.core.post('/users', v); toast(r.note || t('Account created.', 'അക്കൗണ്ട് സൃഷ്ടിച്ചു.'), r.note ? 'warn' : 'good'); m.close(); k.refresh(); }));
    }, { tone: 'primary' })));
    el.append(h('p', { class: 'muted' }, t('Anyone who works with children stays inactive until safeguarding training is complete.', 'കുട്ടികളുമായി പ്രവർത്തിക്കുന്നവർ സുരക്ഷാ പരിശീലനം കഴിയുംവരെ നിഷ്ക്രിയരായിരിക്കും.')));
    el.append(ui.table([
      { key: 'display_name', label: t('Name', 'പേര്'), render: (r) => h('b', null, r.display_name) }, { key: 'username', label: t('Username', 'ഉപയോക്തൃനാമം'), render: (r) => h('span', { class: 'mono' }, r.username) },
      { key: 'role_label', label: t('Role', 'പദവി') }, { key: 'agency_name', label: t('Agency', 'ഏജൻസി') },
      { key: 'safeguarding_trained', label: t('Safeguarding', 'സുരക്ഷ'), render: (r) => r.safeguarding_trained ? ui.badge(t('Trained', 'പരിശീലനം'), 'good') : ui.button(t('Mark trained', 'പൂർത്തിയായി'), async () => { await k.core.post(`/users/${r.id}/safeguarding-trained`); k.refresh(); }, { small: true }) },
      { key: 'active', label: t('Status', 'സ്ഥിതി'), render: (r) => ui.badge(r.active ? t('Active', 'സജീവം') : t('Inactive', 'നിഷ്ക്രിയം'), r.active ? 'good' : 'warn') },
    ], users));
  },

  // ---------------------------------------------------------------- platform: modules
  async platform(el, k) {
    const mods = await k.core.get('/modules');
    el.append(h('h1', null, t('Services attached to the brain', 'ബ്രെയിനുമായി ബന്ധിപ്പിച്ച സേവനങ്ങൾ')),
      h('p', { class: 'muted' }, t('Each service is a module plugged into the central brain. If one fails repeatedly, its circuit breaker trips and it rests for 30 seconds — every other service keeps running. You can also switch a service off here to see that for yourself.', 'ഓരോ സേവനവും ഒരു മൊഡ്യൂളാണ്. ഒന്ന് പരാജയപ്പെട്ടാൽ മറ്റുള്ളവ പ്രവർത്തിക്കും.')));
    el.append(ui.table([
      { key: 'name', label: t('Service', 'സേവനം'), render: (m) => h('div', null, h('b', null, `${m.icon || ''} ${t(m.name || m.id, m.name_ml)}`), h('div', { class: 'small muted' }, m.description || '')) },
      { key: 'version', label: t('Version', 'പതിപ്പ്'), render: (m) => h('span', { class: 'mono' }, m.version || '—') },
      { key: 'state', label: t('State', 'സ്ഥിതി'), render: (m) => ui.badge(m.state, m.state === 'up' ? 'good' : m.state === 'tripped' ? 'warn' : 'bad') },
      { key: 'calls', label: t('Requests', 'അഭ്യർത്ഥനകൾ') },
      { key: 'failures', label: t('Errors', 'പിഴവുകൾ'), render: (m) => h('span', { title: m.lastError || m.error || '' }, `${m.failures} ${m.trips ? `(${m.trips} trips)` : ''}`) },
      { key: 'x', label: '', render: (m) => m.critical ? ui.badge(t('Critical — always on', 'നിർണായകം'), 'info') : m.state === 'failed' ? h('span', { class: 'small' }, m.error) : ui.button(m.state === 'disabled' ? t('Switch on', 'ഓൺ') : t('Switch off', 'ഓഫ്'), async () => { await k.core.post(`/modules/${m.id}/${m.state === 'disabled' ? 'enable' : 'disable'}`); await k.reloadModules(); k.refresh(); }, { small: true, tone: m.state === 'disabled' ? 'primary' : 'danger' }) },
    ], mods));
  },

  // ---------------------------------------------------------------- resilience
  async resilience(el, k) {
    const [st, hl] = await Promise.all([http('GET', '/api/sync/status'), k.core.get('/health')]);
    const isAdmin = state.user.role === 'platform_admin';
    el.append(h('h1', null, t('Sync & resilience', 'സിങ്ക്, പ്രതിരോധം')),
      h('p', { class: 'muted' }, t('Every action is an append-only event, chained by a cryptographic hash. Hubs at the centres keep a full working copy and exchange events with the cloud whenever a connection appears — or by USB courier where there is none.', 'ഓരോ പ്രവൃത്തിയും ഹാഷ് ശൃംഖലയിൽ ചേർത്ത ഒരു ഇവന്റാണ്.')));
    el.append(ui.grid([
      ui.stat(t('This node', 'ഈ നോഡ്'), hl.node, hl.role === 'hub' ? t('Centre hub', 'കേന്ദ്ര ഹബ്') : t('Cloud core', 'ക്ലൗഡ്')),
      ui.stat(t('Events in log', 'ഇവന്റുകൾ'), hl.events.toLocaleString(), t('last ', 'അവസാനം ') + (hl.last_event || '').replace('T', ' ').slice(0, 16)),
      ui.stat(t('Waiting on this device', 'ഈ ഉപകരണത്തിൽ കാത്തിരിക്കുന്നവ'), outboxCount(), t('offline changes queued in the browser', 'ഓഫ്‌ലൈൻ മാറ്റങ്ങൾ')),
      ui.stat(t('Upstream', 'മുകളിലേക്ക്'), st.upstream ? (st.lastError ? t('Retrying', 'വീണ്ടും ശ്രമിക്കുന്നു') : t('Connected', 'ബന്ധിച്ചു')) : t('None (this is the cloud)', 'ഇല്ല (ക്ലൗഡ്)'), st.lastError || (st.lastRun ? st.lastRun.at : '')),
    ], 200));
    el.append(ui.section(t('Nodes contributing to this log', 'ഈ ലോഗിലേക്ക് സംഭാവന ചെയ്യുന്ന നോഡുകൾ'), ui.table([{ key: 'node', label: t('Node', 'നോഡ്'), render: (r) => h('span', { class: 'mono' }, r.node) }, { key: 'events', label: t('Events', 'ഇവന്റുകൾ') }, { key: 'last', label: t('Last event', 'അവസാനം') }], st.nodes)));
    if (isAdmin) {
      const chainBox = h('div');
      el.append(ui.section(t('Drills', 'പരിശീലനങ്ങൾ'), ui.grid([
        ui.card({ title: '🔗 ' + t('Verify the event chain', 'ഇവന്റ് ശൃംഖല പരിശോധിക്കുക'), body: h('div', null, h('p', { class: 'small' }, t('Recomputes every hash. Any tampering with past records shows up here.', 'എല്ലാ ഹാഷുകളും വീണ്ടും കണക്കാക്കുന്നു.')), chainBox), actions: ui.button(t('Verify now', 'പരിശോധിക്കുക'), async () => {
          const r = await k.core.get('/chain/verify');
          chainBox.replaceChildren(...Object.entries(r).map(([n, v]) => h('div', null, ui.badge(v.ok ? '✓ intact' : '✕ broken', v.ok ? 'good' : 'bad'), ' ', h('span', { class: 'mono small' }, `${n}: ${v.checked} events`))));
        }, { tone: 'primary' }) }),
        ui.card({ title: '📦 ' + t('Courier bundle (USB)', 'USB ബണ്ടിൽ'), body: h('p', { class: 'small' }, t('For centres with no connectivity: export all events to a file, carry it on a pen drive, and import it at the other end. Import is safe to repeat — nothing is duplicated.', 'കണക്ടിവിറ്റിയില്ലാത്ത കേന്ദ്രങ്ങൾക്കായി.')),
          actions: [h('a', { class: 'btn', href: '/api/sync/export', download: '' }, '⬇️ ' + t('Export bundle', 'എക്സ്പോർട്ട്')),
            (() => { const inp = h('input', { type: 'file', accept: '.gz,.aadi', hidden: true, onchange: async () => { const f = inp.files[0]; if (!f) return; const r = await fetch('/api/sync/import', { method: 'POST', body: await f.arrayBuffer(), credentials: 'same-origin' }); const j = await r.json(); toast(r.ok ? t(`Imported ${j.added} new events (${j.failed} rejected).`, `${j.added} ഇവന്റുകൾ ഇറക്കുമതി ചെയ്തു.`) : j.message, r.ok ? 'good' : 'bad'); } }); return h('label', { class: 'btn' }, '⬆️ ' + t('Import bundle', 'ഇംപോർട്ട്'), inp); })()] }),
        ui.card({ title: '📴 ' + t('Simulate losing the internet', 'ഇന്റർനെറ്റ് നഷ്ടം അനുകരിക്കുക'), body: h('p', { class: 'small' }, st.upstream ? t('Stops this hub talking to the cloud. Keep working; changes pile up and flow out when you switch it back.', 'ഹബ്-ക്ലൗഡ് ബന്ധം നിർത്തുന്നു.') : t('Available on a centre hub node. On the cloud, try switching a service off on the Services page instead.', 'ഹബ്ബിൽ ലഭ്യം.')),
          actions: st.upstream ? [ui.button(st.simulatedOffline ? t('Reconnect', 'വീണ്ടും ബന്ധിപ്പിക്കുക') : t('Go offline', 'ഓഫ്‌ലൈൻ'), async () => { await http('POST', '/api/sync/simulate-offline', { on: !st.simulatedOffline }); k.refresh(); }, { tone: 'primary' }), ui.button(t('Sync now', 'ഇപ്പോൾ സിങ്ക്'), async () => { const r = await http('POST', '/api/sync/now'); toast(`↑${r.pushed ?? 0} ↓${r.pulled ?? 0}`, 'good'); k.refresh(); })] : null }),
      ], 280)));
    }
    el.append(ui.section(t('Graceful degradation ladder', 'ക്രമമായ പിൻവാങ്ങൽ'), ui.table([
      { key: 'l', label: t('Layer', 'തലം') }, { key: 'w', label: t('Keeps working when…', 'എപ്പോൾ പ്രവർത്തിക്കുന്നു') }, { key: 'd', label: t('What people can do', 'ചെയ്യാവുന്നത്') },
    ], [
      { l: '☁️ ' + t('Cloud', 'ക്ലൗഡ്'), w: t('Normal operation', 'സാധാരണ'), d: t('Everything, across all hamlets and agencies', 'എല്ലാം') },
      { l: '🏠 ' + t('Centre hub', 'കേന്ദ്ര ഹബ്'), w: t('Internet is down for hours or weeks', 'ഇന്റർനെറ്റ് ഇല്ലാത്തപ്പോൾ'), d: t('Full learning, attendance, tests at the centre; syncs later', 'കേന്ദ്രത്തിൽ മുഴുവൻ പഠനവും') },
      { l: '📱 ' + t('This device', 'ഈ ഉപകരണം'), w: t('Away from the centre, no signal', 'സിഗ്നൽ ഇല്ലാത്തപ്പോൾ'), d: t('Opened lessons and pages; saves queued until back in range', 'മുമ്പ് തുറന്ന പാഠങ്ങൾ') },
      { l: '📞 SMS / IVR', w: t('No smartphone at all', 'സ്മാർട്ട്ഫോൺ ഇല്ലാത്തപ്പോൾ'), d: t('Guardian updates, daily quiz, scheme info, call the facilitator', 'SMS, ഫോൺ കോൾ') },
      { l: '📝 ' + t('Paper', 'പേപ്പർ'), w: t('Power failure', 'വൈദ്യുതി ഇല്ലാത്തപ്പോൾ'), d: t('Printed attendance sheets and passports, entered later', 'അച്ചടിച്ച ഷീറ്റുകൾ') },
    ])));
  },

  // ---------------------------------------------------------------- audit
  async audit(el, k) {
    const rows = await k.core.get('/audit?limit=300');
    el.append(h('h1', null, t('Audit trail', 'ഓഡിറ്റ്')), h('p', { class: 'muted' }, t('Sensitive actions — sign-ins, consent changes, steward access to records, service switches — are recorded in the tamper-evident event log.', 'പ്രധാന പ്രവൃത്തികൾ രേഖപ്പെടുത്തുന്നു.')));
    el.append(ui.table([
      { key: 'ts', label: t('When', 'എപ്പോൾ'), render: (r) => h('span', { class: 'mono small' }, r.ts.replace('T', ' ').slice(0, 19)) },
      { key: 'type', label: t('Action', 'പ്രവൃത്തി'), render: (r) => r.type.replace(/^audit\./, '') },
      { key: 'actor_name', label: t('By', 'ആര്'), render: (r) => r.actor_name ? `${r.actor_name}` : h('span', { class: 'muted' }, 'system') },
      { key: 'payload', label: t('Detail', 'വിശദാംശം'), render: (r) => h('span', { class: 'small mono' }, JSON.stringify(typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload).slice(0, 110)) },
      { key: 'node', label: t('Node', 'നോഡ്'), render: (r) => h('span', { class: 'mono small' }, r.node) },
    ], rows));
  },

  // ---------------------------------------------------------------- architecture (for funders & partners)
  async architecture(el, k) {
    const mods = k.modules;
    el.append(h('h1', null, t('How the platform works', 'ഈ വേദി എങ്ങനെ പ്രവർത്തിക്കുന്നു')),
      h('p', { class: 'muted' }, t('One central brain, many services plugged into it, and a working copy in every hamlet.', 'ഒരു കേന്ദ്ര ബ്രെയിൻ, അതിൽ ബന്ധിപ്പിച്ച നിരവധി സേവനങ്ങൾ, ഓരോ ഊരിലും പ്രവർത്തിക്കുന്ന പകർപ്പ്.')));
    el.append(diagram(mods));
    el.append(ui.section(t('What the brain guarantees', 'ബ്രെയിൻ ഉറപ്പാക്കുന്നത്'), ui.grid([
      ui.card({ title: '🔐 ' + t('The family owns the record', 'രേഖ കുടുംബത്തിന്റേത്'), body: t('Agencies see a learner only when the learner is enrolled with them and the learner (or guardian, for a child) has consented. Consent can be withdrawn any time — access stops immediately.', 'സമ്മതമുള്ളപ്പോൾ മാത്രം ഏജൻസികൾക്ക് കാണാം. എപ്പോൾ വേണമെങ്കിലും പിൻവലിക്കാം.') }),
      ui.card({ title: '🏡 ' + t('Many agencies, one hamlet', 'പല ഏജൻസികൾ, ഒരു ഊര്'), body: t('Hamlets are shared ground. The service map shows every agency\'s programmes, gaps and clashes, so efforts add up instead of duplicating.', 'സേവന ഭൂപടം എല്ലാ ഏജൻസികളുടെയും പരിപാടികൾ കാണിക്കുന്നു.') }),
      ui.card({ title: '🎓 ' + t('One passport for life', 'ജീവിതകാലം ഒരു പാസ്‌പോർട്ട്'), body: t('From the first letter to the first job, skills and certificates from every agency collect in one verifiable Learning Passport that belongs to the learner.', 'എല്ലാ ഏജൻസികളിൽ നിന്നുമുള്ള നേട്ടങ്ങൾ ഒരു പാസ്‌പോർട്ടിൽ.') }),
      ui.card({ title: '🛡️ ' + t('Fail-safe by design', 'സുരക്ഷിത രൂപകൽപ്പന'), body: t('Every action is an append-only, hash-chained event. Services are isolated by circuit breakers. Centres keep working offline and sync later — by internet or by USB courier.', 'ഓരോ പ്രവൃത്തിയും ഹാഷ് ശൃംഖലയിൽ. ഓഫ്‌ലൈനിലും പ്രവർത്തിക്കും.') }),
      ui.card({ title: '🧒 ' + t('Child protection built in', 'കുട്ടികളുടെ സംരക്ഷണം'), body: t('Guardian consent for minors (DPDP Act 2023), safeguarding training before staff go live, moderated and logged messaging, and a confidential help button that goes straight to the Child Protection Officer.', 'രക്ഷിതാവിന്റെ സമ്മതം, സുരക്ഷാ പരിശീലനം, രഹസ്യ സഹായ ബട്ടൺ.') }),
      ui.card({ title: '🌍 ' + t('Built to scale', 'വളരാൻ നിർമ്മിച്ചത്'), body: t('A new hamlet centre is a configuration, not a project: flash the hub, register it, assign a facilitator. Other NGOs and governments can run centres on the same platform under shared rules.', 'പുതിയ കേന്ദ്രം ഒരു ക്രമീകരണം മാത്രം.') }),
    ], 300)));
  },

  // ---------------------------------------------------------------- settings
  async settings(el, k) {
    el.append(h('h1', null, t('Settings', 'ക്രമീകരണം')));
    const big = document.documentElement.classList.contains('big-text');
    el.append(ui.card({ title: t('Reading comfort', 'വായനാ സൗകര്യം'), body: h('div', { class: 'stack' },
      h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: big, onchange: (e) => { document.documentElement.classList.toggle('big-text', e.target.checked); localStorage.setItem('aadi.bigtext', e.target.checked ? '1' : '0'); } }), t('Larger text', 'വലിയ അക്ഷരങ്ങൾ')),
      h('div', { class: 'row' }, ui.button('🔊 ' + t('Test read-aloud', 'വായിച്ചുകേൾക്കൽ പരീക്ഷിക്കുക'), () => speak(t('Welcome', 'സ്വാഗതം'))))) }));
    el.append(ui.card({ title: t('This device', 'ഈ ഉപകരണം'), body: h('div', { class: 'stack' }, h('p', { class: 'small' }, t('Pages you open are kept on this device so they work offline. On a shared phone, sign out after use.', 'തുറന്ന പേജുകൾ ഓഫ്‌ലൈനിനായി സൂക്ഷിക്കുന്നു. പങ്കിട്ട ഫോണിൽ ഉപയോഗശേഷം പുറത്തിറങ്ങുക.')),
      ui.button(t('Clear saved pages on this device', 'സൂക്ഷിച്ച പേജുകൾ മായ്ക്കുക'), async () => { Object.keys(localStorage).filter((x) => x.startsWith('aadi.c:')).forEach((x) => localStorage.removeItem(x)); toast(t('Cleared.', 'മായ്ച്ചു.'), 'good'); })) }));
  },

  async notfound(el) { el.append(ui.empty(t('Page not found.', 'പേജ് കണ്ടെത്തിയില്ല.'))); },
};

// ---------- helpers ----------
function hamletCards(hs) {
  return ui.grid(hs.map((x) => h('a', { class: 'card', href: '#/hamlet/' + x.id, style: { textDecoration: 'none', color: 'inherit' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { style: { margin: 0 } }, t(x.name, x.name_ml)), ui.badge({ none: t('No signal', 'സിഗ്നൽ ഇല്ല'), '2g': '2G', '4g': '4G' }[x.connectivity] || x.connectivity, x.connectivity === 'none' ? 'warn' : x.connectivity === '2g' ? 'info' : 'good')),
    h('div', { class: 'sub' }, `${x.district} · ${x.community}`),
    h('div', { class: 'row', style: { gap: '6px' } }, x.agencies.map((a) => h('span', { class: 'badge', style: { borderColor: a.colour, color: a.colour } }, a.name.replace(' (demo)', '').replace('Community Innovations Foundation', 'CIF')))),
    h('div', { class: 'small muted', style: { marginTop: '8px' } }, `${x.people} ${t('people registered', 'പേർ')} · ${x.agencies.length} ${t('agencies', 'ഏജൻസികൾ')}`))), 260);
}

async function consentPanel(k, p, isOwner) {
  const [ags, scopes] = await Promise.all([k.core.get('/agencies'), k.core.get('/consent/scopes')]);
  const box = h('div', { class: 'stack' });
  const active = (p.consents || []).filter((c) => c.status === 'active');
  if (!active.length) box.append(ui.empty(t('No active consents.', 'സജീവ സമ്മതങ്ങളില്ല.')));
  for (const c of active) {
    box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { style: { margin: 0, flex: 1 } }, c.agency_name),
      isOwner || state.user.role === 'platform_admin' ? ui.button(t('Withdraw consent', 'സമ്മതം പിൻവലിക്കുക'), async () => {
        if (!(await ui.confirm(t(`${c.agency_name} will immediately stop seeing ${p.name}'s information. Continue?`, `${c.agency_name}ന് ഉടൻ വിവരങ്ങൾ കാണാനാകില്ല. തുടരണോ?`)))) return;
        await k.core.post(`/consents/${c.id}/revoke`); toast(t('Consent withdrawn.', 'സമ്മതം പിൻവലിച്ചു.'), 'good'); k.refresh();
      }, { tone: 'danger', small: true }) : null),
    h('div', { class: 'row', style: { gap: '6px', margin: '8px 0' } }, (c.scopes || []).map((s) => ui.pill(t(s, SCOPE_ML[s])))),
    h('div', { class: 'small muted' }, `${t('Given', 'നൽകിയത്')} ${(c.granted_at || '').slice(0, 10)} · ${t('by', 'വഴി')} ${c.relation} · ${c.method}`)));
  }
  if (isOwner) {
    box.append(ui.card({ title: t('Give consent to an agency', 'ഒരു ഏജൻസിക്ക് സമ്മതം നൽകുക'), body: ui.form([
      { name: 'agency_id', label: t('Agency', 'ഏജൻസി'), type: 'select', required: true, options: ags.map((a) => ({ value: a.id, label: a.name })) },
      { name: 'scopes', label: t('What they may see', 'കാണാവുന്നത്'), type: 'multiselect', value: ['profile', 'progress'], options: Object.entries(scopes).map(([kk, v]) => ({ value: kk, label: `${t(kk, SCOPE_ML[kk])} — ${v}` })) },
    ], async (v) => { await k.core.post('/consents', { person_id: p.id, agency_id: v.agency_id, scopes: v.scopes }); toast(t('Consent recorded.', 'സമ്മതം രേഖപ്പെടുത്തി.'), 'good'); k.refresh(); }, { submitLabel: t('Give consent', 'സമ്മതം നൽകുക') }) }));
  }
  return box;
}

// Deterministic visual code for the verify code (not a real QR; the printed URL is the verifier).
function pseudoQr(code) {
  let s = 0; for (const c of code) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const g = h('div', { class: 'qr', 'aria-hidden': 'true' });
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    let on;
    if (finder) { const fx = x > 13 ? x - 14 : x, fy = y > 13 ? y - 14 : y; on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); } else { s = (s * 1103515245 + 12345) >>> 0; on = (s >>> 16) & 1; }
    g.append(h('i', { class: on ? 'k' : '' }));
  }
  return g;
}

function diagram(mods) {
  const W = 980, H = 470;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Platform architecture: brain, modules, hubs, channels');
  svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.background = '#fff'; svg.style.border = '1px solid var(--line)'; svg.style.borderRadius = '10px';
  const el = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v); if (text) e.textContent = text; svg.append(e); return e; };
  const cx = W / 2, cy = 215;
  const list = mods.length ? mods : [];
  const R = 200;
  list.forEach((m, i) => {
    const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R * 1.55, y = cy + Math.sin(a) * R * 0.92;
    el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: m.state === 'up' ? '#9fc2b8' : '#e2b4b0', 'stroke-width': 2, 'stroke-dasharray': m.state === 'up' ? '' : '5 4' });
    el('rect', { x: x - 72, y: y - 20, width: 144, height: 40, rx: 8, fill: m.state === 'up' ? '#e3eedb' : '#fbe3e1', stroke: m.state === 'up' ? '#5e8c3a' : '#b3261e' });
    el('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 14, fill: '#1c2a27', 'font-family': 'inherit' }, `${m.icon || ''} ${t(m.name || m.id, m.name_ml)}`.slice(0, 22));
  });
  el('circle', { cx, cy, r: 96, fill: '#0b4f45' });
  el('circle', { cx, cy, r: 102, fill: 'none', stroke: '#c9a227', 'stroke-width': 3 });
  el('text', { x: cx, y: cy - 8, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: '#fff' }, t('The Brain', 'ബ്രെയിൻ'));
  el('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', 'font-size': 11.5, fill: '#cfe2dc' }, t('identity · consent · policy', 'ഐഡന്റിറ്റി · സമ്മതം · നയം'));
  el('text', { x: cx, y: cy + 30, 'text-anchor': 'middle', 'font-size': 11.5, fill: '#cfe2dc' }, t('passport · event log · sync', 'പാസ്‌പോർട്ട് · ലോഗ് · സിങ്ക്'));
  el('text', { x: 20, y: H - 18, 'font-size': 13, fill: '#4b5e59' }, t('Solid line: service running. Dashed: resting or switched off — the rest of the platform is unaffected.', 'തുടർച്ചയായ വര: പ്രവർത്തിക്കുന്നു. ഇടവിട്ട വര: വിശ്രമത്തിൽ.'));
  return h('div', null, svg);
}
