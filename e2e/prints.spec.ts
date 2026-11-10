import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { TELAS, abrirTela, entrarComo, exigirRedeCompleta, simularBackend, type Cenario } from './mocks';
import { contextoDoProjeto } from './contexto';

/**
 * Prints de referência: `prints/<tela>-<tema>-<largura>-<cenario>.png`.
 * Pasta padrão `prints/antes`; use `PRINTS_DIR=prints/depois` para gerar a outra rodada.
 * Rodar uma tela só: `npm run prints -- radar`.
 */
const PASTA = join(process.cwd(), process.env.PRINTS_DIR || 'prints/antes');
const CENARIOS: Cenario[] = ['cheio', 'vazio'];

test.use({ deviceScaleFactor: 2 });

for (const cenario of CENARIOS) {
  for (const tela of TELAS) {
    test(`print ${tela} ${cenario}`, async ({ page }, info) => {
      const { tema, largura } = contextoDoProjeto(info);
      mkdirSync(PASTA, { recursive: true });

      await simularBackend(page, cenario);
      if (tela !== 'login' && tela !== 'avaliacao') await entrarComo(page, 'DONO', tema);
      await abrirTela(page, tela);
      exigirRedeCompleta(page);

      await page.screenshot({
        path: join(PASTA, `${tela}-${tema}-${largura}-${cenario}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}
