'use strict';
// AADI — Life Skills & Digital module (tracks: lifeskills, digital).
// Urban readiness, workplace & rights, personal safety, UPI/banking, government portals,
// plus the mandatory Digital citizenship & online safety gate, document-readiness checklist
// (status only — never ID numbers) and a self + facilitator soft-skills assessment.
const fs = require('fs');
const path = require('path');

const CONTENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'modules.json'), 'utf8'));
const MODS = Object.fromEntries(CONTENT.modules.map((m) => [m.id, m]));
const GATE = 'digital_citizenship';
const DOCS = CONTENT.documents;
const DOC_KEYS = DOCS.map((d) => d.key);
const DOC_STATUS = ['have', 'applied', 'missing', 'not_needed'];
const SKILLS = CONTENT.softskills.map((s) => s.key);
const PASS_PCT = 0.7;
const STAFF_WRITE = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'];
const EXTRA_COMP = [
  { id: 'cmp_ls_groom', code: 'LS.GROOM', domain: 'lifeskills', title: 'Personal hygiene & presentation', title_ml: 'വ്യക്തിശുചിത്വം, അവതരണം', level: 1, stage: 'youth' },
  { id: 'cmp_ls_rights', code: 'LS.RIGHTS', domain: 'lifeskills', title: 'Knows rights at work', title_ml: 'ജോലിസ്ഥല അവകാശങ്ങൾ അറിയുന്നു', level: 2, stage: 'youth' },
];

// Strip anything that looks like an ID number from free text (Aadhaar 12 digits, PAN, account numbers).
function scrubIds(s) {
  return String(s || '').slice(0, 300)
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[removed]')
    .replace(/\d[\d\s-]{5,}\d/g, '[removed]');
}

function walkScenario(mod, choices) {
  const sc = mod.scenario;
  let node = sc.start, score = 0, max = 0;
  const trail = [];
  for (const raw of (Array.isArray(choices) ? choices : []).slice(0, 12)) {
    const n = sc.nodes[node];
    if (!n || n.end) break;
    const c = n.choices[Number(raw)];
    if (!c) break;
    score += c.score; max += Math.max(...n.choices.map((x) => x.score));
    trail.push({ node, choice: Number(raw), score: c.score });
    node = c.next;
  }
  const ended = !!(sc.nodes[node] && sc.nodes[node].end);
  return { score, max, trail, ended, end_node: node };
}

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError } = ctx;
  const now = () => new Date().toISOString();

  // ---------- access helpers ----------
  function need(user, pid, scope = 'progress') {
    const v = brain.policy.canSee(user, pid, scope);
    if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
    if (v.audited && user.person_id !== pid) brain.audit(user, 'person_read', pid, { scope });
    const p = brain.persons.raw(pid);
    if (!p) throw httpError(404, 'Person not found');
    return p;
  }
  function needWrite(user, pid) {
    const p = need(user, pid, 'progress');
    const ok = user.person_id === pid || (user.role === 'guardian' && p.guardian_id === user.person_id) || STAFF_WRITE.includes(user.role) || user.role === 'cpo';
    if (!ok) throw httpError(403, 'You cannot update this record.');
    return p;
  }
  const isStaff = (u) => STAFF_WRITE.includes(u.role) || u.role === 'cpo';
  function lsAgencyFor(pid, user) {
    const progs = brain.enrolments.forPerson(pid).filter((e) => e.status === 'active' || e.status === 'completed')
      .map((e) => brain.programmes.get(e.programme_id)).filter((p) => p && p.module === 'lifeskills');
    if (progs.length) return progs[0].agency_id;
    if (user && user.agency_id && isStaff(user)) return user.agency_id;
    const steward = brain.agencies.list().find((a) => Number(a.steward) === 1);
    return steward ? steward.id : null;
  }

  // ---------- progress model ----------
  const progressRows = (pid) => data.find('lifeskills_progress', { person_id: pid });
  function progressRow(pid, key) { return data.find('lifeskills_progress', { person_id: pid, module_key: key })[0] || null; }
  function gateStatus(pid) {
    const r = progressRow(pid, GATE);
    return { passed: !!(r && Number(r.passed) === 1), passed_at: r && r.passed_at || null };
  }
  function summarise(pid) {
    const rows = Object.fromEntries(progressRows(pid).map((r) => [r.module_key, r]));
    return CONTENT.modules.map((m) => {
      const r = rows[m.id];
      const lessons = (r && Array.isArray(r.lessons_done) ? r.lessons_done : []).filter((x) => m.lessons.some((l) => l.id === x));
      return {
        key: m.id, track: m.track, icon: m.icon, title: m.title, title_ml: m.title_ml, mandatory: !!m.mandatory,
        lessons_total: m.lessons.length, lessons_done: lessons.length, scenario_score: r ? r.scenario_score : null, scenario_max: r ? r.scenario_max : null,
        quiz_score: r ? r.quiz_score : null, quiz_total: r ? r.quiz_total : null, passed: !!(r && Number(r.passed) === 1), passed_at: r ? r.passed_at : null,
        pct: Math.round(((lessons.length + (r && r.scenario_max ? 1 : 0) + (r && Number(r.passed) === 1 ? 1 : 0)) / (m.lessons.length + 2)) * 100),
      };
    });
  }
  function upsertProgress(p, key, patch, user) {
    const cur = progressRow(p.id, key);
    return data.put('lifeskills_progress', { ...(cur || { person_id: p.id, hamlet_id: p.hamlet_id, module_key: key, lessons_done: [], attempts: 0, passed: 0 }), ...patch }, user);
  }

  function docsFor(pid) {
    const rows = Object.fromEntries(data.find('lifeskills_documents', { person_id: pid }).map((r) => [r.doc_key, r]));
    return DOCS.map((d) => ({ ...d, status: rows[d.key] ? rows[d.key].status : 'missing', note: rows[d.key] ? rows[d.key].note : '', due_date: rows[d.key] ? rows[d.key].due_date : null, updated_at: rows[d.key] ? rows[d.key].updated_at : null, reminded_at: rows[d.key] ? rows[d.key].reminded_at : null }));
  }
  function docReadiness(docs) {
    const need = docs.filter((d) => d.status !== 'not_needed');
    return need.length ? Math.round((need.filter((d) => d.status === 'have').length / need.length) * 100) : 100;
  }

  function skillsFor(pid) {
    const rows = data.find('lifeskills_softskills', { person_id: pid }, { order: 'rated_at DESC' });
    const latest = (role) => rows.find((r) => r.rater_role === role) || null;
    const clean = (r) => r && ({ id: r.id, rater_role: r.rater_role, rater_name: r.rater_name, ratings: r.ratings, note: r.note, rated_at: r.rated_at });
    return { skills: CONTENT.softskills, rubric: CONTENT.rubric, self: clean(latest('self')), facilitator: clean(latest('facilitator')), history: rows.slice(0, 12).map(clean) };
  }

  // ---------- content ----------
  router.get('/catalog', authed, (req, res) => {
    res.json({
      modules: CONTENT.modules.map((m) => ({ key: m.id, track: m.track, icon: m.icon, title: m.title, title_ml: m.title_ml, summary: m.summary, summary_ml: m.summary_ml, mandatory: !!m.mandatory, minutes: m.minutes, lessons: m.lessons.length, competency: m.competency })),
      documents: DOCS, softskills: CONTENT.softskills, rubric: CONTENT.rubric, gate: GATE, pass_pct: PASS_PCT,
    });
  });
  router.get('/modules/:key', authed, (req, res) => {
    const m = MODS[req.params.key];
    if (!m) throw httpError(404, 'No such module');
    // answers are not sent to the client; grading happens on the server
    res.json({ ...m, quiz: m.quiz.map(({ q, q_ml, options, options_ml }) => ({ q, q_ml, options, options_ml })) });
  });

  // ---------- the mandatory gate (used by other modules / shell) ----------
  router.get('/gate/:personId', authed, (req, res) => {
    const pid = req.params.personId;
    const v = brain.policy.canSee(req.user, pid, 'profile');
    if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
    res.json({ person_id: pid, module: GATE, ...gateStatus(pid) });
  });

  // ---------- person progress ----------
  router.get('/progress/:personId', authed, (req, res) => {
    const p = need(req.user, req.params.personId, 'progress');
    const docs = docsFor(p.id);
    res.json({ person: { id: p.id, name: p.name, kind: p.kind, hamlet_id: p.hamlet_id }, gate: gateStatus(p.id), modules: summarise(p.id), documents: { readiness: docReadiness(docs), missing: docs.filter((d) => d.status === 'missing').length }, can_write: req.user.person_id === p.id || isStaff(req.user) || req.user.role === 'guardian' });
  });

  function canStartModule(p, key) {
    if (key === GATE) return true;
    return gateStatus(p.id).passed;
  }

  router.post('/progress/:personId/:key/lesson', authed, (req, res) => {
    const p = needWrite(req.user, req.params.personId);
    const m = MODS[req.params.key];
    if (!m) throw httpError(404, 'No such module');
    const lid = String(req.body.lesson_id || '');
    if (!m.lessons.some((l) => l.id === lid)) throw httpError(400, 'Unknown lesson');
    const cur = progressRow(p.id, m.id);
    const done = new Set(cur && Array.isArray(cur.lessons_done) ? cur.lessons_done : []);
    done.add(lid);
    const row = upsertProgress(p, m.id, { lessons_done: [...done], last_at: now() }, req.user);
    emit('lifeskills.lesson_completed', { person_id: p.id, module: m.id, lesson: lid }, req.user, p.hamlet_id);
    res.json({ ok: true, lessons_done: row.lessons_done.length, lessons_total: m.lessons.length });
  });

  router.post('/progress/:personId/:key/scenario', authed, (req, res) => {
    const p = needWrite(req.user, req.params.personId);
    const m = MODS[req.params.key];
    if (!m) throw httpError(404, 'No such module');
    const w = walkScenario(m, req.body.choices);
    if (!w.trail.length) throw httpError(400, 'No choices made');
    const cur = progressRow(p.id, m.id);
    const best = cur && cur.scenario_max ? Math.max(Number(cur.scenario_score) / Number(cur.scenario_max), w.score / w.max) : w.score / w.max;
    const row = upsertProgress(p, m.id, { scenario_score: Math.round(best * w.max), scenario_max: w.max, scenario_path: w.trail, last_at: now() }, req.user);
    res.json({ ok: true, score: w.score, max: w.max, ended: w.ended, best: row.scenario_score });
  });

  router.post('/progress/:personId/:key/quiz', authed, (req, res) => {
    const p = needWrite(req.user, req.params.personId);
    const m = MODS[req.params.key];
    if (!m) throw httpError(404, 'No such module');
    if (!canStartModule(p, m.id)) throw httpError(409, 'Please complete "Digital citizenship & online safety" first.');
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const results = m.quiz.map((q, i) => ({ correct: Number(answers[i]) === q.answer, answer: q.answer, why: q.why, why_ml: q.why_ml }));
    const score = results.filter((r) => r.correct).length;
    const total = m.quiz.length;
    const cur = progressRow(p.id, m.id);
    const lessonsDone = (cur && Array.isArray(cur.lessons_done) ? cur.lessons_done : []).length;
    const passedNow = score / total >= PASS_PCT && lessonsDone >= m.lessons.length;
    const wasPassed = !!(cur && Number(cur.passed) === 1);
    const out = tx(() => {
      const row = upsertProgress(p, m.id, { quiz_score: Math.max(score, Number(cur && cur.quiz_score) || 0), quiz_total: total, attempts: (Number(cur && cur.attempts) || 0) + 1, passed: wasPassed || passedNow ? 1 : 0, passed_at: wasPassed ? cur.passed_at : passedNow ? now() : null, last_at: now() }, req.user);
      const awards = [];
      if (passedNow && !wasPassed) {
        const agency_id = lsAgencyFor(p.id, req.user);
        for (const code of [m.competency, ...(m.also || [])]) {
          const comp = brain.competencies.list({ code })[0];
          awards.push(brain.passport.award({ person_id: p.id, type: 'competency', ref: code, title: comp ? comp.title : m.title, level: comp ? comp.level : 1, evidence: { module: 'lifeskills', unit: m.id, quiz: `${score}/${total}`, scenario: cur && cur.scenario_max ? `${cur.scenario_score}/${cur.scenario_max}` : null }, agency_id }, req.user).ref);
        }
        emit('lifeskills.module_passed', { person_id: p.id, module: m.id, gate: m.id === GATE }, req.user, p.hamlet_id);
      }
      return { row, awards };
    });
    res.json({ ok: true, score, total, passed: Number(out.row.passed) === 1, passed_now: passedNow && !wasPassed, lessons_needed: lessonsDone < m.lessons.length ? m.lessons.length - lessonsDone : 0, results, awards: out.awards });
  });

  // ---------- document readiness (status only) ----------
  router.get('/documents/:personId', authed, (req, res) => {
    const p = need(req.user, req.params.personId, 'progress');
    const docs = docsFor(p.id);
    res.json({ person: { id: p.id, name: p.name }, documents: docs, readiness: docReadiness(docs), statuses: DOC_STATUS });
  });
  router.put('/documents/:personId/:docKey', authed, (req, res) => {
    const p = needWrite(req.user, req.params.personId);
    if (!DOC_KEYS.includes(req.params.docKey)) throw httpError(400, 'Unknown document');
    const status = String(req.body.status || '');
    if (!DOC_STATUS.includes(status)) throw httpError(400, 'Status must be one of ' + DOC_STATUS.join(', '));
    if (/\d{6,}/.test(String(req.body.note || '').replace(/[\s-]/g, ''))) {
      // explicit, so the UI can explain why
      throw httpError(400, 'Please do not type ID or account numbers here — only the status is stored.');
    }
    const cur = data.find('lifeskills_documents', { person_id: p.id, doc_key: req.params.docKey })[0];
    const row = data.put('lifeskills_documents', { ...(cur || { person_id: p.id, hamlet_id: p.hamlet_id, doc_key: req.params.docKey }), status, note: scrubIds(req.body.note), due_date: req.body.due_date || null, updated_by: req.user.id }, req.user);
    res.json(row);
  });
  // Send reminders for missing / applied documents through the brain outbox.
  router.post('/documents/remind', requires('learner.write', 'teach', 'counsel', 'mentor'), (req, res) => {
    let ids = Array.isArray(req.body.person_ids) ? req.body.person_ids : req.body.person_id ? [req.body.person_id] : [];
    if (!ids.length && req.body.hamlet_id) ids = cohortIds(req.user, req.body.hamlet_id);
    let sent = 0;
    const out = tx(() => {
      for (const pid of ids.slice(0, 300)) {
        if (!brain.policy.canSee(req.user, pid, 'contact').ok && !brain.policy.canSee(req.user, pid, 'progress').ok) continue;
        const docs = docsFor(pid).filter((d) => d.status === 'missing' || d.status === 'applied');
        if (!docs.length) continue;
        const missing = docs.filter((d) => d.status === 'missing').map((d) => d.label_ml).join(', ');
        const applied = docs.filter((d) => d.status === 'applied').map((d) => d.label_ml).join(', ');
        const msg = `${brain.brand.short}: ${missing ? 'ഇനി വേണ്ട രേഖകൾ: ' + missing + '. ' : ''}${applied ? 'അപേക്ഷിച്ചവ പരിശോധിക്കുക: ' + applied + '. ' : ''}സഹായത്തിന് പഠനകേന്ദ്രം / അക്ഷയ സന്ദർശിക്കുക.`;
        brain.notify(pid, msg, { channel: 'auto' }, req.user);
        for (const d of docs) {
          const cur = data.find('lifeskills_documents', { person_id: pid, doc_key: d.key })[0];
          if (cur) data.put('lifeskills_documents', { ...cur, reminded_at: now() }, req.user);
        }
        sent++;
      }
      return sent;
    });
    res.json({ ok: true, reminded: out });
  });

  // ---------- soft skills (self + facilitator rubric) ----------
  router.get('/softskills/:personId', authed, (req, res) => {
    const p = need(req.user, req.params.personId, 'progress');
    res.json({ person: { id: p.id, name: p.name }, ...skillsFor(p.id) });
  });
  router.post('/softskills/:personId', authed, (req, res) => {
    const p = needWrite(req.user, req.params.personId);
    const self = req.user.person_id === p.id;
    if (!self && !isStaff(req.user)) throw httpError(403, 'Only the learner or their facilitator can rate.');
    const ratings = {};
    for (const k of SKILLS) {
      const v = Number(req.body.ratings && req.body.ratings[k]);
      if (v >= 1 && v <= 4) ratings[k] = Math.round(v);
    }
    if (Object.keys(ratings).length < 3) throw httpError(400, 'Rate at least three skills.');
    const row = data.put('lifeskills_softskills', { person_id: p.id, hamlet_id: p.hamlet_id, rater_role: self ? 'self' : 'facilitator', rater_id: req.user.id, rater_name: req.user.display_name, ratings, note: String(req.body.note || '').slice(0, 500), rated_at: now(), agency_id: req.user.agency_id || null }, req.user);
    if (!self) {
      const avg = Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length;
      if (avg >= 3 && ratings.presentation >= 3) brain.passport.award({ person_id: p.id, type: 'milestone', ref: 'LS.SOFT', title: 'Soft skills — work ready (facilitator assessed)', level: 1, evidence: { avg: Number(avg.toFixed(1)) }, agency_id: lsAgencyFor(p.id, req.user) }, req.user);
    }
    res.json(row);
  });

  // ---------- cohort / staff views ----------
  function cohortIds(user, hamlet_id) {
    const vis = brain.persons.visibleIds(user);
    let rows = sql(`SELECT DISTINCT e.person_id id FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id
      WHERE e.deleted=0 AND e.status IN ('active','completed') AND pr.module='lifeskills'${hamlet_id ? ' AND e.hamlet_id=?' : ''}${user.agency_id && !['platform_admin', 'cpo'].includes(user.role) ? ' AND e.agency_id=?' : ''}`,
    ...[hamlet_id, user.agency_id && !['platform_admin', 'cpo'].includes(user.role) ? user.agency_id : null].filter(Boolean)).map((r) => r.id);
    if (vis !== null) { const s = new Set(vis); rows = rows.filter((id) => s.has(id)); }
    return rows.filter((id) => brain.policy.canSee(user, id, 'progress').ok);
  }
  router.get('/cohort', requires('learner.read'), (req, res) => {
    const ids = cohortIds(req.user, req.query.hamlet_id || null);
    if (['platform_admin', 'cpo'].includes(req.user.role)) brain.audit(req.user, 'cohort_read', req.query.hamlet_id || 'all', { n: ids.length });
    const out = ids.slice(0, 400).map((id) => {
      const p = brain.persons.raw(id);
      const mods = summarise(id);
      const docs = docsFor(id);
      return { id, name: p.name, kind: p.kind, hamlet_id: p.hamlet_id, gate: gateStatus(id).passed, passed: mods.filter((m) => m.passed).length, total: mods.length, docs_ready: docReadiness(docs), docs_missing: docs.filter((d) => d.status === 'missing').length };
    }).sort((a, b) => a.name.localeCompare(b.name));
    res.json(out);
  });

  router.get('/stats', requires('learner.read', 'analytics.aggregate'), (req, res) => {
    const sup = (n) => brain.policy.suppress(n, req.user);
    const where = req.query.hamlet_id ? ' AND hamlet_id=?' : '';
    const args = req.query.hamlet_id ? [req.query.hamlet_id] : [];
    const learners = sqlOne(`SELECT COUNT(DISTINCT person_id) n FROM lifeskills_progress WHERE deleted=0${where}`, ...args).n;
    const gate = sqlOne(`SELECT COUNT(*) n FROM lifeskills_progress WHERE deleted=0 AND module_key=? AND passed=1${where}`, GATE, ...args).n;
    const byModule = CONTENT.modules.map((m) => ({ key: m.id, icon: m.icon, title: m.title, title_ml: m.title_ml, passed: sup(sqlOne(`SELECT COUNT(*) n FROM lifeskills_progress WHERE deleted=0 AND module_key=? AND passed=1${where}`, m.id, ...args).n) }));
    const docRows = sql(`SELECT doc_key, status, COUNT(*) n FROM lifeskills_documents WHERE deleted=0${where} GROUP BY doc_key, status`, ...args);
    const docs = DOCS.map((d) => { const r = docRows.filter((x) => x.doc_key === d.key); const tot = r.reduce((a, x) => a + x.n, 0); const have = r.filter((x) => x.status === 'have').reduce((a, x) => a + x.n, 0); return { key: d.key, icon: d.icon, label: d.label, label_ml: d.label_ml, pct: tot >= 5 ? Math.round((have / tot) * 100) : null }; });
    res.json({ learners: sup(learners), gate_passed: sup(gate), gate_pct: learners >= 5 ? Math.round((gate / learners) * 100) : null, by_module: byModule, documents: docs });
  });

  router.get('/me', authed, (req, res) => {
    // convenience: which person(s) can this user act for in this module?
    const u = req.user;
    const people = [];
    if (u.person_id) { const p = brain.persons.raw(u.person_id); if (p) people.push({ id: p.id, name: p.name, kind: p.kind, self: true }); }
    if (u.role === 'guardian') for (const w of sql('SELECT id, name, kind FROM persons WHERE guardian_id=? AND deleted=0', u.person_id || '-')) people.push({ id: w.id, name: w.name, kind: w.kind, ward: true });
    res.json({ people, staff: isStaff(u) });
  });

  // ---------- seed ----------
  async function seed(demo) {
    const { R, daysAgo } = demo;
    for (const c of EXTRA_COMP) if (!brain.competencies.list({ code: c.code }).length) brain.competencies.upsert(c);
    const enrolled = new Map();
    for (const pr of demo.programmes.filter((p) => p.module === 'lifeskills')) for (const p of demo.enrolledIn(pr.id)) enrolled.set(p.id, { p, agency_id: pr.agency_id });
    if (demo.demoYouth) enrolled.set(demo.demoYouth.id, { p: demo.demoYouth, agency_id: (demo.agencyByKey.cif || {}).id, demoYouth: true });
    if (demo.demoLearner) enrolled.delete(demo.demoLearner.id); // demo child starts fresh so the gate can be shown live
    const sysUser = demo.users.facilitator || null;
    const facilitatorFor = (p) => (p.hamlet_id === demo.hamletByKey.h1.id ? demo.users.facilitator : p.hamlet_id === demo.hamletByKey.h2.id ? demo.users.facilitator2 : demo.users.facilitator) || sysUser;
    const t0 = Date.now();
    tx(() => {
      for (const { p, agency_id, demoYouth } of enrolled.values()) {
        const isYouth = p.kind === 'youth';
        const gatePassed = demoYouth || R.chance(isYouth ? 0.8 : 0.6);
        let day = R.int(40, 170);
        for (const m of CONTENT.modules) {
          const isGate = m.id === GATE;
          let lessons = 0, passed = false;
          if (isGate) { lessons = gatePassed ? m.lessons.length : R.int(0, m.lessons.length); passed = gatePassed; }
          else if (gatePassed) {
            const pass = demoYouth ? ['rights', 'safety', 'upi_banking', 'interview'].includes(m.id) : R.chance(isYouth ? 0.45 : 0.25);
            lessons = pass ? m.lessons.length : R.chance(0.4) ? R.int(1, m.lessons.length) : 0;
            passed = pass;
            if (demoYouth && m.id === 'city') lessons = 1;
          }
          if (!lessons && !passed) continue;
          day = Math.max(2, day - R.int(3, 14));
          const w = walkScenario(m, Object.values(m.scenario.nodes).filter((n) => !n.end).map((n) => (R.chance(passed ? 0.85 : 0.5) ? n.choices.findIndex((c) => c.score === 2) : R.int(0, n.choices.length - 1))));
          const qs = passed ? Math.max(Math.ceil(m.quiz.length * PASS_PCT), m.quiz.length - R.int(0, 1)) : R.int(0, m.quiz.length - 1);
          data.put('lifeskills_progress', { person_id: p.id, hamlet_id: p.hamlet_id, module_key: m.id, lessons_done: m.lessons.slice(0, lessons).map((l) => l.id), scenario_score: lessons >= m.lessons.length ? w.score : null, scenario_max: lessons >= m.lessons.length ? w.max : null, scenario_path: w.trail, quiz_score: passed || R.chance(0.3) ? qs : null, quiz_total: m.quiz.length, attempts: passed ? R.int(1, 2) : R.int(0, 1), passed: passed ? 1 : 0, passed_at: passed ? daysAgo(day) : null, last_at: daysAgo(day) }, null);
          if (passed) for (const code of [m.competency, ...(m.also || [])]) {
            const e = brain.passport.award({ person_id: p.id, type: 'competency', ref: code, title: (EXTRA_COMP.find((c) => c.code === code) || brain.competencies.list({ code })[0] || { title: m.title }).title, level: 1, evidence: { module: 'lifeskills', unit: m.id, quiz: `${qs}/${m.quiz.length}` }, agency_id }, null);
            if (e && e.issued_at > daysAgo(1)) demo.store.put('passport_entries', { ...e, issued_at: daysAgo(day) });
          }
        }
        // documents (youth mainly)
        if (isYouth || R.chance(0.3)) {
          for (const d of DOCS) {
            let status = 'missing';
            const r = R.rnd();
            if (d.key === 'aadhaar') status = r < 0.92 ? 'have' : 'applied';
            else if (d.key === 'ration_card') status = r < 0.85 ? 'have' : 'missing';
            else if (d.key === 'pan') status = r < 0.25 ? 'have' : r < 0.4 ? 'applied' : 'missing';
            else if (d.key === 'sslc_cert') status = isYouth ? (r < 0.75 ? 'have' : 'missing') : 'not_needed';
            else status = r < 0.55 ? 'have' : r < 0.75 ? 'applied' : 'missing';
            if (demoYouth) status = { aadhaar: 'have', community_cert: 'have', income_cert: 'applied', bank_account: 'have', sslc_cert: 'have', pan: 'missing', photos: 'have', ration_card: 'have' }[d.key];
            const note = status === 'applied' ? R.pick(['Applied at Akshaya', 'Waiting at Village Office', 'Applied via e-District']) : status === 'missing' && R.chance(0.4) ? R.pick(['Need help from facilitator', 'Lost — apply for duplicate']) : '';
            data.put('lifeskills_documents', { person_id: p.id, hamlet_id: p.hamlet_id, doc_key: d.key, status, note, due_date: status === 'applied' ? daysAgo(-R.int(5, 30)).slice(0, 10) : null, reminded_at: status === 'missing' && R.chance(0.3) ? daysAgo(R.int(3, 20)) : null }, null);
          }
        }
        // soft skills
        if (isYouth && (demoYouth || R.chance(0.6))) {
          const base = R.int(1, 3);
          const mk = (bias) => Object.fromEntries(SKILLS.map((k) => [k, Math.max(1, Math.min(4, base + bias + R.int(-1, 1)))]));
          const f = facilitatorFor(p);
          data.put('lifeskills_softskills', { person_id: p.id, hamlet_id: p.hamlet_id, rater_role: 'self', rater_id: null, rater_name: p.name, ratings: mk(1), note: '', rated_at: daysAgo(R.int(20, 60)), agency_id }, null);
          data.put('lifeskills_softskills', { person_id: p.id, hamlet_id: p.hamlet_id, rater_role: 'facilitator', rater_id: f && f.id, rater_name: f ? f.display_name : 'Facilitator', ratings: mk(0), note: R.pick(['Speaks well in groups; needs practice with English greetings.', 'Very punctual. Encourage to ask questions.', 'Good with phone and UPI; shy in interviews.']), rated_at: daysAgo(R.int(5, 30)), agency_id }, null);
        }
      }
    });
    ctx.log(`seeded ${enrolled.size} learners in ${Date.now() - t0}ms`);
  }

  return {
    seed,
    health: () => ({ learners: sqlOne('SELECT COUNT(DISTINCT person_id) n FROM lifeskills_progress WHERE deleted=0').n, gate_passed: sqlOne('SELECT COUNT(*) n FROM lifeskills_progress WHERE deleted=0 AND module_key=? AND passed=1', GATE).n, modules: CONTENT.modules.length }),
    gateStatus,
  };
};
