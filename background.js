// Website Time Tracker — background service worker (MV3)
//
// Strategy: we keep a single "active session" = { host, start } in
// chrome.storage.local. Whenever the active site might have changed (tab
// switch, navigation, window focus, idle), we flush the elapsed time of the
// current session into the per-day totals, then open a fresh session for the
// new site. A periodic alarm also flushes so long-running sessions are not
// lost if the service worker is suspended.

const IDLE_SECONDS = 60; // consider the user idle after 60s of no input
const FLUSH_ALARM = "wtt-flush";

// ---- helpers ---------------------------------------------------------------

function todayKey() {
  // Local date as YYYY-MM-DD.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hostFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Only track real web pages; skip chrome://, about:, extensions, files, etc.
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname || null;
  } catch {
    return null;
  }
}

async function getSession() {
  const { session } = await chrome.storage.local.get("session");
  return session || null;
}

async function setSession(session) {
  await chrome.storage.local.set({ session });
}

// Commit the elapsed time of the current session into the daily totals and
// reset the session's clock to now (keeping the same host).
async function flush() {
  const session = await getSession();
  if (!session || !session.host) return;

  const now = Date.now();
  const elapsedMs = now - session.start;
  if (elapsedMs <= 0) return;

  const elapsedSec = Math.round(elapsedMs / 1000);
  if (elapsedSec > 0) {
    const day = todayKey();
    const { data, hours } = await chrome.storage.local.get(["data", "hours"]);

    // Per-day, per-host totals.
    const store = data || {};
    if (!store[day]) store[day] = {};
    store[day][session.host] = (store[day][session.host] || 0) + elapsedSec;

    // Per-day, per-host, 24-slot hourly activity (powers the day-view chart and
    // hour-interval drill-down). We attribute the whole flush to the current
    // hour; flushes happen <=30s apart so the boundary error is negligible.
    const hourStore = hours || {};
    let dayHours = hourStore[day];
    // Migrate the old shape (a bare 24-int array) into the new {host:[24]} map,
    // preserving past totals under a synthetic "(earlier)" key.
    if (Array.isArray(dayHours)) {
      dayHours = { "(earlier)": dayHours };
    } else if (!dayHours) {
      dayHours = {};
    }
    if (!dayHours[session.host]) dayHours[session.host] = new Array(24).fill(0);
    dayHours[session.host][new Date().getHours()] += elapsedSec;
    hourStore[day] = dayHours;

    await chrome.storage.local.set({ data: store, hours: hourStore });
  }

  // Reset the session clock so the just-counted time isn't counted again.
  await setSession({ host: session.host, start: now });
}

// Flush the old session, then begin tracking `host` (or stop if null).
async function switchTo(host) {
  await flush();
  if (host) {
    await setSession({ host, start: Date.now() });
  } else {
    await setSession(null);
  }
}

// Figure out which host (if any) we should currently be tracking, taking
// window focus, idle state, and media playback into account.
async function resync() {
  // Which browser window currently has OS focus (or last did)?
  let win = null;
  try {
    win = await chrome.windows.getLastFocused();
  } catch {
    win = null;
  }
  const browserFocused = !!(win && win.focused);

  // The active tab in that window.
  let tab;
  try {
    const query = win
      ? { active: true, windowId: win.id }
      : { active: true, lastFocusedWindow: true };
    const tabs = await chrome.tabs.query(query);
    tab = tabs[0];
  } catch {
    tab = undefined;
  }

  const host = tab ? hostFromUrl(tab.url) : null;
  if (!host) {
    await switchTo(null);
    return;
  }

  const userActive = (await chrome.idle.queryState(IDLE_SECONDS)) === "active";
  const audible = !!tab.audible;

  // Count while you're actively viewing the page (browser focused + not idle),
  // OR while the page is playing sound — so movies/music aren't lost to the
  // idle timeout. A muted/silent video can't be detected and still pauses.
  const shouldCount = (browserFocused && userActive) || audible;
  await switchTo(shouldCount ? host : null);
}

// ---- event wiring ----------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.5 });
  resync();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.5 });
  resync();
});

// User switched to a different tab.
chrome.tabs.onActivated.addListener(() => resync());

// A tab finished loading, changed its URL, or started/stopped playing sound.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete" || changeInfo.audible !== undefined) {
    if (tab && tab.active) resync();
  }
});

// Switched browser windows (or focus left the browser entirely).
chrome.windows.onFocusChanged.addListener(() => resync());

// User became idle/active or locked/unlocked the machine.
chrome.idle.onStateChanged.addListener(() => resync());

// Periodic flush so long sessions survive service-worker suspension.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) flush();
});
