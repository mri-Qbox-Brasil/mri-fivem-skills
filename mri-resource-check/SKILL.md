---
name: mri-resource-check
description: "Checks a FiveM resource before calling a change done and looks up natives instead of guessing - parses every .lua (CfxLua too), flags natives that do not exist or run on the wrong side, the `and false or x` trap, SetTimeout passing its timer id, job/duty handlers that ignore the value the event carries, server framework events on RegisterNetEvent (any client can fake them), qbx_core event names it never fires, notify text outside the locales, fixed waits used as a fix, bad fxmanifest globs, missing files and old fx_version, how oxmysql tables are created at start, then the reload order and which log shows what. Use when finishing any change to a resource, or when asked to \"check the resource\", \"did it load?\", \"SCRIPT ERROR after ensure\", \"No such export\", \"does this native exist?\", \"attempt to call a nil value\" (pt-BR: \"confere o resource\", \"valida o lua\", \"carregou?\", \"cria as tabelas\", \"deu erro depois do ensure\"), or when a bug only shows in game."
---

# Checking a resource

Nothing is "done" until it parsed, loaded and was read end to end. Say what was verified where
(parser, server log, client log, browser, game) and what was not tested.

## 0. Natives: look up, never guess

Before writing a native, confirm its name, parameters and side:

```bash
node scripts/natives.mjs SetEntityHeading     # signature, client/server, docs link
node scripts/natives.mjs vehicle door         # every native with these words
```

Data: the official Cfx lists (`static.cfx.re/natives/natives.json` and
`natives_cfx.json`), downloaded on first use and cached for a week in the system temp folder.
Data only, no code. Sounds, animations and model names: [DurtyFree/gta-v-data-dumps](https://github.com/DurtyFree/gta-v-data-dumps).

## 1. Parser, natives and pitfalls

```bash
node scripts/check.mjs <resource folder>        # or a list of .lua files; --no-natives offline
```

- Parses every `.lua` (skips `node_modules`, `stream`, `web`, `html`, `ui`, `dist`, `build`
  and install snippet folders like `!INSTALLATION`) with the bundled `luaparse` (Lua 5.3).
  CfxLua extensions are rewritten first, keeping line and column: backtick hashes, `?.` /
  `?[` safe navigation, compound operators (`+=`, `..=`, `<<=`...), `<const>` / `<close>`,
  `/* */` comments, set constructors (`{ .a, .b }`) and `local a, b in t`.
- `FAIL` = syntax error with `[line:column]`. Exit code 1.
- `WARN` lines:
  - **Native on the wrong side**: a client-only native in a file that runs on the server, or
    the reverse. The side comes from the manifest (`client_scripts`, `server_scripts`); files
    it doesn't list go by a `client` / `server` folder name; shared files are skipped.
  - **Unknown function**: a `PascalCase()` call that is not a native and is not defined in
    the resource or in the files it imports with `@resource/file.lua`, with "did you mean"
    for a near native name. Calls guarded by `if Name then` and test folders are skipped.
    Usually a typo, a native that never existed, or a global from another resource that
    isn't loaded (`exports` handlers don't create globals).
  - `cond and false or x` / `cond and nil or x`: always `x`. Use `if`/`else` (or
    `not cond and x or nil`).
  - `SetTimeout(ms, fn)` where `fn` takes arguments: SetTimeout calls it with the timer id
    (`attempt to index a number value`). Wrap it: `function() fn() end`.
  - `QBCore:Client:OnJobUpdate`, `OnGangUpdate` or `SetDuty` handler with no parameters:
    the event carries the new value, and qbx_core fires it before PlayerData is updated.
  - Fixed player text in a notify (a quoted phrase) in a resource that has `locales/`.
  - `RegisterNetEvent` on the server for an event the framework fires there with
    `TriggerEvent` (`QBCore:Server:PlayerLoaded`, `OnJobUpdate`, `OnPlayerUnload`,
    `qbx_core:server:onJobUpdate`...): any client can fire it with fake arguments. Listen
    with `AddEventHandler`. Before listening to a framework event, grep the framework for
    who fires it: a name nobody fires (`qbx_core:server:playerLoaded`) is a dead handler.
  - A handler for a `qbx_core:*` name that qbx_core never fires (`playerLoaded`,
    `playerUnloaded`, `jobChanged`, `gangChanged`, on server or client), with the event to use
    instead.
  - `GetPlayerPed(-1)` (use `cache.ped` or `PlayerPedId()`) and `GetDistanceBetweenCoords`
    (use `#(a - b)`).
  - Not flagged on purpose: a `GetInvokingResource()` guard on client net events. The
    cheater controls the client and skips it; the real fix is the server validating.
  - `fx_version` other than `cerulean`. With a `ui_page`, the NUI may lose APIs that need a
    secure context on CEF 144.
  - A single `*` in the middle of a manifest path (`modules/*/client.lua`) matches nothing
    and loads nothing, silently. Use `modules/**/client.lua`.
  - A file listed in the manifest that doesn't exist.
- Prove the checker runs before trusting an all-clear: a deliberately broken file must
  `FAIL`, a made-up native must `WARN`.

## 2. Read the flow

Before saying it works, follow the path end to end across every resource involved: the
event that triggers it, the callback, what the other side receives, the export it calls.

Lua traps the parser can't see:

- A module global with a generic name (`Zones`, `Points`) gets overwritten: ox_lib writes
  globals like that when it loads its modules (`lib.zones`), with no error. Give module
  globals their own name (`ShopZones`).
- `require 'config.server'` (ox_lib) returns the same cached table everywhere in the
  resource: a field changed at runtime applies to every reader.
- Event instead of polling. A loop with `Wait(0)` only for drawing and controls.
- Some natives set state for the whole game, not for one entity: outline color and shader
  (`SetEntityDrawOutlineColor`, `SetEntityDrawOutlineShader`), timecycle, `SetNuiFocus`,
  hud and radar toggles. An effect that changes one hands it back when it ends, on every exit
  (early return, cancel, `onResourceStop`); code that relies on one sets it right before
  use.
- Before saying a resource can't tell or do something, read its `fxmanifest.lua` exports,
  its compat exports and its `GlobalState` keys.
- Never read `GlobalState[key]`, `LocalPlayer.state[key]` or `Entity(x).state[key]` inside a
  loop to see if it changed: every read decodes a fresh copy of the value, so a table there
  makes garbage each tick and the resmon memory of the resource climbs (the `+`). Keep the
  value in a local updated by `AddStateBagChangeHandler(key, 'global' | 'player:<id>' |
  'entity:<netId>', fn)`, seeded once from the bag.
- A state bag and an event (or callback) are two channels with no order between them: data the
  event points at (a look, a preset, a config the server just published) may arrive before or
  after it. Give the published data a version (`rev`) and apply it when the state bag handler
  sees a newer one, instead of acting on the event and hoping the bag got there first.
- A number from a net event can be NaN or inf (msgpack carries both), and NaN fails every
  `<`, `>` and `==`, so it slips past clamps and limits and lands in the database. Refuse it
  first: `if not n or n ~= n or math.abs(n) == math.huge then return end`.
- A limit that drops a gain (`max < value then return`) must only apply when the amount is
  positive, or XP above a limit lowered later can never go down.
- An export copies its whole answer through msgpack: `exports.ox_inventory:Items()` with no name
  sends every item. Ask for one (`Items(name)`) or cache the list once.
- After the player's model changes (`SetPlayerModel`, an appearance resource's
  `setPlayerModel`/`setPlayerAppearance`), the ped is a new entity and `cache.ped` still holds
  the old one for a moment: use `PlayerPedId()` right after (health, armour, weapons).
- Player text (notify, help text, menu labels) goes through the locale: ox_lib `locale('key', ...)`
  with `ox_lib 'locale'` in the manifest and every language in `locales/*.json`, keys in
  English, values with proper accents, values from the game passed as `%s` arguments. Even when
  the code around it hardcodes strings: the new line does not copy that.
- No fixed `Wait(n)` / `SetTimeout(n)` to let something "settle" before reading it. That is a
  race that fails on a slow client. Use the value the event carries, or wait on the event or
  state that says it is ready. Framework events carry the new value: `OnJobUpdate(job)`,
  `OnGangUpdate(gang)`, `SetDuty(onDuty)`; `GetPlayerData()` inside them still has the old one.
  On the server it is the other way round: qbx_core writes `PlayerData` first and then fires
  `QBCore:Server:OnJobUpdate` / `SetDuty`, so a handler can read the player and stay idempotent.
- Changing a numeric metadata (hunger, thirst, stress) inside `qbx_core:server:onSetMetaData`
  is lost: qbx_core fires the event and only then sets the player's state bag to the value it
  had, and the state bag handler writes that back to `PlayerData`. Defer the change one tick
  (`SetTimeout(0, ...)`), read `GetMetadata` there and set from it. The refunded `SetMetadata`
  fires the event again, so only react to a drop (`new < old`).
- One flow per thing, variants as parameters: a new kind of the same action goes through the
  existing function with what differs passed in, never an early `if kind then ... return end`
  branch copying the steps (the copy skips options and every fix has to be made twice).
- Renaming something whose name is a key elsewhere (a garage label in `player_vehicles.garage`, a
  shop id in a purchases table) moves those rows in the same save, in one transaction: otherwise
  everything stored under the old name vanishes for the players.
- A rule that depends on a group (minimum grade, salary) reads the grade in the group that granted
  the access, not the player's current job: with jobs and gangs in one access list, a gang member
  must not pass a job grade check with the gang grade.
- A vehicle spawned with props gets its final plate a moment after it exists: anything keyed by
  plate (keys, fuel, mileage) waits until `GetVehicleNumberPlateText` matches before it counts.
  Key resources check the plate the moment the player sits, so a car the player is warped into
  needs the key announced again once the plate lands (mri_Qcarkeys:
  `mm_carkeys:client:addtempkeys`).
- A lock set by the server (a preset, a mode, an item) covers every path to the same effect: if
  players may also tune each part by hand, clamp those parts to what the allowed choices reach,
  or the locked one comes back one option at a time. Temporary effects the script applies itself
  (pause, away) may skip the lock; anything the player picks may not.
- Idle detection reads input (`GetDisabledControlNormal` on look axes, movement, keys,
  `IsNuiFocused()`), not the rendered camera: GTA's idle camera moves on its own after ~30 s,
  so "camera did not move" never becomes true for a player who walked away.
- Every field an admin panel saves needs a reader: after rewriting a flow, grep each saved field
  for the code that reads it. An ignored value raises no error.
- Tables: created in Lua on every start inside `MySQL.ready`, then the loads, in sequence; no
  `install.sql`, no polling wait for the schema, no `pcall` around it. Read
  [references/database.md](references/database.md) before writing or reviewing any table code.
- A column added to an existing table on start (`onResourceStart`) checks with
  ``SHOW COLUMNS FROM `t` LIKE 'c'`` and runs the `ALTER` inside `pcall`. That handler usually
  also loads the saved rows: an error there (oxmysql throws "Duplicate column name") stops it
  and the resource starts with nothing. In mri_Qobjects (2026-10-21) the "Duplicate column" came
  from the module running twice (see the next item), each copy adding the column.
- A file the manifest runs as a script (`server/**/*`) and that another file also `require`s runs
  twice: two start handlers, two caches, every net event handled twice. List only the entry
  files; a client module that is only required goes in `files`. `check.mjs` warns about it.
- Something that lasts a session (a shift, a timer) kept in the database: refresh its end
  with a heartbeat and, on start, close what was left open at its last heartbeat. A crash or
  an `ensure` then loses at most one interval instead of counting the downtime.

## 3. Reload

- New file in the manifest, new `dependency` or new `server_script`: `refresh` first, then
  `ensure`. Without the refresh the server loads the cached old manifest (missing files,
  globals nil).
- `ensure` only the resource that changed. With the `mri-txadmin` skill:
  `node scripts/tx.mjs refresh` and `node scripts/tx.mjs ensure <res>`.
- Ask before restarting, with players connected:
  - a resource with `stream/` or model `data_file`: remounting crashes their game;
  - an inventory or a core (`ox_inventory`, `qbx_core`): others hold its state; the core
    needs a server restart;
  - a resource others declare in `dependencies`: they are stopped with it and don't come back
    by themselves (read the `Stopping resource` lines and `ensure` each one);
  - a resource that `provide`s another name (target systems): re-ensuring its dependents can
    start it twice on the client. Ask the player to reconnect instead.
- A resource can't restart itself: `StopResource` on its own name does nothing, and
  `ExecuteCommand('ensure ...')` needs `add_ace resource.<name> command.ensure allow`. Another
  resource (an admin panel) or the admin restarts it.
- Never put a server-only resource in `dependencies`: the client can't find it and FiveM
  drops the player ("Could not find dependency ... Killing network").

## 4. Logs

| Where | What it shows |
| --- | --- |
| Server: `fxserver.log` in the txData profile, or the txAdmin live console | `Started resource`, `Couldn't start resource`, server `SCRIPT ERROR` |
| Client: `FiveM.app/logs/CitizenFX_log_*.log` in the FiveM install | client `SCRIPT ERROR`, `No such export`, NUI `console.log`, missing dependency |

- After `ensure`, the server log must show the start with no error, and the files you added
  must have run (a glob that matched nothing raises no error).
- A clean server start proves nothing about the client: an export missing behind a
  `provide`, for example, only fails in the player's log.

## 5. Bug only in game

**First report, logs first.** A second change made without knowing the cause is a guess. Add readable logs with a prefix that is easy to filter (`[SHOP] [DIAG]`) at the
moment that matters, printing the state that decides the cause (task status, entity exists,
frozen, statebag value). Ask the user to reproduce, read the client log, fix the cause and
remove the temporary logs.

## 6. Web part

Typecheck and build the NUI, and look at it in the browser (see the `mri-nui-cef` skill).
