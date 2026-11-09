# Reauditoria do frontend - Fase 3 (PLANO_CORRECAO.md)

Data: 2026-11-09, ~17:00-17:30 (America/Sao_Paulo). Frontend http://localhost:5173, backend http://localhost:8000/api/v1, AutotecDB de producao.
Dados tocados somente na Oficina A ("Oficina do tiao", 94334e9f-...). Nenhum dado da Autotec Racing apareceu na tela, na rede ou no console. Senha/JWT nunca gravados.

Execucao: scripts Node com playwright-core e Chrome headless isolado (contexto novo, sem perfil compartilhado). O MCP do Playwright NAO foi usado.

## Checagem de "outro processo ativo"
- Inicio: existia um Chrome com perfil `ms-playwright-mcp` (9 processos, iniciados 16:22:33) e varios servidores `@playwright/mcp` (node, de 12:40, 13:14, 16:19) de outras sessoes. Nao os usei.
- Fim: o mesmo Chrome do MCP (16:22:33) continua; dois novos node (17:19:45/17:19:50) apareceram durante a auditoria (provavel MCP de outra sessao; nao iniciados por mim). Nao observei efeito deles nos testes: o frontend/backend foram acessados so pelo meu Chrome isolado e os contadores de banco bateram exatamente (R5: +1/+1/+1, 0 ao final).
- Pasta C:\Projects\autotec\.playwright-mcp: nao existe ao final.

## Resumo

| Cenario | Resultado | Evidencia curta |
|---|---|---|
| R1 estabilidade (5 tours + 3 com 2 abas) | PASSOU | 8 tours: 0 respostas nao-200, 0 erros de console; REST so `usuarios?select=` |
| R2 autosave com backend fora | PASSOU | banner vermelho "Nao foi possivel conectar ao servidor..." visivel; 0 writes a rest/v1; LS so autotec_tenant_id; OS inalterada |
| R3 migracao do raio | PASSOU | raio 120 migrado + folha/WhatsApp/PIX; chaves somem; 2a parte sem PUT e chaves removidas; restaurado e conferido por GET |
| R4 mecanico | PASSOU | 4 abas, 0 erros/0 nao-200, seletor lista 6 pessoas, /equipe sem salario_base |
| R5 POST 503 + sucesso | PASSOU | +1 exato nas 3 tentativas, 2 POSTs cada; 0 restantes |

## R1 - Estabilidade (PASSOU)
Passos: login dono.a; 5 tours (Radar do Patio, Ordens, Clientes & Veiculos, Estoque, Caixa, Equipe, Oficina), com reload no inicio de cada tour (do 2o em diante; o 1o logo apos o login); depois 3 tours com 2 abas ao mesmo tempo (as duas recarregadas juntas; aba 2 percorre em ordem inversa). Em cada aba espera-se o fim das requisicoes pendentes antes de seguir.
Resultado: tours 1-5 (1 aba) nao200=0 console=0; tours 6-8 (2 abas) nao200=0 console=0. Supabase REST distinto: apenas `GET /rest/v1/usuarios?select=id,nome,email,telefone,cargo,ativo,empresa_id,estrelas_media,total_avaliacoes`.
Prints: R1-tour1-oficina.png, R1-final-aba1.png, R1-final-aba2.png.
Ressalva de metodo (nao e falha do produto): nas primeiras execucoes do script, reloads feitos com requisicoes em andamento geraram `GET /empresas/<A>/configuracoes net::ERR_ABORTED` (cancelamento do proprio navegador no reload, sem resposta do servidor). Aguardando o termino das requisicoes antes de recarregar: zero ocorrencias. Equipe e Oficina levam 2-3 s para quiescer e a aba Oficina dispara 4-5 GET identicos a /empresas/<A>/configuracoes por visita (ver Problemas).

## R2 - Autosave com backend fora (PASSOU)
OS TSTA001 (id 9b45576f-8687-41de-bfff-f42cde85254e), KM original vazio/null, descricao "OS de teste (seed)". Abri a Bancada ("Abrir OS"), `page.route('http://localhost:8000/**')` abort, KM=51234, blur.
- Tela: banner vermelho visivel "Nao foi possivel conectar ao servidor. Verifique a internet e tente de novo." (R2-2-erro-visivel.png).
- Rede: `PUT /api/v1/os/<A>/<os> net::ERR_FAILED` (unico); 0 POST/PUT/PATCH/DELETE a rest/v1; localStorage so `autotec_tenant_id` (alem de sb-*).
- Console: apenas "Failed to load resource: net::ERR_FAILED" (esperado pelo abort).
- Sem interceptacao + reload: GET /os/<A>/<os>/imprimir identico ao snapshot anterior (km_atual null).

## R3 - Migracao do raio (PASSOU)
Original (GET): whatsapp null, chave_pix null, raio 100, lat/long null, folha 5/20/15/5/true/25.
- Parte 1: duas chaves no localStorage + reload. Rede: 1 `PUT /empresas/<A>/configuracoes 200` (whatsapp 11977776666, chave_pix migrado@teste.example.com, raio 120, folha 9/24/11/3/false/31). GET depois: exatamente isso; as duas chaves removidas. Print R3-1-pos-migracao.png.
- Parte 2 (servidor em raio 120): local = {whatsapp 11900000000, raio 150}; reload: 0 PUTs; GET inalterado (raio 120, whatsapp 11977776666); chave local removida.
- Restauracao por PUT na API; GET identico ao original (conferido de novo ao final).

## R4 - Mecanico A (PASSOU)
- Barra: Radar do Patio, Ordens de Servico, Clientes & Veiculos, Estoque de Pecas (mobile: Patio/Ordens/Clientes/Estoque). Percorri as 4 e a lista de Clientes (6 clientes, 8 veiculos): todas as respostas 200 (usuarios/me, empresas/, dashboards, os, clientes, veiculos, estoque, `GET /usuarios/<A>/equipe`), 0 erros de console, nenhum 403.
- Seletor `#edit-mecanico` na Bancada (so existe la; Nova OS nao tem): Selecione..., Atendente Teste A (ATENDENTE), Dono Teste A (DONO), Financeiro Teste A (FINANCEIRO), joao (DONO), Mecanico Teste A (MECANICO), Vinici (MECANICO).
- `GET /usuarios/<A>/equipe` via fetch com o token da sessao: 200, 6 itens, chaves = id, nome, email, telefone, cargo, ativo, empresa_id, estrelas_media, total_avaliacoes. Sem salario_base nem colunas de RH.
- Controle: `GET /usuarios/<A>` segue 403 para mecanico (esperado; sonda manual feita apos o percurso).
- ?tab=financeiro/equipe/oficina redirecionam para ?tab=patio.
Prints: R4-Radar.png, R4-Ordens.png, R4-Clientes.png, R4-Estoque.png, R4-bancada-seletor.png.

## R5 - POST 503 seguido de sucesso (PASSOU)
Financeiro (+ Despesa), "F3-R5 teste", valor 1. A cada tentativa: page.route na POST /transacoes-financeiras/ responde 503 so na primeira; a segunda passa. Contagem no backend (data_inicial=2020-01-01, data_final=2030-12-31):
- Tentativa 1: 0 -> 1, 2 POSTs (503 + 200), modal fechou.
- Tentativa 2: 1 -> 2, 2 POSTs.
- Tentativa 3: 2 -> 3, 2 POSTs.
0 writes a rest/v1. Apaguei as 3 pela tela (lixeira > "Sim, Excluir"); contagem final 0 (total de transacoes da empresa 0). Prints R5-1-apos-salvar.png, R5-2-lista-antes-apagar.png.
Nota: a 1a execucao do script usou contador errado (chave da resposta) e apagou 3 linhas pela tela sem contar; repetida com contador correto, resultado acima.

## Problemas / observacoes
1. Abas Oficina e Equipe disparam varios GET duplicados a /empresas/<A>/configuracoes (4-5 por visita) e demoram 2-3 s; reload nesse intervalo gera ERR_ABORTED inofensivo. Sugestao: deduplicar/cachear.
2. Apos falha do autosave (R2) o campo KM continua mostrando o valor nao salvo (so o banner indica o erro; sem rollback do campo).
3. Banner de erro sem role=alert (acessibilidade).
4. Seletor de mecanico lista a equipe inteira (donos, atendente, financeiro), nao so mecanicos.
5. Ja conhecido: o Salvar da tela Oficina grava lat/long geocodificadas (nao reexecutado).

## Estado final
Config da Oficina A igual ao original (conferido por GET). OS TSTA001 inalterada (km null, descricao original). 0 transacoes. Nenhum dado de teste novo no banco (a avaliacao 2a3bbef6-... da rodada anterior continua la; nao tocada).
