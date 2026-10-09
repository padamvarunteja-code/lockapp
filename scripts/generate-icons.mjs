// Regenerates PWA / launcher icons from the OnlyUs heart logo.
// Zero dependencies (see scripts/png.mjs + scripts/heart.mjs).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';
import { BG, heartPixel } from './heart.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons');

function roundedClip(x, y, size, pad, r) {
  const lx = x - pad;
  const ly = y - pad;
  const box = size - pad * 2;
  if (lx < 0 || ly < 0 || lx >= box || ly >= box) return false;
  const cx = Math.min(Math.max(lx, r), box - r);
  const cy = Math.min(Math.max(ly, r), box - r);
  if (lx >= r && lx < box - r) return ly >= 0 && ly < box;
  if (ly >= r && ly < box - r) return lx >= 0 && lx < box;
  return Math.hypot(lx - cx, ly - cy) <= r;
}

function tileIcon(size, { maskable = false } = {}) {
  const pad = maskable ? Math.floor(size * 0.12) : 0;
  const box = size - pad * 2;
  const r = Math.floor(box * 0.24);
  return encodePng(size, size, (x, y) => {
    if (!roundedClip(x, y, size, pad, r)) return [...BG, 255];
    return heartPixel(x, y, size, { strokeUnits: 0.1 });
  });
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size, opts] of [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
]) {
  writeFileSync(resolve(OUT_DIR, name), tileIcon(size, opts));
  console.log(`wrote public/icons/${name}`);
}
