import { createContext, useContext } from 'react';
import type { TourMeta } from './estado';
import type { PassoTour, TourDef } from './tipos';

export type Ativo = { def: TourDef; passos: PassoTour[]; auto: boolean };

export type Ctx = {
  /** `null` enquanto o estado da conta não foi lido. */
  meta: TourMeta | null;
  ativo: Ativo | null;
  iniciar: (def: TourDef, opcoes?: { forcar?: boolean }) => void;
  cancelar: (id: string) => void;
  refazer: (def: TourDef) => void;
  pularTodos: () => void;
  /** Cargo de quem está logado (para o botão "?" listar só os guias que a pessoa pode usar). */
  cargo: string | null;
  /** Tour da página que está na tela agora (registrado por `useTourDaPagina`), para o botão "?". */
  paginaDef: TourDef | null;
  registrar: (def: TourDef | null) => void;
};

export const TourContext = createContext<Ctx | null>(null);

export function useTourContext(): Ctx {
  const c = useContext(TourContext);
  if (!c) throw new Error('TourProvider ausente');
  return c;
}

/** Para o botão "?": refaz o tour da página. Sem provedor (testes de componentes), não faz nada. */
export function useTour() {
  const c = useContext(TourContext);
  return { refazer: c?.refazer ?? (() => {}), pularTodos: c?.pularTodos ?? (() => {}), ativo: c?.ativo?.def ?? null, cargo: c?.cargo ?? null, paginaDef: c?.paginaDef ?? null };
}
