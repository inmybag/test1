#!/bin/bash

# 프로젝트 경로 설정
PROJECT_DIR="/Users/admin/anti-gravity/test1"
cd $PROJECT_DIR

# 로그 파일 경로
LOG_FILE="$PROJECT_DIR/scripts/analysis_cron.log"

echo "[$(date)] ========================================" >> $LOG_FILE
echo "[$(date)] --- 시작: 데일리 멀티 플랫폼 분석 및 트렌드 ---" >> $LOG_FILE
echo "[$(date)] ========================================" >> $LOG_FILE

# 0단계: 올리브영 실시간 랭킹 수집
echo "[$(date)] 0단계: 올리브영 실시간 랭킹 수집 시작 (crawl-puppeteer.js)..." >> $LOG_FILE
/usr/local/bin/node scripts/crawl-puppeteer.js >> $LOG_FILE 2>&1

# 1단계: 플랫폼별 숏폼 수집 (YouTube Shorts / Instagram Reels / TikTok)
echo "[$(date)] 1단계: 멀티 플랫폼 숏폼 수집 시작 (fetch_shortform.py: YouTube)..." >> $LOG_FILE
python3 scripts/fetch_shortform.py >> $LOG_FILE 2>&1

echo "[$(date)] 1-2단계: Puppeteer 기반 틱톡/릴스 직접 수집 시작..." >> $LOG_FILE
/usr/local/bin/node scripts/fetch-puppeteer-shortform.js >> $LOG_FILE 2>&1

# 2단계: 기존 YouTube 트렌드 수집 (보조)
echo "[$(date)] 2단계: YouTube 트렌드 보조 수집 시작 (fetch_trending.py)..." >> $LOG_FILE
python3 scripts/fetch_trending.py >> $LOG_FILE 2>&1

# 3단계: AI 인사이트 분석 (Node.js)
echo "[$(date)] 3단계: AI 인사이트 분석 시작 (analyze-videos.js)..." >> $LOG_FILE
/usr/local/bin/node scripts/analyze-videos.js >> $LOG_FILE 2>&1

echo "[$(date)] --- 종료: 전체 분석 완료 ---" >> $LOG_FILE
echo "" >> $LOG_FILE
