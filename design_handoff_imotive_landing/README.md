# Handoff: iMotive — Scholarship Discovery Landing Page

## Overview
iMotive is a scholarship discovery platform helping students (18–30) search, filter, save, and apply to verified scholarships in one place. This handoff covers the **marketing landing page** — the entry point that converts visitors into signups.

The visual direction is bold, playful, high-energy fintech-style: deep purple + butter yellow palette, oversized condensed display type, neo-brutalist hard-shadow cards, illustrated student characters, and decorative line-art doodles.

## About the Design Files
The files in this bundle (`iMotive Landing.html`, `hero-art.png`) are **design references created in HTML** — a static prototype showing intended look and behavior, **not production code to copy directly**.

The implementation task is to **recreate this design in the target codebase's existing environment** (React/Next.js, Vue/Nuxt, SvelteKit, Astro, etc.) using its established patterns, component library, and routing — or, if no environment exists yet, to scaffold a new project with the framework most appropriate for a marketing site (Next.js or Astro recommended for SEO + performance).

Hero illustration `hero-art.png` is a real raster asset and should ship as-is (or be re-exported at 2x for retina).

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, copy, and component states are settled. Recreate pixel-perfectly using the codebase's existing libraries (Tailwind, CSS Modules, styled-components, etc.) and apply the exact tokens listed below.

## Screens / Views

This is a single long-scroll landing page with 9 stacked sections:

### 1. Floating Pill Nav (sticky)
- Sticky from `top: 16px`, centered, max-width `1280px`
- White pill `border-radius: 999px`, padding `14px 18px 14px 28px`
- Box shadow: `0 14px 40px -20px rgba(22,10,94,.35), 0 2px 4px rgba(22,10,94,.05)`
- Brand: 30×30 purple rounded-square logomark (rotated -6°) with yellow ★, plus "iMotive" wordmark in Archivo Black 22px, indigo
- Links right-aligned: Discover, How it works, For students, Help — Inter 500, ink-2
- Login link (ink) + "Get Started" CTA (ink bg, white text, pill, padding `11px 20px`)
- Hide ul on `max-width: 880px`

### 2. Hero
- Padding `64px 24px 0`, max-width `1280px`
- Eyebrow: Space Grotesk 600, 13px, letter-spacing `.18em`, uppercase, purple-deep — `★ The scholarship search platform built for students`
- H1: Archivo Black, `clamp(56px, 9.4vw, 140px)`, line-height `.92`, indigo
  - Copy: `Find <yellow pill>scholarships</pill><br/>that <underlined>match</underlined> you.`
  - Yellow pill: bg `#ffd83d`, padding `0 .25em`, border-radius `.18em`, rotated `-2deg`
  - Underline: pseudo-element 0.18em tall, purple bg, opacity .25, behind text
- Lede: max-width 560px, 19px, line-height 1.55, ink-2, weight 500
- **Search bar** (primary CTA in this section): white pill, padding `8px 8px 8px 28px`, max-width 720px, deep box-shadow. Magnifier icon (purple stroke), input (17px Inter 500, placeholder `Try "engineering scholarships under $5k due in May"…`), `📍 Anywhere` chip (lilac bg), purple "Search" button with arrow
- CTA row: yellow `Get Started Free` (Archivo Black weight, 2px ink border, 4×4 hard ink shadow, hover translates -2,-2 with 6×6 shadow), ghost `Browse Scholarships` with circular arrow chip
- Hero meta: 3 dot+text rows (12,400+ verified, Free for students forever, No spam)
- **Hero art**: `hero-art.png` rendered as object-fit cover inside a 480px (380px on mobile) lavender-gradient rounded stage with 36px radius

### 3. Marquee
- Black band, 18px vertical padding, 2px ink border top+bottom
- Archivo Black 22px white text, 48px gap, scrolling left at 32s linear infinite
- Items: Scholarships ✦ Grants ✦ Fellowships ✦ Tuition awards ✦ Research stipends ✦ Bursaries (yellow stars)

### 4. Features (3-card strip)
- White bg, `120px 24px` padding
- H2: "Built to make funding *actually findable.*" (italic em is purple)
- 3-col grid (gap 28px), stacks at 900px
- Each card: 36px×32px padding, 28px radius, 2px ink border, 6×6 hard ink shadow
  - Card 1 bg: lilac `#f3eaff`
  - Card 2 bg: warm yellow `#fff5c2`
  - Card 3 bg: pale violet `#e6dbff`
- Each has 120×120 white circular icon plate (2px ink border) above
- Cards: Search faster / No missed deadlines / Apply with confidence — h3 in Archivo Black 26px uppercase, body 15px Inter 400 ink-2

### 5. Discovery Dashboard Preview
- Lavender bg `#efe7ff`, `120px 24px`
- Eyebrow + H2 "One search bar. Twelve thousand *opportunities.*" with right-side sub-paragraph
- Mock dashboard card: white, 32px radius, 2px ink border, 10×10 hard shadow, padding 28px
  - Pill search input with input value `computer science · 2026 · need-based` and `Search 12,432` button (ink bg)
  - 6 filter chips (active = ink filled): Field, Deadline, Amount, Location, GPA, + More
  - 3-card results grid (collapses to 2 then 1):
    - Card 1 (white): Hopper Future Coders Award, $5,000/award, May 22 2026, CS undergrads, Hopper Foundation. Badges: ✓ Verified, Need-based
    - Card 2 (yellow): National Engineering Bursary 2026, $8,500/year, May 12 2026, Eng. yrs 1–4, NEF. Badges: Verified, Deadline soon (yellow). View button is purple, not ink.
    - Card 3 (lilac): Riley Memorial STEM Grant, $2,500/once, Jun 30 2026, 3.0+ GPA, Riley Trust. Badges: Verified, Merit
  - Each card: 22px radius, 2px ink border, badges (uppercase 11px, 5×10 padding), amount in Archivo Black 32px, dashed-border meta rows, ink View Details pill at bottom

### 6. Big Value Block
- Purple bg `#6c3aff`, white text, `120px 24px`, decorative SVG doodles in corners
- 2-col grid (1.1fr / 1fr), stacks at 920px
- Eyebrow yellow, H2 Archivo Black `clamp(44px, 6.8vw, 96px)`: "Scholarship hunting, made *effortless.*" (effortless in yellow)
- Body 18px white-85, max-width 520px
- Actions: yellow CTA (5×5 ink shadow) + white CTA, both pills with 2px ink border
- Right: 520×480 illustrated SVG scene — purple circle backdrop, dashed floor, lavender vest+navy pants character leaning on safe with shield+check icon, holding tablet showing $3,500, plus floating coins and gold crown

### 7. How It Works (3 step cards)
- Cream bg `#fdfbf7`, `120px 24px`
- H2: "Three steps. Real money. *Zero busywork.*"
- 3-col grid, gap 24px, stacks at 900px
- Each card: 32px radius, 2px ink border, padding `36px 32px 200px`, min-height 520px, 200px-tall SVG illust bleeding to bottom edge
  - Step 01 (yellow bg): Search — laptop scene with magnifier and coin
  - Step 02 (purple bg, white text, yellow num): Match — two scholarship cards with yellow heart between
  - Step 03 (lilac bg): Apply — form with green check stamp + signing pen
- Num: Archivo Black 88px, h3: Archivo Black 38px uppercase

### 8. Social Proof
- Lilac bg `#f3eaff`, `120px 24px`
- H2: "Funding shouldn't feel like a *part-time job.*"
- 4-col stat grid (collapses to 2): 12,400+ Active scholarships / $840M Total awards available / 4.5 hrs Saved per application / 100% Free for students
  - Each stat: white card, 24px radius, 2px ink border, 5×5 ink shadow, 60px Archivo Black num, uppercase 13px label, 14px sub
  - First stat has yellow corner circle (top-right, opacity .18)
- Below: 3 testimonial cards (white, 24px radius, 2px ink border) with stars row, quote, avatar circle (yellow/purple/pink-lilac) + name + role
  - Maya R. Junior Mech. Eng / Devon K. Senior Pre-med / Aisha T. Sophomore CS

### 9. Final CTA
- Yellow bg `#ffd83d`, `140px 24px`, 2px ink borders top+bottom, ink doodles in corners
- Centered H2: "Your funding. Your future. *Your move.*" — Archivo Black `clamp(64px, 11vw, 180px)`, "Your move." is purple
- Body + button row: ink CTA "Start Searching Free" (5×5 purple shadow) + white outline CTA "Talk to a student advisor"

### 10. Footer
- Ink bg `#0d0826`, `80px 24px 0`
- 4-col top: tagline+newsletter / Platform / Company / Legal
  - Tagline: Archivo Black 34px uppercase white "The fastest way to find <yellow>free money</yellow> for your degree."
  - Newsletter: pill with email input + yellow Subscribe button
  - Column headings: Space Grotesk 600 13px uppercase white-55
- **Big wordmark**: Archivo Black `clamp(72px, 17vw, 260px)`, line-height `.85`, letter-spacing `-.04em`, vertical gradient `linear-gradient(180deg, #5d2eff 0%, #3a1aa8 55%, #1a0b6b 100%)` clipped to text, "iMotive" — must show full word, no overflow truncation. `padding: 0 12px 30px`, `white-space: nowrap`, `width: 100%`, `overflow: hidden`
- Bottom row: copyright + 4 social pills (Instagram/X/TikTok/LinkedIn — circular 38×38, white-20 border, hover bg yellow + ink)

## Interactions & Behavior

- **Nav**: sticky top-16, no transform on scroll, links smooth-scroll to anchors (`#discover`, `#how`, `#proof`)
- **Yellow primary buttons**: hover `transform: translate(-2px,-2px); box-shadow: 6px 6px 0 ink` (start 4×4)
- **Ghost button arrow chip**: `transform: translateX(3px)` on parent hover
- **Search bar Search button**: hover bg darkens from `#6c3aff` to `#4a1fd1`
- **Feature cards**: hover `transform: translate(-3px,-3px)`, shadow grows from 6×6 to 9×9
- **Scholarship result cards**: hover `transform: translateY(-3px)`
- **Marquee**: `@keyframes marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}` — duplicate the track twice for seamless loop
- **Footer socials**: hover bg → yellow, color → ink, border-color → yellow
- All transitions `0.15s` default (buttons), `0.2s` (cards)

## State Management

This is a **static marketing page** — no app state needed. Behaviors required:
- Newsletter form: capture email → POST to your mailing-list endpoint → show success state
- Hero search input: on submit, route to `/discover?q=<encoded>` (or equivalent)
- "Get Started Free" / "Start Searching Free" / "Open free account": route to `/signup`
- "Browse Scholarships" / "See live demo": route to `/discover`
- "Login": route to `/login`
- "Talk to a student advisor": route to `/contact` or open Calendly modal

## Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| `--indigo` | `#160a5e` | Primary text on light bg, h1/h2 |
| `--indigo-2` | `#1f1379` | Secondary deep purple |
| `--purple` | `#6c3aff` | Royal purple — accents, CTA, value section bg |
| `--purple-deep` | `#4a1fd1` | Hover state for purple |
| `--lavender` | `#efe7ff` | Light section bg |
| `--lilac` | `#f3eaff` | Lighter lilac bg, social proof |
| `--pink-lilac` | `#f0c6ff` | Avatar accent |
| `--yellow` | `#ffd83d` | Primary accent, badges, final CTA bg |
| `--yellow-warm` | `#ffc928` | Coin shadow / stat accent |
| `--cream` | `#fdfbf7` | Off-white body bg |
| `--ink` | `#0d0826` | Near-black borders, text, footer bg |
| `--ink-2` | `#231656` | Body copy |
| `--line` | `#d8c8ff` | Light dividers, placeholder text |

### Typography
- **Display**: `Archivo Black`, weight 900, letter-spacing `-0.01em`, line-height `0.92`, often UPPERCASE
- **Mid display**: `Space Grotesk`, weights 500/600/700 — eyebrows, scholarship card titles
- **Body/UI**: `Inter`, weights 400/500/600/700
- All loaded from Google Fonts: `family=Archivo+Black&family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700`

### Type scale (display)
- H1 hero: `clamp(56px, 9.4vw, 140px)`
- H2 features: `clamp(40px, 6vw, 80px)`
- H2 dashboard: `clamp(40px, 5.6vw, 72px)`
- H2 value: `clamp(44px, 6.8vw, 96px)`
- H2 how/proof: `clamp(40px, 6vw, 84px)` / `clamp(48px, 7.4vw, 116px)`
- H2 final CTA: `clamp(64px, 11vw, 180px)`
- Footer wordmark: `clamp(72px, 17vw, 260px)`

### Spacing
- Section vertical padding: 120px (80px on mobile)
- Section horizontal padding: 24px (18px on mobile)
- Card grid gap: 20–28px
- CTA gap in rows: 12–14px

### Border radius
- Pills/buttons: `999px`
- Cards: `22–32px`
- Icon plates (circles): `50%`

### Shadows (neo-brutalist)
- Buttons: `4px 4px 0 var(--ink)` → hover `6px 6px 0 var(--ink)`
- Cards: `5px 5px 0 var(--ink)` (stat) / `6px 6px 0 var(--ink)` (feature) / `10px 10px 0 var(--ink)` (dashboard)
- Soft shadows: `0 14px 40px -20px rgba(22,10,94,.35)` (nav) / `0 24px 60px -28px rgba(22,10,94,.45)` (hero search)

### Stroke conventions
- All bordered cards/buttons use `2px solid var(--ink)` (ink = `#0d0826`)

## Assets
- `hero-art.png` — flat illustration of student on bean bag with phone, scholarship doc, large phone showing $5,000 award, lavender room with line-art doodles. Ship as-is. Re-export at @2x for retina if your build supports it.
- All other illustrations are inline SVG in the source HTML and can be ported directly to your component tree (or extracted to React components / .svg files).
- Icons: inline SVG (search, arrow, calendar, shield, social glyphs). Replace with your codebase's icon library (Lucide, Heroicons, Phosphor) if it has equivalents — match stroke weight `2.4–2.6`, `stroke-linecap: round`.

## Responsive

| Breakpoint | Behavior |
|---|---|
| `≤ 980px` | Dashboard results: 2-col |
| `≤ 920px` | Value block: stack |
| `≤ 900px` | Features/Steps/Stats/Quotes: 1-col (stats stay 2-col); footer top: 2-col |
| `≤ 880px` | Nav links hide |
| `≤ 780px` | Hide chip in hero search; hero art shrinks to 380px |
| `≤ 680px` | Dashboard results: 1-col |
| `≤ 680px` | Tighten section padding to 80px / 18px |
| `≤ 560px` | Footer top: 1-col |

## Files
- `iMotive Landing.html` — full source prototype (single file, all sections inline)
- `hero-art.png` — hero illustration (raster)

The HTML is single-file with embedded `<style>`. When porting:
1. Extract CSS variables to your tokens file
2. Split sections into components: `<Nav>`, `<Hero>`, `<Marquee>`, `<Features>`, `<DiscoveryDashboard>`, `<ValueBlock>`, `<HowItWorks>`, `<SocialProof>`, `<FinalCTA>`, `<Footer>`
3. Lift the inline SVG illustrations into separate `<Illustration*>` components
4. Replace anchor links with your router's `<Link>` component
5. Wire newsletter + search forms to your backend endpoints
