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
| B3 | AI runtime | Ollama + small open-weight model locally (dev), HF Inference free endpoint for deployed demo; strict JSON schema + repair/validation layer |
| B4 | Warehouse grid | A–F aisles × shelves S1–S4 × bins 01–08; serpentine client path, restock route sorted by aisle/shelf |
| B5 | Dietary matrix source | DASH/renal/diabetes guidance (NIH, NKF, ADA) → codified rules table, cited in assumptions doc |
| B6 | Restricted vs capped vs approved | Deterministic rules engine decides (SoR); LLM only explains/recommends, never overrides a hard restriction |
| B7 | PHI encryption | App-level AES-GCM for PHI columns + TLS + hashed lookup tokens; no plaintext names in analytics views |
| B8 | Queue ordering | FIFO by check-in timestamp with capacity gate; transactional counter to avoid race on concurrent check-ins |
| B9 | Checkout atomicity | Single DB transaction decrementing lot + shelf totals with row locks; idempotency key per scan batch |
| B10 | Model eval | 20-item fixture set with expected green/yellow/red + recipe JSON validity rate, latency p95 target |
| B11 | Offline/weak signal | Client-side cache of last manifest + optimistic UI + retry with backoff; degrade to rules-only mode |
| B12 | Barcode scanning | `BarcodeDetector` where available, fallback manual SKU entry (no third-party AI plugins) |

## C. Assumptions (section 8 deliverables)

1. No floor map supplied → logical grid assumed; documented in `docs/ASSUMPTIONS.md` with diagram.
2. Clinical matrix derived from public dietary guidance, not clinical advice; disclaimer in UI.
3. Personas deliberately include multi-morbidity (T2D + CKD + HTN) to test rule precedence.
4. Inventory is volatile: lots, arrival dates, 7-day expiry flags, donation source, grant stream.
5. Retrieval-augmented prompting over a small curated nutrition/recipe corpus instead of fine-tuning.
6. Validation is metric-based, not vibes: pass rate, JSON validity, latency, hard-stop correctness.
