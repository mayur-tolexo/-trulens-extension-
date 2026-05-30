import './../ui/styles.css';
import { adapterFor } from '../adapters/registry';
import { scoreReview, aggregate, verdictFor } from '../scoring-core';
import { renderBadge } from '../ui/badge';
import { renderDetailCard, showDeepResult, applyDeepResult } from '../ui/detailCard';
import { updateOverlay } from '../ui/overlay';
import type { ExtractedReview } from '../adapters/types';
import type { Review, ScoreResult } from '../types';

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
    sendResponse({
      ok: true,
      summary: aggregate([...pageResults.values()]),
      debug: { adapter: activeAdapterKey, scored: pageResults.size, probe: lastProbe }
    });
    return true; // keep channel open
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
        init(adapter);
        return;
      }
      if (resp?.ok) {
        const s = resp.settings;
        const on = s.enabled && s.perSite[adapter.key];
        log('settings: enabled =', s.enabled, '| site', adapter.key, '=', s.perSite[adapter.key]);
        if (on) init(adapter);
        else log('disabled by settings — not scanning');
      } else {
        log('getSettings returned not-ok — defaulting to enabled');
        init(adapter);
      }
    });
  } catch (e) {
    log('sendMessage threw (context invalidated?) — scanning anyway:', (e as Error).message);
    init(adapter);
  }
}

function init(a: NonNullable<ReturnType<typeof adapterFor>>) {
  const scored = new Set<string>();
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const refresh = (scanning: boolean) => {
    const name = (a.pageName && a.pageName(document)) || cleanTitle();
    updateOverlay(name, aggregate([...pageResults.values()]), scanning);
  };

  const scan = debounce(() => {
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
    for (const f of found) {
      if (scored.has(f.review.id)) continue;
      scored.add(f.review.id);
      const result = scoreReview(f.review, all);
      pageResults.set(f.review.id, result);
      const mount = a.badgeMount(f.anchor);
      renderBadge(mount.container, mount.position, result, () =>
        renderDetailCard(f.anchor, result, () => deepAnalyze(f, all)));
    }
    // Keep the on-page panel live; show the progress bar briefly, then settle.
    refresh(true);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => refresh(false), 1500);
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
          refresh(false);
        } else {
          showDeepResult('Deep analysis unavailable.');
        }
      });
  }

  refresh(true);            // show the panel immediately in its "scanning" state
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}
