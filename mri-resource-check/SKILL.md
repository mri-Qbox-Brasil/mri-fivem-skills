---
name: mri-resource-check
description: "Checks a FiveM resource before calling a change done - parses every .lua including CfxLua syntax (backtick hashes, ?. and ?[ safe navigation, +=, <const>), flags the `and false or x` trap, fxmanifest globs that match nothing, missing files and old fx_version, then the reload order (refresh, ensure, who to ask before restarting) and which log shows what (fxserver.log on the server, CitizenFX_log on the client). Ready script with luaparse bundled, no install. Use when finishing any change to a resource, when asked to \"check the resource\", \"validate the Lua\", \"did it load?\", \"why doesn't my file run?\", \"SCRIPT ERROR after ensure\", \"No such export\", \"works on the server but not for the player\" (pt-BR: \"confere o resource\", \"valida o lua\", \"carregou?\", \"o arquivo não roda\", \"deu erro depois do ensure\"), or when a bug only shows in game."
---

# Checking a resource

Nothing is "done" until it parsed, loaded and was read end to end. Say what was verified where
(parser, server log, client log, browser, game) and what was not tested.

## 1. Parser and pitfalls

```bash
node scripts/check.mjs <resource folder>        # or a list of .lua files
```

- Parses every `.lua` (skips `node_modules`, `stream`, `web`, `html`, `ui`, `dist`, `build`)
  with the bundled `luaparse` (Lua 5.3). CfxLua extensions are rewritten first, keeping line
  and column: backtick hashes, `?.` / `?[` safe navigation, `+=` and the other compound
  operators, `<const>` / `<close>`. Backticks inside comments are removed (luaparse reads
  them as code).
- `FAIL` = syntax error with `[line:column]`. Exit code 1.
- `WARN` lines:
  - `cond and false or x` / `cond and nil or x`: always `x`. Use `if`/`else` (or
    `not cond and x or nil`).
  - `fx_version` other than `cerulean`. With a `ui_page`, the NUI may lose APIs that need a
    secure context on CEF 144.
  - A single `*` in the middle of a manifest path (`modules/*/client.lua`) matches nothing
    and loads nothing, silently. Use `modules/**/client.lua`.
  - A file listed in the manifest that doesn't exist.
- Other CfxLua extensions (`in` unpacking, set constructors) are not rewritten: a `FAIL` on
  them is a false alarm.
- Prove the parser runs before trusting an all-clear: a deliberately broken file must `FAIL`.

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

Don't guess. Add readable logs with a prefix that is easy to filter (`[SHOP] [DIAG]`) at the
moment that matters, printing the state that decides the cause (task status, entity exists,
frozen, statebag value). Ask the user to reproduce, read the client log, fix the cause and
remove the temporary logs.

## 6. Web part

Typecheck and build the NUI, and look at it in the browser (see the `mri-nui-cef` skill).
