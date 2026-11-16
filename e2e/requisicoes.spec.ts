import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, simularBackend, API_URL, type Tela } from './mocks';

/** Conta GETs à API por caminho (com query) durante a abertura de uma tela. Base do cenário F12. */
async function contarGets(page: Page, tela: Tela): Promise<Record<string, number>> {
  const contagem: Record<string, number> = {};
  page.on('request', (r) => {
    if (r.method() !== 'GET' || !r.url().startsWith(API_URL)) return;
    const caminho = r.url().slice(API_URL.length);
    contagem[caminho] = (contagem[caminho] ?? 0) + 1;
  });
  await abrirTela(page, tela);
  await page.waitForLoadState('networkidle');
  return contagem;
}

for (const tela of ['radar', 'equipe', 'oficina'] as const) {
  test(`${tela}: nenhum GET idêntico repetido ao abrir`, async ({ page }) => {
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', 'claro');
    const gets = await contarGets(page, tela);
    const repetidos = Object.entries(gets).filter(([, n]) => n > 1);
    expect(repetidos, `GET repetido em ${tela}`).toEqual([]);
  });
}

test('trocar de tela dentro do app não rebusca a lista de oficinas', async ({ page }) => {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', 'claro');
  const gets = await contarGets(page, 'radar');
  const n = () => Object.entries(gets).filter(([c]) => c.startsWith('/empresas/?') || c === '/empresas/').reduce((s, [, v]) => s + v, 0);
  const antes = n();
  for (const tab of ['clientes', 'estoque', 'financeiro', 'patio']) {
    await page.evaluate((t) => window.dispatchEvent(new CustomEvent('mecanify:navegar', { detail: { tab: t } })), tab);
    await page.waitForLoadState('networkidle');
  }
  expect(n()).toBe(antes);
  expect(antes).toBe(1);
});
