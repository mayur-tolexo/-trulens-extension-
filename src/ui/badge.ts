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
