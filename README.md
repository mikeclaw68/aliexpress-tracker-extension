# AliExpress Price Tracker - Firefox Extension

A Firefox extension for tracking AliExpress product prices.

## Loading the Extension in Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to the `extension/` folder and select `manifest.json`
5. The extension icon will appear in your toolbar

## Usage

1. **Track a Product**: 
   - Navigate to an AliExpress product page
   - Click the extension icon in the toolbar
   - The popup should auto-fill the URL and any extractable product details
   - Enter a target price (optional) and click "Track Product"

2. **Manual Tracking**:
   - If extraction fails, manually enter the URL, title, and current price
   - Click "Track Product" to save

## Development

The extension consists of:
- `manifest.json` - Extension configuration (Manifest V3)
- `popup/` - Extension popup UI (HTML/CSS/JS)
- `content/content-script.js` - Extracts product info from AliExpress pages
- `background/service-worker.js` - Handles API calls and notifications

## Backend

The extension expects a backend API running at `http://localhost:3000` with:
- `POST /products` - Add a new tracked product
- Header `x-api-key` - API key authentication

Configure the API URL in the extension code or storage if different.

## Debugging

- Popup errors: Right-click popup → Inspect
- Background worker: Find the extension in about:debugging → Service Workers
- Content script: Use page's developer tools console
