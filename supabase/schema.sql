-- ─── scholarships_raw ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scholarships_raw (
  application_url       text,
  id                    text PRIMARY KEY,
  title                 text NOT NULL,
  amount                text,
  deadline              text,
  category              text,
  level                 text[],
  fields                text[],
  nationality           text[],
  interests             text[],
  need                  text[],
  source                text,
  url                   text,
  eligibility           text,
  documents             text,
  instructions          text,
  requirement_keywords  text[],
  required_applicant_info text[],
  scrape_success        boolean DEFAULT true,
  blocked               boolean DEFAULT false,
  requires_login        boolean DEFAULT false,
  expired               boolean DEFAULT false,
  quality_score         integer DEFAULT 50,
  quality_flags         text[] DEFAULT '{}',
  review_status         text DEFAULT 'needs_review',
  date_scraped          timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Repair existing tables created before id was a primary key.
-- Supabase upsert(..., { onConflict: 'id' }) requires id to be unique.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'scholarships_raw'::regclass
      AND conname = 'scholarships_raw_pkey'
  ) THEN
    ALTER TABLE scholarships_raw ADD CONSTRAINT scholarships_raw_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Auto-update updated_at on upsert
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scholarships_raw_updated_at ON scholarships_raw;
CREATE TRIGGER trg_scholarships_raw_updated_at
  BEFORE UPDATE ON scholarships_raw
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── scholarships_expired ────────────────────────────────────────────────────
-- Mirror of scholarships_raw for entries whose deadline has passed
CREATE TABLE IF NOT EXISTS scholarships_expired (
  LIKE scholarships_raw INCLUDING ALL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'scholarships_expired'::regclass
      AND conname = 'scholarships_expired_pkey'
  ) THEN
    ALTER TABLE scholarships_expired ADD CONSTRAINT scholarships_expired_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add expired flag to scholarships_raw (safe to run on existing table)
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS expired boolean DEFAULT false;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 50;
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS quality_flags text[] DEFAULT '{}';
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'needs_review';

-- Add application_url — direct link to the application form/portal (safe to run on existing table)
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS application_url text;
ALTER TABLE scholarships_expired ADD COLUMN IF NOT EXISTS application_url text;
ALTER TABLE scholarships_expired ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 50;
ALTER TABLE scholarships_expired ADD COLUMN IF NOT EXISTS quality_flags text[] DEFAULT '{}';
ALTER TABLE scholarships_expired ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'needs_review';

CREATE INDEX IF NOT EXISTS idx_scholarships_raw_quality ON scholarships_raw (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_scholarships_raw_deadline ON scholarships_raw (deadline);
CREATE INDEX IF NOT EXISTS idx_scholarships_raw_review_status ON scholarships_raw (review_status);
CREATE INDEX IF NOT EXISTS idx_scholarships_raw_fields ON scholarships_raw USING gin (fields);
CREATE INDEX IF NOT EXISTS idx_scholarships_raw_level ON scholarships_raw USING gin (level);
CREATE INDEX IF NOT EXISTS idx_scholarships_raw_nationality ON scholarships_raw USING gin (nationality);

-- ─── scrape_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scrape_logs (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp        timestamptz DEFAULT now(),
  total_attempted  integer,
  success_count    integer,
  fail_count       integer,
  blocked_count    integer,
  failure_reasons  jsonb DEFAULT '{}'::jsonb,
  failure_examples jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE scrape_logs ADD COLUMN IF NOT EXISTS failure_reasons jsonb DEFAULT '{}'::jsonb;
ALTER TABLE scrape_logs ADD COLUMN IF NOT EXISTS failure_examples jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS scrape_failures (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  reason      text NOT NULL,
  source      text,
  url         text,
  status      integer,
  phase       text,
  message     text
);

CREATE INDEX IF NOT EXISTS idx_scrape_failures_created_at ON scrape_failures (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_failures_reason ON scrape_failures (reason);

-- User accounts and onboarding answers.
-- Run this in Supabase SQL Editor after enabling Authentication > Providers > Google.
CREATE TABLE IF NOT EXISTS user_profiles (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 text,
  full_name             text,
  avatar_url            text,
  university            text,
  field                 text,
  degree_level          text,
  study_year            text,
  citizenship           text,
  date_of_birth         text,
  interests             text[] DEFAULT '{}',
  gpa                   text,
  financial_need        text,
  goals                 text,
  answers               jsonb DEFAULT '{}'::jsonb,
  onboarding_completed  boolean DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
CREATE POLICY "Users can read their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Saved scholarships and application progress.
CREATE TABLE IF NOT EXISTS saved_scholarships (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scholarship_id  text NOT NULL REFERENCES scholarships_raw(id) ON DELETE CASCADE,
  status          text DEFAULT 'saved',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, scholarship_id)
);

DROP TRIGGER IF EXISTS trg_saved_scholarships_updated_at ON saved_scholarships;
CREATE TRIGGER trg_saved_scholarships_updated_at
  BEFORE UPDATE ON saved_scholarships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE saved_scholarships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their saved scholarships" ON saved_scholarships;
CREATE POLICY "Users can read their saved scholarships"
  ON saved_scholarships FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their saved scholarships" ON saved_scholarships;
CREATE POLICY "Users can insert their saved scholarships"
  ON saved_scholarships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their saved scholarships" ON saved_scholarships;
CREATE POLICY "Users can update their saved scholarships"
  ON saved_scholarships FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their saved scholarships" ON saved_scholarships;
CREATE POLICY "Users can delete their saved scholarships"
  ON saved_scholarships FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS application_progress (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scholarship_id     text NOT NULL REFERENCES scholarships_raw(id) ON DELETE CASCADE,
  status             text DEFAULT 'not_started',
  checklist          jsonb DEFAULT '[]'::jsonb,
  missing_info       text[] DEFAULT '{}',
  reminder_at        timestamptz,
  submitted_at       timestamptz,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (user_id, scholarship_id)
);

DROP TRIGGER IF EXISTS trg_application_progress_updated_at ON application_progress;
CREATE TRIGGER trg_application_progress_updated_at
  BEFORE UPDATE ON application_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE application_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their application progress" ON application_progress;
CREATE POLICY "Users can read their application progress"
  ON application_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their application progress" ON application_progress;
CREATE POLICY "Users can insert their application progress"
  ON application_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their application progress" ON application_progress;
CREATE POLICY "Users can update their application progress"
  ON application_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their application progress" ON application_progress;
CREATE POLICY "Users can delete their application progress"
  ON application_progress FOR DELETE
  USING (auth.uid() = user_id);
