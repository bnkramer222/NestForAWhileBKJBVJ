# Manual Edit Log

Rule: manual edits are permitted **only** for debugging, minor formatting, and integrating AI-generated components. Core logic must originate from an approved AI tool (GitHub/Microsoft Copilot in VS Code, or Claude web UI).

Every manual edit gets a row. If it doesn't fit `debug` / `format` / `integration`, it is out of policy — discard and regenerate via AI instead.

| # | Date/time | File / lines | Type | Reason | Approved-by (team) |
|---|---|---|---|---|---|
| 1 | 2026-11-14 | `src/controllers/shop.controller.js`, `src/views/shop.ejs` (whole files) | integration | Pasted Claude's fix for the shop crash (`client` view variable renamed to `shopper`) into the repo. Prompts 028–029. | _team_ |
| 2 | 2026-11-14 | 23 files (exit pass, queue admission, CSV exports, biometrics, scanner) | integration | Unzipped Claude's update into the Codespace. Prompt 033. | _team_ |
| 3 | 2026-11-14 | files deleted by a folder upload (`src/config/*`, `src/scripts/run-sql.js`, …) | debug | Restored unchanged files from Git (`git ls-files --deleted \| xargs git checkout --`) after a folder drag replaced whole folders. No content changed. | _team_ |
| 4 | 2026-11-14 | 36 files (checkout button, quantities, warn-but-allow, demo barcodes, shopper wording) | integration | Unzipped Claude's update. Prompt 040. | _team_ |
| 5 | 2026-11-14 | `src/lib/allergens.js` | integration | Recreated Claude's file with a terminal heredoc after it went missing during upload. Content identical to the generated file. | _team_ |
| 6 | 2026-11-14 | 5 files + `tests/allergens.test.js` | integration | Applied Claude's allergy update as a `git apply` patch. Prompt 044. | _team_ |
| 7 | 2026-11-14 | 15 files (queue rebuild) | integration | Applied Claude's queue update. Prompt 045. | _team_ |
| 8 | 2026-11-14 | 37 files (5 languages, preferred names, staff floor controls) | integration | Extracted Claude's update from checksum-verified terminal paste blocks. Prompt 052. | _team_ |
| 9 | 2026-11-14 | `.env.example`, Git history | debug | Removed a committed API key from the repo and history after GitHub Push Protection blocked the push. **The key must also be rotated in the Groq console.** Guided by ChatGPT, prompts 059–064. | _team_ |
| 10 | 2026-11-14 | `README.md`, `REFLECTION.md`, `PROMPTS.md`, `docs/evidence/`, this file | integration | Added Claude's documentation updates (accurate tool usage, evidence, prompt numbering). | _team_ |

_Team: add a row for any other change made by hand, and put the reviewer's name in the last column._

Types: `debug` · `format` · `integration`
