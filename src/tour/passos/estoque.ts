import type { TourDef } from '../tipos';

export const TOUR_ESTOQUE: TourDef = {
  id: 'estoque',
  versao: 1,
  passos: [
    { id: 'busca', alvo: 'estoque-busca', titulo: 'Busque uma peça', texto: 'Procure pelo nome, código ou categoria.' },
    { id: 'categorias', alvo: 'estoque-categorias', titulo: 'Categorias e reposição', texto: 'Filtre por categoria. O filtro "Crítico" mostra o que está no mínimo e precisa de reposição.' },
    { id: 'lista', alvo: 'estoque-lista', titulo: 'Entrada e saída', texto: 'Use o menu "…" da peça para dar entrada, baixa, editar ou imprimir etiqueta.' },
    { id: 'nova', alvo: 'estoque-nova', titulo: 'Cadastre uma peça', texto: 'Informe nome, código, quantidade, custo e preço de venda.' },
  ],
};
