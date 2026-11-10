import { useEffect, useState } from 'react';

/** Devolve `valor` só depois de `atrasoMs` sem mudanças (o campo continua instantâneo; quem lê o valor espera). */
export function useDebouncedValue<T>(valor: T, atrasoMs: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(t);
  }, [valor, atrasoMs]);
  return atrasado;
}
