# NUI pitfalls

## Flicker on screen switch

Symptom: the lower part (or the whole screen) brightens and darkens again on a switch.

Typical cause: the dim layer (scrim) lives inside each screen. The old screen unmounts at
once, the new one fades in from `opacity: 0` taking the scrim with it.

Fix: a single scrim, outside the screens, mounted while any screen that uses it is active.
Place it before the views in the DOM with `z-index: 0` so it stays behind them. Confirm by
measuring the scrim's effective opacity frame by frame during the switch
(`verification.md`): it must stay at 1.00 the whole time.

If the flicker is black, it's not the NUI: it's a camera cut with a fade in Lua.

## Music that stops or restarts

Player unmounted by `if (!isOpen) return ...` or by swapping the tree. See `sound.md`: the
player stays in the same tree position in every branch.

A new config object on every refresh also restarts the player if the effect depends on the
object's identity. Compare by value (JSON) before changing state, or depend only on the
fields that matter (resolved url, loop).

## Animation overriding transform

A keyframe with `transform` wipes the `translate(-50%)` that centers the element. Center it
another way (`left: 0; right: 0; margin: auto; width: max-content`) or animate a wrapper.

`transform`/`filter` on a `fixed` root creates a containing block for `fixed` children. With
an `inset: 0` root nothing changes; otherwise, check.

## Loadscreen

- A full-screen background doesn't use the ui-kit's `bg-background`: it multiplies by the
  `/uiconfig` opacity (glass 0.8) and the GTA screen leaks below. Use
  `bg-[hsl(var(--background))]` and paint the page's `html`/`body`.
- The "loading" spinner in the lower right corner is GTA's, not the NUI's. Remove it with
  `SetConvarReplicated('sv_showBusySpinnerOnLoadingScreen', 'false')` in the resource's server
  side (tested in game), without touching `server.cfg`.
- Never `invokeNative('quit')` to close: that closes FiveM. Closing is
  `ShutdownLoadingScreenNui` on the client.

## CEF version (FiveM's Chromium)

CEF 103 limits, the CEF 144 upgrade and NUI logs: see the `mri-nui-cef` skill.

## fetchNui in the browser

Outside the game, `fetchNui` usually answers a fixed `{ success: true }` when
`window.invokeNative` doesn't exist, and the dev mock doesn't run. To test with the mock,
inject `window.invokeNative = function () {}` before the page loads
(`Page.addScriptToEvaluateOnNewDocument`).

## Focus and keyboard

- `SetNuiFocus(true, true)` only while there is an interactive interface. During a cutscene
  and another resource's editor, release it.
- One keyboard listener per screen, off when another layer (confirmation, creation,
  settings) is on top.

## Screen over the world: legibility

- Dimming (vignette, gradient behind text) in fixed black (`rgba(0,0,0,x)`), never the
  ui-kit's `bg-background/x`: the preset multiplies alpha by the `/uiconfig` `--ui-opacity`,
  and on the glass theme the gradient disappears over a bright scene.
- Text on an inverted surface (white focus card): `text-black`, not `text-background` (it
  comes out faded for the same reason).
- Check in the browser over a crop of a real game screenshot (day and night), with
  `data-theme="glass"` and a low `--ui-opacity`. A painted background deceives.
- A list under a 3D car/ped doesn't repeat its photo: text card (brand, name, plate,
  status). A missing photo becomes an empty square.
