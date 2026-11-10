import { expect, test } from '@playwright/test';
import { TELAS, abrirTela, entrarComo, exigirRedeCompleta, simularBackend, type Cenario } from './mocks';
import { coletarErros, contextoDoProjeto } from './contexto';

const CENARIOS: Cenario[] = ['cheio', 'vazio'];

for (const cenario of CENARIOS) {
  for (const tela of TELAS) {
    test(`${tela} (${cenario}) abre com título, sem rolagem lateral e sem erros`, async ({ page }, info) => {
      const { tema } = contextoDoProjeto(info);
      const erros = coletarErros(page);

      await simularBackend(page, cenario);
      if (tela !== 'login' && tela !== 'avaliacao') await entrarComo(page, 'DONO', tema);

      await abrirTela(page, tela);

      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const semRolagemLateral = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      expect(semRolagemLateral, 'a página não pode rolar na horizontal').toBe(true);

      exigirRedeCompleta(page);
      expect(erros, 'erros de console / exceções').toEqual([]);
    });
  }
}
