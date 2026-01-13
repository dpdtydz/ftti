# FTTI - Feel free To Take It

> 편하게 받아보세요 ✉️

AI 기반 개인화 뉴스레터 서비스. 관심사에 맞는 최신 정보를 매일 아침 이메일로 받아보세요.

## 🚀 Features

- **개인화 큐레이션** - AI가 관심사를 분석해 맞춤 정보 제공
- **매일 자동 발송** - 설정한 시간에 이메일로 발송
- **다양한 소스** - 요즘IT, 네이버 뉴스 등 큐레이션
- **무료 플랫폼** - Brevo 무료 플랜 (300통/일)

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Auth & DB**: Supabase
- **Email**: Brevo (SendinBlue)
- **AI**: Google Gemini 2.5 Flash
- **News API**: Naver Search API
- **Deployment**: Vercel
- **Scheduling**: Vercel Cron Jobs

## 📁 Project Structure

```
app/
├── page.tsx              # 랜딩 페이지
├── login/
│   └── page.tsx          # 로그인
├── onboarding/
│   └── page.tsx          # 온보딩 (관심사 선택)
├── dashboard/
│   └── page.tsx          # 대시보드 (설정 관리)
├── privacy/
│   └── page.tsx          # 개인정보처리방침
├── terms/
│   └── page.tsx          # 이용약관
└── api/
    ├── newsletter/
    │   └── route.ts      # 뉴스레터 생성/발송 API
    └── test-email/
        └── route.ts      # API 연결 테스트
```

## 🏃 Getting Started

### 1. 프로젝트 클론 및 설치

```bash
# 저장소 클론
git clone https://github.com/dpdtydz/ftti.git
cd ftti

# 의존성 설치
npm install
```

### 2. 환경변수 설정

`.env.local` 파일 생성:

```env
# Supabase (데이터베이스)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Naver Search API (뉴스 검색)
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret

# Brevo (이메일 발송)
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxx

# Google Gemini API (AI 콘텐츠 생성)
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx

# Cron Job 인증
CRON_SECRET=your_random_secret_string
```

#### API Key 발급 방법

| 서비스 | 발급 URL | 설명 |
|--------|----------|------|
| Supabase | [대시보드](https://supabase.com/dashboard) | 프로젝트 생성 후 Settings → API |
| Naver | [개발자센터](https://developers.naver.com/apps) | 애플리케이션 등록 → 검색 API |
| Brevo | [API Keys](https://app.brevo.com/settings/keys/api) | v3 API Key (무료 300통/일) |
| Gemini | [AI Studio](https://aistudio.google.com/app/apikey) | API Key 생성 |

### 3. 로컬 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 4. API 연결 테스트

```bash
curl http://localhost:3000/api/test-email
```

모든 API가 정상 연결되면:
```json
{
  "gemini": "✅ 연결됨",
  "brevo": "✅ 연결됨",
  "naver": "✅ 연결됨"
}
```

## 🔧 Vercel 배포 설정

### 1. Vercel 프로젝트 연결

```bash
npm i -g vercel
vercel
```

### 2. 환경변수 설정

Vercel Dashboard → Settings → Environment Variables에서 위의 모든 환경변수 추가

**중요**: Production, Preview, Development 모두 체크!

### 3. Cron Job 설정

`vercel.json` (이미 설정됨):
```json
{
  "crons": [
    {
      "path": "/api/newsletter?time=07:00",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/newsletter?time=08:00",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/newsletter?time=09:00",
      "schedule": "0 9 * * *"
    }
  ]
}
```

매일 07:00, 08:00, 09:00 (UTC)에 자동 실행

### 4. 배포 확인

```bash
curl https://ftti-umber.vercel.app/api/test-email
```

## 📊 Database Schema (Supabase)

### Tables

#### `interests`
```sql
- id: uuid (PK)
- name: text (관심사 이름)
- category: text (카테고리)
- description: text (설명)
```

#### `user_profiles`
```sql
- id: uuid (PK, FK → auth.users)
- email: text
- nickname: text
- send_time: time (발송 시간)
- is_active: boolean (활성화 여부)
- created_at: timestamp
```

#### `user_interests`
```sql
- user_id: uuid (FK → user_profiles)
- interest_id: uuid (FK → interests)
- created_at: timestamp
```

## 🐛 Troubleshooting

### 환경변수가 인식되지 않는 경우

1. **로컬**: `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. **Vercel**: 
   - Dashboard → Settings → Environment Variables 확인
   - 재배포 (Redeploy) 실행
3. **테스트**: `/api/test-email` 호출하여 연결 상태 확인

### Cron Job이 실행되지 않는 경우

1. Vercel Dashboard → Cron 탭에서 실행 로그 확인
2. `CRON_SECRET` 환경변수가 설정되어 있는지 확인
3. 사용자의 `send_time`이 Cron 스케줄과 일치하는지 확인

### 이메일이 발송되지 않는 경우

1. Brevo 대시보드에서 발송 로그 확인
2. API Key가 올바른지 확인
3. 발신자 이메일(lhs41977@gmail.com) 인증 확인

## 📄 License

MIT

## 🔗 Links

- **Live Demo**: https://ftti-umber.vercel.app
- **GitHub**: https://github.com/dpdtydz/ftti