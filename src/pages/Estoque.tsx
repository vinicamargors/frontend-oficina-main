import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EstoqueItem, EstoqueCreateInput, EstoqueUpdateInput } from '../types';
import {
  Package,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Download,
  Barcode,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Printer,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  FolderPlus,
  Tag,
} from 'lucide-react';

interface EstoqueProps {
  empresaId: string;
}

const CATEGORIAS_PADRAO = [
  'PECAS',
  'FLUIDOS',
  'PNEUS',
  'ELETRICA',
  'ACESSORIOS',
  'FERRAMENTAS',
  'DIVERSOS',
];

const formatBRL = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor || 0)
  );

// Gerador vetorial nativo de Código de Barras Code 128 (padrão universal B)
// Sem nenhuma dependência externa, 100% offline e ultra-nítido na impressão térmica
function generateCode128Svg(text: string): { widths: number[]; valid: boolean } {
  const safeText = (text || 'AUTO001').slice(0, 32);
  const patterns: Record<number, string> = {
    0: '212222', 1: '222122', 2: '222221', 3: '121223', 4: '121322', 5: '131222',
    6: '122213', 7: '122312', 8: '132212', 9: '221213', 10: '221312', 11: '231212',
    12: '112232', 13: '122132', 14: '122231', 15: '113222', 16: '123122', 17: '123221',
    18: '223211', 19: '221132', 20: '221231', 21: '213212', 22: '223112', 23: '312131',
    24: '311222', 25: '321122', 26: '321221', 27: '312212', 28: '322112', 29: '322211',
    30: '212123', 31: '212321', 32: '232121', 33: '111323', 34: '131123', 35: '131321',
    36: '112313', 37: '132113', 38: '132311', 39: '211313', 40: '231113', 41: '231311',
    42: '112133', 43: '112331', 44: '132131', 45: '113123', 46: '113321', 47: '133121',
    48: '313121', 49: '211331', 50: '231131', 51: '213113', 52: '213311', 53: '213131',
    54: '311123', 55: '311321', 56: '331121', 57: '312113', 58: '312311', 59: '332111',
    60: '314111', 61: '221411', 62: '431111', 63: '111224', 64: '111422', 65: '121124',
    66: '121421', 67: '141122', 68: '141221', 69: '112214', 70: '112412', 71: '122114',
    72: '122411', 73: '142112', 74: '142211', 75: '241211', 76: '221114', 77: '413111',
    78: '241112', 79: '134111', 80: '111242', 81: '121142', 82: '121241', 83: '114212',
    84: '124112', 85: '124211', 86: '411212', 87: '421112', 88: '421211', 89: '212141',
    90: '214121', 91: '412121', 92: '111143', 93: '111341', 94: '131141', 95: '114113',
    96: '114311', 97: '411113', 98: '411311', 99: '113141', 100: '114131', 101: '311141',
    102: '411131', 103: '211412', 104: '211214', 105: '211232', 106: '2331112'
  };

  const codes: number[] = [104]; // Start B
  let checksum = 104;
  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
    const safeCode = code >= 0 && code <= 95 ? code : 0;
    codes.push(safeCode);
    checksum += safeCode * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop

  const widths: number[] = [];
  for (const c of codes) {
    const pat = patterns[c] || '212222';
    for (let j = 0; j < pat.length; j++) {
      widths.push(parseInt(pat[j], 10));
    }
  }

  return { widths, valid: true };
}

export function Estoque({ empresaId }: EstoqueProps) {
  const { user } = useAuth();
  const canSeeFinanceiro =
    user?.cargo === 'DONO' || user?.cargo === 'FINANCEIRO' || user?.cargo === 'master';

  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  // Busca e Filtros
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('TODAS');
  const [apenasEstoqueBaixo, setApenasEstoqueBaixo] = useState(false);

  // Categorias Customizáveis da Oficina
  const [categoriasCustom, setCategoriasCustom] = useState<string[]>(() => {
    try {
      const salvas = localStorage.getItem(`autotec_categorias_${empresaId}`);
      if (salvas) return JSON.parse(salvas);
    } catch {
      // fallback
    }
    return CATEGORIAS_PADRAO;
  });

  const [mostrarModalCategorias, setMostrarModalCategorias] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');

  // Modais de Cadastro / Edição
  const [modalItemAberto, setModalItemAberto] = useState(false);
  const [itemEmEdicao, setItemEmEdicao] = useState<EstoqueItem | null>(null);
  const [salvandoItem, setSalvandoItem] = useState(false);

  // Form State
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState('PECAS');
  const [formCodigo, setFormCodigo] = useState('');
  const [formQuantidade, setFormQuantidade] = useState('0');
  const [formCusto, setFormCusto] = useState('0.00');
  const [formVenda, setFormVenda] = useState('0.00');
  const [formMinimo, setFormMinimo] = useState('5');

  // Modal de Ajuste Rápido (Entrada / Saída)
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [itemParaAjuste, setItemParaAjuste] = useState<EstoqueItem | null>(null);
  const [ajusteTipo, setAjusteTipo] = useState<'entrada' | 'saida'>('entrada');
  const [ajusteQtd, setAjusteQtd] = useState('1');
  const [ajustando, setAjustando] = useState(false);

  // Modal de Etiqueta com Código de Barras
  const [modalEtiquetaAberto, setModalEtiquetaAberto] = useState(false);
  const [itemEtiqueta, setItemEtiqueta] = useState<EstoqueItem | null>(null);

  // Confirmação de Exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<EstoqueItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Carrega Estoque
  const carregarEstoque = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const res = await api.listarEstoque(empresaId);
      setItens(res.itens || []);

      // Mescla categorias existentes nos itens com as cadastradas
      const catsDosItens = Array.from(
        new Set((res.itens || []).map((i) => (i.categoria || 'PECAS').toUpperCase()))
      );
      setCategoriasCustom((prev) => {
        const uniao = Array.from(new Set([...prev, ...catsDosItens]));
        try {
          localStorage.setItem(`autotec_categorias_${empresaId}`, JSON.stringify(uniao));
        } catch {}
        return uniao;
      });
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao carregar lista de estoque.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarEstoque();
  }, [carregarEstoque]);

  const dispararFeedback = (msg: string) => {
    setSucessoMsg(msg);
    setTimeout(() => setSucessoMsg(null), 4000);
  };

  // Gerenciamento de Categorias
  const handleAdicionarCategoria = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = novaCategoriaNome.trim().toUpperCase();
    if (!nomeLimpo) return;

    if (categoriasCustom.includes(nomeLimpo)) {
      dispararFeedback(`A categoria "${nomeLimpo}" já existe.`);
      setNovaCategoriaNome('');
      return;
    }

    const atualizadas = [...categoriasCustom, nomeLimpo];
    setCategoriasCustom(atualizadas);
    try {
      localStorage.setItem(`autotec_categorias_${empresaId}`, JSON.stringify(atualizadas));
    } catch {}
    setNovaCategoriaNome('');
    dispararFeedback(`Categoria "${nomeLimpo}" criada com sucesso!`);
  };

  const handleExcluirCategoria = async (catNome: string) => {
    const itensUsando = itens.filter(
      (i) => (i.categoria || '').toUpperCase() === catNome.toUpperCase()
    );

    if (itensUsando.length > 0) {
      const confirmar = window.confirm(
        `Existem ${itensUsando.length} itens usando a categoria "${catNome}". Deseja reclassificá-los para "DIVERSOS" e excluir a categoria?`
      );
      if (!confirmar) return;

      try {
        for (const item of itensUsando) {
          await api.atualizarItemEstoque(empresaId, item.id, { categoria: 'DIVERSOS' });
        }
        await carregarEstoque();
      } catch {
        alert('Falha ao reclassificar itens da categoria.');
        return;
      }
    }

    const atualizadas = categoriasCustom.filter((c) => c !== catNome);
    setCategoriasCustom(atualizadas);
    try {
      localStorage.setItem(`autotec_categorias_${empresaId}`, JSON.stringify(atualizadas));
    } catch {}
    if (categoriaAtiva === catNome) setCategoriaAtiva('TODAS');
    dispararFeedback(`Categoria "${catNome}" removida.`);
  };

  // Abrir Modal de Cadastro / Edição
  const abrirModalCadastro = () => {
    setItemEmEdicao(null);
    setFormNome('');
    setFormCategoria(categoriasCustom[0] || 'PECAS');
    setFormCodigo('');
    setFormQuantidade('0');
    setFormCusto('0.00');
    setFormVenda('0.00');
    setFormMinimo('5');
    setModalItemAberto(true);
  };

  const abrirModalEdicao = (item: EstoqueItem) => {
    setItemEmEdicao(item);
    setFormNome(item.nome);
    setFormCategoria(item.categoria || 'PECAS');
    setFormCodigo(item.codigo || '');
    setFormQuantidade(String(item.quantidade ?? 0));
    setFormCusto(String(item.custo ?? 0));
    setFormVenda(String(item.venda ?? 0));
    setFormMinimo(String(item.minimo_alerta ?? 5));
    setModalItemAberto(true);
  };

  // Salvar Item (Criar ou Atualizar)
  const handleSalvarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      alert('Informe o nome da peça/item.');
      return;
    }

    const qtd = Math.max(0, parseInt(formQuantidade, 10) || 0);
    const custo = canSeeFinanceiro
      ? Math.max(0, parseFloat(formCusto.replace(',', '.')) || 0)
      : itemEmEdicao?.custo ?? 0;
    const venda = Math.max(0, parseFloat(formVenda.replace(',', '.')) || 0);
    const minimo = Math.max(0, parseInt(formMinimo, 10) || 5);

    try {
      setSalvandoItem(true);
      setErro(null);

      if (itemEmEdicao) {
        const payload: EstoqueUpdateInput = {
          nome: formNome.trim(),
          categoria: formCategoria.toUpperCase().trim(),
          codigo: formCodigo.trim() || null,
          quantidade: qtd,
          custo,
          venda,
          minimo_alerta: minimo,
        };
        const atualizado = await api.atualizarItemEstoque(empresaId, itemEmEdicao.id, payload);
        setItens((prev) => prev.map((i) => (i.id === atualizado.id ? atualizado : i)));
        dispararFeedback(`Item "${atualizado.nome}" atualizado com sucesso!`);
      } else {
        const payload: EstoqueCreateInput = {
          nome: formNome.trim(),
          categoria: formCategoria.toUpperCase().trim(),
          codigo: formCodigo.trim() || null,
          quantidade: qtd,
          custo,
          venda,
          minimo_alerta: minimo,
          empresa_id: empresaId,
        };
        const criado = await api.criarItemEstoque(payload);
        setItens((prev) => [criado, ...prev]);
        dispararFeedback(`"${criado.nome}" cadastrado com sucesso!`);
      }

      setModalItemAberto(false);
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao salvar item no estoque.');
    } finally {
      setSalvandoItem(false);
    }
  };

  // Ajuste Rápido de Saldo
  const abrirModalAjuste = (item: EstoqueItem, tipo: 'entrada' | 'saida') => {
    setItemParaAjuste(item);
    setAjusteTipo(tipo);
    setAjusteQtd('1');
    setModalAjusteAberto(true);
  };

  const handleConfirmarAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaAjuste) return;
    const qtd = Math.max(1, parseInt(ajusteQtd, 10) || 1);

    try {
      setAjustando(true);
      setErro(null);
      const atualizado = await api.ajustarEstoque(empresaId, itemParaAjuste.id, ajusteTipo, qtd);
      setItens((prev) => prev.map((i) => (i.id === atualizado.id ? atualizado : i)));
      dispararFeedback(
        `${ajusteTipo === 'entrada' ? 'Entrada de' : 'Saída de'} ${qtd} un. em "${
          itemParaAjuste.nome
        }" registrada com sucesso!`
      );
      setModalAjusteAberto(false);
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao ajustar saldo.');
    } finally {
      setAjustando(false);
    }
  };

  // Exclusão de Item
  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir) return;
    try {
      setExcluindo(true);
      await api.deletarItemEstoque(empresaId, itemParaExcluir.id);
      setItens((prev) => prev.filter((i) => i.id !== itemParaExcluir.id));
      dispararFeedback(`"${itemParaExcluir.nome}" foi removido do estoque.`);
      setItemParaExcluir(null);
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao remover item.');
    } finally {
      setExcluindo(false);
    }
  };

  // Exportação CSV compatível com Excel (UTF-8 com BOM e ponto e vírgula)
  const handleExportarCsv = () => {
    if (itensFiltrados.length === 0) {
      alert('Não há itens para exportar no filtro atual.');
      return;
    }

    const cabecalho = canSeeFinanceiro
      ? [
          'Código / SKU',
          'Nome do Item',
          'Categoria',
          'Qtd em Estoque',
          'Mínimo de Alerta',
          'Custo Unitário (R$)',
          'Preço de Venda (R$)',
          'Total em Custo (R$)',
          'Total em Venda (R$)',
          'Lucro Estimado (R$)',
        ]
      : [
          'Código / SKU',
          'Nome do Item',
          'Categoria',
          'Qtd em Estoque',
          'Mínimo de Alerta',
          'Preço de Venda (R$)',
        ];

    const linhas = itensFiltrados.map((item) => {
      const sku = (item.codigo || '').replace(/"/g, '""');
      const nome = item.nome.replace(/"/g, '""');
      const cat = (item.categoria || 'PECAS').replace(/"/g, '""');
      const qtd = item.quantidade ?? 0;
      const min = item.minimo_alerta ?? 5;
      const venda = Number(item.venda || 0).toFixed(2).replace('.', ',');

      if (canSeeFinanceiro) {
        const custo = Number(item.custo || 0).toFixed(2).replace('.', ',');
        const totalCusto = (qtd * Number(item.custo || 0)).toFixed(2).replace('.', ',');
        const totalVenda = (qtd * Number(item.venda || 0)).toFixed(2).replace('.', ',');
        const lucro = (qtd * (Number(item.venda || 0) - Number(item.custo || 0)))
          .toFixed(2)
          .replace('.', ',');

        return `"${sku}";"${nome}";"${cat}";${qtd};${min};${custo};${venda};${totalCusto};${totalVenda};${lucro}`;
      }

      return `"${sku}";"${nome}";"${cat}";${qtd};${min};${venda}`;
    });

    const csvContent = '\uFEFF' + [cabecalho.join(';'), ...linhas].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `estoque_autotec_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    dispararFeedback('Arquivo CSV gerado e baixado com sucesso!');
  };

  // Filtragem Reativa Instantânea
  const itensFiltrados = useMemo(() => {
    let lista = itens;

    if (categoriaAtiva !== 'TODAS') {
      lista = lista.filter(
        (i) => (i.categoria || 'PECAS').toUpperCase() === categoriaAtiva.toUpperCase()
      );
    }

    if (apenasEstoqueBaixo) {
      lista = lista.filter((i) => (i.quantidade ?? 0) <= (i.minimo_alerta ?? 5));
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      lista = lista.filter(
        (i) =>
          i.nome.toLowerCase().includes(q) ||
          (i.codigo && i.codigo.toLowerCase().includes(q)) ||
          (i.categoria && i.categoria.toLowerCase().includes(q))
      );
    }

    return lista;
  }, [itens, categoriaAtiva, apenasEstoqueBaixo, busca]);

  // Cálculos de KPIs Estratégicos
  const stats = useMemo(() => {
    let criticos = 0;
    let totalCusto = 0;
    let totalVenda = 0;

    for (const item of itens) {
      const qtd = Number(item.quantidade || 0);
      if (qtd <= Number(item.minimo_alerta ?? 5)) criticos++;
      totalCusto += qtd * Number(item.custo || 0);
      totalVenda += qtd * Number(item.venda || 0);
    }

    return {
      totalItens: itens.length,
      criticos,
      totalCusto,
      totalVenda,
      lucroProjetado: totalVenda - totalCusto,
    };
  }, [itens]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* CABEÇALHO DA TELA DE ESTOQUE */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Package className="w-6 h-6 text-[#F97316]" aria-hidden="true" />
              <span>Estoque &amp; Almoxarifado</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-[#1E293B] border border-[#334155] text-xs font-mono font-bold text-slate-300">
              {itens.length} itens
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Controle ágil de peças, fluidos, componentes e saldo para a bancada da oficina.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportarCsv}
            title="Exportar para Excel / CSV"
            aria-label="Exportar para Excel / CSV"
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#0B0F17] hover:bg-[#1E293B] border border-[#334155] text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={carregarEstoque}
            disabled={carregando}
            title="Atualizar lista de estoque"
            aria-label="Atualizar estoque"
            className="min-h-[42px] px-2.5 py-2 rounded-xl bg-[#0B0F17] hover:bg-[#1E293B] border border-[#334155] text-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${carregando ? 'animate-spin text-[#F97316]' : ''}`}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={abrirModalCadastro}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-orange-950/40"
          >
            <Plus className="w-4 h-4 stroke-[3]" aria-hidden="true" />
            <span>+ Nova Peça</span>
          </button>
        </div>
      </header>

      {/* FEEDBACK DE SUCESSO / ERRO */}
      <div aria-live="polite">
        {sucessoMsg && (
          <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{sucessoMsg}</span>
          </div>
        )}
        {erro && (
          <div className="p-3 rounded-xl bg-red-950 border border-red-500 text-red-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
      </div>

      {/* CARDS DE INDICADORES (CONDICIONAIS POR PERFIL) */}
      <section
        aria-label="Indicadores do Estoque"
        className={`grid ${
          canSeeFinanceiro
            ? 'grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-2'
        } gap-2 sm:gap-3`}
      >
        <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Total de Itens</span>
            <Package className="w-4 h-4 text-blue-400" aria-hidden="true" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tabular-nums">
            {stats.totalItens}
          </div>
          <div className="text-[11px] text-slate-400">Produtos no catálogo</div>
        </div>

        <button
          type="button"
          onClick={() => setApenasEstoqueBaixo((prev) => !prev)}
          className={`rounded-xl p-3 sm:p-4 text-left flex flex-col justify-between cursor-pointer border-2 transition-colors ${
            apenasEstoqueBaixo
              ? 'bg-red-950/80 border-red-500 text-white'
              : stats.criticos > 0
              ? 'bg-[#111827] border-red-900/60 hover:border-red-500 text-slate-200'
              : 'bg-[#111827] border-[#1E293B] text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={stats.criticos > 0 ? 'text-red-400' : 'text-slate-400'}>
              Estoque Crítico
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${
                stats.criticos > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500'
              }`}
              aria-hidden="true"
            />
          </div>
          <div
            className={`text-xl sm:text-2xl font-black font-mono mt-1 tabular-nums ${
              stats.criticos > 0 ? 'text-red-400' : 'text-slate-300'
            }`}
          >
            {stats.criticos}
          </div>
          <div className="text-[11px] text-slate-400">
            {apenasEstoqueBaixo ? 'Filtro ativado (clique p/ ver todos)' : 'Qtd ≤ Alerta mínimo'}
          </div>
        </button>

        {/* Patrimônio Investido & Potencial de Venda (Apenas DONO, FINANCEIRO e Master) */}
        {canSeeFinanceiro && (
          <>
            <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Capital em Custo</span>
                <DollarSign className="w-4 h-4 text-amber-400" aria-hidden="true" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-white mt-1 tabular-nums">
                {formatBRL(stats.totalCusto)}
              </div>
              <div className="text-[11px] text-slate-400">Patrimônio investido</div>
            </div>

            <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Potencial Venda</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-emerald-400 mt-1 tabular-nums">
                {formatBRL(stats.totalVenda)}
              </div>
              <div className="text-[11px] text-slate-400">
                Lucro estimado: {formatBRL(stats.lucroProjetado)}
              </div>
            </div>
          </>
        )}
      </section>

      {/* BARRA DE BUSCA REATIVA E FILTROS DE CATEGORIA */}
      <section className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Campo de Busca Reativa Instantânea */}
          <search className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar peça por nome, código SKU ou categoria…"
              aria-label="Buscar peça por nome, código SKU ou categoria"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full min-h-[42px] pl-9 pr-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-[#F97316]"
            />
          </search>

          <button
            type="button"
            onClick={() => setMostrarModalCategorias(true)}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#475569] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <FolderPlus className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
            <span>Categorias ({categoriasCustom.length})</span>
          </button>
        </div>

        {/* Abas Horizontais com Scroll Suave de Categorias */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => {
              setCategoriaAtiva('TODAS');
              setApenasEstoqueBaixo(false);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold shrink-0 cursor-pointer transition-colors ${
              categoriaAtiva === 'TODAS' && !apenasEstoqueBaixo
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#0B0F17] text-slate-300 border border-[#334155] hover:bg-[#1E293B]'
            }`}
          >
            Todas ({itens.length})
          </button>

          <button
            type="button"
            onClick={() => setApenasEstoqueBaixo((v) => !v)}
            className={`px-3 py-1.5 rounded-lg font-bold shrink-0 cursor-pointer flex items-center gap-1 transition-colors ${
              apenasEstoqueBaixo
                ? 'bg-red-600 text-white'
                : 'bg-[#0B0F17] text-red-300 border border-red-900/60 hover:bg-red-950'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Crítico ({stats.criticos})</span>
          </button>

          {categoriasCustom.map((cat) => {
            const count = itens.filter(
              (i) => (i.categoria || 'PECAS').toUpperCase() === cat.toUpperCase()
            ).length;
            const ativa = categoriaAtiva === cat && !apenasEstoqueBaixo;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategoriaAtiva(cat);
                  setApenasEstoqueBaixo(false);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 cursor-pointer transition-colors ${
                  ativa
                    ? 'bg-[#F97316] text-[#0B0F17]'
                    : 'bg-[#0B0F17] text-slate-300 border border-[#334155] hover:bg-[#1E293B]'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* LISTAGEM DENSA & MOBILE-FIRST DOS ITENS DO ESTOQUE */}
      {carregando ? (
        <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-8 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#F97316]" aria-hidden="true" />
          <p className="text-sm">Carregando catálogo do estoque…</p>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="bg-[#111827] border-2 border-[#1E293B] rounded-xl p-8 text-center text-slate-400 space-y-3">
          <Package className="w-10 h-10 text-slate-500 mx-auto" aria-hidden="true" />
          <h3 className="text-base font-bold text-white">Nenhum item encontrado</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            {busca || apenasEstoqueBaixo || categoriaAtiva !== 'TODAS'
              ? 'Nenhuma peça corresponde aos filtros aplicados. Tente limpar a busca.'
              : 'Seu almoxarifado ainda não possui peças cadastradas. Comece cadastrando sua primeira peça agora.'}
          </p>
          <button
            type="button"
            onClick={abrirModalCadastro}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F97316] text-[#0B0F17] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" aria-hidden="true" />
            <span>Cadastrar Peça</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-[#0B0F17] border-2 border-[#334155] rounded-xl divide-y divide-[#1E293B]">
            {itensFiltrados.map((item) => {
              const qtd = item.quantidade ?? 0;
              const min = item.minimo_alerta ?? 5;
              const isCritico = qtd <= min;
              const margem =
                item.custo > 0 ? ((item.venda - item.custo) / item.venda) * 100 : 100;

              return (
                <article
                  key={item.id}
                  className="p-3 sm:px-4 sm:py-3 hover:bg-[#111827]/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  {/* Linha 1: Identificação da Peça (Nome em largura total no mobile) */}
                  <div className="min-w-0 sm:flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1E293B] text-slate-300 border border-[#334155] uppercase shrink-0">
                        {item.categoria || 'PECAS'}
                      </span>
                      {item.codigo && (
                        <span className="font-mono text-[11px] text-[#F97316] bg-orange-950/60 border border-orange-900 px-1.5 py-0.5 rounded shrink-0">
                          SKU: {item.codigo}
                        </span>
                      )}
                      {isCritico && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-600 animate-pulse shrink-0">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          <span>Baixo (mín: {min})</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-white break-words leading-snug">
                      {item.nome}
                    </h3>
                  </div>

                  {/* Linha 2 (Mobile) / Lado Direito (Desktop): Preços, Saldo e Ações */}
                  <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1E293B]">
                    {/* Bloco de Preços */}
                    <div className="flex items-center gap-3 font-mono tabular-nums text-right">
                      {canSeeFinanceiro && (
                        <div className="hidden md:block">
                          <div className="text-[10px] text-slate-400">Custo</div>
                          <div className="text-xs text-slate-300">{formatBRL(item.custo)}</div>
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] text-slate-400">Venda</div>
                        <div className="text-sm font-bold text-white">{formatBRL(item.venda)}</div>
                      </div>

                      {canSeeFinanceiro && item.custo > 0 && (
                        <div className="hidden lg:block">
                          <div className="text-[10px] text-emerald-400">Margem</div>
                          <div className="text-xs font-bold text-emerald-400">
                            {margem.toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Badge do Saldo em Estoque */}
                    <div
                      className={`min-w-[68px] px-2.5 py-1 rounded-lg border text-center font-mono shrink-0 ${
                        isCritico
                          ? 'bg-red-950/80 border-red-500 text-red-200'
                          : 'bg-[#1E293B] border-emerald-500/60 text-emerald-300'
                      }`}
                    >
                      <div className="text-[10px] font-bold opacity-80 uppercase leading-none">
                        Saldo
                      </div>
                      <div className="text-sm sm:text-base font-extrabold tabular-nums leading-tight">
                        {qtd} un.
                      </div>
                    </div>

                    {/* Botões Rápidos de Entrada e Saída (+ / -) */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirModalAjuste(item, 'saida')}
                        disabled={qtd <= 0}
                        title="Registrar Saída Rápida de Peça"
                        aria-label={`Registrar Saída de ${item.nome}`}
                        className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-red-950 border border-slate-600 hover:border-red-500 text-slate-200 hover:text-red-300 flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors"
                      >
                        <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirModalAjuste(item, 'entrada')}
                        title="Registrar Entrada / Chegada de Nota"
                        aria-label={`Registrar Entrada de ${item.nome}`}
                        className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-emerald-950 border border-slate-600 hover:border-emerald-500 text-slate-200 hover:text-emerald-300 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {/* Botão de Etiqueta com Código de Barras */}
                      <button
                        type="button"
                        onClick={() => {
                          setItemEtiqueta(item);
                          setModalEtiquetaAberto(true);
                        }}
                        title="Imprimir Etiqueta com Código de Barras"
                        aria-label={`Imprimir etiqueta com código de barras para ${item.nome}`}
                        className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-slate-600 text-[#F97316] flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Barcode className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {/* Botão de Edição */}
                      <button
                        type="button"
                        onClick={() => abrirModalEdicao(item)}
                        title="Editar Peça"
                        aria-label={`Editar ${item.nome}`}
                        className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-slate-600 text-amber-300 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      {/* Botão de Exclusão */}
                      <button
                        type="button"
                        onClick={() => setItemParaExcluir(item)}
                        title="Excluir Peça"
                        aria-label={`Excluir ${item.nome}`}
                        className="w-8 h-8 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-700 text-red-200 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: CADASTRO / EDIÇÃO DE PEÇA NO ESTOQUE */}
      {modalItemAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#111827] border-2 border-[#F97316] rounded-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-[#F97316]" aria-hidden="true" />
                <span>{itemEmEdicao ? 'Editar Peça / Item' : 'Nova Peça no Estoque'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalItemAberto(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSalvarItem} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-200 mb-1">
                  Nome da Peça / Produto *
                </label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Pastilha de Freio Dianteira Onix 1.0"
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Categoria *</label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-bold"
                  >
                    {categoriasCustom.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    Código / SKU / Cód. Barras
                  </label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    placeholder="Ex: ONX-7741"
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    Quantidade em Saldo *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formQuantidade}
                    onChange={(e) => setFormQuantidade(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    Alerta Mínimo (Crítico) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formMinimo}
                    onChange={(e) => setFormMinimo(e.target.value)}
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center"
                  />
                </div>
              </div>

              <div
                className={`grid ${
                  canSeeFinanceiro ? 'grid-cols-2' : 'grid-cols-1'
                } gap-3`}
              >
                {canSeeFinanceiro && (
                  <div>
                    <label className="block font-bold text-slate-200 mb-1">
                      Custo Unitário (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={formCusto}
                      onChange={(e) => setFormCusto(e.target.value)}
                      placeholder="0.00"
                      className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-slate-200 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={formVenda}
                    onChange={(e) => setFormVenda(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setModalItemAberto(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoItem}
                  className="min-h-[42px] px-5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {salvandoItem ? 'Salvando…' : 'Salvar Peça'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AJUSTE RÁPIDO DE SALDO (+ ENTRADA / - SAÍDA) */}
      {modalAjusteAberto && itemParaAjuste && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111827] border-2 border-[#1E293B] rounded-2xl w-full max-w-sm p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {ajusteTipo === 'entrada' ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-400" aria-hidden="true" />
                )}
                <span>{ajusteTipo === 'entrada' ? 'Entrada no Estoque' : 'Saída do Estoque'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalAjusteAberto(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-[#0B0F17] p-3 rounded-xl border border-[#334155] space-y-1">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Peça Selecionada
              </div>
              <div className="text-sm font-bold text-white">{itemParaAjuste.nome}</div>
              <div className="text-xs font-mono text-slate-300">
                Saldo atual: <strong className="text-white">{itemParaAjuste.quantidade} un.</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmarAjuste} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Quantidade a {ajusteTipo === 'entrada' ? 'adicionar' : 'dar baixa'}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  autoFocus
                  value={ajusteQtd}
                  onChange={(e) => setAjusteQtd(e.target.value)}
                  className="w-full min-h-[46px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center text-lg font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAjusteAberto(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#1E293B] text-white font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ajustando}
                  className={`min-h-[42px] px-5 rounded-xl text-white font-extrabold text-xs cursor-pointer ${
                    ajusteTipo === 'entrada'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  {ajustando
                    ? 'Salvando…'
                    : ajusteTipo === 'entrada'
                    ? 'Confirmar Entrada'
                    : 'Confirmar Saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GERENCIADOR DE CATEGORIAS DA EMPRESA */}
      {mostrarModalCategorias && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111827] border-2 border-[#2563EB] rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-400" aria-hidden="true" />
                <span>Gerenciar Categorias da Oficina</span>
              </h2>
              <button
                type="button"
                onClick={() => setMostrarModalCategorias(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleAdicionarCategoria} className="flex items-center gap-2">
              <input
                type="text"
                required
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                placeholder="Nome da nova categoria (Ex: SUSPENSÃO)…"
                className="flex-1 min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white text-xs uppercase"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer shrink-0"
              >
                + Criar
              </button>
            </form>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {categoriasCustom.map((cat) => {
                const count = itens.filter(
                  (i) => (i.categoria || '').toUpperCase() === cat.toUpperCase()
                ).length;
                return (
                  <div
                    key={cat}
                    className="p-2.5 rounded-xl bg-[#0B0F17] border border-[#1E293B] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                      <span className="font-bold text-white">{cat}</span>
                      <span className="text-slate-400">({count} itens)</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExcluirCategoria(cat)}
                      title={`Excluir categoria ${cat}`}
                      aria-label={`Excluir categoria ${cat}`}
                      className="p-1 text-red-400 hover:text-red-200 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#1E293B] flex justify-end">
              <button
                type="button"
                onClick={() => setMostrarModalCategorias(false)}
                className="min-h-[38px] px-4 rounded-xl bg-[#1E293B] text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: GERADOR DE ETIQUETA COM CÓDIGO DE BARRAS NATIVO (PRINTABLE) */}
      {modalEtiquetaAberto && itemEtiqueta && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#111827] border-2 border-[#F97316] rounded-2xl w-full max-w-sm p-4 sm:p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 print:hidden">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Barcode className="w-5 h-5 text-[#F97316]" aria-hidden="true" />
                <span>Etiqueta com Código de Barras</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalEtiquetaAberto(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* ÁREA DA ETIQUETA ADESIVA (PADRÃO TÉRMICO / GAVETA) */}
            <div
              id="etiqueta-impressao"
              className="bg-white text-black p-4 rounded-xl shadow-lg border-2 border-black flex flex-col items-center justify-center text-center space-y-2 select-all"
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                AUTOTEC PRO &bull; ALMOXARIFADO
              </div>

              <div className="text-xs font-black leading-tight uppercase max-w-[240px] text-black">
                {itemEtiqueta.nome}
              </div>

              {/* RENDER DO SVG DO CÓDIGO DE BARRAS */}
              <div className="my-1 flex flex-col items-center">
                {(() => {
                  const barcodeValue = (
                    itemEtiqueta.codigo ||
                    `AT-${itemEtiqueta.id.slice(0, 8)}`
                  ).toUpperCase();
                  const { widths } = generateCode128Svg(barcodeValue);
                  const totalModules = widths.reduce((a, b) => a + b, 0);
                  const scale = 1.6;

                  let currentX = 0;
                  return (
                    <svg
                      width={totalModules * scale}
                      height="48"
                      viewBox={`0 0 ${totalModules * scale} 48`}
                      className="mx-auto"
                    >
                      {widths.map((w, idx) => {
                        const isBar = idx % 2 === 0;
                        const barWidth = w * scale;
                        const x = currentX;
                        currentX += barWidth;
                        if (!isBar) return null;
                        return (
                          <rect
                            key={idx}
                            x={x}
                            y="0"
                            width={barWidth}
                            height="48"
                            fill="black"
                          />
                        );
                      })}
                    </svg>
                  );
                })()}

                <div className="font-mono text-[11px] font-extrabold tracking-widest mt-1 text-black">
                  {(itemEtiqueta.codigo || `AT-${itemEtiqueta.id.slice(0, 8)}`).toUpperCase()}
                </div>
              </div>

              <div className="w-full flex items-center justify-between border-t border-black pt-1 px-1">
                <span className="text-[10px] font-bold text-slate-700 uppercase">
                  {itemEtiqueta.categoria || 'PEÇA'}
                </span>
                <span className="font-mono text-base font-black text-black">
                  {formatBRL(itemEtiqueta.venda)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 print:hidden pt-2">
              <button
                type="button"
                onClick={() => setModalEtiquetaAberto(false)}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#1E293B] text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                <span>Imprimir Etiqueta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CONFIRMAÇÃO DE EXCLUSÃO */}
      {itemParaExcluir && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111827] border-2 border-red-600 rounded-2xl w-full max-w-sm p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-500 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Peça do Estoque?</h3>
                <p className="text-xs text-slate-400">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <div className="p-3 bg-[#0B0F17] rounded-xl border border-[#334155]">
              <div className="text-sm font-bold text-white">{itemParaExcluir.nome}</div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Saldo: {itemParaExcluir.quantidade} un. &bull; Preço: {formatBRL(itemParaExcluir.venda)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemParaExcluir(null)}
                className="min-h-[42px] px-4 rounded-xl bg-[#1E293B] text-white font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={handleConfirmarExclusao}
                className="min-h-[42px] px-4.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs cursor-pointer disabled:opacity-50"
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
