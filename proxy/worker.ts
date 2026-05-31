// proxy/worker.ts
// Cloudflare Worker — TruLens free shared-AI proxy
// Deploy with: wrangler deploy
// Secrets: wrangler secret put MINIMAX_API_KEY
// KV: create with `wrangler kv namespace create RL` and paste the id into wrangler.toml

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-trulens-client',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // Rate limiting
    const LIMIT: number = parseInt(env.DAILY_LIMIT) || 40;
    const clientId: string = req.headers.get('x-trulens-client') ||
      req.headers.get('cf-connecting-ip') ||
      'anonymous';
    const day: string = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rlKey: string = `${clientId}:${day}`;

    const countStr: string | null = await env.RL.get(rlKey);
    const count: number = parseInt(countStr ?? '0') || 0;

    if (count >= LIMIT) {
      return new Response(
        JSON.stringify({ error: 'daily_limit', limit: LIMIT }),
        {
          status: 429,
          headers: { ...CORS, 'content-type': 'application/json' },
        }
      );
    }

    // Increment counter (expire after 48h so KV doesn't grow unbounded)
    await env.RL.put(rlKey, String(count + 1), { expirationTtl: 172800 });

    // Parse request body
    let body: { model?: string; max_tokens?: number; messages?: any[] };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // Forward to MiniMax — always use the server-side model to control cost
    const upstream = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${env.MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.MODEL || 'MiniMax-M2',
        max_tokens: body.max_tokens ?? 1024,
        messages: body.messages,
      }),
    });

    const upstreamText = await upstream.text();
    return new Response(upstreamText, {
      status: upstream.status,
      headers: {
        ...CORS,
        'content-type': 'application/json',
        'x-ratelimit-remaining': String(LIMIT - count - 1),
      },
    });
  },
};
