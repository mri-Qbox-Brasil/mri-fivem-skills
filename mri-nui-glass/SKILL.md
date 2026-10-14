---
name: mri-nui-glass
description: Liquid glass de verdade na NUI do FiveM - desfoque do jogo atrás de painel, pílula, orb ou card, e borda em bisel que refrata o fundo, o que o backdrop-filter não faz no CEF (ali ele só vê a própria página, o jogo fica de fora). Usa o startGameGlass/startSuiteGlass do @mriqbox/ui-kit (ou o pacote público mri-fivem-liquid-glass), que pega o frame do GTA como textura WebGL pelo hook da cfx (o mesmo do screencapture) e desenha num canvas atrás da UI, no formato de cada elemento com data-glass. Use quando pedirem "glass", "liquid glass", "blur do jogo atrás da UI", "backdrop blur não funciona na NUI", "vidro fosco", "fundo desfocado do game", ou ao portar UI com backdrop-filter pro jogo. Guarda também prints reais do GTA (letreiro MRI) pra fundo de mockup, print de NUI fora do jogo e demo de projeto.
---

# Liquid glass na NUI

`backdrop-filter` no CEF do FiveM desfoca só o que a página pintou: o jogo é composto por
baixo depois, então o vidro vira uma camada lisa. A saída é pegar o frame do jogo dentro da
página e desenhar o vidro em WebGL.

O núcleo mora num lugar só: o pacote público **`mri-fivem-liquid-glass`** (npm; repo
[mur4i/mri-fivem-liquid-glass](https://github.com/mur4i/mri-fivem-liquid-glass); docs em inglês e
pt-BR, demo no GitHub Pages, exemplo de resource). Log no jogo: `[liquid-glass]`.

O `@mriqbox/ui-kit` (4.34.0+) depende dele e só reexporta o `startGameGlass`
(`src/lib/gameGlass.ts`); o que é da suíte fica no kit: `suiteGlass.ts` (tema liquid), story
`Lib/GameGlass`, `THEMING.md`.

- Correção ou melhoria do vidro vai no pacote. Lá, commit `feat:`/`fix:` na `main` gera
  versão e publica sozinho (trusted publisher). Antes do push: `npm run typecheck`,
  `npm run build`, `npm test` (teste visual no Chrome headless).
- O kit pega a versão nova pelo `^1.x` na próxima instalação; mudança que quebra API vira
  major no pacote e exige subir a dependência no kit.
- ui-kit: push na `main` publica versão.
- Nunca numa cópia dentro do resource.

## Como funciona

1. **Hook da cfx:** textura WebGL criada com 1 pixel azul e a sequência de `texParameterf`
   em `WRAP_T` (CLAMP, MIRRORED_REPEAT, REPEAT, CLAMP) vira o frame do jogo. Origem: `cfx-ui`
   da citizenfx; o `screencapture` usa igual (`packages/gameview/webgl.ts`). A ordem das
   chamadas é o que o hook reconhece.
2. **Duas imagens do jogo:** uma em 1/2 da tela, nítida (pra refração), e uma em 1/4,
   desfocada com gaussiano em passadas curtas e suavização temporal.
3. **Recorte por elemento:** canvas fixo atrás da UI; em cada `[data-glass]` desenha com o
   `border-radius` dele (SDF), a opacidade dos pais e o corte do pai com `overflow`.
4. **Liquid** (`data-glass="liquid"`): na faixa do bisel a superfície "inclina", puxando o
   fundo nítido de fora pra dentro (as linhas do fundo curvam), com separação de cor e brilho
   especular pela direção da luz. O miolo fica no blur, pra leitura.
5. **Frame quebrado:** miniatura 32x18 lida sem travar (PBO + fence). Preto ou escurecimento
   brusco: mantém o último frame bom. Preto por ~3 s: refaz o hook.
6. **Tom do fundo:** marca `data-glass-backdrop="bright|dark"` pro texto trocar de cor.

Decisões e detalhes da técnica: `references/technique.md`.

## WebGPU não

O CEF do FiveM é Chromium 103 (`libcef.dll` 103.0.5060.141); WebGPU só existe a partir do
113, e o hook do jogo é de textura GL. WebGL2 funciona no 103.

## Aplicar num resource

1. Resource com o kit: `@mriqbox/ui-kit` 4.32.0 ou mais novo (4.34.0+ já usa o pacote).
   Com bundler e sem kit: adaptar pela skill `mri-ui-kit`, ou só `npm i mri-fivem-liquid-glass`.
   HTML puro, sem bundler (ex.: `web/` do ox_target): copiar
   `dist/mri-liquid-glass.iife.min.js` do pacote pro resource (expõe
   `window.MriLiquidGlass.startGameGlass`), listar nos `files` do fxmanifest e anotar a versão.
   CDN do jsDelivr também serve, mas depende de internet no cliente.
2. Uma vez no boot da NUI:
   ```ts
   import { startGameGlass } from '@mriqbox/ui-kit'
   startGameGlass({ fallbackImage: import.meta.env.DEV ? '/dev-bg.jpg' : null })
   ```
   Opções: `scale` (0.25), `blur` (sigma em px, 14), `saturation` (1.15), `darken` (1),
   `temporal` (0.55; 1 desliga), `light` (`[-0.6, -0.8]`, luz de cima à esquerda), `zIndex`
   (0), `selector`. Retorna `{ refresh, stop }`.
3. CSS:
   - `html`, `body` e o root transparentes; root acima do canvas (`position: relative;
     z-index: 1`), senão o blur cobre a UI;
   - no elemento: **sem** `backdrop-filter`; fundo translúcido baixo (`.04` a `.10`) como
     tinta, borda de 1px clara, `inset 0 1px 0` de brilho, sombra embaixo;
   - texto: `[data-glass-backdrop="bright"] { color: <escuro> }`.
4. Escolha do efeito:
   - `data-glass`: painel grande com conteúdo (lista, formulário). Bisel distrai ali.
   - `data-glass="liquid"`: peça destacada e pequena (botão, pílula, orb, dock, HUD).
   - Ajuste fino: `data-glass-bezel` e `data-glass-refraction` (px),
     `data-glass-dispersion` e `data-glass-specular` (0..1). Qualquer um deles liga o bisel.
5. Tema da suíte: com `startSuiteGlass()` no lugar do `startGameGlass`, o tema `liquid` do
   `/uiconfig` (`data-theme='liquid'` no `<html>`) põe vidro em toda `.mri-surface` de
   topo, sem marcar nada; nos outros temas só vale o `data-glass` manual. Não usar
   `mri-surface` em tela sempre aberta (HUD): cada página com vidro redesenha a cada frame.
6. Resource da suíte não fixa vidro: superfície é `mri-surface border bg-background` (segue
   tema e opacidade do `/uiconfig`), sem `data-glass` nem tinta própria. Bisel (`data-glass="liquid"`)
   só quando `data-theme` é `liquid`, ligado por estado do tema. Foco por `ring-*` do Tailwind:
   o liquid troca o `box-shadow` mas soma o `--tw-ring-shadow`. Exemplo: `mri_Qpausemenu`
   (`web/src/lib/theme.ts`, `useBevel`).

## Regras e limites

- O canvas fica **embaixo de toda a UI**: o vidro mostra só o jogo. Vidro sobre outro painel
  opaco da NUI não desfoca o painel; vidro sobre vidro funciona.
- `scale` e `translate` funcionam; rotação não. Raio pelo `border-top-left-radius`. Corte só
  pelo primeiro pai com `overflow`: elemento de vidro dentro de lista que rola vaza pra fora
  do painel. Vidro só na superfície de topo; o `startSuiteGlass` (kit 4.33.1+) já ignora
  `.mri-surface` dentro de outra.
- Raio, corte e atributos ficam em cache; mudou por `style` inline: `refresh()`.
- Loop roda enquanto houver `[data-glass]` no DOM e redesenha o canvas a cada frame
  visível. Escondido não desenha; sem elemento, para. Fechou a tela: tirar do DOM.
- DUI (`?mode=dui`) e fora do jogo sem `fallbackImage`: não liga. Iframe do mri_Qadmin: não
  testado.

## Verificar

1. Navegador: playground do site (`npm run docs:dev` no clone do `mri-fivem-liquid-glass`,
   http://localhost:5173/mri-fivem-liquid-glass/playground, aceita print do GTA arrastado; no ar em
   mur4i.github.io/mri-fivem-liquid-glass/playground),
   story `Lib/GameGlass` do kit (`npx storybook dev -p 6016` no clone do
   `mri-ui-kit`) ou o dev do resource com `fallbackImage`, e o print:
   ```
   node scripts/shot.mjs "http://localhost:6016/iframe.html?id=lib-gameglass--showcase&viewMode=story" ./glass.png 10000
   ```
   Espera em tempo real (com `--virtual-time-budget` o rAF quase não roda). O Chrome vem do
   `scripts/cdp.mjs`. Primeira carga
   do Storybook otimiza dependências: se sair vazio, rode de novo. Conferir: blur só dentro,
   cantos, círculo, opacidade, linhas curvando no bisel, brilho fino.
2. Jogo (só ele mostra): frame chegando, primeiros segundos, loading e pause, câmera rápida
   (   cintilação), FPS e `resmon` com a tela aberta. Log do cliente em
   `FiveM.app\logs\CitizenFX_log_*.log` (pasta do FiveM), filtrar `[liquid-glass]` (kit até a
   4.33.x: `[gameGlass]`).
3. Dizer o que foi visto onde (navegador ou jogo) e o que ficou sem testar.

## Fundos de cena (mockup)

Prints reais do jogo num servidor MRI, sem faixas pretas nem marca do FiveM, em `assets/`. Servem
de `fallbackImage`, de fundo pra print e mockup de qualquer NUI fora do jogo, e de imagem de
demo de projeto:

| Arquivo | Cena | Bom pra |
| --- | --- | --- |
| `gta-sunset-player.webp` (1920x864) | personagem de costas ao entardecer, letreiro MRI no morro | fundo com contraste (céu claro, corpo escuro), mostra bem o blur; é o do demo do liquid glass |
| `gta-vinewood-hill.webp` (1920x862) | morro com o letreiro MRI QBOX, céu azul de dia | fundo claro e limpo, testar texto sobre cena clara |

Usar como `object-fit: cover` (proporção 2,2:1; em 16:9 corta as laterais). Num projeto, copiar
o arquivo pra dentro dele, não apontar pra pasta da skill.
