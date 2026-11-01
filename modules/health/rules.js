'use strict';
// Health & Elder Screening — the module's sub-engine (rules) and doctor advice templates.
// Pure functions: no I/O, never throw (the engine also guards). Every threshold here is listed with its
// source in content/RULES.md and is PENDING CLINICAL REVIEW. Rules NEVER diagnose: every message says
// "refer / recheck / doctor to review".

const LEVEL_PRIORITY = { urgent: 3, warn: 1, info: 0 };

// Build {flags, priority}. priority = highest level (urgent 3, warn 1); two or more warnings → 2 (high).
// A flag may carry its own `p` to raise priority (e.g. high BP in pregnancy → 2).
function finish(flags) {
  let p = 0;
  for (const f of flags) p = Math.max(p, f.p !== undefined ? f.p : LEVEL_PRIORITY[f.level] || 0);
  if (p < 2 && flags.filter((f) => f.level === 'warn').length >= 2) p = 2;
  return { flags: flags.map(({ p: _p, ...f }) => f), priority: p };
}
const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);
const F = (code, level, message, message_ml, p) => ({ code, level, message, message_ml, ...(p !== undefined ? { p } : {}) });

// Shared blood-pressure check (adults, non-pregnant).
function bpFlags(sys, dia, out) {
  if (sys === null && dia === null) return;
  if (sys !== null && dia !== null && dia >= sys) { out.push(F('bp_entry_check', 'info', 'Diastolic is not lower than systolic — please check the reading was entered correctly.', 'ഡയസ്റ്റോളിക് സിസ്റ്റോളിക്കിനേക്കാൾ കുറവല്ല — റീഡിംഗ് ശരിയായി രേഖപ്പെടുത്തിയോ എന്ന് പരിശോധിക്കുക.')); return; }
  if ((sys !== null && sys >= 180) || (dia !== null && dia >= 110)) out.push(F('bp_very_high', 'urgent', 'Very high BP — recheck after 5 minutes rest; if still this high, refer today. Doctor to review.', 'വളരെ ഉയർന്ന ബിപി — 5 മിനിറ്റ് വിശ്രമിച്ച ശേഷം വീണ്ടും നോക്കുക; എന്നിട്ടും ഉയർന്നാൽ ഇന്നുതന്നെ റഫർ ചെയ്യുക. ഡോക്ടർ പരിശോധിക്കും.'));
  else if ((sys !== null && sys >= 140) || (dia !== null && dia >= 90)) out.push(F('bp_high', 'warn', 'BP above 140/90 — recheck on the next visit; doctor to review.', 'ബിപി 140/90-ന് മുകളിൽ — അടുത്ത സന്ദർശനത്തിൽ വീണ്ടും നോക്കുക; ഡോക്ടർ പരിശോധിക്കും.'));
  else if (sys !== null && sys < 90) out.push(F('bp_low', 'warn', 'Low BP (systolic under 90) — recheck; doctor to review, especially if dizzy.', 'കുറഞ്ഞ ബിപി (സിസ്റ്റോളിക് 90-ൽ താഴെ) — വീണ്ടും നോക്കുക; തലകറക്കമുണ്ടെങ്കിൽ പ്രത്യേകിച്ചും ഡോക്ടർ പരിശോധിക്കും.'));
}

// ---------------- health.vitals ----------------
function vitals(a, { person } = {}) {
  const out = [];
  const sys = num(a.bp_sys), dia = num(a.bp_dia), pulse = num(a.pulse), temp = num(a.temp_c), sugar = num(a.sugar), wt = num(a.weight_kg), ht = num(a.height_cm);
  const sym = Array.isArray(a.symptoms) ? a.symptoms : [];
  bpFlags(sys, dia, out);
  if (pulse !== null && (pulse >= 120 || pulse <= 50)) out.push(F('pulse_abnormal', 'warn', `Pulse ${pulse}/min is outside the usual range — recheck at rest; doctor to review.`, `നാഡിമിടിപ്പ് ${pulse}/മിനിറ്റ് സാധാരണ പരിധിക്ക് പുറത്ത് — വിശ്രമിച്ച ശേഷം വീണ്ടും നോക്കുക; ഡോക്ടർ പരിശോധിക്കും.`));
  if (temp !== null && temp >= 39) out.push(F('fever_high', 'warn', 'High fever (39 °C or more) — doctor to review; give fluids. Refer if drowsy, fits or breathless.', 'കടുത്ത പനി (39 °C അല്ലെങ്കിൽ കൂടുതൽ) — ഡോക്ടർ പരിശോധിക്കും; വെള്ളം കുടിപ്പിക്കുക. മയക്കം, അപസ്മാരം, ശ്വാസതടസ്സം ഉണ്ടെങ്കിൽ റഫർ ചെയ്യുക.'));
  else if (temp !== null && temp < 35) out.push(F('temp_low', 'warn', 'Very low temperature (under 35 °C) — keep warm and recheck; doctor to review.', 'വളരെ കുറഞ്ഞ ശരീരതാപം (35 °C-ൽ താഴെ) — ചൂട് നൽകി വീണ്ടും നോക്കുക; ഡോക്ടർ പരിശോധിക്കും.'));
  if (sugar !== null) {
    if (sugar < 70) out.push(F('sugar_low', 'urgent', 'Low blood sugar (under 70) — give sugar/sweet drink now if awake, recheck in 15 minutes; refer today.', 'രക്തത്തിലെ പഞ്ചസാര കുറവ് (70-ൽ താഴെ) — ബോധമുണ്ടെങ്കിൽ ഉടൻ മധുരം നൽകുക, 15 മിനിറ്റിൽ വീണ്ടും നോക്കുക; ഇന്നുതന്നെ റഫർ ചെയ്യുക.'));
    else if (sugar >= 300) out.push(F('sugar_very_high', 'urgent', 'Very high blood sugar (300 or more) — refer today; doctor to review.', 'വളരെ ഉയർന്ന പഞ്ചസാര (300 അല്ലെങ്കിൽ കൂടുതൽ) — ഇന്നുതന്നെ റഫർ ചെയ്യുക; ഡോക്ടർ പരിശോധിക്കും.'));
    else if (a.sugar_type === 'fasting' && sugar >= 126) out.push(F('sugar_high_fasting', 'warn', 'Fasting sugar 126 or more — repeat test at the health centre; doctor to review.', 'വെറുംവയറ്റിലെ പഞ്ചസാര 126 അല്ലെങ്കിൽ കൂടുതൽ — ആരോഗ്യ കേന്ദ്രത്തിൽ വീണ്ടും പരിശോധിക്കുക; ഡോക്ടർ പരിശോധിക്കും.'));
    else if (a.sugar_type !== 'fasting' && sugar >= 200) out.push(F('sugar_high_random', 'warn', 'Random sugar 200 or more — repeat test at the health centre; doctor to review.', 'ഏതുസമയത്തെയും പഞ്ചസാര 200 അല്ലെങ്കിൽ കൂടുതൽ — ആരോഗ്യ കേന്ദ്രത്തിൽ വീണ്ടും പരിശോധിക്കുക; ഡോക്ടർ പരിശോധിക്കും.'));
  }
  if (has(sym, 'chest_pain')) out.push(F('chest_pain', 'urgent', 'Chest pain — refer today (call 108 if severe, sweating or breathless). Doctor to review.', 'നെഞ്ചുവേദന — ഇന്നുതന്നെ റഫർ ചെയ്യുക (കഠിനമാണെങ്കിൽ, വിയർക്കുന്നുണ്ടെങ്കിൽ, ശ്വാസംമുട്ടുണ്ടെങ്കിൽ 108 വിളിക്കുക). ഡോക്ടർ പരിശോധിക്കും.'));
  if (has(sym, 'breathless')) out.push(has(sym, 'chest_pain') ? F('breathless', 'urgent', 'Breathless with chest pain — refer today.', 'നെഞ്ചുവേദനയോടൊപ്പം ശ്വാസംമുട്ട് — ഇന്നുതന്നെ റഫർ ചെയ്യുക.') : F('breathless', 'warn', 'Breathlessness — doctor to review; refer today if breathless at rest.', 'ശ്വാസംമുട്ട് — ഡോക്ടർ പരിശോധിക്കും; വിശ്രമത്തിലും ശ്വാസംമുട്ടുണ്ടെങ്കിൽ ഇന്നുതന്നെ റഫർ ചെയ്യുക.'));
  if (has(sym, 'cough_2w')) out.push(F('cough_2w', 'warn', 'Cough for more than 2 weeks — refer for a free sputum test (TB screening). Doctor to review.', 'രണ്ടാഴ്ചയിൽ കൂടുതലുള്ള ചുമ — സൗജന്യ കഫ പരിശോധനയ്ക്ക് (ടിബി സ്ക്രീനിംഗ്) റഫർ ചെയ്യുക. ഡോക്ടർ പരിശോധിക്കും.'));
  if (has(sym, 'wound')) out.push(F('wound', 'info', 'Wound — doctor to review (photo helps). Keep clean and covered.', 'മുറിവ് — ഡോക്ടർ പരിശോധിക്കും (ഫോട്ടോ സഹായിക്കും). വൃത്തിയായി മൂടി വയ്ക്കുക.'));
  if (has(sym, 'swelling')) out.push(F('swelling', 'info', 'Swelling — doctor to review.', 'നീര് — ഡോക്ടർ പരിശോധിക്കും.'));
  if (has(sym, 'diarrhoea')) out.push(F('diarrhoea', 'info', 'Loose motions — give ORS (and zinc for children); refer if blood in stool, very weak or not drinking.', 'വയറിളക്കം — ഒആർഎസ് നൽകുക (കുട്ടികൾക്ക് സിങ്കും); മലത്തിൽ രക്തം, വളരെ ക്ഷീണം, കുടിക്കാൻ പറ്റാത്ത അവസ്ഥ എന്നിവയുണ്ടെങ്കിൽ റഫർ ചെയ്യുക.'));
  const age = person && Number.isFinite(person.age) ? person.age : null;
  if (wt !== null && ht !== null && ht >= 100 && (age === null || age >= 18)) {
    const bmi = wt / ((ht / 100) ** 2);
    if (bmi < 18.5) out.push(F('bmi_low', 'warn', `Low weight for height (BMI ${bmi.toFixed(1)}) — nutrition check; doctor to review.`, `ഉയരത്തിനനുസരിച്ച് ഭാരം കുറവ് (BMI ${bmi.toFixed(1)}) — പോഷണ പരിശോധന; ഡോക്ടർ പരിശോധിക്കും.`));
    else if (bmi >= 30) out.push(F('bmi_high', 'info', `High weight for height (BMI ${bmi.toFixed(1)}) — lifestyle advice at the next camp.`, `ഉയരത്തിനനുസരിച്ച് ഭാരം കൂടുതൽ (BMI ${bmi.toFixed(1)}) — അടുത്ത ക്യാമ്പിൽ ജീവിതശൈലി ഉപദേശം.`));
  }
  return finish(out);
}

// ---------------- health.child_growth ----------------
function childGrowth(a) {
  const out = [];
  const months = num(a.age_months), muac = num(a.muac_cm);
  const muacApplies = months === null || (months >= 6 && months <= 59);
  if (a.oedema === 'yes') out.push(F('bilateral_oedema', 'urgent', 'Swelling of both feet — refer today to the health centre / Nutrition Rehabilitation Centre (NRC).', 'രണ്ടു കാലിലും നീര് — ഇന്നുതന്നെ ആരോഗ്യ കേന്ദ്രത്തിലേക്ക് / പോഷണ പുനരധിവാസ കേന്ദ്രത്തിലേക്ക് (NRC) റഫർ ചെയ്യുക.'));
  if (muac !== null && muacApplies) {
    if (muac < 11.5) out.push(F('muac_sam', 'urgent', 'MUAC under 11.5 cm (red) — refer this week to the health centre / NRC; doctor to review.', 'MUAC 11.5 സെ.മീ-ൽ താഴെ (ചുവപ്പ്) — ഈ ആഴ്ചതന്നെ ആരോഗ്യ കേന്ദ്രത്തിലേക്ക് / NRC-യിലേക്ക് റഫർ ചെയ്യുക; ഡോക്ടർ പരിശോധിക്കും.'));
    else if (muac < 12.5) out.push(F('muac_mam', 'warn', 'MUAC 11.5–12.4 cm (yellow) — extra feeding through the Anganwadi; recheck in 2 weeks.', 'MUAC 11.5–12.4 സെ.മീ (മഞ്ഞ) — അങ്കണവാടി വഴി അധിക ഭക്ഷണം; 2 ആഴ്ചയ്ക്കുള്ളിൽ വീണ്ടും അളക്കുക.'));
  } else if (muac !== null && !muacApplies) out.push(F('muac_age', 'info', 'MUAC colour bands apply to 6–59 months — doctor to review weight and height instead.', 'MUAC നിറ അളവുകൾ 6–59 മാസം പ്രായത്തിന് മാത്രം — ഭാരവും ഉയരവും ഡോക്ടർ പരിശോധിക്കും.'));
  if (a.eating_well === 'no') {
    const severe = out.some((f) => f.level === 'urgent');
    out.push(severe ? F('not_eating', 'urgent', 'Not eating well with signs above — refer today.', 'മുകളിലെ ലക്ഷണങ്ങളോടൊപ്പം ഭക്ഷണം കഴിക്കുന്നില്ല — ഇന്നുതന്നെ റഫർ ചെയ്യുക.') : F('not_eating', 'warn', 'Child not eating well — check for illness; doctor to review.', 'കുട്ടി നന്നായി ഭക്ഷണം കഴിക്കുന്നില്ല — അസുഖമുണ്ടോ എന്ന് നോക്കുക; ഡോക്ടർ പരിശോധിക്കും.'));
  }
  return finish(out);
}

// ---------------- health.antenatal ----------------
const DANGER = {
  bleeding: ['Bleeding', 'രക്തസ്രാവം'],
  headache_vision: ['Severe headache / blurred vision', 'കഠിനമായ തലവേദന / കാഴ്ച മങ്ങൽ'],
  fits: ['Fits', 'അപസ്മാരം'],
  abdominal_pain: ['Severe abdominal pain', 'കഠിനമായ വയറുവേദന'],
  reduced_movement: ['Reduced baby movements', 'കുഞ്ഞിന്റെ അനക്കം കുറവ്'],
  fever: ['Fever', 'പനി'],
  face_swelling: ['Swelling of face/hands', 'മുഖത്തും കൈകളിലും നീര്'],
};
function antenatal(a) {
  const out = [];
  const sys = num(a.bp_sys), dia = num(a.bp_dia), hb = num(a.hb), weeks = num(a.weeks), anc = num(a.anc_visits);
  for (const d of Array.isArray(a.danger_signs) ? a.danger_signs : []) {
    if (!DANGER[d]) continue;
    out.push(F('danger_' + d, 'urgent', `Danger sign: ${DANGER[d][0]} — refer to hospital today (call 108).`, `അപകട ലക്ഷണം: ${DANGER[d][1]} — ഇന്നുതന്നെ ആശുപത്രിയിലേക്ക് റഫർ ചെയ്യുക (108 വിളിക്കുക).`));
  }
  if ((sys !== null && sys >= 160) || (dia !== null && dia >= 110)) out.push(F('anc_bp_severe', 'urgent', 'Very high BP in pregnancy (160/110 or more) — refer to hospital today.', 'ഗർഭകാലത്ത് വളരെ ഉയർന്ന ബിപി (160/110 അല്ലെങ്കിൽ കൂടുതൽ) — ഇന്നുതന്നെ ആശുപത്രിയിലേക്ക് റഫർ ചെയ്യുക.'));
  else if ((sys !== null && sys >= 140) || (dia !== null && dia >= 90)) out.push(F('anc_bp_high', 'warn', 'BP 140/90 or more in pregnancy — refer to the PHC doctor within 1–2 days.', 'ഗർഭകാലത്ത് ബിപി 140/90 അല്ലെങ്കിൽ കൂടുതൽ — 1–2 ദിവസത്തിനകം പിഎച്ച്സി ഡോക്ടറുടെ അടുത്തേക്ക് റഫർ ചെയ്യുക.', 2));
  if (hb !== null) {
    if (hb < 7) out.push(F('hb_severe', 'urgent', 'Hb under 7 g/dL — refer to hospital this week; doctor to review.', 'എച്ച്ബി 7 g/dL-ൽ താഴെ — ഈ ആഴ്ചതന്നെ ആശുപത്രിയിലേക്ക് റഫർ ചെയ്യുക; ഡോക്ടർ പരിശോധിക്കും.'));
    else if (hb < 10) out.push(F('hb_moderate', 'warn', 'Hb 7–9.9 g/dL — doctor to review iron treatment.', 'എച്ച്ബി 7–9.9 g/dL — അയൺ ചികിത്സ ഡോക്ടർ പരിശോധിക്കും.'));
    else if (hb < 11) out.push(F('hb_mild', 'info', 'Hb 10–10.9 g/dL — continue iron tablets; recheck next visit.', 'എച്ച്ബി 10–10.9 g/dL — അയൺ ഗുളിക തുടരുക; അടുത്ത തവണ വീണ്ടും നോക്കുക.'));
  }
  if (weeks !== null && weeks >= 40) out.push(F('anc_term', 'warn', '40 weeks or more — doctor to review delivery plan this week.', '40 ആഴ്ചയോ അതിൽ കൂടുതലോ — ഈ ആഴ്ച തന്നെ പ്രസവ പദ്ധതി ഡോക്ടർ പരിശോധിക്കും.'));
  else if (weeks !== null && weeks >= 36) out.push(F('anc_plan_delivery', 'info', 'Near term — confirm hospital delivery plan and transport (108 / JSSK).', 'പ്രസവം അടുത്തു — ആശുപത്രി പ്രസവവും യാത്രാ സൗകര്യവും (108 / JSSK) ഉറപ്പാക്കുക.'));
  if (weeks !== null && anc !== null && ((weeks >= 36 && anc < 4) || (weeks >= 28 && anc < 3) || (weeks >= 16 && anc < 1))) out.push(F('anc_behind', 'info', 'Fewer antenatal check-ups than expected — help her attend the next ANC day.', 'പ്രതീക്ഷിച്ചതിലും കുറവ് ഗർഭകാല പരിശോധനകൾ — അടുത്ത ANC ദിവസം പങ്കെടുക്കാൻ സഹായിക്കുക.'));
  return finish(out);
}

// ---------------- health.elder_screen ----------------
function elderScreen(a, { person } = {}) {
  const out = [];
  if (person && Number.isFinite(person.age) && person.age < 60) out.push(F('elder_age', 'info', 'This screen is designed for people aged 60 or more.', 'ഈ പരിശോധന 60 വയസ്സും അതിൽ കൂടുതലുമുള്ളവർക്കാണ്.'));
  if (a.falls === '2plus' || (a.falls === '1' && a.fear_falling === 'yes')) out.push(F('falls_risk', 'warn', 'Fall risk (2+ falls, or a fall with fear of falling) — doctor to review; check home safety.', 'വീഴ്ചാ സാധ്യത (2-ഓ അതിലധികമോ വീഴ്ച, അല്ലെങ്കിൽ വീഴുമോ എന്ന ഭയത്തോടെ ഒരു വീഴ്ച) — ഡോക്ടർ പരിശോധിക്കും; വീട്ടിലെ സുരക്ഷ നോക്കുക.'));
  else if (a.falls === '1') out.push(F('fall_once', 'info', 'One fall in the last year — check home safety.', 'കഴിഞ്ഞ വർഷം ഒരു വീഴ്ച — വീട്ടിലെ സുരക്ഷ നോക്കുക.'));
  if (a.vision === 'yes') out.push(F('vision', 'info', 'Difficulty seeing — refer for an eye check.', 'കാഴ്ചക്കുറവ് — കണ്ണ് പരിശോധനയ്ക്ക് റഫർ ചെയ്യുക.'));
  if (a.hearing === 'yes') out.push(F('hearing', 'info', 'Difficulty hearing — refer for a hearing check.', 'കേൾവിക്കുറവ് — കേൾവി പരിശോധനയ്ക്ക് റഫർ ചെയ്യുക.'));
  const recall = num(a.recall);
  if (recall !== null && recall <= 1) out.push(F('memory_check', 'warn', 'Memory check suggested (recall 0–1 of 3 words) — doctor to review. Do not label; many causes are treatable.', 'ഓർമ്മ പരിശോധന നിർദ്ദേശിക്കുന്നു (3 വാക്കുകളിൽ 0–1 മാത്രം ഓർത്തു) — ഡോക്ടർ പരിശോധിക്കും. ലേബൽ ചെയ്യരുത്; പല കാരണങ്ങളും ചികിത്സിക്കാവുന്നവയാണ്.'));
  else if (a.memory_trouble === 'yes') out.push(F('memory_concern', 'info', 'Family notices memory trouble — recheck at the next screen.', 'ഓർമ്മക്കുറവ് കുടുംബം ശ്രദ്ധിക്കുന്നു — അടുത്ത പരിശോധനയിൽ വീണ്ടും നോക്കുക.'));
  const phq = (num(a.phq_interest) || 0) + (num(a.phq_mood) || 0);
  if (phq >= 3) out.push(F('mood_check', 'warn', 'Low mood screen positive (PHQ-2 score 3 or more) — refer to counsellor/doctor; do not label.', 'മനോവിഷമ സ്ക്രീൻ പോസിറ്റീവ് (PHQ-2 സ്കോർ 3 അല്ലെങ്കിൽ കൂടുതൽ) — കൗൺസിലർ/ഡോക്ടറുടെ അടുത്തേക്ക് റഫർ ചെയ്യുക; ലേബൽ ചെയ്യരുത്.'));
  if (a.weight_loss === 'yes') out.push(F('weight_loss', 'warn', 'Unintended weight loss — doctor to review.', 'അറിയാതെ ഭാരം കുറയുന്നു — ഡോക്ടർ പരിശോധിക്കും.'));
  const needs = Array.isArray(a.adl_help) ? a.adl_help.filter((x) => x !== 'none') : [];
  if (needs.length && a.lives_alone === 'yes') out.push(F('alone_needs_help', 'warn', 'Lives alone and needs help with daily activities — arrange support; doctor and panchayat to review.', 'ഒറ്റയ്ക്ക് താമസിക്കുന്നു, ദൈനംദിന കാര്യങ്ങൾക്ക് സഹായം വേണം — പിന്തുണ ഒരുക്കുക; ഡോക്ടറും പഞ്ചായത്തും പരിശോധിക്കും.'));
  else if (needs.length) out.push(F('needs_help', 'info', 'Needs help with daily activities — note for the care plan.', 'ദൈനംദിന കാര്യങ്ങൾക്ക് സഹായം വേണം — പരിചരണ പദ്ധതിയിൽ ചേർക്കുക.'));
  const meds = num(a.medicines);
  if (meds !== null && meds >= 5) out.push(F('polypharmacy', 'info', `${meds} regular medicines — doctor to review the medicine list (bring all strips to the camp).`, `${meds} സ്ഥിരം മരുന്നുകൾ — മരുന്നുകളുടെ പട്ടിക ഡോക്ടർ പരിശോധിക്കും (എല്ലാ സ്ട്രിപ്പുകളും ക്യാമ്പിൽ കൊണ്ടുവരിക).`));
  if (a.pension === 'no') out.push(F('pension_check', 'info', 'No pension — check eligibility for a welfare pension.', 'പെൻഷൻ ഇല്ല — ക്ഷേമ പെൻഷന് അർഹതയുണ്ടോ എന്ന് നോക്കുക.'));
  return finish(out);
}

const RULES = { 'health.vitals': vitals, 'health.child_growth': childGrowth, 'health.antenatal': antenatal, 'health.elder_screen': elderScreen };

// ---------------- doctor advice templates ----------------
// Written in plain words for the family (the family view shows only the reply). PENDING CLINICAL REVIEW.
// follow_up: default weeks; reason: staff-facing follow-up note for the ASHA.
const ADVICE = [
  { key: 'routine_ok', label: 'Readings fine — routine', label_ml: 'സാധാരണ നില', follow_up: 12, reason: 'Routine check', reason_ml: 'പതിവ് പരിശോധന',
    text: 'Your check today looks fine. Keep eating well and staying active. The health worker will see you again at a routine visit.',
    text_ml: 'ഇന്നത്തെ പരിശോധന നല്ലതാണ്. നന്നായി ഭക്ഷണം കഴിച്ച് സജീവമായിരിക്കുക. പതിവ് സന്ദർശനത്തിൽ ആരോഗ്യ പ്രവർത്തക വീണ്ടും കാണും.' },
  { key: 'recheck_bp', label: 'Recheck BP next visit', label_ml: 'ബിപി വീണ്ടും നോക്കുക', follow_up: 1, reason: 'Recheck BP', reason_ml: 'ബിപി വീണ്ടും നോക്കുക',
    text: 'Your blood pressure needs to be checked again on the next visit day. Please use less salt and pickles. If you already take BP tablets, take them every day; do not stop them on your own.',
    text_ml: 'അടുത്ത സന്ദർശന ദിവസം രക്തസമ്മർദ്ദം വീണ്ടും പരിശോധിക്കണം. ഉപ്പും അച്ചാറും കുറയ്ക്കുക. ബിപി ഗുളിക കഴിക്കുന്നുണ്ടെങ്കിൽ എല്ലാ ദിവസവും കഴിക്കുക; സ്വയം നിർത്തരുത്.' },
  { key: 'see_phc_week', label: 'See PHC doctor within a week', label_ml: 'ഒരാഴ്ചയ്ക്കകം പിഎച്ച്സി', follow_up: 1, reason: 'Confirm PHC visit happened', reason_ml: 'പിഎച്ച്സി സന്ദർശിച്ചോ എന്ന് ഉറപ്പാക്കുക',
    text: 'Please go to the Primary Health Centre within one week so a doctor can examine you. Take this record card with you. The health worker can help with travel.',
    text_ml: 'ഒരാഴ്ചയ്ക്കകം പ്രാഥമികാരോഗ്യ കേന്ദ്രത്തിൽ പോയി ഡോക്ടറെ കാണുക. ഈ കാർഡ് കൂടെ കൊണ്ടുപോകുക. യാത്രയ്ക്ക് ആരോഗ്യ പ്രവർത്തക സഹായിക്കും.' },
  { key: 'hospital_today', label: 'Go to hospital today', label_ml: 'ഇന്നുതന്നെ ആശുപത്രി', follow_up: 1, reason: 'Check they reached hospital', reason_ml: 'ആശുപത്രിയിൽ എത്തിയോ എന്ന് നോക്കുക',
    text: 'Please go to the nearest hospital today. If you feel very unwell, call 108 for the free ambulance.',
    text_ml: 'ഇന്നുതന്നെ അടുത്തുള്ള ആശുപത്രിയിൽ പോകുക. വളരെ അസുഖം തോന്നിയാൽ സൗജന്യ ആംബുലൻസിനായി 108 വിളിക്കുക.' },
  { key: 'sugar_repeat', label: 'Repeat sugar test', label_ml: 'പഞ്ചസാര വീണ്ടും', follow_up: 2, reason: 'Repeat sugar test', reason_ml: 'പഞ്ചസാര വീണ്ടും പരിശോധിക്കുക',
    text: 'Your sugar level needs a repeat test at the health centre. Eat fewer sweets and less white rice; walk every day if you can.',
    text_ml: 'ആരോഗ്യ കേന്ദ്രത്തിൽ പഞ്ചസാര വീണ്ടും പരിശോധിക്കണം. മധുരവും വെള്ളച്ചോറും കുറയ്ക്കുക; കഴിയുമെങ്കിൽ ദിവസവും നടക്കുക.' },
  { key: 'tb_test', label: 'Sputum test (cough > 2 weeks)', label_ml: 'കഫ പരിശോധന', follow_up: 1, reason: 'Sputum sample given?', reason_ml: 'കഫ സാമ്പിൾ നൽകിയോ?',
    text: 'A cough for more than two weeks needs a free sputum test. Please give a sample at the health centre this week. Cover your mouth when coughing.',
    text_ml: 'രണ്ടാഴ്ചയിൽ കൂടുതലുള്ള ചുമയ്ക്ക് സൗജന്യ കഫ പരിശോധന വേണം. ഈ ആഴ്ച ആരോഗ്യ കേന്ദ്രത്തിൽ സാമ്പിൾ നൽകുക. ചുമയ്ക്കുമ്പോൾ വായ മൂടുക.' },
  { key: 'child_feed', label: 'Child: extra feeding, recheck 2 weeks', label_ml: 'കുട്ടി: അധിക ഭക്ഷണം', follow_up: 2, reason: 'Re-measure MUAC/weight', reason_ml: 'MUAC/ഭാരം വീണ്ടും അളക്കുക',
    text: 'Your child needs extra food. Give small meals 5–6 times a day with oil, egg, pulses and greens, and collect the Anganwadi supplement. The health worker will measure again in two weeks.',
    text_ml: 'കുട്ടിക്ക് അധിക ഭക്ഷണം വേണം. എണ്ണ, മുട്ട, പയർ, ഇലക്കറി ചേർത്ത് ദിവസം 5–6 തവണ കുറേശ്ശെ നൽകുക; അങ്കണവാടിയിലെ പോഷകാഹാരം വാങ്ങുക. രണ്ടാഴ്ചയ്ക്കുള്ളിൽ ആരോഗ്യ പ്രവർത്തക വീണ്ടും അളക്കും.' },
  { key: 'child_refer', label: 'Child: refer to NRC / PHC', label_ml: 'കുട്ടി: NRC റഫറൽ', follow_up: 1, reason: 'Check child reached NRC/PHC', reason_ml: 'കുട്ടി NRC/പിഎച്ച്സിയിൽ എത്തിയോ',
    text: 'Your child needs a check-up and special feeding care. Please take the child to the health centre this week; the doctor may advise a short stay at the Nutrition Rehabilitation Centre, which is free.',
    text_ml: 'കുട്ടിക്ക് പരിശോധനയും പ്രത്യേക ഭക്ഷണ പരിചരണവും വേണം. ഈ ആഴ്ച കുട്ടിയെ ആരോഗ്യ കേന്ദ്രത്തിൽ കൊണ്ടുപോകുക; സൗജന്യ പോഷണ പുനരധിവാസ കേന്ദ്രത്തിൽ കുറച്ചുദിവസം താമസിക്കാൻ ഡോക്ടർ പറഞ്ഞേക്കാം.' },
  { key: 'anc_visit', label: 'Pregnancy: attend ANC day', label_ml: 'ഗർഭകാല പരിശോധന', follow_up: 4, reason: 'Next ANC check', reason_ml: 'അടുത്ത ഗർഭകാല പരിശോധന',
    text: 'Please attend your pregnancy check-up at the health centre. Take the iron and calcium tablets every day. Plan to have the baby in a hospital; 108 and JSSK transport are free.',
    text_ml: 'ആരോഗ്യ കേന്ദ്രത്തിലെ ഗർഭകാല പരിശോധനയ്ക്ക് പോകുക. അയൺ, കാൽസ്യം ഗുളികകൾ എല്ലാ ദിവസവും കഴിക്കുക. പ്രസവം ആശുപത്രിയിൽ തന്നെ; 108, JSSK യാത്ര സൗജന്യമാണ്.' },
  { key: 'anc_hospital', label: 'Pregnancy: hospital today', label_ml: 'ഗർഭിണി: ഇന്നുതന്നെ ആശുപത്രി', follow_up: 1, reason: 'Check she reached hospital', reason_ml: 'ആശുപത്രിയിൽ എത്തിയോ എന്ന് നോക്കുക',
    text: 'Please go to the hospital today for a pregnancy check. Call 108 at once if there is bleeding, fits, severe pain or the baby moves less.',
    text_ml: 'ഗർഭകാല പരിശോധനയ്ക്കായി ഇന്നുതന്നെ ആശുപത്രിയിൽ പോകുക. രക്തസ്രാവം, അപസ്മാരം, കഠിന വേദന, കുഞ്ഞിന്റെ അനക്കം കുറയൽ എന്നിവയുണ്ടെങ്കിൽ ഉടൻ 108 വിളിക്കുക.' },
  { key: 'elder_falls', label: 'Elder: prevent falls', label_ml: 'വയോജനം: വീഴ്ച തടയൽ', follow_up: 4, reason: 'Falls follow-up', reason_ml: 'വീഴ്ച തുടർപരിശോധന',
    text: 'To prevent falls: keep the floor dry and clear, keep a light on at night, wear slippers that grip, and use a walking stick if it helps. The doctor will see you at the next camp.',
    text_ml: 'വീഴ്ച തടയാൻ: തറ ഉണങ്ങിയതും വൃത്തിയുള്ളതുമായി വയ്ക്കുക, രാത്രി വെളിച്ചം ഇടുക, വഴുതാത്ത ചെരിപ്പ് ധരിക്കുക, ആവശ്യമെങ്കിൽ ഊന്നുവടി ഉപയോഗിക്കുക. അടുത്ത ക്യാമ്പിൽ ഡോക്ടർ കാണും.' },
  { key: 'elder_talk', label: 'Elder: talk with doctor/counsellor', label_ml: 'വയോജനം: സംസാരിക്കാം', follow_up: 2, reason: 'Memory/mood follow-up', reason_ml: 'ഓർമ്മ/മനസ്സ് തുടർപരിശോധന',
    text: 'Please come and talk with the doctor or counsellor at the next camp; a family member is welcome too. Staying in touch with family and neighbours, and a daily walk, help a lot.',
    text_ml: 'അടുത്ത ക്യാമ്പിൽ ഡോക്ടറോടോ കൗൺസിലറോടോ സംസാരിക്കാൻ വരിക; കുടുംബാംഗത്തെയും കൂട്ടാം. കുടുംബവും അയൽക്കാരുമായുള്ള ബന്ധവും ദിവസേനയുള്ള നടത്തവും വളരെ സഹായിക്കും.' },
  { key: 'medicines_review', label: 'Bring all medicines for review', label_ml: 'മരുന്നുകൾ കൊണ്ടുവരിക', follow_up: 4, reason: 'Medicine review at camp', reason_ml: 'ക്യാമ്പിൽ മരുന്ന് പരിശോധന',
    text: 'Please bring all your medicines — strips, bottles and old prescriptions — to the next camp so the doctor can check them together.',
    text_ml: 'എല്ലാ മരുന്നുകളും — സ്ട്രിപ്പുകൾ, കുപ്പികൾ, പഴയ കുറിപ്പടികൾ — അടുത്ത ക്യാമ്പിൽ കൊണ്ടുവരിക; ഡോക്ടർ ഒരുമിച്ച് പരിശോധിക്കും.' },
  { key: 'pension_help', label: 'Help apply for welfare pension', label_ml: 'പെൻഷൻ അപേക്ഷ', follow_up: 4, reason: 'Pension application help', reason_ml: 'പെൻഷൻ അപേക്ഷാ സഹായം',
    text: 'You may be able to get a welfare pension. The facilitator at the centre can help you apply; bring your Aadhaar and bank passbook.',
    text_ml: 'നിങ്ങൾക്ക് ക്ഷേമ പെൻഷൻ ലഭിച്ചേക്കാം. അപേക്ഷിക്കാൻ സെന്ററിലെ ഫെസിലിറ്റേറ്റർ സഹായിക്കും; ആധാറും ബാങ്ക് പാസ്ബുക്കും കൊണ്ടുവരിക.' },
];
const ADVICE_BY_KEY = Object.fromEntries(ADVICE.map((a) => [a.key, a]));

module.exports = { RULES, ADVICE, ADVICE_BY_KEY, vitals, childGrowth, antenatal, elderScreen, DANGER };
