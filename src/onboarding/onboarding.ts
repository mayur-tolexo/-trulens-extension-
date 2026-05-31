import './onboarding.css';
import type { Settings } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function send<T = any>(msg: any): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        // Guard: if service worker is inactive, lastError is set and response is undefined.
        if (chrome.runtime.lastError) {
          resolve(undefined);
          return;
        }
        resolve(response as T);
      });
    } catch {
      resolve(undefined);
    }
  });
}

// ── Presets for provider modes ────────────────────────────────────────────────

const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  'openai-compatible': { baseUrl: 'https://api.minimax.io/v1',        model: 'MiniMax-M2' },
  'anthropic':         { baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7' },
  'proxy':             { baseUrl: '',                                  model: 'claude-sonnet-4-6' },
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

// ── Persist settings on change ────────────────────────────────────────────────

async function saveSettings(): Promise<void> {
  const patch: Partial<Settings> = {
    providerMode: (el<HTMLSelectElement>('providerMode')).value as Settings['providerMode'],
    baseUrl:      (el<HTMLInputElement>('baseUrl')).value,
    model:        (el<HTMLInputElement>('model')).value,
    apiKey:       (el<HTMLInputElement>('apiKey')).value,
  };
  await send({ type: 'setSettings', patch });
}

// ── Load settings into form ───────────────────────────────────────────────────

async function loadSettings(): Promise<void> {
  const resp = await send<{ ok: boolean; settings: Settings }>({ type: 'getSettings' });
  if (!resp?.ok || !resp.settings) return;

  const s = resp.settings;
  (el<HTMLSelectElement>('providerMode')).value = s.providerMode;
  (el<HTMLInputElement>('baseUrl')).value       = s.baseUrl;
  (el<HTMLInputElement>('model')).value         = s.model;
  (el<HTMLInputElement>('apiKey')).value        = s.apiKey;
}

// ── Wire provider select → prefill presets ────────────────────────────────────

function wireProviderSelect(): void {
  const providerSel = el<HTMLSelectElement>('providerMode');
  providerSel.addEventListener('change', () => {
    const preset = PRESETS[providerSel.value];
    if (preset) {
      (el<HTMLInputElement>('baseUrl')).value = preset.baseUrl;
      (el<HTMLInputElement>('model')).value   = preset.model;
    }
    saveSettings();
  });
}

// ── Wire field change → persist ───────────────────────────────────────────────

function wireFieldSave(): void {
  const ids = ['baseUrl', 'model', 'apiKey'] as const;
  for (const id of ids) {
    el(id).addEventListener('change', saveSettings);
  }
}

// ── Wire Test connection button ───────────────────────────────────────────────

function wireTestButton(): void {
  const btn    = el<HTMLButtonElement>('test-btn');
  const status = el<HTMLElement>('test-status');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.className = 'ob-test-status ob-testing';
    status.textContent = 'Testing… (reasoning models take a few seconds)';

    // Persist current field values before testing
    await saveSettings();

    const r = await send<{ ok: boolean; score?: number; reasoning?: string; error?: string }>({ type: 'testConnection' });

    if (r?.ok) {
      status.className = 'ob-test-status ob-ok';
      status.textContent = `✓ Connected — sample review scored ${r.score}/100.`;
    } else {
      status.className = 'ob-test-status ob-fail';
      status.textContent = `✗ ${r?.error ?? 'Test failed — check your key and base URL.'}`;
    }

    btn.disabled = false;
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadSettings().then(() => {
  wireProviderSelect();
  wireFieldSave();
  wireTestButton();
}).catch(() => {
  // Service worker may not be available; silently degrade — the form still works
  // and saves once the background wakes up.
  wireProviderSelect();
  wireFieldSave();
  wireTestButton();
});
