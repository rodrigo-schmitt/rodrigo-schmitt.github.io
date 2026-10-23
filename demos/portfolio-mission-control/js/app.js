/* Mission Control SPA — hash router + view renderers.
   All numbers come from /api/results (precomputed); tooltips from the
   embedded metrics registry. */

const tok = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const readPref = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writePref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

const TITLES = {
  briefing: "Briefing", trends: "Trends", risk: "Risk",
  models: "Models and signals", optimizer: "Optimizer", builder: "Portfolio builder",
  ledger: "Ledger", settings: "Settings", learn: "Learn",
  deploy: "Deploy planner", pricing: "Plans and pricing",
};

const App = {
  data: null,
  registry: {},
  route: "briefing",
  modelTab: "garch",
  horizon: "3y",
  _statusTimer: null,
  _wasComputing: false,

  async init() {
    this.applyTheme(readPref("theme"));
    const toggleTheme = () => {
      const cur = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      writePref("theme", cur);
      this.applyTheme(cur);
      this.render();
    };
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
    document.getElementById("theme-toggle-m").addEventListener("click", toggleTheme);
    const sheet = document.getElementById("more-sheet");
    document.getElementById("more-btn").addEventListener("click", () => sheet.showModal());
    document.getElementById("more-close").addEventListener("click", () => sheet.close());
    sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
    if (api.demo) this.showDemoBanner();
    addEventListener("hashchange", () => this.onRoute());
    await this.load();
    this.onRoute();
    this.pollStatus();
    if (!api.demo) setInterval(() => this.pollStatus(), 2500);
  },

  showDemoBanner() {
    const b = document.getElementById("demo-banner");
    b.hidden = false;
    b.innerHTML = `<span><b>Demo</b> · a sample $2,500 portfolio on frozen October 2026 data.
      Nothing you change here is saved.</span>
      <a class="btn" href="/pages/pricing.html#portfolio-mission-control">See plans</a>`;
  },

  applyTheme(t) {
    if (t === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
  },

  async load() {
    try {
      this.data = await api.results();
      if (this.data) {
        this.registry = this.data.registry || {};
        Tooltip.setRegistry(this.registry);
      }
    } catch (e) {
      console.error(e);
      this.data = null;
    }
  },

  onRoute() {
    const raw = location.hash.replace("#/", "") || "briefing";
    const [view, query] = raw.split("?");
    if (view === "pricing" && window.SMTM_STATIC_DEMO === true) {
      location.href = "/pages/pricing.html#portfolio-mission-control";
      return;
    }
    this.routeQuery = new URLSearchParams(query || "");
    this.route = TITLES[view] ? view : "briefing";
    document.getElementById("page-title").textContent = TITLES[this.route];
    document.title = `${TITLES[this.route]} · Show Me The Money`;
    const portfolioRoutes = ["risk", "trends", "models", "optimizer", "builder"];
    document.querySelectorAll("[data-view]").forEach(a => {
      const on = a.dataset.group === "portfolio"
        ? portfolioRoutes.includes(this.route) : a.dataset.view === this.route;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const sheet = document.getElementById("more-sheet");
    if (sheet.open) sheet.close();
    document.getElementById("more-btn").classList.toggle("active",
      ["settings", "learn", "pricing"].includes(this.route));
    document.getElementById("disclaimer").hidden =
      ["pricing", "settings", "learn", "deploy"].includes(this.route);
    this.render();
  },

  async pollStatus() {
    const st = await api.status().catch(() => null);
    if (!st) return;
    const pill = document.getElementById("compute-pill");
    const computing = st.computing || st.state === "running";
    pill.hidden = !computing;
    if (computing) {
      document.getElementById("compute-msg").textContent = st.message || "Computing…";
      document.getElementById("compute-pct").textContent = (st.pct || 0) + "%";
    }
    if (this._wasComputing && !computing) {     // a compute just finished
      this._trends = null;                      // trends.json was rewritten
      this._builder = null;                     // …and so was builder.json
      await this.load();
      this.render();
    }
    this._wasComputing = computing;

    const banner = document.getElementById("data-banner");
    if (this.data) {
      const meta = this.data._meta;
      banner.hidden = false;
      banner.className = "data-banner" + (st.stale && !computing ? " stale" : "");
      banner.textContent =
        `Data through ${fmt.date(meta.data_through)} · ${meta.trading_days} trading days` +
        (meta.fast ? " · fast mode (ARIMA/ML off)" : "") +
        (computing ? " · updating…" : (st.stale ? " · stale — refresh from Settings" : ""));
    }
  },

  render() {
    const view = document.getElementById("view");
    Tooltip.hide();
    // The deploy planner is plain arithmetic on the user's own inputs — it
    // must not wait for the first market-data compute.
    if (!this.data && !["deploy", "pricing"].includes(this.route)) {
      view.innerHTML = this.renderEmpty(); return;
    }
    const fn = {
      pricing: this.renderPricing,
      briefing: this.renderBriefing, trends: this.renderTrends,
      risk: this.renderRisk, models: this.renderModels,
      optimizer: this.renderOptimizer, builder: this.renderBuilder,
      ledger: this.renderLedger,
      settings: this.renderSettings, learn: this.renderLearn,
      deploy: this.renderDeploy,
    }[this.route].bind(this);
    fn(view);
    queueMicrotask(() => Tooltip.audit());
  },

  renderEmpty() {
    return `<div class="card empty">
      <div class="big">…</div>
      <h2>First launch: computing your portfolio analysis</h2>
      <p>GARCH, regime detection, Monte Carlo and friends are running in the
      background (~1–2 min). This page will populate automatically.</p>
    </div>`;
  },

  /* ═══ 1. BRIEFING ═══════════════════════════════════════ */
  renderBriefing(view) {
    const d = this.data, m = d.port_metrics, reg = this.registry;
    const pr = d.port_regime, dec = d.decision;
    const hurdle = d.investor.car_apr;
    const cls = (key, v) => verdictFor(reg, key, v).cls;

    const rows = dec.per_ticker;
    // Colour follows the holding (plan order), never its rank; past six, holdings share the neutral.
    const hue = (t) => { const i = rows.indexOf(t); return i < 6 ? `var(--series-${i + 1})` : "var(--control)"; };
    const join = (xs) => xs.length <= 1 ? xs.join("")
      : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
    const paused = rows.filter(t => t.dca_after < t.dca_before).map(t => t.ticker);
    const watched = rows.filter(t => t.severity !== "normal" && t.dca_after >= t.dca_before).map(t => t.ticker);
    const parts = [];
    if (dec.sgov_redirect_total > 0)
      parts.push(`${fmt.usd(dec.sgov_redirect_total)} goes to SGOV this month${paused.length ? ` while ${join(paused)} ${paused.length === 1 ? "is" : "are"} paused` : ""}`);
    if (watched.length)
      parts.push(`${join(watched)} ${watched.length === 1 ? "stays" : "stay"} on plan under caution`);
    const finding = parts.length ? parts.join("; ") + "."
      : `All ${rows.length} holdings continue as planned this month.`;

    const kpis = [
      { key: "ann_return", label: "Annualized return", v: m.ann_ret, text: fmt.spct(m.ann_ret),
        sub: `${fmt.spct(m.ann_ret - hurdle)} vs ${fmt.pct(hurdle)} car APR` },
      { key: "sharpe", label: "Sharpe ratio", v: m.sharpe, text: fmt.num(m.sharpe),
        sub: verdictFor(reg, "sharpe", m.sharpe).verdict },
      { key: "max_drawdown", label: "Max drawdown", v: m.mdd, text: fmt.pct(m.mdd),
        sub: verdictFor(reg, "max_drawdown", m.mdd).verdict },
    ].map(k => `<div class="kpi">
        <div class="t-label">${metricLabel(reg, k.key, k.label)}</div>
        <div class="t-value ${cls(k.key, k.v)}" data-metric="${k.key}" data-value="${k.v}">${k.text}</div>
        <div class="t-sub">${esc(k.sub)}</div></div>`).join("");

    // Signature: this month's money as one strip, one hue per holding; the SGOV redirect in amber.
    const planTotal = rows.reduce((s, t) => s + t.dca_before, 0);
    // dca_after excludes the redirect; the redirect is added to SGOV on top.
    const monthTotal = rows.reduce((s, t) => s + t.dca_after, 0) + dec.sgov_redirect_total;
    console.assert(Math.abs(monthTotal - planTotal) < 1, "moves must spend the planned amount");
    const sgov = rows.find(t => t.ticker === "SGOV");
    const strip = rows.filter(t => t.dca_after > 0).map(t =>
      `<span style="flex:${t.dca_after};background:${hue(t)}" title="${esc(t.ticker)} ${fmt.usd(t.dca_after)}"></span>`
      + (t.ticker === "SGOV" && dec.sgov_redirect_total > 0
        ? `<span class="redirect" style="flex:${dec.sgov_redirect_total}" title="SGOV redirect ${fmt.usd(dec.sgov_redirect_total)}"></span>` : "")
    ).join("");

    const order = [...rows].sort((a, b) =>
      (a.severity === "normal") - (b.severity === "normal") || b.dca_before - a.dca_before);
    const shown = this.showAllMoves ? order : order.slice(0, 6);
    const moveRows = shown.map(t => {
      const changed = t.dca_after !== t.dca_before;
      const v = verdictFor(reg, "severity", t.severity);
      const first = [...t.actions, ...t.notes, ...t.suggestions][0];
      const sig = `<span class="chip ${v.cls}" data-metric="severity"
            data-value="${t.severity}">${esc(t.severity)}</span>`;
      return `<tr>
        <td><span class="tk"><i class="sw" style="background:${hue(t)}" aria-hidden="true"></i>${esc(t.ticker)}</span><span class="ds">${esc(t.desc)}</span></td>
        <td class="plan-col">${fmt.usd(t.dca_before)}</td>
        <td class="this-col">${changed ? `<span class="struck">${fmt.usd(t.dca_before)}</span>` : ""}${fmt.usd(t.dca_after)}</td>
        <td class="sig-col">${sig}</td>
        <td class="note" ${first ? `data-metric="${esc(first.metric)}"` : ""}><span class="sig-m ${t.severity === "normal" ? "" : v.cls}">${esc(t.severity)} · </span>${first ? esc(first.text) : "—"}</td>
      </tr>`;
    }).join("");
    const more = order.length > 6 ? `<tr class="more-row"><td colspan="5">
      <button class="view-all" id="moves-all">${this.showAllMoves ? "Show fewer" : `View all ${order.length}`}</button></td></tr>` : "";

    const probs = pr ? pr.current_probs : null;
    const regimeKeys = probs ? ["Bull", "Neutral", "Bear"].filter(k => k in probs) : [];
    const regimeCard = pr ? `<div class="card">
        <div class="card-head"><h2>Regime</h2><span class="sub">hidden Markov model, 3 states</span></div>
        <div class="regime-word ${cls("regime", pr.current_regime)}" data-metric="regime"
             data-value="${esc(pr.current_regime)}">${esc(pr.current_regime)}</div>
        <div class="regime-bar">${regimeKeys.map(k => `<span class="rg-${k.toLowerCase()} ${k === pr.current_regime ? "now" : ""}"
             style="flex:${Math.max(probs[k], 0.02)}" title="${k} ${fmt.pct(probs[k], 0)}"></span>`).join("")}</div>
        <div class="regime-keys">${regimeKeys.map(k => `<span>${k} <b>${fmt.pct(probs[k], 0)}</b></span>`).join("")}</div>
      </div>` : "";

    view.innerHTML = `
      <p class="finding">${esc(finding)}</p>

      <div class="card kpi-strip">
        <div class="kpi lead">
          <div class="t-label">Portfolio value ${d._meta.assumed_at_target
            ? '<span class="chip info" data-metric="scenario_profile">plan target</span>' : ""}</div>
          <div class="t-value">${fmt.usd(d.total_investable)}</div>
          <div class="t-sub">${fmt.usd(planTotal)} a month on plan</div>
        </div>
        ${kpis}
      </div>

      <div class="brief-main">
        <div class="card moves">
          <div class="card-head"><h2>This month's moves</h2>
            <span class="sub">signal priority: regime, GARCH, ML, ARIMA, Fama-French</span></div>
          <div class="alloc-strip" aria-label="This month's money by holding">${strip}</div>
          <div class="alloc-legend">
            <span>This month <b>${fmt.usd(monthTotal)}</b> across ${rows.filter(t => t.dca_after > 0).length} holdings</span>
            ${dec.sgov_redirect_total > 0 && sgov ? `<span class="warn" data-metric="sgov_redirect">SGOV redirect <b>+${fmt.usd(dec.sgov_redirect_total)}</b></span>` : ""}
          </div>
          <div class="table-scroll"><table>
            <thead><tr><th>Holding</th><th class="plan-col">Plan $/mo</th><th>This month</th>
              <th>Signal</th><th class="note">Note</th></tr></thead>
            <tbody>${moveRows}${more}</tbody>
          </table></div>
        </div>
        <div class="brief-side">
          ${regimeCard}
          <div class="card">
            <div class="card-head"><h2>What risk buys you</h2>
              <div class="hz-tabs" role="tablist" aria-label="Horizon">
                ${["1m", "1y", "3y"].map(h => `<button data-hz="${h}" role="tab"
                   aria-selected="${this.horizon === h}"
                   class="${this.horizon === h ? "active" : ""}">${h.toUpperCase()}</button>`).join("")}
              </div></div>
            <div class="scn-list" id="scenarios"></div>
            <div class="t-sub" style="margin-top:8px">Seeded Monte Carlo, value after the horizon · 5–95% range</div>
          </div>
        </div>
      </div>

      <div class="section"><h2>Portfolio assessment</h2></div>
      <div class="card assess-list">${d.assessment.map(a => `
        <div class="assess-item"><span class="b-dot ${a.cls}"></span>
          <span data-metric="${esc(a.metric)}">${esc(a.text)}</span></div>`).join("")}</div>

      <div class="section"><h2>Satellite spotlight</h2>
        <span class="sub">conviction bets and diversifiers: defense, space, managed futures, gold</span></div>
      <div class="grid auto" id="spotlight"></div>
    `;

    view.querySelectorAll("[data-hz]").forEach(b =>
      b.addEventListener("click", () => { this.horizon = b.dataset.hz; this.renderBriefing(view); }));
    const all = view.querySelector("#moves-all");
    if (all) all.addEventListener("click", () => { this.showAllMoves = !this.showAllMoves; this.renderBriefing(view); });

    this.renderScenarios(view.querySelector("#scenarios"));
    this.renderSpotlight(view.querySelector("#spotlight"));
  },

  renderScenarios(node) {
    const d = this.data, s = d.scenarios, hz = this.horizon, reg = this.registry;
    node.innerHTML = ["conservative", "current", "aggressive"].map(p => {
      const cell = s.cells[`${p}:${hz}`];
      const prof = s.profiles[p];
      const trades = (prof.trades || []).map(t => `
        <div class="trade"><span>${esc(t.ticker)}</span>
          <span>${t.dollars >= 0 ? "buy" : "sell"} ${fmt.usd(Math.abs(t.dollars))}
            (${fmt.spct(t.delta_w, 1)})</span></div>`).join("");
      const ploss = verdictFor(reg, "p_loss", cell.p_loss).cls;
      return `<div class="scn-row ${p === "current" ? "current" : ""}">
        <div class="nm" data-metric="scenario_profile" data-value="${p}">
          ${p === "current" ? "Current plan" : p[0].toUpperCase() + p.slice(1)} <i class="idot">i</i></div>
        <div class="ev" data-metric="expected_value" data-value="${cell.expected_value}">${fmt.usd(cell.expected_value)}</div>
        <div class="rg">5–95%: ${fmt.usd(cell.p5)} … ${fmt.usd(cell.p95)} ·
          <span class="${ploss === "good" ? "" : ploss}" data-metric="p_loss" data-value="${cell.p_loss}">P(loss) ${fmt.pct(cell.p_loss, 0)}</span> ·
          <span data-metric="p_beat_hurdle" data-value="${cell.p_beat_hurdle}">P(beat APR) ${fmt.pct(cell.p_beat_hurdle, 0)}</span></div>
        ${p !== "current" && trades ? `<details class="rg"><summary>Trades to get here</summary>${trades}</details>` : ""}
      </div>`;
    }).join("");
  },

  renderSpotlight(node) {
    const reg = this.registry;
    node.innerHTML = this.data.spotlight.map(s => {
      const ffv = s.ff_signal ? verdictFor(reg, "ff_signal", s.ff_signal) : null;
      const rgv = s.regime ? verdictFor(reg, "regime", s.regime) : null;
      const ddv = verdictFor(reg, "current_drawdown", s.current_dd);
      return `<div class="card tile hoverable">
        <div class="t-label">${esc(s.ticker)} · ${fmt.pct(s.weight, 0)}
          <span style="margin-left:auto">${rgv ? `<span class="chip ${rgv.cls}"
            data-metric="regime" data-value="${esc(s.regime)}">${esc(s.regime)}</span>` : ""}</span>
        </div>
        <div class="t-value ${s.ann_ret >= 0 ? "" : "bad"}"
             data-metric="ann_return" data-value="${s.ann_ret}">${fmt.pct(s.ann_ret)}</div>
        <div class="t-sub">${esc(s.desc)}</div>
        <div class="p-stats" style="margin-top:8px">
          ${ffv ? `<span class="chip ${ffv.cls}" data-metric="ff_signal"
             data-value="${esc(s.ff_signal)}">α ${s.ff_alpha != null ? fmt.spct(s.ff_alpha) : esc(s.ff_signal)}</span>` : ""}
          <span class="chip ${ddv.cls}" data-metric="current_drawdown"
             data-value="${s.current_dd}">DD ${fmt.pct(s.current_dd)}</span>
          <span class="chip ${verdictFor(reg, "sharpe", s.sharpe).cls}"
             data-metric="sharpe" data-value="${s.sharpe}">SR ${fmt.num(s.sharpe)}</span>
        </div>
      </div>`;
    }).join("");
  },

  /* ═══ 1b. TRENDS ════════════════════════════════════════════════ */
  trendRange: "1y",
  _trends: null,

  async renderTrends(view) {
    if (!this._trends) {
      view.innerHTML = `<div class="skeleton"></div>`;
      try {
        this._trends = await api.trends();
      } catch (e) {
        view.innerHTML = `<div class="card empty"><div class="big">↗</div>
          <h2>Trends not computed yet</h2>
          <p>Run a recompute from Settings — trend series are generated with
          the analysis.</p></div>`;
        return;
      }
    }
    const tr = this._trends, reg = this.registry;
    const N = tr.dates.length;

    // Resolve the visible range → start index
    const lastDate = new Date(tr.dates[N - 1] + "T00:00:00");
    const back = (months) => {
      const d = new Date(lastDate);
      d.setMonth(d.getMonth() - months);
      return d.toISOString().slice(0, 10);
    };
    const startDate = { "1m": back(1), "3m": back(3), "6m": back(6),
                        "1y": tr.window.default_start,
                        "all": tr.window.data_start }[this.trendRange];
    let i0 = tr.dates.findIndex(d => d >= startDate);
    if (i0 < 0) i0 = 0;
    const dates = tr.dates.slice(i0);
    const sl = (arr) => arr.slice(i0);
    const firstValid = (arr) => arr.find(v => v != null);

    const RANGES = [["1m", "1M"], ["3m", "3M"], ["6m", "6M"],
                    ["1y", "1Y"], ["all", "All"]];
    const tickers = Object.keys(tr.tickers);

    const cards = tickers.map(t => {
      const d = tr.tickers[t];
      const close = sl(d.close);
      const perRet = close[close.length - 1] / firstValid(close) - 1;
      const ins = d.insights;
      const chip = (key, val, text) => {
        const vd = verdictFor(reg, key, val);
        return `<span class="chip ${vd.cls}" data-metric="${key}"
                 data-value="${esc(String(val))}">${text}</span>`;
      };
      return `<div class="card trend-card">
        <div class="th"><span class="tk">${esc(t)}</span>
          <span class="ds">${esc(d.desc)}</span>
          <span class="${perRet >= 0 ? "good" : "bad"}" style="font-weight:650"
                data-metric="period_return" data-value="${perRet}">
            ${fmt.spct(perRet)}</span></div>
        <div id="trend-price-${t}" class="price-chart"></div>
        <div class="spark-row">
          <div><div class="spark-label" data-metric="rolling_vol">60d vol <i class="idot">i</i></div>
            <div id="trend-vol-${t}" class="spark"></div></div>
          <div><div class="spark-label" data-metric="rolling_sharpe">60d sharpe <i class="idot">i</i></div>
            <div id="trend-shp-${t}" class="spark"></div></div>
        </div>
        <div class="trend-chips">
          ${chip("sma_state", ins.sma_state,
                 { golden_cross: "golden cross", death_cross: "death cross",
                   above: "20>50 ↑", below: "20<50 ↓" }[ins.sma_state] || ins.sma_state)}
          ${chip("pct_from_52w_high", ins.pct_from_52w_high,
                 fmt.pct(ins.pct_from_52w_high, 0) + " vs 52w high")}
          ${chip("current_drawdown", ins.current_dd, "DD " + fmt.pct(ins.current_dd, 0))}
          ${ins.garch_signal ? chip("garch_signal", ins.garch_signal, "GARCH " + ins.garch_signal) : ""}
          ${ins.regime ? chip("regime", ins.regime, ins.regime) : ""}
        </div>
      </div>`;
    }).join("");

    view.innerHTML = `
      <div class="section" style="margin-top:0"><h2>Relative performance</h2>
        <span class="sub">${metricLabel(reg, "rebased_perf",
          "everything = 100 at window start")}</span>
        <div style="flex:1"></div>
        <div class="hz-tabs">${RANGES.map(([k, label]) =>
          `<button data-range="${k}" class="${this.trendRange === k ? "active" : ""}">
           ${label}</button>`).join("")}</div>
      </div>
      <div class="card"><div id="trend-rebased" class="chart chart-tall"></div></div>

      <div class="section"><h2>Per-ticker trends</h2>
        <span class="sub">price + SMA20/50 · ${esc(dates[0])} → ${esc(dates[dates.length - 1])}
        · hover any chip for its meaning</span></div>
      <div class="trend-grid">${cards}</div>
    `;

    view.querySelectorAll("[data-range]").forEach(b =>
      b.addEventListener("click", () => {
        this.trendRange = b.dataset.range;
        this.renderTrends(view);
      }));

    // Rebased comparison (client-side rebase at visible range start)
    const rebasedMap = {};
    for (const t of tickers) {
      const c = sl(tr.tickers[t].close);
      const base = firstValid(c);
      rebasedMap[t] = c.map(v => v == null ? null : 100 * v / base);
    }
    const pw = sl(tr.portfolio_wealth);
    const pBase = firstValid(pw);
    Charts.rebasedLines("trend-rebased", dates, rebasedMap,
                        pw.map(v => 100 * v / pBase));

    for (const t of tickers) {
      const d = tr.tickers[t];
      Charts.priceSMA(`trend-price-${t}`, dates, sl(d.close), sl(d.sma20), sl(d.sma50));
      Charts.sparkline(`trend-vol-${t}`, dates, sl(d.roll_vol),
                       { color: tok("--warn"), format: ".0%" });
      Charts.sparkline(`trend-shp-${t}`, dates, sl(d.roll_sharpe),
                       { color: tok("--accent"), format: ".2f", zero: true });
    }
  },

  /* ═══ 1c. LEARN ═════════════════════════════════════════════════ */
  learnTab: "models",
  _learn: null,

  async renderLearn(view) {
    if (!this._learn) {
      view.innerHTML = `<div class="skeleton"></div>`;
      try {
        this._learn = await (await fetch("learn-content.json")).json();
      } catch (e) {
        view.innerHTML = `<div class="card empty">Learn content unavailable.</div>`;
        return;
      }
    }
    const L = this._learn;
    const topic = this.routeQuery?.get("topic");
    if (topic) {
      const m = L.models.find(x => x.topic === topic || x.id === topic);
      if (m) this.learnTab = "models";
    }

    const TABS = [["models", "Models & Math"], ["glossary", "Glossary"],
                  ["accounts", "Accounts & Tax"], ["customize", "Customize"]];
    view.innerHTML = `
      <div class="subtabs">${TABS.map(([k, label]) =>
        `<button data-ltab="${k}" class="${this.learnTab === k ? "active" : ""}">${label}</button>`).join("")}
      </div>
      <div id="learn-body"></div>`;
    view.querySelectorAll("[data-ltab]").forEach(b =>
      b.addEventListener("click", () => { this.learnTab = b.dataset.ltab; this.renderLearn(view); }));

    const body = view.querySelector("#learn-body");
    ({ models: () => this.learnModels(body, L, topic),
       glossary: () => this.learnGlossary(body, L),
       accounts: () => this.learnAccounts(body, L),
       customize: () => this.learnCustomize(body, L) })[this.learnTab]();
  },

  _typeset(node) {
    node.querySelectorAll(".eq[data-latex]").forEach(el => {
      try {
        katex.render(el.dataset.latex, el, { displayMode: true, throwOnError: false });
      } catch (e) { el.textContent = el.dataset.latex; }
    });
  },

  learnModels(body, L, topic) {
    const ov = L.overview;
    const pipeline = ov.pipeline.map(p => `
      <div class="pipe-step"><b>${esc(p.step)}</b><span>${esc(p.does)}</span></div>`).join(
      `<div class="pipe-arrow">→</div>`);
    const cadence = ov.cadence.map(c => `
      <div class="assess-item"><span class="b-dot info"></span>
        <span><b>${esc(c.when)}</b> — ${esc(c.what)}</span></div>`).join("");

    const cards = L.models.map(m => `
      <div class="card learn-model" id="learn-${esc(m.id)}">
        <div class="lm-head"><h2>${esc(m.name)}</h2>
          ${m.acronym !== "—" ? `<span class="chip info">${esc(m.acronym)}</span>` : ""}</div>
        <p class="lm-tldr">${esc(m.tldr)}</p>
        ${(m.equations || []).map(eq => `
          <div class="eq-block"><div class="eq" data-latex="${esc(eq.latex)}"></div>
          <div class="eq-caption">${esc(eq.caption)}</div></div>`).join("")}
        ${m.analogy ? `<div class="analogy"><em>${esc(m.analogy)}</em></div>` : ""}
        <div class="lm-how"><b>In this app:</b> ${esc(m.how)}</div>
      </div>`).join("");

    body.innerHTML = `
      <div class="card">
        <h2>What this app does</h2>
        <p class="lm-tldr">${esc(ov.what)}</p>
        <div class="pipeline">${pipeline}</div>
        <div class="section" style="margin:16px 0 8px"><h3>When to run what</h3></div>
        <div class="assess-list">${cadence}</div>
      </div>
      <div class="learn-grid">${cards}</div>`;
    this._typeset(body);

    if (topic) {
      const m = L.models.find(x => x.topic === topic || x.id === topic);
      const node = m && body.querySelector(`#learn-${m.id}`);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        node.classList.add("flash");
        setTimeout(() => node.classList.remove("flash"), 2400);
      }
    }
  },

  learnGlossary(body, L) {
    const rows = L.glossary.map(g => `
      <tr><td><b>${esc(g.term)}</b></td>
        <td style="white-space:normal;text-align:left">${esc(g.def)}
          ${g.model ? ` <a href="#/learn?topic=${esc(g.model)}"
            onclick="App.learnTab='models'">→ model</a>` : ""}</td></tr>`).join("");
    body.innerHTML = `<div class="card table-scroll">
      <table><thead><tr><th style="text-align:left">Acronym</th>
      <th style="text-align:left">Meaning</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },

  learnAccounts(body, L) {
    const A = L.accounts;
    const fit = A.holdings_fit.map(h => `
      <tr><td><b>${esc(h.ticker)}</b></td>
        <td><span class="chip ${h.fit.startsWith("Shelter") ? "warn" : "good"}">${esc(h.fit)}</span></td>
        <td style="white-space:normal;text-align:left">${esc(h.note)}</td></tr>`).join("");
    const rows = A.wrappers.map(w => `
      <tr><td style="white-space:normal"><b>${esc(w.wrapper)}</b><br>
          <span class="t-sub">${esc(w.type)}</span></td>
        <td style="white-space:normal;text-align:left">${esc(w.when)}</td>
        <td style="white-space:normal;text-align:left">${esc(w.liquidity)}</td>
        <td style="white-space:normal;text-align:left">${esc(w.taxes)}</td>
        <td>${esc(w.horizon)}</td></tr>`).join("");
    body.innerHTML = `
      <div class="callout" style="margin-bottom:14px">${esc(A.disclaimer)}</div>
      <div class="section" style="margin-top:0"><h2>Your holdings — where they fit best</h2></div>
      <div class="card table-scroll"><table>
        <thead><tr><th style="text-align:left">Ticker</th><th style="text-align:left">Fit</th>
        <th style="text-align:left">Why</th></tr></thead><tbody>${fit}</tbody></table></div>
      <div class="section"><h2>The full map (from your Mastersheet)</h2></div>
      <div class="card table-scroll"><table>
        <thead><tr><th style="text-align:left">Vehicle</th><th style="text-align:left">When</th>
        <th style="text-align:left">Liquidity</th><th style="text-align:left">Taxes</th>
        <th>Horizon</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  },

  learnCustomize(body, L) {
    body.innerHTML = `<div class="learn-grid">` + L.customize.map(c => `
      <div class="card"><h2>${esc(c.title)}</h2>
        <p class="lm-tldr" style="white-space:pre-line">${esc(c.body)}</p></div>`).join("") + `</div>`;
  },

  /* ═══ 2. RISK ═══════════════════════════════════════════════════ */
  renderRisk(view) {
    const d = this.data, m = d.port_metrics, reg = this.registry;
    const tiles = [
      ["ann_return", "Ann. Return", m.ann_ret, fmt.pct(m.ann_ret)],
      ["ann_vol", "Ann. Volatility", m.ann_vol, fmt.pct(m.ann_vol)],
      ["sharpe", "Sharpe", m.sharpe, fmt.num(m.sharpe)],
      ["sortino", "Sortino", m.sortino, fmt.num(m.sortino)],
      ["max_drawdown", "Max Drawdown", m.mdd, fmt.pct(m.mdd)],
      ["var_hist", "Historic VaR 5%", m.var, fmt.pct(m.var)],
      ["cf_var", "CF VaR 5%", m.cfvar, fmt.pct(m.cfvar)],
      ["cvar", "CVaR 5%", m.cvar, fmt.pct(m.cvar)],
    ].map(([key, label, v, text]) => {
      const vd = verdictFor(reg, key, v);
      return `<div class="card tile hoverable">
        <div class="t-label">${metricLabel(reg, key, label)}</div>
        <div class="t-value ${vd.cls}" data-metric="${key}" data-value="${v}">${text}</div>
        <div class="t-sub">${esc(vd.verdict)}</div></div>`;
    }).join("");

    const [pa, pb, pc] = m.max_corr_pair;
    const corrVd = verdictFor(reg, "max_pairwise_corr", pc);
    const divTiles = [
      ["diversification_ratio", "Diversification Ratio", m.div_ratio, fmt.num(m.div_ratio)],
      ["enb", "Effective # of Bets", m.enb, fmt.num(m.enb, 1)],
      ["avg_corr", "Avg Pairwise Corr", m.avg_corr, fmt.num(m.avg_corr)],
    ].map(([key, label, v, text]) => {
      const vd = verdictFor(reg, key, v);
      return `<div class="card tile hoverable">
        <div class="t-label">${metricLabel(reg, key, label)}</div>
        <div class="t-value ${vd.cls}" data-metric="${key}" data-value="${v}">${text}</div>
        <div class="t-sub">${esc(vd.verdict)}</div></div>`;
    }).join("");

    const rows = d.stats.map(r => {
      const cells = [
        ["ann_return", r["Ann. Return"], fmt.pct(r["Ann. Return"])],
        ["ann_vol", r["Ann. Vol"], fmt.pct(r["Ann. Vol"])],
        ["sharpe", r["Sharpe"], fmt.num(r["Sharpe"])],
        ["max_drawdown", r["Max DD"], fmt.pct(r["Max DD"])],
        ["skewness", r["Skewness"], fmt.num(r["Skewness"])],
        ["kurtosis", r["Kurtosis"], fmt.num(r["Kurtosis"], 1)],
        ["cf_var", r["CF VaR (5%)"], fmt.pct(r["CF VaR (5%)"])],
        ["cvar", r["CVaR (5%)"], fmt.pct(r["CVaR (5%)"])],
      ].map(([k, v, t]) =>
        `<td class="${verdictFor(reg, k, v).cls}" data-metric="${k}" data-value="${v}">${t}</td>`);
      return `<tr><td><b>${esc(r.ticker)}</b></td>${cells.join("")}</tr>`;
    }).join("");

    view.innerHTML = `
      <div class="grid cols-4">${tiles}</div>

      <div class="section"><h2>Correlation & diversification</h2></div>
      <div class="grid cols-2">
        <div class="card">
          <h3 data-metric="max_pairwise_corr">Pairwise correlation <i class="idot">i</i></h3>
          <div id="corr-chart" class="chart"></div>
          <div class="assess-item" style="margin-top:8px">
            <span class="b-dot ${corrVd.cls}"></span>
            <span data-metric="max_pairwise_corr" data-value="${pc}">
              Most correlated: <b>${esc(pa)} × ${esc(pb)} = ${fmt.num(pc)}</b> — ${esc(corrVd.verdict)}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">${divTiles}</div>
      </div>

      <div class="section"><h2>Portfolio drawdown</h2>
        <span class="sub">${metricLabel(reg, "max_drawdown", "peak-to-trough")}</span></div>
      <div class="card"><div id="dd-chart" class="chart"></div></div>

      <div class="section"><h2>Per-asset risk metrics</h2>
        <span class="sub">daily data, annualized · hover any number for its meaning</span></div>
      <div class="card table-scroll"><table>
        <thead><tr><th>Ticker</th>
          <th>${metricLabel(reg, "ann_return", "Return")}</th>
          <th>${metricLabel(reg, "ann_vol", "Vol")}</th>
          <th>${metricLabel(reg, "sharpe", "Sharpe")}</th>
          <th>${metricLabel(reg, "max_drawdown", "Max DD")}</th>
          <th>${metricLabel(reg, "skewness", "Skew")}</th>
          <th>${metricLabel(reg, "kurtosis", "Kurt")}</th>
          <th>${metricLabel(reg, "cf_var", "CF VaR")}</th>
          <th>${metricLabel(reg, "cvar", "CVaR")}</th>
        </tr></thead><tbody>${rows}</tbody></table></div>
    `;
    Charts.heatmap("corr-chart", d.correlation.tickers, d.correlation.matrix);
    Charts.drawdown("dd-chart", d.drawdown_series, d.params.max_drawdown);
  },

  /* ═══ 3. MODELS ═════════════════════════════════════════════════ */
  renderModels(view) {
    const tabs = ["garch", "egarch", "regime", "arima", "ml", "montecarlo", "famafrench"];
    const labels = { garch: "GARCH", egarch: "EGARCH", regime: "Regime",
                     arima: "ARIMA", ml: "ML", montecarlo: "Monte Carlo",
                     famafrench: "Fama-French" };
    view.innerHTML = `
      <div class="subtabs">${tabs.map(t =>
        `<button data-tab="${t}" class="${this.modelTab === t ? "active" : ""}">${labels[t]}</button>`).join("")}
      </div>
      <div id="model-body"></div>`;
    view.querySelectorAll("[data-tab]").forEach(b =>
      b.addEventListener("click", () => { this.modelTab = b.dataset.tab; this.renderModels(view); }));
    this["model_" + this.modelTab](view.querySelector("#model-body"));
  },

  _notComputed(what) {
    return `<div class="card empty"><div class="big">—</div>
      <h2>${what} not computed</h2>
      <p>Fast mode skips it. Run a <b>full recompute</b> from Settings
      (takes several minutes).</p></div>`;
  },

  model_garch(node) {
    const d = this.data, reg = this.registry;
    const rows = d.garch.map(r => `
      <tr><td><b>${esc(r.ticker)}</b></td>
        <td>${fmt.pct(r.hist_vol_ann)}</td>
        <td>${fmt.pct(r.garch_fwd_vol_ann)}</td>
        <td class="${verdictFor(reg, "garch_vol_ratio", r.vol_ratio).cls}"
            data-metric="garch_vol_ratio" data-value="${r.vol_ratio}">${fmt.num(r.vol_ratio)}×</td>
        <td><span class="chip ${verdictFor(reg, "garch_signal", r.signal).cls}"
            data-metric="garch_signal" data-value="${esc(r.signal)}">${esc(r.signal)}</span></td>
      </tr>`).join("");
    node.innerHTML = `
      <div class="card table-scroll"><table>
        <thead><tr><th>Ticker</th><th>Hist vol</th><th>Forecast vol</th>
        <th>${metricLabel(reg, "garch_vol_ratio", "Ratio")}</th>
        <th>${metricLabel(reg, "garch_signal", "Signal")}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="card" style="margin-top:14px">
        <h3 data-metric="garch_vol_ratio">Forecast / historic volatility <i class="idot">i</i></h3>
        <div id="garch-chart" class="chart"></div></div>`;
    Charts.bars("garch-chart",
      d.garch.map(r => r.ticker), d.garch.map(r => r.vol_ratio),
      { colors: d.garch.map(r => r.signal === "REDUCE" ? tok("--bad") : tok("--good")),
        hline: 2.0, hlineText: "REDUCE (2.0×)" });
  },

  model_egarch(node) {
    const d = this.data, reg = this.registry;
    if (!d.egarch?.length) { node.innerHTML = this._notComputed("EGARCH"); return; }
    const rows = d.egarch.map(r => `
      <tr><td><b>${esc(r.ticker)}</b></td>
        <td>${fmt.pct(r.egarch_fwd_vol_ann)}</td>
        <td class="${verdictFor(reg, "egarch_alpha", r.leverage_alpha).cls}"
            data-metric="egarch_alpha" data-value="${r.leverage_alpha}">${fmt.num(r.leverage_alpha, 3)}</td>
        <td>${r.asymmetric === "YES" ? "asymmetric" : "—"}</td></tr>`).join("");
    node.innerHTML = `
      <div class="card table-scroll"><table>
        <thead><tr><th>Ticker</th><th>Forecast vol (ann.)</th>
        <th>${metricLabel(reg, "egarch_alpha", "Leverage α")}</th>
        <th>Bad-news amplifier</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="card" style="margin-top:14px">
        <h3 data-metric="egarch_alpha">Leverage α by ticker <i class="idot">i</i></h3>
        <div id="egarch-chart" class="chart"></div></div>`;
    Charts.bars("egarch-chart", d.egarch.map(r => r.ticker),
      d.egarch.map(r => r.leverage_alpha),
      { colors: d.egarch.map(r => r.leverage_alpha < 0 ? tok("--bad") : tok("--text-3")),
        format: ".3f" });
  },

  model_regime(node) {
    const d = this.data, reg = this.registry;
    if (!d.regime?.length) { node.innerHTML = this._notComputed("Regime detection"); return; }
    const pr = d.port_regime;
    const rows = d.regime.map(r => `
      <tr><td><b>${esc(r.ticker)}</b></td>
        <td><span class="chip ${verdictFor(reg, "regime", r.regime).cls}"
            data-metric="regime" data-value="${esc(r.regime)}">${esc(r.regime)}</span></td>
        <td>${fmt.pct(r["P(Bull)"], 0)}</td><td>${fmt.pct(r["P(Neutral)"], 0)}</td>
        <td class="${verdictFor(reg, "p_bear", r["P(Bear)"]).cls}"
            data-metric="p_bear" data-value="${r["P(Bear)"]}">${fmt.pct(r["P(Bear)"], 0)}</td>
      </tr>`).join("");
    node.innerHTML = `
      ${pr ? `<div class="card" style="margin-bottom:14px">
        <div class="regime-badge ${verdictFor(reg, "regime", pr.current_regime).cls}"
             data-metric="regime" data-value="${esc(pr.current_regime)}">
          <span class="dot"></span> Portfolio regime: ${esc(pr.current_regime)}
          <span class="t-sub">· Bull ${fmt.pct(pr.current_probs.Bull, 0)}
          · Neutral ${fmt.pct(pr.current_probs.Neutral, 0)}
          · Bear ${fmt.pct(pr.current_probs.Bear, 0)}</span></div></div>` : ""}
      <div class="card table-scroll"><table>
        <thead><tr><th>Ticker</th><th>${metricLabel(reg, "regime", "Regime")}</th>
        <th>P(Bull)</th><th>P(Neutral)</th>
        <th>${metricLabel(reg, "p_bear", "P(Bear)")}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="card" style="margin-top:14px">
        <h3 data-metric="regime">Regime probabilities <i class="idot">i</i></h3>
        <div id="regime-chart" class="chart"></div></div>`;
    Charts.stackedRegime("regime-chart",
      d.regime.map(r => r.ticker), d.regime.map(r => r["P(Bull)"]),
      d.regime.map(r => r["P(Neutral)"]), d.regime.map(r => r["P(Bear)"]));
  },

  model_arima(node) {
    const d = this.data, reg = this.registry;
    if (!d.arima?.length) { node.innerHTML = this._notComputed("ARIMA"); return; }
    const rows = d.arima.map(r => `
      <tr><td><b>${esc(r.ticker)}</b></td><td>${esc(r.order)}</td>
        <td>${fmt.num(r["5d_forecast"], 3)}%</td>
        <td><span class="chip ${verdictFor(reg, "arima_signal", r.signal).cls}"
            data-metric="arima_signal" data-value="${esc(r.signal)}">${esc(r.signal)}</span></td>
      </tr>`).join("");
    node.innerHTML = `<div class="card table-scroll"><table>
      <thead><tr><th>Ticker</th><th>Order (p,d,q)</th><th>5-day forecast</th>
      <th>${metricLabel(reg, "arima_signal", "Signal")}</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },

  model_ml(node) {
    const d = this.data, reg = this.registry;
    if (!d.ml?.length) { node.innerHTML = this._notComputed("ML ensemble"); return; }
    const rows = d.ml.map(r => `
      <tr><td><b>${esc(r.ticker)}</b></td>
        <td class="${verdictFor(reg, "ml_prob", r.ml_prob).cls}"
            data-metric="ml_prob" data-value="${r.ml_prob}">${fmt.pct(r.ml_prob, 0)}</td>
        <td class="${verdictFor(reg, "ml_accuracy", r.oof_accuracy).cls}"
            data-metric="ml_accuracy" data-value="${r.oof_accuracy}">${fmt.pct(r.oof_accuracy, 0)}</td>
        <td><span class="chip ${verdictFor(reg, "ml_signal", r.ml_signal).cls}"
            data-metric="ml_signal" data-value="${esc(r.ml_signal)}">${esc(r.ml_signal)}</span></td>
        <td style="white-space:normal">${esc(r.top_features)}</td></tr>`).join("");
    node.innerHTML = `<div class="card table-scroll"><table>
      <thead><tr><th>Ticker</th>
      <th>${metricLabel(reg, "ml_prob", "P(outperform)")}</th>
      <th>${metricLabel(reg, "ml_accuracy", "OOF accuracy")}</th>
      <th>${metricLabel(reg, "ml_signal", "Signal")}</th>
      <th>Top features</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  },

  model_montecarlo(node) {
    const d = this.data, mc = d.mc, reg = this.registry;
    const tiles = [
      ["expected_value", "Terminal mean", fmt.usd(mc.terminal_mean), null],
      ["expected_value", "Terminal median", fmt.usd(mc.terminal_median), null],
      ["p_beat_target", "P(beat 8% target)", fmt.pct(mc.p_beat_target, 0), mc.p_beat_target],
      ["p_beat_hurdle", "P(beat car APR)", fmt.pct(mc.p_beat_hurdle, 0), mc.p_beat_hurdle],
      ["p_loss", "P(any loss)", fmt.pct(mc.p_loss, 0), mc.p_loss],
      ["p_breach_floor", "P(breach 15% floor)", fmt.pct(mc.p_breach_floor, 1), mc.p_breach_floor],
    ].map(([key, label, text, v]) => {
      const cls = v != null ? verdictFor(reg, key, v).cls : "";
      return `<div class="card tile hoverable">
        <div class="t-label">${metricLabel(reg, key, label)}</div>
        <div class="t-value ${cls}" data-metric="${key}" ${v != null ? `data-value="${v}"` : ""}>${text}</div>
      </div>`;
    }).join("");
    node.innerHTML = `
      <div class="grid cols-3">${tiles}</div>
      <div class="grid cols-2" style="margin-top:14px">
        <div class="card"><h3>Simulation band (5–95%)</h3>
          <div id="mc-band" class="chart"></div></div>
        <div class="card"><h3 data-metric="expected_value">Terminal wealth distribution <i class="idot">i</i></h3>
          <div id="mc-hist" class="chart"></div></div>
      </div>`;
    Charts.mcBand("mc-band", mc.band, d.total_investable);
    Charts.mcHist("mc-hist", mc.hist_counts, mc.hist_edges, [
      { x: d.total_investable, color: tok("--text-2"), label: "start" },
      { x: mc.hurdle_value, color: tok("--warn"), label: "hurdle" },
      { x: mc.target_value, color: tok("--good"), label: "target" },
    ]);
  },

  model_famafrench(node) {
    const d = this.data, reg = this.registry;
    if (!d.ff?.length) { node.innerHTML = this._notComputed("Fama-French"); return; }
    const rows = d.ff.map(r => `
      <tr><td><b>${esc(r.ticker)}</b></td>
        <td class="${verdictFor(reg, "ff_alpha", r.alpha_ann).cls}"
            data-metric="ff_alpha" data-value="${r.alpha_ann}">${fmt.spct(r.alpha_ann)}</td>
        <td class="${verdictFor(reg, "ff_beta_mkt", r.beta_mkt).cls}"
            data-metric="ff_beta_mkt" data-value="${r.beta_mkt}">${fmt.num(r.beta_mkt)}</td>
        <td>${fmt.num(r.beta_smb)}</td><td>${fmt.num(r.beta_hml)}</td>
        <td data-metric="ff_r2" data-value="${r["R²"]}">${fmt.num(r["R²"])}</td>
        <td><span class="chip ${verdictFor(reg, "ff_signal", r.signal).cls}"
            data-metric="ff_signal" data-value="${esc(r.signal)}">${esc(r.signal)}</span></td>
      </tr>`).join("");
    node.innerHTML = `
      <div class="card table-scroll"><table>
        <thead><tr><th>Ticker</th>
        <th>${metricLabel(reg, "ff_alpha", "α (ann.)")}</th>
        <th>${metricLabel(reg, "ff_beta_mkt", "β market")}</th>
        <th>β size</th><th>β value</th>
        <th>${metricLabel(reg, "ff_r2", "R²")}</th>
        <th>${metricLabel(reg, "ff_signal", "Signal")}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="card" style="margin-top:14px">
        <h3 data-metric="ff_alpha">Annualized alpha <i class="idot">i</i></h3>
        <div id="ff-chart" class="chart"></div></div>`;
    Charts.bars("ff-chart", d.ff.map(r => r.ticker), d.ff.map(r => r.alpha_ann),
      { colors: d.ff.map(r => r.signal === "ALPHA_POS" ? tok("--good") :
          r.signal === "ALPHA_NEG" ? tok("--bad") : tok("--text-3")), format: ".1%" });
  },

  /* ═══ 4. OPTIMIZER ══════════════════════════════════════════════ */
  renderOptimizer(view) {
    const d = this.data, reg = this.registry, f = d.frontier, rp = d.risk_parity;
    const profs = d.scenarios.profiles;
    const tickers = Object.keys(d.portfolio);

    const rpRows = tickers.map(t => `
      <tr><td><b>${esc(t)}</b></td>
        <td>${fmt.pct(d.portfolio[t].weight, 0)}</td>
        <td>${fmt.pct(f.msr.weights[t] ?? 0, 1)}</td>
        <td>${fmt.pct(f.gmv.weights[t] ?? 0, 1)}</td>
        <td>${fmt.pct(rp.weights[t] ?? 0, 1)}</td>
        <td data-metric="risk_contribution" data-value="${rp.risk_contributions[t] ?? 0}">
          ${rp.excluded.includes(t) ? "excluded" : fmt.pct(rp.risk_contributions[t] ?? 0, 1)}</td>
      </tr>`).join("");

    const ddRows = (d.dd_triggers || []).map(r => `
      <tr><td><b>${esc(r.ticker)}</b></td><td>${esc(r.category)}</td>
        <td class="${verdictFor(reg, "current_drawdown", r.current_dd).cls}"
            data-metric="current_drawdown" data-value="${r.current_dd}">${fmt.pct(r.current_dd)}</td>
        <td><span class="chip ${r.action === "WATCH" ? "warn" : "bad"}">${esc(r.action)}</span></td>
        <td style="white-space:normal">${esc(r.detail)}</td></tr>`).join("");

    const g = d.glidepath;
    view.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <h3>Efficient frontier</h3>
          <div id="frontier-chart" class="chart chart-tall"></div>
        </div>
        <div class="card">
          <h3 data-metric="drift">Weights: plan vs math <i class="idot">i</i></h3>
          <div id="weights-chart" class="chart chart-tall"></div>
        </div>
      </div>

      <div class="section"><h2>Risk parity</h2>
        <span class="sub">${metricLabel(reg, "risk_contribution", "equal risk contribution")}
        · cash excluded (${esc(rp.excluded.join(", ") || "none")})</span></div>
      <div class="card table-scroll"><table>
        <thead><tr><th>Ticker</th><th>Plan</th><th>MSR</th><th>GMV</th>
        <th>Risk parity</th><th>Risk share</th></tr></thead>
        <tbody>${rpRows}</tbody></table></div>

      <div class="section"><h2>Glidepath</h2>
        <span class="sub">${metricLabel(reg, "glide_equity",
          `month ${g.month} of ${g.total_months} — ${fmt.pct(g.target_equity, 0)} equity`)}</span></div>
      <div class="card"><div id="glide-chart" class="chart"></div></div>

      <div class="section"><h2>Drawdown triggers</h2>
        <span class="sub">${metricLabel(reg, "current_drawdown", "circuit breakers")}</span></div>
      ${ddRows ? `<div class="card table-scroll"><table>
        <thead><tr><th>Ticker</th><th>Category</th><th>Current DD</th>
        <th>Action</th><th>Detail</th></tr></thead><tbody>${ddRows}</tbody></table></div>`
        : `<div class="card assess-item"><span class="b-dot good"></span>
           No drawdown triggers active — all positions healthy.</div>`}

      <div class="section"><h2>CPPI backtest</h2>
        <span class="sub">${metricLabel(reg, "cppi_floor", "ratcheting floor insurance")}</span></div>
      <div class="grid cols-4">
        <div class="card tile"><div class="t-label">CPPI final</div>
          <div class="t-value">${fmt.usd(d.cppi.final_value)}</div></div>
        <div class="card tile"><div class="t-label">Buy & hold final</div>
          <div class="t-value">${fmt.usd(d.cppi.buyhold_final)}</div></div>
        <div class="card tile"><div class="t-label">CPPI max DD</div>
          <div class="t-value good">${fmt.pct(d.cppi.max_dd_cppi)}</div></div>
        <div class="card tile"><div class="t-label">B&H max DD</div>
          <div class="t-value bad">${fmt.pct(d.cppi.max_dd_risky)}</div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="assess-item" style="margin-bottom:10px">
          <span class="b-dot ${d.cppi.floor_breached ? "bad" : "good"}"></span>
          <span data-metric="cppi_breached" data-value="${d.cppi.floor_breached ? "yes" : "no"}">
            ${d.cppi.floor_breached
              ? "Floor was breached — raise floor to 90% or lower multiplier to 2."
              : "Floor never breached — your safety net works."}</span></div>
        <div id="cppi-chart" class="chart"></div></div>
    `;

    Charts.frontier("frontier-chart", f.curve, [
      { name: "MSR", vol: f.msr.vol, ret: f.msr.ret, color: tok("--good"), symbol: "star" },
      { name: "GMV", vol: f.gmv.vol, ret: f.gmv.ret, color: tok("--warn"), symbol: "diamond" },
      { name: "You", vol: f.current.vol, ret: f.current.ret, color: tok("--accent") },
      { name: "Aggressive", vol: profs.aggressive.ann_vol, ret: profs.aggressive.ann_return,
        color: tok("--text-2"), symbol: "triangle-up" },
      { name: "Conservative", vol: profs.conservative.ann_vol, ret: profs.conservative.ann_return,
        color: tok("--text-3"), symbol: "triangle-down" },
    ]);
    Charts.groupedBars("weights-chart", tickers, [
      { name: "Plan", values: tickers.map(t => d.portfolio[t].weight) },
      { name: "MSR", values: tickers.map(t => f.msr.weights[t] ?? 0) },
      { name: "GMV", values: tickers.map(t => f.gmv.weights[t] ?? 0) },
      { name: "Risk parity", values: tickers.map(t => rp.weights[t] ?? 0) },
    ]);
    const months = Array.from({ length: g.total_months + 1 }, (_, i) => i);
    const se = d.params.glide_start_equity, ee = d.params.glide_end_equity;
    Charts.glidepath("glide-chart", months,
      months.map(mn => se + (ee - se) * Math.min(mn / g.total_months, 1)), g.month);
    Charts.cppi("cppi-chart", d.cppi.account, d.cppi.floor, d.wealth_series);
  },

  /* ═══ 4b. PORTFOLIO BUILDER (GUIDE §23) ═════════════════════════ */
  _builder: null,          // GET /api/builder (slots, presets, funds, preset evals)
  _builderEval: null,      // last POST result — the live build
  builderState: null,      // {slot: {choice, weight}}
  builderPreset: null,
  _builderSeq: 0,
  _builderTimer: null,

  async renderBuilder(view) {
    if (!this._builder) {
      view.innerHTML = `<div class="skeleton"></div>`;
      try {
        this._builder = await api.builder();
        if (!this._builder) throw new Error("404");
      } catch (e) {
        view.innerHTML = `<div class="card empty"><div class="big">—</div>
          <h2>Builder not computed yet</h2>
          <p>Run a recompute from Settings — the candidate universe is fetched
          with the analysis.</p></div>`;
        return;
      }
    }
    const B = this._builder, reg = this.registry;
    if (!this.builderState) {
      this.builderPreset = B.default_preset;
      this.builderState = structuredClone(B.presets[B.default_preset].slots);
    }

    const featured = Object.entries(B.presets).filter(([, p]) => p.featured);
    const others = Object.entries(B.presets).filter(([, p]) => !p.featured);
    const w = this.builderState;
    const base = B.presets[B.baseline_preset].slots;
    const m = B._meta;

    const slotCards = B.slots.map(s => {
      const sel = w[s.id];
      const choice = s.choices.find(c => c.id === sel.choice);
      const delta = sel.weight - (base[s.id] ? base[s.id].weight : 0);
      const cap = s.max_weight != null ? s.max_weight : 1;
      return `<div class="card slot-card">
        <div class="slot-head">
          <span class="slot-name">${esc(s.label)}</span>
          <span class="slot-delta ${delta > 0 ? "good" : delta < 0 ? "bad" : ""}">
            ${delta === 0 ? "unchanged" : fmt.spct(delta, 0) + " vs current"}</span>
        </div>
        <div class="hz-tabs">
          ${s.choices.map(c => `<button data-slot="${s.id}" data-choice="${c.id}"
            class="${sel.choice === c.id && sel.weight > 0 ? "active" : ""}"
            title="${esc(c.note || "")}">${esc(c.label)}</button>`).join("")}
          ${s.optional ? `<button data-slot="${s.id}" data-off="1"
            class="${sel.weight === 0 ? "active" : ""}">Off</button>` : ""}
        </div>
        <div class="stepper">
          <button data-slot="${s.id}" data-step="-1" ${sel.weight <= 0 ? "disabled" : ""}>−</button>
          <span class="stepper-val">${(sel.weight * 100).toFixed(0)}%</span>
          <button data-slot="${s.id}" data-step="1" ${sel.weight >= cap - 1e-9 ? "disabled" : ""}>+</button>
          <span class="slot-note">${esc(choice ? (choice.note || "") : "")}</span>
        </div>
      </div>`;
    }).join("");

    view.innerHTML = `
      <div class="section" style="margin-top:0"><h2>Presets</h2>
        <span class="sub">start from a named option, then tune it · window
          ${esc(m.window.start)} → ${esc(m.window.end)} ·
          hurdle ${fmt.pct(m.hurdle_apr, 1)} APR (from config.py)</span></div>
      <div class="card">
        <div class="subtabs" id="builder-presets">
          ${featured.map(([k, p]) => `<button data-preset="${k}"
            class="${this.builderPreset === k ? "active" : ""}"
            title="${esc(p.note)}">${esc(p.label)}${k === B.baseline_preset
              ? " ·  current" : ""}</button>`).join("")}
        </div>
        <div class="builder-bar">
          <select id="builder-more">
            <option value="">More presets…</option>
            ${others.map(([k, p]) => `<option value="${k}"
              ${this.builderPreset === k ? "selected" : ""}>${esc(p.label)}</option>`).join("")}
          </select>
          <div style="flex:1"></div>
          <span id="builder-total" class="chip"></span>
          <button id="builder-normalize">Normalize</button>
          <button id="builder-reset">Reset</button>
        </div>
      </div>

      <div class="section"><h2>Slots</h2>
        <span class="sub">each slot is a job; the buttons are the funds that can do it</span></div>
      <div class="grid cols-3">${slotCards}</div>

      <div class="section"><h2>This build</h2>
        <span class="sub">vs your current portfolio · seeded MC
          (${m.mc_scenarios.toLocaleString()} paths, seed ${m.seed})</span></div>
      <div id="builder-metrics"></div>

      <div class="section"><h2>Risk vs return</h2>
        <span class="sub">your build against the current book and the named options</span></div>
      <div class="card"><div id="builder-frontier" class="chart chart-tall"></div></div>

      <div id="builder-fundcmp"></div>
    `;

    view.querySelectorAll("[data-preset]").forEach(b =>
      b.addEventListener("click", () => this.applyPreset(view, b.dataset.preset)));
    const more = view.querySelector("#builder-more");
    more.addEventListener("change", () => {
      if (more.value) this.applyPreset(view, more.value);
    });
    view.querySelectorAll("[data-choice]").forEach(b =>
      b.addEventListener("click", () => {
        const s = this.builderState[b.dataset.slot];
        const slot = B.slots.find(x => x.id === b.dataset.slot);
        s.choice = b.dataset.choice;
        // Clicking a fund on an off sleeve turns it back on at its default size.
        if (s.weight === 0 && slot.default_on) s.weight = slot.default_on;
        this.builderPreset = null;
        this.renderBuilder(view);
      }));
    view.querySelectorAll("[data-off]").forEach(b =>
      b.addEventListener("click", () => {
        this.builderState[b.dataset.slot].weight = 0;
        this.builderPreset = null;
        this.renderBuilder(view);
      }));
    view.querySelectorAll("[data-step]").forEach(b =>
      b.addEventListener("click", () => {
        const slot = B.slots.find(x => x.id === b.dataset.slot);
        const cap = slot.max_weight != null ? slot.max_weight : 1;
        const s = this.builderState[b.dataset.slot];
        const next = Math.round((s.weight + 0.01 * Number(b.dataset.step)) * 100) / 100;
        s.weight = Math.min(cap, Math.max(0, next));
        this.builderPreset = null;
        this.renderBuilder(view);
      }));
    view.querySelector("#builder-normalize")
      .addEventListener("click", () => { this.normalizeBuild(); this.renderBuilder(view); });
    view.querySelector("#builder-reset")
      .addEventListener("click", () => this.applyPreset(view, B.default_preset));

    this.paintBuilderTotal(view);
    this.updateBuilderMetrics(view);
    this.scheduleBuilderEval(view);
  },

  applyPreset(view, key) {
    this.builderPreset = key;
    this.builderState = structuredClone(this._builder.presets[key].slots);
    this.renderBuilder(view);
  },

  builderTotal() {
    // Valid client-side because every choice's internal proportions sum to 1,
    // so Σ slot weights ≡ Σ expanded ticker weights (pinned by a test).
    return Object.values(this.builderState).reduce((a, s) => a + s.weight, 0);
  },

  normalizeBuild() {
    // Largest-remainder, so every slot stays on the 1% grid AND the integers
    // sum to exactly 100 (naive scale-then-round lands on 99% or 101%).
    const st = this.builderState, ids = Object.keys(st);
    const total = this.builderTotal();
    if (total <= 0) return;
    const exact = ids.map(id => st[id].weight / total * 100);
    const floors = exact.map(Math.floor);
    let left = 100 - floors.reduce((a, b) => a + b, 0);
    const order = ids.map((id, i) => [i, exact[i] - floors[i]])
      .sort((a, b) => b[1] - a[1]);
    const out = floors.slice();
    for (let k = 0; k < left; k++) out[order[k % order.length][0]] += 1;
    ids.forEach((id, i) => { st[id].weight = out[i] / 100; });

    // Re-apply the crypto cap, handing any excess to the biggest slot.
    const B = this._builder;
    for (const s of B.slots) {
      const cap = s.max_weight;
      if (cap != null && st[s.id].weight > cap) {
        const excess = st[s.id].weight - cap;
        st[s.id].weight = cap;
        const biggest = ids.reduce((a, b) =>
          st[b].weight > st[a].weight && b !== s.id ? b : a,
          ids.find(i => i !== s.id));
        st[biggest].weight = Math.round((st[biggest].weight + excess) * 100) / 100;
      }
    }
  },

  paintBuilderTotal(view) {
    const total = this.builderTotal();
    const ok = Math.abs(total - 1) < 5e-4;
    const el = view.querySelector("#builder-total");
    el.className = "chip " + (ok ? "good" : "bad");
    el.textContent = `Total ${(total * 100).toFixed(0)}%` + (ok ? "" : " — must be 100%");
    view.querySelector("#builder-normalize").disabled = ok;
  },

  scheduleBuilderEval(view) {
    clearTimeout(this._builderTimer);
    const metrics = view.querySelector("#builder-metrics");
    if (Math.abs(this.builderTotal() - 1) > 5e-4) {
      metrics.classList.add("stale-build");   // the server would 422 — don't ask
      return;
    }
    metrics.classList.remove("stale-build");
    metrics.classList.add("busy");
    this._builderTimer = setTimeout(async () => {
      const seq = ++this._builderSeq;
      const res = await api.builderEvaluate({ slots: this.builderState });
      // A newer click already fired — its response is the truth, drop this one.
      if (seq !== this._builderSeq) return;
      if (res.ok) this._builderEval = res.body;
      metrics.classList.remove("busy");
      this.updateBuilderMetrics(view);
    }, 250);
  },

  updateBuilderMetrics(view) {
    const B = this._builder, reg = this.registry;
    const node = view.querySelector("#builder-metrics");
    if (!node) return;
    const ev = this._builderEval;
    const r0 = B.evals[B.baseline_preset];
    if (!ev) { node.innerHTML = `<div class="skeleton"></div>`; return; }

    const M = ev.metrics, mc = M.mc["3y"], mc0 = r0.mc["3y"];
    // higher-is-better flag per row, so the delta is colored by MEANING not sign
    const rows = [
      ["ann_return", "Return", M.ann_ret, r0.ann_ret, ".0%", 1],
      ["ann_vol", "Volatility", M.ann_vol, r0.ann_vol, ".0%", -1],
      ["max_drawdown", "Worst dip", M.max_dd, r0.max_dd, ".0%", 1],
      ["sharpe", "Sharpe", M.sharpe, r0.sharpe, ".2f", 1],
      ["diversification_ratio", "Diversification", M.div_ratio, r0.div_ratio, ".2f", 1],
      ["enb", "Eff. bets", M.enb, r0.enb, ".1f", 1],
      ["weighted_er", "Annual fee", M.weighted_er, r0.weighted_er, ".2%", -1],
      ["p_beat_hurdle", "P(beat APR)", mc.p_beat_hurdle, mc0.p_beat_hurdle, ".0%", 1],
      ["p_breach_floor", "P(breach floor)", mc.p_breach_floor, mc0.p_breach_floor, ".1%", -1],
      ["composite_score", "Score", ev.score, r0.score, ".3f", 1],
    ];
    const num = (v, f) => f.endsWith("%")
      ? fmt.pct(v, f === ".1%" ? 1 : f === ".2%" ? 2 : 0)
      : v.toFixed(f === ".1f" ? 1 : f === ".3f" ? 3 : 2);

    node.innerHTML = `<div class="grid cols-5">${rows.map(
      ([key, label, v, b, f, dir]) => {
        const d = v - b;
        const cls = Math.abs(d) < 1e-9 ? "" : (d * dir > 0 ? "good" : "bad");
        const vd = verdictFor(reg, key, v);
        return `<div class="tile">
          <div class="t-label">${metricLabel(reg, key, label)}</div>
          <div class="t-value ${vd.cls}" data-metric="${key}" data-value="${v}">
            ${num(v, f)}</div>
          <div class="t-sub ${cls}">${Math.abs(d) < 1e-9 ? "same as current"
            : (d > 0 ? "+" : "−") + num(Math.abs(d), f) + " vs current"}</div>
        </div>`;
      }).join("")}</div>`;

    this.renderFundComparison(view);

    // One shared frame → every point is mutually comparable.
    const pts = [
      { name: "YOUR BUILD", vol: M.ann_vol, ret: M.ann_ret,
        color: tok("--accent"), symbol: "star" },
      { name: "Current", vol: r0.ann_vol, ret: r0.ann_ret,
        color: tok("--warn"), symbol: "circle" },
    ];
    for (const [k, p] of Object.entries(B.presets)) {
      if (!p.featured || k === B.baseline_preset) continue;
      const e = B.evals[k];
      if (e) pts.push({ name: p.label, vol: e.ann_vol, ret: e.ann_ret,
                        color: tok("--text-3"), symbol: "circle", quiet: true });
    }
    // The frontier runs out to ~70% vol (a 100%-RKLB corner). Left unclipped it
    // squashes every real portfolio into an unreadable blob around 14%, so keep
    // only the stretch of curve near the builds we're actually plotting.
    const c = this.data.frontier.curve;
    const lo = Math.min(...pts.map(p => p.vol)) - 0.02;
    const hi = Math.max(...pts.map(p => p.vol)) + 0.04;
    const keep = c.Volatility.map((v, i) => [v, c.Return[i]])
                             .filter(([v]) => v >= lo && v <= hi);
    Charts.frontier("builder-frontier",
      keep.length > 1 ? { Volatility: keep.map(p => p[0]), Return: keep.map(p => p[1]) } : c,
      pts);
  },

  renderFundComparison(view) {
    const B = this._builder, reg = this.registry, ev = this._builderEval;
    const node = view.querySelector("#builder-fundcmp");
    const base = B.presets[B.baseline_preset].slots;

    const tickersOf = (slot, choiceId) =>
      Object.keys(slot.choices.find(c => c.id === choiceId).tickers);

    // Only slots whose FUND differs from the current book are worth comparing.
    const changed = B.slots.filter(s =>
      this.builderState[s.id].weight > 0 &&
      this.builderState[s.id].choice !== base[s.id].choice);
    if (!changed.length) {
      node.innerHTML = `<div class="section"><h2>Fund swaps</h2></div>
        <div class="card empty" style="padding:24px">
          <p>No fund swaps yet — you're holding the same funds as your current
          portfolio. Toggle one above (try <b>Space → ROKT</b>) to see how the
          fund itself compares to the one it replaces.</p></div>`;
      return;
    }

    const cards = changed.map(s => {
      const nowAll = tickersOf(s, this.builderState[s.id].choice);
      const wasAll = tickersOf(s, base[s.id].choice);
      // A ticker held by BOTH choices (VTI in "VTI" and in "VTI + AVUV") isn't
      // part of the swap — listing it as current AND new is pure noise.
      const nowIds = nowAll.filter(t => !wasAll.includes(t));
      const wasIds = wasAll.filter(t => !nowAll.includes(t));
      const kept = nowAll.filter(t => wasAll.includes(t));
      const line = (t, isNew) => {
        const f = B.funds[t];
        if (!f) return "";
        const corr = isNew && ev.fund_corr[t] != null ? ev.fund_corr[t] : f.corr_to_r0;
        const cv = verdictFor(reg, "fund_corr_to_port", corr);
        return `<tr class="${isNew ? "row-new" : "row-old"}">
          <td><b>${esc(t)}</b> ${isNew ? '<span class="chip good">new</span>'
            : '<span class="chip info">current</span>'}</td>
          <td>${fmt.pct(f.ann_ret, 1)}</td>
          <td>${fmt.pct(f.ann_vol, 1)}</td>
          <td>${fmt.pct(f.max_dd, 0)}</td>
          <td>${f.sharpe.toFixed(2)}</td>
          <td class="${cv.cls}" data-metric="fund_corr_to_port" data-value="${corr}">
            ${corr == null ? "—" : corr.toFixed(2)}</td>
          <td>${f.expense_ratio == null ? "— <span class='slot-note'>(stock)</span>"
            : fmt.pct(f.expense_ratio, 2)}</td>
        </tr>`;
      };
      const arrow = wasIds.length
        ? `${esc(wasIds.join(" + "))} → ${esc(nowIds.join(" + "))}`
        : `added ${esc(nowIds.join(" + "))}`;
      return `<div class="card">
        <div class="slot-head"><span class="slot-name">${esc(s.label)}</span>
          <span class="slot-note">${arrow}${kept.length
            ? ` · keeps ${esc(kept.join(" + "))}` : ""}</span></div>
        <div class="table-scroll"><table>
          <thead><tr><th>Fund</th><th>Return</th><th>Vol</th><th>Worst dip</th>
            <th>Sharpe</th><th>${metricLabel(reg, "fund_corr_to_port", "Corr to book")}</th>
            <th>${metricLabel(reg, "weighted_er", "Fee")}</th></tr></thead>
          <tbody>${wasIds.map(t => line(t, false)).join("")}
                 ${nowIds.map(t => line(t, true)).join("")}</tbody>
        </table></div>
        <div id="fundbars-${s.id}" class="chart"></div>
      </div>`;
    }).join("");

    node.innerHTML = `<div class="section"><h2>Fund swaps</h2>
      <span class="sub">the fund itself, standalone — not the portfolio</span></div>
      <div class="grid cols-2">${cards}</div>`;

    for (const s of changed) {
      const nowAll = tickersOf(s, this.builderState[s.id].choice);
      const wasAll = tickersOf(s, base[s.id].choice);
      const all = [...wasAll.filter(t => !nowAll.includes(t)), ...nowAll]
        .filter(t => B.funds[t]);
      // Percent metrics only — groupedBars takes ONE format for the whole axis,
      // so Sharpe (a ratio) would render as "60%". It lives in the table instead.
      Charts.groupedBars(`fundbars-${s.id}`,
        ["Ann. return", "Volatility", "Worst dip"],
        all.map(t => ({ name: t, values: [B.funds[t].ann_ret, B.funds[t].ann_vol,
                                          B.funds[t].max_dd] })), ".0%");
    }
  },

  /* ═══ 5. LEDGER ═════════════════════════════════════════════════ */
  async renderLedger(view) {
    view.innerHTML = `<div class="skeleton"></div>`;
    const led = await api.ledger().catch(() => null);
    const d = this.data;
    if (!led) { view.innerHTML = `<div class="card empty">Ledger unavailable.</div>`; return; }

    const hasHoldings = led.value && led.value.length;
    let holdingsHtml;
    if (hasHoldings) {
      const rows = led.value.map(r => `
        <tr><td><b>${esc(r.ticker)}</b></td>
          <td>${fmt.num(r.shares, 4)}</td><td>${fmt.usd(r.cost_basis, 2)}</td>
          <td>${fmt.usd(r.current_price, 2)}</td><td>${fmt.usd(r.market_value, 2)}</td>
          <td class="${r.unrealized_pnl >= 0 ? "good" : "bad"}">${fmt.susd(r.unrealized_pnl)}</td>
          <td class="${r.pnl_pct >= 0 ? "good" : "bad"}">${fmt.num(r.pnl_pct, 1)}%</td></tr>`).join("");
      const driftRows = (led.drift || []).map(r => `
        <tr><td><b>${esc(r.ticker)}</b></td>
          <td>${fmt.pct(r.current)}</td><td>${fmt.pct(r.target)}</td>
          <td class="${verdictFor(this.registry, "drift", r.drift).cls}"
              data-metric="drift" data-value="${r.drift}">${fmt.spct(r.drift)}</td></tr>`).join("");
      holdingsHtml = `
        <div class="card table-scroll"><table>
          <thead><tr><th>Ticker</th><th>Shares</th><th>Cost basis</th><th>Price</th>
          <th>Value</th><th>P&L</th><th>P&L %</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="section"><h2>Drift vs target</h2>
          <span class="sub">${metricLabel(this.registry, "drift", "rebalance beyond ±3%")}</span></div>
        <div class="card table-scroll"><table>
          <thead><tr><th>Ticker</th><th>Current</th><th>Target</th><th>Drift</th></tr></thead>
          <tbody>${driftRows}</tbody></table></div>`;
    } else {
      holdingsHtml = `<div class="card empty">
        <h2>No holdings recorded yet</h2>
        <p>The analysis currently assumes you're at plan weights. Record real
        buys below, or bootstrap the ledger from the ${fmt.usd(d.total_investable)} plan.</p>
        <button id="init-ledger" class="primary">Initialize from plan</button></div>`;
    }

    const txnRows = (led.transactions || []).slice().reverse().slice(0, 50).map(t => `
      <tr><td>${esc(t.date)}</td><td>${esc(t.type)}</td><td><b>${esc(t.ticker)}</b></td>
        <td>${fmt.num(t.shares, 4)}</td><td>${fmt.usd(t.price, 2)}</td>
        <td>${fmt.usd(t.total, 2)}</td></tr>`).join("");

    const tickers = Object.keys(d.portfolio);
    view.innerHTML = `
      ${holdingsHtml}
      <div class="section"><h2>Record a transaction</h2></div>
      <div class="card">
        <form id="txn-form" class="form-grid">
          <div><label>Type</label><select name="type">
            <option value="buy">Buy</option><option value="sell">Sell</option></select></div>
          <div><label>Ticker</label><select name="ticker">
            ${tickers.map(t => `<option>${esc(t)}</option>`).join("")}</select></div>
          <div><label>Shares</label><input name="shares" type="number" step="0.0001" min="0.0001" required></div>
          <div><label>Price / share ($)</label><input name="price" type="number" step="0.01" min="0.01" required></div>
          <div><label>Date</label><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div style="display:flex;align-items:flex-end"><button class="primary" style="width:100%">Record</button></div>
        </form>
        <div id="txn-msg" class="t-sub" style="margin-top:8px"></div>
      </div>
      ${txnRows ? `<div class="section"><h2>History</h2></div>
        <div class="card table-scroll"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Ticker</th><th>Shares</th>
        <th>Price</th><th>Total</th></tr></thead><tbody>${txnRows}</tbody></table></div>` : ""}
    `;

    view.querySelector("#txn-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const body = { type: f.get("type"), ticker: f.get("ticker"),
                     shares: +f.get("shares"), price: +f.get("price"),
                     date: f.get("date") || null };
      const res = await api.txn(body);
      const msg = view.querySelector("#txn-msg");
      if (res.ok) { msg.textContent = "Recorded"; this.renderLedger(view); }
      else msg.textContent = "Error: " + (res.body.detail || "failed");
    });
    view.querySelector("#init-ledger")?.addEventListener("click", async () => {
      const res = await api.initLedger(d.total_investable);
      if (res.ok) this.renderLedger(view);
    });
  },

  /* ═══ 6. SETTINGS ═══════════════════════════════════════════════ */
  async renderSettings(view) {
    view.innerHTML = `<div class="skeleton"></div>`;
    const s = await api.settings().catch(() => null);
    if (!s) { view.innerHTML = `<div class="card empty">Settings unavailable.</div>`; return; }
    const eff = s.effective, d = this.data;

    const invFields = [
      ["monthly_investable", "Monthly investable ($)", "number", 50],
      ["car_apr", "Car APR (hurdle)", "number", 0.005],
      ["invest_start_date", "Invest start date (glidepath anchor)", "date", null],
      ["investment_horizon_yrs", "Horizon (years)", "number", 1],
    ];
    const parFields = [
      ["risk_free_rate", "Risk-free rate", 0.005],
      ["target_return", "Target return", 0.01],
      ["max_drawdown", "Max drawdown limit", 0.05],
      ["monte_carlo_scenarios", "MC scenarios", 1000],
      ["glide_start_equity", "Glide start equity", 0.05],
      ["glide_end_equity", "Glide end equity", 0.05],
    ];

    const dcaInputs = Object.entries(eff.dca_split).map(([t, v]) => `
      <div><label>${esc(t)} ($/mo)</label>
      <input name="dca.${esc(t)}" type="number" step="25" min="0" value="${v}"></div>`).join("");

    const reminders = [];
    if (!s.email_configured) reminders.push(
      `Briefing email not configured — copy <b>email_config.example.json</b>
       → <b>email_config.json</b> with a Google App Password. Reports generate
       without it, but nothing lands in your inbox.`);
    if (s.ledger_empty) reminders.push(
      `Ledger is empty — recommendations assume plan-target weights.
       Record your Chase purchases on the Ledger page (or send the
       purchases/income chart) to switch to real holdings.`);

    view.innerHTML = `
      ${reminders.map(r => `<div class="callout" style="margin-bottom:12px">${r}</div>`).join("")}
      <div class="callout" style="margin-bottom:16px" data-metric="glide_equity">
        Invest start date: <b>${esc(eff.investor.invest_start_date || "not set")}</b>
        — glidepath month ${d.glidepath.month} of ${d.glidepath.total_months}
        ${d._meta.compute_seconds ? ` · last compute ${d._meta.compute_seconds}s` : ""}.
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h3>Investor profile</h3>
          <form id="inv-form" class="form-grid" style="margin-top:10px">
            ${invFields.map(([k, label, type, step]) => `
              <div><label>${esc(label)}</label>
              <input name="${k}" type="${type}" ${step ? `step="${step}"` : ""}
                     value="${esc(eff.investor[k] ?? "")}"></div>`).join("")}
          </form>
        </div>
        <div class="card">
          <h3>Model parameters</h3>
          <form id="par-form" class="form-grid" style="margin-top:10px">
            ${parFields.map(([k, label, step]) => `
              <div><label>${esc(label)}</label>
              <input name="${k}" type="number" step="${step}"
                     value="${esc(eff.params[k] ?? "")}"></div>`).join("")}
          </form>
        </div>
      </div>

      <div class="section"><h2>Monthly DCA split</h2>
        <span class="sub">where each month's ${fmt.usd(eff.investor.monthly_investable)} goes</span></div>
      <div class="card"><form id="dca-form" class="form-grid">${dcaInputs}</form></div>

      <div class="section"><h2>Apply</h2></div>
      <div class="card" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button id="save-settings" class="primary">Save settings</button>
        <button id="recompute-fast">Recompute (fast)</button>
        <button id="recompute-full">Full recompute (ARIMA + ML, slow)</button>
        <button id="refresh-data">Refresh market data</button>
        <span id="settings-msg" class="t-sub"></span>
      </div>

      <div class="section"><h2>About this analysis</h2></div>
      <div class="card t-sub">
        Computed ${esc(d._meta.computed_at)} · data ${esc(d._meta.data_from)} →
        ${esc(d._meta.data_through)} (${d._meta.trading_days} days) ·
        ${d._meta.fast ? "fast mode" : "full mode"} · weights source:
        ${esc(d._meta.weights_source)}.<br>
        Every formula here was verified in <b>AUDIT.md</b>; meanings live in
        <b>GUIDE.md</b> — hover any metric for its rationale.
      </div>
    `;

    const msg = view.querySelector("#settings-msg");
    view.querySelector("#save-settings").addEventListener("click", async () => {
      const inv = {}, par = {}, dca = {};
      new FormData(view.querySelector("#inv-form")).forEach((v, k) => {
        if (v !== "") inv[k] = k === "invest_start_date" ? v : +v;
      });
      new FormData(view.querySelector("#par-form")).forEach((v, k) => {
        if (v !== "") par[k] = +v;
      });
      new FormData(view.querySelector("#dca-form")).forEach((v, k) => {
        dca[k.replace("dca.", "")] = +v;
      });
      const res = await api.saveSettings({ investor: inv, params: par, dca_split: dca });
      msg.textContent = res.ok ? "Saved. Recompute to apply." : "Save failed.";
    });
    view.querySelector("#recompute-fast").addEventListener("click", async () => {
      const r = await api.recompute(true);
      msg.textContent = r.ok ? "Recompute started…" : (r.body.detail || "Busy.");
    });
    view.querySelector("#recompute-full").addEventListener("click", async () => {
      const r = await api.recompute(false);
      msg.textContent = r.ok ? "Full recompute started (several minutes)…" : (r.body.detail || "Busy.");
    });
    view.querySelector("#refresh-data").addEventListener("click", async () => {
      const r = await api.refreshData();
      msg.textContent = r.ok ? "Refreshing market data…" : (r.body.detail || "Busy.");
    });
  },
};

App.init();
