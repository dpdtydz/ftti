import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Gemini API로 콘텐츠 생성
async function generateContent(interests: string[]): Promise<string> {
  const prompt = `당신은 뉴스레터 작성 전문가입니다. 다음 관심사에 대한 오늘의 유용한 정보를 작성해주세요.

관심사: ${interests.join(', ')}

규칙:
- 각 관심사별로 2-3개의 흥미로운 정보나 팁을 제공
- 친근하고 읽기 쉬운 톤으로 작성
- 이모지를 적절히 사용
- 전체 길이는 500자 내외
- HTML 형식으로 작성 (p, ul, li, strong 태그 사용)`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '콘텐츠 생성 실패';
}

// Resend로 이메일 발송
async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'FTTI <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });

  return response.json();
}

// 이메일 템플릿
function createEmailTemplate(content: string, userName: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
        a { color: #6366f1; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📬 FTTI</h1>
        <p>오늘의 맞춤 뉴스레터</p>
      </div>
      <div class="content">
        <p>안녕하세요, <strong>${userName}</strong>님! 👋</p>
        ${content}
      </div>
      <div class="footer">
        <p>FTTI - 편하게 받아보세요</p>
        <p><a href="https://ftti-umber.vercel.app/dashboard">설정 변경하기</a></p>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: Request) {
  try {
    // API 키 확인 (간단한 보안)
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key');
    
    if (apiKey !== process.env.CRON_SECRET && apiKey !== 'test') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 활성 사용자 조회
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        nickname,
        user_interests (
          interests (
            name
          )
        )
      `)
      .eq('is_active', true);

    if (error) throw error;

    const results = [];

    for (const user of users || []) {
      try {
        // 관심사 추출
        const interests = user.user_interests?.map(
          (ui: any) => ui.interests?.name
        ).filter(Boolean) || [];

        if (interests.length === 0) continue;

        // 콘텐츠 생성
        const content = await generateContent(interests);

        // 이메일 발송
        const emailHtml = createEmailTemplate(content, user.nickname || '회원');
        const result = await sendEmail(
          user.email,
          `[FTTI] ${new Date().toLocaleDateString('ko-KR')} 맞춤 뉴스레터`,
          emailHtml
        );

        results.push({ email: user.email, success: true, result });
      } catch (err) {
        results.push({ email: user.email, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ 
      message: `${results.length}명에게 발송 완료`,
      results 
    });

  } catch (error) {
    console.error('Newsletter error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// 테스트용 GET
export async function GET() {
  return NextResponse.json({ 
    status: 'Newsletter API Ready',
    usage: 'POST /api/newsletter?key=test'
  });
}
