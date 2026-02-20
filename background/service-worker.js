// Background service worker for AliExpress Price Tracker

const DEFAULT_API_BASE = 'http://localhost:3000';

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'trackProduct') {
    handleTrackProduct(message.payload)
      .then(response => sendResponse(response))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'getSettings') {
    getSettings().then(settings => sendResponse(settings));
    return true;
  }

  if (message.action === 'updateSettings') {
    updateSettings(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleTrackProduct(payload) {
  const { url, title, currentPrice, targetPrice } = payload;

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  // Get settings
  const settings = await getSettings();
  const apiBaseUrl = settings.apiBaseUrl || DEFAULT_API_BASE;

  try {
    // Call backend API
    const response = await fetch(`${apiBaseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey || ''
      },
      body: JSON.stringify({
        url,
        title,
        currentPrice: currentPrice ? parseFloat(currentPrice) : null,
        targetPrice
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const product = await response.json();

    // Send notification if enabled
    if (settings.notificationsEnabled) {
      await sendNotification('Product Tracked', `"${title}" is now being tracked.`);
    }

    return {
      success: true,
      productId: product.id
    };
  } catch (error) {
    console.error('Failed to track product:', error);

    // Send error notification
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

  try {
    const stored = await browser.storage.local.get(Object.keys(defaults));
    return { ...defaults, ...stored };
  } catch (err) {
    console.error('Failed to get settings:', err);
    return defaults;
  }
}

async function updateSettings(settings) {
  try {
    await browser.storage.local.set(settings);
  } catch (err) {
    console.error('Failed to save settings:', err);
    throw err;
  }
}

async function sendNotification(title, message) {
  try {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: '../icons/icon-48.png',
      title,
      message
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}
