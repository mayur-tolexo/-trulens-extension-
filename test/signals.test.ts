import { describe, it, expect } from 'vitest';
import { detectSignals } from '../src/scoring-core/signals';
import type { Review } from '../src/types';

const base: Review = {
  id: 'r1', text: 'Battery lasts all day and the camera is sharp in low light. Used for three weeks.',
  rating: 5, author: 'A', verifiedPurchase: true, date: '2026-01-01',
  reviewerReviewCount: 12, isLocalGuide: null, helpfulCount: 4
};

describe('detectSignals', () => {
  it('rewards verified purchase', () => {
    const s = detectSignals(base, []);
    expect(s.find(x => x.key === 'verified_purchase')?.delta).toBeGreaterThan(0);
  });
  it('penalizes very short generic text', () => {
    const s = detectSignals({ ...base, text: 'good product' }, []);
    expect(s.find(x => x.key === 'too_short')?.delta).toBeLessThan(0);
  });
  it('penalizes ALL CAPS shouting', () => {
    const s = detectSignals({ ...base, text: 'BEST PRODUCT EVER BUY NOW AMAZING DEAL' }, []);
    expect(s.find(x => x.key === 'all_caps')?.delta).toBeLessThan(0);
  });
  it('penalizes rating/sentiment mismatch', () => {
    const s = detectSignals({ ...base, rating: 1, text: 'absolutely love it, excellent great quality' }, []);
    expect(s.find(x => x.key === 'rating_mismatch')?.delta).toBeLessThan(0);
  });
  it('penalizes near-duplicate of a sibling', () => {
    const sib = { ...base, id: 'r2' };
    const s = detectSignals({ ...base, id: 'r3' }, [sib]);
    expect(s.find(x => x.key === 'duplicate')?.delta).toBeLessThan(0);
  });
});
