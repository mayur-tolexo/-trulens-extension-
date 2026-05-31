# TruLens — Review Genuineness

Chrome (Manifest V3) extension that scores how genuine reviews are on **Google Maps** (v1). Instant on-device heuristics badges on every review; optional AI deep analysis for a sharper verdict — free shared AI tier included (owner-hosted proxy, no key needed) or bring your own key for unlimited use. Amazon and Flipkart support is planned for a future release.

**GitHub repo:** https://github.com/mayur-tolexo/-trulens-extension-

**New here?** Start with the [Quick Start Guide](docs/QUICKSTART.md). Have questions? Check the [FAQ & Troubleshooting](docs/FAQ.md). Ready to submit to the store? See [Publishing Checklist](docs/PUBLISHING.md). Full privacy policy: [PRIVACY.md](PRIVACY.md) · [hosted HTML](docs/privacy.html).

---

## What It Does

- **Instant on-device badges** — green (Likely genuine, 70–100) / amber (Mixed signals, 40–69) / red (Likely fake, 0–39) shield beside every Google Maps review; 0–100 score and 5-star equivalent; clickable detail card with signal breakdown.
- **Trust summary** — on-page panel and toolbar popup show an overall trust gauge, plain-language verdict, and genuine/mixed/fake counts.
- **Auto-loads reviews** — scrolls and loads all reviews on the Reviews tab automatically.
- **Place memory** — revisits show cached scores instantly; only new reviews are re-scanned.
- **AI deep analysis** — opt-in; provides a sharper per-review verdict:
  - **Free shared tier (no key):** owner deploys the Cloudflare Worker proxy (`proxy/`); up to 40 analyses/day per user.
  - **Bring-your-own-key (BYOK):** paste your own MiniMax or Anthropic key in Settings for unlimited use.

---

## Develop

```sh
npm install
npm test          # run unit tests
npm run build     # produce dist/
```

Load `dist/` via `chrome://extensions` → Developer mode → Load unpacked.

---

## Build & Package

```sh
npm run build       # compile TypeScript, bundle assets → dist/
npm run package     # zip dist/ → trulens-v1.0.0.zip (ready to upload to the Chrome Web Store)
npm run screenshots # capture screenshots from ./screenshots/ → store-assets/screenshots/
npm run icons       # generate icon PNGs + promo tile from source
```

The resulting `trulens-v1.0.0.zip` is what you upload to the Chrome Web Store. See [`docs/PUBLISHING.md`](docs/PUBLISHING.md) for the full store submission checklist.

---

## Privacy

All review scoring runs entirely on-device — no data leaves the browser for local heuristics. AI deep analysis is opt-in and only sends review text when both enabled and configured (key entered or proxy deployed). In free-tier proxy mode, review text is forwarded to MiniMax via the owner's Cloudflare Worker — the proxy does not store review text, only a per-user daily request counter. TruLens has no analytics server and never receives your data. Full policy: [`PRIVACY.md`](PRIVACY.md) · [hosted HTML](docs/privacy.html).

---

## Architecture

See `docs/superpowers/specs/2026-05-30-trulens-design.md`.

- `src/scoring-core` — pure heuristic engine (unit-tested)
- `src/adapters` — per-site DOM scrapers (Google Maps in v1; Amazon/Flipkart adapters in progress)
- `src/ui` — shield badge + detail card
- `src/content` — orchestrator (observers, scoring, rendering)
- `src/background` — deep analysis, settings, cache
- `proxy/` — Cloudflare Worker LLM proxy (rate-limited free shared-AI tier)

**Manifest permissions:** `storage`. Host permissions: `https://www.google.com/maps/*`, `https://api.minimax.io/*`, `https://api.anthropic.com/*`, `https://*.workers.dev/*`.

---

## Manual Verification

1. Load unpacked, open a Google Maps place and click the **Reviews** tab → shield badges appear within a few seconds.
2. Tap a badge → detail card with signal breakdown.
3. Enable AI: open the popup → Settings → enter your MiniMax or Anthropic key (or configure the proxy) → toggle AI Analysis on → click "Deep analysis" on any review.

AI providers supported via BYOK: MiniMax (OpenAI-compatible, base URL `https://api.minimax.io/v1`, model `MiniMax-M2`) and Anthropic.
