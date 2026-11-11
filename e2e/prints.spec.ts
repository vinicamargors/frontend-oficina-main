import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { EMPRESA_ID, TELAS, abrirTela, clientes, entrarComo, exigirRedeCompleta, ordens, simularBackend, type Cenario } from './mocks';
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
      // a barra de salvar é `sticky`: numa captura de página inteira ela apareceria no meio; aqui ela vai para o fim
      if (tela === 'oficina') await page.addStyleTag({ content: '.sticky { position: static !important; }' });

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
  await veics.getByRole('button', { name: 'Editar veículo ABC-1234' }).click();
  await page.getByRole('dialog', { name: /Editar Veículo/ }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `clientes-veiculo-editar-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print clientes historico (histórico da placa com várias OS)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  const veics = await abrirVeiculosDoJoao(page, tema);
  await veics.getByRole('button', { name: 'Histórico do veículo ABC-1234' }).click();
  await page.getByRole('dialog', { name: 'Histórico do Veículo ABC-1234' }).waitFor();
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

// Financeiro: cada aba em cada cenário, o formulário de novo lançamento e as confirmações de baixa e de exclusão:
// `financeiro-<balanco|dre|contas|bi>-<tema>-<largura>-<cenario>.png` e `financeiro-{form,baixa,exclusao}-<tema>-<largura>.png`.
const ABAS_FINANCEIRO = [
  ['balanco', 'Balanço'],
  ['dre', 'DRE'],
  ['contas', 'Contas'],
  ['bi', 'BI'],
] as const;

for (const cenario of CENARIOS) {
  test(`print financeiro abas ${cenario}`, async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    mkdirSync(PASTA, { recursive: true });
    await simularBackend(page, cenario);
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'financeiro');
    for (const [id, rotulo] of ABAS_FINANCEIRO) {
      await page.getByRole('tablist', { name: 'Seções do financeiro' }).getByRole('tab', { name: new RegExp(`^${rotulo}( · \\d+)?$`) }).click();
      await page.mouse.move(1, 1);
      await page.screenshot({ path: join(PASTA, `financeiro-${id}-${tema}-${largura}-${cenario}.png`), fullPage: true, animations: 'disabled' });
    }
    exigirRedeCompleta(page);
  });
}

async function abrirContasFinanceiro(page: import('@playwright/test').Page, tema: 'claro' | 'escuro') {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'financeiro');
  await page.getByRole('tab', { name: /^Contas( · \d+)?$/ }).click();
}
const pendenteFinanceiro = 'Fornecedor de peças — Distribuidora Sul';

test('print financeiro form (novo lançamento aberto)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'financeiro');
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  await page.getByRole('dialog', { name: 'Novo lançamento' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `financeiro-form-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print financeiro baixa (confirmação)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirContasFinanceiro(page, tema);
  await page.getByRole('button', { name: `Mais ações de ${pendenteFinanceiro}` }).click();
  await page.getByRole('menuitem', { name: 'Marcar como pago' }).click();
  await page.getByRole('dialog', { name: 'Dar baixa no lançamento?' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `financeiro-baixa-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print financeiro exclusao (confirmação)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirContasFinanceiro(page, tema);
  await page.getByRole('button', { name: `Mais ações de ${pendenteFinanceiro}` }).click();
  await page.getByRole('menuitem', { name: 'Excluir lançamento' }).click();
  await page.getByRole('dialog', { name: 'Excluir lançamento?' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `financeiro-exclusao-${tema}-${largura}.png`), animations: 'disabled' });
});

// Equipe: cada aba em cada cenário, o formulário, as confirmações, o esqueleto de carregamento e o holerite em
// modo de impressão: `equipe-<colaboradores|folha|escalas|ponto|avaliacoes>-<tema>-<largura>-<cenario>.png` e
// `equipe-{form,confirmacao-desativar,confirmacao-folha,carregando,holerite,holerite-impressao}-<tema>-<largura>.png`.
const ABAS_EQUIPE = [
  ['colaboradores', 'Equipe'],
  ['folha', 'Folha'],
  ['escalas', 'Escalas'],
  ['ponto', 'Ponto'],
  ['avaliacoes', 'Avaliações'],
] as const;

async function abrirEquipe(page: import('@playwright/test').Page, tema: 'claro' | 'escuro', cenario: Cenario = 'cheio') {
  await simularBackend(page, cenario);
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'equipe');
}

for (const cenario of CENARIOS) {
  test(`print equipe abas ${cenario}`, async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    mkdirSync(PASTA, { recursive: true });
    await abrirEquipe(page, tema, cenario);
    for (const [id, rotulo] of ABAS_EQUIPE) {
      await page.getByRole('tablist', { name: 'Seções da equipe' }).getByRole('tab', { name: rotulo }).click();
      await page.mouse.move(1, 1);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(PASTA, `equipe-${id}-${tema}-${largura}-${cenario}.png`), fullPage: true, animations: 'disabled' });
    }
    exigirRedeCompleta(page);
  });
}

test('print equipe form (editar colaborador)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirEquipe(page, tema);
  await page.getByRole('button', { name: 'Mais ações de Tiago Ferreira' }).click();
  await page.getByRole('menuitem', { name: 'Editar colaborador' }).click();
  await page.getByRole('dialog', { name: 'Editar colaborador' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `equipe-form-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print equipe confirmações (desativar e lançar folha)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirEquipe(page, tema);
  await page.getByRole('button', { name: 'Mais ações de Tiago Ferreira' }).click();
  await page.getByRole('menuitem', { name: 'Desativar colaborador' }).click();
  await page.getByRole('dialog', { name: 'Desativar colaborador?' }).waitFor();
  await page.mouse.move(1, 1);
  await page.screenshot({ path: join(PASTA, `equipe-confirmacao-desativar-${tema}-${largura}.png`), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Folha' }).click();
  await page.getByRole('button', { name: /Lançar no Contas a Pagar/ }).click();
  await page.getByRole('dialog', { name: 'Lançar folha no Contas a Pagar?' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `equipe-confirmacao-folha-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print equipe carregando (esqueleto)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await page.route('**/api/v1/usuarios/*', async (route) => {
    if (route.request().method() === 'GET' && !route.request().url().endsWith('/me')) return; // nunca responde
    return route.fallback();
  });
  await entrarComo(page, 'DONO', tema);
  await page.goto('/?tab=equipe');
  await page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando' }).waitFor();
  await page.mouse.move(1, 1);
  await page.screenshot({ path: join(PASTA, `equipe-carregando-${tema}-${largura}.png`), animations: 'disabled' });
});

test('print equipe holerite (tela e impressão)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await abrirEquipe(page, tema);
  await page.getByRole('tab', { name: 'Folha' }).click();
  await page.getByRole('button', { name: 'Ver holerite de Tiago Ferreira' }).click();
  await page.getByRole('dialog', { name: 'Holerite' }).waitFor();
  await page.mouse.move(1, 1);
  exigirRedeCompleta(page);
  await page.screenshot({ path: join(PASTA, `equipe-holerite-${tema}-${largura}.png`), animations: 'disabled' });
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: join(PASTA, `equipe-holerite-impressao-${tema}-${largura}.png`), animations: 'disabled' });
});

// Radar com o seletor de período aberto (menu) e com "Personalizado" aberto: `radar-periodo-<menu|personalizado>-<tema>-<largura>.png`.
test('print radar período (menu e personalizado)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });

  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'radar');
  const gatilho = page.getByRole('button', { name: /^Últimos / });
  await gatilho.click();
  await page.screenshot({ path: join(PASTA, `radar-periodo-menu-${tema}-${largura}.png`), animations: 'disabled' });
  await page.getByRole('menuitemradio', { name: 'Personalizado' }).click();
  await page.screenshot({ path: join(PASTA, `radar-periodo-personalizado-${tema}-${largura}.png`), animations: 'disabled' });
  exigirRedeCompleta(page);
});

// Período sem ordens, mas com ordens abertas mais antigas: `radar-vazio-periodo-<tema>-<largura>.png`.
test('print radar vazio-periodo (sem ordens no período, com abertas mais antigas)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });

  await simularBackend(page, 'cheio');
  await page.route(/\/os\/\?/, async (route) => {
    if (new URL(route.request().url()).searchParams.get('data_inicio')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ items: [], total: 0, skip: 0, limit: 20 }),
      });
    } else await route.fallback();
  });
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'radar');
  await page.screenshot({ path: join(PASTA, `radar-vazio-periodo-${tema}-${largura}.png`), fullPage: true, animations: 'disabled' });
  exigirRedeCompleta(page);
});

// Dados da Oficina: carregando (esqueleto), formulário sujo com o aviso de descarte e conta nova (sem cadastro):
// `oficina-<carregando|descartar|conta-nova>-<tema>-<largura>.png`.
test('print oficina estados (carregando, descartar, conta nova)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  const tirar = (nome: string, cheia = false) =>
    page.screenshot({ path: join(PASTA, `oficina-${nome}-${tema}-${largura}.png`), fullPage: cheia, animations: 'disabled' });

  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  let atrasar = true;
  await page.route('**/api/v1/empresas/*/configuracoes', async (r) => {
    if (atrasar && r.request().method() === 'GET') await new Promise((ok) => setTimeout(ok, 2500));
    await r.fallback();
  });
  await page.goto('/?tab=oficina');
  await page.getByRole('heading', { level: 2, name: 'Folha e comissões' }).waitFor();
  await tirar('carregando', true);
  atrasar = false;

  await page.getByLabel('Chave PIX').waitFor();
  await page.getByLabel('Chave PIX').fill('nova-chave@oficina.example.com');
  await page.getByRole('button', { name: 'Descartar alterações' }).click();
  await page.getByRole('alert').filter({ hasText: 'Descartar alterações?' }).waitFor();
  await page.mouse.move(1, 1);
  await tirar('descartar');
  exigirRedeCompleta(page);
});

test('print oficina conta-nova (sem cadastro, sem pátio)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  const json = (corpo: unknown) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) });
  await page.route('**/api/v1/empresas/*/configuracoes', async (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    await r.fulfill(json({ latitude_gps: null, longitude_gps: null, raio_gps_metros: 100 }));
  });
  await page.route('**/api/v1/empresas/?*', (r) => r.fulfill(json([{ id: EMPRESA_ID, nome_fantasia: 'Oficina Nova', ativo: true }])));
  await abrirTela(page, 'oficina');
  exigirRedeCompleta(page);
  await page.addStyleTag({ content: '.sticky { position: static !important; }' });
  await page.screenshot({ path: join(PASTA, `oficina-conta-nova-${tema}-${largura}.png`), fullPage: true, animations: 'disabled' });
});

// Avaliação pública: nota escolhida, enviada e com erro: `avaliacao-<nota|enviada|erro>-<tema>-<largura>.png`.
test('print avaliacao estados (nota escolhida, enviada, erro)', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  mkdirSync(PASTA, { recursive: true });
  const tirar = (nome: string) =>
    page.screenshot({ path: join(PASTA, `avaliacao-${nome}-${tema}-${largura}.png`), fullPage: true, animations: 'disabled' });

  await simularBackend(page, 'cheio');
  let falhar = true;
  await page.route('**/api/v1/equipe/avaliar', async (r) => {
    if (falhar) {
      return r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ detail: 'x' }) });
    }
    await r.fallback();
  });
  await abrirTela(page, 'avaliacao');
  await page.getByRole('radio', { name: '3 estrelas' }).click();
  await page.getByLabel('Seu nome').fill('Maria Souza');
  await page.getByLabel('Modelo do veículo').fill('Fiat Argo 1.3');
  await page.getByLabel(/Comentário/).fill('Atendimento rápido e o carro ficou como novo.');
  await page.mouse.move(1, 1);
  await tirar('nota');

  await page.getByRole('button', { name: 'Enviar avaliação' }).click();
  await page.getByRole('alert').waitFor();
  await tirar('erro');

  falhar = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await page.getByRole('heading', { level: 1, name: 'Obrigado pela sua avaliação' }).waitFor();
  await tirar('enviada');
});
