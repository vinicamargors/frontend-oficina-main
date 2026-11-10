import { Loader2, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: 'sm' | 'md';
  icone?: LucideIcon;
  carregando?: boolean;
};

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover',
  secundario: 'bg-muted text-ink hover:bg-line active:bg-line',
  fantasma: 'bg-transparent text-ink-muted hover:bg-muted hover:text-ink active:bg-line',
  perigo: 'bg-danger-solid text-on-solid hover:opacity-90 active:opacity-80',
};

const TAMANHOS = { sm: 'h-8 min-h-11 md:min-h-8 px-3 text-[0.8125rem]', md: 'h-10 min-h-11 md:min-h-10 px-4 text-sm' };

export function Button({
  variante = 'primario',
  tamanho = 'md',
  icone: Icone,
  carregando = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...resto
}: ButtonProps) {
  return (
    <button
      type={type}
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 ${TAMANHOS[tamanho]} ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : Icone ? <Icone size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
