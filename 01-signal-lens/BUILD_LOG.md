# Build Log: Signal Lens

## Goal and scope decision

- Adapted an existing resume-screening foundation into a narrower, reviewer-ready candidate-evidence app.
- Prioritized the Assignment 1 advanced backend requirement, reliable states, naming, and documentation over adding unrelated recruiter features.
- Deliberately left out accounts, persistence, and any automated hiring recommendation to stay within the time-box and avoid turning a support tool into a decision engine.

## Stack and tooling

- Next.js 15, TypeScript, Tailwind CSS, Framer Motion, and Zustand for the responsive client.
- FastAPI for file parsing and scoring.
- Google Gemini for optional embeddings and scanned-PDF OCR, with a non-secret fallback when no key is available.

## Key decisions and trade-offs

- Added a Next.js route handler as a BFF rather than calling the analysis service from the browser, because it provides one stable client contract and is the right place for caching, retries, and upstream error mapping.
- Used a two-minute, capped in-memory cache keyed by a content fingerprint. It is sufficient for repeated reviews in one instance; Redis/KV would be the next production step.
- Kept candidate results framed as evidence and follow-up prompts, not recommendations, because hiring decisions need human accountability.

## Hard parts and resolution

- Large file analysis can exceed a pleasant browser waiting time. The BFF now makes two bounded attempts, uses a total deadline, and returns an intentional failure response instead of an unbounded pending request.
- The original loading state was mostly a spinner. Added visible candidate-card skeletons so the interface maintains structure while work is in progress.

## How I verified it works

- Checked the component paths for role brief, file validation, loading skeletons, empty result state, result rendering, and error handling.
- Will run the production frontend build and complete a live upstream/downstream smoke test before deployment.

## Known limitations

- Cache contents do not persist across server instances or restarts.
- OCR is limited by document quality and Gemini availability.
- The app must not be used as the sole basis for an employment decision.

## Time spent

- Existing-project audit and scope selection: 35 minutes.
- BFF resilience, state polish, and product rename: 70 minutes.
- Documentation and verification preparation: 35 minutes.
