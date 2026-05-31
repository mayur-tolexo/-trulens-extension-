import { defineManifest } from '@crxjs/vite-plugin';
export default defineManifest({
  manifest_version: 3,
  name: 'TruLens — Review Genuineness',
  version: '1.0.0',
  description: 'Spot fake reviews on Google Maps — instant on-device genuineness scores, with optional AI deep-analysis.',
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
    'https://api.minimax.io/*', 'https://api.minimaxi.com/*',
    'https://api.anthropic.com/*', 'https://api.openai.com/*',
    'https://openrouter.ai/*'
  ],
  // NOTE: content_scripts are injected post-build as a self-contained IIFE by
  // scripts/build-content.mjs. CRXJS's loader uses a dynamic import() that
  // strict-CSP sites (Google Maps, Amazon) block, so we declare the script
  // statically instead.
});
