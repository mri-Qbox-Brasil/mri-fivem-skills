---
name: mri-world-placement
description: "World placement standard for FiveM resource creation panels - place an NPC, object or point by aiming with a preview (ghost), mark a box zone with heading and size around the player (elevator floor, garage spot, stash), record a route or path stop by stop with a line on the ground, a key rail on the NUI instead of a textUI, and NPCs walking the route without stalling. Ships the ready Lua module (WorldPlacer.point, WorldPlacer.zone and WorldPlacer.path), the React rail (PlaceRail) and the rules that prevent flickering markers, missed keys and coordinate fields. Use when asked to \"place in the world\", \"record a route\", \"place the NPC/object/zone in game\", \"in-game creator\", \"the marker flickers\", \"I don't want to type coordinates\" (pt-BR: \"posicionar no mundo\", \"marcar rota\", \"o marcador tá piscando\", \"não quero digitar coordenada\"), or when building any admin panel that stores a position, heading, zone or path."
---

# World placement

A creation panel **configures, it doesn't program**. Position, heading, size and path are
marked in the world, with a preview; never a number field, a coordinate or a typed name.

## Tools

| Tool | For | Module |
| --- | --- | --- |
| Point with ghost | NPC, object, interaction point: a see-through copy follows the aim | `WorldPlacer.point` |
| Path | NPC route, trail, fence: stops with a line on the ground | `WorldPlacer.path` |
| Zone (box with heading) | anything shaped like a cube that faces a way: elevator floor, garage spot, shop counter, stash, trigger area | `WorldPlacer.zone` |

Pick by shape: a model to stand somewhere is a point; a sequence is a path; a volume with a
front is a zone. The zone sits on the player (walk to it, the player's heading turns it), with
a yellow box, an arrow for the heading and the size written above; zones already placed show
in green with their label (`refs`). `multiple` marks several in a row (floors of an elevator).
Pattern from `mri_Qelevators` (`client/placement.lua`).

### Keys (the same in every resource)

| Key | Point | Path | Zone |
| --- | --- | --- | --- |
| Aim / walk | moves the ghost | previews the next stop | the box follows the player |
| `E` | confirm | mark stop | mark (single: confirm) |
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
   and reopens the tab).
3. NUI: `templates/PlaceRail.tsx` and the keys from `templates/rail.locales.json`. A store
   with `hud` fed by the `placeHud` message (`false` clears it). The rail shows with the panel
   hidden, on the resource's own ui_page; inside the Qadmin iframe it doesn't render (the
   iframe is hidden).
4. On the panel the result becomes a **summary**, not numbers: "3 stops · 29 m · there and
   back", "Position marked". A "Mark again" button starts over.

## Frame rules (no flicker, no missed keys)

- `DrawMarker`, `DrawLine` and `DisableControlAction` last one frame: call them every frame,
  in a loop that only has `Wait(0)`.
- Nothing that waits inside that loop: `lib.raycast.fromCamera` does a `Wait(0)` inside, and
  in the same loop the drawing shows every other frame (flicker) and `JustPressed` gets lost.
  The aim runs on its own thread (`trackAim`) and the loop only reads `aim.coords`. The same
  goes for `lib.requestModel`, `lib.callback.await` and any `Wait(n)`.
- A blocked key (Esc 200, Enter 191, wheel 14/15) only answers through
  `IsDisabledControlJustPressed`.
- Ghost: alpha 170, no collision, frozen, `SetBlockingOfNonTemporaryEvents`. Only move it
  when the aim changed. The model accepts a numeric hash (`tonumber(model) or joaat(model)`).
- Raycast `1 | 16` (world and objects), ignoring the player's own ped.
- No `lib.showTextUI`, ox_lib menu or instruction `DrawText`: the rail belongs to the NUI.

## What the system decides by itself

- Time is a ready choice ("passes by", "stops a bit", "stays a while"), never `+`/`-`.
- What can be deduced doesn't become an option: a route ending less than 8 m from the start
  loops, otherwise it goes there and back.
- Linking one thing to another (which NPC to release, which floor) is picking from a list of
  names.

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

## Verify

- Browser: send `placeHud` through the dev mock and check the rail (pt-BR and English,
  narrow screen).
- Game (only it shows): markers steady while the camera turns, E takes on the first press,
  Esc doesn't open the pause menu, cancelling and finishing without stops keep the previous
  value, the panel comes back on the same item.
