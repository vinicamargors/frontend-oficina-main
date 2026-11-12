# Auditoria do frontend - Fase 5 (alteracoes nao commitadas)

Data: 2026-11-12. Metodo: Playwright com backend simulado (e2e/mocks), Chromium local (`-c e2e/pw.local.config.ts`), 4 projetos (claro/escuro x 1440/390). Nenhuma credencial real, nenhum backend real, src/ intocado, nada commitado. Spec temporaria `e2e/auditoria-fase5.tmp.spec.ts` (80 execucoes) removida ao fim. Screenshots: `auditorias/fase-5/` (48 arquivos).

## Specs existentes
`e2e/avaliacao.spec.ts`, `e2e/ordens.spec.ts`, `e2e/equipe.spec.ts` nos 4 projetos: **294 passaram, 18 skipped (condicionais por projeto), 0 falhas**. `impressao.spec.ts` ignorado (poppler ausente, conhecido).

## Verificacoes proprias (80 execucoes, 4 projetos: 80 OK na rodada final)
Duas correcoes minhas no proprio teste antes da rodada final (nao sao falhas do app): (1) o app roda em React.StrictMode no dev server, entao o GET de conferencia dispara 2 vezes ao abrir (mesma URL, ambos antes do formulario); (2) minha rota de ponto era registrada antes de `simularBackend` e perdia a prioridade.

| Cenario | O que foi feito / requisicoes | Esperado | Resultado |
|---|---|---|---|
| (a) token + corpo | `/?modo=avaliar&token=a%2Bb.c-d_e%3D`. GET `/equipe/avaliar/a%2Bb.c-d_e%3D` (x2 por StrictMode no dev) antes do h1/radiogroup; nota 2 + comentario "ok"; POST `/equipe/avaliar` | GET antes do form; corpo so token/nota/comentario; token decodificado | OK: corpo `{"token":"a+b.c-d_e=","nota":2,"comentario":"ok"}`; chaves exatas comentario/nota/token (sem empresa_id, os_id, cliente_nome, veiculo_*). Token JWT-like `eyJhIjoxfQ.sig-ab_c` chega intacto no GET e no POST |
| (b) storage | Interceptei Storage.prototype.setItem/getItem/removeItem | pagina nao le/grava dados | OK com ressalva: `localStorage.length` e `sessionStorage.length` = 0 apos enviar. O arquivo AvaliacaoPublicaOS.tsx nao usa storage. Acessos vistos vem do shell (App): leitura de `mecanify_tema`, `autotec_tenant_id`, sessao Supabase (`sb-*-auth-token`) e a sonda de lock do supabase-js (set/rm). Nada de dados da avaliacao |
| (c) link invalido | GET responde 404 `{detail:"Link de avaliação inválido ou expirado."}` | detalhe do servidor visivel, sem radiogroup, sem POST | OK: h1 "Não foi possível abrir a avaliação", 1 role=alert com o texto exato, 0 radiogroup, 0 botoes (sem retry), 0 requisicoes nao-GET. Prints `F8-link-invalido-*` |
| (d) duplo envio | POST atrasado 1 s; dblclick + Enter | botao "Enviando…" desabilitado, 1 POST | OK: 1 POST |
| (e) visibilidade | OS fixtures: ORCAMENTO(0), EXECUCAO(1), AGUARDANDO_PECA(2) ausentes; FINALIZADO(5), PAGO(9 e 11) presentes | so FINALIZADO/PAGO | OK em 1440 e em 390 |
| (e) mobile | 390: WhatsApp x=16 w=124, Pedir avaliação x=148 w=118, Imprimir x=274 w=111, y=728; barra scrollWidth=clientWidth=390, flex-wrap nowrap; scroll lateral do documento 0 | sem overflow, 3 botoes | OK nos dois temas. Observacao estetica: "Pedir avaliação" e "Imprimir (A4)" quebram em 2 linhas no botao. Prints `E-barra-*-390`, `E-desktop-*-1440` |
| (f) WhatsApp | clique em Pedir avaliação: 1 GET `/equipe/avaliacoes/{empresa}/link/{os}`; botao vira link "Enviar avaliação" | href com 55 + digitos do cliente, texto com link, botao some | OK: ex. `https://wa.me/5511977771259?text=...` (fone `(11) 97777-1259`), texto contem `<origin>/?modo=avaliar&token=tok-avaliacao-teste` e nome do cliente. Erro 403 do servidor: role=alert "Sem permissão." e botao permanece. Prints `F-whatsapp-*` |
| (g) ponto | POST `/equipe/pontos/{empresa}`; servidor mockado responde hora 07:42:09 / dentro_raio true / 37.6 m | corpo so tipo/lat/lon; mensagem usa dados do servidor | OK: corpo `{"tipo":"ENTRADA","latitude":-23.55052,"longitude":-46.633308}`; msg "Ponto registrado com sucesso às 07:42! Você está a 38m da oficina (dentro do raio permitido)." |
| (g) fora do raio | servidor responde dentro_raio false, 432.4 m | mensagem "fora do raio" com distancia do servidor | OK: "Ponto registrado fora do raio da oficina! Distância calculada: 432m (tolerância máxima: 150m)..." Prints `G-ponto-*` |
| Equipe > Avaliacoes | abrir a aba | sem botao "Ver tela publica" | OK (0 ocorrencias) |
| (h) a11y | 404, ja_avaliada, 5xx, erro de envio | 1 h1; role=alert so em erro; foco nao se perde | PARCIAL, ver abaixo |

### (h) detalhes
- OK: invalido (404) = 1 h1 + 1 alert; ja_avaliada = 1 h1, 0 alert, 0 form; 5xx = 1 h1 + alert + "Tentar de novo"; erro de envio = 1 alert, 1 h1; apos envio com sucesso o foco vai ao h1 "Obrigado".
- **FALHA leve (foco)**: apos erro de envio (500) e apos 409 -> "já foi avaliado", `document.activeElement` fica em BODY (o botao de envio fica desabilitado durante o envio e perde o foco; no 409 o formulario e desmontado). Tambem BODY apos "Tentar de novo" (a tela e trocada por "Abrindo…"). Sugestao: focar o alert/h1 ao entrar nesses estados (como ja se faz no "Obrigado"). Nao impede o uso; leitor de tela anuncia o role=alert, mas o foco de teclado volta ao inicio da pagina.

## Mapeamento ao plano
- **F7 (avaliar uma vez; 2a -> ja avaliada)**: OK. 1o envio: POST 200 e tela "Obrigado" com foco no h1. 2o envio (POST 409) e GET com `ja_avaliada:true`: h1 "Este serviço já foi avaliado", sem form, sem alert, nenhum POST extra. Prints `F7-*`. Limite: a gravacao unica depende do servidor (mock); aqui valida-se so o comportamento do front.
- **F8 (link adulterado/sem token -> erro visivel, nada gravado)**: OK. Token adulterado: erro visivel, 0 escritas. `/?modo=avaliar` sem token ou `token=` vazio: nao abre a avaliacao (cai na tela de login "Acessar painel da oficina"), 0 chamadas a `/equipe/avaliar`, 0 escritas. Observacao: sem token a pagina nao mostra erro de link, mostra o login.
- **F9-ponto (navegador nao envia data/hora)**: OK. Corpo = exatamente tipo/latitude/longitude (tambem sem usuario_id, dentro_raio, distancia_metros); hora e distancia exibidas sao as do servidor.

## Observacoes
- Se um funcionario logado abre o link publico, o client anexa o Bearer da sessao (client.ts:70-75); inofensivo, mas o link publico nao precisa dele.
- GET duplicado so no dev (StrictMode).

**Veredito: APROVADO COM RESSALVA** - 294/294 das specs existentes e 80/80 das verificacoes proprias passam; unica falha de qualidade: perda de foco (BODY) apos erro de envio, 409 e "Tentar de novo" na pagina publica (a11y leve), mais o texto de "Pedir avaliação" quebrando em 2 linhas a 390 px (estetico).
