# mri-game-ux

Agent skill that makes FiveM resource screens and scenes feel like an AAA game: menus that
say where they lead, camera and interface transitions without hard cuts, depth of field and
handheld camera, music in phases with crossfade, cinema bars and destructive confirmation
without a modal.

The patterns come from `mri_Qmultichar` (title screen, showroom, character creation and city
arrival), the reference example.

## Install

See the repo root `README.md`.

## Use

In a session opened on the server folder or the resource repo:

```
/mri-game-ux mri_Qspawn
```

or in plain words: "the spawn entrance is too sudden, make it more cinematic".

## Contents

- `SKILL.md`: flow (survey, proposal, apply, verify, document), principles and rules.
- `references/`: transitions, camera and scene, sound, menus, NUI pitfalls and verification.
  The agent reads only the one for the subject.
- `scripts/nui-probe.mjs`: runs steps on a NUI in browser mode through headless Chrome (Lua
  messages, clicks, screenshots and per-frame opacity).
