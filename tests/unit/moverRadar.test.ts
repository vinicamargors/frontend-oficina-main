import { describe, expect, it } from 'vitest';
import {
  ETAPAS_QUADRO,
  anuncioMovida,
  destinosDe,
  ehEtapaDoQuadro,
  moverNoQuadro,
  podeMudarEtapa,
  podeSoltar,
  tituloMover,
  type EtapasQuadro,
} from '../../src/pages/radar/mover';
import type { StatusOS, UltimaOS } from '../../src/types';

const os = (id: string, status: StatusOS): UltimaOS => ({
  id,
  status,
  data_abertura: '2026-11-01T10:00:00Z',
  total_geral: 100,
  veiculos: { placa: `P${id}`, modelo: 'Gol' },
});

const quadro = (): EtapasQuadro => ({
  ORCAMENTO: { items: [os('o1', 'ORCAMENTO'), os('o2', 'ORCAMENTO')], total: 2 },
  AGUARDANDO_PECA: { items: [os('a1', 'AGUARDANDO_PECA')], total: 1 },
  EXECUCAO: { items: [os('e1', 'EXECUCAO')], total: 7 },
  FINALIZADO: { items: [], total: 0 },
  PAGO: { items: [], total: 0 },
});

describe('etapas do quadro', () => {
  it('são as 4 colunas na ordem do fluxo; Pago não é coluna', () => {
    expect(ETAPAS_QUADRO).toEqual(['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO', 'FINALIZADO']);
    expect(ehEtapaDoQuadro('PAGO')).toBe(false);
    expect(ehEtapaDoQuadro('EXECUCAO')).toBe(true);
    expect(ehEtapaDoQuadro('QUALQUER')).toBe(false);
    expect(ehEtapaDoQuadro(undefined)).toBe(false);
  });

  it('destinos: as outras 3 colunas, para frente e para trás, sem Pago', () => {
    expect(destinosDe('ORCAMENTO')).toEqual(['AGUARDANDO_PECA', 'EXECUCAO', 'FINALIZADO']);
    expect(destinosDe('FINALIZADO')).toEqual(['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO']);
    expect(destinosDe('PAGO')).toEqual([]);
  });

  it('soltar só vale em outra coluna do quadro', () => {
    expect(podeSoltar('ORCAMENTO', 'EXECUCAO')).toBe(true);
    expect(podeSoltar('FINALIZADO', 'ORCAMENTO')).toBe(true);
    expect(podeSoltar('ORCAMENTO', 'ORCAMENTO')).toBe(false);
    expect(podeSoltar('EXECUCAO', 'PAGO')).toBe(false);
    expect(podeSoltar('PAGO', 'EXECUCAO')).toBe(false);
    expect(podeSoltar('ORCAMENTO', null)).toBe(false);
  });
});

describe('quem pode mudar a etapa (mesma regra das etapas na Ordem)', () => {
  it('todos os cargos da oficina podem, como no passo a passo da OS', () => {
    for (const cargo of ['master', 'DONO', 'MECANICO', 'ATENDENTE', 'FINANCEIRO']) expect(podeMudarEtapa(cargo)).toBe(true);
  });
  it('sem usuário ou cargo desconhecido não pode', () => {
    expect(podeMudarEtapa(undefined)).toBe(false);
    expect(podeMudarEtapa(null)).toBe(false);
    expect(podeMudarEtapa('VISITANTE')).toBe(false);
    expect(podeMudarEtapa('')).toBe(false);
  });
});

describe('moverNoQuadro (movimento otimista)', () => {
  it('tira da origem, põe no topo do destino com o novo status e acerta as contagens', () => {
    const antes = quadro();
    const depois = moverNoQuadro(antes, 'o2', 'ORCAMENTO', 'EXECUCAO');
    expect(depois.ORCAMENTO.items.map((o) => o.id)).toEqual(['o1']);
    expect(depois.ORCAMENTO.total).toBe(1);
    expect(depois.EXECUCAO.items.map((o) => o.id)).toEqual(['o2', 'e1']);
    expect(depois.EXECUCAO.items[0].status).toBe('EXECUCAO');
    expect(depois.EXECUCAO.total).toBe(8);
    // não muta o quadro anterior (é ele que volta no rollback)
    expect(antes.ORCAMENTO.items.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(antes.EXECUCAO.total).toBe(7);
    expect(antes.ORCAMENTO.items[1].status).toBe('ORCAMENTO');
  });

  it('coluna vazia recebe o card', () => {
    const depois = moverNoQuadro(quadro(), 'a1', 'AGUARDANDO_PECA', 'FINALIZADO');
    expect(depois.FINALIZADO).toEqual({ items: [expect.objectContaining({ id: 'a1', status: 'FINALIZADO' })], total: 1 });
    expect(depois.AGUARDANDO_PECA).toEqual({ items: [], total: 0 });
  });

  it('mesma coluna, destino fora do quadro ou ordem que não está na origem: nada muda', () => {
    const q = quadro();
    expect(moverNoQuadro(q, 'o1', 'ORCAMENTO', 'ORCAMENTO')).toBe(q);
    expect(moverNoQuadro(q, 'o1', 'ORCAMENTO', 'PAGO')).toBe(q);
    expect(moverNoQuadro(q, 'zz', 'ORCAMENTO', 'EXECUCAO')).toBe(q);
  });

  it('total nunca fica negativo', () => {
    const q = quadro();
    q.ORCAMENTO.total = 0;
    expect(moverNoQuadro(q, 'o1', 'ORCAMENTO', 'EXECUCAO').ORCAMENTO.total).toBe(0);
  });
});

describe('textos', () => {
  it('título da folha e anúncio usam a placa e o rótulo legível', () => {
    expect(tituloMover('ABC1D23', 'EXECUCAO')).toBe('Mover ABC1D23 para Em execução?');
    expect(anuncioMovida('ABC1D23', 'AGUARDANDO_PECA')).toBe('ABC1D23 movida para Aguardando peça');
  });
});
