# FTTI 환경변수 설정 가이드

## Vercel 환경변수 설정 (중요!)

### 1. Vercel Dashboard 접속
https://vercel.com/dpdtydz/ftti/settings/environment-variables

### 2. 필수 환경변수 추가

#### Supabase (데이터베이스)
```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
> Supabase Dashboard → Settings → API에서 확인

#### Naver Search API
```
NAVER_CLIENT_ID = your_client_id
NAVER_CLIENT_SECRET = your_client_secret
```
> https://developers.naver.com/apps 에서 발급
> - 애플리케이션 등록 → 검색 API 선택

#### Brevo (이메일 발송)
```
BREVO_API_KEY = xkeysib-xxxxxxxxxxxxx
```
> https://app.brevo.com/settings/keys/api
> - v3 API Key 사용

#### Google Gemini API
```
GEMINI_API_KEY = AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx
```
> https://aistudio.google.com/app/apikey
> - API Key 생성

#### Cron Job 인증
```
CRON_SECRET = your_random_secret_string
```
> 임의의 긴 문자열 (보안용)

### 3. 환경 선택
- ✅ Production
- ✅ Preview  
- ✅ Development

**모두 체크해야 합니다!**

### 4. 재배포
환경변수 저장 후 반드시:
1. Deployments 탭 이동
2. 최신 배포 선택
3. "Redeploy" 클릭

---

## 문제 해결 (Troubleshooting)

### 환경변수가 인식되지 않는 경우

1. **환경변수 이름 확인**
   - 대소문자 정확히 일치해야 함
   - 띄어쓰기 없어야 함

2. **값에 따옴표 제거**
   - ❌ `"your_key"` 
   - ✅ `your_key`

3. **재배포 확인**
   - 환경변수 변경 후 재배포 필수

4. **테스트 API 호출**
   ```bash
   curl https://ftti-umber.vercel.app/api/test-email
   ```
   
   응답 예시:
   ```json
   {
     "gemini": "✅ 연결됨",
     "brevo": "✅ 연결됨",
     "naver": "✅ 연결됨",
     "envCheck": {
       "BREVO_API_KEY": "✅ 있음 (xkeysib-ab...)",
       "NAVER_CLIENT_ID": "✅ 있음"
     }
   }
   ```

### API Key 발급 링크

| 서비스 | 발급 URL | 참고 |
|--------|----------|------|
| Naver | https://developers.naver.com/apps | 검색 API 신청 필요 |
| Brevo | https://app.brevo.com/settings/keys/api | 무료 300통/일 |
| Gemini | https://aistudio.google.com/app/apikey | 무료 사용 가능 |
| Supabase | https://supabase.com/dashboard/project/_/settings/api | 프로젝트 생성 후 |

---

## 로컬 개발 환경 설정

1. `.env.local` 파일 생성 (프로젝트 루트)
2. 위의 환경변수 모두 복사
3. 각 값을 실제 키로 교체

```bash
npm install
npm run dev
```

로컬 테스트:
```
http://localhost:3000/api/test-email
```