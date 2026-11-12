import { formatBRL } from '../lib/format';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { hojeLocalISO } from '../lib/data';
import { useAuth } from '../context/AuthContext';
import { EstoqueItem, EstoqueCreateInput, EstoqueUpdateInput } from '../types';
import {
  Package,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Download,
  Printer,
  FolderPlus,
  Trash2,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import { useTourDaPagina } from '../tour/useTourDaPagina';
import { TOUR_ESTOQUE } from '../tour/passos/estoque';
import { Button, CLASSE_CAMPO, Field, PageHeader, Panel, Skeleton } from '../components/ui';
import { Folha } from '../components/Folha';
import { LinhaItem, COLUNAS_ITEM } from './estoque/LinhaItem';
import { ChipsCategoria } from './estoque/ChipsCategoria';
import { categoriaEquivalente, rotuloCategoria, rotulosDasCategorias, saldoApos } from './estoque/auxiliares';

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
  // Categoria com itens aguardando confirmação para reclassificar e excluir
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<string | null>(null);
  // Saída pendente de confirmação ("Descartar alterações?") quando o formulário da peça tem dados não salvos
  const [saidaPendente, setSaidaPendente] = useState<(() => void) | null>(null);

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

  // Texto das categorias na tela (acento só nas canônicas; colisões mostram o valor bruto)
  const rotulosCategoria = useMemo(() => rotulosDasCategorias(categoriasCustom), [categoriasCustom]);
  const rotuloDe = (raw?: string | null) => rotulosCategoria[(raw || 'PECAS').toUpperCase()] ?? rotuloCategoria(raw);

  // Gerenciamento de Categorias
  const handleAdicionarCategoria = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = novaCategoriaNome.trim().toUpperCase();
    if (!nomeLimpo) return;

    // Equivalente (mesmo texto sem acento/caixa) já existe: não cria outra, só mostra a existente
    const existente = categoriaEquivalente(categoriasCustom, nomeLimpo);
    if (existente) {
      setCategoriaAtiva(existente);
      setApenasEstoqueBaixo(false);
      dispararFeedback(`A categoria "${rotuloDe(existente)}" já existe.`);
      setNovaCategoriaNome('');
      return;
    }

    const atualizadas = [...categoriasCustom, nomeLimpo];
    setCategoriasCustom(atualizadas);
    try {
      localStorage.setItem(`autotec_categorias_${empresaId}`, JSON.stringify(atualizadas));
    } catch {}
    setNovaCategoriaNome('');
    dispararFeedback(`Categoria "${rotuloDe(nomeLimpo)}" criada com sucesso!`);
  };

  const handleExcluirCategoria = async (catNome: string, confirmado = false) => {
    const itensUsando = itens.filter(
      (i) => (i.categoria || '').toUpperCase() === catNome.toUpperCase()
    );

    if (itensUsando.length > 0) {
      // Pede confirmação na própria folha (antes era window.confirm); a ação em si não muda
      if (!confirmado) {
        setCategoriaParaExcluir(catNome);
        return;
      }
      setCategoriaParaExcluir(null);
      setErro(null);

      try {
        for (const item of itensUsando) {
          await api.atualizarItemEstoque(empresaId, item.id, { categoria: 'DIVERSOS' });
        }
        await carregarEstoque();
      } catch {
        setErro('Falha ao reclassificar itens da categoria.');
        return;
      }
    }

    const atualizadas = categoriasCustom.filter((c) => c !== catNome);
    setCategoriasCustom(atualizadas);
    try {
      localStorage.setItem(`autotec_categorias_${empresaId}`, JSON.stringify(atualizadas));
    } catch {}
    if (categoriaAtiva === catNome) setCategoriaAtiva('TODAS');
    dispararFeedback(`Categoria "${rotuloDe(catNome)}" removida.`);
  };

  // Abrir Modal de Cadastro / Edição
  const abrirModalCadastro = () => {
    setErro(null);
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
    setErro(null);
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
      setErro('Informe o nome da peça/item.');
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
    setErro(null);
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
      setErro('Não há itens para exportar no filtro atual.');
      return;
    }
    setErro(null);

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
      `estoque_mecanify_${hojeLocalISO()}.csv`
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


  // Contagem por categoria para os chips e para o gerenciador de categorias
  const contagemPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const i of itens) {
      const k = (i.categoria || 'PECAS').toUpperCase();
      mapa[k] = (mapa[k] ?? 0) + 1;
    }
    return mapa;
  }, [itens]);

  const temFiltro = Boolean(busca.trim()) || apenasEstoqueBaixo || categoriaAtiva !== 'TODAS';
  const limparFiltros = () => {
    setBusca('');
    setCategoriaAtiva('TODAS');
    setApenasEstoqueBaixo(false);
  };

  // Formulário da peça: com dados digitados, Esc/Cancelar pedem confirmação em vez de descartar em silêncio
  const itemSujo =
    modalItemAberto &&
    (itemEmEdicao
      ? formNome !== itemEmEdicao.nome ||
        formCategoria !== (itemEmEdicao.categoria || 'PECAS') ||
        formCodigo !== (itemEmEdicao.codigo || '') ||
        formQuantidade !== String(itemEmEdicao.quantidade ?? 0) ||
        formCusto !== String(itemEmEdicao.custo ?? 0) ||
        formVenda !== String(itemEmEdicao.venda ?? 0) ||
        formMinimo !== String(itemEmEdicao.minimo_alerta ?? 5)
      : formNome !== '' ||
        formCategoria !== (categoriasCustom[0] || 'PECAS') ||
        formCodigo !== '' ||
        formQuantidade !== '0' ||
        formCusto !== '0.00' ||
        formVenda !== '0.00' ||
        formMinimo !== '5');

  useEffect(() => {
    if (!modalItemAberto) setSaidaPendente(null);
  }, [modalItemAberto]);

  const fecharModalItem = () => {
    setSaidaPendente(null);
    setModalItemAberto(false);
  };
  const sairDoFormulario = () => {
    if (itemSujo) setSaidaPendente(() => fecharModalItem);
    else fecharModalItem();
  };

  // Folha de categorias: nome digitado e ainda não criado também pede confirmação antes de sumir
  const fecharCategorias = () => {
    setSaidaPendente(null);
    setCategoriaParaExcluir(null);
    setNovaCategoriaNome('');
    setMostrarModalCategorias(false);
  };
  const sairDasCategorias = () => {
    if (novaCategoriaNome.trim()) setSaidaPendente(() => fecharCategorias);
    else fecharCategorias();
  };

  const alertaErro = (mensagem: string) => (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{mensagem}</span>
    </p>
  );

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

  useTourDaPagina(TOUR_ESTOQUE, !carregando && itens.length > 0);
  const verFinanceiro = canSeeFinanceiro;
  const qtdAjuste = Math.max(1, parseInt(ajusteQtd, 10) || 1);
  const saldoDepois = itemParaAjuste ? saldoApos(itemParaAjuste.quantidade ?? 0, ajusteTipo, qtdAjuste) : 0;
  const ajusteEntrada = ajusteTipo === 'entrada';

  return (
    <div>
      <PageHeader
        titulo="Estoque de peças"
        complemento={
          carregando ? undefined : (
            <span className="text-[1.375rem] font-semibold tabular-nums text-ink-subtle">{itens.length}</span>
          )
        }
        abaixo={<span className="hidden sm:inline">Peças, fluidos e componentes, com saldo e alerta de mínimo.</span>}
        acoes={
          <>
            <Button icone={Plus} data-tour="estoque-nova" onClick={abrirModalCadastro}>
              Nova peça
            </Button>
            <Button
              variante="secundario"
              onClick={handleExportarCsv}
              title="Exportar para Excel / CSV"
              aria-label="Exportar CSV"
              icone={Download}
            >
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Button
              variante="secundario"
              onClick={carregarEstoque}
              disabled={carregando}
              title="Atualizar lista de estoque"
              aria-label="Atualizar estoque"
              icone={RefreshCw}
            />
          </>
        }
      />

      <div aria-live="polite">
        {sucessoMsg && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{sucessoMsg}</span>
          </p>
        )}
      </div>
      {erro && !modalItemAberto && !modalAjusteAberto && !itemParaExcluir && !mostrarModalCategorias && <div className="mb-4">{alertaErro(erro)}</div>}

      {/* Indicadores: números grandes separados por divisores, sem cards aninhados */}
      <Panel
        as="section"
        aria-label="Indicadores do estoque"
        className={`mb-4 grid grid-cols-1 divide-y divide-line py-2 lg:py-5 lg:divide-x lg:divide-y-0 ${
          verFinanceiro ? 'lg:grid-cols-3' : 'lg:grid-cols-1'
        }`}
      >
        {verFinanceiro && (
          <>
            <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0 lg:first:pl-1">
              <p className="text-sm text-ink-muted">Capital em custo</p>
              <p className="text-xl font-semibold tabular-nums text-ink lg:mt-1 lg:text-3xl">{formatBRL(stats.totalCusto)}</p>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0">
              <p className="text-sm text-ink-muted">Potencial de venda</p>
              <div className="text-right lg:text-left">
                <p className="text-xl font-semibold tabular-nums text-ink lg:mt-1 lg:text-3xl">{formatBRL(stats.totalVenda)}</p>
                <p className="text-xs tabular-nums text-ink-muted lg:mt-1">Lucro estimado {formatBRL(stats.lucroProjetado)}</p>
              </div>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between gap-3 py-3 lg:block lg:px-6 lg:py-0">
          <p className="text-sm text-ink-muted">Abaixo do mínimo</p>
          <p
            className={`flex items-center gap-2 text-xl font-semibold tabular-nums lg:mt-1 lg:text-3xl ${
              stats.criticos > 0 ? 'text-danger' : 'text-ink'
            }`}
          >
            {stats.criticos > 0 && <AlertTriangle className="h-5 w-5" aria-hidden="true" />}
            {stats.criticos}
            <span className="text-sm font-normal text-ink-muted">{stats.criticos === 1 ? 'item' : 'itens'}</span>
          </p>
        </div>
      </Panel>

      <search className="mb-4 block space-y-3">
        <div className="flex gap-3">
          <div className="relative min-w-0 flex-1" data-tour="estoque-busca">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              name="busca_estoque"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar peça…"
              aria-label="Buscar peça por nome, código SKU ou categoria"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`${CLASSE_CAMPO} pl-9`}
            />
          </div>
          <Button variante="secundario" icone={FolderPlus} onClick={() => setMostrarModalCategorias(true)}>
            Categorias ({categoriasCustom.length})
          </Button>
        </div>
        <div data-tour="estoque-categorias">
        <ChipsCategoria
          categorias={categoriasCustom}
          rotulos={rotulosCategoria}
          contagens={contagemPorCategoria}
          total={itens.length}
          criticos={stats.criticos}
          categoriaAtiva={categoriaAtiva}
          apenasCriticos={apenasEstoqueBaixo}
          aoTodas={() => {
            setCategoriaAtiva('TODAS');
            setApenasEstoqueBaixo(false);
          }}
          aoCriticos={() => {
            // chips são de escolha única: "Crítico" mostra todas as categorias com saldo no mínimo
            setCategoriaAtiva('TODAS');
            setApenasEstoqueBaixo((v) => !v);
          }}
          aoCategoria={(cat) => {
            setCategoriaAtiva(cat);
            setApenasEstoqueBaixo(false);
          }}
        />
        </div>
      </search>

      {carregando ? (
        <Panel>
          <Skeleton linhas={5} />
        </Panel>
      ) : itensFiltrados.length === 0 ? (
        <Panel espaco="lg" className="flex flex-col items-center gap-3 text-center">
          <Package className="h-10 w-10 text-ink-subtle" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink text-balance">Nenhum item encontrado</h2>
          <p className="max-w-md text-sm text-ink-muted text-pretty">
            {temFiltro
              ? 'Nenhuma peça corresponde aos filtros aplicados. Tente limpar a busca.'
              : 'Seu almoxarifado ainda não possui peças cadastradas. Comece cadastrando sua primeira peça agora.'}
          </p>
          {temFiltro ? (
            <Button variante="secundario" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          ) : (
            <Button variante="secundario" icone={Plus} onClick={abrirModalCadastro}>
              Cadastrar peça
            </Button>
          )}
        </Panel>
      ) : (
        <Panel espaco="nenhum">
          <div
            aria-hidden="true"
            className={`hidden items-center gap-x-6 pb-2 pl-5 pr-2 pt-4 text-xs text-ink-muted lg:grid ${
              verFinanceiro ? COLUNAS_ITEM.financeiro : COLUNAS_ITEM.basico
            }`}
          >
            <span>Peça</span>
            {verFinanceiro && <span className="text-right">Custo</span>}
            <span className="text-right">Venda</span>
            {verFinanceiro && <span className="text-right">Margem</span>}
            <span className="text-right">Saldo</span>
            <span />
          </div>
          <ul aria-label="Peças em estoque" data-tour="estoque-lista" className="divide-y divide-line">
            {itensFiltrados.map((item) => (
              <LinhaItem
                key={item.id}
                item={item}
                rotuloCategoria={rotuloDe(item.categoria)}
                verFinanceiro={verFinanceiro}
                aoAjustar={(tipo) => abrirModalAjuste(item, tipo)}
                aoEtiqueta={() => {
                  setItemEtiqueta(item);
                  setModalEtiquetaAberto(true);
                }}
                aoEditar={() => abrirModalEdicao(item)}
                aoExcluir={() => {
                  setErro(null);
                  setItemParaExcluir(item);
                }}
              />
            ))}
          </ul>
        </Panel>
      )}

      {/* FOLHA 1: CADASTRO / EDIÇÃO DE PEÇA NO ESTOQUE */}
      <Folha
        aberto={modalItemAberto}
        focoInicial="primeiro-campo"
        tamanho="lg"
        fecharNoFundo={false}
        titulo={itemEmEdicao ? 'Editar peça' : 'Nova peça no estoque'}
        aoCancelar={sairDoFormulario}
      >
        {confirmarDescarte}
        {erro && alertaErro(erro)}
        <form onSubmit={handleSalvarItem} className="space-y-5">
          <Field rotulo="Nome da peça / produto *">
            <input
              type="text"
              required
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: Pastilha de freio dianteira Onix 1.0"
              className={CLASSE_CAMPO}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field rotulo="Categoria *">
              <select value={formCategoria} onChange={(e) => setFormCategoria(e.target.value)} className={CLASSE_CAMPO}>
                {categoriasCustom.map((cat) => (
                  <option key={cat} value={cat}>
                    {rotuloDe(cat)}
                  </option>
                ))}
              </select>
            </Field>
            <Field rotulo="Código / SKU / cód. de barras">
              <input
                type="text"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Ex: ONX-7741"
                className={`${CLASSE_CAMPO} font-mono uppercase`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field rotulo="Quantidade em saldo *">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                required
                value={formQuantidade}
                onChange={(e) => setFormQuantidade(e.target.value)}
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </Field>
            <Field rotulo="Alerta mínimo (crítico) *">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                required
                value={formMinimo}
                onChange={(e) => setFormMinimo(e.target.value)}
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </Field>
          </div>

          <div className={`grid gap-4 ${canSeeFinanceiro ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {canSeeFinanceiro && (
              <Field rotulo="Custo unitário (R$)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={formCusto}
                  onChange={(e) => setFormCusto(e.target.value)}
                  placeholder="0.00"
                  className={`${CLASSE_CAMPO} tabular-nums`}
                />
              </Field>
            )}
            <Field rotulo="Preço de venda (R$) *">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                required
                value={formVenda}
                onChange={(e) => setFormVenda(e.target.value)}
                placeholder="0.00"
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={sairDoFormulario}>
              Cancelar
            </Button>
            <Button type="submit" carregando={salvandoItem}>
              {salvandoItem ? 'Salvando…' : 'Salvar peça'}
            </Button>
          </div>
        </form>
      </Folha>

      {/* FOLHA 2: AJUSTE DE SALDO (ENTRADA / SAÍDA), SEMPRE COM QUANTIDADE E CONFIRMAÇÃO EXPLÍCITAS */}
      <Folha
        aberto={modalAjusteAberto && itemParaAjuste !== null}
        titulo={ajusteEntrada ? 'Entrada no estoque' : 'Saída do estoque'}
        aoCancelar={() => setModalAjusteAberto(false)}
      >
        {itemParaAjuste && (
          <>
            {erro && alertaErro(erro)}
            <div>
              <p className="text-sm font-medium text-ink">{itemParaAjuste.nome}</p>
              <p className="mt-0.5 text-sm tabular-nums text-ink-muted">Saldo atual {itemParaAjuste.quantidade} un.</p>
            </div>
            <form onSubmit={handleConfirmarAjuste} className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ajuste-quantidade" className="text-sm font-medium text-ink">
                  {`Quantidade a ${ajusteEntrada ? 'adicionar' : 'dar baixa'}`}
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variante="secundario"
                    aria-label="Diminuir quantidade"
                    icone={Minus}
                    disabled={qtdAjuste <= 1}
                    onClick={() => setAjusteQtd(String(Math.max(1, qtdAjuste - 1)))}
                  />
                  <input
                    id="ajuste-quantidade"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    required
                    value={ajusteQtd}
                    onChange={(e) => setAjusteQtd(e.target.value)}
                    className={`${CLASSE_CAMPO} text-center text-lg font-semibold tabular-nums`}
                  />
                  <Button
                    variante="secundario"
                    aria-label="Aumentar quantidade"
                    icone={Plus}
                    onClick={() => setAjusteQtd(String(qtdAjuste + 1))}
                  />
                </div>
              </div>
              <p className={`text-sm tabular-nums ${saldoDepois < 0 ? 'font-medium text-danger' : 'text-ink-muted'}`}>
                Saldo depois: {saldoDepois} un.
                {saldoDepois < 0 && ' · Saldo ficará negativo'}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variante="secundario" onClick={() => setModalAjusteAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variante={ajusteEntrada ? 'primario' : 'perigo'}
                  carregando={ajustando}
                >
                  {ajusteEntrada
                    ? `Confirmar entrada de ${qtdAjuste} un.`
                    : `Confirmar saída de ${qtdAjuste} un.${saldoDepois < 0 ? ' (saldo negativo)' : ''}`}
                </Button>
              </div>
            </form>
          </>
        )}
      </Folha>

      {/* FOLHA 3: GERENCIADOR DE CATEGORIAS DA EMPRESA */}
      <Folha
        aberto={mostrarModalCategorias}
        titulo="Gerenciar categorias"
        aoCancelar={sairDasCategorias}
      >
        {confirmarDescarte}
        {erro && alertaErro(erro)}
        <form onSubmit={handleAdicionarCategoria} className="flex items-end gap-2">
          <div className="flex-1">
            <Field rotulo="Nome da nova categoria">
              <input
                type="text"
                required
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                placeholder="Ex: Suspensão"
                className={CLASSE_CAMPO}
              />
            </Field>
          </div>
          <Button type="submit" variante="secundario">
            Criar
          </Button>
        </form>

        {categoriaParaExcluir && (
          <div
            role="alert"
            ref={(el) => el?.scrollIntoView({ block: 'nearest' })}
            className="space-y-3 rounded-xl bg-warning/15 p-4"
          >
            <p className="text-sm font-medium text-ink">
              Existem {contagemPorCategoria[categoriaParaExcluir.toUpperCase()] ?? 0} itens usando a categoria "
              {rotuloDe(categoriaParaExcluir)}". Deseja reclassificá-los para "Diversos" e excluir a categoria?
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" onClick={() => setCategoriaParaExcluir(null)}>
                Manter categoria
              </Button>
              <Button variante="perigo" onClick={() => handleExcluirCategoria(categoriaParaExcluir, true)}>
                Reclassificar e excluir
              </Button>
            </div>
          </div>
        )}

        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {categoriasCustom.map((cat) => (
            <li key={cat} className="flex min-h-12 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-ink">
                {rotuloDe(cat)}{' '}
                <span className="font-normal tabular-nums text-ink-muted">
                  ({contagemPorCategoria[cat.toUpperCase()] ?? 0} itens)
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleExcluirCategoria(cat)}
                title={`Excluir categoria ${rotuloDe(cat)}`}
                aria-label={`Excluir categoria ${rotuloDe(cat)}`}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <Button variante="secundario" onClick={sairDasCategorias}>
            Fechar
          </Button>
        </div>
      </Folha>

      {/* FOLHA 4: ETIQUETA COM CÓDIGO DE BARRAS NATIVO (IMPRESSÃO) */}
      <Folha
        aberto={modalEtiquetaAberto && itemEtiqueta !== null}
        titulo="Etiqueta com código de barras"
        aoCancelar={() => setModalEtiquetaAberto(false)}
      >
        {itemEtiqueta && (
          <>
            <div className="area-impressao">
            {/* codemod:ignore-start */}
            {/* ÁREA DA ETIQUETA ADESIVA (PADRÃO TÉRMICO / GAVETA) */}
            <div
              id="etiqueta-impressao"
              className="bg-white text-black p-4 rounded-xl shadow-lg border-2 border-black flex flex-col items-center justify-center text-center space-y-2 select-all"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                MECANIFY &bull; ALMOXARIFADO
              </div>

              <div className="text-xs font-semibold leading-tight uppercase max-w-[240px] text-black">
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

                <div className="font-mono text-xs font-semibold tracking-widest mt-1 text-black">
                  {(itemEtiqueta.codigo || `AT-${itemEtiqueta.id.slice(0, 8)}`).toUpperCase()}
                </div>
              </div>

              <div className="w-full flex items-center justify-between border-t border-black pt-1 px-1">
                <span className="text-xs font-semibold text-ink-muted uppercase">
                  {itemEtiqueta.categoria || 'PEÇA'}
                </span>
                <span className="font-mono text-base font-semibold text-black">
                  {formatBRL(itemEtiqueta.venda)}
                </span>
              </div>
            </div>
            {/* codemod:ignore-end */}
            </div>

            <div className="flex flex-col-reverse gap-2 print:hidden sm:flex-row sm:justify-end">
              <Button variante="secundario" onClick={() => setModalEtiquetaAberto(false)}>
                Fechar
              </Button>
              <Button icone={Printer} onClick={() => window.print()}>
                Imprimir etiqueta
              </Button>
            </div>
          </>
        )}
      </Folha>

      {/* FOLHA 5: CONFIRMAÇÃO DE EXCLUSÃO */}
      <Folha
        aberto={itemParaExcluir !== null}
        titulo="Excluir peça do estoque?"
        aoCancelar={() => setItemParaExcluir(null)}
      >
        {itemParaExcluir && (
          <>
            {erro && alertaErro(erro)}
            <div>
              <p className="text-sm font-medium text-ink">{itemParaExcluir.nome}</p>
              <p className="mt-0.5 text-sm tabular-nums text-ink-muted">
                Saldo {itemParaExcluir.quantidade} un. &bull; Preço {formatBRL(itemParaExcluir.venda)}
              </p>
              <p className="mt-3 text-sm text-ink-muted">Esta ação não poderá ser desfeita.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" onClick={() => setItemParaExcluir(null)}>
                Cancelar
              </Button>
              <Button variante="perigo" icone={Trash2} carregando={excluindo} onClick={handleConfirmarExclusao}>
                {excluindo ? 'Excluindo…' : 'Excluir peça'}
              </Button>
            </div>
          </>
        )}
      </Folha>
    </div>
  );
}
