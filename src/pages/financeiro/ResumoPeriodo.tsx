import { Panel, Skeleton } from '../../components/ui';
import { formatBRL, formatPct, lucroComSinal } from './auxiliares';

/**
 * Resumo do período, visível em todas as abas: lucro líquido (número-chave, sempre com o período no rótulo),
 * entradas recebidas (+, success) e despesas pagas (−, danger). Divisores no lugar de cards aninhados.
 */
export function ResumoPeriodo({
  periodo,
  carregando,
  lucroLiquido,
  margemLiquida,
  entradas,
  aReceber,
  despesasPagas,
  despesasPendentes,
}: {
  periodo: string;
  carregando: boolean;
  lucroLiquido: number;
  margemLiquida: number;
  entradas: number;
  aReceber: number;
  despesasPagas: number;
  despesasPendentes: number;
}) {
  return (
    <Panel
      as="section"
      aria-label="Resumo do período"
      className="mb-6 grid grid-cols-1 divide-y divide-line py-2 lg:grid-cols-[1.2fr_1fr_1fr] lg:divide-x lg:divide-y-0 lg:py-6"
    >
      {carregando ? (
        <div className="py-3 lg:col-span-3">
          <Skeleton linhas={3} />
        </div>
      ) : (
        <>
          <div className="pb-4 pt-3 lg:px-6 lg:py-0 lg:first:pl-1">
            <p className="text-sm text-ink-muted">Lucro líquido · {periodo}</p>
            <p
              data-numero-chave
              className={`mt-1 text-[1.75rem] font-semibold leading-tight tabular-nums lg:text-[2rem] ${
                lucroLiquido < 0 ? 'text-danger' : 'text-ink'
              }`}
            >
              {lucroComSinal(lucroLiquido)}
            </p>
            <p className="mt-1 text-sm tabular-nums text-ink-muted">Margem líquida {formatPct(margemLiquida)}</p>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0">
            <p className="text-sm text-ink-muted">Entradas recebidas</p>
            <div className="text-right lg:text-left">
              <p className="text-xl font-semibold tabular-nums text-success lg:mt-1 lg:text-2xl">+ {formatBRL(entradas)}</p>
              <p className="text-xs tabular-nums text-ink-muted lg:mt-1">A receber {formatBRL(aReceber)}</p>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0">
            <p className="text-sm text-ink-muted">Despesas pagas</p>
            <div className="text-right lg:text-left">
              <p className="text-xl font-semibold tabular-nums text-danger lg:mt-1 lg:text-2xl">− {formatBRL(despesasPagas)}</p>
              <p className="text-xs tabular-nums text-ink-muted lg:mt-1">A pagar − {formatBRL(despesasPendentes)}</p>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
