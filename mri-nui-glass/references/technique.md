# Técnica

## O hook

A textura é criada assim: `texImage2D` 1x1 com `[0, 0, 255, 255]` e depois `texParameterf` em
`WRAP_T` com CLAMP, MIRRORED_REPEAT, REPEAT, CLAMP. A partir daí, amostrar a textura devolve o
frame do jogo (sem a NUI, senão haveria realimentação). Até o hook pegar, ela continua sendo o
pixel azul ou sai preta.

O `screencapture` da citizenfx (`packages/gameview/webgl.ts`) usa o mesmo hook com WebGL1,
`alpha: false`, `desynchronized: true` e `gl.finish()` por frame, e espera 3 frames antes de
ler.

## Como o pacote faz

| Parte | Escolha |
| --- | --- |
| Contexto | WebGL2 |
| Resolução do blur | 0.25 da tela, com redução de 4 amostras |
| Blur | 5 fetches lineares (9 taps), passadas calculadas pelo sigma |
| Suavização temporal | mix 0.55 com o anterior (`temporal`) |
| Frame preto | miniatura 32x18 por PBO + fence |
| Reenganchar hook | recria a textura depois de frames pretos seguidos e reconstrói se o fence não volta |
| Recorte | quad do tamanho do elemento + SDF |
| Seleção | `[data-glass]` |
| Tom do texto | da miniatura, a cada 200 ms |
| Extra | modo liquid (bisel, dispersão, brilho) |

## Decisões

- **Passo curto, mais passadas.** Com 5 fetches e passo largo o gaussiano vira pente e
  detalhe fino (grade, listra, poste) reaparece em padrão. Passo até ~1.5 texel e o número
  de passadas sai de `ceil((sigma / 2.4)^2)`, no máximo 8.
- **Reduzir com 4 amostras.** Copiar o frame direto pra 1/4 com bilinear pula pixels e a
  imagem cintila quando a câmera anda. Quatro fetches bilineares a ±1/4 de texel cobrem o
  bloco 4x4.
- **Leitura assíncrona.** `readPixels` direto no canvas espera a GPU terminar o frame do
  jogo. Com PBO + fence a leitura sai 1 ou 2 frames depois, sem travar. O blur só avança
  quando a miniatura do frame foi aprovada; enquanto isso o canvas mostra o último bom.
- **Flash escuro.** Frame com proporção de pixels escuros 4 pontos acima da média, ou média
  abaixo de 65% da média móvel, é pulado (até 45 seguidos). O primeiro frame aceito só
  inicializa as médias.
- **Canvas na resolução da tela.** O blur é de baixa resolução, mas a composição é na
  resolução cheia: a borda arredondada sai nítida, sem precisar de "feather" pra esconder
  serrilhado.
- **Redesenho só quando muda.** A composição compara uma chave com retângulos, opacidade e
  raio; no jogo o blur muda quase todo frame, então redesenha enquanto a tela está aberta.
  Sem elemento visível, só limpa uma vez.

## Liquid

Blur com brilho em CSS não refrata. O liquid do pacote:

- Imagem nítida em 1/2 da tela, em buffer duplo: o frame só vira visível quando a leitura
  da miniatura aprova (senão um frame preto apareceria no bisel).
- Bisel: `rim = 1 - clamp(-d / bezel)` (1 na borda, 0 no miolo). Deslocamento
  `normal * rim^2.2 * refraction` pra fora, então a borda mostra o fundo de fora "dobrado".
- Mistura nítido/blur por `smoothstep(0.15, 0.85, rim)`: borda nítida e refratada, miolo
  desfocado.
- Dispersão: R e B amostrados com o deslocamento 30% maior/menor que o G.
- Brilho: `rim^7` vezes a luz (lado iluminado inteiro, lado oposto 35%).
- Preset `liquid`: bisel 22% do lado menor (8 a 28 px), refração 0.8 do bisel, dispersão 0.5,
  brilho 0.45.

## Ideias não feitas

- Vidro por cima de outro painel da NUI: exige copiar o blur pra um canvas acima da UI e
  desfocaria só o jogo, não o painel. Só fazer se uma tela pedir.
- Força de blur por elemento: precisaria de uma cadeia de blur por força.
- Cantos com raios diferentes: SDF com 4 raios, se aparecer caso real.
