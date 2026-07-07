# rodrigo-schmitt.github.io

Personal portfolio of **Rodrigo Schmitt** — Space Systems Engineer, ML Engineer & Physicist.
A hand-crafted static site (the "Deep Space" design system) hosted on GitHub Pages.
No frameworks, no build step, no external runtime dependencies.

## Structure

```
index.html                  About (landing page)
pages/
  projects_.html            Projects hub
  orbit-and-space-dynamics.html
  deep-learning-and-ai.html
  design_build_test.html
  publications-and-cv_.html
  book_list_.html           Generated from Goodreads favorites
  movie_list_.html          Generated from Letterboxd export + TMDB posters
  grad-applications_.html   Long-form advice article
css/site.css                The entire design system (tokens, components, starfield)
js/site.js                  Scroll-reveal, parallax, progress bar, nav (progressive enhancement)
js/descent.js               Cinematic descent heroes (video plays once, freezes on the surface)
fonts/                      Self-hosted Space Grotesk (variable woff2)
images/site/                Favicon, portrait, og/card art
images/content/             Page-content figures + project videos
images/planets/             Surface covers (WebP) + nav/ circular planet sprites
images/videos/              Web-encoded descent MP4s (muted, no audio track)
images/hero/                Astronaut homepage hero
files/, sources/            PDFs and list-generation inputs (sources/cinematic/ = uncommitted 4K masters)
```

## Local preview

Serve from the repo root (asset URLs are root-absolute):

```
py -3 -m http.server 8000
```

Then open http://localhost:8000/.

## Maintenance

See `CLAUDE.md` for the design-system tokens, hard rules, and recurring workflows —
including how the Book List and Movie List pages are regenerated.
