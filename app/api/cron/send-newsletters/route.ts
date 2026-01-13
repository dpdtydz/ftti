// app/api/cron/send-newsletters/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getNewsletterGenerator } from '@/app/lib/newsletter-generator';
import type { NewsArticle } from '@/app/lib/newsletter-generator';

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
    // Vercel Cron 인증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 뉴스레터 발송 Cron 시작');
    console.log('⏰ 시간:', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));

    // Supabase 클라이언트 초기화
    const supabase = getSupabaseClient();

    // 1. 활성 사용자 조회
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .not('interests', 'is', null);

    if (usersError) {
      console.error('❌ 사용자 조회 실패:', usersError);
      throw usersError;
    }

    console.log(`📊 발송 대상: ${users?.length || 0}명`);

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: '발송할 사용자가 없습니다',
        sent: 0
      });
    }

    const generator = getNewsletterGenerator();
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    // 2. 각 사용자별 처리
    for (const user of users) {
      try {
        console.log(`\n📧 처리 중: ${user.email} (${user.interests})`);

        // 2-1. 네이버 뉴스 검색
        const articles = await fetchNaverNews(user.interests);

        if (articles.length === 0) {
          console.log('⚠️ 뉴스 없음, 스킵');
          results.skipped++;
          continue;
        }

        console.log(`📰 수집된 뉴스: ${articles.length}개`);

        // 2-2. 멀티엔진으로 뉴스레터 생성
        const result = await generator.generate(user.interests, articles);

        console.log(`✅ 생성 완료:`);
        console.log(`   - 신뢰도: ${result.validation.trustScore}점`);
        console.log(`   - 엔진: ${result.metadata.enginesUsed.join(' → ')}`);
        console.log(`   - 처리시간: ${result.metadata.processingTime}ms`);

        // 2-3. Brevo로 이메일 발송
        await sendEmail({
          to: user.email,
          userName: user.name || user.email.split('@')[0],
          interest: user.interests,
          newsletter: result.newsletter,
          trustScore: result.validation.trustScore,
          userId: user.id
        });

        // 2-4. 발송 기록 저장
        await supabase.from('newsletter_sends').insert({
          user_id: user.id,
          subject: getSubjectLine(result.newsletter, user.interests),
          content: result.newsletter,
          trust_score: result.validation.trustScore,
          engines_used: result.metadata.enginesUsed,
          processing_time: result.metadata.processingTime,
          sent_at: new Date().toISOString(),
          status: 'sent'
        });

        results.success++;
        console.log(`✅ 발송 성공: ${user.email}`);

        // Rate limiting (초당 1건)
        await sleep(1000);

      } catch (error) {
        console.error(`❌ 실패: ${user.email}`, error);
        results.failed++;

        // 실패 기록
        await supabase.from('newsletter_sends').insert({
          user_id: user.id,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          sent_at: new Date().toISOString()
        });
      }
    }

    console.log('\n📊 발송 완료:');
    console.log(`   - 성공: ${results.success}건`);
    console.log(`   - 실패: ${results.failed}건`);
    console.log(`   - 스킵: ${results.skipped}건`);

    return NextResponse.json({
      success: true,
      ...results,
      total: users.length
    });

  } catch (error) {
    console.error('❌ Cron 작업 실패:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * 네이버 뉴스 검색
 */
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

/**
 * Brevo로 이메일 발송
 */
async function sendEmail(params: {
  to: string;
  userName: string;
  interest: string;
  newsletter: any;
  trustScore: number;
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
        email: 'noreply@ftti.app'
      },
      to: [{
        email: params.to,
        name: params.userName
      }],
      subject: getSubjectLine(params.newsletter, params.interest),
      htmlContent: generateEmailHTML(params)
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API 오류: ${error}`);
  }
}

/**
 * 제목 생성
 */
function getSubjectLine(newsletter: any, interest: string): string {
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric'
  });

  if (newsletter.mainNews && newsletter.mainNews.length > 0) {
    const firstNews = newsletter.mainNews[0];
    return `[${interest}] ${firstNews.emoji} ${firstNews.title}`;
  }

  return `[${interest}] ${today} 오늘의 뉴스레터`;
}

/**
 * HTML 이메일 생성
 */
function generateEmailHTML(params: {
  userName: string;
  interest: string;
  newsletter: any;
  trustScore: number;
  userId: string;
}): string {
  const { userName, interest, newsletter, trustScore, userId } = params;
  
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  // Morning Brew 스타일 HTML 템플릿
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
        .section-title {
            font-size: 24px;
            font-weight: bold;
            color: #1a1a1a;
            margin: 30px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        .news-item {
            margin-bottom: 30px;
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
        .read-time { color: #888; font-size: 12px; }
        .news-title {
            font-size: 20px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 12px;
        }
        .news-summary {
            font-size: 15px;
            color: #444;
            line-height: 1.7;
            margin-bottom: 15px;
        }
        .news-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .quick-news {
            background: #fff8e1;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ffa726;
            margin: 30px 0;
        }
        .quick-news h3 { margin-bottom: 15px; }
        .quick-news ul { list-style: none; }
        .quick-news li { padding: 8px 0; border-bottom: 1px solid #ffe0b2; }
        .quick-news li:last-child { border-bottom: none; }
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
                오늘도 <strong>${interest}</strong> 분야의 핫한 소식을 준비했어요.<br>
                <span style="color: #888; font-size: 14px;">☀️ 즐거운 하루 되세요!</span>
            </div>
            
            <h2 class="section-title">📰 오늘의 주요 소식</h2>
            
            ${newsletter.mainNews.map((news: any) => `
                <div class="news-item">
                    <div class="news-meta">
                        <span class="category-badge">${news.category}</span>
                        <span class="read-time">⏱️ ${news.readTime}</span>
                    </div>
                    <h3 class="news-title">${news.emoji} ${news.title}</h3>
                    <p class="news-summary">${news.summary}</p>
                    <a href="${news.sourceLink}" class="news-link">자세히 읽기 →</a>
                </div>
            `).join('')}
            
            ${newsletter.quickNews && newsletter.quickNews.length > 0 ? `
                <div class="quick-news">
                    <h3>⚡ 빠른 소식</h3>
                    <ul>
                        ${newsletter.quickNews.map((news: any) => `
                            <li>• <a href="${news.link}">${news.text}</a></li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div class="cta-section">
                <div style="color: white; font-size: 20px; font-weight: bold;">
                    친구에게 FTTI 추천하고 리워드 받기 🎁
                </div>
                <div style="color: rgba(255,255,255,0.9); margin: 10px 0;">
                    친구 5명 추천 시 프리미엄 1주일 무료!
                </div>
                <a href="https://ftti.app/join?ref=${userId}" class="cta-button">
                    지금 추천하기
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>매일 오전 8시 & 오후 6시, 당신의 inbox로 배달됩니다 📬</p>
            <p style="margin-top: 15px;">
                <a href="https://ftti.app/preferences?id=${userId}">✏️ 관심사 변경</a>
                <span style="color: #ddd;">|</span>
                <a href="https://ftti.app/unsubscribe?id=${userId}">📭 수신거부</a>
            </p>
            ${trustScore < 70 ? `
                <p style="margin-top: 15px; color: #ff9800;">
                    ⚠️ 이 뉴스레터는 AI가 자동 생성한 콘텐츠입니다.<br>
                    정확한 정보는 원문을 확인해주세요.
                </p>
            ` : ''}
            <p style="margin-top: 20px; color: #999; font-size: 11px;">
                © 2026 FTTI. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

/**
 * Sleep 유틸리티
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
