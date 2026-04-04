import os
import json
import subprocess
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

# Load environment variables from .env.local
load_dotenv('.env.local')

POSTGRES_URL = os.getenv('POSTGRES_URL')

def get_trending_shorts(keyword, count=5):
    print(f"Searching for {keyword}...")
    # Using yt-dlp to search for shorts
    # --flat-playlist: only get metadata without downloading
    # --print: print custom metadata
    # --max-downloads: limit results
    cmd = [
        'python3', '-m', 'yt_dlp',
        f'ytsearch{count * 2}:{keyword} shorts',
        '--flat-playlist',
        '--print', '%(id)s|%(title)s|%(thumbnails.-1.url)s',
        '--max-downloads', str(count)
    ]
    
    try:
        result = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
        lines = result.strip().split('\n')
        videos = []
        for line in lines:
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 3:
                    vid = parts[0]
                    thumb = parts[-1]
                    title = "|".join(parts[1:-1])
                    videos.append({
                        'platform': 'youtube',
                        'video_id': vid,
                        'url': f'https://www.youtube.com/shorts/{vid}',
                        'title': title,
                        'thumbnail': thumb,
                        'category': keyword,
                        'date_str': datetime.now().strftime('%Y%m%d')
                    })
        return videos[:count]
    except Exception as e:
        print(f"Error fetching {keyword}: {e}")
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
                INSERT INTO video_analyses (platform, video_id, url, title, thumbnail, category, date_str, analysis_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (video_id, date_str) DO NOTHING;
            """, (v['platform'], v['video_id'], v['url'], v['title'], v['thumbnail'], v['category'], v['date_str'], json.dumps(analysis)))
            
        conn.commit()
        cur.close()
        conn.close()
        print(f"Saved {len(videos)} videos to DB.")
    except Exception as e:
        print(f"DB Error: {e}")

if __name__ == "__main__":
    beauty_videos = get_trending_shorts("Beauty", 5)
    household_videos = get_trending_shorts("Household", 5)
    all_videos = beauty_videos + household_videos
    save_to_db(all_videos)
