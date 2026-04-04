import os
import json
import subprocess
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

# Load environment variables from .env.local
load_dotenv('.env.local')

POSTGRES_URL = os.getenv('POSTGRES_URL')

def get_trending_shorts(keyword, platform='youtube', count=5):
    print(f"Searching for {keyword} on {platform}...")
    
    # Platform specific search query
    search_keyword = f"{platform} {keyword} shorts" if platform != 'youtube' else f"{keyword} shorts"
    
    cmd = [
        'python3', '-m', 'yt_dlp',
        f'ytsearch{count * 2}:{search_keyword}',
        '--flat-playlist',
        '--print', '%(id)s|%(title)s|%(thumbnails.-1.url)s|%(webpage_url)s|%(view_count)s|%(like_count)s|%(comment_count)s',
        '--max-downloads', str(count)
    ]
    
    try:
        result = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
        lines = result.strip().split('\n')
        videos = []
        for line in lines:
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 7:
                    vid = parts[0]
                    title = "|".join(parts[1:-5])
                    thumb = parts[-5]
                    url = parts[-4]
                    views = int(parts[-3]) if parts[-3] != 'NA' and parts[-3] != 'None' else 0
                    likes = int(parts[-2]) if parts[-2] != 'NA' and parts[-2] != 'None' else 0
                    comments = int(parts[-1]) if parts[-1] != 'NA' and parts[-1] != 'None' else 0
                    
                    # Detect platform more accurately
                    detected_platform = 'youtube'
                    if 'tiktok' in title.lower() or 'tiktok' in url.lower():
                        detected_platform = 'tiktok'
                    elif 'reels' in title.lower() or 'instagram' in url.lower():
                        detected_platform = 'instagram'
                    else:
                        detected_platform = platform # Fallback to search intent
                    
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
                        'comment_count': comments
                    })
        return videos[:count]
    except Exception as e:
        print(f"Error fetching {keyword} on {platform}: {e}")
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
                INSERT INTO video_analyses (platform, video_id, url, title, thumbnail, category, date_str, analysis_json, view_count, like_count, comment_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (video_id, date_str) 
                DO UPDATE SET 
                    view_count = EXCLUDED.view_count, 
                    like_count = EXCLUDED.like_count, 
                    comment_count = EXCLUDED.comment_count;
            """, (
                v['platform'], v['video_id'], v['url'], v['title'], v['thumbnail'], 
                v['category'], v['date_str'], json.dumps(analysis),
                v['view_count'], v['like_count'], v['comment_count']
            ))
            
        conn.commit()
        cur.close()
        conn.close()
        print(f"Saved {len(videos)} videos to DB.")
    except Exception as e:
        print(f"DB Error: {e}")

if __name__ == "__main__":
    # 타겟 브랜드 및 제품군
    TARGET_BRANDS = [
        {"en": "Medicube", "ko": "메디큐브"},
        {"en": "Anua", "ko": "아누아"},
        {"en": "Dr.Melaxin", "ko": "닥터멜락신"},
        {"en": "Dr.Althea", "ko": "닥터엘시아"},
        {"en": "Sungboon Editor", "ko": "성분에디터"},
        {"en": "Beauty of Joseon", "ko": "조선미녀"},
        {"en": "Biodance", "ko": "바이오던스"},
        {"en": "Skin1004", "ko": "스킨천사"},
        {"en": "Numbuzin", "ko": "넘버즈인"}
    ]
    
    all_videos = []
    
    # 1. 한국 시장(KR) 수집: 한글 키워드 사용
    print("Starting KR Market Collection...")
    for brand in TARGET_BRANDS:
        videos = get_trending_shorts(brand['ko'], 'youtube', 1) 
        all_videos.extend(videos)

    # 2. 미국/글로벌 시장(US) 수집: 영문 키워드 사용
    print("Starting US/Global Market Collection...")
    for brand in TARGET_BRANDS:
        videos = get_trending_shorts(brand['en'] + " review us", 'youtube', 1)
        all_videos.extend(videos)
        
    save_to_db(all_videos)
