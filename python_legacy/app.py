from flask import Flask, jsonify, request, render_template
from datetime import datetime
from database import get_rankings, get_ranking_history, init_db
from crawler import run_crawler

app = Flask(__name__)

# Initialize database on startup
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/rankings')
def api_rankings():
    # Get date from query params, default to today
    date_str = request.args.get('date')
    if not date_str:
        date_str = datetime.now().strftime("%Y%m%d")
        
    rankings = get_rankings(date_str)
    
    # If no rankings found for the requested date, try to crawl
    # Only crawl if the requested date is today
    today_str = datetime.now().strftime("%Y%m%d")
    if not rankings and date_str == today_str:
        print(f"No rankings found for {date_str}, attempting to crawl...")
        rankings = run_crawler(date_str)
        # We don't need to get from db again as run_crawler returns the list
        
    return jsonify({
        'date': date_str,
        'count': len(rankings) if rankings else 0,
        'data': rankings
    })

@app.route('/api/history')
def api_history():
    title = request.args.get('title')
    date_str = request.args.get('date')
    
    if not title or not date_str:
        return jsonify({'error': 'title and date parameters are required'}), 400
        
    history = get_ranking_history(title, date_str, days=30)
    
    return jsonify({
        'title': title,
        'history': history
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
