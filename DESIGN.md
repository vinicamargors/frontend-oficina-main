# DESIGN.md — Mecanify

Sistema visual "Grafite + Âmbar". Ferramenta de oficina: some no trabalho; a marca vive nos detalhes (âmbar de segurança, placa Mercosul, números tabulares). Hierarquia por preenchimento e espaço, não por bordas. Contexto de produto em `PRODUCT.md`; decisões em `docs/superpowers/specs/2026-11-10-refresh-visual-design.md`.

## Tokens de cor

**Fonte de verdade: `src/styles/tokens.css`** (canais RGB em `--c-*`, `:root` = claro, `.dark` = escuro). O Tailwind os consome como `bg|text|border|ring|divide-<token>` com suporte a `/<alpha>`. Não há hex fixo em telas.

| Token | Uso |
|---|---|
| `canvas` | fundo da página |
| `surface` | cards, painéis, menu |
| `muted` | hover, chips, cabeçalho de tabela, poços |
| `sunken` | campos de formulário |
| `line` | divisores decorativos |
| `line-strong` | borda de campo (>=3:1 contra `sunken` e `surface`) |
| `ink` / `ink-muted` / `ink-subtle` | texto principal / secundário / legenda e placeholder |
| `brand` / `brand-hover` | botão primário, item ativo, foco / hover do primário |
| `brand-ink` | texto e ícone âmbar |
| `on-brand` | texto sobre `brand` |
| `danger` `success` `warning` `info` `done` | texto/ícone de estado (erro, sucesso, alerta, informação, finalizado) |
| `danger-solid` `success-solid` | fundos de botão destrutivo / confirmação (texto branco) |

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

## Forma e espaço

- Raio: `rounded-md` (6px) controles, `rounded-lg` (8px) cards.
- Profundidade: `shadow-card` no claro; no escuro, sem sombra, só degrau de superfície.
- No máximo 2 níveis de caixa; itens dentro de card separados por `divide-line`.
- Controles de 40px no desktop, 44px no toque; alvos de toque >= 44px.
- Foco: anel de 3px `brand` (global, em `tokens.css`).
- Menu lateral 240px, linhas de 40px; ativo = fundo `muted` + barra âmbar 2px + `aria-current="page"`. Barra inferior mobile: até 5 itens.

## Componentes

`Button` (primary | secondary | ghost | danger; sm | md), `Panel`, `PageHeader`, `StatusBadge`, `Badge`, `Field` (rótulo visível, erro abaixo), `Tabs` (`role=tablist`), `PlateChip` (placa Mercosul), `Skeleton`, `ThemeToggle`, `BrandMark`. Implementados nas tarefas seguintes do refresh.
