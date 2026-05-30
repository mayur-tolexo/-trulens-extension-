import type { ScoreResult, Verdict } from '../types';

const LABEL: Record<Verdict, string> = {
  genuine: 'Likely genuine', mixed: 'Mixed signals', fake: 'Likely fake'
};

const ICON: Record<Verdict, string> = {
  genuine: '✓', mixed: '!', fake: '✕'
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
  badge.innerHTML = `<span class="trulens-shield">${ICON[result.verdict]}</span><span class="trulens-label">${LABEL[result.verdict]}</span><span class="trulens-score">${result.score}</span>`;
  badge.addEventListener('click', (e) => { e.stopPropagation(); onClick(badge); });
  badge.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick(badge); }
  });
  container.insertAdjacentElement(position, badge);
  // Trigger entrance animation after insertion (guard for test environments without rAF)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => { badge.classList.add('trulens-badge--visible'); });
  } else {
    badge.classList.add('trulens-badge--visible');
  }
}
