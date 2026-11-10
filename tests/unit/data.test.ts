import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dataLocalISO, hojeLocalISO } from '../../src/lib/data';
import { dataLocalISO as dataLocalISODoRadar } from '../../src/pages/radar/periodo';

describe('dataLocalISO / hojeLocalISO no calendário local (America/Sao_Paulo)', () => {
  const tzOriginal = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/Sao_Paulo';
  });
  afterAll(() => {
    if (tzOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('22:00 local (01:00Z do dia seguinte) continua sendo hoje', () => {
    const noite = new Date('2026-11-11T01:00:00Z'); // 10/11/2026 22:00 em São Paulo
    expect(noite.toISOString().slice(0, 10)).toBe('2026-11-11'); // o bug: UTC já virou
    expect(dataLocalISO(noite)).toBe('2026-11-10');
  });

  it('hojeLocalISO usa o relógio atual no calendário local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T01:00:00Z'));
    expect(hojeLocalISO()).toBe('2026-11-10');
  });

  it('meses e dias com dois dígitos; virada de ano', () => {
    expect(dataLocalISO(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
    expect(dataLocalISO(new Date('2027-01-01T02:59:00Z'))).toBe('2026-12-31');
    expect(dataLocalISO(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01');
  });

  it('o Radar reexporta o mesmo helper (uma só implementação)', () => {
    expect(dataLocalISODoRadar).toBe(dataLocalISO);
  });
});
