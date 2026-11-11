# Tour guiado por página e central de ajuda — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (um único agente, tarefa por tarefa; sem subagentes por tarefa). Steps usam checkbox (`- [ ]`).

**Goal:** Tour passivo de 3 a 5 passos por página (primeira visita) e aba "Ajuda" com 7 guias ilustrados por prints gerados por script.

**Architecture:** Estado "já viu" em `user_metadata` do Supabase Auth com espelho em `localStorage` (sem backend). Motor de tour próprio (`src/tour/`), elementos marcados com `data-tour`. Ajuda como nova aba do modelo de navegação existente (`?tab=ajuda&guia=...`). Prints e caixas de anotação gerados por um spec Playwright com os mocks atuais.

**Tech Stack:** React 18, TypeScript, Tailwind (tokens do projeto), Supabase Auth (`updateUser`), Playwright e Vitest existentes. **Nenhuma dependência nova.**

**Spec:** `docs/superpowers/specs/2026-11-11-tour-e-ajuda-design.md`

## Global Constraints

- Nenhuma mudança de backend, API ou banco; única escrita nova é `supabase.auth.updateUser`.
- Tour passivo: nunca dispara cliques nem escritas na tela por trás.
- Tokens do projeto apenas (sem hex); pesos 400/500/600; texto ≥ 12 px; alvos ≥ 44 px no celular; os dois temas.
- Textos em pt-BR, frases curtas, só a primeira letra maiúscula; tour e guias só falam de elementos que o cargo vê.
- Prints só com os dados fictícios dos mocks; imagens em JPEG comprimido (qualidade ~82, ≤ 150 KB cada, total ≤ 4 MB), `loading="lazy"`, fora do bundle JS.
- Rodar só os specs afetados a cada tarefa; suíte completa (`npm run build`, `npx vitest run`, `npm run e2e`) uma vez na Tarefa 7.
- Um commit por tarefa, com o rodapé de coautoria padrão do projeto. `git add` nunca inclui `.superpowers/`.

## Review Focus

1. **`updateUser` sobrescreve metadados existentes** (ex.: nome): enviar sempre o objeto `tours` completo e provar que as outras chaves da conta continuam. Teste na Tarefa 1.
2. **Tour abrindo por cima de outra camada** (folha, diálogo, menu "Mais"): não inicia se houver `dialog[open]`. Teste na Tarefa 2.
3. **Tela muda durante o tour** (redimensionar, recarregar dados, elemento some): reposiciona; se o alvo some, pula o passo. Teste na Tarefa 2.
4. **Duas páginas montam em sequência** (navegação rápida) e **StrictMode** (efeito duplo): só um tour por vez, nunca iniciado duas vezes. Teste na Tarefa 2.
5. **Outro usuário no mesmo aparelho**: espelho local por `userId`; a conta A ter visto não afeta a conta B. Teste na Tarefa 1.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/tour/estado.ts` | Funções puras do estado "já viu" + espelho local |
| `src/tour/TourProvider.tsx` | Contexto: estado, tour ativo, ações; grava na conta |
| `src/tour/useTourDaPagina.ts` | Gatilho automático da página (regras de início) |
| `src/tour/posicao.ts` | `posicionarCartao` (puro) e `passosVisiveis` |
| `src/tour/CartaoTour.tsx` | Fundo recortado + anel + cartão acessível |
| `src/tour/passos/{radar,ordens,clientes,estoque,financeiro}.ts` | Definições dos tours |
| `src/ajuda/guias/*.ts` + `index.ts` | 7 guias (dados) |
| `src/ajuda/AjudaPage.tsx`, `Guia.tsx`, `ImagemAnotada.tsx`, `busca.ts` | Aba Ajuda |
| `src/ajuda/anotacoes.json` | Caixas (em %) geradas pelo script |
| `src/components/ui/BotaoAjuda.tsx` | Botão "?" do cabeçalho (menu: refazer tour / ver guias) |
| `e2e/ajuda/roteiros.ts`, `e2e/ajuda/prints.spec.ts` | Geração de prints e `--check` |
| `e2e/tour.spec.ts`, `e2e/ajuda.spec.ts`, `e2e/ajuda-integridade.spec.ts` | Testes |
| `public/ajuda/<guia>/<n>.jpg` | Prints limpos |

---

### Task 1: Estado "já viu" (sem backend)

**Files:** Create `src/tour/estado.ts`, `tests/unit/tourEstado.test.ts`. Modify `e2e/mocks/rede.ts` (responder `PUT /auth/v1/user` ecoando `user_metadata` mesclado e registrando a escrita em `window.__ultimaEscrita`).

**Interfaces — Produces:**
```ts
export type TourMeta = { tours: Record<string, number>; tours_pular_todos?: boolean };
export function lerEstado(userMeta: unknown, espelho: TourMeta | null): TourMeta; // une conta + espelho (maior versão vence; pular_todos = OU)
export function jaViu(m: TourMeta, id: string, versao: number): boolean;
export function comVisto(m: TourMeta, id: string, versao: number): TourMeta;
export function comPularTodos(m: TourMeta): TourMeta;
export function carregarEspelho(userId: string): TourMeta | null;   // localStorage `mecanify_tours_<userId>`, try/catch
export function salvarEspelho(userId: string, m: TourMeta): void;
```

- [ ] **Step 1: testes (RED)** `tourEstado.test.ts`: `lerEstado(undefined, null)` → `{tours:{}}`; metadados lixo (`'x'`, `{tours:'a'}`) → vazio; `jaViu` falso para versão maior que a vista e verdadeiro para igual/menor; `comVisto` não muta o original; `lerEstado` une conta `{radar:1}` com espelho `{ordens:1}` e `pular_todos`; espelhos de `userId` diferentes não se misturam; `localStorage` lançando erro → `null` sem quebrar.
- [ ] **Step 2: rodar** `npx vitest run tests/unit/tourEstado.test.ts` → FAIL.
- [ ] **Step 3: implementar** `estado.ts` (funções puras; validação defensiva de tipos).
- [ ] **Step 4: rodar** o mesmo comando → PASS.
- [ ] **Step 5: commit** `feat(tour): estado já-viu com espelho local por usuário`.

### Task 2: Motor do tour

**Files:** Create `src/tour/{posicao.ts,CartaoTour.tsx,TourProvider.tsx,useTourDaPagina.ts}`, `tests/unit/tourPosicao.test.ts`, `e2e/tour.spec.ts`. Modify `src/App.tsx` (envolver o app com `TourProvider` dentro de `AuthProvider`).

**Interfaces — Consumes:** Task 1. **Produces:**
```ts
export type PassoTour = { id: string; alvo: string; titulo: string; texto: string; opcional?: boolean };
export type TourDef = { id: string; versao: number; passos: PassoTour[] };
export function passosVisiveis(def: TourDef, doc: Document): PassoTour[];  // alvo existe, rect > 0, não oculto
export function posicionarCartao(alvo: {top:number;left:number;width:number;height:number},
  vp: {w:number;h:number}, celular: boolean, barraH: number): { top: number; left: number; modo: 'abaixo'|'acima'|'base' };
export function useTourDaPagina(def: TourDef, pronto: boolean): void;   // inicia sozinho se as regras permitirem
export function useTour(): { ativo: TourDef | null; refazer(def: TourDef): void; pularTodos(): void; };
export const TOURS_ATIVOS = true;   // src/tour/config.ts: interruptor de segurança
```

Regras de início (`useTourDaPagina`): `TOURS_ATIVOS && pronto && autenticado && !pular_todos && !jaViu && !document.querySelector('dialog[open]')`, atraso de 400 ms, cancela ao desmontar/trocar de página, no máximo um tour ativo; marca como visto ao concluir, pular ou fechar (qualquer saída). Sem passos visíveis → marca como visto sem aparecer.

Visual/acessibilidade: fundo escurecido com recorte (clip-path) e anel `brand`; cartão `surface` rounded-2xl, "Passo X de Y", Voltar/Próximo (primário âmbar), "Pular todos os tours"; `role="dialog"`, `aria-labelledby`/`aria-describedby`, foco preso e devolvido, Esc pula a página, região viva "Passo X de Y", fundo inerte; no celular o cartão fica na base acima de `--barra-inferior-h` e o alvo é rolado para a metade superior; `prefers-reduced-motion` sem animação; reposiciona em `resize`/`scroll`; alvo que some → passo pulado.

- [ ] **Step 1: testes unitários (RED)** `tourPosicao.test.ts`: `posicionarCartao` põe o cartão abaixo quando cabe, acima quando não cabe, e `modo:'base'` no celular sem cobrir o alvo; `passosVisiveis` ignora alvo ausente e alvo com rect zero.
- [ ] **Step 2: testes e2e (RED)** `tour.spec.ts` (página de teste simples via Radar com `data-tour` provisório ou `TourDef` injetada): conta sem registro vê o tour uma vez; após concluir, recarregar não mostra; "Pular todos" grava `tours_pular_todos` e some nas outras páginas; Esc pula só a página; não inicia com `dialog[open]` nem durante carregamento; troca de página cancela; exatamente uma escrita `PUT /auth/v1/user` por tour e nenhuma outra escrita; payload mantém chaves de `user_metadata` existentes (Review Focus 1); com a conta B no mesmo aparelho o tour aparece (Review Focus 5); StrictMode não inicia duas vezes.
- [ ] **Step 3: rodar** `npx vitest run tests/unit/tourPosicao.test.ts` e `npx playwright test -c e2e/playwright.config.ts e2e/tour.spec.ts --project=claro-1440` → FAIL.
- [ ] **Step 4: implementar** os quatro arquivos e a integração no `App.tsx`; gravação em `supabase.auth.updateUser({ data: { tours, tours_pular_todos } })` enviando sempre o objeto `tours` completo; falha de gravação nunca mostra erro e não bloqueia (fica no espelho).
- [ ] **Step 5: rodar** os dois comandos nos quatro projetos (`claro-1440`, `escuro-1440`, `claro-390`, `escuro-390`) → PASS.
- [ ] **Step 6: commit** `feat(tour): motor do tour passivo com estado na conta`.

### Task 3: Tours das 5 páginas

**Files:** Create `src/tour/passos/{radar,ordens,clientes,estoque,financeiro}.ts`, `e2e/ajuda-integridade.spec.ts`. Modify `src/pages/DashboardOperacional.tsx`, `src/pages/OrdensServico.tsx` (só a lista), `src/pages/ClientesVeiculos.tsx`, `src/pages/Estoque.tsx`, `src/pages/Financeiro.tsx` (atributos `data-tour` e a chamada `useTourDaPagina`).

**Interfaces — Produces:** os 5 `TourDef` com `versao: 1`; ids de alvo estáveis:
- radar: `radar-periodo`, `radar-quadro`, `radar-card`, `radar-nova-os`, `radar-antigas` (opcional)
- ordens: `ordens-busca`, `ordens-filtros`, `ordens-linha`, `ordens-nova`
- clientes: `clientes-busca`, `clientes-abas`, `clientes-novo`, `clientes-menu`
- estoque: `estoque-busca`, `estoque-categorias`, `estoque-baixo` (opcional), `estoque-menu`, `estoque-novo`
- financeiro: `financeiro-periodo`, `financeiro-abas`, `financeiro-novo`, `financeiro-baixa`

Cada `pronto` = dados carregados e fora da bancada/sheets (ex.: `!loading && view === 'lista'`). Textos: 1 a 2 frases, tom direto (ex.: radar-card: "Arraste o card para outra etapa ou use o menu … para mover. Sempre pede confirmação.").

- [ ] **Step 1: teste de integridade (RED)** `ajuda-integridade.spec.ts`: para cada cargo (DONO, ATENDENTE, MECANICO, FINANCEIRO) e cada tour cuja página o cargo acessa, abrir a página com os mocks (`cheio`), esperar `pronto` e afirmar que todo `alvo` não opcional existe (`[data-tour="…"]` visível) e que alvos opcionais ausentes são apenas pulados; cargo sem acesso à página não tenta o tour.
- [ ] **Step 2: rodar** `npx playwright test -c e2e/playwright.config.ts e2e/ajuda-integridade.spec.ts --project=claro-1440` → FAIL.
- [ ] **Step 3: implementar** marcas, definições e chamadas nos 5 arquivos de página (sem mudar lógica nem estilo).
- [ ] **Step 4: e2e adicional** em `tour.spec.ts`: por página, percorrer todos os passos até o fim com Próximo e conferir "Passo X de Y"; no celular (390) o cartão fica acima da barra e o alvo visível.
- [ ] **Step 5: rodar** `ajuda-integridade` e `tour` nos quatro projetos → PASS; rodar também `radar.spec.ts`, `ordens.spec.ts`, `clientes.spec.ts`, `estoque.spec.ts`, `financeiro.spec.ts` (`--project=claro-1440`) para provar que nada quebrou (testes existentes precisam marcar o tour como visto: `entrarComo` passa a gravar `tours_pular_todos` por padrão; opção `{ tourAtivo: true }` para os testes do tour).
- [ ] **Step 7: commit** `feat(tour): tours do Radar, Ordens, Clientes, Estoque e Financeiro`.

### Task 4: Aba Ajuda, menu e botão "?"

**Files:** Create `src/ajuda/{AjudaPage.tsx,Guia.tsx,ImagemAnotada.tsx,busca.ts,guias/index.ts}`, `src/components/ui/BotaoAjuda.tsx`, `tests/unit/ajudaBusca.test.ts`, `e2e/ajuda.spec.ts`. Modify `src/App.tsx` (`NavTab` ganha `'ajuda'`, item "Ajuda" no menu e em "Mais", roteamento por `?tab=ajuda&guia=`), `src/components/ui/PageHeader.tsx` (renderiza `BotaoAjuda`).

**Interfaces — Produces:**
```ts
export type PassoGuia = { texto: string; imagem?: { arquivo: string; alvos: string[]; variante390?: boolean } };
export type GuiaDef = { id: string; titulo: string; resumo: string; cargos: Cargo[]; palavrasChave: string[]; paginaTour?: string; passos: PassoGuia[] };
export function filtrarGuias(guias: GuiaDef[], termo: string, cargo: Cargo): GuiaDef[]; // por título/resumo/palavras, sem acento, só guias do cargo
```
`BotaoAjuda` (botão "?", ≥44 px no celular, `aria-label="Ajuda"`): menu com "Refazer o tour desta página" (se a página tem tour) e "Ver guias desta página"; em páginas sem tour/guia na v1 (Equipe, Dados da oficina) abre a lista. `ImagemAnotada` desenha marcadores numerados e destaque como elementos de texto sobre a imagem usando `anotacoes.json` (posições em %), com `alt` descritivo.

- [ ] **Step 1: testes (RED)** `ajudaBusca.test.ts`: busca ignora acentos e caixa, filtra por cargo, termo vazio lista todos. `ajuda.spec.ts`: item "Ajuda" no menu e em "Mais" (390); abrir guia por URL (`?tab=ajuda&guia=abrir-os`) mostra os passos numerados; guia de tela sem acesso não aparece para o cargo; "?" → "Refazer o tour" reinicia o tour mesmo se já visto e se `tours_pular_todos`; sem escrita no backend além do `updateUser`.
- [ ] **Step 2: rodar** unitário e `ajuda.spec.ts` (`claro-1440`) → FAIL.
- [ ] **Step 3: implementar** (guias com os 7 ids e passos de texto; imagens opcionais — a ausência de imagem mostra só o texto).
- [ ] **Step 4: rodar** nos quatro projetos + `shell.spec.ts` → PASS.
- [ ] **Step 5: commit** `feat(ajuda): aba Ajuda, busca, botão "?" e guias em texto`.

### Task 5: Os 7 guias (texto) 

**Files:** Create `src/ajuda/guias/{abrir-os,orcamento-whatsapp,mover-etapa,receber-pagamento,cliente-veiculo,ajustar-estoque,conta-baixa}.ts`; Modify `src/ajuda/guias/index.ts`.

Cada guia: 4 a 7 passos, 1 a 3 frases por passo, cargos corretos (ex.: `conta-baixa` só DONO e FINANCEIRO), `alvos` das imagens usando os `data-tour` existentes (acrescentar marcas `data-tour` novas nas telas só quando o passo precisa de um botão ainda sem marca, ex.: `os-orcamento-whatsapp`, `os-pago`, `cliente-veiculo-novo`).

- [ ] **Step 1: ampliar o teste de integridade (RED)**: para cada guia e cada cargo que o vê, todo `alvo` citado existe quando o roteiro (Task 6) chega ao passo; por ora, afirmar que todos os ids de guia e de alvo estão declarados.
- [ ] **Step 2: escrever** os 7 guias e as marcas `data-tour` extras.
- [ ] **Step 3: rodar** `ajuda.spec.ts` e `ajuda-integridade.spec.ts` (quatro projetos) → PASS.
- [ ] **Step 4: commit** `feat(ajuda): 7 guias do dia a dia`.

### Task 6: Prints gerados por script

**Files:** Create `e2e/ajuda/roteiros.ts`, `e2e/ajuda/prints.spec.ts`, `src/ajuda/anotacoes.json`, `public/ajuda/**`. Modify `package.json` (scripts `ajuda:prints` e `ajuda:check`), `e2e/AGENTE_PLAYWRIGHT.md` (nota de uso).

**Interfaces — Produces:** `roteiros.ts` exporta, por guia, `async (cena: Cena) => void` com `cena.passo(n, alvos: string[], acao?: () => Promise<void>)`, que executa a ação, tira o print limpo (JPEG, qualidade 82, tema claro, 1440×900; variante 390×844 só quando `variante390`) em `public/ajuda/<guia>/<n>.jpg` e grava em `anotacoes.json` a caixa de cada alvo em % da imagem. `npm run ajuda:prints` = `AJUDA_PRINTS=1 playwright test -c e2e/playwright.config.ts e2e/ajuda/prints.spec.ts --project=claro-1440` (e `claro-390` para variantes); `ajuda:check` (`AJUDA_CHECK=1`) regenera em pasta temporária e compara **só as caixas** com tolerância de 2% (falha com mensagem "rode npm run ajuda:prints").

- [ ] **Step 1: teste (RED)** do `--check`: com `anotacoes.json` vazio falha; teste de privacidade: nomes e placas em `anotacoes.json` e nos textos dos guias vêm só da lista dos mocks (`e2e/mocks/fixtures.ts`).
- [ ] **Step 2: escrever os roteiros** dos 7 guias (cliques e dados de exemplo dos mocks; sem escrita real, os mocks respondem).
- [ ] **Step 3: rodar** `npm run ajuda:prints`; conferir visualmente 5 imagens de guias diferentes; ajustar roteiros até os marcadores caírem nos botões certos; verificar orçamento (≤ 150 KB cada, ≤ 4 MB total).
- [ ] **Step 4: rodar** `npm run ajuda:check` → PASS e `ajuda.spec.ts` → PASS (imagens com marcadores numerados em 390 e 1440).
- [ ] **Step 5: commit** `feat(ajuda): prints e anotações gerados por script`.

### Task 7: Fechamento

- [ ] **Step 1:** `npm run build`, `npx vitest run`, `npm run e2e` (suíte completa com os specs novos adicionados ao script `e2e` em `package.json`; ler os totais reais, 0 falhas) e `npm run ajuda:check`.
- [ ] **Step 2:** conferir contraste e foco do cartão do tour nos dois temas (testes da Tarefa 2) e que `TOURS_ATIVOS = false` desliga só o automático (teste curto).
- [ ] **Step 3:** enviar ao dono os prints do tour (passo no desktop e no celular, claro e escuro), da aba Ajuda e de dois guias para aprovar textos e imagens **antes** do deploy.
- [ ] **Step 4: commit/push**; um agente revisa o diff inteiro (após a sua aprovação) e só então PR, CI e deploy, se você pedir.
