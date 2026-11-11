import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CartaoTour } from './CartaoTour';
import { TourContext, type Ativo, type Ctx } from './contexto';
import { carregarEspelho, comPularTodos, comVisto, lerEstado, salvarEspelho, type TourMeta } from './estado';
import { passosVisiveis } from './posicao';
import type { TourDef } from './tipos';

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [meta, setMeta] = useState<TourMeta | null>(null);
  const [ativo, setAtivo] = useState<Ativo | null>(null);
  const ativoRef = useRef<Ativo | null>(null);
  const metaRef = useRef<TourMeta | null>(null);

  const definirAtivo = (a: Ativo | null) => {
    ativoRef.current = a;
    setAtivo(a);
  };

  // Lê o estado da conta (user_metadata) e une com o espelho local
  useEffect(() => {
    let vivo = true;
    metaRef.current = null;
    setMeta(null);
    if (!userId) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!vivo) return;
        const m = lerEstado(lerMetaDaConta(data.session?.user?.user_metadata), carregarEspelho(userId));
        metaRef.current = m;
        setMeta(m);
      })
      .catch(() => {
        if (!vivo) return;
        const m = lerEstado(undefined, carregarEspelho(userId));
        metaRef.current = m;
        setMeta(m);
      });
    return () => {
      vivo = false;
    };
  }, [userId]);

  const gravar = useCallback(
    (m: TourMeta) => {
      metaRef.current = m;
      setMeta(m);
      if (!userId) return;
      salvarEspelho(userId, m);
      const data: Record<string, unknown> = { tours: m.tours };
      if (m.tours_pular_todos) data.tours_pular_todos = true;
      // falha na conta nunca vira erro na tela: o espelho local evita repetir o tour
      supabase.auth.updateUser({ data }).catch(() => {});
    },
    [userId]
  );

  const iniciar = useCallback(
    (def: TourDef, opcoes?: { forcar?: boolean }) => {
      if (ativoRef.current) return;
      const passos = passosVisiveis(def, document);
      if (passos.length === 0) {
        if (!opcoes?.forcar && metaRef.current) gravar(comVisto(metaRef.current, def.id, def.versao));
        return;
      }
      definirAtivo({ def, passos, auto: !opcoes?.forcar });
    },
    [gravar]
  );

  const cancelar = useCallback((id: string) => {
    if (ativoRef.current?.def.id === id) definirAtivo(null);
  }, []);

  const refazer = useCallback((def: TourDef) => iniciar(def, { forcar: true }), [iniciar]);

  const pularTodos = useCallback(() => {
    const a = ativoRef.current;
    let m = comPularTodos(metaRef.current ?? { tours: {} });
    if (a) m = comVisto(m, a.def.id, a.def.versao);
    definirAtivo(null);
    gravar(m);
  }, [gravar]);

  const encerrar = useCallback(() => {
    const a = ativoRef.current;
    definirAtivo(null);
    if (a && metaRef.current) gravar(comVisto(metaRef.current, a.def.id, a.def.versao));
  }, [gravar]);

  const valor = useMemo<Ctx>(
    () => ({ meta, ativo, iniciar, cancelar, refazer, pularTodos, cargo: user?.cargo ?? null }),
    [meta, ativo, iniciar, cancelar, refazer, pularTodos, user?.cargo]
  );

  return (
    <TourContext.Provider value={valor}>
      {children}
      {ativo && <CartaoTour key={ativo.def.id} def={ativo.def} passos={ativo.passos} aoEncerrar={encerrar} aoPularTodos={pularTodos} />}
    </TourContext.Provider>
  );
}

function lerMetaDaConta(um: unknown): unknown {
  if (!um || typeof um !== 'object') return undefined;
  const o = um as Record<string, unknown>;
  return { tours: o.tours, tours_pular_todos: o.tours_pular_todos };
}
