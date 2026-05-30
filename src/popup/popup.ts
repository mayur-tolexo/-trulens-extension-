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

interface SummaryResp {
  ok: boolean;
  name?: string | null;
  summary?: ProductSummary;
  debug?: { adapter: string | null; scored: number; probe: Record<string, number> };
}

function getSummary(tabId: number): Promise<SummaryResp> {
  return new Promise((res) => {
    chrome.tabs.sendMessage(tabId, { type: 'getPageSummary' }, (r) => {
      if (chrome.runtime.lastError || !r) return res({ ok: false });
      res(r as SummaryResp);
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

function showEmpty(msg?: string) {
  const empty = document.getElementById('summary-empty')!;
  const content = document.getElementById('summary-content')!;
  empty.style.display = '';
  content.style.display = 'none';
  if (msg) {
    const textEl = empty.querySelector('.tl-empty-text');
    if (textEl) textEl.textContent = msg;
  }
}

function renderSummary(summary: ProductSummary, name?: string | null) {
  const empty = document.getElementById('summary-empty')!;
  const content = document.getElementById('summary-content')!;
  empty.style.display = 'none';
  content.style.display = '';

  // Product / place name
  const nameEl = document.getElementById('place-name')!;
  if (name) { nameEl.textContent = name; nameEl.style.display = ''; }
  else { nameEl.style.display = 'none'; }

  // Gauge
  const gauge = document.getElementById('gauge')!;
  gauge.style.background = gaugeGradient(summary.score, summary.verdict);

  const gaugeNum = document.getElementById('gauge-num')!;
  gaugeNum.textContent = String(summary.score);

  // 5-star rating from our analysis (0–100 → 0–5)
  const stars = Math.round(summary.score / 20 * 10) / 10;
  const full = Math.round(stars);
  (document.getElementById('stars')!).textContent =
    `${'★'.repeat(full)}${'☆'.repeat(5 - full)}  ${stars.toFixed(1)}/5`;

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
  (document.getElementById('autoDeep')     as HTMLInputElement).checked = s.autoDeep;
  (document.getElementById('amazon')       as HTMLInputElement).checked = s.perSite.amazon;
  (document.getElementById('flipkart')     as HTMLInputElement).checked = s.perSite.flipkart;
  (document.getElementById('googleMaps')   as HTMLInputElement).checked = s.perSite.googleMaps;
  (document.getElementById('providerMode') as HTMLSelectElement).value  = s.providerMode;
  (document.getElementById('apiKey')       as HTMLInputElement).value   = s.apiKey;
  (document.getElementById('baseUrl')      as HTMLInputElement).value   = s.baseUrl;
  (document.getElementById('model')        as HTMLInputElement).value   = s.model;
}

// Picking a provider auto-fills sensible base URL + model so it works out of the box.
const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  'openai-compatible': { baseUrl: 'https://api.minimax.io/v1',        model: 'MiniMax-M2' },
  'anthropic':         { baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7' },
  'proxy':             { baseUrl: '',                                 model: 'claude-sonnet-4-6' },
};

async function saveSettings() {
  await send({
    type: 'setSettings',
    patch: {
      enabled: (document.getElementById('enabled')    as HTMLInputElement).checked,
      autoDeep: (document.getElementById('autoDeep')  as HTMLInputElement).checked,
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
}

function wireSettings() {
  document.querySelectorAll('input, select').forEach((el) => el.addEventListener('change', saveSettings));

  // On provider change, apply the preset base URL + model, then save.
  const providerSel = document.getElementById('providerMode') as HTMLSelectElement;
  providerSel.addEventListener('change', () => {
    const preset = PRESETS[providerSel.value];
    if (preset) {
      (document.getElementById('baseUrl') as HTMLInputElement).value = preset.baseUrl;
      (document.getElementById('model')   as HTMLInputElement).value = preset.model;
      saveSettings();
    }
  });
}

function wireTest() {
  const btn = document.getElementById('test-btn') as HTMLButtonElement;
  const status = document.getElementById('test-status')!;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.className = 'tl-test-status tl-testing';
    status.textContent = 'Testing… (reasoning models take a few seconds)';
    await saveSettings(); // persist current field values first
    const r = await send<{ ok: boolean; score?: number; reasoning?: string; error?: string }>({ type: 'testConnection' });
    if (r?.ok) {
      status.className = 'tl-test-status tl-ok';
      status.textContent = `✓ Connected — sample review scored ${r.score}/100.`;
    } else {
      status.className = 'tl-test-status tl-fail';
      status.textContent = `✗ ${r?.error ?? 'Test failed.'}`;
    }
    btn.disabled = false;
  });
}

// ── Load summary ──────────────────────────────────────────────────────────────

async function loadSummary() {
  const tab = await getActiveTab();
  if (!tab?.id) { showEmpty(); return; }

  const result = await getSummary(tab.id);
  if (!result.ok) {
    showEmpty('TruLens isn’t running on this tab yet — reload the page (Cmd+Shift+R), then reopen this popup.');
    return;
  }
  if (!result.summary || result.summary.reviewCount === 0) {
    const d = result.debug;
    if (d?.adapter) {
      const probe = Object.entries(d.probe ?? {}).map(([k, v]) => `${k}:${v}`).join('  ·  ');
      showEmpty(`Found 0 reviews on “${d.adapter}”. Scroll through the reviews. If it persists, screenshot this → DOM probe: ${probe}`);
    } else {
      showEmpty();
    }
    return;
  }
  renderSummary(result.summary, result.name);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function showSettingsError() {
  const err = document.createElement('p');
  err.className = 'tl-error';
  err.textContent = 'Settings unavailable — reopen the popup.';
  document.body.appendChild(err);
}

loadSettings()
  .then(() => { wireSettings(); wireTest(); })
  .catch(showSettingsError);

loadSummary();

// Opening the popup (clicking the extension icon) re-shows the on-page panel
// if the user had closed it.
(async () => {
  const tab = await getActiveTab();
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'showOverlay' }, () => void chrome.runtime.lastError);
})();
