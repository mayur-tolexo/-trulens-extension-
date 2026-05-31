# TruLens AWS Proxy — Deploy Guide

Deploys the free shared-AI tier as an **AWS Lambda + DynamoDB + API Gateway HTTP API** stack.
The MiniMax API key is passed at deploy time as an environment variable — it is never committed to the repo or bundled in the extension.

---

## Recommended method — `deploy.py` (boto3)

`deploy.py` is a self-contained boto3 script that creates (or updates) all resources directly via the AWS SDK. It does not require the AWS SAM CLI, which can be broken by Homebrew Python issues on macOS.

### 1. Rotate your MiniMax API key first

Before deploying to a public endpoint, generate a fresh key in the MiniMax console. **Never commit the key to the repo.** If you used a key during local development, rotate it now.

### 2. Set up a Python virtual environment

The system Python (`/usr/bin/python3`) works reliably on macOS; Homebrew's python may be broken if SAM was previously installed. Use whichever `python3` resolves cleanly:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install boto3
```

### 3. Set environment variables

```sh
export AWS_ACCESS_KEY_ID=<your-key-id>
export AWS_SECRET_ACCESS_KEY=<your-secret>
export AWS_DEFAULT_REGION=us-east-1
export MINIMAX_API_KEY=<your-rotated-minimax-key>
export DAILY_LIMIT=40          # requests per user per UTC day (optional, default 40)
export MODEL=MiniMax-M2        # MiniMax model ID (optional, default MiniMax-M2)
```

### 4. Run the script

```sh
cd proxy/aws
python deploy.py
```

`deploy.py` creates (or updates) the following resources:

| Resource | Name |
|---|---|
| DynamoDB table | `trulens-rl` (PAY_PER_REQUEST, 2-day TTL on `exp`) |
| IAM role | `trulens-proxy-role` |
| Lambda function | `trulens-proxy` (Node 20, source `index.mjs`) |
| API Gateway HTTP API | attached to the Lambda, route `POST /` |

On success the script prints:

```
PROXY_URL=https://<id>.execute-api.us-east-1.amazonaws.com/
```

The script is **idempotent** — safe to re-run to update Lambda code or environment variables (e.g. to change `DAILY_LIMIT` or rotate `MINIMAX_API_KEY`).

### 5. Wire the URL into the extension

`DEFAULT_PROXY_URL` in `src/types.ts` is already set for the current live deployment. If you are redeploying with a new URL, open `src/types.ts` and update:

```typescript
export const DEFAULT_PROXY_URL = 'https://<id>.execute-api.us-east-1.amazonaws.com/';
```

Then rebuild and repackage:

```sh
npm run build
npm run package
```

### Security notes

- Pass `MINIMAX_API_KEY` only via the environment variable — never hardcode it or commit it.
- After a successful deploy you can delete the AWS access key used for deployment. The Lambda runs under its own IAM role (`trulens-proxy-role`) and does not need your user credentials at runtime.
- To rotate the key: re-run `deploy.py` with the new `MINIMAX_API_KEY` in the environment. The script updates the Lambda environment variables on re-run.

---

## Alternative method — AWS SAM (`template.yaml`)

`template.yaml` is an AWS SAM template. Use this if you have a working SAM CLI installation.

### Prerequisites

- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed: `brew install aws-sam-cli` or see https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

### Deploy steps

```sh
cd proxy/aws
sam build
sam deploy --guided
```

When prompted, enter your rotated `MinimaxApiKey` (this field is `NoEcho` — it will not echo to the terminal and will not be saved to `samconfig.toml`). Accept the defaults for stack name, region, `DailyLimit`, and `Model`, or customise as needed. Save the config to `samconfig.toml` to skip `--guided` on future deploys.

After a successful deploy, SAM prints the `ProxyUrl` output. Wire it into `src/types.ts` as described above.

> **Note:** `samconfig.toml` stores deployment parameters for convenience. The `MinimaxApiKey` is `NoEcho` and will not appear there, but review the file before committing to ensure no secrets crept in through other means.

---

## How the proxy works

- The extension sends a POST with an OpenAI-style body (`{ model, max_tokens, messages }`) and an `x-trulens-client` header containing a stable per-device UUID.
- The Lambda reads the UUID and the current UTC date to form a rate-limit key, then atomically increments a counter in DynamoDB. If the count exceeds `DAILY_LIMIT`, the function returns HTTP 429 with `{ "error": "daily_limit" }`.
- Approved requests are forwarded to `https://api.minimax.io/v1/chat/completions` using the server-side `MINIMAX_API_KEY`. The model is forced to the value of `MODEL` regardless of what the client sends, controlling cost.
- MiniMax's JSON response is returned verbatim with CORS headers and an `X-RateLimit-Remaining` header.
- DynamoDB entries have a 2-day TTL (`exp` attribute) so counters expire automatically.

---

## Cost

Lambda and DynamoDB are effectively free at light usage levels. Both services have generous free tiers, and the PAY_PER_REQUEST DynamoDB billing mode means you pay only for actual reads/writes. API Gateway HTTP API pricing is also minimal. At 40 requests/user/day with a modest user base, monthly costs are typically pennies.

---

## Rate-limit details

- Per user (anonymous device UUID), per day (UTC).
- Default: 40 requests / day. Adjust by re-running `deploy.py` with a new `DAILY_LIMIT` env var (the script updates Lambda environment variables on re-run).
- Users who want unlimited analysis can switch to BYOK mode in Settings (choose "My own key" and enter their MiniMax or Anthropic key).
