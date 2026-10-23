/* Deploy planner view (GUIDE §24) — extends App.

   Loaded after app.js: App.init() awaits its first fetch before routing, so
   these methods are in place by the time render() looks them up.

   All math lives in deploy.py. This file only keeps the working plan, builds
   forms from the type registry the server sends, and paints what comes back. */

const dpId = (p) => p + Math.random().toString(36).slice(2, 10);

const dpYears = (y) => y == null ? "Open-ended"
  : y < 1 ? `${Math.round(y * 12)} mo`
  : `${+y.toFixed(1)} yr${y === 1 ? "" : "s"}`;

Object.assign(App, {
  _deploy: null,         // GET /api/deploy
  deployPlan: null,      // working copy of the active plan
  _deployEval: null,     // last evaluation of deployPlan
  _deployDraft: null,    // open editor: {step, bucket, isNew, unit, tpl…}
  _deployPreview: null,  // evaluation of the draft bucket alone
  _deployErr: "",
  _deploySeq: 0,
  _deployTimer: null,
  _deployPrevSeq: 0,
  _deployPrevTimer: null,

  async renderDeploy(view) {
    if (!this._deploy) {
      view.innerHTML = `<div class="skeleton"></div>`;
      try {
        this._deploy = await api.deploy();
      } catch (e) {
        view.innerHTML = `<div class="card empty">Deploy planner unavailable.</div>`;
        return;
      }
      this.dpAdopt();
    }
    // The page's tooltip entries ship with its own document, so they work
    // even before the first analysis has been computed.
    Object.assign(this.registry, this._deploy.registry || {});
    Tooltip.setRegistry(this.registry);

    view.innerHTML = `
      <div id="dp-bar"></div>
      <div class="section"><h2>Buckets</h2>
        <span class="sub">each bucket is one place part of the money can go</span></div>
      <div id="dp-editor"></div>
      <div id="dp-buckets" class="grid cols-3"></div>
      <div id="dp-results"></div>
      <div class="callout dp-disclaimer">${esc(this._deploy.disclaimer)}</div>`;
    this.dpPaintBar(view);
    this.dpPaintEditor(view);
    this.dpPaintResults(view);
  },

  /* ── State helpers ─────────────────────────────────────────────── */
  dpAdopt() {
    const D = this._deploy;
    const plan = D.plans.find(p => p.id === D.active) || D.plans[0];
    this.deployPlan = structuredClone(plan);
    const ev = D.evals[plan.id];
    this._deployEval = ev && !ev.error ? ev : null;
    this._deployErr = ev && ev.error ? ev.error : "";
  },

  dpType(id) {
    const D = this._deploy;
    const tpl = D.custom_types.find(c => c.id === id);
    const spec = D.types.find(t => t.id === (tpl ? tpl.base : id));
    return { spec, tpl };
  },

  /* What a bucket's form starts from: field default, then template. */
  dpDefaults(typeId) {
    const { spec, tpl } = this.dpType(typeId);
    const out = {};
    for (const f of spec.fields) out[f.key] = f.default;
    return Object.assign(out, tpl ? tpl.inputs : {});
  },

  dpAllocated(exceptId) {
    return this.deployPlan.buckets.reduce(
      (a, b) => a + (b.id === exceptId ? 0 : (b.amount || 0)), 0);
  },

  dpStore() {
    const D = this._deploy, P = this.deployPlan;
    return { plans: D.plans.map(p => p.id === P.id ? P : p),
             custom_types: D.custom_types, active: P.id };
  },

  /* Save + re-score. Debounced; a newer edit always wins. */
  dpSync(view, delay = 350) {
    clearTimeout(this._deployTimer);
    const status = view.querySelector("#dp-status");
    if (status) { status.className = "chip info"; status.textContent = "Saving…"; }
    view.querySelector("#dp-results")?.classList.add("busy");
    this._deployTimer = setTimeout(async () => {
      const seq = ++this._deploySeq;
      const res = await api.deploySave(this.dpStore());
      if (seq !== this._deploySeq) return;
      if (res.ok) {
        this._deploy = res.body;
        const ev = res.body.evals[this.deployPlan.id];
        this._deployEval = ev && !ev.error ? ev : null;
        this._deployErr = "";
      } else {
        this._deployErr = typeof res.body.detail === "string"
          ? res.body.detail : "Could not save.";
      }
      if (this.route !== "deploy") return;
      this.dpPaintStatus(view);
      this.dpPaintResults(view);
    }, delay);
  },

  /* ── Plan bar ──────────────────────────────────────────────────── */
  dpPaintBar(view) {
    const D = this._deploy, P = this.deployPlan;
    view.querySelector("#dp-bar").innerHTML = `
      <div class="card">
        <div class="builder-bar" style="margin-bottom:14px">
          <select id="dp-plan" style="width:auto;min-width:180px" title="Switch plan">
            ${D.plans.map(p => `<option value="${esc(p.id)}"
              ${p.id === P.id ? "selected" : ""}>${esc(p.id === P.id ? P.name : p.name)}</option>`).join("")}
          </select>
          <button id="dp-new" title="Start another plan">＋ New plan</button>
          ${D.plans.length > 1 ? `<button id="dp-del">Delete plan</button>` : ""}
          <div style="flex:1"></div>
          <span id="dp-alloc" class="chip"></span>
          <span id="dp-status" class="chip"></span>
        </div>
        <form id="dp-plan-form" class="form-grid" onsubmit="return false">
          <div><label>Plan name</label>
            <input name="name" type="text" maxlength="60" value="${esc(P.name)}"></div>
          <div><label>Amount to deploy ($)</label>
            <input name="amount" type="number" min="0" step="1000"
                   value="${P.amount || ""}" placeholder="e.g. 50000"></div>
          <div><label>Horizon (years)</label>
            <input name="horizon_yrs" type="number" min="0.5" max="50" step="0.5"
                   value="${P.horizon_yrs}">
            <div class="field-help">When you want to judge the result.</div></div>
          <div><label data-metric="deploy_vs_hurdle">Hurdle rate (%) <i class="idot">i</i></label>
            <input name="hurdle_rate" type="number" step="0.25"
                   value="${+(P.hurdle_rate * 100).toFixed(3)}">
            <div class="field-help">What the money earns doing the safe thing.</div></div>
          <div><label>Reinvest rate (%)</label>
            <input name="reinvest_rate" type="number" step="0.25"
                   value="${+(P.reinvest_rate * 100).toFixed(3)}">
            <div class="field-help">What cash earns after a deal finishes.</div></div>
        </form>
      </div>`;

    const form = view.querySelector("#dp-plan-form");
    form.addEventListener("input", () => {
      const f = new FormData(form);
      P.name = f.get("name");
      const amount = f.get("amount") === "" ? 0 : +f.get("amount");
      const horizon = +f.get("horizon_yrs");
      const hurdle = +f.get("hurdle_rate") / 100, reinvest = +f.get("reinvest_rate") / 100;
      if ([amount, horizon, hurdle, reinvest].some(v => isNaN(v)) || horizon <= 0
          || f.get("hurdle_rate") === "" || f.get("reinvest_rate") === "") return;
      Object.assign(P, { amount, horizon_yrs: horizon,
                         hurdle_rate: hurdle, reinvest_rate: reinvest });
      this.dpPaintStatus(view);
      this.dpSync(view);
    });
    view.querySelector("#dp-plan").addEventListener("change", (e) => {
      D.plans = D.plans.map(p => p.id === P.id ? P : p);
      D.active = e.target.value;
      this._deployDraft = null;
      this.deployPlan = structuredClone(D.plans.find(p => p.id === D.active));
      this._deployEval = D.evals[D.active] && !D.evals[D.active].error
        ? D.evals[D.active] : null;
      this.renderDeploy(view);
      this.dpSync(view, 0);
    });
    view.querySelector("#dp-new").addEventListener("click", () => {
      D.plans = D.plans.map(p => p.id === P.id ? P : p);
      const d = D.defaults;
      const plan = { id: dpId("p"), name: `Plan ${D.plans.length + 1}`, amount: P.amount,
                     horizon_yrs: d.horizon_yrs, hurdle_rate: d.hurdle_rate,
                     reinvest_rate: d.reinvest_rate, buckets: [] };
      D.plans.push(plan);
      D.active = plan.id;
      this._deployDraft = null;
      this.deployPlan = structuredClone(plan);
      this._deployEval = null;
      this.renderDeploy(view);
      this.dpSync(view, 0);
    });
    view.querySelector("#dp-del")?.addEventListener("click", () => {
      if (!confirm(`Delete the plan "${P.name}"? This cannot be undone.`)) return;
      D.plans = D.plans.filter(p => p.id !== P.id);
      D.active = D.plans[0].id;
      this._deployDraft = null;
      this.deployPlan = structuredClone(D.plans[0]);
      this._deployEval = null;
      this.renderDeploy(view);
      this.dpSync(view, 0);
    });
    this.dpPaintStatus(view);
  },

  dpPaintStatus(view) {
    const P = this.deployPlan;
    const alloc = this.dpAllocated(), left = P.amount - alloc;
    const a = view.querySelector("#dp-alloc"), s = view.querySelector("#dp-status");
    if (!a || !s) return;
    if (!P.amount) {
      a.className = "chip info"; a.textContent = "Enter the amount you are deploying";
    } else if (left < -0.5) {
      a.className = "chip bad"; a.textContent = `Over by ${fmt.usd(-left)}`;
    } else if (left > 0.5) {
      a.className = "chip info";
      a.textContent = `${fmt.usd(left)} left to assign (${fmt.pct(left / P.amount, 0)})`;
    } else {
      a.className = "chip good"; a.textContent = "Every dollar assigned";
    }
    if (this._deployErr) { s.className = "chip bad"; s.textContent = this._deployErr; }
    else { s.className = "chip good"; s.textContent = "Saved"; }
  },

  /* ── Bucket cards + results ────────────────────────────────────── */
  dpPaintResults(view) {
    const P = this.deployPlan, ev = this._deployEval, reg = this.registry;
    const scales = this._deploy.scales;
    const byId = Object.fromEntries((ev ? ev.buckets : []).map(b => [b.id, b]));
    const risk = (n) => scales.risk.find(r => r.id === n)?.label || n;
    const liq = (id) => scales.liquidity.find(l => l.id === id)?.label || id;
    const hurdleChip = (v) => v ? `<span class="chip ${verdictFor(reg, "deploy_vs_hurdle", v).cls}"
        data-metric="deploy_vs_hurdle" data-value="${v}">${
        { clears: "Beats hurdle", likely: "Likely beats hurdle", misses: "Below hurdle" }[v]}</span>` : "";

    const cards = P.buckets.map(b => {
      const { spec, tpl } = this.dpType(b.type);
      const e = byId[b.id], m = e && e.metrics;
      const share = P.amount ? b.amount / P.amount : 0;
      return `<div class="card slot-card">
        <div class="slot-head">
          <span class="slot-name"><span class="dp-icon">${esc(tpl ? tpl.icon : spec.icon)}</span>
            ${esc(b.label)}</span>
          <span class="slot-delta">${esc(tpl ? tpl.label : spec.label)}</span>
        </div>
        <div class="dp-amount"><b>${fmt.usd(b.amount)}</b>
          <span>${P.amount ? fmt.pct(share, 0) + " of the plan" : ""}</span></div>
        ${m ? `
          <div class="dp-range" data-metric="deploy_return_range">
            <span class="${m.ann_return.low < 0 ? "bad" : ""}">${fmt.pct(m.ann_return.low, 0)}</span>
            <b>${fmt.pct(m.ann_return.base, 1)}</b>
            <span>${fmt.pct(m.ann_return.high, 0)}</span>
            <i>low · base · high per year</i>
          </div>
          <div class="trend-chips">
            ${hurdleChip(m.vs_hurdle)}
            <span class="chip ${verdictFor(reg, "deploy_risk", m.risk).cls}"
              data-metric="deploy_risk" data-value="${m.risk}">${esc(risk(m.risk))} risk</span>
            <span class="chip ${verdictFor(reg, "deploy_liquidity", m.liquidity).cls}"
              data-metric="deploy_liquidity" data-value="${esc(m.liquidity)}">Cash back: ${esc(liq(m.liquidity))}</span>
            <span class="chip info">${esc(dpYears(m.timeline_yrs))}</span>
          </div>
          ${m.warnings.map(w => `<div class="slot-note warn">${esc(w)}</div>`).join("")}`
          : `<div class="slot-note">Calculating…</div>`}
        ${b.notes ? `<div class="slot-note">${esc(b.notes)}</div>` : ""}
        <div class="dp-actions">
          <button data-edit="${esc(b.id)}">Edit</button>
          <button data-dup="${esc(b.id)}">Duplicate</button>
          <button data-rm="${esc(b.id)}">Remove</button>
        </div>
      </div>`;
    }).join("");

    const wrap = view.querySelector("#dp-buckets");
    wrap.innerHTML = cards + `
      <button id="dp-add" class="dp-add">
        <span class="big">＋</span><b>Add a bucket</b>
        <span>${P.buckets.length ? "Stocks, a flip, a rental, a private deal, or your own category"
          : "Start with where some of this money could go"}</span>
      </button>`;
    wrap.querySelector("#dp-add").addEventListener("click", () => this.dpOpenPicker(view));
    wrap.querySelectorAll("[data-edit]").forEach(el =>
      el.addEventListener("click", () => this.dpOpenForm(view, el.dataset.edit)));
    wrap.querySelectorAll("[data-dup]").forEach(el =>
      el.addEventListener("click", () => {
        const src = P.buckets.find(b => b.id === el.dataset.dup);
        const copy = structuredClone(src);
        copy.id = dpId("b"); copy.label = (src.label + " (copy)").slice(0, 60);
        P.buckets.splice(P.buckets.indexOf(src) + 1, 0, copy);
        this.dpPaintStatus(view); this.dpPaintResults(view); this.dpSync(view, 0);
      }));
    wrap.querySelectorAll("[data-rm]").forEach(el =>
      el.addEventListener("click", () => {
        P.buckets = P.buckets.filter(b => b.id !== el.dataset.rm);
        if (this._deployDraft?.bucket.id === el.dataset.rm) {
          this._deployDraft = null; this.dpPaintEditor(view);
        }
        this.dpPaintStatus(view); this.dpPaintResults(view); this.dpSync(view, 0);
      }));

    const node = view.querySelector("#dp-results");
    node.classList.remove("busy");
    const s = ev && ev.summary;
    if (!s || !s.n_buckets) { node.innerHTML = ""; return; }

    const tiles = [
      ["deploy_end_value", "Projected value", fmt.usd(s.end_value.base), "",
       `${fmt.usd(s.end_value.low)} if all go badly · ${fmt.usd(s.end_value.high)} if all go well`, ""],
      ["deploy_vs_hurdle", "Plan return per year", fmt.pct(s.ann_return.base, 1),
       verdictFor(reg, "deploy_vs_hurdle", s.vs_hurdle).cls,
       `hurdle ${fmt.pct(s.hurdle_rate, 1)} would make ${fmt.usd(s.hurdle_value)}`, s.vs_hurdle],
      ["deploy_concentration", "Biggest bucket", fmt.pct(s.max_share, 0),
       verdictFor(reg, "deploy_concentration", s.max_share).cls, s.max_label, s.max_share],
      ["deploy_illiquid_share", "Hard to reach", fmt.pct(s.illiquid_share, 0),
       verdictFor(reg, "deploy_illiquid_share", s.illiquid_share).cls,
       "takes months or longer to get back", s.illiquid_share],
      ["deploy_effort", "Your time", s.effort_hrs_mo ? `≈ ${s.effort_hrs_mo} h/mo` : "Hands-off",
       s.effort_hrs_mo >= 40 ? "warn" : "", "across every bucket", ""],
    ];
    const rows = ev.ranking.map(id => byId[id]).filter(Boolean).map(b => {
      const m = b.metrics;
      return `<tr><td><b>${esc(b.label)}</b></td>
        <td>${fmt.usd(b.amount)}</td><td>${fmt.pct(b.share, 0)}</td>
        <td class="${m.ann_return.low < 0 ? "bad" : ""}">${fmt.pct(m.ann_return.low, 1)}</td>
        <td><b>${fmt.pct(m.ann_return.base, 1)}</b></td>
        <td>${fmt.pct(m.ann_return.high, 1)}</td>
        <td>${esc(dpYears(m.timeline_yrs))}</td>
        <td class="${verdictFor(reg, "deploy_risk", m.risk).cls}">${esc(risk(m.risk))}</td>
        <td>${esc(liq(m.liquidity))}</td>
        <td>${fmt.usd(m.end_value.base)}</td>
        <td>${hurdleChip(m.vs_hurdle)}</td></tr>`;
    }).join("");

    node.innerHTML = `
      <div class="section"><h2>The plan as a whole</h2>
        <span class="sub">${fmt.usd(s.allocated)} assigned · judged at ${dpYears(s.horizon_yrs)}</span></div>
      <div class="grid cols-5">${tiles.map(([key, label, value, cls, sub, dv]) => `
        <div class="card tile">
          <div class="t-label">${metricLabel(reg, key, label)}</div>
          <div class="t-value ${cls}" data-metric="${key}" data-value="${esc(dv)}">${value}</div>
          <div class="t-sub">${esc(sub)}</div>
        </div>`).join("")}</div>
      ${s.flags.length ? `<div class="card" style="margin-top:14px"><div class="assess-list">
        ${s.flags.map(f => `<div class="assess-item"><span class="b-dot ${f.cls}"></span>
          <span>${esc(f.text)}</span></div>`).join("")}</div></div>` : ""}

      <div class="grid cols-2 dp-charts" style="margin-top:14px">
        <div class="card"><h3>Risk vs return</h3>
          <div class="field-help">dot = base case · whisker = low to high · size = dollars</div>
          <div id="dp-bubble" class="chart"></div></div>
        <div class="card"><h3>When the money comes back</h3>
          <div class="field-help">faded bars are open-ended: you choose when to exit</div>
          <div id="dp-timeline" class="chart"></div></div>
      </div>

      <div class="section"><h2>Side by side</h2>
        <span class="sub">ranked by base return per year</span></div>
      <div class="card table-scroll"><table>
        <thead><tr><th>Bucket</th><th>Amount</th><th>Share</th><th>Low</th><th>Base</th>
          <th>High</th><th>Timeline</th><th>Risk</th><th>Cash back</th>
          <th>Value at ${dpYears(s.horizon_yrs)}</th><th>vs hurdle</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;

    const funded = ev.buckets.filter(b => b.amount > 0);
    Charts.deployBubble("dp-bubble", funded.map(b => ({
      name: b.label, risk: b.metrics.risk, amount: b.amount,
      low: b.metrics.ann_return.low, base: b.metrics.ann_return.base,
      high: b.metrics.ann_return.high,
      cls: verdictFor(reg, "deploy_vs_hurdle", b.metrics.vs_hurdle).cls,
    })), s.hurdle_rate, scales.risk.map(r => r.label));
    Charts.deployTimeline("dp-timeline", ev.timeline.map(t => ({
      name: t.label, end: t.end_yrs, open: t.open_ended, amount: t.amount,
    })), s.horizon_yrs);
    queueMicrotask(() => Tooltip.audit());
  },

  /* ── Editor: pick a type, then fill a short form ───────────────── */
  dpOpenPicker(view) {
    this._deployDraft = { step: "pick" };
    this.dpPaintEditor(view);
    view.querySelector("#dp-editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  dpOpenForm(view, bucketId, typeId) {
    const P = this.deployPlan;
    const existing = bucketId && P.buckets.find(b => b.id === bucketId);
    const type = existing ? existing.type : typeId;
    const { spec, tpl } = this.dpType(type);
    const left = Math.max(0, P.amount - this.dpAllocated(existing?.id));
    const bucket = existing ? structuredClone(existing)
      : { id: dpId("b"), type, label: tpl ? tpl.label : spec.label,
          amount: Math.round(left), inputs: {}, notes: "" };
    // The form edits a full set of values; only the ones that differ from the
    // defaults are stored, so a later change to a default still flows through.
    bucket.inputs = Object.assign(this.dpDefaults(type), bucket.inputs);
    this._deployDraft = { step: "form", bucket, isNew: !existing, unit: "usd",
                          tplOn: false, tplName: "", tplIcon: tpl ? tpl.icon : spec.icon };
    this._deployPreview = null;
    this.dpPaintEditor(view);
    this.dpPreview(view, 0);
    view.querySelector("#dp-editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  dpPaintEditor(view) {
    const node = view.querySelector("#dp-editor");
    const dr = this._deployDraft;
    if (!dr) { node.innerHTML = ""; return; }
    if (dr.step === "pick") return this.dpPaintPicker(view, node);
    this.dpPaintForm(view, node);
  },

  dpPaintPicker(view, node) {
    const D = this._deploy;
    const tile = (id, icon, label, blurb, removable) => `
      <div class="type-tile-wrap">
        <button class="type-tile" data-type="${esc(id)}">
          <span class="dp-icon big">${esc(icon)}</span><b>${esc(label)}</b>
          <span>${esc(blurb)}</span></button>
        ${removable ? `<button class="tile-x" data-rmtype="${esc(id)}"
          title="Remove this category">×</button>` : ""}
      </div>`;
    node.innerHTML = `
      <div class="card dp-editor">
        <div class="slot-head"><h2>What kind of bucket?</h2>
          <button id="dp-cancel">Cancel</button></div>
        ${D.custom_types.length ? `<h3 style="margin:12px 0 8px">Your categories</h3>
          <div class="grid auto">${D.custom_types.map(c => {
            const base = D.types.find(t => t.id === c.base);
            return tile(c.id, c.icon, c.label, c.blurb || `Based on ${base.label}`, true);
          }).join("")}</div>
          <h3 style="margin:16px 0 8px">Built in</h3>` : `<div style="height:12px"></div>`}
        <div class="grid auto">${D.types.map(t =>
          tile(t.id, t.icon, t.label, t.blurb, false)).join("")}</div>
        <div class="field-help" style="margin-top:12px">Not listed? Pick “Something else”,
          fill it in once, and tick “Save as one of my categories” to reuse it.</div>
      </div>`;
    node.querySelector("#dp-cancel").addEventListener("click", () => {
      this._deployDraft = null; this.dpPaintEditor(view);
    });
    node.querySelectorAll("[data-type]").forEach(b =>
      b.addEventListener("click", () => this.dpOpenForm(view, null, b.dataset.type)));
    node.querySelectorAll("[data-rmtype]").forEach(b =>
      b.addEventListener("click", () => this.dpRemoveTemplate(view, b.dataset.rmtype)));
  },

  dpRemoveTemplate(view, id) {
    const D = this._deploy;
    const tpl = D.custom_types.find(c => c.id === id);
    if (!tpl || !confirm(`Remove your category "${tpl.label}"? Buckets already using it keep their numbers.`)) return;
    // Buckets built on it fall back to the built-in type, numbers intact.
    D.plans = D.plans.map(p => p.id === this.deployPlan.id ? this.deployPlan : p);
    for (const p of D.plans) for (const b of p.buckets) {
      if (b.type === id) { b.type = tpl.base; b.inputs = { ...tpl.inputs, ...b.inputs }; }
    }
    D.custom_types = D.custom_types.filter(c => c.id !== id);
    this.deployPlan = structuredClone(D.plans.find(p => p.id === this.deployPlan.id));
    this.dpPaintEditor(view); this.dpPaintResults(view); this.dpSync(view, 0);
  },

  dpField(f, value) {
    const scales = this._deploy.scales;
    const opts = (list, cur) => list.map(o =>
      `<option value="${esc(o.id)}" ${String(o.id) === String(cur) ? "selected" : ""}>${
        esc(o.label)}</option>`).join("");
    let input;
    if (f.unit === "risk") input = `<select name="${f.key}">${opts(scales.risk, value)}</select>`;
    else if (f.unit === "liquidity") input = `<select name="${f.key}">${opts(scales.liquidity, value)}</select>`;
    else if (f.unit === "effort") input = `<select name="${f.key}">${opts(scales.effort, value)}</select>`;
    else {
      const k = f.unit === "pct" ? 100 : 1;
      const attr = (n, v) => v == null ? "" : `${n}="${+(v * k).toFixed(6)}"`;
      input = `<input name="${f.key}" type="number" data-unit="${f.unit}"
        ${attr("min", f.min)} ${attr("max", f.max)} ${attr("step", f.step)}
        value="${+(value * k).toFixed(6)}">`;
    }
    const label = f.unit === "pct" && !f.label.includes("%") ? f.label + " (%)" : f.label;
    return `<div><label>${esc(label)}</label>${input}
      ${f.help ? `<div class="field-help">${esc(f.help)}</div>` : ""}</div>`;
  },

  dpPaintForm(view, node) {
    const D = this._deploy, P = this.deployPlan, dr = this._deployDraft, b = dr.bucket;
    const { spec, tpl } = this.dpType(b.type);
    const core = spec.fields.filter(f => !f.advanced);
    const adv = spec.fields.filter(f => f.advanced);
    const hist = spec.id === "market" && D.market.historic_return != null
      ? `<div class="field-help" style="margin-top:8px">For reference: your current portfolio
          returned ${fmt.pct(D.market.historic_return, 1)} a year over the analysis window.
          That is the past, not a forecast, so the default here is your target return.</div>` : "";
    node.innerHTML = `
      <div class="card dp-editor">
        <div class="slot-head">
          <h2><span class="dp-icon">${esc(tpl ? tpl.icon : spec.icon)}</span>
            ${dr.isNew ? "New bucket" : "Edit bucket"} · ${esc(tpl ? tpl.label : spec.label)}</h2>
          ${dr.isNew ? `<button id="dp-back">← Change type</button>` : ""}
        </div>
        <div class="dp-form-grid">
          <!-- novalidate: the server range-checks and explains; the browser's
               own step check would silently block Save on a value like 13.45 -->
          <form id="dp-form" novalidate>
            <div class="form-grid">
              <div><label>Name</label>
                <input name="__label" type="text" maxlength="60" value="${esc(b.label)}"></div>
              <div><label>How much goes here</label>
                <div class="unit-row">
                  <input name="__amount" type="number" min="0" step="any"
                    value="${dr.unit === "pct" && P.amount ? +(b.amount / P.amount * 100).toFixed(2) : b.amount}">
                  <select name="__unit" ${P.amount ? "" : "disabled"}>
                    <option value="usd" ${dr.unit === "usd" ? "selected" : ""}>$</option>
                    <option value="pct" ${dr.unit === "pct" ? "selected" : ""}>% of plan</option>
                  </select>
                </div>
                <div class="dp-quick">
                  <button type="button" id="dp-rest">Use what is left</button>
                  <button type="button" id="dp-need" hidden></button>
                </div></div>
            </div>
            <div class="form-grid" style="margin-top:12px">
              ${core.map(f => this.dpField(f, b.inputs[f.key])).join("")}
            </div>
            ${hist}
            ${adv.length ? `<details class="dp-more" ${dr.moreOpen ? "open" : ""}>
              <summary>More assumptions (${adv.length})</summary>
              <div class="form-grid" style="margin-top:12px">
                ${adv.map(f => this.dpField(f, b.inputs[f.key])).join("")}
              </div></details>` : ""}
            <div style="margin-top:12px"><label>Notes (optional)</label>
              <input name="__notes" type="text" maxlength="500" value="${esc(b.notes || "")}"
                placeholder="Who, where, what you still need to check"></div>
            <div class="dp-tpl">
              <label class="check"><input type="checkbox" name="__tplOn" ${dr.tplOn ? "checked" : ""}>
                Save as one of my categories, so these numbers are one click away next time</label>
              <div id="dp-tpl-fields" ${dr.tplOn ? "" : "hidden"}>
                <div class="form-grid" style="margin-top:8px">
                  <div><label>Category name</label>
                    <input name="__tplName" type="text" maxlength="40" value="${esc(dr.tplName)}"
                      placeholder="e.g. Short-term rental"></div>
                  <div><label>Icon</label><div class="icon-row">
                    ${D.template_icons.map(i => `<button type="button" data-icon="${esc(i)}"
                      class="${dr.tplIcon === i ? "active" : ""}">${esc(i)}</button>`).join("")}
                  </div></div>
                </div>
              </div>
            </div>
            <div class="builder-bar" style="margin-top:16px">
              <button id="dp-save" class="primary">${dr.isNew ? "Add bucket" : "Save changes"}</button>
              <button type="button" id="dp-cancel">Cancel</button>
              <span id="dp-form-msg" class="t-sub bad"></span>
            </div>
          </form>
          <div id="dp-preview" class="dp-preview"></div>
        </div>
      </div>`;

    const form = node.querySelector("#dp-form");
    const amountEl = form.elements["__amount"];
    const setAmount = (usd) => {
      b.amount = Math.max(0, Math.round(usd * 100) / 100);
      amountEl.value = dr.unit === "pct" && P.amount
        ? +(b.amount / P.amount * 100).toFixed(2) : b.amount;
    };
    form.addEventListener("input", (e) => {
      const t = e.target, name = t.name;
      if (name === "__label") b.label = t.value;
      else if (name === "__notes") b.notes = t.value;
      else if (name === "__tplName") dr.tplName = t.value;
      else if (name === "__tplOn") {
        dr.tplOn = t.checked;
        if (dr.tplOn && !dr.tplName) {
          dr.tplName = b.label; form.elements["__tplName"].value = b.label;
        }
        node.querySelector("#dp-tpl-fields").hidden = !dr.tplOn;
      } else if (name === "__unit") { dr.unit = t.value; setAmount(b.amount); }
      else if (name === "__amount") {
        const v = t.value === "" ? 0 : +t.value;
        if (!isNaN(v)) b.amount = dr.unit === "pct" ? v / 100 * P.amount : v;
      } else {
        const f = spec.fields.find(x => x.key === name);
        if (!f) return;
        if (f.unit === "liquidity" || f.unit === "effort") b.inputs[name] = t.value;
        else if (t.value !== "" && !isNaN(+t.value))
          b.inputs[name] = f.unit === "pct" ? +t.value / 100 : +t.value;
        else return;
      }
      this.dpPreview(view);
    });
    node.querySelector(".dp-more")?.addEventListener("toggle", (e) => { dr.moreOpen = e.target.open; });
    node.querySelectorAll("[data-icon]").forEach(el => el.addEventListener("click", () => {
      dr.tplIcon = el.dataset.icon;
      node.querySelectorAll("[data-icon]").forEach(x =>
        x.classList.toggle("active", x === el));
    }));
    node.querySelector("#dp-rest").addEventListener("click", () => {
      setAmount(Math.max(0, P.amount - this.dpAllocated(b.id))); this.dpPreview(view);
    });
    node.querySelector("#dp-need").addEventListener("click", () => {
      const need = this._deployPreview?.buckets[0]?.metrics.cash_needed;
      if (need) { setAmount(need); this.dpPreview(view); }
    });
    node.querySelector("#dp-back")?.addEventListener("click", () => this.dpOpenPicker(view));
    node.querySelector("#dp-cancel").addEventListener("click", () => {
      this._deployDraft = null; this.dpPaintEditor(view);
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); this.dpSaveDraft(view); });
    this.dpPaintPreview(view);
  },

  /* Only what differs from the defaults is worth storing. */
  dpDiff(typeId, inputs) {
    const base = this.dpDefaults(typeId), out = {};
    for (const [k, v] of Object.entries(inputs)) if (base[k] !== v) out[k] = v;
    return out;
  },

  dpPreview(view, delay = 200) {
    const dr = this._deployDraft;
    if (!dr || dr.step !== "form") return;
    clearTimeout(this._deployPrevTimer);
    view.querySelector("#dp-preview")?.classList.add("busy");
    this._deployPrevTimer = setTimeout(async () => {
      const seq = ++this._deployPrevSeq;
      const b = dr.bucket;
      const res = await api.deployEvaluate({
        plan: { ...this.deployPlan, buckets: [{ ...b, inputs: this.dpDiff(b.type, b.inputs) }] },
        custom_types: this._deploy.custom_types,
      });
      if (seq !== this._deployPrevSeq || this._deployDraft !== dr) return;
      dr.error = res.ok ? "" : (typeof res.body.detail === "string" ? res.body.detail : "Check the numbers.");
      if (res.ok) this._deployPreview = res.body;
      this.dpPaintPreview(view);
    }, delay);
  },

  dpPaintPreview(view) {
    const node = view.querySelector("#dp-preview");
    const dr = this._deployDraft;
    if (!node || !dr) return;
    node.classList.remove("busy");
    const pv = this._deployPreview, m = pv && pv.buckets[0] && pv.buckets[0].metrics;
    const reg = this.registry, scales = this._deploy.scales;
    const needBtn = view.querySelector("#dp-need");
    if (needBtn) {
      const need = m && m.cash_needed;
      needBtn.hidden = !need;
      if (need) needBtn.textContent = `Use what this deal needs (${fmt.usd(need)})`;
    }
    if (dr.error) {
      node.innerHTML = `<h3>Live preview</h3><div class="callout" style="margin-top:10px">${esc(dr.error)}</div>`;
      return;
    }
    if (!m) { node.innerHTML = `<h3>Live preview</h3><div class="skeleton" style="min-height:120px;margin-top:10px"></div>`; return; }
    const val = (d) => d.unit === "usd"
        ? (d.value < 0 ? "−" + fmt.usd(-d.value) : fmt.usd(d.value))
      : d.unit === "pct" ? fmt.pct(d.value, 1)
      : d.unit === "x" ? fmt.num(d.value, 2) + "×"
      : d.unit === "yrs" ? dpYears(d.value) : fmt.num(d.value, 2);
    const hv = { clears: "Beats your hurdle even in the low case",
                 likely: "Beats your hurdle on the base case",
                 misses: "Below your hurdle" }[m.vs_hurdle];
    node.innerHTML = `
      <h3>Live preview</h3>
      <div class="dp-range big" data-metric="deploy_return_range">
        <span class="${m.ann_return.low < 0 ? "bad" : ""}">${fmt.pct(m.ann_return.low, 0)}</span>
        <b>${fmt.pct(m.ann_return.base, 1)}</b>
        <span>${fmt.pct(m.ann_return.high, 0)}</span>
        <i>low · base · high per year</i>
      </div>
      <div class="trend-chips">
        <span class="chip ${verdictFor(reg, "deploy_vs_hurdle", m.vs_hurdle).cls}"
          data-metric="deploy_vs_hurdle" data-value="${m.vs_hurdle}">${hv}</span>
        <span class="chip ${verdictFor(reg, "deploy_risk", m.risk).cls}" data-metric="deploy_risk"
          data-value="${m.risk}">${esc(scales.risk.find(r => r.id === m.risk).label)} risk</span>
        <span class="chip ${verdictFor(reg, "deploy_liquidity", m.liquidity).cls}"
          data-metric="deploy_liquidity" data-value="${esc(m.liquidity)}">Cash back: ${
          esc(scales.liquidity.find(l => l.id === m.liquidity).label)}</span>
        <span class="chip info">${esc(dpYears(m.timeline_yrs))}</span>
      </div>
      <table class="dp-detail">
        ${m.detail.map(d => `<tr><td>${esc(d.label)}</td><td>${val(d)}</td></tr>`).join("")}
        <tr><td>Worth at ${dpYears(pv.summary.horizon_yrs)}</td>
          <td><b>${fmt.usd(m.end_value.base)}</b></td></tr>
        <tr><td>…low to high</td>
          <td>${fmt.usd(m.end_value.low)} – ${fmt.usd(m.end_value.high)}</td></tr>
      </table>
      ${m.warnings.map(w => `<div class="slot-note warn" style="margin-top:6px">${esc(w)}</div>`).join("")}`;
  },

  dpSaveDraft(view) {
    const D = this._deploy, P = this.deployPlan, dr = this._deployDraft, b = dr.bucket;
    const msg = view.querySelector("#dp-form-msg");
    if (dr.error) { msg.textContent = "Fix the highlighted problem first."; return; }
    if (!b.label.trim()) { msg.textContent = "Give the bucket a name."; return; }
    if (dr.tplOn) {
      if (!dr.tplName.trim()) { msg.textContent = "Name your category."; return; }
      const { spec, tpl } = this.dpType(b.type);
      // A user category = a built-in type + a name, an icon and these numbers.
      const base = {};
      for (const f of spec.fields) base[f.key] = f.default;
      const inputs = {};
      for (const [k, v] of Object.entries(b.inputs)) if (base[k] !== v) inputs[k] = v;
      D.custom_types.push({ id: dpId("u_"), base: spec.id, label: dr.tplName.trim(),
                            icon: dr.tplIcon, blurb: tpl ? tpl.blurb : "", inputs });
    }
    const stored = { ...b, label: b.label.trim(), inputs: this.dpDiff(b.type, b.inputs) };
    const i = P.buckets.findIndex(x => x.id === b.id);
    if (i >= 0) P.buckets[i] = stored; else P.buckets.push(stored);
    this._deployDraft = null;
    this.dpPaintEditor(view);
    this.dpPaintStatus(view);
    this.dpPaintResults(view);
    this.dpSync(view, 0);
  },
});
