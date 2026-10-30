// AADI · language — learner, teacher and admin views. No DOM access at import time.
const CSS = `
.language-hero{display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:linear-gradient(135deg,#1d4e89,#2b6cb0);color:#fff;border-radius:var(--r-l);padding:16px 18px;margin-bottom:14px}
.language-hero h2{margin:0;color:#fff;font-size:1.25rem}.language-hero .muted{color:#dbe7f6}
.language-pass{display:flex;gap:6px;flex-wrap:wrap}
.language-stamp{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;border:2px dashed #f3e7bf;color:#fff;font-size:.62rem;text-align:center;line-height:1.1}
.language-stamp b{font-size:.95rem}
.language-courses{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.language-course{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:12px;display:flex;flex-direction:column;gap:6px}
.language-course .top{display:flex;gap:10px;align-items:center}.language-course .ic{font-size:1.8rem}
.language-lvl{display:inline-block;padding:1px 8px;border-radius:999px;font-size:.75rem;font-weight:700;background:#e2ebf7;color:#1d4e89}
.language-lvl.none{background:#eef2f0;color:#6b7a75}
.language-unit{border:1px solid var(--line);border-radius:var(--r-m);margin:8px 0;background:#fff}
.language-unit>summary{padding:10px 12px;cursor:pointer;display:flex;justify-content:space-between;gap:8px;align-items:center;list-style:none}
.language-unit>summary::-webkit-details-marker{display:none}
.language-act{display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid var(--line);cursor:pointer}
.language-act:hover{background:#f4f8fb}
.language-act .k{font-size:1.2rem;width:28px;text-align:center}.language-act .ok{margin-left:auto;color:var(--good);font-weight:700}
.language-card{border:1px solid var(--line);border-radius:var(--r-l);padding:24px 16px;text-align:center;background:#fff;min-height:180px;display:flex;flex-direction:column;justify-content:center;gap:8px;cursor:pointer;user-select:none}
.language-card .w{font-size:1.7rem;font-weight:700}.language-card .m{font-size:1.25rem;color:#355}
.language-line{display:flex;gap:8px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}
.language-line .t{font-size:1.08rem;font-weight:600}.language-line .ml{color:#456;font-size:.95rem}
.language-bubble{max-width:85%;padding:8px 12px;border-radius:14px;margin:6px 0;line-height:1.4}
.language-bubble.a{background:#e2ebf7;border-bottom-left-radius:4px}
.language-bubble.b{background:var(--leaf-soft);margin-left:auto;border-bottom-right-radius:4px}
.language-bubble.me{outline:2px solid var(--gold)}
.language-bubble small{display:block;font-weight:700;font-size:.7rem;color:#456}
.language-rec{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;border:1px dashed var(--line);border-radius:var(--r-l);background:#fafcfd}
.language-mic{width:76px;height:76px;border-radius:50%;border:none;background:#b3261e;color:#fff;font-size:2rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.language-mic.on{animation:language-pulse 1s infinite}
@keyframes language-pulse{0%{box-shadow:0 0 0 0 rgba(179,38,30,.5)}100%{box-shadow:0 0 0 18px rgba(179,38,30,0)}}
.language-stars{display:flex;gap:4px;justify-content:center}
.language-stars button{font-size:1.7rem;background:none;border:none;cursor:pointer;color:#c9c9c9;padding:2px}
.language-stars button.on{color:#c9a227}
.language-checks{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.language-checks label{display:flex;gap:4px;align-items:center;border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:.85rem}
.language-word{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:8px 0;border-bottom:1px solid var(--line);align-items:center}
.language-word .tw{font-weight:700}
.language-draft{display:inline-block;font-size:.66rem;padding:1px 6px;border-radius:4px;background:var(--warn-bg);color:var(--warn);font-weight:700}
.language-draft.ok{background:var(--good-bg);color:var(--good)}.language-draft.fix{background:var(--bad-bg);color:var(--bad)}
.language-mini{font-size:.8rem;color:#5b6b66}
.language-say{border:none;background:none;cursor:pointer;font-size:1.15rem;padding:0 4px}
.language-week{display:flex;gap:4px;align-items:flex-end;height:44px}
.language-week div{flex:1;background:#2b6cb0;border-radius:3px 3px 0 0;min-height:2px}
@media(max-width:480px){.language-word{grid-template-columns:1fr 1fr}.language-word .en{display:none}}
`;

const KIND = { vocab: ['🃏', 'Flashcards', 'ഫ്ലാഷ് കാർഡുകൾ'], listen: ['👂', 'Listen & repeat', 'കേട്ട് ആവർത്തിക്കുക'], convo: ['💬', 'Conversation', 'സംഭാഷണം'], quiz: ['✅', 'Quick check', 'ചെറിയ പരീക്ഷ'], speak: ['🎙️', 'Speaking task', 'സംസാര പരിശീലനം'] };
const MAX_SAMPLE = 150 * 1024;
const fmtDate = (d, k) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short' }); } catch (_) { return String(d).slice(0, 10); } };
function setup(k) { k.style(CSS, 'language-css'); }
// Set children safely: k.h drops null/false and flattens arrays (native replaceChildren would print "null").
const fill = (k, el, ...kids) => { el.replaceChildren(...k.h('div', null, kids).childNodes); return el; };
const say = (k, text, lang) => k.h('button', { class: 'language-say', 'aria-label': k.t('Listen', 'കേൾക്കുക'), title: k.t('Listen', 'കേൾക്കുക'), onclick: (e) => { e.stopPropagation(); k.speak(text, lang); } }, '🔊');
const lvl = (k, l) => k.h('span', { class: 'language-lvl' + (l ? '' : ' none') }, l || k.t('Starting', 'തുടക്കം'));
const pq = (k) => (k.params.person_id ? '?person_id=' + encodeURIComponent(k.params.person_id) : '');
const back = (k, href) => k.h('a', { href, class: 'small', style: { display: 'inline-block', marginBottom: '8px' } }, '← ', k.t('Back', 'തിരികെ'));
let META = null;
async function meta(k) { if (!META) META = await k.api.get('/courses'); return META; }
const courseCache = {};
async function course(k, id) { if (!courseCache[id]) courseCache[id] = await k.api.get('/courses/' + id); return courseCache[id]; }

// ======================================================================= home
async function home(el, k) {
  setup(k);
  if (k.user.role !== 'learner' && !k.params.person_id) {
    el.append(k.ui.card({ title: k.t('Choose a learner', 'പഠിതാവിനെ തിരഞ്ഞെടുക്കുക'), body: k.ui.personPicker({ onPick: (p) => k.go('#/m/language/home?person_id=' + p.id) }) }));
    return;
  }
  const d = await k.api.get('/dashboard' + pq(k));
  const self = k.user.person_id === d.person.id;
  const eng = d.courses.find((c) => c.id === 'eng-spoken');
  const max = Math.max(1, ...d.week.map((w) => w.n));
  el.append(k.h('div', { class: 'language-hero' },
    k.h('div', { style: { flex: '1 1 220px' } }, k.h('div', { class: 'muted small' }, k.t('Language Lab', 'ഭാഷാ പഠനം')), k.h('h2', null, self ? k.t(`Let's speak, ${d.person.name.split(' ')[0]}!`, `നമുക്ക് സംസാരിക്കാം, ${d.person.name.split(' ')[0]}!`) : d.person.name),
      k.h('div', { class: 'muted small' }, k.t('Home language: ', 'വീട്ടുഭാഷ: '), d.person.language || '—', ' · ', k.t('English level ', 'ഇംഗ്ലീഷ് നില '), eng.level || k.t('starting', 'തുടക്കം'))),
    k.h('div', { class: 'language-pass', title: k.t('Language passport', 'ഭാഷാ പാസ്‌പോർട്ട്') }, d.badges.slice(-5).map((b) => k.h('span', { class: 'language-stamp' }, k.h('b', null, b.level), b.course_id.replace('eng-', 'ENG ').replace('ml-literacy', 'മലയാളം').replace('hindi', 'हिंदी').replace('german', 'DEU')))),
    k.h('div', { style: { minWidth: '120px' } }, k.h('div', { class: 'language-week' }, d.week.map((w) => k.h('div', { style: { height: (w.n / max) * 40 + 2 + 'px', background: '#f3e7bf' }, title: `${w.day}: ${w.n}` }))), k.h('div', { class: 'muted small' }, k.t(`${d.stats.activities} activities · ${d.stats.speaking} recordings`, `${d.stats.activities} പ്രവർത്തനങ്ങൾ · ${d.stats.speaking} റെക്കോർഡിംഗ്`)))));
  el.append(k.h('div', { class: 'language-courses' }, d.courses.map((c) => k.h('div', { class: 'language-course' },
    k.h('div', { class: 'top' }, k.h('span', { class: 'ic' }, c.icon), k.h('div', null, k.h('b', null, k.t(c.title, c.title_ml)), k.h('div', null, lvl(k, c.level)))),
    k.ui.progress(c.done / c.total, k.t(`${c.done} of ${c.total} done`, `${c.total}-ൽ ${c.done}`)),
    c.next && self ? k.h('div', { class: 'language-mini' }, k.t('Next: ', 'അടുത്തത്: '), KIND[c.next.kind][0], ' ', k.t(c.next.title, c.next.title_ml)) : null,
    k.h('div', { class: 'row' }, self && c.next ? k.ui.button(k.t('Continue', 'തുടരുക'), () => k.go(`#/m/language/activity?course=${c.id}&unit=${c.next.unit_id}&id=${c.next.id}`), { tone: 'primary', small: true }) : null, k.ui.button(k.t('Open course', 'കോഴ്സ്'), () => k.go(`#/m/language/course?id=${c.id}${k.params.person_id ? '&person_id=' + k.params.person_id : ''}`), { small: true, tone: 'ghost' }))))));
  const grid = [];
  grid.push(k.ui.card({ title: '🎙️ ' + k.t('My speaking practice', 'എന്റെ സംസാര പരിശീലനം'), body: d.speaking.length ? k.ui.table([
    { label: k.t('Task', 'ടാസ്ക്'), render: (s) => k.h('span', null, (s.prompt || '').slice(0, 60), k.h('div', { class: 'language-mini' }, fmtDate(s.created_at, k))) },
    { label: k.t('Me', 'ഞാൻ'), render: (s) => '★'.repeat(s.self_rating || 0) },
    { label: k.t('Teacher', 'അധ്യാപകർ'), render: (s) => (s.teacher_rating ? k.h('span', { title: s.teacher_note || '' }, '★'.repeat(s.teacher_rating), s.teacher_note ? k.h('div', { class: 'language-mini' }, '“', s.teacher_note, '”') : null) : s.status === 'pending' ? k.ui.badge(k.t('waiting', 'കാത്തിരിക്കുന്നു'), 'warn') : '—') },
  ], d.speaking.slice(0, 6)) : k.ui.empty(k.t('No recordings yet — try a speaking task.', 'റെക്കോർഡിംഗുകൾ ഇല്ല.')) }));
  grid.push(k.ui.card({ title: '👥 ' + k.t('Language circles', 'ഭാഷാ കൂട്ടങ്ങൾ'), body: d.circles.length ? d.circles.map((c) => k.h('div', { style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } }, k.h('b', null, fmtDate(c.date, k), ' · ', c.time, ' — ', k.t(c.title, c.title_ml)), k.h('div', { class: 'language-mini' }, c.place), c.roleplay ? k.h('div', { class: 'small' }, '🎭 ', k.t(c.roleplay.prompt, c.roleplay.prompt_ml), ' ', say(k, k.t(c.roleplay.prompt, c.roleplay.prompt_ml))) : null)) : k.ui.empty(k.t('No circle scheduled yet.', 'കൂട്ടങ്ങൾ ഇല്ല.')), subtitle: k.t(`Attended ${d.stats.circles_attended}`, `${d.stats.circles_attended} എണ്ണത്തിൽ പങ്കെടുത്തു`) }));
  grid.push(k.ui.card({ title: '🌿 ' + k.t('Mother-tongue bridge', 'മാതൃഭാഷാ പാലം'), body: k.h('p', { class: 'small' }, k.t('Share words from your home language with Malayalam and English meanings. Your words help younger children learn.', 'വീട്ടുഭാഷയിലെ വാക്കുകൾ മലയാളം, ഇംഗ്ലീഷ് അർത്ഥത്തോടെ പങ്കിടൂ.')), actions: [k.ui.button(k.t('Open word lists', 'വാക്കുകൾ തുറക്കുക'), () => k.go('#/m/language/bridge'), { small: true })] }));
  el.append(k.ui.grid(grid, 300));
}

// ======================================================================= course
async function courseView(el, k) {
  setup(k);
  const [c, prog] = await Promise.all([course(k, k.params.id), k.api.get('/progress?course_id=' + k.params.id + (k.params.person_id ? '&person_id=' + k.params.person_id : ''))]);
  const done = new Set(prog.done.map((r) => `${r.unit_id}/${r.activity_id}`));
  const info = prog.levels[c.id];
  el.append(back(k, '#/m/language/home' + pq(k)), k.h('h2', null, c.icon, ' ', k.t(c.title, c.title_ml)), k.h('p', { class: 'small muted' }, k.t(c.about, c.about_ml)));
  el.append(k.ui.card({ title: k.t('Level', 'നില'), body: k.h('div', null, k.h('div', { class: 'row' }, info.detail.map((d) => k.h('div', { style: { flex: 1, minWidth: '90px' } }, k.h('b', null, d.level, d.reached ? ' ✓' : ''), k.ui.progress(d.done / d.total), !d.speaking_ok ? k.h('div', { class: 'language-mini' }, k.t('needs a speaking task rated ★★★', '★★★ സംസാരം വേണം')) : null)))) }));
  for (const u of c.units) {
    const n = u.activities.filter((a) => done.has(`${u.id}/${a.id}`)).length;
    el.append(k.h('details', { class: 'language-unit', open: n < u.activities.length },
      k.h('summary', null, k.h('span', null, k.h('b', null, k.t(u.title, u.title_ml)), ' ', lvl(k, u.level)), k.h('span', { class: 'language-mini' }, `${n}/${u.activities.length}`)),
      u.activities.map((a) => k.h('div', { class: 'language-act', role: 'button', tabindex: 0, onclick: () => k.go(`#/m/language/activity?course=${c.id}&unit=${u.id}&id=${a.id}`) }, k.h('span', { class: 'k' }, KIND[a.kind][0]), k.h('span', null, k.t(a.title, a.title_ml), k.h('div', { class: 'language-mini' }, k.t(KIND[a.kind][1], KIND[a.kind][2]))), done.has(`${u.id}/${a.id}`) ? k.h('span', { class: 'ok' }, '✓') : null))));
  }
}

// ======================================================================= activity player
async function activity(el, k) {
  setup(k);
  const c = await course(k, k.params.course);
  const u = c.units.find((x) => x.id === k.params.unit);
  const a = u && u.activities.find((x) => x.id === k.params.id);
  if (!a) return el.append(k.ui.error(k.t('Activity not found', 'കണ്ടെത്തിയില്ല')));
  const learner = k.user.role === 'learner';
  el.append(back(k, '#/m/language/course?id=' + c.id), k.h('div', { class: 'language-mini' }, k.t(u.title, u.title_ml), ' · ', u.level), k.h('h2', null, KIND[a.kind][0], ' ', k.t(a.title, a.title_ml)));
  const body = k.h('div'); el.append(body);
  const flat = c.units.flatMap((x) => x.activities.map((y) => ({ u: x.id, a: y.id })));
  const idx = flat.findIndex((x) => x.u === u.id && x.a === a.id);
  const nextOf = flat[idx + 1];
  async function complete(score, data) {
    if (!learner) return k.toast(k.t('Preview only (learners save progress).', 'പ്രിവ്യൂ മാത്രം.'), 'info');
    const r = await k.api.post('/progress', { course_id: c.id, unit_id: u.id, activity_id: a.id, score, data });
    if (r && r.queued) return;
    celebrate(r.awarded);
  }
  function celebrate(awarded) {
    if (awarded && awarded.length) k.toast(k.t(`🎉 New level: ${awarded.map((x) => x.level).join(', ')} — added to your passport!`, `🎉 പുതിയ നില: ${awarded.map((x) => x.level).join(', ')} — പാസ്‌പോർട്ടിൽ ചേർത്തു!`), 'good');
    else k.toast(k.t('Saved ✓', 'സേവ് ചെയ്തു ✓'), 'good');
  }
  const nextBtn = () => (nextOf ? k.ui.button(k.t('Next activity ▶', 'അടുത്തത് ▶'), () => k.go(`#/m/language/activity?course=${c.id}&unit=${nextOf.u}&id=${nextOf.a}`), { tone: 'primary' }) : k.ui.button(k.t('Back to course', 'കോഴ്സിലേക്ക്'), () => k.go('#/m/language/course?id=' + c.id), { tone: 'primary' }));
  const tts = (x) => (x && x.say) || (x && (x.w || x.t));

  if (a.kind === 'vocab') {
    let i = 0, flipped = false; const known = new Set();
    const draw = () => {
      if (i >= a.cards.length) { body.replaceChildren(k.ui.card({ title: k.t('Well done!', 'നന്നായി!'), body: k.t(`You knew ${known.size} of ${a.cards.length} words.`, `${a.cards.length}-ൽ ${known.size} വാക്കുകൾ അറിയാമായിരുന്നു.`), actions: [k.ui.button(k.t('Again', 'വീണ്ടും'), () => { i = 0; known.clear(); draw(); }, { tone: 'ghost' }), nextBtn()] })); complete(known.size / a.cards.length, { known: known.size }); return; }
      const cd = a.cards[i];
      fill(k, body,
        k.h('div', { class: 'language-mini', style: { textAlign: 'center' } }, `${i + 1} / ${a.cards.length} · `, k.t('tap the card to flip', 'കാർഡിൽ തൊട്ട് മറിക്കുക')),
        k.h('div', { class: 'language-card', onclick: () => { flipped = !flipped; draw(); } }, flipped ? [k.h('div', { class: 'm' }, cd.ml), k.h('div', { class: 'language-mini' }, cd.w)] : [k.h('div', { class: 'w' }, cd.w), say(k, tts(cd), c.tts)]),
        k.h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } },
          k.ui.button('🔁 ' + k.t('Still learning', 'പഠിക്കുന്നു'), () => { i++; flipped = false; draw(); }, { tone: 'ghost' }),
          k.ui.button('✓ ' + k.t('I know it', 'അറിയാം'), () => { known.add(i); i++; flipped = false; draw(); }, { tone: 'primary' })));
      if (!flipped) k.speak(tts(cd), c.tts);
    };
    draw();
  } else if (a.kind === 'listen') {
    let reps = 0;
    body.append(k.h('p', { class: 'small muted' }, k.t('Tap 🔊, listen, then say it aloud. Record yourself to compare.', '🔊 അമർത്തി കേൾക്കുക, ഉറക്കെ പറയുക. താരതമ്യത്തിന് റെക്കോർഡ് ചെയ്യുക.')));
    for (const l of a.lines) body.append(k.h('div', { class: 'language-line' }, say(k, tts(l), c.tts), k.h('div', { style: { flex: 1 } }, k.h('div', { class: 't' }, l.t), k.h('div', { class: 'ml' }, l.ml)), k.ui.button('🎙️', () => { reps++; recordModal(k, { title: l.t, tts: c.tts, model: tts(l) }); }, { small: true, tone: 'ghost', title: k.t('Record and compare', 'റെക്കോർഡ് ചെയ്യുക') })));
    body.append(k.h('div', { class: 'row', style: { marginTop: '12px' } }, k.ui.button(k.t('Play all', 'എല്ലാം കേൾക്കുക'), () => k.speak(a.lines.map(tts).join('. '), c.tts), { tone: 'ghost' }), k.ui.button(k.t('I practised these ✓', 'പരിശീലിച്ചു ✓'), async () => { await complete(null, { repeats: Math.max(1, reps) }); }, { tone: 'primary' }), nextBtn()));
  } else if (a.kind === 'convo') {
    let me = 1;
    const draw = () => {
      fill(k, body,
        k.h('div', { class: 'card tone-info small' }, '📍 ', k.t(a.situation, a.situation_ml || a.situation)),
        k.h('div', { class: 'row', style: { margin: '8px 0' } }, k.h('span', { class: 'small' }, k.t('I play: ', 'എന്റെ റോൾ: ')), a.roles.map((r, j) => k.ui.button(r, () => { me = j; draw(); }, { small: true, tone: me === j ? 'primary' : 'ghost' }))),
        a.lines.map((l) => k.h('div', { class: `language-bubble ${l.r === 0 ? 'a' : 'b'}${l.r === me ? ' me' : ''}` }, k.h('small', null, a.roles[l.r], l.r === me ? ' (' + k.t('you', 'നിങ്ങൾ') + ')' : ''), l.t, ' ', say(k, l.t, c.tts), k.h('div', { class: 'language-mini' }, l.ml))),
        k.h('div', { class: 'row', style: { marginTop: '10px' } },
          k.ui.button('▶ ' + k.t('Play other role, I answer', 'മറ്റേ റോൾ കേൾക്കുക'), async () => { for (const l of a.lines) { if (l.r !== me) { k.speak(l.t, c.tts); await new Promise((r) => setTimeout(r, 900 + l.t.length * 70)); } else { k.toast(k.t('Your turn: ', 'നിങ്ങളുടെ ഊഴം: ') + l.t, 'info'); await new Promise((r) => setTimeout(r, 1500 + l.t.length * 90)); } } }, { tone: 'ghost' }),
          k.ui.button('🎙️ ' + k.t('Record my part', 'എന്റെ ഭാഗം റെക്കോർഡ് ചെയ്യുക'), () => recordModal(k, { title: a.title, tts: c.tts, model: a.lines.filter((l) => l.r === me).map((l) => l.t).join(' '), save: learner ? { course_id: c.id, unit_id: u.id, activity_id: a.id } : null }), { tone: 'ghost' }),
          k.ui.button(k.t('Done ✓', 'കഴിഞ്ഞു ✓'), () => complete(null), { tone: 'primary' }), nextBtn()));
    };
    draw();
  } else if (a.kind === 'quiz') {
    let i = 0, right = 0;
    const draw = () => {
      if (i >= a.items.length) { body.replaceChildren(k.ui.card({ title: k.t(`${right} / ${a.items.length} correct`, `${a.items.length}-ൽ ${right} ശരി`), actions: [k.ui.button(k.t('Again', 'വീണ്ടും'), () => { i = 0; right = 0; draw(); }, { tone: 'ghost' }), nextBtn()] })); complete(right / a.items.length); return; }
      const it = a.items[i];
      const order = it.options.map((_, j) => j).sort((x, y) => ((x * 7 + i * 3) % 5) - ((y * 7 + i * 3) % 5));
      body.replaceChildren(k.h('div', { class: 'language-mini' }, `${i + 1} / ${a.items.length}`), k.h('h3', null, it.q, ' ', say(k, it.q, c.tts)),
        k.h('div', { class: 'stack' }, order.map((j) => k.ui.button(it.options[j], () => { if (j === it.answer) { right++; k.toast('✓ ' + k.t('Correct', 'ശരി'), 'good'); } else k.toast('✗ ' + k.t('Answer: ', 'ഉത്തരം: ') + it.options[it.answer], 'bad'); i++; draw(); }, { tone: 'ghost' }))));
    };
    draw();
  } else if (a.kind === 'speak') {
    body.append(k.ui.card({ title: k.t('Your task', 'നിങ്ങളുടെ ടാസ്ക്'), body: [k.h('p', { style: { fontSize: '1.05rem' } }, k.t(a.prompt, a.prompt_ml), ' ', say(k, k.t(a.prompt, a.prompt_ml))), k.h('details', null, k.h('summary', { class: 'small' }, k.t('Hear a model answer', 'മാതൃകാ ഉത്തരം കേൾക്കുക')), k.h('p', null, a.model, ' ', say(k, a.model, c.tts)))] }));
    body.append(recorder(k, { tts: c.tts, model: a.model, save: learner ? { course_id: c.id, unit_id: u.id, activity_id: a.id } : null, onSaved: (r) => { celebrate(r.awarded); } }));
    body.append(k.h('div', { class: 'row', style: { marginTop: '10px' } }, nextBtn()));
  }
}

// ======================================================================= recorder (MediaRecorder; audio stays on the device)
function recordModal(k, opts) { const m = k.ui.modal(k.t('Record & compare', 'റെക്കോർഡ് ചെയ്ത് താരതമ്യം'), recorder(k, { ...opts, onSaved: (r) => { m.close(); k.toast(r.awarded && r.awarded.length ? '🎉 ' + r.awarded.map((x) => x.level).join(', ') : k.t('Saved ✓', 'സേവ് ചെയ്തു ✓'), 'good'); } })); }

function recorder(k, { tts, model, save, onSaved, title } = {}) {
  const wrap = k.h('div', { class: 'language-rec' });
  let rec = null, chunks = [], blob = null, url = null, startedAt = 0, timer = null, stream = null, stars = 0, peer = 0;
  const checks = new Set();
  const status = k.h('div', { class: 'small' }, k.t('Tap the mic and speak. Your voice stays on this phone unless you choose to share it.', 'മൈക്ക് അമർത്തി സംസാരിക്കുക. നിങ്ങൾ പങ്കിടാൻ തിരഞ്ഞെടുക്കാത്തിടത്തോളം ശബ്ദം ഈ ഫോണിൽ മാത്രം.'));
  const mic = k.h('button', { class: 'language-mic', 'aria-label': k.t('Record', 'റെക്കോർഡ്'), onclick: () => (rec && rec.state === 'recording' ? stop() : start()) }, '🎙️');
  const player = k.h('div');
  const after = k.h('div', { style: { width: '100%', display: 'none' } });
  const supported = typeof window !== 'undefined' && window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  async function start() {
    if (!supported) { k.toast(k.t('Recording is not supported on this device — you can still rate yourself after speaking aloud.', 'ഈ ഉപകരണത്തിൽ റെക്കോർഡിംഗ് ഇല്ല — ഉറക്കെ പറഞ്ഞ് സ്വയം റേറ്റ് ചെയ്യാം.'), 'warn'); showAfter(); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (_) { k.toast(k.t('Microphone permission was denied.', 'മൈക്രോഫോൺ അനുമതി ഇല്ല.'), 'bad'); showAfter(); return; }
    chunks = [];
    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', ''].find((m) => !m || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)));
    try { rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 }); } catch (_) { rec = new MediaRecorder(stream); }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob); player.replaceChildren(k.h('audio', { controls: true, src: url, style: { width: '100%' } })); showAfter(); };
    rec.start(); startedAt = Date.now(); mic.classList.add('on'); mic.textContent = '⏹';
    timer = setInterval(() => { const s = Math.round((Date.now() - startedAt) / 1000); status.textContent = k.t(`Recording… ${s}s (max 60s)`, `റെക്കോർഡിംഗ്… ${s}s`); if (s >= 60 || !wrap.isConnected) stop(); }, 500);
  }
  function stop() { clearInterval(timer); if (rec && rec.state === 'recording') rec.stop(); mic.classList.remove('on'); mic.textContent = '🎙️'; status.textContent = k.t('Listen to yourself, then compare with the model.', 'നിങ്ങളെ കേൾക്കൂ, മാതൃകയുമായി താരതമ്യം ചെയ്യൂ.'); }
  const starRow = (get, set) => { const row = k.h('div', { class: 'language-stars', role: 'radiogroup' }); const draw = () => row.replaceChildren(...[1, 2, 3, 4, 5].map((n) => k.h('button', { class: n <= get() ? 'on' : '', 'aria-label': n + ' stars', onclick: () => { set(n); draw(); } }, '★'))); draw(); return row; };
  function showAfter() {
    after.style.display = '';
    const share = k.h('input', { type: 'checkbox' });
    const req = k.h('input', { type: 'checkbox', checked: true });
    fill(k, after,
      model ? k.h('div', { class: 'row', style: { justifyContent: 'center' } }, k.ui.button('🔊 ' + k.t('Model', 'മാതൃക'), () => k.speak(model, tts), { small: true, tone: 'ghost' }), url ? k.ui.button('▶ ' + k.t('Me', 'ഞാൻ'), () => player.querySelector('audio')?.play(), { small: true, tone: 'ghost' }) : null) : null,
      k.h('div', { class: 'small', style: { textAlign: 'center', marginTop: '8px' } }, k.t('Pronunciation self-check', 'ഉച്ചാരണ സ്വയം പരിശോധന')),
      k.h('div', { class: 'language-checks' }, [['clear', 'Clear words', 'വ്യക്തമായ വാക്കുകൾ'], ['pace', 'Not too fast', 'അമിതവേഗമില്ല'], ['complete', 'Said everything', 'എല്ലാം പറഞ്ഞു'], ['confident', 'Felt confident', 'ആത്മവിശ്വാസം']].map(([id, en, ml]) => k.h('label', null, k.h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? checks.add(id) : checks.delete(id)) }), k.t(en, ml)))),
      k.h('div', { class: 'small', style: { textAlign: 'center', marginTop: '8px' } }, k.t('How did it go? (me)', 'എങ്ങനെയുണ്ടായിരുന്നു? (ഞാൻ)')), starRow(() => stars, (n) => { stars = n; }),
      k.h('details', null, k.h('summary', { class: 'small' }, k.t('A friend listened? Add their rating', 'കൂട്ടുകാരൻ കേട്ടോ? അവരുടെ റേറ്റിംഗ്')), starRow(() => peer, (n) => { peer = n; })),
      save ? k.h('label', { class: 'small row', style: { gap: '6px', marginTop: '8px' } }, req, k.t('Ask my teacher to review', 'അധ്യാപകരോട് പരിശോധിക്കാൻ പറയുക')) : null,
      save && blob ? k.h('label', { class: 'small row', style: { gap: '6px' } }, share, k.t(`Share this recording with my teacher (${Math.round(blob.size / 1024)} KB, max 150 KB). You can delete it any time.`, `ഈ റെക്കോർഡിംഗ് അധ്യാപകരുമായി പങ്കിടുക (${Math.round(blob.size / 1024)} KB). എപ്പോൾ വേണമെങ്കിലും മായ്ക്കാം.`)) : null,
      save ? k.h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, k.ui.button(k.t('Save my rating', 'റേറ്റിംഗ് സേവ് ചെയ്യുക'), async () => {
        if (!stars) return k.toast(k.t('Choose 1–5 stars first.', 'ആദ്യം നക്ഷത്രങ്ങൾ തിരഞ്ഞെടുക്കുക.'), 'warn');
        const body = { ...save, self_rating: stars, peer_rating: peer || null, checks: [...checks], duration_s: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0, request_review: req.checked };
        if (blob && share.checked) {
          if (blob.size > MAX_SAMPLE) return k.toast(k.t('Recording is too long to share (max 150 KB ≈ 30 s). Record a shorter one or save the rating only.', 'പങ്കിടാൻ വളരെ നീളം. ചെറുതായി റെക്കോർഡ് ചെയ്യുക.'), 'warn');
          body.share_sample = true; body.sample_mime = blob.type; body.sample = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(blob); });
        }
        const r = await k.api.post('/speaking', body);
        if (r && !r.queued && onSaved) onSaved(r);
      }, { tone: 'primary' })) : null);
  }
  fill(k, wrap, title ? k.h('b', null, title) : null, mic, status, player, after);
  return wrap;
}

// ======================================================================= mother-tongue bridge
async function bridge(el, k) {
  setup(k);
  const d = await k.api.get('/bridge' + (k.params.language ? '?language=' + encodeURIComponent(k.params.language) : ''));
  el.append(k.h('h2', null, '🌿 ', k.t('Mother-tongue bridge', 'മാതൃഭാഷാ പാലം')));
  el.append(k.h('div', { class: 'card tone-warn small' }, '⚠️ ', k.t(d.disclaimer, d.disclaimer_ml)));
  const sel = k.params.language || '';
  el.append(k.h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', margin: '8px 0' } }, k.ui.button(k.t('All', 'എല്ലാം'), () => k.go('#/m/language/bridge'), { small: true, tone: sel ? 'ghost' : 'primary' }), d.languages.map((l) => k.ui.button(`${l.id} (${l.count})`, () => k.go('#/m/language/bridge?language=' + l.id), { small: true, tone: sel === l.id ? 'primary' : 'ghost' }))));
  const canReview = ['teacher', 'agency_admin', 'platform_admin', 'coordinator'].includes(k.user.role);
  const tag = (w) => k.h('span', { class: 'language-draft' + (w.status === 'community_checked' ? ' ok' : w.status === 'needs_fix' ? ' fix' : ''), title: w.status_label }, w.status === 'community_checked' ? k.t('community-checked', 'സമൂഹം പരിശോധിച്ചു') : w.status === 'needs_fix' ? k.t('needs fix', 'തിരുത്തണം') : k.t('community draft, pending review', 'കരട് — പരിശോധന ബാക്കി'));
  el.append(k.ui.card({ title: k.t('Word list', 'വാക്കുകൾ'), subtitle: k.t('Mother tongue → Malayalam → English', 'മാതൃഭാഷ → മലയാളം → ഇംഗ്ലീഷ്'), body: d.words.length ? d.words.map((w) => k.h('div', null,
    k.h('div', { class: 'language-word' }, k.h('div', null, k.h('div', { class: 'tw' }, w.word), k.h('div', { class: 'language-mini' }, w.language, w.pronunciation ? ' · /' + w.pronunciation + '/' : '')), k.h('div', { class: 'ml' }, w.ml, ' ', say(k, w.ml, 'ml-IN')), k.h('div', { class: 'en' }, w.en, ' ', say(k, w.en, 'en-IN'))),
    k.h('div', { class: 'language-mini', style: { paddingBottom: '6px' } }, tag(w), ' · ', k.t('by ', 'സംഭാവന: '), w.contributor, w.reviews ? ` · ${w.reviews} ${k.t('review(s)', 'പരിശോധന')}` : '', w.note ? ' · ' + w.note : '',
      canReview && !w.mine ? k.h('span', null, ' ', k.ui.button('✓', async () => { await k.api.post(`/bridge/${w.id}/review`, { verdict: 'community_checked' }); k.refresh(); }, { small: true, tone: 'ghost', title: k.t('Mark community-checked', 'പരിശോധിച്ചു') }), k.ui.button('✎', async () => { const note = prompt(k.t('What needs fixing?', 'എന്താണ് തിരുത്തേണ്ടത്?')); if (note !== null) { await k.api.post(`/bridge/${w.id}/review`, { verdict: 'needs_fix', note }); k.refresh(); } }, { small: true, tone: 'ghost', title: k.t('Needs fix', 'തിരുത്തണം') })) : null))) : k.ui.empty(k.t('No words yet for this language — be the first!', 'ഈ ഭാഷയിൽ വാക്കുകൾ ഇല്ല — ആദ്യം നിങ്ങളാകൂ!')) }));
  if (['learner', 'guardian', 'teacher', 'facilitator', 'mentor', 'agency_admin', 'platform_admin'].includes(k.user.role)) {
    el.append(k.ui.card({ title: '➕ ' + k.t('Add a word from your language', 'നിങ്ങളുടെ ഭാഷയിലെ വാക്ക് ചേർക്കുക'), body: k.ui.form([
      { name: 'language', label: k.t('Language', 'ഭാഷ'), type: 'select', options: d.languages.map((l) => l.id), required: true, value: sel },
      { name: 'en', label: k.t('Meaning (English)', 'അർത്ഥം (ഇംഗ്ലീഷ്)'), type: 'select', options: d.concepts.map((c) => ({ value: c.en, label: `${c.en} — ${c.ml}` })), required: true },
      { name: 'word', label: k.t('The word in your language', 'നിങ്ങളുടെ ഭാഷയിലെ വാക്ക്'), required: true, placeholder: k.t('Write it the way you say it', 'പറയുന്നതുപോലെ എഴുതുക') },
      { name: 'pronunciation', label: k.t('How to say it (optional)', 'ഉച്ചാരണം (ഐച്ഛികം)') },
      { name: 'note', label: k.t('Note (village, usage…)', 'കുറിപ്പ്') },
      { name: 'anonymous', label: k.t('Do not show my name', 'എന്റെ പേര് കാണിക്കരുത്'), type: 'checkbox' },
    ], async (v) => { await k.api.post('/bridge', v); k.toast(k.t('Thank you! Added as a community draft.', 'നന്ദി! കരടായി ചേർത്തു.'), 'good'); k.refresh(); }, { submitLabel: k.t('Add word', 'ചേർക്കുക') }) }));
  }
}

// ======================================================================= teacher
async function teach(el, k) {
  setup(k);
  const progs = await k.api.get('/teach/programmes');
  el.append(k.h('h2', null, k.t('Language classes', 'ഭാഷാ ക്ലാസുകൾ')), k.h('p', { class: 'small muted' }, k.t('Learners appear only when enrolled in your agency\'s language programme with active progress consent.', 'നിങ്ങളുടെ ഏജൻസിയുടെ ഭാഷാ പരിപാടിയിൽ ചേർന്ന്, സമ്മതം നൽകിയവർ മാത്രം.')));
  el.append(k.h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px' } }, k.ui.button('🎧 ' + k.t('Speaking review queue', 'സംസാര പരിശോധന'), () => k.go('#/m/language/review'), { tone: 'primary', small: true }), k.ui.button('🌿 ' + k.t('Mother-tongue words', 'മാതൃഭാഷാ വാക്കുകൾ'), () => k.go('#/m/language/bridge'), { small: true, tone: 'ghost' })));
  el.append(progs.length ? k.ui.grid(progs.map((p) => k.ui.card({ title: k.t(p.hamlet, p.hamlet_ml), subtitle: `${p.title} · ${p.agency}`,
    body: [k.ui.grid([k.ui.stat(k.t('Learners', 'പഠിതാക്കൾ'), `${p.visible}/${p.enrolled}`), k.ui.stat(k.t('To review', 'പരിശോധന'), p.pending_reviews), k.ui.stat(k.t('Active (30d)', 'സജീവം'), p.active_30d)], 90), p.next_circle ? k.h('div', { class: 'language-mini' }, '👥 ', k.t('Next circle ', 'അടുത്ത കൂട്ടം '), fmtDate(p.next_circle.date, k), ' ', p.next_circle.time) : null],
    actions: [k.ui.button(k.t('Open class', 'ക്ലാസ് തുറക്കുക'), () => k.go('#/m/language/class?id=' + p.id), { tone: 'primary', small: true })] })), 280) : k.ui.empty(k.t('Your agency runs no language classes.', 'ഭാഷാ ക്ലാസുകൾ ഇല്ല.')));
}

async function classView(el, k) {
  setup(k);
  const [d, m] = await Promise.all([k.api.get('/teach/class/' + k.params.id), meta(k)]);
  el.append(back(k, '#/m/language/teach'), k.h('h2', null, k.t(d.programme.title, d.programme.title_ml), ' · ', k.t(d.programme.hamlet, d.programme.hamlet_ml)));
  if (d.hidden_without_consent) el.append(k.h('div', { class: 'card tone-warn small' }, `🔒 ${d.hidden_without_consent} `, k.t('learner(s) hidden — no active progress consent for your agency.', 'പഠിതാക്കളെ മറച്ചു — സമ്മതം ഇല്ല.')));
  el.append(k.ui.tabs([
    { id: 'learners', label: k.t('Learners', 'പഠിതാക്കൾ'), render: async (t) => {
      t.append(k.ui.bars(d.levels.map((l) => ({ label: 'English ' + l.level, value: l.n }))));
      t.append(k.ui.table([
        { label: k.t('Learner', 'പഠിതാവ്'), render: (r) => k.h('span', null, k.h('b', null, r.name), k.h('div', { class: 'language-mini' }, r.home_language || '')) },
        { label: 'ENG', render: (r) => lvl(k, r.levels['eng-spoken']) },
        { label: k.t('Other', 'മറ്റുള്ളവ'), render: (r) => Object.entries(r.levels).filter(([c, v]) => c !== 'eng-spoken' && v).map(([c, v]) => k.ui.pill(`${c.replace('ml-literacy', 'ML').replace('eng-written', 'ENG-W')} ${v}`)) },
        { label: '🎙️', render: (r) => `${r.speaking}${r.avg_rating ? ' · ★' + r.avg_rating : ''}` },
        { label: k.t('To review', 'പരിശോധന'), render: (r) => (r.pending ? k.ui.badge(r.pending, 'warn') : '—') },
        { label: k.t('Circles', 'കൂട്ടം'), render: (r) => (r.attendance === null ? '—' : r.attendance + '%') },
        { label: k.t('Last active', 'അവസാനം'), render: (r) => fmtDate(r.last, k) },
      ], d.learners, { onRow: (r) => k.go('#/m/language/home?person_id=' + r.id) }));
    } },
    { id: 'circles', label: k.t('Peer circles', 'കൂട്ടങ്ങൾ'), render: async (t) => {
      const cs = await k.api.get('/circles?programme_id=' + d.programme.id);
      t.append(k.ui.table([
        { label: k.t('Date', 'തീയതി'), render: (c) => `${fmtDate(c.date, k)} ${c.time}` },
        { label: k.t('Role-play', 'റോൾ-പ്ലേ'), render: (c) => k.t(c.title, c.title_ml) },
        { label: k.t('Status', 'നില'), render: (c) => (c.status === 'held' ? k.ui.badge(`${c.present}/${c.marked}`, 'good') : k.ui.badge(k.t('scheduled', 'നിശ്ചയിച്ചു'), 'info')) },
      ], cs, { onRow: (c) => attendanceModal(k, c) }));
      t.append(k.ui.card({ title: k.t('Schedule a circle', 'കൂട്ടം നിശ്ചയിക്കുക'), body: k.ui.form([
        { name: 'date', label: k.t('Date', 'തീയതി'), type: 'date', required: true }, { name: 'time', label: k.t('Time', 'സമയം'), value: '16:00' },
        { name: 'roleplay_id', label: k.t('Role-play prompt', 'റോൾ-പ്ലേ'), type: 'select', options: m.roleplays.map((r) => ({ value: r.id, label: k.t(r.title, r.title_ml) })), required: true },
        { name: 'place', label: k.t('Place', 'സ്ഥലം'), value: 'Learning centre' },
      ], async (v) => { await k.api.post('/circles', { ...v, programme_id: d.programme.id }); k.toast(k.t('Scheduled', 'നിശ്ചയിച്ചു'), 'good'); k.refresh(); }) }));
    } },
  ]));
}

async function attendanceModal(k, c) {
  const r = await k.api.get(`/circles/${c.id}/roster`);
  const marks = new Map(r.roster.map((x) => [x.person_id, x.present ?? true]));
  const list = k.h('div', null, r.roster.map((x) => k.h('label', { class: 'row', style: { gap: '8px', padding: '4px 0' } }, k.h('input', { type: 'checkbox', checked: marks.get(x.person_id), onchange: (e) => marks.set(x.person_id, e.target.checked) }), x.name)));
  const notes = k.h('textarea', { placeholder: k.t('Notes', 'കുറിപ്പ്'), style: { width: '100%' } }, c.notes || '');
  const m = k.ui.modal(k.t('Attendance', 'ഹാജർ') + ' · ' + fmtDate(c.date, k), k.h('div', null, r.circle.roleplay ? k.h('p', { class: 'small' }, '🎭 ', k.t(r.circle.roleplay.prompt, r.circle.roleplay.prompt_ml)) : null, list, notes, r.hidden_without_consent ? k.h('p', { class: 'language-mini' }, `🔒 ${r.hidden_without_consent} ${k.t('hidden (no consent)', 'മറച്ചു')}`) : null,
    k.ui.button(k.t('Save attendance', 'ഹാജർ സേവ് ചെയ്യുക'), async () => { await k.api.post(`/circles/${c.id}/attendance`, { marks: [...marks].map(([person_id, present]) => ({ person_id, present })), notes: notes.value }); m.close(); k.toast(k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); k.refresh(); }, { tone: 'primary' })));
}

async function review(el, k) {
  setup(k);
  const status = k.params.status || 'pending';
  const rows = await k.api.get('/review?status=' + status);
  el.append(back(k, '#/m/language/teach'), k.h('h2', null, '🎧 ', k.t('Speaking review queue', 'സംസാര പരിശോധന')));
  el.append(k.h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px' } }, k.ui.button(k.t('Waiting', 'കാത്തിരിക്കുന്നവ'), () => k.go('#/m/language/review'), { small: true, tone: status === 'pending' ? 'primary' : 'ghost' }), k.ui.button(k.t('Reviewed', 'പരിശോധിച്ചവ'), () => k.go('#/m/language/review?status=reviewed'), { small: true, tone: status === 'reviewed' ? 'primary' : 'ghost' })));
  if (!rows.length) return el.append(k.ui.empty(k.t('Nothing waiting. 🎉', 'ഒന്നും ബാക്കിയില്ല. 🎉')));
  for (const s of rows) {
    const audio = k.h('div');
    let r = s.teacher_rating || 0;
    const stars = k.h('div', { class: 'language-stars' });
    const drawStars = () => stars.replaceChildren(...[1, 2, 3, 4, 5].map((n) => k.h('button', { class: n <= r ? 'on' : '', onclick: () => { r = n; drawStars(); } }, '★')));
    drawStars();
    const note = k.h('input', { placeholder: k.t('One kind, specific tip', 'ഒരു നല്ല നിർദ്ദേശം'), value: s.teacher_note || '', style: { width: '100%' } });
    el.append(k.ui.card({ title: `${s.learner} — ${s.activity || ''}`, subtitle: `${s.course || ''} · ${fmtDate(s.created_at, k)} · ${k.t('self', 'സ്വയം')} ${'★'.repeat(s.self_rating || 0)}${s.peer_rating ? ' · ' + k.t('peer', 'കൂട്ടുകാരൻ') + ' ' + '★'.repeat(s.peer_rating) : ''}`,
      body: [k.h('p', { class: 'small' }, '📝 ', s.prompt), s.model ? k.h('p', { class: 'language-mini' }, k.t('Model: ', 'മാതൃക: '), s.model, ' ', say(k, s.model, s.tts)) : null, (s.checks || []).length ? k.h('div', { class: 'language-mini' }, k.t('Self-check: ', 'സ്വയം പരിശോധന: '), s.checks.join(', ')) : null,
        s.sample_bytes ? k.ui.button('▶ ' + k.t(`Play shared sample (${Math.round(s.sample_bytes / 1024)} KB)`, 'സാമ്പിൾ കേൾക്കുക'), async () => { const x = await k.api.get(`/speaking/${s.id}/sample`); audio.replaceChildren(k.h('audio', { controls: true, autoplay: true, src: `data:${x.mime};base64,${x.data}` })); }, { small: true }) : k.h('div', { class: 'language-mini' }, k.t('No audio shared — rate from the live class or the learner\'s self-check.', 'ശബ്ദം പങ്കിട്ടിട്ടില്ല.')), audio, stars, note],
      actions: status === 'pending' ? [k.ui.button(k.t('Save review', 'സേവ് ചെയ്യുക'), async () => { if (!r) return k.toast(k.t('Choose a rating', 'റേറ്റിംഗ് തിരഞ്ഞെടുക്കുക'), 'warn'); await k.api.post('/review/' + s.id, { rating: r, note: note.value, discard_sample: true }); k.toast(k.t('Reviewed — sample discarded', 'പരിശോധിച്ചു — സാമ്പിൾ നീക്കി'), 'good'); k.refresh(); }, { tone: 'primary' })] : null }));
  }
}

// ======================================================================= admin
async function admin(el, k) {
  setup(k);
  const d = await k.api.get('/admin/overview');
  el.append(k.h('h2', null, k.t('Language Lab — overview', 'ഭാഷാ പഠനം — അവലോകനം')), k.h('p', { class: 'small muted' }, k.t('Aggregates only; small counts are suppressed for external viewers.', 'സംഗ്രഹം മാത്രം.')));
  el.append(k.ui.grid([k.ui.stat(k.t('Active learners', 'പഠിതാക്കൾ'), d.totals.learners), k.ui.stat(k.t('Activities done', 'പ്രവർത്തനങ്ങൾ'), d.totals.activities), k.ui.stat(k.t('Speaking attempts', 'സംസാര ശ്രമങ്ങൾ'), d.totals.speaking), k.ui.stat(k.t('Teacher-reviewed', 'അധ്യാപക പരിശോധന'), d.totals.reviewed), k.ui.stat(k.t('Circle attendance', 'കൂട്ടം ഹാജർ'), d.totals.circles_attendance === null ? '—' : d.totals.circles_attendance + '%'), k.ui.stat(k.t('Mother-tongue words', 'മാതൃഭാഷാ വാക്കുകൾ'), d.totals.words, k.t('community drafts', 'കരട്'))], 150));
  el.append(k.ui.grid([
    ...d.levels.map((c) => k.ui.card({ title: k.t(c.title, c.title_ml), body: k.ui.bars(c.by.map((b) => ({ label: b.level, value: typeof b.n === 'number' ? b.n : 0 }))), subtitle: c.by.some((b) => typeof b.n !== 'number') ? k.t('Some counts suppressed (<5)', 'ചില എണ്ണങ്ങൾ മറച്ചു (<5)') : null })),
    k.ui.card({ title: k.t('Activity per month', 'മാസം തോറും'), body: k.ui.bars(d.months.map((m) => ({ label: m.month, value: m.activities }))) }),
    k.ui.card({ title: k.t('Mother-tongue bridge', 'മാതൃഭാഷാ പാലം'), body: k.ui.table([{ label: k.t('Language', 'ഭാഷ'), key: 'language' }, { label: k.t('Words', 'വാക്കുകൾ'), key: 'total' }, { label: k.t('Checked', 'പരിശോധിച്ചത്'), key: 'checked' }], d.words) }),
  ], 300));
}

export default { views: { home, course: courseView, activity, bridge, teach, class: classView, review, admin } };
