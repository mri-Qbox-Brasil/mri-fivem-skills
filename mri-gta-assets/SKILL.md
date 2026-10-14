---
name: mri-gta-assets
description: Arquivos 3D e de stream do GTA V/FiveM (carros, roupas, peds, armas, animações, mapas) - formatos RPF7 e RSC7 (.ytd, .yft, .ydr, .ydd, .ycd, .ymap, .ytyp), metas (vehicles.meta, carcols, peds.meta, shop_ped_apparel), conversão de mod single player para resource FiveM, otimização de texturas (DXT, memória de vídeo, páginas) e como ler e gravar esses arquivos sem OpenIV/CodeWalker. Use quando pedirem "otimiza esse carro", "converte esse mod pra FiveM", "por que esse carro/mapa pesa tanto", "lê/grava ytd", "textura sem compressão", "instalar roupa/ped/arma/mapa de mod", ou ao escrever código que lê ou grava esses formatos.
---

# Assets do GTA V (modelagem, texturas, mods)

Conhecimento validado na prática sobre os arquivos que o jogo usa para carros, roupas, peds,
armas, animações e mapas. Os nomes de módulo citados (`rpf.rs`, `ytd.rs`, `textures.rs`,
`gtamods.rs`, `optimize.rs`) são da implementação de referência em Rust, no instalador da MRI.

| Assunto | Referência |
| --- | --- |
| RPF7, RSC7, páginas, dicionário de texturas, outros formatos | [formats.md](formats.md) |
| Peso de textura, compressão DXT, reduzir, backup e desfazer | [textures.md](textures.md) |
| Mod single player para resource FiveM, `data_file` por meta | [mods.md](mods.md) |

## Regras que valem sempre

- **Código do CodeWalker não entra.** O fonte é publicado "for educational purposes only",
  sem licença aberta. Ler para entender o formato pode; copiar código ou embutir a DLL, não.
- **Gravar arquivo de stream sempre por arquivo temporário + rename**, nunca por cima. O
  FXServer liga os arquivos de `stream` no próprio cache (`cache/files/<resource>/stream_cache`)
  por hard link: escrever por cima muda o cache também, com o hash antigo.
- **Backup antes de mexer** em arquivo do servidor, fora de `resources` (o FiveM tenta carregar
  o que estiver em `stream`). Padrão: `<servidor>/backup_optimize/<resource>/<caminho>`.
- **Validar relendo** o arquivo gerado antes de trocar o original.
- O teste de verdade é no jogo: `restart <resource>` e spawnar (`/car <modelo>`). Arquivo
  errado crasha o cliente, não dá erro no servidor.

## Ainda não resolvido (por ordem de valor)

1. Texturas embutidas no `.yft`/`.ydr` (o modelo carrega um dicionário próprio). Exige achar o
   dicionário dentro da estrutura do drawable e remontar o graphics junto com vertex/index
   buffers, que também moram lá.
2. Reduzir textura DXT grande que não tem mips menores (precisa decodificar, redimensionar e
   recodificar; o `texpresso` decodifica BC1-BC5).
3. Recuperar a folga de páginas: o arquivo novo mantém a contagem de páginas do original (a
   tabela não tem espaço para crescer), perdendo uns 10 MB num carro grande. Saída: mover a
   tabela de páginas para o fim da seção de sistema quando houver espaço.
4. Roupas aparecerem na loja, áudio de carro (`.awc`, `dlctext`), Menyoo, animações (`.ycd`),
   mapas (`.ymap`/`.ytyp`, colisão `.ybn`).

## Manutenção

Formato confirmado, pegadinha nova ou recurso entregue: atualizar a referência certa (uma ou
duas linhas). Offsets só entram depois de validados em arquivo real.
