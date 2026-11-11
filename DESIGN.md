# DESIGN.md — Mecanify

Sistema visual "Grafite + Âmbar". Ferramenta de oficina: some no trabalho; a marca vive nos detalhes (âmbar de segurança, placa Mercosul, números tabulares). Hierarquia por preenchimento e espaço, não por bordas. Contexto de produto em `PRODUCT.md`; decisões em `docs/superpowers/specs/2026-11-10-refresh-visual-design.md`.

## Tokens de cor

**Fonte de verdade: `src/styles/tokens.css`** (canais RGB em `--c-*`, `:root` = claro, `.dark` = escuro). O Tailwind os consome como `bg|text|border|ring|divide-<token>` com suporte a `/<alpha>`. Não há hex fixo em telas.

| Token | Uso |
|---|---|
| `canvas` | fundo da página |
| `surface` | cards, painéis, menu |
| `muted` | hover, chips, trilho de abas, botão secundário, cabeçalho de tabela (claro `#EBE6DB`, visivelmente mais escuro que `canvas`) |
| `sunken` | campos de formulário |
| `line` | divisores decorativos |
| `line-strong` | borda de campo (>=3:1 contra `sunken` e `surface`) |
| `ink` / `ink-muted` / `ink-subtle` | texto principal / secundário / legenda e placeholder (`ink-subtle` claro `#6D665B`, >=4.5:1 também sobre `muted`) |
| `brand` / `brand-hover` | botão primário, item ativo, foco / hover do primário |
| `brand-ink` | texto e ícone âmbar |
| `on-brand` | texto sobre `brand` |
| `danger` `success` `warning` `info` `done` | texto/ícone de estado (erro, sucesso, alerta, informação, finalizado); `warning` claro `#AA4006` e `done` claro `#0E7068` (>=4.5:1 também sobre `muted`) |
| `danger-solid` `success-solid` | fundos de botão destrutivo / confirmação |
| `on-solid` | texto sobre `danger-solid`/`success-solid` (branco nos dois temas) |

Tema: classe `dark` em `<html>`, aplicada por script inline antes do React (preferência salva em `localStorage['mecanify_tema']` = `claro`|`escuro`; sem ela, `prefers-color-scheme`). Claro é o padrão visual; `TemaProvider`/`useTema()` em `src/theme/TemaContext.tsx`. Contraste verificado por `tests/unit/contraste.test.ts` (`npm test`).

## Status da OS

| Status | Cor | Ícone (lucide) | Rótulo |
|---|---|---|---|
| `ORCAMENTO` | `ink-muted` sobre `muted` | `ClipboardList` | Orçamento |
| `AGUARDANDO_PECA` | `warning` | `PackageSearch` | Aguardando peça |
| `EXECUCAO` | `brand-ink` sobre `brand/15` | `Wrench` | Em execução |
| `FINALIZADO` | `done` (teal) | `CircleCheck` | Finalizado |
| `PAGO` | `success` | `BadgeDollarSign` | Pago / entregue |

Nenhum status usa a cor da marca, exceto Execução. Sem violeta.

## Tipografia

- Geist Variable (texto, títulos, botões) e Geist Mono Variable (placa, SKU, códigos), auto-hospedadas via `@fontsource-variable/geist` e `/geist-mono`.
- Dinheiro: Geist com `tabular-nums`.
- Pesos: 400 texto, 500 rótulos/botões, 600 títulos. Sem `font-extrabold`/`font-black`.
- Escala (rem): 12 / 13 / 14 / 16 / 18 / 22 / 28. Mínimo 12px.

## Forma e espaço (direção "estilo Binance", 2026-11-10)

Minimalista e sofisticado com a nossa paleta grafite + âmbar. Referência: `docs/brand/referencia-binance.png`.

- **Sem contornos.** Separação por preenchimento (card `surface` sobre `canvas`) e espaço. Nada de borda em card, painel ou linha de lista. Única borda: campo de formulário (`line-strong`, 3:1).
- **Cards:** `rounded-2xl` (16px), padding `p-5` (padrão) ou `p-6`, sem sombra no claro; no escuro, só o degrau `surface`/`canvas`.
- **Controles:** `rounded-lg` (8px), 40px no desktop e 44px no toque (`min-h-11`, inclusive o botão `sm`: `h-8 min-h-11 md:min-h-8`).
- **Pílulas** (`rounded-full`): abas, chips de filtro, controle segmentado, `Badge` e `StatusBadge`.
- **Botão primário âmbar** sólido (`brand` + `on-brand`), um por tela. Secundário: fundo `muted`, sem borda. Fantasma: transparente.
- **Números grandes:** valor-chave em 28–36px, peso 600, `tabular-nums`, rótulo pequeno `ink-muted` acima.
- **Respiro:** `gap-4`/`gap-6`; no máximo 3 blocos de destaque por tela; ícones lucide de traço fino.
- Sem sparklines decorativos. Cor de status só em texto, ícone ou pílula pequena.
- Foco: anel de 3px `brand` (global, em `tokens.css`); componentes com rolagem usam `ring-inset` para o anel não ser cortado.
- Menu lateral 240px, linhas de 40px; ativo = fundo `muted` + `aria-current="page"`. Barra inferior mobile: até 5 itens.

## Componentes (`src/components/ui`)

| Componente | Forma | Contrato |
|---|---|---|
| `Button` | `rounded-lg`; `primario` âmbar, `secundario` `muted`, `fantasma`, `perigo` (`danger-solid` + `on-solid`); `sm`/`md` | `variante`, `tamanho`, `icone`, `carregando` (`aria-busy`) |
| `Panel` | `bg-surface rounded-2xl`, sem borda/sombra | `espaco`: `md` (`p-5`, padrão) \| `lg` (`p-6`) \| `nenhum`; `as`. Quem aplica padding próprio via `className` deve passar `espaco="nenhum"` (senão `p-5` conflita) |
| `Tabs` | trilho `bg-muted rounded-full p-1`; aba ativa `bg-surface text-ink` (+`shadow-card`, que é nula no escuro; no escuro `bg-line`); inativa `text-ink-muted` | `role=tablist`, setas/Home/End, `idPainel` → `aria-controls` da aba ativa |
| `Badge`, `StatusBadge` | pílula `rounded-full` em `<tom>/15` | `tom` |
| `Field` | rótulo visível, dica e erro abaixo; filho sem `className` recebe `CLASSE_CAMPO` (`rounded-lg border-line-strong bg-sunken`) | mescla `aria-describedby`/`aria-invalid` do filho |
| `Skeleton` | barras `rounded-lg bg-muted` | `role="status"` + "Carregando" (`sr-only`) |
| `PlateChip` | placa Mercosul (exceção de hex) | `role="img"`, nome "Placa XXX-0000" |
| `PageHeader`, `ThemeToggle` | título 22px/600; alternador 44px no toque | `document.title`; `aria-label` do tema |
| `BrandMark`, `Logo` | ver "Logo" | |

## Logo

Fornecido pelo dono (`docs/brand/mecanify-logo-referencia.jpg`): monograma "M" de dois laços de traço arredondado com uma chave de boca cruzando na diagonal; palavra "mecanify" com "ify" em âmbar; legenda "GESTÃO DE OS".

- **`BrandMark`** — o monograma vetorizado (3 paths, `viewBox="0 0 52 37.4"`, traço 3.8, tudo `currentColor`, padrão `text-brand`). `tamanho` = altura em px. Sozinho é `role="img"` com `aria-label="Mecanify"` (ou `titulo`). Os cortes nos laços, onde a chave passa por cima, são as próprias extremidades retas do traço. Os paths ficam exportados em `MONOGRAMA`.
- **`Logo`** — monograma + "mecanify" em Geist 600 ("mecan" `ink`, "ify" `brand-ink`); com `legenda`, "GESTÃO DE OS" pequeno e espaçado em `ink-muted` (só no login). `monocromatico` = tudo preto, para impressão (OS, holerite, etiqueta); o `text-black` aqui é uma **exceção intencional de impressão** (papel é sempre branco), não um token de tema. Um único nome acessível "Mecanify".
- **`public/favicon.svg` e `public/logo.svg`** — monograma âmbar `#F2A007` sobre quadrado grafite `#1F1D1A` com raio 14/64.
- Usar em: favicon, login (todas as abas), menu lateral, topo mobile, avaliação pública, cabeçalho das impressões (monocromático), tela de carregamento.
- Área de respiro mínima: metade da altura do monograma. Tamanho mínimo: 16px de altura (favicon).
