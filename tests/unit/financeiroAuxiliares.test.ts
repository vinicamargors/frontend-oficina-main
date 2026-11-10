import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  PERIODOS,
  formatBRL,
  formatData,
  intervaloDoAtalho,
  lucroComSinal,
  rotuloCategoriaFinanceira,
  rotuloPeriodo,
  rotuloStatus,
  valorComSinal,
} from '../../src/pages/financeiro/auxiliares';

const nb = (s: string) => s.replace(/\s/g, ' ');

describe('valorComSinal', () => {
  it('receita sempre com +, despesa sempre com − (sinal de menos tipográfico)', () => {
    expect(nb(valorComSinal(120, 'RECEITA'))).toBe('+ R$ 120,00');
    expect(nb(valorComSinal(4800, 'DESPESA'))).toBe('− R$ 4.800,00');
  });
  it('usa o valor absoluto (o sinal vem só do tipo)', () => {
    expect(nb(valorComSinal(-10, 'DESPESA'))).toBe('− R$ 10,00');
  });
});

describe('lucroComSinal', () => {
  it('positivo sem sinal; negativo com −', () => {
    expect(nb(lucroComSinal(4335.5))).toBe('R$ 4.335,50');
    expect(nb(lucroComSinal(-12.3))).toBe('− R$ 12,30');
    expect(nb(lucroComSinal(0))).toBe('R$ 0,00');
  });
});

describe('formatação', () => {
  it('formatBRL e formatData como antes', () => {
    expect(nb(formatBRL(null))).toBe('R$ 0,00');
    expect(formatData('2026-11-10')).toBe('10/11/2026');
    expect(formatData('2026-11-10T12:00:00Z')).toBe('10/11/2026');
    expect(formatData(null)).toBe('—');
  });
});

describe('intervaloDoAtalho', () => {
  const hoje = new Date(2026, 10, 10, 12, 0, 0); // 10/11/2026 meio-dia (sem virada de dia em UTC)
  it('hoje, 7 e 30 dias', () => {
    expect(intervaloDoAtalho('HOJE', hoje)).toEqual({ inicio: '2026-11-10', fim: '2026-11-10' });
    expect(intervaloDoAtalho('7D', hoje)).toEqual({ inicio: '2026-11-03', fim: '2026-11-10' });
    expect(intervaloDoAtalho('30D', hoje)).toEqual({ inicio: '2026-10-11', fim: '2026-11-10' });
  });
  it('este mês, mês anterior e ano atual', () => {
    expect(intervaloDoAtalho('MES_ATUAL', hoje)).toEqual({ inicio: '2026-11-01', fim: '2026-11-10' });
    expect(intervaloDoAtalho('MES_ANTERIOR', hoje)).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(intervaloDoAtalho('ANO_ATUAL', hoje)).toEqual({ inicio: '2026-01-01', fim: '2026-11-10' });
  });
});

describe('intervaloDoAtalho no calendário local (America/Sao_Paulo)', () => {
  const tzOriginal = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/Sao_Paulo';
  });
  afterAll(() => {
    process.env.TZ = tzOriginal;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('23:30 local (já é amanhã em UTC): "Hoje" e os fins de período continuam sendo hoje', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T02:30:00Z')); // 10/11/2026 23:30 em São Paulo
    expect(new Date().getDate()).toBe(10);
    expect(intervaloDoAtalho('HOJE')).toEqual({ inicio: '2026-11-10', fim: '2026-11-10' });
    expect(intervaloDoAtalho('7D')).toEqual({ inicio: '2026-11-03', fim: '2026-11-10' });
    expect(intervaloDoAtalho('30D')).toEqual({ inicio: '2026-10-11', fim: '2026-11-10' });
    expect(intervaloDoAtalho('MES_ATUAL')).toEqual({ inicio: '2026-11-01', fim: '2026-11-10' });
    expect(intervaloDoAtalho('ANO_ATUAL')).toEqual({ inicio: '2026-01-01', fim: '2026-11-10' });
  });

  it('virada de ano: 1º de janeiro às 23:30', () => {
    const anoNovo = new Date(2026, 0, 1, 23, 30);
    expect(intervaloDoAtalho('HOJE', anoNovo)).toEqual({ inicio: '2026-01-01', fim: '2026-01-01' });
    expect(intervaloDoAtalho('MES_ATUAL', anoNovo)).toEqual({ inicio: '2026-01-01', fim: '2026-01-01' });
    expect(intervaloDoAtalho('MES_ANTERIOR', anoNovo)).toEqual({ inicio: '2025-12-01', fim: '2025-12-31' });
    expect(intervaloDoAtalho('ANO_ATUAL', anoNovo)).toEqual({ inicio: '2026-01-01', fim: '2026-01-01' });
    expect(intervaloDoAtalho('7D', anoNovo)).toEqual({ inicio: '2025-12-25', fim: '2026-01-01' });
  });

  it('virada de mês: 1º de março (fevereiro de 28 dias) às 23:30', () => {
    const marco = new Date(2026, 2, 1, 23, 30);
    expect(intervaloDoAtalho('MES_ANTERIOR', marco)).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' });
    expect(intervaloDoAtalho('30D', marco)).toEqual({ inicio: '2026-01-30', fim: '2026-03-01' });
    expect(intervaloDoAtalho('7D', marco)).toEqual({ inicio: '2026-02-22', fim: '2026-03-01' });
  });

  it('meia-noite e meia local: o mês ainda é o novo', () => {
    const cedo = new Date(2026, 1, 1, 0, 30);
    expect(intervaloDoAtalho('MES_ATUAL', cedo)).toEqual({ inicio: '2026-02-01', fim: '2026-02-01' });
    expect(intervaloDoAtalho('MES_ANTERIOR', cedo)).toEqual({ inicio: '2026-01-01', fim: '2026-01-31' });
  });
});

describe('rotuloPeriodo', () => {
  it('predefinição pelo nome; personalizado pelas datas', () => {
    expect(rotuloPeriodo('30D', '2026-10-11', '2026-11-10')).toBe('Últimos 30 dias');
    expect(rotuloPeriodo('CUSTOM', '2026-10-01', '2026-10-31')).toBe('01/10/2026 a 31/10/2026');
  });
  it('lista de períodos tem as 6 predefinições e Personalizado por último', () => {
    expect(PERIODOS.map((p) => p.id)).toEqual(['HOJE', '7D', '30D', 'MES_ATUAL', 'MES_ANTERIOR', 'ANO_ATUAL', 'CUSTOM']);
  });
});

describe('rótulos', () => {
  it('categoria legível sem mudar o valor guardado', () => {
    expect(rotuloCategoriaFinanceira('ENERGIA_AGUA')).toBe('Energia e água');
    expect(rotuloCategoriaFinanceira('TAXAS_MAQUININHA')).toBe('Taxas de maquininha');
    expect(rotuloCategoriaFinanceira('MANUTENÇÃO')).toBe('Manutenção');
    expect(rotuloCategoriaFinanceira('FORNECEDORES')).toBe('Fornecedores');
    expect(rotuloCategoriaFinanceira('')).toBe('Outros');
  });
  it('status em texto conforme o tipo', () => {
    expect(rotuloStatus('LIQUIDADO', 'DESPESA')).toBe('Pago');
    expect(rotuloStatus('LIQUIDADO', 'RECEITA')).toBe('Recebido');
    expect(rotuloStatus('ATRASADO', 'DESPESA')).toBe('Atrasado');
    expect(rotuloStatus('PENDENTE', 'RECEITA')).toBe('Pendente');
    expect(rotuloStatus('CANCELADO', 'RECEITA')).toBe('Cancelado');
  });
});
