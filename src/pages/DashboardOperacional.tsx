import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { DashboardOperacional as DashboardData, StatusOS } from '../types';
import {
  Wrench,
  Clock,
  PackageCheck,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  MessageCircle,
  Car,
  ClipboardList,
  DollarSign,
  Package,
  PlusCircle,
} from 'lucide-react';

interface DashboardProps {
  empresaId: string;
  onNavigateTab: (tab: string, statusFilter?: StatusOS, osId?: string) => void;
}

const formatBRL = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);

const formatDataCurta = (iso: string) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
};

const STATUS_META: Record<
  StatusOS,
  {
    label: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    icon: typeof Wrench;
  }
> = {
  ORCAMENTO: {
    label: 'Orçamento',
    badgeBg: 'bg-amber-950',
    badgeBorder: 'border-amber-500',
    badgeText: 'text-amber-300',
    icon: ClipboardList,
  },
  AGUARDANDO_PECA: {
    label: 'Aguardando Peça',
    badgeBg: 'bg-orange-950',
    badgeBorder: 'border-orange-500',
    badgeText: 'text-orange-300',
    icon: Clock,
  },
  EXECUCAO: {
    label: 'Em Execução',
    badgeBg: 'bg-blue-950',
    badgeBorder: 'border-blue-500',
    badgeText: 'text-blue-200',
    icon: Wrench,
  },
  FINALIZADO: {
    label: 'Finalizado',
    badgeBg: 'bg-emerald-950',
    badgeBorder: 'border-emerald-500',
    badgeText: 'text-emerald-300',
    icon: PackageCheck,
  },
  PAGO: {
    label: 'Pago / Entregue',
    badgeBg: 'bg-green-950',
    badgeBorder: 'border-green-500',
    badgeText: 'text-green-300',
    icon: CheckCircle2,
  },
};

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
      <div className="space-y-6" aria-busy="true" aria-label="Carregando Radar do Pátio">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-40 rounded-2xl bg-[#111827] border-2 border-[#1E293B] p-6 flex flex-col justify-between"
            >
              <div className="h-6 w-40 bg-[#1E293B] rounded" />
              <div className="h-12 w-24 bg-[#1E293B] rounded" />
            </div>
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-[#111827] border-2 border-[#1E293B] p-6 flex items-center justify-center gap-3 text-slate-300 text-lg font-medium">
          <progress aria-label="Carregando dados" className="loading-spinner" />
          <span>Sincronizando pátio com o servidor…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#111827] border-2 border-red-500 rounded-2xl p-8 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-red-950 border-2 border-red-500 text-red-300 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-8 h-8" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Falha ao comunicar com o servidor da oficina
            </h2>
            <p className="text-base text-slate-300 mt-1">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={carregarRadar}
          className="min-h-[58px] px-6 py-3.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-bold text-lg flex items-center gap-3 cursor-pointer"
        >
          <RefreshCw className="w-6 h-6" aria-hidden="true" />
          <span>Tentar Novamente Agora</span>
        </button>
      </div>
    );
  }

  const counts = data?.status_counts || {};
  const emExecucao = counts.EXECUCAO || 0;
  const orcamentos = counts.ORCAMENTO || 0;
  const veiculosNoPatio =
    (counts.AGUARDANDO_PECA || 0) + (counts.EXECUCAO || 0) + (counts.FINALIZADO || 0);
  const concluidas = counts.PAGO || 0;
  const criticosCount = data?.estoque_critico_count || 0;

  return (
    <div className="space-y-3.5 sm:space-y-5">
      {/* CABEÇALHO DE AÇÃO RÁPIDA COMPACTO NO MOBILE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 bg-[#111827] border-2 border-[#1E293B] rounded-xl sm:rounded-2xl p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-extrabold text-white leading-tight">
                Radar do Pátio
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[#1E3A8A] border border-blue-400 text-[11px] font-bold text-blue-100">
                30 dias
              </span>
            </div>
            <p className="hidden sm:block text-sm text-slate-300 mt-0.5">
              Toque em qualquer bloco para filtrar os veículos ou abrir uma nova OS.
            </p>
          </div>

          <button
            type="button"
            onClick={carregarRadar}
            aria-label="Atualizar Radar do Pátio"
            title="Atualizar"
            className="sm:hidden min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1E293B] border border-[#475569] text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregarRadar}
            className="hidden sm:flex min-h-[46px] px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#475569] text-white font-bold text-sm items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('os', undefined, 'NOVA_OS')}
            className="w-full sm:w-auto min-h-[42px] sm:min-h-[48px] px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            <span>+ Nova Ordem de Serviço</span>
          </button>
        </div>
      </div>

      {/* 4 BLOCOS EM GRADE 2x2 NO MOBILE E 4 COLUNAS NO DESKTOP */}
      <section aria-label="Resumo operacional dos últimos 30 dias">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Bloco 1: Veículos no Pátio (Ag. Peça + Execução + Finalizado) */}
          <button
            type="button"
            onClick={() => onNavigateTab('os', 'EXECUCAO')}
            className="text-left bg-[#111827] hover:bg-[#1E293B] border-2 border-[#F97316] rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between min-h-[96px] sm:min-h-[144px] cursor-pointer"
          >
            <div className="flex items-start justify-between w-full gap-1.5">
              <div className="min-w-0">
                <span className="text-xs sm:text-base font-bold text-white block leading-tight">
                  Veículos no Pátio
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 block truncate mt-0.5">
                  Ag. Peça + Exec. + Final.
                </span>
              </div>
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#F97316] text-[#0B0F17] flex items-center justify-center shrink-0">
                <Car className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.3]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline justify-between w-full">
              <span className="text-2xl sm:text-4xl font-extrabold text-white font-mono tabular-nums">
                {veiculosNoPatio}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-[#F97316]">
                Ver →
              </span>
            </div>
          </button>

          {/* Bloco 2: Em Execução no Elevador */}
          <button
            type="button"
            onClick={() => onNavigateTab('os', 'EXECUCAO')}
            className="text-left bg-[#111827] hover:bg-[#1E293B] border-2 border-[#2563EB] rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between min-h-[96px] sm:min-h-[144px] cursor-pointer"
          >
            <div className="flex items-start justify-between w-full gap-1.5">
              <div className="min-w-0">
                <span className="text-xs sm:text-base font-bold text-white block leading-tight">
                  Em Execução
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 block truncate mt-0.5">
                  Na bancada (30d)
                </span>
              </div>
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.3]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline justify-between w-full">
              <span className="text-2xl sm:text-4xl font-extrabold text-white font-mono tabular-nums">
                {emExecucao}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-blue-400">
                Ver →
              </span>
            </div>
          </button>

          {/* Bloco 3: Orçamentos nos últimos 30 dias */}
          <button
            type="button"
            onClick={() => onNavigateTab('os', 'ORCAMENTO')}
            className="text-left bg-[#111827] hover:bg-[#1E293B] border-2 border-amber-500 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between min-h-[96px] sm:min-h-[144px] cursor-pointer"
          >
            <div className="flex items-start justify-between w-full gap-1.5">
              <div className="min-w-0">
                <span className="text-xs sm:text-base font-bold text-white block leading-tight">
                  Orçamentos
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 block truncate mt-0.5">
                  Abertos (30d)
                </span>
              </div>
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-amber-500 text-[#0B0F17] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.3]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline justify-between w-full">
              <span className="text-2xl sm:text-4xl font-extrabold text-white font-mono tabular-nums">
                {orcamentos}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-amber-400">
                Ver →
              </span>
            </div>
          </button>

          {/* Bloco 4: Estoque Crítico */}
          <button
            type="button"
            onClick={() => onNavigateTab('estoque')}
            className={`text-left bg-[#111827] hover:bg-[#1E293B] border-2 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between min-h-[96px] sm:min-h-[144px] cursor-pointer ${
              criticosCount > 0 ? 'border-red-500' : 'border-emerald-500'
            }`}
          >
            <div className="flex items-start justify-between w-full gap-1.5">
              <div className="min-w-0">
                <span className="text-xs sm:text-base font-bold text-white block leading-tight">
                  Alerta Estoque
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 block truncate mt-0.5">
                  Reposição mínima
                </span>
              </div>
              <div
                className={`w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                  criticosCount > 0
                    ? 'bg-red-500 text-white'
                    : 'bg-emerald-500 text-[#0B0F17]'
                }`}
              >
                <Package className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.3]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline justify-between w-full">
              <span className="text-2xl sm:text-4xl font-extrabold text-white font-mono tabular-nums">
                {criticosCount}
              </span>
              <span
                className={`text-[11px] sm:text-xs font-bold truncate ${
                  criticosCount > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {criticosCount > 0 ? 'Repor →' : `${concluidas} pagas`}
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* ESTEIRA DE STATUS COMPACTA */}
      <section aria-label="Quantidade de veículos por etapa nos últimos 30 dias">
        <h2 className="text-sm sm:text-lg font-bold text-white mb-2">
          Etapas da Oficina — 30 dias (Toque para filtrar)
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {(
            [
              'ORCAMENTO',
              'AGUARDANDO_PECA',
              'EXECUCAO',
              'FINALIZADO',
              'PAGO',
            ] as StatusOS[]
          ).map((st) => {
            const meta = STATUS_META[st];
            const Icon = meta.icon;
            const qtd = counts[st] ?? 0;
            return (
              <button
                key={st}
                type="button"
                onClick={() => onNavigateTab('os', st)}
                className="bg-[#111827] hover:bg-[#1E293B] border border-[#334155] hover:border-[#F97316] rounded-xl p-2.5 sm:p-4 flex flex-col justify-between min-h-[64px] sm:min-h-[96px] text-left cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#F97316] shrink-0" aria-hidden="true" />
                  <span className="text-lg sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                    {qtd}
                  </span>
                </div>
                <span className="text-[11px] sm:text-sm font-bold text-slate-200 mt-1 truncate block">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* GRID PRINCIPAL: ÚLTIMAS ORDENS DE SERVIÇO + ESTOQUE CRÍTICO */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        {/* ÚLTIMAS ORDENS NO PÁTIO (8 COLUNAS) */}
        <section
          aria-label="Últimas Ordens de Serviço"
          className="xl:col-span-8 bg-[#111827] border-2 border-[#1E293B] rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">
                  Últimos Veículos (30 dias)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('os')}
                className="min-h-[36px] sm:min-h-[42px] px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm cursor-pointer shrink-0"
              >
                Ver Todas
              </button>
            </div>

            {!data?.ultimas_os || data.ultimas_os.length === 0 ? (
              <div className="bg-[#0B0F17] border border-[#1E293B] rounded-xl p-6 text-center space-y-2">
                <Car className="w-10 h-10 text-slate-500 mx-auto" aria-hidden="true" />
                <p className="text-sm sm:text-base font-bold text-white">
                  Nenhuma Ordem de Serviço aberta nos últimos 30 dias
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.ultimas_os.map((os) => {
                  const st = (os.status as StatusOS) || 'ORCAMENTO';
                  const meta = STATUS_META[st] || STATUS_META.ORCAMENTO;
                  const StatusIcon = meta.icon;
                  const placa = os.veiculos?.placa || 'SEM-PLACA';
                  const modelo = os.veiculos?.modelo || 'Veículo';
                  const clienteNome = os.clientes?.nome || 'Cliente';
                  const telefone = os.clientes?.telefone || '';
                  const foneLimpo = telefone.replace(/\D/g, '');

                  return (
                    <div
                      key={os.id}
                      className="bg-[#0B0F17] border border-[#334155] rounded-xl p-2.5 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              translate="no"
                              className="px-2 py-0.5 rounded bg-[#1E293B] border border-slate-500 font-mono text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider shrink-0"
                            >
                              {placa}
                            </span>
                            <span className="text-sm sm:text-base font-bold text-white truncate">
                              {modelo}
                            </span>
                          </div>

                          <span className="sm:hidden font-mono font-extrabold text-sm text-[#F97316] tabular-nums shrink-0">
                            {formatBRL(os.total_geral)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                          <span className="truncate">
                            <strong className="text-white">{clienteNome}</strong> &bull;{' '}
                            <span className="text-slate-400 tabular-nums">
                              {formatDataCurta(os.data_abertura)}
                            </span>
                          </span>

                          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-bold text-[10px] ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}
                            >
                              <span>{meta.label}</span>
                            </span>
                            {foneLimpo && (
                              <a
                                href={`https://wa.me/55${foneLimpo}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`WhatsApp de ${clienteNome}`}
                                className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0"
                              >
                                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => onNavigateTab('os', undefined, os.id)}
                              className="h-8 px-2.5 rounded-lg bg-[#F97316] text-[#0B0F17] font-extrabold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Abrir</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-xs ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{meta.label}</span>
                        </span>

                        <div className="px-2.5 py-1 rounded-lg bg-[#111827] border border-[#334155] font-mono font-bold text-sm text-white tabular-nums flex items-center gap-1">
                          <DollarSign
                            className="w-3.5 h-3.5 text-[#F97316] shrink-0"
                            aria-hidden="true"
                          />
                          <span>{formatBRL(os.total_geral)}</span>
                        </div>

                        {foneLimpo && (
                          <a
                            href={`https://wa.me/55${foneLimpo}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Conversar no WhatsApp com ${clienteNome}`}
                            title="WhatsApp"
                            className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
                          >
                            <MessageCircle className="w-4 h-4" aria-hidden="true" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => onNavigateTab('os', undefined, os.id)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                          <span>Abrir OS</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ALERTA DE ESTOQUE CRÍTICO (4 COLUNAS) */}
        <section
          aria-label="Itens com estoque baixo"
          className="xl:col-span-4 bg-[#111827] border-2 border-[#1E293B] rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-base sm:text-xl font-bold text-white">
                Reposição de Peças
              </h2>
              <span className="text-xs text-slate-400">Abaixo do mínimo</span>
            </div>

            {!data?.itens_criticos || data.itens_criticos.length === 0 ? (
              <div className="bg-[#0B0F17] border border-emerald-700 rounded-xl p-4 text-center space-y-1">
                <CheckCircle2
                  className="w-8 h-8 text-emerald-400 mx-auto"
                  aria-hidden="true"
                />
                <p className="text-sm font-bold text-white">Estoque em Dia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.itens_criticos.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0B0F17] border border-red-600/80 rounded-xl p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.nome}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.categoria} (Mín: {item.minimo_alerta})
                      </div>
                    </div>

                    <div className="text-right shrink-0 bg-red-950 border border-red-500 rounded-lg px-2.5 py-1">
                      <div className="font-mono text-xs sm:text-sm font-bold text-red-200 tabular-nums">
                        {item.quantidade} un.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('estoque')}
            className="mt-3 w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#475569] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Package className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
            <span>Abrir Estoque Completo</span>
          </button>
        </section>
      </div>
    </div>
  );
}
