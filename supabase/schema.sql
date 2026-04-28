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

-- Add application_url — direct link to the application form/portal (safe to run on existing table)
ALTER TABLE scholarships_raw ADD COLUMN IF NOT EXISTS application_url text;
ALTER TABLE scholarships_expired ADD COLUMN IF NOT EXISTS application_url text;

-- ─── scrape_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scrape_logs (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp        timestamptz DEFAULT now(),
  total_attempted  integer,
  success_count    integer,
  fail_count       integer,
  blocked_count    integer
);
