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
  const asin = 'B0FNCYCZFR';
  
  const cookiePath = './scripts/amazon-cookies.json';
  if (fs.existsSync(cookiePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
    await page.setCookie(...cookies);
  }

  await page.goto(`https://www.amazon.com/product-reviews/${asin}/?sortBy=recent`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  fs.writeFileSync('amazon_debug.html', html);
  
  const reviewCount = await page.evaluate(() => document.querySelectorAll('[data-hook="review"]').length);
  console.log('Reviews found with [data-hook="review"]:', reviewCount);
  
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, span')).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim() || '',
        dataHook: el.getAttribute('data-hook') || '',
        className: el.className
    })).filter(b => b.text.includes('Show') || b.text.includes('more') || b.text.includes('Next'));
  });
  console.log('Potential buttons:', JSON.stringify(buttons, null, 2));

  await browser.close();
})().catch(console.error);
