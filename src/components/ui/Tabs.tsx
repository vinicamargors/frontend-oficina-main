import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  id: string;
  rotulo: string;
  icone?: LucideIcon;
}

// Controle segmentado em pílulas: trilho `muted`, aba ativa em `surface`. O padding do trilho e o anel
// `ring-inset` mantêm o foco visível mesmo com rolagem horizontal.
export function Tabs({
  itens,
  ativo,
  aoMudar,
  rotuloGrupo,
  idPainel,
  quebrar = false,
}: {
  itens: TabItem[];
  ativo: string;
  aoMudar: (id: string) => void;
  rotuloGrupo: string;
  /** id do `role="tabpanel"` que mostra o conteúdo da aba ativa. */
  idPainel?: string;
  /** Quebra as abas em linhas (sem rolagem lateral) quando não cabem: trilho vira `rounded-2xl`. */
  quebrar?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const aoTeclar = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let alvo = -1;
    if (e.key === 'ArrowRight') alvo = (i + 1) % itens.length;
    else if (e.key === 'ArrowLeft') alvo = (i - 1 + itens.length) % itens.length;
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = itens.length - 1;
    if (alvo < 0) return;
    e.preventDefault();
    refs.current[alvo]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={rotuloGrupo}
      className={`max-w-full gap-1 bg-muted p-1 ${quebrar ? 'flex flex-wrap rounded-2xl' : 'inline-flex overflow-x-auto rounded-full'}`}
    >
      {itens.map((item, i) => {
        const selecionada = item.id === ativo;
        const Icone = item.icone;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`aba-${item.id}`}
            aria-selected={selecionada}
            aria-controls={selecionada ? idPainel : undefined}
            tabIndex={selecionada ? 0 : -1}
            onClick={() => aoMudar(item.id)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={`inline-flex h-9 min-h-11 md:min-h-9 shrink-0 items-center gap-2 ${quebrar ? 'grow justify-center' : ''} rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
              selecionada ? 'bg-surface text-ink shadow-card dark:bg-line' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {Icone && <Icone size={16} aria-hidden="true" />}
            {item.rotulo}
          </button>
        );
      })}
    </div>
  );
}
