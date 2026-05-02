# Handoff: Scholarship Platform — Engaging / Gen Z Landing Page

## Overview
Marketing landing page for a scholarship-discovery platform (working name **Granted**). The page targets students aged 18–30. Tone is energetic, optimistic, action-driven — but still clean and scannable. Goal: convert visitors to signups.

7 sections: top nav → hero with search → trust strip (marquee) → how-it-works → scholarship preview → value proposition → signup CTA → footer.

## About the Design Files
The files in this bundle are **design references created in HTML/JSX** — prototypes showing intended look, layout, and copy. They are **not production code**. Recreate these designs in our existing codebase using its components, routing, and styling conventions. Lift the visual values (colors, type, spacing, copy) from the reference; do not lift the inline-style React component directly.

If no frontend framework exists yet, Next.js is a sensible default for a marketing landing.

## Fidelity
**High-fidelity.** Final colors, typography, copy, and interaction affordances are decided. Recreate pixel-perfectly at 1280px design width, then make it responsive (notes below).

## Files
- `Concept3_GenZ.jsx` — Full landing page as a single React component using inline styles. Source of truth for layout, copy, structure.
- `Landing_Reference.html` — Self-contained, double-clickable preview.

---

## Design Tokens

### Colors
| Token | Value | Usage |
|---|---|---|
| `--purple` | `oklch(0.55 0.24 290)` | Primary accent — italic emphasis words, CTAs, value-prop bg |
| `--purple-deep` | `oklch(0.38 0.22 290)` | Reserved deeper purple |
| `--teal` | `oklch(0.78 0.14 180)` | Secondary accent — chip backgrounds, decorative shapes |
| `--lime` | `oklch(0.92 0.18 110)` | Tertiary accent — buttons-on-dark, decorative shapes, brand pop |
| `--cream` | `#FFF9EE` | Page background |
| `--ink` | `#0F0A1F` | All text + 1.5px outlines on every card/button |
| `--muted` | `#5A4F6E` | Secondary text |
| `--border` | `#E8DFF5` | Light dividers (rare — most borders are full `--ink`) |

If oklch isn't supported in the target browsers, hex approximations: purple `#7B47CC`, teal `#7CD9D0`, lime `#E8F570`.

### Typography
- **Primary:** `Space Grotesk, Inter, ui-sans-serif, sans-serif` — weights 400/500/600/700.
- **Display italic accent:** `Instrument Serif, serif` — italic 400. Used **only** to emphasize a single word or short phrase inside a Space Grotesk headline (e.g. "match *you*", "from *where do I start*"). Always paired with `--purple` color and `font-style: italic`.
- **Display 1 (hero):** 116 / 0.95 / weight 700 / letter-spacing -4px
- **Display 2 (CTA):** 100 / 0.95 / 700 / -3.6
- **Display 3 (section heads):** 56–80 / 0.95–1 / 700 / -1.8 to -2.6
- **H3 (cards):** 22–26 / 1.15 / 700 / -0.5 to -0.6
- **Body L:** 19–20 / 1.5 / 400 / `--muted`
- **Body:** 15 / 1.55 / 400
- **Eyebrow chip:** 13 / 600 (pill with 1.5px ink border)
- **Stat number:** 38 / 700 / -1.4

### Spacing scale
4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 28 / 32 / 40 / 44 / 48 / 56 / 64 / 72 / 80 / 96 / 120 / 140 px. Section vertical padding is **120–140px** at desktop.

### Radii
- 12px — search button
- 14px — card icon tile
- 16px — search bar, stat cards
- 24px — content cards (how-it-works, scholarship cards)
- 999px — all chips, pills, and primary CTAs

### Borders & Shadows
- **Universal stroke:** Almost every card, button, chip, and decorative shape has a `1.5px solid var(--ink)` outline. This is the signature of the design.
- **Offset shadows:** Hard, no-blur drop shadow offset by a few pixels:
  - Search bar: `box-shadow: 6px 6px 0 var(--ink)`
  - Final CTA button: `box-shadow: 5px 5px 0 var(--purple)` (purple shadow on dark button)
- No soft/blurred shadows anywhere.

### Decorative elements
- **Off-axis geometric shapes:** Scattered behind the hero and CTA — circles, squares, asterisks (✦, ✱), all with `1.5px solid --ink` outlines and `transform: rotate(-12deg to 20deg)`. Treat as **static decorative SVGs/divs** — they do not animate.
- **Hand-drawn underline:** A wavy SVG path under the hero accent word. Stroke `--teal`, 5px wide, `stroke-linecap: round`. Path: `M 4 14 Q 50 4, 100 12 T 176 8`.

---

## Sections

### 1. Top nav
- Bg `--cream`, 1.5px bottom border `--ink`. Padding `20px 32px`, max-width 1200.
- Left: 32×32 ink-bg square (slightly rotated -4deg) with lime "$" glyph + "Granted." wordmark. The trailing "." is `--purple`.
- Center links (14/500): `Browse · How it works · Stories · Help`.
- Right: "Log in" + primary pill button "Get started →" (bg `--ink`, color `--lime`, radius 999, padding `10/18`, weight 600).

### 2. Hero
- Padding `80px 32px 96px`, position relative, overflow hidden.
- **Decorative shapes** (absolute-positioned behind content):
  - 140×140 lime circle, top:80 right:60, rotated 12deg
  - 70×70 teal square, top:280 right:220, rotated 20deg
  - "✦" 56px char, top:480 right:100, rotated -8deg
  - "✱" 32px purple char, top:380 right:360, rotated 15deg
- **Eyebrow pill:** `$184M awarded last cycle` — bg `--ink`, color `--lime`, radius 999, with a small lime dot animated `@keyframes pulse 2s infinite`.
- **Headline:** Two lines. "Find scholarships" / "that match **you.**" — 116 / 0.95 / 700 / -4. The word **"you."** uses Instrument Serif italic 400 in `--purple`, with the wavy teal SVG underline tucked just below the baseline.
- **Sub-copy:** 20 / `--muted` / max-width 540 — "14,820 verified scholarships, ranked for you. Spend less time searching, more time winning."
- **Search bar:** white bg, **2px solid --ink** border, radius 16, `box-shadow: 6px 6px 0 --ink`, padding 6, max-width 720. Icon (replace 🔍 emoji with real Search icon at 22px), input "What are you studying?", primary CTA button "Get started free" (bg `--purple`, color white, radius 12, padding `14/24`, weight 600).
- **Filter chips:** Below search, "Try:" label + 5 emoji-prefixed chips: 🎨 Design, ⚡ Engineering, 🧬 Bio, 💼 Business, 🌍 Global. Bg alternates between `--lime`, `--teal`, white. All have 1.5px ink border, radius 999. (Replace emoji with real icons if your design system has them.)
- **Stat strip (4 cards):** Below the search, gap 16. Each: 1.5px ink border, radius 16, padding `20/22`. Card 1 white, **card 2 `--purple` with white text, card 3 `--teal`**, card 4 white. Each card: 38px stat (700/-1.4) + 13px label below.
  - 180K+ students matched
  - $184M awarded in 2025
  - 14.8K live scholarships
  - 96% verified rate

### 3. Trust strip (marquee)
- Bg `--ink`, color `--cream`. Padding `40px 32px`. **Single horizontal row, no wrap, overflow hidden**, intended to scroll/marquee on real implementation.
- Content: alternating partner names + lime "★" stars, 22 / 600 / -0.5. Names: Northbridge, St·Aldwin, Pacific Tech, Mercer, Coastal, Hartwell, Aldridge, Beaumont. Duplicate the list 2x for seamless loop.
- **Animation:** `@keyframes scroll { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }`, 40s linear infinite. Pause on hover.
- Replace partner-name placeholders with real logos when available.

### 4. How it works
- Bg `--cream`, padding `120px 32px`, max-width 1200.
- Header row: lime pill "How it works" (1.5px ink border) + muted caption "Three steps. Five minutes."
- h2: "From *where do I start* to *I got it.*" — 72 / 1 / 700 / -2.4. The two italicized fragments use Instrument Serif italic in `--purple`.
- 3-column grid, gap 20. Each card: white, 1.5px ink border, radius 24, padding 28.
- Each card has a **64×64 circle** at top with 1.5px ink border, displaying the step number (22/700). Circle bg cycles: `--teal`, `--lime`, `--purple` (with white number on the third). Below: title (26/700/-0.6) + description (15/muted/1.55).
- Copy:
  - 01 — *Tell us about you* — "Field, year, eligibility, vibe. Two minutes."
  - 02 — *Get matched, ranked* — "We surface what fits. You don't dig."
  - 03 — *Apply, win, repeat* — "Reuse essays. Track every deadline. Cash in."

### 5. Scholarship preview
- Bg `--cream`, padding `40px 32px 120px`, max-width 1200.
- Header: teal pill "Open now" (1.5px ink border) + h2 "This week's drops" (56/700/-1.8) on left. "See all 14,820 →" on right with 2px ink underline.
- 2-column grid, gap 20. **Cards alternate styles: card 1 & 3 white, cards 2 & 4 `--ink` background with cream text.** All have 1.5px ink border, radius 24, padding 28.
- Card content:
  - **Top-right "96% MATCH" badge** on first card only: lime bg, ink text, radius 999, 1.5px ink border.
  - 56×56 rounded-14 icon tile with category emoji (🔬 / 📚 / 🌱 / 🌊). Tile bg alternates `--lime` / `--purple`. **Replace emoji with real category icons.**
  - Tag eyebrow (11/600/uppercase/letter-spaced).
  - Title (22/700/-0.5).
  - Org (13/0.7 opacity).
  - Dashed top divider (1px dashed, color depends on card variant).
  - Bottom row: left "Closes {date}" (11/0.7 opacity) above amount "${value}" (38/700/-1.2). Right: "Apply →" pill button.
- Sample data (replace with real API):
  - STEM Excellence Award · Northbridge · Mar 14 · $25K · 🔬 STEM
  - Humanities Fellowship · Mercer Trust · Apr 02 · $12.5K · 📚 Arts
  - First-Gen Scholars Grant · Aldridge · May 20 · $8K · 🌱 Open
  - Coastal Research Bursary · Coastal Inst. · Jun 11 · $15K · 🌊 Research

### 6. Value prop
- Bg `--purple`, color white. Padding `120px 32px`. Position relative, overflow hidden.
- Decorative: 72px "✦" at top:60 right:80, opacity 0.5 · 120×120 teal circle at bottom:80 left:80, opacity 0.4.
- h2: "We're *actually* on your side." — 80/0.95/700/-2.6. The word **"actually"** in Instrument Serif italic 400 (color stays white).
- 3-column grid below, gap 32. Each column: 14×14 lime dot at top + title (26/700/-0.6) + description (15 / opacity 0.85).
- Copy:
  - *Free, always.* — "Every feature. Zero paywalls. We charge schools, not you."
  - *No sketchy listings.* — "Editors vet every award. Predatory or expired? Gone in 24h."
  - *Your data, your call.* — "We never sell your info. Delete your profile in one tap."

### 7. Signup CTA
- Bg `--cream`, padding `140px 32px`. Position relative, overflow hidden.
- Decorative shapes:
  - 48px "✱" purple, top:80 left:15%, rotated -12deg
  - 80×80 lime circle (1.5px ink border) bottom:100 right:12%
  - 50×50 teal square (1.5px ink border) top:180 right:20%, rotated 15deg
- Centered, max-width 900.
- h2: "Stop scrolling." / "*Start winning.*" — 100/0.95/700/-3.6. Second line in Instrument Serif italic in `--purple`.
- Sub: "Join 180,000 students funding their dreams. Takes two minutes." 19/muted, max-width 480.
- Two pill buttons:
  - Primary: "Get started free →" — bg `--ink`, color `--lime`, padding `18/32`, radius 999, **box-shadow 5px 5px 0 --purple**.
  - Secondary: "See how it works" — white bg, 1.5px ink border.
- Footnote: "No card. No spam. Pinky promise. 🤞" 13/muted.

### 8. Footer
- Bg `--ink`, color `--cream`. Padding `64px 32px 36px`. Max-width 1200.
- 5-column grid (gap 40), bottom hairline `rgba(255,249,238,0.15)`.
- Brand block: 32×32 lime square logo (rotated -4deg) + "Granted." (lime dot) + tagline "The scholarship platform that actually gets you."
- Columns (header in `--lime` 14/600, links 13 / opacity 0.8 / 10px gap):
  - **Browse:** All scholarships, By field, By deadline, New this week
  - **Tools:** Match quiz, Essay templates, Deadline tracker, Calendar sync
  - **Community:** Stories, Discord, TikTok, Newsletter
  - **Company:** About, Careers, Privacy, Terms
- Bottom row (12/opacity 0.6): "© 2026 Granted. Built by students who got it." left · "Made with ☕ and stubbornness" right.

---

## Interactions & Behavior

### Search
- Submit (Enter or "Get started free") → unauthenticated: route to `/signup?q={query}`. Authenticated: `/search?q={query}`.
- Filter chips are prefill links (single-select, not multi).

### Hover/focus
- Pill buttons: on hover, translate -2px and increase shadow offset (e.g. 5/5 → 7/7). 150ms ease-out.
- Cards: on hover, translate -2px, shadow `4px 4px 0 --ink`. Default has no shadow.
- Links: 2px ink underline on hover.
- Focus visible: 3px outline `--purple` offset 3.

### Animations
- Trust marquee: 40s linear infinite scroll, pause on hover.
- Hero eyebrow dot: pulse keyframes 2s infinite.
- Section reveals on scroll: each major section fades + translates up 8px once on first appearance, 400ms ease-out.
- **Decorative shapes do not animate.**

### Loading / empty / error
- Scholarship preview: 4 skeleton cards (cream bg, 1.5px ink border, shimmer 1.4s) during fetch. Empty state: single full-width card "No drops match yet — broaden your filters" + secondary CTA back to search. Error: ink-bg toast "Couldn't reach the server" with retry.

### Responsive
- ≥1024: as designed.
- 768–1023: hero headline 80, padding 24 horizontal, stat strip stays 4 cols but tightens. CTA headline 72.
- <768: all multi-col grids → single col. Hero headline 48 / -1.6. Stat strip 2×2. Search input + button stack vertically. Trust marquee unchanged (still scrolls). Decorative shapes proportionally smaller or trimmed.

---

## State Management

| State | Source | Notes |
|---|---|---|
| `searchQuery` | local component state | Controlled. Pre-fill from `?q=` query param. |
| `scholarshipPreviews` | API: `GET /api/scholarships?limit=4&sort=closing_soon` | Renders the 4 cards in section 5. SSR/SSG with hourly revalidation. |
| `partnerNames` | static config or CMS | Marquee content. |

No client-side fetch needed for first paint — prefer SSR/SSG.

---

## Assets

- **Fonts:** Space Grotesk (primary, weights 400/500/600/700) + Instrument Serif (italic 400 only). Self-host via `@fontsource/*` packages or your existing pipeline. Both are on Google Fonts.
- **Icons:** Reference uses emoji as placeholders (🔍, 🎨, ⚡, 🧬, 💼, 🌍, 🔬, 📚, 🌱, 🌊, 🤞). **Replace all with real icons** from Lucide / Heroicons / your icon set, sized to match (16–26px).
- **Logos:** Partner wordmarks not provided — typographic fallback in trust marquee.
- **Imagery:** None. The visual interest comes entirely from typography, color, outlined shapes, and SVG decoration.

---

## Copy Inventory

All exact copy is in `Concept3_GenZ.jsx`. Notable strings:
- Brand: **Granted** (placeholder — confirm with marketing)
- Hero headline: **Find scholarships that match you.**
- Hero sub: "14,820 verified scholarships, ranked for you. Spend less time searching, more time winning."
- How-it-works h2: "From *where do I start* to *I got it.*"
- Scholarships h2: "This week's drops"
- Value-prop h2: "We're *actually* on your side."
- CTA h2: "Stop scrolling. *Start winning.*"
- CTA footnote: "No card. No spam. Pinky promise. 🤞"

---

## Acceptance Checklist

- [ ] Lighthouse Performance ≥ 95, Accessibility ≥ 95, SEO ≥ 95.
- [ ] All headlines hit the exact font sizes and tracking listed.
- [ ] Every card/button/chip has the signature 1.5px ink outline.
- [ ] Italic accent words use Instrument Serif italic in `--purple` (or white in the value-prop section).
- [ ] Trust marquee animates smoothly and pauses on hover.
- [ ] Color contrast: white-on-purple in value-prop ≥ 4.5:1 (verified). Ink on cream/lime/teal all ≥ 7:1.
- [ ] All copy in i18n strings, not hardcoded JSX.
- [ ] All emoji placeholders replaced with real icons.
- [ ] Page renders cleanly with JS disabled (SSR/SSG output).
- [ ] Mobile layout matches breakpoint notes; no horizontal scroll at 360px width.
