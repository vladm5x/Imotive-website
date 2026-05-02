-- Admin panel migration
-- Run this in the Supabase SQL Editor once.

-- Add admin review columns to scholarships_raw
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS admin_notes      text;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS reviewed_by      text;

-- Normalize old rows so the admin panel has one consistent status value for
-- the main review queue. Keep publishable/hide rows reviewable in the UI too.
UPDATE scholarships_raw
SET review_status = 'pending_review'
WHERE review_status = 'needs_review' OR review_status IS NULL;

ALTER TABLE scholarships_raw
  ALTER COLUMN review_status SET DEFAULT 'pending_review';

-- Performance indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_scholarships_raw_reviewed_at
  ON scholarships_raw (reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_scholarships_raw_source
  ON scholarships_raw (source);

-- Admin/API access
-- Run this after setting the admin user's Auth app_metadata to:
-- { "role": "admin" }
--
-- The browser admin panel uses the signed-in user's JWT, not the service key.
-- Without these grants/policies, the dashboard can load but all counts show 0.

GRANT SELECT ON scholarships_raw TO anon;
GRANT SELECT, UPDATE ON scholarships_raw TO authenticated;

ALTER TABLE scholarships_raw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read publishable scholarships" ON scholarships_raw;
CREATE POLICY "Public can read publishable scholarships"
  ON scholarships_raw FOR SELECT
  TO anon, authenticated
  USING (
    review_status IN ('approved', 'publishable')
    AND COALESCE(expired, false) = false
    AND COALESCE(blocked, false) = false
    AND COALESCE(requires_login, false) = false
  );

DROP POLICY IF EXISTS "Admins can read all scholarships" ON scholarships_raw;
CREATE POLICY "Admins can read all scholarships"
  ON scholarships_raw FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update scholarship reviews" ON scholarships_raw;
CREATE POLICY "Admins can update scholarship reviews"
  ON scholarships_raw FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
