import type { TourDef } from '../tipos';

export const TOUR_RADAR: TourDef = {
  id: 'radar',
  versao: 1,
  passos: [
    {
      id: 'periodo',
      alvo: 'radar-periodo',
      titulo: 'Escolha o período',
      texto: 'Mostra as ordens abertas nesse intervalo. O padrão são os últimos 7 dias.',
    },
    {
      id: 'quadro',
      alvo: 'radar-quadro',
      titulo: 'O pátio por etapa',
      texto: 'Cada card é um veículo. Toque para abrir a ordem. Para mudar de etapa, arraste o card ou use o menu "…". Sempre pede confirmação.',
    },
    {
      id: 'antigas',
      alvo: 'radar-antigas',
      titulo: 'Ordens mais antigas',
      texto: 'Ordens abertas antes do período aparecem aqui, para nada ficar esquecido.',
      opcional: true,
    },
    {
      id: 'nova-os',
      alvo: 'radar-nova-os',
      titulo: 'Abra uma ordem',
      texto: 'Comece por aqui: cadastre o veículo e o serviço de um cliente que chegou.',
    },
  ],
};
