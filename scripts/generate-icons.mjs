// Generates PWA / Android launcher icons with zero dependencies.
// Node's built-in zlib is used to encode plain PNG files.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons');

const BG = [7, 6, 11]; // #07060B
const RING = [192, 132, 252]; // purple-300
const INNER = [88, 40, 150];

function crcTable() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC_T = crcTable();

function crc(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function roundedRectDist(x, y, size, r) {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const dx = x - cx;
  const dy = y - cy;
  if (x >= r && x < size - r) return Math.min(y, size - 1 - y);
  if (y >= r && y < size - r) return Math.min(x, size - 1 - x);
  return Math.hypot(dx, dy) - r;
}

function drawIcon(size, { maskable = false } = {}) {
  const pad = maskable ? Math.floor(size * 0.12) : 0;
  const box = size - pad * 2;
  const r = Math.floor(box * 0.24);
  const cx = size / 2;
  const cy = size / 2;
  const ringR = box * 0.30;
  const ringW = Math.max(2, box * 0.045);
  const dotR = box * 0.10;

  const raw = Buffer.alloc(size * (1 + size * 3));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let px;
      if (x < pad || y < pad || x >= size - pad || y >= size - pad) {
        px = BG; // maskable safe-zone padding
      } else {
        const d = roundedRectDist(x - pad, y - pad, box, r);
        if (d > 0.5) {
          px = BG;
        } else {
          const distC = Math.hypot(x - cx, y - cy);
          const ringDist = Math.abs(distC - ringR);
          const dotDist = Math.hypot(x - cx, y - cy - ringR * 0.1);
          if (ringDist < ringW) {
            const t = Math.max(0, 1 - ringDist / ringW);
            px = [
              Math.round(BG[0] + (RING[0] - BG[0]) * t),
              Math.round(BG[1] + (RING[1] - BG[1]) * t),
              Math.round(BG[2] + (RING[2] - BG[2]) * t),
            ];
          } else if (dotDist < dotR) {
            px = INNER;
          } else {
            // subtle vertical gradient inside the tile
            const g = (y - pad) / box;
            px = [Math.round(20 + 8 * g), Math.round(14 + 6 * g), Math.round(43 + 10 * g)];
          }
          if (d > -1.5) {
            const t = Math.max(0, Math.min(1, 0.5 - d));
            px = px.map((v) => Math.round(v * (0.4 + 0.6 * t)));
          }
        }
      }
      raw[o++] = px[0];
      raw[o++] = px[1];
      raw[o++] = px[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of targets) {
  writeFileSync(resolve(OUT_DIR, name), drawIcon(size, opts));
  console.log(`wrote public/icons/${name}`);
}
