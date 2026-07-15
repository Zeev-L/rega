// Generates PNG icons (tray + app) with no external deps, using zlib.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function png(size, draw) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y);
      const o = rowStart + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// A soft "sun rising over horizon" glyph — gold disc + warm ground line.
function draw(size) {
  const c = size / 2;
  const sunR = size * 0.30;
  const sunCy = size * 0.44;
  return (x, y) => {
    const dx = x - c, dy = y - sunCy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // sun
    if (dist <= sunR) {
      const t = dist / sunR;
      const r = Math.round(240 - t * 30);
      const g = Math.round(190 - t * 40);
      const b = Math.round(110 - t * 30);
      return [r, g, b, 255];
    }
    // horizon band (lower third)
    const bandTop = size * 0.66, bandBot = size * 0.80;
    if (y >= bandTop && y <= bandBot) {
      const inset = size * 0.14;
      if (x >= inset && x <= size - inset) return [226, 181, 102, 235];
    }
    return [0, 0, 0, 0];
  };
}

const outDir = path.join(__dirname, 'assets');
fs.mkdirSync(outDir, { recursive: true });

// Tray (menu bar). Colored (non-template) so the sun reads.
fs.writeFileSync(path.join(outDir, 'tray.png'), png(22, draw(22)));
fs.writeFileSync(path.join(outDir, 'tray@2x.png'), png(44, draw(44)));
// App icon.
fs.writeFileSync(path.join(outDir, 'icon.png'), png(1024, draw(1024)));

console.log('icons written to assets/');
