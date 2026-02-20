// Popup script for AliExpress Price Tracker

document.addEventListener('DOMContentLoaded', init);

const elements = {
  urlInput: document.getElementById('product-url'),
  titleInput: document.getElementById('product-title'),
  currentPriceInput: document.getElementById('current-price'),
  targetPriceInput: document.getElementById('target-price'),
  trackBtn: document.getElementById('track-btn'),
  statusArea: document.getElementById('status-area')
};

async function init() {
  // Load current tab info
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      elements.urlInput.value = tab.url;
      elements.titleInput.value = tab.title || '';
    }
  } catch (err) {
    console.error('Failed to get tab info:', err);
  }

  // Try to extract product info from content script
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const response = await browser.tabs.sendMessage(tab.id, { action: 'extractProduct' });
      if (response?.success) {
        elements.titleInput.value = response.title || elements.titleInput.value;
        elements.currentPriceInput.value = response.price || '';
      }
    }
  } catch (err) {
    // Content script not loaded or not on product page - that's ok, user can manually enter
    console.log('Could not extract product info:', err.message);
  }

  // Load saved settings
  try {
    const settings = await browser.storage.local.get(['apiBaseUrl', 'notificationsEnabled']);
    if (!settings.apiBaseUrl) {
      await browser.storage.local.set({ apiBaseUrl: 'http://localhost:3000' });
    }
    if (settings.notificationsEnabled === undefined) {
      await browser.storage.local.set({ notificationsEnabled: true });
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Set up track button
  elements.trackBtn.addEventListener('click', handleTrack);
}

async function handleTrack() {
  const url = elements.urlInput.value.trim();
  const title = elements.titleInput.value.trim();
  const currentPrice = elements.currentPriceInput.value.trim();
  const targetPrice = elements.targetPriceInput.value.trim();

  if (!url) {
    showStatus('Please enter a product URL', 'error');
    return;
  }

  if (!isValidUrl(url)) {
    showStatus('Please enter a valid URL', 'error');
    return;
  }

  elements.trackBtn.disabled = true;
  showStatus('Tracking product...', 'info');

  try {
    const response = await browser.runtime.sendMessage({
      action: 'trackProduct',
      payload: {
        url,
        title: title || 'Unknown Product',
        currentPrice: currentPrice || null,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null
      }
    });

    if (response?.success) {
      showStatus(`Product tracked successfully! (ID: ${response.productId})`, 'success');
      clearForm();
    } else {
      showStatus(response?.error || 'Failed to track product', 'error');
    }
  } catch (err) {
    showStatus('Error: ' + err.message, 'error');
  } finally {
    elements.trackBtn.disabled = false;
  }
}

function showStatus(message, type) {
  elements.statusArea.textContent = message;
  elements.statusArea.className = `status ${type}`;
}

function clearForm() {
  elements.targetPriceInput.value = '';
  elements.currentPriceInput.value = '';
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}
