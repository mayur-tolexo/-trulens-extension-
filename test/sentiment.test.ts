import { describe, it, expect } from 'vitest';
import { sentimentScore } from '../src/scoring-core/sentiment';

describe('sentimentScore', () => {
  it('is positive for praise', () => {
    expect(sentimentScore('excellent great love amazing')).toBeGreaterThan(0);
  });
  it('is negative for complaints', () => {
    expect(sentimentScore('terrible awful broke hate')).toBeLessThan(0);
  });
  it('is ~0 for neutral text', () => {
    expect(sentimentScore('the box arrived on tuesday')).toBe(0);
  });
});
