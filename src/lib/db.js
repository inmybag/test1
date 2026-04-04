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
        product_id TEXT,
        UNIQUE(date_str, rank)
      );
    `;
    // Add product_id column if it doesn't exist
    await sql`
      ALTER TABLE rankings ADD COLUMN IF NOT EXISTS product_id TEXT;
    `;

    // Add video_analyses table
    await sql`
      CREATE TABLE IF NOT EXISTS video_analyses (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        video_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        thumbnail TEXT,
        category TEXT NOT NULL,
        date_str TEXT NOT NULL,
        analysis_json JSONB,
        view_count BIGINT DEFAULT 0,
        like_count INT DEFAULT 0,
        comment_count INT DEFAULT 0,
        description TEXT,
        comments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, date_str)
      );
    `;

    // Ensure all columns exist for video_analyses (Migration)
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS description TEXT;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]';`;
    
    console.log('Database initialized and migrated successfully.');
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
        INSERT INTO rankings (date_str, rank, title, brand, price, image_url, product_id)
        VALUES (${dateStr}, ${item.rank}, ${item.title}, ${item.brand}, ${item.price}, ${item.imageUrl}, ${item.productId})
        ON CONFLICT (date_str, rank) 
        DO UPDATE SET 
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          price = EXCLUDED.price,
          image_url = EXCLUDED.image_url,
          product_id = EXCLUDED.product_id;
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
      SELECT rank, title, brand, price, image_url as "imageUrl", product_id as "productId"
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

export async function getRankingHistory(productId, dateStr, days = 30, title = '') {
  if (!isProd) {
    return (global.mockDb || [])
      .filter(item => (productId ? item.productId === productId : item.title === title) && item.dateStr <= dateStr)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
      .slice(0, days)
      .reverse();
  }

  try {
    const { rows } = await sql`
      SELECT date_str as "dateStr", rank, price 
      FROM rankings 
      WHERE product_id = ${productId}
      ORDER BY date_str DESC 
      LIMIT ${days};
    `;
    return rows.reverse();
  } catch (error) {
    console.error('History fetch error:', error);
    return [];
  }
}

export async function saveVideoAnalysis(video) {
  if (!isProd) {
    console.log('Mock Save Analysis:', video.video_id);
    global.analysisDb = global.analysisDb || [];
    global.analysisDb = global.analysisDb.filter(item => !(item.video_id === video.video_id && item.date_str === video.date_str));
    global.analysisDb.push(video);
    return true;
  }

  try {
    await sql`
      INSERT INTO video_analyses (
        platform, video_id, url, title, thumbnail, category, date_str, analysis_json, 
        view_count, like_count, comment_count, description, comments
      )
      VALUES (
        ${video.platform}, ${video.video_id}, ${video.url}, ${video.title}, ${video.thumbnail}, 
        ${video.category}, ${video.date_str}, ${JSON.stringify(video.analysis_json)},
        ${video.view_count || 0}, ${video.like_count || 0}, ${video.comment_count || 0}, 
        ${video.description || ''}, ${JSON.stringify(video.comments || [])}
      )
      ON CONFLICT (video_id, date_str) 
      DO UPDATE SET 
        title = EXCLUDED.title,
        thumbnail = EXCLUDED.thumbnail,
        analysis_json = EXCLUDED.analysis_json,
        view_count = EXCLUDED.view_count,
        like_count = EXCLUDED.like_count,
        comment_count = EXCLUDED.comment_count,
        description = EXCLUDED.description,
        comments = EXCLUDED.comments;
    `;
    return true;
  } catch (error) {
    console.error('Save video analysis error:', error);
    return false;
  }
}

export async function getVideoAnalyses(dateStr, category = null) {
  if (!isProd) {
    let results = (global.analysisDb || []).filter(item => item.date_str === dateStr);
    if (category) {
      results = results.filter(item => item.category === category);
    }
    return results;
  }

  try {
    if (category) {
      const { rows } = await sql`
        SELECT 
          platform, video_id as "videoId", url, title, thumbnail, category, 
          date_str as "dateStr", analysis_json as "analysisJson",
          view_count as "viewCount", like_count as "likeCount", 
          comment_count as "commentCount", description, comments
        FROM video_analyses 
        WHERE date_str = ${dateStr} AND category = ${category}
        ORDER BY created_at DESC;
      `;
      return rows;
    } else {
      const { rows } = await sql`
        SELECT 
          platform, video_id as "videoId", url, title, thumbnail, category, 
          date_str as "dateStr", analysis_json as "analysisJson",
          view_count as "viewCount", like_count as "likeCount", 
          comment_count as "commentCount", description, comments
        FROM video_analyses 
        WHERE date_str = ${dateStr}
        ORDER BY created_at DESC;
      `;
      return rows;
    }
  } catch (error) {
    console.error('Fetch video analyses error:', error);
    return [];
  }
}

export async function getPagedVideoAnalyses(category = null, page = 1, limit = 12) {
  const offset = (page - 1) * limit;

  if (!isProd) {
    let results = global.analysisDb || [];
    if (category) {
      results = results.filter(item => item.category === category);
    }
    const totalCount = results.length;
    results.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const pagedResults = results.slice(offset, offset + limit);
    return { rows: pagedResults, totalCount };
  }

  try {
    if (category) {
      const countRes = await sql`SELECT count(*) FROM video_analyses WHERE category = ${category}`;
      const count = countRes.rows[0].count;
      const { rows } = await sql`
        SELECT 
          platform, video_id as "videoId", url, title, thumbnail, category, 
          date_str as "dateStr", analysis_json as "analysisJson",
          view_count as "viewCount", like_count as "likeCount", 
          comment_count as "commentCount", description, comments
        FROM video_analyses 
        WHERE category = ${category}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
      return { rows, totalCount: parseInt(count, 10) };
    } else {
      const countRes = await sql`SELECT count(*) FROM video_analyses`;
      const count = countRes.rows[0].count;
      const { rows } = await sql`
        SELECT 
          platform, video_id as "videoId", url, title, thumbnail, category, 
          date_str as "dateStr", analysis_json as "analysisJson",
          view_count as "viewCount", like_count as "likeCount", 
          comment_count as "commentCount", description, comments
        FROM video_analyses 
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
      return { rows, totalCount: parseInt(count, 10) };
    }
  } catch (error) {
    console.error('Fetch paged video analyses error:', error);
    return { rows: [], totalCount: 0 };
  }
}
