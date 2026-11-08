/* =========================================================
   Netlify Function: /.netlify/functions/news
   ---------------------------------------------------------
   Runs on Netlify's server (not in the browser), so it can read
   the NewsAPI key from the site's environment variables and keep
   it secret. The page calls this function; this function calls
   NewsAPI and returns a trimmed list of articles.

   Query parameters:
     category = business | technology | general   (top headlines)
     country  = us | in                            (top headlines)
     q        = search words                       (switches to "everything")
   ========================================================= */

const ALLOWED_CATEGORIES = ["business", "technology", "general", "science", "health"];
const ALLOWED_COUNTRIES = ["us", "in", "gb"];

// Accept the common spellings, so the variable name in Netlify doesn't have to be exact
function getKey() {
  return (
    process.env.NEWS_API_KEY ||
    process.env.NEWSAPI_KEY ||
    process.env.NEWSAPI ||
    process.env.NEWS_API ||
    ""
  ).trim();
}

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });

export default async (req) => {
  const key = getKey();
  if (!key) {
    return json({ error: "News API key is not set on the server. Add NEWS_API_KEY in Netlify → Site configuration → Environment variables, then redeploy." }, 500);
  }

  const params = new URL(req.url).searchParams;
  const q = (params.get("q") || "").trim().slice(0, 100);
  const category = ALLOWED_CATEGORIES.includes(params.get("category")) ? params.get("category") : "business";
  const country = ALLOWED_COUNTRIES.includes(params.get("country")) ? params.get("country") : "us";

  let url;
  if (q) {
    url = "https://newsapi.org/v2/everything?" + new URLSearchParams({
      q, language: "en", sortBy: "publishedAt", pageSize: "24",
    });
  } else {
    url = "https://newsapi.org/v2/top-headlines?" + new URLSearchParams({
      category, country, pageSize: "24",
    });
  }

  try {
    const res = await fetch(url, { headers: { "X-Api-Key": key, "User-Agent": "FinTracker/1.0" } });
    const data = await res.json();
    if (data.status !== "ok") {
      return json({ error: data.message || "NewsAPI returned an error.", code: data.code }, res.status === 200 ? 502 : res.status);
    }
    const articles = (data.articles || [])
      .filter((a) => a.title && a.title !== "[Removed]" && a.url)
      .map((a) => ({
        title: a.title,
        description: a.description || "",
        url: a.url,
        image: a.urlToImage || "",
        source: (a.source && a.source.name) || "",
        publishedAt: a.publishedAt,
      }));
    // Cache for 10 minutes so repeat visits don't use up the daily request limit
    return json({ articles, mode: q ? "search" : "headlines" }, 200, { "Cache-Control": "public, max-age=600" });
  } catch (err) {
    return json({ error: "Couldn't reach NewsAPI: " + err.message }, 502);
  }
};
