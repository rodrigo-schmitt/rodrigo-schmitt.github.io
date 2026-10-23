/* Plotly chart builders on a Mission Control template. */
const Charts = (() => {
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function baseLayout(overrides = {}) {
    const grid = css("--grid");
    const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: grid };
    const out = Object.assign({
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: getComputedStyle(document.body).fontFamily,
              color: css("--text-2"), size: 12 },
      margin: { t: 26, r: 16, b: 42, l: 56 },
      colorway: [css("--series-1"), css("--series-2"), css("--series-3"),
                 css("--series-4"), css("--series-5"), css("--series-6")],
      hoverlabel: { bgcolor: css("--panel-solid"),
                    bordercolor: css("--panel-border"),
                    font: { color: css("--text-1"), size: 12 } },
      showlegend: false,
    }, overrides);
    // axis overrides must MERGE with the themed grid, not replace it
    out.xaxis = Object.assign({}, axis, overrides.xaxis || {});
    out.yaxis = Object.assign({}, axis, overrides.yaxis || {});
    return out;
  }

  const CONFIG = { displayModeBar: false, responsive: true };

  function plot(id, traces, layout) {
    const node = document.getElementById(id);
    if (node) Plotly.newPlot(node, traces, baseLayout(layout), CONFIG);
  }

  return {
    drawdown(id, series, limit) {
      plot(id, [{
        x: series.dates, y: series.values, mode: "lines", fill: "tozeroy",
        line: { color: css("--bad"), width: 1.2 },
        fillcolor: css("--bad-bg"),
        hovertemplate: "%{x}<br>%{y:.1%}<extra></extra>",
      }], {
        yaxis: { tickformat: ".0%", gridcolor: css("--grid") },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1,
                   y0: -limit, y1: -limit,
                   line: { color: css("--warn"), width: 1, dash: "dash" } }],
        annotations: [{ xref: "paper", x: 0.995, y: -limit, yanchor: "bottom",
                        text: `−${(limit * 100).toFixed(0)}% limit`, showarrow: false,
                        font: { color: css("--warn"), size: 11 } }],
      });
    },

    wealth(id, series) {
      plot(id, [{
        x: series.dates, y: series.values, mode: "lines",
        line: { color: css("--accent"), width: 1.6 },
        hovertemplate: "%{x}<br>%{y:$,.0f}<extra></extra>",
      }], { yaxis: { tickprefix: "$", gridcolor: css("--grid") } });
    },

    heatmap(id, tickers, matrix) {
      plot(id, [{
        z: matrix, x: tickers, y: tickers, type: "heatmap",
        zmin: -1, zmax: 1,
        colorscale: [[0, css("--accent")], [0.5, css("--panel-solid")], [1, css("--bad")]],
        text: matrix.map(r => r.map(v => v.toFixed(2))),
        texttemplate: "%{text}", textfont: { size: 11 },
        hovertemplate: "%{y} × %{x}: %{z:.2f}<extra></extra>",
        showscale: false,
      }], { margin: { t: 10, l: 56, r: 10, b: 40 } });
    },

    bars(id, x, y, { colors, format = ".2f", hline, hlineText } = {}) {
      const layout = { yaxis: { tickformat: format, gridcolor: css("--grid") } };
      if (hline != null) {
        layout.shapes = [{ type: "line", xref: "paper", x0: 0, x1: 1,
                           y0: hline, y1: hline,
                           line: { color: css("--bad"), width: 1, dash: "dash" } }];
        if (hlineText) layout.annotations = [{ xref: "paper", x: 0.99, y: hline,
          yanchor: "bottom", text: hlineText, showarrow: false,
          font: { color: css("--bad"), size: 11 } }];
      }
      plot(id, [{ x, y, type: "bar",
        marker: { color: colors || css("--accent") },
        hovertemplate: "%{x}: %{y:" + format + "}<extra></extra>" }], layout);
    },

    groupedBars(id, x, seriesList, format = ".0%") {
      const traces = seriesList.map(s => ({
        x, y: s.values, name: s.name, type: "bar",
        hovertemplate: s.name + " %{x}: %{y:" + format + "}<extra></extra>",
      }));
      plot(id, traces, {
        barmode: "group", showlegend: true,
        legend: { orientation: "h", y: 1.12 },
        yaxis: { tickformat: format, gridcolor: css("--grid") },
      });
    },

    stackedRegime(id, tickers, pBull, pNeutral, pBear) {
      plot(id, [
        { x: tickers, y: pBull, name: "Bull", type: "bar", marker: { color: css("--good") } },
        { x: tickers, y: pNeutral, name: "Neutral", type: "bar", marker: { color: css("--warn") } },
        { x: tickers, y: pBear, name: "Bear", type: "bar", marker: { color: css("--bad") } },
      ], { barmode: "stack", showlegend: true,
           legend: { orientation: "h", y: 1.12 },
           yaxis: { tickformat: ".0%", gridcolor: css("--grid") } });
    },

    frontier(id, curve, points) {
      const traces = [{
        x: curve.Volatility, y: curve.Return, mode: "lines",
        line: { color: css("--info"), width: 2 }, name: "Frontier",
        hovertemplate: "σ %{x:.1%} → %{y:.1%}<extra>frontier</extra>",
      }];
      for (const p of points) {
        // quiet:true → marker only, name on hover. For dense clusters of
        // reference points whose labels would otherwise overlap each other.
        traces.push({
          x: [p.vol], y: [p.ret], mode: p.quiet ? "markers" : "markers+text",
          name: p.name,
          text: [p.name], textposition: "top center",
          textfont: { size: 11, color: p.color },
          marker: { size: 11, symbol: p.symbol || "circle", color: p.color,
                    line: { width: 1, color: css("--panel-solid") } },
          hovertemplate: `${p.name}: σ %{x:.1%}, R %{y:.1%}<extra></extra>`,
        });
      }
      plot(id, traces, {
        xaxis: { tickformat: ".0%", title: { text: "Volatility", font: { size: 11 } },
                 gridcolor: css("--grid") },
        yaxis: { tickformat: ".0%", title: { text: "Return", font: { size: 11 } },
                 gridcolor: css("--grid") },
      });
    },

    mcBand(id, band, initial) {
      plot(id, [
        { x: band.step, y: band.p95, mode: "lines", line: { width: 0 },
          hoverinfo: "skip" },
        { x: band.step, y: band.p5, mode: "lines", fill: "tonexty",
          fillcolor: css("--accent-fill"), line: { width: 0 },
          hovertemplate: "5–95%% band<extra></extra>" },
        { x: band.step, y: band.p50, mode: "lines",
          line: { color: css("--accent"), width: 2 },
          hovertemplate: "median %{y:$,.0f}<extra></extra>" },
      ], {
        yaxis: { tickprefix: "$", gridcolor: css("--grid") },
        xaxis: { title: { text: "Trading days →", font: { size: 11 } } },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: initial, y1: initial,
                   line: { color: css("--text-3"), width: 1, dash: "dot" } }],
      });
    },

    mcHist(id, counts, edges, marks) {
      const centers = edges.slice(0, -1).map((e, i) => (e + edges[i + 1]) / 2);
      plot(id, [{ x: centers, y: counts, type: "bar",
        marker: { color: css("--accent-soft") },
        hovertemplate: "%{x:$,.0f}: %{y}<extra></extra>" }], {
        bargap: 0.05,
        xaxis: { tickprefix: "$", gridcolor: css("--grid") },
        shapes: marks.map(m => ({ type: "line", yref: "paper", x0: m.x, x1: m.x,
          y0: 0, y1: 1, line: { color: m.color, width: 1.4, dash: "dash" } })),
        annotations: marks.map((m, i) => ({ x: m.x, yref: "paper", y: 0.98 - i * 0.08,
          text: m.label, showarrow: false, font: { color: m.color, size: 11 },
          xanchor: "left" })),
      });
    },

    cppi(id, account, floor, wealth) {
      plot(id, [
        { x: wealth.dates, y: wealth.values, mode: "lines", name: "Buy & Hold",
          line: { color: css("--info"), width: 1.3 },
          hovertemplate: "B&H %{y:$,.0f}<extra></extra>" },
        { x: account.dates, y: account.values, mode: "lines", name: "CPPI",
          line: { color: css("--good"), width: 1.6 },
          hovertemplate: "CPPI %{y:$,.0f}<extra></extra>" },
        { x: floor.dates, y: floor.values, mode: "lines", name: "Floor (ratchet)",
          line: { color: css("--bad"), width: 1.1, dash: "dash" },
          hovertemplate: "Floor %{y:$,.0f}<extra></extra>" },
      ], { showlegend: true, legend: { orientation: "h", y: 1.12 },
           yaxis: { tickprefix: "$", gridcolor: css("--grid") } });
    },

    rebasedLines(id, dates, seriesMap, portfolio) {
      const traces = Object.entries(seriesMap).map(([name, values]) => ({
        x: dates, y: values, mode: "lines", name,
        line: { width: 1.2 }, opacity: 0.8,
        hovertemplate: name + " %{y:.1f}<extra></extra>",
      }));
      if (portfolio) traces.push({
        x: dates, y: portfolio, mode: "lines", name: "PORTFOLIO",
        line: { width: 3, color: css("--accent") },
        hovertemplate: "PORTFOLIO %{y:.1f}<extra></extra>",
      });
      plot(id, traces, {
        showlegend: true,
        legend: { orientation: "h", y: -0.18, font: { size: 11 } },
        hovermode: "x unified",
        yaxis: { title: { text: "rebased = 100", font: { size: 11 } },
                 gridcolor: css("--grid") },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 100, y1: 100,
                   line: { color: css("--text-3"), width: 1, dash: "dot" } }],
        margin: { t: 12, r: 12, b: 8, l: 46 },
      });
    },

    priceSMA(id, dates, close, sma20, sma50) {
      plot(id, [
        { x: dates, y: close, mode: "lines", name: "Close",
          line: { color: css("--accent"), width: 1.5 },
          hovertemplate: "%{x}<br>$%{y:.2f}<extra>close</extra>" },
        { x: dates, y: sma20, mode: "lines", name: "SMA20",
          line: { color: css("--accent-2"), width: 1, dash: "dot" },
          hovertemplate: "SMA20 $%{y:.2f}<extra></extra>" },
        { x: dates, y: sma50, mode: "lines", name: "SMA50",
          line: { color: css("--info"), width: 1, dash: "dash" },
          hovertemplate: "SMA50 $%{y:.2f}<extra></extra>" },
      ], {
        margin: { t: 8, r: 10, b: 30, l: 44 },
        yaxis: { tickprefix: "$", gridcolor: css("--grid"),
                 tickfont: { size: 11 } },
        xaxis: { tickfont: { size: 11 }, nticks: 5 },
      });
    },

    sparkline(id, dates, values, { color, format = ".0%", zero = false } = {}) {
      const layout = {
        margin: { t: 4, r: 4, b: 4, l: 4 },
        xaxis: { visible: false }, yaxis: { visible: false },
        hovermode: "closest",
      };
      if (zero) layout.shapes = [{ type: "line", xref: "paper", x0: 0, x1: 1,
        y0: 0, y1: 0, line: { color: css("--text-3"), width: 0.7, dash: "dot" } }];
      plot(id, [{
        x: dates, y: values, mode: "lines",
        line: { color: color || css("--info"), width: 1.2 },
        fill: "tozeroy", fillcolor: css("--info-bg"),
        hovertemplate: "%{x}<br>%{y:" + format + "}<extra></extra>",
      }], layout);
    },

    /* Deploy planner: one dot per bucket. x is the shared 1–5 risk scale, so
       buckets at the same level are fanned out sideways to stay readable. */
    deployBubble(id, pts, hurdle, riskLabels) {
      const groups = {};
      pts.forEach(p => (groups[p.risk] = groups[p.risk] || []).push(p));
      const biggest = Math.max(...pts.map(p => p.amount), 1);
      const color = (c) => css("--" + (c === "info" ? "info" : c));
      const traces = [];
      for (const list of Object.values(groups)) {
        list.forEach((p, i) => {
          const x = p.risk + (list.length > 1 ? (i / (list.length - 1) - 0.5) * 0.56 : 0);
          traces.push({
            x: [x], y: [p.base], mode: "markers+text", name: p.name,
            text: [p.name], textposition: i % 2 ? "bottom center" : "top center",
            textfont: { size: 11, color: css("--text-2") },
            marker: { size: 14 + 30 * Math.sqrt(p.amount / biggest), color: color(p.cls),
                      opacity: 0.85, line: { width: 1, color: css("--panel-solid") } },
            error_y: { type: "data", symmetric: false, array: [p.high - p.base],
                       arrayminus: [p.base - p.low], color: color(p.cls),
                       thickness: 1.4, width: 5 },
            hovertemplate: `${p.name}<br>base %{y:.1%}<br>low ${(p.low * 100).toFixed(0)}% · `
              + `high ${(p.high * 100).toFixed(0)}%<br>$${Math.round(p.amount).toLocaleString("en-US")}`
              + "<extra></extra>",
          });
        });
      }
      plot(id, traces, {
        margin: { t: 26, r: 16, b: 46, l: 52 },
        xaxis: { range: [0.4, 5.6], tickvals: [1, 2, 3, 4, 5], ticktext: riskLabels,
                 title: { text: "Risk", font: { size: 11 } },
                 gridcolor: css("--grid") },
        yaxis: { tickformat: ".0%", title: { text: "Return per year", font: { size: 11 } },
                 gridcolor: css("--grid") },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: hurdle, y1: hurdle,
                   line: { color: css("--accent-2"), width: 1, dash: "dash" } }],
        annotations: [{ xref: "paper", x: 0.995, y: hurdle, yanchor: "bottom",
                        text: `hurdle ${(hurdle * 100).toFixed(1)}%`, showarrow: false,
                        font: { color: css("--accent-2"), size: 11 } }],
      });
    },

    deployTimeline(id, rows, horizon) {
      const r = rows.slice().sort((a, b) => b.end - a.end);
      const span = Math.max(horizon, ...r.map(x => x.end));
      plot(id, [{
        type: "bar", orientation: "h",
        y: r.map(x => x.name), x: r.map(x => x.end),
        marker: { color: r.map(x => x.open ? css("--info") : css("--accent")),
                  opacity: r.map(x => x.open ? 0.4 : 0.9) },
        customdata: r.map(x => [x.open ? "open-ended" : "cash back after "
          + (x.end < 1 ? Math.round(x.end * 12) + " months" : +x.end.toFixed(1) + " years"),
          "$" + Math.round(x.amount).toLocaleString("en-US")]),
        hovertemplate: "%{y}<br>%{customdata[0]}<br>%{customdata[1]}<extra></extra>",
      }], {
        margin: { t: 26, r: 16, b: 46, l: 8 },
        bargap: 0.35,
        xaxis: { range: [0, span * 1.06], title: { text: "Years from now", font: { size: 11 } },
                 gridcolor: css("--grid") },
        yaxis: { automargin: true, autorange: "reversed", tickfont: { size: 11 } },
        shapes: [{ type: "line", x0: horizon, x1: horizon, yref: "paper", y0: 0, y1: 1,
                   line: { color: css("--accent-2"), width: 1.4, dash: "dash" } }],
        annotations: [{ x: horizon, yref: "paper", y: 1.06, text: "your horizon",
                        showarrow: false, font: { color: css("--accent-2"), size: 11 } }],
      });
    },

    glidepath(id, months, equity, currentMonth) {
      plot(id, [
        { x: months, y: equity, mode: "lines", name: "Equity %",
          line: { color: css("--accent"), width: 2 },
          hovertemplate: "month %{x}: %{y:.0%}<extra>equity</extra>" },
        { x: months, y: equity.map(e => 1 - e), mode: "lines", name: "Bond %",
          line: { color: css("--good"), width: 2 },
          hovertemplate: "month %{x}: %{y:.0%}<extra>bonds</extra>" },
      ], {
        showlegend: true, legend: { orientation: "h", y: 1.12 },
        yaxis: { tickformat: ".0%", gridcolor: css("--grid") },
        xaxis: { title: { text: "Month", font: { size: 11 } } },
        shapes: [{ type: "line", x0: currentMonth, x1: currentMonth, yref: "paper",
                   y0: 0, y1: 1, line: { color: css("--accent-2"), width: 1.4, dash: "dash" } }],
        annotations: [{ x: currentMonth, yref: "paper", y: 1.03, text: "you are here",
                        showarrow: false, font: { color: css("--accent-2"), size: 11 } }],
      });
    },
  };
})();
