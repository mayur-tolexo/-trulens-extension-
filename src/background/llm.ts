import type { Review, DeepAnalysisResult, Settings, ProviderMode } from '../types';
import { getSettings } from './settings';
import { verdictFor } from '../scoring-core/score';

const PROMPT = (r: Review, siblings: Review[]) => {
  const ctx: string[] = [];
  if (r.verifiedPurchase === true) ctx.push('verified purchase');
  if (r.isLocalGuide === true) ctx.push('Google Local Guide');
  if (r.reviewerReviewCount != null) ctx.push(`${r.reviewerReviewCount} total reviews`);
  if (r.reviewerPhotoCount != null) ctx.push(`${r.reviewerPhotoCount} photos contributed`);
  if (r.helpfulCount != null && r.helpfulCount > 0) ctx.push(`${r.helpfulCount} found helpful`);
  const reviewer = ctx.length ? ctx.join(', ') : 'no profile signals available';
  const others = siblings.slice(0, 4)
    .map(x => `- (${x.rating ?? '?'}/5) """${(x.text || '').slice(0, 200)}"""`).join('\n') || '- none';
  return `You assess how GENUINE a single review is — fairly, with no bias against the business.

Score 0-100: 100 = clearly an authentic first-hand experience; 0 = clearly fake, incentivized, or spam. Give the benefit of the doubt: genuine reviews are often short, emotional, very positive, or harshly critical. Only LOWER the score for concrete manipulation signals:
- generic/templated wording with no specific details
- incentivized or promotional phrasing
- a rating that clearly contradicts the text
- copy-paste similarity to the other reviews shown below
- a brand-new account with a single review and no history
REWARD signs of a real reviewer: specific first-hand details, a credible profile (many reviews/photos, Local Guide), and balanced/mixed opinions.

REVIEWER PROFILE: ${reviewer}
RATING: ${r.rating ?? '?'}/5
REVIEW: """${r.text}"""

OTHER REVIEWS ON THIS PAGE (for duplication/pattern context only):
${others}

Be fair to the business; do not penalize a genuine positive or negative review. Return ONLY JSON: {"score": <0-100>, "reasoning": "<one concise sentence>"}`;
};

export interface LlmRequest { url: string; headers: Record<string, string>; body: string; }

export function buildRequest(review: Review, siblings: Review[], s: Settings): LlmRequest {
  const content = PROMPT(review, siblings);
  const model = s.model || 'claude-sonnet-4-6';
  if (s.providerMode === 'openai-compatible') {
    const base = s.baseUrl.replace(/\/+$/, '');
    return {
      url: `${base}/chat/completions`,
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}` },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
    };
  }
  if (s.providerMode === 'anthropic') {
    const base = (s.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const isOfficial = !s.baseUrl || /(^|\.)anthropic\.com$/.test(new URL(base).hostname);
    const anthropicHeaders: Record<string, string> = isOfficial
      ? { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}`, 'anthropic-version': '2023-06-01' };
    return {
      url: `${base}/v1/messages`,
      headers: anthropicHeaders,
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
    };
  }
  // proxy (default): proxy forwards an Anthropic-style body server-side
  return {
    url: s.proxyUrl,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
  };
}

/** Remove <think>…</think> reasoning blocks emitted by reasoning models (e.g. MiniMax-M2). */
function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function extractText(mode: ProviderMode, json: any): string {
  if (mode === 'openai-compatible') {
    return stripThink(json?.choices?.[0]?.message?.content ?? '');
  }
  // anthropic / proxy: reasoning models put a 'thinking' block first, then a 'text'
  // block — pick the text block, not content[0].
  const blocks = json?.content;
  if (Array.isArray(blocks)) {
    const textBlock = blocks.find((b: any) => b?.type === 'text' && typeof b?.text === 'string');
    if (textBlock) return stripThink(textBlock.text);
    const anyText = blocks.find((b: any) => typeof b?.text === 'string');
    if (anyText) return stripThink(anyText.text);
  }
  return '';
}

export function parseResult(raw: string): DeepAnalysisResult {
  const m = raw.match(/\{[\s\S]*\}/);
  let parsed: { score?: unknown; reasoning?: unknown } = { score: 50, reasoning: 'Could not parse response.' };
  if (m) { try { parsed = JSON.parse(m[0]); } catch { /* keep fallback */ } }
  const n = Number(parsed.score);
  const score = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
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

const BATCH_PROMPT = (reviews: Review[], siblings: Review[]) => {
  const items = reviews.map((r, i) => {
    const ctx: string[] = [];
    if (r.verifiedPurchase === true) ctx.push('verified purchase');
    if (r.isLocalGuide === true) ctx.push('Local Guide');
    if (r.reviewerReviewCount != null) ctx.push(`${r.reviewerReviewCount} reviews`);
    if (r.reviewerPhotoCount != null) ctx.push(`${r.reviewerPhotoCount} photos`);
    const c = ctx.length ? ` [reviewer: ${ctx.join(', ')}]` : '';
    return `[${i + 1}] (${r.rating ?? '?'}/5)${c} """${(r.text || '').slice(0, 600)}"""`;
  }).join('\n');
  const others = siblings.slice(0, 3).map(x => `- """${(x.text || '').slice(0, 150)}"""`).join('\n') || '- none';
  return `You assess how GENUINE each review is — fairly, with no bias against the business. Score 0-100 (100 = clearly authentic first-hand experience; 0 = fake/incentivized/spam). Give the benefit of the doubt: genuine reviews are often short, very positive, or harshly critical. Only LOWER for concrete manipulation: generic templated wording, incentivized phrasing, rating contradicting text, copy-paste similarity, or a brand-new single-review account. REWARD specific first-hand details and a credible reviewer profile.

REVIEWS:
${items}

CONTEXT (other reviews on this page):
${others}

Return ONLY a JSON array, one object per review in order, no prose:
[{"i":1,"score":<0-100>,"reasoning":"<one short sentence>"}, ...]`;
};

export function buildBatchRequest(reviews: Review[], siblings: Review[], s: Settings): LlmRequest {
  const content = BATCH_PROMPT(reviews, siblings);
  const model = s.model || 'claude-sonnet-4-6';
  const max_tokens = Math.min(8000, 700 + reviews.length * 320);
  if (s.providerMode === 'openai-compatible') {
    const baseU = s.baseUrl.replace(/\/+$/, '');
    return { url: `${baseU}/chat/completions`, headers: { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}` }, body: JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content }] }) };
  }
  if (s.providerMode === 'anthropic') {
    const baseU = (s.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const isOfficialU = !s.baseUrl || /(^|\.)anthropic\.com$/.test(new URL(baseU).hostname);
    const batchAnthropicHeaders: Record<string, string> = isOfficialU
      ? { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : { 'content-type': 'application/json', 'authorization': `Bearer ${s.apiKey}`, 'anthropic-version': '2023-06-01' };
    return { url: `${baseU}/v1/messages`, headers: batchAnthropicHeaders, body: JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content }] }) };
  }
  return { url: s.proxyUrl, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content }] }) };
}

export function parseBatch(raw: string, n: number): DeepAnalysisResult[] {
  let arr: any[] = [];
  const m = raw.match(/\[[\s\S]*\]/);
  if (m) { try { arr = JSON.parse(m[0]); } catch { arr = []; } }
  const out: DeepAnalysisResult[] = [];
  for (let k = 0; k < n; k++) {
    const found = Array.isArray(arr) ? arr.find(o => Number(o?.i) === k + 1) ?? arr[k] : undefined;
    const bn = Number(found?.score);
    const score = Number.isFinite(bn) ? Math.max(0, Math.min(100, bn)) : 50;
    out.push({ score, verdict: verdictFor(score), reasoning: String(found?.reasoning ?? '') });
  }
  return out;
}

export async function runBatchAnalysis(reviews: Review[], siblings: Review[]): Promise<DeepAnalysisResult[]> {
  const s = await getSettings();
  const req = buildBatchRequest(reviews, siblings, s);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const json = await res.json();
  return parseBatch(extractText(s.providerMode, json), reviews.length);
}

const SAMPLE_REVIEW: Review = {
  id: 'tl-test',
  text: 'Battery lasts all day and the camera is sharp in low light. Three weeks of daily use, no issues.',
  rating: 5, author: 'Test User', verifiedPurchase: true, date: null,
  reviewerReviewCount: 8, isLocalGuide: null, helpfulCount: 3
};

export interface TestResult { ok: boolean; score?: number; reasoning?: string; status?: number; error?: string; }

/** Run a single sample request with the current settings to confirm the provider/key/model work. */
export async function testConnection(): Promise<TestResult> {
  const s = await getSettings();
  if (s.providerMode !== 'proxy' && !s.apiKey) return { ok: false, error: 'No API key set.' };
  if (s.providerMode === 'openai-compatible' && !s.baseUrl) return { ok: false, error: 'Base URL is required for OpenAI-compatible mode.' };
  const req = buildRequest(SAMPLE_REVIEW, [], s);
  let res: Response;
  try {
    res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  } catch (e) {
    return { ok: false, error: `Network/CORS error: ${(e as Error).message}` };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: `HTTP ${res.status} — ${body.slice(0, 160)}` };
  }
  const json = await res.json().catch(() => null);
  const text = extractText(s.providerMode, json);
  if (!text) return { ok: false, error: 'Model returned an empty response (check the model name).' };
  const parsed = parseResult(text);
  return { ok: true, score: parsed.score, reasoning: parsed.reasoning };
}
