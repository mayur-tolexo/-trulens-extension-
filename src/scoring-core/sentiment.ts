const POS = new Set(['good','great','excellent','love','loved','amazing','perfect','best','wonderful','fantastic','happy','recommend','quality','durable','worth']);
const NEG = new Set(['bad','terrible','awful','hate','hated','worst','broke','broken','poor','cheap','waste','disappointed','disappointing','fake','defective','useless']);

/** Returns net sentiment: (#pos - #neg) / #tokens, range ~[-1,1]. 0 if no tokens. */
export function sentimentScore(text: string): number {
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (tokens.length === 0) return 0;
  let net = 0;
  for (const t of tokens) { if (POS.has(t)) net++; else if (NEG.has(t)) net--; }
  return net / tokens.length;
}
