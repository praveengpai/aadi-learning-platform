// Community Voice & Gatherings — screens. Plain ES module; no DOM work at import time.
// Views: home (listener), record (youth reporter / staff), review, playlist (builder), gatherings, impact.
// Offline listening: published clips the listener saves are kept in this device's IndexedDB and are
// dropped automatically when they no longer appear in the listing (withdrawn / unpublished / licence narrowed).

const CSS = `
.voice-hero{background:linear-gradient(135deg,#4a148c 0%,#6a1b9a 60%,#8e24aa 100%);color:#fff;border-radius:var(--r-l,14px);padding:16px 18px;margin-bottom:14px;position:relative}
.voice-hero h2{color:#fff;margin:0 0 4px;padding-right:44px}
.voice-hero p{margin:0;opacity:.95;max-width:62ch}
.voice-hero .speak{position:absolute;top:10px;right:10px}
.voice-demo{display:inline-block;background:#fff3cd;color:#7a4b00;border:1px solid #e0b100;border-radius:6px;padding:2px 7px;font-weight:700;font-size:.75rem}
.voice-langs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}
.voice-langs button{border:2px solid var(--line,#ddd);background:#fff;border-radius:999px;padding:8px 14px;font-weight:700;min-height:44px;cursor:pointer}
.voice-langs button[aria-pressed="true"]{border-color:#6a1b9a;background:#f3e5f5}
.voice-clip{display:flex;gap:12px;align-items:center;border:1px solid var(--line,#ddd);border-radius:14px;background:#fff;padding:10px 12px;margin-bottom:10px}
.voice-clip .ic{font-size:2rem;flex:none;width:44px;text-align:center}
.voice-clip .m{flex:1;min-width:0}
.voice-clip .m b{display:block;overflow-wrap:anywhere}
.voice-play{flex:none;width:64px;height:64px;border-radius:50%;border:none;background:#6a1b9a;color:#fff;font-size:1.8rem;cursor:pointer;display:grid;place-items:center}
.voice-play:focus{outline:3px solid #ffb300;outline-offset:2px}
.voice-play.on{background:#c62828}
.voice-mini{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px}
.voice-rec{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;border:2px dashed var(--line,#ccc);border-radius:16px;background:#fff;margin:10px 0}
.voice-recbtn{width:132px;height:132px;border-radius:50%;border:none;background:#c62828;color:#fff;font-size:3.4rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}
.voice-recbtn.on{animation:voicepulse 1.2s infinite;background:#8e0000}
@keyframes voicepulse{0%{box-shadow:0 0 0 0 rgba(198,40,40,.6)}100%{box-shadow:0 0 0 22px rgba(198,40,40,0)}}
.voice-timer{font-size:1.8rem;font-weight:800;font-variant-numeric:tabular-nums}
.voice-step{border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;padding:12px;margin-bottom:10px}
.voice-step h4{margin:0 0 8px}
.voice-choice{display:flex;gap:8px;flex-wrap:wrap}
.voice-choice label{display:flex;gap:8px;align-items:flex-start;border:2px solid var(--line,#ddd);border-radius:12px;padding:10px;cursor:pointer;flex:1 1 220px;background:#fff}
.voice-choice input{width:22px;height:22px;flex:none;margin-top:2px}
.voice-order{list-style:none;padding:0;margin:0}
.voice-order li{display:flex;gap:8px;align-items:center;border:1px solid var(--line,#ddd);border-radius:10px;padding:8px;margin-bottom:6px;background:#fff}
.voice-order li .m{flex:1;min-width:0}
.voice-g{border:1px solid var(--line,#ddd);border-left:6px solid #6a1b9a;border-radius:12px;background:#fff;padding:12px;margin-bottom:10px}
.voice-att{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:6px;margin-top:8px}
.voice-att div{background:#f6f2f8;border-radius:8px;padding:6px;text-align:center}
.voice-att b{display:block;font-size:1.2rem}
@media (max-width:420px){.voice-play{width:56px;height:56px}.voice-recbtn{width:112px;height:112px}}
`;

let metaCache = null;
async function meta(k) { if (!metaCache) metaCache = await k.api.get('/meta'); return metaCache; }
const say = (k, en, ml) => k.ui.speakBtn(k.lang === 'ml' && ml ? ml : en, k.lang === 'ml' && ml ? 'ml' : 'en');
const secs = (s) => { const n = Math.round(Number(s) || 0); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
function setup(k) { k.style(CSS, 'voice-css'); }
function hero(k, icon, en, ml, pen, pml) {
  return k.h('div', { class: 'voice-hero' }, k.h('h2', null, icon + ' ' + k.t(en, ml)), k.h('p', null, k.t(pen, pml)), say(k, en + '. ' + pen, ml + '. ' + pml));
}
const LIC = { community: ['🏡 Our hamlet only', '🏡 നമ്മുടെ ഊരിന് മാത്രം'], cc_by_nc: ['🤝 Shared, with name, not for sale', '🤝 പേരോടെ പങ്കുവയ്ക്കാം, വിൽപ്പനയ്ക്കല്ല'], public: ['🌐 Everyone', '🌐 എല്ലാവർക്കും'] };
const STATUS = { draft: ['Waiting for review', 'പരിശോധനയ്ക്ക് കാത്തിരിക്കുന്നു', 'warn'], reviewed: ['Checked — ready to publish', 'പരിശോധിച്ചു', 'info'], published: ['Published', 'പ്രസിദ്ധീകരിച്ചു', 'good'], returned: ['Sent back', 'തിരിച്ചയച്ചു', 'bad'], withdrawn: ['Taken back by speaker', 'പറഞ്ഞയാൾ തിരിച്ചെടുത്തു', 'bad'] };

// ---------- offline store (IndexedDB) ----------
function idb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('voice-offline', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('clips');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
async function idbDo(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('clips', mode); const s = t.objectStore('clips'); const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); }
const offKey = (k, id) => (k.user ? k.user.id : 'x') + ':' + id;
async function offGet(k, id) { try { return await idbDo('readonly', (s) => s.get(offKey(k, id))); } catch (_) { return null; } }
async function offPut(k, id, v) { try { await idbDo('readwrite', (s) => s.put(v, offKey(k, id))); return true; } catch (_) { return false; } }
async function offKeys(k) { try { return (await idbDo('readonly', (s) => s.getAllKeys())).filter((x) => String(x).startsWith((k.user ? k.user.id : 'x') + ':')); } catch (_) { return []; } }
async function offPrune(k, keepIds) {
  // a clip that is no longer listed (withdrawn, unpublished or narrowed) leaves this phone too
  const keep = new Set(keepIds.map((id) => offKey(k, id)));
  for (const key of await offKeys(k)) if (!keep.has(key)) { try { await idbDo('readwrite', (s) => s.delete(key)); } catch (_) { /* ignore */ } }
}

// ---------- player ----------
let current = null;
function stopCurrent() { if (current) { try { current.audio.pause(); } catch (_) { /* ignore */ } current.btn.classList.remove('on'); current.btn.textContent = '▶'; current = null; } }
async function audioFor(k, c) {
  const saved = await offGet(k, c.id);
  if (saved && saved.audio) return saved.audio;
  const r = await k.api.get('/clips/' + c.id + '/audio');
  return r.audio;
}
function playButton(k, c, { hamletId, channel = 'phone', onEnded } = {}) {
  const btn = k.h('button', { class: 'voice-play', type: 'button', 'aria-label': k.t('Play ', 'കേൾക്കുക ') + c.title }, '▶');
  let counted = false;
  btn.onclick = async () => {
    if (current && current.btn === btn) { stopCurrent(); return; }
    stopCurrent();
    btn.textContent = '…';
    try {
      const a = new Audio(await audioFor(k, c));
      current = { audio: a, btn };
      btn.classList.add('on'); btn.textContent = '■';
      a.addEventListener('timeupdate', () => {
        if (!counted && a.duration && a.currentTime / a.duration > 0.5) {
          counted = true; // a "play" = more than half heard; counted per hamlet, never per person
          k.api.post('/clips/' + c.id + '/play', { hamlet_id: hamletId || null, channel }).catch(() => {});
        }
      });
      a.addEventListener('ended', () => { stopCurrent(); if (onEnded) onEnded(); });
      await a.play();
    } catch (e) { stopCurrent(); k.toast(k.t('Could not play this clip: ', 'കേൾപ്പിക്കാൻ കഴിഞ്ഞില്ല: ') + e.message, 'bad'); }
  };
  return btn;
}
function clipRow(k, c, { hamletId, channel, extra, onEnded, playBtn } = {}) {
  const { h, t, ui } = k;
  const pb = c.status === 'published' && !c.withdrawn_at ? (playBtn || playButton(k, c, { hamletId, channel, onEnded })) : null;
  return h('div', { class: 'voice-clip' },
    h('span', { class: 'ic', 'aria-hidden': 'true' }, c.icon || '🔊'),
    h('div', { class: 'm' },
      h('b', null, t(c.title, c.title_ml || c.title)),
      h('div', { class: 'voice-mini small muted' }, t(c.kind_label, c.kind_label_ml), ' · ', c.language, ' · ', secs(c.duration_s),
        c.credit_as ? ' · ' + c.credit_as : '', c.is_demo ? h('span', { class: 'voice-demo' }, 'DEMO AUDIO') : null,
        c.licence ? ui.badge(t(LIC[c.licence][0], LIC[c.licence][1]), c.licence === 'community' ? 'info' : 'good') : null),
      extra || null),
    say(k, c.title + (c.transcript ? '. ' + c.transcript : ''), (c.title_ml || '') + (c.transcript_ml ? '. ' + c.transcript_ml : '')),
    pb);
}

// ---------- listener home ----------
async function home(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const m = await meta(k);
  el.append(hero(k, '📻', 'Hamlet Radio', 'ഊര് റേഡിയോ', 'News, announcements, songs and elders\' stories in our own language. Press the big ▶ to listen.', 'നമ്മുടെ ഭാഷയിൽ വാർത്തകൾ, അറിയിപ്പുകൾ, പാട്ടുകൾ, മൂപ്പന്മാരുടെ കഥകൾ. കേൾക്കാൻ വലിയ ▶ അമർത്തുക.'));
  const mine = m.my_hamlets.filter((x) => x.on);
  if (!mine.length) { el.append(ui.empty(t('Hamlet Radio is not offered in your hamlet.', 'നിങ്ങളുടെ ഊരിൽ ഈ സേവനം ഇല്ല.'))); return; }
  let hamlet = (mine.find((x) => x.member) || mine[0]).id;
  let lang = '';
  const pick = mine.length > 1 ? h('select', { class: 'input', style: { maxWidth: '320px' }, onchange: () => { hamlet = pick.value; draw(); } }, mine.map((x) => h('option', { value: x.id }, t(x.name, x.name_ml)))) : null;
  const langs = h('div', { class: 'voice-langs', role: 'group', 'aria-label': t('Language', 'ഭാഷ') });
  const opts = [{ value: '', label: 'All', label_ml: 'എല്ലാം' }, ...m.languages];
  const drawLangs = () => langs.replaceChildren(...opts.map((o) => h('button', { type: 'button', 'aria-pressed': String(lang === o.value), onclick: () => { lang = o.value; drawLangs(); draw(); } }, t(o.label, o.label_ml))));
  drawLangs();
  const today = h('div'), all = h('div'), saved = h('div', { class: 'small muted' });
  el.append(h('div', { class: 'row' }, pick), langs, ui.section(t('🎶 Today\'s playlist', '🎶 ഇന്നത്തെ പ്ലേലിസ്റ്റ്'), today), ui.section(t('All clips for my hamlet', 'എന്റെ ഊരിനുള്ള എല്ലാ ശബ്ദങ്ങളും'), all), saved);
  async function draw() {
    today.replaceChildren(ui.loading()); all.replaceChildren(ui.loading());
    const [pl, clips] = await Promise.all([k.api.get('/playlist?hamlet_id=' + encodeURIComponent(hamlet)), k.api.get('/clips?hamlet_id=' + encodeURIComponent(hamlet))]);
    const f = (c) => !lang || c.language === lang;
    today.replaceChildren(...(pl && pl.items.length ? [h('p', { class: 'small muted' }, (pl.date || '') + ' · ' + secs(pl.total_s)), ...pl.items.filter(f).map((c) => clipRow(k, c, { hamletId: hamlet }))] : [ui.empty(t('No playlist yet for this visit.', 'ഈ സന്ദർശനത്തിന് പ്ലേലിസ്റ്റ് ഇല്ല.'))]));
    const shown = clips.filter(f);
    all.replaceChildren(...(shown.length ? shown.map((c) => clipRow(k, c, { hamletId: hamlet, extra: offlineBtn(k, c) })) : [ui.empty(t('No clips in this language yet.', 'ഈ ഭാഷയിൽ ഇതുവരെ ഇല്ല.'))]));
    if (!clips._offline) await offPrune(k, clips.map((c) => c.id));
    const n = (await offKeys(k)).length;
    saved.replaceChildren(n ? t(`📥 ${n} clip(s) saved on this phone for listening without network.`, `📥 ${n} ശബ്ദം നെറ്റ്‌വർക്ക് ഇല്ലാതെ കേൾക്കാൻ ഈ ഫോണിൽ സൂക്ഷിച്ചിട്ടുണ്ട്.`) : '');
  }
  await draw();
}
function offlineBtn(k, c) {
  const b = k.ui.button('📥 ' + k.t('Save to phone', 'ഫോണിൽ സൂക്ഷിക്കുക'), async () => {
    try {
      const r = await k.api.get('/clips/' + c.id + '/audio');
      if (await offPut(k, c.id, { audio: r.audio, title: c.title, saved_at: Date.now() })) { b.textContent = '✓ ' + k.t('Saved', 'സൂക്ഷിച്ചു'); b.disabled = true; } else k.toast(k.t('This phone has no room to save audio.', 'ഈ ഫോണിൽ സ്ഥലമില്ല.'), 'warn');
    } catch (e) { k.toast(e.message, 'bad'); }
  }, { tone: 'ghost', small: true });
  offGet(k, c.id).then((x) => { if (x) { b.textContent = '✓ ' + k.t('Saved', 'സൂക്ഷിച്ചു'); b.disabled = true; } });
  return b;
}

// ---------- recorder ----------
function recorderWidget(k, { maxSeconds, onReady }) {
  const { h, t } = k;
  const timer = h('div', { class: 'voice-timer', 'aria-live': 'polite' }, '0:00 / ' + secs(maxSeconds));
  const btn = h('button', { class: 'voice-recbtn', type: 'button', 'aria-label': t('Record', 'റെക്കോർഡ്') }, '🎙️');
  const info = h('div', { class: 'small muted', style: { textAlign: 'center' } }, t('Press the red button and speak. Press again to stop.', 'ചുവന്ന ബട്ടൺ അമർത്തി സംസാരിക്കുക. നിർത്താൻ വീണ്ടും അമർത്തുക.'));
  const playback = h('div');
  let rec = null, chunks = [], started = 0, tick = null, stream = null;
  const pickType = () => ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x)) || '';
  const stop = () => { if (rec && rec.state !== 'inactive') rec.stop(); };
  btn.onclick = async () => {
    if (rec && rec.state === 'recording') { stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { k.toast(t('This phone cannot record here. Try Chrome on Android.', 'ഈ ഫോണിൽ റെക്കോർഡ് ചെയ്യാൻ കഴിയില്ല.'), 'bad'); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (_) { k.toast(t('Please allow the microphone.', 'മൈക്രോഫോൺ അനുവദിക്കുക.'), 'warn'); return; }
    const type = pickType();
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 24000 });
    chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(tick); btn.classList.remove('on'); btn.textContent = '🎙️';
      stream.getTracks().forEach((x) => x.stop());
      const dur = Math.min(maxSeconds, (Date.now() - started) / 1000);
      const blob = new Blob(chunks, { type: (rec.mimeType || type || 'audio/webm') });
      const fr = new FileReader();
      fr.onload = () => {
        const url = fr.result;
        const a = h('audio', { controls: true, src: url, style: { width: '100%' } });
        playback.replaceChildren(h('p', { class: 'small' }, t('Listen back. Not happy? Press the red button to record again.', 'തിരികെ കേൾക്കുക. ശരിയായില്ലെങ്കിൽ വീണ്ടും റെക്കോർഡ് ചെയ്യുക.'), ' · ', Math.round(blob.size / 1024) + ' KB'), a);
        info.textContent = t('🔁 Press the red button to re-record.', '🔁 വീണ്ടും റെക്കോർഡ് ചെയ്യാൻ ചുവന്ന ബട്ടൺ.');
        onReady({ audio: url, duration_s: Math.round(dur * 10) / 10, bytes: blob.size });
      };
      fr.readAsDataURL(blob);
    };
    rec.start(1000);
    started = Date.now();
    btn.classList.add('on'); btn.textContent = '■';
    tick = setInterval(() => { const s = (Date.now() - started) / 1000; timer.textContent = secs(s) + ' / ' + secs(maxSeconds); if (s >= maxSeconds) stop(); }, 250);
  };
  return h('div', { class: 'voice-rec' }, btn, timer, info, playback);
}

async function record(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const m = await meta(k);
  el.append(hero(k, '🎙️', 'Record a clip', 'ശബ്ദം റെക്കോർഡ് ചെയ്യുക', `Short and clear — up to ${m.max_seconds} seconds. A reviewer listens before it is shared.`, `ചെറുതും വ്യക്തവും — ${m.max_seconds} സെക്കൻഡ് വരെ. പങ്കുവയ്ക്കുന്നതിന് മുമ്പ് ഒരാൾ കേട്ടു പരിശോധിക്കും.`));
  if (!m.can_record || !m.record_hamlets.length) { el.append(ui.empty(t('You cannot record for any hamlet.', 'ഒരു ഊരിനും റെക്കോർഡ് ചെയ്യാൻ കഴിയില്ല.'))); return; }
  const hm = Object.fromEntries(m.my_hamlets.map((x) => [x.id, x]));
  const st = { kind: 'bulletin', hamlets: [m.record_hamlets[0]], featured: [], speaker: null, licence: 'community', audio: null };
  const W = m.wording;
  const kindBox = h('div', { class: 'voice-choice' }, Object.entries(m.kinds).map(([v, x]) => h('label', null, h('input', { type: 'radio', name: 'vkind', value: v, checked: v === st.kind, onchange: () => { st.kind = v; drawPeople(); drawLic(); } }), h('span', null, h('span', { style: { fontSize: '1.6rem' } }, x.icon), ' ', h('b', null, t(x.label, x.label_ml))))));
  const hamletBox = h('div', { class: 'voice-choice' }, m.record_hamlets.map((id) => h('label', null, h('input', { type: 'checkbox', value: id, checked: st.hamlets.includes(id), onchange: (e) => { st.hamlets = e.target.checked ? [...st.hamlets, id] : st.hamlets.filter((x) => x !== id); drawPeople(); } }), h('span', null, t(hm[id] ? hm[id].name : id, hm[id] ? hm[id].name_ml : id)))));
  const langSel = h('select', { class: 'input' }, m.languages.map((l) => h('option', { value: l.value, selected: hm[st.hamlets[0]] && hm[st.hamlets[0]].community === l.value }, t(l.label, l.label_ml))));
  const title = h('input', { class: 'input', placeholder: t('Short title', 'ചെറിയ തലക്കെട്ട്'), maxlength: 160 });
  const titleMl = h('input', { class: 'input ml', placeholder: 'തലക്കെട്ട് (മലയാളം)', maxlength: 200 });
  const transcript = h('textarea', { class: 'input', rows: 3, placeholder: t('What is said (optional — helps people who cannot hear well, and the reviewer)', 'പറയുന്നത് (ആവശ്യമെങ്കിൽ)') });
  const people = h('div'), lic = h('div');
  const noOne = h('input', { type: 'checkbox' });
  function drawPeople() {
    const story = st.kind === 'oral_history';
    const pick = ui.button('➕ ' + t(story ? 'Choose the elder telling the story' : 'Add a person heard or named', story ? 'കഥ പറയുന്ന മൂപ്പനെ തിരഞ്ഞെടുക്കുക' : 'കേൾക്കുന്ന / പേര് പറയുന്ന ആളെ ചേർക്കുക'), async () => {
      const list = h('div', null, ui.loading());
      const mm = ui.modal(t('Choose a person', 'ആളെ തിരഞ്ഞെടുക്കുക'), list);
      try {
        const rows = await k.api.get('/people?hamlet_id=' + encodeURIComponent(st.hamlets[0] || ''));
        list.replaceChildren(rows.length ? ui.table([{ key: 'name', label: t('Name', 'പേര്') }, { key: 'kind', label: t('Type', 'തരം') }, { key: 'age', label: t('Age', 'വയസ്സ്') }], rows, { onRow: (p) => { if (story) st.speaker = p; else if (!st.featured.some((x) => x.id === p.id)) st.featured.push(p); mm.close(); drawPeople(); } }) : ui.empty(t('Only people who have agreed at the centre to share with your agency are shown. Record their agreement first.', 'നിങ്ങളുടെ സംഘടനയുമായി പങ്കുവയ്ക്കാൻ സമ്മതിച്ചവരെ മാത്രമേ കാണിക്കൂ.')));
      } catch (e) { list.replaceChildren(ui.error(e)); }
    }, { tone: 'ghost' });
    const chips = [...(story && st.speaker ? [st.speaker] : []), ...st.featured].map((p) => h('span', { class: 'pill' }, (p === st.speaker ? '🧓 ' : '👤 ') + p.name + (p.minor ? t(' (child — guardian agreed)', ' (കുട്ടി — രക്ഷിതാവ് സമ്മതിച്ചു)') : ''), ' ', h('button', { class: 'btn ghost small', type: 'button', 'aria-label': t('Remove', 'നീക്കുക'), onclick: () => { if (p === st.speaker) st.speaker = null; else st.featured = st.featured.filter((x) => x.id !== p.id); drawPeople(); } }, '✕')));
    people.replaceChildren(
      h('p', { class: 'small' }, t(W.consent_featured.en, W.consent_featured.ml)), h('div', { class: 'row' }, chips, pick),
      story ? null : h('label', { class: 'cb', style: { marginTop: '8px', display: 'flex', gap: '8px' } }, noOne, h('span', null, '✔ ', t(W.no_identifiable.en, W.no_identifiable.ml))));
  }
  function drawLic() {
    const story = st.kind === 'oral_history';
    lic.replaceChildren(h('p', { class: 'small' }, story ? t('The elder chooses who may listen. Read the choices aloud to them.', 'ആരൊക്കെ കേൾക്കാമെന്ന് മൂപ്പൻ തീരുമാനിക്കും. തിരഞ്ഞെടുപ്പുകൾ വായിച്ചു കേൾപ്പിക്കുക.') : t('Who may listen?', 'ആർക്കൊക്കെ കേൾക്കാം?')),
      h('div', { class: 'voice-choice' }, m.licences.map((l) => h('label', null, h('input', { type: 'radio', name: 'vlic', value: l, checked: st.licence === l, onchange: () => { st.licence = l; } }), h('span', null, t(W.licence[l].en, W.licence[l].ml)), say(k, W.licence[l].en, W.licence[l].ml)))),
      story ? h('p', { class: 'small muted' }, t(W.withdraw.en, W.withdraw.ml)) : null);
  }
  drawPeople(); drawLic();
  const save = ui.button('📤 ' + t('Send for review', 'പരിശോധനയ്ക്ക് അയയ്ക്കുക'), async () => {
    if (!st.audio) { k.toast(t('Record the clip first.', 'ആദ്യം റെക്കോർഡ് ചെയ്യുക.'), 'warn'); return; }
    try {
      const r = await k.api.post('/clips', { kind: st.kind, hamlet_ids: st.hamlets, language: langSel.value, title: title.value, title_ml: titleMl.value, transcript: transcript.value, audio: st.audio.audio, duration_s: st.audio.duration_s, speaker_person_id: st.speaker ? st.speaker.id : null, featured_person_ids: st.featured.map((p) => p.id), no_identifiable: noOne.checked, licence: st.licence });
      if (r && r.queued) k.toast(t('Saved on this phone — it will be sent when the hub is reachable.', 'ഈ ഫോണിൽ സൂക്ഷിച്ചു — ഹബ് ലഭ്യമാകുമ്പോൾ അയയ്ക്കും.'), 'info');
      else k.toast(t('Thank you! Sent for review.', 'നന്ദി! പരിശോധനയ്ക്ക് അയച്ചു.'), 'good');
      k.speak(t('Thank you. Sent for review.', 'നന്ദി. പരിശോധനയ്ക്ക് അയച്ചു.'));
      k.refresh();
    } catch (e) { k.toast(e.message, 'bad'); }
  }, { tone: 'primary' });
  const step = (n, en, ml, body) => h('div', { class: 'voice-step' }, h('h4', null, `${n}. ${t(en, ml)}`), body);
  el.append(
    step(1, 'What kind of clip?', 'ഏതുതരം ശബ്ദം?', kindBox),
    step(2, 'For which hamlet(s)?', 'ഏത് ഊരിന്?', hamletBox),
    step(3, 'Record', 'റെക്കോർഡ് ചെയ്യുക', recorderWidget(k, { maxSeconds: m.max_seconds, onReady: (a) => { st.audio = a; } })),
    step(4, 'Title and language', 'തലക്കെട്ടും ഭാഷയും', h('div', { class: 'stack' }, title, titleMl, langSel, transcript)),
    step(5, 'People in this clip — agreement', 'ഈ ശബ്ദത്തിലുള്ളവർ — സമ്മതം', people),
    step(6, 'Who may listen', 'ആർക്കൊക്കെ കേൾക്കാം', lic),
    h('div', { class: 'row' }, save));
  const mineBox = h('div');
  el.append(ui.section(t('My recent clips', 'എന്റെ ശബ്ദങ്ങൾ'), mineBox));
  const mine = (await k.api.get('/clips?mine=1')).filter((c) => c.mine).slice(0, 10);
  mineBox.replaceChildren(...(mine.length ? mine.map((c) => clipRow(k, c, { extra: h('div', null, ui.badge(t(STATUS[c.status][0], STATUS[c.status][1]), STATUS[c.status][2]), c.review_note ? h('span', { class: 'small' }, ' ' + c.review_note) : null) })) : [ui.empty(t('Nothing recorded yet.', 'ഇതുവരെ ഒന്നുമില്ല.'))]));
}

// ---------- review queue ----------
async function review(el, k) {
  setup(k);
  const { h, t, ui } = k;
  el.append(hero(k, '✅', 'Clips to review', 'പരിശോധിക്കാനുള്ള ശബ്ദങ്ങൾ', 'Listen to each clip fully. Check that everyone heard or named has agreed, and that nothing private is said.', 'ഓരോ ശബ്ദവും മുഴുവൻ കേൾക്കുക. കേൾക്കുന്ന / പേര് പറയുന്ന എല്ലാവരും സമ്മതിച്ചിട്ടുണ്ടെന്നും സ്വകാര്യ കാര്യങ്ങളില്ലെന്നും ഉറപ്പാക്കുക.'));
  const box = h('div');
  el.append(box);
  async function draw() {
    const q = await k.api.get('/queue');
    if (!q.length) { box.replaceChildren(ui.empty(t('Nothing waiting. 🎉', 'ഒന്നും കാത്തിരിക്കുന്നില്ല. 🎉'))); return; }
    box.replaceChildren(...q.map((c) => {
      const preview = h('div');
      const listen = ui.button('🎧 ' + t('Listen', 'കേൾക്കുക'), async () => { try { const r = await k.api.get('/clips/' + c.id + '/audio'); preview.replaceChildren(h('audio', { controls: true, autoplay: true, src: r.audio, style: { width: '100%' } })); } catch (e) { k.toast(e.message, 'bad'); } }, { small: true });
      const act = (decision, label, tone) => ui.button(label, async () => {
        let note = '';
        if (decision === 'return') { note = prompt(t('What should the recorder change?', 'എന്ത് മാറ്റണം?')) || ''; if (!note) return; }
        try { await k.api.post('/clips/' + c.id + '/review', { decision, note }); k.toast(t('Done', 'ചെയ്തു'), 'good'); await draw(); } catch (e) { k.toast(e.message, 'bad'); }
      }, { tone, small: true });
      const consent = c.no_identifiable ? ui.badge(t('No one identifiable', 'ആരെയും തിരിച്ചറിയാനാവില്ല'), 'info') : (c.featured || []).map((p) => ui.badge((p.consent ? '✓ ' : '✕ ') + p.name, p.consent ? 'good' : 'bad'));
      return h('div', { class: 'card' },
        clipRow(k, c, { extra: h('div', null, ui.badge(t(STATUS[c.status][0], STATUS[c.status][1]), STATUS[c.status][2]), ' ', h('span', { class: 'small muted' }, c.recorded_by_name)) }),
        c.transcript ? h('p', { class: 'small' }, c.transcript) : null,
        h('div', { class: 'row' }, h('b', { class: 'small' }, t('Agreement: ', 'സമ്മതം: ')), consent),
        preview,
        h('div', { class: 'row' }, listen,
          c.status === 'draft' && c.can_review ? act('review', '✓ ' + t('Checked', 'പരിശോധിച്ചു'), 'primary') : null,
          c.status === 'reviewed' && c.can_publish ? act('publish', '📢 ' + t('Publish', 'പ്രസിദ്ധീകരിക്കുക'), 'primary') : null,
          act('return', '↩ ' + t('Send back', 'തിരിച്ചയയ്ക്കുക'), 'ghost')));
    }));
  }
  await draw();
}

// ---------- playlist builder ----------
async function playlist(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const m = await meta(k);
  el.append(hero(k, '🎶', 'Visit-day playlist', 'സന്ദർശന ദിവസത്തെ പ്ലേലിസ്റ്റ്', 'Build the running order for the hub speaker: bulletins and announcements first, then one story or song.', 'ഹബ് സ്പീക്കറിനായി ക്രമം ഒരുക്കുക: ആദ്യം വാർത്തകളും അറിയിപ്പുകളും, പിന്നെ ഒരു കഥയോ പാട്ടോ.'));
  const hs = m.record_hamlets;
  if (!m.can_build || !hs.length) { el.append(ui.empty(t('You cannot build playlists.', 'പ്ലേലിസ്റ്റ് ഒരുക്കാൻ കഴിയില്ല.'))); return; }
  const hm = Object.fromEntries(m.my_hamlets.map((x) => [x.id, x]));
  let hamlet = hs[0];
  let date = new Date().toISOString().slice(0, 10);
  let order = [];
  const sel = h('select', { class: 'input', style: { maxWidth: '280px' }, onchange: () => { hamlet = sel.value; load(); } }, hs.map((id) => h('option', { value: id }, t(hm[id] ? hm[id].name : id, hm[id] ? hm[id].name_ml : id))));
  const dateIn = h('input', { class: 'input', type: 'date', value: date, style: { maxWidth: '180px' }, onchange: () => { date = dateIn.value; load(); } });
  const left = h('div'), right = h('div'), speaker = h('div');
  el.append(h('div', { class: 'row' }, sel, dateIn), ui.grid([ui.card({ title: t('Running order', 'ക്രമം'), body: right }), ui.card({ title: t('Published clips for this hamlet', 'ഈ ഊരിനുള്ള ശബ്ദങ്ങൾ'), body: left })], 300), speaker);
  let clips = [];
  const byId = (id) => clips.find((c) => c.id === id);
  function drawOrder() {
    const total = order.reduce((s, id) => s + (Number((byId(id) || {}).duration_s) || 0), 0);
    right.replaceChildren(
      order.length ? h('ol', { class: 'voice-order' }, order.map((id, i) => { const c = byId(id) || { title: id }; return h('li', null, h('span', { 'aria-hidden': 'true' }, c.icon || '🔊'), h('div', { class: 'm' }, h('b', null, t(c.title, c.title_ml || c.title)), h('div', { class: 'small muted' }, secs(c.duration_s))),
        ui.button('▲', () => { if (i) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; drawOrder(); } }, { tone: 'ghost', small: true }),
        ui.button('▼', () => { if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; drawOrder(); } }, { tone: 'ghost', small: true }),
        ui.button('✕', () => { order.splice(i, 1); drawOrder(); }, { tone: 'ghost', small: true })); })) : ui.empty(t('Add clips from the list.', 'പട്ടികയിൽ നിന്ന് ചേർക്കുക.')),
      h('p', { class: 'small muted' }, t('Total ', 'ആകെ ') + secs(total)),
      h('div', { class: 'row' }, ui.button('💾 ' + t('Save playlist', 'സേവ് ചെയ്യുക'), async () => {
        try { await k.api.post('/playlists', { hamlet_id: hamlet, date, items: order }); k.toast(t('Playlist saved', 'പ്ലേലിസ്റ്റ് സേവ് ചെയ്തു'), 'good'); drawSpeaker(); } catch (e) { k.toast(e.message, 'bad'); }
      }, { tone: 'primary' })));
  }
  function drawSpeaker() {
    // Play the whole running order on the hub speaker; each clip heard counts once for this hamlet.
    let i = 0;
    const now = h('div', { class: 'small' });
    const next = () => {
      if (i >= order.length) { now.textContent = t('Finished.', 'കഴിഞ്ഞു.'); return; }
      const c = byId(order[i]); i++;
      if (!c) return next();
      now.replaceChildren(clipRow(k, c, { hamletId: hamlet, channel: 'hub', onEnded: next }));
      now.querySelector('.voice-play').click();
    };
    speaker.replaceChildren(ui.card({ title: '🔈 ' + t('Hub speaker', 'ഹബ് സ്പീക്കർ'), body: h('div', null, ui.button('▶ ' + t('Play the whole playlist', 'മുഴുവൻ പ്ലേ ചെയ്യുക'), () => { i = 0; next(); }, { tone: 'primary' }), now) }));
  }
  async function load() {
    left.replaceChildren(ui.loading());
    const [cs, pls] = await Promise.all([k.api.get('/clips?hamlet_id=' + encodeURIComponent(hamlet)), k.api.get('/playlists?hamlet_id=' + encodeURIComponent(hamlet))]);
    clips = cs.filter((c) => (c.hamlet_ids || []).includes(hamlet));
    const pl = pls.find((p) => p.date === date);
    order = pl ? pl.items.map((c) => c.id) : [];
    left.replaceChildren(...(clips.length ? clips.map((c) => clipRow(k, c, { hamletId: hamlet, extra: ui.button('➕ ' + t('Add', 'ചേർക്കുക'), () => { if (!order.includes(c.id)) { order.push(c.id); drawOrder(); } }, { small: true }) })) : [ui.empty(t('No published clips for this hamlet yet.', 'ഇതുവരെ ഇല്ല.'))]));
    drawOrder(); drawSpeaker();
  }
  await load();
  const reach = await k.api.get('/reach').catch(() => null);
  if (reach && reach.rows.length) el.append(ui.section(t('Listening reach (plays, no names)', 'കേട്ടവരുടെ എണ്ണം (പേരുകളില്ല)'), ui.table([{ key: 'title', label: t('Clip', 'ശബ്ദം'), render: (r) => t(r.title, r.title_ml || r.title) }, { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (r) => t(r.hamlet, r.hamlet_ml) }, { key: 'hub', label: '🔈' }, { key: 'phone', label: '📱' }, { key: 'total', label: t('Total', 'ആകെ') }], reach.rows.slice(0, 20))));
}

// ---------- gatherings ----------
async function gatherings(el, k) {
  setup(k);
  const { h, t, ui } = k;
  const m = await meta(k);
  el.append(hero(k, '🎬', 'Gatherings', 'കൂട്ടായ്മകൾ', 'Film nights, shows, sports and celebrations at the centre. Come with your family!', 'സെന്ററിൽ സിനിമാ രാത്രികൾ, പരിപാടികൾ, കളികൾ, ആഘോഷങ്ങൾ. കുടുംബത്തോടൊപ്പം വരൂ!'));
  const list = h('div');
  const today = new Date().toISOString().slice(0, 10);
  const groups = [['children', 'Children', 'കുട്ടികൾ'], ['youth', 'Youth', 'യുവജനം'], ['adults', 'Adults', 'മുതിർന്നവർ'], ['elders', 'Elders', 'മൂപ്പന്മാർ'], ['women', 'Women', 'സ്ത്രീകൾ']];
  const W = m.wording;
  function formFor(g) {
    const hs = m.record_hamlets;
    const hm = Object.fromEntries(m.my_hamlets.map((x) => [x.id, x]));
    return ui.form([
      ...(g ? [] : [{ name: 'hamlet_id', label: t('Hamlet', 'ഊര്'), type: 'select', required: true, options: hs.map((id) => ({ value: id, label: hm[id] ? t(hm[id].name, hm[id].name_ml) : id })) }]),
      { name: 'kind', label: t('Kind', 'തരം'), type: 'select', required: true, value: g && g.kind, options: Object.entries(m.gathering_kinds).map(([v, x]) => ({ value: v, label: x.icon + ' ' + t(x.label, x.label_ml) })) },
      { name: 'title', label: t('Title', 'തലക്കെട്ട്'), required: true, value: g && g.title },
      { name: 'title_ml', label: 'തലക്കെട്ട് (മലയാളം)', value: g && g.title_ml },
      { name: 'date', label: t('Date', 'തീയതി'), type: 'date', required: true, value: (g && g.date) || today },
      { name: 'time', label: t('Time', 'സമയം'), type: 'time', value: (g && g.time) || '19:00' },
      { name: 'showing', label: t('What will be shown', 'എന്ത് കാണിക്കും'), value: g && g.showing },
      { name: 'licence_note', label: t('Permission / licence to show it (required)', 'കാണിക്കാനുള്ള അനുമതി / ലൈസൻസ് (നിർബന്ധം)'), type: 'textarea', required: true, value: g && g.licence_note, help: t(W.screening_licence.en, W.screening_licence.ml) },
      { name: 'status', label: t('Status', 'സ്ഥിതി'), type: 'select', value: (g && g.status) || 'scheduled', options: [{ value: 'scheduled', label: t('Planned', 'ആസൂത്രണം') }, { value: 'held', label: t('Held', 'നടന്നു') }, { value: 'postponed', label: t('Postponed', 'മാറ്റിവച്ചു') }, { value: 'cancelled', label: t('Cancelled', 'റദ്ദാക്കി') }] },
      ...groups.map(([n, en, ml]) => ({ name: n, label: t(en + ' (count)', ml + ' (എണ്ണം)'), type: 'number', min: 0, value: g ? g.attendance[n] : '' })),
      { name: 'feedback', label: t('What people said', 'ആളുകൾ പറഞ്ഞത്'), type: 'textarea', value: g && g.feedback },
    ], async (v) => {
      for (const [n] of groups) if (v[n] === null) delete v[n];
      if (g) await k.api.put('/gatherings/' + g.id, v); else await k.api.post('/gatherings', v);
      k.toast(t('Saved', 'സേവ് ചെയ്തു'), 'good'); document.querySelector('.modal-bg')?.remove(); await draw();
    });
  }
  if (m.can_build) el.append(h('div', { class: 'row' }, ui.button('➕ ' + t('Plan a gathering', 'കൂട്ടായ്മ ആസൂത്രണം ചെയ്യുക'), () => ui.modal(t('Plan a gathering', 'കൂട്ടായ്മ'), formFor(null)), { tone: 'primary' }), h('a', { class: 'btn ghost', href: '#/m/community/meetings' }, '🗣️ ' + t('Oorukoottam meetings', 'ഊരുകൂട്ടം യോഗങ്ങൾ'))));
  el.append(list);
  async function draw() {
    const rows = await k.api.get('/gatherings');
    const up = rows.filter((g) => g.status === 'scheduled' && g.date >= today).reverse();
    const past = rows.filter((g) => !(g.status === 'scheduled' && g.date >= today));
    const card = (g) => h('div', { class: 'voice-g' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, (g.icon || '') + ' ' + t(g.title, g.title_ml || g.title)), say(k, `${g.title}. ${g.date} ${g.time || ''}. ${g.hamlet}`, `${g.title_ml || g.title}. ${g.date} ${g.time || ''}. ${g.hamlet_ml || ''}`)),
      h('div', { class: 'small muted' }, `${g.date} ${g.time || ''} · ${t(g.hamlet, g.hamlet_ml)} · ${t(g.kind_label, g.kind_label_ml)}`, g.is_demo ? h('span', { class: 'voice-demo', style: { marginLeft: '6px' } }, 'DEMO') : null),
      g.showing ? h('div', { class: 'small' }, '🎞️ ', g.showing) : null,
      g.can_edit ? h('div', { class: 'small muted' }, '📜 ', g.licence_note) : null,
      g.status === 'held' ? h('div', { class: 'voice-att' }, groups.map(([n, en, ml]) => h('div', null, h('b', null, g.attendance[n]), h('span', { class: 'small' }, t(en, ml)))), h('div', null, h('b', null, g.attendance.total), h('span', { class: 'small' }, t('Total', 'ആകെ')))) : null,
      g.feedback ? h('p', { class: 'small' }, '💬 ', t(g.feedback, g.feedback_ml || g.feedback)) : null,
      g.can_edit ? ui.button('✏️ ' + t('Update / attendance', 'പുതുക്കുക / ഹാജർ'), () => ui.modal(t('Update gathering', 'പുതുക്കുക'), formFor(g)), { small: true, tone: 'ghost' }) : null);
    list.replaceChildren(ui.section(t('Coming up', 'വരാനിരിക്കുന്നത്'), up.length ? up.map(card) : ui.empty(t('Nothing planned yet.', 'ഇതുവരെ ഒന്നുമില്ല.'))), ui.section(t('Held', 'നടന്നവ'), past.length ? past.map(card) : ui.empty('—')));
  }
  await draw();
}

// ---------- impact (donors / government) ----------
async function impact(el, k) {
  setup(k);
  const { h, t, ui } = k;
  el.append(hero(k, '📊', 'Radio & gatherings reach', 'റേഡിയോ, കൂട്ടായ്മ കണക്കുകൾ', 'Counts only — no names. Small numbers are hidden to protect families.', 'എണ്ണം മാത്രം — പേരുകളില്ല. കുടുംബങ്ങളെ സംരക്ഷിക്കാൻ ചെറിയ എണ്ണങ്ങൾ മറച്ചിരിക്കുന്നു.'));
  const r = await k.api.get('/aggregate');
  const v = (x) => (x === 'hidden' ? t('hidden', 'മറച്ചു') : x);
  el.append(ui.grid([ui.stat(t('Clips published', 'പ്രസിദ്ധീകരിച്ചവ'), r.totals.clips_published), ui.stat(t('Elders\' stories', 'മൂപ്പന്മാരുടെ കഥകൾ'), r.totals.oral_histories), ui.stat(t('Plays', 'കേട്ടത്'), v(r.totals.plays)), ui.stat(t('Gatherings', 'കൂട്ടായ്മകൾ'), r.totals.gatherings), ui.stat(t('Attendance', 'ഹാജർ'), v(r.totals.attendance)), ui.stat(t('Women', 'സ്ത്രീകൾ'), v(r.totals.women))], 150),
    h('p', { class: 'small muted' }, t(`Since ${r.since} · ${r.scope} · ${r.note}`, `${r.since} മുതൽ · ${r.scope}`)),
    ui.section(t('By hamlet', 'ഊര് തിരിച്ച്'), ui.table([
      { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (x) => t(x.hamlet, x.hamlet_ml) }, { key: 'clips_published', label: t('Clips', 'ശബ്ദങ്ങൾ') }, { key: 'plays', label: t('Plays', 'കേട്ടത്') }, { key: 'gatherings', label: t('Gatherings', 'കൂട്ടായ്മ') },
      { key: 'children', label: t('Children', 'കുട്ടികൾ') }, { key: 'youth', label: t('Youth', 'യുവജനം') }, { key: 'adults', label: t('Adults', 'മുതിർന്നവർ') }, { key: 'elders', label: t('Elders', 'മൂപ്പന്മാർ') }, { key: 'women', label: t('Women', 'സ്ത്രീകൾ') }, { key: 'attendance', label: t('Total', 'ആകെ'), render: (x) => v(x.attendance) },
    ], r.by_hamlet)),
    ui.section(t('Gatherings by kind', 'തരം തിരിച്ച്'), ui.bars(r.gatherings_by_kind.map((x) => ({ label: t(x.label, x.label_ml), value: x.gatherings })))));
}

export default { views: { home, record, review, playlist, gatherings, impact } };
