# Auditoria do frontend com agente Playwright

Prompt-base para o agente que audita cada fase do `PLANO_CORRECAO.md`. O agente auditor nunca é o mesmo que
implementou a mudança.

## Regras inegociáveis

- O banco é o **AutotecDB de produção**. Só existem dados de homologação nas empresas com `empresa_teste = true`:
  - Oficina A = **Oficina do tião** (`94334e9f-629c-4c65-92f8-e26274ba3973`)
  - Oficina B = **TETECA** (`b763e7f1-e35b-4aa4-baa8-c8d586caf705`)
- **Autotec Racing (`caabdcdd-f537-42a6-8db1-35cb02257284`) é cliente real.** Se qualquer dado dela aparecer na
  tela, na rede ou no console: pare a auditoria e reporte. Nunca crie, edite ou apague nada fora de A e B.
- Logar só com os usuários do seed: `<cargo>.<a|b>@homolog-autotec.example.com` (cargos `dono`, `financeiro`, `atendente`,
  `mecanico`). A senha é `SEED_SENHA` do `backend-oficina-main/.env.test` — nunca escrever a senha no relatório.
- Antes de conferir algo no banco, confirmar que o `empresa_id` alvo tem `empresa_teste = true`.

## Ambiente

1. Backend: `cd backend-oficina-main && python -m tests.seed && uvicorn main:app --port 8000`
   (com `.env` contendo `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`).
2. Frontend: copiar `.env.test.example` para `.env.local` e rodar `npm run dev`.

## Como auditar

1. Rodar só os cenários da fase pedida (tabela da seção 7 do plano) + a regressão **R**.
2. Para cada cenário: passos, screenshot, requisições de rede relevantes, erros de console.
3. Conferir **no banco** que o efeito esperado aconteceu — mensagem de sucesso na tela não basta.
4. Relatório em `auditorias/fase-N.md`: cenário → PASSOU/FALHOU → evidência. Qualquer FALHOU bloqueia a fase.
