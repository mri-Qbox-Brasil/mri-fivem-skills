# Dev mode with a stateful mock

Goal: every screen of the resource opens in `vite dev` with real-looking data, and what you do
on it (create, save, delete, place in the world) answers like the game would. Tested on a
restaurant resource with 14 screens.

## Layout

```
web/src/dev/
  mockServer.ts   # state + handleMock(event, data) + scenarios
  fixtures.ts     # sample rows shaped like the server's SQL rows
  catalog.ts      # data read from the Lua config
  DevMenu.tsx     # scenario switcher
```

- `fetchNui`: `if (import.meta.env.DEV && typeof window.GetParentResourceName !== 'function')`
  then `await import('../dev/mockServer')` and return `handleMock(event, data)`. The dynamic
  import behind `import.meta.env.DEV` keeps the whole folder out of the game build (check the
  build for a mock string).
- `main.tsx`: `React.lazy(() => import('./dev/DevMenu'))` under the same condition, rendered
  **outside** the visibility provider (it must show while every panel is hidden).

## Mock server

- One `state` object built by a `fresh()` function (rows, catalog, pending placement), and a
  "reset data" button that calls it again.
- `emit(action, data)` = `window.dispatchEvent(new MessageEvent('message', { data: { action, data } }))`,
  the same shape `SendNUIMessage` delivers.
- One handler per NUI callback. Mutations change `state` and **emit the same refresh message
  the Lua client sends** (e.g. `updateMenu` after `addCategory`), so the screen updates through
  its real code path.
- Close callbacks (`hideFrame`, `close*`) hide; an unknown callback logs and answers `{}`.
- World placement: hide the panel, emit the rail message (`placeHud`), then after ~1.4 s clear
  it, store a random point as the placed result and reopen the same screen.
- Expose `window.__dev = { state, open }` for the console and for probe `eval`s.

## Data from the resource itself

- Lua config through Vite: `import itemsLua from '../../../shared/config/items.lua?raw'`, then
  parse the `{ key = 'value', ... }` lines with a regex. The catalog never drifts from the seeds.
- Item images: `import.meta.glob('../../../images/items/*.png', { eager: true, query: '?url', import: 'default' })`.
  Files outside `web/` need `server.fs.allow: ['..']` in `vite.config`.
- Locales: import the real `locales/*.json`; a generated copy inside `src` goes stale.

## Scenarios

- One entry per screen: `{ id, label, group, open() }`, where `open` emits `setVisibility` plus
  the data messages that screen expects.
- The chosen one goes in the URL (`#page=management`) and `localStorage`, and opens on load.
- Menu in a corner, closed by default, toggled by a key; picking a scenario closes it.
  A "reopen" button brings the current screen back after Esc.
