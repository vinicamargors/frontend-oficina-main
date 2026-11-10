import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

// Fixtures `cheio` (dias atrás -> etapa): 0 ORC, 1 EXE, 2 AGP, 3 ORC, 4 EXE, 5 FIN, 6 AGP, 8 EXE, 9 ORC, 11 PAGO, 12 FIN, 15 PAGO.
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const diasAntes = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10);
};
const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const URL_OS = /\/os\/\?/;

async function preparar(page: Page, tema: 'claro' | 'escuro', cenario: 'cheio' | 'vazio' = 'cheio') {
  await simularBackend(page, cenario);
  await entrarComo(page, 'DONO', tema);
}

/** Registra os parâmetros de cada leitura de `/os/`. */
function registrarLeituras(page: Page): URLSearchParams[] {
  const leituras: URLSearchParams[] = [];
  page.on('request', (r) => {
    if (URL_OS.test(r.url())) leituras.push(new URL(r.url()).searchParams);
  });
  return leituras;
}

const botaoPeriodo = (page: Page) => page.getByRole('button', { name: /^(Últimos|Período) / });
const contagem = (page: Page, etapa: string) =>
  page.getByRole('region', { name: etapa, exact: true }).getByTestId('contagem-etapa');

async function escolher(page: Page, opcao: string) {
  await botaoPeriodo(page).click();
  await page.getByRole('menuitemradio', { name: opcao }).click();
}

test.describe('radar: seletor de período', () => {
  test('padrão é "Últimos 7 dias" e as leituras levam hoje-6 .. hoje', async ({ page }, info) => {
    const leituras = registrarLeituras(page);
    await preparar(page, contextoDoProjeto(info).tema);
    await abrirTela(page, 'radar');

    await expect(page.getByText('Últimos', { exact: true })).toBeVisible();
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 7 dias');
    await expect(botaoPeriodo(page)).toContainText('7 dias');

    const hoje = hojeSP();
    // 4 etapas + pagas (em desenvolvimento o StrictMode dobra o efeito, por isso "pelo menos")
    const doPeriodo = leituras.filter((q) => q.get('data_inicio'));
    expect(doPeriodo.length).toBeGreaterThanOrEqual(5);
    for (const q of doPeriodo) {
      expect(q.get('data_inicio')).toBe(diasAntes(hoje, 6));
      expect(q.get('data_fim')).toBe(hoje);
    }
    expect(new Set(doPeriodo.map((q) => q.get('status')))).toEqual(
      new Set(['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO', 'FINALIZADO', 'PAGO'])
    );
    exigirRedeCompleta(page);
  });

  test('14 e 30 dias refazem a leitura com o início certo; a contagem acompanha o total', async ({ page }, info) => {
    const leituras = registrarLeituras(page);
    await preparar(page, contextoDoProjeto(info).tema);
    await abrirTela(page, 'radar');
    const hoje = hojeSP();

    // 7 dias: ORC 2, AGP 2, EXE 2, FIN 1
    await expect(contagem(page, 'Orçamento')).toHaveText('2');
    await expect(contagem(page, 'Aguardando peça')).toHaveText('2');
    await expect(contagem(page, 'Em execução')).toHaveText('2');
    await expect(contagem(page, 'Finalizado')).toHaveText('1');

    leituras.length = 0;
    await escolher(page, '14 dias');
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 14 dias');
    await expect(contagem(page, 'Orçamento')).toHaveText('3');
    await expect(contagem(page, 'Em execução')).toHaveText('3');
    await expect(contagem(page, 'Finalizado')).toHaveText('2');
    expect(leituras.some((q) => q.get('data_inicio') === diasAntes(hoje, 13) && q.get('data_fim') === hoje)).toBe(true);
    for (const etapa of ['Orçamento', 'Aguardando peça', 'Em execução', 'Finalizado']) {
      const regiao = page.getByRole('region', { name: etapa, exact: true });
      const n = Number(await contagem(page, etapa).textContent());
      expect(await regiao.getByRole('button').filter({ has: page.getByRole('img', { name: /^Placa / }) }).count()).toBe(n);
    }

    leituras.length = 0;
    await escolher(page, '30 dias');
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 30 dias');
    expect(leituras.some((q) => q.get('data_inicio') === diasAntes(hoje, 29))).toBe(true);
    await expect(page.getByText('2 ordens pagas e entregues no período')).toBeVisible();
    exigirRedeCompleta(page);
  });

  test('Personalizado valida as datas e mostra o intervalo no botão', async ({ page }, info) => {
    const leituras = registrarLeituras(page);
    await preparar(page, contextoDoProjeto(info).tema);
    await abrirTela(page, 'radar');
    const hoje = hojeSP();

    await botaoPeriodo(page).click();
    await page.getByRole('menuitemradio', { name: 'Personalizado' }).click();
    const de = page.getByLabel('De', { exact: true });
    const ate = page.getByLabel('Até', { exact: true });
    await expect(de).toBeVisible();
    await expect(ate).toBeVisible();
    await expect(de).toHaveAttribute('max', hoje);
    await expect(ate).toHaveAttribute('max', hoje);

    await de.fill(diasAntes(hoje, 2));
    await ate.fill(diasAntes(hoje, 5));
    await expect(page.getByRole('alert')).toContainText('anterior');
    await expect(page.getByRole('button', { name: 'Aplicar' })).toBeDisabled();

    leituras.length = 0;
    await de.fill(diasAntes(hoje, 12));
    await ate.fill(diasAntes(hoje, 3));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Aplicar' }).click();

    await expect(botaoPeriodo(page)).toHaveAccessibleName(`Período ${curta(diasAntes(hoje, 12))} – ${curta(diasAntes(hoje, 3))}`);
    expect(leituras.some((q) => q.get('data_inicio') === diasAntes(hoje, 12) && q.get('data_fim') === diasAntes(hoje, 3))).toBe(true);
    exigirRedeCompleta(page);
  });

  test('o preset persiste ao recarregar; o intervalo personalizado não', async ({ page }, info) => {
    await preparar(page, contextoDoProjeto(info).tema);
    await abrirTela(page, 'radar');
    await escolher(page, '30 dias');
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 30 dias');
    expect(await page.evaluate(() => localStorage.getItem('mecanify_radar_periodo'))).toBe('30');

    await page.reload();
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 30 dias');

    const hoje = hojeSP();
    await botaoPeriodo(page).click();
    await page.getByRole('menuitemradio', { name: 'Personalizado' }).click();
    await page.getByLabel('De', { exact: true }).fill(diasAntes(hoje, 5));
    await page.getByLabel('Até', { exact: true }).fill(hoje);
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(botaoPeriodo(page)).toHaveAccessibleName(/^Período /);
    expect(await page.evaluate(() => localStorage.getItem('mecanify_radar_periodo'))).toBe('30');

    await page.reload();
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 30 dias');
  });

  test('menu: teclado, Esc devolve o foco, opção marcada com texto/ícone', async ({ page }, info) => {
    await preparar(page, contextoDoProjeto(info).tema);
    await abrirTela(page, 'radar');
    const gatilho = botaoPeriodo(page);
    await expect(gatilho).toHaveAttribute('aria-haspopup', 'menu');
    await expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    await gatilho.click();
    await expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitemradio', { name: '7 dias' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('menuitemradio', { name: '14 dias' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('menuitemradio', { name: '7 dias' }).locator('svg')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemradio', { name: '14 dias' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(gatilho).toBeFocused();
    await gatilho.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitemradio', { name: '14 dias' }).focus();
    await page.keyboard.press('Enter');
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 14 dias');
  });

  test('aviso de ordens abertas mais antigas: aparece com o N certo e some quando N = 0', async ({ page }, info) => {
    await preparar(page, contextoDoProjeto(info).tema);
    await abrirTela(page, 'radar');
    // 7 dias: Em execução (8 dias) e Orçamento (9 dias) ficam de fora
    const aviso = page.getByText('2 ordens abertas mais antigas ficam fora do período');
    await expect(aviso).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver', exact: true })).toBeVisible();

    await escolher(page, '14 dias');
    await expect(contagem(page, 'Orçamento')).toHaveText('3');
    await expect(page.getByText(/mais antigas? ficam? fora do período/)).toHaveCount(0);

    await escolher(page, '7 dias');
    await expect(aviso).toBeVisible();
    await page.getByRole('button', { name: 'Ver', exact: true }).click();
    await expect(page).toHaveURL(/tab=os/);
    exigirRedeCompleta(page);
  });

  test('esqueleto no primeiro carregamento e durante a troca de período', async ({ page }, info) => {
    await preparar(page, contextoDoProjeto(info).tema);
    await page.route(URL_OS, async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fallback();
    });
    await page.goto('/?tab=patio');
    await expect(page.getByRole('status').filter({ hasText: 'Carregando' }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Orçamento', exact: true })).toBeVisible({ timeout: 10_000 });

    await escolher(page, '14 dias');
    // durante a troca o quadro anterior continua na tela (sem piscar vazio) e marcado como ocupado
    await expect(page.getByTestId('radar-conteudo')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('region', { name: 'Orçamento', exact: true })).toBeVisible();
    await expect(page.getByTestId('radar-conteudo')).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
    await expect(contagem(page, 'Orçamento')).toHaveText('3');
  });

  test('resposta antiga não sobrescreve a mais nova', async ({ page }, info) => {
    await preparar(page, contextoDoProjeto(info).tema);
    const hoje = hojeSP();
    await abrirTela(page, 'radar');
    // 30 dias demora; 14 dias responde logo: a de 30 chega depois e deve ser ignorada
    await page.route(URL_OS, async (route) => {
      const inicio = new URL(route.request().url()).searchParams.get('data_inicio');
      if (inicio === diasAntes(hoje, 29)) await new Promise((r) => setTimeout(r, 2000));
      await route.fallback();
    });
    await escolher(page, '30 dias');
    await escolher(page, '14 dias');
    await expect(page.getByText('1 ordem paga e entregue no período')).toBeVisible();
    await page.waitForTimeout(2600);
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 14 dias');
    await expect(page.getByText('1 ordem paga e entregue no período')).toBeVisible();
    await expect(page.getByText('2 ordens pagas e entregues no período')).toHaveCount(0);
  });

  test('celular: controle numa linha, alvos de 44px e sem rolagem lateral', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await preparar(page, tema);
    await abrirTela(page, 'radar');
    const grupo = page.getByRole('group', { name: 'Período do quadro' });
    const caixa = (await grupo.boundingBox())!;
    expect(caixa.height).toBeLessThanOrEqual(52);
    expect((await botaoPeriodo(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // fica logo abaixo do título
    const titulo = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(caixa.y).toBeGreaterThanOrEqual(titulo.y + titulo.height - 1);
    expect(caixa.y - (titulo.y + titulo.height)).toBeLessThan(40);

    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await sobra()).toBeLessThanOrEqual(0);
    await botaoPeriodo(page).click();
    for (const item of await page.getByRole('menuitemradio').all()) {
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('menuitemradio', { name: 'Personalizado' }).click();
    for (const campo of [page.getByLabel('De', { exact: true }), page.getByLabel('Até', { exact: true }), page.getByRole('button', { name: 'Aplicar' })]) {
      expect((await campo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await sobra()).toBeLessThanOrEqual(0);
    const painel = (await page.getByTestId('periodo-painel').boundingBox())!;
    expect(painel.x).toBeGreaterThanOrEqual(0);
    expect(painel.x + painel.width).toBeLessThanOrEqual(largura);
  });

  test('desktop: controle ao lado do título', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura < 1024, 'só desktop');
    await preparar(page, tema);
    await abrirTela(page, 'radar');
    const titulo = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const grupo = (await page.getByRole('group', { name: 'Período do quadro' }).boundingBox())!;
    expect(Math.abs(grupo.y + grupo.height / 2 - (titulo.y + titulo.height / 2))).toBeLessThan(30);
    expect(grupo.x).toBeGreaterThan(titulo.x + titulo.width);
  });
});
