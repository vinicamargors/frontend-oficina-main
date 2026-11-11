import type { StatusOS, UltimaOS } from '../../types';

/** Etapas em aberto: ordens antigas nelas ficam fora do período e merecem aviso. Ordem = ordem das leituras. */
export const ABERTAS: StatusOS[] = ['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO'];

export interface RespostaOS {
  items: UltimaOS[];
  total: number;
}

export interface Antigas {
  /** Soma dos totais das leituras (todas as ordens abertas anteriores ao período). */
  total: number;
  /** As mais antigas primeiro, no máximo `limite`. */
  items: UltimaOS[];
  /** Etapa única quando todas as ordens fora do período estão nela; senão indefinido. */
  status?: StatusOS;
}

/**
 * Junta as leituras por etapa (cada uma já pedida da mais antiga para a mais nova), ordena por `data_abertura`
 * crescente e fica com as `limite` primeiras. Resposta nula (leitura que falhou) conta como vazia.
 */
export function maisAntigas(
  respostas: Array<RespostaOS | null | undefined>,
  limite = 5,
  etapas: StatusOS[] = ABERTAS
): Antigas {
  const juntas = respostas.flatMap((r) => r?.items ?? []);
  const items = [...juntas]
    .sort((a, b) => new Date(a.data_abertura).getTime() - new Date(b.data_abertura).getTime())
    .slice(0, limite);
  const comOrdens = etapas.filter((_, i) => (respostas[i]?.total ?? 0) > 0);
  return {
    total: respostas.reduce((soma, r) => soma + (r?.total ?? 0), 0),
    items,
    status: comOrdens.length === 1 ? comOrdens[0] : undefined,
  };
}
