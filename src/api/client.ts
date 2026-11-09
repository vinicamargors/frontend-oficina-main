import { supabase, COLUNAS_USUARIO } from '../lib/supabase';
import {
  Cliente,
  ClienteCreateInput,
  ClienteUpdateInput,
  ConsultaPlacaResponse,
  DashboardOperacional,
  Empresa,
  EstoqueCreateInput,
  EstoqueItem,
  EstoqueListResponse,
  EstoqueUpdateInput,
  FinanceiroResponse,
  InteligenciaFinanceiraResponse,
  OSCreateInput,
  OSDossie,
  OSItem,
  OSItemCreateInput,
  OSItemUpdateInput,
  OSPaginatedResponse,
  OSUpdateInput,
  ParametrosFolha,
  RegistroPonto,
  StatusOS,
  TransacaoCreateInput,
  TransacaoFinanceira,
  TransacoesListResponse,
  TransacaoUpdateInput,
  UltimaOS,
  Usuario,
  UsuarioCreateInput,
  UsuarioUpdateInput,
  AvaliacaoOS,
  ConfiguracoesOficina,
  EscalaFolga,
  Veiculo,
  VeiculoCreateInput,
  VeiculoUpdateInput,
} from '../types';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'https://autotec-backend.onrender.com/api/v1'
).replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  // Se o token expirou ou houve colisão de validação no backend, renova sessão e tenta 1 vez
  if (response.status === 401 && !retried) {
    await new Promise((r) => setTimeout(r, 150));
    await supabase.auth.refreshSession().catch(() => {});
    return request<T>(path, init, true);
  }

  if (!response.ok) {
    let detail = `Erro ${response.status} ao comunicar com o servidor.`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        detail =
          typeof errBody.detail === 'string'
            ? errBody.detail
            : JSON.stringify(errBody.detail);
      }
    } catch {
      // ignora parse de resposta vazia
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

async function recalcularTotaisOSDireto(osId: string) {
  const { data: itens } = await supabase
    .from('os_itens')
    .select('*')
    .eq('os_id', osId);
  const lista = (itens || []) as OSItem[];
  const totalPecas = lista
    .filter((i) => i.tipo === 'PECA' || i.tipo === 'TERCEIRIZADO')
    .reduce((acc, i) => acc + Number(i.quantidade) * Number(i.venda_unitario), 0);
  const totalMaoObra = lista
    .filter((i) => i.tipo === 'MAO_OBRA')
    .reduce((acc, i) => acc + Number(i.quantidade) * Number(i.venda_unitario), 0);
  const custoTotal = lista
    .filter((i) => i.tipo !== 'MAO_OBRA')
    .reduce((acc, i) => acc + Number(i.quantidade) * Number(i.custo_unitario || 0), 0);
  const totalGeral = totalPecas + totalMaoObra;
  const lucroEstimado = totalGeral - custoTotal;

  await supabase
    .from('ordens_servico')
    .update({
      total_pecas: totalPecas,
      total_mao_obra: totalMaoObra,
      total_geral: totalGeral,
      lucro_estimado: lucroEstimado,
    })
    .eq('id', osId);
}

export type OrdenacaoOS = 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc';

export const api = {
  // Perfil & Empresas
  getMe: () => request<Usuario>('/usuarios/me'),
  onboarding: () => request<Usuario>('/usuarios/onboarding', { method: 'POST' }),
  getEmpresas: (empresaId?: string) =>
    request<Empresa[]>(empresaId ? `/empresas/?empresa_id=${empresaId}` : '/empresas/'),
  getUsuarios: (empresaId: string) => request<Usuario[]>(`/usuarios/${empresaId}`),

  // Dashboard Operacional — Últimos 30 dias & Veículos no Pátio (AGUARDANDO_PECA + EXECUCAO + FINALIZADO)
  getDashboardOperacional: async (empresaId: string): Promise<DashboardOperacional> => {
    const limite30Dias = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [osRes, ultimasRes, estoqueRes] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select('status, data_abertura')
        .eq('empresa_id', empresaId)
        .gte('data_abertura', limite30Dias),
      supabase
        .from('ordens_servico')
        .select(
          'id, status, data_abertura, total_geral, descricao_problema, clientes(nome, telefone), veiculos(placa, modelo)'
        )
        .eq('empresa_id', empresaId)
        .gte('data_abertura', limite30Dias)
        .order('data_abertura', { ascending: false })
        .limit(6),
      supabase
        .from('estoque')
        .select('id, nome, quantidade, minimo_alerta, categoria')
        .eq('empresa_id', empresaId)
        .neq('categoria', 'MAO_OBRA'),
    ]);

    if (osRes.error) {
      return request<DashboardOperacional>(`/dashboards/${empresaId}`);
    }

    const statusCounts: Record<StatusOS | string, number> = {
      ORCAMENTO: 0,
      AGUARDANDO_PECA: 0,
      EXECUCAO: 0,
      FINALIZADO: 0,
      PAGO: 0,
    };

    for (const row of osRes.data || []) {
      const st = (row.status as StatusOS) || 'ORCAMENTO';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    }

    // Regra de negócio: Veículos no Pátio = Aguardando Peça + Em Execução + Finalizado (últimos 30 dias)
    const veiculosNoPatio =
      (statusCounts.AGUARDANDO_PECA || 0) +
      (statusCounts.EXECUCAO || 0) +
      (statusCounts.FINALIZADO || 0);

    const itensCriticos = (estoqueRes.data || []).filter(
      (i) => Number(i.quantidade) <= Number(i.minimo_alerta ?? 5)
    );

    return {
      total_abertas: veiculosNoPatio,
      estoque_critico_count: itensCriticos.length,
      status_counts: statusCounts,
      ultimas_os: (ultimasRes.data || []) as unknown as UltimaOS[],
      itens_criticos: itensCriticos.slice(0, 6),
    };
  },

  // Ordens de Serviço com paginação, filtro de status, período de data, faixa de valor e ordenação
  listarOS: async (params: {
    empresaId: string;
    status?: string;
    search?: string;
    dataInicio?: string;
    dataFim?: string;
    valorMin?: number | null;
    valorMax?: number | null;
    ordenacao?: OrdenacaoOS;
    skip?: number;
    limit?: number;
  }): Promise<OSPaginatedResponse> => {
    const skip = params.skip ?? 0;
    const limit = params.limit ?? 50;
    const ordenacao = params.ordenacao || 'data_desc';
    const termo = params.search?.trim().toLowerCase() || '';

    let query = supabase
      .from('ordens_servico')
      .select(
        'id, status, data_abertura, total_geral, descricao_problema, clientes(nome, telefone), veiculos(placa, modelo)',
        { count: 'exact' }
      )
      .eq('empresa_id', params.empresaId);

    if (params.status) {
      query = query.eq('status', params.status.toUpperCase());
    }
    if (params.dataInicio) {
      query = query.gte('data_abertura', `${params.dataInicio}T00:00:00`);
    }
    if (params.dataFim) {
      query = query.lte('data_abertura', `${params.dataFim}T23:59:59`);
    }
    if (params.valorMin != null && !Number.isNaN(params.valorMin)) {
      query = query.gte('total_geral', params.valorMin);
    }
    if (params.valorMax != null && !Number.isNaN(params.valorMax)) {
      query = query.lte('total_geral', params.valorMax);
    }

    if (ordenacao === 'data_asc') {
      query = query.order('data_abertura', { ascending: true });
    } else if (ordenacao === 'valor_desc') {
      query = query.order('total_geral', { ascending: false });
    } else if (ordenacao === 'valor_asc') {
      query = query.order('total_geral', { ascending: true });
    } else {
      query = query.order('data_abertura', { ascending: false });
    }

    if (termo) {
      const { data: todas, error } = await query.limit(5000);
      if (!error && todas) {
        const termoAlfanum = termo.replace(/[^a-z0-9]/g, '');
        const filtradas = (todas as unknown as UltimaOS[]).filter((os) => {
          const cliNome = (os.clientes?.nome || '').toLowerCase();
          const veiPlaca = (os.veiculos?.placa || '').toLowerCase();
          const veiPlacaLimpa = veiPlaca.replace(/[^a-z0-9]/g, '');
          const veiModelo = (os.veiculos?.modelo || '').toLowerCase();
          const osId = (os.id || '').toLowerCase();
          const desc = (os.descricao_problema || '').toLowerCase();

          return (
            cliNome.includes(termo) ||
            veiPlaca.includes(termo) ||
            (termoAlfanum.length >= 2 && veiPlacaLimpa.includes(termoAlfanum)) ||
            veiModelo.includes(termo) ||
            osId.includes(termo) ||
            desc.includes(termo)
          );
        });

        return {
          items: filtradas.slice(skip, skip + limit),
          total: filtradas.length,
          skip,
          limit,
        };
      }
    } else {
      const { data, count, error } = await query.range(skip, skip + limit - 1);
      if (!error && data) {
        return {
          items: data as unknown as UltimaOS[],
          total: count || 0,
          skip,
          limit,
        };
      }
    }

    // Fallback para API REST
    const q = new URLSearchParams({
      empresa_id: params.empresaId,
      skip: String(skip),
      limit: String(limit),
      ordenacao,
    });
    if (params.status) q.set('status', params.status);
    if (termo) q.set('search', termo);
    if (params.dataInicio) q.set('data_inicio', params.dataInicio);
    if (params.dataFim) q.set('data_fim', params.dataFim);
    if (params.valorMin != null) q.set('valor_min', String(params.valorMin));
    if (params.valorMax != null) q.set('valor_max', String(params.valorMax));
    return request<OSPaginatedResponse>(`/os/?${q.toString()}`);
  },

  criarOS: async (
    dados: OSCreateInput
  ): Promise<{ id: string; reaproveitada?: boolean; data_abertura?: string }> => {
    const { data: abertas } = await supabase
      .from('ordens_servico')
      .select('id, data_abertura, status')
      .eq('empresa_id', dados.empresa_id)
      .eq('veiculo_id', dados.veiculo_id)
      .eq('status', 'ORCAMENTO')
      .order('data_abertura', { ascending: false });

    const limiteTresMesesMs = 90 * 24 * 60 * 60 * 1000;
    if (abertas && abertas.length > 0) {
      const maisRecente = abertas[0];
      const aberturaMs = maisRecente.data_abertura
        ? new Date(maisRecente.data_abertura).getTime()
        : 0;
      if (aberturaMs > 0 && Date.now() - aberturaMs < limiteTresMesesMs) {
        return {
          id: maisRecente.id,
          reaproveitada: true,
          data_abertura: maisRecente.data_abertura,
        };
      }
    }

    try {
      return await request<{ id: string; reaproveitada?: boolean }>('/os/', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('orçamento aberto')) {
        if (dados.km_atual) {
          await supabase
            .from('veiculos')
            .update({ km_atual: dados.km_atual })
            .eq('id', dados.veiculo_id)
            .eq('empresa_id', dados.empresa_id);
        }
        const { data: novaOs, error: insertErr } = await supabase
          .from('ordens_servico')
          .insert({
            cliente_id: dados.cliente_id,
            veiculo_id: dados.veiculo_id,
            mecanico_responsavel_id: dados.mecanico_responsavel_id || null,
            descricao_problema: dados.descricao_problema || '',
            km_atual: dados.km_atual ?? null,
            empresa_id: dados.empresa_id,
            status: 'ORCAMENTO',
          })
          .select('id')
          .single();

        if (insertErr || !novaOs) {
          throw new Error(insertErr?.message || 'Erro ao criar nova Ordem de Serviço.');
        }
        return { id: novaOs.id, reaproveitada: false };
      }
      throw err;
    }
  },

  atualizarOS: async (empresaId: string, osId: string, dados: OSUpdateInput) => {
    try {
      return await request<Record<string, unknown>>(`/os/${empresaId}/${osId}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
      });
    } catch {
      const { data, error } = await supabase
        .from('ordens_servico')
        .update(dados)
        .eq('id', osId)
        .eq('empresa_id', empresaId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Record<string, unknown>;
    }
  },

  deletarOS: (empresaId: string, osId: string, motivoExclusao: string) =>
    request<{ status: string; detail: string }>(
      `/os/${empresaId}/${osId}?motivo_exclusao=${encodeURIComponent(motivoExclusao)}`,
      { method: 'DELETE' }
    ),

  obterDossieOS: async (empresaId: string, osId: string): Promise<OSDossie> => {
    try {
      const dossie = await request<OSDossie>(`/os/${empresaId}/${osId}/imprimir`);
      if (!dossie.itens || dossie.itens.length === 0) {
        const { data: itensFallback } = await supabase
          .from('os_itens')
          .select('*')
          .eq('os_id', osId);
        if (itensFallback && itensFallback.length > 0) {
          dossie.itens = itensFallback as OSItem[];
        }
      }
      return dossie;
    } catch {
      const [osRes, itensRes, empRes] = await Promise.all([
        supabase
          .from('ordens_servico')
          .select(
            '*, clientes(nome, telefone, cpf_cnpj, endereco), veiculos(placa, modelo, marca, cor, ano, chassi, km_atual), usuarios(nome)'
          )
          .eq('id', osId)
          .eq('empresa_id', empresaId)
          .single(),
        supabase.from('os_itens').select('*').eq('os_id', osId),
        supabase
          .from('empresas')
          .select('nome_fantasia, razao_social, cnpj, telefone, email, endereco')
          .eq('id', empresaId)
          .single(),
      ]);
      if (osRes.error || !osRes.data) {
        throw new Error('Ordem de Serviço não encontrada.');
      }
      return {
        ordem: osRes.data as OSDossie['ordem'],
        itens: (itensRes.data || []) as OSItem[],
        empresa: (empRes.data || {}) as OSDossie['empresa'],
      };
    }
  },

  adicionarItemOS: (empresaId: string, osId: string, item: OSItemCreateInput) =>
    request<OSItem>(`/os/${empresaId}/${osId}/itens`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  adicionarItensOSLote: async (
    empresaId: string,
    osId: string,
    itens: OSItemCreateInput[]
  ): Promise<OSItem[]> => {
    try {
      return await request<OSItem[]>(`/os/${empresaId}/${osId}/itens/lote`, {
        method: 'POST',
        body: JSON.stringify(itens),
      });
    } catch {
      // Insere em lote garantindo baixa de estoque e recálculo único
      for (const item of itens) {
        if (item.estoque_id) {
          const { data: est } = await supabase
            .from('estoque')
            .select('id, nome, quantidade')
            .eq('id', item.estoque_id)
            .eq('empresa_id', empresaId)
            .single();
          if (est) {
            if (Number(est.quantidade) < Number(item.quantidade)) {
              throw new Error(
                `Estoque insuficiente para "${item.nome_item}". Saldo atual: ${est.quantidade}`
              );
            }
            await supabase
              .from('estoque')
              .update({ quantidade: Number(est.quantidade) - Number(item.quantidade) })
              .eq('id', item.estoque_id)
              .eq('empresa_id', empresaId);
          }
        }
      }

      const payload = itens.map((i) => ({
        ...i,
        os_id: osId,
        empresa_id: empresaId,
      }));
      const { data: inseridos, error } = await supabase
        .from('os_itens')
        .insert(payload)
        .select('*');
      if (error) throw new Error(error.message);

      await recalcularTotaisOSDireto(osId);
      return (inseridos || []) as OSItem[];
    }
  },

  atualizarItemOS: async (
    empresaId: string,
    osId: string,
    itemId: string,
    item: OSItemUpdateInput
  ): Promise<OSItem> => {
    try {
      return await request<OSItem>(`/os/${empresaId}/${osId}/itens/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      });
    } catch {
      const { data: atual } = await supabase
        .from('os_itens')
        .select('*')
        .eq('id', itemId)
        .eq('os_id', osId)
        .single();

      if (atual && item.quantidade != null && atual.estoque_id) {
        const diff = Number(item.quantidade) - Number(atual.quantidade);
        if (diff !== 0) {
          const { data: est } = await supabase
            .from('estoque')
            .select('quantidade')
            .eq('id', atual.estoque_id)
            .eq('empresa_id', empresaId)
            .single();
          if (est) {
            if (diff > 0 && Number(est.quantidade) < diff) {
              throw new Error(`Estoque insuficiente. Saldo atual: ${est.quantidade}`);
            }
            await supabase
              .from('estoque')
              .update({ quantidade: Number(est.quantidade) - diff })
              .eq('id', atual.estoque_id)
              .eq('empresa_id', empresaId);
          }
        }
      }

      const { data: atualizado, error } = await supabase
        .from('os_itens')
        .update(item)
        .eq('id', itemId)
        .eq('os_id', osId)
        .select('*')
        .single();
      if (error || !atualizado) {
        throw new Error(error?.message || 'Falha ao atualizar item da OS.');
      }
      await recalcularTotaisOSDireto(osId);
      return atualizado as OSItem;
    }
  },

  removerItemOS: async (
    empresaId: string,
    osId: string,
    itemId: string
  ): Promise<{ status: string; detail: string }> => {
    try {
      return await request<{ status: string; detail: string }>(
        `/os/${empresaId}/${osId}/itens/${itemId}`,
        { method: 'DELETE' }
      );
    } catch {
      const { data: item } = await supabase
        .from('os_itens')
        .select('*')
        .eq('id', itemId)
        .eq('os_id', osId)
        .single();
      if (item?.estoque_id) {
        const { data: est } = await supabase
          .from('estoque')
          .select('quantidade')
          .eq('id', item.estoque_id)
          .eq('empresa_id', empresaId)
          .single();
        if (est) {
          await supabase
            .from('estoque')
            .update({
              quantidade: Number(est.quantidade) + Number(item.quantidade),
            })
            .eq('id', item.estoque_id)
            .eq('empresa_id', empresaId);
        }
      }
      await supabase.from('os_itens').delete().eq('id', itemId).eq('os_id', osId);
      await recalcularTotaisOSDireto(osId);
      return { status: 'sucesso', detail: 'Item removido e estornado.' };
    }
  },

  // Clientes & Veículos & Estoque
  listarClientes: async (empresaId: string): Promise<Cliente[]> => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome');
    if (!error && data) {
      return data as Cliente[];
    }
    return request<Cliente[]>(`/clientes/${empresaId}`);
  },

  criarCliente: async (dados: ClienteCreateInput): Promise<Cliente> => {
    try {
      return await request<Cliente>('/clientes/', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    } catch {
      const { data, error } = await supabase
        .from('clientes')
        .insert(dados)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'Erro ao cadastrar cliente.');
      }
      return data as Cliente;
    }
  },

  atualizarCliente: async (
    empresaId: string,
    clienteId: string,
    dados: ClienteUpdateInput
  ): Promise<Cliente> => {
    try {
      return await request<Cliente>(`/clientes/${empresaId}/${clienteId}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
      });
    } catch {
      const { data, error } = await supabase
        .from('clientes')
        .update(dados)
        .eq('id', clienteId)
        .eq('empresa_id', empresaId)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'Erro ao atualizar dados do cliente.');
      }
      return data as Cliente;
    }
  },

  listarVeiculos: async (empresaId: string, placa?: string): Promise<Veiculo[]> => {
    let query = supabase
      .from('veiculos')
      .select('*, clientes(nome, telefone)')
      .eq('empresa_id', empresaId)
      .order('placa');
    if (placa) {
      query = query.eq('placa', placa.toUpperCase());
    }
    const { data, error } = await query;
    if (!error && data) {
      return data as unknown as Veiculo[];
    }
    const q = placa ? `?placa=${encodeURIComponent(placa)}` : '';
    return request<Veiculo[]>(`/veiculos/${empresaId}${q}`);
  },

  criarVeiculo: async (dados: VeiculoCreateInput): Promise<Veiculo> => {
    const payload = {
      ...dados,
      placa: dados.placa.toUpperCase().trim(),
    };
    try {
      return await request<Veiculo>('/veiculos/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      const { data, error } = await supabase
        .from('veiculos')
        .insert(payload)
        .select('*, clientes(nome, telefone)')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'Erro ao cadastrar veículo.');
      }
      return data as unknown as Veiculo;
    }
  },

  atualizarVeiculo: async (
    empresaId: string,
    veiculoId: string,
    dados: VeiculoUpdateInput
  ): Promise<Veiculo> => {
    const payload = {
      ...dados,
      ...(dados.placa ? { placa: dados.placa.toUpperCase().trim() } : {}),
    };
    try {
      return await request<Veiculo>(`/veiculos/${empresaId}/${veiculoId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      const { data, error } = await supabase
        .from('veiculos')
        .update(payload)
        .eq('id', veiculoId)
        .eq('empresa_id', empresaId)
        .select('*, clientes(nome, telefone)')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'Erro ao atualizar dados do veículo.');
      }
      return data as unknown as Veiculo;
    }
  },

  listarHistoricoOS: async (params: {
    empresaId: string;
    clienteId?: string;
    veiculoId?: string;
  }): Promise<UltimaOS[]> => {
    let query = supabase
      .from('ordens_servico')
      .select(
        'id, cliente_id, veiculo_id, km_atual, status, data_abertura, total_geral, descricao_problema, clientes(nome, telefone), veiculos(placa, modelo)'
      )
      .eq('empresa_id', params.empresaId)
      .order('data_abertura', { ascending: false });

    if (params.clienteId) {
      query = query.eq('cliente_id', params.clienteId);
    }
    if (params.veiculoId) {
      query = query.eq('veiculo_id', params.veiculoId);
    }

    const { data, error } = await query.limit(500);
    if (!error && data) {
      return data as unknown as UltimaOS[];
    }
    return [];
  },

  consultarPlaca: (placa: string) =>
    request<ConsultaPlacaResponse>(
      `/veiculos/consulta-placa/${encodeURIComponent(
        placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      )}`
    ),

  listarEstoque: async (
    empresaId: string,
    categoria?: string
  ): Promise<EstoqueListResponse> => {
    try {
      const q = categoria ? `?categoria=${encodeURIComponent(categoria)}` : '';
      return await request<EstoqueListResponse>(`/estoque/${empresaId}${q}`);
    } catch {
      let query = supabase
        .from('estoque')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome');
      if (categoria) query = query.eq('categoria', categoria.toUpperCase());
      const { data } = await query;
      const itens = (data || []) as EstoqueItem[];

      let estoqueBaixo = 0;
      let valorTotalCusto = 0;
      let valorTotalVenda = 0;
      for (const i of itens) {
        const qtd = Number(i.quantidade || 0);
        if (qtd <= Number(i.minimo_alerta ?? 5)) estoqueBaixo++;
        valorTotalCusto += qtd * Number(i.custo || 0);
        valorTotalVenda += qtd * Number(i.venda || 0);
      }

      return {
        itens,
        stats: {
          total_itens: itens.length,
          estoque_baixo: estoqueBaixo,
          valor_total_custo: Math.round(valorTotalCusto * 100) / 100,
          valor_total_venda: Math.round(valorTotalVenda * 100) / 100,
        },
      };
    }
  },

  criarItemEstoque: async (dados: EstoqueCreateInput): Promise<EstoqueItem> => {
    const payload = {
      ...dados,
      nome: dados.nome.trim(),
      categoria: dados.categoria.toUpperCase().trim(),
      ...(dados.codigo ? { codigo: dados.codigo.toUpperCase().trim() } : {}),
    };
    try {
      return await request<EstoqueItem>('/estoque/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      const { data, error } = await supabase
        .from('estoque')
        .insert(payload)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'Erro ao cadastrar item no estoque.');
      }
      return data as EstoqueItem;
    }
  },

  atualizarItemEstoque: async (
    empresaId: string,
    itemId: string,
    dados: EstoqueUpdateInput
  ): Promise<EstoqueItem> => {
    const payload = {
      ...dados,
      ...(dados.nome ? { nome: dados.nome.trim() } : {}),
      ...(dados.categoria ? { categoria: dados.categoria.toUpperCase().trim() } : {}),
      ...(dados.codigo !== undefined
        ? { codigo: dados.codigo ? dados.codigo.toUpperCase().trim() : null }
        : {}),
    };
    try {
      return await request<EstoqueItem>(`/estoque/${empresaId}/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      const { data, error } = await supabase
        .from('estoque')
        .update(payload)
        .eq('id', itemId)
        .eq('empresa_id', empresaId)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'Erro ao atualizar item do estoque.');
      }
      return data as EstoqueItem;
    }
  },

  ajustarEstoque: async (
    empresaId: string,
    itemId: string,
    tipo: 'entrada' | 'saida',
    quantidade: number
  ): Promise<EstoqueItem> => {
    try {
      return await request<EstoqueItem>(`/estoque/${empresaId}/${itemId}/ajustar`, {
        method: 'PATCH',
        body: JSON.stringify({ tipo, quantidade }),
      });
    } catch {
      const { data: item } = await supabase
        .from('estoque')
        .select('quantidade')
        .eq('id', itemId)
        .eq('empresa_id', empresaId)
        .single();
      const qtdAtual = Number(item?.quantidade || 0);
      const novaQtd =
        tipo === 'entrada' ? qtdAtual + quantidade : Math.max(0, qtdAtual - quantidade);
      const { data, error } = await supabase
        .from('estoque')
        .update({ quantidade: novaQtd })
        .eq('id', itemId)
        .eq('empresa_id', empresaId)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'Erro ao ajustar saldo do estoque.');
      }
      return data as EstoqueItem;
    }
  },

  deletarItemEstoque: async (
    empresaId: string,
    itemId: string
  ): Promise<{ status: string; detail: string }> => {
    try {
      return await request<{ status: string; detail: string }>(
        `/estoque/${empresaId}/${itemId}`,
        { method: 'DELETE' }
      );
    } catch {
      const { error } = await supabase
        .from('estoque')
        .delete()
        .eq('id', itemId)
        .eq('empresa_id', empresaId);
      if (error) {
        throw new Error(error.message || 'Erro ao remover item do estoque.');
      }
      return { status: 'sucesso', detail: 'Item removido do estoque.' };
    }
  },

  // Transações Financeiras (Contas a Pagar e Receitas Avulsas)
  listarTransacoesFinanceiras: async (
    empresaId: string,
    params?: {
      tipo?: 'DESPESA' | 'RECEITA';
      status?: string;
      dataInicial?: string;
      dataFinal?: string;
    }
  ): Promise<TransacoesListResponse> => {
    try {
      const q = new URLSearchParams();
      if (params?.tipo) q.set('tipo', params.tipo);
      if (params?.status) q.set('status', params.status);
      if (params?.dataInicial) q.set('data_inicial', params.dataInicial);
      if (params?.dataFinal) q.set('data_final', params.dataFinal);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return await request<TransacoesListResponse>(
        `/transacoes-financeiras/${empresaId}${queryStr}`
      );
    } catch {
      // Fallback Supabase ou LocalStorage
      let transacoes: TransacaoFinanceira[] = [];
      try {
        let query = supabase
          .from('transacoes_financeiras')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('data_vencimento', { ascending: false });

        if (params?.tipo) query = query.eq('tipo', params.tipo);
        if (params?.status) query = query.eq('status', params.status);
        if (params?.dataInicial) query = query.gte('data_vencimento', params.dataInicial);
        if (params?.dataFinal) query = query.lte('data_vencimento', params.dataFinal);

        const { data, error } = await query;
        if (!error && data) {
          transacoes = data as TransacaoFinanceira[];
        } else {
          throw new Error('Tabela não existe ainda');
        }
      } catch {
        // Fallback LocalStorage isolado por empresa
        try {
          const raw = localStorage.getItem(`autotec_transacoes_${empresaId}`);
          transacoes = raw ? JSON.parse(raw) : [];
          if (params?.tipo) {
            transacoes = transacoes.filter((t) => t.tipo === params.tipo);
          }
          if (params?.status) {
            transacoes = transacoes.filter((t) => t.status === params.status);
          }
          if (params?.dataInicial) {
            transacoes = transacoes.filter((t) => t.data_vencimento >= params.dataInicial!);
          }
          if (params?.dataFinal) {
            transacoes = transacoes.filter((t) => t.data_vencimento <= params.dataFinal!);
          }
        } catch {
          transacoes = [];
        }
      }

      const hoje = new Date().toISOString().slice(0, 10);
      let total_despesas_pagas = 0;
      let total_despesas_pendentes = 0;
      let total_receitas_recebidas = 0;
      let total_receitas_pendentes = 0;

      for (const t of transacoes) {
        if (t.status === 'PENDENTE' && t.data_vencimento < hoje) {
          t.status = 'ATRASADO';
        }
        const val = Number(t.valor || 0);
        if (t.tipo === 'DESPESA') {
          if (t.status === 'LIQUIDADO') total_despesas_pagas += val;
          else if (t.status === 'PENDENTE' || t.status === 'ATRASADO') total_despesas_pendentes += val;
        } else if (t.tipo === 'RECEITA') {
          if (t.status === 'LIQUIDADO') total_receitas_recebidas += val;
          else if (t.status === 'PENDENTE' || t.status === 'ATRASADO') total_receitas_pendentes += val;
        }
      }

      return {
        transacoes,
        resumo: {
          total_despesas_pagas: Math.round(total_despesas_pagas * 100) / 100,
          total_despesas_pendentes: Math.round(total_despesas_pendentes * 100) / 100,
          total_receitas_recebidas: Math.round(total_receitas_recebidas * 100) / 100,
          total_receitas_pendentes: Math.round(total_receitas_pendentes * 100) / 100,
          saldo_liquido_periodo:
            Math.round((total_receitas_recebidas - total_despesas_pagas) * 100) / 100,
        },
      };
    }
  },

  criarTransacaoFinanceira: async (
    dados: TransacaoCreateInput
  ): Promise<TransacaoFinanceira> => {
    try {
      return await request<TransacaoFinanceira>('/transacoes-financeiras/', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    } catch {
      try {
        const { data, error } = await supabase
          .from('transacoes_financeiras')
          .insert(dados)
          .select('*')
          .single();
        if (!error && data) return data as TransacaoFinanceira;
      } catch {}

      // Fallback LocalStorage
      const id = `trans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nova: TransacaoFinanceira = {
        id,
        created_at: new Date().toISOString(),
        ...dados,
        status: dados.status || 'PENDENTE',
      };
      const chave = `autotec_transacoes_${dados.empresa_id}`;
      const lista: TransacaoFinanceira[] = JSON.parse(
        localStorage.getItem(chave) || '[]'
      );
      lista.unshift(nova);
      localStorage.setItem(chave, JSON.stringify(lista));
      return nova;
    }
  },

  atualizarTransacaoFinanceira: async (
    empresaId: string,
    id: string,
    dados: TransacaoUpdateInput
  ): Promise<TransacaoFinanceira> => {
    try {
      return await request<TransacaoFinanceira>(
        `/transacoes-financeiras/${empresaId}/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(dados),
        }
      );
    } catch {
      try {
        const { data, error } = await supabase
          .from('transacoes_financeiras')
          .update(dados)
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .select('*')
          .single();
        if (!error && data) return data as TransacaoFinanceira;
      } catch {}

      // Fallback LocalStorage
      const chave = `autotec_transacoes_${empresaId}`;
      const lista: TransacaoFinanceira[] = JSON.parse(
        localStorage.getItem(chave) || '[]'
      );
      const idx = lista.findIndex((t) => t.id === id);
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...dados };
        localStorage.setItem(chave, JSON.stringify(lista));
        return lista[idx];
      }
      throw new Error('Transação não encontrada.');
    }
  },

  liquidarTransacaoFinanceira: async (
    empresaId: string,
    id: string,
    formaPagamento?: string
  ): Promise<TransacaoFinanceira> => {
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      return await request<TransacaoFinanceira>(
        `/transacoes-financeiras/${empresaId}/${id}/liquidar`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            data_liquidacao: hoje,
            forma_pagamento: formaPagamento,
          }),
        }
      );
    } catch {
      try {
        const { data, error } = await supabase
          .from('transacoes_financeiras')
          .update({
            status: 'LIQUIDADO',
            data_liquidacao: hoje,
            forma_pagamento: formaPagamento || null,
          })
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .select('*')
          .single();
        if (!error && data) return data as TransacaoFinanceira;
      } catch {}

      const chave = `autotec_transacoes_${empresaId}`;
      const lista: TransacaoFinanceira[] = JSON.parse(
        localStorage.getItem(chave) || '[]'
      );
      const idx = lista.findIndex((t) => t.id === id);
      if (idx >= 0) {
        lista[idx] = {
          ...lista[idx],
          status: 'LIQUIDADO',
          data_liquidacao: hoje,
          forma_pagamento: formaPagamento || lista[idx].forma_pagamento,
        };
        localStorage.setItem(chave, JSON.stringify(lista));
        return lista[idx];
      }
      throw new Error('Transação não encontrada.');
    }
  },

  deletarTransacaoFinanceira: async (
    empresaId: string,
    id: string
  ): Promise<{ status: string; detail: string }> => {
    try {
      return await request<{ status: string; detail: string }>(
        `/transacoes-financeiras/${empresaId}/${id}`,
        { method: 'DELETE' }
      );
    } catch {
      try {
        await supabase
          .from('transacoes_financeiras')
          .delete()
          .eq('id', id)
          .eq('empresa_id', empresaId);
      } catch {}

      const chave = `autotec_transacoes_${empresaId}`;
      const lista: TransacaoFinanceira[] = JSON.parse(
        localStorage.getItem(chave) || '[]'
      );
      const filtrada = lista.filter((t) => t.id !== id);
      localStorage.setItem(chave, JSON.stringify(filtrada));
      return { status: 'sucesso', detail: 'Transação removida.' };
    }
  },

  // Módulo de Inteligência & DRE
  obterDadosFinanceiros: async (
    empresaId: string,
    dataInicial?: string,
    dataFinal?: string
  ): Promise<FinanceiroResponse> => {
    try {
      const q = new URLSearchParams();
      if (dataInicial) q.set('data_inicial', dataInicial);
      if (dataFinal) q.set('data_final', dataFinal);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return await request<FinanceiroResponse>(`/financeiro/${empresaId}${qs}`);
    } catch {
      let query = supabase
        .from('ordens_servico')
        .select('status, total_geral, lucro_estimado, data_abertura, data_fechamento')
        .eq('empresa_id', empresaId);

      if (dataInicial) query = query.gte('data_abertura', dataInicial);
      if (dataFinal) query = query.lte('data_abertura', `${dataFinal}T23:59:59`);

      const { data } = await query;
      const osList = data || [];

      let faturamento_pago = 0;
      let faturamento_projetado = 0;
      let lucro_realizado = 0;
      let totalPagas = 0;

      for (const os of osList) {
        const total = Number(os.total_geral || 0);
        const lucro = Number(os.lucro_estimado || 0);
        if (os.status === 'PAGO') {
          faturamento_pago += total;
          lucro_realizado += lucro;
          totalPagas++;
        } else if (
          os.status === 'EXECUCAO' ||
          os.status === 'FINALIZADO' ||
          os.status === 'AGUARDANDO_PECA'
        ) {
          faturamento_projetado += total;
        }
      }

      const ticket_medio = totalPagas > 0 ? faturamento_pago / totalPagas : 0;

      return {
        faturamento_pago: Math.round(faturamento_pago * 100) / 100,
        faturamento_projetado: Math.round(faturamento_projetado * 100) / 100,
        lucro_realizado: Math.round(lucro_realizado * 100) / 100,
        ticket_medio: Math.round(ticket_medio * 100) / 100,
        historico_6_meses: [],
      };
    }
  },

  obterInteligenciaFinanceira: async (
    empresaId: string,
    dataInicial?: string,
    dataFinal?: string
  ): Promise<InteligenciaFinanceiraResponse> => {
    try {
      const q = new URLSearchParams();
      if (dataInicial) q.set('data_inicial', dataInicial);
      if (dataFinal) q.set('data_final', dataFinal);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return await request<InteligenciaFinanceiraResponse>(
        `/financeiro/inteligencia/${empresaId}${qs}`
      );
    } catch {
      // Fallback Supabase
      let query = supabase
        .from('ordens_servico')
        .select(
          'id, status, total_geral, total_pecas, total_mao_obra, lucro_estimado, data_abertura, data_fechamento, forma_pagamento, clientes(id, nome), veiculos(id, placa, marca, modelo), usuarios(id, nome)'
        )
        .eq('empresa_id', empresaId);

      if (dataInicial) query = query.gte('data_abertura', dataInicial);
      if (dataFinal) query = query.lte('data_abertura', `${dataFinal}T23:59:59`);

      const { data } = await query;
      const osList = (data || []) as any[];

      const cliMap: Record<string, { nome: string; lucro: number; faturamento: number; qtd_os: number }> = {};
      const mecMap: Record<string, { nome: string; lucro_gerado: number; faturamento_gerado: number; qtd_os: number }> = {};
      const pagMap: Record<string, { forma: string; qtd: number; valor_total: number }> = {};
      const marcaMap: Record<string, { marca: string; lucro: number; faturamento: number; qtd_os: number }> = {};

      let totalPecas = 0;
      let totalMaoObra = 0;
      let totalOrcamentos = 0;
      let totalAprovados = 0;

      for (const os of osList) {
        totalOrcamentos++;
        const total = Number(os.total_geral || 0);
        const lucro = Number(os.lucro_estimado || 0);
        const pecas = Number(os.total_pecas || 0);
        const servicos = Number(os.total_mao_obra || 0);

        if (os.status === 'EXECUCAO' || os.status === 'FINALIZADO' || os.status === 'PAGO') {
          totalAprovados++;
        }

        if (os.status === 'PAGO' || os.status === 'FINALIZADO') {
          totalPecas += pecas;
          totalMaoObra += servicos;

          const cli = os.clientes;
          if (cli?.id) {
            if (!cliMap[cli.id]) cliMap[cli.id] = { nome: cli.nome || 'Cliente', lucro: 0, faturamento: 0, qtd_os: 0 };
            cliMap[cli.id].lucro += lucro;
            cliMap[cli.id].faturamento += total;
            cliMap[cli.id].qtd_os++;
          }

          const usr = os.usuarios;
          if (usr?.id) {
            if (!mecMap[usr.id]) mecMap[usr.id] = { nome: usr.nome || 'Mecânico', lucro_gerado: 0, faturamento_gerado: 0, qtd_os: 0 };
            mecMap[usr.id].lucro_gerado += lucro;
            mecMap[usr.id].faturamento_gerado += total;
            mecMap[usr.id].qtd_os++;
          }

          const forma = os.forma_pagamento || 'PIX';
          if (!pagMap[forma]) pagMap[forma] = { forma, qtd: 0, valor_total: 0 };
          pagMap[forma].qtd++;
          pagMap[forma].valor_total += total;

          const marca = os.veiculos?.marca || 'Outras';
          if (!marcaMap[marca]) marcaMap[marca] = { marca, lucro: 0, faturamento: 0, qtd_os: 0 };
          marcaMap[marca].lucro += lucro;
          marcaMap[marca].faturamento += total;
          marcaMap[marca].qtd_os++;
        }
      }

      const top_10_clientes = Object.values(cliMap).sort((a, b) => b.lucro - a.lucro).slice(0, 10);
      const piores_10_clientes = Object.values(cliMap).sort((a, b) => a.lucro - b.lucro).slice(0, 10);
      const produtividade_mecanicos = Object.values(mecMap).sort((a, b) => b.lucro_gerado - a.lucro_gerado);
      const metodos_pagamento = Object.values(pagMap).sort((a, b) => b.valor_total - a.valor_total);
      const rentabilidade_marcas = Object.values(marcaMap).sort((a, b) => b.lucro - a.lucro);

      return {
        top_10_clientes,
        piores_10_clientes,
        produtividade_mecanicos,
        metodos_pagamento,
        rentabilidade_marcas,
        origem_faturamento: {
          pecas: Math.round(totalPecas * 100) / 100,
          mao_de_obra: Math.round(totalMaoObra * 100) / 100,
        },
        lead_time_medio_horas: 18.5,
        taxa_conversao_orcamentos:
          totalOrcamentos > 0 ? Math.round((totalAprovados / totalOrcamentos) * 100) : 0,
      };
    }
  },

  // Equipe, RH e Usuários
  listarUsuarios: async (empresaId: string): Promise<Usuario[]> => {
    let baseList: Usuario[] = [];

    // 1. Tenta carregar direto do Supabase para garantir todas as colunas de RH (salário, comissões, etc.)
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(COLUNAS_USUARIO)
        .eq('empresa_id', empresaId)
        .order('nome');
      if (!error && data && data.length > 0) {
        baseList = data as Usuario[];
      }
    } catch {}

    // 2. Se Supabase não retornou, tenta a rota FastAPI
    if (baseList.length === 0) {
      try {
        const res = await request<Usuario[]>(`/usuarios/${empresaId}`);
        if (res && res.length > 0) baseList = res;
      } catch {}
    }

    // 3. Mescla com cache local de RH
    const rawRH = localStorage.getItem(`autotec_rh_dados_${empresaId}`);
    const rhDados: Record<string, Partial<Usuario>> = rawRH ? JSON.parse(rawRH) : {};

    return baseList.map((u) => {
      const rh = rhDados[u.id] || {};
      const salRaw = u.salario_base !== undefined && u.salario_base !== null
        ? Number(u.salario_base)
        : (rh.salario_base !== undefined && rh.salario_base !== null ? Number(rh.salario_base) : null);
      const salVal = salRaw !== null && !isNaN(salRaw) && salRaw > 0 ? salRaw : null;

      return {
        ...u,
        salario_base: salVal,
        comissao_servico_pct: u.comissao_servico_pct !== undefined && u.comissao_servico_pct !== null ? Number(u.comissao_servico_pct) : (rh.comissao_servico_pct ?? 0),
        comissao_peca_pct: u.comissao_peca_pct !== undefined && u.comissao_peca_pct !== null ? Number(u.comissao_peca_pct) : (rh.comissao_peca_pct ?? 0),
        vale_transporte: u.vale_transporte !== undefined && u.vale_transporte !== null ? Number(u.vale_transporte) : (rh.vale_transporte ?? 0),
        vale_refeicao: u.vale_refeicao !== undefined && u.vale_refeicao !== null ? Number(u.vale_refeicao) : (rh.vale_refeicao ?? 0),
        paga_hora_extra: u.paga_hora_extra !== undefined && u.paga_hora_extra !== null ? Boolean(u.paga_hora_extra) : (rh.paga_hora_extra ?? false),
        valor_hora_extra: u.valor_hora_extra !== undefined && u.valor_hora_extra !== null ? Number(u.valor_hora_extra) : (rh.valor_hora_extra ?? 0),
        estrelas_media: u.estrelas_media !== undefined && u.estrelas_media !== null ? Number(u.estrelas_media) : (rh.estrelas_media ?? 5.0),
        total_avaliacoes: u.total_avaliacoes !== undefined && u.total_avaliacoes !== null ? Number(u.total_avaliacoes) : (rh.total_avaliacoes ?? 0),
      };
    });
  },

  criarUsuario: async (dados: UsuarioCreateInput): Promise<Usuario> => {
    try {
      const res = await request<Usuario>(`/usuarios/${dados.empresa_id}`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      // Salva dados de RH no banco se as colunas existirem
      try {
        await supabase
          .from('usuarios')
          .update({
            salario_base: dados.salario_base || 0,
            comissao_servico_pct: dados.comissao_servico_pct || 0,
            comissao_peca_pct: dados.comissao_peca_pct || 0,
            vale_transporte: dados.vale_transporte || 0,
            vale_refeicao: dados.vale_refeicao || 0,
            paga_hora_extra: dados.paga_hora_extra || false,
            valor_hora_extra: dados.valor_hora_extra || 0,
          })
          .eq('id', res.id);
      } catch {}

      // Salva dados de RH no cache local
      const chave = `autotec_rh_dados_${dados.empresa_id}`;
      const rhDados: Record<string, any> = JSON.parse(
        localStorage.getItem(chave) || '{}'
      );
      rhDados[res.id] = {
        salario_base: dados.salario_base,
        comissao_servico_pct: dados.comissao_servico_pct,
        comissao_peca_pct: dados.comissao_peca_pct,
        vale_transporte: dados.vale_transporte,
        vale_refeicao: dados.vale_refeicao,
        paga_hora_extra: dados.paga_hora_extra,
        valor_hora_extra: dados.valor_hora_extra,
      };
      localStorage.setItem(chave, JSON.stringify(rhDados));
      return { ...res, ...rhDados[res.id] };
    } catch (e) {
      const err = e as Error;
      throw new Error(err.message || 'Falha ao cadastrar colaborador no servidor.');
    }
  },

  atualizarUsuario: async (
    empresaId: string,
    usuarioId: string,
    dados: UsuarioUpdateInput
  ): Promise<Usuario> => {
    // 1. Chama a API do FastAPI (onde 'exigir_cargos("DONO", "master")' valida o perfil de segurança)
    const respApi = await request<Usuario>(`/usuarios/${empresaId}/${usuarioId}`, {
      method: 'PUT',
      body: JSON.stringify(dados),
    });

    // 2. Atualiza dados de RH em cache local por segurança
    const chave = `autotec_rh_dados_${empresaId}`;
    const rhDados: Record<string, any> = JSON.parse(
      localStorage.getItem(chave) || '{}'
    );
    rhDados[usuarioId] = {
      ...(rhDados[usuarioId] || {}),
      ...dados,
    };
    localStorage.setItem(chave, JSON.stringify(rhDados));

    return {
      ...respApi,
      id: usuarioId,
      empresa_id: empresaId,
      ...rhDados[usuarioId],
    } as Usuario;
  },

  desativarUsuario: async (empresaId: string, usuarioId: string): Promise<void> => {
    await request<{ status: string; detail: string }>(`/usuarios/${empresaId}/${usuarioId}`, {
      method: 'DELETE',
    });
  },

  reativarUsuario: async (empresaId: string, usuarioId: string): Promise<void> => {
    await request<{ status: string; detail: string }>(`/usuarios/${empresaId}/${usuarioId}/reativar`, {
      method: 'PATCH',
    });
  },

  // Parâmetros da Folha de Pagamento
  obterParametrosFolha: (empresaId: string): ParametrosFolha => {
    try {
      const raw = localStorage.getItem(`autotec_parametros_folha_${empresaId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      dia_pagamento: 5,
      dia_adiantamento: 20,
      comissao_global_servico_pct: 15,
      comissao_global_peca_pct: 5,
      paga_hora_extra_padrao: true,
      valor_hora_extra_padrao: 25,
    };
  },

  salvarParametrosFolha: (empresaId: string, params: ParametrosFolha): void => {
    localStorage.setItem(
      `autotec_parametros_folha_${empresaId}`,
      JSON.stringify(params)
    );
  },

  // Montador de Escalas e Calendário de Férias
  listarEscalasFolgas: async (empresaId: string): Promise<EscalaFolga[]> => {
    try {
      return await request<EscalaFolga[]>(`/equipe/escalas/${empresaId}`);
    } catch {
      try {
        const { data, error } = await supabase
          .from('escalas_folgas')
          .select('*, usuarios(nome)')
          .eq('empresa_id', empresaId)
          .order('data_inicio', { ascending: false });
        if (!error && data) {
          return data.map((d: any) => ({
            ...d,
            usuario_nome: d.usuarios?.nome,
          })) as EscalaFolga[];
        }
      } catch {}

      try {
        const raw = localStorage.getItem(`autotec_escalas_${empresaId}`);
        if (raw) return JSON.parse(raw);
      } catch {}
      return [];
    }
  },

  salvarEscalaFolga: async (dados: Omit<EscalaFolga, 'id'>): Promise<EscalaFolga> => {
    try {
      return await request<EscalaFolga>(`/equipe/escalas/${dados.empresa_id}`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    } catch {
      try {
        const { data, error } = await supabase
          .from('escalas_folgas')
          .insert(dados)
          .select('*, usuarios(nome)')
          .single();
        if (!error && data) {
          return {
            ...data,
            usuario_nome: data.usuarios?.nome || dados.usuario_nome,
          } as EscalaFolga;
        }
      } catch {}

      const id = `esc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const nova: EscalaFolga = { id, ...dados };
      const chave = `autotec_escalas_${dados.empresa_id}`;
      const lista: EscalaFolga[] = JSON.parse(localStorage.getItem(chave) || '[]');
      lista.unshift(nova);
      localStorage.setItem(chave, JSON.stringify(lista));
      return nova;
    }
  },

  deletarEscalaFolga: async (empresaId: string, id: string): Promise<void> => {
    try {
      await request(`/equipe/escalas/${empresaId}/${id}`, { method: 'DELETE' });
    } catch {
      try {
        await supabase.from('escalas_folgas').delete().eq('id', id).eq('empresa_id', empresaId);
      } catch {}
      const chave = `autotec_escalas_${empresaId}`;
      const lista: EscalaFolga[] = JSON.parse(localStorage.getItem(chave) || '[]');
      const filtrada = lista.filter((e) => e.id !== id);
      localStorage.setItem(chave, JSON.stringify(filtrada));
    }
  },

  // Registro de Ponto Eletrônico
  registrarPonto: async (dados: Omit<RegistroPonto, 'id'>): Promise<RegistroPonto> => {
    try {
      return await request<RegistroPonto>(`/equipe/pontos/${dados.empresa_id}`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    } catch {
      try {
        const { data, error } = await supabase
          .from('pontos_eletronicos')
          .insert(dados)
          .select('*, usuarios(nome)')
          .single();
        if (!error && data) {
          return {
            ...data,
            usuario_nome: data.usuarios?.nome || dados.usuario_nome,
          } as RegistroPonto;
        }
      } catch {}

      const id = `ponto-${Date.now()}`;
      const novo: RegistroPonto = { id, ...dados };
      const chave = `autotec_pontos_${dados.empresa_id}`;
      const lista: RegistroPonto[] = JSON.parse(localStorage.getItem(chave) || '[]');
      lista.unshift(novo);
      localStorage.setItem(chave, JSON.stringify(lista));
      return novo;
    }
  },

  listarPontos: async (empresaId: string, dataFiltro?: string): Promise<RegistroPonto[]> => {
    try {
      const q = dataFiltro ? `?data=${encodeURIComponent(dataFiltro)}` : '';
      return await request<RegistroPonto[]>(`/equipe/pontos/${empresaId}${q}`);
    } catch {
      try {
        let query = supabase
          .from('pontos_eletronicos')
          .select('*, usuarios(nome)')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false });
        if (dataFiltro) query = query.eq('data', dataFiltro);
        const { data, error } = await query;
        if (!error && data) {
          return data.map((d: any) => ({
            ...d,
            usuario_nome: d.usuarios?.nome,
          })) as RegistroPonto[];
        }
      } catch {}

      try {
        const chave = `autotec_pontos_${empresaId}`;
        const lista: RegistroPonto[] = JSON.parse(localStorage.getItem(chave) || '[]');
        if (dataFiltro) {
          return lista.filter((p) => p.data === dataFiltro);
        }
        return lista;
      } catch {}
      return [];
    }
  },

  // Avaliações de Clientes (NPS & 5 Estrelas)
  salvarAvaliacaoOS: async (dados: Omit<AvaliacaoOS, 'id'>): Promise<AvaliacaoOS> => {
    try {
      return await request<AvaliacaoOS>('/equipe/avaliar', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    } catch {
      try {
        const { data, error } = await supabase
          .from('avaliacoes_os')
          .insert(dados)
          .select('*')
          .single();
        if (!error && data) return data as AvaliacaoOS;
      } catch {}

      const id = `av-${Date.now()}`;
      const nova: AvaliacaoOS = { id, ...dados };
      const chave = `autotec_avaliacoes_${dados.empresa_id}`;
      const lista: AvaliacaoOS[] = JSON.parse(localStorage.getItem(chave) || '[]');
      lista.unshift(nova);
      localStorage.setItem(chave, JSON.stringify(lista));

      if (dados.mecanico_id) {
        const avsMec = lista.filter((a) => a.mecanico_id === dados.mecanico_id);
        const soma = avsMec.reduce((acc, a) => acc + a.nota, 0);
        const media = avsMec.length > 0 ? soma / avsMec.length : 5;

        const rhChave = `autotec_rh_dados_${dados.empresa_id}`;
        const rhDados: Record<string, any> = JSON.parse(
          localStorage.getItem(rhChave) || '{}'
        );
        if (rhDados[dados.mecanico_id]) {
          rhDados[dados.mecanico_id].estrelas_media = Math.round(media * 10) / 10;
          rhDados[dados.mecanico_id].total_avaliacoes = avsMec.length;
          localStorage.setItem(rhChave, JSON.stringify(rhDados));
        }
      }

      return nova;
    }
  },

  listarAvaliacoesOS: async (empresaId: string): Promise<AvaliacaoOS[]> => {
    try {
      return await request<AvaliacaoOS[]>(`/equipe/avaliacoes/${empresaId}`);
    } catch {
      try {
        const { data, error } = await supabase
          .from('avaliacoes_os')
          .select('*, usuarios(nome)')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          return data.map((d: any) => ({
            ...d,
            mecanico_nome: d.usuarios?.nome,
          })) as AvaliacaoOS[];
        }
      } catch {}

      try {
        const raw = localStorage.getItem(`autotec_avaliacoes_${empresaId}`);
        if (raw) return JSON.parse(raw);
      } catch {}
      return [];
    }
  },

  // Lançar Folha no Contas a Pagar
  lancarFolhaContasAPagar: async (
    empresaId: string,
    dados: {
      mes_referencia: string;
      data_vencimento?: string;
      incluir_vales?: boolean;
      descricao_custom?: string;
    }
  ) => {
    return request<{
      sucesso: boolean;
      total_funcionarios: number;
      valor_total_folha: number;
      transacao_id: string;
      mensagem: string;
    }>(`/equipe/folha/${empresaId}/lancar-contas-a-pagar`, {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  },

  // Configurações da Oficina
  obterConfiguracoesOficina: async (
    empresaId: string
  ): Promise<ConfiguracoesOficina> => {
    try {
      const [empRes, cfgRes] = await Promise.all([
        supabase.from('empresas').select('*').eq('id', empresaId).single(),
        supabase.from('configuracoes_empresa').select('*').eq('empresa_id', empresaId).single(),
      ]);

      const emp = empRes.data || {};
      const cfg = cfgRes.data || {};

      const rawLocal = localStorage.getItem(`autotec_oficina_custom_${empresaId}`);
      const customLocal = rawLocal ? JSON.parse(rawLocal) : {};

      return {
        empresa_id: empresaId,
        nome_fantasia: emp.nome_fantasia || 'Autotec Pro Oficina',
        razao_social: emp.razao_social || '',
        cnpj: emp.cnpj || '',
        inscricao_estadual: customLocal.inscricao_estadual || '',
        telefone: emp.telefone || '',
        whatsapp: customLocal.whatsapp || emp.telefone || '',
        email: emp.email || '',
        endereco: emp.endereco || '',
        chave_pix: customLocal.chave_pix || '',
        cor_primaria: cfg.cor_primaria || '#1e3a8a',
        cor_secundaria: cfg.cor_secundaria || '#f97316',
        logo_b64: cfg.logo_b64 || null,
        latitude_gps: customLocal.latitude_gps || null,
        longitude_gps: customLocal.longitude_gps || null,
        raio_gps_metros: customLocal.raio_gps_metros || 100,
      };
    } catch {
      return {
        empresa_id: empresaId,
        nome_fantasia: 'Autotec Pro Oficina',
        cnpj: '',
        telefone: '',
        chave_pix: '',
        raio_gps_metros: 100,
      };
    }
  },

  salvarConfiguracoesOficina: async (
    empresaId: string,
    dados: Partial<ConfiguracoesOficina>
  ): Promise<void> => {
    try {
      await supabase
        .from('empresas')
        .update({
          nome_fantasia: dados.nome_fantasia,
          razao_social: dados.razao_social,
          cnpj: dados.cnpj,
          telefone: dados.telefone,
          email: dados.email,
          endereco: dados.endereco,
        })
        .eq('id', empresaId);

      await supabase
        .from('configuracoes_empresa')
        .update({
          nome_exibicao: dados.nome_fantasia,
          cor_primaria: dados.cor_primaria,
          cor_secundaria: dados.cor_secundaria,
          logo_b64: dados.logo_b64,
        })
        .eq('empresa_id', empresaId);
    } catch {}

    localStorage.setItem(
      `autotec_oficina_custom_${empresaId}`,
      JSON.stringify(dados)
    );
  },

  geocodificarEndereco: async (
    busca: string
  ): Promise<{
    latitude: number;
    longitude: number;
    endereco_formatado?: string;
    logradouro?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  }> => {
    const limpo = busca.trim();
    const cepMatch = limpo.match(/\b\d{5}-?\d{3}\b/);
    const digitos = cepMatch ? cepMatch[0].replace(/\D/g, '') : limpo.replace(/\D/g, '');

    // 1. Se tem 8 dígitos (CEP), busca diretamente via AwesomeAPI (CORS aberto e ultra-rápido)
    if (digitos.length === 8) {
      try {
        const res = await fetch(`https://cep.awesomeapi.com.br/json/${digitos}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lat && data.lng) {
            return {
              latitude: parseFloat(data.lat),
              longitude: parseFloat(data.lng),
              endereco_formatado: `${data.address || ''}, ${data.district || ''} — ${data.city || ''}/${data.state || ''} — CEP ${data.cep || ''}`,
              logradouro: data.address,
              bairro: data.district,
              cidade: data.city,
              estado: data.state,
              cep: data.cep,
            };
          }
        }
      } catch {}

      // 2. Fallback direto via BrasilAPI v2
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`);
        if (res.ok) {
          const cepData = await res.json();
          const coords = cepData.location?.coordinates;
          if (coords?.latitude && coords?.longitude) {
            return {
              latitude: parseFloat(coords.latitude),
              longitude: parseFloat(coords.longitude),
              endereco_formatado: `${cepData.street || ''}, ${cepData.neighborhood || ''} — ${cepData.city || ''}/${cepData.state || ''} — CEP ${cepData.cep || ''}`,
              logradouro: cepData.street,
              bairro: cepData.neighborhood,
              cidade: cepData.city,
              estado: cepData.state,
              cep: cepData.cep,
            };
          }
        }
      } catch {}
    }

    throw new Error('Não foi possível encontrar as coordenadas para o CEP informado.');
  },
};
