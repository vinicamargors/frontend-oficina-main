# Tour guiado por página e central de ajuda — Especificação

Data: 2026-11-11 · Origem: pedido do dono do produto, refinado em entrevista (decisões abaixo).

## Objetivo

Um dono, atendente, mecânico ou financeiro novo consegue usar o Mecanify sozinho. Sucesso: um usuário novo abre a primeira
ordem de serviço sem pedir ajuda. Dois recursos:

1. **Tour guiado por página** (walkthrough): destaca os botões e explica o que fazer ali, uma vez por pessoa e por página.
2. **Central de ajuda (FAQ) ilustrada**: guias passo a passo das principais ações, com prints numerados e setas.

## Decisões confirmadas

| Tema | Decisão |
|---|---|
| Quem é "novo" | Por pessoa, guardado na conta. **Todos** veem cada mini-tour uma vez, veteranos incluídos. Sem data de corte. |
| Tour | **Passivo**: escurece a tela, destaca o elemento e explica. O usuário não clica no elemento; nada é gravado. |
| Quando aparece | Mini-tour de 3 a 5 passos na **primeira visita a cada página**. "Pular todos os tours" em todo passo. Botão "?" refaz o tour da página. |
| FAQ | Editada só por nós, por deploy. Texto e prints no repositório. Prints **gerados por script**. |
| Escopo v1 | Tour em 5 páginas: Radar, Ordens, Clientes, Estoque, Financeiro. 7 guias do dia a dia. |
| Backend | **Nenhuma mudança.** O estado "já viu" fica nos dados da conta do Supabase Auth. |
| Motor do tour | Próprio e leve, sem dependência nova. |

## Fora de escopo (v1)

- Tour em Equipe, Dados da oficina, Login e avaliação pública.
- Guias de Equipe (colaborador, ponto), Dados da oficina (PIX, GPS), impressões e Radar com período (v2).
- Vídeos, edição da FAQ sem deploy, métricas de uso do tour (única coisa que exigiria backend).
- Tour interativo ou com dados de demonstração.

## Arquitetura

### 1. Estado "já viu" (sem backend)

Guardado em `user_metadata` do Supabase Auth, via `supabase.auth.updateUser({ data })` (o login já usa `updateUser` para a senha):

```ts
type TourMeta = {
  tours: Record<string, number>; // id da página -> versão do tour que a pessoa viu
  tours_pular_todos?: boolean;   // "Pular todos": nenhum tour automático
};
```

- Helpers em `src/tour/estado.ts`: `lerEstado(session): TourMeta`, `marcarVisto(id, versao)`, `pularTodos()`.
- Cópia espelho em `localStorage` (`mecanify_tours_<userId>`), lida primeiro e reconciliada com a conta: se a gravação na conta falhar (sem internet), o tour não repete.
- `user_metadata` é gravável pelo próprio usuário: serve só para preferência de interface, nunca para segurança.
- Escrita mínima: um `updateUser` por mini-tour concluído ou pulado; sem polling.
- Sobe a `versao` de um tour (no arquivo dele) só quando ele mudar de forma relevante; quem viu a versão antiga vê a nova uma vez. Quem marcou "Pular todos" não vê nenhuma versão nova automaticamente (o "?" continua funcionando).

### 2. Motor do tour (`src/tour/`)

- `TourProvider` na raiz do app (dentro de `AuthProvider`), `useTourDaPagina(id)` em cada página.
- Passos por página em `src/tour/passos/<pagina>.ts`:
  `{ id, alvo: 'radar-nova-os', titulo, texto }`. O `alvo` casa com `data-tour="radar-nova-os"` no elemento.
- O motor só mostra passos cujo elemento **existe e está visível** para aquele cargo e estado (cargo sem a aba Financeiro não vê passo do Financeiro; um aviso que só aparece às vezes é pulado quando ausente).
- **Gatilho:** página montada, dados carregados (sem skeleton), tour dessa página ainda não visto, `tours_pular_todos` falso, nenhuma folha/diálogo aberto, usuário autenticado. Espera 400 ms. Cancela se a pessoa trocar de página.
- **Marca como visto** ao concluir, pular ou fechar (qualquer saída). "Pular todos" grava `tours_pular_todos`.
- **Visual** (tokens do projeto, sem hex): fundo escurecido com recorte (clip-path) no elemento, anel âmbar no recorte, cartão `surface` rounded-2xl com título, texto de até 2 frases, "Passo 2 de 4", botões Voltar / Próximo (primário âmbar) e link "Pular todos os tours". O elemento é rolado para a tela quando necessário.
- **Celular (<1024px):** o cartão fica fixo na base, acima da barra inferior (`--barra-inferior-h`), nunca cobrindo o elemento destacado (o motor rola o elemento para a metade superior).
- **Acessibilidade:** `role="dialog"` com `aria-labelledby`/`aria-describedby`; foco vai para o cartão e fica preso nele; Esc pula o tour da página; fundo inerte e sem cliques durante o tour; anúncio "Passo X de Y" em região viva; `prefers-reduced-motion` desliga animações; contraste ≥ 4.5:1 nos dois temas; alvos ≥ 44 px no celular.
- **Segurança de dados:** o tour nunca dispara cliques nem escritas na tela por trás.

### 3. Central de ajuda (`src/ajuda/`)

- Nova aba `ajuda` no modelo de navegação existente (URL `?tab=ajuda&guia=abrir-os`, sem roteador novo). Acesso: item "Ajuda" no menu lateral (em "Mais" no celular) e botão "?" no cabeçalho de cada página, que abre o guia daquela página ou refaz o tour dela (dois itens num pequeno menu). Nas páginas sem tour nem guia na v1 (Equipe, Dados da oficina), o "?" abre a lista da Ajuda.
- Visível para todos os cargos autenticados. Cada guia declara os `cargos` que o usam; guias de telas que o cargo não acessa ficam escondidos.
- Lista de guias com busca simples por título e palavras-chave (filtro local, sem backend). Cada guia: título, resumo de uma linha, passos numerados.
- Um passo: texto curto (1 a 3 frases), imagem opcional com marcadores numerados e destaque desenhados na tela por cima do print limpo (texto real, não pixels), `alt` descritivo.
- Conteúdo em `src/ajuda/guias/<id>.ts`:
  `{ id, titulo, resumo, cargos, palavrasChave, passos: [{ texto, imagem?: { arquivo, alvos: ['radar-nova-os'] } }] }`.

### 4. Prints que não envelhecem (`npm run ajuda:prints`)

- Um spec Playwright em `e2e/ajuda/` abre cada tela com os mocks e dados fictícios dos testes existentes, executa os passos de cada guia (abrir menus, preencher campos de exemplo) e, no ponto de cada passo:
  1. tira o print **limpo** (sem anotação) em tema claro, 1440×900, e variante 390×844 só onde o layout do celular muda o caminho;
  2. mede a caixa (`boundingBox`) de cada `data-tour` citado e grava em `src/ajuda/anotacoes.json` em porcentagem da imagem.
- Saída: WebP em `public/ajuda/<guia>/<passo>.webp` (≤ 120 KB cada, orçamento total ≤ 4 MB), carregadas sob demanda (`loading="lazy"`), fora do bundle do JS.
- Os dados dos prints são só os dos mocks (nomes e placas fictícios). Um teste confere que nenhum print/JSON contém dado fora da lista dos mocks.
- `npm run ajuda:prints -- --check` regenera em pasta temporária e compara **as caixas** com `anotacoes.json` (tolerância de 2%): falha se um botão mudou de lugar ou sumiu, e manda regenerar. Não compara pixels.

## Conteúdo v1

**Tour (cada um 3 a 5 passos):**
- Radar: período; quadro por etapa; card (arrastar ou menu "…" para mover, sempre com confirmação); "Nova OS"; aviso de ordens mais antigas (se existir).
- Ordens: busca; filtros por etapa; linha da OS (abre a bancada); "Nova ordem de serviço".
- Clientes: busca; abas Clientes/Placas; "Novo cliente"; menu "…" da linha.
- Estoque: busca; categorias; "Baixo" (reposição); menu "…" (entrada/saída/etiqueta); "Novo item".
- Financeiro: período; abas; "Novo lançamento"; dar baixa numa conta.

**Guias (7):**
1. Abrir uma ordem de serviço
2. Montar o orçamento e enviar no WhatsApp
3. Mover a OS de etapa (inclusive arrastando no Radar)
4. Receber o pagamento
5. Cadastrar cliente e veículo
6. Ajustar o estoque (entrada e saída)
7. Lançar uma conta e dar baixa

Os textos são escritos em pt-BR, frases curtas, só a primeira letra maiúscula, sem jargão ("OS" explicada no primeiro uso). O dono revisa os textos e os prints no PR antes do deploy.

## Fluxo de dados e erros

- Falha ao ler ou gravar o estado: o tour usa o espelho local; nunca bloqueia a tela e nunca mostra erro ao usuário.
- Elemento do passo ausente: o passo é pulado em silêncio; se não sobrar nenhum, o tour da página é marcado como visto sem aparecer.
- Guia ou imagem ausente: o guia mostra só o texto, sem quebrar.
- Interruptor de segurança: constante `TOURS_ATIVOS` (um arquivo) desliga todos os tours automáticos sem tocar na FAQ.

## Testes

- **Estado:** unitários de `estado.ts` (conta nova, versão nova, "pular todos", espelho local, falha de gravação).
- **Tour (e2e):** aparece uma vez para conta sem registro; não aparece de novo após concluir, pular ou recarregar; "Pular todos" apaga os demais; "?" refaz; Esc pula; troca de página cancela; não inicia com folha aberta ou durante o carregamento; nenhuma requisição de escrita além do `updateUser` do estado.
- **Cargo:** mecânico e atendente só veem passos de elementos que existem para eles.
- **Celular:** cartão acima da barra inferior, elemento destacado visível, sem rolagem lateral, alvos ≥ 44 px.
- **Acessibilidade:** foco preso e devolvido, anúncio de passo, `prefers-reduced-motion`, contraste nos dois temas.
- **Integridade:** todo `alvo` citado por tour ou guia existe na tela correspondente para cada cargo que a vê; `ajuda:prints --check` passa.
- **FAQ:** busca filtra; guia por URL abre direto; guia de tela sem acesso não aparece para o cargo.
- Toda a suíte atual continua verde (`npm run build`, `npx vitest run`, `npm run e2e`).

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Veteranos se irritam com o tour | Tours curtos, "Pular todos" em todo passo, só na primeira visita a cada página, `TOURS_ATIVOS` como freio. |
| UI muda e o tour/guia quebra | Teste de integridade dos alvos; o teste falha antes do deploy. |
| Prints envelhecem | Gerados por script; `--check` falha quando uma caixa muda de lugar. |
| Dado real em print | Só dados dos mocks; teste confere. |
| Passo cobre o elemento no celular | Cartão na base, elemento rolado para a metade superior; teste em 360/390/430 px. |
| `user_metadata` adulterável | Só preferência de interface; nada de segurança depende dele. |

## Critérios de aceite

1. Conta sem registro vê o mini-tour de cada página uma vez; depois nunca mais, em qualquer aparelho.
2. "Pular todos" encerra os tours automáticos; o "?" e a Ajuda continuam funcionando.
3. Nenhuma escrita no backend além do `updateUser` do estado; nenhuma mudança de API ou banco.
4. 7 guias com prints numerados, gerados por `npm run ajuda:prints`; `--check` passa.
5. Tour e FAQ funcionam em 390 e 1440 px, tema claro e escuro, com teclado e leitor de tela.
6. Suíte completa verde e CI verde; o dono aprova textos e prints.
