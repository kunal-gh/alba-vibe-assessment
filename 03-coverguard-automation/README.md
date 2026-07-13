# CoverGuard Automation

CoverGuard is a quality-control workflow for a publishing team. When a cover file arrives in Google Drive, it validates the filename, sends the file to a vision-analysis service, branches on the quality decision, records the result in Airtable, and emails the author. A separate error workflow ensures failed executions leave an auditable incident record instead of failing silently.

This is the Assignment 3 submission. Both workflows are importable JSON files in [n8n](./n8n).

## Why this is useful

Book-cover review is repetitive but consequential: a publisher wants immediate confirmation when a cover is publishable and precise follow-up when it is not. The workflow turns a Drive upload into a documented decision path while leaving human review in the loop for anything uncertain.

## Workflow map

```text
Google Drive trigger
  -> filename/ISBN validation and transformation
  -> Drive HTTP download (retry x3)
  -> CoverGuard vision API (retry x3)
  -> IF PASS / REVIEW NEEDED
       -> Airtable validation row -> author email

Any n8n execution error
  -> error trigger -> shape incident -> Airtable incident row -> ops email
```

## Included files

| File | Purpose |
| --- | --- |
| [n8n/coverguard_workflow.json](./n8n/coverguard_workflow.json) | Main Drive-to-decision workflow |
| [n8n/coverguard_error_workflow.json](./n8n/coverguard_error_workflow.json) | Dedicated n8n Error Trigger workflow |
| [main.py](./main.py) | FastAPI vision-analysis service called by n8n |
| [render.yaml](./render.yaml) | Deployment definition for the FastAPI service |
| [.env.example](./.env.example) | Non-secret configuration template |

## Node-by-node walkthrough

1. **Google Drive — New Cover Upload**: starts when a file appears in the configured Drive folder.
2. **Validate Filename & Extract ISBN**: Code node expects an ISBN-like filename, extracts the identifier, and returns a normalized work item. Invalid names are stopped intentionally.
3. **Download Cover File from Drive**: makes a real Google Drive HTTP API call to download the uploaded binary. It retries up to three times with a two-second delay.
4. **CoverGuard Vision Engine — Analyze**: sends the PDF/image binary and metadata to the FastAPI service. The service performs the cover checks; this HTTP call also has retry/backoff enabled.
5. **PASS or REVIEW NEEDED?**: an IF node branches based on the response verdict.
6. **PASS path**: creates a `Cover Validations` Airtable record, then emails the author the pass result.
7. **REVIEW path**: reshapes the failed-check details, creates a `Cover Validations` record, then emails the author with the review-needed outcome.
8. **CoverGuard — Error Report**: a separate workflow starts with n8n's Error Trigger, shapes execution metadata, writes a `Workflow Incidents` Airtable record, and emails operations. The Airtable and Gmail nodes use `continueOnFail` so one unavailable delivery channel does not erase the incident.

## Setup

1. Deploy the FastAPI service using `render.yaml` (or run it locally) and obtain a reachable base URL.
2. In n8n, add these environment variables:

   ```dotenv
   COVERGUARD_API_URL=https://your-coverguard-service.example.com
   AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
   GMAIL_USER=your.email@example.com
   COVERGUARD_OPS_EMAIL=ops@example.com
   ```

3. Import `n8n/coverguard_error_workflow.json` first, then import `n8n/coverguard_workflow.json`.
4. In the main workflow settings, select **CoverGuard — Error Report** as its error workflow.
5. Configure credentials in n8n (never inside the JSON):

   - Google Drive OAuth2 for the trigger and file download;
   - Airtable Personal Access Token / credential;
   - Gmail OAuth2 credential for author and operations email;
   - the HTTP Request node's base URL pointing at `COVERGUARD_API_URL`.

6. In Airtable, create:

   - `Cover Validations` with fields used by the main nodes, including ISBN/Book ID, verdict/status, timestamp, and analysis notes;
   - `Workflow Incidents` with `Workflow`, `Execution ID`, `Last Node`, `Message`, `Timestamp`, and `Payload` fields.

## Run and verify

1. Put a PDF or image named like `9781234567890_book.pdf` in the watched Google Drive folder, or use n8n's manual execution with equivalent binary data.
2. Open the execution view. A valid analysis follows either the PASS or REVIEW branch.
3. Verify one new `Cover Validations` row in Airtable and the matching author email.
4. To test error handling, temporarily point `COVERGUARD_API_URL` to an invalid host and run once. Verify an incident appears in `Workflow Incidents` and the operations email is sent.
5. Before submission, include a screenshot of this successful execution and the resulting Airtable row/email in the assessment attachment or Loom walkthrough.

## Sample expected output

```json
{
  "isbn": "9781234567890",
  "verdict": "PASS",
  "checkedAt": "2026-07-13T10:30:00.000Z",
  "summary": "Cover passed the configured quality checks."
}
```

The sample is illustrative. It is not presented as a live execution; use the verification steps above to capture the real run supplied with the submission.

## Local vision service

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set `COVERGUARD_API_URL=http://host.docker.internal:8000` for a local Docker-hosted n8n instance, or a publicly reachable HTTPS URL for n8n Cloud.

## Known limitations

- The workflow requires the reviewer/deployer to connect their own Google Drive, Airtable, and Gmail credentials.
- The vision service must be reachable from n8n; `localhost` is not reachable from n8n Cloud.
- The main workflow is designed for one cover per execution; bulk backfills would be a separate batching workflow.

See [BUILD_LOG.md](./BUILD_LOG.md) for the decisions and constraints recorded during the adaptation.
