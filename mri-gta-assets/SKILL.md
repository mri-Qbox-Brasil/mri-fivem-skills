---
name: mri-gta-assets
description: "GTA V/FiveM 3D and stream files (cars, clothes, peds, weapons, animations, maps) - RPF7 and RSC7 formats (.ytd, .yft, .ydr, .ydd, .ycd, .ymap, .ytyp), metas (vehicles.meta, carcols, peds.meta, shop_ped_apparel), converting a single player mod into a FiveM resource, texture optimization (DXT, video memory, pages) and how to read and write these files without OpenIV/CodeWalker. Use when asked to \"optimize this car\", \"convert this mod to FiveM\", \"why is this car/map so heavy\", \"read/write ytd\", \"uncompressed texture\", \"install a clothing/ped/weapon/map mod\" (pt-BR: \"otimiza esse carro\", \"converte esse mod pra FiveM\", \"por que pesa tanto\"), or when writing code that reads or writes these formats."
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
