## Important Rules
- ALWAYS use email: mikeclaw68@gmail.com for commits
- Make extension UI public (separate repo)
- Keep API private
- For image understanding tasks, spawn a Codex subagent

# Firefox Extension - Development Guide

## Scope
Build and maintain the Firefox extension for AliExpress Tracker in this folder.

## Core Features
1. **Popup UI**
   - Minimal, fast popup for current page actions
   - Product tracking form (URL, title, target price)
   - Status view for sync/track success and errors
2. **Content Script**
   - Detect product context on AliExpress product pages
   - Extract basic product metadata (title, URL, current price when available)
   - Communicate safely with background via message passing
3. **Background Service (MV3 service worker)**
   - Central state + API communication layer
   - Handle auth token/API key storage through extension storage
   - Orchestrate calls to backend and dispatch notifications
4. **Notifications**
   - Browser notifications for tracked-product events (price drop, sync failures)
   - Respect user enable/disable preference

## Engineering Rules
- Keep architecture simple (KISS), avoid speculative abstractions (YAGNI).
- Validate all runtime assumptions and fail with explicit errors.
- Minimize permissions; request only what is needed.
- Prefer typed-like data contracts in message payloads (stable keys).

## File Layout
- `manifest.json` - Firefox extension manifest
- `background/` - service worker scripts
- `content/` - content scripts for AliExpress pages
- `popup/` - popup HTML/CSS/JS
- `icons/` - extension icons

## Implementation Milestones
1. Bootstrap MV3 manifest + permissions + wiring
2. Implement popup UI and actions
3. Implement content extraction + messaging
4. Implement background API integration + notifications
5. Manual verification in Firefox temporary add-on flow

## Verification Checklist
- Popup opens and renders consistently
- On AliExpress product page, product details are extracted
- Clicking track sends data to background and API
- Success/failure feedback is visible in popup
- Notification appears when triggered by background logic
