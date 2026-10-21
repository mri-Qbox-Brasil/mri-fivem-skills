---
name: mri-txadmin
description: "Runs ensure, restart, start or stop on a resource of a FiveM server (local or a remote VPS over an SSH tunnel), restarts the whole server, or runs any server console command, through the txAdmin API (no rcon) and shows what fxserver.log recorded. Use when asked to \"ensure X\", \"restart the resource\", \"restart the script\", \"stop/start the resource\", \"restart the server\" (pt-BR: \"dá ensure no X\", \"reinicia o resource\", \"para/sobe o resource\", \"reinicia o servidor\"), or when a change needs reloading on the server to be tested, or to run a server console command (pt-BR: \"roda no console\", \"manda esse comando no servidor\")."
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
node scripts/tx.mjs console "mri_inventory get items water"   # any server console command
node scripts/tx.mjs server-restart             # whole server, drops every player
```

| Action | What it does |
| --- | --- |
| `ensure <res>` | Starts it, or restarts if running. The default to reload a change. |
| `restart <res>` | Restarts (fails if stopped). |
| `start <res>` / `stop <res>` | Starts / stops. |
| `refresh` | Server `refresh`, to see a new resource or a changed `fxmanifest.lua` (new file in `client_scripts` or `server_scripts`): without it `ensure` starts with the old manifest and the client or the server gets `attempt to index a nil value` on the missing file's global. Run it before the `ensure` whenever the manifest file lists changed. |
| `server-restart` | Restarts the whole server (txAdmin's Restart button, `POST /fxserver/controls`). Drops every player: only when asked, after checking nobody is online. For a new or fixed resource, `refresh` + `ensure` is enough. |
| `say <message>` | txAdmin announcement to every player. Only when asked. |
| `console <command>` | Runs one line in the server console, as the Live Console does (needs the `console.write` permission), and prints the log lines it caused. The answer only shows in the log, so commands meant for agents should print one parseable line. |

**Login:** txAdmin blocks login for 15 minutes after about 10 attempts in a row (error 429).
The script keeps the session in `%TEMP%\mri-txadmin-<url>.json` and only logs in again when it
expires. For several resources, pass them all in one command instead of looping calls. On a
429, wait the 15 minutes: retrying doesn't help.

Flags: `--base <folder>` and `--profile <profile>` (defaults in `config.json`), `--url` if
txAdmin isn't on port 40120, `--no-log` to skip reading the log, `--config <file>` to use
another login file instead of the skill's `config.json` (one per server).

## Remote server (VPS)

Keep one config file per server outside the repo (e.g. `~/.vps/<server>/txadmin.json`) and
reach txAdmin through an SSH tunnel, so the password never crosses the internet in plain HTTP:

```bash
ssh -f -N -o ExitOnForwardFailure=yes -L 40199:127.0.0.1:40120 <ssh-host>
node scripts/tx.mjs ensure my_resource --config ~/.vps/<server>/txadmin.json --no-log
```

The file's `url` is `http://127.0.0.1:40199`. `fxserver.log` is on the VPS, so pass `--no-log`
and read it over SSH (`txData/<profile>/logs/fxserver.log`). Close the tunnel afterwards (the
`ssh` process with `40199` in its command line).

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
- `live console refused the session`: the txAdmin login lacks `console.write`. The Live
  Console has no REST route: the script joins its socket.io room over the polling transport
  (Node's WebSocket can't send the session cookie).
