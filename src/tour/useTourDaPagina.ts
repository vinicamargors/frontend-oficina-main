import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TOURS_ATIVOS } from './config';
import { jaViu } from './estado';
import { useTourContext } from './contexto';
import type { TourDef } from './tipos';

const ATRASO_MS = 400;

/** Inicia o mini-tour da página na primeira visita, quando a tela já carregou e nada está aberto por cima. */
export function useTourDaPagina(def: TourDef, pronto: boolean): void {
  const { isAuthenticated } = useAuth();
  const { meta, iniciar, cancelar, registrar } = useTourContext();

  // o botão "?" refaz o tour da tela que está pronta agora
  useEffect(() => {
    if (!pronto) return;
    registrar(def);
    return () => registrar(null);
  }, [pronto, def, registrar]);

  useEffect(() => {
    if (!TOURS_ATIVOS || !pronto || !isAuthenticated || !meta) return;
    if (meta.tours_pular_todos || jaViu(meta, def.id, def.versao)) return;
    const t = window.setTimeout(() => {
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      iniciar(def);
    }, ATRASO_MS);
    return () => window.clearTimeout(t);
  }, [pronto, isAuthenticated, meta, def, iniciar]);

  // trocar de página (desmontar) cancela sem marcar como visto
  useEffect(() => () => cancelar(def.id), [def.id, cancelar]);
}
