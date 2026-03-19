import axios from 'axios';
import * as cheerio from 'cheerio';

export async function fetchOliveYoungRankings() {
  const url = "https://www.oliveyoung.co.kr/store/main/getBestList.do?t_page=%ED%99%88&t_click=GNB&t_gnb_type=%EB%9E%AD%ED%82%B9&t_swiping_type=N";
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
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
