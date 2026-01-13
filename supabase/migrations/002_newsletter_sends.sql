-- newsletter_sends 테이블 추가
-- 뉴스레터 발송 기록 및 성과 추적

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 발송 정보
  subject TEXT NOT NULL,
  content JSONB NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent', -- sent, failed, pending
  
  -- AI 생성 메타데이터
  trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
  engines_used TEXT[],
  processing_time INTEGER, -- milliseconds
  
  -- 성과 측정
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  
  -- 에러 로깅
  error_message TEXT,
  
  -- A/B 테스트
  ab_test_id UUID,
  ab_group TEXT, -- A, B
  
  -- 인덱스
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 추가 (쿼리 최적화)
CREATE INDEX idx_newsletter_sends_user_id ON newsletter_sends(user_id);
CREATE INDEX idx_newsletter_sends_sent_at ON newsletter_sends(sent_at DESC);
CREATE INDEX idx_newsletter_sends_status ON newsletter_sends(status);
CREATE INDEX idx_newsletter_sends_opened_at ON newsletter_sends(opened_at) WHERE opened_at IS NOT NULL;

-- Row Level Security 활성화
ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 발송 기록만 조회 가능
CREATE POLICY "Users can view their own sends"
  ON newsletter_sends
  FOR SELECT
  USING (auth.uid() = user_id);

-- 정책: 서비스 role은 모든 작업 가능
CREATE POLICY "Service role can do everything"
  ON newsletter_sends
  FOR ALL
  USING (auth.role() = 'service_role');

-- 뷰: 실시간 대시보드 데이터
CREATE OR REPLACE VIEW newsletter_dashboard AS
SELECT 
  DATE(sent_at) as date,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
  COUNT(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 END) as unsubscribed,
  ROUND(AVG(trust_score), 2) as avg_trust_score,
  ROUND(AVG(processing_time), 2) as avg_processing_time
FROM newsletter_sends
GROUP BY DATE(sent_at)
ORDER BY date DESC;

-- 뷰: 관심사별 성과
CREATE OR REPLACE VIEW newsletter_by_interest AS
SELECT 
  u.interests,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN ns.opened_at IS NOT NULL THEN 1 END) as opened,
  COUNT(CASE WHEN ns.clicked_at IS NOT NULL THEN 1 END) as clicked,
  ROUND(
    100.0 * COUNT(CASE WHEN ns.opened_at IS NOT NULL THEN 1 END) / COUNT(*), 
    2
  ) as open_rate,
  ROUND(
    100.0 * COUNT(CASE WHEN ns.clicked_at IS NOT NULL THEN 1 END) / 
    NULLIF(COUNT(CASE WHEN ns.opened_at IS NOT NULL THEN 1 END), 0), 
    2
  ) as click_rate
FROM newsletter_sends ns
JOIN users u ON ns.user_id = u.id
WHERE ns.status = 'sent'
GROUP BY u.interests
ORDER BY open_rate DESC;

-- 트리거: 발송 후 통계 업데이트
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' THEN
    UPDATE users
    SET 
      last_newsletter_sent = NEW.sent_at,
      total_newsletters_sent = COALESCE(total_newsletters_sent, 0) + 1
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER newsletter_sent_trigger
  AFTER INSERT ON newsletter_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();

-- users 테이블에 통계 컬럼 추가 (없다면)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS last_newsletter_sent TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS total_newsletters_sent INTEGER DEFAULT 0;
