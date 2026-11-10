import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  LogIn,
  UserPlus,
  MailCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Lock,
  Car,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';

type AuthMode = 'login' | 'cadastro' | 'recuperar' | 'nova-senha';

export function Login() {
  const {
    login,
    register,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    isPasswordRecovery,
    clearPasswordRecovery,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('modo');
    if (
      isPasswordRecovery ||
      m === 'nova-senha' ||
      params.get('type') === 'recovery' ||
      window.location.hash.includes('type=recovery')
    ) {
      return 'nova-senha';
    }
    if (m === 'cadastro') return 'cadastro';
    if (m === 'recuperar') return 'recuperar';
    return 'login';
  });

  // Sincroniza automaticamente se o evento PASSWORD_RECOVERY disparar
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('nova-senha');
    }
  }, [isPasswordRecovery]);

  // Campos do formulário
  const [nomeOficina, setNomeOficina] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Estados de feedback
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [resetEmailSentTo, setResetEmailSentTo] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // Refs para foco automático e foco no primeiro erro
  const emailInputRef = useRef<HTMLInputElement>(null);
  const oficinaInputRef = useRef<HTMLInputElement>(null);
  const nomeInputRef = useRef<HTMLInputElement>(null);
  const senhaInputRef = useRef<HTMLInputElement>(null);
  const confirmarSenhaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('modo', mode);
    window.history.replaceState({}, '', url.toString());

    const titles: Record<AuthMode, string> = {
      login: 'Entrar — Mecanify',
      cadastro: 'Criar Conta da Oficina — Mecanify',
      recuperar: 'Recuperar Senha — Mecanify',
      'nova-senha': 'Definir Nova Senha — Mecanify',
    };
    document.title = titles[mode];
    return () => {
      document.title = 'Mecanify — Gestão de Oficina'; // ao sair do login, volta o título do app
    };
  }, [mode]);

  const switchMode = (newMode: AuthMode) => {
    if (mode === 'nova-senha' && newMode !== 'nova-senha') {
      clearPasswordRecovery();
    }
    setMode(newMode);
    setError(null);
    setResendSuccess(null);
    setUnconfirmedEmail(null);
    setConfirmationSentTo(null);
    setResetEmailSentTo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendSuccess(null);
    setUnconfirmedEmail(null);

    const trimmedEmail = email.trim();
    const trimmedSenha = senha.trim();
    const trimmedConfirmar = confirmarSenha.trim();

    // Fluxo 1: Recuperar Senha (pede apenas e-mail)
    if (mode === 'recuperar') {
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        setError('Digite o e-mail da sua conta para enviarmos o link de recuperação.');
        emailInputRef.current?.focus();
        return;
      }
      setSubmitting(true);
      try {
        await requestPasswordReset(trimmedEmail);
        setResetEmailSentTo(trimmedEmail.toLowerCase());
      } catch (err: unknown) {
        const customErr = err as Error;
        setError(
          customErr.message || 'Não foi possível enviar o link de recuperação agora.'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Fluxo 2: Definir Nova Senha (após clicar no link do e-mail)
    if (mode === 'nova-senha') {
      if (trimmedSenha.length < 6) {
        setError('A nova senha precisa ter pelo menos 6 caracteres.');
        senhaInputRef.current?.focus();
        return;
      }
      if (trimmedSenha !== trimmedConfirmar) {
        setError('As duas senhas digitadas não conferem. Digite novamente.');
        confirmarSenhaInputRef.current?.focus();
        return;
      }
      setSubmitting(true);
      try {
        await updatePassword(trimmedSenha);
      } catch (err: unknown) {
        const customErr = err as Error;
        setError(
          customErr.message ||
            'Link expirado ou inválido. Solicite um novo link em "Esqueci minha senha".'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Fluxo 3: Criar Conta ou Login
    if (mode === 'cadastro') {
      if (!nomeOficina.trim()) {
        setError('Informe o nome da sua oficina para configurar o painel.');
        oficinaInputRef.current?.focus();
        return;
      }
      if (!nome.trim()) {
        setError('Informe seu nome para identificação nas Ordens de Serviço.');
        nomeInputRef.current?.focus();
        return;
      }
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Digite um endereço de e-mail válido (ex.: oficina@email.com).');
      emailInputRef.current?.focus();
      return;
    }

    if (trimmedSenha.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      senhaInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(trimmedEmail, trimmedSenha);
      } else {
        const result = await register({
          nomeOficina,
          nome,
          telefone,
          email: trimmedEmail,
          senha: trimmedSenha,
        });
        if (result.requiresEmailConfirmation) {
          setConfirmationSentTo(result.email);
        }
      }
    } catch (err: unknown) {
      const customErr = err as Error & { code?: string };
      setError(
        customErr.message ||
          'Não foi possível concluir o acesso. Verifique sua conexão e tente novamente.'
      );
      if (customErr.code === 'EMAIL_NOT_CONFIRMED') {
        setUnconfirmedEmail(trimmedEmail);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendEmail = async (targetEmail: string) => {
    setResending(true);
    setError(null);
    setResendSuccess(null);
    try {
      await resendConfirmation(targetEmail);
      setResendSuccess(
        `Novo link de confirmação enviado para ${targetEmail}. Verifique também a caixa de Spam.`
      );
    } catch (err: unknown) {
      const customErr = err as Error;
      setError(customErr.message || 'Falha ao reenviar o e-mail de confirmação.');
    } finally {
      setResending(false);
    }
  };

  const handleResendPasswordReset = async (targetEmail: string) => {
    setResending(true);
    setError(null);
    setResendSuccess(null);
    try {
      await requestPasswordReset(targetEmail);
      setResendSuccess(
        `Enviamos um novo link de redefinição de senha para ${targetEmail}.`
      );
    } catch (err: unknown) {
      const customErr = err as Error;
      setError(customErr.message || 'Aguarde 1 minuto antes de solicitar outro link.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-canvas text-ink grid grid-cols-1 lg:grid-cols-12">
      {/* COLUNA ESQUERDA — IDENTIDADE INDUSTRIAL MECANIFY (Azul Oficina + Laranja) */}
      <aside className="lg:col-span-5 bg-muted border-b-4 lg:border-b-0 lg:border-r-4 border-brand p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
        <div>
          {/* Marca Mecanify */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-brand text-on-brand flex items-center justify-center shrink-0">
              <Wrench className="w-9 h-9 stroke-[2.5]" aria-hidden="true" />
            </div>
            <div>
              <span
                translate="no"
                className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink block leading-none"
              >
                Mecanify
              </span>
              <span className="text-sm sm:text-base text-info font-medium mt-1 block">
                Sistema de Pátio &amp; Gestão Automotiva
              </span>
            </div>
          </div>

          <h1 className="mt-8 lg:mt-12 text-3xl sm:text-4xl lg:text-5xl font-semibold text-ink leading-[1.08] tracking-tight">
            Controle total do pátio no celular ou na bancada.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-info leading-relaxed max-w-xl">
            Feito para o ritmo da oficina: botões grandes, leitura imediata de placas,
            controle de peças e orçamento rápido direto para o WhatsApp do cliente.
          </p>
        </div>

        {/* Blocos Grandes de Benefícios Operacionais */}
        <div className="mt-8 lg:mt-12 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3.5">
          <div className="bg-muted border-2 border-info rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand text-on-brand flex items-center justify-center shrink-0">
              <Car className="w-6 h-6 stroke-[2.2]" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold text-ink text-base">Placas &amp; Veículos</div>
              <div className="text-sm text-info">
                Consulta rápida e histórico por carro
              </div>
            </div>
          </div>

          <div className="bg-muted border-2 border-info rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-muted text-ink flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6 stroke-[2.2]" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold text-ink text-base">Ordens de Serviço</div>
              <div className="text-sm text-info">
                Peças, mão de obra e status em 1 toque
              </div>
            </div>
          </div>

          <div className="bg-muted border-2 border-info rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-success-solid text-on-brand flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold text-ink text-base">Multi-Oficina Isolado</div>
              <div className="text-sm text-info">
                Dados protegidos com confirmação por e-mail
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* COLUNA DIREITA — FORMULÁRIOS DE ACESSO, CADASTRO E RECUPERAÇÃO DE SENHA */}
      <main
        id="conteudo-principal"
        className="lg:col-span-7 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-sunken"
      >
        <div className="w-full max-w-2xl bg-surface border-2 border-line rounded-lg p-6 sm:p-10">
          {/* 1. TELA PÓS-CADASTRO: CONFIRMAÇÃO DE E-MAIL ENVIADA */}
          {confirmationSentTo ? (
            <div className="space-y-6" aria-live="polite">
              <div className="w-20 h-20 rounded-lg bg-brand text-on-brand flex items-center justify-center">
                <MailCheck className="w-11 h-11 stroke-[2.2]" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-semibold text-ink leading-tight">
                  Confirme seu e-mail para ativar sua oficina
                </h2>
                <p className="text-base sm:text-lg text-ink-muted leading-relaxed">
                  Enviamos um link de ativação para:
                </p>
                <div className="bg-surface border-2 border-brand rounded-xl px-5 py-4 font-mono text-lg sm:text-xl font-semibold text-ink break-all">
                  {confirmationSentTo}
                </div>
              </div>

              <div className="bg-surface border border-line rounded-xl p-5 space-y-2 text-ink text-base">
                <p className="font-semibold text-ink">Como ativar agora (leva 10 segundos):</p>
                <ol className="list-decimal list-inside space-y-1.5 text-ink-muted">
                  <li>Abra o aplicativo de e-mail no seu celular ou computador.</li>
                  <li>Procure pelo e-mail do Mecanify (olhe também no Spam).</li>
                  <li>Toque em <strong>Confirmar Meu E-mail</strong> para liberar seu acesso.</li>
                </ol>
              </div>

              {resendSuccess && (
                <div className="p-4 rounded-xl bg-success/15 border-2 border-success text-success flex items-center gap-3 text-base">
                  <CheckCircle2 className="w-6 h-6 text-success shrink-0" aria-hidden="true" />
                  <span>{resendSuccess}</span>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-danger/15 border-2 border-danger text-danger flex items-center gap-3 text-base">
                  <AlertTriangle className="w-6 h-6 text-danger shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  disabled={resending}
                  onClick={() => handleResendEmail(confirmationSentTo)}
                  className="min-h-[60px] px-6 py-4 rounded-xl bg-surface hover:bg-muted border-2 border-line-strong text-ink font-semibold text-base flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
                >
                  {resending ? (
                    <>
                      <progress aria-label="Reenviando" className="loading-spinner" />
                      <span>Reenviando e-mail…</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" aria-hidden="true" />
                      <span>Reenviar E-mail</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail(confirmationSentTo);
                    switchMode('login');
                  }}
                  className="min-h-[60px] px-6 py-4 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-semibold text-base flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span>Já confirmei — Entrar</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : resetEmailSentTo ? (
            /* 2. TELA PÓS-SOLICITAÇÃO DE RECUPERAÇÃO DE SENHA */
            <div className="space-y-6" aria-live="polite">
              <div className="w-20 h-20 rounded-lg bg-muted text-ink flex items-center justify-center">
                <KeyRound className="w-11 h-11 stroke-[2.2]" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-semibold text-ink leading-tight">
                  Link de recuperação enviado!
                </h2>
                <p className="text-base sm:text-lg text-ink-muted leading-relaxed">
                  Enviamos um e-mail com o botão para criar sua nova senha em:
                </p>
                <div className="bg-surface border-2 border-brand rounded-xl px-5 py-4 font-mono text-lg sm:text-xl font-semibold text-ink break-all">
                  {resetEmailSentTo}
                </div>
              </div>

              <div className="bg-surface border border-line rounded-xl p-5 space-y-2 text-ink text-base">
                <p className="font-semibold text-ink">Próximo passo:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-ink-muted">
                  <li>Abra seu e-mail e toque no botão <strong>Redefinir Minha Senha</strong>.</li>
                  <li>Você voltará automaticamente para cá para digitar a senha nova.</li>
                </ol>
              </div>

              {resendSuccess && (
                <div className="p-4 rounded-xl bg-success/15 border-2 border-success text-success flex items-center gap-3 text-base">
                  <CheckCircle2 className="w-6 h-6 text-success shrink-0" aria-hidden="true" />
                  <span>{resendSuccess}</span>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-danger/15 border-2 border-danger text-danger flex items-center gap-3 text-base">
                  <AlertTriangle className="w-6 h-6 text-danger shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  disabled={resending}
                  onClick={() => handleResendPasswordReset(resetEmailSentTo)}
                  className="min-h-[60px] px-6 py-4 rounded-xl bg-surface hover:bg-muted border-2 border-line-strong text-ink font-semibold text-base flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
                >
                  {resending ? (
                    <>
                      <progress aria-label="Reenviando" className="loading-spinner" />
                      <span>Reenviando link…</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" aria-hidden="true" />
                      <span>Reenviar Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="min-h-[60px] px-6 py-4 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-semibold text-base flex items-center justify-center gap-3 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                  <span>Voltar para o Login</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* SELETOR DE MODO GIGANTE (Exibido em Login / Cadastro) */}
              {(mode === 'login' || mode === 'cadastro') && (
                <div
                  role="tablist"
                  aria-label="Escolha entre entrar ou criar nova conta"
                  className="grid grid-cols-2 gap-3 bg-sunken p-2 rounded-xl border-2 border-line mb-8"
                >
                  <button
                    role="tab"
                    type="button"
                    aria-selected={mode === 'login'}
                    onClick={() => switchMode('login')}
                    className={`min-h-[58px] rounded-lg px-4 py-3 font-semibold text-base sm:text-lg flex items-center justify-center gap-3 cursor-pointer ${
                      mode === 'login'
                        ? 'bg-brand text-on-brand'
                        : 'bg-transparent text-ink-muted hover:bg-muted hover:text-ink'
                    }`}
                  >
                    <LogIn className="w-6 h-6 shrink-0" aria-hidden="true" />
                    <span>Entrar</span>
                  </button>

                  <button
                    role="tab"
                    type="button"
                    aria-selected={mode === 'cadastro'}
                    onClick={() => switchMode('cadastro')}
                    className={`min-h-[58px] rounded-lg px-4 py-3 font-semibold text-base sm:text-lg flex items-center justify-center gap-3 cursor-pointer ${
                      mode === 'cadastro'
                        ? 'bg-muted text-ink'
                        : 'bg-transparent text-ink-muted hover:bg-muted hover:text-ink'
                    }`}
                  >
                    <UserPlus className="w-6 h-6 shrink-0" aria-hidden="true" />
                    <span>Criar Conta</span>
                  </button>
                </div>
              )}

              {/* BOTÃO VOLTAR QUANDO ESTIVER EM RECUPERAR SENHA */}
              {mode === 'recuperar' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="mb-6 min-h-[48px] px-4 py-2.5 rounded-xl bg-sunken hover:bg-muted border-2 border-line text-ink font-semibold text-base inline-flex items-center gap-2.5 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 text-brand-ink" aria-hidden="true" />
                  <span>Voltar para o Login</span>
                </button>
              )}

              {/* CABEÇALHO DO FORMULÁRIO */}
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-semibold text-ink leading-tight">
                  {mode === 'login' && 'Acessar Painel da Oficina'}
                  {mode === 'cadastro' && 'Cadastrar Nova Oficina'}
                  {mode === 'recuperar' && 'Esqueceu sua senha?'}
                  {mode === 'nova-senha' && 'Criar Nova Senha de Acesso'}
                </h2>
                <p className="text-base text-ink-muted mt-1">
                  {mode === 'login' && 'Digite seu e-mail e senha para abrir o pátio.'}
                  {mode === 'cadastro' &&
                    'Preencha os dados abaixo. Você receberá um e-mail de confirmação para ativar a conta.'}
                  {mode === 'recuperar' &&
                    'Informe seu e-mail de acesso e enviaremos um link seguro para você criar outra senha.'}
                  {mode === 'nova-senha' &&
                    'Digite e confirme sua nova senha abaixo para entrar direto no Mecanify.'}
                </p>
              </div>

              {/* ALERTA DE ERRO OU E-MAIL NÃO CONFIRMADO */}
              <div aria-live="polite">
                {error && (
                  <div className="mb-6 p-5 rounded-xl bg-danger/15 border-2 border-danger text-danger space-y-3">
                    <div className="flex items-start gap-3.5">
                      <AlertTriangle
                        className="w-6 h-6 text-danger shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-base font-medium leading-snug">{error}</span>
                    </div>

                    {unconfirmedEmail && (
                      <button
                        type="button"
                        disabled={resending}
                        onClick={() => handleResendEmail(unconfirmedEmail)}
                        className="w-full min-h-[52px] px-4 py-3 rounded-lg bg-brand hover:bg-brand-hover text-on-brand font-semibold text-base flex items-center justify-center gap-2.5 cursor-pointer"
                      >
                        {resending ? (
                          <>
                            <progress aria-label="Reenviando" className="loading-spinner" />
                            <span>Reenviando link de confirmação…</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-5 h-5" aria-hidden="true" />
                            <span>Reenviar E-mail de Confirmação Agora</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {resendSuccess && (
                  <div className="mb-6 p-5 rounded-xl bg-success/15 border-2 border-success text-success flex items-center gap-3.5 text-base font-medium">
                    <CheckCircle2
                      className="w-6 h-6 text-success shrink-0"
                      aria-hidden="true"
                    />
                    <span>{resendSuccess}</span>
                  </div>
                )}
              </div>

              {/* FORMULÁRIO PRINCIPAL */}
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {mode === 'cadastro' && (
                  <>
                    <div>
                      <label
                        htmlFor="campo-oficina"
                        className="block text-base font-semibold text-ink mb-2"
                      >
                        Nome da Oficina
                      </label>
                      <input
                        ref={oficinaInputRef}
                        id="campo-oficina"
                        name="organization"
                        type="text"
                        autoComplete="organization"
                        required
                        value={nomeOficina}
                        onChange={(e) => setNomeOficina(e.target.value)}
                        placeholder="Ex.: Auto Centro Irmãos Silva…"
                        className="w-full min-h-[58px] px-4 py-3.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink placeholder-ink-subtle text-lg font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="campo-nome"
                          className="block text-base font-semibold text-ink mb-2"
                        >
                          Seu Nome (Responsável)
                        </label>
                        <input
                          ref={nomeInputRef}
                          id="campo-nome"
                          name="name"
                          type="text"
                          autoComplete="name"
                          required
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Ex.: Carlos Mecânico…"
                          className="w-full min-h-[58px] px-4 py-3.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink placeholder-ink-subtle text-lg font-medium"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="campo-telefone"
                          className="block text-base font-semibold text-ink mb-2"
                        >
                          WhatsApp / Celular
                        </label>
                        <input
                          id="campo-telefone"
                          name="tel"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          placeholder="Ex.: (11) 99999-0000…"
                          className="w-full min-h-[58px] px-4 py-3.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink placeholder-ink-subtle text-lg font-mono tabular-nums"
                        />
                      </div>
                    </div>
                  </>
                )}

                {mode !== 'nova-senha' && (
                  <div>
                    <label
                      htmlFor="campo-email"
                      className="block text-base font-semibold text-ink mb-2"
                    >
                      E-mail de Acesso
                    </label>
                    <input
                      ref={emailInputRef}
                      id="campo-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      autoCapitalize="none"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@oficina.com.br…"
                      className="w-full min-h-[58px] px-4 py-3.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink placeholder-ink-subtle text-lg font-medium"
                    />
                  </div>
                )}

                {mode !== 'recuperar' && (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label
                        htmlFor="campo-senha"
                        className="block text-base font-semibold text-ink"
                      >
                        {mode === 'nova-senha'
                          ? 'Nova Senha (mínimo 6 caracteres)'
                          : `Senha ${mode === 'cadastro' ? '(mínimo 6 caracteres)' : ''}`}
                      </label>

                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => switchMode('recuperar')}
                          className="min-h-[44px] px-2 text-sm sm:text-base font-semibold text-brand-ink hover:text-info underline underline-offset-4 cursor-pointer"
                        >
                          Esqueci minha senha
                        </button>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        ref={senhaInputRef}
                        id="campo-senha"
                        name="password"
                        type={mostrarSenha ? 'text' : 'password'}
                        autoComplete={
                          mode === 'login' ? 'current-password' : 'new-password'
                        }
                        required
                        minLength={6}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder={
                          mode === 'nova-senha'
                            ? 'Digite sua nova senha…'
                            : 'Digite sua senha…'
                        }
                        className="w-full min-h-[58px] pl-4 pr-16 py-3.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink placeholder-ink-subtle text-lg font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-2 min-w-[48px] min-h-[48px] rounded-lg text-ink-muted hover:text-ink hover:bg-muted flex items-center justify-center cursor-pointer"
                      >
                        {mostrarSenha ? (
                          <EyeOff className="w-6 h-6" aria-hidden="true" />
                        ) : (
                          <Eye className="w-6 h-6" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'nova-senha' && (
                  <div>
                    <label
                      htmlFor="campo-confirmar-senha"
                      className="block text-base font-semibold text-ink mb-2"
                    >
                      Repita a Nova Senha
                    </label>
                    <input
                      ref={confirmarSenhaInputRef}
                      id="campo-confirmar-senha"
                      name="confirm-password"
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Digite a mesma senha novamente…"
                      className="w-full min-h-[58px] px-4 py-3.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink placeholder-ink-subtle text-lg font-medium"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full min-h-[64px] px-6 py-4 rounded-xl font-semibold text-lg sm:text-xl flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 ${
                    mode === 'login' || mode === 'nova-senha'
                      ? 'bg-brand hover:bg-brand-hover text-on-brand'
                      : 'bg-muted hover:bg-muted text-ink'
                  }`}
                >
                  {submitting ? (
                    <>
                      <progress aria-label="Processando" className="loading-spinner" />
                      <span>
                        {mode === 'login' && 'Entrando na Oficina…'}
                        {mode === 'cadastro' && 'Criando Conta e Enviando E-mail…'}
                        {mode === 'recuperar' && 'Enviando Link de Recuperação…'}
                        {mode === 'nova-senha' && 'Salvando Nova Senha…'}
                      </span>
                    </>
                  ) : (
                    <>
                      {mode === 'login' && (
                        <>
                          <LogIn className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                          <span>Entrar no Mecanify</span>
                        </>
                      )}
                      {mode === 'cadastro' && (
                        <>
                          <UserPlus className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                          <span>Criar Conta e Receber Confirmação</span>
                        </>
                      )}
                      {mode === 'recuperar' && (
                        <>
                          <KeyRound className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                          <span>Enviar Link para Redefinir Senha</span>
                        </>
                      )}
                      {mode === 'nova-senha' && (
                        <>
                          <Lock className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                          <span>Salvar Nova Senha e Abrir Oficina</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
