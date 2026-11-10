# Auditoria do rebrand Autotec Pro -> Mecanify

Data: 2026-11-10. Branch feat/rebrand-mecanify (commit c48cdd5). Front http://127.0.0.1:5174, backend http://127.0.0.1:8010 (confirmado na rede). Edge headless via Playwright (scripts Node, contexto novo), cenarios em serie, so Oficina A (94334e9f-..., empresa_teste = true). Nenhum dado criado/alterado; nenhuma requisicao com o id da Autotec Racing (0). Senha nao gravada. Screenshots em `auditorias/rebrand-mecanify-auditoria/` (JSONs brutos: m1-result.json, m345-result.json).

## Resumo

| Cenario | Resultado | Evidencia curta |
|---|---|---|
| M1 Marca | PASSOU (com 2 observacoes) | 0 "Autotec" em texto/placeholder/title/aria de login, cadastro, recuperar, Radar, Ordens, Clientes, Estoque, Financeiro (4 abas), Equipe, Dados da Oficina; unica ocorrencia = e-mail do usuario no rodape (`dono.a@homolog-autotec...`, dado do banco). "Mecanify" no login, no menu lateral e no cabecalho mobile. /favicon.svg = 200. Titulo: "Entrar — Mecanify", "Criar Conta da Oficina — Mecanify", "Recuperar Senha — Mecanify" |
| M2 Legibilidade | PASSOU com OBSERVACOES | Nenhum par < 4.5:1 no login/cadastro/recuperar e nas telas principais; 3 pares fracos (abaixo) |
| M3 Mobile 375x812 | PASSOU | Login, Radar, Ordens, Estoque: scrollWidth = 375 (sem scroll horizontal da pagina), nada cortado; barra inferior com 7 abas visivel |
| M4 Impressos | PASSOU com OBSERVACAO | Holerite: "MECANIFY • OFICINA MECANICA", preto no branco; etiqueta: "MECANIFY • ALMOXARIFADO", barras pretas, preco preto; OS impressa: so preto no branco (21 elementos rgb(0,0,0)), cabecalho = nome da oficina |
| M5 Perfis (mecanico, atendente) | PASSOU | Menu: Radar, Ordens, Clientes, Estoque (sem Financeiro/Equipe/Oficina); 0 erro de console, 0 pageerror, 0 resposta 4xx/5xx; "Autotec" so no e-mail do rodape |
| M6 Regressao | PASSOU | Em todos os passos (dono, mecanico, atendente, mobile, impressos): 0 mensagens de console error/warning, 0 pageerror, 0 respostas >= 400 (nem favicon) |

## M1 - Marca
- Capturado `document.body.innerText` + atributos placeholder/title/aria-label/alt em 12 telas (arquivos M1-*.png). Contagem de "autotec" = 0 em todas as telas deslogadas e 1 nas logadas, sempre `dono.a@homolog-autotec.example.com` (dado do usuario vindo do banco, esperado).
- OBS-1: o `document.title` NAO acompanha a tela depois do login: permanece "Entrar — Mecanify" em Radar, Ordens, Estoque etc. Marca correta (Mecanify), mas o titulo "Entrar" logado e enganoso; provavelmente herdado do comportamento anterior (nao e regressao do rebrand). Sem screenshot (so titulo).
- OBS-2: OS impressa mostra "OFICINA DO TIAO" (nome da oficina do banco) e nao "Mecanify" no cabecalho; correto por design, so registrando.

## M2 - Legibilidade (WCAG, getComputedStyle, 1366x800)
Varridos texto e icones SVG de todas as telas (login, cadastro, recuperar, 7 telas do dono + 4 abas financeiro + Folha). Pares abaixo do limite:

| Tela | Seletor | Cor / Fundo | Razao | Limite |
|---|---|---|---|---|
| Financeiro (todas abas) e Equipe (botoes de cabecalho) | `span` do botao "+ Receita / Aporte" e "Convidar no WhatsApp" (12px) | #FFFFFF sobre #059669 | 3.77 | 4.5 |
| Financeiro > DRE | `div.pl-4.pr-3.py-1` "Nenhuma conta a pagar liquidada no periodo" (12px italico) | rgb(91,123,176) (#5B7BB0 = slate-500) sobre #0B1B36 | 4.01 | 4.5 |
| Financeiro > BI | `p.text-slate-500.text-xs.py-4` "Nenhum mecanico com OS finalizada." (12px) | #5B7BB0 sobre #0B1B36 | 4.01 | 4.5 |
| Login/Cadastro/Estoque (placeholders de input, ::placeholder) | `input[placeholder]` | #5B7BB0 sobre #071226 | 4.37 | 4.5 |

- OBSERVACAO: o novo `slate-500` (#5B7BB0) fica entre 4.0 e 4.4:1 sobre o navy; so aparece em textos secundarios/placeholders, legiveis nos screenshots, mas abaixo de 4.5. Sugestao: clarear slate-500 uns 10% (ex. #6B8BC0). Os botoes verdes com texto branco 12px (3.77) sao o verde mantido de proposito (emerald-600), nao e do rebrand.
- Nenhum icone < 3:1 sobre fundo navy nas telas do dono. Bordas visiveis (card/inputs com borda #264577/#12274D distinguiveis nos screenshots, ainda que sutis).
- Inspecao visual: M1-login, M1-1 Radar, M1-2 Ordens, M1-5-fin-DRE, M1-6 Folha, M1-7 Oficina: textos e icones legiveis; sem "texto fantasma".
- OBS-3: Dados da Oficina (M1-7-DadosdaOfici.png) mostra campos vazios 1,2 s apos abrir (carga assincrona de /configuracoes); com 6 s os campos estao preenchidos (M1-7-DadosdaOficina-6s.png). Nao e do rebrand; so lento.

## M3 - Mobile
M3-login.png, M3-radar.png, M3-Ordens.png, M3-Estoque.png. `documentElement.scrollWidth` = `clientWidth` = 375 nas 4 telas. Em Estoque 6 botoes de categoria ficam alem de 375px, mas dentro de container com rolagem horizontal propria (chips "Todas/Critico/PECAS/FLU..." cortados por design, `shrink-0`), sem scroll de pagina.

## M4 - Impressos (emulateMedia print, screenshots)
- Holerite (Equipe > Folha > Ver Holerite): M4-holerite-tela.png / M4-holerite-print.png. Papel branco, texto preto, cabecalho "MECANIFY • OFICINA MECANICA".
- Etiqueta (Estoque > icone codigo de barras): M4-etiqueta-tela.png / M4-etiqueta-print.png. "MECANIFY • ALMOXARIFADO", nome, barras, SKU e preco em preto; categoria "PECAS" em azul-marinho escuro (#264577, ~9:1 sobre branco, legivel).
- OS (Ordens > Abrir OS): M4-os-tela.png / M4-os-print.png. Tudo preto no branco, sem azul.
- OBSERVACAO (nao bloqueante): com print emulado, o fundo do app e a moldura do modal (navy/azul claro) continuam aparecendo ao redor do holerite/etiqueta nos screenshots (print:hidden cobre so cabecalho e botoes do modal). Nao testei o dialogo real de impressao; em impressao real "graficos de plano de fundo" costuma vir desligado, mas vale conferir uma impressao/PDF real. Nao ha CSS `@media print` global no repo (grep em index.css) e as classes print: ja existiam; provavelmente pre-existente.

## M5 - Perfis
Mecanico e atendente (Oficina A): menu de 4 itens, todas as 4 telas abertas (screenshots M5-*.png), sem erros de console, sem 4xx/5xx, 0 contrastes < limite nas telas.

## M6 - Regressao
Console limpo e nenhum 5xx; nem o 404 do favicon do Vite aparece (/favicon.svg responde 200). Nenhum dado da Autotec Racing em rede/tela.

## Resultado final
Nenhum FALHOU. Observacoes: OBS-1 titulo da aba logado, slate-500 (#5B7BB0) com 4.0-4.4:1, botoes verdes 3.77:1 (verde mantido), moldura do modal no print, carga lenta de Dados da Oficina.
