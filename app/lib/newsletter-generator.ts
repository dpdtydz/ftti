// app/lib/newsletter-generator.ts
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 환경변수 체크
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Gemini API 키 로테이션 (여러 개 지원)
// GEMINI_API_KEYS="key1,key2,key3" 또는 GEMINI_API_KEY="single_key"
const GEMINI_API_KEYS_RAW = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const GEMINI_API_KEYS = GEMINI_API_KEYS_RAW.split(',').map(k => k.trim()).filter(Boolean);

if (!GROQ_API_KEY || GEMINI_API_KEYS.length === 0) {
  console.warn('⚠️ API 키가 설정되지 않았습니다');
}

console.log(`🔑 Gemini API 키: ${GEMINI_API_KEYS.length}개 로드됨`);

// 클라이언트 초기화
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Gemini 클라이언트 풀 (여러 키)
const geminiClients = GEMINI_API_KEYS.map(key => new GoogleGenerativeAI(key));
let currentGeminiIndex = 0;

// Gemini 클라이언트 가져오기 (로테이션)
function getGeminiClient(): GoogleGenerativeAI | null {
  if (geminiClients.length === 0) return null;
  
  const client = geminiClients[currentGeminiIndex];
  currentGeminiIndex = (currentGeminiIndex + 1) % geminiClients.length;
  
  return client;
}

export interface NewsArticle {
  title: string;
  description: string;
  link: string;
  source: string;
  pubDate?: string;
}

export interface NewsletterContent {
  mainNews: Array<{
    emoji: string;
    title: string;
    summary: string;
    category: string;
    readTime: string;
    sourceLink: string;
  }>;
  quickNews: Array<{
    text: string;
    link: string;
  }>;
}

export interface GenerationResult {
  newsletter: NewsletterContent;
  validation: {
    trustScore: number;
    verified: boolean;
    issues: Array<{
      location: string;
      problem: string;
      suggestion: string;
    }>;
  };
  metadata: {
    enginesUsed: string[];
    processingTime: number;
  };
}

/**
 * 프롬프트 템플릿
 */
const PROMPTS = {
  mainGeneration: (interest: string, articles: NewsArticle[]) => `
당신은 Morning Brew 스타일 뉴스레터 전문가입니다.

관심사: ${interest}

수집된 뉴스:
${articles.map((a, i) => `${i + 1}. ${a.title}\n   ${a.description}\n   ${a.link}`).join('\n\n')}

🎯 무조건 지켜야 할 품질 규칙:

1️⃣ 번역체 제거 (CRITICAL)
   ❌ "에 대해", "에 있어", "에 관해", "을 통해"
   ✅ "을", "에서", "이", "로"

2️⃣ 제목 규칙
   - 20자 이내 (필수!)
   - 카테고리 제외한 순수 제목만
   - 이모지 1개만

3️⃣ 요약 규칙
   - 2-3문장 (필수!)
   - 한 문장 20단어 이내
   - 친근하고 대화하듯이

4️⃣ 톤앤매너
   - 존댓말 사용
   - 불필요한 수식어 금지

📝 출력 형식 (JSON):
{
  "mainNews": [
    {
      "emoji": "🚀",
      "title": "20자 이내 제목",
      "summary": "첫 문장. 두 번째 문장. 세 번째 문장.",
      "category": "${interest}",
      "readTime": "3분",
      "sourceLink": "원문 URL"
    }
  ],
  "quickNews": [
    {
      "text": "15자 이내 핫한 소식",
      "link": "URL"
    }
  ]
}

⚠️ 중요:
- mainNews: 3-5개
- quickNews: 3-5개
- 모든 URL은 위 뉴스에서 가져오기
- 제목 20자 초과 절대 금지!
`,

  koreanImprovement: (draftJson: string) => `
당신은 한국어 품질 개선 전문가입니다.

초안:
${draftJson}

🎯 개선 규칙:

1️⃣ 번역체 완벽 제거
   ❌ "에 대해", "에 있어", "에 관해"
   ✅ "을", "에서", "이", "가"

2️⃣ 제목 검증
   - 20자 초과 시 자르기
   - 이모지 1개만 유지

3️⃣ 요약 검증
   - 2-3문장 엄수
   - 복잡한 문장 → 2문장으로 분리

4️⃣ 자연스러운 한국어
   - 친근하게 대화하듯이
   - 존댓말 사용

📝 출력 형식 (JSON):
동일한 구조로 개선된 버전 반환
`,

  factCheck: (contentJson: string, sources: NewsArticle[]) => `
당신은 팩트 체커입니다.

생성된 콘텐츠:
${contentJson}

📚 원본 출처:
${sources.map((s, i) => `${i + 1}. ${s.title}\n   ${s.description}\n   ${s.link}`).join('\n\n')}

🔍 검증 항목:
1. 사실 왜곱 여부
2. 과장된 표현
3. 출처 불일치
4. 오해의 소지

📊 출력 형식 (JSON):
{
  "issues": [
    {
      "location": "mainNews[0].summary",
      "problem": "구체적인 문제",
      "suggestion": "수정 제안"
    }
  ],
  "trustScore": 85,
  "verified": true
}

⚠️ trustScore 기준:
- 90-100: 완벽
- 70-89: 양호
- 50-69: 보통
- 0-49: 문제 있음
`
};

/**
 * 멀티엔진 뉴스레터 생성기
 */
export class NewsletterGenerator {
  private startTime: number = 0;

  /**
   * Step 1: Groq로 빠르게 초안 생성
   */
  private async generateWithGroq(
    interest: string,
    articles: NewsArticle[]
  ): Promise<NewsletterContent> {
    if (!groq) {
      throw new Error('Groq API 키가 설정되지 않았습니다');
    }

    console.log('🚀 [Step 1] Groq로 초안 생성 중...');

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a newsletter writer. Output valid JSON only.'
        },
        {
          role: 'user',
          content: PROMPTS.mainGeneration(interest, articles)
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(text);
  }

  /**
   * Step 2: Gemini로 한국어 품질 개선 (API 키 로테이션 지원)
   */
  private async improveWithGemini(
    draft: NewsletterContent
  ): Promise<NewsletterContent> {
    if (geminiClients.length === 0) {
      console.log('⚠️ Gemini API 키 없음, 개선 단계 스킵');
      return draft;
    }

    console.log('✨ [Step 2] Gemini로 한국어 개선 중...');

    // 모든 API 키 시도 (로테이션)
    for (let attempt = 0; attempt < geminiClients.length; attempt++) {
      try {
        const gemini = getGeminiClient();
        if (!gemini) break;

        const model = gemini.getGenerativeModel({
          model: 'gemini-2.0-flash-exp'
        });

        const prompt = PROMPTS.koreanImprovement(JSON.stringify(draft, null, 2));
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // JSON 추출
        const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?```/) ||
                          text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

        console.log(`✅ Gemini API 키 #${attempt + 1} 성공`);
        return JSON.parse(cleanJson.trim());

      } catch (error: any) {
        const is429 = error?.message?.includes('429') || error?.message?.includes('quota');
        
        if (is429 && attempt < geminiClients.length - 1) {
          console.log(`⚠️ Gemini API 키 #${attempt + 1} 할당량 초과, 다음 키로 재시도...`);
          continue; // 다음 키로 재시도
        }
        
        // 마지막 키도 실패하거나 429가 아닌 에러
        console.error('❌ Gemini 개선 실패:', error?.message || error);
        console.log('⚠️ 초안 그대로 사용');
        return draft;
      }
    }

    // 모든 키 실패 시
    console.log('⚠️ 모든 Gemini API 키 할당량 초과, 초안 그대로 사용');
    return draft;
  }

  /**
   * Step 3: Groq로 팩트 체크
   */
  private async factCheckWithGroq(
    content: NewsletterContent,
    sources: NewsArticle[]
  ) {
    if (!groq) {
      return {
        issues: [],
        trustScore: 70,
        verified: false
      };
    }

    console.log('🔍 [Step 3] Groq로 팩트 체크 중...');

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a fact-checker. Output valid JSON only.'
        },
        {
          role: 'user',
          content: PROMPTS.factCheck(JSON.stringify(content), sources)
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(text);
  }

  /**
   * Fallback: Gemini 단독 사용 (API 키 로테이션 지원)
   */
  private async fallbackGenerate(
    interest: string,
    articles: NewsArticle[]
  ): Promise<GenerationResult> {
    if (geminiClients.length === 0) {
      throw new Error('사용 가능한 AI 엔진이 없습니다');
    }

    console.log('🔄 [Fallback] Gemini 단독 모드');

    // 모든 API 키 시도 (로테이션)
    for (let attempt = 0; attempt < geminiClients.length; attempt++) {
      try {
        const gemini = getGeminiClient();
        if (!gemini) break;

        const model = gemini.getGenerativeModel({
          model: 'gemini-2.0-flash-exp'
        });

        const prompt = PROMPTS.mainGeneration(interest, articles);
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?```/) ||
                          text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

        console.log(`✅ Gemini API 키 #${attempt + 1} 성공 (Fallback)`);
        
        return {
          newsletter: JSON.parse(cleanJson.trim()),
          validation: {
            trustScore: 75,
            verified: false,
            issues: []
          },
          metadata: {
            enginesUsed: [`Gemini 2.0 Flash (키 #${attempt + 1})`],
            processingTime: Date.now() - this.startTime
          }
        };

      } catch (error: any) {
        const is429 = error?.message?.includes('429') || error?.message?.includes('quota');
        
        if (is429 && attempt < geminiClients.length - 1) {
          console.log(`⚠️ Gemini API 키 #${attempt + 1} 할당량 초과 (Fallback), 다음 키로 재시도...`);
          continue;
        }
        
        // 마지막 키도 실패
        if (attempt === geminiClients.length - 1) {
          throw new Error(`모든 Gemini API 키 할당량 초과: ${error?.message || error}`);
        }
      }
    }

    throw new Error('Gemini Fallback 실패');
  }

  /**
   * 메인 생성 함수
   */
  async generate(
    interest: string,
    articles: NewsArticle[]
  ): Promise<GenerationResult> {
    this.startTime = Date.now();

    try {
      // Step 1: Groq로 초안 생성
      const draft = await this.generateWithGroq(interest, articles);
      console.log('✅ 초안 완성');

      // Step 2: Gemini로 한국어 개선
      const improved = await this.improveWithGemini(draft);
      console.log('✅ 한국어 개선 완성');

      // Step 3: Groq로 팩트 체크
      const validation = await this.factCheckWithGroq(improved, articles);
      console.log('✅ 팩트 체크 완성');

      return {
        newsletter: improved,
        validation,
        metadata: {
          enginesUsed: [
            'Groq Llama 3.1 8B',
            'Gemini 2.0 Flash',
            'Groq Llama 3.3 70B'
          ],
          processingTime: Date.now() - this.startTime
        }
      };

    } catch (error) {
      console.error('❌ 멀티엔진 실패, Fallback으로 전환:', error);
      return this.fallbackGenerate(interest, articles);
    }
  }
}

/**
 * 싱글턴 인스턴스
 */
let generator: NewsletterGenerator | null = null;

export function getNewsletterGenerator(): NewsletterGenerator {
  if (!generator) {
    generator = new NewsletterGenerator();
  }
  return generator;
}
