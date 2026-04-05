import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';
import { updateVideoNotionUrl } from '@/lib/db';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(req) {
  try {
    const data = await req.json();
    const { videoId, dateStr, notionUrl } = data;

    if (!notionUrl) {
      return NextResponse.json({ isValid: false });
    }

    // Extract Notion Page ID (last 32 characters in Notion URL)
    const pageId = extractNotionId(notionUrl);
    
    if (!pageId) {
      return NextResponse.json({ isValid: false });
    }

    try {
      // Check if page exists in Notion
      await notion.pages.retrieve({ page_id: pageId });
      
      return NextResponse.json({ isValid: true });
    } catch (notionError) {
      // If error is 404 (Not Found) or 403 (Forbidden - likely trash/deleted)
      if (notionError.status === 404 || notionError.status === 403) {
        console.log(`Notion page ${pageId} not found. Updating DB to null.`);
        
        // Update DB to null to allow re-sending
        if (videoId && dateStr) {
          await updateVideoNotionUrl(videoId, dateStr, null);
        }
        
        return NextResponse.json({ isValid: false });
      }
      
      // Other errors (rate limiting, etc.) - assume valid for now to avoid accidental deletions
      throw notionError;
    }
  } catch (error) {
    console.error('Notion Validation Error:', error);
    return NextResponse.json({ isValid: true, error: error.message });
  }
}

function extractNotionId(url) {
  if (!url) return null;
  // Notion IDs are 32 chars long (without hyphens usually in URLs)
  // Example: https://www.notion.so/Page-Name-339f0b132b3c81fba712c2bf2af8d4d0
  const match = url.match(/[a-f0-9]{32}/);
  return match ? match[0] : null;
}
