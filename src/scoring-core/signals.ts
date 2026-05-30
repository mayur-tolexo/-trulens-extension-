import type { Review, Signal } from '../types';
import { sentimentScore } from './sentiment';

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Jaccard similarity over word sets. */
function similarity(a: string, b: string): number {
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function detectSignals(review: Review, siblings: Review[]): Signal[] {
  const out: Signal[] = [];
  const text = review.text ?? '';
  const words = normalize(text).split(' ').filter(Boolean);

  if (review.verifiedPurchase === true)
    out.push({ key: 'verified_purchase', label: 'Verified purchase', delta: +12 });
  if (review.verifiedPurchase === false)
    out.push({ key: 'unverified', label: 'Not a verified purchase', delta: -6 });

  if (words.length < 4)
    out.push({ key: 'too_short', label: 'Very short, generic review', delta: -15 });
  else if (words.length >= 20)
    out.push({ key: 'detailed', label: 'Detailed, specific review', delta: +8 });

  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 12 && letters === letters.toUpperCase())
    out.push({ key: 'all_caps', label: 'Excessive capitalization', delta: -10 });

  if (/(.)\1{3,}|!{3,}/.test(text))
    out.push({ key: 'repeated_punct', label: 'Repeated characters/punctuation', delta: -6 });

  if (review.rating != null) {
    const sent = sentimentScore(text);
    const norm = (review.rating - 3) / 2; // -1..1
    if (Math.abs(norm - sent) > 0.8 && Math.abs(sent) > 0.05)
      out.push({ key: 'rating_mismatch', label: 'Rating disagrees with the text', delta: -14 });
  }

  if (review.reviewerReviewCount != null && review.reviewerReviewCount <= 1)
    out.push({ key: 'single_review', label: 'Reviewer has only one review', delta: -8 });
  if (review.reviewerReviewCount != null && review.reviewerReviewCount >= 10)
    out.push({ key: 'established_reviewer', label: 'Established reviewer history', delta: +6 });

  if (review.isLocalGuide === true)
    out.push({ key: 'local_guide', label: 'Google Local Guide', delta: +6 });

  if (review.helpfulCount != null && review.helpfulCount >= 5)
    out.push({ key: 'helpful', label: 'Found helpful by others', delta: +5 });

  for (const sib of siblings) {
    if (sib.id !== review.id && similarity(text, sib.text ?? '') > 0.8) {
      out.push({ key: 'duplicate', label: 'Near-duplicate of another review', delta: -20 });
      break;
    }
  }

  return out;
}
