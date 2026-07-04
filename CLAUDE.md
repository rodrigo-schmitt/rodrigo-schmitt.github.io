# CLAUDE.md — rodrigo-schmitt.github.io

## Project overview

Personal portfolio of Rodrigo Schmitt (Space Systems Engineer, ML Engineer & Physicist),
a **static GitHub Pages user site** served at the domain root. Rebuilt in July 2026 on the
hand-crafted **"Deep Space"** design system — no frameworks, no build step, zero external
runtime dependencies (all CSS/JS/fonts are self-hosted; the only external requests are
content images on the generated list pages: Goodreads covers and TMDB posters).

### Page map (URLs are stable — never rename)

| Page | Path | Notes |
|---|---|---|
| About (landing) | `index.html` | Hero, highlights, featured project cards |
| Projects hub | `pages/projects_.html` | 3 cards linking the sub-pages below |
| Astrodynamics | `pages/orbit-and-space-dynamics.html` | Article layout |
| Deep Learning & AI | `pages/deep-learning-and-ai.html` | Article layout |
| Design, Build & Test | `pages/design_build_test.html` | Article layout; has 2 videos (`preload="none"`) |
| Publications & CV | `pages/publications-and-cv_.html` | Journal/Conference/Tech-report lists, CV button |
| Book List | `pages/book_list_.html` | **GENERATED** — see Recurring workflows |
| Movie List | `pages/movie_list_.html` | **GENERATED** — see Recurring workflows |
| Grad Applications 101 | `pages/grad-applications_.html` | Long-form, sticky TOC |

### Deep Space design system (all tokens in `css/site.css` `:root`)

- **Background**: `#060913 → #0B1020` gradient; glass panels `rgba(14,20,40,.6)` + `backdrop-filter: blur`.
- **Text**: `#E6EAF2` primary (`--text-1`), `#98A2B8` secondary (`--text-2`).
- **Accents** (use sparingly): cyan `#5EEAD4`, electric blue `#60A5FA` (links/interactive), violet `#A78BFA` (chips/highlights).
- **Borders**: `rgba(148,163,184,.15)`; hover glow shadows with accent at low alpha.
- **Fonts**: Space Grotesk (self-hosted variable woff2 in `fonts/`) for headings; system stack for body. Fluid `clamp()` type scale (`--fs-*`).
- **Starfield**: 3 pure-CSS `box-shadow` layers (`.stars--s/m/l`) inside `.starfield`, slow drift keyframes, JS parallax; nebula via `.starfield::after` (reposition per page with body class `nebula-left` / `nebula-low`).
- **Component classes**: `.site-header`/`.site-nav`, `.hero`, `.card` (+`.card__media`), `.chip`/`.chips`, `.highlights`/`.highlight`, `.pub-list`, `.file-row`, `.timeline`, `details.course`, `.toc`/`.with-toc`, `.btn`/`.btn--primary`, `.progress-bar`, `.site-footer`/`.social`, `.reveal`/`[data-reveal-group]`, generated-list theming `.gr-*`/`.lb-*` (§14).

## Hard rules

1. **Never reintroduce external scripts, stylesheets, fonts, or CDNs.** Self-contained HTML + `/css/site.css` + `/js/site.js` only. (Content images hotlinked by the generated lists are the sole exception.)
2. **Never hand-edit the generated `.gr-*`/`.lb-*` item markup** in `book_list_.html` / `movie_list_.html` without updating the refresh docs (auto-memory: `goodreads-favorites-booklist.md`, `letterboxd-favorites-movielist.md`). Those two files are **CRLF** — preserve line endings (enforced by `.gitattributes`).
3. **All new pages copy the fenced blocks** `<!-- ===== SITE HEADER v1 ===== -->` / `<!-- ===== SITE FOOTER v1 ===== -->` byte-identically from `index.html` (footer quote is the one per-page variation) and link `/css/site.css` + `/js/site.js` (root-absolute — this is a user Pages site). To change the nav site-wide, grep for the fence markers and apply the same edit to all 9 pages.
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
- No external requests beyond Goodreads/TMDB content images (DevTools network tab or grep for `http` in changed files).
- Text contrast ≥ 4.5:1 against its actual background (glass panel over starfield, not the raw token).
- All internal links and images resolve (serve locally and click through, or run a link-check script).
- Reduced-motion behavior verified: content visible, no parallax/reveal/drift.
