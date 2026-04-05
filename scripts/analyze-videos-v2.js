const { createPool } = require('@vercel/postgres');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const AEKYUNG_BRANDS = {
  "Beauty": [
    { name: "Age 20's", usp: "70% 에센스 함유 팩트, 독보적 광채/수분력, '에센스 팩트'의 원조" },
    { name: "Luna", usp: "베이스 메이크업 전문성, 정교한 커버력/밀착력, '컨실러' 명가" },
    { name: "Siqnic", usp: "감성적 무드의 프리미엄 스킨케어, 피부 본연의 건강함" },
    { name: "One Thing", usp: "단일 추출물 기반의 미니멀리즘 스킨케어, 성분 본연의 효능" }
  ],
  "Household": [
    { name: "LiQ", usp: "초고농축 세탁 전문성, 강력한 얼룩 제거, 스마트한 세탁 솔루션" },
    { name: "Labccin", usp: "살균 전문가가 만든 위생 솔루션 (살균/청소), 99.9% 항균력" },
    { name: "Kerasys", usp: "프로페셔널 헤어 클리닉의 부드러움, 향기 레이어링" },
    { name: "Luvcent", usp: "향수처럼 고급스러운 잔향이 오래 지속되는 바디 케어" }
  ]
};

async function analyzeWithGemini(videoData) {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const brands = AEKYUNG_BRANDS[videoData.category] || AEKYUNG_BRANDS["Beauty"];
  const brandContext = brands.map(b => `[${b.name}: ${b.usp}]`).join(', ');

  const prompt = `
당신은 대한민국 최고의 숏폼 콘텐츠 전략가이자 마케팅 전문가입니다. 
다음 경쟁사 쇼츠(Short-form) 영상 데이터를 분석하여, 애경산업의 브랜드팀이 즉시 제작에 참고할 수 있는 고품질의 리포트를 작성해주세요.

### 분석 대상 영상 데이터
- 제목: ${videoData.title}
- 설명: ${videoData.description || '없음'}
- 카테고리: ${videoData.category}
- 통계: 조회수 ${videoData.viewCount}, 좋아요 ${videoData.likeCount}, 댓글 ${videoData.commentCount}
- 주요 댓글 반응:
${videoData.comments.map(c => `- ${c.text} (좋아요: ${c.like_count})`).join('\n')}

### 요청 사항
1. **[SUCCESS_SCORE]**: 0~100 사이의 숫자로 이 영상의 벤치마킹 가치를 평가하세요. (조회수 대비 인게이지먼트 고려)
2. **[COMPETITOR_SUCCESS_HACK]**: 단순히 '3초 훅'이라고 하지 말고, 이 영상만이 가진 독창적인 성공 공식(심리적 트리거, 연출 기법, 구도 등)을 한 문장으로 정의하세요.
3. **[HOOK_ANALYSIS]**: 초반 시선을 끄는 정확한 후킹 멘트나 연출 포인트를 분석하세요.
4. **[USER_REACTIONS]**: 댓글을 정밀 분석하여 유저들의 '정서적 공감 포인트'와 '반복되는 질문/요구'를 구체적으로 한 문장으로 정리하세요.
5. **[PERFORMANCE_TAKEAWAYS]**: 제작/편집 관점에서 배워야 할 점 3가지를 구체적인 문장으로 작성하세요. (조명, 오디오, 컷 편집 주동선 등)
6. **[AEKYUNG_STRATEGY]**: 
   - 대상 브랜드: ${brandContext}
   - 위 브랜드들 중 가장 적합한 브랜드 2~3개를 골라 각각에 맞는 **전문적인 영상 콘티(Storyboard)**를 제안하세요.
   - 콘티는 다음 형식을 포함해야 하며, 마크다운 표(Table)로 작성하세요:
     | 장면 | 화면 연출 (Visual) | 오디오/나레이션 (Audio) | 텍스트/카피 (Text) | 시간 |
     | :--- | :--- | :--- | :--- | :--- |

### 출력 형식 (JSON)
반드시 다음 구조의 JSON 형식으로만 응답하세요:
{
  "score": 숫자,
  "successHack": "내용",
  "hook": "내용",
  "commentInsight": "내용",
  "takeaways": ["1번내용", "2번내용", "3번내용"],
  "planning": "브랜드별 전략 및 마크다운 콘티를 포함한 전체 내용 (마법같은 줄바꿈 포함)"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Clean JSON string
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error(`Gemini Analysis Error for ${videoData.id}:`, error);
    return null;
  }
}

async function run() {
  console.log('🚀 Starting Gemini-based Deep Video Analysis...');
  
  // Fetch videos from today or yesterday to re-analyze
  const { rows } = await pool.query(`
    SELECT *, 
           view_count as "viewCount", 
           like_count as "likeCount", 
           comment_count as "commentCount" 
    FROM video_analyses 
    ORDER BY created_at DESC 
    LIMIT 20
  `);

  if (rows.length === 0) {
    console.log('No videos found to analyze.');
    process.exit(0);
  }

  for (const row of rows) {
    console.log(`\n--- Analyzing: ${row.title.substring(0, 30)}... ---`);
    const analysis = await analyzeWithGemini(row);
    
    if (analysis) {
      // Reformat planning to include the success insights more professionally
      const enrichedPlanning = `
## 🎯 경쟁사 벤치마킹 포인트
- **독보적 성공 요인**: ${analysis.successHack}
- **소비자 반응 인사이트**: ${analysis.commentInsight}

${analysis.planning}
      `.trim();

      const finalAnalysisJson = {
        score: analysis.score,
        hook: analysis.hook,
        commentInsight: analysis.commentInsight,
        summary: `${analysis.successHack} 영상에서 유저들은 ${analysis.commentInsight}에 강한 반응을 보였습니다.`,
        takeaways: analysis.takeaways,
        planning: enrichedPlanning
      };

      await pool.query(
        'UPDATE video_analyses SET analysis_json = $1 WHERE id = $2',
        [JSON.stringify(finalAnalysisJson), row.id]
      );
      console.log('✅ Analysis updated with Gemini insights.');
    }
    
    // Rate limit friendly delay
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✨ Deep Video Analysis Complete.');
  process.exit(0);
}

run();
