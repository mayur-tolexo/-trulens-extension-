import type { SiteAdapter, ExtractedReview } from './types';
import type { Review } from '../types';

function hashId(text: string, author: string): string {
  let h = 0; const s = `${author}::${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `g_${(h >>> 0).toString(36)}`;
}

export const googleMapsAdapter: SiteAdapter = {
  key: 'googleMaps',
  matches: (url) => {
    const u = new URL(url);
    return u.hostname.endsWith('google.com') && u.pathname.startsWith('/maps');
  },
  extractReviews(root) {
    const out: ExtractedReview[] = [];
    for (const el of Array.from(root.querySelectorAll('.jftiEf'))) {
      const text = el.querySelector('.wiI7pd')?.textContent?.trim() ?? '';
      if (!text) continue;
      const author = el.querySelector('.d4r55')?.textContent?.trim() ?? null;
      const meta = el.querySelector('.RfnDt')?.textContent ?? '';
      const isLocalGuide = /Local Guide/i.test(meta);
      const reviewerReviewCount = meta.match(/([0-9,]+)\s+review/) ? Number(meta.match(/([0-9,]+)\s+review/)![1].replace(/,/g, '')) : null;
      const rating = el.querySelector('.kvMYJc')?.getAttribute('aria-label')?.match(/([0-9])\s*star/)?.[1];
      const review: Review = {
        id: hashId(text, author ?? ''), text,
        rating: rating ? Number(rating) : null,
        author, verifiedPurchase: null, date: null,
        reviewerReviewCount, isLocalGuide,
        helpfulCount: null
      };
      out.push({ review, anchor: el });
    }
    return out;
  },
  badgeMount: (anchor) => ({ container: anchor, position: 'afterbegin' })
};
