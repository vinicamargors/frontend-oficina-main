import { Calendar, CalendarPlus, Trash2 } from 'lucide-react';
import { Badge, Button, Panel } from '../../components/ui';
import type { EscalaFolga } from '../../types';
import { formatData, rotuloTipoEscala } from './auxiliares';

/** Férias, folgas, atestados e plantões; excluir um período passa por uma folha de confirmação. */
export function AbaEscalas({
  escalas,
  aoAgendar,
  aoExcluir,
}: {
  escalas: EscalaFolga[];
  aoAgendar: () => void;
  aoExcluir: (e: EscalaFolga) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-muted">
          Planeje férias e folgas com antecedência para não desfalcar os boxes.
        </p>
        <Button variante="secundario" icone={CalendarPlus} onClick={aoAgendar}>
          Agendar férias ou folga
        </Button>
      </div>

      {escalas.length === 0 ? (
        <Panel espaco="lg" className="flex flex-col items-center gap-3 text-center">
          <Calendar className="h-10 w-10 text-ink-subtle" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink text-balance">Nenhuma escala ou férias agendada</h2>
          <p className="max-w-md text-sm text-ink-muted text-pretty">
            Agende o período de descanso de um colaborador: férias, folga de revezamento, atestado ou plantão extra.
          </p>
        </Panel>
      ) : (
        <Panel espaco="nenhum">
          <ul aria-label="Escalas e férias" className="divide-y divide-line">
            {escalas.map((esc) => (
              <li key={esc.id} className="grid min-h-16 grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-3 py-2.5 pl-4 pr-2 lg:pl-5">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{esc.usuario_nome}</span>
                    <Badge tom="info" className="shrink-0">
                      {rotuloTipoEscala(esc.tipo)}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                    {esc.data_inicio === esc.data_fim
                      ? formatData(esc.data_inicio)
                      : `${formatData(esc.data_inicio)} até ${formatData(esc.data_fim)}`}
                    {esc.observacoes && <span className="font-sans"> · {esc.observacoes}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => aoExcluir(esc)}
                  title="Remover agendamento"
                  aria-label={`Excluir período de ${esc.usuario_nome}`}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
