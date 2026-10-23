/* Plans and pricing: the Pro plan from _shared/billing/plans.json (via
   /api/plans), with a copy here for static hosts where there is no server. */

const PLAN_FALLBACK = {
  name: "Show Me The Money", plan: "Pro",
  free: { allowances: { tickers: 3 } },
  paid: { month: { price: 9.99 }, year: { price: 89 } },
  trial: { days: 30, allowances: { tickers: 10 } },
};

Object.assign(App, {
  priceInterval: "year",
  _plans: null,

  async renderPricing(view) {
    if (!this._plans) {
      const r = api.demo ? null : await fetch("/api/plans").catch(() => null);
      this._plans = r && r.ok ? await r.json() : PLAN_FALLBACK;
      this._ent = await api.entitlement();
    }
    const p = this._plans, ent = this._ent || {};
    const month = p.paid.month.price, year = p.paid.year.price;
    const annual = this.priceInterval === "year";
    const save = Math.round((1 - year / (month * 12)) * 100);
    const days = p.trial.days;
    const freeTickers = p.free.allowances.tickers;
    const price = annual ? `$${year}<small>/yr</small>` : `$${month.toFixed(2)}<small>/mo</small>`;
    const per = annual ? `${fmt.usd(year / 12, 2)} a month, billed yearly` : "billed monthly";
    const then = annual ? `$${year}/yr` : `$${month.toFixed(2)}/mo`;

    const rows = [
      ["Tickers analysed", String(freeTickers), "Unlimited"],
      ["Learn: every model, explained", "yes", "yes"],
      ["Risk analytics and drawdowns", "yes", "yes"],
      ["Monthly briefing and moves", "—", "yes"],
      ["Optimizer and portfolio builder", "—", "yes"],
      ["Deploy planner for a lump sum", "—", "yes"],
      ["Monthly briefing email", "—", "yes"],
    ];
    const cell = (v) => `<td class="${v === "—" ? "no" : ""}">${esc(v)}</td>`;

    const owner = ent.plan === "owner"
      ? `<div class="callout owner-note">Owner: everything is unlocked on this copy${
          ent.billing_enabled ? "" : " (billing is switched off, so local runs are always free)"}.</div>`
      : "";

    view.innerHTML = `<div class="pricing">
      ${owner}
      <h2 class="p-title">Your monthly briefing, for every holding</h2>
      <p class="p-sub">Risk, regime and next month's moves for your own portfolio.
        Start free, upgrade when you want the planner.</p>

      <div class="hz-tabs" role="tablist" aria-label="Billing period">
        <button data-int="month" role="tab" aria-selected="${!annual}" class="${annual ? "" : "active"}">Monthly</button>
        <button data-int="year" role="tab" aria-selected="${annual}" class="${annual ? "active" : ""}">Annual · save ${save}%</button>
      </div>

      <div class="plans">
        <div class="card plan">
          <h2>Free</h2>
          <div class="price">$0</div>
          <div class="per">forever</div>
          <ul><li>Learn every model</li><li>Risk on ${freeTickers} tickers</li><li>Runs on your own computer</li><li>No account needed</li></ul>
          <div class="cta"><button disabled>${ent.plan === "free" ? "Current plan" : "Included"}</button>
            <div class="fine">Free forever. Upgrade only when you want the planner.</div></div>
        </div>
        <div class="card plan featured">
          <h2>${esc(p.plan)}</h2>
          <div class="price">${price}</div>
          <div class="per">${per}</div>
          <ul><li>Unlimited tickers</li><li>Optimizer and builder</li><li>Deploy planner</li><li>Monthly briefing email</li></ul>
          <div class="cta">
            <button class="primary" id="start-trial">Start ${days}-day free trial</button>
            <a class="btn" href="?demo#/briefing">Try the demo, no account</a>
            <div class="fine" id="trial-note" aria-live="polite">${days} days free, then ${then}. Cancel anytime in your account.</div>
          </div>
        </div>
      </div>

      <div class="section"><h2>What is included</h2></div>
      <div class="card"><div class="table-scroll"><table class="cmp">
        <thead><tr><th>Feature</th><th>Free</th><th>${esc(p.plan)}</th></tr></thead>
        <tbody>${rows.map(([f, a, b]) => `<tr><td>${esc(f)}</td>${cell(a)}${cell(b)}</tr>`).join("")}</tbody>
      </table></div></div>

      <div class="section"><h2>Questions</h2></div>
      <div class="faq">
        <details><summary>Can I cancel anytime?</summary>
          <p>Yes. Cancel in your account before the ${days} days end and you are not charged.
          After that, cancelling stops the next renewal and you keep access to the end of the period.</p></details>
        <details><summary>What counts as a ticker?</summary>
          <p>Each fund or stock in your plan. The free plan analyses up to ${freeTickers};
          the trial up to ${p.trial.allowances.tickers}.</p></details>
        <details open><summary>Do you give investment advice?</summary>
          <p>No. Show Me The Money is education and analysis only. It shows what models say about
          a portfolio you choose; decisions are yours.</p></details>
        <details><summary>Where is my data kept?</summary>
          <p>On your own computer when you run it locally. The hosted version keeps your plan and
          ledger in your account and never sells or shares them.</p></details>
        <details><summary>Is it really free if I run it myself?</summary>
          <p>Yes. A local copy has every feature unlocked and never asks you to sign in.</p></details>
      </div>
    </div>`;

    view.querySelectorAll("[data-int]").forEach(b => b.addEventListener("click", () => {
      this.priceInterval = b.dataset.int; this.renderPricing(view);
    }));
    view.querySelector("#start-trial").addEventListener("click", () => {
      const note = view.querySelector("#trial-note");
      note.textContent = ent.billing_enabled
        ? "Checkout is not connected yet. Nothing was charged."
        : "This copy runs locally with everything unlocked, so there is nothing to buy here.";
    });
  },
});
