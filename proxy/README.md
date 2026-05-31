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
