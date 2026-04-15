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

// ── Marquee tile (1400×560) ───────────────────────────────────────────────────
function marqueeSvg() {
  const W = 1400, H = 560;
  const GRID = 40;
  const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;

  // grid lines
  let gridLines = '';
  for (let x = 0; x <= W; x += GRID)
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#00000008"/>`;
  for (let y = 0; y <= H; y += GRID)
    gridLines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00000008"/>`;

  // ── Shared vertical anchor ───────────────────────────────────────────────────
  const contentHeight = 380; // total span of all elements, both sides
  const startY = Math.floor((H - contentHeight) / 2); // 90 — equal top/bottom margins

  // ── Left: all Y = leftY + relative offset ────────────────────────────────────
  const BADGE_W = 52, BADGE_H = 26;
  const leftY     = startY + 35;   // shift left block down 35px from shared anchor
  const L_LABEL   = leftY + 13;    // label baseline (13px ascent from block top)
  const L_TITLE   = leftY + 73;    // +60 from label baseline
  const L_TAGLINE = leftY + 118;   // +45 from title baseline
  const L_DIVIDER = leftY + 148;   // +30 from tagline baseline
  const L_PILLS   = leftY + 168;   // +20 from divider
  const BADGE_Y   = leftY + 223;   // +55 from pills top (pill h32 + gap23)

  const pills = ['Pin any response', 'Instant sidebar', 'Scroll back'];
  const PILL_W = 150, PILL_H = 32, PILL_RX = 16, PILL_GAP = 14;
  let pillsGroup = '';
  pills.forEach((label, i) => {
    const px = 80 + i * (PILL_W + PILL_GAP);
    pillsGroup += `
    <rect x="${px}" y="${L_PILLS}" width="${PILL_W}" height="${PILL_H}" rx="${PILL_RX}"
      fill="#f5f3ff" stroke="#ede9fe" stroke-width="1.5"/>
    <text x="${px + PILL_W / 2}" y="${L_PILLS + PILL_H / 2}" text-anchor="middle"
      dominant-baseline="middle" font-family="${FONT}"
      font-size="13" fill="#6d28d9">${label}</text>`;
  });

  // ── Right: sidebar mockup ─────────────────────────────────────────────────────
  const SB_X = 760, SB_W = 560;
  const SB_Y  = startY - 20;                        // 70
  const SB_H  = (startY + contentHeight + 20) - SB_Y; // spans to startY+contentHeight+20 = 490
  const HDR_H = 56;
  const HDR_CY = SB_Y + HDR_H / 2;
  const BODY_Y = SB_Y + HDR_H;
  const BODY_H = SB_H - HDR_H;                // 364

  // cards centered in body
  const CARD_H = 152, CARD_GAP = 14;
  const CARD_W = SB_W - 32;                   // 528
  const CARD_X = SB_X + 16;
  const CARD_PAD_V = Math.round((BODY_H - (2 * CARD_H + CARD_GAP)) / 2); // 23
  const CARD1_Y = BODY_Y + CARD_PAD_V;
  const CARD2_Y = CARD1_Y + CARD_H + CARD_GAP;

  // header pin icon (white, transparent bg)
  const headerPin = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
    viewBox="0 0 100 100" fill="none" stroke="#ffffff" stroke-width="7"
    stroke-linecap="round" stroke-linejoin="round">
    <line x1="50" y1="69" x2="50" y2="84"/>
    <path d="M25 67h50v-6a8 8 0 0 0-4.3-7l-6.3-3.1A8 8 0 0 1 60 43.4V22h3a8 8 0 0 0 0-16H37a8 8 0 0 0 0 16h3v21.4A8 8 0 0 1 35.3 51l-6.3 3.1A8 8 0 0 0 25 61Z"/>
  </svg>`;
  const headerPinB64 = Buffer.from(headerPin).toString('base64');

  // render one pin card: prompt (muted) → divider → response (bold white) → show more → timestamp
  function renderCard(x, y, w, h, promptLines, responseLines) {
    const PAD = 16;
    let out = '';

    // card bg + subtle border
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"
      fill="#1d2538" stroke="#ffffff0d" stroke-width="1"/>`;

    // prompt — #8b96ae 12px normal
    promptLines.forEach((line, i) => {
      out += `<text x="${x + PAD}" y="${y + PAD + 12 + i * 15}"
        font-family="${FONT}" font-size="12" fill="#8b96ae">${line}</text>`;
    });

    // divider
    const divY = y + PAD + 12 + promptLines.length * 15 + 8;
    out += `<line x1="${x + PAD}" y1="${divY}" x2="${x + w - PAD}" y2="${divY}"
      stroke="#ffffff12" stroke-width="1"/>`;

    // response — #eef2f8 13px bold
    responseLines.forEach((line, i) => {
      out += `<text x="${x + PAD}" y="${divY + 16 + i * 17}"
        font-family="${FONT}" font-size="13" font-weight="600" fill="#eef2f8">${line}</text>`;
    });

    // "▼ Show more" purple
    const smY = divY + 16 + responseLines.length * 17 + 10;
    out += `<text x="${x + PAD}" y="${smY}"
      font-family="${FONT}" font-size="11" fill="#7c3aed">&#9660; Show more</text>`;

    // timestamp bottom-right
    out += `<text x="${x + w - PAD}" y="${y + h - 10}" text-anchor="end"
      font-family="${FONT}" font-size="10" fill="#4a5568">1h ago</text>`;

    return out;
  }

  const card1 = renderCard(CARD_X, CARD1_Y, CARD_W, CARD_H,
    ["What's the difference between building an AI feature inside an",
     "existing product vs building an AI-native product from scratch?",
     "When does each approach make sense?"],
    ["This is one of the most consequential strategic decisions",
     "in AI product development right now. The distinction goes..."]
  );
  const card2 = renderCard(CARD_X, CARD2_Y, CARD_W, CARD_H,
    ["What are the most important things a software engineer should",
     "understand about building AI-powered products in 2026?",
     "Not just the technical side — the business and product thinking too."],
    ["Great question. Here's how I'd frame the most important",
     "mental models for building AI products in 2026..."]
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- background — edge to edge, no rounding -->
  <rect width="${W}" height="${H}" fill="#ffffff"/>

  <!-- grid -->
  <g>${gridLines}</g>

  <!-- ── LEFT ── -->
  <text x="80" y="${L_LABEL}" font-family="${FONT}"
    font-size="13" font-weight="600" fill="#a78bfa" letter-spacing="0.05em">Chrome Extension</text>

  <text x="80" y="${L_TITLE}" font-family="${FONT}"
    font-size="56" font-weight="700" fill="#0f172a">PinIt</text>

  <text x="80" y="${L_TAGLINE}" font-family="${FONT}"
    font-size="20" fill="#64748b">Never lose a great Claude response again.</text>

  <line x1="80" y1="${L_DIVIDER}" x2="620" y2="${L_DIVIDER}" stroke="#e2e8f0" stroke-width="1"/>

  ${pillsGroup}

  <rect x="80" y="${BADGE_Y}" width="${BADGE_W}" height="${BADGE_H}" rx="${BADGE_H / 2}" fill="#6d28d9"/>
  <text x="${80 + BADGE_W / 2}" y="${BADGE_Y + BADGE_H / 2}" text-anchor="middle"
    dominant-baseline="middle" font-family="${FONT}"
    font-size="12" font-weight="600" fill="#ddd6fe">Free</text>
  <text x="${80 + BADGE_W + 12}" y="${BADGE_Y + BADGE_H / 2}" dominant-baseline="middle"
    font-family="${FONT}" font-size="13" fill="#94a3b8">For Claude.ai</text>

  <!-- ── RIGHT: sidebar mockup ── -->

  <!-- sidebar body -->
  <rect x="${SB_X}" y="${SB_Y}" width="${SB_W}" height="${SB_H}" rx="16" fill="#131720"/>

  <!-- header — #1a2238, rounded top only -->
  <rect x="${SB_X}" y="${SB_Y}" width="${SB_W}" height="${HDR_H}" rx="16" fill="#1a2238"/>
  <rect x="${SB_X}" y="${SB_Y + HDR_H - 16}" width="${SB_W}" height="16" fill="#1a2238"/>

  <!-- pin icon + PinIt -->
  <image x="${SB_X + 20}" y="${HDR_CY - 11}" width="22" height="22"
    href="data:image/svg+xml;base64,${headerPinB64}"/>
  <text x="${SB_X + 48}" y="${HDR_CY}" dominant-baseline="middle"
    font-family="${FONT}" font-size="15" font-weight="600" fill="#ffffff">PinIt</text>

  <!-- count badge -->
  <circle cx="${SB_X + SB_W - 28}" cy="${HDR_CY}" r="15" fill="#6d28d9"/>
  <text x="${SB_X + SB_W - 28}" y="${HDR_CY}" text-anchor="middle" dominant-baseline="middle"
    font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">2</text>

  <!-- pin cards -->
  ${card1}
  ${card2}
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

  const marqueeOut = path.join(OUT, 'marquee-tile.png');
  await writePng(marqueeSvg(), marqueeOut);
  process.stdout.write(`marquee-tile.png  ✓\n`);

  process.stdout.write(`\nAll assets written to: ${OUT}\n`);
})();
