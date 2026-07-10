# AGENTS.md — premiere-timer

Guidance for AI agents and new contributors. Read this before changing code.

## What this extension is

A local-only browser extension (Chrome + Firefox, MV3, built with [WXT](https://wxt.dev)) that tracks when a CS2 Premier CS Rating will decay ("expire") and tells the player the latest safe time to play. All data comes from the user's own Steam Community **GCPD** pages (Personal Game Data for app 730). Nothing is sent to any server — keep it that way.

**Design goal: simple and useful.** No new dependencies (the only dev dependency is `wxt`). No speculative abstractions. No backend. Shortest diff that works.

## How it works

### Data sources (both require the browser to be logged into Steam)

| Page | URL | Provides |
|------|-----|----------|
| Match history | `steamcommunity.com/my/gcpd/730/?tab=matchhistorypremier&l=english` | Latest Premier match timestamp |
| Matchmaking stats | `steamcommunity.com/my/gcpd/730/?tab=matchmaking&l=english` | Premier Skill Group (CS Rating) + Wins |

### The core calculation (`src/lib/calc.js`)

A CS Rating decays if the player doesn't play for N days, where N depends on the rating (`RATING_TIERS`: 30 days at low ratings down to 8 days above 23299). The tier boundary values (e.g. 11200/11201) are pinned by tests — do not "fix" them without a Valve/community source.

```
expiration = latestPremierMatchAt + activeDays
playBefore = expiration − 25h safety margin   (SAFETY_MARGIN_HOURS)
```

`getTimerState()` maps this to levels: `ok` → `warning` (<72h) → `urgent` (<24h) → `expired`, plus `unknown` (missing data), `stale_rating` (new match seen, rating not re-synced), and `unranked` (see seasons below).

### Architecture

```
src/
  lib/
    calc.js       decay tiers, expiry math, timer levels, badge text
    parser.js     scrapes GCPD HTML (dates, skill group, wins, pagination, login/rate-limit detection)
    state.js      DEFAULT_STATE, merge/patch helpers; state lives in storage.local
    i18n.js       runtime translator (en/es) — MESSAGES must stay key-identical across languages (test-enforced)
    reminders.js  optional 1-day-before notifications via alarms
    ext-api.js    browser/chrome namespace shim + sendMessage helper
  background.js   all fetching, parsing orchestration, alarms, badge, message handler
  entrypoints/
    background.js     thin WXT wrapper around startBackground()
    content-gcpd.js   injected on GCPD pages the user browses; sends page HTML to background
    popup/            the entire UI (also used as side panel via manifest default_path)
wxt.config.js     manifest generation (per-browser blocks for Chrome/Firefox)
```

### Sync paths (three ways data arrives)

1. **Direct fetch** (`refreshFromSteam`): background fetches both URLs with `credentials: "include"`. Runs on the 6h alarm (`REFRESH_ALARM`) and the popup Refresh button.
2. **Guided tabs** (`openGcpd` message): opens both GCPD pages in background tabs, scrapes them via `scripting.executeScript` when loaded, closes them on success. Used when the fetch path hits a login wall — a real tab carries the session.
3. **Content script**: if the user browses a GCPD page themselves, `content-gcpd.js` ships the HTML to the background and shows a small toast on success.

All three funnel into `applyParsedResults` → `saveState` → badge + reminder rescheduling.

## Edge cases and how they are handled

### New seasons (the big one)

CS2 Premier is seasonal. When a season ends, Valve wipes CS Ratings; players are unranked until they complete placement wins (currently 10). **There are no hardcoded season dates anywhere — everything is derived from what the GCPD page shows.** This is deliberate: future seasons must require zero code changes.

Lifecycle, all automatic:

1. **Season ends** → matchmaking table still has the Premier row but the Skill Group cell is blank (`&nbsp;`). Parser returns `status: "unranked"` (plus `premierWins` from the Wins column, which resets per season).
2. **Background** (`applyParsedResults`) clears the stale rating (`currentRating: null`). That nulls the derived deadlines, which silently disables reminders. Badge goes grey showing placement progress (`3/10`), popup says "No Premier rank yet. Placement wins: 3/10." No manual-panel nagging, primary button stays Refresh.
3. **Rank obtained** → Skill Group shows a number again → `status: "ok"` → timer, badge, and reminders resume automatically using the (fresh, placements count) latest match date.

Distinction that matters in `parser.js`:
- Premier row present, no valid rating → **`unranked`** (seasonal wipe)
- Table/row absent entirely → **`rating_not_found`** (never played / page changed) — this one *does* prompt the manual fallback UI.

Escape hatches:
- If Steam ever fails to blank the rating after a wipe, the Manual panel has **"New season: clear rating"** (`clearRating` message) which forces the unranked state until the next sync finds a real rating.
- If Valve changes the placement rule, `PLACEMENT_WINS_TARGET` in `calc.js` is display-only; unranked detection does not depend on it.

Real off-season fixtures live in `tests/parser.test.mjs` ("unranked" tests) — captured from an actual S4→S5 off-season page. When a future season behaves differently, capture a new fixture first, then code against it.

### Steam's malformed HTML

GCPD tables use **unclosed `<td>` tags** (`<td>Premier<td>3<td>0...`). The cell regex in `extractTableRows` ends cells at the next cell opening / closing tag / end of row. Never "simplify" it back to requiring `</td>` — table extraction will silently stop matching on live pages while well-formed test fixtures keep passing. Always validate parser changes against a real saved GCPD page, not just synthetic fixtures.

### Timezones and date formats

- Steam prints `YYYY-MM-DD HH:MM:SS GMT` on `l=english` pages — parsed as UTC.
- Zoneless timestamps (user-browsed pages) are parsed as **local browser time**.
- Each timestamp must produce exactly **one** candidate. A past bug double-parsed `... GMT` strings as both UTC and local, showing users more time than they had (regression test: "does not duplicate a GMT timestamp as a local-time candidate").
- No `M/D/Y` numeric parsing — ambiguous with `D/M/Y` locales; a wrong date is worse than a missing one (missing triggers the manual fallback UI).
- Dates without a year that land in the future roll back one year.
- Candidates more than 24h in the future are discarded; the newest remaining candidate wins.

### Other handled states

- **Logged out**: detected via login-page markers (`looksLoggedOut`) and login redirect URLs → `needs_login`, UI switches primary action to "Open Steam GCPD" (guided tabs).
- **Rate limiting**: HTTP 429, `Retry-After`, `X-eresult: 84`, or body markers → `rate_limited`, surfaced in UI, no retry storm.
- **Pagination**: match history "Load More" is followed via `continue_token` (max 25 pages user-initiated / 5 in background, with time limits and loop detection on repeated tokens/HTML) → `history_scan_limited` when exhausted.
- **Rating staleness**: if a newer match appears (>1 min newer), `ratingNeedsUpdate` flips → "RATE" badge until rating is re-synced (rating changes after every match).
- **Manual fallback**: user can enter rating and latest match time by hand — this must always keep working; it's the safety net for every parser failure.
- **Duration display never understates urgency**: `formatDuration` rounds up, and anything under 24h renders in hours, never "1d" (test-enforced).

## Development

```bash
pnpm install         # also runs wxt prepare
pnpm test            # node --test tests/*.test.mjs  (manifest test builds both browsers)
pnpm dev             # Chrome dev mode
pnpm build           # production builds in .output/{chrome,firefox}-mv3/
node scripts/update-version.mjs <semver>   # interactive version bump (package.json is the single source)
```

Conventions:
- Version lives only in `package.json`; WXT injects it into manifests. Bump patch for fixes, minor for features, in the same commit.
- Tests are plain `node:test`, no frameworks. Every non-trivial fix ships with a regression test. i18n key parity (en/es) and referenced-key existence are test-enforced — add both languages or the suite fails.
- No remote resources of any kind (fonts, scripts, CDNs). The privacy promise is "runs entirely in your browser"; the manifest has no CSP override and must not need one.
- Prefer deleting code over adding it. If a parser heuristic can be wrong, prefer returning "not found" (which routes users to manual fallback) over guessing.
