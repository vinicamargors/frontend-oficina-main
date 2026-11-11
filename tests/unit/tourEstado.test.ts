import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarEspelho, comPularTodos, comVisto, jaViu, lerEstado, salvarEspelho } from '../../src/tour/estado';

beforeEach(() => localStorage.clear());

describe('estado do tour', () => {
  it('conta nova: vazio', () => {
    expect(lerEstado(undefined, null)).toEqual({ tours: {} });
  });
  it('metadados inválidos viram vazio', () => {
    expect(lerEstado('x', null)).toEqual({ tours: {} });
    expect(lerEstado({ tours: 'a' }, null)).toEqual({ tours: {} });
    expect(lerEstado({ tours: { radar: 'um' } }, null)).toEqual({ tours: {} });
  });
  it('jaViu compara versões', () => {
    const m = { tours: { radar: 2 } };
    expect(jaViu(m, 'radar', 2)).toBe(true);
    expect(jaViu(m, 'radar', 1)).toBe(true);
    expect(jaViu(m, 'radar', 3)).toBe(false);
    expect(jaViu(m, 'ordens', 1)).toBe(false);
  });
  it('comVisto não muta e mantém a maior versão', () => {
    const m = { tours: { radar: 2 } };
    const n = comVisto(m, 'ordens', 1);
    expect(m).toEqual({ tours: { radar: 2 } });
    expect(n.tours).toEqual({ radar: 2, ordens: 1 });
    expect(comVisto(n, 'radar', 1).tours.radar).toBe(2);
  });
  it('comPularTodos', () => {
    expect(comPularTodos({ tours: {} }).tours_pular_todos).toBe(true);
  });
  it('une conta e espelho', () => {
    const r = lerEstado({ tours: { radar: 1 } }, { tours: { radar: 2, ordens: 1 }, tours_pular_todos: true });
    expect(r).toEqual({ tours: { radar: 2, ordens: 1 }, tours_pular_todos: true });
  });
  it('espelhos de usuários diferentes não se misturam', () => {
    salvarEspelho('a', { tours: { radar: 1 } });
    expect(carregarEspelho('b')).toBeNull();
    expect(carregarEspelho('a')).toEqual({ tours: { radar: 1 } });
  });
  it('localStorage com erro não quebra', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(carregarEspelho('a')).toBeNull();
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => salvarEspelho('a', { tours: {} })).not.toThrow();
    set.mockRestore();
  });
});
