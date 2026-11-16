# Auditoria — senha inicial obrigatória no "Novo colaborador"

Data: 2026-11-11 · Auditor independente · Alteração não commitada em `src/pages/Equipe.tsx`, `e2e/equipe.spec.ts`, `.gitattributes`.

Ambiente: Playwright com `e2e/pw.local.config.ts` (Chromium local, sem download), Vite na porta 5179, API e Supabase 100% simulados (`simularBackend`, hosts `mock.*.local`). Nenhum backend nem credencial real. Projetos: claro-1440, escuro-1440, claro-390, escuro-390. Escritas capturadas via `window.__ultimaEscrita` do mock.

## O que mudou (git diff)

- Novo colaborador sem senha → `setErroForm('Defina a senha inicial do colaborador (mínimo 6 caracteres).')` e `return` antes de qualquer chamada.
- `senha: formSenha || 'Autotec@123'` → `senha: formSenha.trim()`.
- Rótulo `Senha inicial` → `Senha inicial *` (edição continua "Nova senha (deixe vazio para manter)").
- `.gitattributes`: `*.mjs text eol=lf`.
- `e2e/equipe.spec.ts`: novo teste "novo sem senha inicial…" e preenchimento de senha no teste de erro ao salvar.

## Cenários

### 0. Suíte existente `e2e/equipe.spec.ts`
- Feito: `npx playwright test -c e2e/pw.local.config.ts e2e/equipe.spec.ts` (4 projetos).
- Esperado: tudo verde.
- Observado: **142 passed, 6 skipped** (skips são `test.skip(largura >= 1024, 'só celular')`, pré-existentes), 4,1 min.
- Resultado: **OK**

### 1. Novo sem senha → erro, sem POST
- Feito: abrir "Novo colaborador", preencher nome e e-mail, senha vazia, "Salvar colaborador".
- Observado (4 projetos): `role=alert` dentro do diálogo com "Defina a senha inicial do colaborador (mínimo 6 caracteres)."; diálogo continua aberto; `__ultimaEscrita` = `undefined` após 500 ms (nenhum POST).
- Extra: senha só com espaços (`"     "`) → mesmo alerta, sem POST.
- Esperado: alerta contendo "senha inicial" e nenhuma escrita.
- Resultado: **OK**

### 2. Novo com `"  segredo1  "` → senha aparada
- Observado (4 projetos): `POST /usuarios/11111111-1111-4111-8111-111111111111` com `senha="segredo1"`; diálogo fecha.
- Esperado: `corpo.senha === "segredo1"`.
- Resultado: **OK**

### 3. Novo com senha de 5 caracteres (`abcde`) → erro, sem POST
- Observado (4 projetos): alerta "A nova senha deve ter no mínimo 6 caracteres."; nenhuma escrita.
- Esperado: erro de mínimo 6, sem POST.
- Resultado: **OK** (obs.: o texto diz "A nova senha…" também na criação; é a mensagem antiga, apenas cosmética.)

### 4. Editar com senha vazia → PUT sem `senha`
- Feito: menu de Tiago › Editar colaborador; rótulo "Nova senha (deixe vazio para manter)", campo vazio; altera nome; salvar.
- Observado (4 projetos): `PUT /usuarios/11111111-…/00000002-0000-4000-8000-000000000004`, chaves do corpo: `nome, telefone, cargo, salario_base, comissao_servico_pct, comissao_peca_pct, vale_transporte, vale_refeicao, paga_hora_extra, valor_hora_extra` — sem `senha`; diálogo fecha.
- Extra: edição com senha `abcde` → alerta "mínimo 6 caracteres", nenhuma escrita.
- Esperado: PUT/PATCH sem `senha`; senha curta ainda rejeitada.
- Resultado: **OK**

### 5. Acessibilidade e temas (claro/escuro × 1440/390)
- Observado: rótulo visível "Senha inicial *" e campo acessível por `getByLabel('Senha inicial *')` (associação label↔input ok); erro exposto como `role=alert` e visível nos 4 projetos. Contraste do alerta legível em ambos os temas (ver capturas).
- Capturas do estado de erro a 390 px:
  - `auditorias/senha-convite/erro-sem-senha-claro-390.png`
  - `auditorias/senha-convite/erro-sem-senha-escuro-390.png`
- Resultado: **OK**

### 6. Busca por `Autotec@123`
- `grep -rn "Autotec@123" src` → nenhuma ocorrência.
- Única ocorrência no repo: `dist/assets/index-CBygnqPB.js` (build antigo; `dist/` está no `.gitignore`, não versionado). Some no próximo build.
- Resultado: **OK**

## Limpeza
- Spec temporária `e2e/auditoria-senha.tmp.spec.ts` (24 testes, 24 passed) apagada. `src/` não foi tocado. Nada commitado.
- Não verificado: comportamento do backend real quando recebe senha (fora do escopo; só mocks).

**Veredito: APROVADO — 0 falhas (suíte existente 142/142, auditoria própria 24/24).**
