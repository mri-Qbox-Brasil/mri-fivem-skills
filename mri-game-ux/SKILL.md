---
name: mri-game-ux
description: Makes FiveM resource screens and scenes (multichar, character creation, spawn, appearance, loading, cutscenes, NPC conversation) feel like an AAA game - menus that say where they lead, camera and interface transitions without hard cuts, depth of field and handheld camera, music in phases with crossfade, cinema bars, destructive confirmation without a modal. Use when asked for "AAA feel", "more cinematic", "too sudden", "it flickers", "the music stops" (pt-BR: "cara de triple A", "mais cinematográfico", "tá repentino", "tá piscando", "a música para"), or when designing or reviewing an in-game screen flow with a scripted camera and NUI.
---

# AAA game UX in FiveM resources

Goal: the player never sees the seam between NUI, scripted camera and world. Screens enter
and leave on purpose, the camera moves like a film shot, sound follows the phase, nothing
pops in or out.

Reference: MRI's `mri_Qmultichar` (title, showroom, creation, arrival).

## Flow

1. **Survey** (before proposing):
   - map the real flow screen by screen, event by event (NUI message, callback, camera
     switch, fade, `SetNuiFocus`), following the code;
   - at each passage, note what shows: cut, fade, glide, pop;
   - find what unmounts on the switch (conditional component, `if (!isOpen) return`): the
     cause of flicker and of music that stops.
2. **Short proposal**: problem seen, cause in the code, fix with numbers (ms, meters).
   Recommend one option.
3. **Apply** following the subject's reference. Times and distances go to the resource's
   config (`data/*.json`), not loose in code.
4. **Verify** (`references/verification.md`): what the browser shows and what only the game
   shows. Game-only bug: readable log before fixing.
5. **Document** the new behavior in the resource README and where to tune it.

## Principles

- **A menu item says where it leads.** "Continue" with the character name below,
  "Characters" for the list. Empty account: only what is possible ("Create character").
  A useless item disappears instead of being disabled.
- **Nothing pops.** Peds enter and leave with alpha; a screen leaves with fade and blur; the
  next one enters after the camera started moving.
- **Glide near, cut far.** A long flight crosses unstreamed world. Above a threshold (18 m in
  the multichar) cut through black; below it, glide.
- **The interface waits for the scene.** Camera first, then text.
- **Destructive means hold, not modal.** Confirmation on the action bar itself (a ring that
  fills while holding mouse or key), Esc leaves.
- **Sound is a score, not a player.** One track per phase, crossfade on change, survives
  closed screens (editor, cutscene) until the end of the flow.
- **A scene is a scene.** Cutscene and arrival with cinema bars, name as credit, discreet
  "skip".
- **Configurable.** Tracks, camera shots and times in the config, with good defaults.

## References (read only the one for the subject)

| File | When |
|---|---|
| `references/transitions.md` | screens entering and leaving, glide vs cut, ped fade, camera arc |
| `references/camera-scene.md` | scripted camera, depth of field, handheld camera, area streaming, time and weather, 3D text, NPC conversation |
| `references/sound.md` | music in phases, crossfade, music with the NUI closed, effects, cutscenes |
| `references/menus.md` | title, landing, selection, destructive confirmation, gamepad, world prompts |
| `references/nui-pitfalls.md` | flicker on switch, player that restarts, animation vs transform, loadscreen, legibility over the world |
| `references/verification.md` | screenshots and measurements in headless Chrome, music check, diagnostic logs |

## Rules

- Integrate through the other resource's public contract (events, exports, upstream
  statebags), never depending on a new API of it.
- No fallback hiding a bug. An animation doesn't play: find out why.

## Maintenance

At the end of each use, follow "Maintenance" in the repo root `README.md`. A new approved
pattern goes into the subject's reference.
