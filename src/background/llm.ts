import type { Review, DeepAnalysisResult } from '../types';
import { getSettings } from './settings';
import { verdictFor } from '../scoring-core/score';

const PROMPT = (r: Review, siblings: Review[]) =>
  `You are an expert at detecting fake product/place reviews. Rate how GENUINE this review is from 0 (definitely fake) to 100 (clearly authentic). Consider specificity, emotional authenticity, and similarity to the other reviews.\n\nREVIEW (rating ${r.rating ?? '?'}/5): """${r.text}"""\n\nOTHER REVIEWS ON PAGE:\n${siblings.slice(0, 4).map(s => `- """${s.text}"""`).join('\n')}\n\nReturn ONLY JSON: {"score": <0-100>, "reasoning": "<one sentence>"}`;

export async function runDeepAnalysis(review: Review, siblings: Review[]): Promise<DeepAnalysisResult> {
  const s = await getSettings();
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: PROMPT(review, siblings) }]
  };

  let raw: string;
  if (s.providerMode === 'own-key') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const json = await res.json();
    raw = json.content?.[0]?.text ?? '';
  } else {
    const res = await fetch(s.proxyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    const json = await res.json();
    raw = json.content?.[0]?.text ?? JSON.stringify(json);
  }

  const m = raw.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : { score: 50, reasoning: 'Could not parse response.' };
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 50));
  return { score, verdict: verdictFor(score), reasoning: String(parsed.reasoning ?? '') };
}
