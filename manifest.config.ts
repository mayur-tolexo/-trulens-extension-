import { defineManifest } from '@crxjs/vite-plugin';
export default defineManifest({
  manifest_version: 3,
  name: 'TruLens — Review Genuineness',
  version: '0.1.0',
  description: 'Scores how genuine reviews are on Amazon, Flipkart and Google Maps.',
  action: { default_popup: 'src/popup/popup.html' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  permissions: ['storage'],
  host_permissions: [
    'https://*.amazon.com/*', 'https://*.amazon.in/*',
    'https://*.flipkart.com/*', 'https://www.google.com/maps/*',
    // LLM endpoints — needed so the service worker fetch bypasses CORS
    'https://api.minimax.io/*', 'https://api.minimaxi.com/*',
    'https://api.anthropic.com/*', 'https://api.openai.com/*',
    'https://openrouter.ai/*'
  ],
  // NOTE: content_scripts are injected post-build as a self-contained IIFE by
  // scripts/build-content.mjs. CRXJS's loader uses a dynamic import() that
  // strict-CSP sites (Google Maps, Amazon) block, so we declare the script
  // statically instead.
});
