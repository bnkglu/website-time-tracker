// Popup: show per-site time for a selected day.

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function labelForDay(key) {
  if (key === todayKey()) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (key === yk) return "Yesterday";
  return key;
}

const listEl = document.getElementById("list");
const totalEl = document.getElementById("total");
const selectEl = document.getElementById("day-select");
const resetBtn = document.getElementById("reset");

let OVERRIDES = {};

async function getData() {
  const { data, categories } = await chrome.storage.local.get(["data", "categories"]);
  OVERRIDES = categories || {};
  return data || {};
}

function render(dayData) {
  const overrides = OVERRIDES;
  const entries = Object.entries(dayData || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, sec]) => sum + sec, 0);
  const max = entries.length ? entries[0][1] : 0;

  totalEl.innerHTML = `Total: <strong>${formatDuration(total)}</strong>`;

  listEl.innerHTML = "";
  if (!entries.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No activity recorded for this day.";
    listEl.appendChild(li);
    return;
  }

  for (const [host, sec] of entries) {
    const li = document.createElement("li");

    const top = document.createElement("div");
    top.className = "row-top";

    const cat = categoryOf(host, overrides);

    const hostEl = document.createElement("span");
    hostEl.className = "host";
    const dot = document.createElement("span");
    dot.className = "cat-dot";
    dot.style.background = colorOf(cat);
    dot.title = cat;
    const name = document.createElement("span");
    name.textContent = host;
    hostEl.append(dot, name);
    hostEl.title = `${host} · ${cat}`;

    const timeEl = document.createElement("span");
    timeEl.className = "time";
    timeEl.textContent = formatDuration(sec);

    top.append(hostEl, timeEl);

    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = max > 0 ? `${(sec / max) * 100}%` : "0%";
    track.appendChild(fill);

    li.append(top, track);
    listEl.appendChild(li);
  }
}

async function refresh() {
  const data = await getData();
  const days = Object.keys(data).sort().reverse();

  // Always offer today, even with no data yet.
  if (!days.includes(todayKey())) days.unshift(todayKey());

  const prev = selectEl.value;
  selectEl.innerHTML = "";
  for (const key of days) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = labelForDay(key);
    selectEl.appendChild(opt);
  }
  selectEl.value = days.includes(prev) ? prev : days[0];

  render(data[selectEl.value] || {});
}

selectEl.addEventListener("change", async () => {
  const data = await getData();
  render(data[selectEl.value] || {});
});

resetBtn.addEventListener("click", async () => {
  const day = selectEl.value;
  if (!confirm(`Delete tracked time for ${labelForDay(day)}?`)) return;
  const data = await getData();
  delete data[day];
  await chrome.storage.local.set({ data });
  refresh();
});

document.getElementById("dashboard").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

refresh();
