// generate-assets.js — generates all Chrome Web Store assets for PinIt
// Usage: node generate-assets.js

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const OUT = path.join(__dirname, 'assets');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

// ── Pin SVG builder (viewBox 0 0 100 100) ────────────────────────────────────
function pinSvg(size, { bg = '#ffffff', fg = '#6d28d9', radius } = {}) {
  const r     = radius ?? Math.round(size * 0.2);
  const sw    = Math.max(1, +(size * 0.06).toFixed(2));  // stroke-width
  const pad   = Math.round(size * 0.18);                 // padding inside rounded rect
  const inner = size - pad * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- background -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${bg}"/>
  <!-- pin icon scaled to inner area -->
  <g transform="translate(${pad},${pad}) scale(${inner / 100})">
    <line x1="50" y1="69" x2="50" y2="84"
      stroke="${fg}" stroke-width="${(sw * 100) / inner}" stroke-linecap="round"/>
    <path d="M25 67h50v-6a8 8 0 0 0-4.3-7l-6.3-3.1A8 8 0 0 1 60 43.4V22h3a8 8 0 0 0 0-16H37a8 8 0 0 0 0 16h3v21.4A8 8 0 0 1 35.3 51l-6.3 3.1A8 8 0 0 0 25 61Z"
      stroke="${fg}" stroke-width="${(sw * 100) / inner}" stroke-linecap="round"
      stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;
}

// ── Promotional tile (440×280) ────────────────────────────────────────────────
function promoSvg() {
  const W = 440, H = 280;
  const GRID = 20;

  // grid lines
  let gridLines = '';
  for (let x = 0; x <= W; x += GRID)
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#00000008"/>`;
  for (let y = 0; y <= H; y += GRID)
    gridLines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00000008"/>`;

  // icon box (top-left quadrant, vertically centered in top half)
  const iconBoxSize = 64;
  const iconPad     = 10;
  const iconAreaX   = 36;
  const iconAreaY   = 48;

  // inline the pin SVG (no external reference needed — embed as nested SVG)
  const pinInner = pinSvg(iconBoxSize, { bg: '#f5f3ff', fg: '#6d28d9', radius: 14 });
  const pinBase64 = Buffer.from(pinInner).toString('base64');

  // pills
  const pills = ['Pin any response', 'Instant sidebar', 'Scroll back'];
  const pillH = 28, pillRx = 14, pillPad = 14;
  let pillsGroup = '';
  let pillX = 36;
  const pillY = 194;
  pills.forEach(label => {
    // estimate text width (rough: 7.5px per char at 13px)
    const tw = label.length * 7.5;
    const pw = tw + pillPad * 2;
    pillsGroup += `
    <rect x="${pillX}" y="${pillY}" width="${pw}" height="${pillH}" rx="${pillRx}"
      fill="#f5f3ff" stroke="#ede9fe" stroke-width="1"/>
    <text x="${pillX + pw / 2}" y="${pillY + 18}" text-anchor="middle"
      font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      font-size="13" fill="#6d28d9">${label}</text>`;
    pillX += pw + 10;
  });

  // "Free" badge
  const badgeX = 36, badgeY = 238;
  const badgeW = 52, badgeH = 24, badgeRx = 12;
  // "For Claude.ai" text
  const forX = badgeX + badgeW + 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- background -->
  <rect width="${W}" height="${H}" fill="#ffffff" rx="12"/>

  <!-- grid -->
  <g>${gridLines}</g>

  <!-- icon box -->
  <image x="${iconAreaX}" y="${iconAreaY}" width="${iconBoxSize}" height="${iconBoxSize}"
    href="data:image/svg+xml;base64,${pinBase64}"/>

  <!-- "PinIt" heading -->
  <text x="${iconAreaX + iconBoxSize + 14}" y="${iconAreaY + 24}"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="28" font-weight="700" fill="#0f172a">PinIt</text>

  <!-- tagline -->
  <text x="${iconAreaX + iconBoxSize + 14}" y="${iconAreaY + 48}"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="14" fill="#64748b">Never lose a great Claude response again.</text>

  <!-- divider -->
  <line x1="36" y1="172" x2="${W - 36}" y2="172" stroke="#e2e8f0" stroke-width="1"/>

  <!-- pills -->
  ${pillsGroup}

  <!-- Free badge -->
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}"
    fill="#6d28d9"/>
  <text x="${badgeX + badgeW / 2}" y="${badgeY + 16}" text-anchor="middle"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="12" font-weight="600" fill="#ddd6fe">Free</text>

  <!-- "For Claude.ai" -->
  <text x="${forX}" y="${badgeY + 16}"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="13" fill="#94a3b8">For Claude.ai</text>
</svg>`;
}

// ── Write helpers ─────────────────────────────────────────────────────────────
async function writePng(svgString, outFile) {
  await sharp(Buffer.from(svgString)).png().toFile(outFile);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const icons = [16, 48, 128];
  for (const size of icons) {
    const out = path.join(OUT, `icon-${size}.png`);
    await writePng(pinSvg(size), out);
    process.stdout.write(`icon-${size}.png  ✓\n`);
  }

  const promoOut = path.join(OUT, 'promotional-tile.png');
  await writePng(promoSvg(), promoOut);
  process.stdout.write(`promotional-tile.png  ✓\n`);

  process.stdout.write(`\nAll assets written to: ${OUT}\n`);
})();
