import './popup.css';
import type { ProductSummary, Settings } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function send<T = any>(msg: any): Promise<T> {
  return new Promise((res) => chrome.runtime.sendMessage(msg, res));
}

function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((res) =>
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => res(tabs[0]))
  );
}

function getSummary(tabId: number): Promise<{ ok: boolean; summary?: ProductSummary }> {
  return new Promise((res) => {
    chrome.tabs.sendMessage(tabId, { type: 'getPageSummary' }, (r) => {
      if (chrome.runtime.lastError || !r) return res({ ok: false });
      res(r);
    });
  });
}

// ── Verdict helpers ───────────────────────────────────────────────────────────

const VERDICT_LABELS: Record<string, string> = {
  genuine: 'Likely genuine',
  mixed: 'Mixed signals',
  fake: 'Likely fake',
};

const VERDICT_COLORS: Record<string, string> = {
  genuine: '#21a45a',
  mixed:   '#e0a700',
  fake:    '#d93636',
};

const TRACK_BG = '#e8eaf0';

function gaugeGradient(score: number, verdict: string): string {
  const color = VERDICT_COLORS[verdict] ?? '#21a45a';
  const deg = Math.round((score / 100) * 360);
  return `conic-gradient(${color} 0deg ${deg}deg, ${TRACK_BG} ${deg}deg 360deg)`;
}

// ── Render summary ────────────────────────────────────────────────────────────

function showEmpty() {
  const empty = document.getElementById('summary-empty')!;
  const content = document.getElementById('summary-content')!;
  empty.style.display = '';
  content.style.display = 'none';
}

function renderSummary(summary: ProductSummary) {
  const empty = document.getElementById('summary-empty')!;
  const content = document.getElementById('summary-content')!;
  empty.style.display = 'none';
  content.style.display = '';

  // Gauge
  const gauge = document.getElementById('gauge')!;
  gauge.style.background = gaugeGradient(summary.score, summary.verdict);

  const gaugeNum = document.getElementById('gauge-num')!;
  gaugeNum.textContent = String(summary.score);

  // Verdict pill
  const verdictPill = document.getElementById('verdict-pill')!;
  verdictPill.dataset.verdict = summary.verdict;

  const verdictLabel = document.getElementById('verdict-label')!;
  verdictLabel.textContent = VERDICT_LABELS[summary.verdict] ?? summary.verdict;

  // Review count
  const reviewCount = document.getElementById('review-count')!;
  reviewCount.textContent = 'Based on ' + summary.reviewCount + ' reviews on this page';

  // Breakdown bar
  const total = summary.breakdown.genuine + summary.breakdown.mixed + summary.breakdown.fake;
  const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0') + '%';

  (document.getElementById('bar-genuine') as HTMLElement).style.width = pct(summary.breakdown.genuine);
  (document.getElementById('bar-mixed')   as HTMLElement).style.width = pct(summary.breakdown.mixed);
  (document.getElementById('bar-fake')    as HTMLElement).style.width = pct(summary.breakdown.fake);

  // Legend counts
  const lg = document.getElementById('legend-genuine')!;
  const lm = document.getElementById('legend-mixed')!;
  const lf = document.getElementById('legend-fake')!;
  lg.textContent = summary.breakdown.genuine + ' genuine';
  lm.textContent = summary.breakdown.mixed + ' mixed';
  lf.textContent = summary.breakdown.fake + ' fake';
}

// ── Load settings ─────────────────────────────────────────────────────────────

async function loadSettings() {
  const resp = await send<{ ok: boolean; settings: Settings }>({ type: 'getSettings' });
  if (!resp?.ok) throw new Error('Settings unavailable');
  const s = resp.settings;
  (document.getElementById('enabled')      as HTMLInputElement).checked = s.enabled;
  (document.getElementById('amazon')       as HTMLInputElement).checked = s.perSite.amazon;
  (document.getElementById('flipkart')     as HTMLInputElement).checked = s.perSite.flipkart;
  (document.getElementById('googleMaps')   as HTMLInputElement).checked = s.perSite.googleMaps;
  (document.getElementById('providerMode') as HTMLSelectElement).value  = s.providerMode;
  (document.getElementById('apiKey')       as HTMLInputElement).value   = s.apiKey;
  (document.getElementById('baseUrl')      as HTMLInputElement).value   = s.baseUrl;
  (document.getElementById('model')        as HTMLInputElement).value   = s.model;
}

function wireSettings() {
  const save = async () => {
    await send({
      type: 'setSettings',
      patch: {
        enabled: (document.getElementById('enabled')    as HTMLInputElement).checked,
        perSite: {
          amazon:     (document.getElementById('amazon')     as HTMLInputElement).checked,
          flipkart:   (document.getElementById('flipkart')   as HTMLInputElement).checked,
          googleMaps: (document.getElementById('googleMaps') as HTMLInputElement).checked,
        },
        providerMode: (document.getElementById('providerMode') as HTMLSelectElement).value as Settings['providerMode'],
        apiKey:   (document.getElementById('apiKey')   as HTMLInputElement).value,
        baseUrl:  (document.getElementById('baseUrl')  as HTMLInputElement).value,
        model:    (document.getElementById('model')    as HTMLInputElement).value,
      },
    });
  };
  document.querySelectorAll('input, select').forEach((el) => el.addEventListener('change', save));
}

// ── Load summary ──────────────────────────────────────────────────────────────

async function loadSummary() {
  const tab = await getActiveTab();
  if (!tab?.id) { showEmpty(); return; }

  const result = await getSummary(tab.id);
  if (!result.ok || !result.summary || result.summary.reviewCount === 0) {
    showEmpty();
    return;
  }
  renderSummary(result.summary);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function showSettingsError() {
  const err = document.createElement('p');
  err.className = 'tl-error';
  err.textContent = 'Settings unavailable — reopen the popup.';
  document.body.appendChild(err);
}

loadSettings()
  .then(wireSettings)
  .catch(showSettingsError);

loadSummary();
