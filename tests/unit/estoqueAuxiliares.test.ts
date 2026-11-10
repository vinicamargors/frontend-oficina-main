import { describe, expect, it } from 'vitest';
import {
  categoriaEquivalente,
  chaveCategoria,
  estaCritico,
  margemPercentual,
  rotuloCategoria,
  rotulosDasCategorias,
  saldoApos,
} from '../../src/pages/estoque/auxiliares';

describe('rotuloCategoria', () => {
  it('acentua as categorias padrão sem mudar o valor original', () => {
    expect(rotuloCategoria('PECAS')).toBe('Peças');
    expect(rotuloCategoria('ELETRICA')).toBe('Elétrica');
    expect(rotuloCategoria('ACESSORIOS')).toBe('Acessórios');
    expect(rotuloCategoria('SUSPENSAO')).toBe('Suspensão');
  });
  it('aceita o valor já acentuado e minúsculas', () => {
    expect(rotuloCategoria('ELÉTRICA')).toBe('Elétrica');
    expect(rotuloCategoria('pecas')).toBe('Peças');
  });
  it('categoria própria vira primeira maiúscula; vazia vira Peças', () => {
    expect(rotuloCategoria('LUBRIFICANTES')).toBe('Lubrificantes');
    expect(rotuloCategoria(null)).toBe('Peças');
    expect(rotuloCategoria('')).toBe('Peças');
  });
});

describe('regras do estoque', () => {
  it('crítico é quantidade menor ou igual ao mínimo (padrão 5)', () => {
    expect(estaCritico(3, 5)).toBe(true);
    expect(estaCritico(5, 5)).toBe(true);
    expect(estaCritico(6, 5)).toBe(false);
    expect(estaCritico(undefined, undefined)).toBe(true);
  });
  it('margem sobre a venda; sem custo é 100', () => {
    expect(margemPercentual(50, 100)).toBe(50);
    expect(margemPercentual(0, 100)).toBe(100);
  });
  it('saldo após ajuste', () => {
    expect(saldoApos(10, 'entrada', 3)).toBe(13);
    expect(saldoApos(10, 'saida', 3)).toBe(7);
  });
});

describe('categorias com e sem acento', () => {
  it('só as chaves canônicas sem acento ganham acento; o resto aparece como digitado', () => {
    expect(rotuloCategoria('ELETRICA')).toBe('Elétrica');
    expect(rotuloCategoria('ELÉTRICA')).toBe('Elétrica'); // título do que foi digitado
    expect(rotuloCategoria('LUBRIFICANTES')).toBe('Lubrificantes');
  });
  it('valores distintos com o mesmo texto são desambiguados com o valor bruto', () => {
    const r = rotulosDasCategorias(['PECAS', 'ELETRICA', 'ELÉTRICA', 'MOTOR']);
    expect(r.ELETRICA).toBe('Elétrica (ELETRICA)');
    expect(r['ELÉTRICA']).toBe('Elétrica (ELÉTRICA)');
    expect(r.PECAS).toBe('Peças');
    expect(r.MOTOR).toBe('Motor');
  });
  it('sem colisão, nenhum rótulo leva parênteses', () => {
    expect(Object.values(rotulosDasCategorias(['PECAS', 'ELETRICA'])).some((l) => l.includes('('))).toBe(false);
  });
  it('categoria nova equivalente a uma existente (acento/caixa) é detectada', () => {
    expect(chaveCategoria(' elétrica ')).toBe('ELETRICA');
    expect(categoriaEquivalente(['PECAS', 'ELETRICA'], 'ELÉTRICA')).toBe('ELETRICA');
    expect(categoriaEquivalente(['PECAS', 'ELÉTRICA'], 'ELETRICA')).toBe('ELÉTRICA');
    expect(categoriaEquivalente(['PECAS'], 'LUBRIFICANTES')).toBeUndefined();
  });
});
