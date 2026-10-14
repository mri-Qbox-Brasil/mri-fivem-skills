# Camera and scene

## When the camera moves

- Only on a context change: opening an item, switching category, going back. Never on focus,
  hover or arrows walking a list: turning on every focus causes vertigo ("feels like a fan").
- Slow movement: time-based exponential follow settling in ~1 s (factor 2.2/s), never per
  frame.

## Render thread

One scripted camera, one per-frame thread that computes the pose (glide, arc, sway), applies
`SetCamCoord`/`PointCamAtCoord` and draws what is per frame (lights, 3D text, depth of field).
Invalidate the thread with a token when the scene is rebuilt.

## Background blur (DOF)

- Natives: `SetCamUseShallowDofMode(cam, true)`, `SetCamNearDof`, `SetCamFarDof`,
  `SetCamDofStrength` and, per frame, `SetUseHiDof()` (without it the effect doesn't show).
- Dynamic focus: distance from the camera to the aim point. Sharp from `focus - near` to
  `focus + far` (showroom: near 0.8, far 1.3, strength 0.85; creation close-up:
  0.35 / 0.9 / 1.0).
- Turn it off during long flights (opening shot descending to the stage): it blurs the whole
  city.
- Handing over to another resource that uses its own camera (appearance editor): repeat its
  shot and DOF at the end of your scene, with the same natives and values, and the switch
  disappears.

## Handheld camera

Slow sway with sines of different frequencies on the three axes, added to the pose only at
render time (not in the state, or the next glide starts from the swayed point):

- position ~3 cm, aim ~1.8 cm, speed 1.0;
- turn it off where the shot must end exact (last shot before handing the camera to another
  resource).

## Load the area before showing it

Blurry textures and buildings popping in are what most give away "not a game". Before each
distant shot:

- `NewLoadSceneStartSphere(x, y, z, radius, 0)` (or `NewLoadSceneStart` with a direction),
  `SetFocusPosAndVel` on the point, wait for `IsNewLoadSceneLoaded()` with a cap (5 s) and
  warn in F8 if it runs out;
- `GetNumberOfStreamingRequests()` before and after helps diagnose;
- at the end, `NewLoadSceneStop()` and `ClearFocus()`.

## Fixed time and weather

The showcase can't show up at dawn or in the rain. Integrate through the qb-weathersync
contract (Renewed-Weathersync implements it):

- `TriggerEvent('qb-weathersync:client:DisableSync')` and apply `ClearOverrideWeather`,
  `SetWeatherTypeNowPersist`, `NetworkOverrideClockTime`;
- also put the weather in `LocalPlayer.state.playerWeather` (Renewed repeats it while the sync
  is off);
- Renewed resets the clock when the sync goes off: reapply in an
  `AddStateBagChangeHandler('syncWeather', ...)` with `SetTimeout(0)`;
- Renewed's qb compat turns the sync back on at `QBCore:Client:OnPlayerLoaded`: reapply after
  it if the flow is still in the showcase;
- at the end, `qb-weathersync:client:EnableSync`.

## Stage lighting

A top spotlight (`DrawSpotLight` per frame) leaves the face dark. Add a weak front fill light
on the camera side (`DrawLightWithRange`).

## 3D text behind the character

A name on a world-space quad (DUI) behind the ped looks good, but a long name leaves the
frame. Limit the width to a fraction of what the camera sees at that distance:

```lua
local visible = 2 * dist * math.tan(math.rad(GetCamFov(cam)) / 2) * GetAspectRatio(false)
width = math.min(nt.width, visible * nt.fit) -- fit ~0.8
```

`GetCamFov` is vertical; multiply by the aspect ratio for the width.

## Showcase ped

- Ground it with `SetEntityCoords` (not the `NoOffset` one) on the floor found by
  `GetGroundZFor_3dCoord`.
- Idle animation per position (scenario or dict/clip). A ped in default pose (straight arms,
  looking up) means the animation didn't play: instrument it (`IsPedActiveInScenario`,
  `GetScriptTaskStatus`, current clip) before changing anything.
- Initial creation preset with a face (parents head blend), hair, eyebrows and colors. The
  same preset on the preview and the real ped, so the swap doesn't show.

## NPC conversation

Pattern from `mri_Qnpc` (`client/dialog.lua`, `web/src/components/Conversation.tsx`):

- The camera follows both heads live (exponential follow, factor 4/s), never a fixed aim: the
  NPC turns its body to you and a fixed aim cuts the face.
- Shots: over the player's shoulder on the first line and on the answer; close-up on the NPC
  on each new line (1 m, 42 lens, face on the third with room where it looks), hard cut and a
  slow 10 cm push-in during the line.
- Never turn the camera to the player's face on the answer: the player gestures with their
  back to the camera, the NPC nods.
- The screen is a subtitle, not a card: small highlighted name, white line with shadow, at
  most two lines; long lines in parts (120 characters, reading time or Enter, counter 2/6).
- Choices in a list on the right, at subtitle height, only after the last part; highlight
  bar, arrows/W/S, numbers, mouse, `NAV_UP_DOWN` sound.
- Config values from JSON: `40` becomes an integer and a float native reads it wrong; force
  `+ 0.0` on merge.
