import { BadgeDollarSign, CircleCheck, ClipboardList, PackageSearch, Wrench, type LucideIcon } from 'lucide-react';
import type { StatusOS } from '../../types';

export const STATUS_OS: Record<StatusOS, { rotulo: string; icone: LucideIcon; classe: string }> = {
  ORCAMENTO: { rotulo: 'Orçamento', icone: ClipboardList, classe: 'bg-muted text-ink-muted' },
  AGUARDANDO_PECA: { rotulo: 'Aguardando peça', icone: PackageSearch, classe: 'bg-warning/15 text-warning' },
  EXECUCAO: { rotulo: 'Em execução', icone: Wrench, classe: 'bg-brand/15 text-brand-ink' },
  FINALIZADO: { rotulo: 'Finalizado', icone: CircleCheck, classe: 'bg-done/15 text-done' },
  PAGO: { rotulo: 'Pago / entregue', icone: BadgeDollarSign, classe: 'bg-success/15 text-success' },
};
