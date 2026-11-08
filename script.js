/* =========================================================
   FinTracker — main script
   Sections:
   1. API key handling (visitor key first, demo key second)
   2. Theme (auto by local time / manual)
   3. Search, recent & popular symbols
   4. Fetching data from Alpha Vantage
   5. Calculations (stats, volatility, sentiment)
   6. Rendering (chart, cards, news, text-to-speech)
   7. Sample data fallback (when the API limit is reached)
   ========================================================= */

const AV_BASE = "https://www.alphavantage.co/query";
const POPULAR = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOGL"];
// Indian stocks on Alpha Vantage use the Bombay Stock Exchange suffix ".BSE"
const POPULAR_INDIA = ["RELIANCE.BSE", "TCS.BSE", "INFY.BSE", "HDFCBANK.BSE"];
let currency = "USD"; // switches to INR for .BSE / .NSE symbols
const MAX_RECENT = 5;

let chart = null;
let currentSeries = [];   // [{date, open, high, low, close, volume}] oldest -> newest
let currentRange = 30;
let pendingSymbol = null; // symbol to load once a key is chosen

// Latest results, used by the weather report and the AI panel
const state = { stats: null, articles: [], aiSentiment: null, isSample: false };

/* Weather types — also used by learn.js on the Start Early tab */
const WEATHER_TYPES = {
  sunny:  { icon: "☀️", title: "Sunny",  meaning: "The price has been rising and the news isn't negative.",
            lesson: "Good days are fun, but they don't last forever. A sunny week doesn't mean next week will be sunny too." },
  cloudy: { icon: "⛅", title: "Cloudy", meaning: "Mixed signals — the price is fairly flat or the news disagrees with the trend.",
            lesson: "Most days are cloudy. This is why investors look at years, not days." },
  rainy:  { icon: "🌧️", title: "Rainy",  meaning: "The price has been falling or the news mood is negative.",
            lesson: "Prices fall sometimes, even for great companies. Rainy days are why you keep an emergency fund first." },
  stormy: { icon: "⛈️", title: "Stormy", meaning: "The price is swinging a lot from day to day (high volatility).",
            lesson: "Big swings make people panic. A calm plan — and not putting all your money in one place — beats panic." },
};

/* ---------- small helpers ---------- */
const $ = (id) => document.getElementById(id);

function storageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: ignore */ }
}
const currencySign = () => (currency === "INR" ? "₹" : "$");
const fmtMoney = (n) => currencySign() + n.toLocaleString(currency === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
const fmtVolume = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(Math.round(n));

function showStatus(message, type = "info", action = null) {
  const bar = $("statusBar");
  bar.className = "status " + type;
  bar.textContent = message;
  if (action) {
    const btn = document.createElement("button");
    btn.textContent = action.label;
    btn.className = "small-btn";
    btn.addEventListener("click", action.onClick);
    bar.appendChild(btn);
  }
}
const hideStatus = () => $("statusBar").classList.add("hidden");

/* =========================================================
   1. API KEY — ask the visitor first, fall back to demo key
   ========================================================= */
function getApiKey() {
  const choice = storageGet("ft_key_choice", null); // {type: "own"|"demo", key}
  if (!choice) return null;
  return choice.type === "own" ? choice.key : FINTRACKER_CONFIG.DEFAULT_ALPHA_VANTAGE_KEY;
}

function openKeyDialog() {
  const choice = storageGet("ft_key_choice", null);
  $("userKeyInput").value = choice && choice.type === "own" ? choice.key : "";
  $("keyDialog").showModal();
}

$("useOwnKey").addEventListener("click", () => {
  const key = $("userKeyInput").value.trim();
  if (!key) { $("userKeyInput").focus(); return; }
  storageSet("ft_key_choice", { type: "own", key });
  $("keyDialog").close();
  resumePending();
});
$("useDemoKey").addEventListener("click", () => {
  storageSet("ft_key_choice", { type: "demo" });
  $("keyDialog").close();
  resumePending();
});
$("keyBtn").addEventListener("click", openKeyDialog);

function resumePending() {
  if (pendingSymbol) { const s = pendingSymbol; pendingSymbol = null; analyse(s); }
}

/* =========================================================
   2. THEME — "auto" picks light by day, dark by night
   ========================================================= */
function applyTheme(choice) {
  let theme = choice;
  if (choice === "auto") {
    const hour = new Date().getHours();
    theme = hour >= 7 && hour < 19 ? "light" : "dark";
  }
  document.documentElement.setAttribute("data-theme", theme);
  if (chart) renderChart(); // redraw chart with theme colours
}
$("themeSelect").addEventListener("change", (e) => {
  storageSet("ft_theme", e.target.value);
  applyTheme(e.target.value);
});

/* ---------- tabs ---------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    $("tab-tracker").classList.toggle("hidden", tab.dataset.tab !== "tracker");
    $("tab-learn").classList.toggle("hidden", tab.dataset.tab !== "learn");
    window.dispatchEvent(new CustomEvent("tabchange", { detail: tab.dataset.tab }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* =========================================================
   3. SEARCH, RECENT & POPULAR
   ========================================================= */
$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const symbol = $("tickerInput").value.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,20}$/.test(symbol)) {
    showStatus("Please enter a valid stock symbol, e.g. AAPL or IBM.", "error");
    return;
  }
  analyse(symbol);
});

function renderChips(containerId, symbols, prefix) {
  const box = $(containerId);
  box.innerHTML = "";
  if (!symbols.length) return;
  const label = document.createElement("span");
  label.className = "chip-label";
  label.textContent = prefix;
  box.appendChild(label);
  symbols.forEach((s) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.textContent = s;
    b.addEventListener("click", () => { $("tickerInput").value = s; analyse(s); });
    box.appendChild(b);
  });
}

function saveRecent(symbol) {
  const recent = storageGet("ft_recent", []).filter((s) => s !== symbol);
  recent.unshift(symbol);
  storageSet("ft_recent", recent.slice(0, MAX_RECENT));
  renderChips("recentList", storageGet("ft_recent", []), "Recent:");
}

/* =========================================================
   4. FETCHING
   ========================================================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Free keys also allow only ~1 request per second, so on a limit message
// wait a moment and try once more before giving up.
async function avRequest(params, retry = true) {
  try { return await avRequestOnce(params); }
  catch (err) {
    if (err.kind === "limit" && retry) { await sleep(1500); return avRequest(params, false); }
    throw err;
  }
}

async function avRequestOnce(params) {
  const url = AV_BASE + "?" + new URLSearchParams({ ...params, apikey: getApiKey() });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error (" + res.status + ")");
  const data = await res.json();
  // Alpha Vantage signals problems inside a 200 response
  if (data["Error Message"]) { const e = new Error("Symbol not found."); e.kind = "notfound"; throw e; }
  if (data["Note"] || data["Information"]) { const e = new Error(data["Note"] || data["Information"]); e.kind = "limit"; throw e; }
  return data;
}

async function fetchPrices(symbol) {
  const data = await avRequest({ function: "TIME_SERIES_DAILY", symbol, outputsize: "compact" });
  const series = data["Time Series (Daily)"];
  if (!series) throw new Error("No price data returned.");
  return Object.entries(series)
    .map(([date, v]) => ({
      date,
      open: +v["1. open"], high: +v["2. high"], low: +v["3. low"],
      close: +v["4. close"], volume: +v["5. volume"],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* NEWS — two free sources that need no key and work from the browser:
   1. Hacker News search (Algolia): fast and reliable, links to the original articles
   2. GDELT news database: wider coverage, but often busy, so used as a backup
   (Alpha Vantage's News & Sentiment feed is now a paid-only endpoint.)
   Neither source gives a sentiment score — the AI model measures the mood. */
const COMPANY_NAMES = {
  AAPL: "Apple", MSFT: "Microsoft", TSLA: "Tesla", NVDA: "Nvidia", AMZN: "Amazon",
  GOOGL: "Google", GOOG: "Google", META: "Meta", NFLX: "Netflix", IBM: "IBM",
  "RELIANCE.BSE": "Reliance Industries", "TCS.BSE": "Tata Consultancy", "INFY.BSE": "Infosys",
  "HDFCBANK.BSE": "HDFC Bank", "TATASTEEL.BSE": "Tata Steel", "WIPRO.BSE": "Wipro", "ITC.BSE": "ITC",
  AMD: "AMD", INTC: "Intel", ORCL: "Oracle", DIS: "Disney", NKE: "Nike", KO: "Coca-Cola",
};

const cleanTitle = (t) => t.replace(/\s+([,.:;!?'%])/g, "$1").replace(/\s+/g, " ").trim();
const escapeRegex = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

async function newsFromHackerNews(name) {
  const since = Math.floor(Date.now() / 1000) - 30 * 86400; // last 30 days
  const url = "https://hn.algolia.com/api/v1/search_by_date?" + new URLSearchParams({
    query: name, tags: "story", numericFilters: "created_at_i>" + since, hitsPerPage: "50",
  });
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) throw new Error("Hacker News search error " + res.status);
  const data = await res.json();
  return (data.hits || [])
    .filter((h) => h.url && !/^(show|ask|tell) hn/i.test(h.title || ""))
    .map((h) => ({ title: cleanTitle(h.title), url: h.url, source: hostOf(h.url), time: h.created_at }));
}

async function newsFromGdelt(name) {
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
    encodeURIComponent('"' + name + '" sourcelang:english') +
    "&mode=artlist&format=json&sort=datedesc&timespan=7d&maxrecords=75";
  const res = await fetchWithTimeout(url, 8000);
  const text = await res.text();
  if (!text.trim().startsWith("{")) throw new Error("GDELT busy");
  return (JSON.parse(text).articles || [])
    .map((a) => ({ title: cleanTitle(a.title || ""), url: a.url, source: a.domain, time: a.seendate }));
}

async function fetchNews(symbol) {
  const name = COMPANY_NAMES[symbol] || symbol.replace(/\.(BSE|NSE)$/, "");
  const pattern = new RegExp("\\b(" + escapeRegex(name) + "|" + escapeRegex(symbol) + ")\\b", "i");
  const seen = new Set();
  const relevant = (list) => list.filter((a) => {
    const key = a.title.toLowerCase();
    if (!a.title || seen.has(key) || !pattern.test(a.title)) return false;
    seen.add(key);
    return true;
  });

  let articles = [];
  try { articles = relevant(await newsFromHackerNews(name)); } catch (e) { console.warn(e); }
  if (articles.length < 3) {
    try { articles = articles.concat(relevant(await newsFromGdelt(name))); } catch (e) { console.warn(e); }
  }
  return articles.slice(0, 6);
}

async function analyse(symbol) {
  if (!getApiKey()) { pendingSymbol = symbol; openKeyDialog(); return; }

  currency = /\.(BSE|NSE)$/.test(symbol) ? "INR" : "USD";
  saveRecent(symbol);
  state.articles = []; state.aiSentiment = null;
  setSentiment(null);
  $("aiResult").textContent = "";
  updateAiButton();
  showStatus("Loading " + symbol + "…", "info");
  $("dashboard").classList.remove("hidden");
  $("symbolTitle").textContent = symbol;

  try {
    currentSeries = await fetchPrices(symbol);
    renderAll(symbol, false);
    hideStatus();
  } catch (err) {
    console.error(err);
    if (err.kind === "notfound") {
      showStatus("Couldn't find \"" + symbol + "\". US stocks use their ticker (e.g. AAPL). Indian stocks need .BSE at the end (e.g. TATASTEEL.BSE, RELIANCE.BSE).", "error");
      $("dashboard").classList.add("hidden");
      return;
    }
    const why = err.kind === "limit"
      ? "The free API limit has been reached for now."
      : "Couldn't reach the market data service.";
    showStatus(why + " Showing sample data so you can explore the features.", "warn", {
      label: "Use my own key", onClick: openKeyDialog,
    });
    currentSeries = sampleSeries(symbol);
    renderAll(symbol, true);
    renderNews(sampleNews(symbol), true);
    return;
  }

  // News is loaded separately so a news failure never hides the chart
  try {
    renderNews(await fetchNews(symbol), false);
  } catch (err) {
    console.error(err);
    $("newsContainer").innerHTML = "";
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Couldn't load news right now — try again in a few seconds.";
    $("newsContainer").appendChild(p);
    setSentiment(null);
  }
}

/* =========================================================
   5. CALCULATIONS
   ========================================================= */
function computeStats(rows) {
  const closes = rows.map((r) => r.close);
  const first = rows[0], last = rows[rows.length - 1];
  const prev = rows[rows.length - 2] || first;

  // daily % returns -> standard deviation -> annualised volatility
  const returns = [];
  for (let i = 1; i < closes.length; i++) returns.push(closes[i] / closes[i - 1] - 1);
  const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(returns.length - 1, 1);
  const dailyVol = Math.sqrt(variance);
  const annualVol = dailyVol * Math.sqrt(252) * 100; // 252 trading days in a year

  return {
    last: last.close,
    dayChangePct: (last.close / prev.close - 1) * 100,
    dayChangeAbs: last.close - prev.close,
    high: Math.max(...rows.map((r) => r.high)),
    low: Math.min(...rows.map((r) => r.low)),
    periodReturn: (last.close / first.close - 1) * 100,
    avgVolume: rows.reduce((a, r) => a + r.volume, 0) / rows.length,
    dailyVolPct: dailyVol * 100,
    annualVol,
    lastDate: last.date,
  };
}

function volatilityLabel(annualVol) {
  if (annualVol < 20) return { text: "✔️ Low volatility", cls: "good" };
  if (annualVol < 40) return { text: "↔️ Moderate volatility", cls: "mid" };
  return { text: "⚠️ High volatility", cls: "bad" };
}

// Sentiment score ranges from -1 (bearish) to +1 (bullish)
function sentimentLabel(score) {
  if (score <= -0.35) return { text: "Bearish", cls: "bad" };
  if (score <= -0.15) return { text: "Somewhat bearish", cls: "bad" };
  if (score < 0.15) return { text: "Neutral", cls: "mid" };
  if (score < 0.35) return { text: "Somewhat bullish", cls: "good" };
  return { text: "Bullish", cls: "good" };
}

/* =========================================================
   6. RENDERING
   ========================================================= */
function renderAll(symbol, isSample) {
  const rows = currentSeries.slice(-currentRange);
  const s = computeStats(rows);
  state.stats = s;
  state.isSample = isSample;

  $("symbolTitle").textContent = symbol + (isSample ? " · sample data" : "");
  $("lastUpdated").textContent = "Last close: " + s.lastDate;
  $("lastPrice").textContent = fmtMoney(s.last);
  const ch = $("dayChange");
  ch.textContent = (s.dayChangeAbs >= 0 ? "▲ " : "▼ ") + fmtMoney(Math.abs(s.dayChangeAbs)).slice(1) + " (" + fmtPct(s.dayChangePct) + ")";
  ch.className = "change " + (s.dayChangePct >= 0 ? "up" : "down");

  $("statHigh").textContent = fmtMoney(s.high);
  $("statLow").textContent = fmtMoney(s.low);
  $("statReturn").textContent = fmtPct(s.periodReturn);
  $("statReturn").className = s.periodReturn >= 0 ? "up" : "down";
  $("statVolume").textContent = fmtVolume(s.avgVolume);

  const v = volatilityLabel(s.annualVol);
  $("volBadge").textContent = v.text;
  $("volBadge").className = "badge " + v.cls;
  $("volFill").style.width = Math.min(s.annualVol / 60 * 100, 100) + "%";
  $("volText").textContent = "Average daily move ±" + s.dailyVolPct.toFixed(2) +
    "% over " + rows.length + " trading days (≈" + s.annualVol.toFixed(1) + "% a year).";

  renderChart();
  renderWeather();
}

/* ---------- Market weather report ----------
   Rules (checked in order):
   1. annualised volatility >= 40%                      -> stormy
   2. period return > +2% and news mood not negative    -> sunny
   3. period return < -2% or news mood clearly negative -> rainy
   4. anything else                                      -> cloudy
   News mood comes from the AI headline reader (neutral until it has run). */
function computeWeather(stats, mood) {
  const m = mood === null || mood === undefined ? 0 : mood;
  if (stats.annualVol >= 40) return "stormy";
  if (stats.periodReturn > 2 && m >= -0.05) return "sunny";
  if (stats.periodReturn < -2 || m <= -0.15) return "rainy";
  return "cloudy";
}

function renderWeather() {
  if (!state.stats) return;
  const mood = state.aiSentiment;
  const key = computeWeather(state.stats, mood);
  const w = WEATHER_TYPES[key];
  $("weatherCard").dataset.weather = key;
  $("weatherIcon").textContent = w.icon;
  $("weatherTitle").textContent = w.title + (state.isSample ? " (sample data)" : "");
  $("weatherText").textContent = w.meaning + " 🌱 Learning tip: " + w.lesson;
  const moodText = mood === null ? "not measured yet — run the AI reader below" : mood.toFixed(2) + " (AI model)";
  $("weatherBasis").textContent = "Based on: " + currentRange + "-day return " + fmtPct(state.stats.periodReturn) +
    " · volatility ≈" + state.stats.annualVol.toFixed(0) + "%/yr · news mood " + moodText + ". A description of the past, not a forecast.";
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderChart() {
  const rows = currentSeries.slice(-currentRange);
  if (!rows.length || typeof Chart === "undefined") return; // chart library failed to load
  const up = rows[rows.length - 1].close >= rows[0].close;
  const color = up ? cssVar("--up") : cssVar("--down");
  const ctx = $("stockChart").getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, color + "55");
  grad.addColorStop(1, color + "00");

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map((r) => r.date),
      datasets: [{
        label: "Close",
        data: rows.map((r) => r.close),
        borderColor: color,
        backgroundColor: grad,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => " " + fmtMoney(c.parsed.y) } },
      },
      scales: {
        x: { ticks: { color: cssVar("--muted"), maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { color: cssVar("--muted"), callback: (v) => currencySign() + v.toLocaleString(currency === "INR" ? "en-IN" : "en-US") }, grid: { color: cssVar("--border") } },
      },
    },
  });
}

$("rangeButtons").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || !currentSeries.length) return;
  document.querySelectorAll("#rangeButtons button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentRange = +btn.dataset.days;
  const isSample = $("symbolTitle").textContent.includes("sample");
  renderAll($("symbolTitle").textContent.split(" ")[0], isSample);
});

function setSentiment(avg, count) {
  if (avg === null) {
    $("sentBadge").textContent = "Not measured yet";
    $("sentBadge").className = "badge";
    $("sentText").textContent = "Use the 🤖 AI headline reader below to measure the mood of the news.";
    $("sentMarker").style.left = "50%";
    return;
  }
  const s = sentimentLabel(avg);
  $("sentBadge").textContent = s.text;
  $("sentBadge").className = "badge " + s.cls;
  $("sentMarker").style.left = ((Math.max(-1, Math.min(1, avg)) + 1) / 2 * 100) + "%";
  $("sentText").textContent = "AI average " + avg.toFixed(2) + " across " + count + " recent headlines (−1 bearish … +1 bullish).";
}

function formatAvTime(t) {
  if (!t || t.length < 8) return "";
  if (t.includes("-")) { const iso = new Date(t); return isNaN(iso) ? "" : iso.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  const d = new Date(t.slice(0, 4) + "-" + t.slice(4, 6) + "-" + t.slice(6, 8) + "T" + (t.slice(9, 11) || "00") + ":" + (t.slice(11, 13) || "00") + ":00Z");
  return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function renderNews(articles, isSample) {
  const box = $("newsContainer");
  box.innerHTML = "";
  state.articles = articles;
  updateAiButton();
  if (!articles.length) {
    box.innerHTML = '<p class="muted">No recent news found for this symbol.</p>';
    return;
  }

  // Build with textContent (not innerHTML) so news text can't inject HTML
  articles.forEach((n) => {
    const item = document.createElement("article");
    item.className = "news-item";

    const h = document.createElement("h4");
    h.textContent = n.title;
    const meta = document.createElement("p");
    meta.className = "muted small";
    meta.textContent = [n.source, formatAvTime(n.time)].filter(Boolean).join(" · ");
    const aiTag = document.createElement("span");
    aiTag.className = "ai-tag hidden";
    meta.appendChild(aiTag);
    const p = document.createElement("p");
    p.textContent = n.summary || "";
    if (!n.summary) p.classList.add("hidden");

    const actions = document.createElement("div");
    actions.className = "news-actions";
    const listen = document.createElement("button");
    listen.className = "ghost small-btn";
    listen.textContent = "🔊 Listen";
    listen.addEventListener("click", () => speak(n.title + ". " + (n.summary || "")));
    actions.appendChild(listen);
    if (n.url && !isSample) {
      const a = document.createElement("a");
      a.href = n.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Read more →";
      actions.appendChild(a);
    }
    item.append(h, meta, p, actions);
    box.appendChild(item);
  });
}

function speak(text) {
  if (!("speechSynthesis" in window)) { showStatus("Text-to-speech isn't supported in this browser.", "error"); return; }
  window.speechSynthesis.cancel(); // stop anything already playing
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}
$("stopSpeech").addEventListener("click", () => window.speechSynthesis && window.speechSynthesis.cancel());

/* =========================================================
   AI HEADLINE READER (model code lives in ai.js)
   ========================================================= */
function updateAiButton() {
  const btn = $("aiBtn");
  if (!window.FinAI) { btn.disabled = true; btn.textContent = "Loading AI engine…"; return; }
  btn.disabled = !state.articles.length;
  btn.textContent = state.articles.length ? "🤖 Read these headlines with AI" : "Search a stock first";
}
window.addEventListener("finai-ready", updateAiButton);
// If the AI library can't load at all (offline / blocked), say so instead of waiting forever
setTimeout(() => {
  if (!window.FinAI) { $("aiBtn").textContent = "AI engine unavailable in this browser"; }
}, 20000);

$("aiBtn").addEventListener("click", async () => {
  const btn = $("aiBtn");
  const articles = state.articles;
  if (!articles.length) return;
  btn.disabled = true;
  btn.textContent = "Downloading model…";
  $("aiProgress").classList.remove("hidden");
  try {
    const model = await window.FinAI.load((pct) => { $("aiProgressFill").style.width = pct + "%"; });
    $("aiProgress").classList.add("hidden");
    btn.textContent = "Reading headlines…";

    const results = await window.FinAI.classify(articles.map((a) => a.title));

    // Show the AI label next to each article
    document.querySelectorAll("#newsContainer .ai-tag").forEach((tag, i) => {
      const r = results[i];
      if (!r) return;
      tag.textContent = " · 🤖 AI: " + r.label + " (" + Math.round(r.confidence * 100) + "% sure)";
      tag.className = "ai-tag " + (r.score > 0.15 ? "up" : r.score < -0.15 ? "down" : "");
    });

    const avg = results.reduce((a, r) => a + r.score, 0) / results.length;
    const counts = { positive: 0, neutral: 0, negative: 0 };
    results.forEach((r) => { counts[r.score > 0.15 ? "positive" : r.score < -0.15 ? "negative" : "neutral"]++; });
    state.aiSentiment = avg;
    setSentiment(avg, results.length);
    renderWeather();

    $("aiResult").textContent = "Model: " + model + ". " + counts.positive + " positive, " + counts.neutral + " neutral, " +
      counts.negative + " negative → overall " + sentimentLabel(avg).text.toLowerCase() + " (" + avg.toFixed(2) + "). The weather report now includes this news mood.";
    btn.textContent = "✅ Done — run again";
  } catch (err) {
    console.error(err);
    $("aiProgress").classList.add("hidden");
    $("aiResult").textContent = "The AI model couldn't load (slow connection or blocked download). Everything else still works.";
    btn.textContent = "Try again";
  }
  btn.disabled = false;
});

/* =========================================================
   7. SAMPLE DATA (clearly labelled) — used when the API fails
   ========================================================= */
function seededRandom(seed) {
  let x = 0;
  for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

function sampleSeries(symbol) {
  const rand = seededRandom(symbol);
  let price = 50 + rand() * 250;
  const rows = [];
  const d = new Date();
  for (let i = 0; rows.length < 100; i++) {
    const day = new Date(d); day.setDate(d.getDate() - (140 - i));
    if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends
    const open = price;
    price = Math.max(5, price * (1 + (rand() - 0.48) * 0.04));
    rows.push({
      date: day.toISOString().slice(0, 10),
      open, close: price,
      high: Math.max(open, price) * (1 + rand() * 0.01),
      low: Math.min(open, price) * (1 - rand() * 0.01),
      volume: 2e6 + rand() * 4e7,
    });
  }
  return rows;
}

function sampleNews(symbol) {
  return [
    { title: symbol + " shares climb after quarterly results beat expectations", summary: "Sample headline — live data is unavailable right now.", source: "Sample", time: "" },
    { title: "Analysts split on " + symbol + " outlook as costs rise", summary: "Sample headline — connect your own free key for live prices.", source: "Sample", time: "" },
    { title: symbol + " faces regulatory investigation, stock slips", summary: "Sample headline used to demonstrate the AI reader and text-to-speech.", source: "Sample", time: "" },
  ];
}

/* ---------- start-up ---------- */
(function init() {
  const theme = storageGet("ft_theme", "auto");
  $("themeSelect").value = theme;
  applyTheme(theme);
  renderChips("popularList", POPULAR, "Popular:");
  renderChips("indiaList", POPULAR_INDIA, "🇮🇳 India:");
  renderChips("recentList", storageGet("ft_recent", []), "Recent:");
  makeSnow();
})();

/* Gentle snowfall around the footer translator (pure CSS animation) */
function makeSnow() {
  const box = $("snow");
  if (!box) return;
  for (let i = 0; i < 36; i++) {
    const f = document.createElement("span");
    f.className = "flake";
    f.textContent = Math.random() < 0.3 ? "❅" : "•";
    f.style.left = Math.random() * 100 + "%";
    f.style.fontSize = 6 + Math.random() * 10 + "px";
    f.style.animationDuration = 6 + Math.random() * 8 + "s";
    f.style.animationDelay = -Math.random() * 12 + "s"; // start mid-fall so it's snowing immediately
    box.appendChild(f);
  }
}
