# Transitions

The rule: no passage is a hard cut, unless it is a deliberate film cut (through black, with
time). Every switch has three layers that must move together: interface (NUI), camera and
peds.

## Glide vs cut

- Glide: timed interpolation from the current pose (position and aim point) to the new one,
  with ease-in-out. Keep `glideStart`, `target`, `glideAt`, `glideDur` and compute per frame
  in the render thread.
- Cut: `DoScreenFadeOut(out)`, wait for `IsScreenFadedOut()`, snap the camera,
  `SetFocusPosAndVel` on the destination, wait for collision (`RequestCollisionAtCoord` +
  `HasCollisionLoadedAroundEntity`, with a cap), `DoScreenFadeIn(in)`.
- Choose by distance: above `cutDistance` (18 m is a good default) cut, below it glide. A
  camera flying far crosses unstreamed area and shows the void.
- Times: quick switch between neighbor characters 0.75 s glide; navigation cut 200/240 ms;
  dramatic cut (entering a new phase) 700/1100 ms. The same cut with short times on an
  important passage looks like a bug.
- If a cut is running and another request arrives, only update the pending target. The
  running cut applies the last one.

## Glide around the subject, never through it

A straight lerp of position and aim point breaks when the glide starts on the other side of
the subject (the player looking at an NPC's back, the shot is on its face): the camera crosses
the peds and the aim point passes behind the camera, so the view spins 180 degrees in one frame.

- Position orbits the target's aim point: interpolate the angle around it (shortest way),
  the flat radius and the height separately.
- Aim turns as a direction: yaw (shortest way) and pitch, plus the aim distance. Never lerp the
  aim point.
- More turn, more time: add up to ~0.7 s at 180 degrees over the base glide.
- Small turns look the same as a lerp, so every glide can use it.
- With a crane arc, add the rise to the orbit height and keep the aim as a direction.

Reference: `glide()` and `setShot()` in `mri_Qnpc` `client/dialog.lua`; `blend()` in `mri_Qgarage`
`modules/lib/cam.lua` (around the car, with the crane arc, into and out of the showroom shot).

## Arc (crane)

To enter a new phase, the camera rises midway instead of going straight:

```lua
cur.z = glideStart.z + (target.z - glideStart.z) * e + glideArc * math.sin(math.pi * e)
```

`e` is the eased progress. A 1 to 1.5 m arc over 2.4 to 2.8 s feels like a film shot.
Reference: `beginGlide(target, duration, arc)` in the multichar's `client/showroom.lua`.

## Peds entering and leaving

- Never `SetEntityVisible(false)` straight in front of the camera. Fade alpha
  (`SetEntityAlpha` per frame, 600 to 700 ms), then hide and `ResetEntityAlpha`.
- A new ped enters with alpha 0 to 255 (300 ms on a switch, 900 ms on the first appearance).
- Live model swap (e.g. gender): crossfade, the new one rises while the old one fades, and the
  old one is deleted at the end.
- Wait for the stage to be empty before putting the new ped on the same spot.
- Cancel in the middle of a fade: the fade thread must check that the state is still the
  same and stop. Otherwise it fights the fade back.
- Removed character (delete): fades out, the following ones move one position (short fade,
  reposition, fade back). Without rebuilding the scene.

## World props collected and coming back

A tree, rock or wreck taken by a player never blinks out (Murai, 2026-10-23: "não é nada triple A").

- **Leave:** a breakage burst of its material from the `core` asset (`ent_brk_tree_trunk_bark` +
  `ent_brk_tree_leaves` for trees, `ent_brk_concrete` rock, `ent_brk_metal_frag` scrap,
  `ent_brk_wood_planks` crates), then alpha 255 to 0 over 900 ms with smoothstep while a script
  prop sinks 0.8 m (`SetEntityCoordsNoOffset`). Delete or model hide only at the end.
- **Come back:** alpha 0 to 255 over 1.4 s, the script prop rising out of the ground. A map prop
  streams back a few frames after `RemoveModelHide`: find it with `GetClosestObjectOfType` first.
- **A standing tree falls** (not logs, stumps or fallen ones): turn its matrix around the base
  (`GetEntityMatrix`, Rodrigues around `Z x direction`, `SetEntityMatrix`) to 86 degrees with
  `angle * t^2` over 1.8 s, away from where the collector stood (the server sends it, so every
  client drops it the same way). On impact: leaves at 60% of the height, a thud, a light
  `SMALL_EXPLOSION_SHAKE` (0.08) within 25 m, a 5 degree bounce, 1.2 s at rest, then fade and sink.
  A map tree is hidden at once and a script copy at its exact matrix does the falling (the model
  hide skips script objects).
- **Only when watched:** farther than 80 m or not `IsSphereVisible`, swap at once. Props already
  taken when the player connects never animate.
- **End of the work animation:** never `ClearPedTasks` right on the bar's end. Blend the loop
  out (`StopAnimTask` exit speed 1.5) and, on success, blend into a short beat that shows the result
  (`pickup_object` / `pickup_low`, blend 2.0, 1.2 s): the motion covers the tool prop going away.
  Reference: mri_Qfarm `client/world/fx.lua`, `Utils.endAnimation`.

## Interface following the camera

Sequence that works to enter a phase (e.g. selection to creation):

1. t=0: the current screen leaves (`opacity 1 -> 0`, `translateY(8px) scale(.985)`,
   `blur(4px)`, 650 ms), without pointer events. The camera already starts the arc and the
   peds the fade.
2. The old screen stays mounted during the exit (a `leaving` state with a timeout equal to
   the animation) and only then unmounts.
3. The new screen mounts at t=0 (to fire the Lua callbacks), but enters with a delay:
   `animation: in .95s ease .7s both` with `opacity`, `translateY(12px)` and `blur(6px)`.

Leaving the landing (instead of the selection): make the landing leave the same way and
switch the route only after the timeout, or the selection flickers in the middle.

Screen over the world (garage, shop, showcase):

- Vignette and dimming enter together with the camera glide (`opacity 0 -> 1` over the glide
  duration), never ready on the frame the NUI mounts: dimming at once looks like a bug.
- Pieces enter in cascade after the entrance delay (top, info, counter, list, controls,
  ~90 ms apart); list items rise from the selected one outward.
- Meters and bars start at 0 and fill on screen (value applied after the delay).
- The cascade is only for the first entrance: changing items animates fast (~260 ms), no
  delay, or the panel vanishes on every change.

## Arrival and end of flow

- Last scene: name as credit, the camera glides into the game camera
  (`RenderScriptCams(false, true, ms)`), control returns.
- A dark screen between long phases (editor closed, arrival scene loading) is acceptable if
  it is a fade, never a frame of raw world.
