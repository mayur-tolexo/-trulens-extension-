import type { Review, DeepAnalysisResult, Settings, ProviderMode } from '../types';
import { getSettings } from './settings';
import { verdictFor } from '../scoring-core/score';

const PROMPT = (r: Review, siblings: Review[]) =>
  `You are an expert at detecting fake product/place reviews. Rate how GENUINE this review is from 0 (definitely fake) to 100 (clearly authentic). Consider specificity, emotional authenticity, and similarity to the other reviews.\n\nREVIEW (rating ${r.rating ?? '?'}/5): """${r.text}"""\n\nOTHER REVIEWS ON PAGE:\n${siblings.slice(0, 4).map(x => `- """${x.text}"""`).join('\n')}\n\nReturn ONLY JSON: {"score": <0-100>, "reasoning": "<one sentence>"}`;

export interface LlmRequest { url: string; headers: Record<string, string>; body: string; }

export function buildRequest(review: Review, siblings: Review[], s: Settings): LlmRequest {
  const content = PROMPT(review, siblings);
  const model = s.model || 'claude-sonnet-4-6';
  if (s.providerMode === 'openai-compatible') {
    const base = s.baseUrl.replace(/\/+$/, '');
    return {
      url: `${base}/chat/completions`,
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}` },
      body: JSON.stringify({ model, max_tokens: 200, messages: [{ role: 'user', content }] })
    };
  }
  if (s.providerMode === 'anthropic') {
    const base = (s.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    return {
      url: `${base}/v1/messages`,
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey,
        'authorization': `Bearer ${s.apiKey}`,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model, max_tokens: 200, messages: [{ role: 'user', content }] })
    };
  }
  // proxy (default): proxy forwards an Anthropic-style body server-side
  return {
    url: s.proxyUrl,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 200, messages: [{ role: 'user', content }] })
  };
}

export function extractText(mode: ProviderMode, json: any): string {
  if (mode === 'openai-compatible') return json?.choices?.[0]?.message?.content ?? '';
  return json?.content?.[0]?.text ?? '';
}

export function parseResult(raw: string): DeepAnalysisResult {
  const m = raw.match(/\{[\s\S]*\}/);
  let parsed: { score?: unknown; reasoning?: unknown } = { score: 50, reasoning: 'Could not parse response.' };
  if (m) { try { parsed = JSON.parse(m[0]); } catch { /* keep fallback */ } }
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 50));
  return { score, verdict: verdictFor(score), reasoning: String(parsed.reasoning ?? '') };
}

export async function runDeepAnalysis(review: Review, siblings: Review[]): Promise<DeepAnalysisResult> {
  const s = await getSettings();
  const req = buildRequest(review, siblings, s);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const json = await res.json();
  return parseResult(extractText(s.providerMode, json));
}
