import type { ScoreResult, ProductSummary } from '../types';
import { verdictFor } from './score';

export function aggregate(results: ScoreResult[]): ProductSummary {
  // no reviews scored yet → neutral; callers check reviewCount === 0 to show "no reviews".
  if (results.length === 0)
    return { score: 50, verdict: 'mixed', reviewCount: 0, breakdown: { genuine: 0, mixed: 0, fake: 0 } };
  const breakdown = { genuine: 0, mixed: 0, fake: 0 };
  for (const r of results) breakdown[r.verdict]++;
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
  const score = Math.round(avg);
  return { score, verdict: verdictFor(score), reviewCount: results.length, breakdown };
}
