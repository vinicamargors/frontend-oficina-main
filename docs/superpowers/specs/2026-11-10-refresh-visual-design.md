# Refresh visual do Mecanify — Especificação

Data: 2026-11-10 · Origem: crítica `impeccable` (20/40) + decisões do dono do produto.

## Decisões confirmadas

- **Paleta:** Grafite + Âmbar. Base neutra (nada de navy), âmbar como marca.
- **Tema:** claro (padrão) + escuro, alternância manual, preferência salva no navegador.
- **Escopo:** visual completo em todas as telas. Lógica de negócio intacta, **exceto** a confirmação do "Pago".
- **Telas:** Login (entrar, criar conta, recuperar senha), shell (menu lateral + barra inferior), Radar do Pátio,
  Ordens de Serviço (lista + bancada), Clientes & Veículos, Estoque, Caixa & Financeiro, Equipe & RH,
  Dados da Oficina, Avaliação pública, impressões (OS, holerite, etiqueta).
- **Validação:** ao fim de cada tela, prints Playwright (1440 e 390, claro e escuro) enviados ao dono para aprovação.

## Mundo visual

Referências usadas (skills instaladas): `impeccable` (processo, craft floor, Operate), `taste-skill`
(paleta sorteada `limewash-ochre`, fontes `geist`, regras anti-genérico), `impeccable-design` (âmbar + mono para dados),
`stitch` e `ant` (densidade de dados), `enterprise` (painéis do tema escuro).

Princípio: ferramenta de oficina. Some no trabalho. Marca vive nos detalhes: âmbar de segurança, placa Mercosul,
números tabulares. Sem bordas em tudo: hierarquia por preenchimento e espaço.

### Tokens de cor (CSS vars em canais RGB, consumidas pelo Tailwind com `<alpha-value>`)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `canvas` | `#F1EDE4` | `#111214` | fundo da página |
| `surface` | `#FFFFFF` | `#1A1B1E` | cards, painéis, menu |
| `muted` | `#F4F1EA` | `#232428` | hover, chips, cabeçalho de tabela, poços |
| `sunken` | `#FFFFFF` | `#0E0F11` | campos de formulário |
| `line` | `#E2DCD0` | `#2B2D31` | divisores decorativos |
| `line-strong` | `#8F8778` | `#6B6F78` | borda de campo (≥3:1 contra `sunken` e `surface`) |
| `ink` | `#1F1D1A` | `#F2F0EB` | texto principal |
| `ink-muted` | `#5C564C` | `#B4B0A8` | texto secundário (≥4.5:1 em canvas/surface/muted) |
| `ink-subtle` | `#6F685D` | `#8E8A82` | legenda, placeholder (≥4.5:1 em surface) |
| `brand` | `#F2A007` | `#F5A524` | botão primário, item ativo, foco |
| `brand-hover` | `#D98E00` | `#F7B547` | hover do primário |
| `brand-ink` | `#8A5A00` | `#F5B544` | texto/ícone âmbar (≥4.5:1 em canvas/surface) |
| `on-brand` | `#1F1D1A` | `#1A1407` | texto sobre `brand` (≥4.5:1) |
| `danger` | `#B42318` | `#F97066` | texto/ícone de erro, despesa |
| `success` | `#166534` | `#4ADE80` | texto/ícone de sucesso, receita |
| `warning` | `#B54708` | `#FDB022` | alerta |
| `info` | `#1D5FB4` | `#7CB4F5` | informação (único uso do azul) |
| `danger-solid` | `#B42318` | `#D92D20` | botão destrutivo (texto branco ≥4.5:1) |
| `success-solid` | `#15803D` | `#15803D` | botão de confirmação verde (texto branco ≥4.5:1) |

### Status da OS (nenhum igual à marca, exceto Execução, que **é** o trabalho)

| Status | Cor (token) | Ícone (lucide) | Rótulo |
|---|---|---|---|
| `ORCAMENTO` | `ink-muted` sobre `muted` | `ClipboardList` | Orçamento |
| `AGUARDANDO_PECA` | `warning` | `PackageSearch` | Aguardando peça |
| `EXECUCAO` | `brand-ink` sobre `brand/15` | `Wrench` | Em execução |
| `FINALIZADO` | teal: claro `#0F766E` / escuro `#2DD4BF` (token `done`) | `CircleCheck` | Finalizado |
| `PAGO` | `success` | `BadgeDollarSign` | Pago / entregue |

Sem violeta em lugar nenhum (`taste-skill`). WhatsApp: botão neutro com ícone. "Sair": linha discreta, não botão vermelho.

### Tipografia

- Geist Variable (texto, títulos, botões) + Geist Mono Variable (placa, SKU, códigos), auto-hospedadas via `@fontsource-variable`.
- Valores em dinheiro: Geist com `tabular-nums` (mono só para placa/SKU/código).
- Pesos: 400 texto, 500 rótulos/botões, 600 títulos. Proibido `font-extrabold`/`font-black`.
- Escala fixa (rem): 12 / 13 / 14 / 16 / 18 / 22 / 28. Mínimo 12px. Proibido `text-[9px]`, `text-[10px]`, `text-[11px]`.

### Forma e espaço

- Raio: `rounded-md` (6px) controles, `rounded-lg` (8px) cards. Nada de `rounded-2xl`/`3xl`.
- Profundidade: `shadow-card` = `0 1px 2px rgb(0 0 0 / .06), 0 1px 3px rgb(0 0 0 / .08)` no claro; no escuro sem sombra, só degrau de superfície.
- No máximo 2 níveis de caixa. Itens dentro de card: divisores (`divide-line`), não bordas.
- Controles: altura 40px desktop, 44px mobile (`h-10 md:h-10`, `min-h-11` em toque). Alvos de toque ≥44px.
- Menu lateral: 240px, linhas de 40px, `text-sm font-medium`; ativo = fundo `muted` + barra âmbar 2px à esquerda + `aria-current="page"`.
- Barra inferior mobile: no máximo 5 itens (4 + "Mais"), rótulo 12px, ícone 20px.

### Componentes compartilhados

`Button` (primary | secondary | ghost | danger; sm | md), `Panel`, `PageHeader` (título + ações, sem subtítulo
explicativo), `StatusBadge`, `Badge`, `Field` (rótulo visível + erro abaixo do campo), `Tabs` (`role=tablist`,
`aria-selected`), `PlateChip` (placa Mercosul: fundo branco, faixa azul `#1D4ED8` 4px no topo, Geist Mono),
`Skeleton`, `ThemeToggle`, `BrandMark` (logo próprio SVG, não o `Wrench` do lucide).

### Mudança de comportamento (única)

Mudar OS para `PAGO` abre a folha `ConfirmarPagamento`: total da OS, escolha obrigatória da forma de pagamento
(os mesmos valores de `FORMAS_PAGAMENTO` em `OrdensServico.tsx`: PIX, Cartão de Crédito, Cartão de Débito, Dinheiro, Boleto / Faturado), sem opção pré-marcada,
botão "Confirmar pagamento" desabilitado até escolher. Cancelar não altera nada. Remove o padrão silencioso `'PIX'`.

### Radar do Pátio

Quadro do pátio: uma coluna por etapa (Orçamento, Aguardando peça, Em execução, Finalizado), cada uma com cards de
placa (`PlateChip`, modelo, cliente, total, "aberta há N dias"). Card com mais de 3 dias em Orçamento/Aguardando peça
ganha marca `warning`; mais de 7 dias, `danger`. Topo: no máximo 3 números (no pátio, a receber, estoque crítico).
Os dias contam desde `data_abertura` (o backend não envia data da última troca de etapa — não inventar).


## Direção atualizada (2026-11-10, pedido do dono)

Referência: app da Binance (minimalista e sofisticado), **usando a nossa paleta** grafite + âmbar. Imagem em
`docs/brand/referencia-binance.png`. Isto **substitui** as regras de forma abaixo ("Forma e espaço") onde houver conflito.

- **Sem contornos.** Separação por preenchimento (card claro sobre fundo) e espaço. Nada de borda em card, painel ou linha de lista.
  Borda só em campo de formulário (`line-strong`, exigência de contraste 3:1).
- **Cards grandes e suaves:** `rounded-2xl` (16px), padding `p-5`/`p-6`, sem sombra no claro; no escuro, degrau de superfície.
- **Controles:** `rounded-lg` (8px), altura 40/44px. **Pílulas** (`rounded-full`) para abas, chips de filtro e controle segmentado
  (como "Exchange | Wallet" da referência). Item ativo da pílula: fundo `surface`/`muted` + texto `ink`; inativo: texto `ink-muted`.
- **Botão primário âmbar** sólido, texto `on-brand`, um por tela. Secundário: fundo `muted`, sem borda.
- **Números grandes:** valor-chave da tela em 28–36px, peso 600, `tabular-nums` (como o saldo da referência). Rótulo pequeno `ink-muted` acima.
- **Respiro:** espaçamento generoso (`gap-4`/`gap-6`), no máximo 3 blocos de destaque por tela. Ícones finos (lucide, traço 1.5).
- **Barra inferior mobile:** 5 itens, ícone + rótulo, item ativo em `ink` com ícone preenchido de âmbar; sem pílula de fundo.
- Sem mini-gráficos decorativos (sparklines). Cores de status só em texto/ícone/pílula pequena.

## Logo (fornecido pelo dono)

Arquivo de referência: `docs/brand/mecanify-logo-referencia.jpg` (monograma "M" em traço âmbar arredondado com chave inglesa
cruzando; palavra "mecanify" com "ify" em âmbar; legenda "GESTÃO DE OS").
- Vetorizar o monograma em SVG fiel ao original (`src/components/ui/BrandMark.tsx`, `currentColor`, sem texto dentro).
- `Logo` = monograma + palavra "mecanify" em texto (Geist 600; "mecan" em `ink`, "ify" em `brand-ink`). Legenda "GESTÃO DE OS" só no login.
- `public/favicon.svg` e `public/logo.svg` (monograma âmbar sobre quadrado grafite arredondado).
- **Usar em tudo:** favicon, login (todas as abas), menu lateral, topo mobile, avaliação pública, cabeçalho das impressões
  (OS, holerite, etiqueta) em versão monocromática preta, tela de carregamento inicial.

## Fora do escopo

Trocar os 17 `alert()` por mensagens inline, atalhos de teclado, ações em lote, rotas novas, mudanças no backend.
Ficam registrados como próximos passos.

## Critérios de aceite

1. Nenhum hex fixo em `src/**/*.tsx` (exceto `PlateChip` e impressões).
2. Tokens passam no teste de contraste (claro e escuro).
3. `npm run build` passa.
4. Playwright: todas as telas renderizam com dados simulados, nos dois temas, em 1440 e 390, sem rolagem lateral.
5. `impeccable detect` sem `warning` nas telas renderizadas; nova crítica ≥ 28/40.
6. Dono aprova os prints de cada tela.
