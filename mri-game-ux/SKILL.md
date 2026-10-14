---
name: mri-game-ux
description: Deixa telas e cenas de um resource FiveM (multichar, criação de personagem, spawn, appearance, loading, cutscenes) com cara de jogo AAA - menus que dizem pra onde levam, transições de câmera e interface sem corte seco, desfoque e câmera na mão, trilha em fases com crossfade, barras de cinema, confirmação destrutiva sem modal. Use quando pedirem "cara de triple A", "mais cinematográfico", "tá repentino", "tá piscando", "a música para", ou quando for desenhar ou revisar um fluxo de tela in-game com câmera scriptada e NUI.
---

# UX de jogo AAA em resources FiveM

Objetivo: o jogador não percebe a costura entre NUI, câmera scriptada e mundo. Tela entra
e sai de propósito, câmera se move como filmagem, som acompanha a fase, nada aparece ou
some seco.

Referência: `mri_Qmultichar` da MRI (abertura, showroom, criação, chegada).

## Fluxo

1. **Levantamento** (antes de propor):
   - mapear o fluxo real tela a tela, evento a evento (NUI message, callback, troca de
     câmera, fade, `SetNuiFocus`), seguindo o código;
   - em cada passagem, anotar o que aparece: corte, fade, glide, pop;
   - achar o que desmonta na troca (componente condicional, `if (!isOpen) return`): causa
     de piscada e de música que para.
2. **Proposta curta**: problema visto, causa no código, correção com os números (ms,
   metros). Recomendar uma opção.
3. **Aplicar** pela reference do assunto. Tempos e distâncias vão pro painel do resource
   (`data/*.json`), não soltos no código.
4. **Verificar** (`references/verification.md`): o que o navegador mostra e o que só o jogo
   mostra. Bug só no jogo: log legível antes de corrigir.
5. **Documentar** no README do resource o comportamento novo e onde se ajusta.

## Princípios

- **Item de menu diz pra onde leva.** "Continuar" com o nome do personagem embaixo,
  "Personagens" pra lista. Conta vazia: só o possível ("Criar personagem"). Item inútil
  some, não fica desabilitado.
- **Nada seco.** Ped entra e sai com alpha; tela sai com fade e desfoque; a próxima entra
  depois que a câmera começou a andar.
- **Deslizar perto, cortar longe.** Voo longo atravessa mundo sem stream. Acima de um
  limite (18 m no multichar) corta pelo preto; abaixo, glide.
- **Interface espera a cena.** Primeiro câmera, depois texto.
- **Destrutivo é segurar, não modal.** Confirmação na própria barra de ações (anel que
  enche segurando mouse ou tecla), Esc sai.
- **Som é trilha, não player.** Uma faixa por fase, crossfade na troca, atravessa telas
  fechadas (editor, cutscene) até o fim do fluxo.
- **Cena é cena.** Cutscene e chegada com barras de cinema, crédito com o nome, "pular"
  discreto.
- **Configurável.** Faixas, planos de câmera e tempos no painel, com padrão bom.

## References (ler só a do assunto)

| Arquivo | Quando |
|---|---|
| `references/transitions.md` | entrada e saída de telas, glide x corte, fade de ped, arco de câmera |
| `references/camera-scene.md` | câmera scriptada, desfoque, câmera na mão, stream de área, hora e clima, texto 3D |
| `references/sound.md` | trilha em fases, crossfade, música com a NUI fechada, efeitos, cutscenes |
| `references/menus.md` | título, landing, seleção, confirmação destrutiva, controle |
| `references/nui-pitfalls.md` | piscada na troca, player que reinicia, CEF 103, animação x transform |
| `references/verification.md` | prints e medições no Chrome headless, parser Lua, logs de diagnóstico |

## Regras

- Integrar pelo contrato público do outro resource (eventos, exports, statebags do
  upstream), sem depender de API nova dele.
- Sem fallback escondendo bug. Animação não toca: descobrir por quê.

## Manutenção (auto aprimoramento)

Ao fim de cada uso, seguir a "Manutenção" do `README.md` da raiz. Padrão novo aprovado vai
na reference do assunto.
