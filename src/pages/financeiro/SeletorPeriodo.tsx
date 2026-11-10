import { useId } from 'react';
import { Calendar } from 'lucide-react';
import { CLASSE_CAMPO } from '../../components/ui';
import { PERIODOS, type AtalhoPeriodo } from './auxiliares';

/**
 * Seletor único de período: predefinições num `<select>`; "Personalizado" revela as datas De/Até.
 * Numa linha só (44px no toque); as datas personalizadas quebram para a linha de baixo no celular.
 */
export function SeletorPeriodo({
  atalho,
  dataInicio,
  dataFim,
  aoEscolherAtalho,
  aoPersonalizar,
  aoMudarInicio,
  aoMudarFim,
}: {
  atalho: AtalhoPeriodo | 'CUSTOM';
  dataInicio: string;
  dataFim: string;
  aoEscolherAtalho: (atalho: AtalhoPeriodo) => void;
  aoPersonalizar: () => void;
  aoMudarInicio: (valor: string) => void;
  aoMudarFim: (valor: string) => void;
}) {
  const personalizado = atalho === 'CUSTOM';
  const idErro = useId();
  // Datas ISO (AAAA-MM-DD) comparam como texto
  const fimAntesDoInicio = personalizado && !!dataInicio && !!dataFim && dataFim < dataInicio;
  return (
    <div role="group" aria-label="Período do relatório" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="relative w-full sm:w-60">
        <Calendar
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <select
          aria-label="Período"
          value={atalho}
          onChange={(e) => {
            const v = e.target.value as AtalhoPeriodo | 'CUSTOM';
            if (v === 'CUSTOM') aoPersonalizar();
            else aoEscolherAtalho(v);
          }}
          className={`${CLASSE_CAMPO} cursor-pointer pl-9 font-medium`}
        >
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </div>
      {personalizado && (
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center">
          <label className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
            <span className="shrink-0">De</span>
            <input
              type="date"
              value={dataInicio}
              max={dataFim || undefined}
              aria-invalid={fimAntesDoInicio || undefined}
              aria-describedby={fimAntesDoInicio ? idErro : undefined}
              onChange={(e) => aoMudarInicio(e.target.value)}
              className={`${CLASSE_CAMPO} min-w-0 tabular-nums sm:w-40`}
            />
          </label>
          <label className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
            <span className="shrink-0">Até</span>
            <input
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              aria-invalid={fimAntesDoInicio || undefined}
              aria-describedby={fimAntesDoInicio ? idErro : undefined}
              onChange={(e) => aoMudarFim(e.target.value)}
              className={`${CLASSE_CAMPO} min-w-0 tabular-nums sm:w-40`}
            />
          </label>
        </div>
      )}
      {fimAntesDoInicio && (
        <p id={idErro} role="alert" className="w-full text-sm font-medium text-danger">
          A data final não pode ser anterior à inicial.
        </p>
      )}
    </div>
  );
}
