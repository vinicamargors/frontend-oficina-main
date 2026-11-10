import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  TransacaoFinanceira,
  TransacaoCreateInput,
  TransacaoUpdateInput,
  FinanceiroResponse,
  InteligenciaFinanceiraResponse,
  TipoTransacao,
  StatusTransacao,
} from '../types';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  PieChart,
  Users,
  Wrench,
  Car,
  FileSpreadsheet,
  Check,
  X,
  Pencil,
  Trash2,
  Search,
  ShieldAlert,
} from 'lucide-react';

interface FinanceiroProps {
  empresaId: string;
}

type TabFinanceiro = 'balanco' | 'dre' | 'contas' | 'bi';

const CATEGORIAS_DESPESA = [
  'ALUGUEL',
  'ENERGIA_AGUA',
  'TAXAS_MAQUININHA',
  'FOLHA_PAGAMENTO',
  'COMISSAO',
  'IMPOSTOS',
  'MANUTENCAO',
  'FORNECEDORES',
  'OUTROS',
];

const CATEGORIAS_RECEITA = [
  'APORTE',
  'VENDA_SUCATA',
  'SUBLOCACAO',
  'SEGURO_GARANTIA',
  'RENDIMENTO',
  'OUTROS',
];

const FORMAS_PAGAMENTO = [
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
  'Boleto / Faturado',
  'TED / Transferência',
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

export function Financeiro({ empresaId }: FinanceiroProps) {
  const { user } = useAuth();
  const canSeeFinanceiro =
    user?.cargo === 'DONO' || user?.cargo === 'FINANCEIRO' || user?.cargo === 'master';

  const [activeTab, setActiveTab] = useState<TabFinanceiro>('balanco');

  // Filtro Global de Período
  const [periodoAtalho, setPeriodoAtalho] = useState<
    'HOJE' | '7D' | '30D' | 'MES_ATUAL' | 'MES_ANTERIOR' | 'ANO_ATUAL' | 'CUSTOM'
  >('30D');
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Dados do Financeiro & Transações
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  const [dadosFinanceiros, setDadosFinanceiros] = useState<FinanceiroResponse | null>(null);
  const [biData, setBiData] = useState<InteligenciaFinanceiraResponse | null>(null);
  const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>([]);
  const [patrimonioEstoque, setPatrimonioEstoque] = useState(0);

  // Filtros da aba de Contas a Pagar/Receber
  const [filtroTipoTransacao, setFiltroTipoTransacao] = useState<'TODAS' | 'DESPESA' | 'RECEITA'>(
    'TODAS'
  );
  const [filtroStatusTransacao, setFiltroStatusTransacao] = useState<
    'TODAS' | 'PENDENTE' | 'LIQUIDADO' | 'ATRASADO'
  >('TODAS');
  const [buscaTransacao, setBuscaTransacao] = useState('');

  // Modais de Transações
  const [modalTransacaoAberto, setModalTransacaoAberto] = useState(false);
  const [transacaoEmEdicao, setTransacaoEmEdicao] = useState<TransacaoFinanceira | null>(null);
  const [salvandoTransacao, setSalvandoTransacao] = useState(false);

  // Form State Transação
  const [formTipo, setFormTipo] = useState<TipoTransacao>('DESPESA');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCategoria, setFormCategoria] = useState('ALUGUEL');
  const [formValor, setFormValor] = useState('');
  const [formVencimento, setFormVencimento] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [formForma, setFormForma] = useState('PIX');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formJaPago, setFormJaPago] = useState(false);

  // Modal Confirmação Exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<TransacaoFinanceira | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Atalhos de Período
  const aplicarAtalhoPeriodo = (
    atalho: 'HOJE' | '7D' | '30D' | 'MES_ATUAL' | 'MES_ANTERIOR' | 'ANO_ATUAL'
  ) => {
    setPeriodoAtalho(atalho);
    const hoje = new Date();
    const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

    if (atalho === 'HOJE') {
      const hStr = formatYMD(hoje);
      setDataInicio(hStr);
      setDataFim(hStr);
    } else if (atalho === '7D') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setDataInicio(formatYMD(d));
      setDataFim(formatYMD(hoje));
    } else if (atalho === '30D') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDataInicio(formatYMD(d));
      setDataFim(formatYMD(hoje));
    } else if (atalho === 'MES_ATUAL') {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(formatYMD(primeiroDia));
      setDataFim(formatYMD(hoje));
    } else if (atalho === 'MES_ANTERIOR') {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      setDataInicio(formatYMD(primeiroDia));
      setDataFim(formatYMD(ultimoDia));
    } else if (atalho === 'ANO_ATUAL') {
      const primeiroDia = new Date(hoje.getFullYear(), 0, 1);
      setDataInicio(formatYMD(primeiroDia));
      setDataFim(formatYMD(hoje));
    }
  };

  const dispararFeedback = (msg: string) => {
    setSucessoMsg(msg);
    setTimeout(() => setSucessoMsg(null), 4000);
  };

  // Carregar Dados do Período
  const carregarDados = useCallback(async () => {
    if (!canSeeFinanceiro) return;
    try {
      setCarregando(true);
      setErro(null);

      const [resFin, resBi, resTrans, resEstoque] = await Promise.all([
        api.obterDadosFinanceiros(empresaId, dataInicio, dataFim),
        api.obterInteligenciaFinanceira(empresaId, dataInicio, dataFim),
        api.listarTransacoesFinanceiras(empresaId, {
          dataInicial: dataInicio,
          dataFinal: dataFim,
        }),
        api.listarEstoque(empresaId),
      ]);

      setDadosFinanceiros(resFin);
      setBiData(resBi);
      setTransacoes(resTrans.transacoes || []);
      setPatrimonioEstoque(resEstoque.stats.valor_total_custo || 0);
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao carregar dados financeiros.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId, dataInicio, dataFim, canSeeFinanceiro]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Cálculos Consolidados de DRE & Balanço
  const resumoFinanceiro = useMemo(() => {
    const faturamentoOS = dadosFinanceiros?.faturamento_pago || 0;
    const aReceberOS = dadosFinanceiros?.faturamento_projetado || 0;
    const lucroOS = dadosFinanceiros?.lucro_realizado || 0;
    const custoPecasOS = Math.max(0, faturamentoOS - lucroOS);

    let despesasPagas = 0;
    let despesasPendentes = 0;
    let receitasAvulsasRecebidas = 0;
    let receitasAvulsasPendentes = 0;

    const despesasPorCategoria: Record<string, number> = {};

    for (const t of transacoes) {
      const val = Number(t.valor || 0);
      if (t.tipo === 'DESPESA') {
        if (t.status === 'LIQUIDADO') {
          despesasPagas += val;
          despesasPorCategoria[t.categoria] =
            (despesasPorCategoria[t.categoria] || 0) + val;
        } else if (t.status === 'PENDENTE' || t.status === 'ATRASADO') {
          despesasPendentes += val;
        }
      } else if (t.tipo === 'RECEITA') {
        if (t.status === 'LIQUIDADO') {
          receitasAvulsasRecebidas += val;
        } else if (t.status === 'PENDENTE' || t.status === 'ATRASADO') {
          receitasAvulsasPendentes += val;
        }
      }
    }

    const receitaBrutaTotal = faturamentoOS + receitasAvulsasRecebidas;
    const lucroBrutoOperacional = receitaBrutaTotal - custoPecasOS;
    const margemBruta =
      receitaBrutaTotal > 0 ? (lucroBrutoOperacional / receitaBrutaTotal) * 100 : 0;

    const lucroLiquidoReal = lucroBrutoOperacional - despesasPagas;
    const margemLiquida =
      receitaBrutaTotal > 0 ? (lucroLiquidoReal / receitaBrutaTotal) * 100 : 0;

    // Balanço Patrimonial
    const caixaTotal = faturamentoOS + receitasAvulsasRecebidas;
    const totalAReceber = aReceberOS + receitasAvulsasPendentes;
    const totalAtivo = caixaTotal + totalAReceber + patrimonioEstoque;
    const totalPassivo = despesasPendentes;
    const posicaoLiquida = totalAtivo - totalPassivo;

    return {
      faturamentoOS,
      receitasAvulsasRecebidas,
      receitasAvulsasPendentes,
      receitaBrutaTotal,
      custoPecasOS,
      lucroBrutoOperacional,
      margemBruta,
      despesasPagas,
      despesasPendentes,
      despesasPorCategoria,
      lucroLiquidoReal,
      margemLiquida,
      caixaTotal,
      totalAReceber,
      totalAtivo,
      totalPassivo,
      posicaoLiquida,
    };
  }, [dadosFinanceiros, transacoes, patrimonioEstoque]);

  // Transações Filtradas
  const transacoesFiltradas = useMemo(() => {
    let lista = transacoes;
    if (filtroTipoTransacao !== 'TODAS') {
      lista = lista.filter((t) => t.tipo === filtroTipoTransacao);
    }
    if (filtroStatusTransacao !== 'TODAS') {
      lista = lista.filter((t) => t.status === filtroStatusTransacao);
    }
    if (buscaTransacao.trim()) {
      const q = buscaTransacao.toLowerCase().trim();
      lista = lista.filter(
        (t) =>
          t.descricao.toLowerCase().includes(q) ||
          t.categoria.toLowerCase().includes(q) ||
          (t.observacoes && t.observacoes.toLowerCase().includes(q))
      );
    }
    return lista;
  }, [transacoes, filtroTipoTransacao, filtroStatusTransacao, buscaTransacao]);

  // Modal Abrir Cadastro
  const abrirModalCadastroTransacao = (tipo: TipoTransacao) => {
    setTransacaoEmEdicao(null);
    setFormTipo(tipo);
    setFormDescricao('');
    setFormCategoria(tipo === 'DESPESA' ? 'ALUGUEL' : 'APORTE');
    setFormValor('');
    setFormVencimento(new Date().toISOString().slice(0, 10));
    setFormForma('PIX');
    setFormObservacoes('');
    setFormJaPago(false);
    setModalTransacaoAberto(true);
  };

  const abrirModalEdicaoTransacao = (t: TransacaoFinanceira) => {
    setTransacaoEmEdicao(t);
    setFormTipo(t.tipo);
    setFormDescricao(t.descricao);
    setFormCategoria(t.categoria);
    setFormValor(String(t.valor));
    setFormVencimento(t.data_vencimento);
    setFormForma(t.forma_pagamento || 'PIX');
    setFormObservacoes(t.observacoes || '');
    setFormJaPago(t.status === 'LIQUIDADO');
    setModalTransacaoAberto(true);
  };

  // Salvar Transação
  const handleSalvarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescricao.trim()) {
      alert('Informe a descrição.');
      return;
    }
    const val = parseFloat(formValor.replace(',', '.')) || 0;
    if (val <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    try {
      setSalvandoTransacao(true);
      const hoje = new Date().toISOString().slice(0, 10);
      const statusFinal: StatusTransacao = formJaPago ? 'LIQUIDADO' : 'PENDENTE';

      if (transacaoEmEdicao) {
        const payload: TransacaoUpdateInput = {
          tipo: formTipo,
          descricao: formDescricao.trim(),
          categoria: formCategoria.toUpperCase().trim(),
          valor: val,
          data_vencimento: formVencimento,
          status: statusFinal,
          data_liquidacao: formJaPago ? formVencimento || hoje : null,
          forma_pagamento: formForma,
          observacoes: formObservacoes.trim() || null,
        };
        const atualizada = await api.atualizarTransacaoFinanceira(
          empresaId,
          transacaoEmEdicao.id,
          payload
        );
        setTransacoes((prev) =>
          prev.map((t) => (t.id === atualizada.id ? atualizada : t))
        );
        dispararFeedback(`Lançamento "${atualizada.descricao}" atualizado com sucesso!`);
      } else {
        const payload: TransacaoCreateInput = {
          empresa_id: empresaId,
          tipo: formTipo,
          descricao: formDescricao.trim(),
          categoria: formCategoria.toUpperCase().trim(),
          valor: val,
          data_vencimento: formVencimento,
          status: statusFinal,
          data_liquidacao: formJaPago ? formVencimento || hoje : null,
          forma_pagamento: formForma,
          observacoes: formObservacoes.trim() || null,
        };
        const criada = await api.criarTransacaoFinanceira(payload);
        setTransacoes((prev) => [criada, ...prev]);
        dispararFeedback(`"${criada.descricao}" lançado com sucesso!`);
      }

      setModalTransacaoAberto(false);
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao salvar transação financeira.');
    } finally {
      setSalvandoTransacao(false);
    }
  };

  // Dar Baixa / Liquidar
  const handleLiquidar = async (t: TransacaoFinanceira) => {
    try {
      const atualizada = await api.liquidarTransacaoFinanceira(
        empresaId,
        t.id,
        t.forma_pagamento || 'PIX'
      );
      setTransacoes((prev) =>
        prev.map((item) => (item.id === atualizada.id ? atualizada : item))
      );
      dispararFeedback(
        `"${t.descricao}" marcado como ${t.tipo === 'DESPESA' ? 'PAGO' : 'RECEBIDO'} com sucesso!`
      );
    } catch {
      alert('Erro ao dar baixa no lançamento.');
    }
  };

  // Excluir
  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir) return;
    try {
      setExcluindo(true);
      await api.deletarTransacaoFinanceira(empresaId, itemParaExcluir.id);
      setTransacoes((prev) => prev.filter((i) => i.id !== itemParaExcluir.id));
      dispararFeedback(`"${itemParaExcluir.descricao}" removido.`);
      setItemParaExcluir(null);
    } catch {
      alert('Erro ao excluir transação.');
    } finally {
      setExcluindo(false);
    }
  };

  // Exportar Relatórios para CSV / Excel
  const handleExportarCsv = (tipoRelatorio: 'DRE' | 'CONTAS' | 'BI' | 'BALANCO') => {
    let nomeArquivo = '';
    let csvContent = '';

    if (tipoRelatorio === 'DRE') {
      nomeArquivo = `dre_mecanify_${dataInicio}_a_${dataFim}.csv`;
      const linhas = [
        ['DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE)', 'MECANIFY'],
        ['Período:', `${formatData(dataInicio)} a ${formatData(dataFim)}`],
        ['', ''],
        ['CONTA GERENCIAL', 'VALOR (R$)', '% SOBRE RECEITA'],
        ['1. RECEITA BRUTA TOTAL', resumoFinanceiro.receitaBrutaTotal.toFixed(2), '100.0%'],
        ['  (+) Faturamento Ordens de Serviço', resumoFinanceiro.faturamentoOS.toFixed(2), ''],
        ['  (+) Receitas Avulsas / Aportes', resumoFinanceiro.receitasAvulsasRecebidas.toFixed(2), ''],
        ['2. (-) CUSTOS VARIÁVEIS DIRETOS (CMV PEÇAS)', `-${resumoFinanceiro.custoPecasOS.toFixed(2)}`, ''],
        ['3. (=) LUCRO BRUTO OPERACIONAL', resumoFinanceiro.lucroBrutoOperacional.toFixed(2), `${resumoFinanceiro.margemBruta.toFixed(1)}%`],
        ['4. (-) DESPESAS OPERACIONAIS TOTAIS', `-${resumoFinanceiro.despesasPagas.toFixed(2)}`, ''],
      ];

      for (const [cat, val] of Object.entries(resumoFinanceiro.despesasPorCategoria)) {
        linhas.push([`  (-) ${cat}`, `-${val.toFixed(2)}`, '']);
      }

      linhas.push([
        '5. (=) LUCRO LÍQUIDO REAL DO PERÍODO',
        resumoFinanceiro.lucroLiquidoReal.toFixed(2),
        `${resumoFinanceiro.margemLiquida.toFixed(1)}%`,
      ]);

      csvContent =
        '\uFEFF' +
        linhas
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
          )
          .join('\r\n');
    } else if (tipoRelatorio === 'CONTAS') {
      nomeArquivo = `lancamentos_financeiros_${dataInicio}_a_${dataFim}.csv`;
      const cabecalho = [
        'Tipo',
        'Descrição',
        'Categoria',
        'Valor (R$)',
        'Vencimento',
        'Data Liquidação',
        'Status',
        'Forma de Pagamento',
        'Observações',
      ];
      const linhas = transacoesFiltradas.map((t) => [
        t.tipo,
        t.descricao,
        t.categoria,
        Number(t.valor).toFixed(2).replace('.', ','),
        formatData(t.data_vencimento),
        t.data_liquidacao ? formatData(t.data_liquidacao) : '—',
        t.status,
        t.forma_pagamento || '—',
        t.observacoes || '',
      ]);

      csvContent =
        '\uFEFF' +
        [cabecalho, ...linhas]
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
          )
          .join('\r\n');
    } else if (tipoRelatorio === 'BALANCO') {
      nomeArquivo = `balanco_patrimonial_${dataInicio}_a_${dataFim}.csv`;
      const linhas = [
        ['BALANÇO PATRIMONIAL & POSIÇÃO FINANCEIRA', 'MECANIFY'],
        ['Período:', `${formatData(dataInicio)} a ${formatData(dataFim)}`],
        ['', ''],
        ['GRUPO PATRIMONIAL', 'VALOR (R$)'],
        ['(+) Caixa Realizado (OS + Aportes)', resumoFinanceiro.caixaTotal.toFixed(2)],
        ['(+) Contas a Receber (OS + Entradas Pendentes)', resumoFinanceiro.totalAReceber.toFixed(2)],
        ['(+) Patrimônio em Estoque (Almoxarifado)', patrimonioEstoque.toFixed(2)],
        ['(=) TOTAL DO ATIVO CIRCULANTE', resumoFinanceiro.totalAtivo.toFixed(2)],
        ['', ''],
        ['(-) Contas a Pagar Pendentes (Passivo)', `-${resumoFinanceiro.totalPassivo.toFixed(2)}`],
        ['(=) POSIÇÃO LÍQUIDA PATRIMONIAL', resumoFinanceiro.posicaoLiquida.toFixed(2)],
      ];

      csvContent =
        '\uFEFF' +
        linhas
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
          )
          .join('\r\n');
    } else if (tipoRelatorio === 'BI') {
      nomeArquivo = `relatorio_bi_oficina_${dataInicio}_a_${dataFim}.csv`;
      const linhas = [
        ['RELATÓRIO DE INTELIGÊNCIA & BI DA OFICINA', 'MECANIFY'],
        ['Período:', `${formatData(dataInicio)} a ${formatData(dataFim)}`],
        ['Ticket Médio:', formatBRL(dadosFinanceiros?.ticket_medio)],
        ['Taxa de Conversão:', `${biData?.taxa_conversao_orcamentos || 0}%`],
        ['', ''],
        ['PRODUTIVIDADE POR MECÂNICO', 'QTD OS', 'FATURAMENTO GERADO', 'LUCRO GERADO'],
        ...(biData?.produtividade_mecanicos || []).map((m) => [
          m.nome,
          String(m.qtd_os),
          Number(m.faturamento_gerado).toFixed(2),
          Number(m.lucro_gerado).toFixed(2),
        ]),
        ['', '', '', ''],
        ['RENTABILIDADE POR MARCA', 'QTD OS', 'FATURAMENTO', 'LUCRO'],
        ...(biData?.rentabilidade_marcas || []).map((mb) => [
          mb.marca,
          String(mb.qtd_os),
          Number(mb.faturamento).toFixed(2),
          Number(mb.lucro).toFixed(2),
        ]),
        ['', '', '', ''],
        ['DISTRIBUIÇÃO POR MEIO DE PAGAMENTO', 'QTD', 'TOTAL (R$)', ''],
        ...(biData?.metodos_pagamento || []).map((mp) => [
          mp.forma,
          String(mp.qtd),
          Number(mp.valor_total).toFixed(2),
          '',
        ]),
      ];

      csvContent =
        '\uFEFF' +
        linhas
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
          )
          .join('\r\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nomeArquivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    dispararFeedback(`Relatório ${tipoRelatorio} exportado com sucesso!`);
  };

  if (!canSeeFinanceiro) {
    return (
      <div className="bg-surface border-2 border-danger rounded-lg p-6 sm:p-10 text-center space-y-4 max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-lg bg-danger/15 border border-danger text-danger flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-ink">
          Acesso Restrito ao Módulo Financeiro
        </h2>
        <p className="text-sm text-ink-muted">
          Este painel contém informações estratégicas, DRE, margens e dados contábeis da oficina.
          Seu perfil ({user?.cargo}) não possui permissão para visualizar estes números.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* CABEÇALHO FINANCEIRO & BARRA GLOBAL DE PERÍODO */}
      <header className="bg-surface border-2 border-line rounded-lg p-3.5 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted border-2 border-brand text-brand-ink flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight flex items-center gap-2">
                <span>Gestão Financeira &amp; BI</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-success/15 border border-success text-xs font-mono font-semibold text-success">
                  DRE &bull; Balanço
                </span>
              </h1>
              <p className="text-xs text-ink-subtle">
                Controle de caixa, receitas, custos variáveis, contas a pagar e inteligência de oficina.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={carregarDados}
              disabled={carregando}
              title="Atualizar dados financeiros"
              aria-label="Atualizar dados financeiros"
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-sunken hover:bg-muted border border-line text-ink-muted flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${carregando ? 'animate-spin text-brand-ink' : ''}`}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'dre') handleExportarCsv('DRE');
                else if (activeTab === 'contas') handleExportarCsv('CONTAS');
                else if (activeTab === 'bi') handleExportarCsv('BI');
                else handleExportarCsv('BALANCO');
              }}
              title="Exportar dados da aba atual para CSV/Excel"
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sunken hover:bg-muted border border-line text-ink font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-brand-ink" aria-hidden="true" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => abrirModalCadastroTransacao('DESPESA')}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-danger-solid hover:bg-danger-solid text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-danger/40"
            >
              <ArrowDownRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>+ Despesa</span>
            </button>

            <button
              type="button"
              onClick={() => abrirModalCadastroTransacao('RECEITA')}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-success-solid hover:bg-success-solid text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-success/40"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>+ Receita / Aporte</span>
            </button>
          </div>
        </div>

        {/* BARRA DE ATALHOS DE PERÍODO */}
        <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {(
              [
                { id: 'HOJE', label: 'Hoje' },
                { id: '7D', label: '7 Dias' },
                { id: '30D', label: '30 Dias' },
                { id: 'MES_ATUAL', label: 'Este Mês' },
                { id: 'MES_ANTERIOR', label: 'Mês Anterior' },
                { id: 'ANO_ATUAL', label: 'Ano Atual' },
              ] as const
            ).map((at) => (
              <button
                key={at.id}
                type="button"
                onClick={() => aplicarAtalhoPeriodo(at.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 cursor-pointer transition-colors ${
                  periodoAtalho === at.id
                    ? 'bg-muted text-ink'
                    : 'bg-sunken text-ink-muted border border-line hover:bg-muted'
                }`}
              >
                {at.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-ink-muted">
            <Calendar className="w-3.5 h-3.5 text-brand-ink shrink-0" aria-hidden="true" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPeriodoAtalho('CUSTOM');
              }}
              className="px-2 py-0.5 rounded bg-sunken border border-line text-ink text-xs"
            />
            <span>até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPeriodoAtalho('CUSTOM');
              }}
              className="px-2 py-0.5 rounded bg-sunken border border-line text-ink text-xs"
            />
          </div>
        </div>
      </header>

      {/* FEEDBACK DE SUCESSO / ERRO */}
      <div aria-live="polite">
        {sucessoMsg && (
          <div className="p-3 rounded-xl bg-success/15 border border-success text-success flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>{sucessoMsg}</span>
          </div>
        )}
        {erro && (
          <div className="p-3 rounded-xl bg-danger/15 border border-danger text-danger flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
            <span>{erro}</span>
          </div>
        )}
      </div>

      {/* 4 ABAS PRINCIPAIS DO MÓDULO FINANCEIRO */}
      <nav
        aria-label="Abas Financeiras"
        className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 bg-sunken p-1.5 rounded-lg border-2 border-line"
      >
        <button
          type="button"
          onClick={() => setActiveTab('balanco')}
          className={`min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'balanco'
              ? 'bg-brand text-on-brand'
              : 'text-ink-muted hover:bg-muted'
          }`}
        >
          <PieChart className="w-4 h-4" aria-hidden="true" />
          <span>Balanço &amp; Posição</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dre')}
          className={`min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'dre'
              ? 'bg-brand text-on-brand'
              : 'text-ink-muted hover:bg-muted'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          <span>DRE Operacional</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contas')}
          className={`min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'contas'
              ? 'bg-brand text-on-brand'
              : 'text-ink-muted hover:bg-muted'
          }`}
        >
          <CreditCard className="w-4 h-4" aria-hidden="true" />
          <span>Contas a Pagar &amp; Receber</span>
          {resumoFinanceiro.despesasPendentes > 0 && (
            <span className="w-2 h-2 rounded-full bg-danger shrink-0" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bi')}
          className={`min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'bi'
              ? 'bg-brand text-on-brand'
              : 'text-ink-muted hover:bg-muted'
          }`}
        >
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
          <span>BI &amp; Inteligência</span>
        </button>
      </nav>

      {/* ========================================================
          ABA 1: BALANÇO PATRIMONIAL & FOTOGRAFIA DO MOMENTO
          ======================================================== */}
      {activeTab === 'balanco' && (
        <div className="space-y-4">
          {/* 4 CARDS EXECUTIVOS NO TOPO (2x2 NO MOBILE) */}
          <section
            aria-label="Indicadores Financeiros Executivos"
            className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
          >
            <div className="bg-surface border-2 border-line rounded-xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-subtle text-xs font-semibold">
                <span>Caixa Realizado</span>
                <ArrowUpRight className="w-4 h-4 text-success" aria-hidden="true" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold font-mono text-success mt-1 tabular-nums">
                {formatBRL(resumoFinanceiro.caixaTotal)}
              </div>
              <div className="text-xs text-ink-subtle">OS Pagas + Aportes recebidos</div>
            </div>

            <div className="bg-surface border-2 border-line rounded-xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-subtle text-xs font-semibold">
                <span>A Receber (Projetado)</span>
                <Clock className="w-4 h-4 text-info" aria-hidden="true" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold font-mono text-info mt-1 tabular-nums">
                {formatBRL(resumoFinanceiro.totalAReceber)}
              </div>
              <div className="text-xs text-ink-subtle">OS em execução / a faturar</div>
            </div>

            <div className="bg-surface border-2 border-line rounded-xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-subtle text-xs font-semibold">
                <span>Despesas Pagas</span>
                <ArrowDownRight className="w-4 h-4 text-danger" aria-hidden="true" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold font-mono text-danger mt-1 tabular-nums">
                {formatBRL(resumoFinanceiro.despesasPagas)}
              </div>
              <div className="text-xs text-ink-subtle">
                Pendente: {formatBRL(resumoFinanceiro.despesasPendentes)}
              </div>
            </div>

            <div className="bg-surface border-2 border-brand rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-lg shadow-info/20">
              <div className="flex items-center justify-between text-brand-ink text-xs font-semibold">
                <span>Lucro Líquido Real</span>
                <TrendingUp className="w-4 h-4 text-brand-ink" aria-hidden="true" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold font-mono text-ink mt-1 tabular-nums">
                {formatBRL(resumoFinanceiro.lucroLiquidoReal)}
              </div>
              <div className="text-xs text-success font-semibold">
                Margem Líquida: {resumoFinanceiro.margemLiquida.toFixed(1)}%
              </div>
            </div>
          </section>

          {/* ESTRUTURA DO BALANÇO PATRIMONIAL ATIVO VS PASSIVO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ATIVO CIRCULANTE */}
            <div className="bg-surface border-2 border-line rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-ink flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span>Ativo Circulante (Bens e Direitos)</span>
                </h3>
                <span className="font-mono font-semibold text-sm text-success">
                  {formatBRL(resumoFinanceiro.totalAtivo)}
                </span>
              </div>

              <div className="space-y-2 text-xs sm:text-sm font-mono tabular-nums">
                <div className="p-2.5 rounded-xl bg-sunken border border-line flex items-center justify-between">
                  <span className="text-ink-muted font-sans">Caixa &amp; Bancos Realizado</span>
                  <strong className="text-ink">{formatBRL(resumoFinanceiro.caixaTotal)}</strong>
                </div>

                <div className="p-2.5 rounded-xl bg-sunken border border-line flex items-center justify-between">
                  <span className="text-ink-muted font-sans">Contas a Receber (OS em Aberto)</span>
                  <strong className="text-info">{formatBRL(resumoFinanceiro.totalAReceber)}</strong>
                </div>

                <div className="p-2.5 rounded-xl bg-sunken border border-line flex items-center justify-between">
                  <span className="text-ink-muted font-sans">Patrimônio em Peças (Estoque Almoxarifado)</span>
                  <strong className="text-warning">{formatBRL(patrimonioEstoque)}</strong>
                </div>
              </div>
            </div>

            {/* PASSIVO CIRCULANTE & POSIÇÃO LÍQUIDA */}
            <div className="bg-surface border-2 border-line rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-ink flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                  <span>Passivo Circulante (Obrigações)</span>
                </h3>
                <span className="font-mono font-semibold text-sm text-danger">
                  {formatBRL(resumoFinanceiro.totalPassivo)}
                </span>
              </div>

              <div className="space-y-2 text-xs sm:text-sm font-mono tabular-nums">
                <div className="p-2.5 rounded-xl bg-sunken border border-line flex items-center justify-between">
                  <span className="text-ink-muted font-sans">Contas a Pagar Pendentes / A Vencer</span>
                  <strong className="text-danger">{formatBRL(resumoFinanceiro.despesasPendentes)}</strong>
                </div>

                <div className="p-3 rounded-xl bg-info/30 border-2 border-brand flex items-center justify-between mt-3">
                  <div className="font-sans">
                    <div className="text-xs font-semibold text-brand-ink uppercase tracking-wider">
                      Posição Patrimonial Líquida
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      Ativo Circulante Total &minus; Passivo Pendente
                    </div>
                  </div>
                  <strong className="text-lg sm:text-xl font-semibold text-ink">
                    {formatBRL(resumoFinanceiro.posicaoLiquida)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 2: DRE OPERACIONAL DA OFICINA (DEMONSTRATIVO)
          ======================================================== */}
      {activeTab === 'dre' && (
        <div className="bg-surface border-2 border-line rounded-lg p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-ink flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-ink" aria-hidden="true" />
                <span>Demonstrativo do Resultado do Exercício (DRE)</span>
              </h2>
              <p className="text-xs text-ink-subtle">
                Detalhamento vertical de receitas, CMV de peças, despesas fixas/variáveis e lucro líquido.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportarCsv('DRE')}
              className="min-h-[38px] px-3.5 rounded-xl bg-sunken hover:bg-muted border border-line text-ink font-semibold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-4 h-4 text-brand-ink" aria-hidden="true" />
              <span>Baixar DRE (Excel)</span>
            </button>
          </div>

          {/* TABELA VERTICAL DE DRE ESTRUTURADA */}
          <div className="space-y-2 text-xs sm:text-sm font-mono tabular-nums">
            {/* 1. RECEITA BRUTA */}
            <div className="p-3 rounded-xl bg-sunken border border-info/60 flex items-center justify-between font-semibold">
              <span className="font-sans text-info flex items-center gap-2">
                <span>1. RECEITA BRUTA TOTAL</span>
              </span>
              <span className="text-base text-info font-semibold">
                {formatBRL(resumoFinanceiro.receitaBrutaTotal)}
              </span>
            </div>

            <div className="pl-4 pr-3 py-1.5 flex items-center justify-between text-ink-muted text-xs">
              <span className="font-sans">(+) Faturamento de Ordens de Serviço (Peças + Mão de Obra)</span>
              <span>{formatBRL(resumoFinanceiro.faturamentoOS)}</span>
            </div>

            {resumoFinanceiro.receitasAvulsasRecebidas > 0 && (
              <div className="pl-4 pr-3 py-1.5 flex items-center justify-between text-ink-muted text-xs">
                <span className="font-sans">(+) Receitas Avulsas Liquidadas (Aportes, Sucata, etc.)</span>
                <span>{formatBRL(resumoFinanceiro.receitasAvulsasRecebidas)}</span>
              </div>
            )}

            {/* 2. CUSTO VARIÁVEL (CMV) */}
            <div className="p-3 rounded-xl bg-sunken border border-danger flex items-center justify-between font-semibold">
              <span className="font-sans text-danger">
                2. (-) CUSTOS VARIÁVEIS DIRETOS (CMV / PEÇAS DAS OS)
              </span>
              <span className="text-danger font-semibold">
                &minus; {formatBRL(resumoFinanceiro.custoPecasOS)}
              </span>
            </div>

            {/* 3. LUCRO BRUTO */}
            <div className="p-3.5 rounded-xl bg-warning/40 border-2 border-warning/70 flex items-center justify-between font-semibold">
              <div className="font-sans">
                <span className="text-warning">3. (=) LUCRO BRUTO OPERACIONAL</span>
                <span className="ml-2 text-xs text-warning font-mono">
                  (Margem Bruta: {resumoFinanceiro.margemBruta.toFixed(1)}%)
                </span>
              </div>
              <span className="text-base text-warning font-semibold">
                {formatBRL(resumoFinanceiro.lucroBrutoOperacional)}
              </span>
            </div>

            {/* 4. DESPESAS OPERACIONAIS / CONTAS A PAGAR */}
            <div className="p-3 rounded-xl bg-sunken border border-danger flex items-center justify-between font-semibold mt-2">
              <span className="font-sans text-danger">
                4. (-) DESPESAS OPERACIONAIS LIQUIDADAS (CONTAS PAGAS)
              </span>
              <span className="text-danger font-semibold">
                &minus; {formatBRL(resumoFinanceiro.despesasPagas)}
              </span>
            </div>

            {/* Detalhamento por Categoria de Despesa */}
            {Object.keys(resumoFinanceiro.despesasPorCategoria).length === 0 ? (
              <div className="pl-4 pr-3 py-1 text-ink-subtle text-xs italic font-sans">
                Nenhuma conta a pagar liquidada no período.
              </div>
            ) : (
              Object.entries(resumoFinanceiro.despesasPorCategoria).map(([cat, val]) => (
                <div
                  key={cat}
                  className="pl-4 pr-3 py-1 flex items-center justify-between text-ink-subtle text-xs"
                >
                  <span className="font-sans">(&minus;) {cat}</span>
                  <span>&minus; {formatBRL(val)}</span>
                </div>
              ))
            )}

            {/* 5. LUCRO LÍQUIDO REAL */}
            <div className="p-4 rounded-xl bg-sunken border-2 border-success flex items-center justify-between font-semibold shadow-lg shadow-success/40 mt-3">
              <div className="font-sans">
                <span className="text-base sm:text-lg text-success font-semibold block">
                  5. (=) LUCRO LÍQUIDO REAL DO PERÍODO
                </span>
                <span className="text-xs text-ink-muted">
                  Sobrou no caixa após todas as peças e contas pagas
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl sm:text-2xl text-success font-semibold font-mono">
                  {formatBRL(resumoFinanceiro.lucroLiquidoReal)}
                </span>
                <div className="text-xs font-mono text-success">
                  Margem Líquida: {resumoFinanceiro.margemLiquida.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 3: GESTÃO DE CONTAS A PAGAR & RECEITAS AVULSAS
          ======================================================== */}
      {activeTab === 'contas' && (
        <div className="space-y-3.5">
          {/* BARRA DE FILTROS & AÇÕES DE LANÇAMENTOS */}
          <div className="bg-surface border-2 border-line rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <search className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-ink-subtle" aria-hidden="true" />
                <input
                  type="search"
                  value={buscaTransacao}
                  onChange={(e) => setBuscaTransacao(e.target.value)}
                  placeholder="Buscar lançamento por descrição, categoria…"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="w-full min-h-[40px] pl-9 pr-3 bg-sunken border border-line rounded-xl text-ink text-xs sm:text-sm"
                />
              </search>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => abrirModalCadastroTransacao('DESPESA')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-danger-solid hover:bg-danger-solid text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Despesa</span>
                </button>

                <button
                  type="button"
                  onClick={() => abrirModalCadastroTransacao('RECEITA')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-success-solid hover:bg-success-solid text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Receita</span>
                </button>
              </div>
            </div>

            {/* SUB-FILTROS DE TIPO E STATUS */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-xs">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'TODAS', label: 'Todas as Contas' },
                    { id: 'DESPESA', label: 'A Pagar (Despesas)' },
                    { id: 'RECEITA', label: 'A Receber (Avulsas)' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroTipoTransacao(f.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                      filtroTipoTransacao === f.id
                        ? 'bg-muted text-ink'
                        : 'bg-sunken text-ink-muted border border-line'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'TODAS', label: 'Todos Status' },
                    { id: 'PENDENTE', label: 'Pendentes' },
                    { id: 'LIQUIDADO', label: 'Pagas / Recebidas' },
                    { id: 'ATRASADO', label: 'Atrasadas' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFiltroStatusTransacao(s.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer text-xs transition-colors ${
                      filtroStatusTransacao === s.id
                        ? 'bg-brand text-on-brand'
                        : 'bg-sunken text-ink-muted border border-line'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* LISTA DE TRANSAÇÕES */}
          {transacoesFiltradas.length === 0 ? (
            <div className="bg-surface border-2 border-line rounded-xl p-8 text-center text-ink-subtle space-y-2">
              <CreditCard className="w-8 h-8 text-ink-subtle mx-auto" />
              <p className="text-sm font-semibold text-ink">Nenhum lançamento no filtro atual</p>
              <p className="text-xs text-ink-subtle">
                Cadastre contas de aluguel, luz, taxas, folha de pagamento ou aportes para controlar seu fluxo.
              </p>
            </div>
          ) : (
            <div className="bg-sunken border-2 border-line rounded-xl divide-y divide-line">
              {transacoesFiltradas.map((t) => {
                const isDespesa = t.tipo === 'DESPESA';
                const isLiquidado = t.status === 'LIQUIDADO';
                const isAtrasado = t.status === 'ATRASADO';

                return (
                  <article
                    key={t.id}
                    className="p-3 sm:px-4 sm:py-3 hover:bg-surface/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    {/* Linha 1: Descrição e Badges */}
                    <div className="min-w-0 sm:flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            isDespesa
                              ? 'bg-danger/15 text-danger border border-danger'
                              : 'bg-success/15 text-success border border-success'
                          }`}
                        >
                          {isDespesa ? 'A PAGAR' : 'A RECEBER'}
                        </span>

                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-surface text-ink-muted border border-line">
                          {t.categoria}
                        </span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            isLiquidado
                              ? 'bg-success/15 text-success border border-success'
                              : isAtrasado
                              ? 'bg-danger/15 text-danger border border-danger animate-pulse'
                              : 'bg-warning/15 text-warning border border-warning'
                          }`}
                        >
                          {isLiquidado
                            ? isDespesa
                              ? 'PAGO'
                              : 'RECEBIDO'
                            : isAtrasado
                            ? 'ATRASADO'
                            : 'PENDENTE'}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-ink break-words">
                        {t.descricao}
                      </h4>

                      <div className="text-xs text-ink-subtle font-mono">
                        Vencimento: <strong>{formatData(t.data_vencimento)}</strong>
                        {t.data_liquidacao && (
                          <span className="ml-2 text-success">
                            &bull; Liquidado em: {formatData(t.data_liquidacao)}
                          </span>
                        )}
                        {t.observacoes && <span className="ml-2">&bull; {t.observacoes}</span>}
                      </div>
                    </div>

                    {/* Linha 2 (Mobile) / Lado Direito: Valor e Ações */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
                      <div className="text-right font-mono tabular-nums">
                        <div
                          className={`text-base sm:text-lg font-semibold ${
                            isDespesa ? 'text-danger' : 'text-success'
                          }`}
                        >
                          {isDespesa ? '-' : '+'} {formatBRL(t.valor)}
                        </div>
                        {t.forma_pagamento && (
                          <div className="text-xs text-ink-subtle">{t.forma_pagamento}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isLiquidado && (
                          <button
                            type="button"
                            onClick={() => handleLiquidar(t)}
                            title={isDespesa ? 'Marcar como Pago' : 'Marcar como Recebido'}
                            className="h-8 px-2.5 rounded-lg bg-success-solid hover:bg-success-solid text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span className="hidden sm:inline">
                              {isDespesa ? 'Pagar' : 'Receber'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => abrirModalEdicaoTransacao(t)}
                          title="Editar Lançamento"
                          aria-label={`Editar ${t.descricao}`}
                          className="w-8 h-8 rounded-lg bg-surface hover:bg-muted border border-line-strong text-warning flex items-center justify-center cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setItemParaExcluir(t)}
                          title="Excluir Lançamento"
                          aria-label={`Excluir ${t.descricao}`}
                          className="w-8 h-8 rounded-lg bg-danger/60 hover:bg-danger/15 border border-danger text-danger flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          ABA 4: BI & INTELIGÊNCIA ESTRATÉGICA DA OFICINA
          ======================================================== */}
      {activeTab === 'bi' && (
        <div className="space-y-4">
          {/* CARDS DE EFICIÊNCIA OPERACIONAL */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-surface border-2 border-line rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-ink-subtle text-xs font-semibold">Ticket Médio por OS</span>
              <div className="text-xl sm:text-2xl font-semibold font-mono text-ink mt-1 tabular-nums">
                {formatBRL(dadosFinanceiros?.ticket_medio)}
              </div>
              <span className="text-xs text-ink-subtle">Gasto médio por veículo</span>
            </div>

            <div className="bg-surface border-2 border-line rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-ink-subtle text-xs font-semibold">Taxa de Conversão</span>
              <div className="text-xl sm:text-2xl font-semibold font-mono text-success mt-1 tabular-nums">
                {biData?.taxa_conversao_orcamentos ?? 0}%
              </div>
              <span className="text-xs text-ink-subtle">Orçamentos que viraram serviço</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-surface border-2 border-line rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-ink-subtle text-xs font-semibold">Giro Médio no Pátio</span>
              <div className="text-xl sm:text-2xl font-semibold font-mono text-warning mt-1 tabular-nums">
                {biData?.lead_time_medio_horas ?? 0}h
              </div>
              <span className="text-xs text-ink-subtle">Tempo médio de permanência</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RANKING DE PRODUTIVIDADE POR MECÂNICO */}
            <div className="bg-surface border-2 border-line rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-ink flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-brand-ink" aria-hidden="true" />
                  <span>Produtividade &amp; Lucro por Mecânico</span>
                </h3>
                <span className="text-xs text-ink-subtle font-mono">
                  {biData?.produtividade_mecanicos?.length || 0} profissionais
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(biData?.produtividade_mecanicos || []).length === 0 ? (
                  <p className="text-ink-subtle text-xs py-4 text-center">Nenhum mecânico com OS finalizada.</p>
                ) : (
                  biData?.produtividade_mecanicos.map((mec, idx) => (
                    <div
                      key={mec.nome}
                      className="p-2.5 rounded-xl bg-sunken border border-line flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-surface text-ink-muted font-semibold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <strong className="text-ink block">{mec.nome}</strong>
                          <span className="text-ink-subtle text-xs">{mec.qtd_os} OS entregues</span>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums">
                        <div className="text-success font-semibold">
                          Lucro: {formatBRL(mec.lucro_gerado)}
                        </div>
                        <div className="text-ink-subtle text-xs">
                          Fat: {formatBRL(mec.faturamento_gerado)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FORMAS DE PAGAMENTO UTILIZADAS */}
            <div className="bg-surface border-2 border-line rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-ink flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-info" aria-hidden="true" />
                  <span>Distribuição por Meio de Pagamento</span>
                </h3>
              </div>

              <div className="space-y-2.5">
                {(biData?.metodos_pagamento || []).length === 0 ? (
                  <p className="text-ink-subtle text-xs py-4 text-center">Nenhum pagamento registrado no período.</p>
                ) : (
                  biData?.metodos_pagamento.map((mp) => {
                    const totalGeral = biData.metodos_pagamento.reduce(
                      (acc, i) => acc + i.valor_total,
                      0
                    );
                    const pct = totalGeral > 0 ? (mp.valor_total / totalGeral) * 100 : 0;

                    return (
                      <div key={mp.forma} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-ink-muted">
                          <span className="font-semibold text-ink">{mp.forma}</span>
                          <span className="font-mono tabular-nums">
                            {formatBRL(mp.valor_total)} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-sunken overflow-hidden">
                          <div
                            className="h-full bg-info rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RENTABILIDADE POR MARCA DE VEÍCULO */}
            <div className="bg-surface border-2 border-line rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-ink flex items-center gap-2">
                  <Car className="w-4 h-4 text-warning" aria-hidden="true" />
                  <span>Rentabilidade por Marca de Veículo</span>
                </h3>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(biData?.rentabilidade_marcas || []).length === 0 ? (
                  <p className="text-ink-subtle text-xs py-4 text-center">Nenhum veículo faturado.</p>
                ) : (
                  biData?.rentabilidade_marcas.map((marca) => (
                    <div
                      key={marca.marca}
                      className="p-2.5 rounded-xl bg-sunken border border-line flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-ink block uppercase">{marca.marca}</strong>
                        <span className="text-ink-subtle text-xs">{marca.qtd_os} veículos atendidos</span>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-success font-semibold">{formatBRL(marca.lucro)}</div>
                        <div className="text-ink-subtle text-xs">Fat: {formatBRL(marca.faturamento)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TOP 10 CLIENTES (CURVA ABC) */}
            <div className="bg-surface border-2 border-line rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-ink flex items-center gap-2">
                  <Users className="w-4 h-4 text-success" aria-hidden="true" />
                  <span>Top Clientes Mais Lucrativos (Curva ABC)</span>
                </h3>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(biData?.top_10_clientes || []).length === 0 ? (
                  <p className="text-ink-subtle text-xs py-4 text-center">Nenhum cliente faturado no período.</p>
                ) : (
                  biData?.top_10_clientes.map((cli, idx) => (
                    <div
                      key={cli.nome}
                      className="p-2.5 rounded-xl bg-sunken border border-line flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-success/15 text-success font-semibold flex items-center justify-center text-xs border border-success">
                          {idx + 1}
                        </span>
                        <div>
                          <strong className="text-ink block">{cli.nome}</strong>
                          <span className="text-ink-subtle text-xs">{cli.qtd_os} OS atendidas</span>
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-success font-semibold">
                          Lucro: {formatBRL(cli.lucro)}
                        </div>
                        <div className="text-ink-subtle text-xs">
                          Total: {formatBRL(cli.faturamento)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO / EDIÇÃO DE TRANSAÇÃO (DESPESA OU RECEITA AVULSA) */}
      {modalTransacaoAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-surface border-2 border-brand rounded-lg w-full max-w-md p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base sm:text-lg font-semibold text-ink flex items-center gap-2">
                {formTipo === 'DESPESA' ? (
                  <ArrowDownRight className="w-5 h-5 text-danger" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-success" />
                )}
                <span>
                  {transacaoEmEdicao
                    ? 'Editar Lançamento'
                    : formTipo === 'DESPESA'
                    ? 'Nova Conta a Pagar'
                    : 'Nova Receita / Aporte'}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setModalTransacaoAberto(false)}
                className="text-ink-subtle hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarTransacao} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-ink mb-1">
                  Descrição do Lançamento *
                </label>
                <input
                  type="text"
                  required
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder={
                    formTipo === 'DESPESA'
                      ? 'Ex: Aluguel do Galpão, Conta de Luz Enel…'
                      : 'Ex: Aporte Sócio Roberto, Venda de Sucata/Baterias…'
                  }
                  className="w-full min-h-[42px] px-3 bg-sunken border border-line rounded-xl text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Categoria *</label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-sunken border border-line rounded-xl text-ink font-semibold"
                  >
                    {(formTipo === 'DESPESA' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA).map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    required
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full min-h-[42px] px-3 bg-sunken border border-line rounded-xl text-ink font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={formVencimento}
                    onChange={(e) => setFormVencimento(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-sunken border border-line rounded-xl text-ink font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formForma}
                    onChange={(e) => setFormForma(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-sunken border border-line rounded-xl text-ink"
                  >
                    {FORMAS_PAGAMENTO.map((fp) => (
                      <option key={fp} value={fp}>
                        {fp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Observações / Detalhes</label>
                <input
                  type="text"
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  placeholder="Número de nota fiscal, recibo ou detalhes…"
                  className="w-full min-h-[42px] px-3 bg-sunken border border-line rounded-xl text-ink"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-sunken border border-line">
                <input
                  type="checkbox"
                  id="chk-ja-liquidado"
                  checked={formJaPago}
                  onChange={(e) => setFormJaPago(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-ink cursor-pointer"
                />
                <label
                  htmlFor="chk-ja-liquidado"
                  className="text-xs font-semibold text-ink cursor-pointer select-none"
                >
                  {formTipo === 'DESPESA'
                    ? 'Já foi paga hoje (dar baixa imediata no caixa)'
                    : 'Já foi recebida hoje (caiu na conta)'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setModalTransacaoAberto(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-surface text-ink font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoTransacao}
                  className="min-h-[42px] px-5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-semibold cursor-pointer disabled:opacity-50"
                >
                  {salvandoTransacao ? 'Salvando…' : 'Salvar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO */}
      {itemParaExcluir && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border-2 border-danger rounded-lg w-full max-w-sm p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/15 border border-danger text-danger flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">Excluir Lançamento?</h3>
                <p className="text-xs text-ink-subtle">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <div className="p-3 bg-sunken rounded-xl border border-line">
              <div className="text-sm font-semibold text-ink">{itemParaExcluir.descricao}</div>
              <div className="text-xs text-ink-subtle font-mono mt-0.5">
                Valor: {formatBRL(itemParaExcluir.valor)} &bull; Venc: {formatData(itemParaExcluir.data_vencimento)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemParaExcluir(null)}
                className="min-h-[42px] px-4 rounded-xl bg-surface text-ink font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={handleConfirmarExclusao}
                className="min-h-[42px] px-4.5 rounded-xl bg-danger-solid hover:bg-danger-solid text-white font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                {excluindo ? 'Excluindo…' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
