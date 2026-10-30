'use strict';
// AADI Brain — policy engine.
// Principle: the learner/guardian owns the record. An agency sees a person only
// while (a) that person is enrolled in one of the agency's programmes, AND
// (b) an active consent from the person (or guardian, if a minor) covers the scope.
// Platform stewards (CIF) can see everything, but every such access is audited.

const ROLES = {
  platform_admin: { label: 'Platform Steward (CIF)', level: 'platform' },
  cpo: { label: 'Child Protection Officer', level: 'platform' },
  agency_admin: { label: 'Agency Administrator', level: 'agency' },
  coordinator: { label: 'Hamlet Coordinator', level: 'agency' },
  facilitator: { label: 'Local Facilitator', level: 'agency' },
  teacher: { label: 'Remote Teacher', level: 'agency' },
  counsellor: { label: 'Counsellor', level: 'agency' },
  mentor: { label: 'Mentor / Volunteer', level: 'agency' },
  learner: { label: 'Learner', level: 'self' },
  guardian: { label: 'Guardian / Parent', level: 'self' },
  donor: { label: 'Donor / CSR', level: 'external' },
  employer: { label: 'Employer', level: 'external' },
  govt_viewer: { label: 'Government Viewer', level: 'external' },
};

// Coarse permissions; modules declare which they need per route.
const PERMS = {
  'platform.manage': ['platform_admin'],
  'agency.manage': ['platform_admin', 'agency_admin'],
  'hamlet.coordinate': ['platform_admin', 'agency_admin', 'coordinator'],
  'learner.read': ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'],
  'learner.write': ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'],
  'teach': ['platform_admin', 'agency_admin', 'facilitator', 'teacher'],
  'assess': ['platform_admin', 'agency_admin', 'facilitator', 'teacher'],
  'counsel': ['platform_admin', 'counsellor', 'cpo'],
  'mentor': ['mentor', 'counsellor', 'platform_admin'],
  'safeguard': ['platform_admin', 'cpo'],
  'content.author': ['platform_admin', 'agency_admin', 'facilitator', 'teacher', 'learner', 'mentor'],
  'content.review': ['platform_admin', 'agency_admin', 'teacher'],
  'learn': ['learner'],
  'family': ['guardian'],
  'donate': ['donor', 'platform_admin'],
  'hire': ['employer', 'platform_admin'],
  'analytics.aggregate': ['platform_admin', 'agency_admin', 'coordinator', 'donor', 'govt_viewer', 'cpo'],
  'ops': ['platform_admin', 'agency_admin', 'coordinator', 'facilitator'],
};

// Consent scopes a person can grant to an agency.
const SCOPES = {
  profile: 'Name, hamlet, age band, language',
  progress: 'Learning progress, attendance, assessments',
  wellbeing: 'Counselling and wellbeing check-ins',
  contact: 'Phone / guardian contact for messages',
  employment: 'Share profile with employers for jobs',
  research: 'Anonymised use in research and impact reports',
};

const K_ANON = 5; // aggregates below this count are suppressed

function makePolicy(store) {
  const can = (user, perm) => !!user && (PERMS[perm] || []).includes(user.role);

  function isMinor(p) {
    if (!p || !p.dob) return p && p.kind === 'child';
    const age = (Date.now() - new Date(p.dob).getTime()) / 3.15576e10;
    return age < 18;
  }

  function activeConsent(personId, agencyId, scope) {
    const rows = store.find('consents', { person_id: personId, agency_id: agencyId, status: 'active' });
    const now = new Date().toISOString();
    return rows.some((c) => (!c.expires_at || c.expires_at > now) && Array.isArray(c.scopes) && c.scopes.includes(scope));
  }

  function enrolledWith(personId, agencyId) {
    return !!store.one('SELECT 1 x FROM enrolments WHERE person_id=? AND agency_id=? AND deleted=0 AND status IN (\'active\',\'completed\')', personId, agencyId);
  }

  // Can `user` see `scope` data of person `personId`? Returns {ok, reason}.
  function canSee(user, personId, scope = 'profile') {
    if (!user) return { ok: false, reason: 'not signed in' };
    if (user.role === 'platform_admin' || user.role === 'cpo') return { ok: true, reason: 'steward', audited: true };
    if (user.person_id === personId) return { ok: true, reason: 'self' };
    if (user.role === 'guardian') {
      const p = store.get('persons', personId);
      if (p && p.guardian_id === user.person_id) return { ok: true, reason: 'guardian' };
      return { ok: false, reason: 'not your ward' };
    }
    if (['learner', 'donor', 'govt_viewer'].includes(user.role)) return { ok: false, reason: 'role has no person-level access' };
    if (user.role === 'employer') {
      // employers only via employment consent given to the employer's agency record
      return activeConsent(personId, user.agency_id, 'employment') ? { ok: true, reason: 'employment consent' } : { ok: false, reason: 'no employment consent' };
    }
    if (!user.agency_id) return { ok: false, reason: 'no agency' };
    if (scope === 'wellbeing' && !['counsellor'].includes(user.role)) return { ok: false, reason: 'wellbeing data is restricted to counsellors' };
    if (!enrolledWith(personId, user.agency_id)) return { ok: false, reason: 'person not enrolled with your agency' };
    if (!activeConsent(personId, user.agency_id, scope)) return { ok: false, reason: `no active "${scope}" consent for your agency` };
    return { ok: true, reason: 'enrolment + consent' };
  }

  // SQL fragment + params limiting persons to those visible to the user (profile scope).
  function visiblePersonIds(user) {
    if (!user) return [];
    if (user.role === 'platform_admin' || user.role === 'cpo') return null; // null = all
    if (user.role === 'learner') return [user.person_id];
    if (['donor', 'govt_viewer'].includes(user.role)) return []; // aggregates only
    if (user.role === 'guardian') return [user.person_id, ...store.all('SELECT id FROM persons WHERE guardian_id=? AND deleted=0', user.person_id).map((r) => r.id)];
    if (!user.agency_id) return [];
    const scope = user.role === 'employer' ? 'employment' : 'profile';
    const rows = store.all(`SELECT DISTINCT c.person_id id FROM consents c
      ${user.role === 'employer' ? '' : 'JOIN enrolments e ON e.person_id=c.person_id AND e.agency_id=c.agency_id AND e.deleted=0 AND e.status IN (\'active\',\'completed\')'}
      WHERE c.agency_id=? AND c.status='active' AND c.deleted=0 AND c.scopes LIKE ? AND (c.expires_at IS NULL OR c.expires_at > ?)`,
    user.agency_id, `%"${scope}"%`, new Date().toISOString());
    let ids = rows.map((r) => r.id);
    // Agency staff scoped to particular hamlets see only those hamlets.
    if (Array.isArray(user.hamlet_ids) && user.hamlet_ids.length) {
      const allowed = new Set(user.hamlet_ids);
      ids = ids.filter((id) => { const p = store.get('persons', id); return p && allowed.has(p.hamlet_id); });
    }
    return ids;
  }

  // k-anonymity guard for aggregates exposed to external roles
  function suppress(n, user) {
    if (user && ['platform_admin', 'agency_admin', 'coordinator', 'cpo'].includes(user.role)) return n;
    return n > 0 && n < K_ANON ? `<${K_ANON}` : n;
  }

  return { can, canSee, visiblePersonIds, activeConsent, enrolledWith, isMinor, suppress, ROLES, PERMS, SCOPES };
}

module.exports = { makePolicy, ROLES, PERMS, SCOPES, K_ANON };
