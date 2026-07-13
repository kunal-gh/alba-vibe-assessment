# Build Log: CoverGuard Automation

## Goal and scope decision

- Adapted an existing cover-quality workflow into an assessment-ready n8n submission with a clear trigger, external data, transformation, branching, delivered output, and intentional failure path.
- Kept the useful publishing workflow rather than replacing it with a demo-only webhook.
- Focused the added work on resilience and honest import/setup documentation.

## Stack and tooling

- n8n for orchestration.
- Google Drive HTTP API for uploaded source files.
- FastAPI vision service for analysis.
- Airtable for verifiable records and Gmail for notifications.

## Key decisions and trade-offs

- Used filename/ISBN validation before the expensive vision request, because malformed inputs should stop early and visibly.
- Added retries to the two flaky network points (Drive download and vision API), rather than retrying every node indiscriminately.
- Replaced a disconnected pseudo-error node with a real n8n Error Trigger workflow. n8n routes failed executions to the selected error workflow; a node not connected to a trigger could never provide reliable error handling.
- Retained Airtable plus email as two complementary outputs: the team can audit records and the author receives immediate feedback.

## Hard parts and resolution

- The source workflow's error handler was not wired as an executable error workflow. Created `coverguard_error_workflow.json`, documented the import order, and removed the misleading inactive node.
- n8n Cloud cannot call a developer's `localhost`. The README calls out the required publicly reachable service URL and the local Docker alternative.

## How I verified it works

- Parsed both exported workflow JSON files after editing to ensure they are valid JSON.
- Checked that the main workflow contains the Drive trigger, HTTP download, Code transformation, IF branch, Airtable/Gmail outputs, and retry settings.
- Checked the error workflow contains Error Trigger, transformed incident data, Airtable output, and operations notification.
- A live execution still needs the deployer's third-party credentials and service URL; the README gives exact steps to record that final evidence.

## Known limitations

- Credentials and a deployed vision-service URL are intentionally not committed.
- Airtable field names must match the selected n8n mappings.
- The error workflow must be selected explicitly in the main workflow's settings after import.

## Time spent

- Existing-project audit and scope selection: 35 minutes.
- Workflow resilience and error-workflow correction: 45 minutes.
- Import/runbook and evidence preparation: 40 minutes.
