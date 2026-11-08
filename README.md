# 📈 FinTracker

**FinTracker** shows a stock's price trend, a volatility score and the sentiment of recent news, all on one screen.
It was built for the **Call2Code Hackathon** and includes **text-to-speech** so that news can be listened to.

🔗 **Live demo:** https://fintracker-demo.netlify.app/

![FinTracker dashboard](screenshots/dashboard.png)

---

## ✨ Features

| Feature | How it works |
|---|---|
| 📊 **Price trend (7D / 30D / 90D)** | Daily prices from Alpha Vantage, drawn with Chart.js. Shows period high, low, return and average volume |
| ⚡ **Volatility score** | Standard deviation of daily returns, annualised (× √252). Labelled Low / Moderate / High |
| 🧠 **News sentiment** | Alpha Vantage *News & Sentiment* gives a score from −1 (bearish) to +1 (bullish) for each article. FinTracker averages them on a meter |
| 🎤 **Listen to news** | The Web Speech API reads each headline and summary aloud |
| 🔁 **Recent & popular symbols** | One-click chips. Recent searches are saved in the browser |
| 🌓 **Themes** | Dark, light, eye comfort, or **auto** (light during the day, dark at night, based on the device clock) |
| 🌐 **Multilingual** | Google Translate widget |
| 🧪 **Sample-data fallback** | If the free API limit is reached, the app shows clearly labelled sample data instead of breaking |

## 🔑 API key

The first time someone searches, FinTracker asks:

1. **"Do you have your own Alpha Vantage key?"** If yes, it's saved only in that visitor's browser.
2. **If not**, it uses the shared demo key in `config.js`.

> Free Alpha Vantage keys allow about 25 requests a day. Each search uses 2 requests (prices + news).
> Get a free key at https://www.alphavantage.co/support/#api-key

## 🧠 Tech stack

- HTML, CSS (theme variables), vanilla JavaScript
- [Chart.js](https://www.chartjs.org/) for charts
- [Alpha Vantage](https://www.alphavantage.co/) for daily prices and news sentiment
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for text-to-speech

## 📁 Project structure

```
index.html   page layout and API-key dialog
style.css    themes and responsive layout
config.js    default (demo) API key
script.js    data fetching, calculations, chart, news, speech
screenshots/ README images
```

## 🛠️ Run locally

Download the repo (Code → Download ZIP), unzip it and open `index.html` in a browser.
No build step is needed.

---

*For learning purposes only. This is not financial advice.*
