---
name: mri-game-ux
description: "Makes FiveM resource screens and scenes (multichar, character creation, spawn, appearance, loading, cutscenes, NPC conversation) feel like an AAA game - menus that say where they lead, camera and interface transitions without hard cuts, depth of field and handheld camera, music in phases with crossfade, cinema bars, destructive confirmation without a modal, player settings panels with fixed size and a preview card for every visual choice. Use when asked for \"AAA feel\", \"more cinematic\", \"too sudden\", \"it flickers\", \"the music stops\", \"the camera goes through walls\", \"my ped blocks the camera\", \"can't look from above\" (pt-BR: \"a câmera atravessa parede\", \"meu ped atrapalha a câmera\", \"não dá pra olhar por cima\", \"cara de triple A\", \"mais cinematográfico\", \"tá repentino\", \"tá piscando\", \"a música para\"), or when designing or reviewing an in-game screen flow with a scripted camera and NUI."
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
- **One thing on screen at a time.** One action can fire several gains (skill XP, player XP,
  level up). A level up shows only its notice, with no bar; otherwise one bar, the most specific
  (the skill over the player level), and anything arriving during the notice is dropped.
- **Side quests come from people, with RPG marks.** The mark over the head says what the player can
  do there, never just "this is a quest NPC": yellow **!** = has a quest to offer, yellow **?** = ready
  to hand in, grey **?** (or nothing) = quest running, nothing to do here yet. GTA markers have a ?
  (type 32) but no !, so the ! is drawn another way (DUI in the world, sprite or 3D text); a ? on an
  offer reads wrong (Murai, 2026-10-22). The marks are 3D text over the head. On the map, an offer
  uses blip 934 (`radar_attention`, build 3095+, falls back to 66) and a hand-in blip 66 (the GTA
  "random character"). The person is a local ped of that player only, created near and deleted far; at the end
  it walks off (`TaskWanderStandard`, delete later) instead of vanishing.
- **Progress is live.** The card of the step in hand moves while the player does it: distances and
  counters add up on the client every second and show at once (server value plus what is pending);
  the server gets them in batches and on the moment the goal is hit. A counter that waits for a
  30 s report feels broken (mri_Qrpg, 2026-10-22).
- **Configurable.** Tracks, camera shots and times in the config, with good defaults.
- **A settings panel shows, it doesn't list.** Fixed size (never resizes on tab or option),
  every visual choice is a card with a picture of the result in the real color, options that
  depend on another dim instead of vanishing. Details in `references/menus.md`.

## References (read only the one for the subject)

| File | When |
|---|---|
| `references/transitions.md` | screens entering and leaving, glide vs cut, ped fade, camera arc |
| `references/camera-scene.md` | scripted camera, depth of field, handheld camera, area streaming, time and weather, 3D text, NPC conversation |
| `references/sound.md` | music in phases, crossfade, music with the NUI closed, effects, cutscenes |
| `references/menus.md` | title, landing, selection, destructive confirmation, gamepad, world prompts, player settings panels |
| `references/nui-pitfalls.md` | flicker on switch, player that restarts, animation vs transform, loadscreen, legibility over the world |
| `references/verification.md` | screenshots and measurements in headless Chrome, music check, diagnostic logs |
| `references/dev-mock.md` | browser dev mode for a NUI: stateful mock server, one scenario per screen, data read from the Lua config |
| `references/vehicle-targets.md` | aim prompt on a car: door, seat and lid spots, enter into the right seat, trunk inventory |

## Rules

- Integrate through the other resource's public contract (events, exports, upstream
  statebags), never depending on a new API of it.
- No fallback hiding a bug. An animation doesn't play: find out why.

## Maintenance

At the end of each use, follow "Maintenance" in the repo root `README.md`. A new approved
pattern goes into the subject's reference.
