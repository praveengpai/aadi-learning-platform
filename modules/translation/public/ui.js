// AADI — Malayalam translation UI. No DOM work at import time.
const CSS = `
.translation-pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.translation-pair{grid-template-columns:1fr}}
.translation-pair textarea{width:100%;min-height:170px;padding:12px;border:1px solid #c4d0cb;border-radius:var(--r-m);font:inherit;resize:vertical;background:#fff}
.translation-out{min-height:170px;padding:12px;border:1px solid var(--line);border-radius:var(--r-m);background:var(--leaf-soft);font-family:var(--font-ml);font-size:1.12rem;line-height:1.75;white-space:pre-wrap}
.translation-out.empty{color:var(--ink-3);background:#fbfcfb;font-family:var(--font);font-size:1rem}
.translation-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
.translation-row{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:12px 14px;margin-bottom:10px}
.translation-row .en{color:var(--ink-2);margin-bottom:6px}
.translation-row .ml{font-family:var(--font-ml);font-size:1.08rem;line-height:1.7}
.translation-row textarea{width:100%;min-height:80px;font-family:var(--font-ml);font-size:1.05rem;padding:8px 10px;border:1px solid #c4d0cb;border-radius:var(--r-s)}
.translation-setup{background:var(--warn-bg);border-radius:var(--r-m);padding:14px 16px}
.translation-setup code{background:#fff;padding:2px 6px;border-radius:4px}
`;
const MODE_LABEL = {
  'modern-colloquial': ['Everyday (recommended)', 'സാധാരണ സംസാരഭാഷ'],
  'classic-colloquial': ['Gentle traditional', 'പരമ്പരാഗത സംസാരം'],
  'code-mixed': ['Mixed with English (youth)', 'ഇംഗ്ലീഷ് കലർന്ന'],
  formal: ['Formal (official letters)', 'ഔപചാരികം'],
};
const STATUS = { machine: ['Machine — not yet checked', 'warn'], approved: ['Checked by a native speaker', 'good'], edited: ['Corrected by a native speaker', 'good'] };

function setupNote(k, st) {
  if (st.configured) return null;
  return k.h('div', { class: 'translation-setup' },
    k.h('b', null, k.t('Live translation is not switched on yet.', 'തത്സമയ പരിഭാഷ ഇതുവരെ ഓൺ ആക്കിയിട്ടില്ല.')),
    k.h('p', { class: 'small', style: 'margin:6px 0 0' }, k.t('An administrator adds the Sarvam API key on the server (one line in deploy/.env: ', 'സെർവറിൽ Sarvam API കീ ചേർക്കണം ('), k.h('code', null, 'SARVAM_API_KEY=…'), k.t(') and re-runs the installer. Until then, sentences already in the translation memory still work — including offline at centre hubs.', '). അതുവരെ മെമ്മറിയിലുള്ള പരിഭാഷകൾ ലഭ്യമാണ്.')));
}

export default {
  views: {
    async home(el, k) {
      k.style(CSS, 'translation');
      const st = await k.api.get('/status');
      el.append(k.h('h1', null, k.t('Translate to everyday Malayalam', 'സാധാരണ മലയാളത്തിലേക്ക്')),
        k.h('p', { class: 'muted' }, k.t('Write in English. AADI translates into the Malayalam people actually speak — warm and simple, not formal or Sanskrit-heavy. Words in the AADI glossary (ഊര്, ഊരുകൂട്ടം, PSC…) are always kept right.', 'ഇംഗ്ലീഷിൽ എഴുതുക. ആളുകൾ സംസാരിക്കുന്ന ലളിതമായ മലയാളത്തിലേക്ക് മാറ്റും.')));
      const note = setupNote(k, st); if (note) el.append(note);
      const src = k.h('textarea', { placeholder: k.t('e.g. Tomorrow\'s class starts at 4 pm. Please bring your notebook.', 'ഉദാ: Tomorrow\'s class starts at 4 pm.'), 'aria-label': 'English text' });
      const out = k.h('div', { class: 'translation-out empty', 'aria-live': 'polite' }, k.t('The Malayalam will appear here.', 'മലയാളം ഇവിടെ കാണാം.'));
      const meta = k.h('div', { class: 'translation-meta' });
      const modeSel = k.h('select', { class: 'input', style: { maxWidth: '280px' } }, st.modes.map((m) => k.h('option', { value: m, selected: m === st.mode }, k.t(...MODE_LABEL[m]))));
      let last = null;
      const go = async (fresh) => {
        if (!src.value.trim()) return k.toast(k.t('Type something in English first.', 'ആദ്യം ഇംഗ്ലീഷിൽ എഴുതുക.'), 'warn');
        out.className = 'translation-out'; out.textContent = '…';
        try {
          last = await k.api.post('/translate', { text: src.value, mode: modeSel.value, context: 'manual', fresh });
          out.textContent = last.target;
          const s = STATUS[last.status] || [last.status, ''];
          meta.replaceChildren(k.ui.badge(k.t(s[0], s[0]), s[1]), last.cached ? k.ui.badge(k.t('From memory — no cost', 'മെമ്മറിയിൽ നിന്ന്'), 'info') : null,
            k.ui.speakBtn(last.target, 'ml'),
            k.ui.button('📋 ' + k.t('Copy', 'പകർത്തുക'), async () => { await navigator.clipboard.writeText(last.target); k.toast(k.t('Copied.', 'പകർത്തി.'), 'good'); }, { small: true }),
            last.cached ? k.ui.button(k.t('Translate again', 'വീണ്ടും'), () => go(true), { small: true, tone: 'ghost' }) : null);
        } catch (e) { out.className = 'translation-out empty'; out.textContent = e.message; meta.replaceChildren(); }
      };
      el.append(k.ui.card({ body: k.h('div', null,
        k.h('div', { class: 'row', style: { marginBottom: '10px' } }, k.h('label', { class: 'small muted' }, k.t('Style', 'ശൈലി')), modeSel, k.ui.button('→ ' + k.t('Translate', 'പരിഭാഷ'), () => go(false), { tone: 'primary' })),
        k.h('div', { class: 'translation-pair' }, src, k.h('div', null, out, meta))) }));
      el.append(k.ui.grid([
        k.ui.stat(k.t('Characters this month', 'ഈ മാസം'), (st.chars_this_month || 0).toLocaleString('en-IN'), k.t(`limit ${st.cap.toLocaleString('en-IN')}`, `പരിധി ${st.cap.toLocaleString('en-IN')}`)),
        k.ui.stat(k.t('Estimated cost', 'ചെലവ്'), '₹' + st.est_cost_inr, k.t(`at ₹${st.price_inr_per_10k} per 10,000 characters`, `10,000 അക്ഷരത്തിന് ₹${st.price_inr_per_10k}`)),
        k.ui.stat(k.t('Sentences in memory', 'മെമ്മറിയിൽ'), Object.values(st.memory || {}).reduce((a, b) => a + b, 0), k.t(`${(st.memory.approved || 0) + (st.memory.edited || 0)} checked by a native speaker`, 'പരിശോധിച്ചവ')),
        k.ui.stat(k.t('Service', 'സേവനം'), st.provider || k.t('Not connected', 'ബന്ധിപ്പിച്ചിട്ടില്ല'), k.t('style: ', 'ശൈലി: ') + st.mode),
      ], 200));
    },

    async review(el, k) {
      k.style(CSS, 'translation');
      const st = await k.api.get('/status');
      el.append(k.h('h1', null, k.t('Translation review', 'പരിഭാഷ പരിശോധന')),
        k.h('p', { class: 'muted' }, k.t('A native speaker from the community checks each machine translation. Approved and corrected versions are reused everywhere and synced to centre hubs for offline use.', 'സമൂഹത്തിലെ ഒരാൾ ഓരോ പരിഭാഷയും പരിശോധിക്കുന്നു.')));
      const note = setupNote(k, st); if (note) el.append(note);
      el.append(k.ui.tabs([
        { id: 'queue', label: k.t('To check', 'പരിശോധിക്കാൻ') + ` (${st.memory.machine || 0})`, render: (box) => list(k, box, 'machine') },
        { id: 'done', label: k.t('Checked', 'പരിശോധിച്ചവ'), render: (box) => list(k, box, '') },
        { id: 'glossary', label: k.t('Glossary', 'പദാവലി'), render: (box) => glossary(k, box) },
      ], 'queue'));
    },
  },
};

async function list(k, box, status) {
  const rows = (await k.api.get('/memory' + (status ? '?status=' + status : ''))).filter((r) => status || r.status !== 'machine');
  if (!rows.length) { box.append(k.ui.empty(status ? k.t('Nothing waiting. Every translation has been checked.', 'ഒന്നും ബാക്കിയില്ല.') : k.t('No checked translations yet.', 'ഇതുവരെ ഇല്ല.'))); return; }
  for (const r of rows) {
    const s = STATUS[r.status] || [r.status, ''];
    const ta = k.h('textarea', { 'aria-label': 'Malayalam' }, r.target);
    const card = k.h('div', { class: 'translation-row' },
      k.h('div', { class: 'en' }, r.source),
      status ? ta : k.h('div', { class: 'ml' }, r.target),
      k.h('div', { class: 'translation-meta' }, k.ui.badge(s[0], s[1]), k.h('span', { class: 'small muted' }, [r.mode, r.provider, r.reviewed_by_name ? '· ' + r.reviewed_by_name : '', r.uses ? `· used ${r.uses}×` : ''].filter(Boolean).join(' ')),
        k.ui.speakBtn(r.target, 'ml'),
        status ? k.ui.button('✓ ' + k.t('Approve', 'ശരി'), async () => { await k.api.post(`/memory/${r.id}/review`, { target: ta.value }); k.toast(k.t('Saved.', 'സേവ് ചെയ്തു.'), 'good'); card.remove(); }, { tone: 'primary', small: true }) : null,
        k.ui.button(k.t('Remove', 'നീക്കുക'), async () => { if (await k.ui.confirm(k.t('Remove this translation from memory?', 'നീക്കണോ?'))) { await k.api.del('/memory/' + r.id); card.remove(); } }, { tone: 'ghost', small: true })));
    box.append(card);
  }
}

async function glossary(k, box) {
  const rows = await k.api.get('/glossary');
  box.append(k.h('p', { class: 'small muted' }, k.t('These words are always translated this way (or kept in English). Add the words your hamlets actually use.', 'ഈ വാക്കുകൾ എപ്പോഴും ഇങ്ങനെ.')));
  box.append(k.ui.table([
    { key: 'term', label: 'English' },
    { key: 'preferred', label: 'മലയാളം', render: (g) => g.keep_as_is ? k.ui.badge(k.t('keep as is', 'അതേപടി'), 'info') : k.h('span', { class: 'ml' }, g.preferred) },
    { key: 'note', label: k.t('Note', 'കുറിപ്പ്') },
    { key: 'x', label: '', render: (g) => k.ui.button(k.t('Delete', 'നീക്കുക'), async () => { await k.api.del('/glossary/' + g.id); k.refresh(); }, { small: true, tone: 'ghost' }) },
  ], rows));
  box.append(k.ui.card({ title: k.t('Add a word', 'വാക്ക് ചേർക്കുക'), body: k.ui.form([
    { name: 'term', label: 'English', required: true },
    { name: 'preferred', label: 'മലയാളം' },
    { name: 'keep_as_is', label: k.t('Keep this word in English', 'ഇംഗ്ലീഷിൽ തന്നെ'), type: 'checkbox' },
    { name: 'note', label: k.t('Note (optional)', 'കുറിപ്പ്') },
  ], async (v) => { await k.api.post('/glossary', v); k.toast(k.t('Added.', 'ചേർത്തു.'), 'good'); k.refresh(); }, { submitLabel: k.t('Add', 'ചേർക്കുക') }) }));
}
