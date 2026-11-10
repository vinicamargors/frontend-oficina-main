import { dataLocalISO } from '../../lib/data';

export type Preset = '7' | '14' | '30';
export type Periodo = { tipo: Preset } | { tipo: 'custom'; de: string; ate: string };

export const CHAVE_PERIODO = 'mecanify_radar_periodo';
export const PRESETS: Preset[] = ['7', '14', '30'];

/** Data no calendário LOCAL como `AAAA-MM-DD` (o formato dos filtros da tela de Ordens). Nunca usa UTC. */
export { dataLocalISO };

function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function diaAnterior(iso: string): string {
  const d = deISO(iso);
  d.setDate(d.getDate() - 1);
  return dataLocalISO(d);
}

/** "Últimos N dias" = hoje mais os N-1 dias anteriores. */
export function intervaloDoPeriodo(p: Periodo, hoje: Date = new Date()): { inicio: string; fim: string } {
  if (p.tipo === 'custom') return { inicio: p.de, fim: p.ate };
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (Number(p.tipo) - 1));
  return { inicio: dataLocalISO(inicio), fim: dataLocalISO(hoje) };
}

const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function rotuloPeriodo(p: Periodo): string {
  return p.tipo === 'custom' ? `${curta(p.de)} – ${curta(p.ate)}` : `${p.tipo} dias`;
}

/** Mensagem de erro, ou null quando o intervalo é válido. */
export function validarPersonalizado(de: string, ate: string, hoje: Date = new Date()): string | null {
  if (!de) return 'Informe a data inicial.';
  if (!ate) return 'Informe a data final.';
  const limite = dataLocalISO(hoje);
  if (de > limite || ate > limite) return 'As datas não podem estar no futuro.';
  if (ate < de) return 'A data final não pode ser anterior à inicial.';
  return null;
}

export function lerPresetSalvo(): Preset {
  try {
    const v = localStorage.getItem(CHAVE_PERIODO);
    if (v && (PRESETS as string[]).includes(v)) return v as Preset;
  } catch {
    /* localStorage indisponível */
  }
  return '7';
}

export function salvarPreset(p: Preset): void {
  try {
    localStorage.setItem(CHAVE_PERIODO, p);
  } catch {
    /* localStorage indisponível */
  }
}
