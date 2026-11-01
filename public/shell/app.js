// Platform shell — router, frame, navigation, module loading with isolation.
import { state, http, t, h, toast, makeKit, ui, onNetChange, outboxCount, replayOutbox } from './kit.js';
import { coreViews, coreNav } from './core-views.js';

const $app = document.getElementById('app');
let modules = [];
let health = null;

// ---------- boot ----------
async function boot() {
  document.documentElement.lang = state.lang;
  if (localStorage.getItem('aadi.bigtext') === '1') document.documentElement.classList.add('big-text');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('aadi:unauth', () => { state.user = null; render(); });
  window.addEventListener('hashchange', render);
  onNetChange(() => paintStatus());
  try { Object.assign(state.brand, await http('GET', '/api/core/brand')); } catch (_) { /* offline: keep cached/default brand */ }
  document.title = `${state.brand.name} · ${state.brand.name_ml}`;
  try {
    const me = await http('GET', '/api/core/me');
    state.user = me.user; state.node = me.node;
  } catch (e) {
    if (e.status !== 401) {
      // offline: try last known identity so cached pages still work
      const cached = JSON.parse(localStorage.getItem('aadi.lastme') || 'null');
      if (cached) { state.user = cached.user; state.node = cached.node; }
    }
  }
  if (state.user) localStorage.setItem('aadi.lastme', JSON.stringify({ user: state.user, node: state.node }));
  await loadModules();
  render();
  setInterval(pollHealth, 20000); pollHealth();
}

async function loadModules() {
  try { modules = await http('GET', '/api/core/modules'); } catch (_) { modules = []; }
}
async function pollHealth() {
  try { health = await http('GET', '/api/core/health'); } catch (_) { health = null; }
  paintStatus();
}

// ---------- navigation model ----------
const SECTIONS = [
  ['home', 'Home', 'ഹോം'], ['learn', 'Learn', 'പഠനം'], ['teach', 'Teach', 'പഠിപ്പിക്കൽ'], ['care', 'Care & safety', 'കരുതൽ, സുരക്ഷ'],
  ['community', 'Community', 'സമൂഹം'], ['ops', 'Operations', 'പ്രവർത്തനം'], ['insight', 'Insight', 'വിശകലനം'], ['admin', 'Platform', 'പ്ലാറ്റ്ഫോം'],
];
// Audience curation: what a child sees is simpler than what a job-seeking youth sees.
const HIDE = {
  learner: ['channels/phone'],
  minor: ['exams/home', 'marketplace/jobs', 'channels/phone'],
};
const PRIORITY = ['learning/home', 'shelf/home', 'learning/homework', 'library/home', 'language/home', 'lifeskills/home', 'exams/home', 'counselling/home', 'counselling/pathways', 'marketplace/jobs', 'safeguarding/help', 'learning/child', 'shelf/family', 'library/child', 'community/family'];
function visibleFor(user, key) {
  if (user.role === 'learner' && HIDE.learner.includes(key)) return false;
  if (user.role === 'learner' && user.minor && HIDE.minor.includes(key)) return false;
  return true;
}
export function rank(key) { const i = PRIORITY.indexOf(key); return i === -1 ? 99 : i; }
function navItems() {
  const role = state.user.role;
  const items = coreNav.filter((n) => !n.roles || n.roles.includes(role)).map((n) => ({ ...n, href: '#/' + n.view, core: true }));
  for (const m of modules) {
    for (const n of m.nav || []) {
      if (n.roles && !n.roles.includes(role)) continue;
      if (!visibleFor(state.user, `${m.id}/${n.view}`)) continue;
      const section = ['learner', 'guardian'].includes(role) && n.section === 'teach' ? 'learn' : n.section;
      items.push({ ...n, section, key: `${m.id}/${n.view}`, href: `#/m/${m.id}/${n.view}`, module: m.id, down: m.state !== 'up' });
    }
  }
  return items.sort((a, b) => rank(a.key) - rank(b.key));
}

// ---------- render ----------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

let frame = null;
async function render() {
  const { parts, params } = parseHash();
  if (parts[0] === 'verify') return renderBare(coreViews.verify, params, parts[1]);
  if (!state.user) return renderLogin();
  if (!frame) frame = buildFrame();
  paintNav();
  const content = frame.querySelector('.content');
  content.replaceChildren(ui.loading());
  frame.classList.remove('open');
  window.scrollTo(0, 0);
  const el = h('div');
  try {
    if (parts[0] === 'm') await renderModule(parts[1], parts[2] || 'home', params, el);
    else {
      const view = coreViews[parts[0]] || coreViews.notfound;
      await view(el, { ...ctxBase(params), id: parts[1] });
    }
    content.replaceChildren(el);
  } catch (e) {
    console.error(e);
    content.replaceChildren(ui.error(e));
  }
}

function ctxBase(params) {
  const k = makeKit('core', { params, go, refresh: render });
  return { ...k, modules, health, navItems, reloadModules: async () => { await loadModules(); paintNav(); } };
}

// Module isolation in the browser: a module that fails to load or throws
// shows a calm notice; the shell and other modules keep working.
async function renderModule(id, view, params, el) {
  const m = modules.find((x) => x.id === id);
  if (!m) { el.append(ui.empty(t('This service is not installed on this node.', 'ഈ സേവനം ഇവിടെ ലഭ്യമല്ല.'))); return; }
  if (m.state !== 'up') {
    el.append(h('div', { class: 'unavailable' }, h('h3', null, (m.icon || '⚙️') + ' ' + t(m.name, m.name_ml)),
      h('p', null, t('This service is resting right now. Everything else keeps working, and nothing you saved is lost.', 'ഈ സേവനം ഇപ്പോൾ വിശ്രമത്തിലാണ്. മറ്റെല്ലാം പ്രവർത്തിക്കുന്നു; സൂക്ഷിച്ചതൊന്നും നഷ്ടപ്പെട്ടിട്ടില്ല.')),
      h('p', { class: 'small' }, t('Status: ', 'സ്ഥിതി: ') + m.state)));
    return;
  }
  let mod;
  try { mod = (await import(`/m/${id}/ui.js?v=${encodeURIComponent(m.version || '1')}`)).default; } catch (e) {
    el.append(h('div', { class: 'unavailable' }, h('h3', null, t('Could not open this service', 'ഈ സേവനം തുറക്കാനായില്ല')), h('p', null, t('If you are offline, open it once while connected so it is saved on this device.', 'ഓഫ്‌ലൈനാണെങ്കിൽ, കണക്ഷനുള്ളപ്പോൾ ഒരിക്കൽ തുറക്കുക.'))));
    return;
  }
  const fn = mod && mod.views && (mod.views[view] || mod.views.home);
  if (!fn) { el.append(ui.empty(t('Page not found.', 'പേജ് കണ്ടെത്തിയില്ല.'))); return; }
  const k = makeKit(id, { params, go, refresh: render });
  try { await fn(el, k); } catch (e) {
    console.error(`[${id}]`, e);
    el.replaceChildren(h('div', { class: 'unavailable' }, h('h3', null, (m.icon || '') + ' ' + t(m.name, m.name_ml)), h('p', null, e.message || String(e)), h('p', { class: 'small' }, t('Other services are unaffected.', 'മറ്റ് സേവനങ്ങളെ ബാധിച്ചിട്ടില്ല.'))));
  }
}

function buildFrame() {
  const f = h('div', { class: 'app' },
    h('aside', { class: 'side', 'aria-label': 'Main navigation' },
      h('a', { class: 'brand', href: '#/home' }, h('img', { src: '/img/cif-mark.png', alt: '' }), h('span', null, h('b', null, state.brand.short), h('small', null, t('Learning for every hamlet', 'ഓരോ ഊരിനും പഠനം')))),
      h('nav', { class: 'nav' })),
    h('div', { class: 'main' },
      h('header', { class: 'top' },
        h('button', { class: 'burger', 'aria-label': 'Menu', onclick: () => f.classList.toggle('open') }, '☰'),
        h('div', { class: 'who' }, h('b', null, state.user.display_name), h('span', null, [state.user.role_label, state.user.agency_name].filter(Boolean).join(' · '))),
        h('div', { class: 'spacer' }),
        h('div', { class: 'ladder', title: t('Which layer is serving you right now', 'ഇപ്പോൾ ഏത് തലത്തിൽ നിന്നാണ് സേവനം') }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Language' },
          h('button', { class: state.lang === 'en' ? 'on' : '', onclick: () => setLang('en') }, 'EN'),
          h('button', { class: state.lang === 'ml' ? 'on' : '', onclick: () => setLang('ml') }, 'മല')),
        h('button', { class: 'btn small ghost', onclick: logout }, t('Sign out', 'പുറത്തിറങ്ങുക'))),
      h('div', { class: 'offline-banner', hidden: true }),
      h('main', { class: 'content', id: 'main' })));
  f.addEventListener('click', (e) => { if (e.target === f && f.classList.contains('open')) f.classList.remove('open'); });
  $app.replaceChildren(f);
  paintStatus();
  return f;
}

function paintNav() {
  if (!frame) return;
  const nav = frame.querySelector('.nav');
  const cur = location.hash || '#/home';
  const items = navItems();
  nav.replaceChildren();
  for (const [sec, en, ml] of SECTIONS) {
    const its = items.filter((i) => (i.section || 'home') === sec);
    if (!its.length) continue;
    if (sec !== 'home') nav.append(h('div', { class: 'nav-group' }, t(en, ml)));
    for (const i of its) nav.append(h('a', { href: i.href, class: (cur.split('?')[0] === i.href ? 'on ' : '') + (i.down ? 'down' : ''), title: i.down ? t('Service resting', 'സേവനം വിശ്രമത്തിൽ') : null }, h('span', { class: 'ic' }, i.icon || '•'), t(i.label, i.label_ml)));
  }
}

// The connectivity ladder: Cloud → Hub → This device → SMS/IVR
function paintStatus() {
  if (!frame) return;
  const lad = frame.querySelector('.ladder');
  const banner = frame.querySelector('.offline-banner');
  const isHub = state.node && state.node.role === 'hub';
  const reachable = state.online && health;
  const tier = !reachable ? 'device' : isHub ? 'hub' : 'cloud';
  const tiers = [['cloud', t('Cloud', 'ക്ലൗഡ്')], ['hub', t('Centre hub', 'കേന്ദ്ര ഹബ്')], ['device', t('This device', 'ഈ ഉപകരണം')], ['sms', 'SMS / IVR']];
  lad.replaceChildren(...tiers.map(([k, l]) => h('span', { class: k === tier ? 'on' + (k !== 'cloud' ? ' degraded' : '') : '' }, l)));
  const pending = outboxCount();
  if (tier === 'device' || pending) {
    banner.hidden = false;
    banner.replaceChildren(h('span', null,
      tier === 'device' ? t('Working offline. You can keep learning; pages you opened before are available. ', 'ഓഫ്‌ലൈനിൽ പ്രവർത്തിക്കുന്നു. പഠനം തുടരാം. ') : '',
      pending ? t(`${pending} change(s) waiting to be sent. `, `${pending} മാറ്റങ്ങൾ അയയ്ക്കാൻ കാത്തിരിക്കുന്നു. `) : ''),
    pending && tier !== 'device' ? h('button', { class: 'btn small', onclick: () => replayOutbox() }, t('Send now', 'ഇപ്പോൾ അയയ്ക്കുക')) : null);
  } else banner.hidden = true;
}

function setLang(l) {
  state.lang = l; localStorage.setItem('aadi.lang', l); document.documentElement.lang = l;
  frame = null; render();
}
async function logout() {
  try { await http('POST', '/api/core/auth/logout'); } catch (_) { /* ignore */ }
  state.user = null; frame = null; localStorage.removeItem('aadi.lastme'); location.hash = '#/home'; render();
}

async function renderBare(view, params, id) {
  const el = h('div', { style: { maxWidth: '640px', margin: '40px auto', padding: '0 16px' } });
  $app.replaceChildren(el);
  frame = null;
  await view(el, { ...makeKit('core', { params, go, refresh: render }), id });
}

// ---------- login ----------
async function renderLogin() {
  frame = null;
  const err = h('div');
  const user = h('input', { class: 'input', name: 'username', autocomplete: 'username', placeholder: t('Username', 'ഉപയോക്തൃനാമം'), required: true });
  const pass = h('input', { class: 'input', name: 'password', type: 'password', autocomplete: 'current-password', placeholder: t('Password', 'പാസ്‌വേഡ്'), required: true });
  const doLogin = async (u, p) => {
    err.replaceChildren();
    try {
      const out = await http('POST', '/api/core/auth/login', { username: u, password: p });
      state.user = out.user;
      const me = await http('GET', '/api/core/me'); state.node = me.node;
      localStorage.setItem('aadi.lastme', JSON.stringify({ user: state.user, node: state.node }));
      await loadModules();
      location.hash = '#/home'; render();
    } catch (e) { err.replaceChildren(ui.error(e)); }
  };
  const form = h('form', { class: 'stack', style: { maxWidth: '380px' }, onsubmit: (e) => { e.preventDefault(); doLogin(user.value, pass.value); } },
    user, pass, h('button', { class: 'btn primary', type: 'submit' }, t('Sign in', 'പ്രവേശിക്കുക')), err);
  const demoBox = h('div');
  const page = h('div', { class: 'login' },
    h('section', { class: 'login-art' },
      h('div', { class: 'row' }, h('img', { class: 'mark', src: '/img/cif-mark.png', alt: 'Community Innovations Foundation' }), h('div', null, h('b', null, 'Community Innovations Foundation'), h('div', { class: 'small', style: { color: '#a9c4bc' } }, 'Section 8 Company · Kerala'))),
      h('div', null,
        h('p', { class: 'word' }, t(state.brand.name, state.brand.name_ml)),
        h('p', { class: 'tag' }, t(state.brand.tagline || '', state.brand.tagline_ml || ''))),
      h('div', { class: 'layers' },
        h('div', null, t('Works without internet at the centre hub, and syncs when it can.', 'ഇന്റർനെറ്റില്ലാതെയും കേന്ദ്രത്തിൽ പ്രവർത്തിക്കും.')),
        h('div', null, t('The family owns the learner\'s record. Agencies see it only with consent.', 'പഠിതാവിന്റെ വിവരങ്ങൾ കുടുംബത്തിന്റേത്. സമ്മതത്തോടെ മാത്രം ഏജൻസികൾക്ക്.')),
        h('div', null, t('Many agencies, one hamlet, no duplication.', 'പല ഏജൻസികൾ, ഒരു ഊര്, ആവർത്തനമില്ല.')))),
    h('section', { class: 'login-form' },
      h('div', { class: 'row' }, h('h1', { style: { margin: 0 } }, t('Sign in', 'പ്രവേശിക്കുക')), h('div', { class: 'spacer' }),
        h('div', { class: 'seg' }, h('button', { class: state.lang === 'en' ? 'on' : '', onclick: () => { state.lang = 'en'; localStorage.setItem('aadi.lang', 'en'); document.documentElement.lang = 'en'; renderLogin(); } }, 'EN'), h('button', { class: state.lang === 'ml' ? 'on' : '', onclick: () => { state.lang = 'ml'; localStorage.setItem('aadi.lang', 'ml'); document.documentElement.lang = 'ml'; renderLogin(); } }, 'മല'))),
      form, demoBox));
  $app.replaceChildren(page);
  try {
    const accts = await http('GET', '/api/core/demo-accounts');
    if (accts.length) {
      demoBox.append(h('h3', { style: { marginTop: '8px' } }, t('Demo: sign in as…', 'ഡെമോ: ഇങ്ങനെ പ്രവേശിക്കുക…')),
        h('p', { class: 'small muted' }, t('This is the demonstration instance: 10 sample hamlets plus the Komalikudi pilot site, all with fictional learners.', '10 മാതൃകാ ഊരുകളും കോമളിക്കുടിയും — സാങ്കൽപ്പിക പഠിതാക്കളുമായി ഡെമോ.')),
        h('div', { class: 'demo-list' }, accts.map((a) => h('button', { type: 'button', onclick: () => doLogin(a.username, 'demo1234') }, h('b', null, a.display_name), h('span', null, a.role_label + (a.agency && !['learner', 'guardian'].includes(a.role) ? ' · ' + a.agency : ''))))));
    }
  } catch (_) { /* offline */ }
}

boot();
