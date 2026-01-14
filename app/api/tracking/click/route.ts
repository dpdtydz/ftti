import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sendId = searchParams.get('id');
    const userId = searchParams.get('u');
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'url parameter is required' },
        { status: 400 }
      );
    }

    // 클릭 이벤트 기록
    if (sendId && userId) {
      await supabase.from('email_events').insert({
        newsletter_send_id: sendId,
        user_id: userId,
        event_type: 'clicked',
        url: targetUrl,
        user_agent: req.headers.get('user-agent'),
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      });
    }

    // 원본 URL로 리디렉션
    return NextResponse.redirect(targetUrl);
  } catch (error) {
    console.error('Error tracking email click:', error);
    
    // 에러가 발생해도 리디렉션은 수행
    const targetUrl = new URL(req.url).searchParams.get('url');
    if (targetUrl) {
      return NextResponse.redirect(targetUrl);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
