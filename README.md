# mri-fivem-skills

Skills de agente (Claude Code, Codex e outros que leem `SKILL.md`) para desenvolver resources
FiveM: telas com cara de jogo, vidro na NUI, arquivos do GTA, posicionamento no mundo e
comandos no servidor pelo txAdmin. Saíram do dia a dia da [MRI Brasil](https://github.com/mri-Qbox-Brasil)
em servidores Qbox.

*Agent skills for FiveM resource development (in Brazilian Portuguese).*

| Skill | Para quê |
| --- | --- |
| [`mri-game-ux`](mri-game-ux) | Telas e cenas com cara de jogo AAA: câmera scriptada, transições sem corte seco, trilha em fases, menus, conversa com NPC |
| [`mri-world-placement`](mri-world-placement) | Posicionar NPC, objeto e zona e marcar rota no mundo, com módulo Lua e barra de teclas prontos, sem marcador piscando |
| [`mri-nui-glass`](mri-nui-glass) | Liquid glass de verdade na NUI: o jogo desfocado atrás do painel, que o `backdrop-filter` do CEF não faz |
| [`mri-gta-assets`](mri-gta-assets) | Formatos do GTA V (RPF7, RSC7, ytd), otimização de texturas, mod single player para resource FiveM |
| [`mri-txadmin`](mri-txadmin) | `ensure`, `restart`, `start` e `stop` pela API local do txAdmin, sem rcon, com o log do servidor |

## Instalar

Clone e ligue cada pasta na pasta de skills do agente (link, não cópia, para o `git pull`
atualizar):

```powershell
git clone https://github.com/mur4i/mri-fivem-skills C:\Github\mri-fivem-skills
foreach ($s in Get-ChildItem C:\Github\mri-fivem-skills -Directory) {
  if (Test-Path "$($s.FullName)\SKILL.md") {
    New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\$($s.Name)" -Target $s.FullName
  }
}
```

No Linux/macOS: `ln -s` de cada pasta em `~/.claude/skills/`. Codex: `~/.codex/skills`.

O `mri-txadmin` precisa de um `config.json` (copie o `config.example.json`); ele fica fora do git.

## Manutenção

Cada skill melhora com o uso. Ao terminar uma tarefa, o agente avalia se algo deve ficar
registrado (padrão aprovado, pegadinha nova, passo que fez falta) e edita a skill:

- só o que é geral e confirmado, como regra curta no imperativo, não história;
- editar o que já existe antes de acrescentar; regra nova que contradiz uma antiga a substitui;
- `SKILL.md` com até ~150 linhas, detalhe em `references/`;
- capacidade nova entra na `description` no mesmo commit;
- nada de segredo, senha, caminho pessoal ou dado de servidor privado.

## Licença

[MIT](LICENSE).
