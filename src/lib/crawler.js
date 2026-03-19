import * as cheerio from 'cheerio';

export async function fetchOliveYoungRankings() {
  // Vercel 서버에서는 403 차단이 발생하므로 크롤링하지 않음
  console.warn('Skipping server-side crawl on Vercel to avoid 403 Forbidden.');
  return [];
}
