import { AlertTriangle, CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';
import { Button, Panel } from '../../components/ui';
import type { RegistroPonto } from '../../types';
import { formatData, formatHora, rotuloTipoPonto } from './auxiliares';

/** Ponto por GPS: o botão abre uma confirmação; depois, o mesmo fluxo de geolocalização e trava de raio de antes. */
export function AbaPonto({
  pontos,
  raio,
  registrando,
  feedback,
  aoBaterPonto,
}: {
  pontos: RegistroPonto[];
  raio: number;
  registrando: boolean;
  feedback: { sucesso: boolean; msg: string } | null;
  aoBaterPonto: () => void;
}) {
  return (
    <div className="space-y-4">
      <Panel as="section" aria-label="Bater ponto" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-ink text-balance">Ponto por geolocalização</h2>
              <p className="mt-1 max-w-md text-sm text-ink-muted text-pretty">
                O registro confere se você está dentro do raio de <span className="font-medium text-ink">{raio} m</span> da oficina.
                Fora do raio, o ponto fica marcado para conferência do gestor.
              </p>
            </div>
          </div>
          <Button variante="secundario" icone={Navigation} carregando={registrando} onClick={aoBaterPonto} className="sm:shrink-0">
            {registrando ? 'Verificando GPS…' : 'Bater ponto agora'}
          </Button>
        </div>

        <div aria-live="polite" className="empty:hidden">
          {feedback && (
            <p
              role="status"
              className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                feedback.sucesso ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              }`}
            >
              {feedback.sucesso ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{feedback.msg}</span>
            </p>
          )}
        </div>
      </Panel>

      <Panel espaco="nenhum" as="section" aria-labelledby="titulo-registros-ponto">
        <h2 id="titulo-registros-ponto" className="px-4 pb-1 pt-4 text-sm font-medium text-ink lg:px-5 text-balance">
          Últimos registros
        </h2>
        {pontos.length === 0 ? (
          <p className="flex items-center gap-2 px-4 pb-5 pt-2 text-sm text-ink-muted lg:px-5">
            <Clock className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            Nenhum ponto registrado ainda.
          </p>
        ) : (
          <ul aria-label="Últimos registros de ponto" className="divide-y divide-line">
            {pontos.slice(0, 10).map((p) => (
              <li key={p.id} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 pl-4 pr-4 lg:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{p.usuario_nome}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                    {formatData(p.data)} às {formatHora(p.hora)} · {rotuloTipoPonto(p.tipo)}
                  </p>
                </div>
                <p
                  className={`inline-flex items-center gap-1 text-right text-xs font-medium tabular-nums ${
                    p.dentro_raio ? 'text-success' : 'text-danger'
                  }`}
                >
                  {p.dentro_raio ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
                  {p.dentro_raio ? 'No raio' : 'Fora do raio'}
                  {p.distancia_metros != null && <span className="font-normal text-ink-muted"> · {p.distancia_metros} m</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
