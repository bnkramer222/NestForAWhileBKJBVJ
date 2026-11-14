# Risks, Gaps, and Assumptions to Resolve

Living document. Flags rule conflicts and engineering open questions **before** code exists.

## A. Rule conflicts / compliance risks

1. **Tool-list conflict.** §5 names "Cursor, GitHub Copilot, v0, Claude Artifacts" as example code-gen tools; §2 allows only VS Code + official Copilot extensions, Copilot via Codespaces/GitHub.dev, and Claude via its **web UI**. Cursor and v0 are not in the §2 allowlist. → Safest reading: §2 governs. Use Copilot Chat in VS Code + Claude web UI; treat Cursor/v0 as prohibited unless Dr. Umapathy confirms otherwise. **Action: ask organizer.**
2. **Copilot free-tier limits.** Copilot Free caps chat/completions per month. Budget requests; prefer small, high-leverage prompts; keep a running counter in `PROMPTS.md`.
3. **"Manual coding prohibited" vs. debugging allowance.** Every hand edit must be logged (`docs/MANUAL-EDITS.md`), with reason = debug | format | integration. Never write core logic by hand, even if faster.
4. **Judging weight ambiguity.** V&V and Presentation descriptions/weights appear swapped in the source table (15% vs 10%). Total is 100% either way; assume V&V 15 / Presentation 10 and confirm.
5. **HIPAA claim.** Claiming "HIPAA-compliant" in a 24-hour prototype is not defensible. Say "HIPAA-aligned design: PHI columns encrypted at rest, de-identified analytics, no real PHI used in demo." Judges may probe this.
6. **"No usage limits" vs. free endpoints.** §9 says free endpoints must create "zero financial liability or usage limits" — Groq/HF free tiers have rate limits. Mitigate with local Ollama as primary + remote free endpoint as fallback, and document the limit.
7. **Deployment vs. local model.** Vercel/Render serverless cannot host Ollama. The AI engine must be a separate always-on service (HF Space / Render free / fly.io) or local-only with a documented fallback. Plan topology early — this is the biggest architecture risk.
8. **Pre-existing work.** Everything must be created Sat–Sun. Do not pull in prior personal repos or large OSS scaffolds; boilerplate generators used *during* the event are fine but must be logged.
9. **Team size/roles.** 2–3 members; single-member work segments are penalized. Log who drove each prompt.

## B. Engineering open questions (must be decided + documented)

| # | Question | Proposed default |
|---|---|---|
| B1 | Stack | **Decided:** JavaScript, Node 20 + Express, server-rendered EJS views, PostgreSQL. |
| B2 | Database | **Decided:** PostgreSQL (Render Postgres / Supabase free tier); PHI columns AES-256-GCM encrypted in the app. |
| B3 | AI runtime | **Decided:** Groq free tier (open-weight Llama 3.3 70B) for the deployed demo; Ollama `llama3.1:8b` locally. Adapter is OpenAI-compatible and validates/repairs/sanitises every response. |
| B4 | Warehouse grid | A–F aisles × shelves S1–S4 × bins 01–08; serpentine client path, restock route sorted by aisle/shelf |
| B5 | Dietary matrix source | DASH/renal/diabetes guidance (NIH, NKF, ADA) → codified rules table, cited in assumptions doc |
| B6 | Restricted vs capped vs approved | Deterministic rules engine decides (SoR); LLM only explains/recommends, never overrides a hard restriction |
| B7 | PHI encryption | App-level AES-GCM for PHI columns + TLS + hashed lookup tokens; no plaintext names in analytics views |
| B8 | Queue ordering | FIFO by check-in timestamp with capacity gate; transactional counter to avoid race on concurrent check-ins |
| B9 | Checkout atomicity | Single DB transaction decrementing lot + shelf totals with row locks; idempotency key per scan batch |
| B10 | Model eval | **Implemented:** `npm run eval:ai` — structural validity, SKU safety invariants, p95 latency, source mix; reports in `docs/evaluation/` |
| B11 | Offline/weak signal | Client-side cache of last manifest + optimistic UI + retry with backoff; degrade to rules-only mode |
| B12 | Barcode scanning | `BarcodeDetector` where available, fallback manual SKU entry (no third-party AI plugins) |

## C. Assumptions (section 8 deliverables)

1. No floor map supplied → logical grid assumed; documented in `docs/ASSUMPTIONS.md` with diagram.
2. Clinical matrix derived from public dietary guidance, not clinical advice; disclaimer in UI.
3. Personas deliberately include multi-morbidity (T2D + CKD + HTN) to test rule precedence.
4. Inventory is volatile: lots, arrival dates, 7-day expiry flags, donation source, grant stream.
5. Retrieval-augmented prompting over a small curated nutrition/recipe corpus instead of fine-tuning.
6. Validation is metric-based, not vibes: pass rate, JSON validity, latency, hard-stop correctness.

## D. AI engine decision record (documented rule risk)

**Chosen for the deployed demo:** Groq free tier, open-weight `llama-3.3-70b-versatile`.
**Local/offline fallback:** Ollama `llama3.1:8b-instruct-q4_K_M`.

- Groq is reachable from Render and exposes an OpenAI-compatible JSON mode, so the adapter can
  enforce a schema instead of parsing prose.
- Groq publishes rate limits, while §9 asks for endpoints with no "usage limits." This is a
  disclosed tension, not a hidden one: the app is architected so a 429, timeout, or malformed
  response degrades to deterministic local synthesis and the UI shows the source. The demo never
  breaks because of a quota.
- Ollama is the cleanest licence/cost story but cannot run on Render's free tier, so it is not the
  deployed endpoint.
- Hugging Face is supported as a secondary provider (`AI_PROVIDER=hf`) for redundancy.
- Every response is structurally validated, repaired once if invalid, and **every SKU is re-checked
  against live stock and the clinical matrix** before it reaches the UI.
- Full contract and evaluation method: `docs/AI-CONTRACT.md`, `npm run eval:ai`.

## E. Event compliance notes

- **Start date.** All project files were created during the event window (Nov 14, 2026). The git
  repository must be initialized on Nov 14 and the first commit must carry that date; do not import
  any pre-event code or repos. If a commit timestamp looks earlier, fix the clock/history before
  submission and be ready to explain.
- **Manual edits.** No manual code edits have been made so far; all source was produced by AI tooling
  from the prompts in `PROMPTS.md`. Keep `docs/MANUAL-EDITS.md` updated if debugging requires a hand
  edit, and never claim AI authorship for hand-written logic (misrepresentation is a prohibited
  action).
- **Prompt log.** `PROMPTS.md` records user prompts verbatim only; do not backfill or embellish it.
- **Tool attribution.** The README table must name the actual tool used per component. Do not credit
  Copilot for code produced by another assistant.

