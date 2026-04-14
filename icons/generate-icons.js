// generate-icons.js — run once with: node generate-icons.js
// Generates pin16.png, pin32.png, pin48.png, pin128.png
// Uses only Node.js built-ins (zlib) — no npm required.

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBytes, data]));
  return Buffer.concat([u32be(data.length), typeBytes, data, u32be(crc)]);
}

function makePng(size) {
  // Draw a pin icon on a #6366f1 background
  // RGBA pixels
  const pixels = new Uint8Array(size * size * 4);

  const bg = [0x63, 0x66, 0xf1, 0xff];   // indigo
  const white = [0xff, 0xff, 0xff, 0xff];
  const trans = [0, 0, 0, 0];

  // Fill background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4 + 0] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
    pixels[i * 4 + 3] = bg[3];
  }

  // Draw rounded rect mask (corner radius ~22% of size)
  const r = Math.round(size * 0.22);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCorner =
        (x < r && y < r && Math.hypot(x - r, y - r) > r) ||
        (x >= size - r && y < r && Math.hypot(x - (size - r), y - r) > r) ||
        (x < r && y >= size - r && Math.hypot(x - r, y - (size - r)) > r) ||
        (x >= size - r && y >= size - r && Math.hypot(x - (size - r), y - (size - r)) > r);
      if (inCorner) {
        const idx = (y * size + x) * 4;
        pixels[idx + 3] = 0; // transparent
      }
    }
  }

  // Draw a simple pin shape (scaled to size)
  // Normalize coordinates 0..1 → 0..size
  function setPixel(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    pixels[idx + 0] = color[0];
    pixels[idx + 1] = color[1];
    pixels[idx + 2] = color[2];
    pixels[idx + 3] = color[3];
  }

  function drawLine(x0, y0, x1, y1, color, thickness = 1) {
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      for (let tx = -thickness; tx <= thickness; tx++) {
        for (let ty = -thickness; ty <= thickness; ty++) {
          if (Math.hypot(tx, ty) <= thickness) setPixel(Math.round(px + tx), Math.round(py + ty), color);
        }
      }
    }
  }

  function fillCircle(cx, cy, r2, color) {
    for (let y = Math.floor(cy - r2); y <= Math.ceil(cy + r2); y++) {
      for (let x = Math.floor(cx - r2); x <= Math.ceil(cx + r2); x++) {
        if (Math.hypot(x - cx, y - cy) <= r2) setPixel(x, y, color);
      }
    }
  }

  const s = size;
  // Scale factor
  const f = s / 128;

  // Pin head (circle)
  fillCircle(64 * f, 44 * f, 22 * f, white);

  // Pin neck (line down from circle)
  const thick = Math.max(1, Math.round(5 * f));
  drawLine(64 * f, 66 * f, 64 * f, 85 * f, white, thick);

  // Pin needle (diagonal line bottom-right to center)
  drawLine(64 * f, 85 * f, 84 * f, 105 * f, white, Math.max(1, Math.round(3 * f)));

  // Hole in pin head
  fillCircle(64 * f, 44 * f, 10 * f, bg);

  return pixels;
}

function encodePng(size) {
  const pixels = makePng(size);

  // Build raw image data: each row has a filter byte (0 = None) + RGBA
  const rowSize = size * 4;
  const raw = Buffer.alloc(size * (1 + rowSize));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + rowSize)] = 0; // filter None
    pixels.slice(y * rowSize, (y + 1) * rowSize).forEach((v, i) => {
      raw[y * (1 + rowSize) + 1 + i] = v;
    });
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    u32be(size), u32be(size),
    Buffer.from([8, 6, 0, 0, 0]) // bit depth 8, RGBA, deflate, filter, interlace
  ]));
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const outDir = path.dirname(process.argv[1]);
[16, 32, 48, 128].forEach(size => {
  const buf = encodePng(size);
  const out = path.join(outDir, `pin${size}.png`);
  fs.writeFileSync(out, buf);
});
