# Install mri-fivem-skills (instructions for the agent)

The user asked you to install these skills. Follow these steps yourself, using your shell
tools. Running them again is safe: it updates what exists and adds what is missing. Talk to
the user in their language and keep it short.

## 1. Where skills go

Find the skills folder of the agent you are:

| Agent | Skills folder |
| --- | --- |
| Claude Code (CLI, desktop app Code tab, IDE extensions) | `~/.claude/skills` |
| Codex | `~/.codex/skills` |
| Other | check the agent's docs; if unsure, ask the user |

`~` is the user's home folder (`$HOME` in PowerShell and bash). Create the skills folder if it
doesn't exist.

## 2. Get the repo

The clone lives in `~/mri-fivem-skills` unless the user names another folder.

- Already there and it is a git clone: `git -C ~/mri-fivem-skills pull`.
- Not there and `git` is available: `git clone https://github.com/mri-Qbox-Brasil/mri-fivem-skills ~/mri-fivem-skills`.
- No `git`: download `https://github.com/mri-Qbox-Brasil/mri-fivem-skills/archive/refs/heads/main.zip`,
  extract it and rename the folder to `~/mri-fivem-skills`. Tell the user that updating later
  means running this install again.

## 3. Link each skill

Every top-level folder of the repo that contains a `SKILL.md` is a skill. For each one, create
a link inside the skills folder with the same name, pointing to the folder in the clone. A
link (not a copy) keeps the skills current after each update.

- Windows: a junction, which needs no admin rights:
  `New-Item -ItemType Junction -Path "$HOME\.claude\skills\<name>" -Target "$HOME\mri-fivem-skills\<name>"`
- macOS / Linux: `ln -s ~/mri-fivem-skills/<name> ~/.claude/skills/<name>`

Rules:

- A link with that name already pointing to the clone: leave it.
- A real folder or a link pointing elsewhere with that name: don't touch it; tell the user.
- Never change or remove other skills in the folder.
- If the user only wants some skills, link only those.

## 4. Finish

- List what was installed, what was already there and what was skipped, with the reason.
- Tell the user the skills load in a new session (restart the app or open a new
  conversation).
- `mri-txadmin` needs a `config.json` with the txAdmin login before its first use: say so in
  one line, and only set it up if the user asks.
- Don't run any script from the skills during install.

## Claude app chat (no file access)

If you are the Claude chat app without access to the user's files, you can't install. Tell the
user to download each skill's zip from https://mri-qbox-brasil.github.io/mri-fivem-skills and upload it
in Settings > Capabilities > Skills.
