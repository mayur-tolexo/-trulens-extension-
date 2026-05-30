import { DEFAULT_SETTINGS, type Settings } from '../types';

export async function getSettings(): Promise<Settings> {
  const obj = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(obj.settings as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
