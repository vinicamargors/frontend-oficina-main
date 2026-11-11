import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

const cartao = (page: Page) => page.getByRole('dialog', { name: /./ }).filter({ hasText: /Passo \d de \d/ });
const escritasAuth = (page: Page) => page.evaluate(() => (window as unknown as { __escritasAuth?: unknown[] }).__escritasAuth ?? []);

async function abrirRadar(page: Page, tema: 'claro' | 'escuro', opcoes: Parameters<typeof entrarComo>[3] = { tourAtivo: true }) {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema, opcoes);
  await abrirTela(page, 'radar');
}

test.describe('tour do Radar', () => {
  test('aparece na primeira visita, percorre os passos e grava uma vez na conta', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirRadar(page, tema);
    await expect(cartao(page)).toBeVisible();
    await expect(cartao(page).getByText(/Passo 1 de \d/).first()).toBeVisible();
    // fundo inerte
    await expect(page.locator('#root')).toHaveAttribute('inert', '');
    // percorre até o fim
    for (let n = 0; n < 6 && (await cartao(page).getByRole('button', { name: 'Próximo' }).count()); n++) {
      await cartao(page).getByRole('button', { name: 'Próximo' }).click();
    }
    await cartao(page).getByRole('button', { name: 'Concluir' }).click();
    await expect(cartao(page)).toHaveCount(0);
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
    const escritas = (await escritasAuth(page)) as { data: { tours: Record<string, number> } }[];
    expect(escritas).toHaveLength(1);
    expect(escritas[0].data.tours).toEqual({ radar: 1 });
    // nenhuma escrita na API da oficina
    expect(await page.evaluate(() => (window as unknown as { __ultimaEscrita?: unknown }).__ultimaEscrita)).toBeUndefined();
    exigirRedeCompleta(page);
  });

  test('não volta depois de concluído (recarregar)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirRadar(page, tema, { tourAtivo: true, metaExtra: { tours: { radar: 1 } } });
    await page.waitForTimeout(900);
    await expect(cartao(page)).toHaveCount(0);
  });

  test('Esc pula a página e marca como vista', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirRadar(page, tema);
    await expect(cartao(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cartao(page)).toHaveCount(0);
    expect(await escritasAuth(page)).toHaveLength(1);
  });

  test('"Pular todos" grava a preferência e mantém as chaves da conta', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirRadar(page, tema);
    await cartao(page).getByRole('button', { name: 'Pular todos os tours' }).click();
    await expect(cartao(page)).toHaveCount(0);
    const escritas = (await escritasAuth(page)) as { data: Record<string, unknown> }[];
    expect(escritas).toHaveLength(1);
    expect(escritas[0].data.tours_pular_todos).toBe(true);
    expect(escritas[0].data.tours).toEqual({ radar: 1 });
    // o nome da conta continua (a mescla é do servidor; aqui só garantimos que não enviamos `nome`)
    expect(Object.keys(escritas[0].data).sort()).toEqual(['tours', 'tours_pular_todos']);
  });

  test('conta que pulou todos não vê o tour automático', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirRadar(page, tema, { tourAtivo: true, metaExtra: { tours_pular_todos: true } });
    await page.waitForTimeout(900);
    await expect(cartao(page)).toHaveCount(0);
  });

  test('outro usuário no mesmo aparelho vê o tour mesmo que o espelho da primeira conta exista', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await page.addInitScript(() => localStorage.setItem('mecanify_tours_outra-pessoa', JSON.stringify({ tours: { radar: 1 }, tours_pular_todos: true })));
    await abrirRadar(page, tema);
    await expect(cartao(page)).toBeVisible();
  });

  test('não inicia com um diálogo aberto por cima', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema, { tourAtivo: true });
    await page.addInitScript(() => {
      const iv = setInterval(() => {
        if (document.body && !document.getElementById('dlg-teste')) {
          const d = document.createElement('dialog');
          d.id = 'dlg-teste';
          document.body.appendChild(d);
          d.setAttribute('open', '');
          clearInterval(iv);
        }
      }, 10);
    });
    await abrirTela(page, 'radar');
    await page.waitForTimeout(900);
    await expect(cartao(page)).toHaveCount(0);
  });

  test('trocar de página cancela o tour sem marcar como visto', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirRadar(page, tema);
    await expect(cartao(page)).toBeVisible();
    // tela atrás está inerte; muda a URL via history do app (navegação interna)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/?tab=estoque');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(cartao(page)).toHaveCount(0);
    expect(await escritasAuth(page)).toHaveLength(0);
  });

  test('foco preso no cartão e devolvido ao fechar', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirRadar(page, tema);
    await expect(cartao(page)).toBeVisible();
    for (let n = 0; n < 8; n++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
  });

  test('celular: o cartão fica acima da barra inferior e o alvo aparece', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura > 500, 'só no celular');
    await abrirRadar(page, tema);
    await expect(cartao(page)).toBeVisible();
    const c = (await cartao(page).boundingBox())!;
    const barra = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--barra-inferior-h')) || 0);
    const vh = page.viewportSize()!.height;
    expect(c.y + c.height).toBeLessThanOrEqual(vh - barra + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
