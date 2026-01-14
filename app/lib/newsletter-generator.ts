// app/lib/newsletter-generator.ts
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

function cleanJsonString(jsonStr: string): string {
  let cleaned = jsonStr
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  cleaned = cleaned.replace(/\\\\/g, '\\');
  
  return cleaned;
}

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

⚠️ CRITICAL JSON RULES (반드시 준수):

1. 🎯 EMOJI 필드 규칙 (매우 중요!)
   ❌ 절대 금지: ":)", ":D", "^^", ";)" 같은 텍스트 이모티콘
   ✅ 반드시 사용: 🚀 💡 📊 🎯 🔥 💼 📱 🌟 ⚡ 🏆 같은 유니코드 이모지
   
   올바른 예시:
   "emoji": "🚀"  ✅
   "emoji": "💡"  ✅
   "emoji": "📊"  ✅
   
   잘못된 예시:
   "emoji": ":)"  ❌
   "emoji": ""    ❌
   "emoji": "smile" ❌

2. 🔧 JSON 포맷 규칙
   - 문자열 끝에 \\n 금지
   - 모든 필드는 쌍따옴표(")로 감싸기
   - 마지막 속성 뒤에 쉼표(,) 금지
   
   올바른 예시:
   "title": "한 줄 제목"  ✅
   
   잘못된 예시:
   "title": "한 줄 제목",\\n  ❌
   "title": "한 줄 제목",     ❌ (마지막에 쉼표)

3. ✍️ 작성 규칙
   - 제목: 20자 이내
   - 요약: 2-3문장 (각 문장 20단어 이내)
   - 번역체 금지 ("~에 대해" → "~을")
   - 친근한 존댑말 사용

4. 🔥 출처 유지 (필수!)
   - source 필드는 원본 그대로 유지
   - "토스", "카카오", "네이버 뉴스" 등 변경 금지

📊 출력 형식 (정확히 이 형식으로!):

{
  "mainNews": [
    {
      "emoji": "🚀",
      "title": "AI 기술 발전",
      "summary": "최신 AI 기술이 발표됐어요. 성능이 크게 개선됐습니다.",
      "category": "기술",
      "readTime": "1분",
      "source": "토스",
      "sourceLink": "https://example.com"
    },
    {
      "emoji": "💡",
      "title": "스타트업 투자 유치",
      "summary": "국내 스타트업이 투자를 받았어요. 글로벌 진출을 준비합니다.",
      "category": "경제",
      "readTime": "2분",
      "source": "카카오",
      "sourceLink": "https://example.com"
    }
  ],
  "quickNews": [
    {
      "text": "간단한 한 줄 뉴스",
      "link": "https://example.com"
    }
  ]
}

⚠️ 최종 체크:
- mainNews: 3-5개
- quickNews: 3-5개
- 모든 emoji는 실제 유니코드 이모지 (🚀, 💡, 📊 등)
- 문자열 끝에 \\n 없음
- 유효한 JSON만 출력
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

⚠️ JSON 구조는 절대 변경 금지
- emoji, title, summary, category, readTime, source, sourceLink 필드 유지
- 배열 순서 유지
- source 필드는 절대 변경하지 말 것!
- emoji가 텍스트 이모티콘(":)")이면 유니코드 이모지(🚀)로 교체
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

export class NewsletterGenerator {
  private startTime: number = 0;
  private groq: Groq | null = null;
  private geminiClients: GoogleGenerativeAI[] = [];
  private currentGeminiIndex = 0;

  constructor() {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEYS_RAW = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const GEMINI_API_KEYS = GEMINI_API_KEYS_RAW.split(',').map(k => k.trim()).filter(Boolean);

    this.groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
    this.geminiClients = GEMINI_API_KEYS.map(key => new GoogleGenerativeAI(key));

    console.log(`🔑 Groq API 키: ${this.groq ? '설정됨' : '없음'}`);
    console.log(`🔑 Gemini API 키: ${this.geminiClients.length}개 로드됨`);
  }

  private getGeminiClient(): GoogleGenerativeAI | null {
    if (this.geminiClients.length === 0) return null;
    
    const client = this.geminiClients[this.currentGeminiIndex];
    this.currentGeminiIndex = (this.currentGeminiIndex + 1) % this.geminiClients.length;
    
    return client;
  }

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
          content: `You are a professional newsletter editor. CRITICAL RULES:
1. NEVER use text emoticons like :) :D ^^ ;) in the "emoji" field
2. ALWAYS use real Unicode emojis like 🚀 💡 📊 🎯 🔥 in the "emoji" field
3. NEVER add \\n at the end of string values
4. Output ONLY valid JSON - no markdown, no code blocks, no explanations
5. Never use HTML entities like &quot; - use proper escape sequences`
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

  private async improveWithGemini(
    draft: NewsletterContent
  ): Promise<NewsletterContent> {
    if (this.geminiClients.length === 0) {
      console.log('⚠️ Gemini API 키 없음, 개선 단계 스킵');
      return draft;
    }

    console.log('✨ [Step 2] Gemini로 한국어 개선 중...');

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

  private async fallbackGenerate(
    interest: string,
    articles: NewsArticle[]
  ): Promise<GenerationResult> {
    if (this.geminiClients.length === 0) {
      throw new Error('사용 가능한 AI 엔진이 없습니다');
    }

    console.log('🔄 [Fallback] Gemini 단독 모드');

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

  async generate(
    interest: string,
    articles: NewsArticle[]
  ): Promise<GenerationResult> {
    this.startTime = Date.now();
    
    console.log(`🔑 Gemini API 키: ${this.geminiClients.length}개 사용 가능`);

    try {
      const draft = await this.generateWithGroq(interest, articles);
      console.log('✅ 초안 완성');

      const improved = await this.improveWithGemini(draft);
      console.log('✅ 한국어 개선 완성');

      const validation = await this.factCheckWithGroq(improved, articles);
      console.log('✅ 팩트 체크 완성');

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

let generatorInstance: NewsletterGenerator | null = null;

export function getNewsletterGenerator(): NewsletterGenerator {
  if (!generatorInstance) {
    generatorInstance = new NewsletterGenerator();
  }
  return generatorInstance;
}
