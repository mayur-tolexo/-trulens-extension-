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
