# Câmera e cena

## Quando a câmera anda

- Só em mudança de contexto: abrir um item, trocar de categoria, voltar. Nunca em foco, hover ou seta
  andando numa lista: girar a cada foco dá vertigem ("parece um ventilador").
- Movimento lento: seguimento exponencial por tempo com ~1 s pra assentar (fator 2.2/s), nunca por quadro.

## Thread de render

Uma câmera scriptada, um thread por frame que calcula a pose (glide, arco, balanço),
aplica `SetCamCoord`/`PointCamAtCoord` e desenha o que é por frame (luzes, texto 3D,
desfoque). Invalide o thread com um token quando a cena for remontada.

## Desfoque de fundo (DOF)

- Nativos: `SetCamUseShallowDofMode(cam, true)`, `SetCamNearDof`, `SetCamFarDof`,
  `SetCamDofStrength` e, por frame, `SetUseHiDof()` (sem ele o efeito não aparece).
- Foco dinâmico: distância da câmera ao ponto de mira. Nítido de `foco - near` a
  `foco + far` (showroom: near 0.8, far 1.3, força 0.85; close de criação: 0.35 / 0.9 / 1.0).
- Desligue durante voos longos (abertura descendo até o palco): borra a cidade inteira.
- Passagem pra outro resource que usa a própria câmera (editor de aparência): repita o
  plano e o DOF dele no fim da sua cena, com os mesmos nativos e valores, e a troca some.

## Câmera na mão

Balanço lento com senos de frequências diferentes nos três eixos, somado à pose só no
render (não no estado, senão o glide seguinte parte do ponto balançado):

- posição ~3 cm, mira ~1,8 cm, velocidade 1.0;
- desligue onde o plano precisa terminar cravado (último plano antes de passar a câmera
  pra outro resource).

## Carregar a área antes de mostrar

Textura borrada e prédio aparecendo é o que mais denuncia "não é jogo". Antes de cada
plano distante:

- `NewLoadSceneStartSphere(x, y, z, raio, 0)` (ou `NewLoadSceneStart` com direção),
  `SetFocusPosAndVel` no ponto, espere `IsNewLoadSceneLoaded()` com teto (5 s) e avise no
  F8 se estourar;
- `GetNumberOfStreamingRequests()` antes e depois ajuda a diagnosticar;
- no fim, `NewLoadSceneStop()` e `ClearFocus()`.

## Hora e clima fixos

A vitrine não pode aparecer de madrugada ou na chuva. Integre pelo contrato do
qb-weathersync (o Renewed-Weathersync atende):

- `TriggerEvent('qb-weathersync:client:DisableSync')` e aplique `ClearOverrideWeather`,
  `SetWeatherTypeNowPersist`, `NetworkOverrideClockTime`;
- ponha o clima também em `LocalPlayer.state.playerWeather` (o Renewed repete ele
  enquanto a sync está desligada);
- o Renewed zera o relógio ao desligar a sync: reaplique num
  `AddStateBagChangeHandler('syncWeather', ...)` com `SetTimeout(0)`;
- o compat qb do Renewed religa a sync no `QBCore:Client:OnPlayerLoaded`: reaplique
  depois dele se o fluxo ainda está na vitrine;
- no fim, `qb-weathersync:client:EnableSync`.

## Iluminação do palco

Holofote de cima (`DrawSpotLight` por frame) deixa o rosto escuro. Some uma luz de
preenchimento frontal fraca do lado da câmera (`DrawLightWithRange`).

## Texto 3D atrás do personagem

Nome num quad world-space (DUI) atrás do ped fica bonito, mas nome comprido sai do quadro.
Limite a largura a uma fração do que a câmera enxerga naquela distância:

```lua
local visible = 2 * dist * math.tan(math.rad(GetCamFov(cam)) / 2) * GetAspectRatio(false)
width = math.min(nt.width, visible * nt.fit) -- fit ~0.8
```

`GetCamFov` é vertical; multiplique pelo aspecto pra ter a largura.

## Ped de vitrine

- Aterre com `SetEntityCoords` (não o `NoOffset`) no chão achado por
  `GetGroundZFor_3dCoord`.
- Animação idle por posição (cenário ou dict/clip). Ped em pose padrão (braços retos,
  olhando pra cima) = animação não tocou: instrumente (`IsPedActiveInScenario`,
  `GetScriptTaskStatus`, clip atual) antes de mexer.
- Preset inicial de criação com rosto (head blend dos pais), cabelo, sobrancelha e
  cores. O mesmo preset no preview e no ped real, pra troca não aparecer.

## Conversa com NPC

Padrão do mri_Qnpc (`client/dialog.lua`, `web/src/components/Conversation.tsx`):

- A câmera segue a cabeça dos dois ao vivo (seguimento exponencial, fator 4/s), nunca mira fixa: o NPC vira o corpo pra você e a mira fixa corta o rosto.
- Planos: por cima do ombro do jogador na primeira fala e na resposta; close no NPC em cada fala nova (1 m, lente 42, rosto no terço com espaço pra onde ele olha), corte seco e aproximação lenta de 10 cm durante a fala.
- Nunca virar a câmera pro rosto do jogador na resposta: ele gesticula de costas, o NPC acena com a cabeça.
- Tela é legenda, não cartão: nome pequeno em destaque, fala branca com sombra, no máximo duas linhas; fala longa em partes (120 caracteres, tempo de leitura ou Enter, contador 2/6).
- Escolhas numa lista à direita, na altura da legenda, só depois da última parte; barra de destaque, setas/W/S, números, mouse, som `NAV_UP_DOWN`.
- Valor de config vindo de JSON: `40` vira inteiro e native de float lê errado; forçar `+ 0.0` no merge.
