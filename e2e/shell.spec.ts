import { expect, test } from '@playwright/test';
import { abrirTela, entrarComo, exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

const DESKTOP = 'Menu Principal da Oficina';
const MOBILE = 'Navegação Rápida Mobile';

test.describe('shell desktop', () => {
  test.beforeEach(({}, info) => {
    test.skip(contextoDoProjeto(info).largura < 1024, 'só desktop');
  });

  test('menu lateral: 240px, itens de 40px, ativo com aria-current e cargo legível', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');

    const menu = page.getByRole('complementary', { name: DESKTOP });
    const largura = await menu.evaluate((el) => el.getBoundingClientRect().width);
    expect(largura).toBe(240);

    const itens = menu.getByRole('navigation').getByRole('button');
    expect(await itens.count()).toBeGreaterThanOrEqual(7);
    for (const caixa of await itens.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(caixa).toBeGreaterThanOrEqual(40);
    }

    await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(menu.locator('[aria-current="page"]')).toContainText('Radar do Pátio');

    await expect(menu.getByRole('img', { name: 'Mecanify' })).toBeVisible();
    await expect(menu.getByText('Dono', { exact: true })).toBeVisible();
    await expect(menu.getByText('DONO', { exact: true })).toHaveCount(0);

    await menu.getByRole('button', { name: 'Ordens de Serviço' }).click();
    await expect(menu.locator('[aria-current="page"]')).toContainText('Ordens de Serviço');
    exigirRedeCompleta(page);
  });

  test('"Sair" é discreto (não usa a variante perigo)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');
    const sair = page.getByRole('complementary', { name: DESKTOP }).getByRole('button', { name: /sair/i });
    await expect(sair).toBeVisible();
    await expect(sair).not.toHaveClass(/danger/);
    const fundo = await sair.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(fundo);
    const cor = await sair.evaluate((el) => getComputedStyle(el).color);
    const dangerSolid = await page.evaluate(() => {
      const t = document.createElement('i');
      t.className = 'text-danger';
      document.body.append(t);
      const c = getComputedStyle(t).color;
      t.remove();
      return c;
    });
    expect(cor).not.toBe(dangerSolid);
    exigirRedeCompleta(page);
  });

  test('alternar tema no rodapé do menu muda a classe dark e as metas theme-color', async ({ page }) => {
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', 'claro');
    await abrirTela(page, 'radar');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
    const menu = page.getByRole('complementary', { name: DESKTOP });
    await menu.getByRole('button', { name: 'Mudar para tema escuro' }).click();
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
    const metas = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
    expect(metas).toEqual(['#111214', '#111214']);
    await menu.getByRole('button', { name: 'Mudar para tema claro' }).click();
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
    const claras = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
    expect(claras).toEqual(['#F1EDE4', '#F1EDE4']);
    exigirRedeCompleta(page);
  });

  test('MECÂNICO vê só as abas permitidas', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'MECANICO', tema);
    await abrirTela(page, 'radar');
    const menu = page.getByRole('complementary', { name: DESKTOP });
    const nomes = await menu.getByRole('navigation').getByRole('button').allInnerTexts();
    expect(nomes.map((n) => n.trim())).toEqual([
      'Radar do Pátio',
      'Ordens de Serviço',
      'Clientes & Veículos',
      'Estoque de Peças',
    ]);
    await expect(menu.getByText('Mecânico', { exact: true })).toBeVisible();
    exigirRedeCompleta(page);
  });
});

test.describe('shell mobile', () => {
  test.beforeEach(({}, info) => {
    test.skip(contextoDoProjeto(info).largura >= 1024, 'só mobile');
  });

  test('barra inferior: ≤5 botões de 44px, "Mais" abre o resto, tema e sair', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');

    await expect(page.getByRole('banner').getByRole('img', { name: 'Mecanify' })).toBeVisible();
    const barra = page.getByRole('navigation', { name: MOBILE });
    const botoes = barra.getByRole('button');
    expect(await botoes.count()).toBeLessThanOrEqual(5);
    for (const b of await botoes.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { w: r.width, h: r.height };
      })
    )) {
      expect(b.h).toBeGreaterThanOrEqual(44);
      expect(b.w).toBeGreaterThanOrEqual(44);
    }
    await expect(barra.locator('[aria-current="page"]')).toContainText('Pátio');
    for (const fonte of await barra.locator('span').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))) {
      expect(fonte).toBeGreaterThanOrEqual(12);
    }

    const mais = barra.getByRole('button', { name: 'Mais' });
    await expect(mais).toHaveAttribute('aria-expanded', 'false');
    await mais.click();
    await expect(mais).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('dialog', { name: 'Mais opções' })).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByRole('dialog', { name: 'Mais opções' }).locator(':focus')).toHaveCount(1);
    const folha = page.getByRole('dialog', { name: 'Mais opções' });
    await expect(folha.getByRole('button', { name: 'Caixa & Financeiro' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Equipe & RH' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Dados da Oficina' })).toBeVisible();
    await expect(folha.getByText('Dono', { exact: true })).toBeVisible();
    await expect(folha.getByRole('button', { name: /sair/i })).not.toHaveClass(/danger/);

    await folha.getByRole('button', { name: /Mudar para tema/ }).click();
    await expect(page.locator('html')).toHaveClass(tema === 'claro' ? /(^|\s)dark(\s|$)/ : /^(?!.*\bdark\b)/);

    await folha.getByRole('button', { name: 'Equipe & RH' }).click();
    await expect(folha).toBeHidden();
    await expect(page).toHaveURL(/tab=equipe/);
    await expect(mais).toHaveAttribute('aria-current', 'page');
    exigirRedeCompleta(page);
  });

  test('MECÂNICO no celular: só as 4 abas dele mais "Mais"', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'MECANICO', tema);
    await abrirTela(page, 'radar');
    const barra = page.getByRole('navigation', { name: MOBILE });
    await expect(barra.getByRole('button')).toHaveCount(5);
    await expect(barra.getByRole('button', { name: /Caixa|Equipe|Oficina/ })).toHaveCount(0);
    exigirRedeCompleta(page);
  });
});
