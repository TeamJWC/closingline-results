(function () {
  "use strict";
  var real = window.RESULTS_DATA;
  var useReal = !!(real && real.settled && real.settled.length > 0);
  var data = useReal ? real : window.EXAMPLE_DATA;
  if (!useReal) { document.getElementById("example-banner").hidden = false; document.getElementById("ex-tag").hidden = false; document.title = "[EXAMPLE] " + document.title; }

  var TZ = "Australia/Sydney";
  function fmtDate(iso, withTime) {
    if (!iso) return "–";
    var o = { timeZone: TZ, day: "2-digit", month: "short" };
    if (withTime) { o.hour = "2-digit"; o.minute = "2-digit"; o.hour12 = false; }
    return new Intl.DateTimeFormat("en-AU", o).format(new Date(iso));
  }
  function u(x, signed) {
    var s = Math.abs(x).toFixed(2) + "u";
    if (!signed) return s;
    return (x > 0.0049 ? "+" : x < -0.0049 ? "−" : "") + s;
  }
  function cls(x) { return x > 0.0049 ? "pos" : x < -0.0049 ? "neg" : "flat"; }
  function pct(x, signed) {
    if (x === null || !isFinite(x)) return "–";
    return (signed && x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x * 100).toFixed(1) + "%";
  }
  function scen(b) { return b.category === "model_scenario" ? ' <span class="pill scenario" title="Conditional call built on a model scenario">scenario</span>' : ""; }
  function clvTxt(x) { return x === null || x === undefined || !isFinite(x) ? "–" : (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(1) + "%"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function stats(bets) {
    var w = 0, l = 0, p = 0, staked = 0, pnl = 0, clvs = [];
    bets.forEach(function (b) {
      if (b.result === "won") w++; else if (b.result === "lost") l++; else p++;
      if (b.result !== "void") staked += b.risk_units;
      pnl += b.pnl_units;
      if (b.clv_pct !== null && b.clv_pct !== undefined && isFinite(b.clv_pct)) clvs.push(b.clv_pct);
    });
    return { n: bets.length, w: w, l: l, p: p, staked: staked, pnl: pnl,
      strike: w + l ? w / (w + l) : null,  
      clv: clvs.length ? clvs.reduce(function (x, y) { return x + y; }, 0) / clvs.length : null, clvN: clvs.length };
  }

  var bets = (data && data.settled ? data.settled : []).slice().sort(function (a, b) {
    return (a.settled_utc || "").localeCompare(b.settled_utc || "");
  });
  var s = stats(bets);

  // hero + KPIs
  var hero = document.getElementById("hero-units");
  hero.textContent = u(s.pnl, true); hero.className = "big " + cls(s.pnl);
  document.getElementById("hero-meta").textContent = s.n + " settled bet" + (s.n === 1 ? "" : "s") +
    (bets.length ? " · since " + fmtDate(bets[0].settled_utc) : "") +
    (bets.length && bets.length < 100 ? ". Small sample, so read nothing into it yet." : "");
  document.getElementById("k-record").textContent = s.w + "-" + s.l + "-" + s.p;
  var kc = document.getElementById("k-clv"); kc.textContent = clvTxt(s.clv); kc.className = "val " + cls(s.clv || 0);
  document.getElementById("k-clv-n").textContent = s.clvN ? "n=" + s.clvN : "";

  // chart
  (function chart() {
    var el = document.getElementById("chart");
    var narrow = el.clientWidth && el.clientWidth < 560;
    var W = narrow ? 520 : 1000, H = narrow ? 340 : 320, m = { t: 22, r: narrow ? 10 : 16, b: 30, l: narrow ? 44 : 52 };
    var pts = [0], cum = 0;
    bets.forEach(function (b) { cum += b.pnl_units; pts.push(cum); });
    var ns = "http://www.w3.org/2000/svg";
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="' + ns + '" preserveAspectRatio="xMidYMid meet">';
    if (bets.length === 0) {
      el.innerHTML = svg + '<text class="empty" x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle">No settled bets yet</text></svg>';
      return;
    }
    var lo = Math.min.apply(null, pts.concat([0])), hi = Math.max.apply(null, pts.concat([0]));
    var neverNeg = lo >= 0;
    var pad = Math.max((hi - lo) * 0.1, 0.5); lo = neverNeg ? 0 : lo - pad; hi += pad;
    var step = niceStep((hi - lo) / 5);
    lo = neverNeg ? 0 : Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var X = function (i) { return m.l + (pts.length === 1 ? 0 : i / (pts.length - 1) * iw); };
    var Y = function (v) { return m.t + (hi - v) / (hi - lo) * ih; };
    for (var g = lo; g <= hi + 1e-9; g += step) {
      svg += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(g) + '" y2="' + Y(g) + '"/>';
      if (Math.abs(g) > 1e-9) svg += '<text x="' + (m.l - 8) + '" y="' + (Y(g) + 4) + '" text-anchor="end">' + (g > 0 ? "+" : "") + fix(g, step) + "u</text>";  // no "0u" label (public rule)
    }
    svg += '<line class="zero" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    var up = cum >= 0, col = up ? "#3ddc97" : "#ff6b6b";
    var line = pts.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join("");
    var area = line + "L" + X(pts.length - 1).toFixed(1) + "," + Y(0) + "L" + X(0) + "," + Y(0) + "Z";
    svg += '<defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".28"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>';
    svg += '<path d="' + area + '" fill="url(#fill)"/>';
    svg += '<path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    if (pts.length <= 25) pts.forEach(function (v, i) { svg += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3.5" fill="#121821" stroke="' + col + '" stroke-width="2"/>'; });
    svg += '<circle cx="' + X(pts.length - 1) + '" cy="' + Y(cum) + '" r="4.5" fill="' + col + '"/>';
    if (pts.length <= 7) pts.forEach(function (v, i) {
      if (i) svg += '<text class="pt" x="' + X(i) + '" y="' + (Y(v) - 12) + '" text-anchor="' + (i === pts.length - 1 ? "end" : "middle") + '">' + u(v, true) + "</text>";
    });
    // x labels: bet number + date at ~5 ticks
    var ticks = Math.min(5, bets.length);
    for (var k = 0; k <= ticks; k++) {
      var i = Math.round(k / ticks * (pts.length - 1));
      var lbl = i === 0 ? "Start" : (bets.length <= 6 ? "Bet " + i + " · " : "") + fmtDate(bets[i - 1].settled_utc);
      var anchor = k === 0 ? "start" : k === ticks ? "end" : "middle";
      svg += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' + lbl + "</text>";
    }
    el.innerHTML = svg + "</svg>";
    document.getElementById("chart-range").textContent = u(cum, true) + " after " + bets.length + " bet" + (bets.length === 1 ? "" : "s");
  })();
  function niceStep(r) { var e = Math.pow(10, Math.floor(Math.log10(r))), f = r / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  function fix(v, step) { return step < 1 ? v.toFixed(1) : v.toFixed(0); }

  // by sport
  var groups = {};
  bets.forEach(function (b) { (groups[b.sport] = groups[b.sport] || []).push(b); });
  var rows = Object.keys(groups).map(function (k) { return [k, stats(groups[k])]; })
    .sort(function (a, b) { return b[1].n - a[1].n || a[0].localeCompare(b[0]); });
  rows.push(["All", s]);
  document.querySelector("#by-sport tbody").innerHTML = rows.map(function (r) {
    var x = r[1], all = r[0] === "All";
    return "<tr" + (all ? ' style="font-weight:700"' : "") + "><td>" + esc(r[0]) + '</td><td class="num">' + x.n +
      '</td><td class="num">' + x.w + "-" + x.l + "-" + x.p + '</td><td class="num ' + cls(x.pnl) + '">' + u(x.pnl, true) +
      '</td><td class="num ' + cls(x.clv || 0) + '">' + clvTxt(x.clv) + "</td></tr>";
  }).join("") || '<tr><td colspan="5" class="muted">No settled bets yet</td></tr>';

  // bets journal: newest first, sport filter (All + one pill per sport in the data), latest 20 with a Show all toggle
  var LIMIT = 20;
  var journal = { sport: "All", all: false };
  var m = /(?:^|[#&])sport=([^&]+)/.exec(location.hash);   // optional deep link, e.g. index.html#sport=NFL
  if (m) journal.sport = decodeURIComponent(m[1]);
  var sports = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length || a.localeCompare(b); });
  if (journal.sport !== "All" && sports.indexOf(journal.sport) < 0) journal.sport = "All";
  var seg = document.getElementById("sport-filter");
  if (sports.length) {
    seg.innerHTML = ["All"].concat(sports).map(function (sp) {
      var n = sp === "All" ? bets.length : groups[sp].length;
      return '<button type="button" data-sport="' + esc(sp) + '">' + esc(sp) + ' <span class="seg-n">' + n + "</span></button>";
    }).join("");
    seg.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-sport]");
      if (!btn) return;
      journal.sport = btn.getAttribute("data-sport"); journal.all = false;
      try { history.replaceState(null, "", journal.sport === "All" ? location.pathname : "#sport=" + encodeURIComponent(journal.sport)); } catch (e) {}
      renderJournal();
    });
  } else { seg.hidden = true; }
  document.getElementById("show-all").addEventListener("click", function () { journal.all = !journal.all; renderJournal(); });

  function renderJournal() {
    Array.prototype.forEach.call(seg.querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-sport") === journal.sport));
    });
    var list = bets.filter(function (b) { return journal.sport === "All" || b.sport === journal.sport; }).reverse();
    var shown = journal.all ? list : list.slice(0, LIMIT);
    document.querySelector("#recent tbody").innerHTML = shown.map(function (b) {
      var sel = esc(b.selection) + (b.side === "LAY" ? ' <span class="muted">(lay)</span>' : "") + scen(b);
      return "<tr><td>" + fmtDate(b.settled_utc) + "</td><td>" + esc(b.sport) + "</td><td>" + esc(b.event) + "</td><td>" + sel +
        '</td><td class="num">' + (b.odds ? b.odds.toFixed(2) : "–") + '</td><td class="num">' + u(b.risk_units) +
        '</td><td><span class="pill ' + b.result + '"><span class="full">' + (b.result === "void" ? "PUSH" : b.result.toUpperCase()) +
        '</span><span class="short">' + ({ won: "W", lost: "L", void: "P" }[b.result] || "?") + '</span></span></td><td class="num ' +
        (b.clv_pct === null || b.clv_pct === undefined ? "" : cls(b.clv_pct)) + '">' + clvTxt(b.clv_pct) + '</td><td class="num ' + cls(b.pnl_units) + '">' + u(b.pnl_units, true) + (b.result === "void" ? '<span class="m-push"> push</span>' : "") + "</td></tr>";
    }).join("") || '<tr><td colspan="9" class="muted">No settled bets yet</td></tr>';
    var label = (journal.sport === "All" ? "" : journal.sport + " ") + "bet" + (list.length === 1 ? "" : "s");
    var st = stats(list);
    document.getElementById("journal-count").innerHTML = !list.length ? "" :
      (shown.length < list.length ? "Showing latest " + shown.length + " of " + list.length + " " : "Showing " + list.length + " ") + esc(label) +
      ' · <span class="' + cls(st.pnl) + '">' + u(st.pnl, true) + "</span>" + (st.clvN ? " · avg CLV " + clvTxt(st.clv) : "");
    var btn = document.getElementById("show-all");
    btn.hidden = list.length <= LIMIT;
    btn.textContent = journal.all ? "Show latest " + LIMIT : "Show all " + list.length + " " + label;
  }
  renderJournal();

  // pending: ALWAYS real (data.js), never example. In example mode it moves to the top with a REAL tag.
  var open = (real && real.open) ? real.open : [];
  if (open.length) {
    var card = document.getElementById("open-card");
    card.hidden = false;
    document.querySelector("#open tbody").innerHTML = open.map(function (b) {
      return "<tr><td>" + fmtDate(b.kickoff_utc, true) + "</td><td>" + esc(b.sport) + "</td><td>" + esc(b.event) + "</td><td>" +
        esc(b.selection) + (b.side === "LAY" ? " (lay)" : "") + scen(b) + '</td><td class="num">' + (b.odds ? b.odds.toFixed(2) : "–") +
        '</td><td class="num">' + u(b.risk_units) + "</td></tr>";
    }).join("");
    if (!useReal) {
      card.classList.add("real-card");
      document.getElementById("real-tag").hidden = false;
      document.getElementById("banner-real-note").hidden = false;
      // put the real card ABOVE the (example) hero so nothing example sits above it
      var top = document.createElement("div");
      top.className = "wrap real-top";
      var hero = document.querySelector("header.hero");
      hero.parentNode.insertBefore(top, hero);
      top.appendChild(card);
      var ex = document.createElement("p");
      ex.className = "ex-divider";
      ex.innerHTML = '<span class="ex-tag">EXAMPLE</span> Everything below is fictional example data';
      top.appendChild(ex);
      hero.classList.add("after-real");
    }
  }

  document.getElementById("source-line").textContent = useReal
    ? "Data: " + real.source + " · built " + fmtDate(real.generated_utc, true) + " Sydney"
    : "Stats/chart/settled tables: EXAMPLE data. Pending: real, from " + (real ? real.source + " · built " + fmtDate(real.generated_utc, true) + " Sydney" : "no data.js") + ".";
})();
