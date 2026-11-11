export type PassoTour = { id: string; alvo: string; titulo: string; texto: string; opcional?: boolean };
export type TourDef = { id: string; versao: number; passos: PassoTour[] };
