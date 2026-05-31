# TruLens — Privacy Policy

**Last updated: 2026-05-31**

---

## What TruLens Does

TruLens is a browser extension that scores how genuine place reviews are on **Google Maps** (v1). It attaches a colored shield badge and a 0–100 score to each visible review, and displays an overall trust summary in an on-page panel and the toolbar popup. Support for Amazon and Flipkart is planned for a future release.

---

## Data Processing and Privacy

### Local heuristic scoring — no data leaves your device

The core scoring engine runs entirely inside your browser. When TruLens reads reviews on a Google Maps place page, it analyzes the text and metadata using built-in heuristic rules (signal detection, sentiment analysis, pattern matching). This process happens locally, in-process, with no network requests. No review text, no page content, no identifiers, and no behavioral data are transmitted to any server operated by TruLens or any third party.

### AI deep analysis — opt-in

TruLens offers an optional "deep analysis" feature that sends a review to a large-language-model (LLM) provider for a more detailed genuineness verdict. This feature is **disabled by default** and only activates when it is enabled and configured (see tiers below).

When AI analysis runs and you click "Deep analysis" on a specific review, TruLens will send the text of that review — plus a small number of sibling reviews from the same page to provide context — to an AI provider. **No review text is sent anywhere if AI analysis is disabled or not configured.**

#### Free shared-AI tier (proxy mode — default when deployed)

The extension's default `providerMode` is `proxy`. When the extension owner has deployed the included AWS Lambda proxy (in `proxy/aws/`) and set `DEFAULT_PROXY_URL` in `src/types.ts`, AI deep analysis works without a user API key. In this mode:

- Review text is sent from your browser to the **owner's AWS Lambda Function URL** (not directly to MiniMax).
- The Lambda function forwards the request to MiniMax using the **owner's server-side API key**. That key is stored as a Lambda environment variable (encrypted at rest by AWS); it is never transmitted to your browser or included in the extension bundle.
- The proxy does **not** log or store review text. It records only a per-user per-day request count (keyed on an anonymous device UUID stored in your browser's local extension storage) in a DynamoDB table for rate-limiting purposes. This counter contains no personal data and expires automatically after 2 days.
- The default daily limit is **40 requests per user per day** (UTC). Once reached, additional requests are rejected with an HTTP 429 response until the next UTC day.
- If `DEFAULT_PROXY_URL` is empty (the default in the source repository), the free tier is dormant — no proxy requests are made and no error is shown; AI analysis simply remains unavailable until a key is added or the owner deploys the proxy.

#### Bring-your-own-key (BYOK) mode

You can switch to BYOK mode in Settings and paste your own API key for:

- **MiniMax** (OpenAI-compatible) — default base URL `https://api.minimax.io/v1`, model `MiniMax-M2`
- **Anthropic** — uses `https://api.anthropic.com`

When both BYOK mode is selected, a key is entered, and AI analysis is enabled, review text is sent **directly from your browser to the API endpoint of the provider you chose**, authenticated with your key. TruLens is not a middleman; the request does not pass through any TruLens server.

---

## What Is Stored Locally

TruLens uses `chrome.storage.local` (browser-local extension storage) to persist:

- **Your settings** — provider mode, whether AI analysis is on or off, any UI preferences.
- **Your API key** (BYOK mode) — stored only in local extension storage on your own device. Never transmitted to TruLens or any party other than the provider you selected.
- **AI result cache** — to avoid sending the same review to an LLM provider more than once, TruLens caches verdicts locally. Cached data never leaves your device.
- **Per-place summaries** — trust scores and breakdowns for previously visited places, so revisits render instantly and only new reviews are re-scanned.
- **Anonymous device UUID** — a random identifier generated locally, used only as a rate-limit key for the free proxy tier. It is not linked to your identity or browsing activity.

All of this data lives solely in your browser's extension storage. It is not synced to any TruLens server. Clicking "Reset to defaults" in Settings clears all stored data from `chrome.storage.local`.

---

## What TruLens Does Not Do

- TruLens has **no backend server** and **no analytics pipeline**.
- TruLens does **not collect** browsing history, page URLs, user identifiers, or any personal data.
- TruLens does **not transmit** anything to its developer.
- TruLens does **not sell** any data.
- TruLens does **not use remote code execution**. All extension logic is bundled in the installed package (Manifest V3, no `eval`, no remote scripts).

---

## Third-Party AI Providers

If you choose to enable AI deep analysis, the text of the reviews you analyze will be processed by the LLM provider involved. TruLens has no control over how those providers handle data. Please review the privacy policy of the relevant provider before enabling this feature:

- **MiniMax:** https://www.minimaxi.com/privacy-policy
- **Anthropic:** https://www.anthropic.com/privacy

---

## Permissions Explanation

| Permission | Why it is needed |
|---|---|
| `storage` | Save your settings, API key, and cached AI results locally in the browser. |
| Host permission: `https://www.google.com/maps/*` | Read review content on Google Maps place pages and inject genuineness badges. This is the extension's core function. |
| Host permission: `https://api.minimax.io/*` | Allow the extension service worker to call MiniMax when AI analysis is enabled with an OpenAI-compatible (e.g., MiniMax) key. |
| Host permission: `https://api.anthropic.com/*` | Allow the extension service worker to call Anthropic when AI analysis is enabled with an Anthropic key. |
| Host permission: `https://*.on.aws/*` | Allow the extension service worker to call the owner-hosted AWS Lambda Function URL when the free shared-AI tier is active. The proxy holds the owner's API key server-side (Lambda env var); no key is transmitted from the extension. |

---

## How to Disable AI Analysis or Clear Stored Data

**To disable AI analysis:** Open the TruLens toolbar popup → Settings → toggle AI Analysis off. No further review text will be sent to any provider.

**To remove your API key and cached data:** Open the TruLens toolbar popup → Settings → "Reset to defaults". This clears all locally stored settings, cached AI results, and per-place summaries from `chrome.storage.local`.

**To uninstall TruLens entirely:** Remove the extension from `chrome://extensions`. Chrome will delete all associated extension storage, including your API key and cache.

---

## Children's Privacy

TruLens does not knowingly collect any information from anyone, including children. Because no personal data is collected at all, no special provisions for children's data apply.

---

## Changes to This Policy

If this policy changes materially, the "Last updated" date at the top of this document will be updated. The policy is versioned alongside the extension in its source repository.

---

## Contact

If you have questions or concerns about this privacy policy, please contact: **mayur.das4@gmail.com**
