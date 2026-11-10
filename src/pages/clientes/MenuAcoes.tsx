import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

export interface ItemMenu {
  rotulo: string;
  icone: LucideIcon;
  aoClicar: () => void;
  /** Item visível mas inativo (ex.: saída com saldo zero). */
  desabilitado?: boolean;
}

/**
 * Menu "mais ações" (botão de três pontos). Abre abaixo do botão, fecha com Esc, clique fora ou ao escolher,
 * e devolve o foco ao botão. Itens de 44px; setas e Home/End navegam.
 */
export function MenuAcoes({ rotulo, itens }: { rotulo: string; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const [acima, setAcima] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);

  // Sem espaço abaixo (barra de navegação do celular ocupa ~5rem no rodapé), abre para cima
  useLayoutEffect(() => {
    if (!aberto) {
      setAcima(false);
      return;
    }
    const gatilhoBox = gatilho.current?.getBoundingClientRect();
    const altura = painel.current?.offsetHeight ?? 0;
    if (!gatilhoBox) return;
    const reservaRodape = window.innerWidth < 1024 ? 88 : 8;
    const abaixo = window.innerHeight - gatilhoBox.bottom - reservaRodape;
    setAcima(altura + 4 > abaixo && gatilhoBox.top > altura + 8);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setAberto(false);
      gatilho.current?.focus();
      return;
    }
    const itensDom = Array.from(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = itensDom.indexOf(document.activeElement as HTMLElement);
    let alvo = -1;
    if (e.key === 'ArrowDown') alvo = (i + 1) % itensDom.length;
    else if (e.key === 'ArrowUp') alvo = (i - 1 + itensDom.length) % itensDom.length;
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = itensDom.length - 1;
    if (alvo < 0) return;
    e.preventDefault();
    itensDom[alvo]?.focus();
  };

  return (
    <div ref={raiz} className="relative" onKeyDown={aoTeclar}>
      <button
        ref={gatilho}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <MoreHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {aberto && (
        <div
          ref={painel}
          role="menu"
          aria-label={rotulo}
          className={`absolute right-0 z-20 w-60 rounded-2xl bg-surface p-1.5 shadow-card ring-1 ring-line dark:bg-line dark:ring-line-strong ${acima ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {itens.map(({ rotulo: r, icone: Icone, aoClicar, desabilitado }) => (
            <button
              key={r}
              type="button"
              role="menuitem"
              disabled={desabilitado}
              onClick={() => {
                setAberto(false);
                aoClicar();
              }}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Icone size={16} className="text-ink-muted" aria-hidden="true" />
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
