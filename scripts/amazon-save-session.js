/**
 * Amazon 세션 저장 스크립트 (최초 1회 실행)
 * 브라우저 창이 열리면 직접 로그인 후 Enter 키를 누르세요.
 * 세션 쿠키가 scripts/amazon-cookies.json에 저장됩니다.
 *
 * 사용법: node scripts/amazon-save-session.js
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const readline = require('readline');

puppeteerExtra.use(StealthPlugin());

const COOKIE_PATH = `${__dirname}/amazon-cookies.json`;

(async () => {
  console.log('[Amazon 세션 저장] 브라우저를 엽니다...');
  console.log('[Amazon 세션 저장] Amazon에 직접 로그인하세요. 완료 후 이 터미널에서 Enter를 누르세요.\n');

  const browser = await puppeteerExtra.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US'],
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.goto('https://www.amazon.com/gp/sign-in.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // 사용자가 Enter 누를 때까지 대기
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n[중요] 로그인 후 아마존 메인 페이지(www.amazon.com) 또는 상품 페이지로 이동하여 화면이 정상적으로 출력되는지 확인하세요.');
  await new Promise(resolve => rl.question('준비가 완료되면 Enter를 누르세요: ', resolve));
  rl.close();

  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  console.log(`\n[Amazon 세션 저장] 쿠키 저장 완료: ${COOKIE_PATH} (${cookies.length}개)`);
  console.log('저장된 쿠키 목록:', cookies.map(c => c.name).join(', '));

  await browser.close();
  console.log('\n[Amazon 세션 저장] 완료. 이제 크롤러를 다시 실행하세요.');
})().catch(e => { console.error('오류:', e); process.exit(1); });
