// Health & Elder Screening — browser views (plain ES module, no DOM work at import time).
// Screening and referral support only. Every screen shows the disclaimer.

const CSS = `
.health-disc{display:flex;gap:10px;align-items:flex-start;background:var(--bad-bg,#fbe3e1);border:1px solid #f1c3bf;border-radius:var(--r-m,10px);padding:10px 12px;margin:0 0 14px;font-size:.92rem}
.health-disc b{color:var(--bad,#b3261e)}
.health-quick{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.health-qbtn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px;border-radius:var(--r-m,10px);border:2px solid var(--line,#d7e0db);background:var(--surface,#fff);font:inherit;color:inherit;text-align:left;cursor:pointer;min-height:76px}
.health-qbtn:hover{border-color:var(--forest-2,#0e6455)}
.health-qbtn .ic{font-size:1.6rem}
.health-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--line,#d7e0db)}
.health-row:last-child{border-bottom:0}
.health-row .who{min-width:0;flex:1 1 180px}
.health-row .who b{display:block}
.health-tl{list-style:none;margin:0;padding:0;border-left:3px solid var(--line,#d7e0db)}
.health-tl li{position:relative;padding:0 0 14px 16px}
.health-tl li::before{content:'';position:absolute;left:-8px;top:4px;width:13px;height:13px;border-radius:50%;background:var(--surface,#fff);border:3px solid var(--forest-2,#0e6455)}
.health-tl li.p3::before{border-color:var(--bad,#b3261e)}
.health-tl li.p2::before,.health-tl li.p1::before{border-color:var(--warn,#9a6a00)}
.health-ans{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.88rem;color:var(--ink-2,#3a4a45);margin:4px 0}
.health-reply{background:var(--leaf-soft,#eef6f2);border-radius:var(--r-m,10px);padding:10px 12px;margin-top:6px}
.health-fam{font-size:1.08rem;line-height:1.55}
.health-fam .health-reply{font-size:1.12rem}
.health-tpl{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}
.health-tpl button{border:1px solid var(--line,#d7e0db);background:var(--paper,#f7f5ef);border-radius:999px;padding:6px 12px;font:inherit;font-size:.86rem;cursor:pointer;min-height:36px}
.health-tpl button.on{background:var(--forest,#0b4f45);color:#fff;border-color:var(--forest,#0b4f45)}
.health-weeks{display:flex;gap:6px;flex-wrap:wrap}
.health-weeks button{min-width:48px;min-height:40px;border:1px solid var(--line,#d7e0db);background:var(--surface,#fff);border-radius:8px;font:inherit;cursor:pointer}
.health-weeks button.on{background:var(--forest,#0b4f45);color:#fff}
.health-agg td.n{text-align:right;font-variant-numeric:tabular-nums}
@media (max-width:420px){.health-quick{grid-template-columns:1fr 1fr}}
`;
const setup = (k) => k.style(CSS, 'health-css');
const ICON = { 'health.vitals': '🩺', 'health.child_growth': '🧒', 'health.antenatal': '🤰', 'health.elder_screen': '👵' };
const SHORT = { 'health.vitals': ['Vitals', 'വൈറ്റൽസ്'], 'health.child_growth': ['Child growth', 'കുട്ടിയുടെ വളർച്ച'], 'health.antenatal': ['Pregnancy', 'ഗർഭകാലം'], 'health.elder_screen': ['Elder screen', 'വയോജന പരിശോധന'] };
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
const tone = (lvl) => (lvl === 'urgent' ? 'bad' : lvl === 'warn' ? 'warn' : 'info');

function disclaimer(k, d) {
  const txt = d ? k.t(d.en, d.ml) : k.t('Screening and referral support only — not a diagnosis. In an emergency go to the nearest health facility or call 108 immediately.', 'പരിശോധനയ്ക്കും റഫറലിനും മാത്രമുള്ള സഹായം — രോഗനിർണയമല്ല. അടിയന്തര സാഹചര്യത്തിൽ ഉടൻ അടുത്തുള്ള ആരോഗ്യ കേന്ദ്രത്തിൽ പോകുക അല്ലെങ്കിൽ 108 വിളിക്കുക.');
  return k.h('div', { class: 'health-disc', role: 'note' }, k.h('span', { 'aria-hidden': 'true' }, '🚑'), k.h('div', { style: { flex: 1 } }, k.h('b', null, k.t('Not a diagnosis. ', 'രോഗനിർണയമല്ല. ')), txt), k.ui.speakBtn(txt));
}
function flagBadges(k, flags) { return (flags || []).map((f) => k.ui.badge(k.t(f.message, f.message_ml), tone(f.level))); }
function prioBadge(k, p) { return p >= 3 ? k.ui.badge(k.t('Urgent', 'അടിയന്തരം'), 'bad') : p === 2 ? k.ui.badge(k.t('High', 'ഉയർന്നത്'), 'warn') : p === 1 ? k.ui.badge(k.t('Soon', 'ഉടൻ'), 'warn') : null; }
function personLine(k, p) { if (!p) return ''; const g = p.gender === 'F' ? k.t('F', 'സ്ത്രീ') : p.gender === 'M' ? k.t('M', 'പുരുഷൻ') : ''; return `${p.name}${p.age !== null && p.age !== undefined ? ' · ' + p.age + k.t(' y', ' വയസ്സ്') : ''}${g ? ' · ' + g : ''}`; }

// Short answer summary for staff (no photos inline in lists).
function answerSummary(k, s) {
  const a = s.answers || {};
  const bits = [];
  if (a.bp_sys) bits.push(`BP ${a.bp_sys}/${a.bp_dia || '?'}`);
  if (a.pulse) bits.push(`${k.t('Pulse', 'നാഡി')} ${a.pulse}`);
  if (a.temp_c) bits.push(`${a.temp_c} °C`);
  if (a.sugar) bits.push(`${k.t('Sugar', 'പഞ്ചസാര')} ${a.sugar} (${a.sugar_type === 'fasting' ? k.t('fasting', 'വെറുംവയർ') : k.t('random', 'ഏതുസമയം')})`);
  if (a.weight_kg) bits.push(`${a.weight_kg} kg`);
  if (a.muac_cm) bits.push(`MUAC ${a.muac_cm} cm`);
  if (a.age_months !== undefined) bits.push(`${a.age_months} ${k.t('months', 'മാസം')}`);
  if (a.weeks) bits.push(`${a.weeks} ${k.t('weeks', 'ആഴ്ച')}`);
  if (a.hb) bits.push(`Hb ${a.hb}`);
  if (a.recall !== undefined) bits.push(`${k.t('Recall', 'ഓർമ്മ')} ${a.recall}/3`);
  if (a.phq_interest !== undefined) bits.push(`PHQ-2 ${Number(a.phq_interest) + Number(a.phq_mood || 0)}`);
  if (a.medicines !== undefined) bits.push(`${a.medicines} ${k.t('medicines', 'മരുന്നുകൾ')}`);
  if (Array.isArray(a.symptoms) && a.symptoms.length) bits.push(a.symptoms.join(', '));
  if (a.photo) bits.push('📷');
  return k.h('div', { class: 'health-ans' }, bits.map((b) => k.h('span', null, b)));
}

// Opens a form for one person in a modal (k.ui.formFill works offline and dedups via client_ref).
async function capture(k, key, person, after) {
  let def;
  try { def = await k.core.get('/forms/defs/' + encodeURIComponent(key)); } catch (e) { k.toast(e.message, 'bad'); return; }
  const box = k.h('div', null, disclaimer(k), k.h('p', { class: 'small muted' }, personLine(k, person)));
  const m = k.ui.modal(k.t(def.title, def.title_ml), box);
  box.append(k.ui.formFill(def, {
    person_id: person.id,
    submitLabel: k.t('Save and send to doctor', 'സേവ് ചെയ്ത് ഡോക്ടർക്ക് അയയ്ക്കുക'),
    onDone: (r) => {
      if (r && r.queued) { box.replaceChildren(k.ui.card({ title: k.t('Saved on this device', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു'), body: k.t('It goes to the doctor automatically when the hub connects.', 'ഹബ് ബന്ധപ്പെടുമ്പോൾ തനിയെ ഡോക്ടർക്ക് പോകും.'), tone: 'warn', actions: [k.ui.button(k.t('Close', 'അടയ്ക്കുക'), () => m.close())] })); return; }
      const urgent = (r.flags || []).some((f) => f.level === 'urgent');
      const msg = urgent ? k.t('URGENT: follow the advice on the red flags now — do not wait for the doctor\'s reply. Call 108 if the person is very unwell.', 'അടിയന്തരം: ചുവപ്പ് മുന്നറിയിപ്പിലെ നിർദ്ദേശം ഇപ്പോൾതന്നെ പാലിക്കുക — ഡോക്ടറുടെ മറുപടിക്ക് കാത്തിരിക്കരുത്. വളരെ അസുഖമെങ്കിൽ 108 വിളിക്കുക.') : k.t('Sent to the doctor. The reply comes back on a later visit.', 'ഡോക്ടർക്ക് അയച്ചു. മറുപടി അടുത്ത സന്ദർശനങ്ങളിൽ വരും.');
      box.replaceChildren(k.ui.card({ title: k.t('Saved', 'സേവ് ചെയ്തു'), tone: urgent ? 'bad' : 'good', body: [k.h('p', null, msg), k.h('div', { class: 'stack' }, flagBadges(k, r.flags))], actions: [k.ui.speakBtn(msg), k.ui.button(k.t('Close', 'അടയ്ക്കുക'), () => { m.close(); after && after(); }, { tone: 'primary' })] }));
      k.speak(msg);
    },
  }));
}

function quickButtons(k, person, keys, after) {
  return k.h('div', { class: 'health-quick' }, keys.map((key) => k.h('button', { class: 'health-qbtn', type: 'button', onclick: () => capture(k, key, person, after) }, k.h('span', { class: 'ic', 'aria-hidden': 'true' }, ICON[key]), k.h('b', null, k.t(...SHORT[key])))));
}

// ======================================================================= views
export default {
  views: {
    // ---------------- ASHA home: who to see today ----------------
    home: async (el, k) => {
      setup(k);
      const { t, h, ui } = k;
      let d;
      try { d = await k.api.get('/home'); } catch (e) { el.append(ui.error(e)); return; }
      el.append(h('h2', null, '🩺 ' + t('Health visit today', 'ഇന്നത്തെ ആരോഗ്യ സന്ദർശനം')), disclaimer(k, d.disclaimer));
      if (d._offline) el.append(h('p', { class: 'small muted' }, t('Offline — showing what was saved on this device.', 'ഓഫ്‌ലൈൻ — ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചവ കാണിക്കുന്നു.')));
      el.append(ui.grid([
        ui.stat(t('Visits due this week', 'ഈ ആഴ്ച കാണേണ്ടവർ'), d.due.length, d.later ? t(`${d.later} later`, `${d.later} പിന്നീട്`) : ''),
        ui.stat(t('Doctor replies to pass on', 'കുടുംബത്തെ അറിയിക്കേണ്ട മറുപടികൾ'), d.to_tell.length),
        ui.stat(t('Waiting for the doctor', 'ഡോക്ടറുടെ മറുപടി കാത്ത്'), d.waiting_for_doctor),
      ], 160));

      // Due follow-ups
      const due = h('div');
      for (const f of d.due) {
        due.append(h('div', { class: 'health-row' },
          h('div', { class: 'who' }, h('b', null, personLine(k, f.person)), h('span', { class: 'small' }, t(f.reason, f.reason_ml)), ' ', f.overdue ? ui.badge(t('Overdue', 'വൈകി'), 'bad') : ui.badge(t('Due', 'തീയതി') + ' ' + day(f.due), 'info')),
          h('div', { class: 'row' },
            ui.button(t('Open record', 'രേഖ തുറക്കുക'), () => k.go('#/m/health/person?id=' + f.person_id), { small: true, tone: 'ghost' }),
            ui.button(t('Visited ✓', 'സന്ദർശിച്ചു ✓'), async () => { await k.api.post('/followups/' + f.id + '/done', {}); k.toast(t('Marked done', 'പൂർത്തിയായി'), 'good'); k.refresh(); }, { small: true }))));
      }
      el.append(ui.section('📅 ' + t('Who to see (follow-ups due)', 'ആരെ കാണണം (തുടർ സന്ദർശനം)'), d.due.length ? due : ui.empty(t('No follow-ups due this week.', 'ഈ ആഴ്ച തുടർ സന്ദർശനങ്ങളില്ല.'))));

      // Replies to pass on
      const tell = h('div');
      for (const s of d.to_tell) {
        const words = t(s.reply, s.reply_ml || s.reply);
        tell.append(h('div', { class: 'health-row' },
          h('div', { class: 'who' }, h('b', null, personLine(k, s.person)), h('span', { class: 'small muted' }, t(s.form_title, s.form_title_ml) + ' · ' + day(s.captured_at)), h('div', { class: 'health-reply' }, words)),
          h('div', { class: 'row' }, ui.speakBtn(words), ui.button(t('Told the family ✓', 'കുടുംബത്തെ അറിയിച്ചു ✓'), async () => { await k.core.post('/forms/submissions/' + s.id + '/seen'); k.toast(t('Thank you', 'നന്ദി'), 'good'); k.refresh(); }, { small: true, tone: 'primary' }))));
      }
      el.append(ui.section('💬 ' + t('Doctor\'s advice to pass on', 'കുടുംബത്തെ അറിയിക്കേണ്ട ഡോക്ടറുടെ ഉപദേശം'), d.to_tell.length ? tell : ui.empty(t('Nothing new from the doctor.', 'ഡോക്ടറിൽ നിന്ന് പുതിയതൊന്നുമില്ല.'))));

      // Quick capture: pick a person
      const pick = h('div');
      const list = h('div');
      const search = h('input', { class: 'input', placeholder: t('Search a name', 'പേര് തിരയുക'), oninput: () => { clearTimeout(search._t); search._t = setTimeout(load, 250); } });
      async function load() {
        list.replaceChildren(ui.loading());
        try {
          const ppl = await k.api.get('/people?q=' + encodeURIComponent(search.value || ''));
          list.replaceChildren(...(ppl.length ? ppl.slice(0, 40).map((p) => h('div', { class: 'health-row' },
            h('div', { class: 'who' }, h('b', null, personLine(k, p)), h('span', { class: 'small muted' }, p.last_check ? t('Last check ', 'അവസാന പരിശോധന ') + day(p.last_check) : t('Not checked yet', 'ഇതുവരെ പരിശോധിച്ചിട്ടില്ല')), ' ', prioBadge(k, p.last_priority)),
            h('div', { class: 'row' }, p.suggest.map((key) => ui.button(ICON[key] + ' ' + t(...SHORT[key]), () => capture(k, key, p, () => k.refresh()), { small: true })),
              ui.button(t('Record', 'രേഖ'), () => k.go('#/m/health/person?id=' + p.id), { small: true, tone: 'ghost' }))))
            : [ui.empty(t('No one with health consent matches. Record consent at the centre first.', 'ആരോഗ്യ സമ്മതമുള്ള ആരും പൊരുത്തപ്പെടുന്നില്ല. ആദ്യം സെന്ററിൽ സമ്മതം രേഖപ്പെടുത്തുക.'))]));
        } catch (e) { list.replaceChildren(ui.error(e)); }
      }
      pick.append(search, list);
      el.append(ui.section('➕ ' + t('Quick check — choose a person', 'പെട്ടെന്നുള്ള പരിശോധന — ആളെ തിരഞ്ഞെടുക്കുക'), pick));
      load();

      if (d.recent.length) el.append(ui.section('🕘 ' + t('Recently sent', 'അടുത്തിടെ അയച്ചവ'), d.recent.map((s) => h('div', { class: 'health-row' }, h('div', { class: 'who' }, h('b', null, personLine(k, s.person)), h('span', { class: 'small muted' }, t(s.form_title, s.form_title_ml) + ' · ' + day(s.captured_at)), answerSummary(k, s), h('div', { class: 'row' }, prioBadge(k, s.priority), s.reply ? ui.badge(t('Replied', 'മറുപടി ലഭിച്ചു'), 'good') : ui.badge(t('Waiting', 'കാത്തിരിക്കുന്നു'), 'info')))))));
    },

    // ---------------- person health record ----------------
    person: async (el, k) => {
      setup(k);
      const { t, h, ui } = k;
      let d;
      try { d = await k.api.get('/person/' + encodeURIComponent(k.params.id || '')); } catch (e) { el.append(ui.error(e)); return; }
      if (d.people) { renderFamily(el, k, d); return; }
      el.append(h('h2', null, '📋 ' + personLine(k, d.person)), disclaimer(k, d.disclaimer));
      if (['health_worker', 'platform_admin'].includes(k.user.role)) el.append(ui.section(t('New check', 'പുതിയ പരിശോധന'), quickButtons(k, d.person, d.suggest, () => k.refresh())));
      const open = d.followups.filter((f) => f.status === 'open');
      if (open.length) el.append(ui.section('📅 ' + t('Follow-ups', 'തുടർ സന്ദർശനം'), open.map((f) => h('div', { class: 'health-row' }, h('div', { class: 'who' }, t(f.reason, f.reason_ml), ' · ', f.overdue ? ui.badge(t('Overdue', 'വൈകി'), 'bad') : day(f.due)), ui.button(t('Done ✓', 'പൂർത്തിയായി ✓'), async () => { await k.api.post('/followups/' + f.id + '/done', {}); k.refresh(); }, { small: true })))));
      const tl = h('ul', { class: 'health-tl' });
      for (const s of d.submissions) {
        tl.append(h('li', { class: 'p' + (s.priority || 0) },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, ICON[s.form_key] + ' ' + t(s.form_title, s.form_title_ml)), h('span', { class: 'small muted' }, day(s.captured_at) + (s.captured_by_name ? ' · ' + s.captured_by_name : ''))),
          answerSummary(k, s), h('div', { class: 'row' }, prioBadge(k, s.priority), flagBadges(k, s.flags)),
          s.reply ? h('div', { class: 'health-reply' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, '👩‍⚕️ ' + (s.replied_by_name || t('Doctor', 'ഡോക്ടർ')) + ' · ' + day(s.replied_at)), ui.speakBtn(t(s.reply, s.reply_ml || s.reply))), t(s.reply, s.reply_ml || s.reply),
            !s.reply_seen_at && k.user.role === 'health_worker' ? h('div', null, ui.button(t('Told the family ✓', 'കുടുംബത്തെ അറിയിച്ചു ✓'), async () => { await k.core.post('/forms/submissions/' + s.id + '/seen'); k.refresh(); }, { small: true })) : null)
            : h('div', { class: 'small muted' }, t('Waiting for the doctor', 'ഡോക്ടറുടെ മറുപടി കാത്തിരിക്കുന്നു')),
          k.user.role !== 'health_worker' && !s.reply ? ui.button(t('Review', 'പരിശോധിക്കുക'), () => k.go('#/m/health/review?id=' + s.id), { small: true, tone: 'ghost' }) : null));
      }
      el.append(ui.section('🕘 ' + t('Health timeline', 'ആരോഗ്യ ചരിത്രം'), d.submissions.length ? tl : ui.empty(t('No checks yet.', 'ഇതുവരെ പരിശോധനകളില്ല.'))));
    },

    // ---------------- doctor queue ----------------
    queue: async (el, k) => {
      setup(k);
      const { t, h, ui } = k;
      let d;
      try { d = await k.api.get('/queue'); } catch (e) { el.append(ui.error(e)); return; }
      el.append(h('h2', null, '👩‍⚕️ ' + t('Doctor review queue', 'ഡോക്ടർ പരിശോധനാ നിര')), disclaimer(k, d.disclaimer));
      el.append(ui.grid([ui.stat(t('Urgent', 'അടിയന്തരം'), d.counts.urgent), ui.stat(t('High', 'ഉയർന്നത്'), d.counts.high), ui.stat(t('Waiting', 'കാത്തിരിക്കുന്നവ'), d.counts.total)], 140));
      if (!d.items.length) { el.append(ui.empty(t('Nothing waiting. 🎉', 'ഒന്നും കാത്തിരിക്കുന്നില്ല. 🎉'))); return; }
      for (const s of d.items) {
        el.append(ui.card({
          title: `${ICON[s.form_key] || ''} ${personLine(k, s.person)}`,
          subtitle: `${t(s.form_title, s.form_title_ml)} · ${t(s.hamlet || '', s.hamlet_ml)} · ${day(s.captured_at)}${s.captured_by_name ? ' · ' + s.captured_by_name : ''}`,
          tone: s.priority >= 3 ? 'bad' : s.priority >= 1 ? 'warn' : null,
          body: [h('div', { class: 'row' }, prioBadge(k, s.priority)), answerSummary(k, s), h('div', { class: 'stack' }, flagBadges(k, s.flags)), s.answers && s.answers.notes ? h('p', { class: 'small' }, '📝 ' + s.answers.notes) : null],
          actions: [ui.button(t('Review & reply', 'പരിശോധിച്ച് മറുപടി'), () => k.go('#/m/health/review?id=' + s.id), { tone: 'primary', small: true }), ui.button(t('Full record', 'മുഴുവൻ രേഖ'), () => k.go('#/m/health/person?id=' + s.person_id), { small: true, tone: 'ghost' })],
        }));
      }
    },

    // ---------------- doctor: one submission + reply form ----------------
    review: async (el, k) => {
      setup(k);
      const { t, h, ui } = k;
      let s;
      try { s = await k.api.get('/submissions/' + encodeURIComponent(k.params.id || '')); } catch (e) { el.append(ui.error(e)); return; }
      el.append(h('h2', null, `${ICON[s.form_key] || ''} ${personLine(k, s.person)}`), disclaimer(k));
      el.append(h('p', { class: 'muted' }, `${t(s.form_title, s.form_title_ml)} · ${t(s.hamlet || '', s.hamlet_ml)} · ${day(s.captured_at)} · ${s.captured_by_name || ''}`));
      el.append(h('div', { class: 'row' }, prioBadge(k, s.priority), flagBadges(k, s.flags)));
      const rows = [];
      for (const f of (s.form && s.form.fields) || []) {
        if (f.type === 'note' || !(f.name in s.answers)) continue;
        let v = s.answers[f.name];
        if (f.type === 'photo') v = h('img', { src: v, alt: t(f.label, f.label_ml), style: { maxWidth: '100%', width: '320px', borderRadius: '8px' } });
        else if (f.choices) { const lab = (x) => { const c = f.choices.find((c) => c.value === x); return c ? t(c.label, c.label_ml) : x; }; v = Array.isArray(v) ? v.map(lab).join(', ') : lab(v); }
        else if (f.type === 'yes_no') v = v === 'yes' ? t('Yes', 'അതെ') : t('No', 'ഇല്ല');
        else if (f.unit) v = v + ' ' + f.unit;
        rows.push([t(f.label, f.label_ml), v]);
      }
      el.append(ui.section(t('Answers', 'ഉത്തരങ്ങൾ'), ui.kv(rows)));
      if (s.reply) el.append(ui.section(t('Reply sent', 'അയച്ച മറുപടി'), h('div', { class: 'health-reply' }, t(s.reply, s.reply_ml || s.reply))));
      if (!s.can_reply) return;
      if (s.status === 'submitted') k.core.post('/forms/submissions/' + s.id + '/claim').catch(() => {});
      // Reply form: quick advice templates + follow-up weeks
      let tpl = null, weeks = null;
      const en = h('textarea', { class: 'input', rows: 4, placeholder: t('Advice in plain words (English)', 'ലളിതമായ ഭാഷയിൽ ഉപദേശം (ഇംഗ്ലീഷ്)') });
      const ml = h('textarea', { class: 'input', rows: 4, placeholder: t('Advice in Malayalam — shown to the family', 'മലയാളത്തിൽ ഉപദേശം — കുടുംബത്തിന് കാണിക്കും') });
      const tplBox = h('div', { class: 'health-tpl' });
      const wkBox = h('div', { class: 'health-weeks' });
      const setW = (w) => { weeks = w; [...wkBox.children].forEach((b) => b.classList.toggle('on', Number(b.dataset.w) === w)); };
      for (const w of [0, 1, 2, 4, 8, 12]) wkBox.append(h('button', { type: 'button', 'data-w': w, onclick: () => setW(w) }, w === 0 ? t('None', 'ഇല്ല') : w + t(' wk', ' ആഴ്ച')));
      for (const a of s.advice) tplBox.append(h('button', { type: 'button', onclick: (e) => { tpl = a.key; [...tplBox.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); en.value = a.text; ml.value = a.text_ml; setW(a.follow_up); } }, t(a.label, a.label_ml)));
      const close = h('input', { type: 'checkbox' });
      const out = h('div');
      el.append(ui.section('✍️ ' + t('Your reply', 'നിങ്ങളുടെ മറുപടി'), [
        h('p', { class: 'small muted' }, t('Write for the family: plain words, no diagnosis labels. Say what to do and when to come back.', 'കുടുംബത്തിനായി എഴുതുക: ലളിതമായ വാക്കുകൾ, രോഗനിർണയ ലേബലുകൾ വേണ്ട. എന്തു ചെയ്യണം, എപ്പോൾ തിരികെ വരണം എന്ന് പറയുക.')),
        h('b', null, t('Quick advice', 'പെട്ടെന്നുള്ള ഉപദേശം')), tplBox,
        h('label', null, t('Advice (English)', 'ഉപദേശം (ഇംഗ്ലീഷ്)'), en), h('label', null, t('Advice (Malayalam)', 'ഉപദേശം (മലയാളം)'), ml),
        h('b', null, t('ASHA to follow up in', 'ആശ തുടർ സന്ദർശനം')), wkBox,
        h('label', { class: 'cb' }, close, t('Close the case after this reply', 'ഈ മറുപടിക്ക് ശേഷം കേസ് അവസാനിപ്പിക്കുക')),
        h('div', { class: 'row' }, ui.button(t('Send reply', 'മറുപടി അയയ്ക്കുക'), async () => {
          try {
            const r = await k.api.post('/submissions/' + s.id + '/reply', { reply: en.value, reply_ml: ml.value, advice_template: tpl, follow_up_weeks: weeks, close: close.checked });
            k.toast(r.queued ? t('Saved offline — will send when connected.', 'ഓഫ്‌ലൈനായി സൂക്ഷിച്ചു.') : t('Reply sent. It reaches the hamlet on the next visit.', 'മറുപടി അയച്ചു. അടുത്ത സന്ദർശനത്തിൽ ഊരിലെത്തും.'), 'good');
            k.go('#/m/health/queue');
          } catch (e) { out.replaceChildren(ui.error(e)); }
        }, { tone: 'primary' })), out,
      ]));
    },

    // ---------------- family view (person themself or guardian) ----------------
    family: async (el, k) => {
      setup(k);
      let d;
      try { d = await k.api.get('/family'); } catch (e) { el.append(k.ui.error(e)); return; }
      renderFamily(el, k, d);
    },

    // ---------------- aggregate (donors / govt / admins) ----------------
    aggregate: async (el, k) => {
      setup(k);
      const { t, h, ui } = k;
      let d;
      try { d = await k.api.get('/aggregate'); } catch (e) { el.append(ui.error(e)); return; }
      el.append(h('h2', null, '📊 ' + t('Health screening overview', 'ആരോഗ്യ പരിശോധന — അവലോകനം')), disclaimer(k, d.disclaimer));
      el.append(h('p', { class: 'muted small' }, t(`Since ${d.since}. Counts only — numbers under ${d.k_anon} are hidden so no family can be identified.`, `${d.since} മുതൽ. എണ്ണം മാത്രം — ഒരു കുടുംബത്തെയും തിരിച്ചറിയാതിരിക്കാൻ ${d.k_anon}-ൽ താഴെയുള്ള എണ്ണങ്ങൾ മറച്ചിരിക്കുന്നു.`)));
      const T = d.totals;
      el.append(ui.grid([
        ui.stat(t('People screened', 'പരിശോധിച്ചവർ'), T.people_screened),
        ui.stat(t('Checks done', 'പരിശോധനകൾ'), T.checks),
        ui.stat(t('Referred / flagged', 'റഫർ ചെയ്തവർ'), T.flagged, T.pct_flagged !== null ? T.pct_flagged + '%' : ''),
        ui.stat(t('Follow-ups completed', 'പൂർത്തിയായ തുടർ സന്ദർശനം'), T.followups_done, t('of ', 'ആകെ ') + T.followups),
      ], 160));
      const numeric = Object.entries(T.by_form).filter(([, v]) => typeof v === 'number');
      if (numeric.length) el.append(ui.section(t('Checks by type', 'തരം അനുസരിച്ച്'), ui.bars(numeric.map(([key, v]) => ({ label: t(...SHORT[key]), value: v })))));
      el.append(ui.section(t('By hamlet', 'ഊര് അനുസരിച്ച്'), h('div', { class: 'health-agg' }, ui.table([
        { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (r) => t(r.hamlet, r.hamlet_ml) },
        { key: 'people_screened', label: t('Screened', 'പരിശോധിച്ചവർ') },
        { key: 'checks', label: t('Checks', 'പരിശോധനകൾ') },
        { key: 'flagged', label: t('Flagged', 'റഫർ') },
        { key: 'pct', label: '%', render: (r) => (r.pct_flagged === null ? '—' : r.pct_flagged + '%') },
        { key: 'urgent', label: t('Urgent', 'അടിയന്തരം') },
      ], d.hamlets, { empty: t('No screening yet.', 'ഇതുവരെ പരിശോധനയില്ല.') }))));
      el.append(h('p', { class: 'small muted' }, t(d.note, 'ആളുകളുടെയും പരിശോധനകളുടെയും എണ്ണം മാത്രം. 5-ൽ താഴെയുള്ള എണ്ണങ്ങൾ മറച്ചിരിക്കുന്നു.')));
    },
  },
};

function renderFamily(el, k, d) {
  const { t, h, ui } = k;
  el.append(h('h2', null, '💚 ' + t('Health advice for my family', 'കുടുംബത്തിനുള്ള ആരോഗ്യ ഉപദേശം')), disclaimer(k, d.disclaimer));
  const wrap = h('div', { class: 'health-fam stack' });
  let any = false;
  for (const p of d.people) {
    const items = p.items.filter((x) => x.reply || x.waiting);
    if (!items.length) continue;
    any = true;
    const cards = items.map((x) => {
      if (!x.reply) return ui.card({ title: t(x.title, x.title_ml) + ' · ' + day(x.checked_on), body: t('The health team is looking at this. The advice will come on a later visit day.', 'ആരോഗ്യ സംഘം ഇത് നോക്കുന്നു. ഉപദേശം അടുത്ത സന്ദർശന ദിവസങ്ങളിൽ വരും.') });
      const words = t(x.reply, x.reply_ml || x.reply);
      const next = x.next_visit ? t(`The health worker will see you again around ${day(x.next_visit)}.`, `ഏകദേശം ${day(x.next_visit)}-ന് ആരോഗ്യ പ്രവർത്തക വീണ്ടും കാണും.`) : '';
      return ui.card({ title: t(x.title, x.title_ml) + ' · ' + day(x.checked_on), body: [h('div', { class: 'health-reply' }, words), next ? h('p', null, '📅 ' + next) : null], actions: [h('button', { class: 'btn', type: 'button', onclick: () => k.speak(words + ' ' + next) }, '🔊 ' + t('Read aloud', 'വായിച്ചുകേൾക്കുക'))] });
    });
    wrap.append(ui.section(p.name, cards));
  }
  el.append(any ? wrap : ui.empty(t('No health advice yet. When the health worker checks you, the doctor\'s advice will appear here.', 'ഇതുവരെ ആരോഗ്യ ഉപദേശമില്ല. ആരോഗ്യ പ്രവർത്തക പരിശോധിച്ചാൽ ഡോക്ടറുടെ ഉപദേശം ഇവിടെ കാണാം.')));
}
