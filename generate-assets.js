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
  const W = 440, H = 280, PAD = 40;
  const GRID = 20;

  // grid lines
  let gridLines = '';
  for (let x = 0; x <= W; x += GRID)
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#00000008"/>`;
  for (let y = 0; y <= H; y += GRID)
    gridLines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00000008"/>`;

  // ── Layout constants ──────────────────────────────────────────────────────────
  const ICON_SIZE    = 44;
  const TITLE_SIZE   = 38;
  const TAGLINE_SIZE = 14;
  const TAGLINE_H    = Math.ceil(TAGLINE_SIZE * 1.3); // ~18px rendered height
  const PILL_H       = 28;
  const BADGE_H      = 24;
  const BADGE_W      = 48;

  // gaps between rows
  const GAP_ICON_TAGLINE  = 12;
  const GAP_TAGLINE_DIV   = 16;
  const GAP_DIV_PILLS     = 16;
  const GAP_PILLS_BADGE   = 16;

  // total block height — used to vertically center
  const blockH = ICON_SIZE
               + GAP_ICON_TAGLINE + TAGLINE_H
               + GAP_TAGLINE_DIV  + 1        // divider
               + GAP_DIV_PILLS    + PILL_H
               + GAP_PILLS_BADGE  + BADGE_H;

  // ── Derived Y positions ───────────────────────────────────────────────────────
  const iconY      = Math.round((H - blockH) / 2) + 25;
  const taglineTop = iconY + ICON_SIZE + GAP_ICON_TAGLINE;
  const dividerY   = taglineTop + TAGLINE_H + GAP_TAGLINE_DIV;
  const pillsY     = dividerY + 1 + GAP_DIV_PILLS;
  const badgeY     = pillsY + PILL_H + GAP_PILLS_BADGE;

  // ── Pills: 3 × fixed width, fill content area exactly ────────────────────────
  const contentW = W - PAD * 2; // 360px
  const PILL_GAP = 12;
  const PILL_W   = Math.floor((contentW - PILL_GAP * 2) / 3); // 112px
  const PILL_RX  = 14;

  const pills = ['Pin any response', 'Instant sidebar', 'Scroll back'];
  let pillsGroup = '';
  pills.forEach((label, i) => {
    const px = PAD + i * (PILL_W + PILL_GAP);
    pillsGroup += `
    <rect x="${px}" y="${pillsY}" width="${PILL_W}" height="${PILL_H}" rx="${PILL_RX}"
      fill="#f5f3ff" stroke="#ede9fe" stroke-width="1"/>
    <text x="${px + PILL_W / 2}" y="${pillsY + PILL_H / 2}" text-anchor="middle"
      dominant-baseline="middle"
      font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      font-size="13" fill="#6d28d9">${label}</text>`;
  });

  // ── Icon embed ────────────────────────────────────────────────────────────────
  const pinBase64 = Buffer.from(
    pinSvg(ICON_SIZE, { bg: '#f5f3ff', fg: '#6d28d9', radius: 10 })
  ).toString('base64');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- background -->
  <rect width="${W}" height="${H}" fill="#ffffff" rx="12"/>

  <!-- grid -->
  <g>${gridLines}</g>

  <!-- icon -->
  <image x="${PAD}" y="${iconY}" width="${ICON_SIZE}" height="${ICON_SIZE}"
    href="data:image/svg+xml;base64,${pinBase64}"/>

  <!-- title — vertically centered with icon -->
  <text x="${PAD + ICON_SIZE + 12}" y="${iconY + ICON_SIZE / 2}"
    dominant-baseline="middle"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="${TITLE_SIZE}" font-weight="700" fill="#0f172a">PinIt</text>

  <!-- tagline -->
  <text x="${PAD}" y="${taglineTop + TAGLINE_SIZE}"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="${TAGLINE_SIZE}" fill="#64748b">Never lose a great Claude response again.</text>

  <!-- divider -->
  <line x1="${PAD}" y1="${dividerY}" x2="${W - PAD}" y2="${dividerY}"
    stroke="#e2e8f0" stroke-width="1"/>

  <!-- pills -->
  ${pillsGroup}

  <!-- Free badge -->
  <rect x="${PAD}" y="${badgeY}" width="${BADGE_W}" height="${BADGE_H}" rx="${BADGE_H / 2}"
    fill="#6d28d9"/>
  <text x="${PAD + BADGE_W / 2}" y="${badgeY + BADGE_H / 2}" text-anchor="middle"
    dominant-baseline="middle"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="12" font-weight="600" fill="#ddd6fe">Free</text>

  <!-- "For Claude.ai" -->
  <text x="${PAD + BADGE_W + 10}" y="${badgeY + BADGE_H / 2}"
    dominant-baseline="middle"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="12" fill="#94a3b8">For Claude.ai</text>
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
