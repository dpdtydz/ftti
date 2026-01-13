// scripts/test-newsletter.ts
/**
 * 로컬에서 뉴스레터 생성 테스트
 * 
 * 사용법:
 * npx tsx scripts/test-newsletter.ts
 */

import { getNewsletterGenerator } from '../app/lib/newsletter-generator';
import type { NewsArticle } from '../app/lib/newsletter-generator';

async function fetchNaverNews(query: string): Promise<NewsArticle[]> {
  const response = await fetch(
    `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=10&sort=date`,
    {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID!,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET!
      }
    }
  );

  const data = await response.json();
  
  return data.items.map((item: any) => ({
    title: item.title.replace(/<[^>]*>/g, ''),
    description: item.description.replace(/<[^>]*>/g, ''),
    link: item.link,
    source: '네이버 뉴스',
    pubDate: item.pubDate
  }));
}

async function test() {
  console.log('🧪 뉴스레터 생성 테스트 시작\n');

  // 테스트할 관심사
  const interests = ['인공지능', '스타트업', '블록체인'];

  for (const interest of interests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📰 관심사: ${interest}`);
    console.log('='.repeat(60));

    try {
      // 1. 뉴스 수집
      console.log('\n1️⃣ 네이버 뉴스 검색 중...');
      const articles = await fetchNaverNews(interest);
      console.log(`✅ ${articles.length}개 뉴스 수집 완료`);

      if (articles.length === 0) {
        console.log('⚠️ 뉴스가 없습니다. 스킵합니다.');
        continue;
      }

      // 2. 뉴스레터 생성
      console.log('\n2️⃣ 멀티엔진으로 뉴스레터 생성 중...');
      const generator = getNewsletterGenerator();
      const result = await generator.generate(interest, articles);

      // 3. 결과 출력
      console.log('\n✅ 생성 완료!');
      console.log(`\n📊 메타데이터:`);
      console.log(`   - 사용된 엔진: ${result.metadata.enginesUsed.join(' → ')}`);
      console.log(`   - 처리 시간: ${result.metadata.processingTime}ms`);
      console.log(`   - 신뢰도 점수: ${result.validation.trustScore}/100`);
      console.log(`   - 검증 완료: ${result.validation.verified ? 'Yes' : 'No'}`);

      if (result.validation.issues.length > 0) {
        console.log(`\n⚠️ 발견된 이슈: ${result.validation.issues.length}개`);
        result.validation.issues.forEach((issue, i) => {
          console.log(`   ${i + 1}. ${issue.location}: ${issue.problem}`);
        });
      }

      console.log(`\n📰 생성된 뉴스레터:`);
      console.log(JSON.stringify(result.newsletter, null, 2));

      // 4. 품질 체크
      console.log(`\n🔍 품질 체크:`);
      
      // 제목 길이 체크
      result.newsletter.mainNews.forEach((news, i) => {
        const titleLength = news.title.length;
        const status = titleLength <= 20 ? '✅' : '⚠️';
        console.log(`   ${status} 뉴스 ${i + 1} 제목 길이: ${titleLength}자`);
      });

      // 요약 길이 체크
      result.newsletter.mainNews.forEach((news, i) => {
        const sentences = news.summary.split('. ').filter(s => s.trim().length > 0);
        const status = sentences.length >= 2 && sentences.length <= 3 ? '✅' : '⚠️';
        console.log(`   ${status} 뉴스 ${i + 1} 요약 문장 수: ${sentences.length}개`);
      });

      // 번역체 체크
      const translationPatterns = ['에 대해', '에 있어', '에 관해', '함에 있어'];
      const fullText = JSON.stringify(result.newsletter);
      const foundPatterns = translationPatterns.filter(p => fullText.includes(p));
      
      if (foundPatterns.length === 0) {
        console.log(`   ✅ 번역체 없음`);
      } else {
        console.log(`   ⚠️ 번역체 발견: ${foundPatterns.join(', ')}`);
      }

    } catch (error) {
      console.error(`\n❌ 에러 발생:`, error);
    }
  }

  console.log('\n\n🎉 테스트 완료!');
}

// 실행
test().catch(console.error);
