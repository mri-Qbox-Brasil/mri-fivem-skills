# Transições

A regra: nenhuma passagem é um corte seco, a não ser que seja um corte de cinema de
propósito (pelo preto, com tempo). Toda troca tem três camadas que precisam andar juntas:
interface (NUI), câmera e peds.

## Glide x corte

- Glide: interpolação temporizada da pose atual (posição e ponto de mira) até a nova,
  com ease-in-out. Guarde `glideStart`, `target`, `glideAt`, `glideDur` e calcule por
  frame no thread de render.
- Corte: `DoScreenFadeOut(out)`, espere `IsScreenFadedOut()`, faça o snap da câmera,
  `SetFocusPosAndVel` no destino, espere colisão (`RequestCollisionAtCoord` +
  `HasCollisionLoadedAroundEntity`, com teto), `DoScreenFadeIn(in)`.
- Escolha pela distância: acima de `cutDistance` (18 m é um bom padrão) corta, abaixo
  desliza. Câmera voando longe atravessa área sem stream e mostra o vazio.
- Tempos: troca rápida entre personagens vizinhos 0,75 s de glide; corte de navegação
  200/240 ms; corte dramático (entrar numa fase nova) 700/1100 ms. O mesmo corte com
  tempos curtos numa passagem importante parece bug.
- Se um corte já está rodando e chega outro pedido, só atualize o alvo pendente. O corte
  em andamento aplica o último.

## Arco (grua)

Pra entrar numa fase nova, a câmera sobe no meio do caminho em vez de ir reta:

```lua
cur.z = glideStart.z + (target.z - glideStart.z) * e + glideArc * math.sin(math.pi * e)
```

`e` é o progresso com easing. 1 a 1,5 m de arco em 2,4 a 2,8 s dá sensação de filmagem.
Referência: `beginGlide(target, duration, arc)` no `client/showroom.lua` do multichar.

## Peds entrando e saindo

- Nunca `SetEntityVisible(false)` direto na frente da câmera. Faça fade de alpha
  (`SetEntityAlpha` por frame, 600 a 700 ms), depois esconda e `ResetEntityAlpha`.
- Ped novo entra com alpha de 0 a 255 (300 ms numa troca, 900 ms na primeira aparição).
- Troca de modelo ao vivo (ex.: gênero): crossfade, o novo sobe enquanto o velho desce, e
  o velho é deletado no fim.
- Espere o palco esvaziar antes de pôr o ped novo no mesmo ponto.
- Cancelamento no meio de um fade: o thread do fade precisa checar se o estado ainda é
  o mesmo e parar. Senão ele briga com o fade de volta.
- Personagem removido (deletar): some com fade, os seguintes andam uma posição (fade
  curto, reposiciona, fade de volta). Sem remontar a cena.

## Interface acompanhando a câmera

Sequência que funciona pra entrar numa fase (ex.: seleção para criação):

1. t=0: a tela atual sai (`opacity 1 -> 0`, `translateY(8px) scale(.985)`, `blur(4px)`,
   650 ms), sem pointer events. A câmera já começa o arco e os peds o fade.
2. A tela antiga fica montada durante a saída (estado `leaving` com timeout igual à
   animação) e só então desmonta.
3. A tela nova monta em t=0 (pra disparar os callbacks do Lua), mas entra com atraso:
   `animation: in .95s ease .7s both` com `opacity`, `translateY(12px)` e `blur(6px)`.

Saindo da landing (em vez da seleção), faça a landing sair igual e troque a rota só depois
do timeout, senão a seleção pisca no meio.

Tela sobre o mundo (garagem, loja, vitrine):

- Vinheta e escurecimento entram junto com o glide da câmera (`opacity 0 -> 1` na duração
  do glide), nunca prontos no frame em que a NUI monta: escurecer de uma vez parece bug.
- As peças entram em cascata depois do atraso de entrada (topo, informações, contador,
  lista, comandos, ~90 ms entre elas); itens da lista sobem do selecionado pra fora.
- Medidores e barras começam em 0 e enchem na tela (valor aplicado depois do atraso).
- A cascata é só da primeira entrada: trocar de item anima rápido (~260 ms), sem atraso,
  senão o painel some a cada troca.

## Chegada e fim de fluxo

- Última cena: nome como crédito, câmera desliza pra câmera do jogo
  (`RenderScriptCams(false, true, ms)`), controle volta.
- Tela escura entre fases longas (editor fechou, cena de chegada carregando) é aceitável
  se for fade, nunca frame de mundo cru.
