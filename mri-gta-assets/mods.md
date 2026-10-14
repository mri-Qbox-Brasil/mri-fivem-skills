# Conversão de mod single player para FiveM

Implementação de referência: `gtamods.rs` (instalador da MRI).

## Download do gta5-mods.com

- A página do mod define um cookie. `GET /download/<id>` com esse `Cookie` e `Referer` da página
  devolve o link `files.gta5-mods.com/uploads/...`.
- Extração: `zip` e `.oiv` com o crate `zip`; `rar` e `7z` pelo `tar.exe` do Windows
  (libarchive). Preparação em `%TEMP%\mri_installer_mods\<id>\build`, limpa depois de 24 h.
- O site pode mudar a qualquer hora: é a parte mais frágil.

## Montagem do resource

- **Resource pronto**: se o pacote tem pasta com `fxmanifest.lua` ou `__resource.lua`, instala
  como está (scripts dentro viram aviso). Evita misturar versão SP e FiveM do mesmo pacote.
- Pastas com "fivem" no nome são lidas primeiro.
- Arquivos de stream de `dlc.rpf` ou soltos vão para `stream/`; metas para `data/`, com o
  `data_file` certo no manifest pelo elemento raiz do XML, nesta ordem de carga:

| Raiz do XML | data_file |
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

  `.ytyp` ganha `DLC_ITYP_REQUEST`.
- **Roupa de ped**: componente (`jbib_000_u.ydd`, `feet_diff_025_a_uni.ytd`) vira
  `<ped>^<arquivo>`. O ped vem da pasta mãe quando ela é o nome de um `.ymt` do pacote ou parece
  ped (`mp_m_freemode_01`, `player_`, padrão `x_m_y_`); senão, do único `.ymt` do pacote.
- **Ped novo** (`.yft` + `.ymt` com o mesmo nome): gera `data/generated/peds.meta`. O gênero é
  chute; a tela deixa trocar.
- Pulados com motivo: áudio, script, criptografado, meta desconhecido, duplicado, sem suporte.
- Asset acima de 16 MiB de memória vira aviso.

## Instalação

- Destino `resources/[addons]/[vehicles|peds|clothes|weapons|maps]/<nome>`; o `[addons]` entra
  no `server.cfg` com `ensure` uma vez.
- Servidor rodando: `refresh` (sem ele o servidor não vê pasta nova) e `ensure <nome>`.
- Carro: a tela mostra `/car <modelo>` para copiar.

## Validado ao vivo

BMW M2 (dlc.rpf), Ada Wong (peds gerados), Yeezy (`player_one^`), Alone jumper e Kings
(pastas FiveM prontas). Loja de roupas, áudio e Menyoo ainda não.
