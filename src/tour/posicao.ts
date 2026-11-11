import type { PassoTour, TourDef } from './tipos';

export const CARTAO_L = 340;
export const CARTAO_A = 220;
const FOLGA = 12;

type Caixa = { top: number; left: number; width: number; height: number };

/** Onde o cartão fica: abaixo do alvo se couber, senão acima, senão preso à base; no celular, sempre na base acima da barra. */
export function posicionarCartao(
  alvo: Caixa,
  vp: { w: number; h: number },
  celular: boolean,
  barraH: number
): { top: number; left: number; modo: 'abaixo' | 'acima' | 'base' } {
  if (celular) return { top: vp.h - barraH - CARTAO_A - FOLGA, left: FOLGA, modo: 'base' };
  const left = Math.min(Math.max(alvo.left, FOLGA), Math.max(FOLGA, vp.w - CARTAO_L - FOLGA));
  const abaixo = alvo.top + alvo.height + FOLGA;
  if (abaixo + CARTAO_A <= vp.h - FOLGA) return { top: abaixo, left, modo: 'abaixo' };
  const acima = alvo.top - CARTAO_A - FOLGA;
  if (acima >= FOLGA) return { top: acima, left, modo: 'acima' };
  return { top: Math.max(FOLGA, vp.h - CARTAO_A - FOLGA), left, modo: 'base' };
}

/** O primeiro elemento marcado que está visível (a mesma marca pode existir no layout de desktop e no de celular). */
export function elementoDoAlvo(doc: Document, alvo: string): HTMLElement | null {
  const todos = Array.from(doc.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`));
  return todos.find((el) => visivel(el)) ?? todos[0] ?? null;
}

export function visivel(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  return getComputedStyle(el).visibility !== 'hidden';
}

/** Só os passos cujo elemento existe e está visível agora. */
export function passosVisiveis(def: TourDef, doc: Document): PassoTour[] {
  return def.passos.filter((p) => visivel(elementoDoAlvo(doc, p.alvo)));
}
