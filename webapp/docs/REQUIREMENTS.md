# Requirements Traceability

Source: prompt 004, sections 5–9. Each item must be demoable and covered in the submission package.

## Architecture mandates

| # | Requirement | Layer |
|---|---|---|
| A1 | System of Record: deterministic, secure web app storing clients, conditions, inventory, recommendations, recipes | MVC web app |
| A2 | System of Intelligence: decoupled open-source probabilistic engine consuming clean web data in real time | AI service |
| A3 | Closed data loop: web data → AI engine → structured JSON → web UI | integration |
| A4 | Color-coded item status: Approved (green) / Capped (yellow) / Restricted (red) | API + UI |
| A5 | Structured JSON contract between app and model (no free-text parsing) | AI service |

## Epics / user stories

### Epic 1 — On-site ingest & flow control
- **US-1.1** Self-service kiosk check-in; verifies enrollment, loads profile, no staff intervention.
- **US-1.2** At check-in, recommend produce/proteins/dairy/grains by household size + diet tier.
- **US-1.3** Capacity enforcement: queue arriving clients when floor at max capacity.
- **UC-Init-Session**
  - Verify `Client_Enrollment_Status = Active`; expired → reject + administrative exception.
  - Read `Active_Floor_Shoppers`; if `>= Max_Floor_Capacity` → `Queue_Waiting`, block activation.
  - Compute daily needs = tier coefficients × `Household_Size`.
  - Output `Shopping_Session_Token`, UI with name/tier/recommendations, increment floor count.

### Epic 2 — Health & diet lifecycle
- **US-2.1** Secure profile creation with conditions + allergies, auto-configured restrictions.
- **UC-Ingest-Conditions**: encrypt PHI, parse ICD-10 array against dietary matrix, bind `Dietary_Tier_ID`, emit `Client_Medical_Profile`, lifecycle state changes.

### Epic 3 — Point-of-choice recommendation loop
- **US-3.1** Barcode/QR scan from phone camera → instant color-coded clinical flag.
- **US-3.2** Trip-start matching of conditions vs. live inventory → highlight optimal in-stock items.
- **US-3.3** In-cart recipe synthesis + missing-ingredient guidance with aisle/bin locations.
- **UC-Product-Query**: SKU lookup → suitability eval → JSON manifest (tier, stock, cart) → AI endpoint (async) → status + recipes + missing-item map.

### Epic 4 — Inventory lifecycle & safety
- **US-4.1** Checkout hard-stop when a restricted item is in the cart; volunteer resolves; freeze transaction.
- **US-4.2** Aisle-sequenced replenishment route when bins drop below minimum.
- **US-4.3** FIFO lot tracking; lots < 7 days from expiration flagged.
- **UC-Checkout-Guardrails**: iterate SKUs → restricted-ingredient array → resolve contraindications → atomic decrement across shelf indexes → receipt log + stock update + expiry flags.

### Epic 5 — Analytics & evaluation
- **US-5.1** Aggregated, anonymized longitudinal outcome trends (3- and 6-month deltas).
- **US-5.2** Funder/grant attribution: every pound mapped to funding stream.
- **UC-Efficacy-Report**: de-identify → interval deltas → sum weights by inventory + condition category → exportable tabular reports.

## Seed data requirements

- [ ] ≥100 products with macronutrients, allergen flags, aisle/shelf/bin
- [ ] Clinical rules matrix: Type 2 Diabetes, Hypertension, CKD (at minimum)
- [ ] 5 personas incl. overlapping chronicity (e.g., diabetes + CKD + hypertension)
- [ ] Grants table + weight attribution
- [ ] Expiry/lot batches

## Research assumptions to document (section 8)

1. Warehouse logical grid + spatial codes (no floor map provided)
2. Clinical nutrition / dietary matrix parameters (cite healthcare sources)
3. Personas with overlapping chronicity
4. Inventory metric volatility and cataloging approach
5. Open-source LLM + retrieval architecture choice, justified
6. Model evaluation framework (not vibe-checking): fixture set, expected outputs, pass rate, latency budget

## Presentation coverage (7 min)

Problem & requirements (incl. added requirements) → solution demo on public URL → AI tool usage + prompt iteration examples (effective and surprising) → team collaboration → V&V with metrics/edge cases → reflection. Every member speaks.
