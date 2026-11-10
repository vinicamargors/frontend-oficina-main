import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react';

/**
 * Casca das folhas de confirmação: `<dialog>` nativo com `showModal()` (Esc, foco preso, fundo).
 * Esc e clique no fundo chamam `aoCancelar`. No celular vira folha inferior; ≥640px, cartão central.
 * O foco inicial vai para o título (nunca para uma opção, que pareceria pré-marcada).
 */
export function Folha({
  aberto,
  titulo,
  aoCancelar,
  children,
  tamanho = 'sm',
  fecharNoFundo = true,
}: {
  aberto: boolean;
  titulo: string;
  aoCancelar: () => void;
  children: ReactNode;
  /** `lg`: formulários longos (rola dentro da folha; ≥640px, cartão de 40rem). */
  tamanho?: 'sm' | 'lg';
  /** false: o clique no fundo não fecha (formulários, para um toque errado não descartar o que foi digitado). */
  fecharNoFundo?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
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
    if (fecharNoFundo && e.target === ref.current) aoCancelar();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={cancelar}
      onClick={cliqueNoFundo}
      className={`m-0 mt-auto w-full max-w-full rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-ink/40 dark:backdrop:bg-black/60 sm:m-auto sm:rounded-2xl ${
        tamanho === 'lg' ? 'max-h-[92dvh] overflow-y-auto sm:w-[40rem]' : 'sm:w-[28rem]'
      }`}
    >
      {aberto && (
        <div className="space-y-5 p-5 sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <h2 id={idTitulo} ref={tituloRef} tabIndex={-1} className="text-lg font-semibold text-ink focus:outline-none">
            {titulo}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
