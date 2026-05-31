# TruLens — Google Maps Review Genuineness Scorer

Chrome (MV3) extension that scores how genuine reviews are on **Google Maps** (v1).
Instant on-device heuristics badge every visible review; opt-in AI deep analysis
gives a richer, per-review verdict. Amazon and Flipkart support is planned for a
future release.

**New here?** Start with the [Quick Start Guide](docs/QUICKSTART.md). Have questions? Check the [FAQ & Troubleshooting](docs/FAQ.md).

## Develop
- `npm install`
- `npm test` — run unit tests
- `npm run build` — produce `dist/`
- Load `dist/` via `chrome://extensions` → Developer mode → Load unpacked.

## Build & package
```sh
npm run build     # compile TypeScript, bundle assets → dist/
npm run package   # zip dist/ → trulens-v<version>.zip (ready to upload to the Chrome Web Store)
```
See [`docs/PUBLISHING.md`](docs/PUBLISHING.md) for the full store submission checklist.

## Privacy
All review scoring runs entirely on-device — no data leaves the browser for local heuristics.
AI deep analysis is opt-in, bring-your-own-key, and sends review text directly from your browser to your chosen provider (MiniMax / OpenAI / Anthropic).
TruLens has no server, no analytics, and never receives your data.
Full policy: [`PRIVACY.md`](PRIVACY.md) · [hosted HTML](docs/privacy.html)

## Architecture
See `docs/superpowers/specs/2026-05-30-trulens-design.md`.
- `src/scoring-core` — pure heuristic engine (unit-tested)
- `src/adapters` — per-site DOM scrapers (Google Maps in v1; Amazon/Flipkart adapters in progress)
- `src/ui` — shield badge + detail card
- `src/content` — orchestrator (observers, scoring, rendering)
- `src/background` — deep analysis (own-key), settings, cache
- `proxy/` — Cloudflare Worker LLM proxy

## Manual verification
1. Load unpacked, open a Google Maps place and click the **Reviews** tab → shield badges appear.
2. Tap a badge → detail card with signals → "Deep analysis" returns a verdict
   (paste your own API key in Settings first).

Deep analysis supports three providers (Settings → AI Provider): MiniMax (default, free tier — base URL `https://api.minimax.io/v1`, model `MiniMax-M2`), OpenAI, or Anthropic.
