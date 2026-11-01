// Forms & Surveys — generic screens over the Brain's form round-trip engine.
// Other modules link here: #/m/surveys/fill?key=<form_key>&person=<id>  and  #/m/surveys/item?id=<submission>
export default {
  views: {
    home: async (el, k) => {
      const { t, h, ui } = k;
      el.append(h('h2', null, '📋 ' + t('Forms & Surveys', 'ഫോമുകളും സർവേകളും')));
      el.append(h('p', { class: 'muted' }, t('Fill in forms at the centre — even without internet. They travel to the city on the next visit, and replies come back the visit after.', 'ഇന്റർനെറ്റ് ഇല്ലെങ്കിലും സെന്ററിൽ ഫോം പൂരിപ്പിക്കാം. അടുത്ത സന്ദർശനത്തിൽ നഗരത്തിലെത്തും, മറുപടി അതിനടുത്ത തവണ തിരിച്ചെത്തും.')));
      const tabs = [
        { id: 'fill', label: t('Fill a form', 'ഫോം പൂരിപ്പിക്കുക'), render: (box) => fillList(box, k) },
        { id: 'mine', label: t('Sent by me', 'ഞാൻ അയച്ചവ'), render: (box) => mine(box, k) },
      ];
      if (['platform_admin', 'agency_admin'].includes(k.user.role)) tabs.push({ id: 'design', label: t('Design / import', 'രൂപകൽപ്പന / ഇറക്കുമതി'), render: (box) => design(box, k) });
      el.append(ui.tabs(tabs, k.params.tab || 'fill'));
    },

    fill: async (el, k) => {
      const { t, h, ui } = k;
      const key = k.params.key;
      let def;
      try { def = await k.core.get('/forms/defs/' + encodeURIComponent(key)); } catch (e) { el.append(ui.error(e)); return; }
      el.append(h('h2', null, t(def.title, def.title_ml)));
      if (def.description) el.append(h('p', { class: 'muted' }, def.description));
      const box = h('div');
      el.append(box);
      const start = (subject) => {
        box.replaceChildren(h('p', { class: 'small muted' }, subject.label));
        box.append(ui.formFill(def, {
          ...subject.ids,
          onDone: (r) => {
            if (r && r.queued) { box.replaceChildren(ui.card({ title: t('Saved on this device', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു'), body: t('It will be sent automatically when the hub or internet is reachable.', 'ഹബ്ബോ ഇന്റർനെറ്റോ കിട്ടുമ്പോൾ തനിയെ അയയ്ക്കും.'), tone: 'warn' })); return; }
            const flags = (r.flags || []).map((f) => ui.badge(t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : 'info'));
            box.replaceChildren(ui.card({ title: t('Saved', 'സേവ് ചെയ്തു') + (r.duplicate ? ' ✓' : ''), body: [h('p', null, r.status === 'closed' ? t('Thank you — recorded.', 'നന്ദി — രേഖപ്പെടുത്തി.') : t('Sent for review. The reply will come back on a later visit.', 'പരിശോധനയ്ക്ക് അയച്ചു. മറുപടി അടുത്ത സന്ദർശനങ്ങളിൽ വരും.')), h('div', { class: 'row' }, flags)], tone: 'good', actions: [ui.button(t('Fill another', 'മറ്റൊന്ന് പൂരിപ്പിക്കുക'), () => k.refresh())] }));
          },
        }));
      };
      if (def.subject === 'person') {
        if (k.params.person) { start({ ids: { person_id: k.params.person }, label: '' }); return; }
        box.append(h('p', null, t('Who is this form about?', 'ഈ ഫോം ആരെക്കുറിച്ചാണ്?')));
        box.append(ui.personPicker({ onPick: (p) => start({ ids: { person_id: p.id }, label: p.name }) }));
      } else if (def.subject === 'household') {
        const list = h('div', { class: 'stack' });
        box.append(h('p', null, t('Choose the household', 'വീട് തിരഞ്ഞെടുക്കുക')), ui.hamletSelect(async (hid) => {
          list.replaceChildren(ui.loading());
          const hs = await k.core.get('/households' + (hid ? '?hamlet_id=' + hid : ''));
          list.replaceChildren(...(hs.length ? hs.slice(0, 200).map((x) => ui.button((x.name || t('Household', 'വീട്')) + ' · ' + x.members.length + ' ' + t('people', 'പേർ'), () => start({ ids: { household_id: x.id }, label: x.name }), { tone: 'ghost' })) : [ui.empty(t('No households you can see here.', 'ഇവിടെ നിങ്ങൾക്ക് കാണാവുന്ന വീടുകൾ ഇല്ല.'))]));
        }, { all: false }), list);
      } else {
        box.append(h('p', null, t('Choose the hamlet', 'ഊര് തിരഞ്ഞെടുക്കുക')), ui.hamletSelect((hid) => hid && start({ ids: { hamlet_id: hid }, label: '' }), { all: false }));
      }
    },

    queue: async (el, k) => {
      const { t, h, ui } = k;
      el.append(h('h2', null, '📨 ' + t('Replies to send', 'മറുപടി നൽകാനുള്ളവ')));
      el.append(h('p', { class: 'muted' }, t('Forms captured in the hamlets that need your answer. Most urgent first.', 'ഊരുകളിൽ നിന്ന് വന്ന, നിങ്ങളുടെ മറുപടി വേണ്ട ഫോമുകൾ. അടിയന്തരമായവ ആദ്യം.')));
      const rows = await k.core.get('/forms/queue');
      el.append(ui.table([
        { key: 'priority', label: '!', render: (r) => (r.priority >= 3 ? ui.badge(t('Urgent', 'അടിയന്തരം'), 'bad') : r.priority >= 1 ? ui.badge(t('Soon', 'ഉടൻ'), 'warn') : '') },
        { key: 'form', label: t('Form', 'ഫോം'), render: (r) => t(r.form_title, r.form_title_ml) },
        { key: 'who', label: t('About', 'ആരെക്കുറിച്ച്'), render: (r) => (r.person ? r.person.name : r.hamlet || '') },
        { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (r) => t(r.hamlet || '', r.hamlet_ml) },
        { key: 'when', label: t('Captured', 'രേഖപ്പെടുത്തിയത്'), render: (r) => String(r.captured_at || '').slice(0, 10) },
        { key: 'flags', label: t('Checks', 'പരിശോധന'), render: (r) => (r.flags || []).map((f) => ui.badge(t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : 'warn')) },
      ], rows, { empty: t('Nothing waiting. 🎉', 'ഒന്നും കാത്തിരിക്കുന്നില്ല. 🎉'), onRow: (r) => k.go('#/m/surveys/item?id=' + r.id) }));
    },

    item: async (el, k) => {
      const { t, h, ui } = k;
      let s;
      try { s = await k.core.get('/forms/submissions/' + k.params.id); } catch (e) { el.append(ui.error(e)); return; }
      el.append(ui.submissionCard(s, { onSeen: async () => { await k.core.post('/forms/submissions/' + s.id + '/seen'); k.refresh(); } }));
      const rows = [];
      for (const f of s.form.fields) {
        if (f.type === 'note' || !(f.name in s.answers)) continue;
        let v = s.answers[f.name];
        if (f.type === 'photo') v = h('img', { src: v, alt: t(f.label, f.label_ml), style: { maxWidth: '240px', borderRadius: '8px' } });
        else if (f.choices) { const lab = (x) => { const c = f.choices.find((c) => c.value === x); return c ? t(c.label, c.label_ml) : x; }; v = Array.isArray(v) ? v.map(lab).join(', ') : lab(v); }
        else if (f.type === 'yes_no') v = v === 'yes' ? t('Yes', 'അതെ') : t('No', 'ഇല്ല');
        rows.push([t(f.label, f.label_ml), v]);
      }
      el.append(ui.section(t('Answers', 'ഉത്തരങ്ങൾ'), ui.kv(rows)));
      if (s.can_reply) {
        if (s.status === 'submitted') k.core.post('/forms/submissions/' + s.id + '/claim').catch(() => {});
        el.append(ui.section(t('Your reply', 'നിങ്ങളുടെ മറുപടി'), ui.form([
          { name: 'reply', label: t('Reply (English)', 'മറുപടി (ഇംഗ്ലീഷ്)'), type: 'textarea', required: true, value: s.reply || '' },
          { name: 'reply_ml', label: t('Reply in Malayalam (shown to the family)', 'മലയാളത്തിൽ മറുപടി (കുടുംബത്തിന് കാണിക്കും)'), type: 'textarea', value: s.reply_ml || '' },
          { name: 'outcome', label: t('Outcome', 'ഫലം'), type: 'text', value: s.outcome || '' },
          { name: 'close', label: t('Close this case after replying', 'മറുപടിക്ക് ശേഷം അവസാനിപ്പിക്കുക'), type: 'checkbox' },
        ], async (v) => { await k.core.post('/forms/submissions/' + s.id + '/reply', v); k.toast(t('Reply saved. It reaches the hamlet on the next visit.', 'മറുപടി സേവ് ചെയ്തു. അടുത്ത സന്ദർശനത്തിൽ ഊരിലെത്തും.'), 'good'); k.go('#/m/surveys/queue'); }, { submitLabel: t('Send reply', 'മറുപടി അയയ്ക്കുക') })));
      }
    },
  },
};

async function fillList(box, k) {
  const { t, h, ui } = k;
  const defs = (await k.core.get('/forms')).filter((d) => d.can_capture);
  if (!defs.length) { box.append(ui.empty(t('No forms for your role yet.', 'നിങ്ങളുടെ റോളിന് ഇപ്പോൾ ഫോമുകൾ ഇല്ല.'))); return; }
  const byModule = {};
  for (const d of defs) (byModule[d.module] = byModule[d.module] || []).push(d);
  for (const [m, list] of Object.entries(byModule)) {
    box.append(ui.section(m, ui.grid(list.map((d) => ui.card({ title: t(d.title, d.title_ml), subtitle: { person: t('About a person', 'ഒരു വ്യക്തിയെക്കുറിച്ച്'), household: t('About a household', 'ഒരു വീടിനെക്കുറിച്ച്'), hamlet: t('About the hamlet', 'ഊരിനെക്കുറിച്ച്') }[d.subject], body: d.description || '', actions: [ui.button(t('Fill in', 'പൂരിപ്പിക്കുക'), () => k.go('#/m/surveys/fill?key=' + encodeURIComponent(d.key)), { tone: 'primary', small: true })] })))));
  }
}

async function mine(box, k) {
  const { t, ui } = k;
  const rows = await k.core.get('/forms/submissions?mine=1');
  if (!rows.length) { box.append(ui.empty(t('Nothing sent yet.', 'ഇതുവരെ ഒന്നും അയച്ചിട്ടില്ല.'))); return; }
  box.append(ui.grid(rows.map((s) => ui.submissionCard(s, { onSeen: async () => { await k.core.post('/forms/submissions/' + s.id + '/seen'); k.refresh(); } })), 280));
}

// Minimal CSV parser (quotes, commas, newlines) for pasted XLSForm sheets.
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return head ? body.map((r) => Object.fromEntries(head.map((hd, i) => [hd.trim(), (r[i] || '').trim()]))) : [];
}

async function design(box, k) {
  const { t, h, ui } = k;
  const defs = await k.core.get('/forms');
  box.append(ui.section(t('Forms and their data', 'ഫോമുകളും ഡാറ്റയും'), ui.table([
    { key: 'title', label: t('Form', 'ഫോം'), render: (d) => t(d.title, d.title_ml) },
    { key: 'module', label: t('Service', 'സേവനം') },
    { key: 'scope', label: t('Consent needed', 'വേണ്ട സമ്മതം') },
    { key: 'version', label: 'v' },
    { key: 'csv', label: 'CSV', render: (d) => (d.can_review || ['platform_admin', 'agency_admin'].includes(k.user.role) ? h('a', { href: '/api/core/forms/export/' + encodeURIComponent(d.key) + '.csv' }, t('Download', 'ഡൗൺലോഡ്')) : '') },
  ], defs)));
  const survey = h('textarea', { rows: 6, placeholder: 'type,name,label,label::Malayalam,required\ninteger,members,People in the house,വീട്ടിലെ ആളുകൾ,yes' });
  const choices = h('textarea', { rows: 4, placeholder: 'list_name,name,label,label::Malayalam\nyesno,yes,Yes,അതെ' });
  const key = h('input', { type: 'text', placeholder: 'survey.my_form' });
  const title = h('input', { type: 'text', placeholder: t('Form title', 'ഫോമിന്റെ പേര്') });
  const scope = h('select', null, ['survey', 'services', 'livelihood'].map((s) => h('option', { value: s }, s)));
  const subject = h('select', null, [['household', t('About a household', 'വീട്')], ['person', t('About a person', 'വ്യക്തി')], ['hamlet', t('About the hamlet', 'ഊര്')]].map(([v, l]) => h('option', { value: v }, l)));
  const review = h('input', { type: 'checkbox' });
  const out = h('div');
  box.append(ui.section(t('Import an ODK XLSForm', 'ODK XLSForm ഇറക്കുമതി'), [
    h('p', { class: 'small muted' }, t('Paste the "survey" and "choices" sheets saved as CSV. Supported: text, integer, decimal, date, select_one, select_multiple, image, geopoint, note, and simple relevance.', '"survey", "choices" ഷീറ്റുകൾ CSV ആയി ഒട്ടിക്കുക.')),
    h('label', null, t('Form key', 'ഫോം കീ'), key), h('label', null, t('Title', 'പേര്'), title),
    h('label', null, t('Consent scope', 'സമ്മതം'), scope), h('label', null, t('Subject', 'വിഷയം'), subject),
    h('label', { class: 'cb' }, review, t('Needs a reply from a reviewer', 'പരിശോധകന്റെ മറുപടി വേണം')),
    h('label', null, 'survey.csv', survey), h('label', null, 'choices.csv', choices),
    ui.button(t('Check and save', 'പരിശോധിച്ച് സേവ് ചെയ്യുക'), async () => {
      try {
        const conv = await k.core.post('/forms/import-xlsform', { survey: parseCsv(survey.value), choices: parseCsv(choices.value), settings: { form_id: key.value, form_title: title.value } });
        const def = { ...conv.def, scope: scope.value, subject: subject.value, review: review.checked ? { perm: 'forms.review' } : null };
        const saved = await k.core.post('/forms/defs', def);
        out.replaceChildren(ui.card({ title: t('Saved', 'സേവ് ചെയ്തു') + ': ' + saved.title + ' (v' + saved.version + ')', body: conv.skipped.length ? [h('p', null, t('Some rows were simplified or skipped:', 'ചില വരികൾ ഒഴിവാക്കി:')), h('ul', null, conv.skipped.map((x) => h('li', null, x)))] : t('All rows imported.', 'എല്ലാ വരികളും ഇറക്കുമതി ചെയ്തു.'), tone: 'good' }));
      } catch (e) { out.replaceChildren(ui.error(e)); }
    }, { tone: 'primary' }), out,
  ]));
}
