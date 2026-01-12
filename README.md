# FTTI - Feel free To Take It

> 편하게 받아보세요 ✉️

AI 기반 개인화 뉴스레터 서비스. 관심사에 맞는 최신 정보를 매일 아침 이메일로 받아보세요.

## 🚀 Features

- **개인화 큐레이션** - AI가 관심사를 분석해 맞춤 정보 제공
- **매일 자동 발송** - 설정한 시간에 이메일로 발송
- **무료 플랜** - 관심사 3개까지 무료

## 🛠 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Auth & DB**: Supabase
- **Email**: Resend
- **AI**: OpenAI GPT-4o-mini
- **Deployment**: Vercel

## 📁 Project Structure

```
app/
├── page.tsx          # 랜딩 페이지
├── login/
│   └── page.tsx      # 로그인
├── onboarding/
│   └── page.tsx      # 온보딩 (관심사 선택)
├── dashboard/
│   └── page.tsx      # 대시보드
└── archive/
    └── page.tsx      # 뉴스레터 아카이브
```

## 🏃 Getting Started

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 📝 Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
RESEND_API_KEY=your_resend_api_key
OPENAI_API_KEY=your_openai_api_key
```

## 📄 License

MIT
