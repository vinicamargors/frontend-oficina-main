import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCelular, useMediaQuery } from '../../src/lib/useMediaQuery';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function falsoMatchMedia(inicial: boolean) {
  const ouvintes = new Set<() => void>();
  const mql = {
    matches: inicial,
    addEventListener: (_: string, f: () => void) => ouvintes.add(f),
    removeEventListener: (_: string, f: () => void) => ouvintes.delete(f),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    mudar(v: boolean) {
      mql.matches = v;
      ouvintes.forEach((f) => f());
    },
  };
}

describe('useMediaQuery', () => {
  it('lê o valor atual e acompanha mudanças', () => {
    const mm = falsoMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
    expect(result.current).toBe(true);
    act(() => mm.mudar(false));
    expect(result.current).toBe(false);
  });

  it('sem matchMedia devolve false', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
    expect(result.current).toBe(false);
  });
});

describe('useCelular', () => {
  /** matchMedia de uma janela com `largura` CSS px (pode ser fracionária, ex. zoom). */
  function janela(largura: number) {
    vi.stubGlobal('matchMedia', (q: string) => {
      const min = q.match(/min-width:\s*([\d.]+)px/);
      const max = q.match(/max-width:\s*([\d.]+)px/);
      return {
        matches: min ? largura >= Number(min[1]) : max ? largura <= Number(max[1]) : false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    });
  }

  it('é o complemento exato do `lg` do Tailwind (min-width: 1024px), sem buraco em larguras fracionárias', () => {
    for (const [largura, esperado] of [
      [390, true],
      [1023, true],
      [1023.5, true],
      [1024, false],
      [1440, false],
    ] as const) {
      janela(largura);
      const { result, unmount } = renderHook(() => useCelular());
      expect(result.current, `largura ${largura}`).toBe(esperado);
      unmount();
    }
  });
});
