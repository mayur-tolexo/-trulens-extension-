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

/** Stable Google Maps place id from the URL feature id, else the place-name key. */
function placeId(): string {
  const m = location.href.match(/!1s([^!?]+)/);
  return m ? m[1] : placeKey();
}

/** True only when the place panel's "Reviews" tab is the selected tab. */
function reviewsTabActive(): boolean {
  for (const t of Array.from(document.querySelectorAll('button[role="tab"]'))) {
    if (t.getAttribute('aria-selected') === 'true') {
      const label = (t.getAttribute('aria-label') || t.textContent || '').toLowerCase();
      if (label.includes('review')) return true;
    }
  }
  return false;
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
const DEBUG = false; // flip to true for verbose console diagnostics
const log = (...a: unknown[]) => { if (DEBUG) console.log(TAG, ...a); };

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
  // AI is "ready" only when actually configured: a key for BYOK modes, or a
  // proxy URL for proxy mode. Prevents auto-analysis from firing for new users.
  const providerReady = !!settings &&
    (settings.providerMode === 'proxy' ? !!settings.proxyUrl : !!settings.apiKey);
  const autoDeep = !!settings && settings.autoDeep !== false && providerReady;

  const scored = new Set<string>();
  let autoLoadStarted = false;
  let generation = 0;            // bumped on place change; invalidates in-flight work
  let lastPlaceKey = placeKey();

  // Track mount points so badges can be re-rendered with AI verdicts
  const mounts = new Map<string, { f: ExtractedReview; container: Element; position: InsertPosition }>();
  // All reviews seen, keyed by id, for sibling context
  const seen = new Map<string, Review>();
  // Per-place memory cache: pre-loaded from storage on place load
  const cachedResults = new Map<string, ScoreResult>();
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  // Batch AI queue state
  const pending: string[] = [];
  const queuedIds = new Set<string>();
  let batchesInflight = 0;
  let analyzed = 0;
  const BATCH_SIZE = 8;
  const MAX_BATCHES = 2;

  // Loading flag: true while reviews are still being discovered/loaded
  let loading = false;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const refresh = () => {
    const name = (a.pageName && a.pageName(document)) || cleanTitle();
    updateOverlay(name, aggregate([...pageResults.values()]), loading, analyzed);
  };

  function siblingsFor(id: string): Review[] {
    return [...seen.values()].filter(r => r.id !== id).slice(0, 6);
  }

  function renderFor(id: string, result: ScoreResult) {
    const m = mounts.get(id); if (!m) return;
    renderBadge(m.container, m.position, result, () =>
      renderDetailCard(m.f.anchor, result, () => deepAnalyze(m.f, siblingsFor(id))));
  }

  function siblingsForBatch(ids: string[]): Review[] {
    return [...seen.values()].filter(r => !ids.includes(r.id)).slice(0, 3);
  }

  function loadPlaceCache() {
    const id = placeId();
    const gen = generation;
    try {
      chrome.runtime.sendMessage({ type: 'getPlace', placeId: id }, (resp) => {
        if (chrome.runtime.lastError) return;
        if (gen !== generation) return;            // place changed while loading
        const place = resp?.place;
        if (!place || !place.perReview) return;
        for (const [rid, res] of Object.entries(place.perReview) as [string, ScoreResult][]) {
          cachedResults.set(rid, res);
          if (!pageResults.has(rid)) pageResults.set(rid, res);  // instant summary from memory
        }
        refresh();                                  // show remembered summary immediately
      });
    } catch { /* context invalidated */ }
  }

  function persistPlace() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (pageResults.size === 0) return;
      const summary = aggregate([...pageResults.values()]);
      const perReview = Object.fromEntries([...pageResults.entries()]);
      const name = (a.pageName && a.pageName(document)) || cleanTitle();
      try {
        chrome.runtime.sendMessage(
          { type: 'setPlace', placeId: placeId(), place: { name, reviewCount: summary.reviewCount, summary, perReview, at: 0 } },
          () => void chrome.runtime.lastError);
      } catch { /* ignore */ }
    }, 2000);
  }

  function enqueueDeep(id: string) {
    if (queuedIds.has(id)) return;
    queuedIds.add(id); pending.push(id); pumpBatches();
  }

  function pumpBatches() {
    while (batchesInflight < MAX_BATCHES && pending.length) {
      const ids = pending.splice(0, BATCH_SIZE);
      const reviews = ids.map(id => mounts.get(id)?.f.review).filter(Boolean) as Review[];
      if (!reviews.length) continue;
      const gen = generation;
      batchesInflight++;
      try {
        chrome.runtime.sendMessage(
          { type: 'deepAnalysisBatch', reviews, siblings: siblingsForBatch(ids) },
          (resp) => {
            if (chrome.runtime.lastError) { batchesInflight--; refresh(); return; }
            batchesInflight--;
            if (gen !== generation) { pumpBatches(); return; }
            if (resp?.ok && Array.isArray(resp.results)) {
              for (const r of resp.results) {
                const prev = pageResults.get(r.id); if (!prev) continue;
                const verdict = r.verdict ?? verdictFor(r.score);
                pageResults.set(r.id, { ...prev, score: r.score, verdict });
                renderFor(r.id, pageResults.get(r.id)!);
                analyzed++;
              }
              persistPlace();
            }
            refresh();
            pumpBatches();
          });
      } catch {
        batchesInflight--;
        refresh();
        return;
      }
    }
  }

  function resetForNewPlace() {
    generation++;            // invalidate any in-flight deep-analysis callbacks
    pageResults.clear();
    seen.clear();
    scored.clear();
    mounts.clear();
    cachedResults.clear();
    pending.length = 0;
    queuedIds.clear();
    analyzed = 0;
    autoLoadStarted = false;
    loading = true;
    log('place changed → reset');
    refresh();               // immediately clear the panel to the new-place state
    loadPlaceCache();        // load new place's memory immediately
  }

  const scan = debounce(() => {
    if (document.hidden) return;
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

      const cached = cachedResults.get(f.review.id);
      const result = cached ?? scoreReview(f.review, all);
      pageResults.set(f.review.id, result);

      const mount = a.badgeMount(f.anchor);
      // Store mount point for later re-renders
      mounts.set(f.review.id, { f, container: mount.container, position: mount.position });

      renderFor(f.review.id, result);

      // Auto-enqueue for AI deep analysis if enabled, skip reviews we already remember
      if (autoDeep && !cached) enqueueDeep(f.review.id);
    }
    // Auto-load only while the Reviews tab is open — not on a bare place click.
    if (a.key === 'googleMaps' && reviewsTabActive() && found.length > 0 && !autoLoadStarted) {
      autoLoadStarted = true;
      autoLoad();
    }
    // Loader reflects review-discovery only: animate while new reviews keep arriving,
    // then settle ~1.5 s after the last new one.
    if (added > 0) {
      loading = true;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { loading = false; refresh(); }, 1500);
      persistPlace();
    }
    refresh();
  }, 250);

  function deepAnalyze(f: ExtractedReview, siblings: Review[]) {
    showDeepResult('Analyzing…');
    const gen = generation;
    try {
      chrome.runtime.sendMessage(
        { type: 'deepAnalysis', review: f.review, siblings },
        (resp) => {
          if (chrome.runtime.lastError) { showDeepResult('Deep analysis unavailable.'); return; }
          if (gen !== generation) return;
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
            refresh();
          } else if (resp?.error === 'quota') {
            showDeepResult('Free AI limit reached — add your own key in Settings.');
          } else {
            showDeepResult('Deep analysis unavailable.');
          }
        });
    } catch {
      showDeepResult('Deep analysis unavailable.');
    }
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
    const gen = generation;
    let lastCount = 0, stable = 0, ticks = 0;
    const MAX_TICKS = 100;
    const step = () => {
      if (gen !== generation) return;
      // Stop immediately if the user switched away from the Reviews tab.
      if (!reviewsTabActive()) {
        log('left Reviews tab → stop auto-load');
        autoLoadStarted = false;    // re-arm so it resumes if they return
        refresh();
        return;
      }
      const c = findScrollContainer();
      const count = document.querySelectorAll('[data-review-id], .jftiEf').length;
      if (count > lastCount) { lastCount = count; stable = 0; } else { stable++; }
      ticks++;
      scan();                       // score whatever is now loaded
      if (!c || stable >= 6 || ticks >= MAX_TICKS) {
        log('auto-load complete:', count, 'reviews loaded');
        refresh();
        return;
      }
      c.scrollTo({ top: c.scrollHeight });
      c.dispatchEvent(new Event('scroll', { bubbles: true }));
      setTimeout(step, 650);
    };
    step();
  }

  loading = true; refresh(); // show the panel immediately in its "scanning" state
  loadPlaceCache();          // load remembered summary instantly on revisit
  scan();                    // autoLoad is kicked off from scan() once reviews appear
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}
