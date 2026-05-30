import type { ScoreResult, Verdict } from '../types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const VERDICT_LABEL: Record<Verdict, string> = {
  genuine: 'Likely genuine', mixed: 'Mixed signals', fake: 'Likely fake'
};

const VERDICT_ICON: Record<Verdict, string> = {
  genuine: '✓', mixed: '!', fake: '✕'
};

const GAUGE_COLOR: Record<Verdict, string> = {
  genuine: '#21a45a', mixed: '#e0a700', fake: '#d93636'
};

function buildGaugeStyle(score: number, verdict: Verdict): string {
  const color = GAUGE_COLOR[verdict];
  const pct = Math.round(score);
  return `background: conic-gradient(${color} 0% ${pct}%, #edf0f4 ${pct}% 100%)`;
}

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
    .map(s => `<span class="trulens-chip ${s.delta >= 0 ? 'trulens-chip--pos' : 'trulens-chip--neg'}">${esc(s.label)} <strong>${s.delta >= 0 ? '+' : ''}${s.delta}</strong></span>`)
    .join('');

  card.innerHTML = `
    <div class="trulens-card-inner">
      <div class="trulens-gauge-wrap">
        <div class="trulens-gauge" style="${buildGaugeStyle(result.score, result.verdict)}">
          <div class="trulens-gauge-hole">
            <span class="trulens-gauge-num">${result.score}</span>
            <span class="trulens-gauge-denom">/100</span>
          </div>
        </div>
      </div>
      <div class="trulens-verdict-heading" data-verdict="${result.verdict}">
        <span class="trulens-verdict-icon">${VERDICT_ICON[result.verdict]}</span>
        <span class="trulens-verdict-label">${VERDICT_LABEL[result.verdict]}</span>
      </div>
      <div class="trulens-chips">${signals}</div>
      <button class="trulens-deep-btn">Deep analysis</button>
      <div class="trulens-deep-result" hidden></div>
    </div>`;

  card.querySelector('.trulens-deep-btn')!.addEventListener('click', () => {
    const btn = card.querySelector('.trulens-deep-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = `<span class="trulens-spinner"></span> Analyzing…`;
    onDeepAnalysis();
  });

  const rect = anchor.getBoundingClientRect();
  card.style.cssText = `position:fixed;top:${rect.bottom + 8}px;left:${Math.max(8, rect.left)}px;z-index:2147483647`;
  document.body.appendChild(card);

  // Entrance animation
  requestAnimationFrame(() => { card.classList.add('trulens-card--visible'); });

  const close = (e: MouseEvent) => {
    if (!card.contains(e.target as Node)) { card.remove(); document.removeEventListener('click', close); }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

export function showDeepResult(text: string): void {
  const box = document.querySelector('.trulens-deep-result') as HTMLElement | null;
  if (!box) return;
  box.hidden = false;
  box.textContent = text;
  // Re-enable button if still present
  const btn = document.querySelector('.trulens-deep-btn') as HTMLButtonElement | null;
  if (btn) { btn.disabled = false; btn.textContent = 'Deep analysis'; }
}

export function applyDeepResult(result: { score: number; verdict: Verdict; reasoning: string }): void {
  const card = document.querySelector('.trulens-card') as HTMLElement | null;
  if (!card) return;

  // Update gauge
  const gauge = card.querySelector('.trulens-gauge') as HTMLElement | null;
  if (gauge) gauge.style.cssText = buildGaugeStyle(result.score, result.verdict);

  const numEl = card.querySelector('.trulens-gauge-num') as HTMLElement | null;
  if (numEl) numEl.textContent = String(result.score);

  // Update verdict heading
  const heading = card.querySelector('.trulens-verdict-heading') as HTMLElement | null;
  if (heading) {
    heading.setAttribute('data-verdict', result.verdict);
    const iconEl = heading.querySelector('.trulens-verdict-icon') as HTMLElement | null;
    const labelEl = heading.querySelector('.trulens-verdict-label') as HTMLElement | null;
    if (iconEl) iconEl.textContent = VERDICT_ICON[result.verdict];
    if (labelEl) labelEl.textContent = VERDICT_LABEL[result.verdict];
  }

  // Show reasoning in the result box
  const box = card.querySelector('.trulens-deep-result') as HTMLElement | null;
  if (box) {
    box.hidden = false;
    box.innerHTML = `<span class="trulens-ai-badge">AI verdict</span><p class="trulens-reasoning"></p>`;
    const p = box.querySelector('.trulens-reasoning') as HTMLElement;
    p.textContent = result.reasoning; // safe — textContent, not innerHTML
  }

  // Re-enable button
  const btn = card.querySelector('.trulens-deep-btn') as HTMLButtonElement | null;
  if (btn) { btn.disabled = false; btn.textContent = 'Deep analysis'; }
}
