import type { ProductSummary, ScoreResult } from '../types';

export interface PlaceCache {
  name: string | null;
  reviewCount: number;
  summary: ProductSummary;
  perReview: Record<string, ScoreResult>;
  at: number;
}

const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const MAX_REVIEWS = 200;
const k = (placeId: string) => `tlp_${placeId}`;

export async function getPlace(placeId: string): Promise<PlaceCache | null> {
  const key = k(placeId);
  const obj = await chrome.storage.local.get(key);
  const hit = obj[key] as PlaceCache | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  return null;
}

export async function setPlace(placeId: string, data: PlaceCache): Promise<void> {
  const entries = Object.entries(data.perReview).slice(0, MAX_REVIEWS);
  const trimmed: PlaceCache = { ...data, perReview: Object.fromEntries(entries), at: Date.now() };
  await chrome.storage.local.set({ [k(placeId)]: trimmed });
}
