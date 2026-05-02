# Handoff: iMotive Landing Page

## Overview
A marketing/landing page for **iMotive**, a scholarship discovery platform that helps students aged 18–30 find verified scholarships, grants, and student funding opportunities faster. Students can search, filter, save, and track scholarships in one platform.

The landing page is structured to communicate (1) what the product is, (2) what the search/dashboard experience feels like, (3) social proof through stats and testimonials, and (4) clear conversion paths via "Sign Up Free" CTAs.

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — prototypes that demonstrate the intended look, layout, and behavior of the iMotive landing page. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, SvelteKit, Next.js, etc.) using its established component library, styling system, and conventions. If no environment exists yet, choose the most appropriate framework for the project (Next.js + Tailwind is a common solid pick for a marketing site like this) and implement the design there.

## Fidelity
**High-fidelity (hifi)**. The mockups specify final colors, typography, spacing, layout, and interactions. The developer should recreate the UI pixel-perfectly using the codebase's existing libraries and patterns.

The page uses CSS-only "3D" decorative elements (gradient cubes, coins, document cards, grad-cap shapes built from divs and transforms). These are intentionally simple geometric primitives — for a production site, the team may want to swap them for real 3D renders (Spline, Blender, or commissioned illustrations) without changing the surrounding layout.

---

## Page Structure (top → bottom)

The page is a single scroll-down marketing page with these sections:

1. **Sticky Nav** — Logo, links, sign-in, primary CTA.
2. **Hero** — Headline, subhead, two CTAs, trust meta, large 3D-style product visual.
3. **Logos Strip** — "Aggregating scholarships from" + 6 source names.
4. **Dashboard Preview** — A full-bleed mockup of the scholarship search experience.
5. **Tracking Section** — Three-panel layout (deadlines timeline, status donut, recommended matches).
6. **Sources** — Central purple sphere with 6 floating source cards on dashed orbit rings.
7. **How It Works** — Three colored cards (orange, pink, purple) with 3D decorative elements.
8. **Stats** — Dark panel with 4 huge gradient numbers.
9. **Testimonials** — 3 quote cards (off-white, dark, purple-tinted).
10. **FAQ** — Two-column with click-to-expand items.
11. **Final CTA** — Centered headline + button on light gradient panel with deco elements.
12. **Footer** — Brand + 3 columns of links + bottom strip.

---

## Design Tokens

### Colors
```
--white:        #FFFFFF
--off:          #F6F6F8   (light gray surfaces)
--off-2:        #EEEEF2   (dot fillers, subtle dividers)
--line:         #E7E7EC   (borders)
--ink:          #111111   (primary text, dark surfaces)
--ink-2:        #2A2A2E   (secondary text)
--muted:        #6B6B73   (tertiary text)
--muted-2:      #9A9AA3   (eyebrow/labels)

--purple-900:   #2B007A   (deep purple, gradient stops)
--purple-700:   #4B00D8   (primary purple — buttons, links, accents)
--purple-500:   #6A00FF   (violet — hover states, gradient)
--purple-300:   #B88CFF   (highlights, gradient stops)
--purple-100:   #EFE6FF   (verified badge bg, soft surfaces)

--pink:         #FF4FD8   (hot pink accent)
--yellow:       #FFD84D   (yellow accent — coin, badges)
--orange:       #FF7A2F   (orange accent — urgent deadlines, step card)
```

### Typography
- **Display / Headings**: `'Space Grotesk', sans-serif` — weights 500, 600, 700
- **Body / UI**: `'Inter', sans-serif` — weights 400, 450, 500, 600, 700
- **Mono (rarely)**: `'JetBrains Mono', monospace` — for keyboard shortcuts (`⌘ K`)

Heading sizes are fluid via `clamp()`:
- H1 hero: `clamp(44px, 7vw, 88px)` · line-height `0.98` · letter-spacing `-0.035em`
- H2 section: `clamp(34px, 4.6vw, 60px)` · line-height `1.02` · letter-spacing `-0.03em`
- H3 panel: 22px · weight 600 · letter-spacing `-0.02em`
- H4 card: 17px · weight 600 · letter-spacing `-0.01em`

Body: 16px / 1.5 / Inter 400. Subheads: 17–19px / 1.55 / muted color.
Eyebrow labels: 12.5px · uppercase · letter-spacing `0.1em` · weight 600 · purple-700.

### Spacing & Radii
- Page max-width: **1240px**, gutter **32px** (20px on mobile)
- Section vertical padding: **120px** desktop / **80px** for "tight" sections
- Border radii:
  - Buttons: 999px (pill) for default 40px buttons; 14px for 52px "lg" buttons
  - Cards: 16px (small), 22px (panels), 28px (product mockup), 32–36px (final CTA, stats panel)
  - Chips/pills: 999px

### Shadows
```
--shadow-card:  0 1px 0 rgba(17,17,17,.04), 0 12px 32px -12px rgba(17,17,17,.08);
--shadow-soft:  0 24px 60px -24px rgba(75,0,216,.25);
```
Hero product card: `0 30px 80px -30px rgba(75,0,216,.45), 0 8px 28px -10px rgba(17,17,17,.18)`.

---

## Section Details

### 1. Navigation
- **Sticky**, 72px tall, white-translucent (`rgba(255,255,255,.85)`) with `backdrop-filter: blur(14px)`, 1px bottom border `rgba(17,17,17,.06)`.
- **Logo (left)**: 28×28 rounded square (`border-radius: 8px`) with purple linear gradient + radial highlight, then "iMotive" text in Space Grotesk 600 / 19px.
- **Links (center, flex:1, gap:28px)**: "Scholarships", "How it works", "For Students", "Pricing", "FAQ" — 14.5px ink-2, hover → purple-700.
- **Right**: Ghost "Sign in" button + black pill primary "Sign Up Free" (40px tall, 18px h-padding).
- Mobile (≤880px): hide nav-links.

### 2. Hero
- Centered text block, padding `80px 0 60px`.
- **Pill** above headline: `★` icon in 22px purple gradient circle + "Trusted by 12,400+ students this semester" — 13px on white pill with 1px border.
- **H1**: "Find scholarships *without the endless searching.*" — italic-styled second clause uses `<em>` with gradient text fill (purple-700 → purple-500 → pink) via `background-clip: text`. Max-width 14ch.
- **Subhead**: 56ch max-width, muted color, 1.55 line-height.
- **CTAs**:
  - Primary: "Start Searching Free →" — `btn btn-purple btn-lg` (purple-700 bg, white, 52px tall, 14px radius, soft purple shadow, lifts on hover).
  - Secondary: "Browse Scholarships" — `btn btn-outline btn-lg` (white bg, 1px line border, ink text).
- **Hero meta row**: 3 short stats (`Free for students`, `500+ verified opportunities`, `No credit card required`).
- **3D Stage** (key visual):
  - Container `aspect-ratio: 16/10`, `perspective: 1800px`, `perspective-origin: 50% 30%`.
  - `.scene` rotated `rotateX(14deg) rotateY(-8deg)` with `transform-style: preserve-3d`.
  - **Central product card** (78% width, 28px radius, white, soft purple shadow):
    - Top bar: traffic-light dots + tab pill `imotive.app / search`.
    - Two-column body: left sidebar (filters with checkboxes + counts), right pane (search input, filter chips, list of 3 scholarship rows).
    - Highlighted scholarship row uses purple-300 border + linear gradient bg (`#faf6ff → white`).
  - **Floating decoration cards** (each `transform: translateZ(...)` for depth):
    - `.float-verified` (top-right, +80px Z, rotate 4°): purple gradient ✓ icon + "Verified by 4 sources / Cross-checked daily".
    - `.float-saved` (mid-right, +110px Z, rotate 6°): pink heart tile + "Saved · 12 / 3 closing this week".
    - `.float-deadline` (bottom-left, +70px Z, rotate -3°): "Next deadline / 12 days" big number + sub + orange-pink progress bar.
  - **3D blocks** (background decoration):
    - Purple cube top-left of product (70px, purple gradient, `rotate(18deg)`, +70px Z).
    - Yellow coin (90px, radial-gradient gold + `$` text, +60px Z, rotate -14°).
    - Document card (80×100, white, 4 horizontal "text" bars, +50px Z, rotate 8°).
    - Grad cap (130px square; black slab + yellow tassel via pseudo-elements; +40px Z, rotate -12°).
  - Mobile: shrink stage to `aspect-ratio: 4/5`, hide sidebar + saved card, shrink decoration blobs.

### 3. Logos Strip
- 60px top padding, centered.
- Eyebrow label "Aggregating scholarships from" in 12px muted-2.
- 6 placeholder source names (`OpenGrants`, `Fastweb`, `StudyHub`, `FoundationsDB`, `UniverseEd`, `BrightFutures`) as flex row with 40×56 gap, each `.item` has a 22px square glyph + name in Space Grotesk 500. Opacity 0.55, hover → 1.

### 4. Dashboard Preview
- Section padding 120px.
- **Section head**: 2-column grid, eyebrow + H2 left ("A search built for scholarships, not job listings."), 17px muted descriptor right.
- **Dash shell**: off-white `#F6F6F8` outer with 18px padding, 28px radius, 1px line border.
- **Inner dash**: white panel with 240px sidebar + main content. Min-height 520px.
  - **Sidebar** (`#fafafc` bg, right border): 3 groups of nav items ("Discover", "My applications", "Profile"), each row has a small ico + label + count badge. Active row is black with white text.
  - **Main**:
    - Header row: "Scholarship search" H3 + "512 results · sorted by relevance" sub on left, black "Sort: Best match" chip on right.
    - Search input: 14px radius, line border, value `data science`, ⌘ K kbd hint.
    - Filter bar: 5 chips (Field, Location, Deadline, Amount, Eligibility) — each has a label, purple value text, and a small caret.
    - **Card grid**: 3-column grid of 6 scholarship cards.
- **Scholarship card**:
  - White, 1px line border, 16px radius, 18px padding.
  - Top row: 40px square `card-mark` (varies — purple gradient, yellow, pink, orange, mint, soft) with 2-letter monogram + purple "Verified" pill (with purple-100 bg, ✓ disc).
  - H4 title + 12.5px muted sponsor.
  - Meta grid (2-col, dashed top border): "Amount" / "Eligibility" with uppercase 10px labels + 13px values.
  - Footer: deadline (urgent → orange + pulse dot) + "View Details →" link button.
  - Hover: `translateY(-2px)`, soft card shadow, purple-300 border.

### 5. Tracking Section
- Background: `var(--off)`, 36px radius, 24px horizontal margin (so it doesn't touch viewport edges).
- 3-column grid (1.3fr / 1fr / 1fr), 18px gap. Stacks on mobile.
- **Panel 1 — Upcoming deadlines**:
  - White panel, 22px radius, 26px padding.
  - Header: H4 "Upcoming deadlines" + "Calendar synced" tag pill on right.
  - 4 timeline rows (`.tl-row`): grid `78px 1fr auto`, 14px radius, off bg. First row is "next" → purple-tinted gradient + purple-100 border.
  - Each row: stacked date (Space Grotesk 22px day + uppercase month), name + meta, amount on right.
- **Panel 2 — Application status**:
  - Conic-gradient donut (130px), `--pct: 64`, white inner via pseudo-element. Center number "64%" in Space Grotesk 28px.
  - Legend: 4 rows (In progress / Drafting / Saved / Submitted), colored dots + counts, dashed dividers.
- **Panel 3 — Recommended for you**:
  - 4 match rows, off bg, 12px radius. Each: 36px monogram + name + meta + match-score in purple Space Grotesk (96%, 91%, 88%, 82%).

### 6. Sources Section
- 480px-tall centered stage, max-width 980px.
- **Center sphere**: 220px circle, radial purple gradient, layered shadow (`outer drop`, `inset bottom`, `inset top highlight`). Contents: "Aggregated" label / "684" big number / "live sources".
- **Two dashed orbit rings** behind sphere (380px and 600px, line border).
- **6 source cards** absolutely positioned around: Universities, Foundations, Student orgs, Public grants, Private sponsors, Nonprofits. Each: 32px square mono icon + "Title / count" two-line text, 14px radius, soft drop shadow.
- Mobile: collapse to 2-column grid; hide sphere and rings.

### 7. How It Works
- 3 colored step cards, equal columns, 20px gap, 360px min-height.
- Card 01 — orange gradient (`#ffd6b8 → #ffb88a`): "01 / Search" → "Browse verified sources." → 26ch description. Decorative `vs-doc` (white document) bottom-right.
- Card 02 — pink gradient (`#ffd0ee → #ff97d6`): "02 / Filter" → "Match your profile." → coin + black cube decorations.
- Card 03 — purple gradient (`#d8c2ff → #b394ff`): "03 / Apply" → "Save & apply on time." → black grad-cap top with yellow tassel.
- Step number prefix uses a 24px hairline before it.

### 8. Stats
- Black panel (`--ink`), 32px radius, 80×60px padding.
- Decorative purple radial blob in top-right corner (`filter: blur(20px)`).
- Header: purple-300 eyebrow + white H2 "The fastest way students find funding."
- 4-column grid with hairline dividers between columns. Each stat:
  - Big number in Space Grotesk 600 / `clamp(54px, 7vw, 92px)` / letter-spacing `-0.04em` / linear-gradient text-fill (white → purple-300).
  - 14px white-70 label below (max 18ch).
- Stats: `+500 verified scholarships`, `8× faster`, `+40h saved`, `6× more organized`.
- Mobile: 2×2 grid, no column borders, hairline horizontal dividers between rows.

### 9. Testimonials
- Section head: eyebrow + H2 "Real students. Real funding." + 50ch sub.
- 3-column quote grid, 18px gap, 240px min-height.
- Three variants:
  - `.quote` — off-white bg
  - `.quote.dark` — black bg, white text
  - `.quote.bright` — purple-100 bg
- Each card: pull quote in Space Grotesk 500 / 20px / line-height 1.3 (flex:1 to push attribution to bottom), then author row with 36px circular avatar (initials, monogram colors) + name (13.5px / 600) + role (12px / muted).

### 10. FAQ
- 2-column grid (1fr / 1.5fr), 60px gap, stacks on mobile.
- Left: eyebrow + H2 "Questions, answered." + small help line ("Reach out at hello@imotive.app").
- Right: list of 5 FAQ items, each separated by 1px line border.
  - Question button: Space Grotesk 19px / 500 + 28px circular `+` toggle (becomes solid black with rotated bars when open).
  - Answer: max-height transition (0 → 220px), 35ms ease, 15px muted text, 60ch max-width.
  - First item open by default.
- Click toggles `.open` class on `.faq-item`.

### 11. Final CTA
- Section padding 120px.
- Inner panel: linear gradient `#F6F6F8 → white`, 36px radius, 100×32px padding, 1px line border, centered text.
- H2: "Start finding scholarships today." — `clamp(40px, 6vw, 76px)`.
- Sub: 18px muted, 50ch max.
- Single primary CTA "Sign Up Free →" (`btn-purple btn-lg`).
- Decorations: floating purple cube top-left (90px, rotate -12°), floating gold coin bottom-right (70px). Hidden on small screens.

### 12. Footer
- 80×0×40 padding.
- 4-column grid (2fr / 1fr / 1fr / 1fr), 40px gap.
  - Brand col: logo + 320px tagline ("The scholarship discovery platform built for students who'd rather apply than search.")
  - "Product": Scholarships, How it works, Pricing, Roadmap
  - "Company": About, Contact, Careers, Press
  - "Legal": Privacy Policy, Terms of Service, Cookie Policy
- Bottom strip: line border above, 24px top padding, flex row with copyright + "Made for students, in San Francisco."

---

## Interactions & Behavior

| Element | Behavior |
|---|---|
| Nav | Sticky to top, blurred translucent bg as user scrolls past hero. |
| Anchor links | Smooth-scroll to in-page sections (`#dash`, `#how`, `#stats`, `#faq`, `#cta`). |
| `.btn-purple` | `:hover` → bg `purple-500`, `transform: translateY(-1px)`. Transitions ~150ms. |
| `.btn-primary` (black) | `:hover` → bg `purple-700`. |
| `.card` (scholarship) | `:hover` → translateY(-2px), card shadow appears, border becomes purple-300. |
| FAQ item | Click question button → toggles `.open` on parent. Answer height animates 0 → 220px (350ms ease). Plus icon rotates: closed shows + (rotated bar), open shows – (bar reset, bg → black). |
| 3D hero | Static (no animation in current spec). Optional enhancement: subtle parallax on mouse move or slow auto-tilt. |
| Sticky CTA on mobile | Not implemented; consider adding for production. |

### Responsive breakpoints
- `≤980px`: tracking grid → single column.
- `≤880px`: hide nav links, single-column dashboard, 2-col stats, single-col steps, single-col testimonials, sources collapse to 2-col grid (sphere/rings hidden), single-col FAQ.
- `≤720px`: page gutter → 20px, hero stage `aspect-ratio: 4/5`, hide hero sidebar + saved card, shrink decoration blobs, hide final CTA decorations.

---

## State Management

This is a marketing page — minimal client state:
- **FAQ open/closed**: per-item boolean. In React, a `useState(openIndex)` or a `Set` of open indices works.
- **Optional**: scroll-based nav style, mobile menu toggle (not in current mock).

For the dashboard mockup section, all data is static. If hooked to real data later:
- Search query, active filters (multi-select), sort key
- Scholarship list (paginated)
- Saved/recommended/status counts

---

## Copy Reference

**Hero**
- H1: "Find scholarships *without the endless searching.*"
- Sub: "Search verified scholarships, filter by eligibility, and track every deadline in one student-friendly platform — built for the way you actually apply."
- CTAs: "Start Searching Free →" / "Browse Scholarships"
- Meta: "Free for students" · "500+ verified opportunities" · "No credit card required"

**Section H2s**
- "A search built for scholarships, not job listings."
- "Track every scholarship in one place."
- "Scholarships from many places, organized for you."
- "From discovery to applied — in three steps."
- "The fastest way students find funding."
- "Real students. Real funding."
- "Questions, answered."
- "Start finding scholarships today."

**Stats**
- `+500` Verified scholarships listed and growing weekly
- `8×` Faster than searching across multiple websites
- `+40h` Saved per student over a single application cycle
- `6×` More organized application process, end-to-end

**Testimonials** (3 quotes — see HTML for full text and authors)

**FAQ questions**
1. Is the platform free?
2. Are the scholarships verified?
3. Do I need an account?
4. Can I save scholarships?
5. Which students is this for?

(Answers in HTML — copy verbatim.)

---

## Assets

No external images in this design — everything is built from CSS gradients, transforms, and inline SVG (only for the small magnifier icons in the search inputs).

For production, replace these CSS-built decorations with real assets:
- Hero 3D scene: ideally a Spline embed or pre-rendered Blender PNG/WebP set.
- Logo strip: real partner logos (SVGs).
- Avatar initials: keep as-is or swap for real student photos with consent.

Fonts: load `Space Grotesk` and `Inter` (and optionally `JetBrains Mono`) via Google Fonts or self-host.

---

## Files

- `iMotive Landing.html` — full single-file HTML/CSS prototype with inline `<style>` and a small `<script>` block for the FAQ toggle.

The HTML file is self-contained (no external assets beyond Google Fonts). Open it in any browser to see the reference rendering.
