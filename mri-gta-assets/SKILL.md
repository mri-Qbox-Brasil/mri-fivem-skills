---
name: mri-gta-assets
description: "GTA V/FiveM game files: RPF7/RSC7 (.ytd, .yft, .ydr, .ydd, .ycd, .ymap, .ytyp), metas (vehicles.meta, carcols, peds.meta), single player mod to FiveM resource, texture optimization (DXT, pages), reading/writing these without OpenIV, pulling an original file out of the encrypted game .rpf, editing a Scaleform .gfx menu or HUD movie (decompile, change AS2 classes, recompile with FFDec, stream it) and talking to a pause menu page from Lua, plus a lookup of real game names (sounds, animations, scenarios, props, peds, vehicles, weapons, particles, walk styles, timecycles). Use when asked to \"optimize this car\", \"convert this mod to FiveM\", \"why is it so heavy\", \"read/write ytd\", \"extract this file from the game\", \"edit this gfx/scaleform\", \"change the pause menu\", \"which sound/animation/prop\" (pt-BR: \"otimiza esse carro\", \"converte esse mod\", \"tira esse arquivo do jogo\", \"edita esse gfx\", \"mexe no pause menu\", \"qual som/animação usar\"), or when code reads these formats or uses a game name."
---

# GTA V assets (models, textures, mods)

Knowledge validated in practice about the files the game uses for cars, clothes, peds,
weapons, animations and maps. Module names cited (`rpf.rs`, `ytd.rs`, `textures.rs`,
`gtamods.rs`, `optimize.rs`) belong to the reference implementation in Rust, in the MRI
installer.

| Subject | Reference |
| --- | --- |
| RPF7, RSC7, pages, texture dictionary, other formats | [formats.md](formats.md) |
| Texture weight, DXT compression, downsizing, backup and undo | [textures.md](textures.md) |
| Single player mod to FiveM resource, `data_file` per meta | [mods.md](mods.md) |
| Scaleform `.gfx`: original from the `.rpf`, decompile, recompile, pause menu channel | [scaleform.md](scaleform.md) |

## Real game names (look up, never guess)

Before writing a sound, animation, scenario, prop, ped, vehicle, weapon, particle, walk style
or timecycle name, search the real one. Names from memory are often wrong or don't exist.

```bash
node scripts/gta-data.mjs list                       # categories
node scripts/gta-data.mjs sounds zip                 # UNZIP  FBI_01_SOUNDS (name, soundset)
node scripts/gta-data.mjs anims sit chair            # dictionary and matching clips
node scripts/gta-data.mjs props chair office
```

- Data from [DurtyFree/gta-v-data-dumps](https://github.com/DurtyFree/gta-v-data-dumps),
  downloaded on first use and cached for a month in the system temp folder. Data only.
- Several words narrow the search (all must match); `--all` lists past 40 results.
- A name existing is not enough: a DLC soundset may need its bank loaded, an animation
  clip may be a pose or a facial track (`_facial`). Check in game.
- Natives are looked up with `mri-resource-check` (`scripts/natives.mjs`).

## Rules that always apply

- **No CodeWalker code.** Its source is published "for educational purposes only", without an
  open license. Reading it to understand a format is fine; copying code or bundling the DLL is
  not.
- **Always write stream files through a temporary file + rename**, never in place. FXServer
  links `stream` files into its own cache (`cache/files/<resource>/stream_cache`) by hard link:
  writing in place changes the cache too, with the old hash.
- **Back up before touching** a server file, outside `resources` (FiveM tries to load whatever
  is in `stream`). Default: `<server>/backup_optimize/<resource>/<path>`.
- **Validate by re-reading** the generated file before replacing the original.
- The real test is in game: `restart <resource>` and spawn it (`/car <model>`). A broken file
  crashes the client, it doesn't error on the server.

## Not solved yet (by value)

1. Textures embedded in `.yft`/`.ydr` (the model carries its own dictionary). Requires
   finding the dictionary inside the drawable structure and rebuilding the graphics section
   together with the vertex/index buffers that live there too.
2. Downsizing a large DXT texture without smaller mips (needs decode, resize and re-encode;
   `texpresso` decodes BC1-BC5).
3. Recovering page slack: the new file keeps the original page count (the table has no room
   to grow), wasting about 10 MB on a large car. Way out: move the page table to the end of
   the system section when there is room.
4. Clothes showing in the shop, car audio (`.awc`, `dlctext`), Menyoo, animations (`.ycd`),
   maps (`.ymap`/`.ytyp`, `.ybn` collision).

## Maintenance

A confirmed format, a new pitfall or a delivered feature: update the right reference (one or
two lines). Offsets only go in after being validated on a real file.
