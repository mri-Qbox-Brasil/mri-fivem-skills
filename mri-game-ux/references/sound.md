# Sound

## Music in phases

Split the flow into phases and give each a track. In the multichar:

| Phase | Starts when | Ends when |
|---|---|---|
| menu | NUI opens (title, landing, selection) | creation opens, or the player enters the game |
| creation | the chapters overlay mounts | NUI closes going to the editor |
| editor | `close` with `keepMusic` | arrival scene starts |
| arrival | `arrivalStart` | `arrivalEnd` / `musicEnd` (fade out) |

- A phase without a configured track keeps the previous phase's (resolve by walking the
  phase order and taking the last track defined up to the current one).
- Cancelling creation returns to the menu phase.
- Entering the game without creation: fade out (2 to 3 s), not a cut.
- Lua announces the end of the flow even when the scene doesn't play (arrival without a
  destination): send `musicEnd` after `Arrival.play`, on every path.

## Crossfade with two decks

- Each track is a deck (YouTube IFrame API or `Audio` for a file in `sounds/`) with
  `setVolume`, `play`, `pause`, `destroy` and a `gain` from 0 to 1.
- Effective volume = chosen volume x phase level (lowered for effects) x gain.
- Switch: create the new deck with gain 0, play it, and animate the gains (new -> 1, old -> 0)
  over ~2.2 s with ease-in-out. A deck that reaches 0 is destroyed.
- No track: an empty marker becomes the "current" and all go down to 0.
- CEF only lets YouTube autoplay muted: `mute()`, `playVideo()`, and `unMute()` +
  `setVolume` ~700 ms later.
- Player paused: a phase change doesn't resume playback by itself.
- Reference: the multichar's `web/src/components/MusicPlayer.tsx`.

## Music survives a closed NUI

The NUI page stays loaded with focus released, and audio keeps playing. What kills the music
is React unmounting the player. Keep the player in the same tree position in every App branch
(fragment with the player as first child, with a fixed `key`), open or closed, and only hide
the ticker.

## Levels and effects

- Lower the music (~0.35) during chapters so effects and voice come through, raise it at the
  final moment (swell) and back.
- Gamepad vibration on confirm and error (`SetPadShake`), only when not on keyboard.

## Interface sounds

Every game screen has interface sounds: without them, navigation feels like a website. Use
GTA's native sounds (`PlaySoundFrontend(-1, name, soundset, true)`), never a file or
synthesized Web Audio (it sounds like a cheap browser game).

- The NUI only sends the moment (`fetch` to a `uiSound` callback with `{ kind }`); Lua
  resolves the name in the resource's `data/sounds.json` (`{ "navigate": { "name", "set" } }`,
  `enabled: false` turns it off). The json is the allow list: the NUI can't play arbitrary
  sounds.
- Moments and defaults (`HUD_FRONTEND_DEFAULT_SOUNDSET`, exists without loading a bank):

| Moment | Sound |
|---|---|
| open the screen | `CHARACTER_SELECT` |
| close, go back one layer (Esc) | `BACK` |
| change item (←/→, rotation scroll) | `NAV_LEFT_RIGHT` |
| change tab (Q/E) | `NAV_UP_DOWN` |
| open panel, search, drawer | `SELECT` |
| confirm action | `SELECT` |
| success | `YES` |
| error, blocked action (ghost in a bad spot) | `ERROR` |

- Sound only when something changes (switching to the same item stays silent) and on the
  same frame as the action.
- Before picking another sound, search the dump (`soundNames.json` in
  [DurtyFree/gta-v-data-dumps](https://github.com/DurtyFree/gta-v-data-dumps)); a DLC
  soundset may need a loaded bank.
- Reference: `data/sounds.json`, `utils.uiSound` and `web/src/lib/uiSound.ts` in mri_Qgarage.

## Cutscenes

- A native GTA cutscene may bring its own music (`TriggerMusicEvent`). Choose between it and
  the phase track: playing both is a mess.
- A free track with credit is the safe default to ship configured. Check that the video
  allows embedding before using it:
  `https://www.youtube.com/oembed?url=<link>&format=json` answers 200 when it does.
- The ticker shows clean track and artist: drop "(Official Audio)", "// Copyright Safe" and,
  when the artist side is a description ("2 Hour Synthwave MIX", "Royalty Free ..."), use the
  channel name.
