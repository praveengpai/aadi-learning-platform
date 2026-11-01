# Wildlife module rules (form sub-engine) — PENDING EXPERT REVIEW

These run on the hub at capture time (offline), in `lib.js` (`assess`, `elephantWarning`).
They were chosen by the build team, not by the Forest Department, a doctor or a lawyer.
Source for every row: **none yet — to be confirmed with the Kerala Forest Department range office,
a medical officer, and someone who knows the current compensation rules.**

## `wildlife.incident`
| Condition | Result |
| --- | --- |
| damage includes injury or death of a person | priority 3 (urgent), flag `person_hurt`: "Seek medical care / inform the forest office immediately — call 112 in an emergency." |
| damage includes house | priority 2, flag `house_damaged` (warn) |
| animal = leopard / tiger | priority 2, flag `big_cat` (warn) |
| incident date more than `WILDLIFE_CLAIM_WINDOW_DAYS` (default **14**) days before capture | priority ≥ 1, flag `claim_may_be_late` (warn): "the claim may be late — verify the deadline". **The 14-day window is a placeholder, not a legal deadline.** The real time limit for filing must be confirmed; the app never states a deadline as fact. |
| incident date in the future | flag `date_in_future` (warn) |
| no photo | flag `no_photo` (info) |
| not yet told to the forest office | flag `not_reported` (info) |

## Early warning (hamlet board)
| Condition | Result |
| --- | --- |
| ≥ 2 elephant sightings within 48 h for the same hamlet | `elephant_alert` banner (read aloud) advising to avoid forest paths after dark, keep children close, tell the forest office, call 112 in danger. |

"Near the same hamlet" currently means *recorded for that hamlet* — sightings carry only a rough
location (3 decimals, ~100 m) and no distance check is made. PENDING REVIEW with the range office
(rapid response team practice may use different thresholds).

## Claim steps
`prepared → submitted_to_range_office → inspection_done → sanctioned → paid`, with `rejected` possible
before sanction and re-submission after a rejection. This is a simplified picture of the process and
PENDING REVIEW: the real steps, documents (land/possession papers, bank details, photos, mahazar /
inspection report, medical certificate for injuries) and amounts must be confirmed.
Only the reviewing forest office records inspection, sanction or rejection; the capturing agency's
admin may record hand-in and payment received.

## Readings
Allowed ranges (validation only, not alarms): rainfall 0–1000 mm, stream level 0–2000 cm, pH 0–14,
turbidity 0–4000 NTU, camera-trap count 0–1000 (whole numbers). CSV import: at most 500 lines and
200 000 characters per paste; all lines must be valid unless "skip bad lines" is chosen.
