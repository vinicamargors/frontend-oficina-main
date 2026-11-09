import { createClient, User } from '@supabase/supabase-js';
import { Usuario } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// senha_hash (legado) não é exposto pela API: sempre listar as colunas.
export const COLUNAS_USUARIO =
  'id, nome, email, telefone, cargo, ativo, empresa_id, salario_base, comissao_servico_pct, comissao_peca_pct, vale_transporte, vale_refeicao, paga_hora_extra, valor_hora_extra, estrelas_media, total_avaliacoes';

/**
 * Garante que um usuário recém-cadastrado no Supabase Auth tenha oficina e perfil.
 * A criação é feita pelo backend (service_role); o navegador não grava em empresas/usuarios.
 */
export async function garantirPerfilOficina(authUser: User): Promise<Usuario | null> {
  const { data: existente, error } = await supabase
    .from('usuarios')
    .select(COLUNAS_USUARIO)
    .eq('id', authUser.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existente) return existente as Usuario;

  const { api } = await import('../api/client');
  return api.onboarding();
}
