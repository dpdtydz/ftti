// app/api/cron/send-newsletters/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getNewsletterGenerator } from '@/app/lib/newsletter-generator';
import type { NewsArticle } from '@/app/lib/newsletter-generator';
import { enhanceNewsletterEmail, SAMPLE_QUIZZES, SAMPLE_POLLS } from '@/app/lib/email-enhancements';

// Next.js 설정
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// HTML 엔티티 디코딩 함수
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

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
    const { searchParams } = new URL(request.url);
    let kstTime = searchParams.get('time');

    if (!kstTime) {
      kstTime = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(/\s/g, '');
    }

    console.log(`🚀 뉴스레터 발송 시작 (대상 시간: ${kstTime})`);

    const supabase = getSupabaseClient();

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
      .eq('send_time', kstTime);

    if (usersError) {
      console.error('❌ 사용자 조회 실패:', usersError);
      throw usersError;
    }

    const activeUsers = (users || []).filter(user => {
      const interests = user.user_interests?.map((ui: any) => ui.interests?.name).filter(Boolean) || [];
      return interests.length > 0;
    });

    console.log(`📊 발송 대상: ${activeUsers.length}명 (send_time: ${kstTime})`);

    if (activeUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${kstTime}에 발송할 사용자가 없습니다`,
        sent: 0,
        currentTime: kstTime
      });
    }

    const generator = getNewsletterGenerator();
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    for (const user of activeUsers) {
      try {
        const interests = user.user_interests?.map((ui: any) => ui.interests?.name).filter(Boolean) || [];
        console.log(`\n📧 처리 중: ${user.email} (${interests.join(', ')})`);

        const sections = [];
        
        for (const interest of interests) {
          console.log(`\n📰 [${interest}] 뉴스 수집 중...`);

          let articles: NewsArticle[] = [];
          const isITRelated = isITKeyword(interest);

          if (isITRelated) {
            console.log('  🔍 IT 전문 RSS 대량 수집 시작...');
            
            const [naverArticles, geekArticles, kakaoArticles, tossArticles, zdnetArticles, bloterArticles, githubArticle] = await Promise.allSettled([
              fetchNaverNews(interest),
              fetchGeekNews(),
              fetchKakaoTech(),
              fetchTossTech(),
              fetchZDNet(),
              fetchBloter(),
              fetchGitHubTrending()
            ]).then(results => [
              results[0].status === 'fulfilled' ? results[0].value : [],
              results[1].status === 'fulfilled' ? results[1].value : [],
              results[2].status === 'fulfilled' ? results[2].value : [],
              results[3].status === 'fulfilled' ? results[3].value : [],
              results[4].status === 'fulfilled' ? results[4].value : [],
              results[5].status === 'fulfilled' ? results[5].value : [],
              results[6].status === 'fulfilled' ? results[6].value : null
            ]);
            
            articles = [
              ...naverArticles,
              ...geekArticles,
              ...kakaoArticles,
              ...tossArticles,
              ...zdnetArticles,
              ...bloterArticles,
              ...(githubArticle ? [githubArticle] : [])
            ].slice(0, 30);
            
            console.log(`  📊 수집 결과: 네이버 ${naverArticles.length}개 | GeekNews ${geekArticles.length}개 | 카카오 ${kakaoArticles.length}개 | 토스 ${tossArticles.length}개 | ZDNet ${zdnetArticles.length}개 | 블로터 ${bloterArticles.length}개 | GitHub ${githubArticle ? 1 : 0}개`);
            console.log(`  ✅ AI 선별 대상: ${articles.length}개 뉴스 → AI가 퀄리티 높은 4-5개 선택`);
          } else {
            console.log('  🔍 네이버 뉴스 검색 중...');
            const naverArticles = await fetchNaverNews(interest);
            articles = naverArticles.slice(0, 10);
            console.log(`  ✅ AI 선별 대상: ${articles.length}개 뉴스 → AI가 퀄리티 높은 3-4개 선택`);
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
          console.log(`  📰 최종 선택된 뉴스: ${result.newsletter.mainNews.length}개`);
        }

        if (sections.length === 0) {
          console.log('⚠️ 생성된 섹션 없음, 스킵');
          results.skipped++;
          continue;
        }

        const { data: newsletterSend, error: insertError } = await supabase
          .from('newsletter_sends')
          .insert({
            user_id: user.id,
            subject: getSubjectLine(sections),
            content: { sections },
            trust_score: Math.round(sections.reduce((sum, s) => sum + s.trustScore, 0) / sections.length),
            engines_used: ['Groq Llama 3.1 8B', 'Gemini 2.0 Flash', 'Groq Llama 3.3 70B'],
            processing_time: 0,
            status: 'pending'
          })
          .select()
          .single();

        if (insertError || !newsletterSend) {
          console.warn('⚠️ 발송 기록 생성 실패:', insertError);
          throw new Error('발송 기록 생성 실패');
        }

        await sendEmailWithTracking({
          to: user.email,
          userName: user.nickname || user.email.split('@')[0],
          sections,
          userId: user.id,
          sendId: newsletterSend.id
        });

        await supabase
          .from('newsletter_sends')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', newsletterSend.id);

        results.success++;
        console.log(`✅ 발송 성공: ${user.email}`);
        await sleep(1000);

      } catch (error) {
        console.error(`❌ 실패: ${user.email}`, error);
        results.failed++;
      }
    }

    console.log('\n📊 발송 완료:');
    console.log(`   - 성공: ${results.success}건`);
    console.log(`   - 실패: ${results.failed}건`);
    console.log(`   - 스킵: ${results.skipped}건`);

    return NextResponse.json({
      success: true,
      ...results,
      total: activeUsers.length,
      currentTime: kstTime
    });

  } catch (error) {
    console.error('❌ 발송 실패:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
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

// 📡 RSS 파싱 공통 함수
async function parseRSSFeed(url: string, sourceName: string, maxItems: number = 10): Promise<NewsArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'Referer': 'https://www.google.com/'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  ⚠️ [${sourceName}] HTTP ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const items: NewsArticle[] = [];
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null && items.length < maxItems) {
      const itemXml = match[1];
      
      let title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] 
                || itemXml.match(/<title>(.*?)<\/title>/)?.[1] 
                || '';
      
      let link = itemXml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/)?.[1]
              || itemXml.match(/<link>(.*?)<\/link>/)?.[1] 
              || '';
      
      let description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
                     || itemXml.match(/<description>(.*?)<\/description>/)?.[1]
                     || '';
      
      // HTML 태그 및 엔티티 제거
      title = decodeHTMLEntities(title.replace(/<[^>]*>/g, '')).trim();
      link = link.trim();
      const cleanDescription = decodeHTMLEntities(description.replace(/<[^>]*>/g, '')).trim().substring(0, 200);

      if (title && link) {
        items.push({
          title,
          description: cleanDescription,
          link,
          source: sourceName,
          pubDate: new Date().toISOString()
        });
      }
    }

    if (items.length > 0) {
      console.log(`  ✅ [${sourceName}] ${items.length}개 수집`);
    }
    return items;

  } catch (error) {
    console.log(`  ❌ [${sourceName}] 실패`);
    return [];
  }
}

async function fetchGeekNews(): Promise<NewsArticle[]> {
  return parseRSSFeed('https://news.hada.io/rss', 'GeekNews', 10);
}

async function fetchKakaoTech(): Promise<NewsArticle[]> {
  return parseRSSFeed('https://tech.kakao.com/feed/', '카카오', 5);
}

async function fetchTossTech(): Promise<NewsArticle[]> {
  return parseRSSFeed('https://toss.tech/rss.xml', '토스', 5);
}

async function fetchZDNet(): Promise<NewsArticle[]> {
  return parseRSSFeed('https://zdnet.co.kr/rss/news.xml', 'ZDNet Korea', 5);
}

async function fetchBloter(): Promise<NewsArticle[]> {
  return parseRSSFeed('https://www.bloter.net/feed/', '블로터', 5);
}

async function fetchGitHubTrending(): Promise<NewsArticle | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.gitterapp.com/repositories', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  ⚠️ [GitHub] HTTP ${response.status}`);
      return null;
    }

    const repos = await response.json();
    if (!Array.isArray(repos) || repos.length === 0) return null;

    const topRepo = repos[0];
    if (!topRepo) return null;

    console.log(`  ✅ [GitHub] ${topRepo.name} 수집`);
    
    return {
      title: `🔥 ${topRepo.name}`,
      description: `${topRepo.description || '인기 급상승 프로젝트'} (⭐ ${topRepo.stars?.toLocaleString() || 'N/A'})`,
      link: topRepo.url,
      source: 'GitHub Trending',
      pubDate: new Date().toISOString()
    };

  } catch (error) {
    console.log(`  ❌ [GitHub] 실패`);
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

    if (!response.ok) return [];

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: any) => ({
      title: decodeHTMLEntities(item.title.replace(/<[^>]*>/g, '')),
      description: decodeHTMLEntities(item.description.replace(/<[^>]*>/g, '')),
      link: item.link,
      source: '네이버 뉴스',
      pubDate: item.pubDate
    }));

  } catch (error) {
    return [];
  }
}

async function sendEmailWithTracking(params: {
  to: string;
  userName: string;
  sections: Array<{
    interest: string;
    newsletter: any;
    trustScore: number;
  }>;
  userId: string;
  sendId: string;
}) {
  const brevoApiKey = process.env.BREVO_API_KEY;

  if (!brevoApiKey) {
    console.warn('⚠️ BREVO_API_KEY가 설정되지 않았습니다');
    return;
  }

  const originalHtml = generateEmailHTML(params);

  const enhancedHtml = enhanceNewsletterEmail(originalHtml, {
    sendId: params.sendId,
    userId: params.userId,
    quiz: SAMPLE_QUIZZES[0],
    poll: SAMPLE_POLLS[0],
    includeRating: true
  });

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
      subject: getSubjectLine(params.sections),
      htmlContent: enhancedHtml
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ftti-dpdtydz.vercel.app';

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
        .cta-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 15px 30px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 10px;
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
                    
                    ${section.newsletter.mainNews.slice(0, 5).map((news: any) => `
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
            
            <div class="cta-section">
                <div style="color: white; font-size: 20px; font-weight: bold;">
                    친구에게 FTTI 추천하고 리워드 받기 🎁
                </div>
                <div style="color: rgba(255,255,255,0.9); margin: 10px 0;">
                    친구 1명 추천 시 프리미엄 1주일 무료!
                </div>
                <a href="${appUrl}/dashboard/referral" class="cta-button">
                    지금 추천하기
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>매일 오전 8시 & 오전 10시, 당신의 inbox로 배달됩니다 📬</p>
            <p style="margin-top: 15px;">
                <a href="${appUrl}/dashboard">✏️ 관심사 변경</a>
                <span style="color: #ddd;">|</span>
                <a href="${appUrl}/unsubscribe?id=${userId}">📭 수신거부</a>
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
