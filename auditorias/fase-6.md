# Fase 6 (front) — datas, folha e formatação

Auditoria independente (agente Playwright, sem editar `src/`), backend simulado (`e2e/mocks`).

| ID | Cenário | Resultado |
|----|---------|-----------|
| F9 | "Hoje" às 22h em São Paulo (relógio fixado 01:00Z): escala, estoque, financeiro, ordens no calendário local | passa (specs existentes) |
| F10 | Dia de pagamento 31, referência 10/2026 → vencimento 30/11/2026; POST `/equipe/folha/{id}/lancar-contas-a-pagar` com `{mes_referencia, data_vencimento, incluir_vales, descricao_custom}` | passa nos 4 projetos |
| F11 | Refresh de token real (`expires_at` +130 s) com texto digitado na bancada: só refaz `usuarios/me`; sem novo GET `/empresas`, dossiê ou mecânicos; texto mantido | passa (verificado pelo auditor, sem spec fixa) |
| — | Folha com erro 500/400: diálogo aberto, `role=alert`, sem toast de sucesso, botão reabilitado; sucesso mostra o total do servidor | passa |
| — | `formatBRL` e links `wa.me` em Radar, Ordens, Estoque, Financeiro, Equipe, Clientes: sem `NaN`/`undefined`, sem `5555` | passa |

Suítes: vitest 303/303; e2e equipe/ordens/estoque/financeiro/clientes/radar/avaliacao 672 verdes + F10 corrigido.

Achados do auditor: (importante) `format.test.ts` fora do `include` do vitest → movido para `tests/unit/`; (cosmético) erro da folha
descartava o `detail` do servidor → agora mostra a mensagem do servidor. Não verificado: datas dd/mm/aaaa em Estoque/Financeiro/Clientes
na tela inicial, trap de Tab do diálogo, nada contra o backend real.
