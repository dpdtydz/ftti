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

/**
 * 강화된 JSON 정리 함수
 * - HTML 엔티티 디코딩
 * - 잘못된 이스케이프 시퀀스 제거
 * - 문자열 끝의 \\n 패턴 제거
 * - JSON 내부의 쌍따옴표 문제 자동 수정
 * JSON Schema for structured output
 * Groq API의 구조화된 출력을 위한 JSON Schema
 */
const NEWSLETTER_JSON_SCHEMA = {
  type: "object",
  properties: {
    mainNews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          emoji: {
            type: "string",
            description: "Unicode emoji (e.g., 🚀 💡 📊) - NO text emoticons like :) :D"
          },
          title: {
            type: "string",
            description: "News title without quotation marks, max 20 characters"
          },
          summary: {
            type: "string",
            description: "News summary without quotation marks, 2-3 sentences"
          },
          category: {
            type: "string",
            description: "News category"
          },
          readTime: {
            type: "string",
            description: "Estimated read time (e.g., 1분, 2분)"
          },
          source: {
            type: "string",
            description: "Original news source"
          },
          sourceLink: {
            type: "string",
            description: "URL to the original article"
          }
        },
        required: ["emoji", "title", "summary", "category", "readTime", "source", "sourceLink"]
      },
      minItems: 3,
      maxItems: 5
    },
    quickNews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Brief one-line news without quotation marks"
          },
          link: {
            type: "string",
            description: "URL to the news article"
          }
        },
        required: ["text", "link"]
      },
      minItems: 3,
      maxItems: 5
    }
  },
  required: ["mainNews", "quickNews"]
};

/**
 * 강화된 JSON 정리 함수
 * - HTML 엔티티 디코딩
 * - 잘못된 이스케이프 시퀀스 제거
 * - 문자열 내 쌍따옴표 자동 이스케이프
 * - 잘못된 개행 문자 제거
 */
function cleanJsonString(jsonStr: string): string {
  // 1단계: HTML 엔티티 디코딩
  let cleaned = jsonStr
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
  
  // 2단계: 잘못된 백슬래시 제거 (\\\\\\\\를 \\\\로)
  cleaned = cleaned.replace(/\\\\\\\\/g, '\\\\');
  
  // 3단계: 문자열 끝의 잘못된 \\n 패턴 제거
  // "title": "제목",\\n 또는 "title": "제목",\n 형태를 "title": "제목" 으로 변환
  cleaned = cleaned.replace(/",\\\\n\s*/g, '"');
  cleaned = cleaned.replace(/",\\n\s*/g, '"');
  cleaned = cleaned.replace(/",\s*\\n/g, '"');
  
  // 4단계: 필드 값 내부의 이스케이프되지 않은 쌍따옴표 처리
  // "title": "제목 "인용문" 포함" 형태를 "title": "제목 '인용문' 포함" 으로 안전하게 변환
  cleaned = cleaned.replace(
    /"(title|summary|text)"\s*:\s*"([^"]*?)"/g,
    (match, field, value) => {
      // 값 내부의 쌍따옴표를 찾아서 작은따옴표로 변경
      // 단, 이미 이스케이프된 \" 는 제외
      const safeValue = value.replace(/(?<!\\)"/g, "'");
      return `"${field}": "${safeValue}"`;
    }
  );
  
  // 5단계: 연속된 쉼표 제거
  cleaned = cleaned.replace(/,\s*,/g, ',');
  
  // 6단계: 배열/객체 끝의 불필요한 쉼표 제거
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  return cleaned;
}

/**
 * 강화된 JSON 복구 함수
 * 파싱 실패 시 부분적으로라도 데이터 추출 시도
 */
function attemptJsonRecovery(jsonStr: string): NewsletterContent | null {
  try {
    console.log('🔧 JSON 복구 시도 중...');
    
    const recovered: NewsletterContent = {
      mainNews: [],
      quickNews: []
    };
    
    // mainNews 배열 추출 - 더 관대한 정규식 사용
    const mainNewsMatch = jsonStr.match(/"mainNews"\s*:\s*\[([\s\S]*?)(?:\],|\]$)/);
    if (mainNewsMatch) {
      const mainNewsContent = mainNewsMatch[1];
      
      // 각 뉴스 아이템을 개별적으로 추출 (중괄호 쌍으로)
      let depth = 0;
      let currentItem = '';
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < mainNewsContent.length; i++) {
        const char = mainNewsContent[i];
        const prevChar = i > 0 ? mainNewsContent[i - 1] : '';
        
        if (escapeNext) {
          currentItem += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          currentItem += char;
          continue;
        }
        
        if (char === '"' && prevChar !== '\\') {
          inString = !inString;
        }
        
        if (!inString) {
          if (char === '{') depth++;
          if (char === '}') depth--;
        }
        
        currentItem += char;
        
        // 완전한 객체를 찾았을 때
        if (depth === 0 && currentItem.trim().endsWith('}')) {
          try {
            const cleanedItem = cleanJsonString(currentItem.trim());
            const parsed = JSON.parse(cleanedItem);
            
            if (parsed.title && parsed.summary) {
              recovered.mainNews.push({
                emoji: parsed.emoji || '📰',
                title: parsed.title,
                summary: parsed.summary,
                category: parsed.category || '뉴스',
                readTime: parsed.readTime || '2분',
                source: parsed.source || '네이버 뉴스',
                sourceLink: parsed.sourceLink || ''
              });
            }
          } catch (e) {
            // 개별 아이템 파싱 실패는 무시
          }
          currentItem = '';
        }
      }
    }
    
    // quickNews 배열 추출
    const quickNewsMatch = jsonStr.match(/"quickNews"\s*:\s*\[([\s\S]*?)(?:\],|\]$)/);
    if (quickNewsMatch) {
      const quickNewsContent = quickNewsMatch[1];
      
      // 간단한 객체 추출
      const quickItems = quickNewsContent.match(/\{[^}]*"text"[^}]*\}/g) || [];
      for (const item of quickItems) {
        try {
          const cleanedItem = cleanJsonString(item);
          const parsed = JSON.parse(cleanedItem);
          if (parsed.text) {
            recovered.quickNews.push({
              text: parsed.text,
              link: parsed.link || ''
            });
          }
        } catch {
          continue;
        }
      }
    }
    
    // 최소한의 데이터가 있으면 반환
    if (recovered.mainNews.length > 0) {
      console.log(`✅ JSON 복구 성공: mainNews ${recovered.mainNews.length}개, quickNews ${recovered.quickNews.length}개`);
      return recovered;
    }
    
    return null;
  } catch (error) {
    console.error('❌ JSON 복구 실패:', error);
    return null;
  }
}

const PROMPTS = {
  mainGeneration: (interest: string, articles: NewsArticle[], retryCount: number = 0) => {
    const strictness = retryCount > 0 ? '\n\n⚠️⚠️⚠️ CRITICAL: Previous attempt FAILED due to JSON errors. You MUST produce valid JSON this time!\n' : '';
    
    return `
당신은 Morning Brew 스타일의 전문 뉴스 에디터입니다.
${strictness}
📏 미션: ${interest} 분야의 뉴스를 5분 안에 읽을 수 있는 매력적인 뉴스레터로 만들기

📰 주어진 뉴스 (최신순):
${articles.slice(0, 10).map((a, i) => `
${i + 1}. ${a.title}
   출처: ${a.source}
   내용: ${a.description}
   링크: ${a.link}
`).join('\n')}

⚠️ CRITICAL JSON RULES (반드시 준수):

1. 🚫 제목/요약에 쌍따옴표 절대 금지
   ❌ "KDI, 근로자 인지역량 조기 감퇴…"성과 보상 없는 임금 탓""
   ✅ "KDI, 근로자 인지역량 조기 감퇴... 성과 보상 없는 임금 탓"
   
   쌍따옴표를 사용해야 한다면 작은따옴표(')로 대체:
   ✅ "KDI, 근로자 인지역량 조기 감퇴... '성과 보상 없는 임금' 탓"

2. 🚫 문자열 끝에 \\n 절대 금지
   ❌ "title": "제목",\\n
   ✅ "title": "제목"

3. 🎯 EMOJI 필드 규칙
   ❌ 절대 금지: ":)", ":D", "^^", ";)" 같은 텍스트 이모티콘
   ✅ 반드시 사용: 🚀 💡 📊 🎯 🔥 💼 📱 🌟 ⚡ 🏆 같은 유니코드 이모지

4. 🔧 JSON 포맷 규칙
   - 모든 필드는 쌍따옴표(")로 감싸기
   - 마지막 속성 뒤에 쉼표(,) 금지
   - 유효한 JSON만 출력 (코드 블록 없음)

5. ✍️ 작성 규칙
   - 제목: 20자 이내, 쌍따옴표 없이
   - 요약: 2-3문장, 쌍따옴표 없이
   - 번역체 금지
   - 친근한 존댑말

6. 🔥 출처 유지 (필수!)
   - source 필드는 원본 그대로 유지

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
- 제목/요약에 쌍따옴표 없음
- 문자열 끝에 \\n 없음
- 유효한 JSON만 출력
`;
  },

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
- 제목/요약에 쌍따옴표 사용 시 작은따옴표(')로 변경
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

  /**
   * Groq로 초안 생성 (JSON Schema + 재시도 로직)
   */
  private async generateWithGroq(
    interest: string,
    articles: NewsArticle[],
    maxRetries: number = 3
  ): Promise<NewsletterContent> {
    if (!this.groq) {
      throw new Error('Groq API 키가 설정되지 않았습니다');
    }

    console.log('🚀 [Step 1] Groq로 초안 생성 중...');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 재시도 ${attempt}/${maxRetries - 1}...`);
        }

        const completion = await this.groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a professional newsletter editor. CRITICAL RULES:
1. NEVER use quotation marks (") inside title or summary fields
2. Replace any quotation marks with single quotes (') if needed
3. NEVER use text emoticons like :) :D ^^ ;) in the "emoji" field
4. ALWAYS use real Unicode emojis like 🚀 💡 📊 🎯 🔥 in the "emoji" field
5. NEVER add \\n at the end of string values
6. Output ONLY valid JSON - no markdown, no code blocks, no explanations
7. Never use HTML entities like &quot; - use proper escape sequences
8. Follow the JSON schema exactly`
            },
            {
              role: 'user',
              content: PROMPTS.mainGeneration(interest, articles, attempt)
            }
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          max_tokens: 2500,
          response_format: { 
            type: 'json_schema',
            json_schema: {
              name: 'newsletter_schema',
              strict: true,
              schema: NEWSLETTER_JSON_SCHEMA
            }
          } as any
        });

        const rawContent = completion.choices[0]?.message?.content || '{}';
        const cleanedContent = cleanJsonString(rawContent);
        
        try {
          const parsed = JSON.parse(cleanedContent);
          console.log('✅ JSON 파싱 성공');
          
          // 추가 검증: mainNews와 quickNews가 있는지 확인
          if (!parsed.mainNews || !Array.isArray(parsed.mainNews) || parsed.mainNews.length === 0) {
            throw new Error('mainNews가 비어있거나 유효하지 않습니다');
          }
          
          return parsed;
        } catch (parseError) {
          console.error(`❌ JSON 파싱 실패 (시도 ${attempt + 1}/${maxRetries})`);
          console.error('파싱 에러:', parseError);
          
          // 마지막 시도가 아니면 계속 재시도
          if (attempt < maxRetries - 1) {
            console.log('🔄 더 엄격한 규칙으로 재생성...');
            continue;
          }
          
          // 마지막 시도: JSON 복구 시도
          console.log('🔧 JSON 복구 시도...');
          const recovered = attemptJsonRecovery(cleanedContent);
          
          if (recovered && recovered.mainNews.length > 0) {
            console.log('✅ JSON 복구 성공!');
            return recovered;
          }
          
          // 복구도 실패하면 에러
          console.error('정리된 내용 (처음 500자):', cleanedContent.substring(0, 500));
          throw parseError;
        }
      } catch (error: any) {
        console.error(`❌ Groq API 에러 (시도 ${attempt + 1}/${maxRetries}):`, error?.message || error);
        
        // JSON 파싱 에러가 아닌 API 에러인 경우
        if (!error.message?.includes('JSON') && !error.message?.includes('Unexpected') && !error.message?.includes('mainNews')) {
          // API 에러는 재시도하지 않고 바로 던지기
          throw error;
        }
        
        // 마지막 시도였다면 에러 던지기
        if (attempt === maxRetries - 1) {
          throw error;
        }
      }
    }

    throw new Error('Groq 생성 실패: 최대 재시도 횟수 초과');
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

        const prompt = PROMPTS.mainGeneration(interest, articles, 0);
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
            generatedAt: new Date().toISOString(),
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
