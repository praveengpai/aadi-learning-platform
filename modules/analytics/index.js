'use strict';
// AADI — Impact & Insight.
// Aggregates across modules (privileged read of persons/enrolments/consents/passport_entries),
// with k-anonymity for every external audience. Module tables from learning / exams /
// counselling / lifeskills / marketplace are read defensively: if a module is not installed,
// its metrics are simply reported as unavailable.
const crypto = require('crypto');

const K = 5;
const EXTERNAL = ['donor', 'govt_viewer'];
const RISK_STAFF = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor'];
const AGE_BANDS = [[0, 10, '6–10'], [11, 14, '11–14'], [15, 17, '15–17'], [18, 24, '18–24'], [25, 200, '25+']];
const TRACKS = ['tuition', 'literacy', 'exams', 'language', 'lifeskills', 'digital', 'counselling'];

module.exports = function init(ctx) {
  const { router, requires, data, sql, sqlOne, emit, brain, httpError } = ctx;
  const now = () => new Date().toISOString();
  const daysAgo = (n) => new Date(Date.now() - n * 86400e3).toISOString();
  const AGG = requires('analytics.aggregate');

  // ---------------- helpers ----------------
  const safe = (fn, fallback = null) => { try { return fn(); } catch (_) { return fallback; } };
  const ageOf = (dob) => (dob ? Math.floor((Date.now() - new Date(dob)) / 3.15576e10) : null);
  const bandOf = (age) => { if (age === null) return 'unknown'; const b = AGE_BANDS.find(([a, z]) => age >= a && age <= z); return b ? b[2] : 'unknown'; };
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const r1 = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);
  const inList = (ids) => ids.map(() => '?').join(',') || "''";

  // Who is this view for, and over which people?
  // mode: platform | agency | hamlet | external
  function audience(user, q = {}) {
    const ext = EXTERNAL.includes(user.role);
    if (ext) return { mode: user.role === 'donor' ? 'donor' : 'govt', ext: true, label: user.role === 'donor' ? 'Donor (anonymised)' : 'Government (anonymised)' };
    if (['platform_admin', 'cpo'].includes(user.role)) return { mode: 'platform', ext: false, label: 'Platform (all agencies)', agency_id: q.agency_id || null };
    if (user.role === 'agency_admin') return { mode: 'agency', ext: false, label: 'Agency', agency_id: user.agency_id };
    if (user.role === 'coordinator') {
      const hs = Array.isArray(user.hamlet_ids) && user.hamlet_ids.length ? user.hamlet_ids : sql('SELECT hamlet_id FROM agency_presence WHERE agency_id=? AND deleted=0', user.agency_id).map((r) => r.hamlet_id);
      // a coordinator sees a cross-agency hamlet view — aggregates only, always k-anonymised
      return { mode: 'hamlet', ext: true, label: 'Hamlet (all agencies, anonymised)', hamlets: hs };
    }
    throw httpError(403, 'No dashboard for this role');
  }
  // k-anonymity: external audiences always suppressed; internal counts exact.
  const supFor = (aud, user) => (n) => {
    if (n === null || n === undefined) return null;
    if (aud.ext) return n > 0 && n < K ? `<${K}` : n;
    return brain.policy.suppress(n, user);
  };

  // ---------------- data load ----------------
  function load(aud, { hamlet_id = null } = {}) {
    const hamlets = brain.hamlets.list();
    const hmap = Object.fromEntries(hamlets.map((h) => [h.id, h]));
    const agencies = brain.agencies.list();
    const amap = Object.fromEntries(agencies.map((a) => [a.id, a]));
    const progs = Object.fromEntries(sql('SELECT id, agency_id, hamlet_id, track, module, title FROM programmes WHERE deleted=0').map((p) => [p.id, p]));
    let enr = sql('SELECT person_id, programme_id, agency_id, hamlet_id, status, start_date FROM enrolments WHERE deleted=0');
    if (aud.mode === 'agency' || (aud.mode === 'platform' && aud.agency_id)) enr = enr.filter((e) => e.agency_id === aud.agency_id);
    if (aud.mode === 'hamlet') enr = enr.filter((e) => aud.hamlets.includes(e.hamlet_id));
    if (hamlet_id) enr = enr.filter((e) => e.hamlet_id === hamlet_id);
    let ids = [...new Set(enr.map((e) => e.person_id))];
    // agency dashboards: only people who currently consent to that agency (profile scope)
    if (aud.mode === 'agency') {
      const ok = new Set(sql('SELECT person_id, scopes FROM consents WHERE deleted=0 AND status=\'active\' AND agency_id=?', aud.agency_id).filter((c) => Array.isArray(c.scopes) && c.scopes.includes('profile')).map((c) => c.person_id));
      ids = ids.filter((id) => ok.has(id));
      enr = enr.filter((e) => ok.has(e.person_id));
    }
    const idSet = new Set(ids);
    const persons = ids.length ? sql(`SELECT id, hamlet_id, gender, dob, kind, literacy_level, school_class FROM persons WHERE deleted=0 AND id IN (${inList(ids)})`, ...ids) : [];
    const pick = (q, ...p) => safe(() => sql(q, ...p).filter((r) => idSet.has(r.person_id)), null);
    return {
      hamlets, hmap, agencies, amap, progs, enr, persons, idSet,
      attendance: pick('SELECT person_id, agency_id, hamlet_id, date, status FROM learning_attendance WHERE deleted=0 AND date>=?', daysAgo(180).slice(0, 10)),
      attempts: pick('SELECT person_id, score, at FROM learning_attempts WHERE deleted=0 AND at>=?', daysAgo(180)),
      diagnostics: pick('SELECT person_id, results, at FROM learning_diagnostics WHERE deleted=0 ORDER BY at'),
      progress: pick('SELECT person_id, status, completed_at, last_at FROM learning_progress WHERE deleted=0'),
      literacy: pick('SELECT person_id, level FROM learning_literacy WHERE deleted=0'),
      mocks: pick('SELECT person_id, pct, submitted_at FROM exams_attempts WHERE deleted=0 AND status=\'submitted\' ORDER BY submitted_at'),
      examApps: pick('SELECT person_id, status FROM exams_applications WHERE deleted=0'),
      pulses: pick('SELECT person_id, mood, at FROM counselling_pulses WHERE deleted=0 AND at>=?', daysAgo(60)),
      lsProgress: pick('SELECT person_id, passed, last_at FROM lifeskills_progress WHERE deleted=0'),
      documents: pick('SELECT person_id, doc_key, status FROM lifeskills_documents WHERE deleted=0'),
      placements: pick('SELECT person_id, agency_id, status, wage_monthly, start_date FROM marketplace_placements WHERE deleted=0'),
      passport: pick('SELECT person_id, type, ref, issued_by_agency, issued_at FROM passport_entries WHERE deleted=0'),
      consents: pick('SELECT person_id, agency_id, scopes FROM consents WHERE deleted=0 AND status=\'active\''),
    };
  }

  // ---------------- per-person signals ----------------
  function diagPct(results) {
    if (!results || typeof results !== 'object') return null;
    let c = 0, t = 0;
    for (const v of Object.values(results)) { c += Number(v.correct) || 0; t += Number(v.total) || 0; }
    return t ? c / t : null;
  }
  function signals(D) {
    const S = {};
    const get = (id) => S[id] || (S[id] = { att: [], last: null, scores: [], diag: [], mocks: [], moods: [] });
    const touch = (s, at) => { if (at && (!s.last || at > s.last)) s.last = at; };
    for (const a of D.attendance || []) { const s = get(a.person_id); s.att.push(a); if (['present', 'late'].includes(a.status)) touch(s, a.date); }
    for (const a of D.attempts || []) { const s = get(a.person_id); s.scores.push({ v: Number(a.score), at: a.at }); touch(s, a.at); }
    for (const d of D.diagnostics || []) get(d.person_id).diag.push({ p: diagPct(d.results), at: d.at });
    for (const m of D.mocks || []) { const s = get(m.person_id); s.mocks.push({ v: Number(m.pct), at: m.submitted_at }); touch(s, m.submitted_at); }
    for (const p of D.lsProgress || []) touch(get(p.person_id), p.last_at);
    for (const p of D.progress || []) touch(get(p.person_id), p.last_at);
    for (const p of D.pulses || []) get(p.person_id).moods.push(Number(p.mood));
    return S;
  }

  // Transparent, rule-based dropout risk. Each rule adds points and a human-readable reason.
  // Wellbeing pulses are NOT used per person (counsellor-only data); they appear only as aggregates.
  const RULES = [
    { key: 'attendance_low', pts: 30, label: 'Attendance below 50% in the last 4 weeks', label_ml: 'കഴിഞ്ഞ 4 ആഴ്ച ഹാജർ 50%-ൽ താഴെ' },
    { key: 'attendance_mid', pts: 15, label: 'Attendance 50–74% in the last 4 weeks', label_ml: 'ഹാജർ 50–74%' },
    { key: 'attendance_falling', pts: 15, label: 'Attendance fell by 20+ points vs the previous 4 weeks', label_ml: 'ഹാജർ 20+ പോയിന്റ് കുറഞ്ഞു' },
    { key: 'inactive_45', pts: 30, label: 'No learning activity for 45+ days', label_ml: '45+ ദിവസമായി പ്രവർത്തനമില്ല' },
    { key: 'inactive_21', pts: 20, label: 'No learning activity for 21+ days', label_ml: '21+ ദിവസമായി പ്രവർത്തനമില്ല' },
    { key: 'scores_low', pts: 10, label: 'Recent practice scores below 50%', label_ml: 'സമീപകാല സ്കോർ 50%-ൽ താഴെ' },
    { key: 'mock_low', pts: 10, label: 'Latest mock test below 35%', label_ml: 'അവസാന മോക്ക് 35%-ൽ താഴെ' },
    { key: 'transition_year', pts: 5, label: 'In a transition year (Class 9–10 or Plus Two)', label_ml: 'പരിവർത്തന വർഷം (9–10 / പ്ലസ് ടു)' },
  ];
  function riskFor(person, s) {
    const factors = [];
    const add = (k) => factors.push(RULES.find((r) => r.key === k));
    s = s || { att: [], last: null, scores: [], mocks: [] };
    const d28 = daysAgo(28).slice(0, 10), d56 = daysAgo(56).slice(0, 10);
    const rate = (rows) => (rows.length ? rows.filter((a) => ['present', 'late', 'excused'].includes(a.status)).length / rows.length : null);
    const recent = s.att.filter((a) => a.date >= d28), prev = s.att.filter((a) => a.date >= d56 && a.date < d28);
    const rr = rate(recent), rp = rate(prev);
    if (rr !== null && recent.length >= 2) { if (rr < 0.5) add('attendance_low'); else if (rr < 0.75) add('attendance_mid'); }
    if (rr !== null && rp !== null && prev.length >= 2 && rp - rr >= 0.2) add('attendance_falling');
    const idle = s.last ? (Date.now() - new Date(s.last)) / 86400e3 : null;
    if (idle !== null) { if (idle >= 45) add('inactive_45'); else if (idle >= 21) add('inactive_21'); }
    const sc = s.scores.filter((x) => x.at >= daysAgo(30)).map((x) => x.v).filter((v) => !Number.isNaN(v));
    if (sc.length >= 2 && avg(sc) < 0.5) add('scores_low');
    if (s.mocks.length && s.mocks[s.mocks.length - 1].v < 35) add('mock_low');
    if (['9', '10', 'Plus Two'].includes(String(person.school_class))) add('transition_year');
    const score = Math.min(100, factors.reduce((t, f) => t + f.pts, 0));
    return { score, level: score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low', factors, attendance_4w: rr === null ? null : Math.round(rr * 100), idle_days: idle === null ? null : Math.round(idle), last_activity: s.last };
  }

  // ---------------- metrics ----------------
  function metrics(D, aud, user) {
    const sup = supFor(aud, user);
    const S = signals(D);
    const active = D.enr.filter((e) => e.status === 'active');
    const reachedIds = new Set(active.map((e) => e.person_id));
    const P = D.persons.filter((p) => reachedIds.has(p.id));
    const groupCount = (keyFn, list = P) => { const m = {}; for (const p of list) { const k = keyFn(p); m[k] = (m[k] || 0) + 1; } return m; };
    const toBars = (m, labelFn = (k) => k) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: labelFn(k), value: sup(v) }));

    const byHamlet = groupCount((p) => p.hamlet_id);
    const byAgency = {};
    for (const aId of new Set(active.map((e) => e.agency_id))) byAgency[aId] = new Set(active.filter((e) => e.agency_id === aId).map((e) => e.person_id)).size;
    const byTrack = {};
    for (const t of TRACKS) { const n = new Set(active.filter((e) => D.progs[e.programme_id]?.track === t).map((e) => e.person_id)).size; if (n) byTrack[t] = n; }

    // attendance
    let attendance = null;
    if (D.attendance) {
      const rows = D.attendance;
      const ok = rows.filter((a) => ['present', 'late'].includes(a.status)).length;
      const months = {};
      for (const a of rows) { const m = a.date.slice(0, 7); const x = months[m] || (months[m] = { n: 0, ok: 0 }); x.n++; if (['present', 'late'].includes(a.status)) x.ok++; }
      const byH = {};
      for (const a of rows) { const x = byH[a.hamlet_id] || (byH[a.hamlet_id] = { n: 0, ok: 0, people: new Set() }); x.n++; x.people.add(a.person_id); if (['present', 'late'].includes(a.status)) x.ok++; }
      const learners = new Set(rows.map((a) => a.person_id)).size;
      attendance = {
        rate: learners >= K || !aud.ext ? pct(ok, rows.length) : null, sessions_marked: rows.length, learners: sup(learners),
        trend: Object.entries(months).sort().map(([m, x]) => ({ month: m, rate: pct(x.ok, x.n) })),
        byHamlet: Object.entries(byH).map(([h, x]) => ({ label: D.hmap[h]?.name, value: aud.ext && x.people.size < K ? null : pct(x.ok, x.n) })).sort((a, b) => (b.value || 0) - (a.value || 0)),
      };
    }
    // learning gains: first vs latest diagnostic
    let gains = null;
    if (D.diagnostics) {
      const pairs = [];
      for (const [pid, s] of Object.entries(S)) { const d = s.diag.filter((x) => x.p !== null); if (d.length >= 2) pairs.push({ pid, first: d[0].p, last: d[d.length - 1].p }); }
      const mastered = D.progress ? D.progress.filter((p) => ['mastered', 'completed'].includes(p.status)).length : null;
      const improved = pairs.filter((x) => x.last > x.first).length;
      gains = { learners_retested: sup(pairs.length), baseline: pairs.length >= K || !aud.ext ? r1(avg(pairs.map((x) => x.first * 100))) : null, latest: pairs.length >= K || !aud.ext ? r1(avg(pairs.map((x) => x.last * 100))) : null, improved_pct: pairs.length >= K || !aud.ext ? pct(improved, pairs.length) : null, lessons_mastered: mastered, diagnosed: sup(new Set((D.diagnostics || []).map((d) => d.person_id)).size) };
    }
    // mock exam improvement
    let exams = null;
    if (D.mocks) {
      const pairs = Object.values(S).filter((s) => s.mocks.length >= 2).map((s) => ({ first: s.mocks[0].v, last: s.mocks[s.mocks.length - 1].v }));
      const takers = new Set(D.mocks.map((m) => m.person_id)).size;
      exams = { mock_takers: sup(takers), mocks: D.mocks.length, first_avg: pairs.length >= K || !aud.ext ? r1(avg(pairs.map((x) => x.first))) : null, latest_avg: pairs.length >= K || !aud.ext ? r1(avg(pairs.map((x) => x.last))) : null, improved_pct: pairs.length >= K || !aud.ext ? pct(pairs.filter((x) => x.last > x.first).length, pairs.length) : null, applications: D.examApps ? sup(D.examApps.filter((a) => a.status && a.status !== 'planned').length) : null };
    }
    // credentials
    const pp = (D.passport || []).filter((e) => aud.mode !== 'agency' || e.issued_by_agency === aud.agency_id);
    const ppMonths = {};
    for (const e of pp) { const m = String(e.issued_at).slice(0, 7); ppMonths[m] = (ppMonths[m] || 0) + 1; }
    const credentials = { total: sup(pp.length), holders: sup(new Set(pp.map((e) => e.person_id)).size), byType: toBars(groupCount((e) => e.type, pp)), byDomain: toBars(groupCount((e) => String(e.ref || 'other').split('.')[0], pp)), trend: Object.entries(ppMonths).sort().slice(-6).map(([m, v]) => ({ month: m, value: sup(v) })) };
    // placements
    let placements = null;
    if (D.placements) {
      const pl = D.placements.filter((p) => aud.mode !== 'agency' || p.agency_id === aud.agency_id);
      const wages = pl.map((p) => Number(p.wage_monthly)).filter(Boolean);
      placements = { placed: sup(pl.length), active: sup(pl.filter((p) => p.status === 'active').length), avg_wage: pl.length >= K || !aud.ext ? Math.round(avg(wages) || 0) || null : null };
    }
    // wellbeing — aggregate only
    let wellbeing = null;
    if (D.pulses) {
      const people = new Set(D.pulses.map((p) => p.person_id));
      const low = new Set(D.pulses.filter((p) => p.mood <= 2).map((p) => p.person_id));
      wellbeing = { checkins: sup(D.pulses.length), learners: sup(people.size), avg_mood: people.size >= K ? r1(avg(D.pulses.map((p) => p.mood))) : null, low_mood_share: people.size >= K ? pct(low.size, people.size) : null };
    }
    // dropout risk distribution
    const dropped = new Set(D.enr.filter((e) => e.status === 'dropped').map((e) => e.person_id));
    const risk = { high: 0, medium: 0, low: 0 };
    const factorCount = {};
    for (const p of P) { const r = riskFor(p, S[p.id]); risk[r.level]++; for (const f of r.factors) factorCount[f.key] = (factorCount[f.key] || 0) + 1; }
    const retention = pct(P.length, new Set([...reachedIds, ...dropped]).size);

    return {
      reached: sup(P.length), enrolments: sup(active.length), dropped: sup([...dropped].filter((id) => !reachedIds.has(id)).length), retention_pct: retention,
      hamlets_served: new Set(P.map((p) => p.hamlet_id)).size, agencies_active: Object.keys(byAgency).length,
      byHamlet: toBars(byHamlet, (k) => D.hmap[k]?.name || '—'),
      byAgency: toBars(byAgency, (k) => D.amap[k]?.name || '—'),
      byTrack: toBars(byTrack),
      byGender: toBars(groupCount((p) => (p.gender === 'F' ? 'Female' : p.gender === 'M' ? 'Male' : 'Other'))),
      byAge: AGE_BANDS.map(([, , l]) => ({ key: l, label: l, value: sup(P.filter((p) => bandOf(ageOf(p.dob)) === l).length) })),
      byKind: toBars(groupCount((p) => p.kind)),
      attendance, gains, exams, credentials, placements, wellbeing,
      risk: { high: sup(risk.high), medium: sup(risk.medium), low: sup(risk.low), factors: RULES.map((r) => ({ key: r.key, label: r.label, label_ml: r.label_ml, points: r.pts, value: sup(factorCount[r.key] || 0) })) },
      modules: { learning: !!D.attendance, exams: !!D.mocks, counselling: !!D.pulses, lifeskills: !!D.lsProgress, marketplace: !!D.placements },
      _raw: { P, S, D },
    };
  }

  // ---------------- impact framework ----------------
  function framework(M, aud, user) {
    const sup = supFor(aud, user);
    const { P, D } = M._raw;
    const n = (x) => (typeof x === 'number' ? x : null);
    const childrenTuition = new Set(D.enr.filter((e) => e.status === 'active' && D.progs[e.programme_id]?.track === 'tuition').map((e) => e.person_id));
    const atGrade = D.diagnostics ? (() => { const last = {}; for (const d of D.diagnostics) last[d.person_id] = d.results; const ids = Object.keys(last).filter((id) => childrenTuition.has(id)); const ok = ids.filter((id) => Object.values(last[id] || {}).every((v) => !Number(v.gap))).length; return { ok, n: ids.length }; })() : null;
    const youth = P.filter((p) => p.kind === 'youth');
    const youthIds = new Set(youth.map((p) => p.id));
    const digital = (D.passport || []).filter((e) => String(e.ref || '').startsWith('DIG') && youthIds.has(e.person_id));
    const digitalHolders = new Set(digital.map((e) => e.person_id)).size;
    const girls = P.filter((p) => p.gender === 'F').length;
    const remote = P.filter((p) => ['none'].includes(D.hmap[p.hamlet_id]?.connectivity) || D.hmap[p.hamlet_id]?.power === 'none').length;
    const adults = new Set(D.enr.filter((e) => e.status === 'active' && D.progs[e.programme_id]?.track === 'literacy').map((e) => e.person_id));
    const litOk = D.literacy ? new Set(D.literacy.filter((l) => Number(l.level) >= 3 && adults.has(l.person_id)).map((l) => l.person_id)).size : null;
    const youthSkilling = new Set(D.enr.filter((e) => e.status === 'active' && youthIds.has(e.person_id) && ['exams', 'lifeskills', 'digital', 'language'].includes(D.progs[e.programme_id]?.track)).map((e) => e.person_id)).size;
    const docs = D.documents ? (() => { const by = {}; for (const d of D.documents) { const x = by[d.person_id] || (by[d.person_id] = { have: 0, n: 0 }); if (d.status !== 'not_needed') { x.n++; if (d.status === 'have') x.have++; } } const v = Object.values(by); return { ready: v.filter((x) => x.n && x.have === x.n).length, n: v.length }; })() : null;
    const ind = (code, goal, title, title_ml, value, unit, note, source) => ({ code, goal, title, title_ml, value, unit, note, source });
    const guardPct = (num, den) => (aud.ext && den < K ? null : pct(num, den));
    return {
      goals: [
        { goal: 'SDG 4.1', title: 'Free, equitable and quality primary and secondary education', colour: '#c5192d' },
        { goal: 'SDG 4.4', title: 'Youth with relevant (incl. digital) skills', colour: '#c5192d' },
        { goal: 'SDG 4.5', title: 'Equal access for the vulnerable, incl. indigenous peoples', colour: '#c5192d' },
        { goal: 'SDG 4.6', title: 'Youth and adult literacy and numeracy', colour: '#c5192d' },
        { goal: 'SDG 8.6', title: 'Reduce youth not in employment, education or training', colour: '#a21942' },
        { goal: 'SDG 10.2', title: 'Social and economic inclusion of all', colour: '#dd1367' },
        { goal: 'Kerala ST Dept', title: 'Scheduled Tribes Development Department indicators', colour: '#1d4e89' },
      ],
      indicators: [
        ind('4.1.a', 'SDG 4.1', 'Children in tuition at grade level (latest diagnostic)', 'ക്ലാസ് നിലവാരത്തിലുള്ള കുട്ടികൾ', atGrade ? guardPct(atGrade.ok, atGrade.n) : null, '%', atGrade ? `${sup(atGrade.ok)} of ${sup(atGrade.n)} diagnosed` : 'learning module not installed', 'learning'),
        ind('4.1.b', 'SDG 4.1', 'Attendance rate (last 6 months)', 'ഹാജർ നിരക്ക്', M.attendance ? M.attendance.rate : null, '%', 'present or late / sessions marked', 'learning'),
        ind('4.1.c', 'SDG 4.1', 'Learners showing improvement between diagnostics', 'പുരോഗതി കാണിച്ചവർ', M.gains ? M.gains.improved_pct : null, '%', M.gains ? `baseline ${M.gains.baseline ?? '—'}% → latest ${M.gains.latest ?? '—'}%` : '', 'learning'),
        ind('4.4.a', 'SDG 4.4', 'Youth holding a digital-skills credential', 'ഡിജിറ്റൽ സർട്ടിഫിക്കറ്റുള്ള യുവാക്കൾ', guardPct(digitalHolders, youth.length), '%', `${sup(digitalHolders)} of ${sup(youth.length)} youth`, 'passport'),
        ind('4.4.b', 'SDG 4.4', 'Mock-test takers who improved', 'മോക്ക് ടെസ്റ്റിൽ മെച്ചപ്പെട്ടവർ', M.exams ? M.exams.improved_pct : null, '%', M.exams ? `first ${M.exams.first_avg ?? '—'}% → latest ${M.exams.latest_avg ?? '—'}%` : 'exams module not installed', 'exams'),
        ind('4.5.a', 'SDG 4.5', 'Girls and women among learners', 'പെൺകുട്ടികൾ / സ്ത്രീകൾ', guardPct(girls, P.length), '%', `${sup(girls)} learners`, 'core'),
        ind('4.5.b', 'SDG 4.5', 'Learners in hamlets with no network or no grid power', 'നെറ്റ്‌വർക്ക്/വൈദ്യുതി ഇല്ലാത്ത ഊരുകളിൽ', sup(remote), 'learners', 'served offline via hub / courier sync', 'core'),
        ind('4.6.a', 'SDG 4.6', 'Adult literacy learners at functional level (3+)', 'സാക്ഷരതാ നിലവാരം 3+', litOk === null ? null : guardPct(litOk, adults.size), '%', litOk === null ? 'learning module not installed' : `${sup(litOk)} of ${sup(adults.size)} adult learners`, 'learning'),
        ind('8.6.a', 'SDG 8.6', 'Youth in skilling, exam prep or employment pathways', 'നൈപുണ്യ/ജോലി പാതയിലുള്ള യുവാക്കൾ', sup(youthSkilling), 'youth', 'active in exams, life skills, digital or language tracks', 'core'),
        ind('8.6.b', 'SDG 8.6', 'Youth placed in jobs (decent-work checks)', 'ജോലി ലഭിച്ച യുവാക്കൾ', M.placements ? M.placements.placed : null, 'youth', M.placements && M.placements.avg_wage ? `avg wage ₹${M.placements.avg_wage}/month` : 'marketplace module', 'marketplace'),
        ind('10.2.a', 'SDG 10.2', 'Learning credentials issued (portable passport)', 'പഠന സർട്ടിഫിക്കറ്റുകൾ', M.credentials.total, 'credentials', `${M.credentials.holders} holders`, 'passport'),
        ind('10.2.b', 'SDG 10.2', 'Agencies coordinating in shared hamlets', 'ഒന്നിച്ചു പ്രവർത്തിക്കുന്ന ഏജൻസികൾ', M.agencies_active, 'agencies', `${M.hamlets_served} hamlets`, 'core'),
        ind('ST.1', 'Kerala ST Dept', 'Retention (enrolled learners not dropped out)', 'പഠനം തുടരുന്നവർ', M.retention_pct, '%', `${M.dropped} dropped out`, 'core'),
        ind('ST.2', 'Kerala ST Dept', 'Youth with all key documents ready (Aadhaar, community, income certificates, bank)', 'രേഖകൾ തയ്യാറായ യുവാക്കൾ', docs ? guardPct(docs.ready, docs.n) : null, '%', docs ? `${sup(docs.ready)} of ${sup(docs.n)}` : 'lifeskills module not installed', 'lifeskills'),
        ind('ST.3', 'Kerala ST Dept', 'PSC / competitive exam applications assisted', 'PSC അപേക്ഷകൾ', M.exams ? M.exams.applications : null, 'applications', '', 'exams'),
        ind('ST.4', 'Kerala ST Dept', 'Learners at high dropout risk (early warning)', 'ഉയർന്ന കൊഴിഞ്ഞുപോക്ക് സാധ്യത', M.risk.high, 'learners', 'rule-based, reviewed by facilitators weekly', 'analytics'),
      ],
    };
  }

  const strip = (M) => { const { _raw, ...rest } = M; return rest; };

  // ---------------- routes ----------------
  router.get('/dashboard', AGG, (req, res) => {
    const u = req.user;
    const aud = audience(u, req.query);
    if (req.query.hamlet_id && aud.mode === 'hamlet' && !aud.hamlets.includes(req.query.hamlet_id)) throw httpError(403, 'Not your hamlet');
    const D = load(aud, { hamlet_id: req.query.hamlet_id || null });
    const M = metrics(D, aud, u);
    const out = strip(M);
    // external audiences: never person ids or names; hamlet names only (no ids)
    for (const k of ['byHamlet', 'byAgency']) out[k] = out[k].map(({ key, ...r }) => (aud.ext ? r : { key, ...r }));
    res.json({ audience: { mode: aud.mode, label: aud.label, k: K, agency: aud.agency_id ? D.amap[aud.agency_id]?.name : null, hamlets: aud.hamlets ? aud.hamlets.map((h) => D.hmap[h]?.name) : null }, generated_at: now(), metrics: out, framework: framework(M, aud, u) });
  });

  router.get('/report', AGG, (req, res) => {
    const u = req.user;
    const aud = audience(u, req.query);
    const D = load(aud);
    const M = metrics(D, aud, u);
    const F = framework(M, aud, u);
    const sup = supFor(aud, u);
    const hamletRows = D.hamlets.filter((h) => aud.mode !== 'hamlet' || aud.hamlets.includes(h.id)).map((h) => {
      const ppl = M._raw.P.filter((p) => p.hamlet_id === h.id);
      const att = (D.attendance || []).filter((a) => a.hamlet_id === h.id);
      const learners = new Set(att.map((a) => a.person_id)).size;
      return { name: h.name, name_ml: h.name_ml, district: h.district, community: h.community, connectivity: h.connectivity, power: h.power, reached: sup(ppl.length), attendance: aud.ext && learners < K ? null : pct(att.filter((a) => ['present', 'late'].includes(a.status)).length, att.length), agencies: new Set(D.enr.filter((e) => e.hamlet_id === h.id).map((e) => e.agency_id)).size };
    }).filter((r) => r.reached !== 0);
    const stories = [
      { title: 'Courier sync keeps Neelakkunnu learning', body: 'With no network and no grid power, the hub at Neelakkunnu syncs by USB courier every week. Learners never lose progress.' },
      { title: 'One timetable, many agencies', body: 'Agencies serving the same hamlet now see one combined timetable and resolve clashes together in the Oorukoottam.' },
      { title: 'Voice for every family', body: 'Guardians without smartphones receive weekly digests by SMS and voice calls in Malayalam, and can call back to reach their facilitator.' },
    ];
    if (u.role === 'platform_admin') data.put('analytics_snapshots', { scope: aud.mode, period: now().slice(0, 7), metrics: { reached: M.reached, attendance: M.attendance?.rate ?? null, credentials: M.credentials.total, risk_high: M.risk.high }, created_by: u.id, at: now() }, u);
    res.json({ audience: { mode: aud.mode, label: aud.label, k: K }, generated_at: now(), period: { from: daysAgo(180).slice(0, 10), to: now().slice(0, 10) }, metrics: strip(M), framework: F, hamlets: hamletRows, stories, method: ['Counts below ' + K + ' are shown as "<' + K + '" for external readers (k-anonymity).', 'Learning outcome rates are computed only where at least ' + K + ' learners contribute.', 'Dropout risk is a transparent rule-based score; no automated decision is taken on any learner.', 'All data is fictional DEMO data.'] });
  });

  // dropout alerts — only persons this staff member may see (progress scope)
  router.get('/risk', requires('learner.read'), (req, res) => {
    const u = req.user;
    if (!RISK_STAFF.includes(u.role)) throw httpError(403, 'Not available for your role');
    const vis = brain.persons.visibleIds(u);
    let ids = vis === null ? null : vis.filter((id) => brain.policy.canSee(u, id, 'progress').ok);
    const enrAll = sql('SELECT person_id, programme_id, agency_id, hamlet_id, status FROM enrolments WHERE deleted=0 AND status=\'active\'');
    let enr = enrAll;
    if (ids !== null) { const s = new Set(ids); enr = enr.filter((e) => s.has(e.person_id) && e.agency_id === u.agency_id); }
    if (req.query.hamlet_id) enr = enr.filter((e) => e.hamlet_id === req.query.hamlet_id);
    ids = [...new Set(enr.map((e) => e.person_id))];
    const idSet = new Set(ids);
    const D = { attendance: safe(() => sql('SELECT person_id, date, status FROM learning_attendance WHERE deleted=0 AND date>=?', daysAgo(90).slice(0, 10)).filter((r) => idSet.has(r.person_id)), []), attempts: safe(() => sql('SELECT person_id, score, at FROM learning_attempts WHERE deleted=0 AND at>=?', daysAgo(90)).filter((r) => idSet.has(r.person_id)), []), mocks: safe(() => sql('SELECT person_id, pct, submitted_at FROM exams_attempts WHERE deleted=0 AND status=\'submitted\' ORDER BY submitted_at').filter((r) => idSet.has(r.person_id)), []), lsProgress: safe(() => sql('SELECT person_id, last_at FROM lifeskills_progress WHERE deleted=0').filter((r) => idSet.has(r.person_id)), []), progress: safe(() => sql('SELECT person_id, last_at FROM learning_progress WHERE deleted=0').filter((r) => idSet.has(r.person_id)), []), diagnostics: [], pulses: [] };
    const S = signals(D);
    const persons = ids.length ? sql(`SELECT id, name, hamlet_id, kind, school_class, dob, gender FROM persons WHERE deleted=0 AND id IN (${inList(ids)})`, ...ids) : [];
    const hm = Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
    const progs = Object.fromEntries(brain.programmes.list().map((p) => [p.id, p]));
    const actions = Object.fromEntries(sql('SELECT * FROM analytics_alert_actions WHERE deleted=0 ORDER BY at').filter((a) => idSet.has(a.person_id)).map((a) => [a.person_id, a]));
    let rows = persons.map((p) => ({ id: p.id, name: p.name, kind: p.kind, age: ageOf(p.dob), school_class: p.school_class, hamlet: hm[p.hamlet_id]?.name, hamlet_ml: hm[p.hamlet_id]?.name_ml, hamlet_id: p.hamlet_id, programmes: enr.filter((e) => e.person_id === p.id).map((e) => progs[e.programme_id]?.title).filter(Boolean), last_action: actions[p.id] || null, ...riskFor(p, S[p.id]) }));
    const counts = { high: rows.filter((r) => r.level === 'high').length, medium: rows.filter((r) => r.level === 'medium').length, low: rows.filter((r) => r.level === 'low').length, total: rows.length };
    const level = req.query.level || 'alerts';
    rows = level === 'all' ? rows : level === 'alerts' ? rows.filter((r) => r.level !== 'low') : rows.filter((r) => r.level === level);
    rows.sort((a, b) => b.score - a.score);
    res.json({ counts, rules: RULES, rows: rows.slice(0, 300), note: 'A transparent early-warning score to prompt a caring conversation — never a label, never a reason to exclude.' });
  });

  router.post('/risk/:pid/action', requires('learner.read'), (req, res) => {
    const u = req.user;
    if (!RISK_STAFF.includes(u.role)) throw httpError(403, 'Not available for your role');
    if (!brain.policy.canSee(u, req.params.pid, 'progress').ok) throw httpError(403, 'No progress consent for this learner');
    const p = brain.persons.raw(req.params.pid);
    const action = ['called', 'home_visit', 'referred_counsellor', 'met_guardian', 'resolved'].includes(req.body.action) ? req.body.action : 'called';
    res.json(data.put('analytics_alert_actions', { person_id: p.id, hamlet_id: p.hamlet_id, agency_id: u.agency_id, action, note: String(req.body.note || '').slice(0, 500), by_name: u.display_name, at: now() }, u));
  });

  // ---------------- research export ----------------
  const SALT = process.env.AADI_RESEARCH_SALT || crypto.createHash('sha256').update('aadi-research:' + brain.nodeId).digest('hex');
  const pseudo = (id) => 'R' + crypto.createHmac('sha256', SALT).update(id).digest('hex').slice(0, 12).toUpperCase();
  function researchRows(u) {
    let consents = sql('SELECT person_id, agency_id, scopes, expires_at FROM consents WHERE deleted=0 AND status=\'active\'').filter((c) => Array.isArray(c.scopes) && c.scopes.includes('research') && (!c.expires_at || c.expires_at > now()));
    if (u.role !== 'platform_admin') {
      consents = consents.filter((c) => c.agency_id === u.agency_id);
      const vis = new Set(brain.persons.visibleIds(u) || []);
      consents = consents.filter((c) => vis.has(c.person_id));
    }
    const ids = [...new Set(consents.map((c) => c.person_id))];
    if (!ids.length) return [];
    const aud = u.role === 'platform_admin' ? { mode: 'platform', ext: false } : { mode: 'agency', ext: false, agency_id: u.agency_id };
    const D = load(aud);
    const S = signals(D);
    const idSet = new Set(ids);
    const progs = D.progs;
    const rows = D.persons.filter((p) => idSet.has(p.id)).map((p) => {
      const s = S[p.id] || { att: [], diag: [], mocks: [] };
      const att = s.att.length ? Math.round((s.att.filter((a) => ['present', 'late'].includes(a.status)).length / s.att.length) * 100) : '';
      const dg = s.diag.filter((x) => x.p !== null);
      const tracks = [...new Set(D.enr.filter((e) => e.person_id === p.id && e.status === 'active').map((e) => progs[e.programme_id]?.track).filter(Boolean))].sort().join(';');
      return { pid: pseudo(p.id), age_band: bandOf(ageOf(p.dob)), district: D.hmap[p.hamlet_id]?.district || '', tracks, attendance_pct: att, diag_first_pct: dg.length ? Math.round(dg[0].p * 100) : '', diag_latest_pct: dg.length ? Math.round(dg[dg.length - 1].p * 100) : '', mocks: s.mocks.length, mock_first_pct: s.mocks.length ? Math.round(s.mocks[0].v) : '', mock_latest_pct: s.mocks.length ? Math.round(s.mocks[s.mocks.length - 1].v) : '', credentials: (D.passport || []).filter((e) => e.person_id === p.id).length, risk_level: riskFor(p, S[p.id]).level };
    });
    // k-anonymity on quasi-identifiers (age band × district): generalise small classes
    const cls = {};
    for (const r of rows) cls[r.age_band + '|' + r.district] = (cls[r.age_band + '|' + r.district] || 0) + 1;
    for (const r of rows) if (cls[r.age_band + '|' + r.district] < K) r.district = 'Other (k<5)';
    return rows.sort((a, b) => a.pid.localeCompare(b.pid));
  }
  const toCsv = (rows) => {
    if (!rows.length) return 'pid,age_band,district,tracks,attendance_pct,diag_first_pct,diag_latest_pct,mocks,mock_first_pct,mock_latest_pct,credentials,risk_level\n';
    const cols = Object.keys(rows[0]);
    const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return cols.join(',') + '\n' + rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n') + '\n';
  };
  router.get('/research/preview', requires('platform.manage', 'agency.manage'), (req, res) => {
    const rows = researchRows(req.user);
    res.json({ count: rows.length, columns: rows[0] ? Object.keys(rows[0]) : [], sample: rows.slice(0, 8), rules: ['Only learners who gave "research" consent (to your agency, or any agency for the platform steward).', 'Pseudonymous IDs (keyed hash) — not reversible without the platform key.', 'Only age band and district; no names, hamlets, phone numbers or dates of birth.', 'Age band × district classes smaller than 5 are generalised to "Other".'] });
  });
  router.get('/research.csv', requires('platform.manage', 'agency.manage'), (req, res) => {
    const rows = researchRows(req.user);
    brain.audit(req.user, 'research_export', null, { rows: rows.length });
    emit('analytics.research_export', { rows: rows.length, by_role: req.user.role }, req.user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="aadi-research-${now().slice(0, 10)}.csv"`);
    res.send(toCsv(rows));
  });

  return {
    seed: async () => { /* analytics derives everything from other modules — nothing to seed */ },
    health: () => ({ snapshots: sqlOne('SELECT COUNT(*) n FROM analytics_snapshots WHERE deleted=0').n }),
    _test: { riskFor, RULES },
  };
};
