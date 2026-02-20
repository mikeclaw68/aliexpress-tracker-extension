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

    panel.innerHTML = `
      <div style="padding:14px 16px; background:#ff6b00; color:#fff; font-weight:600; font-size:15px; display:flex; justify-content:space-between; align-items:center;">
        <span>📦 Track Product</span>
        <span id="ali-tracker-close" style="cursor:pointer; font-size:18px; opacity:0.8;">✕</span>
      </div>
      <div style="padding:14px 16px;">
        <div style="margin-bottom:10px;">
          <div style="font-size:12px; color:#888; margin-bottom:2px;">Title</div>
          <div style="font-size:13px; font-weight:500; max-height:40px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(product.title || 'Unknown Product')}</div>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:12px; color:#888; margin-bottom:2px;">Current Price</div>
          <div style="font-size:16px; font-weight:700; color:#ff6b00;">${product.price ? '$' + product.price : 'Not detected'}</div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px; color:#888; display:block; margin-bottom:4px;">Target Price (optional)</label>
          <input id="ali-tracker-target" type="number" step="0.01" placeholder="Alert when below..." style="width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:6px; font-size:13px; box-sizing:border-box;">
        </div>
        <button id="ali-tracker-submit" style="width:100%; padding:10px; background:#ff6b00; color:#fff; border:none; border-radius:6px; font-size:14px; font-weight:500; cursor:pointer;">
          Track This Product
        </button>
        <div id="ali-tracker-status" style="margin-top:8px; text-align:center; font-size:13px;"></div>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    panel.querySelector('#ali-tracker-close').addEventListener('click', () => {
      panel.remove();
    });

    panel.querySelector('#ali-tracker-submit').addEventListener('click', async () => {
      const targetInput = panel.querySelector('#ali-tracker-target');
      const statusDiv = panel.querySelector('#ali-tracker-status');
      const submitBtn = panel.querySelector('#ali-tracker-submit');

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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
