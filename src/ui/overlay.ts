import type { ProductSummary, Verdict } from '../types';

const LABEL: Record<Verdict, string> = {
  genuine: 'Likely genuine',
  mixed: 'Mixed signals',
  fake: 'Likely fake',
};
const COLOR: Record<Verdict, string> = {
  genuine: '#21a45a',
  mixed: '#e0a700',
  fake: '#d93636',
};

let root: HTMLElement | null = null;

function build(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'trulens-overlay';
  el.setAttribute('data-collapsed', 'false');
  el.innerHTML = `
    <div class="trulens-ov-head">
      <span class="trulens-ov-logo">🛡</span>
      <span class="trulens-ov-title">TruLens</span>
      <span class="trulens-ov-pill" hidden>–</span>
      <button class="trulens-ov-toggle" title="Minimize" aria-label="Minimize">–</button>
    </div>
    <div class="trulens-ov-body">
      <div class="trulens-ov-name" style="display:none"></div>
      <div class="trulens-ov-gaugewrap">
        <div class="trulens-ov-gauge"><span class="trulens-ov-score">–</span></div>
        <div class="trulens-ov-meta">
          <div class="trulens-ov-verdict" data-verdict="mixed">Scanning…</div>
          <div class="trulens-ov-count">0 reviews scored</div>
        </div>
      </div>
      <div class="trulens-ov-bar"><i class="g"></i><i class="m"></i><i class="f"></i></div>
      <div class="trulens-ov-progress" data-active="true"><span></span></div>
    </div>`;

  const toggle = el.querySelector('.trulens-ov-toggle') as HTMLButtonElement;
  const pill = el.querySelector('.trulens-ov-pill') as HTMLElement;
  toggle.addEventListener('click', () => {
    const collapsed = el.getAttribute('data-collapsed') === 'true';
    el.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
    toggle.textContent = collapsed ? '–' : '+';
    pill.hidden = collapsed;
  });

  document.body.appendChild(el);
  return el;
}

/** Create/update the on-page floating trust panel. */
export function updateOverlay(name: string | null, summary: ProductSummary, scanning: boolean): void {
  if (!root) root = build();
  const q = (s: string) => root!.querySelector(s) as HTMLElement;

  const has = summary.reviewCount > 0;
  const v = summary.verdict;

  if (name) {
    const n = q('.trulens-ov-name');
    n.textContent = name;
    n.style.display = '';
  }

  const deg = Math.round((has ? summary.score : 0) / 100 * 360);
  q('.trulens-ov-gauge').style.background = `conic-gradient(${COLOR[v]} 0deg ${deg}deg, #e8eaf0 ${deg}deg 360deg)`;
  q('.trulens-ov-score').textContent = has ? String(summary.score) : '–';
  q('.trulens-ov-pill').textContent = has ? String(summary.score) : '–';

  const verdictEl = q('.trulens-ov-verdict');
  verdictEl.setAttribute('data-verdict', has ? v : 'mixed');
  verdictEl.textContent = has ? LABEL[v] : (scanning ? 'Scanning…' : 'No reviews yet');

  q('.trulens-ov-count').textContent = scanning && !has
    ? 'Looking for reviews…'
    : `${summary.reviewCount} review${summary.reviewCount === 1 ? '' : 's'} scored`;

  const total = summary.breakdown.genuine + summary.breakdown.mixed + summary.breakdown.fake || 1;
  (q('.trulens-ov-bar .g')).style.width = (summary.breakdown.genuine / total * 100) + '%';
  (q('.trulens-ov-bar .m')).style.width = (summary.breakdown.mixed / total * 100) + '%';
  (q('.trulens-ov-bar .f')).style.width = (summary.breakdown.fake / total * 100) + '%';

  q('.trulens-ov-progress').setAttribute('data-active', scanning ? 'true' : 'false');
}
