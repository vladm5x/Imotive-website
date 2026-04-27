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
- Scholarship search and filters
- Lightweight profile matching flow
- Scholarship detail dialog
- Requirement keywords and needed applicant info for each scholarship
- Data table with CSV export for building a larger manual list
- Student scholarship suggestion form
- Feedback form
- Local storage for saved scholarships, suggestions, and feedback

## Updating Scholarship Data

The working sample records are in `app.js` in the `scholarships` array. Add or edit objects using the same fields. A standalone shape reference is available at `data/scholarships.example.json`.

Use `requirementKeywords` for eligibility terms found in the scholarship source, such as `financial need`, `engineering`, `international student`, or `academic merit`.

Use `requiredApplicantInfo` for the information the applicant must provide, such as `first name`, `last name`, `school`, `subject`, `nationality`, `budget`, `CV`, or `deadline`.

Before using this with real students, replace prototype records with verified Lund University, faculty, foundation, and grant sources.
