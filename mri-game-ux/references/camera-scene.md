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

## Obstacles and the player's ped

Every scripted camera around a subject (showroom, customizing, orbit, conversation) does this,
not only the shot picked at the start:

- **Collision every frame.** A synchronous probe (`StartExpensiveSynchronousShapeTestLosProbe`,
  flags `1 | 2 | 16`: world, vehicles, objects; ignore the subject) from the subject's center
  (not the composition aim, which can sit inside a wall) to the camera. On a hit, the camera
  moves to the hit point minus 0.3 m (minimum ~0.8 m). Pull in fast (half the gap per frame),
  come back out slowly (`1 - exp(-dt * 3)`), and with nothing in the way follow the planned
  distance directly, or every zoom and reframe lags. The async probe (`StartShapeTestLosProbe`)
  is only for choosing a side before the move: it waits frames.
- **The player's own ped never vanishes.** A character that disappears when a screen opens reads
  as a bug (mri_Qcrafting, 2026-10-23: the bench shot sat inside the body and the old rule here hid
  it with `SetEntityLocallyInvisible`). Peds stay out of the wall probe (the camera must not jump
  because of the body), and the shot is framed around the player instead:
  - Workstation, shop counter, NPC talk: over the shoulder. Turn the ped to the subject
    (`TaskTurnPedToFaceCoord`, freeze after ~650 ms), camera ~0.95 m behind and ~0.75 m to the side
    at shoulder height (+0.55), aim at the subject pulled ~25% toward the ped. The back and shoulder
    sit soft in the foreground (the DOF blurs them), the subject sharp.
  - A machine operated with the hands up close (ATM, keypad, terminal screen): first person instead.
    Lens ~12 cm in front of the head bone, aimed at the machine, entered through a short fade with
    the ped placed while black; the body stays behind the lens and the hands reach into view (the
    Murai's choice over the shoulder for the mri_Qbanking ATM, 2026-10-24).
  - Every frame, keep the lens at least ~0.55 m from the ped's vertical axis: closer (a wall pulled
    the camera in, the ped moved), slide it sideways away from the axis. Never hide the ped to fix it.
  - Hiding is only for a shot where the player is not part of the scene and the camera has to be
    where the body is (first person, the inside of a car seen from the seat): fade with alpha over
    ~150 ms, never a cut, and say why in the code.
- **Free orbit is a sphere.** Drag (NUI `movementX/Y`, sent at most every ~33 ms) or the mouse in
  a world tool (`GetDisabledControlNormal(0, 1)` and `(0, 2)`) turns and tilts: elevation from a
  few degrees above the ground to ~80 degrees (over the roof), radius kept. Side only, never
  up and down, hides what is on top (roof, callsign, light bar). Drag down = look from above.

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

## Customizing a car (livery, extras, paint)

Pattern from `mri_Qgarage` (`modules/lib/cam.lua` `cam.hold` / `cam.nudge`, `modules/fleet/look.lua`):

- The player steers, the script never moves the camera by itself: no glide to the part on hover,
  on a row change or on a key. Tried on the garage (2026-10-21) and the owner called it awful:
  the camera ran off while the player was still looking.
- On open the camera holds (`cam.hold(true)`): the drift fades to zero and the player turns
  (drag on the scene or Q/E on the NUI, mouse in a world tool), tilts up to look from above (the
  roof and the callsign) and zooms with the wheel. Every value eases each frame
  (`1 - exp(-dt * 5)`), so input glides. On close (`cam.hold(false)`) turn and zoom reset and
  the shot eases back to the hero shot.
- Obstacles, the player's ped and the orbit follow "Obstacles and the player's ped" above.

## Getting into the car on screen

Pattern from `mri_Qgarage` (`modules/garage/preview.lua` `Preview.board`):

- `TaskEnterVehicle` to the driver's seat (-1) takes the passenger door and slides across when the
  ped stands on the passenger side or the driver's door is blocked. On a showroom shot that reads as
  a bug ("got in on the wrong side").
- Pick before the task: driver's door clear (a capsule at `GetEntryPositionOfDoor(veh, 0)`, map,
  cars and objects, ignoring the car) and the ped nearer to it than to door 1: walk (flag 1).
  Passenger side: fade the ped out (150 ms), place it yourself at the driver's entry position facing
  the car (heading of the car minus 90), then flag 1, fade back in. Never flag 2 or 3 for this: they
  warp to the entry point the task picks, which is the nearest door, the passenger's. Door blocked: same fade with flag 16 (straight into the seat).
