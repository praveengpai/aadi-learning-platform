'use strict';
// Community Voice & Gatherings — the hub as a small community radio.
// Short audio bulletins by youth reporters and staff, oral histories recorded with elders (owned by the
// speaker and their community, withdrawable at any time), visit-day playlists for the hub speaker and
// listeners' phones, gatherings (films, shows, sports) with attendance, and listening reach.
// The cultural archive (text), notice board and Oorukoottam meetings live in the `community` module —
// this module links to them and never duplicates them.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { validateAudio, syntheticWav, MAX_BYTES, MAX_SECONDS } = require('./audio');

const WORDING = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'wording.json'), 'utf8'));
const KINDS = {
  bulletin: { label: 'News bulletin', label_ml: 'വാർത്ത', icon: '📰' },
  announcement: { label: 'Announcement', label_ml: 'അറിയിപ്പ്', icon: '📣' },
  oral_history: { label: 'Elder\'s story (oral history)', label_ml: 'മൂപ്പന്മാരുടെ കഥ (വാമൊഴി ചരിത്രം)', icon: '🧓' },
  song: { label: 'Song', label_ml: 'പാട്ട്', icon: '🎵' },
};
const STORY_KINDS = ['oral_history', 'song'];
const LICENCES = ['community', 'cc_by_nc', 'public'];
const LANGUAGES = [
  { value: 'Muthuvan', label: 'Muthuvan', label_ml: 'മുതുവാൻ' }, { value: 'Mannan', label: 'Mannan', label_ml: 'മന്നാൻ' },
  { value: 'Irula', label: 'Irula', label_ml: 'ഇരുള' }, { value: 'Malayalam', label: 'Malayalam', label_ml: 'മലയാളം' },
  { value: 'Other', label: 'Other', label_ml: 'മറ്റുള്ളവ' },
];
const LANG_VALUES = LANGUAGES.map((l) => l.value);
const GATHERING_KINDS = {
  film: { label: 'Film screening', label_ml: 'സിനിമാ പ്രദർശനം', icon: '🎬' },
  educational_show: { label: 'Educational show', label_ml: 'പഠന പരിപാടി', icon: '📽️' },
  sports: { label: 'Sports', label_ml: 'കായിക മത്സരം', icon: '⚽' },
  celebration: { label: 'Celebration', label_ml: 'ആഘോഷം', icon: '🎉' },
};
const GROUPS = ['children', 'youth', 'adults', 'elders'];
const STEWARDS = ['platform_admin', 'cpo'];
const EXTERNAL = ['donor', 'govt_viewer', 'employer'];
const STAFF = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'mentor', 'counsellor'];
const RECORDERS = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'mentor'];
const REVIEWERS = ['platform_admin', 'agency_admin', 'coordinator', 'teacher'];
const ORGANISERS = ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'];
const DEMO_TAG = 'DEMO AUDIO — synthetic tone, not a real recording';
const MAX_PLAYLIST = 20;

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError, manifest } = ctx;
  const S = (v, max = 2000) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const nowIso = () => new Date().toISOString();
  const today = () => nowIso().slice(0, 10);
  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  const BUDGET_MB = (manifest.budget && manifest.budget.storage_mb) || 80;
  const in_ = (arr) => arr.map(() => '?').join(',');

  // ---------- who relates to which hamlet ----------
  const allHamletIds = () => brain.hamlets.list().map((h) => h.id);
  const hamletMap = () => Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
  function memberHamlets(u) {
    if (!u.person_id) return [];
    const set = new Set();
    const me = brain.persons.raw(u.person_id);
    if (me) set.add(me.hamlet_id);
    for (const w of brain.persons.wards(u)) set.add(w.hamlet_id);
    return [...set];
  }
  function servedHamlets(u) {
    if (STEWARDS.includes(u.role)) return allHamletIds();
    if (!STAFF.includes(u.role) || !u.agency_id) return [];
    let ids = sql('SELECT DISTINCT hamlet_id FROM agency_presence WHERE agency_id=? AND deleted=0 AND status=\'active\'', u.agency_id).map((r) => r.hamlet_id);
    if (Array.isArray(u.hamlet_ids) && u.hamlet_ids.length) ids = ids.filter((h) => u.hamlet_ids.includes(h));
    return ids;
  }
  const relHamlets = (u) => [...new Set([...memberHamlets(u), ...servedHamlets(u)])];
  const live = (hs) => (hs || []).filter((h) => brain.modules.enabledIn(h));

  // ---------- clip visibility ----------
  const LIST_COLS = 'id, hamlet_id, hamlet_ids, agency_id, kind, language, title, title_ml, transcript, transcript_ml, mime, bytes, duration_s, status, licence, licence_chosen_by, speaker_person_id, credit_as, featured_person_ids, no_identifiable, community_content_id, recorded_by, recorded_by_name, recorded_at, review_note, reviewed_by_name, reviewed_at, published_at, withdrawn_at, is_demo, updated_at';
  const people = (c) => [...new Set([c.speaker_person_id, ...(Array.isArray(c.featured_person_ids) ? c.featured_person_ids : [])].filter(Boolean))];
  // Everyone identifiable still agrees (their profile consent to the agency is active).
  const consentOk = (c) => (people(c).length ? people(c).every((pid) => brain.consent.has(pid, c.agency_id, 'profile')) : Number(c.no_identifiable) === 1);
  const isStaffFor = (u, c) => (u.role === 'platform_admin') || (STAFF.includes(u.role) && u.agency_id === c.agency_id && (c.hamlet_ids || []).some((h) => servedHamlets(u).includes(h)));
  const isReviewerFor = (u, c) => u.role === 'platform_admin' || (REVIEWERS.includes(u.role) && isStaffFor(u, c));
  function canListen(u, c, rel) {
    if (c.status !== 'published' || c.withdrawn_at) return false;
    if (EXTERNAL.includes(u.role)) return false; // aggregates only
    if (!consentOk(c)) return false;
    const targets = live(c.hamlet_ids);
    if (!targets.length) return false;
    if (STEWARDS.includes(u.role)) return true;
    if (c.licence === 'community') return targets.some((h) => rel.includes(h));
    return true;
  }
  const canManage = (u, c) => c.recorded_by === u.id || isReviewerFor(u, c) || (u.role === 'platform_admin');
  // The speaker of an oral history (or the guardian of a minor speaker) — the only people who may WIDEN its licence.
  function speakerRight(u, c) {
    const sp = c.speaker_person_id;
    if (!sp) return null;
    if (u.person_id && u.person_id === sp) return 'speaker';
    if (u.role === 'guardian' && u.person_id) { const p = brain.persons.raw(sp); if (p && p.guardian_id === u.person_id && brain.policy.isMinor(p)) return 'guardian'; }
    return null;
  }
  const LIC_RANK = { community: 0, cc_by_nc: 1, public: 2 };
  const inPerson = (b) => !!b && (b.in_person === true || b.in_person === 1 || b.in_person === '1');
  // Personal content of a clip: removed from every past version in the event log when it is taken back.
  const WITHDRAW_FIELDS = ['audio', 'transcript', 'transcript_ml', 'title', 'title_ml', 'credit_as', 'review_note'];
  const WITHDRAWN_TITLE = 'Recording taken back by the speaker';
  const WITHDRAWN_TITLE_ML = 'പറഞ്ഞയാൾ തിരിച്ചെടുത്ത റെക്കോർഡിംഗ്';
  function withdrawClip(c, { via, reason = null, by, at = nowIso(), user }) {
    return tx(() => {
      // 1. scrub the audio and words from every version of this row on this node (and, via core.redact, on every node)
      data.redact('voice_clips', c.id, WITHDRAW_FIELDS, user);
      // 2. the current row records the withdrawal (no content in it)
      return data.put('voice_clips', { id: c.id, status: 'withdrawn', withdrawn_at: at, withdrawn_via: via, withdrawn_by: by || null, withdrawn_reason: reason, title: WITHDRAWN_TITLE, title_ml: WITHDRAWN_TITLE_ML, audio: null, transcript: null, transcript_ml: null, credit_as: null, review_note: null, bytes: 0 }, user);
    });
  }
  function withdrawRight(u, c) {
    const ps = people(c);
    if (u.person_id && ps.includes(u.person_id)) return 'self';
    if (u.role === 'guardian' && u.person_id) {
      for (const pid of ps) { const p = brain.persons.raw(pid); if (p && p.guardian_id === u.person_id && brain.policy.isMinor(p)) return 'guardian'; }
    }
    if (u.role === 'platform_admin') return 'steward';
    // Elders rarely have logins: staff of the recording agency record a request made in person at the hub.
    if (STAFF.includes(u.role) && isStaffFor(u, c)) return 'in_person';
    return null;
  }
  function shape(u, c, rel) {
    const hm = hamletMap();
    const k = KINDS[c.kind] || {};
    const staff = canManage(u, c);
    const out = {
      id: c.id, kind: c.kind, kind_label: k.label, kind_label_ml: k.label_ml, icon: k.icon, language: c.language,
      title: c.title, title_ml: c.title_ml, transcript: c.transcript, transcript_ml: c.transcript_ml,
      mime: c.mime, bytes: c.bytes, duration_s: c.duration_s, status: c.status, licence: c.licence, licence_chosen_by: c.licence_chosen_by,
      credit_as: c.credit_as, hamlet_ids: c.hamlet_ids, hamlets: (c.hamlet_ids || []).map((h) => hm[h] && { id: h, name: hm[h].name, name_ml: hm[h].name_ml }).filter(Boolean),
      recorded_by_name: c.recorded_by_name, recorded_at: c.recorded_at, published_at: c.published_at, withdrawn_at: c.withdrawn_at, is_demo: Number(c.is_demo) === 1,
      community_content_id: c.community_content_id || null, no_identifiable: Number(c.no_identifiable) === 1,
      mine: c.recorded_by === u.id, can_edit: staff && c.recorded_by === u.id && ['draft', 'returned'].includes(c.status),
      can_review: isReviewerFor(u, c) && c.recorded_by !== u.id, can_publish: isReviewerFor(u, c),
      can_withdraw: !c.withdrawn_at && !!withdrawRight(u, c),
      can_widen_licence: !c.withdrawn_at && (c.kind === 'oral_history' ? !!speakerRight(u, c) : canManage(u, c)),
    };
    if (staff) {
      out.review_note = c.review_note; out.reviewed_by_name = c.reviewed_by_name; out.reviewed_at = c.reviewed_at;
      out.consent_ok = consentOk(c);
      // names of featured people only for those allowed to see them
      out.featured = people(c).map((pid) => (brain.policy.canSee(u, pid, 'profile').ok ? (() => { const b = brain.persons.basic(pid); return b && { id: b.id, name: b.name, kind: b.kind, consent: brain.consent.has(pid, c.agency_id, 'profile') }; })() : { id: null, name: '(hidden)', consent: brain.consent.has(pid, c.agency_id, 'profile') })).filter(Boolean);
    }
    void rel;
    return out;
  }
  const loadClip = (id, withAudio = false) => (withAudio ? data.get('voice_clips', id) : sqlOne(`SELECT ${LIST_COLS} FROM voice_clips WHERE id=? AND deleted=0`, String(id || '')));
  const allClips = (where = '', ...p) => sql(`SELECT ${LIST_COLS} FROM voice_clips WHERE deleted=0 ${where} ORDER BY COALESCE(published_at, recorded_at) DESC LIMIT 2000`, ...p);

  // ---------- storage ----------
  function storage() {
    const r = sqlOne('SELECT COUNT(*) n, COALESCE(SUM(bytes),0) b FROM voice_clips WHERE deleted=0 AND audio IS NOT NULL');
    const used_mb = Math.round((r.b / 1048576) * 100) / 100;
    return { clips_with_audio: r.n, audio_bytes: r.b, audio_mb: used_mb, budget_storage_mb: BUDGET_MB, pct_of_budget: Math.round((used_mb / BUDGET_MB) * 1000) / 10, max_clip_kb: MAX_BYTES / 1024, max_clip_seconds: MAX_SECONDS };
  }

  // ---------- meta ----------
  router.get('/meta', authed, (req, res) => {
    const u = req.user;
    const hm = hamletMap();
    const rel = relHamlets(u);
    const served = servedHamlets(u);
    res.json({
      kinds: KINDS, licences: LICENCES, languages: LANGUAGES, gathering_kinds: GATHERING_KINDS, wording: WORDING,
      max_seconds: MAX_SECONDS, max_kb: MAX_BYTES / 1024, demo_tag: DEMO_TAG,
      my_hamlets: rel.filter((h) => hm[h]).map((h) => ({ id: h, name: hm[h].name, name_ml: hm[h].name_ml, community: hm[h].community, member: memberHamlets(u).includes(h), on: brain.modules.enabledIn(h) })),
      record_hamlets: RECORDERS.includes(u.role) ? served.filter((h) => brain.modules.enabledIn(h)) : [],
      can_record: RECORDERS.includes(u.role) && served.length > 0,
      can_review: REVIEWERS.includes(u.role) && served.length > 0,
      can_build: ORGANISERS.includes(u.role) && served.length > 0,
      can_aggregate: brain.policy.can(u, 'analytics.aggregate'),
    });
  });

  // People a recorder may feature (they can see the person and the person consented to the agency).
  router.get('/people', requires('ops', 'teach', 'mentor', 'agency.manage'), (req, res) => {
    const u = req.user;
    const hid = S(req.query.hamlet_id, 64) || null;
    if (hid && !servedHamlets(u).includes(hid)) throw httpError(403, 'Your agency does not serve this hamlet');
    const rows = brain.persons.visible(u, { hamlet_id: hid, q: req.query.q ? S(req.query.q, 60) : null, limit: 200 })
      .filter((p) => brain.consent.has(p.id, u.agency_id, 'profile') && brain.policy.canSee(u, p.id, 'profile').ok && servedHamlets(u).includes(p.hamlet_id))
      .map((p) => ({ id: p.id, name: p.name, kind: p.kind, age: p.age, minor: p.minor, hamlet_id: p.hamlet_id }));
    res.json(rows);
  });

  // ---------- listening ----------
  router.get('/clips', authed, (req, res) => {
    const u = req.user;
    const rel = relHamlets(u);
    let rows = allClips();
    const hid = S(req.query.hamlet_id, 64);
    const listenable = rows.filter((c) => canListen(u, c, rel));
    let out;
    if (hid) out = listenable.filter((c) => (c.hamlet_ids || []).includes(hid) && (STEWARDS.includes(u.role) || rel.includes(hid) || c.licence !== 'community'));
    else if (req.query.shared === '1') out = listenable.filter((c) => c.licence !== 'community');
    else out = listenable.filter((c) => STEWARDS.includes(u.role) || (c.hamlet_ids || []).some((h) => rel.includes(h)));
    if (req.query.mine === '1') out = [...out, ...rows.filter((c) => c.recorded_by === u.id && !out.includes(c))];
    if (req.query.language) out = out.filter((c) => c.language === req.query.language);
    if (req.query.kind) out = out.filter((c) => c.kind === req.query.kind);
    res.json(out.slice(0, 300).map((c) => shape(u, c, rel)));
  });

  router.get('/queue', requires('content.review', 'hamlet.coordinate'), (req, res) => {
    const u = req.user;
    const rel = relHamlets(u);
    const rows = allClips("AND status IN ('draft','reviewed')").filter((c) => isReviewerFor(u, c) && !c.withdrawn_at);
    res.json(rows.map((c) => shape(u, c, rel)));
  });

  function visibleClip(u, id) {
    const c = loadClip(id);
    if (!c) throw httpError(404, 'Clip not found');
    const rel = relHamlets(u);
    if (canListen(u, c, rel)) return { c, rel };
    if (!c.withdrawn_at && canManage(u, c)) return { c, rel };
    if (c.withdrawn_at && (canManage(u, c) || withdrawRight(u, c))) return { c, rel };
    throw httpError(404, 'Clip not found or not shared with you');
  }
  router.get('/clips/:id', authed, (req, res) => { const { c, rel } = visibleClip(req.user, req.params.id); res.json(shape(req.user, c, rel)); });
  router.get('/clips/:id/audio', authed, (req, res) => {
    const { c } = visibleClip(req.user, req.params.id);
    if (c.withdrawn_at) throw httpError(410, 'This recording was taken back by the speaker.');
    const full = loadClip(c.id, true);
    res.json({ id: c.id, mime: full.mime, audio: full.audio, duration_s: full.duration_s, is_demo: Number(full.is_demo) === 1 });
  });

  // ---------- recording ----------
  function targetsFor(u, b, kind) {
    const served = servedHamlets(u).filter((h) => brain.modules.enabledIn(h));
    let hs;
    if (b.hamlet_ids === 'all' || (Array.isArray(b.hamlet_ids) && b.hamlet_ids.includes('all'))) hs = served;
    else hs = (Array.isArray(b.hamlet_ids) ? b.hamlet_ids : [b.hamlet_id]).map((x) => S(x, 64)).filter(Boolean);
    hs = [...new Set(hs)];
    if (!hs.length) throw httpError(400, 'Choose the hamlet(s) this clip is for');
    for (const h of hs) if (!brain.hamlets.get(h)) throw httpError(400, 'Unknown hamlet');
    for (const h of hs) if (!served.includes(h)) throw httpError(403, 'Your agency does not serve one of these hamlets (or the service is switched off there).');
    if (kind === 'oral_history' && hs.length !== 1) throw httpError(400, 'An elder\'s story belongs to one hamlet — choose only the speaker\'s hamlet.');
    return hs;
  }
  function checkPeople(u, ids, agencyId) {
    const list = [...new Set((Array.isArray(ids) ? ids : []).map((x) => S(x, 64)).filter(Boolean))].slice(0, 20);
    for (const pid of list) {
      const v = brain.policy.canSee(u, pid, 'profile');
      if (!v.ok) throw httpError(403, 'You cannot add this person: ' + v.reason);
      if (!brain.consent.has(pid, agencyId, 'profile')) throw Object.assign(httpError(409, 'This person (or a child\'s guardian) has not agreed to share their profile with your agency — record their agreement at the centre first, or remove them from the clip.'), { code: 'consent_needed' });
    }
    return list;
  }
  function buildClip(u, b, existing) {
    const kind = existing ? existing.kind : S(b.kind, 30);
    if (!KINDS[kind]) throw httpError(400, 'Choose what kind of clip this is');
    const agency_id = existing ? existing.agency_id : u.agency_id;
    if (!agency_id) throw httpError(403, 'Only agency staff can record clips');
    const hamlet_ids = existing ? existing.hamlet_ids : targetsFor(u, b, kind);
    const title = S(b.title ?? (existing && existing.title), 160);
    if (title.length < 3) throw httpError(400, 'Give the clip a short title');
    const language = LANG_VALUES.includes(b.language) ? b.language : (existing ? existing.language : null);
    if (!language) throw httpError(400, 'Choose the language spoken');
    const row = {
      ...(existing ? { id: existing.id } : {}), kind, agency_id, hamlet_ids, hamlet_id: hamlet_ids.length === 1 ? hamlet_ids[0] : null, language,
      title, title_ml: S(b.title_ml ?? (existing && existing.title_ml), 200) || null,
      transcript: S(b.transcript ?? (existing && existing.transcript), 6000) || null, transcript_ml: S(b.transcript_ml ?? (existing && existing.transcript_ml), 6000) || null,
    };
    // audio — required on create; on edit only when re-recorded
    if (!existing || b.audio !== undefined) {
      const a = validateAudio(b.audio, b.duration_s);
      const st = storage();
      if (st.audio_bytes + a.bytes - (existing ? Number(existing.bytes) || 0 : 0) > BUDGET_MB * 1048576) throw httpError(409, 'The hub\'s audio storage is full — remove old clips first.');
      Object.assign(row, { audio: b.audio, mime: a.mime, bytes: a.bytes, duration_s: a.duration_s, duration_source: a.duration_source });
    }
    // consent: speaker (oral history) + featured people, or "no one identifiable"
    let speaker = existing ? existing.speaker_person_id : null;
    if (kind === 'oral_history' && !existing) {
      speaker = S(b.speaker_person_id, 64);
      if (!speaker) throw httpError(400, 'Choose the elder who is telling the story');
    }
    const featured = b.featured_person_ids !== undefined ? b.featured_person_ids : (existing ? existing.featured_person_ids : []);
    const ids = checkPeople(u, [...(speaker ? [speaker] : []), ...(Array.isArray(featured) ? featured : [])], agency_id);
    const noOne = b.no_identifiable !== undefined ? (b.no_identifiable === true || b.no_identifiable === 1 || b.no_identifiable === '1') : (existing ? Number(existing.no_identifiable) === 1 : false);
    if (!ids.length && !noOne) throw httpError(400, 'Add the people who are named or heard in this clip (with their agreement), or tick "no one can be identified".');
    if (ids.length && noOne) throw httpError(400, 'You added people to this clip, so "no one can be identified" cannot be ticked.');
    if (kind === 'oral_history' && speaker) {
      const sp = brain.persons.raw(speaker);
      if (!sp || sp.hamlet_id !== hamlet_ids[0]) throw httpError(400, 'An elder\'s story is shared in the speaker\'s own hamlet.');
    }
    row.speaker_person_id = speaker || null;
    row.featured_person_ids = ids.filter((x) => x !== speaker);
    row.no_identifiable = noOne ? 1 : 0;
    // licence: an oral history always starts "our hamlet only"; only the speaker (or a minor speaker's
    // guardian) can widen it, from their own login (POST /clips/:id/licence). Staff cannot choose for them.
    if (kind === 'oral_history') {
      row.licence = existing ? existing.licence : 'community';
      row.licence_chosen_by = existing ? existing.licence_chosen_by : 'default';
    } else {
      row.licence = LICENCES.includes(b.licence) ? b.licence : (existing ? existing.licence : 'community');
      row.licence_chosen_by = 'recorder';
    }
    const credit = S(b.credit_as ?? (existing && existing.credit_as), 120);
    row.credit_as = credit || null;
    // optional link to the text archive in the community module (same hamlet)
    const link = S(b.community_content_id ?? (existing && existing.community_content_id), 64);
    if (link) {
      let ok = false;
      try { ok = !!sqlOne('SELECT 1 x FROM community_content WHERE id=? AND deleted=0 AND hamlet_id IN (' + in_(hamlet_ids) + ')', link, ...hamlet_ids); } catch (_) { ok = false; }
      if (!ok) throw httpError(400, 'The linked archive item was not found in this hamlet');
      row.community_content_id = link;
    } else row.community_content_id = null;
    row.status = 'draft';
    if (!existing) Object.assign(row, { recorded_by: u.id, recorded_by_name: u.display_name, recorded_at: nowIso(), is_demo: 0 });
    return row;
  }

  router.post('/clips', requires('ops', 'teach', 'mentor', 'agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user;
    if (!RECORDERS.includes(u.role)) throw httpError(403, 'Your role cannot record clips');
    const row = data.put('voice_clips', buildClip(u, req.body || {}, null), u);
    emit('voice.clip_recorded', { clip_id: row.id, kind: row.kind, language: row.language }, u, row.hamlet_id);
    res.json(shape(u, row, relHamlets(u)));
  });
  router.put('/clips/:id', authed, (req, res) => {
    const u = req.user;
    const c = loadClip(req.params.id, true);
    if (!c) throw httpError(404, 'Clip not found');
    if (c.recorded_by !== u.id && u.role !== 'platform_admin') throw httpError(403, 'Only the person who recorded this clip can change it');
    if (c.withdrawn_at) throw httpError(409, 'This clip was taken back by the speaker');
    if (!['draft', 'returned', 'reviewed'].includes(c.status)) throw httpError(409, 'A published clip cannot be changed — unpublish it first');
    const row = data.put('voice_clips', buildClip(u, req.body || {}, c), u);
    res.json(shape(u, row, relHamlets(u)));
  });
  router.delete('/clips/:id', authed, (req, res) => {
    const u = req.user;
    const c = loadClip(req.params.id);
    if (!c) throw httpError(404, 'Clip not found');
    if (!(c.recorded_by === u.id && ['draft', 'returned'].includes(c.status)) && u.role !== 'platform_admin') throw httpError(403, 'Only an unpublished clip can be deleted, by the person who recorded it');
    data.del('voice_clips', c.id, u);
    res.json({ ok: true });
  });

  // ---------- review ----------
  router.post('/clips/:id/review', requires('content.review', 'hamlet.coordinate'), (req, res) => {
    const u = req.user;
    const c = loadClip(req.params.id);
    if (!c) throw httpError(404, 'Clip not found');
    if (!isReviewerFor(u, c)) throw httpError(403, 'Only reviewers of the recording agency who serve this hamlet can review it');
    if (c.withdrawn_at) throw httpError(409, 'This clip was taken back by the speaker');
    const d = S(req.body && req.body.decision, 20);
    const flow = { review: ['draft'], publish: ['reviewed'], return: ['draft', 'reviewed'], unpublish: ['published'] };
    if (!flow[d]) throw httpError(400, 'decision must be review | publish | return | unpublish');
    if (!flow[d].includes(c.status)) throw httpError(409, `Cannot ${d} a clip that is ${c.status}${d === 'publish' ? ' — it must be reviewed first' : ''}`);
    if (d === 'review' && c.recorded_by === u.id && u.role !== 'platform_admin') throw httpError(403, 'Someone else must review your own recording');
    const note = S(req.body.note, 1000);
    if (d === 'return' && !note) throw httpError(400, 'Tell the recorder what to change');
    if (d === 'publish') {
      if (!consentOk(c)) throw Object.assign(httpError(409, 'Cannot publish: a person heard or named in this clip has not agreed (or has withdrawn their agreement) to share with your agency.'), { code: 'consent_needed' });
      if (!live(c.hamlet_ids).length) throw httpError(409, 'The community has switched this service off in these hamlets');
    }
    const status = { review: 'reviewed', publish: 'published', return: 'returned', unpublish: 'returned' }[d];
    const row = data.put('voice_clips', { id: c.id, status, review_note: note || c.review_note, reviewed_by: u.id, reviewed_by_name: u.display_name, reviewed_at: nowIso(), published_at: d === 'publish' ? nowIso() : (d === 'unpublish' ? null : c.published_at) }, u);
    if (d === 'publish') emit('voice.clip_published', { clip_id: c.id, kind: c.kind, licence: c.licence }, u, c.hamlet_id);
    brain.audit(u, 'clip.' + d, c.id);
    res.json(shape(u, row, relHamlets(u)));
  });

  // ---------- the speaker owns it: withdraw, or change the licence ----------
  router.post('/clips/:id/withdraw', authed, (req, res) => {
    const u = req.user;
    const c = loadClip(req.params.id);
    if (!c) throw httpError(404, 'Clip not found');
    if (c.withdrawn_at) return res.json(shape(u, c, relHamlets(u)));
    const via = withdrawRight(u, c);
    if (!via) throw httpError(403, 'Only the speaker, a child\'s guardian or the recording agency (on the speaker\'s request) can take this back');
    if (via === 'in_person' && !inPerson(req.body)) throw Object.assign(httpError(400, 'Staff can take a recording back only when the speaker asks in person at the centre — confirm that they did (in_person).'), { code: 'in_person_required' });
    // The audio and words are removed from every past version in the event log (core.redact), so every hub
    // and phone drops them on next sync and a fresh hub never receives them.
    const row = withdrawClip(c, { via, reason: S(req.body && req.body.reason, 300) || null, by: u.id, user: u });
    // Pull it out of every playlist at once.
    for (const pl of data.find('voice_playlists', {})) if ((pl.items || []).includes(c.id)) data.put('voice_playlists', { id: pl.id, items: pl.items.filter((x) => x !== c.id) }, u);
    emit('voice.clip_withdrawn', { clip_id: c.id, via }, u, c.hamlet_id);
    brain.audit(u, 'clip.withdraw', c.id, { via });
    res.json(shape(u, row, relHamlets(u)));
  });
  router.post('/clips/:id/licence', authed, (req, res) => {
    const u = req.user;
    const c = loadClip(req.params.id);
    if (!c) throw httpError(404, 'Clip not found');
    if (c.withdrawn_at) throw httpError(409, 'This clip was taken back by the speaker');
    const lic = S(req.body && req.body.licence, 20);
    if (!LICENCES.includes(lic)) throw httpError(400, 'Unknown licence');
    let chosenBy, via = null;
    if (c.kind === 'oral_history') {
      const widen = LIC_RANK[lic] > LIC_RANK[c.licence || 'community'];
      const sp = speakerRight(u, c);
      if (sp) { chosenBy = sp; via = 'own_login'; }
      else if (widen) throw httpError(403, 'Only the speaker (or the guardian of a child speaker) can let more people listen to their story.');
      else if (u.role === 'platform_admin') { chosenBy = 'steward'; via = 'steward'; }
      else if (STAFF.includes(u.role) && isStaffFor(u, c)) {
        if (!inPerson(req.body)) throw Object.assign(httpError(400, 'Staff can narrow who may listen only when the speaker asks in person at the centre — confirm that they did (in_person).'), { code: 'in_person_required' });
        chosenBy = 'staff_on_speaker_request'; via = 'in_person';
      } else throw httpError(403, 'Only the speaker (or a child\'s guardian, or staff on their in-person request) can change who may listen');
    } else {
      if (!(c.recorded_by === u.id || isReviewerFor(u, c))) throw httpError(403, 'Only the recorder or a reviewer can change this');
      chosenBy = 'recorder'; via = 'recorder';
    }
    const row = data.put('voice_clips', { id: c.id, licence: lic, licence_chosen_by: chosenBy, licence_changed_by: u.id, licence_changed_via: via, licence_changed_at: nowIso() }, u);
    brain.audit(u, 'clip.licence', c.id, { licence: lic, via, chosen_by: chosenBy });
    res.json(shape(u, row, relHamlets(u)));
  });

  // ---------- listening reach: plays per clip per hamlet per day (never per person) ----------
  const playId = (clip, hamlet, day, channel) => 'vpl_' + crypto.createHash('sha1').update([clip, hamlet, day, channel, brain.nodeId].join('|')).digest('hex').slice(0, 24);
  function addPlays(clipId, hamletId, channel, n, day, u) {
    const id = playId(clipId, hamletId, day, channel);
    const cur = data.get('voice_plays', id);
    return data.put('voice_plays', { id, clip_id: clipId, hamlet_id: hamletId, day, channel, plays: (cur ? Number(cur.plays) || 0 : 0) + n }, u);
  }
  // One counted play per listener per clip per day. The dedup key is an HMAC of (user, clip, day)
  // under a random key that lives only in this process's memory: it is never written to a table or the
  // event log, never synced, and cannot be linked back to a person once the process restarts.
  const PLAY_SECRET = crypto.randomBytes(32);
  const MAX_HUB_GROUP = 50;
  const counted = new Map(); // day -> Set(hmac)
  function firstPlayToday(u, clipId, day) {
    for (const d of counted.keys()) if (d !== day) counted.delete(d);
    if (!counted.has(day)) counted.set(day, new Set());
    const set = counted.get(day);
    const k = crypto.createHmac('sha256', PLAY_SECRET).update([u.id, clipId, day].join('|')).digest('base64');
    if (set.has(k)) return false;
    set.add(k);
    return true;
  }
  router.post('/clips/:id/play', authed, (req, res) => {
    const u = req.user;
    const c = loadClip(req.params.id);
    const rel = relHamlets(u);
    if (!c || !canListen(u, c, rel)) throw httpError(404, 'Clip not found or not shared with you');
    const b = req.body || {};
    let hid = S(b.hamlet_id, 64) || (c.hamlet_ids || []).find((h) => rel.includes(h));
    if (!hid || !(c.hamlet_ids || []).includes(hid) || (!STEWARDS.includes(u.role) && !rel.includes(hid))) {
      // a shared clip heard outside its target hamlets counts in the listener's own hamlet
      hid = rel.find((h) => brain.modules.enabledIn(h));
      if (!hid) throw httpError(400, 'Which hamlet was this played in?');
    }
    const channel = b.channel === 'hub' ? 'hub' : 'phone';
    if (channel === 'hub' && !(STAFF.includes(u.role) && servedHamlets(u).includes(hid))) throw httpError(403, 'Only staff at the hub count speaker plays');
    // A phone is one listener: always 1. The hub speaker may report the group that heard it (bounded).
    const n = channel === 'hub' ? Math.max(1, Math.min(MAX_HUB_GROUP, Math.floor(Number(b.count) || 1))) : 1;
    const day = today(); // server time — never the client's
    if (!firstPlayToday(u, c.id, day)) {
      const cur = data.get('voice_plays', playId(c.id, hid, day, channel));
      return res.json({ ok: true, counted: false, clip_id: c.id, hamlet_id: hid, day, channel, plays_today: cur ? Number(cur.plays) || 0 : 0 });
    }
    const row = addPlays(c.id, hid, channel, n, day, null);
    res.json({ ok: true, counted: true, clip_id: c.id, hamlet_id: hid, day, channel, plays_today: row.plays });
  });
  router.get('/reach', requires('ops', 'agency.manage', 'hamlet.coordinate', 'content.review'), (req, res) => {
    const u = req.user;
    const served = servedHamlets(u);
    const clips = allClips().filter((c) => u.role === 'platform_admin' || c.agency_id === u.agency_id);
    const byId = Object.fromEntries(clips.map((c) => [c.id, c]));
    const since = new Date(Date.now() - (Math.min(365, Math.max(7, Number(req.query.days) || 90))) * 86400e3).toISOString().slice(0, 10);
    const rows = sql('SELECT clip_id, hamlet_id, channel, SUM(plays) plays FROM voice_plays WHERE deleted=0 AND day>=? GROUP BY clip_id, hamlet_id, channel', since)
      .filter((r) => byId[r.clip_id] && served.includes(r.hamlet_id));
    const hm = hamletMap();
    const m = new Map();
    for (const r of rows) {
      const k = r.clip_id + '|' + r.hamlet_id;
      if (!m.has(k)) m.set(k, { clip_id: r.clip_id, title: byId[r.clip_id].title, title_ml: byId[r.clip_id].title_ml, kind: r.kind || byId[r.clip_id].kind, status: byId[r.clip_id].status, hamlet: hm[r.hamlet_id] && hm[r.hamlet_id].name, hamlet_ml: hm[r.hamlet_id] && hm[r.hamlet_id].name_ml, hub: 0, phone: 0 });
      m.get(k)[r.channel === 'hub' ? 'hub' : 'phone'] += Number(r.plays) || 0;
    }
    res.json({ since, rows: [...m.values()].map((x) => ({ ...x, total: x.hub + x.phone })).sort((a, b) => b.total - a.total) });
  });

  // ---------- playlists for visit day ----------
  function playlistOut(u, pl, rel) {
    const items = [];
    for (const id of pl.items || []) { const c = loadClip(id); if (c && canListen(u, c, rel) && (c.hamlet_ids || []).includes(pl.hamlet_id)) items.push(shape(u, c, rel)); }
    const hm = hamletMap();
    return { id: pl.id, hamlet_id: pl.hamlet_id, hamlet: hm[pl.hamlet_id] && hm[pl.hamlet_id].name, hamlet_ml: hm[pl.hamlet_id] && hm[pl.hamlet_id].name_ml, date: pl.date, title: pl.title, title_ml: pl.title_ml, notes: pl.notes, built_by_name: pl.built_by_name, items, total_s: Math.round(items.reduce((t, c) => t + (Number(c.duration_s) || 0), 0)), can_edit: ORGANISERS.includes(u.role) && servedHamlets(u).includes(pl.hamlet_id) && (u.role === 'platform_admin' || pl.agency_id === u.agency_id) };
  }
  router.get('/playlist', authed, (req, res) => {
    const u = req.user;
    const rel = relHamlets(u);
    const hid = S(req.query.hamlet_id, 64) || memberHamlets(u)[0] || rel[0];
    if (!hid || (!rel.includes(hid) && !STEWARDS.includes(u.role))) return res.json(null);
    if (!brain.modules.enabledIn(hid)) return res.json(null);
    const d = isDate(S(req.query.date, 10)) ? S(req.query.date, 10) : today();
    const pl = sqlOne('SELECT * FROM voice_playlists WHERE deleted=0 AND hamlet_id=? AND date=? ORDER BY updated_at DESC LIMIT 1', hid, d)
      || sqlOne('SELECT * FROM voice_playlists WHERE deleted=0 AND hamlet_id=? AND date>? ORDER BY date ASC LIMIT 1', hid, d)
      || sqlOne('SELECT * FROM voice_playlists WHERE deleted=0 AND hamlet_id=? AND date<? ORDER BY date DESC LIMIT 1', hid, d);
    res.json(pl ? playlistOut(u, pl, rel) : null);
  });
  router.get('/playlists', requires('ops', 'agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user;
    const rel = relHamlets(u);
    const served = servedHamlets(u);
    const hid = S(req.query.hamlet_id, 64);
    const want = hid ? [hid].filter((h) => served.includes(h)) : served;
    if (!want.length) return res.json([]);
    res.json(sql(`SELECT * FROM voice_playlists WHERE deleted=0 AND hamlet_id IN (${in_(want)}) ORDER BY date DESC LIMIT 60`, ...want).map((pl) => playlistOut(u, pl, rel)));
  });
  router.post('/playlists', requires('ops', 'agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user, b = req.body || {};
    if (!ORGANISERS.includes(u.role)) throw httpError(403, 'Your role cannot build playlists');
    const hid = S(b.hamlet_id, 64);
    if (!brain.hamlets.get(hid)) throw httpError(400, 'Choose a hamlet');
    if (!servedHamlets(u).includes(hid)) throw httpError(403, 'Your agency does not serve this hamlet');
    if (!brain.modules.enabledIn(hid)) throw httpError(409, 'The community has switched this service off in this hamlet');
    const date = isDate(S(b.date, 10)) ? S(b.date, 10) : today();
    const ids = [...new Set((Array.isArray(b.items) ? b.items : []).map((x) => S(x, 64)).filter(Boolean))];
    if (!ids.length) throw httpError(400, 'Add at least one clip');
    if (ids.length > MAX_PLAYLIST) throw httpError(400, `At most ${MAX_PLAYLIST} clips in one running order`);
    const rel = relHamlets(u);
    let stories = 0;
    for (const id of ids) {
      const c = loadClip(id);
      if (!c || !canListen(u, c, rel) || !(c.hamlet_ids || []).includes(hid)) throw httpError(400, 'Only published clips meant for this hamlet can go in its playlist');
      if (STORY_KINDS.includes(c.kind)) stories++;
    }
    if (stories > 1) throw httpError(400, 'Keep to one story or song per visit — bulletins and announcements first.');
    const ex = sqlOne('SELECT id FROM voice_playlists WHERE deleted=0 AND hamlet_id=? AND date=? AND agency_id=?', hid, date, u.agency_id);
    const row = data.put('voice_playlists', { ...(ex ? { id: ex.id } : {}), hamlet_id: hid, agency_id: u.agency_id, date, title: S(b.title, 120) || 'Visit-day radio', title_ml: S(b.title_ml, 160) || 'സന്ദർശന ദിവസ റേഡിയോ', items: ids, status: 'ready', notes: S(b.notes, 500) || null, built_by: u.id, built_by_name: u.display_name }, u);
    res.json(playlistOut(u, row, rel));
  });

  // ---------- gatherings ----------
  const N = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, 5000) : 0; };
  function gatheringOut(u, g) {
    const hm = hamletMap();
    const k = GATHERING_KINDS[g.kind] || {};
    const total = GROUPS.reduce((t, x) => t + (Number(g[x]) || 0), 0);
    return { id: g.id, hamlet_id: g.hamlet_id, hamlet: hm[g.hamlet_id] && hm[g.hamlet_id].name, hamlet_ml: hm[g.hamlet_id] && hm[g.hamlet_id].name_ml, date: g.date, time: g.time, kind: g.kind, kind_label: k.label, kind_label_ml: k.label_ml, icon: k.icon,
      title: g.title, title_ml: g.title_ml, showing: g.showing, licence_note: g.licence_note, venue: g.venue, status: g.status,
      attendance: { children: g.children || 0, youth: g.youth || 0, adults: g.adults || 0, elders: g.elders || 0, women: g.women || 0, total },
      feedback: g.feedback, feedback_ml: g.feedback_ml, meeting_id: g.meeting_id || null, organised_by_name: g.organised_by_name, is_demo: Number(g.is_demo) === 1,
      can_edit: ORGANISERS.includes(u.role) && servedHamlets(u).includes(g.hamlet_id) && (u.role === 'platform_admin' || g.agency_id === u.agency_id) };
  }
  router.get('/gatherings', authed, (req, res) => {
    const u = req.user;
    if (EXTERNAL.includes(u.role)) return res.json([]);
    const rel = relHamlets(u).filter((h) => brain.modules.enabledIn(h));
    const hid = S(req.query.hamlet_id, 64);
    const want = hid ? [hid].filter((h) => rel.includes(h)) : rel;
    if (!want.length) return res.json([]);
    res.json(sql(`SELECT * FROM voice_gatherings WHERE deleted=0 AND hamlet_id IN (${in_(want)}) ORDER BY date DESC LIMIT 200`, ...want).map((g) => gatheringOut(u, g)));
  });
  function gatheringFields(b, existing) {
    const kind = b.kind !== undefined ? S(b.kind, 30) : existing && existing.kind;
    if (!GATHERING_KINDS[kind]) throw httpError(400, 'Choose the kind of gathering');
    const title = S(b.title ?? (existing && existing.title), 160);
    if (title.length < 3) throw httpError(400, 'Give the gathering a title');
    const date = S(b.date ?? (existing && existing.date), 10);
    if (!isDate(date)) throw httpError(400, 'Date must be YYYY-MM-DD');
    const showing = S(b.showing ?? (existing && existing.showing), 300);
    if (['film', 'educational_show'].includes(kind) && showing.length < 2) throw httpError(400, 'Say what will be shown');
    const licence_note = S(b.licence_note ?? (existing && existing.licence_note), 500);
    if (licence_note.length < 5) throw Object.assign(httpError(400, 'Write down the permission or licence that allows the centre to show this (e.g. "our own recording", "free community-screening licence from …", "written permission from …"). Required for every gathering.'), { code: 'licence_required' });
    const patch = { kind, title, title_ml: S(b.title_ml ?? (existing && existing.title_ml), 200) || null, date, time: S(b.time ?? (existing && existing.time), 10) || '18:00', showing: showing || null, licence_note, venue: S(b.venue ?? (existing && existing.venue), 160) || null };
    if (['scheduled', 'held', 'postponed', 'cancelled'].includes(b.status)) patch.status = b.status;
    for (const x of [...GROUPS, 'women']) if (b[x] !== undefined) patch[x] = N(b[x]);
    if (patch.women !== undefined || GROUPS.some((x) => patch[x] !== undefined)) {
      const total = GROUPS.reduce((t, x) => t + (patch[x] !== undefined ? patch[x] : Number(existing && existing[x]) || 0), 0);
      const women = patch.women !== undefined ? patch.women : Number(existing && existing.women) || 0;
      if (women > total) throw httpError(400, 'Women counted cannot be more than everyone counted');
    }
    if (b.feedback !== undefined) patch.feedback = S(b.feedback, 2000) || null;
    if (b.feedback_ml !== undefined) patch.feedback_ml = S(b.feedback_ml, 2000) || null;
    return patch;
  }
  function checkMeeting(meetingId, hamletId) {
    const m = S(meetingId, 64);
    if (!m) return null;
    let ok = false;
    try { ok = !!sqlOne('SELECT 1 x FROM community_meetings WHERE id=? AND hamlet_id=? AND deleted=0', m, hamletId); } catch (_) { ok = false; }
    if (!ok) throw httpError(400, 'That Oorukoottam meeting was not found in this hamlet');
    return m;
  }
  router.post('/gatherings', requires('ops', 'agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user, b = req.body || {};
    if (!ORGANISERS.includes(u.role)) throw httpError(403, 'Your role cannot organise gatherings');
    const hid = S(b.hamlet_id, 64);
    if (!brain.hamlets.get(hid)) throw httpError(400, 'Choose a hamlet');
    if (!servedHamlets(u).includes(hid)) throw httpError(403, 'Your agency does not serve this hamlet');
    if (!brain.modules.enabledIn(hid)) throw httpError(409, 'The community has switched this service off in this hamlet');
    const row = data.put('voice_gatherings', { ...gatheringFields(b, null), status: ['held', 'scheduled'].includes(b.status) ? b.status : 'scheduled', hamlet_id: hid, agency_id: u.agency_id, meeting_id: checkMeeting(b.meeting_id, hid), organised_by: u.id, organised_by_name: u.display_name, is_demo: 0 }, u);
    if (row.status === 'held') emit('voice.gathering_held', { gathering_id: row.id, kind: row.kind }, u, hid);
    res.json(gatheringOut(u, row));
  });
  router.put('/gatherings/:id', requires('ops', 'agency.manage', 'hamlet.coordinate'), (req, res) => {
    const u = req.user;
    const g = data.get('voice_gatherings', req.params.id);
    if (!g) throw httpError(404, 'Gathering not found');
    if (!ORGANISERS.includes(u.role) || !servedHamlets(u).includes(g.hamlet_id) || (u.role !== 'platform_admin' && g.agency_id !== u.agency_id)) throw httpError(403, 'Only the organising agency can change this gathering');
    const b = req.body || {};
    const patch = { id: g.id, ...gatheringFields(b, g) };
    if (b.meeting_id !== undefined) patch.meeting_id = checkMeeting(b.meeting_id, g.hamlet_id);
    const row = data.put('voice_gatherings', patch, u);
    if (row.status === 'held' && g.status !== 'held') emit('voice.gathering_held', { gathering_id: row.id, kind: row.kind }, u, g.hamlet_id);
    res.json(gatheringOut(u, row));
  });

  // ---------- storage report ----------
  router.get('/storage', requires('ops', 'agency.manage', 'platform.manage'), (req, res) => res.json(storage()));

  // ---------- aggregates for donors and government (no names; k-anonymised; complementary suppression) ----------
  router.get('/aggregate', requires('analytics.aggregate'), (req, res) => {
    const u = req.user;
    const external = ['donor', 'govt_viewer'].includes(u.role);
    const allAgencies = STEWARDS.includes(u.role) || external;
    const days = external ? 180 : Math.min(365, Math.max(30, Number(req.query.days) || 180)); // fixed window for external viewers
    const since = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
    const agencyOk = (a) => allAgencies || a === u.agency_id;
    const clips = allClips().filter((c) => agencyOk(c.agency_id));
    const clipAg = Object.fromEntries(clips.map((c) => [c.id, c]));
    const gatherings = sql("SELECT hamlet_id, agency_id, kind, status, date, children, youth, adults, elders, women FROM voice_gatherings WHERE deleted=0 AND status='held' AND date>=?", since).filter((g) => agencyOk(g.agency_id));
    const plays = sql('SELECT clip_id, hamlet_id, SUM(plays) n FROM voice_plays WHERE deleted=0 AND day>=? GROUP BY clip_id, hamlet_id', since).filter((p) => clipAg[p.clip_id]);
    const hm = hamletMap();
    const rows = new Map();
    const row = (h) => { if (!rows.has(h)) rows.set(h, { hamlet_id: h, clips_published: 0, oral_histories: 0, plays: 0, gatherings: 0, children: 0, youth: 0, adults: 0, elders: 0, women: 0 }); return rows.get(h); };
    for (const c of clips) {
      if (c.status !== 'published' || c.withdrawn_at || String(c.published_at || '').slice(0, 10) < since) continue;
      for (const h of c.hamlet_ids || []) { row(h).clips_published++; if (c.kind === 'oral_history') row(h).oral_histories++; }
    }
    for (const p of plays) row(p.hamlet_id).plays += Number(p.n) || 0;
    for (const g of gatherings) { const r = row(g.hamlet_id); r.gatherings++; for (const x of [...GROUPS, 'women']) r[x] += Number(g[x]) || 0; }
    const sup = (n) => brain.policy.suppress(n, u);
    const hidden = (v) => typeof v === 'string';
    const out = [...rows.values()].map((r) => {
      const o = { hamlet: hm[r.hamlet_id] ? hm[r.hamlet_id].name : null, hamlet_ml: hm[r.hamlet_id] ? hm[r.hamlet_id].name_ml : null, clips_published: r.clips_published, oral_histories: r.oral_histories, gatherings: r.gatherings, plays: sup(r.plays) };
      for (const x of [...GROUPS, 'women']) o[x] = sup(r[x]);
      const tot = GROUPS.reduce((t, x) => t + r[x], 0);
      // complementary suppression: one hidden group would otherwise be total − the others
      o.attendance = GROUPS.some((x) => hidden(o[x])) ? 'hidden' : sup(tot);
      o.suppressed = [...GROUPS, 'women', 'plays'].some((x) => hidden(o[x]));
      return o;
    }).sort((a, b) => String(a.hamlet).localeCompare(String(b.hamlet)));
    const totals = { clips_published: out.reduce((t, r) => t + r.clips_published, 0), oral_histories: out.reduce((t, r) => t + r.oral_histories, 0), gatherings: out.reduce((t, r) => t + r.gatherings, 0) };
    for (const x of [...GROUPS, 'women', 'plays']) {
      // a column total is shown only if no hamlet cell in it is hidden (else it could be subtracted back)
      totals[x] = out.some((r) => hidden(r[x])) ? 'hidden' : sup([...rows.values()].reduce((t, r) => t + r[x], 0));
    }
    const grand = [...rows.values()].reduce((t, r) => t + GROUPS.reduce((s, x) => s + r[x], 0), 0);
    totals.attendance = (out.some((r) => hidden(r.attendance)) || GROUPS.some((x) => hidden(totals[x]))) ? 'hidden' : sup(grand);
    const byKind = Object.keys(GATHERING_KINDS).map((k) => ({ kind: k, label: GATHERING_KINDS[k].label, label_ml: GATHERING_KINDS[k].label_ml, gatherings: gatherings.filter((g) => g.kind === k).length }));
    res.json({ since, days, scope: allAgencies ? 'all agencies' : 'your agency', k_anon: 5, by_hamlet: out, totals, gatherings_by_kind: byKind, note: 'Plays are counted per clip and hamlet only — never per person. Cells under 5 are shown as "<5"; totals that would reveal them are "hidden".' });
  });

  // ---------- demo seed ----------
  async function seed(demo) {
    const R = demo.rng(9901); // own stream — never demo.R
    const { store, brain: B } = demo;
    const H = demo.hamletByKey, A = demo.agencyByKey;
    if (!H.h1 || !H.h2 || !H.h11 || !A.kyg) return;
    const now = Date.now();
    const ago = (d) => new Date(now - d * 86400e3).toISOString();
    const day = (d) => ago(d).slice(0, 10);
    const runner = { [H.h1.id]: A.cif, [H.h2.id]: A.cif, [H.h11.id]: A.kyg };
    const urow = (u) => B.store.get('users', u.id);
    const fac = { [H.h1.id]: urow(demo.users.facilitator), [H.h2.id]: urow(demo.users.facilitator2), [H.h11.id]: urow(demo.users['aadi.facilitator']) };
    const reviewer = { [H.h1.id]: urow(demo.users['cif.admin']), [H.h2.id]: urow(demo.users.teacher), [H.h11.id]: urow(demo.users['aadi.lead']) };
    let reporter;
    const progs = {};
    tx(() => {
      // Programmes: track `voice` run by CIF (h1, h2) and the Komalikudi Youth Group (h11, CIF-sponsored).
      for (const h of [H.h1, H.h2, H.h11]) {
        const ag = runner[h.id];
        progs[h.id] = B.store.put('programmes', { agency_id: ag.id, hamlet_id: h.id, module: 'voice', track: 'voice', title: 'Hamlet Radio & Gatherings', title_ml: 'ഊര് റേഡിയോ, കൂട്ടായ്മകൾ', ...(ag.id === A.kyg.id ? { brand: 'AADI Smart Learning Centre', brand_ml: 'ആദി സ്മാർട്ട് ലേണിംഗ് സെന്റർ', sponsor_agency_id: A.cif.id } : {}), schedule: ['Visit day (weekly)'], capacity: 200, status: 'active' });
      }
      // Youth reporter — a volunteer staff login of the youth group, NOT linked to any person record.
      reporter = B.createUser({ username: 'demo.reporter', password: demo.DEMO_PASSWORD, role: 'mentor', agency_id: A.kyg.id, hamlet_ids: [H.h11.id], display_name: 'Youth reporter (volunteer) — Komalikudi Youth Group', safeguarding_trained: 1 }, null);
    });

    // Speakers: fictional adults who already consented (profile) to the running agency; enrol them in the radio programme.
    const speakers = {};
    for (const h of [H.h1, H.h2, H.h11]) {
      const ag = runner[h.id];
      let cand = demo.adults.filter((p) => p.hamlet_id === h.id && B.policy.activeConsent(p.id, ag.id, 'profile'));
      if (cand.length < 2) {
        // make sure every hamlet has story-tellers with recorded agreement (fictional people)
        for (const p of demo.adults.filter((x) => x.hamlet_id === h.id && !cand.includes(x)).slice(0, 2 - cand.length)) {
          const cur = store.find('consents', { person_id: p.id, agency_id: ag.id, status: 'active' })[0];
          B.grantConsent({ person_id: p.id, agency_id: ag.id, scopes: [...new Set([...(cur && Array.isArray(cur.scopes) ? cur.scopes : []), 'profile'])], granted_by: p.id, relation: 'self', method: 'in_person' }, null);
          cand.push(p);
        }
      }
      cand = cand.slice(0, 4);
      tx(() => { for (const p of cand) { try { B.enrol(p.id, progs[h.id].id, null); } catch (_) { /* consent missing — skip */ } } });
      speakers[h.id] = cand.filter((p) => B.policy.canSee(fac[h.id], p.id, 'profile').ok);
    }

    const LANG = { [H.h1.id]: 'Muthuvan', [H.h2.id]: 'Irula', [H.h11.id]: 'Muthuvan' };
    const CLIPS = [
      ['bulletin', 'Visit-day news: ration shop timings and the new bus stop', 'സന്ദർശന ദിന വാർത്ത: റേഷൻ കട സമയം, പുതിയ ബസ് സ്റ്റോപ്പ്', 'This week the ration shop opens on Tuesday and Friday mornings. The new bus stop near the school is ready. (demo bulletin)', 'ഈ ആഴ്ച റേഷൻ കട ചൊവ്വ, വെള്ളി രാവിലെ തുറക്കും. സ്കൂളിനടുത്ത് പുതിയ ബസ് സ്റ്റോപ്പ് തയ്യാർ. (ഡെമോ)'],
      ['bulletin', 'Youth news: football practice and the PSC study circle', 'യുവജന വാർത്ത: ഫുട്ബോൾ പരിശീലനം, PSC പഠനക്കൂട്ടം', 'Football practice is on Saturday evening at the ground. The PSC study circle meets at the centre after the visit. (demo bulletin)', 'ശനിയാഴ്ച വൈകിട്ട് മൈതാനത്ത് ഫുട്ബോൾ പരിശീലനം. സന്ദർശനത്തിന് ശേഷം സെന്ററിൽ PSC പഠനക്കൂട്ടം. (ഡെമോ)'],
      ['announcement', 'Scholarship forms: bring your documents on visit day', 'സ്കോളർഷിപ്പ് അപേക്ഷ: സന്ദർശന ദിവസം രേഖകൾ കൊണ്ടുവരിക', 'Families with school children: bring the ration card and bank passbook. The facilitator will help fill the forms. (demo announcement)', 'സ്കൂൾ കുട്ടികളുള്ള കുടുംബങ്ങൾ: റേഷൻ കാർഡും ബാങ്ക് പാസ്ബുക്കും കൊണ്ടുവരിക. ഫോം പൂരിപ്പിക്കാൻ ഫെസിലിറ്റേറ്റർ സഹായിക്കും. (ഡെമോ)'],
      ['announcement', 'Film night at the centre this Saturday', 'ഈ ശനിയാഴ്ച സെന്ററിൽ സിനിമാ രാത്രി', 'A film for children and families at seven in the evening. Bring a mat. (demo announcement)', 'വൈകിട്ട് ഏഴിന് കുട്ടികൾക്കും കുടുംബങ്ങൾക്കും സിനിമ. പായ കൊണ്ടുവരിക. (ഡെമോ)'],
      ['song', 'Harvest song sung by the youth group', 'യുവജനക്കൂട്ടം പാടിയ കൊയ്ത്തുപാട്ട്', 'A short harvest song. (DEMO — synthetic tone stands in for the singing)', 'ചെറിയ കൊയ്ത്തുപാട്ട്. (ഡെമോ)'],
      ['oral_history', 'How our grandparents found the honey trees', 'നമ്മുടെ മുത്തശ്ശന്മാർ തേൻമരങ്ങൾ കണ്ടെത്തിയ വിധം', 'An elder remembers going into the forest before dawn to find honey trees, and the rules for sharing the honey. (fictional demo story)', 'തേൻമരങ്ങൾ കണ്ടെത്താൻ പുലർച്ചെ കാട്ടിൽ പോയതും തേൻ പങ്കിടുന്ന നിയമങ്ങളും ഒരു മൂപ്പൻ ഓർക്കുന്നു. (സാങ്കൽപ്പിക ഡെമോ കഥ)'],
      ['oral_history', 'The year the river changed its course', 'പുഴ വഴിമാറിയ വർഷം', 'An elder tells how the hamlet moved its fields after a great flood, long ago. (fictional demo story)', 'പണ്ടൊരു വലിയ വെള്ളപ്പൊക്കത്തിന് ശേഷം ഊര് കൃഷിയിടങ്ങൾ മാറ്റിയത് ഒരു മൂപ്പൻ പറയുന്നു. (സാങ്കൽപ്പിക ഡെമോ കഥ)'],
      ['bulletin', 'Health camp reminder (no personal details)', 'ആരോഗ്യ ക്യാമ്പ് ഓർമ്മപ്പെടുത്തൽ', 'A health camp will be held at the centre next month. Everyone is welcome. (demo bulletin)', 'അടുത്ത മാസം സെന്ററിൽ ആരോഗ്യ ക്യാമ്പ്. എല്ലാവർക്കും സ്വാഗതം. (ഡെമോ)'],
    ];
    const made = { [H.h1.id]: [], [H.h2.id]: [], [H.h11.id]: [] };
    tx(() => {
      for (const h of [H.h1, H.h2, H.h11]) {
        const ag = runner[h.id];
        const rec = h.id === H.h11.id ? [fac[h.id], urow(reporter)] : [fac[h.id]];
        CLIPS.forEach(([kind, title, title_ml, transcript, transcript_ml], i) => {
          const d = R.int(4, 150);
          const secs = 1.2 + R.rnd() * 2;
          const audio = syntheticWav(secs, [R.pick([392, 440, 523.25]), R.pick([587.33, 659.25, 698.46])]);
          const v = validateAudio(audio);
          const sp = kind === 'oral_history' ? speakers[h.id][i % Math.max(1, speakers[h.id].length)] : null;
          if (kind === 'oral_history' && !sp) return;
          const singer = kind === 'song' ? speakers[h.id].find((p) => p !== sp) : null;
          // last two of the list stay in the review queue (h1, h11) so the queue has work
          let status = 'published';
          if (i === CLIPS.length - 1 && h.id !== H.h2.id) status = 'draft';
          if (i === 1 && h.id === H.h11.id) status = 'reviewed';
          const by = R.pick(rec);
          const row = data.put('voice_clips', {
            kind, agency_id: ag.id, hamlet_ids: [h.id], hamlet_id: h.id, language: kind === 'announcement' ? 'Malayalam' : LANG[h.id],
            title, title_ml, transcript: `[${DEMO_TAG}] ${transcript}`, transcript_ml: `[ഡെമോ ശബ്ദം — യഥാർത്ഥ റെക്കോർഡിംഗ് അല്ല] ${transcript_ml}`,
            audio, mime: v.mime, bytes: v.bytes, duration_s: v.duration_s, duration_source: 'measured',
            status, licence: kind === 'oral_history' ? (i === 6 ? 'cc_by_nc' : 'community') : (kind === 'announcement' ? 'public' : 'community'),
            licence_chosen_by: kind === 'oral_history' ? 'speaker' : 'recorder', speaker_person_id: sp ? sp.id : null,
            credit_as: sp ? `${String(sp.name).split(' ')[0]}, ${h.name}` : (kind === 'song' ? 'Youth group' : null),
            featured_person_ids: singer ? [singer.id] : [], no_identifiable: sp || singer ? 0 : 1,
            recorded_by: by.id, recorded_by_name: by.display_name, recorded_at: ago(d + 2),
            reviewed_by: status !== 'draft' ? reviewer[h.id].id : null, reviewed_by_name: status !== 'draft' ? reviewer[h.id].display_name : null, reviewed_at: status !== 'draft' ? ago(d + 1) : null,
            published_at: status === 'published' ? ago(d) : null, is_demo: 1,
          }, by);
          made[h.id].push(row);
        });
      }
      // one oral history the speaker took back (audio removed) — shows withdrawal in the demo
      const h1Story = made[H.h1.id].find((c) => c.kind === 'oral_history' && c.status === 'published' && c.licence === 'community');
      if (h1Story && made[H.h1.id].filter((c) => c.kind === 'oral_history').length > 1) {
        const other = made[H.h1.id].filter((c) => c.kind === 'oral_history' && c.id !== h1Story.id)[0];
        withdrawClip(other, { via: 'in_person', reason: 'Speaker asked at the centre (demo)', by: fac[H.h1.id].id, at: ago(3), user: fac[H.h1.id] });
      }
      // playlists: today plus the last few visit days
      for (const h of [H.h1, H.h2, H.h11]) {
        const pub = made[h.id].map((c) => data.get('voice_clips', c.id)).filter((c) => c && c.status === 'published');
        const news = pub.filter((c) => !STORY_KINDS.includes(c.kind));
        const stories = pub.filter((c) => STORY_KINDS.includes(c.kind));
        for (const d of [0, 7, 14, 21]) {
          const items = [...R.sample(news, Math.min(3, news.length)).map((c) => c.id), ...(stories.length ? [R.pick(stories).id] : [])];
          if (!items.length) continue;
          data.put('voice_playlists', { hamlet_id: h.id, agency_id: runner[h.id].id, date: day(d), title: d === 0 ? 'This visit day' : 'Visit day', title_ml: 'സന്ദർശന ദിവസം', items, status: d === 0 ? 'ready' : 'played', built_by: fac[h.id].id, built_by_name: fac[h.id].display_name }, fac[h.id]);
        }
        // plays: per clip per hamlet per visit day — counts only
        for (const c of pub) {
          for (let w = 0; w < 10; w++) {
            const dd = 2 + w * 7;
            if (String(c.published_at).slice(0, 10) > day(dd)) continue;
            addPlays(c.id, h.id, 'hub', R.int(1, 3), day(dd), null);
            if (R.chance(0.7)) addPlays(c.id, h.id, 'phone', R.int(1, 9), day(dd), null);
          }
        }
      }
      // gatherings with attendance (fictional titles; licence notes are demo entries for the centre to verify)
      const G = [
        [H.h1, 'film', 'Film night: "The Honey Gatherers" (demo title)', 'സിനിമാ രാത്രി: "തേൻ ശേഖരിക്കുന്നവർ" (ഡെമോ)', 'Children\'s nature film (fictional title)', 'DEMO ENTRY — free community-screening licence from the film-maker (to be verified by the centre)', 40, [30, 14, 22, 9, 31]],
        [H.h1, 'sports', 'Inter-hamlet football match', 'ഊരുകൾ തമ്മിലുള്ള ഫുട്ബോൾ മത്സരം', null, 'Nothing screened — sports only', 75, [25, 30, 18, 6, 21]],
        [H.h1, 'educational_show', 'Show: keeping our water clean', 'പരിപാടി: വെള്ളം ശുദ്ധമായി സൂക്ഷിക്കാം', 'Slides and a short talk made by the CIF team', 'Our own material (CIF) — free to show', 110, [22, 11, 27, 12, 35]],
        [H.h2, 'celebration', 'Harvest celebration evening', 'കൊയ്ത്തുത്സവ സന്ധ്യ', 'Songs recorded by the youth group (hamlet radio)', 'Our own recordings — community licence, shown in this hamlet only', 30, [18, 9, 12, 3, 16]],
        [H.h11, 'film', 'Film night: "River School" (demo title)', 'സിനിമാ രാത്രി: "പുഴയോരത്തെ സ്കൂൾ" (ഡെമോ)', 'Short film on going to school (fictional title)', 'DEMO ENTRY — written permission from the distributor (to be verified by the youth group)', 20, [35, 16, 20, 7, 29]],
        [H.h11, 'sports', 'Youth group volleyball tournament', 'യുവജനക്കൂട്ടം വോളിബോൾ ടൂർണമെന്റ്', null, 'Nothing screened — sports only', 60, [12, 34, 15, 5, 19]],
        [H.h11, 'educational_show', 'Show: using a smartphone safely', 'പരിപാടി: സ്മാർട്ട്ഫോൺ സുരക്ഷിതമായി', 'Slides made by the AADI facilitator', 'Our own material — free to show', 130, [10, 28, 14, 6, 22]],
      ];
      for (const [h, kind, title, title_ml, showing, licence_note, d, [children, youth, adults, elders, women]] of G) {
        const org = fac[h.id];
        data.put('voice_gatherings', { hamlet_id: h.id, agency_id: runner[h.id].id, date: day(d), time: kind === 'sports' ? '16:00' : '19:00', kind, title, title_ml, showing, licence_note, venue: 'Centre ground', status: 'held', children, youth, adults, elders, women, feedback: R.pick(['Families asked for another evening soon.', 'Children loved it; elders asked for a story in our language next time.', 'Good turnout; speaker volume was low at the back.']), organised_by: org.id, organised_by_name: org.display_name, is_demo: 1 }, org);
      }
      // upcoming
      for (const h of [H.h1, H.h11]) data.put('voice_gatherings', { hamlet_id: h.id, agency_id: runner[h.id].id, date: new Date(now + 5 * 86400e3).toISOString().slice(0, 10), time: '19:00', kind: 'film', title: 'Film night (demo)', title_ml: 'സിനിമാ രാത്രി (ഡെമോ)', showing: 'To be chosen with the youth group', licence_note: 'DEMO ENTRY — only a film the centre has permission to show', venue: 'Centre', status: 'scheduled', organised_by: fac[h.id].id, organised_by_name: fac[h.id].display_name, is_demo: 1 }, fac[h.id]);
    });
  }

  return {
    seed,
    health: () => {
      const st = storage();
      const r = sqlOne("SELECT SUM(status='published') pub, SUM(status IN ('draft','reviewed')) pending, SUM(status='withdrawn') wd FROM voice_clips WHERE deleted=0");
      return { clips_published: r.pub || 0, clips_pending: r.pending || 0, clips_withdrawn: r.wd || 0, audio_mb: st.audio_mb, budget_storage_mb: st.budget_storage_mb, gatherings: sqlOne('SELECT COUNT(*) n FROM voice_gatherings WHERE deleted=0').n };
    },
  };
};
