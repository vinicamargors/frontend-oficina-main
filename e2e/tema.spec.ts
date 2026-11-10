import { expect, test } from '@playwright/test';
import { abrirTela, entrarComo, exigirRedeCompleta, simularBackend } from './mocks';

const CHAVE_TEMA = 'mecanify_tema';

test.describe('tema', () => {
  test('sem preferência salva, segue o esquema de cores do sistema (escuro)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await simularBackend(page, 'cheio');
    await abrirTela(page, 'login');
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
    exigirRedeCompleta(page);
  });

  test('preferência "claro" salva vence o sistema escuro', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript((k) => localStorage.setItem(k, 'claro'), CHAVE_TEMA);
    await simularBackend(page, 'cheio');
    await abrirTela(page, 'login');
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/);
    exigirRedeCompleta(page);
  });

  test('preferência "escuro" salva vence o sistema claro (via entrarComo)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', 'escuro');
    await abrirTela(page, 'radar');
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
    exigirRedeCompleta(page);
  });

  test('a classe já está correta no primeiro DOMContentLoaded (sem flash)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript((k) => localStorage.setItem(k, 'claro'), CHAVE_TEMA);
    await page.addInitScript(() => {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          (window as unknown as { __darkNoPrimeiroDCL: boolean }).__darkNoPrimeiroDCL =
            document.documentElement.classList.contains('dark');
        },
        { once: true }
      );
    });
    await simularBackend(page, 'cheio');
    await abrirTela(page, 'login');
    const darkNoPrimeiroDCL = await page.evaluate(
      () => (window as unknown as { __darkNoPrimeiroDCL: boolean }).__darkNoPrimeiroDCL
    );
    expect(darkNoPrimeiroDCL).toBe(false);
    exigirRedeCompleta(page);
  });
});
