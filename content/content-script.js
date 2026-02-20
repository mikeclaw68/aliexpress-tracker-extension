// Content script for AliExpress product pages

// Listen for messages from popup/background
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractProduct') {
    const product = extractProductInfo();
    sendResponse(product);
  }
  return true;
});

function extractProductInfo() {
  const result = {
    success: false,
    url: window.location.href,
    title: null,
    price: null
  };

  // Try to extract title
  result.title = extractTitle();

  // Try to extract price
  result.price = extractPrice();

  result.success = !!(result.title || result.price);
  return result;
}

function extractTitle() {
  // Try various selectors for product title
  const selectors = [
    // Main product title on new design
    '.product-title-text',
    '.product-title',
    '#productTitle',
    // AliExpress specific selectors
    '[data-Product-attr="title"]',
    '.title-text',
    // Meta tags as fallback
    "meta[property='og:title']",
    // Heading fallback
    'h1'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.tagName === 'META' ? el.content : el.textContent?.trim();
      if (text) return text;
    }
  }

  // Fallback to page title
  return document.title?.split('|')[0]?.split('-')[0]?.trim() || null;
}

function extractPrice() {
  // Try various selectors for price
  const selectors = [
    // Main price elements
    '.product-price-value',
    '.price-value',
    '[data-Product-attr="price"]',
    // New AliExpress design
    '.price--XWr7R',
    // Old selectors
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price .a-offscreen',
    // Generic price patterns
    '[class*="price"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent?.trim() || el.innerText?.trim();
      if (text) {
        const price = parsePrice(text);
        if (price !== null) return price;
      }
    }
  }

  // Try to find price in page content via regex
  const priceMatch = document.body.innerText.match(/[\$€£]?\s*(\d+[.,]\d{2})/);
  if (priceMatch) {
    return priceMatch[1].replace(',', '.');
  }

  return null;
}

function parsePrice(text) {
  // Remove currency symbols and whitespace, handle different formats
  const cleaned = text.replace(/[^\d.,]/g, '').trim();
  
  // Handle European format (1.234,56) vs US format (1,234.56)
  let price = null;
  
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // European format: 1.234,56
      price = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      price = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be European decimal or US thousand separator
    const parts = cleaned.split(',');
    if (parts[parts.length - 1].length === 2) {
      // Likely European decimal: 1234,56
      price = cleaned.replace(',', '.');
    } else {
      // Likely US thousand: 1,234
      price = cleaned.replace(/,/g, '');
    }
  } else {
    price = cleaned;
  }

  const numeric = parseFloat(price);
  return isNaN(numeric) ? null : numeric.toFixed(2);
}
