# Armadilhas de NUI

## Piscada na troca de tela

Sintoma: a parte de baixo (ou a tela toda) clareia e escurece de novo ao trocar de tela.

Causa típica: o escurecido (scrim) mora dentro de cada tela. A tela velha desmonta na
hora, a nova entra com fade a partir de `opacity: 0` levando o scrim junto.

Correção: um scrim só, fora das telas, montado enquanto qualquer uma das telas que o usa
está ativa. Posicione antes das views no DOM com `z-index: 0` pra ficar atrás delas.
Confirme medindo a opacidade efetiva do scrim quadro a quadro durante a troca
(`verification.md`): deve ficar em 1.00 o tempo todo.

Se a piscada for preta, não é a NUI: é um corte de câmera com fade no Lua.

## Música que para ou reinicia

Player desmontado por `if (!isOpen) return ...` ou por trocar a árvore. Ver `sound.md`:
o player fica na mesma posição da árvore em todos os ramos.

Objeto de config novo a cada refresh também reinicia o player se o efeito depender da
identidade do objeto. Compare por valor (JSON) antes de trocar o estado, ou dependa só
dos campos que importam (url resolvida, loop).

## Animação sobrescrevendo transform

Keyframe com `transform` apaga o `translate(-50%)` que centraliza o elemento. Centralize
de outro jeito (`left: 0; right: 0; margin: auto; width: max-content`) ou anime num
wrapper.

`transform`/`filter` numa raiz `fixed` cria bloco de contenção pros filhos `fixed`. Com a
raiz `inset: 0` não muda nada; fora disso, confira.

## Loadscreen

- Fundo de tela cheia não usa `bg-background` do ui-kit: ele multiplica pela opacidade do
  `/uiconfig` (glass 0.8) e a tela do GTA vaza por baixo. Use `bg-[hsl(var(--background))]`
  e pinte `html`/`body` da página.
- Spinner de "carregando" no canto inferior direito é do GTA, não da NUI. Some com
  `SetConvarReplicated('sv_showBusySpinnerOnLoadingScreen', 'false')` no server do resource
  (testado no jogo no mri_Qloadscreen), sem mexer no `server.cfg`.
- Nunca `invokeNative('quit')` pra fechar: isso fecha o FiveM. Quem fecha é
  `ShutdownLoadingScreenNui` no client.

## CEF 103 (Chromium do FiveM)

- Popover com floating-ui cai no canto: o CEF 103 não tem `containerType` moderno.
- Sem `:has()` confiável, sem `@container` novo. Teste no jogo o que for CSS recente.
- Log da NUI fica em `FiveM.app\logs` (cliente), na pasta de instalação do FiveM.

## fetchNui no navegador

Fora do jogo, `fetchNui` costuma responder `{ success: true }` fixo quando
`window.invokeNative` não existe, e o mock de dev não roda. Pra testar com o mock,
injete `window.invokeNative = function () {}` antes da página carregar
(`Page.addScriptToEvaluateOnNewDocument`).

## Foco e teclado

- `SetNuiFocus(true, true)` só enquanto há interface interativa. Durante cutscene e
  editor de outro resource, solte.
- Listener de teclado por tela, desligado quando outra camada (confirmação, criação,
  configurações) está por cima.

## Tela sobre o mundo: legibilidade

- Escurecimento (vinheta, degradê atrás de texto) em preto fixo (`rgba(0,0,0,x)`), nunca
  `bg-background/x` do ui-kit: o preset multiplica o alpha pelo `--ui-opacity` do
  `/uiconfig`, e no tema glass o degradê some sobre cena clara.
- Texto sobre superfície invertida (card branco de foco): `text-black`, não
  `text-background` (sai apagado pelo mesmo motivo).
- Conferir no navegador sobre recorte de print real do jogo (dia e noite), com
  `data-theme="glass"` e `--ui-opacity` baixo. Fundo pintado engana.
- Lista embaixo de um carro/ped em 3D não repete a foto dele: card de texto (marca, nome,
  placa, status). Foto faltando vira quadrado vazio.
