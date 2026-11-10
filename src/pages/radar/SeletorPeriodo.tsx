import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button, Field } from '../../components/ui';
import { PRESETS, dataLocalISO, intervaloDoPeriodo, rotuloPeriodo, validarPersonalizado, type Periodo } from './periodo';

const ITEM = '[role="menuitemradio"]';

/**
 * "Últimos [7 dias ▾]": botão que abre um menu com 7, 14, 30 dias e Personalizado (De/Até no mesmo painel).
 * Teclado: setas/Home/End navegam, Esc fecha e devolve o foco ao botão, clique fora fecha.
 */
export function SeletorPeriodo({
  periodo,
  aoEscolher,
  className = '',
}: {
  periodo: Periodo;
  aoEscolher: (p: Periodo) => void;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [personalizando, setPersonalizando] = useState(false);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const campoDe = useRef<HTMLInputElement>(null);
  const idRotulo = useId();
  const idValor = useId();
  const hojeISO = dataLocalISO(new Date());
  const personalizado = periodo.tipo === 'custom';

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    setPersonalizando(false);
    if (devolverFoco) gatilho.current?.focus();
  };

  useEffect(() => {
    if (!aberto) return;
    if (!personalizando) raiz.current?.querySelector<HTMLElement>(`${ITEM}[aria-checked="true"]`)?.focus();
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) fechar(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    if (personalizando) campoDe.current?.focus();
  }, [personalizando]);

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && aberto) {
      e.stopPropagation();
      fechar();
      return;
    }
    if (!aberto || !(e.target as HTMLElement).matches(ITEM)) return;
    const itens = Array.from(raiz.current?.querySelectorAll<HTMLElement>(ITEM) ?? []);
    const i = itens.indexOf(document.activeElement as HTMLElement);
    let alvo = -1;
    if (e.key === 'ArrowDown') alvo = (i + 1) % itens.length;
    else if (e.key === 'ArrowUp') alvo = (i - 1 + itens.length) % itens.length;
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = itens.length - 1;
    if (alvo < 0) return;
    e.preventDefault();
    itens[alvo]?.focus();
  };

  const abrirPersonalizado = () => {
    const atual = intervaloDoPeriodo(periodo);
    setDe(atual.inicio);
    setAte(atual.fim);
    setPersonalizando(true);
  };

  const erro = de && ate ? validarPersonalizado(de, ate) : 'incompleto';
  const itemClasse =
    'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';

  return (
    <div
      ref={raiz}
      role="group"
      aria-label="Período do quadro"
      className={`relative flex items-center gap-2 ${className}`}
      onKeyDown={aoTeclar}
    >
      <span id={idRotulo} className="text-sm text-ink-muted">
        {personalizado ? 'Período' : 'Últimos'}
      </span>
      <button
        ref={gatilho}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-labelledby={`${idRotulo} ${idValor}`}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-muted px-3 text-sm font-medium tabular-nums text-ink transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-10"
      >
        <span id={idValor}>{rotuloPeriodo(periodo)}</span>
        <ChevronDown size={16} className="text-ink-muted" aria-hidden="true" />
      </button>

      {aberto && (
        <div
          data-testid="periodo-painel"
          className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface p-1.5 shadow-card ring-1 ring-line dark:bg-line dark:ring-line-strong md:left-auto md:right-0"
        >
          <div role="menu" aria-label="Período do quadro">
            {PRESETS.map((p) => {
              const marcado = periodo.tipo === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="menuitemradio"
                  aria-checked={marcado}
                  onClick={() => {
                    aoEscolher({ tipo: p });
                    fechar();
                  }}
                  className={itemClasse}
                >
                  <Check size={16} className={marcado ? 'text-brand-ink' : 'opacity-0'} aria-hidden="true" />
                  {p} dias
                </button>
              );
            })}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={personalizado}
              onClick={abrirPersonalizado}
              className={itemClasse}
            >
              <Check size={16} className={personalizado ? 'text-brand-ink' : 'opacity-0'} aria-hidden="true" />
              Personalizado
            </button>
          </div>

          {personalizando && (
            <form
              className="space-y-3 p-2 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (erro) return;
                aoEscolher({ tipo: 'custom', de, ate });
                fechar();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field rotulo="De">
                  <input
                    ref={campoDe}
                    type="date"
                    value={de}
                    max={hojeISO}
                    onChange={(e) => setDe(e.target.value)}
                  />
                </Field>
                <Field rotulo="Até">
                  <input type="date" value={ate} min={de || undefined} max={hojeISO} onChange={(e) => setAte(e.target.value)} />
                </Field>
              </div>
              {erro && erro !== 'incompleto' && (
                <p role="alert" className="text-[0.8125rem] text-danger">
                  {erro}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={!!erro}>
                Aplicar
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
