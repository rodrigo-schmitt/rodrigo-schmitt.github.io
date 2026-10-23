/* API client + status polling.
   With ?demo in the URL every read comes from the frozen files in demo/ and
   every write is refused, so the demo also runs on a static host. */
// window.SMTM_STATIC_DEMO is set only in the copy export_demo.py builds for the personal site.
const DEMO = window.SMTM_STATIC_DEMO === true || new URLSearchParams(location.search).has("demo");
const demoRead = async (name) => {
  const r = await fetch(`demo/${name}.json`);
  if (!r.ok) throw new Error(`demo ${name}: ${r.status}`);
  return r.json();
};
const DEMO_REFUSED = { ok: false, status: 403,
  body: { detail: "The demo is read-only. Start a free trial to save your own plan." } };

const api = {
  demo: DEMO,
  async results() {
    if (DEMO) return demoRead("results");
    const r = await fetch("/api/results");
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("results: " + r.status);
    return r.json();
  },
  async status() {
    if (DEMO) return demoRead("status");
    const r = await fetch("/api/status");
    return r.json();
  },
  async trends() {
    if (DEMO) return demoRead("trends");
    const r = await fetch("/api/trends");
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  },
  async recompute(fast = true) {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/recompute", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fast }),
    });
    return { ok: r.ok, body: await r.json().catch(() => ({})) };
  },
  async refreshData() {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/refresh-data", { method: "POST" });
    return { ok: r.ok, body: await r.json().catch(() => ({})) };
  },
  async ledger() { return DEMO ? demoRead("ledger") : (await fetch("/api/ledger")).json(); },
  async txn(body) {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/ledger/txn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, body: await r.json().catch(() => ({})) };
  },
  async initLedger(total) {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/ledger/init", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_capital: total }),
    });
    return { ok: r.ok, body: await r.json().catch(() => ({})) };
  },
  async builder() {
    if (DEMO) return demoRead("builder");
    const r = await fetch("/api/builder");
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("builder: " + r.status);
    return r.json();
  },
  async builderEvaluate(body) {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/builder/evaluate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  },
  async deploy() {
    if (DEMO) return demoRead("deploy");
    const r = await fetch("/api/deploy");
    if (!r.ok) throw new Error("deploy: " + r.status);
    return r.json();
  },
  async deployEvaluate(body) {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/deploy/evaluate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  },
  async deploySave(body) {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/deploy", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  },
  async settings() { return DEMO ? demoRead("settings") : (await fetch("/api/settings")).json(); },
  async saveSettings(body) {
    if (DEMO) return DEMO_REFUSED;
    const r = await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, body: await r.json().catch(() => ({})) };
  },
  async entitlement() {
    if (DEMO) return { plan: "demo", source: "demo", billing_enabled: false };
    const r = await fetch("/api/entitlement").catch(() => null);
    return r && r.ok ? r.json() : { plan: "owner", source: "local", billing_enabled: false };
  },
};
