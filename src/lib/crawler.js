import axios from 'axios';
import * as cheerio from 'cheerio';

export async function fetchOliveYoungRankings() {
  const url = "https://www.oliveyoung.co.kr/store/main/getBestList.do?t_page=%ED%99%88&t_click=GNB&t_gnb_type=%EB%9E%AD%ED%82%B9&t_swiping_type=N";
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.oliveyoung.co.kr/',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const $ = cheerio.load(data);
    const rankings = [];
    
    $('div.prd_info').each((idx, elem) => {
      const rank = idx + 1;
      const title = $(elem).find('p.tx_name').text().trim();
      const brand = $(elem).find('span.tx_brand, p.tx_brand').text().trim();
      const price = $(elem).find('span.tx_cur > span.tx_num, span.tx_cur').text().trim();
      
      // Handle images - might be in data-original or src
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
    
    return rankings;
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return [];
  }
}
