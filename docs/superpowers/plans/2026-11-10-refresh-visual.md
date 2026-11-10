# Refresh visual do Mecanify — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o visual navy + sky por Grafite + Âmbar, com tema claro e escuro, em todas as telas, validando cada tela com prints Playwright.

**Architecture:** Tokens de cor em CSS vars (canais RGB) trocados pela classe `dark` no `<html>`, expostos ao Tailwind como cores semânticas. Um codemod troca os 1.167 hex fixos por tokens; depois cada tela é refeita com componentes compartilhados em `src/components/ui`. Playwright roda o app com backend e Supabase simulados por interceptação de rede.

**Tech Stack:** React 18, Vite 6, Tailwind 3.4, TypeScript 5.7, lucide-react, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, Vitest + Testing Library + jsdom, `@playwright/test@1.63.0` (mesma versão do Chromium pré-instalado).

**Spec:** `docs/superpowers/specs/2026-11-10-refresh-visual-design.md` · contexto de produto: `PRODUCT.md`

## Global Constraints

- Valores de cor, status, tipografia, raio e alturas: exatamente os da spec. Sem violeta.
- Pesos 400/500/600 apenas; proibidos `font-extrabold`, `font-black`, `text-[9px]`, `text-[10px]`, `text-[11px]`.
- Nenhum hex fixo em `src/**/*.tsx`, exceto `src/components/ui/PlateChip.tsx` e blocos de impressão (`print:`/janelas de impressão).
- Lógica de negócio e chamadas de API intactas, exceto a folha `ConfirmarPagamento` (Task 8).
- Textos visíveis em pt-BR com acento; nunca enum cru (`EXECUCAO`, `DONO`, `PECAS`) na tela.
- Playwright usa **só** dados simulados. Nunca apontar para o Supabase/backend reais.
- `npm run build` passa ao fim de toda task.
- **Checkpoint de validação:** toda task de tela termina com `npm run prints -- <tela>`, envio dos PNGs ao dono (SendUserFile) e **parada** até a aprovação. Ajustes pedidos entram na mesma task.
- Cada task usa as skills: `impeccable` (ler `reference/craft-floor.md` antes de editar UI) e as regras anti-genérico da `taste-skill` (um estilo de botão, um de card, ≤2 níveis de caixa, alvos ≥44px).

## Review Focus

1. **Tema escuro esquecido:** classe que só funciona no claro (ex.: `text-white` sobre `surface`). Teste: `telas.spec.ts` roda cada tela nos dois temas e checa contraste do `<h1>` e do primeiro botão primário (≥4.5:1).
2. **Preferência de tema:** sem valor salvo, segue `prefers-color-scheme`; com valor salvo, ignora o sistema; sem flash ao carregar. Teste em Task 2 (`tema.spec.ts`).
3. **Listas vazias e listas longas:** Radar sem OS, Estoque sem itens, nome de cliente com 60 caracteres e placa antiga (`ABC1234`). Fixtures `vazio` e `cheio` em Task 1; cada tela é printada com as duas.
4. **390px:** nada de rolagem lateral, barra inferior não cobre o último item. Teste: `scrollWidth <= innerWidth` e último card visível acima da barra, em toda tela.
5. **Pagar sem escolher forma:** botão desabilitado; cancelar não envia PATCH. Teste em Task 8.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `e2e/playwright.config.ts` | sobe `vite` com env simulado, projetos claro/escuro × 1440/390 |
| `e2e/mocks/fixtures.ts` | dados simulados (`cheio`, `vazio`) tipados com `src/types` |
| `e2e/mocks/rede.ts` | `simularBackend(page, cenario)`: intercepta Supabase Auth/REST e API |
| `e2e/mocks/sessao.ts` | `entrarComo(page, cargo, tema)`: grava sessão falsa e tema no `localStorage` |
| `e2e/telas.spec.ts` | cada tela renderiza, sem rolagem lateral, contraste do título |
| `e2e/prints.spec.ts` | gera `prints/<tela>-<tema>-<largura>-<cenario>.png` |
| `src/styles/tokens.css` | CSS vars dos dois temas |
| `src/theme/TemaContext.tsx` | `TemaProvider`, `useTema()` |
| `tailwind.config.js` | cores semânticas, fontes, sombras |
| `scripts/codemod-tokens.mjs` | troca hex/cores Tailwind por tokens |
| `src/components/ui/*.tsx` | primitivos compartilhados |
| `src/components/ConfirmarPagamento.tsx` | folha de pagamento |
| `tests/unit/*.test.ts(x)` | Vitest |

---

### Task 1: Ambiente Playwright com backend simulado + prints de referência

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/mocks/fixtures.ts`, `e2e/mocks/rede.ts`, `e2e/mocks/sessao.ts`, `e2e/telas.spec.ts`, `e2e/prints.spec.ts`
- Modify: `package.json` (scripts + devDeps), `.gitignore` (`prints/`, `test-results/`, `playwright-report/`)

**Interfaces:**
- Produces:
  - `type Cenario = 'cheio' | 'vazio'`
  - `type Tela = 'login' | 'radar' | 'ordens' | 'bancada' | 'clientes' | 'estoque' | 'financeiro' | 'equipe' | 'oficina' | 'avaliacao'`
  - `simularBackend(page: Page, cenario: Cenario): Promise<void>`
  - `entrarComo(page: Page, cargo: CargoUsuario, tema: 'claro' | 'escuro'): Promise<void>`
  - `abrirTela(page: Page, tela: Tela): Promise<void>` (navega para `/?tab=<tab>` e espera `[data-tela-pronta]` ou o `<h1>`)
  - scripts: `npm run e2e`, `npm run prints -- <tela>` (`playwright test e2e/prints.spec.ts --grep <tela>`)

- [ ] **Step 1: Instalar** `@playwright/test@1.63.0` (versão exata) como devDependency. Não rodar `playwright install`. No config, `use.launchOptions.executablePath` só se o Chromium não for achado (`/opt/pw-browsers/chromium`). `trace: 'off'`.
- [ ] **Step 2: Config** — `webServer`: `vite --port 5179 --strictPort` com env `VITE_SUPABASE_URL=http://mock.supabase.local`, `VITE_SUPABASE_ANON_KEY=mock`, `VITE_API_URL=http://mock.api.local/api/v1`. Projetos: `claro-1440` (1440×900), `escuro-1440`, `claro-390` (390×844), `escuro-390`. `deviceScaleFactor: 1` nos testes; 2 no `prints.spec.ts`.
- [ ] **Step 3: Sessão** — `entrarComo` grava em `localStorage['sb-mock-auth-token']` um objeto `{ access_token, refresh_token, token_type: 'bearer', expires_in: 3600, expires_at: <agora + 1 ano>, user: { id, email, ... } }` (JWT falso com `exp` no futuro) e `localStorage['mecanify_tema']`. Antes da Task 2 o tema é ignorado pelo app; tudo bem.
- [ ] **Step 4: Rede** — `simularBackend` intercepta:
  - `http://mock.supabase.local/auth/v1/**` → 200 com o usuário da sessão;
  - `http://mock.supabase.local/rest/v1/usuarios*` → perfil do cargo;
  - `http://mock.api.local/api/v1/**` → roteia pelos 34 caminhos de `src/api/client.ts` (`/usuarios/me`, `/dashboards/{id}`, `/os/?...`, `/os/{e}/{os}/imprimir`, `/clientes/{e}`, `/veiculos/{e}`, `/estoque/...`, `/financeiro/{e}`, `/transacoes-financeiras/...`, `/usuarios/{e}`, `/equipe/escalas/{e}`, `/equipe/avaliacoes/{e}`, `/empresas/?empresa_id=`, configurações); escrita (POST/PATCH/DELETE) responde 200 com o corpo ecoado e guarda a última chamada em `window.__ultimaEscrita` via `page.exposeFunction`;
  - qualquer outra URL externa (`cep.awesomeapi.com.br`, `brasilapi.com.br`, fontes) → `route.abort()` exceto Google Fonts enquanto existir.
  - Rota sem fixture → falha o teste com a URL na mensagem (não 404 silencioso).
- [ ] **Step 5: Fixtures** — `cheio`: 12 OS espalhadas nas 5 etapas (datas de abertura de 0 a 15 dias atrás, uma placa antiga `ABC1234`, um cliente com nome de 60 caracteres), 8 clientes com veículos, 20 itens de estoque (3 abaixo do mínimo), 15 transações, 5 usuários (um por cargo + inativo), configurações da oficina preenchidas. `vazio`: listas vazias, contagens zero. Tipar com `src/types`.
- [ ] **Step 6: Teste que falha** — `telas.spec.ts`, para cada `Tela` × cenário: `await abrirTela(page, tela)`; `expect(page.getByRole('heading', { level: 1 })).toBeVisible()`; `expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)`; sem erros de console. Rodar `npm run e2e` → falha enquanto alguma rota não tem fixture.
- [ ] **Step 7: Completar fixtures** até `npm run e2e` passar (as falhas de rolagem lateral em 390 que já existirem hoje ficam marcadas `test.fail()` com comentário `// corrigido na Task N`).
- [ ] **Step 8: Prints de referência** — `npm run prints` gera o "antes" em `prints/antes/`. Enviar ao dono só a grade 1440 claro/escuro do Radar e Ordens (o resto fica na pasta).
- [ ] **Step 9: Commit** `test(e2e): Playwright com backend simulado e prints de referência`.

---

### Task 2: Tokens, tema claro/escuro, fontes Geist, DESIGN.md

**Files:**
- Create: `src/styles/tokens.css`, `src/theme/TemaContext.tsx`, `tests/unit/contraste.test.ts`, `e2e/tema.spec.ts`, `DESIGN.md`, `vitest.config.ts`
- Modify: `tailwind.config.js`, `src/index.css`, `index.html`, `src/main.tsx`, `package.json`

**Interfaces:**
- Produces:
  - classes Tailwind: `bg|text|border|ring|divide-{canvas,surface,muted,sunken,line,line-strong,ink,ink-muted,ink-subtle,brand,brand-hover,brand-ink,on-brand,danger,success,warning,info,done,danger-solid,success-solid}` com suporte a `/<alpha>`; `font-sans` = Geist Variable, `font-mono` = Geist Mono Variable; `shadow-card`.
  - `TemaProvider`, `useTema(): { tema: 'claro' | 'escuro'; preferencia: 'claro' | 'escuro' | 'sistema'; definir(p): void }`, chave `localStorage['mecanify_tema']`.

- [ ] **Step 1: Teste de contraste que falha** — `contraste.test.ts` lê `src/styles/tokens.css`, extrai `--c-*` de `:root` e `.dark`, e afirma para os dois temas: `ink`, `ink-muted`, `brand-ink`, `danger`, `success`, `warning`, `info`, `done` ≥ 4.5 sobre `canvas`, `surface`, `muted`; `ink-subtle` ≥ 4.5 sobre `surface`; `line-strong` ≥ 3 sobre `sunken` e `surface`; `on-brand` sobre `brand` ≥ 4.5; `#FFFFFF` sobre `danger-solid` e `success-solid` ≥ 4.5. Rodar `npx vitest run tests/unit/contraste.test.ts` → FAIL (arquivo não existe).
- [ ] **Step 2: `tokens.css`** com os valores da spec como canais (`--c-canvas: 241 237 228;`). Seleção de texto, caret, scrollbar e anel de foco (3px `brand`) temados aqui. Rodar o teste → PASS.
- [ ] **Step 3: Tailwind** — cores semânticas `rgb(var(--c-x) / <alpha-value>)`; **remover** o `slate` remapeado e o bloco `mecanify`; `fontFamily` Geist; `boxShadow.card`. Fontes via `@fontsource-variable/geist` e `@fontsource-variable/geist-mono` importadas em `main.tsx`; tirar o link do Google Fonts do `index.html`.
- [ ] **Step 4: Teste de tema que falha** — `tema.spec.ts`: (a) sem chave salva + `colorScheme: 'dark'` → `<html>` tem `dark`; (b) chave `claro` + `colorScheme: 'dark'` → sem `dark`; (c) `<html>` já tem a classe certa no primeiro `DOMContentLoaded` (sem flash). → FAIL.
- [ ] **Step 5: Tema** — script inline no `<head>` do `index.html` aplica a classe antes do React; tirar `class="dark"`, `style="color-scheme: dark"` e as classes hex do `<body>` (usar `bg-canvas text-ink`); `theme-color` com duas metas por `media`. `TemaProvider` em `main.tsx`. → PASS.
- [ ] **Step 6: DESIGN.md** na raiz, gerado pelo fluxo `impeccable document` a partir da spec (tokens, status, tipografia, forma, componentes). Uma fonte de verdade: a tabela de tokens aponta para `tokens.css`.
- [ ] **Step 7:** `npm run build` passa (telas ainda feias: hex fixos continuam). Commit `feat(tema): tokens grafite+âmbar, tema claro/escuro e Geist`.

---

### Task 3: Codemod — hex e cores Tailwind viram tokens

**Files:**
- Create: `scripts/codemod-tokens.mjs`, `tests/unit/codemod.test.ts`, `tests/unit/sem-hex.test.ts`
- Modify: todos os `src/**/*.tsx`, `src/index.css`

**Interfaces:**
- Produces: `transformar(fonte: string): string` (exportado de `scripts/codemod-tokens.mjs`); CLI `node scripts/codemod-tokens.mjs src`.

- [ ] **Step 1: Testes que falham** — `codemod.test.ts` com pares entrada→saída:

  | entrada | saída |
  |---|---|
  | `bg-[#071226]` | `bg-sunken` |
  | `bg-[#0B1B36]` / `bg-[#12274D]` | `bg-surface` |
  | `hover:bg-[#12274D]` | `hover:bg-muted` |
  | `border-[#264577]` | `border-line` |
  | `border-[#3A5C90]` / `text-[#3A5C90]` | `border-line-strong` / `text-ink-subtle` |
  | `bg-[#38BDF8] text-[#071226]` | `bg-brand text-on-brand` |
  | `hover:bg-[#0EA5E9]` | `hover:bg-brand-hover` |
  | `text-[#38BDF8]` / `border-[#38BDF8]` / `ring-[#38BDF8]` | `text-brand-ink` / `border-brand` / `ring-brand` |
  | `bg-[#2563EB]`, `bg-[#1D4ED8]`, `bg-[#1E3A8A]`, `bg-[#172554]` | `bg-muted` (e `text-white` na mesma string → `text-ink`) |
  | `text-white` (fora de `bg-*-solid`/`bg-brand`) | `text-ink` |
  | `text-slate-200` / `-300` | `text-ink` / `text-ink-muted` |
  | `text-slate-400` / `-500` / `-600` | `text-ink-subtle` |
  | `(text\|bg\|border\|ring)-(red\|rose)-\d+(/\d+)?` | `$1-danger$2` |
  | `(…)-(emerald\|green)-\d+(/\d+)?` | `$1-success$2` |
  | `(…)-(amber\|yellow\|orange)-\d+(/\d+)?` | `$1-warning$2` |
  | `(…)-(blue\|sky\|indigo)-\d+(/\d+)?` | `$1-info$2` |
  | `(…)-teal-\d+` | `$1-done` |
  | `bg-(red\|emerald\|green)-(500\|600\|700)` sem `/` | `bg-danger-solid` / `bg-success-solid` |
  | `font-extrabold`, `font-black` | `font-semibold` |
  | `font-bold` | `font-semibold` |
  | `text-[9px]`, `text-[10px]`, `text-[11px]` | `text-xs` |
  | `rounded-2xl`, `rounded-3xl` | `rounded-lg` |

  `purple-*` → falha o teste com a linha (decidir à mão: vira `info` ou `muted`). Classes dentro de `print:` ou de strings de HTML de impressão não mudam.
  `sem-hex.test.ts`: nenhum `\[#[0-9a-fA-F]{3,8}\]` nem `#[0-9a-fA-F]{6}` em `src/**/*.tsx` fora da lista de exceções da spec. → FAIL.
- [ ] **Step 2: Implementar `transformar`** como lista ordenada de regex (mais específica primeiro). Rodar `codemod.test.ts` → PASS.
- [ ] **Step 3: Aplicar** `node scripts/codemod-tokens.mjs src`; resolver à mão o que sobrar até `sem-hex.test.ts` passar.
- [ ] **Step 4:** `npm run build` e `npm run e2e` passam. `npm run prints` (todas as telas, cenário `cheio`). Enviar ao dono 4 prints (Radar e Ordens, claro/escuro, 1440) avisando: "tema aplicado no app todo; acabamento vem tela por tela".
- [ ] **Step 5: Commit** `refactor(cores): codemod de hex para tokens semânticos`.

---

### Task 4: Componentes compartilhados

**Files:**
- Create: `src/components/ui/{Button,Panel,PageHeader,StatusBadge,Badge,Field,Tabs,PlateChip,Skeleton,ThemeToggle,BrandMark}.tsx`, `src/components/ui/index.ts`, `src/components/ui/status.ts`, `tests/unit/ui.test.tsx`, `public/favicon.svg`

**Interfaces:**
- Produces:
  - `Button(props: ButtonHTMLAttributes & { variante?: 'primario' | 'secundario' | 'fantasma' | 'perigo'; tamanho?: 'sm' | 'md'; icone?: LucideIcon; carregando?: boolean })`
  - `Panel({ as?, className?, children })` — `bg-surface rounded-lg shadow-card dark:shadow-none`
  - `PageHeader({ titulo: string; acoes?: ReactNode })` — renderiza `<h1>` e atualiza `document.title` para `${titulo} · Mecanify`
  - `STATUS_OS: Record<StatusOS, { rotulo: string; icone: LucideIcon; classe: string }>` em `status.ts`; `StatusBadge({ status: StatusOS })`
  - `Field({ rotulo: string; erro?: string; dica?: string; children: ReactElement })` — liga `id`, `aria-describedby`, `aria-invalid`
  - `Tabs({ itens: { id: string; rotulo: string; icone?: LucideIcon }[]; ativo: string; aoMudar(id): void; rotuloGrupo: string })`
  - `PlateChip({ placa: string })` — aceita `ABC1D23` e `ABC1234`, exibe com hífen só no formato antigo
  - `Skeleton({ linhas?: number; className? })`, `ThemeToggle()`, `BrandMark({ tamanho?: number })`

- [ ] **Step 1: Testes que falham** (`ui.test.tsx`, Testing Library):
  - `StatusBadge` de cada status mostra o rótulo da spec (`'AGUARDANDO_PECA'` → "Aguardando peça") e nenhum texto em caixa alta de enum.
  - `Tabs`: aba ativa tem `aria-selected="true"`, as outras `"false"`; seta → move o foco; `Enter` chama `aoMudar`.
  - `Field` com `erro="Placa inválida"`: input tem `aria-invalid="true"` e `aria-describedby` apontando para o texto do erro.
  - `PlateChip` com `"abc1234"` mostra `ABC-1234`; com `"TST1A01"` mostra `TST1A01`.
  - `Button carregando` fica `disabled` e com `aria-busy="true"`.
  - `PageHeader titulo="Estoque"` define `document.title === 'Estoque · Mecanify'`.
  → `npx vitest run tests/unit/ui.test.tsx` FAIL.
- [ ] **Step 2: Implementar** os componentes com os tokens e medidas da spec. `BrandMark`: SVG próprio (chave combinada estilizada dentro de um quadrado âmbar `rounded-md`), também em `public/favicon.svg`. → PASS.
- [ ] **Step 3:** build passa. Commit `feat(ui): componentes compartilhados do novo visual`.

---

### Task 5: Shell — menu lateral, barra inferior, troca de tema ✅ checkpoint

**Files:**
- Modify: `src/App.tsx` (shell, linhas ~230–460; remover a tela morta "MVP 3" ~403–424)
- Test: `e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `BrandMark`, `ThemeToggle`, `useTema`, `PageHeader` (Task 2, 4)

- [ ] **Step 1: Teste que falha** — `shell.spec.ts`: item ativo do menu tem `aria-current="page"`; menu lateral mede 240px a 1440; cada link do menu ≥40px de altura; a 390, a barra inferior tem ≤5 botões, cada um ≥44px, e "Mais" abre a lista do resto; "Sair" é um botão `fantasma`, não `perigo`; cargo aparece como "Dono" (não "DONO"); `ThemeToggle` alterna a classe `dark`.
- [ ] **Step 2: Implementar** conforme a spec (menu 240px, linhas 40px, ativo `bg-muted` + barra âmbar 2px + `aria-current`, cartão do usuário compacto, `ThemeToggle` no rodapé do menu e no "Mais" do mobile; `document.title` vem do `PageHeader`). Trocar a chave `autotec_tenant_id` só se tiver migração (ler a antiga, gravar a nova); senão, não mexer.
- [ ] **Step 3:** `npm run e2e` passa. `npm run prints -- shell` (Radar como fundo, 4 variações).
- [ ] **Step 4: Checkpoint** — enviar prints ao dono e **parar** até aprovar.
- [ ] **Step 5: Commit** `feat(shell): menu lateral e barra inferior no novo visual`.

---

### Task 6: Login, criar conta, recuperar senha ✅ checkpoint

**Files:** Modify `src/pages/Login.tsx` · Test `e2e/login.spec.ts`

- [ ] **Step 1: Teste que falha** — a 390, o campo de e-mail está visível sem rolar (`boundingBox().y + height <= 844`); abas Entrar/Criar conta usam `Tabs` (`aria-selected`); todos os campos com rótulo visível; erro de senha aparece sob o campo (`aria-describedby`).
- [ ] **Step 2: Implementar** — painel de apresentação só ≥1024px (à esquerda, `canvas` com `BrandMark` grande e a frase atual "Controle total do pátio no celular ou na bancada"; sem cards de ícone empilhados: três linhas de texto com ícone inline); no mobile, marca pequena no topo e formulário logo abaixo. Aqui vale a `taste-skill` por inteiro no painel de apresentação (sem legenda sob imagem, sem kicker, uma ação principal).
- [ ] **Step 3:** testes passam. `npm run prints -- login` (entrar, criar conta, recuperar; claro/escuro; 1440/390).
- [ ] **Step 4: Checkpoint** — enviar e parar.
- [ ] **Step 5: Commit** `feat(login): novo visual e formulário no topo no mobile`.

---

### Task 7: Radar do Pátio como quadro do pátio ✅ checkpoint

**Files:**
- Modify: `src/pages/DashboardOperacional.tsx`
- Create: `src/pages/radar/diasNaEtapa.ts`, `tests/unit/diasNaEtapa.test.ts` · Test `e2e/radar.spec.ts`

**Interfaces:**
- Produces: `diasDesde(dataISO: string, agora?: Date): number`; `nivelAtraso(status: StatusOS, dias: number): 'ok' | 'atencao' | 'atrasado'` (`ORCAMENTO`/`AGUARDANDO_PECA`: >3 → atencao, >7 → atrasado; demais sempre `ok`).

- [ ] **Step 1: Testes que falham** — `diasDesde('2026-11-07T10:00:00Z', new Date('2026-11-10T09:00:00Z')) === 2`; `nivelAtraso('AGUARDANDO_PECA', 4) === 'atencao'`; `nivelAtraso('AGUARDANDO_PECA', 8) === 'atrasado'`; `nivelAtraso('EXECUCAO', 30) === 'ok'`. E2E: 4 colunas com `role="region"` e `aria-label` = rótulo da etapa; cada card mostra placa, "aberta há N dias"; card atrasado tem texto "Atrasado" (não só cor); cenário `vazio` mostra estado vazio com ação "Nova ordem de serviço"; no topo, exatamente 3 números.
- [ ] **Step 2: Implementar** `diasNaEtapa.ts` → PASS. Depois a tela: lanes com rolagem horizontal própria no mobile (sem rolar a página), `PlateChip`, `StatusBadge`, clique abre a OS (comportamento atual). Remover a linha de 5 tiles duplicada e o "0 pagas".
- [ ] **Step 3:** testes passam. `npm run prints -- radar` (cheio e vazio).
- [ ] **Step 4: Checkpoint** — enviar e parar.
- [ ] **Step 5: Commit** `feat(radar): quadro do pátio com dias em aberto`.

---

### Task 8: Ordens de Serviço (lista + bancada) e confirmação do Pago ✅ checkpoint

**Files:**
- Modify: `src/pages/OrdensServico.tsx` (lista; bancada; `mudarStatus` ~620–670; stepper ~2050–2075)
- Create: `src/components/ConfirmarPagamento.tsx` · Test `e2e/ordens.spec.ts`

**Interfaces:**
- Produces: `ConfirmarPagamento({ aberto: boolean; total: number; aoConfirmar(forma: string): void; aoCancelar(): void })`. Opções = a constante existente `FORMAS_PAGAMENTO` (`OrdensServico.tsx:151`: `'PIX'`, `'Cartão de Crédito'`, `'Cartão de Débito'`, `'Dinheiro'`, `'Boleto / Faturado'`), exportada para reuso. A folha abre **sem** opção marcada, mesmo que `editFormaPagamento` tenha valor.
- Consumes: `api.atualizarOS` (sem mudança)

- [ ] **Step 1: Testes que falham** — clicar "Pago" no stepper abre `role="dialog"` com o total da OS; "Confirmar pagamento" `disabled` até escolher; escolher "Dinheiro" e confirmar → `window.__ultimaEscrita` é `PATCH` com `{ status: 'PAGO', forma_pagamento: 'Dinheiro' }`; "Cancelar" e `Escape` fecham sem escrita; mensagem de sucesso diz "Ordem marcada como paga", nunca `PAGO`; na lista a 390 o botão de avançar etapa existe.
- [ ] **Step 2: Implementar** `ConfirmarPagamento` com `<dialog>` nativo (Esc de graça), opções como botões de rádio grandes (≥44px). Remover o fallback `|| 'PIX'` de `mudarStatus`; o caminho `PAGO` passa pela folha. Mensagens de etapa usam `STATUS_OS[status].rotulo`.
- [ ] **Step 3: Visual** — lista: linhas em um `Panel` com `divide-line` (não um card por OS), `PlateChip`, `StatusBadge`, total `tabular-nums`, ação primária única por linha (avançar etapa), WhatsApp `fantasma` com ícone; bancada: stepper com `aria-current="step"`, abas de item com `Tabs`, resumo financeiro à direita ≥1024 e abaixo no mobile; ações de topo (WhatsApp, Imprimir) também numa barra fixa inferior no mobile.
- [ ] **Step 4:** testes passam. `npm run prints -- ordens bancada` (+ folha aberta).
- [ ] **Step 5: Checkpoint** — enviar e parar.
- [ ] **Step 6: Commit** `feat(os): novo visual e confirmação de pagamento obrigatória`.

---

### Tasks 9–13: demais telas ✅ checkpoint em cada uma

Mesmo ciclo em cada task: **teste e2e que falha → implementar → testes passam → `npm run prints -- <tela>` → enviar e parar → commit `feat(<tela>): novo visual`**. Todas usam `PageHeader`, `Panel`, `Button`, `Field`, `Tabs`, `Badge`; nenhuma tem mais de 4 ações visíveis por linha (o resto vai num menu `MoreHorizontal` com `aria-label`).

| Task | Arquivo | O que o teste afirma (além do padrão) | Pontos do visual |
|---|---|---|---|
| 9 Clientes & Veículos | `src/pages/ClientesVeiculos.tsx` | cada card de cliente tem ≤4 botões visíveis; veículos com `PlateChip` | cliente como linha expansível, veículos aninhados por divisor |
| 10 Estoque | `src/pages/Estoque.tsx` | botões de ícone têm `aria-label` ("Registrar entrada", "Registrar saída", "Editar", "Excluir"); chips de categoria mostram "Peças", "Elétrica" (com acento); a 390 cada ação ≥44px | tabela densa ≥1024 (padrão `ant`), cards no mobile; etiqueta impressa intacta |
| 11 Caixa & Financeiro | `src/pages/Financeiro.tsx` | abas com `aria-selected`; ≤6 controles antes do primeiro número; "Lucro líquido" com rótulo do período | período num único seletor (`select` com predefinições + datas sob "Personalizado"); receita `success`, despesa `danger`, sempre com sinal +/− |
| 12 Equipe & RH | `src/pages/Equipe.tsx` | carregando mostra `Skeleton`, não área vazia; estrelas da avaliação com `aria-label="N de 5"`; holerite impresso intacto | lista de pessoas com cargo legível ("Mecânico") |
| 13 Dados da Oficina | `src/pages/Oficina.tsx` | carregando mostra `Skeleton` nos campos; campos agrupados em seções com `<h2>` | seções: Identificação, Endereço, Pagamento (PIX), Ponto (GPS) |

---

### Task 14: Avaliação pública + impressões ✅ checkpoint

**Files:** Modify `src/pages/AvaliacaoPublicaOS.tsx`; conferir janelas de impressão em `OrdensServico.tsx`, `Equipe.tsx`, `Estoque.tsx` · Test `e2e/avaliacao.spec.ts`, `e2e/impressao.spec.ts`

- [ ] **Step 1: Testes que falham** — estrelas são `radio` com `aria-label="1 estrela"`…`"5 estrelas"`, ≥44px; sem card dentro de card; impressão (`page.emulateMedia({ media: 'print' })`) da OS, holerite e etiqueta: fundo branco e texto preto (cor computada `rgb(0, 0, 0)` no corpo).
- [ ] **Step 2: Implementar** — avaliação: marca no topo (sem tile de ícone sobre o título), um bloco só, `hover:scale-110` (classe válida). Impressões: só garantir que tokens não vazaram (cores fixas preto/branco dentro dos blocos de impressão).
- [ ] **Step 3:** testes passam; prints de avaliação (claro/escuro, 390/1440) e PDFs de impressão (`page.pdf`) convertidos em PNG da 1ª página.
- [ ] **Step 4: Checkpoint** — enviar e parar.
- [ ] **Step 5: Commit** `feat(avaliacao): novo visual; impressões conferidas`.

---

### Task 15: Polimento final e nova crítica

- [ ] **Step 1:** `/impeccable polish` em todas as telas; `impeccable detect --json` nas telas renderizadas (dev server com mocks) → zero `warning`.
- [ ] **Step 2:** `/impeccable critique` de novo (dois subagentes) → meta ≥ 28/40. Abaixo disso, corrigir os P1 e repetir uma vez.
- [ ] **Step 3:** `taste-skill` gate: `node ~/.claude/skills/taste-skill/scripts/gate.mjs --done "app interno; gate de site institucional não se aplica além do login"` e registrar o resultado.
- [ ] **Step 4:** `npm run build`, `npx vitest run`, `npm run e2e` passam. Grade final de prints (todas as telas, 4 variações) enviada ao dono.
- [ ] **Step 5: Commit** `chore: polimento final do refresh visual` e push.
