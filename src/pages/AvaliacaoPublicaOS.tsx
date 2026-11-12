import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api, ApiError } from '../api/client';
import { AlertTriangle, CheckCircle2, Star } from 'lucide-react';
import { Button, Field, Logo, Panel } from '../components/ui';

interface AvaliacaoPublicaOSProps {
  /** Token assinado do link (`?modo=avaliar&token=...`): o servidor deriva OS, oficina, mecânico e veículo dele. */
  token: string;
}

const NOTAS = [1, 2, 3, 4, 5];

const TEXTO_DA_NOTA: Record<number, string> = {
  5: 'Excelente! Superou expectativas',
  4: 'Muito bom! Satisfeito',
  3: 'Regular',
  2: 'Abaixo do esperado',
  1: 'Insatisfeito',
};

const CLASSE_CAMPO_TEXTO =
  'w-full resize-none rounded-lg border border-line-strong bg-sunken p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

// Página pública (sem login) aberta pelo link que o cliente recebe no WhatsApp: marca, um bloco só, nada da oficina além disso.
function Casca({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-8 text-ink sm:justify-center">
      <Logo tamanho={32} className="mb-6" />
      <Panel espaco="lg" className="w-full max-w-md">
        {children}
      </Panel>
    </main>
  );
}

type Link =
  | { estado: 'carregando' }
  | { estado: 'ok'; veiculo: string }
  | { estado: 'ja-avaliada' }
  | { estado: 'erro'; msg: string; podeRepetir: boolean };

const erroDoCliente = (e: unknown): ApiError | null => (e instanceof ApiError && e.status >= 400 && e.status < 500 ? e : null);

export function AvaliacaoPublicaOS({ token }: AvaliacaoPublicaOSProps) {
  const [nota, setNota] = useState<number>(5);
  const [hoverNota, setHoverNota] = useState<number>(0);
  const [comentario, setComentario] = useState('');
  const [link, setLink] = useState<Link>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const estrelas = useRef<(HTMLButtonElement | null)[]>([]);
  const tituloObrigado = useRef<HTMLHeadingElement>(null);
  const tituloEstado = useRef<HTMLHeadingElement>(null);
  const alertaEnvio = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (enviado) tituloObrigado.current?.focus();
  }, [enviado]);

  // Troca de tela (link inválido, já avaliada) e erro de envio: o foco vai para o aviso em vez de cair no <body>
  useEffect(() => {
    if (link.estado === 'ja-avaliada' || link.estado === 'erro') tituloEstado.current?.focus();
  }, [link.estado]);
  useEffect(() => {
    if (erroEnvio) alertaEnvio.current?.focus();
  }, [erroEnvio]);

  // Confere o link antes de mostrar o formulário: adulterado/expirado ou já avaliado não deixam digitar à toa
  useEffect(() => {
    let ativo = true;
    setLink({ estado: 'carregando' });
    api
      .obterAvaliacaoPublica(token)
      .then((info) => {
        if (!ativo) return;
        setLink(
          info.ja_avaliada
            ? { estado: 'ja-avaliada' }
            : { estado: 'ok', veiculo: [info.veiculo_modelo, info.veiculo_placa].filter(Boolean).join(' · ') }
        );
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        const doLink = erroDoCliente(e);
        setLink({
          estado: 'erro',
          msg: doLink ? doLink.message : 'Não foi possível abrir esta avaliação agora. Tente de novo em instantes.',
          podeRepetir: !doLink,
        });
      });
    return () => {
      ativo = false;
    };
  }, [token, tentativa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErroEnvio(null);

    try {
      await api.salvarAvaliacaoOS({ token, nota, comentario: comentario.trim() || null });
      setEnviado(true);
    } catch (e) {
      const doCliente = erroDoCliente(e);
      if (doCliente?.status === 409) setLink({ estado: 'ja-avaliada' });
      else if (doCliente) setErroEnvio(doCliente.message);
      else setErroEnvio('Não foi possível enviar sua avaliação agora. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  // Grupo de rádio: setas movem e marcam, Home/End vão às pontas; só a nota marcada entra na ordem de Tab
  const aoTeclar = (e: KeyboardEvent<HTMLButtonElement>, estrela: number) => {
    let alvo = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') alvo = estrela === 5 ? 1 : estrela + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') alvo = estrela === 1 ? 5 : estrela - 1;
    else if (e.key === 'Home') alvo = 1;
    else if (e.key === 'End') alvo = 5;
    if (!alvo) return;
    e.preventDefault();
    setNota(alvo);
    estrelas.current[alvo - 1]?.focus();
  };

  if (enviado) {
    return (
      <Casca>
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
          <h1 ref={tituloObrigado} tabIndex={-1} className="text-[1.375rem] font-semibold text-ink focus:outline-none text-balance">
            Obrigado pela sua avaliação
          </h1>
          <p className="text-sm text-ink-muted text-pretty">
            Ela já chegou à oficina e ajuda a melhorar o atendimento e a reconhecer o trabalho dos mecânicos. Pode fechar esta página.
          </p>
        </div>
      </Casca>
    );
  }

  if (link.estado === 'carregando') {
    return (
      <Casca>
        <p role="status" className="text-center text-sm text-ink-muted">
          Abrindo sua avaliação…
        </p>
      </Casca>
    );
  }

  if (link.estado === 'ja-avaliada' || link.estado === 'erro') {
    const jaAvaliada = link.estado === 'ja-avaliada';
    return (
      <Casca>
        <div className="space-y-3 text-center">
          {jaAvaliada ? (
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-danger" aria-hidden="true" />
          )}
          <h1 ref={tituloEstado} tabIndex={-1} className="text-[1.375rem] font-semibold text-ink focus:outline-none text-balance">
            {jaAvaliada ? 'Este serviço já foi avaliado' : 'Não foi possível abrir a avaliação'}
          </h1>
          <p role={jaAvaliada ? undefined : 'alert'} className="text-sm text-ink-muted text-pretty">
            {link.estado === 'erro' ? link.msg : 'Obrigado! A oficina já recebeu a sua avaliação. Pode fechar esta página.'}
          </p>
          {link.estado === 'erro' && link.podeRepetir && (
            <Button variante="secundario" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </Button>
          )}
        </div>
      </Casca>
    );
  }

  return (
    <Casca>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-[1.375rem] font-semibold text-ink text-balance">Como foi o serviço no seu carro?</h1>
          {link.veiculo && <p className="text-sm font-medium text-ink">{link.veiculo}</p>}
          <p className="text-sm text-ink-muted text-pretty">Sua nota ajuda a oficina a reconhecer os melhores mecânicos.</p>
        </div>

        <div className="space-y-2 text-center">
          <div role="radiogroup" aria-label="Sua nota para o serviço e o atendimento" className="flex items-center justify-center gap-1">
            {NOTAS.map((estrela) => {
              const cheia = estrela <= (hoverNota || nota);
              return (
                <button
                  key={estrela}
                  ref={(el) => {
                    estrelas.current[estrela - 1] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={nota === estrela}
                  aria-label={estrela === 1 ? '1 estrela' : `${estrela} estrelas`}
                  tabIndex={nota === estrela ? 0 : -1}
                  onMouseEnter={() => setHoverNota(estrela)}
                  onMouseLeave={() => setHoverNota(0)}
                  onClick={() => setNota(estrela)}
                  onKeyDown={(e) => aoTeclar(e, estrela)}
                  className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Star
                    aria-hidden="true"
                    className={`h-8 w-8 ${cheia ? 'fill-brand text-brand-ink' : 'text-ink-muted'}`}
                  />
                </button>
              );
            })}
          </div>
          <p role="status" className="text-sm font-medium text-ink">
            {TEXTO_DA_NOTA[nota]}
          </p>
        </div>

        <div className="space-y-4">
          <Field rotulo="Comentário (opcional)">
            <textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Conte como foi o atendimento, a agilidade ou o diagnóstico do carro…"
              className={CLASSE_CAMPO_TEXTO}
            />
          </Field>
        </div>

        <div className="space-y-3">
          {erroEnvio && (
            <p ref={alertaEnvio} tabIndex={-1} role="alert" className="flex items-start gap-2 text-sm font-medium text-danger focus:outline-none">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{erroEnvio}</span>
            </p>
          )}
          <Button type="submit" carregando={enviando} className="w-full">
            {enviando ? 'Enviando…' : erroEnvio ? 'Tentar novamente' : 'Enviar avaliação'}
          </Button>
        </div>
      </form>
    </Casca>
  );
}
