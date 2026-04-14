// content.js — injected into https://claude.ai/*

const INJECTED_ATTR = 'data-pinit-injected';
const TURN_ID_ATTR  = 'data-pinit-id';

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function showToast(text = 'Pinned! 📌') {
  const existing = document.getElementById('pinit-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'pinit-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('pinit-toast--visible')));
  setTimeout(() => {
    toast.classList.remove('pinit-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 1500);
}

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  width="16" height="16">
  <line x1="12" y1="17" x2="12" y2="22"/>
  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
</svg>`;

function sendPin(pinObject) {
  try {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({ type: 'PIN_ADD', data: pinObject }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.ok) showToast('Pinned! 📌');
    });
  } catch (_) { /* context invalidated */ }
}

// ── DOM utilities ─────────────────────────────────────────────────────────────
function findPrecedingPrompt(el) {
  // Walk previous siblings at every ancestor level looking for user-message
  let cur = el;
  for (let depth = 0; depth < 20 && cur; depth++) {
    let sib = cur.previousElementSibling;
    while (sib) {
      if (sib.getAttribute('data-testid') === 'user-message')
        return (sib.innerText || sib.textContent || '').trim();
      const nested = sib.querySelector('[data-testid="user-message"]');
      if (nested) return (nested.innerText || nested.textContent || '').trim();
      sib = sib.previousElementSibling;
    }
    cur = cur.parentElement;
  }
  return '';
}

function findAndStampTurn(el) {
  // Walk up to find the element whose prev-sibling is a user-message
  let cur = el.nodeType === Node.TEXT_NODE ? el.parentElement : el;
  for (let i = 0; i < 20 && cur && cur !== document.body; i++) {
    let sib = cur.previousElementSibling;
    while (sib) {
      if (sib.getAttribute('data-testid') === 'user-message') {
        if (!cur.getAttribute(TURN_ID_ATTR)) cur.setAttribute(TURN_ID_ATTR, uid());
        return cur;
      }
      sib = sib.previousElementSibling;
    }
    cur = cur.parentElement;
  }
  return null;
}

function isInsideAssistantTurn(node) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  for (let i = 0; i < 20 && el && el !== document.body; i++) {
    if (el.getAttribute('data-testid') === 'user-message') return false;
    let sib = el.previousElementSibling;
    while (sib) {
      if (sib.getAttribute('data-testid') === 'user-message') return true;
      sib = sib.previousElementSibling;
    }
    el = el.parentElement;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ACTION BAR BUTTON — pin entire response
// ═══════════════════════════════════════════════════════════════════════════════

function findTurnContainer(actionBarEl) {
  // Walk up. The moment an ancestor CONTAINS a [data-testid="user-message"]
  // as a descendant, we've gone too far — return the previous level.
  let el = actionBarEl.parentElement;
  let lastGood = el;

  for (let i = 0; i < 20 && el && el !== document.body; i++) {
    if (el.querySelector('[data-testid="user-message"]')) {
      // This level wraps multiple turns — stop, use lastGood
      return lastGood;
    }
    lastGood = el;
    el = el.parentElement;
  }
  return lastGood;
}

// Extract only the response text — strip action bar + injected elements
function extractResponseText(turnEl) {
  const clone = turnEl.cloneNode(true);
  clone.querySelectorAll(
    '[data-testid="wiggle-controls-actions"], [class*="pinit"], .pinit-overlay-wrap'
  ).forEach(x => x.remove());
  return (clone.innerText || clone.textContent || '').trim();
}

// ── Match the exact button structure claude.ai uses ───────────────────────────
const BTN_SVG_20 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none"
  stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
  width="20" height="20" aria-hidden="true" style="flex-shrink:0">
  <line x1="10" y1="14" x2="10" y2="18.5"/>
  <path d="M4 14h12v-1.47a1.67 1.67 0 0 0-.93-1.49l-1.48-.75A1.67 1.67 0 0 1 12.67 8.97V5.5h.83a1.67 1.67 0 0 0 0-3.33H6.5a1.67 1.67 0 0 0 0 3.33h.83v3.47a1.67 1.67 0 0 1-.93 1.49l-1.48.75A1.67 1.67 0 0 0 4 12.53Z"/>
</svg>`;

function createActionBarEntry(turnEl) {
  // Outer wrapper matching claude.ai's w-fit pattern
  const wrap = document.createElement('div');
  wrap.className = 'w-fit';
  wrap.setAttribute('data-state', 'closed');

  // Button — copy all classes from the other action-bar buttons
  const btn = document.createElement('button');
  btn.className = [
    'inline-flex', 'items-center', 'justify-center', 'relative', 'isolate',
    'shrink-0', 'can-focus', 'select-none',
    'disabled:pointer-events-none', 'disabled:opacity-50',
    'border-transparent', 'transition', 'font-base', 'duration-300',
    'ease-[cubic-bezier(0.165,0.85,0.45,1)]',
    'h-8', 'w-8', 'rounded-md', 'group/btn',
    '_fill_10ocf_9', '_ghost_10ocf_96',
    'pinit-pin-btn',
  ].join(' ');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Pin this response');
  btn.setAttribute('title', 'Pin this response');

  // Icon wrapper — matches claude.ai's inner div
  const iconWrap = document.createElement('div');
  iconWrap.className = 'text-text-500 group-hover/btn:text-text-100';
  iconWrap.style.cssText = 'width:20px;height:20px;display:flex;align-items:center;justify-content:center;';
  iconWrap.innerHTML = BTN_SVG_20;

  btn.appendChild(iconWrap);
  wrap.appendChild(btn);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendPin({
      id: turnEl.getAttribute(TURN_ID_ATTR) || uid(),
      prompt: findPrecedingPrompt(turnEl),
      snippet: extractResponseText(turnEl),
      timestamp: Date.now(),
      url: window.location.href,
    });
  });

  return wrap;
}

function scanTurns() {
  // Use the exact aria-label we can see in the DOM
  document.querySelectorAll('[role="group"][aria-label="Message actions"]').forEach(group => {
    if (group.getAttribute(INJECTED_ATTR)) return;

    // Find the flex row that directly contains the action buttons.
    // action-bar-copy is inside: flexRow > div.w-fit > button
    // so: copy button → parent (w-fit) → parent (flex row)
    const copyBtn = group.querySelector('[data-testid="action-bar-copy"]');
    const buttonRow = copyBtn?.parentElement?.parentElement;
    if (!buttonRow) return;

    const turnEl = findTurnContainer(group);
    if (!turnEl.getAttribute(TURN_ID_ATTR)) turnEl.setAttribute(TURN_ID_ATTR, uid());

    const entry = createActionBarEntry(turnEl);
    buttonRow.appendChild(entry);
    group.setAttribute(INJECTED_ATTR, 'true');
  });
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanTurns, 300);
});
observer.observe(document.body, { childList: true, subtree: true });
scanTurns();

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SELECTION POPUP — pin selected text
// ═══════════════════════════════════════════════════════════════════════════════

let popup = null;
let pendingPin = null;

function getOrCreatePopup() {
  if (popup) return popup;
  popup = document.createElement('div');
  popup.id = 'pinit-selection-popup';
  popup.innerHTML = `<button id="pinit-sel-btn" title="Pin selection">${PIN_SVG}<span>Pin</span></button>`;
  document.body.appendChild(popup);

  popup.querySelector('#pinit-sel-btn').addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pendingPin) { hideSelPopup(); return; }
    sendPin(pendingPin);
    hideSelPopup();
    window.getSelection()?.removeAllRanges();
  });

  return popup;
}

function showSelPopup(rect, pinObj) {
  pendingPin = pinObj;
  const p = getOrCreatePopup();
  const top  = rect.bottom + window.scrollY + 8;
  const left = Math.min(
    rect.right + window.scrollX - 64,
    window.scrollX + window.innerWidth - 90
  );
  p.style.top  = `${top}px`;
  p.style.left = `${Math.max(left, window.scrollX + 8)}px`;
  p.classList.add('visible');
}

function hideSelPopup() {
  popup?.classList.remove('visible');
  pendingPin = null;
}

document.addEventListener('mouseup', () => {
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';

    if (!text || !sel.anchorNode || !isInsideAssistantTurn(sel.anchorNode)) {
      hideSelPopup();
      return;
    }

    const anchorNode = sel.anchorNode;
    const turnEl = findAndStampTurn(anchorNode);
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();

    showSelPopup(rect, {
      id: turnEl?.getAttribute(TURN_ID_ATTR) || uid(),
      prompt: findPrecedingPrompt(anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode),
      snippet: text,
      timestamp: Date.now(),
      url: window.location.href,
    });
  }, 10);
});

document.addEventListener('mousedown', (e) => {
  if (popup && !popup.contains(e.target)) hideSelPopup();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideSelPopup();
});

// ── SCROLL_TO from sidebar ────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'SCROLL_TO') return;
  const el = document.querySelector(`[${TURN_ID_ATTR}="${message.id}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('pinit-highlight');
  setTimeout(() => el.classList.remove('pinit-highlight'), 1200);
});
