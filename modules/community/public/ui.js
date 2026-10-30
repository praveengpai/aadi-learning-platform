// AADI — Family & Community UI. No DOM work at import time.

const CSS = `
.community-hero{background:linear-gradient(135deg,var(--forest) 0%,var(--forest-2) 70%,#2c7a5e 100%);color:#fff;border-radius:var(--r-l);padding:18px 18px 16px;margin-bottom:16px;position:relative;overflow:hidden}
.community-hero h2{color:#fff;margin:0 0 4px;font-size:var(--step-2)}
.community-hero p{margin:0;opacity:.92;max-width:60ch}
.community-hero::after{content:"";position:absolute;right:-40px;bottom:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(201,162,39,.45),transparent 70%)}
.community-hero .community-say{position:absolute;top:12px;right:12px;z-index:1}
.community-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.community-between{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
.community-kid{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-l);padding:16px;margin-bottom:14px}
.community-kid-head{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.community-avatar{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:1.8rem;background:var(--gold-soft);flex:none}
.community-kid-name{font-size:var(--step-1);font-weight:700;line-height:1.2}
.community-bigstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:8px 0 12px}
.community-big{border-radius:var(--r-m);padding:12px;background:var(--leaf-soft)}
.community-big b{display:block;font-size:var(--step-2);line-height:1.1}
.community-big span{font-size:var(--step--1);color:var(--ink-2)}
.community-big.warn{background:var(--warn-bg)}
.community-consent{border:1px solid var(--line);border-radius:var(--r-m);padding:12px;margin-bottom:10px;background:#fff}
.community-consent.on{border-left:6px solid var(--good)}
.community-consent.off{border-left:6px solid var(--ink-3);background:#fafbfa}
.community-scope{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 12px;margin:4px 6px 0 0;border:1px solid var(--line);background:#fff;font-size:var(--step--1);cursor:pointer;min-height:40px}
.community-scope.yes{background:var(--good-bg);border-color:var(--good);color:var(--good);font-weight:700}
.community-scope[disabled]{cursor:default;opacity:.85}
.community-dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}
.community-notice{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:14px;margin-bottom:12px}
.community-notice.pinned{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold-soft)}
.community-cat{font-size:1.6rem;line-height:1}
.community-chipbar{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px}
.community-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;white-space:nowrap;cursor:pointer;min-height:36px}
.community-chip.on{background:var(--forest);color:#fff;border-color:var(--forest)}
.community-howto{background:var(--paper);border-radius:var(--r-s);padding:10px;margin-top:8px}
.community-demo{font-size:.75rem;background:var(--warn-bg);color:var(--warn);border-radius:4px;padding:1px 6px;font-weight:700}
.community-item{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:6px;min-height:150px}
.community-item:hover{border-color:var(--forest-2)}
.community-item .t{font-weight:700;font-size:var(--step-0)}
.community-lyrics{white-space:pre-wrap;font-size:1.05rem;line-height:1.7;background:var(--paper);border-radius:var(--r-m);padding:14px}
.community-lic{font-size:.75rem;border-radius:4px;padding:2px 6px;font-weight:700}
.community-lic.community{background:var(--gold-soft);color:#6b5200}
.community-lic.cc_by_nc{background:var(--info-bg);color:var(--info)}
.community-lic.public{background:var(--good-bg);color:var(--good)}
.community-meeting{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:14px;margin-bottom:12px}
.community-date{width:58px;flex:none;text-align:center;border-radius:var(--r-m);background:var(--forest);color:#fff;padding:6px 0;line-height:1.1}
.community-date b{display:block;font-size:1.4rem}
.community-date.past{background:var(--ink-3)}
.community-action{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px dashed var(--line)}
.community-matrix{width:100%;border-collapse:separate;border-spacing:4px;font-size:var(--step--1)}
.community-matrix th{text-align:left;font-weight:700;color:var(--ink-2);padding:4px}
.community-matrix td{background:var(--paper);border-radius:6px;padding:6px;vertical-align:top;min-width:96px}
.community-matrix td.gap{background:var(--bad-bg);color:var(--bad);font-weight:700;text-align:center}
.community-matrix td.overlap{background:var(--warn-bg)}
.community-prog{border-left:4px solid var(--forest-2);background:#fff;border-radius:4px;padding:4px 6px;margin-bottom:4px}
.community-thread{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:12px;margin-bottom:10px}
.community-post{border-left:4px solid var(--line);padding:6px 10px;margin:8px 0;background:var(--paper);border-radius:0 6px 6px 0}
.community-hamletcard{border:1px solid var(--line);border-radius:var(--r-m);background:#fff;padding:12px;cursor:pointer}
.community-hamletcard:hover{border-color:var(--forest-2)}
@media (max-width:560px){.community-hide-sm{display:none}.community-kid{padding:12px}}
`;

const CATS = {
  scholarship: ['🎓', 'Scholarships', 'സ്കോളർഷിപ്പ്'], hostel: ['🏫', 'Hostels & schools', 'ഹോസ്റ്റൽ'], livelihood: ['🌾', 'Livelihood', 'ഉപജീവനം'], documents: ['📄', 'Documents', 'രേഖകൾ'],
  health: ['🩺', 'Health', 'ആരോഗ്യം'], rights: ['⚖️', 'Rights', 'അവകാശങ്ങൾ'], event: ['📅', 'Events', 'പരിപാടികൾ'], general: ['📢', 'General', 'പൊതുവായത്'],
};
const KINDS = { story: ['📖', 'Story', 'കഥ'], song: ['🎵', 'Song', 'പാട്ട്'], knowledge: ['🌿', 'Knowledge', 'അറിവ്'], recipe: ['🍲', 'Recipe', 'പാചകം'], craft: ['🧺', 'Craft', 'കരകൗശലം'], medicine_plant: ['🌱', 'Plants', 'ചെടികൾ'] };
const LIC = { community: ['Our hamlet only', 'നമ്മുടെ ഊരിനു മാത്രം'], cc_by_nc: ['Share with credit, not for sale (CC BY-NC)', 'പേരു സഹിതം പങ്കിടാം, വിൽക്കരുത്'], public: ['Public — anyone can see', 'എല്ലാവർക്കും'] };
const SCOPE_TXT = {
  profile: ['🪪', 'Name, age and hamlet', 'പേര്, വയസ്സ്, ഊര്', 'They can know who your child is.', 'നിങ്ങളുടെ കുട്ടി ആരാണെന്ന് അവർക്ക് അറിയാം.'],
  progress: ['📈', 'Learning progress', 'പഠന പുരോഗതി', 'They can see attendance and marks.', 'ഹാജരും മാർക്കും കാണാം.'],
  contact: ['📞', 'Phone number', 'ഫോൺ നമ്പർ', 'They can call or message you.', 'അവർക്ക് നിങ്ങളെ വിളിക്കാം.'],
  wellbeing: ['💚', 'Wellbeing (counsellor only)', 'ക്ഷേമം (കൗൺസിലർ മാത്രം)', 'Only their counsellor can see how your child is feeling.', 'കൗൺസിലർക്കു മാത്രം.'],
  employment: ['💼', 'Job profile', 'ജോലി പ്രൊഫൈൽ', 'Employers of this agency can see the profile (adults only).', 'ഈ ഏജൻസിയുടെ തൊഴിലുടമകൾക്ക് കാണാം (മുതിർന്നവർ മാത്രം).'],
  research: ['📊', 'Anonymous reports', 'പേരില്ലാത്ത റിപ്പോർട്ടുകൾ', 'Counted in reports without the name.', 'പേരില്ലാതെ കണക്കിൽ ഉൾപ്പെടുത്താം.'],
};
const TRACK = { tuition: ['Tuition', 'ട്യൂഷൻ'], literacy: ['Literacy', 'സാക്ഷരത'], exams: ['Exam prep', 'പരീക്ഷ'], language: ['Language', 'ഭാഷ'], lifeskills: ['Life skills', 'ജീവിത നൈപുണ്യം'], digital: ['Digital', 'ഡിജിറ്റൽ'], counselling: ['Counselling', 'കൗൺസിലിംഗ്'] };

const fmtDate = (s, k) => { if (!s) return '—'; const d = new Date(s); return d.toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const isStaff = (k) => ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'].includes(k.user.role);
const canPostRole = (k) => ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'].includes(k.user.role);

function setup(k) { k.style(CSS, 'community-css'); }
function say(k, en, ml) { return k.ui.speakBtn ? k.ui.speakBtn(k.lang === 'ml' && ml ? ml : en, k.lang === 'ml' && ml ? 'ml' : 'en') : k.h('button', { class: 'speak', onclick: () => k.speak(k.lang === 'ml' && ml ? ml : en) }, '🔊'); }
function hero(k, en, ml, pEn, pMl) {
  return k.h('div', { class: 'community-hero' }, k.h('div', { class: 'community-say' }, say(k, `${en}. ${pEn}`, `${ml}. ${pMl}`)), k.h('h2', null, k.t(en, ml)), k.h('p', null, k.t(pEn, pMl)));
}
async function hamletPicker(k, onChange, { includeAll = true } = {}) {
  const hs = await k.api.get('/my-hamlets');
  const sel = k.h('select', { class: 'input', style: { maxWidth: '320px' }, onchange: () => onChange(sel.value || null) },
    includeAll && hs.length > 1 ? k.h('option', { value: '' }, k.t('All my hamlets', 'എന്റെ എല്ലാ ഊരുകളും')) : null,
    hs.map((x) => k.h('option', { value: x.id }, k.t(x.name, x.name_ml) + (x.member ? ' ★' : ''))));
  return { sel, hamlets: hs };
}

// =====================================================================
// FAMILY — guardian home & consent centre
// =====================================================================
async function family(el, k) {
  setup(k);
  el.append(k.ui.loading());
  const data = await k.api.get('/family');
  el.replaceChildren();
  const kids = data.members.filter((m) => !m.self);
  const me = data.members.find((m) => m.self);
  el.append(hero(k, 'Your family, your data', 'നിങ്ങളുടെ കുടുംബം, നിങ്ങളുടെ വിവരങ്ങൾ',
    'See how your children are learning. You decide which agency can see what — and you can change it any time.',
    'കുട്ടികളുടെ പഠനം കാണാം. ഏത് ഏജൻസി എന്ത് കാണണമെന്ന് നിങ്ങളാണ് തീരുമാനിക്കുന്നത് — എപ്പോൾ വേണമെങ്കിലും മാറ്റാം.'));
  if (data._offline) el.append(k.ui.badge(k.t('Offline copy', 'ഓഫ്‌ലൈൻ പകർപ്പ്'), 'warn'));
  const list = kids.length ? kids : data.members;
  if (!list.length) { el.append(k.ui.empty(k.t('No family members are linked to your account yet. Please ask the facilitator.', 'നിങ്ങളുടെ അക്കൗണ്ടിൽ കുടുംബാംഗങ്ങളെ ചേർത്തിട്ടില്ല. ഫെസിലിറ്റേറ്ററോട് ചോദിക്കുക.'))); return; }
  for (const m of list) el.append(memberCard(k, m, data.scopes));
  if (me && kids.length && me.agencies.some((a) => a.consent)) {
    el.append(k.ui.section(k.t('Your own consents', 'നിങ്ങളുടെ സ്വന്തം സമ്മതങ്ങൾ'), memberCard(k, me, data.scopes, true)));
  }
  el.append(k.ui.card({ tone: 'info', title: k.t('Your rights', 'നിങ്ങളുടെ അവകാശങ്ങൾ'), body: k.h('ul', null,
    k.h('li', null, k.t('Saying "no" or withdrawing never stops your child\'s classes.', '"ഇല്ല" എന്നു പറഞ്ഞാലും പിൻവലിച്ചാലും കുട്ടിയുടെ ക്ലാസുകൾ നിലയ്ക്കില്ല.')),
    k.h('li', null, k.t('For children under 18, only a parent or guardian can give consent (DPDP Act 2023).', '18 വയസ്സിൽ താഴെയുള്ളവർക്ക് രക്ഷിതാവിനു മാത്രമേ സമ്മതം നൽകാനാകൂ (DPDP നിയമം 2023).')),
    k.h('li', null, k.t('Donors and government see only numbers, never names.', 'സംഭാവന നൽകുന്നവരും സർക്കാരും എണ്ണം മാത്രമേ കാണൂ, പേരുകളല്ല.')),
    k.h('li', null, k.t('Every change is recorded and cannot be secretly altered.', 'ഓരോ മാറ്റവും രേഖപ്പെടുത്തുന്നു; രഹസ്യമായി മാറ്റാനാകില്ല.'))) }));
}

function memberCard(k, m, scopes, compact) {
  const { h } = k;
  const avatar = m.self ? '🙂' : m.gender === 'F' ? (m.minor ? '👧' : '👩') : (m.minor ? '👦' : '👨');
  const att = m.attendance;
  const activeEnr = m.enrolments.filter((e) => e.status === 'active');
  const summaryEn = `${m.first_name}. ${activeEnr.length} classes. ${att ? `Attendance ${att.pct} percent.` : ''} ${m.passport_total} achievements.`;
  const summaryMl = `${m.first_name}. ${activeEnr.length} ക്ലാസുകൾ. ${att ? `ഹാജർ ${att.pct} ശതമാനം.` : ''} ${m.passport_total} നേട്ടങ്ങൾ.`;
  const card = h('div', { class: 'community-kid' });
  card.append(h('div', { class: 'community-kid-head' }, h('div', { class: 'community-avatar', 'aria-hidden': 'true' }, avatar),
    h('div', { style: { flex: 1 } }, h('div', { class: 'community-kid-name' }, m.name),
      h('div', { class: 'small muted' }, [m.age != null ? k.t(`${m.age} years`, `${m.age} വയസ്സ്`) : null, m.school_class ? k.t(`Class ${m.school_class}`, `ക്ലാസ് ${m.school_class}`) : null, m.hamlet ? k.t(m.hamlet.name, m.hamlet.name_ml) : null].filter(Boolean).join(' · '))),
    say(k, summaryEn, summaryMl)));
  if (!compact) {
    card.append(h('div', { class: 'community-bigstats' },
      h('div', { class: 'community-big' + (att && att.pct < 60 ? ' warn' : '') }, h('b', null, att ? att.pct + '%' : '—'), h('span', null, k.t('Attendance', 'ഹാജർ'), att ? ` (${att.present}/${att.sessions})` : '')),
      h('div', { class: 'community-big' }, h('b', null, String(activeEnr.length)), h('span', null, k.t('Classes', 'ക്ലാസുകൾ'))),
      h('div', { class: 'community-big' }, h('b', null, String(m.passport_total)), h('span', null, k.t('Achievements', 'നേട്ടങ്ങൾ')))));
    if (activeEnr.length) card.append(h('div', { class: 'stack small' }, activeEnr.slice(0, 5).map((e) => h('div', { class: 'community-row' }, h('span', { class: 'community-dot', style: { background: e.agency_colour || '#999' } }), h('b', null, k.t(e.title, e.title_ml || e.title)), h('span', { class: 'muted' }, `· ${e.agency_name || ''}${Array.isArray(e.schedule) ? ' · ' + e.schedule.join(', ') : ''}`)))));
    if (m.passport.length) {
      card.append(h('details', { style: { marginTop: '10px' } }, h('summary', null, '🏅 ' + k.t('Recent achievements', 'സമീപകാല നേട്ടങ്ങൾ')),
        h('ul', null, m.passport.map((p) => h('li', null, h('b', null, p.title), h('span', { class: 'muted small' }, ` · ${fmtDate(p.issued_at, k)}${p.agency_name ? ' · ' + p.agency_name : ''}`))))));
    }
  }
  card.append(h('h3', { style: { marginTop: '14px' } }, '🔐 ' + k.t('Who can see ' + m.first_name + '\'s information?', m.first_name + '-ന്റെ വിവരങ്ങൾ ആർക്കൊക്കെ കാണാം?')));
  if (!m.can_manage_consent) card.append(h('p', { class: 'small muted' }, k.t('Your parent or guardian manages these permissions.', 'ഈ അനുമതികൾ നിങ്ങളുടെ രക്ഷിതാവാണ് കൈകാര്യം ചെയ്യുന്നത്.')));
  for (const a of m.agencies) card.append(consentRow(k, m, a));
  return card;
}

function consentRow(k, m, a) {
  const { h } = k;
  const on = !!a.consent;
  const granted = new Set(on ? a.consent.scopes : []);
  const scopeKeys = ['profile', 'progress', 'contact', 'research'].concat(m.minor ? ['wellbeing'] : ['wellbeing', 'employment']);
  const row = h('div', { class: 'community-consent ' + (on ? 'on' : 'off') });
  const explainEn = on ? `${a.name} can see: ${[...granted].map((s) => SCOPE_TXT[s] ? SCOPE_TXT[s][1] : s).join(', ')}.` : `${a.name} cannot see ${m.first_name}'s information.`;
  const explainMl = on ? `${a.name} കാണാവുന്നത്: ${[...granted].map((s) => SCOPE_TXT[s] ? SCOPE_TXT[s][2] : s).join(', ')}.` : `${a.name}-ന് ${m.first_name}-ന്റെ വിവരങ്ങൾ കാണാനാകില്ല.`;
  row.append(h('div', { class: 'community-between' },
    h('div', null, h('div', { class: 'community-row' }, h('span', { class: 'community-dot', style: { background: a.colour || '#999' } }), h('b', null, a.name)),
      h('div', { class: 'small muted' }, (a.services || []).map((s) => k.t(TRACK[s]?.[0] || s, TRACK[s]?.[1])).join(' · '), a.enrolled ? ' · ' + k.t('enrolled', 'ചേർന്നിട്ടുണ്ട്') : '')),
    h('div', { class: 'community-row' }, k.ui.badge(on ? k.t('Allowed', 'അനുവദിച്ചു') : k.t('Not allowed', 'അനുവദിച്ചിട്ടില്ല'), on ? 'good' : ''), say(k, explainEn, explainMl))));
  const pending = new Set(granted);
  const chips = h('div');
  const drawChips = () => chips.replaceChildren(...scopeKeys.map((s) => {
    const tx = SCOPE_TXT[s];
    const yes = pending.has(s);
    return h('button', { type: 'button', class: 'community-scope' + (yes ? ' yes' : ''), disabled: !m.can_manage_consent, title: k.t(tx[3], tx[4]), 'aria-pressed': String(yes),
      onclick: () => {
        if (yes) { pending.delete(s); if (s === 'profile') pending.clear(); } else pending.add(s);
        if (pending.size) pending.add('profile'); // nothing else makes sense without the basic profile
        drawChips();
        save.style.display = [...pending].sort().join() === [...granted].sort().join() ? 'none' : '';
      } }, tx[0], ' ', k.t(tx[1], tx[2]), yes ? ' ✓' : '');
  }));
  row.append(chips);
  const save = k.ui.button(k.t('Save these choices', 'ഈ തീരുമാനങ്ങൾ സേവ് ചെയ്യുക'), async () => {
    if (!pending.size) { if (on) await withdraw(); return; }
    const r = await k.core.post('/consents', { person_id: m.id, agency_id: a.id, scopes: [...pending] });
    k.toast(r && r.queued ? k.t('Saved offline — will be sent later.', 'ഓഫ്‌ലൈനായി സേവ് ചെയ്തു.') : k.t('Permission updated.', 'അനുമതി പുതുക്കി.'), 'good');
    k.speak(k.t('Permission updated', 'അനുമതി പുതുക്കി'));
    k.refresh();
  }, { tone: 'primary', small: true });
  save.style.display = 'none';
  drawChips();
  const withdraw = async () => {
    const ok = await k.ui.confirm(k.t(`Withdraw all permission for ${a.name}? They will no longer see ${m.first_name}'s information. Classes continue.`, `${a.name}-നുള്ള എല്ലാ അനുമതിയും പിൻവലിക്കണോ? ക്ലാസുകൾ തുടരും.`));
    if (!ok) return;
    const r = await k.core.post(`/consents/${a.consent.id}/revoke`);
    k.toast(r && r.queued ? k.t('Saved offline — will be sent later.', 'ഓഫ്‌ലൈനായി സേവ് ചെയ്തു.') : k.t('Permission withdrawn.', 'അനുമതി പിൻവലിച്ചു.'), 'good');
    k.speak(k.t('Permission withdrawn', 'അനുമതി പിൻവലിച്ചു'));
    k.refresh();
  };
  if (m.can_manage_consent) {
    row.append(h('div', { class: 'community-row', style: { marginTop: '8px' } }, save, on ? k.ui.button('✋ ' + k.t('Withdraw all', 'എല്ലാം പിൻവലിക്കുക'), withdraw, { tone: 'danger', small: true }) : null,
      on ? h('span', { class: 'small muted' }, k.t(`Since ${fmtDate(a.consent.granted_at, k)} · ${a.consent.method || ''}`, `${fmtDate(a.consent.granted_at, k)} മുതൽ`)) : null));
  }
  return row;
}

// =====================================================================
// NOTICE BOARD
// =====================================================================
async function notices(el, k) {
  setup(k);
  const { h } = k;
  el.append(hero(k, 'Notice board', 'അറിയിപ്പ് ബോർഡ്', 'Scholarships, hostels, camps and schemes for your hamlet. Tap 🔊 to listen.', 'നിങ്ങളുടെ ഊരിനുള്ള സ്കോളർഷിപ്പ്, ഹോസ്റ്റൽ, ക്യാമ്പ്, പദ്ധതികൾ. കേൾക്കാൻ 🔊 അമർത്തുക.'));
  let hamlet = k.params.hamlet || null, cat = k.params.cat || null;
  const { sel, hamlets } = await hamletPicker(k, (v) => { hamlet = v; load(); });
  if (hamlet) sel.value = hamlet;
  const chips = h('div', { class: 'community-chipbar', role: 'tablist' });
  const renderChips = () => chips.replaceChildren(
    h('button', { class: 'community-chip' + (!cat ? ' on' : ''), onclick: () => { cat = null; renderChips(); load(); } }, k.t('All', 'എല്ലാം')),
    Object.entries(CATS).map(([key, [ic, en, ml]]) => h('button', { class: 'community-chip' + (cat === key ? ' on' : ''), onclick: () => { cat = key; renderChips(); load(); } }, ic + ' ' + k.t(en, ml))));
  renderChips();
  const postable = hamlets.filter((x) => x.can_post);
  el.append(h('div', { class: 'community-row', style: { marginBottom: '10px' } }, hamlets.length > 1 ? sel : null,
    postable.length ? k.ui.button('➕ ' + k.t('Post a notice', 'അറിയിപ്പ് ഇടുക'), () => noticeForm(k, postable, null, load), { tone: 'primary' }) : null), chips);
  const list = h('div');
  el.append(list);
  async function load() {
    list.replaceChildren(k.ui.loading());
    const qs = new URLSearchParams(); if (hamlet) qs.set('hamlet_id', hamlet); if (cat) qs.set('category', cat);
    const rows = await k.api.get('/notices?' + qs);
    list.replaceChildren();
    if (!rows.length) { list.append(k.ui.empty(k.t('No notices right now.', 'ഇപ്പോൾ അറിയിപ്പുകളില്ല.'))); return; }
    for (const n of rows) list.append(noticeCard(k, n, hamlets.length > 1 && !hamlet, () => noticeForm(k, postable, n, load), load));
  }
  await load();
}

function noticeCard(k, n, showHamlet, onEdit, reload) {
  const { h } = k;
  const [ic] = CATS[n.category] || CATS.general;
  const title = k.t(n.title, n.title_ml || n.title), body = k.t(n.body, n.body_ml || n.body), how = k.t(n.how_to, n.how_to_ml || n.how_to);
  const audio = k.lang === 'ml' && n.audio_ml ? n.audio_ml : n.audio_en;
  const days = n.deadline ? Math.ceil((new Date(n.deadline) - Date.now()) / 86400e3) : null;
  return h('article', { class: 'community-notice' + (n.pinned ? ' pinned' : '') },
    h('div', { class: 'community-between' }, h('div', { class: 'community-row', style: { alignItems: 'flex-start', flexWrap: 'nowrap' } }, h('span', { class: 'community-cat', 'aria-hidden': 'true' }, ic),
      h('div', null, h('h3', { style: { margin: 0 } }, n.pinned ? '📌 ' : '', title),
        h('div', { class: 'small muted' }, [n.agency_name, showHamlet ? k.t(n.hamlet_name, n.hamlet_name_ml) : null, fmtDate(n.posted_at, k)].filter(Boolean).join(' · ')))),
    say(k, audio, k.lang === 'ml' ? 'ml' : 'en')),
    h('p', { style: { marginTop: '8px' } }, body),
    how ? h('div', { class: 'community-howto small' }, h('b', null, '👉 ' + k.t('What to do', 'ചെയ്യേണ്ടത്') + ': '), how) : null,
    h('div', { class: 'community-row small', style: { marginTop: '8px' } },
      n.deadline ? k.ui.badge((days < 0 ? k.t('Closed', 'അവസാനിച്ചു') : k.t(`Last date ${fmtDate(n.deadline, k)}`, `അവസാന തീയതി ${fmtDate(n.deadline, k)}`)), days != null && days >= 0 && days <= 10 ? 'warn' : 'info') : null,
      n.date_is_demo ? h('span', { class: 'community-demo' }, k.t('DEMO date — confirm at office', 'ഡെമോ തീയതി — ഓഫീസിൽ ഉറപ്പാക്കുക')) : null,
      n.contact ? h('span', { class: 'muted' }, '☎ ' + n.contact) : null,
      n.can_edit ? k.ui.button(k.t('Edit', 'തിരുത്തുക'), onEdit, { small: true, tone: 'ghost' }) : null,
      n.can_edit ? k.ui.button(k.t('Remove', 'നീക്കുക'), async () => { if (await k.ui.confirm(k.t('Remove this notice?', 'ഈ അറിയിപ്പ് നീക്കണോ?'))) { await k.api.del('/notices/' + n.id); reload(); } }, { small: true, tone: 'ghost' }) : null));
}

function noticeForm(k, postable, n, done) {
  const fields = [
    n ? null : { name: 'hamlet_ids', label: k.t('Hamlets (only where your agency works)', 'ഊരുകൾ (നിങ്ങളുടെ ഏജൻസി പ്രവർത്തിക്കുന്നവ മാത്രം)'), type: 'multiselect', options: postable.map((x) => ({ value: x.id, label: k.t(x.name, x.name_ml) })), value: postable.length === 1 ? [postable[0].id] : [] },
    { name: 'category', label: k.t('Type', 'തരം'), type: 'select', required: true, value: n?.category || 'general', options: Object.entries(CATS).map(([v, [ic, en, ml]]) => ({ value: v, label: ic + ' ' + k.t(en, ml) })) },
    { name: 'title', label: 'Title (English)', required: true, value: n?.title },
    { name: 'title_ml', label: 'തലക്കെട്ട് (മലയാളം)', value: n?.title_ml },
    { name: 'body', label: 'Message (English) — short, simple words', type: 'textarea', required: true, value: n?.body },
    { name: 'body_ml', label: 'സന്ദേശം (മലയാളം)', type: 'textarea', value: n?.body_ml },
    { name: 'how_to', label: 'What should families do? (English)', type: 'textarea', value: n?.how_to },
    { name: 'how_to_ml', label: 'കുടുംബങ്ങൾ എന്ത് ചെയ്യണം? (മലയാളം)', type: 'textarea', value: n?.how_to_ml },
    { name: 'deadline', label: k.t('Last date (optional)', 'അവസാന തീയതി'), type: 'date', value: n?.deadline },
    { name: 'contact', label: k.t('Contact', 'ബന്ധപ്പെടുക'), value: n?.contact },
    { name: 'pinned', label: '📌 ' + k.t('Pin to top', 'മുകളിൽ പിൻ ചെയ്യുക'), type: 'checkbox', value: !!n?.pinned },
    { name: 'date_is_demo', label: k.t('Date is a demo/unconfirmed date', 'തീയതി സ്ഥിരീകരിച്ചിട്ടില്ല'), type: 'checkbox', value: n ? !!n.date_is_demo : false },
  ].filter(Boolean);
  const m = k.ui.modal(n ? k.t('Edit notice', 'അറിയിപ്പ് തിരുത്തുക') : k.t('Post a notice', 'അറിയിപ്പ് ഇടുക'), k.ui.form(fields, async (v) => {
    if (!n && (!v.hamlet_ids || !v.hamlet_ids.length)) throw new Error(k.t('Choose at least one hamlet', 'ഒരു ഊരെങ്കിലും തിരഞ്ഞെടുക്കുക'));
    if (n) await k.api.put('/notices/' + n.id, v); else await k.api.post('/notices', v);
    m.close(); k.toast(k.t('Notice saved', 'അറിയിപ്പ് സേവ് ചെയ്തു'), 'good'); done();
  }, { submitLabel: k.t('Publish', 'പ്രസിദ്ധീകരിക്കുക') }));
}

// =====================================================================
// CULTURE — archive, contribute, review
// =====================================================================
async function culture(el, k) {
  setup(k);
  const { h } = k;
  el.append(hero(k, 'Our culture, our archive', 'നമ്മുടെ സംസ്കാരം, നമ്മുടെ ശേഖരം',
    'Stories, songs and knowledge shared by elders and youth. The contributor decides who can see each item.',
    'മുതിർന്നവരും യുവാക്കളും പങ്കുവച്ച കഥകൾ, പാട്ടുകൾ, അറിവുകൾ. ഓരോന്നും ആർക്കു കാണാമെന്ന് സംഭാവന ചെയ്തയാൾ തീരുമാനിക്കുന്നു.'));
  const external = ['donor', 'employer', 'govt_viewer'].includes(k.user.role);
  const tabs = [{ id: 'browse', label: '📚 ' + k.t('Browse', 'കാണുക'), render: (x) => browse(x, k) }];
  if (!external) tabs.push({ id: 'share', label: '➕ ' + k.t('Share', 'പങ്കുവയ്ക്കുക'), render: (x) => contribute(x, k) }, { id: 'mine', label: '🗂 ' + k.t('My items', 'എന്റേത്'), render: (x) => mine(x, k) });
  if (['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'teacher'].includes(k.user.role)) tabs.push({ id: 'review', label: '✅ ' + k.t('Review', 'അവലോകനം'), render: (x) => review(x, k) });
  tabs.push({ id: 'credits', label: '🏅 ' + k.t('Contributors', 'സംഭാവകർ'), render: (x) => credits(x, k) });
  el.append(k.ui.tabs(tabs, k.params.tab || 'browse'));
}

function itemTile(k, c, onOpen) {
  const { h } = k;
  const [ic, en, ml] = KINDS[c.kind] || KINDS.story;
  const snippet = String(k.lang === 'ml' && c.body_ml ? c.body_ml : c.body).slice(0, 110);
  return h('div', { class: 'community-item', tabindex: 0, role: 'button', onclick: onOpen, onkeydown: (e) => { if (e.key === 'Enter') onOpen(); } },
    h('div', { class: 'community-between' }, h('span', { style: { fontSize: '1.6rem' } }, ic), h('span', { class: 'community-lic ' + c.licence }, c.licence === 'community' ? '🔒 ' + k.t('Hamlet only', 'ഊരിനു മാത്രം') : c.licence === 'public' ? k.t('Public', 'പൊതു') : 'CC BY-NC')),
    h('div', { class: 't' }, k.t(c.title, c.title_ml || c.title)),
    h('div', { class: 'small muted' }, `${k.t(en, ml)} · ${c.language} · ${k.t(c.hamlet_name, c.hamlet_name_ml)}`),
    h('div', { class: 'small', style: { color: 'var(--ink-2)' } }, snippet + (snippet.length >= 110 ? '…' : '')),
    h('div', { class: 'small', style: { marginTop: 'auto' } }, '✍️ ' + (c.credit_as || c.contributor_name), c.status !== 'published' ? [' ', k.ui.badge(statusLabel(k, c.status), statusTone(c.status))] : null));
}
const statusLabel = (k, s) => ({ submitted: k.t('Submitted', 'സമർപ്പിച്ചു'), reviewed: k.t('Reviewed', 'പരിശോധിച്ചു'), published: k.t('Published', 'പ്രസിദ്ധീകരിച്ചു'), returned: k.t('Returned', 'തിരിച്ചയച്ചു') }[s] || s);
const statusTone = (s) => ({ submitted: 'info', reviewed: 'warn', published: 'good', returned: 'bad' }[s] || '');

function openItem(k, c, after) {
  const { h } = k;
  const [ic, en, ml] = KINDS[c.kind] || KINDS.story;
  const body = h('div', { class: 'stack' },
    h('div', { class: 'community-row small muted' }, ic, k.t(en, ml), '·', c.language, '·', k.t(c.hamlet_name, c.hamlet_name_ml), h('span', { class: 'community-lic ' + c.licence }, k.t(...LIC[c.licence]))),
    h('div', { class: 'community-row' }, say(k, `${c.title}. ${c.body}`, 'en'), c.body_ml ? say(k, `${c.title_ml || ''}. ${c.body_ml}`, 'ml') : null, h('span', { class: 'small muted' }, k.t('Listen in English / Malayalam', 'ഇംഗ്ലീഷ് / മലയാളം കേൾക്കുക'))),
    h('div', { class: 'community-lyrics' }, c.body),
    c.body_ml ? h('div', { class: 'community-lyrics ml' }, c.body_ml) : null,
    k.ui.kv([[k.t('Contributed by', 'സംഭാവന'), c.credit_as || c.contributor_name], [k.t('Status', 'സ്ഥിതി'), statusLabel(k, c.status)], c.published_at ? [k.t('Published', 'പ്രസിദ്ധീകരിച്ചത്'), fmtDate(c.published_at, k)] : null, c.reviewed_by_name ? [k.t('Reviewed by', 'പരിശോധിച്ചത്'), c.reviewed_by_name] : null, c.review_note ? [k.t('Reviewer note', 'കുറിപ്പ്'), c.review_note] : null, c.credits ? [k.t('Credits', 'ക്രെഡിറ്റ്'), '🏅 ' + c.credits] : null]),
    c.licence === 'community' ? h('p', { class: 'small muted' }, '🔒 ' + k.t('Community data sovereignty: this item stays with the hamlet. It is never shown to donors, employers or other hamlets.', 'സാമൂഹിക വിവര പരമാധികാരം: ഇത് ഊരിൽ തന്നെ നിൽക്കുന്നു. മറ്റുള്ളവർക്ക് കാണിക്കില്ല.')) : null,
    h('div', { class: 'row' },
      c.mine && ['returned', 'submitted'].includes(c.status) ? k.ui.button(k.t('Edit & resubmit', 'തിരുത്തി വീണ്ടും അയയ്ക്കുക'), () => { m.close(); contributeModal(k, c, after); }, { tone: 'primary' }) : null,
      c.mine ? licencePicker(k, c, after, () => m.close()) : null,
      c.can_review && ['submitted', 'reviewed'].includes(c.status) ? reviewButtons(k, c, () => { m.close(); after && after(); }) : null));
  const m = k.ui.modal(k.t(c.title, c.title_ml || c.title), body);
}
function licencePicker(k, c, after, close) {
  const sel = k.h('select', { class: 'input', style: { maxWidth: '260px' } }, Object.entries(LIC).map(([v, l]) => k.h('option', { value: v, selected: v === c.licence }, k.t(...l))));
  return k.h('div', { class: 'community-row' }, k.h('span', { class: 'small' }, k.t('Who can see it:', 'ആർക്കു കാണാം:')), sel, k.ui.button(k.t('Change', 'മാറ്റുക'), async () => { await k.api.post(`/content/${c.id}/licence`, { licence: sel.value }); k.toast(k.t('Updated', 'പുതുക്കി'), 'good'); close(); after && after(); }, { small: true }));
}
function reviewButtons(k, c, after) {
  const note = k.h('input', { class: 'input', placeholder: k.t('Note to contributor (required to return)', 'സംഭാവകന് കുറിപ്പ്') });
  const go = (decision) => async () => { await k.api.post(`/content/${c.id}/review`, { decision, note: note.value }); k.toast(k.t('Done', 'ചെയ്തു'), 'good'); after(); };
  return k.h('div', { class: 'stack', style: { width: '100%' } }, note, k.h('div', { class: 'row' },
    c.status === 'submitted' ? k.ui.button('👁 ' + k.t('Mark reviewed', 'പരിശോധിച്ചു'), go('review'), { small: true }) : null,
    k.ui.button('✅ ' + k.t('Publish', 'പ്രസിദ്ധീകരിക്കുക'), go('publish'), { tone: 'primary', small: true }),
    k.ui.button('↩ ' + k.t('Return with note', 'കുറിപ്പോടെ തിരിച്ചയയ്ക്കുക'), go('return'), { tone: 'ghost', small: true })),
    k.h('p', { class: 'small muted' }, k.t('Check: original work (not film/copyrighted songs), elders agree to share, no medicine dosages, licence matches the community\'s wish.', 'പരിശോധിക്കുക: സ്വന്തം സൃഷ്ടി, മുതിർന്നവരുടെ സമ്മതം, മരുന്ന് അളവുകൾ ഇല്ല, ലൈസൻസ് ശരി.')));
}

async function browse(el, k) {
  const { h } = k;
  let kind = null, q = '';
  const chips = h('div', { class: 'community-chipbar' });
  const search = h('input', { class: 'input', type: 'search', placeholder: k.t('Search stories, songs, languages…', 'തിരയുക…'), style: { maxWidth: '320px' } });
  const grid = h('div');
  const render = () => chips.replaceChildren(h('button', { class: 'community-chip' + (!kind ? ' on' : ''), onclick: () => { kind = null; render(); load(); } }, k.t('All', 'എല്ലാം')),
    Object.entries(KINDS).map(([v, [ic, en, ml]]) => h('button', { class: 'community-chip' + (kind === v ? ' on' : ''), onclick: () => { kind = v; render(); load(); } }, ic + ' ' + k.t(en, ml))));
  render();
  let tmr; search.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { q = search.value; load(); }, 250); });
  const stats = await k.api.get('/content/stats');
  el.append(k.ui.grid([k.ui.stat(k.t('Published', 'പ്രസിദ്ധീകരിച്ചവ'), stats.published), k.ui.stat(k.t('Languages', 'ഭാഷകൾ'), stats.by_language.length), k.ui.stat(k.t('Hamlet-only items', 'ഊരിനു മാത്രം'), stats.community_only, k.t('kept within the community', 'സമൂഹത്തിനുള്ളിൽ')), k.ui.stat(k.t('Awaiting review', 'അവലോകനം കാത്ത്'), stats.pending)], 150), h('div', { class: 'community-row', style: { margin: '12px 0 6px' } }, search), chips, grid);
  async function load() {
    grid.replaceChildren(k.ui.loading());
    const qs = new URLSearchParams({ status: 'published' }); if (kind) qs.set('kind', kind); if (q) qs.set('q', q);
    const rows = await k.api.get('/content?' + qs);
    grid.replaceChildren(rows.length ? k.ui.grid(rows.map((c) => itemTile(k, c, () => openItem(k, c, load))), 240) : k.ui.empty(k.t('Nothing found.', 'ഒന്നും കണ്ടെത്തിയില്ല.')));
  }
  await load();
}

async function mine(el, k) {
  const rows = (await k.api.get('/content')).filter((c) => c.mine);
  if (!rows.length) { el.append(k.ui.empty(k.t('You have not shared anything yet. Tap "Share" to add a story or song.', 'നിങ്ങൾ ഇതുവരെ ഒന്നും പങ്കുവച്ചിട്ടില്ല.'))); return; }
  el.append(k.ui.grid(rows.map((c) => itemTile(k, c, () => openItem(k, c, () => k.refresh()))), 240));
}

async function review(el, k) {
  const rows = await k.api.get('/content?queue=1');
  if (!rows.length) { el.append(k.ui.empty(k.t('Nothing waiting for review. 🎉', 'അവലോകനത്തിന് ഒന്നുമില്ല.'))); return; }
  el.append(k.ui.table([
    { key: 'title', label: k.t('Title', 'തലക്കെട്ട്'), render: (r) => `${(KINDS[r.kind] || KINDS.story)[0]} ${r.title}` },
    { key: 'hamlet_name', label: k.t('Hamlet', 'ഊര്') },
    { key: 'credit_as', label: k.t('Contributor', 'സംഭാവകൻ') },
    { key: 'licence', label: k.t('Licence', 'ലൈസൻസ്'), render: (r) => k.h('span', { class: 'community-lic ' + r.licence }, k.t(...LIC[r.licence])) },
    { key: 'status', label: k.t('Status', 'സ്ഥിതി'), render: (r) => k.ui.badge(statusLabel(k, r.status), statusTone(r.status)) },
    { key: 'submitted_at', label: k.t('Submitted', 'തീയതി'), render: (r) => fmtDate(r.submitted_at, k) },
  ], rows, { onRow: (r) => openItem(k, r, () => k.refresh()) }));
}

async function credits(el, k) {
  const s = await k.api.get('/content/stats');
  el.append(k.ui.grid([
    k.ui.card({ title: '🏅 ' + k.t('Top contributors', 'മുൻനിര സംഭാവകർ'), body: k.ui.table([{ key: 'name', label: k.t('Name', 'പേര്') }, { key: 'hamlet', label: k.t('Hamlet', 'ഊര്') }, { key: 'items', label: k.t('Items', 'എണ്ണം') }, { key: 'credits', label: k.t('Credits', 'ക്രെഡിറ്റ്') }], s.credits) }),
    k.ui.card({ title: '🗣 ' + k.t('Languages in the archive', 'ശേഖരത്തിലെ ഭാഷകൾ'), body: k.ui.bars(s.by_language) }),
    k.ui.card({ title: '📚 ' + k.t('By type', 'തരം അനുസരിച്ച്'), body: k.ui.bars(s.by_kind.map((x) => ({ label: k.t(...(KINDS[x.label] || [0, x.label, x.label]).slice(1)), value: x.value }))) }),
  ], 280));
}

async function contribute(el, k) {
  el.append(k.h('p', null, k.t('Share something from your hamlet. It goes to a reviewer first. You choose who can see it, and you can change that later.', 'നിങ്ങളുടെ ഊരിൽ നിന്ന് എന്തെങ്കിലും പങ്കുവയ്ക്കൂ. ആദ്യം ഒരു അവലോകകൻ കാണും. ആർക്കു കാണാമെന്ന് നിങ്ങൾ തീരുമാനിക്കുന്നു.')));
  el.append(await contributeForm(k, null, () => k.go('#/m/community/culture?tab=mine')));
}
async function contributeModal(k, c, after) { const m = k.ui.modal(k.t('Edit & resubmit', 'തിരുത്തി അയയ്ക്കുക'), await contributeForm(k, c, () => { m.close(); after && after(); })); }
async function contributeForm(k, c, done) {
  const hs = await k.api.get('/my-hamlets');
  const LANGS = ['Muthuvan', 'Irula', 'Paniya', 'Kurichiya', 'Kanikkar', 'Cholanaikkan', 'Mannan', 'Malayalam', 'Kattunaikan', 'Adiya', 'Other'];
  const fields = [
    c ? null : { name: 'hamlet_id', label: k.t('Hamlet', 'ഊര്'), type: 'select', required: true, value: (hs.find((x) => x.member) || hs[0] || {}).id, options: hs.map((x) => ({ value: x.id, label: k.t(x.name, x.name_ml) })) },
    c ? null : { name: 'kind', label: k.t('What is it?', 'ഇത് എന്താണ്?'), type: 'select', required: true, value: 'story', options: Object.entries(KINDS).map(([v, [ic, en, ml]]) => ({ value: v, label: ic + ' ' + k.t(en, ml) })) },
    c ? null : { name: 'language', label: k.t('Language', 'ഭാഷ'), type: 'select', options: LANGS },
    { name: 'title', label: k.t('Title', 'തലക്കെട്ട്'), required: true, value: c?.title },
    { name: 'title_ml', label: 'തലക്കെട്ട് (മലയാളം)', value: c?.title_ml },
    { name: 'body', label: k.t('Words / lyrics / steps', 'വാക്കുകൾ / വരികൾ / രീതി'), type: 'textarea', required: true, value: c?.body },
    { name: 'body_ml', label: k.t('Malayalam version (optional)', 'മലയാളം (ഐച്ഛികം)'), type: 'textarea', value: c?.body_ml },
    c ? null : { name: 'contributor_name', label: k.t('Contributor (elder / youth / group)', 'സംഭാവന ചെയ്തയാൾ'), placeholder: k.t('e.g. Chellamma (elder)', 'ഉദാ: ചെല്ലമ്മ') },
    c ? null : { name: 'contributor_kind', label: k.t('Contributor is', 'സംഭാവകൻ'), type: 'select', value: 'elder', options: [{ value: 'elder', label: k.t('Elder', 'മുതിർന്നയാൾ') }, { value: 'youth', label: k.t('Youth', 'യുവാവ്/യുവതി') }, { value: 'child', label: k.t('Child', 'കുട്ടി') }, { value: 'group', label: k.t('Group', 'സംഘം') }] },
    { name: 'credit_as', label: k.t('Credit as (how the name should appear)', 'പേര് എങ്ങനെ കാണിക്കണം'), value: c?.credit_as },
    { name: 'licence', label: k.t('Who may see it?', 'ആർക്കു കാണാം?'), type: 'select', required: true, value: c?.licence || 'community', options: Object.entries(LIC).map(([v, l]) => ({ value: v, label: k.t(...l) })) },
    { name: 'original_confirmed', label: k.t('This is our own work — not copied from films, books or other artists. The elders agree to share it.', 'ഇത് ഞങ്ങളുടെ സ്വന്തം സൃഷ്ടിയാണ് — സിനിമ/പുസ്തകങ്ങളിൽ നിന്ന് പകർത്തിയതല്ല. മുതിർന്നവർ സമ്മതിക്കുന്നു.'), type: 'checkbox', value: !!c },
  ].filter(Boolean);
  return k.ui.form(fields, async (v) => {
    if (!v.original_confirmed) throw new Error(k.t('Please tick the "our own work" box.', '"സ്വന്തം സൃഷ്ടി" ടിക്ക് ചെയ്യുക.'));
    const r = c ? await k.api.put('/content/' + c.id, v) : await k.api.post('/content', v);
    k.toast(r && r.queued ? k.t('Saved on this device — will be sent later.', 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു.') : k.t('Thank you! Sent for review.', 'നന്ദി! അവലോകനത്തിന് അയച്ചു.'), 'good');
    k.speak(k.t('Thank you. Sent for review.', 'നന്ദി. അവലോകനത്തിന് അയച്ചു.'));
    done();
  }, { submitLabel: k.t('Send for review', 'അവലോകനത്തിന് അയയ്ക്കുക') });
}

// =====================================================================
// OORUKOOTTAM — meetings
// =====================================================================
async function meetings(el, k) {
  setup(k);
  const { h } = k;
  el.append(hero(k, 'Oorukoottam', 'ഊരുകൂട്ടം', 'Hamlet assembly: dates, agenda, minutes and who will do what. Anyone can suggest an agenda item.', 'ഊരുകൂട്ടം: തീയതി, അജണ്ട, മിനിറ്റ്സ്, ആര് എന്ത് ചെയ്യും. ആർക്കും അജണ്ട നിർദ്ദേശിക്കാം.'));
  let hamlet = k.params.hamlet || null;
  const { sel, hamlets } = await hamletPicker(k, (v) => { hamlet = v; load(); });
  const postable = hamlets.filter((x) => x.can_post);
  el.append(h('div', { class: 'community-row', style: { marginBottom: '12px' } }, hamlets.length > 1 ? sel : null,
    postable.length ? k.ui.button('📅 ' + k.t('Schedule a meeting', 'യോഗം നിശ്ചയിക്കുക'), () => {
      const m = k.ui.modal(k.t('Schedule Oorukoottam', 'ഊരുകൂട്ടം നിശ്ചയിക്കുക'), k.ui.form([
        { name: 'hamlet_id', label: k.t('Hamlet', 'ഊര്'), type: 'select', required: true, value: hamlet || postable[0].id, options: postable.map((x) => ({ value: x.id, label: k.t(x.name, x.name_ml) })) },
        { name: 'title', label: 'Title', required: true, value: 'Oorukoottam' }, { name: 'title_ml', label: 'തലക്കെട്ട്', value: 'ഊരുകൂട്ടം' },
        { name: 'date', label: k.t('Date', 'തീയതി'), type: 'date', required: true }, { name: 'time', label: k.t('Time', 'സമയം'), type: 'time', value: '10:00' },
        { name: 'venue', label: k.t('Venue', 'സ്ഥലം'), value: 'Community hall' },
        { name: 'agenda', label: k.t('Agenda (one per line)', 'അജണ്ട (ഓരോ വരിയിൽ ഒന്ന്)'), type: 'textarea' },
      ], async (v) => { await k.api.post('/meetings', v); m.close(); k.toast(k.t('Meeting scheduled', 'യോഗം നിശ്ചയിച്ചു'), 'good'); load(); }));
    }, { tone: 'primary' }) : null));
  const list = h('div');
  el.append(list);
  async function load() {
    list.replaceChildren(k.ui.loading());
    const rows = await k.api.get('/meetings' + (hamlet ? '?hamlet_id=' + hamlet : ''));
    const upcoming = rows.filter((m) => m.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
    const past = rows.filter((m) => m.status !== 'scheduled');
    list.replaceChildren(
      k.ui.section(k.t('Coming up', 'വരാനിരിക്കുന്നവ'), upcoming.length ? upcoming.map((m) => meetingCard(k, m, load, hamlets.length > 1 && !hamlet)) : k.ui.empty(k.t('No meeting scheduled.', 'യോഗം നിശ്ചയിച്ചിട്ടില്ല.'))),
      k.ui.section(k.t('Past meetings & minutes', 'കഴിഞ്ഞ യോഗങ്ങൾ, മിനിറ്റ്സ്'), past.length ? past.map((m) => meetingCard(k, m, load, hamlets.length > 1 && !hamlet)) : k.ui.empty('—')));
  }
  await load();
}

function meetingCard(k, m, reload, showHamlet) {
  const { h } = k;
  const d = new Date(m.date);
  const past = m.status !== 'scheduled';
  const minutes = k.t(m.minutes, m.minutes_ml || m.minutes);
  const agendaTxt = (m.agenda || []).map((a) => a.text).join('. ');
  const card = h('div', { class: 'community-meeting' },
    h('div', { class: 'community-row', style: { alignItems: 'flex-start', flexWrap: 'nowrap' } },
      h('div', { class: 'community-date' + (past ? ' past' : '') }, h('b', null, d.getDate()), d.toLocaleDateString(k.lang === 'ml' ? 'ml-IN' : 'en-IN', { month: 'short' })),
      h('div', { style: { flex: 1 } }, h('div', { class: 'community-between' }, h('h3', { style: { margin: 0 } }, k.t(m.title, m.title_ml || m.title)),
        say(k, `${m.title}. ${fmtDate(m.date, k)} ${m.time}. ${m.venue}. Agenda: ${agendaTxt}. ${m.minutes || ''}`, 'en')),
      h('div', { class: 'small muted' }, [showHamlet ? k.t(m.hamlet_name, m.hamlet_name_ml) : null, m.time, m.venue, m.convened_by_name].filter(Boolean).join(' · ')),
      past && m.attendance ? h('div', { class: 'small', style: { marginTop: '4px' } }, `👥 ${m.attendance} ${k.t('attended', 'പങ്കെടുത്തു')} · 👩 ${m.women_attendance || 0} ${k.t('women', 'സ്ത്രീകൾ')}`) : null)));
  card.append(h('details', { open: !past }, h('summary', null, '📋 ' + k.t('Agenda', 'അജണ്ട') + ` (${(m.agenda || []).length})`),
    h('ol', null, (m.agenda || []).map((a) => h('li', null, a.text, a.suggested ? h('span', { class: 'small muted' }, ' — ' + k.t('suggested by ', 'നിർദ്ദേശിച്ചത് ') + a.by) : null))),
    !past ? suggestBox(k, m, reload) : null));
  if (past && minutes) card.append(h('details', null, h('summary', null, '📝 ' + k.t('Minutes', 'മിനിറ്റ്സ്')), h('p', null, minutes),
    m.decisions && m.decisions.length ? [h('b', null, k.t('Decisions', 'തീരുമാനങ്ങൾ')), h('ul', null, m.decisions.map((x) => h('li', null, x)))] : null));
  if ((m.actions || []).length || (past && m.can_edit)) {
    const box = h('div', { style: { marginTop: '8px' } }, h('b', null, '✅ ' + k.t('Action items', 'ചെയ്യേണ്ടവ')));
    for (const a of m.actions) {
      const tone = a.status === 'done' ? 'good' : a.status === 'in_progress' ? 'warn' : a.due && a.due < new Date().toISOString().slice(0, 10) ? 'bad' : 'info';
      box.append(h('div', { class: 'community-action small' }, h('span', { style: { flex: 1 } }, a.status === 'done' ? '✔ ' : '○ ', k.t(a.text, a.text_ml || a.text), h('span', { class: 'muted' }, ` · ${a.owner || ''}${a.due ? ' · ' + fmtDate(a.due, k) : ''}`)),
        m.can_edit ? h('select', { class: 'input', style: { width: 'auto', padding: '2px 6px' }, onchange: async (e) => { await k.api.post(`/actions/${a.id}/status`, { status: e.target.value }); reload(); } },
          ['open', 'in_progress', 'done', 'dropped'].map((s) => h('option', { value: s, selected: s === a.status }, s.replace('_', ' ')))) : k.ui.badge(a.status.replace('_', ' '), tone)));
    }
    if (m.can_edit) box.append(k.ui.button('➕ ' + k.t('Add action', 'ചേർക്കുക'), () => {
      const mm = k.ui.modal(k.t('Add action item', 'ചെയ്യേണ്ടത് ചേർക്കുക'), k.ui.form([{ name: 'text', label: 'Action', required: true }, { name: 'text_ml', label: 'മലയാളം' }, { name: 'owner', label: k.t('Who', 'ആര്') }, { name: 'due', label: k.t('By when', 'എപ്പോഴേക്ക്'), type: 'date' }],
        async (v) => { await k.api.post(`/meetings/${m.id}/actions`, v); mm.close(); reload(); }));
    }, { small: true, tone: 'ghost' }));
    card.append(box);
  }
  if (m.can_edit) card.append(h('div', { class: 'row', style: { marginTop: '8px' } }, k.ui.button(past ? k.t('Edit minutes', 'മിനിറ്റ്സ് തിരുത്തുക') : k.t('Record minutes', 'മിനിറ്റ്സ് രേഖപ്പെടുത്തുക'), () => {
    const mm = k.ui.modal(k.t('Minutes', 'മിനിറ്റ്സ്'), k.ui.form([
      { name: 'status', label: k.t('Status', 'സ്ഥിതി'), type: 'select', value: past ? m.status : 'held', options: ['scheduled', 'held', 'postponed', 'cancelled'] },
      { name: 'attendance', label: k.t('People attended', 'പങ്കെടുത്തവർ'), type: 'number', value: m.attendance }, { name: 'women_attendance', label: k.t('Women attended', 'സ്ത്രീകൾ'), type: 'number', value: m.women_attendance },
      { name: 'minutes', label: 'Minutes (English)', type: 'textarea', value: m.minutes }, { name: 'minutes_ml', label: 'മിനിറ്റ്സ് (മലയാളം)', type: 'textarea', value: m.minutes_ml },
      { name: 'decisions', label: k.t('Decisions (one per line)', 'തീരുമാനങ്ങൾ (ഓരോ വരിയിൽ)'), type: 'textarea', value: (m.decisions || []).join('\n') },
    ], async (v) => { await k.api.put('/meetings/' + m.id, v); mm.close(); reload(); }));
  }, { small: true })));
  return card;
}
function suggestBox(k, m, reload) {
  const inp = k.h('input', { class: 'input', placeholder: k.t('Suggest a topic for this meeting', 'ഈ യോഗത്തിന് ഒരു വിഷയം നിർദ്ദേശിക്കുക') });
  return k.h('div', { class: 'community-row' }, k.h('div', { style: { flex: 1, minWidth: '200px' } }, inp), k.ui.button(k.t('Suggest', 'നിർദ്ദേശിക്കുക'), async () => { if (!inp.value.trim()) return; await k.api.post(`/meetings/${m.id}/suggest`, { text: inp.value }); k.toast(k.t('Added to agenda', 'അജണ്ടയിൽ ചേർത്തു'), 'good'); reload(); }, { small: true }));
}

// =====================================================================
// HAMLET COORDINATION — cross-agency service map + threads
// =====================================================================
async function coordination(el, k) {
  setup(k);
  const { h } = k;
  el.append(hero(k, 'One hamlet, many agencies', 'ഒരു ഊര്, പല ഏജൻസികൾ', 'See who runs what, where there are gaps, overlaps and timetable clashes — and agree a plan together so families are not asked twice.', 'ആര് എന്ത് നടത്തുന്നു, എവിടെ കുറവ്, ഇരട്ടിപ്പ്, സമയക്കൂട്ടിമുട്ടൽ — ഒരുമിച്ച് പദ്ധതി തീരുമാനിക്കാം.'));
  const ov = await k.api.get('/coordination/overview');
  if (!ov.length) { el.append(k.ui.empty(k.t('Your agency does not serve any hamlet yet.', 'നിങ്ങളുടെ ഏജൻസി ഒരു ഊരിലും പ്രവർത്തിക്കുന്നില്ല.'))); return; }
  const detail = h('div');
  const pick = (id) => { k.params.hamlet = id; showHamlet(detail, k, id); [...cards.children].forEach((c) => c.style.outline = c.dataset.id === id ? '3px solid var(--gold)' : ''); };
  const cards = k.ui.grid(ov.map((x) => h('div', { class: 'community-hamletcard', 'data-id': x.id, tabindex: 0, onclick: () => pick(x.id), onkeydown: (e) => { if (e.key === 'Enter') pick(x.id); } },
    h('b', null, k.t(x.name, x.name_ml)), h('div', { class: 'small muted' }, `${x.district} · ${x.community}`),
    h('div', { class: 'community-row small', style: { marginTop: '6px' } }, k.ui.badge(`${x.agencies} ${k.t('agencies', 'ഏജൻസികൾ')}`, 'info'),
      x.gaps.length ? k.ui.badge(`${x.gaps.length} ${k.t('gaps', 'കുറവുകൾ')}`, 'bad') : null, x.overlaps.length ? k.ui.badge(`${x.overlaps.length} ${k.t('overlaps', 'ഇരട്ടിപ്പ്')}`, 'warn') : null,
      x.clashes ? k.ui.badge(`${x.clashes} ${k.t('clashes', 'സമയക്കൂട്ടിമുട്ടൽ')}`, 'warn') : null, x.open_threads ? k.ui.badge(`💬 ${x.open_threads}`, '') : null, x.agreed_threads ? k.ui.badge(`🤝 ${x.agreed_threads}`, 'good') : null))), 200);
  el.append(cards, detail);
  pick(k.params.hamlet && ov.some((x) => x.id === k.params.hamlet) ? k.params.hamlet : ov[0].id);
}

async function showHamlet(el, k, hid) {
  const { h } = k;
  el.replaceChildren(k.ui.loading());
  const [map, threads] = await Promise.all([k.core.get(`/hamlets/${hid}/service-map`), k.api.get('/threads?hamlet_id=' + hid)]);
  el.replaceChildren();
  const agencies = {};
  for (const t of map.tracks) for (const p of map.byTrack[t]) agencies[p.agency_id] = { name: p.agency_name, colour: p.agency_colour };
  const agIds = Object.keys(agencies);
  const ppl = map.people || {};
  el.append(h('h2', { style: { marginTop: '20px' } }, k.t(map.hamlet.name, map.hamlet.name_ml), h('span', { class: 'small muted' }, ` · ${map.hamlet.district} · ${map.hamlet.community}`)));
  el.append(k.ui.grid([k.ui.stat(k.t('People', 'ആളുകൾ'), ppl.total), k.ui.stat(k.t('Reached by any agency', 'ഏതെങ്കിലും ഏജൻസി എത്തിയവർ'), ppl.reached), k.ui.stat(k.t('Agencies', 'ഏജൻസികൾ'), agIds.length), k.ui.stat(k.t('Gaps', 'കുറവുകൾ'), map.gaps.length)], 140));
  // matrix: tracks × agencies
  const tbl = h('table', { class: 'community-matrix' }, h('thead', null, h('tr', null, h('th', null, k.t('Track', 'വിഭാഗം')), agIds.map((a) => h('th', null, h('span', { class: 'community-dot', style: { background: agencies[a].colour } }), ' ', agencies[a].name.replace(' (demo)', ''))))),
    h('tbody', null, map.tracks.map((t) => {
      const ps = map.byTrack[t];
      const overlap = new Set(ps.map((p) => p.agency_id)).size > 1;
      if (!ps.length) return h('tr', null, h('th', null, k.t(...TRACK[t])), h('td', { class: 'gap', colSpan: Math.max(1, agIds.length) }, '⚠ ' + k.t('No one runs this here — gap', 'ആരും നടത്തുന്നില്ല — കുറവ്')));
      return h('tr', null, h('th', null, k.t(...TRACK[t]), overlap ? h('div', { class: 'small', style: { color: 'var(--warn)' } }, k.t('overlap', 'ഇരട്ടിപ്പ്')) : null),
        agIds.map((a) => h('td', { class: overlap ? 'overlap' : '' }, ps.filter((p) => p.agency_id === a).map((p) => h('div', { class: 'community-prog', style: { borderLeftColor: p.agency_colour } }, h('div', null, k.t(p.title, p.title_ml || p.title)), h('div', { class: 'muted' }, `${(p.schedule || []).join(', ')} · ${p.enrolled} ${k.t('enrolled', 'ചേർന്നവർ')}`))))));
    })));
  el.append(k.ui.card({ title: '🗺 ' + k.t('Service map', 'സേവന ഭൂപടം'), body: h('div', { class: 'tbl-wrap' }, tbl) }));
  const issues = [];
  for (const g of map.gaps) issues.push({ kind: 'gap', track: g, text: k.t(`Gap: no ${TRACK[g][0]} programme`, `കുറവ്: ${TRACK[g][1]} ഇല്ല`) });
  for (const o of map.overlaps) issues.push({ kind: 'overlap', track: o.track, text: k.t(`Overlap: ${TRACK[o.track][0]} by ${o.agencies.join(', ')}`, `ഇരട്ടിപ്പ്: ${TRACK[o.track][1]} — ${o.agencies.join(', ')}`) });
  for (const c of map.clashes) issues.push({ kind: 'clash', track: null, text: k.t(`Clash at ${c.slot}: ${c.programmes.join(' / ')}`, `${c.slot}-ൽ സമയക്കൂട്ടിമുട്ടൽ: ${c.programmes.join(' / ')}`) });
  const canPost = threads.length ? threads[0].can_post : !['govt_viewer'].includes(k.user.role) && isStaff(k);
  el.append(k.ui.card({ title: '⚠ ' + k.t('Issues to coordinate', 'ഏകോപിപ്പിക്കേണ്ട കാര്യങ്ങൾ'), body: issues.length ? h('div', { class: 'stack' }, issues.map((i) => h('div', { class: 'community-between small' }, h('span', null, i.kind === 'gap' ? '🔴 ' : '🟠 ', i.text),
    canPost ? k.ui.button(k.t('Propose coordination', 'ഏകോപനം നിർദ്ദേശിക്കുക'), () => proposeModal(k, hid, map, i, () => showHamlet(el, k, hid)), { small: true, tone: 'ghost' }) : null))) : k.ui.empty(k.t('No gaps, overlaps or clashes. 🎉', 'പ്രശ്നങ്ങളില്ല.')) }));
  const tl = h('div');
  for (const t of threads) tl.append(threadCard(k, t, () => showHamlet(el, k, hid)));
  el.append(k.ui.section(h('span', null, '💬 ' + k.t('Coordination threads', 'ഏകോപന ചർച്ചകൾ'), ' ', canPost ? k.ui.button('➕ ' + k.t('New', 'പുതിയത്'), () => proposeModal(k, hid, map, null, () => showHamlet(el, k, hid)), { small: true }) : null), threads.length ? tl : k.ui.empty(k.t('No threads yet.', 'ചർച്ചകളില്ല.'))));
}

function proposeModal(k, hid, map, issue, done) {
  const ags = {};
  for (const t of map.tracks) for (const p of map.byTrack[t]) ags[p.agency_id] = p.agency_name;
  const m = k.ui.modal(k.t('Propose coordination', 'ഏകോപനം നിർദ്ദേശിക്കുക'), k.ui.form([
    { name: 'kind', label: k.t('Type', 'തരം'), type: 'select', value: issue?.kind || 'general', options: ['overlap', 'gap', 'clash', 'referral', 'general'] },
    { name: 'track', label: k.t('Track', 'വിഭാഗം'), type: 'select', value: issue?.track || '', options: map.tracks.map((t) => ({ value: t, label: k.t(...TRACK[t]) })) },
    { name: 'topic', label: k.t('Topic', 'വിഷയം'), required: true, value: issue ? issue.text : '' },
    { name: 'body', label: k.t('Your proposal', 'നിങ്ങളുടെ നിർദ്ദേശം'), type: 'textarea', required: true, placeholder: k.t('e.g. We take classes 5–10, you take 1–4; one shared attendance day.', 'ഉദാ: ഞങ്ങൾ 5–10, നിങ്ങൾ 1–4.') },
    { name: 'agency_ids', label: k.t('Invite agencies', 'ഏജൻസികളെ ക്ഷണിക്കുക'), type: 'multiselect', options: Object.entries(ags).map(([v, l]) => ({ value: v, label: l })), value: Object.keys(ags) },
  ], async (v) => { v.hamlet_id = hid; if (!v.track) delete v.track; await k.api.post('/threads', v); m.close(); k.toast(k.t('Proposal sent to partner agencies', 'നിർദ്ദേശം അയച്ചു'), 'good'); done(); }, { submitLabel: k.t('Send proposal', 'അയയ്ക്കുക') }));
}

function threadCard(k, t, reload) {
  const { h } = k;
  const tone = { proposed: 'info', discussing: 'warn', agreed: 'good', closed: '' }[t.status];
  const reply = h('textarea', { class: 'input', rows: 2, placeholder: k.t('Reply as your agency…', 'നിങ്ങളുടെ ഏജൻസിയായി മറുപടി…') });
  return h('div', { class: 'community-thread' },
    h('div', { class: 'community-between' }, h('div', null, h('b', null, t.topic), h('div', { class: 'small muted' }, [t.kind, t.track ? k.t(...TRACK[t.track]) : null, fmtDate(t.created_at, k)].filter(Boolean).join(' · '))), k.ui.badge(t.status, tone)),
    h('div', { class: 'community-row small', style: { marginTop: '4px' } }, t.agencies.map((a) => h('span', { class: 'pill' }, h('span', { class: 'community-dot', style: { background: a.colour } }), ' ', a.name))),
    t.posts.map((p) => h('div', { class: 'community-post', style: { borderLeftColor: p.agency_colour || 'var(--line)' } }, h('div', { class: 'small' }, h('b', null, p.agency_name), h('span', { class: 'muted' }, ` · ${p.author_name} · ${fmtDate(p.posted_at, k)}`)), h('div', null, p.body))),
    t.resolution ? h('div', { class: 'small', style: { color: 'var(--good)' } }, '🤝 ' + t.resolution) : null,
    t.can_post && t.status !== 'closed' ? h('div', { class: 'stack', style: { marginTop: '6px' } }, reply, h('div', { class: 'row' },
      k.ui.button(k.t('Reply', 'മറുപടി'), async () => { if (!reply.value.trim()) return; await k.api.post(`/threads/${t.id}/posts`, { body: reply.value }); reload(); }, { small: true }),
      t.status !== 'agreed' ? k.ui.button('🤝 ' + k.t('Mark agreed', 'ധാരണയായി'), async () => { await k.api.post(`/threads/${t.id}/status`, { status: 'agreed', resolution: reply.value || undefined }); reload(); }, { small: true, tone: 'primary' }) : null,
      k.ui.button(k.t('Close', 'അവസാനിപ്പിക്കുക'), async () => { await k.api.post(`/threads/${t.id}/status`, { status: 'closed' }); reload(); }, { small: true, tone: 'ghost' }))) : null);
}

// default view routes by role
async function home(el, k) {
  if (['guardian', 'learner'].includes(k.user.role)) return family(el, k);
  if (['donor', 'employer'].includes(k.user.role)) return culture(el, k);
  return coordination(el, k);
}

export default { views: { home, family, notices, culture, meetings, coordination } };
