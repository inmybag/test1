#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_shortform.py
------------------
플랫폼별 숏폼 콘텐츠 크롤링 스크립트
  - YouTube Shorts  (yt-dlp ytsearch)
  - Instagram Reels (yt-dlp + hashtag URL)
  - TikTok          (yt-dlp ttsearch / hashtag URL)

수집 대상: Aekyung 경쟁사 벤치마킹용 Beauty & Household 카테고리
"""

import os, json, subprocess, sys, re, time
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

# ── 환경 변수 로드 ──────────────────────────────────────
load_dotenv('.env.local')
POSTGRES_URL = os.getenv('POSTGRES_URL')
PYTHON_BIN   = sys.executable
TODAY        = datetime.now().strftime('%Y%m%d')

# ── 수집 키워드 (벤치마킹 타겟) ────────────────────────
TARGET_KEYWORDS = [
    # Beauty
    {"en": "Hera makeup",         "ko": "헤라",           "type": "Beauty"},
    {"en": "Sulwhasoo skincare",  "ko": "설화수",          "type": "Beauty"},
    {"en": "Romand lip",          "ko": "롬앤",            "type": "Beauty"},
    {"en": "Laneige lips",        "ko": "라네즈",          "type": "Beauty"},
    {"en": "Clio makeup",         "ko": "클리오",          "type": "Beauty"},
    {"en": "Beauty of Joseon",    "ko": "조선미녀",        "type": "Beauty"},
    {"en": "Skin1004 centella",   "ko": "스킨1004",        "type": "Beauty"},
    {"en": "Medicube pore",       "ko": "메디큐브",        "type": "Beauty"},
    {"en": "Korean base makeup",  "ko": "파운데이션 꿀팁", "type": "Beauty"},
    {"en": "Olive Young haul",    "ko": "올리브영 추천템", "type": "Beauty"},
    # Household
    {"en": "Downy fabric softener","ko": "다우니",         "type": "Household"},
    {"en": "Pigeon laundry",      "ko": "피죤",            "type": "Household"},
    {"en": "Aura detergent",      "ko": "아우라 세제",     "type": "Household"},
    {"en": "Yuhanrox disinfect",  "ko": "유한락스",        "type": "Household"},
    {"en": "laundry hack smell",  "ko": "빨래 쉰내 제거",  "type": "Household"},
    {"en": "bathroom cleaning tip","ko": "화장실 청소 팁",  "type": "Household"},
    {"en": "kitchen grease hack", "ko": "주방 기름때 제거", "type": "Household"},
]

# 플랫폼별 최대 수집 건수
COUNTS = {
    "youtube":   3,   # YouTube Shorts
    "instagram": 2,   # Instagram Reels
    "tiktok":    3,   # TikTok
}

# ─────────────────────────────────────────────────────────
# yt-dlp 공통 실행 헬퍼
# ─────────────────────────────────────────────────────────
def _run_ytdlp(cmd_str: str, label: str) -> list:
    """yt-dlp 명령 실행 → stdout 라인 리스트 반환 (stderr 분리)"""
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    env['LC_ALL'] = 'en_US.UTF-8'
    try:
        proc = subprocess.run(
            cmd_str, shell=True, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=120
        )
        # stdout만 파싱 (stderr의 deprecated 경고 등 무시)
        out = proc.stdout.decode('utf-8', errors='replace')
        if proc.returncode != 0 and not out.strip():
            err = proc.stderr.decode('utf-8', errors='replace')
            print(f"[{label}] yt-dlp warning: {err[:200]}")
        return out.strip().split('\n') if out.strip() else []
    except subprocess.TimeoutExpired:
        print(f"[{label}] yt-dlp timeout")
        return []
    except Exception as e:
        print(f"[{label}] unexpected error: {e}")
        return []


def _int(s: str) -> int:
    s = s.strip()
    if s in ('NA', 'None', '', 'N/A'):
        return 0
    try:
        return int(float(s))
    except Exception:
        return 0


def _parse_lines(lines: list, platform_fallback: str, keyword: str, category: str) -> list:
    """pipe-delimited yt-dlp --print 출력을 파싱
    
    yt-dlp --print 형식: id|title|thumbnail_url|webpage_url|views|likes|comments|desc|NA
    고정 꼬리 7개: thumbnail|url|views|likes|cmts|desc|NA
    나머지 중간: title (title 안에 | 포함 가능)
    최소 필드 수: 9 (id + title + 7개 꼬리)
    """
    videos = []
    for line in lines:
        line = line.strip()
        if '|' not in line:
            continue
        parts = line.split('|')
        # 최소 9개 필드 필요 (id, title, thumb, url, views, likes, cmts, desc, NA)
        if len(parts) < 9:
            continue
        try:
            vid   = parts[0].strip()
            # 고정 꼬리: 마지막 7개 = thumb|url|views|likes|cmts|desc|NA
            thumb = parts[-7].strip()
            url   = parts[-6].strip()
            views = _int(parts[-5])
            likes = _int(parts[-4])
            c_cnt = _int(parts[-3])
            desc  = parts[-2].strip()
            # 중간 나머지가 title (title 안에 | 포함 가능)
            title = '|'.join(parts[1:-7]).strip()

            # URL 유효성 검증 - URL이 http로 시작하지 않으면 thumb/url이 뒤바뀐 것
            if url and not url.startswith('http'):
                thumb, url = url, thumb

            # thumbnail이 URL 형태가 아니면 video_id로 YouTube 썸네일 생성
            if not thumb or not thumb.startswith('http'):
                thumb = f'https://i.ytimg.com/vi/{vid}/maxresdefault.jpg'

            # URL 기반 플랫폼 감지
            if 'tiktok.com' in url:
                detected = 'tiktok'
            elif 'instagram.com' in url:
                detected = 'instagram'
                m = re.search(r'/reel[s]?/([A-Za-z0-9_-]+)', url)
                if m:
                    vid = m.group(1)
            elif 'youtube.com' in url or 'youtu.be' in url:
                detected = 'youtube'
                if '/shorts/' in url:
                    vid = url.split('/shorts/')[-1].split('?')[0]
                elif 'v=' in url:
                    vid = url.split('v=')[-1].split('&')[0]
                # YouTube 썸네일이 없으면 video_id로 구성
                if not thumb or not thumb.startswith('http'):
                    thumb = f'https://i.ytimg.com/vi/{vid}/maxresdefault.jpg'
            else:
                detected = platform_fallback

            if not vid or not title or not url:
                continue

            videos.append({
                'platform':      detected,
                'video_id':      vid,
                'url':           url,
                'title':         title,
                'thumbnail':     thumb,
                'category':      category,
                'date_str':      TODAY,
                'view_count':    views,
                'like_count':    likes,
                'comment_count': c_cnt,
                'description':   f"[Benchmarking: {keyword}] {desc}",
                'comments':      [],
            })
        except Exception as e:
            print(f"  parse error: {e} | line={line[:80]}")
    return videos


# ─────────────────────────────────────────────────────────
# 플랫폼별 수집 함수
# ─────────────────────────────────────────────────────────

PRINT_FIELDS = (
    '--print "%(id)s|%(title)s|%(thumbnails.-1.url)s|%(webpage_url)s'
    '|%(view_count)s|%(like_count)s|%(comment_count)s|%(description)s|NA"'
)

def fetch_youtube_shorts(keyword_en: str, keyword_ko: str, category: str, count: int = 3) -> list:
    """YouTube Shorts 벤치마킹: 숏폼 형식 콘텐츠 검색"""
    search_q = f"{keyword_en} shorts"
    cmd = (
        f'{PYTHON_BIN} -m yt_dlp "ytsearch{count * 4}:{search_q}" '
        '--geo-bypass '
        f'--max-downloads {count} '
        f'{PRINT_FIELDS} '
        '--no-warnings --ignore-errors'
    )
    lines  = _run_ytdlp(cmd, f"YT-Shorts/{keyword_en}")
    videos = _parse_lines(lines, 'youtube', keyword_ko, category)
    # youtube platform인 것만 (tiktok/instagram URL이 섞일 수 있음)
    result = [v for v in videos if v['platform'] == 'youtube'][:count]
    print(f"  ✅ YouTube Shorts [{keyword_ko}]: {len(result)}개 수집")
    return result


def fetch_instagram_reels(keyword_en: str, keyword_ko: str, category: str, count: int = 2) -> list:
    """
    Instagram Reels 벤치마킹:
    Instagram 직접 접근은 로그인 필요로 불가 → YouTube에서
    'keyword + instagram reels' 검색으로 Reels 레퍼런스 영상 수집.
    platform 태그를 'instagram'으로 지정하여 대시보드 분류에 활용.
    """
    search_q = f"{keyword_en} instagram reels"
    cmd = (
        f'{PYTHON_BIN} -m yt_dlp "ytsearch{count * 4}:{search_q}" '
        '--geo-bypass '
        f'--max-downloads {count} '
        f'{PRINT_FIELDS} '
        '--no-warnings --ignore-errors'
    )
    lines  = _run_ytdlp(cmd, f"IG-Reels/{keyword_en}")
    videos = _parse_lines(lines, 'instagram', keyword_ko, category)
    # youtube URL이지만 instagram 벤치마킹용으로 platform 재지정
    for v in videos:
        v['platform']    = 'instagram'
        v['description'] = '[Instagram Reels 벤치마킹] ' + v['description']
    result = videos[:count]
    print(f"  ✅ Instagram Reels [{keyword_ko}]: {len(result)}개 수집")
    return result


def fetch_tiktok(keyword_en: str, keyword_ko: str, category: str, count: int = 3) -> list:
    """
    TikTok 벤치마킹:
    TikTok 직접 접근은 앱 인증 필요로 불가 → YouTube에서
    'keyword + tiktok' 검색으로 TikTok 레퍼런스 영상 수집.
    platform 태그를 'tiktok'으로 지정하여 대시보드 분류에 활용.
    """
    search_q = f"{keyword_en} tiktok viral"
    cmd = (
        f'{PYTHON_BIN} -m yt_dlp "ytsearch{count * 4}:{search_q}" '
        '--geo-bypass '
        f'--max-downloads {count} '
        f'{PRINT_FIELDS} '
        '--no-warnings --ignore-errors'
    )
    lines  = _run_ytdlp(cmd, f"TikTok/{keyword_en}")
    videos = _parse_lines(lines, 'tiktok', keyword_ko, category)
    for v in videos:
        v['platform']    = 'tiktok'
        v['description'] = '[TikTok 벤치마킹] ' + v['description']
    result = videos[:count]
    print(f"  ✅ TikTok [{keyword_ko}]: {len(result)}개 수집")
    return result


# ─────────────────────────────────────────────────────────
# DB 저장
# ─────────────────────────────────────────────────────────

def save_to_db(videos: list) -> None:
    if not POSTGRES_URL:
        print("POSTGRES_URL not set!")
        return
    if not videos:
        return
    try:
        conn = psycopg2.connect(POSTGRES_URL)
        cur  = conn.cursor()
        saved = 0
        for v in videos:
            default_analysis = {
                "score": 0,
                "hook":  "분석 전",
                "summary": "AI 분석이 예약되었습니다.",
                "takeaways": []
            }
            cur.execute("""
                INSERT INTO video_analyses
                  (platform, video_id, url, title, thumbnail, category, date_str,
                   analysis_json, view_count, like_count, comment_count, description, comments)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (video_id, date_str)
                DO UPDATE SET
                  platform      = EXCLUDED.platform,
                  category      = EXCLUDED.category,
                  url           = EXCLUDED.url,
                  thumbnail     = EXCLUDED.thumbnail,
                  view_count    = EXCLUDED.view_count,
                  like_count    = EXCLUDED.like_count,
                  comment_count = EXCLUDED.comment_count,
                  description   = EXCLUDED.description,
                  comments      = EXCLUDED.comments;
            """, (
                v['platform'], v['video_id'], v['url'], v['title'],
                v['thumbnail'], v['category'], v['date_str'],
                json.dumps(default_analysis),
                v['view_count'], v['like_count'], v['comment_count'],
                v['description'], json.dumps(v['comments'])
            ))
            saved += 1
        conn.commit()
        cur.close()
        conn.close()
        print(f"  💾 DB 저장 완료: {saved}건")
    except Exception as e:
        print(f"  ❌ DB 저장 오류: {e}")


# ─────────────────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print(f"🎬 숏폼 크롤링 시작 | 날짜: {TODAY}")
    print(f"   플랫폼: YouTube Shorts / Instagram Reels / TikTok")
    print(f"   키워드: {len(TARGET_KEYWORDS)}개")
    print("=" * 60)

    total = 0
    for item in TARGET_KEYWORDS:
        en, ko, cat = item['en'], item['ko'], item['type']
        print(f"\n📌 [{cat}] {ko} ({en})")

        # 1. YouTube Shorts
        yt_videos = fetch_youtube_shorts(en, ko, cat, COUNTS['youtube'])
        save_to_db(yt_videos)
        total += len(yt_videos)
        time.sleep(2)   # 요청 간 딜레이

        # 2. Instagram Reels (이제 Node.js Puppeteer가 담당)
        # ig_videos = fetch_instagram_reels(en, ko, cat, COUNTS['instagram'])
        # save_to_db(ig_videos)
        # total += len(ig_videos)
        # time.sleep(2)

        # 3. TikTok (이제 Node.js Puppeteer가 담당)
        # tt_videos = fetch_tiktok(en, ko, cat, COUNTS['tiktok'])
        # save_to_db(tt_videos)
        # total += len(tt_videos)
        # time.sleep(2)

    print("\n" + "=" * 60)
    print(f"✅ 전체 크롤링 완료: 총 {total}개 영상 수집 및 저장")
    print("=" * 60)


if __name__ == '__main__':
    main()
