import { AlertTriangle, ArrowDownRight, ArrowUpRight, Barcode, Pencil, Trash2 } from 'lucide-react';
import type { EstoqueItem } from '../../types';
import { MenuAcoes } from '../clientes/MenuAcoes';
import { estaCritico, margemPercentual } from './auxiliares';

const formatBRL = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

/** Colunas da linha no desktop (≥1024px); o cabeçalho da lista usa a mesma grade. No celular a linha é: peça | saldo | menu. */
export const COLUNAS_ITEM = {
  financeiro: 'lg:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_4.5rem_7rem_2.75rem]',
  basico: 'lg:grid-cols-[minmax(0,1fr)_6.5rem_7rem_2.75rem]',
} as const;

/**
 * Peça como linha de lista. Celular: nome e (categoria · SKU · preço) à esquerda, saldo à direita e menu de ações.
 * Desktop: mesma linha em colunas (custo, venda, margem, saldo). Toda ação que mexe no estoque fica no menu e
 * passa por uma folha de confirmação.
 */
export function LinhaItem({
  item,
  rotuloCategoria,
  verFinanceiro,
  aoAjustar,
  aoEtiqueta,
  aoEditar,
  aoExcluir,
}: {
  item: EstoqueItem;
  rotuloCategoria: string;
  verFinanceiro: boolean;
  aoAjustar: (tipo: 'entrada' | 'saida') => void;
  aoEtiqueta: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const qtd = item.quantidade ?? 0;
  const min = item.minimo_alerta ?? 5;
  const critico = estaCritico(qtd, min);
  const meta = [rotuloCategoria, item.codigo].filter(Boolean).join(' · ');

  return (
    <li
      className={`grid min-h-16 grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-3 py-2 pl-4 pr-2 lg:gap-x-6 lg:pl-5 ${
        verFinanceiro ? COLUNAS_ITEM.financeiro : COLUNAS_ITEM.basico
      }`}
    >
      <div className="min-w-0">
        <p className="line-clamp-2 break-words text-sm font-medium text-ink">{item.nome}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {meta}
          <span className="tabular-nums lg:hidden"> · {formatBRL(item.venda)}</span>
        </p>
      </div>

      {verFinanceiro && (
        <p className="hidden text-right text-sm tabular-nums text-ink-muted lg:block">{formatBRL(item.custo)}</p>
      )}
      <p className="hidden text-right text-sm font-medium tabular-nums text-ink lg:block">{formatBRL(item.venda)}</p>
      {verFinanceiro && (
        <p className="hidden text-right text-sm tabular-nums text-ink-muted lg:block">
          {item.custo > 0 ? `${margemPercentual(item.custo, item.venda).toFixed(0)}%` : '—'}
        </p>
      )}

      <div className="text-right">
        <p
          className={`inline-flex items-center justify-end gap-1 text-base font-semibold tabular-nums ${
            critico ? 'text-danger' : 'text-ink'
          }`}
        >
          {critico && <AlertTriangle size={14} aria-hidden="true" />}
          <span>{qtd} un.</span>
        </p>
        <p className={`text-xs tabular-nums ${critico ? 'font-medium text-danger' : 'text-ink-subtle'}`}>
          {critico ? `Baixo · mín. ${min}` : `mín. ${min}`}
        </p>
      </div>

      <MenuAcoes
        rotulo={`Mais ações de ${item.nome}`}
        itens={[
          { rotulo: 'Registrar entrada', icone: ArrowUpRight, aoClicar: () => aoAjustar('entrada') },
          { rotulo: 'Registrar saída', icone: ArrowDownRight, aoClicar: () => aoAjustar('saida'), desabilitado: qtd <= 0 },
          { rotulo: 'Imprimir etiqueta', icone: Barcode, aoClicar: aoEtiqueta },
          { rotulo: 'Editar peça', icone: Pencil, aoClicar: aoEditar },
          { rotulo: 'Excluir peça', icone: Trash2, aoClicar: aoExcluir },
        ]}
      />
    </li>
  );
}
