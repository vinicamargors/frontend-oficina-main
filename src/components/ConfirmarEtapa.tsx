import type { StatusOS } from '../types';
import { Button, StatusBadge, STATUS_OS } from './ui';
import { Folha } from './Folha';

/** Celular: confirma a troca de etapa da OS para um toque acidental não mudar o status. Pago usa ConfirmarPagamento. */
export function ConfirmarEtapa({
  etapa,
  aoConfirmar,
  aoCancelar,
}: {
  etapa: StatusOS | null;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  return (
    <Folha aberto={etapa !== null} titulo={etapa ? `Mover para ${STATUS_OS[etapa].rotulo}?` : ''} aoCancelar={aoCancelar}>
      {etapa && (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          A ordem passa para <StatusBadge status={etapa} />
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button onClick={aoConfirmar}>Confirmar</Button>
      </div>
    </Folha>
  );
}
