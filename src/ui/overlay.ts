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
let dismissed = false;

function build(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'trulens-overlay';
  el.setAttribute('data-collapsed', 'false');
  el.innerHTML = `
    <div class="trulens-ov-head">
      <span class="trulens-ov-logo"><svg width="20" height="20" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="30" fill="#fff"/><path d="M64 24 L100 36 V64 C100 87 84 101 64 108 C44 101 28 87 28 64 V36 Z" fill="#2742E6"/><path d="M48 66 L59 77 L82 52" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span>
      <span class="trulens-ov-title">TruLens</span>
      <span class="trulens-ov-pill" hidden>–</span>
      <button class="trulens-ov-toggle" title="Minimize" aria-label="Minimize">–</button>
      <button class="trulens-ov-close" title="Close (reopen from the extension icon)" aria-label="Close">×</button>
    </div>
    <div class="trulens-ov-body">
      <div class="trulens-ov-name" style="display:none"></div>
      <div class="trulens-ov-gaugewrap">
        <div class="trulens-ov-gauge"><span class="trulens-ov-score">–</span></div>
        <div class="trulens-ov-meta">
          <div class="trulens-ov-verdict" data-verdict="mixed">Scanning…</div>
          <div class="trulens-ov-stars" style="display:none"></div>
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

  const close = el.querySelector('.trulens-ov-close') as HTMLButtonElement;
  close.addEventListener('click', () => {
    dismissed = true;
    el.style.display = 'none';
  });

  document.body.appendChild(el);
  return el;
}

/** Re-show the panel after the user closed it (called when the popup opens). */
export function showOverlay(): void {
  dismissed = false;
  if (root) root.style.display = '';
}

/** Create/update the on-page floating trust panel. */
export function updateOverlay(name: string | null, summary: ProductSummary, scanning: boolean, analyzed?: number): void {
  if (!root) root = build();
  if (dismissed) return; // user closed it; wait for showOverlay() (extension-icon click)
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

  const starsEl = q('.trulens-ov-stars');
  if (has) {
    const stars = Math.round(summary.score / 20 * 10) / 10; // 0–100 → 0–5, 1 decimal
    const full = Math.max(0, Math.min(5, Math.round(stars))); // nearest whole star (font-safe); number shows precision
    starsEl.textContent = `${'★'.repeat(full)}${'☆'.repeat(5 - full)}  ${stars.toFixed(1)}/5`;
    starsEl.style.display = '';
  } else {
    starsEl.style.display = 'none';
  }

  const countBase = scanning && !has
    ? 'Looking for reviews…'
    : `${summary.reviewCount} review${summary.reviewCount === 1 ? '' : 's'} scored`;
  q('.trulens-ov-count').textContent = (analyzed != null && analyzed > 0)
    ? `${countBase} · ${analyzed} AI-checked`
    : countBase;

  const total = summary.breakdown.genuine + summary.breakdown.mixed + summary.breakdown.fake || 1;
  (q('.trulens-ov-bar .g')).style.width = (summary.breakdown.genuine / total * 100) + '%';
  (q('.trulens-ov-bar .m')).style.width = (summary.breakdown.mixed / total * 100) + '%';
  (q('.trulens-ov-bar .f')).style.width = (summary.breakdown.fake / total * 100) + '%';

  q('.trulens-ov-progress').setAttribute('data-active', scanning ? 'true' : 'false');
}
