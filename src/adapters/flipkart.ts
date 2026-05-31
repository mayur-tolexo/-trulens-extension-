import type { SiteAdapter, ExtractedReview } from './types';
import { hashId } from './types';
import type { Review } from '../types';

export const flipkartAdapter: SiteAdapter = {
  key: 'flipkart',
  matches: (url) => /(^|\.)flipkart\.com$/.test(new URL(url).hostname),
  extractReviews(root) {
    const out: ExtractedReview[] = [];
    for (const el of Array.from(root.querySelectorAll('.EPCmJX'))) {
      const text = el.querySelector('.ZmyHeo')?.textContent?.trim() ?? '';
      if (!text) continue;
      const ratingText = el.querySelector('.XQDdHH')?.textContent?.match(/[0-9]/)?.[0];
      const author = el.querySelector('._2NsDsF')?.textContent?.trim() ?? null;
      const verifiedPurchase = /Certified Buyer/i.test(el.textContent ?? '');
      const helpful = el.querySelector('._6kK6mk span')?.textContent?.replace(/,/g, '').match(/[0-9]+/)?.[0];
      const review: Review = {
        id: hashId('f', text, author ?? ''), text,
        rating: ratingText ? Number(ratingText) : null,
        author, verifiedPurchase, date: null,
        reviewerReviewCount: null, isLocalGuide: null,
        helpfulCount: helpful ? Number(helpful) : null
      };
      out.push({ review, anchor: el });
    }
    return out;
  },
  badgeMount: (anchor) => ({ container: anchor, position: 'afterbegin' }),
  pageName: (root) => root.querySelector('.B_NuCI, h1 span')?.textContent?.trim() || null
};
