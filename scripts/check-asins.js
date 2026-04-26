const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteerExtra.use(StealthPlugin());

(async () => {
  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US'],
  });
  const page = await browser.newPage();
  
  const asins = ['B0FWQ6DGS5', 'B0GFW3MDWW'];
  
  for (const asin of asins) {
    console.log(`Checking ASIN: ${asin}`);
    try {
      await page.goto(`https://www.amazon.com/product-reviews/${asin}/?sortBy=recent`, { waitUntil: 'networkidle2', timeout: 60000 });
      const info = await page.evaluate(() => {
        const title = document.title;
        const reviewCountText = document.querySelector('[data-hook="cr-filter-info-section"]') ?.textContent ?.trim() || 'No count found';
        const reviews = document.querySelectorAll('[data-hook="review"]').length;
        const noReviewsMessage = document.querySelector('.a-section.a-spacing-top-extra-large') ?.textContent ?.trim() || '';
        return { title, reviewCountText, reviews, noReviewsMessage };
      });
      console.log(JSON.stringify(info, null, 2));
    } catch (e) {
      console.log(`Error checking ${asin}: ${e.message}`);
    }
  }

  await browser.close();
})().catch(console.error);
