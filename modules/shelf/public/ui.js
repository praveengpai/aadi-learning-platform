// My Learning Shelf — browser views. No DOM work at import time.

const CSS = `
.shelf-hero{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:14px 16px;border-radius:var(--r-l,14px);background:linear-gradient(135deg,var(--forest,#0f5a4e),var(--forest-2,#1f8a70));color:#fff;margin-bottom:14px}
.shelf-hero h2{margin:0;color:#fff;font-size:1.25rem}
.shelf-hero p{margin:.2em 0 0;opacity:.92}
.shelf-hero .shelf-big{font-size:2.3rem;line-height:1}
.shelf-hero .btn{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.4)}
.shelf-grow{flex:1;min-width:180px}
.shelf-streak{display:flex;gap:4px;align-items:center;margin-top:6px;flex-wrap:wrap}
.shelf-dot{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;background:rgba(255,255,255,.18);color:#fff}
.shelf-dot.on{background:var(--gold,#e0a526);color:#3b2a00;font-weight:700}
.shelf-light .shelf-dot{background:var(--line,#e3e8e6);color:var(--ink-2,#4b5a55)}
.shelf-light .shelf-dot.on{background:var(--gold,#e0a526);color:#3b2a00}
.shelf-rev{display:grid;gap:10px;margin-bottom:16px}
.shelf-card{border:2px solid var(--line,#e3e8e6);border-radius:var(--r-l,14px);background:var(--surface,#fff);padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.shelf-card.done{border-color:var(--good,#2e7d32);background:var(--good-bg,#eaf6ec)}
.shelf-card .shelf-top{display:flex;gap:10px;align-items:center}
.shelf-card .shelf-ic{font-size:1.9rem;flex:0 0 auto}
.shelf-card .shelf-tt{flex:1;min-width:0}
.shelf-card .shelf-tt b{display:block;font-size:1.05rem;line-height:1.3}
.shelf-mini{font-size:.82rem;color:var(--ink-2,#5b6b66)}
.shelf-acts{display:flex;gap:8px;flex-wrap:wrap}
.shelf-acts .btn{min-height:48px;font-size:1rem;flex:1;min-width:92px}
.shelf-feel{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.shelf-feel .btn{min-height:56px;font-size:1rem;padding:6px 4px}
.shelf-say{border:none;background:none;cursor:pointer;font-size:1.2rem;padding:2px 6px;min-width:36px;min-height:36px;color:inherit}
.shelf-exam{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:var(--r-m,10px);background:var(--info-bg,#eef4fb);margin-bottom:16px;flex-wrap:wrap}
.shelf-fold{border:1px solid var(--line,#e3e8e6);border-radius:var(--r-l,14px);background:var(--surface,#fff);margin-bottom:10px;overflow:hidden}
.shelf-fold>summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;min-height:52px}
.shelf-fold>summary::-webkit-details-marker{display:none}
.shelf-fold>summary .shelf-ft{font-weight:700;font-size:1.05rem;flex:1;min-width:150px}
.shelf-fold[open]>summary{border-bottom:1px solid var(--line,#e3e8e6);background:var(--leaf-soft,#eef7f2)}
.shelf-counts{display:flex;gap:6px;flex-wrap:wrap}
.shelf-subj{border-top:1px solid var(--line,#e3e8e6)}
.shelf-subj:first-child{border-top:none}
.shelf-subj>summary{cursor:pointer;padding:10px 14px;display:flex;gap:8px;align-items:center;min-height:46px}
.shelf-item{display:flex;gap:10px;align-items:center;padding:8px 14px 8px 22px;border-top:1px dashed var(--line,#e3e8e6);flex-wrap:wrap}
.shelf-item .shelf-tt{flex:1;min-width:150px}
.shelf-pct{font-weight:700;min-width:44px;text-align:right}
.shelf-pct.low{color:var(--bad,#b91c1c)}
.shelf-ward{display:grid;gap:10px}
.shelf-sum{font-size:1.05rem;line-height:1.55;background:var(--paper,#fbf8f1);border-left:4px solid var(--gold,#e0a526);padding:10px 12px;border-radius:0 var(--r-m,10px) var(--r-m,10px) 0}
.shelf-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.shelf-stats div{background:var(--leaf-soft,#eef7f2);border-radius:var(--r-m,10px);padding:8px;text-align:center}
.shelf-stats b{display:block;font-size:1.4rem}
.shelf-print h1{font-size:1.4rem;margin:0 0 4px}
.shelf-print table{width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:10px}
.shelf-print td,.shelf-print th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}
.shelf-print h2{font-size:1.15rem;margin:16px 0 4px;border-bottom:2px solid #333}
.shelf-print h3{font-size:1rem;margin:10px 0 4px}
@media print{.shelf-noprint,nav,header,.topbar,.sidebar,.toasts{display:none!important}.shelf-print{font-size:11pt}.shelf-print h2{break-after:avoid}.shelf-print tr{break-inside:avoid}}
`;

const KIND = {
  lesson: ['📘', 'Lesson', 'പാഠം'], quiz: ['✏️', 'Quiz', 'ക്വിസ്'], mock: ['🎯', 'Test', 'ടെസ്റ്റ്'], language: ['🗣️', 'Language', 'ഭാഷ'],
  lifeskill: ['🧭', 'Life skill', 'ജീവിത നൈപുണ്യം'], book: ['📖', 'Book', 'പുസ്തകം'], homework: ['📝', 'Homework', 'ഗൃഹപാഠം'],
};
const REASON = { low_score: ['Score was low — try again', 'മാർക്ക് കുറവായിരുന്നു — വീണ്ടും നോക്കാം', 'warn'], spaced: ['Time to remember', 'ഓർമ്മ പുതുക്കാൻ സമയമായി', 'info'], not_revisited: ['Not opened for a while', 'കുറച്ചുകാലമായി തുറന്നിട്ടില്ല', 'info'] };

const T = (k, o, f = 'title') => k.t(o[f] || '', o[f + '_ml'] || o[f] || '');
const fmtDate = (k, d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return String(d).slice(0, 10); } };
const pctTxt = (p) => (p === null || p === undefined ? '' : p + '%');
const ls = {
  get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
  set(key, v) { try { localStorage.setItem(key, v); } catch (_) { /* private mode */ } },
};
const openedKey = (date, it) => `shelf.opened:${date}:${it.kind}|${it.ref}`;
const sayBtn = (k, text) => k.h('button', { class: 'shelf-say', type: 'button', title: k.t('Read aloud', 'വായിച്ചു കേൾപ്പിക്കുക'), 'aria-label': k.t('Read aloud', 'വായിച്ചു കേൾപ്പിക്കുക'), onclick: (e) => { e.preventDefault(); e.stopPropagation(); k.speak(text); } }, '🔊');

function weekDots(k, week, light) {
  const wd = k.lang === 'ml' ? ['ഞ', 'തി', 'ചൊ', 'ബു', 'വ്യ', 'വെ', 'ശ'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return k.h('div', { class: 'shelf-streak' + (light ? ' shelf-light' : '') }, (week || []).map((d) => k.h('span', { class: 'shelf-dot' + (d.done ? ' on' : ''), title: d.date }, d.done ? '✓' : wd[new Date(d.date + 'T00:00:00Z').getUTCDay()])));
}

function streakText(k, s) {
  if (!s || !s.days) return k.t('Revise today to start a streak!', 'ഇന്ന് ആവർത്തിച്ച് ഒരു തുടർച്ച തുടങ്ങൂ!');
  return k.t(`🔥 ${s.days}-day revision streak`, `🔥 തുടർച്ചയായി ${s.days} ദിവസം ആവർത്തനം`);
}

// ---------------------------------------------------------------- revise today
function reviseCard(k, d, it, self) {
  const kd = KIND[it.kind] || ['📁', it.kind, it.kind];
  const rs = REASON[it.reason] || REASON.spaced;
  const card = k.h('div', { class: 'shelf-card' + (it.done_today ? ' done' : '') });
  const title = T(k, it);
  const top = k.h('div', { class: 'shelf-top' },
    k.h('div', { class: 'shelf-ic', 'aria-hidden': 'true' }, it.icon || kd[0]),
    k.h('div', { class: 'shelf-tt' }, k.h('b', null, title), k.h('div', { class: 'shelf-mini' }, `${k.t(kd[1], kd[2])} · ${fmtDate(k, it.completed_at)}${it.pct !== null && it.pct !== undefined ? ' · ' + it.pct + '%' : ''}`)),
    sayBtn(k, title));
  const acts = k.h('div', { class: 'shelf-acts' });
  const render = () => {
    acts.replaceChildren();
    if (it.done_today) {
      acts.append(k.h('div', { class: 'shelf-mini', style: 'flex:1' }, '✅ ' + k.t('Done for today. See you on ', 'ഇന്നത്തേത് കഴിഞ്ഞു. അടുത്തത് ') + fmtDate(k, it.next_due || it.due)));
      return;
    }
    if (!self) { acts.append(k.ui.badge(k.t(rs[0], rs[1]), rs[2]), k.h('span', { class: 'shelf-mini' }, k.t('Due ', 'തീയതി ') + fmtDate(k, it.due))); return; }
    const opened = ls.get(openedKey(d.date, it)) === '1';
    acts.append(k.ui.button('▶ ' + k.t('Open', 'തുറക്കൂ'), () => { ls.set(openedKey(d.date, it), '1'); k.go(it.link); }, { tone: opened ? 'ghost' : 'primary' }));
    if (opened) {
      const feel = k.h('div', { class: 'shelf-feel', style: 'width:100%' });
      const rate = async (result) => {
        const r = await k.api.post('/review', { kind: it.kind, ref: it.ref, result });
        if (r && r.queued) { k.toast(k.t('Saved — will update when online', 'സൂക്ഷിച്ചു — ഓൺലൈനാകുമ്പോൾ പുതുക്കും'), 'warn'); it.done_today = true; render(); card.classList.add('done'); return; }
        it.done_today = true; it.next_due = r.due;
        card.classList.add('done');
        k.toast(result === 'hard' ? k.t('No problem — it will come back soon.', 'സാരമില്ല — ഉടൻ വീണ്ടും വരും.') : k.t(`Great! Next time in ${r.interval_days} days.`, `കൊള്ളാം! ഇനി ${r.interval_days} ദിവസം കഴിഞ്ഞ്.`), result === 'hard' ? 'info' : 'good');
        render();
      };
      feel.append(
        k.ui.button(k.h('span', null, '😊', k.h('br'), k.t('Easy', 'എളുപ്പം')), () => rate('easy')),
        k.ui.button(k.h('span', null, '🙂', k.h('br'), k.t('OK', 'കുഴപ്പമില്ല')), () => rate('ok')),
        k.ui.button(k.h('span', null, '😟', k.h('br'), k.t('Hard', 'പ്രയാസം')), () => rate('hard')));
      acts.append(k.h('div', { class: 'shelf-mini', style: 'width:100%' }, k.t('How did it go?', 'എങ്ങനെയുണ്ടായിരുന്നു?')), feel);
    } else {
      acts.append(k.h('div', { style: 'width:100%' }, k.ui.badge(k.t(rs[0], rs[1]), rs[2])));
    }
  };
  render();
  card.append(top, acts);
  return card;
}

function reviseSection(k, d, self) {
  const r = d.revise;
  const wrap = k.h('div');
  const head = k.t(`Revise today (${r.done}/${r.items.length})`, `ഇന്ന് ആവർത്തിക്കാം (${r.done}/${r.items.length})`);
  wrap.append(k.h('div', { class: 'row', style: 'align-items:center;gap:6px;margin:4px 0 8px' }, k.h('h2', { style: 'margin:0;flex:1' }, '🔁 ' + head),
    sayBtn(k, k.t('Revise today. Tap Open, look at it again, then tell how it went.', 'ഇന്ന് ആവർത്തിക്കാം. തുറക്കൂ, വീണ്ടും നോക്കൂ, പിന്നെ എങ്ങനെയുണ്ടായിരുന്നു എന്ന് തൊടൂ.'))));
  if (!r.items.length) wrap.append(k.ui.empty(k.t('Nothing to revise yet — finish a lesson and it will appear here.', 'ആവർത്തിക്കാൻ ഒന്നുമില്ല — ഒരു പാഠം പൂർത്തിയാക്കിയാൽ ഇവിടെ വരും.')));
  else wrap.append(k.h('div', { class: 'shelf-rev' }, r.items.map((it) => reviseCard(k, r, it, self))));
  if (r.exams) {
    wrap.append(k.h('div', { class: 'shelf-exam' }, k.h('span', { style: 'font-size:1.6rem' }, '🎯'),
      k.h('div', { class: 'shelf-grow' }, k.h('b', null, k.t(r.exams.label, r.exams.label_ml)), k.h('div', { class: 'shelf-mini' }, k.t(`${r.exams.due} question cards due in Exam Prep`, `പരീക്ഷാ പരിശീലനത്തിൽ ${r.exams.due} ചോദ്യ കാർഡുകൾ`))),
      self ? k.ui.button(k.t('Open', 'തുറക്കൂ'), () => k.go(r.exams.link), { small: true, tone: r.exams.due ? 'primary' : 'ghost' }) : k.ui.badge(String(r.exams.due), r.exams.due ? 'warn' : 'good')));
  }
  return wrap;
}

// ---------------------------------------------------------------- folders
function itemRow(k, it, canOpen) {
  const kd = KIND[it.kind] || ['📁', it.kind, it.kind];
  return k.h('div', { class: 'shelf-item' },
    k.h('span', { 'aria-hidden': 'true', style: 'font-size:1.3rem' }, it.icon || kd[0]),
    k.h('div', { class: 'shelf-tt' }, k.h('div', null, T(k, it)), k.h('div', { class: 'shelf-mini' }, `${k.t(kd[1], kd[2])} · ${fmtDate(k, it.completed_at)}${it.assigned_by ? ' · ' + k.t('from ', '') + it.assigned_by : ''}`)),
    it.pct !== null && it.pct !== undefined ? k.h('span', { class: 'shelf-pct' + (it.pct < 70 && it.kind !== 'language' ? ' low' : '') }, pctTxt(it.pct)) : null,
    canOpen && it.link ? k.ui.button(k.t('Reopen', 'വീണ്ടും തുറക്കൂ'), () => k.go(it.link), { small: true, tone: 'ghost' }) : null);
}

function folderCounts(k, s) {
  return k.h('span', { class: 'shelf-counts' },
    k.ui.pill(`📘 ${s.lessons}`), k.ui.pill(`✏️ ${s.tests}`), s.books ? k.ui.pill(`📖 ${s.books}`) : null,
    s.avg_pct !== null && s.avg_pct !== undefined ? k.ui.badge(k.t('avg ', 'ശരാശരി ') + s.avg_pct + '%', s.avg_pct >= 70 ? 'good' : 'warn') : null);
}

function foldersSection(k, d, canOpen) {
  const wrap = k.h('div');
  wrap.append(k.h('h2', { style: 'margin:18px 0 8px' }, '🗄️ ' + k.t('My shelf — year by year', 'അലമാര — വർഷം തിരിച്ച്')));
  if (!d.folders.length) { wrap.append(k.ui.empty(k.t('The shelf is empty for now.', 'അലമാര ഇപ്പോൾ ഒഴിഞ്ഞതാണ്.'))); return wrap; }
  for (const f of d.folders) {
    const det = k.h('details', { class: 'shelf-fold', open: f.current || d.folders.length === 1 });
    det.append(k.h('summary', null, k.h('span', { style: 'font-size:1.5rem' }, '📂'), k.h('span', { class: 'shelf-ft' }, k.t(f.label, f.label_ml), k.h('div', { class: 'shelf-mini' }, k.t(`${f.summary.items} things finished`, `${f.summary.items} എണ്ണം പൂർത്തിയാക്കി`))), folderCounts(k, f.summary)));
    for (const s of f.subjects) {
      const sd = k.h('details', { class: 'shelf-subj' });
      sd.append(k.h('summary', null, k.h('span', { style: 'font-size:1.2rem;min-width:1.6em;text-align:center' }, s.icon), k.h('b', { style: 'flex:1' }, k.t(s.label, s.label_ml)), k.ui.badge(String(s.count), 'info')));
      sd.append(...s.items.map((it) => itemRow(k, it, canOpen)));
      det.append(sd);
    }
    wrap.append(det);
  }
  return wrap;
}

function totalsLine(k, d) {
  const t = d.totals;
  return k.t(`${t.items} things finished · ${t.lessons} lessons · ${t.tests} tests · ${t.books} books`, `${t.items} എണ്ണം പൂർത്തിയാക്കി · ${t.lessons} പാഠം · ${t.tests} ടെസ്റ്റ് · ${t.books} പുസ്തകം`);
}

async function downloadExport(k, pid) {
  const data = await k.api.get('/export/' + encodeURIComponent(pid));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `learning-shelf-${String(pid).slice(-8)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function shelfPage(k, el, d, { canExport }) {
  k.style(CSS, 'shelf-css');
  const self = !!d.self;
  const first = String(d.person.name || '').split(' ')[0];
  const title = self ? k.t('My Learning Shelf', 'എന്റെ പഠന അലമാര') : k.t(`${first}'s Learning Shelf`, `${first}-ന്റെ പഠന അലമാര`);
  el.append(k.h('div', { class: 'shelf-hero' },
    k.h('div', { class: 'shelf-big', 'aria-hidden': 'true' }, '🗄️'),
    k.h('div', { class: 'shelf-grow' }, k.h('h2', null, title), k.h('p', null, totalsLine(k, d)), k.h('div', { class: 'shelf-mini', style: 'color:#fff;opacity:.9;margin-top:4px' }, streakText(k, d.streak)), weekDots(k, d.streak.week)),
    k.h('div', { class: 'shelf-acts' }, sayBtn(k, `${title}. ${totalsLine(k, d)}. ${streakText(k, d.streak)}`),
      canExport ? k.ui.button('🖨️ ' + k.t('Print / take home', 'പ്രിന്റ് / വീട്ടിലേക്ക്'), () => k.go(`#/m/shelf/print?pid=${encodeURIComponent(d.person.id)}`), { small: true }) : null)));
  el.append(reviseSection(k, d, self));
  el.append(foldersSection(k, d, self));
  el.append(k.h('div', { class: 'row shelf-noprint', style: 'gap:8px;margin-top:14px;flex-wrap:wrap' },
    k.h('a', { class: 'btn ghost', href: d.passport_link }, '🎓 ' + k.t('Learning passport', 'പഠന പാസ്‌പോർട്ട്')),
    canExport ? k.ui.button('⬇️ ' + k.t('Download my records (JSON)', 'രേഖകൾ ഡൗൺലോഡ് (JSON)'), () => downloadExport(k, d.person.id), { tone: 'ghost' }) : null));
}

const canExportAs = (k, d) => !!d.self || ['guardian', 'platform_admin', 'cpo'].includes(k.user && k.user.role);

// ---------------------------------------------------------------- views
async function home(el, k) {
  if (k.user.role !== 'learner') {
    if (k.user.role === 'guardian') return k.go('#/m/shelf/family');
    return k.go('#/m/shelf/class');
  }
  el.append(k.ui.loading());
  try {
    const d = await k.api.get('/me');
    el.replaceChildren();
    shelfPage(k, el, d, { canExport: true });
  } catch (e) { el.replaceChildren(k.ui.error(e)); }
}

async function learner(el, k) {
  const pid = k.params.pid || k.params.id || k.params.person_id;
  if (!pid) return k.user.role === 'learner' ? home(el, k) : k.go(k.user.role === 'guardian' ? '#/m/shelf/family' : '#/m/shelf/class');
  el.append(k.ui.loading());
  try {
    const d = await k.api.get('/person/' + encodeURIComponent(pid));
    el.replaceChildren();
    if (k.user.role !== 'learner') el.append(k.h('div', { class: 'shelf-noprint', style: 'margin-bottom:8px' }, k.ui.button('← ' + k.t('Back', 'തിരികെ'), () => history.back(), { small: true, tone: 'ghost' }), ' ', k.ui.badge(k.t('Read-only view', 'കാണാൻ മാത്രം'), 'info')));
    shelfPage(k, el, d, { canExport: canExportAs(k, d) });
  } catch (e) { el.replaceChildren(k.ui.error(e)); }
}

async function family(el, k) {
  k.style(CSS, 'shelf-css');
  el.append(k.ui.loading());
  let d;
  try { d = await k.api.get('/family'); } catch (e) { el.replaceChildren(k.ui.error(e)); return; }
  el.replaceChildren(k.h('div', { class: 'shelf-hero' }, k.h('div', { class: 'shelf-big' }, '👪'), k.h('div', { class: 'shelf-grow' }, k.h('h2', null, k.t("Child's learning shelf", 'കുട്ടിയുടെ പഠന അലമാര')), k.h('p', null, k.t('What your children finished and revised, in simple words.', 'കുട്ടികൾ പൂർത്തിയാക്കിയതും ആവർത്തിച്ചതും, ലളിതമായി.')))));
  if (!d.wards.length) { el.append(k.ui.empty(k.t('No children linked to you yet.', 'നിങ്ങളുമായി ബന്ധിപ്പിച്ച കുട്ടികളില്ല.'))); return; }
  for (const w of d.wards) {
    const s = w.summary_period === 'last_month' ? w.last_month : w.month;
    const summary = k.t(w.summary.en, w.summary.ml);
    el.append(k.ui.card({
      title: `${w.person.gender === 'F' ? '👧' : '👦'} ${w.person.name}`,
      subtitle: [w.person.school_class ? (/^class/i.test(String(w.person.school_class)) ? String(w.person.school_class) : k.t('Class ', 'ക്ലാസ് ') + w.person.school_class) : null, k.t(w.person.hamlet || '', w.person.hamlet_ml || w.person.hamlet || '')].filter(Boolean).join(' · '),
      body: k.h('div', { class: 'shelf-ward' },
        k.h('div', { class: 'row', style: 'align-items:flex-start;gap:6px' }, k.h('div', { class: 'shelf-sum', style: 'flex:1' }, summary), sayBtn(k, summary)),
        k.h('div', { class: 'shelf-mini' }, w.summary_period === 'last_month' ? k.t('Last month', 'കഴിഞ്ഞ മാസം') : k.t('This month', 'ഈ മാസം')),
        k.h('div', { class: 'shelf-stats' },
          k.h('div', null, k.h('b', null, String(s.lessons)), '📘 ' + k.t('Lessons', 'പാഠങ്ങൾ')),
          k.h('div', null, k.h('b', null, String(s.revised)), '🔁 ' + k.t('Revised', 'ആവർത്തനം')),
          k.h('div', null, k.h('b', null, String(s.tests)), '✏️ ' + k.t('Tests', 'ടെസ്റ്റുകൾ')),
          k.h('div', null, k.h('b', null, String(s.books)), '📖 ' + k.t('Books', 'പുസ്തകം')),
          k.h('div', null, k.h('b', null, s.avg_pct === null ? '—' : s.avg_pct + '%'), '⭐ ' + k.t('Average', 'ശരാശരി'))),
        k.h('div', null, k.h('div', { class: 'shelf-mini' }, streakText(k, w.streak)), weekDots(k, w.streak.week, true))),
      actions: [
        k.ui.button('🗄️ ' + k.t('Open shelf', 'അലമാര തുറക്കൂ'), () => k.go(w.link), { tone: 'primary', small: true }),
        k.ui.button('🖨️ ' + k.t('Print', 'പ്രിന്റ്'), () => k.go(`#/m/shelf/print?pid=${encodeURIComponent(w.person.id)}`), { small: true }),
        k.h('a', { class: 'btn ghost small', href: w.passport_link }, '🎓 ' + k.t('Passport', 'പാസ്‌പോർട്ട്')),
      ],
    }));
  }
}

async function print(el, k) {
  k.style(CSS, 'shelf-css');
  const pid = k.params.pid;
  el.append(k.ui.loading());
  let d;
  try { d = await k.api.get('/export/' + encodeURIComponent(pid || (k.user && k.user.person_id) || '')); } catch (e) { el.replaceChildren(k.ui.error(e)); return; }
  const kd = (it) => KIND[it.kind] || ['📁', it.kind, it.kind];
  el.replaceChildren(
    k.h('div', { class: 'row shelf-noprint', style: 'gap:8px;margin-bottom:12px;flex-wrap:wrap' },
      k.ui.button('← ' + k.t('Back', 'തിരികെ'), () => history.back(), { small: true, tone: 'ghost' }),
      k.ui.button('🖨️ ' + k.t('Print', 'പ്രിന്റ്'), () => window.print(), { tone: 'primary' }),
      k.ui.button('⬇️ JSON', () => downloadExport(k, d.person.id), { tone: 'ghost', small: true }),
      k.h('a', { class: 'btn ghost small', href: d.passport_link }, '🎓 ' + k.t('Learning passport', 'പഠന പാസ്‌പോർട്ട്'))),
    k.h('div', { class: 'shelf-print' },
      k.h('h1', null, k.t('Learning Shelf', 'പഠന അലമാര') + ' — ' + d.person.name),
      k.h('div', { class: 'shelf-mini' }, [k.brand ? k.t(k.brand.name, k.brand.name_ml || k.brand.name) : d.platform, d.person.hamlet, k.t('Printed ', 'അച്ചടിച്ചത് ') + fmtDate(k, d.exported_at)].filter(Boolean).join(' · ')),
      k.h('p', null, k.t(`${d.totals.items} things finished · ${d.totals.lessons} lessons · ${d.totals.tests} tests · ${d.totals.books} books · revised on ${d.streak.total_days} days`, `${d.totals.items} എണ്ണം · ${d.totals.lessons} പാഠം · ${d.totals.tests} ടെസ്റ്റ് · ${d.totals.books} പുസ്തകം · ${d.streak.total_days} ദിവസം ആവർത്തിച്ചു`)),
      d.folders.map((f) => [
        k.h('h2', null, '📂 ' + k.t(f.label, f.label_ml) + (f.summary.avg_pct !== null ? ` — ${k.t('average', 'ശരാശരി')} ${f.summary.avg_pct}%` : '')),
        f.subjects.map((s) => [
          k.h('h3', null, `${s.icon} ${k.t(s.label, s.label_ml)} (${s.count})`),
          k.h('table', null, k.h('tbody', null, s.items.map((it) => k.h('tr', null, k.h('td', { style: 'width:28px' }, it.icon || kd(it)[0]), k.h('td', null, T(k, it)), k.h('td', { style: 'white-space:nowrap' }, k.t(kd(it)[1], kd(it)[2])), k.h('td', { style: 'white-space:nowrap' }, fmtDate(k, it.completed_at)), k.h('td', { style: 'text-align:right' }, pctTxt(it.pct)))))),
        ]),
      ]),
      k.h('p', { class: 'shelf-mini', style: 'margin-top:16px' }, k.t('This record belongs to the learner and their family.', 'ഈ രേഖ പഠിതാവിനും കുടുംബത്തിനും സ്വന്തമാണ്.'))));
}

async function classView(el, k) {
  k.style(CSS, 'shelf-css');
  if (k.user.role === 'learner') return home(el, k);
  if (k.user.role === 'guardian') return family(el, k);
  el.append(k.h('h2', null, '🗄️ ' + k.t('Learner shelves — who revised this week', 'പഠിതാക്കളുടെ അലമാര — ഈ ആഴ്ച ആവർത്തിച്ചവർ')));
  let progs;
  try { progs = await k.api.get('/classes'); } catch (e) { el.append(k.ui.error(e)); return; }
  if (!progs.length) { el.append(k.ui.empty(k.t('No programmes for your agency.', 'നിങ്ങളുടെ ഏജൻസിക്ക് പ്രോഗ്രാമുകളില്ല.'))); return; }
  const sel = k.params.programme || progs[0].id;
  const select = k.h('select', { onchange: (e) => k.go('#/m/shelf/class?programme=' + encodeURIComponent(e.target.value)), style: 'min-height:44px;max-width:100%' },
    progs.map((p) => k.h('option', { value: p.id, selected: p.id === sel }, `${k.t(p.brand || p.title, p.brand_ml || p.title_ml || p.title)}${p.brand ? ' · ' + k.t(p.title, p.title_ml || p.title) : ''}${p.hamlet ? ' — ' + p.hamlet : ''}`)));
  el.append(k.h('div', { style: 'margin-bottom:10px' }, select));
  const host = k.h('div', null, k.ui.loading());
  el.append(host);
  try {
    const d = await k.api.get('/class/' + encodeURIComponent(sel));
    host.replaceChildren(
      k.ui.grid([k.ui.stat(k.t('Revised this week', 'ഈ ആഴ്ച ആവർത്തിച്ചവർ'), `${d.revised_learners}/${d.learners.length}`), k.ui.stat(k.t('Revisions this week', 'ഈ ആഴ്ചയിലെ ആവർത്തനം'), String(d.learners.reduce((s, l) => s + l.revised_week, 0)))], 160),
      d.hidden ? k.h('p', { class: 'shelf-mini' }, '🔒 ' + k.t(`${d.hidden} learner(s) hidden — no progress consent for your agency.`, `${d.hidden} പേരെ മറച്ചു — സമ്മതമില്ല.`)) : '',
      k.ui.table([
        { key: 'name', label: k.t('Learner', 'പഠിതാവ്'), render: (r) => `${r.gender === 'F' ? '👧' : '👦'} ${r.name}` },
        { key: 'revised_week', label: k.t('Items revised (7d)', 'ആവർത്തനം (7 ദി)'), render: (r) => k.ui.badge(String(r.revised_week), r.revised_week ? 'good' : 'warn') },
        { key: 'days_week', label: k.t('Days', 'ദിവസം'), render: (r) => String(r.days_week) },
        { key: 'streak', label: k.t('Streak', 'തുടർച്ച'), render: (r) => (r.streak ? '🔥 ' + r.streak : '—') },
      ], d.learners, { empty: k.t('No learners visible', 'പഠിതാക്കളില്ല'), onRow: (r) => k.go('#/m/shelf/learner?pid=' + encodeURIComponent(r.id)) }));
  } catch (e) { host.replaceChildren(k.ui.error(e)); }
}

export default { views: { home, learner, family, print, class: classView } };
