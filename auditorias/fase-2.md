# Auditoria do frontend: Fase 2 (RH da tabela `usuarios` só pelo backend)

- **Data/hora:** 2026-11-09, 15:34 a 15:38 (horário local, UTC-3)
- **Auditor:** agente Playwright independente (não alterou código)
- **Ambiente:** frontend Vite em http://localhost:5173, backend em http://localhost:8000/api/v1, Supabase `ylzjuhvbrwcxzvtzwisz` (AutotecDB de **produção**)
- **Navegador:** Chromium 156 (Playwright MCP), viewport estreita (layout mobile, barra de navegação inferior)
- **Usuários:** `dono.a@homolog-autotec.example.com` e `mecanico.a@homolog-autotec.example.com`, senha `<SENHA>` (SEED_SENHA do `.env.test`)
- **Empresa tocada:** só Oficina A, "Oficina do tião" (`94334e9f-629c-4c65-92f8-e26274ba3973`). Nenhum dado da Autotec Racing (`caabdcdd-...`) apareceu na tela, na rede ou no console. Todas as respostas com `empresa_id` traziam só `94334e9f-...`.
- Tokens JWT e a apikey anon aparecem como `<JWT>` / `<ANON_KEY>`.

## Resumo

| Cenário | Resultado | Evidência curta |
|---|---|---|
| F2-UI-1 Regressão de login (DONO A) | **PASSOU** | Pátio carregou sem tela de erro; todos os requests 200; só erro de console = `favicon.ico` 404 |
| F2-UI-2 Equipe com RH pelo backend | **PASSOU** | `GET /api/v1/usuarios/94334e9f-...` → 200 com `salario_base`, comissões, vales e hora extra; nenhum `rest/v1/usuarios` com colunas de RH |
| F2-UI-3 Editar salário pelo backend e restaurar | **PASSOU** | `PUT /api/v1/usuarios/94334e9f-.../df201096-...` → 200; após reload mostra R$ 1.234,56; fetch no backend confirma 1234.56; restaurado para 0 e confirmado |
| F2-UI-4 Limpeza de `autotec_rh_dados_*` | **PASSOU** | Chave criada, reload, `localStorage.getItem('autotec_rh_dados_teste') === null` |
| F2-UI-5 MECÂNICO A: sem aba Equipe, RLS de colunas | **PASSOU** | Sem botão Equipe; `?select=salario_base` → 403 `permission denied for table usuarios`; `?select=nome,cargo` → 200 com 6 pessoas, todas da Oficina A |
| F2-UI-6 MECÂNICO A no backend | **PASSOU** | `GET /api/v1/usuarios/94334e9f-...` → 403 `{"detail":"Acesso negado para o seu perfil."}` |

Salário do "Mecanico Teste A" (`df201096-62a8-49e8-b9bb-bb000244d4e8`): original **0.0**, alterado para 1234.56, **restaurado para 0** (confirmado pelo backend e pela tela).

---

## F2-UI-1: regressão de login (DONO A)

**Passos:** abrir http://localhost:5173 → tela de login → e-mail do dono A + `<SENHA>` → "Entrar no Autotec Pro".

**Resultado:** cabeçalho "Dono Teste A • DONO", tela "Radar do Pátio" com os blocos, sem tela de erro.

**Requests relevantes (todos 200):**
- `POST https://ylzjuhvbrwcxzvtzwisz.supabase.co/auth/v1/token?grant_type=password` → 200
- `GET .../rest/v1/usuarios?select=id,nome,email,telefone,cargo,ativo,empresa_id,estrelas_media,total_avaliacoes&id=eq.f3b95dfc-...` → 200 (sem colunas de RH)
- `GET http://localhost:8000/api/v1/usuarios/me` → 200
- `GET http://localhost:8000/api/v1/empresas/?empresa_id=94334e9f-...` → 200
- `GET .../rest/v1/ordens_servico?...empresa_id=eq.94334e9f-...` → 200; `GET .../rest/v1/estoque?...` → 200

Nenhum 4xx/5xx além do favicon.

**Console:** `[ERROR] Failed to load resource: 404 @ http://localhost:5173/favicon.ico` (já aparece antes do login, sem relação com a fase).

**Screenshot:** `auditorias/fase-2/F2-UI-1-login-dono-a.png`

## F2-UI-2: aba Equipe como DONO A

**Passos:** clicar em "Equipe" na barra de navegação.

**Resultado:** "Equipe & Recursos Humanos, 6 Colaboradores" (Atendente/Dono/Financeiro/Mecanico Teste A, "joao", "Vinici"). Cada card mostra "Salário Base" e "Comissão: x% M.O. • y% Peças". Todos os salários estavam 0 no banco, então a tela mostra "Não informado" (comportamento da UI para 0).

**Requests:**
- `GET http://localhost:8000/api/v1/usuarios/94334e9f-629c-4c65-92f8-e26274ba3973` → **200**. Trecho do corpo:
  `[{"nome":"Atendente Teste A",...,"cargo":"ATENDENTE","ativo":true,"salario_base":0.0,"comissao_servico_pct":0.0,"comissao_peca_pct":0.0,"vale_transporte":0.0,"vale_refeicao":0.0,"paga_hora_extra":false,"valor_hora_extra":0.0,...,"empresa_id":"94334e9f-..."}, ... (6 itens, todos empresa 94334e9f)]`
- `GET /api/v1/equipe/escalas|pontos|avaliacoes/94334e9f-...` → 200
- Todos os requests a `rest/v1/usuarios` na sessão usaram só `select=id,nome,email,telefone,cargo,ativo,empresa_id,estrelas_media,total_avaliacoes`. **Nenhum** select com `salario`, `comissao`, `vale` ou `hora_extra`. Outras leituras REST: `empresas?select=*` e `configuracoes_empresa?select=*` (fora do escopo de RH).

**Observação:** a carga da Equipe é feita **duas vezes** (os requests 47-50 e 52-55 são idênticos). Ver "Problemas fora do escopo".

**Console:** só o favicon 404.

**Screenshot:** `auditorias/fase-2/F2-UI-2-equipe.png`

## F2-UI-3: editar o salário do "Mecanico Teste A"

**Salário original:** `0.0` (campo "Salário Base (R$)" vazio no formulário; backend devolve `"salario_base":0.0`).

**Passos e evidências:**
1. "Editar Colaborador & RH" no card do Mecanico Teste A → digitar `1234.56` no campo Salário Base (é um `input type=number`, aceita ponto; exibido depois como "R$ 1.234,56") → "Salvar Colaborador". Screenshot: `F2-UI-3-form-1234.png`.
2. Request: `PUT http://localhost:8000/api/v1/usuarios/94334e9f-629c-4c65-92f8-e26274ba3973/df201096-62a8-49e8-b9bb-bb000244d4e8` com `Authorization: Bearer <JWT>` → **200**.
   - Corpo enviado: `{"nome":"Mecanico Teste A","telefone":null,"cargo":"MECANICO","salario_base":1234.56,"comissao_servico_pct":0,"comissao_peca_pct":0,"vale_transporte":0,"vale_refeicao":0,"paga_hora_extra":false,"valor_hora_extra":0}`
   - Resposta: `{"nome":"Mecanico Teste A",...,"salario_base":1234.56,...,"id":"df201096-...","empresa_id":"94334e9f-..."}`
   - Não houve nenhum `PATCH`/`POST` em `rest/v1/usuarios` (a gravação foi só pelo backend).
3. Reload de `http://localhost:5173/?tab=equipe`: card mostra **R$ 1.234,56**. Screenshot: `F2-UI-3-apos-reload-1234.png`.
4. Dentro da página: token lido da chave `sb-ylzjuhvbrwcxzvtzwisz-auth-token` (campo `access_token`), `fetch('http://localhost:8000/api/v1/usuarios/94334e9f-...', {Authorization: 'Bearer <JWT>'})` → **200**, `{"id":"df201096-...","salario_base":1234.56,"empresa_id":"94334e9f-..."}`; todos os itens da resposta são da empresa 94334e9f.
5. Restauração pela tela: editar → campo Salário Base = `0` → Salvar. `PUT .../df201096-...` → 200, corpo enviado `{"...","salario_base":0,...}`.
6. Reload + fetch no backend: **200**, `salario_base: 0`; card mostra "Não informado" (igual ao início). Screenshot: `F2-UI-3-restaurado.png`.

**Console:** depois do reload do passo 6 apareceram 4 erros (problema intermitente, fora do escopo):
```
Access to fetch at 'http://localhost:8000/api/v1/equipe/avaliacoes/94334e9f-...' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
Failed to load resource: net::ERR_FAILED @ .../equipe/avaliacoes/94334e9f-...
(o mesmo para .../equipe/pontos/94334e9f-...)
```
Isso aconteceu na **segunda** das duas cargas duplicadas (requests 153/154 FAILED; 148/149 da primeira carga deram 200). Ao repetir os 3 GETs um de cada vez pelo console, todos deram 200. Não afeta o RH nem o resultado do cenário.

**Resultado:** PASSOU.

## F2-UI-4: limpeza de cópias de RH no localStorage

**Passos:**
1. No console: `localStorage.setItem('autotec_rh_dados_teste','{"x":{"salario_base":1}}')` → leitura confirmou o valor; era a única chave `autotec_rh_dados_*`.
2. Reload de `http://localhost:5173/?tab=equipe`.
3. `localStorage.getItem('autotec_rh_dados_teste')` → `null`. Chaves restantes: `autotec_tenant_id`, `sb-ylzjuhvbrwcxzvtzwisz-auth-token`.

**Screenshot:** `auditorias/fase-2/F2-UI-4-localstorage-limpo.png` (a evidência real é o resultado do `evaluate` acima; a chave não aparece na tela).

**Resultado:** PASSOU.

## F2-UI-5: MECÂNICO A sem aba Equipe e bloqueio de RH no Supabase

**Passos:**
1. "Sair da conta" → `POST .../auth/v1/logout?scope=global` → 204.
2. Login com `mecanico.a@...` + `<SENHA>` → cabeçalho "Mecanico Teste A • MECANICO".
3. Barra de navegação: só **Pátio, Ordens, Clientes, Estoque**. Busca no DOM por botões/links com "equipe": nenhum.
4. Abrir `http://localhost:5173/?tab=equipe` direto: o app redireciona para `?tab=patio` ("Radar do Pátio"). Nenhum request a `/api/v1/usuarios/{empresa}` nem `/api/v1/equipe/*`.
5. No console, com `apikey: <ANON_KEY>` (tirada do header de um request a `ylzjuhvbrwcxzvtzwisz.supabase.co`) e `Authorization: Bearer <JWT do mecânico>`:

| Request | Status | Corpo |
|---|---|---|
| `GET .../rest/v1/usuarios?select=salario_base` | **403** | `{"code":"42501","message":"permission denied for table usuarios"}` |
| `GET ...?select=comissao_servico_pct` | 403 | idem |
| `GET ...?select=vale_transporte` | 403 | idem |
| `GET ...?select=valor_hora_extra` | 403 | idem |
| `GET ...?select=*` | 403 | idem |
| `GET ...?select=nome,cargo` | **200** | 6 linhas: joao/DONO, Vinici/MECANICO, Dono Teste A/DONO, Financeiro Teste A/FINANCEIRO, Atendente Teste A/ATENDENTE, Mecanico Teste A/MECANICO |
| `GET ...?select=nome,cargo,empresa_id` | 200 | as mesmas 6 linhas, todas com `empresa_id = 94334e9f-...` (só a Oficina A) |

**Console:** os 403 acima (provocados pelo teste) e o 403 do F2-UI-6. Nenhum erro da própria tela.

**Screenshots:** `F2-UI-5-mecanico-sem-equipe.png` e `F2-UI-6-mecanico-tab-equipe-redireciona.png` (redirecionamento do passo 4).

**Resultado:** PASSOU.

## F2-UI-6: MECÂNICO A no backend

`fetch('http://localhost:8000/api/v1/usuarios/94334e9f-629c-4c65-92f8-e26274ba3973', {Authorization: 'Bearer <JWT do mecânico>'})` → **403**, `{"detail":"Acesso negado para o seu perfil."}`.

**Resultado:** PASSOU.

---

## Problemas fora do escopo da fase 2 (não bloqueiam)

1. **Carga duplicada:** o Pátio e a Equipe disparam todos os requests duas vezes (`ordens_servico`, `estoque`, `usuarios/me`, `empresas`, `usuarios/{empresa}`, `equipe/*`). Provável efeito duplo do React StrictMode em dev ou de um `useEffect` com dependência instável. Verificar se acontece também no build de produção.
2. **Falha intermitente de CORS em `/api/v1/equipe/pontos` e `/equipe/avaliacoes`:** na segunda carga simultânea, o navegador recebeu resposta sem `Access-Control-Allow-Origin` (net::ERR_FAILED). Requests isolados dão 200. Sintoma típico de erro 500 no backend (exceção não tratada sob concorrência) devolvido sem os headers de CORS. Vale ver o log do uvicorn nesse horário (~18:36:03 UTC).
3. **CORS do backend:** as respostas trazem `access-control-allow-origin: *` junto com `access-control-allow-credentials: true`. Hoje não causa vazamento (a autenticação é por header Bearer, não por cookie), mas a configuração está permissiva demais para produção.
4. **URL e título após o login:** depois de entrar, a URL continua com `?modo=login` e o título da aba continua "Entrar — Autotec Pro" até a próxima navegação.
5. **`favicon.ico` 404** no dev server.
6. **UX:** salário 0 aparece como "Não informado", e o formulário mostra o campo vazio. Não dá para distinguir "zero" de "não cadastrado".

## Limitações

- A conferência "no banco" foi feita pelo endpoint do backend (`GET /api/v1/usuarios/{empresa}`), que lê com a service key. Não houve consulta SQL direta.
- O layout testado foi o mobile (viewport estreita). A sidebar desktop não foi inspecionada visualmente, mas a busca no DOM não achou nenhum botão "Equipe" para o mecânico.
- Os arquivos de snapshot do Playwright MCP ficam em `C:\Projects\autotec\.playwright-mcp\`. Um deles guardou o valor do campo de senha; foi redigido para `<SENHA>`.
