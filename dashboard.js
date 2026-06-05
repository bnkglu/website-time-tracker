// Dashboard: aggregate tracked time across day / week / year and render
// stat cards, a time-trend bar chart, a category donut, top sites, and a
// category breakdown. Depends on categories.js (categoryOf, colorOf, ...).

let DATA = {};        // { "YYYY-MM-DD": { host: seconds } }
let HOURS = {};       // { "YYYY-MM-DD": [24 ints] }
let OVERRIDES = {};   // { host: category }

let period = "day";   // "day" | "week" | "year"
let anchor = new Date();

// ---- date helpers ----------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function startOfWeek(d) {
  const x = new Date(d);
  const off = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - off);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a, b) { return keyOf(a) === keyOf(b); }

function formatDur(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

// All day-keys covered by the current period.
function periodKeys() {
  if (period === "day") return [keyOf(anchor)];
  if (period === "week") {
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return keyOf(d);
    });
  }
  // year
  const y = anchor.getFullYear();
  const keys = [];
  const d = new Date(y, 0, 1);
  while (d.getFullYear() === y) {
    keys.push(keyOf(d));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

// ---- aggregation -----------------------------------------------------------

function aggregate() {
  const keys = periodKeys();
  const perHost = {};
  const perCat = {};
  const totalsByDay = {};
  let total = 0;
  let activeDays = 0;

  for (const k of keys) {
    const day = DATA[k];
    if (!day) continue;
    let dayTotal = 0;
    for (const [host, sec] of Object.entries(day)) {
      perHost[host] = (perHost[host] || 0) + sec;
      const cat = categoryOf(host, OVERRIDES);
      perCat[cat] = (perCat[cat] || 0) + sec;
      dayTotal += sec;
    }
    if (dayTotal > 0) {
      totalsByDay[k] = dayTotal;
      total += dayTotal;
      activeDays++;
    }
  }
  return { keys, perHost, perCat, totalsByDay, total, activeDays };
}

// Bar-chart buckets depend on the period.
function buildBuckets(agg) {
  if (period === "day") {
    const arr = HOURS[keyOf(anchor)] || new Array(24).fill(0);
    return arr.map((v, h) => ({
      value: v,
      x: h % 3 === 0 ? `${h}` : "",
      label: `${String(h).padStart(2, "0")}:00 · ${formatDur(v)}`,
    }));
  }
  if (period === "week") {
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      const v = agg.totalsByDay[keyOf(d)] || 0;
      return { value: v, x: DOW[i], label: `${DOW[i]} · ${formatDur(v)}` };
    });
  }
  // year -> 12 months
  const months = new Array(12).fill(0);
  for (const [k, v] of Object.entries(agg.totalsByDay)) {
    months[parseKey(k).getMonth()] += v;
  }
  return months.map((v, m) => ({
    value: v,
    x: MONTHS[m][0],
    label: `${MONTHS[m]} · ${formatDur(v)}`,
  }));
}

// ---- rendering -------------------------------------------------------------

function renderRangeLabel() {
  const el = document.getElementById("range-label");
  const now = new Date();
  if (period === "day") {
    if (sameDay(anchor, now)) el.textContent = "Today";
    else {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      el.textContent = sameDay(anchor, y)
        ? "Yesterday"
        : anchor.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
  } else if (period === "week") {
    const s = startOfWeek(anchor);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const opt = { month: "short", day: "numeric" };
    el.textContent = `${s.toLocaleDateString(undefined, opt)} – ${e.toLocaleDateString(undefined, opt)}, ${e.getFullYear()}`;
  } else {
    el.textContent = String(anchor.getFullYear());
  }

  // Disable "next" if we're already at the current period.
  const next = document.getElementById("next");
  if (period === "day") next.disabled = sameDay(anchor, now);
  else if (period === "week") next.disabled = startOfWeek(anchor).getTime() >= startOfWeek(now).getTime();
  else next.disabled = anchor.getFullYear() >= now.getFullYear();
}

function renderCards(agg) {
  const el = document.getElementById("cards");
  const cards = [];
  const topCat = Object.entries(agg.perCat).sort((a, b) => b[1] - a[1])[0];
  const topCatTxt = topCat ? topCat[0] : "—";

  cards.push({ k: "Total time", v: formatDur(agg.total) });

  if (period === "day") {
    cards.push({ k: "Sites visited", v: String(Object.keys(agg.perHost).length) });
    const hrs = HOURS[keyOf(anchor)] || [];
    let peak = -1, peakVal = 0;
    hrs.forEach((v, h) => { if (v > peakVal) { peakVal = v; peak = h; } });
    cards.push({ k: "Peak hour", v: peak >= 0 ? `${String(peak).padStart(2, "0")}:00` : "—" });
  } else {
    const avg = agg.activeDays ? agg.total / agg.activeDays : 0;
    cards.push({ k: "Daily average", v: formatDur(avg), sub: `${agg.activeDays} active days` });

    // Most active bucket.
    const buckets = buildBuckets(agg);
    let best = -1, bestVal = 0;
    buckets.forEach((b, i) => { if (b.value > bestVal) { bestVal = b.value; best = i; } });
    if (period === "week") {
      cards.push({ k: "Most active day", v: best >= 0 ? DOW[best] : "—", sub: formatDur(bestVal) });
    } else {
      cards.push({ k: "Most active month", v: best >= 0 ? MONTHS[best] : "—", sub: formatDur(bestVal) });
    }
  }

  cards.push({ k: "Top category", v: topCatTxt, sub: topCat ? formatDur(topCat[1]) : "" });

  el.innerHTML = "";
  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="k">${c.k}</div><div class="v">${c.v}${c.sub ? ` <small>${c.sub}</small>` : ""}</div>`;
    el.appendChild(div);
  }
}

function renderBarChart(agg) {
  const el = document.getElementById("bar-chart");
  const title = document.getElementById("trend-title");
  const sub = document.getElementById("trend-sub");
  title.textContent =
    period === "day" ? "Activity by hour"
    : period === "week" ? "Activity by day"
    : "Activity by month";

  const buckets = buildBuckets(agg);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  sub.textContent = `peak ${formatDur(max === 1 && agg.total === 0 ? 0 : max)}`;

  el.innerHTML = "";
  for (const b of buckets) {
    const col = document.createElement("div");
    col.className = "bar-col";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${(b.value / max) * 100}%`;
    bar.dataset.label = b.label;
    if (b.value === 0) bar.style.background = "var(--track)";
    const x = document.createElement("div");
    x.className = "bar-x";
    x.textContent = b.x;
    col.append(bar, x);
    el.appendChild(col);
  }
}

function renderDonut(agg) {
  const donut = document.getElementById("donut");
  const legend = document.getElementById("legend");
  const cats = CATEGORY_ORDER
    .map((c) => [c, agg.perCat[c] || 0])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  legend.innerHTML = "";

  if (!agg.total) {
    donut.style.background = "var(--track)";
    donut.dataset.center = "No data";
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "Nothing tracked yet.";
    legend.appendChild(li);
    return;
  }

  let acc = 0;
  const stops = [];
  for (const [cat, val] of cats) {
    const start = (acc / agg.total) * 360;
    acc += val;
    const end = (acc / agg.total) * 360;
    stops.push(`${colorOf(cat)} ${start}deg ${end}deg`);
  }
  donut.style.background = `conic-gradient(${stops.join(", ")})`;
  donut.dataset.center = `${formatDur(agg.total)}\n${cats.length} cats`;

  for (const [cat, val] of cats) {
    const li = document.createElement("li");
    const pct = Math.round((val / agg.total) * 100);
    li.innerHTML =
      `<span class="dot" style="background:${colorOf(cat)}"></span>` +
      `<span class="lname">${cat}</span>` +
      `<span class="lval">${formatDur(val)} · ${pct}%</span>`;
    legend.appendChild(li);
  }
}

function renderSites(agg) {
  const el = document.getElementById("sites");
  const entries = Object.entries(agg.perHost).sort((a, b) => b[1] - a[1]).slice(0, 25);
  el.innerHTML = "";
  if (!entries.length) {
    el.innerHTML = `<li class="empty">No sites tracked in this period.</li>`;
    return;
  }
  const max = entries[0][1];
  entries.forEach(([host, sec], i) => {
    const cat = categoryOf(host, OVERRIDES);
    const li = document.createElement("li");

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = i + 1;

    const main = document.createElement("div");
    main.className = "site-main";
    const h = document.createElement("div");
    h.className = "site-host";
    h.textContent = host;
    h.title = host;
    const bar = document.createElement("div");
    bar.className = "site-bar";
    const fill = document.createElement("div");
    fill.className = "site-fill";
    fill.style.width = `${(sec / max) * 100}%`;
    fill.style.background = colorOf(cat);
    bar.appendChild(fill);
    main.append(h, bar);

    const sel = document.createElement("select");
    sel.className = "cat-tag";
    sel.style.appearance = "none";
    sel.style.background = colorOf(cat);
    sel.title = "Recategorize this site";
    for (const c of CATEGORY_ORDER) {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      if (c === cat) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", async () => {
      OVERRIDES[normalizeHost(host)] = sel.value;
      await chrome.storage.local.set({ categories: OVERRIDES });
      render();
    });

    const time = document.createElement("div");
    time.className = "site-time";
    time.textContent = formatDur(sec);

    li.append(rank, main, sel, time);
    el.appendChild(li);
  });
}

function renderCatList(agg) {
  const el = document.getElementById("catlist");
  const cats = CATEGORY_ORDER
    .map((c) => [c, agg.perCat[c] || 0])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  el.innerHTML = "";
  if (!cats.length) {
    el.innerHTML = `<li class="empty">No categories yet.</li>`;
    return;
  }
  const max = cats[0][1];
  for (const [cat, val] of cats) {
    const pct = agg.total ? Math.round((val / agg.total) * 100) : 0;
    const li = document.createElement("li");
    li.innerHTML =
      `<div class="cat-top">` +
        `<span class="cat-name"><span class="dot" style="width:10px;height:10px;border-radius:3px;background:${colorOf(cat)}"></span>${cat}</span>` +
        `<span class="cat-meta">${formatDur(val)} · ${pct}%</span>` +
      `</div>` +
      `<div class="cat-track"><div class="cat-fill" style="width:${(val / max) * 100}%;background:${colorOf(cat)}"></div></div>`;
    el.appendChild(li);
  }
}

function render() {
  const agg = aggregate();
  renderRangeLabel();
  renderCards(agg);
  renderBarChart(agg);
  renderDonut(agg);
  renderSites(agg);
  renderCatList(agg);
}

// ---- controls --------------------------------------------------------------

function shiftAnchor(dir) {
  const d = new Date(anchor);
  if (period === "day") d.setDate(d.getDate() + dir);
  else if (period === "week") d.setDate(d.getDate() + 7 * dir);
  else d.setFullYear(d.getFullYear() + dir);
  anchor = d;
  render();
}

document.getElementById("period-seg").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-period]");
  if (!btn) return;
  period = btn.dataset.period;
  document.querySelectorAll("#period-seg button").forEach((b) => b.classList.toggle("active", b === btn));
  render();
});
document.getElementById("prev").addEventListener("click", () => shiftAnchor(-1));
document.getElementById("next").addEventListener("click", () => shiftAnchor(1));
document.getElementById("today-btn").addEventListener("click", () => { anchor = new Date(); render(); });

document.getElementById("export").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(["data", "hours", "categories"]);
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `time-tracker-${keyOf(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("reset-all").addEventListener("click", async () => {
  if (!confirm("Delete ALL tracked time? (Your category assignments are kept.)")) return;
  DATA = {}; HOURS = {};
  await chrome.storage.local.set({ data: {}, hours: {} });
  render();
});

// ---- boot ------------------------------------------------------------------

(async function init() {
  const stored = await chrome.storage.local.get(["data", "hours", "categories"]);
  DATA = stored.data || {};
  HOURS = stored.hours || {};
  OVERRIDES = stored.categories || {};
  render();
})();

// Live-update if tracking writes while the dashboard is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.data) DATA = changes.data.newValue || {};
  if (changes.hours) HOURS = changes.hours.newValue || {};
  if (changes.categories) OVERRIDES = changes.categories.newValue || {};
  render();
});
