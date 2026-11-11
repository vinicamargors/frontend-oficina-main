import type { Page } from '@playwright/test';
import type { CargoUsuario } from '../../src/types';
import { perfilDoCargo } from './fixtures';

export const SUPABASE_URL = 'http://mock.supabase.local';
/** Chave que o supabase-js usa para `http://mock.supabase.local`: `sb-<primeiro rótulo do host>-auth-token`. */
export const CHAVE_SESSAO = 'sb-mock-auth-token';
export const CHAVE_TEMA = 'mecanify_tema';

const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');

/** JWT falso (não assinado de verdade) com `exp` no futuro. */
export function jwtFalso(userId: string, cargo: CargoUsuario, exp: number): string {
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: userId, role: 'authenticated', aud: 'authenticated', cargo, exp }),
    'assinatura-falsa',
  ].join('.');
}

/** Decodifica o `sub` de um `Authorization: Bearer <jwt falso>`. */
export function usuarioDoToken(authorization?: string): string | undefined {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  const payload = token?.split('.')[1];
  if (!payload) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).sub;
  } catch {
    return undefined;
  }
}

export function sessaoSupabase(cargo: CargoUsuario, metaExtra: Record<string, unknown> = {}) {
  const perfil = perfilDoCargo(cargo);
  const agora = Math.floor(Date.now() / 1000);
  const expiraEm = agora + 365 * 24 * 3600;
  return {
    access_token: jwtFalso(perfil.id, cargo, expiraEm),
    refresh_token: 'refresh-falso',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiraEm,
    user: {
      id: perfil.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: perfil.email,
      email_confirmed_at: '2024-01-01T00:00:00Z',
      app_metadata: { provider: 'email' },
      user_metadata: { nome: perfil.nome, ...metaExtra },
      created_at: '2024-01-01T00:00:00Z',
    },
  };
}

/**
 * Deixa o navegador "logado" como `cargo` e grava o tema escolhido.
 * Deve ser chamada ANTES de `abrirTela`. Só escreve se a chave ainda não existe, para não
 * desfazer um logout ou uma troca de tema feita dentro da própria sessão.
 */
export async function entrarComo(
  page: Page,
  cargo: CargoUsuario,
  tema: 'claro' | 'escuro',
  opcoes: { tourAtivo?: boolean; metaExtra?: Record<string, unknown> } = {}
): Promise<void> {
  // por padrão a conta já "pulou todos os tours": só os testes do tour os ligam
  const sessao = sessaoSupabase(cargo, opcoes.tourAtivo ? (opcoes.metaExtra ?? {}) : { tours_pular_todos: true, ...(opcoes.metaExtra ?? {}) });
  await page.addInitScript(
    ({ chaveSessao, sessao, chaveTema, tema }) => {
      try {
        if (!localStorage.getItem(chaveSessao)) localStorage.setItem(chaveSessao, JSON.stringify(sessao));
        if (!localStorage.getItem(chaveTema)) localStorage.setItem(chaveTema, tema);
      } catch {
        /* localStorage indisponível */
      }
    },
    { chaveSessao: CHAVE_SESSAO, sessao, chaveTema: CHAVE_TEMA, tema }
  );
}
