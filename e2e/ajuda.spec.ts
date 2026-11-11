import { expect, test, type Page } from '@playwright/test';
import { entrarComo, exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

async function abrir(page: Page, cargo: 'DONO' | 'ATENDENTE' | 'MECANICO' | 'FINANCEIRO', tema: 'claro' | 'escuro', caminho: string, opcoes: Parameters<typeof entrarComo>[3] = {}) {
  await simularBackend(page, 'cheio');
  await entrarComo(page, cargo, tema, opcoes);
  await page.goto(caminho);
  await page.locator('h1').first().waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
}

test.describe('central de ajuda', () => {
  test('menu tem "Ajuda"; a lista mostra os 7 guias e a busca filtra', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    await abrir(page, 'DONO', tema, '/?tab=patio');
    if (largura < 1024) {
      await page.getByRole('button', { name: 'Mais', exact: true }).click();
      await page.getByRole('dialog', { name: 'Mais opções' }).getByRole('button', { name: 'Ajuda' }).click();
    } else {
      await page.getByRole('navigation').getByRole('button', { name: 'Ajuda' }).click();
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Ajuda' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Guias' }).getByRole('listitem')).toHaveCount(7);
    await page.getByRole('searchbox', { name: /Buscar um guia/ }).fill('whatsapp');
    await expect(page.getByRole('list', { name: 'Guias' }).getByRole('listitem')).toHaveCount(1);
    await page.getByRole('searchbox', { name: /Buscar um guia/ }).fill('zzzz');
    await expect(page.getByText(/Nenhum guia encontrado/)).toBeVisible();
    exigirRedeCompleta(page);
  });

  test('guia abre direto pela URL, com passos numerados e volta à lista', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, 'DONO', tema, '/?tab=ajuda&guia=abrir-os');
    await expect(page.getByRole('heading', { level: 1, name: 'Abrir uma ordem de serviço' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Passo 1:' })).toBeVisible();
    await page.getByRole('button', { name: 'Todos os guias' }).click();
    await expect(page.getByRole('list', { name: 'Guias' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('guia')).toBeNull();
  });

  test('guia de tela sem acesso não aparece para o cargo (mecânico)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, 'MECANICO', tema, '/?tab=ajuda');
    await expect(page.getByRole('list', { name: 'Guias' }).getByRole('listitem')).toHaveCount(6);
    await expect(page.getByText('Lançar uma conta e dar baixa')).toHaveCount(0);
    // por URL também não abre
    await page.goto('/?tab=ajuda&guia=conta-baixa');
    await expect(page.getByRole('heading', { level: 1, name: 'Ajuda' })).toBeVisible();
  });

  test('"?" refaz o tour mesmo se já visto e se pulou todos; só uma escrita na conta quando concluir', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, 'DONO', tema, '/?tab=patio'); // conta com "pular todos": nada automático
    await page.waitForTimeout(700);
    const cartao = page.getByRole('dialog').filter({ hasText: /Passo \d de \d/ });
    await expect(cartao).toHaveCount(0);
    await page.getByRole('main').getByRole('button', { name: 'Ajuda', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Refazer o tour desta página' }).click();
    await expect(cartao).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cartao).toHaveCount(0);
    // nenhuma escrita na API da oficina
    expect(await page.evaluate(() => (window as unknown as { __ultimaEscrita?: unknown }).__ultimaEscrita)).toBeUndefined();
  });

  test('"?" → "Ver guias de ajuda" abre a Ajuda; na própria Ajuda o botão some', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, 'DONO', tema, '/?tab=equipe');
    await page.getByRole('main').getByRole('button', { name: 'Ajuda', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Refazer o tour desta página' })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Ver guias de ajuda' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ajuda' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Ajuda', exact: true })).toHaveCount(0);
  });

  test('sem rolagem lateral', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, 'DONO', tema, '/?tab=ajuda&guia=receber-pagamento');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
