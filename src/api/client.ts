import { supabase } from '../lib/supabase';
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

/** Erro devolvido pelo backend. `status` 0 = sem conexão. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Única porta de saída para dados: o backend. Erros 4xx/5xx sobem para a tela; nada é gravado "por fora".
 * Repete só quando a requisição provavelmente NÃO foi processada (evita gravar duas vezes):
 *  - leitura (GET): erro de rede, 502, 503 e 504;
 *  - escrita: apenas 503 (servidor acordando, a requisição não chegou ao app).
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const leitura = (init?.method || 'GET').toUpperCase() === 'GET';
  let renovouToken = false;

  for (let tentativa = 1; ; tentativa++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    } catch {
      if (leitura && tentativa < 3) {
        await esperar(1000 * tentativa);
        continue;
      }
      throw new ApiError('Não foi possível conectar ao servidor. Verifique a internet e tente de novo.', 0);
    }

    // Token expirado: renova a sessão e tenta 1 vez
    if (response.status === 401 && !renovouToken) {
      renovouToken = true;
      await esperar(150);
      await supabase.auth.refreshSession().catch(() => {});
      continue;
    }

    const naoProcessou =
      response.status === 503 || (leitura && (response.status === 502 || response.status === 504));
    if (naoProcessou && tentativa < 3) {
      await esperar(1500 * tentativa);
      continue;
    }

    if (!response.ok) {
      let detail = `Erro ${response.status} ao comunicar com o servidor.`;
      try {
        const errBody = await response.json();
        if (errBody?.detail) {
          detail =
            typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
        }
      } catch {
        // resposta sem corpo JSON
      }
      throw new ApiError(detail, response.status);
    }

    return response.json() as Promise<T>;
  }
}

const post = <T>(path: string, corpo: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(corpo) });
const put = <T>(path: string, corpo: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(corpo) });

export type OrdenacaoOS = 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc';

export const api = {
  // Perfil & Empresas
  getMe: () => request<Usuario>('/usuarios/me'),
  onboarding: () => post<Usuario>('/usuarios/onboarding', undefined),
  getEmpresas: (empresaId?: string) =>
    request<Empresa[]>(empresaId ? `/empresas/?empresa_id=${empresaId}` : '/empresas/'),
  // Nomes e cargos da equipe para qualquer perfil (seletor de mecânico). Sem dados de RH.
  getUsuarios: (empresaId: string) => request<Usuario[]>(`/usuarios/${empresaId}/equipe`),

  // Dashboard Operacional — últimos 30 dias & veículos no pátio
  getDashboardOperacional: (empresaId: string) =>
    request<DashboardOperacional>(`/dashboards/${empresaId}`),

  // Ordens de Serviço com paginação, filtros, faixa de valor e ordenação
  listarOS: (params: {
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
  }) => {
    const q = new URLSearchParams({
      empresa_id: params.empresaId,
      skip: String(params.skip ?? 0),
      limit: String(params.limit ?? 50),
      ordenacao: params.ordenacao || 'data_desc',
    });
    const termo = params.search?.trim();
    if (params.status) q.set('status', params.status);
    if (termo) q.set('search', termo);
    if (params.dataInicio) q.set('data_inicio', params.dataInicio);
    if (params.dataFim) q.set('data_fim', params.dataFim);
    if (params.valorMin != null && !Number.isNaN(params.valorMin)) q.set('valor_min', String(params.valorMin));
    if (params.valorMax != null && !Number.isNaN(params.valorMax)) q.set('valor_max', String(params.valorMax));
    return request<OSPaginatedResponse>(`/os/?${q.toString()}`);
  },

  // O backend reaproveita o orçamento aberto do veículo (últimos 90 dias) e devolve `reaproveitada: true`.
  criarOS: (dados: OSCreateInput) =>
    post<{ id: string; reaproveitada?: boolean; data_abertura?: string }>('/os/', dados),

  atualizarOS: (empresaId: string, osId: string, dados: OSUpdateInput) =>
    put<Record<string, unknown>>(`/os/${empresaId}/${osId}`, dados),

  deletarOS: (empresaId: string, osId: string, motivoExclusao: string) =>
    request<{ status: string; detail: string }>(
      `/os/${empresaId}/${osId}?motivo_exclusao=${encodeURIComponent(motivoExclusao)}`,
      { method: 'DELETE' }
    ),

  obterDossieOS: (empresaId: string, osId: string) =>
    request<OSDossie>(`/os/${empresaId}/${osId}/imprimir`),

  // Estoque e totais da OS são ajustados pelo backend (baixa, estorno e recálculo)
  adicionarItensOSLote: (empresaId: string, osId: string, itens: OSItemCreateInput[]) =>
    post<OSItem[]>(`/os/${empresaId}/${osId}/itens/lote`, itens),

  atualizarItemOS: (empresaId: string, osId: string, itemId: string, item: OSItemUpdateInput) =>
    put<OSItem>(`/os/${empresaId}/${osId}/itens/${itemId}`, item),

  removerItemOS: (empresaId: string, osId: string, itemId: string) =>
    request<{ status: string; detail: string }>(`/os/${empresaId}/${osId}/itens/${itemId}`, {
      method: 'DELETE',
    }),

  // Clientes & Veículos & Estoque
  listarClientes: (empresaId: string) => request<Cliente[]>(`/clientes/${empresaId}`),

  criarCliente: (dados: ClienteCreateInput) => post<Cliente>('/clientes/', dados),

  atualizarCliente: (empresaId: string, clienteId: string, dados: ClienteUpdateInput) =>
    put<Cliente>(`/clientes/${empresaId}/${clienteId}`, dados),

  listarVeiculos: (empresaId: string, placa?: string) =>
    request<Veiculo[]>(`/veiculos/${empresaId}${placa ? `?placa=${encodeURIComponent(placa)}` : ''}`),

  criarVeiculo: (dados: VeiculoCreateInput) =>
    post<Veiculo>('/veiculos/', { ...dados, placa: dados.placa.toUpperCase().trim() }),

  atualizarVeiculo: (empresaId: string, veiculoId: string, dados: VeiculoUpdateInput) =>
    put<Veiculo>(`/veiculos/${empresaId}/${veiculoId}`, {
      ...dados,
      ...(dados.placa ? { placa: dados.placa.toUpperCase().trim() } : {}),
    }),

  listarHistoricoOS: async (params: {
    empresaId: string;
    clienteId?: string;
    veiculoId?: string;
  }): Promise<UltimaOS[]> => {
    const q = new URLSearchParams({ empresa_id: params.empresaId, limit: '500' });
    if (params.clienteId) q.set('cliente_id', params.clienteId);
    if (params.veiculoId) q.set('veiculo_id', params.veiculoId);
    return (await request<OSPaginatedResponse>(`/os/?${q.toString()}`)).items;
  },

  consultarPlaca: (placa: string) =>
    request<ConsultaPlacaResponse>(
      `/veiculos/consulta-placa/${encodeURIComponent(placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}`
    ),

  listarEstoque: (empresaId: string, categoria?: string) =>
    request<EstoqueListResponse>(
      `/estoque/${empresaId}${categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''}`
    ),

  criarItemEstoque: (dados: EstoqueCreateInput) =>
    post<EstoqueItem>('/estoque/', {
      ...dados,
      nome: dados.nome.trim(),
      categoria: dados.categoria.toUpperCase().trim(),
      ...(dados.codigo ? { codigo: dados.codigo.toUpperCase().trim() } : {}),
    }),

  atualizarItemEstoque: (empresaId: string, itemId: string, dados: EstoqueUpdateInput) =>
    put<EstoqueItem>(`/estoque/${empresaId}/${itemId}`, {
      ...dados,
      ...(dados.nome ? { nome: dados.nome.trim() } : {}),
      ...(dados.categoria ? { categoria: dados.categoria.toUpperCase().trim() } : {}),
      ...(dados.codigo !== undefined
        ? { codigo: dados.codigo ? dados.codigo.toUpperCase().trim() : null }
        : {}),
    }),

  ajustarEstoque: (empresaId: string, itemId: string, tipo: 'entrada' | 'saida', quantidade: number) =>
    request<EstoqueItem>(`/estoque/${empresaId}/${itemId}/ajustar`, {
      method: 'PATCH',
      body: JSON.stringify({ tipo, quantidade }),
    }),

  deletarItemEstoque: (empresaId: string, itemId: string) =>
    request<{ status: string; detail: string }>(`/estoque/${empresaId}/${itemId}`, {
      method: 'DELETE',
    }),

  // Transações Financeiras (Contas a Pagar e Receitas Avulsas)
  listarTransacoesFinanceiras: (
    empresaId: string,
    params?: {
      tipo?: 'DESPESA' | 'RECEITA';
      status?: string;
      dataInicial?: string;
      dataFinal?: string;
    }
  ) => {
    const q = new URLSearchParams();
    if (params?.tipo) q.set('tipo', params.tipo);
    if (params?.status) q.set('status', params.status);
    if (params?.dataInicial) q.set('data_inicial', params.dataInicial);
    if (params?.dataFinal) q.set('data_final', params.dataFinal);
    return request<TransacoesListResponse>(
      `/transacoes-financeiras/${empresaId}${q.toString() ? `?${q.toString()}` : ''}`
    );
  },

  criarTransacaoFinanceira: (dados: TransacaoCreateInput) =>
    post<TransacaoFinanceira>('/transacoes-financeiras/', dados),

  atualizarTransacaoFinanceira: (empresaId: string, id: string, dados: TransacaoUpdateInput) =>
    put<TransacaoFinanceira>(`/transacoes-financeiras/${empresaId}/${id}`, dados),

  liquidarTransacaoFinanceira: (empresaId: string, id: string, formaPagamento?: string) =>
    request<TransacaoFinanceira>(`/transacoes-financeiras/${empresaId}/${id}/liquidar`, {
      method: 'PATCH',
      body: JSON.stringify({
        data_liquidacao: new Date().toISOString().slice(0, 10),
        forma_pagamento: formaPagamento,
      }),
    }),

  deletarTransacaoFinanceira: (empresaId: string, id: string) =>
    request<{ status: string; detail: string }>(`/transacoes-financeiras/${empresaId}/${id}`, {
      method: 'DELETE',
    }),

  // Módulo de Inteligência & DRE
  obterDadosFinanceiros: (empresaId: string, dataInicial?: string, dataFinal?: string) => {
    const q = new URLSearchParams();
    if (dataInicial) q.set('data_inicial', dataInicial);
    if (dataFinal) q.set('data_final', dataFinal);
    return request<FinanceiroResponse>(`/financeiro/${empresaId}${q.toString() ? `?${q.toString()}` : ''}`);
  },

  obterInteligenciaFinanceira: (empresaId: string, dataInicial?: string, dataFinal?: string) => {
    const q = new URLSearchParams();
    if (dataInicial) q.set('data_inicial', dataInicial);
    if (dataFinal) q.set('data_final', dataFinal);
    return request<InteligenciaFinanceiraResponse>(
      `/financeiro/inteligencia/${empresaId}${q.toString() ? `?${q.toString()}` : ''}`
    );
  },

  // Equipe, RH e Usuários — RH (salário, comissões, vales) só sai pelo backend, que exige DONO/master.
  listarUsuarios: (empresaId: string) => request<Usuario[]>(`/usuarios/${empresaId}`),

  criarUsuario: (dados: UsuarioCreateInput) => post<Usuario>(`/usuarios/${dados.empresa_id}`, dados),

  atualizarUsuario: (empresaId: string, usuarioId: string, dados: UsuarioUpdateInput) =>
    put<Usuario>(`/usuarios/${empresaId}/${usuarioId}`, dados),

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

  // Parâmetros da Folha (ficam em configuracoes_empresa, no servidor)
  obterParametrosFolha: async (empresaId: string): Promise<ParametrosFolha> => {
    const cfg = await request<Record<string, any>>(`/empresas/${empresaId}/configuracoes`);
    return {
      dia_pagamento: cfg.dia_pagamento_folha ?? PARAMETROS_FOLHA_PADRAO.dia_pagamento,
      dia_adiantamento: cfg.dia_adiantamento_folha ?? PARAMETROS_FOLHA_PADRAO.dia_adiantamento,
      comissao_global_servico_pct:
        cfg.comissao_global_servico_pct ?? PARAMETROS_FOLHA_PADRAO.comissao_global_servico_pct,
      comissao_global_peca_pct:
        cfg.comissao_global_peca_pct ?? PARAMETROS_FOLHA_PADRAO.comissao_global_peca_pct,
      paga_hora_extra_padrao:
        cfg.paga_hora_extra_padrao ?? PARAMETROS_FOLHA_PADRAO.paga_hora_extra_padrao,
      valor_hora_extra_padrao:
        cfg.valor_hora_extra_padrao ?? PARAMETROS_FOLHA_PADRAO.valor_hora_extra_padrao,
    };
  },

  salvarParametrosFolha: async (empresaId: string, p: ParametrosFolha): Promise<void> => {
    await put(`/empresas/${empresaId}/configuracoes`, {
      dia_pagamento_folha: p.dia_pagamento,
      dia_adiantamento_folha: p.dia_adiantamento,
      comissao_global_servico_pct: p.comissao_global_servico_pct,
      comissao_global_peca_pct: p.comissao_global_peca_pct,
      paga_hora_extra_padrao: p.paga_hora_extra_padrao,
      valor_hora_extra_padrao: p.valor_hora_extra_padrao,
    });
  },

  // Montador de Escalas e Calendário de Férias
  listarEscalasFolgas: (empresaId: string) => request<EscalaFolga[]>(`/equipe/escalas/${empresaId}`),

  salvarEscalaFolga: (dados: Omit<EscalaFolga, 'id'>) =>
    post<EscalaFolga>(`/equipe/escalas/${dados.empresa_id}`, dados),

  deletarEscalaFolga: async (empresaId: string, id: string): Promise<void> => {
    await request(`/equipe/escalas/${empresaId}/${id}`, { method: 'DELETE' });
  },

  // Registro de Ponto Eletrônico
  registrarPonto: (dados: Omit<RegistroPonto, 'id'>) =>
    post<RegistroPonto>(`/equipe/pontos/${dados.empresa_id}`, dados),

  listarPontos: (empresaId: string, dataFiltro?: string) =>
    request<RegistroPonto[]>(
      `/equipe/pontos/${empresaId}${dataFiltro ? `?data=${encodeURIComponent(dataFiltro)}` : ''}`
    ),

  // Avaliações de Clientes (NPS & 5 Estrelas). A média do mecânico é atualizada pelo banco (trigger).
  salvarAvaliacaoOS: (dados: Omit<AvaliacaoOS, 'id'>) => post<AvaliacaoOS>('/equipe/avaliar', dados),

  listarAvaliacoesOS: (empresaId: string) =>
    request<AvaliacaoOS[]>(`/equipe/avaliacoes/${empresaId}`),

  // Lançar Folha no Contas a Pagar
  lancarFolhaContasAPagar: (
    empresaId: string,
    dados: {
      mes_referencia: string;
      data_vencimento?: string;
      incluir_vales?: boolean;
      descricao_custom?: string;
    }
  ) =>
    post<{
      sucesso: boolean;
      total_funcionarios: number;
      valor_total_folha: number;
      transacao_id: string;
      mensagem: string;
    }>(`/equipe/folha/${empresaId}/lancar-contas-a-pagar`, dados),

  // Configurações da Oficina (empresa + configuracoes_empresa)
  obterConfiguracoesOficina: async (empresaId: string): Promise<ConfiguracoesOficina> => {
    const [empresas, cfg] = await Promise.all([
      request<Empresa[]>(`/empresas/?empresa_id=${empresaId}`),
      request<Record<string, any>>(`/empresas/${empresaId}/configuracoes`),
    ]);
    const emp: Record<string, any> = empresas.find((e) => e.id === empresaId) || {};
    return {
      empresa_id: empresaId,
      nome_fantasia: emp.nome_fantasia || 'Autotec Pro Oficina',
      razao_social: emp.razao_social || '',
      cnpj: emp.cnpj || '',
      inscricao_estadual: cfg.inscricao_estadual || '',
      telefone: emp.telefone || '',
      whatsapp: cfg.whatsapp || emp.telefone || '',
      email: emp.email || '',
      endereco: emp.endereco || '',
      chave_pix: cfg.chave_pix || '',
      cor_primaria: cfg.cor_primaria || '#1e3a8a',
      cor_secundaria: cfg.cor_secundaria || '#f97316',
      logo_b64: cfg.logo_b64 || null,
      latitude_gps: cfg.latitude_gps ?? null,
      longitude_gps: cfg.longitude_gps ?? null,
      raio_gps_metros: cfg.raio_gps_metros || 100,
    };
  },

  salvarConfiguracoesOficina: async (
    empresaId: string,
    dados: Partial<ConfiguracoesOficina>
  ): Promise<void> => {
    const texto = (v?: string | null) => (v && v.trim() ? v.trim() : null);
    await put(`/empresas/${empresaId}`, {
      ...(texto(dados.nome_fantasia) ? { nome_fantasia: texto(dados.nome_fantasia) } : {}),
      razao_social: texto(dados.razao_social),
      cnpj: texto(dados.cnpj),
      telefone: texto(dados.telefone),
      endereco: texto(dados.endereco),
      // e-mail vazio é recusado pelo backend (EmailStr): só envia quando preenchido
      ...(texto(dados.email) ? { email: texto(dados.email) } : {}),
    });
    await put(`/empresas/${empresaId}/configuracoes`, {
      nome_exibicao: texto(dados.nome_fantasia),
      cor_primaria: dados.cor_primaria,
      cor_secundaria: dados.cor_secundaria,
      logo_b64: dados.logo_b64,
      inscricao_estadual: texto(dados.inscricao_estadual),
      whatsapp: texto(dados.whatsapp),
      chave_pix: texto(dados.chave_pix),
      latitude_gps: dados.latitude_gps ?? null,
      longitude_gps: dados.longitude_gps ?? null,
      raio_gps_metros: dados.raio_gps_metros ?? 100,
    });
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

const RAIO_GPS_PADRAO = 100;

const PARAMETROS_FOLHA_PADRAO: ParametrosFolha = {
  dia_pagamento: 5,
  dia_adiantamento: 20,
  comissao_global_servico_pct: 15,
  comissao_global_peca_pct: 5,
  paga_hora_extra_padrao: true,
  valor_hora_extra_padrao: 25,
};

/**
 * Versões antigas guardavam WhatsApp, chave PIX, GPS do ponto e parâmetros da folha só no navegador do dono.
 * Leva esses valores para o servidor uma única vez (só preenche o que o servidor ainda não tem) e apaga a cópia local.
 * Se falhar, mantém a cópia e tenta no próximo login.
 */
export async function migrarConfigLocal(empresaId: string): Promise<void> {
  const chaveCustom = `autotec_oficina_custom_${empresaId}`;
  const chaveFolha = `autotec_parametros_folha_${empresaId}`;
  const ler = (k: string): Record<string, any> | null => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const custom = ler(chaveCustom);
  const folha = ler(chaveFolha);
  if (!custom && !folha) return;

  const cfg = await request<Record<string, any>>(`/empresas/${empresaId}/configuracoes`);
  const vazio = (v: unknown) => v === null || v === undefined || v === '';
  const corpo: Record<string, unknown> = {};

  for (const campo of ['whatsapp', 'chave_pix', 'inscricao_estadual', 'latitude_gps', 'longitude_gps']) {
    if (vazio(cfg[campo]) && !vazio(custom?.[campo])) corpo[campo] = custom![campo];
  }
  // O servidor sempre devolve um raio (padrão 100 m): só vale o valor antigo se o do servidor ainda for o padrão.
  if ((vazio(cfg.raio_gps_metros) || cfg.raio_gps_metros === RAIO_GPS_PADRAO) && !vazio(custom?.raio_gps_metros)) {
    corpo.raio_gps_metros = custom!.raio_gps_metros;
  }
  // Parâmetros da folha: o servidor sempre tem um valor; só troca se ainda for o padrão.
  const mapaFolha: Array<[keyof ParametrosFolha, string]> = [
    ['dia_pagamento', 'dia_pagamento_folha'],
    ['dia_adiantamento', 'dia_adiantamento_folha'],
    ['comissao_global_servico_pct', 'comissao_global_servico_pct'],
    ['comissao_global_peca_pct', 'comissao_global_peca_pct'],
    ['paga_hora_extra_padrao', 'paga_hora_extra_padrao'],
    ['valor_hora_extra_padrao', 'valor_hora_extra_padrao'],
  ];
  for (const [local, servidor] of mapaFolha) {
    const noServidor = cfg[servidor];
    if ((vazio(noServidor) || noServidor === PARAMETROS_FOLHA_PADRAO[local]) && !vazio(folha?.[local])) {
      corpo[servidor] = folha![local];
    }
  }

  if (Object.keys(corpo).length > 0) {
    await put(`/empresas/${empresaId}/configuracoes`, corpo);
  }
  localStorage.removeItem(chaveCustom);
  localStorage.removeItem(chaveFolha);
}
