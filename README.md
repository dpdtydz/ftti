# 🎯 FTTI - 멀티엔진 뉴스레터

## 📋 Overview

고품질 AI 뉴스레터 자동 생성 시스템
- **멀티 AI 엔진**: Groq + Gemini 조합으로 품질 극대화
- **Morning Brew 스타일**: 읽기 쉽고 매력적인 디자인
- **완벽한 한국어**: 번역체 제거, 자연스러운 표현
- **팩트 체크**: 신뢰도 점수로 품질 보장
- **안정적인 뉴스 소스**: 네이버 뉴스 API 활용

## 🏗️ Architecture

```
Step 1: Groq Llama 3.1 8B (빠른 초안)
   ↓
Step 2: Gemini 2.0 Flash (한국어 개선)
   ↓
Step 3: Groq Llama 3.3 70B (팩트 체크)
   ↓
Result: 고품질 뉴스레터 ✨
```

## 🚀 Quick Start

### 1. 저장소 클론

```bash
git clone https://github.com/dpdtydz/ftti.git
cd ftti
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일 수정:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI APIs
GROQ_API_KEY=gsk_your_groq_key
GEMINI_API_KEY=AIzaSy_your_gemini_key

# Naver
NAVER_CLIENT_ID=your_naver_id
NAVER_CLIENT_SECRET=your_naver_secret

# Brevo
BREVO_API_KEY=xkeysib_your_brevo_key

# Cron
CRON_SECRET=your-secret-string
```

### 4. Supabase 스키마 적용

```bash
# Supabase 대시보드에서 SQL Editor 열기
# supabase/migrations/002_newsletter_sends.sql 실행
```

### 5. 로컬 테스트

```bash
# 뉴스레터 생성 테스트
npm run test:newsletter
```

## 📁 File Structure

```
ftti/
├── app/
│   ├── lib/
│   │   └── newsletter-generator.ts  ⭐ 멀티엔진 생성기
│   └── api/
│       └── cron/
│           └── send-newsletters/
│               ├── route.ts          ⭐ Cron Job (Production)
│               └── test/
│                   └── route.ts      ⭐ Test API
├── scripts/
│   └── test-newsletter.ts           ⭐ 테스트 스크립트
├── supabase/
│   └── migrations/
│       └── 002_newsletter_sends.sql ⭐ DB 스키마
└── .env.example
```

## 🎨 Key Features

### 1. 멀티엔진 생성 프로세스

```typescript
// app/lib/newsletter-generator.ts

const generator = getNewsletterGenerator();
const result = await generator.generate(interest, articles);

// 결과
{
  newsletter: {
    mainNews: [...],    // 주요 뉴스 3-5개
    quickNews: [...]    // 빠른 뉴스 3-5개
  },
  validation: {
    trustScore: 85,     // 신뢰도 점수
    verified: true,
    issues: []
  },
  metadata: {
    enginesUsed: ['Groq', 'Gemini', 'Groq'],
    processingTime: 3500  // ms
  }
}
```

### 2. Morning Brew 스타일 템플릿

```html
<!-- 깔끔한 디자인 -->
<div class="header">
  <div class="logo">🎯 FTTI</div>
  <div class="tagline">당신의 관심사, AI가 매일 큐레이션</div>
</div>

<!-- 친근한 인사 -->
<div class="greeting">
  안녕하세요 이호상님! ☕
  오늘도 AI 분야의 핫한 소식을 준비했어요.
</div>

<!-- 읽기 쉬운 뉴스 -->
<div class="news-item">
  <h3>🚀 OpenAI, GPT-5 공개</h3>
  <p>첫 문장. 두 번째 문장. 세 번째 문장.</p>
  <a href="...">자세히 읽기 →</a>
</div>
```

### 3. 고품질 프롬프트

```typescript
// 번역체 제거 규칙
❌ "~에 대해", "~에 있어", "~에 관해"
✅ "~을", "~에서", "~에 대한"

// 톤앤매너
- 친근하고 대화하듯이 (존댓말)
- 한 문장 20단어 이내
- 복잡한 문장 → 두 문장으로 분리

// 품질 체크
- 제목: 20자 이내
- 요약: 2-3문장
- 이모지: 각 뉴스당 1개
```

## 📊 Analytics Dashboard (Week 7-8)

### Supabase Views 활용

```sql
-- 전체 성과
SELECT * FROM newsletter_dashboard
ORDER BY date DESC
LIMIT 7;

-- 관심사별 성과
SELECT * FROM newsletter_by_interest
ORDER BY open_rate DESC;
```

### 주요 지표

| 지표 | 목표 | 현재 |
|------|------|------|
| Open Rate | 40%+ | - |
| Click Rate | 10%+ | - |
| Trust Score | 80+ | ✅ 80 |
| Unsubscribe | <2% | - |

## 🔧 Advanced Usage

### A/B 테스트

```typescript
// 제목 A/B 테스트
const subjectA = "[AI] 🚀 OpenAI, GPT-5 공개";
const subjectB = "[AI] OpenAI가 공개한 GPT-5 소식";

// 사용자를 랜덤하게 A/B 그룹으로 분할
const group = Math.random() < 0.5 ? 'A' : 'B';

await supabase.from('newsletter_sends').insert({
  user_id: user.id,
  subject: group === 'A' ? subjectA : subjectB,
  ab_test_id: testId,
  ab_group: group
});
```

### 발송 시간 최적화

```typescript
// 시간대별 오픈율 분석
const { data } = await supabase
  .from('newsletter_sends')
  .select('sent_at, opened_at')
  .not('opened_at', 'is', null);

// 가장 높은 오픈율 시간대 찾기
const bestHour = analyzeBestSendTime(data);
console.log(`최적 발송 시간: ${bestHour}시`);
```

## 📈 Cost Analysis

### 무료 할당량 (100명 기준)

| 엔진 | 모델 | RPM | 월 사용량 | 비용 |
|------|------|-----|-----------|------|
| Groq | Llama 3.1 8B | 30K | 6K | $0 |
| Gemini | 2.0 Flash | 15 RPM | 6K | $0 |
| Groq | Llama 3.3 70B | 6K | 6K | $0 |

**총 비용: $0/월** ✨

### 스케일링 (1,000명)

- Groq: 무료 (충분한 할당량)
- Gemini: $0.075 (Flash)
- **총 비용: ~$5/월**

## 🚨 Troubleshooting

### 1. API 키 오류

```bash
# .env.local 확인
cat .env.local | grep API_KEY

# 키가 올바른지 확인
echo $GROQ_API_KEY
```

### 2. Supabase 연결 오류

```bash
# URL과 키 확인
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. 뉴스레터 생성 실패

```typescript
// Fallback 모드 확인
// newsletter-generator.ts에서 자동으로 Gemini 단독 모드로 전환됨
```

## 🎯 Roadmap

### Week 1-2: 템플릿 개선 ✅
- [x] Morning Brew 스타일 HTML
- [x] 멀티엔진 시스템
- [x] 고품질 프롬프트
- [x] 네이버 뉴스 안정화

### Week 3-4: Referral Program
- [ ] 추천 링크 생성
- [ ] 보상 시스템
- [ ] 리더보드

### Week 5-6: 인터랙티브 요소
- [ ] 오늘의 퀴즈
- [ ] 독자 투표
- [ ] 피드백 버튼

### Week 7-8: 분석 & 최적화 ✅
- [x] 성과 대시보드
- [x] A/B 테스트
- [x] 시간 최적화
- [x] send_time 기반 자동 발송

## 📞 Support

- GitHub Issues: https://github.com/dpdtydz/ftti/issues
- Email: your-email@example.com

## 📄 License

MIT

---

Made with ❤️ by 이호상

**Last Updated**: 2026-01-13 - 네이버 뉴스 전용, 안정화 완료
