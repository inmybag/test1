import { NextResponse } from 'next/server';
import { addReviewProduct, deleteReviewProduct, getReviewProducts, initDb } from '@/lib/db';
import { spawn } from 'child_process';
import fs from 'fs';

// 플랫폼 자동 감지
function detectPlatform(url) {
  if (url.includes('oliveyoung.co.kr')) return 'oliveyoung';
  if (url.includes('smartstore.naver.com') || url.includes('brand.naver.com') || url.includes('shopping.naver.com')) return 'naver';
  // 카페24는 다양한 도메인 가능
  return 'cafe24';
}

export async function GET() {
  try {
    await initDb();
    const products = await getReviewProducts();
    return NextResponse.json({ data: products });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await initDb();
    const body = await request.json();
    const { pageUrl, brandName, productName, thumbnailUrl, secretKey } = body;
    
    if (secretKey !== 'youngje') {
      return NextResponse.json({ error: '인증 코드가 올바르지 않습니다.' }, { status: 401 });
    }
    
    if (!pageUrl || !brandName || !productName) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const platform = detectPlatform(pageUrl);
    const result = await addReviewProduct(platform, pageUrl, brandName, productName, thumbnailUrl || null);
    
    if (result) {
      // 백그라운드로 30일치 데이터 수집 크롤러 실행
      try {
        const logPath = `${process.cwd()}/scripts/backfill_${result.id}.log`;
        const child = spawn(
          process.execPath, // 'node' 대신 현재 실행 중인 Node 바이너리 절대경로 사용
          ['scripts/crawl-reviews-backfill.js', String(result.id)],
          {
            cwd: process.cwd(),
            detached: true,
            stdio: ['ignore', fs.openSync(logPath, 'a'), fs.openSync(logPath, 'a')],
            env: process.env, // 현재 환경변수 그대로 전달 (.env.local 포함)
          }
        );
        child.unref();
        console.log(`[백필] 제품 ${result.id} 크롤러 시작 (PID: ${child.pid}), 로그: ${logPath}`);
      } catch (e) {
        console.error('크롤러 백그라운드 실행 오류:', e);
      }
      return NextResponse.json({ data: result, message: '제품이 등록되었습니다. 리뷰 수집을 시작합니다.' });
    }
    return NextResponse.json({ error: '등록에 실패했습니다.' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id'));
    
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const result = await deleteReviewProduct(id);
    if (result) {
      return NextResponse.json({ message: '제품 및 관련 리뷰가 삭제되었습니다.' });
    }
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
