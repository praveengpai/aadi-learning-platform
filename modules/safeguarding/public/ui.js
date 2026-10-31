// AADI — Safeguarding: browser views. No DOM work at import time.

const CSS = `
.safeguarding-calm{max-width:560px;margin:0 auto;padding:8px 4px 40px;text-align:center}
.safeguarding-calm h1{font-size:var(--step-2);color:var(--forest-ink);margin:.4em 0 .2em}
.safeguarding-calm .lead{font-size:1.12rem;color:var(--ink-2);margin:0 auto 20px;max-width:40ch}
.safeguarding-calm .halo{width:96px;height:96px;margin:10px auto 4px;border-radius:50%;display:grid;place-items:center;font-size:3rem;background:radial-gradient(circle,#e3eedb 0%,#f6f8f5 70%);animation:safeguarding-breathe 6s ease-in-out infinite}
@keyframes safeguarding-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@media (prefers-reduced-motion:reduce){.safeguarding-calm .halo{animation:none}}
.safeguarding-opts{display:grid;gap:14px;margin:8px 0 22px}
.safeguarding-opt{display:flex;align-items:center;gap:16px;width:100%;padding:18px 20px;min-height:76px;border-radius:20px;border:2px solid var(--line);background:var(--surface);font:inherit;font-size:1.18rem;font-weight:600;color:var(--forest-ink);cursor:pointer;text-align:left;transition:border-color .15s, background .15s}
.safeguarding-opt:hover,.safeguarding-opt:focus-visible{border-color:var(--forest-2);background:#f2f7f4}
.safeguarding-opt .ic{font-size:2.1rem;line-height:1}
.safeguarding-lines{display:grid;gap:10px;margin-top:8px;text-align:left}
.safeguarding-line{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:16px;background:var(--surface);border:1px solid var(--line);text-decoration:none;color:inherit}
.safeguarding-line .num{font-size:1.6rem;font-weight:700;color:var(--forest);min-width:72px}
.safeguarding-line .ic{font-size:1.6rem}
.safeguarding-note{font-size:var(--step--1);color:var(--ink-3);margin-top:20px}
.safeguarding-thanks{background:var(--leaf-soft);border-radius:20px;padding:22px;margin:10px 0 18px}
.safeguarding-thanks .ref{font-family:ui-monospace,monospace;font-size:1.2rem;letter-spacing:.15em;background:#fff;padding:4px 10px;border-radius:8px;display:inline-block;margin-top:6px}
.safeguarding-text{width:100%;min-height:96px;border-radius:14px;border:2px solid var(--line);padding:12px;font:inherit;font-size:1.05rem}
.safeguarding-sev{display:inline-block;padding:2px 10px;border-radius:999px;font-size:var(--step--1);font-weight:700}
.safeguarding-sev.critical{background:#7a1410;color:#fff}.safeguarding-sev.high{background:var(--bad-bg);color:var(--bad)}
.safeguarding-sev.medium{background:var(--warn-bg);color:var(--warn)}.safeguarding-sev.low{background:var(--info-bg);color:var(--info)}
.safeguarding-banner{display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:var(--r-m);background:#fff4e5;border:1px solid #f0d9b5;font-size:var(--step--1);margin-bottom:12px}
.safeguarding-timeline{list-style:none;padding:0;margin:0;border-left:3px solid var(--line)}
.safeguarding-timeline li{position:relative;padding:4px 0 12px 16px}
.safeguarding-timeline li::before{content:'';position:absolute;left:-8px;top:9px;width:13px;height:13px;border-radius:50%;background:var(--forest-2);border:2px solid #fff}
.safeguarding-excerpt{background:var(--paper);border-left:4px solid var(--warn);padding:10px 12px;border-radius:8px;white-space:pre-wrap}
.safeguarding-policy h3{margin-top:1.1em}
.safeguarding-dodont{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.safeguarding-dodont ul{padding-left:1.1em}.safeguarding-dodont li{margin:.4em 0}
`;
const setup = (k) => k.style(CSS, 'safeguarding-css');
const L = (k, o, f) => k.t(o[f], o[f + '_ml']);
const sev = (k, s) => k.h('span', { class: 'safeguarding-sev ' + s }, { critical: k.t('Critical', 'അതിഗുരുതരം'), high: k.t('High', 'ഉയർന്നത്'), medium: k.t('Medium', 'ഇടത്തരം'), low: k.t('Low', 'കുറഞ്ഞത്') }[s] || s);
const STATUS = (k) => ({ new: k.t('New', 'പുതിയത്'), triaged: k.t('Triaged', 'വിലയിരുത്തി'), in_progress: k.t('In progress', 'നടക്കുന്നു'), referred: k.t('Referred', 'കൈമാറി'), closed: k.t('Closed', 'അടച്ചു') });
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const pretty = (s) => String(s || '').replace(/_/g, ' ');

function helplines(k, lines) {
  return k.h('div', { class: 'safeguarding-lines' }, lines.map((h) => k.h('a', { class: 'safeguarding-line', href: 'tel:' + h.number, 'aria-label': `${L(k, h, 'label')} ${h.number}` },
    k.h('span', { class: 'ic', 'aria-hidden': 'true' }, h.icon), k.h('span', { class: 'num' }, h.number), k.h('span', null, k.h('b', null, L(k, h, 'label')), k.h('div', { class: 'small muted' }, L(k, h, 'note'))))));
}

// ---------- Help (learner / guardian) — calm, minimal ----------
async function help(el, k) {
  setup(k);
  let info;
  try { info = await k.api.get('/helplines'); } catch (_) { info = { helplines: [{ number: '1098', icon: '🧒', label: 'Childline', label_ml: 'ചൈൽഡ്‌ലൈൻ', note: '', note_ml: '' }, { number: '112', icon: '🚓', label: 'Police', label_ml: 'പോലീസ്', note: '', note_ml: '' }, { number: '181', icon: '👩', label: 'Women helpline', label_ml: 'വനിതാ ഹെൽപ്‌ലൈൻ', note: '', note_ml: '' }], help_options: [] }; }
  let me = { wards: [] };
  try { me = await k.api.get('/me'); } catch (_) { /* offline */ }
  const wrap = k.h('div', { class: 'safeguarding-calm' });
  el.append(wrap);
  const intro = k.t('You are safe to talk here. Only the Child Protection team will see this — not your teacher or centre.', 'ഇവിടെ സുരക്ഷിതമായി പറയാം. ചൈൽഡ് പ്രൊട്ടക്ഷൻ ടീം മാത്രമേ ഇത് കാണൂ — നിങ്ങളുടെ ടീച്ചറോ കേന്ദ്രമോ അല്ല.');

  function start() {
    wrap.replaceChildren(
      k.h('div', { class: 'halo', 'aria-hidden': 'true' }, '🫂'),
      k.h('h1', null, k.t('We are here for you', 'ഞങ്ങൾ നിങ്ങൾക്കൊപ്പമുണ്ട്')),
      k.h('p', { class: 'lead' }, intro, ' ', k.h('button', { class: 'btn ghost small', onclick: () => k.speak(intro), 'aria-label': k.t('Read aloud', 'വായിച്ചുകേൾക്കുക') }, '🔊')),
      k.h('div', { class: 'safeguarding-opts' }, (info.help_options || []).map((o) => k.h('button', { class: 'safeguarding-opt', onclick: () => detail(o) }, k.h('span', { class: 'ic', 'aria-hidden': 'true' }, o.icon), L(k, o, 'label')))),
      k.h('p', { class: 'small muted' }, k.t('In danger right now? Call:', 'ഇപ്പോൾ അപകടത്തിലാണോ? വിളിക്കൂ:')),
      helplines(k, info.helplines),
      k.h('p', { class: 'safeguarding-note' }, k.t('You are not in trouble. You can also talk to someone at the centre you trust.', 'നിങ്ങൾ കുഴപ്പത്തിലല്ല. കേന്ദ്രത്തിൽ വിശ്വസിക്കുന്ന ഒരാളോടും സംസാരിക്കാം.')));
  }

  function detail(opt) {
    const text = k.h('textarea', { class: 'safeguarding-text', placeholder: k.t('If you want, tell us a little. You can also leave this empty.', 'വേണമെങ്കിൽ കുറച്ച് പറയൂ. ശൂന്യമായി വിടാനും കഴിയും.'), 'aria-label': k.t('Message (optional)', 'സന്ദേശം (ഐച്ഛികം)') });
    let forWho = null;
    const who = me.wards && me.wards.length ? k.h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' } },
      k.h('span', { class: 'small muted' }, k.t('This is about:', 'ഇത് ആരെക്കുറിച്ച്:')),
      [{ id: null, name: k.t('Me', 'ഞാൻ') }, ...me.wards].map((w) => { const b = k.h('button', { class: 'btn small' + (w.id === forWho ? ' primary' : ' ghost'), onclick: () => { forWho = w.id; [...b.parentNode.querySelectorAll('button')].forEach((x) => x.classList.toggle('primary', x === b)); } }, w.name); return b; })) : null;
    const noCall = k.h('input', { type: 'checkbox' });
    wrap.replaceChildren(
      k.h('div', { class: 'halo', 'aria-hidden': 'true' }, opt.icon),
      k.h('h1', null, L(k, opt, 'label')),
      k.h('p', { class: 'lead' }, k.t('Thank you for being brave. Press "Send" and a trusted person will reach you.', 'ധൈര്യം കാണിച്ചതിന് നന്ദി. "അയയ്ക്കുക" അമർത്തൂ, വിശ്വസ്തനായ ഒരാൾ ബന്ധപ്പെടും.')),
      who, text,
      k.h('label', { class: 'small', style: { display: 'flex', gap: '8px', justifyContent: 'center', margin: '10px 0' } }, noCall, k.t('Please don\'t phone me — talk to me at the centre', 'ഫോൺ ചെയ്യരുത് — കേന്ദ്രത്തിൽ വെച്ച് സംസാരിക്കുക')),
      k.h('div', { class: 'row', style: { justifyContent: 'center', gap: '10px', marginTop: '6px' } },
        k.ui.button(k.t('Back', 'തിരികെ'), start, { tone: 'ghost' }),
        k.ui.button('💚 ' + k.t('Send', 'അയയ്ക്കുക'), async () => {
          const r = await k.api.post('/help', { kind: opt.kind, message: text.value, person_id: forWho || undefined, contact_ok: !noCall.checked });
          if (r && r.queued) return thanks({ reference: '…', queued: true, helplines: info.helplines });
          thanks(r);
        }, { tone: 'primary' })));
    text.focus();
  }

  function thanks(r) {
    const msg = r.queued ? k.t('Saved on this device. It will be sent as soon as there is a connection. If you are in danger now, please call 112 or 1098.', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു. കണക്ഷൻ വരുമ്പോൾ അയയ്ക്കും. ഇപ്പോൾ അപകടത്തിലാണെങ്കിൽ 112 / 1098 വിളിക്കൂ.') : k.t(r.message, r.message_ml);
    wrap.replaceChildren(
      k.h('div', { class: 'halo', 'aria-hidden': 'true' }, '💚'),
      k.h('div', { class: 'safeguarding-thanks', role: 'status' }, k.h('h1', { style: { margin: 0 } }, k.t('Thank you for telling us', 'പറഞ്ഞതിന് നന്ദി')), k.h('p', { style: { margin: '10px auto' } }, msg),
        r.queued ? null : k.h('div', null, k.h('span', { class: 'small muted' }, k.t('Your reference', 'നിങ്ങളുടെ റഫറൻസ്')), k.h('br'), k.h('span', { class: 'ref' }, r.reference))),
      helplines(k, r.helplines || info.helplines),
      k.h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '18px' } }, k.ui.button(k.t('Done', 'ശരി'), () => k.go('#/home'), { tone: 'ghost' })),
      k.h('p', { class: 'safeguarding-note' }, k.t('On a shared phone? Press Done — this page will not show what you wrote.', 'പൊതു ഫോണാണോ? "ശരി" അമർത്തൂ — നിങ്ങൾ എഴുതിയത് ഈ പേജ് കാണിക്കില്ല.')));
    k.speak(msg);
  }
  start();
}

// ---------- CPO: cases ----------
async function cases(el, k) {
  setup(k);
  if (k.params.id) return caseDetail(el, k, k.params.id);
  el.append(k.h('div', { class: 'safeguarding-banner' }, '🔒', k.t('Restricted. Visible only to the Child Protection Officer and platform steward. Every view is recorded in the audit log.', 'നിയന്ത്രിതം. CPO-യ്ക്കും പ്ലാറ്റ്ഫോം സ്റ്റ്യൂവാർഡിനും മാത്രം. ഓരോ കാഴ്ചയും ഓഡിറ്റ് ലോഗിൽ.')));
  const [sum, rows] = await Promise.all([k.api.get('/summary'), k.api.get('/cases')]);
  el.append(k.h('h2', null, '🛡️ ' + k.t('Child protection cases', 'സംരക്ഷണ കേസുകൾ')),
    k.ui.grid([k.ui.stat(k.t('Open', 'തുറന്നവ'), sum.open), k.ui.stat(k.t('New — needs triage', 'പുതിയത് — വിലയിരുത്തണം'), sum.new), k.ui.stat(k.t('Urgent open', 'അടിയന്തരം'), sum.urgent_open), k.ui.stat(k.t('Median time to triage', 'വിലയിരുത്താനുള്ള സമയം'), sum.median_triage_hours != null ? sum.median_triage_hours + ' h' : '—'), k.ui.stat(k.t('Held messages', 'തടഞ്ഞ സന്ദേശങ്ങൾ'), sum.held_messages)], 150));
  const show = (filterOpen) => k.ui.table([
    { key: 'case_no', label: k.t('Case', 'കേസ്'), render: (c) => k.h('span', { class: 'mono' }, c.case_no) },
    { key: 'severity', label: k.t('Severity', 'ഗൗരവം'), render: (c) => sev(k, c.severity) },
    { key: 'status', label: k.t('Status', 'നില'), render: (c) => k.ui.badge(STATUS(k)[c.status], c.status === 'new' ? 'bad' : c.status === 'closed' ? '' : 'info') },
    { key: 'category', label: k.t('Category', 'വിഭാഗം'), render: (c) => pretty(c.category) },
    { key: 'person_name', label: k.t('Learner', 'പഠിതാവ്'), render: (c) => (c.person_name ? `${c.person_name}${c.person_minor ? ' · ' + k.t('minor', 'കുട്ടി') : ''}` : '—') },
    { key: 'hamlet_name', label: k.t('Hamlet', 'ഊര്'), render: (c) => k.t(c.hamlet_name, c.hamlet_name_ml) || '—' },
    { key: 'source', label: k.t('Source', 'ഉറവിടം'), render: (c) => pretty(c.source) },
    { key: 'age_days', label: k.t('Age', 'ദിവസം'), render: (c) => c.age_days + 'd' },
  ], rows.filter((c) => (filterOpen ? c.status !== 'closed' : c.status === 'closed')), { onRow: (c) => k.go('#/m/safeguarding/cases?id=' + c.id), empty: k.t('No cases.', 'കേസുകളില്ല.') });
  el.append(k.ui.tabs([
    { id: 'open', label: k.t('Open', 'തുറന്നവ'), render: (t) => t.append(show(true)) },
    { id: 'closed', label: k.t('Closed', 'അടച്ചവ'), render: (t) => t.append(show(false)) },
    { id: 'register', label: k.t('Incident register', 'സംഭവ രജിസ്റ്റർ'), render: (t) => register(t, k) },
  ], 'open'));
}

async function register(t, k) {
  const r = await k.api.get('/register');
  t.append(k.h('p', { class: 'small muted' }, k.t('Anonymised register for reporting and governance — no names or descriptions.', 'റിപ്പോർട്ടിംഗിനുള്ള അജ്ഞാത രജിസ്റ്റർ — പേരോ വിവരണമോ ഇല്ല.')),
    k.ui.grid([k.ui.card({ title: k.t('By category', 'വിഭാഗം'), body: k.ui.bars(r.summary.by_category.map((x) => ({ label: pretty(x.key), value: x.n }))) }), k.ui.card({ title: k.t('By source', 'ഉറവിടം'), body: k.ui.bars(r.summary.by_source.map((x) => ({ label: pretty(x.key), value: x.n }))) })], 260),
    k.ui.table([{ key: 'case_no', label: '#' }, { key: 'created_at', label: k.t('Opened', 'തുറന്നത്'), render: (x) => fmt(x.created_at) }, { key: 'category', label: k.t('Category', 'വിഭാഗം'), render: (x) => pretty(x.category) }, { key: 'severity', label: k.t('Severity', 'ഗൗരവം'), render: (x) => sev(k, x.severity) }, { key: 'district', label: k.t('District', 'ജില്ല') }, { key: 'referrals', label: k.t('Referred to', 'കൈമാറിയത്'), render: (x) => (x.referrals || []).map(pretty).join(', ') || '—' }, { key: 'status', label: k.t('Status', 'നില'), render: (x) => STATUS(k)[x.status] }, { key: 'days_open', label: k.t('Days', 'ദിവസം') }], r.rows));
}

async function caseDetail(el, k, id) {
  const r = await k.api.get('/cases/' + id);
  const c = r.case;
  const O = r.options;
  el.append(k.h('div', { class: 'row', style: { alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, k.ui.button('← ' + k.t('Cases', 'കേസുകൾ'), () => k.go('#/m/safeguarding/cases'), { tone: 'ghost', small: true }),
    k.h('h2', { style: { margin: 0, flex: 1 } }, k.h('span', { class: 'mono' }, c.case_no), ' '), sev(k, c.severity), k.ui.badge(STATUS(k)[c.status], c.status === 'new' ? 'bad' : 'info')),
  k.h('div', { class: 'safeguarding-banner' }, '👁️', k.t('Your view of this case has been recorded.', 'ഈ കേസ് നിങ്ങൾ കണ്ടത് രേഖപ്പെടുത്തി.')));
  const left = k.h('div', { class: 'stack' });
  left.append(k.ui.card({ title: k.t('What was reported', 'റിപ്പോർട്ട് ചെയ്തത്'), body: [k.h('div', { class: 'safeguarding-excerpt' }, c.description || '—'),
    k.ui.kv([[k.t('Opened', 'തുറന്നത്'), fmt(c.created_at)], [k.t('Source', 'ഉറവിടം'), pretty(c.source) + (c.kind ? ` · ${pretty(c.kind)}` : '')], [k.t('Reported by', 'റിപ്പോർട്ട് ചെയ്തത്'), c.reporter_name ? `${c.reporter_name} (${c.reporter_role})` : pretty(c.reporter_role)], [k.t('Learner reference', 'പഠിതാവിന്റെ റഫറൻസ്'), k.h('span', { class: 'mono' }, c.ack_code)], [k.t('Category', 'വിഭാഗം'), pretty(c.category)], [k.t('Assigned', 'ചുമതല'), c.assigned_name || '—'], [k.t('Referrals', 'കൈമാറ്റം'), (c.referrals || []).map(pretty).join(', ') || '—']])] }));
  if (r.moderation) left.append(k.ui.card({ title: k.t('Held message', 'തടഞ്ഞ സന്ദേശം'), body: [k.h('div', { class: 'safeguarding-excerpt' }, r.moderation.excerpt), k.h('div', { class: 'small muted' }, (r.moderation.reasons || []).map(pretty).join(', '))] }));
  left.append(k.ui.card({ title: k.t('Actions log', 'നടപടി രേഖ'), body: k.h('ol', { class: 'safeguarding-timeline' }, r.actions.map((a) => k.h('li', null, k.h('b', null, pretty(a.action)), k.h('span', { class: 'small muted' }, ` · ${fmt(a.at)} · ${a.by_name}`), k.h('div', null, a.note)))) }));

  const right = k.h('div', { class: 'stack' });
  if (r.person) right.append(k.ui.card({ title: k.t('Learner', 'പഠിതാവ്'), body: k.ui.kv([[k.t('Name', 'പേര്'), r.person.name], [k.t('Age', 'വയസ്സ്'), r.person.age ?? '—'], [k.t('Class', 'ക്ലാസ്'), r.person.school_class || '—'], [k.t('Hamlet', 'ഊര്'), k.t(c.hamlet_name, c.hamlet_name_ml)], [k.t('Guardian', 'രക്ഷിതാവ്'), r.person.guardian ? `${r.person.guardian.name} (${r.person.guardian.relation || ''}) ${r.person.guardian.phone || ''}` : '—'], [k.t('Phone', 'ഫോൺ'), r.person.phone || '—'], [k.t('Earlier cases', 'മുൻ കേസുകൾ'), r.prior.length ? r.prior.map((p) => p.case_no).join(', ') : k.t('none', 'ഇല്ല')]]) }));
  if (c.status !== 'closed') {
    right.append(k.ui.card({ title: k.t('Triage', 'വിലയിരുത്തൽ'), body: k.ui.form([
      { name: 'severity', label: k.t('Severity', 'ഗൗരവം'), type: 'select', required: true, value: c.severity, options: O.severities },
      { name: 'category', label: k.t('Category', 'വിഭാഗം'), type: 'select', required: true, value: c.category, options: O.categories.map((x) => ({ value: x, label: pretty(x) })) },
      { name: 'assigned_to', label: k.t('Assign to', 'ചുമതല'), type: 'select', value: c.assigned_to, options: r.assignees.map((a) => ({ value: a.id, label: a.name })) },
      { name: 'note', label: k.t('Note', 'കുറിപ്പ്'), type: 'textarea' },
    ], async (v) => { await k.api.post(`/cases/${id}/triage`, v); k.toast(k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); k.refresh(); }, { submitLabel: k.t('Save triage', 'സേവ് ചെയ്യുക') }) }));
    right.append(k.ui.card({ title: k.t('Record an action', 'നടപടി രേഖപ്പെടുത്തുക'), body: k.ui.form([
      { name: 'action', label: k.t('Action', 'നടപടി'), type: 'select', required: true, options: ['note', 'contacted_learner', 'contacted_guardian', 'safety_plan', 'meeting', 'referral', 'follow_up'].map((x) => ({ value: x, label: pretty(x) })) },
      { name: 'referral', label: k.t('Referral to (if referral)', 'കൈമാറ്റം'), type: 'select', options: O.referrals.map((x) => ({ value: x, label: pretty(x) })) },
      { name: 'note', label: k.t('Facts only — what was done', 'വസ്തുതകൾ മാത്രം'), type: 'textarea', required: true },
    ], async (v) => { await k.api.post(`/cases/${id}/actions`, v); k.refresh(); }, { submitLabel: k.t('Add to log', 'ലോഗിൽ ചേർക്കുക') }) }));
    right.append(k.ui.card({ title: k.t('Close case', 'കേസ് അടയ്ക്കുക'), body: k.ui.form([
      { name: 'outcome', label: k.t('Outcome', 'ഫലം'), type: 'text', required: true, placeholder: k.t('e.g. Safety plan in place; no further concern', 'ഉദാ. സുരക്ഷാ പദ്ധതി; തുടർ ആശങ്കയില്ല') },
      { name: 'note', label: k.t('Closure note', 'കുറിപ്പ്'), type: 'textarea' },
    ], async (v) => { if (!(await k.ui.confirm(k.t('Close this case?', 'ഈ കേസ് അടയ്ക്കണോ?')))) return; await k.api.post(`/cases/${id}/close`, v); k.refresh(); }, { submitLabel: k.t('Close case', 'അടയ്ക്കുക') }) }));
  } else right.append(k.ui.card({ title: k.t('Closed', 'അടച്ചു'), body: [k.h('p', null, c.outcome), k.ui.button(k.t('Re-open', 'വീണ്ടും തുറക്കുക'), async () => { await k.api.post(`/cases/${id}/reopen`, { note: 'Re-opened' }); k.refresh(); }, { tone: 'ghost' })] }));
  el.append(k.ui.grid([left, right], 320));
}

// ---------- moderation ----------
async function moderation(el, k) {
  setup(k);
  el.append(k.h('h2', null, '🚦 ' + k.t('Moderation queue', 'മോഡറേഷൻ')), k.h('p', { class: 'muted small' }, k.t('Messages and posts held by the safety filter. Contact details are masked. Approve releases the item; reject keeps it hidden; escalate opens a case.', 'സുരക്ഷാ ഫിൽട്ടർ തടഞ്ഞ സന്ദേശങ്ങൾ. ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ മറച്ചിരിക്കുന്നു.')));
  const render = async (t, status) => {
    const rows = await k.api.get('/moderation?status=' + status);
    if (!rows.length) { t.append(k.ui.empty(k.t('Nothing waiting. 🌿', 'ഒന്നും കാത്തിരിക്കുന്നില്ല. 🌿'))); return; }
    for (const m of rows) {
      const note = k.h('input', { class: 'input', placeholder: k.t('Decision note (optional)', 'കുറിപ്പ് (ഐച്ഛികം)') });
      const act = (d, tone) => k.ui.button({ approve: '✅ ' + k.t('Approve', 'അനുവദിക്കുക'), reject: '🚫 ' + k.t('Reject', 'നിരസിക്കുക'), escalate: '🛡️ ' + k.t('Escalate to case', 'കേസാക്കുക') }[d], async () => { await k.api.post(`/moderation/${m.id}/decide`, { decision: d, note: note.value }); k.toast(k.t('Decision recorded', 'തീരുമാനം രേഖപ്പെടുത്തി'), 'good'); k.refresh(); }, { tone, small: true });
      t.append(k.ui.card({ title: `${pretty(m.source_module)} · ${pretty(m.source_type)}`, subtitle: `${fmt(m.created_at)} · ${m.author_name || pretty(m.author_role) || '—'} → ${m.target_name || '—'}${m.target_minor ? ' (' + k.t('minor', 'കുട്ടി') + ')' : ''}`,
        body: [k.h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px', flexWrap: 'wrap' } }, sev(k, m.severity), (m.reason_labels || []).map((r) => k.ui.badge(L(k, r, 'label'), 'warn'))), k.h('div', { class: 'safeguarding-excerpt' }, m.excerpt), m.case_id ? k.h('p', { class: 'small' }, k.h('a', { href: '#/m/safeguarding/cases?id=' + m.case_id }, k.t('Linked case →', 'ബന്ധപ്പെട്ട കേസ് →'))) : null, m.decided_by_name ? k.h('p', { class: 'small muted' }, `${m.status} · ${m.decided_by_name} · ${fmt(m.decided_at)}`) : null],
        actions: m.status === 'held' ? [note, act('approve', 'ghost'), act('reject', 'danger'), act('escalate', 'primary')] : null }));
    }
  };
  el.append(k.ui.tabs([{ id: 'held', label: k.t('Held', 'തടഞ്ഞവ'), render: (t) => render(t, 'held') }, { id: 'all', label: k.t('All decisions', 'എല്ലാം'), render: (t) => render(t, 'all') }], 'held'));
}

// ---------- staff: report a concern ----------
async function concern(el, k) {
  setup(k);
  let person = null;
  const picked = k.h('div', { class: 'small' });
  el.append(k.h('h2', null, '📣 ' + k.t('Report a concern', 'ആശങ്ക അറിയിക്കുക')),
    k.h('div', { class: 'safeguarding-banner' }, '🚨', k.t('If a child is in immediate danger, call 112 first. Do not investigate or confront anyone yourself. This goes only to the Child Protection Officer.', 'കുട്ടി ഉടൻ അപകടത്തിലാണെങ്കിൽ ആദ്യം 112 വിളിക്കുക. സ്വയം അന്വേഷിക്കരുത്. ഇത് CPO-യ്ക്ക് മാത്രം പോകും.')),
    k.ui.grid([
      k.ui.card({ title: k.t('1. Who is it about? (optional)', '1. ആരെക്കുറിച്ച്? (ഐച്ഛികം)'), body: [picked, k.ui.personPicker({ onPick: (p) => { person = p; picked.replaceChildren('✔ ' + p.name); } })] }),
      k.ui.card({ title: k.t('2. What did you see or hear?', '2. എന്ത് കണ്ടു / കേട്ടു?'), body: k.ui.form([
        { name: 'category', label: k.t('Type of concern', 'ആശങ്കയുടെ തരം'), type: 'select', required: true, options: ['bullying', 'online_harassment', 'unsafe_at_home', 'unsafe_in_community', 'adult_conduct', 'exploitation_risk', 'wellbeing', 'boundary_breach', 'other'].map((x) => ({ value: x, label: pretty(x) })) },
        { name: 'description', label: k.t('Facts, in the learner\'s own words, with date and time', 'വസ്തുതകൾ, പഠിതാവിന്റെ വാക്കുകളിൽ, തീയതിയും സമയവും'), type: 'textarea', required: true },
        { name: 'urgent', label: k.t('This is urgent', 'ഇത് അടിയന്തരമാണ്'), type: 'checkbox' },
      ], async (v) => {
        const r = await k.api.post('/concerns', { ...v, person_id: person ? person.id : undefined });
        el.replaceChildren(k.ui.card({ tone: 'good', title: '✅ ' + k.t('Sent to the Child Protection Officer', 'CPO-യ്ക്ക് അയച്ചു'), body: [k.h('p', null, r.queued ? k.t('Saved; it will be sent when online.', 'സൂക്ഷിച്ചു; ഓൺലൈനാകുമ്പോൾ അയയ്ക്കും.') : r.note), r.reference ? k.h('p', null, k.t('Reference: ', 'റഫറൻസ്: '), k.h('b', { class: 'mono' }, r.reference)) : null, k.h('p', { class: 'small muted' }, k.t('For confidentiality you will not be able to view the case. The CPO may contact you.', 'രഹസ്യാത്മകതയ്ക്കായി കേസ് നിങ്ങൾക്ക് കാണാനാവില്ല. CPO ബന്ധപ്പെട്ടേക്കാം.'))] }));
      }, { submitLabel: k.t('Send to CPO', 'CPO-യ്ക്ക് അയയ്ക്കുക') }) }),
    ], 300));
}

// ---------- training ----------
async function training(el, k) {
  setup(k);
  const [me, course] = await Promise.all([k.api.get('/training/me'), k.api.get('/training/course')]);
  el.append(k.h('h2', null, '🎓 ' + L(k, course, 'title')),
    k.ui.card({ tone: me.trained ? 'good' : 'warn', title: me.trained ? '✅ ' + k.t('You are trained', 'പരിശീലനം പൂർത്തിയായി') : '⏳ ' + k.t('Training needed', 'പരിശീലനം ആവശ്യം'), body: me.trained ? k.t(`Valid until ${new Date(me.expires_at).toLocaleDateString('en-IN')}. Refresh every year.`, `${new Date(me.expires_at).toLocaleDateString('en-IN')} വരെ സാധു. എല്ലാ വർഷവും പുതുക്കുക.`) : k.t('Complete the four short units and pass the quiz (5 of 6).', 'നാല് ചെറിയ ഭാഗങ്ങൾ പൂർത്തിയാക്കി ക്വിസ് പാസാകുക (6-ൽ 5).') }));
  const tabs = [{ id: 'course', label: k.t('Course', 'കോഴ്സ്'), render: (t) => {
    for (const u of course.units) {
      const pts = k.lang === 'ml' ? u.points_ml : u.points;
      t.append(k.ui.card({ title: u.icon + ' ' + L(k, u, 'h'), body: [k.h('ul', null, pts.map((p) => k.h('li', null, p))), k.h('button', { class: 'btn ghost small', onclick: () => k.speak(pts.join(' ')) }, '🔊')] }));
    }
    const ans = [];
    const qbox = k.h('div');
    course.quiz.forEach((q, i) => {
      const opts = k.lang === 'ml' ? q.options_ml : q.options;
      qbox.append(k.h('fieldset', { style: { border: '1px solid var(--line)', borderRadius: '10px', margin: '10px 0', padding: '10px 12px' } }, k.h('legend', null, `${i + 1}. ${L(k, q, 'q')}`),
        opts.map((o, j) => k.h('label', { style: { display: 'block', padding: '6px 0' } }, k.h('input', { type: 'radio', name: 'sgq' + i, onchange: () => (ans[i] = j) }), ' ', o))));
    });
    const out = k.h('div');
    t.append(k.ui.card({ title: '✅ ' + k.t('Quiz', 'ക്വിസ്'), body: [qbox, k.ui.button(k.t('Submit', 'സമർപ്പിക്കുക'), async () => {
      const r = await k.api.post('/training/submit', { answers: ans });
      out.replaceChildren(k.ui.card({ tone: r.passed ? 'good' : 'warn', title: r.passed ? '🎉 ' + k.t(`Passed ${r.score}/${r.total}`, `പാസായി ${r.score}/${r.total}`) : k.t(`Score ${r.score}/${r.total} — please review and try again`, `സ്കോർ ${r.score}/${r.total} — വീണ്ടും ശ്രമിക്കുക`), body: r.passed ? k.t('Your agency admin or the CPO can now activate your account for child-facing work.', 'കുട്ടികളുമായുള്ള ജോലിക്ക് നിങ്ങളുടെ അക്കൗണ്ട് ഏജൻസി അഡ്മിൻ / CPO-യ്ക്ക് സജീവമാക്കാം.') : null }));
    }, { tone: 'primary' }), out] }));
  } }];
  if (['cpo', 'platform_admin', 'agency_admin'].includes(k.user.role)) tabs.push({ id: 'staff', label: k.t('Staff status', 'ജീവനക്കാരുടെ നില'), render: async (t) => {
    const rows = await k.api.get('/training/staff');
    t.append(k.h('p', { class: 'small muted' }, k.t(`Passing here records training in ${k.brand.short}. To activate an account, use Users → "Mark safeguarding-trained" (core).`, 'അക്കൗണ്ട് സജീവമാക്കാൻ Users → "Mark safeguarding-trained" ഉപയോഗിക്കുക.')),
      k.ui.table([{ key: 'display_name', label: k.t('Name', 'പേര്') }, { key: 'role', label: k.t('Role', 'റോൾ') }, { key: 'agency', label: k.t('Agency', 'ഏജൻസി') },
        { key: 'module_trained', label: k.t('Course', 'കോഴ്സ്'), render: (u) => k.ui.badge(u.module_trained ? '✅ ' + new Date(u.expires_at).toLocaleDateString('en-IN') : k.t('Not done', 'ചെയ്തിട്ടില്ല'), u.module_trained ? 'good' : 'bad') },
        { key: 'active', label: k.t('Account', 'അക്കൗണ്ട്'), render: (u) => (u.active ? k.t('Active', 'സജീവം') : k.t('Inactive', 'നിഷ്ക്രിയം')) },
        { key: 'act', label: '', render: (u) => (u.module_trained && !u.core_flag ? k.ui.button(k.t('Activate', 'സജീവമാക്കുക'), async () => { await k.core.post(`/users/${u.id}/safeguarding-trained`, {}); k.toast(k.t('Activated', 'സജീവമാക്കി'), 'good'); k.refresh(); }, { small: true }) : '') }], rows));
  } });
  el.append(k.ui.tabs(tabs, 'course'));
}

// ---------- policy ----------
async function policy(el, k) {
  setup(k);
  const r = await k.api.get('/policy');
  const P = r.policy, CC = r.code_of_conduct;
  el.append(k.h('div', { class: 'safeguarding-policy' }, k.h('h2', null, '📘 ' + L(k, P, 'title')),
    P.sections.map((s) => [k.h('h3', null, L(k, s, 'h')), k.h('p', null, L(k, s, 'p'), ' ', k.h('button', { class: 'btn ghost small', onclick: () => k.speak(L(k, s, 'p')) }, '🔊'))]),
    k.h('h2', { style: { marginTop: '1.4em' } }, L(k, CC, 'title')),
    k.h('div', { class: 'safeguarding-dodont' },
      k.ui.card({ title: '✅ ' + k.t('Always', 'എപ്പോഴും'), tone: 'good', body: k.h('ul', null, CC.do.map(([en, ml]) => k.h('li', null, k.t(en, ml)))) }),
      k.ui.card({ title: '🚫 ' + k.t('Never', 'ഒരിക്കലും'), tone: 'bad', body: k.h('ul', null, CC.dont.map(([en, ml]) => k.h('li', null, k.t(en, ml)))) })),
    k.h('h3', null, k.t('Helplines', 'ഹെൽപ്‌ലൈനുകൾ')), helplines(k, r.helplines)));
}

export default { views: { home: help, help, cases, moderation, concern, training, policy } };
