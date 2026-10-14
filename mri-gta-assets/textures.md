# Texture optimization

## Where the weight is

In mod cars the problem is almost never a giant texture: it is an **uncompressed texture**
(A8R8G8B8, 4 bytes per pixel). Measured on mod cars:

| Car | Disk | Raw textures | Already compressed | After |
| --- | --- | --- | --- | --- |
| m2trg (BMW M2) | 20.9 MB | 130 MB | 16 MB | memory 147.5 -> 42 MB, disk 8.3 MB |
| elegyrh7 | 3.5 MB | 4.5 MB | 7.9 MB | little gain |
| 93sultan, rossati | small | almost none | | nothing |

DXT1 (no alpha) = 1/8 of raw; DXT5 (with alpha) = 1/4. There is also the author's watermark as
a texture (e.g. "Created By TRG WORKS", 1920x1080).

## What `ytd.rs` does

- **Raw texture** (21, 22, 32): becomes DXT1 if every pixel has alpha 255 (X8 always),
  otherwise DXT5. Uses the mips the file already has; when missing, generates them by 2x2
  average. `texpresso` encoder (pure Rust, MIT), ClusterFit; uniform weights on normal maps
  (`_n`, `_nm`, `_nrm`, `normal`), perceptual on the rest; with alpha, weights color by alpha.
- **Texture above `max_size`** (default 2048): drops the top mips. In DXT it only works if the
  file already has the smaller mips (it doesn't decode).
- Left out: dimension not a multiple of 4, 3D texture, BC7, A8/L8, anything already
  compressed and within size.
- Keeps name, resolution (if under the limit) and the rest of the struct; changes width,
  height, stride, format, levels and pixel pointer; repacks the graphics pages; updates the
  page count in the table; deflate `best`.
- **Page limit**: never exceeds the original count plus the free space (zeroed and outside
  known blocks) after the table. In practice there is no room, so it keeps the count and the
  packer uses bigger pages. Costs about 10 MB over optimal on a large car.
- `estimate` reads only the system section (fast, for scanning a server). Since it doesn't see
  alpha, it counts every texture with alpha as DXT5: the real result can only be smaller. For
  X8 and DXT it is exact (there is a test).

## What `textures.rs` does

- `scan`: every `.ytd` inside each resource's `stream`, `estimate`, list from biggest gain to
  smallest. A resource with a backup shows even with nothing to do (to undo).
- `apply`: optimizes each ytd, re-reads it with `inspect` (same texture count), keeps the
  original in `backup_optimize/<resource>/<path>` (only the first backup: a second run doesn't
  overwrite the original), swaps through temporary + rename.
- `restore`: puts the originals back (temporary + rename) and deletes the backup.
- Send `restart <resource>` afterwards (with no server running, just warn).

## Ideas for later

- Textures embedded in `.yft`/`.ydr` (the biggest gain left).
- Downsize large DXT without mips (decode with `texpresso`, shrink, re-encode).
- Move the page table to recover the slack.
- Remove textures duplicated between `.yft` and `.ytd` and watermarks (only on the user's
  choice).
- Optimize right at mod install time.
