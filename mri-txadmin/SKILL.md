---
name: mri-txadmin
description: Runs ensure, restart, start or stop on a resource of a local FiveM server through the txAdmin API (no rcon) and shows what fxserver.log recorded. Use when asked to "ensure X", "restart the resource", "restart the script", "stop/start the resource" (pt-BR: "dá ensure no X", "reinicia o resource", "para/sobe o resource"), or when a change needs reloading on the server to be tested.
---

# Server commands through txAdmin

No rcon: txAdmin runs locally and its panel has an API. The script logs in, sends the
command and prints the new lines of `fxserver.log`.

**Set up once:** copy `config.example.json` to `config.json` (kept out of git) and fill in
the URL, the txAdmin login, the server folder (`base`, where `txData` lives) and the profile.

Run from the skill folder, Node 18+:

```bash
node scripts/tx.mjs ensure rpemotes-reborn
node scripts/tx.mjs restart my_resource
node scripts/tx.mjs stop my_resource
node scripts/tx.mjs ensure job_a job_b job_c   # several at once, on the same login
node scripts/tx.mjs refresh                    # rescan resources (new folder)
```

| Action | What it does |
| --- | --- |
| `ensure <res>` | Starts it, or restarts if running. The default to reload a change. |
| `restart <res>` | Restarts (fails if stopped). |
| `start <res>` / `stop <res>` | Starts / stops. |
| `refresh` | Server `refresh`, to see a new resource or a changed `fxmanifest.lua` (new file in `client_scripts`): without it `ensure` starts with the old manifest and the client gets `attempt to index a nil value` on the missing file's global. |
| `say <message>` | txAdmin announcement to every player. Only when asked. |

**Login:** txAdmin blocks login for 15 minutes after about 10 attempts in a row (error 429).
The script keeps the session in `%TEMP%\mri-txadmin-<url>.json` and only logs in again when it
expires. For several resources, pass them all in one command instead of looping calls. On a
429, wait the 15 minutes: retrying doesn't help.

Flags: `--base <folder>` and `--profile <profile>` (defaults in `config.json`), `--url` if
txAdmin isn't on port 40120, `--no-log` to skip reading the log.

## After the command

- Check in the output that the resource started (`Started resource <res>`) and that no
  `SCRIPT ERROR` or `Couldn't start resource` came up.
- **Restart only restarts that resource.** Whoever depends on it (e.g. an emote menu on top
  of `rpemotes-reborn`) keeps the old instance's state and may stop working on the client.
  Restarted an engine/base resource: also restart those that use it.
- Resources that list it in `dependencies` are **stopped** with it and don't come back by
  themselves (e.g. `ensure sd-phone` takes down `sd-tablet` and the apps). Read the
  `Stopping resource` lines in the log and `ensure` each one.
- Large resource (e.g. `sd-phone`, 22 MB): on a connected client the dependents may start
  before it finishes downloading, and it stays mounted without running (`No such export` in
  the apps). Check `Creating script environments for <res>` in the FiveM log; without that
  line, the player needs to reconnect.
- New resource or changed `dependencies`: no server-only resource (e.g. `qbx_vehicles`) in
  `dependencies`. The client can't find it, refuses the resource and FiveM drops the player
  ("Could not find dependency ... Killing network"). Check the FiveM log after `ensure`.
- Resource with `stream/` or a model `data_file`: ask first. Remounting it on a connected
  client crashes the game.
- The client side shows in the FiveM log (`FiveM.app\logs\CitizenFX_log_*.log`, in the FiveM
  folder), not in `fxserver.log`.
- The script never touches `server.cfg`.

## Errors

- `login failed`: txAdmin down or password changed. Check `config.json`.
- `command failed`: txAdmin's message comes along (e.g. the resource doesn't exist).
- Arbitrary console commands don't go through this API (the Live Console uses a websocket):
  use the txAdmin console for that.
