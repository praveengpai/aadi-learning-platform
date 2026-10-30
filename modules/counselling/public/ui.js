// AADI — Career, Mentoring & Wellbeing: browser views. No DOM work at import time.

const CSS = `
.counselling-pulse{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-l);padding:18px;text-align:center}
.counselling-pulse h3{margin:0 0 4px}
.counselling-faces{display:flex;justify-content:center;gap:8px;margin:14px 0;flex-wrap:wrap}
.counselling-face{width:62px;height:62px;border-radius:50%;border:3px solid transparent;background:var(--paper);font-size:2.2rem;cursor:pointer;transition:transform .12s, border-color .12s}
.counselling-face:hover{transform:scale(1.08)}
.counselling-face.on{border-color:var(--forest);background:var(--leaf-soft);transform:scale(1.1)}
.counselling-face span{display:block;font-size:.65rem;color:var(--ink-2);margin-top:-4px}
.counselling-talk{display:inline-flex;gap:8px;align-items:center;padding:10px 16px;border-radius:999px;border:2px solid var(--line);background:var(--surface);font:inherit;cursor:pointer;min-height:48px}
.counselling-talk.on{border-color:var(--gold);background:var(--gold-soft)}
.counselling-strip{display:flex;gap:3px;align-items:flex-end;height:44px;margin-top:10px;justify-content:center}
.counselling-strip i{width:10px;border-radius:3px 3px 0 0;background:var(--forest-2)}
.counselling-path{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-l);padding:16px}
.counselling-path header{display:flex;gap:12px;align-items:center}
.counselling-path header .ic{font-size:2.4rem}
.counselling-road{list-style:none;margin:14px 0 6px;padding:0;position:relative}
.counselling-road::before{content:'';position:absolute;left:17px;top:6px;bottom:6px;width:4px;background:linear-gradient(var(--gold),var(--forest-2));border-radius:4px}
.counselling-road li{position:relative;padding:4px 0 14px 46px}
.counselling-road li .dot{position:absolute;left:6px;top:2px;width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid var(--forest-2);display:grid;place-items:center;font-size:.75rem;font-weight:700;color:var(--forest)}
.counselling-road li .when{font-size:var(--step--1);color:var(--ink-3)}
.counselling-pills{display:flex;flex-wrap:wrap;gap:6px}
.counselling-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.counselling-pcard{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px;border-radius:var(--r-l);border:2px solid var(--line);background:var(--surface);font:inherit;color:inherit;text-align:left;cursor:pointer;min-height:110px}
.counselling-pcard.on{border-color:var(--forest);background:var(--leaf-soft)}
.counselling-pcard .ic{font-size:2rem}
.counselling-chat{display:flex;flex-direction:column;gap:8px;max-height:56vh;overflow:auto;padding:12px;background:var(--paper);border-radius:var(--r-l);border:1px solid var(--line)}
.counselling-msg{max-width:80%;padding:9px 12px;border-radius:16px;background:var(--surface);border:1px solid var(--line);align-self:flex-start;white-space:pre-wrap;word-break:break-word}
.counselling-msg.mine{align-self:flex-end;background:#dff0ea;border-color:#bfe0d4}
.counselling-msg.held{background:var(--warn-bg);border-color:#ecd38c}
.counselling-msg.rejected{opacity:.6;text-decoration:line-through}
.counselling-msg .meta{display:block;font-size:.72rem;color:var(--ink-3);margin-top:3px}
.counselling-notice{font-size:var(--step--1);padding:8px 12px;border-radius:var(--r-m);background:var(--info-bg);margin-bottom:8px}
.counselling-compose{display:flex;gap:8px;margin-top:8px}
.counselling-compose textarea{flex:1;min-height:48px;border-radius:12px;border:1px solid var(--line);padding:10px;font:inherit}
.counselling-heat{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;height:18px;border-radius:6px;overflow:hidden;min-width:120px}
.counselling-heat i{display:block}
`;
const setup = (k) => k.style(CSS, 'counselling-css');
const L = (k, o, f) => k.t(o[f], o[f + '_ml']);
const MOODS = [{ v: 1, icon: '😢', label: 'Very low', label_ml: 'വളരെ വിഷമം' }, { v: 2, icon: '🙁', label: 'Low', label_ml: 'വിഷമം' }, { v: 3, icon: '😐', label: 'Okay', label_ml: 'കുഴപ്പമില്ല' }, { v: 4, icon: '🙂', label: 'Good', label_ml: 'നല്ലത്' }, { v: 5, icon: '😄', label: 'Great', label_ml: 'വളരെ നല്ലത്' }];
const MOOD_COL = ['#b3261e', '#e08a3c', '#c9b458', '#7fb069', '#2f7d4a'];
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const months = (m) => (m >= 12 ? `${Math.round((m / 12) * 10) / 10} yr` : `${m} mo`);

// ---------- pulse widget ----------
function pulseCard(k, onDone) {
  let mood = null, talk = false;
  const box = k.h('div', { class: 'counselling-pulse' });
  const faces = k.h('div', { class: 'counselling-faces', role: 'radiogroup', 'aria-label': k.t('How are you feeling?', 'നിങ്ങൾക്ക് എങ്ങനെയുണ്ട്?') });
  for (const m of MOODS) faces.append(k.h('button', { class: 'counselling-face', role: 'radio', 'aria-checked': 'false', 'aria-label': L(k, m, 'label'), title: L(k, m, 'label'), onclick: (e) => { mood = m.v; [...faces.children].forEach((b, i) => { b.classList.toggle('on', i === m.v - 1); b.setAttribute('aria-checked', i === m.v - 1); }); k.speak(L(k, m, 'label')); } }, m.icon, k.h('span', null, L(k, m, 'label'))));
  const talkBtn = k.h('button', { class: 'counselling-talk', 'aria-pressed': 'false', onclick: () => { talk = !talk; talkBtn.classList.toggle('on', talk); talkBtn.setAttribute('aria-pressed', talk); } }, '🙋 ', k.t('I need to talk to someone', 'എനിക്ക് ആരോടെങ്കിലും സംസാരിക്കണം'));
  box.append(k.h('h3', null, k.t('How are you feeling today?', 'ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെയുണ്ട്?'), ' ', k.h('button', { class: 'btn ghost small', onclick: () => k.speak(k.t('How are you feeling today? Tap a face.', 'ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെയുണ്ട്? ഒരു മുഖം തൊടൂ.')) }, '🔊')),
    k.h('p', { class: 'small muted' }, k.t('Only you and your counsellor can see your answers.', 'നിങ്ങൾക്കും കൗൺസിലർക്കും മാത്രമേ കാണാനാകൂ.')), faces, talkBtn,
    k.h('div', { style: { marginTop: '12px' } }, k.ui.button(k.t('Share', 'പങ്കുവെക്കുക'), async () => {
      if (!mood) return k.toast(k.t('Tap a face first', 'ആദ്യം ഒരു മുഖം തൊടൂ'), 'warn');
      const r = await k.api.post('/pulse', { mood, need_talk: talk });
      const msg = r.queued ? k.t('Saved — will send when online.', 'സൂക്ഷിച്ചു — ഓൺലൈനാകുമ്പോൾ അയയ്ക്കും.') : k.t(r.message, r.message_ml);
      box.replaceChildren(k.h('div', { style: { fontSize: '2.6rem' } }, r.follow_up ? '💚' : '🌟'), k.h('p', { style: { fontSize: '1.1rem' } }, msg),
        r.follow_up ? k.h('p', { class: 'small muted' }, k.t('If you feel unsafe now, use the Help button or call 1098 / 112.', 'ഇപ്പോൾ സുരക്ഷിതമല്ലെന്ന് തോന്നിയാൽ സഹായ ബട്ടൺ ഉപയോഗിക്കുക അല്ലെങ്കിൽ 1098 / 112 വിളിക്കുക.'), ' ', k.h('a', { href: '#/m/safeguarding/help' }, '🛟 ' + k.t('Help', 'സഹായം'))) : null);
      k.speak(msg); onDone && onDone();
    }, { tone: 'primary' })));
  return box;
}

function strip(k, pulses) {
  const s = k.h('div', { class: 'counselling-strip', 'aria-hidden': 'true' });
  for (const p of pulses.slice(-24)) s.append(k.h('i', { style: { height: (p.mood * 8) + 'px', background: MOOD_COL[p.mood - 1] }, title: fmt(p.at) }));
  return s;
}

// ---------- pathway card ----------
function pathCard(k, pw, extra) {
  let acc = 0;
  return k.h('div', { class: 'counselling-path' },
    k.h('header', null, k.h('span', { class: 'ic' }, pw.icon), k.h('div', { style: { flex: 1 } }, k.h('h3', { style: { margin: 0 } }, L(k, pw, 'title')), k.h('div', { class: 'small muted' }, `⏱ ~${pw.years} ${k.t('year(s)', 'വർഷം')} · ${pw.sector}`)),
      k.h('button', { class: 'btn ghost small', onclick: () => k.speak(L(k, pw, 'title') + '. ' + (k.lang === 'ml' ? pw.eligibility_ml : pw.eligibility).join('. ') + '. ' + pw.steps.map((s) => L(k, s, 'label')).join('. ')) }, '🔊')),
    k.h('h4', { style: { margin: '12px 0 4px' } }, '✅ ' + k.t('Who can apply', 'യോഗ്യത')),
    k.h('ul', { style: { margin: 0 } }, (k.lang === 'ml' ? pw.eligibility_ml : pw.eligibility).map((e) => k.h('li', null, e))),
    k.h('h4', { style: { margin: '12px 0 0' } }, '🪜 ' + k.t('Steps & timeline', 'ഘട്ടങ്ങളും സമയക്രമവും')),
    k.h('ol', { class: 'counselling-road' }, pw.steps.map((s, i) => { acc += s.months; return k.h('li', null, k.h('span', { class: 'dot' }, i + 1), k.h('div', null, L(k, s, 'label')), k.h('div', { class: 'when' }, s.months ? `+${months(s.months)} · ${k.t('by', 'ഏകദേശം')} ~${months(acc)}` : k.t('Now', 'ഇപ്പോൾ'))); })),
    k.h('p', { class: 'small', style: { background: 'var(--gold-soft)', padding: '8px 10px', borderRadius: '8px' } }, '💡 ' + L(k, pw, 'tip')),
    pw.lifeskills_status ? k.h('div', null, k.h('b', { class: 'small' }, k.t('Life skills for this path: ', 'ഈ വഴിക്കുള്ള ജീവിത നൈപുണ്യം: ')), k.h('div', { class: 'counselling-pills' }, pw.lifeskills_status.map((x) => k.h('a', { class: 'pill', href: '#/m/lifeskills/module?key=' + x.key }, (x.done ? '✅ ' : '○ ') + x.key.replace(/_/g, ' '))))) : null,
    pw.exam_tags && pw.exam_tags.length ? k.h('p', { class: 'small' }, k.h('a', { href: '#/m/exams/home' }, '🎯 ' + k.t('Practise in Exam Prep →', 'പരീക്ഷാ പരിശീലനത്തിൽ →'))) : null,
    extra || null);
}

// ---------- learner home ----------
async function home(el, k) {
  setup(k);
  const pid = k.user.person_id;
  if (!pid) return pathways(el, k);
  const [me, pm, asp] = await Promise.all([k.api.get('/me'), k.api.get('/pulse/me'), k.api.get('/aspirations/' + pid)]);
  el.append(k.h('h2', null, '🌱 ' + k.t('My future & feelings', 'എന്റെ ഭാവി, മനസ്സ്')));
  const pulseBox = pm.today ? k.h('div', { class: 'counselling-pulse' }, k.h('h3', null, '🌟 ' + k.t('Thanks for checking in today', 'ഇന്ന് പങ്കുവെച്ചതിന് നന്ദി')), strip(k, [...pm.pulses].reverse()), k.h('p', { class: 'small muted' }, k.t('Need to talk? Tap below anytime.', 'സംസാരിക്കണോ? എപ്പോഴും താഴെ തൊടൂ.')), k.ui.button('🙋 ' + k.t('I need to talk', 'എനിക്ക് സംസാരിക്കണം'), async () => { const r = await k.api.post('/pulse', { mood: pm.pulses[0] ? pm.pulses[0].mood : 3, need_talk: true }); k.toast(k.t(r.message || 'Sent', r.message_ml || 'അയച്ചു'), 'good'); })) : pulseCard(k);
  el.append(k.ui.grid([pulseBox,
    k.ui.card({ title: '🤝 ' + k.t('My mentor', 'എന്റെ മെന്റർ'), body: me.match ? [k.h('p', null, k.h('b', null, me.match.mentor_name)), k.ui.button(k.t('Open chat', 'ചാറ്റ് തുറക്കുക'), () => k.go('#/m/counselling/chat?id=' + me.match.id), { tone: 'primary' })] : [k.h('p', null, k.t('A mentor is someone who has walked the path you want. Ask for one!', 'നിങ്ങൾ ആഗ്രഹിക്കുന്ന വഴിയിലൂടെ നടന്നയാളാണ് മെന്റർ. ചോദിക്കൂ!')), k.ui.button(k.t('Ask for a mentor', 'മെന്ററെ ചോദിക്കുക'), async () => { await k.api.post('/mentor-request', {}); k.toast(k.t('Your counsellor will arrange one.', 'കൗൺസിലർ ക്രമീകരിക്കും.'), 'good'); })] }),
  ], 280));
  el.append(k.ui.section('🪜 ' + k.t('My dream path', 'എന്റെ സ്വപ്ന വഴി'), [
    asp.pathways.length ? asp.pathways.map((p) => pathCard(k, p)) : k.ui.empty(k.t('Pick a path you dream about.', 'സ്വപ്നം കാണുന്ന വഴി തിരഞ്ഞെടുക്കൂ.')),
    k.ui.button('✏️ ' + k.t('Choose my paths', 'വഴികൾ തിരഞ്ഞെടുക്കുക'), () => k.go('#/m/counselling/pathways?pick=1'), { tone: 'ghost' }),
  ]));
}

// ---------- pathways explorer ----------
async function pathways(el, k) {
  setup(k);
  const r = await k.api.get('/pathways');
  const pick = k.params.pick === '1' && k.user.person_id;
  const chosen = new Set();
  const detail = k.h('div');
  const cards = k.h('div', { class: 'counselling-cards' });
  for (const p of r.pathways) {
    const b = k.h('button', { class: 'counselling-pcard', 'aria-pressed': 'false', onclick: () => {
      if (pick) { chosen.has(p.key) ? chosen.delete(p.key) : chosen.size < 3 && chosen.add(p.key); b.classList.toggle('on', chosen.has(p.key)); b.setAttribute('aria-pressed', chosen.has(p.key)); }
      detail.replaceChildren(pathCard(k, p)); detail.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } }, k.h('span', { class: 'ic' }, p.icon), k.h('b', null, L(k, p, 'title')), k.h('span', { class: 'small muted' }, `~${p.years} ${k.t('yr', 'വർഷം')}`));
    cards.append(b);
  }
  el.append(k.h('h2', null, '🪜 ' + k.t('Career pathways', 'കരിയർ വഴികൾ')), k.h('p', { class: 'small muted' }, L(k, { n: r.note, n_ml: 'വിജ്ഞാപനങ്ങൾ മാറും — ഏറ്റവും പുതിയ ഔദ്യോഗിക അറിയിപ്പ് പരിശോധിക്കുക. ST വിഭാഗത്തിന് പ്രായ ഇളവും സംവരണവും ലഭിക്കും.' }, 'n')),
    pick ? k.ui.card({ tone: 'feature', body: [k.h('p', null, k.t('Tap up to 3 paths you dream about, then save.', 'സ്വപ്നം കാണുന്ന 3 വഴികൾ വരെ തൊടൂ, പിന്നെ സേവ് ചെയ്യൂ.')), k.ui.button(k.t('Save my paths', 'സേവ് ചെയ്യുക'), async () => { if (!chosen.size) return k.toast(k.t('Pick at least one', 'ഒന്നെങ്കിലും'), 'warn'); await k.api.put('/aspirations/' + k.user.person_id, { pathway_keys: [...chosen] }); k.toast(k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); k.go('#/m/counselling/home'); }, { tone: 'primary' })] }) : null,
    cards, k.h('div', { style: { marginTop: '16px' } }, detail));
}

// ---------- chat ----------
async function chat(el, k) {
  setup(k);
  const id = k.params.id;
  const r = await k.api.get(`/matches/${id}/messages`);
  const box = k.h('div', { class: 'counselling-chat', role: 'log', 'aria-live': 'polite' });
  const paint = (msgs) => {
    box.replaceChildren(...msgs.map((m) => k.h('div', { class: 'counselling-msg' + (m.mine ? ' mine' : '') + (m.status === 'held' ? ' held' : '') + (m.status === 'rejected' ? ' rejected' : '') },
      m.body != null ? m.body : k.h('i', null, k.t('(message being checked)', '(സന്ദേശം പരിശോധിക്കുന്നു)')),
      k.h('span', { class: 'meta' }, `${m.sender_name || m.sender_role} · ${fmt(m.sent_at)}${m.status !== 'delivered' ? ' · ' + ({ held: k.t('⏳ held for safety check', '⏳ സുരക്ഷാ പരിശോധന'), rejected: k.t('🚫 not delivered', '🚫 അയച്ചില്ല'), escalated: k.t('🛡️ escalated', '🛡️ കൈമാറി') }[m.status] || m.status) : ''}${m.reasons && m.reasons.length ? ' · ' + m.reasons.join(', ') : ''}`))));
    box.scrollTop = box.scrollHeight;
  };
  el.append(k.h('div', { class: 'row', style: { alignItems: 'center', gap: '10px' } }, k.ui.button('← ' + k.t('Back', 'തിരികെ'), () => history.back(), { tone: 'ghost', small: true }), k.h('h2', { style: { margin: 0 } }, '🤝 ' + (k.user.role === 'mentor' ? r.match.person_name : r.match.mentor_name) || '')),
    r.supervised ? k.h('div', { class: 'counselling-notice', style: { background: 'var(--warn-bg)' } }, '👁️ ' + k.t('Supervisor view (read-only). This access is logged.', 'മേൽനോട്ട കാഴ്ച (വായന മാത്രം). ഈ പ്രവേശനം രേഖപ്പെടുത്തി.')) : null,
    k.h('div', { class: 'counselling-notice' }, '🔒 ' + k.t(r.notice, r.notice_ml)), box);
  paint(r.messages);
  if (!r.supervised && r.match.status === 'active') {
    const ta = k.h('textarea', { placeholder: k.t('Write a message…', 'സന്ദേശം എഴുതൂ…'), 'aria-label': k.t('Message', 'സന്ദേശം') });
    el.append(k.h('div', { class: 'counselling-compose' }, ta, k.ui.button(k.t('Send', 'അയയ്ക്കുക'), async () => {
      const body = ta.value.trim(); if (!body) return;
      const s = await k.api.post(`/matches/${id}/messages`, { body });
      ta.value = '';
      if (s.held) k.toast(k.t(s.message, s.message_ml), 'warn');
      const again = await k.api.get(`/matches/${id}/messages`); paint(again.messages);
    }, { tone: 'primary' })),
    k.h('p', { class: 'small muted' }, k.t('Keep phone numbers, social media and meeting plans out of chat. Meet only at the centre.', 'ഫോൺ നമ്പർ, സോഷ്യൽ മീഡിയ, കൂടിക്കാഴ്ച പദ്ധതി ചാറ്റിൽ വേണ്ട. കേന്ദ്രത്തിൽ മാത്രം കാണുക.')));
  }
}

// ---------- mentoring (mentor / counsellor / CPO) ----------
async function mentor(el, k) {
  setup(k);
  const rows = await k.api.get('/matches');
  el.append(k.h('h2', null, '🤝 ' + k.t('Mentoring', 'മെന്ററിംഗ്')),
    k.h('p', { class: 'small muted' }, k.t('All mentoring chat is logged. Adult↔minor conversations are visible to the counsellor supervisor and the Child Protection Officer.', 'എല്ലാ ചാറ്റും രേഖപ്പെടുത്തുന്നു. മുതിർന്നവർ↔കുട്ടി സംഭാഷണങ്ങൾ കൗൺസിലർക്കും CPO-യ്ക്കും കാണാം.')),
    k.ui.table([
      { key: 'person_name', label: k.t('Learner', 'പഠിതാവ്'), render: (m) => [m.person_name, Number(m.minor) ? ' ' : '', Number(m.minor) ? k.ui.badge(k.t('minor', 'കുട്ടി'), 'info') : ''] },
      { key: 'mentor_name', label: k.t('Mentor', 'മെന്റർ') },
      { key: 'pathway_title', label: k.t('Path', 'വഴി'), render: (m) => L(k, m, 'pathway_title') || '—' },
      { key: 'status', label: k.t('Status', 'നില'), render: (m) => k.ui.badge(m.status, m.status === 'active' ? 'good' : '') },
      { key: 'held', label: '⏳', render: (m) => (m.held ? k.ui.badge(m.held + ' ' + k.t('held', 'തടഞ്ഞു'), 'warn') : '') },
      { key: 'last_at', label: k.t('Last message', 'അവസാന സന്ദേശം'), render: (m) => fmt(m.last_at) },
    ], rows, { onRow: (m) => k.go('#/m/counselling/chat?id=' + m.id), empty: k.t('No mentoring matches yet.', 'മെന്ററിംഗ് ഇല്ല.') }));
  if (['counsellor', 'platform_admin', 'cpo'].includes(k.user.role)) {
    const ms = await k.api.get('/mentors');
    el.append(k.ui.section(k.t('Mentors', 'മെന്റർമാർ'), k.ui.table([
      { key: 'name', label: k.t('Name', 'പേര്') }, { key: 'expertise', label: k.t('Knows', 'അറിയുന്നത്'), render: (m) => m.expertise.join(', ') },
      { key: 'languages', label: k.t('Languages', 'ഭാഷ'), render: (m) => m.languages.join(', ') }, { key: 'load', label: k.t('Load', 'ഭാരം'), render: (m) => `${m.load}/${m.capacity}` },
      { key: 'trained', label: '🎓', render: (m) => (m.trained && m.active ? '✅' : k.ui.badge(k.t('Training pending', 'പരിശീലനം ബാക്കി'), 'bad')) }], ms)));
  }
}

// ---------- counsellor caseload ----------
async function caseload(el, k) {
  setup(k);
  if (k.params.person) return personView(el, k, k.params.person);
  const [rows, tasks] = await Promise.all([k.api.get('/caseload'), k.api.get('/tasks')]);
  el.append(k.h('h2', null, '🗂️ ' + k.t('Counsellor caseload', 'കൗൺസിലർ കേസുകൾ')),
    k.ui.grid([k.ui.stat(k.t('Learners (with wellbeing consent)', 'പഠിതാക്കൾ (ക്ഷേമ സമ്മതത്തോടെ)'), rows.length), k.ui.stat(k.t('Open follow-ups', 'തുടർനടപടികൾ'), tasks.length), k.ui.stat(k.t('Urgent', 'അടിയന്തരം'), tasks.filter((t) => t.priority === 'urgent').length)], 160));
  el.append(k.ui.tabs([
    { id: 'tasks', label: '📌 ' + k.t('Follow-ups', 'തുടർനടപടികൾ'), render: (t) => t.append(k.ui.table([
      { key: 'priority', label: '', render: (x) => (x.priority === 'urgent' ? k.ui.badge(k.t('Urgent', 'അടിയന്തരം'), 'bad') : k.ui.badge(k.t('Normal', 'സാധാരണ'), 'info')) },
      { key: 'person_name', label: k.t('Learner', 'പഠിതാവ്') }, { key: 'kind', label: k.t('Why', 'കാരണം'), render: (x) => ({ need_talk: '🙋 ' + k.t('Asked to talk', 'സംസാരിക്കണം'), low_pulse: '🙁 ' + k.t('Low check-in', 'താഴ്ന്ന മനോനില'), mentor_request: '🤝 ' + k.t('Wants mentor', 'മെന്റർ വേണം'), session_followup: '🗓️ ' + k.t('Follow-up', 'തുടർച്ച') }[x.kind] || x.kind) },
      { key: 'reason', label: k.t('Detail', 'വിശദം') }, { key: 'due', label: k.t('Due', 'തീയതി') },
      { key: 'go', label: '', render: (x) => k.ui.button(k.t('Open', 'തുറക്കുക'), () => k.go(`#/m/counselling/caseload?person=${x.person_id}&task=${x.id}`), { small: true }) }], tasks, { empty: k.t('No open follow-ups. 🌿', 'തുടർനടപടികളില്ല. 🌿') })) },
    { id: 'all', label: '👥 ' + k.t('Learners', 'പഠിതാക്കൾ'), render: (t) => t.append(k.ui.table([
      { key: 'name', label: k.t('Name', 'പേര്'), render: (x) => [x.urgent ? '🔴 ' : '', x.name] }, { key: 'hamlet', label: k.t('Hamlet', 'ഊര്') },
      { key: 'last_mood', label: k.t('Mood', 'മനോനില'), render: (x) => (x.last_mood ? MOODS[x.last_mood - 1].icon : '—') }, { key: 'trend', label: k.t('Trend', 'പ്രവണത'), render: (x) => k.ui.spark(x.trend) },
      { key: 'mentor', label: k.t('Mentor', 'മെന്റർ'), render: (x) => x.mentor || '—' }, { key: 'last_session', label: k.t('Last session', 'അവസാന സെഷൻ'), render: (x) => x.last_session || '—' }], rows, { onRow: (x) => k.go('#/m/counselling/caseload?person=' + x.id) })) },
  ], 'tasks'));
}

async function personView(el, k, pid) {
  const [wb, sessions, asp] = await Promise.all([k.api.get('/wellbeing/' + pid), k.api.get('/sessions/' + pid), k.api.get('/aspirations/' + pid)]);
  const pulses = [...wb.pulses].reverse();
  el.append(k.h('div', { class: 'row', style: { alignItems: 'center', gap: '10px' } }, k.ui.button('← ' + k.t('Caseload', 'കേസുകൾ'), () => k.go('#/m/counselling/caseload'), { tone: 'ghost', small: true }), k.h('h2', { style: { margin: 0 } }, wb.person.name)));
  el.append(k.ui.grid([
    k.ui.card({ title: k.t('Wellbeing (90 days)', 'ക്ഷേമം (90 ദിവസം)'), body: [strip(k, pulses), k.ui.kv([[k.t('30-day average', '30 ദിവസ ശരാശരി'), wb.avg30 ?? '—'], [k.t('Asked to talk', 'സംസാരിക്കാൻ ആവശ്യപ്പെട്ടത്'), pulses.filter((p) => p.need_talk).length]])] }),
    k.ui.card({ title: k.t('Log a session', 'സെഷൻ രേഖപ്പെടുത്തുക'), body: k.ui.form([
      { name: 'date', label: k.t('Date', 'തീയതി'), type: 'date', value: new Date().toISOString().slice(0, 10) },
      { name: 'mode', label: k.t('Mode', 'രീതി'), type: 'select', required: true, options: ['in_person', 'phone', 'video', 'group'] },
      { name: 'topic', label: k.t('Topic', 'വിഷയം'), type: 'select', required: true, options: ['career', 'wellbeing', 'family', 'study', 'safety', 'other'] },
      { name: 'notes', label: k.t('Private notes (only you)', 'സ്വകാര്യ കുറിപ്പ് (നിങ്ങൾക്ക് മാത്രം)'), type: 'textarea' },
      { name: 'follow_up', label: k.t('Follow-up', 'തുടർനടപടി'), type: 'text' }, { name: 'follow_up_date', label: k.t('Follow-up date', 'തീയതി'), type: 'date' },
    ], async (v) => { await k.api.post('/sessions', { ...v, person_id: pid, task_id: k.params.task }); k.toast(k.t('Session saved', 'സേവ് ചെയ്തു'), 'good'); k.refresh(); }) }),
  ], 300));
  el.append(k.ui.section(k.t('Sessions', 'സെഷനുകൾ'), k.ui.table([{ key: 'date', label: k.t('Date', 'തീയതി') }, { key: 'topic', label: k.t('Topic', 'വിഷയം') }, { key: 'mode', label: k.t('Mode', 'രീതി') }, { key: 'counsellor_name', label: k.t('By', 'ആര്') }, { key: 'notes', label: k.t('Notes', 'കുറിപ്പ്'), render: (s) => (s.notes_private ? '🔒 ' + k.t('private', 'സ്വകാര്യം') : s.notes || '—') }], sessions)));
  if (asp.pathways.length) el.append(k.ui.section(k.t('Aspirations', 'ആഗ്രഹങ്ങൾ'), asp.pathways.map((p) => pathCard(k, p))));
  const sug = await k.api.get('/matches/suggest/' + pid).catch(() => []);
  if (sug.length) el.append(k.ui.section(k.t('Suggested mentors', 'നിർദ്ദേശിച്ച മെന്റർമാർ'), k.ui.table([{ key: 'name', label: k.t('Mentor', 'മെന്റർ') }, { key: 'why', label: k.t('Why', 'കാരണം'), render: (m) => m.why.join(' · ') }, { key: 'm', label: '', render: (m) => (m.reachable ? k.ui.button(k.t('Match', 'ജോടിയാക്കുക'), async () => { await k.api.post('/matches', { person_id: pid, mentor_id: m.id }); k.toast(k.t('Matched', 'ജോടിയാക്കി'), 'good'); k.refresh(); }, { small: true }) : '—') }], sug)));
}

// ---------- wellbeing overview (aggregate) ----------
async function wellbeing(el, k) {
  setup(k);
  const r = await k.api.get('/wellbeing-summary');
  const heat = (dist) => { const tot = dist.reduce((a, b) => a + b, 0) || 1; return k.h('div', { class: 'counselling-heat', 'aria-hidden': 'true', style: { gridTemplateColumns: dist.map((d) => Math.max(0.02, d / tot) + 'fr').join(' ') } }, dist.map((d, i) => k.h('i', { style: { background: MOOD_COL[i] } }))); };
  el.append(k.h('h2', null, '📈 ' + k.t('Wellbeing overview', 'ക്ഷേമ അവലോകനം')),
    k.h('p', { class: 'small muted' }, k.t(`Anonymous aggregates for the last 90 days. Groups with fewer than ${r.k} learners are hidden. Individual check-ins are seen only by the learner and their counsellor.`, `കഴിഞ്ഞ 90 ദിവസത്തെ അജ്ഞാത സംഗ്രഹം. ${r.k}-ൽ താഴെയുള്ള ഗ്രൂപ്പുകൾ മറച്ചിരിക്കുന്നു.`)),
    r.overall && !r.overall.suppressed ? k.ui.grid([k.ui.stat(k.t('Learners checking in', 'പങ്കുവെക്കുന്നവർ'), r.overall.learners), k.ui.stat(k.t('Check-ins', 'ചെക്ക്-ഇന്നുകൾ'), r.overall.checkins), k.ui.stat(k.t('Average mood', 'ശരാശരി'), r.overall.avg + ' / 5'), k.ui.stat(k.t('Low check-ins', 'താഴ്ന്നവ'), r.overall.low_pct + '%')], 150) : k.ui.empty(k.t('Not enough data to show safely.', 'സുരക്ഷിതമായി കാണിക്കാൻ മതിയായ വിവരമില്ല.')),
    k.ui.section(k.t('By month', 'മാസം തിരിച്ച്'), k.ui.table([{ key: 'key', label: k.t('Month', 'മാസം') }, { key: 'learners', label: k.t('Learners', 'പഠിതാക്കൾ') }, { key: 'avg', label: k.t('Avg', 'ശരാശരി'), render: (x) => x.avg ?? '—' }, { key: 'dist', label: '😢 → 😄', render: (x) => (x.dist ? heat(x.dist) : '—') }], r.by_month)),
    k.ui.section(k.t('By hamlet', 'ഊര് തിരിച്ച്'), k.ui.table([{ key: 'name', label: k.t('Hamlet', 'ഊര്'), render: (x) => L(k, x, 'name') }, { key: 'learners', label: k.t('Learners', 'പഠിതാക്കൾ') }, { key: 'avg', label: k.t('Avg', 'ശരാശരി'), render: (x) => x.avg ?? '—' }, { key: 'low_pct', label: k.t('Low %', 'താഴ്ന്ന %'), render: (x) => (x.low_pct != null ? x.low_pct + '%' : '—') }, { key: 'dist', label: '😢 → 😄', render: (x) => (x.dist ? heat(x.dist) : k.t('hidden', 'മറച്ചു')) }], r.by_hamlet)));
}

export default { views: { home, pathways, chat, mentor, caseload, wellbeing } };
