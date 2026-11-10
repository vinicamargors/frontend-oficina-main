import type {
  AvaliacaoOS,
  CargoUsuario,
  Cliente,
  DashboardOperacional,
  Empresa,
  EscalaFolga,
  EstoqueItem,
  EstoqueListResponse,
  FinanceiroResponse,
  InteligenciaFinanceiraResponse,
  OSDossie,
  OSItem,
  OSPaginatedResponse,
  RegistroPonto,
  StatusOS,
  TransacaoFinanceira,
  TransacoesListResponse,
  UltimaOS,
  Usuario,
  Veiculo,
} from '../../src/types';

export type Cenario = 'cheio' | 'vazio';

export const EMPRESA_ID = '11111111-1111-4111-8111-111111111111';

const DIA = 24 * 60 * 60 * 1000;
const diasAtras = (n: number, hora = 9) => {
  const d = new Date(Date.now() - n * DIA);
  d.setHours(hora, 15, 0, 0);
  return d.toISOString();
};
const dataISO = (n: number) => new Date(Date.now() + n * DIA).toISOString().slice(0, 10);
const uuid = (prefixo: number, n: number) =>
  `${String(prefixo).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

// ---------------------------------------------------------------- empresa e usuários
export const empresa: Empresa = {
  id: EMPRESA_ID,
  nome_fantasia: 'Oficina Modelo Mecanify',
  razao_social: 'Oficina Modelo Mecanify Ltda',
  cnpj: '12.345.678/0001-90',
  email: 'contato@oficinamodelo.example.com',
  telefone: '(11) 3333-4444',
  endereco: 'Rua das Oficinas, 100 — Centro, São Paulo/SP',
  ativo: true,
  plano: 'pro',
};

export const configuracoesEmpresa = {
  inscricao_estadual: '123.456.789.000',
  whatsapp: '(11) 99999-0000',
  chave_pix: 'contato@oficinamodelo.example.com',
  cor_primaria: '#1e3a8a',
  cor_secundaria: '#38BDF8',
  logo_b64: null,
  latitude_gps: -23.55052,
  longitude_gps: -46.633308,
  raio_gps_metros: 150,
  dia_pagamento_folha: 5,
  dia_adiantamento_folha: 20,
  comissao_global_servico_pct: 15,
  comissao_global_peca_pct: 5,
  paga_hora_extra_padrao: true,
  valor_hora_extra_padrao: 25,
};

const usuarioBase = (n: number, nome: string, cargo: CargoUsuario, extra: Partial<Usuario> = {}): Usuario => ({
  id: uuid(2, n),
  nome,
  email: `${nome.split(' ')[0].toLowerCase()}@oficinamodelo.example.com`,
  telefone: '(11) 98888-000' + n,
  cargo,
  ativo: true,
  empresa_id: EMPRESA_ID,
  salario_base: cargo === 'MECANICO' ? 3200 : 4500,
  comissao_servico_pct: 15,
  comissao_peca_pct: 5,
  vale_transporte: 220,
  vale_refeicao: 600,
  paga_hora_extra: true,
  valor_hora_extra: 25,
  estrelas_media: cargo === 'MECANICO' ? 4.6 : null,
  total_avaliacoes: cargo === 'MECANICO' ? 12 : 0,
  ...extra,
});

export const usuarios: Usuario[] = [
  usuarioBase(1, 'Marcos Almeida', 'DONO'),
  usuarioBase(2, 'Juliana Prado', 'FINANCEIRO'),
  usuarioBase(3, 'Rafael Nunes', 'ATENDENTE'),
  usuarioBase(4, 'Tiago Ferreira', 'MECANICO'),
  usuarioBase(5, 'Paulo Reis', 'MECANICO', { ativo: false, estrelas_media: 3.9, total_avaliacoes: 4 }),
];

/** Perfil usado na sessão simulada (`master` não consta da lista da equipe). */
export function perfilDoCargo(cargo: CargoUsuario): Usuario {
  if (cargo === 'master') {
    return usuarioBase(9, 'Admin Master', 'master', { empresa_id: EMPRESA_ID, salario_base: null });
  }
  return usuarios.find((u) => u.cargo === cargo && u.ativo) as Usuario;
}

export function usuarioPorId(id: string): Usuario | undefined {
  return [...usuarios, perfilDoCargo('master')].find((u) => u.id === id);
}

// ---------------------------------------------------------------- clientes e veículos
const NOME_LONGO = 'Maria Aparecida dos Santos Albuquerque de Oliveira Cavalcanti Neto'.slice(0, 60);

const NOMES_CLIENTES = [
  'João Pereira da Silva',
  NOME_LONGO,
  'Ana Beatriz Costa',
  'Carlos Eduardo Lima',
  'Transportadora Rota Sul Ltda',
  'Fernanda Rocha',
  'Roberto Carvalho',
  'Patrícia Mendes',
];

export const clientes: Cliente[] = NOMES_CLIENTES.map((nome, i) => ({
  id: uuid(3, i + 1),
  nome,
  telefone: `(11) 9${7000 + i * 111}-${1000 + i * 37}`,
  cpf_cnpj: i === 4 ? '12.345.678/0001-95' : `123.456.78${i}-0${i}`,
  endereco: `Rua ${i + 1} de Março, ${100 + i * 10} — São Paulo/SP`,
  empresa_id: EMPRESA_ID,
}));

const MODELOS: Array<[string, string, string, string]> = [
  ['ABC1234', 'Gol 1.0', 'Volkswagen', 'Prata'],
  ['BRA2E19', 'Onix LT', 'Chevrolet', 'Branco'],
  ['QWE4R56', 'Corolla XEi', 'Toyota', 'Preto'],
  ['FGH7J88', 'HB20 Comfort', 'Hyundai', 'Vermelho'],
  ['KLM9N21', 'Sprinter 415', 'Mercedes-Benz', 'Branco'],
  ['PQR3S45', 'Civic EXL', 'Honda', 'Cinza'],
  ['TUV6W78', 'Strada Freedom', 'Fiat', 'Azul'],
  ['XYZ1A23', 'Kwid Zen', 'Renault', 'Laranja'],
  ['DEF5G67', 'Ranger XLS', 'Ford', 'Prata'],
  ['HIJ8K90', 'Polo TSI', 'Volkswagen', 'Preto'],
];

export const veiculos: Veiculo[] = MODELOS.map(([placa, modelo, marca, cor], i) => {
  const cliente = clientes[i % clientes.length];
  return {
    id: uuid(4, i + 1),
    placa,
    modelo,
    marca,
    cor,
    km_atual: 28000 + i * 13500,
    ano: 2012 + i,
    chassi: `9BW${String(1000000000 + i * 7919)}`,
    cliente_id: cliente.id,
    empresa_id: EMPRESA_ID,
    clientes: { nome: cliente.nome, telefone: cliente.telefone },
  };
});

// ---------------------------------------------------------------- estoque
const ITENS: Array<[string, string, number, number, number, number]> = [
  // nome, categoria, qtd, custo, venda, mínimo
  ['Filtro de óleo PH5949', 'FILTROS', 24, 18, 39.9, 6],
  ['Filtro de ar condicionado', 'FILTROS', 3, 22, 54.9, 5], // baixo
  ['Filtro de combustível', 'FILTROS', 15, 28, 62, 4],
  ['Óleo 5W30 sintético 1L', 'FLUIDOS', 48, 31, 59.9, 12],
  ['Fluido de freio DOT4', 'FLUIDOS', 2, 19, 38, 6], // baixo
  ['Aditivo radiador 1L', 'FLUIDOS', 18, 14, 29.9, 5],
  ['Pastilha de freio dianteira', 'FREIOS', 10, 85, 169.9, 4],
  ['Disco de freio ventilado', 'FREIOS', 6, 160, 289, 2],
  ['Pastilha de freio traseira', 'FREIOS', 1, 70, 139.9, 3], // baixo
  ['Vela de ignição NGK', 'IGNICAO', 40, 16, 34.9, 8],
  ['Cabo de vela jogo', 'IGNICAO', 7, 95, 189, 2],
  ['Bateria 60Ah', 'ELETRICA', 5, 340, 549, 2],
  ['Lâmpada H4 par', 'ELETRICA', 22, 24, 59.9, 6],
  ['Amortecedor dianteiro', 'SUSPENSAO', 8, 210, 389, 2],
  ['Bieleta estabilizadora', 'SUSPENSAO', 12, 35, 79.9, 4],
  ['Correia dentada kit', 'MOTOR', 9, 190, 349, 3],
  ['Junta do cabeçote', 'MOTOR', 4, 120, 249, 2],
  ['Bomba d’água', 'MOTOR', 6, 98, 199, 2],
  ['Pneu 175/70 R14', 'PNEUS', 16, 280, 429, 4],
  ['Palheta limpador par', 'ACESSORIOS', 20, 21, 49.9, 5],
];

export const estoque: EstoqueItem[] = ITENS.map(([nome, categoria, quantidade, custo, venda, minimo], i) => ({
  id: uuid(5, i + 1),
  nome,
  categoria,
  quantidade,
  custo,
  venda,
  minimo_alerta: minimo,
  codigo: `PC-${String(1000 + i)}`,
  empresa_id: EMPRESA_ID,
}));

const abaixoDoMinimo = (e: EstoqueItem) => e.quantidade < e.minimo_alerta;

export function listaEstoque(cenario: Cenario, categoria?: string | null): EstoqueListResponse {
  const base = cenario === 'vazio' ? [] : estoque;
  const itens = categoria ? base.filter((i) => i.categoria === categoria.toUpperCase()) : base;
  return {
    itens,
    stats: {
      total_itens: itens.length,
      estoque_baixo: itens.filter(abaixoDoMinimo).length,
      valor_total_custo: itens.reduce((s, i) => s + i.quantidade * i.custo, 0),
      valor_total_venda: itens.reduce((s, i) => s + i.quantidade * i.venda, 0),
    },
  };
}

// ---------------------------------------------------------------- ordens de serviço
const PROBLEMAS = [
  'Barulho na suspensão dianteira ao passar em buracos',
  'Revisão dos 40 mil km com troca de óleo e filtros',
  'Luz da injeção acesa no painel',
  'Freio com pedal baixo e ruído ao frear',
  'Ar condicionado não gela',
  'Troca da correia dentada e bomba d’água',
  'Carro puxando para a direita em alta velocidade',
  'Bateria descarregando durante a noite',
  'Vazamento de óleo no cárter',
  'Alinhamento e balanceamento',
  'Superaquecimento em trânsito parado',
  'Troca de pastilhas e discos de freio',
];

// status de cada OS, em ordem do mais novo (0 dias) ao mais antigo (15 dias)
const PLANO_OS: Array<[StatusOS, number, number]> = [
  // status, dias atrás, total
  ['ORCAMENTO', 0, 480],
  ['EXECUCAO', 1, 1290.5],
  ['AGUARDANDO_PECA', 2, 2150],
  ['ORCAMENTO', 3, 860],
  ['EXECUCAO', 4, 395.9],
  ['FINALIZADO', 5, 1740],
  ['AGUARDANDO_PECA', 6, 3120],
  ['EXECUCAO', 8, 612],
  ['ORCAMENTO', 9, 275],
  ['PAGO', 11, 940],
  ['FINALIZADO', 12, 1385.4],
  ['PAGO', 15, 2210], // a mais antiga usa a placa ABC1234 (veículo 0)
];

export const ordens: UltimaOS[] = PLANO_OS.map(([status, dias, total], i) => {
  // a OS mais antiga (i = 11) fica com o veículo 0 (ABC1234); a do nome de 60 caracteres é a 2ª (i = 1)
  const veiculo = i === 11 ? veiculos[0] : i === 1 ? veiculos[1] : veiculos[(i + 2) % veiculos.length];
  const cliente = i === 1 ? clientes[1] : clientes.find((c) => c.id === veiculo.cliente_id)!;
  return {
    id: uuid(6, i + 1),
    cliente_id: cliente.id,
    veiculo_id: veiculo.id,
    km_atual: veiculo.km_atual,
    status,
    data_abertura: diasAtras(dias, 8 + (i % 8)),
    total_geral: total,
    descricao_problema: PROBLEMAS[i],
    clientes: { nome: cliente.nome, telefone: cliente.telefone },
    veiculos: { placa: veiculo.placa, modelo: veiculo.modelo },
  };
});

/** OS aberta na bancada (`?tab=os&osId=`). */
export const OS_BANCADA_ID = ordens[1].id;

export function listaOS(cenario: Cenario, q: URLSearchParams): OSPaginatedResponse {
  let items = cenario === 'vazio' ? [] : [...ordens];
  const status = q.get('status');
  if (status) items = items.filter((o) => o.status === status);
  // `data_inicio`/`data_fim` (AAAA-MM-DD, inclusivos) valem para o dia de `data_abertura` no fuso da oficina
  const dia = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
  const dataInicio = q.get('data_inicio');
  if (dataInicio) items = items.filter((o) => dia(o.data_abertura) >= dataInicio);
  const dataFim = q.get('data_fim');
  if (dataFim) items = items.filter((o) => dia(o.data_abertura) <= dataFim);
  const clienteId = q.get('cliente_id');
  if (clienteId) items = items.filter((o) => o.cliente_id === clienteId);
  const veiculoId = q.get('veiculo_id');
  if (veiculoId) items = items.filter((o) => o.veiculo_id === veiculoId);
  const busca = q.get('search')?.trim().toLowerCase();
  if (busca) {
    items = items.filter((o) =>
      [o.clientes?.nome, o.veiculos?.placa, o.veiculos?.modelo, o.descricao_problema]
        .join(' ')
        .toLowerCase()
        .includes(busca)
    );
  }
  const ord = q.get('ordenacao') || 'data_desc';
  items.sort((a, b) =>
    ord === 'data_asc'
      ? a.data_abertura.localeCompare(b.data_abertura)
      : ord === 'valor_desc'
        ? b.total_geral - a.total_geral
        : ord === 'valor_asc'
          ? a.total_geral - b.total_geral
          : b.data_abertura.localeCompare(a.data_abertura)
  );
  const skip = Number(q.get('skip') || 0);
  const limit = Number(q.get('limit') || 50);
  return { items: items.slice(skip, skip + limit), total: items.length, skip, limit };
}

export function dossie(cenario: Cenario, osId: string): OSDossie {
  const os = ordens.find((o) => o.id === osId) || ordens[1];
  const veiculo = veiculos.find((v) => v.id === os.veiculo_id)!;
  const cliente = clientes.find((c) => c.id === os.cliente_id)!;
  const itens: OSItem[] =
    cenario === 'vazio'
      ? []
      : [
          { id: uuid(7, 1), os_id: os.id, estoque_id: estoque[6].id, tipo: 'PECA', nome_item: estoque[6].nome, quantidade: 1, custo_unitario: 85, venda_unitario: 169.9 },
          { id: uuid(7, 2), os_id: os.id, estoque_id: estoque[7].id, tipo: 'PECA', nome_item: estoque[7].nome, quantidade: 2, custo_unitario: 160, venda_unitario: 289 },
          { id: uuid(7, 3), os_id: os.id, estoque_id: null, tipo: 'MAO_OBRA', nome_item: 'Troca de pastilhas e discos', quantidade: 1, custo_unitario: 0, venda_unitario: 320 },
          { id: uuid(7, 4), os_id: os.id, estoque_id: null, tipo: 'TERCEIRIZADO', nome_item: 'Retífica de discos', quantidade: 1, custo_unitario: 90, venda_unitario: 150 },
        ];
  const totalPecas = itens.filter((i) => i.tipo === 'PECA').reduce((s, i) => s + i.quantidade * i.venda_unitario, 0);
  const totalMao = itens.filter((i) => i.tipo !== 'PECA').reduce((s, i) => s + i.quantidade * i.venda_unitario, 0);
  const custo = itens.reduce((s, i) => s + i.quantidade * i.custo_unitario, 0);
  return {
    ordem: {
      id: os.id,
      cliente_id: os.cliente_id!,
      veiculo_id: os.veiculo_id!,
      mecanico_responsavel_id: usuarios[3].id,
      status: os.status,
      total_pecas: totalPecas,
      total_mao_obra: totalMao,
      total_geral: totalPecas + totalMao,
      lucro_estimado: totalPecas + totalMao - custo,
      forma_pagamento: os.status === 'PAGO' ? 'PIX' : null,
      data_abertura: os.data_abertura,
      data_fechamento: os.status === 'PAGO' ? os.data_abertura : null,
      descricao_problema: os.descricao_problema,
      km_atual: os.km_atual,
      clientes: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        cpf_cnpj: cliente.cpf_cnpj || undefined,
        endereco: cliente.endereco || undefined,
      },
      veiculos: {
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        marca: veiculo.marca || undefined,
        cor: veiculo.cor || undefined,
        ano: veiculo.ano || undefined,
        chassi: veiculo.chassi || undefined,
        km_atual: veiculo.km_atual || undefined,
      },
      usuarios: { nome: usuarios[3].nome },
    },
    itens,
    empresa: {
      nome_fantasia: empresa.nome_fantasia,
      razao_social: empresa.razao_social || undefined,
      cnpj: empresa.cnpj || undefined,
      telefone: empresa.telefone || undefined,
      email: empresa.email || undefined,
      endereco: empresa.endereco || undefined,
    },
  };
}

export function dashboard(cenario: Cenario): DashboardOperacional {
  if (cenario === 'vazio') {
    return {
      total_abertas: 0,
      estoque_critico_count: 0,
      status_counts: { ORCAMENTO: 0, AGUARDANDO_PECA: 0, EXECUCAO: 0, FINALIZADO: 0, PAGO: 0 },
      ultimas_os: [],
      itens_criticos: [],
    };
  }
  const contagem: Record<string, number> = { ORCAMENTO: 0, AGUARDANDO_PECA: 0, EXECUCAO: 0, FINALIZADO: 0, PAGO: 0 };
  ordens.forEach((o) => (contagem[o.status] += 1));
  return {
    total_abertas: ordens.filter((o) => o.status !== 'PAGO').length,
    estoque_critico_count: estoque.filter(abaixoDoMinimo).length,
    status_counts: contagem,
    ultimas_os: ordens.slice(0, 10),
    itens_criticos: estoque.filter(abaixoDoMinimo).map((e) => ({
      id: e.id,
      nome: e.nome,
      quantidade: e.quantidade,
      minimo_alerta: e.minimo_alerta,
      categoria: e.categoria,
    })),
  };
}

// ---------------------------------------------------------------- financeiro
const TRANSACOES_PLANO: Array<[TransacaoFinanceira['tipo'], string, string, number, number, TransacaoFinanceira['status']]> = [
  ['RECEITA', 'Venda balcão — palhetas', 'VENDAS', 120, -1, 'LIQUIDADO'],
  ['DESPESA', 'Aluguel do galpão', 'ALUGUEL', 4800, -12, 'LIQUIDADO'],
  ['DESPESA', 'Conta de energia', 'ENERGIA', 1260.4, -9, 'LIQUIDADO'],
  ['DESPESA', 'Fornecedor de peças — Distribuidora Sul', 'FORNECEDORES', 6350, 3, 'PENDENTE'],
  ['RECEITA', 'Serviço avulso — scanner', 'SERVIÇOS', 250, -3, 'LIQUIDADO'],
  ['DESPESA', 'Internet e telefone', 'UTILIDADES', 289.9, 5, 'PENDENTE'],
  ['DESPESA', 'Material de limpeza', 'MATERIAIS', 184.5, -6, 'LIQUIDADO'],
  ['DESPESA', 'Imposto Simples Nacional', 'IMPOSTOS', 2140, -2, 'ATRASADO'],
  ['RECEITA', 'Recebimento parcelado — frota', 'FROTA', 3400, 7, 'PENDENTE'],
  ['DESPESA', 'Manutenção do elevador', 'MANUTENÇÃO', 780, 10, 'PENDENTE'],
  ['RECEITA', 'Venda de sucata', 'VENDAS', 430, -8, 'LIQUIDADO'],
  ['DESPESA', 'Marketing digital', 'MARKETING', 650, -4, 'LIQUIDADO'],
  ['DESPESA', 'Seguro do estabelecimento', 'SEGUROS', 920, 14, 'PENDENTE'],
  ['RECEITA', 'Serviço avulso — higienização', 'SERVIÇOS', 350, -5, 'LIQUIDADO'],
  ['DESPESA', 'Ferramentas — jogo de chaves', 'FERRAMENTAS', 1150, -10, 'LIQUIDADO'],
];

export const transacoes: TransacaoFinanceira[] = TRANSACOES_PLANO.map(([tipo, descricao, categoria, valor, offset, status], i) => ({
  id: uuid(8, i + 1),
  empresa_id: EMPRESA_ID,
  tipo,
  descricao,
  categoria,
  valor,
  data_vencimento: dataISO(offset),
  data_liquidacao: status === 'LIQUIDADO' ? dataISO(offset) : null,
  status,
  forma_pagamento: status === 'LIQUIDADO' ? 'PIX' : null,
  observacoes: null,
  created_at: diasAtras(Math.abs(offset) + 1),
}));

export function listaTransacoes(cenario: Cenario, q: URLSearchParams): TransacoesListResponse {
  let lista = cenario === 'vazio' ? [] : [...transacoes];
  const tipo = q.get('tipo');
  if (tipo) lista = lista.filter((t) => t.tipo === tipo);
  const status = q.get('status');
  if (status) lista = lista.filter((t) => t.status === status);
  const soma = (tp: string, st: (s: string) => boolean) =>
    lista.filter((t) => t.tipo === tp && st(t.status)).reduce((s, t) => s + t.valor, 0);
  const despPagas = soma('DESPESA', (s) => s === 'LIQUIDADO');
  const recRecebidas = soma('RECEITA', (s) => s === 'LIQUIDADO');
  return {
    transacoes: lista,
    resumo: {
      total_despesas_pagas: despPagas,
      total_despesas_pendentes: soma('DESPESA', (s) => s !== 'LIQUIDADO'),
      total_receitas_recebidas: recRecebidas,
      total_receitas_pendentes: soma('RECEITA', (s) => s !== 'LIQUIDADO'),
      saldo_liquido_periodo: recRecebidas - despPagas,
    },
  };
}

export function financeiro(cenario: Cenario): FinanceiroResponse {
  const meses = [5, 4, 3, 2, 1, 0].map((n) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n, 1);
    return d.toISOString().slice(0, 7);
  });
  if (cenario === 'vazio') {
    return {
      faturamento_pago: 0,
      faturamento_projetado: 0,
      lucro_realizado: 0,
      ticket_medio: 0,
      historico_6_meses: meses.map((mes_ano) => ({ mes_ano, faturamento: 0, lucro: 0 })),
    };
  }
  return {
    faturamento_pago: 28450.9,
    faturamento_projetado: 41200,
    lucro_realizado: 11230.4,
    ticket_medio: 1184.2,
    historico_6_meses: meses.map((mes_ano, i) => ({
      mes_ano,
      faturamento: 18000 + i * 2900 + (i % 2) * 1500,
      lucro: 6500 + i * 900,
    })),
  };
}

export function inteligencia(cenario: Cenario): InteligenciaFinanceiraResponse {
  if (cenario === 'vazio') {
    return {
      top_10_clientes: [],
      piores_10_clientes: [],
      produtividade_mecanicos: [],
      metodos_pagamento: [],
      rentabilidade_marcas: [],
      origem_faturamento: {},
      lead_time_medio_horas: 0,
      taxa_conversao_orcamentos: 0,
    };
  }
  const rank = (i: number) => ({
    nome: clientes[i].nome,
    lucro: 3200 - i * 380,
    faturamento: 8200 - i * 900,
    qtd_os: 9 - i,
  });
  return {
    top_10_clientes: [0, 1, 2, 3, 4].map(rank),
    piores_10_clientes: [5, 6, 7].map((i) => ({ ...rank(i), lucro: 120 + i * 10 })),
    produtividade_mecanicos: [
      { nome: usuarios[3].nome, lucro_gerado: 7400, faturamento_gerado: 19800, qtd_os: 24 },
      { nome: usuarios[4].nome, lucro_gerado: 2100, faturamento_gerado: 6400, qtd_os: 8 },
    ],
    metodos_pagamento: [
      { forma: 'PIX', qtd: 18, valor_total: 14200 },
      { forma: 'CARTÃO DE CRÉDITO', qtd: 11, valor_total: 9800 },
      { forma: 'DINHEIRO', qtd: 4, valor_total: 2100 },
    ],
    rentabilidade_marcas: [
      { marca: 'Volkswagen', lucro: 3900, faturamento: 9800, qtd_os: 12 },
      { marca: 'Chevrolet', lucro: 2400, faturamento: 6100, qtd_os: 7 },
      { marca: 'Toyota', lucro: 1900, faturamento: 4800, qtd_os: 5 },
    ],
    origem_faturamento: { PECA: 12400, MAO_OBRA: 13200, TERCEIRIZADO: 2850 },
    lead_time_medio_horas: 52.5,
    taxa_conversao_orcamentos: 68.4,
  };
}

// ---------------------------------------------------------------- equipe
export function escalas(cenario: Cenario): EscalaFolga[] {
  if (cenario === 'vazio') return [];
  return [
    { id: uuid(9, 1), empresa_id: EMPRESA_ID, usuario_id: usuarios[3].id, tipo: 'FERIAS', data_inicio: dataISO(10), data_fim: dataISO(24), observacoes: 'Férias programadas', usuario_nome: usuarios[3].nome },
    { id: uuid(9, 2), empresa_id: EMPRESA_ID, usuario_id: usuarios[2].id, tipo: 'FOLGA', data_inicio: dataISO(2), data_fim: dataISO(2), observacoes: null, usuario_nome: usuarios[2].nome },
  ];
}

export function pontos(cenario: Cenario): RegistroPonto[] {
  if (cenario === 'vazio') return [];
  const hoje = dataISO(0);
  return [
    { id: uuid(10, 1), empresa_id: EMPRESA_ID, usuario_id: usuarios[3].id, usuario_nome: usuarios[3].nome, data: hoje, hora: '08:02:00', tipo: 'ENTRADA', latitude: -23.55052, longitude: -46.633308, dentro_raio: true, distancia_metros: 12 },
    { id: uuid(10, 2), empresa_id: EMPRESA_ID, usuario_id: usuarios[2].id, usuario_nome: usuarios[2].nome, data: hoje, hora: '08:30:00', tipo: 'ENTRADA', latitude: -23.55, longitude: -46.63, dentro_raio: true, distancia_metros: 40 },
  ];
}

export function avaliacoes(cenario: Cenario): AvaliacaoOS[] {
  if (cenario === 'vazio') return [];
  const comentarios = ['Serviço excelente, carro ficou ótimo!', 'Atendimento rápido e honesto.', null, 'Demorou um pouco, mas resolveram.', 'Recomendo a todos.'];
  return comentarios.map((comentario, i) => ({
    id: uuid(11, i + 1),
    empresa_id: EMPRESA_ID,
    os_id: ordens[i + 5 > 11 ? 11 : i + 5].id,
    mecanico_id: usuarios[3].id,
    mecanico_nome: usuarios[3].nome,
    cliente_nome: clientes[i].nome,
    veiculo_modelo: veiculos[i].modelo,
    veiculo_placa: veiculos[i].placa,
    nota: [5, 5, 4, 3, 5][i],
    comentario,
    data: diasAtras(i * 3 + 1),
  }));
}

export function listaClientes(cenario: Cenario): Cliente[] {
  return cenario === 'vazio' ? [] : clientes;
}

export function listaVeiculos(cenario: Cenario, placa?: string | null): Veiculo[] {
  if (cenario === 'vazio') return [];
  return placa ? veiculos.filter((v) => v.placa === placa.toUpperCase()) : veiculos;
}

export function listaUsuarios(cenario: Cenario): Usuario[] {
  // sem dados, a equipe tem só o dono (quem está logado)
  return cenario === 'vazio' ? [usuarios[0]] : usuarios;
}
