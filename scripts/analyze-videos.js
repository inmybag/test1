const { createPool } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

const TARGET_BRANDS = [
  "Age 20's", "Luna", "Siqnic", "One Thing", 
  "Kerasys", "Luvcent", "Shower Mate", "TISSlo",
  "Medicube", "Anua", "Dr.Melaxin", "Dr.Althea", 
  "Sungboon Editor", "Beauty of Joseon", "Biodance", 
  "Skin1004", "Numbuzin"
];

// Utility to fix unpaired surrogates which cause PostgreSQL JSONB errors
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  // Remove high surrogates not followed by low surrogates, 
  // and low surrogates not preceded by high surrogates.
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
            .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function calculateScore(views, likes, comments) {
  const v = parseInt(views) || 0;
  const l = parseInt(likes) || 0;
  const c = parseInt(comments) || 0;
  
  // Engagement-weighted scoring
  // More weight on likes and comments as they represent active interest
  let engagementScore = (l * 10) + (c * 50);
  let viewScore = v * 0.05;
  
  let raw = viewScore + engagementScore;
  let score = Math.min(Math.round(Math.log10(raw + 1) * 20), 100);
  
  return Math.max(score, 60); // Minimum 60 for trending videos
}

function analyzeMetatdata(title, description, category) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  
  let hook = "";
  let type = "일반";
  let keywords = [];
  
  if (text.includes("꿀팁") || text.includes("tips") || text.includes("루틴") || text.includes("routine")) {
    hook = `시청자가 즉시 따라 할 수 있는 '${category}' 정보성 팁으로 초반 이탈 방지`;
    type = "교육/정보";
    keywords = ["꿀팁", "루틴", "교육"];
  } else if (text.includes("aesthetic") || text.includes("감성") || text.includes("vlog") || text.includes("morning")) {
    hook = `시각적 완성도와 감성적인 무드를 활용하여 '${category}' 브랜드의 가치 전달`;
    type = "감성/브랜딩";
    keywords = ["감성", "브랜딩", "무드"];
  } else if (text.includes("asmr") || text.includes("소리") || text.includes("texture") || text.includes("제형")) {
    hook = `제품의 제형과 사용 소리를 극대화하여 '${category}' 제품의 촉각적 만족도 자극`;
    type = "ASMR/제형";
    keywords = ["ASMR", "제형", "청각"];
  } else if (text.includes("리뷰") || text.includes("review") || text.includes("추천") || text.includes("recommend")) {
    hook = `실제 사용자의 솔직한 후기와 '전/후' 비교를 통해 '${category}' 신뢰도 확보`;
    type = "리뷰/검증";
    keywords = ["리뷰", "검증", "신뢰"];
  } else {
    hook = `'${category}' 카테고리의 트렌디한 사운드와 빠른 컷 편집으로 시청 지속시간 확보`;
    type = "트렌드/바이럴";
    keywords = ["트렌드", "바이럴", "속도"];
  }

  return { hook, type, keywords };
}

function generatePlanning(title, type, category, keywords) {
  const brandUSPs = {
    "Age 20's": "독보적인 수분 에센스 함유량과 광채 피부 표현",
    "Luna": "결점을 완벽하게 커버하는 고밀착 베이스 전문성",
    "Siqnic": "고급스러운 향과 패키징이 주는 프리미엄 케어 경험",
    "One Thing": "불필요한 성분을 배제한 단일 추출물의 순수한 효능",
    "Kerasys": "전문 살롱의 클리닉 효과를 집에서 누리는 모발 케어",
    "Luvcent": "오래 지속되는 향기와 피부에 남는 감각적인 잔향",
    "Shower Mate": "온 가족이 안심하고 즐기는 일상 속의 향기로운 샤워",
    "TISSlo": "메이크업 아티스트의 노하우가 담긴 직관적인 컬러 가이드",
    "Medicube": "클리니컬한 모공 케어와 전문적인 디바이스 병행 효과",
    "Anua": "민감 피부를 진정시키는 어성초 성분의 뛰어난 진정력",
    "Dr.Melaxin": "특화된 성분으로 집중적인 미백 및 잡티 케어",
    "Dr.Althea": "건강하고 자연스러운 피부 광채를 선사하는 스킨케어",
    "Sungboon Editor": "성분을 먼저 생각하는 합리적이고 효능 중심의 케어",
    "Beauty of Joseon": "전통 한방 성분을 현대적으로 재해석한 맑은 피부 케어",
    "Biodance": "자는 동안 피부를 재생시키는 콜라겐 마스크의 효과",
    "Skin1004": "마다가스카르 센텔라의 순수한 진정 에너지",
    "Numbuzin": "피부 타입별 고민을 숫자로 매칭하는 맞춤형 처방"
  };

  const getRecommendation = (brand) => {
    const usp = brandUSPs[brand] || "브랜드 고유의 효능 강조";
    if (type === "ASMR/제형") return `${brand}의 [${usp}]를 극대화하기 위해 '${title}'의 근접 크롭 및 사운드 효과를 차용한 제형 강조형 쇼츠 기획.`;
    if (type === "교육/정보") return `${brand}의 [${usp}]를 활용한 '3분 완성 루틴' 등 '${title}'의 정보 전달 방식을 결합한 교육 콘텐츠.`;
    if (type === "리뷰/검증") return `${brand} 제품의 실제 사용 전후(Before/After)를 '${title}'의 비교 포맷으로 구성하여 실효성 증명.`;
    return `${brand}의 [${usp}]를 '${title}'의 트렌디한 편집 문법과 사운드에 녹여낸 감각적인 홍보 영상.`;
  };

  const keys = Object.keys(brandUSPs);
  // Get 3 random/specific brands to recommend for variety
  const startIdx = Math.abs(title.length % (keys.length - 3));
  return keys.slice(startIdx, startIdx + 3).map(k => `**${k}**: ${getRecommendation(k)}`).join('\n\n');
}

function analyzeComments(comments) {
  if (!comments || comments.length === 0) return { insights: "댓글 분석 중...", keywords: [] };
  
  const text = comments.map(c => c.text).join(' ').toLowerCase();
  const reactions = [];
  const keywords = [];

  const checkReaction = (matches, insight, kw) => {
    if (matches.some(m => text.includes(m))) {
      reactions.push(insight);
      keywords.push(kw);
    }
  };

  checkReaction(['구매', '사고싶', '얼마', '정보'], "제품 구매 의사가 있는 유망 고객층의 높은 관심", "구매전환");
  checkReaction(['제형', '발림', '촉촉', '광채'], "특유의 제형감과 피부 표현력에 대한 긍정적 반응", "제형/표현");
  checkReaction(['커버', '잡티', '지속'], "강력한 커버력과 오랜 시간을 견디는 지속력에 대한 검증", "커버/지속");
  checkReaction(['노래', '브금', 'bgm', '편집'], "트렌디한 사운드와 리드미컬한 편집 방식에 대한 높은 선호", "크리에이티브");
  checkReaction(['비교', '차이', '진짜'], "허위 광고가 아닌 실제 효과에 대한 신뢰 및 비교 분석 열광", "진정성");

  return {
    insights: reactions.length > 0 ? reactions.slice(0, 2).join(", ") : "전반적으로 긍정적인 반응과 제품 호기심이 관찰됨",
    keywords: keywords
  };
}

function generateAekyungStrategy(hook, commentKeywords, category, videoTitle) {
  // 애경산업 브랜드 자산 (기획안 생성용)
  const aekyungBrands = {
    "Beauty": [
      { name: "Age 20's", usp: "70% 에센스 함유 팩트, 독보적 광채/수분력" },
      { name: "Luna", "usp": "베이스 메이크업 전문성, 정교한 커버력/밀착력" },
      { name: "Siqnic", "usp": "감성적 무드의 프리미엄 스킨케어" }
    ],
    "Household": [
      { name: "LiQ", usp: "초고농축 세탁 전문성, 강력한 얼룩 제거" },
      { name: "Spark", usp: "오랫동안 사랑받은 세탁 세제 본연의 세척력" },
      { name: "Labccin", usp: "살균 전문가가 만든 위생 솔루션 (살균/청소)" },
      { name: "Kerasys", usp: "프로페셔널 헤어 클리닉의 부드러움" }
    ]
  };

  const relevantBrands = aekyungBrands[category] || [];
  const topKeyword = commentKeywords.length > 0 ? commentKeywords[0] : "트렌드";

  return `
## 🎯 경쟁사 벤치마킹 포인트
- **성공 요인**: 본 영상은 '${hook}' 형태의 훅과 '${videoTitle}' 주제를 통해 유저들의 '${topKeyword}' 반응을 이끌어냈습니다.
- **인사이트**: 유저들은 단순 광고보다 실제 사용 시연이나 정보성 팁(Hack)에 더 큰 매력을 느끼고 있습니다.

## 💡 애경산업 브랜드별 기획 제안
${relevantBrands.map(brand => `
### **[${brand.name}] 전략 제안**
- **기획 방향**: 경쟁사의 '${hook}' 연출 방식을 차용하되, ${brand.name}만의 **'${brand.usp}'**를 강조하는 구도로 재구성.
- **추천 소재**: 본 영상의 성공 공식인 '${topKeyword}' 소구점을 활용하여, ${brand.name} 제품의 비포/애프터나 실사용 꿀팁 영상 제작.
`).join('\n')}
  `.trim();
}

async function analyze() {
  const today = new Date().toLocaleDateString('en-CA').replace(/-/g, '');
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

  console.log(`Analyzing ${rows.length} short-form videos with comment-driven engine...`);
  
  for (const row of rows) {
    const score = calculateScore(row.viewCount, row.likeCount, row.commentCount);
    const { hook, type, keywords: metaKeywords } = analyzeMetatdata(row.title, row.description, row.category);
    const { insights: commentInsights, keywords: commentKeywords } = analyzeComments(row.comments);
    // 인자 순서 수정: (hook, commentKeywords, category, videoTitle)
    const aekyungStrategy = generateAekyungStrategy(hook, commentKeywords, row.category, row.title);
    
    const shortTitle = sanitizeString(row.title.length > 20 ? row.title.substring(0, 20) + '...' : row.title);
    const analysis = {
      score,
      hook: sanitizeString(hook),
      commentInsight: sanitizeString(commentInsights),
      summary: sanitizeString(`[${type}] 포맷이 돋보이는 영상입니다. '${shortTitle}' 콘텐츠에서 유저들은 ${commentInsights}에 뜨거운 반응을 보이고 있습니다.`),
      takeaways: [
        sanitizeString(`'${shortTitle}' 영상의 초반 3초 후킹 전략: ${hook.substring(0, 40)}`),
        sanitizeString(`${row.platform.toUpperCase()} 알고리즘이 선택한 '${type}' 포맷의 핵심 성공 요인`),
        sanitizeString(`댓글 반응 키워드${commentKeywords.length > 0 ? ' [' + commentKeywords.slice(0, 2).join(', ') + ']' : ''}에서 발견된 소비자 심리 인사이트`)
      ],
      planning: sanitizeString(aekyungStrategy)
    };

    await pool.query(
      'UPDATE video_analyses SET analysis_json = $1 WHERE id = $2',
      [JSON.stringify(analysis), row.id]
    );
  }
  
  console.log('Advanced comment-driven analysis complete.');
  process.exit(0);
}

analyze();
