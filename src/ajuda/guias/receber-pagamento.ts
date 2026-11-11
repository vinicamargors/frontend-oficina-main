import type { GuiaDef } from '../tipos';
import { TODOS_OS_CARGOS } from '../tipos';

export const GUIA_RECEBER_PAGAMENTO: GuiaDef = {
  id: 'receber-pagamento',
  titulo: 'Receber o pagamento',
  resumo: 'Marque a ordem como paga e escolha a forma de pagamento.',
  cargos: TODOS_OS_CARGOS,
  palavrasChave: ['pagamento', 'pago', 'pix', 'cartão', 'dinheiro', 'receber', 'entregar'],
  abas: ['os', 'patio'],
  passos: [
    { texto: 'Quando o serviço terminar, mova a ordem para "Finalizado".' },
    { texto: 'Na linha da ordem, toque em "Receber / dar baixa".' },
    { texto: 'Confira o total mostrado na tela de confirmação.' },
    { texto: 'Escolha a forma de pagamento: PIX, cartão de crédito, cartão de débito, dinheiro ou boleto. Nenhuma vem marcada.' },
    { texto: 'Toque em "Confirmar pagamento". A ordem passa para "Pago" e entra no caixa.' },
  ],
};
