import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { productId } = body;
    
    // 수동 크롤링은 서버에서 스크립트를 직접 실행하는 방식
    // 여기서는 API 상태만 반환 (실제 크롤링은 cron job이 담당)
    return NextResponse.json({ 
      message: '크롤링 요청이 접수되었습니다. 스케줄된 배치잡에서 데이터가 수집됩니다.',
      productId 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
