import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderBadge } from '../src/ui/badge';
import type { ScoreResult } from '../src/types';

const result: ScoreResult = { score: 82, verdict: 'genuine', signals: [{ key: 'verified_purchase', label: 'Verified purchase', delta: 12 }] };

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><div id="host"></div>');
  (globalThis as any).document = dom.window.document;
});

describe('renderBadge', () => {
  it('injects a shield badge with the verdict label', () => {
    const host = document.getElementById('host')!;
    renderBadge(host, 'afterbegin', result, () => {});
    const badge = host.querySelector('.trulens-badge')!;
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('data-verdict')).toBe('genuine');
    expect(badge.textContent).toContain('Likely genuine');
  });
  it('is idempotent (no double-inject)', () => {
    const host = document.getElementById('host')!;
    renderBadge(host, 'afterbegin', result, () => {});
    renderBadge(host, 'afterbegin', result, () => {});
    expect(host.querySelectorAll('.trulens-badge').length).toBe(1);
  });
});
