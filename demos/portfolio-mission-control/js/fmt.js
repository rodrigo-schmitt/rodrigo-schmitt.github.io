/* Formatting helpers */
const fmt = {
  pct: (v, d = 1) => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(d) + "%",
  spct: (v, d = 1) => (v == null || isNaN(v)) ? "—" : (v > 0 ? "+" : "") + (v * 100).toFixed(d) + "%",
  usd: (v, d = 0) => (v == null || isNaN(v)) ? "—" :
    "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }),
  susd: (v) => (v == null || isNaN(v)) ? "—" : (v >= 0 ? "+" : "−") + fmt.usd(Math.abs(v)),
  num: (v, d = 2) => (v == null || isNaN(v)) ? "—" : Number(v).toFixed(d),
  date: (s) => s ? new Date(s + "T00:00:00").toLocaleDateString("en-US",
    { month: "short", day: "numeric", year: "numeric" }) : "—",
};

/* Resolve a value against a registry entry's buckets → {cls, verdict}.
   Mirrors metrics_registry.verdict_for(). */
function verdictFor(registry, key, value) {
  const e = registry?.[key];
  if (!e) return { cls: "info", verdict: "" };
  if (e.levels) return e.levels[String(value)] || { cls: "info", verdict: "" };
  for (const t of e.thresholds || []) {
    const lo = t.min, hi = t.max;
    if ((lo == null || value >= lo) && (hi == null || value < hi))
      return { cls: t.cls, verdict: t.verdict };
  }
  return { cls: "info", verdict: "" };
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
