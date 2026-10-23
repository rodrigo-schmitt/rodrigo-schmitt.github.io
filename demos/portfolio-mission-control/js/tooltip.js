/* Registry-driven tooltips — THE core Brief-1 requirement.

   Any element carrying data-metric="<registry key>" gets a hover/focus/tap
   popover: plain-English rationale, formula, threshold buckets (with the
   element's current data-value bucket highlighted), the prescribed action,
   and the GUIDE.md section. Unregistered keys log a dev warning. */
const Tooltip = (() => {
  const box = document.getElementById("tooltip");
  let registry = {};
  let current = null;
  let shownAt = 0;

  function setRegistry(r) { registry = r || {}; }

  function bucketList(entry, value) {
    const items = [];
    if (entry.levels) {
      for (const [name, lv] of Object.entries(entry.levels)) {
        const active = value != null && String(value) === name;
        items.push(`<li class="${active ? "active" : ""}">
          <span class="b-dot ${lv.cls}"></span>
          <span><b>${esc(name)}</b> — ${esc(lv.verdict)}</span></li>`);
      }
    } else {
      const v = value != null && value !== "" ? Number(value) : null;
      let matched = false;   // first-match-wins, mirroring verdict_for()
      for (const t of entry.thresholds || []) {
        const lo = t.min, hi = t.max;
        const active = !matched && v != null && !isNaN(v) &&
          (lo == null || v >= lo) && (hi == null || v < hi);
        if (active) matched = true;
        let range = "";
        const f = (x) => entry.unit === "pct" ? (x * 100).toFixed(0) + "%" : x;
        if (lo != null && hi != null) range = `${f(lo)} … ${f(hi)}`;
        else if (lo != null) range = `≥ ${f(lo)}`;
        else if (hi != null) range = `< ${f(hi)}`;
        items.push(`<li class="${active ? "active" : ""}">
          <span class="b-dot ${t.cls}"></span>
          <span>${range ? `<b>${range}</b> — ` : ""}${esc(t.verdict)}</span></li>`);
      }
    }
    return items.length ? `<ul class="buckets">${items.join("")}</ul>` : "";
  }

  function show(target) {
    const key = target.dataset.metric;
    const entry = registry[key];
    if (!entry) {
      console.warn(`[tooltip] unregistered metric key: "${key}"`);
      return;
    }
    const value = target.dataset.value;
    box.innerHTML = `
      <h4>${esc(entry.label)} <span class="guide-ref">GUIDE ${esc(entry.guide)}</span></h4>
      <div>${esc(entry.plain)}</div>
      ${entry.formula ? `<div class="formula">${esc(entry.formula)}</div>` : ""}
      ${bucketList(entry, value)}
      ${entry.action ? `<div class="action"><b>What to do:</b> ${esc(entry.action)}</div>` : ""}
      <div class="learn-link"><a href="#/learn?topic=${esc(key)}">Learn more →</a></div>`;
    box.hidden = false;
    position(target);
    current = target;
    shownAt = Date.now();
  }

  function position(target) {
    const r = target.getBoundingClientRect();
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - bw / 2),
                     innerWidth - bw - 8);
    let y = r.bottom + 10;
    if (y + bh > innerHeight - 8) y = r.top - bh - 10;
    if (y < 8) y = 8;
    box.style.left = x + "px";
    box.style.top = y + "px";
  }

  function hide() { box.hidden = true; current = null; }

  // Delegate: hover (desktop) + tap (mobile) + focus (keyboard)
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-metric]");
    if (t && t !== current) show(t);
    else if (!t && current && !box.contains(e.target)) hide();
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-metric]");
    if (t) {
      e.stopPropagation();
      // on touch, pointerover fires right before click — don't let the
      // click immediately toggle away the tooltip it just opened
      const justShown = current === t && Date.now() - shownAt < 450;
      if (current === t && !box.hidden && !justShown) hide();
      else show(t);
    } else if (!box.contains(e.target)) hide();
  });
  document.addEventListener("focusin", (e) => {
    const t = e.target.closest("[data-metric]");
    if (t) show(t);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  addEventListener("scroll", () => {
    // ignore scroll ripples right after showing (chart relayout, tap scroll)
    if (current && Date.now() - shownAt > 300) hide();
  }, { passive: true });

  /* Dev check: warn about any data-metric key missing from the registry */
  function audit() {
    const missing = new Set();
    document.querySelectorAll("[data-metric]").forEach((n) => {
      if (!registry[n.dataset.metric]) missing.add(n.dataset.metric);
    });
    if (missing.size)
      console.warn("[tooltip] unregistered metric keys on page:", [...missing]);
  }

  return { setRegistry, audit, hide };
})();

/* Helper used by views: label span with an info dot, wired to the registry */
function metricLabel(registry, key, text) {
  return `<span data-metric="${esc(key)}">${esc(text)} <i class="idot">i</i></span>`;
}
