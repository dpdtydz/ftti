-- 사용자 선호 발송 시간 추가
-- 오전 8시 또는 오전 10시 선택 가능

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS preferred_send_time TEXT DEFAULT '08:00';

-- 제약 조건: '08:00' 또는 '10:00'만 허용
ALTER TABLE user_profiles 
ADD CONSTRAINT check_preferred_send_time 
CHECK (preferred_send_time IN ('08:00', '10:00'));

-- 기존 사용자는 기본값 '08:00' 설정
UPDATE user_profiles 
SET preferred_send_time = '08:00' 
WHERE preferred_send_time IS NULL;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_profiles_send_time 
ON user_profiles(preferred_send_time) 
WHERE is_active = true;
