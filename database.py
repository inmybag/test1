import sqlite3
import os
from datetime import datetime

DB_PATH = 'daily_rankings.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rankings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_str TEXT,
            rank INTEGER,
            title TEXT,
            brand TEXT,
            price TEXT,
            image_url TEXT,
            UNIQUE(date_str, rank)
        )
    ''')
    conn.commit()
    conn.close()

def save_rankings(date_str, rankings):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for item in rankings:
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO rankings (date_str, rank, title, brand, price, image_url)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (date_str, item['rank'], item['title'], item['brand'], item['price'], item['image_url']))
        except Exception as e:
            print(f"Error saving {item['title']}: {e}")
    conn.commit()
    conn.close()

def get_rankings(date_str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM rankings WHERE date_str = ? ORDER BY rank ASC', (date_str,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_ranking_history(title, date_str, days=30):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # We want to get the past 30 days history up to the given date_str
    # Note: date_str is in YYYYMMDD format.
    # SQLite can compare YYYYMMDD lexicographically.
    cursor.execute('''
        SELECT date_str, rank, price 
        FROM rankings 
        WHERE title = ? AND date_str <= ?
        ORDER BY date_str DESC 
        LIMIT ?
    ''', (title, date_str, days))
    
    rows = cursor.fetchall()
    conn.close()
    
    # Reverse the rows to have chronological order (oldest to newest)
    history = [dict(row) for row in reversed(rows)]
    return history

if __name__ == '__main__':
    init_db()
    print("Database initialized.")
