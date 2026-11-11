import type { ReactNode } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import { Button, CLASSE_CAMPO, Panel } from '../../components/ui';
import type { TransacaoFinanceira } from '../../types';
import { COLUNAS_LANCAMENTO, LinhaLancamento } from './LinhaLancamento';

export type FiltroTipo = 'TODAS' | 'DESPESA' | 'RECEITA';
export type FiltroStatus = 'TODAS' | 'PENDENTE' | 'LIQUIDADO' | 'ATRASADO';

const TIPOS: { id: FiltroTipo; rotulo: string }[] = [
  { id: 'TODAS', rotulo: 'Todas' },
  { id: 'DESPESA', rotulo: 'A pagar' },
  { id: 'RECEITA', rotulo: 'A receber' },
];

const STATUS: { id: FiltroStatus; rotulo: string }[] = [
  { id: 'TODAS', rotulo: 'Todos' },
  { id: 'PENDENTE', rotulo: 'Pendentes' },
  { id: 'LIQUIDADO', rotulo: 'Pagos e recebidos' },
  { id: 'ATRASADO', rotulo: 'Atrasados' },
];

function Chip({ ativo, aoClicar, children }: { ativo: boolean; aoClicar: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className="group inline-flex min-h-11 shrink-0 cursor-pointer snap-start items-center rounded-full focus-visible:outline-none lg:min-h-9"
    >
      <span
        className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-brand sm:px-3.5 ${
          ativo ? 'bg-surface text-ink shadow-card dark:bg-line' : 'text-ink-muted group-hover:bg-muted group-hover:text-ink'
        }`}
      >
        {children}
      </span>
    </button>
  );
}

/** Contas a pagar e receber: busca, filtros de tipo e status numa faixa só, e a lista completa de lançamentos. */
export function AbaContas({
  totalNoPeriodo,
  transacoes,
  busca,
  filtroTipo,
  filtroStatus,
  aoBuscar,
  aoFiltrarTipo,
  aoFiltrarStatus,
  aoLimparFiltros,
  aoNovo,
  aoDarBaixa,
  aoEditar,
  aoExcluir,
}: {
  totalNoPeriodo: number;
  transacoes: TransacaoFinanceira[];
  busca: string;
  filtroTipo: FiltroTipo;
  filtroStatus: FiltroStatus;
  aoBuscar: (v: string) => void;
  aoFiltrarTipo: (v: FiltroTipo) => void;
  aoFiltrarStatus: (v: FiltroStatus) => void;
  aoLimparFiltros: () => void;
  aoNovo: () => void;
  aoDarBaixa: (t: TransacaoFinanceira) => void;
  aoEditar: (t: TransacaoFinanceira) => void;
  aoExcluir: (t: TransacaoFinanceira) => void;
}) {
  const temFiltro = Boolean(busca.trim()) || filtroTipo !== 'TODAS' || filtroStatus !== 'TODAS';

  return (
    <div>
      <search className="mb-4 block space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => aoBuscar(e.target.value)}
            placeholder="Buscar lançamento…"
            aria-label="Buscar lançamento por descrição, categoria ou observação"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`${CLASSE_CAMPO} pl-9`}
          />
        </div>
        <div
          role="group"
          aria-label="Filtros de lançamentos"
          className="-mx-4 flex snap-x scroll-px-4 items-center gap-1 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8 lg:mx-0 lg:gap-2 lg:overflow-visible lg:px-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
        >
          <div role="group" aria-label="Filtrar por tipo" className="flex shrink-0 gap-1">
            {TIPOS.map((f) => (
              <Chip key={f.id} ativo={filtroTipo === f.id} aoClicar={() => aoFiltrarTipo(f.id)}>
                {f.rotulo}
              </Chip>
            ))}
          </div>
          <span aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-line" />
          <div role="group" aria-label="Filtrar por status" className="flex shrink-0 gap-1">
            {STATUS.map((s) => (
              <Chip key={s.id} ativo={filtroStatus === s.id} aoClicar={() => aoFiltrarStatus(s.id)}>
                {s.rotulo}
              </Chip>
            ))}
          </div>
        </div>
      </search>

      {transacoes.length === 0 ? (
        <Panel espaco="lg" className="flex flex-col items-center gap-3 text-center">
          <CreditCard className="h-10 w-10 text-ink-subtle" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink text-balance">
            {temFiltro && totalNoPeriodo > 0 ? 'Nenhum lançamento no filtro atual' : 'Nenhum lançamento no período'}
          </h2>
          <p className="max-w-md text-sm text-ink-muted text-pretty">
            {temFiltro && totalNoPeriodo > 0
              ? 'Nenhuma conta corresponde aos filtros aplicados.'
              : 'Cadastre aluguel, luz, taxas, folha de pagamento ou aportes para controlar o fluxo de caixa.'}
          </p>
          {temFiltro ? (
            <Button variante="secundario" onClick={aoLimparFiltros}>
              Limpar filtros
            </Button>
          ) : (
            <Button variante="secundario" icone={Plus} onClick={aoNovo}>
              Lançar conta
            </Button>
          )}
        </Panel>
      ) : (
        <Panel espaco="nenhum">
          <div
            aria-hidden="true"
            className={`hidden items-center gap-x-6 pb-2 pl-5 pr-2 pt-4 text-xs text-ink-muted lg:grid ${COLUNAS_LANCAMENTO}`}
          >
            <span>Lançamento</span>
            <span>Vencimento</span>
            <span>Situação</span>
            <span className="text-right">Valor</span>
            <span />
            <span />
          </div>
          <ul aria-label="Lançamentos" className="divide-y divide-line">
            {transacoes.map((t) => (
              <LinhaLancamento
                key={t.id}
                t={t}
                aoDarBaixa={() => aoDarBaixa(t)}
                aoEditar={() => aoEditar(t)}
                aoExcluir={() => aoExcluir(t)}
              />
            ))}
          </ul>
          <p className="px-5 py-3 text-xs tabular-nums text-ink-muted">
            {transacoes.length === totalNoPeriodo
              ? `${totalNoPeriodo} ${totalNoPeriodo === 1 ? 'lançamento' : 'lançamentos'} no período`
              : `${transacoes.length} de ${totalNoPeriodo} lançamentos no período`}
          </p>
        </Panel>
      )}
    </div>
  );
}
