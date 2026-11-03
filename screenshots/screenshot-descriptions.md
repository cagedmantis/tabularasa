# Chrome Web Store Screenshots

`make screenshots` renders these from the real extension: `manager.html`,
`manager.css` and the compiled `dist/manager.js`, with
[`stub-chrome.js`](stub-chrome.js) standing in for the `chrome.*` APIs with
demo tabs ([`capture.py`](capture.py)). They change whenever the interface
does, so regenerate them before a store submission that changes the UI.

Requirements: 1280x800 PNG, no transparency, 1 to 5 screenshots.

| File | Shows |
|---|---|
| `screenshot-1.png` | Window view (light), three tabs selected: the bulk actions, pinned, audible and muted tabs, the active-tab label |
| `screenshot-2.png` | Tab group view (light): ungrouped tabs and a colored Chrome tab group with its actions |
| `screenshot-3.png` | Search for "github" (dark theme) |
| `screenshot-4.png` | Saved sessions (light) |
| `promo-small-440x280.png` | Small promo tile: logo, name and tagline |
