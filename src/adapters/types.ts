import type { Review } from '../types';

export interface ExtractedReview { review: Review; anchor: Element; }

export interface SiteAdapter {
  key: 'amazon' | 'flipkart' | 'googleMaps';
  matches(url: string): boolean;
  extractReviews(root: ParentNode): ExtractedReview[];
  badgeMount(anchor: Element): { container: Element; position: InsertPosition };
  /** The product/place name for the current page, if discoverable. */
  pageName?(root: ParentNode): string | null;
}

export function hashId(prefix: string, text: string, author: string): string {
  let h = 0;
  const s = `${author}::${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${prefix}_${(h >>> 0).toString(36)}`;
}
