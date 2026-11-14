# Prompt Log

Project: Epic Cure Medically Tailored Groceries (MTG) — 2026 NestforAwhile AI-Augmented Software Engineer Challenge.
Prompts recorded verbatim, in order. Only user prompts are logged.

---

## 001 — 2026-11-14

```text
hello
```

## 002 — 2026-11-14

```text
hello
```

## 003 — 2026-11-14

```text
youre going to be used to create a web application. this web application will utilize ai for recommendations and a database. it will use MVC architecture. i will prompt the rules in the next chat. make sure all prompts are recorded
```

## 004 — 2026-11-14

```text
# CONTEXT FOR THE AI ASSISTANT

You are helping a student team compete in the "2026 NestforAwhile: AI-Augmented Software Engineer Challenge." Below is the full official event documentation. Treat it as the authoritative specification: rules, deliverables, judging criteria, and the problem case. When I ask for help, follow these constraints exactly, and flag anything that would violate a rule (for example, paid tools, closed-source model APIs, or missing required documentation).

---

# 1. EVENT OVERVIEW

- **Name:** 2026 NestforAwhile: AI-Augmented Software Engineer Challenge
- **Dates:** Saturday Nov 14 and Sunday Nov 15, 2026
- **Location:** UNF School of Computing, Building 15
- **Audience:** Senior and graduate students
- **Sponsor:** UNF Computing Advisory Board (CAB)
- **Organizers:** Drs. Anirban Ghosh, Yongzhao Wang, Ameyaa Biwalkar, Nan Niu, Karthikeyan Umapathy
- **Problem-case clarifications:** contact Dr. Umapathy
- **Goal:** Teams use AI tools to brainstorm, plan, design, develop, test, and deploy an intelligent system for real-world requirements, covering the entire SDLC within 24 hours. Emphasis is on prompt-driven development, functional creativity, and solution quality ("engineering with intelligence").
- **Tooling constraint:** Teams solve one problem case using free-tier AI code-generation tools and open-source models.

## Schedule
- **Sat Nov 14:** Teams work all day. Mentor sessions until 2 PM; industry coaches stop by 9:30 AM to 2 PM. Presentation order is announced during the lunch break.
- **Deadline:** Upload solution, presentation files, and relevant files by **9:00 AM Sunday Nov 15** at https://bit.ly/26NestforAwhileSol (a compressed archive is recommended).
- **Sun Nov 15:** Presentations to judges start at **10:00 AM**, followed by a reflection session.

---

# 2. CONTEST RULES

## Tools
- **No paid or premium versions.** Everything must work on free tiers.
- **Allowed:** VS Code plus the official extensions needed for GitHub Copilot or Microsoft Copilot (GitHub auth, Copilot Chat, code suggestions). Browser access to Claude via its official web interface. GitHub Copilot via Codespaces or GitHub.dev.
- **Prohibited:** Third-party extensions or AI plugins that enhance or modify AI tool behavior, automate coding beyond what approved tools offer, or integrate with other AI models or APIs.
- **Pretrained models:** Open-source models are allowed (e.g., scikit-learn, Hugging Face, TensorFlow, PyTorch). No models requiring paid access. All model usage must be documented, including how the model was selected and integrated.

## AI-Augmented Software Engineering (mandatory)
- Teams must actively design, refine, and iterate prompts to guide AI tools in generating code, structuring logic, and solving problems.
- Demonstrate how software engineering and AI tools shaped the solution.
- Document the orchestration of AI tools in the README and the final presentation.
- Judges score creativity, clarity, and effectiveness of AI augmentation.
- Document which AI tools were used for each major component (frontend, backend, data processing, AI layer, cloud deployment).

## Teamwork
- **Team size:** 2 or 3 students.
- **Why:** The contest challenges the individual-use mindset of AI coding tools; collaboration and shared problem-solving are evaluated.
- **Prohibited:** Work done by a single member without meaningful collaboration; misrepresenting roles or contributions; using AI tools without team discussion or shared decision-making.

## Code Development
- All code must be generated with approved AI tools.
- Manual edits are allowed ONLY for debugging, minor formatting, and integrating AI-generated components.
- Document which tools and services were used for each major component.

## Source Control
- All work committed to a GitHub repository.
- Repository must be **public** and shared with organizers by Sunday morning.
- Commit messages should reflect AI tool usage and development stage.

## Prohibited Actions (overall)
- Using unapproved AI tools or manual coding for core logic
- Plagiarizing existing open-source projects
- Submitting work started before Saturday
- Misrepresenting AI tool usage

---

# 3. REQUIRED SUBMISSION PACKAGE

Must show not only what was built but how it was built collaboratively with AI tools.

1. **README.md** with these sections:
   - Project Overview (what it does, which track it addresses)
   - Setup Instructions (how to run or test)
   - Tool Usage Summary (which tools and services for which components, and why)
   - Team Collaboration (roles, task division, how the team worked together)
   - Software Engineering Strategy (how it was designed, developed, tested, refined, and deployed using AI tools)
2. **Source code files:** all AI-generated and manually written code.
3. **Prompt history log** (prompts.md or prompts.txt) containing:
   - Chronological or thematic list of key prompts
   - Notes on how prompts were developed collaboratively
   - Examples of how prompts evolved through iteration
   - Reflections on what worked, what didn't, and how the team adapted
4. **Supporting files:**
   - Verification artifacts (unit tests, test cases, validation scripts)
   - Sample inputs/outputs showing expected behavior
   - Execution evidence (screenshots or logs of successful runs and edge-case handling)
   - Evaluation notes (how accuracy, performance, or usability was verified)
   - Optional visuals (diagrams, flowcharts, architecture sketches)
5. **Reflection:** brief (1 to 2 paragraphs), team-authored, covering:
   - What was learned about collaborative AI development
   - How AI-augmented software engineering shaped the solution
   - How verification and validation were approached
   - Surprises, challenges, or insights from working as a team with AI

---

# 4. JUDGING

Judging is based solely on the live presentation and demo.

| Category | What is assessed | Weight |
|---|---|---|
| Solution Relevance & Impact | How well the solution addresses the problem case and its real-world utility | 20% |
| AI-Augmented Software Engineering | Depth, creativity, and clarity of AI tool use across the entire SDLC | 20% |
| Team Collaboration | Shared decision-making, role clarity, co-creation with AI | 20% |
| Technical Soundness | Functionality, architecture, and correctness as demonstrated | 15% |
| Verification & Validation | How clearly the team explains testing, debugging, and validation | 15% |
| Presentation Quality | Clarity, engagement, and effectiveness of the live presentation | 10% |

(Note: the source table swapped the descriptions and weights for Verification & Validation and Presentation Quality. The pairing above is the logical one, but the weights may be 15/10 in either order. Confirm with organizers if it matters.)

## Presentation Requirements
- **Time:** 7 minutes to present, 5 minutes of judge Q&A.
- **All team members must participate.**
- **Must cover:**
  - **Problem Case & Requirements:** how the team reframed the problem; additional requirements the team added; what problem it solves and why it matters
  - **Solution Overview:** key features and functionality; live cloud-deployed demo or walkthrough
  - **AI Tool Usage & Software Engineering:** which tools and how; how prompts were designed, refined, and iterated; examples of effective or surprising prompt outcomes
  - **Team Collaboration:** how the team worked together; roles, shared decisions, co-created prompts; breakthroughs or challenges
  - **Verification & Validation:** how it was tested and validated; edge cases, debugging strategies, metrics; what gave confidence in correctness
  - **Reflection:** what was learned about working with AI tools as a team; how AI-augmented engineering and collaboration shaped thinking; insights or surprises
- **Visuals:** slides, diagrams, or live code demos are fine. Keep them simple, focused, and relevant. Avoid over-polished decks; authenticity and clarity matter more than flash.
- **Tips:** rehearse as a team; show how the process evolved, not just the final product; every member contributes; be ready to answer questions about decisions, prompts, and teamwork.

## Coaches (Saturday 9:30 AM to 2 PM)
Steven El Kaakati (Dun & Bradstreet), Brandon Scherff (Symbotic), Lakshmi (Ash) Kesari (Ontada), Chaitanya Marepalli (McKesson), Sidney Miller (ICE), David Fekke (Banner Health), Chirag Rana (HCL Software), Praneetha Pradeep (Southeast Toyota Distributors)

## Judges
Mark Ryan Nugent (AI Engineer II, NLP Logix), Raghu Misra (founder of the Link, Unlockt, Sapna Foundation), Harikrishnan Muthukrishnan (Principal IT Developer, Florida Blue), Ken Mulford (Co-Founder & Vice Chairman, Epic Cure), Ben Webster (VP of AI Solutions, NLP Logix)

---

# 5. PROBLEM CASE: FOOD IS MEDICINE AT EPIC CURE

## Background
- **Food is Medicine (FIM):** federally backed initiative (HHS, USDA) that integrates nutrition into healthcare delivery, treating food access as a core component of medical care.
- **Goals:** improve outcomes and quality of life; reduce preventable ER visits and readmissions; lower healthcare costs; remove barriers to health-sustaining food.
- **Target population:** high-need individuals facing both medical vulnerability and financial hardship (cheap, calorie-dense, low-nutrient food worsens health).
- **US data:** ~47.9M Americans (13.7% of households) are food insecure. Adults in food-insecure households have 18% more chronic conditions. In food assistance networks, 58% of households have a member with hypertension and 33% a member with diabetes.
- **Florida data:** ~2.3M residents (~14.4%) are food insecure. 1 in 3 has hypertension, 1 in 10 has diabetes, 1.4M live with heart disease (the leading cause of death). 1 in 10 Floridians has three or more chronic conditions.
- **Interventions:** Medically Tailored Meals (MTM) and Medically Tailored Groceries (MTG). **This case covers ONLY MTG:** non-prepared, nutrient-dense foods chosen by medical professionals or dietitians for specific chronic diagnoses (fresh produce, lean proteins, whole grains); patients must be able to cook at home.

## The Client: Epic Cure (St. Augustine, FL)
- All-volunteer 501(c)(3) nonprofit; mission is to eliminate food insecurity AND food waste by rescuing surplus food from grocery stores, distributors, and farms.
- **Scale:** ~1 million lbs rescued monthly; tens of millions of free meals since founding.
- **"Farmers Market" model:** clients walk through a market-style setup and choose their own produce, meats, dairy, bakery, and dry goods (no pre-packed boxes).
- **Dignity-first:** free, no ID, no paperwork, no questions asked.
- **Gap:** no MTG program today; no infrastructure to cross-reference a person's diagnosis with specific inventory.

## The Challenge
Build an intelligent, scalable web application that lets Epic Cure support MTG by:
- Clinically categorizing fluctuating rescued inventory
- Tracking medical eligibility
- Recommending specialized medically tailored groceries

Target: a prototype of an **in-person, client-choice warehouse system** where clients walk in with a physical cart and pick food autonomously, while software enforces clinical guardrails and gives culinary guidance. Example risks: a diabetic taking high-glycemic items, a kidney patient taking high-sodium canned goods.

## Required Architecture: Systems of Record vs. Systems of Intelligence
- **System of Record (web app):** deterministic, secure, web-based. Captures clients, medical conditions, inventory, recommended groceries, suggested recipes.
- **System of Intelligence (open-source AI engine):** probabilistic open-source model layer that consumes clean web data in real time, applies medical and culinary knowledge, and streams personalized recommendations back into the web UI.
- The system must close this full data loop.

## Expectations
- 24 hours from concept to functioning prototype.
- Use AI code-gen tools (e.g., Cursor, GitHub Copilot, v0, Claude Artifacts) for boilerplate, UI components, backend routes, and tests (subject to the tool rules in Section 2).
- Teams act as architects. The spec defines the "what"; the open engineering questions are the team's to solve: data conflicts, network latency over weak warehouse signals, forcing open-source models to output valid JSON, and edge-case error handling.

---

# 6. SYSTEM DESCRIPTION: MTG WAREHOUSE SYSTEM

HIPAA-compliant enterprise web platform for Epic Cure, with a dual-layer architecture.

- **Clinical & eligibility core:** securely ingests client diagnoses (e.g., Type 2 Diabetes, Hypertension, CKD), biometric markers, and household size. A rules engine applies a dietary matrix to turn medical restrictions into personalized grocery recommendations.
- **AI nutrition & recipe engine (decoupled, open-source):**
  - *Clinical grocery matching:* analyzes the client's medical profile against live inventory to surface the best in-stock staples.
  - *In-cart recipe synthesis:* evaluates cart contents against a medically tailored culinary database, suggests viable healthy recipes, and recommends warehouse alternatives for missing ingredients.
- **On-site experience:** self-service check-in kiosk starts the session. A lightweight, mobile-responsive web companion guides shopping. Scanning barcodes shows whether an item is clinically optimal, acceptable in limited quantity, or restricted. At the end of the session, AI recipe options can be saved to the profile.
- **Warehouse & verification layer:** tracks inventory down to aisle, shelf, and bin; guides volunteers through shelf replenishment; the exit terminal checkout module matches physical cart items against the digital session with programmatic hard stops for contraindicated foods.

---

# 7. REQUIREMENTS: EPICS, USER STORIES, USE CASES

## Epic 1: On-Site Client Ingest & Flow Control
**Constraints:** the check-in pipeline must process client identification, initialize isolated session variables, and dynamically handle inventory and capacity states.

- **US-1.1 Client Check-In:** An enrolled client enters identification details at a self-service kiosk so the system verifies eligibility and loads their profile without staff intervention.
- **US-1.2 Grocery Recommendations:** At check-in, the system suggests items (produce, proteins, dairy, grains) based on family size and medical diet tier.
- **US-1.3 Capacity Enforcement:** As a warehouse manager, I want arriving clients placed in a structured waiting queue when the floor is at peak capacity.

**Use Case: Initialize Shopping Session**
- *Input:* Client Identifier Token
- *Logic:*
  1. Verify `Client_Enrollment_Status` for MTG is Active; if expired, reject and throw an administrative exception.
  2. Read global `Active_Floor_Shoppers`. If `>= Max_Floor_Capacity`, set status `Queue_Waiting` and block session activation.
  3. If approved, compute daily grocery needs = base dietary tier coefficients x `Household_Size`.
- *Output:* Active `Shopping_Session_Token`; real-time UI showing name, clinical dietary tier, and grocery recommendations; increment `Active_Floor_Shoppers` by 1.

## Epic 2: Patient Health & Diet Lifecycle Management
**Constraints:** the persistence layer must enforce strict encryption on all PHI columns (HIPAA boundaries).

- **US-2.1 Client Profile Creation:** A client enters medical conditions and food allergies into a secure profile so the software auto-configures dietary restrictions without human error.

**Use Case: Ingest Medical Conditions**
- *Input:* client's chronic and other relevant conditions
- *Logic:* categorize and store PHI with appropriate encryption and security; parse the ICD-10 array against a master dietary matrix ruleset to automatically bind the correct `Dietary_Tier_ID` to the profile.
- *Output:* verified, encrypted `Client_Medical_Profile` record; automated lifecycle state changes.

## Epic 3: Point-of-Choice Intelligent Recommendation Loop
**Constraints:** asynchronously send structured, secure payloads to an open-source inference endpoint and handle responses within performance constraints.

- **US-3.1 Aisle Safety Scan:** Scan a product barcode with a smartphone camera and instantly see a color-coded medical approval flag for the client's condition(s).
- **US-3.2 Intelligent Grocery Matching:** At the start of a trip, the system analyzes health conditions against live inventory and highlights the most optimal items currently on the shelves.
- **US-3.3 In-Cart Recipe Synthesis:** The system evaluates the current cart, recommends healthy recipes, and guides the client to missing ingredients available in the warehouse.

**Use Case: Process Real-Time Product Query**
- *Input:* camera barcode/QR scan or manual SKU entry
- *Logic:*
  1. Retrieve item dimensions, ingredients, and categories from the inventory system of record by SKU.
  2. Evaluate item suitability against the client's active clinical profile.
  3. Compile a JSON context manifest: client's clinical tier, live warehouse stock levels, and current `Active_Cart_Manifest`.
  4. Transmit the payload to the local open-source AI engine endpoint.
  5. The model evaluates cart items against a nutritional knowledge base and synthesizes localized recipe options and missing-ingredient suggestions.
- *Output:* structured JSON rendering item status (Approved [Green], Capped [Yellow], Restricted [Red]) alongside probabilistic AI-generated recipe instructions and missing-item location maps.

## Epic 4: Warehouse Inventory Lifecycle & Safety Enforcement
**Constraints:** inventory transaction hooks must execute atomically during peak concurrent checkouts, with FIFO batch tracking.

- **US-4.1 Clinical Safety Hard-Stop:** As a checkout volunteer, I want the system to freeze the transaction and show a hard-stop error if a client's cart contains a medically restricted item.
- **US-4.2 Shelf Replenishment:** As a restocking volunteer, I want an optimized, aisle-sequenced routing list when floor bins drop below minimum thresholds.
- **US-4.3 FIFO Lot Management:** As a warehouse manager, I want stock tracked by arrival date and lots within 7 days of expiration flagged, to minimize fresh food waste.

**Use Case: Enforce Clinical Checkout Guardrails**
- *Input:* scanned item manifest at the volunteer-facing exit terminal
- *Logic:* iterate scanned SKUs and cross-reference each against the client profile's restricted-ingredient array; resolve contraindicated rows through warehouse volunteer staff involvement; on manual checkout completion, run an atomic DB transaction that decrements inventory counts across global shelf indexes.
- *Output:* formatted transactional log receipt; updated master stock quantities; automated expiration alert flags.

## Epic 5: Healthcare Analytics & Program Evaluation
**Constraints:** calculation routines run asynchronously; downstream query loops must be stripped of explicit identification keys.

- **US-5.1 Clinical Outcomes Dashboard:** As a program director, I want aggregated, anonymized longitudinal trends of client health improvements to prove efficacy to insurers and health plans.
- **US-5.2 Funder & Grant Attribution:** As an operations accountant, I want compliance reports mapping every pound of distributed food to its grant funding stream so audits pass.
**Use Case: Generate Program Efficacy Reports**
- *Input:* anonymized client data streams and historical grocery items
- *Logic:* run a stripping algorithm to scrub names, phone numbers, and IDs; compute population-level trend deltas over intervals (e.g., 3-month and 6-month markers); query itemized transaction ledgers and sum distributed food weights grouped by inventory and medical-condition categories.
- *Output:* exportable tabular datasets and standardized analytical reports.

---

# 8. STRATEGIC RESEARCH & ENGINEERING ASSUMPTIONS

Before coding or migrations, the team must research, debate, and document explicit assumptions in these areas:

1. **Warehouse layout & spatial code:** no floor map is provided; assume a logical grid layout optimizing client flow and volunteer restocking routes.
2. **Clinical nutrition & dietary matrices:** research parameters used by healthcare networks for diet-based chronic disease management.
3. **Patient personas & overlapping chronicity:** design for realistic clients with multiple simultaneous conditions.
4. **Inventory metrics & product cataloging:** inventory changes rapidly (bulk donations, salvaged goods, fresh local produce).
5. **Open-source LLMs & vector architecture:** no massive commercial APIs; engineer a lightweight, fast, contextual inference pipeline on open-source models.
6. **Model evaluation & validation framework:** no "vibe-checking"; establish a concrete method to test and validate model outputs before the presentation.

---

# 9. TECHNICAL CONSTRAINTS & DEPLOYMENT LIMITS

## AI: open-source and free only
- Commercial, paid-tier, and closed-source LLM APIs (e.g., OpenAI GPT, Anthropic Claude APIs) are **strictly prohibited** in the application. Runtime must not use utility-billed platforms with variable token costs.
- The Nutrition & Recipe Engine must use fully **open-source, open-weight** models.
- Run the AI engine **locally** using free runners (e.g., Ollama, LM Studio), OR use completely free-tier, zero-cost dev API endpoints (e.g., Hugging Face, Groq) provided that execution creates zero financial liability or usage limits.
- If self-hosting the AI engine, stay within standard free-tier CPU/GPU limits or open API rate limits.

## Database & data modeling
The team owns the database design (relational or non-relational) for state tracking.
- **Minimum seed data:**
  - Product catalog of **at least 100 items** (macronutrients, allergen flags, warehouse bin locations)
  - Clinical Rules Matrix for core chronic conditions
  - **5 sample patient personas**
- **Schema decisions to document:** how tables handle dynamic inventory stock changes, active checkout logs, and floor queue ordering without manual intervention.

## Deployment
- Must be deployed and verifiable outside the local machine via a **public URL**.
- Deploy the web app and database on a modern scalable host (e.g., Azure, Vercel, Railway, Render, Supabase, fly.io).

---

# 10. GUIDING PRINCIPLES (from the closing statement)

- "Code is cheap, architecture is key, and human impact is what matters."
- The final pitch is of a production-ready paradigm for health, health equity, and dignity for St. Augustine families, delivered to industry leaders and Epic Cure leadership.

---

# END OF DOCUMENTATION

When I ask for help, please: (a) respect every rule above, (b) point out requirement gaps or rule risks proactively, and (c) keep deliverables aligned with the required submission package and judging criteria.
```

## 005 — 2026-11-14

```text
its going to be js based, with a render service, with node/express. as for ai engine thats a later issue, give the starting baseline files please. dont log everything just user prompts
```

## 006 — 2026-11-14

```text
Gaps your list missed
    •    The AI contract and the code disagree. docs/AI-CONTRACT.md says contractVersion must equal 1.0 and that missingIngredients are re-checked against live stock. aiEngine.js does neither. It only checks that recipes is an array with titles and steps. A model could suggest a recipe item that’s out of stock or restricted, and the app would display it. This is a good fix for the V&V story.
    •    No engine service exists, and the adapter can’t talk to Groq or Hugging Face as written. callRemote POSTs a custom {contractVersion, task, context} body. Groq, HF, and Ollama all expect chat-completion style requests. You’ll need to rewrite callRemote to use that format with JSON mode, then validate and repair the output.
    •    The model endpoint is a rule risk. Ollama is the cleanest fit for “open-source and free,” but it can’t run on Render’s free tier or be reached from it. Groq’s free tier serves open-weight Llama and works from a public deploy, but it has rate limits, and the spec says the endpoint must carry no “usage limits.” Document that choice in your assumptions write-up, and keep the deterministic fallback so a rate limit never breaks the demo.
    •    Check the “started before Saturday” rule. The repo looks like a pre-built scaffold with prompt history and docs. Look at the commit dates. If anything predates Nov 14, be ready to explain it, or restart from a clean repo.
    •    Manual edits. Core logic must be AI-generated. Keep docs/MANUAL-EDITS.md honest, since misrepresenting AI use is a prohibited action.
Suggested order, quickest wins first
    1    Seed catalog to 100+ products (about 57 more rows, with macros, allergens, and bins). I can generate this as SQL now.
    2    AI adapter, with strict JSON schema, repair pass, stock re-check, and fallback.
    3    Deploy to Render and seed the hosted database, so you have a public URL early.
    4    Client enrollment screen (US-2.1), with encrypted PHI and tier assignment.
    5    Eval script and extra tests, then the README, prompt log, reflection, and assumptions.
Which model endpoint are you going with, Groq free tier or Hugging Face? Once you pick, I’ll start on the seed SQL and the adapter.

okay can you fix and impliment these things for me
Gaps your list missed
    •    The AI contract and the code disagree. docs/AI-CONTRACT.md says contractVersion must equal 1.0 and that missingIngredients are re-checked against live stock. aiEngine.js does neither. It only checks that recipes is an array with titles and steps. A model could suggest a recipe item that’s out of stock or restricted, and the app would display it. This is a good fix for the V&V story.
    •    No engine service exists, and the adapter can’t talk to Groq or Hugging Face as written. callRemote POSTs a custom {contractVersion, task, context} body. Groq, HF, and Ollama all expect chat-completion style requests. You’ll need to rewrite callRemote to use that format with JSON mode, then validate and repair the output.
    •    The model endpoint is a rule risk. Ollama is the cleanest fit for “open-source and free,” but it can’t run on Render’s free tier or be reached from it. Groq’s free tier serves open-weight Llama and works from a public deploy, but it has rate limits, and the spec says the endpoint must carry no “usage limits.” Document that choice in your assumptions write-up, and keep the deterministic fallback so a rate limit never breaks the demo.
    •    Check the “started before Saturday” rule. The repo looks like a pre-built scaffold with prompt history and docs. Look at the commit dates. If anything predates Nov 14, be ready to explain it, or restart from a clean repo.
    •    Manual edits. Core logic must be AI-generated. Keep docs/MANUAL-EDITS.md honest, since misrepresenting AI use is a prohibited action.
Suggested order, quickest wins first
    1    Seed catalog to 100+ products (about 57 more rows, with macros, allergens, and bins). I can generate this as SQL now.
    2    AI adapter, with strict JSON schema, repair pass, stock re-check, and fallback.
    3    Deploy to Render and seed the hosted database, so you have a public URL early.
    4    Client enrollment screen (US-2.1), with encrypted PHI and tier assignment.
    5    Eval script and extra tests, then the README, prompt log, reflection, and assumptions.
Which model endpoint are you going with, Groq free tier or Hugging Face? Once you pick, I’ll start on the seed SQL and the adapter.

okay can you fix and impliment these things for me
```

## 007 — 2026-11-14 (Claude)

```text
claude im working on this software engineering thing and everything works except when you make an account it gives you a token, when the token is used to shop it doesn't load and server crashes
```

> Outcome: Claude reproduced it against a local Postgres. Root cause: the view variable `client` collided with EJS's `client` render option, disabling `include()` on shop.ejs. Renamed to `shopper`.

## 008 — 2026-11-14 (Claude)

```text
give the requirements for the project. can we change the title? whats up w the qr code, can we change st augs location?
```

## 009 — 2026-11-14 (Claude)

```text
this is the problem case, does my web app do this?
```

> Outcome: requirements audit. Gaps found: no exit QR/visible session token, queue never advanced, no CSV export (US-5.2), no biometric trends (US-5.1), camera scan unsupported on iPhone/Safari and could not read QR.

## 010 — 2026-11-14 (Claude)

```text
fix these issues, i have other issues id like to bring to the table as well
```

> Outcome: exit-pass QR + token on shop page; automatic FIFO admission from the waiting line after checkout/exit; de-identified CSV exports (grant ledger, pounds by condition, outcome trends); client_biometrics table + optional baseline readings at enrollment + 3/6-month trend table on the dashboard; self-hosted html5-qrcode scanner (barcodes + QR, works on iPhone) on shop and checkout. Verified end to end on local Postgres; `npm test` 23/23 passing.

## 011 — 2026-11-14 (Claude)

```text
checkout says processing even though it processed. title is bad, st aug is bad, qty doesnt update u can only by one of each thing, still give access to things they cant buy or shouldnt by but warn them, bar code needs to work/ give demo bar codes, and make customer feel comfortable
```

> Outcome: Claude reproduced the stuck checkout in a headless browser (CSS `display` on `.btn` overrode the `hidden` attribute; fixed globally). App renamed "Nourish by Epic Cure" via one config file (`src/config/brand.js`), location removed. Cart quantity +/− controls and a PATCH endpoint. Not-recommended items can be added after a gentle confirmation and are still caught by the checkout hard stop (US-4.1). New `/barcodes` page with Code 128 shelf tags for all 107 products and QR client cards; kiosk can scan a card; new sign-ups get a QR card. Shopper wording rewritten in plain language (no ICD codes shown to shoppers). Verified with a Playwright browser test: 20 checks pass, scanner library decodes the generated barcodes and QR codes.

## 012 — 2026-11-14 (Claude)

```text
works pretty well rn, optional allergens dont show, can we do some other thing other than text boxes for allergen
```

> Outcome: Claude found that allergy matching was exact text, so typed words like "milk" or "peanut" never matched the catalog flags (`dairy`, `peanuts`). Added `src/lib/allergens.js` (canonical list, synonyms, gluten→wheat), replaced the text box with tap-to-select chips plus an optional "Something else" field, and now show allergies on the shop page and the volunteer checkout screen. 4 new unit tests (27/27 passing) and a browser test of the full sign-up → shop → checkout flow.

## 013 — 2026-11-14 (Claude)

```text
can you also fix the queue it doesnt work properly i think, i will then put the fixes out
```

> Outcome: Claude reproduced the queue with four simulated shoppers in a browser. Bugs: the waiting page was rendered at the POST URL (`/kiosk/check-in`), so a refresh showed "Page not found"; shoppers who walked away held floor slots forever; the floor counter could drift; capacity was hard-coded (MAX_FLOOR_CAPACITY ignored). Rebuilt floor/queue as one transaction under a Postgres advisory lock with the counter re-derived from real sessions; strict FIFO; heartbeat (`last_seen_at`) with auto-release after inactivity plus a 1-minute sweep; waiting page now has its own URL, updates live every 5 s, auto-advances to the shop, and backs off on weak Wi-Fi; dashboard panel to set capacity, see the (anonymous) line, and release inactive sessions. Verified: 12 browser scenarios pass; 12 simultaneous check-ins at capacity 3 → exactly 3 on the floor, 9 in line.
