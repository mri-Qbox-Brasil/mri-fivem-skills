---
name: mri-txadmin
description: Dá ensure, restart, start ou stop em resource de um servidor FiveM local pela API do txAdmin (sem rcon) e mostra o que o fxserver.log registrou. Use quando pedirem "dá ensure no X", "reinicia o resource", "restart no script", "para/sobe o resource", ou quando uma mudança precisar ser recarregada no servidor pra testar.
---

# Comandos no servidor pelo txAdmin

Sem rcon: o txAdmin roda local e o painel dele tem uma API. O script faz login, manda o
comando e imprime as linhas novas do `fxserver.log`.

**Configurar uma vez:** copiar `config.example.json` para `config.json` (fica fora do git) e
preencher a URL, o login do txAdmin, a pasta do servidor (`base`, onde fica o `txData`) e o
perfil.

Rodar da pasta da skill, Node 18+:

```bash
node scripts/tx.mjs ensure rpemotes-reborn
node scripts/tx.mjs restart mri_Qemotes
node scripts/tx.mjs stop nome_do_resource
node scripts/tx.mjs ensure job_a job_b job_c   # vários de uma vez, no mesmo login
node scripts/tx.mjs refresh            # relê a lista de resources (resource novo na pasta)
```

| Ação | O que faz |
| --- | --- |
| `ensure <res>` | Sobe, ou reinicia se já estiver rodando. Padrão pra recarregar mudança. |
| `restart <res>` | Reinicia (falha se estiver parado). |
| `start <res>` / `stop <res>` | Sobe / para. |
| `refresh` | `refresh` do servidor, pra enxergar resource novo ou `fxmanifest.lua` mudado (arquivo novo em `client_scripts`): sem ele o `ensure` sobe com o manifest antigo e o cliente dá `attempt to index a nil value` no global do arquivo que faltou. |
| `say <mensagem>` | Anúncio do txAdmin pra todos os jogadores. Só se pedirem. |

**Login:** o txAdmin bloqueia o login por 15 minutos depois de umas 10 tentativas seguidas (erro 429).
O script guarda a sessão em `%TEMP%mri-txadmin-<url>.json` e só loga de novo quando ela expira.
Pra vários resources, passar todos no mesmo comando em vez de um loop de chamadas. Se vier o 429,
esperar os 15 minutos: tentar de novo não adianta.

Flags: `--base <pasta>` e `--profile <perfil>` (padrão no `config.json`), `--url` se o txAdmin não estiver na porta 40120, `--no-log` pra não ler o log.

## Depois do comando

- Conferir na saída que o resource subiu (`Started resource <res>`) e que não veio
  `SCRIPT ERROR` ou `Couldn't start resource`.
- **Restart reinicia só aquele resource.** Quem depende dele (ex.: o `mri_Qemotes` em cima do
  `rpemotes-reborn`) continua com o estado da instância antiga e pode parar de funcionar no
  cliente. Reiniciou um motor/base: reinicie também quem usa ele.
- Quem declara o resource em `dependencies` é **parado** junto e não volta sozinho (ex.:
  `ensure sd-phone` derruba `sd-tablet` e os apps). Ler os `Stopping resource` no log e dar
  `ensure` em cada um.
- Resource grande (ex.: `sd-phone`, 22 MB): no cliente conectado os dependentes podem subir
  antes dele terminar de baixar, e ele fica montado sem rodar (`No such export` nos apps).
  Conferir `Creating script environments for <res>` no log do FiveM; sem a linha, o jogador
  precisa reconectar.
- Resource novo ou `dependencies` mudado: nada de resource só de servidor (ex.: `qbx_vehicles`)
  no `dependencies`. O cliente não acha, recusa o resource e o FiveM derruba o jogador
  ("Could not find dependency ... Killing network"). Conferir o log do FiveM depois do `ensure`.
- Resource com `stream/` ou `data_file` de modelo: perguntar antes. Remontar no cliente
  conectado derruba o jogo.
- O lado do cliente aparece no log do FiveM (`FiveM.app\logs\CitizenFX_log_*.log`, na pasta
  do FiveM), não no `fxserver.log`.
- O script não mexe no `server.cfg`.

## Erros

- `login falhou`: txAdmin fora do ar ou senha trocada. Conferir o `config.json`.
- `comando falhou`: a mensagem do txAdmin vem junto (ex.: resource não existe).
- Comando de console arbitrário não passa por essa API (o Live Console usa websocket): pra
  isso, usar o console do txAdmin.
