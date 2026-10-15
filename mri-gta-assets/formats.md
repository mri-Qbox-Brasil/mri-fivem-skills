# Formats

Everything little-endian. Values validated by reading real mod files (BMW M2, Elegy RH7,
Sultan, Rossati, peds and clothes).

## RPF7 (`.rpf` package)

- 16-byte header: magic `0x52504637`, entry count, name table size, encryption. Only opens
  with encryption `0` or `OPEN` (`0x4E45504F`); AES/NG is refused (base game `.rpf` files are
  NG, mod ones are usually OPEN).
- 16-byte entries right after the header; names after them.
  - Directory: second u32 == `0x7FFFFF00`; third = index of the first child, fourth = count.
  - File: the first two u32 form a u64. Name in 16 bits, size in 24 bits, offset in 512-byte
    blocks.
  - **Resource** (yft, ytd...): bit 31 of the second u32 set; offset masked with `0x7FFFFF`.
    The last two u32 are the system and graphics flags. Size `0xFFFFFF` = large: the real
    size is scattered in the stored header, bytes `[7] | [14]<<8 | [5]<<16 | [2]<<24`.
  - Binary: raw deflate when the stored size differs from the uncompressed one.
- To extract a resource, rebuild the RSC7 header: `version = (gfx>>28) | ((sys>>28)<<4)`,
  then the system and graphics flags, then the stored data from byte 16 on (always rebuild:
  in large ones the first 16 stored bytes are corrupted).
- `.rpf` inside `.rpf` is opened recursively (depth limit 4).

## RSC7 (every compiled file: ytd, yft, ydr, ydd, ycd, ybn, ymap, ytyp...)

- Header: `RSC7`, version (u32), system flags (u32), graphics flags (u32). The rest is raw
  deflate of the system section followed by the graphics section.
- Versions: ytd `13`, ydr `165`, yft `162`, ydd `165`. Check the version before interpreting.
- Pointers: `0x5XXXXXXX` = offset in the system section, `0x6XXXXXXX` = offset in the
  graphics one.
- **Section size from the flags** (base `0x200 << (flags & 0xF)`):
  ```
  pages = bit27 + bit26*2 + bit25*4 + bit24*8 + (bits17..23)*16 + (bits11..16)*32
        + (bits7..10)*64 + (bits5..6)*128 + bit4*256      (in base units)
  ```
  Equivalent in real pages (base `0x2000 << shift`): up to 127 pages of 1x, 63 of 2x, 15 of
  4x, 3 of 8x and 1 of 16x (bits 17, 11, 7, 5, 4), plus 4 tail pages of 1/2, 1/4, 1/8 and
  1/16 (bits 24 to 27). The top 4 bits of each flag are part of the version: preserve them.
- Memory the game reserves = page size, not data size. FiveM warns above 16 MiB per section
  (`optimize.rs` marks it critical).
- **Page table** (`ResourcePagesInfo`, pointer at `0x08` of the root): u32, u32, u8 system
  pages, u8 graphics pages, u16, u32, then 8 bytes per page (zeroed in the file, the game
  fills them). In real files it is glued to the next block (`0xCD` padding): **the page count
  can't grow** without moving the table.
- **Packing pages** (the editors' rule, reimplemented in `ytd::pack`): blocks from largest to
  smallest; the largest page is the smallest power of 2 of the base that fits the largest
  block; each block goes into the first page with room (16-byte alignment), otherwise opens a
  new page of the smallest size that fits; if the count limits overflow, double the base and
  retry. Objects never cross pages.

## Texture dictionary (`.ytd`, version 13)

Root (system, offset 0):
| Offset | Field |
| --- | --- |
| `0x08` | page table pointer |
| `0x20` / `0x28` | name hash list (u64 pointer, u16 count) |
| `0x30` / `0x38` | texture pointer list (u64 pointer, u16 count) |

Texture (`0x90` bytes, in the system section):
| Offset | Field |
| --- | --- |
| `0x28` | name pointer (null-terminated string) |
| `0x50` / `0x52` / `0x54` | width, height, depth (u16) |
| `0x56` | stride (u16) |
| `0x58` | format (u32) |
| `0x5D` | mip levels (u8) |
| `0x70` | pixel pointer (graphics section) |

- Formats: `21` A8R8G8B8 (memory B,G,R,A), `22` X8R8G8B8, `32` A8B8G8R8 (R,G,B,A), `28` A8,
  `50` L8, FourCC `DXT1`, `DXT3`, `DXT5`, `ATI1`, `ATI2`, `BC7 ` (with a space).
- **Stride as files store it**: bytes per pixel row, not per block row. DXT1 = width/2,
  DXT3/DXT5 = width, 32 bits = width*4.
- Data size: `stride * height`, adding a quarter less per mip. Matches reality while the mip
  is at least 4x4 and a multiple of 4; that's why the optimizer stops mips at 4x4.
- In a ytd, the graphics section only holds pixels: the `0x70` pointers are the only ones
  into it.
- The other texture fields (`0x00`-`0x4F`, usage, flags) stay as they are.

## Renaming a streamed prop (validated in game)

- The model name lives only in the `.ytyp` (RSC7 version 2): archetype name, asset name and
  texture dictionary are stored as joaat hashes (u32 little endian). The `.ydr` and `.ytd`
  don't carry the name: renaming the file is enough for them.
- `scripts/prop-rename.mjs` swaps the hashes in the inflated `.ytyp`, recompresses with the
  same 16-byte header, re-reads to compare, writes through temp + rename and renames the
  files. Without `--apply` it only prints the hits.
- Check the output: every old name must have a hit count (usually 3 per model, 1 per txd
  reference) and a dry run after applying must show no old hash left.
- A PSO `.ymf` next to it (big endian) may hold none of the names; it can be renamed as is.
- Update every script that spawns the model or loads the texture dictionary by name
  (`CreateObject`, placement preview, `RequestStreamedTextureDict`).
- Lost a stream file? FXServer keeps a hard link in `cache/files/<resource>/stream_cache`
  (hashed names): find it by RSC7 version and the names inside before giving it up.

## Others (not implemented yet)

- `.yft` (fragment, car): drawable with a `ShaderGroup` that may carry an embedded texture
  dictionary; the graphics section also holds vertex and index buffers.
- `.ydr` (drawable, prop), `.ydd` (drawable dictionary, clothing), `.ycd` (animation clips),
  `.ybn` (collision), `.ymap`/`.ytyp` (map; meta in binary RSC7 format).
- `+hi.ytd` and `_hi.yft`: high resolution versions the game loads up close.
