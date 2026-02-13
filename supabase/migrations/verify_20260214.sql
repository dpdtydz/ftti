-- ================================================
-- Verification Script: 20260214_fix_referral_logic.sql
-- ================================================
-- Run this in your Supabase SQL Editor to verify the migration.

DO $$
BEGIN
    -- 1. Check if 'referral_code' column exists in 'user_profiles'
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'referral_code'
    ) THEN
        RAISE NOTICE '✅ [PASS] Column: user_profiles.referral_code exists';
    ELSE
        RAISE NOTICE '❌ [FAIL] Column: user_profiles.referral_code MISSING';
    END IF;

    -- 2. Check if 'referral_code' is unique (CONSTRAINT check)
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'user_profiles_referral_code_key'
    ) THEN
         RAISE NOTICE '✅ [PASS] Unique constraint on user_profiles.referral_code exists';
    ELSE
         -- Name might differ if added manually without explicit naming, but let's check index
         IF EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE tablename = 'user_profiles' AND indexdef LIKE '%referral_code%'
         ) THEN
             RAISE NOTICE '⚠️ [WARN] Unique constraint on user_profiles.referral_code might exist (Index found), please verify manually if needed.';
         ELSE
             RAISE NOTICE '❌ [FAIL] Unique constraint/Index on user_profiles.referral_code MISSING';
         END IF;
    END IF;

    -- 3. Check if 'get_or_create_referral_code' function exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_name = 'get_or_create_referral_code'
    ) THEN
        RAISE NOTICE '✅ [PASS] Function: get_or_create_referral_code exists';
    ELSE
        RAISE NOTICE '❌ [FAIL] Function: get_or_create_referral_code MISSING';
    END IF;

    -- 4. Check if 'referrals' table constraint 'referrals_referral_code_key' is removed
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'referrals_referral_code_key'
    ) THEN
        RAISE NOTICE '✅ [PASS] Constraint: referrals_referral_code_key removed';
    ELSE
        RAISE NOTICE '❌ [FAIL] Constraint: referrals_referral_code_key STILL EXISTS (Should be removed to allow multiple uses)';
    END IF;

END $$;

-- 5. Data Sampling: Check if users have referral codes populated
SELECT 
    count(*) FILTER (WHERE referral_code IS NOT NULL) as users_with_code,
    count(*) as total_users
FROM user_profiles;

-- 6. Sample Data
SELECT id, email, referral_code FROM user_profiles ORDER BY created_at DESC LIMIT 5;
