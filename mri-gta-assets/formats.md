# Formatos

Tudo little-endian. Valores validados lendo arquivos reais de mods (BMW M2, Elegy RH7, Sultan,
Rossati, peds e roupas).

## RPF7 (pacote `.rpf`)

- Cabeçalho de 16 bytes: magic `0x52504637`, número de entradas, tamanho da tabela de nomes,
  criptografia. Só abre com criptografia `0` ou `OPEN` (`0x4E45504F`); AES/NG é recusado (os
  `.rpf` do jogo base são NG, os de mod costumam ser OPEN).
- Entradas de 16 bytes logo após o cabeçalho; nomes depois delas.
  - Diretório: segundo u32 == `0x7FFFFF00`; terceiro = índice da primeira filha, quarto =
    quantidade.
  - Arquivo: os dois primeiros u32 formam um u64. Nome em 16 bits, tamanho em 24 bits, offset
    em blocos de 512 bytes.
  - **Resource** (yft, ytd...): bit 31 do segundo u32 ligado; offset com máscara `0x7FFFFF`.
    Os dois últimos u32 são as flags de sistema e de gráficos. Tamanho `0xFFFFFF` = grande: o
    real está espalhado no cabeçalho guardado, bytes `[7] | [14]<<8 | [5]<<16 | [2]<<24`.
  - Binário: deflate cru quando o tamanho guardado difere do descomprimido.
- Para extrair um resource, remontar o cabeçalho RSC7: `version = (gfx>>28) | ((sys>>28)<<4)`,
  depois as flags de sistema e de gráficos, depois os dados guardados a partir do byte 16
  (sempre remontar: nos grandes os 16 primeiros bytes guardados estão corrompidos).
- `.rpf` dentro de `.rpf` é aberto recursivamente (limite de profundidade 4).

## RSC7 (todo arquivo compilado: ytd, yft, ydr, ydd, ycd, ybn, ymap, ytyp...)

- Cabeçalho: `RSC7`, versão (u32), flags de sistema (u32), flags de gráficos (u32). O resto é
  deflate cru da seção de sistema seguida da seção de gráficos.
- Versões: ytd `13`, ydr `165`, yft `162`, ydd `165`. Conferir a versão antes de interpretar.
- Ponteiros: `0x5XXXXXXX` = offset na seção de sistema, `0x6XXXXXXX` = offset na de gráficos.
- **Tamanho das seções pelas flags** (base `0x200 << (flags & 0xF)`):
  ```
  páginas = bit27 + bit26*2 + bit25*4 + bit24*8 + (bits17..23)*16 + (bits11..16)*32
          + (bits7..10)*64 + (bits5..6)*128 + bit4*256      (em unidades da base)
  ```
  Equivalente em páginas reais (base `0x2000 << shift`): até 127 páginas de 1x, 63 de 2x, 15 de
  4x, 3 de 8x e 1 de 16x (bits 17, 11, 7, 5, 4), mais 4 páginas de cauda de 1/2, 1/4, 1/8 e
  1/16 (bits 24 a 27). Os 4 bits de cima de cada flag são parte da versão: preservar.
- Memória que o jogo reserva = tamanho das páginas, não o tamanho dos dados. FiveM avisa acima
  de 16 MiB por seção (o `optimize.rs` marca como crítico).
- **Tabela de páginas** (`ResourcePagesInfo`, ponteiro em `0x08` da raiz): u32, u32, u8 páginas
  de sistema, u8 páginas de gráficos, u16, u32, e depois 8 bytes por página (zerados no arquivo,
  o jogo preenche). Nos arquivos reais ela é colada no bloco seguinte (padding `0xCD`): **não
  dá para aumentar a quantidade de páginas** sem mover a tabela.
- **Empacotar páginas** (regra dos editores, reimplementada em `ytd::pack`): blocos do maior
  para o menor; a página maior é a menor potência de 2 da base que cabe o maior bloco; cada
  bloco vai na primeira página com espaço (alinhamento 16), senão abre página nova do menor
  tamanho que cabe; se estourar os limites de contagem, dobra a base e tenta de novo. Objetos
  nunca atravessam páginas.

## Dicionário de texturas (`.ytd`, versão 13)

Raiz (sistema, offset 0):
| Offset | Campo |
| --- | --- |
| `0x08` | ponteiro da tabela de páginas |
| `0x20` / `0x28` | lista de hashes dos nomes (ponteiro u64, contagem u16) |
| `0x30` / `0x38` | lista de ponteiros das texturas (ponteiro u64, contagem u16) |

Textura (`0x90` bytes, na seção de sistema):
| Offset | Campo |
| --- | --- |
| `0x28` | ponteiro do nome (string terminada em 0) |
| `0x50` / `0x52` / `0x54` | largura, altura, profundidade (u16) |
| `0x56` | stride (u16) |
| `0x58` | formato (u32) |
| `0x5D` | níveis de mip (u8) |
| `0x70` | ponteiro dos pixels (seção de gráficos) |

- Formatos: `21` A8R8G8B8 (memória B,G,R,A), `22` X8R8G8B8, `32` A8B8G8R8 (R,G,B,A), `28` A8,
  `50` L8, FourCC `DXT1`, `DXT3`, `DXT5`, `ATI1`, `ATI2`, `BC7 ` (com espaço).
- **Stride como os arquivos guardam**: bytes por linha de pixel, não por linha de bloco. DXT1 =
  largura/2, DXT3/DXT5 = largura, 32 bits = largura*4.
- Tamanho dos dados: `stride * altura`, somando um quarto a menos por mip. Bate com o real
  enquanto o mip tem pelo menos 4x4 e múltiplo de 4; por isso o otimizador para os mips em 4x4.
- Num ytd, a seção de gráficos só tem pixels: os ponteiros `0x70` são os únicos para ela.
- Os outros campos da textura (`0x00`-`0x4F`, uso, flags) ficam como estão.

## Outros (ainda não implementados)

- `.yft` (fragment, carro): drawable com `ShaderGroup` que pode trazer um dicionário de
  texturas embutido; a seção de gráficos tem também vertex e index buffers.
- `.ydr` (drawable, prop), `.ydd` (dicionário de drawables, roupa), `.ycd` (clipes de
  animação), `.ybn` (colisão), `.ymap`/`.ytyp` (mapa; meta em formato RSC7 binário).
- `+hi.ytd` e `_hi.yft`: versões de alta resolução que o jogo carrega de perto.
