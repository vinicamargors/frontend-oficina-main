import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '../../src/lib/useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('começa com o valor inicial', () => {
    const { result } = renderHook(() => useDebouncedValue('abc', 300));
    expect(result.current).toBe('abc');
  });

  it('só entrega o último valor depois de uma pausa', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: '' } });
    for (const v of ['A', 'AB', 'ABC', 'ABC1', 'ABC12']) {
      rerender({ v });
      act(() => vi.advanceTimersByTime(100));
      expect(result.current).toBe('');
    }
    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe('');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ABC12');
  });
});
