import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Chips de filtro: "Todas", "Crítico" e uma por categoria, com contagem. Celular: uma linha só, rolagem só dentro da
 * faixa (sem barra, com esmaecido na borda) e o chip ativo é trazido à vista; desktop: quebram linha.
 */
export function ChipsCategoria({
  categorias,
  rotulos,
  contagens,
  total,
  criticos,
  categoriaAtiva,
  apenasCriticos,
  aoTodas,
  aoCriticos,
  aoCategoria,
}: {
  categorias: string[];
  /** Texto de cada categoria (chave em maiúsculas), já com desambiguação. */
  rotulos: Record<string, string>;
  contagens: Record<string, number>;
  total: number;
  criticos: number;
  categoriaAtiva: string;
  apenasCriticos: boolean;
  aoTodas: () => void;
  aoCriticos: () => void;
  aoCategoria: (categoria: string) => void;
}) {
  const faixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = faixa.current;
    const ativo = el?.querySelector<HTMLElement>('[data-ativo]');
    if (!el || !ativo || el.scrollWidth <= el.clientWidth) return;
    const esq = ativo.offsetLeft - el.offsetLeft;
    const dir = esq + ativo.offsetWidth;
    if (esq < el.scrollLeft + 16) el.scrollLeft = Math.max(0, esq - 16);
    else if (dir > el.scrollLeft + el.clientWidth - 32) el.scrollLeft = dir - el.clientWidth + 32;
  }, [categoriaAtiva, apenasCriticos]);

  const chip = (chave: string, ativo: boolean, aoClicar: () => void, conteudo: ReactNode, perigo = false) => (
    <button
      key={chave}
      type="button"
      aria-pressed={ativo}
      data-ativo={ativo || undefined}
      onClick={aoClicar}
      className="group inline-flex min-h-11 shrink-0 cursor-pointer snap-start items-center rounded-full focus-visible:outline-none lg:min-h-9"
    >
      <span
        className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-brand sm:px-3.5 ${
          ativo
            ? 'bg-surface text-ink shadow-card dark:bg-line'
            : `${perigo ? 'text-danger' : 'text-ink-muted'} group-hover:bg-muted group-hover:text-ink`
        }`}
      >
        {conteudo}
      </span>
    </button>
  );

  const contar = (n: number, ativo: boolean) => (
    <span className={`tabular-nums ${ativo ? 'text-ink-muted' : 'text-ink-subtle'}`}>{n}</span>
  );

  const todasAtiva = categoriaAtiva === 'TODAS' && !apenasCriticos;
  return (
    <div
      ref={faixa}
      role="group"
      aria-label="Filtrar por categoria"
      className="-mx-4 flex snap-x scroll-px-4 gap-1 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8 lg:mx-0 lg:flex-wrap lg:gap-2 lg:overflow-visible lg:px-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
    >
      {chip('TODAS', todasAtiva, aoTodas, <>Todas {contar(total, todasAtiva)}</>)}
      {chip(
        'CRITICO',
        apenasCriticos,
        aoCriticos,
        <>
          <AlertTriangle size={14} aria-hidden="true" />
          Crítico {contar(criticos, apenasCriticos)}
        </>,
        criticos > 0,
      )}
      {categorias.map((cat) => {
        const ativo = categoriaAtiva === cat && !apenasCriticos;
        return chip(cat, ativo, () => aoCategoria(cat), <>{rotulos[cat.toUpperCase()] ?? cat} {contar(contagens[cat.toUpperCase()] ?? 0, ativo)}</>);
      })}
    </div>
  );
}
