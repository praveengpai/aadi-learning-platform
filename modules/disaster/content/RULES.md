# Disaster Preparedness: rules and content (DRAFT, PENDING EXPERT REVIEW)

Reviewers: District Disaster Management Authority (DDMA) Idukki / Palakkad, KSDMA, and a Malayalam editor.
Nothing here replaces official warnings. The module passes on warnings from IMD, the District Collector
or KSDMA in plain words. It never issues its own forecasts.

## Rule: `disaster.incident_report` (index.js `incidentRule`)
| Condition | Flag | Level | Priority | Source |
| --- | --- | --- | --- | --- |
| `road_blocked = yes` | `road_blocked` | urgent | 3 | Build brief: "road blocked or people injured → priority 3 urgent". PENDING EXPERT REVIEW |
| `people_injured > 0` | `people_injured` | urgent | 3 | Build brief. PENDING EXPERT REVIEW |
| `needs` includes `rescue` | `rescue_needed` | urgent | 3 | Our draft. PENDING EXPERT REVIEW |
| `houses_damaged > 0` or `people_affected >= 10` | `damage` | warn | 2 | Our draft threshold (10 people). PENDING EXPERT REVIEW |

The rule ranks the reviewer's queue. It does not dispatch anyone. The incident screen says "in a real emergency call 112 or 1077 first".

## Rule: `disaster.family_plan` (index.js `planRule`)
- Any help category other than "none" → info flag `add_to_help_list`. The person is added to the list only when the family names them **and** that person (or the head, for themselves) has given `emergency` consent.
- Torch, water, medicine kit or documents answered "no" → info flag `kit_incomplete`.

## Content to verify (content/catalogue.json)
- **Hazards**: landslide, flood, wildfire, wild elephant, road cut off. Should lightning, strong wind or dam release be added for some hamlets?
- **Helplines** (all shown with "verify locally"): 112 (ERSS), 1077 (District EOC), 1070 (State EOC / KSDMA), 101 (Fire & Rescue), 108 (Ambulance). Confirm each number for each district before the monsoon. The profile editor accepts only short codes or office landlines with STD code, never mobile numbers.
- **Warning levels**: green / yellow / orange / red and their one-line advice. Check against IMD / KSDMA colour codes and wording.
- **Pre-monsoon checklist**: drains cleared, shelter stocked, helplines checked, assembly point marked, help list reviewed with the Oorukoottam, drill held.
- **Help categories** (plain words, no diagnoses): cannot walk far, needs to be carried, very young children, elderly person living alone, needs regular medicines, other.
- **Consent wording** (scope `emergency`): "Share that I may need help in an emergency (with disaster responders)". The read-aloud text on the family-plan screen is: "We agree to share that someone in our family may need help in an emergency with the disaster responders of this agency. We can withdraw this at any time." This needs legal (DPDP Act 2023) and community review.
- **Malayalam**: all `_ml` strings were drafted without a native editor.

## Demo data
Demo warnings are titled "DEMO — not a real warning" and stored with `is_demo = 1`. A real warning cannot carry "demo" in its title or source. The demo risk profiles describe fictional places. The demo people are fictional.
