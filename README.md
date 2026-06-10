# World Cup 2026 Tracker

Dynamic schedule, group standings, knockout bracket, and Apple Calendar export
for the FIFA World Cup 2026 (June 11 – July 19 · USA, Canada & Mexico).
Plain HTML/JS — no build step, no dependencies.

## Run it

Double-click `index.html`, or serve the folder for a cleaner setup:

```powershell
python -m http.server 8137 --directory worldcup
# → http://localhost:8137
```

## What it does

- **📋 Schedule** — all 104 matches in your local time zone, grouped by day,
  filterable by stage/group/team. Click any match to manually enter or
  override a score (handy for predictions; stored in `localStorage`).
- **🏟 Groups** — live standings for all 12 groups (FIFA tiebreakers:
  points → goal difference → goals for → head-to-head) plus the
  third-place ranking (best 8 of 12 advance).
- **🧩 Bracket** — full 32-team knockout tree. Knockout slots auto-fill from
  results: group winners/runners-up plus third-place teams allocated to their
  allowed Round-of-32 slots. Projections from incomplete standings show
  dimmed/italic; once ESPN/the feed publishes the official pairings, real
  team names take precedence automatically. Winners (incl. penalty
  shootouts) propagate through to the final.
- **📅 Calendar** — exports an `.ics` (all matches, one stage, or one team,
  optional 30-min reminders). Events use UTC times, so Apple Calendar
  displays correct local kickoff times anywhere. Instructions for
  iPhone/iPad/Mac are on the tab.

## iPhone install (PWA)

The app is an installable web app. With the site hosted on GitHub Pages
(HTTPS), open it in Safari on your iPhone → Share → **Add to Home Screen**.
You get a full-screen app with its own icon, offline caching via the service
worker, and live ESPN scores. No App Store, no certificates, no expiry.

A GitHub Action ([.github/workflows/update.yml](.github/workflows/update.yml))
re-fetches the fixture feed every 6 hours, regenerating `fixtures.js` and a
hosted `world-cup-2026.ics`. Apple Calendar can **subscribe** to that file
(the Calendar tab shows the `webcal://` link when the site is served over
HTTPS), so scores and knockout pairings flow into your calendar automatically.

## Staying up to date

- **Live scores**: the app fetches ESPN's public scoreboard on load, on
  ⟳ *Refresh live scores*, and every 90 s while a match is live.
- **Base schedule** (e.g. once knockout pairings are official): run
  `update-data.ps1` to regenerate `fixtures.js` from
  fixturedownload.com, then reload the page.
- **Calendar**: re-download the `.ics` after results come in and re-import
  into your dedicated "World Cup 2026" calendar — events have stable UIDs,
  so they update in place.

## Files

| File | Role |
|---|---|
| `index.html`, `style.css`, `app.js` | the app |
| `data.js` | static structure: venues/timezones, knockout wiring (M73–M104), flags, name aliases |
| `fixtures.js` | generated match data — refresh with `update-data.ps1` |
| `fixtures_raw.json` | last raw feed download (kept for reference) |
