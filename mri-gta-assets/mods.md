# Single player mod to FiveM

Reference implementation: `gtamods.rs` (MRI installer).

## Download from gta5-mods.com

- The mod page sets a cookie. `GET /download/<id>` with that `Cookie` and the page as
  `Referer` returns the `files.gta5-mods.com/uploads/...` link.
- Extraction: `zip` and `.oiv` with the `zip` crate; `rar` and `7z` through Windows'
  `tar.exe` (libarchive). Work folder in `%TEMP%\<tool>\<id>\build`, cleaned after 24 h.
- The site can change any time: it is the most fragile part.

## Building the resource

- **Ready resource**: if the package has a folder with `fxmanifest.lua` or `__resource.lua`,
  install it as is (scripts inside become a warning). Avoids mixing the SP and FiveM versions
  of the same package.
- Folders with "fivem" in the name are read first.
- Stream files from `dlc.rpf` or loose go to `stream/`; metas to `data/`, with the right
  `data_file` in the manifest by the XML root element, in this load order:

| XML root | data_file |
| --- | --- |
| CVehicleMetadataMgr | VEHICLE_LAYOUTS_FILE |
| CHandlingDataMgr | HANDLING_FILE |
| CVehicleModelInfo__InitDataList | VEHICLE_METADATA_FILE |
| CVehicleModelInfoVarGlobal | CARCOLS_FILE |
| CVehicleModelInfoVariation | VEHICLE_VARIATION_FILE |
| CPedModelInfo__InitDataList | PED_METADATA_FILE |
| CPedModelInfo__PersonalityDataList | PED_PERSONALITY_FILE |
| CWeaponModelInfo__InitDataList | WEAPON_METADATA_FILE |
| CWeaponAnimationsSets | WEAPON_ANIMATIONS_FILE |
| CWeaponComponentInfoBlob | WEAPONCOMPONENTSINFO_FILE |
| CWeaponInfoBlob | WEAPONINFO_FILE |
| ShopPedApparel | SHOP_PED_APPAREL_META_FILE |
| CExtraTextMetaFile | DLCTEXT_FILE |

  `.ytyp` gets `DLC_ITYP_REQUEST`.
- **Ped clothing**: a component (`jbib_000_u.ydd`, `feet_diff_025_a_uni.ytd`) becomes
  `<ped>^<file>`. The ped comes from the parent folder when it is the name of a `.ymt` in the
  package or looks like a ped (`mp_m_freemode_01`, `player_`, pattern `x_m_y_`); otherwise,
  from the package's only `.ymt`.
- **New ped** (`.yft` + `.ymt` with the same name): generates `data/generated/peds.meta`. The
  gender is a guess; let the user change it.
- Skipped with a reason: audio, script, encrypted, unknown meta, duplicate, unsupported.
- An asset above 16 MiB of memory becomes a warning.

## Install

- Destination `resources/[addons]/[vehicles|peds|clothes|weapons|maps]/<name>`; `[addons]`
  goes into `server.cfg` with `ensure` once.
- Server running: `refresh` (without it the server doesn't see a new folder) and
  `ensure <name>`.
- Car: show `/car <model>` to copy.

## Validated live

BMW M2 (dlc.rpf), Ada Wong (generated peds), Yeezy (`player_one^`), Alone jumper and Kings
(ready FiveM folders). Clothing shop, audio and Menyoo not yet.
