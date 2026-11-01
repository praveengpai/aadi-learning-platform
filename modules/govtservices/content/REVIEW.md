# Government Services & Schemes — content review

**STATUS: PENDING REVIEW by ST Department / Akshaya.** Nothing in `schemes.json` or in the
eligibility hints (`../eligibility.js`) has been checked by an official yet. Until it is, the app
shows a "pending review" banner on every helper screen and calls every suggestion
"may be eligible — check". The office decides eligibility; this module never does.

The module **never submits to a government portal**. Staff take the application to the office or
portal themselves and record the outcome.

## What a reviewer should check

### 1. Catalogue facts (`schemes.json`)
For each of the 18 entries: title (English and Malayalam), who it is for, documents usually needed,
and the issuing office or portal.
- Community, income and nativity certificates: the issuing authority (Village Officer or Tahsildar) and the supporting documents.
- Ration card: whether the Taluk Supply Office and the civil supplies portal are the right route, and which documents are needed.
- Aadhaar: the biometric update ages (written as "around 5 and 15").
- PMJDY bank account: the rules for minors.
- ST Department pre-matric aid, post-matric (e-Grantz), hostel / Model Residential School admission, marriage assistance and education assistance: the scheme names, who can apply and the documents needed (these change every year).
- LIFE Mission: whether lists are open, and the documents needed.
- Social security pensions (old age, widow, disability): the age conditions and the documents needed (and the mustering / life certificate rules); the minimum disability percentage.
- PM-JAY / KASP: the enrolment route for ST families.
- Forest Rights Act: the route through the Forest Rights Committee / Oorukoottam.
- PM-KISAN: whether FRA title holders can apply.

**Deliberately absent:** money amounts, income limits and deadlines. Each entry says "check current rules" in its `verify` note.

### 2. Official links (`link` field)
These were set from general knowledge and have **not** been opened or verified:
`edistrict.kerala.gov.in`, `civilsupplieskerala.gov.in`, `uidai.gov.in`, `pmjdy.gov.in`,
`egrantz.kerala.gov.in`, `stdd.kerala.gov.in`, `lifemission.kerala.gov.in`,
`welfarepension.lsgkerala.gov.in`, `pmjay.gov.in`, `tribal.nic.in`, `pmkisan.gov.in`.
Pre-matric aid has no link on purpose. Please confirm each link, or remove it.

### 3. Eligibility hints (`match` in `schemes.json`, logic in `eligibility.js`)
These are draft rules. They only suggest; they never decide.
| Hint | Draft rule |
| --- | --- |
| Old age pension | age ≥ 60 |
| Widow pension | woman ≥ 18 — the helper asks whether she is widowed |
| Disability pension | anyone — the helper asks |
| Pre-matric aid | studying in class 1–10 |
| Post-matric (e-Grantz) | class 11 or above, or a youth who has finished class 10 / Plus Two and is not marked "discontinued" |
| Hostel | class 1–12 — the helper asks whether the school is far |
| Nativity certificate | youth at class 8 level or above |
| Income certificate | adults, youth, or anyone studying |
| Ration card, health card, LIFE, FRA, PM-KISAN | adults; LIFE, FRA and PM-KISAN are "ask" hints |
| Aadhaar | missing Aadhaar, or age 5–7 / 15–17 for the biometric update |
| Bank account | age ≥ 10 |
| Marriage / education assistance | "ask" hints only |

### 4. Application rule (priority)
- Urgent: the family has **not** agreed to share with the ST Department, so the application cannot be forwarded.
- Warn: documents missing (the documents the family listed, plus the scheme's usual documents that are not marked as available).
- High priority: pensions and people aged 60 or over; scholarships from **May to August** (draft window around the June start of the Kerala academic year).

### 5. Malayalam
All Malayalam strings are drafts and need a fluent reviewer. Plain-language status texts are in
`schemes.json → outcomes`.
