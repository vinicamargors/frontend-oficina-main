import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

// Itens desabilitados não recebem foco: ficam de fora da navegação por setas, Home/End e do foco inicial
const ITEM_ATIVO = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';

export interface ItemMenu {
  rotulo: string;
  icone: LucideIcon;
  aoClicar: () => void;
  /** Item visível mas inativo (ex.: saída com saldo zero). */
  desabilitado?: boolean;
  /** Por que o item está inativo (dica ao passar o mouse e texto para leitor de tela). */
  motivo?: string;
}

/**
 * Menu "mais ações" (botão de três pontos). Abre abaixo do botão, fecha com Esc, clique fora ou ao escolher,
 * e devolve o foco ao botão (Tab fecha e segue). Itens de 44px; setas e Home/End navegam.
 */
export function MenuAcoes({ rotulo, itens }: { rotulo: string; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const [acima, setAcima] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);

  // Sem espaço abaixo (a barra de navegação do celular, cuja altura real o shell publica em --barra-inferior-h), abre para cima.
  // Reavalia ao rolar/redimensionar enquanto aberto; sem a variável, reserva 88px no celular.
  const reavaliar = useCallback(() => {
    const gatilhoBox = gatilho.current?.getBoundingClientRect();
    const altura = painel.current?.offsetHeight ?? 0;
    if (!gatilhoBox || !gatilho.current) return;
    const barra = parseFloat(getComputedStyle(gatilho.current).getPropertyValue('--barra-inferior-h'));
    const reservaRodape = Number.isFinite(barra) ? barra + 8 : window.innerWidth < 1024 ? 88 : 8;
    const abaixo = window.innerHeight - gatilhoBox.bottom - reservaRodape;
    setAcima(altura + 4 > abaixo && gatilhoBox.top > altura + 8);
  }, []);

  useLayoutEffect(() => {
    if (!aberto) {
      setAcima(false);
      return;
    }
    reavaliar();
    window.addEventListener('resize', reavaliar);
    window.addEventListener('scroll', reavaliar, true);
    return () => {
      window.removeEventListener('resize', reavaliar);
      window.removeEventListener('scroll', reavaliar, true);
    };
  }, [aberto, reavaliar]);

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>(ITEM_ATIVO)?.focus();
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
    if (e.key === 'Tab') {
      // Fecha e deixa o Tab seguir o fluxo natural (o painel não prende o foco)
      setAberto(false);
      return;
    }
    const itensDom = Array.from(raiz.current?.querySelectorAll<HTMLElement>(ITEM_ATIVO) ?? []);
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
          {itens.map(({ rotulo: r, icone: Icone, aoClicar, desabilitado, motivo }) => (
            <button
              key={r}
              type="button"
              role="menuitem"
              disabled={desabilitado}
              title={desabilitado && motivo ? motivo : undefined}
              onClick={() => {
                setAberto(false);
                gatilho.current?.focus(); // se ainda montado; uma folha aberta por aoClicar devolve o foco aqui ao fechar
                aoClicar();
              }}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Icone size={16} className="text-ink-muted" aria-hidden="true" />
              {r}
              {desabilitado && motivo && <span className="sr-only">. {motivo}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
