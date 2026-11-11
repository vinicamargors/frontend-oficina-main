import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  CheckCircle2,
  MessageCircle,
  Printer,
  Trash2,
  ArrowLeft,
  Car,
  UserPlus,
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
import { Badge, Button, Field, PageHeader, Panel, PlateChip, formatarPlaca, Skeleton, StatusBadge, STATUS_OS, Tabs, CLASSE_CAMPO, classesBotao } from '../components/ui';
import { ConfirmarPagamento } from '../components/ConfirmarPagamento';
import { ConfirmarEtapa } from '../components/ConfirmarEtapa';
import { FORMAS_PAGAMENTO } from './ordens/formasPagamento';
import { ETAPAS_OS, mensagemEtapa } from './ordens/etapas';
import { LinhaOrdem } from './ordens/LinhaOrdem';
import { useTourDaPagina } from '../tour/useTourDaPagina';
import { TOUR_ORDENS } from '../tour/passos/ordens';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { dataLocalISO } from '../lib/data';
import { useCelular } from '../lib/useMediaQuery';

interface OrdensServicoProps {
  empresaId: string;
  initialStatusFilter?: StatusOS;
  initialOsId?: string;
}

interface ItemRascunho extends OSItemCreateInput {
  tempId: string;
}

const ITENS_POR_PAGINA = 50;

const ROTULO_TIPO_ITEM: Record<TipoItemOS, string> = {
  PECA: 'Peça',
  MAO_OBRA: 'Mão de obra',
  TERCEIRIZADO: 'Terceirizado',
};

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

// Formas aceitas na baixa (strings enviadas ao backend); exportadas para reuso.
export { FORMAS_PAGAMENTO };

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
  // O campo responde na hora; a lista e as contagens só leem a busca depois de 300ms sem digitação.
  const buscaAplicada = useDebouncedValue(busca, 300);
  // Só a resposta da leitura mais recente é aplicada (evita resposta antiga sobrescrever a nova).
  const seqLista = useRef(0);
  const seqContagens = useRef(0);
  const faixaChipsRef = useRef<HTMLDivElement>(null);
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
  // Contagem por etapa para os chips de filtro (mesmos filtros de busca/data/valor, sem o de etapa)
  const [contagens, setContagens] = useState<Partial<Record<StatusOS | 'TODAS', number>>>({});
  // Folha obrigatória de forma de pagamento antes de marcar como PAGO
  const [pagamentoPendente, setPagamentoPendente] = useState<{ osId: string; total: number } | null>(null);
  // Celular: toda troca de etapa na bancada passa por "Mover para…?" (toque acidental não muda o status)
  const celular = useCelular();
  const [etapaPendente, setEtapaPendente] = useState<{ osId: string; status: StatusOS } | null>(null);

  // Estado da OS aberta na Bancada
  const [selectedOsId, setSelectedOsId] = useState<string | null>(
    initialOsId && initialOsId !== 'NOVA_OS' ? initialOsId : null
  );
  const [dossie, setDossie] = useState<OSDossie | null>(null);

  // Confirmação aberta é da OS/tela em que foi pedida: trocou de OS ou saiu da bancada, ela some
  useEffect(() => {
    setEtapaPendente(null);
    setPagamentoPendente(null);
  }, [selectedOsId, view]);
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
  const [, setEditFormaPagamento] = useState<string>('PIX');
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
    const minha = ++seqLista.current;
    setLoadingLista(true);
    setErroLista(null);
    try {
      const vMin = valorMin.trim() ? Number(valorMin.replace(',', '.')) : null;
      const vMax = valorMax.trim() ? Number(valorMax.replace(',', '.')) : null;
      const res = await api.listarOS({
        empresaId,
        status: statusFiltro === 'TODAS' ? undefined : statusFiltro,
        search: buscaAplicada,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        valorMin: vMin,
        valorMax: vMax,
        ordenacao,
        skip: (pagina - 1) * ITENS_POR_PAGINA,
        limit: ITENS_POR_PAGINA,
      });
      if (minha !== seqLista.current) return;
      setOrdens(res.items || []);
      setTotalOrdens(res.total || 0);
    } catch (err: unknown) {
      if (minha !== seqLista.current) return;
      const e = err as Error;
      setErroLista(e.message || 'Erro ao carregar ordens de serviço.');
    } finally {
      if (minha === seqLista.current) setLoadingLista(false);
    }
  }, [
    empresaId,
    statusFiltro,
    buscaAplicada,
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

  const carregarContagens = useCallback(async () => {
    if (!empresaId) return;
    const minha = ++seqContagens.current;
    const vMin = valorMin.trim() ? Number(valorMin.replace(',', '.')) : null;
    const vMax = valorMax.trim() ? Number(valorMax.replace(',', '.')) : null;
    const etapas: (StatusOS | 'TODAS')[] = ['TODAS', ...ETAPAS_OS];
    const resultados = await Promise.all(
      etapas.map((st) =>
        api
          .listarOS({
            empresaId,
            status: st === 'TODAS' ? undefined : st,
            search: buscaAplicada,
            dataInicio: dataInicio || undefined,
            dataFim: dataFim || undefined,
            valorMin: vMin,
            valorMax: vMax,
            skip: 0,
            limit: 1,
          })
          .then((r) => r.total ?? 0)
          .catch(() => undefined)
      )
    );
    if (minha !== seqContagens.current) return;
    const mapa: Partial<Record<StatusOS | 'TODAS', number>> = {};
    etapas.forEach((st, i) => {
      if (resultados[i] !== undefined) mapa[st] = resultados[i];
    });
    setContagens(mapa);
  }, [empresaId, buscaAplicada, dataInicio, dataFim, valorMin, valorMax]);

  useEffect(() => {
    if (view === 'lista') {
      carregarContagens();
    }
  }, [view, carregarContagens]);

  // Celular: o chip ativo fica à vista dentro da faixa rolável (só rola a faixa, nunca a página)
  useEffect(() => {
    const faixa = faixaChipsRef.current;
    const ativo = faixa?.querySelector<HTMLElement>('[data-ativo]');
    if (!faixa || !ativo || faixa.scrollWidth <= faixa.clientWidth) return;
    const esq = ativo.offsetLeft - faixa.offsetLeft;
    const dir = esq + ativo.offsetWidth;
    if (esq < faixa.scrollLeft + 16) faixa.scrollLeft = Math.max(0, esq - 16);
    else if (dir > faixa.scrollLeft + faixa.clientWidth - 32) faixa.scrollLeft = dir - faixa.clientWidth + 32;
  }, [statusFiltro, view]);

  // Nova busca aplicada volta à primeira página
  useEffect(() => {
    setPagina(1);
  }, [buscaAplicada]);

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
        'Placa não localizada na base externa. Preencha o modelo do veículo abaixo.'
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
            'Pesquise e selecione um cliente na lista ou clique em "+ Novo cliente".'
          );
        }
        clienteIdFinal = clienteSelecionadoId;
      } else {
        if (!novoClienteNome.trim() || !novoClienteTelefone.trim()) {
          throw new Error('Informe o nome e o telefone/WhatsApp do novo cliente.');
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
            'Selecione um dos veículos do cliente ou clique em "+ Novo veículo".'
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
          : 'Nova ordem de serviço aberta com sucesso!'
      );
    } catch (err: unknown) {
      const customErr = err as Error;
      setErroOperacao(customErr.message || 'Erro ao abrir a ordem de serviço.');
    } finally {
      setCriandoOS(false);
    }
  };

  const handleMudarStatus = async (
    osId: string,
    novoStatus: StatusOS,
    formaPag?: string
  ) => {
    // PAGO só com forma de pagamento escolhida (sem padrão silencioso)
    if (novoStatus === 'PAGO' && !formaPag) return;
    setErroOperacao(null);
    setFeedbackMsg(null);
    try {
      if (view === 'bancada' && dossie && selectedOsId === osId) {
        setDossie({
          ...dossie,
          ordem: {
            ...dossie.ordem,
            status: novoStatus,
            ...(novoStatus === 'PAGO' ? { forma_pagamento: formaPag } : {}),
          },
        });
        if (novoStatus === 'PAGO' && formaPag) setEditFormaPagamento(formaPag);
      }

      await api.atualizarOS(empresaId, osId, {
        status: novoStatus,
        ...(novoStatus === 'PAGO' ? { forma_pagamento: formaPag } : {}),
      });

      if (view === 'bancada' && selectedOsId === osId) {
        await sincronizarDossieSilencioso(osId);
        setFeedbackMsg(mensagemEtapa(novoStatus));
      } else {
        await Promise.all([carregarOrdens(), carregarContagens()]);
        setFeedbackMsg(mensagemEtapa(novoStatus));
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErroOperacao(e.message || 'Falha ao mudar status da OS.');
      if (view === 'bancada' && selectedOsId === osId) {
        await sincronizarDossieSilencioso(osId);
      }
    }
  };

  // Mudar para PAGO sempre passa pela folha de confirmação; as outras etapas escrevem direto.
  const pedirMudancaStatus = (osId: string, novoStatus: StatusOS, total: number) => {
    if (novoStatus === 'PAGO') {
      setPagamentoPendente({ osId, total: Number(total || 0) });
      return;
    }
    handleMudarStatus(osId, novoStatus);
  };

  const folhaEtapa = (
    <ConfirmarEtapa
      etapa={etapaPendente?.status ?? null}
      aoCancelar={() => setEtapaPendente(null)}
      aoConfirmar={() => {
        const pendente = etapaPendente;
        setEtapaPendente(null);
        if (pendente) handleMudarStatus(pendente.osId, pendente.status);
      }}
    />
  );

  const folhaPagamento = (
    <ConfirmarPagamento
      aberto={pagamentoPendente !== null}
      total={pagamentoPendente?.total ?? 0}
      aoCancelar={() => setPagamentoPendente(null)}
      aoConfirmar={(forma) => {
        const pendente = pagamentoPendente;
        setPagamentoPendente(null);
        if (pendente) handleMudarStatus(pendente.osId, 'PAGO', forma);
      }}
    />
  );

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
        } na ordem de serviço!`
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
    const fimStr = dataLocalISO(hoje);
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - dias);
    const inicioStr = dataLocalISO(inicio);
    setDataInicio(inicioStr);
    setDataFim(fimStr);
  };

  // ============================================================================
  // VISÃO 2: ENTRADA DE VEÍCULO (1º ESCOLHER CLIENTE -> 2º VEÍCULOS DO CLIENTE)
  // ============================================================================
  useTourDaPagina(TOUR_ORDENS, view === 'lista' && !loadingLista && ordens.length > 0);

  if (view === 'nova') {
    const clienteSelecionado = clientes.find((c) => c.id === clienteSelecionadoId);
    const carrosDoClienteSelecionado = clienteSelecionadoId
      ? veiculosPorCliente.get(clienteSelecionadoId) || []
      : [];
    const mostrarDropdownReativo =
      modoClienteOS === 'BUSCAR' && buscaClienteTexto.trim().length > 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 bg-surface border-2 border-line rounded-lg p-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-ink text-balance">
              Dar entrada em veículo (nova OS)
            </h1>
            <p className="text-base text-ink-muted mt-1 text-pretty">
              1º Escolha o cliente (por placa, nome, CPF ou telefone) e 2º selecione o
              veículo dele.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView('lista')}
            className="min-h-[54px] px-5 py-2.5 rounded-xl bg-surface hover:bg-muted border-2 border-line-strong text-ink font-semibold text-base flex items-center gap-2 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-brand-ink" aria-hidden="true" />
            <span>Voltar ao pátio</span>
          </button>
        </div>

        {erroOperacao && (
          <div
            aria-live="polite"
            className="p-4 rounded-xl bg-danger/15 border-2 border-danger text-danger flex items-center gap-3 text-base font-medium"
          >
            <AlertTriangle className="w-6 h-6 text-danger shrink-0" aria-hidden="true" />
            <span>{erroOperacao}</span>
          </div>
        )}

        <form
          onSubmit={handleCriarNovaOS}
          className="bg-surface border-2 border-line rounded-lg p-5 sm:p-7 space-y-6"
        >
          <fieldset className="bg-sunken border-2 border-line rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <legend className="text-xl font-semibold text-ink flex items-center gap-2">
                <User className="w-6 h-6 text-brand-ink" aria-hidden="true" />
                <span>1. Escolher Cliente</span>
              </legend>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoClienteOS('BUSCAR')}
                  className={`min-h-[46px] px-4 py-2 rounded-xl font-semibold text-sm cursor-pointer ${
                    modoClienteOS === 'BUSCAR'
                      ? 'bg-brand text-on-brand'
                      : 'bg-surface text-ink-muted hover:bg-muted'
                  }`}
                >
                  Buscar cliente ({clientes.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoClienteOS('NOVO_CLIENTE');
                    setModoVeiculoCliente('NOVO_VEICULO');
                    setClienteSelecionadoId('');
                    setVeiculoSelecionadoId('');
                  }}
                  className={`min-h-[46px] px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-1.5 cursor-pointer ${
                    modoClienteOS === 'NOVO_CLIENTE'
                      ? 'bg-muted text-ink'
                      : 'bg-surface text-ink-muted hover:bg-muted'
                  }`}
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>+ Novo cliente</span>
                </button>
              </div>
            </div>

            {modoClienteOS === 'BUSCAR' ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="busca-cliente-os"
                    className="block text-sm font-semibold text-ink mb-1.5"
                  >
                    Pesquisar cliente por placa do veículo, nome, CPF ou telefone
                  </label>
                  <div className="relative flex items-center">
                    <Search
                      className="w-5 h-5 text-ink-subtle absolute left-4 pointer-events-none"
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
                      className="w-full min-h-[56px] pl-11 pr-4 py-2.5 bg-surface border-2 border-line-strong focus:border-brand rounded-xl text-ink text-base font-medium"
                    />
                  </div>
                </div>

                {mostrarDropdownReativo && (
                  <div
                    role="listbox"
                    aria-label="Clientes encontrados"
                    className="bg-surface border-2 border-brand rounded-xl divide-y divide-line max-h-72 overflow-y-auto"
                  >
                    {clientesFiltrados.length === 0 ? (
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="text-sm text-ink-muted">
                          Nenhum cliente encontrado para &ldquo;{buscaClienteTexto}&rdquo;.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNovoClienteNome(buscaClienteTexto.trim());
                            setModoClienteOS('NOVO_CLIENTE');
                            setModoVeiculoCliente('NOVO_VEICULO');
                          }}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-muted text-ink font-semibold text-xs cursor-pointer shrink-0"
                        >
                          + Cadastrar novo cliente
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
                            className="w-full px-4 py-3 text-left hover:bg-muted flex items-center justify-between gap-4 cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-semibold text-ink truncate">
                                {cli.nome}{' '}
                                <span className="text-brand-ink font-mono">
                                  - {cli.telefone || 'Sem telefone'}
                                </span>
                                {cli.cpf_cnpj && (
                                  <span className="ml-2 text-xs font-mono text-ink-subtle">
                                    ({cli.cpf_cnpj})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-ink-subtle mt-0.5 truncate">
                                Veículos: {resumoCarros}
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded bg-sunken border border-line text-xs font-semibold text-brand-ink shrink-0">
                              Escolher
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {clienteSelecionado && (
                  <div className="bg-muted/40 border-2 border-brand rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-warning">
                        Cliente selecionado
                      </div>
                      <div className="text-lg font-semibold text-ink">
                        {clienteSelecionado.nome}{' '}
                        <span className="text-brand-ink font-mono">
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
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-surface hover:bg-muted border border-line-strong text-ink font-semibold text-xs cursor-pointer"
                    >
                      Trocar cliente
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="input-cli-nome"
                    className="block text-sm font-semibold text-ink mb-1.5"
                  >
                    Nome do cliente *
                  </label>
                  <input
                    id="input-cli-nome"
                    name="cliente_nome"
                    type="text"
                    required
                    value={novoClienteNome}
                    onChange={(e) => setNovoClienteNome(e.target.value)}
                    placeholder="Ex.: Marcos Oliveira…"
                    className="w-full min-h-[52px] px-4 py-2 bg-surface border-2 border-line rounded-xl text-ink text-base"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-cli-fone"
                    className="block text-sm font-semibold text-ink mb-1.5"
                  >
                    WhatsApp / telefone *
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
                    className="w-full min-h-[52px] px-4 py-2 bg-surface border-2 border-line rounded-xl text-ink font-mono text-base tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-cli-cpf"
                    className="block text-sm font-semibold text-ink mb-1.5"
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
                    className="w-full min-h-[52px] px-4 py-2 bg-surface border-2 border-line rounded-xl text-ink font-mono text-base tabular-nums"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {(clienteSelecionado || modoClienteOS === 'NOVO_CLIENTE') && (
            <fieldset className="bg-sunken border-2 border-line rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <legend className="text-xl font-semibold text-ink flex items-center gap-2">
                  <Car className="w-6 h-6 text-brand-ink" aria-hidden="true" />
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
                      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl font-semibold text-xs cursor-pointer ${
                        modoVeiculoCliente === 'DO_CLIENTE'
                          ? 'bg-brand text-on-brand'
                          : 'bg-surface text-ink-muted hover:bg-muted'
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
                      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${
                        modoVeiculoCliente === 'NOVO_VEICULO'
                          ? 'bg-muted text-ink'
                          : 'bg-surface text-ink-muted hover:bg-muted'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      <span>+ Novo veículo (buscar placa)</span>
                    </button>
                  </div>
                )}
              </div>

              {modoClienteOS === 'BUSCAR' && modoVeiculoCliente === 'DO_CLIENTE' ? (
                carrosDoClienteSelecionado.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface border border-line flex items-center justify-between gap-4">
                    <span className="text-sm text-ink-muted">
                      Este cliente ainda não possui veículos cadastrados.
                    </span>
                    <button
                      type="button"
                      onClick={() => setModoVeiculoCliente('NOVO_VEICULO')}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-muted text-ink font-semibold text-xs cursor-pointer"
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
                              ? 'bg-muted border-brand text-ink'
                              : 'bg-surface border-line hover:border-line-strong text-ink'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-3 min-w-0">
                            <span
                              translate="no"
                              className="px-3 py-1 rounded-lg bg-sunken border border-brand font-mono text-lg font-semibold text-brand-ink uppercase tracking-wider"
                            >
                              {formatarPlaca(v.placa)}
                            </span>
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-ink truncate">
                                {v.modelo} {v.marca ? `• ${v.marca}` : ''}
                              </div>
                              <div className="text-xs text-ink-muted font-mono">
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
                                ? 'bg-brand border-brand text-on-brand'
                                : 'border-line-strong'
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
                        className="block text-sm font-semibold text-ink mb-1.5"
                      >
                        Placa do veículo
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
                        className="w-full min-h-[54px] px-4 py-2.5 bg-surface border-2 border-brand rounded-xl font-mono text-xl font-semibold text-ink uppercase tracking-widest"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <button
                        type="button"
                        disabled={buscandoPlaca}
                        onClick={handleConsultarPlaca}
                        className="w-full min-h-[54px] px-5 py-2.5 rounded-xl bg-muted hover:bg-muted text-ink font-semibold text-base flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                      >
                        <Search className="w-5 h-5" aria-hidden="true" />
                        <span>
                          {buscandoPlaca
                            ? 'Consultando placa…'
                            : 'Puxar modelo / marca pela placa'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {avisoPlaca && (
                    <div className="p-3 rounded-lg bg-surface border border-line-strong text-ink text-xs font-medium">
                      {avisoPlaca}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="input-novo-modelo"
                        className="block text-xs font-semibold text-ink mb-1"
                      >
                        Modelo do carro *
                      </label>
                      <input
                        id="input-novo-modelo"
                        name="modelo_veiculo"
                        type="text"
                        required
                        value={novoModelo}
                        onChange={(e) => setNovoModelo(e.target.value)}
                        placeholder="Ex.: Onix 1.0 Turbo…"
                        className="w-full min-h-[48px] px-3.5 py-2 bg-surface border-2 border-line rounded-xl text-ink text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="input-nova-marca"
                        className="block text-xs font-semibold text-ink mb-1"
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
                        className="w-full min-h-[48px] px-3.5 py-2 bg-surface border-2 border-line rounded-xl text-ink text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="input-nova-cor"
                          className="block text-xs font-semibold text-ink mb-1"
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
                          className="w-full min-h-[48px] px-3 py-2 bg-surface border-2 border-line rounded-xl text-ink text-sm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="input-novo-ano"
                          className="block text-xs font-semibold text-ink mb-1"
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
                          className="w-full min-h-[48px] px-3 py-2 bg-surface border-2 border-line rounded-xl text-ink font-mono text-sm tabular-nums"
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
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                KM atual no painel
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
                className="w-full min-h-[54px] px-4 py-2.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink font-mono text-lg tabular-nums"
              />
            </div>

            <div className="sm:col-span-8">
              <label
                htmlFor="input-os-problema"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Relato do problema / serviço solicitado
              </label>
              <input
                id="input-os-problema"
                name="descricao_problema"
                type="text"
                value={novaOsProblema}
                onChange={(e) => setNovaOsProblema(e.target.value)}
                placeholder="Ex.: Barulho na suspensão dianteira e revisão de freios…"
                className="w-full min-h-[54px] px-4 py-2.5 bg-sunken border-2 border-line focus:border-brand rounded-xl text-ink text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={criandoOS}
            className="w-full min-h-[60px] px-6 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-semibold text-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            <PlusCircle className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
            <span>
              {criandoOS
                ? 'Verificando orçamentos e abrindo bancada…'
                : 'Abrir ordem de serviço e ir para bancada'}
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
        <div className="space-y-4">
          {erroOperacao && !loadingDossie ? (
            <Panel espaco="lg" className="space-y-4">
              <p role="alert" className="flex items-start gap-3 text-base font-medium text-danger">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{erroOperacao}</span>
              </p>
              <Button variante="secundario" icone={ArrowLeft} onClick={() => setView('lista')}>
                Voltar às ordens
              </Button>
            </Panel>
          ) : (
            <>
              <Panel>
                <Skeleton linhas={2} />
              </Panel>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <Panel className="h-72 lg:col-span-8">
                  <Skeleton linhas={5} />
                </Panel>
                <Panel className="h-48 lg:col-span-4">
                  <Skeleton linhas={3} />
                </Panel>
              </div>
            </>
          )}
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
        <div className="area-impressao">
        {/* codemod:ignore-start */}
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
        {/* codemod:ignore-end */}
        </div>

        {/* ==================================================================== */}
        {/* INTERFACE DE TELA DA BANCADA (OCULTA NA IMPRESSÃO VIA print:hidden)  */}
        {/* ==================================================================== */}
        <div className="print:hidden pb-24 lg:pb-0">
          {folhaPagamento}
          {folhaEtapa}
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              variante="fantasma"
              tamanho="sm"
              icone={ArrowLeft}
              className="-ml-3"
              onClick={() => {
                setView('lista');
                setSelectedOsId(null);
                setFeedbackMsg(null);
                setErroOperacao(null);
              }}
            >
              Voltar às ordens
            </Button>
            <Button
              variante="fantasma"
              tamanho="sm"
              aria-label="Cancelar ordem de serviço"
              title="Cancelar / excluir ordem de serviço"
              aria-expanded={mostrarModalExclusao}
              onClick={() => setMostrarModalExclusao((v) => !v)}
              className="w-11 !px-0 text-danger hover:text-danger md:w-8"
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          </div>

          <PageHeader
            titulo={[os.veiculos?.marca, os.veiculos?.modelo].filter(Boolean).join(' ') || 'Veículo'}
            inicio={<PlateChip placa={os.veiculos?.placa || 'SEM-PLACA'} />}
            complemento={<StatusBadge status={statusAtual} />}
            abaixo={
              <>
                <span className="font-medium text-ink">{os.clientes?.nome || '—'}</span>
                {os.clientes?.telefone ? (
                  <span className="tabular-nums"> · {os.clientes.telefone}</span>
                ) : null}
              </>
            }
            acoes={
              <>
                <a
                  href={gerarLinkWhatsAppOrcamento(dossie)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Mandar orçamento no WhatsApp"
                  className={`${classesBotao('secundario')} hidden lg:inline-flex`}
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  WhatsApp
                </a>
                <Button
                  variante="secundario"
                  icone={Printer}
                  onClick={() => window.print()}
                  className="hidden lg:inline-flex"
                >
                  Imprimir (A4)
                </Button>
              </>
            }
          />

          {/* Confirmação inline de cancelamento quando acionado pela lixeira */}
          {mostrarModalExclusao && (
            <form
              onSubmit={handleConfirmarExclusaoOS}
              className="mb-4 flex flex-col gap-3 rounded-2xl bg-danger/10 p-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Field rotulo="Motivo obrigatório do cancelamento">
                  <input
                    id="input-motivo-exclusao"
                    name="motivo_exclusao"
                    type="text"
                    required
                    value={motivoExclusao}
                    onChange={(e) => setMotivoExclusao(e.target.value)}
                    placeholder="Motivo obrigatório do cancelamento da OS…"
                  />
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <Button variante="secundario" onClick={() => setMostrarModalExclusao(false)}>
                  Voltar
                </Button>
                <Button type="submit" variante="perigo" carregando={excluindoOS}>
                  {excluindoOS ? 'Cancelando…' : 'Confirmar exclusão'}
                </Button>
              </div>
            </form>
          )}

          {(feedbackMsg || erroOperacao) && (
            <div className="mb-4 space-y-2">
              {feedbackMsg && (
                <p role="status" className="flex items-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{feedbackMsg}</span>
                </p>
              )}
              {erroOperacao && (
                <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{erroOperacao}</span>
                </p>
              )}
            </div>
          )}

          {/* Etapas da OS */}
          <Panel as="section" aria-label="Etapa atual da ordem de serviço" className="mb-4 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-base font-semibold text-ink text-balance">Etapa do serviço</h2>
              <span className="text-xs text-ink-muted">
                <span className="font-mono">OS #{os.id.slice(0, 8).toUpperCase()}</span> · aberta em{' '}
                <span className="tabular-nums">{formatDataHora(os.data_abertura)}</span>
              </span>
            </div>

            <ol aria-label="Etapas da ordem de serviço" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {ETAPAS_OS.map((st, i) => {
                const { rotulo, icone: Icone, classe } = STATUS_OS[st];
                const ativo = statusAtual === st;
                const feita = ETAPAS_OS.indexOf(statusAtual) > i;
                return (
                  <li key={st} className="min-w-0">
                    <button
                      type="button"
                      aria-current={ativo ? 'step' : undefined}
                      onClick={() => {
                        // A etapa atual já é esta: nada a confirmar nem gravar
                        if (st === statusAtual) return;
                        if (st !== 'PAGO' && celular) setEtapaPendente({ osId: os.id, status: st });
                        else pedirMudancaStatus(os.id, st, os.total_geral);
                      }}
                      className={`flex h-full min-h-11 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[0.8125rem] font-medium leading-tight sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-1.5 sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        ativo
                          ? classe
                          : feita
                          ? 'bg-muted text-ink hover:bg-line'
                          : 'bg-muted text-ink-muted hover:bg-line hover:text-ink'
                      }`}
                    >
                      {feita ? (
                        <Check size={16} className="shrink-0" aria-hidden="true" />
                      ) : (
                        <Icone size={16} className="shrink-0" aria-hidden="true" />
                      )}
                      <span>{rotulo}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {statusAtual === 'PAGO' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-ink-muted">Forma de pagamento:</span>
                {FORMAS_PAGAMENTO.map((fp) => {
                  // Só destaca a forma gravada; OS paga antiga sem forma não destaca nenhuma.
                  const atual = os.forma_pagamento === fp;
                  return (
                    <button
                      key={fp}
                      type="button"
                      aria-pressed={atual}
                      onClick={() => {
                        setEditFormaPagamento(fp);
                        handleMudarStatus(os.id, 'PAGO', fp);
                      }}
                      className={`inline-flex h-9 min-h-11 md:min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        atual ? 'bg-success/15 text-success' : 'text-ink-muted hover:bg-muted hover:text-ink'
                      }`}
                    >
                      {fp}
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* GRID PRINCIPAL DA BANCADA */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
            {/* COLUNA ESQUERDA: LANÇAMENTO + ITENS */}
            <Panel as="section" aria-label="Itens da ordem de serviço" className="space-y-6 lg:col-span-8">
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-ink text-balance">Lançar item</h2>
                <Tabs
                  rotuloGrupo="Tipo de item a lançar"
                  quebrar
                  idPainel="painel-lancar-item"
                  ativo={modoItem}
                  aoMudar={(id) => {
                    setModoItem(id as typeof modoItem);
                    setItemEstoqueId('');
                    setBuscaEstoqueTexto('');
                    setItemNome('');
                    setItemCusto('');
                    setItemVenda('');
                  }}
                  itens={[
                    { id: 'PECA_ESTOQUE', rotulo: 'Peça do estoque' },
                    { id: 'PECA_AVULSA', rotulo: 'Peça avulsa' },
                    { id: 'MAO_OBRA', rotulo: 'Mão de obra' },
                    { id: 'TERCEIRIZADO', rotulo: 'Terceirizado' },
                  ]}
                />

                {/* Formulário de adição com busca reativa de estoque + custo p/ peça/terceirizado */}
                <form
                  id="painel-lancar-item"
                  role="tabpanel"
                  aria-labelledby={`aba-${modoItem}`}
                  onSubmit={handleIncluirItemNaFila}
                  className="space-y-4"
                >
                  {modoItem === 'PECA_ESTOQUE' && (
                    <div className="space-y-2">
                      <Field rotulo="Pesquisar peça no estoque por nome ou SKU/código (só com saldo)">
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
                        />
                      </Field>

                      {/* Lista reativa de estoque (só aparece ao digitar, sem itens zerados) */}
                      {buscaEstoqueTexto.trim().length > 0 && (
                        <div
                          role="listbox"
                          aria-label="Peças encontradas no estoque"
                          className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl bg-muted"
                        >
                          {pecasEstoqueFiltradas.length === 0 ? (
                            <div className="p-3 text-sm text-ink-muted">
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
                                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-ink">
                                      {p.nome}
                                      {sku && (
                                        <span className="ml-2 font-mono text-xs text-ink-muted">
                                          SKU: {sku}
                                        </span>
                                      )}
                                    </span>
                                    <span className="block text-xs tabular-nums text-ink-muted">
                                      Saldo: <span className="text-success">{p.quantidade} un.</span>{' '}
                                      · Custo: {formatBRL(p.custo)} · Venda:{' '}
                                      <span className="text-ink">{formatBRL(p.venda)}</span>
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-sm font-medium text-brand-ink">Usar</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}

                      {pecaEstoqueSelecionada && (
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-brand/10 px-3 py-1 text-sm text-ink">
                          <span>
                            Selecionado: <span className="font-medium">{pecaEstoqueSelecionada.nome}</span>{' '}
                            <span className="tabular-nums text-ink-muted">
                              (saldo: {pecaEstoqueSelecionada.quantidade} un.)
                            </span>
                          </span>
                          <Button variante="fantasma" tamanho="sm" onClick={() => setItemEstoqueId('')}>
                            Desvincular
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Descrição + Qtd/Custo/Venda */}
                  <div className="grid grid-cols-3 items-end gap-3 sm:grid-cols-12">
                    <div
                      className={
                        modoItem === 'MAO_OBRA'
                          ? 'col-span-3 sm:col-span-6'
                          : 'col-span-3 sm:col-span-5'
                      }
                    >
                      <Field rotulo="Descrição do item / serviço">
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
                        />
                      </Field>
                    </div>

                    <div className="col-span-1 sm:col-span-2">
                      <Field rotulo="Qtd">
                        <input
                          id="input-item-qtd"
                          name="quantidade"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={itemQtd}
                          onChange={(e) => setItemQtd(e.target.value)}
                          className={`${CLASSE_CAMPO} text-center tabular-nums`}
                        />
                      </Field>
                    </div>

                    {canSeeFinanceiro && modoItem !== 'MAO_OBRA' && (
                      <div className="col-span-1 sm:col-span-2">
                        <Field rotulo="Custo (R$)">
                          <input
                            id="input-item-custo"
                            name="custo_unitario"
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={itemCusto}
                            onChange={(e) => setItemCusto(e.target.value)}
                            placeholder="0,00"
                            className={`${CLASSE_CAMPO} tabular-nums`}
                          />
                        </Field>
                      </div>
                    )}

                    <div
                      className={
                        !canSeeFinanceiro || modoItem === 'MAO_OBRA'
                          ? 'col-span-2 sm:col-span-4'
                          : 'col-span-1 sm:col-span-3'
                      }
                    >
                      <Field rotulo="Venda (R$)">
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
                          className={`${CLASSE_CAMPO} tabular-nums`}
                        />
                      </Field>
                    </div>
                  </div>

                  <Button type="submit" variante="secundario" icone={Plus} className="w-full">
                    Incluir na fila de lançamento
                  </Button>
                </form>

                {/* FILA DE ITENS PRONTOS PARA LANÇAR DE UMA SÓ VEZ */}
                {itensPendentes.length > 0 && (
                  <div className="space-y-3 rounded-xl bg-muted p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <Layers className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                        Fila para lançar ({itensPendentes.length})
                      </span>
                      <span className="tabular-nums text-ink-muted">
                        Subtotal do lote: <span className="font-medium text-ink">{formatBRL(subtotalPendentes)}</span>
                      </span>
                    </div>

                    <ul className="max-h-44 divide-y divide-line overflow-y-auto">
                      {itensPendentes.map((item) => (
                        <li key={item.tempId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <Badge className="shrink-0">{ROTULO_TIPO_ITEM[item.tipo]}</Badge>
                            <span className="min-w-0 break-words font-medium text-ink">{item.nome_item}</span>
                          </span>
                          <span className="flex items-center gap-2 tabular-nums">
                            {canSeeFinanceiro && item.tipo !== 'MAO_OBRA' && (
                              <span className="text-xs text-ink-muted">
                                Custo: {formatBRL(item.custo_unitario)}
                              </span>
                            )}
                            <span className="text-ink">
                              {item.quantidade}× {formatBRL(item.venda_unitario)} ={' '}
                              <span className="font-medium">{formatBRL(item.quantidade * item.venda_unitario)}</span>
                            </span>
                            <Button
                              variante="fantasma"
                              tamanho="sm"
                              aria-label={`Remover ${item.nome_item} da fila`}
                              className="w-11 !px-0 text-danger hover:text-danger md:w-8"
                              onClick={() =>
                                setItensPendentes((prev) =>
                                  prev.filter((i) => i.tempId !== item.tempId)
                                )
                              }
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      icone={CheckCircle2}
                      carregando={lancandoLote}
                      onClick={handleLancarTodosItensNaOS}
                    >
                      {lancandoLote
                        ? 'Lançando lote na OS…'
                        : `Lançar todos os ${itensPendentes.length} itens na OS (${formatBRL(
                            subtotalPendentes
                          )})`}
                    </Button>
                  </div>
                )}
              </div>

              {/* ITENS LANÇADOS: LISTA COM DIVISORES, ROLAGEM INTERNA SÓ NO DESKTOP, EDIÇÃO INLINE */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink text-balance">Itens lançados</h2>
                  {dossie.itens.length > 5 && (
                    <input
                      type="search"
                      aria-label="Filtrar item lançado"
                      value={buscaItemLancado}
                      onChange={(e) => setBuscaItemLancado(e.target.value)}
                      placeholder="Filtrar item lançado…"
                      className={`${CLASSE_CAMPO} sm:w-56`}
                    />
                  )}
                </div>
                <Tabs
                  rotuloGrupo="Filtrar itens lançados por tipo"
                  quebrar
                  idPainel="painel-itens-lancados"
                  ativo={`itens-${abaItensLancados}`}
                  aoMudar={(id) => setAbaItensLancados(id.replace('itens-', '') as typeof abaItensLancados)}
                  itens={[
                    { id: 'itens-TODOS', rotulo: `Todos (${dossie.itens.length})` },
                    { id: 'itens-PECA', rotulo: `Peças (${pecasImp.length})` },
                    { id: 'itens-MAO_OBRA', rotulo: `Mão de obra (${servicosImp.length})` },
                    { id: 'itens-TERCEIRIZADO', rotulo: `Terceirizado (${terceirizadosImp.length})` },
                  ]}
                />

                <div id="painel-itens-lancados" role="tabpanel" aria-labelledby={`aba-itens-${abaItensLancados}`}>
                  {itensLancadosFiltrados.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-muted">
                      Nenhum item lançado nesta categoria.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line lg:max-h-[460px] lg:overflow-y-auto">
                      {itensLancadosFiltrados.map((item) => {
                        const emEdicao = editandoItemId === item.id;
                        const lucroItem =
                          item.tipo === 'MAO_OBRA'
                            ? item.quantidade * item.venda_unitario
                            : item.quantidade *
                              (item.venda_unitario - Number(item.custo_unitario || 0));

                        if (emEdicao) {
                          return (
                            <li key={item.id} className="space-y-3 py-3">
                              <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-12">
                                <div className="col-span-2 sm:col-span-4">
                                  <Field rotulo="Descrição">
                                    <input
                                      type="text"
                                      value={editItemNome}
                                      onChange={(e) => setEditItemNome(e.target.value)}
                                    />
                                  </Field>
                                </div>

                                <div className="col-span-2 sm:col-span-3">
                                  <Field rotulo="Tipo">
                                    <select
                                      value={editItemTipo}
                                      onChange={(e) =>
                                        setEditItemTipo(e.target.value as TipoItemOS)
                                      }
                                    >
                                      <option value="PECA">Peça</option>
                                      <option value="MAO_OBRA">Mão de obra</option>
                                      <option value="TERCEIRIZADO">Terceirizado</option>
                                    </select>
                                  </Field>
                                </div>

                                <div className="sm:col-span-1">
                                  <Field rotulo="Qtd">
                                    <input
                                      type="number"
                                      min={1}
                                      value={editItemQtd}
                                      onChange={(e) => setEditItemQtd(e.target.value)}
                                      className={`${CLASSE_CAMPO} px-1 text-center tabular-nums`}
                                    />
                                  </Field>
                                </div>

                                {canSeeFinanceiro && editItemTipo !== 'MAO_OBRA' && (
                                  <div className="sm:col-span-2">
                                    <Field rotulo="Custo unit.">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editItemCusto}
                                        onChange={(e) => setEditItemCusto(e.target.value)}
                                        className={`${CLASSE_CAMPO} tabular-nums`}
                                      />
                                    </Field>
                                  </div>
                                )}

                                <div className="sm:col-span-2">
                                  <Field rotulo="Venda unit.">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editItemVenda}
                                      onChange={(e) => setEditItemVenda(e.target.value)}
                                      className={`${CLASSE_CAMPO} tabular-nums`}
                                    />
                                  </Field>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variante="fantasma" icone={X} onClick={() => setEditandoItemId(null)}>
                                  Cancelar
                                </Button>
                                <Button
                                  variante="secundario"
                                  icone={Check}
                                  carregando={salvandoItemEditado}
                                  onClick={() => handleSalvarEdicaoItem(item.id)}
                                >
                                  Salvar edição
                                </Button>
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li
                            key={item.id}
                            className="flex flex-wrap items-center gap-x-2 gap-y-2 py-3 sm:flex-nowrap sm:gap-x-3"
                          >
                            <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className="shrink-0">{ROTULO_TIPO_ITEM[item.tipo]}</Badge>
                                <span className="min-w-0 break-words text-sm font-medium text-ink sm:truncate">
                                  {item.nome_item}
                                </span>
                              </div>
                              <div className="mt-1 text-xs tabular-nums text-ink-muted">
                                {formatBRL(item.venda_unitario)} un.
                                {canSeeFinanceiro && item.tipo !== 'MAO_OBRA' && (
                                  <>
                                    {' '}· custo {formatBRL(item.custo_unitario)} · lucro{' '}
                                    <span className="text-success">{formatBRL(lucroItem)}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center rounded-lg bg-muted">
                              <button
                                type="button"
                                disabled={item.quantidade <= 1}
                                onClick={() =>
                                  handleAlterarQtdItem(item.id, item.quantidade - 1)
                                }
                                aria-label={`Diminuir quantidade de ${item.nome_item}`}
                                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
                              >
                                <Minus size={14} aria-hidden="true" />
                              </button>
                              <span className="w-7 text-center text-sm font-medium tabular-nums text-ink">
                                {item.quantidade}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAlterarQtdItem(item.id, item.quantidade + 1)
                                }
                                aria-label={`Aumentar quantidade de ${item.nome_item}`}
                                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-8 md:w-8"
                              >
                                <Plus size={14} aria-hidden="true" />
                              </button>
                            </div>

                            <span className="ml-auto min-w-[5.5rem] text-right text-sm font-semibold tabular-nums text-ink sm:ml-0">
                              {formatBRL(item.quantidade * item.venda_unitario)}
                            </span>

                            <span className="flex items-center">
                              <Button
                                variante="fantasma"
                                tamanho="sm"
                                aria-label={`Editar ${item.nome_item}`}
                                className="w-11 !px-0 md:w-8"
                                onClick={() => iniciarEdicaoItem(item)}
                              >
                                <Pencil size={16} aria-hidden="true" />
                              </Button>
                              <Button
                                variante="fantasma"
                                tamanho="sm"
                                aria-label={`Remover ${item.nome_item}`}
                                className="w-11 !px-0 text-danger hover:text-danger md:w-8"
                                onClick={() => handleRemoverItem(item.id)}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </Panel>

            {/* COLUNA DIREITA (≥1024) / ABAIXO DOS ITENS (CELULAR): RESUMO + FICHA TÉCNICA */}
            <div className="space-y-4 lg:col-span-4">
              <Panel as="section" aria-labelledby="titulo-resumo-os" className="space-y-4">
                <div>
                  <h2 id="titulo-resumo-os" className="text-sm text-ink-muted text-balance">
                    Total da ordem
                  </h2>
                  <p className="text-[2rem] font-semibold leading-tight tabular-nums text-ink">
                    {formatBRL(os.total_geral)}
                  </p>
                </div>

                <dl className="divide-y divide-line text-sm">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-ink-muted">Peças / Terc.</dt>
                    <dd className="font-medium tabular-nums text-ink">{formatBRL(os.total_pecas)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-ink-muted">Mão de obra</dt>
                    <dd className="font-medium tabular-nums text-ink">{formatBRL(os.total_mao_obra)}</dd>
                  </div>
                  {canSeeFinanceiro && (
                    <>
                      <div className="flex items-center justify-between gap-3 py-2">
                        <dt className="text-ink-muted">Custo peças</dt>
                        <dd className="font-medium tabular-nums text-ink">{formatBRL(custoTotalOS)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-2">
                        <dt className="text-ink-muted">Lucro líquido</dt>
                        <dd className="font-semibold tabular-nums text-success">{formatBRL(lucroTotalOS)}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </Panel>

              <Panel as="section" aria-labelledby="titulo-ficha-tecnica" className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="titulo-ficha-tecnica" className="text-base font-semibold text-ink text-balance">
                    Ficha técnica &amp; diagnóstico
                  </h2>
                  <span aria-live="polite" className="text-xs font-medium">
                    {statusAutoSave === 'saving' && <span className="text-ink-muted">Salvando…</span>}
                    {statusAutoSave === 'saved' && <span className="text-success">Salvo</span>}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field rotulo="KM atual">
                    <input
                      id="edit-km"
                      name="km_atual"
                      type="text"
                      inputMode="numeric"
                      value={editKm}
                      onChange={(e) => setEditKm(e.target.value.replace(/\D/g, ''))}
                      onBlur={() => salvarDadosTecnicosSilencioso()}
                      className={`${CLASSE_CAMPO} tabular-nums`}
                    />
                  </Field>

                  <Field rotulo="Mecânico responsável">
                    <select
                      id="edit-mecanico"
                      name="mecanico_responsavel_id"
                      value={editMecanicoId}
                      onChange={(e) => {
                        const novoMec = e.target.value;
                        setEditMecanicoId(novoMec);
                        salvarDadosTecnicosSilencioso({ mecanicoId: novoMec });
                      }}
                    >
                      <option value="">Selecione…</option>
                      {mecanicos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({m.cargo})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field rotulo="Relato do problema / diagnóstico">
                  <textarea
                    id="edit-problema"
                    name="descricao_problema"
                    rows={3}
                    value={editProblema}
                    onChange={(e) => setEditProblema(e.target.value)}
                    onBlur={() => salvarDadosTecnicosSilencioso()}
                    className="w-full resize-y rounded-lg border border-line-strong bg-sunken p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </Field>
              </Panel>
            </div>
          </div>

          {/* CELULAR: WhatsApp e Imprimir numa barra fixa logo acima da navegação inferior do app */}
          <section
            aria-label="Ações da ordem de serviço"
            className="fixed inset-x-0 z-40 flex gap-2 bg-surface px-4 py-2 lg:hidden"
            style={{ bottom: 'var(--barra-inferior-h, calc(60px + max(0.25rem, env(safe-area-inset-bottom))))' }}
          >
            <a
              href={gerarLinkWhatsAppOrcamento(dossie)}
              target="_blank"
              rel="noreferrer"
              aria-label="Mandar orçamento no WhatsApp"
              className={`${classesBotao('secundario')} flex-1`}
            >
              <MessageCircle size={16} aria-hidden="true" />
              WhatsApp
            </a>
            <Button variante="secundario" icone={Printer} onClick={() => window.print()} className="flex-1">
              Imprimir (A4)
            </Button>
          </section>
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
  const fimRegistro = totalOrdens === 0 ? 0 : Math.min(totalOrdens, inicioRegistro + ordens.length - 1);

  const qtdFiltrosAtivos =
    (statusFiltro !== 'TODAS' ? 1 : 0) +
    (dataInicio || dataFim ? 1 : 0) +
    (valorMin || valorMax ? 1 : 0) +
    (ordenacao !== 'data_desc' ? 1 : 0);

  const limparFiltros = () => {
    setStatusFiltro('TODAS');
    setDataInicio('');
    setDataFim('');
    setValorMin('');
    setValorMax('');
    setOrdenacao('data_desc');
    setPagina(1);
  };

  const qtdFiltrosExtras = qtdFiltrosAtivos - (statusFiltro !== 'TODAS' ? 1 : 0);

  return (
    <div>
      {folhaPagamento}
      <PageHeader
        titulo="Ordens de serviço"
        complemento={
          <span className="text-[1.375rem] font-semibold tabular-nums text-ink-subtle">{totalOrdens}</span>
        }
        acoes={
          <>
            <Button
              variante="fantasma"
              icone={RefreshCw}
              onClick={() => {
                carregarOrdens();
                carregarContagens();
              }}
              aria-label="Atualizar lista de ordens de serviço"
            >
              Atualizar
            </Button>
            <Button data-tour="ordens-nova" onClick={abrirTelaNovaOS}>Nova ordem de serviço</Button>
          </>
        }
      />

      {(feedbackMsg || erroOperacao) && (
        <div className="mb-4 space-y-2">
          {feedbackMsg && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{feedbackMsg}</span>
            </p>
          )}
          {erroOperacao && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{erroOperacao}</span>
            </p>
          )}
        </div>
      )}

      {/* Busca + filtros extras (datas, valor, ordenação) */}
      <search className="mb-4 block space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1" data-tour="ordens-busca">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              name="busca_patio"
              aria-label="Buscar ordem de serviço por placa, cliente ou sintoma"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Placa, cliente ou defeito…"
              className={`${CLASSE_CAMPO} pl-9`}
            />
          </div>
          <Button
            variante={mostrarFiltros || qtdFiltrosExtras > 0 ? 'secundario' : 'fantasma'}
            icone={SlidersHorizontal}
            aria-expanded={mostrarFiltros}
            aria-controls="filtros-extras-os"
            onClick={() => setMostrarFiltros((v) => !v)}
          >
            Filtros
            {qtdFiltrosExtras > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-xs font-medium tabular-nums text-on-brand">
                {qtdFiltrosExtras}
              </span>
            )}
          </Button>
        </div>

        {/* Chips de etapa: sempre visíveis, com contagem; quebram linha em vez de rolar */}
        {/* Chips de etapa com contagem. Celular: uma linha só, rolagem só dentro da faixa (sem barra, com
            esmaecido na borda); desktop: quebram linha como antes. */}
        <div
          ref={faixaChipsRef}
          role="group"
          aria-label="Filtrar por etapa"
          data-tour="ordens-etapas"
          className="-mx-4 flex snap-x scroll-px-4 gap-1 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8 lg:mx-0 lg:flex-wrap lg:gap-2 lg:overflow-visible lg:px-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
        >
          {(['TODAS', ...ETAPAS_OS] as const).map((id) => {
            const ativo = statusFiltro === id;
            const rotulo = id === 'TODAS' ? 'Todas' : STATUS_OS[id].rotulo;
            const qtd = contagens[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={ativo}
                data-ativo={ativo || undefined}
                onClick={() => {
                  setStatusFiltro(id);
                  setPagina(1);
                }}
                className="group inline-flex min-h-11 shrink-0 snap-start items-center rounded-full focus-visible:outline-none lg:min-h-9"
              >
                <span
                  className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-brand sm:px-3.5 ${
                    ativo ? 'bg-surface text-ink shadow-card dark:bg-line' : 'text-ink-muted group-hover:bg-muted group-hover:text-ink'
                  }`}
                >
                  {rotulo}
                  {qtd !== undefined && (
                    <span className={`tabular-nums ${ativo ? 'text-ink-muted' : 'text-ink-subtle'}`}>{qtd}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {mostrarFiltros && (
          <div id="filtros-extras-os">
            <Panel className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Field rotulo="Data inicial">
                  <input
                    id="filtro-data-inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value);
                      setPagina(1);
                    }}
                  />
                </Field>
                <Field rotulo="Data final">
                  <input
                    id="filtro-data-fim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => {
                      setDataFim(e.target.value);
                      setPagina(1);
                    }}
                  />
                </Field>
                <Field rotulo="Valor mínimo (R$)">
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
                    className={`${CLASSE_CAMPO} tabular-nums`}
                  />
                </Field>
                <Field rotulo="Valor máximo (R$)">
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
                    className={`${CLASSE_CAMPO} tabular-nums`}
                  />
                </Field>
                <Field rotulo="Ordenar por">
                  <select
                    id="filtro-ordenacao"
                    value={ordenacao}
                    onChange={(e) => {
                      setOrdenacao(e.target.value as OrdenacaoOS);
                      setPagina(1);
                    }}
                  >
                    <option value="data_desc">Mais recentes primeiro</option>
                    <option value="data_asc">Mais antigas primeiro</option>
                    <option value="valor_desc">Maior valor (R$)</option>
                    <option value="valor_asc">Menor valor (R$)</option>
                  </select>
                </Field>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-sm text-ink-muted">Período rápido:</span>
                  <Button variante="fantasma" tamanho="sm" onClick={() => aplicarAtalhoPeriodo(0)}>
                    Hoje
                  </Button>
                  <Button variante="fantasma" tamanho="sm" onClick={() => aplicarAtalhoPeriodo(7)}>
                    Últimos 7 dias
                  </Button>
                  <Button variante="fantasma" tamanho="sm" onClick={() => aplicarAtalhoPeriodo(30)}>
                    Últimos 30 dias
                  </Button>
                </div>
                {qtdFiltrosAtivos > 0 && (
                  <Button variante="fantasma" tamanho="sm" icone={X} onClick={limparFiltros}>
                    Limpar todos os filtros
                  </Button>
                )}
              </div>
            </Panel>
          </div>
        )}
      </search>

      {loadingLista ? (
        <Panel>
          <Skeleton linhas={6} />
        </Panel>
      ) : erroLista ? (
        <Panel espaco="lg" className="space-y-4">
          <p role="alert" className="flex items-start gap-3 text-base font-medium text-danger">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{erroLista}</span>
          </p>
          <Button icone={RefreshCw} onClick={carregarOrdens}>
            Tentar novamente
          </Button>
        </Panel>
      ) : ordens.length === 0 ? (
        <Panel espaco="lg" className="space-y-3">
          <h2 className="text-lg font-semibold text-ink text-balance">
            {qtdFiltrosAtivos > 0 || busca
              ? 'Nenhuma ordem de serviço encontrada neste filtro'
              : 'Nenhuma ordem de serviço ainda'}
          </h2>
          {qtdFiltrosAtivos > 0 || busca ? (
            <Button
              variante="secundario"
              onClick={() => {
                limparFiltros();
                setBusca('');
              }}
            >
              Limpar busca e filtros
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">
              Dê entrada em um veículo com &ldquo;Nova ordem de serviço&rdquo; e ele aparece aqui.
            </p>
          )}
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel espaco="nenhum" className="overflow-hidden">
            <ul aria-label="Ordens de serviço" data-tour="ordens-lista" className="divide-y divide-line">
              {ordens.map((os) => (
                <LinhaOrdem
                  key={os.id}
                  os={os}
                  aoAbrir={() => abrirBancadaOS(os.id)}
                  aoAvancar={(proximo) => pedirMudancaStatus(os.id, proximo, os.total_geral)}
                />
              ))}
            </ul>
          </Panel>

          {totalOrdens > ITENS_POR_PAGINA && (
            <nav
              aria-label="Paginação de ordens de serviço"
              className="flex flex-col items-center justify-between gap-3 sm:flex-row"
            >
              <p className="text-sm tabular-nums text-ink-muted">
                Mostrando{' '}
                <span className="font-medium text-ink">
                  {inicioRegistro}–{fimRegistro}
                </span>{' '}
                de <span className="font-medium text-ink">{totalOrdens}</span>
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variante="secundario"
                  icone={ChevronLeft}
                  aria-label="Página anterior"
                  className="!min-h-11"
                  disabled={pagina <= 1}
                  onClick={() => {
                    setPagina((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Anterior
                </Button>
                <span className="px-2 text-sm tabular-nums text-ink-muted">
                  {pagina} de {totalPaginas}
                </span>
                <Button
                  variante="secundario"
                  aria-label="Próxima página"
                  className="!min-h-11"
                  disabled={pagina >= totalPaginas}
                  onClick={() => {
                    setPagina((p) => Math.min(totalPaginas, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
