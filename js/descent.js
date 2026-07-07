/* Cinematic descent hero — scroll-scrubbed "orbit -> surface" cover.
   Progressive enhancement on top of the Deep Space system: with JS disabled
   or under reduced motion the hero is a static surface cover (pure CSS) and
   this file does nothing — no frames are ever downloaded.

   Markup contract (one .descent section per page):
     <section class="descent descent--frames" data-descent="moon"
              data-frames="90" style="--descent-h:300vh"> ...
   Modes: default = canvas frame scrub (frames in
   /images/descent/{planet}/{desktop|mobile}/frame-NNNN.webp);
   data-mode="stills" = CSS crossfade driven by the --dp custom property. */
(function () {
  "use strict";

  var section = document.querySelector(".descent");
  if (!section) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return; /* CSS §27 shows the static surface cover */

  var planet = section.getAttribute("data-descent") || "earth";
  var stillsMode = section.getAttribute("data-mode") === "stills";
  var FRAME_COUNT = parseInt(section.getAttribute("data-frames") || "0", 10);

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

  /* Slow orbit easing into an accelerating dive */
  function ease(p) { return Math.pow(p, 1.6); }

  function rawProgress() {
    var rect = section.getBoundingClientRect();
    var track = rect.height - window.innerHeight;
    if (track <= 0) return 1;
    return Math.max(0, Math.min(1, -rect.top / track));
  }

  /* ---- Letter-split the title (assembles on landing) ---- */
  var title = section.querySelector(".descent__title");
  if (title) {
    var text = title.textContent;
    title.setAttribute("aria-label", text);
    var frag = document.createDocumentFragment();
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
    frag.appendChild(holder);
    title.textContent = "";
    title.appendChild(frag);
  }

  /* ---- Shared per-tick update: --dp, HUD, landing state ---- */
  var landed = false;
  var lastDp = -1;
  function update(p) {
    if (Math.abs(p - lastDp) > 0.0005) {
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
    /* Hysteresis so scrubbing back re-plays the title assembly */
    if (!landed && p > 0.92) { landed = true; section.classList.add("is-landed"); }
    else if (landed && p < 0.84) { landed = false; section.classList.remove("is-landed"); }
  }

  /* ---- Stills mode: CSS does the visuals, JS only drives --dp ---- */
  if (stillsMode || !FRAME_COUNT) {
    (function loopStills() {
      update(ease(rawProgress()));
      requestAnimationFrame(loopStills);
    })();
    return;
  }

  /* ---- Frames mode: canvas scrub ---- */
  var canvas = section.querySelector(".descent__canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var frameSet = window.innerWidth <= 760 ? "mobile" : "desktop";
  var dir = "/images/descent/" + planet + "/" + frameSet + "/frame-";
  var frames = new Array(FRAME_COUNT);
  var ready = false;
  var currentFrame = 0;
  var lastDrawn = -1;

  function pad4(n) { return ("000" + n).slice(-4); }

  function frameSrc(i) { return dir + pad4(i + 1) + ".webp"; }

  function loadFrame(i, cb) {
    if (frames[i]) { if (cb) cb(); return; }
    var img = new Image();
    img.decoding = "async";
    img.onload = function () { frames[i] = img; if (cb) cb(); };
    img.onerror = function () { /* leave slot empty; nearest-loaded fills the gap */ };
    img.src = frameSrc(i);
  }

  function nearestLoaded(i) {
    if (frames[i]) return frames[i];
    for (var d = 1; d < FRAME_COUNT; d++) {
      if (i - d >= 0 && frames[i - d]) return frames[i - d];
      if (i + d < FRAME_COUNT && frames[i + d]) return frames[i + d];
    }
    return null;
  }

  /* Canvas sized to the sticky box; DPR capped at 2 for perf */
  function resizeCanvas() {
    var box = canvas.parentElement;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    lastDrawn = -1; /* force redraw */
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function draw(i) {
    var img = nearestLoaded(i);
    if (!img) return;
    if (i === lastDrawn && img === frames[i]) return;
    lastDrawn = i;
    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /* Progressive loading: first + last + every 8th, then the rest in batches */
  function loadAll() {
    var critical = [0, FRAME_COUNT - 1];
    for (var i = 8; i < FRAME_COUNT - 1; i += 8) critical.push(i);
    loadFrame(0, function () {
      if (!ready) {
        ready = true;
        section.classList.add("is-ready");
        draw(0);
      }
    });
    critical.slice(1).forEach(function (i) { loadFrame(i); });
    var next = 0;
    (function batch() {
      var loadedInBatch = 0;
      while (next < FRAME_COUNT && loadedInBatch < 12) {
        if (!frames[next]) { loadFrame(next); loadedInBatch++; }
        next++;
      }
      if (next < FRAME_COUNT) setTimeout(batch, 120);
    })();
  }

  /* Start loading just before the section enters the viewport */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { loadAll(); io.disconnect(); }
    }, { rootMargin: "150% 0px" });
    io.observe(section);
  } else {
    loadAll();
  }

  (function loopFrames() {
    var rect = section.getBoundingClientRect();
    var onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
    if (onScreen) {
      var p = ease(rawProgress());
      update(p);
      var target = p * (FRAME_COUNT - 1);
      currentFrame += (target - currentFrame) * 0.14;
      if (Math.abs(target - currentFrame) < 0.02) currentFrame = target;
      if (ready) draw(Math.round(currentFrame));
    }
    requestAnimationFrame(loopFrames);
  })();
})();
