# Menus e fluxos

## Tela de título

Conectar e cair direto na lista de personagens não parece jogo. Antes dela:

- planos lentos pela cidade (câmera andando pra frente ~7 m em 8 s, fade entre planos),
  marca no centro, "Pressione Enter", letterbox e vinheta;
- Enter, espaço ou clique continuam; a câmera desce do alto até o palco e o menu entra;
- planos capturados no jogo por um painel admin (câmera livre, scroll = zoom, Enter salva)
  e um "Testar" que toca a sequência sem reconectar;
- só na conexão. Voltar pros personagens (logout) abre direto neles.

## Landing

- Marca no terço inferior esquerdo, menu textual vertical, sem caixas.
- "Continuar" com o nome do último personagem embaixo; "Personagens" abre a lista;
  "Configurações" só se houver algo a configurar.
- Conta vazia: só "Criar personagem", que abre a criação no primeiro slot livre;
  cancelar cai na seleção com esse slot focado.
- Não dá pra continuar (último deletado): o item some.

## Seleção

- Trilho de slots (ocupados e livres) com setas, a câmera vai pra posição de cada um.
- Entrar é segurar (E ou mouse) com anel de progresso, não clique simples.
- Slot livre: E abre a criação direto.

## Confirmação destrutiva

Nada de modal preto aparecendo do nada:

- a barra de ações vira a confirmação: vinheta vermelha nas bordas, anel vermelho
  "Segure pra deletar · NOME · não tem volta";
- segurar mouse ou Delete enche o anel (~1,3 s); Esc/Backspace cancela;
- controle: A dispara um clique sem mouse (`e.detail === 0`) que enche o anel sozinho,
  B cancela;
- confirmado, o anel gira ("Apagando...") até a lista voltar; a cena tira o ped com fade.
- trocar a seleção cancela a confirmação; durante o "apagando" a seleção trava.

## Criação em capítulos

- Um capítulo por tela (gênero, nome, origem, nascimento, chegada), cada um com plano de
  câmera próprio e o ped reagindo (gesto ao confirmar, olhar pra câmera).
- O último capítulo ("como você chegou") vira uma cena de chegada depois do editor.
- Final: pose, a câmera vai até o plano do editor de aparência, cartão com o nome, e o
  editor abre ali, sem fade nem teleporte.

## Controle

Toda tela navegável por controle: foco visível (anel na cor de destaque), dicas de botão
no topo (✛ navegar, A selecionar, B voltar) e B sempre volta um nível.

## Textos

Rótulo curto, verbo ou destino ("Continuar", "Personagens", "Criar personagem"). Evite
pares ambíguos como "Jogar" e "Continuar" na mesma tela.

## Prompt de interação no mundo

- Pode apertar, aparece. Prompt não some por tempo com o alvo ainda na mira.
- Camadas: longe só marcador; perto e mirando, tecla + texto; olhou pra fora, volta a marcador.
- Parado muito tempo no alvo: recolher (só a tecla, menor e apagada), não sumir. Tecla ou mirar de novo traz de volta.
- Esconder por intenção: mirando arma, combate, sprint, veículo acima de X km/h, NUI em foco. Prompt, marcadores e ponto somem juntos, com fade e folga (~400 ms) pra não piscar.
- Referência: `mri_Qinteract` (`client/render.lua`: `dormant`, `inAction`).

## Pausa própria e mapa do GTA

- ESC e P/Start são 200 e 199: desligar os dois todo frame (grupos 0 e 1) e abrir a sua tela.
- Mapa direto: `ActivateFrontendMenu('FE_MENU_VERSION_MP_PAUSE')`, esperar `IsPauseMenuActive`, `PauseMenuceptionGoDeeper(0)` + `PauseMenuceptionTheKick()`.
- Isso fica um nível abaixo da barra de abas: o ESC volta pro pause do GTA. Vigiar e fechar com `SetFrontendActive(false)` no cancelar (`IsControlJustPressed(2, 202)`, chega ~200 ms antes da barra aparecer) ou quando `IsNavigatingMenuContent()` cair pra 0.
- `IsNavigatingMenuContent()` devolve 0/1, e 0 é verdadeiro em Lua: comparar `== 1`. Native tipado `Any` costuma voltar número.
- Referência: `mri_Qpausemenu` (`client/frontend.lua`).
