# TruLens AWS Proxy — Deploy Guide

Deploys the free shared-AI tier as an **AWS Lambda Function URL + DynamoDB** stack using AWS SAM.
The MiniMax API key is a deploy-time parameter (Lambda environment variable) — it is never committed to the repo or bundled in the extension.

---

## Prerequisites

- An AWS account with sufficient permissions to create Lambda functions, DynamoDB tables, and IAM roles.
- **AWS CLI** configured: run `aws configure` and enter your access key, secret, and preferred region.
- **AWS SAM CLI** installed:
  - macOS: `brew install aws-sam-cli`
  - Other: `pip install aws-sam-cli` or see https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

---

## Deploy steps

### 1. Rotate your MiniMax API key first

Before deploying to a public endpoint, generate a fresh key in the MiniMax console. **Never commit a key to the repo.** If you used a key during local development, rotate it now.

### 2. Navigate to this directory

```sh
cd proxy/aws
```

### 3. Build the Lambda package

```sh
sam build
```

SAM resolves dependencies and prepares the deployment artifact in `.aws-sam/`.

### 4. Deploy (first time — guided)

```sh
sam deploy --guided
```

When prompted:

| Prompt | What to enter |
|---|---|
| Stack name | `trulens-proxy` (or any name you like) |
| AWS Region | your preferred region (e.g. `us-east-1`) |
| `MinimaxApiKey` | your **rotated** MiniMax API key — this field is NoEcho, so it will not echo to the terminal and will not be saved to `samconfig.toml` |
| `DailyLimit` | accept the default (`40`) or enter a different per-user per-day limit |
| `Model` | accept the default (`MiniMax-M2`) or enter another MiniMax model ID |
| Save config to `samconfig.toml` | **Yes** — saves region, stack name, and S3 bucket for future deploys |
| Deploy changeset | `y` to confirm |

> **Note:** `samconfig.toml` stores your deployment parameters for convenience. The `MinimaxApiKey` parameter is marked `NoEcho` in the SAM template, so SAM does not write it to `samconfig.toml`. However, review that file before committing — verify no secrets crept in through other means. The key is stored only in the Lambda environment (encrypted at rest by AWS).

### 5. Copy the `ProxyUrl` output

After a successful deploy, SAM prints outputs including:

```
ProxyUrl    https://<id>.lambda-url.<region>.on.aws/
```

Copy that URL.

### 6. Wire the URL into the extension

Open `src/types.ts` and set:

```typescript
export const DEFAULT_PROXY_URL = 'https://<id>.lambda-url.<region>.on.aws/';
```

Then rebuild and repackage:

```sh
npm run build
npm run package
```

---

## Subsequent deploys

Once `samconfig.toml` exists, future deploys skip the guided prompts:

```sh
sam build && sam deploy
```

To change `DailyLimit` without touching code:

```sh
sam deploy --parameter-overrides DailyLimit=60
```

You will be prompted for `MinimaxApiKey` again each time because it is NoEcho and not stored in `samconfig.toml`.

---

## How the proxy works

- The extension sends a POST with an OpenAI-style body (`{ model, max_tokens, messages }`) and an `x-trulens-client` header containing a stable per-device UUID.
- Lambda reads the UUID and the current UTC date to form a rate-limit key, then atomically increments a counter in DynamoDB. If the count exceeds `DAILY_LIMIT`, the function returns HTTP 429 with `{ "error": "daily_limit" }`.
- Approved requests are forwarded to `https://api.minimax.io/v1/chat/completions` using the server-side `MINIMAX_API_KEY`. The model is forced to the value of `MODEL` regardless of what the client sends, controlling cost.
- MiniMax's JSON response is returned verbatim with CORS headers and an `X-RateLimit-Remaining` header.
- DynamoDB entries have a 2-day TTL (`exp` attribute) so counters expire automatically.

---

## Cost

Lambda and DynamoDB are effectively free at light usage levels. Both services have generous free tiers, and the PAY_PER_REQUEST DynamoDB billing mode means you pay only for actual reads/writes. At 40 requests/user/day with a modest user base, monthly costs are typically pennies.

---

## Rate-limit details

- Per user (anonymous device UUID), per day (UTC).
- Default: 40 requests / day. Adjust by redeploying with a new `DailyLimit`.
- Users who want unlimited analysis can switch to BYOK mode in Settings (choose "My own key" and enter their MiniMax or Anthropic key).
