import { describe, it, expect } from 'vitest';
import { scoreReview } from '../src/scoring-core/score';
import { aggregate } from '../src/scoring-core/aggregate';
import type { Review } from '../src/types';

const genuine: Review = {
  id: 'g', text: 'Battery lasts all day and low-light photos are sharp. Three weeks of daily use and no issues.',
  rating: 5, author: 'A', verifiedPurchase: true, date: '2026-01-01',
  reviewerReviewCount: 14, isLocalGuide: null, helpfulCount: 6
};
const fake: Review = {
  id: 'f', text: 'BEST PRODUCT BUY NOW!!!', rating: 5, author: 'B',
  verifiedPurchase: false, date: '2026-01-01', reviewerReviewCount: 1,
  isLocalGuide: null, helpfulCount: 0
};

describe('scoreReview', () => {
  it('scores a genuine review high and green', () => {
    const r = scoreReview(genuine, []);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.verdict).toBe('genuine');
  });
  it('scores a spammy review low and red', () => {
    const r = scoreReview(fake, []);
    expect(r.score).toBeLessThan(40);
    expect(r.verdict).toBe('fake');
  });
  it('clamps to 0..100', () => {
    const r = scoreReview(fake, [{ ...fake, id: 'f2' }]);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('aggregate', () => {
  it('summarizes verdict counts', () => {
    const s = aggregate([scoreReview(genuine, []), scoreReview(fake, [])]);
    expect(s.reviewCount).toBe(2);
    expect(s.breakdown.genuine + s.breakdown.mixed + s.breakdown.fake).toBe(2);
  });
});
