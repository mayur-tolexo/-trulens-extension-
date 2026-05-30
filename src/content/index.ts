import './../ui/styles.css';
import { adapterFor } from '../adapters/registry';
import { scoreReview, aggregate, verdictFor } from '../scoring-core';
import { renderBadge } from '../ui/badge';
import { renderDetailCard, showDeepResult, applyDeepResult } from '../ui/detailCard';
import { updateOverlay, showOverlay } from '../ui/overlay';
import type { ExtractedReview } from '../adapters/types';
import type { Review, ScoreResult, Settings } from '../types';

/** Identifies the current place on Google Maps (changes on SPA navigation). */
function placeKey(): string {
  const m = location.pathname.match(/\/place\/([^/@]+)/);
  return m ? m[1] : location.pathname;
}

/** Best-effort page name: adapter selector first, else cleaned document.title. */
function cleanTitle(): string | null {
  const t = document.title
    .replace(/\s*[-|–—]\s*Google Maps.*$/i, '')
    .replace(/^Amazon\.[a-z.]+\s*:?\s*/i, '')
    .replace(/\s*[-|–—]\s*(Buy|Online|Amazon|Flipkart).*$/i, '')
    .trim();
  return t.length >= 2 ? t : null;
}

const TAG = '[TruLens]';
const log = (...a: unknown[]) => console.log(TAG, ...a);

// Module-level map of review id → ScoreResult, exposed to popup via message
const pageResults = new Map<string, ScoreResult>();
let activeAdapterKey: string | null = null;
let lastProbe: Record<string, number> = {};

// Listen for popup requesting a page summary (registered immediately, always)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'getPageSummary') {
    const name = (adapter && adapter.pageName && adapter.pageName(document)) || cleanTitle();
    sendResponse({
      ok: true,
      name,
      summary: aggregate([...pageResults.values()]),
      debug: { adapter: activeAdapterKey, scored: pageResults.size, probe: lastProbe }
    });
    return true; // keep channel open
  }
  if (msg?.type === 'showOverlay') {
    showOverlay();
    sendResponse({ ok: true });
    return true;
  }
  // Let background handle its own message types
  return undefined;
});

const adapter = adapterFor(location.href);
activeAdapterKey = adapter?.key ?? null;
log('content script loaded on', location.hostname, '→ adapter:', adapter?.key ?? 'NONE (url not matched)');

if (adapter) {
  // Fail-OPEN: try to read settings, but if messaging fails (cold/invalidated
  // worker), default to enabled and scan anyway — local badges need no network.
  try {
    chrome.runtime.sendMessage({ type: 'getSettings' }, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) {
        log('getSettings failed (', err.message, ') — defaulting to enabled');
        init(adapter, undefined);
        return;
      }
      if (resp?.ok) {
        const s = resp.settings;
        const on = s.enabled && s.perSite[adapter.key];
        log('settings: enabled =', s.enabled, '| site', adapter.key, '=', s.perSite[adapter.key]);
        if (on) init(adapter, resp.settings);
        else log('disabled by settings — not scanning');
      } else {
        log('getSettings returned not-ok — defaulting to enabled');
        init(adapter, undefined);
      }
    });
  } catch (e) {
    log('sendMessage threw (context invalidated?) — scanning anyway:', (e as Error).message);
    init(adapter, undefined);
  }
}

function init(a: NonNullable<ReturnType<typeof adapterFor>>, settings?: Settings) {
  const providerReady = !!settings && (settings.providerMode === 'proxy' || !!settings.apiKey);
  const autoDeep = !!settings && settings.autoDeep !== false && providerReady;

  const scored = new Set<string>();
  let autoLoadStarted = false;
  let generation = 0;            // bumped on place change; invalidates in-flight work
  let lastPlaceKey = placeKey();

  // Track mount points so badges can be re-rendered with AI verdicts
  const mounts = new Map<string, { f: ExtractedReview; container: Element; position: InsertPosition }>();
  // All reviews seen, keyed by id, for sibling context
  const seen = new Map<string, Review>();

  // Auto-deep queue state
  const deepQueue: string[] = [];
  const queued = new Set<string>();
  let inflight = 0, analyzed = 0;
  const MAX_INFLIGHT = 3;

  const refresh = (scanning: boolean) => {
    const name = (a.pageName && a.pageName(document)) || cleanTitle();
    updateOverlay(name, aggregate([...pageResults.values()]), scanning, analyzed);
  };

  function siblingsFor(id: string): Review[] {
    return [...seen.values()].filter(r => r.id !== id).slice(0, 6);
  }

  function renderFor(id: string, result: ScoreResult) {
    const m = mounts.get(id); if (!m) return;
    renderBadge(m.container, m.position, result, () =>
      renderDetailCard(m.f.anchor, result, () => deepAnalyze(m.f, siblingsFor(id))));
  }

  function pumpDeep() {
    while (inflight < MAX_INFLIGHT && deepQueue.length) {
      const id = deepQueue.shift()!;
      const m = mounts.get(id); if (!m) continue;
      const gen = generation;
      inflight++;
      chrome.runtime.sendMessage(
        { type: 'deepAnalysis', review: m.f.review, siblings: siblingsFor(id) },
        (resp) => {
          inflight--;
          if (gen !== generation) { pumpDeep(); return; } // place changed; drop stale result
          if (resp?.ok) {
            const r = resp.result;
            const verdict = r.verdict ?? verdictFor(r.score);
            const prev = pageResults.get(id) ?? scoreReview(m.f.review, []);
            const updated: ScoreResult = { ...prev, score: r.score, verdict };
            pageResults.set(id, updated);
            renderFor(id, updated);    // upgrade the inline badge to the AI verdict
            analyzed++;
          }
          refresh(inflight > 0);
          pumpDeep();
        });
    }
  }

  function enqueueDeep(id: string) {
    if (queued.has(id)) return;
    queued.add(id); deepQueue.push(id); pumpDeep();
  }

  function resetForNewPlace() {
    generation++;            // invalidate any in-flight deep-analysis callbacks
    pageResults.clear();
    seen.clear();
    scored.clear();
    mounts.clear();
    deepQueue.length = 0;
    queued.clear();
    analyzed = 0;
    autoLoadStarted = false;
    log('place changed → reset');
    refresh(true);           // immediately clear the panel to the new-place state
  }

  const scan = debounce(() => {
    // Google Maps is a SPA: clicking a new place must clear the previous one.
    const pk = placeKey();
    if (pk !== lastPlaceKey) { lastPlaceKey = pk; resetForNewPlace(); }

    const found = a.extractReviews(document);
    if (found.length === 0) {
      lastProbe = {
        'data-review-id': document.querySelectorAll('[data-review-id]').length,
        'data-hook=review': document.querySelectorAll('[data-hook="review"]').length,
        'jftiEf': document.querySelectorAll('.jftiEf').length,
        'EPCmJX': document.querySelectorAll('.EPCmJX').length,
        'role=img/star': document.querySelectorAll('[role="img"][aria-label*="star" i]').length,
      };
      log('scan: 0 reviews extracted. DOM probe →', lastProbe);
    } else {
      log('scan: scored', found.length, 'reviews on', a.key);
    }
    const all = found.map(f => f.review);
    let added = 0;
    for (const f of found) {
      // Always update seen map for sibling context
      seen.set(f.review.id, f.review);

      if (scored.has(f.review.id)) continue;
      scored.add(f.review.id);
      added++;

      const result = scoreReview(f.review, all);
      pageResults.set(f.review.id, result);

      const mount = a.badgeMount(f.anchor);
      // Store mount point for later re-renders
      mounts.set(f.review.id, { f, container: mount.container, position: mount.position });

      renderFor(f.review.id, result);

      // Auto-enqueue for AI deep analysis if enabled
      if (autoDeep) enqueueDeep(f.review.id);
    }
    // Start the one-time auto-loader once reviews actually appear (e.g. after
    // the user opens the Reviews tab). Runs once, scrolls to the bottom, stops.
    if (a.key === 'googleMaps' && found.length > 0 && !autoLoadStarted) {
      autoLoadStarted = true;
      autoLoad();
    }
    // Loader reflects REAL activity (new reviews or analysis in flight) so it
    // stops after the first load — Google Maps mutates the DOM constantly.
    refresh(added > 0 || inflight > 0);
  }, 250);

  function deepAnalyze(f: ExtractedReview, siblings: Review[]) {
    showDeepResult('Analyzing…');
    chrome.runtime.sendMessage(
      { type: 'deepAnalysis', review: f.review, siblings },
      (resp) => {
        if (resp?.ok) {
          const r = resp.result;
          const verdict = r.verdict ?? verdictFor(r.score);
          applyDeepResult({ score: r.score, verdict, reasoning: r.reasoning });
          // Update stored result so the popup + overlay reflect LLM values
          const updated: ScoreResult = {
            ...pageResults.get(f.review.id)!,
            score: r.score,
            verdict
          };
          pageResults.set(f.review.id, updated);
          // Also upgrade the inline badge
          renderFor(f.review.id, updated);
          refresh(false);
        } else {
          showDeepResult('Deep analysis unavailable.');
        }
      });
  }

  // Find the scrollable reviews container on Google Maps.
  function findScrollContainer(): HTMLElement | null {
    const known = document.querySelector('.m6QErb.DxyBCb, .m6QErb[tabindex="-1"]') as HTMLElement | null;
    if (known && known.scrollHeight > known.clientHeight + 20) return known;
    const anchor = document.querySelector('[data-review-id], .jftiEf');
    let el: HTMLElement | null = anchor?.parentElement as HTMLElement | null;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 20) return el;
      el = el.parentElement;
    }
    return null;
  }

  // Scroll the reviews container to the bottom repeatedly until no new reviews
  // load, then stop. Runs exactly once per place.
  function autoLoad() {
    let lastCount = 0, stable = 0, ticks = 0;
    const MAX_TICKS = 100;
    const step = () => {
      const c = findScrollContainer();
      const count = document.querySelectorAll('[data-review-id], .jftiEf').length;
      if (count > lastCount) { lastCount = count; stable = 0; } else { stable++; }
      ticks++;
      scan();                       // score whatever is now loaded
      if (!c || stable >= 6 || ticks >= MAX_TICKS) {
        log('auto-load complete:', count, 'reviews loaded');
        refresh(inflight > 0);
        return;
      }
      c.scrollTo({ top: c.scrollHeight });
      c.dispatchEvent(new Event('scroll', { bubbles: true }));
      setTimeout(step, 650);
    };
    step();
  }

  refresh(true);            // show the panel immediately in its "scanning" state
  scan();                   // autoLoad is kicked off from scan() once reviews appear
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}
