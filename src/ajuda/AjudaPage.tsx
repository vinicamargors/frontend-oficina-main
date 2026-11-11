import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { CLASSE_CAMPO } from '../components/ui';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { Guia } from './Guia';
import { filtrarGuias } from './busca';
import { GUIAS } from './guias';
import type { Cargo } from './tipos';

const lerGuia = () => new URLSearchParams(window.location.search).get('guia');

export function AjudaPage({ cargo }: { cargo: Cargo }) {
  const [termo, setTermo] = useState('');
  const [guiaId, setGuiaId] = useState<string | null>(lerGuia);

  useEffect(() => {
    const f = () => setGuiaId(lerGuia());
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);

  const visiveis = useMemo(() => filtrarGuias(GUIAS, termo, cargo), [termo, cargo]);
  const aberto = guiaId ? GUIAS.find((g) => g.id === guiaId && g.cargos.includes(cargo)) : undefined;

  const abrir = (id: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'ajuda');
    if (id) url.searchParams.set('guia', id);
    else url.searchParams.delete('guia');
    window.history.pushState({}, '', url.toString());
    setGuiaId(id);
    window.scrollTo({ top: 0 });
  };

  if (aberto) return <Guia guia={aberto} aoVoltar={() => abrir(null)} />;

  return (
    <div>
      <PageHeader titulo="Ajuda" abaixo={<span className="hidden sm:inline">Passo a passo das tarefas do dia a dia.</span>} />
      <search className="mb-4 block">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <input
            type="search"
            name="busca_ajuda"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar um guia…"
            aria-label="Buscar um guia de ajuda"
            autoComplete="off"
            className={`${CLASSE_CAMPO} pl-9`}
          />
        </div>
      </search>
      {visiveis.length === 0 ? (
        <Panel espaco="lg">
          <p className="text-sm text-ink-muted">Nenhum guia encontrado para &ldquo;{termo}&rdquo;.</p>
        </Panel>
      ) : (
        <Panel as="ul" espaco="nenhum" aria-label="Guias" className="max-w-2xl divide-y divide-line">
          {visiveis.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => abrir(g.id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{g.titulo}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{g.resumo}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-subtle" aria-hidden="true" />
              </button>
            </li>
          ))}
        </Panel>
      )}
    </div>
  );
}
