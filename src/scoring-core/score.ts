import type { Review, ScoreResult, Verdict } from '../types';
import { detectSignals } from './signals';

export function verdictFor(score: number): Verdict {
  if (score >= 70) return 'genuine';
  if (score >= 40) return 'mixed';
  return 'fake';
}

export function scoreReview(review: Review, siblings: Review[]): ScoreResult {
  const signals = detectSignals(review, siblings);
  const raw = 60 + signals.reduce((sum, s) => sum + s.delta, 0); // neutral baseline 60
  const score = Math.max(0, Math.min(100, raw));
  return { score, verdict: verdictFor(score), signals };
}
