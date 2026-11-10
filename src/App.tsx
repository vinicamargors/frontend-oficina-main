import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { DashboardOperacional } from './pages/DashboardOperacional';
import { OrdensServico } from './pages/OrdensServico';
import { ClientesVeiculos } from './pages/ClientesVeiculos';
import { Estoque } from './pages/Estoque';
import { Financeiro } from './pages/Financeiro';
import { Equipe } from './pages/Equipe';
import { Oficina } from './pages/Oficina';
import { AvaliacaoPublicaOS } from './pages/AvaliacaoPublicaOS';
import { api } from './api/client';
import { Empresa, StatusOS } from './types';
import {
  Wrench,
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  DollarSign,
  LogOut,
  Building2,
  ArrowLeft,
  UserCheck,
} from 'lucide-react';

type NavTab =
  | 'patio'
  | 'os'
  | 'veiculos'
  | 'clientes'
  | 'estoque'
  | 'financeiro'
  | 'equipe'
  | 'oficina';

function AppShell() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as NavTab;
    return t || 'patio';
  });

  const [statusFilter, setStatusFilter] = useState<StatusOS | undefined>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('status') as StatusOS) || undefined;
  });

  const [selectedOsId, setSelectedOsId] = useState<string | undefined>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('osId') || undefined;
  });

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(
    () => localStorage.getItem('autotec_tenant_id') || ''
  );

  const isMaster = user?.cargo === 'master';
  const canSeeFinanceiro =
    user?.cargo === 'DONO' || user?.cargo === 'FINANCEIRO' || isMaster;
  const canSeeConfig = user?.cargo === 'DONO' || isMaster;

  const effectiveEmpresaId = isMaster
    ? selectedEmpresaId || user?.empresa_id || ''
    : user?.empresa_id || '';

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    api
      .getEmpresas(user.empresa_id || undefined)
      .then((lista) => {
        setEmpresas(lista);
        if (lista.length > 0 && !selectedEmpresaId) {
          const idInicial = user.empresa_id || lista[0].id;
          setSelectedEmpresaId(idInicial);
          localStorage.setItem('autotec_tenant_id', idInicial);
        }
      })
      .catch(console.error);

    // Trava de segurança: redireciona para pátio se o cargo não puder acessar a aba atual
    if ((activeTab === 'equipe' || activeTab === 'oficina') && !canSeeConfig) {
      setActiveTab('patio');
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'patio');
      window.history.replaceState({}, '', url.toString());
    } else if (activeTab === 'financeiro' && !canSeeFinanceiro) {
      setActiveTab('patio');
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'patio');
      window.history.replaceState({}, '', url.toString());
    }
  }, [isAuthenticated, user, selectedEmpresaId, activeTab, canSeeConfig, canSeeFinanceiro]);

  const handleNavigateTab = (tab: string, status?: StatusOS, osId?: string) => {
    let nextTab = (tab as NavTab) || 'patio';

    // Impede navegação indevida por perfil
    if ((nextTab === 'equipe' || nextTab === 'oficina') && !canSeeConfig) {
      nextTab = 'patio';
    }
    if (nextTab === 'financeiro' && !canSeeFinanceiro) {
      nextTab = 'patio';
    }

    setActiveTab(nextTab);
    setStatusFilter(status);
    setSelectedOsId(osId);

    const url = new URL(window.location.href);
    url.searchParams.delete('modo');
    url.searchParams.set('tab', nextTab);
    if (status) {
      url.searchParams.set('status', status);
    } else {
      url.searchParams.delete('status');
    }
    if (osId) {
      url.searchParams.set('osId', osId);
    } else {
      url.searchParams.delete('osId');
    }
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTab((params.get('tab') as NavTab) || 'patio');
      setStatusFilter((params.get('status') as StatusOS) || undefined);
      setSelectedOsId(params.get('osId') || undefined);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const searchParams = new URLSearchParams(window.location.search);
  const modoPublico = searchParams.get('modo');
  const osIdPublico = searchParams.get('osId');

  if (modoPublico === 'avaliar' && osIdPublico) {
    return (
      <AvaliacaoPublicaOS
        osId={osIdPublico}
        empresaId={searchParams.get('empresaId') || undefined}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh w-full bg-[#071226] text-white flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#38BDF8] text-[#071226] flex items-center justify-center">
          <Wrench className="w-9 h-9 stroke-[2.5]" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-3 text-lg font-bold">
          <progress aria-label="Carregando" className="loading-spinner" />
          <span>Abrindo Mecanify…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Login />;
  }

  const navItems: {
    id: NavTab;
    label: string;
    shortLabel: string;
    icon: typeof LayoutDashboard;
    visible: boolean;
  }[] = [
    {
      id: 'patio',
      label: 'Radar do Pátio',
      shortLabel: 'Pátio',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'os',
      label: 'Ordens de Serviço',
      shortLabel: 'Ordens',
      icon: ClipboardList,
      visible: true,
    },
    {
      id: 'clientes',
      label: 'Clientes & Veículos',
      shortLabel: 'Clientes',
      icon: Users,
      visible: true,
    },
    {
      id: 'estoque',
      label: 'Estoque de Peças',
      shortLabel: 'Estoque',
      icon: Package,
      visible: true,
    },
    {
      id: 'financeiro',
      label: 'Caixa & Financeiro',
      shortLabel: 'Caixa',
      icon: DollarSign,
      visible: canSeeFinanceiro,
    },
    {
      id: 'equipe',
      label: 'Equipe & RH',
      shortLabel: 'Equipe',
      icon: UserCheck,
      visible: canSeeConfig,
    },
    {
      id: 'oficina',
      label: 'Dados da Oficina',
      shortLabel: 'Oficina',
      icon: Building2,
      visible: canSeeConfig,
    },
  ];

  const visibleNav = navItems.filter((item) => item.visible);
  const empresaAtual = empresas.find((e) => e.id === effectiveEmpresaId);

  return (
    <div className="min-h-dvh w-full bg-[#071226] text-[#F8FAFC] flex flex-col lg:flex-row print:bg-white print:text-black">
      {/* SIDEBAR INDUSTRIAL (DESKTOP) */}
      <aside
        aria-label="Menu Principal da Oficina"
        className="print:hidden hidden lg:flex lg:w-80 xl:w-84 bg-[#0B1B36] border-r-2 border-[#12274D] flex-col justify-between p-5 shrink-0"
      >
        <div className="space-y-6">
          {/* Topo da Marca Mecanify */}
          <div className="bg-[#1E3A8A] border-2 border-[#38BDF8] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-xl bg-[#38BDF8] text-[#071226] flex items-center justify-center shrink-0">
              <Wrench className="w-8 h-8 stroke-[2.5]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span
                translate="no"
                className="text-2xl font-bold text-white tracking-tight block leading-none"
              >
                Mecanify
              </span>
              <span className="text-sm text-blue-100 font-medium truncate block mt-1">
                {empresaAtual?.nome_fantasia || 'Painel Operacional'}
              </span>
            </div>
          </div>

          {/* Seletor de Oficina para Master */}
          {isMaster && empresas.length > 0 && (
            <div className="bg-[#071226] border-2 border-[#264577] rounded-xl p-3.5">
              <label
                htmlFor="seletor-oficina-desktop"
                className="flex items-center gap-2 text-xs font-bold text-[#38BDF8] mb-2"
              >
                <Building2 className="w-4 h-4" aria-hidden="true" />
                <span>Alternar Oficina (Master)</span>
              </label>
              <select
                id="seletor-oficina-desktop"
                value={effectiveEmpresaId}
                onChange={(e) => {
                  setSelectedEmpresaId(e.target.value);
                  localStorage.setItem('autotec_tenant_id', e.target.value);
                }}
                className="w-full min-h-[48px] px-3 py-2 rounded-lg bg-[#0B1B36] border border-[#3A5C90] text-white font-semibold text-base cursor-pointer"
              >
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome_fantasia}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botões Grandes de Navegação */}
          <nav className="space-y-2.5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigateTab(item.id)}
                  className={`w-full min-h-[60px] px-4 py-3.5 rounded-xl font-bold text-lg flex items-center gap-4 text-left cursor-pointer border-2 ${
                    active
                      ? 'bg-[#38BDF8] text-[#071226] border-[#38BDF8]'
                      : 'bg-[#071226] text-slate-200 border-[#12274D] hover:bg-[#12274D] hover:border-[#3A5C90]'
                  }`}
                >
                  <Icon className="w-7 h-7 shrink-0 stroke-[2.2]" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé do Mecânico / Usuário Logado */}
        <div className="pt-6 border-t-2 border-[#12274D] space-y-3">
          <div className="bg-[#071226] border border-[#264577] rounded-xl p-4">
            <div className="text-base font-bold text-white truncate">{user.nome}</div>
            <div className="text-sm text-slate-400 truncate">{user.email}</div>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#1E3A8A] text-white text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
              <span>Cargo: {user.cargo}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full min-h-[56px] px-4 py-3 rounded-xl bg-red-950 hover:bg-red-900 border-2 border-red-600 text-red-100 font-bold text-base flex items-center justify-center gap-3 cursor-pointer"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* ÁREA CENTRAL DE TRABALHO (OCUPA 100% DA TELA) */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 print:pb-0">
        {/* TOPBAR MOBILE & TABLET COMPACTA */}
        <header className="print:hidden lg:hidden bg-[#1E3A8A] border-b-2 border-[#38BDF8] px-3 py-2 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#38BDF8] text-[#071226] flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span
                translate="no"
                className="text-base font-extrabold text-white block leading-none"
              >
                Mecanify
              </span>
              <span className="text-[11px] text-blue-100 font-medium truncate block mt-0.5">
                {user.nome} &bull; {user.cargo}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            aria-label="Sair da conta"
            title="Sair da conta"
            className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#071226] border border-red-500 text-red-200 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <main id="conteudo-principal" className="flex-1 w-full p-2.5 sm:p-5 lg:p-7 print:p-0">
          {!effectiveEmpresaId ? (
            <div className="bg-[#0B1B36] border-2 border-[#38BDF8] rounded-2xl p-8 space-y-3">
              <h2 className="text-2xl font-bold text-white">
                Selecione uma Oficina para visualizar o pátio
              </h2>
              <p className="text-base text-slate-300">
                Sua conta Master está autenticada. Escolha uma oficina no seletor para carregar os dados.
              </p>
            </div>
          ) : activeTab === 'patio' ? (
            <DashboardOperacional
              empresaId={effectiveEmpresaId}
              onNavigateTab={handleNavigateTab}
            />
          ) : activeTab === 'os' ? (
            <OrdensServico
              empresaId={effectiveEmpresaId}
              initialStatusFilter={statusFilter}
              initialOsId={selectedOsId}
            />
          ) : activeTab === 'clientes' || activeTab === 'veiculos' ? (
            <ClientesVeiculos
              empresaId={effectiveEmpresaId}
              initialViewMode={activeTab === 'veiculos' ? 'veiculos' : 'clientes'}
              onNavigateTab={handleNavigateTab}
            />
          ) : activeTab === 'estoque' ? (
            <Estoque empresaId={effectiveEmpresaId} />
          ) : activeTab === 'financeiro' && canSeeFinanceiro ? (
            <Financeiro empresaId={effectiveEmpresaId} />
          ) : activeTab === 'equipe' && canSeeConfig ? (
            <Equipe empresaId={effectiveEmpresaId} />
          ) : activeTab === 'oficina' && canSeeConfig ? (
            <Oficina empresaId={effectiveEmpresaId} />
          ) : (
            <div className="bg-[#0B1B36] border-2 border-[#2563EB] rounded-2xl p-6 sm:p-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-[#1E3A8A] border-2 border-[#38BDF8] text-white flex items-center justify-center">
                <Wrench className="w-8 h-8 text-[#38BDF8]" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Módulo: {visibleNav.find((i) => i.id === activeTab)?.label}
                </h1>
                <p className="text-base sm:text-lg text-slate-300 max-w-2xl">
                  Esta tela entra no MVP 3 (Cadastros dedicados de Veículos, Clientes e
                  Estoque com ajuste rápido).
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleNavigateTab('os')}
                className="min-h-[58px] px-6 py-4 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-bold text-lg flex items-center gap-3 cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                <span>Ir para Ordens de Serviço</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* BARRA INFERIOR DE POLEGAR COMPACTA (MOBILE / CELULAR DO MECÂNICO) */}
      <nav
        aria-label="Navegação Rápida Mobile"
        className="print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B1B36] border-t border-[#264577] px-1 py-1 flex items-center justify-around overflow-x-auto no-scrollbar gap-0.5"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      >
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigateTab(item.id)}
              className={`min-h-[46px] min-w-[48px] flex-1 rounded-lg flex flex-col items-center justify-center gap-0.5 px-1 py-1 font-bold text-[10px] cursor-pointer shrink-0 ${
                active
                  ? 'bg-[#38BDF8] text-[#071226]'
                  : 'text-slate-300 hover:bg-[#12274D]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" aria-hidden="true" />
              <span className="truncate max-w-full leading-none">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
