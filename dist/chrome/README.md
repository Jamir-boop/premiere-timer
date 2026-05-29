# premiere-timer Extension

Unpacked Chrome/Firefox extension. Local only. No backend. No Steam password.

## Build

```bash
npm run build
```

Outputs:

- `dist/chrome/`
- `dist/firefox/`

## Install

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked.
4. Select `dist/chrome/`.

Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Load Temporary Add-on.
3. Select `dist/firefox/manifest.json`.

## Use

1. Accept Steam access when installing the extension.
2. Open extension popup from toolbar.
3. Click `Sync Steam data`.
4. If Steam access is missing, click `Allow Steam access`.
5. If Steam rating parse fails, use `Manual rating fallback`.
6. If Steam login is needed, use the main action to open GCPD pages, log in, and leave tabs open until sync finishes.
7. Optional: open `Settings` to change the dark theme accent color, open the sidebar, or configure shortcuts.

Timer uses latest Premier match from Steam Personal Game Data plus the `Premier` row `Skill Group` value from the matchmaking GCPD page. `Play before` subtracts 25h safety margin. Explicit Steam `GMT`/`UTC`/offset dates are parsed as absolute time; unmarked dates are treated as local browser time.

## Shortcuts

Commands ship without default keys:

- `Open popup`
- `Open sidebar`

Configure them in browser shortcut settings.

Limit: browser must be running. No OS-level reminders in v1.
