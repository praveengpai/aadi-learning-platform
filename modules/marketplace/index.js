'use strict';
// AADI — Marketplace module: volunteers, donors / sponsors, employers, CSR reporting.
// Privacy rules enforced here:
//  * donors never receive person ids or names — only anonymised sponsorship cards and k-anonymous aggregates
//  * employers see only ADULTS who granted `employment` consent to the employer's agency
//  * jobs must pass the fair-work checklist before they are shown to youth

const STEWARDS = ['platform_admin', 'cpo'];
const VOL_CHECKS = ['id_verified', 'police_clearance', 'references', 'safeguarding'];
const APP_FLOW = { applied: ['shortlisted', 'rejected', 'withdrawn'], shortlisted: ['interview', 'rejected', 'withdrawn'], interview: ['offered', 'rejected', 'withdrawn'], offered: ['hired', 'rejected', 'withdrawn'], hired: [], rejected: [], withdrawn: [] };
const FAIR_WORK = ['written_offer', 'min_wage', 'accommodation_safe', 'no_document_retention'];
// DEMO wage floor (₹/month). Real deployments must use the notified Kerala minimum wage for the sector.
const WAGE_FLOOR = 12000;
const CIF = { name: 'Community Innovations Foundation', kind: 'Section 8 company (not-for-profit)', pan: 'AAxCx0000X (DEMO)', reg_80g: 'DEMO/80G/2026/0001', address: 'Kochi, Kerala', note: 'DEMO receipt — not valid for tax purposes. Payment gateway not connected.' };

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
  const S = (v, max = 2000) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim());
  const agencyMap = () => Object.fromEntries(brain.agencies.list().map((a) => [a.id, a]));
  const hamletMap = () => Object.fromEntries(brain.hamlets.list().map((h) => [h.id, h]));
  const isSteward = (u) => STEWARDS.includes(u.role);
  const isStewardAgencyAdmin = (u) => u.role === 'agency_admin' && !!brain.agencies.get(u.agency_id)?.steward;
  const ageOf = (p) => (p && p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 3.15576e10) : null);
  const ageBand = (a) => (a == null ? 'unknown' : a < 9 ? '6–8' : a < 12 ? '9–11' : a < 15 ? '12–14' : a < 18 ? '15–17' : a < 22 ? '18–21' : '22+');
  const fy = (d = new Date()) => { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };

  // ======================================================================
  // VOLUNTEERS
  // ======================================================================
  const volScope = (u) => (isSteward(u) ? {} : u.role === 'mentor' ? { user_id: u.id } : { agency_id: u.agency_id });
  function volOut(v) {
    const hours = sqlOne('SELECT COALESCE(SUM(hours),0) h, COUNT(*) n FROM marketplace_shifts WHERE volunteer_id=? AND deleted=0 AND status=\'verified\'', v.id);
    const pending = sqlOne('SELECT COALESCE(SUM(hours),0) h FROM marketplace_shifts WHERE volunteer_id=? AND deleted=0 AND status=\'completed\'', v.id).h;
    const checks = v.checks || {};
    return { ...v, checks, checks_done: VOL_CHECKS.filter((c) => checks[c] && checks[c].done).length, checks_total: VOL_CHECKS.length, hours_verified: hours.h, sessions_verified: hours.n, hours_pending: pending, agency_name: brain.agencies.get(v.agency_id)?.name };
  }
  function loadVol(u, id) {
    const v = data.get('marketplace_volunteers', id);
    if (!v) throw httpError(404, 'Volunteer not found');
    if (!isSteward(u) && !(u.role === 'mentor' && v.user_id === u.id) && v.agency_id !== u.agency_id) throw httpError(404, 'Volunteer not found');
    return v;
  }

  // Public application form (no sign-in needed — volunteers do not have accounts yet).
  router.post('/volunteers/apply', (req, res) => {
    const b = req.body || {};
    const name = S(b.name, 120), phone = S(b.phone, 20);
    if (!name || !/^[0-9+ -]{8,16}$/.test(phone)) throw httpError(400, 'Name and a valid phone number are required');
    const ag = b.agency_id && brain.agencies.get(b.agency_id) ? b.agency_id : brain.agencies.list().find((a) => a.steward)?.id;
    const v = data.put('marketplace_volunteers', { name, phone, email: S(b.email, 120), city: S(b.city, 80), agency_id: ag, hamlet_ids: [], skills: (Array.isArray(b.skills) ? b.skills : S(b.skills).split(',')).map((s) => S(s, 40)).filter(Boolean).slice(0, 10), languages: (Array.isArray(b.languages) ? b.languages : S(b.languages).split(',')).map((s) => S(s, 30)).filter(Boolean).slice(0, 6), availability: S(b.availability, 200), motivation: S(b.motivation, 1000), status: 'applied', checks: {}, applied_at: now(), certificates: [] }, null);
    emit('marketplace.volunteer_applied', { volunteer_id: v.id, agency_id: ag }, null);
    res.json({ ok: true, id: v.id, message: 'Thank you! The team will call you for an ID check, police clearance and references.' });
  });

  router.get('/volunteers', requires('agency.manage', 'hamlet.coordinate', 'safeguard', 'mentor'), (req, res) => {
    const w = volScope(req.user);
    if (req.query.status) w.status = req.query.status;
    res.json(data.find('marketplace_volunteers', w, { order: 'applied_at DESC' }).map(volOut));
  });
  router.get('/volunteers/:id', requires('agency.manage', 'hamlet.coordinate', 'safeguard', 'mentor'), (req, res) => {
    const v = loadVol(req.user, req.params.id);
    const shifts = data.find('marketplace_shifts', { volunteer_id: v.id }, { order: 'date DESC' });
    const progs = Object.fromEntries(brain.programmes.list({}).map((p) => [p.id, p]));
    const hm = hamletMap();
    res.json({ ...volOut(v), shifts: shifts.map((s) => ({ ...s, programme_title: progs[s.programme_id]?.title, hamlet_name: hm[s.hamlet_id]?.name })) });
  });
  router.post('/volunteers', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const b = req.body;
    if (!S(b.name)) throw httpError(400, 'Name required');
    const v = data.put('marketplace_volunteers', { name: S(b.name, 120), phone: S(b.phone, 20), email: S(b.email, 120), city: S(b.city, 80), agency_id: isSteward(req.user) && b.agency_id ? b.agency_id : req.user.agency_id, hamlet_ids: Array.isArray(b.hamlet_ids) ? b.hamlet_ids : [], skills: (Array.isArray(b.skills) ? b.skills : S(b.skills).split(',')).map((s) => S(s, 40)).filter(Boolean), languages: (Array.isArray(b.languages) ? b.languages : S(b.languages).split(',')).map((s) => S(s, 30)).filter(Boolean), availability: S(b.availability, 200), motivation: S(b.motivation, 1000), status: 'applied', checks: {}, applied_at: now(), certificates: [] }, req.user);
    emit('marketplace.volunteer_applied', { volunteer_id: v.id, agency_id: v.agency_id }, req.user);
    res.json(volOut(v));
  });
  router.post('/volunteers/:id/check', requires('agency.manage', 'hamlet.coordinate', 'safeguard'), (req, res) => {
    const v = loadVol(req.user, req.params.id);
    const { check, done = true, note } = req.body;
    if (!VOL_CHECKS.includes(check)) throw httpError(400, 'Unknown check');
    if (['approved', 'rejected'].includes(v.status) && done) throw httpError(409, 'Already ' + v.status);
    const checks = { ...(v.checks || {}), [check]: { done: !!done, by: req.user.display_name, at: now(), note: S(note, 300) } };
    const status = v.status === 'applied' ? 'screening' : v.status;
    res.json(volOut(data.put('marketplace_volunteers', { id: v.id, checks, status }, req.user)));
  });
  router.post('/volunteers/:id/decision', requires('agency.manage', 'safeguard'), (req, res) => {
    const v = loadVol(req.user, req.params.id);
    const d = req.body.decision;
    if (!['approve', 'reject', 'suspend'].includes(d)) throw httpError(400, 'decision must be approve | reject | suspend');
    if (d === 'approve') {
      const missing = VOL_CHECKS.filter((c) => !(v.checks && v.checks[c] && v.checks[c].done));
      if (missing.length) throw httpError(409, 'Background check incomplete: ' + missing.join(', '));
    }
    let account = null;
    const patch = { id: v.id, status: { approve: 'approved', reject: 'rejected', suspend: 'suspended' }[d], check_notes: S(req.body.note, 500) || v.check_notes };
    if (d === 'approve') {
      patch.approved_at = now(); patch.approved_by = req.user.display_name;
      if (req.body.create_account && !v.user_id) {
        const username = ('vol.' + v.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') + '.' + v.id.slice(-4)).slice(0, 40);
        const password = Math.random().toString(36).slice(2, 10);
        const u = brain.users.create({ username, password, role: 'mentor', agency_id: v.agency_id, display_name: v.name + ' — Volunteer', safeguarding_trained: 1, active: 1, hamlet_ids: v.hamlet_ids || [] }, req.user);
        patch.user_id = u.id;
        account = { username, password, note: 'Share this once, in person. Ask the volunteer to change it.' };
      }
      emit('marketplace.volunteer_approved', { volunteer_id: v.id, agency_id: v.agency_id }, req.user);
    }
    brain.audit(req.user, 'volunteer.' + d, v.id, { note: patch.check_notes });
    res.json({ ...volOut(data.put('marketplace_volunteers', patch, req.user)), account });
  });
  router.post('/volunteers/:id/shifts', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const v = loadVol(req.user, req.params.id);
    if (v.status !== 'approved') throw httpError(409, 'Only approved volunteers (all background checks done) can be scheduled with learners');
    const pr = brain.programmes.get(req.body.programme_id);
    if (!pr) throw httpError(400, 'Choose a programme');
    if (!isSteward(req.user) && pr.agency_id !== req.user.agency_id) throw httpError(403, 'You can schedule volunteers only into your own agency\'s programmes');
    const s = data.put('marketplace_shifts', { volunteer_id: v.id, programme_id: pr.id, agency_id: pr.agency_id, hamlet_id: pr.hamlet_id, date: S(req.body.date, 10) || now().slice(0, 10), slot: S(req.body.slot, 30) || (Array.isArray(pr.schedule) ? pr.schedule[0] : ''), role: S(req.body.role, 80) || 'Session support', hours: 0, status: 'scheduled' }, req.user);
    res.json(s);
  });
  router.post('/shifts/:id/log', requires('agency.manage', 'hamlet.coordinate', 'mentor'), (req, res) => {
    const s = data.get('marketplace_shifts', req.params.id);
    if (!s) throw httpError(404, 'Not found');
    const v = loadVol(req.user, s.volunteer_id);
    const hours = Number(req.body.hours);
    if (!(hours > 0 && hours <= 12)) throw httpError(400, 'Hours must be between 0 and 12');
    if (s.status === 'verified') throw httpError(409, 'Already verified');
    res.json(data.put('marketplace_shifts', { id: s.id, hours, status: 'completed', logged_by: req.user.display_name, note: S(req.body.note, 300), volunteer_id: v.id }, req.user));
  });
  router.post('/shifts/:id/verify', requires('agency.manage', 'hamlet.coordinate'), (req, res) => {
    const s = data.get('marketplace_shifts', req.params.id);
    if (!s) throw httpError(404, 'Not found');
    loadVol(req.user, s.volunteer_id);
    if (s.status !== 'completed') throw httpError(409, 'Hours must be logged first');
    res.json(data.put('marketplace_shifts', { id: s.id, status: 'verified', verified_by: req.user.display_name }, req.user));
  });
  router.get('/volunteers/:id/certificate', requires('agency.manage', 'hamlet.coordinate', 'safeguard', 'mentor'), (req, res) => {
    const v = volOut(loadVol(req.user, req.params.id));
    if (v.status !== 'approved' && v.status !== 'suspended') throw httpError(409, 'Certificate available after approval');
    if (!v.hours_verified) throw httpError(409, 'No verified hours yet');
    const progs = sql('SELECT DISTINCT p.title, h.name hamlet FROM marketplace_shifts s JOIN programmes p ON p.id=s.programme_id JOIN hamlets h ON h.id=s.hamlet_id WHERE s.volunteer_id=? AND s.deleted=0 AND s.status=\'verified\'', v.id);
    const first = sqlOne('SELECT MIN(date) a, MAX(date) b FROM marketplace_shifts WHERE volunteer_id=? AND deleted=0 AND status=\'verified\'', v.id);
    res.json({ name: v.name, agency: v.agency_name, hours: v.hours_verified, sessions: v.sessions_verified, from: first.a, to: first.b, programmes: progs, code: 'VOL-' + v.id.slice(-8).toUpperCase(), issued_at: now().slice(0, 10), issuer: 'AADI Platform · ' + CIF.name });
  });

  // ======================================================================
  // DONORS & SPONSORSHIPS — only anonymised data leaves this section
  // ======================================================================
  function donorFor(u) {
    if (u.role !== 'donor') return null;
    let d = data.find('marketplace_donors', { user_id: u.id })[0];
    if (!d) d = data.put('marketplace_donors', { name: u.display_name, kind: 'csr', user_id: u.id, agency_id: u.agency_id, anonymous: 0, joined_at: now() }, u);
    return d;
  }
  const SPONSOR_FIELDS = ['id', 'kind', 'card', 'card_ml', 'hamlet_id', 'age_band', 'need', 'need_ml', 'target', 'raised', 'status', 'created_at', 'cohort_size'];
  function sponsorCard(s, hm, u) {
    const out = {};
    for (const k of SPONSOR_FIELDS) out[k] = s[k];
    const h = hm[s.hamlet_id];
    out.hamlet_name = h?.name; out.hamlet_name_ml = h?.name_ml; out.district = h?.district; out.community = h?.community;
    out.progress = s.target ? Math.min(1, (s.raised || 0) / s.target) : 0;
    if (s.cohort_size != null) out.cohort_size = brain.policy.suppress(s.cohort_size, u);
    return out; // NOTE: person_id / centre ids deliberately never included
  }
  router.get('/sponsorships', requires('donate', 'agency.manage', 'analytics.aggregate'), (req, res) => {
    const hm = hamletMap();
    const w = { status: 'open' };
    if (req.query.kind) w.kind = req.query.kind;
    if (req.query.all && !['donor'].includes(req.user.role)) delete w.status;
    res.json(data.find('marketplace_sponsorships', w, { order: 'created_at DESC' }).map((s) => sponsorCard(s, hm, req.user)));
  });

  router.get('/donor/me', requires('donate'), (req, res) => {
    const d = donorFor(req.user);
    const hm = hamletMap();
    if (!d) return res.json({ donor: null, pledges: [], donations: [] });
    const sp = Object.fromEntries(data.find('marketplace_sponsorships', {}).map((s) => [s.id, sponsorCard(s, hm, req.user)]));
    const pledges = data.find('marketplace_pledges', { donor_id: d.id }, { order: 'pledged_at DESC' }).map((p) => ({ id: p.id, amount: p.amount, frequency: p.frequency, status: p.status, pledged_at: p.pledged_at, sponsorship: sp[p.sponsorship_id] || null, paid: sqlOne('SELECT COALESCE(SUM(amount),0) s FROM marketplace_donations WHERE pledge_id=? AND deleted=0', p.id).s }));
    const donations = data.find('marketplace_donations', { donor_id: d.id }, { order: 'paid_at DESC' }).map((x) => ({ id: x.id, amount: x.amount, mode: x.mode, paid_at: x.paid_at, receipt_no: x.receipt_no, fy: x.fy, sponsorship: sp[x.sponsorship_id] || null }));
    res.json({ donor: { id: d.id, name: d.name, kind: d.kind, city: d.city, anonymous: d.anonymous }, pledges, donations, totals: { pledged: pledges.reduce((a, p) => a + (p.amount || 0), 0), given: donations.reduce((a, x) => a + (x.amount || 0), 0) } });
  });

  router.post('/pledges', requires('donate'), (req, res) => {
    const d = donorFor(req.user);
    if (!d) throw httpError(403, 'Only donor accounts can pledge');
    const s = data.get('marketplace_sponsorships', req.body.sponsorship_id);
    if (!s || s.status !== 'open') throw httpError(400, 'This sponsorship is not open');
    const amount = Math.round(Number(req.body.amount));
    if (!(amount >= 100 && amount <= 10000000)) throw httpError(400, 'Amount must be at least ₹100');
    const frequency = ['once', 'monthly', 'quarterly', 'yearly'].includes(req.body.frequency) ? req.body.frequency : 'once';
    const p = data.put('marketplace_pledges', { donor_id: d.id, sponsorship_id: s.id, hamlet_id: s.hamlet_id, amount, frequency, status: 'pledged', pledged_at: now(), note: S(req.body.note, 300) }, req.user);
    emit('marketplace.pledged', { pledge_id: p.id, kind: s.kind, amount }, req.user, s.hamlet_id);
    res.json({ id: p.id, amount, frequency, status: p.status });
  });

  let receiptSeq = null;
  const nextReceipt = () => {
    if (receiptSeq === null) receiptSeq = sqlOne('SELECT COUNT(*) n FROM marketplace_donations').n;
    receiptSeq++;
    return `CIF/80G/${fy()}/${String(receiptSeq).padStart(5, '0')}`;
  };
  function recordDonation(d, p, amount, mode, paidAt, user) {
    const s = data.get('marketplace_sponsorships', p.sponsorship_id);
    const x = data.put('marketplace_donations', { donor_id: d.id, pledge_id: p.id, sponsorship_id: p.sponsorship_id, hamlet_id: p.hamlet_id, amount, mode, paid_at: paidAt, receipt_no: nextReceipt(), fy: fy(new Date(paidAt)) }, user);
    if (s) {
      const raised = (s.raised || 0) + amount;
      data.put('marketplace_sponsorships', { id: s.id, raised, status: s.target && raised >= s.target ? 'funded' : s.status }, user);
    }
    if (p.frequency === 'once') data.put('marketplace_pledges', { id: p.id, status: 'fulfilled' }, user);
    else if (p.status === 'pledged') data.put('marketplace_pledges', { id: p.id, status: 'active' }, user);
    return x;
  }
  // DEMO: simulates a payment. A real deployment plugs a payment gateway in here.
  router.post('/pledges/:id/pay', requires('donate'), (req, res) => {
    const d = donorFor(req.user);
    const p = data.get('marketplace_pledges', req.params.id);
    if (!d || !p || p.donor_id !== d.id) throw httpError(404, 'Pledge not found');
    if (['fulfilled', 'cancelled'].includes(p.status)) throw httpError(409, 'Pledge is ' + p.status);
    const x = tx(() => recordDonation(d, p, p.amount, S(req.body.mode, 20) || 'demo-gateway', now(), req.user));
    emit('marketplace.donation_recorded', { donation_id: x.id, amount: x.amount }, req.user, x.hamlet_id);
    res.json({ id: x.id, receipt_no: x.receipt_no, amount: x.amount, gateway: 'PLACEHOLDER — no money moved (demo)' });
  });
  router.post('/pledges/:id/cancel', requires('donate'), (req, res) => {
    const d = donorFor(req.user);
    const p = data.get('marketplace_pledges', req.params.id);
    if (!d || !p || p.donor_id !== d.id) throw httpError(404, 'Pledge not found');
    res.json({ id: p.id, status: data.put('marketplace_pledges', { id: p.id, status: 'cancelled' }, req.user).status });
  });

  function words(n) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
    const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
    if (!n) return 'Zero';
    const parts = [];
    const cr = Math.floor(n / 1e7); n %= 1e7;
    const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3;
    if (cr) parts.push(three(cr) + ' Crore');
    if (lk) parts.push(two(lk) + ' Lakh');
    if (th) parts.push(two(th) + ' Thousand');
    if (n) parts.push(three(n));
    return parts.join(' ');
  }
  router.get('/receipts/:id', requires('donate', 'agency.manage'), (req, res) => {
    const x = data.get('marketplace_donations', req.params.id);
    if (!x) throw httpError(404, 'Receipt not found');
    const d = data.get('marketplace_donors', x.donor_id);
    const me = donorFor(req.user);
    if (req.user.role === 'donor' ? (!me || me.id !== x.donor_id) : !(req.user.role === 'platform_admin' || isStewardAgencyAdmin(req.user))) throw httpError(404, 'Receipt not found');
    const s = data.get('marketplace_sponsorships', x.sponsorship_id);
    res.json({ receipt_no: x.receipt_no, date: x.paid_at.slice(0, 10), fy: x.fy, amount: x.amount, amount_words: 'Rupees ' + words(x.amount) + ' Only', mode: x.mode, donor: { name: d?.name, pan: d?.pan_masked || 'Not provided', city: d?.city }, purpose: s ? `${s.kind === 'learner' ? 'Learner sponsorship' : s.kind === 'centre' ? 'Learning centre support' : s.kind === 'device' ? 'Devices for learning' : 'Learning camp'} — ${hamletMap()[s.hamlet_id]?.name || ''}` : 'General donation', issuer: CIF });
  });

  // Impact per sponsorship — k-anonymous aggregates only, never an individual's record.
  router.get('/sponsorships/:id/impact', requires('donate', 'agency.manage', 'analytics.aggregate'), (req, res) => {
    const u = req.user;
    const s = data.get('marketplace_sponsorships', req.params.id);
    if (!s) throw httpError(404, 'Not found');
    const hm = hamletMap();
    const sup = (n) => brain.policy.suppress(Number(n) || 0, u);
    const h = s.hamlet_id;
    const since = new Date(Date.now() - 180 * 86400e3).toISOString();
    const reached = sqlOne('SELECT COUNT(DISTINCT person_id) n FROM enrolments WHERE hamlet_id=? AND deleted=0 AND status=\'active\'', h).n;
    const kids = sqlOne('SELECT COUNT(DISTINCT e.person_id) n FROM enrolments e JOIN persons p ON p.id=e.person_id WHERE e.hamlet_id=? AND e.deleted=0 AND e.status=\'active\' AND p.kind=\'child\'', h).n;
    const youth = sqlOne('SELECT COUNT(DISTINCT e.person_id) n FROM enrolments e JOIN persons p ON p.id=e.person_id WHERE e.hamlet_id=? AND e.deleted=0 AND e.status=\'active\' AND p.kind=\'youth\'', h).n;
    const awards = sqlOne('SELECT COUNT(*) n FROM passport_entries WHERE hamlet_id=? AND deleted=0 AND issued_at>=?', h, since).n;
    const progs = sqlOne('SELECT COUNT(*) n, COUNT(DISTINCT agency_id) a FROM programmes WHERE hamlet_id=? AND deleted=0 AND status=\'active\'', h);
    const placed = sqlOne('SELECT COUNT(*) n FROM marketplace_placements WHERE hamlet_id=? AND deleted=0', h).n;
    const vhours = sqlOne('SELECT COALESCE(SUM(hours),0) n FROM marketplace_shifts WHERE hamlet_id=? AND deleted=0 AND status=\'verified\'', h).n;
    const funds = sqlOne('SELECT COALESCE(SUM(amount),0) n, COUNT(DISTINCT donor_id) d FROM marketplace_donations WHERE sponsorship_id=? AND deleted=0', s.id);
    let cohort = null;
    if (s.kind === 'learner') {
      // cohort = learners in the same hamlet and age band (so the sponsored child can never be singled out)
      const band = s.age_band;
      const ppl = sql('SELECT p.dob, p.id FROM persons p WHERE p.hamlet_id=? AND p.deleted=0 AND p.kind IN (\'child\',\'youth\')', h).filter((p) => ageBand(ageOf(p)) === band);
      const ids = ppl.map((p) => p.id);
      const enrolled = ids.length ? sqlOne(`SELECT COUNT(DISTINCT person_id) n FROM enrolments WHERE deleted=0 AND status='active' AND person_id IN (${ids.map(() => '?').join(',')})`, ...ids).n : 0;
      const earned = ids.length ? sqlOne(`SELECT COUNT(*) n FROM passport_entries WHERE deleted=0 AND issued_at>=? AND person_id IN (${ids.map(() => '?').join(',')})`, since, ...ids).n : 0;
      cohort = { age_band: band, learners: sup(enrolled), passport_awards_6m: sup(earned), note: 'Shown for the whole age group in this hamlet, never for one child.' };
    }
    res.json({
      sponsorship: sponsorCard(s, hm, u), funds: { raised: funds.n, donors: sup(funds.d), target: s.target },
      hamlet: { name: hm[h]?.name, name_ml: hm[h]?.name_ml, district: hm[h]?.district, learners_reached: sup(reached), children: sup(kids), youth: sup(youth), passport_awards_6m: sup(awards), programmes: progs.n, agencies: progs.a, youth_placed: sup(placed), volunteer_hours: Math.round(vhours) },
      cohort, k_anonymity: 'Counts below 5 are shown as "<5" to protect privacy.',
    });
  });

  router.get('/ledger', requires('agency.manage'), (req, res) => {
    if (!(req.user.role === 'platform_admin' || isStewardAgencyAdmin(req.user))) throw httpError(403, 'The donation ledger is held by the platform steward (CIF)');
    const donors = Object.fromEntries(data.find('marketplace_donors', {}).map((d) => [d.id, d]));
    const sp = Object.fromEntries(data.find('marketplace_sponsorships', {}).map((s) => [s.id, s]));
    const hm = hamletMap();
    const donations = data.find('marketplace_donations', {}, { order: 'paid_at DESC', limit: 500 }).map((x) => ({ id: x.id, receipt_no: x.receipt_no, paid_at: x.paid_at, amount: x.amount, mode: x.mode, fy: x.fy, donor: donors[x.donor_id]?.anonymous ? 'Anonymous donor' : donors[x.donor_id]?.name, kind: sp[x.sponsorship_id]?.kind, purpose: sp[x.sponsorship_id]?.card, hamlet: hm[x.hamlet_id]?.name }));
    const pledges = data.find('marketplace_pledges', {}, { order: 'pledged_at DESC', limit: 500 }).map((p) => ({ id: p.id, pledged_at: p.pledged_at, amount: p.amount, frequency: p.frequency, status: p.status, donor: donors[p.donor_id]?.name, kind: sp[p.sponsorship_id]?.kind, purpose: sp[p.sponsorship_id]?.card }));
    res.json({ donors: Object.values(donors).length, donations, pledges, totals: { received: donations.reduce((a, x) => a + x.amount, 0), pledged_open: pledges.filter((p) => ['pledged', 'active'].includes(p.status)).reduce((a, p) => a + p.amount, 0) } });
  });

  router.post('/sponsorships', requires('agency.manage'), (req, res) => {
    if (!(req.user.role === 'platform_admin' || isStewardAgencyAdmin(req.user))) throw httpError(403, 'Only the platform steward lists sponsorships');
    const b = req.body;
    if (!['centre', 'device', 'camp'].includes(b.kind)) throw httpError(400, 'Learner cards are generated from consent; list centre / device / camp here');
    if (!brain.hamlets.get(b.hamlet_id)) throw httpError(400, 'Choose a hamlet');
    const s = data.put('marketplace_sponsorships', { kind: b.kind, card: S(b.card, 140), card_ml: S(b.card_ml, 140), hamlet_id: b.hamlet_id, need: S(b.need, 500), need_ml: S(b.need_ml, 500), target: Math.max(0, Math.round(Number(b.target) || 0)), raised: 0, status: 'open', created_at: now() }, req.user);
    res.json(sponsorCard(s, hamletMap(), req.user));
  });

  // ======================================================================
  // EMPLOYERS, JOBS, APPLICATIONS, PLACEMENTS
  // ======================================================================
  const isAdultPerson = (p) => p && !brain.policy.isMinor(p);
  function checkFairWork(b) {
    const c = b.checklist || {};
    const missing = FAIR_WORK.filter((k) => !c[k]);
    if (missing.length) throw httpError(400, 'Fair-work checklist incomplete: ' + missing.join(', '));
    const wage = Math.round(Number(b.wage_monthly) || 0);
    if (wage < WAGE_FLOOR) throw httpError(400, `Monthly wage must be at least ₹${WAGE_FLOOR} (demo floor — use the notified minimum wage for the sector)`);
    return wage;
  }
  function jobOut(j, u, ag, hm) {
    const counts = sql('SELECT status, COUNT(*) n FROM marketplace_applications WHERE job_id=? AND deleted=0 GROUP BY status', j.id);
    const out = { ...j, agency_name: ag[j.agency_id]?.name, fair_work: FAIR_WORK.every((k) => j.checklist && j.checklist[k]), wage_ok: j.wage_monthly >= WAGE_FLOOR };
    if (u.role === 'employer' || isSteward(u)) out.applications = Object.fromEntries(counts.map((c) => [c.status, c.n]));
    else out.applications_total = counts.reduce((a, c) => a + c.n, 0);
    delete out.posted_by;
    return out;
  }
  router.get('/jobs', authed, (req, res) => {
    const u = req.user;
    if (['donor', 'govt_viewer', 'guardian'].includes(u.role) && !req.query.public) return res.json([]);
    if (u.role === 'learner' && !isAdultPerson(brain.persons.raw(u.person_id))) return res.json([]); // children never see job listings
    const ag = agencyMap(), hm = hamletMap();
    let jobs = data.find('marketplace_jobs', u.role === 'employer' && req.query.mine !== '0' ? { agency_id: u.agency_id } : {}, { order: 'posted_at DESC' });
    if (u.role !== 'employer' && !isSteward(u)) jobs = jobs.filter((j) => j.status === 'open');
    let mine = {};
    if (u.person_id) mine = Object.fromEntries(data.find('marketplace_applications', { person_id: u.person_id }).map((a) => [a.job_id, a.status]));
    res.json(jobs.map((j) => ({ ...jobOut(j, u, ag, hm), my_status: mine[j.id] || null })));
  });
  router.post('/jobs', requires('hire'), (req, res) => {
    const u = req.user, b = req.body;
    const wage = checkFairWork(b);
    if (!S(b.title)) throw httpError(400, 'Job title required');
    const j = data.put('marketplace_jobs', {
      agency_id: isSteward(u) && b.agency_id ? b.agency_id : u.agency_id, employer_name: S(b.employer_name, 120) || u.display_name.split(' — ')[0], title: S(b.title, 140), title_ml: S(b.title_ml, 140),
      kind: ['job', 'internship', 'apprenticeship'].includes(b.kind) ? b.kind : 'job', sector: S(b.sector, 60), location: S(b.location, 120), district: S(b.district, 60), wage_monthly: wage, wage_floor: WAGE_FLOOR,
      accommodation: S(b.accommodation, 200), food: S(b.food, 120), openings: Math.max(1, Number(b.openings) || 1), min_age: Math.max(18, Number(b.min_age) || 18), skills: (Array.isArray(b.skills) ? b.skills : S(b.skills).split(',')).map((s) => S(s, 40)).filter(Boolean),
      description: S(b.description, 3000), description_ml: S(b.description_ml, 3000), checklist: Object.fromEntries(FAIR_WORK.map((k) => [k, true])), status: 'open', posted_by: u.id, posted_at: now(), closes_on: S(b.closes_on, 10) || null,
    }, u);
    emit('marketplace.job_posted', { job_id: j.id, kind: j.kind, sector: j.sector }, u);
    res.json(jobOut(j, u, agencyMap(), hamletMap()));
  });
  router.post('/jobs/:id/status', requires('hire'), (req, res) => {
    const j = data.get('marketplace_jobs', req.params.id);
    if (!j || (!isSteward(req.user) && j.agency_id !== req.user.agency_id)) throw httpError(404, 'Not found');
    if (!['open', 'paused', 'closed'].includes(req.body.status)) throw httpError(400, 'Bad status');
    res.json(jobOut(data.put('marketplace_jobs', { id: j.id, status: req.body.status }, req.user), req.user, agencyMap(), hamletMap()));
  });

  // Candidate shape for employers: minimal profile, no contact details, no wellbeing, no ids of guardians.
  function candidate(p, hm) {
    const entries = brain.passport.entries(p.id).filter((e) => e.type !== 'milestone' || /placed|certificate/i.test(e.title || '')).slice(0, 8).map((e) => ({ title: e.title, level: e.level, type: e.type }));
    const parts = String(p.name).split(' ');
    return { id: p.id, display_name: parts[0] + (parts[1] ? ' ' + parts[1].charAt(0) + '.' : ''), age: ageOf(p), gender: p.gender, hamlet: hm[p.hamlet_id]?.name, district: hm[p.hamlet_id]?.district, education: p.school_class, aspirations: p.aspirations, language: p.language, passport: entries };
  }
  router.get('/candidates', requires('hire'), (req, res) => {
    const u = req.user;
    const hm = hamletMap();
    const ppl = brain.persons.visible(u, { limit: 1000 })
      .filter((p) => brain.policy.canSee(u, p.id, 'employment').ok && isAdultPerson(p) && p.kind !== 'child');
    let out = ppl.map((p) => candidate(p, hm));
    if (req.query.q) { const q = String(req.query.q).toLowerCase(); out = out.filter((c) => [c.aspirations, c.education, c.hamlet, ...c.passport.map((e) => e.title)].some((x) => String(x || '').toLowerCase().includes(q))); }
    res.json(out);
  });

  function appOut(a, u, hm, jobs) {
    const p = brain.persons.raw(a.person_id);
    const j = jobs[a.job_id] || data.get('marketplace_jobs', a.job_id);
    const o = { id: a.id, job_id: a.job_id, job_title: j?.title, employer_name: j?.employer_name, status: a.status, source: a.source, applied_at: a.applied_at, history: a.history || [], note: a.note, next: APP_FLOW[a.status] || [] };
    if (u.role === 'employer') Object.assign(o, { candidate: candidate(p, hm) });
    else o.person = { id: p.id, name: p.name, hamlet: hm[p.hamlet_id]?.name, age: ageOf(p) };
    return o;
  }
  function canViewApp(u, a) {
    const p = brain.persons.raw(a.person_id);
    if (!p) return false;
    if (u.person_id === a.person_id) return true;
    if (u.role === 'employer') return a.agency_id === u.agency_id && isAdultPerson(p) && brain.policy.canSee(u, p.id, 'employment').ok;
    return brain.policy.canSee(u, p.id, 'profile').ok;
  }
  router.get('/applications', authed, (req, res) => {
    const u = req.user;
    if (['donor', 'govt_viewer'].includes(u.role)) throw httpError(403, 'Aggregates only for your role');
    const hm = hamletMap();
    const jobs = Object.fromEntries(data.find('marketplace_jobs', {}).map((j) => [j.id, j]));
    let rows;
    if (u.role === 'employer') rows = data.find('marketplace_applications', { agency_id: u.agency_id }, { order: 'applied_at DESC' });
    else if (u.role === 'learner' || u.role === 'guardian') rows = data.find('marketplace_applications', { person_id: u.person_id || '-' }, { order: 'applied_at DESC' });
    else {
      const ids = brain.persons.visibleIds(u);
      rows = data.find('marketplace_applications', {}, { order: 'applied_at DESC', limit: 2000 });
      if (ids !== null) { const s = new Set(ids); rows = rows.filter((a) => s.has(a.person_id)); }
    }
    if (req.query.job_id) rows = rows.filter((a) => a.job_id === req.query.job_id);
    res.json(rows.filter((a) => canViewApp(u, a)).map((a) => appOut(a, u, hm, jobs)));
  });
  function consentGate(person, agencyId) {
    if (brain.consent.has(person.id, agencyId, 'employment')) return null;
    const cur = sql('SELECT scopes FROM consents WHERE person_id=? AND agency_id=? AND status=\'active\' AND deleted=0', person.id, agencyId)[0];
    return { error: 'consent_required', message: 'To apply, you must allow this employer\'s agency to see your job profile (employment consent).', agency_id: agencyId, agency_name: brain.agencies.get(agencyId)?.name, current_scopes: cur ? cur.scopes : [] };
  }
  router.post('/jobs/:id/apply', authed, (req, res) => {
    const u = req.user;
    const j = data.get('marketplace_jobs', req.params.id);
    if (!j || j.status !== 'open') throw httpError(404, 'Job not open');
    let pid = u.person_id, source = 'self';
    if (req.body.person_id && req.body.person_id !== u.person_id) {
      if (!brain.policy.can(u, 'learner.write') && !['counsellor', 'mentor'].includes(u.role)) throw httpError(403, 'Only staff can refer a learner');
      if (!brain.policy.canSee(u, req.body.person_id, 'profile').ok) throw httpError(403, 'You cannot see this learner');
      pid = req.body.person_id; source = 'referral';
    }
    if (!pid || u.role === 'guardian') throw httpError(403, 'Only youth (or staff referring them) can apply');
    const p = brain.persons.raw(pid);
    if (!isAdultPerson(p)) throw httpError(403, 'Jobs are for adults (18+) only. Minors cannot be placed through AADI.');
    const age = ageOf(p);
    if (j.min_age && age < j.min_age) throw httpError(400, `Minimum age for this job is ${j.min_age}`);
    const gate = consentGate(p, j.agency_id);
    if (gate) return res.status(409).json(gate);
    const ex = data.find('marketplace_applications', { job_id: j.id, person_id: pid })[0];
    if (ex && ex.status !== 'withdrawn') return res.json(appOut(ex, u, hamletMap(), { [j.id]: j }));
    const a = data.put('marketplace_applications', { ...(ex ? { id: ex.id } : {}), job_id: j.id, agency_id: j.agency_id, person_id: pid, hamlet_id: p.hamlet_id, status: 'applied', source, history: [{ status: 'applied', at: now(), by: source === 'self' ? 'Applicant' : u.display_name }], applied_at: now(), note: S(req.body.note, 500) }, u);
    emit('marketplace.applied', { application_id: a.id, job_id: j.id, source }, u, p.hamlet_id);
    res.json(appOut(a, u, hamletMap(), { [j.id]: j }));
  });
  router.post('/applications/:id/status', authed, (req, res) => {
    const u = req.user;
    const a = data.get('marketplace_applications', req.params.id);
    if (!a || !canViewApp(u, a)) throw httpError(404, 'Not found');
    const to = req.body.status;
    const self = u.person_id === a.person_id;
    if (self && to !== 'withdrawn') throw httpError(403, 'You can only withdraw your own application');
    if (!self && u.role !== 'employer' && !isSteward(u)) throw httpError(403, 'Only the employer moves an application forward');
    if (!(APP_FLOW[a.status] || []).includes(to)) throw httpError(409, `Cannot move from ${a.status} to ${to}`);
    const history = [...(a.history || []), { status: to, at: now(), by: self ? 'Applicant' : u.display_name, note: S(req.body.note, 300) }];
    const out = tx(() => {
      const row = data.put('marketplace_applications', { id: a.id, status: to, history }, u);
      if (to === 'hired') {
        const j = data.get('marketplace_jobs', a.job_id);
        const wage = Math.max(Number(req.body.wage_monthly) || j.wage_monthly, j.wage_monthly);
        data.put('marketplace_placements', { application_id: a.id, job_id: j.id, agency_id: j.agency_id, person_id: a.person_id, hamlet_id: a.hamlet_id, start_date: S(req.body.start_date, 10) || now().slice(0, 10), wage_monthly: wage, status: 'active', check_30: null, check_90: null }, u);
        brain.passport.award({ person_id: a.person_id, type: 'milestone', ref: 'placement:' + j.id, title: `Placed: ${j.title} (${j.employer_name})`, level: 1, agency_id: j.agency_id }, u);
        try { brain.notify(a.person_id, `Congratulations! You are selected for ${j.title}. Never hand over your original certificates. Call the AADI helpline if anything feels unsafe.`, { channel: 'auto' }, u); } catch (_) { /* best effort */ }
      }
      return row;
    });
    if (to === 'hired') emit('marketplace.placed', { application_id: a.id, job_id: a.job_id }, u, a.hamlet_id);
    res.json(appOut(out, u, hamletMap(), {}));
  });

  router.get('/placements', authed, (req, res) => {
    const u = req.user;
    if (['donor', 'govt_viewer', 'guardian'].includes(u.role)) throw httpError(403, 'Aggregates only for your role');
    const hm = hamletMap();
    const jobs = Object.fromEntries(data.find('marketplace_jobs', {}).map((j) => [j.id, j]));
    let rows = data.find('marketplace_placements', u.role === 'employer' ? { agency_id: u.agency_id } : {}, { order: 'start_date DESC' });
    rows = rows.filter((pl) => canViewApp(u, pl));
    res.json(rows.map((pl) => {
      const p = brain.persons.raw(pl.person_id);
      const who = u.role === 'employer' ? candidate(p, hm).display_name : p.name;
      return { id: pl.id, person: who, hamlet: hm[pl.hamlet_id]?.name, job_title: jobs[pl.job_id]?.title, employer_name: jobs[pl.job_id]?.employer_name, start_date: pl.start_date, wage_monthly: pl.wage_monthly, status: pl.status, check_30: pl.check_30, check_90: pl.check_90, note: pl.note };
    }));
  });
  // Follow-up check-ins after placement (facilitator / counsellor / steward) — the "is the youth safe and paid?" loop.
  router.post('/placements/:id/checkin', requires('ops', 'counsel', 'mentor'), (req, res) => {
    const pl = data.get('marketplace_placements', req.params.id);
    if (!pl || !brain.policy.canSee(req.user, pl.person_id, 'profile').ok) throw httpError(404, 'Not found');
    const which = req.body.which === 'check_90' ? 'check_90' : 'check_30';
    const chk = { at: now(), by: req.user.display_name, paid_on_time: !!req.body.paid_on_time, documents_with_youth: !!req.body.documents_with_youth, safe_accommodation: !!req.body.safe_accommodation, note: S(req.body.note, 500) };
    const concern = !chk.paid_on_time || !chk.documents_with_youth || !chk.safe_accommodation;
    const status = req.body.left ? 'left' : concern ? 'concern' : 'active';
    if (concern) brain.audit(req.user, 'placement.concern', pl.id, { which });
    res.json(data.put('marketplace_placements', { id: pl.id, [which]: chk, status }, req.user));
  });

  // ======================================================================
  // CSR / GRANT REPORTING — anonymised aggregates only
  // ======================================================================
  function report(u) {
    const sup = (n) => brain.policy.suppress(Number(n) || 0, u);
    const hm = hamletMap();
    const rows = [];
    for (const h of Object.values(hm)) {
      const reached = sqlOne('SELECT COUNT(DISTINCT person_id) n FROM enrolments WHERE hamlet_id=? AND deleted=0 AND status=\'active\'', h.id).n;
      const girls = sqlOne('SELECT COUNT(DISTINCT e.person_id) n FROM enrolments e JOIN persons p ON p.id=e.person_id WHERE e.hamlet_id=? AND e.deleted=0 AND e.status=\'active\' AND p.gender=\'F\'', h.id).n;
      const awards = sqlOne('SELECT COUNT(*) n FROM passport_entries WHERE hamlet_id=? AND deleted=0', h.id).n;
      const progs = sqlOne('SELECT COUNT(*) n, COUNT(DISTINCT agency_id) a FROM programmes WHERE hamlet_id=? AND deleted=0 AND status=\'active\'', h.id);
      const funds = sqlOne('SELECT COALESCE(SUM(amount),0) n FROM marketplace_donations WHERE hamlet_id=? AND deleted=0', h.id).n;
      const vh = sqlOne('SELECT COALESCE(SUM(hours),0) n FROM marketplace_shifts WHERE hamlet_id=? AND deleted=0 AND status=\'verified\'', h.id).n;
      const placed = sqlOne('SELECT COUNT(*) n FROM marketplace_placements WHERE hamlet_id=? AND deleted=0', h.id).n;
      rows.push({ hamlet: h.name, district: h.district, community: h.community, agencies: progs.a, programmes: progs.n, learners_reached: sup(reached), girls_reached: sup(girls), passport_awards: sup(awards), youth_placed: sup(placed), volunteer_hours: Math.round(vh), funds_received_inr: funds });
    }
    const byKind = sql('SELECT s.kind, COALESCE(SUM(d.amount),0) amount, COUNT(DISTINCT d.donor_id) donors FROM marketplace_donations d JOIN marketplace_sponsorships s ON s.id=d.sponsorship_id WHERE d.deleted=0 GROUP BY s.kind').map((r) => ({ ...r, donors: sup(r.donors) }));
    const byMonth = sql('SELECT substr(paid_at,1,7) month, SUM(amount) amount FROM marketplace_donations WHERE deleted=0 GROUP BY month ORDER BY month');
    const tot = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0);
    let mine = null;
    if (u.role === 'donor') { const d = donorFor(u); mine = sqlOne('SELECT COALESCE(SUM(amount),0) given, COUNT(*) n FROM marketplace_donations WHERE donor_id=? AND deleted=0', d.id); }
    return {
      generated_at: now(), fy: fy(), issuer: CIF.name,
      totals: { funds_received_inr: tot('funds_received_inr'), volunteer_hours: tot('volunteer_hours'), hamlets: rows.length, volunteers_active: sqlOne('SELECT COUNT(*) n FROM marketplace_volunteers WHERE deleted=0 AND status=\'approved\'').n, jobs_open: sqlOne('SELECT COUNT(*) n FROM marketplace_jobs WHERE deleted=0 AND status=\'open\'').n, youth_placed: sup(sqlOne('SELECT COUNT(*) n FROM marketplace_placements WHERE deleted=0').n), learners_reached: sup(sqlOne('SELECT COUNT(DISTINCT person_id) n FROM enrolments WHERE deleted=0 AND status=\'active\'').n) },
      by_hamlet: rows, by_kind: byKind, by_month: byMonth, my_giving: mine,
      method: 'All figures are anonymised aggregates. Counts between 1 and 4 are suppressed ("<5"). No individual data leaves the platform.',
    };
  }
  const toCsv = (rows) => {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
  };
  router.get('/reports/summary', requires('donate', 'analytics.aggregate', 'agency.manage'), (req, res) => res.json(report(req.user)));
  router.get('/reports/csr.csv', requires('donate', 'analytics.aggregate', 'agency.manage'), (req, res) => {
    const r = report(req.user);
    const head = `# AADI CSR / grant report (DEMO data) — ${r.issuer} — FY ${r.fy} — generated ${r.generated_at}\n# ${r.method}\n`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="aadi-csr-report-${r.fy}.csv"`);
    res.send(head + toCsv(r.by_hamlet) + '\n');
  });

  // ======================================================================
  // SEED
  // ======================================================================
  async function seed(demo) {
    const { R, daysAgo, hamletByKey: H, agencyByKey: A, users: U, hamlets } = demo;
    const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
    const sys = U.steward;
    tx(() => {
      // ---- volunteers in every workflow stage
      const VOLS = [
        ['Arjun Menon', 'Kochi', ['English', 'Football'], 'approved'], ['Fathima Rahman', 'Kozhikode', ['Maths', 'Science'], 'approved'], ['Joseph Mathew', 'Kottayam', ['Computer basics'], 'approved'],
        ['Divya Nair', 'Thrissur', ['Art', 'Storytelling'], 'approved'], ['Rohan Pillai', 'Bengaluru (remote)', ['Spoken English', 'Interview prep'], 'approved'], ['Asha Varghese', 'Kalpetta', ['Nursing awareness', 'First aid'], 'approved'],
        ['Nikhil Das', 'Palakkad', ['PSC coaching'], 'screening:id_verified,references'], ['Shabna K', 'Malappuram', ['Tailoring'], 'screening:id_verified'], ['Pradeep Kumar', 'Idukki', ['Agriculture'], 'screening:id_verified,police_clearance,references'],
        ['Meenakshi R', 'Ernakulam', ['Music'], 'applied'], ['Sajan George', 'Kannur', ['Football', 'Fitness'], 'applied'], ['Anu Thomas', 'Pathanamthitta', ['Malayalam reading'], 'applied'],
        ['Vivek S', 'Thiruvananthapuram', ['Coding'], 'rejected'], ['Lekha Suresh', 'Wayanad', ['Counselling support'], 'screening:id_verified,police_clearance'],
      ];
      const vols = [];
      VOLS.forEach(([name, city, skills, st], i) => {
        const [status, done] = st.split(':');
        const doneList = status === 'approved' ? VOL_CHECKS : status === 'rejected' ? ['id_verified'] : (done ? done.split(',') : []);
        const applied = R.int(20, 170);
        const checks = Object.fromEntries(doneList.map((c) => [c, { done: true, by: 'CIF Programme Admin', at: daysAgo(applied - R.int(2, 12)) }]));
        const ag = i % 5 === 4 ? A.syf.id : A.cif.id;
        const hset = (ag === A.cif.id ? [H.h1, H.h2, H.h5, H.h9] : [H.h2, H.h8]).map((h) => h.id);
        vols.push(data.put('marketplace_volunteers', { name, phone: '9' + String(R.int(100000000, 999999999)), email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.org', city, agency_id: ag, hamlet_ids: R.sample(hset, 2), skills, languages: ['Malayalam', 'English'], availability: R.pick(['Weekends', 'Saturday mornings', 'Two evenings a week (online)', 'School holidays']), motivation: 'I want to give back and help children in tribal hamlets learn with confidence.', status: status === 'rejected' ? 'rejected' : status, checks, check_notes: status === 'rejected' ? 'References could not be verified.' : null, applied_at: daysAgo(applied), approved_at: status === 'approved' ? daysAgo(applied - 15) : null, approved_by: status === 'approved' ? 'CIF Programme Admin' : null, user_id: i === 0 ? U.mentor.id : null, certificates: [] }, sys));
      });
      // shifts for approved volunteers
      for (const v of vols.filter((x) => x.status === 'approved')) {
        const progs = demo.programmes.filter((p) => p.agency_id === v.agency_id && (v.hamlet_ids || []).includes(p.hamlet_id));
        if (!progs.length) continue;
        const n = R.int(5, 12);
        for (let k = 0; k < n; k++) {
          const p = R.pick(progs);
          const ago = R.int(-14, 120);
          const st = ago < 0 ? 'scheduled' : ago < 7 ? R.pick(['completed', 'scheduled']) : R.pick(['verified', 'verified', 'verified', 'completed']);
          data.put('marketplace_shifts', { volunteer_id: v.id, programme_id: p.id, agency_id: p.agency_id, hamlet_id: p.hamlet_id, date: ago < 0 ? day(-ago) : daysAgo(ago).slice(0, 10), slot: Array.isArray(p.schedule) ? p.schedule[0] : '', role: R.pick(['Session support', 'Reading circle', 'Spoken English practice', 'Sports coaching', 'Mock interview panel']), hours: st === 'scheduled' ? 0 : R.pick([1.5, 2, 2, 3, 4]), status: st, logged_by: st === 'scheduled' ? null : v.name, verified_by: st === 'verified' ? 'CIF Programme Admin' : null }, sys);
        }
      }

      // ---- sponsorship cards
      const sps = [];
      const researchKids = demo.children.filter((p) => sqlOne('SELECT 1 x FROM consents WHERE person_id=? AND status=\'active\' AND deleted=0 AND scopes LIKE \'%"research"%\'', p.id));
      const pickedKids = R.sample(researchKids, 18);
      for (const p of pickedKids) {
        const h = hamlets.find((x) => x.id === p.hamlet_id);
        const band = ageBand(ageOf(p));
        const need = R.pick([['School kit, uniform and evening tuition for one year', 'ഒരു വർഷത്തെ സ്കൂൾ കിറ്റ്, യൂണിഫോം, വൈകുന്നേര ട്യൂഷൻ', 6000], ['Learning tablet share and data for one year', 'ഒരു വർഷത്തെ പഠന ടാബ്‌ലറ്റ് പങ്കും ഡാറ്റയും', 8000], ['Hostel transition support and books', 'ഹോസ്റ്റൽ മാറ്റ സഹായവും പുസ്തകങ്ങളും', 7000]]);
        sps.push(data.put('marketplace_sponsorships', { kind: 'learner', card: `${p.name.charAt(0)}. · ${p.gender === 'F' ? 'girl' : 'boy'}, ${band} yrs · ${h.name}`, card_ml: `${p.name.charAt(0)}. · ${band} വയസ്സ് · ${h.name_ml}`, hamlet_id: h.id, person_id: p.id, age_band: band, need: need[0], need_ml: need[1], target: need[2], raised: 0, status: 'open', created_at: daysAgo(R.int(30, 160)), cohort_size: sqlOne('SELECT COUNT(*) n FROM persons WHERE hamlet_id=? AND deleted=0 AND kind=\'child\'', h.id).n }, sys));
      }
      for (const h of hamlets) {
        sps.push(data.put('marketplace_sponsorships', { kind: 'centre', card: `AADI Smart Learning Centre — ${h.name}`, card_ml: `AADI പഠനകേന്ദ്രം — ${h.name_ml}`, hamlet_id: h.id, age_band: null, need: `One year of facilitator honorarium, solar power and connectivity for the centre at ${h.name} (${h.district}).`, need_ml: 'ഒരു വർഷത്തെ ഫെസിലിറ്റേറ്റർ ഓണറേറിയം, സോളാർ, കണക്റ്റിവിറ്റി.', target: 240000, raised: 0, status: 'open', created_at: daysAgo(R.int(60, 170)) }, sys));
      }
      for (const h of [H.h5, H.h6, H.h7, H.h1]) sps.push(data.put('marketplace_sponsorships', { kind: 'device', card: `10 offline learning tablets — ${h.name}`, card_ml: `10 ഓഫ്‌ലൈൻ പഠന ടാബ്‌ലറ്റുകൾ — ${h.name_ml}`, hamlet_id: h.id, need: 'Rugged tablets pre-loaded with AADI content that work without internet; synced weekly by the hub.', need_ml: 'ഇന്റർനെറ്റ് ഇല്ലാതെ പ്രവർത്തിക്കുന്ന ടാബ്‌ലറ്റുകൾ.', target: 120000, raised: 0, status: 'open', created_at: daysAgo(R.int(20, 120)) }, sys));
      for (const [h, t] of [[H.h2, 'PSC residential camp (10 days)'], [H.h8, 'Football & leadership camp'], [H.h3, 'Summer reading camp']]) sps.push(data.put('marketplace_sponsorships', { kind: 'camp', card: `${t} — ${h.name}`, card_ml: `${t} — ${h.name_ml}`, hamlet_id: h.id, need: 'Food, stay, travel and resource persons for youth and children.', need_ml: 'ഭക്ഷണം, താമസം, യാത്ര, പരിശീലകർ.', target: 90000, raised: 0, status: 'open', created_at: daysAgo(R.int(15, 90)) }, sys));

      // ---- donors, pledges and donations
      const DONORS = [
        ['GreenLeaf CSR Foundation (demo)', 'csr', 'Mumbai'], ['Malabar Spices Ltd (demo)', 'csr', 'Kozhikode'], ['Periyar Software LLP (demo)', 'csr', 'Kochi'], ['Coastal Bank CSR (demo)', 'csr', 'Thrissur'], ['Western Ghats Tea Co. (demo)', 'csr', 'Munnar'],
        ['Rotary Club of Demo City', 'trust', 'Kottayam'], ['St. Demo Alumni Association', 'trust', 'Thiruvananthapuram'], ['Kerala Diaspora Circle (demo)', 'trust', 'Dubai'],
        ['Anita Joseph', 'individual', 'Bengaluru'], ['Ramesh Iyer', 'individual', 'Chennai'], ['Fr. Thomas K', 'individual', 'Kollam'], ['Sunitha Menon', 'individual', 'Kochi'], ['Harish Nambiar', 'individual', 'Pune'], ['Leena George', 'individual', 'Kottayam'],
        ['Abdul Kareem', 'individual', 'Malappuram'], ['Priya Raghavan', 'individual', 'Hyderabad'], ['Mathew Chacko', 'individual', 'Thiruvalla'], ['Nisha Pillai', 'individual', 'London'], ['Gopakumar V', 'individual', 'Palakkad'],
        ['Deepa Krishnan', 'individual', 'Kochi'], ['Joseph Varghese', 'individual', 'Kannur'], ['Rekha Sasi', 'individual', 'Thrissur'], ['Ajay Kumar', 'individual', 'Delhi'], ['Mini Alex', 'individual', 'Alappuzha'], ['Anonymous well-wisher', 'individual', 'Kerala'],
      ];
      const donors = DONORS.map(([name, kind, city], i) => data.put('marketplace_donors', { name, kind, city, pan_masked: kind === 'individual' ? 'XXXXX' + String(R.int(1000, 9999)) + 'X' : 'AAxCx' + String(R.int(1000, 9999)) + 'X', email: 'donor' + i + '@example.org', user_id: i === 0 ? U.donor.id : null, agency_id: i === 0 ? A.glc.id : null, anonymous: name.startsWith('Anonymous') ? 1 : 0, joined_at: daysAgo(R.int(60, 175)) }, sys));
      const raised = {};
      let seq = 0;
      const pledgeFor = (d, s, amount, frequency, ago, payments) => {
        const p = data.put('marketplace_pledges', { donor_id: d.id, sponsorship_id: s.id, hamlet_id: s.hamlet_id, amount, frequency, status: payments === 0 ? 'pledged' : frequency === 'once' ? 'fulfilled' : 'active', pledged_at: daysAgo(ago), note: null }, sys);
        for (let k = 0; k < payments; k++) {
          const paid = new Date(Date.now() - Math.max(1, ago - 2 - k * 30) * 86400e3);
          seq++;
          data.put('marketplace_donations', { donor_id: d.id, pledge_id: p.id, sponsorship_id: s.id, hamlet_id: s.hamlet_id, amount, mode: R.pick(['NEFT', 'UPI', 'Cheque', 'NEFT']), paid_at: paid.toISOString(), receipt_no: `CIF/80G/${fy(paid)}/${String(seq).padStart(5, '0')}`, fy: fy(paid) }, sys);
          raised[s.id] = (raised[s.id] || 0) + amount;
        }
      };
      const centres = sps.filter((s) => s.kind === 'centre'), devices = sps.filter((s) => s.kind === 'device'), camps = sps.filter((s) => s.kind === 'camp'), learners = sps.filter((s) => s.kind === 'learner');
      donors.forEach((d, i) => {
        if (d.kind === 'csr') {
          pledgeFor(d, centres[i % centres.length], R.pick([60000, 120000, 240000]), 'once', R.int(40, 160), 1);
          pledgeFor(d, devices[i % devices.length], R.pick([60000, 120000]), 'once', R.int(20, 90), i === 0 ? 1 : R.int(0, 1));
        } else if (d.kind === 'trust') {
          pledgeFor(d, camps[i % camps.length], R.pick([25000, 45000, 90000]), 'once', R.int(20, 120), 1);
        } else {
          const s = learners[i % learners.length];
          const monthly = R.chance(0.5);
          pledgeFor(d, s, monthly ? 500 : s.target, monthly ? 'monthly' : 'once', R.int(30, 170), monthly ? R.int(1, 5) : R.int(0, 1));
        }
      });
      for (const s of sps) if (raised[s.id]) data.put('marketplace_sponsorships', { id: s.id, raised: raised[s.id], status: raised[s.id] >= s.target ? 'funded' : 'open' }, sys);

      // ---- jobs (employer agency = GreenLeaf, the placement partner in the demo)
      const JOBS = [
        ['Demo Hotels Pvt Ltd', 'Front office trainee', 'ഫ്രണ്ട് ഓഫീസ് ട്രെയിനി', 'job', 'Hospitality', 'Kochi', 'Ernakulam', 15500, 'Shared hostel for women, 2 per room, CCTV and warden', 'Free meals on duty', 3, ['Spoken English', 'Grooming']],
        ['Demo Hotels Pvt Ltd', 'Kitchen assistant (commis)', 'അടുക്കള സഹായി', 'job', 'Hospitality', 'Munnar', 'Idukki', 14000, 'Staff quarters, 3 per room', 'Free meals', 4, ['Hygiene', 'Teamwork']],
        ['Western Ghats Tea Co. (demo)', 'Field supervisor apprentice', 'ഫീൽഡ് സൂപ്പർവൈസർ അപ്രന്റിസ്', 'apprenticeship', 'Plantation', 'Munnar', 'Idukki', 13000, 'Family quarters on estate', 'Subsidised canteen', 2, ['Malayalam', 'Basic maths']],
        ['Periyar Software LLP (demo)', 'Data entry & QA intern', 'ഡാറ്റ എൻട്രി ഇന്റേൺ', 'internship', 'IT services', 'Kochi (Infopark)', 'Ernakulam', 12000, 'Verified PG list provided; first month paid by company', 'Lunch', 5, ['Computer basics', 'Typing']],
        ['GreenLeaf Retail (demo)', 'Store associate', 'സ്റ്റോർ അസോസിയേറ്റ്', 'job', 'Retail', 'Kalpetta', 'Wayanad', 13500, 'Not provided — local hires', 'Tea & snacks', 6, ['Customer service', 'UPI']],
        ['Kerala Eco Tourism Society (demo)', 'Nature guide trainee', 'പ്രകൃതി ഗൈഡ് ട്രെയിനി', 'apprenticeship', 'Tourism', 'Thekkady', 'Idukki', 12500, 'Dormitory at camp, separate for women', 'Meals at camp', 4, ['Forest knowledge', 'English basics']],
        ['Coastal Bank (demo)', 'Business correspondent (BC) agent', 'ബിസിനസ് കറസ്പോണ്ടന്റ്', 'job', 'Banking', 'Home hamlet / panchayat', 'Wayanad', 14000, 'Works from home hamlet', '—', 3, ['Digital money', 'Malayalam']],
        ['Malabar Spices Ltd (demo)', 'Quality lab assistant', 'ക്വാളിറ്റി ലാബ് അസിസ്റ്റന്റ്', 'job', 'Food processing', 'Kozhikode', 'Kozhikode', 15000, 'Company hostel, women-only floor', 'Subsidised canteen', 2, ['Science (Plus Two)']],
        ['Demo Hospital Trust', 'Patient care assistant (GDA)', 'പേഷ്യന്റ് കെയർ അസിസ്റ്റന്റ്', 'job', 'Healthcare', 'Thrissur', 'Thrissur', 14500, 'Nurses\' hostel, 4 per room', 'Meals on duty', 5, ['First aid', 'Compassion']],
        ['Periyar Software LLP (demo)', 'Junior support engineer (trainee)', 'ജൂനിയർ സപ്പോർട്ട് എൻജിനീയർ', 'internship', 'IT services', 'Thiruvananthapuram (Technopark)', 'Thiruvananthapuram', 16000, 'Verified PG list; travel allowance', 'Lunch', 2, ['English', 'Computers']],
        ['Kerala Eco Tourism Society (demo)', 'Homestay operations assistant', 'ഹോംസ്റ്റേ സഹായി', 'job', 'Tourism', 'Vythiri', 'Wayanad', 13000, 'Shared room at homestay', 'All meals', 2, ['Cooking', 'Hospitality']],
        ['GreenLeaf Retail (demo)', 'Warehouse assistant', 'വെയർഹൗസ് അസിസ്റ്റന്റ്', 'job', 'Logistics', 'Palakkad', 'Palakkad', 14000, 'Company hostel', 'Lunch', 4, ['Physical fitness', 'Counting stock']],
      ];
      const jobs = JOBS.map(([employer_name, title, title_ml, kind, sector, location, district, wage, acc, food, openings, skills], i) => data.put('marketplace_jobs', {
        agency_id: A.glc.id, employer_name, title, title_ml, kind, sector, location, district, wage_monthly: wage, wage_floor: WAGE_FLOOR, accommodation: acc, food, openings, min_age: 18, skills,
        description: `${title} with ${employer_name}. Written offer letter before joining. Wages paid monthly to the employee's own bank account. Original certificates are never kept by the employer.`,
        description_ml: `${title_ml}. ജോലിയിൽ ചേരുന്നതിനു മുമ്പ് രേഖാമൂലമുള്ള ഓഫർ ലെറ്റർ. ശമ്പളം നിങ്ങളുടെ സ്വന്തം ബാങ്ക് അക്കൗണ്ടിൽ. ഒറിജിനൽ സർട്ടിഫിക്കറ്റുകൾ തൊഴിലുടമ സൂക്ഷിക്കില്ല.`,
        checklist: Object.fromEntries(FAIR_WORK.map((k) => [k, true])), status: i === 11 ? 'closed' : 'open', posted_by: U.employer.id, posted_at: daysAgo(R.int(5, 120)), closes_on: day(R.int(10, 60)),
      }, U.employer));

      // applications — only adults with employment consent to the employer's agency
      const pool = demo.youth.filter((p) => !brain.policy.isMinor(p) && sqlOne('SELECT 1 x FROM consents WHERE person_id=? AND agency_id=? AND status=\'active\' AND deleted=0 AND scopes LIKE \'%"employment"%\'', p.id, A.glc.id));
      const flows = [['applied'], ['applied', 'shortlisted'], ['applied', 'shortlisted', 'interview'], ['applied', 'rejected'], ['applied', 'shortlisted', 'interview', 'offered'], ['applied', 'shortlisted', 'interview', 'offered', 'hired'], ['applied', 'withdrawn']];
      let placedN = 0;
      pool.forEach((p, i) => {
        const js = R.sample(jobs.slice(0, 11), R.int(1, 2));
        js.forEach((j, k) => {
          let flow = flows[(i + k) % flows.length];
          if (flow.includes('hired') && placedN >= 4) flow = flows[4];
          const start = R.int(20, 100);
          const history = flow.map((s, n) => ({ status: s, at: daysAgo(start - n * 6), by: s === 'applied' ? (R.chance(0.5) ? 'Applicant' : 'Facilitator referral') : s === 'withdrawn' ? 'Applicant' : j.employer_name }));
          const a = data.put('marketplace_applications', { job_id: j.id, agency_id: j.agency_id, person_id: p.id, hamlet_id: p.hamlet_id, status: flow[flow.length - 1], source: history[0].by === 'Applicant' ? 'self' : 'referral', history, applied_at: daysAgo(start) }, sys);
          if (flow.includes('hired')) {
            placedN++;
            const sd = daysAgo(start - flow.length * 6 - 7).slice(0, 10);
            data.put('marketplace_placements', { application_id: a.id, job_id: j.id, agency_id: j.agency_id, person_id: p.id, hamlet_id: p.hamlet_id, start_date: sd, wage_monthly: j.wage_monthly, status: placedN === 3 ? 'concern' : 'active', check_30: { at: daysAgo(10), by: 'Facilitator', paid_on_time: placedN !== 3, documents_with_youth: true, safe_accommodation: true, note: placedN === 3 ? 'Salary delayed by 12 days — employer contacted.' : 'Settling in well.' }, check_90: null }, sys);
            brain.passport.award({ person_id: p.id, type: 'milestone', ref: 'placement:' + j.id, title: `Placed: ${j.title} (${j.employer_name})`, level: 1, agency_id: j.agency_id }, sys);
          }
        });
      });
    });
  }

  return {
    seed,
    health: () => ({
      volunteers: sqlOne('SELECT COUNT(*) n FROM marketplace_volunteers WHERE deleted=0').n,
      donations_inr: sqlOne('SELECT COALESCE(SUM(amount),0) n FROM marketplace_donations WHERE deleted=0').n,
      open_jobs: sqlOne('SELECT COUNT(*) n FROM marketplace_jobs WHERE deleted=0 AND status=\'open\'').n,
      placements: sqlOne('SELECT COUNT(*) n FROM marketplace_placements WHERE deleted=0').n,
    }),
  };
};
