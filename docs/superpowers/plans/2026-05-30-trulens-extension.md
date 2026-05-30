# TruLens Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that scores review genuineness on Amazon, Flipkart, and Google Maps with instant local heuristics plus opt-in LLM deep analysis.

**Architecture:** Layered. A pure `scoring-core` (no DOM/network) computes a 0–100 score + verdict + signals. Thin per-site adapters scrape the DOM into a normalized `Review`. A shared UI layer injects shield badges and a detail card. A service worker handles deep-analysis network calls, settings, and caching.

**Tech Stack:** TypeScript, Manifest V3, Vite + `@crxjs/vite-plugin`, Vitest, jsdom (for adapter tests).

---

## File Structure

```
trulens/
  package.json, tsconfig.json, vite.config.ts, manifest.config.ts
  src/
    types.ts                 # shared Review, Signal, ScoreResult, Verdict, Settings
    scoring-core/
      sentiment.ts           # tiny lexicon sentiment
      signals.ts             # individual signal detectors
      score.ts               # combine signals -> ScoreResult
      aggregate.ts           # page-level product trust summary
      index.ts               # re-exports
    adapters/
      types.ts               # SiteAdapter interface
      amazon.ts, flipkart.ts, googleMaps.ts
      registry.ts            # pick adapter by URL
    ui/
      badge.ts               # shield badge render (idempotent)
      detailCard.ts          # signals + Deep analysis button
      styles.css
    content/index.ts         # orchestrator: observers, scoring, render
    background/
      cache.ts               # hash + chrome.storage cache
      settings.ts            # settings get/set
      llm.ts                 # deep analysis: proxy or own-key
      index.ts               # message router
    popup/popup.html, popup.ts
  proxy/worker.ts            # Cloudflare Worker LLM proxy
  test/fixtures/             # review fixtures + saved site HTML
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "trulens",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.5.0",
    "jsdom": "^24.0.0",
    "@types/chrome": "^0.0.268"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vitest/globals"],
    "skipLibCheck": true
  },
  "include": ["src", "test", "proxy"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node' },
});
```

- [ ] **Step 4: Create `manifest.config.ts`**

```ts
import { defineManifest } from '@crxjs/vite-plugin';
export default defineManifest({
  manifest_version: 3,
  name: 'TruLens — Review Genuineness',
  version: '0.1.0',
  description: 'Scores how genuine reviews are on Amazon, Flipkart and Google Maps.',
  action: { default_popup: 'src/popup/popup.html' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  permissions: ['storage'],
  host_permissions: [
    'https://*.amazon.com/*', 'https://*.amazon.in/*',
    'https://*.flipkart.com/*', 'https://www.google.com/maps/*'
  ],
  content_scripts: [{
    matches: [
      'https://*.amazon.com/*', 'https://*.amazon.in/*',
      'https://*.flipkart.com/*', 'https://www.google.com/maps/*'
    ],
    js: ['src/content/index.ts'],
    run_at: 'document_idle'
  }]
});
```

- [ ] **Step 5: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
export default defineConfig({ plugins: [crx({ manifest })] });
```

- [ ] **Step 6: Install and commit**

Run: `npm install`
Expected: dependencies install, `node_modules/` present.

```bash
printf "node_modules/\ndist/\n" >> .gitignore
git add package.json tsconfig.json vite.config.ts manifest.config.ts vitest.config.ts package-lock.json .gitignore
git commit -m "Scaffold TruLens MV3 extension (Vite + CRX + Vitest)"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type Verdict = 'genuine' | 'mixed' | 'fake';

export interface Review {
  id: string;
  text: string;
  rating: number | null;          // 1–5
  author: string | null;
  verifiedPurchase: boolean | null;
  date: string | null;            // ISO if parseable
  reviewerReviewCount: number | null;
  isLocalGuide: boolean | null;
  helpfulCount: number | null;
}

export interface Signal {
  key: string;
  label: string;
  delta: number;                  // signed contribution
}

export interface ScoreResult {
  score: number;                  // 0–100
  verdict: Verdict;
  signals: Signal[];
}

export interface ProductSummary {
  score: number;
  verdict: Verdict;
  reviewCount: number;
  breakdown: { genuine: number; mixed: number; fake: number };
}

export type ProviderMode = 'proxy' | 'own-key';

export interface Settings {
  enabled: boolean;
  perSite: { amazon: boolean; flipkart: boolean; googleMaps: boolean };
  providerMode: ProviderMode;
  apiKey: string;
  proxyUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  perSite: { amazon: true, flipkart: true, googleMaps: true },
  providerMode: 'proxy',
  apiKey: '',
  proxyUrl: 'https://trulens-proxy.example.workers.dev/analyze'
};

export interface DeepAnalysisResult {
  score: number;
  verdict: Verdict;
  reasoning: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "Add shared TruLens types"
```

---

## Task 3: Sentiment lexicon (scoring-core)

**Files:**
- Create: `src/scoring-core/sentiment.ts`
- Test: `test/sentiment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { sentimentScore } from '../src/scoring-core/sentiment';

describe('sentimentScore', () => {
  it('is positive for praise', () => {
    expect(sentimentScore('excellent great love amazing')).toBeGreaterThan(0);
  });
  it('is negative for complaints', () => {
    expect(sentimentScore('terrible awful broke hate')).toBeLessThan(0);
  });
  it('is ~0 for neutral text', () => {
    expect(sentimentScore('the box arrived on tuesday')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sentiment.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/scoring-core/sentiment.ts`**

```ts
const POS = new Set(['good','great','excellent','love','loved','amazing','perfect','best','wonderful','fantastic','happy','recommend','quality','durable','worth']);
const NEG = new Set(['bad','terrible','awful','hate','hated','worst','broke','broken','poor','cheap','waste','disappointed','disappointing','fake','defective','useless']);

/** Returns net sentiment: (#pos - #neg) / #tokens, range ~[-1,1]. 0 if no tokens. */
export function sentimentScore(text: string): number {
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (tokens.length === 0) return 0;
  let net = 0;
  for (const t of tokens) { if (POS.has(t)) net++; else if (NEG.has(t)) net--; }
  return net / tokens.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sentiment.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring-core/sentiment.ts test/sentiment.test.ts
git commit -m "Add lexicon sentiment for scoring-core"
```

---

## Task 4: Signal detectors (scoring-core)

**Files:**
- Create: `src/scoring-core/signals.ts`
- Test: `test/signals.test.ts`

Each detector takes a `Review` (and optional sibling context) and returns a `Signal | null`. Positive `delta` raises genuineness; negative lowers it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { detectSignals } from '../src/scoring-core/signals';
import type { Review } from '../src/types';

const base: Review = {
  id: 'r1', text: 'Battery lasts all day and the camera is sharp in low light. Used for three weeks.',
  rating: 5, author: 'A', verifiedPurchase: true, date: '2026-01-01',
  reviewerReviewCount: 12, isLocalGuide: null, helpfulCount: 4
};

describe('detectSignals', () => {
  it('rewards verified purchase', () => {
    const s = detectSignals(base, []);
    expect(s.find(x => x.key === 'verified_purchase')?.delta).toBeGreaterThan(0);
  });
  it('penalizes very short generic text', () => {
    const s = detectSignals({ ...base, text: 'good product' }, []);
    expect(s.find(x => x.key === 'too_short')?.delta).toBeLessThan(0);
  });
  it('penalizes ALL CAPS shouting', () => {
    const s = detectSignals({ ...base, text: 'BEST PRODUCT EVER BUY NOW AMAZING DEAL' }, []);
    expect(s.find(x => x.key === 'all_caps')?.delta).toBeLessThan(0);
  });
  it('penalizes rating/sentiment mismatch', () => {
    const s = detectSignals({ ...base, rating: 1, text: 'absolutely love it, excellent great quality' }, []);
    expect(s.find(x => x.key === 'rating_mismatch')?.delta).toBeLessThan(0);
  });
  it('penalizes near-duplicate of a sibling', () => {
    const sib = { ...base, id: 'r2' };
    const s = detectSignals({ ...base, id: 'r3' }, [sib]);
    expect(s.find(x => x.key === 'duplicate')?.delta).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/signals.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/scoring-core/signals.ts`**

```ts
import type { Review, Signal } from '../types';
import { sentimentScore } from './sentiment';

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Jaccard similarity over word sets. */
function similarity(a: string, b: string): number {
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function detectSignals(review: Review, siblings: Review[]): Signal[] {
  const out: Signal[] = [];
  const text = review.text ?? '';
  const words = normalize(text).split(' ').filter(Boolean);

  if (review.verifiedPurchase === true)
    out.push({ key: 'verified_purchase', label: 'Verified purchase', delta: +12 });
  if (review.verifiedPurchase === false)
    out.push({ key: 'unverified', label: 'Not a verified purchase', delta: -6 });

  if (words.length < 4)
    out.push({ key: 'too_short', label: 'Very short, generic review', delta: -15 });
  else if (words.length >= 20)
    out.push({ key: 'detailed', label: 'Detailed, specific review', delta: +8 });

  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 12 && letters === letters.toUpperCase())
    out.push({ key: 'all_caps', label: 'Excessive capitalization', delta: -10 });

  if (/(.)\1{3,}|!{3,}/.test(text))
    out.push({ key: 'repeated_punct', label: 'Repeated characters/punctuation', delta: -6 });

  if (review.rating != null) {
    const sent = sentimentScore(text);
    const norm = (review.rating - 3) / 2; // -1..1
    if (Math.abs(norm - sent) > 0.8 && Math.abs(sent) > 0.05)
      out.push({ key: 'rating_mismatch', label: 'Rating disagrees with the text', delta: -14 });
  }

  if (review.reviewerReviewCount != null && review.reviewerReviewCount <= 1)
    out.push({ key: 'single_review', label: 'Reviewer has only one review', delta: -8 });
  if (review.reviewerReviewCount != null && review.reviewerReviewCount >= 10)
    out.push({ key: 'established_reviewer', label: 'Established reviewer history', delta: +6 });

  if (review.isLocalGuide === true)
    out.push({ key: 'local_guide', label: 'Google Local Guide', delta: +6 });

  if (review.helpfulCount != null && review.helpfulCount >= 5)
    out.push({ key: 'helpful', label: 'Found helpful by others', delta: +5 });

  for (const sib of siblings) {
    if (sib.id !== review.id && similarity(text, sib.text ?? '') > 0.8) {
      out.push({ key: 'duplicate', label: 'Near-duplicate of another review', delta: -20 });
      break;
    }
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/signals.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring-core/signals.ts test/signals.test.ts
git commit -m "Add heuristic signal detectors"
```

---

## Task 5: Score combiner + aggregator (scoring-core)

**Files:**
- Create: `src/scoring-core/score.ts`, `src/scoring-core/aggregate.ts`, `src/scoring-core/index.ts`
- Test: `test/score.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { scoreReview } from '../src/scoring-core/score';
import { aggregate } from '../src/scoring-core/aggregate';
import type { Review } from '../src/types';

const genuine: Review = {
  id: 'g', text: 'Battery lasts all day and low-light photos are sharp. Three weeks of daily use and no issues.',
  rating: 5, author: 'A', verifiedPurchase: true, date: '2026-01-01',
  reviewerReviewCount: 14, isLocalGuide: null, helpfulCount: 6
};
const fake: Review = {
  id: 'f', text: 'BEST PRODUCT BUY NOW!!!', rating: 5, author: 'B',
  verifiedPurchase: false, date: '2026-01-01', reviewerReviewCount: 1,
  isLocalGuide: null, helpfulCount: 0
};

describe('scoreReview', () => {
  it('scores a genuine review high and green', () => {
    const r = scoreReview(genuine, []);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.verdict).toBe('genuine');
  });
  it('scores a spammy review low and red', () => {
    const r = scoreReview(fake, []);
    expect(r.score).toBeLessThan(40);
    expect(r.verdict).toBe('fake');
  });
  it('clamps to 0..100', () => {
    const r = scoreReview(fake, [{ ...fake, id: 'f2' }]);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('aggregate', () => {
  it('summarizes verdict counts', () => {
    const s = aggregate([scoreReview(genuine, []), scoreReview(fake, [])]);
    expect(s.reviewCount).toBe(2);
    expect(s.breakdown.genuine + s.breakdown.mixed + s.breakdown.fake).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/score.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/scoring-core/score.ts`**

```ts
import type { Review, ScoreResult, Verdict } from '../types';
import { detectSignals } from './signals';

export function verdictFor(score: number): Verdict {
  if (score >= 70) return 'genuine';
  if (score >= 40) return 'mixed';
  return 'fake';
}

export function scoreReview(review: Review, siblings: Review[]): ScoreResult {
  const signals = detectSignals(review, siblings);
  const raw = 60 + signals.reduce((sum, s) => sum + s.delta, 0); // neutral baseline 60
  const score = Math.max(0, Math.min(100, raw));
  return { score, verdict: verdictFor(score), signals };
}
```

- [ ] **Step 4: Implement `src/scoring-core/aggregate.ts`**

```ts
import type { ScoreResult, ProductSummary } from '../types';
import { verdictFor } from './score';

export function aggregate(results: ScoreResult[]): ProductSummary {
  const breakdown = { genuine: 0, mixed: 0, fake: 0 };
  for (const r of results) breakdown[r.verdict]++;
  const avg = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const score = Math.round(avg);
  return { score, verdict: verdictFor(score), reviewCount: results.length, breakdown };
}
```

- [ ] **Step 5: Implement `src/scoring-core/index.ts`**

```ts
export { scoreReview, verdictFor } from './score';
export { aggregate } from './aggregate';
export { detectSignals } from './signals';
export { sentimentScore } from './sentiment';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/score.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/scoring-core/score.ts src/scoring-core/aggregate.ts src/scoring-core/index.ts test/score.test.ts
git commit -m "Add score combiner and product aggregator"
```

---

## Task 6: Adapter interface + registry

**Files:**
- Create: `src/adapters/types.ts`, `src/adapters/registry.ts`

- [ ] **Step 1: Create `src/adapters/types.ts`**

```ts
import type { Review } from '../types';

export interface ExtractedReview { review: Review; anchor: Element; }

export interface SiteAdapter {
  key: 'amazon' | 'flipkart' | 'googleMaps';
  matches(url: string): boolean;
  extractReviews(root: ParentNode): ExtractedReview[];
  badgeMount(anchor: Element): { container: Element; position: InsertPosition };
}
```

- [ ] **Step 2: Create `src/adapters/registry.ts`** (imports added as adapters land)

```ts
import type { SiteAdapter } from './types';
import { amazonAdapter } from './amazon';
import { flipkartAdapter } from './flipkart';
import { googleMapsAdapter } from './googleMaps';

const ADAPTERS: SiteAdapter[] = [amazonAdapter, flipkartAdapter, googleMapsAdapter];

export function adapterFor(url: string): SiteAdapter | null {
  return ADAPTERS.find(a => a.matches(url)) ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/adapters/types.ts src/adapters/registry.ts
git commit -m "Add SiteAdapter interface and registry"
```

Note: `registry.ts` won't typecheck until Tasks 7–9 create the three adapters. Commit anyway; the build runs after Task 9. (Subagents: implement Tasks 7–9 before running `npm run build`.)

---

## Task 7: Amazon adapter

**Files:**
- Create: `src/adapters/amazon.ts`
- Test: `test/amazon.test.ts`
- Fixture: `test/fixtures/amazon-reviews.html`

- [ ] **Step 1: Create fixture `test/fixtures/amazon-reviews.html`**

```html
<div id="cm_cr-review_list">
  <div data-hook="review" id="R1">
    <a class="a-profile"><span class="a-profile-name">Rahul K</span></a>
    <i data-hook="review-star-rating"><span class="a-icon-alt">5.0 out of 5 stars</span></i>
    <span data-hook="avp-badge">Verified Purchase</span>
    <span data-hook="review-body"><span>Battery lasts all day and the camera is sharp in low light. Three weeks in.</span></span>
    <span data-hook="helpful-vote-statement">7 people found this helpful</span>
  </div>
  <div data-hook="review" id="R2">
    <a class="a-profile"><span class="a-profile-name">Spam Bot</span></a>
    <i data-hook="review-star-rating"><span class="a-icon-alt">5.0 out of 5 stars</span></i>
    <span data-hook="review-body"><span>BEST PRODUCT BUY NOW!!!</span></span>
  </div>
</div>
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { amazonAdapter } from '../src/adapters/amazon';

const html = readFileSync(new URL('./fixtures/amazon-reviews.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;

describe('amazonAdapter', () => {
  it('matches amazon urls', () => {
    expect(amazonAdapter.matches('https://www.amazon.in/dp/B0/reviews')).toBe(true);
    expect(amazonAdapter.matches('https://flipkart.com/x')).toBe(false);
  });
  it('extracts reviews with fields', () => {
    const out = amazonAdapter.extractReviews(doc);
    expect(out.length).toBe(2);
    const first = out[0].review;
    expect(first.rating).toBe(5);
    expect(first.verifiedPurchase).toBe(true);
    expect(first.author).toBe('Rahul K');
    expect(first.helpfulCount).toBe(7);
    expect(first.text).toContain('Battery');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/amazon.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/adapters/amazon.ts`**

```ts
import type { SiteAdapter, ExtractedReview } from './types';
import type { Review } from '../types';

function hashId(text: string, author: string): string {
  let h = 0;
  const s = `${author}::${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `a_${(h >>> 0).toString(36)}`;
}

function num(re: RegExp, s: string | null | undefined): number | null {
  const m = (s ?? '').match(re);
  return m ? Number(m[1]) : null;
}

export const amazonAdapter: SiteAdapter = {
  key: 'amazon',
  matches: (url) => /(^|\.)amazon\.(com|in|co\.[a-z]+)\b/.test(new URL(url).hostname),
  extractReviews(root) {
    const out: ExtractedReview[] = [];
    for (const el of Array.from(root.querySelectorAll('[data-hook="review"]'))) {
      const text = el.querySelector('[data-hook="review-body"]')?.textContent?.trim() ?? '';
      if (!text) continue;
      const author = el.querySelector('.a-profile-name')?.textContent?.trim() ?? null;
      const rating = num(/([0-9.]+) out of 5/, el.querySelector('[data-hook="review-star-rating"] .a-icon-alt')?.textContent);
      const verifiedPurchase = !!el.querySelector('[data-hook="avp-badge"]');
      const helpfulCount = num(/([0-9,]+)\s+people/, el.querySelector('[data-hook="helpful-vote-statement"]')?.textContent?.replace(/,/g, ''));
      const review: Review = {
        id: hashId(text, author ?? ''), text,
        rating: rating == null ? null : Math.round(rating),
        author, verifiedPurchase, date: null,
        reviewerReviewCount: null, isLocalGuide: null, helpfulCount
      };
      out.push({ review, anchor: el });
    }
    return out;
  },
  badgeMount: (anchor) => ({ container: anchor, position: 'afterbegin' })
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/amazon.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/adapters/amazon.ts test/amazon.test.ts test/fixtures/amazon-reviews.html
git commit -m "Add Amazon review adapter"
```

---

## Task 8: Flipkart adapter

**Files:**
- Create: `src/adapters/flipkart.ts`
- Test: `test/flipkart.test.ts`
- Fixture: `test/fixtures/flipkart-reviews.html`

- [ ] **Step 1: Create fixture `test/fixtures/flipkart-reviews.html`**

```html
<div class="_1YokD2">
  <div class="col EPCmJX" data-review="1">
    <div class="XQDdHH _1g0Ce5">5<span>★</span></div>
    <div class="ZmyHeo"><div>Battery easily lasts a full day and build quality feels premium. Using it for a month.</div></div>
    <p class="_2NsDsF">Rohan S</p>
    <p class="_2mcZGG">Certified Buyer</p>
    <div class="_6kK6mk"><span>23</span></div>
  </div>
  <div class="col EPCmJX" data-review="2">
    <div class="XQDdHH _1g0Ce5">5<span>★</span></div>
    <div class="ZmyHeo"><div>nice</div></div>
    <p class="_2NsDsF">aaa</p>
  </div>
</div>
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { flipkartAdapter } from '../src/adapters/flipkart';

const html = readFileSync(new URL('./fixtures/flipkart-reviews.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;

describe('flipkartAdapter', () => {
  it('matches flipkart urls', () => {
    expect(flipkartAdapter.matches('https://www.flipkart.com/p/itm')).toBe(true);
    expect(flipkartAdapter.matches('https://amazon.in/x')).toBe(false);
  });
  it('extracts reviews', () => {
    const out = flipkartAdapter.extractReviews(doc);
    expect(out.length).toBe(2);
    expect(out[0].review.rating).toBe(5);
    expect(out[0].review.verifiedPurchase).toBe(true);
    expect(out[0].review.author).toBe('Rohan S');
    expect(out[0].review.text).toContain('Battery');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/flipkart.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/adapters/flipkart.ts`**

```ts
import type { SiteAdapter, ExtractedReview } from './types';
import type { Review } from '../types';

function hashId(text: string, author: string): string {
  let h = 0; const s = `${author}::${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `f_${(h >>> 0).toString(36)}`;
}

export const flipkartAdapter: SiteAdapter = {
  key: 'flipkart',
  matches: (url) => /(^|\.)flipkart\.com$/.test(new URL(url).hostname),
  extractReviews(root) {
    const out: ExtractedReview[] = [];
    for (const el of Array.from(root.querySelectorAll('.EPCmJX'))) {
      const text = el.querySelector('.ZmyHeo')?.textContent?.trim() ?? '';
      if (!text) continue;
      const ratingText = el.querySelector('.XQDdHH')?.textContent?.match(/[0-9]/)?.[0];
      const author = el.querySelector('._2NsDsF')?.textContent?.trim() ?? null;
      const verifiedPurchase = /Certified Buyer/i.test(el.textContent ?? '');
      const helpful = el.querySelector('._6kK6mk span')?.textContent?.match(/[0-9]+/)?.[0];
      const review: Review = {
        id: hashId(text, author ?? ''), text,
        rating: ratingText ? Number(ratingText) : null,
        author, verifiedPurchase, date: null,
        reviewerReviewCount: null, isLocalGuide: null,
        helpfulCount: helpful ? Number(helpful) : null
      };
      out.push({ review, anchor: el });
    }
    return out;
  },
  badgeMount: (anchor) => ({ container: anchor, position: 'afterbegin' })
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/flipkart.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/adapters/flipkart.ts test/flipkart.test.ts test/fixtures/flipkart-reviews.html
git commit -m "Add Flipkart review adapter"
```

---

## Task 9: Google Maps adapter

**Files:**
- Create: `src/adapters/googleMaps.ts`
- Test: `test/googleMaps.test.ts`
- Fixture: `test/fixtures/gmaps-reviews.html`

- [ ] **Step 1: Create fixture `test/fixtures/gmaps-reviews.html`**

```html
<div class="m6QErb">
  <div class="jftiEf" data-review-id="X1">
    <div class="d4r55">Anita M</div>
    <div class="RfnDt"><span>Local Guide · 87 reviews</span></div>
    <span class="kvMYJc" aria-label="5 stars"></span>
    <div class="MyEned"><span class="wiI7pd">Friendly staff and the coffee is consistently great. Been coming here for months.</span></div>
  </div>
  <div class="jftiEf" data-review-id="X2">
    <div class="d4r55">guest</div>
    <div class="RfnDt"><span>1 review</span></div>
    <span class="kvMYJc" aria-label="5 stars"></span>
    <div class="MyEned"><span class="wiI7pd">AMAZING BEST PLACE EVER GO NOW</span></div>
  </div>
</div>
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { googleMapsAdapter } from '../src/adapters/googleMaps';

const html = readFileSync(new URL('./fixtures/gmaps-reviews.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;

describe('googleMapsAdapter', () => {
  it('matches google maps urls', () => {
    expect(googleMapsAdapter.matches('https://www.google.com/maps/place/Cafe')).toBe(true);
    expect(googleMapsAdapter.matches('https://www.google.com/search?q=x')).toBe(false);
  });
  it('extracts reviews with local-guide and review counts', () => {
    const out = googleMapsAdapter.extractReviews(doc);
    expect(out.length).toBe(2);
    expect(out[0].review.rating).toBe(5);
    expect(out[0].review.isLocalGuide).toBe(true);
    expect(out[0].review.reviewerReviewCount).toBe(87);
    expect(out[1].review.reviewerReviewCount).toBe(1);
    expect(out[0].review.text).toContain('coffee');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/googleMaps.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/adapters/googleMaps.ts`**

```ts
import type { SiteAdapter, ExtractedReview } from './types';
import type { Review } from '../types';

function hashId(text: string, author: string): string {
  let h = 0; const s = `${author}::${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `g_${(h >>> 0).toString(36)}`;
}

export const googleMapsAdapter: SiteAdapter = {
  key: 'googleMaps',
  matches: (url) => {
    const u = new URL(url);
    return u.hostname.endsWith('google.com') && u.pathname.startsWith('/maps');
  },
  extractReviews(root) {
    const out: ExtractedReview[] = [];
    for (const el of Array.from(root.querySelectorAll('.jftiEf'))) {
      const text = el.querySelector('.wiI7pd')?.textContent?.trim() ?? '';
      if (!text) continue;
      const author = el.querySelector('.d4r55')?.textContent?.trim() ?? null;
      const meta = el.querySelector('.RfnDt')?.textContent ?? '';
      const isLocalGuide = /Local Guide/i.test(meta);
      const reviewerReviewCount = meta.match(/([0-9,]+)\s+review/) ? Number(meta.match(/([0-9,]+)\s+review/)![1].replace(/,/g, '')) : null;
      const rating = el.querySelector('.kvMYJc')?.getAttribute('aria-label')?.match(/([0-9])\s*star/)?.[1];
      const review: Review = {
        id: hashId(text, author ?? ''), text,
        rating: rating ? Number(rating) : null,
        author, verifiedPurchase: null, date: null,
        reviewerReviewCount, isLocalGuide,
        helpfulCount: null
      };
      out.push({ review, anchor: el });
    }
    return out;
  },
  badgeMount: (anchor) => ({ container: anchor, position: 'afterbegin' })
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/googleMaps.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/adapters/googleMaps.ts test/googleMaps.test.ts test/fixtures/gmaps-reviews.html
git commit -m "Add Google Maps review adapter"
```

---

## Task 10: UI — badge + detail card

**Files:**
- Create: `src/ui/badge.ts`, `src/ui/detailCard.ts`, `src/ui/styles.css`
- Test: `test/badge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderBadge } from '../src/ui/badge';
import type { ScoreResult } from '../src/types';

const result: ScoreResult = { score: 82, verdict: 'genuine', signals: [{ key: 'verified_purchase', label: 'Verified purchase', delta: 12 }] };

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><div id="host"></div>');
  (globalThis as any).document = dom.window.document;
});

describe('renderBadge', () => {
  it('injects a shield badge with the verdict label', () => {
    const host = document.getElementById('host')!;
    renderBadge(host, 'afterbegin', result, () => {});
    const badge = host.querySelector('.trulens-badge')!;
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('data-verdict')).toBe('genuine');
    expect(badge.textContent).toContain('Likely genuine');
  });
  it('is idempotent (no double-inject)', () => {
    const host = document.getElementById('host')!;
    renderBadge(host, 'afterbegin', result, () => {});
    renderBadge(host, 'afterbegin', result, () => {});
    expect(host.querySelectorAll('.trulens-badge').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/badge.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/ui/badge.ts`**

```ts
import type { ScoreResult, Verdict } from '../types';

const LABEL: Record<Verdict, string> = {
  genuine: 'Likely genuine', mixed: 'Mixed signals', fake: 'Likely fake'
};

export function renderBadge(
  container: Element,
  position: InsertPosition,
  result: ScoreResult,
  onClick: (anchor: Element) => void
): void {
  // idempotent: replace any existing badge for this container
  container.querySelector(':scope > .trulens-badge')?.remove();
  const badge = document.createElement('span');
  badge.className = 'trulens-badge';
  badge.setAttribute('data-verdict', result.verdict);
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  badge.innerHTML = `<span class="trulens-shield">✓</span><span class="trulens-label">${LABEL[result.verdict]}</span>`;
  badge.addEventListener('click', (e) => { e.stopPropagation(); onClick(badge); });
  container.insertAdjacentElement(position, badge);
}
```

- [ ] **Step 4: Implement `src/ui/detailCard.ts`**

```ts
import type { ScoreResult } from '../types';

export function renderDetailCard(
  anchor: Element,
  result: ScoreResult,
  onDeepAnalysis: () => void
): void {
  document.querySelector('.trulens-card')?.remove();
  const card = document.createElement('div');
  card.className = 'trulens-card';
  card.setAttribute('data-verdict', result.verdict);
  const signals = result.signals
    .map(s => `<li class="${s.delta >= 0 ? 'pos' : 'neg'}">${s.label} <b>${s.delta >= 0 ? '+' : ''}${s.delta}</b></li>`)
    .join('');
  card.innerHTML = `
    <div class="trulens-card-score">${result.score}<small>/100</small></div>
    <ul class="trulens-signals">${signals}</ul>
    <button class="trulens-deep">Deep analysis</button>
    <div class="trulens-deep-result" hidden></div>`;
  card.querySelector('.trulens-deep')!.addEventListener('click', onDeepAnalysis);
  const rect = anchor.getBoundingClientRect();
  card.style.cssText = `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;z-index:2147483647`;
  document.body.appendChild(card);
  const close = (e: MouseEvent) => {
    if (!card.contains(e.target as Node)) { card.remove(); document.removeEventListener('click', close); }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

export function showDeepResult(text: string): void {
  const box = document.querySelector('.trulens-deep-result') as HTMLElement | null;
  if (box) { box.hidden = false; box.textContent = text; }
}
```

- [ ] **Step 5: Implement `src/ui/styles.css`**

```css
.trulens-badge{display:inline-flex;align-items:center;gap:6px;font:600 12px/1.2 system-ui,sans-serif;
  padding:3px 9px;border-radius:999px;cursor:pointer;vertical-align:middle;margin:2px 0;border:1px solid}
.trulens-badge .trulens-shield{width:16px;height:16px;border-radius:5px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px}
.trulens-badge[data-verdict=genuine]{background:#e6f7ec;color:#137a3e;border-color:#a7e0bd}
.trulens-badge[data-verdict=genuine] .trulens-shield{background:#21a45a}
.trulens-badge[data-verdict=mixed]{background:#fff6e6;color:#9a6700;border-color:#f3dca2}
.trulens-badge[data-verdict=mixed] .trulens-shield{background:#e0a700}
.trulens-badge[data-verdict=fake]{background:#fdecef;color:#b3261e;border-color:#f6c2cd}
.trulens-badge[data-verdict=fake] .trulens-shield{background:#d93636}
.trulens-card{background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:12px;width:260px;
  box-shadow:0 6px 24px rgba(0,0,0,.15);font:13px system-ui,sans-serif;color:#1a1a1a}
.trulens-card-score{font-size:26px;font-weight:800}
.trulens-card-score small{font-size:13px;color:#888;font-weight:600}
.trulens-signals{list-style:none;margin:8px 0;padding:0;max-height:160px;overflow:auto}
.trulens-signals li{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #f1f3f5}
.trulens-signals li.pos b{color:#137a3e}.trulens-signals li.neg b{color:#b3261e}
.trulens-deep{margin-top:6px;width:100%;padding:7px;border:0;border-radius:7px;background:#3b7dff;color:#fff;font-weight:600;cursor:pointer}
.trulens-deep-result{margin-top:8px;font-size:12px;color:#333;line-height:1.4}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/badge.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/ui/badge.ts src/ui/detailCard.ts src/ui/styles.css test/badge.test.ts
git commit -m "Add badge and detail card UI"
```

---

## Task 11: Background — cache, settings, LLM, router

**Files:**
- Create: `src/background/cache.ts`, `src/background/settings.ts`, `src/background/llm.ts`, `src/background/index.ts`
- Test: `test/cache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reviewHash } from '../src/background/cache';

describe('reviewHash', () => {
  it('is stable for the same text', () => {
    expect(reviewHash('hello world')).toBe(reviewHash('hello world'));
  });
  it('differs for different text', () => {
    expect(reviewHash('a')).not.toBe(reviewHash('b'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cache.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/background/cache.ts`**

```ts
import type { DeepAnalysisResult } from '../types';

export function reviewHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `tl_${(h >>> 0).toString(36)}`;
}

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function getCached(text: string): Promise<DeepAnalysisResult | null> {
  const key = reviewHash(text);
  const obj = await chrome.storage.local.get(key);
  const hit = obj[key] as { at: number; result: DeepAnalysisResult } | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  return null;
}

export async function setCached(text: string, result: DeepAnalysisResult): Promise<void> {
  await chrome.storage.local.set({ [reviewHash(text)]: { at: Date.now(), result } });
}
```

- [ ] **Step 4: Implement `src/background/settings.ts`**

```ts
import { DEFAULT_SETTINGS, type Settings } from '../types';

export async function getSettings(): Promise<Settings> {
  const obj = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(obj.settings as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
```

- [ ] **Step 5: Implement `src/background/llm.ts`**

```ts
import type { Review, DeepAnalysisResult } from '../types';
import { getSettings } from './settings';
import { verdictFor } from '../scoring-core/score';

const PROMPT = (r: Review, siblings: Review[]) =>
  `You are an expert at detecting fake product/place reviews. Rate how GENUINE this review is from 0 (definitely fake) to 100 (clearly authentic). Consider specificity, emotional authenticity, and similarity to the other reviews.\n\nREVIEW (rating ${r.rating ?? '?'}/5): """${r.text}"""\n\nOTHER REVIEWS ON PAGE:\n${siblings.slice(0, 4).map(s => `- """${s.text}"""`).join('\n')}\n\nReturn ONLY JSON: {"score": <0-100>, "reasoning": "<one sentence>"}`;

export async function runDeepAnalysis(review: Review, siblings: Review[]): Promise<DeepAnalysisResult> {
  const s = await getSettings();
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: PROMPT(review, siblings) }]
  };

  let raw: string;
  if (s.providerMode === 'own-key') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const json = await res.json();
    raw = json.content?.[0]?.text ?? '';
  } else {
    const res = await fetch(s.proxyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    const json = await res.json();
    raw = json.content?.[0]?.text ?? JSON.stringify(json);
  }

  const m = raw.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : { score: 50, reasoning: 'Could not parse response.' };
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 50));
  return { score, verdict: verdictFor(score), reasoning: String(parsed.reasoning ?? '') };
}
```

- [ ] **Step 6: Implement `src/background/index.ts`**

```ts
import { runDeepAnalysis } from './llm';
import { getCached, setCached } from './cache';
import { getSettings, setSettings } from './settings';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'deepAnalysis') {
        const cached = await getCached(msg.review.text);
        if (cached) return sendResponse({ ok: true, result: cached, cached: true });
        const result = await runDeepAnalysis(msg.review, msg.siblings ?? []);
        await setCached(msg.review.text, result);
        return sendResponse({ ok: true, result });
      }
      if (msg.type === 'getSettings') return sendResponse({ ok: true, settings: await getSettings() });
      if (msg.type === 'setSettings') return sendResponse({ ok: true, settings: await setSettings(msg.patch) });
      sendResponse({ ok: false, error: 'unknown message' });
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
  })();
  return true; // async
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run test/cache.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/background test/cache.test.ts
git commit -m "Add background worker: cache, settings, LLM, router"
```

---

## Task 12: Content script orchestrator

**Files:**
- Create: `src/content/index.ts`

No unit test (DOM/observer integration; verified via build + manual load). Keep logic minimal and delegate to tested modules.

- [ ] **Step 1: Implement `src/content/index.ts`**

```ts
import './../ui/styles.css';
import { adapterFor } from '../adapters/registry';
import { scoreReview } from '../scoring-core';
import { renderBadge } from '../ui/badge';
import { renderDetailCard, showDeepResult } from '../ui/detailCard';
import type { ExtractedReview } from '../adapters/types';
import type { Review } from '../types';

const adapter = adapterFor(location.href);
if (adapter) init(adapter);

function init(a: NonNullable<ReturnType<typeof adapterFor>>) {
  const scored = new Set<string>();
  const reviewById = new Map<string, Review>();

  const scan = debounce(() => {
    const found = a.extractReviews(document);
    const all = found.map(f => f.review);
    for (const r of all) reviewById.set(r.id, r);
    for (const f of found) {
      if (scored.has(f.review.id)) continue;
      scored.add(f.review.id);
      const result = scoreReview(f.review, all);
      const mount = a.badgeMount(f.anchor);
      renderBadge(mount.container, mount.position, result, () =>
        renderDetailCard(f.anchor, result, () => deepAnalyze(f, all)));
    }
  }, 250);

  function deepAnalyze(f: ExtractedReview, siblings: Review[]) {
    showDeepResult('Analyzing…');
    chrome.runtime.sendMessage(
      { type: 'deepAnalysis', review: f.review, siblings },
      (resp) => {
        if (resp?.ok) showDeepResult(`${resp.result.score}/100 — ${resp.result.reasoning}`);
        else showDeepResult('Deep analysis unavailable.');
      });
  }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/index.ts
git commit -m "Add content script orchestrator"
```

---

## Task 13: Popup

**Files:**
- Create: `src/popup/popup.html`, `src/popup/popup.ts`

The popup reads settings and shows toggles. (Product summary is shown inline; the popup focuses on settings + global on/off for v1.)

- [ ] **Step 1: Create `src/popup/popup.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body{font:13px system-ui,sans-serif;width:260px;margin:0;padding:14px;color:#1a1a1a}
  h1{font-size:15px;margin:0 0 10px}
  label{display:flex;justify-content:space-between;align-items:center;padding:6px 0}
  input[type=text],select{width:140px}
  .row{margin-top:8px}
</style></head>
<body>
  <h1>TruLens</h1>
  <label>Enabled <input type="checkbox" id="enabled"></label>
  <label>Amazon <input type="checkbox" id="amazon"></label>
  <label>Flipkart <input type="checkbox" id="flipkart"></label>
  <label>Google Maps <input type="checkbox" id="googleMaps"></label>
  <div class="row">
    <label>LLM source
      <select id="providerMode">
        <option value="proxy">Hosted proxy</option>
        <option value="own-key">My API key</option>
      </select>
    </label>
    <label>API key <input type="text" id="apiKey" placeholder="sk-ant-…"></label>
  </div>
  <script type="module" src="./popup.ts"></script>
</body></html>
```

- [ ] **Step 2: Create `src/popup/popup.ts`**

```ts
import type { Settings } from '../types';

function send<T = any>(msg: any): Promise<T> {
  return new Promise((res) => chrome.runtime.sendMessage(msg, res));
}

async function load() {
  const { settings } = await send<{ settings: Settings }>({ type: 'getSettings' });
  (document.getElementById('enabled') as HTMLInputElement).checked = settings.enabled;
  (document.getElementById('amazon') as HTMLInputElement).checked = settings.perSite.amazon;
  (document.getElementById('flipkart') as HTMLInputElement).checked = settings.perSite.flipkart;
  (document.getElementById('googleMaps') as HTMLInputElement).checked = settings.perSite.googleMaps;
  (document.getElementById('providerMode') as HTMLSelectElement).value = settings.providerMode;
  (document.getElementById('apiKey') as HTMLInputElement).value = settings.apiKey;
}

function wire() {
  const save = async () => {
    await send({ type: 'setSettings', patch: {
      enabled: (document.getElementById('enabled') as HTMLInputElement).checked,
      perSite: {
        amazon: (document.getElementById('amazon') as HTMLInputElement).checked,
        flipkart: (document.getElementById('flipkart') as HTMLInputElement).checked,
        googleMaps: (document.getElementById('googleMaps') as HTMLInputElement).checked
      },
      providerMode: (document.getElementById('providerMode') as HTMLSelectElement).value as Settings['providerMode'],
      apiKey: (document.getElementById('apiKey') as HTMLInputElement).value
    }});
  };
  document.querySelectorAll('input,select').forEach(el => el.addEventListener('change', save));
}

load().then(wire);
```

- [ ] **Step 3: Commit**

```bash
git add src/popup
git commit -m "Add popup settings UI"
```

---

## Task 14: Proxy worker + build verification

**Files:**
- Create: `proxy/worker.ts`, `proxy/README.md`

- [ ] **Step 1: Create `proxy/worker.ts`**

```ts
// Minimal Cloudflare Worker that proxies to Anthropic with a server-side key.
// Deploy with: wrangler deploy. Set ANTHROPIC_API_KEY as a secret.
export default {
  async fetch(req: Request, env: { ANTHROPIC_API_KEY: string }): Promise<Response> {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const body = await req.text();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
  }
};
```

- [ ] **Step 2: Create `proxy/README.md`**

```markdown
# TruLens proxy
A Cloudflare Worker that holds the Anthropic API key server-side.

## Deploy
1. `npm i -g wrangler`
2. `wrangler secret put ANTHROPIC_API_KEY`
3. `wrangler deploy`
4. Put the deployed URL (…/analyze) into the extension's `proxyUrl` setting / `DEFAULT_SETTINGS`.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all suites PASS (sentiment, signals, score, amazon, flipkart, googleMaps, badge, cache).

- [ ] **Step 4: Build the extension**

Run: `npm run build`
Expected: `dist/` produced with `manifest.json`, content script, background, popup. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add proxy
git commit -m "Add Cloudflare proxy worker and verify build"
```

---

## Task 15: README + manual verification notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README and manual verification steps"
```

---

## Self-Review Notes

- **Spec coverage:** scoring-core (T3–5), per-site adapters all three (T7–9),
  shield badge + detail card (T10), product aggregator (T5 `aggregate`),
  background proxy/own-key + cache + settings (T11), content observers (T12),
  popup settings (T13), proxy (T14), testing per component (each task). ✓
- **Verdict bands** consistent everywhere via `verdictFor` (≥70/≥40/else). ✓
- **Type names** (`Review`, `ScoreResult`, `Signal`, `Settings`,
  `DeepAnalysisResult`, `ExtractedReview`, `SiteAdapter`) defined in T2/T6 and
  reused unchanged. ✓
- **Known deferment:** `registry.ts` (T6) references adapters created in T7–9;
  build/full-suite run deferred to T14. Noted in T6.
```
