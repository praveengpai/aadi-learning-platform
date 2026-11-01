'use strict';
// Health & Elder Screening — form definitions for the Brain's round-trip engine.
// Bump manifest.json "version" whenever a field here changes (older hubs then never overwrite it).
const C = (value, label, label_ml) => ({ value, label, label_ml });
const YN = (name, label, label_ml, extra = {}) => ({ name, type: 'yes_no', label, label_ml, ...extra });
const PHQ = [C('0', 'Not at all', 'ഒട്ടുമില്ല'), C('1', 'Several days', 'ചില ദിവസങ്ങളിൽ'), C('2', 'More than half the days', 'പകുതിയിലേറെ ദിവസങ്ങളിൽ'), C('3', 'Nearly every day', 'മിക്കവാറും എല്ലാ ദിവസവും')];
const COMMON = { subject: 'person', scope: 'health', capture_perm: 'health.capture', review: { perm: 'health.review' } };

const FORMS = [
  {
    ...COMMON, key: 'health.vitals', title: 'Vitals check', title_ml: 'ആരോഗ്യ പരിശോധന (വൈറ്റൽസ്)',
    description: 'BP, pulse, temperature, sugar, weight and symptoms. Screening only — a doctor reviews.',
    fields: [
      { name: 'bp_sys', type: 'integer', label: 'BP — upper number (systolic)', label_ml: 'ബിപി — മുകളിലെ സംഖ്യ (സിസ്റ്റോളിക്)', unit: 'mmHg', min: 60, max: 280 },
      { name: 'bp_dia', type: 'integer', label: 'BP — lower number (diastolic)', label_ml: 'ബിപി — താഴത്തെ സംഖ്യ (ഡയസ്റ്റോളിക്)', unit: 'mmHg', min: 30, max: 180, relevant: { field: 'bp_sys', present: true } },
      { name: 'pulse', type: 'integer', label: 'Pulse', label_ml: 'നാഡിമിടിപ്പ്', unit: '/min', min: 20, max: 250 },
      { name: 'temp_c', type: 'decimal', label: 'Temperature', label_ml: 'ശരീരതാപം', unit: '°C', min: 30, max: 44, hint: '37.0 °C = 98.6 °F', hint_ml: '37.0 °C = 98.6 °F' },
      { name: 'sugar', type: 'integer', label: 'Blood sugar (glucometer)', label_ml: 'രക്തത്തിലെ പഞ്ചസാര (ഗ്ലൂക്കോമീറ്റർ)', unit: 'mg/dL', min: 20, max: 700 },
      { name: 'sugar_type', type: 'select_one', label: 'Was the person fasting?', label_ml: 'വെറുംവയറ്റിലാണോ പരിശോധിച്ചത്?', relevant: { field: 'sugar', present: true }, required: true,
        choices: [C('fasting', 'Fasting (nothing eaten for 8 hours)', 'വെറുംവയർ (8 മണിക്കൂർ ഭക്ഷണമില്ല)'), C('random', 'Random (any time)', 'ഏതുസമയത്തും')] },
      { name: 'weight_kg', type: 'decimal', label: 'Weight', label_ml: 'ഭാരം', unit: 'kg', min: 1, max: 250 },
      { name: 'height_cm', type: 'decimal', label: 'Height', label_ml: 'ഉയരം', unit: 'cm', min: 40, max: 220 },
      { name: 'symptoms', type: 'select_multiple', label: 'Any of these now?', label_ml: 'ഇപ്പോൾ ഇവയിൽ ഏതെങ്കിലും ഉണ്ടോ?', choices: [
        C('fever', 'Fever', 'പനി'), C('cough_2w', 'Cough for more than 2 weeks', 'രണ്ടാഴ്ചയിലേറെ ചുമ'), C('breathless', 'Breathlessness', 'ശ്വാസംമുട്ട്'),
        C('chest_pain', 'Chest pain', 'നെഞ്ചുവേദന'), C('headache', 'Headache', 'തലവേദന'), C('dizziness', 'Dizziness', 'തലകറക്കം'), C('swelling', 'Swelling', 'നീര്'),
        C('wound', 'Wound / sore', 'മുറിവ് / വ്രണം'), C('diarrhoea', 'Loose motions', 'വയറിളക്കം'), C('other', 'Other', 'മറ്റുള്ളവ')] },
      { name: 'photo', type: 'photo', label: 'Photo (wound or rash) — optional', label_ml: 'ഫോട്ടോ (മുറിവ് / ചൊറിച്ചിൽ) — ആവശ്യമെങ്കിൽ', hint: 'Only the affected area. Never the face.', hint_ml: 'ബാധിച്ച ഭാഗം മാത്രം. മുഖം ഒരിക്കലും വേണ്ട.' },
      { name: 'notes', type: 'textarea', label: 'Notes for the doctor', label_ml: 'ഡോക്ടർക്കുള്ള കുറിപ്പ്' },
    ],
  },
  {
    ...COMMON, key: 'health.child_growth', title: 'Child growth check', title_ml: 'കുട്ടിയുടെ വളർച്ചാ പരിശോധന',
    description: 'Weight, height and MUAC tape for children under 5 (MUAC colour bands are for 6–59 months).',
    fields: [
      { name: 'age_months', type: 'integer', label: 'Age in months', label_ml: 'പ്രായം (മാസത്തിൽ)', required: true, min: 0, max: 216 },
      { name: 'weight_kg', type: 'decimal', label: 'Weight', label_ml: 'ഭാരം', unit: 'kg', min: 0.5, max: 100 },
      { name: 'height_cm', type: 'decimal', label: 'Height / length', label_ml: 'ഉയരം / നീളം', unit: 'cm', min: 30, max: 200 },
      { name: 'muac_cm', type: 'decimal', label: 'MUAC (arm tape)', label_ml: 'MUAC (കൈ അളവ് ടേപ്പ്)', unit: 'cm', min: 5, max: 30, hint: 'Left upper arm, midway between shoulder and elbow.', hint_ml: 'ഇടത് മേൽക്കൈ, തോളിനും കൈമുട്ടിനും നടുവിൽ.' },
      YN('oedema', 'Swelling of BOTH feet (press 3 seconds — dent stays)?', 'രണ്ടു കാലിലും നീരുണ്ടോ (3 സെക്കൻഡ് അമർത്തുമ്പോൾ കുഴി നിൽക്കുന്നു)?', { required: true }),
      YN('eating_well', 'Is the child eating well?', 'കുട്ടി നന്നായി ഭക്ഷണം കഴിക്കുന്നുണ്ടോ?', { required: true }),
      { name: 'notes', type: 'textarea', label: 'Notes', label_ml: 'കുറിപ്പ്' },
    ],
  },
  {
    ...COMMON, key: 'health.antenatal', title: 'Pregnancy check (antenatal)', title_ml: 'ഗർഭകാല പരിശോധന',
    description: 'Weeks, BP, Hb and danger signs. Any danger sign → hospital today.',
    fields: [
      { name: 'danger_note', type: 'note', label: 'If any danger sign is present, call 108 now — do not wait for the doctor\'s reply.', label_ml: 'ഏതെങ്കിലും അപകട ലക്ഷണമുണ്ടെങ്കിൽ ഇപ്പോൾതന്നെ 108 വിളിക്കുക — ഡോക്ടറുടെ മറുപടിക്കായി കാത്തിരിക്കരുത്.' },
      { name: 'weeks', type: 'integer', label: 'Weeks pregnant', label_ml: 'ഗർഭത്തിന്റെ ആഴ്ച', required: true, min: 4, max: 44 },
      { name: 'bp_sys', type: 'integer', label: 'BP — upper number', label_ml: 'ബിപി — മുകളിലെ സംഖ്യ', unit: 'mmHg', min: 60, max: 260 },
      { name: 'bp_dia', type: 'integer', label: 'BP — lower number', label_ml: 'ബിപി — താഴത്തെ സംഖ്യ', unit: 'mmHg', min: 30, max: 180, relevant: { field: 'bp_sys', present: true } },
      { name: 'hb', type: 'decimal', label: 'Haemoglobin (Hb), if known', label_ml: 'ഹീമോഗ്ലോബിൻ (എച്ച്ബി), അറിയാമെങ്കിൽ', unit: 'g/dL', min: 3, max: 18 },
      { name: 'danger_signs', type: 'select_multiple', label: 'Danger signs now', label_ml: 'ഇപ്പോഴുള്ള അപകട ലക്ഷണങ്ങൾ', choices: [
        C('bleeding', 'Bleeding', 'രക്തസ്രാവം'), C('headache_vision', 'Severe headache / blurred vision', 'കഠിനമായ തലവേദന / കാഴ്ച മങ്ങൽ'), C('fits', 'Fits', 'അപസ്മാരം'),
        C('abdominal_pain', 'Severe abdominal pain', 'കഠിനമായ വയറുവേദന'), C('reduced_movement', 'Baby moving less', 'കുഞ്ഞിന്റെ അനക്കം കുറവ്'), C('fever', 'Fever', 'പനി'),
        C('face_swelling', 'Swelling of face or hands', 'മുഖത്തും കൈകളിലും നീര്')] },
      { name: 'anc_visits', type: 'integer', label: 'Antenatal check-ups so far', label_ml: 'ഇതുവരെയുള്ള ഗർഭകാല പരിശോധനകൾ', min: 0, max: 20 },
      { name: 'notes', type: 'textarea', label: 'Notes', label_ml: 'കുറിപ്പ്' },
    ],
  },
  {
    ...COMMON, key: 'health.elder_screen', title: 'Elder screening (60+)', title_ml: 'വയോജന പരിശോധന (60+)',
    description: 'Falls, vision, hearing, memory, mood, weight, daily activities, medicines and support. Not a diagnosis.',
    fields: [
      { name: 'falls', type: 'select_one', label: 'Falls in the last 12 months', label_ml: 'കഴിഞ്ഞ 12 മാസത്തിലെ വീഴ്ചകൾ', required: true, choices: [C('0', 'None', 'ഇല്ല'), C('1', 'One', 'ഒന്ന്'), C('2plus', 'Two or more', 'രണ്ടോ അതിലധികമോ')] },
      YN('fear_falling', 'Afraid of falling?', 'വീഴുമോ എന്ന് ഭയമുണ്ടോ?', { required: true }),
      YN('vision', 'Difficulty seeing (even with glasses)?', 'കാണാൻ ബുദ്ധിമുട്ടുണ്ടോ (കണ്ണടയോടെയും)?', { required: true }),
      YN('hearing', 'Difficulty hearing?', 'കേൾക്കാൻ ബുദ്ധിമുട്ടുണ്ടോ?', { required: true }),
      YN('memory_trouble', 'Trouble remembering recent events?', 'അടുത്തിടെ നടന്ന കാര്യങ്ങൾ ഓർക്കാൻ ബുദ്ധിമുട്ടുണ്ടോ?', { required: true }),
      { name: 'recall', type: 'integer', label: '3-word recall: how many words remembered after 3 minutes (0–3)', label_ml: '3 വാക്ക് ഓർമ്മ: 3 മിനിറ്റിനു ശേഷം എത്ര വാക്കുകൾ ഓർത്തു (0–3)', min: 0, max: 3, required: true,
        hint: 'Say three words (e.g. banana, sunrise, chair); ask again after 3 minutes.', hint_ml: 'മൂന്ന് വാക്കുകൾ പറയുക (ഉദാ: വാഴപ്പഴം, സൂര്യോദയം, കസേര); 3 മിനിറ്റിന് ശേഷം വീണ്ടും ചോദിക്കുക.' },
      { name: 'phq_interest', type: 'select_one', label: 'Last 2 weeks: little interest or pleasure in doing things', label_ml: 'കഴിഞ്ഞ 2 ആഴ്ച: കാര്യങ്ങൾ ചെയ്യാൻ താൽപ്പര്യമോ സന്തോഷമോ കുറവ്', required: true, choices: PHQ },
      { name: 'phq_mood', type: 'select_one', label: 'Last 2 weeks: feeling down, sad or hopeless', label_ml: 'കഴിഞ്ഞ 2 ആഴ്ച: മനസ്സിടിവ്, സങ്കടം, നിരാശ', required: true, choices: PHQ },
      YN('weight_loss', 'Lost weight without trying (clothes loose)?', 'ശ്രമിക്കാതെ ഭാരം കുറഞ്ഞോ (വസ്ത്രങ്ങൾ അയഞ്ഞു)?', { required: true }),
      { name: 'adl_help', type: 'select_multiple', label: 'Needs help with', label_ml: 'ഇവയ്ക്ക് സഹായം വേണം', required: true, choices: [
        C('none', 'None — manages alone', 'ഒന്നിനുമില്ല — സ്വയം ചെയ്യുന്നു'), C('bathing', 'Bathing', 'കുളി'), C('dressing', 'Dressing', 'വസ്ത്രം ധരിക്കൽ'), C('toilet', 'Toilet', 'ശൗചാലയം'), C('walking', 'Walking', 'നടത്തം')] },
      { name: 'medicines', type: 'integer', label: 'Number of regular medicines', label_ml: 'സ്ഥിരം കഴിക്കുന്ന മരുന്നുകളുടെ എണ്ണം', min: 0, max: 30, required: true },
      YN('pension', 'Receiving a pension?', 'പെൻഷൻ ലഭിക്കുന്നുണ്ടോ?', { required: true }),
      YN('lives_alone', 'Lives alone?', 'ഒറ്റയ്ക്കാണോ താമസം?', { required: true }),
      { name: 'notes', type: 'textarea', label: 'Notes', label_ml: 'കുറിപ്പ്' },
    ],
  },
];

module.exports = { FORMS };
