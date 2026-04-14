// background.js — Service Worker (MV3)

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ── Auto-close sidebar on tab switch ─────────────────────────────────────────
// Track the last active tab so we can close its panel when user switches away.
let previousTabId = null;

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (previousTabId !== null && previousTabId !== tabId) {
    // Tell the sidebar page to close itself (same as clicking the X button).
    // Ignore "no receiver" error — fires when sidebar is already closed.
    chrome.runtime.sendMessage({ type: 'CLOSE_SIDEBAR' }, () => {
      void chrome.runtime.lastError;
    });
  }
  previousTabId = tabId;
});

// ── Storage message handlers ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;

  if (type === 'PIN_ADD') {
    chrome.storage.local.get({ pins: [] }, (result) => {
      const pins = [data, ...result.pins];
      chrome.storage.local.set({ pins }, () => sendResponse({ ok: true }));
    });
    return true;
  }

  if (type === 'PIN_REMOVE') {
    chrome.storage.local.get({ pins: [] }, (result) => {
      const pins = result.pins.filter((p) => p.id !== data.id);
      chrome.storage.local.set({ pins }, () => sendResponse({ ok: true }));
    });
    return true;
  }

  if (type === 'PIN_GET_ALL') {
    chrome.storage.local.get({ pins: [] }, (result) => {
      sendResponse({ pins: result.pins });
    });
    return true;
  }
});
