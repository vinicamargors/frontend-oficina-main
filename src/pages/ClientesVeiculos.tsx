import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Cliente, StatusOS, UltimaOS, Usuario, Veiculo } from '../types';
import {
  Users,
  Car,
  Search,
  Plus,
  Edit2,
  Phone,
  MessageCircle,
  ClipboardList,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  Sparkles,
} from 'lucide-react';

interface ClientesVeiculosProps {
  empresaId: string;
  initialViewMode?: 'clientes' | 'veiculos';
  onNavigateTab: (tab: string, status?: StatusOS, osId?: string) => void;
}

interface NovoVeiculoRascunho {
  tempId: string;
  placa: string;
  modelo: string;
  marca: string;
  cor: string;
  ano: string;
  km_atual: string;
  chassi: string;
  buscandoPlaca?: boolean;
  msgPlaca?: string;
}

const PAGE_SIZE = 50;

const STATUS_META: Record<
  StatusOS,
  { label: string; badgeBg: string; badgeText: string }
> = {
  ORCAMENTO: {
    label: 'Orçamento',
    badgeBg: 'bg-amber-500/20 border-amber-500',
    badgeText: 'text-amber-300',
  },
  AGUARDANDO_PECA: {
    label: 'Aguardando Peça',
    badgeBg: 'bg-sky-500/20 border-sky-500',
    badgeText: 'text-sky-300',
  },
  EXECUCAO: {
    label: 'Em Execução',
    badgeBg: 'bg-blue-500/20 border-blue-500',
    badgeText: 'text-blue-300',
  },
  FINALIZADO: {
    label: 'Finalizado / Pronto',
    badgeBg: 'bg-emerald-500/20 border-emerald-500',
    badgeText: 'text-emerald-300',
  },
  PAGO: {
    label: 'Pago & Entregue',
    badgeBg: 'bg-teal-500/20 border-teal-500',
    badgeText: 'text-teal-300',
  },
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

function formatarDataCurta(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function montarLinkWhatsApp(telefone?: string | null, nomeCliente?: string, placa?: string): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) return null;
  const foneComDdi = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
  const saudacao = nomeCliente
    ? `Olá ${nomeCliente.split(' ')[0]}, tudo bem? Aqui é da oficina sobre${placa ? ` o veículo ${placa}` : ' seu atendimento'}.`
    : 'Olá, tudo bem? Aqui é da oficina.';
  return `https://wa.me/${foneComDdi}?text=${encodeURIComponent(saudacao)}`;
}

function criarRascunhoVeiculoVazio(): NovoVeiculoRascunho {
  return {
    tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    placa: '',
    modelo: '',
    marca: '',
    cor: '',
    ano: '',
    km_atual: '',
    chassi: '',
  };
}

export function ClientesVeiculos({
  empresaId,
  initialViewMode = 'clientes',
  onNavigateTab,
}: ClientesVeiculosProps) {
  const [viewMode, setViewMode] = useState<'clientes' | 'veiculos'>(initialViewMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [historicoGeralOS, setHistoricoGeralOS] = useState<UltimaOS[]>([]);
  const [mecanicos, setMecanicos] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [feedbackSucesso, setFeedbackSucesso] = useState('');

  // Modal Ficha do Cliente + Múltiplos Veículos (Criar ou Editar)
  const [fichaAberta, setFichaAberta] = useState(false);
  const [clienteEmEdicao, setClienteEmEdicao] = useState<Cliente | null>(null);
  const [cliNome, setCliNome] = useState('');
  const [cliTelefone, setCliTelefone] = useState('');
  const [cliCpfCnpj, setCliCpfCnpj] = useState('');
  const [cliEndereco, setCliEndereco] = useState('');
  const [novosVeiculosRascunho, setNovosVeiculosRascunho] = useState<NovoVeiculoRascunho[]>([]);
  const [salvandoFicha, setSalvandoFicha] = useState(false);

  // Edição inline de veículo já existente (dentro da ficha do cliente ou modal rápido de veículo)
  const [veiculoEmEdicao, setVeiculoEmEdicao] = useState<Veiculo | null>(null);
  const [editVeiPlaca, setEditVeiPlaca] = useState('');
  const [editVeiModelo, setEditVeiModelo] = useState('');
  const [editVeiMarca, setEditVeiMarca] = useState('');
  const [editVeiCor, setEditVeiCor] = useState('');
  const [editVeiAno, setEditVeiAno] = useState('');
  const [editVeiKm, setEditVeiKm] = useState('');
  const [editVeiChassi, setEditVeiChassi] = useState('');
  const [buscandoPlacaEdit, setBuscandoPlacaEdit] = useState(false);
  const [msgPlacaEdit, setMsgPlacaEdit] = useState('');
  const [salvandoVeiculoEdit, setSalvandoVeiculoEdit] = useState(false);

  // Modal Histórico de OS (por Veículo ou por Cliente)
  const [historicoModal, setHistoricoModal] = useState<{
    titulo: string;
    subtitulo: string;
    cliente?: Cliente;
    veiculo?: Veiculo;
    ordens: UltimaOS[];
  } | null>(null);

  // Modal Rápido "+ Abrir Nova OS" direto na listagem
  const [novaOsRapida, setNovaOsRapida] = useState<{
    cliente: Cliente;
    veiculo: Veiculo;
  } | null>(null);
  const [osKmAtual, setOsKmAtual] = useState('');
  const [osMecanicoId, setOsMecanicoId] = useState('');
  const [osDescricao, setOsDescricao] = useState('');
  const [criandoOsRapida, setCriandoOsRapida] = useState(false);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  const carregarDados = async () => {
    if (!empresaId) return;
    setLoading(true);
    setErro('');
    try {
      const [clis, veis, hist, usus] = await Promise.all([
        api.listarClientes(empresaId),
        api.listarVeiculos(empresaId),
        api.listarHistoricoOS({ empresaId }),
        api.getUsuarios(empresaId).catch(() => []),
      ]);
      setClientes(clis);
      setVeiculos(veis);
      setHistoricoGeralOS(hist);
      setMecanicos(usus.filter((u) => u.ativo));
    } catch (err: unknown) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar clientes e veículos.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [empresaId]);

  const notificarSucesso = (msg: string) => {
    setFeedbackSucesso(msg);
    setTimeout(() => {
      setFeedbackSucesso((atual) => (atual === msg ? '' : atual));
    }, 4500);
  };

  // Mapas auxiliares rápidos
  const veiculosPorCliente = useMemo(() => {
    const map: Record<string, Veiculo[]> = {};
    for (const v of veiculos) {
      if (!map[v.cliente_id]) map[v.cliente_id] = [];
      map[v.cliente_id].push(v);
    }
    return map;
  }, [veiculos]);

  const clientePorId = useMemo(() => {
    const map: Record<string, Cliente> = {};
    for (const c of clientes) {
      map[c.id] = c;
    }
    return map;
  }, [clientes]);

  const osPorVeiculo = useMemo(() => {
    const map: Record<string, UltimaOS[]> = {};
    for (const os of historicoGeralOS) {
      const vid = os.veiculo_id;
      if (vid) {
        if (!map[vid]) map[vid] = [];
        map[vid].push(os);
      }
    }
    return map;
  }, [historicoGeralOS]);

  const osPorCliente = useMemo(() => {
    const map: Record<string, UltimaOS[]> = {};
    for (const os of historicoGeralOS) {
      const cid = os.cliente_id;
      if (cid) {
        if (!map[cid]) map[cid] = [];
        map[cid].push(os);
      }
    }
    return map;
  }, [historicoGeralOS]);

  // Filtro unificado por Nome, Telefone, CPF/CNPJ, Placa ou Modelo
  const clientesFiltrados = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    if (!termo) return clientes;
    const termoAlfanum = termo.replace(/[^a-z0-9]/g, '');

    return clientes.filter((c) => {
      const nomeMatch = c.nome.toLowerCase().includes(termo);
      const telLimpo = (c.telefone || '').replace(/\D/g, '');
      const cpfLimpo = (c.cpf_cnpj || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const telMatch =
        (c.telefone || '').toLowerCase().includes(termo) ||
        (termoAlfanum.length >= 3 && telLimpo.includes(termoAlfanum));
      const cpfMatch =
        (c.cpf_cnpj || '').toLowerCase().includes(termo) ||
        (termoAlfanum.length >= 3 && cpfLimpo.includes(termoAlfanum));

      const carros = veiculosPorCliente[c.id] || [];
      const carroMatch = carros.some((v) => {
        const placaLower = v.placa.toLowerCase();
        const placaLimpa = placaLower.replace(/[^a-z0-9]/g, '');
        return (
          placaLower.includes(termo) ||
          (termoAlfanum.length >= 2 && placaLimpa.includes(termoAlfanum)) ||
          (v.modelo || '').toLowerCase().includes(termo) ||
          (v.marca || '').toLowerCase().includes(termo)
        );
      });

      return nomeMatch || telMatch || cpfMatch || carroMatch;
    });
  }, [clientes, veiculosPorCliente, searchTerm]);

  const veiculosFiltrados = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    if (!termo) return veiculos;
    const termoAlfanum = termo.replace(/[^a-z0-9]/g, '');

    return veiculos.filter((v) => {
      const placaLower = v.placa.toLowerCase();
      const placaLimpa = placaLower.replace(/[^a-z0-9]/g, '');
      const modeloMatch = (v.modelo || '').toLowerCase().includes(termo);
      const marcaMatch = (v.marca || '').toLowerCase().includes(termo);
      const dono = clientePorId[v.cliente_id];
      const nomeDono = (dono?.nome || v.clientes?.nome || '').toLowerCase();
      const telDono = (dono?.telefone || v.clientes?.telefone || '').replace(/\D/g, '');

      return (
        placaLower.includes(termo) ||
        (termoAlfanum.length >= 2 && placaLimpa.includes(termoAlfanum)) ||
        modeloMatch ||
        marcaMatch ||
        nomeDono.includes(termo) ||
        (termoAlfanum.length >= 3 && telDono.includes(termoAlfanum))
      );
    });
  }, [veiculos, clientePorId, searchTerm]);

  const totalItems =
    viewMode === 'clientes' ? clientesFiltrados.length : veiculosFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const clientesPaginados = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return clientesFiltrados.slice(start, start + PAGE_SIZE);
  }, [clientesFiltrados, currentPage]);

  const veiculosPaginados = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return veiculosFiltrados.slice(start, start + PAGE_SIZE);
  }, [veiculosFiltrados, currentPage]);

  // Abertura da Ficha de Novo Cliente + Veículos
  const abrirFichaNovoCliente = () => {
    setClienteEmEdicao(null);
    setCliNome('');
    setCliTelefone('');
    setCliCpfCnpj('');
    setCliEndereco('');
    setNovosVeiculosRascunho([criarRascunhoVeiculoVazio()]);
    setErro('');
    setFichaAberta(true);
  };

  // Abertura da Ficha de Edição do Cliente (+ opção de já adicionar veículo)
  const abrirFichaEditarCliente = (cliente: Cliente, comNovoVeiculo = false) => {
    setClienteEmEdicao(cliente);
    setCliNome(cliente.nome || '');
    setCliTelefone(cliente.telefone || '');
    setCliCpfCnpj(cliente.cpf_cnpj || '');
    setCliEndereco(cliente.endereco || '');
    setNovosVeiculosRascunho(comNovoVeiculo ? [criarRascunhoVeiculoVazio()] : []);
    setErro('');
    setFichaAberta(true);
  };

  const atualizarRascunhoVeiculo = (
    tempId: string,
    patch: Partial<NovoVeiculoRascunho>
  ) => {
    setNovosVeiculosRascunho((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r))
    );
  };

  const removerRascunhoVeiculo = (tempId: string) => {
    setNovosVeiculosRascunho((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const consultarPlacaNoRascunho = async (tempId: string, placaCrua: string) => {
    const limpa = placaCrua.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (limpa.length < 7) {
      atualizarRascunhoVeiculo(tempId, {
        msgPlaca: 'Digite os 7 caracteres da placa para consultar.',
      });
      return;
    }
    atualizarRascunhoVeiculo(tempId, { buscandoPlaca: true, msgPlaca: '' });
    try {
      const dados = await api.consultarPlaca(limpa);
      atualizarRascunhoVeiculo(tempId, {
        marca: dados.marca || '',
        modelo: dados.modelo || '',
        cor: dados.cor || '',
        ano: dados.ano ? String(dados.ano) : '',
        chassi: dados.chassi || '',
        buscandoPlaca: false,
        msgPlaca: 'Dados do veículo preenchidos pela placa!',
      });
    } catch {
      atualizarRascunhoVeiculo(tempId, {
        buscandoPlaca: false,
        msgPlaca: 'Placa não localizada na base externa. Preencha manualmente.',
      });
    }
  };

  const handleSalvarFichaCliente = async (e: FormEvent) => {
    e.preventDefault();
    if (!cliNome.trim() || !cliTelefone.trim()) {
      setErro('Informe o Nome e o WhatsApp/Telefone do cliente.');
      return;
    }

    // Valida rascunhos de veículos preenchidos
    const rascunhosValidos = novosVeiculosRascunho.filter(
      (r) => r.placa.trim() || r.modelo.trim()
    );
    for (const r of rascunhosValidos) {
      if (!r.placa.trim() || !r.modelo.trim()) {
        setErro('Para cada veículo adicionado, informe ao menos a Placa e o Modelo.');
        return;
      }
    }

    setSalvandoFicha(true);
    setErro('');
    try {
      let clienteSalvo: Cliente;
      if (clienteEmEdicao) {
        clienteSalvo = await api.atualizarCliente(empresaId, clienteEmEdicao.id, {
          nome: cliNome.trim(),
          telefone: cliTelefone.trim(),
          cpf_cnpj: cliCpfCnpj.trim() || null,
          endereco: cliEndereco.trim() || null,
        });
      } else {
        clienteSalvo = await api.criarCliente({
          nome: cliNome.trim(),
          telefone: cliTelefone.trim(),
          cpf_cnpj: cliCpfCnpj.trim() || null,
          endereco: cliEndereco.trim() || null,
          empresa_id: empresaId,
        });
      }

      // Cria todos os veículos novos adicionados na ficha
      for (const r of rascunhosValidos) {
        await api.criarVeiculo({
          placa: r.placa.toUpperCase().trim(),
          modelo: r.modelo.trim(),
          marca: r.marca.trim() || null,
          cor: r.cor.trim() || null,
          ano: r.ano ? Number(r.ano) : null,
          km_atual: r.km_atual ? Number(r.km_atual) : null,
          chassi: r.chassi.trim() || null,
          cliente_id: clienteSalvo.id,
          empresa_id: empresaId,
        });
      }

      await carregarDados();
      setFichaAberta(false);
      notificarSucesso(
        clienteEmEdicao
          ? `Ficha de ${clienteSalvo.nome} atualizada com sucesso!`
          : `Cliente ${clienteSalvo.nome} cadastrado com sucesso!`
      );
    } catch (err: unknown) {
      setErro(
        err instanceof Error ? err.message : 'Erro ao salvar ficha do cliente.'
      );
    } finally {
      setSalvandoFicha(false);
    }
  };

  // Edição de Veículo Existente
  const abrirModalEditarVeiculo = (veiculo: Veiculo) => {
    setVeiculoEmEdicao(veiculo);
    setEditVeiPlaca(veiculo.placa || '');
    setEditVeiModelo(veiculo.modelo || '');
    setEditVeiMarca(veiculo.marca || '');
    setEditVeiCor(veiculo.cor || '');
    setEditVeiAno(veiculo.ano ? String(veiculo.ano) : '');
    setEditVeiKm(veiculo.km_atual != null ? String(veiculo.km_atual) : '');
    setEditVeiChassi(veiculo.chassi || '');
    setMsgPlacaEdit('');
    setErro('');
  };

  const handleConsultarPlacaEdit = async () => {
    const limpa = editVeiPlaca.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (limpa.length < 7) {
      setMsgPlacaEdit('Digite os 7 caracteres da placa.');
      return;
    }
    setBuscandoPlacaEdit(true);
    setMsgPlacaEdit('');
    try {
      const dados = await api.consultarPlaca(limpa);
      if (dados.marca) setEditVeiMarca(dados.marca);
      if (dados.modelo) setEditVeiModelo(dados.modelo);
      if (dados.cor) setEditVeiCor(dados.cor);
      if (dados.ano) setEditVeiAno(String(dados.ano));
      if (dados.chassi) setEditVeiChassi(dados.chassi);
      setMsgPlacaEdit('Dados preenchidos pela consulta de placa!');
    } catch {
      setMsgPlacaEdit('Placa não encontrada na base externa.');
    } finally {
      setBuscandoPlacaEdit(false);
    }
  };

  const handleSalvarEdicaoVeiculo = async (e: FormEvent) => {
    e.preventDefault();
    if (!veiculoEmEdicao) return;
    if (!editVeiPlaca.trim() || !editVeiModelo.trim()) {
      setErro('Placa e Modelo são obrigatórios.');
      return;
    }

    setSalvandoVeiculoEdit(true);
    setErro('');
    try {
      await api.atualizarVeiculo(empresaId, veiculoEmEdicao.id, {
        placa: editVeiPlaca.toUpperCase().trim(),
        modelo: editVeiModelo.trim(),
        marca: editVeiMarca.trim() || null,
        cor: editVeiCor.trim() || null,
        ano: editVeiAno ? Number(editVeiAno) : null,
        km_atual: editVeiKm ? Number(editVeiKm) : null,
        chassi: editVeiChassi.trim() || null,
      });
      await carregarDados();
      setVeiculoEmEdicao(null);
      notificarSucesso(`Veículo ${editVeiPlaca.toUpperCase()} atualizado!`);
    } catch (err: unknown) {
      setErro(
        err instanceof Error ? err.message : 'Erro ao atualizar dados do veículo.'
      );
    } finally {
      setSalvandoVeiculoEdit(false);
    }
  };

  // Abrir Histórico de OS
  const abrirHistoricoVeiculo = (veiculo: Veiculo, cliente?: Cliente) => {
    const ordens = osPorVeiculo[veiculo.id] || [];
    setHistoricoModal({
      titulo: `Histórico do Veículo ${veiculo.placa}`,
      subtitulo: `${veiculo.modelo}${veiculo.marca ? ` • ${veiculo.marca}` : ''} — Cliente: ${
        cliente?.nome || veiculo.clientes?.nome || 'Não identificado'
      }`,
      cliente,
      veiculo,
      ordens,
    });
  };

  const abrirHistoricoCliente = (cliente: Cliente) => {
    const ordens = osPorCliente[cliente.id] || [];
    setHistoricoModal({
      titulo: `Histórico de OS — ${cliente.nome}`,
      subtitulo: `Telefone: ${cliente.telefone} • ${
        (veiculosPorCliente[cliente.id] || []).length
      } veículo(s) cadastrado(s)`,
      cliente,
      ordens,
    });
  };

  // Abrir Nova OS Rápida direto do Veículo
  const iniciarNovaOsParaVeiculo = (veiculo: Veiculo, cliente?: Cliente) => {
    const dono =
      cliente ||
      clientePorId[veiculo.cliente_id] || {
        id: veiculo.cliente_id,
        nome: veiculo.clientes?.nome || 'Cliente',
        telefone: veiculo.clientes?.telefone || '',
        empresa_id: empresaId,
      };
    setNovaOsRapida({ cliente: dono, veiculo });
    setOsKmAtual(veiculo.km_atual ? String(veiculo.km_atual) : '');
    setOsMecanicoId('');
    setOsDescricao('');
    setErro('');
  };

  const handleConfirmarNovaOsRapida = async (e: FormEvent) => {
    e.preventDefault();
    if (!novaOsRapida) return;
    setCriandoOsRapida(true);
    setErro('');
    try {
      const resultado = await api.criarOS({
        cliente_id: novaOsRapida.cliente.id,
        veiculo_id: novaOsRapida.veiculo.id,
        mecanico_responsavel_id: osMecanicoId || null,
        descricao_problema: osDescricao.trim() || 'Avaliação técnica / Orçamento',
        km_atual: osKmAtual ? Number(osKmAtual) : null,
        empresa_id: empresaId,
      });
      setNovaOsRapida(null);
      onNavigateTab('os', undefined, resultado.id);
    } catch (err: unknown) {
      setErro(
        err instanceof Error ? err.message : 'Falha ao abrir Ordem de Serviço.'
      );
    } finally {
      setCriandoOsRapida(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* CABEÇALHO UNIFICADO COMPACTO DE CLIENTES & VEÍCULOS */}
      <div className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-white leading-tight">
              Clientes &amp; Veículos
            </h1>
            <p className="text-xs text-slate-400">
              {clientes.length} clientes &bull; {veiculos.length} veículos
            </p>
          </div>

          <button
            type="button"
            onClick={abrirFichaNovoCliente}
            className="sm:hidden min-h-[38px] px-3 py-1.5 rounded-xl bg-[#38BDF8] text-[#071226] font-extrabold text-xs flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" aria-hidden="true" />
            <span>+ Novo</span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* Alternador Rápido: Por Clientes vs Por Placas/Veículos */}
          <div
            role="group"
            aria-label="Modo de visualização"
            className="flex-1 sm:flex-initial bg-[#071226] p-1 rounded-xl border border-[#264577] grid grid-cols-2 sm:flex items-center gap-1"
          >
            <button
              type="button"
              onClick={() => {
                setViewMode('clientes');
                setCurrentPage(1);
              }}
              className={`min-h-[36px] sm:min-h-[40px] px-3 py-1 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'clientes'
                  ? 'bg-[#38BDF8] text-[#071226]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clientes ({clientes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('veiculos');
                setCurrentPage(1);
              }}
              className={`min-h-[36px] sm:min-h-[40px] px-3 py-1 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'veiculos'
                  ? 'bg-[#38BDF8] text-[#071226]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Placas ({veiculos.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={abrirFichaNovoCliente}
            className="hidden sm:flex min-h-[44px] px-4 py-2 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-sm items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.8]" aria-hidden="true" />
            <span>+ Novo Cliente &amp; Veículo</span>
          </button>
        </div>
      </div>

      {/* FEEDBACKS */}
      {feedbackSucesso && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-950/90 border border-emerald-500 rounded-xl p-2.5 flex items-center justify-between gap-2 text-emerald-100 text-xs sm:text-sm font-bold"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{feedbackSucesso}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackSucesso('')}
            className="text-xs underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {erro && !fichaAberta && !veiculoEmEdicao && !novaOsRapida && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-950/90 border border-red-500 rounded-xl p-2.5 flex items-center gap-2 text-red-100 text-xs sm:text-sm font-bold"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      {/* BARRA DE PESQUISA UNIFICADA COMPACTA (<search>) */}
      <search className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl sm:rounded-2xl p-2.5 sm:p-3">
        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            id="busca-clientes-veiculos"
            name="busca_clientes_veiculos"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Placa, nome do cliente, WhatsApp, CPF ou modelo…"
            aria-label="Pesquisar por placa, cliente, telefone, CPF ou modelo"
            className="w-full min-h-[40px] sm:min-h-[46px] pl-10 pr-20 py-1.5 rounded-lg sm:rounded-xl bg-[#071226] border border-[#264577] focus:border-[#38BDF8] text-white text-sm font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded bg-[#12274D] hover:bg-[#264577] text-xs font-bold text-slate-200 cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>
      </search>

      {/* CONTEÚDO PRINCIPAL: LISTA POR CLIENTES OU POR PLACAS */}
      {loading ? (
        <div className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <progress aria-label="Carregando clientes e veículos" className="loading-spinner" />
          <p className="text-slate-300 text-sm font-bold">Carregando clientes e frota…</p>
        </div>
      ) : viewMode === 'clientes' ? (
        clientesPaginados.length === 0 ? (
          <div className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl p-8 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-500 mx-auto" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-white">
                Nenhum cliente encontrado
              </h2>
            </div>
            <button
              type="button"
              onClick={abrirFichaNovoCliente}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#38BDF8] text-[#071226] font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Cadastrar Cliente &amp; Veículo</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {clientesPaginados.map((cli) => {
              const carros = veiculosPorCliente[cli.id] || [];
              const osDoCliente = osPorCliente[cli.id] || [];
              const zapUrl = montarLinkWhatsApp(cli.telefone, cli.nome);

              return (
                <article
                  key={cli.id}
                  className="bg-[#0B1B36] border border-[#12274D] hover:border-[#264577] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2.5 transition-colors"
                >
                  {/* Linha Superior do Cliente Compacta */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-sm sm:text-lg font-extrabold text-white truncate">
                          {cli.nome}
                        </h2>
                        <span className="px-2 py-0.5 rounded bg-[#1E3A8A] text-blue-100 text-[10px] sm:text-xs font-bold shrink-0">
                          {carros.length} {carros.length === 1 ? 'carro' : 'carros'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-300 mt-0.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-200">
                          <Phone className="w-3 h-3 text-[#38BDF8]" aria-hidden="true" />
                          <span>{cli.telefone || 'Sem fone'}</span>
                        </span>
                        {cli.cpf_cnpj && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
                            <FileText className="w-3 h-3" aria-hidden="true" />
                            <span>{cli.cpf_cnpj}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações Rápidas do Cliente (Ícones no Mobile, Texto no Desktop) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {zapUrl && (
                        <a
                          href={zapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp de ${cli.nome}`}
                          title="Chamar no WhatsApp"
                          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-4 h-4" aria-hidden="true" />
                          <span className="hidden md:inline">WhatsApp</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => abrirHistoricoCliente(cli)}
                        aria-label={`Histórico de ${cli.nome}`}
                        title="Histórico de OS do Cliente"
                        className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg bg-[#071226] hover:bg-[#12274D] border border-[#264577] text-slate-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-[#38BDF8]" aria-hidden="true" />
                        <span className="hidden md:inline">Histórico</span>
                        <span className="text-[11px] font-mono">({osDoCliente.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirFichaEditarCliente(cli, true)}
                        aria-label={`Adicionar veículo para ${cli.nome}`}
                        title="Adicionar Veículo"
                        className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg bg-[#1E3A8A] hover:bg-blue-800 border border-blue-500 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#38BDF8]" aria-hidden="true" />
                        <Car className="w-3.5 h-3.5 sm:hidden" aria-hidden="true" />
                        <span className="hidden sm:inline">+ Veículo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirFichaEditarCliente(cli, false)}
                        aria-label={`Editar ficha de ${cli.nome}`}
                        title="Editar Ficha do Cliente"
                        className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-[#071226] hover:bg-[#12274D] border border-[#3A5C90] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#38BDF8]" aria-hidden="true" />
                        <span className="hidden md:inline">Editar</span>
                      </button>
                    </div>
                  </div>

                  {/* Lista Compacta dos Veículos do Cliente */}
                  {carros.length === 0 ? (
                    <div className="bg-[#071226] border border-dashed border-[#264577] rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        Sem veículo vinculado.
                      </span>
                      <button
                        type="button"
                        onClick={() => abrirFichaEditarCliente(cli, true)}
                        className="px-2.5 py-1 rounded bg-[#38BDF8] text-[#071226] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>+ Veículo</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {carros.map((v) => {
                        const osDoCarro = osPorVeiculo[v.id] || [];
                        return (
                          <div
                            key={v.id}
                            className="bg-[#071226] border border-[#12274D] hover:border-[#3A5C90] rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="px-2 py-0.5 rounded bg-[#1E3A8A] border border-blue-400 text-white font-mono font-extrabold text-xs tracking-wider shrink-0">
                                  {v.placa}
                                </span>
                                <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                                  {v.modelo}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                                {v.marca && <span>{v.marca}</span>}
                                {v.cor && <span>• {v.cor}</span>}
                                {v.km_atual != null && (
                                  <span className="inline-flex items-center gap-0.5 text-slate-300 font-semibold">
                                    • {Number(v.km_atual).toLocaleString('pt-BR')} km
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => abrirHistoricoVeiculo(v, cli)}
                                title={`Histórico (${osDoCarro.length} OS)`}
                                aria-label={`Histórico do veículo ${v.placa}`}
                                className="h-8 px-2 rounded-lg bg-[#0B1B36] hover:bg-[#12274D] border border-[#264577] text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                                <span className="font-mono text-[11px]">{osDoCarro.length}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => abrirModalEditarVeiculo(v)}
                                title="Editar dados do veículo"
                                aria-label={`Editar veículo ${v.placa}`}
                                className="h-8 w-8 rounded-lg bg-[#0B1B36] hover:bg-[#12274D] border border-[#264577] text-slate-200 flex items-center justify-center cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() => iniciarNovaOsParaVeiculo(v, cli)}
                                className="h-8 px-2.5 rounded-lg bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Wrench className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                                <span>+ OS</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* VISÃO DIRETA POR PLACAS / VEÍCULOS COMPACTA */
        veiculosPaginados.length === 0 ? (
          <div className="bg-[#0B1B36] border-2 border-[#12274D] rounded-xl p-8 text-center space-y-2">
            <Car className="w-10 h-10 text-slate-500 mx-auto" aria-hidden="true" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Nenhum veículo encontrado
            </h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {veiculosPaginados.map((v) => {
              const dono = clientePorId[v.cliente_id];
              const nomeDono = dono?.nome || v.clientes?.nome || 'Cliente';
              const telDono = dono?.telefone || v.clientes?.telefone || '';
              const zapUrl = montarLinkWhatsApp(telDono, nomeDono, v.placa);
              const osDoCarro = osPorVeiculo[v.id] || [];

              return (
                <article
                  key={v.id}
                  className="bg-[#0B1B36] border border-[#12274D] hover:border-[#3A5C90] rounded-xl p-3 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-[#1E3A8A] border border-blue-400 text-white font-mono font-extrabold text-sm tracking-wider shrink-0">
                          {v.placa}
                        </span>
                        <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                          {v.modelo}
                        </h2>
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                        <strong className="text-slate-200">{nomeDono}</strong>
                        {telDono && <span>• {telDono}</span>}
                        {v.km_atual != null && (
                          <span>• {Number(v.km_atual).toLocaleString('pt-BR')} km</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {zapUrl && (
                        <a
                          href={zapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp de ${nomeDono}`}
                          className="h-8 w-8 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center"
                        >
                          <MessageCircle className="w-4 h-4" aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirModalEditarVeiculo(v)}
                        aria-label={`Editar veículo ${v.placa}`}
                        className="h-8 w-8 rounded-lg bg-[#071226] hover:bg-[#12274D] border border-[#264577] text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#38BDF8]" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#12274D]">
                    <button
                      type="button"
                      onClick={() => abrirHistoricoVeiculo(v, dono)}
                      className="flex-1 h-8 px-2.5 rounded-lg bg-[#071226] hover:bg-[#12274D] border border-[#264577] text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                      <span>Histórico ({osDoCarro.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => iniciarNovaOsParaVeiculo(v, dono)}
                      className="flex-1 h-8 px-2.5 rounded-lg bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>+ Abrir OS</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {/* PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="bg-[#0B1B36] border-2 border-[#12274D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-slate-300 font-semibold">
            Página <strong className="text-white">{currentPage}</strong> de{' '}
            <strong className="text-white">{totalPages}</strong> ({totalItems} registros)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#071226] border border-[#264577] disabled:opacity-40 text-white font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#071226] border border-[#264577] disabled:opacity-40 text-white font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: FICHA DO CLIENTE + MÚLTIPLOS VEÍCULOS (CRIAR OU EDITAR) */}
      {fichaAberta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-ficha-cliente"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-[#0B1B36] border-2 border-[#38BDF8] rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#12274D]">
              <div>
                <h2
                  id="titulo-modal-ficha-cliente"
                  className="text-xl sm:text-2xl font-extrabold text-white"
                >
                  {clienteEmEdicao
                    ? `Ficha de ${clienteEmEdicao.nome}`
                    : 'Novo Cliente & Veículo(s)'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Cadastre ou atualize os dados do cliente e vincule quantos veículos precisar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFichaAberta(false)}
                aria-label="Fechar ficha"
                className="p-2 rounded-xl bg-[#071226] border border-[#264577] text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {erro && (
              <div
                role="alert"
                className="bg-red-950 border border-red-500 rounded-xl p-3 text-sm text-red-100 font-bold flex items-center gap-2"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
                <span>{erro}</span>
              </div>
            )}

            <form onSubmit={handleSalvarFichaCliente} className="space-y-6">
              {/* Dados do Cliente */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-extrabold uppercase tracking-wider text-[#38BDF8]">
                  1. Dados do Cliente
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="cli-nome"
                      className="block text-xs font-bold text-slate-200 mb-1"
                    >
                      Nome Completo *
                    </label>
                    <input
                      id="cli-nome"
                      name="nome"
                      type="text"
                      required
                      autoComplete="name"
                      value={cliNome}
                      onChange={(e) => setCliNome(e.target.value)}
                      placeholder="Ex: João Carlos da Silva"
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cli-telefone"
                      className="block text-xs font-bold text-slate-200 mb-1"
                    >
                      WhatsApp / Telefone *
                    </label>
                    <input
                      id="cli-telefone"
                      name="telefone"
                      type="tel"
                      inputMode="tel"
                      required
                      autoComplete="tel"
                      value={cliTelefone}
                      onChange={(e) => setCliTelefone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cli-cpf-cnpj"
                      className="block text-xs font-bold text-slate-200 mb-1"
                    >
                      CPF ou CNPJ (opcional)
                    </label>
                    <input
                      id="cli-cpf-cnpj"
                      name="cpf_cnpj"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={cliCpfCnpj}
                      onChange={(e) => setCliCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cli-endereco"
                      className="block text-xs font-bold text-slate-200 mb-1"
                    >
                      Endereço (opcional)
                    </label>
                    <input
                      id="cli-endereco"
                      name="endereco"
                      type="text"
                      autoComplete="street-address"
                      value={cliEndereco}
                      onChange={(e) => setCliEndereco(e.target.value)}
                      placeholder="Rua, Número, Bairro, Cidade"
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Veículos já cadastrados deste cliente (quando está editando) */}
              {clienteEmEdicao && (veiculosPorCliente[clienteEmEdicao.id] || []).length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-sm font-extrabold uppercase tracking-wider text-blue-300">
                    Veículos Já Vinculados ({(veiculosPorCliente[clienteEmEdicao.id] || []).length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(veiculosPorCliente[clienteEmEdicao.id] || []).map((v) => (
                      <div
                        key={v.id}
                        className="bg-[#071226] border border-[#264577] rounded-xl p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="px-2 py-0.5 rounded bg-[#1E3A8A] text-white font-mono font-bold text-xs">
                            {v.placa}
                          </span>
                          <div className="text-sm font-bold text-white truncate mt-1">
                            {v.modelo} {v.marca ? `• ${v.marca}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFichaAberta(false);
                            abrirModalEditarVeiculo(v);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#0B1B36] hover:bg-[#12274D] border border-[#3A5C90] text-xs font-bold text-slate-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#38BDF8]" aria-hidden="true" />
                          <span>Editar Carro</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Novos Veículos a Adicionar na Ficha */}
              <fieldset className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <legend className="text-sm font-extrabold uppercase tracking-wider text-[#38BDF8]">
                    {clienteEmEdicao
                      ? '2. Adicionar Novo(s) Veículo(s) a este Cliente'
                      : '2. Veículo(s) do Cliente'}
                  </legend>
                  <button
                    type="button"
                    onClick={() =>
                      setNovosVeiculosRascunho((prev) => [
                        ...prev,
                        criarRascunhoVeiculoVazio(),
                      ])
                    }
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 border border-blue-400 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                    <span>+ Adicionar Outro Veículo</span>
                  </button>
                </div>

                {novosVeiculosRascunho.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Clique em &ldquo;+ Adicionar Outro Veículo&rdquo; acima se quiser cadastrar um carro novo para este cliente agora.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {novosVeiculosRascunho.map((rasc, idx) => (
                      <div
                        key={rasc.tempId}
                        className="bg-[#071226] border-2 border-[#264577] rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold uppercase text-blue-300">
                            Novo Veículo #{idx + 1}
                          </span>
                          {(novosVeiculosRascunho.length > 1 || clienteEmEdicao) && (
                            <button
                              type="button"
                              onClick={() => removerRascunhoVeiculo(rasc.tempId)}
                              className="text-xs text-red-400 hover:underline font-bold cursor-pointer"
                            >
                              Remover este veículo
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-5">
                            <label
                              htmlFor={`placa-${rasc.tempId}`}
                              className="block text-xs font-bold text-slate-300 mb-1"
                            >
                              Placa (com busca automática) *
                            </label>
                            <div className="flex gap-2">
                              <input
                                id={`placa-${rasc.tempId}`}
                                name={`placa_${idx}`}
                                type="text"
                                autoCorrect="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                maxLength={8}
                                value={rasc.placa}
                                onChange={(e) =>
                                  atualizarRascunhoVeiculo(rasc.tempId, {
                                    placa: e.target.value.toUpperCase(),
                                  })
                                }
                                placeholder="ABC1D23"
                                className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-[#0B1B36] border border-[#3A5C90] text-white font-mono font-bold uppercase text-base"
                              />
                              <button
                                type="button"
                                disabled={rasc.buscandoPlaca}
                                onClick={() =>
                                  consultarPlacaNoRascunho(rasc.tempId, rasc.placa)
                                }
                                className="min-h-[46px] px-3 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 border border-blue-400 text-white font-bold text-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                              >
                                <Sparkles className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                                <span>
                                  {rasc.buscandoPlaca ? 'Buscando…' : 'Buscar Placa'}
                                </span>
                              </button>
                            </div>
                            {rasc.msgPlaca && (
                              <span className="block text-[11px] text-amber-300 font-semibold mt-1">
                                {rasc.msgPlaca}
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-4">
                            <label
                              htmlFor={`modelo-${rasc.tempId}`}
                              className="block text-xs font-bold text-slate-300 mb-1"
                            >
                              Modelo *
                            </label>
                            <input
                              id={`modelo-${rasc.tempId}`}
                              name={`modelo_${idx}`}
                              type="text"
                              value={rasc.modelo}
                              onChange={(e) =>
                                atualizarRascunhoVeiculo(rasc.tempId, {
                                  modelo: e.target.value,
                                })
                              }
                              placeholder="Ex: Onix 1.0 Turbo"
                              className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-[#0B1B36] border border-[#3A5C90] text-white font-semibold text-base"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label
                              htmlFor={`marca-${rasc.tempId}`}
                              className="block text-xs font-bold text-slate-300 mb-1"
                            >
                              Marca / Montadora
                            </label>
                            <input
                              id={`marca-${rasc.tempId}`}
                              name={`marca_${idx}`}
                              type="text"
                              value={rasc.marca}
                              onChange={(e) =>
                                atualizarRascunhoVeiculo(rasc.tempId, {
                                  marca: e.target.value,
                                })
                              }
                              placeholder="Ex: Chevrolet"
                              className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-[#0B1B36] border border-[#3A5C90] text-white font-semibold text-base"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label
                              htmlFor={`cor-${rasc.tempId}`}
                              className="block text-xs font-bold text-slate-300 mb-1"
                            >
                              Cor
                            </label>
                            <input
                              id={`cor-${rasc.tempId}`}
                              name={`cor_${idx}`}
                              type="text"
                              value={rasc.cor}
                              onChange={(e) =>
                                atualizarRascunhoVeiculo(rasc.tempId, {
                                  cor: e.target.value,
                                })
                              }
                              placeholder="Prata / Branco"
                              className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-[#0B1B36] border border-[#3A5C90] text-white font-semibold text-base"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label
                              htmlFor={`ano-${rasc.tempId}`}
                              className="block text-xs font-bold text-slate-300 mb-1"
                            >
                              Ano
                            </label>
                            <input
                              id={`ano-${rasc.tempId}`}
                              name={`ano_${idx}`}
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              value={rasc.ano}
                              onChange={(e) =>
                                atualizarRascunhoVeiculo(rasc.tempId, {
                                  ano: e.target.value.replace(/\D/g, ''),
                                })
                              }
                              placeholder="2022"
                              className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-[#0B1B36] border border-[#3A5C90] text-white font-semibold text-base"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label
                              htmlFor={`km-${rasc.tempId}`}
                              className="block text-xs font-bold text-slate-300 mb-1"
                            >
                              KM Atual
                            </label>
                            <input
                              id={`km-${rasc.tempId}`}
                              name={`km_${idx}`}
                              type="text"
                              inputMode="numeric"
                              value={rasc.km_atual}
                              onChange={(e) =>
                                atualizarRascunhoVeiculo(rasc.tempId, {
                                  km_atual: e.target.value.replace(/\D/g, ''),
                                })
                              }
                              placeholder="85000"
                              className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-[#0B1B36] border border-[#3A5C90] text-white font-semibold text-base"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-[#12274D]">
                <button
                  type="button"
                  onClick={() => setFichaAberta(false)}
                  className="min-h-[50px] px-5 py-2.5 rounded-xl bg-[#071226] border border-[#264577] text-slate-200 font-bold text-base cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoFicha}
                  className="min-h-[50px] px-6 py-2.5 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-base cursor-pointer"
                >
                  {salvandoFicha ? 'Salvando Ficha…' : 'Salvar Ficha Completa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR VEÍCULO EXISTENTE */}
      {veiculoEmEdicao && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-editar-veiculo"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-[#0B1B36] border-2 border-[#38BDF8] rounded-2xl w-full max-w-xl p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#12274D]">
              <div>
                <h2
                  id="titulo-modal-editar-veiculo"
                  className="text-xl font-extrabold text-white"
                >
                  Editar Veículo — {veiculoEmEdicao.placa}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Atualize placa, modelo, cor, ano ou quilometragem do veículo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVeiculoEmEdicao(null)}
                aria-label="Fechar edição de veículo"
                className="p-2 rounded-xl bg-[#071226] border border-[#264577] text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {erro && (
              <div
                role="alert"
                className="bg-red-950 border border-red-500 rounded-xl p-3 text-sm text-red-100 font-bold"
              >
                {erro}
              </div>
            )}

            <form onSubmit={handleSalvarEdicaoVeiculo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label
                    htmlFor="edit-vei-placa"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    Placa *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="edit-vei-placa"
                      name="placa"
                      type="text"
                      required
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={8}
                      value={editVeiPlaca}
                      onChange={(e) => setEditVeiPlaca(e.target.value.toUpperCase())}
                      className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-mono font-bold uppercase text-base"
                    />
                    <button
                      type="button"
                      disabled={buscandoPlacaEdit}
                      onClick={handleConsultarPlacaEdit}
                      className="min-h-[48px] px-3 py-2 rounded-xl bg-[#1E3A8A] border border-blue-400 text-white font-bold text-xs shrink-0 cursor-pointer"
                    >
                      {buscandoPlacaEdit ? 'Buscando…' : 'Buscar Placa'}
                    </button>
                  </div>
                  {msgPlacaEdit && (
                    <span className="block text-[11px] text-amber-300 font-semibold mt-1">
                      {msgPlacaEdit}
                    </span>
                  )}
                </div>

                <div className="sm:col-span-6">
                  <label
                    htmlFor="edit-vei-modelo"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    Modelo *
                  </label>
                  <input
                    id="edit-vei-modelo"
                    name="modelo"
                    type="text"
                    required
                    value={editVeiModelo}
                    onChange={(e) => setEditVeiModelo(e.target.value)}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="edit-vei-marca"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    Marca
                  </label>
                  <input
                    id="edit-vei-marca"
                    name="marca"
                    type="text"
                    value={editVeiMarca}
                    onChange={(e) => setEditVeiMarca(e.target.value)}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="edit-vei-cor"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    Cor
                  </label>
                  <input
                    id="edit-vei-cor"
                    name="cor"
                    type="text"
                    value={editVeiCor}
                    onChange={(e) => setEditVeiCor(e.target.value)}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="edit-vei-ano"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    Ano
                  </label>
                  <input
                    id="edit-vei-ano"
                    name="ano"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={editVeiAno}
                    onChange={(e) => setEditVeiAno(e.target.value.replace(/\D/g, ''))}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label
                    htmlFor="edit-vei-km"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    KM Atual
                  </label>
                  <input
                    id="edit-vei-km"
                    name="km_atual"
                    type="text"
                    inputMode="numeric"
                    value={editVeiKm}
                    onChange={(e) => setEditVeiKm(e.target.value.replace(/\D/g, ''))}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label
                    htmlFor="edit-vei-chassi"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    Chassi (opcional)
                  </label>
                  <input
                    id="edit-vei-chassi"
                    name="chassi"
                    type="text"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={editVeiChassi}
                    onChange={(e) => setEditVeiChassi(e.target.value.toUpperCase())}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#12274D]">
                <button
                  type="button"
                  onClick={() => setVeiculoEmEdicao(null)}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#071226] border border-[#264577] text-slate-200 font-bold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoVeiculoEdit}
                  className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-sm cursor-pointer"
                >
                  {salvandoVeiculoEdit ? 'Salvando…' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: HISTÓRICO DE ORDENS DE SERVIÇO DO VEÍCULO OU CLIENTE */}
      {historicoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-historico-os"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-[#0B1B36] border-2 border-[#2563EB] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col p-5 sm:p-6 gap-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#12274D]">
              <div>
                <h2
                  id="titulo-modal-historico-os"
                  className="text-xl font-extrabold text-white"
                >
                  {historicoModal.titulo}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  {historicoModal.subtitulo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoricoModal(null)}
                aria-label="Fechar histórico"
                className="p-2 rounded-xl bg-[#071226] border border-[#264577] text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
              {historicoModal.ordens.length === 0 ? (
                <div className="bg-[#071226] border border-[#12274D] rounded-xl p-8 text-center text-slate-400">
                  Nenhuma Ordem de Serviço registrada para este filtro ainda.
                </div>
              ) : (
                historicoModal.ordens.map((os) => {
                  const st = STATUS_META[os.status] || STATUS_META.ORCAMENTO;
                  return (
                    <div
                      key={os.id}
                      className="bg-[#071226] border border-[#264577] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400">
                            #{os.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border text-xs font-bold ${st.badgeBg} ${st.badgeText}`}
                          >
                            {st.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatarDataCurta(os.data_abertura)}
                          </span>
                          {os.veiculos?.placa && (
                            <span className="px-2 py-0.5 rounded bg-[#1E3A8A] text-white font-mono text-xs font-bold">
                              {os.veiculos.placa}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-200 truncate">
                          {os.descricao_problema || 'Sem descrição informada'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Total</div>
                          <div className="text-base font-extrabold text-white">
                            {formatarMoeda(os.total_geral)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setHistoricoModal(null);
                            onNavigateTab('os', undefined, os.id);
                          }}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 border border-blue-400 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Abrir OS</span>
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#12274D]">
              {historicoModal.veiculo ? (
                <button
                  type="button"
                  onClick={() => {
                    const v = historicoModal.veiculo!;
                    const c = historicoModal.cliente;
                    setHistoricoModal(null);
                    iniciarNovaOsParaVeiculo(v, c);
                  }}
                  className="min-h-[46px] px-4 py-2 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Wrench className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                  <span>+ Abrir Nova OS para {historicoModal.veiculo.placa}</span>
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setHistoricoModal(null)}
                className="min-h-[46px] px-5 py-2 rounded-xl bg-[#071226] border border-[#264577] text-slate-200 font-bold text-sm cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ABRIR NOVA OS RÁPIDA DIRETO DO VEÍCULO */}
      {novaOsRapida && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-nova-os-rapida"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="bg-[#0B1B36] border-2 border-[#38BDF8] rounded-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#12274D]">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-[#1E3A8A] text-white font-mono font-bold text-xs">
                  {novaOsRapida.veiculo.placa} &bull; {novaOsRapida.veiculo.modelo}
                </span>
                <h2
                  id="titulo-modal-nova-os-rapida"
                  className="text-xl font-extrabold text-white mt-1.5"
                >
                  Abrir Ordem de Serviço
                </h2>
                <p className="text-xs text-slate-300">
                  Cliente: <strong>{novaOsRapida.cliente.nome}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNovaOsRapida(null)}
                aria-label="Fechar abertura rápida de OS"
                className="p-2 rounded-xl bg-[#071226] border border-[#264577] text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {erro && (
              <div
                role="alert"
                className="bg-red-950 border border-red-500 rounded-xl p-3 text-sm text-red-100 font-bold"
              >
                {erro}
              </div>
            )}

            <form onSubmit={handleConfirmarNovaOsRapida} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="os-rapida-km"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    KM Atual na Entrada
                  </label>
                  <input
                    id="os-rapida-km"
                    name="km_atual"
                    type="text"
                    inputMode="numeric"
                    value={osKmAtual}
                    onChange={(e) => setOsKmAtual(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 85000"
                    className="w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-base"
                  />
                </div>

                <div>
                  <label
                    htmlFor="os-rapida-mecanico"
                    className="block text-xs font-bold text-slate-200 mb-1"
                  >
                    Mecânico Responsável
                  </label>
                  <select
                    id="os-rapida-mecanico"
                    name="mecanico_responsavel_id"
                    value={osMecanicoId}
                    onChange={(e) => setOsMecanicoId(e.target.value)}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#071226] border border-[#264577] text-white font-semibold text-sm cursor-pointer"
                  >
                    <option value="">Definir depois na bancada</option>
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
                  htmlFor="os-rapida-defeito"
                  className="block text-xs font-bold text-slate-200 mb-1"
                >
                  Defeito Relatado / Serviço Solicitado
                </label>
                <textarea
                  id="os-rapida-defeito"
                  name="descricao_problema"
                  rows={3}
                  value={osDescricao}
                  onChange={(e) => setOsDescricao(e.target.value)}
                  placeholder="Ex: Revisão de freios, troca de óleo e barulho na suspensão dianteira..."
                  className="w-full p-3.5 rounded-xl bg-[#071226] border border-[#264577] text-white font-medium text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#12274D]">
                <button
                  type="button"
                  onClick={() => setNovaOsRapida(null)}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-[#071226] border border-[#264577] text-slate-200 font-bold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoOsRapida}
                  className="min-h-[48px] px-6 py-2 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Wrench className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                  <span>{criandoOsRapida ? 'Abrindo Bancada…' : 'Abrir Bancada da OS'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ClientesVeiculos;

