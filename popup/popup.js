// Popup script for AliExpress Price Tracker

document.addEventListener('DOMContentLoaded', init);

const DEFAULT_API_BASE = 'http://localhost:3000';

const elements = {
  urlInput: document.getElementById('product-url'),
  titleInput: document.getElementById('product-title'),
  currentPriceInput: document.getElementById('current-price'),
  targetPriceInput: document.getElementById('target-price'),
  trackBtn: document.getElementById('track-btn'),
  untrackBtn: document.getElementById('untrack-btn'),
  productIdInput: document.getElementById('product-id'),
  statusArea: document.getElementById('status-area'),
  apiBaseUrlInput: document.getElementById('api-base-url'),
  apiKeyInput: document.getElementById('api-key'),
  notificationsEnabledInput: document.getElementById('notifications-enabled'),
  saveSettingsBtn: document.getElementById('save-settings-btn')
};

async function init() {
  await Promise.all([prefillFromTab(), loadSettings()]);

  elements.trackBtn.addEventListener('click', handleTrack);
  elements.untrackBtn.addEventListener('click', handleUntrack);
  elements.saveSettingsBtn.addEventListener('click', handleSaveSettings);
}

async function prefillFromTab() {
  let tab;

  try {
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  } catch (err) {
    console.error('Failed to get active tab:', err);
    return;
  }

  if (tab?.url) {
    elements.urlInput.value = tab.url;
    elements.titleInput.value = tab.title || '';
  }

  if (!tab?.id) return;

  try {
    const response = await browser.tabs.sendMessage(tab.id, { action: 'extractProduct' });
    if (response?.success) {
      elements.titleInput.value = response.title || elements.titleInput.value;
      elements.currentPriceInput.value = response.price || '';
      // Store additional data for tracking
      if (response.imageUrl || response.shopName || response.originalPrice) {
        window.__extractedProductData = {
          imageUrl: response.imageUrl,
          shopName: response.shopName,
          originalPrice: response.originalPrice
        };
      }
    }
  } catch (err) {
    console.log('Could not extract product info:', err.message);
  }
}

async function loadSettings() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getSettings' });
    const settings = response?.settings || {};

    elements.apiBaseUrlInput.value = settings.apiBaseUrl || DEFAULT_API_BASE;
    elements.apiKeyInput.value = settings.apiKey || '';
    elements.notificationsEnabledInput.checked = settings.notificationsEnabled !== false;
  } catch (err) {
    console.error('Failed to load settings:', err);
    elements.apiBaseUrlInput.value = DEFAULT_API_BASE;
    elements.notificationsEnabledInput.checked = true;
  }
}

async function handleSaveSettings() {
  const apiBaseUrl = elements.apiBaseUrlInput.value.trim() || DEFAULT_API_BASE;
  const apiKey = elements.apiKeyInput.value.trim();
  const notificationsEnabled = elements.notificationsEnabledInput.checked;

  if (!isValidUrl(apiBaseUrl)) {
    showStatus('Settings error: invalid API URL', 'error');
    return;
  }

  elements.saveSettingsBtn.disabled = true;

  try {
    const response = await browser.runtime.sendMessage({
      action: 'updateSettings',
      payload: { apiBaseUrl, apiKey, notificationsEnabled }
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to save settings');
    }

    showStatus('Settings saved', 'success');
  } catch (err) {
    showStatus(`Settings error: ${err.message}`, 'error');
  } finally {
    elements.saveSettingsBtn.disabled = false;
  }
}

async function handleUntrack() {
  const productId = elements.productIdInput.value;

  if (!productId) {
    showStatus('No product to untrack', 'error');
    return;
  }

  elements.untrackBtn.disabled = true;
  showStatus('Untracking product...', 'info');

  try {
    const response = await browser.runtime.sendMessage({
      action: 'untrackProduct',
      payload: { productId }
    });

    if (response?.success) {
      showStatus('Product untracked', 'success');
      elements.productIdInput.value = '';
      elements.trackBtn.classList.remove('hidden');
      elements.untrackBtn.classList.add('hidden');
    } else {
      showStatus(response?.error || 'Failed to untrack product', 'error');
    }
  } catch (err) {
    showStatus('Error: ' + err.message, 'error');
  } finally {
    elements.untrackBtn.disabled = false;
  }
}

async function handleTrack() {
  const url = elements.urlInput.value.trim();
  const title = elements.titleInput.value.trim();
  const currentPrice = elements.currentPriceInput.value.trim();
  const targetPrice = elements.targetPriceInput.value.trim();

  // Get additional extracted data
  const extractedData = window.__extractedProductData || {};
  delete window.__extractedProductData;

  if (!url) {
    showStatus('Please enter a product URL', 'error');
    return;
  }

  if (!isValidUrl(url)) {
    showStatus('Please enter a valid URL', 'error');
    return;
  }

  if (!isAliExpressUrl(url)) {
    showStatus('Only AliExpress URLs are supported', 'error');
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
        currentPrice: normalizeNumeric(currentPrice),
        targetPrice: normalizeNumeric(targetPrice),
        // Additional extracted data
        originalPrice: normalizeNumeric(extractedData.originalPrice),
        imageUrl: extractedData.imageUrl,
        shopName: extractedData.shopName
      }
    });

    if (response?.success) {
      showStatus(
        response.productId
          ? `Product tracked successfully! (ID: ${response.productId})`
          : 'Product tracked successfully!',
        'success'
      );
      
      // Show untrack button and store product ID
      if (response.productId) {
        elements.productIdInput.value = response.productId;
        elements.trackBtn.classList.add('hidden');
        elements.untrackBtn.classList.remove('hidden');
      }
      
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
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function isAliExpressUrl(string) {
  try {
    const parsed = new URL(string);
    return /(^|\.)aliexpress\.com$/i.test(parsed.hostname);
  } catch (_) {
    return false;
  }
}

function normalizeNumeric(value) {
  if (!value) return null;
  const numeric = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}
