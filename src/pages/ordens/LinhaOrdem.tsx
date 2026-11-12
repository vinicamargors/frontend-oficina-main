import { formatBRL, linkWhatsApp } from '../../lib/format';
import { MessageCircle } from 'lucide-react';
import type { StatusOS, UltimaOS } from '../../types';
import { Button, PlateChip, StatusBadge } from '../../components/ui';
import { MarcaAtraso } from '../../components/MarcaAtraso';
import { diasDesde, nivelAtraso, textoDias } from '../radar/diasNaEtapa';
import { proximaEtapa } from './etapas';


/**
 * Uma OS na lista: a linha inteira abre a bancada; à direita o WhatsApp e, só no desktop (≥1024), a ação única
 * de avançar etapa. No celular não há avanço pela lista (toque acidental mudaria o status): troca-se na bancada.
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
  const defeito = os.descricao_problema?.trim() || '';

  return (
    <li className="relative">
      <button
        type="button"
        onClick={aoAbrir}
        className={`block w-full cursor-pointer py-2.5 pl-4 text-left lg:py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:pr-[19rem] ${
          fone ? 'pr-14' : 'pr-4'
        }`}
      >
        <span className="flex items-center gap-3">
          <PlateChip placa={placa} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{modelo}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatBRL(os.total_geral)}</span>
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-2 lg:mt-2">
          <span className="shrink-0">
            <StatusBadge status={st} />
          </span>
          <span className="min-w-0 truncate text-xs text-ink-muted">
            {clienteNome} · {textoDias(dias)}
          </span>
          {defeito && (
            <span title={defeito} className="min-w-0 flex-[1_1_0%] truncate text-xs text-ink-subtle">
              {defeito}
            </span>
          )}
          {nivel !== 'ok' && (
            <span className="shrink-0">
              <MarcaAtraso nivel={nivel} />
            </span>
          )}
        </span>
      </button>

      {(prox || fone) && (
        <div className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-2 lg:right-2 lg:w-72 lg:justify-end">
          {prox ? (
            <Button
              variante="secundario"
              tamanho="sm"
              className="pointer-events-auto hidden lg:inline-flex"
              onClick={() => aoAvancar(prox.status)}
            >
              {prox.rotulo}
            </Button>
          ) : null}
          {fone && (
            <a
              href={linkWhatsApp(fone)}
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
