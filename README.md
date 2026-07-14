# Alba Corp. Vibe Coder Assessment

This repository contains three assessment submissions in the preferred monorepo structure. Each folder stands on its own with a README, build log, environment template, and run instructions.

## Submission summary

| Assignment | Project | Live / handoff URL | Advanced or key requirement |
| --- | --- | --- | --- |
| 01 | [Signal Lens](./01-signal-lens) | https://signal-lens-alba.vercel.app | Next.js backend-for-frontend with server-side API handling, caching, retries, and graceful failures |
| 02 | [StudioFlow](./02-studioflow) | https://studioflow-alba.vercel.app/studio | Supabase Auth, row-level security, realtime updates, CRUD, charts, and seeded demo data |
| 03 | [Alba Submission Health Report](./03-n8n-workflow) | Import [workflow JSON](./03-n8n-workflow/n8n/alba_submission_health_workflow.json), then use the n8n webhook URL | n8n workflow with trigger, GitHub API calls, transformation, IF branching, handled failures, and JSON report output |

Repository URL for all forms:

```text
https://github.com/kunal-gh/alba-vibe-assessment
```

## Repository layout

```text
alba-vibe-assessment/
|-- 01-signal-lens/        # Creative API-integrated web app
|-- 02-studioflow/         # Supabase-backed data dashboard
`-- 03-n8n-workflow/       # Importable n8n automation workflow
```

## Assignment 1: Signal Lens

Signal Lens is a polished recruiting workflow for screening resumes against a role brief. The Next.js frontend uploads candidate files and role criteria; a server route acts as the backend-for-frontend and calls the scoring service without exposing backend URLs or AI keys to the browser.

Requirement highlights:

- Third-party/AI API integration through the backend service, with deterministic fallback behavior.
- Creative, single-purpose UI with loading, empty, and error states.
- Server-side route handler for API proxying, timeout handling, retry/backoff, and short-lived caching.
- Responsive frontend and documented architecture.

Useful files:

- [01-signal-lens/README.md](./01-signal-lens/README.md)
- [01-signal-lens/BUILD_LOG.md](./01-signal-lens/BUILD_LOG.md)
- [01-signal-lens/frontend/.env.example](./01-signal-lens/frontend/.env.example)
- [01-signal-lens/backend/.env.example](./01-signal-lens/backend/.env.example)

## Assignment 2: StudioFlow

StudioFlow is a Supabase-backed creative operations dashboard. It manages projects and related assets, supports full CRUD, shows analytics charts, and uses Supabase Auth plus RLS so each user only sees their own rows.

Demo credentials:

```text
Email: demo@studioflow.local
Password: StudioFlow-demo-2026
```

Requirement highlights:

- Full CRUD for projects and assets.
- Two meaningful visualizations in the dashboard.
- Supabase tables, relationships, Auth, RLS policies, and realtime subscriptions.
- Seed script and SQL schema included so the backend can be recreated.

Useful files:

- [02-studioflow/README.md](./02-studioflow/README.md)
- [02-studioflow/BUILD_LOG.md](./02-studioflow/BUILD_LOG.md)
- [02-studioflow/supabase/schema.sql](./02-studioflow/supabase/schema.sql)
- [02-studioflow/scripts/seed-studioflow.mjs](./02-studioflow/scripts/seed-studioflow.mjs)
- [02-studioflow/.env.example](./02-studioflow/.env.example)

## Assignment 3: Alba Submission Health Report

The n8n workflow checks the public GitHub repository, scores recent activity, branches into `READY` or `ATTENTION`, and returns a verifiable JSON/Markdown report.

Requirement highlights:

- Manual trigger and live webhook trigger.
- Real external HTTP API calls to GitHub.
- Code-node transformation, deduping, scoring, and report formatting.
- IF branching for readiness state.
- `continueOnFail` handling for API failures.
- Delivered output through a webhook response and manual execution output.

Useful files:

- [03-n8n-workflow/README.md](./03-n8n-workflow/README.md)
- [03-n8n-workflow/BUILD_LOG.md](./03-n8n-workflow/BUILD_LOG.md)
- [03-n8n-workflow/n8n/alba_submission_health_workflow.json](./03-n8n-workflow/n8n/alba_submission_health_workflow.json)
- [03-n8n-workflow/evidence/sample-output.json](./03-n8n-workflow/evidence/sample-output.json)

## Local verification

Assignment 1 frontend:

```powershell
cd 01-signal-lens\frontend
npm install
npm run build
```

Assignment 2 dashboard:

```powershell
cd 02-studioflow
npm install
npm run build
```

Assignment 3 workflow JSON:

```powershell
node -e "JSON.parse(require('fs').readFileSync('03-n8n-workflow/n8n/alba_submission_health_workflow.json','utf8')); console.log('n8n workflow JSON is valid')"
```

## Portal attachment guidance

The GitHub repository URL is the main source handoff. If the portal only accepts files and not folders, attach zip files or individual files:

- Assignment 1: repository URL is enough; attach `01-signal-lens/README.md` and `01-signal-lens/BUILD_LOG.md` only if the portal requires files.
- Assignment 2: repository URL is enough; attach `02-studioflow/README.md`, `02-studioflow/BUILD_LOG.md`, and `02-studioflow/supabase/schema.sql` only if required.
- Assignment 3: attach `03-n8n-workflow/n8n/alba_submission_health_workflow.json`. If attachments allow zip files, attach a zip of `03-n8n-workflow` so README, build log, workflow JSON, and sample output travel together.

## Secrets policy

No real `.env`, service-role keys, API keys, or credentials should be committed. The committed `.env.example` files contain placeholders only.
