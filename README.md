# mri-fivem-skills

Agent skills (Claude Code, Codex and any agent that reads `SKILL.md`) for FiveM resource
development: screens that feel like a real game, glass on the NUI, GTA asset files, world
placement tools and server commands through txAdmin. They come from day-to-day work at
[MRI Brasil](https://github.com/mri-Qbox-Brasil) on Qbox servers.

| Skill | What for |
| --- | --- |
| [`mri-game-ux`](mri-game-ux) | AAA-feeling screens and scenes: scripted camera, transitions without hard cuts, music in phases, menus, NPC conversations |
| [`mri-world-placement`](mri-world-placement) | Place NPCs, objects and zones and record routes in the world, with a ready Lua module and key rail, no flickering markers |
| [`mri-nui-glass`](mri-nui-glass) | Real liquid glass on the NUI: the blurred game behind the panel, which CEF's `backdrop-filter` can't do |
| [`mri-gta-assets`](mri-gta-assets) | GTA V formats (RPF7, RSC7, ytd), texture optimization, single player mods to FiveM resources |
| [`mri-txadmin`](mri-txadmin) | `ensure`, `restart`, `start` and `stop` through the local txAdmin API, no rcon, with the server log |

The skills are written in English; the agent still answers in the user's language, and each
`description` also lists Brazilian Portuguese trigger phrases.

## Install

Clone and link each folder into the agent's skills folder (a link, not a copy, so `git pull`
updates it):

```powershell
git clone https://github.com/mur4i/mri-fivem-skills C:\Github\mri-fivem-skills
foreach ($s in Get-ChildItem C:\Github\mri-fivem-skills -Directory) {
  if (Test-Path "$($s.FullName)\SKILL.md") {
    New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\$($s.Name)" -Target $s.FullName
  }
}
```

Linux/macOS: `ln -s` each folder into `~/.claude/skills/`. Codex: `~/.codex/skills`.

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
