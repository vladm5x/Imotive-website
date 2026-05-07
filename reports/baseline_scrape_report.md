# Baseline Scrape Report

Generated: 2026-05-07T11:19:28.121Z

## Baseline Commands
- Normal scrape: `node functions/scraper.js`
- Supabase status: `node functions/scraper.js --status`
- Deep scrape was deferred until the new `--no-supabase` guard was added, because the baseline run proved the old CLI would push automatically.

## Counts From Baseline Normal Run
- Total seed scholarships loaded: unknown
- Total scraped scholarships: unknown
- Total combined scholarships: unknown
- Total active after expiry filtering/current gate: unknown
- Total passing current quality gate: unknown (0 hidden before write)
- Total pushed to Supabase: not pushed
- Sources with zero result batches: 0

## Most Common Failures
- none captured

## Obvious Weaknesses
- `data/scholarships.json` mixed seed, scraped, and merely quality-gated records as if they were public data.
- The old quality gate allowed weak rows with missing application URLs or generic instructions.
- Aggregator sources were treated too similarly to official provider sources.
- URL validation existed only as fetch-time behavior, not as a final publishability gate.
- The CLI had no real `--no-supabase` protection, so normal scrape could mutate Supabase during local testing.