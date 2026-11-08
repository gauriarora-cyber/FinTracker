/* =========================================================
   FinTracker — "Start Early" tab
   Weather guide, savings jar calculator (₹), quiz, word bank.
   Uses WEATHER_TYPES and helpers from script.js.
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const rupees = (n) => "₹" + Math.round(n).toLocaleString("en-IN"); // Indian grouping: ₹1,00,000

  /* ---------- 1. Weather guide ---------- */
  const guide = $("weatherGuide");
  Object.values(WEATHER_TYPES).forEach((w) => {
    const card = document.createElement("div");
    card.className = "guide-item";
    const icon = document.createElement("div");
    icon.className = "guide-icon";
    icon.textContent = w.icon;
    const body = document.createElement("div");
    const h = document.createElement("h4");
    h.textContent = w.title;
    const p1 = document.createElement("p");
    p1.textContent = w.meaning;
    const p2 = document.createElement("p");
    p2.className = "muted small";
    p2.textContent = "🌱 " + w.lesson;
    body.append(h, p1, p2);
    card.append(icon, body);
    guide.appendChild(card);
  });

  /* ---------- 2. Savings jar calculator ----------
     Each month: add the saving, then the jar grows by (yearly rate / 12).
     This is how a recurring deposit or SIP grows (compounding).        */
  let jarChart = null;

  function calcJar() {
    const monthly = Math.max(0, +$("jarMonthly").value || 0);
    const start = Math.max(1, +$("jarStart").value || 1);
    const end = Math.max(start + 1, +$("jarEnd").value || start + 1);
    const yearlyRate = +$("jarRate").value / 100;
    const r = yearlyRate / 12;

    let total = 0, paid = 0;
    const ages = [], paidLine = [], totalLine = [];
    for (let age = start; age < end; age++) {
      for (let m = 0; m < 12; m++) {
        total = (total + monthly) * (1 + r);
        paid += monthly;
      }
      ages.push(age + 1);
      paidLine.push(Math.round(paid));
      totalLine.push(Math.round(total));
    }

    $("jarPaid").textContent = rupees(paid);
    $("jarGrowth").textContent = rupees(total - paid);
    $("jarTotal").textContent = rupees(total);

    const years = end - start;
    const growthShare = total > 0 ? Math.round(((total - paid) / total) * 100) : 0;
    $("jarLesson").textContent = yearlyRate === 0
      ? "A piggy bank keeps your money safe, but it never grows. Prices of things usually rise every year (inflation), so the same money buys a little less later."
      : "In " + years + " years, " + growthShare + "% of your jar is growth you didn't put in yourself. That's compounding: growth earning more growth. Starting early gives it more years to work.";

    drawJarChart(ages, paidLine, totalLine);
  }

  function drawJarChart(labels, paid, total) {
    if (typeof Chart === "undefined") return;
    const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    if (jarChart) jarChart.destroy();
    jarChart = new Chart($("jarChart"), {
      type: "bar",
      data: {
        labels: labels.map((a) => "Age " + a),
        datasets: [
          { label: "You put in", data: paid, backgroundColor: css("--accent") },
          { label: "Growth", data: total.map((t, i) => t - paid[i]), backgroundColor: css("--up") },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: css("--muted") } },
          tooltip: { callbacks: { label: (c) => " " + c.dataset.label + ": " + rupees(c.parsed.y) } },
        },
        scales: {
          x: { stacked: true, ticks: { color: css("--muted"), maxTicksLimit: 8 }, grid: { display: false } },
          y: { stacked: true, ticks: { color: css("--muted"), callback: (v) => rupees(v) }, grid: { color: css("--border") } },
        },
      },
    });
  }

  ["jarMonthly", "jarStart", "jarEnd", "jarRate"].forEach((id) => $(id).addEventListener("input", calcJar));
  // Chart needs a visible canvas to size itself, so draw when the tab opens
  window.addEventListener("tabchange", (e) => { if (e.detail === "learn") calcJar(); });
  $("themeSelect").addEventListener("change", () => { if (!$("tab-learn").classList.contains("hidden")) calcJar(); });

  /* ---------- 3. Quiz ---------- */
  const QUIZ = [
    { q: "You save ₹100 every month. Which grows more over 10 years?",
      options: ["A piggy bank", "A deposit that earns interest"], answer: 1,
      why: "Interest adds money on top of what you saved, and then that interest earns interest too." },
    { q: "A stock's weather is ⛈️ Stormy. What does that tell you?",
      options: ["Its price is swinging a lot", "It will definitely go down tomorrow"], answer: 0,
      why: "Stormy means high volatility — big ups and downs. Nobody knows tomorrow's price." },
    { q: "What does 'diversification' mean?",
      options: ["Putting all your money in one company you like", "Spreading money across many different things"], answer: 1,
      why: "If one thing has a bad year, the others can balance it out. Don't put all your eggs in one basket." },
    { q: "Someone online promises to 'double your money in a week, guaranteed'. What should you do?",
      options: ["Send them your pocket money quickly", "Don't send anything and tell an adult"], answer: 1,
      why: "Real investments never guarantee quick doubling. This is how scams work." },
    { q: "Why does starting early help so much?",
      options: ["Compounding gets more years to grow your money", "Young people get special higher prices"], answer: 0,
      why: "Time is the secret ingredient: growth earns more growth every year it's left alone." },
  ];

  const quizBox = $("quiz");
  let correct = 0, answered = 0;
  QUIZ.forEach((item, qi) => {
    const block = document.createElement("div");
    block.className = "quiz-item";
    const q = document.createElement("p");
    q.className = "quiz-q";
    q.textContent = qi + 1 + ". " + item.q;
    const opts = document.createElement("div");
    opts.className = "quiz-options";
    const feedback = document.createElement("p");
    feedback.className = "small muted";

    item.options.forEach((text, oi) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ghost";
      b.textContent = text;
      b.addEventListener("click", () => {
        if (block.dataset.done) return;
        block.dataset.done = "1";
        answered++;
        const right = oi === item.answer;
        if (right) correct++;
        b.classList.add(right ? "right" : "wrong");
        opts.children[item.answer].classList.add("right");
        feedback.textContent = (right ? "✅ Correct! " : "❌ Not quite. ") + item.why;
        if (answered === QUIZ.length) {
          $("quizScore").textContent = "You scored " + correct + " / " + QUIZ.length + ". " +
            (correct === QUIZ.length ? "Money master! 🏆" : "Great start — try the savings jar to explore more.");
        }
      });
      opts.appendChild(b);
    });
    block.append(q, opts, feedback);
    quizBox.appendChild(block);
  });

  /* ---------- 4. Word bank ---------- */
  const WORDS = [
    ["Share / stock", "A tiny piece of a company. Own a share and you own a small part of that company."],
    ["Interest", "Extra money a bank pays you for keeping your savings with them."],
    ["Compounding", "When your growth also starts growing. ₹100 earns ₹7, then ₹107 earns a bit more next year."],
    ["Inflation", "Prices of things slowly going up over time, so money buys a little less each year."],
    ["Volatility", "How much a price jumps up and down. High volatility = a bumpy ride."],
    ["Diversification", "Spreading money over many different things so one bad result doesn't hurt too much."],
    ["Index fund", "A basket that holds many companies at once, like the top 50 in India (Nifty 50)."],
    ["SIP", "Systematic Investment Plan: putting a fixed amount in every month, like a savings habit."],
    ["Emergency fund", "Money kept aside for surprises, before anything is invested."],
  ];
  const gl = $("glossary");
  WORDS.forEach(([term, def]) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = def;
    gl.append(dt, dd);
  });

  calcJar(); // fill numbers even before the tab is opened
})();
