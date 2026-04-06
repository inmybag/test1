import os
import json
import subprocess
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

# Load environment variables from .env.local
load_dotenv('.env.local')

POSTGRES_URL = os.getenv('POSTGRES_URL')

import sys

def get_trending_shorts(keyword, platform='youtube', count=3):
    # 숏폼 및 트렌드 검색어 최적화 (플랫폼 키워드 추가하여 검색 결과 유도)
    search_keyword = f"{keyword} tiktok reels"
    
    # yt-dlp 명령어를 하나의 문자열로 결합
    python_bin = sys.executable
    cmd_str = (
        f'{python_bin} -m yt_dlp "ytsearch20:{search_keyword}" '
        '--geo-bypass --get-comments --extractor-args "youtube:comment_sort=top;max_comments=10" '
        '--print "%(id)s|%(title)s|%(thumbnails.-1.url)s|%(webpage_url)s|%(view_count)s|%(like_count)s|%(comment_count)s|%(description)s|%(comments)j" '
        f'--max-downloads {count}'
    )
    
    # 환경 변수 설정 (UTF-8)
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    env['LC_ALL'] = 'en_US.UTF-8'
    
    try:
        # shell=True를 사용하여 터미널과 동일한 환경에서 실행
        result = subprocess.check_output(cmd_str, shell=True, env=env, stderr=subprocess.STDOUT).decode('utf-8')
        lines = result.strip().split('\n')
        videos = []
        for line in lines:
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 9:
                    vid = parts[0]
                    title = "|".join(parts[1:-7]) # Handle titles with | if any
                    thumb = parts[-7]
                    url = parts[-6]
                    views = int(parts[-5]) if parts[-5] != 'NA' and parts[-5] != 'None' and parts[-5].isdigit() else 0
                    likes = int(parts[-4]) if parts[-4] != 'NA' and parts[-4] != 'None' and parts[-4].isdigit() else 0
                    c_count = int(parts[-3]) if parts[-3] != 'NA' and parts[-3] != 'None' and parts[-3].isdigit() else 0
                    desc = parts[-2]
                    try:
                        comments_raw = json.loads(parts[-1])
                        # 필요한 정보(텍스트, 좋아요 수)만 추출
                        comments_data = [{"text": c.get("text", ""), "like_count": c.get("like_count", 0)} for c in comments_raw]
                    except:
                        comments_data = []
                    
                    # Detect platform by URL source
                    if 'youtube.com' in url or 'youtu.be' in url:
                        detected_platform = 'youtube'
                        if '/shorts/' in url:
                            vid = url.split('/shorts/')[-1].split('?')[0].split('&')[0]
                        elif 'v=' in url:
                            vid = url.split('v=')[-1].split('&')[0]
                    elif 'tiktok.com' in url:
                        detected_platform = 'tiktok'
                    elif 'instagram.com' in url:
                        detected_platform = 'instagram'
                    else:
                        detected_platform = platform 
                    
                    videos.append({
                        'platform': detected_platform,
                        'video_id': vid,
                        'url': url,
                        'title': title,
                        'thumbnail': thumb,
                        'category': keyword,
                        'date_str': datetime.now().strftime('%Y%m%d'),
                        'view_count': views,
                        'like_count': likes,
                        'comment_count': c_count,
                        'description': desc,
                        'comments': comments_data
                    })
        return videos[:count]
    except subprocess.CalledProcessError as e:
        print(f"Error fetching {keyword} on {platform}: {e}")
        if e.output:
            print(f"Subprocess Output: {e.output.decode('utf-8')}")
        return []
    except Exception as e:
        print(f"Unexpected error for {keyword} on {platform}: {e}")
        return []

def save_to_db(videos):
    if not POSTGRES_URL:
        print("POSTGRES_URL not found!")
        return
    
    try:
        conn = psycopg2.connect(POSTGRES_URL)
        cur = conn.cursor()
        
        for v in videos:
            # Default analysis_json
            analysis = {
                "score": 0,
                "hook": "분석 전",
                "summary": "AI 분석이 예약되었습니다.",
                "takeaways": []
            }
            
            cur.execute("""
                INSERT INTO video_analyses (platform, video_id, url, title, thumbnail, category, date_str, analysis_json, view_count, like_count, comment_count, description, comments)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (video_id) 
                DO UPDATE SET 
                    category = EXCLUDED.category,
                    view_count = EXCLUDED.view_count, 
                    like_count = EXCLUDED.like_count, 
                    comment_count = EXCLUDED.comment_count,
                    description = EXCLUDED.description,
                    comments = EXCLUDED.comments;
            """, (
                v['platform'], v['video_id'], v['url'], v['title'], v['thumbnail'], 
                v['category'], v['date_str'], json.dumps(analysis),
                v['view_count'], v['like_count'], v['comment_count'], v['description'],
                json.dumps(v['comments'])
            ))
            
        conn.commit()
        cur.close()
        conn.close()
        print(f"Saved {len(videos)} videos to DB.")
    except Exception as e:
        print(f"DB Error: {e}")

if __name__ == "__main__":
    # --- 경쟁사 및 카테고리 트렌드 수집 키워드 (벤치마킹 타겟) ---
    TARGET_KEYWORDS = [
        # [Beauty] 주요 경쟁사 및 킬러 아이템
        {"en": "Hera", "ko": "헤라", "type": "Beauty"},
        {"en": "Sulwhasoo", "ko": "설화수", "type": "Beauty"},
        {"en": "Clio", "ko": "클리오", "type": "Beauty"},
        {"en": "Romand", "ko": "롬앤", "type": "Beauty"},
        {"en": "Jung Saem Mool", "ko": "정샘물", "type": "Beauty"},
        {"en": "Laneige", "ko": "라네즈", "type": "Beauty"},
        {"en": "Espoir", "ko": "에스쁘아", "type": "Beauty"},
        {"en": "Olive Young Trending", "ko": "올리브영 추천템", "type": "Beauty"},
        {"en": "Base makeup hack", "ko": "파운데이션 꿀팁", "type": "Beauty"},
        
        # [Household] 주요 경쟁사 및 리빙 트렌드
        {"en": "Downy", "ko": "다우니", "type": "Household"},
        {"en": "LG FiJi", "ko": "LG 피지", "type": "Household"},
        {"en": "Aura", "ko": "아우라 세제", "type": "Household"},
        {"en": "Pigeon", "ko": "피죤", "type": "Household"},
        {"en": "Bref", "ko": "브레프", "type": "Household"},
        {"en": "Yuhanrox", "ko": "유한락스", "type": "Household"},
        {"en": "Laundry life hack", "ko": "빨래 쉰내 제거", "type": "Household"},
        {"en": "Bathroom cleaning", "ko": "화장실 청소 팁", "type": "Household"},
        {"en": "Kitchen hack", "ko": "주방 기름때 제거", "type": "Household"}
    ]
    
    # 1. 경쟁 트렌드 수집
    print("Starting Competitor & Trend Collection for AEKYUNG Planning...")
    for item in TARGET_KEYWORDS:
        # 영문명으로 검색 성공률 극대화 (get_trending_shorts 내부에서 shorts 추가됨)
        search_term = item['en']
        videos = get_trending_shorts(search_term, 'youtube', 1) 
        
        # 분석을 위한 카테고리 지정
        for v in videos:
            v['category'] = item['type'] 
            # 경쟁사/키워드 정보를 설명 앞에 추가하여 분석 엔진이 식별하도록 함
            v['description'] = f"[Benchmarking: {item['ko']}] {v['description']}"
            
        if videos:
            save_to_db(videos) # 실시간 저장 (진척도 확인용)
