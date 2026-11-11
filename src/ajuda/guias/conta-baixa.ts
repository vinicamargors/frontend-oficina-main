import type { GuiaDef } from '../tipos';

export const GUIA_CONTA_BAIXA: GuiaDef = {
  id: 'conta-baixa',
  titulo: 'Lançar uma conta e dar baixa',
  resumo: 'Registre uma despesa ou receita e marque quando for paga.',
  cargos: ['DONO', 'FINANCEIRO', 'master'],
  palavrasChave: ['conta', 'despesa', 'receita', 'baixa', 'pagar', 'receber', 'lançamento', 'financeiro'],
  abas: ['financeiro'],
  passos: [
    { texto: 'No menu, abra "Caixa & financeiro" e escolha o período.' },
    { texto: 'Toque em "Novo lançamento".' },
    { texto: 'Escolha se é despesa ou receita e informe descrição, categoria, valor e vencimento.' },
    { texto: 'Salve. A conta aparece em "Contas" como pendente.' },
    { texto: 'Quando o dinheiro sair ou entrar, toque em "Pagar" ou "Receber" na linha e confirme a forma de pagamento.' },
  ],
};
