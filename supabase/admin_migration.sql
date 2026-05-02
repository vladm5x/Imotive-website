-- Admin panel migration
-- Run this in the Supabase SQL Editor once.

-- Add admin review columns to scholarships_raw
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS admin_notes      text;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS reviewed_by      text;

-- Normalize all 'needs_review' rows to 'pending_review' so the admin panel
-- has one consistent status value for the queue.
UPDATE scholarships_raw
SET review_status = 'pending_review'
WHERE review_status = 'needs_review' OR review_status IS NULL;

-- Change column default so new rows from the scraper land in the right bucket.
-- Also update functions/scraper.js if it hard-codes 'needs_review'.
ALTER TABLE scholarships_raw
  ALTER COLUMN review_status SET DEFAULT 'pending_review';

-- Performance indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_scholarships_raw_reviewed_at
  ON scholarships_raw (reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_scholarships_raw_source
  ON scholarships_raw (source);

-- ── RLS for admin write access ─────────────────────────────────────────────
-- scholarships_raw has no RLS today, so it is readable/writable by the anon
-- key. Enable RLS only when you are ready to lock it down. The policies below
-- are written but commented out — uncomment once you set app_metadata.role
-- on admin users via the Supabase dashboard (Auth → Users → Edit user →
-- app_metadata: { "role": "admin" }).

-- ALTER TABLE scholarships_raw ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Public can read approved scholarships" ON scholarships_raw;
-- CREATE POLICY "Public can read approved scholarships"
--   ON scholarships_raw FOR SELECT
--   USING (review_status = 'approved');

-- DROP POLICY IF EXISTS "Admins have full access" ON scholarships_raw;
-- CREATE POLICY "Admins have full access"
--   ON scholarships_raw FOR ALL
--   USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
--   WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
