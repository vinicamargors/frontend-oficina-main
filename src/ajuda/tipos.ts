export type Cargo = 'DONO' | 'ATENDENTE' | 'MECANICO' | 'FINANCEIRO' | 'master';

export type PassoGuia = {
  texto: string;
  /** Print limpo gerado por `npm run ajuda:prints` e os elementos (`data-tour`) que ganham marcador numerado. */
  imagem?: { arquivo: string; alvos: string[]; variante390?: boolean; alt: string };
};

export type GuiaDef = {
  id: string;
  titulo: string;
  resumo: string;
  cargos: Cargo[];
  palavrasChave: string[];
  /** Abas (`?tab=`) em que o botão "?" oferece este guia. */
  abas: string[];
  passos: PassoGuia[];
};

export const TODOS_OS_CARGOS: Cargo[] = ['DONO', 'ATENDENTE', 'MECANICO', 'FINANCEIRO', 'master'];
