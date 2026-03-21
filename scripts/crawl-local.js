// 로컬 실행 전용 크롤러 (내 컴퓨터에서 실행)
// 실행 전: export POSTGRES_URL='복사한 URL' 설정 필요

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // fallback to .env
const axios = require('axios');
const cheerio = require('cheerio');
const { createPool } = require('@vercel/postgres');

// Vercel Postgres 연결 설정
const pool = createPool({
  connectionString: process.env.POSTGRES_URL
});

async function fetchOliveYoungRankings() {
  const url = "https://www.oliveyoung.co.kr/store/main/getBestList.do?t_page=%ED%99%88&t_click=GNB&t_gnb_type=%EB%9E%AD%ED%82%B9&t_swiping_type=N";
  
  try {
    console.log('Fetching Olive Young rankings...');
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.google.com/',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const $ = cheerio.load(data);
    const rankings = [];
    
    $('div.prd_info').each((idx, elem) => {
      const rank = idx + 1;
      const titleElem = $(elem).find('p.tx_name');
      const title = titleElem.text().trim();
      const brand = $(elem).find('span.tx_brand, p.tx_brand').text().trim();
      const price = $(elem).find('span.tx_cur > span.tx_num, span.tx_cur').text().trim();
      
      const img = $(elem).find('img');
      const imageUrl = img.attr('data-original') || img.attr('src') || '';
      
      // Extract goodsNo from the link attribute 'data-ref-goodsno' or from parent <a>
      const parentLi = $(elem).closest('li');
      let productId = parentLi.find('div.prd_name a').attr('data-ref-goodsno') || 
                      $(elem).find('a').attr('data-ref-goodsno');

      // If not found in data attribute, try to find it in the URL if it's a direct link
      if (!productId) {
        const href = parentLi.find('div.prd_name a').attr('href') || $(elem).find('a').attr('href');
        if (href && href.includes('goodsNo=')) {
          productId = href.split('goodsNo=')[1].split('&')[0];
        }
      }
      
      if (title) {
        rankings.push({ rank, title, brand, price, imageUrl, productId });
      }
    });
    
    console.log(`Successfully crawled ${rankings.length} items.`);
    return rankings;
  } catch (error) {
    console.error('Error fetching rankings:', error.message);
    return [];
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

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rankings = await fetchOliveYoungRankings();
  
  if (rankings.length > 0) {
    await saveToDb(todayStr, rankings);
  }
  
  console.log('Crawler script finished.');
  process.exit(0);
}

main();
