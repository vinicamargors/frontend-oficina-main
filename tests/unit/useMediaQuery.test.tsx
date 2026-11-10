import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../../src/lib/useMediaQuery';

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
