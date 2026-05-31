import { describe, it, expect } from 'vitest';
import { buildRequest, extractText, parseResult, parseBatch } from '../src/background/llm';
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
  it('anthropic: official Anthropic does not set authorization header', () => {
    const r = buildRequest(review, [], s({ providerMode: 'anthropic', baseUrl: '', apiKey: 'sk-ant' }));
    expect(r.headers['authorization']).toBeUndefined();
    expect(r.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });
  it('anthropic: custom baseUrl does not set dangerous-direct-browser-access', () => {
    const r = buildRequest(review, [], s({ providerMode: 'anthropic', baseUrl: 'https://api.minimax.io/anthropic', apiKey: 'mk' }));
    expect(r.headers['anthropic-dangerous-direct-browser-access']).toBeUndefined();
    expect(r.headers['x-api-key']).toBeUndefined();
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

describe('parseBatch', () => {
  it('parses a valid batch JSON array and returns n results in order', () => {
    const raw = '[{"i":1,"score":80,"reasoning":"looks real"},{"i":2,"score":30,"reasoning":"generic text"}]';
    const results = parseBatch(raw, 2);
    expect(results).toHaveLength(2);
    expect(results[0].score).toBe(80);
    expect(results[0].verdict).toBe('genuine');
    expect(results[0].reasoning).toBe('looks real');
    expect(results[1].score).toBe(30);
    expect(results[1].verdict).toBe('fake');
  });
  it('aligns items by the "i" field even when out of order', () => {
    const raw = '[{"i":2,"score":60,"reasoning":"second"},{"i":1,"score":90,"reasoning":"first"}]';
    const results = parseBatch(raw, 2);
    expect(results[0].score).toBe(90);
    expect(results[0].reasoning).toBe('first');
    expect(results[1].score).toBe(60);
    expect(results[1].reasoning).toBe('second');
  });
  it('falls back to score 50 for missing or garbage entries', () => {
    const results = parseBatch('no json here', 3);
    expect(results).toHaveLength(3);
    results.forEach(r => expect(r.score).toBe(50));
  });
  it('returns exactly n items regardless of array length', () => {
    const raw = '[{"i":1,"score":70,"reasoning":"one"}]';
    const results = parseBatch(raw, 4);
    expect(results).toHaveLength(4);
    expect(results[0].score).toBe(70);
    // missing entries fall back to 50
    expect(results[1].score).toBe(50);
    expect(results[2].score).toBe(50);
    expect(results[3].score).toBe(50);
  });
  it('clamps out-of-range scores in batch results', () => {
    const raw = '[{"i":1,"score":200,"reasoning":"high"},{"i":2,"score":-10,"reasoning":"low"}]';
    const results = parseBatch(raw, 2);
    expect(results[0].score).toBe(100);
    expect(results[1].score).toBe(0);
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
  it('score 0 stays 0 (not coerced to 50)', () => {
    expect(parseResult('{"score": 0, "reasoning": "clearly fake"}').score).toBe(0);
  });
});

describe('parseBatch score-0', () => {
  it('score 0 in batch stays 0 (not coerced to 50)', () => {
    const raw = '[{"i":1,"score":0,"reasoning":"spam"}]';
    const results = parseBatch(raw, 1);
    expect(results[0].score).toBe(0);
  });
});
