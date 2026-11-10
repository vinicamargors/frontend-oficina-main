// Rótulos acentuados só para exibição; o valor guardado e enviado ao backend não muda (ex.: "PECAS").
const ROTULOS_CATEGORIA: Record<string, string> = {
  PECAS: 'Peças',
  FLUIDOS: 'Fluidos',
  PNEUS: 'Pneus',
  ELETRICA: 'Elétrica',
  ACESSORIOS: 'Acessórios',
  FERRAMENTAS: 'Ferramentas',
  DIVERSOS: 'Diversos',
  FILTROS: 'Filtros',
  FREIOS: 'Freios',
  IGNICAO: 'Ignição',
  SUSPENSAO: 'Suspensão',
  MOTOR: 'Motor',
};

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Texto da categoria para a tela: conhecidas ganham acento; as demais viram "Primeira maiúscula". */
export function rotuloCategoria(categoria?: string | null): string {
  const bruto = (categoria || 'PECAS').trim();
  const chave = semAcento(bruto).toUpperCase();
  if (ROTULOS_CATEGORIA[chave]) return ROTULOS_CATEGORIA[chave];
  const minusculo = bruto.toLocaleLowerCase('pt-BR');
  return minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1);
}

/** Abaixo ou no mínimo de alerta (mesma regra dos indicadores e do filtro "Crítico"). */
export const estaCritico = (quantidade?: number | null, minimo?: number | null): boolean =>
  (quantidade ?? 0) <= (minimo ?? 5);

/** Margem sobre o preço de venda, em %; sem custo informado vale 100 (regra original da tela). */
export function margemPercentual(custo: number, venda: number): number {
  return custo > 0 ? ((venda - custo) / venda) * 100 : 100;
}

/** Saldo depois de um ajuste de estoque (entrada soma, saída subtrai). */
export const saldoApos = (saldo: number, tipo: 'entrada' | 'saida', quantidade: number): number =>
  tipo === 'entrada' ? saldo + quantidade : saldo - quantidade;
