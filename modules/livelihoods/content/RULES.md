# Livelihoods — financial rules (DRAFT — PENDING REVIEW)

Every threshold and convention below is a **draft written for the demo**. None has been checked by
Kudumbashree (State Mission / CDS), NABARD SHG-bank-linkage guidance, or a microfinance adviser.
**Status: PENDING REVIEW by Kudumbashree CDS / a finance professional.** Change them in `ledger.js`
and `forms.js`, bump `manifest.json` `version`, and record the source here.

| Rule | Where | Draft value | Source |
| --- | --- | --- | --- |
| Money stored as integer paise | `ledger.js` | ₹1 = 100 paise | engineering choice (exact sums) |
| Max per entry | `ledger.js` `KINDS[*].max` | savings ₹10,000; loan / repayment ₹2,00,000; interest ₹50,000; expense ₹1,00,000; income / bank ₹5,00,000 | guess — PENDING REVIEW |
| Max loan period | `ledger.js` `MAX_MONTHS` | 36 months | guess — PENDING REVIEW |
| Repayment schedule | `ledger.js` `instalments()` | equal monthly principal in whole rupees, first due 1 month after the loan, last instalment takes the remainder | common NHG practice — PENDING REVIEW |
| Interest | `ledger.js` | recorded as separate `interest` entries; **not** computed or enforced by the app. Seed uses 1 % a month on the balance (12 % a year, flat-on-balance) only as demo data | PENDING REVIEW (groups set their own rate; confirm the norm to show) |
| Repayment order | `ledger.js` `loanBook()` | a member's repayment goes to her oldest open loan first | PENDING REVIEW |
| Overdue | `ledger.js` `GRACE_DAYS` | late when repaid < amount due 15 days ago | guess — PENDING REVIEW |
| Lendable cash | `ledger.js` `summarize()` | cash in hand + bank balance (no reserve kept back) | PENDING REVIEW — many groups keep a minimum balance |
| Never negative | `ledger.js` `replay()` | cash, bank and each member's loan can never go below zero at any point in the book; same-day entries count money in before money out | bookkeeping invariant |
| Group fund identity | `ledger.js` `summarize()` | savings + interest + income − expense = cash + bank + loans outstanding | bookkeeping invariant |
| Savings regularity | `ledger.js` `health()` | share of (active member × month) slots in the last 6 months with any savings | PENDING REVIEW (Kudumbashree grading uses its own criteria) |
| Repayment rate | `ledger.js` `health()` | principal repaid (capped at what was due) ÷ principal due to date | PENDING REVIEW |
| Group grade | `ledger.js` `health()` | good: regularity ≥ 80 %, repayment ≥ 90 %, ≥ 3 meetings in 90 days; help: regularity < 50 % or repayment < 70 % or no meeting in 90 days; else watch | guess — PENDING REVIEW |
| Loan rule: above lendable | `forms.js` `loanRule` | warn + priority 2 when the amount is more than the group's lendable cash | PENDING REVIEW |
| Loan rule: member overdue | `forms.js` | warn + priority 2 when the member already has an overdue loan | PENDING REVIEW |
| Loan rule: savings multiple | `forms.js` `T.savingsMultiple` | info when the amount is more than 4× her own savings | guess (linkage norms often 1:4) — PENDING REVIEW |
| Loan rule: long term | `forms.js` `T.longMonths` | info when longer than 24 months | guess — PENDING REVIEW |
| Idea rule: bank linkage | `forms.js` `T.bankLinkageRupees` | info when ₹50,000 or more is needed | guess — PENDING REVIEW |
| Idea rule: food licence | `forms.js` | info for honey / spices / millets / licence need: FSSAI registration usually required | PENDING REVIEW by a food-safety officer |
| Member eligibility | `index.js` | adult (18+), lives in the group's hamlet, `livelihood` consent to the group's agency; max 30 members | PENDING REVIEW (Kudumbashree: one woman per family, 10–20 members) |
| Leaving a group | `index.js` | refused while the member still owes a loan; savings refund is **not** handled yet | PENDING REVIEW |

Flags shown to reviewers deliberately carry **no amounts or names**, so a mistyped or forged group id
cannot reveal another group's book.
