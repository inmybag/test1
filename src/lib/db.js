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

    // Add video_analyses table with unique(video_id)
    await sql`
      CREATE TABLE IF NOT EXISTS video_analyses (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        video_id TEXT NOT NULL UNIQUE,
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
        notion_url TEXT,
        is_sent_to_notion BOOLEAN DEFAULT FALSE
      );
    `;

    // Ensure all columns exist for video_analyses (Migration)
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS description TEXT;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]';`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS notion_url TEXT;`;
    await sql`ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS is_sent_to_notion BOOLEAN DEFAULT FALSE;`;

    // 리뷰 분석용 테이블
    await sql`
      CREATE TABLE IF NOT EXISTS review_products (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        page_url TEXT NOT NULL UNIQUE,
        brand_name TEXT NOT NULL,
        product_name TEXT NOT NULL,
        thumbnail_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES review_products(id) ON DELETE CASCADE,
        review_date TEXT NOT NULL,
        rating REAL,
        review_text TEXT,
        reviewer_nickname TEXT,
        extra_info JSONB DEFAULT '{}',
        media_urls JSONB DEFAULT '[]',
        sentiment TEXT,
        sentiment_score REAL,
        attributes JSONB DEFAULT '[]',
        source_highlight JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // product_reviews에 unique 인덱스 추가 (중복 방지)
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_review_unique
      ON product_reviews(product_id, review_date, COALESCE(reviewer_nickname, ''), LEFT(COALESCE(review_text, ''), 100));
    `;

    // AI 마케팅 리포트 캐시 테이블
    await sql`
      CREATE TABLE IF NOT EXISTS marketing_reports (
        id SERIAL PRIMARY KEY,
        report_key TEXT NOT NULL UNIQUE,
        product_ids TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        report_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

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
      ON CONFLICT (video_id) 
      DO UPDATE SET 
        title = EXCLUDED.title,
        thumbnail = EXCLUDED.thumbnail,
        analysis_json = EXCLUDED.analysis_json,
        view_count = EXCLUDED.view_count,
        like_count = EXCLUDED.like_count,
        comment_count = EXCLUDED.comment_count,
        description = EXCLUDED.description,
        comments = EXCLUDED.comments,
        notion_url = COALESCE(video_analyses.notion_url, EXCLUDED.notion_url),
        is_sent_to_notion = video_analyses.is_sent_to_notion;
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
          comment_count as "commentCount", description, comments,
          notion_url as "notionUrl", is_sent_to_notion as "isSentToNotion"
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
          comment_count as "commentCount", description, comments,
          notion_url as "notionUrl", is_sent_to_notion as "isSentToNotion"
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

export async function getPagedVideoAnalyses(category = null, page = 1, limit = 12, platform = null, tag = null) {
  const offset = (page - 1) * limit;

  if (!isProd) {
    let results = global.analysisDb || [];
    if (category && category !== 'All') {
      results = results.filter(item => item.category === category);
    }
    if (platform && platform !== 'All') {
      results = results.filter(item => item.platform === platform);
    }
    if (tag && tag !== 'All') {
      results = results.filter(item => item.analysis_json?.tags?.includes(tag));
    }
    const totalCount = results.length;
    results.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const pagedResults = results.slice(offset, offset + limit);
    return { rows: pagedResults, totalCount };
  }

  try {
    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    if (category && category !== 'All') {
      whereClauses.push(`category = $${paramIndex++}`);
      params.push(category);
    }
    if (platform && platform !== 'All') {
      whereClauses.push(`platform = $${paramIndex++}`);
      params.push(platform);
    }
    if (tag && tag !== 'All') {
      // JSONB containment operator (@>) to check if tags array contains the tag
      whereClauses.push(`analysis_json->'tags' @> $${paramIndex++}::jsonb`);
      params.push(JSON.stringify([tag]));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countRes = await sql.query(`SELECT count(*) FROM video_analyses ${whereSql}`, params);
    const count = countRes.rows[0].count;
    
    const dataRes = await sql.query(`
      SELECT 
        platform, video_id as "videoId", url, title, thumbnail, category, 
        date_str as "dateStr", analysis_json as "analysisJson",
        view_count as "viewCount", like_count as "likeCount", 
        comment_count as "commentCount", description, comments,
        notion_url as "notionUrl", is_sent_to_notion as "isSentToNotion"
      FROM video_analyses 
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);
    
    return { rows: dataRes.rows, totalCount: parseInt(count, 10) };
  } catch (error) {
    console.error('Fetch paged video analyses error:', error);
    return { rows: [], totalCount: 0 };
  }
}

export async function updateVideoNotionUrl(videoId, dateStr, notionUrl) {
  if (!isProd) {
    console.log('Mock Update Notion URL:', videoId, notionUrl);
    if (global.analysisDb) {
      const video = global.analysisDb.find(v => v.video_id === videoId);
      if (video) {
        video.notion_url = notionUrl;
        video.is_sent_to_notion = true;
      }
    }
    return true;
  }

  try {
    // We update is_sent_to_notion as well when notion_url is updated.
    // dateStr is no longer strictly needed for uniqueness but kept for API compatibility.
    await sql`
      UPDATE video_analyses 
      SET notion_url = ${notionUrl}, is_sent_to_notion = TRUE
      WHERE video_id = ${videoId};
    `;
    return true;
  } catch (error) {
    console.error('Update notion url error:', error);
    return false;
  }
}

// =============================================
// 리뷰 분석 관련 함수들
// =============================================

export async function addReviewProduct(platform, pageUrl, brandName, productName, thumbnailUrl = null) {
  if (!isProd) {
    global.reviewProductsDb = global.reviewProductsDb || [];
    const id = global.reviewProductsDb.length + 1;
    global.reviewProductsDb.push({ id, platform, page_url: pageUrl, brand_name: brandName, product_name: productName, thumbnail_url: thumbnailUrl, is_active: true, created_at: new Date().toISOString() });
    return { id };
  }
  try {
    const { rows } = await sql`
      INSERT INTO review_products (platform, page_url, brand_name, product_name, thumbnail_url)
      VALUES (${platform}, ${pageUrl}, ${brandName}, ${productName}, ${thumbnailUrl})
      ON CONFLICT (page_url) DO UPDATE SET
        brand_name = EXCLUDED.brand_name,
        product_name = EXCLUDED.product_name,
        thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, review_products.thumbnail_url)
      RETURNING id;
    `;
    return rows[0];
  } catch (error) {
    console.error('Add review product error:', error);
    return null;
  }
}

export async function deleteReviewProduct(id) {
  if (!isProd) {
    global.reviewProductsDb = (global.reviewProductsDb || []).filter(p => p.id !== id);
    global.productReviewsDb = (global.productReviewsDb || []).filter(r => r.product_id !== id);
    return true;
  }
  try {
    await sql`DELETE FROM review_products WHERE id = ${id};`;
    return true;
  } catch (error) {
    console.error('Delete review product error:', error);
    return false;
  }
}

export async function getReviewProducts() {
  if (!isProd) {
    return global.reviewProductsDb || [];
  }
  try {
    const { rows } = await sql`
      SELECT id, platform, page_url as "pageUrl", brand_name as "brandName", 
             product_name as "productName", thumbnail_url as "thumbnailUrl",
             created_at as "createdAt", is_active as "isActive"
      FROM review_products 
      WHERE is_active = TRUE
      ORDER BY created_at DESC;
    `;
    return rows;
  } catch (error) {
    console.error('Get review products error:', error);
    return [];
  }
}

export async function saveProductReviews(reviews) {
  if (!isProd) {
    global.productReviewsDb = global.productReviewsDb || [];
    for (const r of reviews) {
      const exists = global.productReviewsDb.find(
        e => e.product_id === r.product_id && e.review_date === r.review_date && e.reviewer_nickname === r.reviewer_nickname
      );
      if (!exists) global.productReviewsDb.push({ id: global.productReviewsDb.length + 1, ...r, created_at: new Date().toISOString() });
    }
    return true;
  }
  try {
    for (const r of reviews) {
      await sql`
        INSERT INTO product_reviews (
          product_id, review_date, rating, review_text, reviewer_nickname,
          extra_info, media_urls, sentiment, sentiment_score, attributes, source_highlight
        )
        VALUES (
          ${r.product_id}, ${r.review_date}, ${r.rating}, ${r.review_text}, ${r.reviewer_nickname},
          ${JSON.stringify(r.extra_info || {})}, ${JSON.stringify(r.media_urls || [])},
          ${r.sentiment}, ${r.sentiment_score}, ${JSON.stringify(r.attributes || [])},
          ${JSON.stringify(r.source_highlight || [])}
        )
        ON CONFLICT ON CONSTRAINT idx_review_unique 
        DO UPDATE SET 
          media_urls = EXCLUDED.media_urls,
          extra_info = EXCLUDED.extra_info,
          attributes = EXCLUDED.attributes,
          source_highlight = EXCLUDED.source_highlight,
          rating = EXCLUDED.rating;
      `;
    }
    return true;
  } catch (error) {
    console.error('Save product reviews error:', error);
    return false;
  }
}

export async function getReviewDashboard(productIds, startDate, endDate) {
  if (!isProd) return [];
  try {
    const ids = productIds.join(',');
    const { rows } = await sql.query(`
      SELECT
        rp.id as "productId",
        rp.brand_name as "brandName",
        rp.product_name as "productName",
        rp.thumbnail_url as "thumbnailUrl",
        COUNT(pr.id) as "totalReviews",
        COUNT(CASE WHEN pr.sentiment = 'positive' THEN 1 END) as "positiveCount",
        COUNT(CASE WHEN pr.sentiment = 'negative' THEN 1 END) as "negativeCount",
        COUNT(CASE WHEN pr.sentiment = 'neutral' THEN 1 END) as "neutralCount",
        ROUND(AVG(pr.rating)::numeric, 1) as "avgRating",
        (SELECT COUNT(*) FROM product_reviews WHERE product_id = rp.id AND review_date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')) as "todayCount",
        (SELECT COUNT(*) FROM product_reviews WHERE product_id = rp.id) as "allTimeCount"
      FROM review_products rp
      LEFT JOIN product_reviews pr ON rp.id = pr.product_id
        AND pr.review_date >= $1 AND pr.review_date <= $2
      WHERE rp.id = ANY($3::int[])
      GROUP BY rp.id, rp.brand_name, rp.product_name, rp.thumbnail_url
    `, [startDate, endDate, productIds]);
    return rows;
  } catch (error) {
    console.error('Get review dashboard error:', error);
    return [];
  }
}

export async function getReviewsByPeriod(productIds, startDate, endDate) {
  if (!isProd) return [];
  try {
    const { rows } = await sql.query(`
      SELECT 
        pr.review_date as "reviewDate",
        rp.id as "productId",
        rp.product_name as "productName",
        COUNT(pr.id) as "count",
        COUNT(CASE WHEN pr.sentiment = 'positive' THEN 1 END) as "positiveCount",
        COUNT(CASE WHEN pr.sentiment = 'negative' THEN 1 END) as "negativeCount",
        COUNT(CASE WHEN pr.sentiment = 'neutral' THEN 1 END) as "neutralCount"
      FROM product_reviews pr
      JOIN review_products rp ON rp.id = pr.product_id
      WHERE rp.id = ANY($1::int[]) AND pr.review_date >= $2 AND pr.review_date <= $3
      GROUP BY pr.review_date, rp.id, rp.product_name
      ORDER BY pr.review_date ASC
    `, [productIds, startDate, endDate]);
    return rows;
  } catch (error) {
    console.error('Get reviews by period error:', error);
    return [];
  }
}

export async function getReviewsWithDetails(productIds, startDate, endDate, sentiment = null, attribute = null, page = 1) {
  if (!isProd) return [];
  try {
    let query = `
      SELECT 
        pr.id, pr.review_date as "reviewDate", pr.rating, pr.review_text as "reviewText",
        pr.reviewer_nickname as "reviewerNickname", pr.extra_info as "extraInfo",
        pr.media_urls as "mediaUrls", pr.sentiment, pr.sentiment_score as "sentimentScore",
        pr.attributes, pr.source_highlight as "sourceHighlight",
        rp.id as "productId", rp.product_name as "productName", rp.brand_name as "brandName", rp.platform as "platform"
      FROM product_reviews pr
      JOIN review_products rp ON rp.id = pr.product_id
      WHERE rp.id = ANY($1::int[]) AND pr.review_date >= $2 AND pr.review_date <= $3
    `;
    const params = [productIds, startDate, endDate];
    let paramIdx = 4;

    if (sentiment) {
      query += ` AND pr.sentiment = $${paramIdx++}`;
      params.push(sentiment);
    }
    if (attribute) {
      const attrList = attribute.split(',');
      query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements(pr.attributes) as attr WHERE attr->>'name' = ANY($${paramIdx++}::text[]))`;
      params.push(attrList);
    }
    
    // 페이지네이션 적용 (10건씩)
    const limit = 10;
    const offset = (page - 1) * limit;
    query += ` ORDER BY pr.review_date DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const { rows } = await sql.query(query, params);
    return rows;
  } catch (error) {
    console.error('Get reviews with details error:', error);
    return [];
  }
}

export async function getAttributeStats(productIds, startDate, endDate, sentiment = null) {
  if (!isProd) return [];
  try {
    let query = `
      SELECT
        attr->>'name' as "attributeName",
        attr->>'sentiment' as "sentiment",
        COUNT(*) as "count"
      FROM product_reviews pr
      JOIN review_products rp ON rp.id = pr.product_id,
        jsonb_array_elements(pr.attributes) as attr
      WHERE rp.id = ANY($1::int[]) AND pr.review_date >= $2 AND pr.review_date <= $3
    `;
    const params = [productIds, startDate, endDate];
    let paramIdx = 4;

    if (sentiment) {
      query += ` AND attr->>'sentiment' = $${paramIdx++}`;
      params.push(sentiment);
    }

    query += ` GROUP BY attr->>'name', attr->>'sentiment' ORDER BY "count" DESC`;

    const { rows } = await sql.query(query, params);
    return rows;
  } catch (error) {
    console.error('Get attribute stats error:', error);
    return [];
  }
}

export async function getTopAttributes(productIds, startDate, endDate) {
  if (!isProd) return { positive: [], negative: [] };
  try {
    const { rows: positive } = await sql.query(`
      SELECT
        attr->>'name' as "name",
        COUNT(*) as "count"
      FROM product_reviews pr
      JOIN review_products rp ON rp.id = pr.product_id,
        jsonb_array_elements(pr.attributes) as attr
      WHERE rp.id = ANY($1::int[]) AND pr.review_date >= $2 AND pr.review_date <= $3
        AND attr->>'sentiment' = 'positive'
      GROUP BY attr->>'name'
      ORDER BY "count" DESC
      LIMIT 5
    `, [productIds, startDate, endDate]);

    const { rows: negative } = await sql.query(`
      SELECT
        attr->>'name' as "name",
        COUNT(*) as "count"
      FROM product_reviews pr
      JOIN review_products rp ON rp.id = pr.product_id,
        jsonb_array_elements(pr.attributes) as attr
      WHERE rp.id = ANY($1::int[]) AND pr.review_date >= $2 AND pr.review_date <= $3
        AND attr->>'sentiment' = 'negative'
      GROUP BY attr->>'name'
      ORDER BY "count" DESC
      LIMIT 5
    `, [productIds, startDate, endDate]);

    return { positive, negative };
  } catch (error) {
    console.error('Get top attributes error:', error);
    return { positive: [], negative: [] };
  }
}

export async function getAttributeStatsByProduct(productIds, startDate, endDate) {
  if (!isProd) return [];
  try {
    const { rows } = await sql.query(`
      SELECT
        rp.id as "productId",
        rp.product_name as "productName",
        rp.brand_name as "brandName",
        attr->>'name' as "attributeName",
        attr->>'sentiment' as "sentiment",
        COUNT(*) as "count"
      FROM product_reviews pr
      JOIN review_products rp ON rp.id = pr.product_id,
        jsonb_array_elements(pr.attributes) as attr
      WHERE rp.id = ANY($1::int[]) AND pr.review_date >= $2 AND pr.review_date <= $3
      GROUP BY rp.id, rp.product_name, rp.brand_name, attr->>'name', attr->>'sentiment'
      ORDER BY rp.id, COUNT(*) DESC
    `, [productIds, startDate, endDate]);
    return rows;
  } catch (error) {
    console.error('Get attribute stats by product error:', error);
    return [];
  }
}

export async function getMarketingReport(reportKey) {
  if (!isProd) return null;
  try {
    const { rows } = await sql.query(
      `SELECT report_data, updated_at FROM marketing_reports WHERE report_key = $1`,
      [reportKey]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Get marketing report error:', error);
    return null;
  }
}

export async function saveMarketingReport(reportKey, productIds, startDate, endDate, reportData) {
  if (!isProd) return;
  try {
    await sql.query(
      `INSERT INTO marketing_reports (report_key, product_ids, start_date, end_date, report_data, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (report_key)
       DO UPDATE SET report_data = EXCLUDED.report_data, updated_at = NOW()`,
      [reportKey, productIds, startDate, endDate, JSON.stringify(reportData)]
    );
  } catch (error) {
    console.error('Save marketing report error:', error);
  }
}
