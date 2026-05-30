# TruLens — Review Genuineness Scorer

Chrome (MV3) extension that scores how genuine reviews are on Amazon, Flipkart,
and Google Maps. Instant local heuristics badge every visible review; opt-in LLM
"deep analysis" gives a richer verdict per review.

## Develop
- `npm install`
- `npm test` — run unit tests
- `npm run build` — produce `dist/`
- Load `dist/` via chrome://extensions → Developer mode → Load unpacked.

## Architecture
See `docs/superpowers/specs/2026-05-30-trulens-design.md`.
- `src/scoring-core` — pure heuristic engine (unit-tested)
- `src/adapters` — per-site DOM scrapers (Amazon/Flipkart/Google Maps)
- `src/ui` — shield badge + detail card
- `src/content` — orchestrator (observers, scoring, rendering)
- `src/background` — deep analysis (proxy/own-key), settings, cache
- `proxy/` — Cloudflare Worker LLM proxy

## Manual verification
1. Load unpacked, open an Amazon product's reviews → shield badges appear.
2. Tap a badge → detail card with signals → "Deep analysis" returns a verdict
   (configure proxy URL or your own API key in the popup first).
3. Repeat on a Flipkart product and a Google Maps place.

Deep analysis supports three providers (popup → LLM source): a hosted proxy, Anthropic with your own key, or any OpenAI-compatible endpoint (e.g. MiniMax — base URL https://api.minimax.io/v1, model MiniMax-M2).
