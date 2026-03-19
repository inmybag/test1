import { sql } from '@vercel/postgres';

// 로컬 환경에서도 에러가 나지 않도록 유연하게 처리합니다.
const isProd = process.env.NODE_ENV === 'production' || process.env.POSTGRES_URL;

export async function initDb() {
  if (!isProd) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS rankings (
        id SERIAL PRIMARY KEY,
        date_str TEXT NOT NULL,
        rank INTEGER NOT NULL,
        title TEXT NOT NULL,
        brand TEXT,
        price TEXT,
        image_url TEXT,
        UNIQUE(date_str, rank)
      );
    `;
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

export async function saveRankings(dateStr, rankings) {
  if (!isProd) {
    // 로컬 개발용Mock 기록 (메모리)
    console.log('Mock Save:', dateStr, rankings.length);
    global.mockDb = global.mockDb || [];
    global.mockDb = global.mockDb.filter(item => item.dateStr !== dateStr);
    global.mockDb.push(...rankings.map(r => ({ ...r, dateStr })));
    return true;
  }

  try {
    for (const item of rankings) {
      await sql`
        INSERT INTO rankings (date_str, rank, title, brand, price, image_url)
        VALUES (${dateStr}, ${item.rank}, ${item.title}, ${item.brand}, ${item.price}, ${item.imageUrl})
        ON CONFLICT (date_str, rank) 
        DO UPDATE SET 
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          price = EXCLUDED.price,
          image_url = EXCLUDED.image_url;
      `;
    }
    return true;
  } catch (error) {
    console.error('Database save error:', error);
    return false;
  }
}

export async function getRankings(dateStr) {
  if (!isProd) {
    return (global.mockDb || []).filter(item => item.dateStr === dateStr).sort((a, b) => a.rank - b.rank);
  }

  try {
    const { rows } = await sql`
      SELECT rank, title, brand, price, image_url as "imageUrl"
      FROM rankings 
      WHERE date_str = ${dateStr} 
      ORDER BY rank ASC;
    `;
    return rows;
  } catch (error) {
    console.error('Database fetch error:', error);
    return [];
  }
}

export async function getRankingHistory(title, dateStr, days = 30) {
  if (!isProd) {
    return (global.mockDb || [])
      .filter(item => item.title === title && item.dateStr <= dateStr)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
      .slice(0, days)
      .reverse();
  }

  try {
    const { rows } = await sql`
      SELECT date_str as "dateStr", rank, price 
      FROM rankings 
      WHERE title = ${title} AND date_str <= ${dateStr}
      ORDER BY date_str DESC 
      LIMIT ${days};
    `;
    return rows.reverse();
  } catch (error) {
    console.error('History fetch error:', error);
    return [];
  }
}
