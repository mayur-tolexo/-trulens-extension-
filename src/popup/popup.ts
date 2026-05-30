import type { Settings } from '../types';

function send<T = any>(msg: any): Promise<T> {
  return new Promise((res) => chrome.runtime.sendMessage(msg, res));
}

async function load() {
  const resp = await send<{ ok: boolean; settings: Settings }>({ type: 'getSettings' });
  if (!resp?.ok) throw new Error('Settings unavailable');
  const settings = resp.settings;
  (document.getElementById('enabled') as HTMLInputElement).checked = settings.enabled;
  (document.getElementById('amazon') as HTMLInputElement).checked = settings.perSite.amazon;
  (document.getElementById('flipkart') as HTMLInputElement).checked = settings.perSite.flipkart;
  (document.getElementById('googleMaps') as HTMLInputElement).checked = settings.perSite.googleMaps;
  (document.getElementById('providerMode') as HTMLSelectElement).value = settings.providerMode;
  (document.getElementById('apiKey') as HTMLInputElement).value = settings.apiKey;
  (document.getElementById('baseUrl') as HTMLInputElement).value = settings.baseUrl;
  (document.getElementById('model') as HTMLInputElement).value = settings.model;
}

function wire() {
  const save = async () => {
    await send({ type: 'setSettings', patch: {
      enabled: (document.getElementById('enabled') as HTMLInputElement).checked,
      perSite: {
        amazon: (document.getElementById('amazon') as HTMLInputElement).checked,
        flipkart: (document.getElementById('flipkart') as HTMLInputElement).checked,
        googleMaps: (document.getElementById('googleMaps') as HTMLInputElement).checked
      },
      providerMode: (document.getElementById('providerMode') as HTMLSelectElement).value as Settings['providerMode'],
      apiKey: (document.getElementById('apiKey') as HTMLInputElement).value,
      baseUrl: (document.getElementById('baseUrl') as HTMLInputElement).value,
      model: (document.getElementById('model') as HTMLInputElement).value
    }});
  };
  document.querySelectorAll('input,select').forEach(el => el.addEventListener('change', save));
}

load().then(wire).catch(() => { document.body.insertAdjacentHTML('beforeend', '<p style="color:#b3261e">Settings unavailable — reopen the popup.</p>'); });
