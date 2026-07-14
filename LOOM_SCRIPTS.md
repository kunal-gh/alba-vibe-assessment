# Loom Walkthrough Scripts

Record one combined 8 to 10 minute Loom or three shorter videos. If the portal has separate video fields per assignment, three shorter videos are cleaner.

## Assignment 1: Signal Lens

Target length: 2 to 3 minutes.

1. Open `https://signal-lens-alba.vercel.app`.
2. Say: "Signal Lens is a recruiter-facing screening tool. It compares candidate resumes against a role brief and returns ranked evidence, not just a score."
3. Demo the main flow: enter or show the role brief, upload candidate material, submit, and show the loading/skeleton state.
4. Show the result screen: candidate ranking, strengths, concerns, and analytics.
5. Architecture explanation: "The browser does not call the scoring backend directly. The Next.js `/api/screen` route is the BFF. It applies validation, timeout, retry/backoff, and short-lived cache before calling the backend."
6. Proud part: explain the graceful failure path and server-side cache.
7. Honest limitation: "The cache is process-local for this time-boxed build. In production I would move it to Redis or Vercel KV."

## Assignment 2: StudioFlow

Target length: 3 to 4 minutes.

1. Open `https://studioflow-alba.vercel.app/studio`.
2. Log in with `demo@studioflow.local / StudioFlow-demo-2026`.
3. Say: "StudioFlow is a Supabase-backed dashboard for managing creative projects and assets."
4. Show CRUD: create or edit a project/asset, then delete or archive one item if safe.
5. Show charts: point out what each chart means and why it is not decorative.
6. Show backend architecture: open README or schema briefly and explain `projects` and `assets`, ownership columns, and RLS.
7. Show advanced feature: open a second tab, edit an asset/project in one tab, and show the update appear in the other tab. If you do not capture this clearly, only tick Secure isolated data in the portal.
8. Proud part: "The important part is not just auth; RLS keeps rows scoped to the signed-in user."
9. Honest limitation: "The demo dataset is intentionally small. With more time I would add richer audit history and file storage."

## Assignment 3: Alba Submission Health Report

Target length: 2 to 3 minutes.

1. Open n8n and import `03-n8n-workflow/n8n/alba_submission_health_workflow.json`.
2. Say: "This workflow is a repo activity and submission-readiness report. It uses public GitHub data so reviewers can run it without credentials."
3. Walk node-by-node: Manual trigger, Webhook trigger, Set Run Context, Fetch Repo Metadata, Fetch Recent Commits, Build Submission Report, Report Ready IF node, response nodes.
4. Execute manually in n8n and open `Manual Evidence Output`.
5. Show the output fields: `status`, `score`, `recentCommits`, `checks`, and `markdownReport`.
6. If the workflow is activated, open the production webhook URL in the browser and show the JSON response.
7. Error-handling explanation: "The HTTP request nodes use `continueOnFail`, so API failures are converted into an `ATTENTION` report instead of silently killing the execution."
8. Proud part: "The workflow is credential-free and still covers trigger, API, transformation, branching, error handling, and output."
9. Honest limitation: "It uses GitHub's unauthenticated rate limit. In production I would add a GitHub token and send the report to Slack or email."

## Combined video order

If recording one video, use this order:

1. 20 seconds: introduce the monorepo and the three folders.
2. 2 minutes: Signal Lens demo and backend explanation.
3. 3 minutes: StudioFlow login, CRUD, charts, RLS/realtime.
4. 2 minutes: n8n workflow import/run/output.
5. 30 seconds: mention known limitations and where build logs live.
