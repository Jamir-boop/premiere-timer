<p align="center">
  <img src="public/icons/icon-128.png" alt="Premiere Timer Icon" width="128" height="128">
</p>

# Premiere Timer Extension

Local CS2 Premier CS Rating expiry timer using Steam Personal Game Data.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-brightgreen)](https://chromewebstore.google.com/detail/premiere-timer/nkaaekcihebjfnnhpmmpoajignbcpmfd?authuser=0&hl=en)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add--ons-Install-blue)](https://addons.mozilla.org/en-US/firefox/addon/premiere-timer/)

![localized-screenshots](https://raw.githubusercontent.com/Jamir-boop/markdown-images/master/2026-06-09_13-46-15-localized-screenshots.png)

## Installation

### From Source (Developer Mode)
#### Chrome
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3/` folder

#### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file inside `.output/firefox-mv3/`

## Usage

1. Accept Steam access when prompted
2. Click extension icon to open popup
3. Click "Sync Steam data" to fetch latest data
4. View safe play window timer and status
5. Use sidebar for detailed information
6. Configure shortcuts in browser settings

## How It Works

- Reads Premier match data from Steam Community profile
- Uses Skill Group value from matchmaking GCPD page
- Calculates expiry with 25-hour safety margin
- Parses explicit Steam GMT/UTC dates as absolute time
- Treats unmarked dates as local browser time
- Updates via background service with alarms

## Development

Run `pnpm install` to install dependencies and prepare WXT.

- `pnpm dev` - Start Chrome dev mode with output in `.output/chrome-mv3-dev/`
- `pnpm dev:firefox` - Start Firefox dev mode with output in `.output/firefox-mv3-dev/`
- `pnpm test` - Run Node unit tests
- `pnpm build` - Generate production builds in `.output/chrome-mv3/` and `.output/firefox-mv3/`
- `pnpm zip` - Generate browser zip packages from WXT

## Files

- `src/` - WXT source code and entrypoints
- `public/` - Static extension assets, icons, and locales
- `.output/chrome-mv3/` - Built Chrome production output
- `.output/firefox-mv3/` - Built Firefox production output
- `tests/` - Unit tests

## Local Only

This extension runs entirely in your browser. No data is sent to any server. All Steam data remains local.
