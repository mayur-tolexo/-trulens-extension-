// Minimal Cloudflare Worker that proxies to Anthropic with a server-side key.
// Deploy with: wrangler deploy. Set ANTHROPIC_API_KEY as a secret.
export default {
  async fetch(req: Request, env: { ANTHROPIC_API_KEY: string }): Promise<Response> {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const body = await req.text();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
  }
};
