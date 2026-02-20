// Background service worker for AliExpress Price Tracker

const DEFAULT_API_BASE = 'http://localhost:3000';

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'trackProduct') {
    handleTrackProduct(message.payload)
      .then((response) => sendResponse(response))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'untrackProduct') {
    handleUntrackProduct(message.payload)
      .then((response) => sendResponse(response))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'getSettings') {
    getSettings()
      .then((settings) => sendResponse({ success: true, settings }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'updateSettings') {
    updateSettings(message.payload)
      .then((settings) => sendResponse({ success: true, settings }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  return false;
});

async function handleTrackProduct(payload = {}) {
  const { url, title, currentPrice, targetPrice, originalPrice, imageUrl, shopName } = payload;

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  if (!isAliExpressUrl(url)) {
    return { success: false, error: 'Only AliExpress product URLs are supported' };
  }

  // Extract AliExpress item ID from URL
  const aliexpressId = extractAliExpressId(url);
  if (!aliexpressId) {
    return { success: false, error: 'Could not extract product ID from URL' };
  }

  const settings = await getSettings();
  const apiBaseUrl = sanitizeApiBaseUrl(settings.apiBaseUrl || DEFAULT_API_BASE);

  // Create the product
  let productId = null;
  try {
    const response = await fetch(`${apiBaseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { 'x-api-key': settings.apiKey } : {})
      },
      body: JSON.stringify({
        aliexpressId,
        title: title || 'Unknown Product',
        currentPrice: normalizeNumeric(currentPrice),
        originalPrice: normalizeNumeric(originalPrice),
        imageUrl: imageUrl || null,
        shopName: shopName || null
      })
    });

    let responseData = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => '');
      responseData = text ? { message: text } : null;
    }

    if (!response.ok) {
      throw new Error(responseData?.message || `HTTP ${response.status}`);
    }

    productId = responseData?.product?.id ?? responseData?.id ?? null;

    // Note: Price alerts require user authentication and should be set up
    // through the web dashboard at this time. Target price is stored locally.
    if (targetPrice && productId) {
      // Store target price locally for now - can be synced with dashboard later
      await storeLocalTargetPrice(productId, targetPrice);
    }

    if (settings.notificationsEnabled) {
      await sendNotification('Product Tracked', `"${title || 'Unknown Product'}" is now being tracked.`);
    }

    // Set badge to show tracking is active
    await setBadge('✓', '#28a745');

    return {
      success: true,
      productId
    };
  } catch (error) {
    console.error('Failed to track product:', error);

    if (settings.notificationsEnabled) {
      await sendNotification('Tracking Failed', error.message);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

async function storeLocalTargetPrice(productId, targetPrice) {
  try {
    const stored = await browser.storage.local.get('trackedProducts') || {};
    const products = stored.trackedProducts || {};
    products[productId] = {
      targetPrice: normalizeNumeric(targetPrice),
      trackedAt: Date.now()
    };
    await browser.storage.local.set({ trackedProducts: products });
  } catch (err) {
    console.error('Failed to store target price:', err);
  }
}

function extractAliExpressId(url) {
  try {
    // Match patterns like:
    // /item/1234567890.html
    // /item/ABC1234567890.html
    // /-/item/1234567890.html
    const match = url.match(/\/item\/([a-zA-Z0-9_-]+)\.html/i);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

async function getSettings() {
  const defaults = {
    apiBaseUrl: DEFAULT_API_BASE,
    notificationsEnabled: true,
    apiKey: ''
  };

  const stored = await browser.storage.local.get(Object.keys(defaults));

  return {
    ...defaults,
    ...stored,
    apiBaseUrl: sanitizeApiBaseUrl(stored.apiBaseUrl || defaults.apiBaseUrl),
    notificationsEnabled: stored.notificationsEnabled !== false,
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey.trim() : ''
  };
}

async function updateSettings(incomingSettings = {}) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...incomingSettings,
    apiBaseUrl: sanitizeApiBaseUrl(incomingSettings.apiBaseUrl || current.apiBaseUrl),
    notificationsEnabled: incomingSettings.notificationsEnabled !== undefined
      ? !!incomingSettings.notificationsEnabled
      : current.notificationsEnabled,
    apiKey: typeof incomingSettings.apiKey === 'string'
      ? incomingSettings.apiKey.trim()
      : current.apiKey
  };

  await browser.storage.local.set({
    apiBaseUrl: merged.apiBaseUrl,
    notificationsEnabled: merged.notificationsEnabled,
    apiKey: merged.apiKey
  });

  return merged;
}

async function sendNotification(title, message) {
  try {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title,
      message
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

async function setBadge(text, color) {
  try {
    await browser.action.setBadgeText({ text: text || '' });
    await browser.action.setBadgeBackgroundColor({ color: color || '#ff6b00' });
  } catch (err) {
    // Fallback for Firefox - use browser.browserAction
    try {
      await browser.browserAction.setBadgeText({ text: text || '' });
      await browser.browserAction.setBadgeBackgroundColor({ color: color || '#ff6b00' });
    } catch (e) {
      // Ignore badge errors
    }
  }
}

async function handleUntrackProduct(payload = {}) {
  const { productId } = payload;

  if (!productId) {
    return { success: false, error: 'Product ID is required' };
  }

  const settings = await getSettings();
  const apiBaseUrl = sanitizeApiBaseUrl(settings.apiBaseUrl || DEFAULT_API_BASE);

  try {
    const response = await fetch(`${apiBaseUrl}/products/${productId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { 'x-api-key': settings.apiKey } : {})
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to untrack' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    // Clear local target price storage
    await clearLocalTargetPrice(productId);

    // Clear badge
    await setBadge('', '');

    if (settings.notificationsEnabled) {
      await sendNotification('Product Untracked', 'Product has been removed from tracking.');
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to untrack product:', error);
    return { success: false, error: error.message };
  }
}

async function clearLocalTargetPrice(productId) {
  try {
    const stored = await browser.storage.local.get('trackedProducts');
    if (stored.trackedProducts && stored.trackedProducts[productId]) {
      delete stored.trackedProducts[productId];
      await browser.storage.local.set({ trackedProducts: stored.trackedProducts });
    }
  } catch (err) {
    console.error('Failed to clear target price:', err);
  }
}

function sanitizeApiBaseUrl(url) {
  const fallback = DEFAULT_API_BASE;
  if (!url || typeof url !== 'string') return fallback;

  try {
    const parsed = new URL(url.trim());
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function normalizeNumeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function isAliExpressUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return /(^|\.)aliexpress\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}
