# AADI · ആദി — Learning Platform for Tribal Hamlets

An initiative of **Community Innovations Foundation (CIF)**. One platform that serves a tribal
child or young person from the first letter to the first job — school tuition, literacy,
PSC/Bank/SSC coaching, languages, life skills and city readiness, counselling and mentoring —
across many hamlets and many agencies, online or offline.

This repository is the **demo instance**: 10 fictional hamlets across Kerala, 7 agencies
(CIF plus six fictional partners) with deliberately overlapping services, ~600 fictional people
and six months of activity. The same code becomes the production platform with `scripts/seed.js`
left out.

## How it is built

```
            ┌───────────── services (modules) ─────────────┐
 learning · exams · language · lifeskills · counselling · safeguarding
 community · marketplace · operations · analytics · channels (SMS/IVR)
            └───────────────────┬──────────────────────────┘
                                │  narrow, policy-checked SDK
                        ┌───────▼────────┐
                        │   THE BRAIN    │  identity · consent · policy · registries
                        │   (core/)      │  learning passport · hash-chained event log · sync
                        └───────┬────────┘
              cloud node  ◄─────┴─────►  centre hubs (same code, offline-first)
                                         ◄──── USB courier bundles where there is no signal
```

- **The brain** (`core/`) owns everything shared: hamlets, agencies, centres, programmes,
  people, consent, enrolments, the Learning Passport, notifications, audit.
- **Modules** (`modules/<id>/`) plug in by folder. Each declares its tables, routes, events and
  screens in `manifest.json`. See `CONTRACT.md`.
- **Fail-safe by design**
  - Every write is an append-only event, hash-chained per node (tamper-evident; `GET /api/core/chain/verify`).
    Tables are projections that can be rebuilt from the log.
  - Each module runs behind a circuit breaker (5 errors / 60 s → rests 30 s, returns a calm 503).
    A module that fails to load is skipped; the platform boots without it.
  - Hubs keep a full working copy of their hamlets and sync with exponential back-off; conflicts
    converge by last-writer-wins with a deterministic tie-break. Courier bundles (`/api/sync/export`
    → `/api/sync/import`) cover zero-connectivity centres. Import is idempotent.
  - The browser app caches what it has opened and queues saves while offline.
- **The family owns the record.** An agency sees a learner only while the learner is enrolled
  with it **and** an active consent (given by the guardian for minors — DPDP Act 2023) covers the
  scope: `profile, progress, wellbeing, contact, employment, research`. Withdrawal is immediate.
  Stewards (CIF) can see all, and every such read is audited.
- **Many agencies, one hamlet.** The service map (`/api/core/hamlets/:id/service-map`) shows each
  agency's programmes per track, gaps, shared tracks and timetable clashes.

## Run locally

Requires Node 22+ (uses the built-in `node:sqlite`; the only dependency is Express).

```bash
npm ci
npm run seed                 # builds data/cloud-1.db with the demo hamlets
AADI_DEMO=1 npm start        # http://localhost:8080  — demo sign-ins appear on the login page
npm test                     # full test suite
```

Demo accounts: `demo.<key>` / `demo1234` — e.g. `demo.learner`, `demo.youth`, `demo.guardian`,
`demo.facilitator`, `demo.facilitator.vjt`, `demo.teacher`, `demo.counsellor`, `demo.mentor`,
`demo.coordinator`, `demo.cif.admin`, `demo.steward`, `demo.cpo`, `demo.donor`, `demo.employer`, `demo.govt`.

Run a hub next to it:
```bash
AADI_NODE=hub-pachakkudi AADI_ROLE=hub AADI_UPSTREAM=http://localhost:8080 AADI_SYNC_KEY=secret PORT=8081 AADI_DEMO=1 npm start
# and start the cloud with the same AADI_SYNC_KEY=secret
```

## Deploy to the VPS (Docker)

See `deploy/DEPLOY.md`. In short: point two domains at the VPS, copy `deploy/.env.example`
to `deploy/.env`, then `cd deploy && docker compose up -d --build`. Caddy obtains HTTPS
certificates automatically. Backups: `deploy/backup.sh` (cron, keeps 14 days).

## Configuration

| Variable | Meaning |
|---|---|
| `AADI_NODE` | Unique node id (`cloud-1`, `hub-<hamlet>`) |
| `AADI_ROLE` | `cloud` or `hub` |
| `AADI_UPSTREAM` | Hub only: URL of the cloud node |
| `AADI_SYNC_KEY` | Shared secret for node-to-node sync |
| `AADI_HUB_HAMLETS` | Hub only: comma-separated hamlet ids to hold (empty = all) |
| `AADI_DEMO` | `1` shows demo sign-in buttons. **Never set in production.** |
| `AADI_DB` | Path to the SQLite file (default `data/<node>.db`) |
| `PORT` | HTTP port (default 8080) |

## From demo to production

1. Fresh database without `scripts/seed.js`; create the steward account with a strong password.
2. Unset `AADI_DEMO`; set a long `AADI_SYNC_KEY`.
3. Register real hamlets/agencies through the Platform screens; record real consents in person.
4. Connect real SMS/IVR/WhatsApp providers in the channels module (env vars, see its README section).
5. Run the safeguarding policy review with the CPO before any child-facing account goes live.
