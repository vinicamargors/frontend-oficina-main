import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { TELAS, abrirTela, clientes, entrarComo, exigirRedeCompleta, ordens, simularBackend, type Cenario } from './mocks';
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

// Clientes: um cliente expandido (veículos aninhados) e a ficha de novo cliente aberta:
// `clientes-expandido-<tema>-<largura>.png` e `clientes-ficha-<tema>-<largura>.png`.
test('print clientes expandido (veículos do cliente)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'clientes');
  await page.getByRole('list', { name: 'Clientes' }).getByRole('button', { name: new RegExp(clientes[0].nome) }).first().click();
  await page.getByRole('list', { name: `Veículos de ${clientes[0].nome}` }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `clientes-expandido-${tema}-${largura}.png`), fullPage: true, animations: 'disabled' });
});

test('print clientes ficha (novo cliente aberto)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'clientes');
  await page.getByRole('button', { name: /Novo cliente/ }).click();
  await page.getByRole('dialog', { name: /Novo cliente/ }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `clientes-ficha-${tema}-${largura}.png`), animations: 'disabled' });
});

// Clientes, parte de veículos: aba Placas, edição do veículo, histórico por placa e veículo novo com consulta de placa:
// `clientes-{placas,veiculo-editar,historico,veiculo-novo}-<tema>-<largura>.png`.
test('print clientes placas (aba Placas)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'clientes');
  await page.getByRole('tab', { name: /Placas/ }).click();
  await page.getByRole('list', { name: 'Veículos' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `clientes-placas-${tema}-${largura}.png`), fullPage: true, animations: 'disabled' });
});

async function abrirVeiculosDoJoao(page: import('@playwright/test').Page, tema: 'claro' | 'escuro') {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'clientes');
  await page.getByRole('list', { name: 'Clientes' }).getByRole('button', { name: new RegExp(clientes[0].nome) }).first().click();
  return page.getByRole('list', { name: `Veículos de ${clientes[0].nome}` });
}

test('print clientes veiculo editar (Editar veículo aberto)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  const veics = await abrirVeiculosDoJoao(page, tema);
  await veics.getByRole('button', { name: 'Editar veículo ABC1234' }).click();
  await page.getByRole('dialog', { name: /Editar Veículo/ }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `clientes-veiculo-editar-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print clientes historico (histórico da placa com várias OS)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  const veics = await abrirVeiculosDoJoao(page, tema);
  await veics.getByRole('button', { name: 'Histórico do veículo ABC1234' }).click();
  await page.getByRole('dialog', { name: 'Histórico do Veículo ABC1234' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `clientes-historico-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print clientes veiculo novo (adicionar veículo com consulta de placa)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'clientes');
  await page.getByRole('button', { name: `Mais ações de ${clientes[0].nome}` }).click();
  await page.getByRole('menuitem', { name: /Adicionar veículo/ }).click();
  const d = page.getByRole('dialog', { name: `Ficha de ${clientes[0].nome}` });
  await d.getByRole('textbox', { name: /^Placa/ }).fill('ZZZ9Z99');
  await d.getByRole('button', { name: 'Buscar Placa' }).click();
  const msg = d.getByText('Dados do veículo preenchidos pela placa!');
  await msg.waitFor();
  await msg.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `clientes-veiculo-novo-${tema}-${largura}.png`), animations: 'disabled' });
});

// Estoque: formulário de nova peça, folha de ajuste (entrada), confirmação de exclusão e menu da linha:
// `estoque-{form,ajuste,exclusao,menu}-<tema>-<largura>.png`. O estado de estoque baixo já aparece em `estoque-*-cheio`.
async function abrirEstoque(page: import('@playwright/test').Page, tema: 'claro' | 'escuro') {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'estoque');
}
const nomeBaixo = 'Filtro de ar condicionado';

test('print estoque form (nova peça aberta)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirEstoque(page, tema);
  await page.getByRole('button', { name: /Nova peça/ }).click();
  await page.getByRole('dialog', { name: 'Nova peça no estoque' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `estoque-form-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print estoque ajuste (entrada com quantidade)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirEstoque(page, tema);
  await page.getByRole('button', { name: `Mais ações de ${nomeBaixo}` }).click();
  await page.getByRole('menuitem', { name: /Registrar entrada/ }).click();
  const d = page.getByRole('dialog', { name: 'Entrada no estoque' });
  await d.waitFor();
  await d.getByRole('button', { name: 'Aumentar quantidade' }).click();
  await d.getByRole('button', { name: 'Aumentar quantidade' }).click();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `estoque-ajuste-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print estoque exclusao (confirmação)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirEstoque(page, tema);
  await page.getByRole('button', { name: `Mais ações de ${nomeBaixo}` }).click();
  await page.getByRole('menuitem', { name: /Excluir peça/ }).click();
  await page.getByRole('dialog', { name: 'Excluir peça do estoque?' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `estoque-exclusao-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print estoque menu (ações da linha)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirEstoque(page, tema);
  await page.getByRole('button', { name: `Mais ações de ${nomeBaixo}` }).click();
  await page.getByRole('menu').waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `estoque-menu-${tema}-${largura}.png`), animations: 'disabled' });
});
