# DUI in the world

Markers, indicators and textures that follow the world. From mri_Qblips (destination marker and
GPS route on the road). Lines marked *(not seen in game yet)* still wait for an in-game check.

## Why DUI and not NUI

- A NUI element moved to a screen position every frame (`SendNUIMessage` from a `Wait(0)` loop)
  makes the page relayout each frame; that is what made older waypoint scripts heavy.
- A DUI page is a texture: send it a message only when its content changes (label, distance in
  whole meters, color), and draw it every frame from Lua for the cost of a few natives.

## Pool and texture

- `CreateDui(url, w, h)` per marker leaks texture memory when created and destroyed often: keep a
  pool (8 is plenty), mark entries busy/free, destroy all only in `onResourceStop`.
- `CreateRuntimeTxd` once, then `CreateRuntimeTextureFromDuiHandle(txd, name, GetDuiHandle(dui))`
  after `IsDuiAvailable`; wait ~250 ms more before the first `SendDuiMessage` (the page script may
  still be booting).
- Cache the last sent message per entry (a key string) and skip identical sends.
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
- A picture that is not on the web (uploaded from a PC): the page can't tell Lua it booted, so send it with
  `SendDuiMessage` a few times after each load (300 ms, 1.2 s, 3 s, 7 s) and let the page ignore repeats.
  Reference: mri_Qposter `client/render.lua` (`feed`).
- On a vehicle: store the corners as `GetOffsetFromEntityGivenWorldCoords` offsets plus the plate; find the
  vehicle by plate in `GetGamePool('CVehicle')` in the slow loop and place the corners with
  `GetOffsetFromEntityInWorldCoords` every frame. Raycast with flag `2` so the aim can hit cars.
- Pool full when a marker is added: leave it without a page and let the slow loop take one as
  soon as another marker frees it, or it never shows.

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
