import './../ui/styles.css';
import { adapterFor } from '../adapters/registry';
import { scoreReview, aggregate, verdictFor } from '../scoring-core';
import { renderBadge } from '../ui/badge';
import { renderDetailCard, showDeepResult, applyDeepResult } from '../ui/detailCard';
import type { ExtractedReview } from '../adapters/types';
import type { Review, ScoreResult } from '../types';

const adapter = adapterFor(location.href);
if (adapter) {
  chrome.runtime.sendMessage({ type: 'getSettings' }, (resp) => {
    if (!resp?.ok) return;
    const s = resp.settings;
    if (s.enabled && s.perSite[adapter.key]) init(adapter);
  });
}

// Module-level map of review id → ScoreResult, exposed to popup via message
const pageResults = new Map<string, ScoreResult>();

// Listen for popup requesting a page summary
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'getPageSummary') {
    sendResponse({ ok: true, summary: aggregate([...pageResults.values()]) });
    return true; // keep channel open
  }
  // Let background handle its own message types
  return undefined;
});

function init(a: NonNullable<ReturnType<typeof adapterFor>>) {
  const scored = new Set<string>();

  const scan = debounce(() => {
    const found = a.extractReviews(document);
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
          // Update stored result so popup summary reflects LLM values
          const updated: ScoreResult = {
            ...pageResults.get(f.review.id)!,
            score: r.score,
            verdict
          };
          pageResults.set(f.review.id, updated);
        } else {
          showDeepResult('Deep analysis unavailable.');
        }
      });
  }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}
