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
  it('does NOT flag a positive long 5-star review as a mismatch', () => {
    const s = detectSignals({ ...base, rating: 5, text: 'A good place for food and great ambience, my kid enjoyed the continental food and we tried Bengali fish and chicken, authentic Bengali food, must try in and around JP Nagar, dungeon theme indeed' }, []);
    expect(s.find(x => x.key === 'rating_mismatch')).toBeUndefined();
  });
  it('does NOT penalize ellipses as repeated punctuation', () => {
    const s = detectSignals({ ...base, text: 'We visited thrice and ordered authentic items.... It was full worthy of money....' }, []);
    expect(s.find(x => x.key === 'repeated_punct')).toBeUndefined();
  });
  it('still penalizes spammy !!! and repeated letters', () => {
    expect(detectSignals({ ...base, text: 'loooove it so good' }, []).find(x => x.key === 'repeated_punct')?.delta).toBeLessThan(0);
    expect(detectSignals({ ...base, text: 'best ever!!!' }, []).find(x => x.key === 'repeated_punct')?.delta).toBeLessThan(0);
  });
  it('treats a reviewer with 5+ reviews as established', () => {
    const s = detectSignals({ ...base, reviewerReviewCount: 5 }, []);
    expect(s.find(x => x.key === 'established_reviewer')?.delta).toBeGreaterThan(0);
  });
  it('penalizes near-duplicate of a sibling', () => {
    const sib = { ...base, id: 'r2' };
    const s = detectSignals({ ...base, id: 'r3' }, [sib]);
    expect(s.find(x => x.key === 'duplicate')?.delta).toBeLessThan(0);
  });
  it('penalizes unverified purchase', () => {
    const s = detectSignals({ ...base, verifiedPurchase: false }, []);
    expect(s.find(x => x.key === 'unverified')?.delta).toBeLessThan(0);
  });
  it('rewards detailed review (>=20 words)', () => {
    const longText = 'the battery lasts all day camera is sharp screen is bright build quality is solid and performance is excellent overall very happy with purchase';
    const s = detectSignals({ ...base, verifiedPurchase: null, reviewerReviewCount: 5, helpfulCount: 0, text: longText }, []);
    expect(s.find(x => x.key === 'detailed')?.delta).toBeGreaterThan(0);
  });
  it('penalizes repeated punctuation', () => {
    const s = detectSignals({ ...base, text: 'great great great!!!!' }, []);
    expect(s.find(x => x.key === 'repeated_punct')?.delta).toBeLessThan(0);
  });
  it('penalizes reviewer with only one review', () => {
    const s = detectSignals({ ...base, reviewerReviewCount: 1 }, []);
    expect(s.find(x => x.key === 'single_review')?.delta).toBeLessThan(0);
  });
  it('rewards established reviewer (>=10 reviews)', () => {
    const s = detectSignals({ ...base, reviewerReviewCount: 10 }, []);
    expect(s.find(x => x.key === 'established_reviewer')?.delta).toBeGreaterThan(0);
  });
  it('rewards local guide', () => {
    const s = detectSignals({ ...base, isLocalGuide: true }, []);
    expect(s.find(x => x.key === 'local_guide')?.delta).toBeGreaterThan(0);
  });
  it('rewards review found helpful by others (>=5)', () => {
    const s = detectSignals({ ...base, helpfulCount: 5 }, []);
    expect(s.find(x => x.key === 'helpful')?.delta).toBeGreaterThan(0);
  });
});
