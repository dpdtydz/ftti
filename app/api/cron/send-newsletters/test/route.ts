// app/api/cron/send-newsletters/test/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getNewsletterGenerator } from '@/app/lib/newsletter-generator';
import type { NewsArticle } from '@/app/lib/newsletter-generator';

// Next.js 설정
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Supabase 클라이언트 생성 함수
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    // 쿼리 파라미터에서 time 추출
    const { searchParams } = new URL(request.url);
    const timeParam = searchParams.get('time');
    
    // 현재 한국 시간 계산
    const now = new Date();
    const kstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentHour = String(kstTime.getHours()).padStart(2, '0');
    const currentMinute = String(kstTime.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}:00`;
    
    // 필터링할 시간 결정 (파라미터 우선, 없으면 현재 시간)
    const targetTime = timeParam ? `${timeParam}:00` : currentTime;
    
    console.log('🧪 테스트 모드: 뉴스레터 발송 시작');
    console.log('⏰ 현재 시간(KST):', kstTime.toLocaleString('ko-KR'));
    console.log('🎯 필터링 시간:', targetTime);

    // Supabase 클라이언트 초기화
    const supabase = getSupabaseClient();

    // 1. 활성 사용자 조회 + send_time 필터링 (테스트: 최대 3명만)
    const { data: users, error: usersError } = await supabase
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
      .eq('is_active', true)
      .eq('send_time', targetTime)
      .limit(3);

    if (usersError) {
      console.error('❌ 사용자 조회 실패:', usersError);
      throw usersError;
    }

    // 관심사가 없는 사용자 필터링
    const activeUsers = (users || []).filter(user => {
      const interests = user.user_interests?.map((ui: any) => ui.interests?.name).filter(Boolean) || [];
      return interests.length > 0;
    });

    console.log(`📊 테스트 발송 대상: ${activeUsers.length}명 (최대 3명, send_time=${targetTime})`);

    if (activeUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: `send_time이 ${targetTime}인 발송 대상 사용자가 없습니다`,
        sent: 0,
        mode: 'test',
        targetTime
      });
    }

    const generator = getNewsletterGenerator();
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    // 2. 각 사용자별 처리
    for (const user of activeUsers) {
      try {
        const interests = user.user_interests?.map((ui: any) => ui.interests?.name).filter(Boolean) || [];

        console.log(`\n📧 처리 중: ${user.email} (${interests.join(', ')})`);
        console.log(`   ⏰ send_time: ${user.send_time}`);

        const sections = [];
        
        for (const interest of interests) {
          console.log(`\n📰 [${interest}] 뉴스 수집 중...`);

          let articles: NewsArticle[] = [];
          const isITRelated = isITKeyword(interest);

          if (isITRelated) {
            // IT: GeekNews 1개 + 네이버 2개 + GitHub Trending 1개
            console.log('  🔍 IT 전문 뉴스 수집...');
            
            const [geekArticles, naverArticles, githubArticle] = await Promise.all([
              fetchGeekNews(),
              fetchNaverNews(interest),
              fetchGitHubTrending()
            ]);
            
            articles = [
              ...geekArticles.slice(0, 1),
              ...naverArticles.slice(0, 2),
              ...(githubArticle ? [githubArticle] : [])
            ];
            
            console.log(`  ✅ GeekNews: ${geekArticles.length}개, 네이버: ${naverArticles.length}개, GitHub: ${githubArticle ? 1 : 0}개`);
          } else {
            // 일반: 네이버 3개
            const naverArticles = await fetchNaverNews(interest);
            articles = naverArticles.slice(0, 3);
            console.log(`  ✅ 네이버: ${articles.length}개`);
          }

          if (articles.length === 0) {
            console.log(`  ⚠️ ${interest}: 뉴스 없음, 스킵`);
            continue;
          }

          const result = await generator.generate(interest, articles);

          sections.push({
            interest,
            newsletter: result.newsletter,
            trustScore: result.validation.trustScore
          });

          console.log(`  ✅ ${interest} 생성 완료 (신뢰도: ${result.validation.trustScore}점)`);
        }

        if (sections.length === 0) {
          console.log('⚠️ 생성된 섹션 없음, 스킵');
          results.skipped++;
          continue;
        }

        await sendEmail({
          to: user.email,
          userName: user.nickname || user.email.split('@')[0],
          sections,
          userId: user.id
        });

        try {
          await supabase.from('newsletter_sends').insert({
            user_id: user.id,
            subject: getSubjectLine(sections),
            content: { sections },
            trust_score: Math.round(sections.reduce((sum, s) => sum + s.trustScore, 0) / sections.length),
            engines_used: ['Groq Llama 3.1 8B', 'Gemini 2.0 Flash', 'Groq Llama 3.3 70B'],
            processing_time: 0,
            sent_at: new Date().toISOString(),
            status: 'sent'
          });
        } catch (error) {
          console.warn('⚠️ 발송 기록 저장 실패:', error);
        }

        results.success++;
        console.log(`✅ 발송 성공: ${user.email}`);
        await sleep(1000);

      } catch (error) {
        console.error(`❌ 실패: ${user.email}`, error);
        results.failed++;
      }
    }

    console.log('\n📊 테스트 발송 완료:');
    console.log(`   - 성공: ${results.success}건`);
    console.log(`   - 실패: ${results.failed}건`);
    console.log(`   - 스킵: ${results.skipped}건`);

    return NextResponse.json({
      success: true,
      ...results,
      total: activeUsers.length,
      mode: 'test',
      targetTime,
      message: `✅ 테스트 발송 완료! send_time=${targetTime} 사용자에게 발송되었습니다.`
    });

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        mode: 'test'
      },
      { status: 500 }
    );
  }
}

function isITKeyword(interest: string): boolean {
  const itKeywords = [
    'IT', 'it', '기술', '개발', 'AI', 'AI/ML', '인공지능',
    '프로그래밍', '소프트웨어', '하드웨어', '클라우드',
    'DevOps', '데이터', '보안', '네트워크'
  ];
  return itKeywords.some(keyword => interest.includes(keyword));
}

/**
 * GeekNews RSS 크롤링
 */
async function fetchGeekNews(): Promise<NewsArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://news.hada.io/rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`  ❌ GeekNews HTTP 오류: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const items: NewsArticle[] = [];
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null && items.length < 5) {
      const itemXml = match[1];
      
      let title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] 
                || itemXml.match(/<title>(.*?)<\/title>/)?.[1] 
                || '';
      
      let link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      
      let description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
                     || itemXml.match(/<description>(.*?)<\/description>/)?.[1]
                     || '';
      
      title = title.replace(/<[^>]*>/g, '').trim();
      const cleanDescription = description.replace(/<[^>]*>/g, '').trim().substring(0, 200);

      if (title && link) {
        items.push({
          title,
          description: cleanDescription,
          link,
          source: 'GeekNews',
          pubDate: new Date().toISOString()
        });
      }
    }

    console.log(`  📡 GeekNews: ${items.length}개 수집`);
    return items;

  } catch (error) {
    console.error('  ❌ GeekNews 실패:', error);
    return [];
  }
}

/**
 * GitHub Trending - 최근 인기 프로젝트 (한 줄 설명)
 */
async function fetchGitHubTrending(): Promise<NewsArticle | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // GitHub Trending API (비공식)
    const response = await fetch('https://api.gitterapp.com/repositories?language=&since=daily', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`  ❌ GitHub Trending HTTP 오류: ${response.status}`);
      return null;
    }

    const repos = await response.json();
    
    if (!Array.isArray(repos) || repos.length === 0) {
      return null;
    }

    // 포크 수 기준 정렬 (최근 + 인기)
    const sortedRepos = repos
      .filter((r: any) => r.forks > 100) // 최소 100개 이상
      .sort((a: any, b: any) => b.forks - a.forks);

    if (sortedRepos.length === 0) {
      return null;
    }

    const topRepo = sortedRepos[0];
    
    // 한 줄 설명 생성
    const oneLiner = `${topRepo.name}: ${topRepo.description || '인기 급상승 프로젝트'} (⭐ ${topRepo.stars.toLocaleString()}, 🍴 ${topRepo.forks.toLocaleString()})`;

    return {
      title: `🔥 ${topRepo.name}`,
      description: oneLiner,
      link: topRepo.url,
      source: 'GitHub Trending',
      pubDate: new Date().toISOString()
    };

  } catch (error) {
    console.error('  ❌ GitHub Trending 실패:', error);
    return null;
  }
}

async function fetchNaverNews(interest: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(interest)}&display=10&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID!,
          'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET!
        }
      }
    );

    if (!response.ok) {
      throw new Error(`네이버 API 오류: ${response.status}`);
    }

    const data = await response.json();

    return data.items.map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ''),
      description: item.description.replace(/<[^>]*>/g, ''),
      link: item.link,
      source: '네이버 뉴스',
      pubDate: item.pubDate
    }));

  } catch (error) {
    console.error('네이버 뉴스 검색 실패:', error);
    return [];
  }
}

async function sendEmail(params: {
  to: string;
  userName: string;
  sections: Array<{
    interest: string;
    newsletter: any;
    trustScore: number;
  }>;
  userId: string;
}) {
  const brevoApiKey = process.env.BREVO_API_KEY;

  if (!brevoApiKey) {
    console.warn('⚠️ BREVO_API_KEY가 설정되지 않았습니다');
    return;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: 'FTTI',
        email: 'lhs41977@gmail.com'
      },
      to: [{
        email: params.to,
        name: params.userName
      }],
      subject: `[테스트] ${getSubjectLine(params.sections)}`,
      htmlContent: generateEmailHTML(params)
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API 오류: ${error}`);
  }
}

function getSubjectLine(sections: Array<{ interest: string; newsletter: any }>): string {
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric'
  });

  const interests = sections.map(s => s.interest).join(', ');
  
  return `[${interests}] ${today} 오늘의 뉴스레터`;
}

function generateEmailHTML(params: {
  userName: string;
  sections: Array<{
    interest: string;
    newsletter: any;
    trustScore: number;
  }>;
  userId: string;
}): string {
  const { userName, sections, userId } = params;
  
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const interests = sections.map(s => s.interest).join(', ');

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 40px 20px;
        }
        .test-badge {
            background: #ff9800;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 10px;
        }
        .logo { font-size: 36px; font-weight: bold; margin-bottom: 10px; }
        .tagline { font-size: 14px; opacity: 0.9; }
        .date { font-size: 12px; opacity: 0.8; margin-top: 10px; }
        .content { padding: 30px; }
        .greeting {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
        }
        .section {
            margin-bottom: 50px;
            padding-bottom: 30px;
            border-bottom: 2px solid #e0e0e0;
        }
        .section:last-child {
            border-bottom: none;
        }
        .section-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 20px;
            font-weight: bold;
        }
        .news-item {
            margin-bottom: 25px;
            padding: 20px;
            background: #fafafa;
            border-radius: 8px;
        }
        .news-meta {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }
        .category-badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
        }
        .source-badge {
            background: #4caf50;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
        }
        .read-time { color: #888; font-size: 12px; }
        .news-title {
            font-size: 18px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 10px;
        }
        .news-summary {
            font-size: 14px;
            color: #444;
            line-height: 1.7;
            margin-bottom: 12px;
        }
        .news-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        .footer a { color: #667eea; text-decoration: none; margin: 0 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="test-badge">🧪 테스트 발송</div>
            <div class="logo">🎯 FTTI</div>
            <div class="tagline">당신의 관심사, AI가 매일 큐레이션</div>
            <div class="date">${today}</div>
        </div>
        
        <div class="content">
            <div class="greeting">
                안녕하세요 <strong>${userName}</strong>님! ☕<br>
                오늘도 <strong>${interests}</strong> 분야의 핫한 소식을 준비했어요.<br>
                <span style="color: #888; font-size: 14px;">☀️ 즐거운 하루 되세요!</span>
            </div>
            
            ${sections.map(section => `
                <div class="section">
                    <div class="section-header">
                        📰 ${section.interest}
                    </div>
                    
                    ${section.newsletter.mainNews.slice(0, 4).map((news: any) => `
                        <div class="news-item">
                            <div class="news-meta">
                                <span class="category-badge">${news.category}</span>
                                <span class="source-badge">${news.source || '네이버'}</span>
                                <span class="read-time">⏱️ ${news.readTime}</span>
                            </div>
                            <h3 class="news-title">${news.emoji} ${news.title}</h3>
                            <p class="news-summary">${news.summary}</p>
                            <a href="${news.sourceLink}" class="news-link">자세히 읽기 →</a>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>🧪 이것은 테스트 발송입니다</p>
            <p style="margin-top: 15px;">
                매일 오전 7시 & 오전 10시, 당신의 inbox로 배달됩니다 📬
            </p>
            <p style="margin-top: 20px; color: #999; font-size: 11px;">
                © 2026 FTTI. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
