# 📘 Referral, Tracking, Interactive 기능 사용 가이드

## 목차
1. [Referral Program](#1-referral-program)
2. [Email Tracking](#2-email-tracking)
3. [Interactive Features](#3-interactive-features)
4. [통합 예제](#4-통합-예제)

---

## 1. Referral Program

### 1.1 추천 코드 생성

사용자가 대시보드에서 추천 코드를 생성할 수 있습니다.

```typescript
// app/dashboard/referral/page.tsx 에서 자동 생성됨
const generateReferralCode = async (userId: string) => {
  const res = await fetch('/api/referral/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  const data = await res.json();
  // data.code: "ABC123"
  // data.link: "https://ftti.app?ref=ABC123"
};
```

### 1.2 회원가입 시 추천인 처리

```typescript
// app/auth/callback/route.ts 또는 onboarding 페이지
const params = new URLSearchParams(window.location.search);
const refCode = params.get('ref');

if (refCode && newUser) {
  await fetch('/api/referral/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: refCode,
      newUserId: newUser.id,
      newUserEmail: newUser.email
    }),
  });
}
```

### 1.3 리더보드 조회

```sql
-- Supabase에서 직접 조회
SELECT * FROM referral_leaderboard
ORDER BY successful_referrals DESC
LIMIT 10;
```

---

## 2. Email Tracking

### 2.1 뉴스레터 발송 전 트래킹 추가

```typescript
// app/api/cron/send-newsletters/route.ts

import { enhanceNewsletterEmail } from '@/lib/email-enhancements';

// 뉴스레터 HTML 생성 후
const originalHtml = generateNewsletterHTML(user, articles);

// 트래킹 추가
const trackedHtml = enhanceNewsletterEmail(originalHtml, {
  sendId: newsletterSend.id,
  userId: user.id,
  includeRating: true, // 별점 피드백 포함
});

// Brevo로 발송
await brevo.sendEmail({
  to: user.email,
  subject: '...',
  htmlContent: trackedHtml
});
```

### 2.2 Open/Click 이벤트 확인

```typescript
// 특정 뉴스레터의 성과 조회
const { data } = await supabase
  .from('newsletter_performance')
  .select('*')
  .eq('id', sendId)
  .single();

console.log({
  openCount: data.open_count,
  clickCount: data.click_count,
  wasOpened: data.was_opened,
  firstOpenedAt: data.first_opened_at
});
```

### 2.3 전체 통계 확인

```typescript
// 최근 7일 통계
const { data } = await supabase
  .from('daily_email_stats')
  .select('*')
  .order('date', { ascending: false })
  .limit(7);

data.forEach(day => {
  console.log(`${day.date}: Open ${day.open_rate}%, Click ${day.click_rate}%`);
});
```

---

## 3. Interactive Features

### 3.1 퀴즈 추가

```typescript
import { 
  enhanceNewsletterEmail, 
  SAMPLE_QUIZZES 
} from '@/lib/email-enhancements';

const html = enhanceNewsletterEmail(originalHtml, {
  sendId: newsletterSend.id,
  userId: user.id,
  quiz: {
    id: 'quiz_ai_2024_01',
    question: '2024년 가장 화제가 된 AI 모델은?',
    options: ['GPT-4', 'Claude 3', 'Gemini', 'Llama 3'],
    correctAnswer: 'Claude 3'
  }
});
```

### 3.2 투표 추가

```typescript
const html = enhanceNewsletterEmail(originalHtml, {
  sendId: newsletterSend.id,
  userId: user.id,
  poll: {
    id: 'poll_interest_2024_01',
    question: '다음 주 어떤 주제가 가장 궁금하세요?',
    options: ['AI/ML', 'Web3/블록체인', '클라우드', '보안']
  }
});
```

### 3.3 피드백 결과 조회

```typescript
// 퀴즈 응답 집계
const { data: quizResults } = await supabase
  .from('newsletter_feedback')
  .select('answer, COUNT(*)')
  .eq('feedback_type', 'quiz')
  .eq('question_id', 'quiz_ai_2024_01')
  .group('answer');

// 별점 평균 계산
const { data: ratings } = await supabase
  .from('newsletter_feedback')
  .select('rating')
  .eq('feedback_type', 'rating')
  .eq('newsletter_send_id', sendId);

const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
console.log(`평균 별점: ${avgRating.toFixed(1)}/5`);
```

---

## 4. 통합 예제

### 4.1 완전한 뉴스레터 발송 플로우

```typescript
// app/api/cron/send-newsletters/route.ts

import { 
  enhanceNewsletterEmail, 
  SAMPLE_QUIZZES, 
  SAMPLE_POLLS 
} from '@/lib/email-enhancements';

export async function GET(request: Request) {
  const users = await getActiveUsers();

  for (const user of users) {
    // 1. 뉴스 수집
    const articles = await fetchNewsForUser(user);
    
    // 2. AI로 뉴스레터 생성
    const newsletter = await generateNewsletter(user.interest, articles);
    
    // 3. HTML 템플릿 생성
    const originalHtml = createEmailTemplate(user, newsletter);
    
    // 4. DB에 발송 기록 생성
    const { data: newsletterSend } = await supabase
      .from('newsletter_sends')
      .insert({
        user_id: user.id,
        subject: `[${user.interest}] ${new Date().toLocaleDateString('ko-KR')} 뉴스`,
        content: originalHtml,
        status: 'pending'
      })
      .select()
      .single();
    
    // 5. 트래킹 + 인터랙티브 요소 추가
    const enhancedHtml = enhanceNewsletterEmail(originalHtml, {
      sendId: newsletterSend.id,
      userId: user.id,
      quiz: SAMPLE_QUIZZES[0], // 오늘의 퀴즈
      poll: SAMPLE_POLLS[0],   // 독자 투표
      includeRating: true       // 별점 피드백
    });
    
    // 6. Brevo로 발송
    await brevo.sendTransacEmail({
      to: [{ email: user.email, name: user.nickname }],
      subject: `[${user.interest}] 오늘의 뉴스`,
      htmlContent: enhancedHtml,
      sender: {
        email: 'newsletter@ftti.app',
        name: 'FTTI'
      }
    });
    
    // 7. 발송 상태 업데이트
    await supabase
      .from('newsletter_sends')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', newsletterSend.id);
  }

  return NextResponse.json({ success: true });
}
```

### 4.2 대시보드에서 통계 표시

```typescript
// app/dashboard/analytics/page.tsx

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    // 이메일 성과
    const { data: emailStats } = await supabase
      .from('daily_email_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);

    // 추천 성과
    const { data: referralStats } = await supabase
      .from('referral_leaderboard')
      .select('*')
      .limit(10);

    // 피드백 통계
    const { data: feedbackStats } = await supabase
      .from('newsletter_feedback')
      .select('feedback_type, COUNT(*)')
      .group('feedback_type');

    setStats({
      email: emailStats,
      referral: referralStats,
      feedback: feedbackStats
    });
  };

  return (
    <div>
      {/* 차트 라이브러리로 시각화 */}
      <EmailPerformanceChart data={stats?.email} />
      <ReferralLeaderboard data={stats?.referral} />
      <FeedbackSummary data={stats?.feedback} />
    </div>
  );
}
```

### 4.3 환경 변수 설정

`.env.local`에 추가:

```env
# 기존 환경변수
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
BREVO_API_KEY=...

# 새로 추가
NEXT_PUBLIC_APP_URL=https://ftti-umber.vercel.app
```

---

## 5. Supabase 마이그레이션 실행

```bash
# Supabase 대시보드 > SQL Editor에서 실행

# 1. 기본 스키마
supabase/migrations/002_newsletter_sends.sql

# 2. Send Time 추가
supabase/migrations/20260113_add_preferred_send_time.sql

# 3. Referral, Tracking, Interactive 추가 (새로운!)
supabase/migrations/003_referral_tracking_interactive.sql
```

---

## 6. 테스트

### 6.1 Referral 테스트

```bash
# 1. 추천 코드 생성
curl -X POST http://localhost:3000/api/referral/generate \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-uuid"}'

# 2. 추천 링크로 회원가입
# http://localhost:3000?ref=ABC123

# 3. 추천 완료 처리
curl -X POST http://localhost:3000/api/referral/complete \
  -H "Content-Type: application/json" \
  -d '{
    "code":"ABC123",
    "newUserId":"new-user-uuid",
    "newUserEmail":"newuser@example.com"
  }'
```

### 6.2 Tracking 테스트

```bash
# 1. 오픈 트래킹
curl http://localhost:3000/api/tracking/open?id=send-uuid&u=user-uuid

# 2. 클릭 트래킹
curl http://localhost:3000/api/tracking/click?id=send-uuid&u=user-uuid&url=https://example.com
```

### 6.3 Feedback 테스트

```bash
# 퀴즈 응답
curl "http://localhost:3000/api/feedback?id=send-uuid&u=user-uuid&type=quiz&q=quiz_ai_2024_01&answer=Claude+3"

# 별점
curl "http://localhost:3000/api/feedback?id=send-uuid&u=user-uuid&type=rating&rating=5"
```

---

## 7. 모니터링

### 7.1 주요 지표

```sql
-- Open Rate
SELECT 
  date,
  open_rate,
  click_rate
FROM daily_email_stats
ORDER BY date DESC
LIMIT 7;

-- Top Referrers
SELECT 
  nickname,
  successful_referrals,
  total_referrals
FROM referral_leaderboard
LIMIT 10;

-- Feedback Summary
SELECT 
  feedback_type,
  COUNT(*) as count
FROM newsletter_feedback
GROUP BY feedback_type;
```

### 7.2 알림 설정 (선택사항)

```typescript
// Open Rate가 30% 이하면 알림
if (stats.open_rate < 30) {
  await sendSlackNotification('⚠️ Open Rate가 낮습니다!');
}

// 추천이 10명 이상이면 축하
if (stats.successful_referrals >= 10) {
  await sendEmailCongrats(user);
}
```

---

## 8. 트러블슈팅

### 문제 1: 트래킹 픽셀이 작동하지 않음
- Vercel 배포 확인
- `NEXT_PUBLIC_APP_URL` 환경변수 확인
- 이메일 클라이언트의 이미지 자동 로드 설정 확인

### 문제 2: 추천 코드 중복
- `generate_referral_code()` 함수가 무한 루프에 빠지지 않도록 확인
- 코드 길이를 늘려서 충돌 확률 감소

### 문제 3: Interactive 버튼 클릭 안됨
- 이메일 클라이언트가 링크를 차단하는지 확인
- HTML 인라인 스타일 확인

---

## 9. 다음 단계

- [ ] A/B 테스트: 제목/내용 변형 테스트
- [ ] 프리미엄 기능: Referral 보상 자동 적용
- [ ] 고급 분석: Cohort Analysis
- [ ] 모바일 앱: React Native 앱 개발

---

**작성일**: 2026-01-14  
**버전**: 1.0.0
