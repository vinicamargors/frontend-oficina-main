import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, estoque, exigirRedeCompleta, simularBackend, type Cenario } from './mocks';
import { coletarErros, contextoDoProjeto, exigirFocoNoPrimeiroCampo } from './contexto';

type Escrita = { metodo: string; caminho: string; corpo: Record<string, unknown> } | undefined;
const ultimaEscrita = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ultimaEscrita?: unknown }).__ultimaEscrita as Escrita);

async function abrir(page: Page, tema: 'claro' | 'escuro', cenario: Cenario = 'cheio') {
  await simularBackend(page, cenario);
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'estoque');
}

const lista = (page: Page) => page.getByRole('list', { name: 'Peças em estoque' });
const linha = (page: Page, nome: string) => lista(page).getByRole('listitem').filter({ hasText: nome }).first();
const chips = (page: Page) => page.getByRole('group', { name: 'Filtrar por categoria' });
const ITEM = estoque[1]; // Filtro de ar condicionado: 3 un., mínimo 5 (baixo)
const OK = estoque[0]; // Filtro de óleo PH5949: 24 un.
const baixos = estoque.filter((e) => e.quantidade <= e.minimo_alerta);

async function menuDe(page: Page, nome: string) {
  await linha(page, nome).getByRole('button', { name: `Mais ações de ${nome}` }).click();
}

test.describe('lista de peças', () => {
  test('cabeçalho, indicadores, busca, todas as peças visíveis e sem rolagem lateral', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page, tema);

    await expect(page.getByRole('heading', { level: 1, name: 'Estoque de Peças' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).locator('xpath=..')).toContainText(String(estoque.length));
    await expect(page.getByRole('button', { name: /Nova peça/ })).toHaveCount(1);
    await expect(page.getByRole('searchbox', { name: /Buscar peça/ })).toBeVisible();
    const capital = estoque.reduce((s, i) => s + i.quantidade * i.custo, 0);
    await expect(page.getByText('Capital em custo')).toBeVisible();
    await expect(page.getByText(capital.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' '))).toBeVisible();
    await expect(page.getByText('Potencial de venda')).toBeVisible();
    await expect(page.getByText('Abaixo do mínimo')).toBeVisible();

    await expect(lista(page).getByRole('listitem')).toHaveCount(estoque.length);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('linha mostra nome, categoria com acento, SKU, preço, saldo e sinaliza peça abaixo do mínimo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const l = linha(page, ITEM.nome);
    await expect(l).toContainText(ITEM.nome);
    await expect(l).toContainText(ITEM.codigo!);
    await expect(l).toContainText(/R\$\s54,90/);
    await expect(l.getByText('3 un.')).toBeVisible();
    await expect(l.getByText(/Baixo/)).toBeVisible();
    await expect(linha(page, OK.nome).getByText(/Baixo/)).toHaveCount(0);
    await expect(linha(page, OK.nome).getByText('24 un.')).toBeVisible();
  });

  test('busca por nome, SKU e categoria; sem resultado mostra estado vazio com "Limpar filtros"', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const busca = page.getByRole('searchbox', { name: /Buscar peça/ });
    await busca.fill('pc-1004');
    await expect(lista(page).getByRole('listitem')).toHaveCount(1);
    await expect(lista(page)).toContainText('Fluido de freio DOT4');
    await busca.fill('zzzz');
    await expect(page.getByRole('heading', { name: 'Nenhum item encontrado' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(estoque.length);
  });
});

test.describe('chips de categoria', () => {
  test('categorias com acento na tela; filtram por categoria e por crítico; Todas limpa', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const todas = chips(page).getByRole('button', { name: /^Todas/ });
    await expect(todas).toHaveAttribute('aria-pressed', 'true');
    await expect(chips(page).getByRole('button', { name: /^Peças/ })).toHaveCount(1);
    await expect(chips(page).getByRole('button', { name: /^Elétrica/ })).toHaveCount(1);
    await expect(chips(page).getByRole('button', { name: /^PECAS|^ELETRICA/ })).toHaveCount(0);

    await chips(page).getByRole('button', { name: /^Fluidos/ }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(estoque.filter((e) => e.categoria === 'FLUIDOS').length);
    await chips(page).getByRole('button', { name: /^Crítico/ }).click();
    await expect(chips(page).getByRole('button', { name: /^Crítico/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(lista(page).getByRole('listitem')).toHaveCount(baixos.length);
    await todas.click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(estoque.length);
  });

  test('faixa de chips numa linha só, com alvos de 44px e sem rolar a página', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    const faixa = (await chips(page).boundingBox())!;
    expect(faixa.height).toBeLessThanOrEqual(56);
    expect(await chips(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    for (const b of await chips(page).getByRole('button').all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // chip ativo escolhido no fim da faixa fica à vista
    await chips(page).getByRole('button', { name: /^Acessórios/ }).scrollIntoViewIfNeeded();
    await chips(page).getByRole('button', { name: /^Acessórios/ }).click();
    const ativo = (await chips(page).locator('[data-ativo]').boundingBox())!;
    expect(ativo.x).toBeGreaterThanOrEqual(0);
    expect(ativo.x + ativo.width).toBeLessThanOrEqual(largura);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe('celular: lista vertical compacta', () => {
  test('todas as peças numa lista vertical, linhas de 64 a 96px, alvos de 44px', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    const itens = await lista(page).getByRole('listitem').all();
    expect(itens).toHaveLength(estoque.length);
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
  });
});

test.describe('ações da peça', () => {
  test('o menu tem entrada, saída, etiqueta, editar e excluir; Esc fecha', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, ITEM.nome);
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([
      /Registrar entrada/,
      /Registrar saída/,
      /Imprimir etiqueta/,
      /Editar peça/,
      /Excluir peça/,
    ]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('o menu nunca fica escondido atrás da barra inferior do celular', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    await menuDe(page, ITEM.nome);
    const menu = (await page.getByRole('menu').boundingBox())!;
    const nav = (await page.getByRole('navigation', { name: 'Navegação Rápida Mobile' }).boundingBox())!;
    expect(menu.y + menu.height).toBeLessThanOrEqual(nav.y);
    expect(menu.y).toBeGreaterThanOrEqual(0);
  });

  test('entrada: abre folha com quantidade, mostra o saldo depois e só grava ao confirmar', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, ITEM.nome);
    await page.getByRole('menuitem', { name: /Registrar entrada/ }).click();
    const d = page.getByRole('dialog', { name: 'Entrada no estoque' });
    await expect(d).toBeVisible();
    await expect(d).toContainText(ITEM.nome);
    await expect(d).toContainText('Saldo atual');
    expect(await ultimaEscrita(page)).toBeUndefined();

    await d.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await d.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await expect(d.getByRole('spinbutton', { name: /Quantidade/ })).toHaveValue('3');
    await expect(d).toContainText('Saldo depois: 6 un.');
    expect(await ultimaEscrita(page)).toBeUndefined();

    await d.getByRole('button', { name: /Confirmar entrada de 3/ }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('PATCH');
    expect(e.caminho).toContain(`/${ITEM.id}/ajustar`);
    expect(e.corpo).toEqual({ tipo: 'entrada', quantidade: 3 });
    await expect(d).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'registrada' })).toBeVisible();
  });

  test('saída: folha própria, cancelar não grava', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, ITEM.nome);
    await page.getByRole('menuitem', { name: /Registrar saída/ }).click();
    const d = page.getByRole('dialog', { name: 'Saída do estoque' });
    await expect(d.getByRole('button', { name: /Confirmar saída de 1/ })).toBeVisible();
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await expect(d).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('excluir exige confirmação; cancelar não apaga; confirmar remove da lista', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, ITEM.nome);
    await page.getByRole('menuitem', { name: /Excluir peça/ }).click();
    const d = page.getByRole('dialog', { name: 'Excluir peça do estoque?' });
    await expect(d).toContainText(ITEM.nome);
    await d.getByRole('button', { name: 'Cancelar' }).click();
    expect(await ultimaEscrita(page)).toBeUndefined();
    await expect(lista(page).getByRole('listitem')).toHaveCount(estoque.length);

    await menuDe(page, ITEM.nome);
    await page.getByRole('menuitem', { name: /Excluir peça/ }).click();
    await d.getByRole('button', { name: 'Excluir peça' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.metodo).toBe('DELETE');
    await expect(lista(page).getByRole('listitem')).toHaveCount(estoque.length - 1);
  });

  test('etiqueta abre com código de barras e botão Imprimir', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, OK.nome);
    await page.getByRole('menuitem', { name: /Imprimir etiqueta/ }).click();
    const d = page.getByRole('dialog', { name: 'Etiqueta com código de barras' });
    await expect(d.locator('#etiqueta-impressao svg')).toBeVisible();
    await expect(d.locator('#etiqueta-impressao')).toContainText(OK.codigo!);
    await expect(d.getByRole('button', { name: /Imprimir etiqueta/ })).toBeVisible();
  });

  test('exportar CSV baixa o arquivo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^estoque_mecanify_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('exportar CSV às 22h em São Paulo leva a data local no nome', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await page.clock.setFixedTime(new Date('2026-11-11T01:00:00Z')); // 10/11 22:00 local
    await abrir(page, tema);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('estoque_mecanify_2026-11-10.csv');
  });
});

test.describe('formulário da peça', () => {
  test('abre com o foco no primeiro campo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Nova peça/ }).click();
    await exigirFocoNoPrimeiroCampo(page.getByRole('dialog', { name: 'Nova peça no estoque' }));
  });

  test('nova peça: salva com os valores digitados', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Nova peça/ }).click();
    const d = page.getByRole('dialog', { name: 'Nova peça no estoque' });
    await d.getByLabel(/Nome da peça/).fill('Correia poly-V');
    await d.getByLabel(/Código/).fill('cv-1');
    await d.getByLabel(/Quantidade em saldo/).fill('4');
    await d.getByLabel(/Custo unitário/).fill('30');
    await d.getByLabel(/Preço de venda/).fill('55.5');
    await d.getByRole('button', { name: 'Salvar peça' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('POST');
    expect(e.corpo).toMatchObject({ nome: 'Correia poly-V', codigo: 'CV-1', quantidade: 4, custo: 30, venda: 55.5 });
    await expect(d).toHaveCount(0);
  });

  test('editar abre preenchido; Esc com dados alterados pede "Descartar alterações?"', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, OK.nome);
    await page.getByRole('menuitem', { name: /Editar peça/ }).click();
    const d = page.getByRole('dialog', { name: 'Editar peça' });
    await expect(d.getByLabel(/Nome da peça/)).toHaveValue(OK.nome);
    // sem alteração, Esc fecha direto
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);

    await menuDe(page, OK.nome);
    await page.getByRole('menuitem', { name: /Editar peça/ }).click();
    await d.getByLabel(/Nome da peça/).fill('Outro nome');
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(d.getByLabel(/Nome da peça/)).toHaveValue('Outro nome');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await d.getByRole('button', { name: 'Descartar' }).click();
    await expect(d).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });
});

test.describe('categorias', () => {
  test('gerenciar categorias: criar, e reclassificar pede confirmação na própria folha', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /^Categorias/ }).click();
    const d = page.getByRole('dialog', { name: 'Gerenciar categorias' });
    await d.getByLabel(/Nome da nova categoria/).fill('Lubrificantes');
    await d.getByRole('button', { name: 'Criar' }).click();
    await d.getByRole('button', { name: 'Fechar' }).click();
    await expect(chips(page).getByRole('button', { name: /^Lubrificantes/ })).toBeVisible();

    await page.getByRole('button', { name: /^Categorias/ }).click();
    await d.getByRole('button', { name: 'Excluir categoria Fluidos' }).click();
    await expect(d.getByRole('alert')).toContainText('reclassificá-los para "Diversos"');
    expect(await ultimaEscrita(page)).toBeUndefined();
    await d.getByRole('button', { name: 'Manter categoria' }).click();
    await expect(d.getByRole('alert')).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });
});

test.describe('categorias: nome digitado e não criado', () => {
  test('Esc com nome digitado pergunta "Descartar alterações?"; vazio fecha direto', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /^Categorias/ }).click();
    const d = page.getByRole('dialog', { name: 'Gerenciar categorias' });
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);

    await page.getByRole('button', { name: /^Categorias/ }).click();
    await d.getByLabel(/Nome da nova categoria/).fill('Suspensão');
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(d.getByLabel(/Nome da nova categoria/)).toHaveValue('Suspensão');

    await d.getByRole('button', { name: 'Fechar' }).click();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Descartar' }).click();
    await expect(d).toHaveCount(0);
    await page.getByRole('button', { name: /^Categorias/ }).click();
    await expect(d.getByLabel(/Nome da nova categoria/)).toHaveValue('');
  });
});

test.describe('estados', () => {
  test('sem peças: estado vazio com chamada para cadastrar', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema, 'vazio');
    await expect(page.getByRole('heading', { name: 'Nenhum item encontrado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar peça' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test('perfil sem financeiro não vê custo, margem nem capital', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'MECANICO', tema);
    await abrirTela(page, 'estoque');
    await expect(lista(page).getByRole('listitem')).toHaveCount(estoque.length);
    await expect(page.getByText('Capital em custo')).toHaveCount(0);
    await expect(page.getByText('Margem')).toHaveCount(0);
  });
});

test.describe('menu por teclado e categorias ambíguas', () => {
  test('saldo zero: setas e Home/End pulam "Registrar saída" desabilitado', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await page.route('**/api/v1/estoque/*', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const itens = [{ ...estoque[0], quantidade: 0 }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ itens, stats: { total_itens: 1, estoque_baixo: 1, valor_total_custo: 0, valor_total_venda: 0 } }),
      });
    });
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'estoque');
    await menuDe(page, estoque[0].nome);
    const itens = page.getByRole('menuitem');
    await expect(itens.filter({ hasText: 'Registrar saída' })).toBeDisabled();
    await expect(itens.filter({ hasText: 'Registrar entrada' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(itens.filter({ hasText: 'Imprimir etiqueta' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(itens.filter({ hasText: 'Editar peça' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(itens.filter({ hasText: 'Registrar entrada' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(itens.filter({ hasText: 'Excluir peça' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(itens.filter({ hasText: 'Registrar entrada' })).toBeFocused();
  });

  test('ELETRICA e ELÉTRICA no mesmo estoque: chips e opções distinguíveis; criar "elétrica" não duplica', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await page.route('**/api/v1/estoque/*', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const itens = [
        { ...estoque[11], categoria: 'ELETRICA' },
        { ...estoque[12], categoria: 'ELÉTRICA' },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ itens, stats: { total_itens: 2, estoque_baixo: 0, valor_total_custo: 0, valor_total_venda: 0 } }),
      });
    });
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'estoque');
    const a = chips(page).getByRole('button', { name: /^Elétrica \(ELETRICA\)/ });
    const b = chips(page).getByRole('button', { name: /^Elétrica \(ELÉTRICA\)/ });
    await expect(a).toHaveCount(1);
    await expect(b).toHaveCount(1);
    await b.click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(1);
    await expect(lista(page)).toContainText(estoque[12].nome);

    await page.getByRole('button', { name: /^Nova peça/ }).click();
    const opcoes = page.getByRole('dialog', { name: 'Nova peça no estoque' }).getByLabel('Categoria *').locator('option');
    const textos = await opcoes.allTextContents();
    expect(new Set(textos).size).toBe(textos.length);
    await page.keyboard.press('Escape');

    const botao = page.getByRole('button', { name: /^Categorias \(/ });
    const antes = await botao.textContent();
    await botao.click();
    const d = page.getByRole('dialog', { name: 'Gerenciar categorias' });
    await d.getByLabel(/Nome da nova categoria/).fill('elétrica');
    await d.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'já existe' })).toBeVisible();
    await d.getByRole('button', { name: 'Fechar' }).click();
    await expect(botao).toHaveText(antes!);
  });

  test('saída acima do saldo avisa que o saldo ficará negativo (sem bloquear)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, ITEM.nome); // saldo 3
    await page.getByRole('menuitem', { name: /Registrar saída/ }).click();
    const d = page.getByRole('dialog', { name: 'Saída do estoque' });
    await d.getByRole('spinbutton', { name: /Quantidade/ }).fill('5');
    await expect(d).toContainText('Saldo ficará negativo');
    const confirmar = d.getByRole('button', { name: /Confirmar saída de 5 un\. \(saldo negativo\)/ });
    await expect(confirmar).toBeEnabled();
  });
});
