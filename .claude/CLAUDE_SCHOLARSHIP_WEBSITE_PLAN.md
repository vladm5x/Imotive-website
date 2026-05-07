# Claude Execution Plan: Functional Scholarship Website

## Mission

Turn this prototype into a functional scholarship website where a student can:

1. Land on the site and understand the value quickly.
2. Sign up or continue as a local prototype user.
3. Complete an onboarding/profile flow.
4. See real ranked scholarship matches from the dataset.
5. Open scholarship details, save promising scholarships, and track application progress.
6. Browse/account pages use the same data and profile as the rest of the app.
7. The site can be run locally and published from the static project root.

Work in this repository:

`C:\Users\mures\Documents\GitHub\Imotive-website`

Do not overwrite unrelated dirty changes. Read `git status --short` before editing and keep changes scoped.

## Current Repo Context

- Static app, no build step.
- Run locally with `npm run dev`.
- Main public/home behavior is split between `index.html`, `landing.html`, `homepage-layouts/*.html`, `src/home.js`, and `app.js`.
- Auth/onboarding lives in `signup.html`, `src/signup.js`, `src/components/SignupFlow.js`, and `src/lib/account.js`.
- Scholarship loading and matching live in `src/lib/scholarships.js` and `src/lib/matching.js`.
- Results/profile pages are `profile.html`, `results.html`, and `app.js`.
- Account/browse page is `account.html` and `src/account.js`.
- Supabase schema is in `supabase/schema.sql`.
- Local fallback data is in `data/scholarships.json`.
- Data quality/scraper tools live in `functions/`.

Known product gaps to prioritize:

- Onboarding saves answers to `imotive_signup_answers`, but `results.html` currently expects `grantlyProfile`, so signup-to-results can break.
- `src/lib/matching.js` uses a fixed date from April 2026; matching/deadlines should use the current date unless tests need a fixed date.
- `src/account.js` uses hardcoded scholarships instead of `fetchScholarships()` and `rankScholarships()`.
- Some UI text still says prototype/validation and some numbers are hardcoded.
- Saved scholarships and application progress exist in data APIs but are not fully visible/editable in the UI.

## Target End State

At the end of this work session, the website should pass this manual demo:

1. Start the site with `npm run dev`.
2. Open the homepage.
3. Click sign up.
4. Create/continue through the onboarding flow without Supabase blocking local testing.
5. Finish onboarding and land on real scholarship results.
6. Results are ranked from `data/scholarships.json` or Supabase if configured.
7. Open a scholarship detail dialog.
8. Save a scholarship and see the saved state persist after refresh.
9. Visit account/browse and see the same profile-aware scholarship data.
10. Edit the profile and see rankings update.

## Task 1: Unify Profile Storage and Navigation

Goal: signup, profile, results, and account all use one profile shape and do not strand users between incompatible flows.

Files to inspect/edit:

- `src/components/SignupFlow.js`
- `src/lib/account.js`
- `app.js`
- `profile.html`
- `results.html`
- `src/account.js`

Implementation checklist:

- Create or centralize a shared local profile key, preferably `imotive_signup_answers`.
- Make `app.js` read onboarding answers from `imotive_signup_answers` and normalize them into the profile shape expected by `rankScholarships()`.
- Keep backward compatibility by reading `grantlyProfile` if present, then migrating/saving to the new key.
- After onboarding completion, send the user to `results.html` and ensure results do not redirect to `profile.html` just because first/last/email are missing.
- Make `profile.html` edit the same profile fields used by onboarding. If fields do not map exactly, add a mapping layer rather than duplicating storage.
- Ensure logged-out/local prototype mode still works without Supabase.

Acceptance checks:

- Clear localStorage, complete signup/onboarding, and confirm `results.html` shows matches.
- Refresh `results.html`; matches remain.
- Edit `profile.html`, submit, and confirm rankings change.

## Task 2: Fix Matching Freshness and Ranking Behavior

Goal: scholarship ranking should be credible, current, and stable.

Files to inspect/edit:

- `src/lib/matching.js`
- `app.js`
- `src/account.js`
- `functions/audit-data.js` if needed

Implementation checklist:

- Replace the hardcoded `TODAY = new Date("2026-04-28T00:00:00")` with a current-date default.
- Preserve the ability to inject `options.today` for deterministic tests or manual QA.
- Check deadline sorting and expired-scholarship filtering against current dates.
- Make reasons and blockers user-friendly.
- Confirm matching works with both JSON camelCase fields and Supabase snake_case fields.
- Add a small smoke-test script or documented console test if the repo has no test framework.

Acceptance checks:

- Expired scholarships are not shown as eligible.
- Unknown/rolling deadlines do not crash ranking.
- Scholarships with matching level, field, nationality, and need rank above weaker matches.

## Task 3: Make Results Fully Usable

Goal: results page should feel like a useful application dashboard, not a single-card prototype.

Files to inspect/edit:

- `results.html`
- `app.js`
- `styles.css`
- `src/lib/scholarships.js`

Implementation checklist:

- Show a clear ranked list or carousel with enough context: title, amount, deadline, match score, eligibility, documents, and source.
- Keep the current one-at-a-time ranking if desired, but add obvious saved state and next/previous behavior that cannot dead-end.
- Use `saveScholarshipForUser()` when Supabase is configured and localStorage fallback when not.
- Persist saved scholarships locally under one clear key.
- In the detail dialog, show `applicationUrl` separately from `url` when available.
- Add an application-progress control for saved scholarships: `saved`, `in_progress`, `submitted`, `not_a_fit`.
- Wire `updateApplicationProgress()` for Supabase and localStorage fallback for prototype mode.
- Improve empty/error states: data load failed, no eligible matches, no profile yet.

Acceptance checks:

- Save button changes state immediately.
- Refresh keeps saved/progress status.
- Detail dialog opens and closes cleanly on desktop and mobile.
- External links open in a new tab with `rel="noreferrer"`.

## Task 4: Replace Account/Browse Mock Data with Real Data

Goal: `account.html` should be a real logged-in or local browse page using the same scholarship and profile system.

Files to inspect/edit:

- `src/account.js`
- `src/lib/scholarships.js`
- `src/lib/matching.js`
- `src/styles.css`

Implementation checklist:

- Remove the hardcoded `scholarships` array in `src/account.js`.
- Load scholarships with `fetchScholarships()`.
- Load profile from Supabase when available, otherwise from localStorage.
- Rank scholarships with `rankScholarships()`.
- Make search and filters functional:
  - search by title, source, category, field, eligibility text
  - filter by field
  - filter by level
  - filter by deadline urgency
  - sort by best match or deadline
- Show loading, error, and empty states.
- Keep styling consistent with the current design, but remove confusing placeholder notes like "both equal weight, side by side" and fake remaining counts.

Acceptance checks:

- Account page displays real scholarships.
- Search changes visible results.
- Filters and sorting work together.
- Page works when Supabase is not configured.

## Task 5: Clean Homepage and Conversion Flow

Goal: homepage should point users into the functional scholarship flow and use credible live/demo data.

Files to inspect/edit:

- `index.html`
- `landing.html`
- `homepage-layouts/*.html`
- `src/home.js`
- `app.js`
- `styles.css`
- `src/styles.css`

Implementation checklist:

- Decide which landing layout is the canonical homepage and ensure `index.html` points to it cleanly.
- Ensure all primary CTAs go to `signup.html`.
- Keep layout query/source tracking if useful, but do not let it break signup.
- Replace prototype claims that are not supported by current data, especially fake totals and fake student counts.
- Keep the scholarship preview connected to real ranked data where possible.
- Remove or rewrite "prototype" language from student-facing pages unless intentionally shown in footer/legal.
- Make mobile CTA, nav, and hero sections functional and readable.

Acceptance checks:

- Every main CTA starts the onboarding flow.
- Homepage loads without console errors.
- Mobile viewport has no overlapping nav/hero/CTA text.

## Task 6: Data Quality Pass

Goal: dataset should be good enough for a real demo.

Files to inspect/edit:

- `data/scholarships.json`
- `data/scholarships.example.json`
- `functions/scholarshipQuality.js`
- `functions/audit-data.js`
- `functions/addCuratedScholarships.js`

Implementation checklist:

- Run `npm run audit:data`.
- Fix or hide entries that are expired, blocked, generic, duplicate, or missing title/deadline/source/url/eligibility.
- Ensure every publishable scholarship has:
  - stable `id`
  - `title`
  - `amount`
  - `deadline` or `Unknown`
  - `category`
  - `level`
  - `fields`
  - `nationality`
  - `source`
  - `url`
  - `eligibility`
  - `documents`
  - `instructions`
  - `requirementKeywords`
  - `requiredApplicantInfo`
- Make the example JSON reflect the real required shape, including optional `applicationUrl`, `qualityScore`, and review fields if used by the UI.

Acceptance checks:

- `npm run audit:data` completes.
- Publishable entries load in the app and do not produce blank cards.
- No obvious duplicate top results.

## Task 7: Admin and Review Workflow

Goal: admin pages should support maintaining scholarship quality, or be hidden if not ready.

Files to inspect/edit:

- `admin.html`
- `layouts-admin.html`
- `src/admin.js`
- `src/lib/adminScholarships.js`
- `supabase/admin_migration.sql`
- `supabase/schema.sql`

Implementation checklist:

- Verify admin page can list scholarships from Supabase when configured.
- Confirm review status, notes, rejection reason, quality score, expired/blocked flags can be edited if the UI exposes them.
- If admin is not ready, remove public navigation to it and document setup requirements.
- Ensure admin APIs do not expose service keys in frontend code.

Acceptance checks:

- Admin page either works with anon-safe policies or clearly says setup is required.
- No service role key exists in frontend files.

## Task 8: Polish, Accessibility, and QA

Goal: finish with a site that can be demoed without obvious broken edges.

Files to inspect/edit:

- `styles.css`
- `src/styles.css`
- all touched HTML/JS pages

Implementation checklist:

- Check desktop and mobile layouts for homepage, signup, profile, results, account.
- Ensure buttons use `type="button"` unless submitting forms.
- Ensure dialogs have clear close controls and focus does not get trapped badly.
- Ensure forms have labels, required states, and helpful errors.
- Remove mojibake characters such as corrupted arrows/checkmarks where visible.
- Check console for errors on each core page.
- Update README with the final local demo flow and any required setup.

Acceptance checks:

- `npm run dev` runs.
- Core pages load with no console errors.
- Signup-to-results manual demo passes.
- README has accurate run/setup instructions.

## Suggested Work Order for a Few-Hour Sprint

1. Spend 15 minutes reading `README.md`, `app.js`, `SignupFlow.js`, `account.js`, `matching.js`, and `scholarships.js`.
2. Do Task 1 first. This is the backbone of the whole product flow.
3. Do Task 2 next. Current-date ranking affects every scholarship surface.
4. Do Task 3 enough to make results usable and persistent.
5. Do Task 4 to remove mock account/browse data.
6. Do Task 5 quick polish on homepage CTAs and unsupported claims.
7. Run Task 6 audit and fix the highest-impact data issues.
8. Finish with Task 8 QA and README updates.

If time runs short, prioritize Tasks 1, 2, 3, and 8. A functional signup-to-results flow matters more than admin polish.

## Verification Commands

Run these before handing back:

```powershell
npm run audit:data
npm run dev
```

Manual browser pages to test:

- `http://localhost:4173/`
- `http://localhost:4173/signup.html`
- `http://localhost:4173/profile.html`
- `http://localhost:4173/results.html`
- `http://localhost:4173/account.html`

Also check:

```powershell
git status --short
```

Summarize exactly what changed, which files were touched, what was tested, and any remaining known gaps.

## Handoff Response Format

When finished, report back with:

- What now works end to end.
- Main files changed.
- Verification performed.
- Any setup still required for Supabase or deployment.
- Remaining product gaps, ordered by importance.
