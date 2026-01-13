// app/lib/newsletter-generator.ts
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 환경변수 체크
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GROQ_API_KEY || !GEMINI_API_KEY) {
  console.warn('⚠️ API 키가 설정되지 않았습니다');
}

// 클라이언트 초기화
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const gemini = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

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
    generatedAt: string;
    processingTime: number;
  };
}

/**
 * 고품질 프롬프트 - Morning Brew 스타일
 */
const PROMPTS = {
  mainGeneration: (interest: string, articles: NewsArticle[]) => `
당신은 Morning Brew 스타일의 전문 뉴스 에디터입니다.

📌 미션: ${interest} 분야의 뉴스를 5분 안에 읽을 수 있는 매력적인 뉴스레터로 만들기

📰 주어진 뉴스 (최신순):
${articles.slice(0, 8).map((a, i) => `
${i + 1}. ${a.title}
   출처: ${a.source}
   내용: ${a.description}
   링크: ${a.link}
`).join('\n')}

✍️ 작성 규칙 (엄수):
1. 톤앤매너
   - 친근하고 대화하듯이 작성 (존댓말 사용)
   - 딱딱하지 않고 쉽게 읽히도록
   - 예시: "주목할 만한 소식이에요" ✅ / "주목할 만하다" ❌

2. 구조
   - 제목: 한 줄로 핵심 전달 (20자 이내)
   - 요약: 2-3문장으로 핵심만 (각 문장 20단어 이내)
   - 이모지: 각 뉴스에 어울리는 이모지 1개

3. 번역체 절대 금지
   ❌ "~에 대해", "~에 있어", "~에 관해", "~함에 있어"
   ✅ "~을", "~에서", "~에 대한", "~할 때"

4. 품질
   - 사실 왜곡 금지
   - 과장 금지
   - 출처와 일치하는 내용만

📊 출력 형식 (JSON만):
{
  "mainNews": [
    {
      "emoji": "🚀",
      "title": "한 줄 제목",
      "summary": "첫 문장. 두 번째 문장. 세 번째 문장.",
      "category": "기술",
      "readTime": "1분",
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
   - 존댓말 일관성 유지
   - 톤앤매너 유지

⚠️ JSON 구조는 절대 변경 금지
- emoji, title, summary, category, readTime, sourceLink 필드 유지
- 배열 순서 유지
`,

  factCheck: (content: string, sources: NewsArticle[]) => `
당신은 뉴스 팩트체커입니다.

📰 생성된 뉴스레터:
${content}

📚 원본 출처:
${sources.map((s, i) => `${i + 1}. ${s.title}\n   ${s.description}\n   ${s.link}`).join('\n\n')}

🔍 검증 항목:
1. 사실 왜곡 여부
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
          content: 'You are a professional newsletter editor. Always output valid JSON only.'
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

    const content = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  }

  /**
   * Step 2: Gemini로 한국어 품질 개선
   */
  private async improveWithGemini(
    draft: NewsletterContent
  ): Promise<NewsletterContent> {
    if (!gemini) {
      console.log('⚠️ Gemini API 키 없음, 개선 단계 스킵');
      return draft;
    }

    console.log('✨ [Step 2] Gemini로 한국어 개선 중...');

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

    return JSON.parse(cleanJson.trim());
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
   * Fallback: Gemini 단독 사용
   */
  private async fallbackGenerate(
    interest: string,
    articles: NewsArticle[]
  ): Promise<GenerationResult> {
    if (!gemini) {
      throw new Error('사용 가능한 AI 엔진이 없습니다');
    }

    console.log('🔄 [Fallback] Gemini 단독 모드');

    const model = gemini.getGenerativeModel({
      model: 'gemini-2.0-flash-exp'
    });

    const prompt = PROMPTS.mainGeneration(interest, articles);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?```/) ||
                      text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    return {
      newsletter: JSON.parse(cleanJson.trim()),
      validation: {
        trustScore: 70,
        verified: false,
        issues: []
      },
      metadata: {
        enginesUsed: ['Gemini 2.0 Flash (Fallback)'],
        generatedAt: new Date().toISOString(),
        processingTime: Date.now() - this.startTime
      }
    };
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
      // Step 1: Groq로 초안
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
        // 경고 메시지를 첫 번째 뉴스에 추가
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

// 싱글톤 인스턴스
let generatorInstance: NewsletterGenerator | null = null;

export function getNewsletterGenerator(): NewsletterGenerator {
  if (!generatorInstance) {
    generatorInstance = new NewsletterGenerator();
  }
  return generatorInstance;
}
