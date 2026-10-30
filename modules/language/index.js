'use strict';
// AADI · language — courses, speaking practice, mother-tongue bridge, peer circles, levels.
// Audio stays on the learner's device by default; only ratings (and, if the learner chooses,
// one short sample ≤150 KB for teacher review) are stored. Staff access needs enrolment in a
// LANGUAGE programme of their agency + active "progress" consent.
const { COURSES, BRIDGE_CONCEPTS, BRIDGE_LANGS, LEVELS, LEVEL_INFO, ROLEPLAYS } = require('./content/courses');
const { seedAll } = require('./seed');

const MAX_SAMPLE_BYTES = 150 * 1024;
const COURSE = Object.fromEntries(COURSES.map((c) => [c.id, c]));
const PASSPORT = { // course → competency refs per level
  'eng-spoken': { 'Pre-A1': 'ENG.1', A1: 'ENG.2', A2: 'ENG.3' },
  'eng-written': { A1: 'ENG.W1', A2: 'ENG.W2' },
  hindi: { 'Pre-A1': 'HIN.1', A1: 'HIN.2' },
  german: { 'Pre-A1': 'DEU.0', A1: 'DEU.A1' },
  'ml-literacy': { 'Pre-A1': 'LIT.ML.1', A1: 'LIT.ML.2', A2: 'LIT.ML.3' },
};
const NEW_COMPETENCIES = [
  ['ENG.W1', 'english', 'Fills forms and writes short messages in English', 'ഇംഗ്ലീഷിൽ ഫോം, മെസ്സേജ്', 1, 'youth'],
  ['ENG.W2', 'english', 'Writes a simple formal letter in English', 'ഇംഗ്ലീഷിൽ ലളിതമായ കത്ത്', 2, 'youth'],
  ['HIN.1', 'language', 'Hindi greetings and first words', 'ഹിന്ദി — ആദ്യ വാക്കുകൾ', 1, 'all'],
  ['HIN.2', 'language', 'Hindi for travel situations', 'യാത്രയ്ക്കുള്ള ഹിന്ദി', 2, 'all'],
  ['DEU.0', 'language', 'German greetings (Pre-A1)', 'ജർമ്മൻ അഭിവാദ്യം', 1, 'youth'],
  ['DEU.A1', 'language', 'German A1 basics', 'ജർമ്മൻ A1', 2, 'youth'],
  ['MT.BRIDGE', 'language', 'Contributed mother-tongue words to the community bridge', 'മാതൃഭാഷാ വാക്കുകൾ സംഭാവന ചെയ്തു', 1, 'all'],
];
const SPEAK_CHECKS = ['clear', 'pace', 'complete', 'confident'];

function activities(course) { const out = []; for (const u of course.units) for (const a of u.activities) out.push({ ...a, unit_id: u.id, level: u.level, key: `${u.id}/${a.id}` }); return out; }
function courseSummary(c) { return { id: c.id, lang: c.lang, tts: c.tts, icon: c.icon, title: c.title, title_ml: c.title_ml, about: c.about, about_ml: c.about_ml, units: c.units.map((u) => ({ id: u.id, level: u.level, title: u.title, title_ml: u.title_ml, activities: u.activities.map((a) => ({ id: a.id, kind: a.kind, title: a.title, title_ml: a.title_ml })) })) }; }

// Level = highest CEFR-like band where ≥ 80% of that band's activities are done and, where the
// band has speaking tasks, at least one speaking attempt rated ≥ 3 (teacher rating preferred).
function computeLevel(course, doneKeys, speaking) {
  let level = null;
  const detail = [];
  for (const lv of LEVELS) {
    const acts = activities(course).filter((a) => a.level === lv);
    if (!acts.length) continue;
    const done = acts.filter((a) => doneKeys.has(a.key)).length;
    const sp = acts.filter((a) => a.kind === 'speak');
    const spOk = !sp.length || speaking.some((s) => s.course_id === course.id && sp.some((a) => a.unit_id === s.unit_id && a.id === s.activity_id) && (s.teacher_rating ?? s.peer_rating ?? s.self_rating ?? 0) >= 3);
    const ok = done / acts.length >= 0.8 && spOk;
    detail.push({ level: lv, total: acts.length, done, speaking_ok: spOk, reached: ok });
    if (!ok) break; // levels are cumulative: stop at the first band not yet reached
    level = lv;
  }
  return { level, detail };
}

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError } = ctx;
  const nowIso = () => new Date().toISOString();

  // ---------------------------------------------------------------- access
  const STEWARD = ['platform_admin', 'cpo'];
  function langEnrolled(pid, agencyId) {
    return !!sqlOne("SELECT 1 x FROM enrolments e JOIN programmes p ON p.id=e.programme_id WHERE e.person_id=? AND e.agency_id=? AND e.deleted=0 AND e.status IN ('active','completed') AND p.track='language'", pid, agencyId);
  }
  function access(user, pid) {
    if (!pid) return { ok: false, reason: 'no person' };
    if (user.person_id && user.person_id === pid) return { ok: true, self: true };
    const v = brain.policy.canSee(user, pid, 'progress');
    if (!v.ok) return v;
    if (STEWARD.includes(user.role) || user.role === 'guardian') return v;
    if (!langEnrolled(pid, user.agency_id)) return { ok: false, reason: 'learner is not in a language programme of your agency' };
    if (Array.isArray(user.hamlet_ids) && user.hamlet_ids.length) { const p = brain.persons.raw(pid); if (!p || !user.hamlet_ids.includes(p.hamlet_id)) return { ok: false, reason: 'outside your hamlets' }; }
    return v;
  }
  function personFor(req) {
    const pid = req.query.person_id || req.body?.person_id || req.user.person_id;
    if (!pid) throw httpError(400, 'person_id required');
    const a = access(req.user, pid);
    if (!a.ok) throw httpError(403, 'Not permitted: ' + a.reason);
    if (!a.self && STEWARD.includes(req.user.role)) brain.audit(req.user, 'person_read', pid, { path: req.path });
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'person not found');
    return p;
  }
  function langAgency(pid) { return sqlOne("SELECT e.agency_id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id WHERE e.person_id=? AND e.deleted=0 AND e.status IN ('active','completed') AND pr.track='language' LIMIT 1", pid)?.agency_id || null; }

  // ---------------------------------------------------------------- level & passport
  function levelsFor(pid) {
    const done = new Set(sql('SELECT course_id, unit_id, activity_id FROM language_progress WHERE person_id=? AND deleted=0', pid).map((r) => `${r.course_id}:${r.unit_id}/${r.activity_id}`));
    const speaking = sql('SELECT course_id, unit_id, activity_id, self_rating, peer_rating, teacher_rating FROM language_speaking WHERE person_id=? AND deleted=0', pid);
    return Object.fromEntries(COURSES.map((c) => { const keys = new Set([...done].filter((k) => k.startsWith(c.id + ':')).map((k) => k.slice(c.id.length + 1))); return [c.id, { ...computeLevel(c, keys, speaking), done: keys.size, total: activities(c).length }]; }));
  }
  function syncLevels(pid, user, { at = null, silent = false } = {}) {
    const lv = levelsFor(pid);
    const p = brain.persons.raw(pid);
    const awarded = [];
    for (const [cid, info] of Object.entries(lv)) {
      if (!info.level) continue;
      const have = sql('SELECT level FROM language_levels WHERE person_id=? AND course_id=? AND deleted=0', pid, cid).map((r) => r.level);
      for (const L of LEVELS.slice(0, LEVELS.indexOf(info.level) + 1)) {
        if (have.includes(L)) continue;
        data.put('language_levels', { person_id: pid, hamlet_id: p.hamlet_id, course_id: cid, level: L, awarded_at: at || nowIso(), awarded_by: user ? user.display_name : 'AADI (auto)', evidence: { done: info.done, total: info.total } }, user);
        const ref = PASSPORT[cid]?.[L];
        if (ref) {
          try { brain.passport.award({ person_id: pid, type: 'competency', ref, title: `${COURSE[cid].title} — ${L}: ${LEVEL_INFO[L].en}`, level: LEVELS.indexOf(L) + 1, evidence: { course: cid, level: L }, agency_id: langAgency(pid) }, user); } catch (e) { ctx.log('award skipped', e.message); }
        }
        awarded.push({ course_id: cid, level: L });
        if (!silent) emit('language.level_reached', { person_id: pid, course_id: cid, level: L }, user, p.hamlet_id);
      }
    }
    return awarded;
  }

  // ---------------------------------------------------------------- courses
  router.get('/courses', authed, (req, res) => res.json({ courses: COURSES.map(courseSummary), levels: LEVELS.map((l) => ({ id: l, ...LEVEL_INFO[l] })), roleplays: ROLEPLAYS, checks: SPEAK_CHECKS }));
  router.get('/courses/:id', authed, (req, res) => {
    const c = COURSE[req.params.id];
    if (!c) throw httpError(404, 'course not found');
    res.json({ ...c, comp: undefined });
  });

  // ---------------------------------------------------------------- learner dashboard
  router.get('/dashboard', authed, (req, res) => {
    const p = personFor(req);
    const lv = levelsFor(p.id);
    const prog = sql('SELECT course_id, unit_id, activity_id, kind, score, completed_at FROM language_progress WHERE person_id=? AND deleted=0 ORDER BY completed_at DESC', p.id);
    const sp = sql('SELECT id, course_id, unit_id, activity_id, prompt, self_rating, peer_rating, teacher_rating, teacher_note, reviewer, status, created_at, sample_bytes FROM language_speaking WHERE person_id=? AND deleted=0 ORDER BY created_at DESC LIMIT 20', p.id);
    const badges = sql('SELECT course_id, level, awarded_at FROM language_levels WHERE person_id=? AND deleted=0 ORDER BY awarded_at', p.id);
    const progIds = sql("SELECT e.programme_id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id WHERE e.person_id=? AND e.deleted=0 AND e.status='active' AND pr.track='language'", p.id).map((r) => r.programme_id);
    const today = nowIso().slice(0, 10);
    const circles = progIds.length ? sql(`SELECT * FROM language_circles WHERE deleted=0 AND programme_id IN (${progIds.map(() => '?').join(',')}) AND date>=? ORDER BY date LIMIT 4`, ...progIds, today) : [];
    const att = sql('SELECT present FROM language_attendance WHERE person_id=? AND deleted=0', p.id);
    const days = new Set(prog.map((r) => (r.completed_at || '').slice(0, 10)));
    let streak = 0; for (let i = 0; i < 60; i++) { const d = new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10); if (days.has(d)) streak++; else if (i > 0) break; }
    res.json({
      person: { id: p.id, name: p.name, language: p.language, hamlet_id: p.hamlet_id },
      courses: COURSES.map((c) => ({ id: c.id, icon: c.icon, title: c.title, title_ml: c.title_ml, lang: c.lang, level: lv[c.id].level, done: lv[c.id].done, total: lv[c.id].total, last: prog.find((r) => r.course_id === c.id)?.completed_at || null, next: activities(c).find((a) => !prog.some((r) => r.course_id === c.id && r.unit_id === a.unit_id && r.activity_id === a.id)) || null })).map((c) => ({ ...c, next: c.next && { unit_id: c.next.unit_id, id: c.next.id, title: c.next.title, title_ml: c.next.title_ml, kind: c.next.kind } })),
      speaking: sp, badges, circles: circles.map((c) => ({ ...c, roleplay: ROLEPLAYS.find((r) => r.id === c.roleplay_id) || null })),
      stats: { activities: prog.length, speaking: sp.length, reviewed: sp.filter((s) => s.teacher_rating).length, circles_attended: att.filter((a) => a.present).length, streak },
      week: [6, 5, 4, 3, 2, 1, 0].map((d) => { const day = new Date(Date.now() - d * 86400e3).toISOString().slice(0, 10); return { day, n: prog.filter((r) => (r.completed_at || '').startsWith(day)).length }; }),
    });
  });

  router.get('/progress', authed, (req, res) => {
    const p = personFor(req);
    const rows = sql('SELECT course_id, unit_id, activity_id, kind, score, completed_at FROM language_progress WHERE person_id=? AND deleted=0' + (req.query.course_id ? ' AND course_id=?' : ''), p.id, ...(req.query.course_id ? [req.query.course_id] : []));
    res.json({ done: rows, levels: levelsFor(p.id) });
  });

  router.post('/progress', requires('learn'), (req, res) => {
    const pid = req.user.person_id;
    const b = req.body || {};
    const c = COURSE[b.course_id];
    const a = c && activities(c).find((x) => x.unit_id === b.unit_id && x.id === b.activity_id);
    if (!a) throw httpError(404, 'activity not found');
    const p = brain.persons.raw(pid);
    const score = b.score === undefined || b.score === null ? null : Math.max(0, Math.min(1, Number(b.score)));
    const ex = sqlOne('SELECT * FROM language_progress WHERE person_id=? AND course_id=? AND unit_id=? AND activity_id=? AND deleted=0', pid, c.id, a.unit_id, a.id);
    const row = data.put('language_progress', { ...(ex || {}), person_id: pid, hamlet_id: p.hamlet_id, course_id: c.id, unit_id: a.unit_id, activity_id: a.id, kind: a.kind, score: ex && ex.score !== null && score !== null ? Math.max(ex.score, score) : score, completed_at: nowIso(), data: b.data && typeof b.data === 'object' ? { known: Number(b.data.known) || undefined, repeats: Number(b.data.repeats) || undefined } : null }, req.user);
    emit('language.activity_completed', { person_id: pid, course_id: c.id, unit_id: a.unit_id, activity_id: a.id, kind: a.kind }, req.user, p.hamlet_id);
    const awarded = syncLevels(pid, req.user);
    res.json({ progress: row, awarded, level: levelsFor(pid)[c.id].level });
  });

  // ---------------------------------------------------------------- speaking practice
  function validSample(s, mime) {
    if (!s) return null;
    if (typeof s !== 'string') throw httpError(400, 'sample must be base64 text');
    const raw = s.replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(raw)) throw httpError(400, 'sample must be base64');
    const bytes = Math.floor((raw.length * 3) / 4) - (raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0);
    if (bytes > MAX_SAMPLE_BYTES) throw httpError(413, 'Sample too large — keep it under 150 KB (about 15 seconds).');
    const m = String(mime || (s.match(/^data:([^;]+);/) || [])[1] || 'audio/webm');
    if (!/^audio\/[a-z0-9.+-]+(;.*)?$/i.test(m)) throw httpError(400, 'sample must be audio');
    return { sample: raw, sample_mime: m.slice(0, 60), sample_bytes: bytes };
  }
  const rating = (x) => (x === undefined || x === null || x === '' ? null : Math.max(1, Math.min(5, Math.round(Number(x)))) || null);

  router.post('/speaking', requires('learn'), (req, res) => {
    const pid = req.user.person_id;
    const b = req.body || {};
    const c = COURSE[b.course_id];
    const a = c && activities(c).find((x) => x.unit_id === b.unit_id && x.id === b.activity_id);
    if (!a) throw httpError(404, 'activity not found');
    if (!rating(b.self_rating)) throw httpError(400, 'self_rating (1–5) required');
    const s = b.share_sample ? validSample(b.sample, b.sample_mime) : null;
    const p = brain.persons.raw(pid);
    const checks = Array.isArray(b.checks) ? b.checks.filter((x) => SPEAK_CHECKS.includes(x)) : [];
    const row = data.put('language_speaking', { person_id: pid, hamlet_id: p.hamlet_id, course_id: c.id, unit_id: a.unit_id, activity_id: a.id, prompt: a.prompt || a.title || (a.lines && a.lines[0]?.t) || '', self_rating: rating(b.self_rating), peer_rating: rating(b.peer_rating), checks, duration_s: Math.min(600, Math.max(0, Number(b.duration_s) || 0)), request_review: b.request_review ? 1 : 0, status: b.request_review ? 'pending' : 'self', created_at: nowIso(), ...(s || { sample: null, sample_mime: null, sample_bytes: 0 }) }, req.user);
    // speaking attempts also count as completing the activity
    if (!sqlOne('SELECT 1 x FROM language_progress WHERE person_id=? AND course_id=? AND unit_id=? AND activity_id=? AND deleted=0', pid, c.id, a.unit_id, a.id)) data.put('language_progress', { person_id: pid, hamlet_id: p.hamlet_id, course_id: c.id, unit_id: a.unit_id, activity_id: a.id, kind: a.kind, score: rating(b.self_rating) / 5, completed_at: nowIso() }, req.user);
    const awarded = syncLevels(pid, req.user);
    const { sample, ...pub } = row;
    res.json({ ...pub, has_sample: !!sample, awarded });
  });

  router.get('/speaking', authed, (req, res) => {
    const p = personFor(req);
    res.json(sql('SELECT id, course_id, unit_id, activity_id, prompt, self_rating, peer_rating, teacher_rating, teacher_note, reviewer, reviewed_at, status, created_at, sample_bytes, duration_s, checks FROM language_speaking WHERE person_id=? AND deleted=0 ORDER BY created_at DESC LIMIT 100', p.id));
  });

  router.get('/speaking/:id/sample', authed, (req, res) => {
    const s = data.get('language_speaking', req.params.id);
    if (!s || !s.sample) throw httpError(404, 'no sample');
    const a = access(req.user, s.person_id);
    if (!a.ok) throw httpError(403, 'Not permitted: ' + a.reason);
    if (!a.self && req.user.role !== 'guardian' && !brain.policy.can(req.user, 'assess')) throw httpError(403, 'Only reviewers can listen to samples');
    if (!a.self) brain.audit(req.user, 'speaking_sample_played', s.person_id, { id: s.id });
    res.json({ id: s.id, mime: s.sample_mime, data: s.sample });
  });

  router.delete('/speaking/:id/sample', authed, (req, res) => {
    const s = data.get('language_speaking', req.params.id);
    if (!s) throw httpError(404, 'not found');
    const p = brain.persons.raw(s.person_id);
    if (!(req.user.person_id === s.person_id || (req.user.role === 'guardian' && p?.guardian_id === req.user.person_id))) throw httpError(403, 'Only the learner or guardian can delete a sample');
    data.put('language_speaking', { ...s, sample: null, sample_mime: null, sample_bytes: 0 }, req.user);
    res.json({ ok: true });
  });

  // teacher review queue — only learners this teacher may see (language enrolment + consent)
  router.get('/review', requires('assess'), (req, res) => {
    const status = req.query.status === 'reviewed' ? 'reviewed' : 'pending';
    const rows = sql('SELECT id, person_id, hamlet_id, course_id, unit_id, activity_id, prompt, self_rating, peer_rating, teacher_rating, teacher_note, reviewer, reviewed_at, status, created_at, sample_bytes, duration_s, checks FROM language_speaking WHERE deleted=0 AND status=? ORDER BY created_at ' + (status === 'pending' ? 'ASC' : 'DESC') + ' LIMIT 400', status);
    const ok = new Map();
    const out = [];
    for (const r of rows) {
      if (!ok.has(r.person_id)) ok.set(r.person_id, access(req.user, r.person_id).ok);
      if (!ok.get(r.person_id)) continue;
      const p = brain.persons.raw(r.person_id);
      const c = COURSE[r.course_id];
      const act = c && activities(c).find((a) => a.unit_id === r.unit_id && a.id === r.activity_id);
      out.push({ ...r, learner: p?.name, course: c?.title, activity: act?.title, model: act?.model || null, tts: c?.tts });
      if (out.length >= 60) break;
    }
    res.json(out);
  });

  router.post('/review/:id', requires('assess'), (req, res) => {
    const s = data.get('language_speaking', req.params.id);
    if (!s) throw httpError(404, 'not found');
    const a = access(req.user, s.person_id);
    if (!a.ok || a.self) throw httpError(403, 'Not permitted: ' + (a.reason || 'cannot review yourself'));
    const r = rating(req.body.rating);
    if (!r) throw httpError(400, 'rating (1–5) required');
    const out = data.put('language_speaking', { ...s, teacher_rating: r, teacher_note: String(req.body.note || '').slice(0, 400), reviewer: req.user.display_name, reviewed_at: nowIso(), status: 'reviewed', ...(req.body.discard_sample ? { sample: null, sample_mime: null, sample_bytes: 0 } : {}) }, req.user);
    emit('language.speaking_reviewed', { speaking_id: s.id, person_id: s.person_id, rating: r }, req.user, s.hamlet_id);
    if (brain.consent.has(s.person_id, req.user.agency_id, 'contact')) brain.notify(s.person_id, `AADI Language Lab: your teacher rated your speaking ${r}/5. ${out.teacher_note ? '“' + out.teacher_note.slice(0, 80) + '”' : ''} / അധ്യാപകർ റേറ്റിംഗ് നൽകി.`, { channel: 'app' }, req.user);
    const awarded = syncLevels(s.person_id, req.user);
    const { sample, ...pub } = out;
    res.json({ ...pub, awarded });
  });

  // ---------------------------------------------------------------- mother-tongue bridge
  const LABEL = { draft: 'Community draft, pending review', community_checked: 'Checked by community reviewers (not a linguistic authority)', needs_fix: 'Flagged for correction' };
  router.get('/bridge', authed, (req, res) => {
    const lang = req.query.language;
    const w = { };
    if (lang) w.language = lang;
    const words = data.find('language_words', w, { order: 'concept', limit: 2000 }).filter((x) => x.status !== 'rejected');
    const counts = {};
    for (const x of data.find('language_words', {}, { limit: 5000 })) counts[x.language] = (counts[x.language] || 0) + 1;
    res.json({
      disclaimer: 'Community-contributed words. AADI does not claim linguistic accuracy; entries stay "community draft, pending review" until checked by community reviewers.',
      disclaimer_ml: 'സമൂഹം സംഭാവന ചെയ്ത വാക്കുകൾ. ഭാഷാശാസ്ത്രപരമായ കൃത്യത അവകാശപ്പെടുന്നില്ല; പരിശോധന വരെ "കരട്".',
      languages: BRIDGE_LANGS.map((l) => ({ id: l, count: counts[l] || 0 })),
      concepts: BRIDGE_CONCEPTS.map(([en, ml, category]) => ({ en, ml, category })),
      words: words.map((x) => ({ id: x.id, language: x.language, concept: x.concept, en: x.en, ml: x.ml, word: x.word, pronunciation: x.pronunciation, category: x.category, note: x.note, contributor: x.contributor_name, status: x.status, status_label: LABEL[x.status] || x.status, demo: x.demo, reviews: (x.reviews || []).length, created_at: x.created_at, mine: x.contributor_id === req.user.id })),
    });
  });
  router.post('/bridge', requires('content.author', 'family'), (req, res) => {
    const b = req.body || {};
    if (!BRIDGE_LANGS.includes(b.language)) throw httpError(400, 'language must be one of ' + BRIDGE_LANGS.join(', '));
    const word = String(b.word || '').trim().slice(0, 60);
    if (!word || !b.en) throw httpError(400, 'word and English meaning required');
    const concept = BRIDGE_CONCEPTS.find(([en]) => en === String(b.en).toLowerCase().trim());
    const pr = req.user.person_id ? brain.persons.raw(req.user.person_id) : null;
    const name = b.anonymous ? `A contributor from ${pr ? brain.hamlets.get(pr.hamlet_id)?.name : 'the community'}` : (pr ? pr.name.split(' ')[0] + (pr ? ', ' + (brain.hamlets.get(pr.hamlet_id)?.name || '') : '') : req.user.display_name);
    const row = data.put('language_words', { language: b.language, hamlet_id: pr?.hamlet_id || null, concept: concept ? concept[0] : String(b.en).toLowerCase().slice(0, 40), en: String(b.en).slice(0, 60), ml: String(b.ml || (concept ? concept[1] : '')).slice(0, 60), word, pronunciation: String(b.pronunciation || '').slice(0, 60), category: concept ? concept[2] : 'words', note: String(b.note || '').slice(0, 200), contributor_id: req.user.id, contributor_name: name, status: 'draft', reviews: [], demo: 0, created_at: nowIso() }, req.user);
    emit('language.word_contributed', { word_id: row.id, language: row.language }, req.user, row.hamlet_id);
    if (pr && sql('SELECT COUNT(*) n FROM language_words WHERE contributor_id=? AND deleted=0', req.user.id)[0].n >= 3) {
      try { brain.passport.award({ person_id: pr.id, type: 'milestone', ref: 'MT.BRIDGE', title: 'Contributed mother-tongue words to the AADI community bridge', level: 1, agency_id: langAgency(pr.id) }, req.user); } catch (_) { /* ignore */ }
    }
    res.json(row);
  });
  router.post('/bridge/:id/review', requires('content.review', 'hamlet.coordinate'), (req, res) => {
    const w = data.get('language_words', req.params.id);
    if (!w) throw httpError(404, 'not found');
    const verdict = req.body.verdict;
    if (!['community_checked', 'needs_fix', 'rejected'].includes(verdict)) throw httpError(400, 'verdict must be community_checked | needs_fix | rejected');
    if (w.contributor_id === req.user.id) throw httpError(403, 'You cannot review your own entry');
    const reviews = [...(w.reviews || []), { by: req.user.display_name, verdict, note: String(req.body.note || '').slice(0, 200), at: nowIso() }];
    res.json(data.put('language_words', { ...w, reviews, status: verdict }, req.user));
  });

  // ---------------------------------------------------------------- peer circles
  function myLangProgrammes(u) {
    const w = { track: 'language' };
    if (!STEWARD.includes(u.role)) w.agency_id = u.agency_id;
    let list = brain.programmes.list(w).filter((p) => p.status !== 'closed');
    if (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length) list = list.filter((p) => u.hamlet_ids.includes(p.hamlet_id));
    return list;
  }
  router.get('/circles', authed, (req, res) => {
    let progs;
    if (req.user.role === 'learner') progs = sql("SELECT e.programme_id id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id WHERE e.person_id=? AND e.deleted=0 AND e.status='active' AND pr.track='language'", req.user.person_id).map((r) => r.id);
    else if (brain.policy.can(req.user, 'teach') || brain.policy.can(req.user, 'ops')) progs = myLangProgrammes(req.user).map((p) => p.id);
    else throw httpError(403, 'forbidden');
    if (req.query.programme_id) progs = progs.filter((x) => x === req.query.programme_id);
    if (!progs.length) return res.json([]);
    const rows = sql(`SELECT * FROM language_circles WHERE deleted=0 AND programme_id IN (${progs.map(() => '?').join(',')}) ORDER BY date DESC LIMIT 200`, ...progs);
    const cnt = Object.fromEntries(sql(`SELECT circle_id, SUM(present) p, COUNT(*) n FROM language_attendance WHERE deleted=0 AND programme_id IN (${progs.map(() => '?').join(',')}) GROUP BY circle_id`, ...progs).map((r) => [r.circle_id, r]));
    const mine = req.user.person_id ? Object.fromEntries(sql('SELECT circle_id, present FROM language_attendance WHERE person_id=? AND deleted=0', req.user.person_id).map((r) => [r.circle_id, r.present])) : {};
    res.json(rows.map((c) => ({ ...c, roleplay: ROLEPLAYS.find((r) => r.id === c.roleplay_id) || null, present: cnt[c.id]?.p || 0, marked: cnt[c.id]?.n || 0, me: req.user.person_id ? (mine[c.id] ?? null) : undefined })));
  });
  router.post('/circles', requires('teach', 'ops'), (req, res) => {
    const b = req.body || {};
    const prog = brain.programmes.get(b.programme_id);
    if (!prog || prog.track !== 'language') throw httpError(404, 'language programme not found');
    if (!myLangProgrammes(req.user).some((p) => p.id === prog.id)) throw httpError(403, 'Not your agency\'s programme');
    if (!b.date) throw httpError(400, 'date required');
    const rp = ROLEPLAYS.find((r) => r.id === b.roleplay_id) || null;
    res.json(data.put('language_circles', { agency_id: prog.agency_id, programme_id: prog.id, hamlet_id: prog.hamlet_id, title: b.title || (rp ? `Circle: ${rp.title}` : 'Language circle'), title_ml: b.title_ml || (rp ? `കൂട്ടം: ${rp.title_ml}` : 'ഭാഷാ കൂട്ടം'), date: b.date, time: b.time || '16:00', place: b.place || 'Learning centre', roleplay_id: rp?.id || null, facilitator: req.user.display_name, notes: b.notes || '', status: 'scheduled' }, req.user));
  });
  router.get('/circles/:id/roster', requires('teach', 'ops'), (req, res) => {
    const c = data.get('language_circles', req.params.id);
    if (!c || !myLangProgrammes(req.user).some((p) => p.id === c.programme_id)) throw httpError(404, 'not found');
    const enr = brain.enrolments.forProgramme(c.programme_id).filter((e) => e.status === 'active');
    const att = Object.fromEntries(data.find('language_attendance', { circle_id: c.id }).map((a) => [a.person_id, a]));
    const visible = enr.filter((e) => access(req.user, e.person_id).ok);
    res.json({ circle: { ...c, roleplay: ROLEPLAYS.find((r) => r.id === c.roleplay_id) || null }, hidden_without_consent: enr.length - visible.length, roster: visible.map((e) => { const p = brain.persons.raw(e.person_id); return { person_id: p.id, name: p.name, present: att[p.id] ? !!att[p.id].present : null, role: att[p.id]?.role || null }; }) });
  });
  router.post('/circles/:id/attendance', requires('teach', 'ops'), (req, res) => {
    const c = data.get('language_circles', req.params.id);
    if (!c || !myLangProgrammes(req.user).some((p) => p.id === c.programme_id)) throw httpError(404, 'not found');
    const marks = Array.isArray(req.body.marks) ? req.body.marks : [];
    let n = 0;
    tx(() => {
      for (const m of marks) {
        if (!access(req.user, m.person_id).ok) continue;
        const ex = data.find('language_attendance', { circle_id: c.id, person_id: m.person_id })[0];
        data.put('language_attendance', { ...(ex || {}), circle_id: c.id, programme_id: c.programme_id, person_id: m.person_id, hamlet_id: c.hamlet_id, present: m.present ? 1 : 0, role: m.role ? String(m.role).slice(0, 60) : (ex?.role || null) }, req.user);
        n++;
      }
      if (c.status !== 'held') data.put('language_circles', { ...c, status: 'held', notes: req.body.notes !== undefined ? String(req.body.notes).slice(0, 500) : c.notes }, req.user);
    });
    res.json({ marked: n });
  });

  // ---------------------------------------------------------------- teacher views
  router.get('/teach/programmes', requires('teach', 'hamlet.coordinate', 'learner.read'), (req, res) => {
    const progs = myLangProgrammes(req.user);
    res.json(progs.map((p) => {
      const enr = brain.enrolments.forProgramme(p.id).filter((e) => e.status === 'active');
      const ids = enr.map((e) => e.person_id).filter((id) => access(req.user, id).ok);
      const pend = ids.length ? sqlOne(`SELECT COUNT(*) n FROM language_speaking WHERE deleted=0 AND status='pending' AND person_id IN (${ids.map(() => '?').join(',')})`, ...ids).n : 0;
      const since = new Date(Date.now() - 30 * 86400e3).toISOString();
      const act = ids.length ? sqlOne(`SELECT COUNT(*) n, COUNT(DISTINCT person_id) a FROM language_progress WHERE deleted=0 AND completed_at>=? AND person_id IN (${ids.map(() => '?').join(',')})`, since, ...ids) : { n: 0, a: 0 };
      const h = brain.hamlets.get(p.hamlet_id);
      const next = sqlOne("SELECT date, time, title FROM language_circles WHERE deleted=0 AND programme_id=? AND date>=? ORDER BY date LIMIT 1", p.id, nowIso().slice(0, 10));
      return { id: p.id, title: p.title, title_ml: p.title_ml, hamlet_id: p.hamlet_id, hamlet: h?.name, hamlet_ml: h?.name_ml, agency: brain.agencies.get(p.agency_id)?.name, schedule: p.schedule, enrolled: enr.length, visible: ids.length, pending_reviews: pend, activities_30d: act.n, active_30d: act.a, next_circle: next };
    }));
  });
  router.get('/teach/class/:programmeId', requires('teach', 'hamlet.coordinate', 'learner.read'), (req, res) => {
    const prog = brain.programmes.get(req.params.programmeId);
    if (!prog || prog.track !== 'language') throw httpError(404, 'language programme not found');
    if (!myLangProgrammes(req.user).some((p) => p.id === prog.id)) throw httpError(403, 'Not your agency\'s class');
    const enr = brain.enrolments.forProgramme(prog.id).filter((e) => e.status === 'active');
    const vis = enr.filter((e) => access(req.user, e.person_id).ok);
    const learners = vis.map((e) => {
      const p = brain.persons.raw(e.person_id);
      const lv = levelsFor(p.id);
      const sp = sqlOne('SELECT COUNT(*) n, AVG(COALESCE(teacher_rating, peer_rating, self_rating)) r, SUM(status=\'pending\') pend FROM language_speaking WHERE deleted=0 AND person_id=?', p.id);
      const att = sqlOne('SELECT COUNT(*) n, SUM(present) p FROM language_attendance WHERE deleted=0 AND person_id=? AND programme_id=?', p.id, prog.id);
      const last = sqlOne('SELECT MAX(completed_at) t FROM language_progress WHERE deleted=0 AND person_id=?', p.id)?.t;
      return { id: p.id, name: p.name, kind: p.kind, home_language: p.language, levels: Object.fromEntries(Object.entries(lv).map(([k, v]) => [k, v.level])), eng: lv['eng-spoken'], speaking: sp.n, avg_rating: sp.r ? Math.round(sp.r * 10) / 10 : null, pending: sp.pend || 0, attendance: att.n ? Math.round((att.p / att.n) * 100) : null, last };
    });
    const h = brain.hamlets.get(prog.hamlet_id);
    res.json({ programme: { id: prog.id, title: prog.title, title_ml: prog.title_ml, hamlet: h?.name, hamlet_ml: h?.name_ml, hamlet_id: prog.hamlet_id, agency: brain.agencies.get(prog.agency_id)?.name, schedule: prog.schedule }, learners, hidden_without_consent: enr.length - vis.length,
      levels: LEVELS.map((l) => ({ level: l, n: learners.filter((x) => x.levels['eng-spoken'] && LEVELS.indexOf(x.levels['eng-spoken']) >= LEVELS.indexOf(l)).length })) });
  });
  router.get('/teach/learner/:pid', requires('teach', 'learner.read'), (req, res) => {
    const a = access(req.user, req.params.pid);
    if (!a.ok) throw httpError(403, 'Not permitted: ' + a.reason);
    const p = brain.persons.get(req.user, req.params.pid, 'progress');
    res.json({ person: { id: p.id, name: p.name, age: p.age, language: p.language }, levels: levelsFor(p.id), speaking: sql('SELECT id, course_id, unit_id, activity_id, prompt, self_rating, peer_rating, teacher_rating, teacher_note, status, created_at, sample_bytes FROM language_speaking WHERE deleted=0 AND person_id=? ORDER BY created_at DESC LIMIT 50', p.id), badges: sql('SELECT course_id, level, awarded_at FROM language_levels WHERE person_id=? AND deleted=0', p.id) });
  });

  // ---------------------------------------------------------------- admin overview (aggregates)
  router.get('/admin/overview', requires('analytics.aggregate', 'platform.manage'), (req, res) => {
    const u = req.user;
    let scope = null;
    if (u.role === 'agency_admin' || u.role === 'coordinator') {
      scope = new Set(sql("SELECT DISTINCT e.person_id FROM enrolments e JOIN programmes p ON p.id=e.programme_id WHERE e.deleted=0 AND e.agency_id=? AND p.track='language'", u.agency_id).map((r) => r.person_id));
    }
    const inScope = (rows) => (scope === null ? rows : rows.filter((r) => scope.has(r.person_id)));
    const S = (n) => brain.policy.suppress(n, u);
    const prog = inScope(sql('SELECT person_id, hamlet_id, course_id, completed_at FROM language_progress WHERE deleted=0'));
    const lv = inScope(sql('SELECT person_id, hamlet_id, course_id, level FROM language_levels WHERE deleted=0'));
    const sp = inScope(sql('SELECT person_id, status, teacher_rating FROM language_speaking WHERE deleted=0'));
    const att = inScope(sql('SELECT person_id, present FROM language_attendance WHERE deleted=0'));
    const words = data.find('language_words', {}, { limit: 5000 });
    const months = [];
    for (let m = 5; m >= 0; m--) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m); const key = d.toISOString().slice(0, 7); months.push({ month: key, activities: prog.filter((r) => (r.completed_at || '').startsWith(key)).length }); }
    res.json({
      totals: { learners: S(new Set(prog.map((r) => r.person_id)).size), activities: S(prog.length), speaking: S(sp.length), reviewed: S(sp.filter((s) => s.status === 'reviewed').length), circles_attendance: att.length ? Math.round((att.filter((a) => a.present).length / att.length) * 100) : null, words: words.length },
      levels: COURSES.map((c) => ({ course: c.id, title: c.title, title_ml: c.title_ml, by: LEVELS.map((l) => ({ level: l, n: S(new Set(lv.filter((x) => x.course_id === c.id && x.level === l).map((x) => x.person_id)).size) })) })),
      words: BRIDGE_LANGS.map((l) => ({ language: l, total: words.filter((w) => w.language === l).length, checked: words.filter((w) => w.language === l && w.status === 'community_checked').length })),
      months, k_anonymity: 5,
    });
  });

  return {
    seed: async (demo) => seedAll(ctx, demo, { COURSES, COURSE, activities, BRIDGE_CONCEPTS, BRIDGE_LANGS, ROLEPLAYS, NEW_COMPETENCIES, syncLevels, SPEAK_CHECKS }),
    health: () => ({ courses: COURSES.length, activities: sqlOne('SELECT COUNT(*) n FROM language_progress WHERE deleted=0').n, pending_reviews: sqlOne("SELECT COUNT(*) n FROM language_speaking WHERE deleted=0 AND status='pending'").n, words: sqlOne('SELECT COUNT(*) n FROM language_words WHERE deleted=0').n }),
    _test: { computeLevel, activities, COURSE },
  };
};
