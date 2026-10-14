# Otimização de texturas

## Onde está o peso

Em carro de mod o problema quase nunca é textura gigante: é **textura sem compressão**
(A8R8G8B8, 4 bytes por pixel). Medido em carros de mod:

| Carro | Disco | Textura crua | Já comprimida | Depois |
| --- | --- | --- | --- | --- |
| m2trg (BMW M2) | 20.9 MB | 130 MB | 16 MB | memória 147.5 -> 42 MB, disco 8.3 MB |
| elegyrh7 | 3.5 MB | 4.5 MB | 7.9 MB | pouco ganho |
| 93sultan, rossati | pequenos | quase nada | | nada |

DXT1 (sem alpha) = 1/8 do cru; DXT5 (com alpha) = 1/4. Também há marca d'água do autor como
textura (ex.: "Created By TRG WORKS", 1920x1080).

## O que o `ytd.rs` faz

- **Textura crua** (21, 22, 32): vira DXT1 se todo pixel tem alpha 255 (X8 sempre), senão DXT5.
  Usa os mips que o arquivo já tem; quando faltam, gera por média 2x2. Encoder `texpresso`
  (Rust puro, MIT), ClusterFit; pesos uniformes em normal map (`_n`, `_nm`, `_nrm`, `normal`),
  perceptuais no resto; com alpha, pondera cor pelo alpha.
- **Textura acima de `max_size`** (padrão 2048): cai os mips de cima. Em DXT só funciona se o
  arquivo já tiver os mips menores (não decodifica).
- Fica de fora: dimensão não múltipla de 4, textura 3D, BC7, A8/L8, o que já está comprimido
  e dentro do tamanho.
- Mantém nome, resolução (se não passou do limite) e o resto da struct; troca largura, altura,
  stride, formato, níveis e ponteiro dos pixels; reempacota as páginas de gráficos; atualiza a
  contagem de páginas na tabela; deflate `best`.
- **Limite de páginas**: nunca passa da contagem original mais o espaço livre (zerado e fora de
  blocos conhecidos) depois da tabela. Na prática não há espaço, então mantém a contagem e o
  empacotador usa páginas maiores. Custa uns 10 MB a mais que o ótimo num carro grande.
- `estimate` lê só a seção de sistema (rápido, para varrer a base). Como não vê o alpha, conta
  toda textura com alpha como DXT5: o real só pode sair menor. Para X8 e DXT bate exato (há
  teste).

## O que o `textures.rs` faz

- `scan`: todo `.ytd` dentro de `stream` de cada resource, `estimate`, lista do maior ganho
  para o menor. Resource com backup aparece mesmo sem nada a fazer (para desfazer).
- `apply`: otimiza cada ytd, relê com `inspect` (mesma contagem de texturas), guarda o original
  em `backup_optimize/<resource>/<caminho>` (só o primeiro backup: uma segunda rodada não
  sobrescreve o original), troca por temporário + rename.
- `restore`: devolve os originais (temporário + rename) e apaga o backup.
- A tela manda `restart <resource>` depois (sem servidor rodando, só avisa).

## Ideias para depois

- Texturas embutidas no `.yft`/`.ydr` (maior ganho que falta).
- Reduzir DXT grande sem mips (decodificar com `texpresso`, reduzir, recodificar).
- Mover a tabela de páginas para recuperar a folga.
- Remover textura duplicada entre `.yft` e `.ytd` e marca d'água (só com escolha do usuário).
- Otimizar já na instalação do mod (fluxo do GTA5-Mods).
