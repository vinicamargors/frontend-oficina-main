# Auditoria do frontend - Fase 3 (PLANO_CORRECAO.md)

Data: 2026-11-09, ~16:20-16:50 (America/Sao_Paulo). Frontend http://localhost:5173, backend http://localhost:8000/api/v1, AutotecDB de producao.
Dados tocados somente na Oficina A ("Oficina do tiao", 94334e9f-...). Nenhum dado da Autotec Racing apareceu na tela, na rede ou no console.
Execucao: Playwright (MCP no inicio; depois que o Chrome do MCP foi tomado por outro processo, Playwright-core via script Node com Chrome isolado, mesmas APIs: route/unroute, requests, localStorage). Senha/JWT nunca gravados.

AVISO DE AMBIENTE: ha evidencia de OUTRO auditor rodando os mesmos cenarios ao mesmo tempo (screenshots F3-UI-2c-confirm, 3a-mensagem, 3a-status-abortado, 3b-patio-retry, 3c-503-sucesso, 3d-502-erro, 4-oficina-original nao foram criados por esta auditoria; e o perfil do Chrome do MCP foi tomado por outro processo). Isso pode contaminar: o "2 linhas" visto uma vez em F3-UI-3c e parte dos 401 intermitentes.

## Resumo

| Cenario | Resultado | Evidencia curta |
|---|---|---|
| F3-UI-1 regressao dono | FALHOU (parcial) | Funcional e sem Supabase REST alem de `usuarios?select=`; mas erros de console intermitentes: GET backend com 401 "Passaporte rejeitado pela matriz" e ERR_FAILED/CORS em todos os tours |
| F3-UI-2 financeiro | PASSOU | criar OK; 403 => erro na tela, 0 REST, nada gravado; DELETE 500 => alerta e linha permanece; delete real OK |
| F3-UI-3 retry/abort | FALHOU (3a) / PASSOU (b,c,d) | 3a: nenhuma mensagem de erro quando o autosave da OS falha (silencioso); resto OK |
| F3-UI-4 config servidor | PASSOU (ressalva) | valores em contexto novo e no backend; ressalva: Salvar grava lat/long geocodificados |
| F3-UI-5 migracao localStorage | FALHOU (parcial) | folha/WhatsApp/PIX migrados e chaves apagadas; raio_gps 120 NAO migrado (servidor tem default 100); servidor preenchido nao e sobrescrito |
| F3-UI-6 OS + estoque | PASSOU | saldo 10 -> 8 -> 10; so /api/v1, 0 writes a rest/v1 |
| F3-UI-7 avaliacao publica | PASSOU | sucesso grava; sem empresaId (422) e backend abortado => erro visivel, botao habilitado |
| F3-UI-8 mecanico | FALHOU (parcial) | barra e redirects OK; Clientes gera 2 erros de console (GET /usuarios/<A> 403) |

## F3-UI-1
Passos: login dono.a; Patio, Ordens, Clientes, Estoque, Caixa (Financeiro), Equipe, Oficina. Prints F3-UI-1-*.png.
- Supabase REST distintos (todos os tours): apenas `GET /rest/v1/usuarios?select=...` (200), mais `POST /auth/v1/token` no login. Todo o resto em localhost:8000.
- Backend, caminhos: usuarios/me, empresas/, dashboards/, os/, usuarios/<A>, veiculos/<A>, clientes/<A>, estoque/<A>, transacoes-financeiras/<A>, financeiro/inteligencia/<A>, financeiro/<A>, equipe/pontos|avaliacoes|escalas/<A>, empresas/<A>/configuracoes.
- Clientes em ordem alfabetica: Cliente Teste A, Julya Lima Moreira, Marli, TUNICO CARA DE PITO, Vinicius, Zezinho esquilo. Busca "gol" e "TSTA001" em Ordens acham a OS TSTA001 (Gol 1.0). Historico do veiculo TSTA001 mostra a OS #9B45576F.
- Problema: em 3 tours seguidos houve 12/9/8 respostas nao-200: `401 {"detail":"Passaporte rejeitado pela matriz. Token invalido, expirado ou corrompido."}` em dashboards, empresas/?empresa_id, os, estoque, veiculos, clientes, e requests ERR_FAILED (o navegador reporta como bloqueio de CORS: resposta sem cabecalho ACAO, tipico de erro 5xx). Console: 17/8/8 erros. O token e valido (80 chamadas seguidas e rajada de 20 paralelas deram 200). Intermitente, afeta qualquer rota; o frontend nao repete 401. Possiveis causas: validacao do token no backend falhando de forma intermitente, ou carga do outro auditor.

## F3-UI-2 (dono A)
- (a) Criar "F3-UI-2 teste" (10, venc. 2026-12-15): `POST /api/v1/transacoes-financeiras/ 200`; aparece na tela (filtro de datas ampliado) e no GET do backend. localStorage alem de auth: `autotec_tenant_id`, `autotec_categorias_<A>` (lista de categorias, nao transacoes).
- (b) POST interceptado com 403 {"detail":"Acesso negado para o seu perfil."}: a tela mostra a mensagem; unico request POST 403; 0 requests a rest/v1/transacoes_financeiras; sem chave autotec_transacoes_*; apos reload a despesa nao existe (tela e backend). Print F3-UI-2b-erro403.png.
- (c) DELETE interceptado com 500: alert "Erro ao excluir transacao."; 1 DELETE apenas (sem retry); apos reload a linha continua (tela e backend).
- (d) Delete real: `DELETE .../transacoes-financeiras/<A>/<id> 200`; sumiu apos reload e do GET do backend. Print F3-UI-2d-apagada.png.

## F3-UI-3
- (a) OS TSTA001 aberta, localhost:8000 abortado, KM=51234 e descricao alterados (autosave por blur): `PUT /os/<A>/<os>` ERR_FAILED; 0 writes a rest/v1; localStorage so `autotec_tenant_id`; apos desfazer e recarregar: KM vazio e descricao "OS de teste (seed)" (tela e backend inalterados). FALHA: nenhuma mensagem de erro nem alerta; o campo continua mostrando 51234 como se salvo (OrdensServico.tsx `salvarDadosTecnicosSilencioso`: `catch { setStatusAutoSave('idle') }`). Um unico blur => 1 PUT (sem retry de escrita). Print F3-UI-3a-backend-abortado.png.
- (b) Primeiro GET /dashboards/ abortado: GET FAILED, GET 200, GET 200; Patio carrega. PASSOU. F3-UI-3b-dashboard-retry.png.
- (c) 503 na primeira POST de transacao (a segunda passa): 2 POSTs ao backend (503, 200); formulario fecha (sucesso). Em 3 reexecucoes isoladas: 1 linha criada (removida ao fim). Em UMA execucao (concorrente com o outro auditor) o backend tinha 2 linhas "F3-UI-3c teste"; nao reproduzido, provavelmente do outro auditor, sem certeza. PASSOU com ressalva. F3-UI-3c-503-retry.png.
- (d) 502: 1 POST, 0 linhas, formulario aberto com "Bad gateway" visivel. PASSOU. F3-UI-3d-502-sem-retry.png.

## F3-UI-4
Originais (backend): whatsapp null, chave_pix null, lat/long null, raio 100, dia_pagamento 5, adiantamento 20, comissoes 15/5, hora extra true/25. A tela mostra WhatsApp 11976608449 (fallback do telefone da empresa; backend tem null).
Alterados: WhatsApp "11 98888-7777", PIX "pix-f3@teste.example.com", dia pagamento 7: "Dados da oficina atualizados com sucesso!" (PUT /empresas/<A> 200 e 2x PUT /empresas/<A>/configuracoes 200; 0 Supabase REST).
Contexto isolado novo (localStorage vazio): mesmos valores na tela; sem autotec_oficina_custom_* nem autotec_parametros_folha_*; GET /empresas/<A>/configuracoes confirma.
Restauracao pela tela (campos vazios, dia 5): backend whatsapp null, chave_pix null, dia 5. Ressalva: o Salvar da tela grava latitude/longitude geocodificadas (-23.5432419/-46.7739629) que eram null; restaurei lat/long para null por PUT na API. Prints F3-UI-4-*.png.

## F3-UI-5
- Chaves antigas gravadas + reload: 1 PUT /empresas/<A>/configuracoes 200; backend: whatsapp 11977776666, chave_pix migrado@..., folha 9/24/11/3/false/31; as duas chaves sumiram do localStorage. Raio ficou 100, NAO 120: `migrarConfigLocal` so preenche campo vazio e o servidor tem default 100 (nao vazio), entao raio_gps_metros nunca migra. FALHOU nesse item (por desenho; decidir se aceita).
- Servidor com WhatsApp 11900000000/PIX servidor@... e localStorage antigo (11955554444, antigo@..., raio 150, folha diferente): 0 writes, chaves apagadas, servidor intacto (folha nao-padrao tambem). PASSOU.
- Restaurado pela tela (whatsapp/pix vazios, raio 100, folha 5/20/15/5/true/25) e lat/long nulos via API. Prints F3-UI-5a/5b.

## F3-UI-6
OS TSTA001 + "Filtro de oleo TESTE" qtd 2: o fluxo real tem fila + "Lancar Todos os 1 Itens na OS": `POST /os/<A>/<os>/itens/lote 200`, saldo 10 -> 8; remover: `DELETE /os/<A>/<os>/itens/<id> 200`, saldo 10, OS com 0 itens. 0 writes a rest/v1. PASSOU.

## F3-UI-7
(a) osId=9b45576f-..., empresaId=A, nota 5, "F3-UI-7 teste" (nome e veiculo sao obrigatorios no form): `POST /equipe/avaliar 200`, "Avaliacao Enviada!", registro no GET /equipe/avaliacoes/<A>: id 2a3bbef6-8377-428c-9746-ec707b1df5d0.
(b) sem empresaId: POST 422; mensagem "Nao foi possivel enviar sua avaliacao agora..."; botao habilitado; sem tela de sucesso; nada criado.
(c) backend abortado: POST ERR_FAILED; mesma mensagem e botao habilitado; nada criado. PASSOU. Observacao: a placa enviada e fixa "AUT-0000".

## F3-UI-8 (mecanico.a)
Barra: Patio, Ordens, Clientes, Estoque. Sem erros de console em Patio, Ordens e Estoque. Clientes: 2 erros de console, `GET /usuarios/<A> 403` (a tela pede lista de usuarios, proibida ao mecanico). ?tab=financeiro/equipe/oficina redirecionam para ?tab=patio. Seletor de mecanico em Ordens (nao e falha): so "Selecione..." e "Mecanico Teste A (MECANICO)", com ele selecionado. Prints F3-UI-8-*.png.

## Estado final / limpeza
Nenhuma transacao F3 restante; estoque Filtro=10, Oleo=10; OS TSTA001 sem itens, KM null, descricao original; config da Oficina A igual ao original (lat/long null). Restou 1 avaliacao: 2a3bbef6-8377-428c-9746-ec707b1df5d0. Pasta .playwright-mcp apagada.
