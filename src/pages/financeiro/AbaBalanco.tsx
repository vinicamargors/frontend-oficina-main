import type { ReactNode } from 'react';
import { Panel } from '../../components/ui';
import { formatBRL, lucroComSinal } from './auxiliares';

function Linha({ rotulo, dica, valor, forte = false }: { rotulo: string; dica?: string; valor: ReactNode; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="min-w-0">
        <span className={`block text-sm ${forte ? 'font-semibold text-ink' : 'text-ink'}`}>{rotulo}</span>
        {dica && <span className="mt-0.5 block text-xs text-ink-muted">{dica}</span>}
      </dt>
      <dd className={`shrink-0 text-right tabular-nums ${forte ? 'text-base font-semibold' : 'text-sm font-medium'}`}>{valor}</dd>
    </div>
  );
}

/** Balanço patrimonial: ativo e passivo circulantes lado a lado (empilhados no celular) e a posição líquida. */
export function AbaBalanco({
  caixaTotal,
  totalAReceber,
  patrimonioEstoque,
  totalAtivo,
  totalPassivo,
  posicaoLiquida,
}: {
  caixaTotal: number;
  totalAReceber: number;
  patrimonioEstoque: number;
  totalAtivo: number;
  totalPassivo: number;
  posicaoLiquida: number;
}) {
  return (
    <Panel espaco="nenhum" className="px-5 py-2 lg:px-6 lg:py-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
        <section aria-labelledby="titulo-ativo" className="pt-3">
          <h2 id="titulo-ativo" className="text-base font-semibold text-ink">
            Ativo circulante
          </h2>
          <p className="text-xs text-ink-muted">Bens e direitos</p>
          <dl className="mt-1 divide-y divide-line">
            <Linha rotulo="Caixa e bancos" dica="OS pagas + receitas avulsas recebidas" valor={<span className="text-ink">{formatBRL(caixaTotal)}</span>} />
            <Linha rotulo="Contas a receber" dica="OS em aberto + entradas pendentes" valor={<span className="text-ink">{formatBRL(totalAReceber)}</span>} />
            <Linha rotulo="Patrimônio em estoque" dica="Peças no almoxarifado, pelo custo" valor={<span className="text-ink">{formatBRL(patrimonioEstoque)}</span>} />
            <Linha rotulo="Total do ativo" forte valor={<span className="text-ink">{formatBRL(totalAtivo)}</span>} />
          </dl>
        </section>

        <section aria-labelledby="titulo-passivo" className="mt-4 border-t border-line pt-5 lg:mt-0 lg:border-t-0 lg:pt-3">
          <h2 id="titulo-passivo" className="text-base font-semibold text-ink">
            Passivo circulante
          </h2>
          <p className="text-xs text-ink-muted">Obrigações</p>
          <dl className="mt-1 divide-y divide-line">
            <Linha
              rotulo="Contas a pagar pendentes"
              dica="Despesas pendentes e atrasadas"
              valor={<span className="text-danger">− {formatBRL(totalPassivo)}</span>}
            />
            <Linha rotulo="Total do passivo" forte valor={<span className="text-danger">− {formatBRL(totalPassivo)}</span>} />
          </dl>
        </section>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-t border-line py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Posição patrimonial líquida</h2>
          <p className="text-xs text-ink-muted">Ativo circulante − passivo pendente</p>
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${posicaoLiquida < 0 ? 'text-danger' : 'text-ink'}`}>
          {lucroComSinal(posicaoLiquida)}
        </p>
      </div>
    </Panel>
  );
}
