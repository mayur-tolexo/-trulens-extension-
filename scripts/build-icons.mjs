// Rasterize the master SVG logo into the PNG icon sizes Chrome & the Web Store
// need. Output to public/ so Vite copies them to the dist root, where the
// manifest references them (icon-16.png … icon-128.png).
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync(new URL('../assets/logo.svg', import.meta.url));
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });

const SIZES = [16, 32, 48, 128];
for (const size of SIZES) {
  const out = new URL(`../public/icon-${size}.png`, import.meta.url);
  await sharp(svg, { density: 512 }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(out.pathname);
}
// A larger marketing icon for the store tile.
await sharp(svg, { density: 512 }).resize(440, 280, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png().toFile(new URL('../public/promo-440x280.png', import.meta.url).pathname);

console.log('[build-icons] wrote icon-16/32/48/128.png + promo-440x280.png to public/');
