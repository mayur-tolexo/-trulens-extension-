# Free Rate-Limited Shared-AI Tier via Cloudflare Worker Proxy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rate-limited shared-AI tier to the TruLens Chrome extension, powered by a Cloudflare Worker proxy that holds the owner's MiniMax API key server-side — the key never enters the extension bundle.

**Architecture:** A Cloudflare Worker (`proxy/worker.ts`) accepts OpenAI-style chat-completion POSTs from the extension, applies a per-user per-day rate limit using a KV namespace, injects the server-side MiniMax API key, and forwards the request to MiniMax. The extension uses a stable per-device UUID (stored in `chrome.storage.local`) as its anonymous client identifier. The default `providerMode` becomes `'proxy'`, with `DEFAULT_PROXY_URL` defaulting to empty (AI stays dormant until the owner sets it post-deploy). A full three-option provider selector replaces the existing two-option one.

**Tech Stack:** TypeScript, Cloudflare Workers (no npm deps in worker), Wrangler CLI for deploy, Vitest for tests, Vite + CRXJS for extension build.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `proxy/worker.ts` | Rewrite | CORS + rate-limit + MiniMax proxy |
| `proxy/wrangler.toml` | Create | Wrangler config (KV binding, vars) |
| `proxy/README.md` | Rewrite | Exact deploy steps |
| `src/types.ts` | Modify | Add `DEFAULT_PROXY_URL`; switch default mode to `proxy` |
| `src/background/llm.ts` | Modify | `clientId()`, proxy transport, OpenAI-shape extractText for proxy, 429 handling, pass clientHeader through callers |
| `src/background/index.ts` | Modify | Return `{ok:false,error:'quota'}` when `runDeepAnalysis`/`runBatchAnalysis` throw `'quota'` |
| `src/content/index.ts` | Modify | Surface `'quota'` error as user-facing message in `deepAnalyze` |
| `manifest.config.ts` | Modify | Add `https://*.workers.dev/*` to `host_permissions` |
| `src/popup/popup.html` | Modify | Add proxy option to `<select>`; add proxy-URL row; conditional field visibility |
| `src/popup/popup.ts` | Modify | `toggleProviderFields()`, updated hint logic, save/load `proxyUrl` |
| `src/onboarding/onboarding.html` | Modify | Add proxy option; updated copy; conditional fields |
| `src/onboarding/onboarding.ts` | Modify | `toggleProviderFields()`, save/load `proxyUrl` |
| `test/llm.test.ts` | Modify | Update proxy `extractText` test (OpenAI shape); add `buildRequest` proxy clientHeader test |
| `docs/PUBLISHING.md` | Modify | Note proxy + workers.dev permission justification |
| `docs/STORE_LISTING.md` | Modify | Note optional shared proxy; update permission table |
| `PRIVACY.md` | Modify | Add proxy-mode data-flow paragraph |
| `docs/privacy.html` | Modify | Add proxy-mode data-flow paragraph |

---

## Task 1: Rewrite the Cloudflare Worker (`proxy/worker.ts`)

**Files:**
- Rewrite: `proxy/worker.ts`

- [ ] **Step 1: Replace worker.ts with the new implementation**

```typescript
// proxy/worker.ts
// Cloudflare Worker — TruLens free shared-AI proxy
// Deploy with: wrangler deploy
// Secrets: wrangler secret put MINIMAX_API_KEY
// KV: create with `wrangler kv namespace create RL` and paste the id into wrangler.toml

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-trulens-client',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // Rate limiting
    const LIMIT: number = parseInt(env.DAILY_LIMIT) || 40;
    const clientId: string = req.headers.get('x-trulens-client') ||
      req.headers.get('cf-connecting-ip') ||
      'anonymous';
    const day: string = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rlKey: string = `${clientId}:${day}`;

    const countStr: string | null = await env.RL.get(rlKey);
    const count: number = parseInt(countStr ?? '0') || 0;

    if (count >= LIMIT) {
      return new Response(
        JSON.stringify({ error: 'daily_limit', limit: LIMIT }),
        {
          status: 429,
          headers: { ...CORS, 'content-type': 'application/json' },
        }
      );
    }

    // Increment counter (expire after 48h so KV doesn't grow unbounded)
    await env.RL.put(rlKey, String(count + 1), { expirationTtl: 172800 });

    // Parse request body
    let body: { model?: string; max_tokens?: number; messages?: any[] };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // Forward to MiniMax — always use the server-side model to control cost
    const upstream = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${env.MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.MODEL || 'MiniMax-M2',
        max_tokens: body.max_tokens ?? 1024,
        messages: body.messages,
      }),
    });

    const upstreamText = await upstream.text();
    return new Response(upstreamText, {
      status: upstream.status,
      headers: {
        ...CORS,
        'content-type': 'application/json',
        'x-ratelimit-remaining': String(LIMIT - count - 1),
      },
    });
  },
};
```

- [ ] **Step 2: Create `proxy/wrangler.toml`**

```toml
name = "trulens-proxy"
main = "worker.ts"
compatibility_date = "2024-11-01"

[vars]
DAILY_LIMIT = "40"
# MODEL = "MiniMax-M2"

[[kv_namespaces]]
binding = "RL"
id = "REPLACE_WITH_KV_ID"
```

- [ ] **Step 3: Rewrite `proxy/README.md`**

```markdown
# TruLens Proxy — Cloudflare Worker

A rate-limited, server-side MiniMax proxy that powers the free shared-AI tier.
The MiniMax API key lives **only** as a Cloudflare Worker secret — it is never
committed to the repo or shipped in the extension bundle.

## Deploy steps

### 1. Install Wrangler

```sh
npm i -g wrangler
wrangler login
```

### 2. Create the KV namespace

```sh
wrangler kv namespace create RL
```

Copy the printed `id` value and paste it into `wrangler.toml` under
`[[kv_namespaces]]`:

```toml
[[kv_namespaces]]
binding = "RL"
id = "PASTE_THE_ID_HERE"
```

### 3. Set the MiniMax API key as a secret

```sh
wrangler secret put MINIMAX_API_KEY
```

Paste your MiniMax key at the prompt. It is stored encrypted in Cloudflare —
**never commit it to the repo**.

### 4. Deploy

```sh
wrangler deploy
```

Note the deployed URL printed at the end, e.g.
`https://trulens-proxy.<your-subdomain>.workers.dev`.

### 5. Wire the URL into the extension

Open `src/types.ts` and set:

```typescript
export const DEFAULT_PROXY_URL = 'https://trulens-proxy.<your-subdomain>.workers.dev';
```

Then rebuild:

```sh
npm run build
```

---

## How it works

- The extension sends a POST with an OpenAI-style body (`{ model, max_tokens, messages }`)
  and a `x-trulens-client` header containing a stable per-device UUID.
- The Worker reads the UUID and the current UTC date to form a rate-limit key,
  checks/increments a count in the KV namespace, and rejects with HTTP 429 if
  the user has exceeded the daily limit (`DAILY_LIMIT`, default 40).
- Approved requests are forwarded to `https://api.minimax.io/v1/chat/completions`
  with the server-side `MINIMAX_API_KEY`. The model is forced server-side to
  `MiniMax-M2` (or the value of the `MODEL` env var) regardless of what the
  client sends — this controls cost.
- The MiniMax response is returned verbatim with CORS headers and an
  `X-RateLimit-Remaining` header.

## Rate limit

- Per user, per day (UTC). The KV entry expires after 48 h.
- Default limit: 40 requests / day. Change `DAILY_LIMIT` in `wrangler.toml`
  (or as a Cloudflare env var) without redeploying.
- Users who want unlimited analysis can switch to BYOK mode in Settings
  (pick "My OpenAI-compatible key" and enter their own MiniMax/OpenAI key).
```

---

## Task 2: Add `DEFAULT_PROXY_URL` and update defaults in `src/types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `DEFAULT_PROXY_URL` constant and update `DEFAULT_SETTINGS`**

Open `src/types.ts`. After the imports (there are none — it's type-only), add the constant before `DEFAULT_SETTINGS`:

```typescript
/** Set to your deployed Cloudflare Worker URL to enable the free shared-AI tier.
 *  Leave empty to keep AI dormant until the owner sets it and rebuilds.
 *  NEVER put an API key here — the key lives only as a Cloudflare Worker secret. */
export const DEFAULT_PROXY_URL = ''; // set to your deployed Cloudflare Worker URL to enable the free shared-AI tier
```

Then update `DEFAULT_SETTINGS` (change only `providerMode` and `proxyUrl`):

```typescript
export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  perSite: { amazon: true, flipkart: true, googleMaps: true },
  providerMode: 'proxy',
  apiKey: '',
  baseUrl: 'https://api.minimax.io/v1',
  model: 'MiniMax-M2',
  proxyUrl: DEFAULT_PROXY_URL,
  autoDeep: true
};
```

---

## Task 3: Rewrite LLM transport in `src/background/llm.ts`

**Files:**
- Modify: `src/background/llm.ts`

The changes are:
1. Add `clientId()` async helper.
2. Change `buildRequest` and `buildBatchRequest` to accept an optional `clientHeader?: string`; when `providerMode === 'proxy'` and `clientHeader` is provided, add the `x-trulens-client` header.
3. Change `extractText` so `proxy` is treated like `openai-compatible` (reads `choices[0].message.content`, strips `<think>`).
4. Update `runDeepAnalysis`, `runBatchAnalysis`, `testConnection` to: fetch `clientId()`, pass it as `clientHeader` to the builders, and handle HTTP 429 specifically.

- [ ] **Step 1: Add the `clientId()` helper (insert after the imports, before `PROMPT`)**

Add this block right after the import block at the top of `src/background/llm.ts`:

```typescript
/** Returns a stable anonymous per-device UUID for rate-limit tracking.
 *  Creates and persists one on first call; never contains any personal data. */
async function clientId(): Promise<string> {
  const o = await chrome.storage.local.get('clientId');
  if (o.clientId) return o.clientId as string;
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random();
  await chrome.storage.local.set({ clientId: id });
  return id;
}
```

- [ ] **Step 2: Update `buildRequest` signature and proxy branch**

Replace the existing `buildRequest` function with:

```typescript
export function buildRequest(review: Review, siblings: Review[], s: Settings, clientHeader?: string): LlmRequest {
  const content = PROMPT(review, siblings);
  const model = s.model || 'claude-sonnet-4-6';
  if (s.providerMode === 'openai-compatible') {
    const base = s.baseUrl.replace(/\/+$/, '');
    return {
      url: `${base}/chat/completions`,
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}` },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
    };
  }
  if (s.providerMode === 'anthropic') {
    const base = (s.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const isOfficial = !s.baseUrl || /(^|\.)anthropic\.com$/.test(new URL(base).hostname);
    const anthropicHeaders: Record<string, string> = isOfficial
      ? { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}`, 'anthropic-version': '2023-06-01' };
    return {
      url: `${base}/v1/messages`,
      headers: anthropicHeaders,
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
    };
  }
  // proxy mode: POST OpenAI-style body; add client id header for rate limiting
  const proxyHeaders: Record<string, string> = { 'content-type': 'application/json' };
  if (clientHeader) proxyHeaders['x-trulens-client'] = clientHeader;
  return {
    url: s.proxyUrl,
    headers: proxyHeaders,
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
  };
}
```

- [ ] **Step 3: Update `buildBatchRequest` signature and proxy branch**

Replace the proxy branch at the end of `buildBatchRequest`:

```typescript
export function buildBatchRequest(reviews: Review[], siblings: Review[], s: Settings, clientHeader?: string): LlmRequest {
  const content = BATCH_PROMPT(reviews, siblings);
  const model = s.model || 'claude-sonnet-4-6';
  const max_tokens = Math.min(8000, 700 + reviews.length * 320);
  if (s.providerMode === 'openai-compatible') {
    const baseU = s.baseUrl.replace(/\/+$/, '');
    return { url: `${baseU}/chat/completions`, headers: { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}` }, body: JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content }] }) };
  }
  if (s.providerMode === 'anthropic') {
    const baseU = (s.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const isOfficialU = !s.baseUrl || /(^|\.)anthropic\.com$/.test(new URL(baseU).hostname);
    const batchAnthropicHeaders: Record<string, string> = isOfficialU
      ? { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}`, 'anthropic-version': '2023-06-01' };
    return { url: `${baseU}/v1/messages`, headers: batchAnthropicHeaders, body: JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content }] }) };
  }
  // proxy mode
  const batchProxyHeaders: Record<string, string> = { 'content-type': 'application/json' };
  if (clientHeader) batchProxyHeaders['x-trulens-client'] = clientHeader;
  return { url: s.proxyUrl, headers: batchProxyHeaders, body: JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content }] }) };
}
```

- [ ] **Step 4: Update `extractText` so `proxy` uses OpenAI shape**

Replace the `extractText` function with:

```typescript
export function extractText(mode: ProviderMode, json: any): string {
  if (mode === 'openai-compatible' || mode === 'proxy') {
    return stripThink(json?.choices?.[0]?.message?.content ?? '');
  }
  // anthropic: reasoning models put a 'thinking' block first, then a 'text' block
  const blocks = json?.content;
  if (Array.isArray(blocks)) {
    const textBlock = blocks.find((b: any) => b?.type === 'text' && typeof b?.text === 'string');
    if (textBlock) return stripThink(textBlock.text);
    const anyText = blocks.find((b: any) => typeof b?.text === 'string');
    if (anyText) return stripThink(anyText.text);
  }
  return '';
}
```

- [ ] **Step 5: Update `runDeepAnalysis` to fetch clientId and handle 429**

Replace `runDeepAnalysis`:

```typescript
export async function runDeepAnalysis(review: Review, siblings: Review[]): Promise<DeepAnalysisResult> {
  const s = await getSettings();
  const cid = s.providerMode === 'proxy' ? await clientId() : undefined;
  const req = buildRequest(review, siblings, s, cid);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  if (res.status === 429) throw new Error('quota');
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const json = await res.json();
  return parseResult(extractText(s.providerMode, json));
}
```

- [ ] **Step 6: Update `runBatchAnalysis` to fetch clientId and handle 429**

Replace `runBatchAnalysis`:

```typescript
export async function runBatchAnalysis(reviews: Review[], siblings: Review[]): Promise<DeepAnalysisResult[]> {
  const s = await getSettings();
  const cid = s.providerMode === 'proxy' ? await clientId() : undefined;
  const req = buildBatchRequest(reviews, siblings, s, cid);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  if (res.status === 429) throw new Error('quota');
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const json = await res.json();
  return parseBatch(extractText(s.providerMode, json), reviews.length);
}
```

- [ ] **Step 7: Update `testConnection` to fetch clientId and handle 429**

Replace `testConnection`:

```typescript
export async function testConnection(): Promise<TestResult> {
  const s = await getSettings();
  if (s.providerMode !== 'proxy' && !s.apiKey) return { ok: false, error: 'No API key set.' };
  if (s.providerMode === 'openai-compatible' && !s.baseUrl) return { ok: false, error: 'Base URL is required for OpenAI-compatible mode.' };
  const cid = s.providerMode === 'proxy' ? await clientId() : undefined;
  const req = buildRequest(SAMPLE_REVIEW, [], s, cid);
  let res: Response;
  try {
    res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  } catch (e) {
    return { ok: false, error: `Network/CORS error: ${(e as Error).message}` };
  }
  if (res.status === 429) {
    return { ok: false, error: 'Free daily AI limit reached — add your own API key for unlimited use.' };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: `HTTP ${res.status} — ${body.slice(0, 160)}` };
  }
  const json = await res.json().catch(() => null);
  const text = extractText(s.providerMode, json);
  if (!text) return { ok: false, error: 'Model returned an empty response (check the model name).' };
  const parsed = parseResult(text);
  return { ok: true, score: parsed.score, reasoning: parsed.reasoning };
}
```

---

## Task 4: Update background message handler (`src/background/index.ts`)

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Wrap `runBatchAnalysis` and `runDeepAnalysis` calls to translate 'quota' errors**

Replace the relevant branches in the message listener so that when either throws `Error('quota')`, we return `{ ok: false, error: 'quota' }` instead of propagating the error string. The catch block currently returns `{ ok: false, error: (e as Error).message }` — that already works for both cases (`'quota'` and `'LLM 429'`), but we want `error: 'quota'` specifically for the quota case.

Replace the entire listener with:

```typescript
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'deepAnalysisBatch') {
        const reviews = msg.reviews ?? [];
        const out: any[] = [];
        const toRun: any[] = [];
        for (const rv of reviews) {
          const cached = await getCached(rv.text);
          if (cached) out.push({ id: rv.id, ...cached });
          else toRun.push(rv);
        }
        if (toRun.length) {
          let results: any[];
          try {
            results = await runBatchAnalysis(toRun, msg.siblings ?? []);
          } catch (e) {
            if ((e as Error).message === 'quota') return sendResponse({ ok: false, error: 'quota' });
            throw e;
          }
          for (let i = 0; i < toRun.length; i++) {
            const r = results[i] ?? { score: 50, verdict: 'mixed', reasoning: '' };
            await setCached(toRun[i].text, r);
            out.push({ id: toRun[i].id, ...r });
          }
        }
        return sendResponse({ ok: true, results: out });
      }
      if (msg.type === 'deepAnalysis') {
        const cached = await getCached(msg.review.text);
        if (cached) return sendResponse({ ok: true, result: cached, cached: true });
        let result: any;
        try {
          result = await runDeepAnalysis(msg.review, msg.siblings ?? []);
        } catch (e) {
          if ((e as Error).message === 'quota') return sendResponse({ ok: false, error: 'quota' });
          throw e;
        }
        await setCached(msg.review.text, result);
        return sendResponse({ ok: true, result });
      }
      if (msg.type === 'testConnection') return sendResponse(await testConnection());
      if (msg.type === 'getSettings') return sendResponse({ ok: true, settings: await getSettings() });
      if (msg.type === 'setSettings') return sendResponse({ ok: true, settings: await setSettings(msg.patch) });
      if (msg.type === 'clearCache') { await clearCache(); return sendResponse({ ok: true }); }
      sendResponse({ ok: false, error: 'unknown message' });
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
  })();
  return true; // async
});
```

---

## Task 5: Surface quota error in content script (`src/content/index.ts`)

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Update `deepAnalyze` to detect `resp.error === 'quota'`**

In `src/content/index.ts`, the `deepAnalyze` function currently shows `'Deep analysis unavailable.'` on failure. We need to detect the `'quota'` error specifically and show a better message.

Find this block in `deepAnalyze`:

```typescript
          if (resp?.ok) {
            const r = resp.result;
            const verdict = r.verdict ?? verdictFor(r.score);
            applyDeepResult({ score: r.score, verdict, reasoning: r.reasoning });
            // Update stored result so the popup + overlay reflect LLM values
            const updated: ScoreResult = {
              ...pageResults.get(f.review.id)!,
              score: r.score,
              verdict
            };
            pageResults.set(f.review.id, updated);
            // Also upgrade the inline badge
            renderFor(f.review.id, updated);
            refresh();
          } else {
            showDeepResult('Deep analysis unavailable.');
          }
```

Replace the `else` branch:

```typescript
          } else if (resp?.error === 'quota') {
            showDeepResult('Free AI limit reached — add your own key in Settings.');
          } else {
            showDeepResult('Deep analysis unavailable.');
          }
```

---

## Task 6: Add `*.workers.dev` to `host_permissions` (`manifest.config.ts`)

**Files:**
- Modify: `manifest.config.ts`

- [ ] **Step 1: Add the workers.dev entry**

In `manifest.config.ts`, replace:

```typescript
  host_permissions: [
    'https://www.google.com/maps/*',
    // LLM endpoints — needed so the service worker fetch bypasses CORS
    'https://api.minimax.io/*',
    'https://api.anthropic.com/*'
  ],
```

with:

```typescript
  host_permissions: [
    'https://www.google.com/maps/*',
    // LLM endpoints — needed so the service worker fetch bypasses CORS
    'https://api.minimax.io/*',
    'https://api.anthropic.com/*',
    // Cloudflare Worker proxy — for the optional free shared-AI tier
    'https://*.workers.dev/*',
  ],
```

---

## Task 7: Update tests in `test/llm.test.ts`

**Files:**
- Modify: `test/llm.test.ts`

- [ ] **Step 1: Update the proxy `extractText` tests**

Find and replace the test that currently asserts the Anthropic-shape for proxy mode:

```typescript
  it('reads Anthropic shape', () => {
    expect(extractText('anthropic', { content: [{ text: 'hi' }] })).toBe('hi');
    expect(extractText('proxy', { content: [{ text: 'hi' }] })).toBe('hi');
  });
```

Replace with:

```typescript
  it('reads Anthropic shape for anthropic mode', () => {
    expect(extractText('anthropic', { content: [{ text: 'hi' }] })).toBe('hi');
  });
  it('proxy mode reads OpenAI shape (choices[0].message.content)', () => {
    expect(extractText('proxy', { choices: [{ message: { content: 'hi' } }] })).toBe('hi');
  });
  it('proxy mode strips <think> blocks', () => {
    expect(extractText('proxy', { choices: [{ message: { content: '<think>thinking</think>result' } }] })).toBe('result');
  });
```

- [ ] **Step 2: Add a `buildRequest` proxy mode test that includes the `x-trulens-client` header when `clientHeader` is passed**

Add this test inside the `describe('buildRequest', ...)` block:

```typescript
  it('proxy: adds x-trulens-client header when clientHeader is passed', () => {
    const r = buildRequest(review, [], s({ providerMode: 'proxy', proxyUrl: 'https://proxy.test/analyze' }), 'test-client-id-123');
    expect(r.url).toBe('https://proxy.test/analyze');
    expect(r.headers['x-trulens-client']).toBe('test-client-id-123');
    expect(r.headers['content-type']).toBe('application/json');
  });
  it('proxy: omits x-trulens-client header when clientHeader is not passed', () => {
    const r = buildRequest(review, [], s({ providerMode: 'proxy', proxyUrl: 'https://proxy.test/analyze' }));
    expect(r.headers['x-trulens-client']).toBeUndefined();
  });
  it('proxy: body uses OpenAI shape with messages array', () => {
    const r = buildRequest(review, [], s({ providerMode: 'proxy', proxyUrl: 'https://proxy.test/analyze' }), 'cid');
    const body = JSON.parse(r.body);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages[0].role).toBe('user');
    expect(typeof body.messages[0].content).toBe('string');
  });
```

- [ ] **Step 3: Run the tests to verify all pass**

```sh
cd /Users/mayurdas/Documents/projects/go/src/trulens && npm test
```

Expected output: all tests pass; the updated proxy extractText tests and new buildRequest proxy tests are included.

---

## Task 8: Update popup UI (`src/popup/popup.html` + `src/popup/popup.ts`)

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.ts`

### Part A: popup.html

- [ ] **Step 1: Update the provider `<select>` to have three options**

Find:

```html
      <div class="tl-setting-row">
        <span class="tl-setting-label">Source</span>
        <select id="providerMode">
          <option value="anthropic">Anthropic-compatible (Anthropic, MiniMax)</option>
          <option value="openai-compatible">OpenAI-compatible (MiniMax, OpenAI…)</option>
        </select>
      </div>
```

Replace with:

```html
      <div class="tl-setting-row">
        <span class="tl-setting-label">Source</span>
        <select id="providerMode">
          <option value="proxy">Free shared AI (no key needed)</option>
          <option value="openai-compatible">My OpenAI-compatible key (MiniMax/OpenAI)</option>
          <option value="anthropic">My Anthropic key</option>
        </select>
      </div>
```

- [ ] **Step 2: Add a Proxy URL row (hidden by default) after the providerMode row, and wrap the key-needing rows in a `<div id="byok-rows">`**

After the providerMode `<div class="tl-setting-row">`, add:

```html
      <!-- Proxy URL row (shown only in proxy mode) -->
      <div class="tl-setting-row" id="proxy-url-row" style="display:none">
        <span class="tl-setting-label">Proxy URL</span>
        <input type="text" id="proxyUrl" placeholder="https://trulens-proxy.xxx.workers.dev">
      </div>
      <!-- BYOK rows: hidden in proxy mode -->
      <div id="byok-rows">
```

Then close the `byok-rows` div right before the `<p class="tl-key-help">` tag, i.e., wrap the three rows (Base URL, Model, API Key) plus the key-help paragraph inside `<div id="byok-rows">...</div>`.

The wrapped section should look like:

```html
      <div id="byok-rows">
        <div class="tl-setting-row">
          <span class="tl-setting-label">Base URL</span>
          <input type="text" id="baseUrl" placeholder="https://api.minimax.io/anthropic  or  https://api.minimax.io/v1">
        </div>
        <div class="tl-setting-row">
          <span class="tl-setting-label">Model</span>
          <input type="text" id="model" placeholder="MiniMax-M2.7 / claude-sonnet-4-6">
        </div>
        <div class="tl-setting-row">
          <span class="tl-setting-label">API Key</span>
          <input type="password" id="apiKey" placeholder="paste your key…" autocomplete="off">
        </div>
        <p class="tl-key-help">Stored only in your browser; sent only to the provider you choose, only when you run AI analysis.</p>
        <p class="tl-key-help">Changes apply after you reload the page.</p>
      </div>
```

- [ ] **Step 3: Update the AI hint text**

Find the `<div class="tl-ai-hint" id="ai-hint">` block and replace the inner span text:

```html
  <div class="tl-ai-hint" id="ai-hint">
    <span>⚡</span>
    <span>Using free shared AI (limited daily). Want unlimited? Pick 'My …key' and paste a key. <a id="get-key-link" href="https://platform.minimax.io/" target="_blank" rel="noopener">Get a free key</a>.</span>
  </div>
```

### Part B: popup.ts

- [ ] **Step 4: Add `toggleProviderFields()` and wire it**

In `src/popup/popup.ts`, add the `toggleProviderFields` function right before `wireSettings`:

```typescript
/** Show/hide BYOK rows and the proxy URL row depending on current provider mode. */
function toggleProviderFields() {
  const mode = (document.getElementById('providerMode') as HTMLSelectElement).value;
  const byokRows = document.getElementById('byok-rows') as HTMLElement;
  const proxyUrlRow = document.getElementById('proxy-url-row') as HTMLElement;
  if (mode === 'proxy') {
    byokRows.style.display = 'none';
    proxyUrlRow.style.display = '';
  } else {
    byokRows.style.display = '';
    proxyUrlRow.style.display = 'none';
  }
}
```

- [ ] **Step 5: Update `loadSettings` to populate `proxyUrl` and call `toggleProviderFields`**

In `loadSettings`, add after existing field assignments:

```typescript
  (document.getElementById('proxyUrl') as HTMLInputElement).value = s.proxyUrl ?? '';
```

And at the end of `loadSettings`, before the `ai-hint` logic, call:

```typescript
  toggleProviderFields();
```

Update the hint logic: show the hint only when the provider is BYOK and apiKey is empty, OR when proxy is configured (show only if proxy has no URL set). The spec says show the hint when BYOK mode with no key. For proxy mode with a URL set, it's working — no hint needed. Show hint when: `providerMode === 'proxy' && !proxyUrl` (proxy mode but no URL deployed yet) OR `providerMode !== 'proxy' && !apiKey` (BYOK but no key):

```typescript
  const needsSetup = s.providerMode === 'proxy' ? !s.proxyUrl : !s.apiKey;
  (document.getElementById('ai-hint') as HTMLElement).style.display = needsSetup ? 'flex' : 'none';
```

- [ ] **Step 6: Update `saveSettings` to include `proxyUrl`**

In `saveSettings`, add `proxyUrl` to the patch:

```typescript
      proxyUrl: (document.getElementById('proxyUrl') as HTMLInputElement).value,
```

- [ ] **Step 7: Update `wireSettings` to call `toggleProviderFields` on provider change**

In `wireSettings`, update the `providerSel.addEventListener('change', ...)` handler to also call `toggleProviderFields()`:

```typescript
  providerSel.addEventListener('change', () => {
    toggleProviderFields();
    const preset = PRESETS[providerSel.value];
    if (preset && preset.baseUrl !== undefined) {
      (document.getElementById('baseUrl') as HTMLInputElement).value = preset.baseUrl;
      (document.getElementById('model')   as HTMLInputElement).value = preset.model;
    }
    saveSettings();
  });
```

Update `PRESETS` to include proxy (with empty baseUrl and model; they aren't used in proxy mode):

```typescript
const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  'openai-compatible': { baseUrl: 'https://api.minimax.io/v1',        model: 'MiniMax-M2' },
  'anthropic':         { baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7' },
  'proxy':             { baseUrl: '',                                  model: '' },
};
```

- [ ] **Step 8: Update `wireSettings` to also save on `proxyUrl` input change**

The existing `querySelectorAll('input, select:not(#providerMode)')` will include `proxyUrl` automatically since it's a new `<input>` — verify this works; no separate wiring needed.

---

## Task 9: Update onboarding UI (`src/onboarding/onboarding.html` + `onboarding.ts`)

**Files:**
- Modify: `src/onboarding/onboarding.html`
- Modify: `src/onboarding/onboarding.ts`

### Part A: onboarding.html

- [ ] **Step 1: Update the provider select to three options**

Find:

```html
          <select id="providerMode" class="ob-select">
            <option value="anthropic">Anthropic-compatible (Anthropic, MiniMax)</option>
            <option value="openai-compatible" selected>OpenAI-compatible (MiniMax, OpenAI…)</option>
          </select>
```

Replace with:

```html
          <select id="providerMode" class="ob-select">
            <option value="proxy" selected>Free shared AI (no key needed)</option>
            <option value="openai-compatible">My OpenAI-compatible key (MiniMax/OpenAI)</option>
            <option value="anthropic">My Anthropic key</option>
          </select>
```

- [ ] **Step 2: Update the section heading and intro copy**

Find:

```html
      <h2 class="ob-section-heading">Enable AI analysis <span class="ob-optional-badge">optional</span></h2>
      <p class="ob-section-sub">Instant scoring works without any key. Add a key below only if you want deeper AI verdicts.</p>
```

Replace with:

```html
      <h2 class="ob-section-heading">AI analysis</h2>
      <p class="ob-section-sub">AI is on by default using a free shared tier (limited per day). For unlimited analysis, add your own API key.</p>
```

- [ ] **Step 3: Add the proxy URL field and wrap BYOK fields in a container**

After the providerMode `<div class="ob-field">`, add:

```html
        <!-- Proxy URL field: shown only in proxy mode -->
        <div class="ob-field" id="proxy-url-field" style="display:none">
          <label class="ob-label" for="proxyUrl">Proxy URL</label>
          <input type="text" id="proxyUrl" class="ob-input" placeholder="https://trulens-proxy.xxx.workers.dev">
        </div>

        <!-- BYOK fields: hidden in proxy mode -->
        <div id="byok-fields">
          <div class="ob-field">
            <label class="ob-label" for="baseUrl">Base URL</label>
            <input type="text" id="baseUrl" class="ob-input" placeholder="https://api.minimax.io/v1">
          </div>

          <div class="ob-field">
            <label class="ob-label" for="model">Model</label>
            <input type="text" id="model" class="ob-input" placeholder="MiniMax-M2">
          </div>

          <div class="ob-field">
            <label class="ob-label" for="apiKey">API Key</label>
            <input type="password" id="apiKey" class="ob-input" placeholder="Paste your key here…" autocomplete="off">
          </div>

          <p class="ob-key-note">
            Your key is stored only in your browser and sent exclusively to the provider you choose.
            <a href="https://platform.minimax.io/" target="_blank" rel="noopener noreferrer" class="ob-link">Get a free MiniMax key</a>.
          </p>
        </div>
```

Remove the original individual `ob-field` divs for baseUrl, model, apiKey and the `ob-key-note` paragraph (they are now inside `byok-fields`).

### Part B: onboarding.ts

- [ ] **Step 4: Add `toggleProviderFields()` to onboarding.ts**

Add this function before `wireProviderSelect`:

```typescript
function toggleProviderFields(): void {
  const mode = el<HTMLSelectElement>('providerMode').value;
  const byokFields = document.getElementById('byok-fields') as HTMLElement;
  const proxyUrlField = document.getElementById('proxy-url-field') as HTMLElement;
  if (mode === 'proxy') {
    byokFields.style.display = 'none';
    proxyUrlField.style.display = '';
  } else {
    byokFields.style.display = '';
    proxyUrlField.style.display = 'none';
  }
}
```

- [ ] **Step 5: Update `saveSettings` to include `proxyUrl`**

In `saveSettings`, add:

```typescript
    proxyUrl: (el<HTMLInputElement>('proxyUrl')).value,
```

- [ ] **Step 6: Update `loadSettings` to populate `proxyUrl` and call `toggleProviderFields`**

In `loadSettings`, after the existing field assignments, add:

```typescript
  const proxyUrlEl = document.getElementById('proxyUrl') as HTMLInputElement | null;
  if (proxyUrlEl) proxyUrlEl.value = s.proxyUrl ?? '';
  toggleProviderFields();
```

- [ ] **Step 7: Update `wireProviderSelect` to call `toggleProviderFields`**

In `wireProviderSelect`, update the event listener:

```typescript
  providerSel.addEventListener('change', () => {
    toggleProviderFields();
    const preset = PRESETS[providerSel.value];
    if (preset) {
      (el<HTMLInputElement>('baseUrl')).value = preset.baseUrl;
      (el<HTMLInputElement>('model')).value   = preset.model;
    }
    saveSettings();
  });
```

Update PRESETS in onboarding.ts to include proxy:

```typescript
const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  'openai-compatible': { baseUrl: 'https://api.minimax.io/v1',        model: 'MiniMax-M2' },
  'anthropic':         { baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7' },
  'proxy':             { baseUrl: '',                                  model: '' },
};
```

- [ ] **Step 8: Update `wireFieldSave` to include `proxyUrl`**

```typescript
function wireFieldSave(): void {
  const ids = ['baseUrl', 'model', 'apiKey', 'proxyUrl'] as const;
  for (const id of ids) {
    const elem = document.getElementById(id);
    if (elem) elem.addEventListener('change', saveSettings);
  }
}
```

---

## Task 10: Update documentation (`docs/PUBLISHING.md`, `docs/STORE_LISTING.md`, `PRIVACY.md`, `docs/privacy.html`)

**Files:**
- Modify: `docs/PUBLISHING.md`
- Modify: `docs/STORE_LISTING.md`
- Modify: `PRIVACY.md`
- Modify: `docs/privacy.html`

### PUBLISHING.md

- [ ] **Step 1: Add a note about the proxy and workers.dev permission to the "Common Rejection Reasons" section**

In the "Host permissions not sufficiently justified" subsection, add a bullet for `*.workers.dev`:

```
- The `*.workers.dev` permission is for the optional owner-hosted Cloudflare Worker proxy that provides the free shared-AI tier. It is used only when `providerMode` is `proxy` and only for POST requests to the `/v1/chat/completions` endpoint. Users who opt into BYOK mode never trigger this permission.
```

Also add to the "Pre-Submit Checklist" section a note:

```
- [ ] If the shared-AI proxy is deployed, `DEFAULT_PROXY_URL` in `src/types.ts` is set to the deployed URL and `npm run build` has been re-run
```

### STORE_LISTING.md

- [ ] **Step 2: Add a note about the optional proxy and update permission justifications**

In the "Detailed Description" section, after the "Optional AI deep analysis" paragraph, add:

```
**Free shared AI tier (optional)**
TruLens ships with a built-in free shared-AI tier. When the extension owner has deployed the included Cloudflare Worker proxy, AI deep analysis works out of the box with no API key required — subject to a daily rate limit. For unlimited analysis, switch to "My own key" mode in Settings and enter your own MiniMax or Anthropic API key.
```

In the "Permission Justifications" table, add:

```
| Host: `*.workers.dev` | The extension's service worker calls the owner-hosted Cloudflare Worker proxy when the free shared-AI tier is active. The proxy holds the owner's API key server-side; no key is transmitted from the extension. |
```

### PRIVACY.md

- [ ] **Step 3: Add a proxy-mode data-flow paragraph to PRIVACY.md**

In the "AI deep analysis — opt-in, bring-your-own-key" section, add a sub-heading and paragraph after the existing content:

```markdown
### Free shared-AI tier (proxy mode)

When the extension owner has deployed the included Cloudflare Worker proxy and set `DEFAULT_PROXY_URL`, the default provider mode is `proxy`. In this mode, review text is sent from your browser to the **owner's Cloudflare Worker** (not directly to MiniMax). The Worker forwards the request to MiniMax using the owner's server-side API key. **The owner's API key is never transmitted to your browser or included in the extension bundle.** The proxy does not log or store the review text; it only records a per-user per-day request count (keyed on an anonymous device UUID) in a Cloudflare KV namespace for rate-limiting purposes. No personal data is stored.
```

### docs/privacy.html

- [ ] **Step 4: Mirror the proxy-mode paragraph in docs/privacy.html**

In the `<h3>AI deep analysis &mdash; opt-in, bring-your-own-key</h3>` section (after the closing `<p>` for that section), add:

```html
    <h3>Free shared-AI tier (proxy mode)</h3>
    <p>When the extension owner has deployed the included Cloudflare Worker proxy, the default provider mode is <em>proxy</em>. In this mode, review text is sent from your browser to the <strong>owner's Cloudflare Worker</strong> (not directly to MiniMax). The Worker forwards the request to MiniMax using the owner's server-side API key. The owner's API key is never transmitted to your browser or included in the extension bundle. The proxy does not log or store review text; it only records a per-user per-day request count (keyed on an anonymous device UUID) in a Cloudflare KV namespace for rate-limiting purposes. No personal data is stored.</p>
```

Also add a row to the Permissions table:

```html
        <tr>
          <td><code>*.workers.dev</code></td>
          <td>Allow the extension service worker to call the owner-hosted Cloudflare Worker proxy when the free shared-AI tier is active. The proxy holds the owner's API key server-side; no key is transmitted from the extension.</td>
        </tr>
```

---

## Task 11: Final verification

- [ ] **Step 1: Run all tests**

```sh
cd /Users/mayurdas/Documents/projects/go/src/trulens && npm test
```

Expected: all tests pass. Count ≥ previous count + 4 (three new extractText/proxy tests + two new buildRequest proxy tests).

- [ ] **Step 2: Run the build**

```sh
cd /Users/mayurdas/Documents/projects/go/src/trulens && npm run build
```

Expected: exits 0; `dist/manifest.json` is produced.

- [ ] **Step 3: Verify `dist/manifest.json` host_permissions**

```sh
node -e "const m=JSON.parse(require('fs').readFileSync('dist/manifest.json','utf8')); console.log(m.host_permissions)"
```

Expected output should include `https://*.workers.dev/*` and should NOT include any leaked API keys.

- [ ] **Step 4: Verify the key is not in any built file**

```sh
grep -r "MINIMAX_API_KEY\|Bearer ey\|Bearer mm" /Users/mayurdas/Documents/projects/go/src/trulens/dist/ 2>/dev/null || echo "Clean — no key found in dist"
```

Expected: `Clean — no key found in dist`

---

## Self-Review Against Spec

### Spec Section Coverage

| Spec Section | Task(s) Covering It |
|---|---|
| §1 Cloudflare Worker (CORS, rate limit, KV, MiniMax forward, secret) | Task 1 |
| §1 wrangler.toml | Task 1 Step 2 |
| §1 README.md deploy steps | Task 1 Step 3 |
| §2 `clientId()` helper | Task 3 Step 1 |
| §2 `buildRequest` proxy with clientHeader | Task 3 Steps 2–3 |
| §2 `extractText` proxy = OpenAI shape | Task 3 Step 4 |
| §2 runDeepAnalysis/runBatchAnalysis/testConnection 429 handling | Task 3 Steps 5–7 |
| §3 `DEFAULT_PROXY_URL` constant | Task 2 |
| §3 `DEFAULT_SETTINGS` providerMode='proxy' | Task 2 |
| §4 providerReady check in content/index.ts | Existing code already correct — verified in Task 5 step |
| §4 quota error surface in deepAnalyze | Task 5 |
| §4 background returns `{ok:false,error:'quota'}` | Task 4 |
| §5 host_permissions *.workers.dev | Task 6 |
| §6 Three-option provider select (popup) | Task 8 |
| §6 toggleProviderFields (popup) | Task 8 |
| §6 proxyUrl row in popup | Task 8 |
| §6 Three-option provider select (onboarding) | Task 9 |
| §6 toggleProviderFields (onboarding) | Task 9 |
| §6 onboarding copy update | Task 9 |
| §6 hint text update | Task 8 |
| §7 PUBLISHING.md, STORE_LISTING.md, PRIVACY.md, privacy.html | Task 10 |
| Verify: tests pass + new tests | Task 7 + Task 11 |
| Verify: build green | Task 11 |
| Security: key never in extension | Worker holds key as secret; Task 11 Step 4 verifies |

### Security Invariants

- `MINIMAX_API_KEY` is only referenced in `proxy/worker.ts` as `env.MINIMAX_API_KEY` — it is never assigned a value in any committed file.
- `DEFAULT_PROXY_URL` defaults to `''` — when empty, `buildRequest` returns `url: ''` and no real fetch is attempted (the fetch will fail with a network error, not leak a key).
- `wrangler.toml` never contains the key (it is set via `wrangler secret put`).
- The extension sends zero auth headers in proxy mode — only `content-type` and `x-trulens-client` (a random UUID).
