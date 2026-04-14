# PinIt — Dev Log

## 1. The Problem

I use Claude constantly during work — debugging, writing, planning — and I keep running into the same annoying pattern: I get a great response buried somewhere in a long conversation, I need to reference it again 20 minutes later, and I have to scroll through dozens of turns to find it. Claude has no native bookmarking, no "save this response" button, nothing. I wanted something that let me pin a specific answer (or a chunk of it I selected) and pull it up instantly in a sidebar without losing my place in the conversation. Five minutes of searching the Chrome Web Store confirmed nobody had built this for Claude yet, so I built it myself over a weekend.

---

## 2. The Interesting Technical Challenges

### The DOM had no stable selectors — until it did

The first version of the pin button injection relied on `[data-testid^="ai-turn"]` to identify assistant response containers. That matched nothing. Claude's actual DOM has no `ai-turn` testid at all. After inspecting the live page, the real identifiers turned out to be: `[data-testid="user-message"]` for human turns, `[role="group"][aria-label="Message actions"]` for the action bar, and `[data-testid="action-bar-copy"]` as a reliable anchor inside that bar.

The tricky part was that none of this was documented anywhere — Claude doesn't publish its DOM structure — so finding the real selectors required live DevTools inspection and a round of console queries like:

```js
[...document.querySelectorAll('[data-testid]')]
  .map(el => el.getAttribute('data-testid'))
  .filter((v,i,a) => a.indexOf(v)===i)
  .sort()
```

That output is what unblocked the whole injection strategy.

### Finding the right turn container without grabbing the whole chat

Once the action bar was found, injecting a button was easy. The hard part was figuring out *which text to pin*. The naive approach — `actionBar.closest('div').innerText` — grabbed the entire conversation. The DOM has no obvious turn-level wrapper. The solution was to walk up the ancestor chain from the action bar and stop at the first element that, when queried, contains a `[data-testid="user-message"]` descendant — meaning we'd just crossed the boundary into a multi-turn container:

```js
function findTurnContainer(actionBarEl) {
  let el = actionBarEl.parentElement;
  let lastGood = el;
  for (let i = 0; i < 20 && el && el !== document.body; i++) {
    if (el.querySelector('[data-testid="user-message"]')) return lastGood;
    lastGood = el;
    el = el.parentElement;
  }
  return lastGood;
}
```

The key insight: the moment an ancestor *contains* a user-message, you've gone one level too high. Return the previous level.

### `display: flex` silently wins against `[hidden]`

The empty state div had `hidden` set correctly in JS (`emptyState.hidden = true`) but kept showing up alongside pin cards. The bug: our CSS set `display: flex` on `.empty-state`, which has equal specificity to the browser's user-agent rule `[hidden] { display: none }`. Author styles beat user-agent styles, so `display: flex` won every time.

Fix: one line at the top of the CSS file:

```css
[hidden] { display: none !important; }
```

That's the kind of bug that takes way too long to find because nothing looks wrong in the code.

### Closing the sidebar without a close API

Chrome's sidePanel API has `open()` but no `close()`. The documented workaround — `setOptions({ enabled: false })` immediately followed by `setOptions({ enabled: true })` — didn't work reliably. What worked: recognizing that the sidebar is just an extension page, and extension pages can call `window.close()`. So when `chrome.tabs.onActivated` fires in the background service worker (tab switched), it broadcasts `{ type: 'CLOSE_SIDEBAR' }` to all extension pages, and `sidebar.js` listens and calls `window.close()`. Zero API gymnastics needed.

---

## 3. What I'd Do Differently

**The turn-container heuristic is fragile.** Walking 20 levels up the DOM and checking for `[data-testid="user-message"]` descendants works today but will break the moment Anthropic restructures their layout. The right fix is to request a proper extension API or at minimum watch for structural changes via `MutationObserver` and re-validate assumptions on every scan. Right now the extension is one Claude UI deploy away from silently pinning the wrong text.

**`chrome.storage.local` has a 5MB cap and no cleanup.** Every pin stores the full text of the response. A heavy user could hit the storage limit in a few weeks. The MVP should have at minimum a pin count cap (say, 100 pins) and a "clear all" button. Better: move to IndexedDB and store a reference + short preview, fetching full text on demand.

**The selection popup UX is incomplete.** Right now, if you select text across multiple paragraphs spanning both a user message and an assistant response, `isInsideAssistantTurn()` might return false and the popup won't appear, or worse it will appear and capture garbled text. The selection validation logic walks up `anchorNode` but ignores `focusNode` — a proper implementation needs to check *both* endpoints of the range.

---

## 4. What I Learned

- **Claude's CSP blocks all external requests from content scripts.** Any fetch or XHR from `content.js` will be rejected by the Content Security Policy. If you need to hit an external API (Notion, linear, anything), the call has to go through `background.js` which isn't subject to the page's CSP. This is easy to miss because the error in the console just says "blocked" with no obvious pointer to why.

- **`chrome.tabs.onActivated` in a MV3 service worker requires the `"tabs"` permission explicitly — `"activeTab"` alone is not enough.** `activeTab` only grants access to the currently-focused tab when the user explicitly invokes the extension. `onActivated` is a passive background listener and needs `"tabs"` in the permissions array or Chrome silently ignores it.

- **The MV3 service worker can die between events, wiping any in-memory state.** `previousTabId` stored in a plain variable in `background.js` resets to `null` every time the service worker goes to sleep (which Chrome does aggressively). For anything that needs to survive across events, you need `chrome.storage.session` (persists until browser close) or `chrome.storage.local`. In PinIt this means the auto-close feature misses the first tab switch after a period of inactivity — the cost of using a simple variable instead of persistent storage.

---

## 5. What's Next

**Selector resilience.** The biggest risk to the extension's continued usefulness is Claude's DOM changing. The right path is building a small test harness that runs against the live claude.ai page on a schedule (or on extension load) to verify that the expected selectors still resolve, and surfaces a warning badge if they don't. Right now a breaking Claude deploy means silent failure with no user feedback.

**Search and tagging.** The sidebar is a flat list of pins sorted by recency. Once you have more than 10-15 pins it becomes hard to find anything. Even basic full-text search over the stored `snippet` field would dramatically improve utility. Tags or folders (especially auto-tagging by conversation URL) would make it genuinely useful as a knowledge base.

**Multi-platform support.** The extension is hardcoded to `https://claude.ai/*`. The DOM-walking logic for finding turns, action bars, and user messages is Claude-specific, but the core concept — pin an AI response, view it in a sidebar — applies equally to ChatGPT, Gemini, Perplexity. A thin adapter layer per platform with shared storage and sidebar would make this a real tool rather than a claude.ai-only utility.
