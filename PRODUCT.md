# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

<!-- Inferido do código e das auditorias; confirmar na revisão do plano. -->
- **Dono da oficina:** acompanha o pátio, aprova orçamentos, fecha o caixa, gerencia equipe. Usa no PC do balcão e no celular.
- **Atendente:** abre OS, cadastra cliente e veículo, envia orçamento por WhatsApp. PC do balcão.
- **Mecânico:** vê o que está na bancada, lança peças e mão de obra, avança etapa. Celular, no pátio, luz forte, mãos sujas.
- **Financeiro:** contas a pagar/receber, DRE, folha. PC.
- **Cliente final:** só a página pública de avaliação da OS, pelo link no WhatsApp.

## Product Purpose

Gestão de oficina mecânica: pátio, ordens de serviço, clientes e veículos, estoque de peças, caixa, equipe e RH.
Sucesso: o dono sabe em segundos o que está parado, o que está sendo feito e o que falta receber.

## Positioning

<!-- Inferido do login atual: "Controle total do pátio no celular ou na bancada". -->
Feito para o ritmo do pátio: placa como identidade do serviço, orçamento direto no WhatsApp do cliente, PIX na OS.

## Operating Context

- Etapas da OS: Orçamento → Aguardando peça → Em execução → Finalizado → Pago/entregue.
- Cargos: DONO, ATENDENTE, MECANICO, FINANCEIRO (menu muda por cargo).
- Impressões em papel: OS, holerite, etiqueta de peça (preto no branco).
- Multi-oficina: cada empresa isolada.

## Capabilities and Constraints

- React 18 + Vite + Tailwind 3, sem roteador (estado na URL `?tab=&status=&osId=`).
- Dados só pelo backend (`VITE_API_URL`) e Supabase Auth. Front não grava direto no banco.
- Banco de produção tem cliente real (Autotec Racing): testes visuais usam só dados simulados.

## Brand Commitments

- Nome: **Mecanify**. Idioma: pt-BR.
- Decidido em 2026-11-10: paleta Grafite + Âmbar, tema claro e escuro.

## Evidence on Hand

- Sem logotipo próprio (hoje: ícone `Wrench` do lucide). Sem fotos, depoimentos ou números de clientes: não inventar.

## Product Principles

1. O pátio primeiro: o que está parado aparece antes de qualquer gráfico.
2. Dinheiro nunca muda sem confirmação explícita.
3. Funciona com uma mão, no celular, sob luz forte.
4. Linguagem da oficina, nunca enum de sistema.

## Accessibility & Inclusion

WCAG 2.2 AA: contraste de texto ≥4.5:1, bordas de campo ≥3:1, alvos de toque ≥44px, estado selecionado não só por cor.
