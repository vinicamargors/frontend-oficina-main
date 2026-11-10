import { useEffect, useState } from 'react';

/** `true` enquanto a media query casar (ex.: '(max-width: 1023px)'). Sem `matchMedia` (testes), `false`. */
export function useMediaQuery(consulta: string): boolean {
  const ler = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(consulta).matches : false);
  const [casa, setCasa] = useState(ler);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(consulta);
    const aoMudar = () => setCasa(mql.matches);
    aoMudar();
    mql.addEventListener('change', aoMudar);
    return () => mql.removeEventListener('change', aoMudar);
  }, [consulta]);
  return casa;
}
