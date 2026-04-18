import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PARENT_PAGE_ID = process.env.NOTION_PAGE_ID;

export async function POST(req) {
  try {
    const { product, startDate, endDate } = await req.json();

    if (!PARENT_PAGE_ID) {
      throw new Error('NOTION_PAGE_ID is not configured in .env.local');
    }

    const PRIORITY_KO = { high: '🔴 긴급', mid: '🟡 중요', low: '⚪ 검토' };

    const blocks = [
      {
        object: 'block', type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: `📊 ${product.brandName} ${product.productName}` } }] },
      },
      {
        object: 'block', type: 'callout',
        callout: {
          rich_text: [{ type: 'text', text: { content: `분석 기간: ${startDate} ~ ${endDate} | 생성일: ${new Date().toLocaleDateString('ko-KR')}` } }],
          icon: { emoji: '📅' }, color: 'blue_background',
        },
      },
      ...(product.summary ? [
        {
          object: 'block', type: 'quote',
          quote: { rich_text: [{ type: 'text', text: { content: `💡 핵심 진단: ${product.summary}` }, annotations: { italic: true } }] },
        },
      ] : []),
      { object: 'block', type: 'divider', divider: {} },

      // VoC 개선 액션플랜
      {
        object: 'block', type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: '🔧 VoC 기반 개선 액션플랜' } }] },
      },
      ...((product.vocImprovements || []).map(item => ({
        object: 'block', type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: `${PRIORITY_KO[item.priority] || item.priority} | ${item.issue} → ${item.suggestion}` } }],
        },
      }))),
      { object: 'block', type: 'divider', divider: {} },

      // USP
      {
        object: 'block', type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: '⭐ 핵심 소구포인트 (USP)' } }] },
      },
      ...((product.uspPoints || []).map((usp, i) => ({
        object: 'block', type: 'numbered_list_item',
        numbered_list_item: { rich_text: [{ type: 'text', text: { content: usp } }] },
      }))),
      { object: 'block', type: 'divider', divider: {} },

      // 카피라이트
      {
        object: 'block', type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: '📣 추천 광고 카피라이트' } }] },
      },
      ...((product.catchphrases || []).map((cp, i) => ({
        object: 'block', type: 'callout',
        callout: {
          rich_text: [{ type: 'text', text: { content: `COPY ${i + 1}: "${cp}"` }, annotations: { bold: true } }],
          icon: { emoji: '✍️' }, color: 'yellow_background',
        },
      }))),
      { object: 'block', type: 'divider', divider: {} },

      // 콘텐츠 아이디어
      {
        object: 'block', type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: '🎬 콘텐츠 제작 아이디어' } }] },
      },
      ...((product.contentIdeas || []).flatMap((idea, i) => [
        {
          object: 'block', type: 'heading_3',
          heading_3: { rich_text: [{ type: 'text', text: { content: `아이디어 ${i + 1} — [${idea.format}] ${idea.concept}` } }] },
        },
        {
          object: 'block', type: 'callout',
          callout: {
            rich_text: [{ type: 'text', text: { content: `🎯 후킹: ${idea.hook || '-'}` } }],
            icon: { emoji: '⚡' }, color: 'green_background',
          },
        },
        ...(idea.storyboard ? [{
          object: 'block', type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: `📋 콘티: ${idea.storyboard}` }, annotations: { color: 'gray' } }] },
        }] : []),
      ])),
    ];

    const response = await notion.pages.create({
      parent: { page_id: PARENT_PAGE_ID },
      icon: { type: 'emoji', emoji: '📊' },
      properties: {
        title: [{ type: 'text', text: { content: `[AI 리포트] ${product.brandName} ${product.productName} (${new Date().toLocaleDateString('ko-KR')})` } }],
      },
      children: blocks,
    });

    return NextResponse.json({ success: true, url: response.url });
  } catch (error) {
    console.error('Notion marketing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
