# Epic Cure — Medically Tailored Groceries (MTG)

A warehouse checkout and shopping companion for **Epic Cure** (St. Augustine, FL), built for the
2026 NestforAwhile AI-Augmented Software Engineer Challenge, Problem Case: *Food is Medicine*.

Clients check in at a kiosk with a token (no ID, no paperwork), shop the farmers-market floor with a
phone companion that color-flags every scan, and leave through a volunteer exit terminal that hard-stops
contraindicated groceries before stock is decremented.

## Project Overview

**System of Record** (this repo): Node.js + Express, MVC, PostgreSQL.

- Kiosk check-in → enrollment verification → capacity gate → queued waiting line
- Clinical dietary matrix (diabetes, hypertension, CKD, heart failure) → personalized tier
- Per-item status: **Approved (green) / Capped (yellow) / Restricted (red)**
- In-cart recipe synthesis with aisle-aware missing-ingredient guidance
- Volunteer checkout with clinical hard stops and atomic FIFO inventory decrement
- De-identified analytics: distribution by category, funder attribution, restock route, expiry watch

**System of Intelligence** (separate service, later): open-source, open-weight model behind a strict
JSON contract. The web app never depends on it for a clinical decision — see `docs/AI-CONTRACT.md`.

> Status: baseline scaffold. AI engine adapter is stubbed with a deterministic local fallback.

## Setup Instructions

### 1. Requirements

- Node.js 20+
- PostgreSQL 14+ (Render Postgres, Supabase, or local)

### 2. Install

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — Postgres connection string
- `SESSION_SECRET` and `PHI_KEY` — random 32-byte hex (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `MAX_FLOOR_CAPACITY` — default 25

### 3. Create and seed the database

```bash
npm run db:schema
npm run db:seed
```

Seeded demo tokens: `MTG-1001` … `MTG-1005` (5 personas with overlapping chronicity).

### 4. Run

```bash
npm run dev     # node --watch
npm start       # production
```

- Kiosk: <http://localhost:3000/kiosk>
- Shop: `/shop` (after check-in)
- Exit terminal: `/checkout`
- Dashboard: `/dashboard`
- Health: `/healthz`

### 5. Tests

```bash
npm test
```

(Test suite lands with the verification epic; `node --test` is wired up.)

### 6. Deploy (Render)

`render.yaml` defines a free web service. Add a Render Postgres instance, copy its internal
connection string into `DATABASE_URL`, then run `npm run db:schema && npm run db:seed` once against
that database (Render shell or locally with the external URL).

> Render free instances sleep after inactivity; the first request after sleep takes ~30s. Rehearse the
> demo once after a cold start.

## Tool Usage Summary

| Component | Tool / service | Why |
|---|---|---|
| Architecture, schema, controllers, services | GitHub Copilot Chat (VS Code) | Free tier; spec-driven prompts in `PROMPTS.md` |
| Views + CSS | Copilot Chat, iterated prompts | Server-rendered EJS keeps the MVC boundary visible |
| Seed catalog + personas | Copilot Chat | Generate realistic nutrient rows, then verified against labels |
| Database | PostgreSQL (Render / Supabase free tier) | Relational integrity for atomic checkout |
| AI layer | Open-source model (TBD: Ollama / HF free endpoint) | Rule: no closed or paid LLM APIs |
| Deployment | Render free web service | Public URL, zero cost |
| Manual edits | Logged in `docs/MANUAL-EDITS.md` | Rule: only debugging/formatting/integration |

_Fill in model name, hosting, and any tool changes as the project proceeds._

## Team Collaboration

| Member | Primary role | Shared responsibilities |
|---|---|---|
| TBD | Backend / data | Schema review, prompt review, demo runbook |
| TBD | Frontend / UX | Prompt review, manual QA passes |
| TBD | AI / verification | Eval fixtures, deployment, presentation |

Working agreement: prompts are drafted in the shared `PROMPTS.md`, reviewed by at least one other
member before use, and every generated file is reviewed before commit. See `PROMPTS.md` for the
verbatim log.

## Software Engineering Strategy

1. **Spec → traceability.** `docs/RULES.md`, `docs/REQUIREMENTS.md`, `docs/RISKS-AND-ASSUMPTIONS.md`
   translate the event documentation into checkable requirements.
2. **Design first.** MVC boundary: models own SQL, services own clinical rules and AI adapters,
   controllers own request flow, views render only.
3. **Deterministic guardrails.** The dietary matrix is code, not a model guess. The LLM explains and
   synthesizes recipes; it cannot downgrade a restriction.
4. **Atomicity.** Checkout is one transaction: verify hard stops → decrement shelf stock → consume
   FIFO lots → write ledger → close session → free floor slot. Any failure rolls back.
5. **Verification.** Unit tests for the rules engine, API tests for check-in/scan/checkout, fixture
   set for model output validity, and a manual edge-case runbook.
6. **Deploy early.** Render + managed Postgres from the first working commit so the demo URL is never
   in question.

## Repository map

```
server.js                 HTTP entrypoint + graceful shutdown
src/app.js                Express wiring (helmet, sessions, static, routes)
src/config/               env + Postgres pool/transaction helper
src/models/               SQL only (clients, products, sessions, analytics)
src/services/             dietary matrix rules, AI engine adapter
src/controllers/          request flow for kiosk, shop, checkout, dashboard
src/routes/               URL map
src/views/                EJS templates (server-rendered MVC views)
src/scripts/              schema runner + seeding
public/                   CSS and browser JS
db/schema.sql             tables, indexes, analytics view, session store
db/seed.sql               catalog, rules mirror, grants, lots, stock
docs/                     rules, requirements, risks, AI contract, manual-edit log
PROMPTS.md                verbatim prompt history (submission deliverable)
```

## Clinical disclaimer

Dietary tiers and thresholds are derived from public guidance (DASH, NKF renal guidance, ADA
carbohydrate guidance) for a prototype. They are not medical advice and must be reviewed by a
registered dietitian before any real deployment.
