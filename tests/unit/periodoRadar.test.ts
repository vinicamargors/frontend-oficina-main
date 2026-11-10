import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHAVE_PERIODO,
  dataLocalISO,
  diaAnterior,
  intervaloDoPeriodo,
  lerPresetSalvo,
  rotuloPeriodo,
  salvarPreset,
  validarPersonalizado,
} from '../../src/pages/radar/periodo';

// 10/11/2026 às 23:30 no horário local: não pode virar dia 11 (nada de toISOString/UTC)
const hoje = new Date(2026, 10, 10, 23, 30);

describe('dataLocalISO', () => {
  it('usa o calendário local, não UTC', () => {
    expect(dataLocalISO(hoje)).toBe('2026-11-10');
    expect(dataLocalISO(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
});

describe('intervaloDoPeriodo', () => {
  it('7 dias = hoje e os 6 dias anteriores', () => {
    expect(intervaloDoPeriodo({ tipo: '7' }, hoje)).toEqual({ inicio: '2026-11-04', fim: '2026-11-10' });
  });
  it('14 e 30 dias, atravessando mês e ano', () => {
    expect(intervaloDoPeriodo({ tipo: '14' }, hoje)).toEqual({ inicio: '2026-10-28', fim: '2026-11-10' });
    expect(intervaloDoPeriodo({ tipo: '30' }, new Date(2027, 0, 10))).toEqual({ inicio: '2026-12-12', fim: '2027-01-10' });
  });
  it('personalizado devolve as datas escolhidas', () => {
    expect(intervaloDoPeriodo({ tipo: 'custom', de: '2026-11-01', ate: '2026-11-09' }, hoje)).toEqual({
      inicio: '2026-11-01',
      fim: '2026-11-09',
    });
  });
});

describe('diaAnterior', () => {
  it('volta um dia no calendário', () => {
    expect(diaAnterior('2026-11-04')).toBe('2026-11-03');
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28');
    expect(diaAnterior('2027-01-01')).toBe('2026-12-31');
  });
});

describe('rotuloPeriodo', () => {
  it('preset e intervalo personalizado', () => {
    expect(rotuloPeriodo({ tipo: '7' })).toBe('7 dias');
    expect(rotuloPeriodo({ tipo: '30' })).toBe('30 dias');
    expect(rotuloPeriodo({ tipo: 'custom', de: '2026-11-01', ate: '2026-11-10' })).toBe('01/11 – 10/11');
  });
});

describe('validarPersonalizado', () => {
  it('aceita intervalo válido', () => {
    expect(validarPersonalizado('2026-11-01', '2026-11-10', hoje)).toBeNull();
    expect(validarPersonalizado('2026-11-10', '2026-11-10', hoje)).toBeNull();
  });
  it('exige as duas datas, fim >= início e nada no futuro', () => {
    expect(validarPersonalizado('', '2026-11-10', hoje)).toMatch(/data inicial/i);
    expect(validarPersonalizado('2026-11-01', '', hoje)).toMatch(/data final/i);
    expect(validarPersonalizado('2026-11-10', '2026-11-09', hoje)).toMatch(/anterior/i);
    expect(validarPersonalizado('2026-11-01', '2026-11-11', hoje)).toMatch(/futur/i);
    expect(validarPersonalizado('2026-11-12', '2026-11-12', hoje)).toMatch(/futur/i);
  });
});

describe('preset salvo', () => {
  beforeEach(() => localStorage.clear());
  it('padrão é 7 dias', () => {
    expect(lerPresetSalvo()).toBe('7');
  });
  it('lê o que foi salvo e ignora valor inválido', () => {
    salvarPreset('30');
    expect(localStorage.getItem(CHAVE_PERIODO)).toBe('30');
    expect(lerPresetSalvo()).toBe('30');
    localStorage.setItem(CHAVE_PERIODO, 'abc');
    expect(lerPresetSalvo()).toBe('7');
  });
});
