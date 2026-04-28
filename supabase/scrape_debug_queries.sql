-- Scrape debugging queries for Supabase SQL Editor.

-- Failure types across all runs.
SELECT
  reason,
  count(*) AS failures
FROM scrape_failures
GROUP BY reason
ORDER BY failures DESC;

-- Most recent failure examples.
SELECT
  reason,
  source,
  status,
  phase,
  url,
  message,
  created_at
FROM scrape_failures
ORDER BY created_at DESC
LIMIT 100;

-- Latest scrape runs with failure summaries.
SELECT
  timestamp,
  total_attempted,
  success_count,
  fail_count,
  blocked_count,
  failure_reasons
FROM scrape_logs
ORDER BY timestamp DESC
LIMIT 20;

-- Find URLs that repeatedly fail, so they can be fixed or removed.
SELECT
  url,
  reason,
  count(*) AS failures,
  max(created_at) AS last_failed_at
FROM scrape_failures
WHERE url IS NOT NULL
GROUP BY url, reason
HAVING count(*) > 1
ORDER BY failures DESC, last_failed_at DESC;
