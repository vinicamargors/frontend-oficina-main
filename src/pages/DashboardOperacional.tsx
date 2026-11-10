import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { DashboardOperacional as DashboardData, StatusOS, UltimaOS } from '../types';
import { AlertOctagon, CircleAlert, CircleCheck, MessageCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button, PageHeader, Panel, PlateChip, Skeleton, StatusBadge, STATUS_OS } from '../components/ui';
import { diasDesde, nivelAtraso } from './radar/diasNaEtapa';

interface DashboardProps {
  empresaId: string;
  onNavigateTab: (tab: string, statusFilter?: StatusOS, osId?: string) => void;
}

const formatBRL = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);

// Etapas que viram coluna do quadro. "Pago / entregue" sai do pátio e fica só como contagem.
const ETAPAS: StatusOS[] = ['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO', 'FINALIZADO'];

const textoDias = (dias: number) =>
  dias === 0 ? 'aberta hoje' : `aberta há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;

function MarcaAtraso({ nivel }: { nivel: 'atencao' | 'atrasado' }) {
  const atrasado = nivel === 'atrasado';
  const Icone = atrasado ? CircleAlert : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        atrasado ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'
      }`}
    >
      <Icone size={12} aria-hidden="true" />
      {atrasado ? 'Atrasado' : 'Atenção'}
    </span>
  );
}

function CardOS({ os, onAbrir }: { os: UltimaOS; onAbrir: () => void }) {
  const st = (os.status as StatusOS) || 'ORCAMENTO';
  const placa = os.veiculos?.placa || 'SEM-PLACA';
  const modelo = os.veiculos?.modelo || 'Veículo';
  const clienteNome = os.clientes?.nome || 'Cliente';
  const foneLimpo = (os.clientes?.telefone || '').replace(/\D/g, '');
  const dias = diasDesde(os.data_abertura);
  const nivel = nivelAtraso(st, dias);

  return (
    <li className="relative">
      <Panel espaco="nenhum">
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Abrir ordem de serviço de ${placa}, ${modelo}, ${clienteNome}`}
          className="block w-full cursor-pointer rounded-2xl p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="flex flex-wrap items-center justify-between gap-2">
            <PlateChip placa={placa} />
            {nivel !== 'ok' && <MarcaAtraso nivel={nivel} />}
          </span>
          <span className="mt-3 block truncate text-sm font-medium text-ink">{modelo}</span>
          <span className="block truncate text-sm text-ink-muted">{clienteNome}</span>
          <span className="mt-3 block pr-11">
            <span className="block text-base font-semibold tabular-nums text-ink">{formatBRL(os.total_geral)}</span>
            <span className="block text-xs text-ink-muted">{textoDias(dias)}</span>
          </span>
        </button>
        {foneLimpo && (
          <a
            href={`https://wa.me/55${foneLimpo}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Conversar no WhatsApp com ${clienteNome}`}
            title="WhatsApp"
            className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <MessageCircle size={20} strokeWidth={1.5} aria-hidden="true" />
          </a>
        )}
      </Panel>
    </li>
  );
}

function Numero({
  rotulo,
  valor,
  destaque = false,
  onClick,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 cursor-pointer rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="block text-sm text-ink-muted">{rotulo}</span>
      <span
        className={`block text-3xl font-semibold tabular-nums ${destaque ? 'text-danger' : 'text-ink'}`}
      >
        {valor}
      </span>
    </button>
  );
}

export function DashboardOperacional({ empresaId, onNavigateTab }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarRadar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboardOperacional(empresaId);
      setData(res);
    } catch (err: unknown) {
      const customErr = err as Error;
      setError(
        customErr.message ||
          'Não foi possível carregar o Radar do Pátio. O servidor pode estar iniciando.'
      );
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarRadar();
  }, [carregarRadar]);

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Carregando Radar do Pátio">
        <PageHeader titulo="Radar do Pátio" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Panel key={n} className="h-56">
              <Skeleton linhas={3} />
            </Panel>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader titulo="Radar do Pátio" />
        <Panel espaco="lg" className="space-y-5">
          <div className="flex items-start gap-4">
            <AlertOctagon className="mt-1 h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Falha ao comunicar com o servidor da oficina
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
            </div>
          </div>
          <Button onClick={carregarRadar} icone={RefreshCw}>
            Tentar novamente
          </Button>
        </Panel>
      </div>
    );
  }

  const counts = data?.status_counts || {};
  const orcamentos = counts.ORCAMENTO || 0;
  const veiculosNoPatio =
    (counts.AGUARDANDO_PECA || 0) + (counts.EXECUCAO || 0) + (counts.FINALIZADO || 0);
  const concluidas = counts.PAGO || 0;
  const criticosCount = data?.estoque_critico_count || 0;
  const ordens = data?.ultimas_os || [];
  const itensCriticos = data?.itens_criticos || [];
  const patioVazio = ETAPAS.every((st) => (counts[st] || 0) === 0) && ordens.every((o) => o.status === 'PAGO');

  const novaOS = () => onNavigateTab('os', undefined, 'NOVA_OS');

  return (
    <div>
      <PageHeader
        titulo="Radar do Pátio"
        acoes={
          <>
            <Button variante="fantasma" icone={RefreshCw} onClick={carregarRadar}>
              Atualizar
            </Button>
            {!patioVazio && <Button onClick={novaOS}>Nova ordem de serviço</Button>}
          </>
        }
      />

      <div role="group" aria-label="Resumo do pátio" className="mb-8 grid grid-cols-3 gap-1 md:flex md:gap-8">
        <Numero rotulo="Veículos no pátio" valor={veiculosNoPatio} onClick={() => onNavigateTab('os')} />
        <Numero rotulo="Orçamentos abertos" valor={orcamentos} onClick={() => onNavigateTab('os', 'ORCAMENTO')} />
        <Numero
          rotulo="Estoque crítico"
          valor={criticosCount}
          destaque={criticosCount > 0}
          onClick={() => onNavigateTab('estoque')}
        />
      </div>

      {patioVazio ? (
        <Panel espaco="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Nenhum veículo no pátio</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Abra uma ordem de serviço e o veículo aparece aqui, na etapa em que estiver.
            </p>
          </div>
          <Button onClick={novaOS}>Nova ordem de serviço</Button>
        </Panel>
      ) : (
        <div
          data-testid="quadro-patio"
          className="-mx-4 flex scroll-px-4 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:scroll-px-0 md:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible"
        >
          {ETAPAS.map((st) => {
            const rotulo = STATUS_OS[st].rotulo;
            const cards = ordens.filter((o) => o.status === st);
            const total = counts[st] ?? cards.length;
            return (
              <section
                key={st}
                aria-label={rotulo}
                className="w-[78vw] max-w-[320px] shrink-0 snap-start md:w-[300px] lg:w-auto lg:max-w-none lg:min-w-0"
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <StatusBadge status={st} />
                  <span className="text-sm font-medium tabular-nums text-ink-muted">{total}</span>
                </div>
                {cards.length === 0 ? (
                  <p className="px-1 text-sm text-ink-muted">Nenhum veículo</p>
                ) : (
                  <ul className="space-y-3">
                    {cards.map((os) => (
                      <CardOS key={os.id} os={os} onAbrir={() => onNavigateTab('os', undefined, os.id)} />
                    ))}
                  </ul>
                )}
                {total > cards.length && (
                  <Button variante="fantasma" tamanho="sm" className="mt-2" onClick={() => onNavigateTab('os', st)}>
                    Ver todas ({total})
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {concluidas > 0 && (
        <p className="mt-4">
          <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('os', 'PAGO')}>
            {concluidas} {concluidas === 1 ? 'ordem paga e entregue' : 'ordens pagas e entregues'} nos últimos 30 dias
          </Button>
        </p>
      )}

      <section aria-label="Reposição de peças" className="mt-8">
        {itensCriticos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <CircleCheck size={16} className="text-success" aria-hidden="true" />
            Estoque em dia
          </p>
        ) : (
          <Panel espaco="lg">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">Reposição de peças</h2>
              <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('estoque')}>
                Abrir estoque
              </Button>
            </div>
            <ul>
              {itensCriticos.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{item.nome}</div>
                    <div className="text-xs text-ink-muted">
                      {item.categoria} (mín. {item.minimo_alerta})
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-danger">
                    {item.quantidade} un.
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
    </div>
  );
}
