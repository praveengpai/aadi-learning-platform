// Wildlife Conflict & Environment — screens. Plain ES module; no DOM work at import time.
// Views: home (helper / facilitator), board (hamlet board), dept (Forest Range Office), family, impact.

const CSS = `
.wl-hero{background:linear-gradient(135deg,#1b3a26 0%,#2e5e3a 65%,#5b8c3a 100%);color:#fff;border-radius:var(--r-l,14px);padding:16px 18px;margin-bottom:14px;position:relative}
.wl-hero h2{color:#fff;margin:0 0 4px;padding-right:44px}
.wl-hero p{margin:0;opacity:.95;max-width:62ch}
.wl-hero .speak{position:absolute;top:10px;right:10px}
.wl-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:10px 0 14px}
.wl-act{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:110px;border:2px solid var(--line,#ddd);border-radius:14px;background:var(--card,#fff);color:inherit;font-weight:700;font-size:1.05rem;cursor:pointer;padding:10px;text-align:center}
.wl-act:hover,.wl-act:focus{border-color:#2e5e3a;outline:none}
.wl-act .e{font-size:2.4rem;line-height:1}
.wl-alert{border:2px solid #b45309;background:#fff7ed;color:#7c2d12;border-radius:12px;padding:12px 14px;margin:0 0 12px;display:flex;gap:10px;align-items:flex-start}
.wl-alert .e{font-size:2rem;line-height:1}
.wl-alert b{display:block;margin-bottom:2px}
.wl-sight{display:flex;gap:10px;align-items:center;border-bottom:1px dashed var(--line,#ddd);padding:8px 0}
.wl-sight .e{font-size:1.9rem;flex:none;width:2.2rem;text-align:center}
.wl-sight .m{flex:1;min-width:0}
.wl-q{border:1px solid var(--line,#ddd);border-radius:12px;background:var(--card,#fff);padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;cursor:pointer}
.wl-q .ph{width:64px;height:64px;border-radius:8px;flex:none;background:#eef3e8;display:grid;place-items:center;font-size:2rem}
.wl-q.p3{border-left:6px solid #b00020}.wl-q.p2{border-left:6px solid #e65100}.wl-q.p1{border-left:6px solid #e0b100}
.wl-photo{max-width:100%;width:360px;border-radius:10px;border:1px solid var(--line,#ddd);margin:4px 8px 4px 0}
.wl-tl{list-style:none;margin:8px 0;padding:0;border-left:3px solid #9bbf8a}
.wl-tl li{position:relative;padding:4px 0 10px 16px}
.wl-tl li .dot{position:absolute;left:-14px;top:2px;background:var(--card,#fff);font-size:1.1rem}
.wl-tl li.next{opacity:.65}
.wl-chip{display:inline-flex;gap:4px;align-items:center;border-radius:999px;padding:2px 10px;background:#e8f0e3;color:#1b3a26;font-weight:700;font-size:.85rem}
.wl-warn{color:#7c2d12;font-weight:600}
@media (prefers-color-scheme:dark){.wl-alert{background:#3b2410;color:#ffd7b0}.wl-chip{background:#24402c;color:#d8f0cc}.wl-q .ph{background:#24402c}}
@media (max-width:420px){.wl-act{min-height:96px;font-size:.95rem}.wl-act .e{font-size:2rem}}
`;

let catCache = null;
async function cat(k) { if (!catCache) catCache = await k.api.get('/catalogue'); return catCache; }
const find = (list, v) => (list || []).find((x) => x.value === v) || { value: v, label: v, label_ml: v, icon: '🐾' };
const money = (n) => (n === null || n === undefined ? '—' : '₹' + Number(n).toLocaleString('en-IN'));
const day = (s) => String(s || '').slice(0, 10);
const istTime = (s) => { const d = new Date(Date.parse(s) + 5.5 * 3600e3).toISOString(); return d.slice(0, 10) + ' ' + d.slice(11, 16); };
const say = (k, en, ml) => k.ui.speakBtn(k.lang === 'ml' && ml ? ml : en, k.lang === 'ml' && ml ? 'ml' : 'en');
const flagBadges = (k, flags) => (flags || []).map((f) => k.ui.badge(k.t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : 'info'));

function hero(k, icon, en, ml, pen, pml) {
  return k.h('div', { class: 'wl-hero' }, k.h('h2', null, icon + ' ' + k.t(en, ml)), k.h('p', null, k.t(pen, pml)), say(k, en + '. ' + pen, ml + '. ' + pml));
}
function alertBox(k, a) {
  if (!a) return null;
  return k.h('div', { class: 'wl-alert', role: 'alert' }, k.h('span', { class: 'e', 'aria-hidden': 'true' }, '🐘'),
    k.h('div', null, k.h('b', null, k.t('Elephant warning', 'ആന മുന്നറിയിപ്പ്')), k.t(a.message, a.message_ml)), say(k, a.message, a.message_ml));
}
function claimChip(k, c) {
  if (!c) return null;
  return k.h('span', { class: 'wl-chip' }, c.icon + ' ' + k.t(c.label, c.label_ml));
}
function timelineList(k, steps) {
  const { h, t } = k;
  return h('ol', { class: 'wl-tl' }, (steps || []).map((s) => h('li', { class: s.next ? 'next' : '' }, h('span', { class: 'dot', 'aria-hidden': 'true' }, s.icon),
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, t(s.label, s.label_ml)), s.at ? h('span', { class: 'small muted' }, day(s.at)) : null),
    h('div', { class: 'small' }, t(s.plain, s.plain_ml), s.amount ? ' ' + money(s.amount) : ''),
    s.note ? h('div', { class: 'small muted' }, t(s.note, s.note_ml || s.note)) : null)));
}
function incidentTitle(k, c, s) {
  const a = find(c.animals, s.animal);
  const dm = (s.damage || []).map((d) => find(c.damages, d)).map((d) => d.icon + ' ' + k.t(d.label, d.label_ml)).join(', ');
  return a.icon + ' ' + k.t(a.label, a.label_ml) + ' — ' + dm;
}
function spokenStatus(k, c, s) {
  const a = find(c.animals, s.animal);
  const en = `${a.label} damage on ${s.incident_date}. ${s.claim ? s.claim.plain : ''}`;
  const ml = `${s.incident_date}-ന് ${a.label_ml} വരുത്തിയ നാശം. ${s.claim ? s.claim.plain_ml : ''}`;
  return say(k, en, ml);
}

// ---------- shared pieces ----------
async function pickHamlet(k, onPick) {
  const hs = await k.api.get('/hamlets');
  const usable = hs.filter((x) => x.enabled);
  if (!usable.length) return k.ui.empty(k.t('This service is not offered in your hamlets.', 'ഈ സേവനം നിങ്ങളുടെ ഊരുകളിൽ ഇല്ല.'));
  const sel = k.h('select', { class: 'input', 'aria-label': k.t('Hamlet', 'ഊര്'), onchange: () => onPick(sel.value) }, usable.map((x) => k.h('option', { value: x.id, selected: x.id === k.params.hamlet }, k.t(x.name, x.name_ml) + (x.alert ? ' 🐘⚠' : ''))));
  setTimeout(() => onPick(sel.value), 0);
  return sel;
}

function choosePerson(k, onPick) {
  const { h, t, ui } = k;
  const wrap = h('div', { class: 'stack' });
  const input = h('input', { class: 'input', placeholder: t('Search by name', 'പേര് തിരയുക'), 'aria-label': t('Search by name', 'പേര് തിരയുക') });
  const list = h('div');
  let timer;
  const run = async () => {
    try {
      const rows = await k.api.get('/people?q=' + encodeURIComponent(input.value || ''));
      list.replaceChildren(ui.table([
        { key: 'name', label: t('Name', 'പേര്') }, { key: 'age', label: t('Age', 'വയസ്സ്') },
        { key: 'forest_consent', label: t('Shared with forest office', 'വനം ഓഫീസുമായി പങ്കിട്ടു'), render: (r) => (r.forest_consent ? '✓' : t('not yet', 'ഇല്ല')) },
      ], rows.slice(0, 40), { onRow: onPick, empty: t('Nobody here has given livelihood consent to your agency yet.', 'നിങ്ങളുടെ ഏജൻസിക്ക് ആരും ഉപജീവന സമ്മതം നൽകിയിട്ടില്ല.') }));
    } catch (e) { list.replaceChildren(ui.error(e)); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
  wrap.append(input, list); run();
  return wrap;
}

async function reportIncident(el, k, person) {
  const { h, t, ui } = k;
  el.replaceChildren(ui.loading());
  let def;
  try { def = await k.core.get('/forms/defs/wildlife.incident'); } catch (e) { el.replaceChildren(ui.error(e)); return; }
  el.replaceChildren(h('h3', null, t(def.title, def.title_ml) + ' — ' + person.name));
  if (!person.forest_consent) el.append(ui.card({ tone: 'warn', title: t('Not yet shared with the forest office', 'വനം ഓഫീസുമായി ഇതുവരെ പങ്കിട്ടിട്ടില്ല'), body: t('The record is kept here, but the range office cannot see it until the family agrees (livelihood consent to the range office).', 'രേഖ ഇവിടെ സൂക്ഷിക്കും; കുടുംബം സമ്മതിക്കുംവരെ റേഞ്ച് ഓഫീസിന് കാണാനാവില്ല.') }));
  el.append(ui.formFill(def, {
    person_id: person.id, answers: { incident_date: new Date().toISOString().slice(0, 10) },
    submitLabel: t('Save and prepare the claim', 'സേവ് ചെയ്ത് അപേക്ഷ തയ്യാറാക്കുക'),
    onDone: (r) => {
      if (r && r.queued) { el.replaceChildren(ui.card({ tone: 'warn', title: t('Saved on this device', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു'), body: t('It travels with the next sync. The claim file is prepared then.', 'അടുത്ത സിങ്കിൽ അയയ്ക്കും.') })); return; }
      const urgent = (r.flags || []).some((f) => f.level === 'urgent');
      const msg = urgent ? t('Someone is hurt. Seek medical care now and inform the forest office. In an emergency call 112.', 'ആർക്കോ പരിക്കുണ്ട്. ഉടൻ ചികിത്സ തേടുക, വനം ഓഫീസിനെ അറിയിക്കുക. അടിയന്തരമെങ്കിൽ 112 വിളിക്കുക.') : t('Recorded. The claim papers are prepared and go to the range office.', 'രേഖപ്പെടുത്തി. അപേക്ഷ തയ്യാറാക്കി റേഞ്ച് ഓഫീസിലേക്ക് പോകും.');
      k.speak(msg);
      el.replaceChildren(ui.card({ tone: urgent ? 'bad' : 'good', title: (urgent ? '⚠ ' : '✓ ') + msg, body: h('div', { class: 'row' }, flagBadges(k, r.flags)), actions: [ui.button(t('Open the claim', 'അപേക്ഷ തുറക്കുക'), () => openIncident(el, k, r.id, () => k.refresh())), ui.button(t('Done', 'കഴിഞ്ഞു'), () => k.refresh(), { tone: 'ghost' })] }));
    },
  }));
}

async function sightingForm(el, k, hid) {
  const { t, ui } = k;
  const c = await cat(k);
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  el.replaceChildren(k.h('h3', null, '👀 ' + t('Record a sighting', 'കണ്ട മൃഗത്തെ രേഖപ്പെടുത്തുക')), ui.form([
    { name: 'animal', label: t('Which animal?', 'ഏത് മൃഗം?'), type: 'select', required: true, options: c.animals.map((a) => ({ value: a.value, label: a.icon + ' ' + t(a.label, a.label_ml) })) },
    { name: 'count', label: t('How many?', 'എത്ര എണ്ണം?'), type: 'number', min: 1, max: 200, value: 1 },
    { name: 'seen_at', label: t('When?', 'എപ്പോൾ?'), type: 'datetime-local', value: now },
    { name: 'place', label: t('Where? (e.g. the river path)', 'എവിടെ? (ഉദാ. പുഴവഴി)'), type: 'text', required: true },
    { name: 'place_ml', label: t('Where, in Malayalam (optional)', 'എവിടെ — മലയാളത്തിൽ'), type: 'text' },
    { name: 'direction', label: t('Moving which way?', 'ഏത് ദിശയിലേക്ക്?'), type: 'select', options: c.directions.map((d) => ({ value: d.value, label: d.icon + ' ' + t(d.label, d.label_ml) })), value: 'unknown' },
    { name: 'note', label: t('Note', 'കുറിപ്പ്'), type: 'text' },
  ], async (v) => {
    const r = await k.api.post('/sightings', { ...v, hamlet_id: hid, seen_at: v.seen_at ? v.seen_at.replace('T', ' ') : undefined });
    if (r && r.queued) { k.toast(t('Saved — will send when online', 'സേവ് ചെയ്തു — ഓൺലൈനിൽ അയയ്ക്കും'), 'warn'); return; }
    k.toast(t('Sighting recorded', 'രേഖപ്പെടുത്തി'), 'good');
    if (r.alert) k.speak(t(r.alert.message, r.alert.message_ml));
    k.go('#/m/wildlife/board?hamlet=' + hid);
  }, { submitLabel: t('Save sighting', 'സേവ് ചെയ്യുക') }));
}

async function readingsPanel(el, k, hid) {
  const { h, t, ui } = k;
  const c = await cat(k);
  const kinds = Object.entries(c.reading_kinds);
  el.replaceChildren(h('h3', null, '🌧️ ' + t('Environment readings', 'പരിസ്ഥിതി അളവുകൾ')));
  const trend = h('div');
  const showTrend = async () => {
    const rows = await k.api.get('/readings/trend?days=30&hamlet_id=' + encodeURIComponent(hid));
    trend.replaceChildren(ui.grid(rows.map((r) => ui.card({ title: r.icon + ' ' + t(r.label, r.label_ml), body: [h('div', null, r.last ? h('b', null, r.last.value + ' ' + r.unit) : t('No readings', 'അളവില്ല'), r.total !== null ? h('span', { class: 'small muted' }, ' · ' + t('30-day total', '30 ദിവസ ആകെ') + ': ' + r.total) : null), ui.spark(r.series.map((x) => x.value), { w: 160, hgt: 34 })] })), 170));
  };
  el.append(trend);
  await showTrend();
  el.append(ui.section(t('Add one reading', 'ഒരു അളവ് ചേർക്കുക'), ui.form([
    { name: 'kind', label: t('What', 'എന്ത്'), type: 'select', required: true, options: kinds.map(([v, x]) => ({ value: v, label: x.icon + ' ' + t(x.label, x.label_ml) + ' (' + x.unit + ')' })) },
    { name: 'value', label: t('Value', 'അളവ്'), type: 'number', required: true, step: 'any' },
    { name: 'animal', label: t('Animal (camera trap only)', 'മൃഗം (ക്യാമറ ട്രാപ്പിന് മാത്രം)'), type: 'select', options: c.animals.map((a) => ({ value: a.value, label: a.icon + ' ' + t(a.label, a.label_ml) })) },
    { name: 'device', label: t('Device / place', 'ഉപകരണം / സ്ഥലം'), type: 'text', placeholder: 'Rain gauge (school roof)' },
  ], async (v) => { if (!v.animal) delete v.animal; await k.api.post('/readings', { ...v, hamlet_id: hid }); k.toast(t('Saved', 'സേവ് ചെയ്തു'), 'good'); await showTrend(); }, { submitLabel: t('Save', 'സേവ് ചെയ്യുക') })));
  const out = h('div', { class: 'small' });
  el.append(ui.section(t('Paste a log (CSV)', 'ലോഗ് ഒട്ടിക്കുക (CSV)'), [
    h('p', { class: 'small muted' }, t(`One reading per line: date, value[, device]. Dates like 2026-10-31 08:00 or 31/10/2026. Or a header row with date, kind, value, device, animal. At most ${c.max_import_rows} lines.`, `ഓരോ വരിയിലും ഒരു അളവ്: തീയതി, അളവ്[, ഉപകരണം]. പരമാവധി ${c.max_import_rows} വരി.`)),
    ui.form([
      { name: 'kind', label: t('Kind (if the log has no "kind" column)', 'തരം'), type: 'select', options: kinds.map(([v, x]) => ({ value: v, label: x.icon + ' ' + t(x.label, x.label_ml) })) },
      { name: 'device', label: t('Device', 'ഉപകരണം'), type: 'text' },
      { name: 'csv', label: t('Log', 'ലോഗ്'), type: 'textarea', required: true, placeholder: 'date,mm\n2026-10-30 08:00,12.5\n2026-10-31 08:00,0' },
      { name: 'skip_invalid', label: t('Skip bad lines', 'തെറ്റായ വരികൾ ഒഴിവാക്കുക'), type: 'checkbox' },
    ], async (v) => {
      if (!v.kind) delete v.kind;
      try {
        const r = await k.api.post('/readings/import', { ...v, hamlet_id: hid });
        out.replaceChildren(ui.badge(t(`Imported ${r.imported}, skipped ${r.skipped}`, `${r.imported} ചേർത്തു, ${r.skipped} ഒഴിവാക്കി`), 'good'));
        await showTrend();
      } catch (e) { out.replaceChildren(ui.badge(e.message, 'bad')); }
    }, { submitLabel: t('Import', 'ചേർക്കുക') }), out,
  ]));
}

// ---------- one incident (helpers, department, family) ----------
async function openIncident(box, k, id, back) {
  const { h, t, ui } = k;
  box.replaceChildren(ui.loading());
  const c = await cat(k);
  let s;
  try { s = await k.api.get('/incidents/' + encodeURIComponent(id)); } catch (e) { box.replaceChildren(ui.error(e)); return; }
  const crop = s.crop ? find(c.crops, s.crop) : null;
  box.replaceChildren(
    back ? ui.button('← ' + t('Back', 'തിരികെ'), back, { tone: 'ghost', small: true }) : null,
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', null, incidentTitle(k, c, s) + (s.person ? ' — ' + s.person.name : '')), spokenStatus(k, c, s)),
    h('div', { class: 'row' }, claimChip(k, s.claim), flagBadges(k, s.flags)),
    h('div', null, (s.photos || []).map((p) => h('img', { class: 'wl-photo', src: p, alt: t('Photo of the damage', 'നാശത്തിന്റെ ഫോട്ടോ') }))),
    ui.kv([
      [t('Date', 'തീയതി'), s.incident_date + ' · ' + t(find(c.times, s.time_of_day).label, find(c.times, s.time_of_day).label_ml)],
      [t('Hamlet', 'ഊര്'), t(s.hamlet, s.hamlet_ml)],
      crop ? [t('Crop', 'വിള'), t(crop.label, crop.label_ml) + (s.crop_area_cents !== null ? ` · ${s.crop_area_cents} ${t('cents', 'സെന്റ്')}` : '') + (s.plants_damaged ? ` · ${s.plants_damaged} ${t('plants', 'ചെടികൾ')}` : '')] : null,
      s.items_damaged ? [t('Other damage', 'മറ്റ് നാശം'), s.items_damaged] : null,
      [t('Estimated loss (family)', 'ഏകദേശ നഷ്ടം (കുടുംബം)'), money(s.estimated_loss)],
      s.claim && s.claim.amount_sanctioned !== null ? [t('Sanctioned', 'അനുവദിച്ചത്'), money(s.claim.amount_sanctioned)] : null,
      [t('Witnesses', 'സാക്ഷികൾ'), s.witnesses ?? '—'],
      [t('Told the forest office already', 'വനം ഓഫീസിനെ അറിയിച്ചോ'), s.reported_forest === 'yes' ? t('Yes', 'അതെ') : t('No', 'ഇല്ല')],
      s.location ? [t('Location', 'സ്ഥലം'), h('a', { href: `geo:${s.location[0]},${s.location[1]}` }, s.location.join(', '))] : null,
      s.notes ? [t('Notes', 'കുറിപ്പ്'), s.notes] : null,
      [t('Recorded by', 'രേഖപ്പെടുത്തിയത്'), (s.captured_by_name || '') + ' · ' + day(s.captured_at)],
    ].filter(Boolean)),
    ui.section(t('Claim timeline', 'അപേക്ഷയുടെ നാൾവഴി'), timelineList(k, s.timeline)),
  );
  if (s.can_update && s.can_update.length) {
    const opts = s.can_update.map((v) => { const x = c.claim_statuses.find((y) => y.key === v); return { value: v, label: x.icon + ' ' + t(x.label, x.label_ml) }; });
    box.append(ui.section(t('Update the claim', 'അപേക്ഷ പുതുക്കുക'), ui.form([
      { name: 'status', label: t('New step', 'പുതിയ ഘട്ടം'), type: 'select', required: true, options: opts },
      { name: 'amount_sanctioned', label: t('Sanctioned amount (₹, only when sanctioning)', 'അനുവദിച്ച തുക (₹)'), type: 'number', min: 0, step: '1' },
      { name: 'note', label: t('Note for the family (plain words)', 'കുടുംബത്തിനുള്ള കുറിപ്പ്'), type: 'textarea' },
      { name: 'note_ml', label: t('Note in Malayalam', 'കുറിപ്പ് മലയാളത്തിൽ'), type: 'textarea' },
    ], async (v) => { if (v.amount_sanctioned === null) delete v.amount_sanctioned; await k.api.post('/claims/' + encodeURIComponent(s.claim.id) + '/status', v); k.toast(t('Claim updated. The family hears on the next visit.', 'അപേക്ഷ പുതുക്കി.'), 'good'); await openIncident(box, k, id, back); }, { submitLabel: t('Save step', 'സേവ് ചെയ്യുക') })));
  }
  if (s.can_reply) {
    box.append(ui.section(t('Message to the family', 'കുടുംബത്തിനുള്ള സന്ദേശം'), ui.form([
      { name: 'reply', label: t('Message (English)', 'സന്ദേശം (ഇംഗ്ലീഷ്)'), type: 'textarea', required: true },
      { name: 'reply_ml', label: t('Message in Malayalam (read to the family)', 'സന്ദേശം മലയാളത്തിൽ'), type: 'textarea' },
    ], async (v) => { await k.api.post('/incidents/' + encodeURIComponent(s.id) + '/reply', v); k.toast(t('Sent. It reaches the hamlet on the next visit.', 'അയച്ചു.'), 'good'); await openIncident(box, k, id, back); }, { submitLabel: t('Send', 'അയയ്ക്കുക') })));
  }
}

function incidentRow(k, c, s, onOpen) {
  const { h, t } = k;
  return h('div', { class: 'wl-q p' + Math.min(3, s.priority || 0), role: 'button', tabindex: '0', onclick: () => onOpen(s), onkeydown: (e) => { if (e.key === 'Enter') onOpen(s); } },
    h('div', { class: 'ph', 'aria-hidden': 'true' }, s.photo_count ? '📷' : find(c.animals, s.animal).icon),
    h('div', { style: { minWidth: 0 } }, h('b', null, incidentTitle(k, c, s)),
      h('div', { class: 'small muted' }, [s.person ? s.person.name : null, t(s.hamlet || '', s.hamlet_ml), s.incident_date, money(s.estimated_loss)].filter(Boolean).join(' · ')),
      h('div', { class: 'row' }, claimChip(k, s.claim), s.new ? k.ui.badge(t('New', 'പുതിയത്'), 'info') : null, flagBadges(k, (s.flags || []).filter((f) => f.level !== 'info')))));
}

async function incidentList(el, k, path) {
  const c = await cat(k);
  const rows = await k.api.get(path);
  const box = k.h('div');
  const show = () => box.replaceChildren(...(rows.length ? rows.map((s) => incidentRow(k, c, s, (x) => openIncident(box, k, x.id, show))) : [k.ui.empty(k.t('No incidents yet.', 'ഇതുവരെ ഒന്നുമില്ല.'))]));
  show();
  el.append(box);
}

// ---------- the hamlet board ----------
async function board(el, k, hid) {
  const { h, t, ui } = k;
  const b = await k.api.get('/board?hamlet_id=' + encodeURIComponent(hid));
  el.append(alertBox(k, b.alert));
  const all = b.sightings.map((s) => s.sentence).join(' ');
  const allMl = b.sightings.map((s) => s.sentence_ml).join(' ');
  el.append(ui.section(h('span', null, '👀 ' + t('Animals seen — last 7 days', 'കഴിഞ്ഞ 7 ദിവസം കണ്ട മൃഗങ്ങൾ') + ' ', b.sightings.length ? say(k, all, allMl) : null),
    b.sightings.length ? b.sightings.map((s) => h('div', { class: 'wl-sight' }, h('span', { class: 'e', 'aria-hidden': 'true' }, s.icon),
      h('div', { class: 'm' }, h('div', null, t(s.sentence, s.sentence_ml)), h('div', { class: 'small muted' }, istTime(s.seen_at) + (s.reported_by_name ? ' · ' + s.reported_by_name : ''))), say(k, s.sentence, s.sentence_ml)))
      : ui.empty(t('No animals reported this week.', 'ഈ ആഴ്ച മൃഗങ്ങളെ കണ്ടതായി അറിയിപ്പില്ല.'))));
  const r = b.rainfall;
  el.append(ui.section('🌧️ ' + t('Rain — last 14 days', 'മഴ — കഴിഞ്ഞ 14 ദിവസം'), r.series.length ? [
    ui.bars(r.series.slice(-14).map((x) => ({ label: x.date.slice(5), value: x.value })), { unit: ' mm' }),
    h('p', { class: 'small muted' }, t(`Total ${r.total} mm`, `ആകെ ${r.total} മി.മീ.`) + (b.stream.last ? ' · ' + t('Stream level', 'തോട്ടിലെ ജലനിരപ്പ്') + ': ' + b.stream.last.value + ' cm' : '') + (b.camera.total !== null ? ' · 📷 ' + t('camera-trap animals (30 days)', 'ക്യാമറ ട്രാപ്പ് (30 ദിവസം)') + ': ' + b.camera.total : '')),
  ] : ui.empty(t('No rain readings yet.', 'മഴ അളവ് ഇല്ല.'))));
  el.append(h('p', { class: 'small' }, '☎ ' + t('In danger call 112. Tell the forest office about elephants near houses.', 'അപകടത്തിൽ 112 വിളിക്കുക. വീടിനടുത്ത് ആനയെ കണ്ടാൽ വനം ഓഫീസിനെ അറിയിക്കുക.')));
  return b;
}

export default {
  views: {
    home: async (el, k) => {
      const { h, t, ui } = k;
      k.style(CSS, 'wildlife-css');
      el.append(hero(k, '🐘', 'Wild animals', 'കാട്ടുമൃഗങ്ങൾ', 'Record damage by elephants, wild boar and other animals with photos, prepare the compensation claim and follow it. Log sightings to warn the hamlet.', 'ആന, കാട്ടുപന്നി തുടങ്ങിയവ വരുത്തുന്ന നാശം ഫോട്ടോ സഹിതം രേഖപ്പെടുത്തുക, നഷ്ടപരിഹാര അപേക്ഷ തയ്യാറാക്കി പിന്തുടരുക. ഊരിന് മുന്നറിയിപ്പ് നൽകാൻ കണ്ട മൃഗങ്ങളെ രേഖപ്പെടുത്തുക.'));
      const sum = await k.api.get('/summary');
      for (const x of sum.hamlets) if (x.alert) el.append(alertBox(k, { ...x.alert, message: t(x.name, x.name_ml) + ': ' + x.alert.message, message_ml: (x.name_ml || x.name) + ': ' + x.alert.message_ml }));
      el.append(ui.grid([ui.stat(t('Incidents I recorded', 'ഞാൻ രേഖപ്പെടുത്തിയവ'), sum.incidents), ui.stat(t('Claims still open', 'തീർപ്പാകാത്ത അപേക്ഷകൾ'), sum.open_claims), ui.stat(t('Money paid', 'പണം ലഭിച്ചവ'), sum.claims_by_status.paid || 0), ui.stat(t('New messages to pass on', 'അറിയിക്കേണ്ട സന്ദേശങ്ങൾ'), sum.replies_new)], 140));
      const work = h('div');
      const act = (e, en, ml, fn) => h('button', { class: 'wl-act', type: 'button', onclick: fn }, h('span', { class: 'e', 'aria-hidden': 'true' }, e), t(en, ml));
      const withHamlet = async (fn) => { work.replaceChildren(h('h3', null, t('Which hamlet?', 'ഏത് ഊര്?'))); const box = h('div'); work.append(await pickHamlet(k, (hid) => { box.replaceChildren(); fn(box, hid); }), box); };
      el.append(h('div', { class: 'wl-big' },
        sum.can_capture ? act('🐾', 'Report damage', 'നാശം അറിയിക്കുക', () => { work.replaceChildren(h('h3', null, t('Whose crop or house?', 'ആരുടെ കൃഷി / വീട്?')), choosePerson(k, (p) => reportIncident(work, k, p))); work.scrollIntoView({ behavior: 'smooth' }); }) : null,
        act('👀', 'Record a sighting', 'കണ്ട മൃഗം', () => withHamlet((box, hid) => sightingForm(box, k, hid))),
        sum.can_capture ? act('🌧️', 'Readings', 'അളവുകൾ', () => withHamlet((box, hid) => readingsPanel(box, k, hid))) : null,
        act('📋', 'Hamlet board', 'ഊര് ബോർഡ്', () => k.go('#/m/wildlife/board')),
        sum.is_dept ? act('🌳', 'Forest office desk', 'വനം ഓഫീസ് ഡെസ്ക്', () => k.go('#/m/wildlife/dept')) : null));
      el.append(work);
      el.append(ui.section('🗂️ ' + t('Claims I helped with', 'ഞാൻ സഹായിച്ച അപേക്ഷകൾ'), h('div', { id: 'wl-mine' })));
      await incidentList(el.querySelector('#wl-mine'), k, '/incidents?mine=1');
      if (sum.forwarded_to) el.append(h('p', { class: 'small muted' }, t('Records go to: ', 'രേഖകൾ പോകുന്നത്: ') + sum.forwarded_to + t(' — only for families who agreed to share with it.', ' — പങ്കിടാൻ സമ്മതിച്ച കുടുംബങ്ങളുടേത് മാത്രം.')));
    },

    board: async (el, k) => {
      const { h, t } = k;
      k.style(CSS, 'wildlife-css');
      el.append(hero(k, '📋', 'Hamlet animal board', 'ഊര് മൃഗ ബോർഡ്', 'Animals seen near the hamlet this week, early warnings and rain.', 'ഈ ആഴ്ച ഊരിനടുത്ത് കണ്ട മൃഗങ്ങൾ, മുന്നറിയിപ്പുകൾ, മഴ.'));
      const box = h('div');
      const tools = h('div', { class: 'row' });
      el.append(tools, box);
      tools.append(await pickHamlet(k, async (hid) => {
        box.replaceChildren(k.ui.loading());
        const inner = h('div');
        try { const b = await board(inner, k, hid); box.replaceChildren(inner); if (b.can_report) box.append(k.ui.button('👀 ' + t('Record a sighting', 'കണ്ട മൃഗത്തെ രേഖപ്പെടുത്തുക'), () => sightingForm(box, k, hid), { tone: 'primary' })); } catch (e) { box.replaceChildren(k.ui.error(e)); }
      }));
    },

    dept: async (el, k) => {
      const { h, t, ui } = k;
      k.style(CSS, 'wildlife-css');
      el.append(hero(k, '🌳', 'Forest office desk', 'വനം ഓഫീസ് ഡെസ്ക്', 'Wild-animal incidents from the hamlets, shared with the range office by the families. Urgent ones first. Record each claim step; the family hears in plain words on the next visit.', 'കുടുംബങ്ങൾ പങ്കിട്ട കാട്ടുമൃഗ നാശ രേഖകൾ. അടിയന്തരമായവ ആദ്യം. ഓരോ ഘട്ടവും രേഖപ്പെടുത്തുക.'));
      const c = await cat(k);
      const q = await k.api.get('/queue');
      if (q.note) el.append(ui.card({ tone: 'info', title: t('Not the reviewing office', 'അവലോകന ഓഫീസ് അല്ല'), body: q.note }));
      const box = h('div');
      const show = () => box.replaceChildren(...(q.items.length ? q.items.map((s) => incidentRow(k, c, s, (x) => openIncident(box, k, x.id, () => k.refresh()))) : [ui.empty(t('Nothing waiting. 🎉', 'ഒന്നും കാത്തിരിക്കുന്നില്ല. 🎉'))]));
      el.append(ui.tabs([
        { id: 'queue', label: '📥 ' + t('Open incidents', 'തീർപ്പാകാത്തവ') + ` (${q.items.length})`, render: (b) => { show(); b.append(box); } },
        { id: 'all', label: '🗂️ ' + t('All', 'എല്ലാം'), render: (b) => incidentList(b, k, '/incidents') },
        { id: 'impact', label: '📊 ' + t('Overview', 'അവലോകനം'), render: (b) => impact(b, k) },
      ], k.params.tab || 'queue'));
    },

    family: async (el, k) => {
      const { h, t, ui } = k;
      k.style(CSS, 'wildlife-css');
      el.append(hero(k, '🐘', 'My damage claims', 'എന്റെ നഷ്ടപരിഹാര അപേക്ഷകൾ', 'Damage by wild animals that was recorded for you, and where your compensation claim is now.', 'നിങ്ങൾക്കായി രേഖപ്പെടുത്തിയ കാട്ടുമൃഗ നാശവും നഷ്ടപരിഹാര അപേക്ഷ ഇപ്പോൾ എവിടെയെന്നും.'));
      const c = await cat(k);
      const my = await k.api.get('/my');
      if (!my.members.length || !my.members.some((m) => m.incidents.length)) el.append(ui.empty(t('Nothing recorded. If animals damaged your crop or house, tell the facilitator on the visit day.', 'ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല. മൃഗങ്ങൾ കൃഷിയോ വീടോ നശിപ്പിച്ചാൽ സന്ദർശന ദിവസം ഫെസിലിറ്റേറ്ററെ അറിയിക്കുക.')));
      for (const m of my.members) {
        if (!m.incidents.length) continue;
        el.append(h('h3', null, m.self ? t('Me', 'ഞാൻ') : m.name));
        for (const s of m.incidents) {
          el.append(ui.card({
            title: h('span', null, incidentTitle(k, c, s), ' ', spokenStatus(k, c, s)),
            subtitle: s.incident_date + ' · ' + t('Estimated loss', 'ഏകദേശ നഷ്ടം') + ' ' + money(s.estimated_loss),
            body: [h('div', { class: 'row' }, claimChip(k, s.claim)), s.claim ? h('p', null, t(s.claim.plain, s.claim.plain_ml)) : null, timelineList(k, s.timeline),
              s.reply ? h('div', { class: 'card', style: { background: 'var(--soft,#eef6f2)' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, '🌳 ' + t('Message from the forest office', 'വനം ഓഫീസിന്റെ സന്ദേശം')), say(k, s.reply, s.reply_ml || s.reply)), h('p', { style: { whiteSpace: 'pre-wrap' } }, t(s.reply, s.reply_ml || s.reply))) : null],
          }));
        }
      }
      el.append(h('p', { class: 'small' }, '☎ ' + t('If someone is hurt by an animal, get medical care at once. In an emergency call 112.', 'മൃഗം ആരെയെങ്കിലും ആക്രമിച്ചാൽ ഉടൻ ചികിത്സ തേടുക. അടിയന്തരമെങ്കിൽ 112 വിളിക്കുക.')));
    },

    impact: async (el, k) => {
      k.style(CSS, 'wildlife-css');
      el.append(hero(k, '📊', 'Wildlife conflict', 'വന്യജീവി സംഘർഷം', 'Incidents by animal and type of damage per hamlet, and how many claims were paid. No names; small groups are hidden to protect families.', 'ഊര് തിരിച്ച് മൃഗവും നാശവും, എത്ര അപേക്ഷകൾക്ക് പണം ലഭിച്ചു. പേരുകളില്ല; ചെറിയ കൂട്ടങ്ങൾ മറച്ചിരിക്കുന്നു.'));
      await impact(el, k);
    },
  },
};

async function impact(el, k) {
  const { h, t, ui } = k;
  const r = await k.api.get('/aggregate');
  const v = (x) => (x === 'hidden' ? t('hidden', 'മറച്ചു') : x);
  el.append(ui.grid([
    ui.stat(t('Incidents', 'സംഭവങ്ങൾ'), v(r.totals.incidents)),
    ui.stat(t('Claims paid', 'പണം ലഭിച്ച അപേക്ഷകൾ'), r.totals.claims_paid_pct === null ? v(r.totals.claims_paid) : r.totals.claims_paid_pct + '%', String(v(r.totals.claims_paid)) + ' / ' + v(r.totals.claims)),
    ui.stat(t('Compensation paid', 'നൽകിയ നഷ്ടപരിഹാരം'), r.totals.paid_inr === null ? '—' : money(r.totals.paid_inr)),
  ], 150));
  const bars = r.animals.filter((a) => typeof r.totals.by_animal[a.value] === 'number' && r.totals.by_animal[a.value] > 0).map((a) => ({ label: a.icon + ' ' + t(a.label, a.label_ml), value: r.totals.by_animal[a.value] }));
  if (bars.length) el.append(ui.section(t('Incidents by animal', 'മൃഗം തിരിച്ച്'), ui.bars(bars)));
  const used = r.animals.filter((a) => r.totals.by_animal[a.value] !== 0);
  const usedD = r.damages.filter((d) => r.totals.by_damage[d.value] !== 0);
  el.append(ui.section(t('By hamlet and animal', 'ഊര്, മൃഗം തിരിച്ച്'), ui.table([
    { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (x) => t(x.hamlet, x.hamlet_ml) },
    ...used.map((a) => ({ key: a.value, label: a.icon, render: (x) => String(x.by_animal[a.value]) })),
    { key: 'incidents', label: t('Total', 'ആകെ'), render: (x) => String(v(x.incidents)) },
    { key: 'paid', label: t('Claims paid', 'പണം ലഭിച്ചു'), render: (x) => (x.claims_paid_pct === null ? String(v(x.claims_paid)) : `${x.claims_paid} (${x.claims_paid_pct}%)`) },
  ], r.hamlets, { empty: t('No incidents recorded.', 'സംഭവങ്ങളില്ല.') })));
  el.append(ui.section(t('By hamlet and damage', 'ഊര്, നാശം തിരിച്ച്'), ui.table([
    { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (x) => t(x.hamlet, x.hamlet_ml) },
    ...usedD.map((d) => ({ key: d.value, label: d.icon + ' ' + t(d.label, d.label_ml), render: (x) => String(x.by_damage[d.value]) })),
  ], r.hamlets)));
  el.append(h('p', { class: 'small muted' }, t(r.note, r.note_ml) + ' ' + t(`Period ${r.from} to ${r.to}. Scope: ${r.scope}.`, `കാലയളവ് ${r.from} മുതൽ ${r.to} വരെ.`)));
}
