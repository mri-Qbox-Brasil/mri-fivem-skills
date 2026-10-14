# Som

## Trilha em fases

Divida o fluxo em fases e dê uma faixa a cada uma. No multichar:

| Fase | Quando começa | Quando acaba |
|---|---|---|
| menu | NUI abre (título, landing, seleção) | criação abre, ou jogador entra no jogo |
| criação | overlay dos capítulos monta | NUI fecha indo pro editor |
| editor | `close` com `keepMusic` | cena de chegada começa |
| chegada | `arrivalStart` | `arrivalEnd` / `musicEnd` (fade de saída) |

- Fase sem faixa configurada segue a da fase anterior (resolva andando a ordem das fases
  e pegando a última faixa definida até a atual).
- Cancelar a criação volta pra fase do menu.
- Entrar no jogo sem criação: fade de saída (2 a 3 s), não corte.
- O Lua avisa o fim do fluxo mesmo quando a cena não toca (chegada sem destino): mande
  `musicEnd` depois do `Arrival.play`, em qualquer caminho.

## Crossfade com dois decks

- Cada faixa é um deck (YouTube IFrame API ou `Audio` pra arquivo em `sounds/`) com
  `setVolume`, `play`, `pause`, `destroy` e um `gain` de 0 a 1.
- Volume efetivo = volume escolhido x nível da fase (abaixar pra efeitos) x gain.
- Troca: cria o deck novo com gain 0, dá play, e anima os gains (novo -> 1, antigos -> 0)
  por ~2,2 s com ease-in-out. Deck que chega a 0 é destruído.
- Sem faixa: um marcador vazio vira o "atual" e todos descem a 0.
- O CEF só deixa YouTube tocar sozinho mudo: `mute()`, `playVideo()`, e `unMute()` +
  `setVolume` ~700 ms depois.
- Jogador pausou: troca de fase não volta a tocar sozinha.
- Referência: `web/src/components/MusicPlayer.tsx` do multichar.

## A música atravessa a NUI fechada

A página da NUI continua carregada com o foco solto, e o áudio segue tocando. O que mata a
música é o React desmontar o player. Mantenha o player na mesma posição da árvore em todos
os ramos do App (fragment com o player de primeiro filho, com `key` fixa), aberto ou
fechado, e só esconda o ticker.

## Níveis e efeitos

- Abaixe a música (~0.35) durante os capítulos pra efeitos e voz aparecerem, suba no
  momento final (swell) e volte.
- Vibração do controle em confirmar e errar (`SetPadShake`), só se não for teclado.

## Sons de interface

Toda tela de jogo tem som de interface: sem ele, a navegação parece site. Use os sons
nativos do GTA (`PlaySoundFrontend(-1, nome, soundset, true)`), nunca arquivo nem Web
Audio sintetizado (soa "jogo barato de navegador").

- A NUI manda só o momento (`fetch` pra um callback `uiSound` com `{ kind }`); o Lua
  resolve o nome num `data/sounds.json` do resource (`{ "navigate": { "name", "set" } }`,
  `enabled: false` desliga). O json é a lista permitida: a NUI não toca som arbitrário.
- Momentos e padrão (`HUD_FRONTEND_DEFAULT_SOUNDSET`, existe sem carregar banco):

| Momento | Som |
|---|---|
| abrir a tela | `CHARACTER_SELECT` |
| fechar, voltar uma camada (Esc) | `BACK` |
| trocar item (←/→, scroll de rotação) | `NAV_LEFT_RIGHT` |
| trocar aba (Q/E) | `NAV_UP_DOWN` |
| abrir painel, busca, gaveta | `SELECT` |
| confirmar ação | `SELECT` |
| deu certo | `YES` |
| erro, ação bloqueada (ghost em local ruim) | `ERROR` |

- Som só quando muda algo (trocar pro mesmo item não toca) e no mesmo frame da ação.
- Antes de escolher outro som, procure no dump (`soundNames.json` do
  [DurtyFree/gta-v-data-dumps](https://github.com/DurtyFree/gta-v-data-dumps)); soundset de DLC pode precisar de banco carregado.
- Referência: `data/sounds.json`, `utils.uiSound` e `web/src/lib/uiSound.ts` do mri_Qgarage.

## Cutscenes

- Cutscene nativa do GTA pode trazer música própria (`TriggerMusicEvent`). Decida entre
  ela e a faixa da fase: tocar as duas embola.
- Faixa livre com crédito é o padrão seguro pra vir configurada. Confira se o vídeo
  permite embed antes de usar:
  `https://www.youtube.com/oembed?url=<link>&format=json` responde 200 quando permite.
- Ticker mostra faixa e artista limpos: tire "(Official Audio)", "// Copyright Safe" e,
  quando o lado do artista é descrição ("2 Hour Synthwave MIX", "Royalty Free ..."), use
  o nome do canal.
