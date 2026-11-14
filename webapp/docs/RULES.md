# Project Rules (authoritative constraints)

Source: user prompt 004 (`PROMPTS.md`). The event documentation is authoritative; violations are flagged here.
Project: MTG warehouse system for Epic Cure — AI-Augmented Software Engineer Challenge, Nov 14–15 2026.

## Hard deadlines

| Item | When |
|---|---|
| Upload solution + presentation + files to https://bit.ly/26NestforAwhileSol | Sun Nov 15, **9:00 AM** |
| Public GitHub repo shared with organizers | By Sunday morning |
| Live presentations (7 min + 5 min Q&A) | Sun Nov 15, **10:00 AM** |

## Tool rules

- **No paid/premium tiers anywhere.** Free tiers only.
- **Allowed coding AI:** VS Code + official GitHub Copilot / Microsoft Copilot extensions (auth, Copilot Chat, suggestions); Copilot via Codespaces or GitHub.dev; Claude through its official web UI in a browser.
- **Prohibited:** third-party AI extensions/plugins that change or extend AI behavior, or that integrate other models/APIs.
- **Open-source models allowed** (scikit-learn, Hugging Face, TensorFlow, PyTorch); all model usage documented (selection + integration).

## Code authorship rules

- All code generated with approved AI tools.
- Manual edits allowed **only** for debugging, minor formatting, integrating AI-generated components.
- Manual coding of core logic = prohibited. Plagiarism of existing OSS projects = prohibited. Work started before Saturday = prohibited.
- Commit messages must reflect AI tool usage and development stage.
- Must document which tool/service produced each major component: frontend, backend, data processing, AI layer, cloud deployment.

## AI runtime rules (critical)

- **Banned in the application:** OpenAI GPT, Anthropic Claude API, and any commercial/paid/closed-source LLM API, and any utility-billed variable-token platform.
- Nutrition & Recipe Engine must be **open-source, open-weight**.
- Run locally via free runners (Ollama, LM Studio) **or** free-tier zero-cost endpoints (Hugging Face, Groq) with no financial liability.
- If hosted, stay within free-tier CPU/GPU or open API rate limits.

## Data rules

- Persistence layer must encrypt PHI columns (HIPAA boundary); document what is actually enforced vs. claimed.
- Seed data minimums: **≥100 products** (macros, allergen flags, bin locations), **Clinical Rules Matrix** for core chronic conditions, **5 personas**.
- Document schema handling of dynamic stock, active checkout logs, floor queue ordering without manual intervention.
- Analytics outputs must be de-identified (strip names, phones, IDs).

## Deployment rules

- Public URL, verifiable off the local machine.
- Web app + database on a scalable host (Azure, Vercel, Railway, Render, Supabase, fly.io).

## Collaboration rules

- Team of 2–3; all members present; no solo work; no misrepresented roles; AI use requires team discussion.
- Every team member must speak during the presentation.

## Compliance gates (checked before any code is accepted)

1. Does it require a paid key or closed model? → reject.
2. Is this core logic hand-written? → must come from an approved AI tool instead.
3. Is the AI/model usage logged for this component? → must be.
4. Is PHI handled? → encrypted + de-identified downstream.
5. Is the change reflected in README / prompts log / evidence? → must be.
