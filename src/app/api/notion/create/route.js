import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';
import { updateVideoNotionUrl } from '@/lib/db';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PARENT_PAGE_ID = process.env.NOTION_PAGE_ID;

export async function POST(req) {
  try {
    const data = await req.json();
    const { title, platform, category, score, hook, commentInsight, planning, url, thumbnail, videoId, dateStr } = data;

    if (!PARENT_PAGE_ID) {
      throw new Error('NOTION_PAGE_ID is not configured in .env.local');
    }

    // Parse Planning (including table)
    const blocks = parsePlanningToNotionBlocks(planning);

    const response = await notion.pages.create({
      parent: { page_id: PARENT_PAGE_ID },
      icon: { type: 'emoji', emoji: getPlatformEmoji(platform) },
      cover: thumbnail ? { type: 'external', external: { url: thumbnail } } : null,
      properties: {
        title: [
          {
            type: 'text',
            text: { content: `[분석] ${title} (${new Date().toLocaleDateString()})` },
          },
        ],
      },
      children: [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: [{ type: 'text', text: { content: '📊 비디오 분석 요약' } }] },
        },
        {
          object: 'block',
          type: 'video',
          video: {
            type: 'external',
            external: { url: url }
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [{ type: 'text', text: { content: `성공 지수: ${score} / 플랫폼: ${platform.toUpperCase()} / 카테고리: ${category}` } }],
            icon: { emoji: '🚀' },
            color: 'blue_background'
          }
        },
        {
          object: 'block',
          type: 'quote',
          quote: { rich_text: [{ type: 'text', text: { content: `원본 영상: ${url}` } }] },
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: '💡 Competitor Success Hack' } }] },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: hook }, annotations: { italic: true } }] },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: `💬 소비자 반응: ${commentInsight}` } }] },
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        ...blocks
      ],
    });

    if (videoId && dateStr) {
      await updateVideoNotionUrl(videoId, dateStr, response.url);
    }

    return NextResponse.json({ success: true, url: response.url });
  } catch (error) {
    console.error('Notion API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function getPlatformEmoji(platform) {
  switch (platform?.toLowerCase()) {
    case 'youtube': return '📽️';
    case 'instagram': return '📸';
    case 'tiktok': return '🎵';
    default: return '🎬';
  }
}

function parsePlanningToNotionBlocks(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const blocks = [];
  let tableRows = [];
  let isTable = false;

  for (let line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('---')) continue;
      isTable = true;
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (isTable) {
      if (tableRows.length > 0) {
        blocks.push(createNotionTableBlock(tableRows));
      }
      tableRows = [];
      isTable = false;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: trimmed.replace('## ', '') } }] }
      });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: trimmed.replace('### ', '') } }] }
      });
    } else if (trimmed.startsWith('- ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: trimmed.replace('- ', '') } }] }
      });
    } else if (trimmed.length > 0) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: trimmed } }] }
      });
    }
  }

  // Handle table at end of text
  if (isTable && tableRows.length > 0) {
    blocks.push(createNotionTableBlock(tableRows));
  }

  return blocks;
}

function createNotionTableBlock(rows) {
  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: rows[0].length,
      has_column_header: true,
      children: rows.map(row => ({
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: row.map(cell => [{ type: 'text', text: { content: cell } }])
        }
      }))
    }
  };
}
