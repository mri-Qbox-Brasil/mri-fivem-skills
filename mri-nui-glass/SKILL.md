---
name: mri-nui-glass
description: "Real liquid glass on the FiveM NUI - the game blurred behind a panel, pill, orb or card, and a bevel edge that refracts the background, which backdrop-filter can't do in CEF (there it only sees the page itself, the game is left out). Uses startGameGlass/startSuiteGlass from @mriqbox/ui-kit (or the public mri-fivem-liquid-glass package), which grabs the GTA frame as a WebGL texture through the cfx hook (the same as screencapture) and draws on a canvas behind the UI, shaped like each element with data-glass. Use when asked for \"glass\", \"liquid glass\", \"game blur behind the UI\", \"backdrop blur doesn't work on the NUI\", \"frosted glass\" (pt-BR: \"vidro fosco\", \"blur do jogo atrás da UI\", \"fundo desfocado do game\"), or when porting a UI with backdrop-filter into the game. Also keeps real GTA screenshots (MRI sign) for mockup backgrounds, NUI screenshots outside the game and project demos."
---

# Liquid glass on the NUI

`backdrop-filter` in FiveM's CEF only blurs what the page painted: the game is composited
below afterwards, so the glass becomes a flat layer. The way out is to get the game frame
inside the page and draw the glass in WebGL.

The core lives in one place: the public **`mri-fivem-liquid-glass`** package (npm; repo
[mur4i/mri-fivem-liquid-glass](https://github.com/mur4i/mri-fivem-liquid-glass); docs in
English and pt-BR, demo on GitHub Pages, example resource). In-game log: `[liquid-glass]`.

`@mriqbox/ui-kit` (4.34.0+) depends on it and only re-exports `startGameGlass`
(`src/lib/gameGlass.ts`); what belongs to the suite stays in the kit: `suiteGlass.ts`
(liquid theme), story `Lib/GameGlass`, `THEMING.md`.

- Glass fixes and improvements go to the package. There, a `feat:`/`fix:` commit on `main`
  bumps the version and publishes by itself (trusted publisher). Before pushing:
  `npm run typecheck`, `npm run build`, `npm test` (visual test in headless Chrome).
- The kit picks up the new version through `^1.x` on the next install; an API break becomes a
  major in the package and requires bumping the dependency in the kit.
- ui-kit: a push to `main` publishes a version.
- Never in a copy inside the resource.

## How it works

1. **cfx hook:** a WebGL texture created with 1 blue pixel and the `texParameterf` sequence on
   `WRAP_T` (CLAMP, MIRRORED_REPEAT, REPEAT, CLAMP) becomes the game frame. Origin: citizenfx's
   `cfx-ui`; `screencapture` does the same (`packages/gameview/webgl.ts`). The call order is
   what the hook recognizes.
2. **Two game images:** one at 1/2 of the screen, sharp (for refraction), and one at 1/4,
   blurred with a gaussian in short passes and temporal smoothing.
3. **Per-element clipping:** fixed canvas behind the UI; on each `[data-glass]` it draws with
   that element's `border-radius` (SDF), the parents' opacity and the clip of the parent with
   `overflow`.
4. **Liquid** (`data-glass="liquid"`): in the bevel band the surface "tilts", pulling the
   sharp background from outside in (background lines bend), with color separation and
   specular highlight along the light direction. The middle stays blurred, for reading.
5. **Broken frame:** a 32x18 thumbnail read without stalling (PBO + fence). Black or a sudden
   darkening: keep the last good frame. Black for ~3 s: redo the hook.
6. **Background tone:** sets `data-glass-backdrop="bright|dark"` so text can switch color.

Technique decisions and details: `references/technique.md`.

## Not WebGPU

FiveM's CEF is Chromium 103 (`libcef.dll` 103.0.5060.141); WebGPU only exists from 113 on,
and the game hook is a GL texture. WebGL2 works on 103.

## Apply to a resource

1. Resource with the kit: `@mriqbox/ui-kit` 4.32.0 or newer (4.34.0+ already uses the
   package). With a bundler and no kit: `npm i mri-fivem-liquid-glass`. Plain HTML without a
   bundler (e.g. ox_target's `web/`): copy `dist/mri-liquid-glass.iife.min.js` from the
   package into the resource (exposes `window.MriLiquidGlass.startGameGlass`), list it in the
   fxmanifest `files` and note the version. The jsDelivr CDN also works, but needs internet
   on the client.
2. Once at NUI boot:
   ```ts
   import { startGameGlass } from '@mriqbox/ui-kit'
   startGameGlass({ fallbackImage: import.meta.env.DEV ? '/dev-bg.jpg' : null })
   ```
   Options: `scale` (0.25), `blur` (sigma in px, 14), `saturation` (1.15), `darken` (1),
   `temporal` (0.55; 1 turns it off), `light` (`[-0.6, -0.8]`, light from the top left),
   `zIndex` (0), `selector`. Returns `{ refresh, stop }`.
3. CSS:
   - `html`, `body` and the root transparent; root above the canvas (`position: relative;
     z-index: 1`), or the blur covers the UI;
   - on the element: **no** `backdrop-filter`; a low translucent background (`.04` to `.10`)
     as tint, a 1px light border, an `inset 0 1px 0` highlight, a shadow below;
   - text: `[data-glass-backdrop="bright"] { color: <dark> }`.
4. Choosing the effect:
   - `data-glass`: a large panel with content (list, form). A bevel distracts there.
   - `data-glass="liquid"`: a small highlighted piece (button, pill, orb, dock, HUD).
   - Fine tuning: `data-glass-bezel` and `data-glass-refraction` (px),
     `data-glass-dispersion` and `data-glass-specular` (0..1). Any of them turns the bevel on.
5. Suite theme: with `startSuiteGlass()` instead of `startGameGlass`, the `/uiconfig` `liquid`
   theme (`data-theme='liquid'` on `<html>`) puts glass on every top-level `.mri-surface`,
   without marking anything; on other themes only manual `data-glass` applies. Don't use
   `mri-surface` on an always-open screen (HUD): each page with glass redraws every frame.
6. A suite resource doesn't hardcode glass: the surface is `mri-surface border bg-background`
   (follows the `/uiconfig` theme and opacity), without `data-glass` or its own tint. Bevel
   (`data-glass="liquid"`) only when `data-theme` is `liquid`, switched by theme state. Focus
   through Tailwind's `ring-*`: liquid replaces `box-shadow` but adds `--tw-ring-shadow`.
   Example: `mri_Qpausemenu` (`web/src/lib/theme.ts`, `useBevel`).

## Rules and limits

- The canvas sits **below the whole UI**: the glass only shows the game. Glass over another
  opaque NUI panel doesn't blur the panel; glass over glass works.
- `scale` and `translate` work; rotation doesn't. Radius from `border-top-left-radius`. Clip
  only by the first parent with `overflow`: a glass element inside a scrolling list leaks
  out of the panel. Glass only on the top surface; `startSuiteGlass` (kit 4.33.1+) already
  ignores `.mri-surface` nested in another.
- Radius, clip and attributes are cached; changed through inline `style`: `refresh()`.
- The loop runs while there is a `[data-glass]` in the DOM and redraws the canvas every
  visible frame. Hidden doesn't draw; no element, it stops and the canvas leaves the page
  (1.4.1+: an idle canvas made AMD drivers drop the fill of rounded panels in any theme).
  Screen closed: remove it from the
  DOM.
- DUI (`?mode=dui`) and outside the game without `fallbackImage`: it doesn't start. mri_Qadmin
  iframe: untested.

## Verify

1. Browser: the site's playground (`npm run docs:dev` in a clone of `mri-fivem-liquid-glass`,
   http://localhost:5173/mri-fivem-liquid-glass/playground, accepts a dropped GTA screenshot;
   live at mur4i.github.io/mri-fivem-liquid-glass/playground), the kit's `Lib/GameGlass` story
   (`npx storybook dev -p 6016` in a clone of `mri-ui-kit`) or the resource's dev with
   `fallbackImage`, and the screenshot:
   ```
   node scripts/shot.mjs "http://localhost:6016/iframe.html?id=lib-gameglass--showcase&viewMode=story" ./glass.png 10000
   ```
   It waits in real time (with `--virtual-time-budget` rAF barely runs). Chrome comes from
   `scripts/cdp.mjs`. The first Storybook load optimizes dependencies: if it comes out empty,
   run again. Check: blur only inside, corners, circle, opacity, lines bending in the bevel,
   thin highlight.
2. Game (only it shows): frame arriving, first seconds, loading and pause, fast camera
   (flicker), FPS and `resmon` with the screen open. Client log in
   `FiveM.app\logs\CitizenFX_log_*.log` (FiveM folder), filter `[liquid-glass]` (kit up to
   4.33.x: `[gameGlass]`).
3. Say what was seen where (browser or game) and what was left untested.

## Scene backgrounds (mockup)

Real game screenshots from an MRI server, without black bars or FiveM branding, in `assets/`.
They serve as `fallbackImage`, as background for screenshots and mockups of any NUI outside
the game, and as project demo images:

| File | Scene | Good for |
| --- | --- | --- |
| `gta-sunset-player.webp` (1920x864) | character from behind at sunset, MRI sign on the hill | contrast background (bright sky, dark body), shows the blur well; used by the liquid glass demo |
| `gta-vinewood-hill.webp` (1920x862) | hill with the MRI QBOX sign, blue daytime sky | clean bright background, testing text over a bright scene |

Use as `object-fit: cover` (2.2:1 ratio; at 16:9 the sides get cropped). In a project, copy the
file into it, don't point at the skill folder.
