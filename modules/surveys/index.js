'use strict';
// Forms & Surveys — the generic face of the Brain's form round-trip engine.
// Service modules (health, government services, agriculture …) define their own forms and rules;
// this module lets agencies design simple community surveys (or import ODK XLSForms) without code.
module.exports = function init(ctx) {
  const { router, requires, brain, httpError, tx } = ctx;

  // A small summary for the home screen: what this user can fill in, what is waiting for them.
  router.get('/summary', requires('forms.capture', 'forms.review'), (req, res) => {
    const forms = brain.forms; // module-scoped: only this module's forms
    const mine = forms.list(req.user, { mine: true, limit: 500 });
    res.json({
      my_open: mine.filter((s) => ['submitted', 'in_review'].includes(s.status)).length,
      replies_new: mine.filter((s) => s.status === 'replied' && !s.reply_seen_at).length,
      to_review: forms.queue(req.user).length,
    });
  });

  // Seed: one household survey, defined the same way a designer would, plus a few demo answers.
  const HOUSEHOLD = {
    key: 'survey.household_basics', title: 'Household basics survey', title_ml: 'കുടുംബ അടിസ്ഥാന സർവേ',
    description: 'Water, power, documents and phone access — helps plan which services a hamlet needs.',
    subject: 'household', scope: 'survey', review: null,
    fields: [
      { name: 'members', type: 'integer', label: 'People living in the house', label_ml: 'വീട്ടിൽ താമസിക്കുന്നവർ', required: true, min: 1, max: 30 },
      { name: 'water', type: 'select_one', label: 'Main drinking water source', label_ml: 'കുടിവെള്ളം എവിടെ നിന്ന്', required: true, choices: [
        { value: 'tap', label: 'Tap / pipe', label_ml: 'പൈപ്പ്' }, { value: 'well', label: 'Well', label_ml: 'കിണർ' }, { value: 'stream', label: 'Stream / spring', label_ml: 'അരുവി / ഉറവ' }, { value: 'other', label: 'Other', label_ml: 'മറ്റുള്ളവ' }] },
      { name: 'power', type: 'yes_no', label: 'Electricity at home?', label_ml: 'വീട്ടിൽ വൈദ്യുതി ഉണ്ടോ?', required: true },
      { name: 'smartphone', type: 'yes_no', label: 'Anyone in the house has a smartphone?', label_ml: 'വീട്ടിൽ ആർക്കെങ്കിലും സ്മാർട്ട്ഫോൺ ഉണ്ടോ?', required: true },
      { name: 'documents_missing', type: 'select_multiple', label: 'Documents someone in the house still needs', label_ml: 'വീട്ടിൽ ആർക്കെങ്കിലും ഇനിയും വേണ്ട രേഖകൾ', choices: [
        { value: 'aadhaar', label: 'Aadhaar', label_ml: 'ആധാർ' }, { value: 'ration', label: 'Ration card', label_ml: 'റേഷൻ കാർഡ്' }, { value: 'community', label: 'Community certificate', label_ml: 'ജാതി സർട്ടിഫിക്കറ്റ്' }, { value: 'bank', label: 'Bank account', label_ml: 'ബാങ്ക് അക്കൗണ്ട്' }, { value: 'none', label: 'None', label_ml: 'ഒന്നുമില്ല' }] },
      { name: 'notes', type: 'textarea', label: 'Anything else the family wants to say', label_ml: 'കുടുംബത്തിന് പറയാനുള്ളത്' },
    ],
  };

  // Module forms are defined at start-up (idempotent), so a fresh production node has them too.
  brain.forms.define(HOUSEHOLD, null);

  return {
    seed: async (demo) => {
      const { daysAgo, store, brain: B } = demo;
      const R = demo.rng(7101); // own random stream
      const def = B.forms.getDef(HOUSEHOLD.key);
      // CIF asked heads of households in Pachakkudi (h1) for survey consent; most agreed.
      const cif = demo.agencyByKey.cif;
      const h1 = demo.hamletByKey.h1;
      const fac = demo.users.facilitator;
      tx(() => {
        const heads = demo.households.filter((h) => h.hamlet_id === h1.id).slice(0, 14);
        let n = 0;
        for (const hh of heads) {
          if (!R.chance(0.85)) continue;
          const cur = store.find('consents', { person_id: hh.head_person_id, agency_id: cif.id, status: 'active' })[0];
          B.grantConsent({ person_id: hh.head_person_id, agency_id: cif.id, scopes: [...new Set([...(cur ? cur.scopes : ['profile']), 'survey'])], granted_by: hh.head_person_id, relation: 'self', method: 'in_person' }, null);
          if (n++ >= 9) continue;
          const answers = { members: R.int(2, 7), water: R.pick(['tap', 'well', 'well', 'stream']), power: R.chance(0.8) ? 'yes' : 'no', smartphone: R.chance(0.55) ? 'yes' : 'no', documents_missing: R.chance(0.5) ? ['none'] : R.sample(['aadhaar', 'ration', 'community', 'bank'], R.int(1, 2)) };
          const row = B.forms.submit(B.store.get('users', fac.id), { form_key: def.key, household_id: hh.id, answers, client_ref: 'seed-hh-' + hh.id }, {});
          store.put('form_submissions', { ...store.get('form_submissions', row.id), captured_at: daysAgo(R.int(3, 40)) });
        }
      });
    },
    health: () => ({ forms: brain.forms.list ? 'ok' : 'missing' }),
  };
};
