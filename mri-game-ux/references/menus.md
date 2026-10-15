# Menus and flows

## Title screen

Connecting and landing straight on the character list doesn't feel like a game. Before it:

- slow shots over the city (camera moving forward ~7 m in 8 s, fade between shots), logo in
  the center, "Press Enter", letterbox and vignette;
- Enter, space or click continue; the camera descends from above to the stage and the menu
  enters;
- shots captured in game by an admin panel (free camera, scroll = zoom, Enter saves) and a
  "Test" that plays the sequence without reconnecting;
- only on connect. Going back to characters (logout) opens them directly.

## Landing

- Logo in the lower left third, vertical text menu, no boxes.
- "Continue" with the last character's name below; "Characters" opens the list; "Settings"
  only if there is something to set.
- Empty account: only "Create character", which opens creation on the first free slot;
  cancelling lands on the selection with that slot focused.
- Can't continue (last one deleted): the item disappears.

## Selection

- Slot rail (taken and free) with arrows; the camera goes to each one's position.
- Entering is holding (E or mouse) with a progress ring, not a simple click.
- Free slot: E opens creation directly.

## Destructive confirmation

No black modal out of nowhere:

- the action bar becomes the confirmation: red vignette on the edges, red ring
  "Hold to delete · NAME · no way back";
- holding mouse or Delete fills the ring (~1.3 s); Esc/Backspace cancels;
- gamepad: A fires a click without mouse (`e.detail === 0`) that fills the ring by itself,
  B cancels;
- once confirmed, the ring spins ("Deleting...") until the list comes back; the scene fades
  the ped out;
- changing the selection cancels the confirmation; while deleting, the selection locks.
- React: cancel the ring's animation frame only on unmount. A cleanup in an effect without deps runs
  on every render, and the ring never fills.

## Creation in chapters

- One chapter per screen (gender, name, origin, birth, arrival), each with its own camera
  shot and the ped reacting (gesture on confirm, looking at the camera).
- The last chapter ("how you arrived") becomes an arrival scene after the editor.
- Ending: pose, the camera moves to the appearance editor's shot, a card with the name, and
  the editor opens right there, without fade or teleport.

## Gamepad

Every screen navigable by gamepad: visible focus (ring in the accent color), button hints at
the top (✛ navigate, A select, B back) and B always goes back one level.

## Texts

Short label, verb or destination ("Continue", "Characters", "Create character"). Avoid
ambiguous pairs like "Play" and "Continue" on the same screen.

## World interaction prompt

- If it can be pressed, it shows. A prompt doesn't time out while the target is still aimed.
- Layers: far, only a marker; near and aiming, key + text; looked away, back to marker.
- Standing on the target for long: collapse (only the key, smaller and dimmed), never vanish.
  The key or aiming again brings it back.
- Hide by intent: aiming a weapon, combat, sprint, vehicle above X km/h, NUI focused. Prompt,
  markers and dot vanish together, with fade and slack (~400 ms) so they don't flicker.
- Reference: `mri_Qinteract` (`client/render.lua`: `dormant`, `inAction`).

## Own pause menu and the GTA map

- ESC and P/Start are 200 and 199: disable both every frame (groups 0 and 1) and open your
  screen.
- Map directly: `ActivateFrontendMenu('FE_MENU_VERSION_MP_PAUSE')`, wait for
  `IsPauseMenuActive`, `PauseMenuceptionGoDeeper(0)` + `PauseMenuceptionTheKick()`.
- That sits one level below the tab bar: ESC goes back to the GTA pause. Watch and close with
  `SetFrontendActive(false)` on cancel (`IsControlJustPressed(2, 202)`, arrives ~200 ms
  before the bar shows) or when `IsNavigatingMenuContent()` drops to 0.
- `IsNavigatingMenuContent()` returns 0/1, and 0 is truthy in Lua: compare `== 1`. Natives
  typed `Any` usually return a number.
- Reference: `mri_Qpausemenu` (`client/frontend.lua`).
