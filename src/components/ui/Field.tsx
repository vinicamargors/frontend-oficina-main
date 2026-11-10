import { cloneElement, useId, type ReactElement } from 'react';

type CampoProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; className?: string };

export function Field({ rotulo, erro, dica, children }: { rotulo: string; erro?: string; dica?: string; children: ReactElement<CampoProps> }) {
  const gerado = useId();
  const id = children.props.id ?? gerado;
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const descritoPor = [erro ? idErro : null, dica ? idDica : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {rotulo}
      </label>
      {cloneElement(children, { id, 'aria-describedby': descritoPor, 'aria-invalid': erro ? true : undefined })}
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
