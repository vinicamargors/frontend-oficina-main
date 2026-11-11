import { describe, expect, it } from 'vitest';
import { maisAntigas } from '../../src/pages/radar/antigas';
import { textoParada } from '../../src/pages/radar/diasNaEtapa';
import type { StatusOS, UltimaOS } from '../../src/types';

const os = (id: string, status: StatusOS, data: string): UltimaOS => ({
  id,
  status,
  data_abertura: data,
  total_geral: 100,
});

describe('maisAntigas', () => {
  it('junta as 3 respostas, ordena da mais antiga para a mais nova e fica com 5', () => {
    const orc = { items: [os('o1', 'ORCAMENTO', '2026-10-01T10:00:00Z'), os('o2', 'ORCAMENTO', '2026-10-20T10:00:00Z')], total: 2 };
    const agp = { items: [os('a1', 'AGUARDANDO_PECA', '2026-10-05T10:00:00Z'), os('a2', 'AGUARDANDO_PECA', '2026-10-25T10:00:00Z')], total: 9 };
    const exe = { items: [os('e1', 'EXECUCAO', '2026-10-03T10:00:00Z'), os('e2', 'EXECUCAO', '2026-10-30T10:00:00Z')], total: 1 };
    const r = maisAntigas([orc, agp, exe]);
    expect(r.items.map((o) => o.id)).toEqual(['o1', 'e1', 'a1', 'o2', 'a2']);
    expect(r.total).toBe(12);
    expect(r.status).toBeUndefined();
  });

  it('respostas nulas (falha) são ignoradas; sem nada, total 0', () => {
    expect(maisAntigas([null, null, null])).toEqual({ items: [], total: 0, status: undefined });
    const r = maisAntigas([null, { items: [os('a1', 'AGUARDANDO_PECA', '2026-10-05T10:00:00Z')], total: 1 }, null]);
    expect(r.total).toBe(1);
    expect(r.items).toHaveLength(1);
  });

  it('status só quando todas as ordens fora do período estão numa única etapa', () => {
    const r = maisAntigas([{ items: [], total: 0 }, { items: [os('a1', 'AGUARDANDO_PECA', '2026-10-05T10:00:00Z')], total: 3 }, { items: [], total: 0 }]);
    expect(r.status).toBe('AGUARDANDO_PECA');
  });

  it('não muda a ordem de entrada das listas', () => {
    const lista = [os('b', 'ORCAMENTO', '2026-10-20T10:00:00Z'), os('a', 'ORCAMENTO', '2026-10-01T10:00:00Z')];
    maisAntigas([{ items: lista, total: 2 }, null, null]);
    expect(lista.map((o) => o.id)).toEqual(['b', 'a']);
  });
});

describe('textoParada', () => {
  it('singular e plural', () => {
    expect(textoParada(1)).toBe('parada há 1 dia');
    expect(textoParada(9)).toBe('parada há 9 dias');
    expect(textoParada(0)).toBe('parada hoje');
  });
});
