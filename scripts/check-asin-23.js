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
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const asin = 'B0GFW3MDWW';
  const cookiePath = './scripts/amazon-cookies.json';
  if (fs.existsSync(cookiePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
    await page.setCookie(...cookies);
  }

  console.log(`Checking ASIN: ${asin}`);
  const url = `https://www.amazon.com/product-reviews/${asin}/?sortBy=recent`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  
  console.log('Final URL:', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log('Body Text (Excerpt):', bodyText);
  
  const reviews = await page.evaluate(() => document.querySelectorAll('[data-hook="review"]').length);
  console.log('Review elements count:', reviews);
  
  const allLinks = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 20));
  console.log('Sample links:', allLinks);

  await browser.close();
})().catch(console.error);
