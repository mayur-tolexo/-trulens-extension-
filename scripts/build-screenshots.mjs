// Frame the raw screenshots from ./screenshots into Chrome Web Store images
// (1280x800) with a branded caption band. Output to store-assets/screenshots/.
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const FILES = readdirSync(p('../screenshots/')).filter((f) => f.endsWith('.png'));
const find = (key) => FILES.find((f) => f.includes(key));

const W = 1280, H = 800, HEADER = 140, PAD = 52;
const OUT = new URL('../store-assets/screenshots/', import.meta.url);
mkdirSync(p('../store-assets/screenshots/'), { recursive: true });

// Ordered for the listing. The first four have clean, whole-star ratings (or no
// stars); the last two show the OLD half-star glyph and are best re-captured
// after reloading the fixed build.
const SHOTS = [
  { key: '12.51.51', title: 'Instant trust score for every place', sub: 'See how genuine the reviews really are — at a glance.' },
  { key: '12.52.14', title: 'Catches fake & paid reviews', sub: 'Red flags suspicious reviews; green confirms the genuine ones.' },
  { key: '12.52.31', title: 'Every review, scored right inline', sub: 'A genuineness badge on each Google Maps review.' },
  { key: '12.51.58', title: 'Your trust summary in one click', sub: 'Score, verdict and a genuine / mixed / fake breakdown.' },
  { key: '12.52.04', title: 'Free to use. Private by design.', sub: 'On-device scoring; add your own AI key for unlimited.' },
  { key: '12.52.24', title: 'Right inside Google Maps', sub: 'No extra tabs — TruLens works where you already browse.' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let i = 0;
for (const s of SHOTS) {
  i++;
  const header = Buffer.from(
    `<svg width="${W}" height="${HEADER}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2742E6"/><stop offset="1" stop-color="#3B7DFF"/></linearGradient></defs>
      <rect width="${W}" height="${HEADER}" fill="url(#g)"/>
      <text x="${PAD}" y="66" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#ffffff">${esc(s.title)}</text>
      <text x="${PAD}" y="102" font-family="Arial, Helvetica, sans-serif" font-size="19" fill="#dde6ff">${esc(s.sub)}</text>
    </svg>`
  );

  const areaW = W - PAD * 2;
  const areaH = H - HEADER - PAD * 2;
  const file = find(s.key);
  if (!file) { console.log('skip (missing)', s.key); continue; }
  const shot = await sharp(p('../screenshots/' + file))
    .resize({ width: areaW, height: areaH, fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  const m = await sharp(shot).metadata();
  const left = Math.round((W - m.width) / 2);
  const top = HEADER + Math.round((H - HEADER - m.height) / 2);

  // White card behind the screenshot for separation from the background.
  const card = Buffer.from(
    `<svg width="${m.width + 24}" height="${m.height + 24}" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="${m.width + 20}" height="${m.height + 20}" rx="14" fill="#ffffff" stroke="#dde2ea"/></svg>`
  );

  const name = `${String(i).padStart(2, '0')}-store.png`;
  await sharp({ create: { width: W, height: H, channels: 4, background: '#eef2fb' } })
    .composite([
      { input: header, top: 0, left: 0 },
      { input: card, top: top - 12, left: left - 12 },
      { input: shot, top, left },
    ])
    .png()
    .toFile(p('../store-assets/screenshots/' + name));
  console.log('[build-screenshots] wrote', name);
}
console.log('[build-screenshots] done → store-assets/screenshots/');
