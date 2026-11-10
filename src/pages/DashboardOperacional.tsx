import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { ItemCritico, StatusOS, UltimaOS } from '../types';
import { AlertOctagon, CircleCheck, MessageCircle, RefreshCw } from 'lucide-react';
import { Button, PageHeader, Panel, PlateChip, Skeleton, StatusBadge, STATUS_OS } from '../components/ui';
import { diasDesde, nivelAtraso, textoDias } from './radar/diasNaEtapa';
import { MarcaAtraso } from '../components/MarcaAtraso';
import { SeletorPeriodo } from './radar/SeletorPeriodo';
import { diaAnterior, intervaloDoPeriodo, lerPresetSalvo, salvarPreset, type Periodo } from './radar/periodo';

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
// Etapas em aberto: ordens antigas nelas ficam fora do período e merecem um aviso.
const ABERTAS: StatusOS[] = ['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO'];
// Quantos cards cada etapa desenha; o total exato vem da contagem da API.
const LIMITE_POR_ETAPA = 20;

interface Etapa {
  items: UltimaOS[];
  total: number;
}

interface Quadro {
  etapas: Record<StatusOS, Etapa>;
  pagas: number;
  /** Ordens abertas com `data_abertura` anterior ao início do período. */
  antigas: { total: number; status?: StatusOS };
  itensCriticos: ItemCritico[];
  criticosCount: number;
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

function LinhaOS({ os, onAbrir }: { os: UltimaOS; onAbrir: () => void }) {
  const st = (os.status as StatusOS) || 'ORCAMENTO';
  const placa = os.veiculos?.placa || 'SEM-PLACA';
  const modelo = os.veiculos?.modelo || 'Veículo';
  const clienteNome = os.clientes?.nome || 'Cliente';
  const foneLimpo = (os.clientes?.telefone || '').replace(/\D/g, '');
  const dias = diasDesde(os.data_abertura);
  const nivel = nivelAtraso(st, dias);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onAbrir}
        className={`flex min-h-16 w-full cursor-pointer items-center gap-3 py-2.5 pl-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
          foneLimpo ? 'pr-14' : 'pr-4'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <PlateChip placa={placa} />
            <span className="truncate text-sm font-medium text-ink">{modelo}</span>
          </span>
          <span className="mt-1 flex gap-1 text-xs text-ink-muted">
            <span className="truncate">{clienteNome}</span>
            <span className="shrink-0">· {textoDias(dias)}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-ink">{formatBRL(os.total_geral)}</span>
          {nivel !== 'ok' && <MarcaAtraso nivel={nivel} />}
        </span>
      </button>
      {foneLimpo && (
        <a
          href={`https://wa.me/55${foneLimpo}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Conversar no WhatsApp com ${clienteNome}`}
          title="WhatsApp"
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <MessageCircle size={20} strokeWidth={1.5} aria-hidden="true" />
        </a>
      )}
    </li>
  );
}

function EtapaQuadro({
  st,
  etapa,
  onNavigateTab,
  compacto = false,
}: {
  st: StatusOS;
  etapa: Etapa;
  onNavigateTab: DashboardProps['onNavigateTab'];
  compacto?: boolean;
}) {
  const rotulo = STATUS_OS[st].rotulo;
  const cards = etapa.items;
  const total = Math.max(etapa.total, cards.length);
  const abrir = (id: string) => onNavigateTab('os', undefined, id);

  return (
    <section aria-label={rotulo} className="min-w-0">
      <div className={`flex items-center justify-between gap-2 px-1 ${total === 0 && compacto ? '' : 'mb-3'}`}>
        <StatusBadge status={st} />
        <span data-testid="contagem-etapa" className="text-sm font-medium tabular-nums text-ink-muted">
          {total === 0 && compacto ? 'Nenhum veículo' : total}
        </span>
      </div>
      {total === 0 ? (
        !compacto && <p className="px-1 text-sm text-ink-muted">Nenhum veículo</p>
      ) : (
        <>
          {cards.length > 0 &&
            (compacto ? (
              <Panel espaco="nenhum" className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {cards.map((os) => (
                    <LinhaOS key={os.id} os={os} onAbrir={() => abrir(os.id)} />
                  ))}
                </ul>
              </Panel>
            ) : (
              <ul className="space-y-3">
                {cards.map((os) => (
                  <CardOS key={os.id} os={os} onAbrir={() => abrir(os.id)} />
                ))}
              </ul>
            ))}
          {total > cards.length && (
            <div className="mt-2">
              {cards.length > 0 && (
                <p className="px-3 text-xs text-ink-muted">
                  {cards.length === 1 ? 'Mostrando a mais recente' : `Mostrando as ${cards.length} mais recentes`}
                </p>
              )}
              <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('os', st)}>
                {cards.length === 0
                  ? `${total} ${total === 1 ? 'veículo' : 'veículos'}, ver todas`
                  : `Ver todas (${total})`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
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
  const [periodo, setPeriodo] = useState<Periodo>(() => ({ tipo: lerPresetSalvo() }));
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seqRadar = useRef(0);

  const carregarRadar = useCallback(async () => {
    if (!empresaId) return;
    const minha = ++seqRadar.current;
    setLoading(true);
    setError(null);
    try {
      const { inicio, fim } = intervaloDoPeriodo(periodo);
      const doPeriodo = { empresaId, dataInicio: inicio, dataFim: fim, ordenacao: 'data_desc' as const };
      // Contagens de ordens abertas anteriores ao período: falha aqui só esconde o aviso, não derruba o quadro.
      const antesDoPeriodo = { empresaId, dataFim: diaAnterior(inicio), limit: 1 };
      const [dash, pagas, ...resto] = await Promise.all([
        api.getDashboardOperacional(empresaId),
        api.listarOS({ ...doPeriodo, status: 'PAGO', limit: 1 }),
        ...ETAPAS.map((status) => api.listarOS({ ...doPeriodo, status, limit: LIMITE_POR_ETAPA })),
        ...ABERTAS.map((status) => api.listarOS({ ...antesDoPeriodo, status }).catch(() => null)),
      ]);
      if (minha !== seqRadar.current) return;
      const respostasEtapas = resto.slice(0, ETAPAS.length);
      const respostasAntigas = resto.slice(ETAPAS.length);
      const etapas = { PAGO: { items: [], total: 0 } } as unknown as Record<StatusOS, Etapa>;
      ETAPAS.forEach((st, i) => {
        etapas[st] = { items: respostasEtapas[i]?.items ?? [], total: respostasEtapas[i]?.total ?? 0 };
      });
      const comAntigas = ABERTAS.filter((_, i) => (respostasAntigas[i]?.total ?? 0) > 0);
      setQuadro({
        etapas,
        pagas: pagas.total ?? 0,
        antigas: {
          total: ABERTAS.reduce((soma, _, i) => soma + (respostasAntigas[i]?.total ?? 0), 0),
          status: comAntigas.length === 1 ? comAntigas[0] : undefined,
        },
        itensCriticos: dash.itens_criticos || [],
        criticosCount: dash.estoque_critico_count || 0,
      });
    } catch (err: unknown) {
      if (minha !== seqRadar.current) return;
      const customErr = err as Error;
      setError(
        customErr.message ||
          'Não foi possível carregar o Radar do Pátio. O servidor pode estar iniciando.'
      );
    } finally {
      if (minha === seqRadar.current) setLoading(false);
    }
  }, [empresaId, periodo]);

  useEffect(() => {
    carregarRadar();
  }, [carregarRadar]);

  const escolherPeriodo = (p: Periodo) => {
    if (p.tipo !== 'custom') salvarPreset(p.tipo);
    setPeriodo(p);
  };

  const patioVazio = !!quadro && ETAPAS.every((st) => quadro.etapas[st].total === 0);
  const novaOS = () => onNavigateTab('os', undefined, 'NOVA_OS');

  const cabecalho = (
    <PageHeader
      titulo="Radar do Pátio"
      acoes={
        <>
          <SeletorPeriodo periodo={periodo} aoEscolher={escolherPeriodo} className="basis-full md:basis-auto" />
          <Button variante="fantasma" icone={RefreshCw} onClick={carregarRadar}>
            Atualizar
          </Button>
          {quadro && !patioVazio && !error && <Button onClick={novaOS}>Nova ordem de serviço</Button>}
        </>
      }
    />
  );

  if (error) {
    return (
      <div>
        {cabecalho}
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

  if (!quadro) {
    return (
      <div aria-busy="true" aria-label="Carregando Radar do Pátio">
        {cabecalho}
        <div data-testid="radar-conteudo" aria-busy="true" className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Panel key={n} className="h-56">
              <Skeleton linhas={3} />
            </Panel>
          ))}
        </div>
      </div>
    );
  }

  const veiculosNoPatio =
    quadro.etapas.AGUARDANDO_PECA.total + quadro.etapas.EXECUCAO.total + quadro.etapas.FINALIZADO.total;
  const orcamentos = quadro.etapas.ORCAMENTO.total;
  const { antigas, pagas, itensCriticos, criticosCount } = quadro;

  return (
    <div>
      {cabecalho}

      {/* Durante a troca de período o quadro anterior fica na tela, esmaecido, em vez de piscar vazio */}
      <div
        data-testid="radar-conteudo"
        aria-busy={loading}
        className={`transition-opacity ${loading ? 'pointer-events-none opacity-60' : ''}`}
      >
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
          <>
            {/* Desktop: quadro em 4 colunas com cards */}
            <div data-testid="quadro-patio" className="hidden gap-4 lg:grid lg:grid-cols-4">
              {ETAPAS.map((st) => (
                <EtapaQuadro key={st} st={st} etapa={quadro.etapas[st]} onNavigateTab={onNavigateTab} />
              ))}
            </div>
            {/* Celular e tablet: todas as etapas empilhadas, linhas compactas, sem rolagem lateral */}
            <div data-testid="patio-lista" className="space-y-6 lg:hidden">
              {ETAPAS.map((st) => (
                <EtapaQuadro key={st} st={st} etapa={quadro.etapas[st]} onNavigateTab={onNavigateTab} compacto />
              ))}
            </div>
          </>
        )}

        {antigas.total > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-x-1 text-sm text-ink-muted">
            <span>
              {antigas.total === 1
                ? '1 ordem aberta mais antiga fica fora do período'
                : `${antigas.total} ordens abertas mais antigas ficam fora do período`}
            </span>
            <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('os', antigas.status)}>
              Ver
            </Button>
          </p>
        )}

        {pagas > 0 && (
          <p className="mt-2">
            <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('os', 'PAGO')}>
              {pagas} {pagas === 1 ? 'ordem paga e entregue' : 'ordens pagas e entregues'} no período
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
    </div>
  );
}
