import type { TourDef } from '../tipos';

export const TOUR_EQUIPE: TourDef = {
  id: 'equipe',
  versao: 1,
  passos: [
    { id: 'abas', alvo: 'equipe-abas', titulo: 'Tudo da equipe num lugar', texto: 'Colaboradores, folha de pagamento, escalas, ponto e avaliações dos clientes.' },
    { id: 'novo', alvo: 'equipe-novo', titulo: 'Cadastre um colaborador', texto: 'Informe o cargo: ele define o que a pessoa enxerga no sistema.' },
    { id: 'convidar', alvo: 'equipe-convidar', titulo: 'Convide pelo WhatsApp', texto: 'Gera a mensagem com o link para a pessoa criar o próprio acesso.' },
  ],
};
