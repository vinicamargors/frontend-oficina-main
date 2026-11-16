import { formatBRL } from '../lib/format';
import { useEffect, useId, useState } from 'react';
import { Button } from './ui';
import { Folha } from './Folha';
import { FORMAS_PAGAMENTO } from '../pages/ordens/formasPagamento';


/**
 * Folha obrigatória antes de marcar a OS como paga. Abre sempre sem forma marcada, mesmo que a OS já tenha uma;
 * "Confirmar pagamento" só libera depois da escolha. Cancelar, Esc e clique no fundo não escrevem nada.
 */
export function ConfirmarPagamento({
  aberto,
  total,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean;
  total: number;
  aoConfirmar: (forma: string) => void;
  aoCancelar: () => void;
}) {
  const [forma, setForma] = useState<string | null>(null);
  const nomeGrupo = useId();

  // Ao fechar, esquece a escolha: a próxima abertura começa sem nada marcado.
  useEffect(() => {
    if (!aberto) setForma(null);
  }, [aberto]);

  return (
    <Folha aberto={aberto} titulo="Confirmar pagamento" aoCancelar={aoCancelar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (forma) aoConfirmar(forma);
        }}
        className="space-y-5"
      >
        <div>
          <p className="text-sm text-ink-muted">Total da ordem</p>
          <p className="text-[2rem] font-semibold leading-tight tabular-nums text-ink">{formatBRL(total)}</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink">Forma de pagamento</legend>
          {FORMAS_PAGAMENTO.map((fp) => {
            const marcada = forma === fp;
            return (
              <label
                key={fp}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                  marcada ? 'bg-brand/15 text-ink' : 'bg-muted text-ink hover:bg-line'
                }`}
              >
                <input
                  type="radio"
                  name={nomeGrupo}
                  value={fp}
                  checked={marcada}
                  onChange={() => setForma(fp)}
                  className="h-5 w-5 shrink-0 accent-brand focus-visible:outline-none"
                />
                {fp}
              </label>
            );
          })}
        </fieldset>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Button>
          <Button type="submit" data-tour="pagamento-confirmar" disabled={!forma}>
            Confirmar pagamento
          </Button>
        </div>
      </form>
    </Folha>
  );
}
