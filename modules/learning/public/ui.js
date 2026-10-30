// AADI · learning module UI — learner home, lesson player, diagnostic, homework,
// guardian view, facilitator console, sessions/attendance, literacy circles, library, overview.
// Plain ES module; no DOM access at import time.

const CSS = `
.learning-hero{background:linear-gradient(135deg,#0f5a4e,#1f8a70);color:#fff;border-radius:18px;padding:18px 18px 16px;position:relative;overflow:hidden}
.learning-hero::after{content:'';position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.08)}
.learning-hero h2{margin:0 0 4px;font-size:1.35rem;color:#fff}
.learning-hero .learning-sub{opacity:.9;font-size:.92rem}
.learning-hero-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.learning-chip{background:rgba(255,255,255,.16);border-radius:999px;padding:6px 12px;font-size:.88rem;display:inline-flex;align-items:center;gap:6px}
.learning-goals{display:flex;flex-direction:column;gap:8px}
.learning-goal{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:var(--card-2,#f6f7f5);border:1px solid rgba(0,0,0,.06);cursor:pointer;min-height:56px}
.learning-goal.done{opacity:.65}
.learning-goal .learning-gi{font-size:1.6rem;width:40px;text-align:center}
.learning-goal .learning-gt{flex:1;font-weight:600;line-height:1.3}
.learning-goal .learning-gt small{display:block;font-weight:400;opacity:.75}
.learning-check{width:26px;height:26px;border-radius:50%;border:2px solid #1f8a70;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.9rem}
.learning-goal.done .learning-check{background:#1f8a70}
.learning-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.learning-tile{border-radius:14px;padding:12px;background:var(--card-2,#f6f7f5);border:1px solid rgba(0,0,0,.06);cursor:pointer;display:flex;flex-direction:column;gap:6px;min-height:110px;position:relative}
.learning-tile:hover{border-color:#1f8a70}
.learning-tile .learning-ti{font-size:1.7rem}
.learning-tile .learning-tt{font-weight:600;font-size:.92rem;line-height:1.25}
.learning-tile .learning-tm{font-size:.78rem;opacity:.7;margin-top:auto}
.learning-ribbon{position:absolute;top:8px;right:8px;font-size:.7rem;padding:2px 7px;border-radius:999px;background:#fde68a;color:#7c2d12}
.learning-badges{display:flex;flex-wrap:wrap;gap:8px}
.learning-badge{display:flex;flex-direction:column;align-items:center;width:78px;text-align:center;font-size:.72rem;gap:2px}
.learning-badge .learning-bi{font-size:1.7rem;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fef3c7;box-shadow:inset 0 0 0 2px #f59e0b}
.learning-badge.locked .learning-bi{background:#eee;box-shadow:none;filter:grayscale(1);opacity:.45}
.learning-badge.locked{opacity:.6}
.learning-meter{height:14px;border-radius:999px;background:rgba(0,0,0,.08);overflow:hidden}
.learning-meter>span{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#1f8a70);border-radius:999px;transition:width .6s}
.learning-flame{font-size:2.2rem;line-height:1}
.learning-streakdays{display:flex;gap:4px;margin-top:6px}
.learning-streakdays i{width:16px;height:16px;border-radius:4px;background:rgba(0,0,0,.08);display:block}
.learning-streakdays i.on{background:#f59e0b}
.learning-player{max-width:760px;margin:0 auto}
.learning-lessonhead{display:flex;gap:12px;align-items:center}
.learning-lessonhead .learning-big{font-size:2.6rem;width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#ecfdf5}
.learning-body{font-size:1.12rem;line-height:1.75;padding:14px 16px;border-radius:14px;background:#fffdf5;border:1px solid #f3e8c8;white-space:pre-wrap}
.learning-body.ml{font-size:1.18rem}
.learning-speak{display:inline-flex;align-items:center;gap:8px;font-size:1rem;padding:10px 16px;border-radius:999px;border:0;background:#1f8a70;color:#fff;cursor:pointer;min-height:44px}
.learning-speak.alt{background:#1d4ed8}
.learning-bridge{border-left:4px solid #b45309;background:#fff7ed;padding:10px 12px;border-radius:10px;font-size:.92rem}
.learning-q{padding:14px;border-radius:14px;border:1px solid rgba(0,0,0,.08);background:#fff;margin-bottom:12px}
.learning-q .learning-qt{font-weight:600;font-size:1.06rem;margin-bottom:10px;display:flex;gap:8px;align-items:flex-start}
.learning-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.learning-opt{padding:12px;border-radius:12px;border:2px solid rgba(0,0,0,.1);background:#fafafa;cursor:pointer;font-size:1rem;text-align:left;min-height:48px}
.learning-opt:hover{border-color:#1f8a70}
.learning-opt.sel{border-color:#1d4ed8;background:#eff6ff}
.learning-opt.right{border-color:#15803d;background:#dcfce7}
.learning-opt.wrong{border-color:#b91c1c;background:#fee2e2}
.learning-x{margin-top:8px;font-size:.92rem;padding:8px 10px;border-radius:10px;background:#f0fdf4}
.learning-x.bad{background:#fef2f2}
.learning-result{text-align:center;padding:20px;border-radius:18px;background:linear-gradient(135deg,#fef3c7,#d1fae5)}
.learning-result .learning-score{font-size:3rem;font-weight:800}
.learning-iconmode .learning-opt{font-size:1.4rem;text-align:center}
.learning-iconmode .learning-hidetext{display:none}
.learning-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.learning-att{display:flex;flex-direction:column;gap:6px}
.learning-attrow{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:var(--card-2,#f6f7f5)}
.learning-attrow .learning-nm{flex:1;min-width:0}
.learning-attrow .learning-nm b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.learning-seg{display:flex;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,.12)}
.learning-seg button{border:0;background:#fff;padding:8px 10px;min-width:40px;cursor:pointer;font-weight:700}
.learning-seg button.on.p{background:#15803d;color:#fff}
.learning-seg button.on.l{background:#ca8a04;color:#fff}
.learning-seg button.on.a{background:#b91c1c;color:#fff}
.learning-seg button.on.e{background:#64748b;color:#fff}
.learning-ring{--v:0;width:46px;height:46px;border-radius:50%;background:conic-gradient(var(--c,#1f8a70) calc(var(--v)*1%),rgba(0,0,0,.08) 0);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;flex:none}
.learning-ring>span{width:36px;height:36px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}
.learning-subj{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:var(--card-2,#f6f7f5)}
.learning-subj .learning-sn{flex:1}
.learning-levels{display:flex;gap:6px}
.learning-levels span{flex:1;padding:8px 4px;border-radius:10px;text-align:center;font-size:.78rem;background:rgba(0,0,0,.06)}
.learning-levels span.on{background:#0f766e;color:#fff}
.learning-thumb{max-width:160px;max-height:160px;border-radius:10px;border:1px solid rgba(0,0,0,.1)}
.learning-flagrow{display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;cursor:pointer}
.learning-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.74rem;background:rgba(0,0,0,.07);margin:2px 4px 2px 0}
.learning-sess{display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;background:var(--card-2,#f6f7f5);cursor:pointer}
.learning-sess .learning-time{font-weight:800;font-size:1.05rem;width:56px;text-align:center}
.learning-muted{opacity:.72;font-size:.86rem}
.learning-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.learning-stack{display:flex;flex-direction:column;gap:12px}
.learning-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.learning-hbar{display:flex;align-items:flex-end;gap:4px;height:70px}
.learning-hbar i{flex:1;background:#1f8a70;border-radius:4px 4px 0 0;min-height:2px;opacity:.85}
@media (max-width:420px){.learning-opts{grid-template-columns:1fr}.learning-hero h2{font-size:1.15rem}}
@media (prefers-color-scheme:dark){.learning-body{background:#2a2617;border-color:#4a3f1f}.learning-q,.learning-opt,.learning-seg button,.learning-ring>span{background:#1e1e1e;color:inherit}.learning-bridge,.learning-flagrow{background:#2c1f12}.learning-x{background:#12301f}.learning-x.bad{background:#3a1515}.learning-lessonhead .learning-big{background:#12301f}.learning-opt.sel{background:#172554}.learning-opt.right{background:#14532d}.learning-opt.wrong{background:#450a0a}}
`;

const ICONMODE_KEY = 'learning.iconmode';
const getIconMode = (k) => { try { const v = localStorage.getItem(ICONMODE_KEY); if (v !== null) return v === '1'; } catch (_) { /* ignore */ } return !!(k && k.simple); };
const setIconMode = (v) => { try { localStorage.setItem(ICONMODE_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ } };

const SUBJ_FALLBACK = { malayalam: { en: 'Malayalam', ml: 'മലയാളം', icon: 'അ', colour: '#c2410c' }, english: { en: 'English', ml: 'ഇംഗ്ലീഷ്', icon: '🔤', colour: '#1d4ed8' }, math: { en: 'Maths', ml: 'ഗണിതം', icon: '🔢', colour: '#7c3aed' }, evs: { en: 'EVS / Science', ml: 'പരിസരപഠനം', icon: '🌿', colour: '#15803d' }, social: { en: 'Social Science', ml: 'സാമൂഹ്യശാസ്ത്രം', icon: '🗺️', colour: '#b45309' }, literacy: { en: 'Adult Literacy', ml: 'സാക്ഷരത', icon: '✍️', colour: '#0f766e' } };
const REASONS = { low_attendance: ['Low attendance', 'ഹാജർ കുറവ്'], learning_gap: ['Learning gap', 'പഠന വിടവ്'], dropout_risk: ['Dropout risk', 'പഠനം നിർത്താനുള്ള സാധ്യത'], other: ['Other concern', 'മറ്റ് ആശങ്ക'] };
const COHORT = { special_attention: ['Special attention', 'പ്രത്യേക ശ്രദ്ധ', 'bad'], catch_up: ['Catch-up path', 'ഒപ്പമെത്താനുള്ള പാത', 'warn'], on_track: ['On track', 'ശരിയായ പാതയിൽ', 'good'] };

function setup(k) { k.style(CSS); }
const T = (k, o, f = 'title') => k.t(o[f] || '', o[f + '_ml'] || o[f] || '');
const pctTxt = (v) => (v === null || v === undefined ? '—' : Math.round(v * 100) + '%');
const fmtDate = (k, d) => { if (!d) return '—'; try { return new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short' }); } catch (_) { return d.slice(0, 10); } };
const today = () => new Date().toISOString().slice(0, 10);
function ring(k, v, colour) { const n = Math.round((v || 0) * 100); return k.h('div', { class: 'learning-ring', style: `--v:${n};--c:${colour || '#1f8a70'}` }, k.h('span', {}, v === null || v === undefined ? '—' : n + '%')); }
function meter(k, v) { return k.h('div', { class: 'learning-meter' }, k.h('span', { style: `width:${Math.max(2, Math.min(100, Math.round((v || 0) * 100)))}%` })); }
function speakBtn(k, text, lang, label, alt) { if (!text) return null; return k.h('button', { class: 'learning-speak' + (alt ? ' alt' : ''), onclick: (e) => { e.stopPropagation(); k.speak(text, lang); }, 'aria-label': label }, '🔊 ', label); }
function subjInfo(subjects, s) { return (subjects && subjects[s]) || SUBJ_FALLBACK[s] || { en: s, ml: s, icon: '📘' }; }
function errBox(k, el, e) { el.innerHTML = ''; el.append(k.ui.error(e)); }
async function guarded(k, el, fn) { el.innerHTML = ''; const ld = k.ui.loading(); el.append(ld); try { await fn(); } catch (e) { errBox(k, el, e); } finally { if (ld.parentNode) ld.remove(); } }
function offlineNote(k, r) { return r && r._offline ? k.ui.badge(k.t('Offline copy', 'ഓഫ്‌ലൈൻ പകർപ്പ്'), 'warn') : null; }
function lessonTile(k, l, subjects, extra) {
  const s = subjInfo(subjects, l.subject);
  return k.h('div', { class: 'learning-tile', style: `border-top:4px solid ${s.colour || '#1f8a70'}`, onclick: () => k.go(`#/m/learning/lesson?id=${encodeURIComponent(l.id)}`) },
    l.bridge ? k.h('span', { class: 'learning-ribbon', title: k.t('Home-language bridge support', 'വീട്ടുഭാഷാ പാലം') }, '🌉') : null,
    k.h('div', { class: 'learning-ti' }, l.icon || s.icon),
    k.h('div', { class: 'learning-tt' }, T(k, l)),
    k.h('div', { class: 'learning-tm' }, `${k.t(s.en, s.ml)} · ${l.class ? k.t('Class ', 'ക്ലാസ് ') + l.class : k.t('Level ', 'നില ') + l.level} · ${l.minutes || 15}′`),
    extra || null);
}

// ------------------------------------------------------------------ learner home
async function home(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const q = k.params.person_id ? `?person_id=${encodeURIComponent(k.params.person_id)}` : '';
    const d = await k.api.get('/me/today' + q);
    el.innerHTML = '';
    const first = (d.person.name || '').split(' ')[0];
    const g = d.hamlet_goal;
    el.append(k.h('div', { class: 'learning-hero' },
      k.h('h2', {}, k.t(`Hello, ${first}! 👋`, `നമസ്കാരം, ${first}! 👋`)),
      k.h('div', { class: 'learning-sub' }, d.person.grade ? k.t(`Class ${d.person.grade} · ${g.hamlet}`, `ക്ലാസ് ${d.person.grade} · ${g.hamlet_ml || g.hamlet}`) : k.t(`Literacy circle · ${g.hamlet}`, `സാക്ഷരതാ കൂട്ടം · ${g.hamlet_ml || g.hamlet}`)),
      k.h('div', { class: 'learning-hero-row' },
        k.h('span', { class: 'learning-chip' }, '🔥 ', k.t(`${d.streak.current}-day streak`, `${d.streak.current} ദിവസം തുടർച്ച`)),
        k.h('span', { class: 'learning-chip' }, '📗 ', k.t(`${d.stats.completed} lessons`, `${d.stats.completed} പാഠങ്ങൾ`)),
        k.h('span', { class: 'learning-chip' }, '🏅 ', k.t(`${d.badges.length} badges`, `${d.badges.length} ബാഡ്ജുകൾ`)),
        offlineNote(k, d)),
      k.h('div', { style: 'margin-top:12px' }, speakBtn(k, k.t(`Hello ${first}. Today you have ${d.goals.length} small goals.`, `നമസ്കാരം ${first}. ഇന്ന് ${d.goals.length} ചെറിയ ലക്ഷ്യങ്ങൾ.`), k.lang === 'ml' ? 'ml-IN' : 'en-IN', k.t('Listen', 'കേൾക്കൂ')))));

    if (d.needs_diagnostic) el.append(k.ui.card({ title: k.t('🧭 First, a quick placement check', '🧭 ആദ്യം ഒരു ചെറിയ നിലനിർണയം'), body: k.t('About 10 minutes. It finds where you are in each subject so we can plan your own path. It is not an exam!', 'ഏകദേശം 10 മിനിറ്റ്. ഓരോ വിഷയത്തിലും നിങ്ങൾ എവിടെ എന്ന് കണ്ടെത്തി സ്വന്തം പഠനപാത ഒരുക്കാൻ. ഇത് പരീക്ഷയല്ല!'), actions: k.ui.button(k.t('Start', 'തുടങ്ങാം'), () => k.go('#/m/learning/diagnostic'), { tone: 'primary' }), tone: 'info' }));

    const goals = k.h('div', { class: 'learning-goals' }, d.goals.map((gl) => k.h('div', { class: 'learning-goal' + (gl.done ? ' done' : ''), onclick: () => k.go(gl.kind === 'homework' ? `#/m/learning/homework?id=${gl.homework_id}` : `#/m/learning/lesson?id=${gl.lesson_id}${gl.kind === 'practice' ? '&quiz=1' : ''}`) },
      k.h('div', { class: 'learning-gi' }, gl.icon), k.h('div', { class: 'learning-gt' }, k.t(gl.en, gl.ml)), k.h('div', { class: 'learning-check' }, gl.done ? '✓' : ''))));
    const doneN = d.goals.filter((x) => x.done).length;
    const cont = d.continue;
    const left = k.h('div', { class: 'learning-stack' },
      k.ui.card({ title: k.t("Today's goals", 'ഇന്നത്തെ ലക്ഷ്യങ്ങൾ'), subtitle: k.t(`${doneN} of ${d.goals.length} done`, `${d.goals.length}-ൽ ${doneN} പൂർത്തിയായി`), body: d.goals.length ? goals : k.ui.empty(k.t('All caught up! 🎉', 'എല്ലാം കഴിഞ്ഞു! 🎉')) }),
      cont ? k.ui.card({ title: k.t('Continue learning', 'പഠനം തുടരാം'), body: k.h('div', { class: 'learning-row' }, k.h('div', { style: 'font-size:2.2rem' }, cont.icon), k.h('div', { style: 'flex:1' }, k.h('b', {}, T(k, cont)), k.h('div', { class: 'learning-muted' }, cont.scert || '')), cont.progress ? ring(k, cont.progress.best_score) : null), actions: k.ui.button(k.t('▶ Open lesson', '▶ പാഠം തുറക്കൂ'), () => k.go(`#/m/learning/lesson?id=${cont.id}`), { tone: 'primary' }) }) : null);

    const pct = g.target ? Math.min(1, g.done / g.target) : 0;
    const right = k.h('div', { class: 'learning-stack' },
      k.ui.card({ title: k.t(`🤝 ${g.hamlet} together`, `🤝 ${g.hamlet_ml || g.hamlet} ഒരുമിച്ച്`), subtitle: T(k, g), body: [meter(k, pct), k.h('div', { class: 'learning-row', style: 'justify-content:space-between;margin-top:6px' }, k.h('b', {}, `${g.done} / ${g.target}`), k.h('span', { class: 'learning-muted' }, g.reached ? k.t('Goal reached! Everyone gets a star ⭐', 'ലക്ഷ്യം നേടി! എല്ലാവർക്കും നക്ഷത്രം ⭐') : k.t(`${g.target - g.done} more lessons for the hamlet`, `ഊരിന് ഇനി ${g.target - g.done} പാഠങ്ങൾ`)))] }),
      k.ui.card({ title: k.t('Streak', 'തുടർച്ച'), body: k.h('div', { class: 'learning-row' }, k.h('div', { class: 'learning-flame' }, d.streak.current ? '🔥' : '🌙'), k.h('div', {}, k.h('b', { style: 'font-size:1.3rem' }, k.t(`${d.streak.current} days`, `${d.streak.current} ദിവസം`)), k.h('div', { class: 'learning-muted' }, d.streak.active_today ? k.t('You learned today ✓', 'ഇന്ന് പഠിച്ചു ✓') : k.t('Do one lesson today to keep it going', 'തുടരാൻ ഇന്ന് ഒരു പാഠം ചെയ്യൂ')), k.h('div', { class: 'learning-streakdays' }, Array.from({ length: 7 }, (_, i) => { const dd = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10); return k.h('i', { class: d.streak.days.includes(dd) ? 'on' : '', title: dd }); })))) }));
    el.append(k.h('div', { class: 'learning-cols', style: 'margin-top:14px' }, left, right));

    if (d.path.length) el.append(k.ui.section(k.t('My learning path', 'എന്റെ പഠനപാത'), [d.diagnostic ? k.h('div', { class: 'learning-row', style: 'margin-bottom:8px' }, k.ui.badge(k.t(...COHORT[d.diagnostic.cohort].slice(0, 2)), COHORT[d.diagnostic.cohort][2]), k.h('span', { class: 'learning-muted' }, k.t('From your placement check on ', 'നിലനിർണയം: ') + fmtDate(k, d.diagnostic.at)), k.ui.button(k.t('Re-check', 'വീണ്ടും പരിശോധിക്കാം'), () => k.go('#/m/learning/diagnostic'), { tone: 'ghost', small: true })) : null, k.h('div', { class: 'learning-tiles' }, d.path.map((l) => lessonTile(k, l, d.subjects)))]));

    const owned = new Set(d.badges.map((b) => b.key));
    el.append(k.ui.section(k.t('My badges', 'എന്റെ ബാഡ്ജുകൾ'), k.h('div', { class: 'learning-badges' }, Object.entries(d.all_badges).map(([key, b]) => k.h('div', { class: 'learning-badge' + (owned.has(key) ? '' : ' locked'), title: k.t(b.hint, b.hint_ml) }, k.h('div', { class: 'learning-bi' }, b.icon), k.h('div', {}, k.t(b.en, b.ml)))))));

    if (d.literacy) el.append(k.ui.section(k.t('My literacy level', 'എന്റെ സാക്ഷരതാ നില'), literacyLadder(k, d.literacy.level, d.literacy_levels)));
    const bottom = [];
    if (d.passport.length) bottom.push(k.ui.card({ title: k.t('🎓 In my Learning Passport', '🎓 എന്റെ പഠന പാസ്‌പോർട്ടിൽ'), body: k.h('div', {}, d.passport.map((p) => k.h('span', { class: 'learning-pill' }, '✔ ' + p.title))) }));
    if (d.camps.length) bottom.push(k.ui.card({ title: k.t('🏕️ Coming up', '🏕️ വരാനിരിക്കുന്നത്'), body: d.camps.map((c) => k.h('div', { style: 'margin-bottom:6px' }, k.h('b', {}, T(k, c)), k.h('div', { class: 'learning-muted' }, `${fmtDate(k, c.start_date)} – ${fmtDate(k, c.end_date)}`))) }));
    if (d.enrolments.length) bottom.push(k.ui.card({ title: k.t('My classes', 'എന്റെ ക്ലാസുകൾ'), body: d.enrolments.map((e) => k.h('div', { style: 'margin-bottom:6px' }, k.h('b', {}, T(k, e)), k.h('div', { class: 'learning-muted' }, `${e.agency || ''} · ${(e.schedule || []).join(', ')}`))) }));
    if (bottom.length) el.append(k.h('div', { class: 'learning-cols', style: 'margin-top:14px' }, bottom));
    el.append(k.h('div', { class: 'learning-row', style: 'margin-top:14px' }, k.ui.button(k.t('📖 All lessons', '📖 എല്ലാ പാഠങ്ങളും'), () => k.go('#/m/learning/library'), { tone: 'ghost' }), k.ui.button(k.t('📊 My progress', '📊 എന്റെ പുരോഗതി'), () => k.go('#/m/learning/progress'), { tone: 'ghost' }), k.ui.button(k.t('📝 Homework', '📝 ഗൃഹപാഠം'), () => k.go('#/m/learning/homework'), { tone: 'ghost' })));
  });
}

function literacyLadder(k, level, levels) {
  const ls = levels && levels.length ? levels : [{ level: 1, icon: '🔤', title: 'Letters', title_ml: 'അക്ഷരങ്ങൾ' }, { level: 2, icon: '🧺', title: 'Words', title_ml: 'വാക്കുകൾ' }, { level: 3, icon: '💬', title: 'Sentences', title_ml: 'വാക്യങ്ങൾ' }, { level: 4, icon: '📋', title: 'Notices & forms', title_ml: 'അറിയിപ്പുകൾ' }];
  return k.h('div', { class: 'learning-levels' }, ls.map((l) => k.h('span', { class: level >= l.level ? 'on' : '', title: T(k, l, 'goal') }, l.icon, k.h('br'), T(k, l))), k.h('span', { class: level >= 5 ? 'on' : '' }, '🎓', k.h('br'), k.t('Independent', 'സ്വതന്ത്ര വായന')));
}

// ------------------------------------------------------------------ lesson player + practice quiz
async function lesson(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const l = await k.api.get('/content/lessons/' + encodeURIComponent(k.params.id || ''));
    el.innerHTML = '';
    const isLearner = k.user.role === 'learner';
    let iconMode = getIconMode(k);
    const wrap = k.h('div', { class: 'learning-player' + (iconMode ? ' learning-iconmode' : '') });
    el.append(wrap);
    const s = l.subject_info || subjInfo(null, l.subject);
    const mlText = l.audio_ml || l.body_ml;
    const enText = l.audio_en || l.body;
    const toggle = k.h('button', { class: 'btn ghost', onclick: () => { iconMode = !iconMode; setIconMode(iconMode); wrap.classList.toggle('learning-iconmode', iconMode); toggle.textContent = iconMode ? k.t('🔤 Show text', '🔤 എഴുത്ത് കാണിക്കുക') : k.t('👁️ Picture mode', '👁️ ചിത്ര മോഡ്'); } }, iconMode ? k.t('🔤 Show text', '🔤 എഴുത്ത് കാണിക്കുക') : k.t('👁️ Picture mode', '👁️ ചിത്ര മോഡ്'));
    wrap.append(
      k.h('div', { class: 'learning-row', style: 'justify-content:space-between;margin-bottom:10px' }, k.ui.button(k.t('← Back', '← തിരികെ'), () => history.back(), { tone: 'ghost', small: true }), toggle),
      k.h('div', { class: 'learning-lessonhead' }, k.h('div', { class: 'learning-big' }, l.icon || s.icon), k.h('div', {}, k.h('h2', { style: 'margin:0' }, T(k, l)), k.h('div', { class: 'learning-muted' }, `${k.t(s.en, s.ml)} · ${l.class ? k.t('Class ', 'ക്ലാസ് ') + l.class : k.t('Literacy level ', 'സാക്ഷരതാ നില ') + l.level} · ${l.scert || ''}`), l.my_progress ? k.h('div', { style: 'margin-top:4px' }, k.ui.badge(l.my_progress.status === 'mastered' ? k.t('Mastered ⭐', 'പൂർണ്ണമായി പഠിച്ചു ⭐') : l.my_progress.status === 'completed' ? k.t('Completed ✓', 'പൂർത്തിയായി ✓') : k.t('In progress', 'പുരോഗമിക്കുന്നു'), l.my_progress.status === 'in_progress' ? 'warn' : 'good')) : null)),
      k.h('div', { class: 'learning-row', style: 'margin:14px 0' }, speakBtn(k, mlText, 'ml-IN', k.t('Read aloud (Malayalam)', 'ഉറക്കെ വായിക്കൂ (മലയാളം)')), speakBtn(k, enText, 'en-IN', k.t('Read aloud (English)', 'ഉറക്കെ വായിക്കൂ (ഇംഗ്ലീഷ്)'), true)),
      k.h('div', { class: 'learning-hidetext learning-stack' },
        l.body_ml ? k.h('div', { class: 'learning-body ml' }, l.body_ml) : null,
        l.body && (k.lang === 'en' || !l.body_ml || l.subject === 'english') ? k.h('div', { class: 'learning-body' }, l.body) : null));
    if (l.bridge && !isLearner) wrap.append(k.h('div', { class: 'learning-bridge', style: 'margin-top:12px' }, k.h('b', {}, '🌉 ', k.t('Home-language bridge', 'വീട്ടുഭാഷാ പാലം'), ` (${(l.bridge.languages || []).join(', ')})`), k.h('div', {}, T(k, l.bridge, 'note'))));
    if (l.bridge && isLearner) wrap.append(k.h('div', { class: 'learning-bridge', style: 'margin-top:12px' }, k.t('🌉 You can say it first in your home language — that is good learning!', '🌉 ആദ്യം നിങ്ങളുടെ വീട്ടുഭാഷയിൽ പറഞ്ഞോളൂ — അതും നല്ല പഠനമാണ്!')));
    if (l.activity) wrap.append(k.ui.card({ title: k.t('Facilitator activity', 'ഫെസിലിറ്റേറ്റർ പ്രവർത്തനം'), body: T(k, l, 'activity') }));
    const quizHost = k.h('div', { style: 'margin-top:16px' });
    wrap.append(quizHost);
    const start = () => renderQuiz(k, quizHost, l);
    if (k.params.quiz === '1') start();
    else quizHost.append(k.h('div', { class: 'learning-row', style: 'justify-content:center' }, k.ui.button(k.t(`🎯 Practise (${l.questions.length} questions)`, `🎯 പരിശീലിക്കാം (${l.questions.length} ചോദ്യങ്ങൾ)`), start, { tone: 'primary' })));
    wrap.append(k.h('div', { class: 'learning-row', style: 'justify-content:space-between;margin-top:18px' }, l.prev_id ? k.ui.button(k.t('← Previous lesson', '← മുൻപാഠം'), () => k.go(`#/m/learning/lesson?id=${l.prev_id}`), { tone: 'ghost', small: true }) : k.h('span'), l.next_id ? k.ui.button(k.t('Next lesson →', 'അടുത്ത പാഠം →'), () => k.go(`#/m/learning/lesson?id=${l.next_id}`), { tone: 'ghost', small: true }) : null));
  });
}

function renderQuiz(k, host, l) {
  host.innerHTML = '';
  const answers = new Array(l.questions.length).fill(null);
  let checked = false;
  const canSubmit = k.user.role === 'learner';
  const blocks = l.questions.map((q, qi) => {
    const opts = q.o.map((o, oi) => k.h('button', { class: 'learning-opt', onclick: () => { if (checked) return; answers[qi] = oi; opts.forEach((b, j) => b.classList.toggle('sel', j === oi)); } }, q.o_ml && k.lang === 'ml' ? q.o_ml[oi] : o));
    const qText = k.lang === 'ml' && q.q_ml ? q.q_ml : q.q;
    const xBox = k.h('div', { class: 'learning-x', style: 'display:none' });
    const b = k.h('div', { class: 'learning-q' }, k.h('div', { class: 'learning-qt' }, k.h('span', {}, `${qi + 1}.`), k.h('span', { style: 'flex:1' }, qText), speakBtn(k, (q.q_ml || q.q) + '. ' + (q.o_ml || q.o).join(', '), q.q_ml ? 'ml-IN' : 'en-IN', '')), k.h('div', { class: 'learning-opts' }, opts), xBox);
    b._opts = opts; b._x = xBox; return b;
  });
  const btn = k.ui.button(k.t('✅ Check my answers', '✅ ഉത്തരം പരിശോധിക്കൂ'), async () => {
    if (answers.some((a) => a === null) && !(await k.ui.confirm(k.t('Some questions are not answered. Check anyway?', 'ചില ചോദ്യങ്ങൾക്ക് ഉത്തരമില്ല. എന്നാലും പരിശോധിക്കണോ?')))) return;
    checked = true;
    let correct = 0;
    l.questions.forEach((q, qi) => {
      const ok = answers[qi] === q.a; if (ok) correct++;
      blocks[qi]._opts.forEach((b, j) => { b.classList.remove('sel'); if (j === q.a) b.classList.add('right'); else if (j === answers[qi]) b.classList.add('wrong'); });
      blocks[qi]._x.style.display = ''; blocks[qi]._x.className = 'learning-x' + (ok ? '' : ' bad');
      blocks[qi]._x.textContent = (ok ? '✓ ' : '✗ ') + (k.lang === 'ml' && q.x_ml ? q.x_ml : q.x || '');
    });
    const score = correct / l.questions.length;
    btn.remove();
    const res = k.h('div', { class: 'learning-result' }, k.h('div', { class: 'learning-score' }, `${correct}/${l.questions.length}`), k.h('div', { style: 'font-size:1.2rem;margin:6px 0' }, score >= 0.8 ? k.t('Excellent! ⭐ Mastered', 'മികച്ചത്! ⭐') : score >= 0.6 ? k.t('Good — lesson completed ✓', 'നന്നായി — പാഠം പൂർത്തിയായി ✓') : k.t('Keep going — read once more and try again 💪', 'തുടരൂ — ഒന്നുകൂടി വായിച്ച് ശ്രമിക്കൂ 💪')));
    host.append(res);
    if (score >= 0.8) k.speak(k.t('Excellent!', 'മികച്ചത്!'), k.lang === 'ml' ? 'ml-IN' : 'en-IN');
    if (canSubmit) {
      try {
        const r = await k.api.post(`/lessons/${encodeURIComponent(l.id)}/attempt`, { answers });
        if (r && r.queued) res.append(k.h('div', { class: 'learning-muted' }, k.t('Saved on this device — will sync when online.', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു — ഓൺലൈൻ ആകുമ്പോൾ അയയ്ക്കും.')));
        else if (r) {
          if (r.awarded && r.awarded.length) { res.append(k.h('div', { style: 'margin-top:8px' }, k.h('b', {}, k.t('🎓 Added to your Learning Passport:', '🎓 പഠന പാസ്‌പോർട്ടിൽ ചേർത്തു:')), r.awarded.map((a) => k.h('div', {}, '✔ ' + k.t(a.title, a.title_ml || a.title))))); k.toast(k.t('New passport competency!', 'പുതിയ പാസ്‌പോർട്ട് നേട്ടം!'), 'good'); }
          res.append(k.h('div', { class: 'learning-muted', style: 'margin-top:6px' }, `🔥 ${k.t('Streak', 'തുടർച്ച')}: ${r.streak.current} · 🤝 ${r.hamlet_goal.hamlet}: ${r.hamlet_goal.done}/${r.hamlet_goal.target}`));
        }
      } catch (e) { k.toast(e.message, 'bad'); }
    }
    res.append(k.h('div', { class: 'learning-row', style: 'justify-content:center;margin-top:10px' }, k.ui.button(k.t('Try again', 'വീണ്ടും ശ്രമിക്കൂ'), () => renderQuiz(k, host, l), { tone: 'ghost' }), canSubmit ? k.ui.button(k.t('Home', 'ഹോം'), () => k.go('#/m/learning/home'), { tone: 'primary' }) : null));
  }, { tone: 'primary' });
  host.append(k.h('h3', {}, k.t('Practice', 'പരിശീലനം')), ...blocks, k.h('div', { class: 'learning-row', style: 'justify-content:center' }, btn));
}

// ------------------------------------------------------------------ diagnostic
async function diagnostic(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const q = k.params.person_id ? `?person_id=${encodeURIComponent(k.params.person_id)}` : '';
    const d = await k.api.get('/diagnostic' + q);
    el.innerHTML = '';
    const answers = {};
    let i = 0;
    const host = k.h('div', { class: 'learning-player' });
    el.append(k.h('div', { class: 'learning-hero' }, k.h('h2', {}, k.t('🧭 Placement check', '🧭 നിലനിർണയം')), k.h('div', { class: 'learning-sub' }, k.t(`${d.person.name} · Class ${d.grade} · ${d.questions.length} questions — no marks, just finding your starting point.`, `${d.person.name} · ക്ലാസ് ${d.grade} · ${d.questions.length} ചോദ്യങ്ങൾ — മാർക്കില്ല, തുടക്കസ്ഥാനം കണ്ടെത്താൻ മാത്രം.`))), k.h('div', { style: 'height:12px' }), host);
    const draw = () => {
      host.innerHTML = '';
      const qq = d.questions[i];
      const s = subjInfo(d.subjects, qq.subject);
      const opts = qq.o.map((o, oi) => k.h('button', { class: 'learning-opt' + (answers[qq.id] === oi ? ' sel' : ''), onclick: () => { answers[qq.id] = oi; if (i < d.questions.length - 1) { i++; draw(); } else draw(); } }, qq.o_ml && k.lang === 'ml' ? qq.o_ml[oi] : o));
      host.append(meter(k, (i + 1) / d.questions.length), k.h('div', { class: 'learning-muted', style: 'margin:6px 0 10px' }, `${i + 1} / ${d.questions.length} · ${s.icon} ${k.t(s.en, s.ml)}`),
        k.h('div', { class: 'learning-q' }, k.h('div', { class: 'learning-qt' }, k.h('span', { style: 'font-size:1.6rem' }, qq.icon), k.h('span', { style: 'flex:1' }, k.lang === 'ml' && qq.q_ml ? qq.q_ml : qq.q), speakBtn(k, qq.q_ml || qq.q, qq.q_ml ? 'ml-IN' : 'en-IN', '')), k.h('div', { class: 'learning-opts' }, opts)),
        k.h('div', { class: 'learning-row', style: 'justify-content:space-between' }, k.ui.button(k.t('← Back', '← പിന്നോട്ട്'), () => { if (i > 0) { i--; draw(); } }, { tone: 'ghost', small: true }), k.ui.button(k.t("Skip — I don't know yet", 'ഒഴിവാക്കൂ — ഇപ്പോൾ അറിയില്ല'), () => { answers[qq.id] = -1; if (i < d.questions.length - 1) { i++; draw(); } }, { tone: 'ghost', small: true }), i === d.questions.length - 1 || Object.keys(answers).length === d.questions.length ? k.ui.button(k.t('Finish ✓', 'പൂർത്തിയാക്കൂ ✓'), submit, { tone: 'primary' }) : k.ui.button(k.t('Next →', 'അടുത്തത് →'), () => { i++; draw(); }, { small: true })));
    };
    const submit = async () => {
      try {
        const r = await k.api.post('/diagnostic', { answers, person_id: k.params.person_id });
        if (r.queued) { k.toast(k.t('Saved offline — results when online.', 'ഓഫ്‌ലൈനായി സൂക്ഷിച്ചു.'), 'info'); return; }
        host.innerHTML = '';
        const c = COHORT[r.cohort];
        host.append(k.h('div', { class: 'learning-result' }, k.h('div', { style: 'font-size:2.4rem' }, '🧭'), k.h('h3', {}, k.t('Your starting points', 'നിങ്ങളുടെ തുടക്കസ്ഥാനങ്ങൾ')), k.ui.badge(k.t(c[0], c[1]), c[2])),
          k.ui.table([{ key: 's', label: k.t('Subject', 'വിഷയം'), render: (x) => `${subjInfo(d.subjects, x.s).icon} ${k.t(subjInfo(d.subjects, x.s).en, subjInfo(d.subjects, x.s).ml)}` }, { key: 'p', label: k.t('Working at', 'നിലവിലെ നില'), render: (x) => x.placement ? k.t('Class ', 'ക്ലാസ് ') + x.placement : k.t('Foundation', 'അടിസ്ഥാനം') }, { key: 'g', label: k.t('Gap', 'വിടവ്'), render: (x) => x.gap ? k.ui.badge(`−${x.gap}`, x.gap >= 2 ? 'bad' : 'warn') : k.ui.badge('✓', 'good') }], Object.entries(r.results).map(([s, x]) => ({ s, ...x }))),
          k.ui.section(k.t('Your path — first steps', 'നിങ്ങളുടെ പാത — ആദ്യ ചുവടുകൾ'), k.h('div', { class: 'learning-tiles' }, (r.path_lessons || []).slice(0, 8).map((l) => lessonTile(k, l, d.subjects)))),
          k.h('div', { class: 'learning-row', style: 'justify-content:center;margin-top:12px' }, k.ui.button(k.t('Go to My Learning', 'എന്റെ പഠനത്തിലേക്ക്'), () => k.go(k.user.role === 'learner' ? '#/m/learning/home' : `#/m/learning/learner?id=${d.person.id}`), { tone: 'primary' })));
      } catch (e) { k.toast(e.message, 'bad'); }
    };
    draw();
  });
}

// ------------------------------------------------------------------ progress (learner / guardian / staff)
function progressView(k, d, { staff = false } = {}) {
  const box = k.h('div', { class: 'learning-stack' });
  const subs = Object.entries(d.bySubject).map(([s, v]) => k.h('div', { class: 'learning-subj' }, k.h('div', { style: 'font-size:1.5rem;width:34px;text-align:center' }, v.icon), k.h('div', { class: 'learning-sn' }, k.h('b', {}, k.t(v.en, v.ml)), k.h('div', { class: 'learning-muted' }, k.t(`${v.completed} of ${v.total} lessons · ${v.mastered} mastered`, `${v.total}-ൽ ${v.completed} പാഠം · ${v.mastered} പൂർണ്ണം`)), meter(k, v.total ? v.completed / v.total : 0)), ring(k, v.avg, v.colour)));
  const att = d.attendance.last30;
  box.append(k.ui.grid([
    k.ui.stat(k.t('Lessons done', 'പൂർത്തിയാക്കിയ പാഠങ്ങൾ'), Object.values(d.bySubject).reduce((a, v) => a + v.completed, 0)),
    k.ui.stat(k.t('Attendance (30 days)', 'ഹാജർ (30 ദിവസം)'), att ? pctTxt(att.rate) : '—', att ? k.t(`${att.present} of ${att.total} classes`, `${att.total}-ൽ ${att.present} ക്ലാസ്`) : ''),
    k.ui.stat(k.t('Streak', 'തുടർച്ച'), `🔥 ${d.streak.current}`),
    k.ui.stat(k.t('Passport skills', 'പാസ്‌പോർട്ട് കഴിവുകൾ'), d.passport.length),
  ], 150));
  box.append(k.h('div', { class: 'learning-cols' },
    k.ui.card({ title: k.t('By subject', 'വിഷയം തിരിച്ച്'), body: k.h('div', { class: 'learning-stack', style: 'gap:8px' }, subs) }),
    k.ui.card({ title: k.t('Weekly activity (12 weeks)', 'ആഴ്ചതോറുമുള്ള പഠനം (12 ആഴ്ച)'), body: [k.h('div', { class: 'learning-hbar' }, d.weekly.map((n) => k.h('i', { style: `height:${Math.min(100, n * 14)}%`, title: String(n) }))), d.badges.length ? k.h('div', { class: 'learning-badges', style: 'margin-top:12px' }, d.badges.map((b) => k.h('div', { class: 'learning-badge', title: k.t(b.hint, b.hint_ml) }, k.h('div', { class: 'learning-bi' }, b.icon), k.h('div', {}, k.t(b.en, b.ml))))) : null] })));
  if (d.diagnostics.length) {
    const first = d.diagnostics[0], last = d.diagnostics[d.diagnostics.length - 1];
    const rows = Object.keys(first.results || {}).map((s) => ({ s, a: first.results[s], b: last.results[s] }));
    box.append(k.ui.card({ title: k.t('Placement checks', 'നിലനിർണയങ്ങൾ'), subtitle: d.diagnostics.length > 1 ? k.t(`First ${fmtDate(k, first.at)} → latest ${fmtDate(k, last.at)}`, `ആദ്യം ${fmtDate(k, first.at)} → ഏറ്റവും പുതിയത് ${fmtDate(k, last.at)}`) : fmtDate(k, first.at), body: [k.ui.badge(k.t(...COHORT[last.cohort].slice(0, 2)), COHORT[last.cohort][2]), k.ui.table([{ key: 's', label: k.t('Subject', 'വിഷയം'), render: (r) => k.t(subjInfo(d.subjects, r.s).en, subjInfo(d.subjects, r.s).ml) }, { key: 'a', label: k.t('First', 'ആദ്യം'), render: (r) => r.a ? (r.a.placement ? k.t('Class ', 'ക്ലാസ് ') + r.a.placement : k.t('Foundation', 'അടിസ്ഥാനം')) : '—' }, { key: 'b', label: k.t('Latest', 'പുതിയത്'), render: (r) => r.b ? (r.b.placement ? k.t('Class ', 'ക്ലാസ് ') + r.b.placement : k.t('Foundation', 'അടിസ്ഥാനം')) : '—' }, { key: 'g', label: k.t('Gap now', 'ഇപ്പോഴത്തെ വിടവ്'), render: (r) => r.b ? (r.b.gap ? k.ui.badge(`−${r.b.gap}`, r.b.gap >= 2 ? 'bad' : 'warn') : k.ui.badge('✓', 'good')) : '—' }], rows)] }));
  }
  if (d.literacy) box.append(k.ui.card({ title: k.t('Literacy level', 'സാക്ഷരതാ നില'), body: [literacyLadder(k, d.literacy.level), d.literacy.notes ? k.h('p', { class: 'learning-muted' }, d.literacy.notes) : null] }));
  box.append(k.ui.card({ title: k.t('Recent practice', 'സമീപകാല പരിശീലനം'), body: k.ui.table([{ key: 'at', label: k.t('Date', 'തീയതി'), render: (r) => fmtDate(k, r.at) }, { key: 'title', label: k.t('Lesson', 'പാഠം'), render: (r) => k.t(r.title || r.lesson_id, r.title_ml || r.title || r.lesson_id) }, { key: 'score', label: k.t('Score', 'സ്കോർ'), render: (r) => k.ui.badge(pctTxt(r.score), r.score >= 0.8 ? 'good' : r.score >= 0.6 ? 'info' : 'warn') }], d.attempts.slice(0, 10), { empty: k.t('No practice yet', 'ഇതുവരെ പരിശീലനമില്ല') }) }));
  if (d.passport.length) box.append(k.ui.card({ title: k.t('🎓 Learning Passport — competencies', '🎓 പഠന പാസ്‌പോർട്ട് — കഴിവുകൾ'), body: d.passport.map((p) => k.h('span', { class: 'learning-pill' }, `✔ ${p.title} · ${fmtDate(k, p.issued_at)}`)) }));
  if (d.submissions.length) box.append(k.ui.card({ title: k.t('Homework', 'ഗൃഹപാഠം'), body: k.ui.table([{ key: 'hw', label: k.t('Task', 'ജോലി'), render: (r) => k.t(r.hw_title, r.hw_title_ml || r.hw_title) }, { key: 'sub', label: k.t('Submitted', 'സമർപ്പിച്ചത്'), render: (r) => fmtDate(k, r.submitted_at) }, { key: 'fb', label: k.t('Teacher feedback', 'ടീച്ചറുടെ പ്രതികരണം'), render: (r) => r.feedback ? `${r.grade ? '⭐'.repeat(r.grade) + ' ' : ''}${r.feedback}` : k.ui.badge(k.t('Waiting', 'കാത്തിരിക്കുന്നു'), 'info') }], d.submissions) }));
  if (staff) {
    if (d.attendance.recent.length) box.append(k.ui.card({ title: k.t('Attendance log (your agency)', 'ഹാജർ രേഖ'), body: k.h('div', {}, d.attendance.recent.slice(0, 30).map((a) => k.h('span', { class: 'learning-pill', title: a.topic || '', style: `background:${a.status === 'absent' ? '#fee2e2' : a.status === 'late' ? '#fef9c3' : a.status === 'excused' ? '#e2e8f0' : '#dcfce7'};color:#111` }, `${fmtDate(k, a.date)} ${a.status[0].toUpperCase()}`))) }));
    if (d.flags.length) box.append(k.ui.card({ title: k.t('Flags', 'മുന്നറിയിപ്പുകൾ'), body: k.ui.table([{ key: 'r', label: k.t('Reason', 'കാരണം'), render: (f) => k.t(...(REASONS[f.reason] || [f.reason, f.reason])) }, { key: 'n', label: k.t('Note', 'കുറിപ്പ്'), render: (f) => f.note || '' }, { key: 's', label: k.t('Status', 'നില'), render: (f) => k.ui.badge(f.status, f.status === 'open' ? 'warn' : 'good') }], d.flags) }));
  }
  return box;
}

async function progress(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const d = await k.api.get('/me/progress');
    el.innerHTML = '';
    el.append(k.h('h2', {}, k.t('📊 My progress', '📊 എന്റെ പുരോഗതി')), progressView(k, d));
  });
}

// ------------------------------------------------------------------ guardian
async function child(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const kids = await k.api.get('/children');
    el.innerHTML = '';
    el.append(k.h('h2', {}, k.t("👪 My children's learning", '👪 എന്റെ കുട്ടികളുടെ പഠനം')), k.h('p', { class: 'learning-muted' }, k.t('Read-only view. You can change what each agency sees under Consent.', 'കാണാൻ മാത്രം. ഓരോ ഏജൻസിയും എന്ത് കാണണമെന്ന് സമ്മതപത്രത്തിൽ മാറ്റാം.')));
    if (!kids.length) { el.append(k.ui.empty(k.t('No children linked to your account.', 'നിങ്ങളുടെ അക്കൗണ്ടിൽ കുട്ടികളില്ല.'))); return; }
    const sel = k.params.id || kids[0].id;
    el.append(k.h('div', { class: 'learning-row', style: 'margin-bottom:12px' }, kids.map((c) => k.ui.button(`${c.gender === 'F' ? '👧' : '👦'} ${c.name.split(' ')[0]}`, () => k.go(`#/m/learning/child?id=${c.id}`), { tone: c.id === sel ? 'primary' : 'ghost', small: true }))));
    const c = kids.find((x) => x.id === sel) || kids[0];
    const box = k.h('div');
    el.append(k.ui.card({ title: c.name, subtitle: c.grade ? k.t(`Class ${c.school_class}`, `ക്ലാസ് ${c.school_class}`) : '', body: k.h('div', { class: 'learning-row' }, k.ui.badge(k.t(`📗 ${c.completed} lessons`, `📗 ${c.completed} പാഠങ്ങൾ`), 'info'), k.ui.badge(`🔥 ${c.streak}`, 'warn'), c.attendance ? k.ui.badge(k.t(`Attendance ${pctTxt(c.attendance.rate)}`, `ഹാജർ ${pctTxt(c.attendance.rate)}`), c.attendance.rate >= 0.75 ? 'good' : 'warn') : null, speakBtn(k, k.t(`${c.name.split(' ')[0]} has completed ${c.completed} lessons.${c.attendance ? ' Attendance is ' + Math.round(c.attendance.rate * 100) + ' percent.' : ''}`, `${c.name.split(' ')[0]} ${c.completed} പാഠങ്ങൾ പൂർത്തിയാക്കി.${c.attendance ? ' ഹാജർ ' + Math.round(c.attendance.rate * 100) + ' ശതമാനം.' : ''}`), k.lang === 'ml' ? 'ml-IN' : 'en-IN', k.t('Listen', 'കേൾക്കൂ'))) }), box);
    try { const d = await k.api.get('/learners/' + c.id); box.append(progressView(k, d)); } catch (e) { box.append(k.ui.error(e)); }
  });
}

// ------------------------------------------------------------------ homework (learner + staff)
async function homework(el, k) {
  setup(k);
  const staff = ['facilitator', 'teacher', 'agency_admin', 'platform_admin'].includes(k.user.role);
  await guarded(k, el, async () => {
    if (k.params.id) return staff ? hwReview(el, k, k.params.id) : hwSubmit(el, k, k.params.id);
    const list = await k.api.get('/homework');
    el.innerHTML = '';
    if (!staff) {
      el.append(k.h('h2', {}, k.t('📝 My homework', '📝 എന്റെ ഗൃഹപാഠം')));
      if (!list.length) { el.append(k.ui.empty(k.t('No homework right now 🎉', 'ഇപ്പോൾ ഗൃഹപാഠമില്ല 🎉'))); return; }
      el.append(k.h('div', { class: 'learning-stack' }, list.map((h) => k.h('div', { class: 'learning-goal' + (h.submission ? ' done' : ''), onclick: () => k.go(`#/m/learning/homework?id=${h.id}`) }, k.h('div', { class: 'learning-gi' }, h.submission ? (h.submission.feedback ? '💬' : '📤') : '📝'), k.h('div', { class: 'learning-gt' }, T(k, h), k.h('small', {}, h.submission ? (h.submission.feedback ? k.t('Teacher replied: ', 'ടീച്ചർ: ') + h.submission.feedback : k.t('Submitted — waiting for teacher', 'സമർപ്പിച്ചു — ടീച്ചർക്കായി കാത്തിരിക്കുന്നു')) : k.t('Due ', 'അവസാന തീയതി ') + fmtDate(k, h.due_date))), k.h('div', { class: 'learning-check' }, h.submission ? '✓' : '')))));
      return;
    }
    el.append(k.h('div', { class: 'learning-row', style: 'justify-content:space-between' }, k.h('h2', {}, k.t('📝 Homework', '📝 ഗൃഹപാഠം')), k.ui.button(k.t('+ Assign homework', '+ ഗൃഹപാഠം നൽകുക'), () => assignHomework(k), { tone: 'primary' })));
    el.append(k.ui.table([
      { key: 'title', label: k.t('Task', 'ജോലി'), render: (h) => k.h('div', {}, k.h('b', {}, h.title), k.h('div', { class: 'learning-muted' }, `${h.programme} · ${h.hamlet}`)) },
      { key: 'due', label: k.t('Due', 'തീയതി'), render: (h) => fmtDate(k, h.due_date) },
      { key: 'sub', label: k.t('Submitted', 'സമർപ്പിച്ചവർ'), render: (h) => `${h.submitted}/${h.roster}` },
      { key: 'rev', label: k.t('To review', 'പരിശോധിക്കാൻ'), render: (h) => h.to_review ? k.ui.badge(String(h.to_review), 'warn') : k.ui.badge('✓', 'good') },
    ], list, { empty: k.t('No homework assigned yet', 'ഗൃഹപാഠം നൽകിയിട്ടില്ല'), onRow: (h) => k.go(`#/m/learning/homework?id=${h.id}`) }));
  });
}

async function assignHomework(k, preset = {}) {
  const progs = await k.api.get('/programmes');
  const lessons = await k.api.get('/content/lessons');
  const content = k.h('div');
  const m = k.ui.modal(k.t('Assign homework', 'ഗൃഹപാഠം നൽകുക'), content);
  content.append(k.ui.form([
    { name: 'programme_id', label: k.t('Class / programme', 'ക്ലാസ്'), type: 'select', required: true, value: preset.programme_id, options: progs.map((p) => ({ value: p.id, label: `${p.title} · ${p.hamlet}` })) },
    { name: 'title', label: k.t('Task (English)', 'ജോലി (ഇംഗ്ലീഷ്)'), required: true, placeholder: 'Write 5 sentences about your hamlet' },
    { name: 'title_ml', label: k.t('Task (Malayalam)', 'ജോലി (മലയാളം)'), placeholder: 'നിങ്ങളുടെ ഊരിനെക്കുറിച്ച് 5 വാക്യങ്ങൾ' },
    { name: 'lesson_id', label: k.t('Linked lesson (optional)', 'ബന്ധപ്പെട്ട പാഠം'), type: 'select', options: [{ value: '', label: '—' }, ...lessons.map((l) => ({ value: l.id, label: `${l.class ? 'C' + l.class : 'L' + l.level} · ${l.title}` }))] },
    { name: 'instructions', label: k.t('Instructions', 'നിർദ്ദേശങ്ങൾ'), type: 'textarea' },
    { name: 'due_date', label: k.t('Due date', 'അവസാന തീയതി'), type: 'date', value: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) },
  ], async (v) => { await k.api.post('/homework', v); k.toast(k.t('Homework assigned', 'ഗൃഹപാഠം നൽകി'), 'good'); m.close(); k.refresh(); }, { submitLabel: k.t('Assign', 'നൽകുക') }));
}

function fileToDataUrl(file, maxDim = 480) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read file'));
    fr.onload = () => {
      if (!file.type.startsWith('image/')) return resolve(fr.result);
      const img = new Image();
      img.onload = () => { const sc = Math.min(1, maxDim / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.7)); };
      img.onerror = () => reject(new Error('Not an image'));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function hwSubmit(el, k, id) {
  const h = await k.api.get('/homework/' + encodeURIComponent(id));
  el.innerHTML = '';
  el.append(k.ui.button(k.t('← Homework', '← ഗൃഹപാഠം'), () => k.go('#/m/learning/homework'), { tone: 'ghost', small: true }));
  el.append(k.h('div', { class: 'learning-hero', style: 'margin-top:10px' }, k.h('h2', {}, '📝 ', T(k, h)), k.h('div', { class: 'learning-sub' }, h.instructions || ''), k.h('div', { class: 'learning-hero-row' }, k.h('span', { class: 'learning-chip' }, '📅 ', k.t('Due ', 'അവസാന തീയതി ') + fmtDate(k, h.due_date)), speakBtn(k, (h.title_ml || h.title) + '. ' + (h.instructions || ''), h.title_ml ? 'ml-IN' : 'en-IN', k.t('Listen', 'കേൾക്കൂ')))));
  if (h.lesson) el.append(k.h('div', { style: 'margin-top:10px' }, lessonTile(k, h.lesson, null)));
  const s = h.submission;
  if (s) {
    el.append(k.ui.card({ title: k.t('Your answer', 'നിങ്ങളുടെ ഉത്തരം'), subtitle: fmtDate(k, s.submitted_at), body: [s.text ? k.h('div', { class: 'learning-body' }, s.text) : null, s.media_note ? k.h('div', { class: 'learning-muted' }, (s.kind === 'voice' ? '🎙️ ' : '📷 ') + s.media_note) : null] }));
    if (s.feedback) el.append(k.ui.card({ title: k.t('💬 Teacher feedback', '💬 ടീച്ചറുടെ പ്രതികരണം'), tone: 'good', body: [s.grade ? k.h('div', { style: 'font-size:1.3rem' }, '⭐'.repeat(s.grade)) : null, k.h('div', {}, s.feedback), speakBtn(k, s.feedback, 'en-IN', k.t('Listen', 'കേൾക്കൂ'))] }));
  }
  let thumb = null, kind = 'text';
  const preview = k.h('div');
  const fileIn = k.h('input', { type: 'file', accept: 'image/*,audio/*', capture: 'environment', style: 'display:none', onchange: async () => {
    const f = fileIn.files[0]; if (!f) return;
    try { thumb = await fileToDataUrl(f); if (thumb.length > 280000) { thumb = null; k.toast(k.t('File too large (max 200 KB)', 'ഫയൽ വലുതാണ് (പരമാവധി 200 KB)'), 'warn'); return; } kind = f.type.startsWith('audio/') ? 'voice' : 'photo'; preview.innerHTML = ''; preview.append(kind === 'photo' ? k.h('img', { src: thumb, class: 'learning-thumb' }) : k.h('audio', { src: thumb, controls: true })); } catch (e) { k.toast(e.message, 'bad'); }
  } });
  const ta = k.h('textarea', { rows: 5, style: 'width:100%;font-size:1.05rem;border-radius:12px;padding:10px', placeholder: k.t('Write your answer here…', 'ഉത്തരം ഇവിടെ എഴുതൂ…') }, s ? s.text || '' : '');
  const note = k.h('input', { type: 'text', style: 'width:100%;padding:8px;border-radius:10px', placeholder: k.t('Short note about your photo / voice (optional)', 'ഫോട്ടോ / ശബ്ദത്തെക്കുറിച്ച് ചെറുകുറിപ്പ്') });
  el.append(k.ui.card({ title: s ? k.t('Send again', 'വീണ്ടും അയയ്ക്കുക') : k.t('Send your homework', 'ഗൃഹപാഠം അയയ്ക്കുക'), body: k.h('div', { class: 'learning-stack' }, ta, k.h('div', { class: 'learning-row' }, k.ui.button(k.t('📷 Photo', '📷 ഫോട്ടോ'), () => { fileIn.accept = 'image/*'; fileIn.click(); }, { tone: 'ghost' }), k.ui.button(k.t('🎙️ Voice', '🎙️ ശബ്ദം'), () => { fileIn.accept = 'audio/*'; fileIn.click(); }, { tone: 'ghost' }), fileIn), preview, note),
    actions: k.ui.button(k.t('📤 Send', '📤 അയയ്ക്കൂ'), async () => {
      try { const r = await k.api.post(`/homework/${encodeURIComponent(id)}/submit`, { text: ta.value, kind: thumb ? kind : 'text', thumb, media_note: note.value }); k.toast(r.queued ? k.t('Saved — will send when online', 'സൂക്ഷിച്ചു — ഓൺലൈനാകുമ്പോൾ അയയ്ക്കും') : k.t('Sent to your teacher! 🎉', 'ടീച്ചർക്ക് അയച്ചു! 🎉'), 'good'); k.refresh(); } catch (e) { k.toast(e.message, 'bad'); }
    }, { tone: 'primary' }) }));
}

async function hwReview(el, k, id) {
  const h = await k.api.get('/homework/' + encodeURIComponent(id));
  el.innerHTML = '';
  el.append(k.ui.button(k.t('← Homework', '← ഗൃഹപാഠം'), () => k.go('#/m/learning/homework'), { tone: 'ghost', small: true }),
    k.h('h2', {}, h.title), k.h('div', { class: 'learning-muted' }, `${h.programme.title} · ${k.t('due', 'തീയതി')} ${fmtDate(k, h.due_date)}${h.hidden ? ` · ${h.hidden} ${k.t('learners hidden (no consent)', 'പഠിതാക്കൾ മറച്ചു (സമ്മതമില്ല)')}` : ''}`), h.instructions ? k.h('p', {}, h.instructions) : null);
  const sorted = [...h.learners].sort((a, b) => (!!b.submission && !b.submission.feedback) - (!!a.submission && !a.submission.feedback));
  el.append(k.h('div', { class: 'learning-stack', style: 'margin-top:12px' }, sorted.map((l) => {
    const s = l.submission;
    if (!s) return k.h('div', { class: 'learning-attrow' }, k.h('div', { class: 'learning-nm' }, k.h('b', {}, l.name), k.h('span', { class: 'learning-muted' }, k.t('Not submitted', 'സമർപ്പിച്ചിട്ടില്ല'))));
    const media = k.h('div');
    if (s.thumb) media.append(k.ui.button(s.kind === 'voice' ? k.t('▶ Play voice', '▶ ശബ്ദം കേൾക്കുക') : k.t('🖼 View photo', '🖼 ഫോട്ടോ കാണുക'), async () => { try { const m = await k.api.get(`/submissions/${s.id}/media`); media.innerHTML = ''; if (m.thumb) media.append(m.kind === 'voice' ? k.h('audio', { src: m.thumb, controls: true }) : k.h('img', { src: m.thumb, class: 'learning-thumb' })); } catch (e) { k.toast(e.message, 'bad'); } }, { tone: 'ghost', small: true }));
    const fb = s.feedback ? k.h('div', { class: 'learning-x' }, `${s.grade ? '⭐'.repeat(s.grade) + ' ' : ''}${s.feedback_kind === 'voice' ? '🎙️ ' : ''}${s.feedback}`) : k.ui.form([
      { name: 'feedback', label: k.t('Feedback', 'പ്രതികരണം'), type: 'textarea', required: true, placeholder: k.t('Well done! …', 'നന്നായി! …') },
      { name: 'grade', label: k.t('Stars (1–5)', 'നക്ഷത്രങ്ങൾ (1–5)'), type: 'select', options: ['', '1', '2', '3', '4', '5'] },
      { name: 'voice', label: k.t('Mark as voice note (recorded separately)', 'ശബ്ദസന്ദേശമായി രേഖപ്പെടുത്തുക'), type: 'checkbox' },
    ], async (v) => { await k.api.post(`/submissions/${s.id}/feedback`, { feedback: v.feedback, grade: v.grade, feedback_kind: v.voice ? 'voice' : 'text' }); k.toast(k.t('Feedback sent', 'പ്രതികരണം അയച്ചു'), 'good'); k.refresh(); }, { submitLabel: k.t('Send feedback', 'അയയ്ക്കുക') });
    return k.ui.card({ title: l.name, subtitle: `${fmtDate(k, s.submitted_at)} · ${s.kind}`, body: [s.text ? k.h('div', { class: 'learning-body', style: 'font-size:1rem' }, s.text) : null, s.media_note ? k.h('div', { class: 'learning-muted' }, s.media_note) : null, media, fb] });
  })));
}

// ------------------------------------------------------------------ facilitator console
async function console_(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const d = await k.api.get('/console');
    el.innerHTML = '';
    el.append(k.h('div', { class: 'learning-hero' }, k.h('h2', {}, k.t('🧑‍🏫 Teaching console', '🧑‍🏫 അധ്യാപന കൺസോൾ')), k.h('div', { class: 'learning-sub' }, `${k.user.display_name || ''} · ${fmtDate(k, d.today)}`),
      k.h('div', { class: 'learning-hero-row' }, k.h('span', { class: 'learning-chip' }, '👥 ', k.t(`${d.stats.learners} learners`, `${d.stats.learners} പഠിതാക്കൾ`)), k.h('span', { class: 'learning-chip' }, '🗓️ ', k.t(`${d.stats.sessions_30d} sessions / 30d`, `${d.stats.sessions_30d} ക്ലാസുകൾ / 30 ദിവസം`)), k.h('span', { class: 'learning-chip' }, '✅ ', k.t(`Attendance ${pctTxt(d.stats.attendance_30d)}`, `ഹാജർ ${pctTxt(d.stats.attendance_30d)}`)), d.stats.hidden ? k.h('span', { class: 'learning-chip', title: k.t('Enrolled but consent withdrawn/not given — hidden from you', 'സമ്മതമില്ല — മറച്ചിരിക്കുന്നു') }, '🔒 ', k.t(`${d.stats.hidden} hidden`, `${d.stats.hidden} മറച്ചു`)) : null, offlineNote(k, d))));
    const sess = (s) => k.h('div', { class: 'learning-sess', onclick: () => k.go(`#/m/learning/session?id=${s.id}`) }, k.h('div', { class: 'learning-time' }, s.date === d.today ? s.start_time : fmtDate(k, s.date)), k.h('div', { style: 'flex:1;min-width:0' }, k.h('b', {}, s.topic), k.h('div', { class: 'learning-muted' }, `${s.programme} · ${s.hamlet}`)), s.status === 'held' ? k.ui.badge(`${s.present_count}/${s.roster_count}`, 'good') : k.ui.badge(k.t('Mark ›', 'ഹാജർ ›'), 'info'));
    const left = k.h('div', { class: 'learning-stack' },
      k.ui.card({ title: k.t("Today's sessions", 'ഇന്നത്തെ ക്ലാസുകൾ'), body: d.today_sessions.length ? k.h('div', { class: 'learning-stack', style: 'gap:8px' }, d.today_sessions.map(sess)) : k.ui.empty(k.t('No session today', 'ഇന്ന് ക്ലാസില്ല')), actions: k.ui.button(k.t('+ New session', '+ പുതിയ ക്ലാസ്'), () => newSession(k, d.programmes), { tone: 'primary', small: true }) }),
      k.ui.card({ title: k.t('Upcoming', 'വരാനിരിക്കുന്നത്'), body: d.upcoming.length ? k.h('div', { class: 'learning-stack', style: 'gap:8px' }, d.upcoming.map(sess)) : k.ui.empty('—') }),
      k.ui.card({ title: k.t('🏕️ Holiday & vacation camps', '🏕️ അവധിക്കാല ക്യാമ്പുകൾ'), body: d.camps.length ? d.camps.map((c) => k.h('div', { style: 'margin-bottom:8px' }, k.h('b', {}, c.title), ' ', k.ui.badge(c.status, c.status === 'planned' ? 'info' : 'good'), k.h('div', { class: 'learning-muted' }, `${fmtDate(k, c.start_date)} – ${fmtDate(k, c.end_date)} · ${c.focus || ''}`))) : k.ui.empty(k.t('No camps planned', 'ക്യാമ്പുകളില്ല')), actions: k.ui.button(k.t('+ Plan a camp', '+ ക്യാമ്പ് ആസൂത്രണം'), () => newCamp(k, d.programmes), { small: true }) }));
    const right = k.h('div', { class: 'learning-stack' },
      k.ui.card({ title: k.t(`⚠️ At-risk learners (${d.at_risk_total})`, `⚠️ ശ്രദ്ധ വേണ്ടവർ (${d.at_risk_total})`), subtitle: k.t('Attendance < 60% in 30 days, low scores, or flagged', '30 ദിവസത്തിൽ ഹാജർ < 60%, കുറഞ്ഞ സ്കോർ, അല്ലെങ്കിൽ ഫ്ലാഗ്'), body: d.at_risk.length ? k.h('div', { class: 'learning-stack', style: 'gap:8px' }, d.at_risk.map((r) => k.h('div', { class: 'learning-flagrow', onclick: () => k.go(`#/m/learning/learner?id=${r.id}`) }, k.h('div', { style: 'font-size:1.4rem' }, r.gender === 'F' ? '👧' : '👦'), k.h('div', { style: 'flex:1;min-width:0' }, k.h('b', {}, r.name), k.h('div', {}, r.reasons.map((x) => k.h('span', { class: 'learning-pill' }, k.t(...(REASONS[x] || [x, x])))))), ring(k, r.attendance ? r.attendance.rate : null, '#b91c1c')))) : k.ui.empty(k.t('Nobody at risk 🎉', 'ആരും ഇല്ല 🎉')) }),
      k.ui.card({ title: k.t('📝 Homework to review', '📝 പരിശോധിക്കാനുള്ള ഗൃഹപാഠം'), body: k.h('div', { class: 'learning-row' }, k.h('div', { style: 'font-size:2rem;font-weight:800' }, String(d.homework_to_review)), k.h('span', { class: 'learning-muted' }, k.t('submissions waiting for feedback', 'സമർപ്പണങ്ങൾ കാത്തിരിക്കുന്നു'))), actions: [k.ui.button(k.t('Review', 'പരിശോധിക്കൂ'), () => k.go('#/m/learning/homework'), { small: true }), k.ui.button(k.t('+ Assign', '+ നൽകുക'), () => assignHomework(k), { small: true, tone: 'ghost' })] }),
      k.ui.card({ title: k.t('My programmes', 'എന്റെ പ്രോഗ്രാമുകൾ'), body: k.h('div', { class: 'learning-stack', style: 'gap:6px' }, d.programmes.map((p) => k.h('div', { class: 'learning-sess', onclick: () => k.go(`#/m/learning/roster?id=${p.id}`) }, k.h('div', { style: 'font-size:1.4rem' }, p.track === 'literacy' ? '🔤' : '📚'), k.h('div', { style: 'flex:1' }, k.h('b', {}, p.title), k.h('div', { class: 'learning-muted' }, `${p.hamlet} · ${(p.schedule || []).join(', ')}`)), '›'))) }),
      k.ui.card({ title: k.t('📖 SCERT lesson-plan library', '📖 SCERT പാഠാസൂത്രണ ശേഖരം'), body: k.t('Ready-made plans with warm-up, activity, home-language bridge notes and quick checks.', 'വാം-അപ്പ്, പ്രവർത്തനം, വീട്ടുഭാഷാ പാലം, ചെറുപരിശോധന എന്നിവയുള്ള തയ്യാർ പദ്ധതികൾ.'), actions: k.ui.button(k.t('Open library', 'ശേഖരം തുറക്കൂ'), () => k.go('#/m/learning/library?plans=1'), { small: true }) }));
    el.append(k.h('div', { class: 'learning-cols', style: 'margin-top:14px' }, left, right));
  });
}

async function newSession(k, programmes, preset = {}) {
  const lessons = await k.api.get('/content/lessons');
  const content = k.h('div');
  const m = k.ui.modal(k.t('New class session', 'പുതിയ ക്ലാസ്'), content);
  content.append(k.ui.form([
    { name: 'programme_id', label: k.t('Programme', 'പ്രോഗ്രാം'), type: 'select', required: true, value: preset.programme_id, options: programmes.map((p) => ({ value: p.id, label: `${p.title} · ${p.hamlet}` })) },
    { name: 'date', label: k.t('Date', 'തീയതി'), type: 'date', value: today(), required: true },
    { name: 'start_time', label: k.t('Start time', 'സമയം'), value: '16:00' },
    { name: 'lesson_ids', label: k.t('Lessons', 'പാഠങ്ങൾ'), type: 'multiselect', options: lessons.map((l) => ({ value: l.id, label: `${l.class ? 'C' + l.class : 'L' + l.level} · ${l.title}` })) },
    { name: 'topic', label: k.t('Topic (optional)', 'വിഷയം') },
    { name: 'kind', label: k.t('Type', 'തരം'), type: 'select', options: [{ value: 'class', label: k.t('Class', 'ക്ലാസ്') }, { value: 'remedial', label: k.t('Remedial / catch-up', 'പരിഹാര ക്ലാസ്') }, { value: 'remote', label: k.t('Remote teacher', 'ഓൺലൈൻ ടീച്ചർ') }] },
  ], async (v) => { const s = await k.api.post('/sessions', v); m.close(); k.toast(k.t('Session created', 'ക്ലാസ് സൃഷ്ടിച്ചു'), 'good'); if (s && s.id) k.go(`#/m/learning/session?id=${s.id}`); else k.refresh(); }, { submitLabel: k.t('Create', 'സൃഷ്ടിക്കുക') }));
}

async function newCamp(k, programmes) {
  const content = k.h('div');
  const m = k.ui.modal(k.t('Plan a holiday / vacation camp', 'അവധിക്കാല ക്യാമ്പ്'), content);
  const s = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), e = new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10);
  content.append(k.ui.form([
    { name: 'programme_id', label: k.t('Programme', 'പ്രോഗ്രാം'), type: 'select', required: true, options: programmes.map((p) => ({ value: p.id, label: `${p.title} · ${p.hamlet}` })) },
    { name: 'title', label: k.t('Title', 'പേര്'), value: 'Vacation Learning Camp', required: true },
    { name: 'title_ml', label: k.t('Title (Malayalam)', 'പേര് (മലയാളം)'), value: 'അവധിക്കാല പഠന ക്യാമ്പ്' },
    { name: 'kind', label: k.t('Kind', 'തരം'), type: 'select', options: ['vacation', 'holiday', 'exam_prep', 'bridge'] },
    { name: 'start_date', label: k.t('Start', 'തുടക്കം'), type: 'date', value: s, required: true },
    { name: 'end_date', label: k.t('End', 'അവസാനം'), type: 'date', value: e, required: true },
    { name: 'slots', label: k.t('Daily slots (comma separated)', 'ദിവസേനയുള്ള സമയങ്ങൾ'), value: '10:00, 14:00' },
    { name: 'focus', label: k.t('Focus', 'ശ്രദ്ധ'), placeholder: 'Catch-up maths & reading for special-attention cohort' },
  ], async (v) => { const r = await k.api.post('/camps', { ...v, daily_slots: String(v.slots || '').split(',').map((x) => x.trim()).filter(Boolean) }); m.close(); k.toast(k.t(`Camp planned with ${r.sessions || 0} sessions`, `${r.sessions || 0} ക്ലാസുകളോടെ ക്യാമ്പ് ആസൂത്രണം ചെയ്തു`), 'good'); k.refresh(); }, { submitLabel: k.t('Schedule', 'ആസൂത്രണം ചെയ്യുക') }));
}

// ------------------------------------------------------------------ session & attendance
async function session(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const s = await k.api.get('/sessions/' + encodeURIComponent(k.params.id || ''));
    el.innerHTML = '';
    const marks = {};
    for (const r of s.roster) marks[r.id] = r.status || (s.status === 'held' ? null : 'present');
    const counter = k.h('b');
    const upd = () => { const p = Object.values(marks).filter((x) => x === 'present' || x === 'late').length; counter.textContent = `${p} / ${s.roster.length} ${k.t('present', 'ഹാജർ')}`; };
    const SEG = [['present', 'P', 'p'], ['late', 'L', 'l'], ['absent', 'A', 'a'], ['excused', 'E', 'e']];
    const rows = s.roster.map((r) => {
      const seg = k.h('div', { class: 'learning-seg' });
      const draw = () => { seg.innerHTML = ''; for (const [st, lab, cl] of SEG) seg.append(k.h('button', { class: `${cl}${marks[r.id] === st ? ' on' : ''}`, title: st, onclick: () => { marks[r.id] = st; draw(); upd(); } }, lab)); };
      draw();
      const rate = r.attendance ? r.attendance.rate : null;
      return k.h('div', { class: 'learning-attrow' }, k.h('div', { style: 'font-size:1.3rem' }, r.gender === 'F' ? '👧' : r.kind === 'adult' ? '🧑' : '👦'), k.h('div', { class: 'learning-nm' }, k.h('b', { onclick: () => k.go(`#/m/learning/learner?id=${r.id}`), style: 'cursor:pointer' }, r.name), k.h('span', { class: 'learning-muted' }, `${r.school_class ? k.t('Class ', 'ക്ലാസ് ') + r.school_class + ' · ' : ''}${k.t('30d', '30 ദി')} ${pctTxt(rate)}`, rate !== null && rate < 0.6 ? ' ⚠️' : '')), seg);
    });
    upd();
    const notes = k.h('textarea', { rows: 3, style: 'width:100%;border-radius:10px;padding:8px', placeholder: k.t('Session notes: what went well, who needs help…', 'ക്ലാസ് കുറിപ്പുകൾ…') }, s.notes || '');
    el.append(k.ui.button(k.t('← Console', '← കൺസോൾ'), () => k.go('#/m/learning/console'), { tone: 'ghost', small: true }),
      k.h('div', { class: 'learning-hero', style: 'margin-top:10px' }, k.h('h2', {}, s.topic), k.h('div', { class: 'learning-sub' }, `${s.programme.title} · ${fmtDate(k, s.date)} ${s.start_time} · ${s.kind}`), k.h('div', { class: 'learning-hero-row' }, k.h('span', { class: 'learning-chip' }, s.status === 'held' ? '✅ ' + k.t('Held', 'നടന്നു') : '🕓 ' + k.t('Scheduled', 'ആസൂത്രിതം')), s.hidden ? k.h('span', { class: 'learning-chip' }, '🔒 ', k.t(`${s.hidden} hidden (no consent)`, `${s.hidden} മറച്ചു (സമ്മതമില്ല)`)) : null)));
    if (s.lessons.length) el.append(k.ui.section(k.t('Lessons for this session', 'ഈ ക്ലാസിലെ പാഠങ്ങൾ'), k.h('div', { class: 'learning-tiles' }, s.lessons.map((l) => lessonTile(k, l, null)))));
    el.append(k.ui.card({ title: k.t('Attendance', 'ഹാജർ'), subtitle: counter, body: [k.h('div', { class: 'learning-toolbar', style: 'margin-bottom:8px' }, k.ui.button(k.t('All present', 'എല്ലാവരും ഹാജർ'), () => { for (const r of s.roster) marks[r.id] = 'present'; rows.forEach((row) => row.querySelectorAll('.learning-seg button').forEach((b) => b.classList.toggle('on', b.title === 'present'))); upd(); }, { tone: 'ghost', small: true })), s.roster.length ? k.h('div', { class: 'learning-att' }, rows) : k.ui.empty(k.t('No learners visible on this roster', 'പട്ടികയിൽ പഠിതാക്കളില്ല')), k.h('div', { style: 'margin-top:10px' }, notes)],
      actions: k.ui.button(k.t('💾 Save attendance', '💾 ഹാജർ സേവ് ചെയ്യുക'), async () => {
        const list = Object.entries(marks).filter(([, st]) => st).map(([person_id, status]) => ({ person_id, status }));
        if (!list.length) return k.toast(k.t('Mark at least one learner', 'ഒരാളെയെങ്കിലും രേഖപ്പെടുത്തൂ'), 'warn');
        try { const r = await k.api.post(`/sessions/${s.id}/attendance`, { marks: list, notes: notes.value }); if (r.queued) k.toast(k.t('Saved offline — will sync', 'ഓഫ്‌ലൈനായി സൂക്ഷിച്ചു'), 'info'); else { k.toast(k.t(`Saved: ${r.present}/${r.total} present`, `സേവ് ചെയ്തു: ${r.present}/${r.total}`), 'good'); if (r.flagged && r.flagged.length) k.toast(k.t(`${r.flagged.length} learner(s) flagged at-risk`, `${r.flagged.length} പേരെ ശ്രദ്ധ വേണ്ടവരായി രേഖപ്പെടുത്തി`), 'warn'); k.refresh(); } } catch (e) { k.toast(e.message, 'bad'); }
      }, { tone: 'primary' }) }));
  });
}

async function roster(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const d = await k.api.get(`/programmes/${encodeURIComponent(k.params.id || '')}/roster`);
    el.innerHTML = '';
    el.append(k.ui.button(k.t('← Console', '← കൺസോൾ'), () => k.go('#/m/learning/console'), { tone: 'ghost', small: true }), k.h('h2', {}, d.programme.title), k.h('div', { class: 'learning-row', style: 'margin-bottom:10px' }, k.ui.button(k.t('+ Session', '+ ക്ലാസ്'), () => newSession(k, [{ ...d.programme, hamlet: '' }], { programme_id: d.programme.id }), { small: true, tone: 'primary' }), k.ui.button(k.t('+ Homework', '+ ഗൃഹപാഠം'), () => assignHomework(k, { programme_id: d.programme.id }), { small: true }), d.hidden ? k.ui.badge(k.t(`🔒 ${d.hidden} hidden — no consent`, `🔒 ${d.hidden} മറച്ചു`), 'info') : null));
    el.append(k.ui.table([
      { key: 'name', label: k.t('Learner', 'പഠിതാവ്'), render: (r) => k.h('div', {}, k.h('b', {}, r.name), k.h('div', { class: 'learning-muted' }, r.school_class ? k.t('Class ', 'ക്ലാസ് ') + r.school_class : r.literacy_level || '')) },
      { key: 'att', label: k.t('Attendance 30d', 'ഹാജർ 30 ദി'), render: (r) => r.attendance ? k.ui.badge(pctTxt(r.attendance.rate), r.attendance.rate < 0.6 ? 'bad' : r.attendance.rate < 0.75 ? 'warn' : 'good') : '—' },
      { key: 'score', label: k.t('Avg score', 'ശരാശരി'), render: (r) => r.score ? pctTxt(r.score.avg) : '—' },
      { key: 'risk', label: k.t('Status', 'നില'), render: (r) => r.reasons.length ? r.reasons.map((x) => k.ui.badge(k.t(...(REASONS[x] || [x, x])), 'warn')) : k.ui.badge('OK', 'good') },
      { key: 'act', label: '', render: (r) => k.ui.button(k.t('Flag', 'ഫ്ലാഗ്'), (e) => { if (e && e.stopPropagation) e.stopPropagation(); flagLearner(k, r, d.programme.id); }, { small: true, tone: 'ghost' }) },
    ], d.learners, { onRow: (r) => k.go(`#/m/learning/learner?id=${r.id}`), empty: k.t('No learners visible', 'പഠിതാക്കളില്ല') }));
  });
}

function flagLearner(k, person, programme_id) {
  const content = k.h('div');
  const m = k.ui.modal(k.t(`Flag ${person.name} as at-risk`, `${person.name} — ശ്രദ്ധ വേണം`), content);
  content.append(k.ui.form([
    { name: 'reason', label: k.t('Reason', 'കാരണം'), type: 'select', required: true, options: Object.entries(REASONS).map(([v, [en, ml]]) => ({ value: v, label: k.t(en, ml) })) },
    { name: 'note', label: k.t('Note (what you observed, next step)', 'കുറിപ്പ്'), type: 'textarea' },
  ], async (v) => { await k.api.post('/flags', { ...v, person_id: person.id, programme_id }); m.close(); k.toast(k.t('Flag raised', 'രേഖപ്പെടുത്തി'), 'warn'); k.refresh(); }, { submitLabel: k.t('Flag', 'രേഖപ്പെടുത്തുക') }));
}

async function learner(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const d = await k.api.get('/learners/' + encodeURIComponent(k.params.id || ''));
    el.innerHTML = '';
    const p = d.person;
    el.append(k.ui.button(k.t('← Back', '← തിരികെ'), () => history.back(), { tone: 'ghost', small: true }),
      k.h('div', { class: 'learning-hero', style: 'margin-top:10px' }, k.h('h2', {}, `${p.gender === 'F' ? '👧' : '👦'} ${p.name}`), k.h('div', { class: 'learning-sub' }, [p.school_class ? k.t('Class ', 'ക്ലാസ് ') + p.school_class : null, p.language ? k.t('Home language: ', 'വീട്ടുഭാഷ: ') + p.language : null, p.dropout ? k.t('⚠ Out of school', '⚠ സ്കൂളിന് പുറത്ത്') : null].filter(Boolean).join(' · ')),
        k.h('div', { class: 'learning-hero-row' }, k.ui.button(k.t('Placement check', 'നിലനിർണയം'), () => k.go(`#/m/learning/diagnostic?person_id=${p.id}`), { small: true }), k.ui.button(k.t('Flag', 'ഫ്ലാഗ്'), () => flagLearner(k, p, null), { small: true, tone: 'ghost' }))),
      k.h('div', { style: 'height:12px' }), progressView(k, d, { staff: true }));
    if (d.flags.some((f) => f.status === 'open')) el.append(k.ui.card({ title: k.t('Resolve open flags', 'ഫ്ലാഗുകൾ പരിഹരിക്കുക'), body: d.flags.filter((f) => f.status === 'open').map((f) => k.h('div', { class: 'learning-row', style: 'margin-bottom:6px' }, k.ui.badge(k.t(...(REASONS[f.reason] || [f.reason, f.reason])), 'warn'), k.h('span', { style: 'flex:1' }, f.note || ''), k.ui.button(k.t('Resolve', 'പരിഹരിച്ചു'), async () => { const note = prompt(k.t('What was done? (home visit, talked to parent…)', 'എന്ത് ചെയ്തു?')) || ''; await k.api.post(`/flags/${f.id}/resolve`, { note }); k.toast(k.t('Resolved', 'പരിഹരിച്ചു'), 'good'); k.refresh(); }, { small: true }))) }));
  });
}

// ------------------------------------------------------------------ literacy circles
async function literacy(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const [circles, lv] = await Promise.all([k.api.get('/literacy/circles'), k.api.get('/literacy/levels')]);
    el.innerHTML = '';
    el.append(k.h('h2', {}, k.t('🔤 Adult literacy circles', '🔤 മുതിർന്നവരുടെ സാക്ഷരതാ കൂട്ടങ്ങൾ')), k.h('p', { class: 'learning-muted' }, k.t('Letters → words → sentences → reading notices and filling forms.', 'അക്ഷരങ്ങൾ → വാക്കുകൾ → വാക്യങ്ങൾ → അറിയിപ്പുകളും ഫോമുകളും.')));
    el.append(k.ui.grid(lv.levels.map((l) => k.ui.card({ title: `${l.icon} ${T(k, l)}`, body: k.h('div', { class: 'learning-muted' }, T(k, l, 'goal')) })), 200));
    if (!circles.length) { el.append(k.ui.empty(k.t('You do not run a literacy circle. (Lessons are still open in the library.)', 'നിങ്ങൾക്ക് സാക്ഷരതാ കൂട്ടമില്ല.'))); return; }
    for (const c of circles) {
      const canAssess = ['facilitator', 'teacher', 'platform_admin', 'agency_admin'].includes(k.user.role);
      el.append(k.ui.section(`${c.programme.title} · ${c.programme.hamlet}`, [
        k.ui.bars(['🔤 1', '🧺 2', '💬 3', '📋 4', '🎓 5'].map((label, i) => ({ label, value: c.distribution[i] })), { unit: '' }),
        c.hidden ? k.h('div', { class: 'learning-muted' }, k.t(`🔒 ${c.hidden} members hidden (no consent)`, `🔒 ${c.hidden} അംഗങ്ങളെ മറച്ചു`)) : null,
        k.ui.table([
          { key: 'name', label: k.t('Member', 'അംഗം'), render: (r) => k.h('b', {}, r.name) },
          { key: 'lv', label: k.t('Level', 'നില'), render: (r) => k.h('div', { style: 'min-width:220px' }, literacyLadder(k, r.literacy ? r.literacy.level : 1, lv.levels)) },
          { key: 'last', label: k.t('Last check', 'അവസാന പരിശോധന'), render: (r) => r.literacy && r.literacy.last_assessed ? fmtDate(k, r.literacy.last_assessed) : '—' },
          { key: 'a', label: '', render: (r) => canAssess ? k.ui.button(k.t('Assess', 'വിലയിരുത്തുക'), (e) => { if (e && e.stopPropagation) e.stopPropagation(); assessLit(k, r, c.programme.id, lv.levels); }, { small: true }) : '' },
        ], c.learners, { empty: k.t('No members visible', 'അംഗങ്ങളില്ല') }),
      ]));
    }
  });
}

function assessLit(k, person, programme_id, levels) {
  const content = k.h('div');
  const m = k.ui.modal(k.t(`Literacy check — ${person.name}`, `സാക്ഷരതാ പരിശോധന — ${person.name}`), content);
  const SK = [['writes_name', 'Writes own name', 'സ്വന്തം പേരെഴുതുന്നു'], ['reads_vowels', 'Reads vowels', 'സ്വരങ്ങൾ വായിക്കുന്നു'], ['reads_consonants', 'Reads consonants', 'വ്യഞ്ജനങ്ങൾ'], ['reads_money', 'Reads money & prices', 'പണം, വില'], ['reads_bus_board', 'Reads bus boards', 'ബസ് ബോർഡ്'], ['reads_medicine_label', 'Reads medicine labels', 'മരുന്ന് ലേബൽ'], ['reads_notice', 'Reads notices', 'അറിയിപ്പുകൾ'], ['fills_form', 'Fills a form', 'ഫോം പൂരിപ്പിക്കുന്നു']];
  const have = new Set((person.literacy && person.literacy.skills) || []);
  content.append(k.ui.form([
    { name: 'level', label: k.t('Level', 'നില'), type: 'select', value: String((person.literacy && person.literacy.level) || 1), options: [...levels.map((l) => ({ value: String(l.level), label: `${l.level} · ${T(k, l)}` })), { value: '5', label: k.t('5 · Independent reader', '5 · സ്വതന്ത്ര വായനക്കാരൻ') }] },
    { name: 'skills', label: k.t('Skills observed', 'നിരീക്ഷിച്ച കഴിവുകൾ'), type: 'multiselect', value: [...have], options: SK.map(([v, en, ml]) => ({ value: v, label: k.t(en, ml) })) },
    { name: 'notes', label: k.t('Notes', 'കുറിപ്പ്'), type: 'textarea', value: (person.literacy && person.literacy.notes) || '' },
  ], async (v) => { const r = await k.api.post('/literacy/assess', { ...v, person_id: person.id, programme_id }); m.close(); k.toast(r.awarded && r.awarded.length ? k.t('Level up! Added to passport 🎓', 'നില ഉയർന്നു! പാസ്‌പോർട്ടിൽ ചേർത്തു 🎓') : k.t('Saved', 'സേവ് ചെയ്തു'), 'good'); k.refresh(); }, { submitLabel: k.t('Save', 'സേവ് ചെയ്യുക') }));
}

// ------------------------------------------------------------------ library
async function library(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const staff = ['facilitator', 'teacher', 'coordinator', 'agency_admin', 'platform_admin'].includes(k.user.role);
    const meta = await k.api.get('/content/subjects');
    const subjects = Object.fromEntries(meta.subjects.map((s) => [s.id, s]));
    el.innerHTML = '';
    el.append(k.h('h2', {}, k.t('📖 Lesson library', '📖 പാഠശേഖരം')), k.h('div', { class: 'learning-muted', style: 'margin-bottom:10px' }, k.t(`${meta.totals.lessons} lessons · ${meta.totals.questions} practice questions · ${meta.totals.bridge} with home-language bridge 🌉 · SCERT Kerala aligned`, `${meta.totals.lessons} പാഠങ്ങൾ · ${meta.totals.questions} ചോദ്യങ്ങൾ · ${meta.totals.bridge} വീട്ടുഭാഷാ പാലം 🌉 · SCERT കേരളം`)));
    let subject = k.params.subject || '', cls = k.params.class || '';
    const host = k.h('div');
    const draw = async () => {
      host.innerHTML = ''; host.append(k.ui.loading());
      const qs = new URLSearchParams(); if (subject) qs.set('subject', subject); if (cls) qs.set('class', cls);
      try {
        if (staff && k.params.plans === '1') {
          const plans = await k.api.get('/content/plans?' + qs);
          host.innerHTML = '';
          host.append(k.h('div', { class: 'learning-stack' }, plans.map((p) => k.ui.card({ title: `${p.icon} ${p.title}`, subtitle: `${k.t(subjInfo(subjects, p.subject).en, subjInfo(subjects, p.subject).ml)} · ${p.scert || (p.level ? 'Literacy L' + p.level : '')}`, body: k.ui.kv([[k.t('Objective', 'ലക്ഷ്യം'), T(k, p, 'objective')], [k.t('Warm-up (read aloud)', 'വാം-അപ്പ്'), p.warmup || '—'], [k.t('Activity', 'പ്രവർത്തനം'), T(k, p, 'activity') || '—'], [k.t('Bridge', 'പാലം'), p.bridge_note ? `🌉 ${T(k, p, 'bridge_note')}` : '—'], [k.t('Quick check', 'ചെറുപരിശോധന'), p.check.join(' · ')]]), actions: k.ui.button(k.t('Open', 'തുറക്കൂ'), () => k.go(`#/m/learning/lesson?id=${p.id}`), { small: true }) }))));
        } else {
          const ls = await k.api.get('/content/lessons?' + qs);
          host.innerHTML = '';
          host.append(ls.length ? k.h('div', { class: 'learning-tiles' }, ls.map((l) => lessonTile(k, l, subjects))) : k.ui.empty(k.t('No lessons for this filter', 'പാഠങ്ങളില്ല')));
        }
      } catch (e) { errBox(k, host, e); }
    };
    const chips = k.h('div', { class: 'learning-row', style: 'margin-bottom:8px' }, [{ id: '', en: 'All', ml: 'എല്ലാം', icon: '✨' }, ...meta.subjects].map((s) => { const b = k.ui.button(`${s.icon} ${k.t(s.en, s.ml)}`, () => { subject = s.id; chips.querySelectorAll('button').forEach((x) => x.classList.remove('primary')); b.classList.add('primary'); draw(); }, { small: true, tone: subject === s.id ? 'primary' : 'ghost' }); return b; }));
    const clsSel = k.h('select', { onchange: (e) => { cls = e.target.value; draw(); }, style: 'padding:6px;border-radius:8px' }, k.h('option', { value: '' }, k.t('All classes', 'എല്ലാ ക്ലാസും')), Array.from({ length: 10 }, (_, i) => k.h('option', { value: String(i + 1), selected: cls === String(i + 1) }, k.t('Class ', 'ക്ലാസ് ') + (i + 1))));
    el.append(chips, k.h('div', { class: 'learning-row', style: 'margin-bottom:12px' }, clsSel, staff ? k.ui.button(k.params.plans === '1' ? k.t('🧩 Tiles', '🧩 ടൈലുകൾ') : k.t('📋 Lesson plans', '📋 പാഠാസൂത്രണം'), () => k.go(k.params.plans === '1' ? '#/m/learning/library' : '#/m/learning/library?plans=1'), { small: true, tone: 'ghost' }) : null), host);
    draw();
  });
}

// ------------------------------------------------------------------ overview (agency / platform)
async function overview(el, k) {
  setup(k);
  await guarded(k, el, async () => {
    const d = await k.api.get('/overview');
    el.innerHTML = '';
    el.append(k.h('h2', {}, k.t('📊 Learning overview', '📊 പഠന അവലോകനം')));
    el.append(k.ui.grid([
      k.ui.stat(k.t('Programmes', 'പ്രോഗ്രാമുകൾ'), d.totals.programmes),
      k.ui.stat(k.t('Learners enrolled', 'പഠിതാക്കൾ'), d.totals.enrolled),
      k.ui.stat(k.t('Sessions (30d)', 'ക്ലാസുകൾ (30 ദി)'), d.totals.sessions_30d),
      k.ui.stat(k.t('Lessons completed (30d)', 'പാഠങ്ങൾ (30 ദി)'), d.totals.lessons_30d),
      k.ui.stat(k.t('At risk', 'ശ്രദ്ധ വേണ്ടവർ'), d.totals.at_risk),
    ], 150));
    const imp = d.impact;
    const gapRows = Object.entries(imp.by_subject || {}).map(([s, v]) => ({ s, ...v }));
    el.append(k.h('div', { class: 'learning-cols', style: 'margin-top:14px' },
      k.ui.card({ title: k.t('Lessons completed per week', 'ആഴ്ചതോറും പൂർത്തിയാക്കിയ പാഠങ്ങൾ'), body: [k.ui.spark(d.weekly.map((w) => w.lessons)), k.h('div', { class: 'learning-hbar', style: 'margin-top:8px' }, d.weekly.map((w) => k.h('i', { title: `${w.week}: ${w.lessons}`, style: `height:${Math.round((100 * w.lessons) / Math.max(1, ...d.weekly.map((x) => x.lessons)))}%` })))] }),
      k.ui.card({ title: k.t('Closing the grade gap', 'ക്ലാസ് വിടവ് നികത്തൽ'), subtitle: k.t(`${imp.learners_rechecked} learners re-checked · avg gap ${imp.gap_first !== null ? imp.gap_first.toFixed(2) : '—'} → ${imp.gap_latest !== null ? imp.gap_latest.toFixed(2) : '—'} classes`, `${imp.learners_rechecked} പേർ പുനഃപരിശോധിച്ചു · ശരാശരി വിടവ് ${imp.gap_first !== null ? imp.gap_first.toFixed(2) : '—'} → ${imp.gap_latest !== null ? imp.gap_latest.toFixed(2) : '—'}`), body: k.ui.table([{ key: 's', label: k.t('Subject', 'വിഷയം'), render: (r) => k.t(subjInfo(d.subjects, r.s).en, subjInfo(d.subjects, r.s).ml) }, { key: 'f', label: k.t('First check', 'ആദ്യം'), render: (r) => r.first.toFixed(2) }, { key: 'l', label: k.t('Latest', 'പുതിയത്'), render: (r) => r.latest.toFixed(2) }, { key: 'd', label: '', render: (r) => k.ui.badge(r.latest < r.first ? `▼ ${Math.round((100 * (r.first - r.latest)) / Math.max(0.01, r.first))}%` : '—', r.latest < r.first ? 'good' : 'info') }], gapRows, { empty: k.t('Not enough re-checks yet', 'ഇതുവരെ മതിയായ വിവരമില്ല') }) }),
      k.ui.card({ title: k.t('Cohorts (latest placement)', 'വിഭാഗങ്ങൾ'), body: k.ui.bars(Object.entries(COHORT).map(([key, [en, ml]]) => ({ label: k.t(en, ml), value: typeof d.cohorts[key] === 'number' ? d.cohorts[key] : 0 })), {}) }),
      Object.keys(d.literacy_levels).length ? k.ui.card({ title: k.t('Literacy circle levels', 'സാക്ഷരതാ നിലകൾ'), body: k.ui.bars(['1 🔤', '2 🧺', '3 💬', '4 📋', '5 🎓'].map((label, i) => ({ label, value: typeof d.literacy_levels[i + 1] === 'number' ? d.literacy_levels[i + 1] : 0 })), {}) }) : null));
    el.append(k.ui.section(k.t('Programmes', 'പ്രോഗ്രാമുകൾ'), k.ui.table([
      { key: 't', label: k.t('Programme', 'പ്രോഗ്രാം'), render: (r) => k.h('div', {}, k.h('b', {}, r.title), k.h('div', { class: 'learning-muted' }, `${r.hamlet} · `, k.h('span', { style: `color:${r.agency_colour || 'inherit'}` }, r.agency))) },
      { key: 'e', label: k.t('Enrolled', 'പഠിതാക്കൾ'), render: (r) => String(r.enrolled) },
      { key: 's', label: k.t('Sessions 30d', 'ക്ലാസ് 30 ദി'), render: (r) => String(r.sessions_30d) },
      { key: 'a', label: k.t('Attendance', 'ഹാജർ'), render: (r) => r.attendance === null ? '—' : k.ui.badge(pctTxt(r.attendance), r.attendance < 0.6 ? 'bad' : r.attendance < 0.75 ? 'warn' : 'good') },
      { key: 'l', label: k.t('Lessons 30d', 'പാഠം 30 ദി'), render: (r) => String(r.lessons_30d) },
      { key: 'sc', label: k.t('Avg score', 'ശരാശരി'), render: (r) => pctTxt(r.avg_score) },
      { key: 'r', label: k.t('At risk', 'ശ്രദ്ധ'), render: (r) => r.at_risk ? k.ui.badge(String(r.at_risk), 'warn') : '0' },
    ], d.programmes, { empty: k.t('No programmes', 'പ്രോഗ്രാമുകളില്ല') })));
  });
}

export default {
  views: {
    home, lesson, practice: lesson, diagnostic, progress, child, homework,
    console: console_, session, roster, learner, literacy, library, overview,
  },
};
