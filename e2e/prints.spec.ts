import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { TELAS, abrirTela, entrarComo, exigirRedeCompleta, ordens, simularBackend, type Cenario } from './mocks';
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

// Shell (menu lateral / barra inferior) com o Radar ao fundo; no celular, também com a folha "Mais" aberta.
test('print shell (menu e barra)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });

  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'radar');
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `shell-${tema}-${largura}.png`), animations: 'disabled' });

  if (largura < 1024) {
    await page.getByRole('navigation', { name: 'Navegação Rápida Mobile' }).getByRole('button', { name: 'Mais' }).click();
    await page.getByRole('dialog', { name: 'Mais opções' }).waitFor();
    await page.screenshot({ path: join(PASTA, `shell-${tema}-${largura}-mais.png`), animations: 'disabled' });
  }
});

// Login em cada modo: `login-<entrar|criar-conta|recuperar>-<tema>-<largura>.png`.
test('print login (entrar, criar conta, recuperar)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });

  await simularBackend(page, 'cheio');
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), ['mecanify_tema', tema]);
  await abrirTela(page, 'login');
  const tirar = (nome: string) =>
    page.screenshot({ path: join(PASTA, `login-${nome}-${tema}-${largura}.png`), fullPage: true, animations: 'disabled' });

  await tirar('entrar');
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await page.getByRole('heading', { name: 'Cadastrar nova oficina' }).waitFor();
  await tirar('criar-conta');
  await page.getByRole('tab', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.getByRole('heading', { name: 'Recuperar senha' }).waitFor();
  await tirar('recuperar');
  exigirRedeCompleta(page);
});

// Folha de confirmação do pagamento aberta sobre a bancada: `pagamento-<tema>-<largura>.png`.
test('print pagamento (folha aberta)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });

  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'bancada');
  await page.getByRole('list', { name: 'Etapas da ordem de serviço' }).getByRole('button', { name: 'Pago / entregue', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirmar pagamento' }).waitFor();
  await page.mouse.move(1, 1); // sem hover acidental numa opção (pareceria pré-marcada)
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `pagamento-${tema}-${largura}.png`), animations: 'disabled' });
});

// Lista com mais de uma página (total 120, fixture de rota só neste print): `ordens-paginada-<tema>-<largura>.png`.
test('print ordens paginada', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await page.route('**/api/v1/os/?*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('status') || q.get('search')) return route.fallback();
    const limit = Number(q.get('limit') || 50);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ items: limit === 1 ? ordens.slice(0, 1) : ordens, total: 120, skip: Number(q.get('skip') || 0), limit }),
    });
  });
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'ordens');
  await page.getByRole('navigation', { name: 'Paginação de Ordens de Serviço' }).waitFor();
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `ordens-paginada-${tema}-${largura}.png`), fullPage: true, animations: 'disabled' });
});

// Celular: folha "Mover para…?" aberta ao tocar numa etapa da bancada: `bancada-etapa-<tema>-<largura>.png`.
test('print bancada etapa (confirmação no celular)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  test.skip(largura >= 1024, 'só celular');
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'bancada');
  await page.getByRole('list', { name: 'Etapas da ordem de serviço' }).getByRole('button', { name: 'Finalizado', exact: true }).click();
  await page.getByRole('dialog', { name: 'Mover para Finalizado?' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `bancada-etapa-${tema}-${largura}.png`), animations: 'disabled' });
});
