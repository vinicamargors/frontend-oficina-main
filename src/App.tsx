import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
import { Button, Logo, ThemeToggle } from './components/ui';
import { Folha } from './components/Folha';
import {
  Ellipsis,
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  DollarSign,
  LogOut,
  Building2,
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

const ROTULO_CARGO: Record<string, string> = {
  DONO: 'Dono',
  ATENDENTE: 'Atendente',
  MECANICO: 'Mecânico',
  FINANCEIRO: 'Financeiro',
  master: 'Master',
};

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

  const [maisAberto, setMaisAberto] = useState(false);
  const [barra, setBarra] = useState<HTMLElement | null>(null);
  const folhaRef = useRef<HTMLDivElement>(null);
  const maisBtnRef = useRef<HTMLButtonElement>(null);
  const [alturaBarra, setAlturaBarra] = useState(0);

  // Mede a barra inferior (varia com a área segura do aparelho e ao girar/redimensionar): a folha "Mais" e as barras de ação das
  // telas se encaixam logo acima dela pela variável --barra-inferior-h (0 no desktop, onde a barra some).
  useLayoutEffect(() => {
    if (!barra) return;
    const medir = () => setAlturaBarra(barra.offsetHeight);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(medir);
    obs.observe(barra, { box: 'border-box' });
    return () => obs.disconnect();
  }, [barra]);

  // Foco entra na folha ao abrir e volta para o botão "Mais" ao fechar.
  useEffect(() => {
    if (!maisAberto) return;
    const botao = maisBtnRef.current;
    folhaRef.current?.querySelector<HTMLElement>('button, select')?.focus();
    return () => botao?.focus();
  }, [maisAberto]);

  useEffect(() => {
    if (!maisAberto) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaisAberto(false);
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [maisAberto]);

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

  // Dados da Oficina com alterações não salvas: trocar de tela ou de oficina pergunta antes de descartar
  const oficinaSuja = useRef(false);
  const aoMudarSujoOficina = useCallback((sujo: boolean) => {
    oficinaSuja.current = sujo;
  }, []);
  const [saidaPendente, setSaidaPendente] = useState<(() => void) | null>(null);
  const protegerSaida = (acao: () => void) => {
    if (oficinaSuja.current) setSaidaPendente(() => acao);
    else acao();
  };

  const handleNavigateTab = (tab: string, status?: StatusOS, osId?: string, substituir = false) => {
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
    // `substituir`: a tela que sai deixou uma entrada extra no histórico (formulário sujo); a nova tela fica no lugar dela
    if (substituir) window.history.replaceState({}, '', url.toString());
    else window.history.pushState({}, '', url.toString());
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

  // Saiu da conta descartando a Oficina suja: já desmontada (sem o "voltar" dela), tira a entrada extra do histórico
  const desfazerEntradaExtraAoSair = useRef(false);
  useEffect(() => {
    if (isAuthenticated || !desfazerEntradaExtraAoSair.current) return;
    desfazerEntradaExtraAoSair.current = false;
    window.history.go(-1);
  }, [isAuthenticated]);

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
      <div className="min-h-dvh w-full bg-canvas text-ink flex flex-col items-center justify-center p-6 gap-4">
        <Logo tamanho={40} />
        <div className="flex items-center gap-3 text-lg font-semibold">
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
      label: 'Radar do pátio',
      shortLabel: 'Pátio',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'os',
      label: 'Ordens de serviço',
      shortLabel: 'Ordens',
      icon: ClipboardList,
      visible: true,
    },
    {
      id: 'clientes',
      label: 'Clientes & veículos',
      shortLabel: 'Clientes',
      icon: Users,
      visible: true,
    },
    {
      id: 'estoque',
      label: 'Estoque de peças',
      shortLabel: 'Estoque',
      icon: Package,
      visible: true,
    },
    {
      id: 'financeiro',
      label: 'Caixa & financeiro',
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
      label: 'Dados da oficina',
      shortLabel: 'Oficina',
      icon: Building2,
      visible: canSeeConfig,
    },
  ];

  const visibleNav = navItems.filter((item) => item.visible);
  const empresaAtual = empresas.find((e) => e.id === effectiveEmpresaId);
  const cargoLegivel = ROTULO_CARGO[user.cargo] ?? user.cargo;
  const principaisMobile = visibleNav.slice(0, 4);
  const extrasMobile = visibleNav.slice(4);
  const abaNoExtra = extrasMobile.some((i) => i.id === activeTab);

  const irPara = (id: NavTab) => {
    setMaisAberto(false);
    if (oficinaSuja.current && id === activeTab) return;
    // Descartar com o formulário sujo: a entrada extra que a Oficina deixou no histórico vira a da nova tela
    protegerSaida(() => handleNavigateTab(id, undefined, undefined, oficinaSuja.current));
  };

  const sair = () => {
    setMaisAberto(false);
    protegerSaida(() => {
      desfazerEntradaExtraAoSair.current = oficinaSuja.current;
      logout().catch(() => {
        desfazerEntradaExtraAoSair.current = false;
      });
    });
  };

  const seletorMaster = (idSeletor: string) =>
    isMaster && empresas.length > 0 ? (
      <div className="space-y-1.5">
        <label htmlFor={idSeletor} className="flex items-center gap-2 text-xs font-medium text-ink-muted">
          <Building2 size={14} aria-hidden="true" />
          <span>Oficina (Master)</span>
        </label>
        <select
          id={idSeletor}
          value={effectiveEmpresaId}
          onChange={(e) => {
            const id = e.target.value;
            protegerSaida(() => {
              setSelectedEmpresaId(id);
              localStorage.setItem('autotec_tenant_id', id);
            });
          }}
          className="w-full h-10 min-h-11 md:min-h-10 px-3 rounded-lg bg-surface border border-line-strong text-ink text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.nome_fantasia}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  return (
    <div
      className="min-h-dvh w-full bg-canvas text-ink flex flex-col lg:flex-row print:bg-white print:text-black"
      style={{ '--barra-inferior-h': `${alturaBarra}px` } as CSSProperties}
    >
      {/* MENU LATERAL (DESKTOP) */}
      <aside
        aria-label="Menu principal da oficina"
        className="print:hidden hidden lg:flex w-60 shrink-0 bg-canvas flex-col justify-between px-3 py-6 sticky top-0 h-dvh"
      >
        <div className="space-y-8 min-h-0 overflow-y-auto">
          <div className="px-3 space-y-1.5">
            <Logo tamanho={28} />
            <span className="text-xs text-ink-muted truncate block">
              {empresaAtual?.nome_fantasia || 'Painel operacional'}
            </span>
          </div>

          {seletorMaster('seletor-oficina-desktop')}

          <nav aria-label="Seções">
            <ul className="space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => irPara(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full h-10 px-3 rounded-lg text-sm font-medium flex items-center gap-3 text-left cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        active ? 'bg-muted text-ink' : 'text-ink-muted hover:bg-muted/60 hover:text-ink'
                      }`}
                    >
                      <Icon size={20} strokeWidth={1.75} className={`shrink-0 ${active ? 'text-brand-ink' : ''}`} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="pt-4 mt-4 border-t border-line space-y-2">
          <div className="flex items-center gap-2 px-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink truncate">{user.nome}</div>
              <div className="text-xs text-ink-muted truncate">{cargoLegivel}</div>
            </div>
            <ThemeToggle />
          </div>
          <Button variante="fantasma" icone={LogOut} onClick={sair} className="w-full !justify-start">
            Sair
          </Button>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
      <div className="flex-1 flex flex-col min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0">
        <header className="print:hidden lg:hidden bg-canvas px-4 h-14 flex items-center gap-3 sticky top-0 z-30">
          <Logo tamanho={26} />
          <span className="text-xs text-ink-muted truncate">{empresaAtual?.nome_fantasia}</span>
        </header>

        <main id="conteudo-principal" className="flex-1 w-full p-4 md:p-8 print:p-0">
          {!effectiveEmpresaId ? (
            <div className="bg-surface rounded-2xl p-8 space-y-2">
              <h2 className="text-xl font-semibold text-ink text-balance">Selecione uma oficina para ver o pátio</h2>
              <p className="text-sm text-ink-muted text-pretty">
                Sua conta Master está autenticada. Escolha uma oficina no seletor para carregar os dados.
              </p>
            </div>
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
            <Oficina empresaId={effectiveEmpresaId} onSujoChange={aoMudarSujoOficina} />
          ) : (
            <DashboardOperacional empresaId={effectiveEmpresaId} onNavigateTab={handleNavigateTab} />
          )}
        </main>
      </div>

      {/* "MAIS" (MOBILE) */}
      {maisAberto && (
        <div className="print:hidden lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Fechar"
            onClick={() => setMaisAberto(false)}
            className="fixed inset-0 z-40 bg-ink/40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Mais opções"
            aria-modal="true"
            ref={folhaRef}
            className="fixed left-0 right-0 z-40 bg-surface rounded-t-2xl p-3 space-y-3 max-h-[70dvh] overflow-y-auto"
            style={{ bottom: alturaBarra }}
          >
            {extrasMobile.length > 0 && (
              <ul className="space-y-0.5">
                {extrasMobile.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => irPara(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full min-h-12 px-3 rounded-lg text-sm font-medium flex items-center gap-3 text-left cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          active ? 'bg-muted text-ink' : 'text-ink-muted hover:bg-muted/60 hover:text-ink'
                        }`}
                      >
                        <Icon size={20} strokeWidth={1.75} className={`shrink-0 ${active ? 'text-brand-ink' : ''}`} aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {seletorMaster('seletor-oficina-mobile')}
            <div className="pt-3 border-t border-line flex items-center gap-2 px-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{user.nome}</div>
                <div className="text-xs text-ink-muted truncate">{cargoLegivel}</div>
              </div>
              <ThemeToggle />
              <Button variante="fantasma" icone={LogOut} onClick={sair}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      <Folha aberto={saidaPendente !== null} titulo="Descartar alterações?" aoCancelar={() => setSaidaPendente(null)}>
        <p className="text-sm text-ink-muted">O que você digitou nos dados da oficina será perdido.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundario" onClick={() => setSaidaPendente(null)}>
            Continuar editando
          </Button>
          <Button
            variante="perigo"
            onClick={() => {
              const sair = saidaPendente;
              setSaidaPendente(null);
              sair?.();
            }}
          >
            Descartar
          </Button>
        </div>
      </Folha>

      {/* BARRA INFERIOR (MOBILE) */}
      <nav
        ref={setBarra}
        aria-label="Navegação rápida mobile"
        className="print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface px-1 pt-1 flex items-stretch"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      >
        {[
          ...principaisMobile.map((item) => ({
            chave: item.id as string,
            rotulo: item.shortLabel,
            Icon: item.icon,
            ativo: activeTab === item.id,
            aoClicar: () => irPara(item.id),
          })),
        ].map(({ chave, rotulo, Icon, ativo, aoClicar }) => (
          <button
            key={chave}
            type="button"
            onClick={aoClicar}
            aria-current={ativo ? 'page' : undefined}
            className={`min-h-14 min-w-11 flex-1 rounded-lg flex flex-col items-center justify-center gap-1 px-1 text-xs font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              ativo ? 'text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon size={20} strokeWidth={1.75} className={ativo ? 'text-brand-ink' : ''} aria-hidden="true" />
            <span className="truncate max-w-full leading-none">{rotulo}</span>
          </button>
        ))}
        <button
          ref={maisBtnRef}
          type="button"
          onClick={() => setMaisAberto((v) => !v)}
          aria-expanded={maisAberto}
          aria-haspopup="dialog"
          aria-current={abaNoExtra && !maisAberto ? 'page' : undefined}
          className={`min-h-14 min-w-11 flex-1 rounded-lg flex flex-col items-center justify-center gap-1 px-1 text-xs font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            abaNoExtra || maisAberto ? 'text-ink' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Ellipsis size={20} strokeWidth={1.75} className={abaNoExtra ? 'text-brand-ink' : ''} aria-hidden="true" />
          <span className="leading-none">Mais</span>
        </button>
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
