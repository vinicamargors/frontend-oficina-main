# Auditoria do frontend - Fase 4 (PLANO_CORRECAO.md)

Data: 2026-11-09. Frontend http://localhost:5173, backend http://localhost:8000/api/v1 (codigo da fase 4), AutotecDB de producao.
Dados tocados somente na Oficina A ("Oficina do tiao", 94334e9f-..., empresa_teste = true). Nenhum dado da Autotec Racing apareceu. Senha/JWT nao gravados.

Execucao: o Chrome do MCP do Playwright estava em uso por outra sessao (perfil ms-playwright-mcp, "Browser is already in use"), entao usei scripts Node com playwright-core e Chrome headless isolado (contexto novo, um unico contexto com 2 paginas no F6). Cenarios em serie.

## Resumo

| Cenario | Resultado | Evidencia curta |
|---|---|---|
| F6 concorrencia (2 abas, mesma peca, saldo 1) | PASSOU | 1x 200 e 1x 400 "Estoque insuficiente para 'Peca F6 AUDIT'. Saldo atual: 0"; saldo 0; 1 os_itens |
| F6b saida maior que o saldo na tela Estoque | PASSOU | PATCH /ajustar 400 "Estoque insuficiente. Saldo atual: 3" visivel; saldo continua 3 |
| F6c exclusao de OS com peca | PASSOU | saldo 3 -> 5, OS e itens somem, audit_logs DELETE com o motivo |
| R regressao (Dashboard, OS, Estoque, Clientes) | PASSOU | 0 respostas 4xx/5xx de API, 0 erros de console (exceto favicon.ico 404 do Vite) |

## F6 - Concorrencia (PASSOU)
Passos: criei pela tela Estoque (+ Nova Peca) "Peca F6 AUDIT" qtd 1 (custo 10, venda 20). Abri 2 paginas no mesmo contexto/usuario na OS TSTA001 (seed, ORCAMENTO), em cada uma busquei a peca, selecionei, "Incluir na Fila de Lancamento" (qtd 1) e deixei pronto o botao "Lancar Todos os 1 Itens na OS". Disparei os dois cliques com Promise.all (45 ms entre os dois). Prints: F6-0, F6-1-aba1/aba2-pronta, F6-2-aba1/aba2-resultado.
Rede:
- aba 1: POST /os/<A>/<os>/itens/lote -> 200 (item criado, quantidade 1)
- aba 2: POST /os/<A>/<os>/itens/lote -> 400 {"detail":"Estoque insuficiente para 'Peca F6 AUDIT'. Saldo atual: 0"}
Tela (aba 2): banner vermelho com essa mensagem legivel (F6-2-aba2-resultado.png); aba 1 sem erro.
Banco: estoque 'Peca F6 AUDIT' quantidade = 0; os_itens dessa peca na OS = 1 (quantidade 1).
Console: so o "Failed to load resource ... 400" da propria resposta esperada.

## F6b - Ajuste de saida acima do saldo (PASSOU)
Passos: Estoque, filtrar "F6B AUDIT" (saldo 3), "Registrar Saida Rapida", qtd 5, Confirmar Saida (F6b-1/2/3).
Rede: PATCH /estoque/<A>/<id>/ajustar {"tipo":"saida","quantidade":5} -> 400 {"detail":"Estoque insuficiente. Saldo atual: 3"}.
Tela: banner "Estoque insuficiente. Saldo atual: 3" (modal permanece aberto). Banco: quantidade continua 3.

## F6c - Exclusao de OS devolve estoque (PASSOU)
Passos: Nova OS (cliente Zezinho esquilo, veiculo FUK2F55), lancei 2x "Peca F6C AUDIT" (saldo 5 -> 3 conferido no banco, 1 os_itens), abri a OS, lixeira, motivo "Motivo F6C AUDIT teste de exclusao", Confirmar Exclusao (F6c-1..5).
Rede: DELETE /os/<A>/<os>?motivo_exclusao=... -> 200 {"status":"sucesso","detail":"OS cancelada, estoque restaurado e log gerado."}; a tela volta para a lista de OS.
Banco: saldo 3 -> 5; ordens_servico da OS = 0 linhas; os_itens da OS = 0; audit_logs id 31017 tabela ordens_servico operacao DELETE com dados_antes.motivo_exclusao = "Motivo F6C AUDIT teste de exclusao". (Existe tambem um DELETE de ordens_servico duplicado, id 31016, gerado pelo trigger de auditoria; sem o motivo no texto buscado - observacao abaixo.)

## R - Regressao (PASSOU)
Dashboard (?tab=patio), Ordens, Estoque, Clientes: todas as respostas de API 200 (clientes, dashboards, empresas, estoque, os, usuarios/me, usuarios/equipe, veiculos, rest/v1/usuarios). Nenhum 4xx/5xx de API e nenhum pageerror. Unico erro de console: 404 de http://localhost:5173/favicon.ico (Vite, sem favicon). Prints R-*.png.

## Observacoes / problemas
1. POST /os/ reaproveita OS aberta do mesmo veiculo ("reaproveitada": true). Minha primeira tentativa de F6c usou o veiculo TSTA001 e, sem querer, alterou a OS seed (km_atual 50000, descricao) e lancou a peca F6C nela. Restaurei por SQL (km null, descricao "OS de teste (seed)", totais 0, item removido, saldo da peca reposto) e conferi. Nao e bug da fase 4, mas a nova OS sobrescrever descricao/km da OS reaproveitada e surpreendente.
2. Duas linhas de audit_logs DELETE para a mesma OS (31016 e 31017) numa exclusao: verificar se e duplicidade esperada (trigger + log manual).
3. favicon.ico 404 no console (cosmetico).
4. Apos o 400 no F6 a aba 2 continua mostrando a fila e a lista "Todos (0)" desatualizada (sem recarregar a OS).

## Limpeza (confirmada por SQL, so Oficina A)
Removidos: os_itens "AUDIT", estoque Peca F6/F6B/F6C AUDIT, OS temporaria 68a47eb9-..., e todos os audit_logs com id > 30989 ligados a esses registros e a OS seed (15 linhas + as geradas pela limpeza). Contagens finais: estoque AUDIT = 0, estoque total 2, os_itens 5, ordens_servico 4, audit_logs novos = 0 (iguais ao inicio). OS seed TSTA001 restaurada.
