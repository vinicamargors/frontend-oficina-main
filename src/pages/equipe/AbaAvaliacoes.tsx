import { ExternalLink, Star } from 'lucide-react';
import { Button, Panel } from '../../components/ui';
import type { AvaliacaoOS } from '../../types';
import { formatData, formatMedia, mediaNotas, rotuloNota } from './auxiliares';

/** Cinco estrelas com nome acessível "N de 5" e o mesmo texto visível ao lado. */
export function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span role="img" aria-label={rotuloNota(nota)} className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={n <= nota ? 'fill-warning text-warning' : 'text-ink-subtle'}
          />
        ))}
      </span>
      <span aria-hidden="true" className="text-sm font-medium tabular-nums text-ink">
        {rotuloNota(nota)}
      </span>
    </span>
  );
}

export function AbaAvaliacoes({ avaliacoes }: { avaliacoes: AvaliacaoOS[] }) {
  const media = mediaNotas(avaliacoes.map((a) => a.nota));
  return (
    <div className="space-y-4">
      <Panel as="section" aria-label="Resumo das avaliações" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-muted">Nota média dos clientes</p>
          {media === null ? (
            <p className="mt-1 text-sm text-ink-muted">Sem avaliações no momento.</p>
          ) : (
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[1.75rem] font-semibold leading-tight tabular-nums text-ink lg:text-3xl">{formatMedia(media)}</span>
              <span className="text-sm text-ink-muted">
                de 5 · {avaliacoes.length} {avaliacoes.length === 1 ? 'avaliação' : 'avaliações'}
              </span>
            </p>
          )}
          <p className="mt-1 max-w-md text-sm text-ink-muted">
            Enviadas pelo cliente no link do WhatsApp ao receber a OS concluída.
          </p>
        </div>
        <Button
          variante="secundario"
          icone={ExternalLink}
          onClick={() => {
            const url = `${window.location.origin}/?modo=avaliar&osId=EXEMPLO-OS`;
            window.open(url, '_blank');
          }}
        >
          Ver tela pública de avaliação
        </Button>
      </Panel>

      {avaliacoes.length === 0 ? (
        <Panel espaco="lg" className="flex flex-col items-center gap-3 text-center">
          <Star className="h-10 w-10 text-ink-subtle" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink">Nenhuma avaliação recebida ainda</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Assim que os clientes abrirem o link do WhatsApp após a retirada do veículo, as notas e elogios aparecem aqui.
          </p>
        </Panel>
      ) : (
        <Panel espaco="nenhum">
          <ul aria-label="Avaliações dos clientes" className="divide-y divide-line">
            {avaliacoes.map((av) => (
              <li key={av.id} className="space-y-1.5 px-4 py-4 lg:px-5">
                <div className="flex items-center justify-between gap-3">
                  <Estrelas nota={av.nota} />
                  <span className="text-xs tabular-nums text-ink-muted">{formatData(av.data)}</span>
                </div>
                <p className="text-sm font-medium text-ink">{av.cliente_nome}</p>
                <p className="text-xs text-ink-muted">
                  {[av.veiculo_modelo, av.veiculo_placa].filter(Boolean).join(' · ')} · Mecânico: {av.mecanico_nome || 'Equipe'}
                </p>
                {av.comentario && <p className="max-w-prose text-sm text-ink">&ldquo;{av.comentario}&rdquo;</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
