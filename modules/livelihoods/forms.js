'use strict';
// Livelihoods — form definitions (run on the Brain's form round-trip engine) and their rules.
// Rules are pure functions over the answers plus a read-only snapshot of the group's book; they never throw.
const L = require('./ledger');

const ch = (value, label, label_ml) => ({ value, label, label_ml });

const PURPOSES = [
  ch('enterprise', '🧺 Start or grow a small business', '🧺 ചെറിയ സംരംഭം തുടങ്ങാൻ / വളർത്താൻ'),
  ch('agriculture', '🌱 Farming / seeds / tools', '🌱 കൃഷി / വിത്ത് / ഉപകരണങ്ങൾ'),
  ch('livestock', '🐐 Goat, hens or cow', '🐐 ആട്, കോഴി, പശു'),
  ch('education', '📚 Children\'s education', '📚 കുട്ടികളുടെ പഠനം'),
  ch('health', '🏥 Treatment / hospital costs', '🏥 ചികിത്സാ ചെലവ്'),
  ch('house_repair', '🏠 House repair', '🏠 വീട് അറ്റകുറ്റപ്പണി'),
  ch('family_event', '🎉 Family function / festival', '🎉 കുടുംബ ചടങ്ങ് / ഉത്സവം'),
  ch('repay_moneylender', '🔁 Repay a moneylender', '🔁 പലിശക്കാരന്റെ കടം വീട്ടാൻ'),
  ch('other', 'Other', 'മറ്റുള്ളവ'),
];

const LOAN_FORM = {
  key: 'livelihoods.loan_request', title: 'Group loan request', title_ml: 'ഗ്രൂപ്പ് വായ്പ അപേക്ഷ',
  description: 'A member asks her group for an internal loan. The CDS / agency reviews it; the facilitator gives the loan at a meeting once approved.',
  subject: 'person', scope: 'livelihood', review: { perm: 'forms.review' },
  fields: [
    { name: 'group_id', type: 'text', label: 'Group', label_ml: 'ഗ്രൂപ്പ്', required: true, hint: 'Filled in by the app from the group book.', hint_ml: 'ഗ്രൂപ്പ് ബുക്കിൽ നിന്ന് ആപ്പ് പൂരിപ്പിക്കും.' },
    { name: 'purpose', type: 'select_one', label: 'What is the loan for?', label_ml: 'വായ്പ എന്തിനാണ്?', required: true, choices: PURPOSES },
    { name: 'purpose_note', type: 'text', label: 'A few words about it', label_ml: 'കുറച്ച് വാക്കുകളിൽ' },
    { name: 'amount', type: 'integer', label: 'How much? (₹)', label_ml: 'എത്ര തുക? (₹)', required: true, min: 100, max: 200000, unit: '₹' },
    { name: 'months', type: 'integer', label: 'Repay over how many months?', label_ml: 'എത്ര മാസം കൊണ്ട് തിരിച്ചടയ്ക്കും?', required: true, min: 1, max: L.MAX_MONTHS },
    { name: 'group_agreed', type: 'yes_no', label: 'Did the group meeting agree?', label_ml: 'ഗ്രൂപ്പ് യോഗം സമ്മതിച്ചോ?' },
  ],
};

const IDEA_KINDS = [
  ch('honey', '🍯 Honey / forest produce', '🍯 തേൻ / വനവിഭവം'), ch('crafts', '🧺 Bamboo, cane, crafts', '🧺 മുള, ചൂരൽ, കരകൗശലം'),
  ch('spices', '🌶️ Spices', '🌶️ സുഗന്ധവ്യഞ്ജനം'), ch('millets', '🌾 Millets / food products', '🌾 ചെറുധാന്യം / ഭക്ഷ്യോൽപ്പന്നം'),
  ch('tailoring', '🧵 Tailoring', '🧵 തയ്യൽ'), ch('shop', '🏪 Small shop', '🏪 ചെറിയ കട'), ch('livestock', '🐐 Livestock / poultry', '🐐 കന്നുകാലി / കോഴി'),
  ch('tourism', '🥾 Eco-tourism / guiding', '🥾 ഇക്കോ ടൂറിസം / ഗൈഡ്'), ch('other', 'Other', 'മറ്റുള്ളവ'),
];
const NEEDS = [
  ch('money', 'Money to start', 'തുടങ്ങാൻ പണം'), ch('training', 'Training', 'പരിശീലനം'), ch('tools', 'Tools / machine', 'ഉപകരണം / യന്ത്രം'),
  ch('market', 'Buyers / market', 'വാങ്ങുന്നവർ / വിപണി'), ch('space', 'A place to work', 'ജോലി ചെയ്യാൻ സ്ഥലം'), ch('licence', 'Licence / registration', 'ലൈസൻസ് / രജിസ്ട്രേഷൻ'),
];

const IDEA_FORM = {
  key: 'livelihoods.enterprise_idea', title: 'Enterprise idea', title_ml: 'സംരംഭ ആശയം',
  description: 'A person (or a family, through them) shares a business idea; the agency replies with advice and next steps.',
  subject: 'person', scope: 'livelihood', review: { perm: 'forms.review' },
  fields: [
    { name: 'kind', type: 'select_one', label: 'What kind of work?', label_ml: 'ഏതുതരം ജോലി?', required: true, choices: IDEA_KINDS },
    { name: 'idea', type: 'textarea', label: 'The idea in your own words', label_ml: 'ആശയം നിങ്ങളുടെ വാക്കുകളിൽ', required: true },
    { name: 'for_household', type: 'yes_no', label: 'Is this a family business?', label_ml: 'ഇത് കുടുംബ സംരംഭമാണോ?' },
    { name: 'needs', type: 'select_multiple', label: 'What do you need?', label_ml: 'എന്തൊക്കെ വേണം?', choices: NEEDS },
    { name: 'money_needed', type: 'integer', label: 'Money needed (₹, if known)', label_ml: 'വേണ്ട തുക (₹, അറിയാമെങ്കിൽ)', min: 0, max: 2000000, unit: '₹', relevant: { field: 'needs', equals: 'money' } },
    { name: 'skills', type: 'textarea', label: 'Skills you already have', label_ml: 'ഇപ്പോഴുള്ള കഴിവുകൾ' },
    { name: 'group_id', type: 'text', label: 'Group (if any)', label_ml: 'ഗ്രൂപ്പ് (ഉണ്ടെങ്കിൽ)' },
  ],
};

// Draft thresholds — content/RULES.md (PENDING REVIEW by Kudumbashree CDS / a microfinance adviser).
const T = { savingsMultiple: 4, longMonths: 24, bankLinkageRupees: 50000 };

// snapshot(groupId, personId) → { group, member, txns } read from the local node; may return nulls.
function loanRule(snapshot) {
  return (a, { person }) => {
    const flags = [];
    let priority = 0;
    const snap = snapshot(a.group_id, person && person.id) || {};
    if (!snap.group) return { flags: [{ code: 'unknown_group', level: 'urgent', message: 'Group not found on this device — check before deciding', message_ml: 'ഈ ഉപകരണത്തിൽ ഗ്രൂപ്പ് കണ്ടില്ല — തീരുമാനിക്കുംമുമ്പ് പരിശോധിക്കുക' }], priority: 3 };
    // Not a member: say so and nothing else — a flag must never reveal another group's book.
    if (!snap.member) return { flags: [{ code: 'not_member', level: 'urgent', message: 'This person is not an active member of the group', message_ml: 'ഇവർ ഈ ഗ്രൂപ്പിലെ സജീവ അംഗമല്ല' }], priority: 3 };
    const amount = Number(a.amount) * 100;
    const sum = L.summarize(snap.txns || []);
    if (amount > sum.lendable) {
      flags.push({ code: 'above_lendable', level: 'warn', message: 'More than the group can lend now (cash in hand + bank) — see the group book', message_ml: 'ഗ്രൂപ്പിന് ഇപ്പോൾ നൽകാവുന്നതിലും കൂടുതൽ (കൈയിലും ബാങ്കിലും ഉള്ളത്) — ഗ്രൂപ്പ് ബുക്ക് കാണുക' });
      priority = Math.max(priority, 2);
    }
    if (person) {
      const me = L.memberSummary(snap.txns || [], person.id);
      if (me.overdue > 0) {
        flags.push({ code: 'member_overdue', level: 'warn', message: 'Member already has an overdue loan', message_ml: 'അംഗത്തിന് ഇപ്പോൾ തന്നെ കുടിശ്ശികയുള്ള വായ്പയുണ്ട്' });
        priority = Math.max(priority, 2);
      } else if (me.outstanding > 0) flags.push({ code: 'existing_loan', level: 'info', message: 'Member is repaying another loan on time', message_ml: 'അംഗം മറ്റൊരു വായ്പ കൃത്യമായി തിരിച്ചടയ്ക്കുന്നു' });
      if (me.savings > 0 && amount > me.savings * T.savingsMultiple) flags.push({ code: 'above_savings_multiple', level: 'info', message: `More than ${T.savingsMultiple}× her own savings`, message_ml: `സ്വന്തം സമ്പാദ്യത്തിന്റെ ${T.savingsMultiple} ഇരട്ടിയിലധികം` });
    }
    if (Number(a.months) > T.longMonths) flags.push({ code: 'long_term', level: 'info', message: `Long repayment period (${a.months} months)`, message_ml: `നീണ്ട തിരിച്ചടവ് കാലാവധി (${a.months} മാസം)` });
    if (a.purpose === 'repay_moneylender') flags.push({ code: 'debt_swap', level: 'info', message: 'Swapping a moneylender\'s loan — ask about the interest being paid now', message_ml: 'പലിശക്കാരന്റെ കടം മാറ്റാൻ — ഇപ്പോഴത്തെ പലിശ ചോദിക്കുക' });
    if (a.group_agreed === 'no') flags.push({ code: 'group_not_agreed', level: 'warn', message: 'The group meeting has not agreed yet', message_ml: 'ഗ്രൂപ്പ് യോഗം ഇതുവരെ സമ്മതിച്ചിട്ടില്ല' });
    return { flags, priority };
  };
}

function ideaRule(a) {
  const flags = [];
  const needs = Array.isArray(a.needs) ? a.needs : [];
  if (Number(a.money_needed) > T.bankLinkageRupees) flags.push({ code: 'bank_linkage', level: 'info', message: 'Large amount — consider bank linkage or a government scheme, not only the group fund', message_ml: 'വലിയ തുക — ഗ്രൂപ്പ് ഫണ്ട് മാത്രമല്ല, ബാങ്ക് ലിങ്കേജോ സർക്കാർ പദ്ധതിയോ നോക്കുക' });
  if (needs.includes('licence') || ['millets', 'honey', 'spices'].includes(a.kind)) flags.push({ code: 'food_licence', level: 'info', message: 'Food products sold outside the hamlet usually need FSSAI registration', message_ml: 'ഊരിന് പുറത്ത് വിൽക്കുന്ന ഭക്ഷ്യോൽപ്പന്നങ്ങൾക്ക് സാധാരണ FSSAI രജിസ്ട്രേഷൻ വേണം' });
  if (needs.includes('market')) flags.push({ code: 'market_link', level: 'info', message: 'Could be listed in the platform catalogue through the city partner', message_ml: 'നഗര പങ്കാളി വഴി പ്ലാറ്റ്ഫോം കാറ്റലോഗിൽ ചേർക്കാം' });
  return { flags, priority: 0 };
}

module.exports = { LOAN_FORM, IDEA_FORM, PURPOSES, IDEA_KINDS, NEEDS, T, loanRule, ideaRule };
