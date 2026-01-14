import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Next.js 설정: 동적 라우트로 강제
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { sendId, userId, type, questionId, answer, rating, comment } = await req.json();

    if (!sendId || !userId || !type) {
      return NextResponse.json(
        { error: 'sendId, userId, and type are required' },
        { status: 400 }
      );
    }

    // 피드백 저장
    const { data, error } = await supabase
      .from('newsletter_feedback')
      .insert({
        newsletter_send_id: sendId,
        user_id: userId,
        feedback_type: type,
        question_id: questionId,
        answer,
        rating,
        comment
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      feedback: data
    });
  } catch (error: any) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// GET: 퀴즈/투표 링크 클릭 처리 (URL 파라미터로)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sendId = searchParams.get('id');
    const userId = searchParams.get('u');
    const type = searchParams.get('type'); // quiz, poll, rating
    const questionId = searchParams.get('q');
    const answer = searchParams.get('answer');
    const rating = searchParams.get('rating');

    if (!sendId || !userId || !type) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // 피드백 저장
    await supabase
      .from('newsletter_feedback')
      .insert({
        newsletter_send_id: sendId,
        user_id: userId,
        feedback_type: type,
        question_id: questionId,
        answer,
        rating: rating ? parseInt(rating) : null
      });

    // 감사 페이지로 리디렉션 또는 HTML 응답
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>감사합니다! - FTTI</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .card {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #667eea;
            margin: 0 0 1rem 0;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
          .emoji {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="emoji">🎉</div>
          <h1>감사합니다!</h1>
          <p>소중한 피드백을 주셔서 감사합니다.<br>더 나은 뉴스레터를 만드는데 큰 도움이 됩니다.</p>
        </div>
      </body>
      </html>
      `,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  } catch (error) {
    console.error('Error saving feedback:', error);
    return new NextResponse('Error saving feedback', { status: 500 });
  }
}
