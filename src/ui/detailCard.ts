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
