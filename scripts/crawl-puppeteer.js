const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createPool } = require('@vercel/postgres');

// Vercel Postgres 연결 설정
const pool = createPool({
  connectionString: process.env.POSTGRES_URL
});

async function fetchOliveYoungRankings() {
  const url = "https://www.oliveyoung.co.kr/store/main/getBestList.do?t_page=%ED%99%88&t_click=GNB&t_gnb_type=%EB%9E%AD%ED%82%B9&t_swiping_type=N";
  
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the product list to be visible
    console.log('Waiting for product list...');
    await page.waitForSelector('div.prd_info', { timeout: 30000 });
    
    // Extract data
    const rankings = await page.evaluate(() => {
      const items = [];
      const productElements = document.querySelectorAll('div.prd_info');
      
      productElements.forEach((elem, idx) => {
        const rank = idx + 1;
        const titleElem = elem.querySelector('p.tx_name');
        const title = titleElem ? titleElem.innerText.trim() : '';
        
        const brandElem = elem.querySelector('span.tx_brand, p.tx_brand');
        const brand = brandElem ? brandElem.innerText.trim() : '';
        
        const priceElem = elem.querySelector('span.tx_cur > span.tx_num, span.tx_cur');
        const price = priceElem ? priceElem.innerText.trim() : '';
        
        const img = elem.querySelector('img');
        const imageUrl = img ? (img.getAttribute('data-original') || img.src) : '';
        
        const parentLi = elem.closest('li');
        let productId = '';
        if (parentLi) {
          const link = parentLi.querySelector('div.prd_name a');
          productId = link ? link.getAttribute('data-ref-goodsno') : '';
          
          if (!productId) {
            const href = link ? link.getAttribute('href') : '';
            if (href && href.includes('goodsNo=')) {
              productId = href.split('goodsNo=')[1].split('&')[0];
            }
          }
        }
        
        if (title) {
          items.push({ rank, title, brand, price, imageUrl, productId });
        }
      });
      
      return items;
    });
    
    console.log(`Successfully crawled ${rankings.length} items using Puppeteer.`);
    return rankings;
  } catch (error) {
    console.error('Error fetching rankings with Puppeteer:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function saveToDb(dateStr, rankings) {
  const client = await pool.connect();
  try {
    console.log(`Saving ${rankings.length} rankings to Vercel DB for ${dateStr}...`);
    for (const item of rankings) {
      await client.sql`
        INSERT INTO rankings (date_str, rank, title, brand, price, image_url, product_id)
        VALUES (${dateStr}, ${item.rank}, ${item.title}, ${item.brand}, ${item.price}, ${item.imageUrl}, ${item.productId})
        ON CONFLICT (date_str, rank) 
        DO UPDATE SET 
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          price = EXCLUDED.price,
          image_url = EXCLUDED.image_url,
          product_id = EXCLUDED.product_id;
      `;
    }
    console.log('Data saved successfully!');
  } catch (error) {
    console.error('Database save error:', error.message);
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is not set.');
    process.exit(1);
  }

  // Use KST for todayStr
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');
  console.log(`Target date: ${todayStr}`);

  const rankings = await fetchOliveYoungRankings();
  
  if (rankings.length > 0) {
    await saveToDb(todayStr, rankings);
  } else {
    console.error('No rankings found. DB update skipped.');
  }
  
  console.log('Puppeteer crawler script finished.');
  process.exit(0);
}

main();
