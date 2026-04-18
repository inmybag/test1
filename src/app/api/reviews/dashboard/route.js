import { NextResponse } from 'next/server';
import { getReviewDashboard, getTopAttributes, getReviewsByPeriod, initDb } from '@/lib/db';

export async function GET(request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const productIdsStr = searchParams.get('productIds');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!productIdsStr || !startDate || !endDate) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const productIds = productIdsStr.split(',').map(Number);

    // 대시보드 집계 데이터
    const dashboard = await getReviewDashboard(productIds, startDate, endDate);
    
    // TOP 속성 데이터 (제품별)
    const attributesByProduct = {};
    for (const pid of productIds) {
      attributesByProduct[pid] = await getTopAttributes([pid], startDate, endDate);
    }

    // 이전 기간 대비 증감률 계산
    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const prevEnd = new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
    const prevStart = new Date(new Date(prevEnd).getTime() - daysDiff * 86400000).toISOString().split('T')[0];
    const prevDashboard = await getReviewDashboard(productIds, prevStart, prevEnd);

    // 증감률 계산
    const dashboardWithGrowth = dashboard.map(item => {
      const prev = prevDashboard.find(p => p.productId === item.productId);
      const prevTotal = prev ? parseInt(prev.totalReviews) : 0;
      const currTotal = parseInt(item.totalReviews);
      const growthRate = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : (currTotal > 0 ? 100 : 0);
      
      return {
        ...item,
        growthRate,
        prevTotalReviews: prevTotal,
        topAttributes: attributesByProduct[item.productId] || { positive: [], negative: [] }
      };
    });

    return NextResponse.json({ data: dashboardWithGrowth });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
