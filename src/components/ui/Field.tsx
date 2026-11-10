import { cloneElement, useId, type ReactElement } from 'react';
import { CLASSE_CAMPO } from './campo';

type CampoProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false'; className?: string };

// Rótulo visível + dica + erro abaixo do campo. Mescla (não sobrescreve) aria-describedby/aria-invalid do filho.
// Filho sem className recebe CLASSE_CAMPO (borda `line-strong`, `rounded-lg`).

export function Field({ rotulo, erro, dica, children }: { rotulo: string; erro?: string; dica?: string; children: ReactElement<CampoProps> }) {
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
      {cloneElement(children, { id, 'aria-describedby': descritoPor, 'aria-invalid': invalido, className: children.props.className ?? CLASSE_CAMPO })}
      {dica && (
        <p id={idDica} className="text-xs text-ink-subtle">
          {dica}
        </p>
      )}
      {erro && (
        <p id={idErro} className="text-[0.8125rem] text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
