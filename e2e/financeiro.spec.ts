import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, exigirRedeCompleta, listaTransacoes, simularBackend, transacoes, type Cenario } from './mocks';
import { coletarErros, contextoDoProjeto, exigirFocoNoPrimeiroCampo } from './contexto';

type Escrita = { metodo: string; caminho: string; corpo: Record<string, unknown> } | undefined;
const ultimaEscrita = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ultimaEscrita?: unknown }).__ultimaEscrita as Escrita);

async function abrir(page: Page, tema: 'claro' | 'escuro', cenario: Cenario = 'cheio') {
  await simularBackend(page, cenario);
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'financeiro');
}

const nb = (s: string) => s.replace(/\s/g, ' ');
const brl = (v: number) => nb(v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const sobraLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const abas = (page: Page) => page.getByRole('tablist', { name: 'Seções do financeiro' });
// "Contas" pode levar a contagem de despesas em aberto ("Contas · 5")
const aba = (page: Page, nome: string) => abas(page).getByRole('tab', { name: new RegExp(`^${nome}( · \\d+)?$`) });
const resumo = (page: Page) => page.getByRole('region', { name: 'Resumo do período' });
const lista = (page: Page) => page.getByRole('list', { name: 'Lançamentos' });
const linha = (page: Page, descricao: string) => lista(page).getByRole('listitem').filter({ hasText: descricao }).first();
const filtros = (page: Page) => page.getByRole('group', { name: 'Filtros de lançamentos' });

// Valores do cenário cheio (ver e2e/mocks/fixtures.ts): OS 28.450,90 pagos, lucro OS 11.230,40
const LUCRO_LIQUIDO = 4335.5;
const PENDENTE_DESPESA = transacoes.find((t) => t.descricao.startsWith('Fornecedor de peças'))!; // 6.350, pendente
const PENDENTE_RECEITA = transacoes.find((t) => t.descricao.startsWith('Recebimento parcelado'))!; // 3.400, pendente
const RECEITA_PAGA = transacoes[0]; // Venda balcão — palhetas, + 120
const DESPESA_PAGA = transacoes[1]; // Aluguel do galpão, − 4.800

async function irParaContas(page: Page) {
  await aba(page, 'Contas').click();
  await expect(lista(page)).toBeVisible();
}

async function menuDe(page: Page, descricao: string) {
  await linha(page, descricao).getByRole('button', { name: `Mais ações de ${descricao}` }).click();
}

test.describe('cabeçalho, período e resumo', () => {
  test('título, uma ação primária, abas em pílula e lucro líquido rotulado com o período', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page, tema);

    await expect(page.getByRole('heading', { level: 1, name: 'Caixa & financeiro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();

    const emAberto = transacoes.filter((t) => t.tipo === 'DESPESA' && t.status !== 'LIQUIDADO').length;
    await expect(abas(page).getByRole('tab')).toHaveText(['Balanço', 'DRE', `Contas · ${emAberto}`, 'BI']);
    await expect(aba(page, 'Balanço')).toHaveAttribute('aria-selected', 'true');
    await expect(aba(page, 'DRE')).toHaveAttribute('aria-selected', 'false');

    await expect(resumo(page)).toContainText(/Lucro líquido · Últimos 30 dias/);
    await expect(resumo(page)).toContainText(brl(LUCRO_LIQUIDO));
    await expect(resumo(page)).toContainText('Margem líquida 14,6%');
    // entradas em success com +, saídas em danger com −
    const entradas = resumo(page).getByText(`+ ${brl(29600.9)}`);
    await expect(entradas).toHaveClass(/text-success/);
    const saidas = resumo(page).getByText(`− ${brl(8044.9)}`);
    await expect(saidas).toHaveClass(/text-danger/);

    // número-chave grande e tabular (28–36px)
    const chave = page.locator('[data-numero-chave]');
    const tam = await chave.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(tam).toBeGreaterThanOrEqual(28);
    expect(tam).toBeLessThanOrEqual(36);
    await expect(chave).toHaveClass(/tabular-nums/);

    // no máximo 6 controles visíveis antes do primeiro número
    const controles = await page.evaluate(() => {
      const alvo = document.querySelector('[data-numero-chave]')!.getBoundingClientRect().top;
      const main = document.querySelector('main')!;
      return [...main.querySelectorAll('button, select, input, a[href]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < alvo;
      }).length;
    });
    expect(controles).toBeLessThanOrEqual(6);

    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('período: um seletor com predefinições; Personalizado mostra as datas e recarrega com elas', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    await abrir(page, tema);
    const seletor = page.getByRole('combobox', { name: 'Período' });
    await expect(seletor.locator('option')).toHaveText([
      'Hoje',
      'Últimos 7 dias',
      'Últimos 30 dias',
      'Este mês',
      'Mês anterior',
      'Ano atual',
      'Personalizado',
    ]);
    await expect(seletor).toHaveValue('30D');
    await expect(page.getByLabel('De', { exact: true })).toHaveCount(0);
    if (largura < 1024) {
      const caixa = (await page.getByRole('group', { name: 'Período do relatório' }).boundingBox())!;
      expect(caixa.height).toBeLessThanOrEqual(56);
    }

    const req = page.waitForRequest((r) => r.url().includes('/financeiro/') && !r.url().includes('inteligencia') && r.url().includes('data_final'));
    await seletor.selectOption('MES_ANTERIOR');
    const u = new URL((await req).url());
    expect(u.searchParams.get('data_inicial')).toMatch(/^\d{4}-\d{2}-0?1$|^\d{4}-\d{2}-\d{2}$/);
    await expect(resumo(page)).toContainText('Lucro líquido · Mês anterior');

    await seletor.selectOption('CUSTOM');
    const de = page.getByLabel('De', { exact: true });
    const ate = page.getByLabel('Até', { exact: true });
    await expect(de).toBeVisible();
    await expect(ate).toBeVisible();
    const req2 = page.waitForRequest((r) => r.url().includes('/financeiro/') && r.url().includes('data_inicial=2026-01-05'));
    await de.fill('2026-01-05');
    await req2;
    await ate.fill('2026-02-20');
    await expect(resumo(page)).toContainText('Lucro líquido · 05/01/2026 a 20/02/2026');
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('abas', () => {
  test('balanço: ativo, passivo e posição líquida', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const painel = page.getByRole('tabpanel');
    await expect(painel).toContainText('Ativo circulante');
    await expect(painel).toContainText('Caixa e bancos');
    await expect(painel).toContainText('Contas a receber');
    await expect(painel).toContainText('Patrimônio em estoque');
    await expect(painel).toContainText('Passivo circulante');
    await expect(painel).toContainText(`− ${brl(10479.9)}`);
    await expect(painel).toContainText('Posição patrimonial líquida');
    await expect(painel).toContainText(brl(81608));
  });

  test('DRE: todas as linhas do demonstrativo com sinais', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await aba(page, 'DRE').click();
    await expect(aba(page, 'DRE')).toHaveAttribute('aria-selected', 'true');
    const dre = page.getByRole('table', { name: /Demonstrativo do resultado/ });
    await expect(dre).toContainText('Receita bruta total');
    await expect(dre).toContainText(brl(29600.9));
    await expect(dre).toContainText('Faturamento de ordens de serviço');
    await expect(dre).toContainText('Receitas avulsas recebidas');
    await expect(dre).toContainText('Custos variáveis diretos');
    await expect(dre).toContainText(`− ${brl(17220.5)}`);
    await expect(dre).toContainText('Lucro bruto operacional');
    await expect(dre).toContainText('Margem bruta 41,8%');
    await expect(dre).toContainText('Despesas operacionais pagas');
    await expect(dre).toContainText(`− ${brl(8044.9)}`);
    await expect(dre).toContainText('Aluguel');
    await expect(dre).toContainText('Lucro líquido do período');
    await expect(dre).toContainText(brl(LUCRO_LIQUIDO));
  });

  test('BI: indicadores e rankings', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await aba(page, 'BI').click();
    const painel = page.getByRole('tabpanel');
    await expect(painel).toContainText('Ticket médio');
    await expect(painel).toContainText(brl(1184.2));
    await expect(painel).toContainText('Taxa de conversão');
    await expect(painel).toContainText('Giro médio no pátio');
    await expect(painel.getByRole('heading', { name: 'Produtividade por mecânico' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Meios de pagamento' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Rentabilidade por marca' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: /Clientes mais lucrativos/ })).toBeVisible();
    // barras com texto equivalente (valor e %)
    await expect(painel.getByRole('list', { name: 'Meios de pagamento' }).getByRole('listitem').first()).toContainText('%');
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });

  test('celular: faixa de abas numa linha só (ou rola dentro dela), alvos de 44px, sem rolar a página', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    const faixa = (await abas(page).boundingBox())!;
    expect(faixa.height).toBeLessThanOrEqual(56);
    expect(faixa.x + faixa.width).toBeLessThanOrEqual(largura);
    for (const t of await abas(page).getByRole('tab').all()) {
      expect((await t.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    for (const nome of ['DRE', 'Contas', 'BI']) {
      await aba(page, nome).click();
      expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    }
  });

  test('exportar CSV baixa o arquivo da aba atual (colunas e BOM preservados)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const baixar = async () => {
      const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
      return d;
    };
    expect((await baixar()).suggestedFilename()).toMatch(/^balanco_patrimonial_\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}\.csv$/);
    await aba(page, 'DRE').click();
    expect((await baixar()).suggestedFilename()).toMatch(/^dre_mecanify_/);
    await aba(page, 'Contas').click();
    const contas = await baixar();
    expect(contas.suggestedFilename()).toMatch(/^lancamentos_financeiros_/);
    const texto = readFileSync((await contas.path())!, 'utf8');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto.split('\r\n')[0]).toBe(
      '﻿"Tipo";"Descrição";"Categoria";"Valor (R$)";"Vencimento";"Data Liquidação";"Status";"Forma de Pagamento";"Observações"'
    );
    expect(texto.split('\r\n')).toHaveLength(transacoes.length + 1);
    await aba(page, 'BI').click();
    expect((await baixar()).suggestedFilename()).toMatch(/^relatorio_bi_oficina_/);
  });
});

test.describe('contas a pagar e receber', () => {
  test('todas as linhas visíveis; receita com + em success, despesa com − em danger, status em texto', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaContas(page);
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.length);
    const rec = linha(page, RECEITA_PAGA.descricao).getByText(`+ ${brl(RECEITA_PAGA.valor)}`);
    await expect(rec).toHaveClass(/text-success/);
    const desp = linha(page, DESPESA_PAGA.descricao).getByText(`− ${brl(DESPESA_PAGA.valor)}`);
    await expect(desp).toHaveClass(/text-danger/);
    await expect(linha(page, DESPESA_PAGA.descricao)).toContainText('Pago');
    await expect(linha(page, RECEITA_PAGA.descricao)).toContainText('Recebido');
    await expect(linha(page, 'Imposto Simples Nacional')).toContainText('Atrasado');
    await expect(linha(page, PENDENTE_DESPESA.descricao)).toContainText('Pendente');
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });

  test('filtros de tipo, status e busca; sem resultado oferece "Limpar filtros"', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaContas(page);
    const tipo = page.getByRole('group', { name: 'Filtrar por tipo' });
    const status = page.getByRole('group', { name: 'Filtrar por status' });
    await expect(tipo.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    await tipo.getByRole('button', { name: 'A pagar' }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.filter((t) => t.tipo === 'DESPESA').length);
    await status.getByRole('button', { name: 'Atrasados' }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(1);
    await tipo.getByRole('button', { name: 'A receber' }).click();
    await expect(page.getByRole('heading', { name: 'Nenhum lançamento no filtro atual' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.length);
    await status.getByRole('button', { name: 'Pagos e recebidos' }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.filter((t) => t.status === 'LIQUIDADO').length);
    await status.getByRole('button', { name: 'Pendentes' }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.filter((t) => t.status === 'PENDENTE').length);
    await status.getByRole('button', { name: 'Todos' }).click();
    await page.getByRole('searchbox', { name: /Buscar lançamento/ }).fill('sucata');
    await expect(lista(page).getByRole('listitem')).toHaveCount(1);
  });

  test('celular: filtros numa linha só, linhas compactas de 60 a 96px e alvos de 44px', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    await irParaContas(page);
    const faixa = (await filtros(page).boundingBox())!;
    expect(faixa.height).toBeLessThanOrEqual(56);
    for (const b of await filtros(page).getByRole('button').all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const itens = await lista(page).getByRole('listitem').all();
    expect(itens).toHaveLength(transacoes.length);
    let yAnterior = -1;
    for (const li of itens) {
      const c = (await li.boundingBox())!;
      expect(c.height).toBeGreaterThanOrEqual(60);
      expect(c.height).toBeLessThanOrEqual(96);
      expect(c.y).toBeGreaterThan(yAnterior);
      expect(c.x + c.width).toBeLessThanOrEqual(largura);
      yAnterior = c.y;
      for (const b of await li.getByRole('button').all()) {
        if (!(await b.isVisible())) continue;
        const bb = (await b.boundingBox())!;
        expect(bb.height).toBeGreaterThanOrEqual(44);
        expect(bb.width).toBeGreaterThanOrEqual(44);
      }
    }
    for (const b of await page.getByRole('main').getByRole('button').all()) {
      if (!(await b.isVisible())) continue;
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });

  test('celular: linha mostra data da baixa, forma de pagamento e observações', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await simularBackend(page, 'cheio');
    await page.route('**/api/v1/transacoes-financeiras/*', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const corpo = listaTransacoes('cheio', new URLSearchParams());
      corpo.transacoes = corpo.transacoes.map((t) =>
        t.id === PENDENTE_DESPESA.id ? { ...t, forma_pagamento: 'Boleto / Faturado', observacoes: 'NF 4471 parcela 2' } : t
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(corpo),
      });
    });
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'financeiro');
    await irParaContas(page);
    const paga = linha(page, DESPESA_PAGA.descricao);
    const [y, m, d] = DESPESA_PAGA.data_liquidacao!.split('-');
    await expect(paga.getByTitle(`Baixa ${d}/${m}/${y.slice(2)} · PIX`)).toBeVisible();
    const comObs = linha(page, PENDENTE_DESPESA.descricao);
    await expect(comObs.getByTitle('Boleto / Faturado · NF 4471 parcela 2')).toBeVisible();
    for (const li of [paga, comObs]) {
      const c = (await li.boundingBox())!;
      expect(c.height).toBeLessThanOrEqual(96);
    }
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });

  test('dar baixa exige confirmação; cancelar não grava; confirmar liquida com a forma escolhida', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaContas(page);
    await expect(linha(page, DESPESA_PAGA.descricao).getByRole('button', { name: /Mais ações/ })).toBeVisible();
    await menuDe(page, DESPESA_PAGA.descricao);
    await expect(page.getByRole('menuitem', { name: /Marcar como pago/ })).toHaveCount(0); // já liquidado
    await page.keyboard.press('Escape');

    await menuDe(page, PENDENTE_DESPESA.descricao);
    await page.getByRole('menuitem', { name: 'Marcar como pago' }).click();
    const d = page.getByRole('dialog', { name: 'Dar baixa no lançamento?' });
    await expect(d).toContainText(PENDENTE_DESPESA.descricao);
    await expect(d).toContainText(`− ${brl(PENDENTE_DESPESA.valor)}`);
    expect(await ultimaEscrita(page)).toBeUndefined();
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await expect(d).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();

    await menuDe(page, PENDENTE_RECEITA.descricao);
    await page.getByRole('menuitem', { name: 'Marcar como recebido' }).click();
    await expect(d).toContainText(`+ ${brl(PENDENTE_RECEITA.valor)}`);
    await d.getByRole('radio', { name: 'PIX' }).check();
    await d.getByRole('button', { name: 'Confirmar recebimento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('PATCH');
    expect(e.caminho).toContain(`/${PENDENTE_RECEITA.id}/liquidar`);
    expect(e.corpo).toMatchObject({ forma_pagamento: 'PIX' });
    await expect(d).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'RECEBIDO' })).toBeVisible();
  });

  test('baixa sem forma no lançamento: nada marcado e confirmar bloqueado até escolher; cancelar não grava', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaContas(page);
    await menuDe(page, PENDENTE_RECEITA.descricao);
    await page.getByRole('menuitem', { name: 'Marcar como recebido' }).click();
    const d = page.getByRole('dialog', { name: 'Dar baixa no lançamento?' });
    await expect(d.getByRole('radio')).toHaveCount(5);
    await expect(d.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(d.getByRole('button', { name: 'Confirmar recebimento' })).toBeDisabled();
    await d.getByRole('radio', { name: 'Dinheiro' }).check();
    await expect(d.getByRole('button', { name: 'Confirmar recebimento' })).toBeEnabled();
    await d.getByRole('button', { name: 'Cancelar' }).click();
    expect(await ultimaEscrita(page)).toBeUndefined();
    // reabrir: a escolha anterior não volta
    await menuDe(page, PENDENTE_RECEITA.descricao);
    await page.getByRole('menuitem', { name: 'Marcar como recebido' }).click();
    await expect(d.getByRole('radio', { checked: true })).toHaveCount(0);
  });

  test('baixa com forma já guardada: ela aparece marcada, pode ser trocada e a escolhida é enviada', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const seguro = transacoes.find((t) => t.descricao.startsWith('Seguro do estab'))!;
    await abrir(page, tema);
    await irParaContas(page);
    await menuDe(page, seguro.descricao);
    await page.getByRole('menuitem', { name: 'Marcar como pago' }).click();
    const d = page.getByRole('dialog', { name: 'Dar baixa no lançamento?' });
    await expect(d.getByRole('radio', { name: 'Boleto / Faturado' })).toBeChecked();
    await expect(d.getByRole('button', { name: 'Confirmar pagamento' })).toBeEnabled();
    await d.getByRole('radio', { name: 'Dinheiro' }).check();
    await d.getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.caminho).toContain(`/${seguro.id}/liquidar`);
    expect(e.corpo).toMatchObject({ forma_pagamento: 'Dinheiro' });
  });

  test('desktop: botão de baixa na linha também passa pela confirmação', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura < 1024, 'só desktop');
    await abrir(page, tema);
    await irParaContas(page);
    await linha(page, PENDENTE_DESPESA.descricao).getByRole('button', { name: `Pagar ${PENDENTE_DESPESA.descricao}` }).click();
    await expect(page.getByRole('dialog', { name: 'Dar baixa no lançamento?' })).toBeVisible();
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('excluir exige confirmação; cancelar não apaga; confirmar remove da lista', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaContas(page);
    await menuDe(page, DESPESA_PAGA.descricao);
    await page.getByRole('menuitem', { name: 'Excluir lançamento' }).click();
    const d = page.getByRole('dialog', { name: 'Excluir lançamento?' });
    await expect(d).toContainText(DESPESA_PAGA.descricao);
    await d.getByRole('button', { name: 'Cancelar' }).click();
    expect(await ultimaEscrita(page)).toBeUndefined();
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.length);

    await menuDe(page, DESPESA_PAGA.descricao);
    await page.getByRole('menuitem', { name: 'Excluir lançamento' }).click();
    await d.getByRole('button', { name: 'Excluir lançamento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.metodo).toBe('DELETE');
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.length - 1);
  });
});

test.describe('falha da API nas confirmações', () => {
  const falha500 = { status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ detail: 'Servidor fora do ar' }) };

  test('baixa que falha: a folha continua aberta com o erro dentro dela e dá para tentar de novo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    let falhar = true;
    await page.route('**/api/v1/transacoes-financeiras/*/*/liquidar', (r) => (falhar ? r.fulfill(falha500) : r.fallback()));
    const dialogos: string[] = [];
    page.on('dialog', (dl) => {
      dialogos.push(dl.message());
      void dl.dismiss();
    });
    await irParaContas(page);
    await menuDe(page, PENDENTE_RECEITA.descricao);
    await page.getByRole('menuitem', { name: 'Marcar como recebido' }).click();
    const d = page.getByRole('dialog', { name: 'Dar baixa no lançamento?' });
    await d.getByRole('radio', { name: 'PIX' }).check();
    await d.getByRole('button', { name: 'Confirmar recebimento' }).click();
    await expect(d.getByRole('alert')).toBeVisible();
    await expect(d).toBeVisible();
    expect(dialogos).toEqual([]);
    // dinheiro: a baixa que falhou não pode aparecer como recebida
    await expect(linha(page, PENDENTE_RECEITA.descricao)).toContainText('Pendente');
    await expect(linha(page, PENDENTE_RECEITA.descricao)).not.toContainText('Recebido');
    falhar = false;
    await d.getByRole('button', { name: 'Confirmar recebimento' }).click();
    await expect(d).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'RECEBIDO' })).toBeVisible();
  });

  test('exclusão que falha: a folha continua aberta com o erro dentro dela e dá para tentar de novo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    let falhar = true;
    await page.route(`**/api/v1/transacoes-financeiras/*/${DESPESA_PAGA.id}`, (r) =>
      falhar && r.request().method() === 'DELETE' ? r.fulfill(falha500) : r.fallback()
    );
    const dialogos: string[] = [];
    page.on('dialog', (dl) => {
      dialogos.push(dl.message());
      void dl.dismiss();
    });
    await irParaContas(page);
    await menuDe(page, DESPESA_PAGA.descricao);
    await page.getByRole('menuitem', { name: 'Excluir lançamento' }).click();
    const d = page.getByRole('dialog', { name: 'Excluir lançamento?' });
    await d.getByRole('button', { name: 'Excluir lançamento' }).click();
    await expect(d.getByRole('alert')).toBeVisible();
    await expect(d).toBeVisible();
    expect(dialogos).toEqual([]);
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.length);
    falhar = false;
    await d.getByRole('button', { name: 'Excluir lançamento' }).click();
    await expect(d).toHaveCount(0);
    await expect(lista(page).getByRole('listitem')).toHaveCount(transacoes.length - 1);
    // reabrir outra exclusão não mostra o erro antigo
    await menuDe(page, RECEITA_PAGA.descricao);
    await page.getByRole('menuitem', { name: 'Excluir lançamento' }).click();
    await expect(d.getByRole('alert')).toHaveCount(0);
  });
});

// 10/11/2026 às 22:00 em São Paulo = 01:00Z do dia 11: em UTC "hoje" já virou amanhã.
const NOITE_SP = new Date('2026-11-11T01:00:00Z');
const HOJE_SP = '2026-11-10';

test.describe('datas no calendário local (22h em São Paulo)', () => {
  test('dar baixa às 22h grava a data de hoje, não a de amanhã', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await page.clock.setFixedTime(NOITE_SP);
    await abrir(page, tema);
    await irParaContas(page);
    await menuDe(page, PENDENTE_RECEITA.descricao);
    await page.getByRole('menuitem', { name: 'Marcar como recebido' }).click();
    const d = page.getByRole('dialog', { name: 'Dar baixa no lançamento?' });
    await d.getByRole('radio', { name: 'PIX' }).check();
    await d.getByRole('button', { name: 'Confirmar recebimento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.caminho).toContain(`/${PENDENTE_RECEITA.id}/liquidar`);
    expect(e.corpo).toEqual({ data_liquidacao: HOJE_SP, forma_pagamento: 'PIX' });
  });

  test('novo lançamento abre com o foco no primeiro campo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    await exigirFocoNoPrimeiroCampo(page.getByRole('dialog', { name: 'Novo lançamento' }), 'Descrição *');
  });

  test('novo lançamento às 22h: vencimento padrão é hoje; "já foi paga" sem vencimento liquida hoje', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await page.clock.setFixedTime(NOITE_SP);
    await abrir(page, tema);
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const d = page.getByRole('dialog', { name: 'Novo lançamento' });
    await expect(d.getByLabel('Vencimento *')).toHaveValue(HOJE_SP);

    await d.getByLabel('Descrição *').fill('Taxa');
    await d.getByLabel('Valor (R$) *').fill('35');
    await d.getByLabel('Vencimento *').evaluate((el) => el.removeAttribute('required'));
    await d.getByLabel('Vencimento *').fill('');
    await d.getByRole('checkbox', { name: /Já foi (paga|recebida)/ }).check();
    await d.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.corpo).toMatchObject({ status: 'LIQUIDADO', data_liquidacao: HOJE_SP });
  });
});

test.describe('período personalizado inválido', () => {
  test('data final antes da inicial: limites nos campos e aviso no próprio seletor', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('combobox', { name: 'Período' }).selectOption('CUSTOM');
    const de = page.getByLabel('De', { exact: true });
    const ate = page.getByLabel('Até', { exact: true });
    await de.fill('2026-03-10');
    await ate.fill('2026-03-20');
    await expect(de).toHaveAttribute('max', '2026-03-20');
    await expect(ate).toHaveAttribute('min', '2026-03-10');
    const grupo = page.getByRole('group', { name: 'Período do relatório' });
    await expect(grupo.getByRole('alert')).toHaveCount(0);
    await ate.fill('2026-03-01');
    await expect(grupo.getByRole('alert')).toHaveText('A data final não pode ser anterior à inicial.');
    await expect(ate).toHaveAttribute('aria-invalid', 'true');
    await ate.fill('2026-03-15');
    await expect(grupo.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('formulário de lançamento', () => {
  test('novo lançamento: despesa por padrão; troca para receita muda as categorias; salva o que foi digitado', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const d = page.getByRole('dialog', { name: 'Novo lançamento' });
    await expect(d.getByRole('radio', { name: 'Despesa (a pagar)' })).toBeChecked();
    await expect(d.getByLabel('Categoria *')).toHaveValue('ALUGUEL');
    await d.getByRole('radio', { name: 'Receita (a receber)' }).check();
    await expect(d.getByLabel('Categoria *')).toHaveValue('APORTE');
    await d.getByRole('radio', { name: 'Despesa (a pagar)' }).check();

    await d.getByLabel('Descrição *').fill('Conta de água');
    await d.getByLabel('Categoria *').selectOption('ENERGIA_AGUA');
    await d.getByLabel('Valor (R$) *').fill('150.50');
    await d.getByLabel('Vencimento *').fill('2026-11-20');
    await d.getByLabel('Forma de pagamento').selectOption('Boleto / Faturado');
    await d.getByLabel('Observações').fill('NF 123');
    await d.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('POST');
    expect(e.corpo).toMatchObject({
      tipo: 'DESPESA',
      descricao: 'Conta de água',
      categoria: 'ENERGIA_AGUA',
      valor: 150.5,
      data_vencimento: '2026-11-20',
      status: 'PENDENTE',
      data_liquidacao: null,
      forma_pagamento: 'Boleto / Faturado',
      observacoes: 'NF 123',
    });
    await expect(d).toHaveCount(0);
  });

  test('"já foi paga" grava liquidado com a data do vencimento; valor zero mostra erro na própria folha', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const d = page.getByRole('dialog', { name: 'Novo lançamento' });
    await d.getByLabel('Descrição *').fill('Taxa');
    await d.getByLabel('Valor (R$) *').fill('0');
    await d.getByLabel('Valor (R$) *').evaluate((el) => el.removeAttribute('min'));
    await d.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect(d.getByRole('alert')).toContainText('Informe um valor válido maior que zero.');
    expect(await ultimaEscrita(page)).toBeUndefined();
    await d.getByLabel('Valor (R$) *').fill('35');
    await d.getByLabel('Vencimento *').fill('2026-11-05');
    await d.getByRole('checkbox', { name: /Já foi paga/ }).check();
    await d.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.corpo).toMatchObject({ status: 'LIQUIDADO', data_liquidacao: '2026-11-05', valor: 35 });
  });

  test('editar abre preenchido; Esc com dados alterados pede "Descartar alterações?"', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaContas(page);
    await menuDe(page, DESPESA_PAGA.descricao);
    await page.getByRole('menuitem', { name: 'Editar lançamento' }).click();
    const d = page.getByRole('dialog', { name: 'Editar lançamento' });
    await expect(d.getByLabel('Descrição *')).toHaveValue(DESPESA_PAGA.descricao);
    await expect(d.getByLabel('Categoria *')).toHaveValue(DESPESA_PAGA.categoria);
    await expect(d.getByRole('checkbox', { name: /Já foi paga/ })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);

    await menuDe(page, DESPESA_PAGA.descricao);
    await page.getByRole('menuitem', { name: 'Editar lançamento' }).click();
    await d.getByLabel('Descrição *').fill('Outro nome');
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(d.getByLabel('Descrição *')).toHaveValue('Outro nome');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await d.getByRole('button', { name: 'Descartar' }).click();
    await expect(d).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('salvar edição envia PUT com o mesmo tipo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaContas(page);
    await menuDe(page, PENDENTE_DESPESA.descricao);
    await page.getByRole('menuitem', { name: 'Editar lançamento' }).click();
    const d = page.getByRole('dialog', { name: 'Editar lançamento' });
    await d.getByLabel('Valor (R$) *').fill('6400');
    await d.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('PUT');
    expect(e.caminho).toContain(`/${PENDENTE_DESPESA.id}`);
    expect(e.corpo).toMatchObject({ tipo: 'DESPESA', valor: 6400, status: 'PENDENTE', categoria: PENDENTE_DESPESA.categoria });
  });
});

test.describe('estados', () => {
  test('sem dados: zeros rotulados, contas e BI com estado vazio, sem rolagem lateral', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page, tema, 'vazio');
    await expect(resumo(page)).toContainText(brl(0));
    await expect(abas(page).getByRole('tab').nth(2)).toHaveText('Contas');
    await aba(page, 'Contas').click();
    await expect(page.getByRole('heading', { name: 'Nenhum lançamento no período' })).toBeVisible();
    await aba(page, 'BI').click();
    await expect(page.getByRole('tabpanel')).toContainText('Nenhum mecânico com OS finalizada.');
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('perfil sem acesso ao financeiro não vê os números', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'MECANICO', tema);
    await abrirTela(page, 'financeiro');
    await expect(page.getByText(/Lucro líquido/)).toHaveCount(0);
  });
});
