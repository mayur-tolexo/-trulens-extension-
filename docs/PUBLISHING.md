# Chrome Web Store — Publishing Checklist

Step-by-step upload guide for TruLens v1.0.0. Complete every step in order.

---

## Step 0 — Decide Your AI Tier

**Option A — BYOK-only (ship now, no server needed)**
The current build ships as-is. AI deep analysis is dormant until a user adds their own API key in Settings. No proxy deployment required.

**Option B — Free shared AI (requires proxy deployment first)**
You host a Cloudflare Worker that holds your MiniMax key server-side. Users get up to 40 free AI analyses per day without entering a key. Continue to Step 1 if choosing this option; skip to Step 2 if choosing Option A.

---

## Step 1 — (Tier B only) Deploy the Cloudflare Worker Proxy

> **Security:** Use a freshly rotated MiniMax key. NEVER commit the key to the repo. If you used a key during development, rotate it now before go-live.

```sh
cd proxy
npm i -g wrangler          # install Wrangler CLI (if not already)
wrangler login             # authenticate to Cloudflare
```

**1a. Create the KV namespace:**
```sh
wrangler kv namespace create RL
```
Copy the printed `id` value. Open `proxy/wrangler.toml` and replace `REPLACE_WITH_KV_ID` with it:
```toml
[[kv_namespaces]]
binding = "RL"
id = "PASTE_YOUR_ID_HERE"       # ← PLACEHOLDER: fill this in
```

**1b. Set the API key as a Cloudflare secret (never committed):**
```sh
wrangler secret put MINIMAX_API_KEY
```
Paste your fresh (rotated) MiniMax key at the prompt.

**1c. Deploy the Worker:**
```sh
wrangler deploy
```
Note the deployed URL printed at the end, e.g. `https://trulens-proxy.<your-subdomain>.workers.dev`.

**1d. Wire the URL into the extension:**
Open `src/types.ts` and set:
```typescript
export const DEFAULT_PROXY_URL = 'https://trulens-proxy.<your-subdomain>.workers.dev';
```

---

## Step 2 — Build & Package

From the repository root:

```sh
npm install           # first time only
npm run build         # compiles TypeScript, bundles assets → dist/
npm run package       # zips dist/ → trulens-v1.0.0.zip
```

Verify the zip contains:
- `manifest.json` at the root
- All bundled JS/CSS/HTML assets
- Icon files: `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
- **No** API keys, `.env` files, or source maps

---

## Step 3 — Generate / Refresh Store Assets

```sh
npm run screenshots   # captures screenshots from ./screenshots/ → store-assets/screenshots/01–06-store.png
npm run icons         # generates icon PNGs + promo tile from source SVG/canvas
```

Verify:
- `public/icon-128.png` exists (128×128 px)
- `store-assets/promo-440x280.png` exists (440×280 px)
- `store-assets/screenshots/01-store.png` through `06-store.png` exist (1280×800 px each)

---

## Step 4 — Host the Privacy Policy

The Chrome Web Store requires a publicly accessible privacy-policy URL before submission.

1. Push the repo to GitHub (if not already): https://github.com/mayur-tolexo/-trulens-extension-
2. Enable GitHub Pages: **Settings → Pages → Source: Deploy from branch → `main` → `/docs`**
3. Wait for Pages to publish (usually under 1 minute).
4. The policy URL will be:
   ```
   https://<your-github-username>.github.io/<repo-name>/privacy.html
   ```
   > **PLACEHOLDER:** Replace `<your-github-username>` and `<repo-name>` with your actual values.
5. Open that URL in a browser to confirm it renders.
6. Update the `<!-- Hosted at -->` notice at the top of `docs/privacy.html` with the actual URL.

---

## Step 5 — Register a Chrome Web Store Developer Account

1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with the Google account that will own the listing.
3. Pay the one-time **$5 USD** developer registration fee.
4. Accept the Developer Program Policies.

---

## Step 6 — Create Item & Upload the Zip

1. In the Developer Dashboard, click **"New item"**.
2. Upload `trulens-v1.0.0.zip`.
3. The store parses `manifest.json` and pre-fills name (`TruLens — Review Genuineness`) and version (`1.0.0`).

---

## Step 7 — Fill the Store Listing

Copy from `docs/STORE_LISTING.md` into the dashboard fields:

| Dashboard field | Value |
|---|---|
| **Title** | TruLens — Review Genuineness |
| **Short description** (≤ 132 chars) | See "Short Summary" in STORE_LISTING.md |
| **Detailed description** | See "Detailed Description" block in STORE_LISTING.md |
| **Category** | Productivity |
| **Language** | English |
| **Search terms** | fake review detector, review authenticity, review checker, Google Maps reviews, genuine reviews |

---

## Step 8 — Upload Graphics

| Asset | Size | File |
|---|---|---|
| Store icon | 128×128 px | `public/icon-128.png` |
| Screenshots (upload 1–5) | 1280×800 px each | `store-assets/screenshots/01–05-store.png` — see recommended order below |
| Promotional tile | 440×280 px | `store-assets/promo-440x280.png` |

**Recommended screenshot order (most impactful first):**
1. `01-store.png` — on-page trust panel (hero)
2. `02-store.png` — red "Likely fake" badges on suspicious reviews
3. `04-store.png` — toolbar popup trust summary
4. `03-store.png` — green "Likely genuine" badge
5. `05-store.png` — Settings panel (free shared AI + BYOK)

---

## Step 9 — Privacy Practices Tab

**Single-purpose statement:**
> TruLens scores how genuine place reviews are on Google Maps, by running on-device heuristic analysis and optional user-initiated AI deep analysis using the user's own API key or a free owner-hosted proxy.

**Permission justifications** (paste into each field):

| Permission | Justification |
|---|---|
| `storage` | Used to save the user's settings (provider choice, AI on/off toggle, UI preferences) and to cache AI verdicts locally so the same review is not re-analyzed. No data is sent to any server. |
| Host: `https://www.google.com/maps/*` | The extension's content script must read review text and metadata from Google Maps place pages in order to compute genuineness scores and inject shield badges beside each review. This is the extension's entire core function. |
| Host: `https://api.minimax.io/*` | The extension's service worker calls MiniMax when the user opts into AI deep analysis with a MiniMax-compatible key (BYOK mode). No calls are made unless the user has explicitly entered a key and enabled AI analysis. |
| Host: `https://api.anthropic.com/*` | The extension's service worker calls Anthropic when the user opts into AI deep analysis with an Anthropic key (BYOK mode). No calls are made unless the user has explicitly entered a key and enabled AI analysis. |
| Host: `https://*.workers.dev/*` | The extension calls the owner-hosted Cloudflare Worker proxy when the free shared-AI tier is active. The proxy holds the owner's API key server-side; no key is bundled in or transmitted from the extension. Only used for POST requests to the AI proxy endpoint. |

**Data-usage disclosures:**
- The extension transmits the text of user-selected review(s) — plus a small number of sibling reviews on the same page for context — to the user's chosen AI provider (BYOK) or to the owner's Cloudflare Worker proxy (free tier), solely to compute a genuineness score. No other data is collected or transmitted.
- The extension does **not** collect personal data, does **not** sell data, and does **not** use data for any purpose unrelated to computing review genuineness scores.
- The proxy stores only a per-user per-day request counter (keyed on an anonymous device UUID) for rate-limiting; it does **not** store review text.

**Privacy policy URL:** paste the live URL from Step 4.

---

## Step 10 — Distribution & Submit

1. **Visibility:** Public (to list in the Chrome Web Store) or Unlisted (shareable link only — useful for beta).
2. **Regions:** All regions, or restrict as needed.
3. Click **"Submit for review"**.

Typical review time: 1–3 business days for new items.

---

## Pre-Submit Checklist

Go through every item before clicking "Submit for review":

- [ ] `npm run build` completes without errors
- [ ] `npm run package` produces `trulens-v1.0.0.zip` with `manifest.json` at the root
- [ ] Zip loads correctly via `chrome://extensions → Load unpacked` (unzip first) — no console errors
- [ ] `manifest.json` version is `1.0.0`
- [ ] All four icon sizes present: `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
- [ ] Store icon `public/icon-128.png` ready (128×128 px)
- [ ] Promo tile `store-assets/promo-440x280.png` ready (440×280 px)
- [ ] At least one screenshot (1280×800 px) showing badges on a real Google Maps Reviews tab is ready
- [ ] Build is fresh — if you set `DEFAULT_PROXY_URL` in Step 1d, `npm run build` has been re-run after that change
- [ ] Zip contains no API key (verify by unzipping and grepping)
- [ ] Privacy policy page is live at the chosen URL and loads without errors in the browser
- [ ] The URL notice placeholder in `docs/privacy.html` has been replaced with the actual hosted URL
- [ ] Privacy policy URL is entered in the store listing
- [ ] Contact email placeholder `[your-email@example.com]` in `PRIVACY.md` and `docs/privacy.html` replaced with your real address
- [ ] Single-purpose statement filled in on the Privacy practices tab
- [ ] All five permission justifications filled in (storage + 4 host permissions)
- [ ] No unhandled `console.error` or promise rejections on a normal page load
- [ ] KV namespace `id` in `proxy/wrangler.toml` is set (Tier B only) — `REPLACE_WITH_KV_ID` placeholder removed

---

## Common Rejection Reasons

### Unjustified host permissions
TruLens requests only five permissions total: `storage` and four host permissions. Each has a clear, minimal justification. If the reviewer asks for more detail:
- The Google Maps host permission is the core function — the extension cannot read or badge reviews without it.
- The AI API host permissions (`api.minimax.io`, `api.anthropic.com`) are only triggered when the user has explicitly opted in and supplied their own API key. No requests are made otherwise.
- The `*.workers.dev` host permission covers the optional owner-hosted proxy for the free shared-AI tier. It is only used for POST requests to the AI endpoint; users on BYOK mode never trigger it. The proxy holds the owner's API key server-side — no key is shipped in the extension bundle.

### Remote code execution
TruLens uses none. All logic is bundled at build time (Manifest V3). No `eval`, no `Function()` from strings, no dynamically loaded scripts. State this clearly if questioned.

### Missing or inaccessible privacy policy
Ensure the GitHub Pages URL resolves before submitting (Step 4). The reviewer will visit it. Test it in an incognito window.

### Description must match behavior
The store description says "local + optional AI." Do not say "fully on-device" without the qualifier — AI analysis does send data to a provider. Keep `docs/STORE_LISTING.md` in sync with the actual UI before submission.

### Misleading screenshots
Screenshots must show the actual running extension on real pages, not mock-ups or staged images. Use a real Google Maps place page with real reviews.

---

## Useful Links

- Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Chrome Web Store Developer Program Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Manifest V3 overview: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- GitHub Pages setup: https://docs.github.com/en/pages/getting-started-with-github-pages
- Wrangler (Cloudflare Workers CLI): https://developers.cloudflare.com/workers/wrangler/
