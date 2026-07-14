# Build Log: Alba Submission Health Report

## Goal and scope decision

- Re-scoped Assignment 3 to a repo activity and submission-readiness workflow, which is one of the assessment's suggested automation categories.
- Chose a no-secret workflow so reviewers can import and execute it immediately without third-party credential setup or a custom backend deployment.
- Kept the workflow focused: public API calls, transformation, branching, handled errors, and a verifiable report response.

## Stack and tooling

- n8n for orchestration.
- GitHub REST API for external data.
- Code nodes for transformation, scoring, dedupe, and report formatting.
- Webhook response for delivered output.

## Key decisions and trade-offs

- Decision: use GitHub public API because it proves real HTTP integration without requiring credentials.
- Decision: include both manual and webhook triggers so reviewers can test from the n8n canvas and also hit a live URL.
- Decision: use `continueOnFail` on HTTP nodes and branch to an `ATTENTION` report when data is missing, rather than allowing a transient API issue to silently kill the run.
- Trade-off: the workflow does not send email or Slack. I chose a webhook report because it is the fastest credential-free output that reviewers can verify.

## Hard parts and dead ends

- The first workflow candidate depended on several third-party credentials and a deployed custom service. That was useful but not realistic to prove quickly in a reviewer-run assessment.
- Replacing it with a public-API workflow improved reviewability and removed secret-handling risk.

## How I verified it works

- Parsed the workflow JSON locally to confirm it is valid importable JSON.
- Checked the live GitHub API endpoints return repository metadata and recent commits.
- Included a sample output file that matches the report payload returned by the workflow.

## Known limitations

- A production n8n webhook URL is created only after importing and activating the workflow inside an n8n instance.
- GitHub unauthenticated API calls are rate-limited, which is fine for this assessment but would use a token in a production scheduled monitor.
- The report is a readiness signal, not a replacement for opening the deployed app URLs.

## Time spent

- Existing workflow audit: 30 minutes.
- Re-scope and workflow rewrite: 55 minutes.
- README, build log, and portal evidence preparation: 45 minutes.
