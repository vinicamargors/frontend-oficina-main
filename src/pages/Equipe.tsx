import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Usuario,
  UsuarioCreateInput,
  UsuarioUpdateInput,
  EscalaFolga,
  RegistroPonto,
  AvaliacaoOS,
  ParametrosFolha,
  CargoUsuario,
} from '../types';
import {
  Users,
  UserPlus,
  Calendar,
  Clock,
  Star,
  Printer,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Pencil,
  Trash2,
  X,
  Send,
  Navigation,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

interface EquipeProps {
  empresaId: string;
}

type TabEquipe = 'colaboradores' | 'folha' | 'escalas' | 'ponto' | 'avaliacoes';

const CARGOS_DISPONIVEIS: { id: CargoUsuario; label: string; desc: string }[] = [
  { id: 'MECANICO', label: 'Mecânico / Técnico', desc: 'Acessa pátio e lança serviços nas OS' },
  { id: 'ATENDENTE', label: 'Atendente / Recepção', desc: 'Atende clientes e abre orçamentos' },
  { id: 'FINANCEIRO', label: 'Financeiro', desc: 'Acesso total a caixa, DRE e pagamentos' },
  { id: 'DONO', label: 'Dono / Administrador', desc: 'Controle total da oficina e equipe' },
];

const formatBRL = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor || 0)
  );

const formatData = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso.slice(0, 10);
  }
};

// Cálculo de distância entre dois pontos GPS em metros (Fórmula de Haversine)
function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function Equipe({ empresaId }: EquipeProps) {
  const { user } = useAuth();
  const isGestor = user?.cargo === 'DONO' || user?.cargo === 'master';
  const [activeTab, setActiveTab] = useState<TabEquipe>('colaboradores');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [escalas, setEscalas] = useState<EscalaFolga[]>([]);
  const [pontos, setPontos] = useState<RegistroPonto[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoOS[]>([]);
  const [parametrosFolha, setParametrosFolha] = useState<ParametrosFolha>(() =>
    api.obterParametrosFolha(empresaId)
  );
  const [coordsOficina, setCoordsOficina] = useState<{
    lat: number;
    lon: number;
    raio: number;
  }>({ lat: -23.55052, lon: -46.633308, raio: 150 });

  const [carregando, setCarregando] = useState(true);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Mês de referência da Folha
  const [mesFolhaRef, setMesFolhaRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modais e Filtros
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [modalColaboradorAberto, setModalColaboradorAberto] = useState(false);
  const [colaboradorEmEdicao, setColaboradorEmEdicao] = useState<Usuario | null>(null);
  const [modalConviteAberto, setModalConviteAberto] = useState(false);
  const [linkConviteGerado, setLinkConviteGerado] = useState('');
  const [cargoConvite, setCargoConvite] = useState<CargoUsuario>('MECANICO');
  const [nomeConvite, setNomeConvite] = useState('');
  const [telConvite, setTelConvite] = useState('');

  // Form Colaborador (sem valores fictícios por padrão)
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formCargo, setFormCargo] = useState<CargoUsuario>('MECANICO');
  const [formSenha, setFormSenha] = useState('');
  const [formSalario, setFormSalario] = useState('');
  const [formComissaoServico, setFormComissaoServico] = useState('');
  const [formComissaoPeca, setFormComissaoPeca] = useState('');
  const [formVT, setFormVT] = useState('');
  const [formVR, setFormVR] = useState('');
  const [formPagaHE, setFormPagaHE] = useState(true);
  const [formValorHE, setFormValorHE] = useState('');

  // Listas computadas (Separação estrita de ativos e inativos)
  const usuariosAtivos = useMemo(
    () => usuarios.filter((u) => u.ativo !== false),
    [usuarios]
  );
  const usuariosInativos = useMemo(
    () => usuarios.filter((u) => u.ativo === false),
    [usuarios]
  );
  const colaboradoresVisiveis = useMemo(() => {
    return mostrarInativos ? usuarios : usuariosAtivos;
  }, [usuarios, mostrarInativos, usuariosAtivos]);

  // Modal Holerite
  const [modalHoleriteAberto, setModalHoleriteAberto] = useState(false);
  const [colaboradorHolerite, setColaboradorHolerite] = useState<Usuario | null>(null);

  // Modal Escala / Férias
  const [modalEscalaAberto, setModalEscalaAberto] = useState(false);
  const [escalaUsuarioId, setEscalaUsuarioId] = useState('');
  const [escalaTipo, setEscalaTipo] = useState<'FERIAS' | 'FOLGA' | 'ATESTADO' | 'PLANTAO'>(
    'FERIAS'
  );
  const [escalaInicio, setEscalaInicio] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [escalaFim, setEscalaFim] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [escalaObs, setEscalaObs] = useState('');

  // Ponto Mobile State
  const [registrandoPonto, setRegistrandoPonto] = useState(false);
  const [pontoFeedback, setPontoFeedback] = useState<{
    sucesso: boolean;
    msg: string;
  } | null>(null);

  // Carrega dados iniciais
  const carregarTudo = useCallback(async () => {
    try {
      setCarregando(true);
      const [users, cfgOficina, escalasData, pontosData, avsData] = await Promise.all([
        api.listarUsuarios(empresaId),
        api.obterConfiguracoesOficina(empresaId),
        api.listarEscalasFolgas(empresaId),
        api.listarPontos(empresaId),
        api.listarAvaliacoesOS(empresaId),
      ]);
      setUsuarios(users);
      setEscalas(escalasData);
      setPontos(pontosData);
      setAvaliacoes(avsData);
      setParametrosFolha(api.obterParametrosFolha(empresaId));

      if (cfgOficina.latitude_gps && cfgOficina.longitude_gps) {
        setCoordsOficina({
          lat: cfgOficina.latitude_gps,
          lon: cfgOficina.longitude_gps,
          raio: cfgOficina.raio_gps_metros || 150,
        });
      }
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao carregar equipe.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const dispararFeedback = (msg: string) => {
    setSucessoMsg(msg);
    setTimeout(() => setSucessoMsg(null), 4000);
  };

  // Abrir Modal de Criação / Edição de Colaborador
  const abrirModalCadastroColaborador = () => {
    setColaboradorEmEdicao(null);
    setFormNome('');
    setFormEmail('');
    setFormTelefone('');
    setFormCargo('MECANICO');
    setFormSenha('');
    setFormSalario('');
    setFormComissaoServico(String(parametrosFolha.comissao_global_servico_pct ?? 15));
    setFormComissaoPeca(String(parametrosFolha.comissao_global_peca_pct ?? 5));
    setFormVT('');
    setFormVR('');
    setFormPagaHE(parametrosFolha.paga_hora_extra_padrao);
    setFormValorHE(String(parametrosFolha.valor_hora_extra_padrao ?? 25));
    setModalColaboradorAberto(true);
  };

  const abrirModalEdicaoColaborador = (u: Usuario) => {
    setColaboradorEmEdicao(u);
    setFormNome(u.nome);
    setFormEmail(u.email);
    setFormTelefone(u.telefone || '');
    setFormCargo(u.cargo);
    setFormSenha('');
    setFormSalario(
      u.salario_base && u.salario_base > 0 ? String(u.salario_base) : ''
    );
    setFormComissaoServico(
      u.comissao_servico_pct !== undefined && u.comissao_servico_pct !== null
        ? String(u.comissao_servico_pct)
        : String(parametrosFolha.comissao_global_servico_pct ?? 15)
    );
    setFormComissaoPeca(
      u.comissao_peca_pct !== undefined && u.comissao_peca_pct !== null
        ? String(u.comissao_peca_pct)
        : String(parametrosFolha.comissao_global_peca_pct ?? 5)
    );
    setFormVT(
      u.vale_transporte && u.vale_transporte > 0 ? String(u.vale_transporte) : ''
    );
    setFormVR(
      u.vale_refeicao && u.vale_refeicao > 0 ? String(u.vale_refeicao) : ''
    );
    setFormPagaHE(u.paga_hora_extra ?? false);
    setFormValorHE(
      u.valor_hora_extra && u.valor_hora_extra > 0 ? String(u.valor_hora_extra) : ''
    );
    setModalColaboradorAberto(true);
  };

  // Exclusão Lógica (Desativar Colaborador)
  const handleExcluirColaborador = async (u: Usuario) => {
    const confirmar = window.confirm(
      `Deseja realmente desativar o colaborador "${u.nome}"?\n\nEle será mantido no histórico da base de dados, mas removido da listagem ativa e da folha de pagamento.`
    );
    if (!confirmar) return;

    try {
      await api.desativarUsuario(empresaId, u.id);
      setUsuarios((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, ativo: false } : item))
      );
      dispararFeedback(`Colaborador "${u.nome}" desativado com sucesso!`);
    } catch (e) {
      const err = e as Error;
      alert(`Erro ao desativar colaborador: ${err.message}`);
    }
  };

  // Reativação de Colaborador
  const handleReativarColaborador = async (u: Usuario) => {
    try {
      await api.reativarUsuario(empresaId, u.id);
      setUsuarios((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, ativo: true } : item))
      );
      dispararFeedback(`Colaborador "${u.nome}" reativado com sucesso!`);
    } catch (e) {
      const err = e as Error;
      alert(`Erro ao reativar colaborador: ${err.message}`);
    }
  };

  // Salvar Colaborador
  const handleSalvarColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formEmail.trim()) {
      alert('Preencha nome e e-mail.');
      return;
    }

    if (!isGestor) {
      alert('Acesso negado: apenas o Dono ou Administrador pode criar ou editar colaboradores.');
      return;
    }

    if (formSenha.trim() && formSenha.trim().length < 6) {
      alert('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    const salarioNum = formSalario.trim() ? parseFloat(formSalario) : null;
    const comissaoServicoNum = formComissaoServico.trim() ? parseFloat(formComissaoServico) : 0;
    const comissaoPecaNum = formComissaoPeca.trim() ? parseFloat(formComissaoPeca) : 0;
    const vtNum = formVT.trim() ? parseFloat(formVT) : 0;
    const vrNum = formVR.trim() ? parseFloat(formVR) : 0;
    const heNum = formValorHE.trim() ? parseFloat(formValorHE) : 0;

    try {
      if (colaboradorEmEdicao) {
        const emailAlterado =
          formEmail.trim().toLowerCase() !== (colaboradorEmEdicao.email || '').trim().toLowerCase();

        const payload: UsuarioUpdateInput = {
          nome: formNome.trim(),
          ...(emailAlterado ? { email: formEmail.trim() } : {}),
          telefone: formTelefone.trim() || null,
          cargo: formCargo,
          ...(formSenha.trim() ? { senha: formSenha.trim() } : {}),
          salario_base: salarioNum,
          comissao_servico_pct: comissaoServicoNum,
          comissao_peca_pct: comissaoPecaNum,
          vale_transporte: vtNum,
          vale_refeicao: vrNum,
          paga_hora_extra: formPagaHE,
          valor_hora_extra: heNum,
        };
        const atualizado = await api.atualizarUsuario(
          empresaId,
          colaboradorEmEdicao.id,
          payload
        );
        setUsuarios((prev) =>
          prev.map((u) => (u.id === atualizado.id ? { ...u, ...atualizado } : u))
        );
        dispararFeedback(`Colaborador "${atualizado.nome}" atualizado!`);
      } else {
        const payload: UsuarioCreateInput = {
          empresa_id: empresaId,
          nome: formNome.trim(),
          email: formEmail.trim(),
          telefone: formTelefone.trim() || null,
          cargo: formCargo,
          senha: formSenha || 'Autotec@123',
          salario_base: salarioNum || 0,
          comissao_servico_pct: comissaoServicoNum,
          comissao_peca_pct: comissaoPecaNum,
          vale_transporte: vtNum,
          vale_refeicao: vrNum,
          paga_hora_extra: formPagaHE,
          valor_hora_extra: heNum,
        };
        const criado = await api.criarUsuario(payload);
        setUsuarios((prev) => [criado, ...prev]);
        dispararFeedback(`Colaborador "${criado.nome}" cadastrado com sucesso!`);
      }
      setModalColaboradorAberto(false);
    } catch (e) {
      const err = e as Error;
      alert(`Erro ao salvar colaborador: ${err.message || 'Verifique os dados.'}`);
    }
  };

  // Gerador de Convite por WhatsApp & E-mail
  const handleGerarConvite = () => {
    const token = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const url = `${window.location.origin}/?convite=${token}&empresaId=${empresaId}&cargo=${cargoConvite}&nome=${encodeURIComponent(
      nomeConvite
    )}`;
    setLinkConviteGerado(url);
  };

  const handleEnviarConviteWhatsApp = () => {
    if (!linkConviteGerado) handleGerarConvite();
    const tel = telConvite.replace(/\D/g, '');
    const msg = `Olá ${nomeConvite || 'Colaborador'}, você foi convidado para a equipe no Autotec Pro (${cargoConvite}). Crie sua senha e acesse seu painel aqui: ${linkConviteGerado}`;
    const waUrl = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Automação: Lançar Folha no Contas a Pagar (Sem dados fictícios)
  const handleLancarFolhaContasPagar = async () => {
    const [ano, mes] = mesFolhaRef.split('-');
    const proximoMes = parseInt(mes, 10) === 12 ? 1 : parseInt(mes, 10) + 1;
    const proximoAno = parseInt(mes, 10) === 12 ? parseInt(ano, 10) + 1 : parseInt(ano, 10);
    const dataVencimentoFolha = `${proximoAno}-${String(proximoMes).padStart(
      2,
      '0'
    )}-${String(parametrosFolha.dia_pagamento).padStart(2, '0')}`;

    const totalFolhaGeral = usuariosAtivos.reduce((acc, u) => {
      const salario = (u.salario_base && u.salario_base > 0) ? u.salario_base : 0;
      const vt = u.vale_transporte || 0;
      const vr = u.vale_refeicao || 0;
      return acc + salario + vt + vr;
    }, 0);

    const confirmar = window.confirm(
      `Deseja lançar a Folha de Pagamento do mês ${mes}/${ano} no valor total de ${formatBRL(
        totalFolhaGeral
      )} no Contas a Pagar com vencimento para ${formatData(dataVencimentoFolha)}?\n\n(Baseada exclusivamente nos colaboradores ativos com valores cadastrados)`
    );
    if (!confirmar) return;

    try {
      await api.criarTransacaoFinanceira({
        empresa_id: empresaId,
        tipo: 'DESPESA',
        descricao: `Folha de Pagamento & Comissões — Mês ${mes}/${ano}`,
        categoria: 'FOLHA_PAGAMENTO',
        valor: totalFolhaGeral,
        data_vencimento: dataVencimentoFolha,
        status: 'PENDENTE',
        forma_pagamento: 'TED / Transferência',
        observacoes: `Lançamento automático de folha (${usuariosAtivos.length} colaboradores ativos).`,
      });
      dispararFeedback(
        `Folha de ${formatBRL(
          totalFolhaGeral
        )} agendada com sucesso no Contas a Pagar para ${formatData(dataVencimentoFolha)}!`
      );
    } catch {
      alert('Erro ao agendar folha no financeiro.');
    }
  };

  // Salvar Escala / Férias
  const handleSalvarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalaUsuarioId) {
      alert('Selecione o colaborador.');
      return;
    }
    const usr = usuarios.find((u) => u.id === escalaUsuarioId);
    const nova = await api.salvarEscalaFolga({
      empresa_id: empresaId,
      usuario_id: escalaUsuarioId,
      usuario_nome: usr?.nome || 'Colaborador',
      tipo: escalaTipo,
      data_inicio: escalaInicio,
      data_fim: escalaFim,
      observacoes: escalaObs.trim() || null,
    });
    setEscalas((prev) => [nova, ...prev]);
    setModalEscalaAberto(false);
    dispararFeedback(`Período de ${escalaTipo} agendado para ${usr?.nome}!`);
  };

  // Bater Ponto Eletrônico com Trava GPS
  const handleBaterPonto = () => {
    if (!navigator.geolocation) {
      alert('Seu navegador não suporta geolocalização para registro de ponto.');
      return;
    }

    setRegistrandoPonto(true);
    setPontoFeedback(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        const distancia = calcularDistanciaMetros(
          userLat,
          userLon,
          coordsOficina.lat,
          coordsOficina.lon
        );

        const dentroRaio = distancia <= coordsOficina.raio;
        const agora = new Date();
        const dataStr = agora.toISOString().slice(0, 10);
        const horaStr = agora.toTimeString().slice(0, 5);

        const novoPonto = await api.registrarPonto({
          empresa_id: empresaId,
          usuario_id: user?.id || 'usr-atual',
          usuario_nome: user?.nome || 'Colaborador',
          data: dataStr,
          hora: horaStr,
          tipo: 'ENTRADA',
          latitude: userLat,
          longitude: userLon,
          dentro_raio: dentroRaio,
          distancia_metros: distancia,
        });

        setPontos((prev) => [novoPonto, ...prev]);
        setRegistrandoPonto(false);

        if (dentroRaio) {
          setPontoFeedback({
            sucesso: true,
            msg: `Ponto registrado com sucesso às ${horaStr}! Você está a ${distancia}m da oficina (dentro do raio permitido).`,
          });
        } else {
          setPontoFeedback({
            sucesso: false,
            msg: `Ponto registrado fora do raio da oficina! Distância calculada: ${distancia}m (tolerância máxima: ${coordsOficina.raio}m). Marcado como irregular para conferência do gestor.`,
          });
        }
      },
      (err) => {
        setRegistrandoPonto(false);
        alert(
          `Falha ao obter geolocalização: ${err.message}. Ative a permissão de GPS no seu celular.`
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!isGestor) {
    return (
      <div className="bg-[#111827] border-2 border-red-900/60 rounded-2xl p-6 sm:p-10 max-w-xl mx-auto my-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-950/80 border-2 border-red-500 text-red-400 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-white">Acesso Restrito à Gestão</h1>
        <p className="text-sm text-slate-300">
          O módulo de Equipe &amp; RH contém informações salariais e de gestão da oficina. Seu perfil atual (<strong>{user?.cargo || 'Colaborador'}</strong>) não possui permissão para visualizar ou editar estes dados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* CABEÇALHO DA EQUIPE & RH */}
      <header className="bg-[#111827] border-2 border-[#1E293B] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E3A8A] border-2 border-[#F97316] text-[#F97316] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Equipe &amp; Recursos Humanos</span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-blue-950 border border-blue-500 text-[11px] font-mono font-bold text-blue-300">
                {usuariosAtivos.length} Colaboradores
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Cargos, salários, comissões, convites WhatsApp, folha de pagamento, escalas de folga e ponto eletrônico.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={carregarTudo}
            disabled={carregando}
            title="Atualizar dados da equipe"
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#0B0F17] hover:bg-[#1E293B] border border-[#334155] text-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-[#F97316]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              handleGerarConvite();
              setModalConviteAberto(true);
            }}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Convidar no WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={abrirModalCadastroColaborador}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-950/40"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Novo Colaborador</span>
          </button>
        </div>
      </header>

      {/* FEEDBACK DE SUCESSO / ERRO */}
      <div aria-live="polite">
        {sucessoMsg && (
          <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{sucessoMsg}</span>
          </div>
        )}
        {erro && (
          <div className="p-3 rounded-xl bg-red-950 border border-red-500 text-red-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
      </div>

      {/* 5 ABAS DA EQUIPE */}
      <nav
        aria-label="Abas da Equipe"
        className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 bg-[#0B0F17] p-1.5 rounded-2xl border-2 border-[#1E293B]"
      >
        <button
          type="button"
          onClick={() => setActiveTab('colaboradores')}
          className={`min-h-[44px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'colaboradores'
              ? 'bg-[#F97316] text-[#0B0F17]'
              : 'text-slate-300 hover:bg-[#1E293B]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Colaboradores</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('folha')}
          className={`min-h-[44px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'folha'
              ? 'bg-[#F97316] text-[#0B0F17]'
              : 'text-slate-300 hover:bg-[#1E293B]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Folha &amp; Holerites</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('escalas')}
          className={`min-h-[44px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'escalas'
              ? 'bg-[#F97316] text-[#0B0F17]'
              : 'text-slate-300 hover:bg-[#1E293B]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Escalas &amp; Férias</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ponto')}
          className={`min-h-[44px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'ponto'
              ? 'bg-[#F97316] text-[#0B0F17]'
              : 'text-slate-300 hover:bg-[#1E293B]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Ponto Eletrônico</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('avaliacoes')}
          className={`col-span-2 sm:col-span-1 min-h-[44px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'avaliacoes'
              ? 'bg-[#F97316] text-[#0B0F17]'
              : 'text-slate-300 hover:bg-[#1E293B]'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Avaliações (★)</span>
        </button>
      </nav>

      {/* ========================================================
          ABA 1: QUADRO DE COLABORADORES
          ======================================================== */}
      {activeTab === 'colaboradores' && (
        <div className="space-y-3">
          {usuariosInativos.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400 bg-[#0B0F17]/70 border border-[#1E293B] px-3.5 py-2 rounded-xl">
              <span>
                Exibindo <strong>{usuariosAtivos.length}</strong> colaboradores ativos
                {mostrarInativos && ` e ${usuariosInativos.length} desativado(s)`}.
              </span>
              <button
                type="button"
                onClick={() => setMostrarInativos((p) => !p)}
                className="text-[#F97316] hover:text-[#EA580C] font-bold text-xs cursor-pointer flex items-center gap-1 transition-colors"
              >
                {mostrarInativos
                  ? 'Ocultar Desativados'
                  : `Ver Desativados (${usuariosInativos.length})`}
              </button>
            </div>
          )}

          <div className="bg-[#0B0F17] border-2 border-[#334155] rounded-xl divide-y divide-[#1E293B]">
            {colaboradoresVisiveis.map((u) => {
              const estrelas = u.estrelas_media ?? 5.0;
              const temSalario = u.salario_base && u.salario_base > 0;

              return (
                <article
                  key={u.id}
                  className="p-3 sm:px-4 sm:py-3 hover:bg-[#111827]/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 sm:flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1E293B] text-blue-300 border border-blue-500/60 uppercase">
                        {u.cargo}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          u.ativo !== false
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                            : 'bg-red-950 text-red-300 border border-red-600'
                        }`}
                      >
                        {u.ativo !== false ? 'ATIVO' : 'DESATIVADO'}
                      </span>
                      <div className="flex items-center gap-1 bg-amber-950/60 border border-amber-600 px-2 py-0.5 rounded text-[10px] text-amber-300 font-bold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{estrelas.toFixed(1)}</span>
                        <span className="text-slate-400">({u.total_avaliacoes || 0})</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white leading-snug">{u.nome}</h3>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 font-mono">
                      <span>{u.email}</span>
                      {u.telefone && <span>&bull; {u.telefone}</span>}
                    </div>
                  </div>

                  {/* Lado Direito: Salário, Comissões e Ações */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1E293B]">
                    <div className="text-right font-mono tabular-nums text-xs">
                      <div className="text-slate-400 text-[10px]">Salário Base</div>
                      <div className="text-sm font-bold text-white">
                        {temSalario ? (
                          formatBRL(u.salario_base!)
                        ) : (
                          <span className="text-amber-400 font-sans text-xs font-normal">
                            Não informado
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        Comissão: {u.comissao_servico_pct ?? parametrosFolha.comissao_global_servico_pct}% M.O. &bull;{' '}
                        {u.comissao_peca_pct ?? parametrosFolha.comissao_global_peca_pct}% Peças
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setColaboradorHolerite(u);
                          setModalHoleriteAberto(true);
                        }}
                        title="Ver Holerite"
                        className="h-8 px-2.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-slate-600 text-blue-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Holerite</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirModalEdicaoColaborador(u)}
                        title="Editar Colaborador & RH"
                        className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-slate-600 text-amber-300 flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {u.ativo !== false ? (
                        <button
                          type="button"
                          onClick={() => handleExcluirColaborador(u)}
                          title="Excluir Colaborador (Exclusão Lógica)"
                          className="w-8 h-8 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReativarColaborador(u)}
                          title="Reativar Colaborador"
                          className="h-8 px-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 flex items-center gap-1 text-xs font-bold cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Reativar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 2: FOLHA DE PAGAMENTO & HOLERITES AUTOMÁTICOS
          ======================================================== */}
      {activeTab === 'folha' && (
        <div className="space-y-4">
          {/* BARRA DE CONTROLE DA FOLHA */}
          <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#F97316]" />
                <span>Fechamento da Folha de Pagamento</span>
              </h3>
              <p className="text-xs text-slate-400">
                Dia oficial de pagamento da oficina: <strong>Dia {parametrosFolha.dia_pagamento}</strong> (Adiantamento: Dia {parametrosFolha.dia_adiantamento})
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                type="month"
                value={mesFolhaRef}
                onChange={(e) => setMesFolhaRef(e.target.value)}
                className="min-h-[40px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-xs"
              />

              <button
                type="button"
                onClick={handleLancarFolhaContasPagar}
                className="min-h-[40px] px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Lançar Folha no Contas a Pagar</span>
              </button>
            </div>
          </div>

          {/* LISTA DA FOLHA DOS COLABORADORES (APENAS ATIVOS) */}
          <div className="bg-[#0B0F17] border-2 border-[#334155] rounded-xl divide-y divide-[#1E293B]">
            {usuariosAtivos.map((u) => {
              const temSalario = u.salario_base && u.salario_base > 0;
              const salarioBase = temSalario ? u.salario_base! : 0;
              const comissaoMO = 0; // Sem comissões fictícias
              const comissaoPeca = 0;
              const vt = u.vale_transporte || 0;
              const vr = u.vale_refeicao || 0;
              const totalLiquido = salarioBase + comissaoMO + comissaoPeca + vt + vr;

              return (
                <div
                  key={u.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#111827]/70 text-xs font-mono tabular-nums"
                >
                  <div className="font-sans">
                    <strong className="text-sm font-bold text-white block">{u.nome}</strong>
                    <span className="text-xs text-slate-400">{u.cargo}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-right">
                    <div>
                      <div className="text-[10px] text-slate-400 font-sans">Base</div>
                      <div className="text-slate-200">
                        {temSalario ? (
                          formatBRL(salarioBase)
                        ) : (
                          <span className="text-amber-400 font-sans text-xs">Não informado</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-emerald-400 font-sans">Comissões (OS)</div>
                      <div className="text-emerald-400 font-bold">
                        +{formatBRL(comissaoMO + comissaoPeca)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-blue-400 font-sans">VT / VR</div>
                      <div className="text-blue-300">+{formatBRL(vt + vr)}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-[#F97316] font-sans font-bold">Líquido a Pagar</div>
                      <div className="text-base font-black text-white">
                        {temSalario || totalLiquido > 0 ? (
                          formatBRL(totalLiquido)
                        ) : (
                          <span className="text-amber-400 font-sans text-xs">Não informado</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setColaboradorHolerite(u);
                        setModalHoleriteAberto(true);
                      }}
                      className="min-h-[36px] px-3 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white font-sans font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Ver Holerite</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 3: MONTADOR DE ESCALAS & CALENDÁRIO DE FÉRIAS
          ======================================================== */}
      {activeTab === 'escalas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span>Escalas de Trabalho &amp; Calendário de Férias</span>
              </h3>
              <p className="text-xs text-slate-400">
                Evite desfalque nos boxes planejando com antecedência as férias e folgas da equipe.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalEscalaAberto(true)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Calendar className="w-4 h-4" />
              <span>+ Agendar Férias / Folga</span>
            </button>
          </div>

          {/* LISTA DE FÉRIAS E ESCALAS */}
          {escalas.length === 0 ? (
            <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-8 text-center text-slate-400 space-y-2">
              <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-white">Nenhuma escala ou férias agendadas</p>
              <p className="text-xs text-slate-400">
                Clique no botão acima para agendar o período de descanso de um colaborador.
              </p>
            </div>
          ) : (
            <div className="bg-[#0B0F17] border-2 border-[#334155] rounded-xl divide-y divide-[#1E293B]">
              {escalas.map((esc) => (
                <div
                  key={esc.id}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-600 uppercase">
                        {esc.tipo}
                      </span>
                      <strong className="text-sm font-bold text-white">{esc.usuario_nome}</strong>
                    </div>
                    <div className="text-slate-400 font-mono">
                      Período: <strong className="text-white">{formatData(esc.data_inicio)}</strong> até{' '}
                      <strong className="text-white">{formatData(esc.data_fim)}</strong>
                      {esc.observacoes && <span className="ml-2">&bull; {esc.observacoes}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await api.deletarEscalaFolga(empresaId, esc.id);
                      setEscalas((prev) => prev.filter((e) => e.id !== esc.id));
                      dispararFeedback('Período removido com sucesso.');
                    }}
                    title="Remover Agendamento"
                    className="p-2 rounded-lg bg-red-950 text-red-300 hover:bg-red-900 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          ABA 4: PONTO ELETRÔNICO MOBILE COM GEOLOCALIZAÇÃO
          ======================================================== */}
      {activeTab === 'ponto' && (
        <div className="space-y-4">
          {/* CARD DE BATIDA DE PONTO MOBILE */}
          <div className="bg-gradient-to-br from-[#1E3A8A]/50 to-[#111827] border-2 border-blue-500 rounded-2xl p-5 sm:p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-900/50">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Ponto Eletrônico por Geolocalização</h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                Bata seu ponto diretamente pelo celular. O sistema valida automaticamente se você está dentro do raio de{' '}
                <strong>{coordsOficina.raio}m</strong> da oficina.
              </p>
            </div>

            <button
              type="button"
              disabled={registrandoPonto}
              onClick={handleBaterPonto}
              className="min-h-[50px] px-8 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-black text-base inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-950/40 disabled:opacity-50"
            >
              <Navigation className="w-5 h-5 stroke-[2.5]" />
              <span>{registrandoPonto ? 'Verificando GPS…' : 'Bater Ponto Agora'}</span>
            </button>

            {pontoFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs sm:text-sm font-bold max-w-lg mx-auto ${
                  pontoFeedback.sucesso
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                    : 'bg-red-950/80 border-red-500 text-red-200'
                }`}
              >
                {pontoFeedback.msg}
              </div>
            )}
          </div>

          {/* HISTÓRICO DE PONTOS REGISTRADOS */}
          <div className="bg-[#111827] border-2 border-[#1E293B] rounded-2xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Últimos Registros de Ponto</span>
            </h4>

            {pontos.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Nenhum ponto registrado hoje.</p>
            ) : (
              <div className="bg-[#0B0F17] rounded-xl border border-[#334155] divide-y divide-[#1E293B]">
                {pontos.slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 flex items-center justify-between text-xs font-mono tabular-nums"
                  >
                    <div>
                      <strong className="text-white font-sans block">{p.usuario_nome}</strong>
                      <span className="text-slate-400">
                        {formatData(p.data)} às {p.hora} &bull; {p.tipo}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.dentro_raio
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                            : 'bg-red-950 text-red-300 border border-red-600'
                        }`}
                      >
                        {p.dentro_raio ? 'NO RAIO DA OFICINA' : `FORA (${p.distancia_metros}m)`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 5: AVALIAÇÕES DOS CLIENTES (NPS / 5 ESTRELAS)
          ======================================================== */}
      {activeTab === 'avaliacoes' && (
        <div className="space-y-4">
          <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>Avaliações dos Clientes por Atendimento</span>
              </h3>
              <p className="text-xs text-slate-400">
                Feedback direto dos clientes ao receberem a Ordem de Serviço concluída pelo WhatsApp.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/?modo=avaliar&osId=EXEMPLO-OS`;
                window.open(url, '_blank');
              }}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-[#475569]"
            >
              <Star className="w-4 h-4 fill-amber-400" />
              <span>Ver Tela Pública de Avaliação</span>
            </button>
          </div>

          {/* LISTA DE DEPOIMENTOS & NOTAS */}
          {avaliacoes.length === 0 ? (
            <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-8 text-center text-slate-400 space-y-2">
              <Star className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-white">Nenhuma avaliação recebida ainda</p>
              <p className="text-xs text-slate-400">
                Assim que os clientes clicarem no link do WhatsApp após a retirada do veículo, as notas e elogios aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {avaliacoes.map((av) => (
                <div
                  key={av.id}
                  className="bg-[#0B0F17] border border-[#334155] rounded-xl p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= av.nota ? 'fill-amber-400' : 'text-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">{formatData(av.data)}</span>
                  </div>

                  <div>
                    <strong className="text-white block text-sm">{av.cliente_nome}</strong>
                    <span className="text-slate-400">
                      {av.veiculo_modelo} &bull; {av.veiculo_placa} &bull; Mecânico:{' '}
                      <strong className="text-blue-300">{av.mecanico_nome || 'Equipe'}</strong>
                    </span>
                  </div>

                  {av.comentario && (
                    <p className="text-slate-200 italic bg-[#111827] p-2.5 rounded-lg border border-[#1E293B]">
                      &ldquo;{av.comentario}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CONVITE POR WHATSAPP & E-MAIL */}
      {modalConviteAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111827] border-2 border-emerald-500 rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <span>Convidar Colaborador por WhatsApp</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalConviteAberto(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-200 mb-1">Nome do Colaborador</label>
                <input
                  type="text"
                  value={nomeConvite}
                  onChange={(e) => setNomeConvite(e.target.value)}
                  placeholder="Ex: Carlos Mecânico"
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">WhatsApp (DDD + Número)</label>
                <input
                  type="tel"
                  value={telConvite}
                  onChange={(e) => setTelConvite(e.target.value)}
                  placeholder="Ex: 11999998888"
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Cargo a Atribuir</label>
                <select
                  value={cargoConvite}
                  onChange={(e) => setCargoConvite(e.target.value as CargoUsuario)}
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-bold"
                >
                  {CARGOS_DISPONIVEIS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleEnviarConviteWhatsApp}
                  className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>Enviar Convite no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO / EDIÇÃO DE COLABORADOR */}
      {modalColaboradorAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#111827] border-2 border-[#F97316] rounded-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#F97316]" />
                <span>{colaboradorEmEdicao ? 'Editar Colaborador & RH' : 'Novo Colaborador'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalColaboradorAberto(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarColaborador} className="space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">E-mail de Acesso *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    value={formTelefone}
                    onChange={(e) => setFormTelefone(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">Cargo *</label>
                  <select
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value as CargoUsuario)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-bold"
                  >
                    {CARGOS_DISPONIVEIS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Salário Base (R$)</label>
                  <input
                    type="number"
                    value={formSalario}
                    onChange={(e) => setFormSalario(e.target.value)}
                    placeholder="Ex: 2800.00 (opcional)"
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">Comissão M.O. (%)</label>
                  <input
                    type="number"
                    value={formComissaoServico}
                    onChange={(e) => setFormComissaoServico(e.target.value)}
                    placeholder="Ex: 15"
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">Comissão Peças (%)</label>
                  <input
                    type="number"
                    value={formComissaoPeca}
                    onChange={(e) => setFormComissaoPeca(e.target.value)}
                    placeholder="Ex: 5"
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Vale Transporte (R$)</label>
                  <input
                    type="number"
                    value={formVT}
                    onChange={(e) => setFormVT(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">Vale Refeição (R$)</label>
                  <input
                    type="number"
                    value={formVR}
                    onChange={(e) => setFormVR(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">
                  {colaboradorEmEdicao ? 'Nova Senha (deixe vazio p/ manter)' : 'Senha Inicial'}
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formSenha}
                  onChange={(e) => setFormSenha(e.target.value)}
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#1E293B]">
                {colaboradorEmEdicao ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModalColaboradorAberto(false);
                      handleExcluirColaborador(colaboradorEmEdicao);
                    }}
                    className="min-h-[42px] px-3.5 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer mr-auto transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Desativar</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalColaboradorAberto(false)}
                    className="min-h-[42px] px-4 rounded-xl bg-[#1E293B] text-white font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="min-h-[42px] px-5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-extrabold cursor-pointer"
                  >
                    Salvar Colaborador
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HOLERITE / DEMONSTRATIVO DE PAGAMENTO IMPRIMÍVEL */}
      {modalHoleriteAberto && colaboradorHolerite && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#111827] border-2 border-blue-500 rounded-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 print:hidden">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span>Demonstrativo de Pagamento (Holerite)</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalHoleriteAberto(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ÁREA DO HOLERITE IMPRIMÍVEL */}
            <div
              id="holerite-impressao"
              className="bg-white text-black p-5 rounded-xl border-2 border-black space-y-4 font-mono text-xs select-all"
            >
              <div className="text-center border-b-2 border-black pb-2">
                <h2 className="text-base font-black uppercase">AUTOTEC PRO &bull; OFICINA MECÂNICA</h2>
                <div className="text-[11px] font-bold">RECIBO DE PAGAMENTO DE SALÁRIO E COMISSÕES</div>
                <div className="text-[10px]">Mês de Referência: {mesFolhaRef}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-black pb-2 text-[11px]">
                <div>
                  <strong>Colaborador:</strong> {colaboradorHolerite.nome}
                </div>
                <div>
                  <strong>Cargo:</strong> {colaboradorHolerite.cargo}
                </div>
                <div>
                  <strong>E-mail:</strong> {colaboradorHolerite.email}
                </div>
                <div>
                  <strong>Data de Pagamento:</strong> Dia {parametrosFolha.dia_pagamento}
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black text-[10px] uppercase font-bold">
                    <th className="py-1">Descrição</th>
                    <th className="py-1 text-right">Proventos (R$)</th>
                    <th className="py-1 text-right">Descontos (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  <tr>
                    <td className="py-1">Salário Base Mensal</td>
                    <td className="py-1 text-right">
                      {colaboradorHolerite.salario_base && colaboradorHolerite.salario_base > 0
                        ? formatBRL(colaboradorHolerite.salario_base)
                        : 'Não informado'}
                    </td>
                    <td className="py-1 text-right">—</td>
                  </tr>
                  <tr>
                    <td className="py-1">
                      Comissão Mão de Obra ({colaboradorHolerite.comissao_servico_pct ?? 0}%)
                    </td>
                    <td className="py-1 text-right">{formatBRL(0.0)}</td>
                    <td className="py-1 text-right">—</td>
                  </tr>
                  <tr>
                    <td className="py-1">
                      Comissão Peças ({colaboradorHolerite.comissao_peca_pct ?? 0}%)
                    </td>
                    <td className="py-1 text-right">{formatBRL(0.0)}</td>
                    <td className="py-1 text-right">—</td>
                  </tr>
                  {colaboradorHolerite.vale_transporte && colaboradorHolerite.vale_transporte > 0 ? (
                    <tr>
                      <td className="py-1">Auxílio Transporte (VT)</td>
                      <td className="py-1 text-right">
                        {formatBRL(colaboradorHolerite.vale_transporte)}
                      </td>
                      <td className="py-1 text-right">—</td>
                    </tr>
                  ) : null}
                  {colaboradorHolerite.vale_refeicao && colaboradorHolerite.vale_refeicao > 0 ? (
                    <tr>
                      <td className="py-1">Auxílio Refeição (VR)</td>
                      <td className="py-1 text-right">
                        {formatBRL(colaboradorHolerite.vale_refeicao)}
                      </td>
                      <td className="py-1 text-right">—</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="border-t-2 border-black pt-2 flex items-center justify-between text-sm font-black">
                <span>VALOR LÍQUIDO A RECEBER:</span>
                <span className="text-base">
                  {colaboradorHolerite.salario_base && colaboradorHolerite.salario_base > 0
                    ? formatBRL(
                        colaboradorHolerite.salario_base +
                          (colaboradorHolerite.vale_transporte || 0) +
                          (colaboradorHolerite.vale_refeicao || 0)
                      )
                    : (colaboradorHolerite.vale_transporte || 0) + (colaboradorHolerite.vale_refeicao || 0) > 0
                    ? formatBRL(
                        (colaboradorHolerite.vale_transporte || 0) +
                          (colaboradorHolerite.vale_refeicao || 0)
                      )
                    : 'Não informado'}
                </span>
              </div>

              <div className="pt-8 border-t border-dashed border-black text-center text-[10px]">
                ____________________________________________________
                <br />
                Assinatura do Colaborador: {colaboradorHolerite.nome}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 print:hidden pt-2">
              <button
                type="button"
                onClick={() => setModalHoleriteAberto(false)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#1E293B] text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[40px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Holerite</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGENDAR ESCALA / FÉRIAS */}
      {modalEscalaAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111827] border-2 border-blue-500 rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span>Agendar Férias / Folga de Colaborador</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalEscalaAberto(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarEscala} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-200 mb-1">Colaborador *</label>
                <select
                  required
                  value={escalaUsuarioId}
                  onChange={(e) => setEscalaUsuarioId(e.target.value)}
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-bold"
                >
                  <option value="">Selecione o profissional…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.cargo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Tipo de Período *</label>
                <select
                  value={escalaTipo}
                  onChange={(e) => setEscalaTipo(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-bold"
                >
                  <option value="FERIAS">Férias</option>
                  <option value="FOLGA">Folga / Escala Revezamento</option>
                  <option value="ATESTADO">Atestado Médico / Licença</option>
                  <option value="PLANTAO">Plantão Extra</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Data Início *</label>
                  <input
                    type="date"
                    required
                    value={escalaInicio}
                    onChange={(e) => setEscalaInicio(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">Data Fim *</label>
                  <input
                    type="date"
                    required
                    value={escalaFim}
                    onChange={(e) => setEscalaFim(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Observações</label>
                <input
                  type="text"
                  value={escalaObs}
                  onChange={(e) => setEscalaObs(e.target.value)}
                  placeholder="Ex: 15 dias de férias aprovadas…"
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setModalEscalaAberto(false)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#1E293B] text-white font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                >
                  Salvar Período
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
