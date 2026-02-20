// Background service worker for AliExpress Price Tracker

const DEFAULT_API_BASE = 'http://localhost:3000';

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'trackProduct') {
    handleTrackProduct(message.payload)
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
  const { url, title, currentPrice, targetPrice } = payload;

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  if (!isAliExpressUrl(url)) {
    return { success: false, error: 'Only AliExpress product URLs are supported' };
  }

  const settings = await getSettings();
  const apiBaseUrl = sanitizeApiBaseUrl(settings.apiBaseUrl || DEFAULT_API_BASE);

  try {
    const response = await fetch(`${apiBaseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { 'x-api-key': settings.apiKey } : {})
      },
      body: JSON.stringify({
        url,
        title: title || 'Unknown Product',
        currentPrice: normalizeNumeric(currentPrice),
        targetPrice: normalizeNumeric(targetPrice)
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

    if (settings.notificationsEnabled) {
      await sendNotification('Product Tracked', `"${title || 'Unknown Product'}" is now being tracked.`);
    }

    return {
      success: true,
      productId: responseData?.id ?? null
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
