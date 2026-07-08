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
figures + project videos — new content images go here), `images/planets/` (surface WebP
covers + `nav/` circular planet sprites), `images/videos/` (web-encoded descent MP4s),
`images/hero/` (astronaut). `sources/cinematic/` holds the uncommitted 4K masters (gitignored).

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

### Cinematic descent heroes (§29–§33 of `site.css` + `js/descent.js`)

- **Concept: every planet page opens with its planet's surface as a full-bleed hero;
  on video pages the descent from orbit plays once and freezes there.** Six hero pages
  (Home, Projects, Book List, Movie List, Publications & CV, Grad 101) start with a
  `section.descent`. Two modes:
  - **Video mode** (`.descent--video`, Home/Earth, Projects/Moon, Book List/Mars): a
    **pinned scroll-scrub** — the section is `--descent-h` (350vh) tall with a sticky
    100svh `.descent__sticky` viewport; `js/descent.js` maps scroll progress to
    `video.currentTime` (the video is NEVER played — paused seeks only). Encode is
    **all-intra** (`-c:v libx264 -crf 21 -g 1 -bf 0`, no audio, `+faststart`; every frame a
    keyframe or seeking is unusably janky) at `/images/videos/{planet}_descent.mp4`.
    `.descent__text` snippets (`data-show`/`data-hide` fractions) fade in/out over the
    footage; telemetry HUD + gauge track `--dp`; at p>0.92 the section gets `.is-landed` —
    the title letter-splits in and the video crossfades to the 2560w surface still beneath
    (its last frame matches, so the swap is seamless; scrubbing back reverses everything).
    Loading is armed by IntersectionObserver (rootMargin 200%); `is-ready` gates
    video/HUD/gauge visibility. Without JS the section is a static 56svh band.
  - **Still mode** (`.descent--still`, Movie List/Jupiter, Publications/Saturn, Grad/Uranus —
    no source videos yet): the surface image, static, title visible immediately, HUD reads
    "SURFACE CAM", no gauge, no `descent.js`. Swap to video mode when Higgsfield descent
    videos exist for these planets.
- **Surface covers**: `/images/planets/{planet}_surface-{960,1600,2560}.webp`
  (`srcset`/`sizes=100vw`); the 1600w doubles as the video `poster`. The `.descent__fallback`
  img carries the real `alt` and is the reduced-motion / no-JS cover.
- **Orbit covers** (video pages, §34): `/images/planets/{planet}_orbit-{960,source-width}.webp`
  = the video's first frame (extracted from `sources/cinematic/{p}_rotating.mp4`). Under
  JS+motion the surface fallback is hidden until `is-ready`/`is-landed` and the
  `.descent__orbit` img covers the MP4 load instead, so the hero opens on the planet from
  space, not the surface. Its `src`/`srcset` live in `data-src`/`data-srcset` and are
  injected by `descent.js` `arm()` — no-JS / reduced-motion visitors fetch zero orbit bytes.
- **Markup contract** (see `pages/projects_.html` as reference): section carries
  `data-descent="{planet}"`; children are `.descent__fallback` img, (video pages)
  `.descent__orbit` img (empty `alt`, `data-src`/`data-srcset`), (video pages)
  `.descent__video`, `.descent__hud`, (video pages) `.descent__gauge`, `.descent__overlay`
  (caption + the page **`<h1 class="descent__title">`** — moved out of `.page-header`; home
  uses a `<p>` title to keep its hero `<h1>`). Hero subpages add body class `has-descent`
  (kills main's top padding; **not** on home, where the descent sits mid-page) and all six
  load the Google Fonts `<link>`; only video pages load `/js/descent.js`.
- **Reduced motion / no-JS**: `descent.js` bails (video never plays, **zero video bytes**);
  §27 hides the video/HUD/gauge so the static surface cover + all text shows. Letter-split
  spans only exist under JS+motion.
- **Homepage astronaut** (§32): `.hero--cinematic` + full-bleed `.hero__scene` img
  (pre-graded to the palette, mask-feathered into `#060913`), behind the name/tagline;
  dimmed to 0.3 opacity ≤760px for tagline contrast. The hero eyebrow uses DM Sans 500
  uppercase wide-tracked (the cinematic label style).
- **Photoreal nav planets** (§33): the homepage `.solar-nav` uses circular cutouts from the
  4K stills (`/images/planets/nav/{planet}.webp`, `img.planet.planet-photo.planet--{name}`;
  Saturn keeps rings, sized by height with negative margins). **The header tab keeps the
  pure-CSS spheres.** Header nav labels sit under their planet INSIDE the 60px bar
  (absolutely positioned, opacity-gated on hover/current).
- **Regenerating assets** (needs ffmpeg — `winget install Gyan.FFmpeg`; not on PATH in fresh
  shells, prepend `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\...\bin`):
  videos `ffmpeg -i sources/cinematic/{p}_rotating.mp4 -c:v libx264 -crf 22 -preset slow -an -movflags +faststart images/videos/{p}_descent.mp4`;
  stills `ffmpeg -i sources/cinematic/{p}_surface.png -vf "scale={W}:-2:flags=lanczos" -c:v libwebp -quality {90|88|85} ...`;
  nav sprites via the Pillow cutout script (see auto-memory). 4K masters + source videos
  live in `sources/cinematic/` — **gitignored**, regenerable only from this machine/OneDrive.

## Hard rules

1. **Never reintroduce external scripts, stylesheets, fonts, or CDNs.** Self-contained HTML + `/css/site.css` + `/js/site.js` (+ `/js/descent.js` on hero pages) only. Two sanctioned exceptions: (a) content images hotlinked by the generated lists; (b) **Google Fonts Playfair Display + DM Sans (July 2026)**, `<link>`-loaded only on the six descent-hero pages and used only for `.descent` overlay type (`--font-cine-*` tokens, scoped on `.descent`). Nothing else.
2. **Never hand-edit the generated `.gr-*`/`.lb-*` item markup** in `book_list_.html` / `movie_list_.html` without updating the refresh docs (auto-memory: `goodreads-favorites-booklist.md`, `letterboxd-favorites-movielist.md`). Those two files are **CRLF** — preserve line endings (enforced by `.gitattributes`).
3. **All new pages copy the fenced blocks** `<!-- ===== SITE HEADER v2 ===== -->` / `<!-- ===== SITE FOOTER v1 ===== -->` byte-identically from `index.html` (footer quote is the one per-page variation) and link `/css/site.css` + `/js/site.js` (root-absolute — this is a user Pages site). New pages also need a `planet-*` body class and the `.aurora` div in the starfield block. To change the nav site-wide, grep for the fence markers and apply the same edit to all 9 pages (bump the fence version when the block's content changes).
4. **Respect `prefers-reduced-motion`**: any new animation must be disabled in the reduced-motion block of `site.css` and/or gated on the `reducedMotion` check in `site.js`. Reveal animations must stay gated on `html.js` so no-JS users see content.
5. **Keep URLs/filenames stable** — existing links point at them.
6. Every image needs real `alt`; **content** videos are `controls preload="none" poster=…`, never autoplay; single `h1` per page; keep `#main` as the skip-link target. Sole exception: the muted, decorative descent-hero videos (`.descent__video`, no audio track) are scroll-scrubbed **paused** by `descent.js` (currentTime seeks only — they are never played at all), and never load under reduced motion.

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
`py -3 tools/serve.py 8000` from the repo root (root-absolute URLs require serving from
root; `file://` will not work). Open http://localhost:8000/. **Do not use plain
`py -3 -m http.server`** — it lacks HTTP Range support, so Chrome marks the descent videos
non-seekable (`video.seekable` empty) and the scroll-scrub silently freezes on frame 0.
GitHub Pages serves ranges in production; `tools/serve.py` matches that locally.

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
- Descent pages: the scrub follows scroll smoothly forward AND backward (serve via `tools/serve.py` — see Local preview); text snippets appear at their ranges; landing crossfades to the crisp 2560 still; reduced-motion shows the static surface cover with **zero** `/images/videos/` requests; earth MP4 ≤15 MB, others ≤8 MB.
- Text contrast ≥ 4.5:1 against its actual background (glass panel over starfield, not the raw token).
- All internal links and images resolve (serve locally and click through, or run a link-check script).
- Reduced-motion behavior verified: content visible, no parallax/reveal/drift.
