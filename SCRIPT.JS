const API_KEY = '5B12JP4JFB2OW5F6'; // Replace with your Alpha Vantage API key
const chartEl = document.getElementById('stockChart').getContext('2d');
let chart;

function fetchStock() {
  const ticker = document.getElementById("tickerInput").value.toUpperCase();
  if (!ticker) return alert("Please enter a stock symbol!");

  saveRecentSearch(ticker);
  getStockData(ticker);
  fetchNews(ticker);

}

function saveRecentSearch(ticker) {
  let recent = JSON.parse(localStorage.getItem("recent")) || [];
  if (!recent.includes(ticker)) {
    recent.unshift(ticker);
    if (recent.length > 5) recent.pop();
    localStorage.setItem("recent", JSON.stringify(recent));
  }
  renderRecentList();
}

function renderRecentList() {
  const list = document.getElementById("recentList");
  list.innerHTML = "";
  (JSON.parse(localStorage.getItem("recent")) || []).forEach(ticker => {
    const li = document.createElement("li");
    li.textContent = ticker;
    li.onclick = () => {
      document.getElementById("tickerInput").value = ticker;
      fetchStock();
    };
    list.appendChild(li);
  });
}

async function getStockData(ticker) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    const timeSeries = data["Time Series (Daily)"];
    const dates = Object.keys(timeSeries).slice(0, 5).reverse();
    const prices = dates.map(date => parseFloat(timeSeries[date]["4. close"]));
    const open = parseFloat(timeSeries[dates[0]]["1. open"]);
    const close = parseFloat(timeSeries[dates[dates.length - 1]]["4. close"]);

    updateChart(dates, prices);
    updateVolatility(open, close);
  } catch (err) {
    alert("Failed to fetch data.");
    console.error(err);
  }
}

function updateChart(labels, data) {
  if (chart) chart.destroy();
  chart = new Chart(chartEl, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Stock Price",
        data: data,
        borderColor: "#1f8ef1",
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function updateVolatility(open, close) {
  const change = Math.abs(open - close) / open;
  const tag = document.getElementById("volatilityTag");
  if (change > 0.03) tag.textContent = "⚠️ High Volatility";
  else if (change > 0.01) tag.textContent = "↔️ Moderate Volatility";
  else tag.textContent = "✔️ Stable";
}

renderRecentList();

const NEWS_API_KEY = 'e573787fa4ac411f9d617ab09371fdda'; // replace this with your key

async function fetchNews(ticker) {
  const url = `https://newsapi.org/v2/everything?q=${ticker}&apiKey=${NEWS_API_KEY}&pageSize=5&sortBy=publishedAt`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const articles = data.articles;

    const newsDiv = document.getElementById("newsContainer");
    newsDiv.innerHTML = "";

    if (articles.length === 0) {
      newsDiv.innerHTML = "<p>No news found.</p>";
      return;
    }

    articles.forEach(article => {
      const card = document.createElement("div");
      card.style.border = "1px solid #333";
      card.style.margin = "10px";
      card.style.padding = "10px";
      card.style.borderRadius = "6px";
      card.innerHTML = `
        <h4>${article.title}</h4>
        <p>${article.description || 'No summary available'}</p>
        <a href="${article.url}" target="_blank">Read more</a>
      `;
      newsDiv.appendChild(card);
    });
  } catch (err) {
    console.error("News fetch failed", err);
  }
}
