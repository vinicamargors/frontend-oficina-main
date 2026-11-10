import type { StatusOS } from '../../types';

const DIA_MS = 24 * 60 * 60 * 1000;

export type NivelAtraso = 'ok' | 'atencao' | 'atrasado';

/** Conta períodos completos de 24h (não dias de calendário). Dias inteiros desde `dataISO` (o backend só envia `data_abertura`). Nunca negativo. */
export function diasDesde(dataISO: string, agora: Date = new Date()): number {
  const inicio = new Date(dataISO).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((agora.getTime() - inicio) / DIA_MS));
}

/** Orçamento e Aguardando peça: mais de 3 dias pede atenção, mais de 7 é atraso. */
export function nivelAtraso(status: StatusOS, dias: number): NivelAtraso {
  if (status !== 'ORCAMENTO' && status !== 'AGUARDANDO_PECA') return 'ok';
  if (dias > 7) return 'atrasado';
  if (dias > 3) return 'atencao';
  return 'ok';
}

/** "aberta hoje" / "aberta há 1 dia" / "aberta há N dias". */
export function textoDias(dias: number): string {
  return dias === 0 ? 'aberta hoje' : `aberta há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}
