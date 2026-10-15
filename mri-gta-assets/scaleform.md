# Scaleform (.gfx): editing a game menu or HUD movie

`.gfx` is Scaleform GFx: a Flash SWF with a `GFX` signature and ActionScript 2 inside. FiveM
replaces one by streaming a file with **the same name** in `stream/` (the game loads it by name;
another name is never opened). Only one resource per server can send a given name.

## Workflow

Validated: extraction, build and the decompile round trip. Streaming an edited copy of this page
worked in game; the rebuilt file from this workflow is waiting for its in-game test.

1. **Start from the game's original**, never from another mod's file. The original lives in an
   encrypted `.rpf`; the newest copy wins (`update\update.rpf` over `x64b.rpf`). Pull it with the
   user's CodeWalker install (only its DLL is loaded, nothing bundled):
   ```powershell
   .\scripts\rpf-extract.ps1 -Game "<GTA V folder>" -CodeWalker "<CodeWalker folder>" -Name pause_menu_pages_map.gfx -Out .\orig
   ```
   Legacy GTA V only (keys come from its executable). Without CodeWalker, OpenIV's export works too.
2. **Read the code** with `node scripts/gfx-patch.mjs export orig.gfx out` (FFDec, see below). The
   public dump [floppystudiodev/GTAV-Scaleforms-Decompiled](https://github.com/floppystudiodev/GTAV-Scaleforms-Decompiled)
   has every movie's code, handy for base classes that live in another movie (`GUIModel`,
   `GUIView`, `PauseMenuComponentBase`, `PAUSE_MENU_SP_CONTENT`).
3. **Copy only the classes you change** to a folder that mirrors the export (`scripts/__Packages/...`),
   edit, then build:
   ```bash
   node scripts/gfx-patch.mjs build orig.gfx my-classes out/pause_menu_pages_map.gfx --ffdec <ffdec.jar>
   ```
   Importing the whole export recompiles every class and drifts from the original; importing only
   the changed ones keeps the rest byte for byte.
4. Keep the changed classes in the resource's private source (not shipped), so the build repeats.

FFDec is [JPEXS Free Flash Decompiler](https://github.com/jindrapetrik/jpexs-decompiler/releases)
(the `.zip`, run with Java 8+). It reads and writes GFX, keeping the `GFX` header.

## Pitfalls

- **Register 1 is `this`.** FFDec names decompiled locals `_locN_` after the register; writing your
  own `_loc1_` in a method that uses `this` compiles into the same register and the code ends up
  assigning to `this`. Use normal names in new code (`gfx-patch.mjs` refuses `_loc1_` next to `this`
  and checks the result for `this =`).
- FFDec treats `[` and `]` in a path as a pattern: copy the file to a plain folder first (the
  script does).
- Write the output beside the target and rename it in; never write a streamed file in place.
- The original's own code may decompile with cosmetic changes (`x = x - 1` to `x -= 1`, a `break`
  after `return`). That is fine.
- **Licensing:** the base file is Rockstar's. A mod's license (often GPL) covers only what that mod
  added. Rebuild from the original and write your own additions; never copy another mod's code.

## Talking to a pause menu page from Lua

Validated in game with numeric markers in `SET_DATA_SLOT`; the string marker below
(`ScaleformMovieMethodAddParamTextureNameString`) is waiting for its in-game test.

The pause menu routes column calls from the frontend movie to the page component of that column:

- `BeginScaleformMovieMethodOnFrontend('SET_DATA_SLOT')` with `(column, ...)` reaches the page's
  `SET_DATA_SLOT(...)` with the column removed. A page can claim calls whose first argument is a
  marker string of its own and leave the rest to `super`.
- `GET_COLUMN_SELECTION(column)` returns the page's `model.getCurrentSelection()`. Override it in
  the page's model to hand back a reply string, then read it with
  `EndScaleformMovieMethodReturnValue` + `IsScaleformMovieMethodReturnValueReady` +
  `GetScaleformMovieMethodReturnValueString`.
- Calls run in order, so `send command, read, send, read` pairs line up even in batches. Keep one
  reply slot, clear it when read, and let commands that answer nothing leave it alone.
- Keep each reply short (about 60 characters were reported to come back whole); send long text in
  pieces with an offset.
- Only one Lua reader at a time: the slot is shared.

### Map legend page (`pause_menu_pages_map.gfx`, class `PAUSE_MENU_MAP`)

- The rows are `model.getCurrentView().dataList`, every row, not just the visible ones.
- Row layout: `[2]` unique id, `[4]` selected blip of the group, `[6]` label (may carry `<C>` tags),
  `[7..9]` RGB, `[10]` icon linkage (`radar_*`), `[11]` blip count, `[12]` `false` when the group is
  hidden.
- Selecting a blip the way the game does (centers the map):
  `GameInterface.call("SET_MAP_LOCATION", GameInterface.PAUSE_TYPE, row[2], value)`; then
  `view.index = i` moves the highlight.
- The game's highlighted row is `view.index`.
- `view.viewContainer._visible = false` hides the native list without losing its data; re-apply it
  in `updateScroll`, which the game calls after every change.
- Reference: `client/maplegend.lua` in mri_Qblips (command channel `mriq`).
