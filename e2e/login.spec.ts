import { expect, test } from '@playwright/test';
import { exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

async function abrir(page: import('@playwright/test').Page, modo?: string) {
  await simularBackend(page, 'cheio');
  await page.goto(modo ? `/?modo=${modo}` : '/');
  await page.locator('h1, h2').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('login', () => {
  test('marca com nome acessível e legenda GESTÃO DE OS; sem rolagem horizontal', async ({ page }) => {
    await abrir(page);
    await expect(page.getByRole('img', { name: 'Mecanify' }).locator('visible=true').first()).toBeVisible();
    await expect(page.getByText('GESTÃO DE OS').locator('visible=true').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
  });

  test('no celular, e-mail e botão de entrar aparecem sem rolar (390x844)', async ({ page }, info) => {
    test.skip(contextoDoProjeto(info).largura >= 1024, 'só celular');
    await abrir(page);
    const email = await page.getByLabel('E-mail').boundingBox();
    const enviar = await page.getByRole('button', { name: /^Entrar/ , exact: false }).last().boundingBox();
    expect(email!.y + email!.height).toBeLessThanOrEqual(844);
    expect(enviar!.y + enviar!.height).toBeLessThanOrEqual(844);
  });

  test('abas Entrar / Criar conta com aria-selected e cada campo com rótulo visível', async ({ page }) => {
    await abrir(page);
    const entrar = page.getByRole('tab', { name: 'Entrar' });
    const criar = page.getByRole('tab', { name: 'Criar conta' });
    await expect(entrar).toHaveAttribute('aria-selected', 'true');
    await expect(criar).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();

    await criar.click();
    await expect(criar).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Cadastrar nova oficina' })).toBeVisible();
    for (const r of ['Nome da oficina', 'Seu nome', 'WhatsApp ou celular', 'E-mail']) {
      await expect(page.getByLabel(r)).toBeVisible();
    }
    await expect(page.getByLabel(/^Senha/)).toBeVisible();
    exigirRedeCompleta(page);
  });

  test('erro de validação aparece sob o campo, ligado por aria-describedby', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Entrar no Mecanify' }).click();
    const email = page.getByLabel('E-mail');
    const ids = await email.getAttribute('aria-describedby');
    expect(ids).toBeTruthy();
    const msg = page.locator(`[id="${ids!.split(" ")[0]}"]`);
    await expect(msg).toContainText('e-mail válido');
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    await email.fill('a@b.com');
    await page.getByRole('button', { name: 'Entrar no Mecanify' }).click();
    const senha = page.getByLabel('Senha', { exact: true });
    const idS = await senha.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${idS!.split(" ")[0]}"]`)).toContainText('pelo menos 6');
  });

  test('senha: botão mostrar/ocultar com nome e alvo de 44px', async ({ page }) => {
    await abrir(page);
    const botao = page.getByRole('button', { name: 'Mostrar senha' });
    const caixa = await botao.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(44);
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    await botao.click();
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ocultar senha' })).toBeVisible();
  });

  test('recuperar senha e nova senha mostram seus títulos e campos rotulados', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar para o login' }).click();
    await expect(page.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true');

    await page.goto('/?modo=nova-senha');
    await expect(page.getByRole('heading', { name: 'Criar nova senha' })).toBeVisible();
    await expect(page.getByLabel('Nova senha', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Repita a nova senha')).toBeVisible();
  });

  test('erros por campo são anunciados (role alert) e o foco vai ao primeiro campo inválido', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Entrar no Mecanify' }).click();
    const alerta = page.getByRole('alert').filter({ hasText: 'e-mail válido' });
    await expect(alerta).toHaveCount(1);
    await expect(page.getByLabel('E-mail')).toBeFocused();
    await page.getByLabel('E-mail').fill('a@b.com');
    await page.getByRole('button', { name: 'Entrar no Mecanify' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'pelo menos 6' })).toHaveCount(1);
    await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
  });

  test('toggle de senha fica sobre o campo, com ou sem dica/erro', async ({ page }) => {
    await abrir(page, 'cadastro');
    const centro = async () => {
      const campo = await page.getByLabel('Senha', { exact: true }).boundingBox();
      const botao = await page.getByRole('button', { name: 'Mostrar senha' }).boundingBox();
      expect(Math.abs(campo!.y + campo!.height / 2 - (botao!.y + botao!.height / 2))).toBeLessThanOrEqual(1);
      expect(Math.abs(campo!.x + campo!.width - (botao!.x + botao!.width))).toBeLessThanOrEqual(1);
    };
    await centro();
    await page.getByLabel('Nome da oficina').fill('Oficina');
    await page.getByLabel('Seu nome').fill('Carlos');
    await page.getByLabel('E-mail').fill('a@b.com');
    await page.getByRole('button', { name: 'Criar conta' }).last().click();
    await expect(page.getByRole('alert').filter({ hasText: 'pelo menos 6' })).toBeVisible();
    await centro();
  });

  test('ThemeToggle de desktop tem ancestral posicionado (rola junto com a página)', async ({ page }, info) => {
    test.skip(contextoDoProjeto(info).largura < 1024, 'só desktop');
    await abrir(page);
    const ancestral = await page.evaluate(() => {
      const el = [...document.querySelectorAll('main > div')].find((d) => getComputedStyle(d).position === 'absolute') as HTMLElement | undefined;
      return el?.offsetParent?.tagName ?? null;
    });
    expect(ancestral).toBe('MAIN');
  });

  test('"Voltar para o login" alinha rente à borda do título', async ({ page }) => {
    await abrir(page, 'recuperar');
    const voltar = page.getByRole('button', { name: 'Voltar para o login' });
    const icone = await voltar.locator('svg').boundingBox();
    const titulo = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(Math.abs(icone!.x - titulo!.x)).toBeLessThanOrEqual(1);
  });
});
