// Build the content script as a SINGLE self-contained IIFE and declare it
// statically in the manifest. CRXJS ships content scripts via a dynamic import()
// loader, which strict-CSP sites (Google Maps, Amazon) block — so the script
// never runs. A statically-declared classic content script is injected by Chrome
// directly into the isolated world and is NOT subject to the page's CSP.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MATCHES = [
  'https://*.amazon.com/*',
  'https://*.amazon.in/*',
  'https://*.flipkart.com/*',
  'https://www.google.com/maps/*',
];

await build({
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outfile: 'dist/content-script.js',
  legalComments: 'none',
  logLevel: 'info',
});

const cssPath = 'dist/content-script.css';
const hasCss = existsSync(cssPath);

const mfPath = 'dist/manifest.json';
const mf = JSON.parse(readFileSync(mfPath, 'utf8'));
mf.content_scripts = [
  {
    matches: MATCHES,
    js: ['content-script.js'],
    ...(hasCss ? { css: ['content-script.css'] } : {}),
    run_at: 'document_idle',
  },
];
writeFileSync(mfPath, JSON.stringify(mf, null, 2));
console.log(`[build-content] wrote self-contained content script + manifest entry (css: ${hasCss}).`);
