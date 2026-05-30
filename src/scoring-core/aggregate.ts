import type { ScoreResult, ProductSummary } from '../types';
import { verdictFor } from './score';

export function aggregate(results: ScoreResult[]): ProductSummary {
  const breakdown = { genuine: 0, mixed: 0, fake: 0 };
  for (const r of results) breakdown[r.verdict]++;
  const avg = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const score = Math.round(avg);
  return { score, verdict: verdictFor(score), reviewCount: results.length, breakdown };
}
