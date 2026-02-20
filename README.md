# AliExpress Price Tracker — Firefox Extension

A Firefox extension that detects AliExpress product pages, shows a floating "Track Price" button, and saves tracked products to a configurable backend API.

## Quick Start

### 1. Load in Firefox (Temporary Add-on)

1. Open Firefox → navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `manifest.json` from this folder
4. The orange 📦 icon appears in your toolbar

> **Note:** Temporary add-ons are removed on Firefox restart. For persistent installation, package as `.xpi` via `web-ext build`.

### 2. Configure Backend

1. Click the extension icon → expand **Settings**
2. Set **API Base URL** (default: `http://localhost:3000`)
3. Set **API Key** if your backend requires one
4. Click **Save Settings**

### 3. Track a Product

**Option A — Floating button (recommended):**
- Navigate to any AliExpress product page (URL contains `/item/...html`)
- A floating **📦 Track Price** button appears bottom-right
- Click it → review extracted product info → set optional target price → **Track This Product**

**Option B — Popup:**
- On any AliExpress page, click the extension icon in the toolbar
- The popup auto-fills URL, title, and price from the active tab
- Enter target price (optional) → **Track Product**

## Backend API Contract

The extension sends product data to your backend. Expected endpoints:

### `POST /products`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <key>` (if configured in settings)

**Request body:**
```json
{
  "aliexpressId": "1005006123456789",
  "title": "Product name",
  "currentPrice": 19.99,
  "originalPrice": 29.99,
  "imageUrl": "https://...",
  "shopName": "Store Name"
}
```

**Response** (either format accepted):
```json
{ "product": { "id": "prod_xxx" } }
```
or:
```json
{ "id": "prod_xxx" }
```

### `DELETE /products/:id`
Removes a product from tracking.

## Environment / Settings

| Setting | Default | Description |
|---------|---------|-------------|
| API Base URL | `http://localhost:3000` | Backend server URL |
| API Key | *(empty)* | Sent as `x-api-key` header |
| Notifications | `true` | Browser notifications on track/untrack |

Settings are stored in `browser.storage.local`.

## Development

### Lint
```bash
npx web-ext lint
```

### Run with auto-reload
```bash
npx web-ext run --firefox=/path/to/firefox
```

### Build `.xpi`
```bash
npx web-ext build
```

## Debugging

| What | How |
|------|-----|
| Popup errors | Right-click popup → **Inspect** |
| Background script | `about:debugging` → extension → **Inspect** |
| Content script | Page DevTools console (filter by extension) |
| Network requests | Background script inspector → Network tab |

## Architecture

```
manifest.json              — Extension manifest (MV3, Firefox-compatible)
background/service-worker.js — Background script: API calls, storage, notifications
content/content-script.js  — Injected on aliexpress.com: product detection, track button
popup/popup.html/js/css     — Toolbar popup: manual tracking, settings
icons/                      — Extension icons (48/96/128px)
```

## Compatibility

- **Firefox** ≥ 109 (Manifest V3)
- Tested with `web-ext lint`: 0 errors
