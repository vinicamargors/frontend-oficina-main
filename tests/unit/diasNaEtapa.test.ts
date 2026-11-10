import { describe, expect, it } from 'vitest';
import { diasDesde, nivelAtraso } from '../../src/pages/radar/diasNaEtapa';

describe('diasDesde', () => {
  it('conta dias inteiros completos desde a abertura', () => {
    expect(diasDesde('2026-11-07T10:00:00Z', new Date('2026-11-10T09:00:00Z'))).toBe(2);
  });
  it('nunca fica negativo nem quebra com data inválida', () => {
    expect(diasDesde('2026-11-12T10:00:00Z', new Date('2026-11-10T09:00:00Z'))).toBe(0);
    expect(diasDesde('lixo', new Date('2026-11-10T09:00:00Z'))).toBe(0);
  });
});

describe('nivelAtraso', () => {
  it('Aguardando peça: mais de 3 dias é atenção, mais de 7 é atrasado', () => {
    expect(nivelAtraso('AGUARDANDO_PECA', 3)).toBe('ok');
    expect(nivelAtraso('AGUARDANDO_PECA', 4)).toBe('atencao');
    expect(nivelAtraso('AGUARDANDO_PECA', 7)).toBe('atencao');
    expect(nivelAtraso('AGUARDANDO_PECA', 8)).toBe('atrasado');
  });
  it('Orçamento segue a mesma regra', () => {
    expect(nivelAtraso('ORCAMENTO', 4)).toBe('atencao');
    expect(nivelAtraso('ORCAMENTO', 9)).toBe('atrasado');
  });
  it('outras etapas são sempre ok', () => {
    expect(nivelAtraso('EXECUCAO', 30)).toBe('ok');
    expect(nivelAtraso('FINALIZADO', 30)).toBe('ok');
    expect(nivelAtraso('PAGO', 30)).toBe('ok');
  });
});
