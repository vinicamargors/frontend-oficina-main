import type { TourDef } from '../tipos';

export const TOUR_BANCADA: TourDef = {
  id: 'bancada',
  versao: 1,
  passos: [
    { id: 'etapa', alvo: 'os-etapa', titulo: 'Etapa do serviço', texto: 'Mostra em que etapa a ordem está e permite mudar. Sempre pede confirmação.' },
    { id: 'lancar', alvo: 'os-lancar-item', titulo: 'Lance peças e serviços', texto: 'Peça do estoque, peça avulsa, mão de obra ou terceirizado. O total se atualiza.' },
    { id: 'total', alvo: 'os-total', titulo: 'Total da ordem', texto: 'Soma de peças e mão de obra, com o lucro estimado.' },
    { id: 'whatsapp', alvo: 'os-whatsapp', titulo: 'Mande o orçamento', texto: 'Envia o orçamento ao cliente pelo WhatsApp. Também dá para imprimir.' },
  ],
};
