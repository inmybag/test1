#!/bin/bash

# 프로젝트 경로 설정
PROJECT_DIR="/Users/admin/anti-gravity/test1"
cd $PROJECT_DIR

# 로그 파일 경로
LOG_FILE="$PROJECT_DIR/scripts/analysis_cron.log"

echo "[$(date)] --- 시작: 데일리 영상 분석 ---" >> $LOG_FILE

# 1단계: 신규 인기 쇼츠 수집 (Python)
echo "[$(date)] 1단계: 쇼츠 수집 시작..." >> $LOG_FILE
python3 scripts/fetch_trending.py >> $LOG_FILE 2>&1

# 2단계: AI 인사이트 분석 (Node.js)
echo "[$(date)] 2단계: AI 분석 시작..." >> $LOG_FILE
node scripts/analyze-videos.js >> $LOG_FILE 2>&1

echo "[$(date)] --- 종료: 분석 완료 ---" >> $LOG_FILE
echo "" >> $LOG_FILE
