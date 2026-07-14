# Signal Lens

Signal Lens helps a recruiter compare a role brief against a small batch of candidate resumes. It produces evidence-oriented match signals, skills found, and follow-up context; it is explicitly not an automated hiring decision tool.

This is the Assignment 1 submission: a responsive Next.js product with a FastAPI analysis service and the Google Gemini API for semantic embeddings and scanned-document OCR.

## Live deployment

[Open Signal Lens](https://signal-lens-alba.vercel.app)

## What is included

- Drag-and-drop multi-file resume intake with a role brief.
- Motion-led, responsive visual design with progressive loading skeletons.
- Clear empty, validation, loading, and error states.
- PDF/DOCX extraction, skill matching, and candidate comparison.
- A server-side Next.js backend-for-frontend (BFF) at `app/api/screen`.
- Graceful fallback scoring if no Google API key is configured.

## Advanced feature: reliable backend-for-frontend

The browser posts only to the Next.js route handler. That handler forwards the multipart request to the FastAPI service, so the upstream endpoint can change without changing the browser contract. It also:

- fingerprints the request and keeps a small 2-minute in-memory response cache;
- retries transient upstream errors twice with bounded exponential backoff;
- caps its total upstream work at 52 seconds and returns a typed `504` instead of hanging;
- sends `x-signal-lens-cache: HIT` or `MISS` for easy verification; and
- sets `Cache-Control: private, no-store` because resume data is sensitive.

```text
Browser -> Next.js /api/screen BFF -> FastAPI analysis service -> Google Gemini
                | cache + retry/backoff | PDF/DOCX extraction + fallback scoring
```

`GOOGLE_API_KEY` belongs only on the FastAPI host. It is never exposed as a `NEXT_PUBLIC_*` variable.

## Run locally

Prerequisites: Node.js 20+, Python 3.11+.

1. Copy `frontend/.env.example` to `frontend/.env.local` and set `SIGNAL_LENS_API_URL=http://localhost:8000`. Optionally copy `backend/.env.example` to `backend/.env` and add a Gemini key.
2. In `backend`, create a virtual environment and install the dependencies:

   ```bash
   python -m venv .venv
   .venv\\Scripts\\activate
   pip install -r requirements.txt
   set GOOGLE_API_KEY=your_key
   uvicorn main:app --reload --port 8000
   ```

3. In a second terminal, run the web app:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open `http://localhost:3000`, add a role brief and one or more PDF/DOCX resumes.

## API notes and trade-offs

- Gemini is used for `gemini-embedding-001`; scanned PDFs can use the configured vision model. Without a key, ordinary text PDFs/DOCX files still receive deterministic fallback matching.
- The BFF cache is deliberately process-local and short-lived. A production multi-instance version would move it to Redis/KV.
- The upstream model service can be slower on large scans, so the BFF has a hard deadline rather than allowing a stale browser request to wait indefinitely.

## Verification

- Upload valid PDF and DOCX files and check results render as candidate evidence.
- Submit no files to see the validation/empty state.
- Temporarily use an unreachable `SIGNAL_LENS_API_URL` to confirm the surfaced upstream-failure message.
- Repeat the exact same request within two minutes and inspect `x-signal-lens-cache` in the network response.

## Known limitations

- This is decision support only: it does not include demographic data or produce a hire/reject outcome.
- The cache is in-memory, not cross-region.
- OCR quality depends on scan quality and the optional Gemini key.

See [BUILD_LOG.md](./BUILD_LOG.md) for the implementation record.
