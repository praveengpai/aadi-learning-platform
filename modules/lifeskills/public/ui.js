// AADI — Life Skills & Digital: browser views. No DOM work at import time.

const CSS = `
.lifeskills-hero{display:flex;gap:14px;align-items:center;padding:16px;border-radius:var(--r-l);background:linear-gradient(135deg,var(--forest),var(--forest-2));color:#fff;margin-bottom:14px}
.lifeskills-hero .big{font-size:2.4rem;line-height:1}
.lifeskills-hero h2{margin:0;color:#fff;font-size:var(--step-1)}
.lifeskills-hero p{margin:.2em 0 0;opacity:.9}
.lifeskills-gate{border:2px solid var(--gold);background:var(--gold-soft);border-radius:var(--r-l);padding:14px 16px;margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.lifeskills-gate.ok{border-color:var(--good);background:var(--good-bg)}
.lifeskills-gate .ic{font-size:2rem}
.lifeskills-gate .tx{flex:1;min-width:180px}
.lifeskills-mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.lifeskills-mod{position:relative;display:flex;flex-direction:column;gap:6px;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-l);padding:14px;cursor:pointer;font:inherit;color:inherit;min-height:150px;transition:transform .12s, box-shadow .12s}
.lifeskills-mod:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(11,79,69,.12)}
.lifeskills-mod[aria-disabled="true"]{opacity:.55;cursor:not-allowed}
.lifeskills-mod .ic{font-size:2rem}
.lifeskills-mod .t{font-weight:700}
.lifeskills-mod .done{position:absolute;top:10px;right:12px;font-size:1.3rem}
.lifeskills-mod .lock{position:absolute;top:10px;right:12px}
.lifeskills-steps{display:flex;gap:6px;margin:6px 0 14px;flex-wrap:wrap}
.lifeskills-steps span{flex:1;min-width:70px;text-align:center;padding:6px;border-radius:999px;background:var(--line);font-size:var(--step--1);color:var(--ink-2)}
.lifeskills-steps span.on{background:var(--forest);color:#fff}
.lifeskills-steps span.done{background:var(--leaf-soft);color:var(--forest-ink)}
.lifeskills-lesson{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-l);padding:18px}
.lifeskills-lesson .ic{font-size:2.6rem}
.lifeskills-lesson ol{padding-left:1.2em;margin:.6em 0}
.lifeskills-lesson li{margin:.55em 0;font-size:1.08rem;line-height:1.55}
.lifeskills-scene{background:var(--paper);border-left:5px solid var(--gold);padding:14px 16px;border-radius:var(--r-m);font-size:1.1rem;margin-bottom:12px}
.lifeskills-choices{display:grid;gap:10px}
.lifeskills-choice{text-align:left;padding:14px 16px;border-radius:var(--r-m);border:2px solid var(--line);background:var(--surface);font:inherit;color:inherit;cursor:pointer;min-height:52px}
.lifeskills-choice:hover{border-color:var(--forest-2)}
.lifeskills-choice.good{border-color:var(--good);background:var(--good-bg)}
.lifeskills-choice.bad{border-color:var(--bad);background:var(--bad-bg)}
.lifeskills-feedback{margin-top:10px;padding:12px 14px;border-radius:var(--r-m);background:var(--info-bg)}
.lifeskills-docs{display:grid;gap:8px}
.lifeskills-doc{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);background:var(--surface);flex-wrap:wrap}
.lifeskills-doc .ic{font-size:1.6rem}
.lifeskills-doc .tx{flex:1;min-width:150px}
.lifeskills-seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}
.lifeskills-seg button{border:0;background:var(--surface);padding:6px 10px;font:inherit;font-size:var(--step--1);cursor:pointer;min-height:36px}
.lifeskills-seg button.on.have{background:var(--good);color:#fff}
.lifeskills-seg button.on.applied{background:var(--gold);color:#222}
.lifeskills-seg button.on.missing{background:var(--bad);color:#fff}
.lifeskills-seg button.on.not_needed{background:var(--ink-3);color:#fff}
.lifeskills-radar{display:block;margin:auto;max-width:340px;width:100%;height:auto}
.lifeskills-legend{display:flex;gap:14px;justify-content:center;font-size:var(--step--1)}
.lifeskills-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.lifeskills-rate{display:grid;gap:8px}
.lifeskills-rate .r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lifeskills-rate .r b{min-width:150px}
.lifeskills-rate .lv{display:flex;gap:4px}
.lifeskills-rate .lv button{width:44px;height:44px;border-radius:10px;border:2px solid var(--line);background:var(--surface);font-size:1.2rem;cursor:pointer}
.lifeskills-rate .lv button.on{border-color:var(--forest);background:var(--leaf-soft)}
`;

const LEVEL_ICON = ['', '🌱', '🌿', '🌳', '⭐'];
const DOC_STATUS = (k) => [['have', k.t('Have', 'ഉണ്ട്'), '✅'], ['applied', k.t('Applied', 'അപേക്ഷിച്ചു'), '⏳'], ['missing', k.t('Missing', 'ഇല്ല'), '❌'], ['not_needed', k.t('N/A', 'വേണ്ട'), '➖']];

function setup(k) { k.style(CSS, 'lifeskills-css'); }
const L = (k, o, f) => k.t(o[f], o[f + '_ml']);
const sayBtn = (k, text) => k.ui.speakBtn ? k.ui.speakBtn(text) : k.h('button', { class: 'btn ghost small', onclick: () => k.speak(text) }, '🔊');

async function whoFor(k) {
  if (k.params.person) return k.params.person;
  if (k.user.person_id && k.user.role === 'learner') return k.user.person_id;
  const me = await k.api.get('/me');
  const p = me.people.find((x) => x.ward) || me.people[0];
  return p ? p.id : null;
}

// ---------- radar (spider) chart, pure SVG ----------
function radar(k, skills, series) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 340, cx = 170, cy = 160, R = 110, n = skills.length;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} 330`); svg.setAttribute('class', 'lifeskills-radar'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', k.t('Soft skills chart', 'സോഫ്റ്റ് സ്കിൽ ചാർട്ട്'));
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v); return e; };
  for (let l = 1; l <= 4; l++) svg.append(el('polygon', { points: skills.map((_, i) => pt(i, l / 4).join(',')).join(' '), fill: 'none', stroke: '#d7e0db', 'stroke-width': 1 }));
  skills.forEach((s, i) => {
    const [x, y] = pt(i, 1); svg.append(el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: '#d7e0db' }));
    const [lx, ly] = pt(i, 1.2);
    const t = el('text', { x: lx, y: ly, 'text-anchor': lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle', 'dominant-baseline': 'middle', 'font-size': 12, fill: '#4b5e59' });
    t.textContent = s.icon + ' ' + L(k, s, 'label'); svg.append(t);
  });
  for (const ser of series) {
    if (!ser.ratings) continue;
    svg.append(el('polygon', { points: skills.map((s, i) => pt(i, (Number(ser.ratings[s.key]) || 0) / 4).join(',')).join(' '), fill: ser.fill, stroke: ser.stroke, 'stroke-width': 2.5, 'fill-opacity': 0.25 }));
  }
  return svg;
}

// ---------- learner home ----------
async function home(el, k) {
  setup(k);
  const pid = await whoFor(k);
  if (!pid) { el.append(k.ui.empty(k.t('No learner linked to this account.', 'ഈ അക്കൗണ്ടിൽ പഠിതാവില്ല.'))); return; }
  const [cat, prog] = await Promise.all([k.api.get('/catalog'), k.api.get('/progress/' + pid)]);
  const first = prog.person.name.split(' ')[0];
  const passed = prog.modules.filter((m) => m.passed).length;
  el.append(k.h('div', { class: 'lifeskills-hero' }, k.h('div', { class: 'big' }, '🧭'),
    k.h('div', { style: { flex: 1 } }, k.h('h2', null, k.t(`Ready for the city, ${first}?`, `${first}, നഗരത്തിന് തയ്യാറാണോ?`)),
      k.h('p', null, k.t(`${passed} of ${prog.modules.length} skills done · Documents ${prog.documents.readiness}% ready`, `${prog.modules.length}-ൽ ${passed} പൂർത്തിയായി · രേഖകൾ ${prog.documents.readiness}% തയ്യാർ`))),
    sayBtn(k, k.t('Life skills. Learn, practise and earn badges for city life and work.', 'ജീവിത നൈപുണ്യം. നഗര ജീവിതത്തിനും ജോലിക്കും പഠിക്കൂ, പരിശീലിക്കൂ, ബാഡ്ജ് നേടൂ.'))));

  const gate = prog.gate.passed;
  el.append(k.h('div', { class: 'lifeskills-gate' + (gate ? ' ok' : '') }, k.h('span', { class: 'ic' }, gate ? '🛡️' : '🔐'),
    k.h('div', { class: 'tx' }, k.h('b', null, gate ? k.t('Online safety: passed', 'ഓൺലൈൻ സുരക്ഷ: പാസായി') : k.t('Start here: Online safety', 'ഇവിടെ തുടങ്ങൂ: ഓൺലൈൻ സുരക്ഷ')),
      k.h('div', { class: 'small' }, gate ? k.t('All other modules are open for you.', 'മറ്റെല്ലാ ഭാഗങ്ങളും തുറന്നു.') : k.t('Everyone completes this first. It unlocks the rest.', 'എല്ലാവരും ആദ്യം ഇത് പൂർത്തിയാക്കണം. ബാക്കി തുറക്കും.'))),
    gate ? null : k.ui.button(k.t('Begin ▶', 'തുടങ്ങൂ ▶'), () => k.go(`#/m/lifeskills/module?key=digital_citizenship&person=${pid}`), { tone: 'primary' })));

  const tabs = [
    { id: 'learn', label: '📚 ' + k.t('Modules', 'പാഠങ്ങൾ'), render: async (t) => {
      const grid = k.h('div', { class: 'lifeskills-mods' });
      for (const m of prog.modules) {
        const meta = cat.modules.find((x) => x.key === m.key);
        const locked = !gate && !m.mandatory;
        grid.append(k.h('button', { class: 'lifeskills-mod', 'aria-disabled': locked ? 'true' : 'false', onclick: () => locked ? k.toast(k.t('Finish Online safety first 🔐', 'ആദ്യം ഓൺലൈൻ സുരക്ഷ പൂർത്തിയാക്കുക 🔐'), 'warn') : k.go(`#/m/lifeskills/module?key=${m.key}&person=${pid}`) },
          m.passed ? k.h('span', { class: 'done', title: k.t('Passed', 'പാസായി') }, '🏅') : locked ? k.h('span', { class: 'lock' }, '🔒') : null,
          k.h('span', { class: 'ic' }, m.icon), k.h('span', { class: 't' }, L(k, m, 'title')),
          k.h('span', { class: 'small muted' }, L(k, meta, 'summary')),
          k.h('div', { style: { marginTop: 'auto' } }, k.ui.progress(m.pct / 100)),
          k.h('span', { class: 'small muted' }, `⏱ ${meta.minutes} ${k.t('min', 'മിനിറ്റ്')} · ${m.track === 'digital' ? k.t('Digital & money', 'ഡിജിറ്റൽ, പണം') : k.t('City & work', 'നഗരം, ജോലി')}`)));
      }
      t.append(grid);
    } },
    { id: 'docs', label: '🗂️ ' + k.t('My documents', 'എന്റെ രേഖകൾ'), render: (t) => docsPanel(t, k, pid, prog.can_write) },
    { id: 'skills', label: '🕸️ ' + k.t('My strengths', 'എന്റെ കഴിവുകൾ'), render: (t) => skillsPanel(t, k, pid, k.user.person_id === pid ? 'self' : null) },
  ];
  el.append(k.ui.tabs(tabs, k.params.tab || 'learn'));
}

async function docsPanel(t, k, pid, canWrite = true) {
  const d = await k.api.get('/documents/' + pid);
  t.append(k.h('div', { class: 'row', style: { alignItems: 'center', gap: '12px', marginBottom: '10px' } },
    k.h('div', { style: { flex: 1, minWidth: '200px' } }, k.ui.progress(d.readiness / 100, k.t('Document readiness', 'രേഖകളുടെ തയ്യാറെടുപ്പ്'))),
    sayBtn(k, k.t('Mark each document: have, applied, or missing. Never type the number here.', 'ഓരോ രേഖയും അടയാളപ്പെടുത്തുക: ഉണ്ട്, അപേക്ഷിച്ചു, ഇല്ല. നമ്പർ ഇവിടെ ടൈപ്പ് ചെയ്യരുത്.'))));
  t.append(k.h('p', { class: 'small muted' }, '🔒 ' + k.t('We only keep whether you have each document — never the ID number.', 'രേഖ ഉണ്ടോ എന്ന് മാത്രം സൂക്ഷിക്കുന്നു — ID നമ്പർ ഒരിക്കലും ഇല്ല.')));
  const list = k.h('div', { class: 'lifeskills-docs' });
  for (const doc of d.documents) {
    const seg = k.h('div', { class: 'lifeskills-seg', role: 'group', 'aria-label': L(k, doc, 'label') });
    for (const [v, lab, ic] of DOC_STATUS(k)) {
      seg.append(k.h('button', { type: 'button', class: (doc.status === v ? 'on ' : '') + v, 'aria-pressed': doc.status === v ? 'true' : 'false', disabled: !canWrite, onclick: async () => {
        try { await k.api.put(`/documents/${pid}/${doc.key}`, { status: v, note: doc.note }); doc.status = v; [...seg.children].forEach((b) => { b.className = (b.dataset.v === v ? 'on ' : '') + b.dataset.v; b.setAttribute('aria-pressed', b.dataset.v === v); }); k.toast(k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); } catch (e) { k.toast(e.message, 'bad'); }
      }, 'data-v': v, title: lab }, ic + ' ' + lab));
    }
    list.append(k.h('div', { class: 'lifeskills-doc' }, k.h('span', { class: 'ic' }, doc.icon),
      k.h('div', { class: 'tx' }, k.h('b', null, L(k, doc, 'label')), k.h('div', { class: 'small muted' }, '📍 ' + L(k, doc, 'where')), doc.note ? k.h('div', { class: 'small' }, doc.note) : null), seg));
  }
  t.append(list);
}

async function skillsPanel(t, k, pid, rateAs) {
  const s = await k.api.get('/softskills/' + pid);
  t.append(k.ui.grid([
    k.ui.card({ title: k.t('Strengths map', 'കഴിവുകളുടെ മാപ്പ്'), body: [
      radar(k, s.skills, [{ ratings: s.self && s.self.ratings, fill: '#c9a227', stroke: '#9a7a10' }, { ratings: s.facilitator && s.facilitator.ratings, fill: '#0e6455', stroke: '#0b4f45' }]),
      k.h('div', { class: 'lifeskills-legend' }, k.h('span', null, k.h('i', { style: { background: '#c9a227' } }), k.t('My view', 'എന്റെ വിലയിരുത്തൽ')), k.h('span', null, k.h('i', { style: { background: '#0e6455' } }), k.t('Facilitator', 'ഫെസിലിറ്റേറ്റർ'))),
      s.facilitator && s.facilitator.note ? k.h('p', { class: 'small', style: { marginTop: '8px' } }, '💬 ' + s.facilitator.note) : null,
      !s.self && !s.facilitator ? k.ui.empty(k.t('No ratings yet.', 'ഇതുവരെ വിലയിരുത്തലില്ല.')) : null] }),
    rateAs ? k.ui.card({ title: rateAs === 'self' ? k.t('Rate yourself', 'സ്വയം വിലയിരുത്തുക') : k.t('Facilitator rating', 'ഫെസിലിറ്റേറ്റർ വിലയിരുത്തൽ'), body: rateForm(k, s, pid, () => { t.replaceChildren(); skillsPanel(t, k, pid, rateAs); }) }) : null,
  ].filter(Boolean), 300));
}

function rateForm(k, s, pid, done) {
  const cur = {};
  const box = k.h('div', { class: 'lifeskills-rate' });
  box.append(k.h('div', { class: 'small muted' }, s.rubric.map((r) => `${r.icon} ${L(k, r, 'label')}`).join('   ')));
  for (const sk of s.skills) {
    const lv = k.h('div', { class: 'lv' });
    for (const r of s.rubric) lv.append(k.h('button', { type: 'button', title: L(k, r, 'label') + ' — ' + L(k, r, 'desc'), 'aria-label': `${L(k, sk, 'label')}: ${L(k, r, 'label')}`, onclick: (e) => { cur[sk.key] = r.level; [...lv.children].forEach((b, i) => b.classList.toggle('on', i < r.level)); } }, LEVEL_ICON[r.level]));
    box.append(k.h('div', { class: 'r' }, k.h('b', null, sk.icon + ' ' + L(k, sk, 'label')), lv));
  }
  const note = k.h('textarea', { class: 'input', placeholder: k.t('Note (optional)', 'കുറിപ്പ് (ഐച്ഛികം)'), rows: 2, style: { width: '100%' } });
  box.append(note, k.ui.button(k.t('Save ratings', 'സേവ് ചെയ്യുക'), async () => { await k.api.post('/softskills/' + pid, { ratings: cur, note: note.value }); k.toast(k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); done(); }, { tone: 'primary' }));
  return box;
}

// ---------- module player: lessons → scenario → quiz ----------
async function moduleView(el, k) {
  setup(k);
  const pid = k.params.person || await whoFor(k);
  const m = await k.api.get('/modules/' + encodeURIComponent(k.params.key));
  const prog = await k.api.get('/progress/' + pid);
  const mp = prog.modules.find((x) => x.key === m.id);
  const state = { step: 0, choices: [], node: m.scenario.start, answers: [] };
  const total = m.lessons.length + 2;
  const stage = k.h('div');
  const steps = k.h('div', { class: 'lifeskills-steps', 'aria-hidden': 'true' });
  el.append(k.h('div', { class: 'row', style: { alignItems: 'center', gap: '10px', marginBottom: '6px' } },
    k.ui.button('← ' + k.t('Back', 'തിരികെ'), () => k.go('#/m/lifeskills/home' + (k.params.person && k.user.role !== 'learner' ? '?person=' + pid : '')), { tone: 'ghost', small: true }),
    k.h('h2', { style: { margin: 0, flex: 1 } }, m.icon + ' ' + L(k, m, 'title')), mp && mp.passed ? k.ui.badge('🏅 ' + k.t('Passed', 'പാസായി'), 'good') : null), steps, stage);

  const paintSteps = () => {
    steps.replaceChildren(...[...m.lessons.map((l, i) => '📖 ' + (i + 1)), '🎭 ' + k.t('Practice', 'പരിശീലനം'), '✅ ' + k.t('Quiz', 'ക്വിസ്')]
      .map((lab, i) => k.h('span', { class: i === state.step ? 'on' : i < state.step ? 'done' : '' }, lab)));
  };
  const go = (n) => { state.step = n; paintSteps(); render(); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };

  function render() {
    stage.replaceChildren();
    if (state.step < m.lessons.length) {
      const l = m.lessons[state.step];
      const pts = k.lang === 'ml' ? l.points_ml : l.points;
      stage.append(k.h('div', { class: 'lifeskills-lesson' },
        k.h('div', { class: 'row', style: { alignItems: 'center', gap: '12px' } }, k.h('span', { class: 'ic' }, l.icon), k.h('h3', { style: { flex: 1, margin: 0 } }, L(k, l, 'title')), sayBtn(k, L(k, l, 'title') + '. ' + pts.join(' '))),
        k.h('ol', null, pts.map((p) => k.h('li', null, p))),
        k.h('div', { class: 'row' }, state.step > 0 ? k.ui.button('← ' + k.t('Previous', 'മുമ്പത്തേത്'), () => go(state.step - 1), { tone: 'ghost' }) : null,
          k.ui.button(k.t('I understand →', 'മനസ്സിലായി →'), async () => { await k.api.post(`/progress/${pid}/${m.id}/lesson`, { lesson_id: l.id }); go(state.step + 1); }, { tone: 'primary' }))));
    } else if (state.step === m.lessons.length) scenario();
    else quiz();
  }

  function scenario() {
    const sc = m.scenario;
    const n = sc.nodes[state.node];
    const box = k.h('div', { class: 'lifeskills-lesson' }, k.h('h3', null, '🎭 ' + L(k, sc, 'title')));
    if (n.end) {
      box.append(k.h('div', { class: 'lifeskills-scene' }, L(k, n, 'text')), k.h('div', { class: 'row' },
        k.ui.button('↺ ' + k.t('Try again', 'വീണ്ടും'), () => { state.node = sc.start; state.choices = []; render(); }, { tone: 'ghost' }),
        k.ui.button(k.t('Go to quiz →', 'ക്വിസിലേക്ക് →'), async () => { const r = await k.api.post(`/progress/${pid}/${m.id}/scenario`, { choices: state.choices }); k.toast(k.t(`Practice score ${r.score}/${r.max}`, `പരിശീലന സ്കോർ ${r.score}/${r.max}`), 'info'); go(state.step + 1); }, { tone: 'primary' })));
      stage.append(box); return;
    }
    box.append(k.h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '8px' } }, k.h('div', { class: 'lifeskills-scene', style: { flex: 1 } }, L(k, n, 'text')), sayBtn(k, L(k, n, 'text'))));
    const choices = k.h('div', { class: 'lifeskills-choices' });
    const fb = k.h('div');
    n.choices.forEach((c, i) => {
      const b = k.h('button', { class: 'lifeskills-choice', onclick: () => {
        [...choices.children].forEach((x) => (x.disabled = true));
        b.classList.add(c.score === 2 ? 'good' : 'bad');
        state.choices.push(i);
        fb.replaceChildren(k.h('div', { class: 'lifeskills-feedback', role: 'status' }, (c.score === 2 ? '👍 ' : c.score === 1 ? '🤔 ' : '⚠️ ') + L(k, c, 'feedback')),
          k.h('div', { class: 'row', style: { marginTop: '10px' } }, k.ui.button(k.t('Continue →', 'തുടരുക →'), () => { state.node = c.next; render(); }, { tone: 'primary' })));
        k.speak(L(k, c, 'feedback'));
      } }, L(k, c, 'text'));
      choices.append(b);
    });
    box.append(choices, fb);
    stage.append(box);
  }

  function quiz() {
    const box = k.h('div', { class: 'lifeskills-lesson' }, k.h('h3', null, '✅ ' + k.t('Quick quiz', 'ചെറിയ ക്വിസ്')));
    m.quiz.forEach((q, qi) => {
      const opts = k.lang === 'ml' ? q.options_ml : q.options;
      const row = k.h('div', { class: 'lifeskills-choices', role: 'radiogroup' });
      opts.forEach((o, oi) => row.append(k.h('button', { class: 'lifeskills-choice', role: 'radio', 'aria-checked': 'false', onclick: () => { state.answers[qi] = oi; [...row.children].forEach((x, j) => { x.classList.toggle('good', j === oi); x.setAttribute('aria-checked', j === oi); }); } }, o)));
      box.append(k.h('div', { style: { margin: '14px 0' } }, k.h('div', { class: 'row', style: { alignItems: 'center', gap: '8px' } }, k.h('b', { style: { flex: 1 } }, `${qi + 1}. ${L(k, q, 'q')}`), sayBtn(k, L(k, q, 'q') + ' ' + opts.join('. '))), row));
    });
    const out = k.h('div');
    box.append(k.ui.button(k.t('Submit answers', 'ഉത്തരങ്ങൾ സമർപ്പിക്കുക'), async () => {
      if (state.answers.filter((x) => x !== undefined).length < m.quiz.length) return k.toast(k.t('Please answer every question.', 'എല്ലാ ചോദ്യങ്ങൾക്കും ഉത്തരം നൽകുക.'), 'warn');
      const r = await k.api.post(`/progress/${pid}/${m.id}/quiz`, { answers: state.answers });
      out.replaceChildren(k.ui.card({ tone: r.passed ? 'good' : 'warn', title: r.passed ? '🏅 ' + k.t('Well done — passed!', 'അഭിനന്ദനങ്ങൾ — പാസായി!') : k.t(`Score ${r.score}/${r.total} — try again`, `സ്കോർ ${r.score}/${r.total} — വീണ്ടും ശ്രമിക്കൂ`),
        body: [r.lessons_needed ? k.h('p', null, k.t(`Finish ${r.lessons_needed} more lesson(s) to pass.`, `പാസാകാൻ ${r.lessons_needed} പാഠം കൂടി.`)) : null,
          r.awards && r.awards.length ? k.h('p', null, k.t('Added to your Learning Passport: ', 'പഠന പാസ്‌പോർട്ടിൽ ചേർത്തു: ') + r.awards.join(', ')) : null,
          k.h('ul', null, r.results.map((x, i) => k.h('li', null, (x.correct ? '✅ ' : '❌ ') + L(k, x, 'why'))))],
        actions: [k.ui.button(k.t('Back to modules', 'പാഠങ്ങളിലേക്ക്'), () => k.go('#/m/lifeskills/home' + (k.user.role !== 'learner' ? '?person=' + pid : '')), { tone: 'primary' })] }));
      if (r.passed_now) k.speak(k.t('Well done! You passed.', 'അഭിനന്ദനങ്ങൾ! പാസായി.'));
    }, { tone: 'primary' }), out);
    stage.append(box);
  }
  paintSteps(); render();
}

// ---------- staff cohort ----------
async function staff(el, k) {
  setup(k);
  if (k.params.person) return staffPerson(el, k, k.params.person);
  let hamlet = null;
  const body = k.h('div');
  const load = async () => {
    body.replaceChildren(k.ui.loading());
    const [rows, st] = await Promise.all([k.api.get('/cohort' + (hamlet ? '?hamlet_id=' + hamlet : '')), k.api.get('/stats' + (hamlet ? '?hamlet_id=' + hamlet : ''))]);
    body.replaceChildren(
      k.ui.grid([k.ui.stat(k.t('Learners you can see', 'കാണാവുന്ന പഠിതാക്കൾ'), rows.length), k.ui.stat(k.t('Online-safety gate passed', 'ഓൺലൈൻ സുരക്ഷ പാസ്'), rows.filter((r) => r.gate).length), k.ui.stat(k.t('Avg document readiness', 'ശരാശരി രേഖ തയ്യാറെടുപ്പ്'), rows.length ? Math.round(rows.reduce((a, r) => a + r.docs_ready, 0) / rows.length) + '%' : '—'), k.ui.stat(k.t('Missing documents', 'ഇല്ലാത്ത രേഖകൾ'), rows.reduce((a, r) => a + r.docs_missing, 0))], 160),
      k.ui.section(k.t('Learners', 'പഠിതാക്കൾ'), k.ui.table([
        { key: 'name', label: k.t('Name', 'പേര്') },
        { key: 'gate', label: '🛡️', render: (r) => (r.gate ? '✅' : '—') },
        { key: 'passed', label: k.t('Modules', 'ഭാഗങ്ങൾ'), render: (r) => `${r.passed}/${r.total}` },
        { key: 'docs_ready', label: k.t('Documents', 'രേഖകൾ'), render: (r) => k.ui.badge(r.docs_ready + '%', r.docs_ready >= 80 ? 'good' : r.docs_ready >= 50 ? 'warn' : 'bad') },
      ], rows, { onRow: (r) => k.go('#/m/lifeskills/staff?person=' + r.id), empty: k.t('No learners with consent in Life Skills programmes here.', 'സമ്മതമുള്ള പഠിതാക്കളില്ല.') })),
      k.ui.button('📨 ' + k.t('Send document reminders to all', 'എല്ലാവർക്കും രേഖ ഓർമ്മപ്പെടുത്തൽ'), async () => { const r = await k.api.post('/documents/remind', { person_ids: rows.filter((x) => x.docs_missing).map((x) => x.id) }); k.toast(k.t(`${r.reminded} reminders queued`, `${r.reminded} ഓർമ്മപ്പെടുത്തലുകൾ`), 'good'); }),
      k.ui.section(k.t('Modules passed', 'പാസായ ഭാഗങ്ങൾ'), k.ui.bars(st.by_module.map((m) => ({ label: m.icon + ' ' + L(k, m, 'title'), value: typeof m.passed === 'number' ? m.passed : 0 })))));
  };
  el.append(k.h('div', { class: 'row', style: { alignItems: 'center', gap: '12px', marginBottom: '12px' } }, k.h('h2', { style: { margin: 0, flex: 1 } }, '🧭 ' + k.t('Life Skills cohort', 'ജീവിത നൈപുണ്യ ബാച്ച്')), k.ui.hamletSelect((v) => { hamlet = v; load(); })), body);
  load();
}

async function staffPerson(el, k, pid) {
  const prog = await k.api.get('/progress/' + pid);
  el.append(k.h('div', { class: 'row', style: { alignItems: 'center', gap: '10px' } }, k.ui.button('← ' + k.t('Cohort', 'ബാച്ച്'), () => k.go('#/m/lifeskills/staff'), { tone: 'ghost', small: true }), k.h('h2', { style: { margin: 0 } }, prog.person.name)),
    k.ui.tabs([
      { id: 'mods', label: k.t('Progress', 'പുരോഗതി'), render: (t) => t.append(k.ui.table([{ key: 'title', label: k.t('Module', 'ഭാഗം'), render: (m) => m.icon + ' ' + L(k, m, 'title') }, { key: 'pct', label: '%', render: (m) => k.ui.progress(m.pct / 100) }, { key: 'quiz', label: k.t('Quiz', 'ക്വിസ്'), render: (m) => (m.quiz_total ? `${m.quiz_score ?? '—'}/${m.quiz_total}` : '—') }, { key: 'passed', label: '🏅', render: (m) => (m.passed ? '✅' : '') }], prog.modules)) },
      { id: 'docs', label: k.t('Documents', 'രേഖകൾ'), render: async (t) => { await docsPanel(t, k, pid, true); t.append(k.ui.button('📨 ' + k.t('Send reminder', 'ഓർമ്മപ്പെടുത്തുക'), async () => { const r = await k.api.post('/documents/remind', { person_id: pid }); k.toast(r.reminded ? k.t('Reminder queued', 'ഓർമ്മപ്പെടുത്തൽ അയച്ചു') : k.t('Nothing pending', 'ഒന്നും ബാക്കിയില്ല'), 'good'); })); } },
      { id: 'skills', label: k.t('Soft skills', 'സോഫ്റ്റ് സ്കിൽസ്'), render: (t) => skillsPanel(t, k, pid, 'facilitator') },
    ]));
}

// ---------- insight (aggregates) ----------
async function insight(el, k) {
  setup(k);
  const st = await k.api.get('/stats');
  el.append(k.h('h2', null, '📊 ' + k.t('Life Skills impact', 'ജീവിത നൈപുണ്യ ഫലം')),
    k.h('p', { class: 'muted small' }, k.t('Aggregates only. Groups under 5 are shown as "<5" to protect privacy.', 'സംഗ്രഹം മാത്രം. 5-ൽ താഴെയുള്ള ഗ്രൂപ്പുകൾ "<5" ആയി കാണിക്കുന്നു.')),
    k.ui.grid([k.ui.stat(k.t('Learners', 'പഠിതാക്കൾ'), st.learners), k.ui.stat(k.t('Passed online safety', 'ഓൺലൈൻ സുരക്ഷ പാസായവർ'), st.gate_passed, st.gate_pct != null ? st.gate_pct + '%' : '')], 180),
    k.ui.section(k.t('Modules passed', 'പാസായ ഭാഗങ്ങൾ'), k.ui.bars(st.by_module.map((m) => ({ label: m.icon + ' ' + L(k, m, 'title'), value: typeof m.passed === 'number' ? m.passed : 0 })))),
    k.ui.section(k.t('Document readiness (% who have it)', 'രേഖ തയ്യാറെടുപ്പ് (% ഉള്ളവർ)'), k.ui.bars(st.documents.filter((d) => d.pct != null).map((d) => ({ label: d.icon + ' ' + L(k, d, 'label'), value: d.pct })), { max: 100, unit: '%' })));
}

export default { views: { home, module: moduleView, staff, insight } };
