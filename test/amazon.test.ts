import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { amazonAdapter } from '../src/adapters/amazon';

const html = readFileSync(new URL('./fixtures/amazon-reviews.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;

describe('amazonAdapter', () => {
  it('matches amazon urls', () => {
    expect(amazonAdapter.matches('https://www.amazon.in/dp/B0/reviews')).toBe(true);
    expect(amazonAdapter.matches('https://flipkart.com/x')).toBe(false);
  });
  it('extracts reviews with fields', () => {
    const out = amazonAdapter.extractReviews(doc);
    expect(out.length).toBe(2);
    const first = out[0].review;
    expect(first.rating).toBe(5);
    expect(first.verifiedPurchase).toBe(true);
    expect(first.author).toBe('Rahul K');
    expect(first.helpfulCount).toBe(7);
    expect(first.text).toContain('Battery');
  });
});
