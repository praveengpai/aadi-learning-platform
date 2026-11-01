# Agriculture rules (form sub-engine) — PENDING EXPERT REVIEW

These run on the hub at capture time (offline). Thresholds are **drafts** chosen by the build team,
not by an agronomist or market expert. Source: none yet — to be confirmed by Krishi Bhavan / KVK and
the tribal cooperative.

## `agri.pest_report`
| Condition | Result | Source |
| --- | --- | --- |
| problem = animals (elephant / wild boar / other wildlife) | flag `wildlife_compensation` (info): "Record for Forest Department compensation"; priority ≥ 1 | Draft — confirm Forest Dept compensation procedure |
| problem = wilting AND area = whole plot | priority 2 (high), flag `wilt_whole_plot` (warn) — e.g. pepper quick wilt spreads fast | Draft — PENDING EXPERT REVIEW |
| problem = rot AND area = whole plot | priority 1 | Draft |
| no photo | flag `no_photo` (info): "Add a photo next visit — it helps the officer" | — |
| otherwise | priority 0 | — |

## `agri.produce_sale` (fair-price check)
Compares price received per unit with the **latest** price for the same item and unit in `agri_prices`
(any market, most recent `week_of`).

| Ratio (received / latest) | Result |
| --- | --- |
| ≥ 80 % | no flag |
| < 80 % | flag `below_market` (warn): "Below recent market price" |
| < 60 % | flag `far_below_market` (urgent), priority 1 |
| no price in table for the item/unit | flag `no_reference_price` (info) |

When the reference price is a demo price, the flag message says so ("compared with DEMO prices").
The 80 % / 60 % cut-offs are PENDING EXPERT REVIEW — they do not account for grade, moisture,
transport cost or whether the reference is a wholesale or retail price.
