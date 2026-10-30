'use strict';
// AADI — Reach channels: SMS · IVR · WhatsApp for families without smartphones.
// The brain queues notifications (brain.notify → core `notifications`, status queued). This module
// mirrors each queued notification into its own outbox (by listening to the event log), picks the
// best channel for the person (phone presence + literacy + hamlet network), delivers via pluggable
// providers (simulator in demo — never calls real gateways) and records delivery outcomes.
// Note: modules cannot write core tables, so the authoritative delivery status lives in
// channels_outbox / channels_deliveries (see report: brain API request notifications.markSent).
const { makeProviders } = require('./providers');

const STAFF = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'];
const CHANNELS = ['auto', 'sms', 'ivr', 'whatsapp', 'app'];
const MAX_ATTEMPTS = 3;
const FALLBACK = { whatsapp: 'sms', sms: 'ivr', ivr: 'sms' };

const IVR_MENU = {
  root: { en: 'Welcome to AADI. Press 1 for attendance. Press 2 for today\'s quiz. Press 3 for scheme information. Press 9 to talk to your facilitator.', ml: 'ആദിയിലേക്ക് സ്വാഗതം. ഹാജർ അറിയാൻ 1 അമർത്തുക. ഇന്നത്തെ ക്വിസിന് 2. പദ്ധതി വിവരങ്ങൾക്ക് 3. ഫെസിലിറ്റേറ്ററോട് സംസാരിക്കാൻ 9 അമർത്തുക.' },
  options: {
    1: { en: 'Attendance', ml: 'ഹാജർ' }, 2: { en: 'Today\'s quiz', ml: 'ഇന്നത്തെ ക്വിസ്' },
    3: { en: 'Scheme information', ml: 'പദ്ധതി വിവരം' }, 9: { en: 'Talk to facilitator', ml: 'ഫെസിലിറ്റേറ്റർ' },
  },
};
const SCHEMES = [
  { en: 'Post-matric scholarship for ST students: apply through the e-Grantz portal with help at your centre.', ml: 'പട്ടികവർഗ വിദ്യാർത്ഥികൾക്കുള്ള പോസ്റ്റ്-മെട്രിക് സ്കോളർഷിപ്പ്: കേന്ദ്രത്തിന്റെ സഹായത്തോടെ ഇ-ഗ്രാന്റ്സ് വഴി അപേക്ഷിക്കുക.' },
  { en: 'Model Residential School admissions open for Class 5. Ask your facilitator for the form.', ml: 'മോഡൽ റസിഡൻഷ്യൽ സ്കൂൾ അഞ്ചാം ക്ലാസ് പ്രവേശനം. ഫോമിനായി ഫെസിലിറ്റേറ്ററെ സമീപിക്കുക.' },
  { en: 'PSC special recruitment for ST candidates: free coaching at the AADI centre on Saturdays.', ml: 'പട്ടികവർഗക്കാർക്കുള്ള PSC പ്രത്യേക നിയമനം: ശനിയാഴ്ചകളിൽ ആദി കേന്ദ്രത്തിൽ സൗജന്യ പരിശീലനം.' },
];
const QUIZ_BANK = [
  ['tuition', 'What is 7 x 8?', '7 x 8 എത്ര?', ['54', '56', '64', '48'], 1, '7 eights are 56.', '7 എട്ടുകൾ 56.'],
  ['tuition', 'Which is the capital of Kerala?', 'കേരളത്തിന്റെ തലസ്ഥാനം ഏത്?', ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'], 1, 'Thiruvananthapuram is the capital.', 'തിരുവനന്തപുരം ആണ് തലസ്ഥാനം.'],
  ['tuition', 'Plants make food using...', 'സസ്യങ്ങൾ ആഹാരം നിർമ്മിക്കുന്നത്...', ['Moonlight', 'Sunlight', 'Soil only', 'Rain only'], 1, 'Photosynthesis uses sunlight.', 'പ്രകാശസംശ്ലേഷണത്തിന് സൂര്യപ്രകാശം വേണം.'],
  ['tuition', 'Half of 50 is?', '50-ന്റെ പകുതി?', ['20', '25', '30', '15'], 1, '50 / 2 = 25.', '50 / 2 = 25.'],
  ['exams', 'Which river is the longest in Kerala?', 'കേരളത്തിലെ ഏറ്റവും നീളം കൂടിയ നദി?', ['Pamba', 'Periyar', 'Bharathapuzha', 'Chaliyar'], 1, 'Periyar (244 km).', 'പെരിയാർ (244 കി.മീ).'],
  ['exams', 'Silent Valley National Park is in which district?', 'സൈലന്റ് വാലി ഏത് ജില്ലയിൽ?', ['Idukki', 'Wayanad', 'Palakkad', 'Kannur'], 2, 'It is in Palakkad district.', 'പാലക്കാട് ജില്ലയിൽ.'],
  ['exams', 'Who wrote "Kerala Paniniyam"?', '"കേരളപാണിനീയം" എഴുതിയത്?', ['Kumaran Asan', 'A.R. Raja Raja Varma', 'Vallathol', 'Ulloor'], 1, 'A.R. Raja Raja Varma.', 'എ.ആർ. രാജരാജവർമ്മ.'],
  ['exams', 'If 5 pens cost Rs 60, 8 pens cost?', '5 പേനയ്ക്ക് 60 രൂപ, 8 പേനയ്ക്ക്?', ['90', '96', '100', '84'], 1, '60/5 = 12; 12 x 8 = 96.', '60/5 = 12; 12 x 8 = 96.'],
  ['exams', 'Article 46 of the Constitution protects the interests of...', 'ഭരണഘടനയുടെ 46-ാം അനുച്ഛേദം ആരുടെ താൽപര്യം?', ['Banks', 'SC/ST and weaker sections', 'Armed forces', 'Judges'], 1, 'Educational and economic interests of SC/ST.', 'പട്ടികജാതി/വർഗക്കാരുടെ വിദ്യാഭ്യാസ, സാമ്പത്തിക താൽപര്യങ്ങൾ.'],
  ['language', 'Choose the correct greeting for the morning.', 'രാവിലെ പറയേണ്ട അഭിവാദ്യം?', ['Good night', 'Good morning', 'Good evening', 'Goodbye'], 1, 'Good morning.', 'Good morning.'],
  ['language', '"Thank you" in Malayalam is...', '"Thank you" മലയാളത്തിൽ?', ['നന്ദി', 'സ്വാഗതം', 'ക്ഷമിക്കണം', 'ശരി'], 0, 'നന്ദി (nandi).', 'നന്ദി.'],
  ['language', 'Opposite of "big"?', '"big" ന്റെ വിപരീതം?', ['large', 'small', 'tall', 'huge'], 1, 'Small.', 'small.'],
  ['digital', 'Should you share your UPI PIN with a caller from the "bank"?', '"ബാങ്കിൽ" നിന്ന് വിളിക്കുന്നയാളോട് UPI PIN പറയാമോ?', ['Yes', 'No, never', 'Only on Sunday', 'If they insist'], 1, 'Never share your PIN. Banks never ask for it.', 'ഒരിക്കലും PIN പറയരുത്. ബാങ്ക് ചോദിക്കില്ല.'],
  ['digital', 'An OTP is...', 'OTP എന്നാൽ...', ['A free gift', 'A one-time secret code', 'Your phone number', 'A bank holiday'], 1, 'One-time password — keep it secret.', 'ഒറ്റത്തവണ രഹസ്യ കോഡ്.'],
  ['lifeskills', 'At a job interview you should...', 'ഇന്റർവ്യൂവിൽ നിങ്ങൾ...', ['Arrive late', 'Arrive on time', 'Not speak', 'Use the phone'], 1, 'Be on time.', 'സമയത്ത് എത്തുക.'],
  ['lifeskills', 'Emergency number for police in India?', 'ഇന്ത്യയിൽ പൊലീസ് അടിയന്തര നമ്പർ?', ['100 / 112', '101', '108', '1098'], 0, '112 (or 100).', '112 (അല്ലെങ്കിൽ 100).'],
  ['lifeskills', 'Childline number?', 'ചൈൽഡ്‌ലൈൻ നമ്പർ?', ['1098', '108', '100', '181'], 0, '1098 is Childline.', '1098.'],
  ['tuition', 'How many days in a week?', 'ഒരാഴ്ചയിൽ എത്ര ദിവസം?', ['5', '6', '7', '8'], 2, 'Seven days.', 'ഏഴ് ദിവസം.'],
  ['exams', 'The first Indian state to achieve full literacy (1991)?', 'സമ്പൂർണ സാക്ഷരത നേടിയ ആദ്യ സംസ്ഥാനം?', ['Goa', 'Kerala', 'Tamil Nadu', 'Mizoram'], 1, 'Kerala, 1991.', 'കേരളം, 1991.'],
  ['tuition', 'Which animal is called the "ship of the desert"?', '"മരുഭൂമിയിലെ കപ്പൽ"?', ['Horse', 'Camel', 'Elephant', 'Donkey'], 1, 'The camel.', 'ഒട്ടകം.'],
];

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError } = ctx;
  const now = () => new Date().toISOString();
  const S = (v, max = 500) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const inList = (ids) => ids.map(() => '?').join(',') || "''";
  const connectivityOf = (hid) => (brain.hamlets.get(hid) || {}).connectivity;
  const providers = makeProviders({ connectivityOf });
  const STAFF_ONLY = requires('ops');
  const mask = (ph) => (ph ? '••••••' + String(ph).slice(-4) : null);

  // ---------------- channel routing ----------------
  // Whom do we actually reach, and how? Children usually have no phone → their guardian's phone.
  function route(person, requested = 'auto') {
    if (!person) return { error: 'person not found' };
    let target = person, relation = 'self';
    if (!person.phone && person.guardian_id) { const g = brain.persons.raw(person.guardian_id); if (g && g.phone) { target = g; relation = 'guardian'; } }
    if (!target.phone) return { channel: 'app', target, relation, reason: 'no phone on record — shown in app / at centre only' };
    const conn = connectivityOf(person.hamlet_id) || '2g';
    if (requested && requested !== 'auto' && CHANNELS.includes(requested)) return { channel: requested, target, relation, reason: 'requested' };
    const lit = target.literacy_level || 'basic';
    if (['none', 'emerging'].includes(lit)) return { channel: 'ivr', target, relation, reason: 'low literacy → voice call' };
    if (lit === 'basic') return { channel: conn === 'none' ? 'ivr' : 'sms', target, relation, reason: 'basic literacy → short SMS' };
    if (conn === '4g' && target.kind === 'youth') return { channel: 'whatsapp', target, relation, reason: 'smartphone + 4G' };
    return { channel: 'sms', target, relation, reason: 'feature phone friendly' };
  }

  // ---------------- outbox capture from core notifications ----------------
  function enqueueFromNotification(n, extra = {}) {
    if (!n || !n.id) return null;
    const ex = sqlOne('SELECT * FROM channels_outbox WHERE notification_id=? AND deleted=0', n.id);
    if (ex) return ex;
    return data.put('channels_outbox', { notification_id: n.id, person_id: n.person_id, hamlet_id: n.hamlet_id, agency_id: extra.agency_id || null, module: n.module || 'core', kind: extra.kind || 'notification', ref_id: extra.ref_id || null, channel: n.channel || 'auto', message: S(n.message, 1000), status: 'queued', attempts: 0, created_at: n.created_at || now() }, null);
  }
  on('row.upsert', (ev) => {
    const p = ev.payload || {};
    if (p.table !== 'notifications' || !p.row || p.row.status !== 'queued' || p.row.deleted) return;
    enqueueFromNotification(p.row);
  });
  // queue through the brain (so the notification exists in core too) and mirror immediately with context
  function queue(personId, message, opts, user) {
    const n = brain.notify(personId, message, { channel: opts.channel || 'auto' }, user);
    return enqueueFromNotification({ ...n, module: 'channels' }, opts);
  }

  // ---------------- delivery processor ----------------
  let processing = false;
  async function processOutbox({ limit = 200 } = {}) {
    if (processing) return { skipped: 'busy' };
    processing = true;
    const out = { sent: 0, failed: 0, retry: 0 };
    try {
      // sweep: core notifications not yet mirrored (e.g. synced in from a hub, or queued before boot)
      for (const n of brain.notifications.queued(limit)) enqueueFromNotification(n);
      const rows = sql('SELECT * FROM channels_outbox WHERE deleted=0 AND status IN (\'queued\',\'retry\') ORDER BY created_at LIMIT ?', limit);
      for (const o of rows) {
        const person = brain.persons.raw(o.person_id);
        const attempt = (o.attempts || 0) + 1;
        let r = route(person, o.channel);
        if (r.error) { data.put('channels_outbox', { id: o.id, status: 'failed', attempts: attempt, last_error: r.error }, null); if (o.notification_id) brain.notifications.setStatus(o.notification_id, 'failed'); out.failed++; continue; }
        let channel = r.channel;
        // on retry, fall back along whatsapp → sms → ivr (unless a specific channel was requested)
        if (attempt > 1 && channel !== 'app' && o.channel === 'auto') { for (let i = 1; i < attempt; i++) channel = FALLBACK[channel] || channel; }
        let res;
        try { res = await providers.for(channel).send({ channel, to: r.target.phone, message: o.message, ref: o.id, attempt, hamlet_id: o.hamlet_id, lang: 'ml' }); } catch (e) { res = { ok: false, error: e.message }; }
        tx(() => {
          data.put('channels_deliveries', { outbox_id: o.id, notification_id: o.notification_id, person_id: o.person_id, to_person_id: r.target.id, to_relation: r.relation, hamlet_id: o.hamlet_id, agency_id: o.agency_id, kind: o.kind, ref_id: o.ref_id, channel, provider: providers.for(channel).name, to_masked: mask(r.target.phone), message: o.message, status: res.ok ? 'delivered' : 'failed', error: res.ok ? null : res.error, attempt, cost_paise: res.cost_paise || 0, at: now() }, null);
          const status = res.ok ? 'sent' : attempt >= MAX_ATTEMPTS || channel === 'app' ? 'failed' : 'retry';
          data.put('channels_outbox', { id: o.id, status, attempts: attempt, last_error: res.ok ? null : `${channel}: ${res.error}`, sent_at: res.ok ? now() : null }, null);
          // mirror the final outcome onto the core notification row (attempt detail stays in channels_outbox)
          if (o.notification_id && status !== 'retry') brain.notifications.setStatus(o.notification_id, status === 'sent' ? (channel === 'app' ? 'delivered' : 'sent') : 'failed');
          if (res.ok) out.sent++; else if (status === 'failed') out.failed++; else out.retry++;
        });
        if (res.ok) emit('channels.delivered', { outbox_id: o.id, channel, kind: o.kind }, null, o.hamlet_id);
      }
    } finally { processing = false; }
    return out;
  }
  const timer = setInterval(() => { processOutbox().catch((e) => ctx.log('outbox error', e.message)); }, Number(process.env.AADI_OUTBOX_INTERVAL_MS) || 20000);
  if (timer.unref) timer.unref();

  // ---------------- visibility helpers ----------------
  const isSteward = (u) => u.role === 'platform_admin';
  // which outbox/delivery rows may a staff user see? Own agency's + rows about persons they can see.
  function staffRowFilter(u) {
    if (isSteward(u)) return () => true;
    const vis = new Set(brain.persons.visibleIds(u) || []);
    return (r) => r.agency_id === u.agency_id || vis.has(r.person_id);
  }
  function canReachPerson(u, pid) {
    if (u.person_id === pid) return true;
    if (u.role === 'guardian') return brain.policy.canSee(u, pid, 'profile').ok;
    return brain.policy.canSee(u, pid, 'contact').ok;
  }

  // ---------------- API: overview / stats ----------------
  router.get('/overview', STAFF_ONLY, (req, res) => {
    const u = req.user;
    const since = new Date(Date.now() - (Number(req.query.days) || 30) * 86400e3).toISOString();
    const keep = staffRowFilter(u);
    const dels = sql('SELECT id, person_id, agency_id, channel, status, kind, cost_paise, at, to_relation FROM channels_deliveries WHERE deleted=0 AND at>?', since).filter(keep);
    const box = sql('SELECT id, person_id, agency_id, status FROM channels_outbox WHERE deleted=0').filter(keep);
    const byChannel = {};
    for (const d of dels) { const c = byChannel[d.channel] || (byChannel[d.channel] = { channel: d.channel, delivered: 0, failed: 0, cost_paise: 0 }); c[d.status === 'delivered' ? 'delivered' : 'failed']++; c.cost_paise += d.cost_paise || 0; }
    const byKind = {};
    for (const d of dels) byKind[d.kind] = (byKind[d.kind] || 0) + (d.status === 'delivered' ? 1 : 0);
    const days = [];
    for (let i = 13; i >= 0; i--) { const day = new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10); days.push({ day, n: dels.filter((d) => d.at.slice(0, 10) === day && d.status === 'delivered').length }); }
    const callbacks = sql('SELECT * FROM channels_ivr_calls WHERE deleted=0 AND status=\'callback_requested\' ORDER BY at DESC LIMIT 50').filter((c) => isSteward(u) || brain.policy.canSee(u, c.person_id, 'contact').ok);
    res.json({
      providers: providers.describe(), live: providers.live,
      queue: { queued: box.filter((b) => b.status === 'queued').length, retry: box.filter((b) => b.status === 'retry').length, sent: box.filter((b) => b.status === 'sent').length, failed: box.filter((b) => b.status === 'failed').length },
      byChannel: Object.values(byChannel), byKind, daily: days, reached_via_guardian: dels.filter((d) => d.to_relation === 'guardian' && d.status === 'delivered').length,
      callbacks: callbacks.map((c) => ({ id: c.id, person_id: c.person_id, name: brain.persons.raw(c.person_id)?.name, at: c.at, lang: c.lang })),
    });
  });

  router.post('/process', STAFF_ONLY, async (req, res) => { res.json(await processOutbox({ limit: Math.min(Number(req.body?.limit) || 500, 2000) })); });

  router.get('/outbox', STAFF_ONLY, (req, res) => {
    const u = req.user;
    const keep = staffRowFilter(u);
    let rows = sql('SELECT * FROM channels_outbox WHERE deleted=0 ORDER BY created_at DESC LIMIT 600').filter(keep);
    if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
    res.json(rows.slice(0, 200).map((r) => {
      const p = brain.persons.raw(r.person_id);
      const visible = isSteward(u) || brain.policy.canSee(u, r.person_id, 'profile').ok;
      return { id: r.id, person: visible && p ? p.name : 'Learner (hidden)', hamlet_id: r.hamlet_id, kind: r.kind, module: r.module, channel: r.channel, status: r.status, attempts: r.attempts, last_error: r.last_error, created_at: r.created_at, sent_at: r.sent_at, message: visible ? r.message : null };
    }));
  });

  // ---------------- feature-phone simulator ----------------
  router.get('/phone/people', authed, (req, res) => {
    const u = req.user;
    let people;
    if (['learner', 'guardian'].includes(u.role)) people = brain.persons.visible(u, { limit: 20 });
    else if (STAFF.includes(u.role)) people = brain.persons.visible(u, { hamlet_id: req.query.hamlet_id || null, q: req.query.q || null, limit: 60 }).filter((p) => canReachPerson(u, p.id));
    else return res.json([]);
    res.json(people.map((p) => { const r = route(brain.persons.raw(p.id)); return { id: p.id, name: p.name, kind: p.kind, hamlet_id: p.hamlet_id, channel: r.channel, via: r.relation, reason: r.reason }; }));
  });
  router.get('/phone/:pid', authed, (req, res) => {
    const u = req.user, pid = req.params.pid;
    if (!canReachPerson(u, pid)) throw httpError(403, 'You can open this phone only for yourself, your ward, or a learner who gave your agency contact consent.');
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'Not found');
    const r = route(p);
    const inbox = sql('SELECT id, channel, message, status, at, to_relation, person_id, kind FROM channels_deliveries WHERE deleted=0 AND (person_id=? OR to_person_id=?) AND status=\'delivered\' AND channel IN (\'sms\',\'whatsapp\',\'ivr\') ORDER BY at DESC LIMIT 60', pid, pid);
    const inbound = sql('SELECT id, body, at, parsed FROM channels_inbound WHERE deleted=0 AND person_id=? ORDER BY at DESC LIMIT 30', pid);
    const h = brain.hamlets.get(p.hamlet_id) || {};
    res.json({ person: { id: p.id, first_name: String(p.name).split(' ')[0], kind: p.kind, literacy: p.literacy_level, has_phone: !!p.phone, phone_masked: mask(r.target && r.target.phone), via: r.relation }, hamlet: { name: h.name, name_ml: h.name_ml, connectivity: h.connectivity }, channel: r.channel, reason: r.reason, inbox, inbound, quiz: todaysQuiz(), points: points(pid) });
  });

  // ---------------- IVR ----------------
  function attendanceSummary(pid) {
    try {
      const rows = sql('SELECT status, date FROM learning_attendance WHERE deleted=0 AND person_id=? ORDER BY date DESC LIMIT 20', pid);
      if (!rows.length) return null;
      const present = rows.filter((r) => ['present', 'late'].includes(r.status)).length;
      return { present, total: rows.length, last: rows[0].date };
    } catch (_) { return null; } // learning module not installed
  }
  function schemeLines(hid) {
    try {
      const rows = sql('SELECT title, title_ml, body, body_ml FROM community_notices WHERE deleted=0 AND hamlet_id=? AND category IN (\'scholarship\',\'hostel\',\'livelihood\',\'documents\',\'rights\') ORDER BY posted_at DESC LIMIT 2', hid);
      if (rows.length) return rows.map((r) => ({ en: `${r.title}. ${S(r.body, 180)}`, ml: `${r.title_ml || r.title}. ${S(r.body_ml || r.body, 180)}` }));
    } catch (_) { /* community module absent */ }
    return SCHEMES;
  }
  // body: { person_id, digits: "1" | "2" | "2,3" | "9", lang }
  router.post('/ivr/call', authed, (req, res) => {
    const u = req.user, b = req.body || {};
    const pid = S(b.person_id, 64) || u.person_id;
    if (!pid || !canReachPerson(u, pid)) throw httpError(403, 'Not permitted for this person.');
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'Not found');
    const lang = b.lang === 'en' ? 'en' : 'ml';
    const digits = String(b.digits || '').split(/[,\s]+/).filter(Boolean).slice(0, 4);
    const say = [IVR_MENU.root[lang]];
    let outcome = 'menu', status = 'done';
    const d = digits[0];
    if (d === '1') {
      const a = brain.policy.canSee(u, pid, 'progress').ok ? attendanceSummary(pid) : null;
      say.push(a ? (lang === 'ml' ? `കഴിഞ്ഞ ${a.total} ക്ലാസുകളിൽ ${a.present} എണ്ണത്തിൽ ഹാജരായി.` : `Present in ${a.present} of the last ${a.total} classes.`) : (lang === 'ml' ? 'ഹാജർ വിവരം ഇപ്പോൾ ലഭ്യമല്ല.' : 'Attendance is not available right now.'));
      outcome = 'attendance';
    } else if (d === '2') {
      const q = todaysQuiz();
      if (q) {
        say.push(lang === 'ml' ? q.question_ml : q.question, ...q.options.map((o, i) => `${i + 1}: ${o}`));
        if (digits[1]) {
          const r = scoreReply(pid, q, Number(digits[1]) - 1, 'ivr', u);
          say.push(r.correct ? (lang === 'ml' ? 'ശരിയുത്തരം! അഭിനന്ദനങ്ങൾ.' : 'Correct! Well done.') : (lang === 'ml' ? 'തെറ്റി. ' : 'Not quite. ') + (lang === 'ml' ? q.explanation_ml : q.explanation));
        }
        outcome = 'quiz';
      } else say.push(lang === 'ml' ? 'ഇന്ന് ക്വിസ് ഇല്ല.' : 'No quiz today.');
    } else if (d === '3') {
      for (const s of schemeLines(p.hamlet_id)) say.push(s[lang]);
      outcome = 'schemes';
    } else if (d === '9') {
      say.push(lang === 'ml' ? 'നിങ്ങളുടെ ഫെസിലിറ്റേറ്റർ ഉടൻ തിരികെ വിളിക്കും.' : 'Your facilitator will call you back soon.');
      outcome = 'callback'; status = 'callback_requested';
      emit('channels.callback_requested', { person_id: pid }, u, p.hamlet_id);
    }
    const call = data.put('channels_ivr_calls', { person_id: pid, hamlet_id: p.hamlet_id, lang, path: digits, outcome, duration_s: 15 + say.join(' ').length / 12 | 0, at: now(), handled_by: null, status }, u);
    res.json({ call_id: call.id, lang, menu: IVR_MENU, say, outcome });
  });
  router.post('/ivr/callbacks/:id/done', STAFF_ONLY, (req, res) => {
    const c = data.get('channels_ivr_calls', req.params.id);
    if (!c) throw httpError(404, 'Not found');
    if (!isSteward(req.user) && !brain.policy.canSee(req.user, c.person_id, 'contact').ok) throw httpError(403, 'No contact consent');
    res.json(data.put('channels_ivr_calls', { id: c.id, status: 'done', handled_by: req.user.display_name }, req.user));
  });
  router.get('/ivr/calls', STAFF_ONLY, (req, res) => {
    const u = req.user;
    const rows = sql('SELECT * FROM channels_ivr_calls WHERE deleted=0 ORDER BY at DESC LIMIT 500').filter((c) => isSteward(u) || brain.policy.canSee(u, c.person_id, 'contact').ok).slice(0, 100);
    const byOutcome = {};
    for (const r of rows) byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;
    res.json({ calls: rows.map((r) => ({ ...r, name: brain.persons.raw(r.person_id)?.name })), byOutcome });
  });

  // ---------------- SMS quiz ----------------
  function todaysQuiz(date = now().slice(0, 10)) {
    const q = sqlOne('SELECT * FROM channels_quiz WHERE deleted=0 AND date=?', date);
    if (q) return q;
    const all = sql('SELECT * FROM channels_quiz WHERE deleted=0 ORDER BY date');
    if (!all.length) return null;
    const dayNo = Math.floor(Date.parse(date) / 86400e3);
    return all[dayNo % all.length];
  }
  function points(pid) { return sqlOne('SELECT COALESCE(SUM(points),0) p, COUNT(*) n, COALESCE(SUM(correct),0) c FROM channels_quiz_replies WHERE deleted=0 AND person_id=?', pid); }
  function scoreReply(pid, q, choice, via, user) {
    const p = brain.persons.raw(pid);
    const dup = sqlOne('SELECT * FROM channels_quiz_replies WHERE deleted=0 AND quiz_id=? AND person_id=? AND at>=?', q.id, pid, now().slice(0, 10));
    if (dup) return { ...dup, duplicate: true };
    const correct = choice === Number(q.answer) ? 1 : 0;
    const row = data.put('channels_quiz_replies', { quiz_id: q.id, person_id: pid, hamlet_id: p.hamlet_id, agency_id: null, reply: String(choice + 1), correct, points: correct ? 10 : 2, via, at: now() }, user);
    emit('channels.quiz_answered', { person_id: pid, correct: !!correct, via }, user, p.hamlet_id);
    const tot = points(pid);
    if (tot.c >= 10) brain.passport.award({ person_id: pid, type: 'milestone', ref: 'channels.sms_quiz_10', title: 'SMS Quiz Champion — 10 correct answers', level: 1, evidence: { correct: tot.c } }, user);
    return row;
  }
  router.get('/quiz', authed, (req, res) => {
    const q = todaysQuiz();
    const isStaff = STAFF.includes(req.user.role);
    res.json({ today: q ? { id: q.id, date: q.date, track: q.track, question: q.question, question_ml: q.question_ml, options: q.options, ...(isStaff ? { answer: q.answer } : {}) } : null, bank: isStaff ? sql('SELECT id, date, track, question FROM channels_quiz WHERE deleted=0 ORDER BY date DESC LIMIT 60') : [] });
  });
  router.post('/quiz', requires('teach', 'ops'), (req, res) => {
    const b = req.body || {};
    const options = (Array.isArray(b.options) ? b.options : String(b.options || '').split('|')).map((o) => S(o, 60)).filter(Boolean).slice(0, 4);
    if (!S(b.question) || options.length < 2) throw httpError(400, 'A question and at least two options are needed.');
    const answer = Number(b.answer);
    if (!(answer >= 0 && answer < options.length)) throw httpError(400, 'Mark the correct option.');
    res.json(data.put('channels_quiz', { date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : now().slice(0, 10), track: S(b.track, 20) || 'tuition', question: S(b.question, 200), question_ml: S(b.question_ml, 300), options, answer, explanation: S(b.explanation, 200), explanation_ml: S(b.explanation_ml, 300) }, req.user));
  });
  // send today's quiz to a cohort by SMS (contact-consented only)
  router.post('/quiz/send', STAFF_ONLY, (req, res) => {
    const q = todaysQuiz();
    if (!q) throw httpError(400, 'No quiz in the bank');
    const msg = `AADI Quiz: ${q.question_ml || q.question} ${q.options.map((o, i) => `${i + 1}) ${o}`).join(' ')} — reply QUIZ <number>`;
    const r = sendToCohort(req.user, { ...req.body, message: msg, kind: 'quiz', ref: q.id, title: 'Daily SMS quiz', channel: 'sms' });
    res.json(r);
  });
  // simulated inbound SMS reply ("QUIZ 2") or the phone simulator's keypad
  router.post('/sms/inbound', authed, (req, res) => {
    const u = req.user, b = req.body || {};
    const pid = S(b.person_id, 64) || u.person_id;
    if (!pid || !canReachPerson(u, pid)) throw httpError(403, 'Not permitted for this person.');
    const p = brain.persons.raw(pid);
    const body = S(b.body, 160);
    const m = /^\s*(?:QUIZ|Q|ക്വിസ്)?\s*([1-4])\s*$/i.exec(body);
    let parsed = { kind: 'unknown' }, reply = 'AADI: Sorry, we did not understand. Reply QUIZ 1-4, or call the centre.';
    if (m) {
      const q = todaysQuiz();
      if (q) {
        const r = scoreReply(pid, q, Number(m[1]) - 1, 'sms', u);
        parsed = { kind: 'quiz', choice: Number(m[1]), correct: !!r.correct, duplicate: !!r.duplicate };
        const tot = points(pid);
        reply = r.duplicate ? 'AADI: You already answered today. New question tomorrow!' : r.correct ? `AADI: ശരി! Correct! +10 points. Total ${tot.p}.` : `AADI: ${q.explanation_ml || q.explanation} +2 points for trying. Total ${tot.p}.`;
      }
    } else if (/^\s*(STOP|നിർത്തുക)\s*$/i.test(body)) { parsed = { kind: 'stop' }; reply = 'AADI: Noted. Your facilitator will confirm and update your consent with you.'; }
    data.put('channels_inbound', { person_id: pid, hamlet_id: p.hamlet_id, channel: 'sms', body, parsed, at: now() }, u);
    // reply goes straight back to the same handset (it initiated the conversation)
    const r = route(p, 'sms');
    data.put('channels_deliveries', { outbox_id: null, person_id: pid, to_person_id: r.target ? r.target.id : pid, to_relation: r.relation, hamlet_id: p.hamlet_id, agency_id: null, kind: 'reply', ref_id: null, channel: 'sms', provider: providers.for('sms').name, to_masked: mask(r.target && r.target.phone), message: reply, status: 'delivered', attempt: 1, cost_paise: 18, at: now() }, u);
    res.json({ parsed, reply });
  });
  router.get('/quiz/leaderboard', authed, (req, res) => {
    const u = req.user;
    const rows = sql('SELECT person_id, hamlet_id, SUM(points) points, SUM(correct) correct, COUNT(*) answers FROM channels_quiz_replies WHERE deleted=0 GROUP BY person_id ORDER BY points DESC LIMIT 300');
    const vis = brain.persons.visibleIds(u);
    const ok = (pid) => vis === null || vis.includes(pid);
    res.json(rows.filter((r) => ok(r.person_id)).slice(0, 20).map((r) => ({ ...r, first_name: String(brain.persons.raw(r.person_id)?.name || '').split(' ')[0] })));
  });

  // ---------------- broadcasts ----------------
  function sendToCohort(u, b) {
    const hamlet_id = S(b.hamlet_id, 64) || null;
    const programme_id = S(b.programme_id, 64) || null;
    if (!hamlet_id && !programme_id) throw httpError(400, 'Choose a hamlet or a programme');
    let pool;
    if (programme_id) {
      const pr = brain.programmes.get(programme_id);
      if (!pr) throw httpError(404, 'Programme not found');
      if (!isSteward(u) && pr.agency_id !== u.agency_id) throw httpError(403, 'You can message only your own agency\'s programmes.');
      const vis = brain.persons.visibleIds(u);
      pool = brain.enrolments.forProgramme(pr.id).filter((e) => e.status === 'active').map((e) => e.person_id).filter((pid) => vis === null || vis.includes(pid));
    } else {
      if (!brain.hamlets.get(hamlet_id)) throw httpError(404, 'Hamlet not found');
      pool = brain.persons.visible(u, { hamlet_id, limit: 5000 }).filter((p) => p.kind !== 'adult' || b.audience === 'all').map((p) => p.id);
    }
    pool = [...new Set(pool)];
    const agency_id = u.agency_id;
    const message = S(b.message, 600);
    if (!message) throw httpError(400, 'Write a message');
    let queued = 0, skipped = 0;
    const bc = data.put('channels_broadcasts', { agency_id, hamlet_id: hamlet_id || (programme_id && brain.programmes.get(programme_id).hamlet_id), programme_id, audience: S(b.audience, 20) || 'learners', title: S(b.title, 120) || 'Broadcast', message, message_ml: S(b.message_ml, 900), channel: CHANNELS.includes(b.channel) ? b.channel : 'auto', sent_by: u.id, sent_by_name: u.display_name, at: now(), targeted: pool.length, skipped_no_consent: 0, queued: 0 }, u);
    const ref = b.kind === 'quiz' ? b.ref : bc.id;
    const nowIso = now();
    const contactOk = new Set(agency_id ? sql('SELECT person_id, scopes, expires_at FROM consents WHERE deleted=0 AND status=\'active\' AND agency_id=?', agency_id).filter((c) => Array.isArray(c.scopes) && c.scopes.includes('contact') && (!c.expires_at || c.expires_at > nowIso)).map((c) => c.person_id) : []);
    tx(() => {
      for (const pid of pool) {
        // contact consent with the sender's agency is required for every recipient (stewards included)
        if (!contactOk.has(pid)) { skipped++; continue; }
        queue(pid, b.message_ml ? S(b.message_ml, 900) : message, { channel: bc.channel, agency_id, kind: b.kind || 'broadcast', ref_id: ref }, u);
        queued++;
      }
      data.put('channels_broadcasts', { id: bc.id, queued, skipped_no_consent: skipped }, u);
    });
    emit('channels.broadcast_sent', { broadcast_id: bc.id, queued, skipped }, u, bc.hamlet_id);
    brain.audit(u, 'broadcast', bc.id, { queued, skipped });
    return { broadcast_id: bc.id, targeted: pool.length, queued, skipped_no_consent: skipped };
  }
  router.post('/broadcasts', STAFF_ONLY, (req, res) => res.json(sendToCohort(req.user, req.body || {})));
  router.get('/broadcasts', STAFF_ONLY, (req, res) => {
    const u = req.user;
    const rows = sql('SELECT * FROM channels_broadcasts WHERE deleted=0 ORDER BY at DESC LIMIT 100').filter((r) => isSteward(u) || r.agency_id === u.agency_id);
    const ids = rows.map((r) => r.id);
    const st = ids.length ? sql(`SELECT ref_id, channel, status, COUNT(*) n FROM channels_deliveries WHERE deleted=0 AND ref_id IN (${inList(ids)}) GROUP BY ref_id, channel, status`, ...ids) : [];
    const pend = ids.length ? sql(`SELECT ref_id, COUNT(*) n FROM channels_outbox WHERE deleted=0 AND status IN ('queued','retry') AND ref_id IN (${inList(ids)}) GROUP BY ref_id`, ...ids) : [];
    const hm = Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
    res.json(rows.map((r) => {
      const s = st.filter((x) => x.ref_id === r.id);
      const delivered = s.filter((x) => x.status === 'delivered').reduce((a, x) => a + x.n, 0);
      const byChannel = {};
      for (const x of s.filter((y) => y.status === 'delivered')) byChannel[x.channel] = (byChannel[x.channel] || 0) + x.n;
      return { ...r, hamlet_name: hm[r.hamlet_id]?.name, delivered, failed_attempts: s.filter((x) => x.status === 'failed').reduce((a, x) => a + x.n, 0), pending: pend.find((x) => x.ref_id === r.id)?.n || 0, byChannel };
    }));
  });

  // ---------------- guardian weekly digest ----------------
  function digestFor(child) {
    const since = new Date(Date.now() - 7 * 86400e3).toISOString();
    let att = null;
    try {
      const rows = sql('SELECT status FROM learning_attendance WHERE deleted=0 AND person_id=? AND date>=?', child.id, since.slice(0, 10));
      if (rows.length) att = { present: rows.filter((r) => ['present', 'late'].includes(r.status)).length, total: rows.length };
    } catch (_) { /* learning absent */ }
    let lessons = 0;
    try { lessons = sqlOne('SELECT COUNT(*) n FROM learning_progress WHERE deleted=0 AND person_id=? AND completed_at>=?', child.id, since).n; } catch (_) { /* absent */ }
    const badges = brain.passport.entries(child.id).filter((e) => e.issued_at >= since).map((e) => e.title).slice(0, 2);
    const first = String(child.name).split(' ')[0];
    const parts = [`AADI ${first}:`];
    parts.push(att ? `ഈ ആഴ്ച ${att.total}-ൽ ${att.present} ക്ലാസിൽ ഹാജർ.` : 'ഈ ആഴ്ച ഹാജർ രേഖയില്ല.');
    if (lessons) parts.push(`${lessons} പാഠം പൂർത്തിയാക്കി.`);
    if (badges.length) parts.push(`പുതിയ നേട്ടം: ${badges.join(', ')}.`);
    parts.push(att && att.total && att.present / att.total < 0.5 ? 'കുട്ടിയെ ക്ലാസിൽ അയയ്ക്കാൻ സഹായിക്കണേ.' : 'നന്നായി! തുടരുക.');
    return { message: parts.join(' '), att, lessons, badges };
  }
  router.post('/digest/run', STAFF_ONLY, (req, res) => {
    const u = req.user, b = req.body || {};
    const kids = brain.persons.visible(u, { hamlet_id: S(b.hamlet_id, 64) || null, kind: 'child', limit: 5000 });
    let queued = 0, skipped = 0;
    const preview = [];
    tx(() => {
      for (const k of kids) {
        const raw = brain.persons.raw(k.id);
        if (!raw.guardian_id) { skipped++; continue; }
        if (!brain.policy.canSee(u, k.id, 'progress').ok || !u.agency_id || !brain.consent.has(k.id, u.agency_id, 'contact')) { skipped++; continue; }
        const d = digestFor(raw);
        if (b.dry_run) { if (preview.length < 5) preview.push({ child: String(raw.name).split(' ')[0], message: d.message }); queued++; continue; }
        queue(k.id, d.message, { channel: 'auto', agency_id: u.agency_id, kind: 'digest', ref_id: 'digest-' + now().slice(0, 10) }, u);
        queued++;
        if (preview.length < 5) preview.push({ child: String(raw.name).split(' ')[0], message: d.message });
      }
    });
    res.json({ queued, skipped, preview, dry_run: !!b.dry_run });
  });

  // ---------------- seed ----------------
  async function seed(demo) {
    const { R, daysAgo, users } = demo;
    const st = users.steward;
    const all = demo.persons;
    const minutesAgo = (d) => new Date(Date.now() - d * 86400e3 - R.int(0, 600) * 60e3).toISOString();
    tx(() => {
      // quiz bank: one per day for the last 20 days + upcoming rotation
      const quizzes = QUIZ_BANK.map((q, i) => data.put('channels_quiz', { date: daysAgo(QUIZ_BANK.length - 1 - i).slice(0, 10), track: q[0], question: q[1], question_ml: q[2], options: q[3], answer: q[4], explanation: q[5], explanation_ml: q[6] }, st));
      const contactAgency = {};
      for (const c of sql('SELECT person_id, agency_id, scopes FROM consents WHERE deleted=0 AND status=\'active\'')) if (Array.isArray(c.scopes) && c.scopes.includes('contact') && !contactAgency[c.person_id]) contactAgency[c.person_id] = c.agency_id;
      const agencyFor = (pid) => contactAgency[pid] || null;
      const reachable = all.filter((p) => p.kind !== 'adult').map((p) => ({ p, a: agencyFor(p.id) })).filter((x) => x.a);
      // 6 months of history: broadcasts, reminders, digests, quizzes
      const TEMPL = [
        ['reminder', 'ക്ലാസ് ഇന്ന് വൈകിട്ട് 4 മണിക്ക്. മറക്കരുതേ! — AADI'],
        ['reminder', 'Tomorrow is the PSC mock test at the centre, 10 AM.'],
        ['broadcast', 'സ്കോളർഷിപ്പ് അപേക്ഷ അവസാന തീയതി അടുത്തു. കേന്ദ്രത്തിൽ സഹായം ലഭ്യം.'],
        ['broadcast', 'ആരോഗ്യ ക്യാമ്പ് ശനിയാഴ്ച ഊരിൽ. എല്ലാവരും വരിക.'],
        ['digest', 'AADI: ഈ ആഴ്ച 4-ൽ 3 ക്ലാസിൽ ഹാജർ. 2 പാഠം പൂർത്തിയാക്കി. നന്നായി! തുടരുക.'],
        ['quiz', 'AADI Quiz: 7 x 8 എത്ര? 1) 54 2) 56 3) 64 4) 48 — reply QUIZ <number>'],
      ];
      for (let i = 0; i < 900 && reachable.length; i++) {
        const { p, a } = R.pick(reachable);
        const [kind, msg] = R.pick(TEMPL);
        const d = R.int(0, 180);
        const r = route(p);
        const at = minutesAgo(d);
        const ok = r.channel === 'app' ? true : R.chance(r.channel === 'whatsapp' ? 0.8 : r.channel === 'ivr' ? 0.82 : 0.93);
        const o = data.put('channels_outbox', { notification_id: null, person_id: p.id, hamlet_id: p.hamlet_id, agency_id: a, module: kind === 'quiz' ? 'channels' : R.pick(['learning', 'community', 'channels']), kind, ref_id: null, channel: 'auto', message: msg, status: ok ? 'sent' : 'failed', attempts: ok ? 1 : MAX_ATTEMPTS, last_error: ok ? null : 'handset unreachable', created_at: at, sent_at: ok ? at : null }, st);
        data.put('channels_deliveries', { outbox_id: o.id, person_id: p.id, to_person_id: r.target ? r.target.id : p.id, to_relation: r.relation, hamlet_id: p.hamlet_id, agency_id: a, kind, ref_id: null, channel: r.channel, provider: 'simulator', to_masked: mask(r.target && r.target.phone), message: msg, status: ok ? 'delivered' : 'failed', error: ok ? null : 'handset unreachable', attempt: 1, cost_paise: r.channel === 'sms' ? 36 : r.channel === 'ivr' ? 90 : 35, at }, st);
      }
      // broadcasts with outcomes
      const BC = [
        ['Scholarship deadline', 'Post-matric scholarship: last date next Friday. Come to the centre with Aadhaar and bank passbook.', 'പോസ്റ്റ്-മെട്രിക് സ്കോളർഷിപ്പ്: അവസാന തീയതി അടുത്ത വെള്ളിയാഴ്ച. ആധാറും ബാങ്ക് പാസ്ബുക്കുമായി വരിക.'],
        ['Health camp', 'Free health and eye camp on Saturday at the hamlet.', 'ശനിയാഴ്ച ഊരിൽ സൗജന്യ ആരോഗ്യ, നേത്ര ക്യാമ്പ്.'],
        ['Exam week', 'SSLC model exam week — evening study at the centre till 7 PM.', 'SSLC മോഡൽ പരീക്ഷാ ആഴ്ച — വൈകിട്ട് 7 വരെ കേന്ദ്രത്തിൽ പഠനം.'],
        ['Onam holiday', 'Centre closed for Onam on Thursday and Friday. Happy Onam!', 'ഓണത്തിന് വ്യാഴം, വെള്ളി കേന്ദ്രം അവധി. ഓണാശംസകൾ!'],
      ];
      for (const h of demo.hamlets) {
        const pres = sql('SELECT agency_id FROM agency_presence WHERE hamlet_id=? AND deleted=0', h.id).map((x) => x.agency_id);
        for (let i = 0; i < 3; i++) {
          const ag = R.pick(pres);
          const [title, en, ml] = R.pick(BC);
          const targeted = reachable.filter((x) => x.p.hamlet_id === h.id).length + R.int(2, 9);
          const q = Math.max(0, targeted - R.int(2, 9));
          const bc = data.put('channels_broadcasts', { agency_id: ag, hamlet_id: h.id, programme_id: null, audience: 'learners', title, message: en, message_ml: ml, channel: 'auto', sent_by: st.id, sent_by_name: 'Facilitator (demo)', at: minutesAgo(R.int(3, 170)), targeted, skipped_no_consent: targeted - q, queued: q }, st);
          for (let j = 0; j < q; j++) {
            const ch = R.pick(['sms', 'sms', 'sms', 'ivr', 'whatsapp']);
            const ok = R.chance(0.9);
            data.put('channels_deliveries', { outbox_id: null, person_id: null, to_person_id: null, to_relation: 'self', hamlet_id: h.id, agency_id: ag, kind: 'broadcast', ref_id: bc.id, channel: ch, provider: 'simulator', to_masked: null, message: ml, status: ok ? 'delivered' : 'failed', error: ok ? null : 'handset unreachable', attempt: 1, cost_paise: ch === 'sms' ? 54 : 90, at: bc.at }, st);
          }
        }
      }
      // IVR calls & quiz replies
      const OUT = ['attendance', 'attendance', 'quiz', 'schemes', 'menu', 'callback'];
      for (let i = 0; i < 260 && reachable.length; i++) {
        const { p } = R.pick(reachable);
        const outcome = R.pick(OUT);
        data.put('channels_ivr_calls', { person_id: p.id, hamlet_id: p.hamlet_id, lang: R.chance(0.85) ? 'ml' : 'en', path: outcome === 'menu' ? [] : [String({ attendance: 1, quiz: 2, schemes: 3, callback: 9 }[outcome])], outcome, duration_s: R.int(20, 140), at: minutesAgo(R.int(0, 180)), handled_by: outcome === 'callback' ? 'Facilitator' : null, status: outcome === 'callback' ? (R.chance(0.85) ? 'done' : 'callback_requested') : 'done' }, st);
      }
      for (const qz of quizzes.filter((x) => x.date < now().slice(0, 10))) { // today's quiz is left open for the live demo
        for (const { p } of R.sample(reachable, R.int(15, 35))) {
          const choice = R.chance(0.62) ? qz.answer : R.int(0, qz.options.length - 1);
          const correct = choice === qz.answer ? 1 : 0;
          data.put('channels_quiz_replies', { quiz_id: qz.id, person_id: p.id, hamlet_id: p.hamlet_id, agency_id: null, reply: String(choice + 1), correct, points: correct ? 10 : 2, via: R.pick(['sms', 'sms', 'ivr']), at: qz.date + 'T15:' + String(R.int(10, 59)) + ':00.000Z' }, st);
        }
      }
    });
  }

  return {
    seed,
    processOutbox,
    health: () => ({ queued: sqlOne('SELECT COUNT(*) n FROM channels_outbox WHERE deleted=0 AND status IN (\'queued\',\'retry\')').n, providers: providers.describe() }),
  };
};
