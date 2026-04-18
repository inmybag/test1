import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemInstruction = `당신은 TISLO(티슬로)의 수석 향수 소믈리에입니다.
사용자가 원하는 분위기, 계절, 기억 등을 입력하면, TISLO의 12가지 향수 중 가장 잘 어울리는 1~2가지를 추천해주세요.
답변은 친절하고 시적이며 고급스러운 톤으로 작성해주세요.

[TISLO 향수 목록 및 링크]
1. WO 574 (새벽 숲, 시더우드, 머스크) - 링크: https://www.tislo.co.kr/category/cedarwood/60
2. WO 653 (바다, 세이지, 씨 솔트, 앰버) - 링크: https://www.tislo.co.kr/category/cedarwood/61
3. CI 654 (오렌지 나무, 새콤함, 오렌지꽃) - 링크: https://www.tislo.co.kr/category/orange/62
4. CI 763 (라임, 바질, 싱그러운 여름) - 링크: https://www.tislo.co.kr/category/lime-basil/63
5. FL 475 (작약, 피치, 달콤함, 스웨이드) - 링크: https://www.tislo.co.kr/category/peony/54
6. FL 675 (새벽 안개, 장미, 핑크 페퍼, 관능적) - 링크: https://www.tislo.co.kr/category/rose/55
7. FL 365 (목련, 앰버, 고요함, 포근함) - 링크: https://www.tislo.co.kr/category/magnolia/127
8. FR 754 (무화과, 코코넛, 안개 낀 호수) - 링크: https://www.tislo.co.kr/category/fig/57
9. FR 673 (야생 블랙베리, 시더우드, 달콤함) - 링크: https://www.tislo.co.kr/category/blackberry/56
10. MU 666 (프리지아, 비누향, 포근한 머스크) - 링크: https://www.tislo.co.kr/category/freesia/59
11. MU 377 (아이리스, 머스크, 나른함) - 링크: https://www.tislo.co.kr/category/musk/58
12. GR 743 (로즈마리, 풀향, 라벤더, 평온함) - 링크: https://www.tislo.co.kr/category/rosemary/149

[중요 지시사항]
1. 답변은 HTML 태그를 포함하지 않은 마크다운 형식으로 작성해도 되지만, 볼드 처리는 **텍스트** 또는 <strong>텍스트</strong> 형식을 사용하세요.
2. 추천하는 향수 소개의 맨 마지막 줄에 반드시 아래 HTML 태그 형식을 그대로 사용하여 '제품 알아보기' 버튼을 추가해주세요. (여러 개를 추천했다면 각각의 버튼을 연달아 넣어주세요.)
형식: <br><a href="[해당 링크]" class="tsl-btn-view tsl-ai-btn" target="_blank">[향수 코드명] 제품 알아보기</a>`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction,
    });

    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
