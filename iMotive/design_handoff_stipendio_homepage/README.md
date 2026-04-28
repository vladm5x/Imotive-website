# Handoff: Stipendio — Marketing Homepage

## Overview

Stipendio is a scholarship discovery platform for university students (initial market: Sweden). This handoff covers the **public marketing homepage** — the page a logged-out visitor lands on. Its job is to:

1. Communicate the value prop clearly ("scholarships that actually fit you").
2. Let visitors search or browse scholarships immediately.
3. Tease the personalized matching feature, which **unlocks after sign-up** (no matching is shown pre-auth).
4. Convert visitors into sign-ups.

Other screens (sign-up flow, authenticated dashboard, scholarship detail, search results) are not part of this handoff.

## About the Design Files

The HTML files in this bundle are **design references** created as wireframes — prototypes showing the intended layout, hierarchy, copy, and behavior. They are **not production code to copy directly**.

Your task is to **recreate this design in the target codebase's existing environment** (React, Next.js, SvelteKit, etc.), following its established patterns, component library, and styling conventions. If the project doesn't have a frontend environment yet, pick the most appropriate framework for a marketing site (Next.js / Astro / SvelteKit are all reasonable) and implement it there.

## Fidelity

**Low-fidelity (lofi) wireframes.** The deliverable in this bundle uses a deliberately sketchy hand-drawn aesthetic (Architects Daughter / Caveat fonts, hand-drawn borders, hatched image placeholders). **Do not ship the sketchy aesthetic to production.** It exists only to communicate that layout and structure are settled but visual styling is open.

For the production build, use:
- The brand color palette listed below.
- A clean modern sans-serif typeface (Inter, Geist, or similar — the team can decide).
- The codebase's existing design system / component library for buttons, cards, form fields, etc.
- Standard rectangular borders / subtle shadows — drop the hand-drawn skeuomorphism entirely.

The **layout, section order, content hierarchy, and copy** in the wireframe are the spec. Visual styling is a translation step.

## Page Structure

The homepage is a single scrollable page with the following sections, in order:

### 1. Top Navigation
- Sticky top bar, full-width.
- Left: logo (wordmark "Stipendio" + small circular accent mark in primary blue).
- Center-left: nav links — `Browse`, `How it works`, `For universities`.
- Right: `Log in` text link, `Sign up` button (primary).

### 2. Hero (split, 2-column)
- Left column (~55% width):
  - Small eyebrow text: "hi there ✦" (in primary blue).
  - Large headline: **"Scholarships that actually fit you."** — final 3 words ("actually fit you.") wrapped in a yellow highlight (`#FACC15`) like a marker swipe.
  - Subhead: *"We collect every scholarship for university students in one place — so you stop scrolling and start applying."*
  - Inline search bar with placeholder `"Try \"engineering, masters, Lund\""` and a primary `Search` button on the right end.
  - Below search: secondary CTA `Browse all 2,400+ →` + soft text link `or, sign up to get matches`.
  - Social-proof row: 4 overlapping circular avatars + text *"Joined this week by 312 students"*.
- Right column (~45% width):
  - **Search-results preview mockup** — a card containing 3 mini scholarship rows (title + amount + a deadline progress bar). Below them, a **dashed-blue locked CTA**: 🔒 *"**Sign up** to see your match score on every result."* This communicates that matching exists but is gated behind sign-up.

### 3. Social proof strip
- Thin band, light-grey bg, full width.
- Centered text: "trusted by students at" followed by a row of 6 university wordmarks: **Lund University, KTH, Uppsala, Chalmers, Stockholm, Göteborg**. Use real logo SVGs in production if licensing allows; otherwise styled wordmarks are fine.

### 4. Featured scholarships
- Section eyebrow: `/ a peek at what's inside`.
- Heading: **"Featured scholarships this week."**
- Sub: *"Sign up to see which ones fit you."*
- Right-aligned link: `browse all 2,400+ →`.
- 3-column grid of scholarship cards (see Card spec below).
- **No match-score badge** on these cards (matching is post-signup). Cards instead show an eligibility tag pill.

### 5. How it works
- Centered heading: **"From confused to confident in 3 steps."**
- Sub: *"No friction. No hidden steps."*
- 3 cards in a horizontal strip with `→` arrows between them:
  1. **Search or build a profile** — *"Tell us your field, level, and a few interests."*
  2. **Filter by what matters** — *"Match score, amount, deadline, or effort."*
  3. **Apply & track** — *"Save drafts, set reminders, see status."*
- Each card has a numbered circular badge (1/2/3) at top, then heading, then short description.

### 6. Benefits + testimonial (2-column)
- Left column:
  - Eyebrow: `/ why students like it`.
  - Heading: **"Less time hunting, more time applying."**
  - 3 benefit rows, each with a green ✓ circle icon + heading + short description:
    - **Save 6+ hours a month** — *"No more bouncing between university pages."*
    - **Discover what you didn't know** — *"Niche & private grants surface automatically."*
    - **Personalized matches** — *"The more you tell us, the better it gets."*
- Right column: testimonial card.
  - Big decorative `"` quote mark.
  - Quote: *"I found 4 scholarships I qualified for in my first session. Got 2 of them. Paid my whole semester."*
  - Avatar + name **Sara L.** + role *"MSc Engineering, Lund"*.

### 7. Final CTA (full-width band)
- Background: primary blue (`#3B82F6`), white text.
- Eyebrow: *"2 minutes. that's all."*
- Headline: **"Start finding your scholarships."**
- Buttons: primary green `Start searching →` + ghost (white-outlined) `Browse instead`.

### 8. Footer
Not designed in this wireframe — use the codebase's standard marketing footer if one exists, or a minimal one with logo, nav columns (Product / Company / Legal), and copyright.

## Component Spec — Scholarship Card

Used in the **Featured scholarships** section. 3-up grid, equal columns.

- White background, 1px subtle border, 8px border-radius, light shadow.
- Padding: 20px.
- Top row: small eligibility pill (e.g. "Engineering · Masters") on the left, amount text (e.g. "40,000 kr") bold on the right.
- Title (medium weight, 18–20px): scholarship name.
- Description (13–14px, muted): 1–2 lines of plain text.
- **Deadline progress bar**:
  - Label row above the bar: "Deadline" on the left, "9 days left" on the right.
  - Bar: 8px tall, rounded ends, light-grey track, fill colored by urgency:
    - **Green** (`#22C55E`) when `daysLeft >= 14`.
    - **Yellow** (`#FACC15`) when `daysLeft < 14` (urgency tint; bump days-left text color to a warm amber).
  - Fill width = % of total application window elapsed.
- Effort pill below progress bar: `⏱ Easy apply` / `Medium` / `Hard` (small grey pill).
- Primary `Apply →` button at the bottom, full-width, green (`#22C55E`) background.

## Interactions & Behavior

- **Search bar (hero):** typing → submit on Enter or click `Search` → navigate to `/search?q=<query>`. Suggestions dropdown is out of scope for this handoff.
- **Browse all 2,400+ →:** navigates to `/scholarships` (full browse view).
- **Sign up button (nav, hero locked card, final CTA):** opens sign-up flow / route.
- **Featured scholarship card click:** navigates to scholarship detail page (`/scholarships/<slug>`).
- **Apply button on card:** for logged-out visitors, prompt sign-up first; after auth, deep-link into the scholarship's apply step.
- **Hover states:** cards lift slightly (small translateY + shadow grow). Buttons darken by ~5% on hover. Standard 150ms ease transitions.
- **Responsive:** mobile-first. At narrow widths:
  - Nav collapses to logo + hamburger.
  - Hero stacks: copy + search on top, results-preview mock below (or hide on mobile if it crowds).
  - Featured + How-it-works grids collapse to 1 column.
  - Benefits + testimonial stack vertically.
- **Number 312 in social-proof line** can be a real count from the backend if available; otherwise a static placeholder is acceptable.

## State

The homepage itself is largely static. Dynamic data needed:

- `featuredScholarships`: array of 3 (title, amount, daysLeft, progressPercent, effort, eligibilityTag, slug, description). Server-rendered or fetched on mount.
- `joinedThisWeekCount` (optional): integer for the social-proof line.
- `totalScholarshipCount`: integer used in "Browse all 2,400+" — replace `2,400+` with live count or rounded number.

No client-side form state beyond the search input. Search submit can be a plain GET to a search route.

## Design Tokens

### Colors
- **Primary blue:** `#3B82F6` — nav accents, primary buttons, links, final CTA bg.
- **Dark blue:** `#1E3A8A` — reserve for hover/pressed states on primary, or deep accents.
- **Action green:** `#22C55E` — apply / success / final-CTA primary button.
- **Highlight yellow:** `#FACC15` — deadline urgency, headline marker swipe.
- **Background white:** `#FFFFFF`.
- **Surface grey:** `#F3F4F6` — section backgrounds, cards on tinted bands.
- **Ink (body):** `#1A1A1A` or near-black at 90% opacity.
- **Muted text:** `#555555`.

### Typography
- **Headings:** modern geometric sans-serif, weight 700. Suggested: Inter, Geist, or General Sans. Sizes:
  - Hero H1: 60–68px, line-height 1.05, letter-spacing -0.5px.
  - Section H2: 32–38px.
  - Card titles: 18–20px, weight 600.
- **Body:** same family, weight 400, 15–17px, line-height 1.5.
- **Eyebrow / small caps:** 13–14px, weight 500, muted color.

### Spacing
- Section vertical padding: 60–80px (desktop), 40–56px (mobile).
- Section horizontal padding: 36px (desktop), 20px (mobile).
- Card grid gap: 20px.
- Container max-width: 1280px (or codebase's standard).

### Radii / shadows / borders
- Card radius: 8px. Pill radius: 999px. Button radius: 8px (or pill if codebase prefers).
- Button shadow: subtle (e.g. `0 1px 2px rgba(0,0,0,0.05)`). Drop the wireframe's hand-drawn 3px solid shadow.
- Borders: 1px, color `#E5E7EB` or codebase equivalent.

## Assets

- **University logos:** placeholders only in wireframe. In production, source official logos for Lund, KTH, Uppsala, Chalmers, Stockholm, Göteborg if licensing allows. Otherwise use styled wordmarks.
- **Avatars in social proof:** placeholder solid-color circles in wireframe. Use real student photos (with consent) or stylized illustrations in production.
- **Icons:** suggest using Lucide / Heroicons / Phosphor — codebase choice. Specifically needed: search, lock, check, clock, arrow-right.
- **Logo (Stipendio):** wordmark + circular dot accent. Final logo asset is TBD; treat the wireframe rendering as a placeholder.

## Files

- `Stipendio Homepage.html` — the wireframe rendering of the chosen direction. Open in a browser to see layout and copy.
- `wireframes.jsx` — React/JSX source for the wireframe (also contains two earlier directions, `V1_SearchLed` and `V3_ResultsLed`, which were rejected; the chosen one is `V2_MatchLed`). The card component (`ScholarshipCard`) shows the intended card structure and progress-bar logic.

## Open Questions for the Implementing Engineer

- Is there an existing component library or design system in the target codebase? If yes, use its primitives (Button, Card, Input) — don't recreate them.
- Are university logos licensed? If not, use wordmarks.
- Is the search backend ready? If not, search submit can navigate to a stub page that says "Coming soon".
- Confirm Swedish-kr formatting locale (likely `sv-SE`).
