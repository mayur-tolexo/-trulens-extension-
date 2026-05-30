import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { flipkartAdapter } from '../src/adapters/flipkart';

const html = readFileSync(new URL('./fixtures/flipkart-reviews.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;

describe('flipkartAdapter', () => {
  it('matches flipkart urls', () => {
    expect(flipkartAdapter.matches('https://www.flipkart.com/p/itm')).toBe(true);
    expect(flipkartAdapter.matches('https://amazon.in/x')).toBe(false);
  });
  it('extracts reviews', () => {
    const out = flipkartAdapter.extractReviews(doc);
    expect(out.length).toBe(2);
    expect(out[0].review.rating).toBe(5);
    expect(out[0].review.verifiedPurchase).toBe(true);
    expect(out[0].review.author).toBe('Rohan S');
    expect(out[0].review.text).toContain('Battery');
  });
});
