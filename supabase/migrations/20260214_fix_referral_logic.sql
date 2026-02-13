-- ================================================
-- Fix Referral Logic (Single-use Bug)
-- ================================================

-- 1. Add referral_code to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Populate referral_code for existing users
-- (Using the same logic as generate_referral_code function)
UPDATE user_profiles
SET referral_code = upper(substring(md5(random()::text || id::text) from 1 for 6))
WHERE referral_code IS NULL;

-- 3. Modify referrals table
-- Remove unique constraint on referral_code (since multiple people can use same code)
ALTER TABLE referrals
DROP CONSTRAINT IF EXISTS referrals_referral_code_key;

-- Rename to avoid confusion (optional, but good practice)
-- ALTER TABLE referrals RENAME COLUMN referral_code TO used_referral_code;
-- For now, we will keep the name but change the semantic meaning:
-- "Which code was used for this referral" instead of "The unique code valid for this transaction"

-- 4. Update generate_referral_code function to look up user_profiles
CREATE OR REPLACE FUNCTION get_or_create_referral_code(uid UUID)
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  existing_code TEXT;
BEGIN
  -- Check if user already has a code
  SELECT referral_code INTO existing_code FROM user_profiles WHERE id = uid;
  
  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;

  -- Generate new code
  LOOP
    code := upper(substring(md5(random()::text || uid::text) from 1 for 6));
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE referral_code = code) THEN
      -- Update user profile
      UPDATE user_profiles SET referral_code = code WHERE id = uid;
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Helper to calculate referral stats
CREATE OR REPLACE VIEW referral_stats_view AS
SELECT 
  referrer_id,
  COUNT(CASE WHEN status = 'completed' OR status = 'rewarded' THEN 1 END) as successful_referrals,
  count(*) as total_attempts
FROM referrals
GROUP BY referrer_id;
