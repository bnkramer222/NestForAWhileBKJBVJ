# Verification Evidence & Evaluation Notes

Supporting files for the submission package: what was tested, how, and what the results were.
All samples below were captured from the running app (Node + PostgreSQL) on 2026-11-14.
Session tokens in samples are replaced with `ses_[redacted]`.

## 1. How the system was verified

| Layer | Method | Where |
|---|---|---|
| Clinical rules engine | Unit tests (`node --test`) on the dietary matrix: thresholds, allergen override, "restricted beats capped", tier resolution, household scaling | `tests/dietaryMatrix.test.js` |
| AI engine contract | Unit tests with mocked providers: JSON extraction, schema validation, one repair turn, fallback on repair exhaustion, 429 rate limit, HTTP errors, SKU sanitising | `tests/aiEngine.test.js` |
| Allergies | Synonym matching ("milk" → dairy), gluten → wheat, labels | `tests/allergens.test.js` |
| Languages | Every string present in all 5 languages with matching placeholders; plan names and rule explanations translated | `tests/i18n.test.js` |
| Model output safety | `npm run eval:ai` — fixture cases checked against 5 invariants (no unknown / out-of-stock / restricted SKUs, ≥1 recipe, every recipe has steps) | `docs/evaluation/ai-eval-latest.json` |
| End to end | Scripted browser runs (Playwright, phone and desktop sizes) against a real Postgres: sign-up → check-in → scan → cart → recipes → checkout hard stop → receipt; queue with several shoppers; all 5 languages | screenshots below |
| Concurrency | 12 simultaneous kiosk check-ins at floor capacity 3 | result: exactly 3 on the floor, 9 in line, counter correct |

**Result:** 34/34 unit tests pass (`test-run.txt`). Every end-to-end scenario passed with no browser errors.

## 2. Sample inputs and outputs (`samples/`)

| File | Input | What it shows |
|---|---|---|
| `scan-approved.json` | `POST /api/scan {"sku":"100103"}` (CKD + hypertension client) | Item status, location, stock, reasons |
| `scan-not-best-fit.json` | `POST /api/scan {"sku":"100101"}` | Bananas flagged for kidney disease (potassium), explanation included |
| `cart-add-needs-confirmation.json` | `POST /api/cart` restricted item, no confirm | `409` with `CONFIRM_RESTRICTED` — shopper is asked, not blocked |
| `cart-add-confirmed.json` | same, `"confirm": true` | Item added with a notice that a volunteer will check it |
| `cart-set-quantity.json` | `PATCH /api/cart/100103 {"quantity":3}` | Quantity control |
| `recipes-fallback.json` | `GET /api/recipes` with no AI provider | Deterministic fallback recipes + missing ingredients with aisle/shelf/bin |
| `checkout-hard-stop.json` | `POST /api/checkout/complete` with a restricted item in the cart | `409 RESTRICTED_ITEM` — clinical hard stop (US-4.1) |
| `checkout-receipt.json` | same, after the volunteer removes the item | Atomic checkout receipt: transaction id, lines, item count, total weight (grant attribution is in `export-grants.csv`) |
| `queue-status-waiting.json` | `GET /api/queue/:token` at capacity 1 | Live place in line |
| `export-grants.csv` | `GET /dashboard/export/grants.csv` | De-identified grant ledger (US-5.2) |
| `export-conditions.csv` | `GET /dashboard/export/conditions.csv` | Pounds by condition group × food category |
| `export-outcomes.csv` | `GET /dashboard/export/outcomes.csv` | 3- and 6-month biometric trends (US-5.1) |
| `healthz.json` | `GET /healthz` | Database and AI engine status |

## 3. Edge cases covered

| Edge case | How it is handled | Evidence |
|---|---|---|
| Unknown card code | Friendly message, no crash | screenshot 21 |
| Expired enrollment | "Time to renew" page, check-in blocked | screenshot 20 |
| Floor at capacity | Placed in a FIFO waiting line; page updates live and admits automatically | screenshots 12–14, `queue-status-waiting.json` |
| Shopper walks away without checking out | Slot released after 20 min of no activity; staff can end a session | dashboard "On the floor" panel, screenshot 13 |
| Simultaneous check-ins | Postgres advisory lock; counter derived from real sessions | concurrency test above |
| Restricted item at checkout | Hard stop until a volunteer removes it | screenshot 10, `checkout-hard-stop.json` |
| Shopper takes a not-recommended item | Confirmation, then warning in cart | screenshots 06–07 |
| Item out of stock / over stock | "Only N left" message; + button disabled | `changeQuantity` in `shop.controller.js` |
| Model returns malformed JSON | One repair turn, then deterministic fallback | `aiEngine.test.js` |
| Model rate limit (429) / timeout | Immediate fallback, no retry storm | `aiEngine.test.js` |
| Model suggests an unsafe or unknown SKU | Dropped by the sanitiser; locations come from the database, never the model | `aiEngine.test.js`, eval invariants |
| Weak warehouse Wi-Fi on the waiting page | Keeps the place, retries with back-off | `public/js/app.js` |
| Typed allergy words ("milk", "peanut") | Normalised to catalog allergens | `allergens.test.js` |

## 4. Evaluation notes

**Accuracy / safety.** Clinical decisions are deterministic code, not model output: the model can suggest recipes but cannot change an item's status, and every SKU it returns is re-checked against the database and the client's profile. The offline eval passed 6/6 cases on all invariants. *Before presenting, run `npm run eval:ai` with the live Groq key and keep that report alongside the offline one.*

**Performance** (local, warm, 20 requests each): item scan p50 5 ms / p95 7 ms; cart p50 5 ms / p95 6 ms; full shop page p50 24 ms / p95 69 ms. Recipe generation depends on the model provider and falls back to local recipes on timeout. On Render's free tier the first request after the service sleeps takes ~30 s.

**Usability.** Plain-language labels (Great fit / Small amounts / Not the best fit) instead of clinical terms; no ICD codes on shopper screens; warn-but-allow with a calm confirmation; quantity controls; tap-to-select allergies; 5 languages (English, Spanish, French, Haitian Creole, Simplified Chinese) with the client's language applied at check-in; works on phone-sized screens; camera scanning works on iPhone Safari. Translations were machine-drafted and should be reviewed by native speakers before real use.

**Privacy.** Names, preferred names and conditions are encrypted at rest; analytics and exports contain no names, tokens or IDs.

## 5. Screenshots

21 screenshots of the current app, in `screenshots/` in the submission archive:

01 kiosk · 02 sign-up form · 03 new card with QR · 04 shop welcome · 05 scan result · 06 "not the best fit" confirmation · 07 cart with quantities and warning · 08 meal ideas · 09 exit-pass QR · 10 checkout hard stop · 11 checkout receipt · 12 waiting line · 13 dashboard floor & queue · 14 admitted from the line · 15 dashboard · 16 demo barcodes · 17–19 shop in Spanish, Chinese, Haitian Creole · 20 expired enrollment · 21 unknown card code
