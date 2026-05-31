import { DEFAULT_SETTINGS, DEFAULT_PROXY_URL, type Settings } from '../types';

/** Heal a missing or stale (pre-deploy placeholder) proxy URL to the live one,
 *  so users who installed before the proxy was deployed get the free tier too. */
function migrate(s: Settings): Settings {
  const stale = !s.proxyUrl || /example\.|workers\.dev/.test(s.proxyUrl);
  if (stale && DEFAULT_PROXY_URL) s.proxyUrl = DEFAULT_PROXY_URL;
  return s;
}

export async function getSettings(): Promise<Settings> {
  const obj = await chrome.storage.local.get('settings');
  return migrate({ ...DEFAULT_SETTINGS, ...(obj.settings as Partial<Settings> | undefined) });
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch, perSite: { ...current.perSite, ...(patch.perSite ?? {}) } };
  await chrome.storage.local.set({ settings: next });
  return next;
}
