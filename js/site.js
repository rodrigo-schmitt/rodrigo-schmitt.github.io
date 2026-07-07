/* Deep Space site behavior — vanilla JS, no dependencies.
   Everything here is progressive enhancement: the site is fully usable
   with JS disabled, and all motion is disabled under reduced-motion. */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Mark the current page in the nav ---- */
  var planetMatch = /(?:^|\s)planet-([a-z]+)/.exec(document.body.className);
  var path = location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".site-nav a, .solar-nav a").forEach(function (link) {
    var href = link.getAttribute("href");
    if (href === path || (href === "/" && path === "/")) {
      link.setAttribute("aria-current", "page");
    }
  });
  /* Pages not in the nav (project sub-pages) highlight their planet instead */
  if (planetMatch && !document.querySelector(".site-nav a[aria-current]")) {
    document.querySelectorAll('a[data-planet="' + planetMatch[1] + '"]').forEach(function (link) {
      link.setAttribute("aria-current", "page");
    });
  }

  /* ---- Mobile nav toggle ---- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---- Pointer-following glow on the planet navs (mouse only) ---- */
  if (window.matchMedia("(pointer: fine)").matches && !reducedMotion) {
    document.querySelectorAll(".site-nav, .solar-nav__field").forEach(function (zone) {
      var rect = null, raf = 0, lx = 0, ly = 0;
      function apply() {
        zone.style.setProperty("--mx", (lx - rect.left) + "px");
        zone.style.setProperty("--my", (ly - rect.top) + "px");
        raf = 0;
      }
      zone.addEventListener("pointerenter", function () {
        rect = zone.getBoundingClientRect();
        zone.style.setProperty("--glow-on", "1");
      });
      zone.addEventListener("pointermove", function (e) {
        lx = e.clientX; ly = e.clientY;
        if (!raf && rect) raf = requestAnimationFrame(apply);
      });
      zone.addEventListener("pointerleave", function () {
        zone.style.setProperty("--glow-on", "0");
        rect = null;
      });
    });
  }

  /* ---- Warp navigation: planet click -> animate -> navigate ---- */
  var warping = false;
  document.addEventListener("click", function (e) {
    if (warping || reducedMotion) return;
    var link = e.target.closest ? e.target.closest("a.planet-link") : null;
    if (!link || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.target && link.target !== "_self") return;
    if (link.getAttribute("aria-current") === "page") return;
    e.preventDefault();
    warping = true;
    link.classList.add("is-warp-origin");
    document.body.classList.add("is-warping");
    try { sessionStorage.setItem("warp-to", link.getAttribute("data-planet")); } catch (_) {}
    setTimeout(function () { location.href = link.href; }, 800);
    setTimeout(function () {
      /* Escape hatch: if navigation stalled, restore the page */
      document.body.classList.remove("is-warping");
      link.classList.remove("is-warp-origin");
      warping = false;
    }, 2500);
  });

  /* ---- Arrival animation when this page was warped to ---- */
  var warpTo = null;
  try {
    warpTo = sessionStorage.getItem("warp-to");
    sessionStorage.removeItem("warp-to");
  } catch (_) {}
  if (planetMatch && warpTo === planetMatch[1] && !reducedMotion) {
    document.body.classList.add("is-arriving");
    setTimeout(function () { document.body.classList.remove("is-arriving"); }, 1200);
  }

  /* ---- bfcache/back-button: never restore a faded-out page ---- */
  window.addEventListener("pageshow", function () {
    warping = false;
    document.body.classList.remove("is-warping");
    document.querySelectorAll(".is-warp-origin").forEach(function (el) {
      el.classList.remove("is-warp-origin");
    });
  });

  /* ---- Header blur bump + scroll progress + parallax (one rAF loop) ---- */
  var header = document.querySelector(".site-header");
  var progress = document.querySelector(".progress-bar");
  var starLayers = reducedMotion ? [] : [
    { el: document.querySelector(".stars--s"), f: -0.05 },
    { el: document.querySelector(".stars--m"), f: -0.1 },
    { el: document.querySelector(".stars--l"), f: -0.15 }
  ].filter(function (l) { return l.el; });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (header) header.classList.toggle("scrolled", y > 40);
      if (progress) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
      }
      starLayers.forEach(function (l) {
        l.el.style.marginTop = (y * l.f) + "px";
      });
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Scroll-reveal via IntersectionObserver ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    // Stagger siblings inside a [data-reveal-group] by 80ms each.
    document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
      group.querySelectorAll(".reveal").forEach(function (el, i) {
        el.style.setProperty("--reveal-delay", (i * 80) + "ms");
      });
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    revealEls.forEach(function (el) {
      // Content already in the first viewport shows immediately (no load flash);
      // the observer handles everything revealed by scrolling.
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add("is-visible");
      } else {
        observer.observe(el);
      }
    });
  }
})();
