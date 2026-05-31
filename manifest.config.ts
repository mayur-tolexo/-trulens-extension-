import { defineManifest } from '@crxjs/vite-plugin';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineManifest({
  manifest_version: 3,
  name: 'TruLens — Review Genuineness',
  version,
  description: 'Spot fake reviews on Google Maps — instant local genuineness scores, plus optional AI deep-analysis using your own API key.',
  icons: {
    16: 'icon-16.png', 32: 'icon-32.png', 48: 'icon-48.png', 128: 'icon-128.png'
  },
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: { 16: 'icon-16.png', 32: 'icon-32.png', 48: 'icon-48.png', 128: 'icon-128.png' }
  },
  options_ui: {
    page: 'src/onboarding/onboarding.html',
    open_in_tab: true
  },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  permissions: ['storage'],
  host_permissions: [
    'https://www.google.com/maps/*',
    // LLM endpoints — needed so the service worker fetch bypasses CORS
    'https://api.minimax.io/*',
    'https://api.anthropic.com/*',
    // AWS API Gateway (Lambda proxy) — the optional free shared-AI tier
    'https://*.execute-api.us-east-1.amazonaws.com/*',
  ],
  // NOTE: content_scripts are injected post-build as a self-contained IIFE by
  // scripts/build-content.mjs. CRXJS's loader uses a dynamic import() that
  // strict-CSP sites (Google Maps, Amazon) block, so we declare the script
  // statically instead.
});
