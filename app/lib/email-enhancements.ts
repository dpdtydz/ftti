/**
 * 이메일 트래킹 및 인터랙티브 요소 유틸리티
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ftti-umber.vercel.app';

/**
 * 오픈 트래킹 픽셀 생성
 */
export function generateOpenTrackingPixel(sendId: string, userId: string): string {
  return `<img src="${APP_URL}/api/tracking/open?id=${sendId}&u=${userId}" width="1" height="1" style="display:none" alt="" />`;
}

/**
 * 클릭 트래킹 URL 생성
 */
export function generateClickTrackingUrl(
  originalUrl: string,
  sendId: string,
  userId: string
): string {
  const encoded = encodeURIComponent(originalUrl);
  return `${APP_URL}/api/tracking/click?id=${sendId}&u=${userId}&url=${encoded}`;
}

/**
 * 이메일 내 모든 링크에 클릭 트래킹 추가
 */
export function addClickTracking(html: string, sendId: string, userId: string): string {
  // 모든 <a> 태그의 href를 트래킹 URL로 교체
  return html.replace(
    /href=["']([^"']+)["']/g,
    (match, url) => {
      // 이미 트래킹 URL이거나 mailto, tel 등은 제외
      if (url.includes('/api/tracking/') || url.startsWith('mailto:') || url.startsWith('tel:')) {
        return match;
      }
      const trackingUrl = generateClickTrackingUrl(url, sendId, userId);
      return `href="${trackingUrl}"`;
    }
  );
}

/**
 * 퀴즈 생성
 */
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer?: string;
}

export function generateQuiz(
  quiz: QuizQuestion,
  sendId: string,
  userId: string
): string {
  const buttons = quiz.options
    .map(
      (option) => `
    <a href="${APP_URL}/api/feedback?id=${sendId}&u=${userId}&type=quiz&q=${quiz.id}&answer=${encodeURIComponent(option)}"
       style="display:inline-block;background-color:#667eea;color:white;padding:12px 24px;margin:4px;text-decoration:none;border-radius:8px;font-weight:500;">
      ${option}
    </a>
  `
    )
    .join('');

  return `
    <div style="background:#f7fafc;border-radius:12px;padding:24px;margin:24px 0;">
      <h3 style="color:#667eea;margin:0 0 16px 0;font-size:18px;">📝 오늘의 퀴즈</h3>
      <p style="color:#4a5568;margin:0 0 20px 0;font-size:16px;">${quiz.question}</p>
      <div style="text-align:center;">
        ${buttons}
      </div>
    </div>
  `;
}

/**
 * 투표 생성
 */
export interface PollQuestion {
  id: string;
  question: string;
  options: string[];
}

export function generatePoll(
  poll: PollQuestion,
  sendId: string,
  userId: string
): string {
  const buttons = poll.options
    .map(
      (option) => `
    <a href="${APP_URL}/api/feedback?id=${sendId}&u=${userId}&type=poll&q=${poll.id}&answer=${encodeURIComponent(option)}"
       style="display:inline-block;background-color:#48bb78;color:white;padding:12px 24px;margin:4px;text-decoration:none;border-radius:8px;font-weight:500;">
      ${option}
    </a>
  `
    )
    .join('');

  return `
    <div style="background:#f0fff4;border-radius:12px;padding:24px;margin:24px 0;">
      <h3 style="color:#48bb78;margin:0 0 16px 0;font-size:18px;">📊 독자 투표</h3>
      <p style="color:#4a5568;margin:0 0 20px 0;font-size:16px;">${poll.question}</p>
      <div style="text-align:center;">
        ${buttons}
      </div>
    </div>
  `;
}

/**
 * 별점 피드백 생성
 */
export function generateRating(sendId: string, userId: string): string {
  const stars = [5, 4, 3, 2, 1]
    .map(
      (rating) => `
    <a href="${APP_URL}/api/feedback?id=${sendId}&u=${userId}&type=rating&rating=${rating}"
       style="display:inline-block;font-size:32px;margin:0 4px;text-decoration:none;">
      ⭐
    </a>
  `
    )
    .join('');

  return `
    <div style="background:#fff5f5;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <h3 style="color:#f56565;margin:0 0 16px 0;font-size:18px;">⭐ 오늘 뉴스레터는 어떠셨나요?</h3>
      <div style="font-size:14px;color:#718096;margin-bottom:16px;">별을 클릭해서 평가해주세요</div>
      <div>
        ${stars}
      </div>
    </div>
  `;
}

/**
 * 완전한 뉴스레터 HTML에 트래킹 및 인터랙티브 요소 추가
 */
export interface EmailEnhancementOptions {
  sendId: string;
  userId: string;
  quiz?: QuizQuestion;
  poll?: PollQuestion;
  includeRating?: boolean;
}

export function enhanceNewsletterEmail(
  originalHtml: string,
  options: EmailEnhancementOptions
): string {
  let enhanced = originalHtml;

  // 1. 모든 링크에 클릭 트래킹 추가
  enhanced = addClickTracking(enhanced, options.sendId, options.userId);

  // 2. 인터랙티브 요소를 </body> 태그 앞에 삽입
  const interactiveElements: string[] = [];

  if (options.quiz) {
    interactiveElements.push(generateQuiz(options.quiz, options.sendId, options.userId));
  }

  if (options.poll) {
    interactiveElements.push(generatePoll(options.poll, options.sendId, options.userId));
  }

  if (options.includeRating !== false) {
    // 기본값 true
    interactiveElements.push(generateRating(options.sendId, options.userId));
  }

  const interactiveHtml = interactiveElements.join('\n');

  // body 태그 종료 직전에 삽입
  enhanced = enhanced.replace('</body>', `${interactiveHtml}</body>`);

  // 3. 오픈 트래킹 픽셀을 </body> 태그 앞에 추가
  const trackingPixel = generateOpenTrackingPixel(options.sendId, options.userId);
  enhanced = enhanced.replace('</body>', `${trackingPixel}</body>`);

  return enhanced;
}

/**
 * 예시 퀴즈/투표 데이터
 */
export const SAMPLE_QUIZZES: QuizQuestion[] = [
  {
    id: 'quiz_ai_2024_01',
    question: '2024년 가장 화제가 된 AI 모델은?',
    options: ['GPT-4', 'Claude 3', 'Gemini', 'Llama 3'],
    correctAnswer: 'Claude 3',
  },
  {
    id: 'quiz_tech_2024_01',
    question: 'Apple이 2024년 발표한 신제품은?',
    options: ['Vision Pro', 'AirPods Max 2', 'Mac Studio', 'HomePod'],
    correctAnswer: 'Vision Pro',
  },
];

export const SAMPLE_POLLS: PollQuestion[] = [
  {
    id: 'poll_interest_2024_01',
    question: '다음 주 어떤 주제가 가장 궁금하세요?',
    options: ['AI/ML', 'Web3/블록체인', '클라우드', '보안'],
  },
  {
    id: 'poll_format_2024_01',
    question: '뉴스레터 길이는 어떻게 생각하세요?',
    options: ['딱 좋아요', '좀 더 길었으면', '좀 더 짧았으면'],
  },
];
