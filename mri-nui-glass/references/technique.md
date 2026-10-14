# Technique

## The hook

The texture is created like this: `texImage2D` 1x1 with `[0, 0, 255, 255]` and then
`texParameterf` on `WRAP_T` with CLAMP, MIRRORED_REPEAT, REPEAT, CLAMP. From then on,
sampling the texture returns the game frame (without the NUI, or there would be feedback).
Until the hook takes, it stays the blue pixel or comes out black.

citizenfx's `screencapture` (`packages/gameview/webgl.ts`) uses the same hook with WebGL1,
`alpha: false`, `desynchronized: true` and `gl.finish()` per frame, and waits 3 frames before
reading.

## What the package does

| Part | Choice |
| --- | --- |
| Context | WebGL2 |
| Blur resolution | 0.25 of the screen, with a 4-sample downscale |
| Blur | 5 linear fetches (9 taps), passes computed from sigma |
| Temporal smoothing | mix 0.55 with the previous frame (`temporal`) |
| Black frame | 32x18 thumbnail through PBO + fence |
| Re-hook | recreates the texture after consecutive black frames and rebuilds if the fence doesn't come back |
| Clipping | element-sized quad + SDF |
| Selection | `[data-glass]` |
| Text tone | from the thumbnail, every 200 ms |
| Extra | liquid mode (bevel, dispersion, highlight) |

## Decisions

- **Short step, more passes.** With 5 fetches and a wide step the gaussian becomes a comb and
  fine detail (grid, stripe, pole) reappears as a pattern. Step up to ~1.5 texel and the
  number of passes comes from `ceil((sigma / 2.4)^2)`, at most 8.
- **Downscale with 4 samples.** Copying the frame straight to 1/4 with bilinear skips pixels
  and the image shimmers when the camera moves. Four bilinear fetches at ±1/4 texel cover the
  4x4 block.
- **Asynchronous read.** `readPixels` straight on the canvas waits for the GPU to finish the
  game frame. With PBO + fence the read comes 1 or 2 frames later, without stalling. The blur
  only advances once the frame's thumbnail is approved; meanwhile the canvas shows the last
  good one.
- **Dark flash.** A frame whose share of dark pixels is 4 points above the average, or whose
  mean is below 65% of the moving average, is skipped (up to 45 in a row). The first accepted
  frame only initializes the averages.
- **Canvas at screen resolution.** The blur is low resolution, but compositing is at full
  resolution: the rounded edge comes out sharp, with no "feather" needed to hide aliasing.
- **Redraw only on change.** Compositing compares a key with rectangles, opacity and radius;
  in game the blur changes almost every frame, so it redraws while the screen is open. With no
  visible element, it clears once.

## Liquid

Blur plus a CSS highlight doesn't refract. The package's liquid:

- Sharp image at 1/2 of the screen, double buffered: the frame only becomes visible when the
  thumbnail read approves it (otherwise a black frame would show in the bevel).
- Bevel: `rim = 1 - clamp(-d / bezel)` (1 at the edge, 0 in the middle). Offset
  `normal * rim^2.2 * refraction` outward, so the edge shows the outside background "bent".
- Sharp/blur mix by `smoothstep(0.15, 0.85, rim)`: sharp refracted edge, blurred middle.
- Dispersion: R and B sampled with the offset 30% larger/smaller than G.
- Highlight: `rim^7` times the light (lit side full, opposite side 35%).
- `liquid` preset: bevel 22% of the shorter side (8 to 28 px), refraction 0.8 of the bevel,
  dispersion 0.5, highlight 0.45.

## Ideas not done

- Glass over another NUI panel: requires copying the blur to a canvas above the UI and would
  blur only the game, not the panel. Only if a screen asks for it.
- Blur strength per element: would need one blur chain per strength.
- Corners with different radii: SDF with 4 radii, if a real case shows up.
