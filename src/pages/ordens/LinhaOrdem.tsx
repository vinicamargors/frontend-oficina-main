import { MessageCircle } from 'lucide-react';
import type { StatusOS, UltimaOS } from '../../types';
import { Button, PlateChip, StatusBadge } from '../../components/ui';
import { MarcaAtraso } from '../../components/MarcaAtraso';
import { diasDesde, nivelAtraso, textoDias } from '../radar/diasNaEtapa';
import { proximaEtapa } from './etapas';

const formatBRL = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

/**
 * Uma OS na lista: a linha inteira abre a bancada; à direita (abaixo, no celular) a ação única de avançar
 * etapa e o WhatsApp. Um só DOM para todas as larguras.
 */
export function LinhaOrdem({
  os,
  aoAbrir,
  aoAvancar,
}: {
  os: UltimaOS;
  aoAbrir: () => void;
  aoAvancar: (proximo: StatusOS) => void;
}) {
  const st = (os.status as StatusOS) || 'ORCAMENTO';
  const placa = os.veiculos?.placa || 'SEM-PLACA';
  const modelo = os.veiculos?.modelo || 'Veículo';
  const clienteNome = os.clientes?.nome || 'Cliente';
  const fone = (os.clientes?.telefone || '').replace(/\D/g, '');
  const dias = diasDesde(os.data_abertura);
  const nivel = nivelAtraso(st, dias);
  const prox = proximaEtapa(st);
  // Sem próxima etapa (Pago), o WhatsApp fica à direita da própria linha em vez de abrir uma faixa de ações.
  const faixaAcoes = Boolean(prox);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={aoAbrir}
        className={`block w-full cursor-pointer pl-4 pt-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:pb-3 lg:pr-[19rem] ${
          faixaAcoes ? 'pb-[3.75rem] pr-4' : fone ? 'pb-3 pr-14' : 'pb-3 pr-4'
        }`}
      >
        <span className="flex items-center gap-3">
          <PlateChip placa={placa} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{modelo}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatBRL(os.total_geral)}</span>
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-2">
          <span className="shrink-0">
            <StatusBadge status={st} />
          </span>
          <span className="min-w-0 truncate text-xs text-ink-muted">
            {clienteNome} · {textoDias(dias)}
          </span>
          {nivel !== 'ok' && (
            <span className="shrink-0">
              <MarcaAtraso nivel={nivel} />
            </span>
          )}
        </span>
      </button>

      {(prox || fone) && (
        <div
          className={`pointer-events-none absolute flex items-center justify-between gap-2 lg:inset-x-auto lg:bottom-auto lg:right-2 lg:top-1/2 lg:w-72 lg:-translate-y-1/2 lg:justify-end ${
            faixaAcoes ? 'inset-x-4 bottom-2' : 'right-1 top-1/2 -translate-y-1/2'
          }`}
        >
          {prox ? (
            <Button
              variante="secundario"
              tamanho="sm"
              className="pointer-events-auto"
              onClick={() => aoAvancar(prox.status)}
            >
              {prox.rotulo}
            </Button>
          ) : null}
          {fone && (
            <a
              href={`https://wa.me/55${fone}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Conversar no WhatsApp com ${clienteNome}`}
              title="WhatsApp"
              className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <MessageCircle size={20} strokeWidth={1.5} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </li>
  );
}
