
# Amazon Relay 2.0 (SwiftRelay-style UI Template)

> IMPORTANT: This code is a **generic template**. It does **NOT** contain any
> site-specific scraping or auto-booking logic for Amazon Relay or any other website.
> You must only use it on sites where you have permission and update the DOM selectors
> yourself, in compliance with their terms of service.

This version adds a popup UI that visually mimics the SwiftRelay-style panel:
- **Refresh** (ms) + **Randomizer** (ms)
- **Min. Payout**, **Min. Rate**, **Max. Stops**
- **Exclude** locations chips-style input
- **Range** (min & max minutes)
- **Auto Book** toggle + **How many?**
- "Booked: X" indicator
- **START** button

## Files

- `manifest.json` — Chrome extension manifest (MV3)
- `background.js` — Service worker handling auto-refresh & scheduling (ms-based)
- `contentScript.js` — Generic load parsing/filtering + stubbed auto-book hook
- `popup.html` — SwiftRelay-style popup UI
- `popup.js` — Popup logic for saving & loading preferences
- `styles.css` — Styling for SwiftRelay-style panel

## Setup

1. Open **chrome://extensions** in Chrome.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `Amazon Replay 2.0` folder.
5. Open a tab on the load board you want to test (where you have permission).
6. Click the extension icon, enable it (top-right dot), and configure your filters.

## Implementing site-specific logic

In `contentScript.js` you must implement:

- `parseLoadsFromPage()` — Read the page DOM and return an array of load objects
  with fields like `payout`, `rate`, `stops`, `pickupLocation`, `dropoffLocation`,
  `etaMinutesFromNow`, and `rawElement`.
- `autoBookLoad(load)` — Perform the actual booking action (e.g., clicking a button)
  in a way that is allowed by the site's policies.

The template only logs actions to the console by default.
