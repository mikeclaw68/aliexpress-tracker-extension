# AliExpress Price Tracker - Firefox Extension

A Firefox extension for tracking AliExpress product prices.

## Loading the Extension in Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click **This Firefox** in the sidebar
3. Click **Load Temporary Add-on...**
4. Navigate to the `extension/` folder and select `manifest.json`
5. The extension icon will appear in your toolbar

## Usage

### 1) Track a Product

- Navigate to an AliExpress product page
- Click the extension icon in the toolbar
- The popup auto-fills URL and extracts product details when possible
- Enter a target price (optional) and click **Track Product**
- A checkmark badge will appear on the extension icon when tracked
- Use **Untrack Product** button to remove tracking

### 2) Configure Settings

Open **Settings** in the popup and configure:

- **API Base URL** (default: `http://localhost:3000`)
- **API Key** (optional)
- **Enable notifications** toggle

Click **Save Settings** before tracking.

### 3) Manual Tracking

If extraction fails, manually enter URL/title/current price and track from the popup.

## Backend Contract

The extension expects:

- `POST /products`
- Header `x-api-key` when configured
- JSON body:

```json
{
  "aliexpressId": "1234567890",
  "title": "Product name",
  "currentPrice": 19.99
}
```

Response format (either is accepted):
```json
{ "product": { "id": "prod_xxx" } }
```
or
```json
{ "id": "prod_xxx" }
```

## Validation Notes

Current behavior implemented:

- AliExpress URL guard in popup and background
- Content-script extraction on product pages with fallbacks
- Background handles non-JSON API errors gracefully
- Notification icon uses extension runtime URL

## Debugging

- Popup errors: right-click popup → **Inspect**
- Background worker logs: `about:debugging` → extension → **Inspect** service worker
- Content script logs: page developer tools console
