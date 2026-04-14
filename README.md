# PinIt — Chrome Extension

Pin any Claude response (+ its prompt) and review all pins in a sidebar.

## Load as unpacked extension

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** ON (top-right)
3. Click **Load unpacked**
4. Select the `pinit/` folder in this repo
5. Navigate to **claude.ai** — the extension is now active

## Usage

| Action | How |
|--------|-----|
| Pin a response | Hover over any Claude response → click the 📌 button that appears in the action bar |
| Open sidebar | Click the PinIt icon in the Chrome toolbar |
| Jump to pinned response | Click any card in the sidebar — the page scrolls to it and flashes yellow |
| Remove a pin | Click the **×** on a card |

## Notes

- Pins are stored in `chrome.storage.local` (persists across sessions, cleared if you remove the extension).
- The pin button injects via `MutationObserver` with a 300 ms debounce so it waits for streaming to finish before appearing.
- No external libraries or build step required — pure vanilla JS.

## Files

```
pinit/
├── manifest.json       MV3 manifest
├── content.js          Injected into claude.ai — pin buttons + scroll listener
├── background.js       Service worker — storage CRUD + sidePanel open
├── sidebar.html        Side panel UI shell
├── sidebar.js          Side panel logic — render cards, send SCROLL_TO
├── styles/
│   ├── content.css     Pin button + toast + highlight styles
│   └── sidebar.css     Sidebar card layout, light/dark mode
└── icons/
    ├── pin.svg         Source SVG
    ├── generate-icons.js  One-time icon generator (node generate-icons.js)
    ├── pin16.png
    ├── pin32.png
    ├── pin48.png
    └── pin128.png
```
