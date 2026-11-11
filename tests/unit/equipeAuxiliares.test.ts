import { describe, expect, it } from 'vitest';
import {
  calcularDistanciaMetros,
  formatHora,
  iniciais,
  mediaNotas,
  rotuloCargo,
  rotuloNota,
  rotuloTipoEscala,
  rotuloTipoPonto,
  totalFolhaColaborador,
  vencimentoFolha,
} from '../../src/pages/equipe/auxiliares';

describe('rótulos legíveis', () => {
  it('cargos nunca aparecem como enum cru', () => {
    expect(rotuloCargo('DONO')).toBe('Dono');
    expect(rotuloCargo('MECANICO')).toBe('Mecânico');
    expect(rotuloCargo('ATENDENTE')).toBe('Atendente');
    expect(rotuloCargo('FINANCEIRO')).toBe('Financeiro');
    expect(rotuloCargo('master')).toBe('Administrador');
    expect(rotuloCargo('GERENTE')).toBe('Gerente');
    expect(rotuloCargo(undefined)).toBe('Colaborador');
  });
  it('tipos de escala e de ponto', () => {
    expect(rotuloTipoEscala('FERIAS')).toBe('Férias');
    expect(rotuloTipoEscala('FOLGA')).toBe('Folga');
    expect(rotuloTipoEscala('ATESTADO')).toBe('Atestado');
    expect(rotuloTipoEscala('PLANTAO')).toBe('Plantão');
    expect(rotuloTipoPonto('ENTRADA')).toBe('Entrada');
    expect(rotuloTipoPonto('ALMOCO_SAIDA')).toBe('Saída para almoço');
    expect(rotuloTipoPonto('SAIDA')).toBe('Saída');
  });
  it('nota como texto "N de 5"', () => {
    expect(rotuloNota(4)).toBe('4 de 5');
    expect(rotuloNota(4.6)).toBe('4,6 de 5');
  });
});

describe('auxiliares de exibição', () => {
  it('iniciais do nome', () => {
    expect(iniciais('Tiago Ferreira')).toBe('TF');
    expect(iniciais('Maria da Silva Souza')).toBe('MS');
    expect(iniciais('joao')).toBe('J');
    expect(iniciais('  ')).toBe('?');
  });
  it('hora sem segundos', () => {
    expect(formatHora('08:02:00')).toBe('08:02');
    expect(formatHora('8:02')).toBe('8:02');
  });
  it('média das notas com uma casa; sem notas, null', () => {
    expect(mediaNotas([5, 5, 4, 3, 5])).toBe(4.4);
    expect(mediaNotas([])).toBeNull();
  });
});

describe('regras da folha (inalteradas)', () => {
  it('total do colaborador = salário (se informado) + VT + VR; comissões ficam fora', () => {
    expect(totalFolhaColaborador({ salario_base: 3200, vale_transporte: 220, vale_refeicao: 600 })).toBe(4020);
    expect(totalFolhaColaborador({ salario_base: null, vale_transporte: 100, vale_refeicao: 0 })).toBe(100);
    expect(totalFolhaColaborador({ salario_base: -5 })).toBe(0);
  });
  it('vencimento no mês seguinte ao de referência, no dia de pagamento', () => {
    expect(vencimentoFolha('2026-11', 5)).toBe('2026-12-05');
    expect(vencimentoFolha('2026-12', 10)).toBe('2027-01-10');
  });
  it('distância GPS (Haversine) em metros', () => {
    expect(calcularDistanciaMetros(-23.55052, -46.633308, -23.55052, -46.633308)).toBe(0);
    const d = calcularDistanciaMetros(-23.55052, -46.633308, -23.55142, -46.633308);
    expect(d).toBeGreaterThanOrEqual(99);
    expect(d).toBeLessThanOrEqual(101);
  });
});

describe('holerite (exibição)', () => {
  it('mês de referência por extenso em pt-BR, independente do idioma do navegador', async () => {
    const { formatMesExtenso } = await import('../../src/pages/equipe/auxiliares');
    expect(formatMesExtenso('2026-11')).toBe('novembro de 2026');
    expect(formatMesExtenso('2027-01')).toBe('janeiro de 2027');
    expect(formatMesExtenso('2026-03')).toBe('março de 2026');
    expect(formatMesExtenso('')).toBe('');
    expect(formatMesExtenso('2026-13')).toBe('2026-13');
  });
  it('CNPJ: máscara só quando são 14 dígitos; outros valores ficam como estão', async () => {
    const { formatarCnpj } = await import('../../src/pages/equipe/auxiliares');
    expect(formatarCnpj('12345678000190')).toBe('12.345.678/0001-90');
    expect(formatarCnpj('12.345.678/0001-90')).toBe('12.345.678/0001-90');
    expect(formatarCnpj(' 123 ')).toBe('123');
    expect(formatarCnpj(null)).toBe('');
    expect(formatarCnpj(undefined)).toBe('');
  });
  it('identidade do holerite: razão social, depois nome fantasia, depois o texto padrão', async () => {
    const { identidadeHolerite } = await import('../../src/pages/equipe/auxiliares');
    expect(identidadeHolerite({ razao_social: 'Oficina Ltda', nome_fantasia: 'Oficina', cnpj: '12345678000190' })).toEqual({
      nome: 'Oficina Ltda',
      cnpj: '12.345.678/0001-90',
    });
    expect(identidadeHolerite({ razao_social: '  ', nome_fantasia: 'Auto Center', cnpj: '' })).toEqual({ nome: 'Auto Center', cnpj: '' });
    expect(identidadeHolerite(null)).toEqual({ nome: 'MECANIFY • OFICINA MECÂNICA', cnpj: '' });
  });
});
