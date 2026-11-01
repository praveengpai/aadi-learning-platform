// AADI shell kit — the UI + data toolkit every module receives as `k`.
// Offline-first: GETs are cached; writes made while offline are queued and replayed.

const CACHE_PREFIX = 'aadi.c:';
const OUTBOX_KEY = 'aadi.outbox';
const MAX_CACHE_ENTRIES = 400;

export const state = { brand: { name: 'CIF Learning Platform', name_ml: 'സി.ഐ.എഫ് പഠന വേദി', short: 'CIF Learning', owner: 'Community Innovations Foundation' }, user: null, node: null, lang: localStorage.getItem('aadi.lang') || 'en', online: navigator.onLine, lastServerOk: null, simple: localStorage.getItem('aadi.simple') === '1' };

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {
    // storage full: evict oldest cache entries and retry once
    const keys = Object.keys(localStorage).filter((x) => x.startsWith(CACHE_PREFIX));
    keys.slice(0, Math.ceil(keys.length / 3)).forEach((x) => localStorage.removeItem(x));
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* give up quietly */ }
  }
}
function cacheKey(url) { return CACHE_PREFIX + (state.user ? state.user.id : 'anon') + ':' + url; }
function trimCache() {
  const keys = Object.keys(localStorage).filter((x) => x.startsWith(CACHE_PREFIX));
  if (keys.length > MAX_CACHE_ENTRIES) keys.slice(0, keys.length - MAX_CACHE_ENTRIES).forEach((x) => localStorage.removeItem(x));
}

const listeners = new Set();
export function onNetChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setOnline(v) { if (state.online !== v) { state.online = v; listeners.forEach((f) => f(v)); if (v) replayOutbox(); } }
window.addEventListener('online', () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));

export async function http(method, url, body) {
  const opts = { method, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(url, opts);
  } catch (netErr) {
    setOnline(false);
    if (method === 'GET') {
      const c = lsGet(cacheKey(url));
      if (c) return Object.assign(Array.isArray(c.v) ? [...c.v] : { ...c.v }, { _offline: true, _cachedAt: c.t });
      throw new Error('You are offline and this page has not been opened before on this device.');
    }
    queue(method, url, body);
    return { queued: true };
  }
  setOnline(true);
  state.lastServerOk = Date.now();
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (res.status === 401 && !url.includes('/auth/')) { window.dispatchEvent(new CustomEvent('aadi:unauth')); }
  if (!res.ok) {
    const err = new Error((data && data.message) || `Request failed (${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  if (method === 'GET' && cacheable(url)) { lsSet(cacheKey(url), { t: Date.now(), v: data }); trimCache(); }
  return data;
}

// Records that must never sit in plain device storage (health, form answers, case queues).
const NO_CACHE = [/\/api\/core\/forms\/(submissions|queue)/, /\/api\/m\/health\/(?!meta)/, /\/api\/m\/govtservices\/(documents|applications|person|my|family)/, /\/api\/m\/disaster\/(help|plans|households|incidents)/, /\/api\/m\/livelihoods\/(groups|requests|my|members|txns)/, /\/api\/m\/wildlife\/(incidents|claims|my|family)/, /\/api\/m\/voice\/clips\/[^/]+\/audio/];
const cacheable = (url) => !NO_CACHE.some((r) => r.test(url));
const idemKey = () => (state.user ? state.user.id : 'x') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

function queue(method, url, body) {
  const q = lsGet(OUTBOX_KEY) || [];
  q.push({ method, url, body, at: Date.now(), user: state.user && state.user.id, key: idemKey() });
  lsSet(OUTBOX_KEY, q);
  toast(t('Saved on this device. It will be sent when the connection returns.', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു. കണക്ഷൻ വരുമ്പോൾ അയയ്ക്കും.'), 'warn');
}
export function outboxCount() { return (lsGet(OUTBOX_KEY) || []).length; }
export function outboxFailed() { return lsGet(OUTBOX_KEY + '.failed') || []; }
let replaying = false;
export async function replayOutbox() {
  if (replaying) return; replaying = true;
  try {
    let q = lsGet(OUTBOX_KEY) || [];
    const keep = [];
    let sent = 0;
    for (const item of q) {
      if (state.user && item.user && item.user !== state.user.id) { keep.push(item); continue; }
      try {
        const r = await fetch(item.url, { method: item.method, headers: { 'content-type': 'application/json', 'x-idempotency-key': item.key || '' }, credentials: 'same-origin', body: JSON.stringify(item.body) });
        // Keep it when the server is down, the session expired, or we were asked to slow down.
        if (r.status >= 500 || [401, 408, 429].includes(r.status)) { keep.push(item); if (r.status === 401) break; continue; }
        if (r.status >= 400) {
          // Refused for a real reason (consent withdrawn, switched off …): keep a visible record, never drop silently.
          let msg = ''; try { msg = (await r.json()).message || ''; } catch (_) { /* ignore */ }
          const failed = lsGet(OUTBOX_KEY + '.failed') || [];
          failed.push({ ...item, status: r.status, message: msg, failed_at: Date.now() });
          lsSet(OUTBOX_KEY + '.failed', failed.slice(-50));
          toast(t('A saved change could not be sent: ', 'സൂക്ഷിച്ച ഒരു മാറ്റം അയയ്ക്കാനായില്ല: ') + (msg || r.status), 'bad');
          continue;
        }
        sent++;
      } catch (_) { keep.push(item); break; }
    }
    q = keep.concat((lsGet(OUTBOX_KEY) || []).slice(q.length));
    lsSet(OUTBOX_KEY, q);
    if (sent) toast(t(`${sent} saved change(s) sent.`, `${sent} മാറ്റങ്ങൾ അയച്ചു.`), 'good');
    listeners.forEach((f) => f(state.online));
  } finally { replaying = false; }
}
setInterval(() => { if (outboxCount()) replayOutbox(); }, 30000);

export function t(en, ml) { return state.lang === 'ml' && ml ? ml : en; }

// ---------- DOM helpers ----------
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class' || k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const node = (x) => (x instanceof Node ? x : Array.isArray(x) ? h('div', null, x) : document.createTextNode(String(x ?? '')));

export function toast(msg, tone = 'info') {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const el = h('div', { class: 'toast ' + tone }, msg);
  box.append(el);
  setTimeout(() => el.remove(), 4200);
}

export function speak(text, lang) {
  try {
    if (!('speechSynthesis' in window)) return toast(t('Read-aloud is not available on this device.', 'ഈ ഉപകരണത്തിൽ വായിച്ചുകേൾപ്പിക്കൽ ലഭ്യമല്ല.'), 'warn');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    const isMl = lang ? lang.startsWith('ml') : /[ഀ-ൿ]/.test(text);
    u.lang = isMl ? 'ml-IN' : 'en-IN';
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    u.rate = 0.92;
    speechSynthesis.speak(u);
  } catch (_) { /* never break UI */ }
}

const injected = new Set();
export function style(css, key) { const id = key || css.slice(0, 80); if (injected.has(id)) return; injected.add(id); document.head.append(h('style', null, css)); }

// ---------- components ----------
export const ui = {
  card({ title, subtitle, body, actions, tone, className } = {}) {
    return h('div', { class: ['card', tone ? 'tone-' + tone : '', tone === 'feature' ? 'feature' : '', className || ''].join(' ') },
      title ? h('h3', null, title) : null, subtitle ? h('div', { class: 'sub' }, subtitle) : null,
      body !== undefined && body !== null ? node(body) : null,
      actions ? h('div', { class: 'actions' }, actions) : null);
  },
  stat(label, value, hint) { return h('div', { class: 'stat' }, h('div', { class: 'v' }, value ?? '—'), h('div', { class: 'l' }, label), hint ? h('div', { class: 'hint' }, hint) : null); },
  grid(children, min = 220) { return h('div', { class: 'grid', style: { '--min': min + 'px' } }, children); },
  section(title, children) { return h('section', { class: 'section' }, title ? h('h2', null, title) : null, children); },
  badge(text, tone) { return h('span', { class: 'badge ' + (tone || '') }, text); },
  pill(text) { return h('span', { class: 'pill' }, text); },
  icon(emoji, label) { return h('span', { role: 'img', 'aria-label': label || '' }, emoji); },
  button(label, onClick, { tone, small, type, disabled, title } = {}) {
    const b = h('button', { class: ['btn', tone || '', small ? 'small' : ''].join(' '), type: type || 'button', disabled, title }, label);
    if (onClick) b.addEventListener('click', async (e) => {
      if (b.dataset.busy) return; b.dataset.busy = '1'; b.disabled = true;
      try { await onClick(e); } catch (err) { toast(err.message || String(err), 'bad'); } finally { delete b.dataset.busy; b.disabled = !!disabled; }
    });
    return b;
  },
  table(cols, rows, { empty, onRow } = {}) {
    if (!rows || !rows.length) return ui.empty(empty || t('Nothing here yet.', 'ഇവിടെ ഒന്നുമില്ല.'));
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, cols.map((c) => h('th', null, c.label)))),
      h('tbody', null, rows.map((r) => h('tr', { class: onRow ? 'click' : '', onclick: onRow ? () => onRow(r) : null },
        cols.map((c) => h('td', null, c.render ? node(c.render(r)) : (r[c.key] ?? '—'))))))));
  },
  kv(pairs) { return h('dl', { class: 'kv' }, pairs.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v instanceof Node ? v : (v ?? '—'))])); },
  empty(text) { return h('div', { class: 'empty' }, text); },
  loading() { return h('div', { class: 'loading' }, t('Loading', 'ലോഡ് ചെയ്യുന്നു')); },
  error(err) { return h('div', { class: 'err', role: 'alert' }, err && err.message ? err.message : String(err)); },
  progress(v, label) {
    const pct = Math.max(0, Math.min(1, Number(v) || 0));
    return h('div', null, label ? h('div', { class: 'row small muted', style: { justifyContent: 'space-between' } }, h('span', null, label), h('span', null, Math.round(pct * 100) + '%')) : null,
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(pct * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { style: { width: pct * 100 + '%' } })));
  },
  bars(data, { max, unit = '' } = {}) {
    const m = max || Math.max(1, ...data.map((d) => Number(d.value) || 0));
    return h('div', { class: 'bars' }, data.map((d) => h('div', { class: 'b' }, h('span', null, d.label),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: Math.max(0, (Number(d.value) || 0) / m * 100) + '%', background: d.colour || null } })),
      h('b', null, (typeof d.value === 'number' ? (Number.isInteger(d.value) ? d.value : d.value.toFixed(1)) : d.value) + unit))));
  },
  spark(nums, { w = 120, hgt = 30 } = {}) {
    const ns = (nums || []).map(Number).filter((n) => !Number.isNaN(n));
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', w); s.setAttribute('height', hgt); s.setAttribute('class', 'spark'); s.setAttribute('aria-hidden', 'true');
    if (ns.length < 2) return s;
    const mn = Math.min(...ns), mx = Math.max(...ns), rg = mx - mn || 1;
    const pts = ns.map((n, i) => `${(i / (ns.length - 1)) * (w - 4) + 2},${hgt - 3 - ((n - mn) / rg) * (hgt - 6)}`).join(' ');
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#0e6455'); pl.setAttribute('stroke-width', '2');
    s.append(pl); return s;
  },
  tabs(tabs, active) {
    const wrap = h('div');
    const bar = h('div', { class: 'tabs', role: 'tablist' });
    const body = h('div');
    let cur = active || tabs[0]?.id;
    const show = async (id) => {
      cur = id;
      [...bar.children].forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      body.replaceChildren(ui.loading());
      const tab = tabs.find((x) => x.id === id);
      const el = h('div');
      try { await tab.render(el); body.replaceChildren(el); } catch (e) { body.replaceChildren(ui.error(e)); }
    };
    for (const tb of tabs) bar.append(h('button', { role: 'tab', 'data-id': tb.id, onclick: () => show(tb.id) }, tb.label));
    wrap.append(bar, body);
    queueMicrotask(() => show(cur));
    return wrap;
  },
  form(fields, onSubmit, { submitLabel, cancel } = {}) {
    const f = h('form', { class: 'f', novalidate: false });
    for (const fd of fields) {
      if (fd.type === 'hidden') { f.append(h('input', { type: 'hidden', name: fd.name, value: fd.value ?? '' })); continue; }
      const opts = (fd.options || []).map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
      let input;
      if (fd.type === 'select') input = h('select', { name: fd.name, required: fd.required }, fd.required ? null : h('option', { value: '' }, '—'), opts.map((o) => h('option', { value: o.value, selected: String(fd.value ?? '') === String(o.value) }, o.label)));
      else if (fd.type === 'textarea') input = h('textarea', { name: fd.name, required: fd.required, placeholder: fd.placeholder || '' }, fd.value ?? '');
      else if (fd.type === 'checkbox') { f.append(h('label', { class: 'cb' }, h('input', { type: 'checkbox', name: fd.name, checked: !!fd.value }), fd.label)); continue; }
      else if (fd.type === 'multiselect') {
        const vals = new Set(fd.value || []);
        input = h('div', { class: 'multi', 'data-multi': fd.name }, opts.map((o) => h('label', null, h('input', { type: 'checkbox', value: o.value, checked: vals.has(o.value) }), o.label)));
      } else input = h('input', { type: fd.type || 'text', name: fd.name, required: fd.required, value: fd.value ?? '', placeholder: fd.placeholder || '', min: fd.min, max: fd.max, step: fd.step });
      f.append(h('label', null, fd.label, input, fd.help ? h('span', { class: 'small muted', style: { fontWeight: 400 } }, fd.help) : null));
    }
    const submit = h('button', { class: 'btn primary', type: 'submit' }, submitLabel || t('Save', 'സേവ് ചെയ്യുക'));
    f.append(h('div', { class: 'row' }, submit, cancel ? ui.button(t('Cancel', 'റദ്ദാക്കുക'), cancel, { tone: 'ghost' }) : null));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = {};
      for (const fd of fields) {
        if (fd.type === 'multiselect') v[fd.name] = [...f.querySelectorAll(`[data-multi="${fd.name}"] input:checked`)].map((x) => x.value);
        else if (fd.type === 'checkbox') v[fd.name] = f.elements[fd.name].checked;
        else if (fd.type === 'number') v[fd.name] = f.elements[fd.name].value === '' ? null : Number(f.elements[fd.name].value);
        else v[fd.name] = f.elements[fd.name] ? f.elements[fd.name].value : undefined;
      }
      submit.disabled = true;
      try { await onSubmit(v); } catch (err) { toast(err.message, 'bad'); } finally { submit.disabled = false; }
    });
    return f;
  },
  modal(title, content) {
    const bg = h('div', { class: 'modal-bg', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const m = h('div', { class: 'modal' }, h('header', null, h('h3', null, title), h('button', { class: 'btn ghost small', onclick: close, 'aria-label': 'Close' }, '✕')), node(content));
    bg.append(m);
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(bg);
    setTimeout(() => (m.querySelector('input,select,textarea,button:not(.ghost)') || m).focus?.(), 30);
    return { close, el: m };
  },
  confirm(message) {
    return new Promise((res) => {
      let done = false;
      const body = h('div', null, h('p', null, message), h('div', { class: 'row' },
        ui.button(t('Yes, continue', 'അതെ, തുടരുക'), () => { done = true; m.close(); res(true); }, { tone: 'primary' }),
        ui.button(t('Cancel', 'റദ്ദാക്കുക'), () => { done = true; m.close(); res(false); }, { tone: 'ghost' })));
      const m = ui.modal(t('Please confirm', 'സ്ഥിരീകരിക്കുക'), body);
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el) && !done) { obs.disconnect(); res(false); } });
      obs.observe(document.body, { childList: true });
    });
  },
  personPicker({ onPick, kind, hamlet_id, placeholder } = {}) {
    const wrap = h('div', { class: 'stack' });
    const input = h('input', { class: 'input', placeholder: placeholder || t('Search learner by name', 'പേര് തിരയുക') });
    const list = h('div');
    let timer;
    const run = async () => {
      const qs = new URLSearchParams({ q: input.value, limit: 20 });
      if (kind) qs.set('kind', kind); if (hamlet_id) qs.set('hamlet_id', hamlet_id);
      try {
        const rows = await http('GET', '/api/core/persons?' + qs);
        list.replaceChildren(ui.table([{ key: 'name', label: t('Name', 'പേര്') }, { key: 'kind', label: t('Type', 'തരം') }, { key: 'age', label: t('Age', 'വയസ്സ്') }], rows, { onRow: (r) => onPick && onPick(r), empty: t('No learners you can see match this.', 'പൊരുത്തമില്ല.') }));
      } catch (e) { list.replaceChildren(ui.error(e)); }
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
    wrap.append(input, list); run();
    return wrap;
  },
  hamletSelect(onChange, { all = true, value = '' } = {}) {
    const sel = h('select', { class: 'input', style: { maxWidth: '320px' }, onchange: () => onChange(sel.value || null) }, all ? h('option', { value: '' }, t('All hamlets', 'എല്ലാ ഊരുകളും')) : null);
    http('GET', '/api/core/hamlets').then((hs) => { for (const x of hs) sel.append(h('option', { value: x.id, selected: x.id === value }, t(x.name, x.name_ml) + ' · ' + x.district)); if (!all && !value && hs[0]) { sel.value = hs[0].id; onChange(hs[0].id); } }).catch(() => {});
    return sel;
  },
  speakBtn(text, lang) { return h('button', { class: 'speak', type: 'button', title: t('Read aloud', 'വായിച്ചുകേൾക്കുക'), 'aria-label': t('Read aloud', 'വായിച്ചുകേൾക്കുക'), onclick: () => speak(text, lang) }, '🔊'); },

  // v2 — render a round-trip form definition (from /api/core/forms/defs/:key).
  // Works offline: if the server cannot be reached, the submission waits in the device outbox
  // with a client_ref, so replaying it never creates a duplicate.
  // opts: { person_id, household_id, hamlet_id, answers (prefill), onDone(result), submitLabel }
  formFill(def, opts = {}) {
    const L = (o, k = 'label') => t(o[k], o[k + '_ml']);
    const wrap = h('form', { class: 'f formfill', novalidate: true });
    const rows = new Map();
    const read = () => {
      const v = {};
      for (const f of def.fields) {
        const r = rows.get(f.name);
        if (!r || f.type === 'note') continue;
        if (f.type === 'select_multiple') v[f.name] = [...r.querySelectorAll('input:checked')].map((x) => x.value);
        else if (f.type === 'select_one' || f.type === 'yes_no') { const c = r.querySelector('input:checked'); v[f.name] = c ? c.value : ''; }
        else if (f.type === 'photo') v[f.name] = r.dataset.photo || '';
        else if (f.type === 'geopoint') v[f.name] = r.dataset.geo || '';
        else { const i = r.querySelector('input,textarea'); v[f.name] = i ? i.value : ''; }
      }
      return v;
    };
    const relevant = (f, v) => {
      if (!f.relevant) return true;
      const x = v[f.relevant.field];
      if ('equals' in f.relevant) return Array.isArray(x) ? x.includes(f.relevant.equals) : x === f.relevant.equals;
      if (Array.isArray(f.relevant.in)) return Array.isArray(x) ? x.some((y) => f.relevant.in.includes(y)) : f.relevant.in.includes(x);
      if (f.relevant.present) return x !== undefined && x !== '' && !(Array.isArray(x) && !x.length);
      return true;
    };
    const sync = () => { const v = read(); for (const f of def.fields) { const r = rows.get(f.name); if (r) r.style.display = relevant(f, v) ? '' : 'none'; } };
    const pre = opts.answers || {};
    for (const f of def.fields) {
      const lab = L(f);
      const head = h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } }, h('b', null, lab, f.required ? ' *' : '', f.unit ? h('span', { class: 'muted small' }, ' (' + f.unit + ')') : null), ui.speakBtn(lab));
      const hint = f.hint ? h('div', { class: 'small muted' }, t(f.hint, f.hint_ml)) : null;
      let input;
      const nm = 'ff_' + f.name;
      switch (f.type) {
        case 'note': input = h('div', { class: 'card', style: { padding: '8px 10px' } }, lab); break;
        case 'textarea': input = h('textarea', { name: nm, rows: 3 }, pre[f.name] ?? ''); break;
        case 'integer': case 'decimal': input = h('input', { type: 'number', name: nm, inputmode: f.type === 'integer' ? 'numeric' : 'decimal', step: f.type === 'integer' ? '1' : 'any', min: f.min, max: f.max, value: pre[f.name] ?? '' }); break;
        case 'date': input = h('input', { type: 'date', name: nm, value: pre[f.name] ?? '' }); break;
        case 'select_one': case 'yes_no': {
          const ch = f.type === 'yes_no' ? [{ value: 'yes', label: 'Yes', label_ml: 'അതെ' }, { value: 'no', label: 'No', label_ml: 'ഇല്ല' }] : f.choices;
          input = h('div', { class: 'multi', role: 'radiogroup' }, ch.map((c) => h('label', null, h('input', { type: 'radio', name: nm, value: c.value, checked: pre[f.name] === c.value, onchange: sync }), L(c))));
          break;
        }
        case 'select_multiple': {
          const have = new Set(pre[f.name] || []);
          input = h('div', { class: 'multi' }, f.choices.map((c) => h('label', null, h('input', { type: 'checkbox', value: c.value, checked: have.has(c.value), onchange: sync }), L(c))));
          break;
        }
        case 'photo': {
          const prev = h('img', { alt: '', style: { maxWidth: '160px', display: 'none', borderRadius: '8px' } });
          input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', onchange: async (e) => {
            const file = e.target.files[0]; if (!file) return;
            const url = await shrinkImage(file, 960, 0.6);
            row.dataset.photo = url; prev.src = url; prev.style.display = '';
          } });
          input = h('div', null, input, prev);
          break;
        }
        case 'geopoint': {
          const out = h('span', { class: 'small muted' }, '');
          input = h('div', { class: 'row' }, ui.button(t('Record location', 'സ്ഥലം രേഖപ്പെടുത്തുക'), () => {
            if (!navigator.geolocation) return toast(t('Location not available on this device.', 'ഈ ഉപകരണത്തിൽ ലൊക്കേഷൻ ലഭ്യമല്ല.'), 'warn');
            navigator.geolocation.getCurrentPosition((p) => { row.dataset.geo = p.coords.latitude.toFixed(5) + ' ' + p.coords.longitude.toFixed(5); out.textContent = row.dataset.geo; }, () => toast(t('Could not get location.', 'ലൊക്കേഷൻ കിട്ടിയില്ല.'), 'warn'), { timeout: 15000 });
          }, { small: true, tone: 'ghost' }), out);
          break;
        }
        default: input = h('input', { type: 'text', name: nm, value: pre[f.name] ?? '', oninput: sync });
      }
      const row = h('div', { class: 'stack ff-row', style: { gap: '4px', marginBottom: '12px' } }, f.type === 'note' ? null : head, hint, input);
      rows.set(f.name, row);
      wrap.append(row);
    }
    wrap.addEventListener('input', sync);
    const btn = h('button', { class: 'btn primary', type: 'submit' }, opts.submitLabel || t('Save and send', 'സേവ് ചെയ്ത് അയയ്ക്കുക'));
    const errs = h('div', { class: 'small', style: { color: 'var(--bad, #b00020)' } });
    wrap.append(errs, h('div', { class: 'row' }, btn));
    const client_ref = (state.user ? state.user.id : 'x') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    wrap.addEventListener('submit', async (e) => {
      e.preventDefault();
      const answers = read();
      for (const f of def.fields) if (!relevant(f, answers)) delete answers[f.name];
      const missing = def.fields.filter((f) => f.required && f.type !== 'note' && relevant(f, answers) && (answers[f.name] === '' || answers[f.name] === undefined || (Array.isArray(answers[f.name]) && !answers[f.name].length)));
      if (missing.length) { errs.textContent = t('Please answer: ', 'ദയവായി ഉത്തരം നൽകുക: ') + missing.map((f) => L(f)).join(', '); return; }
      errs.textContent = '';
      btn.disabled = true;
      try {
        const r = await http('POST', '/api/core/forms/submissions', { form_key: def.key, person_id: opts.person_id || null, household_id: opts.household_id || null, hamlet_id: opts.hamlet_id || null, answers, client_ref });
        if (opts.onDone) await opts.onDone(r);
      } catch (err) {
        errs.textContent = err.message;
      } finally { btn.disabled = false; }
    });
    sync();
    return wrap;
  },

  // v2 — show a submission and its reply (or "waiting for reply") in plain words.
  submissionCard(s, { onSeen } = {}) {
    const tone = s.status === 'replied' ? 'good' : s.status === 'closed' ? 'info' : 'warn';
    const statusLabel = { submitted: t('Waiting for reply', 'മറുപടി കാത്തിരിക്കുന്നു'), in_review: t('Being reviewed', 'പരിശോധനയിൽ'), replied: t('Reply ready', 'മറുപടി തയ്യാർ'), closed: t('Closed', 'അവസാനിച്ചു') }[s.status] || s.status;
    const flags = (s.flags || []).map((f) => ui.badge(t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : 'info'));
    const reply = s.reply ? h('div', { class: 'card', style: { background: 'var(--soft, #eef6f2)' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, t('Reply', 'മറുപടി'), s.replied_by_name ? ' · ' + s.replied_by_name : ''), ui.speakBtn(t(s.reply, s.reply_ml || s.reply))), h('p', null, t(s.reply, s.reply_ml || s.reply))) : null;
    return ui.card({
      title: t(s.form_title, s.form_title_ml) + (s.person ? ' — ' + s.person.name : ''),
      subtitle: [String(s.captured_at || '').slice(0, 10), s.hamlet ? t(s.hamlet, s.hamlet_ml) : null].filter(Boolean).join(' · '),
      body: [h('div', { class: 'row' }, ui.badge(statusLabel, tone), flags), reply],
      actions: s.reply && !s.reply_seen_at && onSeen ? [ui.button(t('Mark as told to the family', 'കുടുംബത്തെ അറിയിച്ചു'), onSeen, { small: true })] : null,
    });
  },
};

// Shrink a camera photo to a small JPEG data URL so it can travel offline.
async function shrinkImage(file, maxSide, quality) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let q = quality, out = c.toDataURL('image/jpeg', q);
  while (out.length > 270000 && q > 0.25) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
  return out;
}

// Build the per-module kit
export function makeKit(moduleId, { params = {}, go, refresh } = {}) {
  const base = '/api/m/' + moduleId;
  const mk = (prefix) => ({
    get: (p) => http('GET', prefix + p),
    post: (p, b = {}) => http('POST', prefix + p, b),
    put: (p, b = {}) => http('PUT', prefix + p, b),
    del: (p) => http('DELETE', prefix + p),
  });
  return {
    user: state.user, lang: state.lang, node: state.node, brand: state.brand, moduleId, params, simple: state.simple,
    t, h, esc, toast, speak, style, ui, go, refresh,
    api: mk(base), core: mk('/api/core'),
  };
}
