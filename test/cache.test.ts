import { describe, it, expect } from 'vitest';
import { reviewHash } from '../src/background/cache';

describe('reviewHash', () => {
  it('is stable for the same text', () => {
    expect(reviewHash('hello world')).toBe(reviewHash('hello world'));
  });
  it('differs for different text', () => {
    expect(reviewHash('a')).not.toBe(reviewHash('b'));
  });
});
