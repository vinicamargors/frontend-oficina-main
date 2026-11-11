import { describe, expect, it } from 'vitest';
import { filtrarGuias } from '../../src/ajuda/busca';
import { GUIAS } from '../../src/ajuda/guias';

describe('filtrarGuias', () => {
  it('termo vazio lista todos do cargo', () => {
    expect(filtrarGuias(GUIAS, '', 'DONO')).toHaveLength(11);
  });
  it('ignora acento e caixa', () => {
    const r = filtrarGuias(GUIAS, 'ORCAMENTO', 'DONO');
    expect(r.map((g) => g.id)).toContain('orcamento-whatsapp');
  });
  it('só guias do cargo', () => {
    expect(filtrarGuias(GUIAS, '', 'MECANICO').map((g) => g.id)).not.toContain('conta-baixa');
    expect(filtrarGuias(GUIAS, '', 'FINANCEIRO').map((g) => g.id)).toContain('conta-baixa');
  });
  it('nada encontrado', () => {
    expect(filtrarGuias(GUIAS, 'zzzz', 'DONO')).toEqual([]);
  });
  it('todo guia tem passos e ids únicos', () => {
    expect(new Set(GUIAS.map((g) => g.id)).size).toBe(GUIAS.length);
    for (const g of GUIAS) expect(g.passos.length).toBeGreaterThanOrEqual(4);
  });
});
