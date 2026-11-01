// Livelihoods & Self-Help Groups — screens. Plain ES module; no DOM work at import time.
// Views: home (facilitator: hamlet → groups), group (group book), meeting (record a meeting offline),
// my (member's own savings and loans), review (CDS / agency queue), catalogue (products), impact (aggregates).
// Money is kept in paise on the server; screens show rupees.

const CSS = `
.lvh-hero{background:linear-gradient(135deg,#880e4f 0%,#ad1457 65%,#d81b60 100%);color:#fff;border-radius:var(--r-l,14px);padding:16px 18px;margin-bottom:14px;position:relative}
.lvh-hero h2{color:#fff;margin:0 0 4px;padding-right:44px}
.lvh-hero p{margin:0;opacity:.95;max-width:62ch}
.lvh-hero .speak{position:absolute;top:10px;right:10px}
.lvh-demo{display:inline-block;background:#fff3cd;color:#7a4b00;border:1px solid #e0b100;border-radius:6px;padding:2px 8px;font-weight:700;font-size:.78rem}
.lvh-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:10px 0 14px}
.lvh-act{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:104px;border:2px solid var(--line,#ddd);border-radius:14px;background:#fff;font-weight:700;font-size:1.02rem;cursor:pointer;padding:10px;text-align:center;color:inherit}
.lvh-act:hover,.lvh-act:focus{border-color:#ad1457;outline:none}
.lvh-act .e{font-size:2.3rem;line-height:1}
.lvh-grp{border:1px solid var(--line,#ddd);border-left:6px solid #ad1457;border-radius:12px;background:#fff;padding:12px;margin-bottom:10px;cursor:pointer}
.lvh-grp.help{border-left-color:#b00020}.lvh-grp.watch{border-left-color:#e0b100}.lvh-grp.good{border-left-color:#2e7d32}
.lvh-grp h4{margin:0 0 4px;display:flex;justify-content:space-between;gap:8px;align-items:center}
.lvh-row{display:flex;gap:10px;align-items:center;border-bottom:1px dashed var(--line,#ddd);padding:8px 0}
.lvh-row .e{font-size:1.6rem;flex:none;width:2rem;text-align:center}
.lvh-row .m{flex:1;min-width:0}
.lvh-row .v{font-weight:800;white-space:nowrap}
.lvh-row.void{opacity:.5;text-decoration:line-through}
.lvh-money{font-size:1.6rem;font-weight:800}
.lvh-card{border:1px solid var(--line,#ddd);border-radius:14px;background:#fff;padding:14px;margin-bottom:12px}
.lvh-card h3{margin:0 0 6px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.lvh-sched{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.lvh-sched span{border-radius:8px;padding:4px 8px;font-size:.85rem;border:1px solid var(--line,#ddd)}
.lvh-sched .paid{background:#e8f5e9;border-color:#a5d6a7}.lvh-sched .late{background:#ffebee;border-color:#ef9a9a}.lvh-sched .due{background:#fff8e1;border-color:#ffe082}
.lvh-meet td input{width:7rem;font-size:1.05rem;padding:6px}
.lvh-meet td{vertical-align:middle}
.lvh-prod{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.lvh-prod .p{border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;padding:10px;display:flex;flex-direction:column;gap:4px}
.lvh-prod .ph{height:96px;border-radius:8px;background:#fce4ec;display:grid;place-items:center;font-size:2.6rem;overflow:hidden}
.lvh-prod .ph img{width:100%;height:100%;object-fit:cover}
.lvh-q{border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;padding:12px;margin-bottom:10px}
.lvh-q.p2,.lvh-q.p3{border-left:6px solid #b00020}.lvh-q.p1{border-left:6px solid #e0b100}
@media (max-width:420px){.lvh-act{min-height:92px;font-size:.95rem}.lvh-act .e{font-size:2rem}.lvh-money{font-size:1.35rem}.lvh-meet td input{width:5.5rem}}
`;

const KIND_ICON = { savings: '🪙', repayment: '↩️', interest: '➕', income: '💰', bank_withdrawal: '🏧', loan_out: '🤝', expense: '🧾', bank_deposit: '🏦' };
const CAT_ICON = { honey: '🍯', spices: '🌶️', millets: '🌾', crafts: '🧺', food: '🍌', other: '🛍️' };
const TYPE_LABEL = { shg: ['Neighbourhood group (NHG / SHG)', 'അയൽക്കൂട്ടം'], jlg: ['Joint liability group (JLG)', 'സംയുക്ത ബാധ്യതാ ഗ്രൂപ്പ് (JLG)'], enterprise: ['Enterprise', 'സംരംഭം'] };
const ROLE_LABEL = { president: ['President', 'പ്രസിഡന്റ്'], secretary: ['Secretary', 'സെക്രട്ടറി'], member: ['Member', 'അംഗം'] };
const DAY_LABEL = { mon: ['Monday', 'തിങ്കൾ'], tue: ['Tuesday', 'ചൊവ്വ'], wed: ['Wednesday', 'ബുധൻ'], thu: ['Thursday', 'വ്യാഴം'], fri: ['Friday', 'വെള്ളി'], sat: ['Saturday', 'ശനി'], sun: ['Sunday', 'ഞായർ'] };
const STATUS = { on_time: ['On time', 'കൃത്യസമയത്ത്', 'good'], overdue: ['Late', 'വൈകി', 'bad'], closed: ['Repaid', 'തിരിച്ചടച്ചു', 'info'], no_loan: ['No loan', 'വായ്പയില്ല', 'info'] };
const GRADE = { good: ['Doing well', 'നന്നായി പോകുന്നു', 'good'], watch: ['Keep an eye', 'ശ്രദ്ധിക്കുക', 'warn'], help: ['Needs help', 'സഹായം വേണം', 'bad'] };

const rs = (paise) => (paise === null || paise === undefined || typeof paise === 'string' ? (paise ?? '—') : '₹' + (Number(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
const inr = (rupees) => (typeof rupees === 'number' ? '₹' + rupees.toLocaleString('en-IN') : rupees ?? '—');
const toPaise = (v) => { const n = Number(String(v ?? '').replace(/[,₹\s]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };
const today = () => new Date().toISOString().slice(0, 10);
const ref = (k, tag) => (k.user ? k.user.id : 'x') + '-' + tag + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const say = (k, en, ml) => k.ui.speakBtn(k.lang === 'ml' && ml ? ml : en, k.lang === 'ml' && ml ? 'ml' : 'en');
const tl = (k, pair) => (pair ? k.t(pair[0], pair[1]) : '');
const words = (paise) => (Number(paise) / 100).toLocaleString('en-IN') + ' rupees';
const wordsMl = (paise) => (Number(paise) / 100).toLocaleString('en-IN') + ' രൂപ';

let metaCache = null;
async function meta(k) { if (!metaCache) metaCache = await k.api.get('/meta'); return metaCache; }

function hero(k, icon, en, ml, pen, pml) {
  const { h, t } = k;
  return h('div', { class: 'lvh-hero' }, h('h2', null, icon + ' ' + t(en, ml)), h('p', null, t(pen, pml)), say(k, en + '. ' + pen, ml + '. ' + pml));
}
const offlineNote = (k, r) => (r && r._offline ? k.h('p', null, k.ui.badge(k.t('Offline — showing what was saved on this device', 'ഓഫ്‌ലൈൻ — ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചത്'), 'warn')) : null);
const statusBadge = (k, s) => { const x = STATUS[s] || [s, s, 'info']; return k.ui.badge(k.t(x[0], x[1]), x[2]); };
function flagBadges(k, flags) { return (flags || []).map((f) => k.ui.badge(k.t(f.message, f.message_ml), f.level === 'urgent' ? 'bad' : f.level === 'warn' ? 'warn' : 'info')); }

// ---------------- facilitator home ----------------
async function home(el, k) {
  const { h, t, ui } = k;
  el.append(hero(k, '🤝', 'Self-help groups', 'അയൽക്കൂട്ടങ്ങൾ', 'Choose the hamlet, then the group. Record the meeting, savings and loans — it works without network and sends later.', 'ഊര് തിരഞ്ഞെടുക്കുക, പിന്നെ ഗ്രൂപ്പ്. യോഗം, സമ്പാദ്യം, വായ്പ രേഖപ്പെടുത്തുക — നെറ്റ്‌വർക്ക് ഇല്ലെങ്കിലും പ്രവർത്തിക്കും, പിന്നീട് അയയ്ക്കും.'));
  const r = await k.api.get('/home');
  el.append(offlineNote(k, r));
  el.append(h('div', { class: 'lvh-big' },
    r.can_review ? h('button', { class: 'lvh-act', onclick: () => k.go('#/m/livelihoods/review') }, h('span', { class: 'e' }, '📝'), t('Loan requests', 'വായ്പ അപേക്ഷകൾ'), r.requests_waiting ? ui.badge(String(r.requests_waiting), 'warn') : null) : null,
    h('button', { class: 'lvh-act', onclick: () => k.go('#/m/livelihoods/catalogue') }, h('span', { class: 'e' }, '🍯'), t('Products', 'ഉൽപ്പന്നങ്ങൾ')),
    r.replies_new ? h('div', { class: 'lvh-act' }, h('span', { class: 'e' }, '📬'), t(`${r.replies_new} new replies`, `${r.replies_new} പുതിയ മറുപടികൾ`)) : null));
  if (!r.hamlets.length) { el.append(ui.empty(t('No hamlets for your agency yet.', 'നിങ്ങളുടെ ഏജൻസിക്ക് ഇതുവരെ ഊരുകളില്ല.'))); return; }
  const pick = k.params.hamlet || (r.hamlets.length === 1 ? r.hamlets[0].hamlet.id : null);
  if (!pick) {
    el.append(ui.section(t('Which hamlet are you in today?', 'ഇന്ന് ഏത് ഊരിലാണ്?'), h('div', { class: 'lvh-big' }, r.hamlets.map((x) =>
      h('button', { class: 'lvh-act', onclick: () => k.go('#/m/livelihoods/home?hamlet=' + x.hamlet.id) }, h('span', { class: 'e' }, '🏡'), t(x.hamlet.name, x.hamlet.name_ml), h('span', { class: 'small muted' }, t(`${x.groups.length} groups`, `${x.groups.length} ഗ്രൂപ്പുകൾ`)))))));
    return;
  }
  const hm = r.hamlets.find((x) => x.hamlet && x.hamlet.id === pick);
  if (!hm) { el.append(ui.empty(t('This hamlet is not in your list.', 'ഈ ഊര് നിങ്ങളുടെ പട്ടികയിലില്ല.'))); return; }
  el.append(h('p', null, h('a', { href: '#/m/livelihoods/home' }, '← ' + t('All hamlets', 'എല്ലാ ഊരുകളും'))));
  el.append(ui.section('🏡 ' + t(hm.hamlet.name, hm.hamlet.name_ml), [
    hm.groups.length ? hm.groups.map((g) => groupTile(k, g)) : ui.empty(t('No groups here yet.', 'ഇവിടെ ഇതുവരെ ഗ്രൂപ്പുകളില്ല.')),
    ui.button('➕ ' + t('Start a new group', 'പുതിയ ഗ്രൂപ്പ് തുടങ്ങുക'), () => newGroup(k, hm.hamlet.id), { tone: 'ghost' }),
  ]));
}
function groupTile(k, g) {
  const { h, t, ui } = k;
  const gr = GRADE[g.health && g.health.grade] || GRADE.watch;
  return h('div', { class: 'lvh-grp ' + ((g.health && g.health.grade) || ''), role: 'button', tabindex: 0, onclick: () => k.go('#/m/livelihoods/group?id=' + g.id), onkeydown: (e) => { if (e.key === 'Enter') k.go('#/m/livelihoods/group?id=' + g.id); } },
    h('h4', null, h('span', null, t(g.name, g.name_ml || g.name)), ui.badge(t(gr[0], gr[1]), gr[2])),
    h('div', { class: 'small muted' }, tl(k, TYPE_LABEL[g.type]) + ' · ' + t(`${g.members} members`, `${g.members} അംഗങ്ങൾ`) + (g.meeting_day ? ' · ' + tl(k, DAY_LABEL[g.meeting_day]) : '') + (g.last_meeting ? ' · ' + t('last met ', 'അവസാന യോഗം ') + g.last_meeting : '')),
    h('div', { class: 'row small', style: { gap: '14px', marginTop: '6px' } }, h('span', null, '🪙 ' + t('Fund ', 'ഫണ്ട് ') + rs(g.fund)), h('span', null, '💵 ' + t('Cash ', 'കൈയിൽ ') + rs(g.cash)), h('span', null, '🤝 ' + t('Lent ', 'വായ്പ ') + rs(g.outstanding))));
}
async function newGroup(k, hamletId) {
  const { t, ui } = k;
  const m = await meta(k);
  const box = ui.modal(t('Start a new group', 'പുതിയ ഗ്രൂപ്പ്'), ui.form([
    { name: 'name', label: t('Group name', 'ഗ്രൂപ്പിന്റെ പേര്'), type: 'text', required: true },
    { name: 'name_ml', label: t('Name in Malayalam', 'മലയാളത്തിൽ പേര്'), type: 'text' },
    { name: 'type', label: t('Type', 'തരം'), type: 'select', options: m.types.map((x) => ({ value: x, label: tl(k, TYPE_LABEL[x]) })), value: 'shg' },
    { name: 'meeting_day', label: t('Meeting day', 'യോഗ ദിവസം'), type: 'select', options: m.days.map((d) => ({ value: d, label: tl(k, DAY_LABEL[d]) })) },
    { name: 'thrift', label: t('Usual savings per meeting (₹)', 'ഓരോ യോഗത്തിലും സാധാരണ സമ്പാദ്യം (₹)'), type: 'number' },
    { name: 'formed_on', label: t('Formed on', 'രൂപീകരിച്ചത്'), type: 'date', value: today() },
  ], async (v) => {
    const r = await k.api.post('/groups', { ...v, hamlet_id: hamletId, thrift: v.thrift ? toPaise(v.thrift) : undefined });
    box.close();
    if (r && r.queued) return;
    k.go('#/m/livelihoods/group?id=' + r.id);
  }, { submitLabel: t('Create group', 'ഗ്രൂപ്പ് ഉണ്ടാക്കുക') }));
}

// ---------------- group book ----------------
async function group(el, k) {
  const { h, t, ui } = k;
  const id = k.params.id;
  if (!id) return k.go('#/m/livelihoods/home');
  const r = await k.api.get('/groups/' + encodeURIComponent(id));
  const g = r.group;
  const m = await meta(k);
  el.append(h('p', null, h('a', { href: '#/m/livelihoods/home?hamlet=' + g.hamlet_id }, '← ' + t(g.hamlet ? g.hamlet.name : 'Back', g.hamlet ? g.hamlet.name_ml : 'തിരികെ'))));
  el.append(hero(k, '📒', g.name, g.name_ml || g.name, `${tl({ t: (a) => a }, TYPE_LABEL[g.type])}. Group fund ${rs(g.fund)}: cash in hand ${rs(g.cash)}, in bank ${rs(g.bank)}, lent to members ${rs(g.outstanding)}.`,
    `ഗ്രൂപ്പ് ഫണ്ട് ${rs(g.fund)}: കൈയിൽ ${rs(g.cash)}, ബാങ്കിൽ ${rs(g.bank)}, അംഗങ്ങൾക്ക് വായ്പ ${rs(g.outstanding)}.`));
  el.append(offlineNote(k, r));
  const hl = g.health || {};
  el.append(ui.grid([
    ui.stat(t('Cash in hand', 'കൈയിലുള്ള പണം'), rs(g.cash)),
    ui.stat(t('In bank', 'ബാങ്കിൽ'), rs(g.bank)),
    ui.stat(t('Lent out', 'വായ്പയായി'), rs(g.outstanding), t(`${hl.loans_open || 0} loans, ${hl.loans_overdue || 0} late`, `${hl.loans_open || 0} വായ്പ, ${hl.loans_overdue || 0} വൈകി`)),
    ui.stat(t('Savings regularity', 'സമ്പാദ്യ ക്രമം'), hl.savings_regularity === null || hl.savings_regularity === undefined ? '—' : Math.round(hl.savings_regularity * 100) + '%'),
    ui.stat(t('Repaid on time', 'കൃത്യ തിരിച്ചടവ്'), hl.repayment_rate === null || hl.repayment_rate === undefined ? '—' : Math.round(hl.repayment_rate * 100) + '%'),
  ], 140));
  if (!r.summary.balanced) el.append(ui.card({ tone: 'bad', title: t('Book does not balance — check entries', 'കണക്ക് ഒത്തുപോകുന്നില്ല — പരിശോധിക്കുക') }));
  el.append(h('div', { class: 'lvh-big' },
    h('button', { class: 'lvh-act', onclick: () => k.go('#/m/livelihoods/meeting?id=' + g.id) }, h('span', { class: 'e' }, '🗓️'), t('Record meeting', 'യോഗം രേഖപ്പെടുത്തുക')),
    h('button', { class: 'lvh-act', onclick: () => entryForm(k, g, r.members, m) }, h('span', { class: 'e' }, '✍️'), t('Other entry', 'മറ്റ് എൻട്രി')),
    h('button', { class: 'lvh-act', onclick: () => loanRequestForm(k, g, r.members, m) }, h('span', { class: 'e' }, '📝'), t('Loan request', 'വായ്പ അപേക്ഷ')),
    h('button', { class: 'lvh-act', onclick: () => k.go('#/m/livelihoods/catalogue?group=' + g.id) }, h('span', { class: 'e' }, '🍯'), t('Products', 'ഉൽപ്പന്നങ്ങൾ'))));
  el.append(ui.tabs([
    { id: 'members', label: '👩 ' + t('Members', 'അംഗങ്ങൾ'), render: (b) => membersTab(b, k, g, r, m) },
    { id: 'ledger', label: '📒 ' + t('Book', 'കണക്കുപുസ്തകം'), render: (b) => ledgerTab(b, k, r) },
    { id: 'requests', label: '📝 ' + t('Requests', 'അപേക്ഷകൾ'), render: (b) => { b.append(r.requests.length ? r.requests.map((s) => requestCard(k, s, m, { onGive: s.can_give ? (x) => ui.button(t('Give loan', 'വായ്പ നൽകുക'), () => giveLoan(k, g, x), { small: true }) : null })) : ui.empty(t('No loan requests yet.', 'വായ്പ അപേക്ഷകളില്ല.'))); } },
    { id: 'trend', label: '📈 ' + t('Months', 'മാസങ്ങൾ'), render: (b) => {
      b.append(ui.section(t('Savings by month', 'മാസം തിരിച്ചുള്ള സമ്പാദ്യം'), ui.bars(r.by_month.map((x) => ({ label: x.month, value: Math.round(x.savings / 100) })), { unit: ' ₹' })));
      b.append(ui.section(t('Loans given and repaid', 'നൽകിയതും തിരിച്ചടച്ചതുമായ വായ്പ'), ui.table([
        { key: 'month', label: t('Month', 'മാസം') }, { key: 'loans', label: t('Given', 'നൽകി'), render: (x) => rs(x.loans) }, { key: 'repaid', label: t('Repaid', 'തിരിച്ചടച്ചു'), render: (x) => rs(x.repaid) }, { key: 'income', label: t('Interest & income', 'പലിശയും വരുമാനവും'), render: (x) => rs(x.income) }], r.by_month)));
      b.append(ui.section(t('Recent meetings', 'അടുത്തിടെയുള്ള യോഗങ്ങൾ'), ui.table([{ key: 'date', label: t('Date', 'തീയതി') }, { key: 'attendance', label: t('Present', 'ഹാജർ') }, { key: 'savings_collected', label: t('Savings', 'സമ്പാദ്യം'), render: (x) => rs(x.savings_collected) }], r.meetings)));
    } },
  ], k.params.tab || 'members'));
}

function membersTab(b, k, g, r, m) {
  const { h, t, ui } = k;
  if (r.hidden_members) b.append(h('p', { class: 'small muted' }, t(`${r.hidden_members} member(s) not shown — consent for your agency is missing or withdrawn.`, `${r.hidden_members} അംഗം(ങ്ങൾ) കാണിക്കുന്നില്ല — സമ്മതം ഇല്ല / പിൻവലിച്ചു.`)));
  b.append(r.members.filter((x) => x.status === 'active').map((x) => h('div', { class: 'lvh-row', role: 'button', tabindex: 0, style: { cursor: 'pointer' }, onclick: () => memberCard(k, g, x.person_id) },
    h('span', { class: 'e' }, x.role === 'president' ? '⭐' : x.role === 'secretary' ? '✒️' : '👩'),
    h('div', { class: 'm' }, h('b', null, x.name), h('div', { class: 'small muted' }, tl(k, ROLE_LABEL[x.role]) + ' · ' + t('saved ', 'സമ്പാദ്യം ') + rs(x.savings) + (x.outstanding ? ' · ' + t('owes ', 'ബാക്കി ') + rs(x.outstanding) : ''))),
    x.loan_status !== 'no_loan' ? statusBadge(k, x.loan_status) : null)));
  b.append(h('div', { class: 'row', style: { marginTop: '10px' } }, ui.button('➕ ' + t('Add member', 'അംഗത്തെ ചേർക്കുക'), () => addMember(k, g, m), { tone: 'ghost' })));
}
async function addMember(k, g, m) {
  const { t, ui, h } = k;
  const list = h('div', null, ui.loading());
  const box = ui.modal(t('Add a member', 'അംഗത്തെ ചേർക്കുക'), [h('p', { class: 'small muted' }, t('Only adults in this hamlet who gave "livelihood" consent to the group\'s agency are listed.', 'ഗ്രൂപ്പിന്റെ ഏജൻസിക്ക് "ഉപജീവന" സമ്മതം നൽകിയ ഈ ഊരിലെ മുതിർന്നവർ മാത്രം.')), list]);
  try {
    const rows = await k.api.get(`/groups/${g.id}/candidates`);
    list.replaceChildren(ui.table([{ key: 'name', label: t('Name', 'പേര്') }, { key: 'age', label: t('Age', 'വയസ്സ്') }], rows, { empty: t('Nobody else with consent. Record consent first.', 'സമ്മതമുള്ള മറ്റാരുമില്ല. ആദ്യം സമ്മതം രേഖപ്പെടുത്തുക.'), onRow: async (p) => {
      const ok = await ui.confirm(t(`Add ${p.name} to ${g.name}?`, `${p.name}-നെ ${g.name_ml || g.name}-ൽ ചേർക്കട്ടെ?`));
      if (!ok) return;
      await k.api.post(`/groups/${g.id}/members`, { person_id: p.id, role: 'member', client_ref: ref(k, 'mem') });
      box.close(); k.toast(t('Member added', 'അംഗത്തെ ചേർത്തു'), 'good'); k.refresh();
    } }));
  } catch (e) { list.replaceChildren(ui.error(e)); }
  void m;
}
async function memberCard(k, g, pid) {
  const { h, t, ui } = k;
  const body = h('div', null, ui.loading());
  ui.modal(t('Member card', 'അംഗ കാർഡ്'), body);
  try {
    const r = await k.api.get(`/groups/${g.id}/members/${pid}`);
    body.replaceChildren(loanCards(k, r, { name: r.member.name }), ui.section(t('Entries', 'എൻട്രികൾ'), r.entries.map((x) => ledgerRow(k, x))));
  } catch (e) { body.replaceChildren(ui.error(e)); }
}
function ledgerRow(k, x) {
  const { h, t } = k;
  return h('div', { class: 'lvh-row' + (x.voided ? ' void' : '') }, h('span', { class: 'e', 'aria-hidden': 'true' }, KIND_ICON[x.kind] || '•'),
    h('div', { class: 'm' }, h('b', null, kindLabel(k, x.kind)), ' ', x.person_name ? h('span', null, '· ' + x.person_name) : x.others ? h('span', { class: 'muted' }, '· ' + t('other members (total)', 'മറ്റ് അംഗങ്ങൾ (ആകെ)')) : null,
      h('div', { class: 'small muted' }, x.date + (x.months ? ' · ' + t(`${x.months} months`, `${x.months} മാസം`) : '') + (x.note ? ' · ' + x.note : '') + (x.voided ? ' · ' + t('cancelled: ', 'റദ്ദാക്കി: ') + (x.void_reason || '') : ''))),
    h('span', { class: 'v' }, (['loan_out', 'expense', 'bank_deposit'].includes(x.kind) ? '− ' : '+ ') + rs(x.amount)));
}
let kindsCache = null;
const kindLabel = (k, kind) => { const x = kindsCache && kindsCache[kind]; return x ? k.t(x.label, x.label_ml) : kind; };
function ledgerTab(b, k, r) {
  const { t, ui, h } = k;
  b.append(ui.kv([[t('Total savings', 'ആകെ സമ്പാദ്യം'), rs(r.summary.totals.savings)], [t('Interest received', 'ലഭിച്ച പലിശ'), rs(r.summary.totals.interest)], [t('Other income', 'മറ്റ് വരുമാനം'), rs(r.summary.totals.income)], [t('Expenses', 'ചെലവുകൾ'), rs(r.summary.totals.expense)], [t('Group fund', 'ഗ്രൂപ്പ് ഫണ്ട്'), rs(r.summary.fund)]]));
  b.append(h('div', null, r.ledger.map((x) => {
    const row = ledgerRow(k, x);
    if (!x.voided && !x.others) row.append(ui.button('✖', async () => {
      const reason = prompt(t('Why cancel this entry?', 'ഈ എൻട്രി എന്തിന് റദ്ദാക്കുന്നു?'));
      if (!reason) return;
      try { await k.api.post(`/txns/${x.id}/void`, { reason }); k.toast(t('Entry cancelled', 'എൻട്രി റദ്ദാക്കി'), 'good'); k.refresh(); } catch (e) { k.toast(e.message, 'bad'); }
    }, { tone: 'ghost', small: true, title: t('Cancel entry', 'റദ്ദാക്കുക') }));
    return row;
  })));
}
async function entryForm(k, g, members, m) {
  const { t, ui } = k;
  kindsCache = m.kinds;
  const box = ui.modal(t('New entry', 'പുതിയ എൻട്രി'), ui.form([
    { name: 'kind', label: t('What happened?', 'എന്ത് സംഭവിച്ചു?'), type: 'select', required: true, options: Object.entries(m.kinds).filter(([v]) => v !== 'loan_out').map(([v, x]) => ({ value: v, label: x.icon + ' ' + t(x.label, x.label_ml) })) },
    { name: 'person_id', label: t('Member (for savings, loans, repayments, interest)', 'അംഗം (സമ്പാദ്യം, വായ്പ, തിരിച്ചടവ്, പലിശ)'), type: 'select', options: [{ value: '', label: '—' }, ...members.filter((x) => x.status === 'active').map((x) => ({ value: x.person_id, label: x.name }))] },
    { name: 'amount', label: t('Amount (₹)', 'തുക (₹)'), type: 'number', required: true },
    { name: 'months', label: t('Loan months (only for a loan)', 'വായ്പ മാസങ്ങൾ (വായ്പയ്ക്ക് മാത്രം)'), type: 'number' },
    { name: 'date', label: t('Date', 'തീയതി'), type: 'date', value: today(), required: true },
    { name: 'note', label: t('Note', 'കുറിപ്പ്'), type: 'text' },
  ], async (v) => {
    const r = await k.api.post(`/groups/${g.id}/txns`, { kind: v.kind, person_id: v.person_id || null, amount: toPaise(v.amount), months: v.months ? Number(v.months) : undefined, date: v.date, note: v.note, client_ref: ref(k, 'tx') });
    box.close();
    if (!r.queued) { k.toast(t('Saved', 'സേവ് ചെയ്തു'), 'good'); k.refresh(); }
  }, { submitLabel: t('Save', 'സേവ് ചെയ്യുക') }));
}
// A loan is given only against a request the CDS / agency approved (the server checks again).
async function giveLoan(k, g, s) {
  const { t, ui } = k;
  const a = s.answers || {};
  const box = ui.modal(t('Give loan', 'വായ്പ നൽകുക'), ui.form([
    { name: 'amount', label: t('Amount (₹) — at most the approved amount', 'തുക (₹) — അനുവദിച്ച തുക വരെ'), type: 'number', required: true, value: a.amount },
    { name: 'months', label: t('Months', 'മാസങ്ങൾ'), type: 'number', required: true, value: a.months },
    { name: 'date', label: t('Date', 'തീയതി'), type: 'date', value: today(), required: true },
  ], async (v) => {
    const r = await k.api.post(`/groups/${g.id}/txns`, { kind: 'loan_out', person_id: s.person && s.person.id, request_id: s.id, amount: toPaise(v.amount), months: Number(v.months), date: v.date, client_ref: ref(k, 'loan-out') });
    box.close();
    if (!r.queued) { k.toast(t('Loan given', 'വായ്പ നൽകി'), 'good'); k.refresh(); }
  }, { submitLabel: t('Give loan', 'വായ്പ നൽകുക') }));
}
async function loanRequestForm(k, g, members, m) {
  const { t, ui } = k;
  const box = ui.modal(t('Loan request', 'വായ്പ അപേക്ഷ'), ui.form([
    { name: 'person_id', label: t('Member', 'അംഗം'), type: 'select', required: true, options: members.filter((x) => x.status === 'active').map((x) => ({ value: x.person_id, label: x.name })) },
    { name: 'purpose', label: t('What is the loan for?', 'വായ്പ എന്തിനാണ്?'), type: 'select', required: true, options: m.purposes.map((p) => ({ value: p.value, label: t(p.label, p.label_ml) })) },
    { name: 'purpose_note', label: t('A few words', 'കുറച്ച് വാക്കുകൾ'), type: 'text' },
    { name: 'amount', label: t('How much? (₹)', 'എത്ര? (₹)'), type: 'number', required: true },
    { name: 'months', label: t('Repay over how many months?', 'എത്ര മാസം കൊണ്ട്?'), type: 'number', required: true, value: 6 },
    { name: 'group_agreed', label: t('The group meeting agreed', 'ഗ്രൂപ്പ് യോഗം സമ്മതിച്ചു'), type: 'checkbox' },
  ], async (v) => {
    const r = await k.api.post(`/groups/${g.id}/loan-requests`, { person_id: v.person_id, purpose: v.purpose, purpose_note: v.purpose_note, amount: Number(v.amount), months: Number(v.months), group_agreed: v.group_agreed ? 'yes' : 'no', client_ref: ref(k, 'loan') });
    box.close();
    if (r.queued) return;
    k.toast(t('Sent to the CDS for review. The reply comes back on a later visit.', 'സി.ഡി.എസ് പരിശോധനയ്ക്ക് അയച്ചു. മറുപടി അടുത്ത സന്ദർശനത്തിൽ.'), 'good');
    k.refresh();
  }, { submitLabel: t('Send request', 'അപേക്ഷ അയയ്ക്കുക') }));
}
function requestCard(k, s, m, { onDecide, onGive } = {}) {
  const { h, t, ui } = k;
  const a = s.answers || {};
  const purpose = (m.purposes || []).find((p) => p.value === a.purpose);
  const isLoan = s.form_key === 'livelihoods.loan_request';
  const kind = (m.idea_kinds || []).find((x) => x.value === a.kind);
  return h('div', { class: 'lvh-q p' + (s.priority || 0) },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, (isLoan ? '📝 ' + (s.person ? s.person.name : '') + ' · ₹' + Number(a.amount || 0).toLocaleString('en-IN') : '💡 ' + (s.person ? s.person.name : ''))),
      ui.badge(s.outcome ? tl(k, m.decisions && m.decisions[s.outcome]) || s.outcome : s.status, s.outcome === 'approved' ? 'good' : s.outcome === 'declined' ? 'bad' : s.status === 'submitted' ? 'warn' : 'info')),
    h('div', { class: 'small muted' }, [s.group ? t(s.group.name, s.group.name_ml || s.group.name) : s.group_mismatch ? t('⚠ group does not match the agency', '⚠ ഗ്രൂപ്പ് ഏജൻസിയുമായി ചേരുന്നില്ല') : null, t(s.hamlet, s.hamlet_ml), String(s.captured_at || '').slice(0, 10)].filter(Boolean).join(' · ')),
    isLoan ? h('p', null, (purpose ? t(purpose.label, purpose.label_ml) : a.purpose) + (a.purpose_note ? ' — ' + a.purpose_note : '') + ' · ' + t(`${a.months} months`, `${a.months} മാസം`)) : h('p', null, (kind ? t(kind.label, kind.label_ml) + ': ' : '') + (a.idea || '')),
    s.book ? h('div', { class: 'small' }, t('Group can lend now: ', 'ഗ്രൂപ്പിന് ഇപ്പോൾ നൽകാവുന്നത്: ') + rs(s.book.lendable) + (s.book.member ? ' · ' + t('her savings ', 'സമ്പാദ്യം ') + rs(s.book.member.savings) + ' · ' + t('owes ', 'ബാക്കി ') + rs(s.book.member.outstanding) : '')) : null,
    h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } }, flagBadges(k, s.flags)),
    s.reply ? h('div', { class: 'card', style: { background: 'var(--soft,#fdf2f6)', marginTop: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, t('Reply', 'മറുപടി') + (s.replied_by_name ? ' · ' + s.replied_by_name : '')), say(k, s.reply, s.reply_ml)), h('p', null, t(s.reply, s.reply_ml || s.reply))) : null,
    h('div', { class: 'row' }, onDecide ? ui.button(t('Decide', 'തീരുമാനിക്കുക'), () => onDecide(s), { tone: 'primary', small: true }) : null, onGive ? onGive(s) : null));
}

// ---------------- meeting (offline-first) ----------------
async function meeting(el, k) {
  const { h, t, ui } = k;
  const id = k.params.id;
  const r = await k.api.get('/groups/' + encodeURIComponent(id));
  const g = r.group;
  el.append(h('p', null, h('a', { href: '#/m/livelihoods/group?id=' + g.id }, '← ' + t(g.name, g.name_ml || g.name))));
  el.append(hero(k, '🗓️', 'Record the meeting', 'യോഗം രേഖപ്പെടുത്തുക', 'Tick who came. Type each person\'s savings and repayment. Press save once — if there is no network it is kept on this phone and sent later.', 'വന്നവരെ ടിക് ചെയ്യുക. ഓരോരുത്തരുടെയും സമ്പാദ്യവും തിരിച്ചടവും എഴുതുക. ഒരിക്കൽ സേവ് അമർത്തുക — നെറ്റ്‌വർക്ക് ഇല്ലെങ്കിൽ ഫോണിൽ സൂക്ഷിച്ച് പിന്നീട് അയയ്ക്കും.'));
  el.append(offlineNote(k, r));
  const thrift = g.thrift ? g.thrift / 100 : '';
  const date = h('input', { class: 'input', type: 'date', value: today(), 'aria-label': t('Meeting date', 'യോഗ തീയതി') });
  const notes = h('textarea', { class: 'input', rows: 2, placeholder: t('Notes (decisions, training …)', 'കുറിപ്പുകൾ (തീരുമാനങ്ങൾ, പരിശീലനം …)') });
  const rows = r.members.filter((x) => x.status === 'active').map((x) => {
    const here = h('input', { type: 'checkbox', checked: true, 'aria-label': t('Present', 'ഹാജർ') });
    const sav = h('input', { class: 'input', type: 'number', min: 0, step: '1', value: thrift, inputmode: 'numeric', 'aria-label': t('Savings ₹', 'സമ്പാദ്യം ₹') });
    const rep = h('input', { class: 'input', type: 'number', min: 0, step: '1', value: x.next_due && x.loan_status !== 'no_loan' ? x.next_due.amount / 100 : '', inputmode: 'numeric', disabled: !x.outstanding, 'aria-label': t('Repayment ₹', 'തിരിച്ചടവ് ₹') });
    const intr = h('input', { class: 'input', type: 'number', min: 0, step: '1', value: '', inputmode: 'numeric', disabled: !x.outstanding, 'aria-label': t('Interest ₹', 'പലിശ ₹') });
    here.addEventListener('change', () => { if (!here.checked) { sav.value = ''; rep.value = ''; intr.value = ''; } });
    return { x, here, sav, rep, intr };
  });
  const table = h('table', { class: 'tbl lvh-meet' }, h('thead', null, h('tr', null, h('th', null, t('Member', 'അംഗം')), h('th', null, '✔'), h('th', null, '🪙 ' + t('Savings ₹', 'സമ്പാദ്യം ₹')), h('th', null, '↩️ ' + t('Repay ₹', 'തിരിച്ചടവ് ₹')), h('th', null, '➕ ' + t('Interest ₹', 'പലിശ ₹')))),
    h('tbody', null, rows.map((rw) => h('tr', null, h('td', null, h('b', null, rw.x.name), rw.x.outstanding ? h('div', { class: 'small muted' }, t('owes ', 'ബാക്കി ') + rs(rw.x.outstanding)) : null), h('td', null, rw.here), h('td', null, rw.sav), h('td', null, rw.rep), h('td', null, rw.intr)))));
  const total = h('b');
  const recalc = () => { const s = rows.reduce((a, rw) => a + toPaise(rw.sav.value), 0); total.textContent = t('Savings today: ', 'ഇന്നത്തെ സമ്പാദ്യം: ') + rs(s); };
  rows.forEach((rw) => [rw.sav, rw.here].forEach((i) => i.addEventListener('input', recalc))); recalc();
  // the client_ref is fixed for this screen, so pressing save twice (or replaying from the outbox) never doubles the book
  const clientRef = ref(k, 'meet');
  const save = ui.button('💾 ' + t('Save meeting', 'യോഗം സേവ് ചെയ്യുക'), async () => {
    save.disabled = true;
    try {
      const body = { date: date.value, attendance: rows.filter((rw) => rw.here.checked).length, notes: notes.value, client_ref: clientRef,
        savings: rows.filter((rw) => toPaise(rw.sav.value)).map((rw) => ({ person_id: rw.x.person_id, amount: toPaise(rw.sav.value) })),
        repayments: rows.filter((rw) => toPaise(rw.rep.value)).map((rw) => ({ person_id: rw.x.person_id, amount: toPaise(rw.rep.value) })),
        interest: rows.filter((rw) => toPaise(rw.intr.value)).map((rw) => ({ person_id: rw.x.person_id, amount: toPaise(rw.intr.value) })) };
      const out = await k.api.post(`/groups/${g.id}/meetings`, body);
      if (out.queued) return; // the kit has already said it is kept on this device
      k.toast(t(`Meeting saved: ${out.entries} entries`, `യോഗം സേവ് ചെയ്തു: ${out.entries} എൻട്രികൾ`), 'good');
      k.go('#/m/livelihoods/group?id=' + g.id + '&tab=ledger');
    } catch (e) { k.toast(e.message, 'bad'); save.disabled = false; }
  }, { tone: 'primary' });
  el.append(ui.card({ body: [h('label', null, t('Date', 'തീയതി'), ' ', date), h('div', { style: { overflowX: 'auto', marginTop: '10px' } }, table), h('p', null, total), notes] }), h('div', { class: 'row' }, save));
}

// ---------------- member's own view ----------------
function loanCards(k, me, { name } = {}) {
  const { h, t, ui } = k;
  const out = [];
  const sayEn = `${name ? name + '. ' : ''}You have saved ${words(me.savings)}. ` + (me.outstanding ? `You still owe ${words(me.outstanding)}. ` + (me.overdue ? `${words(me.overdue)} is late. ` : 'You are on time. ') + (me.next_due ? `Next payment ${words(me.next_due.amount)} by ${me.next_due.date}.` : '') : 'You have no loan now.');
  const sayMl = `${name ? name + '. ' : ''}നിങ്ങളുടെ സമ്പാദ്യം ${wordsMl(me.savings)}. ` + (me.outstanding ? `ഇനി അടയ്ക്കാനുള്ളത് ${wordsMl(me.outstanding)}. ` + (me.overdue ? `${wordsMl(me.overdue)} വൈകി. ` : 'കൃത്യസമയത്താണ്. ') + (me.next_due ? `അടുത്ത അടവ് ${me.next_due.date}-നകം ${wordsMl(me.next_due.amount)}.` : '') : 'ഇപ്പോൾ വായ്പയില്ല.');
  out.push(h('div', { class: 'lvh-card' }, h('h3', null, h('span', null, '🪙 ' + t('My savings', 'എന്റെ സമ്പാദ്യം')), say(k, sayEn, sayMl)), h('div', { class: 'lvh-money' }, rs(me.savings)),
    me.savings_by_month ? ui.bars(me.savings_by_month.map((x) => ({ label: x.month, value: Math.round(x.amount / 100) })), { unit: ' ₹' }) : null));
  for (const l of me.loans.filter((x) => x.status !== 'closed')) {
    out.push(h('div', { class: 'lvh-card' }, h('h3', null, h('span', null, '🤝 ' + t('Loan of ', 'വായ്പ ') + rs(l.amount)), statusBadge(k, l.status)),
      h('div', null, t('Taken on ', 'എടുത്തത് ') + l.date + ' · ' + t(`${l.months} months`, `${l.months} മാസം`)),
      h('div', { class: 'lvh-money' }, t('Still to pay: ', 'ഇനി അടയ്ക്കാൻ: ') + rs(l.outstanding)),
      l.next_due ? h('p', null, '📅 ' + t(`Next: ${rs(l.next_due.amount)} by ${l.next_due.date}`, `അടുത്തത്: ${l.next_due.date}-നകം ${rs(l.next_due.amount)}`)) : null,
      l.overdue ? h('p', null, ui.badge(t(`${rs(l.overdue)} is late — talk to your group`, `${rs(l.overdue)} വൈകി — ഗ്രൂപ്പുമായി സംസാരിക്കുക`), 'bad')) : null,
      h('div', { class: 'lvh-sched' }, (l.schedule || []).map((s) => h('span', { class: s.state, title: s.state }, (s.state === 'paid' ? '✔ ' : s.state === 'late' ? '⚠ ' : '') + s.due.slice(5) + ' · ' + rs(s.amount))))));
  }
  const closed = me.loans.filter((x) => x.status === 'closed').length;
  if (closed) out.push(h('p', { class: 'small muted' }, '✔ ' + t(`${closed} loan(s) fully repaid`, `${closed} വായ്പ മുഴുവൻ തിരിച്ചടച്ചു`)));
  return h('div', null, out);
}
async function my(el, k) {
  const { h, t, ui } = k;
  el.append(hero(k, '🪙', 'My group savings', 'എന്റെ ഗ്രൂപ്പ് സമ്പാദ്യം', 'Your savings, your loans and when to pay — only you can see this.', 'നിങ്ങളുടെ സമ്പാദ്യം, വായ്പ, എപ്പോൾ അടയ്ക്കണം — ഇത് നിങ്ങൾക്ക് മാത്രം.'));
  const r = await k.api.get('/my');
  el.append(offlineNote(k, r));
  if (!r.groups.length && !r.requests.length) { el.append(ui.empty(t('You are not in a group on this platform yet. Ask your facilitator.', 'നിങ്ങൾ ഇതുവരെ ഒരു ഗ്രൂപ്പിലും ഇല്ല. ഫെസിലിറ്റേറ്ററോട് ചോദിക്കുക.'))); return; }
  for (const g of r.groups) {
    el.append(ui.section('🤝 ' + t(g.group.name, g.group.name_ml || g.group.name), [
      h('p', { class: 'small muted' }, tl(k, ROLE_LABEL[g.role]) + (g.group.meeting_day ? ' · ' + t('meets on ', 'യോഗം ') + tl(k, DAY_LABEL[g.group.meeting_day]) : '') + (g.group_book.last_meeting ? ' · ' + t('last meeting ', 'അവസാന യോഗം ') + g.group_book.last_meeting : '')),
      loanCards(k, g.me),
      h('details', null, h('summary', null, t('Our group\'s book', 'ഞങ്ങളുടെ ഗ്രൂപ്പിന്റെ കണക്ക്')), ui.kv([[t('Members', 'അംഗങ്ങൾ'), g.group_book.members], [t('Group fund', 'ഗ്രൂപ്പ് ഫണ്ട്'), rs(g.group_book.fund)], [t('Cash in hand', 'കൈയിൽ'), rs(g.group_book.cash)], [t('In bank', 'ബാങ്കിൽ'), rs(g.group_book.bank)], [t('Lent to members', 'അംഗങ്ങൾക്ക് വായ്പ'), rs(g.group_book.outstanding)]])),
    ]));
  }
  if (r.requests.length) {
    el.append(ui.section('📝 ' + t('My requests', 'എന്റെ അപേക്ഷകൾ'), r.requests.map((s) => {
      const word = s.outcome === 'approved' ? t('Approved', 'അനുവദിച്ചു') : s.outcome === 'declined' ? t('Not approved', 'അനുവദിച്ചില്ല') : s.outcome === 'more_info' ? t('More information needed', 'കൂടുതൽ വിവരം വേണം') : s.reply ? t('Reply received', 'മറുപടി ലഭിച്ചു') : t('Waiting for reply', 'മറുപടി കാത്തിരിക്കുന്നു');
      const card = h('div', { class: 'lvh-card' }, h('h3', null, h('span', null, s.form_key === 'livelihoods.loan_request' ? '📝 ' + t('Loan', 'വായ്പ') + ' ₹' + Number(s.answers.amount || 0).toLocaleString('en-IN') : '💡 ' + t('Business idea', 'സംരംഭ ആശയം')), ui.badge(word, s.outcome === 'approved' ? 'good' : s.outcome === 'declined' ? 'bad' : 'info')),
        s.reply ? h('div', null, h('p', null, t(s.reply, s.reply_ml || s.reply)), say(k, s.reply, s.reply_ml)) : h('p', { class: 'muted' }, t('The answer comes back on a visit day.', 'മറുപടി സന്ദർശന ദിവസം വരും.')));
      if (s.reply && !s.reply_seen_at) k.api.post(`/requests/${s.id}/seen`, {}).catch(() => {});
      return card;
    })));
  }
}

// ---------------- reviewer (CDS / agency) ----------------
async function review(el, k) {
  const { h, t, ui } = k;
  const m = await meta(k);
  el.append(hero(k, '📝', 'Loan requests & ideas', 'വായ്പ അപേക്ഷകളും ആശയങ്ങളും', 'Most urgent first. The flags check the group\'s cash and the member\'s other loans. Your reply goes back to the hamlet on the next visit.', 'അടിയന്തരമായവ ആദ്യം. ഗ്രൂപ്പിന്റെ പണവും അംഗത്തിന്റെ മറ്റ് വായ്പകളും പരിശോധിക്കുന്നു. മറുപടി അടുത്ത സന്ദർശനത്തിൽ ഊരിലെത്തും.'));
  el.append(ui.tabs([
    { id: 'open', label: t('Waiting', 'കാത്തിരിക്കുന്നവ'), render: async (b) => { const rows = await k.api.get('/requests'); b.append(rows.length ? rows.map((s) => requestCard(k, s, m, { onDecide: m.can_review ? (x) => decide(k, x, m) : null })) : ui.empty(t('Nothing waiting. 🎉', 'ഒന്നും കാത്തിരിക്കുന്നില്ല. 🎉'))); } },
    { id: 'all', label: t('All', 'എല്ലാം'), render: async (b) => { const rows = await k.api.get('/requests?all=1'); b.append(rows.length ? rows.map((s) => requestCard(k, s, m)) : ui.empty(t('No requests.', 'അപേക്ഷകളില്ല.'))); } },
  ], 'open'));
  void h;
}
function decide(k, s, m) {
  const { t, ui } = k;
  const isLoan = s.form_key === 'livelihoods.loan_request';
  const box = ui.modal(t('Decide', 'തീരുമാനിക്കുക'), ui.form([
    isLoan ? { name: 'decision', label: t('Decision', 'തീരുമാനം'), type: 'select', required: true, options: Object.entries(m.decisions).map(([v, x]) => ({ value: v, label: t(x[0], x[1]) })) } : { name: 'decision', type: 'hidden', value: 'advice' },
    { name: 'reply', label: t('Message (English, plain words)', 'സന്ദേശം (ഇംഗ്ലീഷ്)'), type: 'textarea' },
    { name: 'reply_ml', label: t('Message (Malayalam)', 'സന്ദേശം (മലയാളം)'), type: 'textarea' },
  ], async (v) => { await k.api.post(`/requests/${s.id}/decide`, v); box.close(); k.toast(t('Reply saved — it reaches the hamlet on the next sync.', 'മറുപടി സേവ് ചെയ്തു.'), 'good'); k.refresh(); }, { submitLabel: t('Send reply', 'മറുപടി അയയ്ക്കുക') }));
}

// ---------------- products & catalogue ----------------
async function catalogue(el, k) {
  const { h, t, ui } = k;
  const m = await meta(k);
  el.append(hero(k, '🍯', 'Hamlet products', 'ഊരിലെ ഉൽപ്പന്നങ്ങൾ', 'Honey, spices, millets and crafts made by hamlet groups, sold through a city partner shop.', 'ഊരിലെ ഗ്രൂപ്പുകൾ ഉണ്ടാക്കിയ തേൻ, സുഗന്ധവ്യഞ്ജനം, ചെറുധാന്യം, കരകൗശലം — നഗരത്തിലെ പങ്കാളി കട വഴി.'));
  const tabs = [{ id: 'shop', label: '🛍️ ' + t('Catalogue', 'കാറ്റലോഗ്'), render: (b) => shop(b, k) }];
  if (m.can_staff) tabs.push({ id: 'manage', label: '✍️ ' + t('Our products', 'ഞങ്ങളുടെ ഉൽപ്പന്നങ്ങൾ'), render: (b) => manageProducts(b, k, m) });
  el.append(ui.tabs(tabs, k.params.group ? 'manage' : 'shop'));
  void h;
}
async function shop(b, k) {
  const { h, t, ui } = k;
  const r = await k.api.get('/catalogue');
  b.append(h('p', { class: 'small muted' }, t(r.partner_note, r.partner_note_ml)));
  if (r.products.some((p) => p.is_demo)) b.append(h('p', null, h('span', { class: 'lvh-demo' }, '⚠ ' + t('DEMO listings — fictional groups and prices', 'ഡെമോ — സാങ്കൽപ്പിക ഗ്രൂപ്പുകളും വിലയും'))));
  if (!r.products.length) { b.append(ui.empty(t('No products listed yet.', 'ഉൽപ്പന്നങ്ങൾ ഇതുവരെയില്ല.'))); return; }
  b.append(h('div', { class: 'lvh-prod' }, r.products.map((p) => {
    const ph = h('div', { class: 'ph' }, CAT_ICON[p.category] || '🛍️');
    if (p.has_photo) k.api.get(`/catalogue/${p.id}/photo`).then((x) => { if (x && x.photo) ph.replaceChildren(h('img', { src: x.photo, alt: p.name, loading: 'lazy' })); }).catch(() => {});
    return h('div', { class: 'p' }, ph, h('b', null, t(p.name, p.name_ml || p.name)), h('span', { class: 'lvh-money', style: { fontSize: '1.2rem' } }, rs(p.price), h('span', { class: 'small muted' }, ' / ' + p.unit)),
      h('span', { class: 'small muted' }, (p.group || '') + (p.hamlet ? ' · ' + t(p.hamlet.name, p.hamlet.name_ml) : '')),
      p.in_stock ? ui.badge(t('In stock', 'സ്റ്റോക്കുണ്ട്'), 'good') : ui.badge(t('Out of stock', 'സ്റ്റോക്കില്ല'), 'warn'),
      p.description ? h('span', { class: 'small' }, p.description) : null,
      say(k, `${p.name}, ${words(p.price)} per ${p.unit}`, `${p.name_ml || p.name}, ${wordsMl(p.price)}`));
  })));
}
async function manageProducts(b, k, m) {
  const { h, t, ui } = k;
  const gid = k.params.group || '';
  const rows = await k.api.get('/products' + (gid ? '?group_id=' + encodeURIComponent(gid) : ''));
  b.append(ui.table([
    { key: 'name', label: t('Product', 'ഉൽപ്പന്നം'), render: (p) => (CAT_ICON[p.category] || '') + ' ' + t(p.name, p.name_ml || p.name) },
    { key: 'group', label: t('Group', 'ഗ്രൂപ്പ്'), render: (p) => (p.group ? t(p.group.name, p.group.name_ml || p.group.name) : '') },
    { key: 'price', label: t('Price', 'വില'), render: (p) => rs(p.price) + ' / ' + p.unit },
    { key: 'stock', label: t('Stock', 'സ്റ്റോക്ക്') },
    { key: 'status', label: t('Status', 'നില'), render: (p) => (p.status === 'listed' ? ui.badge(t('Listed', 'ലിസ്റ്റ് ചെയ്തു'), 'good') : p.group_agreed ? ui.badge(t('Group agreed — waiting for approval', 'ഗ്രൂപ്പ് സമ്മതിച്ചു — അംഗീകാരം കാത്ത്'), 'warn') : ui.badge(t('Draft', 'കരട്'), 'info')) },
    { key: 'act', label: '', render: (p) => h('div', { class: 'row' },
      !p.group_agreed ? ui.button(t('Group agreed', 'ഗ്രൂപ്പ് സമ്മതിച്ചു'), async () => { await k.api.post(`/products/${p.id}/agree`, {}); k.refresh(); }, { small: true }) : null,
      m.can_approve_products && p.group_agreed && p.status !== 'listed' ? ui.button(t('Approve listing', 'ലിസ്റ്റിംഗ് അംഗീകരിക്കുക'), async () => { try { await k.api.post(`/products/${p.id}/approve`, {}); k.refresh(); } catch (e) { k.toast(e.message, 'bad'); } }, { small: true, tone: 'primary' }) : null,
      m.can_approve_products && p.status === 'listed' ? ui.button(t('Unlist', 'നീക്കുക'), async () => { await k.api.post(`/products/${p.id}/unlist`, {}); k.refresh(); }, { small: true, tone: 'ghost' }) : null) },
  ], rows, { empty: t('No products yet.', 'ഉൽപ്പന്നങ്ങളില്ല.') }));
  if (!gid) { b.append(h('p', { class: 'small muted' }, t('Open a group to add a product.', 'ഉൽപ്പന്നം ചേർക്കാൻ ഒരു ഗ്രൂപ്പ് തുറക്കുക.'))); return; }
  let photo = null;
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
  file.addEventListener('change', () => shrink(file.files[0]).then((d) => { photo = d; k.toast(t('Photo ready', 'ഫോട്ടോ തയ്യാർ'), 'good'); }).catch((e) => k.toast(e.message, 'bad')));
  b.append(ui.section(t('Add a product', 'ഉൽപ്പന്നം ചേർക്കുക'), [h('label', null, '📷 ' + t('Photo', 'ഫോട്ടോ') + ' ', file), ui.form([
    { name: 'name', label: t('Name', 'പേര്'), type: 'text', required: true },
    { name: 'name_ml', label: t('Name in Malayalam', 'മലയാളത്തിൽ പേര്'), type: 'text' },
    { name: 'category', label: t('Kind', 'തരം'), type: 'select', options: m.categories.map((c) => ({ value: c, label: (CAT_ICON[c] || '') + ' ' + c })) },
    { name: 'unit', label: t('Sold per', 'വിൽക്കുന്നത്'), type: 'select', required: true, options: m.units },
    { name: 'price', label: t('Price (₹)', 'വില (₹)'), type: 'number', required: true },
    { name: 'stock', label: t('How many in stock', 'സ്റ്റോക്കിൽ എത്ര'), type: 'number', value: 0 },
    { name: 'description', label: t('Short description', 'ചെറു വിവരണം'), type: 'textarea' },
  ], async (v) => { await k.api.post(`/groups/${gid}/products`, { ...v, price: toPaise(v.price), stock: Number(v.stock || 0), photo }); k.toast(t('Saved as draft. The group must agree, then the agency approves.', 'കരടായി സേവ് ചെയ്തു. ഗ്രൂപ്പ് സമ്മതിക്കണം, പിന്നെ ഏജൻസി അംഗീകരിക്കും.'), 'good'); k.refresh(); }, { submitLabel: t('Save', 'സേവ് ചെയ്യുക') })]));
}
// Shrink a camera photo to a JPEG data URL under ~200 KB.
function shrink(f) {
  return new Promise((res, rej) => {
    if (!f) return rej(new Error('No photo'));
    const img = new Image();
    img.onload = () => {
      let w = img.width, hh = img.height; const max = 900;
      if (w > max || hh > max) { const s = max / Math.max(w, hh); w = Math.round(w * s); hh = Math.round(hh * s); }
      const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d').drawImage(img, 0, 0, w, hh);
      let q = 0.8, d = c.toDataURL('image/jpeg', q);
      while (d.length > 270000 && q > 0.3) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
      URL.revokeObjectURL(img.src);
      d.length > 270000 ? rej(new Error('Photo too large')) : res(d);
    };
    img.onerror = () => rej(new Error('Could not read photo'));
    img.src = URL.createObjectURL(f);
  });
}

// ---------------- aggregate ----------------
async function impact(el, k) {
  const { h, t, ui } = k;
  el.append(hero(k, '📊', 'Self-help group trends', 'അയൽക്കൂട്ട കണക്കുകൾ', 'Groups, members, savings and loan repayment by hamlet. No names. Small numbers are hidden to protect families.', 'ഊര് തിരിച്ച് ഗ്രൂപ്പുകൾ, അംഗങ്ങൾ, സമ്പാദ്യം, വായ്പ തിരിച്ചടവ്. പേരുകളില്ല. ചെറിയ എണ്ണങ്ങൾ മറച്ചിരിക്കുന്നു.'));
  const r = await k.api.get('/aggregate');
  const T = r.totals;
  el.append(ui.grid([
    ui.stat(t('Groups', 'ഗ്രൂപ്പുകൾ'), T.groups, t(`${T.groups_active} met in the last 3 months`, `${T.groups_active} എണ്ണം കഴിഞ്ഞ 3 മാസം യോഗം ചേർന്നു`)),
    ui.stat(t('Members', 'അംഗങ്ങൾ'), T.members),
    ui.stat(t(`Saved in ${r.months} months`, `${r.months} മാസത്തെ സമ്പാദ്യം`), inr(T.savings_inr)),
    ui.stat(t('Loans repaid on time', 'കൃത്യ തിരിച്ചടവ്'), T.loans_on_time_pct === null ? '—' : T.loans_on_time_pct + '%', String(T.loans_open) + ' ' + t('open loans', 'നിലവിലെ വായ്പകൾ')),
  ], 150));
  if (r.trend.some((x) => x.savings_inr)) el.append(ui.section(t('Savings by month (₹)', 'മാസം തിരിച്ചുള്ള സമ്പാദ്യം (₹)'), [ui.bars(r.trend.map((x) => ({ label: x.month, value: x.savings_inr }))), h('p', { class: 'small muted' }, t(`Adds up the ${r.trend_hamlets} hamlet(s) shown in full below.`, `താഴെ മുഴുവനായി കാണിക്കുന്ന ${r.trend_hamlets} ഊരുകളുടെ ആകെ.`))]));
  el.append(ui.section(t('By hamlet', 'ഊര് തിരിച്ച്'), ui.table([
    { key: 'hamlet', label: t('Hamlet', 'ഊര്'), render: (x) => t(x.hamlet, x.hamlet_ml) },
    { key: 'groups', label: t('Groups', 'ഗ്രൂപ്പുകൾ') },
    { key: 'members', label: t('Members', 'അംഗങ്ങൾ') },
    { key: 'savings_inr', label: t('Savings', 'സമ്പാദ്യം'), render: (x) => inr(x.savings_inr) },
    { key: 'loans_open', label: t('Open loans', 'വായ്പകൾ') },
    { key: 'pct', label: t('On time', 'കൃത്യം'), render: (x) => (x.loans_on_time_pct === null ? '—' : x.loans_on_time_pct + '%') },
  ], r.hamlets, { empty: t('No groups yet.', 'ഗ്രൂപ്പുകളില്ല.') })));
  el.append(h('p', { class: 'small muted' }, t(r.note, r.note_ml) + ' ' + t(`Since ${r.since}. Scope: ${r.scope}.`, `${r.since} മുതൽ.`)));
}

const wrap = (fn) => async (el, k) => {
  k.style(CSS, 'livelihoods-css');
  try { if (!kindsCache) kindsCache = (await meta(k)).kinds; await fn(el, k); } catch (e) { el.append(k.ui.error(e)); }
};

export default {
  views: { home: wrap(home), group: wrap(group), meeting: wrap(meeting), my: wrap(my), review: wrap(review), catalogue: wrap(catalogue), impact: wrap(impact) },
};
