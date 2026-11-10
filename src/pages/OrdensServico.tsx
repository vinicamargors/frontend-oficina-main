import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, OrdenacaoOS } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Cliente,
  EstoqueItem,
  OSDossie,
  OSItem,
  OSItemCreateInput,
  StatusOS,
  TipoItemOS,
  UltimaOS,
  Usuario,
  Veiculo,
} from '../types';
import {
  PlusCircle,
  Search,
  Wrench,
  Clock,
  PackageCheck,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Printer,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Car,
  UserPlus,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  Sparkles,
  User,
  ChevronLeft,
  ChevronRight,
  Layers,
  Pencil,
  Check,
  X,
  SlidersHorizontal,
} from 'lucide-react';

interface OrdensServicoProps {
  empresaId: string;
  initialStatusFilter?: StatusOS;
  initialOsId?: string;
}

interface ItemRascunho extends OSItemCreateInput {
  tempId: string;
}

const ITENS_POR_PAGINA = 50;

const formatBRL = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor || 0)
  );

const formatDataHora = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
};

const STATUS_LIST: {
  id: StatusOS;
  label: string;
  shortLabel: string;
  nextStatus?: StatusOS;
  nextLabel?: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  activeBtn: string;
  icon: typeof Wrench;
}[] = [
  {
    id: 'ORCAMENTO',
    label: 'Orçamento',
    shortLabel: 'Orçamento',
    nextStatus: 'EXECUCAO',
    nextLabel: 'Aprovar → Execução',
    badgeBg: 'bg-amber-950',
    badgeBorder: 'border-amber-500',
    badgeText: 'text-amber-300',
    activeBtn: 'bg-amber-500 text-[#071226] border-amber-400',
    icon: ClipboardList,
  },
  {
    id: 'AGUARDANDO_PECA',
    label: 'Aguardando Peça',
    shortLabel: 'Ag. Peça',
    nextStatus: 'EXECUCAO',
    nextLabel: 'Peça Chegou → Execução',
    badgeBg: 'bg-sky-950',
    badgeBorder: 'border-sky-500',
    badgeText: 'text-sky-300',
    activeBtn: 'bg-[#38BDF8] text-[#071226] border-[#38BDF8]',
    icon: Clock,
  },
  {
    id: 'EXECUCAO',
    label: 'Em Execução',
    shortLabel: 'Execução',
    nextStatus: 'FINALIZADO',
    nextLabel: 'Concluir Serviço',
    badgeBg: 'bg-blue-950',
    badgeBorder: 'border-blue-500',
    badgeText: 'text-blue-200',
    activeBtn: 'bg-[#2563EB] text-white border-blue-400',
    icon: Wrench,
  },
  {
    id: 'FINALIZADO',
    label: 'Finalizado',
    shortLabel: 'Finalizado',
    nextStatus: 'PAGO',
    nextLabel: 'Receber / Dar Baixa',
    badgeBg: 'bg-emerald-950',
    badgeBorder: 'border-emerald-500',
    badgeText: 'text-emerald-300',
    activeBtn: 'bg-emerald-500 text-[#071226] border-emerald-400',
    icon: PackageCheck,
  },
  {
    id: 'PAGO',
    label: 'Pago / Entregue',
    shortLabel: 'Pago',
    badgeBg: 'bg-green-950',
    badgeBorder: 'border-green-500',
    badgeText: 'text-green-300',
    activeBtn: 'bg-green-500 text-[#071226] border-green-400',
    icon: CheckCircle2,
  },
];

const FORMAS_PAGAMENTO = [
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
  'Boleto / Faturado',
];

export function OrdensServico({
  empresaId,
  initialStatusFilter,
  initialOsId,
}: OrdensServicoProps) {
  const { user } = useAuth();
  const canSeeFinanceiro =
    user?.cargo === 'DONO' || user?.cargo === 'FINANCEIRO' || user?.cargo === 'master';

  const [view, setView] = useState<'lista' | 'nova' | 'bancada'>(() =>
    initialOsId === 'NOVA_OS' ? 'nova' : initialOsId ? 'bancada' : 'lista'
  );

  // Filtros e Paginação da Lista de OS (Faixa Recolhível)
  const [mostrarFiltros, setMostrarFiltros] = useState<boolean>(
    Boolean(initialStatusFilter)
  );
  const [statusFiltro, setStatusFiltro] = useState<StatusOS | 'TODAS'>(
    initialStatusFilter || 'TODAS'
  );
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoOS>('data_desc');
  const [pagina, setPagina] = useState(1);
  const [ordens, setOrdens] = useState<UltimaOS[]>([]);
  const [totalOrdens, setTotalOrdens] = useState(0);
  const [loadingLista, setLoadingLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  // Estado da OS aberta na Bancada
  const [selectedOsId, setSelectedOsId] = useState<string | null>(
    initialOsId && initialOsId !== 'NOVA_OS' ? initialOsId : null
  );
  const [dossie, setDossie] = useState<OSDossie | null>(null);
  const [loadingDossie, setLoadingDossie] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [erroOperacao, setErroOperacao] = useState<string | null>(null);

  // Dados auxiliares
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [mecanicos, setMecanicos] = useState<Usuario[]>([]);

  // Campos técnicos da Bancada (auto-save)
  const [editKm, setEditKm] = useState<string>('');
  const [editProblema, setEditProblema] = useState<string>('');
  const [editMecanicoId, setEditMecanicoId] = useState<string>('');
  const [editFormaPagamento, setEditFormaPagamento] = useState<string>('PIX');
  const [statusAutoSave, setStatusAutoSave] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Lançamento de Itens em Lote + Busca Reativa de Estoque (Nome e SKU, Qtd > 0)
  const [modoItem, setModoItem] = useState<
    'PECA_ESTOQUE' | 'PECA_AVULSA' | 'MAO_OBRA' | 'TERCEIRIZADO'
  >('PECA_ESTOQUE');
  const [buscaEstoqueTexto, setBuscaEstoqueTexto] = useState('');
  const [itemEstoqueId, setItemEstoqueId] = useState<string>('');
  const [itemNome, setItemNome] = useState<string>('');
  const [itemQtd, setItemQtd] = useState<string>('1');
  const [itemCusto, setItemCusto] = useState<string>('');
  const [itemVenda, setItemVenda] = useState<string>('');
  const [itensPendentes, setItensPendentes] = useState<ItemRascunho[]>([]);
  const [lancandoLote, setLancandoLote] = useState(false);

  // Filtro/Aba interna da lista de itens lançados na OS + Edição inline de item
  const [abaItensLancados, setAbaItensLancados] = useState<'TODOS' | TipoItemOS>('TODOS');
  const [buscaItemLancado, setBuscaItemLancado] = useState('');
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [editItemNome, setEditItemNome] = useState('');
  const [editItemTipo, setEditItemTipo] = useState<TipoItemOS>('PECA');
  const [editItemQtd, setEditItemQtd] = useState('1');
  const [editItemCusto, setEditItemCusto] = useState('0');
  const [editItemVenda, setEditItemVenda] = useState('0');
  const [salvandoItemEditado, setSalvandoItemEditado] = useState(false);

  // Cancelamento de OS
  const [mostrarModalExclusao, setMostrarModalExclusao] = useState(false);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [excluindoOS, setExcluindoOS] = useState(false);

  // Fluxo de Nova OS (1º Cliente -> 2º Veículos do Cliente)
  const [modoClienteOS, setModoClienteOS] = useState<'BUSCAR' | 'NOVO_CLIENTE'>('BUSCAR');
  const [buscaClienteTexto, setBuscaClienteTexto] = useState('');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState('');
  const [modoVeiculoCliente, setModoVeiculoCliente] = useState<
    'DO_CLIENTE' | 'NOVO_VEICULO'
  >('DO_CLIENTE');
  const [veiculoSelecionadoId, setVeiculoSelecionadoId] = useState('');
  const [novaOsKm, setNovaOsKm] = useState('');
  const [novaOsProblema, setNovaOsProblema] = useState('');
  const [criandoOS, setCriandoOS] = useState(false);

  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [novoClienteCpf, setNovoClienteCpf] = useState('');
  const [novaPlaca, setNovaPlaca] = useState('');
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [avisoPlaca, setAvisoPlaca] = useState<string | null>(null);
  const [novoModelo, setNovoModelo] = useState('');
  const [novaMarca, setNovaMarca] = useState('');
  const [novaCor, setNovaCor] = useState('');
  const [novoAno, setNovoAno] = useState('');

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFiltro(initialStatusFilter);
      setPagina(1);
    }
  }, [initialStatusFilter]);

  const carregarOrdens = useCallback(async () => {
    if (!empresaId) return;
    setLoadingLista(true);
    setErroLista(null);
    try {
      const vMin = valorMin.trim() ? Number(valorMin.replace(',', '.')) : null;
      const vMax = valorMax.trim() ? Number(valorMax.replace(',', '.')) : null;
      const res = await api.listarOS({
        empresaId,
        status: statusFiltro === 'TODAS' ? undefined : statusFiltro,
        search: busca,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        valorMin: vMin,
        valorMax: vMax,
        ordenacao,
        skip: (pagina - 1) * ITENS_POR_PAGINA,
        limit: ITENS_POR_PAGINA,
      });
      setOrdens(res.items || []);
      setTotalOrdens(res.total || 0);
    } catch (err: unknown) {
      const e = err as Error;
      setErroLista(e.message || 'Erro ao carregar Ordens de Serviço.');
    } finally {
      setLoadingLista(false);
    }
  }, [
    empresaId,
    statusFiltro,
    busca,
    dataInicio,
    dataFim,
    valorMin,
    valorMax,
    ordenacao,
    pagina,
  ]);

  useEffect(() => {
    if (view === 'lista') {
      carregarOrdens();
    }
  }, [view, carregarOrdens]);

  const veiculosPorCliente = useMemo(() => {
    const mapa = new Map<string, Veiculo[]>();
    for (const v of veiculos) {
      if (!v.cliente_id) continue;
      const atual = mapa.get(v.cliente_id) || [];
      atual.push(v);
      mapa.set(v.cliente_id, atual);
    }
    return mapa;
  }, [veiculos]);

  // Busca reativa de clientes (Placa, Nome, CPF ou Telefone)
  const clientesFiltrados = useMemo(() => {
    const termoBruto = buscaClienteTexto.trim().toLowerCase();
    if (!termoBruto) return [];
    const termoAlfanum = termoBruto.replace(/[^a-z0-9]/g, '');
    const termoDigitos = termoBruto.replace(/\D/g, '');

    return clientes.filter((c) => {
      const nomeMatch = (c.nome || '').toLowerCase().includes(termoBruto);
      const foneBruto = (c.telefone || '').toLowerCase();
      const foneDigitos = foneBruto.replace(/\D/g, '');
      const foneMatch =
        foneBruto.includes(termoBruto) ||
        (termoDigitos.length >= 2 && foneDigitos.includes(termoDigitos));

      const cpfBruto = (c.cpf_cnpj || '').toLowerCase();
      const cpfDigitos = cpfBruto.replace(/\D/g, '');
      const cpfMatch =
        cpfBruto.includes(termoBruto) ||
        (termoDigitos.length >= 2 && cpfDigitos.includes(termoDigitos));

      const carrosDoCliente = veiculosPorCliente.get(c.id) || [];
      const placaOuModeloMatch = carrosDoCliente.some((v) => {
        const placaRaw = (v.placa || '').toLowerCase();
        const placaLimpa = placaRaw.replace(/[^a-z0-9]/g, '');
        const modeloRaw = (v.modelo || '').toLowerCase();
        return (
          placaRaw.includes(termoBruto) ||
          (termoAlfanum.length >= 2 && placaLimpa.includes(termoAlfanum)) ||
          modeloRaw.includes(termoBruto)
        );
      });

      return nomeMatch || foneMatch || cpfMatch || placaOuModeloMatch;
    });
  }, [clientes, veiculosPorCliente, buscaClienteTexto]);

  // Busca reativa de peças do estoque:
  // 1) Somente quantidade > 0 e diferente de MAO_OBRA
  // 2) Só aparece quando o usuário começa a digitar (Nome ou SKU/Código)
  const pecasEstoqueFiltradas = useMemo(() => {
    const termo = buscaEstoqueTexto.trim().toLowerCase();
    if (!termo) return [];
    return estoque.filter((p) => {
      if (Number(p.quantidade) <= 0 || p.categoria === 'MAO_OBRA') return false;
      const nomeMatch = (p.nome || '').toLowerCase().includes(termo);
      const skuLimpo =
        p.codigo && p.codigo !== 'None' ? String(p.codigo).toLowerCase() : '';
      const skuMatch = skuLimpo.includes(termo);
      return nomeMatch || skuMatch;
    });
  }, [estoque, buscaEstoqueTexto]);

  const abrirBancadaOS = useCallback(
    async (osId: string, mensagemInicial: string | null = null) => {
      setSelectedOsId(osId);
      setView('bancada');
      setLoadingDossie(true);
      setErroOperacao(null);
      setFeedbackMsg(mensagemInicial);
      setMostrarModalExclusao(false);
      setItensPendentes([]);
      setEditandoItemId(null);
      setStatusAutoSave('idle');

      try {
        const [dossieRes, estoqueRes] = await Promise.all([
          api.obterDossieOS(empresaId, osId),
          api.listarEstoque(empresaId).catch(() => ({ itens: [], stats: null })),
        ]);

        setDossie(dossieRes);
        setEstoque(estoqueRes.itens || []);
        setEditKm(
          dossieRes.ordem.km_atual != null ? String(dossieRes.ordem.km_atual) : ''
        );
        setEditProblema(dossieRes.ordem.descricao_problema || '');
        setEditMecanicoId(dossieRes.ordem.mecanico_responsavel_id || user?.id || '');
        setEditFormaPagamento(dossieRes.ordem.forma_pagamento || 'PIX');

        api
          .getUsuarios(empresaId)
          .then((lista) => setMecanicos(lista.filter((u) => u.ativo)))
          .catch(() => {
            if (user) setMecanicos([user]);
          });
      } catch (err: unknown) {
        const e = err as Error;
        setErroOperacao(e.message || 'Não foi possível abrir os detalhes desta OS.');
      } finally {
        setLoadingDossie(false);
      }
    },
    [empresaId, user]
  );

  const sincronizarDossieSilencioso = useCallback(
    async (osId: string) => {
      try {
        const atualizado = await api.obterDossieOS(empresaId, osId);
        setDossie(atualizado);
      } catch {
        // Mantém estado otimista local
      }
    },
    [empresaId]
  );

  const abrirTelaNovaOS = useCallback(async () => {
    setView('nova');
    setErroOperacao(null);
    setFeedbackMsg(null);
    setAvisoPlaca(null);
    setModoClienteOS('BUSCAR');
    setBuscaClienteTexto('');
    setClienteSelecionadoId('');
    setVeiculoSelecionadoId('');
    setModoVeiculoCliente('DO_CLIENTE');
    setNovaOsKm('');
    setNovaOsProblema('');
    try {
      const [vList, cList] = await Promise.all([
        api.listarVeiculos(empresaId),
        api.listarClientes(empresaId),
      ]);
      setVeiculos(vList || []);
      setClientes(cList || []);
      if ((cList || []).length === 0) {
        setModoClienteOS('NOVO_CLIENTE');
        setModoVeiculoCliente('NOVO_VEICULO');
      }
    } catch {
      // Continua permitindo cadastro rápido
    }
  }, [empresaId]);

  useEffect(() => {
    if (initialOsId === 'NOVA_OS') {
      abrirTelaNovaOS();
    } else if (initialOsId) {
      abrirBancadaOS(initialOsId);
    }
  }, [initialOsId, abrirBancadaOS, abrirTelaNovaOS]);

  const handleSelecionarClienteNaLista = (cliente: Cliente) => {
    const termoAlfanum = buscaClienteTexto
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    setClienteSelecionadoId(cliente.id);
    setBuscaClienteTexto('');

    const carrosCliente = veiculosPorCliente.get(cliente.id) || [];
    if (carrosCliente.length === 0) {
      setModoVeiculoCliente('NOVO_VEICULO');
      setVeiculoSelecionadoId('');
    } else {
      setModoVeiculoCliente('DO_CLIENTE');
      const matchPlaca =
        termoAlfanum.length >= 3
          ? carrosCliente.find((v) =>
              v.placa
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .includes(termoAlfanum)
            )
          : undefined;
      const carroInicial =
        matchPlaca || (carrosCliente.length === 1 ? carrosCliente[0] : undefined);
      if (carroInicial) {
        setVeiculoSelecionadoId(carroInicial.id);
        setNovaOsKm(carroInicial.km_atual ? String(carroInicial.km_atual) : '');
      } else {
        setVeiculoSelecionadoId('');
      }
    }
  };

  const handleConsultarPlaca = async () => {
    const limpa = novaPlaca.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (limpa.length < 7) {
      setAvisoPlaca('Digite os 7 caracteres da placa (ex.: ABC1D23).');
      return;
    }
    setBuscandoPlaca(true);
    setAvisoPlaca(null);
    try {
      const dados = await api.consultarPlaca(limpa);
      if (dados.modelo) setNovoModelo(dados.modelo);
      if (dados.marca) setNovaMarca(dados.marca);
      if (dados.cor) setNovaCor(dados.cor);
      if (dados.ano) setNovoAno(String(dados.ano));
      setAvisoPlaca('Dados do veículo preenchidos automaticamente pela placa!');
    } catch {
      setAvisoPlaca(
        'Placa não localizada na base externa. Preencha o Modelo do veículo abaixo.'
      );
    } finally {
      setBuscandoPlaca(false);
    }
  };

  const handleCriarNovaOS = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperacao(null);
    setCriandoOS(true);

    try {
      let clienteIdFinal = '';
      let veiculoIdFinal = '';

      if (modoClienteOS === 'BUSCAR') {
        if (!clienteSelecionadoId) {
          throw new Error(
            'Pesquise e selecione um cliente na lista ou clique em "+ Novo Cliente".'
          );
        }
        clienteIdFinal = clienteSelecionadoId;
      } else {
        if (!novoClienteNome.trim() || !novoClienteTelefone.trim()) {
          throw new Error('Informe o Nome e o Telefone/WhatsApp do novo cliente.');
        }
        const novoCli = await api.criarCliente({
          nome: novoClienteNome.trim(),
          telefone: novoClienteTelefone.trim(),
          cpf_cnpj: novoClienteCpf.trim() || null,
          empresa_id: empresaId,
        });
        clienteIdFinal = novoCli.id;
      }

      if (modoClienteOS === 'BUSCAR' && modoVeiculoCliente === 'DO_CLIENTE') {
        if (!veiculoSelecionadoId) {
          throw new Error(
            'Selecione um dos veículos do cliente ou clique em "+ Novo Veículo".'
          );
        }
        veiculoIdFinal = veiculoSelecionadoId;
      } else {
        const placaFormatada = novaPlaca.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (placaFormatada.length < 7) {
          throw new Error('Informe uma placa válida com 7 caracteres.');
        }
        if (!novoModelo.trim()) {
          throw new Error('Informe o modelo do veículo (ex.: Gol 1.6, Onix, HB20).');
        }

        const jaExiste = veiculos.find(
          (v) =>
            v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === placaFormatada &&
            v.cliente_id === clienteIdFinal
        );

        if (jaExiste) {
          veiculoIdFinal = jaExiste.id;
        } else {
          const novoVei = await api.criarVeiculo({
            placa: placaFormatada,
            modelo: novoModelo.trim(),
            marca: novaMarca.trim() || null,
            cor: novaCor.trim() || null,
            ano: novoAno ? Number(novoAno) : null,
            km_atual: novaOsKm ? Number(novaOsKm) : null,
            cliente_id: clienteIdFinal,
            empresa_id: empresaId,
          });
          veiculoIdFinal = novoVei.id;
        }
      }

      const osCriada = await api.criarOS({
        cliente_id: clienteIdFinal,
        veiculo_id: veiculoIdFinal,
        mecanico_responsavel_id: user?.id || null,
        descricao_problema: novaOsProblema.trim(),
        km_atual: novaOsKm ? Number(novaOsKm) : null,
        empresa_id: empresaId,
      });

      if (osCriada.reaproveitada && (novaOsKm || novaOsProblema.trim())) {
        await api
          .atualizarOS(empresaId, osCriada.id, {
            ...(novaOsKm ? { km_atual: Number(novaOsKm) } : {}),
            ...(novaOsProblema.trim()
              ? { descricao_problema: novaOsProblema.trim() }
              : {}),
          })
          .catch(() => {});
      }

      await abrirBancadaOS(
        osCriada.id,
        osCriada.reaproveitada
          ? 'Orçamento aberto há menos de 3 meses localizado — abrimos a bancada dele!'
          : 'Nova Ordem de Serviço aberta com sucesso!'
      );
    } catch (err: unknown) {
      const customErr = err as Error;
      setErroOperacao(customErr.message || 'Erro ao abrir a Ordem de Serviço.');
    } finally {
      setCriandoOS(false);
    }
  };

  const handleMudarStatus = async (
    osId: string,
    novoStatus: StatusOS,
    formaPag?: string
  ) => {
    setErroOperacao(null);
    setFeedbackMsg(null);
    try {
      if (view === 'bancada' && dossie && selectedOsId === osId) {
        setDossie({
          ...dossie,
          ordem: {
            ...dossie.ordem,
            status: novoStatus,
            ...(novoStatus === 'PAGO'
              ? { forma_pagamento: formaPag || editFormaPagamento || 'PIX' }
              : {}),
          },
        });
      }

      await api.atualizarOS(empresaId, osId, {
        status: novoStatus,
        ...(novoStatus === 'PAGO'
          ? { forma_pagamento: formaPag || editFormaPagamento || 'PIX' }
          : {}),
      });

      if (view === 'bancada' && selectedOsId === osId) {
        await sincronizarDossieSilencioso(osId);
        setFeedbackMsg(`Etapa da OS atualizada para ${novoStatus}!`);
      } else {
        await carregarOrdens();
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErroOperacao(e.message || 'Falha ao mudar status da OS.');
      if (view === 'bancada' && selectedOsId === osId) {
        await sincronizarDossieSilencioso(osId);
      }
    }
  };

  const salvarDadosTecnicosSilencioso = async (overrides?: {
    km?: string;
    problema?: string;
    mecanicoId?: string;
  }) => {
    if (!selectedOsId || !dossie) return;
    const kmStr = overrides?.km !== undefined ? overrides.km : editKm;
    const probStr = overrides?.problema !== undefined ? overrides.problema : editProblema;
    const mecStr =
      overrides?.mecanicoId !== undefined ? overrides.mecanicoId : editMecanicoId;

    const kmNum = kmStr ? Number(kmStr) : null;
    const mudouKm = kmNum !== (dossie.ordem.km_atual ?? null);
    const mudouProb = probStr.trim() !== (dossie.ordem.descricao_problema || '').trim();
    const mudouMec = (mecStr || null) !== (dossie.ordem.mecanico_responsavel_id || null);

    if (!mudouKm && !mudouProb && !mudouMec) return;

    setStatusAutoSave('saving');
    try {
      await api.atualizarOS(empresaId, selectedOsId, {
        km_atual: kmNum,
        descricao_problema: probStr.trim(),
        mecanico_responsavel_id: mecStr || null,
      });
      setDossie((prev) =>
        prev
          ? {
              ...prev,
              ordem: {
                ...prev.ordem,
                km_atual: kmNum,
                descricao_problema: probStr.trim(),
                mecanico_responsavel_id: mecStr || null,
              },
            }
          : prev
      );
      setStatusAutoSave('saved');
    } catch (e) {
      // Sem caminho alternativo: se não salvou no servidor, a pessoa precisa saber.
      setStatusAutoSave('idle');
      setErroOperacao(
        (e as Error).message || 'Não foi possível salvar as alterações da OS. Tente novamente.'
      );
    }
  };

  const handleSelecionarPecaEstoqueReativa = (peca: EstoqueItem) => {
    setItemEstoqueId(peca.id);
    setItemNome(peca.nome);
    setItemCusto(String(peca.custo ?? 0));
    setItemVenda(String(peca.venda ?? 0));
    setBuscaEstoqueTexto('');
  };

  const handleIncluirItemNaFila = (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperacao(null);
    setFeedbackMsg(null);

    const nomeFinal = itemNome.trim();
    const qtdFinal = Number(itemQtd || 1);
    const vendaFinal = Number(String(itemVenda).replace(',', '.') || 0);
    const custoFinal =
      modoItem === 'MAO_OBRA' ? 0 : Number(String(itemCusto).replace(',', '.') || 0);

    if (!nomeFinal) {
      setErroOperacao('Informe a descrição da peça ou mão de obra.');
      return;
    }
    if (qtdFinal <= 0) {
      setErroOperacao('A quantidade deve ser maior que zero.');
      return;
    }

    const tipoApi: TipoItemOS =
      modoItem === 'MAO_OBRA'
        ? 'MAO_OBRA'
        : modoItem === 'TERCEIRIZADO'
        ? 'TERCEIRIZADO'
        : 'PECA';

    const estoqueVinculado =
      modoItem === 'PECA_ESTOQUE' && itemEstoqueId ? itemEstoqueId : null;

    if (estoqueVinculado) {
      const pecaEst = estoque.find((p) => p.id === estoqueVinculado);
      const jaNaFila = itensPendentes
        .filter((i) => i.estoque_id === estoqueVinculado)
        .reduce((acc, i) => acc + i.quantidade, 0);
      if (pecaEst && jaNaFila + qtdFinal > pecaEst.quantidade) {
        setErroOperacao(
          `Saldo insuficiente no estoque para "${pecaEst.nome}". Disponível: ${pecaEst.quantidade} un.`
        );
        return;
      }
    }

    setItensPendentes((prev) => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        estoque_id: estoqueVinculado,
        tipo: tipoApi,
        nome_item: nomeFinal,
        quantidade: qtdFinal,
        custo_unitario: custoFinal,
        venda_unitario: vendaFinal,
      },
    ]);
    setItemEstoqueId('');
    setBuscaEstoqueTexto('');
    setItemNome('');
    setItemQtd('1');
    setItemCusto('');
    setItemVenda('');
  };

  const handleLancarTodosItensNaOS = async () => {
    if (!selectedOsId || itensPendentes.length === 0) return;
    setLancandoLote(true);
    setErroOperacao(null);
    setFeedbackMsg(null);

    try {
      const payload: OSItemCreateInput[] = itensPendentes.map(
        ({ estoque_id, tipo, nome_item, quantidade, custo_unitario, venda_unitario }) => ({
          estoque_id,
          tipo,
          nome_item,
          quantidade,
          custo_unitario,
          venda_unitario,
        })
      );

      await api.adicionarItensOSLote(empresaId, selectedOsId, payload);
      const qtdLancada = payload.length;
      setItensPendentes([]);

      const [atualizado, estoqueAtualizado] = await Promise.all([
        api.obterDossieOS(empresaId, selectedOsId),
        api.listarEstoque(empresaId).catch(() => ({ itens: estoque })),
      ]);
      setDossie(atualizado);
      setEstoque(estoqueAtualizado.itens || []);
      setFeedbackMsg(
        `${qtdLancada} ${
          qtdLancada === 1 ? 'item lançado' : 'itens lançados'
        } na Ordem de Serviço!`
      );
    } catch (err: unknown) {
      const customErr = err as Error;
      setErroOperacao(customErr.message || 'Erro ao lançar lote de itens na OS.');
    } finally {
      setLancandoLote(false);
    }
  };

  const aplicarRecalculoLocal = (novosItens: OSItem[]) => {
    if (!dossie) return;
    const totalPecas = novosItens
      .filter((i) => i.tipo !== 'MAO_OBRA')
      .reduce((acc, i) => acc + Number(i.quantidade) * Number(i.venda_unitario), 0);
    const totalMaoObra = novosItens
      .filter((i) => i.tipo === 'MAO_OBRA')
      .reduce((acc, i) => acc + Number(i.quantidade) * Number(i.venda_unitario), 0);
    const custoTotal = novosItens
      .filter((i) => i.tipo !== 'MAO_OBRA')
      .reduce((acc, i) => acc + Number(i.quantidade) * Number(i.custo_unitario || 0), 0);

    setDossie({
      ...dossie,
      itens: novosItens,
      ordem: {
        ...dossie.ordem,
        total_pecas: totalPecas,
        total_mao_obra: totalMaoObra,
        total_geral: totalPecas + totalMaoObra,
        lucro_estimado: totalPecas + totalMaoObra - custoTotal,
      },
    });
  };

  const handleAlterarQtdItem = async (itemId: string, novaQtd: number) => {
    if (!selectedOsId || !dossie || novaQtd <= 0) return;
    setErroOperacao(null);
    aplicarRecalculoLocal(
      dossie.itens.map((i) => (i.id === itemId ? { ...i, quantidade: novaQtd } : i))
    );
    try {
      await api.atualizarItemOS(empresaId, selectedOsId, itemId, {
        quantidade: novaQtd,
      });
      await sincronizarDossieSilencioso(selectedOsId);
    } catch (err: unknown) {
      const customErr = err as Error;
      setErroOperacao(customErr.message || 'Falha ao atualizar quantidade.');
      await sincronizarDossieSilencioso(selectedOsId);
    }
  };

  const iniciarEdicaoItem = (item: OSItem) => {
    setEditandoItemId(item.id);
    setEditItemNome(item.nome_item);
    setEditItemTipo(item.tipo);
    setEditItemQtd(String(item.quantidade));
    setEditItemCusto(String(item.custo_unitario ?? 0));
    setEditItemVenda(String(item.venda_unitario ?? 0));
  };

  const handleSalvarEdicaoItem = async (itemId: string) => {
    if (!selectedOsId || !dossie) return;
    const qtdNum = Math.max(1, Number(editItemQtd || 1));
    const vendaNum = Number(String(editItemVenda).replace(',', '.') || 0);
    const custoNum =
      editItemTipo === 'MAO_OBRA'
        ? 0
        : Number(String(editItemCusto).replace(',', '.') || 0);
    const nomeTrim = editItemNome.trim();
    if (!nomeTrim) return;

    setSalvandoItemEditado(true);
    setErroOperacao(null);

    aplicarRecalculoLocal(
      dossie.itens.map((i) =>
        i.id === itemId
          ? {
              ...i,
              nome_item: nomeTrim,
              tipo: editItemTipo,
              quantidade: qtdNum,
              custo_unitario: custoNum,
              venda_unitario: vendaNum,
            }
          : i
      )
    );
    setEditandoItemId(null);

    try {
      await api.atualizarItemOS(empresaId, selectedOsId, itemId, {
        nome_item: nomeTrim,
        tipo: editItemTipo,
        quantidade: qtdNum,
        custo_unitario: custoNum,
        venda_unitario: vendaNum,
      });
      await sincronizarDossieSilencioso(selectedOsId);
      setFeedbackMsg('Item atualizado com sucesso!');
    } catch (err: unknown) {
      const customErr = err as Error;
      setErroOperacao(customErr.message || 'Erro ao editar item.');
      await sincronizarDossieSilencioso(selectedOsId);
    } finally {
      setSalvandoItemEditado(false);
    }
  };

  const handleRemoverItem = async (itemId: string) => {
    if (!selectedOsId || !dossie) return;
    setErroOperacao(null);
    aplicarRecalculoLocal(dossie.itens.filter((i) => i.id !== itemId));

    try {
      await api.removerItemOS(empresaId, selectedOsId, itemId);
      await sincronizarDossieSilencioso(selectedOsId);
      setFeedbackMsg('Item removido e saldo de estoque atualizado.');
    } catch (err: unknown) {
      const customErr = err as Error;
      setErroOperacao(customErr.message || 'Erro ao remover item.');
      await sincronizarDossieSilencioso(selectedOsId);
    }
  };

  const handleConfirmarExclusaoOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOsId) return;
    if (!motivoExclusao.trim() || motivoExclusao.trim().length < 4) {
      setErroOperacao('Informe o motivo do cancelamento para registro na auditoria.');
      return;
    }
    setExcluindoOS(true);
    setErroOperacao(null);
    try {
      await api.deletarOS(empresaId, selectedOsId, motivoExclusao.trim());
      setMotivoExclusao('');
      setMostrarModalExclusao(false);
      setSelectedOsId(null);
      setDossie(null);
      setView('lista');
    } catch (err: unknown) {
      const customErr = err as Error;
      setErroOperacao(customErr.message || 'Não foi possível cancelar a OS.');
    } finally {
      setExcluindoOS(false);
    }
  };

  const gerarLinkWhatsAppOrcamento = (d: OSDossie) => {
    const fone = (d.ordem.clientes?.telefone || '').replace(/\D/g, '');
    const nomeCli = d.ordem.clientes?.nome || 'Cliente';
    const placa = d.ordem.veiculos?.placa || '';
    const modelo = d.ordem.veiculos?.modelo || 'Veículo';
    const nomeOficina = d.empresa?.nome_fantasia || 'Mecanify';

    const linhasItens = d.itens.map(
      (i) =>
        `• ${i.quantidade}x ${i.nome_item}: *${formatBRL(
          i.quantidade * i.venda_unitario
        )}*`
    );

    const texto = [
      `🔧 *${nomeOficina.toUpperCase()} — ORÇAMENTO / OS*`,
      `Olá, *${nomeCli}*! Segue o detalhamento do veículo *${modelo} (${placa})*:`,
      d.ordem.descricao_problema
        ? `\n📋 *Relato/Diagnóstico:* ${d.ordem.descricao_problema}`
        : '',
      linhasItens.length > 0
        ? `\n🔩 *Peças e Serviços:*\n${linhasItens.join('\n')}`
        : '\n_Itens em levantamento técnico._',
      `\n💰 *VALOR TOTAL: ${formatBRL(d.ordem.total_geral)}*`,
      `\nPodemos prosseguir com o serviço?`,
    ]
      .filter(Boolean)
      .join('\n');

    const base = fone ? `https://wa.me/55${fone}` : 'https://wa.me/';
    return `${base}?text=${encodeURIComponent(texto)}`;
  };

  const aplicarAtalhoPeriodo = (dias: number | null) => {
    setPagina(1);
    if (dias === null) {
      setDataInicio('');
      setDataFim('');
      return;
    }
    const hoje = new Date();
    const fimStr = hoje.toISOString().slice(0, 10);
    const inicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const inicioStr = inicio.toISOString().slice(0, 10);
    setDataInicio(inicioStr);
    setDataFim(fimStr);
  };

  // ============================================================================
  // VISÃO 2: ENTRADA DE VEÍCULO (1º ESCOLHER CLIENTE -> 2º VEÍCULOS DO CLIENTE)
  // ============================================================================
  if (view === 'nova') {
    const clienteSelecionado = clientes.find((c) => c.id === clienteSelecionadoId);
    const carrosDoClienteSelecionado = clienteSelecionadoId
      ? veiculosPorCliente.get(clienteSelecionadoId) || []
      : [];
    const mostrarDropdownReativo =
      modoClienteOS === 'BUSCAR' && buscaClienteTexto.trim().length > 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 bg-[#0B1B36] border-2 border-[#12274D] rounded-2xl p-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Dar Entrada em Veículo (Nova OS)
            </h1>
            <p className="text-base text-slate-300 mt-1">
              1º Escolha o cliente (por placa, nome, CPF ou telefone) e 2º selecione o
              veículo dele.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView('lista')}
            className="min-h-[54px] px-5 py-2.5 rounded-xl bg-[#12274D] hover:bg-[#264577] border-2 border-[#3A5C90] text-white font-bold text-base flex items-center gap-2 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-[#38BDF8]" aria-hidden="true" />
            <span>Voltar ao Pátio</span>
          </button>
        </div>

        {erroOperacao && (
          <div
            aria-live="polite"
            className="p-4 rounded-xl bg-red-950 border-2 border-red-500 text-red-100 flex items-center gap-3 text-base font-medium"
          >
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" aria-hidden="true" />
            <span>{erroOperacao}</span>
          </div>
        )}

        <form
          onSubmit={handleCriarNovaOS}
          className="bg-[#0B1B36] border-2 border-[#264577] rounded-2xl p-5 sm:p-7 space-y-6"
        >
          <fieldset className="bg-[#071226] border-2 border-[#264577] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <legend className="text-xl font-bold text-white flex items-center gap-2">
                <User className="w-6 h-6 text-[#38BDF8]" aria-hidden="true" />
                <span>1. Escolher Cliente</span>
              </legend>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoClienteOS('BUSCAR')}
                  className={`min-h-[46px] px-4 py-2 rounded-xl font-bold text-sm cursor-pointer ${
                    modoClienteOS === 'BUSCAR'
                      ? 'bg-[#38BDF8] text-[#071226]'
                      : 'bg-[#12274D] text-slate-300 hover:bg-[#264577]'
                  }`}
                >
                  Buscar Cliente ({clientes.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoClienteOS('NOVO_CLIENTE');
                    setModoVeiculoCliente('NOVO_VEICULO');
                    setClienteSelecionadoId('');
                    setVeiculoSelecionadoId('');
                  }}
                  className={`min-h-[46px] px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5 cursor-pointer ${
                    modoClienteOS === 'NOVO_CLIENTE'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#12274D] text-slate-300 hover:bg-[#264577]'
                  }`}
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>+ Novo Cliente</span>
                </button>
              </div>
            </div>

            {modoClienteOS === 'BUSCAR' ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="busca-cliente-os"
                    className="block text-sm font-bold text-slate-200 mb-1.5"
                  >
                    Pesquisar Cliente por Placa do Veículo, Nome, CPF ou Telefone
                  </label>
                  <div className="relative flex items-center">
                    <Search
                      className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="busca-cliente-os"
                      name="busca_cliente_os"
                      type="search"
                      value={buscaClienteTexto}
                      onChange={(e) => setBuscaClienteTexto(e.target.value)}
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder="Comece a digitar nome, telefone, CPF ou placa (ex.: FUK2555)…"
                      className="w-full min-h-[56px] pl-11 pr-4 py-2.5 bg-[#0B1B36] border-2 border-[#3A5C90] focus:border-[#38BDF8] rounded-xl text-white text-base font-medium"
                    />
                  </div>
                </div>

                {mostrarDropdownReativo && (
                  <div
                    role="listbox"
                    aria-label="Clientes encontrados"
                    className="bg-[#0B1B36] border-2 border-[#38BDF8] rounded-xl divide-y divide-[#12274D] max-h-72 overflow-y-auto"
                  >
                    {clientesFiltrados.length === 0 ? (
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="text-sm text-slate-300">
                          Nenhum cliente encontrado para &ldquo;{buscaClienteTexto}&rdquo;.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNovoClienteNome(buscaClienteTexto.trim());
                            setModoClienteOS('NOVO_CLIENTE');
                            setModoVeiculoCliente('NOVO_VEICULO');
                          }}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2563EB] text-white font-bold text-xs cursor-pointer shrink-0"
                        >
                          + Cadastrar Novo Cliente
                        </button>
                      </div>
                    ) : (
                      clientesFiltrados.slice(0, 40).map((cli) => {
                        const carrosCli = veiculosPorCliente.get(cli.id) || [];
                        const resumoCarros =
                          carrosCli.length > 0
                            ? carrosCli
                                .map(
                                  (v) =>
                                    `${v.placa.toUpperCase()} (${v.modelo}${
                                      v.marca ? ` ${v.marca}` : ''
                                    })`
                                )
                                .join(' • ')
                            : 'Nenhum veículo vinculado ainda';

                        return (
                          <button
                            key={cli.id}
                            type="button"
                            role="option"
                            aria-selected={clienteSelecionadoId === cli.id}
                            onClick={() => handleSelecionarClienteNaLista(cli)}
                            className="w-full px-4 py-3 text-left hover:bg-[#12274D] flex items-center justify-between gap-4 cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-bold text-white truncate">
                                {cli.nome}{' '}
                                <span className="text-[#38BDF8] font-mono">
                                  - {cli.telefone || 'Sem telefone'}
                                </span>
                                {cli.cpf_cnpj && (
                                  <span className="ml-2 text-xs font-mono text-slate-400">
                                    ({cli.cpf_cnpj})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 truncate">
                                Veículos: {resumoCarros}
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded bg-[#071226] border border-[#264577] text-xs font-bold text-[#38BDF8] shrink-0">
                              Escolher
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {clienteSelecionado && (
                  <div className="bg-[#1E3A8A]/40 border-2 border-[#38BDF8] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-amber-300">
                        Cliente Selecionado
                      </div>
                      <div className="text-lg font-bold text-white">
                        {clienteSelecionado.nome}{' '}
                        <span className="text-[#38BDF8] font-mono">
                          - {clienteSelecionado.telefone || 'Sem telefone'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setClienteSelecionadoId('');
                        setVeiculoSelecionadoId('');
                      }}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#0B1B36] hover:bg-[#12274D] border border-[#3A5C90] text-slate-200 font-bold text-xs cursor-pointer"
                    >
                      Trocar Cliente
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="input-cli-nome"
                    className="block text-sm font-bold text-slate-200 mb-1.5"
                  >
                    Nome do Cliente *
                  </label>
                  <input
                    id="input-cli-nome"
                    name="cliente_nome"
                    type="text"
                    required
                    value={novoClienteNome}
                    onChange={(e) => setNovoClienteNome(e.target.value)}
                    placeholder="Ex.: Marcos Oliveira…"
                    className="w-full min-h-[52px] px-4 py-2 bg-[#0B1B36] border-2 border-[#264577] rounded-xl text-white text-base"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-cli-fone"
                    className="block text-sm font-bold text-slate-200 mb-1.5"
                  >
                    WhatsApp / Telefone *
                  </label>
                  <input
                    id="input-cli-fone"
                    name="cliente_telefone"
                    type="tel"
                    inputMode="tel"
                    required
                    value={novoClienteTelefone}
                    onChange={(e) => setNovoClienteTelefone(e.target.value)}
                    placeholder="(11) 99999-0000…"
                    className="w-full min-h-[52px] px-4 py-2 bg-[#0B1B36] border-2 border-[#264577] rounded-xl text-white font-mono text-base tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-cli-cpf"
                    className="block text-sm font-bold text-slate-200 mb-1.5"
                  >
                    CPF ou CNPJ (Opcional)
                  </label>
                  <input
                    id="input-cli-cpf"
                    name="cliente_cpf"
                    type="text"
                    inputMode="numeric"
                    autoCorrect="off"
                    value={novoClienteCpf}
                    onChange={(e) => setNovoClienteCpf(e.target.value)}
                    placeholder="000.000.000-00…"
                    className="w-full min-h-[52px] px-4 py-2 bg-[#0B1B36] border-2 border-[#264577] rounded-xl text-white font-mono text-base tabular-nums"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {(clienteSelecionado || modoClienteOS === 'NOVO_CLIENTE') && (
            <fieldset className="bg-[#071226] border-2 border-[#264577] rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <legend className="text-xl font-bold text-white flex items-center gap-2">
                  <Car className="w-6 h-6 text-[#38BDF8]" aria-hidden="true" />
                  <span>
                    2. Veículo de{' '}
                    {modoClienteOS === 'NOVO_CLIENTE'
                      ? novoClienteNome || 'Novo Cliente'
                      : clienteSelecionado?.nome}
                  </span>
                </legend>

                {modoClienteOS === 'BUSCAR' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModoVeiculoCliente('DO_CLIENTE')}
                      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer ${
                        modoVeiculoCliente === 'DO_CLIENTE'
                          ? 'bg-[#38BDF8] text-[#071226]'
                          : 'bg-[#12274D] text-slate-300 hover:bg-[#264577]'
                      }`}
                    >
                      Veículos do Cliente ({carrosDoClienteSelecionado.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoVeiculoCliente('NOVO_VEICULO');
                        setVeiculoSelecionadoId('');
                      }}
                      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                        modoVeiculoCliente === 'NOVO_VEICULO'
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-[#12274D] text-slate-300 hover:bg-[#264577]'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      <span>+ Novo Veículo (Buscar Placa)</span>
                    </button>
                  </div>
                )}
              </div>

              {modoClienteOS === 'BUSCAR' && modoVeiculoCliente === 'DO_CLIENTE' ? (
                carrosDoClienteSelecionado.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#0B1B36] border border-[#264577] flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-300">
                      Este cliente ainda não possui veículos cadastrados.
                    </span>
                    <button
                      type="button"
                      onClick={() => setModoVeiculoCliente('NOVO_VEICULO')}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2563EB] text-white font-bold text-xs cursor-pointer"
                    >
                      + Cadastrar Veículo pela Placa
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {carrosDoClienteSelecionado.map((v) => {
                      const selecionado = veiculoSelecionadoId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setVeiculoSelecionadoId(v.id);
                            if (v.km_atual) setNovaOsKm(String(v.km_atual));
                          }}
                          className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between gap-4 cursor-pointer ${
                            selecionado
                              ? 'bg-[#1E3A8A] border-[#38BDF8] text-white'
                              : 'bg-[#0B1B36] border-[#264577] hover:border-slate-400 text-slate-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-3 min-w-0">
                            <span
                              translate="no"
                              className="px-3 py-1 rounded-lg bg-[#071226] border border-[#38BDF8] font-mono text-lg font-bold text-[#38BDF8] uppercase tracking-wider"
                            >
                              {v.placa}
                            </span>
                            <div className="min-w-0">
                              <div className="text-base font-bold text-white truncate">
                                {v.modelo} {v.marca ? `• ${v.marca}` : ''}
                              </div>
                              <div className="text-xs text-slate-300 font-mono">
                                {v.cor ? `Cor: ${v.cor} • ` : ''}
                                {v.ano ? `Ano: ${v.ano} • ` : ''}
                                {v.km_atual
                                  ? `Último KM: ${v.km_atual.toLocaleString('pt-BR')}`
                                  : 'KM não informado'}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selecionado
                                ? 'bg-[#38BDF8] border-[#38BDF8] text-[#071226]'
                                : 'border-slate-500'
                            }`}
                          >
                            {selecionado && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="input-nova-placa"
                        className="block text-sm font-bold text-slate-200 mb-1.5"
                      >
                        Placa do Veículo
                      </label>
                      <input
                        id="input-nova-placa"
                        name="placa_veiculo"
                        type="text"
                        maxLength={8}
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        value={novaPlaca}
                        onChange={(e) => setNovaPlaca(e.target.value.toUpperCase())}
                        placeholder="ABC1D23…"
                        className="w-full min-h-[54px] px-4 py-2.5 bg-[#0B1B36] border-2 border-[#38BDF8] rounded-xl font-mono text-xl font-bold text-white uppercase tracking-widest"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <button
                        type="button"
                        disabled={buscandoPlaca}
                        onClick={handleConsultarPlaca}
                        className="w-full min-h-[54px] px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-base flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                      >
                        <Search className="w-5 h-5" aria-hidden="true" />
                        <span>
                          {buscandoPlaca
                            ? 'Consultando Placa…'
                            : 'Puxar Modelo / Marca pela Placa'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {avisoPlaca && (
                    <div className="p-3 rounded-lg bg-[#12274D] border border-[#3A5C90] text-slate-200 text-xs font-medium">
                      {avisoPlaca}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="input-novo-modelo"
                        className="block text-xs font-bold text-slate-200 mb-1"
                      >
                        Modelo do Carro *
                      </label>
                      <input
                        id="input-novo-modelo"
                        name="modelo_veiculo"
                        type="text"
                        required
                        value={novoModelo}
                        onChange={(e) => setNovoModelo(e.target.value)}
                        placeholder="Ex.: Onix 1.0 Turbo…"
                        className="w-full min-h-[48px] px-3.5 py-2 bg-[#0B1B36] border-2 border-[#264577] rounded-xl text-white text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="input-nova-marca"
                        className="block text-xs font-bold text-slate-200 mb-1"
                      >
                        Marca
                      </label>
                      <input
                        id="input-nova-marca"
                        name="marca_veiculo"
                        type="text"
                        value={novaMarca}
                        onChange={(e) => setNovaMarca(e.target.value)}
                        placeholder="Chevrolet…"
                        className="w-full min-h-[48px] px-3.5 py-2 bg-[#0B1B36] border-2 border-[#264577] rounded-xl text-white text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="input-nova-cor"
                          className="block text-xs font-bold text-slate-200 mb-1"
                        >
                          Cor
                        </label>
                        <input
                          id="input-nova-cor"
                          name="cor_veiculo"
                          type="text"
                          value={novaCor}
                          onChange={(e) => setNovaCor(e.target.value)}
                          placeholder="Prata"
                          className="w-full min-h-[48px] px-3 py-2 bg-[#0B1B36] border-2 border-[#264577] rounded-xl text-white text-sm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="input-novo-ano"
                          className="block text-xs font-bold text-slate-200 mb-1"
                        >
                          Ano
                        </label>
                        <input
                          id="input-novo-ano"
                          name="ano_veiculo"
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={novoAno}
                          onChange={(e) => setNovoAno(e.target.value.replace(/\D/g, ''))}
                          placeholder="2022"
                          className="w-full min-h-[48px] px-3 py-2 bg-[#0B1B36] border-2 border-[#264577] rounded-xl text-white font-mono text-sm tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </fieldset>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4">
              <label
                htmlFor="input-os-km"
                className="block text-sm font-bold text-white mb-1.5"
              >
                KM Atual no Painel
              </label>
              <input
                id="input-os-km"
                name="km_atual"
                type="text"
                inputMode="numeric"
                autoCorrect="off"
                value={novaOsKm}
                onChange={(e) => setNovaOsKm(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex.: 84500…"
                className="w-full min-h-[54px] px-4 py-2.5 bg-[#071226] border-2 border-[#264577] focus:border-[#38BDF8] rounded-xl text-white font-mono text-lg tabular-nums"
              />
            </div>

            <div className="sm:col-span-8">
              <label
                htmlFor="input-os-problema"
                className="block text-sm font-bold text-white mb-1.5"
              >
                Relato do Problema / Serviço Solicitado
              </label>
              <input
                id="input-os-problema"
                name="descricao_problema"
                type="text"
                value={novaOsProblema}
                onChange={(e) => setNovaOsProblema(e.target.value)}
                placeholder="Ex.: Barulho na suspensão dianteira e revisão de freios…"
                className="w-full min-h-[54px] px-4 py-2.5 bg-[#071226] border-2 border-[#264577] focus:border-[#38BDF8] rounded-xl text-white text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={criandoOS}
            className="w-full min-h-[60px] px-6 py-3.5 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-bold text-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            <PlusCircle className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
            <span>
              {criandoOS
                ? 'Verificando Orçamentos e Abrindo Bancada…'
                : 'Abrir Ordem de Serviço e Ir para Bancada'}
            </span>
          </button>
        </form>
      </div>
    );
  }

  // ============================================================================
  // VISÃO 3: BANCADA DA OS (COMPACTA PARA 100+ ITENS + IMPRESSÃO DIRETA A4)
  // ============================================================================
  if (view === 'bancada') {
    if (loadingDossie || !dossie) {
      return (
        <div className="h-80 bg-[#0B1B36] border-2 border-[#12274D] rounded-2xl p-8 flex items-center justify-center gap-4 text-lg font-bold text-white">
          <progress aria-label="Carregando bancada" className="loading-spinner" />
          <span>Carregando Ficha Completa da OS…</span>
        </div>
      );
    }

    const os = dossie.ordem;
    const statusAtual = (os.status as StatusOS) || 'ORCAMENTO';
    const subtotalPendentes = itensPendentes.reduce(
      (acc, i) => acc + i.quantidade * i.venda_unitario,
      0
    );

    const pecasImp = dossie.itens.filter((i) => i.tipo === 'PECA');
    const servicosImp = dossie.itens.filter((i) => i.tipo === 'MAO_OBRA');
    const terceirizadosImp = dossie.itens.filter((i) => i.tipo === 'TERCEIRIZADO');

    const totalPecasSomente = pecasImp.reduce(
      (acc, i) => acc + i.quantidade * i.venda_unitario,
      0
    );
    const totalMaoObraSomente = servicosImp.reduce(
      (acc, i) => acc + i.quantidade * i.venda_unitario,
      0
    );
    const totalTerceirizadoSomente = terceirizadosImp.reduce(
      (acc, i) => acc + i.quantidade * i.venda_unitario,
      0
    );
    const custoTotalOS = dossie.itens
      .filter((i) => i.tipo !== 'MAO_OBRA')
      .reduce((acc, i) => acc + i.quantidade * Number(i.custo_unitario || 0), 0);
    const lucroTotalOS = Number(os.total_geral || 0) - custoTotalOS;

    const itensLancadosFiltrados = dossie.itens.filter((i) => {
      if (abaItensLancados !== 'TODOS' && i.tipo !== abaItensLancados) return false;
      if (buscaItemLancado.trim()) {
        return i.nome_item
          .toLowerCase()
          .includes(buscaItemLancado.trim().toLowerCase());
      }
      return true;
    });

    const pecaEstoqueSelecionada = estoque.find((p) => p.id === itemEstoqueId);

    return (
      <div>
        {/* ==================================================================== */}
        {/* FOLHA A4 COMPACTA OCULTA NA TELA — VAI DIRETO PARA IMPRESSÃO         */}
        {/* 3 Seções separadas (Peças, Mão de Obra, Terceirizados) + Preto Forte */}
        {/* ==================================================================== */}
        <div className="hidden print:block bg-white text-black text-[11px] leading-tight font-sans p-2 space-y-2.5">
          {/* Cabeçalho Compacto */}
          <div className="border-b-2 border-black pb-2 flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-black uppercase text-black">
                {dossie.empresa?.nome_fantasia || 'Mecanify Oficina'}
              </div>
              <div className="text-[10px] text-black">
                {dossie.empresa?.cnpj ? `CNPJ: ${dossie.empresa.cnpj} • ` : ''}
                {dossie.empresa?.telefone ? `Tel: ${dossie.empresa.telefone}` : ''}
              </div>
              {dossie.empresa?.endereco && (
                <div className="text-[10px] text-black">{dossie.empresa.endereco}</div>
              )}
            </div>

            <div className="border border-black rounded px-2.5 py-1 text-right">
              <div className="text-[9px] font-bold uppercase text-black">
                ORDEM DE SERVIÇO #{os.id.slice(0, 8).toUpperCase()}
              </div>
              <div className="text-[10px] font-bold text-black">
                Status: {os.status} • {formatDataHora(os.data_abertura)}
              </div>
            </div>
          </div>

          {/* Linha única de Cliente + Veículo + Relato */}
          <div className="grid grid-cols-2 gap-2 border border-black rounded p-2">
            <div>
              <span className="font-bold uppercase text-[9px] block">Cliente:</span>
              <span className="font-bold text-xs text-black">
                {os.clientes?.nome || '—'}
              </span>{' '}
              <span className="text-[10px] text-black">
                • Tel: {os.clientes?.telefone || '—'}
                {os.clientes?.cpf_cnpj ? ` • CPF/CNPJ: ${os.clientes.cpf_cnpj}` : ''}
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold uppercase text-[9px] block">Veículo:</span>
              <span className="font-mono font-black text-xs text-black uppercase">
                PLACA: {os.veiculos?.placa || '—'}
              </span>{' '}
              <span className="text-[10px] font-bold text-black">
                • {os.veiculos?.marca} {os.veiculos?.modelo}
                {os.veiculos?.ano ? ` (${os.veiculos.ano})` : ''}
                {os.km_atual != null
                  ? ` • KM: ${os.km_atual.toLocaleString('pt-BR')}`
                  : ''}
              </span>
            </div>
            {os.descricao_problema && (
              <div className="col-span-2 border-t border-black/40 pt-1 text-[10px] text-black">
                <strong>Relato / Diagnóstico:</strong> {os.descricao_problema}
              </div>
            )}
          </div>

          {/* SEÇÃO 1: PEÇAS */}
          {pecasImp.length > 0 && (
            <div>
              <div className="font-black uppercase text-[10px] text-black mb-0.5 flex justify-between">
                <span>1. Peças e Materiais ({pecasImp.length})</span>
                <span>Subtotal Peças: {formatBRL(totalPecasSomente)}</span>
              </div>
              <table className="w-full border-collapse border border-black text-[10px] text-black">
                <thead>
                  <tr className="border-b border-black bg-gray-100">
                    <th className="border-r border-black py-0.5 px-1.5 text-left">
                      Peça / Material
                    </th>
                    <th className="border-r border-black py-0.5 px-1 text-center w-12">
                      Qtd
                    </th>
                    <th className="border-r border-black py-0.5 px-1.5 text-right w-24">
                      Unitário
                    </th>
                    <th className="py-0.5 px-1.5 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {pecasImp.map((item) => (
                    <tr key={item.id} className="border-b border-black/40">
                      <td className="border-r border-black py-0.5 px-1.5">
                        {item.nome_item}
                      </td>
                      <td className="border-r border-black py-0.5 px-1 text-center font-mono">
                        {item.quantidade}
                      </td>
                      <td className="border-r border-black py-0.5 px-1.5 text-right font-mono">
                        {formatBRL(item.venda_unitario)}
                      </td>
                      <td className="py-0.5 px-1.5 text-right font-mono font-bold">
                        {formatBRL(item.quantidade * item.venda_unitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SEÇÃO 2: MÃO DE OBRA */}
          {servicosImp.length > 0 && (
            <div>
              <div className="font-black uppercase text-[10px] text-black mb-0.5 flex justify-between">
                <span>2. Mão de Obra e Serviços ({servicosImp.length})</span>
                <span>Subtotal Mão de Obra: {formatBRL(totalMaoObraSomente)}</span>
              </div>
              <table className="w-full border-collapse border border-black text-[10px] text-black">
                <thead>
                  <tr className="border-b border-black bg-gray-100">
                    <th className="border-r border-black py-0.5 px-1.5 text-left">
                      Serviço Executado
                    </th>
                    <th className="border-r border-black py-0.5 px-1 text-center w-12">
                      Qtd
                    </th>
                    <th className="border-r border-black py-0.5 px-1.5 text-right w-24">
                      Valor
                    </th>
                    <th className="py-0.5 px-1.5 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {servicosImp.map((item) => (
                    <tr key={item.id} className="border-b border-black/40">
                      <td className="border-r border-black py-0.5 px-1.5">
                        {item.nome_item}
                      </td>
                      <td className="border-r border-black py-0.5 px-1 text-center font-mono">
                        {item.quantidade}
                      </td>
                      <td className="border-r border-black py-0.5 px-1.5 text-right font-mono">
                        {formatBRL(item.venda_unitario)}
                      </td>
                      <td className="py-0.5 px-1.5 text-right font-mono font-bold">
                        {formatBRL(item.quantidade * item.venda_unitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SEÇÃO 3: SERVIÇOS TERCEIRIZADOS */}
          {terceirizadosImp.length > 0 && (
            <div>
              <div className="font-black uppercase text-[10px] text-black mb-0.5 flex justify-between">
                <span>3. Serviços Terceirizados ({terceirizadosImp.length})</span>
                <span>Subtotal Terceirizados: {formatBRL(totalTerceirizadoSomente)}</span>
              </div>
              <table className="w-full border-collapse border border-black text-[10px] text-black">
                <thead>
                  <tr className="border-b border-black bg-gray-100">
                    <th className="border-r border-black py-0.5 px-1.5 text-left">
                      Serviço Terceirizado
                    </th>
                    <th className="border-r border-black py-0.5 px-1 text-center w-12">
                      Qtd
                    </th>
                    <th className="border-r border-black py-0.5 px-1.5 text-right w-24">
                      Unitário
                    </th>
                    <th className="py-0.5 px-1.5 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {terceirizadosImp.map((item) => (
                    <tr key={item.id} className="border-b border-black/40">
                      <td className="border-r border-black py-0.5 px-1.5">
                        {item.nome_item}
                      </td>
                      <td className="border-r border-black py-0.5 px-1 text-center font-mono">
                        {item.quantidade}
                      </td>
                      <td className="border-r border-black py-0.5 px-1.5 text-right font-mono">
                        {formatBRL(item.venda_unitario)}
                      </td>
                      <td className="py-0.5 px-1.5 text-right font-mono font-bold">
                        {formatBRL(item.quantidade * item.venda_unitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé de Totais em Preto Puro (alto contraste na impressora) */}
          <div className="border-t-2 border-black pt-2 flex items-center justify-between gap-4">
            <div className="text-[10px] text-black space-x-3">
              <span>
                Peças: <strong>{formatBRL(totalPecasSomente)}</strong>
              </span>
              <span>
                Mão de Obra: <strong>{formatBRL(totalMaoObraSomente)}</strong>
              </span>
              {totalTerceirizadoSomente > 0 && (
                <span>
                  Terceirizados: <strong>{formatBRL(totalTerceirizadoSomente)}</strong>
                </span>
              )}
              {os.forma_pagamento && (
                <span>
                  Pagamento: <strong>{os.forma_pagamento}</strong>
                </span>
              )}
            </div>

            <div className="border-2 border-black rounded px-3 py-1 text-right bg-white text-black">
              <div className="text-[9px] font-bold uppercase text-black">
                VALOR TOTAL DA ORDEM DE SERVIÇO
              </div>
              <div className="text-lg font-black font-mono text-black tabular-nums">
                {formatBRL(os.total_geral)}
              </div>
            </div>
          </div>

          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px] text-black">
            <div className="border-t border-black pt-1">
              Assinatura do Responsável Técnico
            </div>
            <div className="border-t border-black pt-1">
              De acordo — {os.clientes?.nome || 'Assinatura do Cliente'}
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* INTERFACE DE TELA DA BANCADA (OCULTA NA IMPRESSÃO VIA print:hidden)  */}
        {/* ==================================================================== */}
        <div className="print:hidden space-y-3 sm:space-y-4">
          {/* Topo da Bancada Compacto + Excluir OS como Ícone */}
          <div className="bg-[#0B1B36] border-2 border-[#264577] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setView('lista');
                    setSelectedOsId(null);
                  }}
                  aria-label="Voltar ao pátio"
                  className="min-h-[38px] sm:min-h-[44px] px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl bg-[#071226] hover:bg-[#12274D] border border-[#3A5C90] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                  <span className="hidden sm:inline">Pátio</span>
                </button>

                <span
                  translate="no"
                  className="px-2.5 py-1 rounded-lg bg-[#12274D] border border-[#38BDF8] font-mono text-sm sm:text-lg font-extrabold text-white uppercase tracking-wider shrink-0"
                >
                  {os.veiculos?.placa || 'SEM-PLACA'}
                </span>

                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-extrabold text-white truncate leading-tight">
                    {os.veiculos?.marca} {os.veiculos?.modelo}
                  </h1>
                  <p className="text-xs text-slate-300 truncate">
                    <strong className="text-white">{os.clientes?.nome || '—'}</strong>
                    {os.clientes?.telefone ? ` • ${os.clientes.telefone}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <a
                  href={gerarLinkWhatsAppOrcamento(dossie)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Mandar Orçamento no WhatsApp"
                  title="Mandar no WhatsApp"
                  className="min-h-[38px] sm:min-h-[44px] px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden md:inline">WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Imprimir Direto (A4)"
                  title="Imprimir Direto (A4)"
                  className="min-h-[38px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 rounded-lg sm:rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden md:inline">Imprimir (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarModalExclusao((v) => !v)}
                  aria-label="Cancelar Ordem de Serviço"
                  title="Cancelar / Excluir Ordem de Serviço"
                  className="min-h-[38px] sm:min-h-[44px] px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-red-950 hover:bg-red-900 border border-red-600 text-red-200 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Confirmação compacta de cancelamento quando acionado pelo ícone de lixeira */}
            {mostrarModalExclusao && (
              <form
                onSubmit={handleConfirmarExclusaoOS}
                className="bg-red-950/60 border border-red-500 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <input
                  id="input-motivo-exclusao"
                  name="motivo_exclusao"
                  type="text"
                  required
                  value={motivoExclusao}
                  onChange={(e) => setMotivoExclusao(e.target.value)}
                  placeholder="Motivo obrigatório do cancelamento da OS…"
                  aria-label="Motivo obrigatório do cancelamento"
                  className="flex-1 min-h-[38px] px-3 py-1.5 bg-[#071226] border border-red-500 rounded-lg text-white text-xs"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMostrarModalExclusao(false)}
                    className="min-h-[38px] px-3 rounded-lg bg-[#12274D] text-white font-bold text-xs cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={excluindoOS}
                    className="min-h-[38px] px-3.5 rounded-lg bg-red-600 text-white font-bold text-xs cursor-pointer"
                  >
                    {excluindoOS ? 'Cancelando…' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div aria-live="polite">
            {feedbackMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{feedbackMsg}</span>
              </div>
            )}
            {erroOperacao && (
              <div className="p-2.5 rounded-xl bg-red-950 border border-red-500 text-red-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{erroOperacao}</span>
              </div>
            )}
          </div>

          {/* Seletor de Etapa da OS Compacto */}
          <section
            aria-label="Etapa atual da Ordem de Serviço"
            className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white">
                Etapa do Serviço
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                OS #{os.id.slice(0, 8).toUpperCase()} &bull;{' '}
                {formatDataHora(os.data_abertura)}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {STATUS_LIST.map((st) => {
                const Icon = st.icon;
                const ativo = statusAtual === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleMudarStatus(os.id, st.id)}
                    className={`min-h-[38px] sm:min-h-[46px] px-2 py-1.5 rounded-lg sm:rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                      ativo
                        ? st.activeBtn
                        : 'bg-[#071226] border-[#264577] text-slate-300 hover:bg-[#12274D]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{st.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {(statusAtual === 'FINALIZADO' || statusAtual === 'PAGO') && (
              <div className="pt-2.5 border-t border-[#12274D] flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-200">
                  Forma de Pagamento:
                </span>
                {FORMAS_PAGAMENTO.map((fp) => (
                  <button
                    key={fp}
                    type="button"
                    onClick={() => {
                      setEditFormaPagamento(fp);
                      if (statusAtual === 'PAGO') {
                        handleMudarStatus(os.id, 'PAGO', fp);
                      }
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg font-bold text-xs border cursor-pointer ${
                      editFormaPagamento === fp
                        ? 'bg-[#38BDF8] text-[#071226] border-[#38BDF8]'
                        : 'bg-[#071226] text-slate-300 border-[#264577]'
                    }`}
                  >
                    {fp}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* GRID PRINCIPAL DA BANCADA */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* COLUNA ESQUERDA (8 COL): LANÇAMENTO + TABELA COMPACTA COM SCROLL */}
            <section className="xl:col-span-8 bg-[#0B1B36] border-2 border-[#12274D] rounded-2xl p-4 sm:p-5 space-y-4">
              {/* Abas do Tipo de Item a Lançar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#071226] p-1.5 rounded-xl border border-[#12274D]">
                {[
                  { id: 'PECA_ESTOQUE', label: 'Peça do Estoque' },
                  { id: 'PECA_AVULSA', label: 'Peça Avulsa' },
                  { id: 'MAO_OBRA', label: 'Mão de Obra' },
                  { id: 'TERCEIRIZADO', label: 'Terceirizado' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setModoItem(t.id as typeof modoItem);
                      setItemEstoqueId('');
                      setBuscaEstoqueTexto('');
                      setItemNome('');
                      setItemCusto('');
                      setItemVenda('');
                    }}
                    className={`min-h-[44px] px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm cursor-pointer ${
                      modoItem === t.id
                        ? 'bg-[#38BDF8] text-[#071226]'
                        : 'text-slate-300 hover:bg-[#12274D]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Formulário de Adição com Busca Reativa de Estoque + Custo p/ Peça/Terceirizado */}
              <form
                onSubmit={handleIncluirItemNaFila}
                className="bg-[#071226] border-2 border-[#264577] rounded-xl p-4 space-y-3"
              >
                {modoItem === 'PECA_ESTOQUE' && (
                  <div className="space-y-2">
                    <label
                      htmlFor="busca-peca-estoque"
                      className="block text-xs font-bold text-slate-200"
                    >
                      Pesquisar Peça no Estoque por Nome ou SKU/Código (apenas saldo &gt; 0)
                    </label>
                    <div className="relative flex items-center">
                      <Search
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="busca-peca-estoque"
                        name="busca_estoque"
                        type="search"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={buscaEstoqueTexto}
                        onChange={(e) => setBuscaEstoqueTexto(e.target.value)}
                        placeholder="Comece a digitar o nome da peça ou código SKU…"
                        className="w-full min-h-[46px] pl-10 pr-4 py-2 bg-[#0B1B36] border border-[#3A5C90] focus:border-[#38BDF8] rounded-xl text-white text-sm"
                      />
                    </div>

                    {/* Lista Reativa de Estoque (só aparece ao digitar, sem itens zerados) */}
                    {buscaEstoqueTexto.trim().length > 0 && (
                      <div
                        role="listbox"
                        aria-label="Peças encontradas no estoque"
                        className="bg-[#0B1B36] border-2 border-[#38BDF8] rounded-xl divide-y divide-[#12274D] max-h-56 overflow-y-auto"
                      >
                        {pecasEstoqueFiltradas.length === 0 ? (
                          <div className="p-3 text-xs text-slate-300">
                            Nenhuma peça com saldo disponível encontrada para &ldquo;
                            {buscaEstoqueTexto}&rdquo;.
                          </div>
                        ) : (
                          pecasEstoqueFiltradas.slice(0, 30).map((p) => {
                            const sku =
                              p.codigo && p.codigo !== 'None' ? p.codigo : null;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                role="option"
                                aria-selected={itemEstoqueId === p.id}
                                onClick={() => handleSelecionarPecaEstoqueReativa(p)}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-[#12274D] flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-white truncate">
                                    {p.nome}
                                    {sku && (
                                      <span className="ml-2 px-1.5 py-0.5 rounded bg-[#071226] text-[#38BDF8] font-mono text-[11px]">
                                        SKU: {sku}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                                    Saldo: <strong className="text-emerald-400">{p.quantidade} un.</strong>{' '}
                                    • Custo: {formatBRL(p.custo)} • Venda:{' '}
                                    <strong className="text-white">{formatBRL(p.venda)}</strong>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-[#38BDF8] text-[#071226] font-bold text-xs shrink-0">
                                  Usar
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {pecaEstoqueSelecionada && (
                      <div className="px-3 py-1.5 rounded-lg bg-[#1E3A8A]/40 border border-[#38BDF8] flex items-center justify-between text-xs text-amber-200">
                        <span>
                          Selecionado: <strong>{pecaEstoqueSelecionada.nome}</strong> (Saldo:{' '}
                          {pecaEstoqueSelecionada.quantidade} un.)
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemEstoqueId('')}
                          className="text-slate-300 hover:text-white underline cursor-pointer"
                        >
                          Desvincular
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Linha de Inputs: Descrição + Qtd/Custo/Venda lado a lado no mobile */}
                <div className="grid grid-cols-3 sm:grid-cols-12 gap-2 items-end">
                  <div
                    className={
                      modoItem === 'MAO_OBRA'
                        ? 'col-span-3 sm:col-span-6'
                        : 'col-span-3 sm:col-span-5'
                    }
                  >
                    <label
                      htmlFor="input-item-nome"
                      className="block text-xs font-bold text-slate-200 mb-1"
                    >
                      Descrição do Item / Serviço
                    </label>
                    <input
                      id="input-item-nome"
                      name="nome_item"
                      type="text"
                      required
                      value={itemNome}
                      onChange={(e) => setItemNome(e.target.value)}
                      placeholder={
                        modoItem === 'MAO_OBRA'
                          ? 'Ex.: Troca de kit embreagem…'
                          : 'Ex.: Jogo de pastilhas dianteiras…'
                      }
                      className="w-full min-h-[40px] px-3 py-1.5 bg-[#0B1B36] border border-[#264577] rounded-lg text-white text-sm"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label
                      htmlFor="input-item-qtd"
                      className="block text-xs font-bold text-slate-200 mb-1"
                    >
                      Qtd
                    </label>
                    <input
                      id="input-item-qtd"
                      name="quantidade"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={itemQtd}
                      onChange={(e) => setItemQtd(e.target.value)}
                      className="w-full min-h-[40px] px-2 py-1.5 bg-[#0B1B36] border border-[#264577] rounded-lg text-white font-mono text-sm text-center tabular-nums"
                    />
                  </div>

                  {canSeeFinanceiro && modoItem !== 'MAO_OBRA' && (
                    <div className="col-span-1 sm:col-span-2">
                      <label
                        htmlFor="input-item-custo"
                        className="block text-xs font-bold text-slate-200 mb-1"
                      >
                        Custo (R$)
                      </label>
                      <input
                        id="input-item-custo"
                        name="custo_unitario"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={itemCusto}
                        onChange={(e) => setItemCusto(e.target.value)}
                        placeholder="0,00"
                        className="w-full min-h-[40px] px-2 py-1.5 bg-[#0B1B36] border border-[#264577] rounded-lg text-slate-200 font-mono text-sm tabular-nums"
                      />
                    </div>
                  )}

                  <div
                    className={
                      !canSeeFinanceiro || modoItem === 'MAO_OBRA'
                        ? 'col-span-2 sm:col-span-4'
                        : 'col-span-1 sm:col-span-3'
                    }
                  >
                    <label
                      htmlFor="input-item-venda"
                      className="block text-xs font-bold text-slate-200 mb-1"
                    >
                      Venda (R$)
                    </label>
                    <input
                      id="input-item-venda"
                      name="venda_unitario"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      required
                      value={itemVenda}
                      onChange={(e) => setItemVenda(e.target.value)}
                      placeholder="0,00"
                      className="w-full min-h-[40px] px-2.5 py-1.5 bg-[#0B1B36] border border-[#264577] rounded-lg text-white font-mono text-sm tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[42px] px-4 py-1.5 rounded-xl bg-[#12274D] hover:bg-[#264577] border border-[#38BDF8] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                  <span>Incluir na Fila de Lançamento</span>
                </button>
              </form>

              {/* FILA DE ITENS PRONTOS PARA LANÇAR DE UMA SÓ VEZ */}
              {itensPendentes.length > 0 && (
                <div className="bg-amber-950/40 border-2 border-[#38BDF8] rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                      Fila para Lançar ({itensPendentes.length})
                    </span>
                    <span className="font-mono text-white tabular-nums">
                      Subtotal Lote: {formatBRL(subtotalPendentes)}
                    </span>
                  </div>

                  <div className="divide-y divide-[#12274D] max-h-44 overflow-y-auto bg-[#071226] rounded-lg border border-[#264577]">
                    {itensPendentes.map((item) => (
                      <div
                        key={item.tempId}
                        className="px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-xs"
                      >
                        <div className="min-w-0 sm:flex-1 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 shrink-0">
                            {item.tipo}
                          </span>
                          <span className="font-bold text-white break-words sm:truncate">
                            {item.nome_item}
                          </span>
                        </div>
                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 shrink-0 font-mono tabular-nums">
                          {canSeeFinanceiro && item.tipo !== 'MAO_OBRA' ? (
                            <span className="text-slate-400 text-[11px]">
                              Custo: {formatBRL(item.custo_unitario)}
                            </span>
                          ) : (
                            <span />
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">
                              {item.quantidade}x {formatBRL(item.venda_unitario)} ={' '}
                              {formatBRL(item.quantidade * item.venda_unitario)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setItensPendentes((prev) =>
                                  prev.filter((i) => i.tempId !== item.tempId)
                                )
                              }
                              aria-label={`Remover ${item.nome_item} da fila`}
                              className="p-1 text-red-400 hover:text-red-200 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={lancandoLote}
                    onClick={handleLancarTodosItensNaOS}
                    className="w-full min-h-[50px] px-4 py-2.5 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                    <span>
                      {lancandoLote
                        ? 'Lançando lote na OS…'
                        : `Lançar Todos os ${itensPendentes.length} Itens na OS (${formatBRL(
                            subtotalPendentes
                          )})`}
                    </span>
                  </button>
                </div>
              )}

              {/* LISTA COMPACTA COM SCROLL PARA 100+ ITENS E EDIÇÃO INLINE */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'TODOS', label: `Todos (${dossie.itens.length})` },
                        { id: 'PECA', label: `Peças (${pecasImp.length})` },
                        { id: 'MAO_OBRA', label: `Mão de Obra (${servicosImp.length})` },
                        {
                          id: 'TERCEIRIZADO',
                          label: `Terceirizado (${terceirizadosImp.length})`,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAbaItensLancados(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          abaItensLancados === tab.id
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-[#071226] text-slate-300 border border-[#264577]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {dossie.itens.length > 5 && (
                    <input
                      type="search"
                      value={buscaItemLancado}
                      onChange={(e) => setBuscaItemLancado(e.target.value)}
                      placeholder="Filtrar item lançado…"
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-[#071226] border border-[#264577] text-white text-xs"
                    />
                  )}
                </div>

                {itensLancadosFiltrados.length === 0 ? (
                  <div className="bg-[#071226] border border-[#12274D] rounded-xl p-5 text-center text-slate-400 text-sm">
                    Nenhum item lançado nesta categoria.
                  </div>
                ) : (
                  <div className="bg-[#071226] border-2 border-[#264577] rounded-xl divide-y divide-[#12274D] max-h-[460px] overflow-y-auto">
                    {itensLancadosFiltrados.map((item) => {
                      const emEdicao = editandoItemId === item.id;
                      const lucroItem =
                        item.tipo === 'MAO_OBRA'
                          ? item.quantidade * item.venda_unitario
                          : item.quantidade *
                            (item.venda_unitario - Number(item.custo_unitario || 0));

                      if (emEdicao) {
                        return (
                          <div key={item.id} className="p-3 bg-[#12274D]/60 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                              <div className="sm:col-span-4">
                                <label className="block text-[10px] font-bold text-slate-300">
                                  Descrição
                                </label>
                                <input
                                  type="text"
                                  value={editItemNome}
                                  onChange={(e) => setEditItemNome(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded bg-[#071226] border border-[#3A5C90] text-white text-xs"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-300">
                                  Tipo
                                </label>
                                <select
                                  value={editItemTipo}
                                  onChange={(e) =>
                                    setEditItemTipo(e.target.value as TipoItemOS)
                                  }
                                  className="w-full px-2 py-1.5 rounded bg-[#071226] border border-[#3A5C90] text-white text-xs"
                                >
                                  <option value="PECA">Peça</option>
                                  <option value="MAO_OBRA">Mão de Obra</option>
                                  <option value="TERCEIRIZADO">Terceirizado</option>
                                </select>
                              </div>

                              <div className="sm:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-300">
                                  Qtd
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={editItemQtd}
                                  onChange={(e) => setEditItemQtd(e.target.value)}
                                  className="w-full px-1.5 py-1.5 rounded bg-[#071226] border border-[#3A5C90] text-white font-mono text-xs text-center"
                                />
                              </div>

                              {canSeeFinanceiro && editItemTipo !== 'MAO_OBRA' && (
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-bold text-slate-300">
                                    Custo Unit.
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editItemCusto}
                                    onChange={(e) => setEditItemCusto(e.target.value)}
                                    className="w-full px-2 py-1.5 rounded bg-[#071226] border border-[#3A5C90] text-white font-mono text-xs"
                                  />
                                </div>
                              )}

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-300">
                                  Venda Unit.
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editItemVenda}
                                  onChange={(e) => setEditItemVenda(e.target.value)}
                                  className="w-full px-2 py-1.5 rounded bg-[#071226] border border-[#3A5C90] text-white font-mono text-xs"
                                />
                              </div>

                              <div className="sm:col-span-1 flex items-center gap-1 justify-end">
                                <button
                                  type="button"
                                  disabled={salvandoItemEditado}
                                  onClick={() => handleSalvarEdicaoItem(item.id)}
                                  title="Salvar edição"
                                  className="p-2 rounded bg-emerald-600 text-white cursor-pointer"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditandoItemId(null)}
                                  title="Cancelar"
                                  className="p-2 rounded bg-slate-700 text-white cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className="px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 hover:bg-[#0B1B36]/70 text-xs"
                        >
                          <div className="min-w-0 sm:flex-1 flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                item.tipo === 'MAO_OBRA'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-500'
                                  : item.tipo === 'TERCEIRIZADO'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-500'
                                  : 'bg-amber-950 text-amber-300 border border-amber-500'
                              }`}
                            >
                              {item.tipo === 'MAO_OBRA'
                                ? 'M. OBRA'
                                : item.tipo === 'TERCEIRIZADO'
                                ? 'TERC.'
                                : 'PEÇA'}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-white leading-snug break-words sm:truncate">
                              {item.nome_item}
                            </span>
                          </div>

                          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 shrink-0 font-mono tabular-nums">
                            <div className="flex items-center gap-2">
                              {canSeeFinanceiro && item.tipo !== 'MAO_OBRA' && (
                                <span className="hidden md:inline text-[11px] text-slate-400">
                                  Custo: {formatBRL(item.custo_unitario)} • Lucro:{' '}
                                  <strong className="text-emerald-400">
                                    {formatBRL(lucroItem)}
                                  </strong>
                                </span>
                              )}
                              <span className="text-slate-300 text-[11px] sm:text-xs">
                                {formatBRL(item.venda_unitario)}{' '}
                                <span className="text-slate-500 sm:hidden">un.</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-1 bg-[#0B1B36] border border-[#264577] rounded-lg px-1 py-0.5">
                                <button
                                  type="button"
                                  disabled={item.quantidade <= 1}
                                  onClick={() =>
                                    handleAlterarQtdItem(item.id, item.quantidade - 1)
                                  }
                                  aria-label={`Diminuir quantidade de ${item.nome_item}`}
                                  className="w-6 h-6 rounded bg-[#12274D] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-5 sm:w-6 text-center font-bold text-white">
                                  {item.quantidade}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAlterarQtdItem(item.id, item.quantidade + 1)
                                  }
                                  aria-label={`Aumentar quantidade de ${item.nome_item}`}
                                  className="w-6 h-6 rounded bg-[#12274D] text-white flex items-center justify-center cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <strong className="text-xs sm:text-sm text-white min-w-[74px] sm:w-24 text-right">
                                {formatBRL(item.quantidade * item.venda_unitario)}
                              </strong>

                              <button
                                type="button"
                                aria-label={`Editar ${item.nome_item}`}
                                onClick={() => iniciarEdicaoItem(item)}
                                className="p-1.5 rounded-lg bg-[#12274D] hover:bg-[#264577] text-amber-300 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                aria-label={`Remover ${item.nome_item}`}
                                onClick={() => handleRemoverItem(item.id)}
                                className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-200 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* COLUNA DIREITA (4 COL): RESUMO FINANCEIRO COMPACTO + FICHA TÉCNICA */}
            <div className="xl:col-span-4 space-y-3.5 sm:space-y-4">
              <section className="bg-[#1E3A8A] border-2 border-[#38BDF8] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-blue-100">
                    Resumo Financeiro da OS
                  </span>
                  <DollarSign className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                  <div className="bg-[#172554] rounded-lg p-2">
                    <div className="text-blue-200 font-sans font-bold text-[11px]">
                      Peças / Terc.
                    </div>
                    <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                      {formatBRL(os.total_pecas)}
                    </div>
                  </div>
                  <div className="bg-[#172554] rounded-lg p-2">
                    <div className="text-blue-200 font-sans font-bold text-[11px]">
                      Mão de Obra
                    </div>
                    <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                      {formatBRL(os.total_mao_obra)}
                    </div>
                  </div>
                  {canSeeFinanceiro && (
                    <>
                      <div className="bg-[#172554] rounded-lg p-2">
                        <div className="text-blue-200 font-sans font-bold text-[11px]">
                          Custo Peças
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-300 mt-0.5">
                          {formatBRL(custoTotalOS)}
                        </div>
                      </div>
                      <div className="bg-[#172554] rounded-lg p-2">
                        <div className="text-emerald-300 font-sans font-bold text-[11px]">
                          Lucro Líquido
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-300 mt-0.5">
                          {formatBRL(lucroTotalOS)}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-[#071226] border-2 border-[#38BDF8] rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">TOTAL GERAL</span>
                  <span className="text-lg sm:text-2xl font-extrabold font-mono text-[#38BDF8] tabular-nums">
                    {formatBRL(os.total_geral)}
                  </span>
                </div>
              </section>

              <section className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white">
                    Ficha Técnica &amp; Diagnóstico
                  </h2>
                  {statusAutoSave === 'saving' && (
                    <span className="text-[11px] font-bold text-amber-300">
                      Salvando…
                    </span>
                  )}
                  {statusAutoSave === 'saved' && (
                    <span className="text-[11px] font-bold text-emerald-400">
                      Salvo
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="edit-km"
                      className="block text-[11px] font-bold text-slate-200 mb-1"
                    >
                      KM Atual
                    </label>
                    <input
                      id="edit-km"
                      name="km_atual"
                      type="text"
                      inputMode="numeric"
                      value={editKm}
                      onChange={(e) => setEditKm(e.target.value.replace(/\D/g, ''))}
                      onBlur={() => salvarDadosTecnicosSilencioso()}
                      className="w-full min-h-[38px] px-2.5 py-1.5 bg-[#071226] border border-[#264577] rounded-lg text-white font-mono text-xs sm:text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-mecanico"
                      className="block text-[11px] font-bold text-slate-200 mb-1"
                    >
                      Mecânico Responsável
                    </label>
                    <select
                      id="edit-mecanico"
                      name="mecanico_responsavel_id"
                      value={editMecanicoId}
                      onChange={(e) => {
                        const novoMec = e.target.value;
                        setEditMecanicoId(novoMec);
                        salvarDadosTecnicosSilencioso({ mecanicoId: novoMec });
                      }}
                      className="w-full min-h-[38px] px-2 py-1.5 bg-[#071226] border border-[#264577] rounded-lg text-white text-xs"
                    >
                      <option value="">Selecione…</option>
                      {mecanicos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({m.cargo})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="edit-problema"
                    className="block text-[11px] font-bold text-slate-200 mb-1"
                  >
                    Relato do Problema / Diagnóstico
                  </label>
                  <textarea
                    id="edit-problema"
                    name="descricao_problema"
                    rows={2}
                    value={editProblema}
                    onChange={(e) => setEditProblema(e.target.value)}
                    onBlur={() => salvarDadosTecnicosSilencioso()}
                    className="w-full p-2.5 bg-[#071226] border border-[#264577] rounded-lg text-white text-xs sm:text-sm resize-y"
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VISÃO 1: PÁTIO DE ORDENS DE SERVIÇO COMPACTO (COM FAIXA RECOLHÍVEL DE FILTROS)
  // ============================================================================
  const totalPaginas = Math.max(1, Math.ceil(totalOrdens / ITENS_POR_PAGINA));
  const inicioRegistro =
    totalOrdens === 0 ? 0 : (pagina - 1) * ITENS_POR_PAGINA + 1;
  const fimRegistro = Math.min(totalOrdens, pagina * ITENS_POR_PAGINA);

  const qtdFiltrosAtivos =
    (statusFiltro !== 'TODAS' ? 1 : 0) +
    (dataInicio || dataFim ? 1 : 0) +
    (valorMin || valorMax ? 1 : 0) +
    (ordenacao !== 'data_desc' ? 1 : 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Cabeçalho Compacto + Botão Nova OS */}
      <div className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-extrabold text-white leading-tight truncate">
            Ordens de Serviço ({totalOrdens})
          </h1>
          <p className="hidden sm:block text-sm text-slate-300 mt-0.5">
            Toque em um veículo para abrir a bancada, lançar peças ou enviar orçamento.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirTelaNovaOS}
          className="min-h-[40px] sm:min-h-[48px] px-3.5 sm:px-5 py-2 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-xs sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" aria-hidden="true" />
          <span className="sm:hidden">+ Nova OS</span>
          <span className="hidden sm:inline">Dar Entrada em Veículo (Nova OS)</span>
        </button>
      </div>

      {/* Barra de Busca em 1 única linha + Botão de Filtros + Ícone Atualizar */}
      <search className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              name="busca_patio"
              aria-label="Buscar Ordem de Serviço por placa, cliente ou sintoma"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Placa, cliente ou defeito…"
              className="w-full min-h-[40px] sm:min-h-[46px] pl-9 pr-3 py-1.5 bg-[#071226] border border-[#264577] focus:border-[#38BDF8] rounded-lg sm:rounded-xl text-white text-sm"
            />
          </div>

          <button
            type="button"
            aria-expanded={mostrarFiltros}
            aria-label="Filtros e Ordenação"
            onClick={() => setMostrarFiltros((v) => !v)}
            className={`min-h-[40px] sm:min-h-[46px] px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
              mostrarFiltros || qtdFiltrosAtivos > 0
                ? 'bg-[#1E3A8A] border-[#38BDF8] text-white'
                : 'bg-[#071226] border-[#264577] text-slate-200 hover:bg-[#12274D]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
            <span className="hidden sm:inline">Filtros &amp; Ordenação</span>
            <span className="sm:hidden">Filtros</span>
            {qtdFiltrosAtivos > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#38BDF8] text-[#071226] text-[10px] font-extrabold">
                {qtdFiltrosAtivos}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={carregarOrdens}
            aria-label="Atualizar lista de Ordens de Serviço"
            title="Atualizar"
            className="min-h-[40px] sm:min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl bg-[#12274D] hover:bg-[#264577] border border-[#3A5C90] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
            <span className="hidden md:inline">Atualizar</span>
          </button>
        </div>

        {/* FAIXA RECOLHÍVEL DE FILTROS (STATUS, DATA, VALOR E ORDENAÇÃO) */}
        {mostrarFiltros && (
          <div className="pt-3 border-t border-[#12274D] space-y-4">
            {/* Etapa / Status */}
            <div>
              <span className="block text-xs font-bold text-slate-300 mb-2">
                Filtrar por Etapa / Status
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFiltro('TODAS');
                    setPagina(1);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl font-bold text-xs sm:text-sm border cursor-pointer ${
                    statusFiltro === 'TODAS'
                      ? 'bg-[#38BDF8] text-[#071226] border-[#38BDF8]'
                      : 'bg-[#071226] text-slate-300 border-[#264577]'
                  }`}
                >
                  Todas as Etapas
                </button>
                {STATUS_LIST.map((st) => {
                  const Icon = st.icon;
                  const ativo = statusFiltro === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setStatusFiltro(st.id);
                        setPagina(1);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl font-bold text-xs sm:text-sm border flex items-center justify-center gap-1.5 cursor-pointer ${
                        ativo
                          ? st.activeBtn
                          : 'bg-[#071226] text-slate-300 border-[#264577]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{st.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Período de Data + Faixa de Valor + Ordenação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label
                  htmlFor="filtro-data-inicio"
                  className="block text-xs font-bold text-slate-300 mb-1"
                >
                  Data Inicial
                </label>
                <input
                  id="filtro-data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPagina(1);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="filtro-data-fim"
                  className="block text-xs font-bold text-slate-300 mb-1"
                >
                  Data Final
                </label>
                <input
                  id="filtro-data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPagina(1);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="filtro-valor-min"
                  className="block text-xs font-bold text-slate-300 mb-1"
                >
                  Valor Mínimo (R$)
                </label>
                <input
                  id="filtro-valor-min"
                  type="number"
                  step="10"
                  placeholder="0,00"
                  value={valorMin}
                  onChange={(e) => {
                    setValorMin(e.target.value);
                    setPagina(1);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-mono text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="filtro-valor-max"
                  className="block text-xs font-bold text-slate-300 mb-1"
                >
                  Valor Máximo (R$)
                </label>
                <input
                  id="filtro-valor-max"
                  type="number"
                  step="10"
                  placeholder="Sem limite"
                  value={valorMax}
                  onChange={(e) => {
                    setValorMax(e.target.value);
                    setPagina(1);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-mono text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="filtro-ordenacao"
                  className="block text-xs font-bold text-slate-300 mb-1"
                >
                  Ordenar por
                </label>
                <select
                  id="filtro-ordenacao"
                  value={ordenacao}
                  onChange={(e) => {
                    setOrdenacao(e.target.value as OrdenacaoOS);
                    setPagina(1);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white text-sm font-semibold"
                >
                  <option value="data_desc">Mais recentes primeiro</option>
                  <option value="data_asc">Mais antigas primeiro</option>
                  <option value="valor_desc">Maior valor (R$)</option>
                  <option value="valor_asc">Menor valor (R$)</option>
                </select>
              </div>
            </div>

            {/* Atalhos Rápidos de Data + Limpar Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Período rápido:</span>
                <button
                  type="button"
                  onClick={() => aplicarAtalhoPeriodo(0)}
                  className="px-3 py-1 rounded-lg bg-[#071226] hover:bg-[#12274D] border border-[#264577] text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => aplicarAtalhoPeriodo(7)}
                  className="px-3 py-1 rounded-lg bg-[#071226] hover:bg-[#12274D] border border-[#264577] text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  onClick={() => aplicarAtalhoPeriodo(30)}
                  className="px-3 py-1 rounded-lg bg-[#071226] hover:bg-[#12274D] border border-[#264577] text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Últimos 30 dias
                </button>
              </div>

              {qtdFiltrosAtivos > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFiltro('TODAS');
                    setDataInicio('');
                    setDataFim('');
                    setValorMin('');
                    setValorMax('');
                    setOrdenacao('data_desc');
                    setPagina(1);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-red-950 border border-red-500 text-xs font-bold text-red-200 cursor-pointer"
                >
                  Limpar Todos os Filtros
                </button>
              )}
            </div>
          </div>
        )}
      </search>

      {/* Lista de Cards de OS */}
      {loadingLista ? (
        <div className="h-56 bg-[#0B1B36] border-2 border-[#12274D] rounded-2xl p-8 flex items-center justify-center gap-3 text-base font-bold text-slate-200">
          <progress aria-label="Carregando" className="loading-spinner" />
          <span>Carregando veículos do pátio…</span>
        </div>
      ) : erroLista ? (
        <div className="bg-red-950 border-2 border-red-500 rounded-2xl p-6 text-red-100 space-y-3">
          <p className="text-base font-bold">{erroLista}</p>
          <button
            type="button"
            onClick={carregarOrdens}
            className="min-h-[48px] px-5 py-2 rounded-xl bg-[#38BDF8] text-[#071226] font-bold"
          >
            Tentar Novamente
          </button>
        </div>
      ) : ordens.length === 0 ? (
        <div className="bg-[#0B1B36] border-2 border-[#12274D] rounded-2xl p-8 text-center space-y-3">
          <Car className="w-12 h-12 text-slate-500 mx-auto" aria-hidden="true" />
          <h2 className="text-xl font-bold text-white">
            Nenhuma Ordem de Serviço encontrada neste filtro
          </h2>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-2.5">
          {ordens.map((os) => {
            const stMeta =
              STATUS_LIST.find((s) => s.id === os.status) || STATUS_LIST[0];
            const StIcon = stMeta.icon;
            const placa = os.veiculos?.placa || 'SEM-PLACA';
            const modelo = os.veiculos?.modelo || 'Veículo';
            const clienteNome = os.clientes?.nome || 'Cliente';
            const fone = (os.clientes?.telefone || '').replace(/\D/g, '');

            return (
              <article
                key={os.id}
                className="bg-[#0B1B36] border border-[#264577] hover:border-[#38BDF8] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                      <span
                        translate="no"
                        className="px-2 py-0.5 rounded bg-[#071226] border border-slate-500 font-mono text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider shrink-0"
                      >
                        {placa}
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-white truncate">
                        {modelo}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-bold text-[10px] sm:text-xs ${stMeta.badgeBg} ${stMeta.badgeBorder} ${stMeta.badgeText}`}
                      >
                        <StIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span>{stMeta.label}</span>
                      </span>
                    </div>

                    <span className="lg:hidden font-mono text-sm sm:text-base font-extrabold text-[#38BDF8] tabular-nums shrink-0">
                      {formatBRL(os.total_geral)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                    <div className="min-w-0 truncate">
                      <strong className="text-white">{clienteNome}</strong> &bull;{' '}
                      <span className="text-slate-400 tabular-nums">
                        {formatDataHora(os.data_abertura)}
                      </span>
                      {os.descricao_problema && (
                        <span className="text-amber-200 ml-2">
                          • {os.descricao_problema}
                        </span>
                      )}
                    </div>

                    {/* Ações compactas na mesma linha no mobile */}
                    <div className="flex lg:hidden items-center gap-1.5 shrink-0">
                      {fone && (
                        <a
                          href={`https://wa.me/55${fone}`}
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
                        onClick={() => abrirBancadaOS(os.id)}
                        className="h-8 px-2.5 rounded-lg bg-[#38BDF8] text-[#071226] font-extrabold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Wrench className="w-3.5 h-3.5 stroke-[2.3]" aria-hidden="true" />
                        <span>Abrir</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ações Desktop */}
                <div className="hidden lg:flex items-center gap-2 shrink-0">
                  <div className="bg-[#071226] border border-[#264577] rounded-xl px-3 py-1.5 text-right">
                    <div className="text-[10px] font-bold text-slate-400">Total OS</div>
                    <div className="font-mono text-base font-bold text-[#38BDF8] tabular-nums">
                      {formatBRL(os.total_geral)}
                    </div>
                  </div>

                  {stMeta.nextStatus && (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus(os.id, stMeta.nextStatus!)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#12274D] hover:bg-[#264577] border border-[#3A5C90] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{stMeta.nextLabel}</span>
                      <ArrowRight className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                    </button>
                  )}

                  {fone && (
                    <a
                      href={`https://wa.me/55${fone}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`WhatsApp de ${clienteNome}`}
                      title="WhatsApp"
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => abrirBancadaOS(os.id)}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 stroke-[2.3]" aria-hidden="true" />
                    <span>Abrir OS</span>
                  </button>
                </div>
              </article>
            );
          })}

          {totalOrdens > ITENS_POR_PAGINA && (
            <nav
              aria-label="Paginação de Ordens de Serviço"
              className="bg-[#0B1B36] border-2 border-[#264577] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <div className="text-sm text-slate-300 font-mono tabular-nums">
                Mostrando <strong className="text-white">{inicioRegistro}</strong> a{' '}
                <strong className="text-white">{fimRegistro}</strong> de{' '}
                <strong className="text-[#38BDF8]">{totalOrdens}</strong> OS
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => {
                    setPagina((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-h-[46px] px-3.5 py-2 rounded-xl bg-[#071226] hover:bg-[#12274D] border border-[#3A5C90] text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                  <span>Anterior</span>
                </button>

                <span className="min-h-[46px] px-3.5 py-2 rounded-xl bg-[#12274D] border border-[#38BDF8] text-white font-mono font-bold text-sm flex items-center tabular-nums">
                  Página {pagina} de {totalPaginas}
                </span>

                <button
                  type="button"
                  disabled={pagina >= totalPaginas}
                  onClick={() => {
                    setPagina((p) => Math.min(totalPaginas, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-h-[46px] px-3.5 py-2 rounded-xl bg-[#071226] hover:bg-[#12274D] border border-[#3A5C90] text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
