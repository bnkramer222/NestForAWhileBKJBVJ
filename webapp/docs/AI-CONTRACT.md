# System of Intelligence — Contract v1

The web app (System of Record) and the AI engine (System of Intelligence) are separate services.
This contract is fixed on the web side; the engine must conform.

## Rules

- Open-source, open-weight model only. No OpenAI/Anthropic/commercial API, no paid tier.
- The engine is **advisory**. Green/yellow/red is decided by `src/services/dietaryMatrix.js`.
- If the engine is slow, offline, or returns an invalid shape, the web app falls back to the
  deterministic local synthesizer. The warehouse never stops working.
- Every call is logged to `ai_inference_log` (latency, ok flag) for the evaluation section.

## Request

```http
POST {AI_ENGINE_URL}
Content-Type: application/json
```

```json
{
  "contractVersion": "1.0",
  "model": "llama3.1:8b-instruct-q4_K_M",
  "task": "recipe-synthesis",
  "context": {
    "profile": {
      "tierId": "ckd+diabetes+hypertension",
      "tierLabel": "Triple chronicity (renal + diabetes + hypertension)",
      "conditions": ["ckd", "diabetes", "hypertension"],
      "allergies": ["dairy"],
      "householdSize": 5
    },
    "cart": [
      { "sku": "100102", "name": "Baby spinach", "quantity": 2 }
    ],
    "inventory": [
      {
        "sku": "100201",
        "name": "Boneless chicken breast",
        "category": "protein",
        "aisle": "B",
        "shelf": "1",
        "bin": "B01",
        "on_hand": 24
      }
    ]
  }
}
```

## Response

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
  "missingIngredients": [
    { "sku": "100405", "name": "Quinoa, cooked", "aisle": "D", "shelf": "3", "bin": "B05", "onHand": 24 }
  ]
}
```

## Validation performed by the web app

1. HTTP 2xx within `AI_TIMEOUT_MS` (default 6000 ms), else fallback.
2. `recipes` is an array; each entry has a string `title` and an array `steps`.
3. `missingIngredients`, if present, is an array; entries are re-checked against live stock before display.
4. `contractVersion` must equal `1.0` or the response is rejected.

## Roadmap for the engine service

- Ollama chat endpoint with `format: "json"` and a JSON schema, plus a repair pass.
- Retrieval over a small curated nutrition/recipe corpus (no fine-tuning needed).
- Evaluation fixtures: 20 items → expected status (from the rules engine) + recipe JSON validity +
  p95 latency. Target: 100% status agreement, ≥95% valid JSON, p95 < 3 s.
- Document model choice, quantization, hardware, and license in the README.
