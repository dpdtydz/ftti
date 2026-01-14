import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1x1 투명 픽셀 GIF (Base64)
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sendId = searchParams.get('id');
    const userId = searchParams.get('u');

    if (!sendId || !userId) {
      // 픽셀은 항상 반환
      return new NextResponse(PIXEL_GIF, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // 이미 오픈 이벤트가 있는지 확인 (중복 방지)
    const { data: existing } = await supabase
      .from('email_events')
      .select('id')
      .eq('newsletter_send_id', sendId)
      .eq('user_id', userId)
      .eq('event_type', 'opened')
      .single();

    if (!existing) {
      // 오픈 이벤트 기록
      await supabase.from('email_events').insert({
        newsletter_send_id: sendId,
        user_id: userId,
        event_type: 'opened',
        user_agent: req.headers.get('user-agent'),
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      });
    }

    // 1x1 투명 픽셀 반환
    return new NextResponse(PIXEL_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error tracking email open:', error);
    // 에러가 발생해도 픽셀은 반환
    return new NextResponse(PIXEL_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
