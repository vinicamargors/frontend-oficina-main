import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { dataLocalISO, hojeLocalISO } from '../lib/data';
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
  Printer,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  Send,
  RefreshCw,
  RotateCcw,
  UserX,
  Navigation,
} from 'lucide-react';
import { useTourDaPagina } from '../tour/useTourDaPagina';
import { TOUR_EQUIPE } from '../tour/passos/equipe';
import { Button, CLASSE_CAMPO, Field, PageHeader, Panel, Skeleton, type TabItem } from '../components/ui';
import { Folha } from '../components/Folha';
import { AbasEquipe } from './equipe/AbasEquipe';
import { LinhaColaborador, COLUNAS_COLABORADOR } from './equipe/LinhaColaborador';
import { AbaFolha } from './equipe/AbaFolha';
import { AbaEscalas } from './equipe/AbaEscalas';
import { AbaPonto } from './equipe/AbaPonto';
import { AbaAvaliacoes } from './equipe/AbaAvaliacoes';
import {
  calcularDistanciaMetros,
  formatBRL,
  formatData,
  formatMesExtenso,
  identidadeHolerite,
  rotuloCargo,
  rotuloTipoEscala,
  totalFolhaColaborador,
  vencimentoFolha,
} from './equipe/auxiliares';

interface EquipeProps {
  empresaId: string;
}

type TabEquipe = 'colaboradores' | 'folha' | 'escalas' | 'ponto' | 'avaliacoes';

// Rótulos curtos: as cinco abas cabem (ou rolam dentro da faixa) numa linha no celular
const ABAS: TabItem[] = [
  { id: 'colaboradores', rotulo: 'Equipe' },
  { id: 'folha', rotulo: 'Folha' },
  { id: 'escalas', rotulo: 'Escalas' },
  { id: 'ponto', rotulo: 'Ponto' },
  { id: 'avaliacoes', rotulo: 'Avaliações' },
];

const CARGOS_DISPONIVEIS: { id: CargoUsuario; label: string; desc: string }[] = [
  { id: 'MECANICO', label: 'Mecânico / técnico', desc: 'Acessa pátio e lança serviços nas OS' },
  { id: 'ATENDENTE', label: 'Atendente / recepção', desc: 'Atende clientes e abre orçamentos' },
  { id: 'FINANCEIRO', label: 'Financeiro', desc: 'Acesso total a caixa, DRE e pagamentos' },
  { id: 'DONO', label: 'Dono / administrador', desc: 'Controle total da oficina e equipe' },
];

export function Equipe({ empresaId }: EquipeProps) {
  const { user } = useAuth();
  const isGestor = user?.cargo === 'DONO' || user?.cargo === 'master';
  const [activeTab, setActiveTab] = useState<TabEquipe>('colaboradores');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [escalas, setEscalas] = useState<EscalaFolga[]>([]);
  const [pontos, setPontos] = useState<RegistroPonto[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoOS[]>([]);
  const [parametrosFolha, setParametrosFolha] = useState<ParametrosFolha>({
    dia_pagamento: 5,
    dia_adiantamento: 20,
    comissao_global_servico_pct: 15,
    comissao_global_peca_pct: 5,
    paga_hora_extra_padrao: true,
    valor_hora_extra_padrao: 25,
  });
  const [coordsOficina, setCoordsOficina] = useState<{
    lat: number;
    lon: number;
    raio: number;
  }>({ lat: -23.55052, lon: -46.633308, raio: 150 });

  // Identidade da oficina impressa no holerite (vem de obterConfiguracoesOficina, já carregado abaixo)
  const [identidadeOficina, setIdentidadeOficina] = useState(() => identidadeHolerite(null));

  const [carregando, setCarregando] = useState(true);
  // Primeira carga concluída: até lá as abas mostram esqueleto (nunca área em branco)
  const [carregado, setCarregado] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  // Erro da carga da página e erro do formulário do colaborador são independentes
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Mês de referência da Folha
  const [mesFolhaRef, setMesFolhaRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modais (folhas) e confirmações
  const [modalColaboradorAberto, setModalColaboradorAberto] = useState(false);
  const [colaboradorEmEdicao, setColaboradorEmEdicao] = useState<Usuario | null>(null);
  const [modalConviteAberto, setModalConviteAberto] = useState(false);
  const [linkConviteGerado, setLinkConviteGerado] = useState('');
  const [cargoConvite, setCargoConvite] = useState<CargoUsuario>('MECANICO');
  const [nomeConvite, setNomeConvite] = useState('');
  const [telConvite, setTelConvite] = useState('');
  const [colaboradorParaDesativar, setColaboradorParaDesativar] = useState<Usuario | null>(null);
  const [colaboradorParaReativar, setColaboradorParaReativar] = useState<Usuario | null>(null);
  const [confirmarFolhaAberto, setConfirmarFolhaAberto] = useState(false);
  const [escalaParaExcluir, setEscalaParaExcluir] = useState<EscalaFolga | null>(null);
  const [confirmarPontoAberto, setConfirmarPontoAberto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erroFolha, setErroFolha] = useState<string | null>(null);
  // Saída pendente de confirmação ("Descartar alterações?") quando o formulário do colaborador tem dados não salvos
  const [saidaPendente, setSaidaPendente] = useState<(() => void) | null>(null);
  const [formInicial, setFormInicial] = useState('');
  const [salvandoColaborador, setSalvandoColaborador] = useState(false);

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
  // Uma lista só: ativos e, por último, os desativados (sem precisar alternar filtro)
  const colaboradoresVisiveis = useMemo(
    () => [...usuariosAtivos, ...usuariosInativos],
    [usuariosAtivos, usuariosInativos]
  );

  // Modal Holerite
  const [modalHoleriteAberto, setModalHoleriteAberto] = useState(false);
  const [colaboradorHolerite, setColaboradorHolerite] = useState<Usuario | null>(null);

  // Modal Escala / Férias
  const [modalEscalaAberto, setModalEscalaAberto] = useState(false);
  const [escalaUsuarioId, setEscalaUsuarioId] = useState('');
  const [escalaTipo, setEscalaTipo] = useState<'FERIAS' | 'FOLGA' | 'ATESTADO' | 'PLANTAO'>(
    'FERIAS'
  );
  const [escalaInicio, setEscalaInicio] = useState(hojeLocalISO);
  const [escalaFim, setEscalaFim] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return dataLocalISO(d);
  });
  const [escalaObs, setEscalaObs] = useState('');
  const [erroEscala, setErroEscala] = useState<string | null>(null);
  const [salvandoEscala, setSalvandoEscala] = useState(false);

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
      setErroCarga(null);
      const [users, cfgOficina, escalasData, pontosData, avsData, paramsFolha] = await Promise.all([
        api.listarUsuarios(empresaId),
        api.obterConfiguracoesOficina(empresaId),
        api.listarEscalasFolgas(empresaId),
        api.listarPontos(empresaId),
        api.listarAvaliacoesOS(empresaId),
        api.obterParametrosFolha(empresaId),
      ]);
      setUsuarios(users);
      setEscalas(escalasData);
      setPontos(pontosData);
      setAvaliacoes(avsData);
      setParametrosFolha(paramsFolha);
      setIdentidadeOficina(identidadeHolerite(cfgOficina));

      if (cfgOficina.latitude_gps && cfgOficina.longitude_gps) {
        setCoordsOficina({
          lat: cfgOficina.latitude_gps,
          lon: cfgOficina.longitude_gps,
          raio: cfgOficina.raio_gps_metros || 150,
        });
      }
    } catch (e) {
      const err = e as Error;
      setErroCarga(err.message || 'Erro ao carregar equipe.');
    } finally {
      setCarregando(false);
      setCarregado(true);
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
    setErroForm(null);
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
    setErroForm(null);
    setModalColaboradorAberto(true);
  };

  // Formulário do colaborador: com dados digitados, Esc/Cancelar pedem confirmação em vez de descartar em silêncio
  const valoresForm = JSON.stringify([
    formNome,
    formEmail,
    formTelefone,
    formCargo,
    formSenha,
    formSalario,
    formComissaoServico,
    formComissaoPeca,
    formVT,
    formVR,
    formPagaHE,
    formValorHE,
  ]);
  useEffect(() => {
    // Ao abrir, guarda os valores iniciais (os setters de abertura já foram aplicados neste render)
    if (modalColaboradorAberto) setFormInicial(valoresForm);
    else setSaidaPendente(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalColaboradorAberto]);
  const colaboradorSujo = modalColaboradorAberto && formInicial !== '' && valoresForm !== formInicial;

  const fecharModalColaborador = () => {
    setSaidaPendente(null);
    setFormInicial('');
    setErroForm(null);
    setModalColaboradorAberto(false);
  };
  // Sai do formulário (e depois faz `depois`, se houver); com dados alterados, pergunta antes
  const sairDoFormulario = (depois?: () => void) => {
    const sair = () => {
      fecharModalColaborador();
      depois?.();
    };
    if (colaboradorSujo) setSaidaPendente(() => sair);
    else sair();
  };

  const abrirHolerite = (u: Usuario) => {
    setColaboradorHolerite(u);
    setModalHoleriteAberto(true);
  };

  // Exclusão Lógica (Desativar Colaborador) — confirmada na folha "Desativar colaborador?"
  const handleExcluirColaborador = async (u: Usuario) => {
    try {
      setProcessando(true);
      await api.desativarUsuario(empresaId, u.id);
      setUsuarios((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, ativo: false } : item))
      );
      setColaboradorParaDesativar(null);
      dispararFeedback(`Colaborador "${u.nome}" desativado com sucesso!`);
    } catch (e) {
      const err = e as Error;
      setErroFolha(`Erro ao desativar colaborador: ${err.message}`);
    } finally {
      setProcessando(false);
    }
  };

  // Reativação de Colaborador — confirmada na folha "Reativar colaborador?"
  const handleReativarColaborador = async (u: Usuario) => {
    try {
      setProcessando(true);
      await api.reativarUsuario(empresaId, u.id);
      setUsuarios((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, ativo: true } : item))
      );
      setColaboradorParaReativar(null);
      dispararFeedback(`Colaborador "${u.nome}" reativado com sucesso!`);
    } catch (e) {
      const err = e as Error;
      setErroFolha(`Erro ao reativar colaborador: ${err.message}`);
    } finally {
      setProcessando(false);
    }
  };

  // Salvar Colaborador (mensagens de validação e de erro aparecem dentro da folha, sem alert)
  const handleSalvarColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);
    if (!formNome.trim() || !formEmail.trim()) {
      setErroForm('Preencha nome e e-mail.');
      return;
    }

    if (!isGestor) {
      setErroForm('Acesso negado: apenas o dono ou administrador pode criar ou editar colaboradores.');
      return;
    }

    if (formSenha.trim() && formSenha.trim().length < 6) {
      setErroForm('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    const salarioNum = formSalario.trim() ? parseFloat(formSalario) : null;
    const comissaoServicoNum = formComissaoServico.trim() ? parseFloat(formComissaoServico) : 0;
    const comissaoPecaNum = formComissaoPeca.trim() ? parseFloat(formComissaoPeca) : 0;
    const vtNum = formVT.trim() ? parseFloat(formVT) : 0;
    const vrNum = formVR.trim() ? parseFloat(formVR) : 0;
    const heNum = formValorHE.trim() ? parseFloat(formValorHE) : 0;

    try {
      setSalvandoColaborador(true);
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
      fecharModalColaborador();
    } catch (e) {
      const err = e as Error;
      setErroForm(`Erro ao salvar colaborador: ${err.message || 'Verifique os dados.'}`);
    } finally {
      setSalvandoColaborador(false);
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
    const msg = `Olá ${nomeConvite || 'Colaborador'}, você foi convidado para a equipe no Mecanify (${cargoConvite}). Crie sua senha e acesse seu painel aqui: ${linkConviteGerado}`;
    const waUrl = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Automação: Lançar Folha no Contas a Pagar (Sem dados fictícios) — valores mostrados na folha de confirmação
  const [anoFolha, mesFolha] = mesFolhaRef.split('-');
  const dataVencimentoFolha = vencimentoFolha(mesFolhaRef, parametrosFolha.dia_pagamento);
  const totalFolhaGeral = usuariosAtivos.reduce((acc, u) => acc + totalFolhaColaborador(u), 0);

  const handleLancarFolhaContasPagar = async () => {
    const [ano, mes] = mesFolhaRef.split('-');
    try {
      setProcessando(true);
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
      setConfirmarFolhaAberto(false);
      dispararFeedback(
        `Folha de ${formatBRL(
          totalFolhaGeral
        )} agendada com sucesso em contas a pagar para ${formatData(dataVencimentoFolha)}!`
      );
    } catch {
      setErroFolha('Erro ao agendar folha no financeiro.');
    } finally {
      setProcessando(false);
    }
  };

  // Salvar Escala / Férias
  const handleSalvarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEscala(null);
    if (!escalaUsuarioId) {
      setErroEscala('Selecione o colaborador.');
      return;
    }
    const usr = usuarios.find((u) => u.id === escalaUsuarioId);
    try {
      setSalvandoEscala(true);
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
      dispararFeedback(`Período de ${rotuloTipoEscala(escalaTipo)} agendado para ${usr?.nome}!`);
    } catch (err) {
      setErroEscala(`Erro ao salvar o período: ${(err as Error).message || 'tente novamente.'}`);
    } finally {
      setSalvandoEscala(false);
    }
  };

  // Excluir Escala — confirmada na folha "Excluir período?"
  const handleExcluirEscala = async (esc: EscalaFolga) => {
    try {
      setProcessando(true);
      await api.deletarEscalaFolga(empresaId, esc.id);
      setEscalas((prev) => prev.filter((e) => e.id !== esc.id));
      setEscalaParaExcluir(null);
      dispararFeedback('Período removido com sucesso.');
    } catch (err) {
      setErroFolha(`Erro ao remover o período: ${(err as Error).message || 'tente novamente.'}`);
    } finally {
      setProcessando(false);
    }
  };

  // Bater Ponto Eletrônico com Trava GPS (falhas aparecem na própria aba, sem alert)
  const handleBaterPonto = () => {
    if (!navigator.geolocation) {
      setPontoFeedback({ sucesso: false, msg: 'Seu navegador não suporta geolocalização para registro de ponto.' });
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
        const dataStr = dataLocalISO(agora);
        const horaStr = agora.toTimeString().slice(0, 5);

        let novoPonto: RegistroPonto;
        try {
          novoPonto = await api.registrarPonto({
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
        } catch (e) {
          setPontoFeedback({
            sucesso: false,
            msg: `Erro ao registrar o ponto: ${(e as Error).message || 'tente novamente.'} Nada foi gravado.`,
          });
          return;
        } finally {
          setRegistrandoPonto(false);
        }

        setPontos((prev) => [novoPonto, ...prev]);

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
        setPontoFeedback({
          sucesso: false,
          msg: `Falha ao obter geolocalização: ${err.message}. Ative a permissão de GPS no seu celular.`,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const alertaErro = (mensagem: string) => (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{mensagem}</span>
    </p>
  );

  const confirmarDescarte = saidaPendente && (
    <div
      role="alert"
      ref={(el) => el?.scrollIntoView({ block: 'nearest' })}
      className="space-y-3 rounded-xl bg-warning/15 p-4"
    >
      <p className="text-sm font-medium text-ink">Descartar alterações? O que você digitou será perdido.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variante="secundario" onClick={() => setSaidaPendente(null)}>
          Continuar editando
        </Button>
        <Button
          variante="perigo"
          onClick={() => {
            const fechar = saidaPendente;
            setSaidaPendente(null);
            fechar();
          }}
        >
          Descartar
        </Button>
      </div>
    </div>
  );

  // Fecha uma folha de confirmação (não fecha enquanto a ação está em andamento)
  const fecharConfirmacao = (fechar: () => void) => () => {
    if (processando) return;
    setErroFolha(null);
    fechar();
  };

  useTourDaPagina(TOUR_EQUIPE, isGestor && carregado && !carregando);

  if (!isGestor) {
    return (
      <div>
        <PageHeader titulo="Equipe & RH" />
        <Panel espaco="lg" className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-10 w-10 text-danger" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink text-balance">Acesso restrito à gestão</h2>
          <p className="text-sm text-ink-muted text-pretty">
            O módulo de Equipe &amp; RH contém informações salariais e de gestão da oficina. Seu perfil atual ({rotuloCargo(user?.cargo)}) não possui permissão para visualizar ou editar estes dados.
          </p>
        </Panel>
      </div>
    );
  }


  return (
    <div>
      <PageHeader
        titulo="Equipe & RH"
        complemento={
          carregado ? (
            <span className="text-[1.375rem] font-semibold tabular-nums text-ink-subtle" title="Colaboradores ativos">
              {usuariosAtivos.length}
            </span>
          ) : undefined
        }
        abaixo={
          <span className="hidden sm:inline">
            Colaboradores, folha de pagamento, escalas, ponto eletrônico e avaliações dos clientes.
          </span>
        }
        acoes={
          <>
            <Button icone={UserPlus} data-tour="equipe-novo" onClick={abrirModalCadastroColaborador}>
              Novo colaborador
            </Button>
            <Button
              variante="secundario"
              icone={MessageCircle}
              onClick={() => {
                handleGerarConvite();
                setModalConviteAberto(true);
              }}
              aria-label="Convidar no WhatsApp"
              data-tour="equipe-convidar"
              title="Convidar no WhatsApp"
            >
              <span className="hidden sm:inline">Convidar no WhatsApp</span>
            </Button>
            <Button
              variante="secundario"
              icone={RefreshCw}
              onClick={carregarTudo}
              carregando={carregando && carregado}
              disabled={carregando}
              title="Atualizar dados da equipe"
              aria-label="Atualizar dados da equipe"
            />
          </>
        }
      />

      {/* FEEDBACK DE SUCESSO / ERRO */}
      <div aria-live="polite">
        {sucessoMsg && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{sucessoMsg}</span>
          </p>
        )}
      </div>
      {erroCarga && <div className="mb-4">{alertaErro(erroCarga)}</div>}

      <div data-tour="equipe-abas">
        <AbasEquipe itens={ABAS} ativo={activeTab} aoMudar={(id) => setActiveTab(id as TabEquipe)} idPainel="painel-equipe" />
      </div>

      <div role="tabpanel" id="painel-equipe" aria-labelledby={`aba-${activeTab}`}>
        {!carregado ? (
          <Panel>
            <Skeleton linhas={6} />
          </Panel>
        ) : (
          <>
            {/* ABA 1: QUADRO DE COLABORADORES */}
            {activeTab === 'colaboradores' &&
              (colaboradoresVisiveis.length === 0 ? (
                <Panel espaco="lg" className="flex flex-col items-center gap-3 text-center">
                  <Users className="h-10 w-10 text-ink-subtle" strokeWidth={1.5} aria-hidden="true" />
                  <h2 className="text-base font-semibold text-ink text-balance">Nenhum colaborador cadastrado</h2>
                  <p className="max-w-md text-sm text-ink-muted text-pretty">
                    Cadastre a equipe para controlar cargos, salários, comissões e o ponto de cada um.
                  </p>
                </Panel>
              ) : (
                <Panel espaco="nenhum">
                  <div
                    aria-hidden="true"
                    className={`hidden items-center gap-x-6 pb-2 pl-5 pr-2 pt-4 text-xs text-ink-muted lg:grid ${COLUNAS_COLABORADOR}`}
                  >
                    <span>Colaborador</span>
                    <span>Cargo</span>
                    <span>Avaliação</span>
                    <span className="text-right">Salário base</span>
                    <span>Situação</span>
                    <span />
                  </div>
                  <ul aria-label="Colaboradores" className="divide-y divide-line">
                    {colaboradoresVisiveis.map((u) => (
                      <LinhaColaborador
                        key={u.id}
                        u={u}
                        comissaoServicoPadrao={parametrosFolha.comissao_global_servico_pct}
                        comissaoPecaPadrao={parametrosFolha.comissao_global_peca_pct}
                        aoHolerite={() => abrirHolerite(u)}
                        aoEditar={() => abrirModalEdicaoColaborador(u)}
                        aoDesativar={() => {
                          setErroFolha(null);
                          setColaboradorParaDesativar(u);
                        }}
                        aoReativar={() => {
                          setErroFolha(null);
                          setColaboradorParaReativar(u);
                        }}
                      />
                    ))}
                  </ul>
                  <p className="px-4 pb-4 pt-3 text-xs text-ink-muted lg:px-5">
                    {usuariosAtivos.length} {usuariosAtivos.length === 1 ? 'ativo' : 'ativos'}
                    {usuariosInativos.length > 0 &&
                      ` · ${usuariosInativos.length} ${usuariosInativos.length === 1 ? 'desativado' : 'desativados'} (no fim da lista)`}
                  </p>
                </Panel>
              ))}

            {/* ABA 2: FOLHA DE PAGAMENTO & HOLERITES */}
            {activeTab === 'folha' && (
              <AbaFolha
                ativos={usuariosAtivos}
                parametros={parametrosFolha}
                mesRef={mesFolhaRef}
                totalGeral={totalFolhaGeral}
                aoMudarMes={setMesFolhaRef}
                aoLancar={() => {
                  setErroFolha(null);
                  setConfirmarFolhaAberto(true);
                }}
                aoHolerite={abrirHolerite}
              />
            )}

            {/* ABA 3: ESCALAS & FÉRIAS */}
            {activeTab === 'escalas' && (
              <AbaEscalas
                escalas={escalas}
                aoAgendar={() => {
                  setErroEscala(null);
                  setModalEscalaAberto(true);
                }}
                aoExcluir={(esc) => {
                  setErroFolha(null);
                  setEscalaParaExcluir(esc);
                }}
              />
            )}

            {/* ABA 4: PONTO ELETRÔNICO COM GEOLOCALIZAÇÃO */}
            {activeTab === 'ponto' && (
              <AbaPonto
                pontos={pontos}
                raio={coordsOficina.raio}
                registrando={registrandoPonto}
                feedback={pontoFeedback}
                aoBaterPonto={() => setConfirmarPontoAberto(true)}
              />
            )}

            {/* ABA 5: AVALIAÇÕES DOS CLIENTES */}
            {activeTab === 'avaliacoes' && <AbaAvaliacoes avaliacoes={avaliacoes} />}
          </>
        )}
      </div>

      {/* FOLHA: CONVITE POR WHATSAPP (os campos ficam guardados ao fechar) */}
      <Folha aberto={modalConviteAberto} titulo="Convidar por WhatsApp" aoCancelar={() => setModalConviteAberto(false)}>
        <div className="space-y-4">
          <Field rotulo="Nome do colaborador">
            <input
              type="text"
              value={nomeConvite}
              onChange={(e) => setNomeConvite(e.target.value)}
              placeholder="Ex: Carlos Mecânico"
              className={CLASSE_CAMPO}
            />
          </Field>
          <Field rotulo="WhatsApp (DDD + número)">
            <input
              type="tel"
              inputMode="tel"
              value={telConvite}
              onChange={(e) => setTelConvite(e.target.value)}
              placeholder="Ex: 11999998888"
              className={`${CLASSE_CAMPO} tabular-nums`}
            />
          </Field>
          <Field rotulo="Cargo">
            <select value={cargoConvite} onChange={(e) => setCargoConvite(e.target.value as CargoUsuario)} className={CLASSE_CAMPO}>
              {CARGOS_DISPONIVEIS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundario" onClick={() => setModalConviteAberto(false)}>
            Fechar
          </Button>
          <Button icone={Send} onClick={handleEnviarConviteWhatsApp}>
            Enviar convite no WhatsApp
          </Button>
        </div>
      </Folha>

      {/* FOLHA: CADASTRO / EDIÇÃO DE COLABORADOR */}
      <Folha
        aberto={modalColaboradorAberto}
        focoInicial="primeiro-campo"
        tamanho="lg"
        fecharNoFundo={false}
        titulo={colaboradorEmEdicao ? 'Editar colaborador' : 'Novo colaborador'}
        aoCancelar={() => sairDoFormulario()}
      >
        {confirmarDescarte}
        {erroForm && alertaErro(erroForm)}
        <form onSubmit={handleSalvarColaborador} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="mb-3 text-sm font-semibold text-ink">Dados e acesso</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field rotulo="Nome completo *">
                <input type="text" required value={formNome} onChange={(e) => setFormNome(e.target.value)} className={CLASSE_CAMPO} />
              </Field>
              <Field rotulo="E-mail de acesso *">
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </Field>
              <Field rotulo="Telefone / WhatsApp">
                <input
                  type="tel"
                  inputMode="tel"
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
              <Field rotulo="Cargo *">
                <select value={formCargo} onChange={(e) => setFormCargo(e.target.value as CargoUsuario)} className={CLASSE_CAMPO}>
                  {CARGOS_DISPONIVEIS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              rotulo={colaboradorEmEdicao ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial'}
              dica="Mínimo 6 caracteres."
            >
              <input
                type="password"
                autoComplete="new-password"
                value={formSenha}
                onChange={(e) => setFormSenha(e.target.value)}
                className={CLASSE_CAMPO}
              />
            </Field>
          </fieldset>

          <fieldset className="space-y-4 border-t border-line pt-5">
            <legend className="sr-only">Remuneração</legend>
            <p aria-hidden="true" className="text-sm font-semibold text-ink">
              Remuneração
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field rotulo="Salário base (R$)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formSalario}
                  onChange={(e) => setFormSalario(e.target.value)}
                  placeholder="Opcional"
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
              <Field rotulo="Comissão M.O. (%)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={formComissaoServico}
                  onChange={(e) => setFormComissaoServico(e.target.value)}
                  placeholder="Ex: 15"
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
              <Field rotulo="Comissão peças (%)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={formComissaoPeca}
                  onChange={(e) => setFormComissaoPeca(e.target.value)}
                  placeholder="Ex: 5"
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field rotulo="Vale-transporte (R$)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formVT}
                  onChange={(e) => setFormVT(e.target.value)}
                  placeholder="0,00"
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
              <Field rotulo="Vale-refeição (R$)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formVR}
                  onChange={(e) => setFormVR(e.target.value)}
                  placeholder="0,00"
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={formPagaHE}
                  onChange={(e) => setFormPagaHE(e.target.checked)}
                  className="h-5 w-5 rounded border-line-strong accent-brand"
                />
                Paga hora extra
              </label>
              <Field rotulo="Valor da hora extra (R$)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formValorHE}
                  onChange={(e) => setFormValorHE(e.target.value)}
                  placeholder="0,00"
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {colaboradorEmEdicao && colaboradorEmEdicao.ativo !== false && (
              <Button
                variante="fantasma"
                icone={UserX}
                className="sm:mr-auto"
                onClick={() => {
                  const alvo = colaboradorEmEdicao;
                  sairDoFormulario(() => {
                    setErroFolha(null);
                    setColaboradorParaDesativar(alvo);
                  });
                }}
              >
                Desativar
              </Button>
            )}
            <Button variante="secundario" onClick={() => sairDoFormulario()} className="sm:ml-auto">
              Cancelar
            </Button>
            <Button type="submit" carregando={salvandoColaborador}>
              {salvandoColaborador ? 'Salvando…' : 'Salvar colaborador'}
            </Button>
          </div>
        </form>
      </Folha>

      {/* FOLHA: CONFIRMAR DESATIVAÇÃO (exclusão lógica) */}
      <Folha
        aberto={colaboradorParaDesativar !== null}
        titulo="Desativar colaborador?"
        aoCancelar={fecharConfirmacao(() => setColaboradorParaDesativar(null))}
      >
        {colaboradorParaDesativar && (
          <>
            {erroFolha && alertaErro(erroFolha)}
            <div>
              <p className="text-sm font-medium text-ink">{colaboradorParaDesativar.nome}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{rotuloCargo(colaboradorParaDesativar.cargo)}</p>
              <p className="mt-3 text-sm text-ink-muted">
                Ele será mantido no histórico, mas sai da lista de ativos e da folha de pagamento. Você pode reativá-lo depois.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" disabled={processando} onClick={fecharConfirmacao(() => setColaboradorParaDesativar(null))}>
                Cancelar
              </Button>
              <Button variante="perigo" icone={UserX} carregando={processando} onClick={() => handleExcluirColaborador(colaboradorParaDesativar)}>
                {processando ? 'Desativando…' : 'Desativar'}
              </Button>
            </div>
          </>
        )}
      </Folha>

      {/* FOLHA: CONFIRMAR REATIVAÇÃO */}
      <Folha
        aberto={colaboradorParaReativar !== null}
        titulo="Reativar colaborador?"
        aoCancelar={fecharConfirmacao(() => setColaboradorParaReativar(null))}
      >
        {colaboradorParaReativar && (
          <>
            {erroFolha && alertaErro(erroFolha)}
            <div>
              <p className="text-sm font-medium text-ink">{colaboradorParaReativar.nome}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{rotuloCargo(colaboradorParaReativar.cargo)}</p>
              <p className="mt-3 text-sm text-ink-muted">Ele volta para a lista de ativos e para a folha de pagamento.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" disabled={processando} onClick={fecharConfirmacao(() => setColaboradorParaReativar(null))}>
                Cancelar
              </Button>
              <Button icone={RotateCcw} carregando={processando} onClick={() => handleReativarColaborador(colaboradorParaReativar)}>
                {processando ? 'Reativando…' : 'Reativar'}
              </Button>
            </div>
          </>
        )}
      </Folha>

      {/* FOLHA: CONFIRMAR LANÇAMENTO DA FOLHA NO CONTAS A PAGAR */}
      <Folha
        aberto={confirmarFolhaAberto}
        titulo="Lançar folha em contas a pagar?"
        aoCancelar={fecharConfirmacao(() => setConfirmarFolhaAberto(false))}
      >
        {erroFolha && alertaErro(erroFolha)}
        <div>
          <p className="text-sm text-ink-muted">Folha de {mesFolha}/{anoFolha}</p>
          <p className="mt-1 text-[1.75rem] font-semibold leading-tight tabular-nums text-ink">{formatBRL(totalFolhaGeral)}</p>
          <p className="mt-1 text-sm tabular-nums text-ink-muted">
            Despesa pendente com vencimento em {formatData(dataVencimentoFolha)} · {usuariosAtivos.length}{' '}
            {usuariosAtivos.length === 1 ? 'colaborador ativo' : 'colaboradores ativos'}
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Baseada só nos colaboradores ativos com valores cadastrados (salário, VT e VR).
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundario" disabled={processando} onClick={fecharConfirmacao(() => setConfirmarFolhaAberto(false))}>
            Cancelar
          </Button>
          <Button icone={CheckCircle2} carregando={processando} onClick={handleLancarFolhaContasPagar}>
            {processando ? 'Lançando…' : `Lançar folha de ${formatBRL(totalFolhaGeral)}`}
          </Button>
        </div>
      </Folha>

      {/* FOLHA: CONFIRMAR EXCLUSÃO DE ESCALA */}
      <Folha
        aberto={escalaParaExcluir !== null}
        titulo="Excluir período?"
        aoCancelar={fecharConfirmacao(() => setEscalaParaExcluir(null))}
      >
        {escalaParaExcluir && (
          <>
            {erroFolha && alertaErro(erroFolha)}
            <div>
              <p className="text-sm font-medium text-ink">
                {rotuloTipoEscala(escalaParaExcluir.tipo)} · {escalaParaExcluir.usuario_nome}
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-ink-muted">
                {formatData(escalaParaExcluir.data_inicio)} até {formatData(escalaParaExcluir.data_fim)}
              </p>
              <p className="mt-3 text-sm text-ink-muted">Esta ação não poderá ser desfeita.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" disabled={processando} onClick={fecharConfirmacao(() => setEscalaParaExcluir(null))}>
                Cancelar
              </Button>
              <Button variante="perigo" icone={Trash2} carregando={processando} onClick={() => handleExcluirEscala(escalaParaExcluir)}>
                {processando ? 'Excluindo…' : 'Excluir período'}
              </Button>
            </div>
          </>
        )}
      </Folha>

      {/* FOLHA: CONFIRMAR BATIDA DE PONTO */}
      <Folha aberto={confirmarPontoAberto} titulo="Registrar ponto agora?" aoCancelar={() => setConfirmarPontoAberto(false)}>
        <p className="text-sm text-ink-muted">
          Vamos usar o GPS do aparelho para registrar a entrada de {user?.nome || 'você'} e conferir se está dentro do raio de{' '}
          {coordsOficina.raio} m da oficina.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundario" onClick={() => setConfirmarPontoAberto(false)}>
            Cancelar
          </Button>
          <Button
            icone={Navigation}
            onClick={() => {
              setConfirmarPontoAberto(false);
              handleBaterPonto();
            }}
          >
            Registrar ponto
          </Button>
        </div>
      </Folha>

      {/* FOLHA: HOLERITE / DEMONSTRATIVO DE PAGAMENTO IMPRIMÍVEL */}
      <Folha aberto={modalHoleriteAberto && colaboradorHolerite !== null} titulo="Holerite" aoCancelar={() => setModalHoleriteAberto(false)}>
        {modalHoleriteAberto && colaboradorHolerite && (
          <>
            <div className="area-impressao">
            {/* codemod:ignore-start */}
            {/* ÁREA DO HOLERITE IMPRIMÍVEL */}
            <div
              id="holerite-impressao"
              className="bg-white text-black p-5 rounded-xl border-2 border-black space-y-4 font-mono text-xs select-all"
            >
              <div className="text-center border-b-2 border-black pb-2">
                <h2 className="text-base font-semibold uppercase [overflow-wrap:anywhere]">{identidadeOficina.nome}</h2>
                {identidadeOficina.cnpj && <div className="text-xs">CNPJ {identidadeOficina.cnpj}</div>}
                <div className="text-xs font-semibold">Recibo de pagamento de salário e comissões</div>
                <div className="text-xs">Mês de referência: {formatMesExtenso(mesFolhaRef)}</div>
              </div>

              <div className="grid grid-cols-1 gap-1 border-b border-black pb-2 text-xs [overflow-wrap:anywhere]">
                <div data-campo="colaborador" className="min-w-0">
                  <strong>Colaborador:</strong> {colaboradorHolerite.nome}
                </div>
                <div data-campo="cargo" className="min-w-0">
                  <strong>Cargo:</strong> {rotuloCargo(colaboradorHolerite.cargo)}
                </div>
                <div data-campo="email" className="min-w-0">
                  <strong>E-mail:</strong> {colaboradorHolerite.email}
                </div>
                <div data-campo="pagamento" className="min-w-0">
                  <strong>Data de pagamento:</strong> Dia {parametrosFolha.dia_pagamento}
                </div>
              </div>

              <table className="w-full table-fixed text-left border-collapse [overflow-wrap:anywhere]">
                <thead>
                  <tr className="border-b border-black text-xs uppercase font-semibold">
                    <th className="w-[46%] py-1 pr-1">Descrição</th>
                    <th className="py-1 px-1 text-right">Proventos (R$)</th>
                    <th className="w-[24%] py-1 pl-1 text-right">Descontos (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/25">
                  <tr>
                    <td className="py-1">Salário base mensal</td>
                    <td className="py-1 text-right">
                      {colaboradorHolerite.salario_base && colaboradorHolerite.salario_base > 0
                        ? formatBRL(colaboradorHolerite.salario_base)
                        : 'Não informado'}
                    </td>
                    <td className="py-1 text-right">—</td>
                  </tr>
                  <tr>
                    <td className="py-1">
                      Comissão mão de obra ({colaboradorHolerite.comissao_servico_pct ?? 0}%)
                    </td>
                    <td className="py-1 text-right">{formatBRL(0.0)}</td>
                    <td className="py-1 text-right">—</td>
                  </tr>
                  <tr>
                    <td className="py-1">
                      Comissão peças ({colaboradorHolerite.comissao_peca_pct ?? 0}%)
                    </td>
                    <td className="py-1 text-right">{formatBRL(0.0)}</td>
                    <td className="py-1 text-right">—</td>
                  </tr>
                  {colaboradorHolerite.vale_transporte && colaboradorHolerite.vale_transporte > 0 ? (
                    <tr>
                      <td className="py-1">Auxílio transporte (VT)</td>
                      <td className="py-1 text-right">
                        {formatBRL(colaboradorHolerite.vale_transporte)}
                      </td>
                      <td className="py-1 text-right">—</td>
                    </tr>
                  ) : null}
                  {colaboradorHolerite.vale_refeicao && colaboradorHolerite.vale_refeicao > 0 ? (
                    <tr>
                      <td className="py-1">Auxílio refeição (VR)</td>
                      <td className="py-1 text-right">
                        {formatBRL(colaboradorHolerite.vale_refeicao)}
                      </td>
                      <td className="py-1 text-right">—</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="border-t-2 border-black pt-2 flex flex-wrap items-center justify-between gap-x-3 text-sm font-semibold">
                <span>Valor líquido a receber:</span>
                <span className="text-base whitespace-nowrap">
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

              <div className="pt-8 border-t border-dashed border-black text-center text-xs [overflow-wrap:anywhere]">
                <div aria-hidden="true" className="mx-auto mb-1 w-full max-w-xs border-t border-black" />
                Assinatura do colaborador: {colaboradorHolerite.nome}
              </div>
            </div>
            {/* codemod:ignore-end */}
            </div>

            <div className="flex flex-col-reverse gap-2 print:hidden sm:flex-row sm:justify-end">
              <Button variante="secundario" onClick={() => setModalHoleriteAberto(false)}>
                Fechar
              </Button>
              <Button icone={Printer} onClick={() => window.print()}>
                Imprimir holerite
              </Button>
            </div>
          </>
        )}
      </Folha>

      {/* FOLHA: AGENDAR ESCALA / FÉRIAS (os campos ficam guardados ao fechar, como antes) */}
      <Folha aberto={modalEscalaAberto} titulo="Agendar férias ou folga" aoCancelar={() => setModalEscalaAberto(false)}>
        {erroEscala && alertaErro(erroEscala)}
        <form onSubmit={handleSalvarEscala} className="space-y-4">
          <Field rotulo="Colaborador *">
            <select required value={escalaUsuarioId} onChange={(e) => setEscalaUsuarioId(e.target.value)} className={CLASSE_CAMPO}>
              <option value="">Selecione o profissional…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({rotuloCargo(u.cargo)})
                </option>
              ))}
            </select>
          </Field>
          <Field rotulo="Tipo de período *">
            <select
              value={escalaTipo}
              onChange={(e) => setEscalaTipo(e.target.value as 'FERIAS' | 'FOLGA' | 'ATESTADO' | 'PLANTAO')}
              className={CLASSE_CAMPO}
            >
              <option value="FERIAS">Férias</option>
              <option value="FOLGA">Folga / escala revezamento</option>
              <option value="ATESTADO">Atestado médico / licença</option>
              <option value="PLANTAO">Plantão extra</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field rotulo="Data início *">
              <input
                type="date"
                required
                value={escalaInicio}
                onChange={(e) => setEscalaInicio(e.target.value)}
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </Field>
            <Field rotulo="Data fim *">
              <input
                type="date"
                required
                value={escalaFim}
                onChange={(e) => setEscalaFim(e.target.value)}
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </Field>
          </div>
          <Field rotulo="Observações">
            <input
              type="text"
              value={escalaObs}
              onChange={(e) => setEscalaObs(e.target.value)}
              placeholder="Ex: 15 dias de férias aprovadas…"
              className={CLASSE_CAMPO}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={() => setModalEscalaAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" carregando={salvandoEscala}>
              {salvandoEscala ? 'Salvando…' : 'Salvar período'}
            </Button>
          </div>
        </form>
      </Folha>
    </div>
  );
}
