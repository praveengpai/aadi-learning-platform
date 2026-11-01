# Module Contract (v2)

> v2 (Nov 2026) generalises the platform from learning to **community services**. Everything in v1 still holds; v2 adds the section "v2 — community services" at the end. New modules MUST read it.

The platform = one **Brain** (`core/`) + many **modules** (`modules/<id>/`). A module plugs in by
dropping a folder; the brain discovers it at boot. A broken module is isolated (circuit breaker,
503 for that module only) — the rest of the platform keeps working. **Never edit `core/`,
`server.js`, `public/` (shell), `scripts/seed.js` or `tests/helpers.js`.** If you need something from
the brain that does not exist, work around it inside your module and list the request in your report.

Runtime: Node 22, CommonJS on the server, **no new npm dependencies** (express is available).
Database: SQLite via the brain (event-sourced; you never touch SQL writes directly).
Run: `npm run seed && AADI_DEMO=1 PORT=<your port> npm start` (use a port 8100–8199 unique to you).
Test: `node --disable-warning=ExperimentalWarning --test tests/<your-module>.test.js`

## Folder layout
```
modules/<id>/
  manifest.json
  index.js          # server side: module.exports = function init(ctx) { ...; return { seed, health } }
  public/ui.js      # browser side: ES module, export default { views: { <viewId>: async (el, k) => {} } }
  content/*.json    # optional static content packs (questions, lessons, etc.)
```

## manifest.json
```json
{
  "id": "exams", "version": "1.0.0",
  "name": "Exam Preparation", "name_ml": "പരീക്ഷാ പരിശീലനം", "icon": "🎯",
  "description": "PSC, Bank, SSC, RRB coaching: question bank, mock tests, current affairs, calendar.",
  "tables": { "exams_questions": ["exam", "subject", "topic", "question", "options", "answer", "explanation", "lang", "difficulty"] },
  "types": { "difficulty": "INTEGER" },
  "emits": ["exams.mock_completed"], "subscribes": ["core.enrolled"],
  "nav": [
    { "view": "home", "label": "Exam Prep", "label_ml": "പരീക്ഷാ പരിശീലനം", "icon": "🎯", "roles": ["learner", "teacher", "facilitator", "platform_admin", "agency_admin"], "section": "learn" }
  ]
}
```
- Table names MUST start with `<id>_` (dashes → underscores). Every table automatically gets `id, updated_at, node, deleted`. Add `hamlet_id` and `person_id` columns wherever the row belongs to a hamlet/person — sync filtering and analytics rely on it. JSON values (arrays/objects) are stored and returned transparently.
- Column type defaults to TEXT; declare INTEGER/REAL in `types`.
- `section` is one of: `learn`, `teach`, `care`, `community`, `ops`, `insight`, `admin`.
- Roles: `platform_admin, cpo, agency_admin, coordinator, facilitator, teacher, counsellor, mentor, learner, guardian, donor, employer, govt_viewer`.

## Server SDK — `ctx`
```js
module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, on, brain, httpError } = ctx;
  router.get('/questions', requires('learn', 'teach'), (req, res) => res.json(data.find('exams_questions', { exam: req.query.exam })));
  // routes are mounted at /api/m/<id>/... ; req.user is the signed-in user row (id, role, agency_id, person_id, hamlet_ids, display_name)
  return { seed: async (demo) => { /* create demo rows */ }, health: () => ({ questions: sqlOne('SELECT COUNT(*) n FROM exams_questions').n }) };
};
```
- `requires(...perms)` — middleware; passes if user has ANY listed permission. `authed` — any signed-in user.
  Perms: `platform.manage, agency.manage, hamlet.coordinate, learner.read, learner.write, teach, assess, counsel, mentor, safeguard, content.author, content.review, learn, family, donate, hire, analytics.aggregate, ops`.
- `data.put(table, row, req.user)` → upsert (pass `id` to update; omit to create). Returns stored row. `data.del(table, id, user)` soft-deletes. `data.get(table, id)`, `data.find(table, where, {order, limit})`. Writes go through the hash-chained event log and sync to hubs automatically.
- `sql(selectSql, ...params)` / `sqlOne(...)` — **read-only** SELECTs on your own tables and shared registries (`hamlets, agencies, agency_presence, centres, programmes, competencies`). Remember `WHERE deleted=0`. Personal core tables (`persons, enrolments, consents, passport_entries`) are readable only by approved modules for aggregate/join work — still filter by `brain.persons.visibleIds(user)` before returning anything person-level.
- `tx(fn)` — wrap bulk writes (seeding!) for speed.
- `emit('<id>.something', payload, user, hamlet_id)` — domain events (must be prefixed with your id). `on('core.enrolled' | 'core.consent_revoked' | 'exams.*' | '*', ev => {})` — subscribe; handler errors are isolated.
- Throw `httpError(400|403|404, 'message')` for user-facing errors. Any other throw → 500 + counts toward your breaker.

### `ctx.brain` (policy-checked facade)
```
brain.persons.visible(user, {hamlet_id, q, kind, limit}) → persons this user may see (redacted)
brain.persons.visibleIds(user) → array of ids, or null meaning "all" (stewards)
brain.persons.get(user, id, scope='profile'|'progress'|'wellbeing'|'contact'|'employment') → person or throws 403
brain.persons.basic(id) → {id,name,hamlet_id,kind,gender,age,school_class,language} — display-safe, use after a policy check
brain.persons.raw(id) → unredacted, for system jobs only; NEVER send to a client
brain.policy.canSee(user, personId, scope) → {ok, reason}; brain.policy.can(user, perm); brain.policy.suppress(n, user) (k-anonymity for aggregates)
brain.hamlets.list()/get(id); brain.agencies.list()/get(id); brain.centres.list({hamlet_id}) / get / register(row, user)
brain.notifications.queued(limit) / setStatus(id, 'sent'|'failed'|'delivered')
brain.programmes.list({hamlet_id, agency_id, module, track}) / get / create(row, user)
brain.enrolments.forPerson(pid) / forProgramme(prid) / enrol(pid, prid, user)
brain.consent.has(personId, agencyId, scope)
brain.passport.award({person_id, type:'competency'|'certificate'|'milestone', ref, title, level, evidence, agency_id}, user)   // idempotent
brain.passport.entries(pid)
brain.competencies.list({domain}) / upsert({id, code, domain, title, title_ml, level, stage})
brain.notify(personId, message, {channel:'auto'|'sms'|'ivr'|'whatsapp'|'app'}, user)    // outbox; channels module delivers
brain.audit(user, action, target, detail)
brain.brand → {name, name_ml, short, owner}  (use for SMS/notification prefixes etc.)
brain.users.get(id) / byRole(role, where) / create({username,password,role,agency_id,...}, actor)
```
**Policy rule you must uphold:** a user sees a person's data only if `brain.policy.canSee(user, personId, scope).ok`.
Agencies see learners only with enrolment + active consent; wellbeing data only for counsellors; learners see only themselves;
guardians see their wards. Donors, govt viewers see aggregates only (use `brain.policy.suppress`).

Programmes may carry their own name: `brand`/`brand_ml` (e.g. "AADI Smart Learning Centre") and `sponsor_agency_id` (e.g. CIF sponsoring a programme run by a youth group). The platform is not AADI — AADI is one programme on it.

Core programme tracks: `tuition, literacy` (module learning), `exams`, `language`, `lifeskills, digital` (lifeskills), `counselling`.

## Seeding (`seed(demo)`)
Called once after core demo data exists. `demo` has:
```
brain, store, R (deterministic rng: R.int(a,b), R.pick(arr), R.chance(p), R.sample(arr,n), R.rnd()), daysAgo(n) → ISO
hamlets[], hamletByKey.h1..h10, agencies[], agencyByKey.{cif,vjt,syf,std,glc,sto,uoc}
persons[], children[], youth[], adults[]  (rows: id, hamlet_id, name, gender, dob, kind, school_class, guardian_id, aspirations, literacy_level, language)
users.{steward,cpo,'cif.admin','vjt.admin',...,coordinator,facilitator,'facilitator.vjt',facilitator2,teacher,'teacher.uoc',counsellor,mentor,learner,youth,guardian,donor,employer,govt}
programmes[] (agency_id, hamlet_id, module, track, title, schedule), programmesFor({hamlet_id, module, track}), enrolledIn(programmeId) → persons
demoLearner (child, CIF-enrolled, hamlet h1 Pachakkudi), demoYouth (PSC aspirant, hamlet h2 Thenmala), demoGuardian
```
Use `ctx.data.put` inside `ctx.tx(() => ...)`. Seed should be rich enough for a funder demo (history over the last ~6 months, realistic Malayalam + English content) but finish in < 5 s.
Demo logins: `demo.<key>` / `demo1234` (e.g. `demo.learner`, `demo.youth`, `demo.facilitator`, `demo.teacher`, `demo.counsellor`, `demo.cpo`, `demo.steward`, `demo.donor`, `demo.employer`, `demo.guardian`, `demo.govt`).

## Browser UI — `public/ui.js`
Plain ES module, no build step, no external libraries. The shell imports `/m/<id>/ui.js` and calls the view:
```js
export default {
  views: {
    home: async (el, k) => { el.append(k.ui.card({ title: k.t('Mock tests', 'മോക്ക് ടെസ്റ്റുകൾ'), body: '...' })); },
  },
};
```
Route: `#/m/<id>/<view>?a=1` → `k.params = {a:'1'}`. Kit `k`:
```
k.user, k.lang ('en'|'ml'), k.t(en, ml), k.node, k.moduleId
k.brand → {name, name_ml, short, owner}  — the PLATFORM's name (CIF's product; a setting). Never hard-code a name.
k.api.get('/path') / post('/path', body) / put / del     → /api/m/<id>/path ; JSON; throws Error(message) on non-2xx
k.core.get('/persons?hamlet_id=..') / post(...)           → /api/core/...
  GETs are cached for offline use (result has ._offline=true when served from cache).
  POST/PUT while offline are queued and replayed later → returns {queued:true}.
k.go('#/m/exams/test?id=..'), k.params, k.refresh()
k.h(tag, attrs, ...children) → HTMLElement   (attrs: class, style, onclick, etc.; children: strings/nodes/arrays/null)
k.esc(str)
k.toast(msg, 'good'|'warn'|'bad'|'info')
k.speak(text, lang?)  → read aloud (Web Speech API; for low-literacy mode)
k.ui.card({title, subtitle, body, actions, tone})            body/actions: node|string|array
k.ui.stat(label, value, hint)        k.ui.grid(children, minPx=220)      k.ui.section(title, children)
k.ui.table(cols[{key,label,render:(row)=>node|string}], rows, {empty, onRow})
k.ui.badge(text, tone)   k.ui.button(label, onClick, {tone:'primary'|'ghost'|'danger', small})
k.ui.form(fields[{name,label,type:'text'|'number'|'date'|'select'|'textarea'|'checkbox'|'multiselect'|'hidden', options:[{value,label}]|[str], required, value, placeholder}], async onSubmit(values), {submitLabel})
k.ui.modal(title, contentNode) → {close}     k.ui.confirm(message) → Promise<bool>
k.ui.tabs([{id,label,render:async(el)=>{}}], activeId)
k.ui.empty(text)   k.ui.loading()   k.ui.error(err)
k.ui.bars([{label,value}], {max, unit})      k.ui.progress(0..1, label)   k.ui.spark([numbers])
k.ui.personPicker({onPick:(person)=>{}, kind, hamlet_id})   k.ui.hamletSelect(onChange, {all:true})
k.ui.kv([[label, value], ...])   k.ui.pill(text)   k.ui.icon(emoji, label)
k.style(cssText)   // inject module CSS once; prefix your classes with your module id
```
Shell CSS classes you may use: `card, grid, row, stack, muted, small, btn, btn primary, btn ghost, btn danger, badge good|warn|bad|info, tbl, pill, big, mono, ml` (`.ml` uses the Malayalam font).
Design for: low literacy (icons + read-aloud), Malayalam first-class (`k.t`), small Android screens (≥ 360 px), slow networks (few requests, small payloads), shared devices.

## Quality bar
- Every route checks permissions; every person-level response respects `canSee`.
- Bilingual labels for everything a learner/guardian sees.
- Tests in `tests/<id>.test.js` using `const { bootDemo } = require('./helpers')` — cover happy path, permission denials (e.g. another agency's facilitator, a donor), and consent (learner whose consent is revoked disappears).
- `node --check` every JS file; run your tests until green.


---

# v2 — community services

The platform is now a community-services engine; learning is one module. v2 adds roles, consent
scopes, households, the **form round-trip engine**, per-hamlet switches, budgets and signed modules.

## New roles and permissions
Roles: `health_worker` (ASHA / nurse), `doctor` (remote reviewer), `field_officer` (department officer —
Krishi Bhavan, ST promoter, Akshaya, panchayat). All are agency-level and see people only with enrolment + consent, like any agency staff.

| Permission | Roles |
| --- | --- |
| `forms.capture` | platform_admin, agency_admin, coordinator, facilitator, health_worker, field_officer |
| `forms.review` | platform_admin, agency_admin, doctor, field_officer |
| `forms.design` | platform_admin, agency_admin |
| `health.capture` | platform_admin, health_worker |
| `health.review` | platform_admin, doctor |
| `services.assist` | platform_admin, agency_admin, coordinator, facilitator, field_officer |
| `agri.advise` | platform_admin, agency_admin, field_officer |

Staff with `learner.write` **or** `forms.capture` may register people (`POST /api/core/persons`), record in-person consent and enrol people into their own agency's programmes.

## New consent scopes
`health`, `services` (government schemes and certificates), `livelihood` (farm, forest produce), `survey`.
**Restricted scopes** can never be read by other roles, even with consent:
- `wellbeing` → counsellor only (platform_admin and CPO as audited stewards).
- `health` → health_worker and doctor only (platform_admin as audited steward; **the CPO does not read health data**).
A module may add its own scope in `manifest.consent_scopes`: `{ "my_scope": { "label": "...", "restrict_to": ["role"] } }` — core scopes are never overridden.

Programmes for new services use new `track` values, e.g. `health`, `elder_care`, `services`, `agriculture`. A person must be **enrolled** in one of the agency's programmes and have **active consent** for the scope before agency staff see their data. Seed these programmes, enrolments and consents in your module seed.

## Households
Core table `households` (`hamlet_id, name, head_person_id, house_no`); `persons.household_id`. Every demo family (guardian + children/youth) is one household; `demo.households` lists them.
`brain.households.get(id) / list({hamlet_id}) / members(user, id) / create({hamlet_id, name, head_person_id, members}, user)`.
API: `GET /api/core/households?hamlet_id=` (only households where the user can see a member), `POST /api/core/households`.

## The form round-trip engine (use this — do not build your own capture/review tables)
Most services follow one pattern: **capture offline at the hub → travels with the courier → reviewer in the city replies → reply returns next visit.** The engine lives in core (tables `form_defs`, `form_submissions`, replicated and hamlet-scoped for sync). A module brings: form definitions, a **rule** (its sub-engine) and screens.

### Define forms at start-up (in `init`, not only in seed)
```js
brain.forms.define({
  key: 'health.bp_check',              // must start with your module id + '.'
  title: 'Blood pressure check', title_ml: '…',
  subject: 'person',                   // 'person' | 'household' | 'hamlet'
  scope: 'health',                     // consent scope required (person: of the person; household: of the head)
  review: { perm: 'health.review' },   // null = no review step (closes at once); add agency_id to forward to another agency
  capture_perm: 'health.capture',      // optional extra permission to fill it in (on top of forms.capture)
  allow_self: false,                   // true lets the person themself (learner/youth) submit about themselves
  fields: [ { name: 'sys', type: 'integer', label: 'Systolic', label_ml: '…', required: true, min: 60, max: 260, unit: 'mmHg' }, … ],
}, null);
```
Field types: `text, textarea, integer, decimal, date, select_one, select_multiple, yes_no, photo, geopoint, note`.
Field props: `name, label, label_ml, hint, hint_ml, required, min, max, unit, choices:[{value,label,label_ml}], relevant:{field, equals|in|present}` (relevant field must come earlier; irrelevant answers are dropped).
Photos are JPEG/PNG data URLs ≤ 200 KB (the shell shrinks camera photos automatically).
`define` is idempotent; form ids are deterministic (`frm_<key>`), so cloud and hubs converge; a node running **older** module code never overwrites a definition from newer code (it compares your manifest `version`) — **bump your manifest version when you change a form.**

### Rules = your sub-engine (runs at capture, offline)
```js
brain.forms.rule('health.bp_check', (answers, { person, form }) => ({
  flags: [{ code: 'bp_high', level: 'urgent' | 'warn' | 'info', message: 'Very high BP — refer today', message_ml: '…' }],
  priority: 3,   // 0 normal, 1 soon, 2 high, 3 urgent — reviewers see urgent first
}));
```
Rules must be pure, fast and never throw (a throw is caught and logged as "please review manually").
**Clinical and agronomic rules are drafts until an expert approves them** — mark the thresholds in a `content/RULES.md` file with their source and "PENDING EXPERT REVIEW".

### Module-scoped engine calls (`ctx.brain.forms`)
`submit(user, {form_key, person_id|household_id|hamlet_id, answers, client_ref}) · list(user, {status, person_id, hamlet_id, mine, form_key}) · queue(user) · one(user, id) · reply(user, id, {reply, reply_ml, outcome, close}) · validate(key, answers) · canCapture(user, key) · canReview(user, key) · get(key)` — all restricted to your module's forms and fully policy-checked (consent, restricted scopes, agency, hamlet, per-hamlet switch). Submitting is idempotent per `client_ref`.

### Core API (the generic screens and other modules use it too)
`GET /api/core/forms?module=` · `GET /api/core/forms/defs/:key` · `POST /api/core/forms/submissions` · `GET /api/core/forms/submissions?module=&status=&mine=1&person_id=` · `GET /api/core/forms/queue?module=` · `GET /api/core/forms/submissions/:id` · `POST …/:id/claim|reply|seen|close` · `GET /api/core/forms/export/:key.csv`.
A reply automatically queues a neutral notification to the person ("you have a message waiting at the centre") — it never names the form or service. **Never put health or case details in notifications.** Notification statuses: `queued, sent, delivered, failed, withdrawn`.
Staff with `hamlet_ids` see form records only from those hamlets. `brain.persons.wards(user)` lists a guardian's children.

### Browser kit additions
`k.ui.formFill(def, { person_id | household_id | hamlet_id, answers, onDone(result), submitLabel })` renders any form, works offline (outbox + client_ref), read-aloud on every label, camera photos, location.
`k.ui.submissionCard(s, { onSeen })` shows a submission, its flags and the reply in plain words.
Generic screens you can link to instead of building your own: `#/m/surveys/fill?key=<form_key>&person=<id>`, `#/m/surveys/item?id=<submission_id>`, `#/m/surveys/queue`.

## Per-hamlet switches (the Oorukoottam decides)
A module can be switched off in particular hamlets (`module_scopes`). Staff whose hamlets are all switched off get `503 module_off_here` from your routes automatically, and form submissions there are refused. Use `brain.modules.enabledIn(hamletId)` before showing hamlet-specific content. Critical modules (safeguarding) cannot be switched off.

## Budgets (the suitcase has 512 Wh and limited storage)
Declare in `manifest.json`: `"budget": { "storage_mb": 50, "sync_priority": 1-5 (1 = most urgent), "power": "low" | "medium" | "high" }`. `GET /api/core/modules/budgets` reports actual storage against it. Keep content packs small; prefer audio and text over video.

## Hub installs and signed modules
- `AADI_MODULES=learning,health,…` makes a node load only those modules (critical ones always load).
- With `PLATFORM_MODULE_KEY` set, a module loads only if its `SIGNATURE` matches (`node scripts/sign-modules.js`). Never commit a SIGNATURE in a feature branch; release signs.

## v2 quality bar (in addition to v1)
- Use the form engine for every capture → review → reply flow; never store person data in a table without `person_id` and `hamlet_id`.
- Tests must cover: restricted-scope denial (e.g. a facilitator or CPO cannot read health), another agency's staff denied, consent withdrawal removing access, a reviewer reply reaching the capturer, and the per-hamlet switch.
- Notifications never contain sensitive details.
- No real personal data in seeds — fictional people only. Seeds must finish in < 5 s and must not use the shared demo RNG in a way that changes other modules' data: draw from your own stream: `const R = demo.rng(<your unique number>)` (same API as `demo.R`). Never call the shared `demo.R` in a new module.
