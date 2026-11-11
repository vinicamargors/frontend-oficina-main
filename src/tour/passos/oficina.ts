import type { TourDef } from '../tipos';

export const TOUR_OFICINA: TourDef = {
  id: 'oficina',
  versao: 1,
  passos: [
    { id: 'identificacao', alvo: 'oficina-identificacao', titulo: 'Identificação', texto: 'Nome, documentos e contatos. Aparecem na ordem de serviço impressa.' },
    { id: 'pix', alvo: 'oficina-pix', titulo: 'PIX da oficina', texto: 'A chave que o cliente usa para pagar a ordem de serviço.' },
    { id: 'gps', alvo: 'oficina-gps', titulo: 'Ponto por GPS', texto: 'A equipe só bate o ponto dentro do raio do pátio. O endereço com CEP preenche o mapa.' },
    { id: 'folha', alvo: 'oficina-folha', titulo: 'Folha e comissões', texto: 'Regras padrão, usadas quando o colaborador não tem taxa própria.' },
  ],
};
