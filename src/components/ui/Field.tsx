import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { CLASSE_CAMPO } from './campo';

type CampoProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false'; className?: string };

// Rótulo visível + dica + erro abaixo do campo. Mescla (não sobrescreve) aria-describedby/aria-invalid do filho.
// Filho sem className recebe CLASSE_CAMPO (borda `line-strong`, `rounded-lg`).

// `anunciar`: o erro vira `role="alert"` (leitor de tela lê ao aparecer). `adorno`: controle sobreposto ao canto direito do campo (ex.: mostrar senha),
// posicionado em relação só ao campo — não depende da altura do rótulo/dica/erro.
export function Field({
  rotulo,
  erro,
  dica,
  anunciar = false,
  adorno,
  children,
}: {
  rotulo: string;
  erro?: string;
  dica?: string;
  anunciar?: boolean;
  adorno?: ReactNode;
  children: ReactElement<CampoProps>;
}) {
  const gerado = useId();
  const id = children.props.id ?? gerado;
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const descritoPor =
    [children.props['aria-describedby'], dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(' ') || undefined;
  const invalido = erro ? true : children.props['aria-invalid'];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {rotulo}
      </label>
      {(() => {
        const campo = cloneElement(children, { id, 'aria-describedby': descritoPor, 'aria-invalid': invalido, className: children.props.className ?? CLASSE_CAMPO });
        return adorno ? (
          <div className="relative">
            {campo}
            <div className="absolute right-0 top-0">{adorno}</div>
          </div>
        ) : (
          campo
        );
      })()}
      {dica && (
        <p id={idDica} className="text-xs text-ink-subtle">
          {dica}
        </p>
      )}
      {erro && (
        <p id={idErro} role={anunciar ? 'alert' : undefined} className="text-[0.8125rem] text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
