const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });

async function sendSlackSummary() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL is not set.');
    process.exit(1);
  }

  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const day = kstDate.getDay();
  const yyyymmdd = kstDate.toISOString().split('T')[0];

  // 2026년 기준 한국 법정 공휴일
  const holidays2026 = [
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', // 신정, 설날
    '2026-03-01', '2026-05-05', '2026-05-24', '2026-06-06', // 삼일절, 어린이날, 부처님오신날, 현충일
    '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26', // 광복절, 추석
    '2026-10-03', '2026-10-09', '2026-12-25'              // 개천절, 한글날, 크리스마스
  ];

  if (day === 0 || day === 6 || holidays2026.includes(yyyymmdd)) {
    console.log(`휴일/주말(${yyyymmdd})이므로 슬랙 알림을 발송하지 않습니다.`);
    process.exit(0);
  }

  try {
    const todayKst = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    
    // 1. 수집된 리뷰 수 (오늘 기준)
    const reviewRes = await sql`SELECT count(*) as count FROM product_reviews WHERE created_at >= CURRENT_DATE`;
    const newReviews = reviewRes.rows[0].count;

    // 2. 수집된 숏폼 수 (오늘 기준)
    const videoRes = await sql`SELECT count(*) as count FROM video_analyses WHERE created_at >= CURRENT_DATE`;
    const newVideos = videoRes.rows[0].count;

    // 3. 분석 완료된 리뷰 (AI 분석 감성이 NULL이 아닌 것)
    const analyzedReviewRes = await sql`SELECT count(*) as count FROM product_reviews WHERE created_at >= CURRENT_DATE AND sentiment IS NOT NULL AND sentiment != ''`;
    const analyzedReviews = analyzedReviewRes.rows[0].count;

    // 4. 긍/부정 감성 분포
    const sentimentRes = await sql`SELECT sentiment, count(*) as count FROM product_reviews WHERE created_at >= CURRENT_DATE AND sentiment IS NOT NULL AND sentiment != '' GROUP BY sentiment`;
    let posCount = 0, negCount = 0, neuCount = 0;
    sentimentRes.rows.forEach(row => {
      if (row.sentiment === 'positive') posCount = parseInt(row.count);
      else if (row.sentiment === 'negative') negCount = parseInt(row.count);
      else if (row.sentiment === 'neutral') neuCount = parseInt(row.count);
    });
    const totalSentiment = posCount + negCount + neuCount;
    const posRate = totalSentiment > 0 ? Math.round((posCount / totalSentiment) * 100) : 0;

    // 5. 오늘 수집된 최고 조회수 영상
    const topVideoRes = await sql`SELECT title, platform, view_count FROM video_analyses WHERE created_at >= CURRENT_DATE ORDER BY view_count DESC LIMIT 1`;
    const topVideo = topVideoRes.rows[0];
    const topVideoText = topVideo 
      ? `[${topVideo.platform}] ${topVideo.title.substring(0, 35)}... (${parseInt(topVideo.view_count).toLocaleString()}회)`
      : '오늘 수집된 영상 없음';

    // 6. 제품별 수집된 리뷰 건수
    const productReviewRes = await sql`
      SELECT rp.product_name, count(pr.id) as count 
      FROM product_reviews pr 
      JOIN review_products rp ON pr.product_id = rp.id 
      WHERE pr.created_at >= CURRENT_DATE 
      GROUP BY rp.product_name 
      ORDER BY count DESC
    `;
    const productReviewText = productReviewRes.rows.map(row => `• ${row.product_name}: ${row.count}건`).join('\n') || '오늘 수집된 리뷰 없음';

    // 7. 네이버 쇼핑 급상승 키워드 (전주대비 50계단 이상)
    const naverRes = await sql`
      SELECT t1.keyword, t1.category, t1.rank as current_rank, t2.rank as previous_rank, (t2.rank - t1.rank) as rank_diff 
      FROM shopping_insight_keywords t1 
      JOIN shopping_insight_keywords t2 
        ON t1.keyword = t2.keyword AND t1.category = t2.category 
        AND t2.date_str = to_char(CURRENT_DATE - interval '7 days', 'YYYYMMDD') 
      WHERE t1.date_str = to_char(CURRENT_DATE, 'YYYYMMDD') 
        AND (t2.rank - t1.rank) >= 50 
      ORDER BY rank_diff DESC 
      LIMIT 5
    `;
    const naverKeywordsText = naverRes.rows.map(row => `• ${row.keyword} (+${row.rank_diff}계단, 현재 ${row.current_rank}위)`).join('\n') || '급상승 키워드 없음';

    // 8. 올리브영 신규 차트인 랭킹 (전일대비)
    const oliveRes = await sql`
      SELECT r1.brand, r1.title, r1.rank 
      FROM rankings r1 
      WHERE r1.date_str = to_char(CURRENT_DATE, 'YYYYMMDD') 
        AND NOT EXISTS ( 
          SELECT 1 FROM rankings r2 
          WHERE r2.date_str = to_char(CURRENT_DATE - interval '1 day', 'YYYYMMDD') 
            AND r2.product_id = r1.product_id 
        ) 
      ORDER BY r1.rank ASC 
      LIMIT 5
    `;
    const oliveRankingText = oliveRes.rows.map(row => `• [${row.brand}] ${row.title.substring(0, 25)}... (현재 ${row.rank}위)`).join('\n') || '신규 진입 없음';

    const payload = {
      text: `📊 *일일 배치 분석 작업 완료 알림* (${todayKst})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "✅ 일일 데이터 수집 및 AI 분석 완료",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `안녕하세요! 방금 전체 데이터 수집 및 분석 배치가 성공적으로 완료되었습니다.\n\n*📌 오늘의 수집/분석 요약*`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*🛍️ 신규 수집된 리뷰:*\n${newReviews}건`
            },
            {
              type: "mrkdwn",
              text: `*🤖 AI 감성분석 완료:*\n${analyzedReviews}건`
            },
            {
              type: "mrkdwn",
              text: `*📱 신규 수집된 숏폼 영상:*\n${newVideos}건`
            },
            {
              type: "mrkdwn",
              text: `*🔥 플랫폼 트렌드 분석:*\n정상 완료`
            }
          ]
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📈 주요 데이터 성과 분석*\n• *신규 수집 리뷰 긍정률:* ${posRate}% (분석된 ${totalSentiment}건 중 ${posCount}건 긍정)\n• *오늘의 최고 조회수 숏폼:*\n> ${topVideoText}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📊 제품별 수집된 리뷰 건수*\n${productReviewText}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🚀 네이버 쇼핑 급상승 키워드 (전주대비 50계단+)*\n${naverKeywordsText}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*👑 올리브영 신규 차트인 랭킹 (전일대비)*\n${oliveRankingText}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 <https://test1-lime-sigma.vercel.app/review-analysis|대시보드 바로가기> 버튼을 클릭하여 더 자세한 AI 인사이트와 마케팅 리포트를 확인하실 수 있습니다."
            }
          ]
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ 슬랙 알림 전송 성공');
    } else {
      console.error('❌ 슬랙 알림 전송 실패:', await response.text());
    }
  } catch (error) {
    console.error('슬랙 알림 오류:', error);
  } finally {
    process.exit(0);
  }
}

sendSlackSummary();
