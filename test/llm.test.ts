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
    const r = buildRequest(review, [], s({ providerMode: 'anthropic', baseUrl: '', apiKey: 'sk-ant', model: 'claude-sonnet-4-6' }));
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers['x-api-key']).toBe('sk-ant');
    expect(JSON.parse(r.body).model).toBe('claude-sonnet-4-6');
  });
  it('proxy: posts to proxyUrl', () => {
    const r = buildRequest(review, [], s({ providerMode: 'proxy', proxyUrl: 'https://proxy.test/analyze' }));
    expect(r.url).toBe('https://proxy.test/analyze');
  });
  it('anthropic: custom baseUrl (MiniMax) builds /v1/messages with Bearer auth', () => {
    const r = buildRequest(review, [], s({ providerMode: 'anthropic', baseUrl: 'https://api.minimax.io/anthropic', apiKey: 'mk', model: 'MiniMax-M2.7' }));
    expect(r.url).toBe('https://api.minimax.io/anthropic/v1/messages');
    expect(r.headers['authorization']).toBe('Bearer mk');
    expect(JSON.parse(r.body).model).toBe('MiniMax-M2.7');
  });
  it('anthropic: empty baseUrl falls back to official Anthropic and sets x-api-key', () => {
    const r = buildRequest(review, [], s({ providerMode: 'anthropic', baseUrl: '', apiKey: 'sk' }));
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers['x-api-key']).toBe('sk');
  });
  it('anthropic: trailing slash on baseUrl is stripped', () => {
    const r = buildRequest(review, [], s({ providerMode: 'anthropic', baseUrl: 'https://api.minimax.io/anthropic/' }));
    expect(r.url).toBe('https://api.minimax.io/anthropic/v1/messages');
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
  it('strips <think> blocks from OpenAI reasoning-model content', () => {
    const out = extractText('openai-compatible', { choices: [{ message: { content: '<think>let me think</think>\n```json\n{"score":80}\n```' } }] });
    expect(out).not.toContain('<think>');
    expect(out).toContain('"score":80');
    expect(extractText('openai-compatible', { choices: [{ message: { content: '<think>x</think> pong' } }] })).toBe('pong');
  });
  it('picks the text block from Anthropic content when a thinking block comes first', () => {
    const json = { content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: '{"score":80}' }] };
    expect(extractText('anthropic', json)).toBe('{"score":80}');
  });
  it('returns empty string when no usable content block exists', () => {
    expect(extractText('anthropic', { content: [{ type: 'thinking', thinking: '...' }] })).toBe('');
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
