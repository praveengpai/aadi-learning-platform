// AADI · exams — learner, teacher and admin views. No DOM access at import time.
const CSS = `
.exams-hero{display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:linear-gradient(135deg,var(--forest),#14695b);color:#fff;border-radius:var(--r-l);padding:16px 18px;margin-bottom:14px}
.exams-hero h2{margin:0;font-size:1.25rem;color:#fff}.exams-hero .muted{color:#d6ebe5}
.exams-hero .exams-big{font-size:2rem;font-weight:700;line-height:1}
.exams-hero .exams-sp svg polyline{stroke:#f3e7bf}
.exams-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}
.exams-tile{display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:var(--r-m);border:1px solid var(--line);background:var(--surface);cursor:pointer;text-align:left;font:inherit;color:inherit}
.exams-tile:hover,.exams-tile:focus{border-color:var(--forest);outline:none;box-shadow:0 0 0 2px var(--gold-soft)}
.exams-tile .i{font-size:1.5rem}.exams-tile b{font-size:1rem}.exams-tile small{color:var(--muted,#5b6b66)}
.exams-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:.78rem;background:var(--leaf-soft);color:var(--forest-ink)}
.exams-chip.warn{background:var(--warn-bg);color:var(--warn)}.exams-chip.bad{background:var(--bad-bg);color:var(--bad)}.exams-chip.info{background:var(--info-bg);color:var(--info)}
.exams-steps{display:flex;gap:2px;margin:6px 0;flex-wrap:nowrap;overflow-x:auto}
.exams-steps span{flex:1;min-width:52px;font-size:.68rem;text-align:center;padding:4px 2px;background:#eef2f0;color:#6b7a75;border-radius:4px}
.exams-steps span.on{background:var(--forest);color:#fff}.exams-steps span.cur{background:var(--gold);color:#1c2a27;font-weight:700}
.exams-q{font-size:1.08rem;line-height:1.5;margin:6px 0 10px}
.exams-q .ml{display:block;font-size:1rem;color:#355;margin-top:4px}
.exams-opts{display:flex;flex-direction:column;gap:8px}
.exams-opt{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--line);border-radius:var(--r-m);background:#fff;cursor:pointer;text-align:left;font:inherit;color:inherit;min-height:48px}
.exams-opt .bub{flex:0 0 30px;height:30px;border-radius:50%;border:2px solid #555;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem}
.exams-opt.sel{border-color:var(--forest);background:#eaf4f1}.exams-opt.sel .bub{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
.exams-opt.right{border-color:var(--good);background:var(--good-bg)}.exams-opt.wrong{border-color:var(--bad);background:var(--bad-bg)}
.exams-opt .ml{display:block;font-size:.9rem;color:#456}
.exams-bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-m);padding:8px 10px;margin-bottom:10px;flex-wrap:wrap}
.exams-timer{font-family:ui-monospace,monospace;font-size:1.2rem;font-weight:700;padding:2px 10px;border-radius:6px;background:var(--leaf-soft)}
.exams-timer.low{background:var(--bad-bg);color:var(--bad)}
.exams-omr{background:#fffdf6;border:2px solid #d9b8b8;border-radius:8px;padding:10px;max-height:60vh;overflow:auto}
.exams-omr h4{margin:0 0 6px;color:#8a2b2b;font-size:.85rem;letter-spacing:.04em;text-transform:uppercase}
.exams-omr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px}
.exams-omr-row{display:flex;align-items:center;gap:4px;padding:2px 3px;border-radius:4px;cursor:pointer}
.exams-omr-row.cur{background:#fde9c8}
.exams-omr-row .n{width:28px;font-family:ui-monospace,monospace;font-size:.78rem;color:#8a2b2b;text-align:right}
.exams-omr-row i{width:20px;height:20px;border-radius:50%;border:1.5px solid #c78c8c;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:.64rem;color:#b36b6b;background:#fff}
.exams-omr-row i.f{background:#111;border-color:#111;color:#111}
.exams-omr-row i.r{background:var(--good);border-color:var(--good);color:#fff}.exams-omr-row i.w{background:var(--bad);border-color:var(--bad);color:#fff}.exams-omr-row i.k{border-color:var(--good);border-width:2.5px}
.exams-sec{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#8a2b2b;grid-column:1/-1;margin-top:6px;border-bottom:1px dashed #d9b8b8}
.exams-layout{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:900px){.exams-layout{grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr)}}
.exams-score{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.exams-ring{width:110px;height:110px}
.exams-heat{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}
.exams-heat div{padding:8px;border-radius:6px;font-size:.82rem}
.exams-flash{border:1px solid var(--line);border-radius:var(--r-l);padding:16px;background:#fff;min-height:220px}
.exams-grades{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
.exams-grades .btn{padding:10px 4px;font-size:.85rem}
.exams-affair{border-left:4px solid var(--gold);padding:8px 12px;margin:8px 0;background:#fff;border-radius:0 var(--r-m) var(--r-m) 0}
.exams-affair h4{margin:0 0 4px;font-size:1rem}
.exams-cal{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}
.exams-cal .d{flex:0 0 58px;text-align:center;border-radius:8px;background:var(--leaf-soft);padding:6px 2px}
.exams-cal .d b{display:block;font-size:1.3rem}.exams-cal .d small{font-size:.7rem}
.exams-docs label{display:flex;gap:8px;align-items:center;padding:4px 0}
.exams-mini{font-size:.8rem;color:#5b6b66}
.exams-lb td:first-child{font-weight:700;width:36px}
.exams-say{border:none;background:none;cursor:pointer;font-size:1.1rem;padding:0 4px;vertical-align:middle}
`;

const pct = (x) => (x === null || x === undefined ? '—' : Math.round(x) + '%');
const fmtDate = (d, k) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return String(d).slice(0, 10); } };
const L4 = ['A', 'B', 'C', 'D'];
const tone = (p) => (p >= 60 ? 'good' : p >= 40 ? 'warn' : 'bad');

function setup(k) { k.style(CSS, 'exams-css'); }
// Set children safely: k.h drops null/false and flattens arrays (native replaceChildren would print "null").
const fill = (k, el, ...kids) => { el.replaceChildren(...k.h('div', null, kids).childNodes); return el; };
function say(k, en, ml) { return k.h('button', { class: 'exams-say', title: k.t('Read aloud', 'വായിച്ചുകേൾക്കുക'), 'aria-label': k.t('Read aloud', 'വായിച്ചുകേൾക്കുക'), onclick: (e) => { e.stopPropagation(); k.speak(k.lang === 'ml' && ml ? ml : en); } }, '🔊'); }
function qText(k, q) { return k.lang === 'ml' && q.q_ml ? [k.h('span', { class: 'ml' }, q.q_ml), q.q && q.q !== q.q_ml ? k.h('span', { class: 'small muted', style: { display: 'block' } }, q.q) : null] : [q.q, q.q_ml ? k.h('span', { class: 'ml' }, q.q_ml) : null]; }
function optText(k, q, i) { const en = q.options[i]; const ml = q.options_ml && q.options_ml[i]; return [en, ml && ml !== en ? k.h('span', { class: 'ml' }, ml) : null]; }
function ring(k, p) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 42 42'); s.setAttribute('class', 'exams-ring');
  const c = (r, col, dash) => { const e = document.createElementNS(ns, 'circle'); e.setAttribute('cx', 21); e.setAttribute('cy', 21); e.setAttribute('r', 15.9); e.setAttribute('fill', 'none'); e.setAttribute('stroke', col); e.setAttribute('stroke-width', 4); if (dash) { e.setAttribute('stroke-dasharray', dash); e.setAttribute('transform', 'rotate(-90 21 21)'); e.setAttribute('stroke-linecap', 'round'); } return e; };
  s.append(c(0, '#e6ece9'), c(0, p >= 60 ? '#2f7d4a' : p >= 40 ? '#c9a227' : '#b3261e', `${Math.max(0, p)} ${100 - Math.max(0, p)}`));
  const t = document.createElementNS(ns, 'text'); t.setAttribute('x', 21); t.setAttribute('y', 24); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', 9); t.setAttribute('font-weight', 700); t.textContent = Math.round(p) + '%';
  s.append(t); return s;
}
function steps(k, meta, status) {
  const idx = meta.steps.findIndex((s) => s.id === status);
  return k.h('div', { class: 'exams-steps' }, meta.steps.map((s, i) => k.h('span', { class: i < idx ? 'on' : i === idx ? 'cur' : '' }, k.t(s.label, s.label_ml))));
}
let META = null;
async function meta(k) { if (!META) META = await k.api.get('/meta'); return META; }
function back(k, href, label) { return k.h('a', { href, class: 'small', style: { display: 'inline-block', marginBottom: '8px' } }, '← ', label || k.t('Back', 'തിരികെ')); }
const pq = (k) => (k.params.person_id ? '?person_id=' + encodeURIComponent(k.params.person_id) : '');

// ======================================================================= learner home
async function home(el, k) {
  setup(k);
  if (k.user.role !== 'learner' && !k.params.person_id) return pickPerson(el, k, 'home');
  const [d, m] = await Promise.all([k.api.get('/dashboard' + pq(k)), meta(k)]);
  const self = k.user.person_id === d.person.id;
  const st = d.stats;
  const hero = k.h('div', { class: 'exams-hero' },
    k.h('div', { style: { flex: '1 1 220px' } },
      k.h('div', { class: 'muted small' }, k.t('Exam preparation', 'പരീക്ഷാ പരിശീലനം'), d._offline ? ' · ' + k.t('offline copy', 'ഓഫ്‌ലൈൻ') : ''),
      k.h('h2', null, self ? k.t(`Keep going, ${d.person.name.split(' ')[0]}!`, `മുന്നോട്ട്, ${d.person.name.split(' ')[0]}!`) : d.person.name),
      k.h('div', { class: 'muted small' }, d.person.aspirations ? k.t('Goal: ', 'ലക്ഷ്യം: ') + d.person.aspirations : '')),
    k.h('div', { style: { textAlign: 'center' } }, k.h('div', { class: 'exams-big' }, pct(st.last)), k.h('div', { class: 'muted small' }, k.t('last mock', 'അവസാന മോക്ക്'))),
    k.h('div', { style: { textAlign: 'center' } }, k.h('div', { class: 'exams-big' }, pct(st.best)), k.h('div', { class: 'muted small' }, k.t('best', 'മികച്ചത്'))),
    k.h('div', { class: 'exams-sp' }, k.ui.spark(d.trend.map((t) => t.pct), { w: 140, hgt: 40 }), k.h('div', { class: 'muted small' }, k.t(`${st.mocks} mocks · ${st.practice} practice`, `${st.mocks} മോക്ക് · ${st.practice} പരിശീലനം`))));
  el.append(hero);

  if (self) {
    const tile = (icon, en, ml, sub, href) => k.h('button', { class: 'exams-tile', onclick: () => k.go(href) }, k.h('span', { class: 'i' }, icon), k.h('b', null, k.t(en, ml)), k.h('small', null, sub));
    el.append(k.h('div', { class: 'exams-tiles' },
      tile('📝', 'Mock test', 'മോക്ക് ടെസ്റ്റ്', k.t('Timed · OMR sheet', 'സമയബന്ധിതം · OMR'), '#/m/exams/mocks'),
      tile('🔁', 'Revision', 'റിവിഷൻ', d.revision.due ? k.t(`${d.revision.due} due today`, `ഇന്ന് ${d.revision.due} എണ്ണം`) : k.t('All done today ✓', 'ഇന്നത്തേത് കഴിഞ്ഞു ✓'), '#/m/exams/revise'),
      tile('🎯', 'Practice', 'പരിശീലനം', k.t('By subject / weak topics', 'വിഷയം / ദുർബല ഭാഗങ്ങൾ'), '#/m/exams/practice'),
      tile('📰', 'Current affairs', 'ആനുകാലികം', k.t('Listen in 1 minute', 'ഒരു മിനിറ്റിൽ കേൾക്കാം'), '#/m/exams/affairs'),
      tile('📅', 'Exam calendar', 'പരീക്ഷാ കലണ്ടർ', k.t('Deadlines & applications', 'അവസാന തീയതികൾ'), '#/m/exams/calendar'),
      tile('🏅', 'Leaderboard', 'ലീഡർബോർഡ്', d.prefs.leaderboard ? k.t('You are on it', 'നിങ്ങൾ ഉണ്ട്') : k.t('Opt-in only', 'സമ്മതിച്ചവർ മാത്രം'), '#/m/exams/leaderboard')));
  }

  if (d.assignments.length) {
    el.append(k.ui.card({ title: k.t('Assigned by your teacher', 'അധ്യാപകർ നൽകിയത്'), tone: 'feature', body: d.assignments.map((a) => k.h('div', { class: 'row', style: { justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' } },
      k.h('div', null, k.h('b', null, k.t(a.title, a.title_ml || a.title)), k.h('div', { class: 'exams-mini' }, a.agency_name, ' · ', k.t('due ', 'അവസാനം '), fmtDate(a.due, k))),
      self ? k.ui.button(k.t('Start', 'തുടങ്ങുക'), () => startAttempt(k, { assignment_id: a.id }), { tone: 'primary', small: true }) : k.ui.badge(k.t('pending', 'ബാക്കി'), 'warn'))) }));
  }

  const apps = d.applications.filter((a) => a.exam && a.status !== 'result');
  const grid = [];
  grid.push(k.ui.card({
    title: k.t('My applications', 'എന്റെ അപേക്ഷകൾ'),
    body: apps.length ? apps.map((a) => k.h('div', { style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } },
      k.h('div', { class: 'row', style: { justifyContent: 'space-between' } }, k.h('b', null, k.t(a.exam.title, a.exam.title_ml || a.exam.title)), a.exam.demo ? k.ui.badge('DEMO', 'info') : null),
      steps(k, m, a.status),
      k.h('div', { class: 'exams-mini' }, a.exam.apply_by && ['interested', 'docs_ready'].includes(a.status) ? k.t('Apply by ', 'അപേക്ഷിക്കേണ്ടത് ') + fmtDate(a.exam.apply_by, k) + ' · ' : '', k.t('Exam ', 'പരീക്ഷ ') + fmtDate(a.exam.exam_date, k)),
    )) : k.ui.empty(k.t('No applications yet — open the exam calendar.', 'അപേക്ഷകൾ ഇല്ല — കലണ്ടർ തുറക്കുക.')),
    actions: [k.ui.button(k.t('Open tracker', 'ട്രാക്കർ തുറക്കുക'), () => k.go('#/m/exams/calendar' + pq(k)), { small: true })],
  }));
  grid.push(k.ui.card({
    title: k.t('Topics to work on', 'ശ്രദ്ധിക്കേണ്ട ഭാഗങ്ങൾ'),
    body: d.weak.length ? k.ui.bars(d.weak.map((w) => ({ label: `${k.t(w.subject_label, w.subject_ml)} · ${w.topic}`, value: w.accuracy, colour: w.accuracy < 40 ? '#b3261e' : w.accuracy < 60 ? '#c9a227' : '#2f7d4a' })), { max: 100, unit: '%' }) : k.ui.empty(k.t('Write a mock test to see your weak topics.', 'ഒരു മോക്ക് എഴുതിയാൽ ദുർബല ഭാഗങ്ങൾ കാണാം.')),
    actions: self && d.weak.length ? [k.ui.button(k.t('Practise weak topics', 'ദുർബല ഭാഗങ്ങൾ പരിശീലിക്കുക'), () => startAttempt(k, { pattern: 'practice', weak: true, n: 15 }), { tone: 'primary', small: true }), k.ui.button(k.t('Full analysis', 'വിശകലനം'), () => k.go('#/m/exams/analysis' + pq(k)), { small: true })] : [k.ui.button(k.t('Full analysis', 'വിശകലനം'), () => k.go('#/m/exams/analysis' + pq(k)), { small: true })],
  }));
  grid.push(k.ui.card({
    title: k.t('Recent tests', 'അടുത്തിടെ എഴുതിയത്'),
    body: k.ui.table([
      { label: k.t('Test', 'ടെസ്റ്റ്'), render: (r) => k.h('span', null, r.title, k.h('div', { class: 'exams-mini' }, fmtDate(r.submitted_at, k))) },
      { label: k.t('Score', 'സ്കോർ'), render: (r) => k.ui.badge(pct(r.pct), tone(r.pct)) },
    ], d.recent.slice(0, 6), { onRow: (r) => k.go('#/m/exams/result?id=' + r.id), empty: k.t('No tests yet.', 'ടെസ്റ്റുകൾ ഇല്ല.') }),
  }));
  grid.push(k.ui.card({
    title: k.t('Current affairs', 'ആനുകാലികം'),
    body: d.affairs.map((a) => k.h('div', { class: 'exams-affair' }, k.h('h4', null, k.t(a.title, a.title_ml || a.title), say(k, a.title + '. ' + a.body, (a.title_ml || '') + '. ' + (a.body_ml || '')))) ),
    actions: [k.ui.button(k.t('All items', 'എല്ലാം'), () => k.go('#/m/exams/affairs'), { small: true })],
  }));
  el.append(k.ui.grid(grid, 300));
}

async function pickPerson(el, k, view) {
  el.append(k.ui.card({ title: k.t('Choose a learner', 'പഠിതാവിനെ തിരഞ്ഞെടുക്കുക'), body: k.ui.personPicker({ onPick: (p) => k.go(`#/m/exams/${view}?person_id=${p.id}`) }) }));
  if (k.user.role !== 'guardian') el.append(k.h('p', { class: 'small muted' }, k.t('Teachers: use "Exam batches" for your agency\'s learners.', 'അധ്യാപകർ: "പരീക്ഷാ ബാച്ചുകൾ" ഉപയോഗിക്കുക.')));
}

// ======================================================================= mocks list
async function mocks(el, k) {
  setup(k);
  const m = await meta(k);
  el.append(back(k, '#/m/exams/home'), k.h('h2', null, k.t('Mock tests', 'മോക്ക് ടെസ്റ്റുകൾ')));
  el.append(k.h('p', { class: 'small muted' }, k.t('Timed tests in the real exam pattern, with an OMR answer sheet. Wrong answers reduce marks (negative marking) — leave a question blank if you have no idea.', 'യഥാർത്ഥ പരീക്ഷാ മാതൃകയിൽ OMR ഷീറ്റോടെ. തെറ്റിന് മാർക്ക് കുറയും — അറിയില്ലെങ്കിൽ വിട്ടേക്കുക.')));
  for (const b of m.bodies) {
    el.append(k.ui.section(`${b.icon} ${k.t(b.title, b.title_ml)}`, k.ui.grid(b.patterns.map((p) => k.ui.card({
      title: k.t(p.title, p.title_ml),
      subtitle: `${p.n} ${k.t('questions', 'ചോദ്യങ്ങൾ')} · ${p.minutes} ${k.t('min', 'മിനിറ്റ്')} · −${p.neg === 0.25 ? '¼' : '⅓'} ${k.t('per wrong', 'ഓരോ തെറ്റിനും')}`,
      body: k.h('div', { class: 'exams-mini' }, p.sections.map((s) => `${k.t(s.label, s.label_ml)} ${s.n}`).join(' · ')),
      actions: k.user.role === 'learner' ? [k.ui.button(k.t('Start test', 'ആരംഭിക്കുക'), () => startAttempt(k, { pattern: p.id }), { tone: 'primary' })] : null,
    })), 260)));
  }
  el.append(k.h('p', { class: 'small muted' }, m.bodies[0]?.patterns[0]?.note));
}

async function startAttempt(k, body) {
  const a = await k.api.post('/attempts', body);
  if (a && a.queued) return k.toast(k.t('You are offline — tests need a connection to start.', 'ഓഫ്‌ലൈൻ — ടെസ്റ്റ് തുടങ്ങാൻ കണക്ഷൻ വേണം.'), 'warn');
  try { localStorage.setItem('exams.att.' + a.id, JSON.stringify(a)); } catch (_) { /* ignore */ }
  k.go('#/m/exams/test?id=' + a.id);
}

// ======================================================================= OMR test
async function test(el, k) {
  setup(k);
  let a; try { a = JSON.parse(localStorage.getItem('exams.att.' + k.params.id)); } catch (_) { a = null; }
  if (!a) a = await k.api.get('/attempts/' + k.params.id);
  if (a.status === 'submitted') return k.go('#/m/exams/result?id=' + a.id);
  const practice = a.pattern === 'practice';
  const key = 'exams.ans.' + a.id;
  let saved = null; try { saved = JSON.parse(localStorage.getItem(key)); } catch (_) { /* */ }
  const ans = saved?.answers || a.questions.map(() => null);
  const marked = new Set(saved?.marked || []);
  const started = new Date(a.started_at).getTime();
  const limit = a.minutes ? a.minutes * 60e3 : 0;
  let cur = 0, timer = null, done = false;
  const persist = () => { try { localStorage.setItem(key, JSON.stringify({ answers: ans, marked: [...marked] })); } catch (_) { /* */ } };

  const timerEl = k.h('span', { class: 'exams-timer' });
  const countEl = k.h('span', { class: 'small' });
  const qBox = k.h('div');
  const omr = k.h('div', { class: 'exams-omr' });
  const bar = k.h('div', { class: 'exams-bar' }, k.h('b', null, a.title), countEl, limit ? timerEl : null, k.ui.button(k.t('Submit', 'സമർപ്പിക്കുക'), () => submit(false), { tone: 'primary', small: true }));
  el.append(bar, k.h('div', { class: 'exams-layout' }, k.ui.card({ body: qBox }), k.h('div', null, omr, !practice ? k.h('p', { class: 'small muted' }, k.t(`Marking: +${a.mark} correct, −${(a.mark * a.neg).toFixed(2)} wrong, 0 blank.`, `മാർക്ക്: ശരി +${a.mark}, തെറ്റ് −${(a.mark * a.neg).toFixed(2)}, ഒഴിവ് 0.`)) : null)));

  function tick() {
    if (!limit || done) return;
    const left = Math.max(0, started + limit - Date.now());
    const m = Math.floor(left / 60e3), s = Math.floor((left % 60e3) / 1000);
    timerEl.textContent = `⏱ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    timerEl.classList.toggle('low', left < 5 * 60e3);
    if (!timerEl.isConnected) { clearInterval(timer); return; }
    if (left <= 0) { clearInterval(timer); k.toast(k.t('Time is up — submitting your answers.', 'സമയം കഴിഞ്ഞു — സമർപ്പിക്കുന്നു.'), 'warn'); submit(true); }
  }
  function renderOmr() {
    const rows = [];
    let lastSec = null;
    a.questions.forEach((q, i) => {
      if (!practice && q.section !== lastSec) { lastSec = q.section; const s = (a.sections || []).find((x) => x.key === q.section); rows.push(k.h('div', { class: 'exams-sec' }, s ? k.t(s.label, s.label_ml) : q.section)); }
      rows.push(k.h('div', { class: 'exams-omr-row' + (i === cur ? ' cur' : ''), onclick: () => { cur = i; render(); } }, k.h('span', { class: 'n' }, (i + 1) + (marked.has(i) ? '★' : '')), L4.map((L, j) => k.h('i', { class: ans[i] === j ? 'f' : '' }, L))));
    });
    omr.replaceChildren(k.h('h4', null, k.t('OMR answer sheet', 'ഒ.എം.ആർ. ഉത്തരക്കടലാസ്')), k.h('div', { class: 'exams-omr-grid' }, rows));
    const n = ans.filter((x) => x !== null).length;
    countEl.textContent = k.t(`${n}/${a.questions.length} answered`, `${n}/${a.questions.length} ഉത്തരം`);
  }
  function render() {
    const q = a.questions[cur];
    const s = (a.sections || []).find((x) => x.key === q.section);
    const reveal = practice && ans[cur] !== null && q.answer !== undefined;
    fill(k, qBox,
      k.h('div', { class: 'row small muted', style: { justifyContent: 'space-between' } }, k.h('span', null, k.t('Question', 'ചോദ്യം'), ` ${cur + 1} / ${a.questions.length}`), k.h('span', null, s ? k.t(s.label, s.label_ml) : q.subject, ' ', say(k, q.q + '. ' + q.options.map((o, j) => L4[j] + ', ' + o).join('. '), q.q_ml ? q.q_ml + '. ' + (q.options_ml || q.options).map((o, j) => L4[j] + ', ' + o).join('. ') : null))),
      k.h('div', { class: 'exams-q' }, qText(k, q)),
      k.h('div', { class: 'exams-opts', role: 'radiogroup' }, q.options.map((_, j) => k.h('button', {
        class: 'exams-opt' + (ans[cur] === j ? ' sel' : '') + (reveal && j === q.answer ? ' right' : '') + (reveal && ans[cur] === j && j !== q.answer ? ' wrong' : ''),
        role: 'radio', 'aria-checked': String(ans[cur] === j),
        onclick: () => { if (reveal) return; ans[cur] = ans[cur] === j ? null : j; persist(); render(); },
      }, k.h('span', { class: 'bub' }, L4[j]), k.h('span', null, optText(k, q, j))))),
      reveal && (q.x || q.x_ml) ? k.h('div', { class: 'card tone-info', style: { marginTop: '10px' } }, ans[cur] === q.answer ? '✅ ' : '❌ ', k.t(q.x || q.x_ml, q.x_ml || q.x)) : null,
      k.h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'space-between' } },
        k.ui.button('◀ ' + k.t('Previous', 'മുമ്പത്തെ'), () => { cur = Math.max(0, cur - 1); render(); }, { tone: 'ghost', small: true, disabled: cur === 0 }),
        k.ui.button(ans[cur] === null ? k.t('Clear', 'മായ്ക്കുക') : k.t('Clear answer', 'ഉത്തരം മായ്ക്കുക'), () => { ans[cur] = null; persist(); render(); }, { tone: 'ghost', small: true, disabled: ans[cur] === null || reveal }),
        k.ui.button(marked.has(cur) ? '★ ' + k.t('Marked', 'അടയാളപ്പെടുത്തി') : '☆ ' + k.t('Mark for review', 'പിന്നീട് നോക്കാൻ'), () => { marked.has(cur) ? marked.delete(cur) : marked.add(cur); persist(); render(); }, { tone: 'ghost', small: true }),
        k.ui.button(k.t('Next', 'അടുത്തത്') + ' ▶', () => { cur = Math.min(a.questions.length - 1, cur + 1); render(); }, { tone: 'primary', small: true, disabled: cur === a.questions.length - 1 })));
    renderOmr();
  }
  async function submit(auto) {
    if (done) return;
    const blank = ans.filter((x) => x === null).length;
    if (!auto && !(await k.ui.confirm(blank ? k.t(`${blank} question(s) are blank. Submit now?`, `${blank} ചോദ്യങ്ങൾ ബാക്കി. സമർപ്പിക്കട്ടെ?`) : k.t('Submit your answer sheet?', 'ഉത്തരക്കടലാസ് സമർപ്പിക്കട്ടെ?')))) return;
    done = true; clearInterval(timer);
    const r = await k.api.post(`/attempts/${a.id}/submit`, { answers: ans, duration_s: Math.round((Date.now() - started) / 1000) });
    if (r && r.queued) { k.toast(k.t('Saved. Your score will appear when you are back online.', 'സൂക്ഷിച്ചു. ഓൺലൈനാകുമ്പോൾ ഫലം കാണാം.'), 'warn'); return k.go('#/m/exams/home'); }
    try { localStorage.removeItem(key); localStorage.removeItem('exams.att.' + a.id); } catch (_) { /* */ }
    k.go('#/m/exams/result?id=' + a.id);
  }
  render();
  if (limit) { tick(); timer = setInterval(tick, 1000); }
}

// ======================================================================= result
async function result(el, k) {
  setup(k);
  const a = await k.api.get('/attempts/' + k.params.id);
  const r = a.result;
  el.append(back(k, '#/m/exams/home'));
  el.append(k.ui.card({ title: a.title, subtitle: fmtDate(a.submitted_at, k) + (r.duration_s ? ` · ${Math.round(r.duration_s / 60)} ${k.t('min', 'മിനിറ്റ്')}` : ''), tone: 'feature', body: k.h('div', { class: 'exams-score' },
    ring(k, r.pct),
    k.ui.kv([[k.t('Score', 'സ്കോർ'), `${r.score} / ${r.max_score}`], [k.t('Correct', 'ശരി'), `✅ ${r.correct}`], [k.t('Wrong', 'തെറ്റ്'), `❌ ${r.wrong}${a.neg ? ` (−${(r.wrong * a.mark * a.neg).toFixed(2)})` : ''}`], [k.t('Blank', 'ഒഴിവാക്കിയത്'), `⚪ ${r.blank}`]]),
    k.h('div', { class: 'small muted', style: { maxWidth: '280px' } }, a.neg && r.wrong > r.blank ? k.t('Tip: many wrong answers cost you marks. Guess only when you can rule out two options.', 'നിർദ്ദേശം: തെറ്റുകൾ മാർക്ക് കുറയ്ക്കുന്നു. രണ്ട് ഓപ്ഷൻ ഒഴിവാക്കാൻ കഴിയുമ്പോൾ മാത്രം ഊഹിക്കുക.') : k.t('Wrong and skipped questions were added to your revision queue.', 'തെറ്റിയതും വിട്ടതും റിവിഷനിൽ ചേർത്തു.'))) }));
  if (r.sections && r.sections.length) {
    el.append(k.ui.card({ title: k.t('Section-wise analysis', 'ഭാഗം തിരിച്ചുള്ള വിശകലനം'), body: k.ui.table([
      { label: k.t('Section', 'ഭാഗം'), render: (s) => k.t(s.label, s.label_ml || s.label) },
      { label: '✅', key: 'correct' }, { label: '❌', key: 'wrong' }, { label: '⚪', key: 'blank' },
      { label: k.t('Marks', 'മാർക്ക്'), render: (s) => `${s.score}${s.max ? ' / ' + s.max : ''}` },
      { label: k.t('Accuracy', 'കൃത്യത'), render: (s) => k.ui.badge(pct(s.pct), tone(s.pct)) },
    ], r.sections) }));
  }
  if (r.topics) {
    const t = Object.entries(r.topics).map(([key, [c, w, b]]) => ({ key, n: c + w + b, acc: Math.round((c / Math.max(1, c + w + b)) * 100) })).sort((x, y) => x.acc - y.acc);
    el.append(k.ui.card({ title: k.t('Topic heat-map', 'വിഷയ ഭൂപടം'), body: k.h('div', { class: 'exams-heat' }, t.map((x) => k.h('div', { style: { background: x.acc >= 70 ? 'var(--good-bg)' : x.acc >= 40 ? 'var(--warn-bg)' : 'var(--bad-bg)' } }, k.h('b', null, x.key.replace('/', ' · ')), k.h('div', null, `${x.acc}% · ${x.n} Q`)))) }));
  }
  // answer key review
  const list = k.h('div');
  let filter = 'wrong';
  const draw = () => {
    list.replaceChildren(...a.questions.map((q, i) => ({ q, i, my: a.answers[i] })).filter(({ q, my }) => filter === 'all' || (filter === 'wrong' ? my !== null && my !== q.answer : my === null)).map(({ q, i, my }) => k.h('div', { style: { padding: '10px 0', borderBottom: '1px solid var(--line)' } },
      k.h('div', { class: 'small muted' }, `Q${i + 1} · ${q.subject}/${q.topic}`), k.h('div', { class: 'exams-q' }, qText(k, q)),
      k.h('div', { class: 'exams-opts' }, q.options.map((_, j) => k.h('div', { class: 'exams-opt' + (j === q.answer ? ' right' : my === j ? ' wrong' : '') }, k.h('span', { class: 'bub' }, L4[j]), k.h('span', null, optText(k, q, j))))),
      q.x ? k.h('p', { class: 'small' }, '💡 ', k.t(q.x, q.x_ml || q.x), ' ', say(k, q.x, q.x_ml)) : null)));
    if (!list.children.length) list.append(k.ui.empty(k.t('Nothing in this list.', 'ഈ പട്ടികയിൽ ഒന്നുമില്ല.')));
  };
  const fbtn = (id, en, ml) => k.ui.button(k.t(en, ml), () => { filter = id; draw(); }, { small: true, tone: 'ghost' });
  el.append(k.ui.card({ title: k.t('Answer key & explanations', 'ഉത്തരസൂചികയും വിശദീകരണവും'), body: [k.h('div', { class: 'row' }, fbtn('wrong', 'Wrong', 'തെറ്റിയവ'), fbtn('blank', 'Skipped', 'വിട്ടവ'), fbtn('all', 'All', 'എല്ലാം')), list] }));
  draw();
  if (k.user.role === 'learner') el.append(k.h('div', { class: 'row' }, k.ui.button(k.t('Revise mistakes now', 'ഇപ്പോൾ റിവിഷൻ'), () => k.go('#/m/exams/revise'), { tone: 'primary' }), k.ui.button(k.t('Another mock', 'മറ്റൊരു മോക്ക്'), () => k.go('#/m/exams/mocks'))));
}

// ======================================================================= revision (SM-2-lite flashcards)
async function revise(el, k) {
  setup(k);
  const d = await k.api.get('/revision?limit=30' + (k.params.person_id ? '&person_id=' + k.params.person_id : ''));
  el.append(back(k, '#/m/exams/home'), k.h('h2', null, k.t('Revision queue', 'റിവിഷൻ')));
  el.append(k.ui.grid([k.ui.stat(k.t('Due today', 'ഇന്ന്'), d.counts.due), k.ui.stat(k.t('Learning', 'പഠിക്കുന്നു'), d.counts.learning), k.ui.stat(k.t('Mastered', 'പഠിച്ചു'), d.counts.mastered)], 120));
  const box = k.h('div', { class: 'exams-flash' });
  el.append(box);
  el.append(k.ui.card({ title: k.t('Coming up this week', 'ഈ ആഴ്ച'), body: k.ui.bars(d.upcoming.map((u) => ({ label: fmtDate(u.day, k), value: u.n }))) }));
  el.append(k.h('p', { class: 'small muted' }, k.t('Spaced repetition: questions you find easy come back after longer gaps; ones you miss come back tomorrow.', 'എളുപ്പമുള്ളവ കൂടുതൽ ഇടവേളയ്ക്കുശേഷവും തെറ്റുന്നവ നാളെയും വീണ്ടും വരും.')));
  const cards = d.cards.filter((c) => c.question);
  let i = 0, picked = null;
  const draw = () => {
    if (i >= cards.length) { box.replaceChildren(k.h('div', { style: { textAlign: 'center', padding: '30px 0' } }, k.h('div', { style: { fontSize: '2.5rem' } }, '🎉'), k.h('h3', null, k.t('Revision done for today!', 'ഇന്നത്തെ റിവിഷൻ കഴിഞ്ഞു!')), k.ui.button(k.t('Back to exam prep', 'തിരികെ'), () => k.go('#/m/exams/home'), { tone: 'primary' }))); return; }
    const c = cards[i], q = c.question;
    const shown = picked !== null;
    fill(k, box,
      k.h('div', { class: 'row small muted', style: { justifyContent: 'space-between' } }, k.h('span', null, `${i + 1} / ${cards.length}`), k.h('span', null, `${q.subject} · ${q.topic}`, c.lapses ? ` · ${k.t('missed', 'തെറ്റിയത്')} ×${c.lapses}` : ''), say(k, q.q, q.q_ml)),
      k.h('div', { class: 'exams-q' }, qText(k, q)),
      k.h('div', { class: 'exams-opts' }, q.options.map((_, j) => k.h('button', { class: 'exams-opt' + (shown && j === q.answer ? ' right' : shown && j === picked ? ' wrong' : ''), onclick: () => { if (!shown) { picked = j; draw(); } } }, k.h('span', { class: 'bub' }, L4[j]), k.h('span', null, optText(k, q, j))))),
      shown ? k.h('div', null,
        q.x ? k.h('p', { class: 'small' }, '💡 ', k.t(q.x, q.x_ml || q.x)) : null,
        k.h('div', { class: 'small muted' }, k.t('How well did you know it?', 'എത്ര നന്നായി അറിയാമായിരുന്നു?')),
        k.h('div', { class: 'exams-grades' }, [[1, 'Again', 'വീണ്ടും', 'danger'], [3, 'Hard', 'പ്രയാസം', 'ghost'], [4, 'Good', 'ശരി', ''], [5, 'Easy', 'എളുപ്പം', 'primary']].map(([g, en, ml, tn]) => k.ui.button(k.t(en, ml), async () => {
          const grade = picked === q.answer ? g : Math.min(g, 2);
          if (k.user.role === 'learner') await k.api.post(`/revision/${encodeURIComponent(q.id)}/grade`, { grade });
          i++; picked = null; draw();
        }, { tone: tn })))) : null);
  };
  draw();
}

// ======================================================================= practice + analysis
async function practice(el, k) {
  setup(k);
  const m = await meta(k);
  el.append(back(k, '#/m/exams/home'), k.h('h2', null, k.t('Practice by subject', 'വിഷയം തിരിച്ച് പരിശീലനം')), k.h('p', { class: 'small muted' }, k.t('Untimed, no negative marks. You see the answer and explanation right after each question.', 'സമയപരിധിയില്ല, നെഗറ്റീവ് മാർക്കില്ല. ഓരോ ചോദ്യത്തിനുശേഷവും ഉത്തരവും വിശദീകരണവും.')));
  el.append(k.ui.button('🎯 ' + k.t('Practise my weak topics (15)', 'എന്റെ ദുർബല ഭാഗങ്ങൾ (15)'), () => startAttempt(k, { pattern: 'practice', weak: true, n: 15 }), { tone: 'primary' }));
  el.append(k.ui.grid(m.subjects.map((s) => k.ui.card({
    title: `${s.icon} ${k.t(s.label, s.ml)}`, subtitle: `${s.count} ${k.t('questions', 'ചോദ്യങ്ങൾ')} · ${s.comp}`,
    body: k.h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } }, s.topics.slice(0, 10).map((t) => k.h('button', { class: 'exams-chip', style: { border: 'none', cursor: 'pointer' }, onclick: () => startAttempt(k, { pattern: 'practice', subject: s.id, topic: t.id, n: 10 }) }, t.id, ' ', k.h('small', null, t.count)))),
    actions: [k.ui.button(k.t('10 mixed', '10 ചോദ്യം'), () => startAttempt(k, { pattern: 'practice', subject: s.id, n: 10 }), { small: true })],
  })), 260));
}

async function analysis(el, k) {
  setup(k);
  const d = await k.api.get('/weakness' + pq(k));
  el.append(back(k, '#/m/exams/home' + pq(k)), k.h('h2', null, k.t('Strengths & weaknesses', 'ശക്തിയും ദൗർബല്യവും')));
  el.append(k.ui.card({ title: k.t('By subject', 'വിഷയം തിരിച്ച്'), body: k.ui.bars(d.subjects.map((s) => ({ label: k.t(s.label, s.label_ml), value: s.accuracy, colour: s.accuracy < 40 ? '#b3261e' : s.accuracy < 60 ? '#c9a227' : '#2f7d4a' })), { max: 100, unit: '%' }) }));
  el.append(k.ui.card({ title: k.t('By topic (last 30 tests)', 'വിഷയഭാഗം (അവസാന 30 ടെസ്റ്റ്)'), body: k.ui.table([
    { label: k.t('Topic', 'ഭാഗം'), render: (w) => `${k.t(w.subject_label, w.subject_ml)} · ${w.topic}` },
    { label: 'Q', key: 'n' },
    { label: k.t('Accuracy', 'കൃത്യത'), render: (w) => k.ui.badge(w.accuracy + '%', tone(w.accuracy)) },
    { label: '', render: (w) => (k.user.role === 'learner' ? k.ui.button(k.t('Practise', 'പരിശീലിക്കുക'), () => startAttempt(k, { pattern: 'practice', subject: w.subject, topic: w.topic, n: 10 }), { small: true }) : '') },
  ], d.topics.filter((w) => w.n >= 2)) }));
}

// ======================================================================= current affairs
async function affairs(el, k) {
  setup(k);
  const list = await k.api.get('/affairs?limit=60');
  el.append(back(k, '#/m/exams/home'), k.h('h2', null, k.t('Current affairs & explainers', 'ആനുകാലികം, വിശദീകരണങ്ങൾ')));
  el.append(k.h('p', { class: 'small muted' }, k.t('Short bilingual notes for aspirants. Tap 🔊 to listen. Demo items are general explainers — always confirm details in the official notification.', 'ഹ്രസ്വ കുറിപ്പുകൾ. 🔊 അമർത്തി കേൾക്കാം. ഔദ്യോഗിക വിജ്ഞാപനത്തിൽ ഉറപ്പാക്കുക.')));
  const tags = [...new Set(list.flatMap((a) => a.tags || []))].sort();
  const box = k.h('div');
  const draw = (tag) => box.replaceChildren(...list.filter((a) => !tag || (a.tags || []).includes(tag)).map((a) => k.h('div', { class: 'exams-affair' },
    k.h('div', { class: 'exams-mini' }, fmtDate(a.date, k), ' · ', (a.tags || []).join(', '), a.demo ? ' · DEMO' : ''),
    k.h('h4', null, k.t(a.title, a.title_ml || a.title), say(k, a.title + '. ' + a.body, (a.title_ml || '') + '. ' + (a.body_ml || ''))),
    k.h('p', { style: { margin: '4px 0' } }, k.t(a.body, a.body_ml || a.body)),
    k.lang === 'en' && a.body_ml ? k.h('p', { class: 'ml small muted', style: { margin: 0 } }, a.body_ml) : null)));
  el.append(k.h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px', marginBottom: '6px' } }, k.h('button', { class: 'exams-chip info', style: { border: 'none', cursor: 'pointer' }, onclick: () => draw(null) }, k.t('All', 'എല്ലാം')), tags.map((t) => k.h('button', { class: 'exams-chip', style: { border: 'none', cursor: 'pointer' }, onclick: () => draw(t) }, t))));
  el.append(box); draw(null);
  if (k.user.role !== 'learner' && k.user.role !== 'guardian') {
    el.append(k.ui.card({ title: k.t('Add an explainer', 'വിശദീകരണം ചേർക്കുക'), body: k.ui.form([
      { name: 'title', label: 'Title (English)', required: true }, { name: 'title_ml', label: 'തലക്കെട്ട് (മലയാളം)' },
      { name: 'body', label: 'Text (English, ≤ 60 words)', type: 'textarea', required: true }, { name: 'body_ml', label: 'വിവരണം (മലയാളം)', type: 'textarea' },
      { name: 'tags', label: 'Tags (comma separated)' },
    ], async (v) => { await k.api.post('/affairs', { ...v, tags: (v.tags || '').split(',').map((x) => x.trim()).filter(Boolean) }); k.toast(k.t('Published', 'പ്രസിദ്ധീകരിച്ചു'), 'good'); k.refresh(); }) }));
  }
}

// ======================================================================= calendar + applications
async function calendar(el, k) {
  setup(k);
  const [list, m] = await Promise.all([k.api.get('/calendar'), meta(k)]);
  const pid = k.params.person_id || k.user.person_id;
  const apps = pid ? await k.api.get('/applications' + (k.params.person_id ? '?person_id=' + pid : '')) : [];
  el.append(back(k, '#/m/exams/home' + pq(k)), k.h('h2', null, k.t('Exam calendar & applications', 'പരീക്ഷാ കലണ്ടർ, അപേക്ഷകൾ')));
  if (pid && apps.length) {
    el.append(k.ui.section(k.t('Assisted application tracker', 'അപേക്ഷാ ട്രാക്കർ'), apps.map((a) => appCard(k, m, a))));
  }
  const appBy = Object.fromEntries(apps.map((a) => [a.calendar_id, a]));
  el.append(k.ui.section(k.t('Upcoming exams', 'വരാനിരിക്കുന്ന പരീക്ഷകൾ'), list.filter((c) => c.status !== 'past').map((c) => {
    const d = new Date(c.apply_by && c.status !== 'closed' ? c.apply_by : c.exam_date);
    const urgent = c.status === 'open' && c.days_to_deadline <= 10;
    return k.h('div', { class: 'exams-cal' },
      k.h('div', { class: 'd', style: urgent ? { background: 'var(--bad-bg)' } : null }, k.h('small', null, c.status === 'closed' ? k.t('EXAM', 'പരീക്ഷ') : k.t('APPLY BY', 'അവസാനം')), k.h('b', null, d.getDate()), k.h('small', null, d.toLocaleDateString('en-IN', { month: 'short' }))),
      k.h('div', { style: { flex: 1 } },
        k.h('b', null, k.t(c.title, c.title_ml || c.title)), ' ', c.demo ? k.ui.badge('DEMO', 'info') : null,
        k.h('div', { class: 'exams-mini' }, c.code, ' · ', k.t(c.eligibility, c.eligibility_ml || c.eligibility)),
        k.h('div', { class: 'row', style: { gap: '6px', marginTop: '4px', flexWrap: 'wrap' } },
          k.h('span', { class: 'exams-chip ' + (c.status === 'open' ? (urgent ? 'bad' : 'warn') : 'info') }, c.status === 'open' ? k.t(`Open · ${c.days_to_deadline} days left`, `തുറന്നിരിക്കുന്നു · ${c.days_to_deadline} ദിവസം`) : c.status === 'upcoming' ? k.t('Opens ', 'തുടങ്ങുന്നത് ') + fmtDate(c.apply_from, k) : k.t('Applications closed', 'അപേക്ഷ അവസാനിച്ചു')),
          c.exam_date ? k.h('span', { class: 'exams-chip' }, k.t('Exam ', 'പരീക്ഷ ') + fmtDate(c.exam_date, k)) : null,
          c.pattern && k.user.role === 'learner' ? k.ui.button(k.t('Practice mock', 'പരിശീലന മോക്ക്'), () => startAttempt(k, { pattern: c.pattern }), { small: true, tone: 'ghost' }) : null,
          pid && !appBy[c.id] && c.status !== 'past' ? k.ui.button(k.t('Track & remind me', 'ട്രാക്ക് ചെയ്യുക, ഓർമ്മിപ്പിക്കുക'), async () => { await k.api.post('/applications', { calendar_id: c.id, person_id: pid }); k.toast(k.t('Added. You will get reminders before the deadline.', 'ചേർത്തു. അവസാന തീയതിക്ക് മുമ്പ് ഓർമ്മിപ്പിക്കും.'), 'good'); k.refresh(); }, { small: true, tone: 'primary' }) : null,
          appBy[c.id] ? k.ui.badge(k.t('Tracking', 'ട്രാക്ക് ചെയ്യുന്നു'), 'good') : null)));
  })));
  if (['teacher', 'facilitator', 'agency_admin', 'coordinator', 'platform_admin'].includes(k.user.role)) {
    el.append(k.ui.card({ title: k.t('Add an exam / notification', 'പരീക്ഷ ചേർക്കുക'), body: k.ui.form([
      { name: 'title', label: 'Title', required: true }, { name: 'code', label: 'Category / notification no.' },
      { name: 'body', label: 'Body', type: 'select', options: ['psc', 'bank', 'ssc', 'rrb'], value: 'psc' },
      { name: 'apply_by', label: 'Last date to apply', type: 'date' }, { name: 'exam_date', label: 'Exam date', type: 'date' },
      { name: 'eligibility', label: 'Eligibility (short)' }, { name: 'url', label: 'Official link' },
    ], async (v) => { await k.api.post('/calendar', v); k.toast('Saved', 'good'); k.refresh(); }) }));
  }
}

function appCard(k, m, a) {
  const c = a.exam || {};
  const docs = k.h('div', { class: 'exams-docs' }, m.docs.map((d) => k.h('label', null, k.h('input', { type: 'checkbox', checked: !!(a.docs || {})[d.id], onchange: async (e) => { await k.api.put('/applications/' + a.id, { docs: { [d.id]: e.target.checked } }); } }), k.t(d.label, d.label_ml))));
  const next = m.steps[Math.min(m.steps.length - 1, a.step_index + 1)];
  return k.ui.card({
    title: k.t(c.title || '', c.title_ml || c.title || ''),
    subtitle: [c.code, a.application_no ? k.t('Application no. ', 'അപേക്ഷാ നമ്പർ ') + a.application_no : null, a.assisted_by ? k.t('Helped by ', 'സഹായിച്ചത് ') + a.assisted_by : null].filter(Boolean).join(' · '),
    body: [steps(k, m, a.status), k.h('details', null, k.h('summary', { class: 'small' }, k.t('Documents checklist', 'രേഖകളുടെ പട്ടിക'), ` (${Object.values(a.docs || {}).filter(Boolean).length}/${m.docs.length})`), docs), a.note ? k.h('p', { class: 'small muted' }, '📝 ', a.note) : null],
    actions: a.status !== 'result' ? [
      k.ui.button(k.t('Mark: ', 'അടുത്ത ഘട്ടം: ') + k.t(next.label, next.label_ml), async () => {
        const body = { status: next.id };
        if (next.id === 'applied') { const no = prompt(k.t('Application / registration number (optional)', 'അപേക്ഷാ നമ്പർ (ഐച്ഛികം)')); if (no) body.application_no = no; }
        await k.api.put('/applications/' + a.id, body); k.toast(k.t('Updated', 'പുതുക്കി'), 'good'); k.refresh();
      }, { tone: 'primary', small: true }),
      k.ui.button(a.remind ? '🔔 ' + k.t('Reminders on', 'ഓർമ്മപ്പെടുത്തൽ ഓൺ') : '🔕 ' + k.t('Reminders off', 'ഓഫ്'), async () => { await k.api.put('/applications/' + a.id, { remind: !a.remind }); k.refresh(); }, { tone: 'ghost', small: true }),
    ] : null,
  });
}

// ======================================================================= leaderboard
async function leaderboard(el, k) {
  setup(k);
  el.append(back(k, k.user.role === 'learner' ? '#/m/exams/home' : '#/m/exams/teach'));
  let hamlet = k.params.hamlet_id || '';
  const d = await k.api.get('/leaderboard' + (hamlet ? '?hamlet_id=' + hamlet : ''));
  el.append(k.h('h2', null, '🏅 ', k.t('Hamlet leaderboard', 'ഊര് ലീഡർബോർഡ്'), ' · ', d.hamlet ? k.t(d.hamlet.name, d.hamlet.name_ml) : ''));
  el.append(k.h('p', { class: 'small muted' }, k.t('Average mock score over the last 30 days. Only learners who chose to join are shown, with short names.', 'കഴിഞ്ഞ 30 ദിവസത്തെ ശരാശരി. ചേരാൻ സമ്മതിച്ചവർ മാത്രം.')));
  if (k.user.role === 'learner') {
    const prefs = (await k.api.get('/dashboard')).prefs;
    el.append(k.h('label', { class: 'row', style: { gap: '8px', margin: '8px 0' } }, k.h('input', { type: 'checkbox', checked: !!prefs.leaderboard, onchange: async (e) => { await k.api.put('/prefs', { leaderboard: e.target.checked }); k.toast(e.target.checked ? k.t('You joined the leaderboard', 'ലീഡർബോർഡിൽ ചേർന്നു') : k.t('You left the leaderboard', 'ലീഡർബോർഡിൽ നിന്ന് മാറി'), 'good'); k.refresh(); } }), k.t('Show me on my hamlet leaderboard', 'എന്നെ ലീഡർബോർഡിൽ കാണിക്കുക')));
  }
  el.append(k.h('div', { class: 'exams-lb' }, k.ui.table([
    { label: '#', render: (r) => (r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank) },
    { label: k.t('Name', 'പേര്'), render: (r) => (r.me ? k.h('b', null, r.name, ' (', k.t('you', 'നിങ്ങൾ'), ')') : r.name) },
    { label: k.t('Mocks', 'മോക്ക്'), key: 'mocks' }, { label: k.t('Average', 'ശരാശരി'), render: (r) => pct(r.avg) }, { label: k.t('Best', 'മികച്ചത്'), render: (r) => pct(r.best) },
  ], d.rows, { empty: k.t('No one has joined yet.', 'ആരും ചേർന്നിട്ടില്ല.') })));
}

// ======================================================================= teacher views
async function teach(el, k) {
  setup(k);
  const progs = await k.api.get('/teach/programmes');
  el.append(k.h('h2', null, k.t('Exam coaching batches', 'പരീക്ഷാ പരിശീലന ബാച്ചുകൾ')));
  el.append(k.h('p', { class: 'small muted' }, k.t('Only learners who are enrolled with your agency and have given progress consent are counted.', 'നിങ്ങളുടെ ഏജൻസിയിൽ ചേർന്ന്, സമ്മതം നൽകിയ പഠിതാക്കളെ മാത്രം കാണിക്കുന്നു.')));
  el.append(k.h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px' } }, k.ui.button('📅 ' + k.t('Exam calendar', 'കലണ്ടർ'), () => k.go('#/m/exams/calendar'), { small: true, tone: 'ghost' }), k.ui.button('📰 ' + k.t('Current affairs', 'ആനുകാലികം'), () => k.go('#/m/exams/affairs'), { small: true, tone: 'ghost' }), k.ui.button('✍️ ' + k.t('Question review', 'ചോദ്യ പരിശോധന'), () => k.go('#/m/exams/questions'), { small: true, tone: 'ghost' })));
  el.append(k.ui.grid(progs.map((p) => k.ui.card({
    title: k.t(p.hamlet, p.hamlet_ml), subtitle: `${p.agency} · ${(p.schedule || []).join(', ')}`,
    body: k.ui.grid([k.ui.stat(k.t('Learners', 'പഠിതാക്കൾ'), `${p.visible}/${p.enrolled}`, k.t('with consent', 'സമ്മതത്തോടെ')), k.ui.stat(k.t('Mocks (30d)', 'മോക്ക് (30 ദി.)'), p.mocks_30d), k.ui.stat(k.t('Avg', 'ശരാശരി'), pct(p.avg_30d))], 90),
    actions: [k.ui.button(k.t('Open batch', 'ബാച്ച് തുറക്കുക'), () => k.go('#/m/exams/batch?id=' + p.id), { tone: 'primary', small: true })],
  })), 280));
  if (!progs.length) el.append(k.ui.empty(k.t('Your agency runs no exam batches yet.', 'ബാച്ചുകൾ ഇല്ല.')));
}

async function batch(el, k) {
  setup(k);
  const [d, m] = await Promise.all([k.api.get('/teach/batch/' + k.params.id), meta(k)]);
  el.append(back(k, '#/m/exams/teach'), k.h('h2', null, k.t(d.programme.title, d.programme.title_ml), ' · ', k.t(d.programme.hamlet, d.programme.hamlet_ml)));
  if (d.hidden_without_consent) el.append(k.h('div', { class: 'card tone-warn small' }, `🔒 ${d.hidden_without_consent} `, k.t('enrolled learner(s) are hidden because progress consent is not active for your agency.', 'പഠിതാക്കളെ സമ്മതം ഇല്ലാത്തതിനാൽ മറച്ചിരിക്കുന്നു.')));
  el.append(k.ui.tabs([
    { id: 'learners', label: k.t('Learners', 'പഠിതാക്കൾ'), render: async (t) => {
      t.append(k.ui.table([
        { label: k.t('Learner', 'പഠിതാവ്'), render: (r) => k.h('span', null, k.h('b', null, r.name), k.h('div', { class: 'exams-mini' }, r.aspirations || '')) },
        { label: k.t('Mocks', 'മോക്ക്'), key: 'mocks' },
        { label: k.t('Avg', 'ശരാശരി'), render: (r) => (r.avg === null ? '—' : k.ui.badge(pct(r.avg), tone(r.avg))) },
        { label: k.t('Trend', 'പ്രവണത'), render: (r) => k.ui.spark(r.trend, { w: 80, hgt: 22 }) },
        { label: k.t('Weak', 'ദുർബലം'), render: (r) => r.weak.map((w) => k.h('span', { class: 'exams-chip bad', style: { marginRight: '2px' } }, w.topic, ' ', w.accuracy + '%')) },
        { label: k.t('Due', 'റിവിഷൻ'), key: 'revision_due' },
        { label: k.t('Applications', 'അപേക്ഷ'), render: (r) => r.applications.map((s) => k.ui.pill(s.replace('_', ' '))) },
      ], d.learners, { onRow: (r) => k.go('#/m/exams/learner?id=' + r.id), empty: k.t('No consenting learners.', 'പഠിതാക്കൾ ഇല്ല.') }));
    } },
    { id: 'analysis', label: k.t('Batch analysis', 'വിശകലനം'), render: async (t) => {
      t.append(k.ui.card({ title: k.t('Subject accuracy (batch)', 'വിഷയ കൃത്യത'), body: k.ui.bars(d.subjects.map((s) => ({ label: k.t(s.label, s.label_ml), value: s.accuracy, colour: s.accuracy < 40 ? '#b3261e' : s.accuracy < 60 ? '#c9a227' : '#2f7d4a' })), { max: 100, unit: '%' }) }));
      t.append(k.ui.card({ title: k.t('Weekly mocks & average', 'ആഴ്ചതോറും'), body: [k.ui.bars(d.weekly.map((w) => ({ label: fmtDate(w.week, k), value: w.n }))), k.h('div', { class: 'small muted' }, k.t('Average trend: ', 'ശരാശരി: ')), k.ui.spark(d.weekly.map((w) => w.avg).filter((x) => x !== null), { w: 260, hgt: 40 })] }));
    } },
    { id: 'assign', label: k.t('Assign tests', 'ടെസ്റ്റ് നൽകുക'), render: async (t) => {
      t.append(k.ui.table([
        { label: k.t('Test', 'ടെസ്റ്റ്'), render: (a) => k.t(a.title, a.title_ml || a.title) },
        { label: k.t('Due', 'അവസാനം'), render: (a) => fmtDate(a.due, k) },
        { label: k.t('Done', 'ചെയ്തത്'), render: (a) => k.ui.progress(a.of ? a.done / a.of : 0, `${a.done}/${a.of}`) },
      ], d.assignments));
      const patterns = m.bodies.flatMap((b) => b.patterns).map((p) => ({ value: p.id, label: k.t(p.title, p.title_ml) }));
      t.append(k.ui.card({ title: k.t('New assignment', 'പുതിയ ടെസ്റ്റ്'), body: k.ui.form([
        { name: 'pattern', label: k.t('Pattern', 'മാതൃക'), type: 'select', options: [...patterns, { value: 'practice', label: 'Practice set (subject)' }], required: true, value: 'psc_mini' },
        { name: 'subject', label: k.t('Subject (practice sets only)', 'വിഷയം'), type: 'select', options: m.subjects.map((s) => ({ value: s.id, label: s.label })) },
        { name: 'title', label: k.t('Title', 'പേര്') }, { name: 'due', label: k.t('Due date', 'അവസാന തീയതി'), type: 'date' },
      ], async (v) => { await k.api.post('/assignments', { ...v, programme_id: d.programme.id }); k.toast(k.t('Assigned to the batch', 'ബാച്ചിന് നൽകി'), 'good'); k.refresh(); }, { submitLabel: k.t('Assign', 'നൽകുക') }) }));
    } },
    { id: 'lb', label: k.t('Leaderboard', 'ലീഡർബോർഡ്'), render: async (t) => { k.params.hamlet_id = d.programme.hamlet_id; await leaderboard(t, k); } },
  ]));
}

async function learner(el, k) {
  setup(k);
  const d = await k.api.get('/teach/learner/' + k.params.id);
  const m = await meta(k);
  el.append(back(k, '#/m/exams/teach'), k.h('h2', null, d.person.name), k.h('div', { class: 'small muted' }, d.person.aspirations || ''));
  const mocks = d.attempts.filter((a) => a.pattern !== 'practice');
  el.append(k.ui.grid([k.ui.stat(k.t('Mocks', 'മോക്ക്'), mocks.length), k.ui.stat(k.t('Last', 'അവസാനം'), pct(mocks.at(-1)?.pct)), k.ui.stat(k.t('Best', 'മികച്ചത്'), pct(Math.max(0, ...mocks.map((a) => a.pct)))), k.h('div', { class: 'stat' }, k.ui.spark(mocks.map((a) => a.pct), { w: 140, hgt: 40 }))], 130));
  el.append(k.ui.card({ title: k.t('Weak topics', 'ദുർബല ഭാഗങ്ങൾ'), body: k.ui.bars(d.weakness.filter((w) => w.n >= 3).slice(0, 8).map((w) => ({ label: `${w.subject_label} · ${w.topic}`, value: w.accuracy })), { max: 100, unit: '%' }) }));
  el.append(k.ui.card({ title: k.t('Applications', 'അപേക്ഷകൾ'), body: d.applications.length ? d.applications.map((a) => appCard(k, m, a)) : k.ui.empty('—') }));
  el.append(k.ui.card({ title: k.t('Tests', 'ടെസ്റ്റുകൾ'), body: k.ui.table([{ label: k.t('Test', 'ടെസ്റ്റ്'), key: 'title' }, { label: k.t('Date', 'തീയതി'), render: (r) => fmtDate(r.submitted_at, k) }, { label: '%', render: (r) => k.ui.badge(pct(r.pct), tone(r.pct)) }], [...d.attempts].reverse(), { onRow: (r) => k.go('#/m/exams/result?id=' + r.id) }) }));
}

async function questions(el, k) {
  setup(k);
  const m = await meta(k);
  el.append(back(k, '#/m/exams/teach'), k.h('h2', null, k.t('Question bank', 'ചോദ്യബാങ്ക്')), k.h('p', { class: 'small muted' }, k.t(`${m.total} questions live. New questions need approval by a second reviewer before learners see them.`, `${m.total} ചോദ്യങ്ങൾ. പുതിയവ മറ്റൊരാൾ അംഗീകരിച്ചശേഷം മാത്രം.`)));
  el.append(k.ui.card({ title: k.t('Contribute a question', 'ചോദ്യം ചേർക്കുക'), body: k.ui.form([
    { name: 'subject', label: 'Subject', type: 'select', options: m.subjects.map((s) => ({ value: s.id, label: s.label })), required: true },
    { name: 'topic', label: 'Topic' }, { name: 'q', label: 'Question (English)', type: 'textarea', required: true }, { name: 'q_ml', label: 'ചോദ്യം (മലയാളം)', type: 'textarea' },
    { name: 'o0', label: 'Option A', required: true }, { name: 'o1', label: 'Option B', required: true }, { name: 'o2', label: 'Option C', required: true }, { name: 'o3', label: 'Option D', required: true },
    { name: 'answer', label: 'Correct option', type: 'select', options: [{ value: 0, label: 'A' }, { value: 1, label: 'B' }, { value: 2, label: 'C' }, { value: 3, label: 'D' }], required: true },
    { name: 'x', label: 'Explanation', type: 'textarea' },
  ], async (v) => { await k.api.post('/questions', { subject: v.subject, topic: v.topic, q: v.q, q_ml: v.q_ml, options: [v.o0, v.o1, v.o2, v.o3], answer: Number(v.answer), x: v.x }); k.toast(k.t('Sent for review', 'പരിശോധനയ്ക്ക് അയച്ചു'), 'good'); k.refresh(); }) }));
  try {
    const pend = await k.api.get('/questions/review');
    el.append(k.ui.card({ title: k.t('Pending review', 'പരിശോധിക്കാനുള്ളവ'), body: pend.length ? pend.map((q) => k.h('div', { style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } }, k.h('b', null, q.q), k.h('ol', { type: 'A' }, q.options.map((o, i) => k.h('li', { style: i === q.answer ? { fontWeight: 700, color: 'var(--good)' } : null }, o))), q.x ? k.h('div', { class: 'small' }, q.x) : null,
      k.h('div', { class: 'row' }, k.ui.button(k.t('Approve', 'അംഗീകരിക്കുക'), async () => { await k.api.post(`/questions/${q.id}/review`, { approve: true }); k.refresh(); }, { tone: 'primary', small: true }), k.ui.button(k.t('Reject', 'നിരസിക്കുക'), async () => { await k.api.post(`/questions/${q.id}/review`, { approve: false }); k.refresh(); }, { tone: 'danger', small: true })))) : k.ui.empty(k.t('Nothing pending.', 'ഒന്നുമില്ല.')) }));
  } catch (_) { /* reviewers only */ }
}

// ======================================================================= admin overview
async function admin(el, k) {
  setup(k);
  const [d, m] = await Promise.all([k.api.get('/admin/overview'), meta(k)]);
  el.append(k.h('h2', null, k.t('Exam preparation — overview', 'പരീക്ഷാ പരിശീലനം — അവലോകനം')));
  el.append(k.h('p', { class: 'small muted' }, k.t('Aggregates only. Counts under 5 are shown as "<5" for external viewers to protect privacy.', 'സംഗ്രഹം മാത്രം. 5-ൽ താഴെയുള്ള എണ്ണം "<5" ആയി കാണിക്കുന്നു.')));
  el.append(k.ui.grid([
    k.ui.stat(k.t('Active aspirants', 'പഠിതാക്കൾ'), d.totals.learners), k.ui.stat(k.t('Mock tests written', 'മോക്ക് ടെസ്റ്റുകൾ'), d.totals.mocks), k.ui.stat(k.t('Practice sets', 'പരിശീലനം'), d.totals.practice),
    k.ui.stat(k.t('Applications tracked', 'അപേക്ഷകൾ'), d.totals.applications), k.ui.stat(k.t('Avg. score gain', 'ശരാശരി മുന്നേറ്റം'), d.totals.avg_gain === null ? '—' : (d.totals.avg_gain >= 0 ? '+' : '') + d.totals.avg_gain + ' pts', k.t('first → latest mock, learners with ≥3 mocks', 'ആദ്യ → അവസാന മോക്ക്')), k.ui.stat(k.t('Question bank', 'ചോദ്യബാങ്ക്'), d.totals.questions),
  ], 150));
  el.append(k.ui.grid([
    k.ui.card({ title: k.t('Mocks per month', 'മാസം തോറും'), body: [k.ui.bars(d.months.map((x) => ({ label: x.month, value: x.mocks }))), k.h('div', { class: 'small muted' }, k.t('Average score trend', 'ശരാശരി സ്കോർ')), k.ui.spark(d.months.map((x) => x.avg).filter((x) => x !== null), { w: 260, hgt: 40 })] }),
    k.ui.card({ title: k.t('Assisted applications funnel', 'അപേക്ഷാ ഘട്ടങ്ങൾ'), body: k.ui.bars(d.funnel.map((f) => ({ label: k.t(f.label, f.label_ml), value: typeof f.n === 'number' ? f.n : 0 }))) }),
  ], 320));
  el.append(k.ui.card({ title: k.t('By hamlet', 'ഊര് തിരിച്ച്'), body: k.ui.table([
    { label: k.t('Hamlet', 'ഊര്'), render: (h) => k.h('span', null, k.t(h.name, h.name_ml), k.h('div', { class: 'exams-mini' }, h.district)) },
    { label: k.t('Aspirants', 'പഠിതാക്കൾ'), key: 'learners' }, { label: k.t('Mocks', 'മോക്ക്'), key: 'mocks' },
    { label: k.t('Avg score', 'ശരാശരി'), render: (h) => (h.avg === null ? '—' : k.ui.badge(pct(h.avg), tone(h.avg))) }, { label: k.t('Applications', 'അപേക്ഷ'), key: 'applications' },
  ], d.hamlets) }));
  el.append(k.ui.card({ title: k.t('Syllabus map', 'സിലബസ്'), body: m.bodies.map((b) => k.h('details', null, k.h('summary', null, `${b.icon} ${k.t(b.title, b.title_ml)} — ${b.patterns.length} ${k.t('patterns', 'മാതൃകകൾ')}`), k.h('ul', { class: 'small' }, b.patterns.map((p) => k.h('li', null, k.h('b', null, p.title), `: ${p.sections.map((s) => `${s.label} (${s.n}) → ${s.subjects.join('/')}`).join('; ')}`))))) }));
}

export default { views: { home, mocks, test, result, revise, practice, analysis, affairs, calendar, leaderboard, teach, batch, learner, questions, admin } };
