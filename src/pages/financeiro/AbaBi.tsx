import type { ReactNode } from 'react';
import { Panel } from '../../components/ui';
import type { InteligenciaFinanceiraResponse } from '../../types';
import { formatBRL } from './auxiliares';

function Bloco({ titulo, contagem, children }: { titulo: string; contagem?: string; children: ReactNode }) {
  return (
    <Panel as="section" aria-label={titulo} espaco="nenhum" className="px-5 pb-2 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink text-balance">{titulo}</h2>
        {contagem && <span className="text-xs tabular-nums text-ink-muted">{contagem}</span>}
      </div>
      {children}
    </Panel>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{children}</p>;
}

/** Linha de ranking: posição, nome e apoio à esquerda; lucro e faturamento à direita. */
function LinhaRanking({ posicao, nome, apoio, lucro, faturamento, rotuloFat }: {
  posicao?: number;
  nome: string;
  apoio: string;
  lucro: number;
  faturamento: number;
  rotuloFat: string;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      {posicao !== undefined && (
        <span className="w-5 shrink-0 text-right text-sm tabular-nums text-ink-subtle">{posicao}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-sm font-medium text-ink">{nome}</p>
        <p className="text-xs tabular-nums text-ink-muted">{apoio}</p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="text-sm font-semibold text-ink">
          <span className="font-normal text-ink-muted">Lucro </span>
          {formatBRL(lucro)}
        </p>
        <p className="text-xs text-ink-muted">
          {rotuloFat} {formatBRL(faturamento)}
        </p>
      </div>
    </li>
  );
}

/** BI da oficina: indicadores de eficiência e os rankings (mecânicos, meios de pagamento, marcas e curva ABC). */
export function AbaBi({ ticketMedio, bi }: { ticketMedio?: number | null; bi: InteligenciaFinanceiraResponse | null }) {
  const mecanicos = bi?.produtividade_mecanicos || [];
  const meios = bi?.metodos_pagamento || [];
  const marcas = bi?.rentabilidade_marcas || [];
  const clientes = bi?.top_10_clientes || [];
  const totalMeios = meios.reduce((acc, i) => acc + i.valor_total, 0);

  return (
    <div className="space-y-4">
      <Panel
        as="section"
        aria-label="Indicadores de eficiência"
        className="grid grid-cols-1 divide-y divide-line py-2 lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:py-5"
      >
        <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0 lg:first:pl-1">
          <div>
            <p className="text-sm text-ink-muted">Ticket médio</p>
            <p className="hidden text-xs text-ink-subtle lg:block">Gasto médio por OS</p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-ink lg:mt-1 lg:text-2xl">{formatBRL(ticketMedio)}</p>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0">
          <div>
            <p className="text-sm text-ink-muted">Taxa de conversão</p>
            <p className="hidden text-xs text-ink-subtle lg:block">Orçamentos que viraram serviço</p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-ink lg:mt-1 lg:text-2xl">
            {String(bi?.taxa_conversao_orcamentos ?? 0).replace('.', ',')}%
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0">
          <div>
            <p className="text-sm text-ink-muted">Giro médio no pátio</p>
            <p className="hidden text-xs text-ink-subtle lg:block">Tempo médio de permanência</p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-ink lg:mt-1 lg:text-2xl">
            {String(bi?.lead_time_medio_horas ?? 0).replace('.', ',')} h
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco titulo="Produtividade por mecânico" contagem={`${mecanicos.length} ${mecanicos.length === 1 ? 'profissional' : 'profissionais'}`}>
          {mecanicos.length === 0 ? (
            <Vazio>Nenhum mecânico com OS finalizada.</Vazio>
          ) : (
            <ol aria-label="Produtividade por mecânico" className="divide-y divide-line">
              {mecanicos.map((mec, idx) => (
                <LinhaRanking
                  key={mec.nome}
                  posicao={idx + 1}
                  nome={mec.nome}
                  apoio={`${mec.qtd_os} OS entregues`}
                  lucro={mec.lucro_gerado}
                  faturamento={mec.faturamento_gerado}
                  rotuloFat="Faturamento"
                />
              ))}
            </ol>
          )}
        </Bloco>

        <Bloco titulo="Meios de pagamento">
          {meios.length === 0 ? (
            <Vazio>Nenhum pagamento registrado no período.</Vazio>
          ) : (
            <ul aria-label="Meios de pagamento" className="space-y-4 py-4">
              {meios.map((mp) => {
                const pct = totalMeios > 0 ? (mp.valor_total / totalMeios) * 100 : 0;
                return (
                  <li key={mp.forma}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-ink">{mp.forma}</span>
                      <span className="tabular-nums text-ink-muted">
                        <span className="text-ink">{formatBRL(mp.valor_total)}</span> · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div aria-hidden="true" className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, Math.max(5, pct))}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Rentabilidade por marca">
          {marcas.length === 0 ? (
            <Vazio>Nenhum veículo faturado.</Vazio>
          ) : (
            <ul aria-label="Rentabilidade por marca" className="divide-y divide-line">
              {marcas.map((marca) => (
                <LinhaRanking
                  key={marca.marca}
                  nome={marca.marca}
                  apoio={`${marca.qtd_os} veículos atendidos`}
                  lucro={marca.lucro}
                  faturamento={marca.faturamento}
                  rotuloFat="Faturamento"
                />
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Clientes mais lucrativos (curva ABC)">
          {clientes.length === 0 ? (
            <Vazio>Nenhum cliente faturado no período.</Vazio>
          ) : (
            <ol aria-label="Clientes mais lucrativos" className="divide-y divide-line">
              {clientes.map((cli, idx) => (
                <LinhaRanking
                  key={cli.nome}
                  posicao={idx + 1}
                  nome={cli.nome}
                  apoio={`${cli.qtd_os} OS atendidas`}
                  lucro={cli.lucro}
                  faturamento={cli.faturamento}
                  rotuloFat="Total"
                />
              ))}
            </ol>
          )}
        </Bloco>
      </div>
    </div>
  );
}
