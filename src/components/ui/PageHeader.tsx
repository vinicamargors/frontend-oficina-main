import { useEffect, type ReactNode } from 'react';
import { BotaoAjuda } from './BotaoAjuda';

/**
 * Título da tela + ações. `inicio` vem antes do título (ex.: placa), `complemento` logo depois (ex.: contagem,
 * etapa) e `abaixo` numa linha de apoio sob o título (ex.: cliente e telefone).
 */
export function PageHeader({
  titulo,
  acoes,
  inicio,
  complemento,
  abaixo,
  acoesClasse = '',
}: {
  titulo: string;
  acoes?: ReactNode;
  inicio?: ReactNode;
  complemento?: ReactNode;
  abaixo?: ReactNode;
  /** Classes extras do contêiner das ações (ex.: ocupar a linha inteira no celular). */
  acoesClasse?: string;
}) {
  useEffect(() => {
    document.title = `${titulo} · Mecanify`;
  }, [titulo]);
  const h1 = <h1 className="text-[1.375rem] font-semibold text-ink text-balance">{titulo}</h1>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      {inicio || complemento || abaixo ? (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {inicio}
            {h1}
            {complemento}
            <BotaoAjuda />
          </div>
          {abaixo && <div className="mt-1 text-sm text-ink-muted">{abaixo}</div>}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {h1}
          <BotaoAjuda />
        </div>
      )}
      {acoes && <div className={`flex flex-wrap items-center gap-2 ${acoesClasse}`}>{acoes}</div>}
    </div>
  );
}
