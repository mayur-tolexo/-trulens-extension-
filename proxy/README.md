# TruLens Proxy — Free Shared-AI Tier

A rate-limited, server-side MiniMax proxy that powers the free shared-AI tier.
The MiniMax API key lives only as a server-side secret — it is never committed to the repo or shipped in the extension bundle.

---

## Option 1 — AWS Lambda + DynamoDB (recommended)

The preferred deployment uses **AWS SAM** to deploy a Lambda Function URL backed by a DynamoDB rate-limit table.

- Source: `proxy/aws/index.mjs` (Lambda handler, Node 20)
- Infrastructure: `proxy/aws/template.yaml` (SAM template — DynamoDB PAY_PER_REQUEST + Lambda Function URL, AuthType NONE)
- Deploy guide: [`proxy/aws/README.md`](aws/README.md)

**Key facts:**
- The `MinimaxApiKey` SAM parameter is `NoEcho` and is stored as a Lambda environment variable (encrypted at rest). It is never written to `samconfig.toml` or the repo.
- Rate-limiting uses DynamoDB atomic counters with a 2-day TTL. Default: 40 requests per user per UTC day.
- The deployed Function URL looks like `https://<id>.lambda-url.<region>.on.aws/`. Paste it into `DEFAULT_PROXY_URL` in `src/types.ts` and rebuild.
- The extension's host permission for this URL is `https://*.on.aws/*`.

---

## Option 2 — Cloudflare Workers (alternative)

A Cloudflare Worker alternative is available for owners who already have a Cloudflare account.

- Source: `proxy/worker.ts`
- Configuration: `proxy/wrangler.toml`

Deploy with Wrangler:

```sh
npm i -g wrangler
wrangler login
wrangler kv namespace create RL   # copy the id into wrangler.toml
wrangler secret put MINIMAX_API_KEY
wrangler deploy
```

The Worker stores rate-limit counters in a Cloudflare KV namespace (48-hour TTL). The deployed URL ends in `.workers.dev`. Set it as `DEFAULT_PROXY_URL` in `src/types.ts` and change the host permission in `manifest.config.ts` from `https://*.on.aws/*` to `https://*.workers.dev/*`.

---

## How both options behave

- The extension sends a POST with an OpenAI-style body (`{ model, max_tokens, messages }`) and an `x-trulens-client` header containing a stable per-device UUID.
- The proxy reads the UUID and the current UTC date to form a rate-limit key, checks/increments a counter, and rejects with HTTP 429 if the daily limit is exceeded.
- Approved requests are forwarded to `https://api.minimax.io/v1/chat/completions` with the server-side API key. The model is forced server-side to `MiniMax-M2` (or the `MODEL` env var), controlling cost.
- MiniMax's response is returned verbatim with CORS headers.
- Default daily limit: **40 requests per user per UTC day**.
- Users wanting unlimited analysis can switch to BYOK mode in Settings.
