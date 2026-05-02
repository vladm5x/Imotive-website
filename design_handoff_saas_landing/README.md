# Handoff: Scholarship Platform — Modern SaaS Landing Page

## Overview
This handoff covers a redesign of the marketing landing page for a scholarship-discovery platform (working name **Fundly**). The page's job is to convince students aged 18–30 that the product is the fastest, most trustworthy way to find verified scholarships, and to push them to sign up.

The page has 7 sections: top nav → hero with search → trust strip → how-it-works (3 steps) → scholarship preview cards → value proposition → signup CTA → footer.

## About the Design Files
The files in this bundle are **design references created in HTML/JSX** — prototypes showing intended look, layout, and copy. They are **not production code**. Your task is to **recreate these designs in our existing codebase** using its established components, routing, state, and styling conventions (Tailwind, CSS Modules, styled-components, etc.). Lift the visual values (colors, type, spacing, copy) from the reference; do not lift the inline-style React component directly.

If no frontend framework exists yet for the marketing site, pick the most appropriate one for the rest of the stack (Next.js is a sensible default for a marketing landing) and implement there.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy, and interaction affordances are all decided. Recreate pixel-perfectly at the 1280px design width, then make it responsive (notes below).

## Files
- `Concept2_SaaS.jsx` — The full landing page as a single React component using inline styles. This is the source of truth for layout, copy, colors, and structure.
- `Landing_Reference.html` — Open this in a browser to see the page rendered as designed.

---

## Design Tokens

### Colors
| Token | Value | Usage |
|---|---|---|
| `--blue` | `oklch(0.62 0.14 250)` | Primary accent (links, gradient start, match badges) |
| `--blue-deep` | `oklch(0.45 0.16 255)` | Gradient end, darker accent |
| `--bg` | `#FFFFFF` | Page background |
| `--surface` | `#F7F9FC` | Section backgrounds, chips, soft cards |
| `--ink` | `#0B1220` | Primary text, primary button background |
| `--muted` | `#5C6479` | Secondary text, captions |
| `--border` | `#E6EAF2` | All borders, dividers, card outlines |

The `oklch()` values can be approximated as hex `#5572D6` and `#3F5BBF` if your stack doesn't support oklch in CSS yet, but oklch is supported in all evergreen browsers as of 2024.

### Typography
- **Family:** `Inter Tight, Inter, ui-sans-serif, system-ui, sans-serif`
- **Feature settings:** `font-feature-settings: "ss01", "cv11"` on the body
- **Tabular nums:** `font-variant-numeric: tabular-nums` on every dollar amount
- **Display 1 (hero):** 76 / 1.05 / weight 600 / letter-spacing -2.4px
- **Display 2 (section heads):** 48–56 / 1.1 / weight 600 / -1.4px to -1.6px
- **H3 (card titles):** 20–22 / 1.3 / weight 600 / -0.4px to -0.5px
- **Body L:** 19 / 1.55 / 400 / `--muted` for sub-copy
- **Body:** 14–15 / 1.6 / 400
- **Eyebrow:** 13 / 500 / `--blue`
- **Micro:** 11–12 / 500, often uppercase or used for badges

### Spacing scale
4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 32 / 36 / 40 / 44 / 48 / 56 / 60 / 64 / 72 / 80 / 96 / 120 px. Section vertical padding is consistently **120px top/bottom** at desktop.

### Radii
- 6px — small chips/badges
- 8px — small buttons, filter rows
- 10px — primary buttons
- 14px — search bar, list-row cards
- 16px — content cards, product preview
- 24px — large CTA gradient block

### Shadows
- **Search bar:** `0 12px 32px -16px rgba(11, 18, 32, 0.18), 0 2px 6px rgba(11, 18, 32, 0.04)`
- **Floating preview card:** `0 24px 60px -24px rgba(11, 18, 32, 0.25)`
- Cards otherwise: no shadow, just `1px solid var(--border)`

### Effects
- **Nav:** `backdrop-filter: blur(8px)` over `rgba(255,255,255,0.85)`
- **Hero blobs:** Two `radial-gradient` circles positioned absolute behind the hero — one top-right (`oklch(0.92 0.05 250 / 0.7)`), one mid-left (`oklch(0.94 0.04 220 / 0.5)`). Both 500–700px wide, faded to transparent at 70%.
- **CTA block:** `linear-gradient(135deg, var(--blue), var(--blue-deep))` with two semi-transparent white circles overlaid for depth.

---

## Sections

### 1. Top nav
- Sticky, translucent (`rgba(255,255,255,0.85)` + 8px backdrop blur), 1px bottom border `--border`.
- Max-width container 1200px, padding `18px 32px`.
- Left: 26×26 rounded-7 gradient square logo + "Fundly" wordmark (18 / 600 / -0.4).
- Center: `Product · Scholarships · For schools · Pricing · Resources` (14, gap 28).
- Right: `Sign in` link (muted) + primary button "Get started" (bg `--ink`, color white, 9/16 padding, radius 8).

### 2. Hero
- Padding `96px 32px 80px`, position relative, overflow hidden.
- Two radial-gradient blobs as described above (decorative, behind content).
- Centered content column, max-width 1100.
- **Eyebrow chip:** pill with green dot + "14,820 verified scholarships · updated daily". Bg `--surface`, border `--border`, radius 999, padding `6/14`, font 13, color `--muted`.
- **Headline:** "Find scholarships that match you." — 76px, 600, -2.4 tracking. The phrase **"match you."** uses `background-clip: text` with `linear-gradient(120deg, --blue, --blue-deep)`.
- **Sub-copy:** 19px, `--muted`, max-width 600, centered.
- **Search bar:** white, 1px border `--border`, radius 14, padding 6, with the box-shadow above. Contains: 18px "⌕" icon (use a real icon component), input ("Search by field, school, or keyword…"), and a primary CTA button "Get started free" (bg `--ink`, white text, radius 10, padding `12/22`).
- **Filter chips row:** 6 chips below the search — `Engineering`, `First-gen`, `Graduate`, `Arts`, `International`, `Athletics`. Bg `--surface`, border `--border`, radius 999, font 13.
- **Floating product preview:** 880px wide card, radius 16, shadow as above. Has a faux browser chrome row (3 traffic lights + URL "fundly.app/dashboard"), then a 2-column body: left filter list (`All matches` selected on `--surface`), right list of 3 scholarship rows with title, "{org} · Closes {date}", amount, and a `{n}% match` badge in `oklch(0.95 0.03 250)` / `--blue-deep`.

### 3. Trust strip
- Bg `--surface`, top + bottom 1px `--border`, padding `60px 32px`.
- Centered "Used by students at 240+ universities" caption (13, `--muted`).
- Row of 7 wordmark placeholders rendered as uppercase letter-spaced text (18 / 600 / 1px tracking, color `--muted`, opacity 0.7). **Replace with real partner logos** when available; until then this typographic treatment is the approved fallback.

### 4. How it works
- Padding `120px 32px`, max-width 1100.
- Centered eyebrow "How it works" (13 / 500 / `--blue`) + h2 "From scrolling to scholarship in three steps." (48 / 600 / -1.4 / max-width 700).
- 3-column grid, gap 24. Each card: white bg, 1px `--border`, radius 16, padding 28, position relative, overflow hidden. Decorative pastel circle in top-right corner (140×140, `border-radius: 50%`, translated 40% out so only a quarter shows). Each card has a slightly different gradient on that circle.
- Card content: number (`01`/`02`/`03` in `--blue`, 13/500), title (22/600/-0.5), description (14/`--muted`/1.6).
- Copy:
  - 01 — *Tell us about you* — "Set your field, year, eligibility. Two minutes, no signup wall."
  - 02 — *See your matches* — "We rank every verified opportunity by fit and deadline."
  - 03 — *Apply in one place* — "Track every application. Reuse essays. Hit deadlines."

### 5. Scholarship preview
- Padding `40px 32px 120px`, max-width 1100.
- Header row: eyebrow "Live opportunities" + h2 "Closing this season" left-aligned, "View all 14,820 →" right-aligned.
- 2-column grid of 4 scholarship cards, gap 16. Each card: white, 1px `--border`, radius 14, padding 24.
- Card layout (top-to-bottom): top row with `{n}% match` badge (left) and "Closes {date}" (right, muted). Title (20/600/-0.4). Org (13/muted). Divider (1px top, 18px above and below). Footer row with amount (22/600/-0.5/tabular-nums) and "View →" link in `--blue`.
- Sample scholarships (placeholder content — replace with real data):
  - STEM Excellence Award · Northbridge · Mar 14 · $25,000 · 96% match
  - Humanities Fellowship · Mercer Trust · Apr 02 · $12,500 · 88% match
  - First-Gen Scholars Grant · Aldridge · May 20 · $8,000 · 92% match
  - Coastal Research Bursary · Coastal Inst. · Jun 11 · $15,000 · 84% match

### 6. Value prop
- Bg `--surface`, top + bottom 1px `--border`, padding `120px 32px`.
- h2 "Built for students. Priced for students." (48 / 600 / -1.4 / max-width 700).
- 3-column grid below. **Columns separated by 1px left border `--border`** (skip on first column), `padding-left: 28px` on each column past the first. Each column has a 36×36 gradient square (radius 10, `linear-gradient(135deg, --blue, --blue-deep)`) at top, then title (20/600/-0.4) + description (14/muted/1.6).
- Copy:
  - *Free, forever* — "Every core feature. No paywall. No upsells. We make money from partner schools, not students."
  - *Verified by humans* — "Our editorial team reviews every listing. We remove expired and predatory awards within 24 hours."
  - *Your data is yours* — "We never sell your information. Export or delete your profile any time, no questions asked."

### 7. Signup CTA
- Padding `120px 32px`, max-width 1100.
- Inside: a single rounded-24 block, padding `80px 64px`, full-bleed `linear-gradient(135deg, --blue, --blue-deep)`, white text. Two semi-transparent white circles (400 and 350px, `rgba(255,255,255,0.06–0.08)`) positioned at top-right and bottom-left for depth.
- Centered: h2 "Stop searching. Start applying." (56 / 600 / -1.6). Sub "Join 180,000 students using Fundly to fund their education." (18 / 0.85 opacity).
- Two buttons: white "Get started free" (color `--ink`, radius 10, padding `14/24`, weight 600) + outline "See pricing" (`1px solid rgba(255,255,255,0.4)`, white text).

### 8. Footer
- Padding `60px 32px 40px`, max-width 1100, top border 1px `--border`.
- 5-column grid (gap 40): brand block + 4 link columns.
- Brand block: 24×24 gradient logo + "Fundly" + tagline "The fastest way to find and win scholarships."
- Columns: **Product** (Search, Matching, Application tracker, Pricing) · **Company** (About, Careers, Blog, Press) · **Resources** (Help center, Guides, Webinars, Community) · **Legal** (Privacy, Terms, Security, Cookies). Headers 13/600. Links 13/`--muted`/10px gap.
- Bottom row: "© 2026 Fundly Inc." left, "Made for students, everywhere." right. Both 12/`--muted`. Top border 1px, padding-top 24.

---

## Interactions & Behavior

### Search bar (hero)
- Submitting (Enter or "Get started free" button) → if user is unauthenticated, route to `/signup?q={query}`; if authenticated, route to `/search?q={query}`. The CTA copy is intentionally signup-leaning even though the visual position implies "search."
- Filter chips below are **prefill links**, not multi-select. Clicking a chip puts that term in the input and submits.

### Hover/focus states
- Buttons (`--ink` bg): on hover, lighten background 6% (`#1a2030` approx). Focus visible: 2px outline `--blue` offset 2.
- Cards: 1px border by default; on hover, border becomes `--blue` at 30% alpha + translateY(-2px) with `transition: all 0.2s`.
- Links: underline on hover only; default state is no underline.

### Loading / empty states
- Scholarship preview list: if API returns 0 results, render a single full-width card with copy "No scholarships match yet — try broadening your filters" and a secondary CTA back to the search.
- During fetch: 4 skeleton cards (same dimensions, `--surface` bg, subtle shimmer animation 1.4s).

### Error states
- Search submit failure: toast at bottom "Couldn't reach the server — try again" with retry action. Don't navigate away.

### Animation
- Scroll-triggered: each major section fades + translates up 8px once on first appearance, 400ms, ease-out. Use `IntersectionObserver` or a lightweight library (Framer Motion / Motion One) consistent with the rest of the codebase.
- The hero gradient blobs **do not animate** — they are static decorative SVGs/divs.
- "Pulse" green dot in the hero eyebrow chip: 2s infinite, opacity 1 → 0.4 → 1.

### Responsive
The reference is at 1280px width. Implement these breakpoints:
- **≥1024:** as designed.
- **768–1023:** narrower padding (24 horizontal), hero headline 56px, drop the floating preview card from 880 → 100% width, value-prop and how-it-works grids stay 3 columns but tighten to 16px gap.
- **<768:** all multi-column grids collapse to single column. Hero headline 40 / -1.6. Search bar stacks (input full-width, then button below). Trust strip wordmarks scroll horizontally with `overflow-x: auto` + scroll-snap.

---

## State Management

The page itself is mostly static marketing content. Dynamic pieces:

| State | Source | Notes |
|---|---|---|
| `searchQuery` | local component state | Controlled input. Pre-filled from `?q=` query param if present. |
| `scholarshipPreviews` | API: `GET /api/scholarships?limit=4&sort=closing_soon` | Renders the 4 cards in section 5. SSR/SSG this if marketing page is statically generated; revalidate hourly. |
| `partnerLogos` | static config or CMS | Array of `{name, logoUrl}`. If `logoUrl` missing, fall back to typographic wordmark. |
| `signupCtaVariant` | A/B test flag (optional) | Two variants of the bottom CTA copy can be wired up easily; keep the gradient block component prop-driven. |

No client-side data fetching is required for first paint — prefer SSR/SSG. Hydrate the search input and any A/B variant on the client.

---

## Assets

- **Fonts:** Inter Tight (primary). Self-host via `@fontsource/inter-tight` or your existing font pipeline. Weights needed: 400, 500, 600, 700.
- **Icons:** The reference uses a "⌕" character for the search icon as a placeholder. Replace with your existing icon set (Lucide, Heroicons, or in-house) — `Search` icon, 18×18, stroke-width 1.5 to match the visual weight.
- **Logos / partner wordmarks:** Not provided. Wordmark fallback is described above.
- **Imagery:** None used. The product-preview card in the hero is rendered with real DOM, not a screenshot — keep it that way so it stays sharp at all DPRs.

---

## Copy Inventory

All exact copy is in `Concept2_SaaS.jsx`. Notable strings:
- Brand name: **Fundly** (placeholder — confirm with marketing before launch)
- Hero headline: **Find scholarships that match you.**
- Hero sub: "One search. Every funded opportunity. Built for students who'd rather be studying than tab-hopping forms."
- Trust caption: "Used by students at 240+ universities"
- Value-prop h2: "Built for students. Priced for students."
- CTA h2: "Stop searching. Start applying."
- CTA sub: "Join 180,000 students using Fundly to fund their education."

---

## Acceptance Checklist

- [ ] Lighthouse Performance ≥ 95, Accessibility ≥ 95, SEO ≥ 95.
- [ ] All headlines hit the exact font sizes and tracking listed in the typography table.
- [ ] Hero loads under 1.2s LCP on 4G; gradient blobs do not block paint.
- [ ] Tab order through nav → hero search → CTA → cards is logical; all interactive elements have visible focus rings.
- [ ] Color contrast ≥ 4.5:1 for body text and ≥ 3:1 for large headlines (verified with `--ink` on `--bg` and white on the gradient).
- [ ] All copy is in i18n strings, not hardcoded JSX.
- [ ] Page renders cleanly with JS disabled (SSR/SSG output).
- [ ] Mobile layout matches the breakpoint notes above; no horizontal scroll at 360px width.
