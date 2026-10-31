'use strict';
// AADI — Career Counselling, Mentoring & Wellbeing (track: counselling).
//  • Aspiration mapping + realistic pathways (eligibility, exam, physical test, timeline) linked to exams/lifeskills.
//  • 1:1 mentor matching; supervised, fully logged mentor chat with a safety filter. Flagged messages are
//    held and sent to the safeguarding moderation queue (event `counselling.message_flagged`).
//  • Wellbeing pulse (5 emoji). Individual data: the learner and consenting counsellors only (+CPO, audited);
//    everyone else gets k-anonymised aggregates. Low pulses → follow-up task; "need to talk" escalates.
//  • Counsellor caseload: sessions with private notes, follow-ups.
const fs = require('fs');
const path = require('path');

let filter;
try { filter = require('../safeguarding/filter'); } catch (_) {
  // Fallback if the safeguarding module is absent: hold anything with contact info or meeting words.
  filter = { scan: (t) => { const s = String(t || ''); const r = []; if ((s.replace(/\D/g, '').length >= 10)) r.push('contact_number'); if (/whats\s?app|insta|meet (me|up)|alone|secret/i.test(s)) r.push('meeting_request'); return { flagged: r.length > 0, reasons: r, severity: r.length ? 'medium' : 'none' }; } };
}

const C = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'pathways.json'), 'utf8'));
const PW = Object.fromEntries(C.pathways.map((p) => [p.key, p]));
const STEWARD = ['platform_admin', 'cpo'];
const SUPERVISORS = ['counsellor', 'cpo', 'platform_admin'];
const K = 5;

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError } = ctx;
  const now = () => new Date().toISOString();
  const S = (v, max = 2000) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const isSteward = (u) => STEWARD.includes(u.role);

  function seeOrThrow(user, pid, scope) {
    const v = brain.policy.canSee(user, pid, scope);
    if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
    if (v.audited && user.person_id !== pid) brain.audit(user, 'person_read', pid, { scope });
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'Person not found');
    return p;
  }
  // Individual wellbeing: self, consenting counsellor, or steward (audited). Not guardians: a young
  // person's check-ins are their confidential space (they can choose to share in a session).
  function wellbeingAccess(user, pid) {
    if (user.person_id === pid) return brain.persons.raw(pid);
    if (user.role === 'counsellor' || isSteward(user)) return seeOrThrow(user, pid, 'wellbeing');
    throw httpError(403, 'Individual wellbeing data is only visible to the learner and their counsellor. Aggregates are available on the summary page.');
  }

  // ---------- pathways & aspirations ----------
  const pathwayFor = (asp) => C.pathways.find((p) => p.match.some((m) => String(asp || '').toLowerCase().includes(m.toLowerCase()))) || null;
  router.get('/pathways', authed, (req, res) => res.json({ pathways: C.pathways, note: C.note, moods: C.moods }));
  router.get('/pathways/:key', authed, (req, res) => { const p = PW[req.params.key]; if (!p) throw httpError(404, 'No such pathway'); res.json(p); });

  function lifeskillsDone(pid) {
    try { return sql('SELECT module_key FROM lifeskills_progress WHERE person_id=? AND passed=1 AND deleted=0', pid).map((r) => r.module_key); } catch (_) { return []; }
  }
  router.get('/aspirations/:personId', authed, (req, res) => {
    const p = seeOrThrow(req.user, req.params.personId, 'progress');
    const row = data.find('counselling_aspirations', { person_id: p.id })[0] || null;
    const keys = row && Array.isArray(row.pathway_keys) && row.pathway_keys.length ? row.pathway_keys : [pathwayFor(p.aspirations)].filter(Boolean).map((x) => x.key);
    const done = new Set(lifeskillsDone(p.id));
    res.json({ person: { id: p.id, name: p.name, kind: p.kind, school_class: p.school_class, aspirations: p.aspirations }, record: row, pathways: keys.map((k) => PW[k]).filter(Boolean).map((pw) => ({ ...pw, lifeskills_status: pw.lifeskills.map((m) => ({ key: m, done: done.has(m) })) })) });
  });
  router.put('/aspirations/:personId', authed, (req, res) => {
    const p = seeOrThrow(req.user, req.params.personId, 'progress');
    const self = req.user.person_id === p.id;
    if (!self && !['counsellor', 'mentor', 'platform_admin', 'cpo', 'facilitator'].includes(req.user.role)) throw httpError(403, 'Only the learner or their counsellor can change this.');
    const keys = (Array.isArray(req.body.pathway_keys) ? req.body.pathway_keys : []).filter((k) => PW[k]).slice(0, 3);
    if (!keys.length) throw httpError(400, 'Pick at least one pathway.');
    const cur = data.find('counselling_aspirations', { person_id: p.id })[0];
    const row = data.put('counselling_aspirations', { ...(cur || { person_id: p.id, hamlet_id: p.hamlet_id }), pathway_keys: keys, dream: S(req.body.dream, 300), strengths: S(req.body.strengths, 300), set_by: self ? 'self' : req.user.role, set_by_name: req.user.display_name, set_at: now() }, req.user);
    emit('counselling.aspiration_set', { person_id: p.id, pathways: keys }, req.user, p.hamlet_id);
    res.json(row);
  });

  // ---------- mentors & matching ----------
  function mentorProfile(u) {
    const prof = data.find('counselling_mentors', { user_id: u.id })[0] || {};
    const active = data.find('counselling_matches', { mentor_id: u.id, status: 'active' }).length;
    return { id: u.id, name: u.display_name, agency_id: u.agency_id, agency_name: u.agency_name, active: !!u.active, trained: !!u.safeguarding_trained, expertise: prof.expertise || [], languages: prof.languages || ['Malayalam'], capacity: Number(prof.capacity) || 4, bio: prof.bio || '', bio_ml: prof.bio_ml || '', load: active };
  }
  const mentors = () => brain.users.byRole('mentor').map(mentorProfile);
  router.get('/mentors', requires('counsel', 'mentor'), (req, res) => res.json(mentors()));

  function suggest(user, p) {
    const asp = data.find('counselling_aspirations', { person_id: p.id })[0];
    const keys = asp && asp.pathway_keys ? asp.pathway_keys : [pathwayFor(p.aspirations)].filter(Boolean).map((x) => x.key);
    return mentors().filter((m) => m.active && m.trained && m.load < m.capacity).map((m) => {
      const mentorUser = brain.users.get(m.id);
      const reach = brain.policy.canSee(mentorUser, p.id, 'profile').ok;
      const exp = keys.filter((k) => m.expertise.includes(k));
      const lang = m.languages.some((l) => String(p.language || 'Malayalam').toLowerCase().includes(l.toLowerCase()) || l === 'Malayalam');
      const score = (reach ? 0 : -100) + exp.length * 10 + (m.languages.some((l) => l.toLowerCase() === String(p.language || '').toLowerCase()) ? 6 : lang ? 2 : 0) + (m.capacity - m.load);
      return { ...m, score, reachable: reach, why: [exp.length ? 'Knows: ' + exp.map((k) => PW[k].title).join(', ') : null, lang ? 'Language: ' + m.languages.join(', ') : null, reach ? null : 'Mentor\'s agency has no consent for this learner'].filter(Boolean) };
    }).sort((a, b) => b.score - a.score);
  }
  router.get('/matches/suggest/:personId', requires('counsel'), (req, res) => {
    const p = seeOrThrow(req.user, req.params.personId, 'profile');
    res.json(suggest(req.user, p));
  });
  router.post('/matches', requires('counsel'), (req, res) => {
    const p = seeOrThrow(req.user, req.body.person_id, 'profile');
    const m = brain.users.get(req.body.mentor_id);
    if (!m || m.role !== 'mentor') throw httpError(400, 'Choose a mentor.');
    if (!m.active || !m.safeguarding_trained) throw httpError(409, 'This mentor has not completed safeguarding training and cannot be matched.');
    if (!brain.policy.canSee(m, p.id, 'profile').ok) throw httpError(409, 'The mentor\'s agency does not have consent from this learner/guardian.');
    if (data.find('counselling_matches', { person_id: p.id, status: 'active' }).length) throw httpError(409, 'This learner already has an active mentor. End that match first.');
    const pw = (data.find('counselling_aspirations', { person_id: p.id })[0] || {}).pathway_keys || [];
    const row = data.put('counselling_matches', { person_id: p.id, hamlet_id: p.hamlet_id, mentor_id: m.id, mentor_name: m.display_name, mentor_agency_id: m.agency_id, status: 'active', minor: brain.policy.isMinor(p) ? 1 : 0, pathway_key: pw[0] || (pathwayFor(p.aspirations) || {}).key || null, reason: S(req.body.reason, 300), matched_by: req.user.id, matched_by_name: req.user.display_name, started_at: now() }, req.user);
    emit('counselling.mentor_matched', { match_id: row.id, person_id: p.id, mentor_id: m.id }, req.user, p.hamlet_id);
    res.json(row);
  });
  router.post('/matches/:id/end', requires('counsel', 'mentor'), (req, res) => {
    const mt = data.get('counselling_matches', req.params.id);
    if (!mt) throw httpError(404, 'Not found');
    if (req.user.role === 'mentor' && mt.mentor_id !== req.user.id) throw httpError(403, 'Not your match');
    res.json(data.put('counselling_matches', { ...mt, status: 'ended', ended_at: now(), end_reason: S(req.body.reason, 300) }, req.user));
  });
  // Learner asks for a mentor → task for counsellors.
  router.post('/mentor-request', authed, (req, res) => {
    const pid = req.user.person_id;
    if (!pid) throw httpError(400, 'Only learners can request a mentor for themselves.');
    const p = brain.persons.raw(pid);
    const t = data.put('counselling_tasks', { person_id: pid, hamlet_id: p.hamlet_id, kind: 'mentor_request', priority: 'normal', status: 'open', reason: S(req.body.note, 300) || 'Learner asked for a mentor.', created_at: now(), due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) }, req.user);
    res.json({ ok: true, id: t.id });
  });

  function canSuperviseMatch(user, mt) {
    if (isSteward(user)) return true;
    if (user.role === 'counsellor') {
      const mentor = brain.users.get(mt.mentor_id);
      return (mentor && mentor.agency_id === user.agency_id) || brain.policy.canSee(user, mt.person_id, 'profile').ok;
    }
    return false;
  }
  const partyOf = (user, mt) => user.id === mt.mentor_id || (user.person_id && user.person_id === mt.person_id);

  router.get('/matches', authed, (req, res) => {
    const u = req.user;
    let rows;
    if (u.role === 'mentor') rows = data.find('counselling_matches', { mentor_id: u.id }, { order: 'started_at DESC' });
    else if (u.person_id && ['learner'].includes(u.role)) rows = data.find('counselling_matches', { person_id: u.person_id }, { order: 'started_at DESC' });
    else if (SUPERVISORS.includes(u.role)) rows = data.find('counselling_matches', {}, { order: 'started_at DESC', limit: 500 }).filter((m) => canSuperviseMatch(u, m));
    else throw httpError(403, 'Mentor chats are visible only to the mentor, the learner and their supervisors.');
    if (isSteward(u)) brain.audit(u, 'matches_list', 'matches', { n: rows.length });
    res.json(rows.map((m) => {
      const p = brain.persons.raw(m.person_id);
      const last = data.find('counselling_messages', { match_id: m.id }, { order: 'sent_at DESC', limit: 1 })[0];
      const held = data.find('counselling_messages', { match_id: m.id, status: 'held' }).length;
      return { ...m, person_name: p ? p.name : null, pathway_title: m.pathway_key && PW[m.pathway_key] ? PW[m.pathway_key].title : null, pathway_title_ml: m.pathway_key && PW[m.pathway_key] ? PW[m.pathway_key].title_ml : null, last_at: last ? last.sent_at : null, held: partyOf(u, m) && u.role !== 'mentor' ? undefined : held };
    }));
  });

  router.get('/matches/:id/messages', authed, (req, res) => {
    const mt = data.get('counselling_matches', req.params.id);
    if (!mt) throw httpError(404, 'Not found');
    const u = req.user;
    const party = partyOf(u, mt);
    if (!party && !canSuperviseMatch(u, mt)) throw httpError(403, 'Not permitted to view this conversation.');
    if (!party) brain.audit(u, 'chat_supervised_read', mt.id, { minor: !!mt.minor });
    const msgs = data.find('counselling_messages', { match_id: mt.id }, { order: 'sent_at ASC', limit: 1000 });
    res.json({ match: { ...mt, person_name: (brain.persons.raw(mt.person_id) || {}).name }, supervised: !party, notice: 'All messages are saved and may be reviewed by the counsellor / Child Protection Officer to keep everyone safe.', notice_ml: 'എല്ലാ സന്ദേശങ്ങളും സൂക്ഷിക്കുന്നു; എല്ലാവരുടെയും സുരക്ഷയ്ക്കായി കൗൺസിലർ / ചൈൽഡ് പ്രൊട്ടക്ഷൻ ഓഫീസർ പരിശോധിച്ചേക്കാം.',
      messages: msgs.filter((m) => !party || m.status === 'delivered' || m.sender_id === u.id).map((m) => ({ id: m.id, sender_id: m.sender_id, sender_role: m.sender_role, sender_name: m.sender_name, mine: m.sender_id === u.id, body: m.status === 'delivered' || !party || m.sender_id === u.id ? m.body : null, status: m.status, reasons: party ? undefined : m.reasons, sent_at: m.sent_at })) });
  });

  router.post('/matches/:id/messages', authed, (req, res) => {
    const mt = data.get('counselling_matches', req.params.id);
    if (!mt) throw httpError(404, 'Not found');
    const u = req.user;
    if (!partyOf(u, mt)) throw httpError(403, 'Only the mentor and learner can write in this chat.');
    if (mt.status !== 'active') throw httpError(409, 'This mentoring match has ended.');
    const body = S(req.body.body, 1000);
    if (!body) throw httpError(400, 'Empty message');
    const scan = filter.scan(body);
    const p = brain.persons.raw(mt.person_id);
    const row = data.put('counselling_messages', { match_id: mt.id, person_id: mt.person_id, hamlet_id: mt.hamlet_id, sender_id: u.id, sender_role: u.role, sender_name: u.display_name, body, status: scan.flagged ? 'held' : 'delivered', reasons: scan.reasons, adult_minor: mt.minor ? 1 : 0, sent_at: now() }, u);
    if (scan.flagged) {
      emit('counselling.message_flagged', { ref_id: row.id, match_id: mt.id, text: body, reasons: scan.reasons, severity: scan.severity === 'none' ? 'low' : scan.severity, author_id: u.id, author_role: u.role, target_person_id: mt.person_id, hamlet_id: mt.hamlet_id }, u, mt.hamlet_id);
    }
    if (!scan.flagged && u.role === 'mentor' && p) brain.notify(p.id, `${brain.brand.short}: നിങ്ങളുടെ മെന്ററിൽ നിന്ന് പുതിയ സന്ദേശം.`, { channel: 'app' }, u);
    res.json({ id: row.id, status: row.status, held: scan.flagged, reasons: scan.reasons, message: scan.flagged ? 'This message is being checked by the safety team before it is delivered. Please keep contact details and meeting plans out of chat.' : undefined, message_ml: scan.flagged ? 'ഈ സന്ദേശം അയക്കും മുമ്പ് സുരക്ഷാ ടീം പരിശോധിക്കുന്നു. ഫോൺ നമ്പറും കൂടിക്കാഴ്ച പദ്ധതികളും ചാറ്റിൽ ഒഴിവാക്കുക.' : undefined });
  });

  // Release / reject held messages once safeguarding decides.
  on('safeguarding.moderation_decided', (ev) => {
    const pl = ev.payload || {};
    if (pl.source_module !== 'counselling' || !pl.ref_id) return;
    const m = data.get('counselling_messages', pl.ref_id);
    if (!m || m.status !== 'held') return;
    data.put('counselling_messages', { ...m, status: pl.decision === 'approve' ? 'delivered' : pl.decision === 'escalate' ? 'escalated' : 'rejected', moderated_at: now() }, null);
  });

  // ---------- wellbeing pulse ----------
  function counsellorsFor(pid) {
    return brain.users.byRole('counsellor').filter((c) => c.active && brain.policy.canSee(c, pid, 'wellbeing').ok);
  }
  router.post('/pulse', authed, (req, res) => {
    const pid = req.user.person_id;
    if (!pid) throw httpError(400, 'Check-ins are for learners.');
    const mood = Number(req.body.mood);
    if (!(mood >= 1 && mood <= 5)) throw httpError(400, 'Pick one face.');
    const p = brain.persons.raw(pid);
    const needTalk = !!req.body.need_talk;
    const note = S(req.body.note, 500);
    const scan = filter.scan(note);
    const danger = scan.reasons.includes('self_harm_or_danger');
    const out = tx(() => {
      const row = data.put('counselling_pulses', { person_id: pid, hamlet_id: p.hamlet_id, mood, need_talk: needTalk ? 1 : 0, note, at: now() }, req.user);
      let task = null, escalated = false;
      const recent = data.find('counselling_pulses', { person_id: pid }, { order: 'at DESC', limit: 3 });
      const lowStreak = recent.length >= 2 && recent.slice(0, 2).every((r) => Number(r.mood) <= 2);
      if (needTalk || mood <= 2 || danger) {
        const cs = counsellorsFor(pid);
        const priority = needTalk || danger || mood === 1 || lowStreak ? 'urgent' : 'normal';
        task = data.put('counselling_tasks', { person_id: pid, hamlet_id: p.hamlet_id, kind: needTalk ? 'need_talk' : 'low_pulse', priority, status: 'open', pulse_id: row.id, assigned_to: cs[0] ? cs[0].id : null, assigned_name: cs[0] ? cs[0].display_name : null, reason: needTalk ? 'Learner asked to talk to someone.' : `Check-in mood ${mood}/5${lowStreak ? ' (low twice in a row)' : ''}.`, created_at: now(), due: new Date(Date.now() + (priority === 'urgent' ? 1 : 3) * 864e5).toISOString().slice(0, 10) }, req.user);
        if (cs[0]) brain.notify(pid, `${brain.brand.short}: ഞങ്ങളുടെ കൗൺസിലർ ഉടൻ നിങ്ങളെ കാണും.`, { channel: 'app' }, req.user);
        if (danger || (needTalk && !cs.length) || (needTalk && mood === 1)) {
          emit('counselling.safeguarding_escalation', { person_id: pid, severity: danger || mood === 1 ? 'high' : 'medium', reason: danger ? 'Distress words in wellbeing check-in' : needTalk && !cs.length ? 'Learner asked to talk; no consenting counsellor available' : 'Very low mood and asked to talk', task_id: task.id }, req.user, p.hamlet_id);
          escalated = true;
        }
      }
      return { row, task, escalated };
    });
    res.json({ ok: true, id: out.row.id, follow_up: !!out.task, escalated: out.escalated, message: out.task ? 'Thank you for telling us. Someone you can trust will talk with you soon.' : 'Thank you for checking in!', message_ml: out.task ? 'പറഞ്ഞതിന് നന്ദി. വിശ്വസിക്കാവുന്ന ഒരാൾ ഉടൻ നിങ്ങളോട് സംസാരിക്കും.' : 'പങ്കുവെച്ചതിന് നന്ദി!' });
  });
  router.get('/pulse/me', authed, (req, res) => {
    if (!req.user.person_id) return res.json({ pulses: [], today: false });
    const rows = data.find('counselling_pulses', { person_id: req.user.person_id }, { order: 'at DESC', limit: 30 });
    res.json({ pulses: rows.map(({ id, mood, need_talk, at }) => ({ id, mood, need_talk, at })), today: !!rows[0] && rows[0].at.slice(0, 10) === now().slice(0, 10), moods: C.moods });
  });
  router.get('/wellbeing/:personId', authed, (req, res) => {
    const p = wellbeingAccess(req.user, req.params.personId);
    const rows = data.find('counselling_pulses', { person_id: p.id }, { order: 'at DESC', limit: 120 });
    res.json({ person: { id: p.id, name: p.name }, pulses: rows, avg30: avg(rows.filter((r) => r.at > daysAgoIso(30))), moods: C.moods });
  });
  const daysAgoIso = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const avg = (rows) => (rows.length ? Number((rows.reduce((a, r) => a + Number(r.mood), 0) / rows.length).toFixed(2)) : null);

  // k-anonymised aggregate: by hamlet and by month. Groups with fewer than K distinct learners are suppressed.
  router.get('/wellbeing-summary', requires('learner.read', 'analytics.aggregate', 'counsel'), (req, res) => {
    const since = daysAgoIso(Number(req.query.days) || 90);
    const hm = Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
    const rows = sql('SELECT hamlet_id, person_id, mood, need_talk, at FROM counselling_pulses WHERE deleted=0 AND at>=?', since);
    const group = (keyFn) => {
      const g = {};
      for (const r of rows) { const k = keyFn(r); (g[k] = g[k] || { people: new Set(), moods: [], low: 0, talk: 0 }); g[k].people.add(r.person_id); g[k].moods.push(Number(r.mood)); if (r.mood <= 2) g[k].low++; if (r.need_talk) g[k].talk++; }
      return Object.entries(g).map(([k, v]) => v.people.size < K ? { key: k, suppressed: true, learners: `<${K}` } : { key: k, learners: v.people.size, checkins: v.moods.length, avg: Number((v.moods.reduce((a, b) => a + b, 0) / v.moods.length).toFixed(2)), low_pct: Math.round((v.low / v.moods.length) * 100), dist: [1, 2, 3, 4, 5].map((m) => v.moods.filter((x) => x === m).length) });
    };
    const byHamlet = group((r) => r.hamlet_id).map((x) => ({ ...x, name: hm[x.key] ? hm[x.key].name : '—', name_ml: hm[x.key] ? hm[x.key].name_ml : '' }));
    const byMonth = group((r) => r.at.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
    const all = group(() => 'all')[0] || null;
    res.json({ k: K, since, overall: all, by_hamlet: byHamlet, by_month: byMonth, moods: C.moods });
  });

  // ---------- counsellor caseload, sessions, tasks ----------
  router.get('/caseload', requires('counsel'), (req, res) => {
    const u = req.user;
    const ids = new Set(sql(`SELECT DISTINCT e.person_id id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id WHERE e.deleted=0 AND e.status='active' AND pr.track='counselling'${isSteward(u) ? '' : ' AND e.agency_id=?'}`, ...(isSteward(u) ? [] : [u.agency_id])).map((r) => r.id));
    for (const t of data.find('counselling_tasks', { status: 'open' })) ids.add(t.person_id);
    const out = [];
    for (const id of ids) {
      if (!brain.policy.canSee(u, id, 'wellbeing').ok) continue;
      const p = brain.persons.raw(id); if (!p) continue;
      const pulses = data.find('counselling_pulses', { person_id: id }, { order: 'at DESC', limit: 8 });
      const tasks = data.find('counselling_tasks', { person_id: id, status: 'open' });
      const last = data.find('counselling_sessions', { person_id: id }, { order: 'date DESC', limit: 1 })[0];
      out.push({ id, name: p.name, kind: p.kind, hamlet_id: p.hamlet_id, hamlet: (brain.hamlets.get(p.hamlet_id) || {}).name, aspirations: p.aspirations, last_mood: pulses[0] ? pulses[0].mood : null, trend: pulses.map((x) => x.mood).reverse(), open_tasks: tasks.length, urgent: tasks.some((t) => t.priority === 'urgent'), last_session: last ? last.date : null, mentor: (data.find('counselling_matches', { person_id: id, status: 'active' })[0] || {}).mentor_name || null });
    }
    if (isSteward(u)) brain.audit(u, 'caseload_read', 'caseload', { n: out.length });
    out.sort((a, b) => b.urgent - a.urgent || b.open_tasks - a.open_tasks || (a.last_mood || 9) - (b.last_mood || 9) || a.name.localeCompare(b.name));
    res.json(out);
  });

  router.get('/tasks', requires('counsel'), (req, res) => {
    const u = req.user;
    const rows = data.find('counselling_tasks', req.query.all === '1' ? {} : { status: 'open' }, { order: 'created_at DESC', limit: 500 })
      .filter((t) => isSteward(u) || t.assigned_to === u.id || (!t.assigned_to && brain.policy.canSee(u, t.person_id, 'wellbeing').ok) || brain.policy.canSee(u, t.person_id, 'wellbeing').ok);
    res.json(rows.map((t) => ({ ...t, person_name: (brain.persons.raw(t.person_id) || {}).name })).sort((a, b) => (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1) || (a.due || '').localeCompare(b.due || '')));
  });
  router.post('/tasks/:id/done', requires('counsel'), (req, res) => {
    const t = data.get('counselling_tasks', req.params.id);
    if (!t) throw httpError(404, 'Not found');
    seeOrThrow(req.user, t.person_id, 'wellbeing');
    res.json(data.put('counselling_tasks', { ...t, status: 'done', done_at: now(), done_by: req.user.id, outcome: S(req.body.outcome, 300) }, req.user));
  });

  router.get('/sessions/:personId', requires('counsel'), (req, res) => {
    const p = seeOrThrow(req.user, req.params.personId, 'wellbeing');
    const rows = data.find('counselling_sessions', { person_id: p.id }, { order: 'date DESC' });
    res.json(rows.map((s) => ({ ...s, notes: s.counsellor_id === req.user.id || isSteward(req.user) ? s.notes : null, notes_private: !(s.counsellor_id === req.user.id || isSteward(req.user)) })));
  });
  router.post('/sessions', requires('counsel'), (req, res) => {
    const p = seeOrThrow(req.user, req.body.person_id, 'wellbeing');
    const row = tx(() => {
      const s = data.put('counselling_sessions', { person_id: p.id, hamlet_id: p.hamlet_id, counsellor_id: req.user.id, counsellor_name: req.user.display_name, date: S(req.body.date, 10) || now().slice(0, 10), mode: ['in_person', 'phone', 'video', 'group'].includes(req.body.mode) ? req.body.mode : 'in_person', topic: ['career', 'wellbeing', 'family', 'study', 'safety', 'other'].includes(req.body.topic) ? req.body.topic : 'other', notes: S(req.body.notes, 4000), follow_up: S(req.body.follow_up, 300), follow_up_date: S(req.body.follow_up_date, 10) || null }, req.user);
      if (s.follow_up && s.follow_up_date) data.put('counselling_tasks', { person_id: p.id, hamlet_id: p.hamlet_id, kind: 'session_followup', priority: 'normal', status: 'open', assigned_to: req.user.id, assigned_name: req.user.display_name, reason: s.follow_up, due: s.follow_up_date, created_at: now() }, req.user);
      if (req.body.task_id) { const t = data.get('counselling_tasks', req.body.task_id); if (t && t.person_id === p.id) data.put('counselling_tasks', { ...t, status: 'done', done_at: now(), done_by: req.user.id, outcome: 'Session held' }, req.user); }
      return s;
    });
    emit('counselling.session_logged', { session_id: row.id, person_id: p.id, topic: row.topic }, req.user, p.hamlet_id);
    res.json(row);
  });

  router.get('/me', authed, (req, res) => {
    const u = req.user;
    const match = u.person_id ? data.find('counselling_matches', { person_id: u.person_id, status: 'active' })[0] || null : null;
    res.json({ person_id: u.person_id || null, match: match && { id: match.id, mentor_name: match.mentor_name, pathway_key: match.pathway_key }, role: u.role });
  });

  // ---------- seed ----------
  async function seed(demo) {
    const { R, daysAgo, users, agencyByKey: A } = demo;
    const t0 = Date.now();
    // extra demo mentors (safeguarding-trained, active) — one untrained, inactive to show the training gate
    const MENTORS = [
      { key: 'mentor', expertise: ['police', 'forest', 'army', 'sports'], languages: ['Malayalam', 'English'], capacity: 5, bio: 'Retired sub-inspector; coaches youth for police and forest recruitment physical tests.', bio_ml: 'വിരമിച്ച സബ് ഇൻസ്പെക്ടർ; പോലീസ്, വനം നിയമനങ്ങളുടെ കായിക പരീക്ഷയ്ക്ക് പരിശീലനം നൽകുന്നു.' },
      { key: 'mentor.priya', name: 'Priya — Volunteer Mentor (CIF, staff nurse)', agency: 'cif', expertise: ['nurse', 'doctor', 'teacher'], languages: ['Malayalam', 'English', 'Tamil'], capacity: 4, bio: 'Staff nurse at a district hospital; first in her family to go to college.', bio_ml: 'ജില്ലാ ആശുപത്രിയിൽ സ്റ്റാഫ് നഴ്സ്; കുടുംബത്തിൽ ആദ്യമായി കോളേജിൽ പോയയാൾ.' },
      { key: 'mentor.rahul', name: 'Rahul — Volunteer Mentor (CIF, IT)', agency: 'cif', expertise: ['it', 'bank', 'engineer', 'ldc'], languages: ['Malayalam', 'English'], capacity: 4, bio: 'Software tester in Kochi; grew up in an Idukki hamlet.', bio_ml: 'കൊച്ചിയിൽ സോഫ്റ്റ്‌വെയർ ടെസ്റ്റർ; ഇടുക്കിയിലെ ഊരിൽ വളർന്നു.' },
      { key: 'mentor.leela', name: 'Leela — Volunteer Mentor (Sneha Outreach)', agency: 'sto', expertise: ['enterprise', 'hospitality', 'tourism'], languages: ['Malayalam', 'Irula', 'Tamil'], capacity: 3, bio: 'Runs a tailoring unit with a Kudumbashree group.', bio_ml: 'കുടുംബശ്രീ ഗ്രൂപ്പിനൊപ്പം തയ്യൽ യൂണിറ്റ് നടത്തുന്നു.' },
      { key: 'mentor.vinod', name: 'Vinod — Volunteer Mentor (pending training)', agency: 'cif', expertise: ['driver', 'hospitality'], languages: ['Malayalam'], capacity: 3, bio: 'Tour operator. Account inactive until safeguarding training is complete.', bio_ml: 'ടൂർ ഓപ്പറേറ്റർ. സംരക്ഷണ പരിശീലനം പൂർത്തിയാകും വരെ അക്കൗണ്ട് നിഷ്ക്രിയം.', untrained: true },
    ];
    const mentorUsers = {};
    tx(() => {
      for (const m of MENTORS) {
        let u = users[m.key];
        if (!u) {
          const ex = brain.users.byRole('mentor').find((x) => x.username === 'demo.' + m.key);
          u = ex || brain.users.create({ username: 'demo.' + m.key, password: demo.DEMO_PASSWORD || 'demo1234', role: 'mentor', display_name: m.name, agency_id: A[m.agency].id, safeguarding_trained: m.untrained ? 0 : 1, active: m.untrained ? 0 : 1 }, null);
        }
        mentorUsers[m.key] = u;
        data.put('counselling_mentors', { user_id: u.id, agency_id: u.agency_id, expertise: m.expertise, languages: m.languages, capacity: m.capacity, bio: m.bio, bio_ml: m.bio_ml }, null);
      }
    });

    // who is in counselling programmes
    const enrolled = new Map();
    for (const pr of demo.programmes.filter((p) => p.track === 'counselling')) for (const p of demo.enrolledIn(pr.id)) enrolled.set(p.id, { p, agency_id: pr.agency_id });
    if (demo.demoYouth) enrolled.set(demo.demoYouth.id, { p: demo.demoYouth, agency_id: A.cif.id });
    if (demo.demoLearner) enrolled.set(demo.demoLearner.id, { p: demo.demoLearner, agency_id: A.cif.id });
    const counsellor = users.counsellor;

    tx(() => {
      for (const { p } of enrolled.values()) {
        // aspirations
        const pw = pathwayFor(p.aspirations);
        if (pw && (p.kind === 'youth' || R.chance(0.6))) {
          const extra = R.chance(0.4) ? R.pick(C.pathways.filter((x) => x.key !== pw.key)).key : null;
          data.put('counselling_aspirations', { person_id: p.id, hamlet_id: p.hamlet_id, pathway_keys: [pw.key, extra].filter(Boolean), dream: '', strengths: R.pick(['Good at running', 'Knows forest plants', 'Helps younger children study', 'Good with phones', 'Likes cooking', '']), set_by: R.chance(0.5) ? 'self' : 'counsellor', set_by_name: R.chance(0.5) ? p.name : counsellor.display_name, set_at: daysAgo(R.int(10, 120)) }, null);
        }
        // wellbeing pulses, ~weekly for 3 months, for those who check in
        const isDemo = p.id === (demo.demoYouth || {}).id || p.id === (demo.demoLearner || {}).id;
        if (!isDemo && !R.chance(0.75)) continue;
        let base = R.pick([3, 3, 4, 4, 4, 2]);
        for (let d = 90 - R.int(0, 6); d >= 1; d -= R.int(5, 9)) {
          if (!isDemo && R.chance(0.15)) continue;
          base = Math.max(1, Math.min(5, base + R.pick([-1, 0, 0, 0, 1])));
          if (base <= 1 && R.chance(0.6)) base = 2;
          const mood = isDemo ? R.pick([3, 4, 4, 5]) : base;
          const needTalk = mood <= 2 && R.chance(0.2) ? 1 : 0;
          const pr = data.put('counselling_pulses', { person_id: p.id, hamlet_id: p.hamlet_id, mood, need_talk: needTalk, note: '', at: daysAgo(d + R.rnd() * 0.5) }, null);
          if (mood <= 2 || needTalk) {
            const cs = brain.policy.canSee(counsellor, p.id, 'wellbeing').ok ? counsellor : null;
            const done = d > 10 || R.chance(0.3);
            data.put('counselling_tasks', { person_id: p.id, hamlet_id: p.hamlet_id, kind: needTalk ? 'need_talk' : 'low_pulse', priority: needTalk || mood === 1 ? 'urgent' : 'normal', status: done ? 'done' : 'open', pulse_id: pr.id, assigned_to: cs ? cs.id : null, assigned_name: cs ? cs.display_name : null, reason: needTalk ? 'Learner asked to talk to someone.' : `Check-in mood ${mood}/5.`, created_at: daysAgo(d), due: daysAgo(d - 2).slice(0, 10), done_at: done ? daysAgo(Math.max(0, d - R.int(1, 3))) : null, outcome: done ? R.pick(['Spoke at centre; exam stress — study plan made.', 'Family issue; guardian meeting held.', 'Felt better after talking; will check in next week.']) : null }, null);
            if (done && cs) data.put('counselling_sessions', { person_id: p.id, hamlet_id: p.hamlet_id, counsellor_id: cs.id, counsellor_name: cs.display_name, date: daysAgo(Math.max(0, d - R.int(1, 3))).slice(0, 10), mode: R.pick(['in_person', 'in_person', 'phone']), topic: R.pick(['wellbeing', 'study', 'family']), notes: R.pick(['Discussed worries about exams; practised breathing; agreed weekly check-in.', 'Talked about missing home while at hostel. Connected with warden.', 'Feeling left out at school. Will join centre football group.']), follow_up: '', follow_up_date: null }, null);
          }
        }
      }
      // career sessions for some youth
      for (const { p } of [...enrolled.values()].filter((x) => x.p.kind === 'youth').slice(0, 25)) {
        if (!brain.policy.canSee(counsellor, p.id, 'wellbeing').ok) continue;
        data.put('counselling_sessions', { person_id: p.id, hamlet_id: p.hamlet_id, counsellor_id: counsellor.id, counsellor_name: counsellor.display_name, date: daysAgo(R.int(8, 80)).slice(0, 10), mode: 'in_person', topic: 'career', notes: 'Mapped aspirations against eligibility. Discussed realistic timeline and documents needed.', follow_up: R.chance(0.4) ? 'Check document checklist progress' : '', follow_up_date: null }, null);
      }
    });

    // mentor matches with benign chat history; one held message
    const pickMatches = [];
    const dy = demo.demoYouth;
    if (dy) pickMatches.push({ p: dy, m: mentorUsers.mentor });
    const minorCand = [...enrolled.values()].map((x) => x.p).filter((p) => p.kind === 'child' && brain.policy.canSee(mentorUsers['mentor.priya'], p.id, 'profile').ok && (Date.now() - new Date(p.dob)) / 3.15576e10 >= 13);
    if (minorCand[0]) pickMatches.push({ p: minorCand[0], m: mentorUsers['mentor.priya'], flag: true });
    const youthCand = [...enrolled.values()].map((x) => x.p).filter((p) => p.kind === 'youth' && p.id !== (dy || {}).id && brain.policy.canSee(mentorUsers['mentor.rahul'], p.id, 'profile').ok);
    for (const p of youthCand.slice(0, 2)) pickMatches.push({ p, m: mentorUsers['mentor.rahul'] });
    const LINES = {
      police: [['mentor', 'Hi! I\'m Arjun. I hear you want to join the police. What made you choose it?'], ['learner', 'I want to help people in our ooru. My uncle was a forest watcher.'], ['mentor', 'That\'s a great reason. Have you registered on Kerala PSC Thulasi yet?'], ['learner', 'Not yet. Suresh sir said he will help at the centre.'], ['mentor', 'Good. This week: register, and try running 1.5 km three times. Note your time in the Life Skills app.'], ['learner', 'Ok sir. Today 9 minutes 40 seconds.'], ['mentor', 'Nice start! Aim for under 8 minutes in two months. Keep going.']],
      nurse: [['mentor', 'Hello! I\'m Priya, a staff nurse. Your counsellor said you like Biology?'], ['learner', 'Yes chechi. I want to be a nurse like you.'], ['mentor', 'Wonderful. Choose the Biology group in Plus One. Which subject is hardest now?'], ['learner', 'Maths 😟'], ['mentor', 'Let\'s ask your tuition teacher for extra practice. Small steps every day!']],
      it: [['mentor', 'Hi, I\'m Rahul. What kind of computer work interests you?'], ['learner', 'Data entry or Akshaya centre work.'], ['mentor', 'Good first step. Typing speed matters — try 15 minutes of typing practice daily at the centre.'], ['learner', 'Ok. Also is "work from home" job real? Someone sent me a link asking ₹2000 deposit.'], ['mentor', 'That is almost always a scam. Never pay a deposit for a job. Good that you asked!']],
    };
    tx(() => {
      for (const { p, m, flag } of pickMatches) {
        if (!m || !p) continue;
        if (data.find('counselling_matches', { person_id: p.id, status: 'active' }).length) continue;
        const start = R.int(30, 70);
        const mt = data.put('counselling_matches', { person_id: p.id, hamlet_id: p.hamlet_id, mentor_id: m.id, mentor_name: m.display_name, mentor_agency_id: m.agency_id, status: 'active', minor: brain.policy.isMinor(p) ? 1 : 0, pathway_key: (pathwayFor(p.aspirations) || {}).key || null, reason: 'Matched on aspiration and language.', matched_by: counsellor.id, matched_by_name: counsellor.display_name, started_at: daysAgo(start) }, null);
        const script = m === mentorUsers.mentor ? LINES.police : m === mentorUsers['mentor.priya'] ? LINES.nurse : LINES.it;
        let d = start - 1;
        for (const [who, body] of script) {
          d = Math.max(2, d - R.int(1, 5));
          const sender = who === 'mentor' ? m : { id: (brain.users.byRole('learner').find((u) => u.person_id === p.id) || {}).id || null, role: 'learner', display_name: p.name };
          data.put('counselling_messages', { match_id: mt.id, person_id: p.id, hamlet_id: p.hamlet_id, sender_id: sender.id, sender_role: sender.role, sender_name: sender.display_name, body, status: 'delivered', reasons: [], adult_minor: mt.minor, sent_at: daysAgo(d) }, null);
        }
        if (flag) {
          const body = 'You can also message me on WhatsApp, my number is 98470 12345, easier than this app.';
          const scan = filter.scan(body);
          const msg = data.put('counselling_messages', { match_id: mt.id, person_id: p.id, hamlet_id: p.hamlet_id, sender_id: m.id, sender_role: 'mentor', sender_name: m.display_name, body, status: 'held', reasons: scan.reasons, adult_minor: mt.minor, sent_at: daysAgo(1) }, null);
          emit('counselling.message_flagged', { ref_id: msg.id, match_id: mt.id, text: body, reasons: scan.reasons, severity: scan.severity, author_id: m.id, author_role: 'mentor', target_person_id: p.id, hamlet_id: p.hamlet_id }, m, p.hamlet_id);
        }
      }
    });
    ctx.log(`seeded counselling (${enrolled.size} learners, ${pickMatches.length} matches) in ${Date.now() - t0}ms`);
  }

  return {
    seed,
    health: () => ({ pulses: sqlOne('SELECT COUNT(*) n FROM counselling_pulses WHERE deleted=0').n, open_tasks: sqlOne("SELECT COUNT(*) n FROM counselling_tasks WHERE deleted=0 AND status='open'").n, held_messages: sqlOne("SELECT COUNT(*) n FROM counselling_messages WHERE deleted=0 AND status='held'").n, pathways: C.pathways.length }),
  };
};
