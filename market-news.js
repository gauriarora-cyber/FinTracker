/* =========================================================
   FinTracker — Market News tab
   Gets headlines from our Netlify Function (/.netlify/functions/news),
   which holds the NewsAPI key on the server. The key never reaches
   the browser.
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const ENDPOINT = "/.netlify/functions/news";

  const news = { country: "us", category: "business", q: "", articles: [], loadedOnce: false };

  /* ---------- helpers ---------- */
  function timeAgo(iso) {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (isNaN(mins)) return "";
    if (mins < 60) return mins + " min ago";
    if (mins < 1440) return Math.round(mins / 60) + " h ago";
    return Math.round(mins / 1440) + " d ago";
  }
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

  /* ---------- fetching ---------- */
  async function loadNews() {
    const grid = $("newsGrid");
    $("newsStatus").textContent = "Loading headlines…";
    grid.innerHTML = "";
    for (let i = 0; i < 6; i++) { const sk = document.createElement("div"); sk.className = "news-card skeleton"; grid.appendChild(sk); }
    resetMood();

    const params = news.q ? { q: news.q } : { category: news.category, country: news.country };
    try {
      const res = await fetch(ENDPOINT + "?" + new URLSearchParams(params));
      const type = res.headers.get("content-type") || "";
      if (!type.includes("application/json")) {
        // Opening index.html directly, or a host without Netlify Functions
        throw new Error("The news service only runs on the Netlify site (it needs the server function).");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "News service error " + res.status);
      news.articles = data.articles || [];
      render();
    } catch (err) {
      console.error(err);
      grid.innerHTML = "";
      news.articles = [];
      $("newsStatus").textContent = "Couldn't load news: " + err.message;
    }
  }

  /* ---------- rendering (textContent only, so headlines can't inject HTML) ---------- */
  function render() {
    const grid = $("newsGrid");
    grid.innerHTML = "";
    if (!news.articles.length) {
      $("newsStatus").textContent = "No headlines found. Try another topic or search.";
      return;
    }
    $("newsStatus").textContent = news.articles.length + " headlines" +
      (news.q ? " for “" + news.q + "”" : " · " + news.category + " · " + (news.country === "in" ? "India" : "US"));

    news.articles.forEach((a, i) => {
      const card = document.createElement("article");
      card.className = "news-card";

      const img = safeUrl(a.image);
      if (img) {
        const im = document.createElement("img");
        im.src = img; im.alt = ""; im.loading = "lazy";
        im.referrerPolicy = "no-referrer";
        im.addEventListener("error", () => im.remove());
        card.appendChild(im);
      }

      const body = document.createElement("div");
      body.className = "news-card-body";
      const meta = document.createElement("p");
      meta.className = "news-meta";
      meta.textContent = [a.source, timeAgo(a.publishedAt)].filter(Boolean).join(" · ");
      const tag = document.createElement("span");
      tag.className = "mood-tag hidden";
      tag.dataset.index = i;
      meta.appendChild(tag);

      const h = document.createElement("h4");
      const link = document.createElement("a");
      link.href = safeUrl(a.url) || "#";
      link.target = "_blank"; link.rel = "noopener";
      link.textContent = a.title;
      h.appendChild(link);

      const p = document.createElement("p");
      p.className = "muted small";
      p.textContent = a.description;

      const actions = document.createElement("div");
      actions.className = "news-actions";
      const listen = document.createElement("button");
      listen.type = "button";
      listen.className = "ghost small-btn";
      listen.innerHTML = (typeof ICONS !== "undefined" ? ICONS.speaker : "") + "Listen";
      listen.addEventListener("click", () => {
        if (!("speechSynthesis" in window)) return;
        speechSynthesis.cancel();
        speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(a.title + ". " + a.description), { lang: "en-US" }));
      });
      actions.appendChild(listen);

      body.append(meta, h, p, actions);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  /* ---------- AI news mood (uses the same in-browser model as the Tracker) ---------- */
  function resetMood() {
    ["moodPos", "moodNeu", "moodNeg"].forEach((id) => ($(id).style.width = "0"));
    $("newsMoodText").textContent = "Run the AI over these headlines to see whether the news sounds positive, neutral or negative.";
    $("newsAiBtn").textContent = "Analyse with AI";
  }

  $("newsAiBtn").addEventListener("click", async () => {
    const btn = $("newsAiBtn");
    if (!news.articles.length) return;
    if (!window.FinAI) { $("newsMoodText").textContent = "The AI engine is still loading — try again in a moment."; return; }
    btn.disabled = true;
    try {
      btn.textContent = "Loading model…";
      await window.FinAI.load((pct) => { btn.textContent = "Downloading model… " + pct + "%"; });
      btn.textContent = "Reading headlines…";
      const results = await window.FinAI.classify(news.articles.map((a) => a.title));
      const counts = { pos: 0, neu: 0, neg: 0 };
      results.forEach((r, i) => {
        const kind = r.score > 0.15 ? "pos" : r.score < -0.15 ? "neg" : "neu";
        counts[kind]++;
        const tag = document.querySelector('.mood-tag[data-index="' + i + '"]');
        if (tag) {
          tag.textContent = kind === "pos" ? "Positive" : kind === "neg" ? "Negative" : "Neutral";
          tag.className = "mood-tag " + kind;
        }
      });
      const n = results.length;
      $("moodPos").style.width = (counts.pos / n) * 100 + "%";
      $("moodNeu").style.width = (counts.neu / n) * 100 + "%";
      $("moodNeg").style.width = (counts.neg / n) * 100 + "%";
      const overall = counts.pos > counts.neg + 1 ? "mostly positive" : counts.neg > counts.pos + 1 ? "mostly negative" : "mixed";
      $("newsMoodText").textContent = "The AI read " + n + " headlines: " + counts.pos + " positive, " + counts.neu +
        " neutral, " + counts.neg + " negative. Overall the news feels " + overall + ".";
      btn.textContent = "Done — run again";
    } catch (err) {
      console.error(err);
      $("newsMoodText").textContent = "The AI model couldn't load right now. Headlines still work.";
      btn.textContent = "Try again";
    }
    btn.disabled = false;
  });

  /* ---------- controls ---------- */
  $("newsRegion").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#newsRegion button").forEach((x) => x.classList.toggle("active", x === b));
    news.country = b.dataset.country;
    if (news.q) return; // region only applies to top headlines
    loadNews();
  });

  $("newsTopics").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#newsTopics .chip").forEach((x) => x.classList.toggle("active", x === b));
    news.q = b.dataset.q || "";
    if (b.dataset.category) news.category = b.dataset.category;
    $("newsQuery").value = news.q;
    loadNews();
  });

  $("newsSearch").addEventListener("submit", (e) => {
    e.preventDefault();
    news.q = $("newsQuery").value.trim();
    document.querySelectorAll("#newsTopics .chip").forEach((x) => x.classList.remove("active"));
    loadNews();
  });

  // Only call the API when the tab is first opened (saves the daily request limit)
  window.addEventListener("tabchange", (e) => {
    if (e.detail === "news" && !news.loadedOnce) { news.loadedOnce = true; loadNews(); }
  });
})();
