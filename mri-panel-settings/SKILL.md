---
name: mri-panel-settings
description: "Puts every option of a FiveM resource in its admin panel instead of config.lua: a data/settings.json read only by the server, defaults seeded from config.lua so edited servers keep their values, typed merge per section, cleaners for lists and maps, live apply over the Config table on the server and on every client through a GlobalState key (no restart), rebuild of zones, blips, targets and NPCs created at boot, integrations (target, radial, fuel) detected instead of configured, and the panel controls (ready-made choices, world tools, no typed numbers). Ships the Lua templates. Use when asked to \"make the config editable in game\", \"move config.lua to the panel\", \"settings tab\", \"option in the admin panel\", \"apply without restart\" (pt-BR: \"deixa a config editável ingame\", \"leva o config pro painel\", \"aba de ajustes\", \"opção no painel\", \"configurável no jogo\"), or when a resource still has options only in config.lua."
---

# Options in the panel, not in config.lua

A server owner never opens `config.lua`. Every option of the resource is edited in its admin
panel and applies at once, for everyone. Do it for the whole config whenever a resource is
touched for settings: don't ask which options, don't leave some behind.

## What goes where

| Kind | Where |
| --- | --- |
| On/off, mode, price, fee, limit, time | panel, ready-made choice (segmented or select), never a number field |
| Position, zone, route, NPC | panel, marked in the world (skill `mri-world-placement`), never X/Y/Z |
| Job, gang, grade, vehicle model, player | panel, picked from a list |
| Names (shop label, plate start) | panel, text field |
| Target, radial menu, fuel script, framework | nothing: detected with `GetResourceState` |
| Interaction key | fixed (E): the help texts name it, a choice breaks them |
| Icons per class, animation names | code constants: not an owner's decision |
| Secrets (webhooks) | panel, but the section never leaves the server |

A price choice list keeps the value saved before it even when it is not in the list (add it and
sort), so a server that had 1750 still sees 1750.

## Wiring (templates/)

1. `templates/apply.lua` into `modules/settings/apply.lua`, listed in `shared_scripts` right
   after `config.lua`. It writes each section over `Config`, so every reader keeps reading
   `Config.X`. On the client it applies `GlobalState[key]` at load and on change, then fires
   `<resource>:client:settingsApplied`.
2. `templates/server.lua` into `modules/settings/server.lua`. `DEFAULTS` are built from the
   current `Config` values (first run keeps what the owner edited), the file is
   `data/settings.json`, out of `files {}` and gitignored. Callbacks `getSettings` and
   `saveSettings(section, values)`, admin only.
3. `config.lua` keeps only the seeds, with one comment saying they are first values and the
   panel owns them. Detected integrations go at its top.
4. The installer must keep `data/settings.json` on updates ("Manter ao atualizar").
5. Panel: one tab, one card per section, each change saves its section after a short pause
   (600 ms for text, 0 for toggles and choices). A world tool saves through the same callback
   and sends a `settingsChanged` NUI message so the tab reloads.

## Merge and clean

- Merge per key against the default: take the new value if it has the default's type, else the
  previous one, else the default. Numbers are clamped at 0 (all of them are prices, counts or
  times). This drops unknown keys and wrong types from a forged request.
- Maps and lists (`{job = grade}`, lots, shops, zones) are marked in a `WHOLE` set by identity
  of the default table and taken whole, then a cleaner per section rebuilds them: points need
  x/y/z, a polygon needs 3 points, text is trimmed and capped, grades are whole numbers.
- JSON loses numeric keys: store a class price table as `{"0": 15000}` and turn keys back with
  `tonumber` in `apply`; store `forRank {[0]=true}` as a list of grades. An empty map comes back
  as `[]`, which decodes to an empty table, fine.
- Vectors: store `{x, y, z, w}`; `apply` rebuilds `vec3`/`vec4` for the readers.

## Live apply

- Readers that read `Config` at use time need nothing.
- Anything built at load must rebuild on `settingsApplied`: remove first (zones `:remove()`,
  `RemoveBlip`, `ox_target:removeGlobalVehicle(name)` with a `name` on the option,
  `qb-target:RemoveTargetBone`, delete NPCs), then create again.
- A file that returns at the top when a feature is off (`if not Config.UseX then return end`)
  must lose that guard: check the toggle inside the function, and on the server inside the
  permission check, so turning it on later works.
- Server globs load alphabetically: a module before `settings/` sees the seed values at load.
  Another reason to read `Config` at use time.
- A rebuild that waits (`lib.requestModel`) can overlap the next change: keep a `building`
  flag and run once more at the end if a change came meanwhile, or NPCs double.
- The admin panel's own data built from `Config` (e.g. "interiors are off" notice) gets a light
  NUI refresh on `settingsApplied`, not the whole payload.

## Verify

- `refresh` then `ensure` (a new shared file in the manifest), no error in the log.
- Browser mock: every section renders, narrow column doesn't cut labels.
- Game (only it shows): change each option with players online and see it take effect without
  a restart; a world tool returns to the tab with the new value; an old `config.lua` value shows
  in the panel on the first run.

Reference: `mri_Qgarage` (`modules/settings/`, `web/src/pages/GarageSettings.tsx`). Tested in
the browser and with `ensure`; the in-game pass is pending.
