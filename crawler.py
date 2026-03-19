import cloudscraper
from bs4 import BeautifulSoup
from datetime import datetime
from database import init_db, save_rankings

def fetch_oliveyoung_rankings():
    url = "https://www.oliveyoung.co.kr/store/main/getBestList.do?t_page=%ED%99%88&t_click=GNB&t_gnb_type=%EB%9E%AD%ED%82%B9&t_swiping_type=N"
    
    print("Fetching rankings from Olive Young using cloudscraper...")
    scraper = cloudscraper.create_scraper()
    response = scraper.get(url)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 올리브영 랭킹은 일반적으로 div.prd_info 로 묶여있지만 
    # 페이지 소스를 보면 li 내에 div.prd_info 와 div.prd_thumb 이 같이 있는 구조입니다.
    # 클래스명은 변경될 수 있으므로 다양한 케이스 대응.
    
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
            continue
            
    return rankings

def run_crawler(date_str=None):
    if date_str is None:
        date_str = datetime.now().strftime("%Y%m%d")
        
    init_db()
    rankings = fetch_oliveyoung_rankings()
    
    if rankings:
        print(f"Successfully scraped {len(rankings)} items.")
        save_rankings(date_str, rankings)
        print(f"Saved to database for date: {date_str}.")
    else:
        print("No rankings found. Please check crawler logic.")
        
    return rankings

if __name__ == '__main__':
    run_crawler()
