# TruLens — Review Genuineness Scorer (Chrome Extension)

**Date:** 2026-05-30
**Status:** Approved design, ready for implementation planning

## Summary

TruLens is a Manifest V3 Chrome extension that scores how genuine product/place
reviews are on Amazon, Flipkart, and Google Maps. Every visible review gets an
**instant, fully-local** genuineness badge (a colored shield with a word verdict).
Users can opt into a per-review **deep analysis** that sends the review text to an
LLM for a richer verdict. The extension popup shows an aggregate product-level
trust score plus settings.

## Goals

- Instant, private, per-review genuineness badges on supported sites (no network).
- Opt-in LLM "deep analysis" for a single review on demand.
- Product-level trust summary in the popup.
- Clean per-site adapter boundary so DOM breakage is isolated to one file.
- Pure, unit-testable scoring engine.

## Non-Goals (YAGNI)

- No account system, no cloud history, no cross-device sync.
- No automatic LLM analysis of every review (cost/privacy) — deep analysis is
  always an explicit per-review tap.
- No training our own ML model (the LLM covers the "smart" path).
- No browsers other than Chromium/Chrome for v1.

## Key Decisions

| Decision | Choice |
|---|---|
| Scoring engine | **Hybrid**: local heuristics (instant baseline) + opt-in LLM deep analysis |
| Scoring unit | **Both**: per-review inline badges + product-level summary in popup |
| LLM access | **Configurable**: hosted proxy by default, user's own API key as an option |
| MVP sites | **All three**: Amazon, Flipkart, Google Maps |
| Score display | **Shield + label** (traffic-light). Green "Likely genuine" / amber "Mixed signals" / red "Likely fake". 0–100 score shown in detail view. |
| Code architecture | **Layered**: thin per-site adapters + shared pure `scoring-core` + shared UI layer + service worker for network/settings/cache |
| Stack | TypeScript, Manifest V3, Vite (CRX plugin), Vitest |

## Architecture

Layered design. The "green path" (local scoring) never touches the network; the
"blue path" (deep analysis) is opt-in.

```
IN PAGE
  Web page DOM (Amazon / Flipkart / Google Maps)
      → Site Adapter        one per site: scrape DOM → normalized Review[], find injection points
      → scoring-core LOCAL  pure heuristics → { score 0–100, verdict, signals[] }, no network
      → UI layer            inject shield badge per review; tap → detail card + "Deep analysis" button
                                   |
                                   | tap
                                   v
  Service worker NETWORK    routes deep-analysis req; holds settings; caches results by review hash

OUTSIDE
  LLM (hosted proxy default OR user's own key) → returns richer verdict + reasoning
      → UI updates badge to LLM verdict; result cached so re-scroll is instant

POPUP
  Aggregator (combines all local scores on page) → Popup (product trust score, signal breakdown, settings)
```

**Key boundary:** `scoring-core` is pure TypeScript with zero DOM/network
dependency → unit-testable in isolation. Adapters are the only fragile,
site-specific code → a site changing its markup touches exactly one file.

## Components

### 1. `scoring-core` (pure, no DOM, no network)

Input: a `Review` (and optionally sibling reviews for context). Output:
`ScoreResult { score: 0–100, verdict, signals: Signal[] }`.

```ts
type Verdict = 'genuine' | 'mixed' | 'fake';

interface Review {
  id: string;            // stable per-page id (e.g. hash of text+author)
  text: string;
  rating: number | null; // stars, normalized to 1–5; null if not shown
  author: string | null;
  verifiedPurchase: boolean | null;
  date: string | null;       // ISO if parseable
  reviewerReviewCount: number | null;
  isLocalGuide: boolean | null; // Google Maps
  helpfulCount: number | null;
}

interface Signal {
  key: string;          // e.g. 'generic_text', 'rating_mismatch'
  label: string;        // human-readable, shown in detail card
  delta: number;        // contribution to score (signed)
}

interface ScoreResult { score: number; verdict: Verdict; signals: Signal[]; }
```

**Local signals (each a weighted contribution):**
- Text quality: too-short/generic, template-like phrasing, excessive superlatives,
  ALL-CAPS bursts, repeated punctuation, brand/keyword stuffing.
- Sentiment/rating mismatch: positive text with low stars or vice versa
  (lightweight lexicon-based sentiment; no network).
- Duplicate / near-duplicate detection across reviews on the page.
- Reviewer signals (when present): verified purchase, reviewer review count,
  single-review accounts, Google Local Guide status.
- Temporal bursts: many reviews clustered on the same dates.
- Rating distribution (product-level): bimodal 5★/1★ spikes with hollow middle.

**Verdict bands:** `score ≥ 70 → genuine` (green), `40–69 → mixed` (amber),
`< 40 → fake` (red).

**Aggregator:** a function in `scoring-core` that takes all page `ScoreResult`s +
the rating distribution → product-level `{ score, verdict, breakdown }`.

### 2. Site Adapters (`adapters/amazon.ts`, `flipkart.ts`, `googleMaps.ts`)

Each implements a shared interface:

```ts
interface SiteAdapter {
  matches(url: string): boolean;
  /** Find review elements currently in the DOM and normalize them. */
  extractReviews(root: ParentNode): Array<{ review: Review; anchor: Element }>;
  /** Where to inject the badge relative to a review's anchor element. */
  badgeMount(anchor: Element): { container: Element; position: InsertPosition };
}
```

Adapters contain the ONLY site-specific selectors. They must fail silently if
selectors don't match (return `[]`), never throw into the host page.

### 3. UI layer (shared, `ui/`)

- `badge.ts` — renders the shield badge (green/amber/red + label) into the mount
  point an adapter provides. Idempotent (won't double-inject).
- `detailCard.ts` — on badge tap, shows the 0–100 score, the contributing
  `signals[]`, and a "Deep analysis" button.
- `popup/` — product trust score, signal breakdown, settings UI.

### 4. Content script (`content/index.ts`)

Orchestrates in-page work:
- Selects the matching adapter for the current URL.
- Uses `IntersectionObserver` to score reviews lazily as they scroll into view.
- Uses `MutationObserver` to catch dynamically loaded reviews (infinite scroll).
- Calls `scoring-core` locally and renders badges immediately.
- On "Deep analysis" tap, messages the service worker and updates the badge with
  the returned LLM verdict.
- Debounces and caps concurrent scoring work.

### 5. Service worker (`background/index.ts`)

The only component that touches the network. Stateless (MV3 can evict it);
all persistence in `chrome.storage`.
- `runDeepAnalysis(review)` → routes to hosted proxy (default) or user key.
- Caches LLM results keyed by a hash of review text (with TTL) in
  `chrome.storage.local`.
- Owns settings: provider mode (proxy | own-key), API key, per-site enable flags,
  global on/off.

### 6. Hosted proxy (`proxy/`, thin serverless function)

A Cloudflare Worker (or equivalent) that holds the provider API key and exposes a
single `POST /analyze` endpoint behind the same request/response shape as own-key
mode. Keeps the provider key off the client in the default path.

## Data Flow

1. Content script picks adapter → `extractReviews()` → `Review[]` + anchors.
2. For each review in view: `scoring-core.score(review, siblings)` → badge rendered
   instantly (no network).
3. Aggregator runs over all scored reviews → popup shows product trust summary.
4. User taps a badge → detail card with signals + "Deep analysis".
5. User taps "Deep analysis" → worker checks cache → if miss, calls proxy/own-key
   LLM → returns refined verdict → badge upgraded → result cached.

## Error Handling & Resilience

- **Adapter finds nothing** (markup changed): return `[]`, render nothing, never
  modify the host page. Popup may note "couldn't read reviews on this page."
- **LLM fails / no key / rate-limited**: keep the local badge; detail card shows
  "deep analysis unavailable." Never block.
- **Performance**: lazy scoring via IntersectionObserver; MutationObserver for
  infinite scroll; debounce; cap concurrent work.
- **MV3 worker eviction**: worker stays stateless; settings + cache live in
  `chrome.storage`.
- **Privacy**: local scoring never leaves the device; deep analysis is explicit
  per-tap consent; per-site and global on/off switches; review text is the only
  data sent, and only on deep analysis.

## Testing Strategy

- **`scoring-core`**: pure Vitest unit tests against fixtures of known
  genuine/fake reviews. TDD — write the fixture + expected verdict first.
- **Adapters**: tested against saved HTML snapshots of each site's review DOM
  (`extractReviews` → normalized `Review[]`). No dependence on live sites.
- **UI**: light component tests for badge/detail rendering; manual verification on
  real pages.
- **Worker**: unit-test routing/caching with a mocked LLM client.

## Project Structure (proposed)

```
trulens/
  manifest.json
  src/
    scoring-core/        # pure engine: signals, scoring, aggregator, types
    adapters/            # amazon.ts, flipkart.ts, googleMaps.ts, types.ts
    ui/                  # badge.ts, detailCard.ts, styles
    content/             # content script orchestrator
    background/          # service worker: deep analysis, settings, cache
    popup/               # popup UI
  proxy/                 # thin serverless LLM proxy (Cloudflare Worker)
  test/
    fixtures/            # known reviews + saved site HTML snapshots
  vite.config.ts
  package.json
```

## Open Implementation Notes

- Sentiment is lexicon-based and bundled (small word lists) to keep the green path
  offline.
- Review `id`/cache key = stable hash of `text + author`.
- Exact heuristic weights are tunable; start with reasonable defaults and refine
  against the test fixtures.
- Proxy deployment config (account, route) is environment-specific; the extension
  ships pointing at a configurable proxy URL.
```
