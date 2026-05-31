import type { DeepAnalysisResult } from '../types';

export function reviewHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `tl_${(h >>> 0).toString(36)}`;
}

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function getCached(text: string): Promise<DeepAnalysisResult | null> {
  const key = reviewHash(text);
  const obj = await chrome.storage.local.get(key);
  const hit = obj[key] as { at: number; result: DeepAnalysisResult; text?: string } | undefined;
  if (hit && Date.now() - hit.at < TTL_MS && hit.text === text) return hit.result;
  return null;
}

export async function setCached(text: string, result: DeepAnalysisResult): Promise<void> {
  await chrome.storage.local.set({ [reviewHash(text)]: { at: Date.now(), result, text } });
}

export async function clearCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(k => k.startsWith('tl_') || k.startsWith('tlp_'));
  if (keys.length > 0) await chrome.storage.local.remove(keys);
}
