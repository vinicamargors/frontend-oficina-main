import type { TourDef } from '../tipos';

export const TOUR_ORDENS: TourDef = {
  id: 'ordens',
  versao: 1,
  passos: [
    { id: 'busca', alvo: 'ordens-busca', titulo: 'Ache uma ordem', texto: 'Digite a placa, o nome do cliente ou o defeito.' },
    { id: 'etapas', alvo: 'ordens-etapas', titulo: 'Filtre por etapa', texto: 'Cada botão mostra quantas ordens estão naquela etapa.' },
    { id: 'lista', alvo: 'ordens-lista', titulo: 'A lista de ordens', texto: 'Toque numa ordem para abrir a bancada: peças, mão de obra, orçamento e pagamento.' },
    { id: 'nova', alvo: 'ordens-nova', titulo: 'Abra uma ordem', texto: 'Escolha o cliente e o veículo, descreva o defeito e pronto.' },
  ],
};
