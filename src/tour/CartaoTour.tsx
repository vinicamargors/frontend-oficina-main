import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useMediaQuery } from '../lib/useMediaQuery';
import { Button } from '../components/ui/Button';
import { CARTAO_A, CARTAO_L, elementoDoAlvo, posicionarCartao, visivel } from './posicao';
import type { PassoTour, TourDef } from './tipos';

const MARGEM = 6;

type Caixa = { top: number; left: number; width: number; height: number };

function barraInferior(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--barra-inferior-h');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function CartaoTour({
  def,
  passos,
  aoEncerrar,
  aoPularTodos,
}: {
  def: TourDef;
  passos: PassoTour[];
  aoEncerrar: () => void;
  aoPularTodos: () => void;
}) {
  const celular = useMediaQuery('(max-width: 1023px)');
  const [lista, setLista] = useState(passos);
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const voltarFoco = useRef<Element | null>(document.activeElement);
  const passo = lista[i];
  const ultimo = i === lista.length - 1;

  // fundo inerte + devolve o foco ao fechar
  useEffect(() => {
    const raiz = document.getElementById('root');
    raiz?.setAttribute('inert', '');
    const antes = voltarFoco.current as HTMLElement | null;
    return () => {
      raiz?.removeAttribute('inert');
      antes?.focus?.();
    };
  }, []);

  const medir = () => {
    if (!passo) return;
    const el = elementoDoAlvo(document, passo.alvo);
    // alvo some por instantes (tela recarregando): mantém o passo e a última posição
    if (!visivel(el)) return;
    const r = el.getBoundingClientRect();
    setCaixa({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  // rola o alvo para a tela (no celular, para acima do cartão fixo na base) e mede
  useLayoutEffect(() => {
    if (!passo) return;
    const el = elementoDoAlvo(document, passo.alvo);
    if (!visivel(el)) {
      setLista((l) => l.filter((p) => p.id !== passo.id));
      return;
    }
    const vh = window.innerHeight;
    const r0 = el.getBoundingClientRect();
    const limite = celular ? vh - barraInferior() - CARTAO_A - 24 : vh - 24;
    if (r0.top < 16 || r0.bottom > limite) {
      const alvoTopo = celular ? 16 : Math.max(16, (vh - r0.height) / 2);
      window.scrollBy({ top: r0.top - alvoTopo, behavior: 'auto' });
    }
    medir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo?.id, celular]);

  useEffect(() => {
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo?.id]);

  // foco no cartão assim que ele aparece (e a cada passo)
  const temCaixa = !!caixa;
  useEffect(() => {
    if (temCaixa) cartaoRef.current?.focus();
  }, [temCaixa, passo?.id]);

  // acabaram os passos visíveis
  useEffect(() => {
    if (lista.length === 0) aoEncerrar();
  }, [lista.length, aoEncerrar]);
  useEffect(() => {
    if (i > lista.length - 1 && lista.length > 0) setI(lista.length - 1);
  }, [i, lista.length]);

  const aoTecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      aoEncerrar();
      return;
    }
    if (e.key !== 'Tab') return;
    const focaveis = cartaoRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focaveis || focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const fim = focaveis[focaveis.length - 1];
    if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === cartaoRef.current)) {
      e.preventDefault();
      fim.focus();
    } else if (!e.shiftKey && document.activeElement === fim) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  // Esc também com o foco fora do cartão
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoEncerrar();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [aoEncerrar]);

  if (!passo || !caixa) return null;

  const vp = { w: window.innerWidth, h: window.innerHeight };
  const furo = {
    top: caixa.top - MARGEM,
    left: caixa.left - MARGEM,
    width: caixa.width + MARGEM * 2,
    height: caixa.height + MARGEM * 2,
  };
  const pos = posicionarCartao(furo, vp, celular, barraInferior());
  const recorte = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${furo.left}px ${furo.top}px, ${furo.left}px ${furo.top + furo.height}px, ${furo.left + furo.width}px ${furo.top + furo.height}px, ${furo.left + furo.width}px ${furo.top}px, ${furo.left}px ${furo.top}px)`;
  const idTitulo = `tour-titulo-${def.id}`;
  const idTexto = `tour-texto-${def.id}`;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-ink/60" style={{ clipPath: recorte }} aria-hidden="true" />
      {/* bloqueia cliques também sobre o elemento destacado */}
      <div className="absolute" style={{ top: furo.top, left: furo.left, width: furo.width, height: furo.height }} aria-hidden="true" />
      <div
        className="absolute rounded-xl ring-2 ring-brand pointer-events-none motion-safe:transition-all"
        style={{ top: furo.top, left: furo.left, width: furo.width, height: furo.height }}
        aria-hidden="true"
      />
      <div
        ref={cartaoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        tabIndex={-1}
        onKeyDown={aoTecla}
        className="absolute bg-surface text-ink rounded-2xl p-5 shadow-card outline-none"
        style={{ top: pos.top, left: pos.left, width: celular ? vp.w - 24 : CARTAO_L }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-ink-muted tabular-nums">Passo {i + 1} de {lista.length}</p>
          <button
            type="button"
            onClick={aoEncerrar}
            aria-label="Fechar o tour"
            className="-mt-2 -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <h2 id={idTitulo} className="mt-1 text-base font-semibold text-balance">
          {passo.titulo}
        </h2>
        <p id={idTexto} className="mt-1 text-sm text-ink-muted text-pretty">
          {passo.texto}
        </p>
        <p className="sr-only" aria-live="polite">
          Passo {i + 1} de {lista.length}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={aoPularTodos}
            className="min-h-11 text-[0.8125rem] text-ink-muted underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
          >
            Pular todos os tours
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variante="secundario" onClick={() => setI(i - 1)}>
                Voltar
              </Button>
            )}
            <Button onClick={() => (ultimo ? aoEncerrar() : setI(i + 1))}>{ultimo ? 'Concluir' : 'Próximo'}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
