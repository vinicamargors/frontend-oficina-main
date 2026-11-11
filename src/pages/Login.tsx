import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
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
  LogIn,
  Car,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import { Button, Field, Logo, Tabs, ThemeToggle } from "../components/ui";
import { CLASSE_CAMPO } from "../components/ui/campo";

type AuthMode = "login" | "cadastro" | "recuperar" | "nova-senha";
type CampoErro = "oficina" | "nome" | "email" | "senha" | "confirmar";

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
    const m = params.get("modo");
    if (
      isPasswordRecovery ||
      m === "nova-senha" ||
      params.get("type") === "recovery" ||
      window.location.hash.includes("type=recovery")
    ) {
      return "nova-senha";
    }
    if (m === "cadastro") return "cadastro";
    if (m === "recuperar") return "recuperar";
    return "login";
  });

  // Sincroniza automaticamente se o evento PASSWORD_RECOVERY disparar
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode("nova-senha");
    }
  }, [isPasswordRecovery]);

  // Campos do formulário
  const [nomeOficina, setNomeOficina] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Estados de feedback
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<{
    campo: CampoErro;
    msg: string;
  } | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(
    null,
  );
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
    url.searchParams.set("modo", mode);
    window.history.replaceState({}, "", url.toString());

    const titles: Record<AuthMode, string> = {
      login: "Entrar — Mecanify",
      cadastro: "Criar Conta da Oficina — Mecanify",
      recuperar: "Recuperar Senha — Mecanify",
      "nova-senha": "Definir Nova Senha — Mecanify",
    };
    document.title = titles[mode];
    return () => {
      document.title = "Mecanify — Gestão de Oficina"; // ao sair do login, volta o título do app
    };
  }, [mode]);

  const switchMode = (newMode: AuthMode) => {
    if (mode === "nova-senha" && newMode !== "nova-senha") {
      clearPasswordRecovery();
    }
    setMode(newMode);
    setError(null);
    setErroCampo(null);
    setResendSuccess(null);
    setUnconfirmedEmail(null);
    setConfirmationSentTo(null);
    setResetEmailSentTo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErroCampo(null);
    setResendSuccess(null);
    setUnconfirmedEmail(null);

    const trimmedEmail = email.trim();
    const trimmedSenha = senha.trim();
    const trimmedConfirmar = confirmarSenha.trim();

    // Fluxo 1: Recuperar Senha (pede apenas e-mail)
    if (mode === "recuperar") {
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setErroCampo({
          campo: "email",
          msg: "Digite o e-mail da sua conta para enviarmos o link de recuperação.",
        });
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
          customErr.message ||
            "Não foi possível enviar o link de recuperação agora.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Fluxo 2: Definir Nova Senha (após clicar no link do e-mail)
    if (mode === "nova-senha") {
      if (trimmedSenha.length < 6) {
        setErroCampo({
          campo: "senha",
          msg: "A nova senha precisa ter pelo menos 6 caracteres.",
        });
        senhaInputRef.current?.focus();
        return;
      }
      if (trimmedSenha !== trimmedConfirmar) {
        setErroCampo({
          campo: "confirmar",
          msg: "As duas senhas digitadas não conferem. Digite novamente.",
        });
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
            'Link expirado ou inválido. Solicite um novo link em "Esqueci minha senha".',
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Fluxo 3: Criar Conta ou Login
    if (mode === "cadastro") {
      if (!nomeOficina.trim()) {
        setErroCampo({
          campo: "oficina",
          msg: "Informe o nome da sua oficina para configurar o painel.",
        });
        oficinaInputRef.current?.focus();
        return;
      }
      if (!nome.trim()) {
        setErroCampo({
          campo: "nome",
          msg: "Informe seu nome para identificação nas Ordens de Serviço.",
        });
        nomeInputRef.current?.focus();
        return;
      }
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setErroCampo({
        campo: "email",
        msg: "Digite um endereço de e-mail válido (ex.: oficina@email.com).",
      });
      emailInputRef.current?.focus();
      return;
    }

    if (trimmedSenha.length < 6) {
      setErroCampo({
        campo: "senha",
        msg: "A senha precisa ter pelo menos 6 caracteres.",
      });
      senhaInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
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
          "Não foi possível concluir o acesso. Verifique sua conexão e tente novamente.",
      );
      if (customErr.code === "EMAIL_NOT_CONFIRMED") {
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
        `Novo link de confirmação enviado para ${targetEmail}. Verifique também a caixa de Spam.`,
      );
    } catch (err: unknown) {
      const customErr = err as Error;
      setError(
        customErr.message || "Falha ao reenviar o e-mail de confirmação.",
      );
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
        `Enviamos um novo link de redefinição de senha para ${targetEmail}.`,
      );
    } catch (err: unknown) {
      const customErr = err as Error;
      setError(
        customErr.message || "Aguarde 1 minuto antes de solicitar outro link.",
      );
    } finally {
      setResending(false);
    }
  };

  const tituloModo: Record<AuthMode, string> = {
    login: "Acessar painel da oficina",
    cadastro: "Cadastrar nova oficina",
    recuperar: "Recuperar senha",
    "nova-senha": "Criar nova senha",
  };
  const subtituloModo: Record<AuthMode, string> = {
    login: "Digite seu e-mail e senha para abrir o pátio.",
    cadastro: "Você receberá um e-mail de confirmação para ativar a conta.",
    recuperar:
      "Informe seu e-mail de acesso e enviaremos um link seguro para criar outra senha.",
    "nova-senha":
      "Digite e confirme a nova senha para entrar direto no Mecanify.",
  };
  const classeInput = `${CLASSE_CAMPO} h-12 md:h-12 md:min-h-12 text-base`;
  const erroDe = (c: CampoErro) =>
    erroCampo?.campo === c ? erroCampo.msg : undefined;

  const avisoErro = (children: React.ReactNode) => (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl bg-danger/15 p-4 text-sm font-medium text-danger"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
  const avisoSucesso = (texto: string) => (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl bg-success/15 p-4 text-sm font-medium text-success"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );

  const beneficios = [
    {
      Icone: Car,
      texto: "Placas e histórico de cada veículo, em uma consulta.",
    },
    {
      Icone: ClipboardCheck,
      texto: "Ordens de serviço com peças, mão de obra e status em um toque.",
    },
    {
      Icone: ShieldCheck,
      texto: "Dados de cada oficina isolados e protegidos.",
    },
  ];

  return (
    <div className="min-h-dvh w-full bg-canvas text-ink lg:grid lg:grid-cols-2">
      {/* Apresentação: só em telas largas */}
      <aside className="hidden lg:flex flex-col justify-center gap-10 px-16 xl:px-24 py-16">
        <Logo tamanho={56} legenda />
        <p className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-tight text-balance">
          Controle total do pátio no celular ou na bancada.
        </p>
        <ul className="flex max-w-lg flex-col gap-4">
          {beneficios.map(({ Icone, texto }) => (
            <li
              key={texto}
              className="flex items-start gap-3 text-base text-ink-muted"
            >
              <Icone
                className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink"
                aria-hidden="true"
              />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main
        id="conteudo-principal"
        className="relative flex min-h-dvh flex-col px-4 pb-8 pt-3 sm:px-8 lg:min-h-0 lg:justify-center lg:px-12"
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between pb-4 lg:hidden">
          <Logo tamanho={32} legenda />
          <ThemeToggle />
        </div>
        <div className="hidden lg:absolute lg:right-6 lg:top-6 lg:block">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8">
          {confirmationSentTo ? (
            <div className="flex flex-col gap-5" aria-live="polite">
              <MailCheck
                className="h-10 w-10 text-brand-ink"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold leading-tight text-balance">
                  Confirme seu e-mail para ativar sua oficina
                </h1>
                <p className="text-base text-ink-muted text-pretty">
                  Enviamos um link de ativação para:
                </p>
                <p className="break-all rounded-xl bg-muted px-4 py-3 font-mono text-base font-semibold">
                  {confirmationSentTo}
                </p>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-ink-muted">
                <li>Abra o aplicativo de e-mail no celular ou computador.</li>
                <li>Procure o e-mail do Mecanify (olhe também no Spam).</li>
                <li>
                  Toque em{" "}
                  <strong className="text-ink">Confirmar Meu E-mail</strong>.
                </li>
              </ol>
              {resendSuccess && avisoSucesso(resendSuccess)}
              {error && avisoErro(error)}
              <div className="flex flex-col gap-3">
                <Button
                  className="h-12 w-full text-base"
                  icone={ArrowRight}
                  onClick={() => {
                    setEmail(confirmationSentTo);
                    switchMode("login");
                  }}
                >
                  Já confirmei, entrar
                </Button>
                <Button
                  variante="secundario"
                  className="h-12 w-full text-base"
                  icone={RefreshCw}
                  carregando={resending}
                  onClick={() => handleResendEmail(confirmationSentTo)}
                >
                  {resending ? "Reenviando e-mail…" : "Reenviar e-mail"}
                </Button>
              </div>
            </div>
          ) : resetEmailSentTo ? (
            <div className="flex flex-col gap-5" aria-live="polite">
              <KeyRound
                className="h-10 w-10 text-brand-ink"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold leading-tight text-balance">
                  Link de recuperação enviado
                </h1>
                <p className="text-base text-ink-muted text-pretty">
                  Enviamos um e-mail para criar sua nova senha em:
                </p>
                <p className="break-all rounded-xl bg-muted px-4 py-3 font-mono text-base font-semibold">
                  {resetEmailSentTo}
                </p>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-ink-muted">
                <li>
                  Abra seu e-mail e toque em{" "}
                  <strong className="text-ink">Redefinir Minha Senha</strong>.
                </li>
                <li>Você volta para cá para digitar a senha nova.</li>
              </ol>
              {resendSuccess && avisoSucesso(resendSuccess)}
              {error && avisoErro(error)}
              <div className="flex flex-col gap-3">
                <Button
                  className="h-12 w-full text-base"
                  icone={ArrowLeft}
                  onClick={() => switchMode("login")}
                >
                  Voltar para o login
                </Button>
                <Button
                  variante="secundario"
                  className="h-12 w-full text-base"
                  icone={RefreshCw}
                  carregando={resending}
                  onClick={() => handleResendPasswordReset(resetEmailSentTo)}
                >
                  {resending ? "Reenviando link…" : "Reenviar link"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {(mode === "login" || mode === "cadastro") && (
                <div className="self-start max-w-full">
                  <Tabs
                    rotuloGrupo="Escolha entre entrar ou criar nova conta"
                    ativo={mode}
                    aoMudar={(id) => switchMode(id as AuthMode)}
                    itens={[
                      { id: "login", rotulo: "Entrar", icone: LogIn },
                      {
                        id: "cadastro",
                        rotulo: "Criar conta",
                        icone: UserPlus,
                      },
                    ]}
                  />
                </div>
              )}

              {mode === "recuperar" && (
                <Button
                  variante="fantasma"
                  tamanho="sm"
                  icone={ArrowLeft}
                  className="-ml-3 self-start"
                  onClick={() => switchMode("login")}
                >
                  Voltar para o login
                </Button>
              )}

              <div className="space-y-1">
                <h1 className="text-2xl font-semibold leading-tight tracking-tight text-balance">
                  {tituloModo[mode]}
                </h1>
                {mode !== "login" && (
                  <p className="text-sm text-ink-muted">
                    {subtituloModo[mode]}
                  </p>
                )}
              </div>

              {error && (
                <div aria-live="polite" className="space-y-3">
                  {avisoErro(error)}
                  {unconfirmedEmail && (
                    <Button
                      variante="secundario"
                      className="w-full"
                      icone={RefreshCw}
                      carregando={resending}
                      onClick={() => handleResendEmail(unconfirmedEmail)}
                    >
                      {resending
                        ? "Reenviando link…"
                        : "Reenviar e-mail de confirmação"}
                    </Button>
                  )}
                </div>
              )}
              {resendSuccess && avisoSucesso(resendSuccess)}

              <form
                onSubmit={handleSubmit}
                noValidate
                className="flex flex-col gap-4"
              >
                {mode === "cadastro" && (
                  <>
                    <Field rotulo="Nome da oficina" erro={erroDe("oficina")} anunciar>
                      <input
                        ref={oficinaInputRef}
                        name="organization"
                        type="text"
                        autoComplete="organization"
                        required
                        value={nomeOficina}
                        onChange={(e) => setNomeOficina(e.target.value)}
                        placeholder="Ex.: Auto Centro Irmãos Silva"
                        className={classeInput}
                      />
                    </Field>
                    <Field rotulo="Seu nome" erro={erroDe("nome")} anunciar>
                      <input
                        ref={nomeInputRef}
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Ex.: Carlos Mecânico"
                        className={classeInput}
                      />
                    </Field>
                    <Field rotulo="WhatsApp ou celular">
                      <input
                        name="tel"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        placeholder="(11) 99999-0000"
                        className={`${classeInput} tabular-nums`}
                      />
                    </Field>
                  </>
                )}

                {mode !== "nova-senha" && (
                  <Field rotulo="E-mail" erro={erroDe("email")} anunciar>
                    <input
                      ref={emailInputRef}
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      autoCapitalize="none"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@oficina.com.br"
                      className={classeInput}
                    />
                  </Field>
                )}

                {mode !== "recuperar" && (
                  <Field
                    rotulo={mode === "nova-senha" ? "Nova senha" : "Senha"}
                    dica={
                      mode !== "login" ? "Mínimo de 6 caracteres." : undefined
                    }
                    erro={erroDe("senha")}
                    anunciar
                    adorno={
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        aria-label={
                          mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                        }
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        {mostrarSenha ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    }
                  >
                    <input
                      ref={senhaInputRef}
                      name="password"
                      type={mostrarSenha ? "text" : "password"}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                      minLength={6}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder={
                        mode === "nova-senha"
                          ? "Digite a nova senha"
                          : "Digite sua senha"
                      }
                      className={`${classeInput} pr-12`}
                    />
                  </Field>
                )}

                {mode === "nova-senha" && (
                  <Field
                    rotulo="Repita a nova senha"
                    erro={erroDe("confirmar")}
                    anunciar
                  >
                    <input
                      ref={confirmarSenhaInputRef}
                      name="confirm-password"
                      type={mostrarSenha ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Digite a mesma senha novamente"
                      className={classeInput}
                    />
                  </Field>
                )}

                <Button
                  type="submit"
                  className="mt-1 h-12 w-full text-base"
                  carregando={submitting}
                >
                  {submitting
                    ? mode === "login"
                      ? "Entrando…"
                      : mode === "cadastro"
                        ? "Criando conta…"
                        : mode === "recuperar"
                          ? "Enviando link…"
                          : "Salvando senha…"
                    : mode === "login"
                      ? "Entrar no Mecanify"
                      : mode === "cadastro"
                        ? "Criar conta"
                        : mode === "recuperar"
                          ? "Enviar link de recuperação"
                          : "Salvar nova senha"}
                </Button>

                {mode === "login" && (
                  <Button
                    variante="fantasma"
                    className="w-full"
                    onClick={() => switchMode("recuperar")}
                  >
                    Esqueci minha senha
                  </Button>
                )}
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
