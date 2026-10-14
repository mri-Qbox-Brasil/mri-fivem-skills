# Contributing

New skills and improvements to existing ones are welcome. A skill here is knowledge an agent
loads when the task calls for it: rules that worked in practice, the pitfalls, and small
scripts or templates that save rebuilding something from scratch.

## What makes a good skill

- **About FiveM development**: resources, NUI, Lua, the game's natives and files, server
  tooling.
- **Validated**: it comes from real use and says what was tested in game and what only in the
  browser. No guesses.
- **Rules, not stories**: short imperative lines, exact names (native, event, file) instead of
  descriptions, the "why" in half a line when a rule looks odd without it.
- **Focused**: one subject per skill. If it overlaps an existing skill, improve that one.

## Layout

```
my-skill/
  SKILL.md          # required
  references/       # optional, details the agent reads only when needed
  scripts/          # optional, runnable helpers
  templates/        # optional, code to copy into a resource
```

`SKILL.md` starts with frontmatter:

```markdown
---
name: my-skill
description: "What it does and when to use it, with the phrases people would type to ask for it."
---
```

- `name`: the folder name, lowercase kebab-case, up to 64 characters.
- `description`: up to 1024 characters. The agent only sees this before opening the skill, so
  every capability and trigger phrase goes here. Phrases in other languages are welcome in
  parentheses. Keep it on one line in double quotes (escape `"` inside as `\"`): unquoted, a
  `: ` or ` #` breaks strict YAML readers such as GitHub's preview.
- `SKILL.md` up to ~150 lines; move details to `references/` and say when to read each one.
- English. The agent still answers in the user's language.

## Scripts and templates

- **Self-contained**: import only from inside the skill folder, since skills are often copied
  alone. If two skills need the same helper, each keeps a copy.
- Prefer Node 18+ with no dependencies. If something must be installed, the `SKILL.md` says
  how.
- No hidden network calls, telemetry or downloads of code at run time.
- Anything that needs credentials reads them from a local file that is gitignored, with a
  `*.example.json` next to it.

## Never

- Secrets, tokens, passwords, webhooks, IPs, personal paths or private server data.
- Code from paid or escrowed resources, or a detailed breakdown of how they work.
- Instructions that make the agent do something the user didn't ask for (push, publish,
  delete, send data out).

## Opening the PR

1. Fork, create a branch, add or change the skill.
2. Add the skill to the table in the root `README.md`.
3. Run the same check the CI runs:
   ```bash
   node .github/scripts/validate-skills.mjs
   ```
4. Open the PR and fill in the template.

By contributing you agree to license your work under the repo's [MIT license](LICENSE).
