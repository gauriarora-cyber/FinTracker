/* =========================================================
   FinTracker — visual extras
   1. Line icons (replace emoji for a cleaner, professional look)
   2. Weather icons for the market weather report
   3. Floating background symbols — a different style per theme
   Loaded before script.js. Everything here is decoration only.
   ========================================================= */

/* ---------- 1. Icons (stroke icons, inherit text colour) ---------- */
const svg = (inner, size = 18) =>
  '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";

const ICONS = {
  chart:   svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
  sprout:  svg('<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/>'),
  key:     svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M17 6l3 3"/>'),
  ai:      svg('<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 3v4"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/><path d="M2 12v3M22 12v3"/>'),
  news:    svg('<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2"/><path d="M7 8h7M7 12h7M7 16h4"/>'),
  stop:    svg('<rect x="6" y="6" width="12" height="12" rx="2"/>', 14),
  bolt:    svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  speaker: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/>'),
  cloudsun:svg('<path d="M12 3v1M5.6 5.6l.7.7M3 12h1M18.4 5.6l-.7.7"/><path d="M8 11a4 4 0 0 1 7.5-2"/><path d="M7 19h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.5A3 3 0 0 0 7 19z"/>'),
  globe:   svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>', 16),
  // theme modes
  auto:    svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>', 16),
  sun:     svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 16),
  moon:    svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', 16),
  eye:     svg('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>', 16),
};

function applyIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (ICONS[el.dataset.icon]) el.innerHTML = ICONS[el.dataset.icon];
  });
}

/* ---------- 2. Weather icons (filled, coloured) ---------- */
const CLOUD = '<path d="M20 46h26a10 10 0 0 0 0-20 14 14 0 0 0-27 3.5A8.5 8.5 0 0 0 20 46z" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5"/>';
const WEATHER_SVG = {
  sunny:
    '<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><g stroke="#f59e0b" stroke-width="3" stroke-linecap="round">' +
    '<path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/></g>' +
    '<circle cx="32" cy="32" r="12" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/></svg>',
  cloudy:
    '<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><circle cx="24" cy="22" r="9" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>' + CLOUD + "</svg>",
  rainy:
    '<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">' + CLOUD.replace("#cbd5e1", "#a5b4c8") +
    '<g stroke="#3b82f6" stroke-width="3" stroke-linecap="round"><path d="M22 51l-2 6M32 51l-2 6M42 51l-2 6"/></g></svg>',
  stormy:
    '<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">' + CLOUD.replace("#cbd5e1", "#7c8799").replace("#94a3b8", "#5b6475") +
    '<path d="M33 44l-6 10h6l-3 8 10-12h-6l3-6z" fill="#facc15" stroke="#eab308" stroke-width="1.2" stroke-linejoin="round"/></svg>',
};

/* ---------- 3. Floating background symbols ----------
   dark  : glowing currency signs drifting upward
   light : soft mini charts (bars, lines, candles) floating up
   warm  : gold ₹ coins gently falling and spinning
   auto  : follows light or dark, plus a sun or moon drifting by */
const MINI_CHARTS = [
  '<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M5 26V16M12 26V10M19 26V14M26 26V6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M3 24l8-8 6 5 12-13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 8h7v7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M9 4v24M23 8v20" stroke="currentColor" stroke-width="2"/><rect x="5" y="9" width="8" height="12" rx="1.5" fill="currentColor"/><rect x="19" y="12" width="8" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  '<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 4v12l9 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
];
const COIN = '<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="14" fill="#f2c14e" stroke="#c98a1b" stroke-width="2"/><circle cx="16" cy="16" r="10" fill="none" stroke="#c98a1b" stroke-width="1.2" stroke-dasharray="2 2"/><text x="16" y="21.5" text-anchor="middle" font-size="15" font-weight="700" fill="#9a6412" font-family="sans-serif">₹</text></svg>';
const CURRENCIES = ["₹", "$", "€", "£", "¥", "₿", "%", "₹", "$"];

function buildFloaters(mode, theme) {
  let box = document.getElementById("bgFloat");
  if (!box) {
    box = document.createElement("div");
    box.id = "bgFloat";
    box.setAttribute("aria-hidden", "true");
    document.body.prepend(box);
  }
  box.innerHTML = "";
  box.className = "bg-float bg-" + theme + (mode === "auto" ? " bg-auto" : "");

  const count = window.innerWidth < 600 ? 12 : 22;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "floater";
    const size = theme === "dark" ? 16 + Math.random() * 26 : 18 + Math.random() * 22;
    if (theme === "dark") el.textContent = CURRENCIES[i % CURRENCIES.length];
    else if (theme === "light") el.innerHTML = MINI_CHARTS[i % MINI_CHARTS.length];
    else el.innerHTML = COIN;
    el.style.left = Math.random() * 100 + "%";
    el.style.setProperty("--size", size + "px");
    el.style.setProperty("--drift", (Math.random() * 80 - 40).toFixed(0) + "px");
    el.style.setProperty("--spin", (Math.random() * 360 - 180).toFixed(0) + "deg");
    el.style.animationDuration = 18 + Math.random() * 22 + "s";
    el.style.animationDelay = -Math.random() * 40 + "s";
    box.appendChild(el);
  }
  // Auto mode: one sun (day) or moon (night) slowly crossing the sky
  if (mode === "auto") {
    const sky = document.createElement("span");
    sky.className = "sky-body";
    sky.innerHTML = theme === "light" ? ICONS.sun : ICONS.moon;
    box.appendChild(sky);
  }
}

window.addEventListener("themechange", (e) => buildFloaters(e.detail.choice, e.detail.theme));
applyIcons();
