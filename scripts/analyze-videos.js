const { createPool } = require('@vercel/postgres');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Utility to fix unpaired surrogates which cause PostgreSQL JSONB errors
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
            .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function calculateScore(views, likes, comments) {
  const v = parseInt(views) || 0;
  const l = parseInt(likes) || 0;
  const c = parseInt(comments) || 0;
  
  let engagementScore = (l * 10) + (c * 50);
  let viewScore = v * 0.05;
  
  let raw = viewScore + engagementScore;
  let score = Math.min(Math.round(Math.log10(raw + 1) * 20), 100);
  
  return Math.max(score, 60); 
}

async function analyzeWithGemini(video) {
  // Use a modern lite model that works with the free tier in 2026
  const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
  
  const prompt = `
    다음은 숏폼 영상(TikTok, Instagram, YouTube Shorts)의 데이터입니다.
    이 영상을 분석하여 마케팅 인사이트와 전략을 도출해주세요.

    [영상 정보]
    - 제목: ${video.title}
    - 플랫폼: ${video.platform}
    - 카테고리: ${video.category}
    - 설명: ${video.description}
    - 댓글: ${JSON.stringify(video.comments?.slice(0, 10))}

    [요구사항]
    1. hook: 영상의 초반 3초 후킹 전략을 한 문장으로 설명하세요.
    2. commentInsight: 댓글 반응을 통해 파악된 소비자 심리를 한 문장으로 설명하세요.
    3. summary: 영상의 전반적인 특징을 요약하세요.
    4. tags: 영상의 속성을 나타내는 해시태그를 5개 내외로 리스트 형태로 추출하세요. (예: ["#고보습", "#민감성", "#잔향오래"])
    5. takeaways: 이 영상의 성공 요인을 3가지 리스트로 정리하세요.
    6. planning: 이 영상을 벤치마킹하여 '애경산업'의 관련 브랜드에게 줄 수 있는 구체적인 쇼츠 기획 제안을 마크다운 형식으로 작성하세요. 
       - 뷰티 카테고리라면 'AGE20'S', 'LUNA' 브랜드를 언급하세요.
       - 생활용품 카테고리라면 'LiQ', '랩신', '케라시스' 브랜드를 언급하세요.

    응답은 반드시 JSON 형식으로만 해주세요:
    {
      "hook": "...",
      "commentInsight": "...",
      "summary": "...",
      "tags": ["#태그1", "#태그2", ...],
      "takeaways": ["...", "...", "..."],
      "planning": "..."
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
}

async function analyze() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');
  const { rows } = await pool.query(`
    SELECT *, 
           view_count as "viewCount", 
           like_count as "likeCount", 
           comment_count as "commentCount" 
    FROM video_analyses 
    WHERE date_str = $1
  `, [today]);
  
  if (rows.length === 0) {
    console.log("No videos found to analyze today.");
    process.exit(0);
  }

  console.log(`Analyzing ${rows.length} short-form videos with Gemini AI...`);
  
  for (const row of rows) {
    const score = calculateScore(row.viewCount, row.likeCount, row.commentCount);
    const aiResult = await analyzeWithGemini(row);
    
    if (!aiResult) {
      console.log(`  ⚠️ Failed to analyze video: ${row.id}`);
      continue;
    }

    const analysis = {
      score,
      hook: sanitizeString(aiResult.hook),
      commentInsight: sanitizeString(aiResult.commentInsight),
      summary: sanitizeString(aiResult.summary),
      tags: aiResult.tags.map(t => sanitizeString(t)),
      takeaways: aiResult.takeaways.map(t => sanitizeString(t)),
      planning: sanitizeString(aiResult.planning)
    };

    await pool.query(
      'UPDATE video_analyses SET analysis_json = $1 WHERE id = $2',
      [JSON.stringify(analysis), row.id]
    );
    console.log(`  ✅ Analyzed: ${row.title.substring(0, 30)}...`);
  }
  
  console.log('Gemini-driven analysis complete.');
  process.exit(0);
}

analyze();
