import type { TourDef } from '../tipos';

export const TOUR_CLIENTES: TourDef = {
  id: 'clientes',
  versao: 1,
  passos: [
    { id: 'busca', alvo: 'clientes-busca', titulo: 'Busque rápido', texto: 'Procure por placa, nome, WhatsApp, CPF ou modelo.' },
    { id: 'abas', alvo: 'clientes-abas', titulo: 'Clientes ou placas', texto: 'Alterne entre a lista de clientes e a lista de veículos.' },
    { id: 'lista', alvo: 'clientes-lista', titulo: 'Ações de cada linha', texto: 'Use o menu "…" da linha para editar, abrir uma ordem ou ver o histórico.' },
    { id: 'novo', alvo: 'clientes-novo', titulo: 'Cadastre um cliente', texto: 'Cadastre o cliente e os veículos dele de uma vez.' },
  ],
};
