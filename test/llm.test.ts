import { describe, it, expect } from 'vitest';
import { buildRequest, extractText, parseResult } from '../src/background/llm';
import { DEFAULT_SETTINGS, type Settings } from '../src/types';
import type { Review } from '../src/types';

const review: Review = { id: 'r', text: 'Solid phone, great battery.', rating: 5, author: 'A', verifiedPurchase: true, date: null, reviewerReviewCount: 5, isLocalGuide: null, helpfulCount: 2 };
const s = (p: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...p });

describe('buildRequest', () => {
  it('openai-compatible: posts to {baseUrl}/chat/completions with Bearer auth and model in body', () => {
    const r = buildRequest(review, [], s({ providerMode: 'openai-compatible', baseUrl: 'https://api.minimax.io/v1', apiKey: 'k', model: 'MiniMax-M2' }));
    expect(r.url).toBe('https://api.minimax.io/v1/chat/completions');
    expect(r.headers['authorization']).toBe('Bearer k');
    const body = JSON.parse(r.body);
    expect(body.model).toBe('MiniMax-M2');
    expect(body.messages[0].role).toBe('user');
  });
  it('openai-compatible: strips a trailing slash from baseUrl', () => {
    const r = buildRequest(review, [], s({ providerMode: 'openai-compatible', baseUrl: 'https://x.test/v1/' }));
    expect(r.url).toBe('https://x.test/v1/chat/completions');
  });
  it('anthropic: posts to anthropic messages with x-api-key', () => {
    const r = buildRequest(review, [], s({ providerMode: 'anthropic', apiKey: 'sk-ant', model: 'claude-sonnet-4-6' }));
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers['x-api-key']).toBe('sk-ant');
    expect(JSON.parse(r.body).model).toBe('claude-sonnet-4-6');
  });
  it('proxy: posts to proxyUrl', () => {
    const r = buildRequest(review, [], s({ providerMode: 'proxy', proxyUrl: 'https://proxy.test/analyze' }));
    expect(r.url).toBe('https://proxy.test/analyze');
  });
});

describe('extractText', () => {
  it('reads OpenAI shape', () => {
    expect(extractText('openai-compatible', { choices: [{ message: { content: 'hi' } }] })).toBe('hi');
  });
  it('reads Anthropic shape', () => {
    expect(extractText('anthropic', { content: [{ text: 'hi' }] })).toBe('hi');
    expect(extractText('proxy', { content: [{ text: 'hi' }] })).toBe('hi');
  });
});

describe('parseResult', () => {
  it('parses score+reasoning JSON and maps verdict', () => {
    const r = parseResult('Here: {"score": 85, "reasoning": "specific and detailed"}');
    expect(r.score).toBe(85);
    expect(r.verdict).toBe('genuine');
    expect(r.reasoning).toContain('specific');
  });
  it('falls back when no JSON present', () => {
    expect(parseResult('no json here').score).toBe(50);
  });
  it('falls back when JSON is malformed', () => {
    expect(parseResult('{score: 85 oops}').score).toBe(50);
  });
  it('clamps out-of-range scores', () => {
    expect(parseResult('{"score": 999}').score).toBe(100);
  });
});
