'use strict';
// AADI — Family & Community module.
// Guardian home + consent centre, hamlet notice board, cultural archive (community data
// sovereignty), Oorukoottam meetings, cross-agency hamlet coordination threads.
const path = require('path');
const fs = require('fs');

const STEWARDS = ['platform_admin', 'cpo'];
const STAFF = ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'];
const POSTERS = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'];
const REVIEWERS = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'teacher'];
const KINDS = ['story', 'song', 'knowledge', 'recipe', 'craft', 'medicine_plant'];
const LICENCES = ['community', 'cc_by_nc', 'public'];
const NOTICE_CATS = ['scholarship', 'hostel', 'livelihood', 'documents', 'health', 'rights', 'event', 'general'];
const TRACKS = ['tuition', 'exams', 'language', 'lifeskills', 'counselling', 'literacy', 'digital'];

module.exports = function init(ctx) {
  const { requires, authed, data, sql, sqlOne, tx, emit, brain, httpError } = ctx;

  // Expected 4xx (httpError) are answered here so they do not count toward the core circuit breaker;
  // only genuine faults propagate to ctx's wrapper. (Brain request: breaker should ignore e.status < 500.)
  const router = {};
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    router[m] = (p, ...hs) => ctx.router[m](p, ...hs.slice(0, -1), async (req, res, next) => {
      try { await hs[hs.length - 1](req, res, next); } catch (e) {
        if (e && e.status && e.status < 500) { if (!res.headersSent) res.status(e.status).json({ error: e.code || 'error', message: e.message }); return; }
        throw e;
      }
    });
  }
  const now = () => new Date().toISOString();
  const S = (v, max = 4000) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());

  // ---------- hamlet relationships ----------
  const allHamletIds = () => brain.hamlets.list().map((h) => h.id);
  function memberHamlets(user) {
    if (!user.person_id) return [];
    const me = brain.persons.raw(user.person_id);
    const set = new Set(me ? [me.hamlet_id] : []);
    if (user.role === 'guardian') for (const r of sql('SELECT hamlet_id FROM persons WHERE guardian_id=? AND deleted=0', user.person_id)) set.add(r.hamlet_id);
    return [...set];
  }
  function servedHamlets(user) {
    if (STEWARDS.includes(user.role)) return allHamletIds();
    if (!STAFF.includes(user.role) || !user.agency_id) return [];
    let ids = sql('SELECT DISTINCT hamlet_id FROM agency_presence WHERE agency_id=? AND deleted=0 AND status=\'active\'', user.agency_id).map((r) => r.hamlet_id);
    if (Array.isArray(user.hamlet_ids) && user.hamlet_ids.length) ids = ids.filter((h) => user.hamlet_ids.includes(h));
    return ids;
  }
  const relHamlets = (user) => [...new Set([...memberHamlets(user), ...servedHamlets(user)])];
  const agencyServes = (agencyId, hamletId) => !!sqlOne('SELECT 1 x FROM agency_presence WHERE agency_id=? AND hamlet_id=? AND deleted=0 AND status=\'active\'', agencyId, hamletId);
  const canPostIn = (user, hamletId) => POSTERS.includes(user.role) && servedHamlets(user).includes(hamletId);
  const hamletName = (() => { let m = null; return (id) => { if (!m) m = Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h])); return m[id] || null; }; })();
  const agencyMap = () => Object.fromEntries(brain.agencies.list().map((a) => [a.id, a]));

  router.get('/my-hamlets', authed, (req, res) => {
    const u = req.user;
    const ids = u.role === 'govt_viewer' ? allHamletIds() : relHamlets(u);
    const member = new Set(memberHamlets(u));
    res.json(brain.hamlets.list().filter((h) => ids.includes(h.id)).map((h) => ({ id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, community: h.community, member: member.has(h.id), can_post: canPostIn(u, h.id) })));
  });

  // =====================================================================
  // Guardian home & consent centre
  // =====================================================================
  function attendanceFor(pid) {
    for (const t of ['learning_attendance', 'operations_attendance', 'lifeskills_attendance', 'language_attendance']) {
      try {
        const rows = sql(`SELECT * FROM ${t} WHERE person_id=? AND deleted=0 ORDER BY updated_at DESC LIMIT 300`, pid);
        if (!rows.length) continue;
        const present = rows.filter((r) => r.status === 'present' || r.status === 'P' || r.present === 1 || r.present === true || r.status === 'late').length;
        return { pct: Math.round((present / rows.length) * 100), sessions: rows.length, present };
      } catch (_) { /* table not installed on this node — skip */ }
    }
    return null;
  }

  function familyCard(user, p, ag) {
    const progress = brain.policy.canSee(user, p.id, 'progress').ok;
    const enrol = sql(`SELECT e.status, e.start_date, e.agency_id, pr.title, pr.title_ml, pr.track, pr.schedule FROM enrolments e JOIN programmes pr ON pr.id=e.programme_id
      WHERE e.person_id=? AND e.deleted=0 ORDER BY e.start_date DESC`, p.id).map((e) => ({ ...e, agency_name: ag[e.agency_id]?.name, agency_colour: ag[e.agency_id]?.colour }));
    const consents = sql('SELECT id, agency_id, scopes, status, granted_at, method, relation, granted_by FROM consents WHERE person_id=? AND deleted=0 ORDER BY granted_at DESC', p.id)
      .map((c) => ({ ...c, agency_name: ag[c.agency_id]?.name, agency_colour: ag[c.agency_id]?.colour }));
    const presence = sql('SELECT agency_id, services FROM agency_presence WHERE hamlet_id=? AND deleted=0 AND status=\'active\'', p.hamlet_id);
    const agencies = presence.map((pr) => {
      const active = consents.find((c) => c.agency_id === pr.agency_id && c.status === 'active');
      return { id: pr.agency_id, name: ag[pr.agency_id]?.name, colour: ag[pr.agency_id]?.colour, type: ag[pr.agency_id]?.type, services: pr.services, enrolled: enrol.some((e) => e.agency_id === pr.agency_id && ['active', 'completed'].includes(e.status)), consent: active || null };
    });
    // include agencies the person consented to that are not present in the hamlet (e.g. employers)
    for (const c of consents.filter((x) => x.status === 'active')) if (!agencies.some((a) => a.id === c.agency_id)) agencies.push({ id: c.agency_id, name: ag[c.agency_id]?.name, colour: ag[c.agency_id]?.colour, type: ag[c.agency_id]?.type, services: [], enrolled: false, consent: c });
    const entries = progress ? brain.passport.entries(p.id).slice(0, 6).map((e) => ({ title: e.title, type: e.type, level: e.level, issued_at: e.issued_at, agency_name: ag[e.issued_by_agency]?.name })) : [];
    const h = hamletName(p.hamlet_id);
    return {
      id: p.id, name: p.name, first_name: String(p.name).split(' ')[0], gender: p.gender, kind: p.kind, age: p.age, minor: p.minor, school_class: p.school_class,
      relation: p.relation, self: p.id === user.person_id, hamlet: h && { id: h.id, name: h.name, name_ml: h.name_ml },
      enrolments: enrol, attendance: progress ? attendanceFor(p.id) : null, passport: entries,
      passport_total: progress ? sqlOne('SELECT COUNT(*) n FROM passport_entries WHERE person_id=? AND deleted=0', p.id).n : 0,
      consents, agencies,
      // a minor's consent is managed by the guardian; a minor learner sees it read-only
      can_manage_consent: (user.role === 'guardian' && (p.guardian_id === user.person_id || p.id === user.person_id)) || (p.id === user.person_id && !p.minor),
    };
  }

  router.get('/family', requires('family', 'learn'), (req, res) => {
    const u = req.user;
    const ag = agencyMap();
    const people = brain.persons.visible(u, { limit: 50 }); // guardian: self + wards; learner: self
    const cards = people.filter((p) => brain.policy.canSee(u, p.id, 'profile').ok).map((p) => familyCard(u, p, ag));
    cards.sort((a, b) => (a.self === b.self ? (b.age || 0) - (a.age || 0) : a.self ? 1 : -1));
    res.json({ me: u.person_id, role: u.role, members: cards, scopes: brain.policy.SCOPES });
  });

  router.get('/family/:pid', requires('family', 'learn'), (req, res) => {
    const v = brain.policy.canSee(req.user, req.params.pid, 'profile');
    if (!v.ok) throw httpError(403, 'Not your ward');
    const p = brain.persons.get(req.user, req.params.pid, 'profile');
    res.json(familyCard(req.user, p, agencyMap()));
  });

  // =====================================================================
  // Notice board
  // =====================================================================
  router.get('/notices', authed, (req, res) => {
    const u = req.user;
    const ids = u.role === 'govt_viewer' ? allHamletIds() : relHamlets(u);
    if (['donor', 'employer'].includes(u.role)) return res.json([]);
    const want = req.query.hamlet_id ? [req.query.hamlet_id].filter((h) => ids.includes(h)) : ids;
    if (!want.length) return res.json([]);
    let rows = sql(`SELECT * FROM community_notices WHERE deleted=0 AND hamlet_id IN (${want.map(() => '?').join(',')}) ORDER BY pinned DESC, posted_at DESC LIMIT 300`, ...want);
    if (req.query.category) rows = rows.filter((r) => r.category === req.query.category);
    const ag = agencyMap();
    res.json(rows.map((r) => ({ ...r, agency_name: ag[r.agency_id]?.name, agency_colour: ag[r.agency_id]?.colour, hamlet_name: hamletName(r.hamlet_id)?.name, hamlet_name_ml: hamletName(r.hamlet_id)?.name_ml, can_edit: canPostIn(u, r.hamlet_id) && (u.role === 'platform_admin' || r.agency_id === u.agency_id) })));
  });

  function saveNotice(u, b, existing) {
    const hamlet_id = existing ? existing.hamlet_id : S(b.hamlet_id, 64);
    if (!brain.hamlets.get(hamlet_id)) throw httpError(400, 'Choose a hamlet');
    if (!canPostIn(u, hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet, so it cannot post notices here.');
    if (existing && u.role !== 'platform_admin' && existing.agency_id !== u.agency_id) throw httpError(403, 'Only the posting agency can edit this notice.');
    const title = S(b.title, 200), body = S(b.body);
    if (!title || !body) throw httpError(400, 'Title and text are required');
    const category = NOTICE_CATS.includes(b.category) ? b.category : 'general';
    return data.put('community_notices', {
      ...(existing ? { id: existing.id } : {}), hamlet_id, agency_id: existing ? existing.agency_id : u.agency_id, category,
      title, title_ml: S(b.title_ml, 200), body, body_ml: S(b.body_ml), how_to: S(b.how_to), how_to_ml: S(b.how_to_ml),
      audio_en: S(b.audio_en) || `${title}. ${body}`, audio_ml: S(b.audio_ml) || (b.title_ml ? `${S(b.title_ml)}. ${S(b.body_ml)}` : ''),
      deadline: S(b.deadline, 10) || null, date_is_demo: b.date_is_demo === false ? 0 : 1, contact: S(b.contact, 200), pinned: b.pinned ? 1 : 0,
      posted_by: existing ? existing.posted_by : u.id, posted_by_name: existing ? existing.posted_by_name : u.display_name, posted_at: existing ? existing.posted_at : now(),
    }, u);
  }

  router.post('/notices', requires('ops', 'hamlet.coordinate', 'agency.manage'), (req, res) => {
    const targets = Array.isArray(req.body.hamlet_ids) && req.body.hamlet_ids.length ? req.body.hamlet_ids : [req.body.hamlet_id];
    const out = tx(() => targets.map((h) => saveNotice(req.user, { ...req.body, hamlet_id: h })));
    for (const n of out) emit('community.notice_posted', { notice_id: n.id, category: n.category, agency_id: n.agency_id }, req.user, n.hamlet_id);
    res.json(out.length === 1 ? out[0] : out);
  });
  router.put('/notices/:id', requires('ops', 'hamlet.coordinate', 'agency.manage'), (req, res) => {
    const n = data.get('community_notices', req.params.id);
    if (!n) throw httpError(404, 'Notice not found');
    res.json(saveNotice(req.user, { ...n, ...req.body }, n));
  });
  router.delete('/notices/:id', requires('ops', 'hamlet.coordinate', 'agency.manage'), (req, res) => {
    const n = data.get('community_notices', req.params.id);
    if (!n) throw httpError(404, 'Notice not found');
    if (!canPostIn(req.user, n.hamlet_id) || (req.user.role !== 'platform_admin' && n.agency_id !== req.user.agency_id)) throw httpError(403, 'Only the posting agency can remove this notice.');
    data.del('community_notices', n.id, req.user);
    res.json({ ok: true });
  });

  // =====================================================================
  // Cultural archive — community data sovereignty
  // =====================================================================
  const isReviewerFor = (u, hamletId) => REVIEWERS.includes(u.role) && servedHamlets(u).includes(hamletId);
  function canViewContent(u, c, rel) {
    if (STEWARDS.includes(u.role)) return true;
    if (c.submitted_by === u.id) return true;
    if (c.status === 'published') {
      if (c.licence !== 'community') return true;
      if (['donor', 'employer', 'govt_viewer'].includes(u.role)) return false;
      return rel.includes(c.hamlet_id); // members of the hamlet and staff serving it
    }
    return isReviewerFor(u, c.hamlet_id);
  }
  function shapeContent(u, c) {
    const h = hamletName(c.hamlet_id);
    const out = { ...c, hamlet_name: h?.name, hamlet_name_ml: h?.name_ml, community: h?.community, mine: c.submitted_by === u.id, can_review: isReviewerFor(u, c.hamlet_id) || u.role === 'platform_admin' };
    if (!(STEWARDS.includes(u.role) || c.submitted_by === u.id)) delete out.contributor_person_id;
    delete out.submitted_by;
    return out;
  }

  router.get('/content', authed, (req, res) => {
    const u = req.user;
    const rel = relHamlets(u);
    const w = ['deleted=0'];
    const p = [];
    for (const k of ['hamlet_id', 'kind', 'status', 'language', 'licence']) if (req.query[k]) { w.push(`${k}=?`); p.push(req.query[k]); }
    let rows = sql(`SELECT * FROM community_content WHERE ${w.join(' AND ')} ORDER BY COALESCE(published_at, submitted_at) DESC LIMIT 1000`, ...p);
    rows = rows.filter((c) => canViewContent(u, c, rel));
    if (req.query.q) { const q = String(req.query.q).toLowerCase(); rows = rows.filter((c) => [c.title, c.title_ml, c.body, c.credit_as, c.language].some((x) => String(x || '').toLowerCase().includes(q))); }
    if (req.query.queue) rows = rows.filter((c) => ['submitted', 'reviewed'].includes(c.status) && isReviewerFor(u, c.hamlet_id));
    res.json(rows.map((c) => shapeContent(u, c)));
  });

  router.get('/content/stats', authed, (req, res) => {
    const u = req.user;
    const rel = relHamlets(u);
    const rows = sql('SELECT * FROM community_content WHERE deleted=0').filter((c) => canViewContent(u, c, rel));
    const pub = rows.filter((c) => c.status === 'published');
    const by = (k) => Object.entries(pub.reduce((m, c) => ((m[c[k]] = (m[c[k]] || 0) + 1), m), {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const credits = Object.values(pub.reduce((m, c) => { const key = c.credit_as || c.contributor_name; m[key] = m[key] || { name: key, hamlet: hamletName(c.hamlet_id)?.name, items: 0, credits: 0 }; m[key].items++; m[key].credits += Number(c.credits || 0); return m; }, {})).sort((a, b) => b.credits - a.credits).slice(0, 12);
    res.json({ total: rows.length, published: pub.length, pending: rows.filter((c) => ['submitted', 'reviewed'].includes(c.status)).length, community_only: pub.filter((c) => c.licence === 'community').length, by_kind: by('kind'), by_language: by('language'), credits });
  });

  router.get('/content/:id', authed, (req, res) => {
    const c = data.get('community_content', req.params.id);
    if (!c || !canViewContent(req.user, c, relHamlets(req.user))) throw httpError(404, 'Not found or not shared with you');
    res.json(shapeContent(req.user, c));
  });

  router.post('/content', authed, (req, res) => {
    const u = req.user;
    if (['donor', 'employer', 'govt_viewer'].includes(u.role)) throw httpError(403, 'Only community members and the staff serving them can contribute.');
    const b = req.body;
    const hamlet_id = S(b.hamlet_id, 64) || memberHamlets(u)[0];
    if (!relHamlets(u).includes(hamlet_id)) throw httpError(403, 'You can contribute only to your own hamlet (or a hamlet your agency serves).');
    const title = S(b.title, 200), body = S(b.body, 20000);
    if (!title || !body) throw httpError(400, 'Title and text are required');
    if (!b.original_confirmed) throw httpError(400, 'Please confirm this is your own / your community\'s work (no copied songs or texts).');
    const kind = KINDS.includes(b.kind) ? b.kind : 'story';
    const licence = LICENCES.includes(b.licence) ? b.licence : 'community';
    const me = u.person_id ? brain.persons.raw(u.person_id) : null;
    const contributor_name = S(b.contributor_name, 120) || (me ? me.name : u.display_name);
    const row = data.put('community_content', {
      hamlet_id, kind, title, title_ml: S(b.title_ml, 200), body, body_ml: S(b.body_ml, 20000), language: S(b.language, 60) || hamletName(hamlet_id)?.community || 'Malayalam',
      contributor_name, contributor_kind: ['youth', 'elder', 'child', 'group'].includes(b.contributor_kind) ? b.contributor_kind : (me && me.kind === 'adult' ? 'elder' : 'youth'),
      contributor_person_id: u.person_id || null, credit_as: S(b.credit_as, 120) || contributor_name, licence,
      status: 'submitted', submitted_by: u.id, submitted_at: now(), tags: Array.isArray(b.tags) ? b.tags.slice(0, 8).map((t) => S(t, 30)) : [], credits: 0,
    }, u);
    emit('community.content_submitted', { content_id: row.id, kind, licence, language: row.language }, u, hamlet_id);
    res.json(shapeContent(u, row));
  });

  // Contributor edits a returned item and resubmits
  router.put('/content/:id', authed, (req, res) => {
    const c = data.get('community_content', req.params.id);
    if (!c) throw httpError(404, 'Not found');
    if (c.submitted_by !== req.user.id && req.user.role !== 'platform_admin') throw httpError(403, 'Only the contributor can edit');
    if (!['returned', 'submitted'].includes(c.status)) throw httpError(409, 'Already in review or published');
    const b = req.body;
    const row = data.put('community_content', {
      id: c.id, title: S(b.title ?? c.title, 200), title_ml: S(b.title_ml ?? c.title_ml, 200), body: S(b.body ?? c.body, 20000), body_ml: S(b.body_ml ?? c.body_ml, 20000),
      licence: LICENCES.includes(b.licence) ? b.licence : c.licence, credit_as: S(b.credit_as ?? c.credit_as, 120), status: 'submitted', submitted_at: now(),
    }, req.user);
    emit('community.content_submitted', { content_id: row.id, kind: row.kind, licence: row.licence, resubmitted: true }, req.user, row.hamlet_id);
    res.json(shapeContent(req.user, row));
  });

  // Licence can be changed (narrowed or widened) by the contributor at any time — they own it.
  router.post('/content/:id/licence', authed, (req, res) => {
    const c = data.get('community_content', req.params.id);
    if (!c) throw httpError(404, 'Not found');
    if (c.submitted_by !== req.user.id && !STEWARDS.includes(req.user.role)) throw httpError(403, 'Only the contributor can change the licence');
    if (!LICENCES.includes(req.body.licence)) throw httpError(400, 'Unknown licence');
    res.json(shapeContent(req.user, data.put('community_content', { id: c.id, licence: req.body.licence }, req.user)));
  });

  router.post('/content/:id/review', requires('ops', 'content.review', 'hamlet.coordinate'), (req, res) => {
    const u = req.user;
    const c = data.get('community_content', req.params.id);
    if (!c) throw httpError(404, 'Not found');
    if (!(u.role === 'platform_admin' || isReviewerFor(u, c.hamlet_id))) throw httpError(403, 'Only reviewers serving this hamlet can review');
    const d = req.body.decision;
    const flow = { review: ['submitted'], publish: ['submitted', 'reviewed'], return: ['submitted', 'reviewed'], unpublish: ['published'] };
    if (!flow[d]) throw httpError(400, 'decision must be review | publish | return | unpublish');
    if (!flow[d].includes(c.status)) throw httpError(409, `Cannot ${d} an item that is ${c.status}`);
    if (d === 'return' && !S(req.body.note)) throw httpError(400, 'Please tell the contributor what to change');
    const status = { review: 'reviewed', publish: 'published', return: 'returned', unpublish: 'returned' }[d];
    const credits = d === 'publish' ? ({ song: 15, story: 12, knowledge: 10, medicine_plant: 10, recipe: 8, craft: 10 }[c.kind] || 10) : c.credits;
    const row = data.put('community_content', { id: c.id, status, review_note: S(req.body.note, 1000) || c.review_note, reviewed_by: u.id, reviewed_by_name: u.display_name, reviewed_at: now(), published_at: d === 'publish' ? now() : c.published_at, credits }, u);
    if (d === 'publish') {
      emit('community.content_published', { content_id: c.id, kind: c.kind, licence: c.licence }, u, c.hamlet_id);
      if (c.contributor_person_id) { try { brain.notify(c.contributor_person_id, `Your ${c.kind} "${c.title}" is now published in the AADI cultural archive. Thank you! / നിങ്ങളുടെ സംഭാവന പ്രസിദ്ധീകരിച്ചു.`, { channel: 'auto' }, u); } catch (_) { /* outbox best-effort */ } }
    }
    res.json(shapeContent(u, row));
  });

  // =====================================================================
  // Oorukoottam — hamlet assembly meetings
  // =====================================================================
  function meetingOut(u, m) {
    const actions = sql('SELECT * FROM community_actions WHERE meeting_id=? AND deleted=0 ORDER BY due', m.id);
    return { ...m, hamlet_name: hamletName(m.hamlet_id)?.name, hamlet_name_ml: hamletName(m.hamlet_id)?.name_ml, actions, can_edit: canPostIn(u, m.hamlet_id) };
  }
  router.get('/meetings', authed, (req, res) => {
    const u = req.user;
    const ids = relHamlets(u);
    const want = req.query.hamlet_id ? [req.query.hamlet_id].filter((h) => ids.includes(h)) : ids;
    if (!want.length) return res.json([]);
    const rows = sql(`SELECT * FROM community_meetings WHERE deleted=0 AND hamlet_id IN (${want.map(() => '?').join(',')}) ORDER BY date DESC LIMIT 200`, ...want);
    res.json(rows.map((m) => meetingOut(u, m)));
  });
  router.post('/meetings', requires('ops', 'hamlet.coordinate'), (req, res) => {
    const u = req.user, b = req.body;
    if (!canPostIn(u, b.hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet');
    if (!S(b.title) || !S(b.date, 10)) throw httpError(400, 'Title and date are required');
    const agenda = (Array.isArray(b.agenda) ? b.agenda : S(b.agenda).split('\n')).map((x) => (typeof x === 'string' ? { text: S(x, 300), by: u.display_name } : x)).filter((x) => x.text);
    const m = data.put('community_meetings', { hamlet_id: b.hamlet_id, title: S(b.title, 200), title_ml: S(b.title_ml, 200), date: S(b.date, 10), time: S(b.time, 10) || '10:00', venue: S(b.venue, 200), agenda, status: 'scheduled', convened_by: u.id, convened_by_name: u.display_name, agency_id: u.agency_id }, u);
    emit('community.meeting_scheduled', { meeting_id: m.id, date: m.date }, u, m.hamlet_id);
    res.json(meetingOut(u, m));
  });
  router.put('/meetings/:id', requires('ops', 'hamlet.coordinate'), (req, res) => {
    const m = data.get('community_meetings', req.params.id);
    if (!m) throw httpError(404, 'Not found');
    if (!canPostIn(req.user, m.hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet');
    const b = req.body;
    const patch = { id: m.id };
    for (const k of ['title', 'title_ml', 'venue', 'minutes', 'minutes_ml', 'time', 'date']) if (b[k] !== undefined) patch[k] = S(b[k], 8000);
    for (const k of ['attendance', 'women_attendance']) if (b[k] !== undefined) patch[k] = Math.max(0, Number(b[k]) || 0);
    if (b.decisions !== undefined) patch.decisions = (Array.isArray(b.decisions) ? b.decisions : S(b.decisions).split('\n')).map((x) => S(x, 300)).filter(Boolean);
    if (['scheduled', 'held', 'postponed', 'cancelled'].includes(b.status)) patch.status = b.status;
    res.json(meetingOut(req.user, data.put('community_meetings', patch, req.user)));
  });
  // Any member can suggest an agenda item — the assembly belongs to the hamlet.
  router.post('/meetings/:id/suggest', authed, (req, res) => {
    const m = data.get('community_meetings', req.params.id);
    if (!m || !relHamlets(req.user).includes(m.hamlet_id)) throw httpError(404, 'Not found');
    if (m.status !== 'scheduled') throw httpError(409, 'Meeting is not open for suggestions');
    const text = S(req.body.text, 300);
    if (!text) throw httpError(400, 'Write a suggestion');
    const by = ['guardian', 'learner'].includes(req.user.role) ? 'Community member' : req.user.display_name;
    res.json(meetingOut(req.user, data.put('community_meetings', { id: m.id, agenda: [...(m.agenda || []), { text, by, suggested: true }] }, req.user)));
  });
  router.post('/meetings/:id/actions', requires('ops', 'hamlet.coordinate'), (req, res) => {
    const m = data.get('community_meetings', req.params.id);
    if (!m) throw httpError(404, 'Not found');
    if (!canPostIn(req.user, m.hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet');
    const text = S(req.body.text, 300);
    if (!text) throw httpError(400, 'Action text required');
    data.put('community_actions', { meeting_id: m.id, hamlet_id: m.hamlet_id, text, text_ml: S(req.body.text_ml, 300), owner: S(req.body.owner, 120), owner_agency_id: req.body.owner_agency_id || null, due: S(req.body.due, 10) || null, status: 'open' }, req.user);
    res.json(meetingOut(req.user, m));
  });
  router.post('/actions/:id/status', requires('ops', 'hamlet.coordinate'), (req, res) => {
    const a = data.get('community_actions', req.params.id);
    if (!a) throw httpError(404, 'Not found');
    if (!canPostIn(req.user, a.hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet');
    const status = ['open', 'in_progress', 'done', 'dropped'].includes(req.body.status) ? req.body.status : 'open';
    res.json(data.put('community_actions', { id: a.id, status, done_at: status === 'done' ? now() : null }, req.user));
  });

  // =====================================================================
  // Hamlet coordination — threads between agencies (service map itself comes from core)
  // =====================================================================
  const canCoordinate = (u, hamletId) => STAFF.includes(u.role) && servedHamlets(u).includes(hamletId);
  const canReadCoordination = (u, hamletId) => u.role === 'govt_viewer' || canCoordinate(u, hamletId);

  function analyse(hamletId) {
    const progs = sql('SELECT * FROM programmes WHERE hamlet_id=? AND deleted=0 AND status=\'active\'', hamletId);
    const gaps = TRACKS.filter((t) => !progs.some((p) => p.track === t));
    const overlaps = TRACKS.filter((t) => new Set(progs.filter((p) => p.track === t).map((p) => p.agency_id)).size > 1);
    const slots = {};
    for (const p of progs) for (const s of (Array.isArray(p.schedule) ? p.schedule : [])) (slots[s] = slots[s] || new Set()).add(p.agency_id);
    const clashes = Object.values(slots).filter((s) => s.size > 1).length;
    return { programmes: progs.length, agencies: new Set(progs.map((p) => p.agency_id)).size, gaps, overlaps, clashes };
  }

  router.get('/coordination/overview', authed, (req, res) => {
    const u = req.user;
    const ids = (u.role === 'govt_viewer' ? allHamletIds() : servedHamlets(u));
    const threads = sql('SELECT hamlet_id, status, COUNT(*) n FROM community_threads WHERE deleted=0 GROUP BY hamlet_id, status');
    res.json(brain.hamlets.list().filter((h) => ids.includes(h.id)).map((h) => ({
      id: h.id, name: h.name, name_ml: h.name_ml, district: h.district, community: h.community, ...analyse(h.id),
      open_threads: threads.filter((t) => t.hamlet_id === h.id && t.status !== 'agreed' && t.status !== 'closed').reduce((s, t) => s + t.n, 0),
      agreed_threads: threads.filter((t) => t.hamlet_id === h.id && t.status === 'agreed').reduce((s, t) => s + t.n, 0),
    })));
  });

  router.get('/threads', authed, (req, res) => {
    const u = req.user;
    const hid = req.query.hamlet_id;
    if (!hid || !canReadCoordination(u, hid)) throw httpError(403, 'You can view coordination only for hamlets your agency serves');
    const ag = agencyMap();
    const threads = sql('SELECT * FROM community_threads WHERE hamlet_id=? AND deleted=0 ORDER BY created_at DESC', hid);
    const posts = sql('SELECT * FROM community_posts WHERE hamlet_id=? AND deleted=0 ORDER BY posted_at', hid);
    res.json(threads.map((t) => ({
      ...t, from_agency_name: ag[t.from_agency_id]?.name, agencies: (t.agency_ids || []).map((id) => ({ id, name: ag[id]?.name, colour: ag[id]?.colour })),
      posts: posts.filter((p) => p.thread_id === t.id).map((p) => ({ ...p, agency_name: ag[p.agency_id]?.name, agency_colour: ag[p.agency_id]?.colour })),
      can_post: canCoordinate(u, hid),
    })));
  });
  router.post('/threads', requires('ops', 'hamlet.coordinate', 'agency.manage', 'teach', 'counsel'), (req, res) => {
    const u = req.user, b = req.body;
    if (!canCoordinate(u, b.hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet');
    const topic = S(b.topic, 200), body = S(b.body, 4000);
    if (!topic || !body) throw httpError(400, 'Topic and proposal are required');
    const agency_ids = [...new Set([u.agency_id, ...(Array.isArray(b.agency_ids) ? b.agency_ids : [])])].filter((a) => a && agencyServes(a, b.hamlet_id));
    const t = tx(() => {
      const th = data.put('community_threads', { hamlet_id: b.hamlet_id, topic, track: TRACKS.includes(b.track) ? b.track : null, kind: ['overlap', 'gap', 'clash', 'referral', 'general'].includes(b.kind) ? b.kind : 'general', from_agency_id: u.agency_id, agency_ids, status: 'proposed', created_by: u.id, created_by_name: u.display_name, created_at: now() }, u);
      data.put('community_posts', { thread_id: th.id, hamlet_id: b.hamlet_id, agency_id: u.agency_id, author_id: u.id, author_name: u.display_name, body, posted_at: now() }, u);
      return th;
    });
    emit('community.coordination_proposed', { thread_id: t.id, kind: t.kind, track: t.track, agencies: agency_ids }, u, t.hamlet_id);
    res.json(t);
  });
  router.post('/threads/:id/posts', requires('ops', 'hamlet.coordinate', 'agency.manage', 'teach', 'counsel'), (req, res) => {
    const t = data.get('community_threads', req.params.id);
    if (!t) throw httpError(404, 'Not found');
    if (!canCoordinate(req.user, t.hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet');
    const body = S(req.body.body, 4000);
    if (!body) throw httpError(400, 'Write a reply');
    const p = data.put('community_posts', { thread_id: t.id, hamlet_id: t.hamlet_id, agency_id: req.user.agency_id, author_id: req.user.id, author_name: req.user.display_name, body, posted_at: now() }, req.user);
    const agency_ids = [...new Set([...(t.agency_ids || []), req.user.agency_id])];
    data.put('community_threads', { id: t.id, agency_ids, status: t.status === 'proposed' ? 'discussing' : t.status }, req.user);
    res.json(p);
  });
  router.post('/threads/:id/status', requires('ops', 'hamlet.coordinate', 'agency.manage', 'teach', 'counsel'), (req, res) => {
    const t = data.get('community_threads', req.params.id);
    if (!t) throw httpError(404, 'Not found');
    if (!canCoordinate(req.user, t.hamlet_id)) throw httpError(403, 'Your agency does not serve this hamlet');
    if (!['proposed', 'discussing', 'agreed', 'closed'].includes(req.body.status)) throw httpError(400, 'Bad status');
    res.json(data.put('community_threads', { id: t.id, status: req.body.status, resolution: S(req.body.resolution, 1000) || t.resolution }, req.user));
  });

  // =====================================================================
  // Seed
  // =====================================================================
  async function seed(demo) {
    const { R, daysAgo, hamletByKey: H, agencyByKey: A, users: U } = demo;
    const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'seed.json'), 'utf8'));
    const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
    const presence = sql('SELECT agency_id, hamlet_id, services FROM agency_presence WHERE deleted=0');
    const servesIn = (hid) => presence.filter((p) => p.hamlet_id === hid).map((p) => p.agency_id);
    const staffOf = (aid) => Object.values(U).find((u) => u.agency_id === aid && ['agency_admin'].includes(u.role)) || U.steward;
    const sys = U.steward;

    tx(() => {
      // ---- notices: each hamlet gets the schemes relevant to it, posted by an agency present there
      for (const h of demo.hamlets) {
        const here = servesIn(h.id);
        for (const n of pack.notices) {
          if (n.only && !n.only.includes(h.community)) continue;
          const poster = (n.prefer || []).map((k) => A[k] && A[k].id).find((id) => here.includes(id)) || (here.includes(A.cif.id) ? A.cif.id : here[0]);
          const u = staffOf(poster);
          const fill = (s) => String(s || '').replace(/\{hamlet\}/g, h.name).replace(/\{hamlet_ml\}/g, h.name_ml).replace(/\{district\}/g, h.district);
          data.put('community_notices', {
            hamlet_id: h.id, agency_id: poster, category: n.category, title: fill(n.title), title_ml: fill(n.title_ml), body: fill(n.body), body_ml: fill(n.body_ml),
            how_to: fill(n.how_to), how_to_ml: fill(n.how_to_ml), audio_en: fill(`${n.title}. ${n.body} ${n.how_to || ''}`), audio_ml: fill(`${n.title_ml}. ${n.body_ml} ${n.how_to_ml || ''}`),
            deadline: n.deadline_in != null ? day(n.deadline_in + R.int(-3, 3)) : null, date_is_demo: 1, contact: fill(n.contact), pinned: n.pinned ? 1 : 0,
            posted_by: u.id, posted_by_name: u.display_name, posted_at: daysAgo(R.int(1, 40)),
          }, u);
        }
      }

      // ---- cultural contributions (original demo content)
      const statuses = ['published', 'published', 'published', 'published', 'published', 'reviewed', 'submitted', 'submitted', 'returned'];
      const hs = demo.hamlets;
      pack.culture.forEach((c, i) => {
        const h = c.hamlet ? H[c.hamlet] : hs[i % hs.length];
        const status = c.status || statuses[i % statuses.length];
        const contributor = c.contributor || `${R.pick(['Chellamma', 'Kunjan', 'Mallan', 'Velli', 'Karuppan', 'Neeli', 'Kali', 'Maathan', 'Chathan', 'Kurumbi'])} (elder)`;
        const reviewer = Object.values(U).find((u) => u.role === 'agency_admin' && servesIn(h.id).includes(u.agency_id)) || sys;
        const sub = R.int(5, 170);
        data.put('community_content', {
          hamlet_id: h.id, kind: c.kind, title: c.title, title_ml: c.title_ml, body: c.body, body_ml: c.body_ml || '', language: c.language || h.community,
          contributor_name: contributor, contributor_kind: c.contributor_kind || 'elder', contributor_person_id: null, credit_as: c.credit_as || contributor,
          licence: c.licence || R.pick(['community', 'community', 'cc_by_nc', 'public']), status, tags: c.tags || [],
          review_note: status === 'returned' ? (c.review_note || 'Please add the Malayalam version and confirm the elders agree to share this.') : (status === 'published' ? 'Checked with contributor and ooru mooppan.' : null),
          reviewed_by: ['published', 'reviewed', 'returned'].includes(status) ? reviewer.id : null, reviewed_by_name: ['published', 'reviewed', 'returned'].includes(status) ? reviewer.display_name : null,
          submitted_by: U.facilitator.id, submitted_at: daysAgo(sub), reviewed_at: status === 'submitted' ? null : daysAgo(Math.max(1, sub - R.int(1, 5))),
          published_at: status === 'published' ? daysAgo(Math.max(1, sub - R.int(2, 8))) : null,
          credits: status === 'published' ? ({ song: 15, story: 12, knowledge: 10, medicine_plant: 10, recipe: 8, craft: 10 }[c.kind] || 10) : 0,
        }, sys);
      });

      // ---- Oorukoottam meetings with minutes and action items
      for (const h of hs) {
        const here = servesIn(h.id);
        const convAg = here.includes(A.cif.id) ? A.cif.id : here[0];
        const conv = staffOf(convAg);
        pack.meetings.forEach((m, i) => {
          const held = m.days_ago > 0;
          const date = held ? daysAgo(m.days_ago + R.int(0, 6)).slice(0, 10) : day(-m.days_ago + R.int(0, 4));
          const att = R.int(28, 70);
          const mt = data.put('community_meetings', {
            hamlet_id: h.id, title: m.title, title_ml: m.title_ml, date, time: m.time, venue: m.venue.replace('{hamlet}', h.name), agenda: m.agenda.map((t) => ({ text: t, by: conv.display_name })),
            status: held ? 'held' : 'scheduled', attendance: held ? att : null, women_attendance: held ? Math.round(att * (0.45 + R.rnd() * 0.2)) : null,
            minutes: held ? m.minutes.replace(/\{hamlet\}/g, h.name) : '', minutes_ml: held ? (m.minutes_ml || '').replace(/\{hamlet_ml\}/g, h.name_ml) : '', decisions: held ? m.decisions : [],
            convened_by: conv.id, convened_by_name: conv.display_name, agency_id: convAg,
          }, conv);
          if (held) {
            m.actions.forEach((a, j) => {
              const ownerAg = here[(i + j) % here.length];
              data.put('community_actions', { meeting_id: mt.id, hamlet_id: h.id, text: a[0], text_ml: a[1], owner: demo.agencies.find((x) => x.id === ownerAg)?.name, owner_agency_id: ownerAg, due: daysAgo(m.days_ago - 21 - j * 7).slice(0, 10), status: m.days_ago > 60 ? R.pick(['done', 'done', 'in_progress']) : R.pick(['open', 'in_progress', 'done']) }, conv);
            });
          }
        });
      }

      // ---- coordination threads derived from real overlaps/clashes/gaps in each hamlet
      const agName = Object.fromEntries(demo.agencies.map((a) => [a.id, a.name]));
      for (const h of hs) {
        const an = analyse(h.id);
        const here = servesIn(h.id);
        const items = [];
        for (const t of an.overlaps.slice(0, 2)) {
          const ags = [...new Set(demo.programmes.filter((p) => p.hamlet_id === h.id && p.track === t).map((p) => p.agency_id))];
          items.push({ kind: 'overlap', track: t, agency_ids: ags, topic: `Two agencies run ${t} in ${h.name} — split by age group?`, posts: [
            [ags[0], `We both run ${t} here. Proposal: ${agName[ags[0]]} takes classes 5–10 and SSLC prep; ${agName[ags[1]]} takes classes 1–4 and reading circles. Learner progress shared only where families have consented.`],
            [ags[1], 'Agreed in principle. Can we keep one shared attendance day so families are not asked twice? We will bring this to the next Oorukoottam.'],
          ], status: R.pick(['agreed', 'discussing']) });
        }
        if (an.clashes) {
          const ags = here.slice(0, 2);
          items.push({ kind: 'clash', track: null, agency_ids: ags, topic: 'Timetable clash on the same evening slot', posts: [
            [ags[0], 'Our sessions fall on the same slot. Children are choosing between them. Could one of us move to Saturday morning?'],
            [ags[1] || ags[0], 'We can move to Saturday 10:00 from next month if the centre room is free.'],
          ], status: 'discussing' });
        }
        if (an.gaps.length) {
          const g = an.gaps[0];
          items.push({ kind: 'gap', track: g, agency_ids: [here[0]], topic: `No ${g} programme in ${h.name}`, posts: [[here[0], `The service map shows no ${g} track here. Families raised this at the Oorukoottam. Can any partner take it up, or should we request the ST Development Office?`]], status: 'proposed' });
        }
        for (const it of items) {
          const first = staffOf(it.posts[0][0]);
          const th = data.put('community_threads', { hamlet_id: h.id, topic: it.topic, track: it.track, kind: it.kind, from_agency_id: it.posts[0][0], agency_ids: it.agency_ids, status: it.status, created_by: first.id, created_by_name: first.display_name, created_at: daysAgo(R.int(8, 50)), resolution: it.status === 'agreed' ? 'Split agreed at Oorukoottam; review after one term.' : null }, first);
          it.posts.forEach(([aid, body], j) => { const au = staffOf(aid); data.put('community_posts', { thread_id: th.id, hamlet_id: h.id, agency_id: aid, author_id: au.id, author_name: au.display_name, body, posted_at: daysAgo(Math.max(1, 8 - j * 3)) }, au); });
        }
      }
    });
  }

  return {
    seed,
    health: () => ({
      notices: sqlOne('SELECT COUNT(*) n FROM community_notices WHERE deleted=0').n,
      content: sqlOne('SELECT COUNT(*) n FROM community_content WHERE deleted=0').n,
      pending_review: sqlOne('SELECT COUNT(*) n FROM community_content WHERE deleted=0 AND status IN (\'submitted\',\'reviewed\')').n,
      meetings: sqlOne('SELECT COUNT(*) n FROM community_meetings WHERE deleted=0').n,
      open_threads: sqlOne('SELECT COUNT(*) n FROM community_threads WHERE deleted=0 AND status IN (\'proposed\',\'discussing\')').n,
    }),
  };
};
