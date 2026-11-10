import { describe, expect, it } from 'vitest';
import { ETAPAS_OS, mensagemEtapa, proximaEtapa } from '../../src/pages/ordens/etapas';
import { FORMAS_PAGAMENTO } from '../../src/pages/ordens/formasPagamento';
import { textoDias } from '../../src/pages/radar/diasNaEtapa';

describe('proximaEtapa', () => {
  it('segue o fluxo com os rótulos das ações', () => {
    expect(proximaEtapa('ORCAMENTO')).toEqual({ status: 'EXECUCAO', rotulo: 'Aprovar → Execução' });
    expect(proximaEtapa('AGUARDANDO_PECA')).toEqual({ status: 'EXECUCAO', rotulo: 'Peça Chegou → Execução' });
    expect(proximaEtapa('EXECUCAO')).toEqual({ status: 'FINALIZADO', rotulo: 'Concluir Serviço' });
    expect(proximaEtapa('FINALIZADO')).toEqual({ status: 'PAGO', rotulo: 'Receber / Dar Baixa' });
  });
  it('Pago não tem próxima etapa', () => {
    expect(proximaEtapa('PAGO')).toBeNull();
  });
  it('as 5 etapas em ordem', () => {
    expect(ETAPAS_OS).toEqual(['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO', 'FINALIZADO', 'PAGO']);
  });
});

describe('mensagemEtapa', () => {
  it('Pago vira "Ordem marcada como paga"', () => {
    expect(mensagemEtapa('PAGO')).toBe('Ordem marcada como paga');
  });
  it('usa o rótulo legível, nunca o enum', () => {
    expect(mensagemEtapa('EXECUCAO')).toBe('Etapa atualizada para Em execução');
    expect(mensagemEtapa('AGUARDANDO_PECA')).toBe('Etapa atualizada para Aguardando peça');
    for (const st of ETAPAS_OS) expect(mensagemEtapa(st)).not.toMatch(/[A-Z]{4,}/);
  });
});

describe('FORMAS_PAGAMENTO', () => {
  it('mantém as strings enviadas ao backend', () => {
    expect(FORMAS_PAGAMENTO).toEqual(['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Boleto / Faturado']);
  });
});

describe('textoDias', () => {
  it('hoje, singular e plural', () => {
    expect(textoDias(0)).toBe('aberta hoje');
    expect(textoDias(1)).toBe('aberta há 1 dia');
    expect(textoDias(9)).toBe('aberta há 9 dias');
  });
});
