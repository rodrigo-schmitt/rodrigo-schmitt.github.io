/* Cinematic descent hero — native video, plays once and freezes on the surface.
   Progressive enhancement: with JS disabled or under reduced motion the video
   never plays (and never downloads) — the surface poster/fallback is the cover.

   Markup contract (video pages only; stills pages are pure CSS):
     <section class="descent descent--video" data-descent="moon">
       <img class="descent__fallback" ...>   (surface cover, real alt)
       <video class="descent__video" muted playsinline preload="none"
              poster="..." src="/images/videos/{planet}_descent.mp4"></video>
       ... HUD / gauge / overlay (caption + title) ...
   The 6s descent drives --dp (gauge fill) + the telemetry HUD; on ended the
   section gets .is-landed and the title letter-splits in. */
(function () {
  "use strict";

  var section = document.querySelector(".descent--video");
  if (!section) return;
  var video = section.querySelector(".descent__video");
  if (!video) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return; /* CSS §27 hides the video; static surface cover */

  var planet = section.getAttribute("data-descent") || "earth";

  /* Plausible orbit->surface telemetry per planet: [alt km, vel km/s] at start */
  var TELEMETRY = {
    earth:   [412, 7.66],
    moon:    [110, 1.63],
    mars:    [250, 3.55],
    jupiter: [4200, 42.1],
    saturn:  [2400, 25.1],
    uranus:  [1100, 15.1]
  };
  var tele = TELEMETRY[planet] || TELEMETRY.earth;
  var hudAlt = section.querySelector('[data-hud="alt"]');
  var hudVel = section.querySelector('[data-hud="vel"]');

  /* ---- Letter-split the title (assembles on landing) ---- */
  var title = section.querySelector(".descent__title");
  if (title) {
    var text = title.textContent;
    title.setAttribute("aria-label", text);
    var holder = document.createElement("span");
    holder.setAttribute("aria-hidden", "true");
    var li = 0;
    text.split(" ").forEach(function (word, w) {
      if (w > 0) holder.appendChild(document.createTextNode(" "));
      var wordEl = document.createElement("span");
      wordEl.className = "lsw";
      word.split("").forEach(function (ch) {
        var el = document.createElement("span");
        el.className = "ls";
        el.style.setProperty("--i", li++);
        el.textContent = ch;
        wordEl.appendChild(el);
      });
      holder.appendChild(wordEl);
    });
    title.textContent = "";
    title.appendChild(holder);
  }

  function hud(p) {
    section.style.setProperty("--dp", p.toFixed(4));
    if (hudAlt) {
      var alt = tele[0] * (1 - p);
      hudAlt.textContent = alt >= 100 ? alt.toFixed(0) : alt.toFixed(1);
    }
    if (hudVel) {
      var vel = tele[1] * (1 - 0.94 * p);
      hudVel.textContent = vel >= 10 ? vel.toFixed(1) : vel.toFixed(2);
    }
  }

  var landed = false;
  function land() {
    if (landed) return;
    landed = true;
    hud(1);
    section.classList.add("is-landed");
  }

  /* Telemetry follows video time while it plays */
  var raf = 0;
  function tick() {
    var d = video.duration;
    if (d) hud(Math.min(1, video.currentTime / d));
    if (video.ended) { land(); return; }
    raf = requestAnimationFrame(tick);
  }
  video.addEventListener("play", function () {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });
  video.addEventListener("ended", land);

  /* Fade the video in only once real frames are rendering (CSS transitions
     from the surface cover, so there is never a black flash) */
  video.addEventListener("playing", function () {
    section.classList.add("is-playing");
  });

  /* Start the descent once the hero is prominently in view: immediately on
     subpages (hero sits at the top), on first scroll for the homepage
     section. Muted + playsinline permits programmatic playback; if the
     browser still blocks it, land so the title shows over the cover. */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    window.removeEventListener("scroll", check);
    video.preload = "auto";
    var attempt = video.play();
    if (attempt && attempt.catch) attempt.catch(land);
    /* Safety: never leave the title hidden (stalled network/decode) */
    setTimeout(land, 9500);
  }
  function check() {
    var rect = section.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight * 0.4) start();
  }
  window.addEventListener("scroll", check, { passive: true });
  check();
})();
