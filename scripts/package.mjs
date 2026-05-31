// Zip the built dist/ into a versioned artifact for Chrome Web Store upload.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

if (!existsSync('dist/manifest.json')) {
  console.error('dist/ not built. Run `npm run build` first.');
  process.exit(1);
}
const version = JSON.parse(readFileSync('dist/manifest.json', 'utf8')).version;
const out = `trulens-v${version}.zip`;
execSync(`rm -f ${out} && cd dist && zip -r -X ../${out} . -x '.DS_Store' -x '__MACOSX'`, { stdio: 'inherit' });
console.log(`[package] wrote ${out} — upload this to the Chrome Web Store.`);
