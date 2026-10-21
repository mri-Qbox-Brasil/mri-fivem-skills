# mri-fivem-skills

Agent skills (Claude Code, Codex and any agent that reads `SKILL.md`) for FiveM resource
development: screens that feel like a real game, glass on the NUI, GTA asset files, world
placement tools, server commands through txAdmin, checking resources, wrapping third-party
resources, options in the admin panel and the NUI's Chromium version. They come from day-to-day work at
[MRI Brasil](https://github.com/mri-Qbox-Brasil) on Qbox servers.

| Skill | What for |
| --- | --- |
| [`mri-game-ux`](mri-game-ux) | AAA-feeling screens and scenes: scripted camera, transitions without hard cuts, music in phases, menus, NPC conversations |
| [`mri-world-placement`](mri-world-placement) | Place NPCs, objects and zones and record routes in the world, with a ready Lua module and key rail, no flickering markers |
| [`mri-nui-glass`](mri-nui-glass) | Real liquid glass on the NUI: the blurred game behind the panel, which CEF's `backdrop-filter` can't do |
| [`mri-txadmin`](mri-txadmin) | `ensure`, `restart`, `start`, `stop`, whole server restart and any console command through the txAdmin API (local, or a VPS over an SSH tunnel), no rcon, with the server log |
| [`mri-resource-check`](mri-resource-check) | Check a resource before calling it done: Lua parser with CfxLua syntax, natives that don't exist or run on the wrong side, native lookup, `SetTimeout` and framework-event timing traps, manifest pitfalls, reload order, which log shows what |
| [`mri-upstream-wrap`](mri-upstream-wrap) | Change third-party resources without editing them: wrapper folder, hooks, keybinds, `provide` with a compat layer for exports, exports stuck after an ensure |
| [`mri-nui-cef`](mri-nui-cef) | NUI on FiveM's Chromium: CEF 103 limits, what CEF 144 breaks and opens up, a scanner for the breaking changes, file upload from the NUI, a NUI card over the pause map |

The skills are written in English; the agent still answers in the user's language, and each
`description` also lists Brazilian Portuguese trigger phrases.

## Install

**Claude Code, Codex and other coding agents** (terminal, the Code tab of the Claude desktop
app, IDE extensions): paste this and the agent installs everything by itself. Send it again
later to update.

```
Install the FiveM skills from https://github.com/mri-Qbox-Brasil/mri-fivem-skills by following its INSTALL.md.
```

**Claude app chat:** download the skill's zip from the
[site](https://skills.mriqbox.com.br/#install) and upload it in Settings >
Capabilities > Skills.

**By hand:** clone and link each folder into the agent's skills folder (a link, not a copy, so
`git pull` updates it).

Windows (PowerShell):

```powershell
git clone https://github.com/mri-Qbox-Brasil/mri-fivem-skills "$HOME\mri-fivem-skills"
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Get-ChildItem "$HOME\mri-fivem-skills" -Directory | Where-Object { Test-Path "$($_.FullName)\SKILL.md" } |
  ForEach-Object { New-Item -ItemType Junction -Path "$HOME\.claude\skills\$($_.Name)" -Target $_.FullName }
```

macOS / Linux:

```bash
git clone https://github.com/mri-Qbox-Brasil/mri-fivem-skills ~/mri-fivem-skills
mkdir -p ~/.claude/skills
for d in ~/mri-fivem-skills/*/; do [ -f "$d/SKILL.md" ] && ln -s "${d%/}" ~/.claude/skills/; done
```

The clone can live in any folder. For Codex, use `.codex` instead of `.claude`.

`mri-txadmin` needs a `config.json` (copy `config.example.json`); it stays out of git.

## Maintenance

Each skill improves with use. When a task ends, the agent checks whether something should be
recorded (an approved pattern, a new pitfall, a missing step) and edits the skill:

- only what is general and confirmed, as a short imperative rule, not a story;
- edit what exists before adding; a new rule that contradicts an old one replaces it;
- `SKILL.md` up to ~150 lines, details in `references/`;
- a new capability goes into the `description` in the same commit;
- never secrets, passwords, personal paths or private server data.

## Contributing

New skills are welcome through pull requests: see [CONTRIBUTING.md](CONTRIBUTING.md). Every PR
runs a check (frontmatter, README listing, self-contained scripts, no secrets) and is reviewed
before merging.

## License

[MIT](LICENSE).
