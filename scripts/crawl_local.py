import cloudscraper
import psycopg2
from bs4 import BeautifulSoup
from datetime import datetime
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv('.env.local')
load_dotenv() # fallback to .env

def fetch_oliveyoung_rankings():
    url = "https://www.oliveyoung.co.kr/store/main/getBestList.do?t_page=%ED%99%88&t_click=GNB&t_gnb_type=%EB%9E%AD%ED%82%B9&t_swiping_type=N"
    
    print("Fetching rankings from Olive Young using cloudscraper...")
    scraper = cloudscraper.create_scraper()
    response = scraper.get(url)
    
    if response.status_code != 200:
        print(f"Error: Status code {response.status_code}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    items = soup.select('div.prd_info')
    
    rankings = []
    for idx, info in enumerate(items):
        try:
            rank = idx + 1
            title_elem = info.select_one('p.tx_name')
            title = title_elem.text.strip() if title_elem else 'Unknown'
            
            brand_elem = info.select_one('span.tx_brand, p.tx_brand')
            brand = brand_elem.text.strip() if brand_elem else 'Unknown'
            
            price_elem = info.select_one('span.tx_cur > span.tx_num, span.tx_cur')
            price = price_elem.text.strip() if price_elem else '0'
            
            img_elem = info.select_one('img')
            image_url = img_elem.get('src') or img_elem.get('data-original', '') if img_elem else ''
            
            if title != 'Unknown':
                rankings.append({
                    'rank': rank,
                    'title': title,
                    'brand': brand,
                    'price': price,
                    'image_url': image_url
                })
        except Exception as e:
            print(f"Failed to parse item {idx}: {e}")
            
    return rankings

def save_to_vercel_db(date_str, rankings):
    db_url = os.getenv('POSTGRES_URL')
    if not db_url:
        print("Error: POSTGRES_URL is not set in .env file.")
        return

    try:
        # postgresql:// -> postgres:// 로 변경 (psycopg2 호환성)
        if db_url.startswith('postgres://'):
            pass
        elif db_url.startswith('postgresql://'):
            # psycopg2는 두 형식 모두 지원하지만 가끔 라이브러리에 따라 다를 수 있음
            pass

        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print(f"Saving {len(rankings)} items to Vercel DB...")
        for item in rankings:
            query = """
            INSERT INTO rankings (date_str, rank, title, brand, price, image_url)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (date_str, rank) 
            DO UPDATE SET 
              title = EXCLUDED.title,
              brand = EXCLUDED.brand,
              price = EXCLUDED.price,
              image_url = EXCLUDED.image_url;
            """
            cur.execute(query, (
                date_str, 
                item['rank'], 
                item['title'], 
                item['brand'], 
                item['price'], 
                item['image_url']
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        print("Data successfully saved to Vercel Postgres!")
        
    except Exception as e:
        print(f"Database error: {e}")

def run():
    date_str = datetime.now().strftime("%Y%m%d")
    rankings = fetch_oliveyoung_rankings()
    
    if rankings:
        print(f"Successfully scraped {len(rankings)} items.")
        save_to_vercel_db(date_str, rankings)
    else:
        print("No rankings found.")

if __name__ == '__main__':
    run()
