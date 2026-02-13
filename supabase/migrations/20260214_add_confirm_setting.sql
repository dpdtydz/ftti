-- Add confirm_actions setting to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS confirm_actions BOOLEAN DEFAULT TRUE;
