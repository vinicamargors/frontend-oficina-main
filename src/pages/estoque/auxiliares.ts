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

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Chave de comparação de categorias: sem acento, maiúscula e sem espaços nas pontas. */
export const chaveCategoria = (categoria: string): string => semAcento(categoria.trim()).toUpperCase();

/**
 * Texto da categoria para a tela. Só as chaves canônicas do backend (sem acento: PECAS, ELETRICA...) ganham acento;
 * qualquer outro valor aparece como foi digitado, com a primeira maiúscula. O valor guardado/enviado não muda.
 */
export function rotuloCategoria(categoria?: string | null): string {
  const bruto = (categoria || 'PECAS').trim();
  const canonico = ROTULOS_CATEGORIA[bruto.toUpperCase()];
  if (canonico) return canonico;
  const minusculo = bruto.toLocaleLowerCase('pt-BR');
  return minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1);
}

/**
 * Rótulo de cada categoria da lista (chave = valor bruto em maiúsculas). Valores diferentes que dariam o mesmo
 * texto (ex.: "ELETRICA" e "ELÉTRICA") mostram o valor bruto entre parênteses para ficarem distinguíveis.
 */
export function rotulosDasCategorias(categorias: string[]): Record<string, string> {
  const brutos = Array.from(new Set(categorias.map((c) => c.toUpperCase())));
  const porTexto = new Map<string, string[]>();
  for (const c of brutos) {
    const t = rotuloCategoria(c).toLocaleLowerCase('pt-BR');
    porTexto.set(t, [...(porTexto.get(t) ?? []), c]);
  }
  const mapa: Record<string, string> = {};
  for (const c of brutos) {
    const colide = (porTexto.get(rotuloCategoria(c).toLocaleLowerCase('pt-BR')) ?? []).length > 1;
    mapa[c] = colide ? `${rotuloCategoria(c)} (${c})` : rotuloCategoria(c);
  }
  return mapa;
}

/** Categoria já cadastrada equivalente a `nome` (ignora acento e caixa); `undefined` se for nova. */
export const categoriaEquivalente = (categorias: string[], nome: string): string | undefined =>
  categorias.find((c) => chaveCategoria(c) === chaveCategoria(nome));

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
