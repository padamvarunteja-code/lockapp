// Heart-logo art shared by the PWA + Android icon generators.
//
// The outline distance is measured against densely sampled points of the
// classic parametric heart curve (true distance — the implicit-form
// F/|grad F| approximation underestimates far from the curve and makes
// the glow bleed across the whole tile).

export const BG = [7, 6, 11]; // #07060B

const SAMPLES = (() => {
  const pts = [];
  const N = 720;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const s = Math.sin(t);
    const x = (16 * s * s * s) / 17;
    const y =
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)) /
      17;
    pts.push([x, y]);
  }
  return pts;
})();

// Bounding box of the samples (+ margin), for a cheap per-pixel reject.
const BBOX = (() => {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y] of SAMPLES) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, x1, y0, y1];
})();

function heartDistance(hx, hy) {
  const M = 0.45; // reject margin in heart units (>> glow radius)
  if (hx < BBOX[0] - M || hx > BBOX[1] + M || hy < BBOX[2] - M || hy > BBOX[3] + M) {
    return Infinity;
  }
  let best = Infinity;
  for (let i = 0; i < SAMPLES.length; i++) {
    const dx = hx - SAMPLES[i][0];
    const dy = hy - SAMPLES[i][1];
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/** White (top) -> purple (bottom) stroke gradient, like the reference logo. */
export function heartColor(t) {
  const stops = [
    [0.0, [242, 237, 255]],
    [0.45, [192, 132, 252]],
    [1.0, [126, 34, 206]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Paint one pixel of a heart outline.
 * size: icon edge in px. The heart spans ~2.1 units wide, ~2.0 tall.
 * @returns [r,g,b,a]
 */
export function heartPixel(x, y, size, opts = {}) {
  const {
    strokeUnits = 0.075, // half-width of the stroke in heart units
    glowStrength = 0.45,
    transparent = false,
    span = 2.6, // heart-units across the full icon edge
    cyOff = 0.1, // vertical centering nudge (heart units, + moves mark down)
  } = opts;
  const hx = (x / (size - 1) - 0.5) * span;
  const hy = (0.5 - y / (size - 1)) * span + cyOff;

  const t = Math.max(0, Math.min(1, y / (size - 1)));
  const stroke = heartColor(t);

  const d = heartDistance(hx, hy);
  if (d === Infinity) return transparent ? [0, 0, 0, 0] : [...BG, 255];

  const pxPerUnit = size / span;
  const aa = 1.6 / pxPerUnit;
  const cover = Math.max(0, Math.min(1, 0.5 - (d - strokeUnits) / aa));

  const outside = Math.max(0, d - strokeUnits);
  const glow = Math.exp(-(outside * outside) / (2 * 0.11 * 0.11)) * glowStrength;

  if (transparent) {
    const a = Math.max(cover, Math.min(1, glow));
    if (a <= 0) return [0, 0, 0, 0];
    return [
      Math.round(stroke[0] * cover + 168 * glow * (1 - cover)),
      Math.round(stroke[1] * cover + 85 * glow * (1 - cover)),
      Math.round(stroke[2] * cover + 247 * glow * (1 - cover)),
      Math.round(a * 255),
    ];
  }

  return [
    Math.round(BG[0] * (1 - cover) + stroke[0] * cover + 84 * glow * (1 - cover)),
    Math.round(BG[1] * (1 - cover) + stroke[1] * cover + 42 * glow * (1 - cover)),
    Math.round(BG[2] * (1 - cover) + stroke[2] * cover + 124 * glow * (1 - cover)),
    255,
  ];
}
