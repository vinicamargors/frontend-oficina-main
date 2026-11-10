import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Tema = 'claro' | 'escuro';
export type PreferenciaTema = Tema | 'sistema';

const CHAVE = 'mecanify_tema';
// codemod:ignore-start (espelha as metas theme-color de index.html: meta não lê tokens CSS; manter os dois em sincronia)
const COR_BARRA: Record<Tema, string> = { claro: '#F1EDE4', escuro: '#111214' };
// codemod:ignore-end
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';

interface TemaContextValue {
  tema: Tema;
  preferencia: PreferenciaTema;
  definir: (p: PreferenciaTema) => void;
}

const TemaContext = createContext<TemaContextValue | null>(null);

function lerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === 'claro' || v === 'escuro') return v;
  } catch {
    /* localStorage indisponível */
  }
  return 'sistema';
}

function sistemaEscuro(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_ESCURO).matches;
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(lerPreferencia);
  const [escuroDoSistema, setEscuroDoSistema] = useState<boolean>(sistemaEscuro);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(CONSULTA_ESCURO);
    const aoMudar = (e: MediaQueryListEvent) => setEscuroDoSistema(e.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const tema: Tema = preferencia === 'sistema' ? (escuroDoSistema ? 'escuro' : 'claro') : preferencia;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
  }, [tema]);

  // As metas theme-color têm `media`, que só segue o sistema. Com escolha manual, fixa a cor do tema escolhido
  // nas duas; com "sistema", devolve os valores originais do index.html.
  useEffect(() => {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m) => {
      if (m.dataset.original === undefined) m.dataset.original = m.content;
      m.content = preferencia === 'sistema' ? (m.dataset.original ?? m.content) : COR_BARRA[tema];
    });
  }, [tema, preferencia]);

  const definir = useCallback((p: PreferenciaTema) => {
    setPreferencia(p);
    try {
      if (p === 'sistema') localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, p);
    } catch {
      /* localStorage indisponível */
    }
  }, []);

  const valor = useMemo(() => ({ tema, preferencia, definir }), [tema, preferencia, definir]);
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaContextValue {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error('useTema deve ser usado dentro de <TemaProvider>');
  return ctx;
}
