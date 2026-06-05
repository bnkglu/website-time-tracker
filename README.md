# Website Time Tracker

A lightweight, **privacy-first** Chrome / Brave / Edge extension (Manifest V3)
that tracks how much time you spend on each website, with a full day / week /
year analytics dashboard. **All data stays on your machine — nothing is ever
sent anywhere.**

> Works in any Chromium browser (Chrome, Brave, Edge, Vivaldi, Opera).
> Free and open source under the MIT license.

## 🔒 Privacy & permissions

- **No network access.** The code contains no `fetch`, no remote scripts, no
  analytics, and no servers. You can verify this — it's a handful of small,
  readable files.
- **Local-only storage.** Everything lives in `chrome.storage.local` on your
  device. Nothing leaves the browser. There is an Export button if *you* want a
  copy of your own data.
- **Only the hostname is read** (e.g. `github.com`) — never page content, never
  full URLs, never form data. There are no content scripts injected into pages.
- **Minimal permissions:**
  | Permission | Why |
  |---|---|
  | `tabs` | Read the active tab's hostname (shown as "browsing history" at install — that's the standard Chromium label). |
  | `storage` | Save your stats locally. |
  | `idle` | Pause tracking after 60s of no input. |
  | `alarms` | Periodic flush so long sessions survive service-worker suspension. |

  No host permissions, no `<all_urls>`, no file access.

## Features

- **Accurate tracking** of the active tab's hostname, counting time while:
  - the browser window is focused and you are not idle (60s of no
    keyboard/mouse input pauses tracking), **or**
  - the active tab is playing sound — so movies/music keep counting even when
    you're not touching the keyboard (a muted/silent video can't be detected
    and still pauses).
- **Quick popup** — today's sites with a bar chart, category color dots, a day
  picker, and a "Reset day" button.
- **Full dashboard** (the extension's options page) with:
  - **Day / Week / Year** views and prev/next navigation.
  - **Stat cards** — total time, peak hour / daily average, most-active
    day-or-month, sites visited, and top category.
  - **Trend bar chart** — by hour (day), by day (week), or by month (year),
    with hover tooltips.
  - **Category donut** + legend showing where your time goes.
  - **Top sites** list with per-site bars; click a site's colored tag to
    **recategorize** it (your choice is remembered).
  - **Category breakdown** with percentages.
  - **Export JSON** of all your data, and **Reset all**.
- **Categories** — sites are auto-classified into Social, Entertainment,
  Development, Productivity, News, Shopping, Search, AI, and Other, with manual
  override per site.
- **Hourly resolution** — the day view shows a 24-hour activity profile.
- Survives the MV3 service worker being suspended (state is persisted and
  flushed every 30s).

## Install (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder
   (`website-time-tracker`).
4. Pin the extension and click its icon to see your stats.

Browse to a few `http(s)` sites, switch tabs, then open the popup — time
accumulates in roughly 30-second increments.

Open the dashboard from the popup's **📊 Open dashboard** button, or
right-click the extension icon → **Options**.

## How it works

- `background.js` — service worker. Keeps a single active session
  `{ host, start }` in `chrome.storage.local`. On every relevant event (tab
  switch, navigation, window focus change, idle change) and on a 30s alarm, it
  "flushes" the elapsed time into per-day per-host totals and per-day hourly
  totals, then opens a fresh session.
- `categories.js` — shared classifier (domain rules + user overrides).
- `popup.{html,css,js}` — quick today view.
- `dashboard.{html,css,js}` — the full analytics page (also the options page).

### Data shape (in `chrome.storage.local`)

```json
{
  "session": { "host": "example.com", "start": 1733331000000 },
  "data": {
    "2026-06-04": { "github.com": 1820, "youtube.com": 640 }
  },
  "hours": {
    "2026-06-04": [0,0,0,0,0,0,0,0,0,120,300, ... ]
  },
  "categories": { "internal.mycorp.com": "Productivity" }
}
```

`hours` holds 24 integers (seconds per hour of day). `categories` holds your
manual per-host category overrides.

Times are in seconds. Dates are local time, `YYYY-MM-DD`.

## Notes & limitations

- Only `http://` and `https://` pages are tracked. Internal pages
  (`chrome://`, extension pages, `file://`) are ignored.
- Tracking is by hostname, not full URL or page title.
- Idle threshold is 60s; change `IDLE_SECONDS` in `background.js` to adjust.
