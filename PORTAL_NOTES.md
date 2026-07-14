# Portal Notes

Use these notes in the optional notes box for each assignment. Keep the Loom links in the video field, not inside the notes box.

## Assignment 1: Signal Lens

Signal Lens is a focused resume-screening web app. The frontend is deployed on Vercel, and the Next.js route handler acts as a backend-for-frontend: it keeps backend URLs and optional AI keys out of client code, applies request timeouts, retries failed upstream calls, caches repeated content fingerprints briefly, and returns graceful error states. I selected the advanced option **Your own backend**. Known limitation: the cache is process-local for the assessment deployment; a production multi-instance version would move it to Redis or Vercel KV.

## Assignment 2: StudioFlow

StudioFlow is a Supabase-backed creative operations dashboard with projects, assets, CRUD, analytics charts, Auth, RLS policies, realtime subscriptions, schema SQL, and a seed script. Demo login: `demo@studioflow.local / StudioFlow-demo-2026`. I selected the advanced option **Secure, isolated data**. I also implemented realtime updates; tick that option if the Loom shows the two-tab edit test. Known limitation: seeded demo data is intentionally small so reviewers can understand the schema quickly.

## Assignment 3: Alba Submission Health Report

This is an importable n8n workflow. It has a manual trigger and a live webhook trigger, calls the public GitHub REST API, transforms and dedupes recent commits, scores repository activity, branches with an IF node into `READY` or `ATTENTION`, handles API failures through `continueOnFail`, and returns a verifiable JSON/Markdown report. No API keys or external credentials are required. If a live n8n instance is unavailable, the workflow JSON plus README provide everything needed to import and run it.

## Attachment guidance

Use the GitHub repository URL as the source handoff for all three assignments. If the portal asks for files and does not accept folders, upload a zip. For Assignment 3, at minimum attach:

```text
03-n8n-workflow/n8n/alba_submission_health_workflow.json
03-n8n-workflow/README.md
03-n8n-workflow/BUILD_LOG.md
03-n8n-workflow/evidence/sample-output.json
```

For Assignment 1 and Assignment 2, attachments are optional if the repository URL is public and working.
