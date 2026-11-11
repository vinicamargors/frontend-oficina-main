import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { hojeLocalISO } from '../lib/data';
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
  Download,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { Button, CLASSE_CAMPO, Field, PageHeader, Panel, Tabs, type TabItem } from '../components/ui';
import { Folha } from '../components/Folha';
import {
  formatBRL,
  formatData,
  intervaloDoAtalho,
  rotuloCategoriaFinanceira,
  rotuloPeriodo,
  valorComSinal,
  type AtalhoPeriodo,
} from './financeiro/auxiliares';
import { SeletorPeriodo } from './financeiro/SeletorPeriodo';
import { ResumoPeriodo } from './financeiro/ResumoPeriodo';
import { AbaBalanco } from './financeiro/AbaBalanco';
import { AbaDre } from './financeiro/AbaDre';
import { AbaContas } from './financeiro/AbaContas';
import { AbaBi } from './financeiro/AbaBi';

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
// A baixa oferece as mesmas formas do lançamento (inclui TED, que a lista da OS não tem)
const FORMAS_BAIXA = FORMAS_PAGAMENTO;

// Aba Contas leva em texto quantas despesas estão pendentes/atrasadas (antes: ponto vermelho só de cor)
const montarAbas = (despesasEmAberto: number): TabItem[] => [
  { id: 'balanco', rotulo: 'Balanço' },
  { id: 'dre', rotulo: 'DRE' },
  { id: 'contas', rotulo: despesasEmAberto > 0 ? `Contas · ${despesasEmAberto}` : 'Contas' },
  { id: 'bi', rotulo: 'BI' },
];

const NOME_ABA: Record<TabFinanceiro, string> = {
  balanco: 'o balanço',
  dre: 'a DRE',
  contas: 'os lançamentos',
  bi: 'o BI',
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
  // Mesmo intervalo do atalho "Últimos 30 dias", no calendário local
  const [dataInicio, setDataInicio] = useState<string>(() => intervaloDoAtalho('30D').inicio);
  const [dataFim, setDataFim] = useState<string>(() => intervaloDoAtalho('30D').fim);

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
  const [formVencimento, setFormVencimento] = useState(hojeLocalISO);
  const [formForma, setFormForma] = useState('PIX');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formJaPago, setFormJaPago] = useState(false);

  // Modal Confirmação Exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<TransacaoFinanceira | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  // Confirmação de Baixa (nenhuma baixa com um toque só)
  const [itemParaBaixa, setItemParaBaixa] = useState<TransacaoFinanceira | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [erroBaixa, setErroBaixa] = useState<string | null>(null);
  // Forma escolhida na folha: parte do que o lançamento já guarda; sem nada guardado, fica vazia até alguém escolher.
  const [formaBaixa, setFormaBaixa] = useState<string | null>(null);

  // Formulário: erro de validação na própria folha e confirmação de descarte com dados digitados
  const [formErro, setFormErro] = useState<string | null>(null);
  const [formInicial, setFormInicial] = useState('');
  const [descartePendente, setDescartePendente] = useState(false);

  // Atalhos de Período
  const aplicarAtalhoPeriodo = (atalho: AtalhoPeriodo) => {
    setPeriodoAtalho(atalho);
    const { inicio, fim } = intervaloDoAtalho(atalho);
    setDataInicio(inicio);
    setDataFim(fim);
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

  // Retrato dos campos do formulário, para saber se há algo digitado a perder
  const retratoFormulario = (c: {
    tipo: TipoTransacao;
    descricao: string;
    categoria: string;
    valor: string;
    vencimento: string;
    forma: string;
    observacoes: string;
    jaPago: boolean;
  }) => JSON.stringify(c);

  // Modal Abrir Cadastro
  const abrirModalCadastroTransacao = (tipo: TipoTransacao) => {
    const campos = {
      tipo,
      descricao: '',
      categoria: tipo === 'DESPESA' ? 'ALUGUEL' : 'APORTE',
      valor: '',
      vencimento: hojeLocalISO(),
      forma: 'PIX',
      observacoes: '',
      jaPago: false,
    };
    setTransacaoEmEdicao(null);
    setFormTipo(campos.tipo);
    setFormDescricao(campos.descricao);
    setFormCategoria(campos.categoria);
    setFormValor(campos.valor);
    setFormVencimento(campos.vencimento);
    setFormForma(campos.forma);
    setFormObservacoes(campos.observacoes);
    setFormJaPago(campos.jaPago);
    setFormInicial(retratoFormulario(campos));
    setFormErro(null);
    setErro(null);
    setModalTransacaoAberto(true);
  };

  const abrirModalEdicaoTransacao = (t: TransacaoFinanceira) => {
    const campos = {
      tipo: t.tipo,
      descricao: t.descricao,
      categoria: t.categoria,
      valor: String(t.valor),
      vencimento: t.data_vencimento,
      forma: t.forma_pagamento || 'PIX',
      observacoes: t.observacoes || '',
      jaPago: t.status === 'LIQUIDADO',
    };
    setTransacaoEmEdicao(t);
    setFormTipo(campos.tipo);
    setFormDescricao(campos.descricao);
    setFormCategoria(campos.categoria);
    setFormValor(campos.valor);
    setFormVencimento(campos.vencimento);
    setFormForma(campos.forma);
    setFormObservacoes(campos.observacoes);
    setFormJaPago(campos.jaPago);
    setFormInicial(retratoFormulario(campos));
    setFormErro(null);
    setErro(null);
    setModalTransacaoAberto(true);
  };

  // Troca de tipo no cadastro: mesma categoria padrão de quando o formulário abre com o tipo
  const trocarTipoFormulario = (tipo: TipoTransacao) => {
    setFormTipo(tipo);
    setFormCategoria(tipo === 'DESPESA' ? 'ALUGUEL' : 'APORTE');
  };

  const formularioSujo =
    modalTransacaoAberto &&
    retratoFormulario({
      tipo: formTipo,
      descricao: formDescricao,
      categoria: formCategoria,
      valor: formValor,
      vencimento: formVencimento,
      forma: formForma,
      observacoes: formObservacoes,
      jaPago: formJaPago,
    }) !== formInicial;

  useEffect(() => {
    if (!modalTransacaoAberto) setDescartePendente(false);
  }, [modalTransacaoAberto]);

  const sairDoFormulario = () => {
    if (formularioSujo) setDescartePendente(true);
    else setModalTransacaoAberto(false);
  };

  // Salvar Transação
  const handleSalvarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErro(null);
    if (!formDescricao.trim()) {
      setFormErro('Informe a descrição.');
      return;
    }
    const val = parseFloat(formValor.replace(',', '.')) || 0;
    if (val <= 0) {
      setFormErro('Informe um valor válido maior que zero.');
      return;
    }

    try {
      setSalvandoTransacao(true);
      const hoje = hojeLocalISO();
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

  // Dar Baixa / Liquidar (true = gravou; o erro fica na folha de confirmação)
  const handleLiquidar = async (t: TransacaoFinanceira, forma: string): Promise<boolean> => {
    try {
      const atualizada = await api.liquidarTransacaoFinanceira(
        empresaId,
        t.id,
        forma
      );
      setTransacoes((prev) =>
        prev.map((item) => (item.id === atualizada.id ? atualizada : item))
      );
      dispararFeedback(
        `"${t.descricao}" marcado como ${t.tipo === 'DESPESA' ? 'PAGO' : 'RECEBIDO'} com sucesso!`
      );
      return true;
    } catch {
      setErroBaixa('Erro ao dar baixa no lançamento. Nada foi alterado; tente de novo.');
      return false;
    }
  };

  // Excluir
  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir) return;
    try {
      setExcluindo(true);
      setErroExclusao(null);
      await api.deletarTransacaoFinanceira(empresaId, itemParaExcluir.id);
      setTransacoes((prev) => prev.filter((i) => i.id !== itemParaExcluir.id));
      dispararFeedback(`"${itemParaExcluir.descricao}" removido.`);
      setItemParaExcluir(null);
    } catch {
      setErroExclusao('Erro ao excluir transação. Nada foi apagado; tente de novo.');
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


  // Dar baixa só depois da confirmação na folha (mesma chamada de antes)
  const confirmarBaixa = async () => {
    if (!itemParaBaixa || !formaBaixa) return;
    setBaixando(true);
    setErroBaixa(null);
    const ok = await handleLiquidar(itemParaBaixa, formaBaixa);
    setBaixando(false);
    if (ok) setItemParaBaixa(null);
  };

  const exportarAbaAtual = () => {
    if (activeTab === 'dre') handleExportarCsv('DRE');
    else if (activeTab === 'contas') handleExportarCsv('CONTAS');
    else if (activeTab === 'bi') handleExportarCsv('BI');
    else handleExportarCsv('BALANCO');
  };

  const periodoTexto = rotuloPeriodo(periodoAtalho, dataInicio, dataFim);

  const alertaErro = (mensagem: string) => (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{mensagem}</span>
    </p>
  );

  if (!canSeeFinanceiro) {
    return (
      <div>
        <PageHeader titulo="Caixa & financeiro" />
        <Panel espaco="lg" className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-10 w-10 text-danger" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink text-balance">Acesso restrito ao módulo financeiro</h2>
          <p className="text-sm text-ink-muted text-pretty">
            Este painel contém informações estratégicas, DRE, margens e dados contábeis da oficina.
            Seu perfil ({user?.cargo}) não possui permissão para visualizar estes números.
          </p>
        </Panel>
      </div>
    );
  }

  const categoriasDoTipo = formTipo === 'DESPESA' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;
  // Categoria gravada fora da lista padrão (ex.: vinda do backend) continua visível e selecionada
  const opcoesCategoria = categoriasDoTipo.includes(formCategoria)
    ? categoriasDoTipo
    : [formCategoria, ...categoriasDoTipo];

  const baixaDespesa = itemParaBaixa?.tipo === 'DESPESA';
  const despesasEmAberto = transacoes.filter(
    (t) => t.tipo === 'DESPESA' && (t.status === 'PENDENTE' || t.status === 'ATRASADO')
  ).length;

  return (
    <div>
      <PageHeader
        titulo="Caixa & financeiro"
        abaixo={
          <span className="hidden sm:inline">
            Caixa, contas a pagar e receber, DRE e indicadores da oficina.
          </span>
        }
        acoes={
          <>
            <Button icone={Plus} onClick={() => abrirModalCadastroTransacao('DESPESA')}>
              Novo lançamento
            </Button>
            <Button
              variante="secundario"
              icone={Download}
              onClick={exportarAbaAtual}
              title={`Exportar ${NOME_ABA[activeTab]} em CSV (Excel)`}
              aria-label="Exportar CSV"
            >
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Button
              variante="secundario"
              icone={RefreshCw}
              onClick={carregarDados}
              carregando={carregando}
              title="Atualizar dados financeiros"
              aria-label="Atualizar dados financeiros"
            />
          </>
        }
      />

      <SeletorPeriodo
        atalho={periodoAtalho}
        dataInicio={dataInicio}
        dataFim={dataFim}
        aoEscolherAtalho={aplicarAtalhoPeriodo}
        aoPersonalizar={() => setPeriodoAtalho('CUSTOM')}
        aoMudarInicio={(v) => {
          setDataInicio(v);
          setPeriodoAtalho('CUSTOM');
        }}
        aoMudarFim={(v) => {
          setDataFim(v);
          setPeriodoAtalho('CUSTOM');
        }}
      />

      <div aria-live="polite">
        {sucessoMsg && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{sucessoMsg}</span>
          </p>
        )}
      </div>
      {erro && !modalTransacaoAberto && <div className="mb-4">{alertaErro(erro)}</div>}

      <ResumoPeriodo
        periodo={periodoTexto}
        carregando={carregando && !dadosFinanceiros}
        lucroLiquido={resumoFinanceiro.lucroLiquidoReal}
        margemLiquida={resumoFinanceiro.margemLiquida}
        entradas={resumoFinanceiro.caixaTotal}
        aReceber={resumoFinanceiro.totalAReceber}
        despesasPagas={resumoFinanceiro.despesasPagas}
        despesasPendentes={resumoFinanceiro.despesasPendentes}
      />

      <div className="mb-4">
        <Tabs
          itens={montarAbas(despesasEmAberto)}
          ativo={activeTab}
          aoMudar={(id) => setActiveTab(id as TabFinanceiro)}
          rotuloGrupo="Seções do financeiro"
          idPainel="painel-financeiro"
        />
      </div>

      <div role="tabpanel" id="painel-financeiro" aria-labelledby={`aba-${activeTab}`}>
        {activeTab === 'balanco' && (
          <AbaBalanco
            caixaTotal={resumoFinanceiro.caixaTotal}
            totalAReceber={resumoFinanceiro.totalAReceber}
            patrimonioEstoque={patrimonioEstoque}
            totalAtivo={resumoFinanceiro.totalAtivo}
            totalPassivo={resumoFinanceiro.totalPassivo}
            posicaoLiquida={resumoFinanceiro.posicaoLiquida}
          />
        )}

        {activeTab === 'dre' && (
          <AbaDre
            periodo={periodoTexto}
            receitaBrutaTotal={resumoFinanceiro.receitaBrutaTotal}
            faturamentoOS={resumoFinanceiro.faturamentoOS}
            receitasAvulsasRecebidas={resumoFinanceiro.receitasAvulsasRecebidas}
            custoPecasOS={resumoFinanceiro.custoPecasOS}
            lucroBrutoOperacional={resumoFinanceiro.lucroBrutoOperacional}
            margemBruta={resumoFinanceiro.margemBruta}
            despesasPagas={resumoFinanceiro.despesasPagas}
            despesasPorCategoria={resumoFinanceiro.despesasPorCategoria}
            lucroLiquidoReal={resumoFinanceiro.lucroLiquidoReal}
            margemLiquida={resumoFinanceiro.margemLiquida}
          />
        )}

        {activeTab === 'contas' && (
          <AbaContas
            totalNoPeriodo={transacoes.length}
            transacoes={transacoesFiltradas}
            busca={buscaTransacao}
            filtroTipo={filtroTipoTransacao}
            filtroStatus={filtroStatusTransacao}
            aoBuscar={setBuscaTransacao}
            aoFiltrarTipo={setFiltroTipoTransacao}
            aoFiltrarStatus={setFiltroStatusTransacao}
            aoLimparFiltros={() => {
              setBuscaTransacao('');
              setFiltroTipoTransacao('TODAS');
              setFiltroStatusTransacao('TODAS');
            }}
            aoNovo={() => abrirModalCadastroTransacao('DESPESA')}
            aoDarBaixa={(t) => {
              setErroBaixa(null);
              setFormaBaixa(t.forma_pagamento || null);
              setItemParaBaixa(t);
            }}
            aoEditar={abrirModalEdicaoTransacao}
            aoExcluir={(t) => {
              setErroExclusao(null);
              setItemParaExcluir(t);
            }}
          />
        )}

        {activeTab === 'bi' && <AbaBi ticketMedio={dadosFinanceiros?.ticket_medio} bi={biData} />}
      </div>

      {/* FOLHA: CADASTRO / EDIÇÃO DE LANÇAMENTO (DESPESA OU RECEITA AVULSA) */}
      <Folha
        aberto={modalTransacaoAberto}
        focoInicial="primeiro-campo"
        tamanho="lg"
        fecharNoFundo={false}
        titulo={transacaoEmEdicao ? 'Editar lançamento' : 'Novo lançamento'}
        aoCancelar={sairDoFormulario}
      >
        {descartePendente && (
          <div role="alert" ref={(el) => el?.scrollIntoView({ block: 'nearest' })} className="space-y-3 rounded-xl bg-warning/15 p-4">
            <p className="text-sm font-medium text-ink">Descartar alterações? O que você digitou será perdido.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" onClick={() => setDescartePendente(false)}>
                Continuar editando
              </Button>
              <Button
                variante="perigo"
                onClick={() => {
                  setDescartePendente(false);
                  setModalTransacaoAberto(false);
                }}
              >
                Descartar
              </Button>
            </div>
          </div>
        )}
        {erro && alertaErro(erro)}
        <form onSubmit={handleSalvarTransacao} className="space-y-5">
          {transacaoEmEdicao ? (
            <p className="text-sm text-ink-muted">
              {formTipo === 'DESPESA' ? 'Despesa (a pagar)' : 'Receita (a receber)'}
            </p>
          ) : (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Tipo de lançamento</legend>
              <div className="flex w-full gap-1 rounded-full bg-muted p-1 sm:inline-flex sm:w-auto">
                {(
                  [
                    { id: 'DESPESA', rotulo: 'Despesa (a pagar)' },
                    { id: 'RECEITA', rotulo: 'Receita (a receber)' },
                  ] as const
                ).map((op) => (
                  <label
                    key={op.id}
                    className={`relative inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-brand md:min-h-9 ${
                      formTipo === op.id ? 'bg-surface text-ink shadow-card dark:bg-line' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo-lancamento"
                      value={op.id}
                      checked={formTipo === op.id}
                      onChange={() => trocarTipoFormulario(op.id)}
                      className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
                    />
                    {op.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <Field rotulo="Descrição *">
            <input
              type="text"
              required
              value={formDescricao}
              onChange={(e) => setFormDescricao(e.target.value)}
              placeholder={
                formTipo === 'DESPESA'
                  ? 'Ex: Aluguel do galpão, conta de luz…'
                  : 'Ex: Aporte do sócio, venda de sucata…'
              }
              className={CLASSE_CAMPO}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field rotulo="Categoria *">
              <select value={formCategoria} onChange={(e) => setFormCategoria(e.target.value)} className={CLASSE_CAMPO}>
                {opcoesCategoria.map((cat) => (
                  <option key={cat} value={cat}>
                    {rotuloCategoriaFinanceira(cat)}
                  </option>
                ))}
              </select>
            </Field>
            <Field rotulo="Valor (R$) *">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0.01}
                required
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
                placeholder="0,00"
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field rotulo="Vencimento *">
              <input
                type="date"
                required
                value={formVencimento}
                onChange={(e) => setFormVencimento(e.target.value)}
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </Field>
            <Field rotulo="Forma de pagamento">
              <select value={formForma} onChange={(e) => setFormForma(e.target.value)} className={CLASSE_CAMPO}>
                {FORMAS_PAGAMENTO.map((fp) => (
                  <option key={fp} value={fp}>
                    {fp}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field rotulo="Observações">
            <input
              type="text"
              value={formObservacoes}
              onChange={(e) => setFormObservacoes(e.target.value)}
              placeholder="Nota fiscal, recibo ou detalhes…"
              className={CLASSE_CAMPO}
            />
          </Field>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={formJaPago}
              onChange={(e) => setFormJaPago(e.target.checked)}
              className="h-5 w-5 shrink-0 cursor-pointer accent-brand"
            />
            <span>
              {formTipo === 'DESPESA'
                ? 'Já foi paga (baixa no caixa com a data do vencimento)'
                : 'Já foi recebida (caiu na conta, com a data do vencimento)'}
            </span>
          </label>

          {formErro && alertaErro(formErro)}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={sairDoFormulario}>
              Cancelar
            </Button>
            <Button type="submit" carregando={salvandoTransacao}>
              {salvandoTransacao ? 'Salvando…' : 'Salvar lançamento'}
            </Button>
          </div>
        </form>
      </Folha>

      {/* FOLHA: CONFIRMAÇÃO DE BAIXA (PAGO / RECEBIDO) */}
      <Folha
        aberto={itemParaBaixa !== null}
        titulo="Dar baixa no lançamento?"
        bloquearFechar={baixando}
        aoCancelar={() => !baixando && setItemParaBaixa(null)}
      >
        {itemParaBaixa && (
          <>
            <div>
              <p className="text-sm font-medium text-ink">{itemParaBaixa.descricao}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${baixaDespesa ? 'text-danger' : 'text-success'}`}>
                {valorComSinal(itemParaBaixa.valor, itemParaBaixa.tipo)}
              </p>
              <p className="mt-1 text-sm tabular-nums text-ink-muted">
                Vencimento {formatData(itemParaBaixa.data_vencimento)}
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                {baixaDespesa
                  ? 'O lançamento será marcado como pago hoje e sai do contas a pagar.'
                  : 'O lançamento será marcado como recebido hoje e entra no caixa.'}
              </p>
            </div>
            <fieldset className="space-y-2" disabled={baixando}>
              <legend className="mb-2 text-sm font-medium text-ink">Forma de pagamento</legend>
              {(formaBaixa && !FORMAS_BAIXA.includes(formaBaixa) ? [formaBaixa, ...FORMAS_BAIXA] : FORMAS_BAIXA).map((fp) => {
                const marcada = formaBaixa === fp;
                return (
                  <label
                    key={fp}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                      marcada ? 'bg-brand/15 text-ink' : 'bg-muted text-ink hover:bg-line'
                    }`}
                  >
                    <input
                      type="radio"
                      name="forma-baixa"
                      value={fp}
                      checked={marcada}
                      onChange={() => setFormaBaixa(fp)}
                      className="h-5 w-5 shrink-0 accent-brand focus-visible:outline-none"
                    />
                    {fp}
                  </label>
                );
              })}
            </fieldset>
            {erroBaixa && alertaErro(erroBaixa)}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" disabled={baixando} onClick={() => setItemParaBaixa(null)}>
                Cancelar
              </Button>
              <Button icone={CheckCircle2} carregando={baixando} disabled={!formaBaixa} onClick={confirmarBaixa}>
                {baixaDespesa ? 'Confirmar pagamento' : 'Confirmar recebimento'}
              </Button>
            </div>
          </>
        )}
      </Folha>

      {/* FOLHA: CONFIRMAÇÃO DE EXCLUSÃO */}
      <Folha
        aberto={itemParaExcluir !== null}
        titulo="Excluir lançamento?"
        bloquearFechar={excluindo}
        aoCancelar={() => !excluindo && setItemParaExcluir(null)}
      >
        {itemParaExcluir && (
          <>
            <div>
              <p className="text-sm font-medium text-ink">{itemParaExcluir.descricao}</p>
              <p className="mt-0.5 text-sm tabular-nums text-ink-muted">
                {valorComSinal(itemParaExcluir.valor, itemParaExcluir.tipo)} &bull; Venc. {formatData(itemParaExcluir.data_vencimento)}
              </p>
              <p className="mt-3 text-sm text-ink-muted">Esta ação não poderá ser desfeita.</p>
            </div>
            {erroExclusao && alertaErro(erroExclusao)}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" disabled={excluindo} onClick={() => setItemParaExcluir(null)}>
                Cancelar
              </Button>
              <Button variante="perigo" icone={Trash2} carregando={excluindo} onClick={handleConfirmarExclusao}>
                {excluindo ? 'Excluindo…' : 'Excluir lançamento'}
              </Button>
            </div>
          </>
        )}
      </Folha>
    </div>
  );
}
