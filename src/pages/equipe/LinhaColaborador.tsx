import { CheckCircle2, FileText, Pencil, RotateCcw, Star, UserX } from 'lucide-react';
import { Badge } from '../../components/ui';
import type { Usuario } from '../../types';
import { MenuAcoes } from '../clientes/MenuAcoes';
import { formatBRL, formatMedia, iniciais, rotuloCargo } from './auxiliares';

/** Colunas no desktop (≥1024px); o cabeçalho da lista usa a mesma grade. Celular: pessoa (4 linhas curtas) | menu. */
export const COLUNAS_COLABORADOR = 'lg:grid-cols-[minmax(0,1fr)_7rem_8rem_10rem_6rem_2.75rem]';

export function Avatar({ nome, apagado = false }: { nome: string; apagado?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium ${
        apagado ? 'text-ink-subtle' : 'text-ink-muted'
      }`}
    >
      {iniciais(nome)}
    </span>
  );
}

/** Avaliação média em texto ("4,6 · 12 aval."), com a estrela só de apoio. */
function Avaliacao({ u }: { u: Usuario }) {
  if (u.estrelas_media == null) return <span>Sem avaliações</span>;
  const total = u.total_avaliacoes;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Star size={12} className="fill-warning text-warning" aria-hidden="true" />
      <span className="sr-only">Nota média </span>
      {formatMedia(u.estrelas_media)}
      <span className="sr-only"> de 5{total ? ',' : ''}</span>
      {total ? ` · ${total} aval.` : null}
    </span>
  );
}

/**
 * Colaborador como linha de lista. Celular: avatar e quatro linhas curtas (nome; cargo e avaliação; salário e
 * comissões; e-mail e telefone). Desktop: as mesmas informações em colunas. Holerite, edição e
 * desativar/reativar ficam no menu; desativar e reativar passam por uma folha de confirmação.
 */
export function LinhaColaborador({
  u,
  comissaoServicoPadrao,
  comissaoPecaPadrao,
  aoHolerite,
  aoEditar,
  aoDesativar,
  aoReativar,
}: {
  u: Usuario;
  comissaoServicoPadrao: number;
  comissaoPecaPadrao: number;
  aoHolerite: () => void;
  aoEditar: () => void;
  aoDesativar: () => void;
  aoReativar: () => void;
}) {
  const ativo = u.ativo !== false;
  const temSalario = Boolean(u.salario_base && u.salario_base > 0);
  const cargo = rotuloCargo(u.cargo);
  const comissao = `${u.comissao_servico_pct ?? comissaoServicoPadrao}% M.O. · ${u.comissao_peca_pct ?? comissaoPecaPadrao}% peças`;
  const salario = temSalario ? (
    <span className="text-ink">{formatBRL(u.salario_base)}</span>
  ) : (
    <span className="text-warning">Salário não informado</span>
  );

  return (
    <li className={`grid min-h-16 grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-3 py-2.5 pl-4 pr-2 lg:gap-x-6 lg:pl-5 ${COLUNAS_COLABORADOR}`}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nome={u.nome} apagado={!ativo} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-sm font-medium ${ativo ? 'text-ink' : 'text-ink-muted'}`}>{u.nome}</span>
            {!ativo && <Badge className="shrink-0 lg:hidden">Inativo</Badge>}
          </p>
          <p className="truncate text-xs text-ink-muted lg:hidden">
            {cargo} · <Avaliacao u={u} />
          </p>
          <p className="truncate text-xs tabular-nums text-ink-muted lg:hidden">
            {salario} · {comissao}
          </p>
          <p className="flex min-w-0 text-xs text-ink-muted" title={[u.email, u.telefone].filter(Boolean).join(' · ')}>
            <span className="truncate">{u.email}</span>
            {u.telefone && <span className="shrink-0 tabular-nums">&nbsp;· {u.telefone}</span>}
          </p>
        </div>
      </div>

      <p className="hidden text-sm text-ink lg:block">
        <span className="sr-only">Cargo </span>
        {cargo}
      </p>
      <p className="hidden text-sm text-ink-muted lg:block">
        <Avaliacao u={u} />
      </p>
      <div className="hidden text-right text-sm tabular-nums lg:block">
        <span className="sr-only">Salário base </span>
        <p className="font-medium">{salario}</p>
        <p className="text-xs text-ink-muted">{comissao}</p>
      </div>
      <p className="hidden text-sm lg:block">
        <span className="sr-only">Situação </span>
        {ativo ? (
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 size={14} aria-hidden="true" />
            Ativo
          </span>
        ) : (
          <Badge>Inativo</Badge>
        )}
      </p>

      <MenuAcoes
        rotulo={`Mais ações de ${u.nome}`}
        itens={[
          { rotulo: 'Ver holerite', icone: FileText, aoClicar: aoHolerite },
          { rotulo: 'Editar colaborador', icone: Pencil, aoClicar: aoEditar },
          ativo
            ? { rotulo: 'Desativar colaborador', icone: UserX, aoClicar: aoDesativar }
            : { rotulo: 'Reativar colaborador', icone: RotateCcw, aoClicar: aoReativar },
        ]}
      />
    </li>
  );
}
