/**
 * 마케팅 리포트 캐시 마이그레이션
 * 구 키 형식: "pid1,pid2|startDate|endDate"  →  신 키: "pid" (제품별 독립)
 * 구 report_data: { products: [...] }         →  신 data: 제품 객체 직접 저장
 *
 * 사용법: node scripts/migrate-marketing-reports.js
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { createPool } = require('@vercel/postgres');

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

async function migrate() {
  console.log('[마이그레이션] marketing_reports 캐시 키 마이그레이션 시작...\n');

  // 1. 구 형식 레코드 조회 (키에 '|' 포함)
  const { rows: oldRows } = await pool.query(
    `SELECT id, report_key, product_ids, start_date, end_date, report_data, updated_at
     FROM marketing_reports
     WHERE report_key LIKE '%|%'
     ORDER BY updated_at DESC`
  );

  console.log(`[마이그레이션] 구 형식 레코드 ${oldRows.length}건 발견\n`);

  if (oldRows.length === 0) {
    console.log('[마이그레이션] 마이그레이션할 데이터가 없습니다.');
    await pool.end();
    return;
  }

  const allStart = '2020-01-01';
  const allEnd = new Date().toISOString().slice(0, 10);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const row of oldRows) {
    const reportData = row.report_data;
    const products = reportData?.products;

    if (!Array.isArray(products) || products.length === 0) {
      console.log(`  [스킵] key=${row.report_key} — products 배열 없음`);
      skippedCount++;
      continue;
    }

    for (const product of products) {
      const pid = product.productId;
      if (!pid) {
        console.log(`  [스킵] productId 없는 제품: ${product.productName}`);
        skippedCount++;
        continue;
      }

      const newKey = String(pid);

      // 신 키로 이미 존재하면 스킵 (더 최신 데이터 보존)
      const { rows: existing } = await pool.query(
        `SELECT id, updated_at FROM marketing_reports WHERE report_key = $1`,
        [newKey]
      );

      if (existing.length > 0) {
        const existingUpdatedAt = new Date(existing[0].updated_at);
        const oldUpdatedAt = new Date(row.updated_at);
        if (existingUpdatedAt >= oldUpdatedAt) {
          console.log(`  [스킵] pid=${pid} (${product.productName}) — 신 키 이미 존재 (더 최신)`);
          skippedCount++;
          continue;
        }
      }

      // 신 형식으로 저장 (report_data = 제품 객체 직접)
      await pool.query(
        `INSERT INTO marketing_reports (report_key, product_ids, start_date, end_date, report_data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (report_key)
         DO UPDATE SET report_data = EXCLUDED.report_data, updated_at = EXCLUDED.updated_at`,
        [newKey, newKey, allStart, allEnd, JSON.stringify(product), row.updated_at]
      );

      console.log(`  [완료] pid=${pid} (${product.brandName} ${product.productName}) → key="${newKey}"`);
      migratedCount++;
    }
  }

  console.log(`\n[마이그레이션] 완료: 성공 ${migratedCount}건, 스킵 ${skippedCount}건`);

  // 2. 구 형식 레코드 삭제
  if (migratedCount > 0) {
    const { rowCount } = await pool.query(
      `DELETE FROM marketing_reports WHERE report_key LIKE '%|%'`
    );
    console.log(`[마이그레이션] 구 형식 레코드 ${rowCount}건 삭제 완료`);
  }

  await pool.end();
  console.log('\n[마이그레이션] 전체 완료 ✓');
}

migrate().catch(err => {
  console.error('[마이그레이션] 오류:', err);
  process.exit(1);
});
