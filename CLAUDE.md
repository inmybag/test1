# AI Marketing Automation Platform - Project Context & Guidelines

## 1. Project Overview (프로젝트 개요)
본 프로젝트는 글로벌 뷰티/FMCG 마케팅 조직을 위한 'AI 마케팅 자동화 플랫폼'입니다. 단순한 대시보드를 넘어, 데이터 수집(ETL) ➔ AI 기반 분석/예측 ➔ 마케팅 액션(광고 입찰, CRM 발송, 소재 재생산)을 자동으로 실행하는 에이전틱(Agentic) 워크플로우를 구축하는 것이 목표입니다.

## 2. Core Domain Knowledge (마케팅 핵심 도메인 지식)
코드를 작성하거나 DB 모델을 설계할 때 다음 마케팅 개념을 반드시 내재화하여 반영할 것:
* **Performance Marketing:** ROAS(광고수익률), CAC(고객획득비용), CPC, CTR 데이터 파이프라인. Meta Ads, Google Ads, Amazon PPC API 연동.
* **Retention & CRM:** LTV(고객생애가치), 장바구니 이탈(Abandoned Cart) 로직. Klaviyo, LINE Messaging API 연동.
* **Seeding & UGC:** 나노/마이크로 인플루언서 성과 트래킹, 해시태그 크롤링, 리뷰 분석(Sentiment Analysis).
* **Content & A/B Testing:** 소재(Asset) 베리에이션 자동화, 초반 3초 Hook 이탈률 분석.

## 3. System Architecture & Tech Stack (아키텍처 및 스택)
* **Backend:** Python 3.11+, FastAPI (비동기 처리 필수), SQLAlchemy (ORM), Celery/Redis (광고 API 및 이메일 발송 등 대규모 백그라운드 태스크).
* **Frontend:** React 18+, TypeScript, TailwindCSS, Zustand.
* **AI/LLM:** LangChain 또는 LlamaIndex, Anthropic Claude 3 API / OpenAI API.
* **Database:** PostgreSQL (시계열 마케팅 데이터 처리), Pinecone/Weaviate (콘텐츠/카피라이팅 벡터 검색용).

## 4. Coding Standards & Constraints (코딩 컨벤션 및 제약사항)
1.  **API Rate Limiting:** 모든 외부 광고 플랫폼 API(Meta, Amazon 등) 호출 시 반드시 Retry, Backoff, Rate Limit 핸들링 로직을 포함할 것. (마케팅 계정 정지 방지)
2.  **Idempotency (멱등성):** 광고 예산 변경, 이메일 발송 등의 Mutation API는 중복 실행을 막기 위해 반드시 멱등성 키(Idempotency Key)를 설계할 것.
3.  **Modular Agent Design:** AI 에이전트 코드는 `agents/` 디렉토리에 기능별로 모듈화할 것 (예: `roas_optimizer_agent.py`, `copywriting_agent.py`).
4.  **Security:** API Key, Token 등은 절대 하드코딩하지 않고 `.env` 및 클라우드 Secret Manager 환경을 가정하여 작성할 것.

## 5. Development Workflow
* 새로운 파이프라인을 구축할 때는 [데이터 수집] -> [전처리] -> [AI 판단] -> [액션 실행]의 MECE한 파이프라인 구조를 먼저 주석으로 제시한 후 코드를 작성하라.

---

# Skill: Marketing Automation Workflows & AI Agents

이 문서는 AI 마케팅 자동화 모듈을 개발할 때 Claude가 참조해야 하는 패턴과 워크플로우를 정의합니다.

## 6. 캠페인 예산 자동 최적화 (ROAS Optimizer Engine)
사용자가 "광고 예산 최적화 로직 구현"을 요청할 경우 다음 워크플로우를 코드로 구현합니다.
* **Trigger:** 매일 자정(Cron) 또는 실시간 대시보드.
* **Ingestion:** Meta Ads API 및 Amazon Ads API를 통해 전일 기준 Campaign, AdSet, Ad 레벨의 지표(Spend, Revenue, Impressions, Clicks) 수집.
* **AI Logic (Decision Rule):**
    * 3일 연속 목표 ROAS (예: 150%) 미달 시 -> 해당 AdSet 예산 20% 감액 또는 Pause API 호출.
    * 전환율(CVR) 상위 10% 소재 발굴 시 -> 해당 AdSet 일일 예산 30% 증액 (Scale-up) API 호출.
* **Output:** 조정된 내역을 DB에 로깅하고 슬랙(Slack) 웹훅으로 마케팅팀에 Alert 발송.

## 7. 콘텐츠/카피라이팅 자동 생성 (Auto-Copywriter Agent)
사용자가 "A/B 테스트용 카피 생성기 구현"을 요청할 경우 다음 아키텍처로 구현합니다.
* **Input:** 제품명, 메인 USP (예: PDRN, 글래스 스킨), 타겟 국가 (미국/일본).
* **Context Retrieval (RAG):** 벡터 DB에서 과거에 가장 높은 CTR을 기록했던 자사의 'Winner 카피' 5개를 유사도 검색으로 추출.
* **LLM Prompting:**
    * System Prompt에 타겟 국가의 로컬라이제이션 규칙(예: 일본은 텍스트 중심적이고 꼼꼼하게, 미국은 후킹하고 간결하게) 주입.
    * 추출된 Winner 카피를 Few-shot 예제로 제공.
* **Output Format:** 3초 Hook 카피 3종, 메인 텍스트 3종을 JSON 형태로 반환하는 FastAPI 엔드포인트 구현.

## 8. CRM 초정밀 리타게팅 자동화 (Retention Automation)
사용자가 "이탈 고객 리타게팅 자동화"를 요청할 경우 다음 파이프라인을 구현합니다.
* **Event Listener:** 자사몰(Shopify/Cafe24 웹훅 등)에서 `add_to_cart` 후 24시간 내 `purchase` 이벤트가 없는 유저 식별.
* **Segment AI:** 해당 유저의 과거 구매 이력(LTV) 및 장바구니 담은 품목을 기반으로 쿠폰 발급 여부(할인율 10% vs 20%)를 AI가 결정.
* **Execution:** Klaviyo API 또는 LINE Messaging API를 호출하여 개인화된 이메일/푸시 메시지 전송.

## 9. 에러 핸들링 및 로깅 필수 규약 (Marketing Tech 특화)
* 광고비가 직접적으로 연결된 코드를 작성할 때는, 변경하려는 예산이 기존 예산의 200%를 초과하지 못하도록 하는 Safety Lock(안전장치) 로직을 코드 레벨에 반드시 포함할 것.
* 서드파티 API 실패 시 (예: Meta Graph API 500 Error), 로직을 중단하지 않고 데이터베이스의 `sync_status` 필드를 'FAILED'로 마킹한 뒤 다음 캠페인으로 넘어가도록 구현할 것.

## 10. [Existing Modules] 내부 기개발 API 및 연동 규약
현재 시스템에는 이미 개발이 완료된 4개의 Data Ingestion API가 존재한다. 새로운 AI 에이전트를 개발할 때 외부 크롤링 코드를 새로 짜지 말고, 반드시 아래의 내부 엔드포인트를 호출하여 컨텍스트를 구성하라.

1. `GET /api/v1/trends/oliveyoung/ranking` : 올리브영 실시간/일간/주간 랭킹 데이터 (카테고리별 탑 100 제품명, 가격, 리뷰수 반환).
2. `GET /api/v1/trends/naver/keywords` : 네이버 검색어 트렌드 크롤링 데이터 (성별/연령별 뷰티 키워드 검색량 및 증감률 반환).
3. `GET /api/v1/content/video-insights` : 틱톡/릴스/쇼츠 트렌드 영상 분석 데이터 (해시태그, 오디오 링크, 영상 길이, 평균 조회수, 초반 3초 텍스트 추출 데이터 반환).
4. `GET /api/v1/reviews/sentiment` : 자사/경쟁사 제품 리뷰 분석 데이터 (긍/부정 스코어, 핵심 추출 키워드, 리뷰어 정보 반환).

## 11. [AI Workflow] Insight to Action (실행 자동화) 개발 패턴
Claude는 위 4개의 API 데이터를 바탕으로 단순 분석(Summary)만 제공해서는 안 되며, 반드시 마케팅 액션(Action)이 포함된 코드를 작성해야 한다.
* 예시: 올리브영 랭킹(API 1)과 네이버 키워드(API 2)를 조회한 뒤 -> LLM을 통해 '자사 제품 USP'와 매칭되는 광고 카피를 3개 생성하고 -> Meta Ads API를 호출하여 해당 카피로 새로운 A/B 테스트 광고 세트(AdSet)를 Draft 상태로 자동 생성하는 파이프라인을 구축할 것.
