import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Article {
  title: string;
  url: string;
  description?: string;
}

// 관심사별 소스 매핑
const SOURCE_MAP: Record<string, { type: 'yozm' | 'naver'; category: string }> = {
  '기술/IT': { type: 'yozm', category: 'develop' },
  '비즈니스': { type: 'yozm', category: 'business' },
  '자기계발': { type: 'yozm', category: 'career' },
  '경제': { type: 'naver', category: '경제' },
  '건강': { type: 'naver', category: '건강' },
  '스포츠': { type: 'naver', category: '스포츠' },
  '엔터테인먼트': { type: 'naver', category: '연예' },
  '과학': { type: 'naver', category: 'IT과학' },
  '음식/요리': { type: 'naver', category: '요리' },
  '여행': { type: 'naver', category: '여행' },
};

// 요즘IT 크롤링
async function fetchYozmArticles(category: string): Promise<Article[]> {
  try {
    const response = await fetch(`https://yozm.wishket.com/magazine/list/${category}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await response.text();
    
    const articles: Article[] = [];
    const seen = new Set();
    
    // 제목과 URL 추출
    const matches = html.matchAll(/href="(\/magazine\/detail\/(\d+)\/?)"[^>]*>[\s\S]*?<[^>]*>([^<]{10,})<\/[^>]*>/g);
    
    for (const match of matches) {
      if (articles.length >= 5) break;
      
      const url = 'https://yozm.wishket.com' + match[1];
      const title = match[3].trim().replace(/\s+/g, ' ');
      
      if (title && !seen.has(url) && !title.includes('\n')) {
        seen.add(url);
        articles.push({ title, url });
      }
    }
    
    return articles;
  } catch (error) {
    console.error('Yozm fetch error:', error);
    return [];
  }
}

// 네이버 뉴스 API
async function fetchNaverNews(query: string): Promise<Article[]> {
  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=5&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID!,
          'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET!,
        },
      }
    );
    
    const data = await response.json();
    
    return (data.items || []).map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"'),
      url: item.link,
      description: item.description.replace(/<[^>]*>/g, '').substring(0, 100),
    }));
  } catch (error) {
    console.error('Naver fetch error:', error);
    return [];
  }
}

// 관심사별 아티클 가져오기
async function fetchArticlesByInterest(interest: string): Promise<Article[]> {
  const source = SOURCE_MAP[interest];
  
  if (!source) {
    return fetchNaverNews(interest); // 기본값: 네이버 검색
  }
  
  if (source.type === 'yozm') {
    return fetchYozmArticles(source.category);
  } else {
    return fetchNaverNews(source.category + ' 오늘');
  }
}

// Gemini API로 뉴스레터 콘텐츠 생성
async function generateContent(
  interests: string[],
  articlesByInterest: Record<string, Article[]>
): Promise<string> {
  let articleInfo = '';
  
  for (const interest of interests) {
    const articles = articlesByInterest[interest] || [];
    if (articles.length > 0) {
      articleInfo += `\n[${interest}]\n`;
      articles.slice(0, 3).forEach((a, i) => {
        articleInfo += `${i + 1}. ${a.title}\n   URL: ${a.url}\n`;
      });
    }
  }

  const prompt = `당신은 개인화 뉴스레터 작성 전문가입니다.

사용자 관심사: ${interests.join(', ')}

오늘의 아티클:
${articleInfo}

아래 형식으로 뉴스레터를 HTML로 작성해주세요:

<h3>☕ 오늘의 한 줄</h3>
<p>"사용자 관심사와 관련된 영감을 주는 멋진 한 마디"</p>

<h3>📰 오늘의 추천</h3>
(각 관심사별로 1-2개 아티클 선택, 제목에 링크 걸기)
<ul>
<li><strong>[관심사]</strong> <a href="URL">아티클 제목</a><br/>💡 핵심 인사이트 한 줄</li>
</ul>

<h3>✅ 오늘의 액션</h3>
<ul>
<li>해볼 것 1</li>
<li>해볼 것 2</li>
</ul>

<h3>🎲 TMI</h3>
<p>재미있는 사실 또는 오늘 날짜 관련 정보</p>

규칙:
- 반드시 실제 아티클 URL을 사용할 것
- 각 관심사별로 최소 1개 이상 다룰 것
- 친근하고 읽기 쉬운 톤
- 전체 700자 내외`;

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
function createEmailTemplate(content: string, userName: string, interests: string[]) {
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
        .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
        .tags { margin-top: 15px; }
        .tag { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin: 2px; }
        .content { padding: 30px; }
        .content h3 { color: #6366f1; margin-top: 25px; margin-bottom: 10px; font-size: 18px; }
        .content ul { padding-left: 20px; }
        .content li { margin-bottom: 12px; }
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
          <p>${dateStr}</p>
          <div class="tags">
            ${interests.map(i => `<span class="tag">${i}</span>`).join(' ')}
          </div>
        </div>
        <div class="content">
          <p>안녕하세요, <strong>${userName}</strong>님! 👋</p>
          ${content}
        </div>
        <div class="footer">
          <p>FTTI - 편하게 받아보세요</p>
          <p><a href="https://ftti-umber.vercel.app/dashboard">설정 변경</a></p>
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

        // 관심사별 아티클 가져오기
        const articlesByInterest: Record<string, Article[]> = {};
        for (const interest of interests) {
          articlesByInterest[interest] = await fetchArticlesByInterest(interest);
        }

        const content = await generateContent(interests, articlesByInterest);
        const emailHtml = createEmailTemplate(content, user.nickname || '회원', interests);
        
        const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        const result = await sendEmail(
          user.email,
          user.nickname || '회원',
          `[FTTI] ${today} ${interests[0]} 외 ${interests.length - 1}개 소식 📬`,
          emailHtml
        );

        results.push({ email: user.email, interests, success: true, result });
      } catch (err) {
        results.push({ email: user.email, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ 
      message: `${results.length}명에게 발송 완료`,
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
