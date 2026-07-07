# CLAUDE.md — rodrigo-schmitt.github.io

## Project overview

Personal portfolio of Rodrigo Schmitt (Space Systems Engineer, ML Engineer & Physicist),
a **static GitHub Pages user site** served at the domain root. Rebuilt in July 2026 on the
hand-crafted **"Deep Space"** design system — no frameworks, no build step, zero external
runtime dependencies (all CSS/JS/fonts are self-hosted; the only external requests are
content images on the generated list pages — Goodreads covers and TMDB posters — plus the
sanctioned Google Fonts exception for the cinematic descent heroes, see Hard rule 1).

### Page map (URLs are stable — never rename)

| Page | Path | Notes |
|---|---|---|
| About (landing) | `index.html` | Astronaut hero, Earth descent, highlights, project cards |
| Projects hub | `pages/projects_.html` | Moon descent hero; 3 cards linking the sub-pages below |
| Astrodynamics | `pages/orbit-and-space-dynamics.html` | Article layout |
| Deep Learning & AI | `pages/deep-learning-and-ai.html` | Article layout |
| Design, Build & Test | `pages/design_build_test.html` | Article layout; has 2 videos (`preload="none"`) |
| Publications & CV | `pages/publications-and-cv_.html` | Saturn stills hero; pub lists, CV button |
| Book List | `pages/book_list_.html` | **GENERATED** — Mars descent hero; see Recurring workflows |
| Movie List | `pages/movie_list_.html` | **GENERATED** — Jupiter stills hero; see Recurring workflows |
| Grad Applications 101 | `pages/grad-applications_.html` | Uranus stills hero; long-form, sticky TOC |

Image layout: `images/site/` (favicon, portrait, og/card art), `images/content/` (page
figures + project videos — new content images go here), `images/planets/` (orbit/surface
WebP stills), `images/descent/{planet}/` (frame sequences), `images/hero/` (astronaut).
`sources/cinematic/` holds the uncommitted 4K masters (gitignored).

### Deep Space design system (all tokens in `css/site.css` `:root`)

- **Background**: `#060913 → #0B1020` gradient; glass panels `rgba(14,20,40,.6)` + `backdrop-filter: blur`.
- **Text**: `#E6EAF2` primary (`--text-1`), `#98A2B8` secondary (`--text-2`).
- **Accents** (use sparingly): cyan `#5EEAD4`, electric blue `#60A5FA` (links/interactive), violet `#A78BFA` (chips/highlights).
- **Borders**: `rgba(148,163,184,.15)`; hover glow shadows with accent at low alpha.
- **Fonts**: Space Grotesk (self-hosted variable woff2 in `fonts/`) for headings; system stack for body. Fluid `clamp()` type scale (`--fs-*`).
- **Starfield**: 3 pure-CSS `box-shadow` layers (`.stars--s/m/l`) inside `.starfield`, slow drift keyframes, JS parallax; nebula via `.starfield::after`, static galaxies via `.starfield::before` (both repositioned per page with body class `nebula-left` / `nebula-low`); aurora ribbons via the `.aurora` div inside `.starfield` (§25).
- **Component classes**: `.site-header`/`.site-nav`, `.hero`, `.card` (+`.card__media`), `.chip`/`.chips`, `.highlights`/`.highlight`, `.pub-list`, `.file-row`, `.timeline`, `details.course`, `.toc`/`.with-toc`, `.btn`/`.btn--primary`, `.progress-bar`, `.site-footer`/`.social`, `.reveal`/`[data-reveal-group]`, generated-list theming `.gr-*`/`.lb-*` (§14).

### Planetary navigation system (§20–§28 of `site.css`)

- **Nav = planets.** Header tabs are `a.planet-link[data-planet]` wrapping a pure-CSS `.planet .planet--{earth|moon|mars|jupiter|saturn|uranus}` sphere + a real-text `.planet-link__label` (pill tooltip on desktop, plain row text in the mobile hamburger dropdown). Mapping: Home→Earth, Projects→Moon, Book List→Mars, Movie List→Jupiter, Publications & CV→Saturn, Grad 101→Uranus; nav is in solar order. The homepage additionally has the large `.solar-nav` (sun `+` orbit arcs `+` labeled planets) between hero and highlights; hidden ≤760px.
- **Per-page planet identity** = body class `planet-earth|moon|mars|jupiter|saturn|uranus` (project sub-pages are `planet-moon`). It drives the fixed surface-horizon `body[class*="planet-"]::after` and shares palette tokens (`--p-glow`/`--p-horizon*`) with the nav icons — each planet's colors are defined once in §20.
- **Warp transition** (JS, `!reducedMotion` only): clicking a `planet-link` adds `body.is-warping` + `.is-warp-origin`, stores the planet id in `sessionStorage("warp-to")`, navigates after 800 ms (2.5 s escape hatch; `pageshow` clears state for bfcache). On load, a matching `warp-to` triggers `body.is-arriving` (page rises from the horizon). Modified/middle clicks and same-page links pass through untouched.
- **Pointer glow**: JS sets `--mx`/`--my`/`--glow-on` on `.site-nav` / `.solar-nav__field` (only when `(pointer: fine)` and motion allowed); CSS overlay `::after` renders the cursor-following highlight.
- **CSS is append-only from §20**: new sections get new numbers and are inserted physically ABOVE §27; §27 (reduced-motion) and §28 (print) must stay the LAST two blocks so their same-specificity overrides win the cascade. Do not edit §18 for new animations — add to §27.

### Cinematic descent heroes (§29–§32 of `site.css` + `js/descent.js`)

- **Concept: every planet page opens with a descent from orbit to its surface.** Six hero
  pages (Home, Projects, Book List, Movie List, Publications & CV, Grad 101) start with a
  full-bleed `section.descent` — a sticky 100svh viewport scrubbed by scroll. Two modes:
  - **Frames mode** (`.descent--frames`, Home/Earth, Projects/Moon, Book List/Mars): canvas
    scrub of 90 WebP frames extracted from Higgsfield descent videos.
    Frame path contract: `/images/descent/{planet}/{desktop|mobile}/frame-NNNN.webp` (1-based,
    pad-4) + `manifest.json`. `data-frames` must equal the actual extracted count.
  - **Stills mode** (`.descent--stills`, Movie List/Jupiter, Publications/Saturn, Grad/Uranus —
    no source videos yet): CSS crossfade orbit→surface driven by the `--dp` custom property;
    stills in `/images/planets/{planet}_{orbit|surface}-{1920|960}.webp`. Swap to frames mode
    when real descent videos exist.
- **Markup contract** (see `pages/projects_.html` as reference): section carries
  `data-descent="{planet}"`, optional `data-mode="stills"`, `data-frames`, inline
  `--descent-h` (300vh frames / 180vh stills). Inside `.descent__sticky`: canvas or
  `.descent__orbit` img, `.descent__fallback` surface img (the real-`alt` cover),
  `.descent__hud` (telemetry), `.descent__gauge`, `.descent__overlay` (caption + the page
  **`<h1 class="descent__title">`** — moved out of `.page-header`; home uses a `<p>` title to
  keep its hero `<h1>`), `.descent__cue`. Hero pages add body class `has-descent` (kills
  main's top padding; **not** on home, where the descent sits mid-page) and load
  `/js/descent.js` + the Google Fonts `<link>`.
- **Engine** (`js/descent.js`, IIFE like `site.js`): eases scroll with `p^1.6` (slow orbit →
  accelerating dive), progressive frame loading (first+last+every 8th, then batches),
  nearest-loaded-frame draw (no blank frames), DPR≤2, mobile frame set ≤760px, HUD ALT/VEL
  lerp, `is-landed` at p>0.92 letter-splits the title (hysteresis at 0.84 for re-scrub).
  **Bails entirely under `prefers-reduced-motion`** — zero frames downloaded; CSS §27 shows
  the static surface cover with all text. No-JS gets the same via `html.js` gating.
  §29 also disables the warp `is-arriving` rise on descent pages (`body:has(.descent)`) —
  a transform on `main` would break the sticky canvas.
- **Homepage astronaut** (§32): `.hero--cinematic` + full-bleed `.hero__scene` img
  (pre-graded to the palette, mask-feathered into `#060913`), behind the name/tagline.
- **Regenerating frames** (needs ffmpeg — `winget install Gyan.FFmpeg`):
  `py -3 .claude/skills/animated_website/scripts/extract_frames.py --input sources/cinematic/{planet}_rotating.mp4 --output images/descent/{planet} --frames 90 --quality 75`
  (add `--desktop-res 1280x720` for 720p sources). Budgets per page: desktop <10 MB,
  mobile <5 MB (check `manifest.json`). 4K masters + source videos live in
  `sources/cinematic/` — **gitignored**, regenerable only from this machine/OneDrive.

## Hard rules

1. **Never reintroduce external scripts, stylesheets, fonts, or CDNs.** Self-contained HTML + `/css/site.css` + `/js/site.js` (+ `/js/descent.js` on hero pages) only. Two sanctioned exceptions: (a) content images hotlinked by the generated lists; (b) **Google Fonts Playfair Display + DM Sans (July 2026)**, `<link>`-loaded only on the six descent-hero pages and used only for `.descent` overlay type (`--font-cine-*` tokens, scoped on `.descent`). Nothing else.
2. **Never hand-edit the generated `.gr-*`/`.lb-*` item markup** in `book_list_.html` / `movie_list_.html` without updating the refresh docs (auto-memory: `goodreads-favorites-booklist.md`, `letterboxd-favorites-movielist.md`). Those two files are **CRLF** — preserve line endings (enforced by `.gitattributes`).
3. **All new pages copy the fenced blocks** `<!-- ===== SITE HEADER v2 ===== -->` / `<!-- ===== SITE FOOTER v1 ===== -->` byte-identically from `index.html` (footer quote is the one per-page variation) and link `/css/site.css` + `/js/site.js` (root-absolute — this is a user Pages site). New pages also need a `planet-*` body class and the `.aurora` div in the starfield block. To change the nav site-wide, grep for the fence markers and apply the same edit to all 9 pages (bump the fence version when the block's content changes).
4. **Respect `prefers-reduced-motion`**: any new animation must be disabled in the reduced-motion block of `site.css` and/or gated on the `reducedMotion` check in `site.js`. Reveal animations must stay gated on `html.js` so no-JS users see content.
5. **Keep URLs/filenames stable** — existing links point at them.
6. Every image needs real `alt`; videos are `controls preload="none" poster=…`, never autoplay; single `h1` per page; keep `#main` as the skip-link target.

## Orchestration playbook (agents)

- **Explore agent** — read-only audits only ("find every page using pattern X", link/asset inventories). Never for edits.
- **general-purpose agent** — mechanical multi-page migrations once a reference file establishes the pattern. Give it: the reference file path, the exact checklist, and the list of target files.
- **Plan agent** — before any structural redesign (layout system changes, nav rework, new page types).
- The orchestrator (main session) **reviews every agent result against the design system before committing**.
- Agents are only spawned when the user asks or a task is genuinely parallel/mechanical — for one or two pages, just do it inline.

## Skills to use

- `/verify` after any change with runtime behavior — serve locally and exercise the pages.
- `/code-review` before merging significant changes.
- `dataviz` skill if charts are ever added.
- `/security-review` if forms or JS handling user input ever appear.

## Recurring workflows

### Refresh Book List (Goodreads RSS)
Follow auto-memory `goodreads-favorites-booklist.md`. Summary: fetch
`https://www.goodreads.com/review/list_rss/63148451?shelf=favorites`, regenerate only the
`<h2>` sections + `<ul class="gr-shelf">` blocks (manual theme buckets), keep the `.gr-*`
markup contract, do **not** emit a `<style>` block (presentation lives in `site.css` §14),
preserve CRLF.

### Refresh Movie List (Letterboxd export + TMDB)
Follow auto-memory `letterboxd-favorites-movielist.md`. Summary: user provides the Letterboxd
export ZIP under `sources/` (Cloudflare blocks scraping — don't try); posters resolved via the
TMDB search API (user-supplied key, never committed); regenerate only the `<h2>` +
`<ul class="lb-shelf">` blocks; no `<style>` block; preserve CRLF.

### Local preview
`py -3 -m http.server 8000` from the repo root (root-absolute URLs require serving from root;
`file://` will not work). Open http://localhost:8000/.

### Screenshot QA checklist
- Desktop 1440px: headless Chrome works — `chrome --headless=new --screenshot=out.png --window-size=1440,2600 --hide-scrollbars --virtual-time-budget=5000 <url>`.
- Mobile 375px: headless Chrome **clamps window width to ~482px** — use Playwright instead:
  `npx -y playwright screenshot --browser=chromium --channel=chrome --viewport-size=375,4800 --wait-for-timeout=2000 <url> out.png`
  (tall viewport so scroll-reveal content is captured).
- Check both viewports, reduced-motion on and off (DevTools emulation), and a clean console.

## Definition of done (any visual change)

- Local preview checked at mobile (375px) and desktop (1440px).
- No console errors.
- No external requests beyond Goodreads/TMDB content images and, on the six descent-hero pages only, `fonts.googleapis.com`/`fonts.gstatic.com` (DevTools network tab or grep for `http` in changed files).
- Descent pages: scrub forward AND backward smoothly; reduced-motion shows the static surface cover with **zero** `/images/descent/` requests; frame payloads within budget (`manifest.json`).
- Text contrast ≥ 4.5:1 against its actual background (glass panel over starfield, not the raw token).
- All internal links and images resolve (serve locally and click through, or run a link-check script).
- Reduced-motion behavior verified: content visible, no parallax/reveal/drift.
