const puppeteer = require('puppeteer');

async function analyze() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  page.on('request', request => {
    const url = request.url();
    if (url.includes('review') || url.includes('list') || url.includes('api')) {
      console.log('Request:', url);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('review') && (url.includes('list') || url.includes('estimate'))) {
      console.log('Response:', url);
      try {
        const text = await response.text();
        console.log('JSON Length:', text.length);
        console.log('Sample:', text.substring(0, 500));
      } catch (e) {}
    }
  });

  console.log('Navigating to Musinsa...');
  await page.goto('https://www.musinsa.com/products/5923474', { waitUntil: 'networkidle2' });
  
  console.log('Scrolling down...');
  await page.evaluate(() => window.scrollBy(0, 3000));
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Scrolling more...');
  await page.evaluate(() => window.scrollBy(0, 5000));
  await new Promise(r => setTimeout(r, 5000));

  await browser.close();
}

analyze();
