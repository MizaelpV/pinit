// sidebar.js

const pinList    = document.getElementById('pin-list');
const emptyState = document.getElementById('empty-state');
const pinCount   = document.getElementById('pin-count');

// ── Relative timestamp ────────────────────────────────────────────────────────
function relativeTime(ts) {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  ===1) return 'yesterday';
  return `${days}d ago`;
}

// ── Escape ────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Render response: paragraphs + bold + line breaks ─────────────────────────
function renderResponse(text) {
  if (!text) return '';
  return text
    .split(/\n\n+/)
    .map(chunk => {
      const escaped = escapeHtml(chunk)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      return `<p>${escaped}</p>`;
    })
    .join('');
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
  width="13" height="13">
  <rect x="5" y="5" width="9" height="9" rx="1.5"/>
  <path d="M3 11V3a1 1 0 0 1 1-1h8"/>
</svg>`;

const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  width="13" height="13"><polyline points="2 8 6 12 14 4"/></svg>`;

const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  width="12" height="12"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>`;

// ── Render card ───────────────────────────────────────────────────────────────
function renderCard(pin) {
  const body    = pin.snippet || pin.response || '';
  const isLong  = body.length > 200;

  const card = document.createElement('article');
  card.className = 'pin-card';
  card.setAttribute('data-pin-id', pin.id);

  card.innerHTML = `
    <div class="pin-card__actions">
      <button class="pin-card__copy" title="Copy response">${COPY_ICON}</button>
      <button class="pin-card__remove" title="Remove pin">${CLOSE_ICON}</button>
    </div>

    <div class="pin-card__prompt">
      ${pin.prompt ? escapeHtml(pin.prompt) : '<em>No prompt</em>'}
    </div>

    <div class="pin-card__divider"></div>

    <div class="pin-card__body${isLong ? ' pin-card__body--collapsed' : ''}">
      <div class="pin-card__response">${renderResponse(body)}</div>
    </div>

    ${isLong ? `<button class="pin-card__expand">▾ Show more</button>` : ''}

    <div class="pin-card__footer">
      <span class="pin-card__time">${relativeTime(pin.timestamp)}</span>
    </div>
  `;

  // Expand / collapse
  if (isLong) {
    const expandBtn = card.querySelector('.pin-card__expand');
    const bodyEl    = card.querySelector('.pin-card__body');
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const collapsed = bodyEl.classList.toggle('pin-card__body--collapsed');
      expandBtn.textContent = collapsed ? '▾ Show more' : '▴ Show less';
    });
  }

  // Copy
  card.querySelector('.pin-card__copy').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    navigator.clipboard.writeText(body).then(() => {
      btn.innerHTML = CHECK_ICON;
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('copied'); }, 1500);
    });
  });

  // Remove
  card.querySelector('.pin-card__remove').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'PIN_REMOVE', data: { id: pin.id } }, () => {
      card.remove();
      updateEmptyState(pinList.querySelectorAll('.pin-card').length);
    });
  });

  // Click → scroll to turn + flash this card
  card.addEventListener('click', async (e) => {
    if (e.target.closest('.pin-card__copy, .pin-card__remove, .pin-card__source, .pin-card__expand')) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.sendMessage(tab.id, { type: 'SCROLL_TO', id: pin.id });
    // Flash the card
    card.classList.remove('pin-card--flash');
    void card.offsetWidth; // reflow to restart animation
    card.classList.add('pin-card--flash');
    card.addEventListener('animationend', () => card.classList.remove('pin-card--flash'), { once: true });
  });

  return card;
}

// ── Empty state ───────────────────────────────────────────────────────────────
function updateEmptyState(count) {
  emptyState.hidden = count > 0;
  pinCount.textContent = count > 0 ? String(count) : '';
}

// ── Load ──────────────────────────────────────────────────────────────────────
function loadPins() {
  chrome.runtime.sendMessage({ type: 'PIN_GET_ALL' }, (res) => {
    const pins = res?.pins || [];
    pinList.innerHTML = '';
    pins.forEach(pin => pinList.appendChild(renderCard(pin)));
    updateEmptyState(pins.length);
  });
}

loadPins();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pins) loadPins();
});

// Close sidebar when user switches tabs
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CLOSE_SIDEBAR') window.close();
});
