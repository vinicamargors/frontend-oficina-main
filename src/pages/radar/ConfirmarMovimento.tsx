import { ArrowRight } from 'lucide-react';
import type { StatusOS } from '../../types';
import { Button, StatusBadge } from '../../components/ui';
import { Folha } from '../../components/Folha';
import { tituloMover } from './mover';

export interface PedidoMovimento {
  osId: string;
  placa: string;
  de: StatusOS;
  para: StatusOS;
  /** Veio do menu "…" (teclado/toque): ao terminar, o foco segue o card até a etapa nova. */
  viaMenu: boolean;
}

/**
 * Confirmação de toda troca de etapa feita no Radar (arrastar ou menu "…"): nada é gravado antes de Confirmar.
 * Enquanto grava, Confirmar e Cancelar ficam desabilitados e Esc/fundo não fecham (a gravação já foi enviada).
 */
export function ConfirmarMovimento({
  pedido,
  gravando,
  aguardando = false,
  aoConfirmar,
  aoCancelar,
}: {
  pedido: PedidoMovimento | null;
  gravando: boolean;
  /** O quadro está recarregando: Confirmar fica inativo até terminar. */
  aguardando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const cancelar = () => {
    if (!gravando) aoCancelar();
  };
  return (
    <Folha aberto={pedido !== null} titulo={pedido ? tituloMover(pedido.placa, pedido.para) : ''} aoCancelar={cancelar} bloquearFechar={gravando}>
      {pedido && (
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="sr-only">De</span>
            <span data-testid="mover-de">
              <StatusBadge status={pedido.de} />
            </span>
            <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
            <span className="sr-only">para</span>
            <span data-testid="mover-para">
              <StatusBadge status={pedido.para} />
            </span>
          </p>
          <p className="text-xs text-ink-muted">Para marcar como pago, abra a ordem.</p>
          {aguardando && !gravando && <p className="text-xs text-ink-muted">Aguarde a atualização do quadro.</p>}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variante="secundario" disabled={gravando} onClick={cancelar}>
          Cancelar
        </Button>
        <Button
          carregando={gravando}
          disabled={aguardando}
          title={aguardando && !gravando ? 'Aguarde a atualização do quadro' : undefined}
          onClick={aoConfirmar}
        >
          Confirmar
        </Button>
      </div>
    </Folha>
  );
}
