/* Cinematic starfield — lightweight canvas, slow drift + occasional shooting
   star. Respects prefers-reduced-motion (renders static) and pauses when the
   tab is hidden. */
(() => {
  const canvas = document.getElementById("starfield");
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stars = [], meteor = null, w = 0, h = 0, raf = null;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(220, Math.floor((w * h) / 6500));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.5 + 0.15,
      tw: Math.random() * 0.015 + 0.003,   // twinkle speed
      ph: Math.random() * Math.PI * 2,
      vx: -(Math.random() * 0.05 + 0.01),  // slow leftward drift
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!reduced) {
        s.x += s.vx;
        if (s.x < -2) s.x = w + 2;
      }
      const a = s.a * (reduced ? 1 : (0.75 + 0.25 * Math.sin(t * s.tw + s.ph)));
      ctx.globalAlpha = a;
      ctx.fillStyle = "#cfe4ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // shooting star, rarely
    if (!reduced) {
      if (!meteor && Math.random() < 0.0015) {
        meteor = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.3,
                   vx: -7 - Math.random() * 4, vy: 3 + Math.random() * 2, life: 1 };
      }
      if (meteor) {
        meteor.x += meteor.vx; meteor.y += meteor.vy; meteor.life -= 0.02;
        ctx.globalAlpha = Math.max(meteor.life, 0) * 0.8;
        const g = ctx.createLinearGradient(meteor.x, meteor.y,
          meteor.x - meteor.vx * 8, meteor.y - meteor.vy * 8);
        g.addColorStop(0, "#dff3ff"); g.addColorStop(1, "transparent");
        ctx.strokeStyle = g; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(meteor.x - meteor.vx * 8, meteor.y - meteor.vy * 8);
        ctx.stroke();
        if (meteor.life <= 0) meteor = null;
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) { draw(t / 16); raf = requestAnimationFrame(loop); }

  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf && !reduced) raf = requestAnimationFrame(loop);
  });

  resize();
  if (reduced) draw(0);
  else raf = requestAnimationFrame(loop);
})();
