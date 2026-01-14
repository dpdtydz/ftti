-- ================================================
-- Referral Program
-- ================================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, rewarded
  reward_type TEXT, -- premium_week, premium_month
  reward_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);

-- 사용자별 추천 코드 생성 함수
CREATE OR REPLACE FUNCTION generate_referral_code(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- 6자리 랜덤 코드 생성
    code := upper(substring(md5(random()::text || user_id::text) from 1 for 6));
    
    -- 중복 체크
    SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = code) INTO exists;
    
    IF NOT exists THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Email Tracking (Open, Click)
-- ================================================

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_send_id UUID REFERENCES newsletter_sends(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- opened, clicked
  url TEXT, -- 클릭한 URL (clicked 이벤트인 경우)
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_events_send ON email_events(newsletter_send_id);
CREATE INDEX idx_email_events_user ON email_events(user_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_created ON email_events(created_at);

-- ================================================
-- Interactive Features (Quiz, Poll, Feedback)
-- ================================================

CREATE TABLE IF NOT EXISTS newsletter_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_send_id UUID REFERENCES newsletter_sends(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL, -- quiz, poll, rating, comment
  question_id TEXT, -- 퀴즈/투표 문항 ID
  answer TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_send ON newsletter_feedback(newsletter_send_id);
CREATE INDEX idx_feedback_user ON newsletter_feedback(user_id);
CREATE INDEX idx_feedback_type ON newsletter_feedback(feedback_type);

-- ================================================
-- Analytics Views
-- ================================================

-- 추천 프로그램 리더보드
CREATE OR REPLACE VIEW referral_leaderboard AS
SELECT 
  up.id,
  up.nickname,
  up.email,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_referrals,
  COUNT(CASE WHEN r.status = 'rewarded' THEN 1 END) as rewards_claimed,
  COUNT(*) as total_referrals,
  MAX(r.created_at) as last_referral_at
FROM user_profiles up
LEFT JOIN referrals r ON r.referrer_id = up.id
GROUP BY up.id, up.nickname, up.email
ORDER BY successful_referrals DESC, total_referrals DESC;

-- 이메일 성과 대시보드 (업데이트)
CREATE OR REPLACE VIEW newsletter_performance AS
SELECT 
  ns.id,
  ns.user_id,
  ns.subject,
  ns.sent_at,
  ns.status,
  COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END) as open_count,
  COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.id END) as click_count,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END) > 0 
    THEN true 
    ELSE false 
  END as was_opened,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.id END) > 0 
    THEN true 
    ELSE false 
  END as was_clicked,
  MIN(CASE WHEN ee.event_type = 'opened' THEN ee.created_at END) as first_opened_at,
  MIN(CASE WHEN ee.event_type = 'clicked' THEN ee.created_at END) as first_clicked_at
FROM newsletter_sends ns
LEFT JOIN email_events ee ON ee.newsletter_send_id = ns.id
WHERE ns.status = 'sent'
GROUP BY ns.id, ns.user_id, ns.subject, ns.sent_at, ns.status;

-- 전체 통계 (날짜별)
CREATE OR REPLACE VIEW daily_email_stats AS
SELECT 
  DATE(ns.sent_at) as date,
  COUNT(DISTINCT ns.id) as total_sent,
  COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ns.id END) as total_opened,
  COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ns.id END) as total_clicked,
  ROUND(
    COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ns.id END)::NUMERIC / 
    NULLIF(COUNT(DISTINCT ns.id), 0) * 100, 
    2
  ) as open_rate,
  ROUND(
    COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ns.id END)::NUMERIC / 
    NULLIF(COUNT(DISTINCT ns.id), 0) * 100, 
    2
  ) as click_rate
FROM newsletter_sends ns
LEFT JOIN email_events ee ON ee.newsletter_send_id = ns.id
WHERE ns.status = 'sent'
GROUP BY DATE(ns.sent_at)
ORDER BY date DESC;

-- RLS 정책
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_feedback ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인 추천 데이터만 조회
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referrals"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- 이메일 이벤트는 시스템만 생성 (service_role)
CREATE POLICY "Service role can manage email events"
  ON email_events FOR ALL
  USING (auth.role() = 'service_role');

-- 피드백은 본인만 작성
CREATE POLICY "Users can insert own feedback"
  ON newsletter_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
  ON newsletter_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- ================================================
-- Seed Data (예시 퀴즈/투표 문항)
-- ================================================

COMMENT ON TABLE newsletter_feedback IS '
Quiz 예시:
{
  "question_id": "quiz_ai_2024_01",
  "question": "2024년 가장 화제가 된 AI 모델은?",
  "options": ["GPT-4", "Claude 3", "Gemini", "Llama 3"],
  "correct_answer": "Claude 3"
}

Poll 예시:
{
  "question_id": "poll_interest_2024_01", 
  "question": "다음 주제 중 가장 관심있는 분야는?",
  "options": ["AI/ML", "Web3", "클라우드", "보안"]
}
';
