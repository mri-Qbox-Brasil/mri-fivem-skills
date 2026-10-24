# DUI in the world

Markers, indicators and textures that follow the world. From mri_Qblips (destination marker and
GPS route on the road). Lines marked *(not seen in game yet)* still wait for an in-game check.

## Why DUI and not NUI

- A NUI element moved to a screen position every frame (`SendNUIMessage` from a `Wait(0)` loop)
  makes the page relayout each frame; that is what made older waypoint scripts heavy.
- A DUI page is a texture: send it a message only when its content changes (label, distance in
  whole meters, color), and draw it every frame from Lua for the cost of a few natives.

## Pool and texture

- A DUI page opened as `nui://<resource>/...` has no `GetParentResourceName` and its host is not
  `cfx-nui-<resource>`: a NUI helper that detects the game by either thinks it runs in a browser and never
  calls back, so Lua waits for a "loaded" that never comes and draws nothing. Detect `location.protocol ===
  'nui:'` and post callbacks to a fixed `https://<resource>/<event>` (mri_Qinteract prompt; mri_Qcrafting
  bench card, 2026-10-24).

- `CreateDui(url, w, h)` per marker leaks texture memory when created and destroyed often: keep a
  pool (8 is plenty), mark entries busy/free, destroy all only in `onResourceStop`.
- `CreateRuntimeTxd` once, then `CreateRuntimeTextureFromDuiHandle(txd, name, GetDuiHandle(dui))`
  after `IsDuiAvailable`; wait ~250 ms more before the first `SendDuiMessage` (the page script may
  still be booting).
- Cache the last sent message per entry (the encoded string) and skip identical sends, but keep sending for a
  few seconds after each page load (a message sent before the page script runs is lost). Send only what changes:
  a shared clock rounded to the playlist turn, not every second; volume rounded to 0.01.
- Fonts: bundle the files next to the page (an OFL font like Barlow; not a paid one copied from
  another script) and list the folder in `files` (`'dui/*'` does not cover `dui/fonts/*`).
- Two pictures in one page: a 1024x1024 page with the world marker in the left half and a square
  badge in the top right; draw each part with its own UVs. One DUI per marker instead of two.
- Things of many shapes (posters, screens): a pool by exact size never hits. Use a square DUI per
  quality (512, 1024, 2048) and pass the shape to the page (`?aspect=w/h`): lay the content out in
  a `w x w/aspect` box and `transform: scaleY(innerHeight / (w/aspect))` to fill the square; the
  quad in the world stretches it back. Reuse an entry with `SetDuiUrl`, park it on `about:blank`.
  Reference: mri_Qposter `client/render.lua` and `dui/poster.html`.
- Many saved things (posters): cap the DUIs alive at once (8 is a good default, owner choice up to 16),
  give them to the closest by camera distance, and tell far or off screen pages (`IsSphereVisible`) to
  pause their video through `SendDuiMessage`. Never one DUI per saved thing in range.
- Flat on a building and seen from past ~100 m: the game swaps in the low detail model, which sticks
  out of the wall and hides the quad. Each frame pull every corner toward `GetFinalRenderedCamCoord`
  by `min(15, (dist - 20) * 0.006)` m along its line of sight: same place and size on screen, in front
  of the LOD. Reference: mri_Qposter `client/render.lua`.
- Brightness per item *(not seen in game yet)*: dim with the vertex color of `DrawTexturedPoly`
  (`r = g = b = 255 x brightness`, free and instant); brighten past 100% only in the page
  (`filter: brightness(x)` on the content, sent through `SendDuiMessage`). Reference: mri_Qposter.
- YouTube in a DUI page: an `iframe` of `youtube.com/embed/<id>?autoplay=1&mute=1&loop=1&playlist=<id>&enablejsapi=1`
  with `referrerPolicy = 'strict-origin-when-cross-origin'`. Without an origin (page opened as `file://`) YouTube
  answers "Erro 153"; served from an http(s) origin it plays. Volume, mute and pause by `postMessage`
  (`{"event":"command","func":"setVolume","args":[50]}`); resend after the iframe `load`. *(not seen in game yet)*
- Sound with distance: Lua sends a target volume with each update (`(1 - dist / range)^2 x volume`) and the
  page eases toward it every 60 ms, so 400 ms updates still fade smoothly. A poster being heard must not be
  paused by the off screen eco rule.
- Playlist that changes at the same moment for every player: send `GetCloudTimeAsInt()` with the update and
  pick `floor(clock / interval) % count` in the page; cross fade the layers and remove the old one after the
  fade (an idle iframe still costs).
- Jagged and shimmering from afar *(not seen in game yet)*: a DUI texture has no mipmaps, so a 2048 page on a
  poster that covers 150 px aliases. Pick the size from the screen: `span / dist x focal` px, with
  `focal = screenH / (2 tan(fov / 2))` (`GetActiveScreenResolution`, `GetFinalRenderedCamFov`), the smallest
  largest size at or below it (down to 32 px: rounding up or a 128 floor still leaves 2 to 4 texels per pixel and
  aliases far away), the item quality as the cap. Change only past a 15% margin and at most every 2 s; the new
  DUI loads under the old one, which is drawn 2 cm toward the camera (coplanar quads fight) and fades out once the new
  page had 1.5 s. A resize reloads the page: skip it while the item plays sound. Cap the idle pool in total too
  (several sizes now). Reference: mri_Qposter `client/render.lua` (`sizeFor`).
- Nothing pops in or out *(not seen in game yet)*: fade the vertex alpha of `DrawTexturedPoly` over the last 15% of the
  reach (at least 4 m), so the quad is already gone before the slot is freed past the keep margin. A slot that loses its
  DUI (cap, hidden, removed) goes to a `leaving` list drawn with alpha falling over ~600 ms, then back to the pool;
  if the item returns first, take the same slot back. In the page, a layer gets its `on` class (opacity transition)
  only after `load`/`loadeddata` (timeout fallback), and in a playlist the old layer stays until the new one loaded.
  Reference: mri_Qposter `client/render.lua` (`leaving`, `edge`) and `dui/poster.html` (`ready`).
- A picture that is not on the web (uploaded from a PC): the page can't tell Lua it booted, so send it with
  `SendDuiMessage` a few times after each load (300 ms, 1.2 s, 3 s, 7 s) and let the page ignore repeats.
  Reference: mri_Qposter `client/render.lua` (`feed`).
- On a vehicle: store the corners as `GetOffsetFromEntityGivenWorldCoords` offsets plus the plate; find the
  vehicle by plate in `GetGamePool('CVehicle')` in the slow loop and place the corners with
  `GetOffsetFromEntityInWorldCoords` every frame. Raycast with flag `2` so the aim can hit cars.
- Pool full when a marker is added: leave it without a page and let the slow loop take one as
  soon as another marker frees it, or it never shows.

## An interactive screen on a prop (ATM, tablet, ECU)

A page the player uses on a prop in the world, with the camera close to it. From mri_mechanic
(ECU, paint booth tablet, vinyl) and the mri_Qbanking ATM (2026-10-23).

Three ways to put the page on the world:

- **Replace the screen texture** (`AddReplaceTexture(model, screenTex, txd, tex)`): fits the screen
  mesh exactly with no corners to measure, but it is per model, so every prop of that model shows
  the page. Keep one replace at a time (the prop in use) and `RemoveReplaceTexture` when it changes
  hands. Only when that texture is the screen alone: `prop_fleeca_atm` shares `prop_fleece_emis`
  with its logo, so the logo would show the page too.
- **Quad over the glass** (`DrawTexturedPoly` from corners in the prop's own space,
  `GetOffsetFromEntityInWorldCoords` every frame, both windings): per instance, several at once.
  Needs the corners: read them from the model (mri-gta-assets, "Where things are on a prop"), not
  by eye. Lift the quad 3 to 16 mm along the screen normal (a curved glass needs more).
- **Decal** (`PatchDecalDiffuseMap(channel, txd, tex)` then `AddDecal`): to paint art on a surface,
  not to click. Channels 9100-9123 and 10000-10031; validate each at start (`AddDecal` returns 0 for
  a channel this build lacks) and keep one live DUI per distinct art (the decal reads it live).

Input, with no `SetNuiFocus` (the page is a texture):

- **Virtual cursor** (mri_mechanic): mouse deltas (`GetDisabledControlNormal(0, 1/2)`) move a point
  the page draws itself; always aligned, no geometry needed. **Game cursor** (mri_Qbanking):
  `SetMouseCursorThisFrame`, cursor at `GetDisabledControlNormal(0, 239/240)`, projected corners
  (`GetScreenCoordFromWorldCoord`) define a square-to-quad homography, its inverse gives the page
  pixel. Needs exact corners, feels native. *(not seen in game yet)*
- `SendDuiMouseMove` only when the pixel changes, `SendDuiMouseDown/Up(dui, 'left')` on 24 or 237,
  `SendDuiMouseWheel` on 241/242. The `dui` argument is what `CreateDui` returned.
- **Physical keys of the prop** (side keys, keypad, card slot): quads in the prop's space read from
  its texture, projected each frame and hit tested as two triangles; light the hovered one with
  `DrawPoly` (both windings, 2 mm off the surface) and send `{ key }` to the page. Lay the page's
  options at the height of each side key (`dot(center - screenTopLeft, down) / |down|²`), sent from
  Lua per model. *(not seen in game yet)*
- `DisableAllControlActions(0)` plus `EnableControlAction(0, 249)` (voice), `DisableFrontendThisFrame`
  every frame and ~600 ms after closing (Esc closes this frame, the pause opens on the next), and the
  `escBusy` state for the MRI pause.

Page and camera:

- The same React build opened with `?dui=<mode>` from `https://cfx-nui-<resource>/...`; it calls
  the resource's NUI callbacks like the NUI page does. The page tells Lua it booted (a callback)
  before the first `SendDuiMessage`. One DUI for every prop of the kind, made on first use and kept.
- Opaque page (skip the glass theme there) and sizes in px for the DUI resolution; fonts big enough
  for the screen's share of the view.
- A machine the player stands at (ATM): first person. The lens ~12 cm in front of the head bone
  (31086), toward the machine, aimed at the center of everything usable (screen, keys, slot), FOV
  from the widest point (`2 atan(max tan / 0.88)`, 38 to 70). The body stays behind the lens and only
  the hands reach into view, so nothing is hidden. Enter and leave through a 250/300 ms fade (place
  the ped while black) with a small lens push after it: a glide from the game view crosses the body
  (mri_Qbanking, 2026-10-24: the framed shot along the screen normal went through the torso and the
  Murai asked for the old mri_Qatm view). Never `SetEntityLocallyInvisible` here: it hides the hands,
  the card and the cash. Keep drawing the screen until the fade is black.
- The prop's animations (`anim@mp_atm@*`, `mp_common givetake2_a`) only line up with the ped placed
  square in front and held: `FreezeEntityPosition`, `SetEntityCoords` at a fixed offset on the
  prop's front (ATM: 0.6 m, wall `prop_atm_01` 0.8 m), the prop's heading; unfreeze on close.
  Turning toward it is not enough (mri_Qbanking, 2026-10-24).
- A machine sound that lasts: a looping game sound with `GetSoundId`, `PlaySoundFrontend(id, ...)`,
  `StopSound` and `ReleaseSoundId` (note counter: `Money_Counter_Loop`,
  `DLC_Biker_Business_CFM_Sounds`). Let Lua tell the page when it ended. *(not heard in game yet)*
- Props in the hand (card, cash) are local objects (`CreateObject(..., false, false, false)`).

## Destination height and the waypoint

- A map waypoint has no real height: start at `GetHeightmapTopZForPosition` (works unstreamed),
  snap with `GetGroundZFor_3dCoord(x, y, 1000)` once found, and show no up/down until then.
- A point a script sends keeps its z: snapping it from 1000 m puts an upper floor on the roof.
  Snap only the map waypoint, a point sent from a waypoint (flag it) or z = 0.
- Removing a marker that set the waypoint turns it off only if the waypoint is still on that spot:
  the player may have marked somewhere else since.

## Upright in the world (billboard)

- Four corners from the point: `right = (-toCam.y, toCam.x, 0) / |toCam.xy|`, width = height x
  aspect, bottom edge on the ground point. Draw two triangles with `DrawTexturedPoly` and UVs
  (u 0..0.5 for the left half), and draw both windings: the game culls one side.
- Height = camera distance x a size factor, clamped (e.g. 1.2 to 80 m): it holds its size on
  screen and stays readable far away, and it is hidden behind buildings like a real object.
- Fade in on creation (~350 ms) and out as the player walks up (20 m to 6 m), so it never pops.

## Pinned on screen *(not seen in game yet)*

- `GetScreenCoordFromWorldCoord` gives the point; `DrawSpriteUv(txd, tex, x, y, w, h, u1, v1, u2,
  v2, heading, r, g, b, a)` draws the chosen part at a fixed screen size (`w = h x aspect /
  GetAspectRatio(false)`).

## Screen edge indicator *(direction of the rotation not seen in game yet)*

- Visible means on screen and inside a small margin (~4%); otherwise draw at the border.
- Direction on the screen plane from the camera axes (`GetFinalRenderedCamRot(2)`): forward
  `(-sin z cos x, cos z cos x, sin x)`, right `(cos z, sin z, 0)`, up = right x forward. Project
  `target - cam` on right and up; behind the camera push the vector toward the bottom.
- Ease the angle per marker (`angle += wrap(target - angle) x min(1, frame x 10)`) so it glides.
- Arrow: a white DUI texture tinted by the sprite color, rotated with the sprite heading. Badge:
  the marker's own square part with the arrow orbiting its ring.

## GPS route painted on the road

- Sample the waypoint route with `GetPosAlongGpsTypeRoute(true, dist, 0)` every 2.5 m. Don't gate
  on `GetGpsBlipRouteFound()`: it is always false for the player's map waypoint.
- Ground: `GetGroundZFor_3dCoord(x, y, z + 1.5)` and keep it only within ~2.5 m of the route node
  height, or the ribbon jumps onto bridges and roofs.
- One continuous ribbon with mitered edges (cap the miter at ~1.35x), each point at its own
  height. The pattern (chevron, dash...) is a white DUI canvas tile tinted by the vertex color,
  V = distance / tile length minus a time offset so it flows toward the destination. Technique
  after l2k_gps3d (MIT): credit it.
- Performance (validated with resmon): build the whole mesh as plain numbers when the route is
  sampled (150 to 350 ms), never per frame; the frame only loops the rows and calls
  `DrawTexturedPoly`. Drop points on straight, flat stretches (direction change under ~2 degrees,
  quads up to 25 m): the tile wraps, so it looks the same with far fewer calls.
- Skip the resample (about 130 route and ground probes) while the player stands still with the
  same destination, look and color: the route is identical. Compare the color as a string, a
  freshly built table never matches. With route and marker on, mri_Qblips measured 0.18 ms.
- Driving, all probes plus the mesh build in one frame showed as resmon spikes (0.40 ms). Spread
  them: `Wait(0)` every ~12 probes and before the build, and resample every 250 ms at speed (the
  start of the ribbon fades out under the car anyway). Each point is still a world position on
  the route and `at` is summed from real spacing, so a chunked list is a valid polyline.

## Waypoint color

- The map waypoint and its route use HUD colours 142 (waypoint), 150 (light) and 151 (dark);
  `ReplaceHudColourWithRgba` on all three recolors them for that client. Restore the defaults
  (164, 76, 242) on stop.
