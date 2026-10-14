# mri-game-ux

Skill do Claude Code pra deixar telas e cenas de resources FiveM com cara de jogo AAA:
menus que dizem pra onde levam, transições de câmera e interface sem corte seco, desfoque
e câmera na mão, trilha em fases com crossfade, barras de cinema e confirmação destrutiva
sem modal.

Os padrões saíram do `mri_Qmultichar` (abertura, showroom, criação de personagem e
chegada na cidade), que é o exemplo de referência.

## Instalar

Ver o `README.md` da raiz do repo.

## Usar

Numa sessão aberta na base ou no repo do resource:

```
/mri-game-ux mri_Qspawn
```

ou em texto: "a entrada do spawn tá muito repentina, deixa mais cinematográfico".

## Conteúdo

- `SKILL.md`: fluxo (levantamento, proposta, aplicar, verificar, documentar), princípios
  e regras.
- `references/`: transições, câmera e cena, som, menus, armadilhas de NUI e verificação.
  O agente lê só a do assunto.
- `scripts/nui-probe.mjs`: roda passos numa NUI em modo browser via Chrome headless
  (mensagens do Lua, cliques, prints e opacidade por quadro).
