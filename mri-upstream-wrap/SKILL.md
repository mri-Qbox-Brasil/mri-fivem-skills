---
name: mri-upstream-wrap
description: "Changing third-party FiveM resources (qbx_*, ox_*, any upstream) without editing their code, so updates stay a clean copy - a wrapper folder loaded from the fxmanifest, hooks through the resource's cached config, globals and events, keybinds that change for players who already joined, replacing a resource with `provide` plus a compat layer for its exports (`__cfx_export_<res>_<name>`), sharing settings through GlobalState, and the restart quirks of provided resources (exports stuck on the dead instance after an ensure). Templates for the compat layer and a wrapper file. Use when asked to \"change ox_inventory/qbx_core\", \"replace resource X with ours\", \"keep compatibility with the old name\", \"No such export in resource\", \"Execution of function reference in script host failed\", \"the new default key doesn't apply\", \"integrate with another resource\" (pt-BR: \"mexe no qbx_core\", \"substitui o X pelo nosso\", \"manter compatível\", \"a tecla nova não pegou\", \"integrar com o outro resource\")."
---

# Changing upstream resources without editing them

An upstream resource (someone else's repo) is updated by replacing its files. Anything
edited inside them is lost or turns every update into a merge. So:

- **In place, only config** (the files the upstream meant to be edited).
- **Everything else in a wrapper folder** inside the resource (e.g. `<resource>/custom/`,
  one name for all your wrappers). The `fxmanifest` gets one line per new file, the only
  edit outside the folder, and its `version` goes up.
- **Load order:** list the wrapper before the original files when it sets something they
  read while loading; after them when it wraps globals or functions they define.
- **Integrate through the contract the upstream already offers** (events, exports,
  statebags). Don't add new API to a resource just so another one can depend on it.
- **Licenses:** don't copy GPL code into a closed-source resource; write the feature from
  scratch.

## Hooks a wrapper can use

`templates/wrapper.lua` shows them together.

- `require 'config.server'` (ox_lib `require`) returns the same cached table the upstream
  uses. Changing a field applies live to whoever reads it on each loop.
- The upstream's global functions (e.g. `SetMetadata` in qbx_core) and its events are
  hooks. When an event fires before the upstream writes the statebag, the correction goes in
  `SetTimeout(0, ...)` or the upstream overwrites it.
- Answering someone else's export name: `AddEventHandler('__cfx_export_<res>_<name>',
  function(setCB) setCB(fn) end)` in a separate file, instead of rewriting every
  `exports(...)` call.

## Settings from your resource to the upstream

Publish a small key in `GlobalState` (e.g. `myorg:needs`): your resource writes it on start
and sets it to `nil` on stop (nil = the upstream's default). The wrapper reads it.

- Reading `GlobalState` in a handler is a memory read; no polling needed.
- In `AddStateBagChangeHandler`, the new value comes in the parameter: `GlobalState` still
  holds the old one at that moment.

## Keybinds

FiveM stores each player's key by **command name**. Changing the default key in
`RegisterKeyMapping` only affects players who never joined. To change it for everyone,
register the command under a new name (your prefix) in the wrapper, with the new default.

## Replacing a resource (`provide`)

`provide 'old_resource'` in your resource's `fxmanifest`:

- `dependency 'old_resource'` is satisfied and `GetResourceState('old_resource')` answers for
  yours. Resources that only test the state need no change.
- **Exports are not forwarded.** `exports.old_resource:x()` fails with "No such export x in
  resource old_resource" until you register each one: `templates/compat.lua`. The server
  starts clean and the error only shows in the client log of whoever triggers it, so check
  the player's log after the first `ensure`.
- `stop old_resource` / `ensure old_resource` also hit yours. To really retire the old one,
  remove its folder.
- Keep everything the old one did: what is migrated or added doesn't remove behavior. The
  old behavior stays the default and the new one becomes an option.

## Restart quirks

- `ensure` on a resource that others depend on through `provide` (target systems, cores)
  stops them, and re-ensuring them one by one can start the provider twice on the client
  (`No such export ... in resource ox_lib`, `module not found`). With a player in game, ask
  them to reconnect instead.
- After an `ensure` on the provider, every resource that already called `exports['x']` keeps
  the dead instance's function ("Execution of function reference in script host failed"):
  the Lua scheduler caches exports by name and only clears them on `onClientResourceStop` /
  `onServerResourceStop` for `x`, never for the provider. On the provider's own stop, fire
  `TriggerEvent('onClientResourceStop', 'x')` (server: `onServerResourceStop`) for each name
  it provides.
- Never fix a bug of your own resource by editing the core or an upstream. Fix it where it
  lives.
