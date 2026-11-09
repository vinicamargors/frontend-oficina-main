export type CargoUsuario = 'master' | 'DONO' | 'MECANICO' | 'ATENDENTE' | 'FINANCEIRO';

export type StatusOS =
  | 'ORCAMENTO'
  | 'AGUARDANDO_PECA'
  | 'EXECUCAO'
  | 'FINALIZADO'
  | 'PAGO';

export type TipoItemOS = 'PECA' | 'MAO_OBRA' | 'TERCEIRIZADO';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cargo: CargoUsuario;
  ativo: boolean;
  empresa_id?: string | null;
  salario_base?: number | null;
  comissao_servico_pct?: number | null;
  comissao_peca_pct?: number | null;
  vale_transporte?: number | null;
  vale_refeicao?: number | null;
  paga_hora_extra?: boolean | null;
  valor_hora_extra?: number | null;
  estrelas_media?: number | null;
  total_avaliacoes?: number | null;
}

export interface Empresa {
  id: string;
  nome_fantasia: string;
  razao_social?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  ativo: boolean;
  plano: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf_cnpj?: string | null;
  endereco?: string | null;
  empresa_id: string;
}

export interface ClienteCreateInput {
  nome: string;
  telefone: string;
  cpf_cnpj?: string | null;
  endereco?: string | null;
  empresa_id: string;
}

export interface ClienteUpdateInput {
  nome?: string;
  telefone?: string;
  cpf_cnpj?: string | null;
  endereco?: string | null;
}

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca?: string | null;
  cor?: string | null;
  km_atual?: number | null;
  ano?: number | null;
  chassi?: string | null;
  cliente_id: string;
  empresa_id: string;
  clientes?: {
    nome: string;
    telefone: string;
  } | null;
}

export interface VeiculoCreateInput {
  placa: string;
  modelo: string;
  marca?: string | null;
  cor?: string | null;
  km_atual?: number | null;
  ano?: number | null;
  chassi?: string | null;
  cliente_id: string;
  empresa_id: string;
}

export interface VeiculoUpdateInput {
  placa?: string;
  modelo?: string;
  marca?: string | null;
  cor?: string | null;
  km_atual?: number | null;
  ano?: number | null;
  chassi?: string | null;
  cliente_id?: string;
}

export interface ConsultaPlacaResponse {
  marca: string;
  modelo: string;
  cor: string;
  ano: string | number;
  chassi: string;
}

export interface EstoqueItem {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  custo: number;
  venda: number;
  minimo_alerta: number;
  codigo?: string | null;
  empresa_id: string;
}

export interface EstoqueCreateInput {
  nome: string;
  categoria: string;
  quantidade: number;
  custo: number;
  venda: number;
  minimo_alerta: number;
  codigo?: string | null;
  empresa_id: string;
}

export interface EstoqueUpdateInput {
  nome?: string;
  categoria?: string;
  quantidade?: number;
  custo?: number;
  venda?: number;
  minimo_alerta?: number;
  codigo?: string | null;
}

export interface EstoqueListResponse {
  itens: EstoqueItem[];
  stats: {
    total_itens: number;
    estoque_baixo: number;
    valor_total_custo: number;
    valor_total_venda: number;
  };
}

export interface ItemCritico {
  id: string;
  nome: string;
  quantidade: number;
  minimo_alerta: number;
  categoria: string;
}

export interface UltimaOS {
  id: string;
  cliente_id?: string;
  veiculo_id?: string;
  km_atual?: number | null;
  status: StatusOS;
  data_abertura: string;
  total_geral: number;
  descricao_problema?: string | null;
  clientes?: {
    nome?: string;
    telefone?: string;
  } | null;
  veiculos?: {
    placa?: string;
    modelo?: string;
  } | null;
}

export interface OSPaginatedResponse {
  items: UltimaOS[];
  total: number;
  skip: number;
  limit: number;
}

export interface OSCreateInput {
  cliente_id: string;
  veiculo_id: string;
  mecanico_responsavel_id?: string | null;
  descricao_problema?: string;
  km_atual?: number | null;
  empresa_id: string;
}

export interface OSUpdateInput {
  mecanico_responsavel_id?: string | null;
  descricao_problema?: string | null;
  km_atual?: number | null;
  status?: StatusOS;
  forma_pagamento?: string | null;
}

export interface OSItem {
  id: string;
  os_id: string;
  estoque_id?: string | null;
  tipo: TipoItemOS;
  nome_item: string;
  quantidade: number;
  custo_unitario: number;
  venda_unitario: number;
}

export interface OSItemCreateInput {
  estoque_id?: string | null;
  tipo: TipoItemOS;
  nome_item: string;
  quantidade: number;
  custo_unitario: number;
  venda_unitario: number;
}

export interface OSItemUpdateInput {
  tipo?: TipoItemOS;
  nome_item?: string;
  quantidade?: number;
  custo_unitario?: number;
  venda_unitario?: number;
}

export interface OSDossie {
  ordem: {
    id: string;
    cliente_id: string;
    veiculo_id: string;
    mecanico_responsavel_id?: string | null;
    status: StatusOS;
    total_pecas: number;
    total_mao_obra: number;
    total_geral: number;
    lucro_estimado?: number;
    forma_pagamento?: string | null;
    data_abertura: string;
    data_fechamento?: string | null;
    descricao_problema?: string | null;
    km_atual?: number | null;
    clientes?: {
      nome?: string;
      telefone?: string;
      cpf_cnpj?: string;
      endereco?: string;
    } | null;
    veiculos?: {
      placa?: string;
      modelo?: string;
      marca?: string;
      cor?: string;
      ano?: number;
      chassi?: string;
      km_atual?: number;
    } | null;
    usuarios?: {
      nome?: string;
    } | null;
  };
  itens: OSItem[];
  empresa: {
    nome_fantasia?: string;
    razao_social?: string;
    cnpj?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
  };
}

export interface DashboardOperacional {
  total_abertas: number;
  estoque_critico_count: number;
  status_counts: Record<StatusOS | string, number>;
  ultimas_os: UltimaOS[];
  itens_criticos: ItemCritico[];
}

export type TipoTransacao = 'DESPESA' | 'RECEITA';
export type StatusTransacao = 'PENDENTE' | 'LIQUIDADO' | 'ATRASADO' | 'CANCELADO';

export interface TransacaoFinanceira {
  id: string;
  empresa_id: string;
  tipo: TipoTransacao;
  descricao: string;
  categoria: string;
  valor: number;
  data_vencimento: string;
  data_liquidacao?: string | null;
  status: StatusTransacao;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  created_at?: string;
}

export interface TransacaoCreateInput {
  tipo: TipoTransacao;
  descricao: string;
  categoria: string;
  valor: number;
  data_vencimento: string;
  data_liquidacao?: string | null;
  status?: StatusTransacao;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  empresa_id: string;
}

export interface TransacaoUpdateInput {
  tipo?: TipoTransacao;
  descricao?: string;
  categoria?: string;
  valor?: number;
  data_vencimento?: string;
  data_liquidacao?: string | null;
  status?: StatusTransacao;
  forma_pagamento?: string | null;
  observacoes?: string | null;
}

export interface TransacoesListResponse {
  transacoes: TransacaoFinanceira[];
  resumo: {
    total_despesas_pagas: number;
    total_despesas_pendentes: number;
    total_receitas_recebidas: number;
    total_receitas_pendentes: number;
    saldo_liquido_periodo: number;
  };
}

export interface SerieTemporalMes {
  mes_ano: string;
  faturamento: number;
  lucro: number;
}

export interface FinanceiroResponse {
  faturamento_pago: number;
  faturamento_projetado: number;
  lucro_realizado: number;
  ticket_medio: number;
  historico_6_meses: SerieTemporalMes[];
}

export interface RankingCliente {
  nome: string;
  lucro: number;
  faturamento: number;
  qtd_os: number;
}

export interface ProdutividadeMecanico {
  nome: string;
  lucro_gerado: number;
  faturamento_gerado: number;
  qtd_os: number;
}

export interface MetodoPagamento {
  forma: string;
  qtd: number;
  valor_total: number;
}

export interface RentabilidadeMarca {
  marca: string;
  lucro: number;
  faturamento: number;
  qtd_os: number;
}

export interface InteligenciaFinanceiraResponse {
  top_10_clientes: RankingCliente[];
  piores_10_clientes: RankingCliente[];
  produtividade_mecanicos: ProdutividadeMecanico[];
  metodos_pagamento: MetodoPagamento[];
  rentabilidade_marcas: RentabilidadeMarca[];
  origem_faturamento: Record<string, number>;
  lead_time_medio_horas: number;
  taxa_conversao_orcamentos: number;
}

export interface UsuarioCreateInput {
  nome: string;
  email: string;
  telefone?: string | null;
  cargo: CargoUsuario;
  senha?: string;
  salario_base?: number | null;
  comissao_servico_pct?: number | null;
  comissao_peca_pct?: number | null;
  vale_transporte?: number | null;
  vale_refeicao?: number | null;
  paga_hora_extra?: boolean | null;
  valor_hora_extra?: number | null;
  empresa_id: string;
}

export interface UsuarioUpdateInput {
  nome?: string;
  email?: string;
  telefone?: string | null;
  cargo?: CargoUsuario;
  ativo?: boolean;
  senha?: string;
  salario_base?: number | null;
  comissao_servico_pct?: number | null;
  comissao_peca_pct?: number | null;
  vale_transporte?: number | null;
  vale_refeicao?: number | null;
  paga_hora_extra?: boolean | null;
  valor_hora_extra?: number | null;
}

export interface EscalaFolga {
  id: string;
  empresa_id: string;
  usuario_id: string;
  tipo: 'FERIAS' | 'FOLGA' | 'ATESTADO' | 'PLANTAO';
  data_inicio: string;
  data_fim: string;
  observacoes?: string | null;
  usuario_nome?: string;
}

export interface RegistroPonto {
  id: string;
  empresa_id: string;
  usuario_id: string;
  usuario_nome?: string;
  data: string;
  hora: string;
  tipo: 'ENTRADA' | 'ALMOCO_SAIDA' | 'ALMOCO_RETORNO' | 'SAIDA';
  latitude?: number | null;
  longitude?: number | null;
  dentro_raio: boolean;
  distancia_metros?: number | null;
}

export interface AvaliacaoOS {
  id: string;
  empresa_id: string;
  os_id: string;
  mecanico_id?: string | null;
  mecanico_nome?: string | null;
  cliente_nome: string;
  veiculo_modelo: string;
  veiculo_placa: string;
  nota: number; // 1 a 5
  comentario?: string | null;
  data: string;
}

export interface ParametrosFolha {
  dia_pagamento: number;
  dia_adiantamento: number;
  comissao_global_servico_pct: number;
  comissao_global_peca_pct: number;
  paga_hora_extra_padrao: boolean;
  valor_hora_extra_padrao: number;
}

export interface ConfiguracoesOficina {
  empresa_id: string;
  nome_fantasia: string;
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  endereco?: string | null;
  chave_pix?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  logo_b64?: string | null;
  latitude_gps?: number | null;
  longitude_gps?: number | null;
  raio_gps_metros?: number | null;
}
