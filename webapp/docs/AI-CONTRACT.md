# System of Intelligence — Contract v1

The web app (System of Record) and a model (System of Intelligence) are separate concerns.
Green/yellow/red is **always** decided by `src/services/dietaryMatrix.js`; the model only
synthesizes recipes and explains clinical fit.

## Provider decision (documented rule risk)

| Option | Verdict |
|---|---|
| Ollama (local) | Cleanest "open-source and free" story; **cannot run on Render's free tier**. Default for local development and offline demo. |
| Groq free tier (open-weight Llama) | Reachable from the deployed Render service, zero cost, OpenAI-compatible JSON mode. **Chosen for the deployed demo** with a documented rate-limit caveat. |
| Hugging Face router | Supported as a fallback/secondary provider; free quota is limited and model availability varies. |

`AI_PROVIDER=groq` is the deployed choice; `AI_PROVIDER=ollama` is the local/demo-safe choice.
Because Groq publishes rate limits, the adapter **never depends on the model**: every failure path
degrades to deterministic local synthesis, and the UI labels the source. This is disclosed in
`docs/RISKS-AND-ASSUMPTIONS.md` rather than hidden.

## Wire format

All three providers use chat-completion semantics with JSON mode.

| Provider | Endpoint | JSON mode | Auth |
|---|---|---|---|
| groq | `POST {base}/chat/completions` | `response_format: {type: "json_object"}` | `Authorization: Bearer $AI_API_KEY` |
| hf | `POST {base}/chat/completions` | same (retried without it on HTTP 400) | `Authorization: Bearer $HF_TOKEN` |
| ollama | `POST {base}/api/chat` | `format: "json"`, `stream: false` | none |

Request body (OpenAI-compatible shape):

```json
{
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.2,
  "max_tokens": 900,
  "messages": [
    { "role": "system", "content": "<schema + clinical rules>" },
    { "role": "user", "content": "{...profile, cart, inventory with per-item status...}" }
  ],
  "response_format": { "type": "json_object" }
}
```

The system prompt carries the schema and the safety rules (only inventory SKUs, never a
`restricted` SKU, no added salt, 1–3 recipes, 3–6 steps). The user message is a JSON context:
client tier, conditions, allergies, household size, current cart, and live inventory rows with
`sku, name, category, aisle, shelf, bin, on_hand, status`.

## Required model output

```json
{
  "contractVersion": "1.0",
  "recipes": [
    {
      "title": "Spinach & chicken skillet",
      "uses": ["100102", "100201"],
      "steps": ["Season with herbs, not salt.", "Sear until cooked through."],
      "clinicalFit": "Low sodium, high protein, renal-safe."
    }
  ],
  "missingIngredients": [{ "sku": "100405" }]
}
```

## Validation pipeline (implemented in `aiEngine.js`)

1. **Transport** — 6 s timeout (`AI_TIMEOUT_MS`), HTTP status checked, non-JSON body rejected.
2. **Extraction** — fenced code blocks stripped; first `{…}` parsed.
3. **Structural validation** — `contractVersion === "1.0"`, non-empty recipe array, ≤ `AI_MAX_RECIPES`,
   string title, non-empty string steps, `uses` is an array of SKU strings.
4. **Repair turn** — one retry (`AI_REPAIR_ATTEMPTS`) that shows the model its own output plus the
   exact validation errors.
5. **Sanitisation (the stock/clinical re-check)** — every SKU in `uses` and `missingIngredients` is
   looked up in live inventory. Unknown, `on_hand <= 0`, or clinically `restricted` SKUs are dropped;
   a recipe that references any of them is discarded entirely. Location and stock fields are copied
   from the database, never trusted from the model.
6. **Fallback** — unconfigured provider, timeout, 429, repeated invalid output, or all recipes dropped
   → deterministic local synthesis (`source: "local-deterministic-fallback"`).
7. **Observability** — every attempt is written to `ai_inference_log` (provider, model, latency, ok,
   validation errors, dropped recipes) for the evaluation section.

## Evaluation

```bash
npm run eval:ai        # writes docs/evaluation/ai-eval-<timestamp>.json + ai-eval-latest.json
```

Invariants checked per case: contract version, at least one recipe, no restricted/out-of-stock/unknown
SKU in `uses` or `missingIngredients`, every recipe has steps. Report includes pass rate, p95 latency,
and source distribution. Run it once with `AI_PROVIDER=none` (offline proof) and once with the live
provider before presenting.

## Model selection (to record in README)

- **Deployed:** Groq, `llama-3.3-70b-versatile` (open-weight Llama 3.3, 70B).
- **Local/dev:** Ollama `llama3.1:8b-instruct-q4_K_M` (4-bit quantized, CPU-friendly).
- Licence: Llama 3.3 Community Licence / Llama 3.1 Community Licence — no paid access required.
