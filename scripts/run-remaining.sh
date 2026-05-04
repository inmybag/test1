#!/bin/bash
PROJECT_DIR="/Users/admin/anti-gravity/test1"
cd $PROJECT_DIR
LOG_FILE="$PROJECT_DIR/scripts/analysis_cron.log"

echo "[$(date)] 1-2단계 재시작: Puppeteer 기반 틱톡/릴스 직접 수집 시작..." >> $LOG_FILE
/usr/local/bin/node scripts/fetch-puppeteer-shortform.js >> $LOG_FILE 2>&1

echo "[$(date)] 2단계: YouTube 트렌드 보조 수집 시작 (fetch_trending.py)..." >> $LOG_FILE
python3 scripts/fetch_trending.py >> $LOG_FILE 2>&1

echo "[$(date)] 3단계: AI 인사이트 분석 시작 (analyze-videos.js)..." >> $LOG_FILE
/usr/local/bin/node scripts/analyze-videos.js >> $LOG_FILE 2>&1

echo "[$(date)] 4단계: 제품 리뷰 크롤링 및 AI 감성분석 시작 (crawl-reviews.js)..." >> $LOG_FILE
/usr/local/bin/node scripts/crawl-reviews.js >> $LOG_FILE 2>&1

echo "[$(date)] 5단계: 미분석 리뷰 재분석 시작 (re-analyze-reviews.js)..." >> $LOG_FILE
/usr/local/bin/node scripts/re-analyze-reviews.js >> $LOG_FILE 2>&1

echo "[$(date)] --- 종료: 나머지 분석 완료 ---" >> $LOG_FILE
