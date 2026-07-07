/* Cinematic descent hero — scroll-scrubbed native video.
   The pinned 100svh viewport scrubs the all-intra descent MP4 with the scroll
   position (video stays paused; currentTime follows an eased target). Text
   snippets fade in/out at their data-show/data-hide ranges, telemetry tracks
   the descent, and at landing the video crossfades to the 2560w surface still
   (CSS) while the title letter-splits in.

   Progressive enhancement: with JS disabled or under reduced motion the hero
   is a static surface cover (pure CSS) and no video bytes are downloaded.

   Markup contract (video pages only; stills pages are pure CSS):
     <section class="descent descent--video" data-descent="moon" style="--descent-h:350vh">
       <div class="descent__sticky">
         <img class="descent__fallback" ...>   (surface cover, real alt)
         <video class="descent__video" muted playsinline preload="none" ...>
         <div class="descent__text" data-show="0.08" data-hide="0.40">...</div>
         ... HUD / gauge / overlay (caption + title) ... */
(function () {
  "use strict";

  var section = document.querySelector(".descent--video");
  if (!section) return;
  var video = section.querySelector(".descent__video");
  if (!video) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return; /* CSS §27 collapses the hero to a static cover */

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
  var texts = [];
  section.querySelectorAll(".descent__text").forEach(function (el) {
    texts.push({
      el: el,
      show: parseFloat(el.getAttribute("data-show") || "0"),
      hide: parseFloat(el.getAttribute("data-hide") || "1")
    });
  });

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

  function progress() {
    var rect = section.getBoundingClientRect();
    var track = rect.height - window.innerHeight;
    if (track <= 0) return 1;
    return Math.max(0, Math.min(1, -rect.top / track));
  }

  var lastDp = -1;
  function hud(p) {
    if (Math.abs(p - lastDp) < 0.0005) return;
    lastDp = p;
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

  /* ---- Load the video once the hero approaches the viewport ---- */
  var ready = false;
  function arm() {
    video.preload = "auto";
    video.addEventListener("seeked", function onFirstSeek() {
      video.removeEventListener("seeked", onFirstSeek);
      ready = true;
      section.classList.add("is-ready");
    });
    if (video.readyState >= 1) {
      video.currentTime = 0.001;
    } else {
      video.addEventListener("loadedmetadata", function () {
        video.currentTime = 0.001;
      });
    }
    video.load();
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { arm(); io.disconnect(); }
    }, { rootMargin: "200% 0px" });
    io.observe(section);
  } else {
    arm();
  }

  /* ---- Scrub loop: scroll -> currentTime (video stays paused) ---- */
  var landed = false;
  var current = 0;
  (function tick() {
    var rect = section.getBoundingClientRect();
    var onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
    if (onScreen) {
      var p = progress();
      hud(p);
      if (!landed && p > 0.92) { landed = true; section.classList.add("is-landed"); }
      else if (landed && p < 0.84) { landed = false; section.classList.remove("is-landed"); }
      for (var i = 0; i < texts.length; i++) {
        var t = texts[i];
        t.el.classList.toggle("visible", p >= t.show && p < t.hide);
      }
      if (ready && video.duration) {
        var target = p * (video.duration - 0.05);
        current += (target - current) * 0.2;
        if (Math.abs(target - current) < 0.01) current = target;
        if (!video.seeking && Math.abs(video.currentTime - current) > 0.02) {
          video.currentTime = current;
        }
      }
    }
    requestAnimationFrame(tick);
  })();
})();
