import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const diasAntes = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10);
};

const botaoPeriodo = (page: Page) => page.getByRole('button', { name: /^(Últimos|Período) / });

async function medir(page: Page, largura: number) {
  const grupo = (await page.getByRole('group', { name: 'Período do quadro' }).boundingBox())!;
  const atualizar = (await page.getByRole('button', { name: 'Atualizar' }).boundingBox())!;
  const nova = (await page.getByRole('button', { name: 'Nova ordem de serviço' }).boundingBox())!;
  const centro = (c: { y: number; height: number }) => c.y + c.height / 2;
  expect(Math.abs(centro(grupo) - centro(atualizar))).toBeLessThanOrEqual(4);
  expect(Math.abs(centro(grupo) - centro(nova))).toBeLessThanOrEqual(4);
  expect(atualizar.width).toBeGreaterThanOrEqual(44);
  expect(atualizar.height).toBeGreaterThanOrEqual(44);
  expect(nova.height).toBeGreaterThanOrEqual(44);
  expect((await botaoPeriodo(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // ordem visual: período à esquerda, depois atualizar, depois a ação principal; nada fora da tela
  expect(grupo.x).toBeLessThan(atualizar.x);
  expect(atualizar.x).toBeLessThan(nova.x);
  expect(nova.x + nova.width).toBeLessThanOrEqual(largura);
  expect(grupo.x + grupo.width).toBeLessThanOrEqual(atualizar.x + 1);
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

test.describe('radar: cabeçalho do celular numa linha só', () => {
  for (const largura of [360, 390, 430]) {
    test(`${largura}px: período, atualizar (ícone) e "Nova OS" na mesma linha, também com período personalizado`, async ({ page }, info) => {
      const { tema, largura: projeto } = contextoDoProjeto(info);
      test.skip(projeto >= 1024, 'só celular');
      await page.setViewportSize({ width: largura, height: 844 });
      await simularBackend(page, 'cheio');
      await entrarComo(page, 'DONO', tema);
      await abrirTela(page, 'radar');

      // nomes acessíveis intactos; texto curto só no celular
      await expect(page.getByRole('button', { name: 'Nova ordem de serviço' })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Atualizar' })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Nova ordem de serviço' })).toContainText('Nova OS');
      await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 7 dias');
      await expect(page.getByText('Nova ordem de serviço', { exact: true })).toBeHidden();
      await medir(page, largura);

      // título logo acima da linha de controles
      const titulo = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      const grupo = (await page.getByRole('group', { name: 'Período do quadro' }).boundingBox())!;
      expect(grupo.y).toBeGreaterThanOrEqual(titulo.y + titulo.height);
      expect(grupo.y - (titulo.y + titulo.height)).toBeLessThan(40);

      // período personalizado: rótulo mais longo, ainda cabe
      const hoje = hojeSP();
      await botaoPeriodo(page).click();
      await page.getByRole('menuitemradio', { name: 'Personalizado' }).click();
      await page.getByLabel('De', { exact: true }).fill(diasAntes(hoje, 20));
      await page.getByLabel('Até', { exact: true }).fill(diasAntes(hoje, 2));
      await page.getByRole('button', { name: 'Aplicar' }).click();
      await expect(botaoPeriodo(page)).toHaveAccessibleName(/^Período \d\d\/\d\d – \d\d\/\d\d$/);
      await medir(page, largura);
      exigirRedeCompleta(page);
    });
  }

  test('a partir de 640px o botão principal mostra o texto completo', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await page.setViewportSize({ width: 700, height: 900 });
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');
    await expect(page.getByRole('button', { name: 'Nova ordem de serviço' })).toContainText('Nova ordem de serviço');
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });

  test('Atualizar gira o ícone enquanto carrega e refaz as leituras', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');
    await page.route(/\/os\/\?/, async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fallback();
    });
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByRole('button', { name: 'Atualizar' }).locator('svg.animate-spin')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Atualizar' }).locator('svg.animate-spin')).toHaveCount(0, { timeout: 10_000 });
  });
});
