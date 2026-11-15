# Submission Checklist

Deadline: **Sun Nov 15, 2026, 9:00 AM** — upload a compressed archive to https://bit.ly/26NestforAwhileSol.

## 1. README.md (repository root)

Evidence index and evaluation notes: `docs/evidence/README.md`. Screenshots go in the submission archive under `screenshots/`.
- [x] Project Overview — what it does, track/problem case addressed
- [x] Setup Instructions — run/test locally, env vars, seed commands
- [x] Tool Usage Summary — table: component → tool/service → why
  - [x] frontend, backend, data processing, AI layer, cloud deployment
- [ ] Team Collaboration — roles, task division, how the team worked (**fill in names in README**)
- [x] Software Engineering Strategy — design → develop → test → refine → deploy with AI
- [ ] Architecture diagram (SoR vs SoI) + data-loop description
- [x] Assumptions register reference (`docs/RISKS-AND-ASSUMPTIONS.md`)

## 2. Source code
- [x] All AI-generated and manually written code
- [ ] Public GitHub repo, organizers invited
- [ ] Commit history with AI-tool/stage messages (e.g. `feat(ai): Copilot Chat — recipe JSON schema`)
- [x] `docs/MANUAL-EDITS.md` log of every hand edit (rule: debugging/formatting/integration only)

## 3. Prompt history log
- [x] `PROMPTS.md` — chronological key prompts (this file)
- [ ] Notes on collaborative prompt development (who proposed/refined what)
- [ ] Before/after examples of prompt iteration
- [x] Reflection on what worked, what failed, how the team adapted

## 4. Supporting files
- [x] Unit tests / test cases / validation scripts (`npm test` — 34 tests; log in `docs/evidence/test-run.txt`)
- [ ] Model evaluation report (`npm run eval:ai` → `docs/evaluation/ai-eval-latest.json`) — offline run done; **re-run with the live Groq key**
- [x] Sample inputs and outputs (JSON manifests, recommendation responses)
- [x] Execution evidence: screenshots or logs of successful runs
- [x] Enrollment evidence (US-2.1): profile creation, encrypted PHI, tier assignment
- [x] Edge-case evidence: expired enrollment, floor at capacity, restricted item hard-stop, model timeout, malformed model JSON, rate limit (429)
- [x] Evaluation notes: accuracy, latency, usability; model eval fixture results
- [ ] Diagrams: architecture, ERD, warehouse grid, user flow

## 5. Reflection
- [ ] 1–2 paragraphs, team-authored — draft in `REFLECTION.md`, **team must rewrite in its own words**
- [ ] Covers collaborative AI development lessons, how AI shaped the solution, V&V approach, surprises/challenges

## 6. Presentation
- [ ] Slides + demo script ready before 9:00 AM upload
- [ ] 7-minute timing rehearsed; 5-minute Q&A prep
- [ ] Live demo on the public URL (fallback: recorded walkthrough + screenshots)
- [ ] All members have speaking parts

## 7. Pre-submit technical verification
- [ ] Public URL reachable from outside local network
- [x] Database seeded (≥100 products, 5 personas, rules matrix)
- [ ] AI engine reachable and within free-tier limits; fallback path when offline/slow
- [x] No paid API keys, no closed-source LLM calls anywhere in the runtime
- [ ] No secrets committed (`.env` ignored; keys rotated if leaked)
