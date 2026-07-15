// Generates polished PNG icons (app + tray) with no external deps.
// Uses supersampling for smooth anti-aliased edges, a macOS-style squircle
// tile, the app's dusk→ember gradient, and a soft glowing sun.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---------- PNG encode ---------- */
const CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { const o = y * (size * 4 + 1); raw[o] = 0; rgba.copy(raw, o + 1, y * size * 4, (y + 1) * size * 4); }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- color helpers ---------- */
const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
const lerp = (a, b, t) => a + (b - a) * t;
function grad(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return stops[stops.length - 1][1].slice();
}

/* ---------- render with supersampling ---------- */
function render(size, sampler, ss) {
  const out = Buffer.alloc(size * size * 4);
  const n = ss * ss;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = sampler((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        const al = c[3] / 255; r += c[0] * al; g += c[1] * al; b += c[2] * al; a += c[3];
      }
      const A = a / n; const o = (y * size + x) * 4;
      if (A > 0.5) { const al = A / 255; out[o] = clamp(Math.round(r / n / al)); out[o + 1] = clamp(Math.round(g / n / al)); out[o + 2] = clamp(Math.round(b / n / al)); }
      out[o + 3] = Math.round(A);
    }
  }
  return out;
}

/* ---------- the app icon: squircle sky tile + glowing sun ---------- */
const SKY = [[0, [26, 22, 48]], [0.5, [58, 42, 72]], [0.82, [120, 70, 66]], [1, [190, 116, 70]]];
const SUN_C = [252, 226, 150], SUN_E = [230, 168, 82], GLOW = [240, 186, 120];

function appSampler(u, v) {                       // u,v in [0,1]
  const cx = 0.5, cy = 0.5, a = 0.5 - 0.085;      // squircle half-extent (with margin)
  const dx = u - cx, dy = v - cy, p = 4.2;
  const edge = Math.pow(Math.abs(dx) / a, p) + Math.pow(Math.abs(dy) / a, p);
  if (edge > 1) return [0, 0, 0, 0];
  const t = (v - (cy - a)) / (2 * a);
  let col = grad(SKY, t);
  const sunx = cx, suny = cy - a * 0.16, R = a * 0.40;
  const d = Math.hypot(u - sunx, v - suny);
  // Warm halo peaking AT the rim, so inside and outside blend with no dark ring.
  const halo = Math.exp(-Math.pow((d - R) / (R * 0.62), 2));
  const k = halo * 0.62;
  col = [col[0] + (GLOW[0] - col[0]) * k, col[1] + (GLOW[1] - col[1]) * k, col[2] + (GLOW[2] - col[2]) * k];
  if (d <= R) {                                    // the sun disc, rim feathered into the halo
    const s = grad([[0, SUN_C], [1, SUN_E]], d / R);
    const soft = Math.min(1, (R - d) / (R * 0.12));
    col = [lerp(col[0], s[0], soft), lerp(col[1], s[1], soft), lerp(col[2], s[2], soft)];
  }
  return [clamp(col[0]), clamp(col[1]), clamp(col[2]), 255];
}

/* ---------- tray glyph: clean gold sun on transparent ---------- */
function traySampler(u, v) {
  const d = Math.hypot(u - 0.5, v - 0.46), R = 0.34;
  if (d <= R) {
    const s = grad([[0, SUN_C], [1, [214, 150, 70]]], d / R);
    const soft = Math.min(1, (R - d) / 0.05);
    return [s[0], s[1], s[2], Math.round(255 * soft)];
  }
  return [0, 0, 0, 0];
}

const outDir = path.join(__dirname, 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), encodePng(1024, render(1024, appSampler, 4)));
fs.writeFileSync(path.join(outDir, 'tray.png'), encodePng(22, render(22, traySampler, 8)));
fs.writeFileSync(path.join(outDir, 'tray@2x.png'), encodePng(44, render(44, traySampler, 8)));
console.log('icons written to assets/ (icon.png 1024, tray 22/44)');
