# TruLens proxy
A Cloudflare Worker that holds the Anthropic API key server-side.

## Deploy
1. `npm i -g wrangler`
2. `wrangler secret put ANTHROPIC_API_KEY`
3. `wrangler deploy`
4. Put the deployed URL (…/analyze) into the extension's `proxyUrl` setting / `DEFAULT_SETTINGS`.
