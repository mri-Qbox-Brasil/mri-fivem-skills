---
name: mri-world-placement
description: "World placement standard for FiveM resource creation panels - place an NPC, object or point by aiming with a preview (ghost), mark a box zone with heading and size around the player (elevator floor, garage spot), record a route or path stop by stop with a line on the ground, a key rail on the NUI instead of a textUI, NPCs walking the route without stalling, NPCs roaming an area like locals (sidewalk spots, ambient scenarios, never down the street), collectable props spread over a marked area or picked by model on the map (trees, rocks, wrecks that vanish for everyone and respawn), and the shared map panel (list, map, editor). Ships the ready Lua module (WorldPlacer.point, WorldPlacer.zone and WorldPlacer.path), the React rail (PlaceRail) and the rules that prevent flickering markers, missed keys, coordinate fields and typed player ids. Use when asked to \"place in the world\", \"record a route\", \"place the NPC/object/zone in game\", \"in-game creator\", \"the marker flickers\", \"I don't want to type coordinates\", \"props to collect in an area\" (pt-BR: \"zona de coleta com props\", \"posicionar no mundo\", \"marcar rota\", \"o marcador tá piscando\", \"não quero digitar coordenada\"), or when building any admin panel that stores a position, heading, zone or path."
---

# World placement

A creation panel **configures, it doesn't program**. Position, heading, size and path are
marked in the world, with a preview; never a number field, a coordinate or a typed name.

## Tools

| Tool | For | Module |
| --- | --- | --- |
| Point with ghost | NPC or object: a see-through copy follows the aim (`object = true` for a prop: `CreateObject` local, mri_Qcrafting bench). Without `model` (interaction point: clock-in, register, stash) a small sphere (`DrawMarker` 28, scale 0.1: the scale is the radius) in the `mri:color` accent follows the aim, the same cursor as the mri_Qbox zone drawer, and there is no heading | `WorldPlacer.point` |
| Path | NPC route, trail, fence: stops with a line on the ground | `WorldPlacer.path` |
| Zone (box with heading) | a real area that faces a way: elevator floor, garage spot, trigger area. Never a stash, register or bench: those are points, a sphere target around where the admin aims (mri_Qstashes moved off zones on 2026-10-21) | `WorldPlacer.zone` |

Picking a thing that already stands in the world (a door, a prop to bind) follows the same keys:
aim, `E` picks, `Backspace` undoes the last pick or cancels, `Esc` cancels. The aim thread does the
raycast and, for props without collision (doors driven by the DoorSystem), the object of
`GetGamePool('CObject')` whose model center (`GetModelDimensions` midpoint through `GetOffsetFromEntityInWorldCoords`, not the origin, which on a door is the hinge) is closest to the camera ray. Every frame of the aim thread: a throttled scan makes the marker and the outline jump in steps. The marker sits on that center when the ray went through. The draw loop only
outlines the aimed entity (`SetEntityDrawOutline`) and reads it. Outline color and shader are global to the whole game, so set them right before every `SetEntityDrawOutline(entity, true)` (`SetEntityDrawOutlineShader(0)`, `SetEntityDrawOutlineColor(255, 255, 255, 255)`): another script that fades the alpha to 0 (mri_Qspawn arrival pulse) otherwise leaves every outline invisible, and the code logs the outline as on. Never `FindFirstObject` every
frame. Reference: `mri_Qdoorlock` `client/picker.lua` (one or two leaves of a double door).

**Object on the floor:** the saved point is where the aim hit the floor, and many props have their origin in the middle of the model, so moving the ghost with `SetEntityCoords` sinks half of it (mri_Qstashes, 2026-10-23). The ghost moves with `SetEntityCoordsNoOffset` at `z - GetModelDimensions(model).z` (min z, the bottom), and the resource spawns the final prop the same way (`CreateObjectNoOffset` with the same lift), so what the admin saw is what stays.

Pick by shape: a model to stand somewhere is a point; a sequence is a path; a volume with a
front is a zone. The zone sits on the player (walk to it, the player's heading turns it), with
a yellow box, an arrow for the heading and the size written above; zones already placed show
in green with their label (`refs`). `multiple` marks several in a row (floors of an elevator).
Pattern from `mri_Qelevators` (`client/placement.lua`).

When a **player** places their own thing (a stash from an item, not the admin panel), pass `range` (8 m in mri_Qstashes) so the ghost never goes farther than that from them, and the server checks the same distance again before saving. The server sends the event that opens the tool after the item is used and only spends the item when the spot comes back.

### Keys (the same in every resource)

| Key | Point | Path | Zone |
| --- | --- | --- | --- |
| Aim / walk | moves the ghost | previews the next stop | the box follows the player |
| `E` or shot (left click) | confirm | mark stop | mark (single: confirm) |
| `←` `→`, wheel | rotate | | wheel: width; `Shift` + wheel: height |
| `Backspace` | cancel | undo the last one | undo the last one (single: cancel) |
| `Enter` | | finish (no stop = cancel) | finish (no zone = cancel) |
| `Esc` | cancel | cancel | cancel |

`mri_Qelevators` itself still finishes on `Backspace` (it predates this standard).
Cancelling always gives back what was there before. Sound: `SELECT` on mark, `BACK` on undo
or cancel (`HUD_FRONTEND_DEFAULT_SOUNDSET`).

## Wiring into a resource

1. `templates/placement.lua` into `client/` (rename the global). Before the files that use
   it in `fxmanifest.lua`; a new file in the manifest needs `refresh` before `ensure`.
2. `templates/panel.lua`: `place`, `recordRoute` and `placeZone` callbacks with `inWorld`
   (hides the panel, runs the tool, comes back with the result; inside mri_Qadmin it closes
   and reopens the tab). When the panel unmounts while hidden and asks for the result on
   mount (a take-once callback), write the result to a module-level draft as soon as it
   arrives: React StrictMode runs the mount effect twice in dev and the first run would eat it.
3. NUI: `templates/PlaceRail.tsx` and the keys from `templates/rail.locales.json`. A store
   with `hud` fed by the `placeHud` message (`false` clears it). The rail shows with the panel
   hidden, on the resource's own ui_page; inside the Qadmin iframe it doesn't render (the
   iframe is hidden).
4. On the panel the result becomes a **summary**, not numbers: "3 stops · 29 m · there and
   back", "Position marked". A "Mark again" button starts over.
   Every placed thing also gets **Go there** (server checks the admin, closes the panel, puts the
   player on the nearest walkable spot), ready in `templates/goto.lua` (copy it, never rewrite it), and **Remove** when it is optional. No X/Y/Z anywhere, not
   even behind an "edit manually" toggle.
   **Edit from the target.** Every placed thing that has a target (stash, bench, NPC, door) gets a
   second option, only for admins: "Edit", which opens the panel with that item already selected,
   so the admin fixes it standing in front of it instead of hunting it in the list. The client asks
   the server once on character load (`lib.callback`, the same check the panel uses) and keeps a
   flag for `canInteract`; the flag only hides the option, every panel callback still checks the
   admin on the server. Reference: `mri_Qstashes` (`client/stashes.lua`, `Stashes.onEdit` into
   `Panel.open(id)`).
   **Go there loads the place first.** Far away the map, collision and navmesh aren't streamed:
   a bare `SetEntityCoords` drops the player into an empty world, and `GetSafeCoordForPed` called
   before the move finds no navmesh and returns false. Order: fade out (wait `IsScreenFadedOut`),
   freeze the ped (or the vehicle), move to the point, `NewLoadSceneStartSphere(x, y, z, 80.0, 0)`,
   loop `RequestCollisionAtCoord` + `Wait(0)` until `IsNewLoadSceneLoaded`,
   `HasCollisionLoadedAroundEntity` and `IsNavmeshLoadedInArea` (±20 m) or 8 s pass,
   `NewLoadSceneStop`, only then `GetSafeCoordForPed(x, y, z, false, 32)` (flag 32 = flood fill
   from the point) and move there if found, unfreeze, fade in. `templates/goto.lua` does all of it.

## Map panel (list, map, editor)

A panel whose items live on the map (elevators, blips, garages, zones) uses the same three
columns everywhere: the list with search on the left, the GTA map in the middle, the editor of
the selected item on the right. Clicking the list or the map selects; the map flies to the
selection and shows its parts (floors, slots, NPC). A map that only draws names is useless: each
item gets a pin at its center (visible at any zoom) with a summary in the tooltip, the selected item
gets a card over the map with its name, a one-line summary and its actions (Go there, redraw), and a
small legend explains the colors. The map only shows, selects and acts: marking a
position is still done in the world with the tools above (a pin may be dragged to fine tune).
In a React NUI with `@mriqbox/ui-kit` this is `MriMapEditorLayout` with `MriGameMap` (see the
ui-kit docs); never a hand-made Leaflet map per resource. The card and the legend are the kit's
(4.39.0+): `<MriGameMap overlay={<>{selected && <MriMapSelectedCard title subtitle goToLabel onGoTo actions />}<MriMapLegend items />}</>}>`,
with `onGoTo` calling the `goThere` callback of `templates/goto.lua`. A panel with a map and no card with Go there is not done.

## Frame rules (no flicker, no missed keys)

- `DrawMarker`, `DrawLine` and `DisableControlAction` last one frame: call them every frame,
  in a loop that only has `Wait(0)`.
- Nothing that waits inside that loop: `lib.raycast.fromCamera` does a `Wait(0)` inside, and
  in the same loop the drawing shows every other frame (flicker) and `JustPressed` gets lost.
  The aim runs on its own thread (`trackAim`) and the loop only reads `aim.coords`. The same
  goes for `lib.requestModel`, `lib.callback.await` and any `Wait(n)`.
- Admins mark from noclip: the mri_Qadmin noclip calls `DisableAllControlActions` every frame and
  uses E to go down, so `IsControlJustPressed(0, 38)` never fires there. Read every tool key with
  `IsDisabledControlJustPressed`/`IsDisabledControlPressed` and also accept a shot (left click, 24)
  as mark, shown on the rail (mri_Qposter, 2026-10-21). Aim with `GetFinalRenderedCam*`, never the
  gameplay cam: in noclip the rendered camera is the scripted one.
- A blocked key (Esc 200, Enter 191, wheel 14/15) only answers through
  `IsDisabledControlJustPressed`.
- Enter is 191 (`INPUT_FRONTEND_RDOWN`) plus 201, both disabled every frame. Never 176 alone
  (`INPUT_CELLPHONE_SELECT`): the garage spot tool finished on it and Enter did nothing in game
  (mri_Qgarage, 2026-10-21). Old tools: grep the key loop for 176 before calling Enter done.
- Esc opens the pause menu on release, after the tool already stopped blocking it: on cancel,
  keep `DisableControlAction(0, 200)` every frame until the key is up (`releaseEsc`).
- While a tool runs, `LocalPlayer.state.escBusy` is true (set with the rail, cleared after Esc is
  up). Custom pause menus read Esc even while it is blocked (mri_Qpausemenu opens on
  `IsDisabledControlJustPressed(0, 200)`) and stay shut while it is set; blocking the control alone
  does not stop them. Clear it on `onResourceStop` too, or a restart mid-tool locks the pause menu.
- ox_inventory keeps its keybinds (TAB hotbar, 1 to 5 slots, inventory key) live during a tool, and
  `DisableControlAction` does not stop a `lib.addKeybind`. A tool that uses those keys sets
  `LocalPlayer.state` `invHotkeys = false` and `invBusy = true`, saves the old values and puts them
  back on exit and on `onResourceStop` (mri_Qobjects build mode, 2026-10-21: TAB opened the hotbar).
- A resource with world tools of its own (older than `WorldPlacer`): every one of them follows
  these rules too. Give them one shared end function (hide the rail, `releaseEsc`) and call it
  from every exit, instead of fixing them one by one when a player trips on it (mri_Qgarage
  `Rail.finish`).
- Putting the player's ped at a spot it chose (sit anywhere, lean, lie): test the body's volume
  there first with `StartShapeTestCapsule` (flags `1 | 2 | 16`, async: poll `GetShapeTestResult`
  until the status is not 1, so only from a thread that may wait), one capsule per body part
  (torso, legs, standing body at the stand-up spot), plus a line probe from the player's chest to
  the spot. Guessing from rays alone (ledge in front, ground height) sinks the ped into walls and
  floors. Scenario poses take different points: seat scenarios (`PROP_HUMAN_SEAT_*`) the seat top,
  ground ones (`WORLD_HUMAN_PICNIC`, `_LEANING`) the ped root, about 1 m over the feet
  (`GetEntityCoords(ped).z - floor.z`). After a scenario exit, put the ped back on the stand-up spot
  when it ended far from it. Show the choice with the ghost in the pose (green ring fits, red does
  not, the reason on the rail); never sit on a spot the test refused. Reference: mri_Qsit
  `client/spot.lua` (2026-10-23).
- Ghost: alpha 170, no collision, frozen, `SetBlockingOfNonTemporaryEvents`. Only move it
  when the aim changed. The model accepts a numeric hash (`tonumber(model) or joaat(model)`).
- Raycast `1 | 16` (world and objects), ignoring the player's own ped.
- A spot the admin marked is trusted when it is used later: the ground comes from a probe that sees
  props (a helipad is often one; `GetGroundZFor_3dCoord` skips them) with the saved height as
  fallback, and only another vehicle blocks it. A box test against everything at the model's size
  fails on helicopters (the rotor touches the rails) and the car lands somewhere else (mri_Qgarage
  `Ghost.isSpotFree(..., marked)`, 2026-10-21). With every marked spot of the type taken, never fall
  back to a place near the player: show the item on a spot and refuse the action with a reason on the
  button ("Spots taken").
- No `lib.showTextUI`, ox_lib menu or instruction `DrawText`: the rail belongs to the NUI.

## What the system decides by itself

- Time is a ready choice ("passes by", "stops a bit", "stays a while"), never `+`/`-`.
- What can be deduced doesn't become an option: a route ending less than 8 m from the start
  loops, otherwise it goes there and back.
- Linking one thing to another (which NPC to release, which floor) is picking from a list of
  names.
- Acting on another player (hire, invite, hand over) is picking from the players near you:
  name, current group and distance, with a refresh button. Never a server id field. The
  server builds the list with the same reach the action checks, so the list never offers
  someone the action then refuses.
- A vehicle's look (livery, extras, paint) is set on the car itself: a local copy stands in front
  of the admin, the rail changes it (arrows livery and extra, `Space` toggles, `Q`/`E` paint from
  a named list) and `Enter` saves the props. Read the counts from the car (`GetVehicleLiveryCount`,
  else `GetNumVehicleMods(veh, 48)`, `DoesExtraExist` 0 to 20): never a livery or extra number
  field. A car just created reads 0 liveries until the game streams them in (the second open
  works, the model is cached): poll the counts for up to 1.5 s before saying it has none
  (`utils.lookParts`). The player steers the camera (mri-game-ux, camera-scene.md).
  Reference: `mri_Qgarage` `modules/fleet/look.lua`.

## In-world catalog and tools

- Catalog on the right and tools on the left as floating side panels, the world in the middle.
  A bottom drawer covers half the screen, and the hover preview prop (drawn at a screen point)
  ends up behind it (mri_Qobjects, 2026-10-20).
- The NUI sends where the preview goes: the middle of the gap between the panels, from their
  `getBoundingClientRect()`, as `sx, sy` (0-1) for `GetWorldCoordFromScreenCoord`.
- A tool that picks a model (brush, replace) shows its settings in the tools panel and picks
  from the catalog grid; the grid click does not place in that mode.
- A world action started from the panels hides them and brings them back, as they were, when it
  ends or is cancelled: keep the panels mounted while hidden (search, category and open tool
  survive) and reopen from the mode change back to browse. A tool that refused to start drops the
  request, or the panels pop up later at random.
- Placing several in a row is a visible switch in the catalog, not a hidden Shift+click.

## Erasing a map prop

A deleted ymap prop comes back whenever its area streams in again. Use both:

- `CreateModelHideExcludingScriptObjects(x, y, z, 0.5, model, true)` at the saved position, so
  the streamer never recreates it. Plain `CreateModelHide` also hides your own props of that
  model; a big radius hides the neighbour (erase one chair, the whole table goes).
- A reaper loop every few seconds near the camera (`GetClosestObjectOfType` + `DeleteObject`)
  for the instance already streamed in and builds where the hide misses.
- `RemoveModelHide(..., false)` on restore and in `onResourceStop`, or hides stack on restart
  and one remove no longer brings the prop back. (mri_mechanic, mri_Qobjects, 2026-10-20)

**Moving a map prop** is the same erase plus a script copy: read `GetEntityArchetypeName`,
`GetEntityCoords` and `GetEntityRotation(ent, 2)`, save a copy at that pose, hide the
original, then open the gizmo on the copy. The reaper must skip your own handles of the same
model, or it deletes the copy. Skip mission entities (other scripts' props).

**Doors and gates placed by script** only work with a door lock (`AddDoorToSystem` by model and
coords, as ox_doorlock does) when the object is not frozen: a frozen door stays shut. Save a
fixed/loose flag per prop (loose = `FreezeEntityPosition(false)` + `ActivatePhysics`), start
door and gate models loose, freeze them only while the gizmo holds them. (mri_Qmapeditor,
2026-10-22)

## Collectable props (farm fields)

Trees, rocks or wrecks anyone with access collects, gone for everyone until they respawn.

- **Props spread over an area:** the area tool (box around the player, wheel width, Shift + wheel
  length) finds the free ground on the admin's client when E confirms: random points at least
  3 m apart, `GetGroundZExcludingObjectsFor_3dCoord`, not `IsPointOnRoad`, not under
  `GetWaterHeightNoWaves`. Save the spots with the area; never probe the ground on other clients.
- **Which prop on which spot** comes from a pure function seeded with the farm id, so the server and
  every client agree without sending a list. Spawn local objects (`CreateObjectNoOffset`, not
  networked) near the area for everyone; only who has access gets the interaction.
- **Map props by model:** `GetGamePool('CObject')` near the player, model in the set and not
  `IsEntityAMissionEntity` (another script's copy can't be hidden). Name it `model@x,y,z` rounded
  to the metre; the server checks the model belongs to the farm and the place is inside the area.
- **Picking a model by aiming** (any game object, not only the photo list): camera raycast on its
  own thread with flags `1 | 16 | 256` (256 = foliage, or trees and bushes are missed), keep only
  `GetEntityType == 3`, name it with `GetEntityArchetypeName` (empty = can't pick), outline the
  aimed one (`SetEntityDrawOutline`, cleared when the aim moves and on exit) and show the name on
  the rail. E picks, Backspace undoes, Enter finishes.
- **Props with life, brought down by hitting:** per item, a list of melee weapons with hits to
  bring it down (and wear per hit); each hit takes 1/hits of the prop's life, so weapons and players
  add up, and it heals after 2 min untouched. Detect the swing on the client by the rising edge of
  `IsPedPerformingMeleeAction`, land it ~300 ms later on the nearest prop in front (2D distance and
  forward dot), not by damage events (frozen local objects and map props don't report melee
  reliably). The server reads the weapon itself (`GetSelectedPedWeapon`, server side), checks reach
  and a gap between hits, wears the weapon (`GetCurrentWeapon` + `SetDurability`) and pays on the
  hit that empties the life. The hitter sees the impact at once; the others get it from the broadcast,
  with the attacker id so nobody plays it twice.
  **Lock the aim** while a working tool is in hand: the nearest such prop in reach gets an outline
  (`SetEntityDrawOutline`, cleared on change and on resource stop) and its life bar stays up; on
  the attack controls (24, 140, 141, 142) turn the ped to it (`SetEntityHeading` from
  `GetHeadingFromVector_2d`) and land the blow on it, so a swing from the side still counts.
- **Prompt height on a tall prop:** an entity interaction without an offset sits at the model box
  center (mri_Qinteract's ox_target answer), up in a tree's crown. Pass `offsetAbsolute` (ox_target)
  / `offset` (interact) in metres from the origin: the player's chest height, clamped to the
  model's own `GetModelDimensions` min and max z. Same for bars and hints over the prop.
- **Taken:** the server holds who is collecting (one player per prop), broadcasts taken and back,
  and answers the taken list to a client that just loaded, after its fields are mounted. Taken zone
  prop: delete it; map prop: model hide (above). Reference: mri_Qfarm `client/world/fields.lua`,
  `server/modules/fields.lua` (2026-10-23).

## NPC walking the route

Reference: `mri_Qnpc` (`client/route.lua`).

- Shared clock (`GetCloudTimeAsInt()`): every client computes the same leg, everyone sees the
  NPC in the same place. Leg time = distance x 1.15 / speed (walking 1.3 m/s, running
  3.2 m/s).
- `TaskFollowNavMeshToCoord` to the stop. A stop without a wait hands over to the next one
  before arriving (2 m walking, 3.5 m running): waiting to arrive makes the ped brake at
  every point.
- Don't call `ClearPedTasksImmediately` between legs: it resets the stride and the ped stops
  dead. Clear only after a stop animation.
- Standing still for 3 s (no navmesh: interior, prop floor): `TaskGoStraightToCoord`. Only
  teleport to the stop if the leg's deadline runs out.
- At a stop with a wait: `TaskAchieveHeading` to the saved heading, then the animation.
- Talking to the player: `ClearPedTasks`, wait for the conversation to end and resume the
  leg.
- Spawn point at the route center with radius = spawn distance + route reach.

## NPC roaming like a local

Reference: `mri_Qnpc` (`NpcRoute.wander` in `client/route.lua`).

- Never `TaskWanderInArea` for a ped that should look like a local: it picks any point of the
  area and the ped walks down the middle of the street (mri_Qnpc, 2026-10-22).
- Pick the next spot yourself: a random point in the circle (`sqrt(random) * radius` spreads it
  evenly), snapped with `GetSafeCoordForPed(x, y, z, true, 1 | 2)` (pavement only, not isolated);
  drop results outside the circle or more than a few meters above or below. A few tries, then stay
  where it is (park, interior: no pavement).
- Walk there with `TaskFollowNavMeshToCoord` at speed 1.0 and a deadline; stop and do something
  for 8 to 25 s like GTA's own peds: the NPC's own animation if it has one, else a random ambient
  scenario (`WORLD_HUMAN_STAND_MOBILE`, `_SMOKING`, `_HANG_OUT_STREET`, `_STAND_IMPATIENT`,
  `_TOURIST_MAP`, `_DRINKING`, `_WINDOW_SHOP_BROWSE`, `_AA_COFFEE`), then `ClearPedTasks` and
  a short wait so the scenario exit plays before the next walk.
- Talking to the player: `ClearPedTasks`, wait for the conversation to end, go on.
- Roaming is local to each client (each player sees the ped somewhere else in the area), so a ped
  that must be the same for everyone (guard, killable, networked) only stands or follows a route.
- Interaction on a moving ped: target on the entity (it follows the ped) or a key prompt checked
  against the ped's position, never a fixed point at its spawn.

## Verify

- Browser: send `placeHud` through the dev mock and check the rail (pt-BR and English,
  narrow screen).
- Game (only it shows): markers steady while the camera turns, E takes on the first press,
  Esc doesn't open the pause menu, cancelling and finishing without stops keep the previous
  value, the panel comes back on the same item.
