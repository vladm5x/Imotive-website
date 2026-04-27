# Scholarship Platform — Full Build Plan
*Last updated: April 27, 2026*

## Overview

A scholarship aggregation platform that scrapes scholarship data, stores it in Supabase, and lets users fill in a profile form that auto-matches and auto-fills scholarship applications — showing a progress bar for each application.

## Tech Stack

| Layer | Tool |
|-------|------|
| Scraper | Python, Playwright, BeautifulSoup4 |
| Database | Supabase (PostgreSQL) |
| Auth & API keys | Supabase Auth |
| Backend API | Supabase auto-generated API |
| Frontend | Existing website calls Supabase API |

## The 4 Phase Plan

### Phase 1 — Scrape & Store

**Status: Not started**

**Goal:** Visit scholarship pages, grab all data, store raw in Supabase.

**What the scraper does:**
- Visits each scholarship URL using Playwright, a real browser.
- Auto-accepts cookie consent banners.
- If a login wall is detected, marks `requires_login: true`, skips, and logs it.
- If blocked, CAPTCHA, or Cloudflare is detected, marks `blocked: true`, skips, and logs it.
- Extracts all of the following fields.

**Data collected per scholarship:**
- Name, organization, URL, source site
- Open date, close date, deadline notes
- Reward amount and currency
- Full description and additional info
- Eligibility: citizenship, field of study, level of study, age, GPA, gender, other criteria
- Application method: email, online form, or mail
- Required documents and required fields
- Application form URL and contact details
- All form elements found on page, including input fields, dropdowns, and checkboxes, logged as keywords
- Flags: `is_exchange`, `is_thesis`, `is_language_requirement`, `is_recurring`, `has_interview`
- Meta flags: `requires_login`, `blocked`, `cookie_accepted`
- Meta: `date_scraped`, `scrape_success`, `page_structure_notes`

**Supabase tables:**
- `scholarships_raw` — one row per scholarship, all fields above
- `scrape_logs` — every run logged with timestamp, success count, fail count, blocked count, login required count, and errors

**CLI commands:**

```bash
python scrape.py --url "https://example.com"
python scrape.py --list urls.txt
python scrape.py --status
```

**Safety:**
- Random 1-2 second delay between requests
- Respects `robots.txt`
- Never crashes — all errors are logged and skipped
- All credentials in `.env`, never hardcoded

**Repo:** Separate GitHub repo called `scholarship-scraper`, completely independent from website code.

**Done when:** Single URL test works and data appears correctly in Supabase.

### Phase 2 — Analyse & Build Dataset

**Status: Not started — start after Phase 1 has collected enough data**

**Goal:** Let the data tell us what matters. Build a frequency dataset to determine what fields and keywords appear most across all scholarships.

**What to analyse:**
- Which fields are filled in most often, shown as percent coverage per column
- Which eligibility keywords repeat most: field of study, level, country
- Which required documents appear most often
- Which flags are most common, such as `is_exchange` and `has_interview`
- What application methods are most common: email, online form, or mail

**Output:**
- A ranked list of the most common fields and keywords
- This becomes the blueprint for Phase 3's user form

**Example output:**

```text
Field of study:     mentioned in 94% of scholarships
Level of study:     mentioned in 91% of scholarships
Citizenship:        mentioned in 87% of scholarships
GPA requirement:    mentioned in 43% of scholarships
Language test:      mentioned in 38% of scholarships
Personal statement: required in 71% of scholarships
Reference letter:   required in 52% of scholarships
```

**Done when:** There is a clear ranked list of what to ask users in the form.

### Phase 3 — Build the User Profile Form

**Status: Not started — start after Phase 2**

**Goal:** Build a smart onboarding form that users fill in once. Their answers are saved as a profile in Supabase and used to match and filter scholarships.

**Form fields, based on Phase 2 findings and adjusted after analysis:**
- Field of study
- Level of study: Bachelor, Master, PhD, Other
- Citizenship / country
- Language skills: Swedish, English, other
- GPA or academic score
- Age
- Any special circumstances, such as disability or refugee status
- Exchange interest
- Thesis topic, if applicable

**Supabase:**
- Save profile to `user_profiles` table linked to the user's account
- Users can update their profile at any time

**Done when:** Users can create an account, fill in the form, and their profile is saved in Supabase.

### Phase 4 — Auto-fill & Progress Bar

**Status: Not started — start after Phase 3**

**Goal:** When a user views a scholarship, automatically map their profile to the scholarship's required fields. Show a progress bar of how complete their application is.

**How it works:**
1. User opens a scholarship page on the website.
2. System compares their saved profile against the scholarship's `required_fields`.
3. Matching fields are marked as auto-filled.
4. Missing fields are flagged as needing manual input.
5. A progress bar shows overall completion percent.

**Example UI:**

```text
Application Progress [████████░░] 75% complete

✅ Name
✅ Field of study
✅ Country
✅ Level of study
⚠️ Personal statement — write manually
⚠️ Reference letter — upload required
⚠️ Proof of enrollment — upload required
```

**Why this is powerful:**
- Users see exactly how much work each scholarship needs.
- They naturally prioritise scholarships where they are already 80-90% done.
- Reduces drop-off because applications feel achievable.
- Makes the platform sticky because users return to complete applications.

**Done when:** Progress bar shows correctly for at least 3 different scholarship types.

## Data Flow

```text
[Scraper]
    ↓ pushes raw data
[Supabase — scholarships_raw table]
    ↓ queried via API key
[Website]
    ↓ user fills in profile form
[Supabase — user_profiles table]
    ↓ profile matched against scholarship required fields
[Progress bar shown to user]
```

## Phase 1 Prompt

Create a new Python project called `scholarship-scraper` in its own folder. This is a standalone data collection tool, completely separate from any website code.

**Setup:**
- Use Python with Playwright, BeautifulSoup4, and `supabase-py`
- Use a `.env` file for config: Supabase URL, Supabase service key, target URLs
- Include a `requirements.txt`
- Include a `README.md` explaining how to run it and how to set up Supabase

**Handling cookie banners and login screens:**
- When a page loads, automatically detect and click accept on any cookie consent banners before scraping.
- If a page requires a login to view content, do not attempt to log in. Instead, mark the scholarship as `requires_login: true`, log it in the `scrape_logs` table, and move on gracefully.
- If a page redirects unexpectedly, blocks access, or shows a CAPTCHA, mark it as `blocked: true` and log it separately so it can be reviewed manually later.
- If Cloudflare or bot detection is triggered, log it and skip. Never crash.

**What it scrapes:**
- Name, organization, URL, source site
- Open date, close date, deadline notes
- Reward amount and currency
- Full description and any additional info text
- Eligibility: citizenship, field of study, level of study, age, GPA, gender, any other criteria
- Application method: email, online form, or mail
- Required documents and required fields
- Application form URL and contact details
- Any form elements found on the page, including input fields, dropdowns, and checkboxes, logged as keywords
- Auto-detect flags: `is_exchange`, `is_thesis`, `is_language_requirement`, `is_recurring`, `has_interview`
- Extra flags: `requires_login`, `blocked`, `cookie_accepted`
- Meta: `date_scraped`, `scrape_success`, `page_structure_notes`

**Output — Supabase:**
- Push all scraped data to a Supabase table called `scholarships_raw`.
- Each scholarship is one row.
- Before inserting, check if the URL already exists. If it does, update the row instead of duplicating it.
- Mark each row with `date_scraped` and `scrape_success`.
- Maintain a `scrape_logs` table that logs every run: timestamp, URLs attempted, success count, fail count, blocked count, login required count, and error messages.
- Use the Supabase service key from `.env` for the scraper. Never expose this key publicly.

**Supabase table structure to create:**
- `scholarships_raw` table with columns matching all scraped fields above.
- `scrape_logs` table with: id, timestamp, urls_attempted, success_count, fail_count, blocked_count, login_required_count, errors.
- Include the SQL to create both tables in `supabase/schema.sql` so it can be run once to set up the database.
- Enable Row Level Security on `scholarships_raw` so access can be controlled safely.

**CLI:**
- `python scrape.py --url "https://example.com"` for a single URL
- `python scrape.py --list urls.txt` for bulk scraping from a list of URLs
- `python scrape.py --status` to print a summary of what is in the Supabase database, including how many are blocked or require login

**Safety:**
- Random delay of 1-2 seconds between requests using `random.uniform(1, 2)`
- Respect `robots.txt`
- Handle all errors gracefully. If a page fails for any reason, log it and move on.
- Never hardcode credentials. Everything sensitive goes in `.env`.

**Start small:**
- First build and test on just one hardcoded test URL.
- Confirm the data lands correctly in Supabase before enabling bulk mode.

Do not build any frontend or website code for Phase 1. This is purely the data collection layer. The website will access the data separately through Supabase's API.

## Notes & Decisions Made

- Separate GitHub repo for scraper — never touches website code
- Supabase chosen for database — protects raw data, scales well, generates API automatically
- Random 1-2 second delay between requests — safe but not too slow
- Collect all data first in Phase 1 — filter and clean in Phase 2 based on what the data actually shows
- Filter system will be data-driven — built on frequency analysis, not guesses
- Users authenticate through Supabase Auth accounts
- Progress bar in Phase 4 makes the platform sticky and reduces application drop-off

