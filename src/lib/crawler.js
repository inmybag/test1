import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function fetchOliveYoungRankings() {
  const url = "https://www.oliveyoung.co.kr/store/main/getBestList.do?t_page=%ED%99%88&t_click=GNB&t_gnb_type=%EB%9E%AD%ED%82%B9&t_swiping_type=N";
  
  let browser = null;
  try {
    console.log('Starting Puppeteer crawl...');
    
    // Vercel 환경과 로컬 환경을 구분하여 실행 경로 설정
    const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
    
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // 실제 브라우저처럼 보이기 위해 User-Agent 설정
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    console.log('Navigating to Olive Young...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const content = await page.content();
    const $ = cheerio.load(content);
    const rankings = [];
    
    $('div.prd_info').each((idx, elem) => {
      const rank = idx + 1;
      const title = $(elem).find('p.tx_name').text().trim();
      const brand = $(elem).find('span.tx_brand, p.tx_brand').text().trim();
      const price = $(elem).find('span.tx_cur > span.tx_num, span.tx_cur').text().trim();
      
      const img = $(elem).find('img');
      const imageUrl = img.attr('data-original') || img.attr('src') || '';
      
      if (title && title !== 'Unknown') {
        rankings.push({
          rank,
          title,
          brand,
          price,
          imageUrl
        });
      }
    });
    
    console.log(`Successfully crawled ${rankings.length} items.`);
    return rankings;

  } catch (error) {
    console.error('Puppeteer crawling error:', error);
    return [];
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}
