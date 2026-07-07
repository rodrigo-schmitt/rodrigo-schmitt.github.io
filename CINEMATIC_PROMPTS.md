# Iteration: Cinematic planet-descent covers + astronaut homepage

## Context

The site currently renders planets as hand-built CSS gradient spheres (nav) and static
per-page horizons. This iteration adds a **cinematic layer**: each subpage opens with a
scroll-scrubbed "descent from orbit to surface" of its planet, built on the
`animated_website` engine, and the homepage gains a color-graded astronaut hero. The nav
stays as-is (pure-CSS spheres — confirmed).

This document is a **generation spec**, not a code change. Its job is to hand you
copy-paste-ready prompts for the assets you'll make in Higgsfield (6 planet start-frames,
6 prepped surface end-frames, 1 astronaut hero, 6 descent videos), plus the build prompt
for the future session that assembles the site with the `animated_website` skill.

**Decisions locked (this session):**
- Experience: **scroll-scrubbed intro per subpage** (globe → fall → surface, content overlays).
- Design: **Deep Space palette, Google Fonts allowed** for the cinematic hero type only.
- Nav: **keep pure-CSS spheres** → the new circular planet images are *video start frames*, not nav icons.
- Astronaut: **color-graded cool + faded edges** (dissolve into `#060913`), subtle motion optional.

**Core concept — every planet is a descent.** Start frame = the globe in orbit. End frame =
that planet's surface (which *is* the page cover). The video is the single continuous fall
between them; sped-up rotation eases into an accelerating dive, resolving exactly on the
surface. Because it's scroll-scrubbed, motion must read cleanly forward and backward.

| Nav node → Page (body class) | Start frame (globe) | End frame (surface = cover) |
|---|---|---|
| Earth → Home (`planet-earth`) | `earth.jpg` crescent + sun flare | `earth_surface.jpg` ISS night city-lights |
| Moon → Projects (`planet-moon`) | `moon.jpg` full disc | `moon_surface.jpg` craters + Earthrise |
| Mars → Book List (`planet-mars`) | `mars.jpg` red disc | `mars_surface.jpg` rust valley + peaks |
| Jupiter → Movie List (`planet-jupiter`) | `jupiter.jpg` banded disc | `jupiter_surface.png` Juno swirls |
| Saturn → Publications & CV (`planet-saturn`) | `saturn.avif` ringed disc | `saturn_surface.jpg` rings overhead from haze |
| Uranus → Grad 101 (`planet-uranus`) | `uranus.jpg` cyan disc | `uranus_surface.jpg` pale cloud-sea |

Note: the 3 Projects sub-pages (`orbit-and-space-dynamics`, `deep-learning-and-ai`,
`design_build_test`) are all `planet-moon` → they reuse the Moon descent (or run intro-less).
Home leads with the astronaut hero; the Earth descent is its scroll section beneath the hero.

---

## Part 1 — Image prompts (Higgsfield `generate_image` / `upscale_image`)

The 6 source planets are tiny (11–31 KB) and inconsistently framed, so each needs an
upscale + recompose pass to become a crisp, consistent orbit **start frame**. The 6 surfaces
just need upscale + 16:9 crop + a light unifying grade (they become the **last frames**, so
prep them first and feed the *same* file into the video).

### 1A. Planet orbit start-frames (×6)

Recipe per planet: `upscale_image` the source to 4K → `generate_image` image-to-image with
the source as reference (low denoise, preserve real features) using the shared background +
per-planet subject below. Output 16:9, planet ~55% of frame height, centered.

**Shared background clause (append to each):**
> Centered planet on a deep-space background: near-black `#060913`→`#0B1020` gradient, sparse
> realistic stars, a very subtle cyan-and-violet nebula wash in one corner, faint atmospheric
> rim-glow on the limb. Photoreal, cinematic, 16:9, 4K. Planet occupies ~55% of frame height
> with generous empty space around it. Preserve the reference planet's exact colors and
> surface features. No text, no UI.

**Per-planet subject line:**
- **Earth** — "Earth as a sunlit crescent, a bright warm solar flare breaking at the terminator, night side in shadow with faint city lights beginning to glow."
- **Moon** — "the full Moon, subtle mineral color mottling in blues and tans, sharp raking-light crater detail."
- **Mars** — "Mars, full red-orange disc, visible dark albedo markings and faint dust-storm banding."
- **Jupiter** — "Jupiter, full disc, cream and rust cloud belts and zones, the Great Red Spot, delicate turbulent swirls."
- **Saturn** — "Saturn, pale-gold banded globe with the full ring system tilted ~20°, thin ring shadow cast across the globe." *(source is `.avif` — decode/convert first if the tool can't read it.)*
- **Uranus** — "Uranus, smooth pale-cyan sphere, softly shadowed limb, barely-there horizontal banding."

### 1B. Surface end-frames (×6)

Per surface: `upscale_image` to 4K → `reframe`/`outpaint` to 16:9 if not already → light grade
(deepen shadows, unify contrast so the six read as one set; keep each planet's true palette).
Save as the canonical cover AND reuse as the video's last frame. Existing files:
`earth_surface.jpg`, `moon_surface.jpg`, `mars_surface.jpg`, `jupiter_surface.png`,
`saturn_surface.jpg`, `uranus_surface.jpg`. No recolor away from planet-accurate tones.

### 1C. Astronaut homepage hero (image)

> Recolor and grade this astronaut-walking scene into a cool "Deep Space" palette: shift the
> warm orange Mars sunset toward deep blues, teal and violet, keeping only the sun and its
> immediate halo as a small warm cyan-gold accent. Deepen the upper sky to near-black
> `#060913` with a subtle cyan/violet nebula and faint stars. Feather the top and side edges
> so they dissolve seamlessly into a solid `#060913` background (soft vignette, no hard
> border). Preserve the lone astronaut walking away toward the horizon and the small Earth in
> the sky. Cinematic, photoreal, 16:9 wide hero, with open sky on the left for overlaid text.

Optional ambient loop (`generate_video`, static image as first frame, subtle motion):
> Living-still: fine drifting dust and faint heat shimmer across the plain, a slow aurora
> ripple in the sky, the astronaut's stride barely advancing, gentle parallax. Seamless
> 8-second loop, minimal motion, 16:9. *(Reduced-motion falls back to the static graded image.)*

---

## Part 2 — Descent video prompts (Higgsfield `generate_video`, first + last frame)

For every video: **first frame = the 1A orbit start-frame, last frame = the 1B surface
end-frame.** Settings: 16:9, 4K if available, ~5–6 s, minimal camera shake, no text/UI.

**Shared style clause (prepend to each):**
> Photorealistic cinematic space cinematography, single continuous take, no cuts, virtual
> 35 mm anamorphic lens, volumetric light, fine film grain, deep blacks, high dynamic range.
> One smooth continuous descent from orbit to the surface; planetary rotation gently sped up;
> steady even motion that reads cleanly when scrubbed forward or backward. Begin exactly on
> the provided first frame and land exactly on the provided last frame, matching its
> composition, color and lighting precisely.

**Earth — Home**
> Descend from high orbit toward Earth's night side. The sunlit crescent rotates out of frame
> as the camera glides over the terminator into darkness; continent-spanning city-light
> constellations ignite below, a luminous cyan airglow line traces the curved horizon, faint
> aurora shimmer at the pole. The camera eases toward the limb and settles on the night-side
> view. Awe-struck pacing, subtle flare from the vanishing sun.

**Moon — Projects**
> Approach the full Moon and dive toward its cratered surface. Airless grey terrain rushes up,
> craters and ridges resolving in hard raking sunlight with pin-sharp shadows. The camera
> pitches down and levels just above the regolith as a brilliant blue Earth climbs over the
> stark lunar horizon into a jet-black, star-dusted sky. Crisp, high-contrast, documentary.

**Mars — Book List**
> Fall from orbit toward the rusted disc of Mars. The camera pierces a thin dusty pink-tan
> atmosphere; the curvature flattens into an endless ochre plain scattered with rocks and
> dunes, distant ranges softened by airborne dust. Warm low sun rakes long shadows across the
> terrain. The descent slows to a hovering glide over the red desert toward the far peaks.

**Jupiter — Movie List**
> Plunge toward Jupiter's banded cloud tops. Belts and zones swell and churn as the camera
> dives in; laminar bands break into turbulent marbled swirls, curling storm eddies and pale
> ovals streaming past in cream, amber and slate-blue. The move decelerates into a hovering
> drift over a hypnotic field of swirling cloud tops. Immense weightless scale, painterly.

**Saturn — Publications & CV**
> Descend past Saturn's rings toward the planet. The camera sweeps beneath the ring plane —
> the rings compress into a razor-thin luminous silver arc slicing across the sky overhead —
> and sinks into the hazy upper atmosphere. A soft golden cloud floor spreads below with a
> subtle swirling storm; ring-shine and a faint meteor streak light the pale sky. Serene,
> majestic, cathedral scale.

**Uranus — Grad 101**
> Drift down toward the smooth cyan sphere of Uranus. The featureless disc grows until the
> camera slips into thick diffuse methane haze; faint horizontal bands and a gently undulating
> pale blue-green cloud-sea resolve below in soft mist and cold even light. The descent
> settles into a slow glide over an ethereal, almost featureless cloud ocean. Cold, minimalist
> grandeur.

---

## Part 3 — Website build prompt (future session, `animated_website` skill)

Paste this to the session that assembles the site once videos + images exist:

> **Goal:** Add a scroll-scrubbed "orbital descent" cinematic hero to each planet subpage of
> this Deep Space portfolio, using the `animated_website` skill's engine (scroll-dwell canvas
> frame-player, ambient grain/particles, glass cards), integrated into the existing multi-page
> site — NOT as a standalone single-file site.
>
> **Per-page mapping** (video → page → body class → overlay title):
> Earth→`index.html` (`planet-earth`), Moon→`pages/projects_.html` (`planet-moon`),
> Mars→`pages/book_list_.html` (`planet-mars`), Jupiter→`pages/movie_list_.html`
> (`planet-jupiter`), Saturn→`pages/publications-and-cv_.html` (`planet-saturn`),
> Uranus→`pages/grad-applications_.html` (`planet-uranus`). Projects sub-pages reuse the Moon
> frames. Home also keeps the astronaut hero above its Earth descent.
>
> **Pipeline:** For each video run `scripts/extract_frames.py` → WebP frames into
> `/images/descent/{planet}/desktop|mobile/`. Budget: 100–150 frames, <10 MB desktop / <5 MB
> mobile per page (per skill). Root-absolute URLs (user Pages site).
>
> **Integration pattern (per page):** the scroll-canvas hero sits at the very top, above the
> existing article content. The final frame (surface) is the page cover; the page `<h1>`
> letter-splits in on arrival at the surface. Below the animation, the existing content stays
> unchanged. Preserve byte-identical `<!-- SITE HEADER v2 -->` / `<!-- SITE FOOTER v1 -->`
> fences, the `planet-*` body class, the `.aurora` starfield div, `#main` skip target, single
> `<h1>`, real `alt` text.
>
> **Design:** Deep Space palette only — `#060913`→`#0B1020` bg, glass `rgba(14,20,40,.6)`,
> accents cyan `#5EEAD4` / blue `#60A5FA` / violet `#A78BFA`, borders `rgba(148,163,184,.15)`.
> Google Fonts (**Playfair Display + DM Sans**) are permitted for the cinematic hero overlay
> type ONLY — this is a **sanctioned exception to CLAUDE.md Hard Rule #1**; record it in
> CLAUDE.md. Everything else (frames, JS, images, body/heading type = self-hosted Space
> Grotesk + system stack) stays self-contained. Restyle the skill's warm luxury palette to
> these tokens; drop its warm accents.
>
> **Reduced motion (`prefers-reduced-motion`):** show the static surface end-frame as a plain
> cover image, no scroll-scrub, all content visible; gate the engine on `html.js` and the
> existing `reducedMotion` check in `js/site.js`. No-JS users see the surface + content.
>
> **Optional (creative, on-brand):** a faint "mission telemetry" HUD in a corner (descending
> altitude readout tied to scroll progress) and repurpose the skill's chapter-markers as an
> orbital-descent progress gauge. Keep silent (no audio). Speed-ramp the descent: slow
> rotation easing into an accelerating dive (matches "sped up a bit").
>
> **Verify** per the CLAUDE.md Screenshot QA checklist: serve `py -3 -m http.server 8000`;
> screenshot desktop 1440 + mobile 375; clean console; payloads within budget; reduced-motion
> on/off; all internal links/images resolve; text contrast ≥4.5:1 over the frames.

---

## Part 4 — Creative additions (on-theme, optional)

- **Descent telemetry HUD** — thin monospace corner readout (ALT ↓, VEL, planet name) that
  animates with scroll; ties the "space systems engineer" identity to the cinematic.
- **Arrival letter-split** — page `<h1>` assembles as the descent lands on the surface.
- **Per-planet overlay captions** (starting points, edit freely): Projects/Moon "one small
  step, many systems"; Book List/Mars "field notes from the red planet"; Movie List/Jupiter
  "stories at giant scale"; Publications/Saturn "the rings of the record"; Grad 101/Uranus
  "charting the outer path."
- **Homepage** — astronaut hero + subtle dust/aurora loop, flowing into the existing
  `.solar-nav`; the walk reads as "you are the explorer."

---

## Asset checklist & naming (as built, July 2026 — v2 video heroes)

- 4K masters (gitignored inputs) → `sources/cinematic/{planet}.png`,
  `sources/cinematic/{planet}_surface.png`, `sources/cinematic/{planet}_rotating.mp4`,
  `sources/cinematic/astronaut_walking.png`
- Web descent videos → `images/videos/{earth,moon,mars}_descent.mp4`
  (H.264 crf22 +faststart, no audio; play once and freeze on the surface —
  the WebP frame-scrub pipeline is retired)
- Surface covers → `images/planets/{planet}_surface-{960,1600,2560}.webp`
- Photoreal solar-nav sprites → `images/planets/nav/{planet}.webp` (circular
  cutouts from the 4K stills; Saturn keeps its rings)
- Astronaut hero → `images/hero/astronaut_hero-{1920,960}.webp`
- Still missing (generate when Higgsfield credits return): descent videos for
  **jupiter / saturn / uranus** — encode the same way and flip those three pages
  from `descent--still` to `descent--video` (see CLAUDE.md, "Cinematic descent heroes")

## Verification (post-generation, before merge)

1. Confirm each video begins on its start-frame and lands exactly on its surface (scrub both ways).
2. `scripts/extract_frames.py` per video; check `manifest.json` payloads vs budget.
3. Build pages; `py -3 -m http.server 8000`; QA at 375 px + 1440 px, reduced-motion on/off.
4. Clean console; no external requests except the sanctioned Google Fonts + existing
   Goodreads/TMDB content images; all links/images resolve; contrast ≥4.5:1.
5. Update CLAUDE.md to record the Google-Fonts exception and the descent-cover system.
