// Generates OnlyUs heart-logo assets for the Capacitor Android project:
// - adaptive-icon foregrounds (transparent) per density
// - legacy ic_launcher + ic_launcher_round per density
// - dark launcher background color
// - splash screens redrawn at their existing sizes
//
// Run after `npx cap add android` (locally or in CI). Idempotent.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, readPngSize } from './png.mjs';
import { BG, heartPixel } from './heart.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES = resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

// Adaptive-icon foreground: transparent, heart in the 72dp safe zone.
for (const [density, size] of Object.entries(FOREGROUND)) {
  const png = encodePng(size, size, (x, y) =>
    heartPixel(x, y, size, {
      transparent: true,
      span: 2.6 / 0.62, // mark occupies ~62% (safe zone)
      strokeUnits: 0.075 / 0.62,
      cyOff: 0.1 / 0.62,
    })
  );
  writeFileSync(resolve(RES, `mipmap-${density}`, 'ic_launcher_foreground.png'), png);
  console.log(`foreground ${density} ${size}px`);
}

// Legacy full-bleed tiles (+ circular variant for *_round).
for (const [density, size] of Object.entries(LEGACY)) {
  const r = size / 2;
  const tile = encodePng(size, size, (x, y) =>
    heartPixel(x, y, size, { strokeUnits: 0.075 })
  );
  const round = encodePng(size, size, (x, y) => {
    if (Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) > r) return [0, 0, 0, 0];
    return heartPixel(x, y, size, { strokeUnits: 0.075 });
  });
  writeFileSync(resolve(RES, `mipmap-${density}`, 'ic_launcher.png'), tile);
  writeFileSync(resolve(RES, `mipmap-${density}`, 'ic_launcher_round.png'), round);
  console.log(`legacy ${density} ${size}px`);
}

// Dark adaptive-icon background.
const bgPath = resolve(RES, 'values', 'ic_launcher_background.xml');
writeFileSync(
  bgPath,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#07060B</color>\n</resources>\n`
);
console.log('background #07060B');

// Splash screens: keep each file's size, redraw dark + centered heart.
import { readdirSync } from 'node:fs';
for (const entry of readdirSync(RES, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue;
  const splash = resolve(RES, entry.name, 'splash.png');
  let buf;
  try {
    buf = readFileSync(splash);
  } catch {
    continue;
  }
  const { width, height } = readPngSize(buf);
  const mark = Math.min(width, height);
  const png = encodePng(width, height, (x, y) => {
    // Map a centered square to heart space.
    const ox = x - (width - mark) / 2;
    const oy = y - (height - mark) / 2;
    if (ox < 0 || oy < 0 || ox >= mark || oy >= mark) return [...BG, 255];
    return heartPixel(ox, oy, mark, { strokeUnits: 0.075 });
  });
  writeFileSync(splash, png);
  console.log(`splash ${entry.name} ${width}x${height}`);
}
