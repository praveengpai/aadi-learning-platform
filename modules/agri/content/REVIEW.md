# Agriculture & Forest Produce — content awaiting expert review

**Status: PENDING REVIEW by Krishi Bhavan / KVK.** Nothing here is agronomic advice until a qualified
officer approves it. In the app, every seeded advisory starts as `draft`; families see only
advisories a field officer (`agri.advise`) has approved.

## 1. Advisories — `advisories.json` (16 drafts)
- Season windows (`months`) are approximate for Idukki high ranges; Attappadi (h2) differs. Check per hamlet.
- No chemical pesticide doses are included by design: integrated pest management first, then "ask the Krishi Bhavan".
- Malayalam was written for plain reading aloud; please check terms (e.g. ദ്രുതവാട്ടം, മൂടുചീയൽ, ഇലപ്പേൻ, തടതുരപ്പൻ) with local usage and tribal-language speakers (Muthuvan, Mannan, Irula).
- "Wild animal damage" tip refers to Forest Department compensation — confirm the current procedure, documents and time limit.

## 2. Crop and forest-produce list — `items.json`
- Confirm which items each hamlet grows / gathers and sells; add or remove items.
- Confirm Malayalam names (ഉറുഞ്ചിക്കായ / സോപ്പുകായ for soapnut, കസ്തൂരിമഞ്ഞൾ for wild turmeric).
- Units: all are kg today. Honey is sometimes sold by litre or bottle — the sale form allows kg / litre / nos; the fair-price check only compares like units.
- Minor forest produce collection rights (Forest Rights Act 2006) and which items the cooperative is allowed to buy — confirm with the ST Development Department / Forest Department.

## 3. Prices — `agri_prices`
- **All seeded prices are DEMO PRICES — NOT REAL MARKET DATA.** They are random walks around a made-up base (`demo_base`) and are labelled so in the `source` column and on every screen.
- For real use, decide the price sources: tribal cooperative society (SC/ST federation) purchase rates, Vanasree / Forest Department outlets, Spices Board auction (cardamom), Kerala agricultural market (VFPCK / APMC) and local markets. Record the source with every entry.

## 4. Rules — see `RULES.md`
The fair-price thresholds (80 % / 60 %) and pest-report priorities are drafts.
