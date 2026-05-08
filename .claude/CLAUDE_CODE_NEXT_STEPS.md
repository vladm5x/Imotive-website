# Claude Code Next Steps: iMotive Website

## Current Snapshot

- Repo: `C:\Users\mures\Documents\GitHub\Imotive-website`
- App type: static vanilla/React-via-CDN site, no build step.
- Local run command: `npm run dev`
- Codex app/config pass completed:
  - `fetchScholarships()` now accepts public Supabase rows with `review_status` of `approved` or `publishable`.
  - Browser Supabase config no longer contains a hardcoded fallback project URL/key.
  - `admin.html` now checks the Supabase `admin` role instead of a hardcoded email allowlist.
  - `apply.html` now uses the shared scholarship loader.
  - README no longer references the missing `SCHOLARSHIP_PLATFORM_PLAN.md`.
- Existing checks:
  - `npm run test:scraper` passes.
  - `npm run audit:data` runs, but its status buckets are stale and misleading.
- Important note: `.claude/CLAUDE_SCHOLARSHIP_WEBSITE_PLAN.md` is partially outdated. Re-check code before following it literally.

## Highest-Priority Bugs

1. Finish standardizing review statuses across scraper/admin/audit.
   - `src/lib/scholarships.js` now reads both `approved` and `publishable` public statuses.
   - Admin/scraper/local data still mix `approved`, `publishable`, `pending_review`, and `needs_review`.
   - Pick the long-term canonical status model and align generated reports, migrations, and admin labels.
   - Check related files:
     - `src/lib/adminScholarships.js`
     - `src/admin.js`
     - `functions/scraper.js`
     - `functions/audit-data.js`
     - `supabase/schema.sql`
     - `supabase/admin_migration.sql`

2. Fix `npm run audit:data` reporting.
   - It reports `publishable: 0`, `needs review: 0`, `hide: 0` even though the current JSON data has 55 approved records.
   - Update the buckets to reflect the repo's current statuses: `approved`, `needs_review` or `pending_review`, `rejected`, `archived`, and stale/recheck categories if needed.
   - Keep the output useful for launch decisions: total, approved/public, needs review, rejected/hidden, expired, missing data flags.

3. Confirm Supabase runtime config in deployment.
   - `src/lib/supabaseClient.js` now accepts `window.IMOTIVE_SUPABASE_URL`, `window.IMOTIVE_SUPABASE_ANON_KEY`, `window.IMOTIVE_SUPABASE = { url, anonKey }`, or matching meta tags.
   - Add the chosen injection mechanism to production HTML/hosting if Supabase-backed auth/data should work outside local prototype mode.

4. Verify admin role setup.
   - `src/admin.js` now checks `app_metadata.role === "admin"` or a roles array containing `admin`.
   - The migration already references `auth.jwt().app_metadata.role = "admin"`.
   - Confirm the real admin user's Supabase Auth metadata is set, then test `admin.html`.

5. Clean up homepage/layout routing.
   - `index.html` dynamically injects a selected `homepage-layouts/*.html` file.
   - Some layout files contain root-relative assumptions, duplicated `homepage-layouts/...` paths, or direct links that only work in one loading mode.
   - Make one canonical homepage path and normalize links for both injected and direct layout access.
   - Check `src/homepage-layouts/loadActiveLayout.js`, `src/signup.js`, `layouts-admin.html`, and all active `homepage-layouts/*-landing.html`.

6. Fix broken or placeholder CTAs.
   - Several layout/demo pages still have `href="#"`, fake "Apply" buttons, fake social links, or unsupported claims like large scholarship counts.
   - Primary student CTAs should go to `signup.html`.
   - Browse/apply/detail CTAs should route to real app pages or be hidden until wired.
   - Keep design handoff folders as references, but avoid exposing unfinished links in production routes.

7. Decide what to do with duplicate page generations.
   - Current live-ish pages exist at root (`landing.html`, `about.html`, `profile.html`, `results.html`, etc.).
   - Variant pages exist under `homepage-layouts/`.
   - Design references exist under `design_handoff_*`.
   - Document which files are production, which are preview-only, and which can be archived later.

8. Align stylesheets.
   - Some root pages use `styles.css`.
   - Newer React/CDN pages use `src/styles.css`.
   - Confirm which stylesheet owns each core route, then remove drift or document the split.
   - Check mobile layouts after any stylesheet changes.

9. Improve application progress end to end.
   - `src/lib/scholarships.js` exposes `updateApplicationProgress()`.
   - Results/account UI only partially expose saved/progress state.
   - Add or polish statuses: `saved`, `in_progress`, `submitted`, `not_a_fit`.
   - Persist locally when Supabase is unavailable and sync when signed in.

10. Continue hardening `apply.html`.
    - `src/apply.js` now uses `fetchScholarships()`, so Supabase and local JSON share the same loader.
    - Add a friendlier fallback state for IDs that are no longer public or were rejected.

11. Review data quality before demo.
    - Current local dataset: 55 approved scholarships.
    - Top audit flags include missing documents, missing eligibility, missing deadline, missing amount, and one expired item.
    - Fix or hide the lowest-quality entries before a real student demo.
    - Re-run `npm run audit:data`.

12. Reduce scraper failure noise and improve reports.
    - Latest `reports/error_summary.json` shows many captcha failures, plus 404, soft 404, login wall, DNS, SSL, and blocked failures.
    - Add source-specific skip rules or manual curated replacements for consistently blocked/captcha-heavy domains.
    - Keep preserving admin-reviewed statuses during scraper pushes.

13. Update README.
    - README references `SCHOLARSHIP_PLATFORM_PLAN.md`, which is missing.
    - Replace that reference with the correct `.claude/CLAUDE_*` plan or a real roadmap file.
    - Add current run/test commands and the real Supabase setup steps.

14. Add a small browser QA checklist.
    - Test these pages at minimum:
      - `/`
      - `/signup.html`
      - `/results.html`
      - `/account.html`
      - `/profile.html`
      - `/apply.html?id=<known-id>`
      - `/admin.html` when Supabase/admin role is configured
    - Check desktop and mobile widths.
    - Check browser console for each core page.

15. Add automated smoke coverage where cheap.
    - Keep `npm run test:scraper`.
    - Add a lightweight data-shape test for `data/scholarships.json`.
    - Add a matching smoke test for expired, unknown deadline, and snake_case/camelCase inputs.
    - Add a link/path smoke test for production HTML pages only.

## Suggested Claude Code Work Order

1. Run:
   ```powershell
   git status --short
   npm run test:scraper
   npm run audit:data
   ```

2. Fix `audit-data.js`.
   - Make the audit output match the current status model.
   - Run it and use the output to identify the top data fixes.

3. Verify Supabase/admin configuration in the hosted environment.
   - Inject public Supabase config before app scripts load.
   - Set the admin user's Auth metadata role.
   - Keep clear setup messaging for unconfigured Supabase.

4. Normalize routing and CTAs.
   - Pick the canonical homepage/layout.
   - Fix links in active production paths.
   - Hide or mark preview-only routes.

5. Finish the student application flow.
   - Make results, account, and apply pages use one scholarship source and one saved/progress model.
   - Verify save/progress persists after refresh.

6. Clean data and docs.
   - Fix low-quality scholarship rows.
   - Update README.
   - Keep design handoff references separate from production.

7. Final verification:
   ```powershell
   npm run test:scraper
   npm run audit:data
   npm run dev
   ```
   Then manually test the core pages above.

## Done Criteria

- Approved/public scholarships show from Supabase and local JSON.
- Signup -> onboarding -> results works without Supabase.
- Results/account/apply share the same data source and profile/saved state.
- Admin access model matches Supabase RLS.
- README no longer references missing files.
- Core pages have no obvious broken CTAs or console errors.
- Tests and audit commands pass with meaningful output.
