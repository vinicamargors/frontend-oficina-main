import type { StatusOS } from '../../types';
import { STATUS_OS } from './status';

export function StatusBadge({ status }: { status: StatusOS }) {
  const { rotulo, icone: Icone, classe } = STATUS_OS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${classe}`}>
      <Icone size={14} aria-hidden="true" />
      {rotulo}
    </span>
  );
}
