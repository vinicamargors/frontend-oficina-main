import { TOUR_CLIENTES } from './passos/clientes';
import { TOUR_ESTOQUE } from './passos/estoque';
import { TOUR_FINANCEIRO } from './passos/financeiro';
import { TOUR_ORDENS } from './passos/ordens';
import { TOUR_RADAR } from './passos/radar';
import type { TourDef } from './tipos';

/** Tour de cada aba (`?tab=`), para o botão "?". */
export const TOUR_POR_ABA: Record<string, TourDef> = {
  patio: TOUR_RADAR,
  os: TOUR_ORDENS,
  clientes: TOUR_CLIENTES,
  veiculos: TOUR_CLIENTES,
  estoque: TOUR_ESTOQUE,
  financeiro: TOUR_FINANCEIRO,
};
