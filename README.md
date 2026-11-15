# Nourish by Epic Cure — Medically Tailored Groceries (MTG)

A client-choice warehouse system for **Epic Cure**, built for the 2026 NestforAwhile AI-Augmented
Software Engineer Challenge, Problem Case: *Food is Medicine*.

Clients check in at a kiosk with a card code (no ID, no paperwork), shop the floor with a phone
companion that color-codes every item for their health, get meal ideas from what is in their cart,
and leave through a volunteer exit terminal that stops contraindicated food before stock is
decremented.

**Live demo:** postgresql://nest4awhie_bkjbvj_user:RDayo2Cz3HXmGxfBgVRzUw7lryxcu6Hh@dpg-dbsa04mc6qcc738jq4pg-a.oregon-postgres.render.com/nest4awhie_bkjbvj
PGSSL=true · **Code:** [`webapp/`](webapp/) · **Prompt log:**
[`webapp/PROMPTS.md`](webapp/PROMPTS.md) · **Evidence:** [`webapp/docs/evidence/`](webapp/docs/evidence/README.md) ·
**Reflection:** [`REFLECTION.md`](REFLECTION.md)

---

## Project Overview

The system closes the loop the challenge asks for: a deterministic **System of Record** (this web
app + PostgreSQL) feeds live, structured data to an open-weight **System of Intelligence**, whose
suggestions are validated and streamed back into the UI.

| Epic | What the app does |
|---|---|
| **1 — Check-in & flow control** | Kiosk check-in by typed or scanned card code; rejects expired enrollment; food targets scaled by household size; when the floor is full, a live FIFO waiting line on the client's phone that admits them automatically |
| **2 — Health profiles** | Sign-up with conditions (ICD-10), tap-to-select allergies, optional health readings, preferred name and language; names and conditions encrypted at rest; diet plan assigned automatically |
| **3 — Point-of-choice intelligence** | Barcode/QR scan (works on iPhone) with Great fit / Small amounts / Not the best fit and a plain-language "why"; picks for today from live stock; meal ideas from the cart with missing ingredients located by aisle, shelf and bin |
| **4 — Inventory & safety** | Volunteer checkout with a clinical hard stop; atomic transaction that decrements stock FIFO by lot; 7-day expiry alerts; aisle-ordered restock list |
| **5 — Analytics** | De-identified dashboard; 3- and 6-month health trends by condition; pounds by category and grant; CSV exports for funders and audits |

Also: 5 languages (English, Español, Français, Kreyòl ayisyen, 中文), staff floor controls
(capacity, end session, clear floor), and a printable page of demo barcodes and client QR cards.

**Clinical safety design:** item status comes from a deterministic rules engine (DASH, renal and
diabetes thresholds), never from the model. The model can suggest recipes; every SKU it returns is
re-checked against the database and the client's profile, and anything unknown, out of stock or
restricted is dropped.

## Setup Instructions

Requirements: Node.js 20+, PostgreSQL 14+.

```bash
cd webapp
npm install
touch .env        # then fill in the values below
npm run db:schema           # safe to re-run; adds new columns to existing databases
npm run db:seed             # 107 products, rules matrix, 5 personas, lots, grants, health readings
npm run dev                 # http://localhost:3000/kiosk
```

`.env` values:

NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://nest4awhie_bkjbvj_user:RDayo2Cz3HXmGxfBgVRzUw7lryxcu6Hh@dpg-dbsa04mc6qcc738jq4pg-a.oregon-postgres.render.com/nest4awhie_bkjbvj
PGSSL=true
SESSION_SECRET=6c49e6b8481bec85ab7043cba371551a66dfef1fca2d3212fb2956440e074ed6
PHI_KEY=c272a6307f4d7cc9ddce42993b225ab260b0d44d84b2c99541f3da80270f1fae
MAX_FLOOR_CAPACITY=25
AI_PROVIDER=groq
AI_API_KEY=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
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=openai/gpt-oss-120b
AI_TIMEOUT_MS=6000
AI_MAX_TOKENS=900
AI_TEMPERATURE=0.2
AI_REPAIR_ATTEMPTS=1
AI_MAX_RECIPES=3



| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PGSSL` | `true` for Render Postgres, `false` for a local database without SSL |
| `SESSION_SECRET`, `PHI_KEY` | Random 32-byte hex each: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `AI_PROVIDER` | `groq` (default), `hf`, `ollama`, or `none` (deterministic fallback only) |
| `AI_API_KEY` | Groq or Hugging Face token — never commit it |
| `AI_MODEL` | Open-weight model id, e.g. `llama-3.3-70b-versatile` (default) or `openai/gpt-oss-120b` |
| `MAX_FLOOR_CAPACITY` | Optional starting capacity (also adjustable on the dashboard) |

**Try it:** demo card codes `MTG-1001` … `MTG-1005` (five personas with overlapping conditions).
Open **Demo codes** in the menu for printable barcodes and client QR cards. To demo the waiting line,
set capacity to 1 on the dashboard and check in two clients from two browsers.

Pages: `/kiosk`, `/enroll`, `/shop`, `/queue`, `/checkout` (volunteer), `/dashboard` (staff),
`/barcodes`, `/healthz`. Add `?lang=es` (or `fr`, `ht`, `zh`) to any page to switch language.

**Tests and evaluation:**

```bash
npm test          # 34 unit tests: rules engine, AI adapter, allergies, translations
npm run eval:ai   # model-output safety report → docs/evaluation/
```

**Deploy (Render):** `webapp/render.yaml` defines the web service. Create a Render Postgres database, set `DATABASE_URL` (and `AI_API_KEY`) in
the service's **Environment** tab, then run `npm run db:schema && npm run db:seed` once against the
Render database (external URL from your machine, or the Render shell). Free instances sleep; the
first request after sleep takes ~30 s.

## Tool Usage Summary

Three AI-assisted sessions built the project. Prompt numbers refer to the prompt log.

| Component | AI tool (model) | How it was used |
|---|---|---|
| Architecture & MVC scaffold, schema, seed catalog, dietary matrix | OpenCode (DeepSeek Flash) | Generated from the full event spec (prompts 003–006) |
| AI engine adapter & eval harness | OpenCode (DeepSeek Flash) | JSON-mode adapter with validation, one repair turn, SKU re-checks, deterministic fallback; model switch (006, 018) |
| Frontend (EJS views, CSS, browser JS) | OpenCode (DeepSeek Flash) → Claude | Baseline views, then Claude rewrote the shopper experience: plain-language labels, quantities, confirmation sheet, allergy chips, exit-pass QR, scanner, live waiting page (033, 040, 044, 045) |
| Backend fixes & features | Claude | Shop crash root cause (029), exit pass, queue rebuild with a database lock (033, 045, 052), CSV exports, health trends (033) |
| Data processing & analytics | OpenCode (DeepSeek Flash) → Claude | Baseline analytics; Claude added biometrics, 3/6-month trends and de-identified exports (033) |
| Languages & names | Claude | 5-language translation layer, preferred names, URL parameters (052) |
| Testing & verification | OpenCode (DeepSeek Flash), Claude | Adapter and rules tests; Claude added allergy and translation tests and ran scripted browser tests against a real database |
| Cloud deployment | OpenCode (DeepSeek Flash), ChatGPT | `render.yaml` Blueprint (013); environment variables, SSL, secret clean-up (055–064) |
| Runtime AI engine | Groq free tier, open-weight model (`AI_MODEL`); Ollama for local runs | Recipe synthesis and grocery matching; deterministic fallback when unavailable |
| Database & hosting | PostgreSQL + Render | Relational integrity for atomic checkout; public URL |
| Documentation | All three | README, prompt log, evidence notes |

Manual edits are limited to debugging, formatting and integration, and logged in
[`webapp/docs/MANUAL-EDITS.md`](webapp/docs/MANUAL-EDITS.md).

## Team Collaboration

> **Team: fill this in before submitting** — judges score shared decision-making (20%), so use
> your own words and real details.

| Member | Primary role | Also responsible for |
|---|---|---|
| Victoria/Brandon/Jude| _e.g. backend & database_ | _e.g. prompt review, deployment_ |
| Jude/Brandon | _e.g. frontend & UX testing_ | _e.g. demo script_ |
| Victoria/Brandon/Jude| _e.g. AI layer & verification_ | _e.g. presentation_ |

How we worked together:
- _How prompts were drafted and reviewed (who proposed, who refined, who checked the output)._
- _One decision the team made together (for example: warn-but-allow for not-recommended items, keeping the checkout hard stop)._
- _One time the team overruled the AI, or the AI changed the team's plan._
- _How work was split across the three AI sessions._

## Software Engineering Strategy

1. **Spec first.** The full event document was given to the AI verbatim; `webapp/docs/RULES.md`,
   `REQUIREMENTS.md` and `RISKS-AND-ASSUMPTIONS.md` turn it into checkable requirements.
2. **Clear boundaries.** MVC: models own SQL, services own clinical rules and the AI adapter,
   controllers own request flow, views only render.
3. **Deterministic guardrails.** Clinical status is code; the model explains and suggests, and its
   output is validated and sanitised before it reaches a shopper.
4. **Atomic, locked state changes.** Checkout is one transaction (hard-stop check → FIFO stock
   decrement → ledger → close session). Floor and queue changes run under a Postgres advisory lock
   with the shopper count derived from real sessions.
5. **Reproduce, then fix.** Bugs were reproduced against a real database and in a scripted browser
   before code changed; each fix was re-tested end to end. Requirement audits against the rules and
   problem case produced ranked fix lists.
6. **Verify.** 34 unit tests, a model-output eval harness, browser tests in all 5 languages, a
   concurrency test, and captured evidence in `webapp/docs/evidence/`.
7. **Deploy early.** Render + managed Postgres with a Blueprint; secrets only in the Environment tab.

## Repository map

```
README.md                  this file
REFLECTION.md              team reflection
webapp/server.js           HTTP entrypoint, floor sweep, graceful shutdown
webapp/src/app.js          Express wiring (helmet, sessions, i18n, static, routes)
webapp/src/config/         env, brand, Postgres pool/transactions
webapp/src/i18n/           translations (en, es, fr, ht, zh) and language middleware
webapp/src/models/         SQL only (clients, products, sessions/floor/queue, analytics)
webapp/src/services/       dietary matrix rules, AI engine adapter
webapp/src/controllers/    kiosk, enrollment, shop, checkout, dashboard, demo codes
webapp/src/lib/            allergens, CSV, shopper wording, helpers
webapp/src/views/          EJS templates
webapp/public/             CSS, browser JS, icon
webapp/db/                 schema.sql, seed.sql
webapp/tests/              unit tests
webapp/docs/               rules, requirements, risks, AI contract, manual edits, evaluation, evidence
webapp/PROMPTS.md          prompt history
```

## Clinical disclaimer

Dietary thresholds come from public guidance (DASH, NKF renal guidance, ADA carbohydrate guidance)
for a prototype. They are not medical advice and must be reviewed by a registered dietitian before
real use.
