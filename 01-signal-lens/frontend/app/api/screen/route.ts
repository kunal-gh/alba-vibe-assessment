import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Signal Lens' backend-for-frontend.
 *
 * The browser only talks to this same-origin route. It keeps the upstream
 * service configurable on the server, retries transient failures within the
 * Vercel time budget, and maintains a very small best-effort result cache.
 */
const UPSTREAM_URL = process.env.SIGNAL_LENS_API_URL ?? 'https://ai-resume-screener-api-5iq6.onrender.com';
const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_LIMIT = 20;
const MAX_CACHEABLE_RESPONSE_BYTES = 700_000;
const REQUEST_DEADLINE_MS = 52_000;
const MAX_ATTEMPTS = 2;

type CacheEntry = {
  body: string;
  expiresAt: number;
};

// Serverless instances do not guarantee persistence. This is deliberately a
// small hot-result cache, not a datastore for uploaded candidate data.
const resultCache = new Map<string, CacheEntry>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of resultCache) {
    if (entry.expiresAt <= now) resultCache.delete(key);
  }

  while (resultCache.size > CACHE_LIMIT) {
    const oldestKey = resultCache.keys().next().value;
    if (!oldestKey) break;
    resultCache.delete(oldestKey);
  }
}

async function fingerprint(entries: [string, FormDataEntryValue][]) {
  const hash = createHash('sha256');

  for (const [key, value] of entries) {
    hash.update(key);
    if (typeof value === 'string') {
      hash.update(value);
      continue;
    }

    hash.update(value.name);
    hash.update(String(value.size));
    hash.update(Buffer.from(await value.arrayBuffer()));
  }

  return hash.digest('hex');
}

function rebuildFormData(entries: [string, FormDataEntryValue][]) {
  const form = new FormData();
  for (const [key, value] of entries) form.append(key, value);
  return form;
}

function isRetryable(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function requestUpstream(entries: [string, FormDataEntryValue][]) {
  const deadline = Date.now() + REQUEST_DEADLINE_MS;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(30_000, remaining));

    try {
      const response = await fetch(`${UPSTREAM_URL}/screen`, {
        method: 'POST',
        body: rebuildFormData(entries),
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!isRetryable(response.status) || attempt === MAX_ATTEMPTS - 1) return response;
      lastError = new Error(`Upstream returned ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unable to connect to the screening service.');
    } finally {
      clearTimeout(timeout);
    }

    // Exponential backoff stays within the route's hard deadline.
    const backoff = 400 * (attempt + 1);
    if (Date.now() + backoff < deadline) await sleep(backoff);
  }

  throw lastError ?? new Error('The screening service did not respond before the request deadline.');
}

export async function POST(request: NextRequest) {
  try {
    const entries = Array.from((await request.formData()).entries());
    const cacheKey = await fingerprint(entries);
    const skipCache = request.headers.get('x-signal-lens-cache') === 'off';

    pruneCache();
    const cached = !skipCache ? resultCache.get(cacheKey) : undefined;
    if (cached && cached.expiresAt > Date.now()) {
      return new NextResponse(cached.body, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'private, no-store',
          'x-signal-lens-cache': 'HIT',
        },
      });
    }

    const upstream = await requestUpstream(entries);
    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';

    if (upstream.ok && !skipCache && Buffer.byteLength(body, 'utf8') <= MAX_CACHEABLE_RESPONSE_BYTES) {
      resultCache.set(cacheKey, { body, expiresAt: Date.now() + CACHE_TTL_MS });
      pruneCache();
    }

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'private, no-store',
        'x-signal-lens-cache': upstream.ok ? 'MISS' : 'BYPASS',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The screening service could not be reached.';
    return NextResponse.json(
      {
        error: 'Signal Lens could not complete this screening run.',
        detail: message,
        retryable: true,
      },
      { status: 504 },
    );
  }
}
