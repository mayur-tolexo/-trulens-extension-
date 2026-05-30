import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { googleMapsAdapter } from '../src/adapters/googleMaps';

const html = readFileSync(new URL('./fixtures/gmaps-reviews.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;

describe('googleMapsAdapter', () => {
  it('matches google maps urls', () => {
    expect(googleMapsAdapter.matches('https://www.google.com/maps/place/Cafe')).toBe(true);
    expect(googleMapsAdapter.matches('https://www.google.com/search?q=x')).toBe(false);
  });
  it('extracts reviews with local-guide and review counts', () => {
    const out = googleMapsAdapter.extractReviews(doc);
    expect(out.length).toBe(2);
    expect(out[0].review.rating).toBe(5);
    expect(out[0].review.isLocalGuide).toBe(true);
    expect(out[0].review.reviewerReviewCount).toBe(87);
    expect(out[1].review.reviewerReviewCount).toBe(1);
    expect(out[0].review.text).toContain('coffee');
  });
});
