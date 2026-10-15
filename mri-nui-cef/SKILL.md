---
name: mri-nui-cef
description: "FiveM NUI on the Chromium FiveM actually runs: CEF 103 limits and the CEF 144 upgrade (what breaks: alert/confirm, clipboard focus, old fx_version, CSS zoom, mutation events, throttling; what opens up: WASM, modern CSS, Tailwind 4), the browser dev mock, focus and ESC, no infinite animations, uploading video/music/image from the NUI to the server in HTTP parts, loadscreen video, NUI logs, and a NUI card over the pause menu map (one cursor, wheel without map zoom, hover and edge scroll). Scanner script, clipboard helper, upload templates. Use when building or debugging a NUI, or asked \"does this work in FiveM's CEF?\", \"what breaks with CEF 144?\", \"copy doesn't work\", \"the NUI lags\", \"works in the browser but not in game\", \"upload a video from the panel\", \"two cursors on the pause map\", \"the wheel zooms the map under my NUI\" (pt-BR: \"o CEF novo quebra o quê?\", \"copiar não funciona\", \"a NUI tá travando\", \"subir vídeo pelo painel\", \"dois cursores no mapa\", \"scroll dá zoom no mapa\")."
---

# NUI on FiveM's CEF

The NUI is an embedded Chromium (CEF) drawn off screen over the game. It is not the browser
you test in: a bug that only shows in game is often a version difference.

## Which Chromium

- **CEF 103** (Chrome 103, mid 2022) until the upgrade reaches every channel.
- **CEF 144**: on Canary since October 2026, announced for all channels "in the next few
  days". Check what a player runs with `navigator.userAgent` (`Chrome/<version>`) logged from
  the NUI.
- While players are split, code must run on both: modern CSS behind `@supports`, modern JS
  behind feature checks, and the fixes below (they all work on 103 too).

## CEF 103 limits (until everyone is on 144)

- No `:has()`, no `@container`, no CSS nesting, no `color-mix()` / `oklch()`, no `dvh`.
  Tailwind 4 needs Chrome 111: stay on Tailwind 3.
- `getComputedStyle().containerType` is `"none"`: `@floating-ui/utils` up to 0.2.10 treats it
  as a containing block and every Radix popover opens in the screen corner. Fixed in
  `@floating-ui/utils` 0.2.12; a UI kit that bundles it must update its own lockfile.
- `var()` inside SVG attributes doesn't resolve. Use CSS properties or literal values.
- WebAssembly is disabled.

## CEF 144: what breaks

Scan everything at once:

```bash
node scripts/cef-scan.mjs <resources folder> --src-only
```

`--src-only` skips `dist/`, `build/` and minified bundles (report the source, rebuild).

| Change | Fix |
| --- | --- |
| `alert()`, `confirm()` removed | your own modal, or hold-to-confirm |
| `document.execCommand('copy')` needs the element focused | `el.focus()` before `el.select()`; `templates/clipboard.ts` |
| `fx_version 'adamant'`/`'bodacious'` or `__resource.lua`: the page may not be a secure context | `fx_version 'cerulean'` (nothing else changes for the Lua) |
| Mutation events (`DOMNodeInserted`, `DOMSubtreeModified`) removed | `MutationObserver` |
| CSS `zoom` follows the standard | test clicks, drag and popover positions inside zoomed areas; prefer `transform: scale()` |
| Many requests in a row are throttled | batch `fetchNui` calls, no fast polling (events from Lua instead) |
| `new URL()` throws on `<`, `>`, `\|` | encode user input |
| Mic and camera only in the resource's own page, not in iframes inside it | request them in the top page |
| WebUSB, Bluetooth, HID, Serial, printing, picture-in-picture blocked | none |
| Cookies expire after 400 days at most | keep state in the server or KVP |

## CEF 144: what opens up

- **WebAssembly** is back (image compression, audio decoding, sqlite, ffmpeg in the page).
- **CSS:** `:has()`, container queries, nesting, `subgrid`, `oklch`/`color-mix`, `dvh`,
  `text-wrap: balance`, `@starting-style` (entry animations without JS), popover API, anchor
  positioning, view transitions, scroll-driven animations. Tailwind 4.
- **JS:** `Object.groupBy`, `Promise.withResolvers`, `Set` methods, `Array.prototype.toSorted`.
- **WebGPU:** not announced. The NUI renders off screen and WebGPU depends on how Cfx built
  it: test `navigator.gpu` and `await navigator.gpu?.requestAdapter()` in game before
  relying on it. WebGL 2 already works on 103.
- Use these only after 144 is on every channel, or behind `@supports` / feature checks.

## Working rules

- **No infinite animations** (`animation: ... infinite`, spinners left mounted, looping
  gradients): they make CEF repaint every frame over the game and cost FPS. Animate on
  state change and stop.
- **Focus:** `SetNuiFocus(true, true)` only while there is something to interact with;
  release it during cutscenes and other resources' editors. One keyboard listener per
  screen, off while a layer (confirmation, settings) is on top. ESC closes through a NUI
  callback that calls `SetNuiFocus(false, false)`.
- **Page embedded in another resource's iframe** (admin panels that host plugins): the
  iframe handles its own ESC and asks the host to close; the host can't see its keys.
- **Packaging:** if the release ships only the built UI (`web/build`) without `web/`, files
  the Lua reads (`CreateRuntimeTextureFromImage` PNGs, json, sounds) must live outside
  `web/`, or they work on your server and vanish on everyone else's.
- **Tabs that load a list per tab** (React): store the list with the tab id
  (`{ tab, entries }`) and only render it when the id matches; the effect that clears runs
  after the render and the new tab draws once with the old list.

## Uploading files from the NUI

Admin panel that takes a video, music or image and saves it in the resource: read
`references/file-upload.md` and copy `templates/upload-*.lua`, `upload-files.js`, `upload.js`.
The traps it covers:

- FXServer's HTTP drops a body over **5 MiB**: post straight to `SetHttpHandler` in 4 MiB
  parts, never through a net event.
- `SaveResourceFile(res, path, data, #data)`: with `-1` a binary file is saved empty.
- The NUI only reaches `http://127.0.0.1:<port>` or the `web_baseUrl` proxy; no duplicate
  `Access-Control-Allow-Origin` through the proxy.
- Players only get the file after the resource restarts, and a resource can't restart itself.
- Don't re-encode a video that came from YouTube (already ~1 Mbps): it only gets jagged.

## NUI over the pause menu

A card over the pause map: one drawn cursor, the page takes the mouse only over the card (the map
reads the wheel raw, so disabled controls never stop its zoom), smooth hover and edge scroll. Read
`references/pause-menu-overlay.md` before building one.

## Testing in the browser

- `fetchNui` helpers usually answer a fixed `{ success: true }` when `window.invokeNative`
  doesn't exist, so the dev mock never runs. Define `window.invokeNative = () => {}` before
  the page loads to test with the mock.
- Send what Lua would send with `window.postMessage({ action, ... })`.
- Check a narrow screen and the user's languages; then confirm in game what the browser
  can't show (focus, keys, sound, the game behind the page).

## Logs

The NUI `console.log` and its errors go to the client log:
`FiveM.app/logs/CitizenFX_log_*.log` in the FiveM install folder. Bug only in game: log the
state with an easy prefix, reproduce, read that file.
