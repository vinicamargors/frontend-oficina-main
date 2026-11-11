import { useEffect, useRef, useState } from 'react';
import { BookOpen, CircleHelp, Route } from 'lucide-react';
import { useTour } from '../../tour/TourProvider';
import { TOUR_POR_ABA } from '../../tour/porAba';

/** Pede ao app para trocar de aba (respeita a proteção de formulário sujo). */
export function navegarPara(tab: string) {
  window.dispatchEvent(new CustomEvent('mecanify:navegar', { detail: { tab } }));
}

const ITEM = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';

/** Botão "?" do cabeçalho: refazer o tour da página ou abrir os guias. Some na própria Ajuda. */
export function BotaoAjuda() {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const { refazer } = useTour();
  const aba = new URLSearchParams(window.location.search).get('tab') || 'patio';
  const tour = TOUR_POR_ABA[aba];

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        gatilho.current?.focus();
      }
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  if (aba === 'ajuda') return null;

  return (
    <div ref={raiz} className="relative">
      <button
        ref={gatilho}
        type="button"
        aria-label="Ajuda"
        title="Ajuda"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <CircleHelp size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {aberto && (
        <div role="menu" aria-label="Ajuda" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl bg-surface p-1 shadow-card ring-1 ring-line">
          {tour && (
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                setAberto(false);
                refazer(tour);
              }}
            >
              <Route size={16} aria-hidden="true" />
              Refazer o tour desta página
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => {
              setAberto(false);
              navegarPara('ajuda');
            }}
          >
            <BookOpen size={16} aria-hidden="true" />
            Ver guias de ajuda
          </button>
        </div>
      )}
    </div>
  );
}
