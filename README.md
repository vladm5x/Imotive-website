# Grantly Lund Prototype

Static scholarship finder prototype for validating demand with Lund University students.

## Product Build Plan

The larger scraper, Supabase, user profile, and application progress roadmap lives in `SCHOLARSHIP_PLATFORM_PLAN.md`.

## Open the Site

Open `index.html` in a browser. No build step is required.

## Practical WordPress Setup

Recommended setup:

1. Put this project in a GitHub repository.
2. Connect that repository to Netlify or Vercel.
3. Netlify/Vercel publishes the site as a live URL.
4. Add that live URL to WordPress as a button, menu item, or embedded page.
5. Future code changes are pushed to GitHub, then the hosted prototype updates automatically.

For Netlify, this project uses `netlify.toml` and publishes directly from the project root. There is no build command.

## Prototype Features

- Landing page for the student-facing value proposition
- Google and email account signup through Supabase Auth
- Persisted onboarding profiles in Supabase `user_profiles`
- Scholarship search and filters
- Lightweight profile matching flow
- Scholarship detail dialog
- Requirement keywords and needed applicant info for each scholarship
- Data table with CSV export for building a larger manual list
- Student scholarship suggestion form
- Feedback form
- Local storage for saved scholarships, suggestions, and feedback

## Account Setup

1. In Supabase, run `supabase/schema.sql`.
2. In Authentication > Providers, enable Google and add your Google OAuth client ID and secret.
3. Add these redirect URLs in Supabase Authentication > URL Configuration:
   - `http://localhost:4173/signup.html`
   - `https://your-domain.com/signup.html`
4. Add your public Supabase URL and anon key in `src/lib/supabaseClient.js`, or set `window.IMOTIVE_SUPABASE_URL` and `window.IMOTIVE_SUPABASE_ANON_KEY` before loading the app scripts.

Never put the Supabase service key in frontend code. The anon key is the only browser-safe key.

To inspect all users and their onboarding data as an admin, paste `supabase/users_admin_view.sql` into the Supabase SQL Editor. The app itself only lets signed-in users read and update their own profile.

## Updating Scholarship Data

The working sample records are in `app.js` in the `scholarships` array. Add or edit objects using the same fields. A standalone shape reference is available at `data/scholarships.example.json`.

Use `requirementKeywords` for eligibility terms found in the scholarship source, such as `financial need`, `engineering`, `international student`, or `academic merit`.

Use `requiredApplicantInfo` for the information the applicant must provide, such as `first name`, `last name`, `school`, `subject`, `nationality`, `budget`, `CV`, or `deadline`.

Before using this with real students, replace prototype records with verified Lund University, faculty, foundation, and grant sources.

## Debugging Scrapes

Run `npm run scrape:debug` to scrape with failure counting enabled. The scraper prints a failure summary at the end and, when Supabase is configured, saves:

- Summary counts to `scrape_logs.failure_reasons`
- Example failures to `scrape_logs.failure_examples`
- Searchable details to `scrape_failures`

Useful SQL:

```sql
SELECT reason, count(*) AS failures
FROM scrape_failures
GROUP BY reason
ORDER BY failures DESC;
```

```sql
SELECT reason, source, status, phase, url, message, created_at
FROM scrape_failures
ORDER BY created_at DESC
LIMIT 100;
```
