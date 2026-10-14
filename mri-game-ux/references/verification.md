# Verification

The browser shows the NUI; camera, peds and game sound only the game shows. Tell the user
what was verified where.

## Screenshots and measurements in headless Chrome

`scripts/nui-probe.mjs` opens the vite dev NUI in a headless Chrome with
`window.invokeNative` injected (the dev mock starts answering), sends messages as Lua would
and takes screenshots or measures something per frame. Chrome comes from `scripts/cdp.mjs`
(headless Chrome over CDP, temporary profile, no dependencies).

```bash
node scripts/nui-probe.mjs http://localhost:5173/ ./shots steps.json
```

`steps.json` is a list of steps:

```json
[
  { "post": { "action": "open", "characters": [], "amount": 4 }, "wait": 1500 },
  { "click": "Create character", "wait": 300, "shot": "enter-300" },
  { "wait": 600, "shot": "enter-900" },
  { "measure": ".cine-scrim", "click": "Characters", "ms": 450 },
  { "eval": "document.querySelectorAll('iframe').length", "wait": 0 }
]
```

- `post`: `window.postMessage` (what Lua would do with `SendNUIMessage`).
- `click`: button by text; `key`: `keydown` on the window.
- `shot`: screenshot with that name; `eval`: prints the value of an expression.
- `measure` + `ms`: effective opacity (product of the ancestors' opacities) of each element
  matching the selector on each frame, from the click. For flicker, 1.00 from start to end is
  expected.

Tips:

- Dark `#root` background (gradient imitating sky and ground) to see scrims and light text;
  the dev body is light.
- To compare before and after, `git stash` only the NUI files, measure, `git stash pop`.
- Dev server 504 in the console = still optimizing dependencies: run again.

## Music

With the NUI open in headless, the YouTube iframes show which track is playing:
`[...document.querySelectorAll('iframe')].map(f => f.src.split('embed/')[1]?.split('?')[0])`.
Walk the phases sending the messages (open, open creation, close with keepMusic,
arrivalStart, musicEnd) and check: two ids during the crossfade, one after, none at the end.

## Lua

- Run a parser (e.g. `luaparse`, replacing backtick hashes with `0`) on every edited `.lua`.
  Test the parser first with a deliberately broken file.
- On the server, check the console after `ensure`.

## Game-only bug

Don't guess. Instrument with a readable log and an easy-to-filter prefix
(`[SHOWROOM] [DIAG]`), at the right moment (on mount, at the end of the flight), with the
state that decides the cause: `IsPedActiveInScenario`, playing clip, `GetScriptTaskStatus`,
frozen, pending stream requests, fps. Ask the user to reproduce and read the client log
(`FiveM.app\logs` in the FiveM folder). Fix the cause and remove the temporary logs.
