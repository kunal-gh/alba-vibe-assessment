# Submission Checklist

## Assignment 1 — Signal Lens

- [ ] Deploy `01-signal-lens/frontend` to Vercel.
- [ ] Deploy the FastAPI service or set `SIGNAL_LENS_API_URL` to its reachable URL.
- [ ] Set `GOOGLE_API_KEY` only in the backend host (optional fallback is supported).
- [ ] Test a normal request, an empty upload, and an upstream-unavailable request.
- [ ] Paste live URL and Loom URL into the assessment form.

## Assignment 2 — StudioFlow

- [ ] Create a Supabase project and run `02-studioflow/supabase/schema.sql` in SQL Editor.
- [ ] Add the three Supabase values to Vercel environment settings.
- [ ] Run the documented seed script and confirm the demo account can sign in.
- [ ] Verify User B cannot see User A's rows using the README steps.
- [ ] Open two tabs and confirm an edit is reflected live.
- [ ] Paste live URL, repository URL, and demo credentials into the assessment form.

## Assignment 3 — CoverGuard

- [ ] Deploy the FastAPI vision service and set `COVERGUARD_API_URL` in n8n.
- [ ] Import `coverguard_error_workflow.json` first, then `coverguard_workflow.json`.
- [ ] Configure Google Drive, Airtable, Gmail, and the error-workflow email recipient.
- [ ] Link the error workflow in the main workflow's settings.
- [ ] Execute one sample file, capture the Airtable row/email or execution screenshot, and attach/export the JSON.

## Final pass

- [ ] Every URL opens in an incognito window.
- [ ] Repository is public or shared with the reviewers.
- [ ] Each project has a README, BUILD_LOG, and `.env.example`.
- [ ] No secrets, generated output, or local databases are committed.
