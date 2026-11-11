import { AlertTriangle, CheckCircle2, Clock, Pencil, Trash2 } from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import type { TransacaoFinanceira } from '../../types';
import { MenuAcoes } from '../clientes/MenuAcoes';
import { formatData, rotuloCategoriaFinanceira, rotuloStatus, valorComSinal } from './auxiliares';

/** Colunas no desktop (≥1024px); o cabeçalho da lista usa a mesma grade. Celular: lançamento | valor | menu. */
export const COLUNAS_LANCAMENTO = 'lg:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_9.5rem_6.5rem_2.75rem]';

const TOM_STATUS = {
  LIQUIDADO: { tom: 'sucesso', texto: 'text-success', icone: CheckCircle2 },
  ATRASADO: { tom: 'perigo', texto: 'text-danger', icone: AlertTriangle },
  PENDENTE: { tom: 'alerta', texto: 'text-warning', icone: Clock },
  CANCELADO: { tom: 'neutro', texto: 'text-ink-muted', icone: Clock },
} as const;

/**
 * Lançamento como linha de lista. Valor sempre com sinal e texto (+ receita em success, − despesa em danger).
 * Dar baixa, editar e excluir ficam no menu e passam por confirmação; no desktop há também o atalho "Pagar/Receber"
 * na linha, que abre a mesma confirmação.
 */
export function LinhaLancamento({
  t,
  aoDarBaixa,
  aoEditar,
  aoExcluir,
}: {
  t: TransacaoFinanceira;
  aoDarBaixa: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const isDespesa = t.tipo === 'DESPESA';
  const isLiquidado = t.status === 'LIQUIDADO';
  const st = TOM_STATUS[t.status] ?? TOM_STATUS.PENDENTE;
  const IconeStatus = st.icone;
  const status = rotuloStatus(t.status, t.tipo);
  const acaoBaixa = isDespesa ? 'Pagar' : 'Receber';
  const detalhes = [t.forma_pagamento, t.observacoes].filter(Boolean).join(' · ');
  const dataCurta = (iso?: string | null) => formatData(iso).replace(/\/\d{2}(\d{2})$/, '/$1');
  // Celular: terceira linha com baixa, forma e observações (só o que existe); texto completo no `title`
  const extrasCelular = [t.data_liquidacao ? `Baixa ${dataCurta(t.data_liquidacao)}` : null, t.forma_pagamento, t.observacoes]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={`grid min-h-16 grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-3 py-2.5 pl-4 pr-2 lg:gap-x-6 lg:pl-5 ${COLUNAS_LANCAMENTO}`}>
      <div className="min-w-0">
        <p className="line-clamp-2 break-words text-sm font-medium text-ink">{t.descricao}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {rotuloCategoriaFinanceira(t.categoria)}
          <span className="tabular-nums lg:hidden"> · venc. {dataCurta(t.data_vencimento)}</span>
          {detalhes && <span className="hidden lg:inline"> · {detalhes}</span>}
        </p>
        {extrasCelular && (
          <p title={extrasCelular} className="line-clamp-1 break-words text-xs tabular-nums text-ink-muted lg:hidden">
            {extrasCelular}
          </p>
        )}
      </div>

      <div className="hidden text-sm tabular-nums lg:block">
        <span className="sr-only">Vencimento </span>
        <p className="text-ink">{formatData(t.data_vencimento)}</p>
        {t.data_liquidacao && <p className="text-xs text-ink-muted">baixa {formatData(t.data_liquidacao)}</p>}
      </div>

      <div className="hidden lg:block">
        <span className="sr-only">Situação </span>
        <Badge tom={st.tom}>
          <IconeStatus size={12} aria-hidden="true" />
          {status}
        </Badge>
      </div>

      <div className="text-right">
        <span className="sr-only">Valor </span>
        <p className={`whitespace-nowrap text-base font-semibold tabular-nums ${isDespesa ? 'text-danger' : 'text-success'}`}>
          {valorComSinal(t.valor, t.tipo)}
        </p>
        <p className={`inline-flex items-center gap-1 text-xs font-medium lg:hidden ${st.texto}`}>
          <IconeStatus size={12} aria-hidden="true" />
          {status}
        </p>
        <p className="hidden text-xs text-ink-muted lg:block">{isDespesa ? 'A pagar' : 'A receber'}</p>
      </div>

      <div className="hidden justify-end lg:flex">
        {!isLiquidado && (
          <Button variante="secundario" tamanho="sm" icone={CheckCircle2} data-tour="financeiro-baixa" onClick={aoDarBaixa} aria-label={`${acaoBaixa} ${t.descricao}`}>
            {acaoBaixa}
          </Button>
        )}
      </div>

      <MenuAcoes
        rotulo={`Mais ações de ${t.descricao}`}
        itens={[
          ...(!isLiquidado
            ? [{ rotulo: isDespesa ? 'Marcar como pago' : 'Marcar como recebido', icone: CheckCircle2, aoClicar: aoDarBaixa }]
            : []),
          { rotulo: 'Editar lançamento', icone: Pencil, aoClicar: aoEditar },
          { rotulo: 'Excluir lançamento', icone: Trash2, aoClicar: aoExcluir },
        ]}
      />
    </li>
  );
}
