import { describe, expect, it } from 'vitest';
import { formatBRL, formatData, linkWhatsApp } from '../../src/lib/format';
import { vencimentoFolha } from '../../src/pages/equipe/auxiliares';

describe('format', () => {
  it('formatBRL: vazio vira zero', () => {
    expect(formatBRL(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatBRL(null)).toBe(formatBRL(0));
    expect(formatBRL(undefined)).toBe(formatBRL(0));
  });

  it('formatData: corta o texto, sem passar por Date', () => {
    expect(formatData('2026-12-05')).toBe('05/12/2026');
    expect(formatData('2026-12-05T01:00:00Z')).toBe('05/12/2026');
    expect(formatData(null)).toBe('—');
  });

  it('linkWhatsApp: põe o 55 uma vez só e abre sem contato quando não há telefone', () => {
    expect(linkWhatsApp('(11) 91234-5678')).toBe('https://wa.me/5511912345678');
    expect(linkWhatsApp('5511912345678')).toBe('https://wa.me/5511912345678');
    expect(linkWhatsApp('', 'oi tudo bem')).toBe('https://wa.me/?text=oi%20tudo%20bem');
    expect(linkWhatsApp(undefined)).toBe('https://wa.me/');
  });
});

describe('vencimentoFolha', () => {
  it('mês seguinte ao de referência, no dia de pagamento', () => {
    expect(vencimentoFolha('2026-11', 5)).toBe('2026-12-05');
    expect(vencimentoFolha('2026-12', 5)).toBe('2027-01-05');
  });

  it('dia 31 vira o último dia do mês de vencimento (30 dias, fevereiro comum e bissexto)', () => {
    expect(vencimentoFolha('2026-10', 31)).toBe('2026-11-30');
    expect(vencimentoFolha('2027-01', 31)).toBe('2027-02-28');
    expect(vencimentoFolha('2028-01', 31)).toBe('2028-02-29');
  });
});
