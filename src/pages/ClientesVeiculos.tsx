import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Cliente, StatusOS, UltimaOS, Usuario, Veiculo } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Car,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Button,
  CLASSE_CAMPO,
  Field,
  PageHeader,
  Panel,
  PlateChip,
  Skeleton,
  StatusBadge,
  STATUS_OS,
  Tabs,
} from '../components/ui';
import { Folha } from '../components/Folha';
import { LinhaCliente } from './clientes/LinhaCliente';
import { LinhaVeiculo } from './clientes/LinhaVeiculo';
import {
  PAGE_SIZE,
  agruparPor,
  faixaDaPagina,
  filtrarClientes,
  filtrarVeiculos,
  formatarDataCurta,
  formatarMoeda,
} from './clientes/auxiliares';

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

const CLASSE_TEXTAREA =
  'min-h-24 w-full rounded-lg border border-line-strong bg-sunken p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

export function ClientesVeiculos({
  empresaId,
  initialViewMode = 'clientes',
  onNavigateTab,
}: ClientesVeiculosProps) {
  const [viewMode, setViewMode] = useState<'clientes' | 'veiculos'>(initialViewMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  // Saída pendente de confirmação ("Descartar alterações?") quando uma folha de formulário tem dados não salvos
  const [saidaPendente, setSaidaPendente] = useState<(() => void) | null>(null);

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
  const veiculosPorCliente = useMemo(() => agruparPor(veiculos, (v) => v.cliente_id), [veiculos]);

  const clientePorId = useMemo(() => {
    const map: Record<string, Cliente> = {};
    for (const c of clientes) {
      map[c.id] = c;
    }
    return map;
  }, [clientes]);

  const osPorVeiculo = useMemo(() => agruparPor(historicoGeralOS, (os) => os.veiculo_id), [historicoGeralOS]);

  const osPorCliente = useMemo(() => agruparPor(historicoGeralOS, (os) => os.cliente_id), [historicoGeralOS]);

  // Filtro unificado por Nome, Telefone, CPF/CNPJ, Placa ou Modelo
  const clientesFiltrados = useMemo(
    () => filtrarClientes(clientes, veiculosPorCliente, searchTerm),
    [clientes, veiculosPorCliente, searchTerm]
  );

  const veiculosFiltrados = useMemo(
    () => filtrarVeiculos(veiculos, clientePorId, searchTerm),
    [veiculos, clientePorId, searchTerm]
  );

  const totalItems =
    viewMode === 'clientes' ? clientesFiltrados.length : veiculosFiltrados.length;
  const { inicio: inicioRegistro, fim: fimRegistro, totalPaginas: totalPages } = faixaDaPagina(
    currentPage,
    totalItems,
    PAGE_SIZE
  );

  const clientesPaginados = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return clientesFiltrados.slice(start, start + PAGE_SIZE);
  }, [clientesFiltrados, currentPage]);

  const veiculosPaginados = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return veiculosFiltrados.slice(start, start + PAGE_SIZE);
  }, [veiculosFiltrados, currentPage]);

  const alternarExpandido = (id: string) =>
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

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
  const fichaSuja =
    cliNome !== (clienteEmEdicao?.nome || '') ||
    cliTelefone !== (clienteEmEdicao?.telefone || '') ||
    cliCpfCnpj !== (clienteEmEdicao?.cpf_cnpj || '') ||
    cliEndereco !== (clienteEmEdicao?.endereco || '') ||
    novosVeiculosRascunho.some((r) => r.placa || r.modelo || r.marca || r.cor || r.ano || r.km_atual || r.chassi);
  const veiculoSujo =
    veiculoEmEdicao !== null &&
    (editVeiPlaca !== (veiculoEmEdicao.placa || '') ||
      editVeiModelo !== (veiculoEmEdicao.modelo || '') ||
      editVeiMarca !== (veiculoEmEdicao.marca || '') ||
      editVeiCor !== (veiculoEmEdicao.cor || '') ||
      editVeiAno !== (veiculoEmEdicao.ano ? String(veiculoEmEdicao.ano) : '') ||
      editVeiKm !== (veiculoEmEdicao.km_atual != null ? String(veiculoEmEdicao.km_atual) : '') ||
      editVeiChassi !== (veiculoEmEdicao.chassi || ''));
  const osSuja =
    novaOsRapida !== null &&
    (osDescricao.trim() !== '' ||
      osMecanicoId !== '' ||
      osKmAtual !== (novaOsRapida.veiculo.km_atual ? String(novaOsRapida.veiculo.km_atual) : ''));

  useEffect(() => {
    if (!fichaAberta && !veiculoEmEdicao && !novaOsRapida) setSaidaPendente(null);
  }, [fichaAberta, veiculoEmEdicao, novaOsRapida]);

  // Esc, voltar do Android e Cancelar: com dados digitados, pede confirmação em vez de descartar em silêncio
  const sairDaFolha = (sujo: boolean, fechar: () => void) => {
    if (sujo) setSaidaPendente(() => fechar);
    else fechar();
  };
  const fecharFicha = () => {
    setSaidaPendente(null);
    setFichaAberta(false);
  };
  const fecharEdicaoVeiculo = () => {
    setSaidaPendente(null);
    setVeiculoEmEdicao(null);
  };
  const fecharOsRapida = () => {
    setSaidaPendente(null);
    setNovaOsRapida(null);
  };

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

  const alertaErro = (mensagem: string) => (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{mensagem}</span>
    </p>
  );

  const botaoPlaca = (buscando: boolean | undefined, aoClicar: () => void) => (
    <Button variante="secundario" icone={Sparkles} disabled={buscando} onClick={aoClicar} className="shrink-0">
      {buscando ? 'Buscando…' : 'Buscar Placa'}
    </Button>
  );

  const vazio = !loading && totalItems === 0;
  const semBusca = searchTerm.trim() === '';
  const rotuloPagina = viewMode === 'clientes' ? 'clientes' : 'veículos';

  return (
    <div>
      <PageHeader
        titulo="Clientes & Veículos"
        complemento={
          loading ? undefined : (
            <span className="text-[1.375rem] font-semibold tabular-nums text-ink-subtle">{clientes.length}</span>
          )
        }
        abaixo={loading ? undefined : <span className="tabular-nums">{veiculos.length} veículos cadastrados</span>}
        acoes={
          <Button icone={Plus} onClick={abrirFichaNovoCliente}>
            Novo cliente
          </Button>
        }
      />

      {feedbackSucesso && (
        <p
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-success/15 px-4 py-3 text-sm font-medium text-success"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{feedbackSucesso}</span>
          </span>
          <button
            type="button"
            onClick={() => setFeedbackSucesso('')}
            className="min-h-11 cursor-pointer px-2 text-sm underline"
          >
            Fechar
          </button>
        </p>
      )}

      {erro && !fichaAberta && !veiculoEmEdicao && !novaOsRapida && <div className="mb-4">{alertaErro(erro)}</div>}

      <search className="mb-4 block space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
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
            placeholder="Placa, nome, WhatsApp, CPF ou modelo…"
            aria-label="Pesquisar por placa, cliente, telefone, CPF ou modelo"
            className={`${CLASSE_CAMPO} pl-9`}
          />
        </div>
        <Tabs
          rotuloGrupo="Modo de visualização"
          idPainel="painel-clientes-veiculos"
          ativo={viewMode}
          aoMudar={(id) => {
            setViewMode(id as 'clientes' | 'veiculos');
            setCurrentPage(1);
          }}
          itens={[
            { id: 'clientes', rotulo: `Clientes · ${clientes.length}`, icone: Users },
            { id: 'veiculos', rotulo: `Placas · ${veiculos.length}`, icone: Car },
          ]}
        />
      </search>

      <div role="tabpanel" id="painel-clientes-veiculos" aria-labelledby={`aba-${viewMode}`}>
        {loading ? (
          <Panel>
            <Skeleton linhas={6} />
          </Panel>
        ) : vazio ? (
          <Panel espaco="lg" className="space-y-2">
            <h2 className="text-lg font-semibold text-ink">
              {semBusca
                ? viewMode === 'clientes'
                  ? 'Nenhum cliente cadastrado'
                  : 'Nenhum veículo cadastrado'
                : viewMode === 'clientes'
                  ? 'Nenhum cliente encontrado'
                  : 'Nenhum veículo encontrado'}
            </h2>
            <p className="text-sm text-ink-muted">
              {semBusca
                ? 'Use “Novo cliente” para cadastrar o primeiro cliente com seus veículos.'
                : 'Confira a grafia ou busque por outra placa, nome ou telefone.'}
            </p>
            {!semBusca && (
              <Button
                variante="secundario"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
              >
                Limpar busca
              </Button>
            )}
          </Panel>
        ) : viewMode === 'clientes' ? (
          <Panel as="ul" espaco="nenhum" aria-label="Clientes" className="divide-y divide-line">
            {clientesPaginados.map((cli) => (
              <LinhaCliente
                key={cli.id}
                cliente={cli}
                carros={veiculosPorCliente[cli.id] || []}
                osPorVeiculo={osPorVeiculo}
                totalOS={(osPorCliente[cli.id] || []).length}
                expandido={expandidos.has(cli.id)}
                aoAlternar={() => alternarExpandido(cli.id)}
                aoEditar={() => abrirFichaEditarCliente(cli, false)}
                aoAdicionarVeiculo={() => abrirFichaEditarCliente(cli, true)}
                aoHistorico={() => abrirHistoricoCliente(cli)}
                aoHistoricoVeiculo={(v) => abrirHistoricoVeiculo(v, cli)}
                aoEditarVeiculo={abrirModalEditarVeiculo}
                aoAbrirOS={(v) => iniciarNovaOsParaVeiculo(v, cli)}
              />
            ))}
          </Panel>
        ) : (
          <Panel as="ul" espaco="nenhum" aria-label="Veículos" className="divide-y divide-line">
            {veiculosPaginados.map((v) => {
              const dono = clientePorId[v.cliente_id];
              return (
                <LinhaVeiculo
                  key={v.id}
                  veiculo={v}
                  nomeDono={dono?.nome || v.clientes?.nome || 'Cliente'}
                  telDono={dono?.telefone || v.clientes?.telefone || ''}
                  qtdOS={(osPorVeiculo[v.id] || []).length}
                  aoHistorico={() => abrirHistoricoVeiculo(v, dono)}
                  aoEditar={() => abrirModalEditarVeiculo(v)}
                  aoAbrirOS={() => iniciarNovaOsParaVeiculo(v, dono)}
                />
              );
            })}
          </Panel>
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label={`Paginação de ${rotuloPagina}`}
          className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row"
        >
          <p className="text-sm tabular-nums text-ink-muted">
            Mostrando{' '}
            <span className="font-medium text-ink">
              {inicioRegistro}–{fimRegistro}
            </span>{' '}
            de <span className="font-medium text-ink">{totalItems}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variante="secundario"
              icone={ChevronLeft}
              aria-label="Página anterior"
              className="!min-h-11"
              disabled={currentPage <= 1}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Anterior
            </Button>
            <span className="px-2 text-sm tabular-nums text-ink-muted">
              {currentPage} de {totalPages}
            </span>
            <Button
              variante="secundario"
              aria-label="Próxima página"
              className="!min-h-11"
              disabled={currentPage >= totalPages}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Próxima
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      {/* FOLHA 1: FICHA DO CLIENTE + MÚLTIPLOS VEÍCULOS (CRIAR OU EDITAR) */}
      <Folha
        aberto={fichaAberta}
        focoInicial="primeiro-campo"
        tamanho="lg"
        fecharNoFundo={false}
        titulo={clienteEmEdicao ? `Ficha de ${clienteEmEdicao.nome}` : 'Novo cliente e veículos'}
        aoCancelar={() => sairDaFolha(fichaSuja, fecharFicha)}
      >
        <p className="-mt-3 text-sm text-ink-muted">
          Cadastre ou atualize os dados do cliente e vincule quantos veículos precisar.
        </p>
        {confirmarDescarte}
        {erro && alertaErro(erro)}
        <form onSubmit={handleSalvarFichaCliente} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="mb-3 text-base font-semibold text-ink">Dados do cliente</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field rotulo="Nome Completo *">
                <input
                  id="cli-nome"
                  name="nome"
                  type="text"
                  required
                  autoComplete="name"
                  value={cliNome}
                  onChange={(e) => setCliNome(e.target.value)}
                  placeholder="Ex: João Carlos da Silva"
                  className={CLASSE_CAMPO}
                />
              </Field>
              <Field rotulo="WhatsApp / Telefone *">
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
                  className={CLASSE_CAMPO}
                />
              </Field>
              <Field rotulo="CPF ou CNPJ (opcional)">
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
                  className={CLASSE_CAMPO}
                />
              </Field>
              <Field rotulo="Endereço (opcional)">
                <input
                  id="cli-endereco"
                  name="endereco"
                  type="text"
                  autoComplete="street-address"
                  value={cliEndereco}
                  onChange={(e) => setCliEndereco(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade"
                  className={CLASSE_CAMPO}
                />
              </Field>
            </div>
          </fieldset>

          {clienteEmEdicao && (veiculosPorCliente[clienteEmEdicao.id] || []).length > 0 && (
            <div>
              <h3 className="mb-1 text-base font-semibold text-ink">
                Veículos já vinculados{' '}
                <span className="tabular-nums text-ink-subtle">
                  {(veiculosPorCliente[clienteEmEdicao.id] || []).length}
                </span>
              </h3>
              <ul className="divide-y divide-line">
                {(veiculosPorCliente[clienteEmEdicao.id] || []).map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2">
                    <PlateChip placa={v.placa} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {v.modelo}
                      {v.marca ? ` · ${v.marca}` : ''}
                    </span>
                    <Button
                      variante="fantasma"
                      tamanho="sm"
                      onClick={() =>
                        sairDaFolha(fichaSuja, () => {
                          fecharFicha();
                          abrirModalEditarVeiculo(v);
                        })
                      }
                    >
                      Editar carro
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset>
            <div className="mb-1 flex items-center justify-between gap-3">
              <legend className="text-base font-semibold text-ink">
                {clienteEmEdicao ? 'Novos veículos deste cliente' : 'Veículos do cliente'}
              </legend>
              <Button
                variante="secundario"
                tamanho="sm"
                icone={Plus}
                onClick={() => setNovosVeiculosRascunho((prev) => [...prev, criarRascunhoVeiculoVazio()])}
                className="shrink-0 whitespace-nowrap"
              >
                Adicionar outro veículo
              </Button>
            </div>

            {novosVeiculosRascunho.length === 0 ? (
              <p className="pt-2 text-sm text-ink-subtle">
                Use “Adicionar outro veículo” se quiser cadastrar um carro novo para este cliente agora.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {novosVeiculosRascunho.map((rasc, idx) => (
                  <div key={rasc.tempId} className="space-y-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-muted">Novo veículo {idx + 1}</span>
                      {(novosVeiculosRascunho.length > 1 || clienteEmEdicao) && (
                        <Button variante="fantasma" tamanho="sm" onClick={() => removerRascunhoVeiculo(rasc.tempId)}>
                          Remover este veículo
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-6 flex flex-col gap-1.5 sm:col-span-3">
                        <label htmlFor={`placa-${rasc.tempId}`} className="text-sm font-medium text-ink">
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
                            onChange={(e) => atualizarRascunhoVeiculo(rasc.tempId, { placa: e.target.value.toUpperCase() })}
                            placeholder="ABC1D23"
                            className={`${CLASSE_CAMPO} font-mono uppercase`}
                          />
                          {botaoPlaca(rasc.buscandoPlaca, () => consultarPlacaNoRascunho(rasc.tempId, rasc.placa))}
                        </div>
                        {rasc.msgPlaca && (
                          <p role="status" className="text-xs text-ink-muted">
                            {rasc.msgPlaca}
                          </p>
                        )}
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Field rotulo="Modelo *">
                          <input
                            id={`modelo-${rasc.tempId}`}
                            name={`modelo_${idx}`}
                            type="text"
                            value={rasc.modelo}
                            onChange={(e) => atualizarRascunhoVeiculo(rasc.tempId, { modelo: e.target.value })}
                            placeholder="Ex: Onix 1.0 Turbo"
                            className={CLASSE_CAMPO}
                          />
                        </Field>
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <Field rotulo="Marca / Montadora">
                          <input
                            id={`marca-${rasc.tempId}`}
                            name={`marca_${idx}`}
                            type="text"
                            value={rasc.marca}
                            onChange={(e) => atualizarRascunhoVeiculo(rasc.tempId, { marca: e.target.value })}
                            placeholder="Ex: Chevrolet"
                            className={CLASSE_CAMPO}
                          />
                        </Field>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Field rotulo="Cor">
                          <input
                            id={`cor-${rasc.tempId}`}
                            name={`cor_${idx}`}
                            type="text"
                            value={rasc.cor}
                            onChange={(e) => atualizarRascunhoVeiculo(rasc.tempId, { cor: e.target.value })}
                            placeholder="Prata"
                            className={CLASSE_CAMPO}
                          />
                        </Field>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Field rotulo="Ano">
                          <input
                            id={`ano-${rasc.tempId}`}
                            name={`ano_${idx}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={rasc.ano}
                            onChange={(e) => atualizarRascunhoVeiculo(rasc.tempId, { ano: e.target.value.replace(/\D/g, '') })}
                            placeholder="2022"
                            className={CLASSE_CAMPO}
                          />
                        </Field>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Field rotulo="KM Atual">
                          <input
                            id={`km-${rasc.tempId}`}
                            name={`km_${idx}`}
                            type="text"
                            inputMode="numeric"
                            value={rasc.km_atual}
                            onChange={(e) => atualizarRascunhoVeiculo(rasc.tempId, { km_atual: e.target.value.replace(/\D/g, '') })}
                            placeholder="85000"
                            className={CLASSE_CAMPO}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={() => sairDaFolha(fichaSuja, fecharFicha)}>
              Cancelar
            </Button>
            <Button type="submit" carregando={salvandoFicha}>
              {salvandoFicha ? 'Salvando ficha…' : 'Salvar ficha'}
            </Button>
          </div>
        </form>
      </Folha>

      {/* FOLHA 2: EDITAR VEÍCULO EXISTENTE */}
      <Folha
        aberto={veiculoEmEdicao !== null}
        focoInicial="primeiro-campo"
        tamanho="lg"
        fecharNoFundo={false}
        titulo={veiculoEmEdicao ? `Editar Veículo — ${veiculoEmEdicao.placa}` : ''}
        aoCancelar={() => sairDaFolha(veiculoSujo, fecharEdicaoVeiculo)}
      >
        <p className="-mt-3 text-sm text-ink-muted">Atualize placa, modelo, cor, ano ou quilometragem do veículo.</p>
        {confirmarDescarte}
        {erro && alertaErro(erro)}
        <form onSubmit={handleSalvarEdicaoVeiculo} className="space-y-6">
          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-6 flex flex-col gap-1.5 sm:col-span-3">
              <label htmlFor="edit-vei-placa" className="text-sm font-medium text-ink">
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
                  className={`${CLASSE_CAMPO} font-mono uppercase`}
                />
                {botaoPlaca(buscandoPlacaEdit, handleConsultarPlacaEdit)}
              </div>
              {msgPlacaEdit && (
                <p role="status" className="text-xs text-ink-muted">
                  {msgPlacaEdit}
                </p>
              )}
            </div>
            <div className="col-span-6 sm:col-span-3">
              <Field rotulo="Modelo *">
                <input
                  id="edit-vei-modelo"
                  name="modelo"
                  type="text"
                  required
                  value={editVeiModelo}
                  onChange={(e) => setEditVeiModelo(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </Field>
            </div>
            <div className="col-span-6 sm:col-span-2">
              <Field rotulo="Marca">
                <input
                  id="edit-vei-marca"
                  name="marca"
                  type="text"
                  value={editVeiMarca}
                  onChange={(e) => setEditVeiMarca(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </Field>
            </div>
            <div className="col-span-3 sm:col-span-2">
              <Field rotulo="Cor">
                <input
                  id="edit-vei-cor"
                  name="cor"
                  type="text"
                  value={editVeiCor}
                  onChange={(e) => setEditVeiCor(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </Field>
            </div>
            <div className="col-span-3 sm:col-span-2">
              <Field rotulo="Ano">
                <input
                  id="edit-vei-ano"
                  name="ano"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={editVeiAno}
                  onChange={(e) => setEditVeiAno(e.target.value.replace(/\D/g, ''))}
                  className={CLASSE_CAMPO}
                />
              </Field>
            </div>
            <div className="col-span-6 sm:col-span-3">
              <Field rotulo="KM Atual">
                <input
                  id="edit-vei-km"
                  name="km_atual"
                  type="text"
                  inputMode="numeric"
                  value={editVeiKm}
                  onChange={(e) => setEditVeiKm(e.target.value.replace(/\D/g, ''))}
                  className={CLASSE_CAMPO}
                />
              </Field>
            </div>
            <div className="col-span-6 sm:col-span-3">
              <Field rotulo="Chassi (opcional)">
                <input
                  id="edit-vei-chassi"
                  name="chassi"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={editVeiChassi}
                  onChange={(e) => setEditVeiChassi(e.target.value.toUpperCase())}
                  className={`${CLASSE_CAMPO} font-mono`}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={() => sairDaFolha(veiculoSujo, fecharEdicaoVeiculo)}>
              Cancelar
            </Button>
            <Button type="submit" carregando={salvandoVeiculoEdit}>
              {salvandoVeiculoEdit ? 'Salvando…' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Folha>

      {/* FOLHA 3: HISTÓRICO DE ORDENS DE SERVIÇO DO VEÍCULO OU CLIENTE */}
      <Folha
        aberto={historicoModal !== null}
        tamanho="lg"
        titulo={historicoModal?.titulo ?? ''}
        aoCancelar={() => setHistoricoModal(null)}
      >
        {historicoModal && (
          <>
            <p className="-mt-3 text-sm text-ink-muted">{historicoModal.subtitulo}</p>
            {historicoModal.ordens.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-subtle">
                Nenhuma Ordem de Serviço registrada para este filtro ainda.
              </p>
            ) : (
              <ul aria-label="Ordens de serviço" className="divide-y divide-line">
                {historicoModal.ordens.map((os) => (
                  <li key={os.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={os.status in STATUS_OS ? os.status : 'ORCAMENTO'} />
                        <span className="text-xs tabular-nums text-ink-muted">{formatarDataCurta(os.data_abertura)}</span>
                        <span className="font-mono text-xs text-ink-subtle">#{os.id.slice(0, 8).toUpperCase()}</span>
                        {!historicoModal.veiculo && os.veiculos?.placa && <PlateChip placa={os.veiculos.placa} />}
                      </div>
                      <p className="truncate text-sm text-ink">{os.descricao_problema || 'Sem descrição informada'}</p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3">
                      <span className="text-base font-semibold tabular-nums text-ink">{formatarMoeda(os.total_geral)}</span>
                      <Button
                        variante="secundario"
                        tamanho="sm"
                        onClick={() => {
                          setHistoricoModal(null);
                          onNavigateTab('os', undefined, os.id);
                        }}
                      >
                        Abrir OS
                        <ExternalLink size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variante="secundario" onClick={() => setHistoricoModal(null)}>
                Fechar
              </Button>
              {historicoModal.veiculo && (
                <Button
                  onClick={() => {
                    const v = historicoModal.veiculo!;
                    const c = historicoModal.cliente;
                    setHistoricoModal(null);
                    iniciarNovaOsParaVeiculo(v, c);
                  }}
                >
                  Abrir nova OS para {historicoModal.veiculo.placa}
                </Button>
              )}
            </div>
          </>
        )}
      </Folha>

      {/* FOLHA 4: ABRIR NOVA OS RÁPIDA DIRETO DO VEÍCULO */}
      <Folha
        aberto={novaOsRapida !== null}
        focoInicial="primeiro-campo"
        fecharNoFundo={false}
        titulo="Abrir Ordem de Serviço"
        aoCancelar={() => sairDaFolha(osSuja, fecharOsRapida)}
      >
        {novaOsRapida && (
          <>
            <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <PlateChip placa={novaOsRapida.veiculo.placa} />
              <span>{novaOsRapida.veiculo.modelo}</span>
              <span>
                Cliente: <span className="font-medium text-ink">{novaOsRapida.cliente.nome}</span>
              </span>
            </div>
            {confirmarDescarte}
            {erro && alertaErro(erro)}
            <form onSubmit={handleConfirmarNovaOsRapida} className="space-y-4">
              <Field rotulo="KM Atual na Entrada">
                <input
                  id="os-rapida-km"
                  name="km_atual"
                  type="text"
                  inputMode="numeric"
                  value={osKmAtual}
                  onChange={(e) => setOsKmAtual(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 85000"
                  className={CLASSE_CAMPO}
                />
              </Field>
              <Field rotulo="Mecânico Responsável">
                <select
                  id="os-rapida-mecanico"
                  name="mecanico_responsavel_id"
                  value={osMecanicoId}
                  onChange={(e) => setOsMecanicoId(e.target.value)}
                  className={`${CLASSE_CAMPO} cursor-pointer`}
                >
                  <option value="">Definir depois na bancada</option>
                  {mecanicos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.cargo})
                    </option>
                  ))}
                </select>
              </Field>
              <Field rotulo="Defeito Relatado / Serviço Solicitado">
                <textarea
                  id="os-rapida-defeito"
                  name="descricao_problema"
                  rows={3}
                  value={osDescricao}
                  onChange={(e) => setOsDescricao(e.target.value)}
                  placeholder="Ex: Revisão de freios, troca de óleo e barulho na suspensão dianteira..."
                  className={CLASSE_TEXTAREA}
                />
              </Field>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variante="secundario" onClick={() => sairDaFolha(osSuja, fecharOsRapida)}>
                  Cancelar
                </Button>
                <Button type="submit" carregando={criandoOsRapida}>
                  {criandoOsRapida ? 'Abrindo Bancada…' : 'Abrir Bancada da OS'}
                </Button>
              </div>
            </form>
          </>
        )}
      </Folha>
    </div>
  );
}
export default ClientesVeiculos;
