# Verificação

O navegador mostra a NUI; câmera, peds e som do jogo só o jogo mostra. Diga ao usuário o
que foi verificado onde.

## Prints e medições no Chrome headless

`scripts/nui-probe.mjs` abre a NUI do vite dev num Chrome headless com
`window.invokeNative` injetado (o mock de dev passa a responder), manda mensagens como o
Lua mandaria e tira prints ou mede algo por quadro. O Chrome vem do `scripts/cdp.mjs` (Chrome headless
por CDP, perfil temporário, sem dependências).

```bash
node scripts/nui-probe.mjs http://localhost:5173/ ./shots steps.json
```

`steps.json` é uma lista de passos:

```json
[
  { "post": { "action": "open", "characters": [], "amount": 4 }, "wait": 1500 },
  { "click": "Criar personagem", "wait": 300, "shot": "enter-300" },
  { "wait": 600, "shot": "enter-900" },
  { "measure": ".cine-scrim", "click": "Personagens", "ms": 450 },
  { "eval": "document.querySelectorAll('iframe').length", "wait": 0 }
]
```

- `post`: `window.postMessage` (o que o Lua faria com `SendNUIMessage`).
- `click`: botão pelo texto; `key`: `keydown` na janela.
- `shot`: print com esse nome; `eval`: imprime o valor de uma expressão.
- `measure` + `ms`: opacidade efetiva (produto das opacidades dos ancestrais) de cada
  elemento do seletor em cada quadro, a partir do clique. Pra piscada, o esperado é 1.00
  do começo ao fim.

Dicas:

- Fundo do `#root` escuro (gradiente imitando céu e chão) pra ver scrims e textos
  claros; o body do dev é claro.
- Pra comparar antes e depois, `git stash` só dos arquivos da NUI, meça, `git stash pop`.
- Dev server 504 no console = ainda otimizando dependências: rode de novo.

## Trilha

Com a NUI aberta no headless, os iframes do YouTube mostram qual faixa está tocando:
`[...document.querySelectorAll('iframe')].map(f => f.src.split('embed/')[1]?.split('?')[0])`.
Ande pelas fases mandando as mensagens (open, abrir criação, close com keepMusic,
arrivalStart, musicEnd) e confira: dois ids durante o crossfade, um depois, nenhum no fim.

## Lua

- Rode um parser (ex.: `luaparse`, trocando os hashes com crase por `0`) em todo `.lua`
  editado. Teste o parser antes com um arquivo propositalmente quebrado.
- No servidor, confira o console depois do `ensure`.

## Bug que só aparece no jogo

Não chute. Instrumente com log legível e prefixo fácil de filtrar (`[SHOWROOM] [DIAG]`),
no momento certo (ao montar, no fim do voo), com o estado que decide a causa:
`IsPedActiveInScenario`, clip tocando, `GetScriptTaskStatus`, congelado, pedidos de
stream pendentes, fps. Peça ao usuário pra reproduzir e leia o log do cliente
(`FiveM.app\logs` na pasta do FiveM). Corrija pela causa e remova os logs temporários.
