<p align="center">
  <img src="extension/icons/icon-128.png" alt="Premiere Timer Icon" width="128" height="128">
</p>

# Premiere Timer Extension

Tracks CS2 Premier rating expiry from Steam Personal Game Data. Browser must be logged into Steam. No Steam password, no backend.

## Installation

### From Stores
#### Chrome Web Store
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-brightgreen)](https://chrome.google.com/webstore/detail/premiere-timer/placeholder)

#### Firefox Add-ons
[![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add--ons-Install-blue)](https://addons.mozilla.org/en-US/firefox/addon/premiere-timer/)

### From Source (Developer Mode)
#### Chrome
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `dist/chrome/` folder

#### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file inside `dist/firefox/`

## Features

- Tracks Premier rating expiry from Steam
- Shows safe play window countdown
- Displays current CS Rating and latest Premier match
- Manual rating fallback and time adjustment
- Sidebar and popup interfaces
- Browser action badge with day counter
- Keyboard shortcuts (configurable)
- Steam access management

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

Run `npm install` to install dependencies.
Use `npm run build` to generate distribution files in `dist/chrome/` and `dist/firefox/`.

## Files

- `extension/` - Source code
- `dist/chrome/` - Built Chrome extension
- `dist/firefox/` - Built Firefox extension
- `scripts/` - Build scripts
- `tests/` - Unit tests

## Local Only

This extension runs entirely in your browser. No data is sent to any server. All Steam data remains local.