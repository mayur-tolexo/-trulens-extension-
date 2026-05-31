import type { SiteAdapter, ExtractedReview } from './types';
import { hashId } from './types';
import type { Review } from '../types';

function num(re: RegExp, s: string | null | undefined): number | null {
  const m = (s ?? '').match(re);
  return m ? Number(m[1]) : null;
}

export const amazonAdapter: SiteAdapter = {
  key: 'amazon',
  matches: (url) => { try { return /(^|\.)amazon\.(com|in|co\.[a-z]{2}|com\.[a-z]{2})$/.test(new URL(url).hostname); } catch { return false; } },
  extractReviews(root) {
    const out: ExtractedReview[] = [];
    for (const el of Array.from(root.querySelectorAll('[data-hook="review"]'))) {
      const text = el.querySelector('[data-hook="review-body"]')?.textContent?.trim() ?? '';
      if (!text) continue;
      const author = el.querySelector('.a-profile-name')?.textContent?.trim() ?? null;
      const rating = num(/([0-9.]+) out of 5/, el.querySelector('[data-hook="review-star-rating"] .a-icon-alt')?.textContent);
      const verifiedPurchase = !!el.querySelector('[data-hook="avp-badge"]');
      const helpfulCount = num(/([0-9,]+)\s+people/, el.querySelector('[data-hook="helpful-vote-statement"]')?.textContent?.replace(/,/g, ''));
      const review: Review = {
        id: hashId('a', text, author ?? ''), text,
        rating: rating == null ? null : Math.round(rating),
        author, verifiedPurchase, date: null,
        reviewerReviewCount: null, isLocalGuide: null, helpfulCount
      };
      out.push({ review, anchor: el });
    }
    return out;
  },
  badgeMount: (anchor) => ({ container: anchor, position: 'afterbegin' }),
  pageName: (root) => root.querySelector('#productTitle')?.textContent?.trim() || null
};
