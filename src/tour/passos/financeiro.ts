import type { TourDef } from '../tipos';

export const TOUR_FINANCEIRO: TourDef = {
  id: 'financeiro',
  versao: 1,
  passos: [
    { id: 'periodo', alvo: 'financeiro-periodo', titulo: 'Escolha o período', texto: 'Todos os números abaixo mudam conforme o período.' },
    { id: 'abas', alvo: 'financeiro-abas', titulo: 'Seções', texto: 'Contas a pagar e receber, balanço e DRE. Em "Contas" você dá baixa quando o dinheiro entra ou sai.' },
    { id: 'novo', alvo: 'financeiro-novo', titulo: 'Lance uma conta', texto: 'Registre uma despesa ou uma receita avulsa.' },
  ],
};
