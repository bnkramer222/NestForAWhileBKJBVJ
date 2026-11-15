# Nourish by Epic Cure — web app

The full README (project overview, setup, tool usage, team collaboration, engineering strategy) is at
the repository root: [`../README.md`](../README.md).

Quick start:

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL, SESSION_SECRET, PHI_KEY, AI settings
npm run db:schema && npm run db:seed
npm run dev             # http://localhost:3000/kiosk
npm test                # 34 unit tests
```
