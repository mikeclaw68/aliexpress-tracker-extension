// Content script for AliExpress product pages
// Runs on all aliexpress.com pages, but only injects UI on product pages

(function () {
  'use strict';

  const TRACK_BTN_ID = 'ali-tracker-btn';
  const TRACK_PANEL_ID = 'ali-tracker-panel';

  // Check if this is a product page
  function isProductPage() {
    return /\/item\/[\w-]+\.html/i.test(window.location.href);
  }

  // Listen for messages from popup/background
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractProduct') {
      const product = extractProductInfo();
      sendResponse(product);
    }
    return true;
  });

  // Only inject track button on product pages
  if (!isProductPage()) return;

  // Wait a bit for the page to render dynamic content, then inject
  setTimeout(injectTrackButton, 1500);

  // Re-inject on SPA navigation (AliExpress uses client-side routing)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        if (isProductPage()) {
          injectTrackButton();
        } else {
          removeTrackButton();
        }
      }, 1500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function injectTrackButton() {
    // Don't duplicate
    if (document.getElementById(TRACK_BTN_ID)) return;

    // Create floating track button
    const btn = document.createElement('button');
    btn.id = TRACK_BTN_ID;
    btn.textContent = '📦 Track Price';
    btn.title = 'Track this product with AliExpress Price Tracker';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647',
      padding: '12px 20px',
      backgroundColor: '#ff6b00',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'all 0.2s ease',
      lineHeight: '1.2'
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#e55f00';
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = '#ff6b00';
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', () => {
      togglePanel();
    });

    document.body.appendChild(btn);
  }

  function removeTrackButton() {
    const btn = document.getElementById(TRACK_BTN_ID);
    if (btn) btn.remove();
    const panel = document.getElementById(TRACK_PANEL_ID);
    if (panel) panel.remove();
  }

  function togglePanel() {
    let panel = document.getElementById(TRACK_PANEL_ID);
    if (panel) {
      panel.remove();
      return;
    }

    const product = extractProductInfo();
    panel = document.createElement('div');
    panel.id = TRACK_PANEL_ID;
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '70px',
      right: '20px',
      zIndex: '2147483647',
      width: '320px',
      backgroundColor: '#fff',
      border: '1px solid #ddd',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      color: '#333',
      overflow: 'hidden'
    });

    // Build panel DOM safely (no innerHTML)
    const header = document.createElement('div');
    Object.assign(header.style, { padding: '14px 16px', background: '#ff6b00', color: '#fff', fontWeight: '600', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
    const headerTitle = document.createElement('span');
    headerTitle.textContent = '📦 Track Product';
    const closeBtn = document.createElement('span');
    closeBtn.id = 'ali-tracker-close';
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, { cursor: 'pointer', fontSize: '18px', opacity: '0.8' });
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    Object.assign(body.style, { padding: '14px 16px' });

    // Title section
    const titleSection = document.createElement('div');
    titleSection.style.marginBottom = '10px';
    const titleLabel = document.createElement('div');
    Object.assign(titleLabel.style, { fontSize: '12px', color: '#888', marginBottom: '2px' });
    titleLabel.textContent = 'Title';
    const titleValue = document.createElement('div');
    Object.assign(titleValue.style, { fontSize: '13px', fontWeight: '500', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis' });
    titleValue.textContent = product.title || 'Unknown Product';
    titleSection.appendChild(titleLabel);
    titleSection.appendChild(titleValue);

    // Price section
    const priceSection = document.createElement('div');
    priceSection.style.marginBottom = '10px';
    const priceLabel = document.createElement('div');
    Object.assign(priceLabel.style, { fontSize: '12px', color: '#888', marginBottom: '2px' });
    priceLabel.textContent = 'Current Price';
    const priceValue = document.createElement('div');
    Object.assign(priceValue.style, { fontSize: '16px', fontWeight: '700', color: '#ff6b00' });
    priceValue.textContent = product.price ? '$' + product.price : 'Not detected';
    priceSection.appendChild(priceLabel);
    priceSection.appendChild(priceValue);

    // Target price input
    const targetSection = document.createElement('div');
    targetSection.style.marginBottom = '12px';
    const targetLabel = document.createElement('label');
    Object.assign(targetLabel.style, { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' });
    targetLabel.textContent = 'Target Price (optional)';
    const targetInput = document.createElement('input');
    targetInput.id = 'ali-tracker-target';
    targetInput.type = 'number';
    targetInput.step = '0.01';
    targetInput.placeholder = 'Alert when below...';
    Object.assign(targetInput.style, { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' });
    targetSection.appendChild(targetLabel);
    targetSection.appendChild(targetInput);

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.id = 'ali-tracker-submit';
    submitBtn.textContent = 'Track This Product';
    Object.assign(submitBtn.style, { width: '100%', padding: '10px', background: '#ff6b00', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' });

    // Status div
    const statusDiv = document.createElement('div');
    statusDiv.id = 'ali-tracker-status';
    Object.assign(statusDiv.style, { marginTop: '8px', textAlign: 'center', fontSize: '13px' });

    body.appendChild(titleSection);
    body.appendChild(priceSection);
    body.appendChild(targetSection);
    body.appendChild(submitBtn);
    body.appendChild(statusDiv);

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(panel);

    // Event listeners
    closeBtn.addEventListener('click', () => {
      panel.remove();
    });

    submitBtn.addEventListener('click', async () => {

      submitBtn.disabled = true;
      submitBtn.textContent = 'Tracking...';
      statusDiv.textContent = '';

      try {
        const response = await browser.runtime.sendMessage({
          action: 'trackProduct',
          payload: {
            url: product.url,
            title: product.title || 'Unknown Product',
            currentPrice: product.price,
            targetPrice: targetInput.value ? parseFloat(targetInput.value) : null,
            originalPrice: product.originalPrice,
            imageUrl: product.imageUrl,
            shopName: product.shopName
          }
        });

        if (response && response.success) {
          statusDiv.style.color = '#155724';
          statusDiv.textContent = '✅ Product tracked successfully!';
          submitBtn.textContent = 'Tracked!';
          submitBtn.style.backgroundColor = '#28a745';

          // Update floating button
          const btn = document.getElementById(TRACK_BTN_ID);
          if (btn) {
            btn.textContent = '✅ Tracking';
            btn.style.backgroundColor = '#28a745';
          }

          // Close panel after delay
          setTimeout(() => {
            const p = document.getElementById(TRACK_PANEL_ID);
            if (p) p.remove();
          }, 2000);
        } else {
          statusDiv.style.color = '#721c24';
          statusDiv.textContent = '❌ ' + (response?.error || 'Failed to track');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Track This Product';
        }
      } catch (err) {
        statusDiv.style.color = '#721c24';
        statusDiv.textContent = '❌ ' + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Track This Product';
      }
    });
  }

  function extractProductInfo() {
    const result = {
      success: false,
      url: window.location.href,
      title: null,
      price: null,
      imageUrl: null,
      shopName: null,
      originalPrice: null
    };

    result.title = extractTitle();
    result.price = extractPrice();
    result.originalPrice = extractOriginalPrice();
    result.imageUrl = extractImageUrl();
    result.shopName = extractShopName();
    result.success = !!(result.title || result.price);
    return result;
  }

  function extractTitle() {
    const selectors = [
      'h1[data-pl="product-title"]',
      '.product-title-text',
      '.product-title',
      '#productTitle',
      'h1'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length > 3) return text;
      }
    }

    // og:title fallback
    const meta = document.querySelector("meta[property='og:title']");
    if (meta?.content) return meta.content.trim();

    // Document title fallback
    const t = document.title?.split('|')[0]?.split(' - ')[0]?.trim();
    return t || null;
  }

  function extractPrice() {
    // Try structured data first (JSON-LD)
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        const data = JSON.parse(script.textContent);
        const offers = data.offers || data?.mainEntity?.offers;
        if (offers) {
          const price = offers.price || offers.lowPrice;
          if (price) return parseFloat(price).toFixed(2);
        }
      }
    } catch (e) { /* ignore */ }

    // Try common selectors
    const selectors = [
      '[class*="Price"] [class*="value"]',
      '[class*="price"] [class*="value"]',
      '.product-price-value',
      '.uniform-banner-box-price',
      '[data-spm-anchor-id*="price"]',
      '.product-price-current'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const price = parsePrice(el.textContent);
        if (price !== null) return price;
      }
    }

    // Try meta tag
    const meta = document.querySelector("meta[property='product:price:amount']");
    if (meta?.content) {
      const p = parseFloat(meta.content);
      if (!isNaN(p)) return p.toFixed(2);
    }

    // Broad search: find elements containing price-like text
    const allEls = document.querySelectorAll('[class*="rice"], [class*="Rice"]');
    for (const el of allEls) {
      if (el.children.length > 3) continue; // Skip containers
      const price = parsePrice(el.textContent);
      if (price !== null && parseFloat(price) > 0.01 && parseFloat(price) < 100000) return price;
    }

    return null;
  }

  function parsePrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, '').trim();
    if (!cleaned) return null;

    let price = null;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        price = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        price = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      if (parts[parts.length - 1].length <= 2) {
        price = cleaned.replace(',', '.');
      } else {
        price = cleaned.replace(/,/g, '');
      }
    } else {
      price = cleaned;
    }

    const numeric = parseFloat(price);
    return isNaN(numeric) ? null : numeric.toFixed(2);
  }

  function extractOriginalPrice() {
    const selectors = [
      '.original-price',
      '.price--original',
      '[class*="rigin"]',
      '[class*="del-price"]',
      'del'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const price = parsePrice(el.textContent);
        if (price !== null) return price;
      }
    }
    return null;
  }

  function extractImageUrl() {
    // og:image is most reliable
    const meta = document.querySelector("meta[property='og:image']");
    if (meta?.content && meta.content.startsWith('http')) return meta.content;

    const selectors = [
      '.product-image img',
      '.gallery-image img',
      'img[class*="roduct"]',
      '.image-viewer img'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const src = el.src || el.getAttribute('data-src');
        if (src && src.startsWith('http')) return src;
      }
    }
    return null;
  }

  function extractShopName() {
    const selectors = [
      '.shop-name a',
      '.shop-name',
      '.store-name',
      'a[href*="/store/"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length > 1 && text.length < 100) return text;
      }
    }
    return null;
  }
})();
