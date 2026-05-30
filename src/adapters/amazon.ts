import type { SiteAdapter, ExtractedReview } from './types';
import type { Review } from '../types';

function hashId(text: string, author: string): string {
  let h = 0;
  const s = `${author}::${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `a_${(h >>> 0).toString(36)}`;
}

function num(re: RegExp, s: string | null | undefined): number | null {
  const m = (s ?? '').match(re);
  return m ? Number(m[1]) : null;
}

export const amazonAdapter: SiteAdapter = {
  key: 'amazon',
  matches: (url) => /(^|\.)amazon\.(com|in|co\.[a-z]+)\b/.test(new URL(url).hostname),
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
        id: hashId(text, author ?? ''), text,
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
