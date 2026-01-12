import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 요즘IT 크롤링
async function fetchYozmArticles(): Promise<{ title: string; url: string; category: string }[]> {
  try {
    const response = await fetch('https://yozm.wishket.com/magazine/list/develop/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await response.text();
    
    // 간단한 파싱으로 아티클 추출
    const articles: { title: string; url: string; category: string }[] = [];
    const regex = /<a[^>]*href="(\/magazine\/detail\/\d+\/?)"[^>]*>([^<]*)<\/a>/g;
    const titleRegex = /\[([^\]]+)\]\s*(.+)/;
    
    let match;
    const seen = new Set();
    
    while ((match = regex.exec(html)) !== null && articles.length < 5) {
      const url = 'https://yozm.wishket.com' + match[1];
      const title = match[2].trim();
      
      if (title && title.length > 10 && !seen.has(url)) {
        seen.add(url);
        articles.push({ title, url, category: '개발' });
      }
    }
    
    return articles;
  } catch (error) {
    console.error('Yozm fetch error:', error);
    return [];
  }
}

// Gemini API로 뉴스레터 콘텐츠 생성
async function generateContent(interests: string[], articles: { title: string; url: string }[]): Promise<string> {
  const articleList = articles.map((a, i) => `${i + 1}. ${a.title} (${a.url})`).join('\n');
  
  const prompt = `당신은 IT 뉴스레터 작성 전문가입니다.

사용자 관심사: ${interests.join(', ')}

오늘의 요즘IT 아티클:
${articleList}

아래 형식으로 뉴스레터를 작성해주세요:

1. "☕ 오늘의 한 줄" - IT/개발 관련 영감을 주는 멋진 한 마디 (직접 작성)

2. "📰 오늘의 추천 아티클" - 위 아티클 중 3개를 골라서:
   - 제목과 링크
   - 핵심 인사이트 1줄 (💡 아이콘과 함께)
   - 사용자 관심사와 연관지어 선택

3. "✅ 오늘의 액션" - 오늘 해볼 만한 것 2-3개 (구체적으로)

4. "🎲 TMI" - 재미있는 IT 관련 사실 또는 오늘 날짜 관련 정보

HTML 형식으로 작성 (h3, p, ul, li, a, strong 태그 사용)
전체 길이는 600자 내외로 간결하게`;

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

// Brevo로 이메일 발송
async function sendEmail(to: string, toName: string, subject: string, html: string) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: { name: 'FTTI', email: 'lhs41977@gmail.com' },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });

  return response.json();
}

// 이메일 템플릿
function createEmailTemplate(content: string, userName: string) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .container { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .content h3 { color: #6366f1; margin-top: 25px; margin-bottom: 10px; font-size: 18px; }
        .content ul { padding-left: 20px; }
        .content li { margin-bottom: 8px; }
        .content a { color: #6366f1; text-decoration: none; font-weight: 500; }
        .content a:hover { text-decoration: underline; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; }
        .footer a { color: #6366f1; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📬 FTTI</h1>
          <p>${dateStr} | ${userName}님의 맞춤 뉴스레터</p>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>FTTI - 편하게 받아보세요</p>
          <p><a href="https://ftti-umber.vercel.app/dashboard">설정 변경</a> | <a href="https://yozm.wishket.com">요즘IT 방문하기</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key');
    const targetTime = searchParams.get('time');
    
    if (apiKey !== process.env.CRON_SECRET && apiKey !== 'test') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 요즘IT 아티클 가져오기
    const articles = await fetchYozmArticles();

    // 활성 사용자 조회
    let query = supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        nickname,
        send_time,
        user_interests (
          interests (
            name
          )
        )
      `)
      .eq('is_active', true);

    if (targetTime) {
      query = query.eq('send_time', targetTime + ':00');
    }

    const { data: users, error } = await query;

    if (error) throw error;

    const results = [];

    for (const user of users || []) {
      try {
        const interests = user.user_interests?.map(
          (ui: any) => ui.interests?.name
        ).filter(Boolean) || [];

        if (interests.length === 0) continue;

        const content = await generateContent(interests, articles);
        const emailHtml = createEmailTemplate(content, user.nickname || '회원');
        
        const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        const result = await sendEmail(
          user.email,
          user.nickname || '회원',
          `[FTTI] ${today} 오늘의 IT 인사이트 📬`,
          emailHtml
        );

        results.push({ email: user.email, success: true, result });
      } catch (err) {
        results.push({ email: user.email, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ 
      message: `${results.length}명에게 발송 완료`,
      articlesFound: articles.length,
      targetTime: targetTime || 'all',
      results 
    });

  } catch (error) {
    console.error('Newsletter error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Newsletter API Ready',
    usage: 'POST /api/newsletter?key=test&time=07:00'
  });
}
