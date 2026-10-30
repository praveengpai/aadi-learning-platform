'use strict';
// Demo seed for the language module: 6 months of activity for learners in language programmes
// (youth + older children), speaking attempts with ratings (no audio stored in the seed),
// peer circles with attendance, and DEMO mother-tongue word lists.
//
// IMPORTANT: tribal-language "words" below are PLACEHOLDER demo entries, written in a form that is
// clearly marked as such (prefixed with a ⟨demo⟩ tag and status "draft"). They are NOT real
// Muthuvan / Paniya / Irula words and must be replaced by genuine community contributions.

function seedAll(ctx, demo, { COURSES, activities, BRIDGE_CONCEPTS, BRIDGE_LANGS, ROLEPLAYS, NEW_COMPETENCIES, syncLevels, SPEAK_CHECKS }) {
  const { data, tx, brain, sql } = ctx;
  const { R, daysAgo } = demo;
  const iso = (d) => d.toISOString().slice(0, 10);
  const inDays = (n) => iso(new Date(Date.now() + n * 86400e3));

  tx(() => {
    for (const [code, domain, title, title_ml, level, stage] of NEW_COMPETENCIES) brain.competencies.upsert({ id: 'cmp_' + code.toLowerCase().replace(/\./g, '_'), code, domain, title, title_ml, level, stage });
  });

  // ---------------------------------------------------------------- learners
  const progs = demo.programmes.filter((p) => p.track === 'language');
  const learners = new Map();
  for (const pr of progs) for (const p of demo.enrolledIn(pr.id)) { const x = learners.get(p.id) || { p, progs: [] }; x.progs.push(pr); learners.set(p.id, x); }

  const courseFor = (p) => {
    const list = ['eng-spoken'];
    if (p.kind === 'youth') { if (R.chance(0.5)) list.push('eng-written'); if (R.chance(0.3)) list.push('hindi'); if (R.chance(0.15)) list.push('german'); }
    if (p.literacy_level && ['basic', 'emerging'].includes(p.literacy_level) || (p.language && p.language !== 'Malayalam' && R.chance(0.35))) list.push('ml-literacy');
    return list;
  };
  const SPEAK_NOTES = ['Clear voice — slow down a little.', 'Good! Practise "th" sounds.', 'Well structured answer. Add one more detail about your strengths.', 'Nice confidence. Look up and smile in the interview.', 'Good pronunciation of numbers.', 'Try full sentences instead of single words.'];
  const staff = Object.values(demo.users).filter((u) => u.role === 'teacher');
  const reviewerFor = (agencyId) => staff.find((u) => u.agency_id === agencyId)?.display_name || 'Language teacher (demo)';

  const levelQueue = [];
  tx(() => {
    for (const { p, progs: myProgs } of learners.values()) {
      const isDemo = p.id === demo.demoYouth.id;
      const courses = isDemo ? ['eng-spoken', 'eng-written', 'hindi'] : courseFor(p);
      const pace = isDemo ? 0.85 : 0.2 + R.rnd() * 0.75; // share of activities done
      const startAgo = R.int(40, 175);
      for (const cid of courses) {
        const c = COURSES.find((x) => x.id === cid);
        const acts = activities(c);
        const n = Math.max(1, Math.round(acts.length * (cid === 'eng-spoken' ? pace : pace * 0.7)));
        acts.slice(0, n).forEach((a, i) => {
          const ago = Math.max(1, Math.round(startAgo - (startAgo - 2) * (i / Math.max(1, n - 1))) + R.int(-2, 2));
          const at = daysAgo(ago);
          const score = a.kind === 'quiz' ? Math.round((0.5 + R.rnd() * 0.5) * 100) / 100 : a.kind === 'vocab' ? Math.round((0.6 + R.rnd() * 0.4) * 100) / 100 : null;
          data.put('language_progress', { person_id: p.id, hamlet_id: p.hamlet_id, course_id: cid, unit_id: a.unit_id, activity_id: a.id, kind: a.kind, score, completed_at: at, data: a.kind === 'vocab' ? { known: Math.round((score || 0.7) * a.cards.length) } : a.kind === 'listen' ? { repeats: R.int(1, 4) } : null }, null);
          if (a.kind === 'speak' || (a.kind === 'listen' && R.chance(0.25)) || (a.kind === 'convo' && R.chance(0.3))) {
            const selfR = R.int(2, 5);
            const review = R.chance(0.65);
            const reviewed = review && R.chance(ago > 6 ? 0.85 : 0.2);
            const agencyId = myProgs[0].agency_id;
            data.put('language_speaking', { person_id: p.id, hamlet_id: p.hamlet_id, course_id: cid, unit_id: a.unit_id, activity_id: a.id, prompt: a.prompt || a.title, self_rating: selfR, peer_rating: R.chance(0.4) ? R.int(3, 5) : null, teacher_rating: reviewed ? Math.max(2, Math.min(5, selfR + R.int(-1, 1))) : null, teacher_note: reviewed ? R.pick(SPEAK_NOTES) : null, reviewer: reviewed ? reviewerFor(agencyId) : null, reviewed_at: reviewed ? daysAgo(Math.max(0, ago - R.int(1, 4))) : null, sample: null, sample_mime: null, sample_bytes: 0, duration_s: R.int(12, 70), request_review: review ? 1 : 0, status: reviewed ? 'reviewed' : review ? 'pending' : 'self', created_at: at, checks: R.sample(SPEAK_CHECKS, R.int(1, 4)) }, null);
          }
        });
      }
      levelQueue.push(p.id);
    }
  });
  // award levels (+ passport) based on seeded progress
  tx(() => { for (const pid of levelQueue) syncLevels(pid, null, { silent: true, at: daysAgo(R.int(3, 40)) }); });

  // ---------------------------------------------------------------- circles + attendance
  tx(() => {
    for (const pr of progs) {
      const enrolled = demo.enrolledIn(pr.id);
      for (let w = 22; w >= -2; w -= 2) {
        const rp = ROLEPLAYS[(w + 22 + pr.hamlet_id.length) % ROLEPLAYS.length];
        const held = w > 0;
        const c = data.put('language_circles', { agency_id: pr.agency_id, programme_id: pr.id, hamlet_id: pr.hamlet_id, title: `Circle: ${rp.title}`, title_ml: `കൂട്ടം: ${rp.title_ml}`, date: held ? daysAgo(w * 7).slice(0, 10) : inDays(-w * 7 + 2), time: (pr.schedule && pr.schedule[0] || 'Sat 16:00').split(' ')[1] || '16:00', place: 'Learning centre verandah', roleplay_id: rp.id, facilitator: pr.agency_id === demo.agencyByKey.uoc.id ? 'Dr. Anand (UOC)' : 'Centre facilitator', notes: held ? R.pick(['Good energy; shy learners spoke in pairs first.', 'Power cut — used phone torch, still fun!', 'Two new learners joined.', 'Practised numbers with a market game.', '']) : '', status: held ? 'held' : 'scheduled' }, null);
        if (!held) continue;
        for (const p of enrolled) data.put('language_attendance', { circle_id: c.id, programme_id: pr.id, person_id: p.id, hamlet_id: pr.hamlet_id, present: R.chance(p.id === demo.demoYouth.id ? 0.9 : 0.7) ? 1 : 0, role: R.chance(0.3) ? R.pick(['traveller', 'doctor', 'customer', 'interviewer', 'receptionist']) : null }, null);
      }
    }
  });

  // ---------------------------------------------------------------- mother-tongue bridge (DEMO)
  // Placeholder entries only — visibly tagged ⟨demo⟩. Not real tribal-language words.
  const contributors = demo.adults.concat(demo.youth);
  const langHamlet = { Muthuvan: 'h1', Irula: 'h2', Paniya: 'h3', Kanikkar: 'h5', Mannan: 'h9', Cholanaikkan: 'h7', Kurichiya: 'h4' };
  tx(() => {
    for (const lang of BRIDGE_LANGS) {
      const h = demo.hamletByKey[langHamlet[lang]];
      const local = contributors.filter((p) => p.hamlet_id === h.id);
      const n = { Muthuvan: 18, Irula: 16, Paniya: 14, Kanikkar: 8, Mannan: 6, Cholanaikkan: 4, Kurichiya: 5 }[lang] || 4;
      R.sample(BRIDGE_CONCEPTS, n).forEach(([en, ml, category], i) => {
        const who = local.length ? R.pick(local) : null;
        const status = i % 5 === 0 ? 'community_checked' : i % 7 === 3 ? 'needs_fix' : 'draft';
        data.put('language_words', { language: lang, hamlet_id: h.id, concept: en, en, ml, word: `⟨demo⟩ ${lang.slice(0, 3).toLowerCase()}-${en}`, pronunciation: '', category, note: 'Placeholder for the demo — to be replaced by a real community contribution.', contributor_id: null, contributor_name: who ? `${who.name.split(' ')[0]}, ${h.name} (demo)` : `${h.name} elders' circle (demo)`, status, reviews: status === 'draft' ? [] : [{ by: 'Community review circle (demo)', verdict: status, note: status === 'needs_fix' ? 'Elders say this differs by village — needs a second form.' : 'Agreed by three elders (demo).', at: daysAgo(R.int(2, 40)) }], demo: 1, created_at: daysAgo(R.int(5, 150)) }, null);
      });
    }
  });
}

module.exports = { seedAll };
