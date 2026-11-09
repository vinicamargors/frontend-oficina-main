import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, garantirPerfilOficina } from '../lib/supabase';
import { api, ApiError, migrarConfigLocal } from '../api/client';
import { Usuario } from '../types';

export interface RegisterInput {
  nomeOficina: string;
  nome: string;
  telefone: string;
  email: string;
  senha: string;
}

export interface RegisterResult {
  requiresEmailConfirmation: boolean;
  email: string;
}

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (dados: RegisterInput) => Promise<RegisterResult>;
  resendConfirmation: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (novaSenha: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function detectRecoveryFromUrl(): boolean {
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';
  return (
    search.get('modo') === 'nova-senha' ||
    search.get('type') === 'recovery' ||
    hash.includes('type=recovery')
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(
    detectRecoveryFromUrl
  );

  const syncUserProfile = useCallback(async (authUser: User) => {
    const perfilLocal = await garantirPerfilOficina(authUser);
    let perfil: Usuario;
    try {
      perfil = await api.getMe();
    } catch (err) {
      // O perfil lido direto só vale se o backend estiver fora do ar (acordando).
      // Se o backend respondeu recusando (401/403/404), o acesso é negado.
      const recusado = err instanceof ApiError && err.status >= 400 && err.status < 500;
      if (recusado) throw err;
      if (!perfilLocal || !perfilLocal.ativo) {
        throw new Error('Usuário inativo ou sem perfil vinculado.');
      }
      perfil = perfilLocal;
    }
    setUser(perfil);

    // Dono: leva para o servidor o que versões antigas guardavam só neste navegador (uma vez).
    if (perfil.cargo === 'DONO' && perfil.empresa_id) {
      migrarConfigLocal(perfil.empresa_id).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        if (detectRecoveryFromUrl()) {
          setIsPasswordRecovery(true);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted && !detectRecoveryFromUrl()) {
          await syncUserProfile(session.user);
        }
      } catch (err) {
        console.error('Erro ao restaurar sessão:', err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (detectRecoveryFromUrl()) {
          setIsPasswordRecovery(true);
          setLoading(false);
          return;
        }
        try {
          await syncUserProfile(session.user);
        } catch (err) {
          console.error('Falha ao sincronizar perfil:', err);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncUserProfile]);

  const login = async (email: string, senha: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: senha,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('email not confirmed')) {
        const err = new Error(
          'Seu e-mail ainda não foi confirmado. Abra sua caixa de entrada e toque no link enviado pelo Supabase.'
        ) as Error & { code?: string };
        err.code = 'EMAIL_NOT_CONFIRMED';
        throw err;
      }
      if (msg.includes('invalid login credentials')) {
        throw new Error(
          'E-mail ou senha incorretos. Confira os dados digitados ou toque em "Esqueci minha senha".'
        );
      }
      throw new Error(error.message);
    }

    if (data.user) {
      setIsPasswordRecovery(false);
      await syncUserProfile(data.user);
    }
  };

  const register = async (dados: RegisterInput): Promise<RegisterResult> => {
    const cleanEmail = dados.email.trim().toLowerCase();
    const cleanNome = dados.nome.trim();
    const cleanOficina = dados.nomeOficina.trim();
    const cleanTelefone = dados.telefone.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: dados.senha,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          nome: cleanNome,
          nome_fantasia: cleanOficina,
          telefone: cleanTelefone,
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        throw new Error(
          'Este e-mail já possui cadastro. Mude para a aba "Entrar" ou use "Esqueci minha senha".'
        );
      }
      throw new Error(error.message);
    }

    if (data.user && data.session) {
      await syncUserProfile(data.user);
      return { requiresEmailConfirmation: false, email: cleanEmail };
    }

    if (data.user) {
      try {
        await garantirPerfilOficina(data.user);
      } catch {
        // Provisionará no 1º login pós-confirmação
      }
    }

    return { requiresEmailConfirmation: true, email: cleanEmail };
  };

  const resendConfirmation = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      throw new Error(
        error.message ||
          'Não foi possível reenviar o e-mail agora. Aguarde 1 minuto e tente novamente.'
      );
    }
  };

  const requestPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const redirectUrl = `${window.location.origin}/?modo=nova-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl,
    });
    if (error) {
      throw new Error(
        error.message ||
          'Não foi possível enviar o e-mail de recuperação agora. Verifique o endereço e tente novamente.'
      );
    }
  };

  const updatePassword = async (novaSenha: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: novaSenha,
    });
    if (error) {
      throw new Error(
        error.message || 'Não foi possível salvar a nova senha. Solicite um novo link.'
      );
    }
    setIsPasswordRecovery(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('modo');
    url.searchParams.delete('type');
    url.hash = '';
    window.history.replaceState({}, '', url.toString());

    if (data.user) {
      await syncUserProfile(data.user);
    }
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    const url = new URL(window.location.href);
    url.searchParams.set('modo', 'login');
    url.hash = '';
    window.history.replaceState({}, '', url.toString());
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('autotec_tenant_id');
    setIsPasswordRecovery(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user && !isPasswordRecovery,
        isPasswordRecovery,
        login,
        register,
        resendConfirmation,
        requestPasswordReset,
        updatePassword,
        clearPasswordRecovery,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
