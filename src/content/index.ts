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
