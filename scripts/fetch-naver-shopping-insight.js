const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createPool } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });

puppeteer.use(StealthPlugin());

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchShoppingInsight() {
    console.log('🚀 네이버 쇼핑 인사이트 인기검색어(TOP 500) 수집 시작...');
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        const url = 'https://datalab.naver.com/shoppingInsight/sCategory.naver';
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await delay(3000);

        console.log('📌 카테고리 선택 중: 화장품/미용...');
        
        // 1. 대분류 드롭다운 클릭
        await page.click('.select_btn');
        await delay(1000);
        
        // 2. '화장품/미용' 선택 (텍스트 기반 선택이 안정적)
        await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.select_list .option'));
            const target = items.find(el => el.textContent.trim() === '화장품/미용');
            if (target) target.click();
        });
        await delay(1000);

        // 3. '조회하기' 버튼 클릭
        await page.click('.btn_submit');
        await delay(3000);

        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');
        const allKeywords = [];

        // 4. 페이지네이션 (1~25페이지, 총 500위)
        console.log('📌 인기검색어 1~500위 수집 중 (25페이지 순회)...');
        
        for (let p = 1; p <= 25; p++) {
            // 데이터 로딩 대기
            await page.waitForSelector('ul.rank_top1000_list li', { timeout: 10000 });
            await delay(500);

            const pageKeywords = await page.evaluate(() => {
                const items = document.querySelectorAll('ul.rank_top1000_list li');
                return Array.from(items).map(el => {
                    const rankText = el.querySelector('span')?.innerText || '';
                    const keywordText = el.querySelector('a.link_text')?.innerText.trim() || '';
                    
                    // 키워드에서 순위 번호나 개행 문자 등 불필요한 부분 제거
                    // 예: "332\n꾸띄르염색샴푸" -> "꾸띄르염색샴푸"
                    const cleanedKeyword = keywordText.replace(/^[0-9\s\n]+/, '').trim();

                    return {
                        rank: parseInt(rankText.replace(/[^0-9]/g, '')),
                        keyword: cleanedKeyword || keywordText // 정제 실패 시 원본 사용
                    };
                }).filter(item => item.keyword);
            });

            allKeywords.push(...pageKeywords);
            process.stdout.write(`\r  > ${p}/25 페이지 수집 완료 (현재 총 ${allKeywords.length}개)`);

            if (p < 25) {
                // 다음 페이지 버튼 클릭
                const nextBtn = await page.$('.btn_page_next');
                if (nextBtn) {
                    await nextBtn.click();
                    await delay(1000); // 페이지 전환 대기
                } else {
                    console.log(`\n⚠️ ${p}페이지에서 다음 버튼을 찾을 수 없습니다.`);
                    break;
                }
            }
        }

        console.log('\n\n📊 수집 완료! DB 저장 중...');

        // 5. DB 저장 (기존 데이터 삭제 후 일괄 삽입)
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // 당일 데이터 초기화 (재수집 시 중복 방지)
            await client.query('DELETE FROM shopping_insight_keywords WHERE date_str = $1', [todayStr]);
            
            for (const item of allKeywords) {
                await client.query(
                    'INSERT INTO shopping_insight_keywords (keyword, rank, date_str) VALUES ($1, $2, $3)',
                    [item.keyword, item.rank, todayStr]
                );
            }
            await client.query('COMMIT');
            console.log(`✅ 성공: ${allKeywords.length}개의 키워드가 ${todayStr} 날짜로 저장되었습니다.`);
        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error(`❌ 수집 실패: ${error.message}`);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

fetchShoppingInsight();
