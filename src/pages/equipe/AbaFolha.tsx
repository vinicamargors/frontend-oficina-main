import { CheckCircle2, FileText } from 'lucide-react';
import { Button, CLASSE_CAMPO, Field, Panel } from '../../components/ui';
import type { ParametrosFolha, Usuario } from '../../types';
import { comMais, formatBRL, rotuloCargo, totalFolhaColaborador } from './auxiliares';

const COLUNAS_FOLHA = 'lg:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_9rem_7rem]';

/**
 * Folha do mês: total em destaque, mês de referência e o lançamento no Contas a Pagar (com confirmação),
 * e uma linha por colaborador ativo com base, comissões, VT/VR, líquido e o atalho para o holerite.
 */
export function AbaFolha({
  ativos,
  parametros,
  mesRef,
  totalGeral,
  aoMudarMes,
  aoLancar,
  aoHolerite,
}: {
  ativos: Usuario[];
  parametros: ParametrosFolha;
  mesRef: string;
  totalGeral: number;
  aoMudarMes: (mes: string) => void;
  aoLancar: () => void;
  aoHolerite: (u: Usuario) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel as="section" aria-label="Fechamento da folha" className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-ink-muted">Total da folha</p>
          <p className="mt-1 text-[1.75rem] font-semibold leading-tight tabular-nums text-ink lg:text-3xl">{formatBRL(totalGeral)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Pagamento no dia {parametros.dia_pagamento} · adiantamento no dia {parametros.dia_adiantamento} · {ativos.length}{' '}
            {ativos.length === 1 ? 'colaborador ativo' : 'colaboradores ativos'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-48">
            <Field rotulo="Mês de referência">
              <input type="month" value={mesRef} onChange={(e) => aoMudarMes(e.target.value)} className={`${CLASSE_CAMPO} tabular-nums`} />
            </Field>
          </div>
          <Button variante="secundario" icone={CheckCircle2} onClick={aoLancar}>
            Lançar no Contas a Pagar
          </Button>
        </div>
      </Panel>

      <Panel espaco="nenhum">
        <div aria-hidden="true" className={`hidden items-center gap-x-6 pb-2 pl-5 pr-3 pt-4 text-xs text-ink-muted lg:grid ${COLUNAS_FOLHA}`}>
          <span>Colaborador</span>
          <span className="text-right">Base</span>
          <span className="text-right">Comissões (OS)</span>
          <span className="text-right">VT / VR</span>
          <span className="text-right">Líquido a pagar</span>
          <span />
        </div>
        <ul aria-label="Folha do mês" className="divide-y divide-line">
          {ativos.map((u) => {
            const temSalario = Boolean(u.salario_base && u.salario_base > 0);
            const comissoes = 0; // Sem comissões fictícias
            const vales = (u.vale_transporte || 0) + (u.vale_refeicao || 0);
            const liquido = totalFolhaColaborador(u);
            const base = temSalario ? formatBRL(u.salario_base) : 'Não informado';
            return (
              <li
                key={u.id}
                className={`grid min-h-16 grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-3 py-2.5 pl-4 pr-2 lg:gap-x-6 lg:pl-5 lg:pr-3 ${COLUNAS_FOLHA}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{u.nome}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {rotuloCargo(u.cargo)}
                    <span className="lg:hidden">
                      {' · base '}
                      <span className={`tabular-nums ${temSalario ? '' : 'text-warning'}`}>{base}</span>
                    </span>
                  </p>
                  <p className="flex flex-wrap gap-x-2 text-xs tabular-nums text-ink-muted lg:hidden">
                    <span>Comissões {comMais(comissoes)}</span>
                    <span>VT/VR {comMais(vales)}</span>
                  </p>
                </div>

                <p className={`hidden text-right text-sm tabular-nums lg:block ${temSalario ? 'text-ink' : 'text-warning'}`}>
                  <span className="sr-only">Base </span>
                  {base}
                </p>
                <p className="hidden text-right text-sm tabular-nums text-ink-muted lg:block">
                  <span className="sr-only">Comissões </span>
                  {comMais(comissoes)}
                </p>
                <p className="hidden text-right text-sm tabular-nums text-ink-muted lg:block">
                  <span className="sr-only">VT/VR </span>
                  {comMais(vales)}
                </p>

                <div className="text-right">
                  <span className="sr-only">Líquido a pagar </span>
                  <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink lg:text-base">
                    {temSalario || liquido > 0 ? formatBRL(liquido) : <span className="font-normal text-warning">Não informado</span>}
                  </p>
                  <p className="text-xs text-ink-muted lg:hidden">líquido</p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variante="fantasma"
                    tamanho="sm"
                    icone={FileText}
                    onClick={() => aoHolerite(u)}
                    aria-label={`Ver holerite de ${u.nome}`}
                    className="min-w-11 lg:min-w-0"
                  >
                    <span className="hidden lg:inline">Holerite</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
