// app/lib/newsletter-generator.ts
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// API 클라이언트는 함수 내부에서 초기화됩니다 (런타임에)

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
    source: string;
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
    generatedAt: string;
    processingTime: number;
  };
}

/**
 * JSON 정리 함수 - HTML 엔티티 및 잘못된 문자 처리
 */
function cleanJsonString(jsonStr: string): string {
  // HTML 엔티티 디코딩
  let cleaned = jsonStr
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  // 잘못된 이스케이프 수정
  cleaned = cleaned.replace(/\\\\/g, '\\');
  
  return cleaned;
}

/**
 * 고품질 프롬프트 - Morning Brew 스타일
 */
const PROMPTS = {
  mainGeneration: (interest: string, articles: NewsArticle[]) => `
당신은 Morning Brew 스타일의 전문 뉴스 에디터입니다.

📏 미션: ${interest} 분야의 뉴스를 5분 안에 읽을 수 있는 매력적인 뉴스레터로 만들기

📰 주어진 뉴스 (최신순):
${articles.slice(0, 10).map((a, i) => `
${i + 1}. ${a.title}
   출처: ${a.source}
   내용: ${a.description}
   링크: ${a.link}
`).join('\n')}

✍️ 작성 규칙 (엄수):
1. 톤앤매너
   - 친근하고 대화하듯이 작성 (존댑말 사용)
   - 딱딱하지 않고 쉽게 읽히도록
   - 예시: "주목할 만한 소식이에요" ✅ / "주목할 만하다" ❌

2. 구조
   - 제목: 한 줄로 핵심 전달 (20자 이내)
   - 요약: 2-3문장으로 핵심만 (각 문장 20단어 이내)
   - 이모지: 각 뉴스에 어울리는 이모지 1개 (필수!)

3. 번역체 절대 금지
   ❌ "~에 대해", "~에 있어", "~에 관해", "~함에 있어"
   ✅ "~을", "~에서", "~에 대한", "~할 때"

4. 품질
   - 사실 왜곱 금지
   - 과장 금지
   - 출처와 일치하는 내용만

5. 🔥 출처 유지 (필수!)
   - 각 뉴스의 원본 출처(source)를 반드시 그대로 유지
   - 예: "토스", "카카오", "GeekNews", "ZDNet Korea" 등
   - 출처를 절대 변경하거나 "네이버"로 바꾸지 말 것!

6. 🚨 JSON 검증 (매우 중요!)
   - 반드시 유효한 JSON만 출력
   - 모든 문자열은 큰따옴표(")로 감싸기
   - 특수문자는 이스케이프 처리 (\", \\n 등)
   - emoji 필드는 절대 빈 문자열 금지 (반드시 이모지 입력!)
   - title 뒤에는 반드시 콜론(:) 필요

📊 출력 형식 (JSON만):
{
  "mainNews": [
    {
      "emoji": "🚀",
      "title": "한 줄 제목",
      "summary": "첫 문장. 두 번째 문장. 세 번째 문장.",
      "category": "기술",
      "readTime": "1분",
      "source": "토스",
      "sourceLink": "원문 URL"
    }
  ],
  "quickNews": [
    {
      "text": "한 줄 뉴스",
      "link": "URL"
    }
  ]
}

⚠️ 중요: 
- 반드시 유효한 JSON만 출력
- 마크다운 코드블록 사용 금지
- 설명 텍스트 포함 금지
- mainNews는 최소 3개, 최대 5개
- quickNews는 최소 3개, 최대 5개
- 각 뉴스의 source 필드는 원본 그대로 유지!
- emoji는 절대 빈 문자열 금지! (🚀, 💡, 📊, 🎯, 🔥 등 사용)
`,

  koreanImprovement: (content: string) => `
당신은 한국어 네이티브 에디터입니다.

📝 초안:
${content}

🎯 개선 목표:
1. 번역체 완전 제거
2. 자연스러운 한국어로 변환
3. 가독성 극대화

📋 체크리스트:
✅ 번역체 패턴 제거
   - "~에 대해" → "~을"
   - "~에 있어" → "~에서"
   - "~에 관해" → "~에 대한"
   - "~함에 있어" → "~할 때"

✅ 문장 다듬기
   - 한 문장 20단어 이내
   - 복잡한 문장 → 두 문장으로 분리
   - 어색한 표현 → 자연스러운 표현

✅ 일관성
   - 존댑말 일관성 유지
   - 톤앤매너 유지

⚠️ JSON 구조는 절대 변경 금지
- emoji, title, summary, category, readTime, source, sourceLink 필드 유지
- 배열 순서 유지
- 🔥 source 필드는 절대 변경하지 말 것! (원본 그대로 유지)
- emoji가 빈 문자열이면 적절한 이모지 추가 (🚀, 💡, 📊, 🎯, 🔥 등)
`,

  factCheck: (content: string, sources: NewsArticle[]) => `
당신은 뉴스 팩트체커입니다.

📰 생성된 뉴스레터:
${content}

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
  private groq: Groq | null = null;
  private geminiClients: GoogleGenerativeAI[] = [];
  private currentGeminiIndex = 0;

  constructor() {
    // 런타임에 환경변수 읽기
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEYS_RAW = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const GEMINI_API_KEYS = GEMINI_API_KEYS_RAW.split(',').map(k => k.trim()).filter(Boolean);

    // 클라이언트 초기화
    this.groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
    this.geminiClients = GEMINI_API_KEYS.map(key => new GoogleGenerativeAI(key));

    console.log(`🔑 Groq API 키: ${this.groq ? '설정됨' : '없음'}`);
    console.log(`🔑 Gemini API 키: ${this.geminiClients.length}개 로드됨`);
  }

  // Gemini 클라이언트 가져오기 (로테이션)
  private getGeminiClient(): GoogleGenerativeAI | null {
    if (this.geminiClients.length === 0) return null;
    
    const client = this.geminiClients[this.currentGeminiIndex];
    this.currentGeminiIndex = (this.currentGeminiIndex + 1) % this.geminiClients.length;
    
    return client;
  }

  /**
   * Step 1: Groq로 빠르게 초안 생성
   */
  private async generateWithGroq(
    interest: string,
    articles: NewsArticle[]
  ): Promise<NewsletterContent> {
    if (!this.groq) {
      throw new Error('Groq API 키가 설정되지 않았습니다');
    }

    console.log('🚀 [Step 1] Groq로 초안 생성 중...');

    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a professional newsletter editor. Always output valid JSON only. Never use HTML entities like &quot; - use proper JSON escape sequences instead.'
        },
        {
          role: 'user',
          content: PROMPTS.mainGeneration(interest, articles)
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 2500,
      response_format: { type: 'json_object' }
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';
    const cleanedContent = cleanJsonString(rawContent);
    
    try {
      return JSON.parse(cleanedContent);
    } catch (error) {
      console.error('❌ JSON 파싱 실패, 정리된 내용:', cleanedContent.substring(0, 500));
      throw error;
    }
  }

  /**
   * Step 2: Gemini로 한국어 품질 개선 (API 키 로테이션 지원)
   */
  private async improveWithGemini(
    draft: NewsletterContent
  ): Promise<NewsletterContent> {
    if (this.geminiClients.length === 0) {
      console.log('⚠️ Gemini API 키 없음, 개선 단계 스킵');
      return draft;
    }

    console.log('✨ [Step 2] Gemini로 한국어 개선 중...');

    // 모든 API 키 시도 (로테이션)
    for (let attempt = 0; attempt < this.geminiClients.length; attempt++) {
      try {
        const gemini = this.getGeminiClient();
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
        const rawJson = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        const cleanedJson = cleanJsonString(rawJson);

        console.log(`✅ Gemini API 키 #${attempt + 1} 성공`);
        return JSON.parse(cleanedJson.trim());

      } catch (error: any) {
        const is429 = error?.message?.includes('429') || error?.message?.includes('quota');
        
        if (is429 && attempt < this.geminiClients.length - 1) {
          console.log(`⚠️ Gemini API 키 #${attempt + 1} 할당량 초과, 다음 키로 재시도...`);
          continue;
        }
        
        console.error('❌ Gemini 개선 실패:', error?.message || error);
        console.log('⚠️ 초안 그대로 사용');
        return draft;
      }
    }

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
    if (!this.groq) {
      return {
        issues: [],
        trustScore: 70,
        verified: false
      };
    }

    console.log('🔍 [Step 3] Groq로 팩트 체크 중...');

    try {
      const completion = await this.groq.chat.completions.create({
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
      return JSON.parse(cleanJsonString(text));
    } catch (error) {
      console.error('❌ 팩트 체크 실패:', error);
      return {
        issues: [],
        trustScore: 70,
        verified: false
      };
    }
  }

  /**
   * Fallback: Gemini 단독 사용 (API 키 로테이션 지원)
   */
  private async fallbackGenerate(
    interest: string,
    articles: NewsArticle[]
  ): Promise<GenerationResult> {
    if (this.geminiClients.length === 0) {
      throw new Error('사용 가능한 AI 엔진이 없습니다');
    }

    console.log('🔄 [Fallback] Gemini 단독 모드');

    // 모든 API 키 시도 (로테이션)
    for (let attempt = 0; attempt < this.geminiClients.length; attempt++) {
      try {
        const gemini = this.getGeminiClient();
        if (!gemini) break;

        const model = gemini.getGenerativeModel({
          model: 'gemini-2.0-flash-exp'
        });

        const prompt = PROMPTS.mainGeneration(interest, articles);
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?```/) ||
                          text.match(/\{[\s\S]*\}/);
        const rawJson = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        const cleanedJson = cleanJsonString(rawJson);

        console.log(`✅ Gemini API 키 #${attempt + 1} 성공 (Fallback)`);
        
        return {
          newsletter: JSON.parse(cleanedJson.trim()),
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
        
        if (is429 && attempt < this.geminiClients.length - 1) {
          console.log(`⚠️ Gemini API 키 #${attempt + 1} 할당량 초과 (Fallback), 다음 키로 재시도...`);
          continue;
        }
        
        if (attempt === this.geminiClients.length - 1) {
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
    
    console.log(`🔑 Gemini API 키: ${this.geminiClients.length}개 사용 가능`);

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

      // 신뢰도가 낮으면 경고 추가
      if (validation.trustScore < 70) {
        if (improved.mainNews.length > 0) {
          improved.mainNews[0].summary = 
            '⚠️ 자동 생성 콘텐츠입니다. 원문을 확인해주세요.\n\n' + 
            improved.mainNews[0].summary;
        }
      }

      const processingTime = Date.now() - this.startTime;

      return {
        newsletter: improved,
        validation,
        metadata: {
          enginesUsed: [
            'Groq Llama 3.1 8B',
            'Gemini 2.0 Flash',
            'Groq Llama 3.3 70B'
          ],
          generatedAt: new Date().toISOString(),
          processingTime
        }
      };

    } catch (error) {
      console.error('❌ 멀티엔진 생성 실패:', error);
      console.log('🔄 Fallback 모드로 전환');

      return await this.fallbackGenerate(interest, articles);
    }
  }
}

// 싱글턴 인스턴스
let generatorInstance: NewsletterGenerator | null = null;

export function getNewsletterGenerator(): NewsletterGenerator {
  if (!generatorInstance) {
    generatorInstance = new NewsletterGenerator();
  }
  return generatorInstance;
}
