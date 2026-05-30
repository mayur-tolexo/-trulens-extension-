import type { SiteAdapter, ExtractedReview } from './types';
import type { Review } from '../types';

function hashId(text: string, author: string): string {
  let h = 0; const s = `${author}::${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `g_${(h >>> 0).toString(36)}`;
}

/** Review prose: prefer the known text classes, else the longest leaf-ish text span. */
function reviewText(el: Element): string {
  const known = el.querySelector('.wiI7pd, .MyEned')?.textContent?.trim();
  if (known) return known;
  let best = '';
  for (const n of Array.from(el.querySelectorAll('span'))) {
    const t = n.textContent?.trim() ?? '';
    if (t.length > best.length && t.length >= 15 && t.length <= 1500 && !/Local Guide|reviews?\b|photos?\b/i.test(t)) {
      best = t;
    }
  }
  return best;
}

export const googleMapsAdapter: SiteAdapter = {
  key: 'googleMaps',
  matches: (url) => {
    try {
      const u = new URL(url);
      return /(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith('/maps');
    } catch { return false; }
  },
  extractReviews(root) {
    const out: ExtractedReview[] = [];
    // Primary: the stable data-review-id container. Fallback: legacy class.
    let nodes = Array.from(root.querySelectorAll('div[data-review-id]'));
    if (nodes.length === 0) nodes = Array.from(root.querySelectorAll('.jftiEf'));

    for (const el of nodes) {
      const text = reviewText(el);
      if (!text || text.length < 3) continue;

      const author = el.querySelector('.d4r55')?.textContent?.trim()
        ?? el.querySelector('button[aria-label]')?.getAttribute('aria-label')?.trim()
        ?? null;

      const meta = el.querySelector('.RfnDt')?.textContent ?? el.textContent ?? '';
      const isLocalGuide = /Local Guide/i.test(meta);
      const cm = meta.match(/([0-9,]+)\s+reviews?/i);
      const reviewerReviewCount = cm ? Number(cm[1].replace(/,/g, '')) : null;
      const pm = meta.match(/([0-9,]+)\s+photos?/i);
      const reviewerPhotoCount = pm ? Number(pm[1].replace(/,/g, '')) : null;

      const ratingEl = el.querySelector('[role="img"][aria-label*="star" i], .kvMYJc[aria-label]');
      const ratingLabel = ratingEl?.getAttribute('aria-label') ?? '';
      const rm = ratingLabel.match(/([0-9](?:\.[0-9])?)\s*star/i);
      const rating = rm ? Math.round(Number(rm[1])) : null;

      const review: Review = {
        id: hashId(text, author ?? ''), text,
        rating, author, verifiedPurchase: null, date: null,
        reviewerReviewCount, isLocalGuide, helpfulCount: null,
        reviewerPhotoCount
      };
      out.push({ review, anchor: el });
    }
    return out;
  },
  badgeMount: (anchor) => ({ container: anchor, position: 'afterbegin' }),
  pageName: (root) => {
    // The place-panel title; avoid the search-results "Results" heading.
    const h = root.querySelector('h1.DUwDvf')?.textContent?.trim();
    if (h && !/^results$/i.test(h)) return h;
    // Most reliable: the place name is in the URL path /place/<name>/.
    const m = location.pathname.match(/\/place\/([^/@]+)/);
    if (m) { try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() || null; } catch { return m[1].replace(/\+/g, ' '); } }
    return null;
  }
};
