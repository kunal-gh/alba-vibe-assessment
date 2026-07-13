# Alba Corp. Vibe Coder Assessment

Three focused products built around evidence-based AI workflows, secure data management, and operational automation. Each folder is independently runnable and includes its own README, build log, and environment template.

| Assignment | Submission | Advanced requirement | Local verification |
| --- | --- | --- | --- |
| 01 | [Signal Lens](./01-signal-lens) | Backend-for-frontend with cache, retries, and graceful upstream failure | Pending final frontend build check |
| 02 | [StudioFlow](./02-studioflow) | Supabase Auth, RLS ownership boundary, and realtime updates | `npm run build` passes |
| 03 | [CoverGuard Automation](./03-coverguard-automation) | Retry/backoff plus a dedicated n8n error workflow | Both workflow JSON files parse successfully |

## Submission links

| Assignment | Live URL | Repository | Walkthrough |
| --- | --- | --- | --- |
| Signal Lens | Add after Vercel deployment | This repository | Add Loom URL |
| StudioFlow | Add after Vercel deployment | This repository | Add Loom URL |
| CoverGuard Automation | Add n8n Cloud URL or attach exported JSON | This repository | Add Loom URL |

## Repository layout

```text
alba-vibe-assessment/
├── 01-signal-lens/             # API-integrated web application
├── 02-studioflow/              # Supabase-backed dashboard
└── 03-coverguard-automation/   # n8n workflow and vision service
```

## Before submitting

- Deploy Signal Lens and StudioFlow, then replace the placeholder URLs above.
- Provision Supabase, apply `02-studioflow/supabase/schema.sql`, and use the documented demo account.
- Import both CoverGuard workflow JSON files into n8n, connect the error workflow, configure credentials, and capture one successful run.
- Record one short walkthrough covering a proud technical decision and one honest limitation.
- Confirm no `.env` or credential files are staged.

## Origin and scope

This is a fresh assessment repository that adapts prior projects as a starting point. The assessment-specific work is clearly documented in each `BUILD_LOG.md`; inherited code is not presented as newly built work.
