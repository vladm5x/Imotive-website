-- Admin-only user list for Supabase SQL Editor.
-- Paste this into Supabase SQL Editor after running schema.sql.
--
-- This view combines Supabase Auth users with the iMotive onboarding profile.
-- Do not expose this view through public RLS policies or frontend code.

CREATE OR REPLACE VIEW admin_user_profiles AS
SELECT
  users.id,
  users.email,
  users.created_at AS account_created_at,
  users.last_sign_in_at,
  users.raw_user_meta_data ->> 'full_name' AS auth_full_name,
  users.raw_user_meta_data ->> 'avatar_url' AS auth_avatar_url,
  profiles.full_name,
  profiles.avatar_url,
  profiles.university,
  profiles.field,
  profiles.degree_level,
  profiles.study_year,
  profiles.citizenship,
  profiles.date_of_birth,
  profiles.interests,
  profiles.gpa,
  profiles.financial_need,
  profiles.goals,
  profiles.onboarding_completed,
  profiles.answers,
  profiles.created_at AS profile_created_at,
  profiles.updated_at AS profile_updated_at
FROM auth.users AS users
LEFT JOIN public.user_profiles AS profiles
  ON profiles.id = users.id
ORDER BY users.created_at DESC;

-- Run this whenever you want the full user list:
SELECT *
FROM admin_user_profiles;

-- A compact version for quick checks:
SELECT
  email,
  COALESCE(full_name, auth_full_name) AS name,
  university,
  field,
  degree_level,
  onboarding_completed,
  last_sign_in_at,
  account_created_at
FROM admin_user_profiles
ORDER BY account_created_at DESC;
