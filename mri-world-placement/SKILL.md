---
name: mri-world-placement
description: Padrão de posicionamento no mundo para painéis de criação de resources FiveM - colocar NPC, objeto, ponto ou zona mirando com prévia (fantasma), marcar rota ou caminho parada a parada com linha no chão, barra de teclas na NUI no lugar do textUI, e NPC andando na rota sem travar. Traz o módulo Lua pronto (WorldPlacer.point e WorldPlacer.path), a barra React (PlaceRail) e as regras que evitam marcador piscando, tecla perdida e campo de coordenada. Use quando pedirem "posicionar no mundo", "marcar rota", "colocar o NPC/objeto/zona pelo jogo", "criador in-game", "o marcador tá piscando", "não quero digitar coordenada", ou ao criar qualquer painel admin que grava posição, heading, zona ou caminho.
---

# Posicionamento no mundo

Painel de criação **configura, não programa**. Posição, direção, tamanho e caminho são
marcados no mundo, vendo a prévia; nunca campo de número, coordenada ou nome digitado.

## Ferramentas

| Ferramenta | Para | Módulo |
| --- | --- | --- |
| Ponto com fantasma | NPC, objeto, ponto de interação: cópia translúcida segue a mira | `WorldPlacer.point` |
| Caminho | rota de NPC, trajeto, cerca: paradas com linha no chão | `WorldPlacer.path` |
| Zona no jogador | elevador, área: caixa desenhada em volta de quem anda | referência `mri_Qelevators` (`client/placement.lua`) |

### Teclas (iguais em todo resource)

| Tecla | Ponto | Caminho | Zona |
| --- | --- | --- | --- |
| Mira / andar | move o fantasma | prévia da próxima parada | a caixa vai junto |
| `E` | confirma | marca parada | marca |
| `←` `→`, roda | gira | | roda: tamanho; `Shift` + roda: altura |
| `Backspace` | cancela | desfaz a última | volta um passo |
| `Enter` | | conclui (sem parada = cancela) | conclui |
| `Esc` | cancela | cancela | cancela |

O `mri_Qelevators` ainda conclui a zona no `Backspace` (anterior a este padrão).
Cancelar sempre devolve o que havia antes. Som: `SELECT` ao marcar, `BACK` ao desfazer ou
cancelar (`HUD_FRONTEND_DEFAULT_SOUNDSET`).

## Montar num resource

1. `templates/placement.lua` em `client/` (renomear o global). Antes dos arquivos que usam
   no `fxmanifest.lua`; arquivo novo no manifest pede `refresh` antes do `ensure`.
2. `templates/panel.lua`: callbacks `place` e `recordRoute` com o `inWorld` (esconde o painel,
   roda a ferramenta, volta com o resultado; dentro do mri_Qadmin fecha e reabre a aba).
3. NUI: `templates/PlaceRail.tsx` e as chaves de `templates/rail.locales.json`. Store com
   `hud` alimentado pela mensagem `placeHud` (`false` limpa). A barra aparece com o painel
   escondido, na ui_page do próprio resource; dentro do iframe do Qadmin não renderiza
   (o iframe está escondido).
4. No painel, o resultado vira **resumo**, não número: "3 paradas · 29 m · ida e volta",
   "Posição marcada". Botão "Marcar de novo" refaz do zero.

## Regras de frame (sem piscar, sem perder tecla)

- `DrawMarker`, `DrawLine` e `DisableControlAction` valem por um frame: chamar todo frame,
  num loop que só tem `Wait(0)`.
- Nada que espera dentro desse loop: `lib.raycast.fromCamera` dá `Wait(0)` por dentro, e no
  mesmo loop o desenho sai em frame sim, frame não (pisca) e o `JustPressed` se perde. A mira
  roda numa thread própria (`trackAim`) e o loop só lê `aim.coords`. Vale para
  `lib.requestModel`, `lib.callback.await` e qualquer `Wait(n)`.
- Tecla bloqueada (Esc 200, Enter 191, roda 14/15) só responde por
  `IsDisabledControlJustPressed`.
- Fantasma: alpha 170, sem colisão, congelado, `SetBlockingOfNonTemporaryEvents`. Só mover
  quando a mira mudou. Modelo aceita hash numérico (`tonumber(model) or joaat(model)`).
- Raycast `1 | 16` (mundo e objetos), ignorando o próprio ped.
- Sem `lib.showTextUI`, menu do ox_lib ou `DrawText` de instrução: a barra é da NUI.

## O que o sistema decide sozinho

- Tempo vira escolha pronta ("passa direto", "para um pouco", "fica um tempo"), nunca `+`/`-`.
- O que dá pra deduzir não vira opção: rota que termina a menos de 8 m do início dá a volta,
  senão vai e volta.
- Ligar uma coisa a outra (qual NPC liberar, qual andar) é escolher numa lista com nome.

## NPC andando na rota

Referência: `mri_Qnpc` (`client/route.lua`).

- Relógio comum (`GetCloudTimeAsInt()`): cada cliente calcula o mesmo trecho, todos veem o NPC
  no mesmo lugar. Tempo do trecho = distância x 1.15 / velocidade (andando 1.3 m/s, correndo
  3.2 m/s).
- `TaskFollowNavMeshToCoord` até a parada. Parada sem espera passa a próxima antes de chegar
  (2 m andando, 3.5 m correndo): esperar chegar faz o ped frear em todo ponto.
- Não chamar `ClearPedTasksImmediately` entre trechos: zera a passada e ele estaca. Limpar só
  depois de uma animação de parada.
- Parado 3 s sem sair do lugar (sem navmesh: interior, chão de prop): `TaskGoStraightToCoord`.
  Só teleporta para a parada se o prazo do trecho estourar.
- Na parada com espera: `TaskAchieveHeading` para a direção salva, depois a animação.
- Conversando com o jogador: `ClearPedTasks`, espera a conversa acabar e retoma o trecho.
- Ponto de spawn no centro da rota com raio = distância de spawn + alcance da rota.

## Verificar

- Navegador: mandar `placeHud` pelo mock de dev e conferir a barra (pt-br e en, tela estreita).
- Jogo (só ele mostra): marcadores firmes enquanto a câmera gira, E pega na primeira vez,
  Esc não abre o pause, cancelar e concluir sem parada mantêm o valor anterior, painel volta
  no mesmo NPC.
