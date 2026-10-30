// AADI — Reach channels UI: staff console + feature-phone simulator. No DOM work at import time.
const CSS = `
.channels-head { display:flex; gap:12px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; margin-bottom:14px; }
.channels-head h1 { margin:0; }
.channels-prov { display:flex; gap:8px; flex-wrap:wrap; }
.channels-prov span { border:1px solid var(--line); border-radius:999px; padding:3px 10px; font-size:.82rem; background:var(--surface); }
.channels-prov span.live { border-color:var(--bad); color:var(--bad); }
.channels-days { display:flex; gap:3px; align-items:flex-end; height:70px; }
.channels-days i { flex:1; background:var(--forest-2); border-radius:2px 2px 0 0; min-height:2px; }
.channels-wrap { display:grid; grid-template-columns:minmax(260px,320px) 1fr; gap:22px; align-items:start; }
@media (max-width:760px) { .channels-wrap { grid-template-columns:1fr; } }
.channels-phone { width:260px; margin:0 auto; background:linear-gradient(160deg,#2d3532,#151a18); border-radius:38px 38px 46px 46px; padding:22px 18px 26px; box-shadow:0 18px 40px rgba(0,0,0,.25), inset 0 2px 0 rgba(255,255,255,.08); color:#d6e6c2; user-select:none; }
.channels-brand { text-align:center; font-size:.7rem; letter-spacing:.3em; color:#8f9b95; margin-bottom:8px; }
.channels-screen { background:#9fbf7a; color:#1d2a14; border-radius:6px; height:190px; padding:8px 10px; font-family:ui-monospace,Menlo,monospace; font-size:.82rem; line-height:1.3; overflow:hidden; box-shadow:inset 0 0 0 3px #6d8752; display:flex; flex-direction:column; }
.channels-screen .bar { display:flex; justify-content:space-between; font-size:.7rem; border-bottom:1px solid #6d8752; margin-bottom:4px; }
.channels-screen .body { flex:1; overflow-y:auto; white-space:pre-wrap; word-break:break-word; }
.channels-screen .body.ml { font-family:var(--font-ml); font-size:.9rem; }
.channels-screen .soft { display:flex; justify-content:space-between; font-size:.72rem; border-top:1px solid #6d8752; margin-top:4px; }
.channels-nav { display:grid; grid-template-columns:1fr 1.2fr 1fr; gap:8px; margin:14px 0 10px; align-items:center; }
.channels-keys { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.channels-key { background:linear-gradient(#4a5550,#323b37); color:#eef4ea; border:0; border-radius:14px; padding:8px 0 6px; font-size:1.05rem; font-weight:700; cursor:pointer; line-height:1; box-shadow:0 2px 0 #111; }
.channels-key small { display:block; font-size:.55rem; font-weight:400; color:#a9b8b0; letter-spacing:.1em; margin-top:2px; }
.channels-key:active { transform:translateY(1px); box-shadow:none; }
.channels-key.call { background:linear-gradient(#3f8f4f,#2a6a37); }
.channels-key.end { background:linear-gradient(#b04a3f,#86322a); }
.channels-key.dpad { border-radius:999px; }
.channels-ivr { border-left:4px solid var(--gold); background:var(--gold-soft); border-radius:var(--r-s); padding:10px 12px; margin-top:10px; }
.channels-ivr p { margin:.2em 0; }
.channels-thread { display:flex; flex-direction:column; gap:6px; max-height:360px; overflow-y:auto; }
.channels-msg { max-width:88%; padding:8px 10px; border-radius:12px; background:var(--surface); border:1px solid var(--line); font-size:.9rem; }
.channels-msg.out { align-self:flex-end; background:var(--leaf-soft); }
.channels-msg .meta { font-size:.72rem; color:var(--ink-3); margin-top:2px; }
`;

const ago = (iso) => { if (!iso) return '—'; const h = (Date.now() - new Date(iso)) / 3600e3; return h < 1 ? 'now' : h < 24 ? Math.round(h) + 'h' : Math.round(h / 24) + 'd'; };
const chIcon = { sms: '✉️', ivr: '📞', whatsapp: '💬', app: '📱' };

// ---------------------------------------------------------------- staff console
async function home(el, k) {
  k.style(CSS, 'channels-css');
  const d = await k.api.get('/overview');
  el.append(k.h('div', { class: 'channels-head' }, k.h('div', null, k.h('h1', null, k.t('Reach & messages', 'സന്ദേശങ്ങൾ')), k.h('p', { class: 'muted', style: { margin: 0 } }, k.t('SMS, voice calls and WhatsApp for families without smartphones. Every message needs contact consent.', 'സ്മാർട്ട്ഫോൺ ഇല്ലാത്ത കുടുംബങ്ങൾക്കായി SMS, വോയ്സ്, വാട്ട്‌സ്ആപ്പ്.'))),
    k.h('div', { class: 'channels-prov' }, Object.entries(d.providers).map(([ch, p]) => k.h('span', { class: p.live ? 'live' : '' }, `${chIcon[ch] || ''} ${ch}: ${p.provider}`)))));
  if (!d.live) el.append(k.h('p', { class: 'small muted' }, 'ℹ️ ', k.t('Demo mode: messages are delivered by the simulator. No real SMS or calls are made.', 'ഡെമോ: യഥാർത്ഥ SMS അയയ്ക്കില്ല.')));
  const sent = d.byChannel.reduce((s, c) => s + c.delivered, 0), failed = d.byChannel.reduce((s, c) => s + c.failed, 0);
  el.append(k.ui.grid([
    k.ui.stat(k.t('Delivered (30 days)', 'എത്തിച്ചത്'), sent, `${Math.round((sent / Math.max(1, sent + failed)) * 100)}% ` + k.t('success', 'വിജയം')),
    k.ui.stat(k.t('Reached via guardian’s phone', 'രക്ഷിതാവിന്റെ ഫോൺ വഴി'), d.reached_via_guardian),
    k.ui.stat(k.t('In queue', 'ക്യൂവിൽ'), d.queue.queued + d.queue.retry, d.queue.retry ? d.queue.retry + ' ' + k.t('retrying', 'വീണ്ടും') : ''),
    k.ui.stat(k.t('Cost (30 days)', 'ചെലവ്'), '₹' + Math.round(d.byChannel.reduce((s, c) => s + c.cost_paise, 0) / 100)),
  ], 170));
  el.append(k.h('div', { class: 'row', style: { margin: '12px 0' } },
    k.ui.button('▶ ' + k.t('Deliver queue now', 'ഇപ്പോൾ അയയ്ക്കുക'), async () => { const r = await k.api.post('/process', {}); k.toast(`${r.sent || 0} sent · ${r.retry || 0} retry · ${r.failed || 0} failed`, 'good'); k.refresh(); }, { tone: 'primary' }),
    k.ui.button('📣 ' + k.t('New broadcast', 'പുതിയ അറിയിപ്പ്'), () => broadcastForm(k)),
    k.ui.button('📨 ' + k.t('Guardian weekly digest', 'രക്ഷിതാക്കൾക്ക് ആഴ്ച റിപ്പോർട്ട്'), () => digestForm(k)),
    k.ui.button('📟 ' + k.t('Phone simulator', 'ഫോൺ സിമുലേറ്റർ'), () => k.go('#/m/channels/phone'), { tone: 'ghost' })));
  el.append(k.ui.tabs([
    { id: 'stats', label: k.t('Delivery', 'വിതരണം'), render: (b) => {
      b.append(k.ui.grid([
        k.ui.card({ title: k.t('By channel', 'ചാനൽ തിരിച്ച്'), body: k.ui.bars(d.byChannel.map((c) => ({ label: `${chIcon[c.channel] || ''} ${c.channel}`, value: c.delivered }))) }),
        k.ui.card({ title: k.t('Delivered per day (14 days)', 'ദിവസം തോറും'), body: k.h('div', { class: 'channels-days', title: d.daily.map((x) => `${x.day}: ${x.n}`).join('\n') }, d.daily.map((x) => k.h('i', { style: { height: (x.n / Math.max(1, ...d.daily.map((y) => y.n))) * 100 + '%' } }))) }),
        k.ui.card({ title: k.t('What we send', 'എന്ത് അയയ്ക്കുന്നു'), body: k.ui.bars(Object.entries(d.byKind).map(([kk, v]) => ({ label: kk, value: v }))) }),
      ], 260));
      if (d.callbacks.length) b.append(k.ui.section('📞 ' + k.t('Callback requests (pressed 9)', 'തിരികെ വിളിക്കാൻ'), k.ui.table([{ key: 'name', label: k.t('Person', 'വ്യക്തി') }, { key: 'at', label: k.t('When', 'എപ്പോൾ'), render: (r) => ago(r.at) }, { key: 'lang', label: k.t('Lang', 'ഭാഷ') }, { key: 'x', label: '', render: (r) => k.ui.button(k.t('Called back', 'വിളിച്ചു'), async () => { await k.api.post(`/ivr/callbacks/${r.id}/done`, {}); k.refresh(); }, { small: true }) }], d.callbacks)));
    } },
    { id: 'bc', label: k.t('Broadcasts', 'അറിയിപ്പുകൾ'), render: async (b) => {
      const rows = await k.api.get('/broadcasts');
      b.append(k.ui.table([
        { key: 'title', label: k.t('Broadcast', 'അറിയിപ്പ്'), render: (r) => k.h('div', null, k.h('b', null, r.title), k.h('div', { class: 'small muted' }, `${r.hamlet_name || ''} · ${r.sent_by_name} · ${ago(r.at)}`)) },
        { key: 'targeted', label: k.t('Cohort', 'കൂട്ടം'), render: (r) => String(r.targeted) },
        { key: 'skipped_no_consent', label: k.t('No consent (skipped)', 'സമ്മതമില്ല'), render: (r) => (r.skipped_no_consent ? k.ui.badge(String(r.skipped_no_consent), 'warn') : '0') },
        { key: 'delivered', label: k.t('Delivered', 'എത്തി'), render: (r) => k.h('span', null, k.h('b', null, String(r.delivered)), ' / ', String(r.queued), r.pending ? k.h('span', { class: 'small muted' }, ` (${r.pending} ${k.t('pending', 'ബാക്കി')})`) : null) },
        { key: 'byChannel', label: k.t('Channels', 'ചാനലുകൾ'), render: (r) => Object.entries(r.byChannel).map(([c, n]) => k.ui.pill(`${chIcon[c] || c} ${n}`)) },
      ], rows, { empty: k.t('No broadcasts yet.', 'അറിയിപ്പുകളില്ല.'), onRow: (r) => k.ui.modal(r.title, k.h('div', null, k.h('p', null, r.message), r.message_ml ? k.h('p', { class: 'ml' }, r.message_ml) : null)) }));
    } },
    { id: 'quiz', label: k.t('SMS quiz', 'SMS ക്വിസ്'), render: (b) => quizTab(b, k) },
    { id: 'ivr', label: k.t('IVR calls', 'IVR കോളുകൾ'), render: async (b) => {
      const r = await k.api.get('/ivr/calls');
      b.append(k.ui.card({ title: k.t('What callers choose', 'വിളിക്കുന്നവർ തിരഞ്ഞെടുക്കുന്നത്'), body: k.ui.bars(Object.entries(r.byOutcome).map(([o, n]) => ({ label: o, value: n }))) }));
      b.append(k.h('div', { style: { marginTop: '12px' } }, k.ui.table([{ key: 'name', label: k.t('Caller', 'വിളിച്ചയാൾ') }, { key: 'outcome', label: k.t('Choice', 'തിരഞ്ഞെടുപ്പ്'), render: (x) => k.ui.pill(x.outcome) }, { key: 'lang', label: k.t('Lang', 'ഭാഷ') }, { key: 'duration_s', label: k.t('Secs', 'സെക്കൻഡ്') }, { key: 'at', label: k.t('When', 'എപ്പോൾ'), render: (x) => ago(x.at) }], r.calls)));
    } },
    { id: 'outbox', label: k.t('Outbox', 'ഔട്ട്‌ബോക്സ്'), render: async (b) => {
      const rows = await k.api.get('/outbox');
      b.append(k.ui.table([{ key: 'person', label: k.t('To', 'ആർക്ക്') }, { key: 'kind', label: k.t('Kind', 'തരം') }, { key: 'status', label: k.t('Status', 'നില'), render: (r) => k.ui.badge(r.status, { sent: 'good', failed: 'bad', retry: 'warn', queued: 'info' }[r.status]) }, { key: 'attempts', label: '#' }, { key: 'last_error', label: k.t('Last error', 'പിശക്'), render: (r) => k.h('span', { class: 'small muted' }, r.last_error || '') }, { key: 'created_at', label: k.t('Queued', 'ക്യൂ'), render: (r) => ago(r.created_at) }], rows));
    } },
  ]));
}

async function broadcastForm(k) {
  const progs = await k.core.get('/programmes' + (k.user.agency_id && k.user.role !== 'platform_admin' ? '?agency_id=' + k.user.agency_id : ''));
  const hs = await k.core.get('/hamlets');
  const m = k.ui.modal(k.t('New broadcast', 'പുതിയ അറിയിപ്പ്'), k.h('div', null,
    k.h('p', { class: 'small muted' }, k.t('Sent only to learners you can see who gave your agency “contact” consent. Children are reached on their guardian’s phone.', 'സമ്മതം നൽകിയവർക്ക് മാത്രം.')),
    k.ui.form([
      { name: 'hamlet_id', label: k.t('Hamlet (whole hamlet)', 'ഊര്'), type: 'select', options: hs.map((h) => ({ value: h.id, label: h.name })) },
      { name: 'programme_id', label: k.t('…or a programme cohort', '…അല്ലെങ്കിൽ ഒരു പരിപാടി'), type: 'select', options: progs.map((p) => ({ value: p.id, label: `${p.title} · ${p.agency_name}` })) },
      { name: 'title', label: k.t('Title', 'തലക്കെട്ട്'), required: true },
      { name: 'message', label: k.t('Message (English)', 'സന്ദേശം (ഇംഗ്ലീഷ്)'), type: 'textarea', required: true },
      { name: 'message_ml', label: k.t('Message (Malayalam — sent if given)', 'സന്ദേശം (മലയാളം)'), type: 'textarea' },
      { name: 'channel', label: k.t('Channel', 'ചാനൽ'), type: 'select', value: 'auto', required: true, options: [{ value: 'auto', label: k.t('Auto (best for each person)', 'ഓട്ടോ') }, 'sms', 'ivr', 'whatsapp'] },
    ], async (v) => {
      if (v.programme_id) v.hamlet_id = '';
      const r = await k.api.post('/broadcasts', v);
      if (r.queued !== undefined) k.toast(k.t(`Queued ${r.queued} · skipped ${r.skipped_no_consent} without consent`, `${r.queued} ക്യൂവിൽ`), 'good');
      m.close(); k.refresh();
    }, { submitLabel: k.t('Send', 'അയയ്ക്കുക') })));
}
async function digestForm(k) {
  const body = k.h('div', null, k.ui.loading());
  const m = k.ui.modal(k.t('Guardian weekly digest', 'ആഴ്ച റിപ്പോർട്ട്'), body);
  try {
    const pv = await k.api.post('/digest/run', { dry_run: true });
    body.replaceChildren(
      k.h('p', null, k.t(`${pv.queued} guardians will get a short Malayalam message (attendance + highlights). ${pv.skipped} skipped (no contact or progress consent).`, `${pv.queued} രക്ഷിതാക്കൾക്ക് സന്ദേശം.`)),
      k.h('div', { class: 'stack' }, pv.preview.map((p) => k.h('div', { class: 'channels-msg ml' }, p.message, k.h('div', { class: 'meta' }, p.child)))),
      k.h('div', { class: 'row', style: { marginTop: '12px' } }, k.ui.button(k.t('Queue digests', 'അയയ്ക്കുക'), async () => { const r = await k.api.post('/digest/run', {}); k.toast(`${r.queued} ` + k.t('digests queued', 'ക്യൂവിൽ'), 'good'); m.close(); k.refresh(); }, { tone: 'primary' })));
  } catch (e) { body.replaceChildren(k.ui.error(e)); }
}
async function quizTab(b, k) {
  const [q, lb] = await Promise.all([k.api.get('/quiz'), k.api.get('/quiz/leaderboard')]);
  const t = q.today;
  b.append(k.ui.grid([
    k.ui.card({ title: '❓ ' + k.t('Today’s SMS question', 'ഇന്നത്തെ ചോദ്യം'), body: t ? k.h('div', null, k.h('p', null, k.h('b', null, t.question)), k.h('p', { class: 'ml' }, t.question_ml), k.h('ol', null, t.options.map((o, i) => k.h('li', { style: { fontWeight: i === t.answer ? 700 : 400 } }, o, i === t.answer ? ' ✓' : '')))) : k.ui.empty('—'),
      actions: [k.ui.button(k.t('Send to a cohort', 'അയയ്ക്കുക'), async () => {
        const hs = await k.core.get('/hamlets');
        const m = k.ui.modal(k.t('Send today’s quiz', 'ക്വിസ് അയയ്ക്കുക'), k.ui.form([{ name: 'hamlet_id', label: k.t('Hamlet', 'ഊര്'), type: 'select', required: true, options: hs.map((h) => ({ value: h.id, label: h.name })) }], async (v) => { const r = await k.api.post('/quiz/send', v); k.toast(`${r.queued} ` + k.t('queued', 'ക്യൂവിൽ'), 'good'); m.close(); }));
      }, { tone: 'primary' }), k.ui.button(k.t('Add question', 'ചോദ്യം ചേർക്കുക'), () => {
        const m = k.ui.modal(k.t('New SMS quiz question', 'പുതിയ ചോദ്യം'), k.ui.form([
          { name: 'date', label: k.t('Date', 'തീയതി'), type: 'date', value: new Date(Date.now() + 86400e3).toISOString().slice(0, 10) },
          { name: 'track', label: k.t('Track', 'ട്രാക്ക്'), type: 'select', options: ['tuition', 'exams', 'language', 'digital', 'lifeskills'], value: 'tuition' },
          { name: 'question', label: k.t('Question (English)', 'ചോദ്യം'), required: true }, { name: 'question_ml', label: k.t('Question (Malayalam)', 'ചോദ്യം (മലയാളം)') },
          { name: 'options', label: k.t('Options separated by |', 'ഉത്തരങ്ങൾ | കൊണ്ട്'), required: true, placeholder: '54|56|64|48' },
          { name: 'answer', label: k.t('Correct option number (1–4)', 'ശരിയുത്തരം'), type: 'number', min: 1, max: 4, required: true },
          { name: 'explanation', label: k.t('Explanation', 'വിശദീകരണം') }, { name: 'explanation_ml', label: k.t('Explanation (Malayalam)', 'വിശദീകരണം (മലയാളം)') },
        ], async (v) => { await k.api.post('/quiz', { ...v, answer: Number(v.answer) - 1 }); k.toast(k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); m.close(); k.refresh(); }));
      }, { tone: 'ghost' })] }),
    k.ui.card({ title: '🏆 ' + k.t('Top quiz players you can see', 'മുൻനിര കളിക്കാർ'), body: lb.length ? k.ui.table([{ key: 'first_name', label: k.t('Name', 'പേര്') }, { key: 'points', label: k.t('Points', 'പോയിന്റ്') }, { key: 'correct', label: '✓' }], lb.slice(0, 10)) : k.ui.empty('—') }),
  ], 300));
}

// ---------------------------------------------------------------- feature-phone simulator
async function phone(el, k) {
  k.style(CSS, 'channels-css');
  const isSelf = ['learner', 'guardian'].includes(k.user.role);
  el.append(k.h('div', { class: 'channels-head' }, k.h('div', null, k.h('h1', null, k.t('Feature-phone simulator', 'ഫീച്ചർ ഫോൺ')), k.h('p', { class: 'muted', style: { margin: 0 } }, k.t('See exactly what a family with a basic keypad phone receives — SMS inbox, quiz replies and the IVR voice menu.', 'സാധാരണ ഫോണിൽ കുടുംബത്തിന് ലഭിക്കുന്നത്.')))));
  const people = await k.api.get('/phone/people');
  if (!people.length) { el.append(k.ui.empty(k.t('No one you can contact yet (needs contact consent).', 'സമ്പർക്ക സമ്മതമുള്ള ആരുമില്ല.'))); return; }
  const wrap = k.h('div', { class: 'channels-wrap' });
  const left = k.h('div'); const right = k.h('div', { class: 'stack' });
  wrap.append(left, right); el.append(wrap);
  const sel = k.h('select', { class: 'input', style: { marginBottom: '12px', width: '100%' } }, people.map((p) => k.h('option', { value: p.id }, `${p.name} · ${chIcon[p.channel] || ''} ${p.channel}${p.via === 'guardian' ? ' (' + k.t('guardian’s phone', 'രക്ഷിതാവിന്റെ ഫോൺ') + ')' : ''}`)));
  sel.value = people.some((p) => p.id === k.params.person_id) ? k.params.person_id : people[0].id;
  const st = { lang: k.lang === 'en' ? 'en' : 'ml', mode: 'inbox', idx: 0, typed: '', data: null, ivr: null, digits: [] };
  const screenBody = k.h('div', { class: 'body' });
  const bar = k.h('div', { class: 'bar' });
  const soft = k.h('div', { class: 'soft' });
  const screen = k.h('div', { class: 'channels-screen', role: 'region', 'aria-live': 'polite', 'aria-label': k.t('Phone screen', 'ഫോൺ സ്ക്രീൻ') }, bar, screenBody, soft);
  const ivrBox = k.h('div');
  const paint = () => {
    const d = st.data; if (!d) return;
    const sig = d.hamlet.connectivity === 'none' ? '✕' : d.hamlet.connectivity === '2g' ? '▂▄' : '▂▄▆█';
    bar.replaceChildren(k.h('span', null, sig + ' ' + (d.hamlet.connectivity || '').toUpperCase()), k.h('span', null, new Date().toTimeString().slice(0, 5)), k.h('span', null, '▮▮▮▯'));
    screenBody.className = 'body' + (st.lang === 'ml' ? ' ml' : '');
    if (st.mode === 'inbox') {
      const sms = d.inbox.filter((m) => m.channel !== 'ivr');
      const m = sms[st.idx];
      screenBody.textContent = m ? `${st.idx + 1}/${sms.length}  ${ago(m.at)}\nFrom: AADI\n\n${m.message}` : (st.lang === 'ml' ? 'സന്ദേശങ്ങളില്ല' : 'No messages');
      soft.replaceChildren(k.h('span', null, st.lang === 'ml' ? 'മറുപടി' : 'Reply'), k.h('span', null, '▲▼'), k.h('span', null, st.lang === 'ml' ? 'വിളി' : 'Call'));
    } else if (st.mode === 'reply') {
      screenBody.textContent = (st.lang === 'ml' ? 'മറുപടി (QUIZ 1-4):\n' : 'Reply (QUIZ 1-4):\n') + 'QUIZ ' + st.typed + '▌';
      soft.replaceChildren(k.h('span', null, st.lang === 'ml' ? 'അയയ്ക്കുക' : 'Send'), k.h('span', null, ''), k.h('span', null, st.lang === 'ml' ? 'തിരികെ' : 'Back'));
    } else if (st.mode === 'call') {
      screenBody.textContent = `📞 AADI IVR\n${st.digits.join(' ') || ''}\n\n${(st.ivr && st.ivr.say.slice(-1)[0]) || (st.lang === 'ml' ? 'ബന്ധിപ്പിക്കുന്നു…' : 'Connecting…')}`;
      soft.replaceChildren(k.h('span', null, st.lang === 'ml' ? 'ഭാഷ' : 'Lang'), k.h('span', null, '0:' + String(Math.min(59, st.digits.length * 12 + 5)).padStart(2, '0')), k.h('span', null, st.lang === 'ml' ? 'അവസാനിപ്പിക്കുക' : 'End'));
    }
  };
  const ivrCall = async (digits) => {
    st.ivr = await k.api.post('/ivr/call', { person_id: sel.value, digits: digits.join(','), lang: st.lang });
    ivrBox.replaceChildren(k.h('div', { class: 'channels-ivr' + (st.lang === 'ml' ? ' ml' : '') }, k.h('b', null, '🔊 ' + k.t('IVR is saying', 'IVR പറയുന്നത്')), st.ivr.say.map((s) => k.h('p', null, s))));
    k.speak(st.ivr.say.slice(digits.length ? 1 : 0).join(' '), st.lang === 'ml' ? 'ml-IN' : 'en-IN');
    paint();
  };
  const press = async (key) => {
    if (st.mode === 'inbox') {
      const n = (st.data.inbox.filter((m) => m.channel !== 'ivr')).length;
      if (key === 'up') st.idx = Math.max(0, st.idx - 1);
      else if (key === 'down') st.idx = Math.min(Math.max(0, n - 1), st.idx + 1);
      else if (key === 'left') { st.mode = 'reply'; st.typed = ''; }
      else if (key === 'call' || key === 'right') { st.mode = 'call'; st.digits = []; await ivrCall([]); return; }
    } else if (st.mode === 'reply') {
      if (/^[1-4]$/.test(key)) st.typed = key;
      else if (key === 'end' || key === 'right') st.mode = 'inbox';
      else if ((key === 'left' || key === 'call' || key === 'ok') && st.typed) {
        const r = await k.api.post('/sms/inbound', { person_id: sel.value, body: 'QUIZ ' + st.typed });
        k.toast(r.reply, r.parsed.correct ? 'good' : 'info');
        st.mode = 'inbox'; st.idx = 0; await load(); return;
      }
    } else if (st.mode === 'call') {
      if (key === 'end' || key === 'right') { st.mode = 'inbox'; st.ivr = null; ivrBox.replaceChildren(); try { speechSynthesis.cancel(); } catch (_) { /* no tts */ } await load(); return; }
      if (key === 'left') { st.lang = st.lang === 'ml' ? 'en' : 'ml'; await ivrCall(st.digits); return; }
      if (/^[0-9]$/.test(key)) { st.digits.push(key); if (st.digits.length > 2 || (st.digits[0] !== '2' && st.digits.length > 1)) st.digits = [key]; await ivrCall(st.digits); return; }
    }
    paint();
  };
  const K = (label, sub, key, cls = '') => k.h('button', { class: 'channels-key ' + cls, type: 'button', 'aria-label': key, onclick: () => press(key).catch((e) => k.toast(e.message, 'bad')) }, label, sub ? k.h('small', null, sub) : null);
  const ph = k.h('div', { class: 'channels-phone' }, k.h('div', { class: 'channels-brand' }, 'AADI · 2G'), screen,
    k.h('div', { class: 'channels-nav' }, K('◀', '', 'left', 'dpad'), k.h('div', { class: 'row', style: { justifyContent: 'center', gap: '4px' } }, K('▲', '', 'up', 'dpad'), K('▼', '', 'down', 'dpad')), K('▶', '', 'right', 'dpad')),
    k.h('div', { class: 'channels-nav' }, K('📞', '', 'call', 'call'), K('OK', '', 'ok'), K('⏻', '', 'end', 'end')),
    k.h('div', { class: 'channels-keys' }, [['1', ''], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', ''], ['0', '+'], ['#', '']].map(([n, s]) => K(n, s, n))));
  left.append(isSelf && people.length === 1 ? null : sel, ph, k.h('p', { class: 'small muted', style: { textAlign: 'center' } }, k.t('▲▼ read SMS · ◀ reply to quiz · 📞 call AADI IVR · ⏻ hang up', '▲▼ വായിക്കുക · ◀ മറുപടി · 📞 IVR')), ivrBox);
  const load = async () => {
    st.data = await k.api.get('/phone/' + sel.value);
    const d = st.data;
    right.replaceChildren(
      k.ui.card({ title: `${d.person.first_name} · ${d.hamlet.name}`, body: k.ui.kv([
        [k.t('Best channel', 'മികച്ച ചാനൽ'), k.h('span', null, `${chIcon[d.channel] || ''} ${d.channel}`, k.h('div', { class: 'small muted' }, d.reason))],
        [k.t('Phone', 'ഫോൺ'), d.person.phone_masked ? `${d.person.phone_masked}${d.person.via === 'guardian' ? ' (' + k.t('guardian', 'രക്ഷിതാവ്') + ')' : ''}` : k.t('none — reached at the centre', 'ഇല്ല')],
        [k.t('Literacy', 'സാക്ഷരത'), d.person.literacy || '—'], [k.t('Network', 'നെറ്റ്‌വർക്ക്'), d.hamlet.connectivity],
        [k.t('Quiz points', 'ക്വിസ് പോയിന്റ്'), `${d.points.p} (${d.points.c} ${k.t('correct', 'ശരി')})`],
      ]) }),
      d.quiz ? k.ui.card({ title: '❓ ' + k.t('Today’s quiz', 'ഇന്നത്തെ ക്വിസ്'), body: k.h('div', null, k.h('p', { class: 'ml' }, d.quiz.question_ml || d.quiz.question), k.h('p', { class: 'small' }, d.quiz.question), k.h('div', { class: 'row' }, d.quiz.options.map((o, i) => k.ui.button(`${i + 1}. ${o}`, async () => { const r = await k.api.post('/sms/inbound', { person_id: sel.value, body: 'QUIZ ' + (i + 1) }); k.toast(r.reply, r.parsed.correct ? 'good' : 'info'); await load(); }, { small: true, tone: 'ghost' }))), k.ui.speakBtn ? k.ui.speakBtn(d.quiz.question_ml || d.quiz.question) : null) }) : null,
      k.ui.section(k.t('Message history', 'സന്ദേശ ചരിത്രം'), k.h('div', { class: 'channels-thread' }, [...d.inbox.slice(0, 20).reverse().map((m) => k.h('div', { class: 'channels-msg' + (/[ഀ-ൿ]/.test(m.message) ? ' ml' : '') }, m.message, k.h('div', { class: 'meta' }, `${chIcon[m.channel] || ''} ${m.channel} · ${ago(m.at)}${m.to_relation === 'guardian' ? ' · ' + k.t('to guardian', 'രക്ഷിതാവിന്') : ''}`))),
        ...d.inbound.slice(0, 5).map((m) => k.h('div', { class: 'channels-msg out' }, m.body, k.h('div', { class: 'meta' }, ago(m.at))))])));
    paint();
  };
  sel.addEventListener('change', () => { st.idx = 0; st.mode = 'inbox'; load().catch((e) => k.toast(e.message, 'bad')); });
  await load();
}

export default { views: { home, phone } };
