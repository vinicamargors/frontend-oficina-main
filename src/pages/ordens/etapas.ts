import type { StatusOS } from '../../types';
import { STATUS_OS } from '../../components/ui/status';

/** As 5 etapas da OS, na ordem do fluxo. */
export const ETAPAS_OS: StatusOS[] = ['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO', 'FINALIZADO', 'PAGO'];

/** Próxima etapa sugerida na lista (ação primária da linha). "Pago" não tem próxima. */
const PROXIMA: Partial<Record<StatusOS, { status: StatusOS; rotulo: string }>> = {
  ORCAMENTO: { status: 'EXECUCAO', rotulo: 'Aprovar → Execução' },
  AGUARDANDO_PECA: { status: 'EXECUCAO', rotulo: 'Peça chegou → Execução' },
  EXECUCAO: { status: 'FINALIZADO', rotulo: 'Concluir serviço' },
  FINALIZADO: { status: 'PAGO', rotulo: 'Receber / dar baixa' },
};

export function proximaEtapa(status: StatusOS): { status: StatusOS; rotulo: string } | null {
  return PROXIMA[status] ?? null;
}

/** Mensagem de sucesso ao trocar de etapa: sempre o rótulo legível, nunca o enum. */
export function mensagemEtapa(status: StatusOS): string {
  if (status === 'PAGO') return 'Ordem marcada como paga';
  return `Etapa atualizada para ${STATUS_OS[status]?.rotulo ?? 'a nova etapa'}`;
}
