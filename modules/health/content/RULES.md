# Health & Elder Screening — rule thresholds

**STATUS: PENDING CLINICAL REVIEW.** Every threshold, message and advice template below is a draft written
from widely published public-health guidance. None may be used with real people until a qualified clinician
(and, for geriatric items, a geriatrician) has reviewed and signed off this file. Record sign-off at the end.

The rules live in `modules/health/rules.js`. They run at capture time (offline, on the hub) and only
**flag and prioritise for the doctor**. They never diagnose; every message says *refer / recheck / doctor to
review*. Priority: 3 urgent (red), 2 high, 1 soon, 0 routine. Two or more warnings raise priority to 2.

Disclaimer shown on every screen: *Screening and referral support only — not a diagnosis. In an emergency go
to the nearest health facility or call 108 immediately.*

## health.vitals (adults unless stated)

| Code | Condition | Level | Source | Status |
| --- | --- | --- | --- | --- |
| bp_very_high | systolic ≥ 180 or diastolic ≥ 110 | urgent (3) | ICMR/MoHFW Standard Treatment Workflow — Hypertension (2019); ACC/AHA 2017 "severe hypertension" ≥180/120 (we use the more conservative 110 diastolic, as in NPCDCS/NP-NCD referral practice) | PENDING CLINICAL REVIEW |
| bp_high | systolic ≥ 140 or diastolic ≥ 90 | warn (1) | WHO HEARTS technical package (2018); India Hypertension Control Initiative; NP-NCD screening guidelines | PENDING CLINICAL REVIEW |
| bp_low | systolic < 90 | warn | common clinical cut-off for hypotension | PENDING CLINICAL REVIEW |
| bp_entry_check | diastolic ≥ systolic | info | data-quality check | PENDING CLINICAL REVIEW |
| pulse_abnormal | pulse ≥ 120 or ≤ 50 /min | warn | conservative adult resting-pulse limits (normal ~60–100) | PENDING CLINICAL REVIEW |
| fever_high | temperature ≥ 39.0 °C | warn | WHO IMAI / IMNCI "high fever" | PENDING CLINICAL REVIEW |
| temp_low | temperature < 35.0 °C | warn | WHO definition of hypothermia | PENDING CLINICAL REVIEW |
| sugar_low | glucometer < 70 mg/dL | urgent (3) | ADA Standards of Care — level 1 hypoglycaemia < 70 mg/dL | PENDING CLINICAL REVIEW |
| sugar_very_high | any glucose ≥ 300 mg/dL | urgent (3) | conservative referral threshold used in NP-NCD / ICMR diabetes workflows | PENDING CLINICAL REVIEW |
| sugar_high_fasting | fasting ≥ 126 mg/dL | warn | WHO / ADA diagnostic threshold (needs confirmatory lab test — we only refer) | PENDING CLINICAL REVIEW |
| sugar_high_random | random ≥ 200 mg/dL | warn | WHO / ADA; NP-NCD screening uses RBS ≥ 140 for referral — reviewer to choose | PENDING CLINICAL REVIEW |
| chest_pain | symptom "chest pain" | urgent (3) | standard red-flag symptom (ICMR STW — acute coronary syndrome) | PENDING CLINICAL REVIEW |
| breathless | symptom "breathlessness" (urgent if with chest pain) | warn / urgent | red-flag symptom | PENDING CLINICAL REVIEW |
| cough_2w | cough > 2 weeks | warn | National TB Elimination Programme (NTEP) — presumptive TB: cough ≥ 2 weeks | PENDING CLINICAL REVIEW |
| wound / swelling | symptom present | info | for doctor review | PENDING CLINICAL REVIEW |
| diarrhoea | loose motions → ORS (+ zinc for children) | info | WHO/UNICEF ORS + zinc; IMNCI | PENDING CLINICAL REVIEW |
| bmi_low | BMI < 18.5 (age ≥ 18) | warn | WHO adult BMI classification | PENDING CLINICAL REVIEW |
| bmi_high | BMI ≥ 30 (age ≥ 18) | info | WHO (note: Asian cut-offs are lower — 23/27.5 — reviewer to decide) | PENDING CLINICAL REVIEW |

## health.child_growth

| Code | Condition | Level | Source | Status |
| --- | --- | --- | --- | --- |
| bilateral_oedema | pitting oedema of both feet | urgent (3) | WHO 2013 guideline on SAM; MoHFW Operational Guidelines on Facility-Based Management of SAM (NRC) | PENDING CLINICAL REVIEW |
| muac_sam | MUAC < 11.5 cm, age 6–59 months | urgent (3) | WHO/UNICEF 2009 joint statement; WHO 2013 | PENDING CLINICAL REVIEW |
| muac_mam | MUAC 11.5–12.4 cm, age 6–59 months | warn (1) | WHO/UNICEF (moderate acute malnutrition) | PENDING CLINICAL REVIEW |
| muac_age | MUAC entered outside 6–59 months | info | MUAC bands validated only for 6–59 months | PENDING CLINICAL REVIEW |
| not_eating | not eating well (urgent if with SAM / oedema) | warn / urgent | IMNCI general danger sign "unable to drink or breastfeed" is stricter — reviewer to decide wording | PENDING CLINICAL REVIEW |

Not yet implemented (needs WHO growth-standard tables): weight-for-height / weight-for-age z-scores.

## health.antenatal

| Code | Condition | Level | Source | Status |
| --- | --- | --- | --- | --- |
| danger_* | any of: bleeding, severe headache/blurred vision, fits, severe abdominal pain, reduced fetal movements, fever, swelling of face/hands | urgent (3) | MoHFW ASHA Module 6/7 and "Guidelines for Antenatal Care and Skilled Attendance at Birth" (2010); WHO ANC recommendations 2016 | PENDING CLINICAL REVIEW |
| anc_bp_severe | systolic ≥ 160 or diastolic ≥ 110 | urgent (3) | WHO / FOGSI severe hypertension in pregnancy | PENDING CLINICAL REVIEW |
| anc_bp_high | systolic ≥ 140 or diastolic ≥ 90 | warn, priority 2 | WHO / MoHFW (gestational hypertension / pre-eclampsia screen) | PENDING CLINICAL REVIEW |
| hb_severe | Hb < 7 g/dL | urgent (3) | MoHFW Anaemia Mukt Bharat (severe anaemia in pregnancy < 7) | PENDING CLINICAL REVIEW |
| hb_moderate | Hb 7–9.9 g/dL | warn | Anaemia Mukt Bharat (moderate) | PENDING CLINICAL REVIEW |
| hb_mild | Hb 10–10.9 g/dL | info | WHO (anaemia in pregnancy < 11) | PENDING CLINICAL REVIEW |
| anc_term | ≥ 40 weeks | warn | standard post-dates review | PENDING CLINICAL REVIEW |
| anc_plan_delivery | 36–39 weeks | info | birth-preparedness (JSSK / 108) | PENDING CLINICAL REVIEW |
| anc_behind | fewer ANC visits than expected (≥16 wk & 0; ≥28 wk & <3; ≥36 wk & <4) | info | MoHFW minimum 4 ANC visits | PENDING CLINICAL REVIEW |

## health.elder_screen (age ≥ 60)

Item set adapted from WHO ICOPE (Integrated Care for Older People) step-1 screening, 2019.

| Code | Condition | Level | Source | Status |
| --- | --- | --- | --- | --- |
| falls_risk | 2+ falls in 12 months, or 1 fall + fear of falling | warn | AGS/BGS falls guideline; World Falls Guidelines 2022 (Montero-Odasso et al.) | PENDING CLINICAL REVIEW |
| fall_once | 1 fall, no fear | info | as above | PENDING CLINICAL REVIEW |
| vision / hearing | self-reported difficulty | info (refer for check) | WHO ICOPE step 1 | PENDING CLINICAL REVIEW |
| memory_check | 3-word recall ≤ 1 | warn ("memory check suggested"; never a label) | Mini-Cog word recall (Borson et al. 2000); WHO ICOPE cognition item | PENDING CLINICAL REVIEW |
| memory_concern | family/self reports memory trouble, recall ≥ 2 | info | ICOPE | PENDING CLINICAL REVIEW |
| mood_check | PHQ-2 total ≥ 3 | warn ("refer to counsellor/doctor; do not label") | Kroenke, Spitzer & Williams 2003 (PHQ-2 cut-off 3) | PENDING CLINICAL REVIEW — validated Malayalam wording needed |
| weight_loss | unintended weight loss | warn | ICOPE nutrition item | PENDING CLINICAL REVIEW |
| alone_needs_help | lives alone AND needs help with any of bathing, dressing, toilet, walking | warn | Katz ADL (simplified); social-risk flag | PENDING CLINICAL REVIEW |
| needs_help | needs help with any ADL | info | Katz ADL (simplified) | PENDING CLINICAL REVIEW |
| polypharmacy | ≥ 5 regular medicines | info (medicine review) | common polypharmacy definition (Masnoon et al. 2017); Beers / STOPP-START review | PENDING CLINICAL REVIEW |
| pension_check | no pension | info (social, not clinical) | Kerala welfare pension eligibility check | PENDING EXPERT REVIEW (social welfare) |

## Doctor advice templates (`ADVICE` in rules.js)

Plain-language replies the doctor can pick and edit; each sets a default follow-up (weeks) for the ASHA:
`routine_ok` (12), `recheck_bp` (1), `see_phc_week` (1), `hospital_today` (1), `sugar_repeat` (2), `tb_test` (1),
`child_feed` (2), `child_refer` (1), `anc_visit` (4), `anc_hospital` (1), `elder_falls` (4), `elder_talk` (2),
`medicines_review` (4), `pension_help` (4).
All English and Malayalam texts are **PENDING CLINICAL REVIEW** and also need review by a native Malayalam
speaker familiar with Muthuvan / Irula community usage.

## Notifications
SMS / IVR messages never carry clinical content. The only text sent is: "a message from the health team is
waiting for you. Please visit the centre on the next visit day."

## Sign-off
| Reviewer | Role | Date | Scope |
| --- | --- | --- | --- |
| _pending_ | | | |
