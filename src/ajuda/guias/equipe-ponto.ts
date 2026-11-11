import type { GuiaDef } from '../tipos';

export const GUIA_EQUIPE_PONTO: GuiaDef = {
  id: 'equipe-ponto',
  titulo: 'Ponto, escalas e avaliações',
  resumo: 'Bata o ponto por GPS, agende férias e folgas e veja as notas dos clientes.',
  cargos: ['DONO', 'master'],
  palavrasChave: ['ponto', 'gps', 'escala', 'férias', 'folga', 'atestado', 'plantão', 'avaliações'],
  abas: ['equipe'],
  passos: [
    { texto: 'Na aba "Ponto", toque em "Bater ponto agora". O sistema confere o GPS do aparelho.' },
    { texto: 'Dentro do raio do pátio o ponto é aceito. Fora do raio, fica marcado para o gestor conferir.' },
    { texto: 'Na aba "Escalas", use "Agendar férias ou folga" e escolha férias, folga, atestado ou plantão.' },
    { texto: 'Na aba "Avaliações", veja as notas que os clientes deram nas ordens de serviço.' },
  ],
};
