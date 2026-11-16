import { formatBRL, formatData } from '../../lib/format';
export { formatBRL, formatData };
import type { StatusTransacao, TipoTransacao } from '../../types';
import { dataLocalISO } from '../../lib/data';

export type AtalhoPeriodo = 'HOJE' | '7D' | '30D' | 'MES_ATUAL' | 'MES_ANTERIOR' | 'ANO_ATUAL';

/** Predefinições do seletor único de período; "Personalizado" (CUSTOM) revela as datas. */
export const PERIODOS: { id: AtalhoPeriodo | 'CUSTOM'; rotulo: string }[] = [
  { id: 'HOJE', rotulo: 'Hoje' },
  { id: '7D', rotulo: 'Últimos 7 dias' },
  { id: '30D', rotulo: 'Últimos 30 dias' },
  { id: 'MES_ATUAL', rotulo: 'Este mês' },
  { id: 'MES_ANTERIOR', rotulo: 'Mês anterior' },
  { id: 'ANO_ATUAL', rotulo: 'Ano atual' },
  { id: 'CUSTOM', rotulo: 'Personalizado' },
];



/** Percentual com uma casa e vírgula (só exibição; o CSV mantém o formato original). */
export const formatPct = (valor: number) => `${valor.toFixed(1).replace('.', ',')}%`;

/** Receita sempre com "+", despesa sempre com "−" (U+2212): o sinal vem do tipo, nunca só da cor. */
export const valorComSinal = (valor: number, tipo: TipoTransacao) =>
  `${tipo === 'DESPESA' ? '−' : '+'} ${formatBRL(Math.abs(Number(valor || 0)))}`;

/** Resultado (lucro/posição): sem sinal quando positivo; "−" explícito quando negativo. */
export const lucroComSinal = (valor: number) => (valor < 0 ? `− ${formatBRL(-valor)}` : formatBRL(valor));

/**
 * Intervalo `AAAA-MM-DD` de cada predefinição, no calendário LOCAL (`dataLocalISO`). O original usava
 * toISOString (UTC): depois das 21h em São Paulo "hoje" virava amanhã.
 */
export function intervaloDoAtalho(atalho: AtalhoPeriodo, hoje: Date = new Date()): { inicio: string; fim: string } {
  const formatYMD = dataLocalISO;
  if (atalho === 'HOJE') {
    const hStr = formatYMD(hoje);
    return { inicio: hStr, fim: hStr };
  }
  if (atalho === '7D' || atalho === '30D') {
    const d = new Date(hoje.getTime());
    d.setDate(d.getDate() - (atalho === '7D' ? 7 : 30));
    return { inicio: formatYMD(d), fim: formatYMD(hoje) };
  }
  if (atalho === 'MES_ATUAL') {
    return { inicio: formatYMD(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: formatYMD(hoje) };
  }
  if (atalho === 'MES_ANTERIOR') {
    return {
      inicio: formatYMD(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      fim: formatYMD(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    };
  }
  return { inicio: formatYMD(new Date(hoje.getFullYear(), 0, 1)), fim: formatYMD(hoje) };
}

export function rotuloPeriodo(atalho: AtalhoPeriodo | 'CUSTOM', inicio: string, fim: string): string {
  if (atalho === 'CUSTOM') return `${formatData(inicio)} a ${formatData(fim)}`;
  return PERIODOS.find((p) => p.id === atalho)?.rotulo ?? `${formatData(inicio)} a ${formatData(fim)}`;
}

// Só exibição: o valor guardado/enviado ao backend continua o código (ex.: "ENERGIA_AGUA").
const ROTULOS_CATEGORIA: Record<string, string> = {
  ALUGUEL: 'Aluguel',
  ENERGIA_AGUA: 'Energia e água',
  TAXAS_MAQUININHA: 'Taxas de maquininha',
  FOLHA_PAGAMENTO: 'Folha de pagamento',
  COMISSAO: 'Comissão',
  IMPOSTOS: 'Impostos',
  MANUTENCAO: 'Manutenção',
  FORNECEDORES: 'Fornecedores',
  OUTROS: 'Outros',
  APORTE: 'Aporte',
  VENDA_SUCATA: 'Venda de sucata',
  SUBLOCACAO: 'Sublocação',
  SEGURO_GARANTIA: 'Seguro / garantia',
  RENDIMENTO: 'Rendimento',
};

export function rotuloCategoriaFinanceira(categoria?: string | null): string {
  const bruto = (categoria || '').trim();
  if (!bruto) return 'Outros';
  const canonico = ROTULOS_CATEGORIA[bruto.toUpperCase()];
  if (canonico) return canonico;
  const texto = bruto.replace(/_/g, ' ').toLocaleLowerCase('pt-BR');
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}

export function rotuloStatus(status: StatusTransacao, tipo: TipoTransacao): string {
  if (status === 'LIQUIDADO') return tipo === 'DESPESA' ? 'Pago' : 'Recebido';
  if (status === 'ATRASADO') return 'Atrasado';
  if (status === 'CANCELADO') return 'Cancelado';
  return 'Pendente';
}
