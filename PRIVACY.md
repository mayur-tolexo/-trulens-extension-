# TruLens — Privacy Policy

**Last updated: 2026-05-31**

---

## What TruLens Does

TruLens is a browser extension that scores how genuine product and place reviews are on Amazon, Flipkart, and Google Maps. It attaches a colored badge and a 0–100 score to each visible review, and shows an overall trust summary in an on-page panel and the toolbar popup.

---

## Data Processing and Privacy

### Local heuristic scoring — no data leaves your device

The core scoring engine runs entirely inside your browser. When TruLens reads reviews on a supported page, it analyzes the text and metadata using built-in heuristic rules (signal detection, sentiment analysis, pattern matching). This process happens locally, in-process, with no network requests. No review text, no page content, no identifiers, and no behavioral data are transmitted to any server operated by TruLens or any third party.

### AI deep analysis — opt-in, bring-your-own-key

TruLens offers an optional "deep analysis" feature that sends a review to a large-language-model (LLM) provider for a more detailed genuineness verdict. This feature is **disabled by default** and only activates when you:

1. Open the TruLens popup, navigate to Settings, and enter your own API key for a provider (MiniMax, OpenAI, Anthropic, or an OpenAI-compatible endpoint such as OpenRouter).
2. Enable the AI analysis toggle.

When both conditions are met and you click "Deep analysis" on a specific review, TruLens will send the text of that review — plus a small number of sibling reviews from the same page to provide context — directly from your browser to the API endpoint of the provider you chose. That request is authenticated with the API key you supplied. **No review text is sent anywhere if AI analysis is disabled or if you have not entered an API key.**

TruLens itself has no server. It does not act as a middleman for these API calls; the request goes from your browser directly to your chosen provider.

### Free shared-AI tier (proxy mode)

When the extension owner has deployed the included Cloudflare Worker proxy and set `DEFAULT_PROXY_URL`, the default provider mode is `proxy`. In this mode, review text is sent from your browser to the **owner's Cloudflare Worker** (not directly to MiniMax). The Worker forwards the request to MiniMax using the owner's server-side API key. **The owner's API key is never transmitted to your browser or included in the extension bundle.** The proxy does not log or store the review text; it only records a per-user per-day request count (keyed on an anonymous device UUID) in a Cloudflare KV namespace for rate-limiting purposes. No personal data is stored.

---

## What Is Stored Locally

TruLens uses `chrome.storage.local` (browser-local extension storage) to persist:

- **Your settings** — provider choice, whether AI analysis is on or off, any UI preferences.
- **Your API key** — stored only in local extension storage on your own device. It is never transmitted to TruLens or any party other than the provider you selected.
- **AI result cache** — to avoid sending the same review to an LLM provider more than once, TruLens caches verdicts locally. Cached data never leaves your device.

All of this data lives solely in your browser's extension storage. It is not synced to any TruLens server; it is not included in browser sync unless you have enabled extension-storage sync at the browser level (browser behavior outside TruLens's control).

---

## What TruLens Does Not Do

- TruLens has **no backend server** and **no analytics pipeline**.
- TruLens does **not collect** browsing history, page URLs, user identifiers, or any personal data.
- TruLens does **not transmit** anything to its developer.
- TruLens does **not sell** any data.
- TruLens does **not use remote code execution**. All extension logic is bundled in the installed package (Manifest V3, no `eval`, no remote scripts).

---

## Third-Party AI Providers

If you choose to enable AI deep analysis, the text of the reviews you analyze will be processed by the LLM provider you configured. TruLens has no control over how those providers handle data. Please review the privacy policy of your chosen provider before enabling this feature:

- **MiniMax:** https://www.minimaxi.com/privacy-policy
- **OpenAI:** https://openai.com/policies/privacy-policy
- **Anthropic:** https://www.anthropic.com/privacy
- **OpenRouter:** https://openrouter.ai/privacy

---

## Permissions Explanation

| Permission | Why it is needed |
|---|---|
| `storage` | Save your settings and cache AI results locally in the browser. |
| Host permission: `*.amazon.com`, `*.amazon.in` | Read review content on Amazon product pages and inject genuineness badges. |
| Host permission: `*.flipkart.com` | Read review content on Flipkart product pages and inject genuineness badges. |
| Host permission: `www.google.com/maps` | Read review content on Google Maps place pages and inject genuineness badges. |
| Host permission: `api.minimax.io`, `api.minimaxi.com` | Allow the extension service worker to call MiniMax directly when AI analysis is enabled with a MiniMax key. |
| Host permission: `api.anthropic.com` | Allow the extension service worker to call Anthropic directly when AI analysis is enabled with an Anthropic key. |
| Host permission: `api.openai.com` | Allow the extension service worker to call OpenAI directly when AI analysis is enabled with an OpenAI key. |
| Host permission: `openrouter.ai` | Allow the extension service worker to call OpenRouter directly when AI analysis is enabled with an OpenRouter key. |

---

## How to Disable AI Analysis or Clear Stored Data

**To disable AI analysis:** Open the TruLens toolbar popup → Settings → toggle AI Analysis off. No further review text will be sent to any provider.

**To remove your API key and cached data:** Open the TruLens toolbar popup → Settings → "Reset to defaults". This clears all locally stored settings and cached AI results from `chrome.storage.local`.

**To uninstall TruLens entirely:** Remove the extension from `chrome://extensions`. Chrome will delete all associated extension storage, including your API key and cache.

---

## Children's Privacy

TruLens does not knowingly collect any information from anyone, including children. Because no personal data is collected at all, no special provisions for children's data apply.

---

## Changes to This Policy

If this policy changes materially, the "Last updated" date at the top of this document will be updated. The policy is versioned alongside the extension in its source repository.

---

## Contact

If you have questions or concerns about this privacy policy, please contact: **[your-email@example.com]** *(replace with the developer's actual contact address before publishing).*
