import { useEffect, useId, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react';
import { Button } from './ui';
import { FORMAS_PAGAMENTO } from '../pages/ordens/formasPagamento';

const formatBRL = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

/**
 * Folha obrigatória antes de marcar a OS como paga. `<dialog>` nativo (Esc, foco preso e fundo de graça).
 * Abre sempre sem forma marcada, mesmo que a OS já tenha uma; "Confirmar pagamento" só libera depois da escolha.
 * Cancelar, Esc e clique no fundo chamam `aoCancelar` e não escrevem nada.
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
  const ref = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [forma, setForma] = useState<string | null>(null);
  const idTitulo = useId();
  const nomeGrupo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      setForma(null);
      d.showModal();
      // Foco no título, não na primeira opção: uma opção focada parece pré-marcada.
      tituloRef.current?.focus();
    } else if (!aberto && d.open) {
      d.close();
    }
  }, [aberto]);

  const cancelar = (e: SyntheticEvent) => {
    e.preventDefault();
    aoCancelar();
  };

  const cliqueNoFundo = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) aoCancelar();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={cancelar}
      onClick={cliqueNoFundo}
      className="m-0 mt-auto w-full max-w-full rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-ink/40 dark:backdrop:bg-black/60 sm:m-auto sm:w-[28rem] sm:rounded-2xl"
    >
      {aberto && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (forma) aoConfirmar(forma);
          }}
          className="space-y-5 p-5 sm:p-6"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div>
            <h2 id={idTitulo} ref={tituloRef} tabIndex={-1} className="text-lg font-semibold text-ink focus:outline-none">
              Confirmar pagamento
            </h2>
            <p className="mt-4 text-sm text-ink-muted">Total da ordem</p>
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
            <Button type="submit" disabled={!forma}>
              Confirmar pagamento
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
